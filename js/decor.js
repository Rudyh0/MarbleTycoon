// Alle thema's en het tekenen van geplaatst decor.

import * as THREE from '../lib/three.min.js';
import stad from './decor/stad.js';
import rome from './decor/rome.js';
import middeleeuwen from './decor/middeleeuwen.js';
import ruimte from './decor/ruimte.js';
import natuur from './decor/natuur.js';
import piraten from './decor/piraten.js';

export const THEMAS = [
  { id: 'stad', naam: 'Metropool', items: stad },
  { id: 'rome', naam: 'Romeinse tijd', items: rome },
  { id: 'middeleeuwen', naam: 'Middeleeuwen', items: middeleeuwen },
  { id: 'ruimte', naam: 'Space', items: ruimte },
  { id: 'natuur', naam: 'Flora en fauna', items: natuur },
  { id: 'piraten', naam: 'Piraten', items: piraten },
];

export const ITEMS = new Map();
for (const t of THEMAS) for (const it of t.items) { it.thema = t.id; ITEMS.set(it.id, it); }
export const DECOR_IDS = new Set(ITEMS.keys());

const sjablonen = new Map();
export function sjabloon(id) {
  if (sjablonen.has(id)) return sjablonen.get(id);
  const item = ITEMS.get(id);
  if (!item) return null;
  const g = item.maak();
  g.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.userData.gedeeld = true; });
  sjablonen.set(id, g);
  return g;
}

export function maakDecor(id) {
  const s = sjabloon(id);
  if (!s) return null;
  const g = s.clone(true);
  return g;
}

const spookMat = {
  ok: new THREE.MeshBasicMaterial({ color: 0x7ed957, transparent: true, opacity: 0.45, depthWrite: false }),
  nee: new THREE.MeshBasicMaterial({ color: 0xff5d5d, transparent: true, opacity: 0.45, depthWrite: false }),
};

export function decorSpook(id, ok = true) {
  const g = maakDecor(id);
  if (!g) return null;
  g.traverse((o) => { if (o.isMesh) { o.material = ok ? spookMat.ok : spookMat.nee; o.castShadow = false; o.renderOrder = 6; } });
  return g;
}

const markeer = new Map();
function markeerMat(mat, soort) {
  const k = mat.uuid + soort;
  if (markeer.has(k)) return markeer.get(k);
  const m = mat.clone();
  if (m.emissive) m.emissive.setHex(soort === 'sloop' ? 0x7a1010 : soort === 'selectie' ? 0x1d4f8a : 0x23405f);
  markeer.set(k, m);
  return m;
}

export class DecorWeergave {
  constructor(scene) {
    this.groep = new THREE.Group();
    scene.add(this.groep);
    this.objecten = new Map(); // id -> { groep, sleutel }
    this.lichten = 0;
  }

  update(lijst) {
    const nieuw = new Map();
    for (const d of lijst) {
      const sleutel = `${d.i}|${d.x}|${d.z}|${d.y}|${d.r}|${d.s}`;
      const oud = this.objecten.get(d.id);
      if (oud && oud.sleutel === sleutel) { nieuw.set(d.id, oud); this.objecten.delete(d.id); continue; }
      let g = oud && oud.i === d.i ? oud.groep : null;
      if (oud && !g) this.groep.remove(oud.groep);
      if (oud) this.objecten.delete(d.id);
      if (!g) {
        g = maakDecor(d.i);
        if (!g) continue;
        this.groep.add(g);
      }
      const item = ITEMS.get(d.i);
      g.position.set(d.x, d.y || 0, d.z);
      g.rotation.y = d.r || 0;
      g.scale.setScalar(d.s || 1);
      g.userData = { soort: 'decor', id: d.id, item };
      nieuw.set(d.id, { groep: g, sleutel, i: d.i });
    }
    for (const o of this.objecten.values()) this.groep.remove(o.groep);
    this.objecten = nieuw;
    this.werkLichtenBij();
  }

  werkLichtenBij() {
    // een paar echte lichtjes voor vuurschalen e.d., maximaal 8
    let n = 0;
    for (const { groep } of this.objecten.values()) {
      const item = groep.userData.item;
      const bestaand = groep.getObjectByName('decorlicht');
      if (item.licht && n < 8) {
        n++;
        if (!bestaand) {
          const l = new THREE.PointLight(item.licht.kleur, item.licht.sterkte, 5, 1.8);
          l.name = 'decorlicht';
          l.position.y = item.licht.y;
          groep.add(l);
        }
      } else if (bestaand) groep.remove(bestaand);
    }
  }

  animeer(t, dt) {
    for (const { groep } of this.objecten.values()) {
      const item = groep.userData.item;
      if (item && item.anim) item.anim(groep, t + (groep.position.x * 0.37 + groep.position.z * 0.21), dt);
    }
  }

  markeer(id, soort) {
    const o = this.objecten.get(id);
    if (!o) return;
    o.groep.traverse((m) => {
      if (!m.isMesh) return;
      if (m.userData.origMat === undefined) m.userData.origMat = m.material;
      const orig = m.userData.origMat;
      m.material = soort && orig.isMeshStandardMaterial && !orig.transparent ? markeerMat(orig, soort) : orig;
    });
  }

  wisMarkeringen() {
    for (const id of this.objecten.keys()) this.markeer(id, null);
  }
}
