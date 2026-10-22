#!/usr/bin/env bash
# =============================================================================
#  Installer voor Marble Tycoon op een Ubuntu-server
# =============================================================================
#
#  Eén commando (als root of met sudo):
#
#    curl -fsSL https://raw.githubusercontent.com/Rudyh0/MarbleTycoon/main/install.sh | sudo bash
#
#  Wat hij doet:
#    - installeert nginx, git, UFW, Python 3 en (zonder Cloudflare) certbot, allemaal uit Ubuntu zelf
#    - haalt de game op van GitHub en zet hem in /var/www/marble-tycoon
#    - start de server voor de community en de multiplayer-races (alleen op 127.0.0.1)
#    - laat de game alleen draaien op het domein dat je opgeeft
#    - HTTPS: via Let's Encrypt, of met een eigen certificaat achter Cloudflare
#    - haalt (als je wilt) elke 10 minuten zelf nieuwe versies op van GitHub
#
#  Samen met "... en de Duitse streken" op één server:
#    - alle namen beginnen met marble-tycoon (mappen, diensten, nginx-bestanden, gebruiker)
#    - een eigen poort voor de server (nooit die van de Duitse streken)
#    - geen "standaardsite" in nginx: het vangnet van de Duitse streken blijft de baas
#    - de bestanden van de Duitse streken worden niet aangeraakt
#    - een ander domein is verplicht; de installer controleert dat
#
#  Nog een keer draaien = bijwerken. Je instellingen blijven bewaard.
#
#  Opties (allemaal optioneel; zonder opties stelt de installer vragen):
#    --domein NAAM        domeinnaam, bijv. marble.rudymedia.nl
#    --cloudflare ja|nee  loopt het domein via Cloudflare met de proxy aan?
#    --email ADRES        e-mailadres voor Let's Encrypt (mag leeg)
#    --autoupdate ja|nee  automatisch nieuwe versies van GitHub ophalen
#    --branch NAAM        GitHub-branch (standaard: main)
#    --ja                 geen vragen stellen, standaardwaarden gebruiken
#    --verwijder          de game en zijn instellingen weer verwijderen
#                         (met --ja zonder vragen; de gedeelde banen blijven dan staan)
# =============================================================================

set -euo pipefail

REPO_URL="https://github.com/Rudyh0/MarbleTycoon.git"
STANDAARD_DOMEIN="marble.rudymedia.nl"
NAAM="marble-tycoon"
CONFIG_DIR="/etc/$NAAM"
CONFIG="$CONFIG_DIR/config"
BRON_DIR="/opt/$NAAM/bron"
WEB_DIR="/var/www/$NAAM"
ACME_DIR="/var/www/$NAAM-acme"
SSL_DIR="/etc/nginx/$NAAM-ssl"
NGINX_SITE="/etc/nginx/sites-available/$NAAM"
UPDATE_BIN="/usr/local/bin/$NAAM-update"
DIENST_DIR="/opt/$NAAM/dienst"
DATA_DIR="/var/lib/$NAAM"
BACKUP_DIR="/var/backups/$NAAM"
DIENST_GEBRUIKER="$NAAM"
EERSTE_POORT=8790
ANDERE_CONFIG="/etc/duitse-streken/config"   # de andere game op deze server (alleen lezen)

# ------------------------------------------------------------------ uiterlijk

if [ -t 1 ]; then
  BOLD=$'\e[1m'; DIM=$'\e[2m'; GROEN=$'\e[32m'; GEEL=$'\e[33m'; ROOD=$'\e[31m'; BLAUW=$'\e[34m'; RESET=$'\e[0m'
else
  BOLD=""; DIM=""; GROEN=""; GEEL=""; ROOD=""; BLAUW=""; RESET=""
fi

stap() { echo; echo "${BOLD}${BLAUW}==>${RESET} ${BOLD}$*${RESET}"; }
ok()   { echo "  ${GROEN}✓${RESET} $*"; }
info() { echo "  ${DIM}•${RESET} $*"; }
let_op() { echo "  ${GEEL}!${RESET} $*"; }
fout() { echo; echo "${ROOD}${BOLD}Fout:${RESET} $*" >&2; exit 1; }

HEEFT_TTY=0
if [ -r /dev/tty ] && { : < /dev/tty; } 2>/dev/null; then HEEFT_TTY=1; fi

vraag() {
  local tekst="$1" standaard="${2:-}" antwoord=""
  if [ "$ALLES_JA" = 1 ] || [ "$HEEFT_TTY" = 0 ]; then
    printf '%s' "$standaard"
    return
  fi
  if [ -n "$standaard" ]; then
    printf '  %s %s[%s]%s: ' "$tekst" "$DIM" "$standaard" "$RESET" > /dev/tty
  else
    printf '  %s: ' "$tekst" > /dev/tty
  fi
  IFS= read -r antwoord < /dev/tty || true
  printf '%s' "${antwoord:-$standaard}"
}

ja_nee() {
  local a
  a="$(vraag "$1 (j/n)" "$2")"
  case "$a" in j|J|ja|Ja|JA|y|Y|yes) return 0 ;; *) return 1 ;; esac
}

