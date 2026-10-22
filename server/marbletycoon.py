#!/usr/bin/env python3
"""Server voor Marble Tycoon.

Alleen Python 3 + SQLite, geen extra pakketten. Doet twee dingen:
  1. de community: banen delen, bekijken, liken en gebruiken (REST onder /api/);
  2. multiplayer: een WebSocket-doorgeefluik onder /ws tussen het hostscherm en de telefoons.

nginx stuurt /api/ en /ws door naar deze dienst (die alleen op 127.0.0.1 luistert).

Gebruik:
  python3 marbletycoon.py serveer --db /var/lib/marble-tycoon/banen.db --poort 8790
  python3 marbletycoon.py serveer --db test.db --poort 8000 --statisch .     (lokaal testen: game + server)
  python3 marbletycoon.py backup  --db /var/lib/marble-tycoon/banen.db --map /var/backups/marble-tycoon
  python3 marbletycoon.py lijst   --db /var/lib/marble-tycoon/banen.db
  python3 marbletycoon.py verwijder --db /var/lib/marble-tycoon/banen.db --id ab12cd34

REST (JSON):
  GET    /api/status
  GET    /api/banen?sort=nieuw|populair|gebruikt&q=&offset=&limiet=&ids=&klant=
  POST   /api/banen                {naam, maker, beschrijving, data, thumb, klant}  -> {id, sleutel}
  GET    /api/banen/ID?klant=      -> {baan}
  PUT    /api/banen/ID             (kop X-Baan-Sleutel) {naam?, beschrijving?, data?, thumb?}
  DELETE /api/banen/ID             (kop X-Baan-Sleutel)
  POST   /api/banen/ID/like        {klant}  -> {likes, geliked}
  POST   /api/banen/ID/gebruikt    {klant}  -> {gebruikt}
  GET    /api/banen/ID/thumb.jpg

WebSocket /ws (JSON-berichten):
  host  -> {t:'maak', code?, sleutel?}         <- {t:'kamer', code, sleutel}
  host  -> {t:'naar', id, d}  /  {t:'allen', d}  /  {t:'kick', id}
  speler-> {t:'meedoen', code, naam, skin, sleutel?}  <- {t:'welkom', id, sleutel, naam}
  speler-> {...}                                -> host krijgt {t:'van', id, d}
  host krijgt ook {t:'speler', id, naam, skin, verbonden} en {t:'speler_weg', id}
"""
import argparse
import base64
import binascii
import datetime
import hashlib
import json
import os
import re
import secrets
import socket
import sqlite3
import struct
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

VERSIE = "1.0.0"
MAX_LICHAAM = 900 * 1024
MAX_BAAN = 700 * 1024
MAX_THUMB = 160 * 1024
PUBLICATIES_PER_UUR = 15
LIKES_PER_UUR = 300
GEBRUIK_PER_UUR = 400
KLANT_PATROON = re.compile(r"^[0-9a-f]{16,64}$")
ID_PATROON = re.compile(r"^[a-z0-9]{6,12}$")
ID_TEKENS = "abcdefghjkmnpqrstuvwxyz23456789"

SCHEMA = """
CREATE TABLE IF NOT EXISTS banen (
  id TEXT PRIMARY KEY,
  naam TEXT NOT NULL,
  maker TEXT NOT NULL DEFAULT '',
  beschrijving TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL,
  thumb BLOB,
  stukken INTEGER NOT NULL DEFAULT 0,
  decor INTEGER NOT NULL DEFAULT 0,
  knikkers INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  gebruikt INTEGER NOT NULL DEFAULT 0,
  sleutel_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL DEFAULT '',
  verborgen INTEGER NOT NULL DEFAULT 0,
  gemaakt TEXT NOT NULL,
  bijgewerkt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS likes (
  baan_id TEXT NOT NULL REFERENCES banen(id) ON DELETE CASCADE,
  klant TEXT NOT NULL,
  PRIMARY KEY (baan_id, klant)
);
CREATE TABLE IF NOT EXISTS gebruik (
  baan_id TEXT NOT NULL REFERENCES banen(id) ON DELETE CASCADE,
  klant TEXT NOT NULL,
  PRIMARY KEY (baan_id, klant)
);
CREATE INDEX IF NOT EXISTS banen_gemaakt ON banen(gemaakt);
CREATE INDEX IF NOT EXISTS banen_likes ON banen(likes);
CREATE INDEX IF NOT EXISTS banen_gebruikt ON banen(gebruikt);
"""


def nu_tekst():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def sha(t):
    return hashlib.sha256(t.encode()).hexdigest()


def schoon(tekst, maximum):
    if not isinstance(tekst, str):
        return ""
    tekst = re.sub(r"[\x00-\x1f\x7f]", "", tekst)
    return " ".join(tekst.split())[:maximum]


