// Afstandsbediening op de telefoon voor de multiplayer-race.

import { ITEM_SVG, ITEM_NAAM } from './itemiconen.js';

const SKINS = [
  ['kattenoog', 'Kattenoog', 'radial-gradient(circle at 35% 30%, #fff 0 8%, #bfeaf3 12%, #1f63d6 55%, #0b2f73)'],
  ['vuuroog', 'Vuuroog', 'radial-gradient(circle at 35% 30%, #fff 0 8%, #ffd0b0 12%, #e2361b 55%, #6d1608)'],
  ['groenoog', 'Groenoog', 'radial-gradient(circle at 35% 30%, #fff 0 8%, #daf7d2 12%, #1f9a3d 55%, #0b4019)'],
  ['paarsoog', 'Paarsoog', 'radial-gradient(circle at 35% 30%, #fff 0 8%, #eadcff 12%, #6a2bd6 55%, #2a0e63)'],
  ['regenboog', 'Regenboog', 'conic-gradient(#ff4f4f, #ffd23a, #5cc96b, #3ccfe0, #6d5bd0, #ff4fb0, #ff4f4f)'],
  ['staal', 'Staal', 'radial-gradient(circle at 35% 30%, #fff 0 10%, #d5dbe2 25%, #7c8692 70%, #3d434b)'],
  ['goud', 'Goud', 'radial-gradient(circle at 35% 30%, #fff8d0 0 10%, #f3c54a 30%, #a8761a 75%, #5a3c08)'],
  ['aarde', 'Aarde', 'radial-gradient(circle at 60% 40%, #5aa04d 0 18%, transparent 19%), radial-gradient(circle at 30% 65%, #6f9a3a 0 14%, transparent 15%), radial-gradient(circle at 35% 30%, #6fb0ff, #1a4fa0 70%, #0c2752)'],
  ['mars', 'Mars', 'radial-gradient(circle at 35% 30%, #f7b27a 0 10%, #e58a4d 30%, #b24a24 70%, #5a200c)'],
  ['lava', 'Lava', 'radial-gradient(circle at 40% 40%, #ffd25a 0 6%, transparent 9%), radial-gradient(circle at 65% 60%, #ff7a2a 0 7%, transparent 10%), radial-gradient(circle at 35% 30%, #5a3a2a, #1a1414 75%)'],
  ['galaxy', 'Melkweg', 'radial-gradient(circle at 70% 30%, #fff 0 2%, transparent 3%), radial-gradient(circle at 30% 60%, #fff 0 1.5%, transparent 2.5%), radial-gradient(circle at 40% 40%, #5a1f8a, #2d7cff 45%, #0b0726 80%)'],
  ['neon', 'Neon', 'radial-gradient(circle at 35% 30%, #eaffef 0 10%, #39ff88 40%, #0f9a4a 85%)'],
  ['neonroze', 'Neon roze', 'radial-gradient(circle at 35% 30%, #ffe6f8 0 10%, #ff3fd2 40%, #8a116f 85%)'],
  ['marmer', 'Marmer', 'radial-gradient(circle at 35% 30%, #fff 0 15%, #e8e6e0 40%, #9aa0aa 90%)'],
  ['strandbal', 'Strandbal', 'conic-gradient(#ff4040 0 60deg, #fff 0 120deg, #2f7cff 0 180deg, #ffd23a 0 240deg, #fff 0 300deg, #3ad16b 0)'],
  ['snoep', 'Snoep', 'repeating-linear-gradient(45deg, #ff5c9a 0 10px, #fff3f7 10px 20px)'],
  ['smiley', 'Smiley', 'radial-gradient(circle at 38% 40%, #2a1a00 0 6%, transparent 7%), radial-gradient(circle at 62% 40%, #2a1a00 0 6%, transparent 7%), radial-gradient(circle at 50% 50%, #ffd23a 60%, #d9a400)'],
  ['kanonskogel', 'Kanonskogel', 'radial-gradient(circle at 35% 30%, #9aa0a8 0 8%, #3a3d42 35%, #15161a 85%)'],
];

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
let code = (params.get('k') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

const opgeslagen = (() => { try { return JSON.parse(localStorage.getItem('marbletycoon.speler') || '{}'); } catch { return {}; } })();
let naam = opgeslagen.naam || '';
let skin = opgeslagen.skin || SKINS[Math.floor(Math.random() * SKINS.length)][0];
let sleutel = null;
try { sleutel = JSON.parse(sessionStorage.getItem('marbletycoon.sleutel.' + code) || 'null'); } catch { /* */ }

let ws = null;
let verbonden = false;
let welkom = false;
let fase = 'aanmelden';
let klaar = false;
let gas = 0;
let laatstGestuurd = -1, laatstTijd = 0;
let gevaar = 0;
let wakeLock = null;
let pogingen = 0;
let mijnKleur = '#4fa3ff';
let bewustWeg = false;
let regels = { modus: 'race', rondes: 1, maxUit: 0, arcade: false };
let mijnItem = null;
let rolTimer = 0;
let rem = false;

// ------------------------------------------------------------------ schermen

function toon(id) {
  for (const s of document.querySelectorAll('.scherm')) s.hidden = s.id !== 's-' + id;
  fase = id;
  document.body.dataset.fase = id;
}

function overlay(tekst, knopTekst, actie) {
  const o = $('overlay');
  if (!tekst) { o.hidden = true; return; }
  $('overlayTekst').textContent = tekst;
  const k = $('overlayKnop');
  k.hidden = !knopTekst;
  if (knopTekst) { k.textContent = knopTekst; k.onclick = actie; }
  o.hidden = false;
}

function bouwSkins() {
  const vak = $('skins');
  vak.replaceChildren();
  for (const [id, n, achter] of SKINS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'skin' + (id === skin ? ' actief' : '');
    b.title = n;
    b.setAttribute('aria-label', n);
    b.style.background = achter;
    b.onclick = () => { skin = id; bouwSkins(); tik(); };
    vak.append(b);
  }
  const s = SKINS.find((x) => x[0] === skin) || SKINS[0];
  $('ikBol').style.background = s[2];
}

// ------------------------------------------------------------------ verbinding

function verbind() {
  if (ws) { try { ws.close(); } catch { /* */ } }
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  ws = new WebSocket(url);
  const deze = ws;
  ws.onopen = () => {
    verbonden = true;
    pogingen = 0;
    ws.send(JSON.stringify({ t: 'meedoen', code, naam, skin, sleutel }));
  };
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } bericht(m); };
  ws.onclose = () => {
    if (deze !== ws) return;
    verbonden = false;
    if (bewustWeg) return;
    if (welkom) {
      overlay('Verbinding kwijt… opnieuw verbinden');
      const wacht = Math.min(8000, 800 * 2 ** pogingen++);
      setTimeout(verbind, wacht);
    } else {
      $('aanmeldStatus').textContent = 'Kan geen verbinding maken. Controleer je internet en probeer het opnieuw.';
      $('meedoen').disabled = false;
    }
  };
}