normaliseer_jn() {
  case "${1:-}" in j|J|ja|Ja|JA|y|Y|yes|true|1) echo "ja" ;; n|N|nee|Nee|NEE|no|false|0) echo "nee" ;; *) echo "" ;; esac
}

# ------------------------------------------------------------------ opties

DOMEIN=""; CLOUDFLARE=""; EMAIL=""; EMAIL_GEZET=0; AUTOUPDATE=""; BRANCH=""; ALLES_JA=0; VERWIJDER=0

while [ $# -gt 0 ]; do
  case "$1" in
    --domein|--domain) DOMEIN="${2:-}"; shift ;;
    --cloudflare) CLOUDFLARE="$(normaliseer_jn "${2:-}")"; shift ;;
    --email) EMAIL="${2:-}"; EMAIL_GEZET=1; shift ;;
    --autoupdate) AUTOUPDATE="$(normaliseer_jn "${2:-}")"; shift ;;
    --branch) BRANCH="${2:-}"; shift ;;
    --ja|--yes|-y) ALLES_JA=1 ;;
    --verwijder|--uninstall) VERWIJDER=1 ;;
    -h|--help) sed -n '2,37p' "$0" 2>/dev/null || true; exit 0 ;;
    *) fout "Onbekende optie: $1 (zie --help)" ;;
  esac
  shift
done

# ------------------------------------------------------------------ controles

[ "$(id -u)" = 0 ] || fout "Draai de installer als root, bijvoorbeeld met: curl -fsSL ... | sudo bash"

if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
fi
if [ "${ID:-}" != "ubuntu" ] && [ "${ID_LIKE:-}" != "debian" ] && [ "${ID:-}" != "debian" ]; then
  fout "Deze installer is gemaakt voor Ubuntu (gevonden: ${PRETTY_NAME:-onbekend})."
fi
if [ "${ID:-}" = "ubuntu" ]; then
  case "${VERSION_ID:-}" in
    22.04|24.04|24.10|25.04|25.10|26.04) ;;
    *) let_op "Getest voor Ubuntu 22.04 en 24.04; jij hebt ${PRETTY_NAME:-onbekend}. Het kan werken, maar zonder garantie." ;;
  esac
fi
command -v apt-get >/dev/null 2>&1 || fout "apt-get niet gevonden."

echo "${BOLD}Installer: Marble Tycoon${RESET} ${DIM}(${PRETTY_NAME:-Linux})${RESET}"

# Wat weten we van de andere game op deze server? (alleen lezen, nooit wijzigen)
ANDER_DOMEIN=""; ANDER_POORT=""
if [ -r "$ANDERE_CONFIG" ]; then
  ANDER_DOMEIN="$(sed -n "s/^CFG_DOMEIN=//p" "$ANDERE_CONFIG" | head -n 1 | tr -d "'\"")"
  ANDER_POORT="$(sed -n "s/^CFG_API_POORT=//p" "$ANDERE_CONFIG" | head -n 1 | tr -d "'\"")"
  info "'... en de Duitse streken' gevonden${ANDER_DOMEIN:+ op $ANDER_DOMEIN}; die laat ik met rust."
fi

# ------------------------------------------------------------------ verwijderen

if [ "$VERWIJDER" = 1 ]; then
  stap "Marble Tycoon verwijderen"
  if [ "$ALLES_JA" = 0 ]; then
    ja_nee "Weet je het zeker? De website en de instellingen worden verwijderd" "n" || { info "Niets gedaan."; exit 0; }
  fi
  for unit in "$NAAM-update.timer" "$NAAM-backup.timer" "$NAAM-server.service"; do
    systemctl disable --now "$unit" >/dev/null 2>&1 || true
  done
  rm -f "/etc/systemd/system/$NAAM-update.timer" "/etc/systemd/system/$NAAM-update.service" "$UPDATE_BIN" \
        "/etc/systemd/system/$NAAM-backup.timer" "/etc/systemd/system/$NAAM-backup.service" \
        "/etc/systemd/system/$NAAM-server.service" "/etc/letsencrypt/renewal-hooks/deploy/$NAAM-nginx.sh"
  systemctl daemon-reload || true
  if ja_nee "Ook alle gedeelde community-banen verwijderen (inclusief back-ups)?" "n"; then
    rm -rf "$DATA_DIR" "$BACKUP_DIR"
    userdel "$DIENST_GEBRUIKER" >/dev/null 2>&1 || true
    ok "Community-banen verwijderd."
  else
    info "De community-banen blijven staan in $DATA_DIR."
  fi
  rm -f "/etc/nginx/sites-enabled/$NAAM" "$NGINX_SITE"
  if command -v nginx >/dev/null 2>&1 && nginx -t >/dev/null 2>&1; then systemctl reload nginx || true; fi
  rm -rf "$WEB_DIR" "$ACME_DIR" "/opt/$NAAM" "$SSL_DIR" "$CONFIG_DIR"
  ok "Verwijderd. nginx, UFW, de Duitse streken en eventuele Let's Encrypt-certificaten zijn blijven staan."
  exit 0
fi

