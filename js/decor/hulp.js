// Gedeelde hulpjes voor decormodellen.

import * as THREE from '../../lib/three.min.js';
import { Kit } from '../modelkit.js';

// Bouw een model: fn(kit, groep) vult de kit; groep is voor losse (bewegende) delen.
export function M(fn) {
  const k = new Kit();
  const g = new THREE.Group();
  fn(k, g);
  const vast = k.bouw();
  vast.name = 'vast';
  g.add(vast);
  return g;
}

// Los deel met eigen kit (bijvoorbeeld wieken die draaien).
export function deel(naam, fn, positie) {
  const k = new Kit();
  fn(k);
  const g = k.bouw();
  g.name = naam;
  if (positie) g.position.set(...positie);
  return g;
}

export function boomRond(k, x, z, h, r, blad = '#4f9a45', stam = '#7a5536') {
  k.cil(r * 0.16, r * 0.22, h * 0.55, stam, { x, z, seg: 7 });
  k.bol(r, blad, { x, y: h * 0.55 + r * 0.6, z, seg: 9 });
  k.bol(r * 0.72, kleurVar(blad, 0.08), { x: x + r * 0.45, y: h * 0.55 + r * 0.25, z: z + r * 0.2, seg: 8 });
  k.bol(r * 0.66, kleurVar(blad, -0.06), { x: x - r * 0.4, y: h * 0.55 + r * 0.35, z: z - r * 0.25, seg: 8 });
}

export function den(k, x, z, h, blad = '#2f6e45', stam = '#6b4a30') {
  k.cil(h * 0.05, h * 0.07, h * 0.3, stam, { x, z, seg: 6 });
  for (let i = 0; i < 3; i++) {
    const r = h * (0.32 - i * 0.07);
    k.kegel(r, h * 0.38, kleurVar(blad, i * 0.04), { x, y: h * (0.22 + i * 0.22), z, seg: 8 });
  }
}

export function kleurVar(kleur, d) {
  const c = new THREE.Color(kleur);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + d)));
  return '#' + c.getHexString();
}

// Poppetje van ongeveer 0,9 m hoog.
export function figuur(k, o = {}) {
  const x = o.x || 0, z = o.z || 0, s = o.s || 1, ry = o.ry || 0, y0 = o.y || 0;
  const rot = (dx, dz) => [x + (dx * Math.cos(ry) - dz * Math.sin(ry)) * s, z + (dx * Math.sin(ry) + dz * Math.cos(ry)) * s];
  const huid = o.huid || '#f0c8a0';
  const [lx, lz] = rot(0, -0.07), [rx, rz] = rot(0, 0.07);
  k.blok(0.09 * s, 0.38 * s, 0.09 * s, o.broek || '#33415a', { x: lx, y: y0, z: lz, ry: -ry });
  k.blok(0.09 * s, 0.38 * s, 0.09 * s, o.broek || '#33415a', { x: rx, y: y0, z: rz, ry: -ry });
  k.blok(0.18 * s, 0.32 * s, 0.26 * s, o.shirt || '#d64a3a', { x, y: y0 + 0.38 * s, z, ry: -ry });
  const [ax, az] = rot(0, -0.17), [bx, bz] = rot(0, 0.17);
  k.blok(0.07 * s, 0.3 * s, 0.07 * s, o.shirt || '#d64a3a', { x: ax, y: y0 + 0.4 * s, z: az, ry: -ry });
  k.blok(0.07 * s, 0.3 * s, 0.07 * s, o.shirt || '#d64a3a', { x: bx, y: y0 + 0.4 * s, z: bz, ry: -ry });
  k.bol(0.1 * s, huid, { x, y: y0 + 0.82 * s, z, seg: 10 });
  if (o.hoed) k.cil(0.08 * s, 0.11 * s, 0.08 * s, o.hoed, { x, y: y0 + 0.89 * s, z });
  if (o.helm) k.bol(0.115 * s, o.helm, { x, y: y0 + 0.84 * s, z, half: true, seg: 10 });
}

export function wiel(k, x, y, z, r, b, kleur = '#1e2126', ry = 0, mat) {
  k.cil(r, r, b, kleur, { x, y, z, rx: Math.PI / 2, ry, midden: true, seg: 14, volgorde: 'YXZ', mat });
}

export function ramenGevel(k, o) {
  // o: { x, y, z, w, h, nx, ny, kleur, ry, uit }   ramen op een vlak met normaal +z (ry draait)
  const { nx, ny } = o;
  const dx = o.w / nx, dy = o.h / ny;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const lx = -o.w / 2 + dx * (i + 0.5);
    const ly = o.y + dy * (j + 0.2);
    const c = Math.cos(o.ry || 0), sn = Math.sin(o.ry || 0);
    const px = o.x + lx * c + (o.uit || 0) * sn, pz = o.z - lx * sn + (o.uit || 0) * c;
    const aan = ((i * 7 + j * 13 + (o.zaad || 0)) % 5) !== 0;
    k.blok(dx * 0.62, dy * 0.55, 0.03, aan ? o.kleur || '#ffd98a' : '#2a3442', { x: px, y: ly, z: pz, ry: o.ry || 0, mat: aan ? 'gloei' : 'glans' });
  }
}

export function kantelen(k, x, y, z, r, n, kleur, hoogte = 0.35) {
  for (let i = 0; i < n; i++) {
    if (i % 2) continue;
    const a = (i / n) * Math.PI * 2;
    k.blok(0.3, hoogte, 0.25, kleur, { x: x + Math.cos(a) * r, y, z: z + Math.sin(a) * r, ry: -a });
  }
}

export function vierkantKantelen(k, cx, y, cz, w, d, kleur, stap = 0.5) {
  for (let x = -w / 2 + stap / 2; x <= w / 2; x += stap * 2) {
    k.blok(stap, 0.35, 0.25, kleur, { x: cx + x, y, z: cz - d / 2 });
    k.blok(stap, 0.35, 0.25, kleur, { x: cx + x, y, z: cz + d / 2 });
  }
  for (let z = -d / 2 + stap / 2; z <= d / 2; z += stap * 2) {
    k.blok(0.25, 0.35, stap, kleur, { x: cx - w / 2, y, z: cz + z });
    k.blok(0.25, 0.35, stap, kleur, { x: cx + w / 2, y, z: cz + z });
  }
}

export function boogVorm(w, h, gatW, gatH) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
  const gat = new THREE.Path();
  const r = gatW / 2;
  gat.moveTo(-r, 0);
  gat.lineTo(-r, gatH - r);
  gat.absarc(0, gatH - r, r, Math.PI, 0, true);
  gat.lineTo(r, 0);
  gat.closePath();
  s.holes.push(gat);
  return s;
}

export function rnd(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export { THREE };
