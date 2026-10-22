// Piraten: schip, schatkist, vuurtoren en meer.
import { M, deel, figuur, wiel, THREE } from './hulp.js';

const HOUT = '#7a5232';
const HOUT2 = '#5e3e25';

function vat(k, x, y, z, s = 1, liggend = false) {
  const o = liggend ? { rz: Math.PI / 2, midden: true } : {};
  k.cil(0.2 * s, 0.2 * s, 0.5 * s, HOUT, { x, y: y + (liggend ? 0.2 * s : 0), z, seg: 10, ...o });
  k.cil(0.215 * s, 0.215 * s, 0.05 * s, '#3a3f46', { x, y: y + (liggend ? 0.2 * s : 0.1 * s), z, seg: 10, ...o, mat: 'metaal' });
}

function rompVorm(l, b) {
  const s = new THREE.Shape();
  s.moveTo(-l / 2, 0.25);
  s.quadraticCurveTo(-l / 2 + 0.1, -0.5, 0, -0.6);
  s.quadraticCurveTo(l / 2 - 0.2, -0.55, l / 2 + 0.3, 0.45);
  s.lineTo(l / 2 + 0.2, 0.55);
  s.lineTo(-l / 2, 0.7);
  s.closePath();
  void b;
  return s;
}

export default [
  {
    id: 'piratenschip', naam: 'Piratenschip', tegels: 3,
    maak: () => M((k, g) => {
      g.add(deel('schip', (s) => {
        s.vorm(rompVorm(4.2, 1.4), 1.4, HOUT2, { y: 0.6 });
        s.blok(4.0, 0.08, 1.3, HOUT, { y: 1.2 });
        s.blok(1.0, 0.5, 1.4, HOUT2, { x: -1.6, y: 1.25 });
        s.blok(4.3, 0.12, 0.05, '#c4a35a', { y: 1.1, z: 0.71 });
        s.blok(4.3, 0.12, 0.05, '#c4a35a', { y: 1.1, z: -0.71 });
        for (const x of [-0.6, 0.4, 1.3]) s.cil(0.06, 0.06, 0.1, '#1d1d1f', { x, y: 0.95, z: 0.72, rx: Math.PI / 2, midden: true });
        for (const [x, h] of [[-0.6, 3.6], [0.9, 3.0]]) {
          s.cil(0.06, 0.08, h, '#4a3220', { x, y: 1.2 });
          s.blok(0.06, 0.06, 1.6, '#4a3220', { x, y: 1.2 + h * 0.75 });
          s.blok(0.05, h * 0.42, 1.5, '#ede4cf', { x: x + 0.08, y: 1.2 + h * 0.32 });
          s.blok(0.05, h * 0.3, 1.2, '#ede4cf', { x: x + 0.08, y: 1.2 + h * 0.78 - h * 0.05 });
        }
        s.blok(0.04, 0.35, 0.55, '#111111', { x: -0.6, y: 4.85, z: 0.28 });
        s.bol(0.08, '#f4f1ea', { x: -0.58, y: 5.05, z: 0.3, sx: 0.4 });
        s.cil(0.04, 0.04, 1.4, '#4a3220', { x: 2.6, y: 1.2, rz: -1.1 });
        figuur(s, { x: -1.6, y: 1.5, z: 0, s: 0.6 });
      }, [0, 0, 0]));
      // golfjes eromheen
      k.cil(2.8, 2.9, 0.06, '#2f7cbf', { seg: 24, sz: 0.55, mat: 'glans' });
    }),
    anim: (g, t) => { const s = g.getObjectByName('schip'); if (s) { s.rotation.x = Math.sin(t * 0.9) * 0.05; s.rotation.z = Math.sin(t * 0.6) * 0.03; s.position.y = Math.sin(t * 1.1) * 0.05; } },
  },
  {
    id: 'schatkist', naam: 'Schatkist', tegels: 0.5,
    maak: () => M((k) => {
      k.blok(0.7, 0.4, 0.45, HOUT, {});
      k.blok(0.72, 0.06, 0.47, '#c4a35a', { y: 0.15, mat: 'metaal' });
      k.cil(0.22, 0.22, 0.7, HOUT2, { y: 0.6, rz: Math.PI / 2, midden: true, x: 0, z: -0.22, rx: -0.9, seg: 10, volgorde: 'XZY' });
      for (let i = 0; i < 14; i++) k.cil(0.05, 0.05, 0.015, '#ffd23a', { x: -0.25 + (i % 7) * 0.08, y: 0.4 + Math.floor(i / 7) * 0.02, z: -0.05 + (i % 3) * 0.06, mat: 'metaal' });
      k.bol(0.05, '#e74c3c', { x: 0.1, y: 0.44, z: 0.05, mat: 'glans' });
      k.bol(0.05, '#3ad16b', { x: -0.12, y: 0.44, z: 0.1, mat: 'glans' });
      for (let i = 0; i < 6; i++) k.cil(0.05, 0.05, 0.015, '#ffd23a', { x: 0.45 + (i % 3) * 0.1, y: 0.01, z: 0.2 - i * 0.05, mat: 'metaal' });
    }),
  },
  {
    id: 'kanon', naam: 'Kanon', tegels: 0.5,
    maak: () => M((k) => {
      k.blok(0.7, 0.2, 0.45, HOUT, { y: 0.15 });
      wiel(k, 0.25, 0.15, 0.27, 0.15, 0.06, HOUT2);
      wiel(k, -0.25, 0.15, 0.27, 0.15, 0.06, HOUT2);
      wiel(k, 0.25, 0.15, -0.27, 0.15, 0.06, HOUT2);
      wiel(k, -0.25, 0.15, -0.27, 0.15, 0.06, HOUT2);
      k.cil(0.1, 0.14, 1.0, '#2b2d31', { x: 0.15, y: 0.45, rz: -1.35, midden: true, mat: 'metaal' });
      k.ring(0.11, 0.025, '#2b2d31', { x: 0.63, y: 0.56, ry: Math.PI / 2, rx: 0.22, mat: 'metaal' });
    }),
  },
  {
    id: 'vuurtoren', naam: 'Vuurtoren', tegels: 1,
    maak: () => M((k, g) => {
      k.cil(0.9, 1.0, 0.4, '#8a8780', { seg: 14 });
      for (let i = 0; i < 5; i++) k.cil(0.62 - i * 0.05, 0.66 - i * 0.05, 1.0, i % 2 ? '#ffffff' : '#d63a3a', { y: 0.4 + i, seg: 14 });
      k.cil(0.5, 0.5, 0.1, '#2b2f36', { y: 5.4, seg: 14 });
      k.cil(0.32, 0.32, 0.55, '#fff3b0', { y: 5.5, seg: 12, mat: 'gloei' });
      k.cil(0.36, 0.36, 0.55, '#ffffff', { y: 5.5, seg: 12, mat: 'glas' });
      k.kegel(0.45, 0.5, '#d63a3a', { y: 6.05, seg: 14 });
      g.add(deel('straal', (s) => {
        s.kegel(0.45, 5, '#fff6c8', { y: 0, rz: Math.PI / 2, midden: true, x: 2.5, mat: 'glas' });
      }, [0, 5.78, 0]));
    }),
    anim: (g, t) => { const s = g.getObjectByName('straal'); if (s) s.rotation.y = t * 1.1; },
  },
  {
    id: 'steiger', naam: 'Steiger', tegels: 2, plat: false,
    maak: () => M((k) => {
      for (let i = 0; i < 8; i++) k.blok(0.45, 0.06, 1.2, i % 2 ? HOUT : '#8a6040', { x: -1.6 + i * 0.46, y: 0.5 });
      for (const x of [-1.7, 0, 1.7]) for (const z of [-0.55, 0.55]) k.cil(0.07, 0.07, 0.75, HOUT2, { x, z });
      k.cil(1.9, 2.0, 0.05, '#2f7cbf', { seg: 20, sz: 0.4, sx: 1.1, mat: 'glans' });
      vat(k, 1.2, 0.56, 0.2, 0.8);
      k.ring(0.15, 0.04, '#ece6da', { x: -1.3, y: 0.62, z: 0.3, rx: Math.PI / 2 });
    }),
  },
  {
    id: 'vaten', naam: 'Vaten', tegels: 0.5,
    maak: () => M((k) => {
      vat(k, 0, 0, 0); vat(k, 0.42, 0, 0.05); vat(k, 0.2, 0.5, 0.02);
      vat(k, -0.15, 0, 0.45, 0.9, true);
    }),
  },
  {
    id: 'piratenvlag', naam: 'Piratenvlag', tegels: 0.5,
    maak: () => M((k, g) => {
      k.cil(0.04, 0.05, 3, HOUT2, {});
      g.add(deel('vlag', (v) => {
        v.blok(0.9, 0.6, 0.02, '#111111', { x: 0.45 });
        v.bol(0.11, '#f4f1ea', { x: 0.45, y: 0.33, z: 0, sz: 0.25, seg: 8 });
        v.blok(0.4, 0.05, 0.03, '#f4f1ea', { x: 0.45, y: 0.12, rz: 0.6 });
        v.blok(0.4, 0.05, 0.03, '#f4f1ea', { x: 0.45, y: 0.12, rz: -0.6 });
      }, [0, 2.4, 0]));
    }),
    anim: (g, t) => { const v = g.getObjectByName('vlag'); if (v) v.rotation.y = Math.sin(t * 2.2) * 0.3; },
  },
  {
    id: 'anker', naam: 'Anker', tegels: 0.5,
    maak: () => M((k) => {
      k.blok(0.1, 1.2, 0.1, '#3a3f46', { y: 0.2, mat: 'metaal' });
      k.blok(0.6, 0.08, 0.1, '#3a3f46', { y: 1.15, mat: 'metaal' });
      k.ring(0.12, 0.035, '#3a3f46', { y: 1.45, mat: 'metaal' });
      k.ring(0.45, 0.06, '#3a3f46', { y: 0.55, boog: Math.PI, rz: Math.PI, mat: 'metaal' });
      k.kegel(0.09, 0.2, '#3a3f46', { x: 0.45, y: 0.5, mat: 'metaal' });
      k.kegel(0.09, 0.2, '#3a3f46', { x: -0.45, y: 0.5, mat: 'metaal' });
    }),
  },
  {
    id: 'wrak', naam: 'Scheepswrak', tegels: 2,
    maak: () => M((k) => {
      k.vorm(rompVorm(3.2, 1.2), 1.2, '#4e3a2a', { y: 0.3, rz: 0.25, rx: 0.2 });
      for (let i = 0; i < 4; i++) k.blok(0.08, 0.9, 1.2, '#3a2a1e', { x: -0.8 + i * 0.5, y: 0.5, rz: 0.3 });
      k.cil(0.06, 0.06, 2.2, '#3a2a1e', { x: 0.5, y: 0.6, rz: 0.9 });
      k.bol(0.3, '#77746d', { x: 1.3, y: 0.1, z: 0.5, sy: 0.6, seg: 6 });
    }),
  },
  {
    id: 'papegaai', naam: 'Papegaai', tegels: 0.5,
    maak: () => M((k) => {
      k.cil(0.03, 0.04, 1.3, HOUT2, {});
      k.blok(0.5, 0.04, 0.04, HOUT2, { y: 1.3 });
      k.bol(0.1, '#e74c3c', { x: 0.05, y: 1.45, sy: 1.5, seg: 8 });
      k.bol(0.07, '#e74c3c', { x: 0.08, y: 1.62, seg: 8 });
      k.kegel(0.03, 0.08, '#f5d76e', { x: 0.15, y: 1.6, rz: -1.6 });
      k.blok(0.04, 0.2, 0.15, '#2e86de', { x: 0.03, y: 1.38, z: 0.08, rx: 0.3 });
      k.blok(0.04, 0.2, 0.15, '#3ad16b', { x: 0.03, y: 1.38, z: -0.08, rx: -0.3 });
      k.blok(0.03, 0.25, 0.06, '#e74c3c', { x: -0.07, y: 1.2, rz: 0.4 });
    }),
  },
  {
    id: 'schedelrots', naam: 'Schedelrots', tegels: 2,
    maak: () => M((k) => {
      k.bol(1.3, '#a19d94', { y: 0.8, sy: 1.0, seg: 10 });
      k.blok(1.4, 0.8, 1.1, '#a19d94', { y: 0.1, z: 0.4 });
      k.bol(0.3, '#1d1d1f', { x: -0.42, y: 1.1, z: 1.1, sz: 0.5 });
      k.bol(0.3, '#1d1d1f', { x: 0.42, y: 1.1, z: 1.1, sz: 0.5 });
      k.kegel(0.14, 0.3, '#1d1d1f', { y: 0.65, z: 1.15, rx: Math.PI, midden: true, seg: 3 });
      for (let i = 0; i < 5; i++) k.blok(0.16, 0.25, 0.1, '#e6e1d6', { x: -0.36 + i * 0.18, y: 0.25, z: 0.95 });
      k.cil(1.9, 2.0, 0.05, '#2f7cbf', { seg: 20, mat: 'glans' });
    }),
  },
  {
    id: 'eilandje', naam: 'Palmeilandje', tegels: 2,
    maak: () => M((k) => {
      k.cil(1.9, 2.0, 0.05, '#2f7cbf', { seg: 22, mat: 'glans' });
      k.bol(1.4, '#eed49a', { y: -0.9, half: true, seg: 16, sy: 0.75 });
      for (let i = 0; i < 6; i++) k.cil(0.08, 0.1, 0.42, '#8a6542', { x: 0.2 + i * 0.07, y: 0.1 + i * 0.4, rz: -0.15, seg: 6 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        k.blok(1.1, 0.04, 0.28, '#3f9a46', { x: 0.62 + Math.cos(a) * 0.45, y: 2.45, z: Math.sin(a) * 0.45, ry: -a, rz: -0.45 });
      }
      k.blok(0.4, 0.25, 0.28, HOUT, { x: -0.5, y: 0.08, z: 0.3 });
      k.blok(0.05, 0.4, 0.05, '#c0392b', { x: -0.2, y: 0.1, z: -0.4, rz: 0.78 });
      k.blok(0.05, 0.4, 0.05, '#c0392b', { x: -0.2, y: 0.1, z: -0.4, rz: -0.78 });
    }),
  },
  {
    id: 'kanonskogels', naam: 'Kanonskogels', tegels: 0.5,
    maak: () => M((k) => {
      const r = 0.12;
      for (let l = 0; l < 3; l++) for (let i = 0; i < 3 - l; i++) for (let j = 0; j < 3 - l; j++) {
        k.bol(r, '#2b2d31', { x: (i - (2 - l) / 2) * r * 2, y: r + l * r * 1.5, z: (j - (2 - l) / 2) * r * 2, seg: 8, mat: 'metaal' });
      }
    }),
  },
  {
    id: 'taveerne', naam: 'Taveerne', tegels: 2,
    maak: () => M((k) => {
      k.blok(3.0, 1.9, 2.2, '#8a6040', {});
      for (let i = 0; i < 8; i++) k.blok(3.02, 0.04, 2.22, HOUT2, { y: 0.2 + i * 0.22 });
      k.zadeldak(3.2, 2.5, 1.2, '#4a3a2a', { y: 1.9 });
      k.blok(0.05, 0.9, 0.5, '#3a2a1e', { x: 1.51, y: 0 });
      k.blok(0.03, 0.35, 0.4, '#ffcf7a', { x: 1.52, y: 1.1, z: 0.65, mat: 'gloei' });
      k.blok(0.03, 0.35, 0.4, '#ffcf7a', { x: 1.52, y: 1.1, z: -0.65, mat: 'gloei' });
      k.blok(0.5, 0.06, 0.06, HOUT2, { x: 1.75, y: 1.6, z: 0.6 });
      k.blok(0.03, 0.35, 0.45, '#c4a35a', { x: 1.95, y: 1.2, z: 0.6 });
      vat(k, 1.8, 0, -0.7, 0.8);
      figuur(k, { x: 2.1, z: 0.1, shirt: '#c0392b', broek: '#2b2f36', ry: 0, hoed: '#111111' });
    }),
  },
];