# ------------------------------------------------------------------ bestaande instellingen

BESTAAND=0
if [ -f "$CONFIG" ]; then
  BESTAAND=1
  info "Er staat al een installatie. Die wordt bijgewerkt; je instellingen blijven staan."
  # shellcheck disable=SC1090
  . "$CONFIG"
  DOMEIN="${DOMEIN:-${CFG_DOMEIN:-}}"
  CLOUDFLARE="${CLOUDFLARE:-${CFG_CLOUDFLARE:-}}"
  [ "$EMAIL_GEZET" = 1 ] || EMAIL="${CFG_EMAIL:-}"
  AUTOUPDATE="${AUTOUPDATE:-${CFG_AUTOUPDATE:-}}"
  BRANCH="${BRANCH:-${CFG_BRANCH:-}}"
  API_POORT="${CFG_API_POORT:-}"
fi
BRANCH="${BRANCH:-main}"

# Ander domein voorstellen als het standaarddomein al door de andere game gebruikt wordt
if [ -n "$ANDER_DOMEIN" ] && [ "$ANDER_DOMEIN" = "$STANDAARD_DOMEIN" ]; then STANDAARD_DOMEIN="marbletycoon.${ANDER_DOMEIN#*.}"; fi

# ------------------------------------------------------------------ vragen

stap "Instellingen"

domein_in_gebruik() {
  # Geeft het nginx-bestand terug dat dit domein al gebruikt (behalve ons eigen bestand).
  local d="$1" f
  for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
    [ -e "$f" ] || continue
    [ "$(readlink -f "$f")" = "$(readlink -f "$NGINX_SITE" 2>/dev/null || echo -)" ] && continue
    if grep -Eqs "^[[:space:]]*server_name[^;]*[[:space:]]${d//./\\.}([[:space:];]|$)" "$f"; then echo "$f"; return 0; fi
  done
  return 1
}

while :; do
  if [ -z "$DOMEIN" ]; then
    DOMEIN="$(vraag "Op welk domein moet Marble Tycoon draaien? (een ander dan de Duitse streken)" "$STANDAARD_DOMEIN")"
  fi
  DOMEIN="$(printf '%s' "$DOMEIN" | tr 'A-Z' 'a-z' | sed -e 's#^https\?://##' -e 's#/.*##' -e 's/^ *//; s/ *$//')"
  PROBLEEM=""
  if ! printf '%s' "$DOMEIN" | grep -Eq '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'; then
    PROBLEEM="\"$DOMEIN\" is geen geldige domeinnaam."
  elif [ -n "$ANDER_DOMEIN" ] && [ "$DOMEIN" = "$ANDER_DOMEIN" ]; then
    PROBLEEM="$DOMEIN is al van '... en de Duitse streken'. Kies een ander (sub)domein, bijvoorbeeld marble.${DOMEIN#*.}"
  elif BEZET_DOOR="$(domein_in_gebruik "$DOMEIN")"; then
    PROBLEEM="$DOMEIN wordt al gebruikt door een andere site in nginx ($BEZET_DOOR). Kies een ander (sub)domein."
  fi
  [ -z "$PROBLEEM" ] && break
  [ "$ALLES_JA" = 0 ] && [ "$HEEFT_TTY" = 1 ] || fout "$PROBLEEM"
  let_op "$PROBLEEM"
  DOMEIN=""
done
ok "Domein: $DOMEIN"

if [ -z "$CLOUDFLARE" ]; then
  if ja_nee "Loopt $DOMEIN via Cloudflare met de proxy aan (oranje wolkje)?" "n"; then CLOUDFLARE="ja"; else CLOUDFLARE="nee"; fi
fi
ok "Cloudflare-proxy: $CLOUDFLARE"

if [ "$CLOUDFLARE" = "nee" ] && [ "$EMAIL_GEZET" = 0 ] && [ "$BESTAAND" = 0 ]; then
  EMAIL="$(vraag "E-mailadres voor Let's Encrypt (voor verloopmeldingen, mag leeg)" "")"
fi
if [ -n "$EMAIL" ] && ! printf '%s' "$EMAIL" | grep -Eq '^[^@ ]+@[^@ ]+\.[^@ ]+$'; then
  let_op "\"$EMAIL\" lijkt geen e-mailadres; ik ga verder zonder."
  EMAIL=""
fi

if [ -z "$AUTOUPDATE" ]; then
  if ja_nee "Nieuwe versies automatisch van GitHub halen (elke 10 minuten)?" "j"; then AUTOUPDATE="ja"; else AUTOUPDATE="nee"; fi
fi
ok "Automatisch bijwerken: $AUTOUPDATE"

# ------------------------------------------------------------------ software

export DEBIAN_FRONTEND=noninteractive
APT_OPTS=(-y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold -o DPkg::Lock::Timeout=300)

stap "Software installeren"
apt-get -o DPkg::Lock::Timeout=300 update -q >/dev/null || let_op "apt-get update gaf een waarschuwing; ik probeer het toch."
apt-get install "${APT_OPTS[@]}" ca-certificates curl git rsync ufw openssl ssl-cert python3 >/dev/null
ok "git, rsync, curl, UFW, Python 3"