class Database:
    def __init__(self, pad):
        self.pad = pad
        os.makedirs(os.path.dirname(os.path.abspath(pad)), exist_ok=True)
        c = self.open()
        c.execute("PRAGMA journal_mode = WAL")
        c.executescript(SCHEMA)
        c.commit()
        c.close()
        zout_pad = pad + ".zout"
        if not os.path.exists(zout_pad):
            with open(zout_pad, "w") as f:
                f.write(secrets.token_hex(16))
            os.chmod(zout_pad, 0o600)
        with open(zout_pad) as f:
            self.zout = f.read().strip()

    def open(self):
        c = sqlite3.connect(self.pad, timeout=10)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA foreign_keys = ON")
        return c


class Teller:
    def __init__(self):
        self.slot = threading.Lock()
        self.pogingen = {}

    def mag(self, sleutel, maximum, venster):
        nu = time.time()
        with self.slot:
            lijst = [t for t in self.pogingen.get(sleutel, []) if nu - t < venster]
            if len(lijst) >= maximum:
                self.pogingen[sleutel] = lijst
                return False
            lijst.append(nu)
            self.pogingen[sleutel] = lijst
            if len(self.pogingen) > 20000:
                self.pogingen = {k: v for k, v in self.pogingen.items() if v and nu - v[-1] < 3600}
            return True


class Fout(Exception):
    def __init__(self, status, melding, code="fout"):
        super().__init__(melding)
        self.status = status
        self.melding = melding
        self.code = code


# --------------------------------------------------------------------------- baan controleren

TOEGESTANE_STUKKEN = {
    "recht", "bocht1", "bocht2", "bocht3", "kwart1", "kwart3", "sbocht", "spiraal1", "spiraal2",
    "looping", "kurk", "aqua", "aquaB", "launch", "finish",
}


def controleer_baan(data):
    if not isinstance(data, dict):
        raise Fout(400, "Ongeldige baan.", "ongeldig")
    if data.get("v") != 1:
        raise Fout(400, "Onbekende versie van de baan.", "ongeldig")
    start = data.get("start")
    stukken = data.get("stukken")
    decor = data.get("decor", [])
    if not isinstance(start, dict):
        raise Fout(400, "Een baan heeft een startpunt nodig.", "geen_start")
    if not isinstance(stukken, list) or len(stukken) < 2:
        raise Fout(400, "Bouw eerst een baan van minstens twee stukken.", "te_kort")
    if len(stukken) > 2000 or not isinstance(decor, list) or len(decor) > 5000:
        raise Fout(400, "Deze baan is te groot.", "te_groot")
    for st in stukken:
        if not isinstance(st, dict) or st.get("t") not in TOEGESTANE_STUKKEN or len(st) > 16:
            raise Fout(400, "De baan bevat onbekende stukken.", "ongeldig")
        for k, v in st.items():
            if not isinstance(k, str) or len(k) > 3 or not isinstance(v, (int, float, str)) or (isinstance(v, str) and len(v) > 8):
                raise Fout(400, "De baan bevat ongeldige gegevens.", "ongeldig")
    for d in decor:
        if not isinstance(d, dict) or not isinstance(d.get("i"), str) or len(d) > 8 or len(d["i"]) > 24:
            raise Fout(400, "Het decor bevat ongeldige gegevens.", "ongeldig")
        for k, v in d.items():
            if not isinstance(v, (int, float, str)):
                raise Fout(400, "Het decor bevat ongeldige gegevens.", "ongeldig")
    tekst = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    if len(tekst.encode()) > MAX_BAAN:
        raise Fout(413, "Deze baan is te groot om te delen.", "te_groot")
    knikkers = data.get("knikkers") if isinstance(data.get("knikkers"), dict) else {}
    aantal = knikkers.get("aantal", 0) if isinstance(knikkers.get("aantal", 0), (int, float)) else 0
    return tekst, len(stukken), len(decor), int(aantal)


def lees_thumb(waarde):
    if not waarde:
        return None
    if not isinstance(waarde, str) or not waarde.startswith("data:image/jpeg;base64,"):
        raise Fout(400, "Ongeldige afbeelding.", "ongeldig")
    try:
        ruw = base64.b64decode(waarde.split(",", 1)[1], validate=True)
    except (binascii.Error, ValueError):
        raise Fout(400, "Ongeldige afbeelding.", "ongeldig")
    if len(ruw) > MAX_THUMB or ruw[:2] != b"\xff\xd8":
        raise Fout(400, "Ongeldige afbeelding.", "ongeldig")
    return ruw