function stuur(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }

function bericht(m) {
  switch (m.t) {
    case 'welkom':
      welkom = true;
      sleutel = m.sleutel;
      try { sessionStorage.setItem('marbletycoon.sleutel.' + code, JSON.stringify(sleutel)); } catch { /* */ }
      overlay(null);
      $('welkomNaam').textContent = 'Hoi ' + m.naam + '!';
      if (fase === 'aanmelden') toon('lobby');
      if (fase === 'lobby') { stuur({ t: 'klaar', klaar }); }
      if (!m.host) overlay('Wachten op het hostscherm…');
      break;
    case 'kleur':
      if (m.regels) zetRegels(m.regels);
      mijnKleur = m.kleur;
      document.documentElement.style.setProperty('--mijn', m.kleur);
      if (m.fase === 'lobby' && fase !== 'lobby' && fase !== 'aanmelden') { toon('lobby'); zetKlaar(false); }
      break;
    case 'aftel':
      if (m.regels) zetRegels(m.regels);
      if (fase !== 'race') { toon('race'); houdWakker(); zetGas(0); zetItem(null); $('weg').hidden = true; }
      aftel(String(m.n));
      $('raceMelding').textContent = '';
      break;
    case 'go':
      if (m.regels) zetRegels(m.regels);
      if (fase !== 'race') { toon('race'); houdWakker(); }
      aftel('GO!');
      tril([60, 40, 60]);
      break;
    case 'status':
      if (fase !== 'race') return;
      $('plek').textContent = m.plek;
      $('van').textContent = '/' + m.van;
      $('ronde').textContent = m.rondes ? `Ronde ${m.ronde}/${m.rondes}` : `Ronde ${m.ronde}`;
      $('levens').textContent = m.max ? (regels.modus === 'lms' ? '♥'.repeat(Math.max(0, m.max - m.keer)) + '♡'.repeat(Math.min(m.max, m.keer)) : `Uit de bocht: ${m.keer}/${m.max}`) : '';
      $('snelheid').textContent = Math.abs(m.v);
      $('achteruit').hidden = !(m.v < 0);
      if (!m.rol && !rolTimer && (m.item || null) !== mijnItem) zetItem(m.item || null);
      if (m.weg && $('weg').hidden) toonWeg();
      gevaar = m.uit ? 0 : m.g || 0;
      $('gevaar').style.width = Math.min(100, gevaar * 100) + '%';
      document.body.classList.toggle('spannend', gevaar > 0.75);
      break;
    case 'eruit':
      $('raceMelding').textContent = 'Uit de bocht!';
      flits('rood');
      tril([220, 60, 220]);
      break;
    case 'terug':
      $('raceMelding').textContent = '';
      break;
    case 'itemRol':
      rolItem(m.item);
      break;
    case 'item':
      if (!rolTimer) zetItem(m.item || null);
      break;
    case 'geraakt': {
      const t = { banaan: 'Bananenschil!', rood: 'Rode schelp!', blauw: 'Blauwe schelp!' }[m.door] || 'Geraakt!';
      $('raceMelding').textContent = t;
      flits('rood');
      tril([120, 50, 260]);
      break;
    }
    case 'uitgeschakeld':
      toonWeg();
      tril([400]);
      break;
    case 'gladder':
      $('raceMelding').textContent = 'De baan wordt gladder!';
      flits('oranje');
      setTimeout(() => { if ($('raceMelding').textContent.startsWith('De baan')) $('raceMelding').textContent = ''; }, 2000);
      break;
    case 'ronde':
      $('raceMelding').textContent = 'Ronde ' + m.ronde + '!';
      flits('groen');
      tril(40);
      setTimeout(() => { if ($('raceMelding').textContent.startsWith('Ronde')) $('raceMelding').textContent = ''; }, 1500);
      break;
    case 'finish':
      zetGas(0);
      toon('uitslag');
      $('uitslagTitel').textContent = m.plek === 1 ? 'Gewonnen!' : `Je bent ${m.plek}e!`;
      $('uitslagSub').textContent = 'Tijd: ' + Number(m.tijd).toFixed(2) + ' s';
      $('uitslagLijst').replaceChildren();
      tril(m.plek === 1 ? [100, 50, 100, 50, 300] : [120]);
      break;
    case 'uitslag': {
      if (fase === 'race') { toon('uitslag'); $('uitslagTitel').textContent = 'Race afgelopen'; $('uitslagSub').textContent = ''; }
      const ol = $('uitslagLijst');
      ol.replaceChildren(...m.lijst.map((r) => {
        const li = document.createElement('li');
        const wat = r.tijd !== null ? Number(r.tijd).toFixed(2) + ' s' : m.modus === 'lms' ? (r.plek === 1 ? 'winnaar!' : `eruit in ronde ${r.ronde}`) : r.weg ? 'uitgeschakeld' : 'niet gefinisht';
        li.textContent = `${r.naam} — ${wat}`;
        return li;
      }));
      if (m.modus === 'lms' && fase === 'uitslag' && m.lijst[0]) $('uitslagTitel').textContent = m.lijst[0].naam === naam ? 'Jij wint!' : `${m.lijst[0].naam} wint!`;
      break;
    }
    case 'lobby':
      toon('lobby');
      zetKlaar(!!m.klaar);
      zetGas(0);
      zetRem(false);
      zetItem(null);
      $('weg').hidden = true;
      break;
    case 'host_weg':
      overlay('Het hostscherm is even weg. Wachten…');
      break;
    case 'host_terug':
      overlay(null);
      break;
    case 'einde':
      toon('lobby');
      zetKlaar(false);
      overlay('De host is gestopt met racen.', 'Opnieuw verbinden', () => { overlay(null); verbind(); });
      break;
    case 'kamer_weg':
    case 'gekickt':
      bewustWeg = true;
      welkom = false;
      overlay(m.t === 'gekickt' ? 'Je bent uit de race gehaald.' : 'Deze race bestaat niet meer.', 'Opnieuw', () => location.reload());
      break;
    case 'fout':
      if (m.code === 'geen_kamer' || m.code === 'vol') {
        welkom = false;
        bewustWeg = true;
        toon('aanmelden');
        $('aanmeldStatus').textContent = m.melding;
        $('meedoen').disabled = false;
        $('codeVeldLabel').hidden = false;
      }
      break;
    default:
  }
}

