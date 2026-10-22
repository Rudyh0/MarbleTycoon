// Marble Tycoon: opstarten, bouwlogica, speelmodus en de render-loop.

import * as THREE from '../lib/three.min.js';
import { TEGEL, NIVEAU, RASTER, MIN_START, MAX_NIVEAU, STANDAARD_KLEUR, STANDAARD_STEUN, EFFECT_STANDAARD, KMU, KNIKKER_R } from './config.js';
import { Wereld } from './wereld.js';
import { CameraBesturing } from './camera.js';
import { SOORTEN, ruimte, uitgang, koers, hellingMag, magOpBasis } from './stukken.js';
import { nieuweBaan, analyseer, controleer, maakStuk, startStuk, naarJSON, vanJSON, verschuif, draaiBaan, heleBaanGeldig, nieuwId, aansluitSleutel } from './baan.js';
import { BaanWeergave, bouwSpook, ruimOp, magazijnPositie } from './baanweergave.js';
import { DecorWeergave, decorSpook, ITEMS, DECOR_IDS } from './decor.js';
import { Simulatie } from './fysica.js';
import { skinMateriaal, KNIKKER_GEO, SKIN_MAP } from './knikkers.js';
import { initGeluid, geluid, instellingen as geluidInstellingen, zetVolume, rolGeluid } from './geluid.js';
import { opslag, bewaarBaan, laadBaan, nieuwBaanId } from './opslag.js';
import { maakUI } from './ui.js';
import { RaceHost } from './race.js';

const canvas = document.getElementById('scherm');
const wereld = new Wereld(canvas);
const cam = new CameraBesturing(wereld.camera, canvas);
const baanView = new BaanWeergave(wereld.scene);
const decorView = new DecorWeergave(wereld.scene);
const sim = new Simulatie();

// ------------------------------------------------------------------ instellingen

const STD_INSTELLINGEN = {
  geluid: true, volume: 0.7, bouwGeluid: true, spelGeluid: true, uiGeluid: true,
  schaduw: true, kwaliteit: 'normaal', raster: true, sfeer: 'nacht',
  camSnelheid: 1, camOmgekeerd: false, bouwer: '',
};
const inst = { ...STD_INSTELLINGEN, ...opslag.lees('instellingen', {}) };

function pasInstellingenToe() {
  geluidInstellingen.aan = inst.geluid;
  geluidInstellingen.volume = inst.volume;
  geluidInstellingen.bouw = inst.bouwGeluid;
  geluidInstellingen.spel = inst.spelGeluid;
  geluidInstellingen.ui = inst.uiGeluid;
  zetVolume();
  wereld.zetSchaduw(inst.schaduw);
  wereld.zetKwaliteit(inst.kwaliteit);
  wereld.zetSfeer(inst.sfeer);
  cam.snelheid = inst.camSnelheid;
  cam.omgekeerd = inst.camOmgekeerd;
  opslag.schrijf('instellingen', inst);
}

// ------------------------------------------------------------------ toestand

const app = {
  baan: nieuweBaan(),
  baanId: nieuwBaanId(),
  info: null,
  modus: 'bouwen',
  tool: 'start',
  keuze: { t: 'recht', lr: 'R', s: 0, fx: '', v: EFFECT_STANDAARD.boost, k: true, lv: EFFECT_STANDAARD.launch },
  kleur: STANDAARD_KLEUR,
  steun: STANDAARD_STEUN,
  verfDoel: 'baan',
  decorKeuze: null,
  decorRot: 0,
  decorHoogte: 0,
  decorSchaal: 1,
  cursor: null,
  selectie: null,
  verplaats: null,
  terug: [],
  vooruit: [],
  snelheid: 1,
  pauze: false,
  volg: false,
  inst,
  sim,
  cam,
  wereld,
};
window.marbleTycoon = app;
app.herbereken = (o) => herbereken(o);

let ui = null;
let race = null;

// ------------------------------------------------------------------ herberekenen na elke wijziging

let opslaanTimer = 0;
function herbereken(opties = {}) {
  if (startSpookObj && app.tool !== 'start' && !app.verplaats) startSpookObj.visible = false;
  if (decorSpookObj && app.tool !== 'decor') decorSpookObj.visible = false;
  app.info = analyseer(app.baan);
  baanView.update(app.baan, app.info);
  decorView.update(app.baan.decor);
  kiesCursor(opties.cursor);
  werkSpookBij();
  werkMarkersBij();
  ui?.werkBij();
  clearTimeout(opslaanTimer);
  opslaanTimer = setTimeout(() => opslag.schrijf('huidig', { id: app.baanId, data: naarJSON(app.baan) }), 600);
}

function zelfde(a, b) { return a && b && a.x === b.x && a.z === b.z && a.d === b.d && a.l === b.l; }

function kiesCursor(voorkeur) {
  const open = app.info.open;
  if (voorkeur) {
    const v = open.find((o) => zelfde(o, voorkeur));
    if (v) { app.cursor = v; return; }
  }
  if (app.cursor) {
    const v = open.find((o) => zelfde(o, app.cursor));
    if (v) { app.cursor = v; return; }
  }
  // standaard: het einde van de hoofdbaan, anders het laatst gebouwde open einde
  const hoofd = app.info.ketens[0];
  if (hoofd && hoofd.start) {
    const laatste = hoofd.stukken[hoofd.stukken.length - 1];
    const v = open.find((o) => o.van === laatste.id);
    if (v) { app.cursor = v; return; }
  }
  app.cursor = open.length ? open[open.length - 1] : null;
}