if ! command -v nginx >/dev/null 2>&1; then
  if ! apt-get install "${APT_OPTS[@]}" nginx >/dev/null 2>&1; then
    # Zonder IPv6 kan Ubuntu's standaardsite (listen [::]:80) niet starten en blijft de installatie hangen.
    rm -f /etc/nginx/sites-enabled/default
    dpkg --configure -a >/dev/null 2>&1 || true
    apt-get install "${APT_OPTS[@]}" nginx >/dev/null || fout "nginx installeren is mislukt."
  fi
  ok "nginx geïnstalleerd"
else
  ok "nginx was er al (wordt gedeeld met de andere sites op deze server)"
fi
NGINX_VERSIE="$(nginx -v 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1)"
info "nginx $NGINX_VERSIE"

if [ "$CLOUDFLARE" = "nee" ]; then
  apt-get install "${APT_OPTS[@]}" certbot >/dev/null
  ok "certbot (Let's Encrypt)"
fi

# ------------------------------------------------------------------ game ophalen

stap "Game ophalen van GitHub"
mkdir -p "$(dirname "$BRON_DIR")"
if [ -d "$BRON_DIR/.git" ]; then
  git -C "$BRON_DIR" remote set-url origin "$REPO_URL"
  git -C "$BRON_DIR" fetch --depth 1 -q origin "$BRANCH" || fout "Kan $REPO_URL niet bereiken."
  git -C "$BRON_DIR" reset -q --hard FETCH_HEAD
  git -C "$BRON_DIR" clean -q -fdx
else
  rm -rf "$BRON_DIR"
  git clone -q --depth 1 --branch "$BRANCH" "$REPO_URL" "$BRON_DIR" || fout "Kan $REPO_URL niet clonen."
fi
VERSIE_COMMIT="$(git -C "$BRON_DIR" rev-parse --short HEAD)"
ok "Versie $VERSIE_COMMIT (branch $BRANCH)"

# ------------------------------------------------------------------ eigen poort (nooit die van de andere game)

poort_bezet() {
  local p="$1"
  [ -n "$ANDER_POORT" ] && [ "$p" = "$ANDER_POORT" ] && return 0
  [ "$p" = 8765 ] && return 0   # standaardpoort van de Duitse streken, ook als die nog niet draait
  ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$p\$"
}
if [ -n "${API_POORT:-}" ] && { [ "$API_POORT" = "${ANDER_POORT:-x}" ] || [ "$API_POORT" = 8765 ]; }; then API_POORT=""; fi
if [ -n "${API_POORT:-}" ] && ! systemctl is-active --quiet "$NAAM-server" 2>/dev/null && poort_bezet "$API_POORT"; then API_POORT=""; fi
if [ -z "${API_POORT:-}" ]; then
  API_POORT=$EERSTE_POORT
  while poort_bezet "$API_POORT"; do API_POORT=$((API_POORT + 1)); done
fi
ok "Server-poort $API_POORT (alleen intern)"

# ------------------------------------------------------------------ instellingen bewaren

mkdir -p "$CONFIG_DIR"
{
  echo "# Instellingen van de installer van Marble Tycoon. Pas aan en draai de installer opnieuw."
  printf 'CFG_DOMEIN=%q\n' "$DOMEIN"
  printf 'CFG_CLOUDFLARE=%q\n' "$CLOUDFLARE"
  printf 'CFG_EMAIL=%q\n' "$EMAIL"
  printf 'CFG_AUTOUPDATE=%q\n' "$AUTOUPDATE"
  printf 'CFG_BRANCH=%q\n' "$BRANCH"
  printf 'CFG_BRON_DIR=%q\n' "$BRON_DIR"
  printf 'CFG_WEB_DIR=%q\n' "$WEB_DIR"
  printf 'CFG_DIENST_DIR=%q\n' "$DIENST_DIR"
  printf 'CFG_API_POORT=%q\n' "$API_POORT"
} > "$CONFIG"
chmod 600 "$CONFIG"

# ------------------------------------------------------------------ update-script (ook gebruikt door de timer)

cat > "$UPDATE_BIN" <<'UPDATE_SCRIPT'
#!/usr/bin/env bash
# Haalt de nieuwste versie van Marble Tycoon op van GitHub en zet die live.
#   marble-tycoon-update           alleen bijwerken als er iets nieuws is
#   marble-tycoon-update --forceer altijd opnieuw neerzetten
set -euo pipefail
# shellcheck disable=SC1091
. /etc/marble-tycoon/config
FORCEER=0
[ "${1:-}" = "--forceer" ] && FORCEER=1
BRON="$CFG_BRON_DIR"
WEB="$CFG_WEB_DIR"
exec 9>/run/marble-tycoon-update.lock
flock -n 9 || { echo "Er loopt al een update."; exit 0; }

oud="$(git -C "$BRON" rev-parse HEAD 2>/dev/null || echo geen)"
git -C "$BRON" fetch --depth 1 -q origin "$CFG_BRANCH"
nieuw="$(git -C "$BRON" rev-parse FETCH_HEAD)"
if [ "$oud" = "$nieuw" ] && [ "$FORCEER" = 0 ] && [ -f "$WEB/index.html" ]; then
  exit 0
