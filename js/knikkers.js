// Knikkerskins: getekende texturen en materialen.

import * as THREE from '../lib/three.min.js';

// ------------------------------------------------------------------ ruis

function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function ruis3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}
function fbm(x, y, z, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * ruis3(x * f, y * f, z * f); a *= 0.5; f *= 2.03; }
  return s;
}

// Tekent een bolkaart (equirectangulair): f(lon, lat, x, y, z) -> [r, g, b] (0..255)
function bolkaart(w, h, f) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * Math.PI * 2;
      const x = cl * Math.cos(lon), z = cl * Math.sin(lon), y = sl;
      const [r, gg, b] = f(lon, lat, x, y, z);
      const k = (j * w + i) * 4;
      img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function canvasTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const klem = (v) => Math.min(1, Math.max(0, v));

function kattenoogKaart(basis, vaan1, vaan2) {
  const b = hex(basis), v1 = hex(vaan1), v2 = hex(vaan2);
  return bolkaart(256, 128, (lon, lat, x, y, z) => {
    let k = b;
    const draai = lon * 3 + Math.sin(lat * 2.2) * 1.6;
    const vaan = Math.exp(-Math.pow(Math.sin(draai), 2) / 0.035) * (0.4 + 0.6 * Math.cos(lat));
    k = mix(k, Math.sin(draai * 0.5) > 0 ? v1 : v2, klem(vaan * 1.1));
    const glans = 0.9 + 0.1 * fbm(x * 3, y * 3, z * 3);
    return [k[0] * glans, k[1] * glans, k[2] * glans];
  });
}

function hsl(h, s, l) {
  const c = new THREE.Color().setHSL(h, s, l);
  return [c.r * 255, c.g * 255, c.b * 255];
}

// ------------------------------------------------------------------ skins