function werkMarkersBij() {
  const bouwen = app.modus === 'bouwen';
  baanView.toonOpenEinden(app.info.open, app.tool === 'baan' ? app.cursor : null, bouwen);
  wereld.raster.visible = bouwen && inst.raster;
}

function bewaarVoorTerug() {
  app.terug.push(JSON.stringify(naarJSON(app.baan)));
  if (app.terug.length > 80) app.terug.shift();
  app.vooruit = [];
}

function zetBaan(data, opties = {}) {
  app.baan = vanJSON(data, DECOR_IDS);
  app.selectie = null;
  app.cursor = null;
  if (!opties.houdGeschiedenis) { app.terug = []; app.vooruit = []; }
  app.tool = app.baan.start ? 'baan' : 'start';
  herbereken();
}

export function ongedaan() {
  if (!app.terug.length || app.modus !== 'bouwen') return;
  app.vooruit.push(JSON.stringify(naarJSON(app.baan)));
  const vorig = JSON.parse(app.terug.pop());
  const tool = app.tool;
  zetBaan(vorig, { houdGeschiedenis: true });
  if (app.baan.start && tool !== 'start') app.tool = tool;
  geluid.klik();
  herbereken();
}

export function opnieuw() {
  if (!app.vooruit.length || app.modus !== 'bouwen') return;
  app.terug.push(JSON.stringify(naarJSON(app.baan)));
  const tool = app.tool;
  zetBaan(JSON.parse(app.vooruit.pop()), { houdGeschiedenis: true });
  if (app.baan.start && tool !== 'start') app.tool = tool;
  geluid.klik();
  herbereken();
}

// ------------------------------------------------------------------ bouwen

let spook = null;
let spookOk = false;
let spookStuk = null;

function verwijderSpook() {
  if (spook) { wereld.scene.remove(spook); ruimOp(spook); spook = null; }
  baanView.toonTegels([], true);
}

function kandidaat() {
  if (!app.cursor) return null;
  const k = { ...app.keuze };
  // vaste stukken altijd vlak
  if (SOORTEN[k.t].vast && !SOORTEN[k.t].spiraal) k.s = 0;
  if (SOORTEN[k.t].spiraal) k.s = app.keuze.s >= 0 && app.keuze.s !== 0 ? 1 : -1;
  return maakStuk(app.cursor, k, app.kleur, app.steun);
}

export function keuzeGeldig(t, s = app.keuze.s) {
  // Kan dit stuk met deze helling op de cursor?
  const c = app.cursor;
  if (!c) return { ok: false, reden: 'Geen open einde om op verder te bouwen' };
  if (!magOpBasis(t, c.d % 2)) return { ok: false, reden: 'Kan niet op een diagonaal' };
  const def = SOORTEN[t];
  if (def.vast) return c.e === 0 ? { ok: true } : { ok: false, reden: 'Alleen vanaf een vlak stuk' };
  if (!hellingMag(t, c.e, s)) return { ok: false, reden: 'Die helling past hier niet' };
  return { ok: true };
}

function werkSpookBij() {
  verwijderSpook();
  spookStuk = null;
  if (app.modus !== 'bouwen' || app.tool !== 'baan' || !app.cursor) return;
  const vorige = SOORTEN[app.keuze.t];
  if (!vorige) return;
  // helling automatisch rechtzetten als die niet past (zoals RCT de knoppen grijs maakt)
  if (!vorige.vast && !hellingMag(app.keuze.t, app.cursor.e, app.keuze.s)) {
    const opties = [app.cursor.e, app.keuze.s > app.cursor.e ? app.cursor.e + 1 : app.cursor.e - 1].filter((s) => hellingMag(app.keuze.t, app.cursor.e, s));
    if (opties.length) app.keuze.s = opties[opties.length - 1];
    else if (hellingMag(app.keuze.t, app.cursor.e, Math.sign(app.cursor.e))) app.keuze.s = Math.sign(app.cursor.e);
  }
  const g = keuzeGeldig(app.keuze.t);
  if (!g.ok) { ui?.zetBouwStatus(g.reden, false); return; }
  const st = kandidaat();
  const r = controleer(app.baan, app.info, st);
  spookOk = r.ok;
  spookStuk = st;
  spook = bouwSpook(st, r.ok);
  wereld.scene.add(spook);
  baanView.toonTegels(ruimte(st).tegels, r.ok);
  ui?.zetBouwStatus(r.ok ? null : r.reden, r.ok);
}