// ------------------------------------------------------------------ regels, items en remmen

function zetRegels(r) {
  regels = { ...regels, ...r };
  $('itemKnop').hidden = !regels.arcade;
  const delen = [];
  if (regels.modus === 'lms') delen.push(`Last man standing: blijf het langst op de baan. Je hebt ${regels.maxUit} ${regels.maxUit === 1 ? 'leven' : 'levens'}.`);
  else {
    delen.push(`Race over ${regels.rondes === 1 ? '1 ronde' : regels.rondes + ' rondes'}.`);
    if (regels.maxUit) delen.push(`Na ${regels.maxUit}× uit de bocht lig je eruit.`);
  }
  if (regels.arcade) delen.push('Rij door de ?-dozen voor een power-up en druk op de itemknop om hem te gebruiken.');
  $('regelTekst').textContent = delen.join(' ');
}

function zetItem(item) {
  mijnItem = item;
  const k = $('itemKnop');
  k.classList.toggle('vol', !!item);
  k.classList.toggle('leeg', !item);
  k.classList.remove('rolt');
  $('itemIcoon').innerHTML = item ? ITEM_SVG[item] : '';
  $('itemNaam').textContent = item ? ITEM_NAAM[item] : 'Geen item';
}

function rolItem(eind) {
  clearInterval(rolTimer);
  const lijst = Object.keys(ITEM_SVG);
  let i = 0;
  const k = $('itemKnop');
  k.classList.add('rolt');
  $('itemNaam').textContent = '…';
  rolTimer = setInterval(() => { $('itemIcoon').innerHTML = ITEM_SVG[lijst[i++ % lijst.length]]; }, 90);
  setTimeout(() => { clearInterval(rolTimer); rolTimer = 0; zetItem(eind); tril(40); }, 1300);
}