def baan_info(rij, geliked=False):
    return {
        "id": rij["id"], "naam": rij["naam"], "maker": rij["maker"], "beschrijving": rij["beschrijving"],
        "stukken": rij["stukken"], "decor": rij["decor"], "knikkers": rij["knikkers"],
        "likes": rij["likes"], "gebruikt": rij["gebruikt"], "gemaakt": rij["gemaakt"], "bijgewerkt": rij["bijgewerkt"],
        "geliked": bool(geliked), "heeftThumb": rij["thumb_len"] is not None and rij["thumb_len"] > 0 if "thumb_len" in rij.keys() else True,
    }


# --------------------------------------------------------------------------- multiplayer (WebSocket)

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
KAMER_TEKENS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
MAX_KAMERS = 300
MAX_SPELERS = 12
WACHT_OP_TERUGKEER = 150


class Verbinding:
    def __init__(self, sock):
        self.sock = sock
        self.slot = threading.Lock()
        self.open = True
        self.rol = None
        self.kamer = None
        self.speler_id = None
        self.berichten = []

    def stuur(self, data):
        if not self.open:
            return False
        try:
            payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode()
        except (TypeError, ValueError):
            return False
        return self.stuur_frame(0x1, payload)

    def stuur_frame(self, opcode, payload):
        n = len(payload)
        if n < 126:
            kop = struct.pack("!BB", 0x80 | opcode, n)
        elif n < 65536:
            kop = struct.pack("!BBH", 0x80 | opcode, 126, n)
        else:
            kop = struct.pack("!BBQ", 0x80 | opcode, 127, n)
        try:
            with self.slot:
                self.sock.sendall(kop + payload)
            return True
        except OSError:
            self.open = False
            return False

    def sluit(self):
        if self.open:
            self.stuur_frame(0x8, b"")
        self.open = False
        try:
            self.sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass

    def te_snel(self):
        nu = time.time()
        self.berichten = [t for t in self.berichten if nu - t < 1.0]
        self.berichten.append(nu)
        return len(self.berichten) > 90