export function bouw() {
  if (app.modus !== 'bouwen') return;
  if (app.tool !== 'baan') { app.tool = 'baan'; herbereken(); }
  if (!app.cursor) {
    const fin = app.info.ketens[0]?.stukken.at(-1);
    melding(fin && fin.t === 'finish' ? 'De baan is af. Haal de finish weg om verder te bouwen.' : 'Kies eerst een open einde (groene pijl) om op verder te bouwen.', 'fout');
    geluid.fout();
    return;
  }
  const g = keuzeGeldig(app.keuze.t);
  if (!g.ok) { melding(g.reden, 'fout'); geluid.fout(); return; }
  const st = kandidaat();
  const r = controleer(app.baan, app.info, st);
  if (!r.ok) {
    melding(r.reden, 'fout');
    geluid.fout();
    if (r.botsing !== undefined) { baanView.markeer(r.botsing, 'sloop'); setTimeout(() => baanView.markeer(r.botsing, app.selectie?.id === r.botsing ? 'selectie' : null), 600); }
    return;
  }
  bewaarVoorTerug();
  app.baan.stukken.push(st);
  const u = uitgang(st);
  geluid.plaats(Object.keys(SOORTEN).indexOf(st.t));
  // sluit hij aan op een bestaand stuk?
  const info = analyseer(app.baan);
  const aangesloten = info.ingangen.get(aansluitSleutel(u));
  if (aangesloten && aangesloten.e === u.e) setTimeout(() => geluid.aansluiten(), 120);
  app.selectie = null;
  herbereken({ cursor: u });
}

export function verwijderStuk(id) {
  const i = app.baan.stukken.findIndex((s) => s.id === id);
  if (i < 0) return;
  bewaarVoorTerug();
  const st = app.baan.stukken[i];
  app.baan.stukken.splice(i, 1);
  if (app.selectie && app.selectie.id === id) app.selectie = null;
  geluid.sloop();
  herbereken({ cursor: { x: st.x, z: st.z, d: st.d, l: st.l } });
}

export function verwijderLaatste() {
  if (app.selectie && app.selectie.soort === 'stuk' && app.selectie.id !== 'start') return verwijderStuk(app.selectie.id);
  if (app.selectie && app.selectie.soort === 'decor') return verwijderDecor(app.selectie.id);
  const van = app.cursor ? app.cursor.van : null;
  if (van && van !== 'start') return verwijderStuk(van);
  const laatste = app.baan.stukken.at(-1);
  if (laatste) verwijderStuk(laatste.id);
}

export function plaatsStart(cx, cz, d) {
  const h = app.verplaats ? app.baan.start.h : 12;
  if (app.baan.start) {
    // hele baan verplaatsen
    let nieuw = verschuif(app.baan, cx - app.baan.start.x, cz - app.baan.start.z, 0);
    const extra = ((d - app.baan.start.d) / 2 + 4) % 4;
    for (let i = 0; i < extra; i++) nieuw = draaiBaan(nieuw, 1);
    const g = heleBaanGeldig(nieuw);
    if (!g.ok) { melding(g.reden, 'fout'); geluid.fout(); return false; }
    bewaarVoorTerug();
    app.baan.start = nieuw.start;
    app.baan.stukken = nieuw.stukken;
  } else {
    bewaarVoorTerug();
    app.baan.start = { x: cx, z: cz, d, h, c: app.kleur, sc: app.steun };
    const g = heleBaanGeldig(app.baan);
    if (!g.ok) { app.baan.start = null; app.terug.pop(); melding(g.reden, 'fout'); geluid.fout(); return false; }
  }
  app.verplaats = null;
  app.tool = 'baan';
  geluid.start();
  app.cursor = null;
  herbereken();
  return true;
}

export function startHoogte(delta) {
  if (!app.baan.start) return;
  const nh = app.baan.start.h + delta;
  if (nh < MIN_START || nh > MAX_NIVEAU) { geluid.fout(); return; }
  const nieuw = verschuif(app.baan, 0, 0, delta);
  const g = heleBaanGeldig(nieuw);
  if (!g.ok) { melding(g.reden, 'fout'); geluid.fout(); return; }
  bewaarVoorTerug();
  app.baan.start = nieuw.start;
  app.baan.stukken = nieuw.stukken;
  geluid.draai();
  const c = app.cursor ? { ...app.cursor, l: app.cursor.l + delta } : null;
  herbereken({ cursor: c });
}

export function draaiHeleBaan() {
  if (!app.baan.start) return;
  const nieuw = draaiBaan(app.baan, 1);
  const g = heleBaanGeldig(nieuw);
  if (!g.ok) { melding(g.reden, 'fout'); geluid.fout(); return; }
  bewaarVoorTerug();
  app.baan.start = nieuw.start;
  app.baan.stukken = nieuw.stukken;
  geluid.draai();
  app.cursor = null;
  herbereken();
}

export function verfStuk(id) {
  const st = id === 'start' ? app.baan.start : app.baan.stukken.find((s) => s.id === id);
  if (!st) return;
  const kleur = app.verfDoel === 'baan' ? app.kleur : app.steun;
  const veld = app.verfDoel === 'baan' ? 'c' : 'sc';
  if (st[veld] === kleur) return;
  bewaarVoorTerug();
  st[veld] = kleur;
  geluid.verf();
  herbereken();
}

export function verfAlles() {
  bewaarVoorTerug();
  const veld = app.verfDoel === 'baan' ? 'c' : 'sc';
  const kleur = app.verfDoel === 'baan' ? app.kleur : app.steun;
  for (const st of app.baan.stukken) st[veld] = kleur;
  if (app.baan.start) app.baan.start[veld] = kleur;
  geluid.verf();
  herbereken();
}