function toonWeg() {
  $('weg').hidden = false;
  zetGas(0);
  zetRem(false);
  clearInterval(rolTimer); rolTimer = 0;
  zetItem(null);
}

function zetRem(aan) {
  if (rem === aan) return;
  rem = aan;
  $('remKnop').classList.toggle('vast', aan);
  stuur({ t: 'rem', aan });
}

const remKnop = $('remKnop');
remKnop.addEventListener('pointerdown', (e) => { e.preventDefault(); remKnop.setPointerCapture(e.pointerId); zetRem(true); tril(15); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) remKnop.addEventListener(ev, () => zetRem(false));
$('itemKnop').addEventListener('click', () => {
  if (!mijnItem || rolTimer) return;
  stuur({ t: 'gebruik' });
  tril(35);
  zetItem(null);
});

// ------------------------------------------------------------------ klaar en aftellen

function zetKlaar(k) {
  klaar = k;
  const b = $('klaar');
  b.textContent = klaar ? 'Klaar! ✓' : 'Klaar';
  b.classList.toggle('aan', klaar);
  $('lobbyTekst').textContent = klaar ? 'Wachten tot de race begint…' : 'Druk op Klaar als je wilt racen.';
  stuur({ t: 'klaar', klaar });
}

function aftel(t) {
  const a = $('aftel');
  a.textContent = t;
  a.hidden = false;
  a.classList.remove('pop'); void a.offsetWidth; a.classList.add('pop');
  tril(t === 'GO!' ? 0 : 30);
  clearTimeout(aftel.t);
  aftel.t = setTimeout(() => { a.hidden = true; }, t === 'GO!' ? 700 : 950);
}

// ------------------------------------------------------------------ gashendel

const hendel = $('hendel');
let hendelId = null;

function zetGas(w) {
  gas = Math.min(1, Math.max(0, w));
  $('knop').style.bottom = `calc(${(gas * 100).toFixed(1)}% - ${(gas * 96).toFixed(1)}px)`;
  $('vulling').style.height = (gas * 100).toFixed(1) + '%';
  verstuurGas(true);
}

function verstuurGas(direct) {
  const nu = performance.now();
  if (Math.abs(gas - laatstGestuurd) > 0.015 || nu - laatstTijd > 300 || (direct && gas === 0 && laatstGestuurd !== 0)) {
    if (nu - laatstTijd < 33 && gas !== 0 && !direct) return;
    stuur({ t: 'gas', w: Math.round(gas * 1000) / 1000 });
    laatstGestuurd = gas;
    laatstTijd = nu;
  }
}

function gasUitPunt(y) {
  const r = hendel.getBoundingClientRect();
  const marge = 48;
  return 1 - (y - r.top - marge) / Math.max(1, r.height - marge * 2);
}

hendel.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  hendel.setPointerCapture(e.pointerId);
  hendelId = e.pointerId;
  hendel.classList.add('vast');
  zetGas(gasUitPunt(e.clientY));
});
hendel.addEventListener('pointermove', (e) => { if (e.pointerId === hendelId) zetGas(gasUitPunt(e.clientY)); });
const los = (e) => { if (e.pointerId !== hendelId) return; hendelId = null; hendel.classList.remove('vast'); zetGas(0); };
hendel.addEventListener('pointerup', los);
hendel.addEventListener('pointercancel', los);
hendel.addEventListener('lostpointercapture', los);
// toetsenbord (handig om te testen op een computer)
window.addEventListener('keydown', (e) => {
  if (fase !== 'race' || e.repeat) return;
  if (e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); zetGas(1); }
  if (e.key === 'ArrowDown') { e.preventDefault(); zetRem(true); }
  if (e.key === 'Enter' || e.key.toLowerCase() === 'e') $('itemKnop').click();
});
window.addEventListener('keyup', (e) => {
  if (fase !== 'race') return;
  if (e.key === 'ArrowUp' || e.key === ' ') zetGas(0);
  if (e.key === 'ArrowDown') zetRem(false);
});
setInterval(() => verstuurGas(false), 60);

