// Het baanmodel: startpunt, stukken (met vaste plek op het raster), decor en knikkerinstellingen.
// Zoals in RollerCoaster Tycoon heeft elk stuk een eigen plek. Haal je een stuk weg, dan ontstaat er een gat.

import { TEGEL, NIVEAU, RASTER, MAX_NIVEAU, MIN_START, STANDAARD_KLEUR, STANDAARD_STEUN, EFFECT_STANDAARD } from './config.js';
import { SOORTEN, uitgang, ruimte, vakSleutel, koers, draaiKwart, hellingMag, magOpBasis } from './stukken.js';

export const VERSIE = 1;

export function aansluitSleutel(c) {
  return `${c.x},${c.z},${c.d},${c.l}`;
}

export function nieuweBaan() {
  return {
    naam: 'Mijn knikkerbaan',
    maker: '',
    gebaseerdOp: null,
    start: null,
    stukken: [],
    decor: [],
    knikkers: { aantal: 12, skins: ['kattenoog', 'vuuroog', 'regenboog'], interval: 0.9, rondgaan: true, uitDeBocht: false },
  };
}

let volgendId = 1;
export function nieuwId() { return volgendId++; }

// Het startpunt als stuk: een korte goot in de starttegel, van de achterrand naar de voorrand.
export function startStuk(start) {
  if (!start) return null;
  const [hx, hz] = koers(start.d);
  const mx = (start.x + 0.5) * TEGEL, mz = (start.z + 0.5) * TEGEL;
  return {
    id: 'start', t: 'start', lr: '', d: start.d,
    x: Math.round(mx - hx * TEGEL / 2), z: Math.round(mz - hz * TEGEL / 2),
    l: start.h + 1, e: 0, s: 0, c: start.c, sc: start.sc,
  };
}

// Ruimte van de starttoren (de hele kolom van de tegel).
function startVakken(start) {
  const set = new Set();
  for (let l = -2; l <= start.h + 4; l++) set.add(vakSleutel(start.x, start.z, l));
  return set;
}

// Alles wat uit de stukken volgt: aansluitingen, ketens, open einden, bezette ruimte.
export function analyseer(baan) {
  const ingangen = new Map();
  const uitgangen = new Map();
  const bezet = new Map();
  const st0 = startStuk(baan.start);
  if (st0) for (const v of startVakken(baan.start)) bezet.set(v, 'start');
  for (const st of baan.stukken) {
    ingangen.set(aansluitSleutel(st), st);
    const u = uitgang(st);
    st._uit = u;
    if (!SOORTEN[st.t].einde) uitgangen.set(aansluitSleutel(u), st);
    for (const v of ruimte(st).vakken) if (!bezet.has(v)) bezet.set(v, st.id);
  }
  const volgende = (st) => {
    const u = st === st0 ? uitgang(st0) : st._uit;
    if (SOORTEN[st.t].einde) return null;
    const n = ingangen.get(aansluitSleutel(u));
    return n && n.e === u.e ? n : null;
  };
  // Ketens: aaneengesloten stukken. De eerste keten begint bij het startpunt.
  const ketens = [];
  const bezocht = new Set();
  if (st0) {
    const k = [st0];
    let cur = volgende(st0);
    while (cur && !bezocht.has(cur.id)) { bezocht.add(cur.id); k.push(cur); cur = volgende(cur); }
    ketens.push({ stukken: k, rond: !!cur, start: true });
  }
  const heeftVoorganger = new Set();
  for (const st of baan.stukken) { const n = volgende(st); if (n) heeftVoorganger.add(n.id); }
  if (st0) { const n = volgende(st0); if (n) heeftVoorganger.add(n.id); }
  const loop = (begin) => {
    const k = [];
    let cur = begin;
    while (cur && !bezocht.has(cur.id)) { bezocht.add(cur.id); k.push(cur); cur = volgende(cur); }
    if (k.length) ketens.push({ stukken: k, rond: !!cur && cur === begin, start: false });
  };
  for (const st of baan.stukken) if (!heeftVoorganger.has(st.id) && !bezocht.has(st.id)) loop(st);
  for (const st of baan.stukken) if (!bezocht.has(st.id)) loop(st);

  // Open einden: uitgangen waar nog niets op aansluit.
  const open = [];
  const kandidaten = st0 ? [st0, ...baan.stukken] : [...baan.stukken];
  for (const st of kandidaten) {
    if (SOORTEN[st.t].einde) continue;
    const u = st === st0 ? uitgang(st0) : st._uit;
    const n = ingangen.get(aansluitSleutel(u));
    if (!n) open.push({ ...u, van: st.id });
  }
  return { ingangen, uitgangen, bezet, ketens, open, st0 };
}