export function wijzigStuk(id, wijziging) {
  const st = id === 'start' ? app.baan.start : app.baan.stukken.find((s) => s.id === id);
  if (!st) return;
  bewaarVoorTerug();
  Object.assign(st, wijziging);
  herbereken();
}

// ------------------------------------------------------------------ decor

export function kiesDecor(id) {
  app.decorKeuze = id;
  app.tool = 'decor';
  app.selectie = null;
  herbereken();
}

function snapDecor(p, item, vrij) {
  if (vrij) return { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 };
  const t = item.tegels || 1;
  if (t <= 0.5) return { x: Math.floor(p.x) + 0.5, z: Math.floor(p.z) + 0.5 };
  if (t === 2) return { x: Math.round(p.x / TEGEL) * TEGEL, z: Math.round(p.z / TEGEL) * TEGEL };
  return { x: (Math.floor(p.x / TEGEL) + 0.5) * TEGEL, z: (Math.floor(p.z / TEGEL) + 0.5) * TEGEL };
}

let decorSpookObj = null;
let decorSpookPos = null;
function werkDecorSpookBij(p, vrij) {
  if (decorSpookObj && decorSpookObj.userData.id !== app.decorKeuze) { wereld.scene.remove(decorSpookObj); decorSpookObj = null; }
  if (!p || app.tool !== 'decor' || !app.decorKeuze) { if (decorSpookObj) decorSpookObj.visible = false; decorSpookPos = null; return; }
  const item = ITEMS.get(app.decorKeuze);
  if (!decorSpookObj) {
    decorSpookObj = decorSpook(app.decorKeuze, true);
    decorSpookObj.userData.id = app.decorKeuze;
    wereld.scene.add(decorSpookObj);
  }
  const q = snapDecor(p, item, vrij);
  const grens = RASTER * TEGEL;
  const ok = Math.abs(q.x) < grens && Math.abs(q.z) < grens;
  decorSpookObj.visible = ok;
  decorSpookObj.position.set(q.x, app.decorHoogte, q.z);
  decorSpookObj.rotation.y = app.decorRot;
  decorSpookObj.scale.setScalar(app.decorSchaal);
  decorSpookPos = ok ? q : null;
}

function plaatsDecor() {
  if (!decorSpookPos) return;
  bewaarVoorTerug();
  app.baan.decor.push({ id: nieuwId(), i: app.decorKeuze, x: decorSpookPos.x, z: decorSpookPos.z, y: app.decorHoogte, r: app.decorRot, s: app.decorSchaal });
  geluid.decor();
  herbereken();
}

export function verwijderDecor(id) {
  const i = app.baan.decor.findIndex((d) => d.id === id);
  if (i < 0) return;
  bewaarVoorTerug();
  app.baan.decor.splice(i, 1);
  if (app.selectie && app.selectie.id === id) app.selectie = null;
  geluid.sloop();
  herbereken();
}

export function wijzigDecor(id, f) {
  const d = app.baan.decor.find((x) => x.id === id);
  if (!d) return;
  bewaarVoorTerug();
  f(d);
  geluid.draai();
  herbereken();
}

export function verplaatsDecor(id) {
  const d = app.baan.decor.find((x) => x.id === id);
  if (!d) return;
  bewaarVoorTerug();
  app.baan.decor = app.baan.decor.filter((x) => x.id !== id);
  app.decorKeuze = d.i; app.decorRot = d.r; app.decorHoogte = d.y; app.decorSchaal = d.s;
  app.tool = 'decor';
  app.selectie = null;
  app.terug.pop();
  app.terug.push(JSON.stringify(naarJSON({ ...app.baan, decor: [...app.baan.decor, d] })));
  herbereken();
}

// ------------------------------------------------------------------ invoer in de 3D-wereld

const ray = new THREE.Raycaster();
const muis = new THREE.Vector2();
let laatsteMuis = null;
let hover = null;

function raak(x, y, groepen) {
  const r = canvas.getBoundingClientRect();
  muis.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(muis, wereld.camera);
  const hits = ray.intersectObjects(groepen, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.soort) o = o.parent;
    if (o) return { soort: o.userData.soort, id: o.userData.id, punt: h.point };
  }
  return null;
}

function zetHover(nieuw, soort) {
  if (hover && (!nieuw || hover.id !== nieuw.id || hover.soort !== nieuw.soort || hover.mark !== soort)) {
    const isSel = app.selectie && app.selectie.id === hover.id;
    if (hover.soort === 'stuk') baanView.markeer(hover.id, isSel ? 'selectie' : null);
    else decorView.markeer(hover.id, isSel ? 'selectie' : null);
    hover = null;
  }
  if (nieuw && soort && !hover) {
    if (nieuw.soort === 'stuk') baanView.markeer(nieuw.id, soort);
    else decorView.markeer(nieuw.id, soort);
    hover = { ...nieuw, mark: soort };
  }
}

function werkSelectieMarkering() {
  baanView.wisMarkeringen();
  decorView.wisMarkeringen();
  hover = null;
  if (app.selectie) {
    if (app.selectie.soort === 'stuk') baanView.markeer(app.selectie.id, 'selectie');
    else decorView.markeer(app.selectie.id, 'selectie');
  }
}