// ------------------------------------------------------------------ trillen

function tril(patroon) {
  if (!patroon) return;
  if (navigator.vibrate) { try { navigator.vibrate(patroon); return; } catch { /* */ } }
  tik();
}

// iPhone: Safari kent geen trilfunctie; een "switch"-schakelaar geeft wel een tikje.
function tik() {
  if (navigator.vibrate) return;
  try { $('tik').click(); } catch { /* */ }
}

setInterval(() => {
  if (fase !== 'race') return;
  if (gevaar > 0.75) {
    if (navigator.vibrate) navigator.vibrate(gevaar > 1 ? 90 : gevaar > 0.9 ? 55 : 25);
    else tik();
    flits(gevaar > 0.95 ? 'rood' : 'oranje', true);
  }
}, 140);

function flits(kleur, zacht) {
  const f = $('flits');
  f.className = 'flits ' + kleur + (zacht ? ' zacht' : '');
  void f.offsetWidth;
  f.classList.add('aan');
}

async function houdWakker() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { /* */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && (fase === 'race' || fase === 'lobby')) houdWakker(); });

// ------------------------------------------------------------------ aanmelden

$('naam').value = naam;
$('code').value = code;
if (!code) $('codeVeldLabel').hidden = false;
bouwSkins();

$('meedoen').addEventListener('click', () => {
  naam = $('naam').value.trim().slice(0, 14);
  if (!naam) { $('aanmeldStatus').textContent = 'Vul eerst je naam in.'; $('naam').focus(); return; }
  const c = $('code').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (c !== code) { code = c; sleutel = null; }
  if (!code) { $('aanmeldStatus').textContent = 'Vul de racecode in die op het grote scherm staat.'; return; }
  try { localStorage.setItem('marbletycoon.speler', JSON.stringify({ naam, skin })); } catch { /* */ }
  $('aanmeldStatus').textContent = 'Verbinden…';
  $('meedoen').disabled = true;
  bewustWeg = false;
  tik();
  houdWakker();
  if (welkom && ws && ws.readyState === 1) {
    stuur({ t: 'naam', naam }); stuur({ t: 'skin', skin });
    toon('lobby');
    $('welkomNaam').textContent = 'Hoi ' + naam + '!';
    $('meedoen').disabled = false;
    $('aanmeldStatus').textContent = '';
    bouwSkins();
  } else verbind();
});
$('klaar').addEventListener('click', () => { zetKlaar(!klaar); tril(30); houdWakker(); });
$('wijzig').addEventListener('click', () => { zetKlaar(false); toon('aanmelden'); $('meedoen').textContent = 'Opslaan'; });

// dubbeltikken mag niet inzoomen
let laatsteTik = 0;
document.addEventListener('touchend', (e) => { const nu = Date.now(); if (nu - laatsteTik < 350) e.preventDefault(); laatsteTik = nu; }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

void mijnKleur;
