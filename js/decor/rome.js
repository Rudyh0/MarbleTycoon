// Romeinse tijd: tempels, zuilen, het Colosseum en meer.
import { M, boogVorm, figuur, wiel, rnd, THREE } from './hulp.js';

const MARMER = '#ece6da';
const STEEN = '#d9c9a8';
const TERRA = '#c1643a';

function zuil(k, x, z, h, r = 0.18, kleur = MARMER) {
  k.cil(r * 1.45, r * 1.5, 0.14, kleur, { x, z, seg: 10 });
  k.cil(r, r * 1.08, h - 0.32, kleur, { x, y: 0.14, z, seg: 12 });
  k.cil(r * 1.4, r * 1.05, 0.1, kleur, { x, y: h - 0.18, z, seg: 10 });
  k.blok(r * 3.1, 0.08, r * 3.1, kleur, { x, y: h - 0.08, z });
}

export default [
  {
    id: 'zuil', naam: 'Zuil', tegels: 0.5,
    maak: () => M((k) => zuil(k, 0, 0, 2.6)),
  },
  {
    id: 'tempel', naam: 'Tempel', tegels: 2,
    maak: () => M((k) => {
      for (let i = 0; i < 3; i++) k.blok(4.4 - i * 0.25, 0.18, 3.4 - i * 0.25, STEEN, { y: i * 0.18 });
      const xs = [-1.65, -1.0, -0.33, 0.33, 1.0, 1.65];
      for (const x of xs) { zuil(k, x, 1.3, 2.4); zuil(k, x, -1.3, 2.4); }
      for (const z of [-0.65, 0, 0.65]) { zuil(k, 1.65, z, 2.4); zuil(k, -1.65, z, 2.4); }
      k.blok(2.6, 2.3, 1.8, '#e2d6bf', { y: 0.54 });
      k.blok(4.1, 0.3, 3.1, MARMER, { y: 2.94 });
      k.zadeldak(4.2, 3.3, 0.8, TERRA, { y: 3.24 });
      k.blok(0.05, 0.5, 1.1, '#c4a35a', { x: 2.1, y: 3.3, ry: 0 });
    }),
  },
  {
    id: 'colosseum', naam: 'Colosseum', tegels: 3,
    maak: () => M((k) => {
      const R = 2.6, n = 24;
      for (let lvl = 0; lvl < 3; lvl++) {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const x = Math.cos(a) * R, z = Math.sin(a) * R;
          k.blok(0.22, 1.0, 0.42, STEEN, { x, y: lvl * 1.15, z, ry: -a });
        }
        k.ring(R, 0.12, '#cdb995', { y: lvl * 1.15 + 1.05, rx: Math.PI / 2, seg: 40, rseg: 4 });
      }
      k.ring(R, 0.18, '#cdb995', { y: 3.5, rx: Math.PI / 2, seg: 40, rseg: 4 });
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        if (a > 2.4 && a < 3.9) continue;
        k.blok(0.4, 0.8, 0.12, '#d2bf99', { x: Math.cos(a) * R, y: 3.45, z: Math.sin(a) * R, ry: -a + Math.PI / 2 });
      }
      k.cil(R - 0.25, R - 0.25, 0.05, '#e7d7a8', { seg: 28 });
      for (let i = 0; i < 3; i++) k.ring(R - 0.45 - i * 0.35, 0.16, '#bba982', { y: 0.3 + i * 0.45, rx: Math.PI / 2, seg: 34, rseg: 4, boog: Math.PI * 1.6, rz: 0.3 });
    }),
  },
  {
    id: 'aquaduct', naam: 'Aquaduct', tegels: 3,
    maak: () => M((k) => {
      const v = boogVorm(1.6, 2.4, 1.05, 1.95);
      for (let i = 0; i < 3; i++) k.vorm(v, 0.6, STEEN, { x: -1.6 + i * 1.6 });
      const v2 = boogVorm(0.8, 1.1, 0.5, 0.85);
      for (let i = 0; i < 6; i++) k.vorm(v2, 0.55, '#d4c3a0', { x: -2.0 + i * 0.8, y: 2.4 });
      k.blok(4.9, 0.18, 0.7, '#c9b88f', { y: 3.5 });
      k.blok(4.9, 0.12, 0.4, '#5fb3e8', { y: 3.62, mat: 'glans' });
    }),
  },
  {
    id: 'triomfboog', naam: 'Triomfboog', tegels: 2,
    maak: () => M((k) => {
      k.vorm(boogVorm(3.2, 3.0, 1.3, 2.3), 1.0, MARMER, {});
      k.blok(3.4, 0.9, 1.1, '#e2dbcd', { y: 3.0 });
      k.blok(1.9, 0.35, 0.05, '#c4a35a', { y: 3.25, z: 0.56 });
      for (const x of [-1.3, 1.3]) for (const z of [0.55, -0.55]) zuil(k, x, z, 2.9, 0.1);
      figuur(k, { x: 0, z: 0, s: 0.9, shirt: '#c4a35a', broek: '#c4a35a', huid: '#c4a35a', helm: '#c4a35a' });
    }),
  },
  {
    id: 'standbeeld', naam: 'Standbeeld', tegels: 0.5,
    maak: () => M((k) => {
      k.blok(0.7, 0.9, 0.7, '#cfc6b4', {});
      k.blok(0.8, 0.1, 0.8, '#e2dbcd', { y: 0.9 });
      k.blok(0.18, 0.6, 0.12, MARMER, { x: -0.07, y: 1.0 });
      k.blok(0.18, 0.6, 0.12, MARMER, { x: 0.07, y: 1.0 });
      k.blok(0.36, 0.5, 0.22, MARMER, { y: 1.6 });
      k.bol(0.13, MARMER, { y: 2.25 });
      k.blok(0.07, 0.5, 0.07, MARMER, { x: 0.22, y: 1.75, rz: -2.6 });
      k.blok(0.38, 0.3, 0.06, MARMER, { y: 1.6, z: -0.13, rx: 0.2 });
    }),
  },
  {
    id: 'amforen', naam: 'Amforen', tegels: 0.5,
    maak: () => M((k) => {
      const prof = [[0.02, 0], [0.12, 0.05], [0.2, 0.25], [0.18, 0.45], [0.07, 0.55], [0.06, 0.7], [0.09, 0.72]];
      for (const [x, z, s, c] of [[0, 0, 1, TERRA], [0.3, 0.15, 0.8, '#a9552f'], [-0.15, 0.3, 0.7, '#d07a4a']]) {
        k.draai(prof.map(([r, y]) => [r * s, y * s]), c, { x, z, seg: 12 });
        k.ring(0.06 * s, 0.015, c, { x: x + 0.1 * s, y: 0.6 * s, z, seg: 8 });
      }
    }),
  },
  {
    id: 'strijdwagen', naam: 'Strijdwagen', tegels: 1,
    maak: () => M((k) => {
      k.blok(0.7, 0.4, 0.8, '#c4a35a', { y: 0.3, mat: 'metaal' });
      k.blok(0.7, 0.3, 0.06, '#9c2b23', { y: 0.45, z: 0.4 });
      k.blok(0.7, 0.3, 0.06, '#9c2b23', { y: 0.45, z: -0.4 });
      wiel(k, -0.1, 0.35, 0.48, 0.35, 0.06, '#6b4a30');
      wiel(k, -0.1, 0.35, -0.48, 0.35, 0.06, '#6b4a30');
      k.blok(1.2, 0.05, 0.05, '#6b4a30', { x: 0.8, y: 0.4 });
      // paard
      k.blok(0.9, 0.4, 0.3, '#8a5a3c', { x: 1.55, y: 0.7 });
      for (const [x, z] of [[1.25, 0.1], [1.25, -0.1], [1.85, 0.1], [1.85, -0.1]]) k.blok(0.08, 0.7, 0.08, '#7a4e33', { x, z });
      k.blok(0.25, 0.5, 0.2, '#8a5a3c', { x: 2.05, y: 0.95, rz: -0.5 });
      k.blok(0.35, 0.18, 0.16, '#8a5a3c', { x: 2.25, y: 1.3 });
      k.blok(0.4, 0.08, 0.06, '#2b1d14', { x: 1.95, y: 1.25, rz: -0.6 });
      figuur(k, { x: -0.05, z: 0, s: 0.75, shirt: '#9c2b23', broek: '#9c2b23', helm: '#c4a35a' });
    }),
  },
  {
    id: 'cipres', naam: 'Cipres', tegels: 0.5,
    maak: () => M((k) => {
      k.cil(0.06, 0.08, 0.4, '#6b4a30', {});
      k.bol(0.38, '#2f5b37', { y: 1.5, sy: 3.2, sx: 0.9, sz: 0.9, seg: 9 });
    }),
  },
  {
    id: 'ruine', naam: 'Ruïne', tegels: 2,
    maak: () => M((k) => {
      const r = rnd(7);
      k.blok(3.6, 0.2, 2.4, STEEN, {});
      const hoogtes = [2.4, 1.3, 2.4, 0.8, 1.8];
      hoogtes.forEach((h, i) => zuil(k, -1.5 + i * 0.75, -0.8, h, 0.16));
      zuil(k, 1.5, 0.7, 1.1, 0.16);
      k.blok(1.6, 0.25, 0.5, MARMER, { x: -1.15, y: 2.4, z: -0.8 });
      for (let i = 0; i < 6; i++) k.blok(0.4 + r() * 0.4, 0.25, 0.3 + r() * 0.3, i % 2 ? STEEN : MARMER, { x: -1.2 + r() * 2.6, y: 0.2, z: 0.1 + r() * 0.9, ry: r() * 3 });
      k.cil(0.17, 0.17, 1.4, MARMER, { x: 0.3, y: 0.38, z: 0.7, rz: Math.PI / 2, midden: true, ry: 0.5, volgorde: 'YXZ' });
    }),
  },
  {
    id: 'obelisk', naam: 'Obelisk', tegels: 0.5,
    maak: () => M((k) => {
      k.blok(0.9, 0.3, 0.9, '#cfc6b4', {});
      k.cil(0.22, 0.34, 4.2, '#d8c9a5', { y: 0.3, seg: 4, ry: Math.PI / 4 });
      k.kegel(0.24, 0.45, '#c4a35a', { y: 4.5, seg: 4, ry: Math.PI / 4, mat: 'metaal' });
    }),
  },
  {
    id: 'villa', naam: 'Romeinse villa', tegels: 2,
    maak: () => M((k) => {
      k.blok(3.4, 0.15, 3.0, '#d7cdb8', {});
      k.blok(3.2, 1.6, 0.4, '#f1ebdd', { y: 0.15, z: -1.3 });
      k.blok(0.4, 1.6, 2.6, '#f1ebdd', { x: -1.4, y: 0.15 });
      k.blok(0.4, 1.6, 2.6, '#f1ebdd', { x: 1.4, y: 0.15 });
      k.zadeldak(3.4, 0.9, 0.5, TERRA, { y: 1.75, z: -1.3 });
      k.zadeldak(2.6, 0.9, 0.5, TERRA, { x: -1.4, y: 1.75, ry: Math.PI / 2 });
      k.zadeldak(2.6, 0.9, 0.5, TERRA, { x: 1.4, y: 1.75, ry: Math.PI / 2 });
      k.blok(1.4, 0.06, 1.2, '#5fb3e8', { y: 0.15, z: 0.3, mat: 'glans' });
      for (const x of [-0.9, 0, 0.9]) zuil(k, x, 1.2, 1.7, 0.09);
      k.blok(2.6, 0.12, 0.3, '#e9e1cf', { y: 1.7, z: 1.2 });
    }),
  },
  {
    id: 'vuurschaal', naam: 'Vuurschaal', tegels: 0.5,
    maak: () => M((k) => {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        k.cil(0.025, 0.03, 1.0, '#6c5a3a', { x: Math.cos(a) * 0.18, z: Math.sin(a) * 0.18, rz: Math.cos(a) * 0.25, rx: -Math.sin(a) * 0.25, mat: 'metaal' });
      }
      k.draai([[0.02, 0], [0.32, 0.12], [0.36, 0.2]], '#8a6d3b', { y: 0.95, mat: 'metaal' });
      k.bol(0.24, '#ff9a3c', { y: 1.0, sy: 0.45, mat: 'gloei' });
      k.kegel(0.16, 0.36, '#ffd36b', { y: 1.06, mat: 'gloei' });
    }),
    licht: { kleur: 0xff8a3a, y: 1.4, sterkte: 2 },
  },
  {
    id: 'legionair', naam: 'Legionairs', tegels: 1,
    maak: () => M((k) => {
      for (let i = 0; i < 3; i++) {
        const z = (i - 1) * 0.45;
        figuur(k, { x: 0, z, shirt: '#9c2b23', broek: '#c4a35a', helm: '#c4a35a' });
        k.blok(0.06, 0.45, 0.32, '#9c2b23', { x: 0.17, y: 0.3, z });
        k.blok(0.07, 0.07, 0.07, '#c4a35a', { x: 0.21, y: 0.5, z });
        k.cil(0.012, 0.012, 1.3, '#6b4a30', { x: -0.06, y: 0.1, z: z + 0.18 });
        k.kegel(0.03, 0.12, '#c9ced6', { x: -0.06, y: 1.4, z: z + 0.18, mat: 'metaal' });
      }
    }),
  },
].map((x) => x);

void THREE;