fi
git -C "$BRON" reset -q --hard FETCH_HEAD
git -C "$BRON" clean -q -fdx

# Alleen wat de browser nodig heeft gaat naar de webmap (geen server, geen installer).
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
for deel in index.html bediening.html css js lib assets; do
  if [ -e "$BRON/$deel" ]; then cp -a "$BRON/$deel" "$TMP/"; fi
done
[ -f "$TMP/index.html" ] || { echo "index.html ontbreekt in de repo; niets veranderd." >&2; exit 1; }
mkdir -p "$WEB"
rsync -a --delete --chmod=D755,F644 "$TMP/" "$WEB/"
chown -R root:root "$WEB"

# Server (community + multiplayer) bijwerken en herstarten als de code veranderd is.
if [ -f "$BRON/server/marbletycoon.py" ] && [ -n "${CFG_DIENST_DIR:-}" ]; then
  mkdir -p "$CFG_DIENST_DIR"
  if ! cmp -s "$BRON/server/marbletycoon.py" "$CFG_DIENST_DIR/marbletycoon.py"; then
    install -m 644 "$BRON/server/marbletycoon.py" "$CFG_DIENST_DIR/marbletycoon.py"
    if systemctl is-active --quiet marble-tycoon-server 2>/dev/null; then
      systemctl restart marble-tycoon-server
      echo "Server herstart."
    fi
  fi
fi
echo "Marble Tycoon bijgewerkt naar $(git -C "$BRON" rev-parse --short HEAD)."
UPDATE_SCRIPT
chmod 755 "$UPDATE_BIN"

stap "Game neerzetten"
"$UPDATE_BIN" --forceer | sed 's/^/  /'
ok "Bestanden staan in $WEB_DIR"

# ------------------------------------------------------------------ server (community + races)

stap "Server voor de community en de races"
if ! id -u "$DIENST_GEBRUIKER" >/dev/null 2>&1; then
  useradd --system --home-dir "$DATA_DIR" --no-create-home --shell /usr/sbin/nologin "$DIENST_GEBRUIKER"
fi
install -d -m 700 -o "$DIENST_GEBRUIKER" -g "$DIENST_GEBRUIKER" "$DATA_DIR" "$BACKUP_DIR"
cat > "/etc/systemd/system/$NAAM-server.service" <<UNIT
[Unit]
Description=Marble Tycoon: community en multiplayer-races
After=network.target

[Service]
User=$DIENST_GEBRUIKER
Group=$DIENST_GEBRUIKER
ExecStart=/usr/bin/python3 $DIENST_DIR/marbletycoon.py serveer --db $DATA_DIR/banen.db --adres 127.0.0.1 --poort $API_POORT
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
UNIT
cat > "/etc/systemd/system/$NAAM-backup.service" <<UNIT
[Unit]
Description=Dagelijkse back-up van de community-banen van Marble Tycoon

[Service]
Type=oneshot
User=$DIENST_GEBRUIKER
Group=$DIENST_GEBRUIKER
ExecStart=/usr/bin/python3 $DIENST_DIR/marbletycoon.py backup --db $DATA_DIR/banen.db --map $BACKUP_DIR --bewaar 14
UMask=0077
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA_DIR $BACKUP_DIR
UNIT
cat > "/etc/systemd/system/$NAAM-backup.timer" <<UNIT
[Unit]
Description=Elke nacht een back-up van de community-banen van Marble Tycoon

[Timer]
OnCalendar=*-*-* 04:30:00
RandomizedDelaySec=30min
Persistent=true

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable "$NAAM-server.service" >/dev/null 2>&1
systemctl restart "$NAAM-server.service"
systemctl enable --now "$NAAM-backup.timer" >/dev/null 2>&1
DIENST_OK=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS --max-time 2 "http://127.0.0.1:$API_POORT/api/status" >/dev/null 2>&1; then DIENST_OK=1; break; fi
  sleep 1
done
if [ "$DIENST_OK" = 1 ]; then
  ok "Server draait (poort $API_POORT, alleen intern bereikbaar)"
  ok "Elke nacht een back-up in $BACKUP_DIR (14 dagen bewaard)"
else
  let_op "De server reageert niet. Kijk met: journalctl -u $NAAM-server"
fi

# ------------------------------------------------------------------ certificaten en nginx

stap "Webserver (nginx) instellen voor $DOMEIN"
mkdir -p "$ACME_DIR" "$SSL_DIR"
chmod 755 "$ACME_DIR"

HEEFT_IPV6=0
[ -e /proc/net/if_inet6 ] && HEEFT_IPV6=1

versie_minstens() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n 1)" = "$2" ]; }

cloudflare_ips() {
  local v4 v6
  v4="$(curl -fsS --max-time 10 https://www.cloudflare.com/ips-v4 2>/dev/null || true)"
  v6="$(curl -fsS --max-time 10 https://www.cloudflare.com/ips-v6 2>/dev/null || true)"
  if ! printf '%s' "$v4" | grep -q '/'; then
    v4="173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22"
  fi
  if ! printf '%s' "$v6" | grep -q '/'; then
    v6="2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32 2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32"
  fi
  printf '%s\n%s\n' "$v4" "$v6" | tr ' ' '\n' | grep '/'
}