class Kamers:
    def __init__(self):
        self.slot = threading.RLock()
        self.kamers = {}

    def nieuwe_code(self):
        for _ in range(200):
            code = "".join(secrets.choice(KAMER_TEKENS) for _ in range(4))
            if code not in self.kamers:
                return code
        raise Fout(503, "Geen kamers vrij.", "vol")

    def opruimen(self):
        nu = time.time()
        with self.slot:
            for code in list(self.kamers):
                k = self.kamers[code]
                if k["host"] is None and nu - k["host_weg"] > WACHT_OP_TERUGKEER:
                    for sp in k["spelers"].values():
                        if sp["verbinding"]:
                            sp["verbinding"].stuur({"t": "kamer_weg"})
                            sp["verbinding"].sluit()
                    del self.kamers[code]
                    continue
                for sid in list(k["spelers"]):
                    sp = k["spelers"][sid]
                    if sp["verbinding"] is None and nu - sp["weg"] > WACHT_OP_TERUGKEER:
                        del k["spelers"][sid]

    # host ---------------------------------------------------------------
    def host_maak(self, v, msg):
        with self.slot:
            code = str(msg.get("code") or "").upper()
            sleutel = str(msg.get("sleutel") or "")
            k = self.kamers.get(code)
            if k and sleutel and secrets.compare_digest(k["sleutel_hash"], sha(sleutel)):
                if k["host"] is not None and k["host"] is not v:
                    k["host"].stuur({"t": "overgenomen"})
                    k["host"].sluit()
                k["host"] = v
            else:
                if len(self.kamers) >= MAX_KAMERS:
                    raise Fout(503, "Er zijn nu te veel races tegelijk. Probeer het zo nog eens.", "vol")
                code = self.nieuwe_code()
                sleutel = secrets.token_urlsafe(18)
                k = {"code": code, "sleutel_hash": sha(sleutel), "host": v, "host_weg": 0, "spelers": {}, "volgende": 1}
                self.kamers[code] = k
            v.rol = "host"
            v.kamer = code
            v.stuur({"t": "kamer", "code": code, "sleutel": sleutel})
            for sp in k["spelers"].values():
                v.stuur({"t": "speler", "id": sp["id"], "naam": sp["naam"], "skin": sp["skin"], "verbonden": sp["verbinding"] is not None})
                if sp["verbinding"]:
                    sp["verbinding"].stuur({"t": "host_terug"})

    def host_bericht(self, v, msg):
        with self.slot:
            k = self.kamers.get(v.kamer)
            if not k or k["host"] is not v:
                return
            t = msg.get("t")
            d = msg.get("d")
            if t == "naar":
                sp = k["spelers"].get(msg.get("id"))
                if sp and sp["verbinding"] and isinstance(d, dict):
                    sp["verbinding"].stuur(d)
            elif t == "allen" and isinstance(d, dict):
                for sp in k["spelers"].values():
                    if sp["verbinding"]:
                        sp["verbinding"].stuur(d)
            elif t == "kick":
                sp = k["spelers"].pop(msg.get("id"), None)
                if sp and sp["verbinding"]:
                    sp["verbinding"].stuur({"t": "gekickt"})
                    sp["verbinding"].sluit()

    # speler -------------------------------------------------------------
    def speler_meedoen(self, v, msg):
        with self.slot:
            code = str(msg.get("code") or "").upper()[:6]
            k = self.kamers.get(code)
            if not k:
                v.stuur({"t": "fout", "code": "geen_kamer", "melding": "Deze race bestaat niet (meer). Scan de QR-code opnieuw."})
                return
            naam = schoon(msg.get("naam"), 14) or "Speler"
            skin = schoon(msg.get("skin"), 20) or "kattenoog"
            sleutel = str(msg.get("sleutel") or "")
            sp = None
            if sleutel:
                h = sha(sleutel)
                for s in k["spelers"].values():
                    if secrets.compare_digest(s["sleutel_hash"], h):
                        sp = s
                        break
            if sp is None:
                if len(k["spelers"]) >= MAX_SPELERS:
                    v.stuur({"t": "fout", "code": "vol", "melding": "Deze race zit vol."})
                    return
                sleutel = secrets.token_urlsafe(18)
                sid = "s%d" % k["volgende"]
                k["volgende"] += 1
                sp = {"id": sid, "sleutel_hash": sha(sleutel), "naam": naam, "skin": skin, "verbinding": None, "weg": 0}
                k["spelers"][sid] = sp
            else:
                if sp["verbinding"] is not None and sp["verbinding"] is not v:
                    sp["verbinding"].sluit()
                sp["naam"] = naam
                sp["skin"] = skin
            sp["verbinding"] = v
            v.rol = "speler"
            v.kamer = code
            v.speler_id = sp["id"]
            v.stuur({"t": "welkom", "id": sp["id"], "sleutel": sleutel, "naam": naam, "code": code, "host": k["host"] is not None})
            if k["host"]:
                k["host"].stuur({"t": "speler", "id": sp["id"], "naam": naam, "skin": skin, "verbonden": True})

    def speler_bericht(self, v, msg):
        with self.slot:
            k = self.kamers.get(v.kamer)
            if not k:
                return
            sp = k["spelers"].get(v.speler_id)
            if not sp or sp["verbinding"] is not v:
                return
            if msg.get("t") in ("naam", "skin"):
                if msg.get("t") == "naam":
                    sp["naam"] = schoon(msg.get("naam"), 14) or sp["naam"]
                else:
                    sp["skin"] = schoon(msg.get("skin"), 20) or sp["skin"]
                if k["host"]:
                    k["host"].stuur({"t": "speler", "id": sp["id"], "naam": sp["naam"], "skin": sp["skin"], "verbonden": True})
                return
            if k["host"]:
                k["host"].stuur({"t": "van", "id": sp["id"], "d": msg})

    def weg(self, v):
        with self.slot:
            k = self.kamers.get(v.kamer)
            if not k:
                return
            if v.rol == "host" and k["host"] is v:
                k["host"] = None
                k["host_weg"] = time.time()
                for sp in k["spelers"].values():
                    if sp["verbinding"]:
                        sp["verbinding"].stuur({"t": "host_weg"})
            elif v.rol == "speler":
                sp = k["spelers"].get(v.speler_id)
                if sp and sp["verbinding"] is v:
                    sp["verbinding"] = None
                    sp["weg"] = time.time()
                    if k["host"]:
                        k["host"].stuur({"t": "speler_weg", "id": sp["id"]})


def lees_precies(bestand, n):
    if n == 0:
        return b""
    buf = bestand.read(n)
    if not buf or len(buf) < n:
        raise ConnectionError("verbinding dicht")
    return buf


def lees_frame(sock):
    """sock is hier het gebufferde invoerbestand van de verbinding (rfile)."""
    kop = lees_precies(sock, 2)
    fin = kop[0] & 0x80
    opcode = kop[0] & 0x0F
    gemaskeerd = kop[1] & 0x80
    lengte = kop[1] & 0x7F
    if lengte == 126:
        lengte = struct.unpack("!H", lees_precies(sock, 2))[0]
    elif lengte == 127:
        lengte = struct.unpack("!Q", lees_precies(sock, 8))[0]
    if lengte > 64 * 1024:
        raise ConnectionError("te groot")
    masker = lees_precies(sock, 4) if gemaskeerd else b"\x00\x00\x00\x00"
    data = bytearray(lees_precies(sock, lengte))
    for i in range(lengte):
        data[i] ^= masker[i % 4]
    return bool(fin), opcode, bytes(data), bool(gemaskeerd)


# --------------------------------------------------------------------------- HTTP

