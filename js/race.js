// Multiplayer race (host). Het hostscherm maakt een kamer aan, toont een QR-code en laat de knikkers rijden.
// Telefoons sturen gas, rem en "gebruik item"; de host stuurt stand, snelheid, gevaar en items terug.
// Tijdens de race krijgt elke speler een eigen schermpje (splitscreen) met een camera die zijn knikker volgt.

import * as THREE from '../lib/three.min.js';
import qrcode from '../lib/qrcode.min.js';
import { KMU } from './config.js';
import { SKIN_MAP } from './knikkers.js';
import { skinIkoon } from './ikonen.js';
import { geluid } from './geluid.js';
import { Kit } from './modelkit.js';
import { gloedTex } from './texturen.js';
import { ITEM_SVG, ITEM_NAAM } from './itemiconen.js';
import { opslag } from './opslag.js';

const LABEL_KLEUREN = ['#ff5d5d', '#4fa3ff', '#7ed957', '#f8d84a', '#c77dff', '#ff9f43', '#3ccfe0', '#ff6fb5', '#b8e34d', '#e8c99b', '#8b95a5', '#f4f1ea'];
const LAAG = (i) => 2 + i; // eigen camera-laag per speler voor zijn naamlabel

// ------------------------------------------------------------------ modellen van de power-ups

function vraagTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 128, 128);
  ['#ff5d5d', '#ffb347', '#f8d84a', '#7ed957', '#3ccfe0', '#6d5bd0'].forEach((k, i, a) => grad.addColorStop(i / (a.length - 1), k));
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(8, 8, 112, 112);
  g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(6, 6, 116, 116);
  g.fillStyle = '#fff'; g.font = '900 92px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeText('?', 64, 70); g.fillText('?', 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const MODELLEN = {};
function model(soort) {
  if (MODELLEN[soort]) return MODELLEN[soort].clone(true);
  let g;
  if (soort === 'doos') {
    g = new THREE.Group();
    const tex = vraagTex();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, transparent: true, opacity: 0.95, roughness: 0.35 }));
    m.name = 'kubus';
    g.add(m);
  } else if (soort === 'banaan') {
    const k = new Kit();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      k.bol(0.05, '#ffd23a', { x: Math.cos(a) * 0.07, y: 0.03, z: Math.sin(a) * 0.07, sx: 2.2, sy: 0.55, sz: 0.9, ry: -a, mat: 'glans' });
    }
    k.bol(0.045, '#f2c12e', { y: 0.05, mat: 'glans' });
    k.cil(0.012, 0.018, 0.07, '#6b4a1a', { y: 0.06 });
    g = k.bouw();
  } else if (soort === 'rood' || soort === 'blauw') {
    const k = new Kit();
    const kleur = soort === 'rood' ? '#e8322a' : '#2f6cff';
    k.cil(0.13, 0.14, 0.04, '#f4f1ea', { seg: 16 });
    k.bol(0.12, kleur, { y: 0.03, half: true, seg: 16, mat: 'glans' });
    if (soort === 'blauw') for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.kegel(0.025, 0.07, '#ffffff', { x: Math.cos(a) * 0.07, y: 0.12, z: Math.sin(a) * 0.07, rx: Math.sin(a) * 0.6, rz: -Math.cos(a) * 0.6, seg: 6 });
    }
    g = k.bouw({ schaduw: true });
  }
  MODELLEN[soort] = g;
  return g.clone(true);
}

