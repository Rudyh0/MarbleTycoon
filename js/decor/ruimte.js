// Space: raketten, ufo's, planeten en een maanbasis.
import { M, deel, figuur, wiel, rnd } from './hulp.js';

const WIT = '#eef1f5';
const GRIJS = '#9aa3ae';

export default [
  {
    id: 'raket', naam: 'Raket', tegels: 1,
    maak: () => M((k, g) => {
      k.cil(0.45, 0.45, 4.2, WIT, { y: 0.6, seg: 16, mat: 'glans' });
      k.cil(0.46, 0.46, 0.5, '#e74c3c', { y: 2.3, seg: 16 });
      k.draai([[0.45, 0], [0.4, 0.6], [0.25, 1.1], [0.0, 1.5]], '#e74c3c', { y: 4.8, seg: 16 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        k.blok(0.06, 1.1, 0.6, '#e74c3c', { x: Math.cos(a) * 0.55, y: 0.5, z: Math.sin(a) * 0.55, ry: -a + Math.PI / 2 });
      }
      k.cil(0.35, 0.28, 0.6, '#5d6670', { y: 0.05, mat: 'metaal' });
      k.cil(0.16, 0.16, 0.05, '#7fd0ff', { y: 3.5, z: 0.43, rx: Math.PI / 2, midden: true, mat: 'gloei' });
      g.add(deel('vlam', (v) => {
        v.kegel(0.26, 0.8, '#ffb347', { y: -0.8, rx: Math.PI, mat: 'gloei', midden: false });
        v.kegel(0.15, 0.55, '#fff3c4', { y: -0.55, rx: Math.PI, mat: 'gloei' });
      }, [0, 0.2, 0]));
    }),
    anim: (g, t) => { const v = g.getObjectByName('vlam'); if (v) { const s = 0.85 + Math.sin(t * 25) * 0.15; v.scale.set(s, 0.8 + Math.sin(t * 31) * 0.25, s); } },
  },
  {
    id: 'lanceertoren', naam: 'Lanceertoren', tegels: 1,
    maak: () => M((k) => {
      k.blok(1.8, 0.3, 1.8, '#5d6670', {});
      for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) k.blok(0.08, 6, 0.08, '#e74c3c', { x, y: 0.3, z, mat: 'metaal' });
      for (let y = 0.8; y < 6.2; y += 0.7) {
        k.blok(0.78, 0.06, 0.06, '#e74c3c', { y, z: 0.35 });
        k.blok(0.78, 0.06, 0.06, '#e74c3c', { y, z: -0.35 });
        k.blok(0.06, 0.06, 0.78, '#e74c3c', { x: 0.35, y });
        k.blok(0.06, 0.06, 0.78, '#e74c3c', { x: -0.35, y });
      }
      k.blok(1.2, 0.1, 0.25, GRIJS, { x: 0.8, y: 4.4, mat: 'metaal' });
      k.bol(0.08, '#ff3b30', { y: 6.4, mat: 'gloei' });
    }),
  },
  {
    id: 'schotel', naam: 'Schotelantenne', tegels: 1,
    maak: () => M((k, g) => {
      k.cil(0.3, 0.4, 0.3, GRIJS, { seg: 10 });
      k.cil(0.08, 0.1, 1.4, '#c9ced6', { y: 0.3, mat: 'metaal' });
      g.add(deel('schotel', (s) => {
        s.draai([[0.02, 0], [0.4, 0.06], [0.75, 0.22], [0.95, 0.42]], WIT, { rx: -1.0, mat: 'dubbel', seg: 20 });
        s.cil(0.02, 0.02, 0.7, '#c9ced6', { rx: -1.0, mat: 'metaal' });
        s.bol(0.06, '#ff3b30', { y: 0.37, z: 0.55, mat: 'gloei' });
      }, [0, 1.75, 0]));
    }),
    anim: (g, t) => { const s = g.getObjectByName('schotel'); if (s) s.rotation.y = t * 0.35; },
  },
  {
    id: 'maanlander', naam: 'Maanlander', tegels: 1,
    maak: () => M((k) => {
      k.blok(1.0, 0.6, 1.0, '#d4a63a', { y: 0.7, mat: 'metaal' });
      k.cil(0.45, 0.55, 0.6, '#d9dde3', { y: 1.3, seg: 8 });
      k.blok(0.25, 0.25, 0.04, '#1d2733', { y: 1.5, z: 0.47, mat: 'glans' });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        k.cil(0.03, 0.03, 1.0, '#c9ced6', { x: Math.cos(a) * 0.65, y: 0.0, z: Math.sin(a) * 0.65, rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5, mat: 'metaal' });
        k.cil(0.12, 0.14, 0.04, '#c9ced6', { x: Math.cos(a) * 0.85, z: Math.sin(a) * 0.85 });
      }
      k.cil(0.02, 0.02, 0.6, '#c9ced6', { x: 0.3, y: 1.8, mat: 'metaal' });
    }),
  },
  {
    id: 'planeet', naam: 'Zwevende planeet', tegels: 1, zweeft: 3.5,
    maak: () => M((k, g) => {
      g.add(deel('bol', (b) => {
        b.bol(0.9, '#e08a4a', { seg: 22 });
        b.bol(0.905, '#c9663a', { seg: 22, sy: 0.25 });
        b.ring(1.4, 0.1, '#e8d7b5', { rx: Math.PI / 2 + 0.35, seg: 40, rseg: 3, sz: 0.25 });
        b.ring(1.65, 0.06, '#cdb48c', { rx: Math.PI / 2 + 0.35, seg: 40, rseg: 3, sz: 0.25 });
      }, [0, 3.5, 0]));
      k.cil(0.4, 0.5, 0.1, '#2b2f36', { seg: 16 });
      k.cil(0.25, 0.25, 0.02, '#5ff2ff', { y: 0.1, mat: 'gloei', seg: 16 });
    }),
    anim: (g, t) => { const b = g.getObjectByName('bol'); if (b) { b.rotation.y = t * 0.3; b.position.y = 3.5 + Math.sin(t) * 0.2; } },
  },
  {
    id: 'astronaut', naam: 'Astronaut', tegels: 0.5,
    maak: () => M((k) => {
      figuur(k, { shirt: WIT, broek: WIT, huid: WIT, s: 1.05 });
      k.bol(0.14, WIT, { y: 0.86, seg: 12 });
      k.bol(0.1, '#f2b33a', { x: 0.07, y: 0.87, sx: 0.7, mat: 'metaal' });
      k.blok(0.16, 0.3, 0.24, GRIJS, { x: -0.16, y: 0.4 });
      k.cil(0.01, 0.01, 0.9, '#c9ced6', { x: 0.3, mat: 'metaal' });
      k.blok(0.3, 0.2, 0.01, '#2e5c9a', { x: 0.3, y: 0.78, z: 0.15, ry: Math.PI / 2 });
    }),
  },
  {
    id: 'ufo', naam: 'Ufo', tegels: 1, zweeft: 3,
    maak: () => M((k, g) => {
      g.add(deel('schijf', (s) => {
        s.bol(1.1, '#aab4c0', { sy: 0.22, seg: 24, mat: 'metaal' });
        s.bol(0.45, '#9ff3c9', { y: 0.12, half: true, seg: 16, mat: 'glans' });
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          s.bol(0.06, i % 2 ? '#ffe66d' : '#5ff2ff', { x: Math.cos(a) * 0.92, y: -0.06, z: Math.sin(a) * 0.92, mat: 'gloei' });
        }
        s.kegel(0.6, 2.6, '#9ff3c9', { y: -2.75, mat: 'glas', seg: 16 });
      }, [0, 3, 0]));
    }),
    anim: (g, t) => { const s = g.getObjectByName('schijf'); if (s) { s.rotation.y = t * 1.2; s.position.y = 3 + Math.sin(t * 1.7) * 0.25; } },
  },
  {
    id: 'koepel', naam: 'Maanbasis', tegels: 2,
    maak: () => M((k) => {
      k.cil(1.6, 1.7, 0.3, GRIJS, { seg: 20 });
      k.bol(1.5, '#ffffff', { y: 0.3, half: true, seg: 22, mat: 'glas' });
      k.bol(0.5, '#4f9a45', { y: 0.3, seg: 10 });
      k.cil(0.08, 0.1, 0.8, '#6b4a30', { y: 0.3 });
      k.blok(1.0, 0.8, 0.9, WIT, { x: 1.9, mat: 'glans' });
      k.blok(0.02, 0.4, 0.5, '#7fd0ff', { x: 2.41, y: 0.2, mat: 'gloei' });
      k.ring(1.5, 0.05, '#c9ced6', { y: 0.32, rx: Math.PI / 2, seg: 40 });
      figuur(k, { x: 0.6, z: 0.4, shirt: '#2e86de', broek: WIT, s: 0.7 });
    }),
  },
  {
    id: 'rover', naam: 'Maanrover', tegels: 1,
    maak: () => M((k) => {
      k.blok(1.3, 0.25, 0.8, WIT, { y: 0.35, mat: 'glans' });
      for (const x of [-0.5, 0, 0.5]) for (const z of [-0.48, 0.48]) wiel(k, x, 0.2, z, 0.2, 0.14, '#3b3f46');
      k.blok(0.5, 0.05, 0.7, '#2e5c9a', { x: -0.3, y: 0.62, mat: 'glans' });
      k.cil(0.03, 0.03, 0.5, '#c9ced6', { x: 0.45, y: 0.6, mat: 'metaal' });
      k.blok(0.22, 0.14, 0.14, '#3b3f46', { x: 0.45, y: 1.1 });
      k.bol(0.04, '#5ff2ff', { x: 0.57, y: 1.17, mat: 'gloei' });
    }),
  },
  {
    id: 'kristallen', naam: 'Kristallen', tegels: 1,
    maak: () => M((k) => {
      const r = rnd(4);
      for (let i = 0; i < 7; i++) {
        const a = r() * 6.28, d = r() * 0.6;
        const h = 0.5 + r() * 1.2;
        const c = ['#7fe9ff', '#b48cff', '#5ff2c0'][i % 3];
        k.cil(0.0, 0.12 + r() * 0.1, h, c, { x: Math.cos(a) * d, z: Math.sin(a) * d, seg: 5, rz: (r() - 0.5) * 0.6, rx: (r() - 0.5) * 0.6, mat: 'gloei' });
      }
      k.cil(0.9, 1.0, 0.12, '#4a4540', { seg: 9 });
    }),
  },
  {
    id: 'asteroide', naam: 'Asteroïde', tegels: 1, zweeft: 4,
    maak: () => M((k, g) => {
      g.add(deel('rots', (s) => {
        s.bol(0.8, '#6f6a63', { seg: 7, sx: 1.2, sy: 0.85 });
        s.bol(0.4, '#5d5852', { x: 0.6, y: 0.3, seg: 6 });
        s.bol(0.3, '#7d776f', { x: -0.5, y: -0.35, z: 0.3, seg: 6 });
        s.bol(0.15, '#4a4540', { x: 0.1, y: 0.55, z: 0.5, seg: 5 });
      }, [0, 4, 0]));
    }),
    anim: (g, t) => { const s = g.getObjectByName('rots'); if (s) { s.rotation.x = t * 0.2; s.rotation.y = t * 0.31; s.position.y = 4 + Math.sin(t * 0.6) * 0.3; } },
  },
  {
    id: 'zonnepanelen', naam: 'Zonnepanelen', tegels: 2,
    maak: () => M((k) => {
      for (let i = 0; i < 3; i++) {
        const x = -1.2 + i * 1.2;
        k.cil(0.04, 0.05, 0.6, '#c9ced6', { x, mat: 'metaal' });
        k.blok(1.0, 0.04, 1.4, '#1e3d73', { x, y: 0.65, rz: 0.4, mat: 'glans' });
        for (let j = 0; j < 4; j++) k.blok(1.02, 0.045, 0.02, '#c9ced6', { x, y: 0.65, z: -0.6 + j * 0.4, rz: 0.4 });
      }
    }),
  },
  {
    id: 'ruimtestation', naam: 'Ruimtestation', tegels: 2, zweeft: 6,
    maak: () => M((k, g) => {
      g.add(deel('station', (s) => {
        s.cil(0.35, 0.35, 2.4, WIT, { rz: Math.PI / 2, midden: true, seg: 12, mat: 'glans' });
        s.cil(0.3, 0.3, 1.4, '#d9dde3', { rx: Math.PI / 2, midden: true, seg: 12 });
        s.bol(0.42, WIT, { seg: 12 });
        for (const x of [-1.7, 1.7]) s.blok(0.9, 0.03, 2.2, '#1e3d73', { x, mat: 'glans' });
        s.ring(1.0, 0.06, '#c9ced6', { seg: 30, mat: 'metaal' });
        s.bol(0.06, '#5ff2ff', { z: 0.72, mat: 'gloei' });
      }, [0, 6, 0]));
    }),
    anim: (g, t) => { const s = g.getObjectByName('station'); if (s) { s.rotation.y = t * 0.15; s.position.y = 6 + Math.sin(t * 0.5) * 0.2; } },
  },
  {
    id: 'maankrater', naam: 'Maankrater', tegels: 2, plat: true,
    maak: () => M((k) => {
      k.cil(1.9, 2.0, 0.08, '#8e8f93', { seg: 22 });
      k.ring(1.5, 0.22, '#a4a5a9', { y: 0.12, rx: Math.PI / 2, seg: 28, rseg: 5 });
      k.cil(1.25, 1.25, 0.06, '#6f7074', { y: 0.05, seg: 22 });
      k.bol(0.18, '#7d7e82', { x: 0.9, y: 0.1, z: 1.4, seg: 6 });
    }),
  },
];