let startSpookObj = null;
function werkStartSpook(p) {
  const actief = app.modus === 'bouwen' && (app.tool === 'start' || app.verplaats);
  if (!actief || !p) { if (startSpookObj) startSpookObj.visible = false; baanView.toonTegels([], true); return; }
  const cx = Math.floor(p.x / TEGEL), cz = Math.floor(p.z / TEGEL);
  const d = app.verplaats ? app.verplaats.d : (app.startRichting || 0);
  const sleutel = cx + ',' + cz + ',' + d;
  if (startSpookObj && startSpookObj.userData.sleutel === sleutel) { startSpookObj.visible = true; return; }
  if (startSpookObj) { wereld.scene.remove(startSpookObj); ruimOp(startSpookObj); }
  const start = { x: cx, z: cz, d, h: app.baan.start ? app.baan.start.h : 12, c: app.kleur, sc: app.steun };
  const ok = cx >= -RASTER && cx < RASTER && cz >= -RASTER && cz < RASTER;
  startSpookObj = bouwSpook(startStuk(start), ok);
  startSpookObj.userData.sleutel = sleutel;
  startSpookObj.userData.start = start;
  wereld.scene.add(startSpookObj);
  baanView.toonTegels([[cx, cz, start.h * NIVEAU]], ok);
}

canvas.addEventListener('pointermove', (e) => {
  laatsteMuis = { x: e.clientX, y: e.clientY, alt: e.altKey };
  if (cam.aanwijzers.size > 1) return;
  verwerkHover();
});

function verwerkHover() {
  if (!laatsteMuis || app.modus !== 'bouwen') { zetHover(null); return; }
  const { x, y, alt } = laatsteMuis;
  const grond = cam.grondPunt(x, y, 0);
  werkStartSpook(grond);
  werkDecorSpookBij(grond, alt);
  if (app.tool === 'verf' || app.tool === 'sloop' || app.tool === 'selecteer' || app.tool === 'baan') {
    const groepen = app.tool === 'verf' ? [baanView.groep] : [baanView.groep, decorView.groep];
    const h = raak(x, y, groepen);
    const soort = app.tool === 'sloop' ? 'sloop' : 'hover';
    if (h && !(app.selectie && app.selectie.id === h.id)) zetHover(h, soort);
    else zetHover(null);
    canvas.style.cursor = h ? 'pointer' : '';
  } else {
    zetHover(null);
    canvas.style.cursor = app.tool === 'decor' || app.tool === 'start' ? 'crosshair' : '';
  }
}

cam.onKlik = (k) => {
  initGeluid();
  if (k.knop === 2) {
    // rechtsklik: annuleren / draaien bij plaatsen
    if (app.tool === 'decor') { app.decorRot += Math.PI / 2; geluid.draai(); verwerkHover(); return; }
    return;
  }
  if (app.modus === 'race') { race?.klik(k); return; }
  if (app.modus !== 'bouwen') {
    // in de speelmodus: klik op een knikker om hem te volgen
    volgDichtsteKnikker(k.x, k.y);
    return;
  }
  laatsteMuis = { x: k.x, y: k.y, alt: k.alt };
  const grond = cam.grondPunt(k.x, k.y, 0);
  if (app.tool === 'start' || app.verplaats) {
    if (!grond) return;
    const d = app.verplaats ? app.verplaats.d : (app.startRichting || 0);
    plaatsStart(Math.floor(grond.x / TEGEL), Math.floor(grond.z / TEGEL), d);
    return;
  }
  if (app.tool === 'decor') {
    werkDecorSpookBij(grond, k.alt);
    plaatsDecor();
    return;
  }
  if (app.tool === 'baan' && spook) {
    const h = raak(k.x, k.y, [spook]);
    if (h) { bouw(); return; }
  }
  const h = raak(k.x, k.y, app.tool === 'verf' ? [baanView.groep] : [baanView.groep, decorView.groep]);
  if (app.tool === 'sloop') {
    if (!h) return;
    if (h.soort === 'stuk') {
      if (h.id === 'start') {
        if (app.baan.stukken.length) { melding('Haal eerst de rest van de baan weg, of verplaats het startpunt.', 'fout'); geluid.fout(); return; }
        bewaarVoorTerug(); app.baan.start = null; app.tool = 'start'; geluid.sloop(); herbereken(); return;
      }
      verwijderStuk(h.id);
    } else verwijderDecor(h.id);
    return;
  }
  if (app.tool === 'verf') { if (h) verfStuk(h.id); return; }
  // selecteren (ook in de baan-tool)
  if (h) {
    app.selectie = { soort: h.soort, id: h.id };
    if (h.soort === 'stuk') {
      // verder bouwen vanaf dit stuk als het einde open is
      const st = h.id === 'start' ? app.info.st0 : app.baan.stukken.find((s) => s.id === h.id);
      if (st) {
        const u = st === app.info.st0 ? uitgang(st) : st._uit;
        const open = app.info.open.find((o) => zelfde(o, u));
        if (open) app.cursor = open;
      }
    }
    geluid.klik();
  } else app.selectie = null;
  werkSelectieMarkering();
  herbereken();
};