eigen_certificaat() {  # zelfondertekend certificaat (10 jaar) voor Cloudflare "Full"
  local crt="$SSL_DIR/$DOMEIN.crt" key="$SSL_DIR/$DOMEIN.key"
  if [ ! -s "$crt" ] || ! openssl x509 -checkend 2592000 -noout -in "$crt" >/dev/null 2>&1; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
      -keyout "$key" -out "$crt" -subj "/CN=$DOMEIN" \
      -addext "subjectAltName=DNS:$DOMEIN" >/dev/null 2>&1
    chmod 600 "$key"
  fi
  echo "$crt $key"
}

# Let op: in dit bestand staat bewust nergens het woord voor de standaardsite van nginx.
# Het vangnet van de Duitse streken zoekt daarnaar en moet de baas blijven.
schrijf_site() {  # schrijf_site <cert> <key>   (leeg = alleen HTTP)
  local crt="$1" key="$2" cf_regels="" ip zone="${NAAM//-/_}"
  if [ "$CLOUDFLARE" = "ja" ]; then
    while IFS= read -r ip; do cf_regels+="    set_real_ip_from $ip;"$'\n'; done < <(cloudflare_ips)
    cf_regels+="    real_ip_header CF-Connecting-IP;"$'\n'
  fi
  {
    echo "# Gemaakt door de installer van Marble Tycoon. Wordt overschreven bij bijwerken."
    echo "limit_req_zone \$binary_remote_addr zone=${zone}_api:10m rate=10r/s;"
    echo "limit_conn_zone \$binary_remote_addr zone=${zone}_ws:10m;"
    echo
    echo "server {"
    echo "    listen 80;"
    echo "    listen [::]:80;"
    echo "    server_name $DOMEIN;"
    echo
    echo "    location ^~ /.well-known/acme-challenge/ {"
    echo "        root $ACME_DIR;"
    echo "        default_type text/plain;"
    echo "    }"
    if [ -n "$crt" ]; then
      echo
      echo "    location / {"
      echo "        return 301 https://\$host\$request_uri;"
      echo "    }"
      echo "}"
      echo
      echo "server {"
      echo "    listen 443 ssl;"
      echo "    listen [::]:443 ssl;"
      if versie_minstens "$NGINX_VERSIE" "1.25.1"; then echo "    http2 on;"; fi
      echo "    server_name $DOMEIN;"
      echo
      echo "    ssl_certificate     $crt;"
      echo "    ssl_certificate_key $key;"
      echo "    ssl_protocols TLSv1.2 TLSv1.3;"
      echo "    ssl_session_cache shared:${zone}_ssl:5m;"
      echo "    add_header Strict-Transport-Security \"max-age=15552000\" always;"
    fi
    echo
    printf '%s' "$cf_regels"
    echo "    root $WEB_DIR;"
    echo "    index index.html;"
    echo "    charset utf-8;"
    echo "    server_tokens off;"
    echo "    client_max_body_size 1k;"
    echo
    echo "    gzip on;"
    echo "    gzip_types text/css application/javascript text/javascript application/xml text/xml application/json image/svg+xml;"
    echo "    gzip_min_length 512;"
    echo
    echo "    add_header X-Content-Type-Options \"nosniff\" always;"
    echo "    add_header X-Frame-Options \"SAMEORIGIN\" always;"
    echo "    add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;"
    echo "    add_header Permissions-Policy \"camera=(), microphone=(), geolocation=()\" always;"
    echo "    add_header Content-Security-Policy \"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' wss://$DOMEIN ws://$DOMEIN; media-src 'self' data: blob:; worker-src 'self' blob:; frame-ancestors 'self'; base-uri 'self'; form-action 'none'\" always;"
    echo "    # Altijd even navragen of er een nieuwe versie is (goedkoop dankzij ETag), behalve voor de grote bibliotheken."
    echo "    add_header Cache-Control \"no-cache\" always;"
    echo
    echo "    location ^~ /lib/ {"
    echo "        expires 7d;"
    echo "        add_header Cache-Control \"public\" always;"
    echo "        add_header X-Content-Type-Options \"nosniff\" always;"
    echo "    }"
    echo
    echo "    # Community: banen delen en bekijken"
    echo "    location /api/ {"
    echo "        limit_req zone=${zone}_api burst=40 nodelay;"
    echo "        proxy_pass http://127.0.0.1:$API_POORT;"
    echo "        proxy_set_header Host \$host;"
    echo "        proxy_set_header X-Real-IP \$remote_addr;"
    echo "        proxy_read_timeout 20s;"
    echo "        client_max_body_size 1m;"
    echo "        add_header X-Content-Type-Options \"nosniff\" always;"
    echo "    }"
    echo
    echo "    # Multiplayer: WebSocket tussen het hostscherm en de telefoons"
    echo "    location = /ws {"
    echo "        limit_conn ${zone}_ws 30;"
    echo "        proxy_pass http://127.0.0.1:$API_POORT;"
    echo "        proxy_http_version 1.1;"
    echo "        proxy_set_header Upgrade \$http_upgrade;"
    echo "        proxy_set_header Connection \"upgrade\";"
    echo "        proxy_set_header Host \$host;"
    echo "        proxy_set_header X-Real-IP \$remote_addr;"
    echo "        proxy_read_timeout 3600s;"
    echo "        proxy_send_timeout 3600s;"
    echo "        proxy_buffering off;"
    echo "    }"
    echo
    echo "    location ~ /\\. {"
    echo "        deny all;"
    echo "    }"
    echo
    echo "    location / {"
    echo "        try_files \$uri \$uri/ =404;"
    echo "    }"
    echo "}"
  } > "$NGINX_SITE"
  [ "$HEEFT_IPV6" = 1 ] || sed -i '/listen \[::\]/d' "$NGINX_SITE"
  ln -sf "$NGINX_SITE" "/etc/nginx/sites-enabled/$NAAM"
}

