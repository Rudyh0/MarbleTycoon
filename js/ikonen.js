// Kleine 3D-plaatjes van stukken, decor en knikkers voor de menu's (zoals de knoppen in Cities: Skylines).

import * as THREE from '../lib/three.min.js';
import { bouwStukMesh, ruimOp } from './baanweergave.js';
import { maakDecor, ITEMS } from './decor.js';
import { skinMateriaal, KNIKKER_GEO } from './knikkers.js';

let r = null, scene, camera, env;
const cache = new Map();
const wachtrij = [];
let bezig = false;

function init() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(128, 128, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r);
  env = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.7;
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x403a30, 1.3));
  const zon = new THREE.DirectionalLight(0xffffff, 2.2);
  zon.position.set(4, 8, 5);
  scene.add(zon);
  camera = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
}

function kader(obj, hoek = 0.75, hoogte = 0.62) {
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const r = Math.max(s.x, s.y * 1.1, s.z) * 0.5 + 0.05;
  const d = r / Math.sin((camera.fov * Math.PI) / 360) * 1.05;
  camera.position.set(c.x + Math.cos(hoek) * Math.cos(hoogte) * d, c.y + Math.sin(hoogte) * d, c.z + Math.sin(hoek) * Math.cos(hoogte) * d);
  camera.lookAt(c);
  camera.near = d * 0.05; camera.far = d * 4;
  camera.updateProjectionMatrix();
}

function render(obj, opties = {}) {
  if (!r) init();
  scene.add(obj);
  kader(obj, opties.hoek, opties.hoogte);
  r.setClearColor(0x000000, 0);
  r.render(scene, camera);
  const url = r.domElement.toDataURL('image/png');
  scene.remove(obj);
  return url;
}

function plan(sleutel, maak, opties) {
  return new Promise((res) => {
    if (cache.has(sleutel)) { res(cache.get(sleutel)); return; }
    wachtrij.push({ sleutel, maak, opties, res });
    verwerk();
  });
}

function verwerk() {
  if (bezig) return;
  bezig = true;
  const stap = () => {
    const t0 = performance.now();
    while (wachtrij.length && performance.now() - t0 < 12) {
      const w = wachtrij.shift();
      if (cache.has(w.sleutel)) { w.res(cache.get(w.sleutel)); continue; }
      let url = '';
      try {
        const obj = w.maak();
        url = render(obj, w.opties);
        if (w.opties && w.opties.opruimen) ruimOp(obj);
      } catch (e) { console.warn('ikoon', w.sleutel, e); }
      cache.set(w.sleutel, url);
      w.res(url);
    }
    if (wachtrij.length) requestAnimationFrame(stap);
    else bezig = false;
  };
  requestAnimationFrame(stap);
}

// Een stuk in de basisstand op de grond
export function stukIkoon(t, opties = {}) {
  const st = { id: 'ikoon', t, lr: opties.lr || (t.startsWith('bocht') || t.startsWith('kwart') || t === 'sbocht' || t.startsWith('spiraal') || t === 'kurk' || t === 'aquaB' ? 'R' : ''), x: 0, z: 0, d: opties.d || 0, l: opties.l ?? 2, e: opties.e || 0, s: opties.s || 0, c: opties.kleur || '#4fa3ff', sc: '#c9ced6', fx: opties.fx, v: 20, dh: opties.dh };
  if (t === 'spiraal1' || t === 'spiraal2') st.dh = -1;
  const sleutel = 'stuk:' + JSON.stringify(st);
  return plan(sleutel, () => bouwStukMesh(st, { geest: true }), { opruimen: true, hoek: 0.9, hoogte: 0.75 });
}

export function decorIkoon(id) {
  return plan('decor:' + id, () => maakDecor(id), { hoek: 0.8, hoogte: ITEMS.get(id)?.plat ? 1.0 : 0.5 });
}

export function skinIkoon(id) {
  return plan('skin:' + id, () => {
    const m = new THREE.Mesh(KNIKKER_GEO, skinMateriaal(id));
    m.rotation.set(0.3, 1.2, 0);
    return m;
  }, { hoek: 0.6, hoogte: 0.3 });
}