// Mag dit stuk hier gebouwd worden? Geeft { ok, reden, botsing }.
export function controleer(baan, info, st) {
  const def = SOORTEN[st.t];
  if (!def) return { ok: false, reden: 'Onbekend stuk' };
  if (!magOpBasis(st.t, st.d % 2)) return { ok: false, reden: 'Dit stuk kan niet op een diagonaal' };
  if (!hellingMag(st.t, st.e, st.s)) {
    if (def.vast) return { ok: false, reden: 'Dit stuk kan alleen op een vlak stuk aansluiten' };
    return { ok: false, reden: 'Die helling past hier niet. Ga eerst via een lichte helling' };
  }
  if (info.ingangen.has(aansluitSleutel(st))) return { ok: false, reden: 'Hier begint al een stuk' };
  const r = ruimte(st);
  if (r.buiten) return { ok: false, reden: 'Buiten het bouwterrein' };
  if (r.teLaag) return { ok: false, reden: 'Te laag: de baan gaat de grond in' };
  if (r.teHoog) return { ok: false, reden: 'Te hoog' };
  for (const v of r.vakken) {
    const wie = info.bezet.get(v);
    if (wie !== undefined && wie !== st.id) return { ok: false, reden: 'Botst met een ander stuk', botsing: wie };
  }
  return { ok: true };
}

// Maak een stukrecord op een aansluiting.
export function maakStuk(aansl, keuze, kleur, steun) {
  const st = {
    id: nieuwId(),
    t: keuze.t,
    lr: SOORTEN[keuze.t].bocht ? keuze.lr || 'R' : '',
    x: aansl.x, z: aansl.z, d: aansl.d, l: aansl.l, e: aansl.e,
    s: SOORTEN[keuze.t].vast ? 0 : keuze.s,
    c: kleur || STANDAARD_KLEUR,
    sc: steun || STANDAARD_STEUN,
  };
  if (SOORTEN[keuze.t].spiraal) st.dh = keuze.s > 0 ? 1 : -1;
  if (keuze.k === false) st.k = false;
  if (keuze.fx && !SOORTEN[keuze.t].vast || (keuze.fx && SOORTEN[keuze.t].spiraal)) {
    st.fx = keuze.fx;
    st.v = keuze.v ?? EFFECT_STANDAARD[keuze.fx];
  }
  if (keuze.t === 'launch') st.v = keuze.lv ?? EFFECT_STANDAARD.launch;
  return st;
}

// ------------------------------------------------------------------ hele baan verplaatsen / draaien

function transformeer(baan, f) {
  const kopie = JSON.parse(JSON.stringify(baan));
  if (kopie.start) {
    const ns = f.start(kopie.start);
    kopie.start = ns;
  }
  kopie.stukken = kopie.stukken.map((st, i) => ({ ...f.stuk(st), id: baan.stukken[i].id }));
  return kopie;
}

export function verschuif(baan, dx, dz, dl) {
  return transformeer(baan, {
    start: (s) => ({ ...s, x: s.x + dx, z: s.z + dz, h: s.h + dl }),
    stuk: (st) => ({ ...st, x: st.x + dx * TEGEL, z: st.z + dz * TEGEL, l: st.l + dl }),
  });
}