herlaad_nginx() {
  if ! nginx -t >/dev/null 2>&1; then
    nginx -t || true
    # Alleen ons eigen bestand weer uitzetten, zodat de andere sites op deze server gewoon blijven werken.
    rm -f "/etc/nginx/sites-enabled/$NAAM"
    nginx -t >/dev/null 2>&1 && systemctl reload nginx >/dev/null 2>&1 || true
    fout "De nginx-configuratie klopt niet (zie hierboven). Ik heb alleen mijn eigen site weer uitgezet; de rest draait gewoon door."
  fi
  systemctl enable nginx >/dev/null 2>&1 || true
  if systemctl is-active --quiet nginx; then systemctl reload nginx; else systemctl restart nginx; fi
}

LE_CRT="/etc/letsencrypt/live/$DOMEIN/fullchain.pem"
LE_KEY="/etc/letsencrypt/live/$DOMEIN/privkey.pem"
HTTPS=0

if [ "$CLOUDFLARE" = "ja" ]; then
  read -r CRT KEY < <(eigen_certificaat)
  schrijf_site "$CRT" "$KEY"
  herlaad_nginx
  HTTPS=1
  ok "HTTPS met een eigen certificaat (voor Cloudflare-modus Full)"
else
  if [ -s "$LE_CRT" ]; then
    schrijf_site "$LE_CRT" "$LE_KEY"
    herlaad_nginx
    HTTPS=1
    ok "Bestaand Let's Encrypt-certificaat gevonden"
  else
    schrijf_site "" ""
    herlaad_nginx
    ok "Game draait nu via HTTP; certificaat aanvragen..."
  fi
fi
if ! grep -Rqs "default_server" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null; then
  info "Er is geen vangnet in nginx; via het kale IP-adres zie je Ubuntu's standaardpagina (niet erg)."
fi

# ------------------------------------------------------------------ firewall

stap "Firewall (UFW)"
SSH_POORTEN="$( (sshd -T 2>/dev/null | awk '/^port /{print $2}') || true)"
[ -n "$SSH_POORTEN" ] || SSH_POORTEN="$(grep -hE '^\s*Port\s+[0-9]+' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null | awk '{print $2}' || true)"
[ -n "$SSH_POORTEN" ] || SSH_POORTEN="22"
for p in $SSH_POORTEN; do ufw allow "$p/tcp" comment "SSH" >/dev/null; done
ok "SSH blijft bereikbaar (poort $(echo "$SSH_POORTEN" | tr '\n' ' ' | sed 's/ *$//'))"

# Staat 80/443 al alleen open voor bepaalde adressen (bijvoorbeeld alleen Cloudflare)? Dan respecteren we dat.
UFW_STATUS="$(ufw status 2>/dev/null || true)"
BEPERKT=0
if printf '%s\n' "$UFW_STATUS" | grep -q "Status: active" \
   && printf '%s\n' "$UFW_STATUS" | grep -Eq '^(80|443)(/tcp)?[[:space:]]+ALLOW' \
   && ! printf '%s\n' "$UFW_STATUS" | grep -Eq '^(80|443)(/tcp)?[[:space:]]+ALLOW[[:space:]]+Anywhere'; then
  BEPERKT=1
fi
if [ "$BEPERKT" = 1 ] && [ "$CLOUDFLARE" = "ja" ]; then
  info "Poort 80/443 staat alleen open voor bepaalde adressen (zoals Cloudflare); dat laat ik zo."
elif [ "$BEPERKT" = 1 ]; then
  let_op "Poort 80/443 staat nu alleen open voor bepaalde adressen (bijvoorbeeld alleen Cloudflare)."
  let_op "Zonder Cloudflare moet Marble Tycoon voor iedereen bereikbaar zijn. Dat geldt dan ook voor de andere sites."
  if ja_nee "Poort 80 en 443 voor iedereen openzetten?" "n"; then
    ufw allow 80/tcp comment "HTTP" >/dev/null
    ufw allow 443/tcp comment "HTTPS" >/dev/null
  else
    let_op "Niets veranderd. Zet $DOMEIN dan ook achter Cloudflare (oranje wolkje)."
  fi