export const SKINS = [
  { id: 'kattenoog', naam: 'Kattenoog', soort: 'glas', kaart: () => kattenoogKaart(0xbfeaf3, 0x1f63d6, 0xffffff) },
  { id: 'vuuroog', naam: 'Vuuroog', soort: 'glas', kaart: () => kattenoogKaart(0xffe3cf, 0xe2361b, 0xffb000) },
  { id: 'groenoog', naam: 'Groenoog', soort: 'glas', kaart: () => kattenoogKaart(0xdaf7d2, 0x1f9a3d, 0xf4ff7a) },
  { id: 'paarsoog', naam: 'Paarsoog', soort: 'glas', kaart: () => kattenoogKaart(0xeadcff, 0x6a2bd6, 0xff7ae0) },
  {
    id: 'regenboog', naam: 'Regenboog', soort: 'glas', kaart: () => bolkaart(256, 128, (lon, lat, x, y, z) => {
      const h = (lon / (Math.PI * 2) + lat * 0.25 + fbm(x * 2, y * 2, z * 2) * 0.3) % 1;
      return hsl(h, 0.85, 0.58);
    }),
  },
  { id: 'staal', naam: 'Staal', soort: 'metaal', kleur: 0xe9edf2, ruw: 0.12 },
  { id: 'goud', naam: 'Goud', soort: 'metaal', kleur: 0xf3c54a, ruw: 0.2 },
  { id: 'koper', naam: 'Koper', soort: 'metaal', kleur: 0xdc8350, ruw: 0.25 },
  {
    id: 'aarde', naam: 'Aarde', soort: 'mat', kaart: () => bolkaart(256, 128, (lon, lat, x, y, z) => {
      const n = fbm(x * 2.2 + 3, y * 2.2, z * 2.2, 5);
      const wolk = fbm(x * 4 + 9, y * 4, z * 4, 4);
      let k = n > 0.52 ? mix(hex(0x4f8f3a), hex(0x9a7b4f), klem((n - 0.55) * 6)) : mix(hex(0x1a4fa0), hex(0x2f7fd0), klem(n * 2 - 0.3));
      if (Math.abs(lat) > 1.25) k = hex(0xf4f8ff);
      if (wolk > 0.6) k = mix(k, [255, 255, 255], klem((wolk - 0.6) * 4));
      return k;
    }),
  },
  {
    id: 'maan', naam: 'Maan', soort: 'mat', kaart: () => bolkaart(256, 128, (lon, lat, x, y, z) => {
      const n = fbm(x * 3, y * 3, z * 3, 5);
      const krater = fbm(x * 8 + 5, y * 8, z * 8, 2);
      let v = 150 + n * 70;
      if (krater > 0.62) v -= (krater - 0.62) * 260;
      return [v, v, v * 1.02];
    }),
  },
  {
    id: 'mars', naam: 'Mars', soort: 'mat', kaart: () => bolkaart(256, 128, (lon, lat, x, y, z) => {
      const n = fbm(x * 2.5 + 1, y * 2.5, z * 2.5, 5);
      let k = mix(hex(0xb24a24), hex(0xe58a4d), n);
      if (Math.abs(lat) > 1.3) k = mix(k, hex(0xf7e9dd), 0.8);
      return k;
    }),
  },
  {
    id: 'lava', naam: 'Lava', soort: 'lava', kaart: () => bolkaart(256, 128, (lon, lat, x, y, z) => {
      const n = fbm(x * 3, y * 3, z * 3, 5);
      const scheur = Math.abs(n - 0.5);
      return scheur < 0.05 ? mix(hex(0xffd25a), hex(0xff4a10), scheur / 0.05) : mix(hex(0x1a1414), hex(0x3a2a24), fbm(x * 9, y * 9, z * 9));
    }),
  },
  {
    id: 'galaxy', naam: 'Melkweg', soort: 'glans', kaart: () => bolkaart(256, 128, (lon, lat, x, y, z) => {
      const n = fbm(x * 2 + 7, y * 2, z * 2, 5);
      let k = mix(hex(0x0b0726), hex(0x5a1f8a), klem(n * 1.6 - 0.4));
      k = mix(k, hex(0x2d7cff), klem(fbm(x * 3, y * 3 + 4, z * 3) * 1.6 - 0.8));
      if (hash3(Math.floor(lon * 90), Math.floor(lat * 90), 3) > 0.985) k = [255, 255, 255];
      return k;
    }),
  },
  { id: 'neon', naam: 'Neon', soort: 'neon', kleur: 0x39ff88 },
  { id: 'neonroze', naam: 'Neon roze', soort: 'neon', kleur: 0xff3fd2 },
  {
    id: 'marmer', naam: 'Marmer', soort: 'glans', kaart: () => bolkaart(256, 128, (lon, lat, x, y, z) => {
      const ader = Math.abs(Math.sin((x * 3 + fbm(x * 2, y * 2, z * 2, 5) * 6) * 2.2));
      const k = mix(hex(0x5c6370), hex(0xf2f0ea), klem(ader * 1.6));
      return k;
    }),
  },
  {
    id: 'hout', naam: 'Hout', soort: 'mat', kaart: () => bolkaart(256, 128, (lon, lat, x, y, z) => {
      const r = Math.hypot(x, z) * 9 + fbm(x * 3, y * 3, z * 3) * 3;
      const ring = 0.5 + 0.5 * Math.sin(r * 2.4);
      return mix(hex(0x8a5a32), hex(0xc58a55), ring);
    }),
  },
  {
    id: 'watermeloen', naam: 'Watermeloen', soort: 'glans', kaart: () => bolkaart(256, 128, (lon, lat, x, y, z) => {
      const s = Math.sin(lon * 7 + fbm(x * 3, y * 3, z * 3) * 2.5);
      return s > 0.25 ? hex(0x1f6b2a) : hex(0x6fc24a);
    }),
  },
  {
    id: 'strandbal', naam: 'Strandbal', soort: 'glans', kaart: () => bolkaart(256, 128, (lon, lat) => {
      if (Math.abs(lat) > 1.3) return hex(0xffffff);
      const kleuren = [0xff4040, 0xffffff, 0x2f7cff, 0xffd23a, 0xffffff, 0x3ad16b];
      return hex(kleuren[Math.floor((lon / (Math.PI * 2)) * 6) % 6]);
    }),
  },
  {
    id: 'snoep', naam: 'Snoep', soort: 'glans', kaart: () => bolkaart(256, 128, (lon, lat) => {
      return Math.sin(lon * 4 + lat * 5) > 0 ? hex(0xff5c9a) : hex(0xfff3f7);
    }),
  },
  {
    id: 'smiley', naam: 'Smiley', soort: 'glans', kaart: () => bolkaart(256, 128, (lon, lat) => {
      const dl = (l) => { let d = lon - l; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
      const oogL = Math.hypot(dl(Math.PI - 0.32), lat - 0.3) < 0.12;
      const oogR = Math.hypot(dl(Math.PI + 0.32), lat - 0.3) < 0.12;
      const r = Math.hypot(dl(Math.PI), lat + 0.05);
      const mond = r > 0.5 && r < 0.6 && lat < -0.1;
      return oogL || oogR || mond ? hex(0x2a1a00) : hex(0xffd23a);
    }),
  },
  {
    id: 'oog', naam: 'Oogbal', soort: 'glans', kaart: () => bolkaart(256, 128, (lon, lat, x, y, z) => {
      let d = lon - Math.PI; while (d > Math.PI) d -= Math.PI * 2;
      const r = Math.hypot(d, lat);
      if (r < 0.16) return hex(0x080808);
      if (r < 0.42) return mix(hex(0x2b7bd6), hex(0x7fd0ff), fbm(x * 12, y * 12, z * 12));
      const ader = Math.abs(Math.sin(lon * 13 + fbm(x * 4, y * 4, z * 4) * 5)) < 0.04 && r > 0.7;
      return ader ? hex(0xd03a3a) : hex(0xfbf6f0);
    }),
  },
  {
    id: 'disco', naam: 'Discobal', soort: 'disco', kaart: () => bolkaart(256, 128, (lon, lat) => {
      const i = Math.floor(lon * 8), j = Math.floor(lat * 8);
      const lijn = (lon * 8) % 1 < 0.08 || (lat * 8 + 100) % 1 < 0.08;
      const v = 150 + hash3(i, j, 1) * 105;
      return lijn ? [40, 40, 50] : [v, v, v + 10];
    }),
  },
  { id: 'ijs', naam: 'IJs', soort: 'ijs', kleur: 0xcff2ff },
  { id: 'kanonskogel', naam: 'Kanonskogel', soort: 'metaal', kleur: 0x2a2c30, ruw: 0.55 },
  {
    id: 'basketbal', naam: 'Basketbal', soort: 'mat', kaart: () => bolkaart(256, 128, (lon, lat) => {
      const lijn = Math.abs(lat) < 0.03 || Math.abs(Math.sin(lon)) < 0.03 || Math.abs(Math.cos(lon * 1) * Math.cos(lat) - 0) < 0.025;
      return lijn ? hex(0x1a0c05) : hex(0xe0722a);
    }),
  },
];

export const SKIN_MAP = new Map(SKINS.map((s) => [s.id, s]));

const matCache = new Map();

export function skinMateriaal(id) {
  if (matCache.has(id)) return matCache.get(id);
  const s = SKIN_MAP.get(id) || SKINS[0];
  let m;
  const kaart = s.kaart ? canvasTex(s.kaart()) : null;
  switch (s.soort) {
    case 'glas':
      m = new THREE.MeshPhysicalMaterial({ map: kaart, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6 });
      break;
    case 'metaal':
      m = new THREE.MeshStandardMaterial({ color: s.kleur, roughness: s.ruw ?? 0.15, metalness: 1, envMapIntensity: 1.8 });
      break;
    case 'disco':
      m = new THREE.MeshStandardMaterial({ map: kaart, roughness: 0.18, metalness: 1, envMapIntensity: 2 });
      break;
    case 'lava':
      m = new THREE.MeshStandardMaterial({ map: kaart, emissiveMap: kaart, emissive: 0xff7a2a, emissiveIntensity: 0.9, roughness: 0.7 });
      break;
    case 'neon':
      m = new THREE.MeshStandardMaterial({ color: s.kleur, emissive: s.kleur, emissiveIntensity: 1.4, roughness: 0.3 });
      break;
    case 'ijs':
      m = new THREE.MeshPhysicalMaterial({ color: s.kleur, roughness: 0.35, metalness: 0, transparent: true, opacity: 0.82, clearcoat: 1, envMapIntensity: 1.5 });
      break;
    case 'glans':
      m = new THREE.MeshPhysicalMaterial({ map: kaart, roughness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.15 });
      break;
    default:
      m = new THREE.MeshStandardMaterial({ map: kaart, roughness: 0.65 });
  }
  if (!m.emissive) m.emissive = new THREE.Color(0);
  m.userData.basisEmissie = m.emissive.clone();
  m.userData.basisSterkte = m.emissiveIntensity ?? 1;
  matCache.set(id, m);
  return m;
}

export const KNIKKER_GEO = new THREE.SphereGeometry(1, 28, 18);