function gloed(kleur) {
  const m = new THREE.SpriteMaterial({ map: gloedTex(), color: kleur, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.renderOrder = 30;
  return s;
}

// ------------------------------------------------------------------ indeling van het splitscreen

function indeling(n, W, H) {
  let kol, rij;
  if (n <= 1) { kol = 1; rij = 1; }
  else if (n === 2) { kol = W >= H ? 2 : 1; rij = W >= H ? 1 : 2; }
  else if (n <= 4) { kol = 2; rij = 2; }
  else if (n <= 6) { kol = W >= H ? 3 : 2; rij = W >= H ? 2 : 3; }
  else if (n <= 9) { kol = 3; rij = 3; }
  else { kol = W >= H ? 4 : 3; rij = W >= H ? 3 : 4; }
  const w = Math.floor(W / kol), h = Math.floor(H / rij);
  const cellen = [];
  for (let i = 0; i < kol * rij; i++) cellen.push({ x: (i % kol) * w, y: Math.floor(i / kol) * h, w, h });
  return cellen;
}

// ------------------------------------------------------------------ host

export class RaceHost {
  constructor(app, deps) {
    this.app = app;
    this.d = deps;
    this.spelers = new Map();
    this.fase = 'lobby';
    this.opties = { modus: 'race', rondes: 2, maxUit: 0, arcade: true, scherm: 'split', ...opslag.lees('raceopties', {}) };
    this.ws = null;
    this.code = null;
    this.statusT = 0;
    this.standT = 0;
    this.camModus = 'leider';
    this.autoStartT = null;
    this.views = new Map();
    this.overzichtCam = new THREE.PerspectiveCamera(48, 1, 0.1, 900);
    this.overzichtPos = new THREE.Vector3();
    this.overzichtKijk = new THREE.Vector3();
    this.wereldGroep = new THREE.Group();
    this.d.wereld.scene.add(this.wereldGroep);
    this.pools = {};
  }

  // ---------------------------------------------------------------- verbinding

  open() {
    this.fase = 'lobby';
    this.bouwUI();
    this.verbind();
  }

  verbind() {
    if (this.ws) { try { this.ws.close(); } catch { /* */ } }
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    let ws;
    try { ws = new WebSocket(url); } catch { this.zetStatus('Kan geen verbinding maken met de server.', true); return; }
    this.ws = ws;
    this.zetStatus('Verbinden met de server…');
    ws.onopen = () => {
      let oud = null;
      try { oud = JSON.parse(sessionStorage.getItem('marbletycoon.racekamer') || 'null'); } catch { /* */ }
      ws.send(JSON.stringify({ t: 'maak', code: oud?.code, sleutel: oud?.sleutel }));
    };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      this.bericht(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.app.modus === 'race') {
        this.zetStatus('Verbinding verbroken. Opnieuw verbinden…', true);
        setTimeout(() => { if (this.app.modus === 'race' && !this.ws) this.verbind(); }, 2000);
      }
    };
  }

  stuur(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  naar(id, d) { this.stuur({ t: 'naar', id, d }); }
  allen(d) { this.stuur({ t: 'allen', d }); }

  bericht(m) {
    switch (m.t) {
      case 'kamer':
        this.code = m.code;
        try { sessionStorage.setItem('marbletycoon.racekamer', JSON.stringify({ code: m.code, sleutel: m.sleutel })); } catch { /* */ }
        this.toonQR();
        this.zetStatus('Scan de QR-code met je telefoon om mee te doen.');
        break;
      case 'speler': {
        let sp = this.spelers.get(m.id);
        if (!sp) {
          const vrij = LABEL_KLEUREN.find((k) => ![...this.spelers.values()].some((s) => s.kleur === k)) || LABEL_KLEUREN[this.spelers.size % LABEL_KLEUREN.length];
          sp = { id: m.id, naam: m.naam, skin: m.skin, klaar: false, verbonden: true, gas: 0, rem: false, kleur: vrij };
          this.spelers.set(m.id, sp);
          geluid.aansluiten();
        }
        sp.naam = m.naam; sp.skin = SKIN_MAP.has(m.skin) ? m.skin : 'kattenoog'; sp.verbonden = m.verbonden !== false;
        this.naar(sp.id, { t: 'kleur', kleur: sp.kleur, fase: this.fase === 'race' && sp.kn ? 'race' : 'lobby', regels: this.regels() });
        if (this.fase === 'race' && sp.kn) this.naar(sp.id, { t: 'go', regels: this.regels() });
        if (sp.label) this.tekenLabel(sp, sp.kn ? sp.kn.plek : '');
        this.werkLobbyBij();
        break;
      }
      case 'speler_weg': {
        const sp = this.spelers.get(m.id);
        if (sp) { sp.verbonden = false; sp.gas = 0; sp.rem = false; sp.klaar = false; }
        this.werkLobbyBij();
        break;
      }
      case 'van': {
        const sp = this.spelers.get(m.id);
        if (!sp) return;
        const d = m.d || {};
        if (d.t === 'gas') sp.gas = Math.min(1, Math.max(0, Number(d.w) || 0));
        else if (d.t === 'rem') sp.rem = !!d.aan;
        else if (d.t === 'gebruik') { if (sp.kn) this.d.sim.gebruikItem(sp.kn); }
        else if (d.t === 'klaar') { sp.klaar = !!d.klaar; this.werkLobbyBij(); if (sp.klaar) geluid.klik(); }
        break;
      }
      case 'overgenomen':
        this.zetStatus('Deze race is in een ander venster geopend.', true);
        this.ws = null;
        break;
      case 'fout':
        this.zetStatus(m.melding || 'Er ging iets mis.', true);
        break;
      default:
    }
  }

  regels() {
    const o = this.opties;
    return { modus: o.modus, rondes: o.modus === 'lms' ? 0 : o.rondes, maxUit: o.modus === 'lms' ? Math.max(1, o.maxUit || 1) : o.maxUit, arcade: !!o.arcade };
  }

  // ---------------------------------------------------------------- lobby

  bouwUI() {
    const { el, knop, icoon } = this.d.ui;
    document.getElementById('race')?.remove();
    this.qr = el('div', { klasse: 'qr' }, el('div', { klasse: 'qrleeg', tekst: '…' }));
    this.codeVak = el('div', { klasse: 'kamercode', tekst: '····' });
    this.linkVak = el('div', { klasse: 'kamerlink' });
    this.spelerLijst = el('div', { klasse: 'spelerlijst' });
    this.statusVak = el('p', { klasse: 'racestatus' });
    this.startKnop = knop('Start de race', 'vlag', () => this.start(), { klasse: 'primair groot' });
    const o = this.opties;
    const bewaar = () => { opslag.schrijf('raceopties', this.opties); this.werkRegelsBij(); };
    const segment = (sleutel, keuzes) => {
      const s = el('div', { klasse: 'segment' }, ...keuzes.map(([w, n]) => {
        const b = el('button', { klasse: 'seg', type: 'button', onclick: () => { o[sleutel] = w; geluid.klik(); bewaar(); } }, n);
        b.dataset.w = String(w);
        return b;
      }));
      s.dataset.sleutel = sleutel;
      return s;
    };
    this.regelVak = el('div', { klasse: 'regels' },
      el('h3', { tekst: 'Spelregels' }),
      segment('modus', [['race', 'Race'], ['lms', 'Last man standing']]),
      el('div', { klasse: 'regelrij' }, el('span', { klasse: 'regelnaam', tekst: 'Rondes' }), segment('rondes', [[1, '1'], [2, '2'], [3, '3'], [5, '5']])),
      el('div', { klasse: 'regelrij' }, el('span', { klasse: 'regelnaam uitnaam', tekst: 'Max. keer uit de bocht' }), segment('maxUit', [[0, '∞'], [1, '1'], [2, '2'], [3, '3'], [5, '5']])),
      el('label', { klasse: 'vinkje' }, el('input', { type: 'checkbox', checked: !!o.arcade, onchange: (e) => { o.arcade = e.target.checked; bewaar(); } }), 'Arcade: power-ups op de baan'),
      el('div', { klasse: 'regelrij' }, el('span', { klasse: 'regelnaam', tekst: 'Scherm' }), segment('scherm', [['split', 'Splitscreen'], ['overzicht', 'Eén groot beeld']])),
      el('p', { klasse: 'uitleg regeluitleg' }),
    );
    this.lobby = el('div', { klasse: 'racelobby paneel-glas' },
      el('div', { klasse: 'lobbykop' }, icoon('vlag'), el('h2', { tekst: 'Race' })),
      el('div', { klasse: 'lobbyrij' },
        el('div', { klasse: 'qrvak' }, this.qr, el('p', { klasse: 'sub', tekst: 'Scan om mee te doen' }), this.codeVak, this.linkVak),
        el('div', { klasse: 'lobbyrechts' },
          el('h3', { tekst: 'Spelers' }), this.spelerLijst,
          this.regelVak,
          this.statusVak, this.startKnop,
        ),
      ),
    );
    this.stand = el('div', { klasse: 'racestand paneel-glas', hidden: true });
    this.aftel = el('div', { klasse: 'aftellen', hidden: true });
    this.uitslag = el('div', { klasse: 'uitslag paneel-glas', hidden: true });
    this.splitVak = el('div', { klasse: 'splitscreen', hidden: true });
    this.raceKnoppen = el('div', { klasse: 'raceknoppen paneel-glas', hidden: true },
      knop('Splitscreen', 'community', () => { this.opties.scherm = 'split'; opslag.schrijf('raceopties', this.opties); this.werkKnoppenBij(); }),
      knop('Eén beeld', 'oog', () => { this.opties.scherm = 'overzicht'; this.camModus = 'leider'; opslag.schrijf('raceopties', this.opties); this.werkKnoppenBij(); }),
      knop('Vrije camera', 'baan', () => { this.opties.scherm = 'overzicht'; this.camModus = 'vrij'; this.d.cam.volg = null; this.werkKnoppenBij(); }),
      knop('Stop race', 'sluit', () => this.naarLobby()),
    );
    this.melding = el('div', { klasse: 'racemelding', hidden: true });
    this.wortel = el('div', { id: 'race' }, this.splitVak, this.lobby, this.stand, this.aftel, this.melding, this.uitslag, this.raceKnoppen);
    document.getElementById('ui').append(this.wortel);
    this.werkRegelsBij();
    this.werkLobbyBij();
  }

  werkRegelsBij() {
    const o = this.opties;
    if (o.modus === 'lms' && !o.maxUit) o.maxUit = 1;
    for (const seg of this.regelVak.querySelectorAll('.segment')) {
      const sl = seg.dataset.sleutel;
      for (const b of seg.querySelectorAll('.seg')) {
        b.classList.toggle('actief', String(o[sl]) === b.dataset.w);
        if (sl === 'maxUit' && b.dataset.w === '0') b.classList.toggle('uit', o.modus === 'lms');
      }
    }
    const rondeRij = this.regelVak.querySelector('.segment[data-sleutel="rondes"]').parentNode;
    rondeRij.hidden = o.modus === 'lms';
    this.regelVak.querySelector('.uitnaam').textContent = o.modus === 'lms' ? 'Levens' : 'Max. keer uit de bocht';
    const uitleg = o.modus === 'lms'
      ? `Last man standing: rijden tot er nog één over is. Elke keer uit de bocht kost een leven (${o.maxUit} per speler). Elke ronde wordt de baan gladder.`
      : `Race: wie het eerst ${o.rondes === 1 ? '1 ronde' : o.rondes + ' rondes'} rijdt, wint.` + (o.maxUit ? ` Na ${o.maxUit}× uit de bocht lig je eruit.` : ' Uit de bocht vliegen kost alleen tijd.');
    this.regelVak.querySelector('.regeluitleg').textContent = uitleg + (o.arcade ? ' Met power-ups uit de ?-dozen: bananenschil, boost, rode en blauwe schelp.' : '');
  }

  werkKnoppenBij() {
    const [a, b, c] = this.raceKnoppen.querySelectorAll('.knop');
    a.classList.toggle('actief', this.opties.scherm === 'split');
    b.classList.toggle('actief', this.opties.scherm !== 'split' && this.camModus === 'leider');
    c.classList.toggle('actief', this.opties.scherm !== 'split' && this.camModus === 'vrij');
    this.stand.hidden = this.opties.scherm === 'split' || this.fase !== 'race';
    this.splitVak.hidden = this.opties.scherm !== 'split' || this.fase === 'lobby';
  }

  toonQR() {
    const url = location.origin + location.pathname.replace(/[^/]*$/, '') + 'bediening.html?k=' + this.code;
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const img = new Image();
    img.src = qr.createDataURL(6, 2);
    img.alt = 'QR-code om mee te doen';
    this.qr.replaceChildren(img);
    this.codeVak.textContent = this.code;
    this.linkVak.textContent = url.replace(/^https?:\/\//, '');
  }

  zetStatus(t, fout) {
    if (!this.statusVak) return;
    this.statusVak.textContent = t;
    this.statusVak.classList.toggle('fout', !!fout);
  }

  werkLobbyBij() {
    if (!this.spelerLijst) return;
    const { el } = this.d.ui;
    const lijst = [...this.spelers.values()];
    this.spelerLijst.replaceChildren(...(lijst.length ? lijst.map((sp) => {
      const img = el('img', { klasse: 'skinbol', alt: '' });
      skinIkoon(sp.skin).then((u) => { img.src = u; });
      return el('div', { klasse: 'speler' + (sp.verbonden ? '' : ' weg') },
        img,
        el('span', { klasse: 'spelernaam', stijl: `border-color:${sp.kleur}`, tekst: sp.naam }),
        el('span', { klasse: 'klaar ' + (sp.klaar ? 'ja' : 'nee'), tekst: !sp.verbonden ? 'weg' : sp.klaar ? 'Klaar' : 'wacht…' }),
        el('button', { klasse: 'mini-knop', type: 'button', title: 'Verwijderen', onclick: () => { this.stuur({ t: 'kick', id: sp.id }); this.spelers.delete(sp.id); this.werkLobbyBij(); } }, '✕'),
      );
    }) : [el('p', { klasse: 'leeg', tekst: 'Nog niemand. Scan de QR-code!' })]));
    const actief = lijst.filter((s) => s.verbonden);
    const allemaalKlaar = actief.length > 0 && actief.every((s) => s.klaar);
    this.startKnop.disabled = !actief.length;
    if (this.fase === 'lobby') {
      if (allemaalKlaar && !this.autoStartT) {
        this.autoStartT = setTimeout(() => { this.autoStartT = null; if (this.fase === 'lobby') this.start(); }, 2500);
        this.zetStatus('Iedereen is klaar. De race begint zo!');
      } else if (!allemaalKlaar) {
        if (this.autoStartT) { clearTimeout(this.autoStartT); this.autoStartT = null; }
        if (this.code) this.zetStatus(actief.length ? 'Wachten tot iedereen op Klaar drukt (of start zelf).' : 'Scan de QR-code met je telefoon om mee te doen.');
      }
    }
  }

  // ---------------------------------------------------------------- race

  start() {
    if (this.autoStartT) { clearTimeout(this.autoStartT); this.autoStartT = null; }
    const actief = [...this.spelers.values()].filter((s) => s.verbonden);
    if (!actief.length) { this.d.melding('Er doet nog niemand mee.', 'fout'); return; }
    const keten = this.app.info.ketens[0];
    if (!keten || !keten.start || keten.stukken.length < 3) { this.d.melding('Bouw eerst een langere baan vanaf het startpunt.', 'fout'); return; }
    this.fase = 'race';
    for (const sp of this.spelers.values()) { sp.gas = 0; sp.rem = false; sp.kn = null; }
    const regels = this.regels();
    this.d.startRace(actief, regels);
    this.d.sim.knikkers.forEach((kn, i) => { kn.speler.kn = kn; kn.speler.index = i; kn.plek = i + 1; });
    this.lobby.hidden = true;
    this.uitslag.hidden = true;
    this.raceKnoppen.hidden = false;
    this.camModus = 'leider';
    this.d.cam.afstand = 16;
    this.d.wereld.camera.layers.enableAll();
    this.maakViews();
    this.maakLabels();
    this.werkKnoppenBij();
    this.allen({ t: 'aftel', n: 3, regels });
    this.toonAftel('3');
  }

  toonAftel(t) {
    this.aftel.hidden = false;
    this.aftel.textContent = t;
    this.aftel.classList.remove('pop');
    void this.aftel.offsetWidth;
    this.aftel.classList.add('pop');
    clearTimeout(this.aftelT);
    this.aftelT = setTimeout(() => { this.aftel.hidden = true; }, t === 'GO!' ? 900 : 1100);
  }

  toonMelding(t, kleur) {
    this.melding.textContent = t;
    this.melding.style.color = kleur || '';
    this.melding.hidden = false;
    this.melding.classList.remove('pop'); void this.melding.offsetWidth; this.melding.classList.add('pop');
    clearTimeout(this.meldingT);
    this.meldingT = setTimeout(() => { this.melding.hidden = true; }, 2200);
  }

  celMelding(sp, tekst, soort) {
    const v = this.views.get(sp.id);
    if (!v || !v.melding) return;
    v.melding.textContent = tekst;
    v.melding.className = 'celmelding ' + (soort || '');
    void v.melding.offsetWidth;
    v.melding.classList.add('pop');
    clearTimeout(v.meldingT);
    v.meldingT = setTimeout(() => { v.melding.textContent = ''; }, 1800);
  }

  gebeurtenis(soort, kn, extra) {
    const sp = kn && kn.speler;
    switch (soort) {
      case 'aftel': this.toonAftel(String(extra)); this.allen({ t: 'aftel', n: extra, regels: this.regels() }); break;
      case 'go': this.toonAftel('GO!'); this.allen({ t: 'go', regels: this.regels() }); break;
      case 'eruit':
        if (sp) { this.naar(sp.id, { t: 'eruit', keer: kn.uitgevlogen }); this.celMelding(sp, 'Uit de bocht!', 'rood'); }
        break;
      case 'terug': if (sp) this.naar(sp.id, { t: 'terug' }); break;
      case 'ronde': if (sp) { this.naar(sp.id, { t: 'ronde', ronde: kn.ronde + 1, tijd: extra }); this.celMelding(sp, 'Ronde ' + (kn.ronde + 1), 'groen'); } break;
      case 'raceFinish':
        if (sp) { this.naar(sp.id, { t: 'finish', plek: extra, tijd: kn.finishTijd }); this.celMelding(sp, extra === 1 ? 'Gewonnen!' : `Finish: ${extra}e`, 'groen'); }
        geluid.finish();
        break;
      case 'uitgeschakeld':
        if (sp) { this.naar(sp.id, { t: 'uitgeschakeld' }); this.toonMelding(`${sp.naam} ligt eruit!`, '#ff8a7a'); }
        geluid.eruit();
        break;
      case 'winnaar': if (sp) this.toonMelding(`${sp.naam} wint!`, '#ffd85a'); break;
      case 'gladder': this.toonMelding('De baan wordt gladder!', '#9fdcff'); this.allen({ t: 'gladder', grip: extra }); break;
      case 'itemRol': if (sp) { this.naar(sp.id, { t: 'itemRol', item: extra }); geluid.klik(); } break;
      case 'itemKlaar': if (sp) this.naar(sp.id, { t: 'item', item: extra }); break;
      case 'itemGebruikt':
        if (sp) { this.naar(sp.id, { t: 'item', item: null, gebruikt: extra }); }
        if (extra === 'boost') geluid.boost();
        else if (extra === 'blauw') { geluid.launch(); this.toonMelding(`${sp.naam} gooit een blauwe schelp!`, '#7fb2ff'); }
        else geluid.decor();
        break;
      case 'geraakt':
        if (sp) {
          this.naar(sp.id, { t: 'geraakt', door: extra });
          this.celMelding(sp, { banaan: 'Bananenschil!', rood: 'Rode schelp!', blauw: 'Blauwe schelp!' }[extra] || 'Geraakt!', 'rood');
        }
        geluid.eruit();
        break;
      case 'raceKlaar': this.toonUitslag(); break;
      default:
    }
  }

  // ---------------------------------------------------------------- naamlabels (3D, zichtbaar in elk schermpje)

  maakLabels() {
    for (const kn of this.d.sim.knikkers) {
      const sp = kn.speler;
      if (sp.label) { this.wereldGroep.remove(sp.label); sp.label.material.map.dispose(); sp.label.material.dispose(); }
      const c = document.createElement('canvas');
      c.width = 320; c.height = 80;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, sizeAttenuation: false, transparent: true });
      const s = new THREE.Sprite(mat);
      s.scale.set(0.2, 0.05, 1);
      s.center.set(0.5, 0);
      s.renderOrder = 60;
      s.layers.set(LAAG(sp.index));
      sp.label = s;
      sp.labelCanvas = c;
      sp.labelTekst = '';
      this.wereldGroep.add(s);
      this.tekenLabel(sp, kn.plek);
    }
  }

  tekenLabel(sp, plek, gevaar = false) {
    const sleutel = `${plek}|${sp.naam}|${gevaar}`;
    if (sp.labelTekst === sleutel) return;
    sp.labelTekst = sleutel;
    const c = sp.labelCanvas, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.font = '800 34px system-ui, sans-serif';
    const tw = Math.min(220, g.measureText(sp.naam).width);
    const w = tw + 84, x0 = (c.width - w) / 2;
    g.fillStyle = 'rgba(12,18,27,.88)';
    g.strokeStyle = gevaar ? '#ff3b30' : sp.kleur;
    g.lineWidth = 6;
    g.beginPath(); g.roundRect(x0 + 3, 8, w - 6, 64, 32); g.fill(); g.stroke();
    g.fillStyle = sp.kleur;
    g.beginPath(); g.arc(x0 + 38, 40, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0d1219'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(plek || ''), x0 + 38, 42);
    g.fillStyle = '#fff'; g.textAlign = 'left';
    g.fillText(sp.naam, x0 + 68, 42, 220);
    sp.label.material.map.needsUpdate = true;
  }

  // ---------------------------------------------------------------- schermpjes per speler

  maakViews() {
    const { el } = this.d.ui;
    this.views.clear();
    this.splitVak.replaceChildren();
    for (const kn of this.d.sim.knikkers) {
      const sp = kn.speler;
      const cam = new THREE.PerspectiveCamera(58, 1, 0.05, 700);
      cam.layers.enableAll();
      cam.layers.disable(LAAG(sp.index));
      const naam = el('span', { klasse: 'celnaam', tekst: sp.naam });
      const plek = el('b', { klasse: 'celplek', tekst: '1' });
      const info = el('span', { klasse: 'celinfo' });
      const item = el('span', { klasse: 'celitem' });
      const melding = el('div', { klasse: 'celmelding' });
      const sluier = el('div', { klasse: 'celsluier', hidden: true });
      const cel = el('div', { klasse: 'cel', stijl: `--kleur:${sp.kleur}` },
        el('div', { klasse: 'celkop' }, plek, naam, info, item), melding, sluier);
      this.splitVak.append(cel);
      const start = kn.pos.clone();
      this.views.set(sp.id, { cam, pos: start.clone().add(new THREE.Vector3(-3, 2, 0)), kijk: start.clone(), richting: new THREE.Vector3(1, 0, 0), cel, naam, plek, info, item, melding, sluier, laatsteItem: '' });
    }
    const leeg = el('div', { klasse: 'cel overzichtcel' }, el('div', { klasse: 'celkop' }, el('span', { klasse: 'celnaam', tekst: 'Overzicht' })), el('div', { klasse: 'ministand' }));
    this.splitVak.append(leeg);
    this.overzichtCel = leeg;
  }

  werkCameraBij(v, kn, dt) {
    const doel = kn.toestand === 'uit' ? this.d.sim.leider()?.pos || kn.pos : kn.pos;
    const t = kn.toestand === 'baan' && kn.tan ? kn.tan : kn.vel.lengthSq() > 0.01 ? kn.vel.clone().normalize() : v.richting;
    // achteruit rollen: de camera blijft gewoon achter de rijrichting van de baan
    v.richting.lerp(new THREE.Vector3(t.x, t.y * 0.35, t.z), 1 - Math.exp(-dt * 3)).normalize();
    const wens = doel.clone().addScaledVector(v.richting, -3.1);
    wens.y = Math.max(wens.y + 1.55, doel.y + 0.9);
    v.pos.lerp(wens, 1 - Math.exp(-dt * 4.5));
    v.kijk.lerp(doel.clone().addScaledVector(v.richting, 1.4), 1 - Math.exp(-dt * 7));
    v.cam.position.copy(v.pos);
    v.cam.lookAt(v.kijk);
  }

  frame(dt) {
    if (this.fase !== 'race' && this.fase !== 'uitslag') return;
    const sim = this.d.sim;
    const r = sim.race;
    const stand = sim.stand();
    stand.forEach((kn, i) => { kn.plek = i + 1; });
    for (const kn of sim.knikkers) {
      const sp = kn.speler;
      if (sp.label) {
        const zicht = kn.toestand !== 'uit' && kn.toestand !== 'wacht';
        sp.label.visible = zicht;
        sp.label.position.copy(kn.pos);
        sp.label.position.y += 0.3;
        this.tekenLabel(sp, kn.plek, kn.gevaar > 0.8);
      }
      const v = this.views.get(sp.id);
      if (v) this.werkCameraBij(v, kn, dt);
    }
    if (this.opties.scherm !== 'split' && this.camModus === 'leider' && stand.length) {
      const leider = stand.find((k) => !k.gefinisht && !k.uitgeschakeld && (k.toestand === 'baan' || k.toestand === 'vrij')) || stand[0];
      this.d.cam.volg = () => leider.pos;
    }
    this.werkItemsBij(dt);
    this.statusT += dt;
    if (this.statusT > 0.08) {
      this.statusT = 0;
      for (const kn of sim.knikkers) {
        const sp = kn.speler;
        this.naar(sp.id, {
          t: 'status', plek: kn.plek, van: stand.length,
          ronde: Math.min(kn.ronde + 1, r?.rondes || 1), rondes: r?.modus === 'lms' ? 0 : r?.rondes || 1,
          v: kn.uitgeschakeld ? 0 : Math.round(Math.abs(kn.v) * KMU) * (kn.v < -0.3 ? -1 : 1), g: kn.uitgeschakeld ? 0 : Math.round(Math.min(1.5, kn.gevaar) * 100) / 100,
          uit: kn.toestand === 'vrij', keer: kn.uitgevlogen, max: r?.maxUit || 0,
          item: kn.itemRol > 0 ? null : kn.item, rol: kn.itemRol > 0, weg: !!kn.uitgeschakeld, binnen: !!kn.gefinisht,
        });
      }
    }
    this.standT += dt;
    if (this.standT > 0.2) { this.standT = 0; this.werkStandBij(stand); this.werkCellenBij(stand); }
    for (const kn of sim.knikkers) {
      const v = this.views.get(kn.speler.id);
      if (v) v.cel.classList.toggle('gevaar', kn.gevaar > 0.75 && kn.toestand === 'baan');
    }
  }

  werkCellenBij(stand) {
    const r = this.d.sim.race;
    for (const kn of this.d.sim.knikkers) {
      const v = this.views.get(kn.speler.id);
      if (!v) continue;
      v.plek.textContent = kn.plek;
      const delen = [];
      if (r?.modus === 'lms') delen.push('♥'.repeat(Math.max(0, r.maxUit - kn.uitgevlogen)) + '♡'.repeat(Math.min(r.maxUit, kn.uitgevlogen)));
      else delen.push(`R${Math.min(kn.ronde + 1, r?.rondes || 1)}/${r?.rondes || 1}`);
      if (r?.modus === 'race' && r.maxUit) delen.push(`${kn.uitgevlogen}/${r.maxUit} eruit`);
      if (!kn.uitgeschakeld) delen.push(`${Math.round(Math.abs(kn.v) * KMU)} km/u${kn.v < -0.3 ? ' ↩' : ''}`);
      v.info.textContent = delen.join(' · ');
      const item = kn.itemRol > 0 ? 'rol' : kn.item || '';
      if (item !== v.laatsteItem) {
        v.laatsteItem = item;
        v.item.innerHTML = item === 'rol' ? '<span class="rolt">?</span>' : item ? ITEM_SVG[item] : '';
        v.item.title = item && item !== 'rol' ? ITEM_NAAM[item] : '';
      }
      const weg = kn.uitgeschakeld && kn.toestand === 'uit';
      v.sluier.hidden = !(weg || kn.gefinisht);
      if (weg) v.sluier.textContent = 'Uitgeschakeld · je kijkt mee met de koploper';
      else if (kn.gefinisht) v.sluier.textContent = `Finish! ${kn.plek}e plaats`;
    }
    const mini = this.overzichtCel?.querySelector('.ministand');
    if (mini) {
      mini.replaceChildren(...stand.map((kn, i) => {
        const d = document.createElement('div');
        d.className = 'ministandregel' + (kn.uitgeschakeld ? ' weg' : '');
        d.style.setProperty('--kleur', kn.speler.kleur);
        d.textContent = `${i + 1}. ${kn.speler.naam}`;
        return d;
      }));
    }
  }

  // Tekent het splitscreen; geeft false terug als het gewone beeld getekend moet worden.
  render() {
    if (this.fase === 'lobby' || this.opties.scherm !== 'split' || !this.views.size) return false;
    const w = this.d.wereld;
    const renderer = w.renderer;
    const canvas = w.canvas;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const n = this.views.size;
    const cellen = indeling(n, W, H);
    const lijst = [...this.d.sim.knikkers];
    // schaduwen één keer per beeld berekenen, rond alle knikkers
    const midden = new THREE.Vector3();
    for (const kn of lijst) midden.add(kn.pos);
    midden.divideScalar(Math.max(1, lijst.length));
    let spreiding = 0;
    for (const kn of lijst) spreiding = Math.max(spreiding, kn.pos.distanceTo(midden));
    w.volgZon(midden, spreiding * 1.4 + 26);
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.setScissorTest(true);
    const toon = (cel, cam) => {
      const y = H - cel.y - cel.h;
      renderer.setViewport(cel.x, y, cel.w, cel.h);
      renderer.setScissor(cel.x, y, cel.w, cel.h);
      cam.aspect = cel.w / cel.h;
      cam.updateProjectionMatrix();
      renderer.render(w.scene, cam);
      renderer.shadowMap.needsUpdate = false;
    };
    lijst.forEach((kn, i) => {
      const v = this.views.get(kn.speler.id);
      const cel = cellen[i];
      if (!v || !cel) return;
      toon(cel, v.cam);
      Object.assign(v.cel.style, { left: cel.x + 'px', top: cel.y + 'px', width: cel.w + 'px', height: cel.h + 'px', display: '' });
    });
    // lege cel: overzicht vanaf de koploper
    const vrij = cellen[n];
    if (vrij && this.overzichtCel) {
      const leider = this.d.sim.leider() || lijst[0];
      if (leider) {
        const doel = leider.pos;
        this.overzichtKijk.lerp(doel, 0.08);
        this.overzichtPos.lerp(doel.clone().add(new THREE.Vector3(-9, 9, -9)), 0.05);
        this.overzichtCam.position.copy(this.overzichtPos);
        this.overzichtCam.lookAt(this.overzichtKijk);
        this.overzichtCam.layers.enableAll();
        toon(vrij, this.overzichtCam);
      }
      Object.assign(this.overzichtCel.style, { left: vrij.x + 'px', top: vrij.y + 'px', width: vrij.w + 'px', height: vrij.h + 'px', display: '' });
    } else if (this.overzichtCel) this.overzichtCel.style.display = 'none';
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
    renderer.shadowMap.autoUpdate = true;
    return true;
  }

  // ---------------------------------------------------------------- power-ups in beeld

  pool(soort, i, maak) {
    const p = this.pools[soort] || (this.pools[soort] = []);
    while (p.length <= i) { const o = maak(); this.wereldGroep.add(o); p.push(o); }
    return p[i];
  }

  verbergVanaf(soort, n) {
    const p = this.pools[soort] || [];
    for (let i = n; i < p.length; i++) p[i].visible = false;
  }

  werkItemsBij(dt) {
    const sim = this.d.sim;
    const r = sim.race;
    if (!r) { for (const p of Object.values(this.pools)) p.forEach((o) => { o.visible = false; }); return; }
    const t = performance.now() / 1000;
    const p = {};
    r.dozen.forEach((d, i) => {
      const o = this.pool('doos', i, () => model('doos'));
      const q = sim.puntOpBaan(d.s, p);
      o.position.set(q.px + q.ux * 0.24, q.py + q.uy * 0.24 + Math.sin(t * 3 + i) * 0.03, q.pz + q.uz * 0.24);
      o.rotation.set(0.5, t * 1.6 + i, 0.3);
      const doelSchaal = d.actief ? 1 : 0.001;
      o.scale.setScalar(o.scale.x + (doelSchaal - o.scale.x) * Math.min(1, dt * 8));
      o.visible = o.scale.x > 0.02;
    });
    this.verbergVanaf('doos', r.dozen.length);
    r.bananen.forEach((b, i) => {
      const o = this.pool('banaan', i, () => model('banaan'));
      const q = sim.puntOpBaan(b.s, p);
      o.position.set(q.px - q.ux * 0.14, q.py - q.uy * 0.14, q.pz - q.uz * 0.14);
      o.rotation.y = i * 2.1;
      o.scale.setScalar(0.95);
      o.visible = true;
    });
    this.verbergVanaf('banaan', r.bananen.length);
    let nr = 0, nb = 0;
    for (const sc of r.schelpen) {
      if (!sc.pos) continue;
      const o = sc.soort === 'rood' ? this.pool('rood', nr++, () => model('rood')) : this.pool('blauw', nb++, () => model('blauw'));
      o.position.copy(sc.pos);
      if (sc.soort === 'rood') o.position.y -= 0.12;
      o.rotation.y = t * 14;
      o.scale.setScalar(sc.soort === 'blauw' ? 1.6 : 1.2);
      o.visible = true;
    }
    this.verbergVanaf('rood', nr);
    this.verbergVanaf('blauw', nb);
    r.explosies.forEach((e, i) => {
      const o = this.pool('knal', i, () => gloed(0xffffff));
      o.material.color.setHex(e.kleur);
      o.position.copy(e.pos);
      const s = (e.groot ? 4 : 1.6) * (0.3 + e.t * 2);
      o.scale.set(s, s, 1);
      o.material.opacity = Math.max(0, 1 - e.t / 0.8);
      o.visible = true;
    });
    this.verbergVanaf('knal', r.explosies.length);
    let nboost = 0;
    for (const kn of sim.knikkers) {
      if (kn.boostT > 0 && kn.toestand === 'baan') {
        const o = this.pool('boost', nboost++, () => gloed(0xff9a2a));
        o.position.copy(kn.pos).addScaledVector(kn.tan || new THREE.Vector3(), -0.22);
        const s = 0.5 + Math.sin(t * 40) * 0.1;
        o.scale.set(s, s, 1);
        o.material.opacity = 0.9;
        o.visible = true;
      }
    }
    this.verbergVanaf('boost', nboost);
  }

  // ---------------------------------------------------------------- stand en uitslag

  werkStandBij(stand) {
    const { el } = this.d.ui;
    const sim = this.d.sim;
    const r = sim.race;
    const titel = r?.fase === 'aftellen' ? 'Klaar voor de start…' : r?.modus === 'lms' ? `Last man standing${r.grip < 1 ? ' · grip ' + Math.round(r.grip * 100) + '%' : ''}` : `Stand · ${r?.rondes === 1 ? '1 ronde' : (r?.rondes || 1) + ' rondes'}`;
    this.stand.replaceChildren(
      el('h3', { tekst: titel }),
      ...stand.map((kn, i) => el('div', { klasse: 'standregel' + (kn.gefinisht ? ' binnen' : '') + (kn.toestand === 'vrij' ? ' eruit' : '') + (kn.uitgeschakeld ? ' weg' : '') },
        el('b', { klasse: 'plek', tekst: i + 1 }),
        el('span', { klasse: 'spelernaam', stijl: `border-color:${kn.speler.kleur}`, tekst: kn.speler.naam }),
        el('span', { klasse: 'rondeinfo', tekst: kn.uitgeschakeld ? 'eruit' : kn.gefinisht ? formatTijd(kn.finishTijd) : kn.toestand === 'vrij' ? 'uit de bocht!' : (r?.modus === 'lms' ? '♥'.repeat(Math.max(0, r.maxUit - kn.uitgevlogen)) : `R${Math.min(kn.ronde + 1, r?.rondes || 1)}`) + ` · ${Math.round(Math.abs(kn.v) * KMU)} km/u` }),
      )),
    );
  }

  toonUitslag() {
    const { el, knop } = this.d.ui;
    this.fase = 'uitslag';
    const r = this.d.sim.race;
    const stand = this.d.sim.stand();
    const lijst = stand.map((kn, i) => ({
      plek: i + 1, naam: kn.speler.naam,
      tijd: kn.gefinisht ? kn.finishTijd : null,
      weg: !!kn.uitgeschakeld, ronde: kn.ronde + 1,
      beste: kn.besteRonde < Infinity ? kn.besteRonde : null, eruit: kn.uitgevlogen,
    }));
    this.allen({ t: 'uitslag', lijst, modus: r?.modus });
    const regel = (x) => x.tijd !== null ? formatTijd(x.tijd) : r?.modus === 'lms' ? (x.plek === 1 ? `overleefd (${formatTijd(r.eindTijd || 0)})` : `eruit in ronde ${x.ronde}`) : x.weg ? 'uitgeschakeld' : '—';
    this.uitslag.replaceChildren(
      el('h2', { tekst: r?.modus === 'lms' ? 'Last man standing' : 'Uitslag' }),
      el('div', { klasse: 'podium' }, ...lijst.slice(0, 3).map((x) => el('div', { klasse: 'podiumplek p' + x.plek }, el('div', { klasse: 'podiumnaam', tekst: x.naam }), el('div', { klasse: 'podiumblok', tekst: x.plek })))),
      el('table', { klasse: 'uitslaglijst' }, ...lijst.map((x) => el('tr', {}, el('td', { tekst: x.plek + '.' }), el('td', { tekst: x.naam }), el('td', { tekst: regel(x) }), el('td', { tekst: x.beste !== null ? 'snelste ronde ' + formatTijd(x.beste) : '' }), el('td', { tekst: x.eruit ? x.eruit + '× eruit' : '' })))),
      el('div', { klasse: 'knoppenrij' }, knop('Nog een keer', 'vlag', () => this.naarLobby(true), { klasse: 'primair' }), knop('Terug naar lobby', 'community', () => this.naarLobby())),
    );
    this.uitslag.hidden = false;
    this.stand.hidden = true;
  }

  opruimenRace() {
    this.d.sim.stopRace();
    for (const sp of this.spelers.values()) {
      if (sp.label) { this.wereldGroep.remove(sp.label); sp.label.material.map.dispose(); sp.label.material.dispose(); sp.label = null; }
    }
    for (const p of Object.values(this.pools)) p.forEach((o) => { o.visible = false; });
    this.views.clear();
    this.splitVak.replaceChildren();
    this.splitVak.hidden = true;
  }

  naarLobby(meteen) {
    this.fase = 'lobby';
    this.opruimenRace();
    for (const sp of this.spelers.values()) { sp.klaar = !!meteen && sp.verbonden; sp.gas = 0; sp.rem = false; sp.kn = null; }
    this.allen({ t: 'lobby', klaar: !!meteen });
    this.lobby.hidden = false;
    this.stand.hidden = true;
    this.uitslag.hidden = true;
    this.raceKnoppen.hidden = true;
    this.aftel.hidden = true;
    this.melding.hidden = true;
    this.d.cam.volg = null;
    this.werkLobbyBij();
    if (meteen) this.start();
  }

  klik() {}

  stop() {
    if (this.autoStartT) { clearTimeout(this.autoStartT); this.autoStartT = null; }
    this.allen({ t: 'einde' });
    const ws = this.ws;
    this.ws = null;
    if (ws) setTimeout(() => { try { ws.close(); } catch { /* */ } }, 100);
    this.opruimenRace();
    this.wortel?.remove();
    this.d.cam.volg = null;
    this.fase = 'lobby';
  }
}

function formatTijd(s) {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return (m ? m + ':' + (r < 10 ? '0' : '') : '') + r.toFixed(2) + (m ? '' : ' s');
}