window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
  const toets = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && toets === 'z') { e.preventDefault(); if (e.shiftKey) opnieuw(); else ongedaan(); return; }
  if ((e.ctrlKey || e.metaKey) && toets === 'y') { e.preventDefault(); opnieuw(); return; }
  if ((e.ctrlKey || e.metaKey) && toets === 's') { e.preventDefault(); ui?.opslaan(); return; }
  if (app.modus === 'spelen') {
    if (toets === ' ') { e.preventDefault(); app.pauze = !app.pauze; ui?.werkBij(); }
    if (toets === '1' || toets === '2' || toets === '3') { app.snelheid = Number(toets); ui?.werkBij(); }
    if (toets === 'f') volgVolgende();
    if (toets === 'escape' || toets === 'b') zetModus('bouwen');
    return;
  }
  if (app.modus !== 'bouwen') return;
  if (toets === 'enter') { e.preventDefault(); bouw(); }
  else if (toets === 'backspace' || toets === 'delete') { e.preventDefault(); verwijderLaatste(); }
  else if (toets === 'escape') {
    if (app.verplaats) app.verplaats = null;
    if (app.tool === 'decor' || app.tool === 'verf' || app.tool === 'sloop') app.tool = app.baan.start ? 'baan' : 'start';
    app.selectie = null;
    werkSelectieMarkering();
    herbereken();
  } else if (toets === 'r') {
    if (app.tool === 'decor') { app.decorRot += (e.shiftKey ? Math.PI / 4 : Math.PI / 2); geluid.draai(); verwerkHover(); }
    else if (app.tool === 'start' || app.verplaats) {
      if (app.verplaats) app.verplaats.d = (app.verplaats.d + 2) % 8; else app.startRichting = ((app.startRichting || 0) + 2) % 8;
      geluid.draai(); if (startSpookObj) startSpookObj.userData.sleutel = ''; verwerkHover();
    }
  } else if (toets === 'pageup' || toets === 'pagedown') {
    e.preventDefault();
    const d = toets === 'pageup' ? 1 : -1;
    if (app.tool === 'decor') { app.decorHoogte = Math.max(0, Math.min(30, app.decorHoogte + d * 0.5)); geluid.draai(); verwerkHover(); ui?.werkBij(); }
    else if (app.selectie && app.selectie.id === 'start') startHoogte(d);
  } else if (toets === 'p') zetModus('spelen');
});

// ------------------------------------------------------------------ meldingen

function melding(tekst, soort = 'info') { ui?.toast(tekst, soort); }

// ------------------------------------------------------------------ spelen

const knikkerMeshes = new Map();
const knikkerGroep = new THREE.Group();
wereld.scene.add(knikkerGroep);

function knikkerMesh(kn) {
  let m = knikkerMeshes.get(kn.id);
  if (!m) {
    const mat = skinMateriaal(kn.skin).clone();
    m = new THREE.Mesh(KNIKKER_GEO, mat);
    m.scale.setScalar(KNIKKER_R);
    m.castShadow = true;
    knikkerGroep.add(m);
    knikkerMeshes.set(kn.id, m);
  }
  return m;
}

function ruimKnikkersOp() {
  for (const m of knikkerMeshes.values()) { knikkerGroep.remove(m); m.material.dispose(); }
  knikkerMeshes.clear();
}

const heetKleur = new THREE.Color(0xff6a1a);
function werkKnikkersBij() {
  const mag = app.baan.start ? magazijnPositie(app.baan.start) : null;
  let w = 0;
  const gezien = new Set();
  for (const kn of sim.knikkers) {
    const m = knikkerMesh(kn);
    gezien.add(kn.id);
    if (kn.toestand === 'wacht') {
      const plek = sim.wachtrij.indexOf(kn);
      if (mag && plek >= 0 && plek < 8) {
        m.visible = true;
        m.position.set(mag.x, mag.y + 0.06 + plek * 0.3, mag.z);
      } else m.visible = false;
      w++;
      continue;
    }
    if (kn.toestand === 'uit') { m.visible = false; continue; }
    m.visible = true;
    m.position.copy(kn.pos);
    m.quaternion.copy(kn.draai);
    const mat = m.material;
    if (kn.hitte > 0.01) {
      mat.emissive.copy(mat.userData.basisEmissie).lerp(heetKleur, Math.min(1, kn.hitte));
      mat.emissiveIntensity = Math.max(mat.userData.basisSterkte, kn.hitte * 1.6);
    } else if (mat.emissiveIntensity !== mat.userData.basisSterkte) {
      mat.emissive.copy(mat.userData.basisEmissie);
      mat.emissiveIntensity = mat.userData.basisSterkte;
    }
  }
  for (const [id, m] of knikkerMeshes) if (!gezien.has(id)) { knikkerGroep.remove(m); m.material.dispose(); knikkerMeshes.delete(id); }
  void w;
}

let volgIndex = -1;
function volgVolgende() {
  const lijst = sim.knikkers.filter((k) => k.toestand === 'baan' || k.toestand === 'vrij');
  if (!lijst.length) return;
  volgIndex = (volgIndex + 1) % lijst.length;
  const kn = lijst[volgIndex];
  app.volg = kn.id;
  cam.volg = () => (sim.knikkers.find((k) => k.id === app.volg) || {}).pos || null;
  cam.afstand = Math.min(cam.afstand, 12);
  ui?.werkBij();
}