else
  ufw allow 80/tcp comment "HTTP" >/dev/null
  ufw allow 443/tcp comment "HTTPS" >/dev/null
fi
if ! ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw --force enable >/dev/null
fi
ok "Firewall actief (SSH, HTTP en HTTPS)"

# ------------------------------------------------------------------ Let's Encrypt

if [ "$CLOUDFLARE" = "nee" ] && [ "$HTTPS" = 0 ]; then
  stap "HTTPS-certificaat aanvragen bij Let's Encrypt"
  SERVER_IP="$(curl -fsS --max-time 8 -4 https://api.ipify.org 2>/dev/null || true)"
  DNS_IP="$(getent ahostsv4 "$DOMEIN" 2>/dev/null | awk 'NR==1{print $1}' || true)"
  if [ -n "$SERVER_IP" ] && [ -n "$DNS_IP" ] && [ "$SERVER_IP" != "$DNS_IP" ]; then
    let_op "$DOMEIN wijst naar $DNS_IP, maar deze server is $SERVER_IP."
  elif [ -z "$DNS_IP" ]; then
    let_op "$DOMEIN heeft (nog) geen A-record."
  fi
  CERTBOT_MAIL=(--register-unsafely-without-email)
  [ -n "$EMAIL" ] && CERTBOT_MAIL=(-m "$EMAIL")
  if certbot certonly --webroot -w "$ACME_DIR" -d "$DOMEIN" --non-interactive --agree-tos \
       "${CERTBOT_MAIL[@]}" --keep-until-expiring >/dev/null 2>&1; then
    mkdir -p /etc/letsencrypt/renewal-hooks/deploy
    cat > "/etc/letsencrypt/renewal-hooks/deploy/$NAAM-nginx.sh" <<'HOOK'
#!/bin/sh
systemctl reload nginx
HOOK
    chmod 755 "/etc/letsencrypt/renewal-hooks/deploy/$NAAM-nginx.sh"
    schrijf_site "$LE_CRT" "$LE_KEY"
    herlaad_nginx
    HTTPS=1
    ok "Certificaat geregeld; het wordt vanzelf verlengd"
  else
    let_op "Het certificaat aanvragen is niet gelukt. Marble Tycoon draait voorlopig via http://$DOMEIN"
    let_op "Zorg dat $DOMEIN met een A-record naar deze server wijst en draai de installer daarna opnieuw."
  fi
fi

# ------------------------------------------------------------------ automatisch bijwerken

stap "Bijwerken vanaf GitHub"
cat > "/etc/systemd/system/$NAAM-update.service" <<SERVICE
[Unit]
Description=Nieuwste versie van Marble Tycoon ophalen van GitHub
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$UPDATE_BIN
SERVICE
cat > "/etc/systemd/system/$NAAM-update.timer" <<TIMER
[Unit]
Description=Elke 10 minuten kijken of er een nieuwe versie van Marble Tycoon is

[Timer]
OnBootSec=3min
OnUnitActiveSec=10min
RandomizedDelaySec=45s
Persistent=true

[Install]
WantedBy=timers.target
TIMER
systemctl daemon-reload
if [ "$AUTOUPDATE" = "ja" ]; then
  systemctl enable --now "$NAAM-update.timer" >/dev/null 2>&1
  ok "Elke 10 minuten automatisch (logboek: journalctl -u $NAAM-update)"
else
  systemctl disable --now "$NAAM-update.timer" >/dev/null 2>&1 || true
  ok "Handmatig: sudo $NAAM-update"
fi

# ------------------------------------------------------------------ klaar

if [ "$HTTPS" = 1 ]; then URL="https://$DOMEIN"; else URL="http://$DOMEIN"; fi
echo
echo "${GROEN}${BOLD}Klaar!${RESET} Marble Tycoon staat op ${BOLD}$URL${RESET}"
echo
if [ "$CLOUDFLARE" = "ja" ]; then
  echo "  In Cloudflare: A-record voor $DOMEIN naar deze server, proxy aan (oranje wolkje)"
  echo "  en bij SSL/TLS de modus ${BOLD}Full${RESET} (niet \"Full (strict)\"). WebSockets staan in Cloudflare standaard aan."
else
  echo "  DNS: een A-record voor $DOMEIN naar het IP-adres van deze server."
fi
echo "  Telefoons voor de race: $URL/bediening.html (of scan de QR-code in de game)."
echo "  Community-banen: $DATA_DIR/banen.db (back-ups in $BACKUP_DIR)."
echo "  Een baan uit de community halen: sudo -u $NAAM python3 $DIENST_DIR/marbletycoon.py verwijder --db $DATA_DIR/banen.db --id CODE"
echo "  Nu meteen bijwerken:   sudo $NAAM-update"
echo "  Instellingen wijzigen: draai de installer opnieuw (of pas $CONFIG aan)."
echo "  Verwijderen:           curl -fsSL https://raw.githubusercontent.com/Rudyh0/MarbleTycoon/main/install.sh | sudo bash -s -- --verwijder"