// Draai alles een kwartslag om het midden van de starttegel.
export function draaiBaan(baan, richting = 1) {
  if (!baan.start) return baan;
  const cx = (baan.start.x + 0.5) * TEGEL, cz = (baan.start.z + 0.5) * TEGEL;
  const k = richting > 0 ? 1 : 3;
  const punt = (x, z) => { const [a, b] = draaiKwart(x - cx, z - cz, k); return [Math.round(cx + a), Math.round(cz + b)]; };
  return transformeer(baan, {
    start: (s) => {
      // de tegel draait om zijn eigen midden, dus blijft staan
      return { ...s, d: (s.d + 2 * k) % 8 };
    },
    stuk: (st) => { const [x, z] = punt(st.x, st.z); return { ...st, x, z, d: (st.d + 2 * k) % 8 }; },
  });
}

// Controleer een hele baan (na verplaatsen, draaien of laden).
export function heleBaanGeldig(baan) {
  if (baan.start) {
    const s = baan.start;
    if (s.x < -RASTER || s.x >= RASTER || s.z < -RASTER || s.z >= RASTER) return { ok: false, reden: 'Het startpunt valt buiten het terrein' };
    if (s.h < MIN_START || s.h > MAX_NIVEAU) return { ok: false, reden: 'Het startpunt is te laag of te hoog' };
  }
  const bezet = new Map();
  if (baan.start) for (const v of startVakken(baan.start)) bezet.set(v, 'start');
  for (const st of baan.stukken) {
    const r = ruimte(st);
    if (r.buiten) return { ok: false, reden: 'Een deel van de baan valt buiten het terrein', stuk: st.id };
    if (r.teLaag) return { ok: false, reden: 'Een deel van de baan gaat de grond in', stuk: st.id };
    if (r.teHoog) return { ok: false, reden: 'Een deel van de baan is te hoog', stuk: st.id };
    for (const v of r.vakken) {
      const wie = bezet.get(v);
      if (wie !== undefined) return { ok: false, reden: 'Stukken botsen', stuk: st.id };
    }
    for (const v of r.vakken) bezet.set(v, st.id);
  }
  return { ok: true };
}

// ------------------------------------------------------------------ opslaan / laden

const KLEUR_RE = /^#[0-9a-f]{6}$/i;
const SOORT_IDS = new Set(Object.keys(SOORTEN));

export function naarJSON(baan) {
  return {
    v: VERSIE,
    naam: baan.naam,
    maker: baan.maker || '',
    gebaseerdOp: baan.gebaseerdOp || null,
    gedeeldId: baan.gedeeldId || undefined,
    start: baan.start ? { x: baan.start.x, z: baan.start.z, d: baan.start.d, h: baan.start.h, c: baan.start.c, sc: baan.start.sc } : null,
    stukken: baan.stukken.map((st) => {
      const o = { t: st.t, x: st.x, z: st.z, d: st.d, l: st.l, e: st.e, s: st.s, c: st.c, sc: st.sc };
      if (st.lr) o.lr = st.lr;
      if (st.dh) o.dh = st.dh;
      if (st.k === false) o.k = 0;
      if (st.fx) o.fx = st.fx;
      if (st.v !== undefined) o.v = Math.round(st.v * 10) / 10;
      return o;
    }),
    decor: baan.decor.map((d) => ({ i: d.i, x: r2(d.x), z: r2(d.z), y: r2(d.y || 0), r: r2(d.r || 0), s: r2(d.s || 1) })),
    knikkers: { ...baan.knikkers },
  };
}
const r2 = (v) => Math.round(v * 100) / 100;

const int = (v, min, max, std) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std;
};
const getal = (v, min, max, std) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std;
};
const kleur = (v, std) => (typeof v === 'string' && KLEUR_RE.test(v) ? v.toLowerCase() : std);
const tekst = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '');