function volgDichtsteKnikker(x, y) {
  let beste = null, besteD = 40 * 40;
  const v = new THREE.Vector3();
  const r = canvas.getBoundingClientRect();
  for (const kn of sim.knikkers) {
    if (kn.toestand !== 'baan' && kn.toestand !== 'vrij') continue;
    v.copy(kn.pos).project(wereld.camera);
    const sx = (v.x * 0.5 + 0.5) * r.width + r.left, sy = (-v.y * 0.5 + 0.5) * r.height + r.top;
    const d = (sx - x) ** 2 + (sy - y) ** 2;
    if (d < besteD) { besteD = d; beste = kn; }
  }
  if (beste) {
    app.volg = beste.id;
    cam.volg = () => (sim.knikkers.find((k) => k.id === app.volg) || {}).pos || null;
    cam.afstand = Math.min(cam.afstand, 12);
  } else { app.volg = false; cam.volg = null; }
  ui?.werkBij();
}

export function stopVolgen() { app.volg = false; cam.volg = null; ui?.werkBij(); }

sim.gebeurtenis = (soort, kn, extra) => {
  if (app.modus === 'race') race?.gebeurtenis(soort, kn, extra);
  switch (soort) {
    case 'boost': geluid.boost(); break;
    case 'launchWacht': geluid.launchLaad(); break;
    case 'launch': geluid.launch(); break;
    case 'finish': geluid.finish(); break;
    case 'vuur': geluid.vuur(); break;
    case 'aqua': geluid.bubbel(); break;
    case 'tik': geluid.tik(extra); break;
    case 'stuiter': if (extra > 0.8) geluid.stuiter(extra); break;
    case 'eruit': geluid.eruit(); break;
    case 'aftel': geluid.aftel(extra); break;
    case 'go': geluid.aftel(0); break;
    case 'raceKlaar': geluid.juich(); break;
    default:
  }
};

export function startSpel() {
  if (!app.baan.start) { melding('Plaats eerst een startpunt.', 'fout'); geluid.fout(); return false; }
  if (!app.baan.stukken.length) { melding('Bouw eerst een stukje baan.', 'fout'); geluid.fout(); return false; }
  sim.bouw(app.info, magazijnPositie(app.baan.start));
  const k = app.baan.knikkers;
  sim.vul(k.aantal, k.skins.filter((s) => SKIN_MAP.has(s)).length ? k.skins.filter((s) => SKIN_MAP.has(s)) : ['kattenoog']);
  sim.interval = k.interval;
  sim.rondgaan = k.rondgaan !== false;
  sim.uitDeBocht = !!k.uitDeBocht;
  sim.actief = true;
  return true;
}

export function zetModus(modus) {
  if (modus === app.modus) return;
  initGeluid();
  if (modus === 'spelen' && !startSpel()) return;
  if (modus === 'race') {
    if (!app.baan.start || !app.baan.stukken.length) { melding('Bouw eerst een baan met een startpunt.', 'fout'); geluid.fout(); return; }
  }
  if (app.modus === 'race') race?.stop();
  if (modus === 'bouwen') { sim.stop(); ruimKnikkersOp(); stopVolgen(); }
  if (modus !== 'spelen' && app.modus === 'spelen') { sim.stop(); ruimKnikkersOp(); }
  app.modus = modus;
  app.pauze = false;
  geluid.modus(modus !== 'bouwen');
  verwijderSpook();
  if (startSpookObj) startSpookObj.visible = false;
  if (decorSpookObj) decorSpookObj.visible = false;
  zetHover(null);
  app.selectie = null;
  werkSelectieMarkering();
  if (modus === 'race') {
    sim.stop(); ruimKnikkersOp();
    if (!race) race = new RaceHost(app, { sim, wereld, cam, ui, startRace: raceStart, melding });
    race.open();
  }
  herbereken();
}

function raceStart(spelers, rondes) {
  sim.bouw(app.info, magazijnPositie(app.baan.start));
  ruimKnikkersOp();
  sim.startRace(spelers, rondes);
}

export function herstartSpel() {
  if (app.modus !== 'spelen') return;
  ruimKnikkersOp();
  startSpel();
}

// ------------------------------------------------------------------ thumbnails