def maak_handler(db, teller, kamers, statisch=None):
    class Handler(SimpleHTTPRequestHandler):
        server_version = "MarbleTycoon/" + VERSIE
        sys_version = ""
        protocol_version = "HTTP/1.1"

        def log_message(self, formaat, *args):
            pass

        def end_headers(self):
            if statisch and not self.path.startswith("/api/"):
                self.send_header("Cache-Control", "no-cache")
            super().end_headers()

        def client_ip(self):
            return self.headers.get("X-Real-IP") or self.client_address[0]

        def ip_hash(self):
            return sha(db.zout + self.client_ip())[:32]

        def stuur(self, status, data=None):
            lichaam = json.dumps(data if data is not None else {}, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(lichaam)))
            self.end_headers()
            self.wfile.write(lichaam)

        def lees_json(self):
            lengte = int(self.headers.get("Content-Length") or 0)
            if lengte > MAX_LICHAAM:
                raise Fout(413, "Te veel gegevens.", "te_groot")
            ruw = self.rfile.read(lengte) if lengte else b"{}"
            try:
                data = json.loads(ruw.decode("utf-8") or "{}")
            except (UnicodeDecodeError, json.JSONDecodeError):
                raise Fout(400, "Ongeldige gegevens.", "ongeldig")
            if not isinstance(data, dict):
                raise Fout(400, "Ongeldige gegevens.", "ongeldig")
            return data

        def klant(self, waarde):
            waarde = str(waarde or "").lower()
            return waarde if KLANT_PATROON.match(waarde) else ""

        # ------------------------------------------------------------------ routes

        def afhandelen(self, methode):
            delen = urlsplit(self.path)
            pad = delen.path.rstrip("/")
            self.query = {k: v[0] for k, v in parse_qs(delen.query).items()}
            self.c = db.open()
            try:
                if not pad.startswith("/api"):
                    raise Fout(404, "Niet gevonden.", "niet_gevonden")
                route = pad[4:] or "/"
                if methode == "GET" and route == "/status":
                    return self.stuur(200, {"ok": True, "versie": VERSIE})
                if route == "/banen":
                    if methode == "GET":
                        return self.r_lijst()
                    if methode == "POST":
                        return self.r_publiceer()
                m = re.match(r"^/banen/([a-z0-9]+)(/[a-z.]+)?$", route)
                if m and ID_PATROON.match(m.group(1)):
                    bid, extra = m.group(1), m.group(2) or ""
                    if extra == "" and methode == "GET":
                        return self.r_haal(bid)
                    if extra == "" and methode == "PUT":
                        return self.r_werk_bij(bid)
                    if extra == "" and methode == "DELETE":
                        return self.r_verwijder(bid)
                    if extra == "/like" and methode == "POST":
                        return self.r_like(bid)
                    if extra == "/gebruikt" and methode == "POST":
                        return self.r_gebruikt(bid)
                    if extra == "/thumb.jpg" and methode == "GET":
                        return self.r_thumb(bid)
                raise Fout(404, "Niet gevonden.", "niet_gevonden")
            except Fout as f:
                self.stuur(f.status, {"fout": f.melding, "code": f.code})
            except Exception as e:  # noqa: BLE001
                print(f"[marbletycoon] fout bij {methode} {self.path}: {e!r}", file=sys.stderr, flush=True)
                self.stuur(500, {"fout": "Er ging iets mis op de server.", "code": "server"})
            finally:
                try:
                    if self.c.in_transaction:
                        self.c.rollback()
                finally:
                    self.c.close()

        def do_GET(self):
            if self.path.split("?", 1)[0].rstrip("/") == "/ws":
                return self.websocket()
            if statisch and not self.path.startswith("/api/"):
                return super().do_GET()
            self.afhandelen("GET")

        def do_HEAD(self):
            if statisch and not self.path.startswith("/api/"):
                return super().do_HEAD()
            self.stuur(405, {"fout": "Niet toegestaan."})

        def do_POST(self):
            self.afhandelen("POST")

        def do_PUT(self):
            self.afhandelen("PUT")

        def do_DELETE(self):
            self.afhandelen("DELETE")

        # ------------------------------------------------------------------ community

        def r_lijst(self):
            q = self.query
            sort = {"nieuw": "gemaakt DESC", "populair": "likes DESC, gebruikt DESC, gemaakt DESC", "gebruikt": "gebruikt DESC, likes DESC, gemaakt DESC"}.get(q.get("sort"), "gemaakt DESC")
            try:
                offset = max(0, min(10000, int(q.get("offset", 0))))
                limiet = max(1, min(48, int(q.get("limiet", 24))))
            except ValueError:
                raise Fout(400, "Ongeldige vraag.", "ongeldig")
            where = ["verborgen = 0"]
            args = []
            zoek = schoon(q.get("q", ""), 40)
            if zoek:
                patroon = "%" + zoek.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
                where.append("(naam LIKE ? ESCAPE '\\' OR maker LIKE ? ESCAPE '\\')")
                args += [patroon, patroon]
            ids = [i for i in q.get("ids", "").split(",") if ID_PATROON.match(i)][:50]
            if q.get("ids") is not None and "ids" in q:
                if not ids:
                    return self.stuur(200, {"banen": [], "meer": False})
                where.append("id IN (%s)" % ",".join("?" * len(ids)))
                args += ids
            rijen = self.c.execute(
                f"SELECT id, naam, maker, beschrijving, stukken, decor, knikkers, likes, gebruikt, gemaakt, bijgewerkt, length(thumb) AS thumb_len "
                f"FROM banen WHERE {' AND '.join(where)} ORDER BY {sort} LIMIT ? OFFSET ?",
                (*args, limiet + 1, offset),
            ).fetchall()
            klant = self.klant(q.get("klant"))
            geliked = set()
            if klant and rijen:
                lijst = [r["id"] for r in rijen]
                geliked = {r[0] for r in self.c.execute(
                    "SELECT baan_id FROM likes WHERE klant = ? AND baan_id IN (%s)" % ",".join("?" * len(lijst)), (sha(klant), *lijst))}
            uit = [baan_info(r, r["id"] in geliked) for r in rijen[:limiet]]
            self.stuur(200, {"banen": uit, "meer": len(rijen) > limiet})

        def r_haal(self, bid):
            r = self.c.execute(
                "SELECT id, naam, maker, beschrijving, data, stukken, decor, knikkers, likes, gebruikt, gemaakt, bijgewerkt, length(thumb) AS thumb_len "
                "FROM banen WHERE id = ? AND verborgen = 0", (bid,)).fetchone()
            if not r:
                raise Fout(404, "Deze baan bestaat niet (meer).", "niet_gevonden")
            klant = self.klant(self.query.get("klant"))
            geliked = bool(klant) and self.c.execute("SELECT 1 FROM likes WHERE baan_id = ? AND klant = ?", (bid, sha(klant))).fetchone() is not None
            info = baan_info(r, geliked)
            info["data"] = json.loads(r["data"])
            self.stuur(200, {"baan": info})

        def r_publiceer(self):
            if not teller.mag("pub:" + self.client_ip(), PUBLICATIES_PER_UUR, 3600):
                raise Fout(429, "Je hebt het afgelopen uur al veel banen gedeeld. Probeer het later nog eens.", "te_veel")
            data = self.lees_json()
            naam = schoon(data.get("naam"), 40)
            if len(naam) < 2:
                raise Fout(400, "Geef je baan een naam van minstens 2 tekens.", "naam")
            maker = schoon(data.get("maker"), 24)
            beschrijving = schoon(data.get("beschrijving"), 300)
            tekst, n_stukken, n_decor, n_knikkers = controleer_baan(data.get("data"))
            thumb = lees_thumb(data.get("thumb"))
            sleutel = secrets.token_urlsafe(24)
            for _ in range(10):
                bid = "".join(secrets.choice(ID_TEKENS) for _ in range(8))
                try:
                    self.c.execute(
                        "INSERT INTO banen (id, naam, maker, beschrijving, data, thumb, stukken, decor, knikkers, sleutel_hash, ip_hash, gemaakt, bijgewerkt) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (bid, naam, maker, beschrijving, tekst, thumb, n_stukken, n_decor, n_knikkers, sha(sleutel), self.ip_hash(), nu_tekst(), nu_tekst()),
                    )
                    self.c.commit()
                    return self.stuur(200, {"id": bid, "sleutel": sleutel})
                except sqlite3.IntegrityError:
                    continue
            raise Fout(500, "Kon geen nieuwe code maken.", "server")

        def eigenaar(self, bid):
            sleutel = self.headers.get("X-Baan-Sleutel", "")
            r = self.c.execute("SELECT sleutel_hash FROM banen WHERE id = ?", (bid,)).fetchone()
            if not r:
                raise Fout(404, "Deze baan bestaat niet (meer).", "niet_gevonden")
            if not sleutel or not secrets.compare_digest(r["sleutel_hash"], sha(sleutel)):
                raise Fout(403, "Alleen de maker kan deze baan aanpassen.", "geen_toegang")

        def r_werk_bij(self, bid):
            self.eigenaar(bid)
            data = self.lees_json()
            velden, args = [], []
            if "naam" in data:
                naam = schoon(data.get("naam"), 40)
                if len(naam) < 2:
                    raise Fout(400, "Geef je baan een naam van minstens 2 tekens.", "naam")
                velden.append("naam = ?"); args.append(naam)
            if "beschrijving" in data:
                velden.append("beschrijving = ?"); args.append(schoon(data.get("beschrijving"), 300))
            if "maker" in data:
                velden.append("maker = ?"); args.append(schoon(data.get("maker"), 24))
            if "data" in data:
                tekst, n_stukken, n_decor, n_knikkers = controleer_baan(data.get("data"))
                velden += ["data = ?", "stukken = ?", "decor = ?", "knikkers = ?"]
                args += [tekst, n_stukken, n_decor, n_knikkers]
            if "thumb" in data:
                velden.append("thumb = ?"); args.append(lees_thumb(data.get("thumb")))
            if velden:
                velden.append("bijgewerkt = ?"); args.append(nu_tekst())
                self.c.execute(f"UPDATE banen SET {', '.join(velden)} WHERE id = ?", (*args, bid))
                self.c.commit()
            self.stuur(200, {"ok": True})

        def r_verwijder(self, bid):
            self.eigenaar(bid)
            self.c.execute("DELETE FROM banen WHERE id = ?", (bid,))
            self.c.commit()
            self.stuur(200, {"ok": True})

        def r_like(self, bid):
            if not teller.mag("like:" + self.client_ip(), LIKES_PER_UUR, 3600):
                raise Fout(429, "Even rustig aan met liken.", "te_veel")
            klant = self.klant(self.lees_json().get("klant"))
            if not klant:
                raise Fout(400, "Ongeldige gegevens.", "ongeldig")
            if not self.c.execute("SELECT 1 FROM banen WHERE id = ?", (bid,)).fetchone():
                raise Fout(404, "Deze baan bestaat niet (meer).", "niet_gevonden")
            h = sha(klant)
            if self.c.execute("SELECT 1 FROM likes WHERE baan_id = ? AND klant = ?", (bid, h)).fetchone():
                self.c.execute("DELETE FROM likes WHERE baan_id = ? AND klant = ?", (bid, h))
                self.c.execute("UPDATE banen SET likes = MAX(0, likes - 1) WHERE id = ?", (bid,))
                geliked = False
            else:
                self.c.execute("INSERT INTO likes (baan_id, klant) VALUES (?, ?)", (bid, h))
                self.c.execute("UPDATE banen SET likes = likes + 1 WHERE id = ?", (bid,))
                geliked = True
            self.c.commit()
            likes = self.c.execute("SELECT likes FROM banen WHERE id = ?", (bid,)).fetchone()["likes"]
            self.stuur(200, {"likes": likes, "geliked": geliked})

        def r_gebruikt(self, bid):
            if not teller.mag("gebruik:" + self.client_ip(), GEBRUIK_PER_UUR, 3600):
                return self.stuur(200, {"ok": True})
            klant = self.klant(self.lees_json().get("klant"))
            if not klant:
                raise Fout(400, "Ongeldige gegevens.", "ongeldig")
            try:
                self.c.execute("INSERT INTO gebruik (baan_id, klant) VALUES (?, ?)", (bid, sha(klant)))
                self.c.execute("UPDATE banen SET gebruikt = gebruikt + 1 WHERE id = ?", (bid,))
                self.c.commit()
            except sqlite3.IntegrityError:
                pass
            r = self.c.execute("SELECT gebruikt FROM banen WHERE id = ?", (bid,)).fetchone()
            self.stuur(200, {"gebruikt": r["gebruikt"] if r else 0})

        def r_thumb(self, bid):
            r = self.c.execute("SELECT thumb FROM banen WHERE id = ? AND verborgen = 0", (bid,)).fetchone()
            if not r or not r["thumb"]:
                raise Fout(404, "Geen afbeelding.", "niet_gevonden")
            ruw = bytes(r["thumb"])
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(ruw)))
            self.send_header("Cache-Control", "public, max-age=86400")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(ruw)

        # ------------------------------------------------------------------ websocket

        def websocket(self):
            sleutel = self.headers.get("Sec-WebSocket-Key", "")
            if self.headers.get("Upgrade", "").lower() != "websocket" or not sleutel:
                self.stuur(400, {"fout": "Alleen voor WebSocket."})
                return
            antwoord = base64.b64encode(hashlib.sha1((sleutel + WS_GUID).encode()).digest()).decode()
            self.send_response(101, "Switching Protocols")
            self.send_header("Upgrade", "websocket")
            self.send_header("Connection", "Upgrade")
            self.send_header("Sec-WebSocket-Accept", antwoord)
            self.end_headers()
            self.wfile.flush()
            sock = self.connection
            sock.settimeout(35)
            v = Verbinding(sock)
            fragment = b""
            laatste_ping = time.time()
            try:
                while v.open:
                    try:
                        fin, opcode, data, gemaskeerd = lees_frame(self.rfile)
                    except (socket.timeout, TimeoutError):
                        if time.time() - laatste_ping > 90:
                            break
                        v.stuur_frame(0x9, b"mt")
                        continue
                    laatste_ping = time.time()
                    if not gemaskeerd:
                        break
                    if opcode == 0x8:
                        break
                    if opcode == 0x9:
                        v.stuur_frame(0xA, data)
                        continue
                    if opcode == 0xA:
                        continue
                    if opcode in (0x1, 0x0):
                        fragment += data
                        if len(fragment) > 16 * 1024:
                            break
                        if not fin:
                            continue
                        tekst, fragment = fragment, b""
                        if v.te_snel():
                            continue
                        try:
                            msg = json.loads(tekst.decode("utf-8"))
                        except (UnicodeDecodeError, json.JSONDecodeError):
                            continue
                        if not isinstance(msg, dict):
                            continue
                        self.ws_bericht(v, msg)
            except (ConnectionError, OSError):
                pass
            finally:
                kamers.weg(v)
                v.sluit()
                self.close_connection = True

        def ws_bericht(self, v, msg):
            t = msg.get("t")
            try:
                if v.rol is None:
                    if t == "maak":
                        kamers.host_maak(v, msg)
                    elif t == "meedoen":
                        kamers.speler_meedoen(v, msg)
                    elif t == "ping":
                        v.stuur({"t": "pong"})
                    return
                if t == "ping":
                    v.stuur({"t": "pong", "tijd": msg.get("tijd")})
                    return
                if v.rol == "host":
                    kamers.host_bericht(v, msg)
                else:
                    kamers.speler_bericht(v, msg)
            except Fout as f:
                v.stuur({"t": "fout", "code": f.code, "melding": f.melding})

    return Handler