// Leest een baan in en zet alles wat vreemd is recht (ook voor banen uit de community).
export function vanJSON(data, decorIds) {
  if (!data || typeof data !== 'object') throw new Error('Geen geldige baan');
  const baan = nieuweBaan();
  baan.naam = tekst(data.naam, 40) || 'Naamloze baan';
  baan.maker = tekst(data.maker, 24);
  if (typeof data.gedeeldId === 'string' && /^[a-z0-9]{6,12}$/.test(data.gedeeldId)) baan.gedeeldId = data.gedeeldId;
  if (data.gebaseerdOp && typeof data.gebaseerdOp === 'object') {
    baan.gebaseerdOp = { naam: tekst(data.gebaseerdOp.naam, 40), maker: tekst(data.gebaseerdOp.maker, 24), id: tekst(data.gebaseerdOp.id, 16) };
  }
  if (data.start && typeof data.start === 'object') {
    const s = data.start;
    baan.start = {
      x: int(s.x, -RASTER, RASTER - 1, 0), z: int(s.z, -RASTER, RASTER - 1, 0),
      d: (int(s.d, 0, 7, 0) >> 1) << 1, h: int(s.h, MIN_START, MAX_NIVEAU, 12),
      c: kleur(s.c, STANDAARD_KLEUR), sc: kleur(s.sc, STANDAARD_STEUN),
    };
  }
  const lijst = Array.isArray(data.stukken) ? data.stukken.slice(0, 2000) : [];
  for (const o of lijst) {
    if (!o || typeof o !== 'object' || !SOORT_IDS.has(o.t) || o.t === 'start') continue;
    const def = SOORTEN[o.t];
    const st = {
      id: nieuwId(), t: o.t,
      lr: def.bocht ? (o.lr === 'L' ? 'L' : 'R') : '',
      x: int(o.x, -RASTER * TEGEL - 20, RASTER * TEGEL + 20, 0),
      z: int(o.z, -RASTER * TEGEL - 20, RASTER * TEGEL + 20, 0),
      d: int(o.d, 0, 7, 0), l: int(o.l, -4, MAX_NIVEAU + 20, 2),
      e: int(o.e, -2, 2, 0), s: int(o.s, -2, 2, 0),
      c: kleur(o.c, STANDAARD_KLEUR), sc: kleur(o.sc, STANDAARD_STEUN),
    };
    if (def.vast) { st.e = 0; st.s = 0; }
    if (def.spiraal) st.dh = Number(o.dh) > 0 ? 1 : -1;
    if (o.k === 0 || o.k === false) st.k = false;
    if (typeof o.fx === 'string' && ['lift', 'boost', 'rem', 'vuur'].includes(o.fx)) st.fx = o.fx;
    if (o.v !== undefined) st.v = getal(o.v, 1, 150, 20);
    if (o.t === 'launch' && st.v === undefined) st.v = EFFECT_STANDAARD.launch;
    if (st.fx && st.v === undefined) st.v = EFFECT_STANDAARD[st.fx] ?? 10;
    baan.stukken.push(st);
  }
  const decor = Array.isArray(data.decor) ? data.decor.slice(0, 5000) : [];
  for (const d of decor) {
    if (!d || typeof d !== 'object' || typeof d.i !== 'string') continue;
    if (decorIds && !decorIds.has(d.i)) continue;
    baan.decor.push({
      id: nieuwId(), i: d.i,
      x: getal(d.x, -RASTER * TEGEL - 10, RASTER * TEGEL + 10, 0),
      z: getal(d.z, -RASTER * TEGEL - 10, RASTER * TEGEL + 10, 0),
      y: getal(d.y, -2, 40, 0), r: getal(d.r, -100, 100, 0), s: getal(d.s, 0.25, 4, 1),
    });
  }
  const k = data.knikkers && typeof data.knikkers === 'object' ? data.knikkers : {};
  baan.knikkers = {
    aantal: int(k.aantal, 1, 60, 12),
    skins: Array.isArray(k.skins) ? k.skins.filter((s) => typeof s === 'string').slice(0, 40) : ['kattenoog'],
    interval: getal(k.interval, 0.2, 5, 0.9),
    rondgaan: k.rondgaan !== false,
    uitDeBocht: k.uitDeBocht === true,
  };
  if (!baan.knikkers.skins.length) baan.knikkers.skins = ['kattenoog'];
  return baan;
}

export function hoogteMeters(l) { return l * NIVEAU; }