export function maakThumbnail(b = 360, h = 225) {
  // camera zo zetten dat de hele baan in beeld is
  const box = new THREE.Box3();
  baanView.groep.traverse((o) => { if (o.isMesh) box.expandByObject(o); });
  decorView.groep.traverse((o) => { if (o.isMesh) box.expandByObject(o); });
  if (box.isEmpty()) box.set(new THREE.Vector3(-8, 0, -8), new THREE.Vector3(8, 4, 8));
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const r = Math.max(Math.hypot(s.x, s.z) * 0.5, s.y * 0.8) + 1.2;
  const cam2 = new THREE.PerspectiveCamera(40, b / h, 0.1, 900);
  const yaw = -0.75, pitch = 0.6;
  const d = r / Math.sin((20 * Math.PI) / 180) * 0.82;
  cam2.position.set(c.x + Math.cos(yaw) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.sin(yaw) * Math.cos(pitch) * d);
  cam2.lookAt(c);
  const extraZichtbaar = baanView.extra.visible;
  baanView.extra.visible = false;
  const rz = wereld.raster.visible;
  wereld.raster.visible = false;
  if (spook) spook.visible = false;
  // in het gewone canvas renderen en meteen overnemen (dan klopt de kleurweergave precies)
  const doek = wereld.renderer.domElement;
  cam2.aspect = doek.width / doek.height;
  cam2.updateProjectionMatrix();
  wereld.volgZon(c, d);
  wereld.renderer.render(wereld.scene, cam2);
  const klein = document.createElement('canvas');
  klein.width = b; klein.height = h;
  const doel = b / h;
  let sw = doek.width, sh = doek.height;
  if (sw / sh > doel) sw = sh * doel; else sh = sw / doel;
  klein.getContext('2d').drawImage(doek, (doek.width - sw) / 2, (doek.height - sh) / 2, sw, sh, 0, 0, b, h);
  baanView.extra.visible = extraZichtbaar;
  wereld.raster.visible = rz;
  if (spook) spook.visible = true;
  return klein.toDataURL('image/jpeg', 0.82);
}

// ------------------------------------------------------------------ render-loop

let vorige = performance.now();
let tijd = 0;
let rolTeller = 0;
function lus(nu) {
  requestAnimationFrame(lus);
  const dt = Math.min(0.05, (nu - vorige) / 1000);
  vorige = nu;
  tijd += dt;
  cam.update(dt);
  wereld.volgZon(cam.nu.doel, cam.nu.afstand);
  const spelend = app.modus === 'spelen' || app.modus === 'race';
  if (spelend && !app.pauze) sim.stap(dt * (app.modus === 'race' ? 1 : app.snelheid));
  if (spelend) werkKnikkersBij();
  baanView.animeer(tijd, dt, spelend ? sim : null);
  decorView.animeer(tijd, dt);
  if (spelend) {
    let som = 0, n = 0;
    for (const kn of sim.knikkers) if (kn.toestand === 'baan') { som += Math.abs(kn.v); n++; }
    rolGeluid(app.pauze ? 0 : Math.min(4, n * 0.4) * Math.min(1, som / Math.max(1, n) / 4), som / Math.max(1, n));
    if ((rolTeller += dt) > 0.25) { rolTeller = 0; ui?.werkStatsBij(); }
  } else rolGeluid(0, 0);
  if (app.modus === 'race') race?.frame(dt);
  wereld.render();
}

// ------------------------------------------------------------------ opstarten

function opstarten() {
  pasInstellingenToe();
  window.addEventListener('resize', () => wereld.formaat());
  wereld.formaat();
  ui = maakUI(app, {
    bouw, verwijderLaatste, verwijderStuk, ongedaan, opnieuw, zetModus, herbereken, kiesDecor,
    verwijderDecor, wijzigDecor, verplaatsDecor, verfAlles, verfStuk, wijzigStuk, startHoogte, draaiHeleBaan,
    zetBaan, herstartSpel, volgVolgende, stopVolgen, maakThumbnail, pasInstellingenToe, keuzeGeldig,
    werkSpookBij: () => { werkSpookBij(); werkMarkersBij(); },
    verplaatsStart: () => { app.verplaats = { d: app.baan.start.d }; app.selectie = null; werkSelectieMarkering(); herbereken(); melding('Klik op een tegel om het startpunt (met de hele baan) neer te zetten. R draait.', 'info'); },
    focusBaan: () => focusOpBaan(),
    nieuwId: () => { app.baanId = nieuwBaanId(); },
    bewaar: (thumb) => bewaarBaan(app.baanId, naarJSON(app.baan), thumb),
    laad: (id) => { const d = laadBaan(id); if (d) { app.baanId = id; zetBaan(d); focusOpBaan(); } },
  });
  // vorige sessie terugzetten
  const huidig = opslag.lees('huidig', null);
  let geladen = false;
  if (huidig && huidig.data) {
    try { app.baanId = huidig.id || app.baanId; zetBaan(huidig.data); geladen = true; } catch (e) { console.warn(e); }
  }
  if (!geladen) herbereken();
  focusOpBaan(true);
  ui.start();
  document.getElementById('laden')?.remove();
  requestAnimationFrame(lus);
  // gedeelde link openen
  const params = new URLSearchParams(location.search);
  if (params.get('baan')) ui.openCommunityBaan(params.get('baan'));
}

function focusOpBaan(direct) {
  if (app.baan.start) {
    const box = new THREE.Box3();
    const p = (x, y, z) => box.expandByPoint(new THREE.Vector3(x, y, z));
    p((app.baan.start.x + 0.5) * TEGEL, 0, (app.baan.start.z + 0.5) * TEGEL);
    for (const st of app.baan.stukken) p(st.x, st.l * NIVEAU, st.z);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    cam.kijkNaar(c.x, 0, c.z, Math.max(18, Math.max(s.x, s.z) * 1.25 + s.y));
  } else cam.kijkNaar(0, 0, 0, 46);
  if (direct) cam.zetDirect();
}

opstarten();

export { app, KMU };