def serveer(args):
    db = Database(args.db)
    teller = Teller()
    kamers = Kamers()
    handler = maak_handler(db, teller, kamers, args.statisch)
    if args.statisch:
        handler = partial(handler, directory=os.path.abspath(args.statisch))

    def onderhoud():
        while True:
            time.sleep(15)
            try:
                kamers.opruimen()
            except Exception as e:  # noqa: BLE001
                print(f"[marbletycoon] opruimen: {e!r}", file=sys.stderr, flush=True)

    threading.Thread(target=onderhoud, daemon=True).start()
    server = ThreadingHTTPServer((args.adres, args.poort), handler)
    server.daemon_threads = True
    print(f"[marbletycoon] luistert op http://{args.adres}:{args.poort} (database: {args.db})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


def backup(args):
    os.makedirs(args.map, exist_ok=True)
    doel = os.path.join(args.map, f"banen-{datetime.date.today().isoformat()}.db")
    bron = sqlite3.connect(args.db)
    kopie = sqlite3.connect(doel)
    with kopie:
        bron.backup(kopie)
    kopie.close()
    bron.close()
    os.chmod(doel, 0o600)
    bestanden = sorted(f for f in os.listdir(args.map) if f.startswith("banen-") and f.endswith(".db"))
    for oud in bestanden[: -args.bewaar]:
        os.remove(os.path.join(args.map, oud))
    print(f"[marbletycoon] backup gemaakt: {doel}")


def lijst(args):
    c = Database(args.db).open()
    for r in c.execute("SELECT id, naam, maker, stukken, likes, gebruikt, gemaakt, verborgen FROM banen ORDER BY gemaakt DESC LIMIT ?", (args.aantal,)):
        verborgen = " (verborgen)" if r["verborgen"] else ""
        print(f"{r['id']}  {r['gemaakt'][:16]}  {r['stukken']:4d} stukken  {r['likes']:3d}♥  {r['gebruikt']:3d}x  {r['naam']} — {r['maker']}{verborgen}")


def verwijder(args):
    c = Database(args.db).open()
    n = c.execute("DELETE FROM banen WHERE id = ?", (args.id,)).rowcount
    c.commit()
    print("Verwijderd." if n else "Niet gevonden.")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="opdracht", required=True)
    s = sub.add_parser("serveer")
    s.add_argument("--db", required=True)
    s.add_argument("--adres", default="127.0.0.1")
    s.add_argument("--poort", type=int, default=8790)
    s.add_argument("--statisch", default=None, help="map met de spelbestanden (alleen voor lokaal testen)")
    b = sub.add_parser("backup")
    b.add_argument("--db", required=True)
    b.add_argument("--map", required=True)
    b.add_argument("--bewaar", type=int, default=14)
    l = sub.add_parser("lijst")
    l.add_argument("--db", required=True)
    l.add_argument("--aantal", type=int, default=50)
    v = sub.add_parser("verwijder")
    v.add_argument("--db", required=True)
    v.add_argument("--id", required=True)
    args = p.parse_args()
    {"serveer": serveer, "backup": backup, "lijst": lijst, "verwijder": verwijder}[args.opdracht](args)


if __name__ == "__main__":
    main()
