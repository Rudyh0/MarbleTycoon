// Kleine bouwdoos voor low-poly modellen: losse vormen met een kleur, samengevoegd tot een paar meshes.
// Zo kost een heel gebouw maar één tot drie draw calls.

import * as THREE from '../lib/three.min.js';

export const MAT = {
  mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.04 }),
  metaal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.75 }),
  glans: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.1 }),
  gloei: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  glas: new THREE.MeshStandardMaterial({ color: 0xcfefff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4 }),
  water: new THREE.MeshStandardMaterial({ color: 0x1f86d0, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.36, depthWrite: false, side: THREE.DoubleSide }),
  dubbel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.08, side: THREE.DoubleSide }),
};

const tmpKleur = new THREE.Color();
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

function zetKleur(geo, kleur) {
  tmpKleur.set(kleur);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = tmpKleur.r; arr[i * 3 + 1] = tmpKleur.g; arr[i * 3 + 2] = tmpKleur.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

export class Kit {
  constructor() {
    this.delen = { mat: [], metaal: [], glans: [], dubbel: [], gloei: [], glas: [], water: [] };
  }

  // o: { x, y, z, rx, ry, rz, sx, sy, sz, mat }
  voeg(geo, kleur, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.deleteAttribute('uv');
    g.deleteAttribute('uv1');
    tmpE.set(o.rx || 0, o.ry || 0, o.rz || 0, o.volgorde || 'XYZ');
    tmpQ.setFromEuler(tmpE);
    tmpS.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    tmpP.set(o.x || 0, o.y || 0, o.z || 0);
    tmpM.compose(tmpP, tmpQ, tmpS);
    g.applyMatrix4(tmpM);
    if (o.na) g.applyMatrix4(o.na);
    zetKleur(g, kleur);
    (this.delen[o.mat || 'mat'] || this.delen.mat).push(g);
    return this;
  }

  // Afmetingen zijn totaal (niet de helft). y is de onderkant, tenzij o.midden.
  blok(w, h, d, kleur, o = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (!o.midden) geo.translate(0, h / 2, 0);
    return this.voeg(geo, kleur, o);
  }
  cil(rt, rb, h, kleur, o = {}) {
    const geo = new THREE.CylinderGeometry(rt, rb, h, o.seg || 12, 1, !!o.open);
    if (!o.midden) geo.translate(0, h / 2, 0);
    return this.voeg(geo, kleur, o);
  }
  kegel(r, h, kleur, o = {}) {
    const geo = new THREE.ConeGeometry(r, h, o.seg || 12);
    if (!o.midden) geo.translate(0, h / 2, 0);
    return this.voeg(geo, kleur, o);
  }
  bol(r, kleur, o = {}) {
    const geo = new THREE.SphereGeometry(r, o.seg || 12, o.hseg || Math.max(6, Math.round((o.seg || 12) * 0.66)), 0, Math.PI * 2, 0, o.half ? Math.PI / 2 : Math.PI);
    return this.voeg(geo, kleur, o);
  }
  ring(R, r, kleur, o = {}) {
    const geo = new THREE.TorusGeometry(R, r, o.rseg || 6, o.seg || 16, o.boog || Math.PI * 2);
    return this.voeg(geo, kleur, o);
  }
  draai(punten, kleur, o = {}) {
    const geo = new THREE.LatheGeometry(punten.map((p) => new THREE.Vector2(p[0], p[1])), o.seg || 16);
    return this.voeg(geo, kleur, o);
  }
  // vorm: THREE.Shape in het xy-vlak, uitgerekt over diepte d in z (gecentreerd)
  vorm(shape, d, kleur, o = {}) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: o.seg || 8 });
    geo.translate(0, 0, -d / 2);
    return this.voeg(geo, kleur, o);
  }
  vlak(w, d, kleur, o = {}) {
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    return this.voeg(geo, kleur, o);
  }
  // Dak met puntgevel: lengte l (x), breedte b (z), hoogte h
  zadeldak(l, b, h, kleur, o = {}) {
    const s = new THREE.Shape();
    s.moveTo(-b / 2, 0); s.lineTo(b / 2, 0); s.lineTo(0, h); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: l, bevelEnabled: false });
    geo.translate(0, 0, -l / 2);
    geo.rotateY(Math.PI / 2);
    return this.voeg(geo, kleur, o);
  }
  // Rij ramen (gloeiend) op een gevel
  ramen(nx, ny, w, h, dx, dy, kleur, o = {}) {
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      this.blok(w, h, 0.02, kleur, { ...o, x: (o.x || 0) + (i - (nx - 1) / 2) * dx, y: (o.y || 0) + j * dy, mat: o.mat || 'gloei' });
    }
    return this;
  }

  bouw(opties = {}) {
    const groep = new THREE.Group();
    for (const [naam, lijst] of Object.entries(this.delen)) {
      if (!lijst.length) continue;
      const geo = THREE.mergeGeometries(lijst, false);
      lijst.forEach((g) => g.dispose());
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, MAT[naam]);
      if (naam !== 'glas' && naam !== 'water' && naam !== 'gloei') {
        mesh.castShadow = opties.schaduw !== false;
        mesh.receiveShadow = true;
      }
      if (naam === 'glas' || naam === 'water') mesh.renderOrder = 2;
      mesh.userData.kitDeel = naam;
      groep.add(mesh);
    }
    return groep;
  }
}

export function kleurMix(a, b, f) {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), f).getHexString();
}
