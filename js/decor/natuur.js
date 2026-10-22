// Flora en fauna: bomen, bloemen en dieren.
import { M, deel, boomRond, den, kleurVar, rnd } from './hulp.js';

function dier(k, o) {
  // eenvoudig viervoetig dier; o: { l, h, b, kleur, kop, poten, x, z }
  const { l, h, b } = o;
  k.blok(l, h * 0.45, b, o.kleur, { y: h * 0.45 });
  for (const [x, z] of [[l * 0.38, b * 0.32], [l * 0.38, -b * 0.32], [-l * 0.38, b * 0.32], [-l * 0.38, -b * 0.32]]) {
    k.blok(b * 0.22, h * 0.46, b * 0.22, o.poten || kleurVar(o.kleur, -0.1), { x, z });
  }
  k.blok(l * 0.32, h * 0.32, b * 0.7, o.kop || o.kleur, { x: l * 0.6, y: h * 0.78 });
}

export default [
  { id: 'eik', naam: 'Eik', tegels: 1, maak: () => M((k) => boomRond(k, 0, 0, 2.4, 0.95, '#4f9a45')) },
  { id: 'den', naam: 'Den', tegels: 0.5, maak: () => M((k) => den(k, 0, 0, 3.0)) },
  {
    id: 'berk', naam: 'Berk', tegels: 0.5,
    maak: () => M((k) => {
      k.cil(0.07, 0.09, 2.2, '#efeae0', { seg: 7 });
      for (let i = 0; i < 5; i++) k.blok(0.1, 0.03, 0.2, '#2b2b2b', { y: 0.3 + i * 0.4, ry: i, z: 0.0 });
      k.bol(0.55, '#8cc95a', { y: 2.2, sy: 1.3, seg: 9 });
      k.bol(0.4, '#7ab84a', { y: 1.8, x: 0.3, seg: 8 });
    }),
  },
  {
    id: 'palm', naam: 'Palmboom', tegels: 0.5,
    maak: () => M((k, g) => {
      for (let i = 0; i < 7; i++) k.cil(0.1 - i * 0.006, 0.12 - i * 0.006, 0.45, i % 2 ? '#9a7550' : '#8a6542', { x: Math.sin(i * 0.2) * 0.25, y: i * 0.42, seg: 7, rz: -0.08 });
      g.add(deel('kruin', (b) => {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          b.blok(1.3, 0.04, 0.32, i % 2 ? '#3f9a46' : '#4fb055', { x: Math.cos(a) * 0.55, y: -0.15, z: Math.sin(a) * 0.55, ry: -a, rz: -0.45 });
        }
        b.bol(0.09, '#6b4a2a', { x: 0.1, y: -0.1, z: 0.05 });
        b.bol(0.09, '#6b4a2a', { x: -0.05, y: -0.12, z: -0.1 });
      }, [0.42, 3.0, 0]));
    }),
    anim: (g, t) => { const b = g.getObjectByName('kruin'); if (b) b.rotation.z = Math.sin(t * 1.1) * 0.05; },
  },
  {
    id: 'struik', naam: 'Struiken', tegels: 0.5,
    maak: () => M((k) => {
      k.bol(0.35, '#3f8a3a', { y: 0.25, seg: 8 });
      k.bol(0.28, '#4f9a45', { x: 0.35, y: 0.2, z: 0.1, seg: 8 });
      k.bol(0.25, '#367a33', { x: -0.3, y: 0.18, z: 0.2, seg: 8 });
    }),
  },
  {
    id: 'bloemen', naam: 'Bloemenperk', tegels: 1, plat: true,
    maak: () => M((k) => {
      const r = rnd(11);
      k.cil(0.9, 0.95, 0.1, '#5a3e26', { seg: 16 });
      k.cil(0.85, 0.85, 0.04, '#4a8a3a', { y: 0.08, seg: 16 });
      const kleuren = ['#ff4f7a', '#ffd23a', '#ff8a2a', '#b48cff', '#ffffff', '#ff6f91'];
      for (let i = 0; i < 40; i++) {
        const a = r() * 6.28, d = Math.sqrt(r()) * 0.75;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        k.cil(0.01, 0.01, 0.18, '#3f7a33', { x, y: 0.1, z, seg: 4 });
        k.bol(0.05, kleuren[i % kleuren.length], { x, y: 0.3, z, seg: 6 });
      }
    }),
  },
  {
    id: 'paddenstoel', naam: 'Paddenstoel', tegels: 0.5,
    maak: () => M((k) => {
      k.cil(0.12, 0.16, 0.6, '#f4efe0', { seg: 10 });
      k.bol(0.45, '#d63a3a', { y: 0.55, half: true, seg: 14 });
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9, d = i === 0 ? 0 : 0.28;
        k.bol(0.06, '#ffffff', { x: Math.cos(a) * d, y: 0.55 + Math.sqrt(0.2 - d * d * 0.9) * 0.95, z: Math.sin(a) * d, sy: 0.5, seg: 6 });
      }
      k.bol(0.12, '#c9a87a', { x: 0.35, y: 0.08, z: 0.2, half: true, seg: 8 });
      k.cil(0.03, 0.04, 0.1, '#f4efe0', { x: 0.35, z: 0.2 });
    }),
  },
  {
    id: 'hert', naam: 'Hert', tegels: 0.5,
    maak: () => M((k) => {
      dier(k, { l: 0.8, h: 0.9, b: 0.28, kleur: '#a86b3c', poten: '#8a5530' });
      k.blok(0.14, 0.4, 0.14, '#a86b3c', { x: 0.42, y: 0.75, rz: -0.4 });
      for (const z of [-0.06, 0.06]) {
        k.cil(0.012, 0.015, 0.35, '#e3d2b0', { x: 0.55, y: 1.0, z, rz: -0.2, rx: z * 6 });
        k.cil(0.01, 0.012, 0.15, '#e3d2b0', { x: 0.6, y: 1.2, z: z * 1.8, rz: 0.6 });
      }
      k.blok(0.06, 0.08, 0.1, '#f4efe0', { x: -0.42, y: 0.75 });
    }),
  },
  {
    id: 'koe', naam: 'Koe', tegels: 0.5,
    maak: () => M((k) => {
      dier(k, { l: 1.0, h: 0.9, b: 0.42, kleur: '#f4f1ea', kop: '#f4f1ea', poten: '#e8e4da' });
      k.blok(0.35, 0.25, 0.44, '#222222', { x: -0.15, y: 0.55 });
      k.blok(0.2, 0.2, 0.44, '#222222', { x: 0.25, y: 0.62 });
      k.blok(0.12, 0.12, 0.3, '#f2a7b5', { x: 0.82, y: 0.62 });
      k.blok(0.04, 0.08, 0.04, '#e3d2b0', { x: 0.65, y: 0.95, z: 0.13 });
      k.blok(0.04, 0.08, 0.04, '#e3d2b0', { x: 0.65, y: 0.95, z: -0.13 });
    }),
  },
  {
    id: 'schaap', naam: 'Schapen', tegels: 0.5,
    maak: () => M((k) => {
      for (const [x, z, s] of [[0, 0, 1], [0.5, 0.4, 0.8]]) {
        k.bol(0.3 * s, '#f6f3ea', { x, y: 0.4 * s, z, sx: 1.4, seg: 8 });
        k.blok(0.18 * s, 0.18 * s, 0.16 * s, '#2b2b2b', { x: x + 0.42 * s, y: 0.45 * s, z });
        for (const [dx, dz] of [[0.2, 0.1], [0.2, -0.1], [-0.2, 0.1], [-0.2, -0.1]]) k.blok(0.05, 0.25 * s, 0.05, '#2b2b2b', { x: x + dx * s, z: z + dz * s });
      }
    }),
  },
  {
    id: 'vos', naam: 'Vos', tegels: 0.5,
    maak: () => M((k) => {
      dier(k, { l: 0.55, h: 0.45, b: 0.18, kleur: '#e2702a', poten: '#3a2a20' });
      k.kegel(0.05, 0.12, '#e2702a', { x: 0.35, y: 0.42, z: 0.05, seg: 4 });
      k.kegel(0.05, 0.12, '#e2702a', { x: 0.35, y: 0.42, z: -0.05, seg: 4 });
      k.blok(0.1, 0.07, 0.08, '#f4efe0', { x: 0.42, y: 0.32 });
      k.bol(0.08, '#e2702a', { x: -0.4, y: 0.3, sx: 2.2, seg: 8 });
      k.bol(0.05, '#ffffff', { x: -0.55, y: 0.33, seg: 6 });
    }),
  },
  {
    id: 'konijn', naam: 'Konijnen', tegels: 0.5,
    maak: () => M((k) => {
      for (const [x, z, c] of [[0, 0, '#b9a48c'], [0.3, 0.25, '#ffffff']]) {
        k.bol(0.14, c, { x, y: 0.12, z, sx: 1.2, seg: 8 });
        k.bol(0.08, c, { x: x + 0.13, y: 0.22, z, seg: 8 });
        k.blok(0.03, 0.14, 0.05, c, { x: x + 0.12, y: 0.3, z: z + 0.03 });
        k.blok(0.03, 0.14, 0.05, c, { x: x + 0.12, y: 0.3, z: z - 0.03 });
      }
    }),
  },
  {
    id: 'vijver', naam: 'Vijver met eenden', tegels: 2, plat: true,
    maak: () => M((k, g) => {
      k.cil(1.7, 1.8, 0.06, '#8d939c', { seg: 22 });
      k.cil(1.55, 1.55, 0.07, '#2f7cbf', { seg: 22, mat: 'glans' });
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3;
        k.cil(0.18, 0.18, 0.02, '#3f9a46', { x: Math.cos(a) * 1.0, y: 0.07, z: Math.sin(a) * 1.0, seg: 8 });
      }
      k.bol(0.06, '#ff6f91', { x: 1.0, y: 0.1, z: 0 });
      g.add(deel('eenden', (e) => {
        for (const [x, z, c] of [[0.6, 0, '#f4f1ea'], [-0.4, 0.5, '#7a5536'], [-0.2, -0.6, '#f4f1ea']]) {
          e.bol(0.12, c, { x, y: 0.12, z, sx: 1.4, sy: 0.8, seg: 8 });
          e.bol(0.07, c === '#7a5536' ? '#2f7a45' : c, { x: x + 0.12, y: 0.24, z, seg: 8 });
          e.blok(0.07, 0.025, 0.05, '#ffb000', { x: x + 0.2, y: 0.23, z });
        }
      }));
    }),
    anim: (g, t) => { const e = g.getObjectByName('eenden'); if (e) e.rotation.y = t * 0.25; },
  },
  {
    id: 'rotsen', naam: 'Rotsen', tegels: 1,
    maak: () => M((k) => {
      const r = rnd(5);
      for (let i = 0; i < 5; i++) k.bol(0.25 + r() * 0.4, ['#8a8780', '#77746d', '#9a978f'][i % 3], { x: (r() - 0.5) * 1.2, y: 0.1, z: (r() - 0.5) * 1.2, sy: 0.7, seg: 6 });
    }),
  },
  {
    id: 'zonnebloemen', naam: 'Zonnebloemen', tegels: 1,
    maak: () => M((k) => {
      for (let i = 0; i < 9; i++) {
        const x = ((i % 3) - 1) * 0.5, z = (Math.floor(i / 3) - 1) * 0.5;
        const h = 1.0 + ((i * 37) % 10) / 20;
        k.cil(0.025, 0.03, h, '#4f8a3a', { x, z, seg: 5 });
        k.blok(0.2, 0.02, 0.1, '#4f9a45', { x: x + 0.08, y: h * 0.5, z });
        k.cil(0.18, 0.18, 0.04, '#ffcc1a', { x: x + 0.04, y: h, z, rz: 1.2, midden: true, seg: 12 });
        k.cil(0.09, 0.09, 0.05, '#5a3a1a', { x: x + 0.06, y: h, z, rz: 1.2, midden: true, seg: 10 });
      }
    }),
  },
  {
    id: 'bloesemboom', naam: 'Bloesemboom', tegels: 1,
    maak: () => M((k) => boomRond(k, 0, 0, 2.2, 0.85, '#ffb3cf', '#6b4a30')),
  },
  {
    id: 'herfstboom', naam: 'Herfstboom', tegels: 1,
    maak: () => M((k) => boomRond(k, 0, 0, 2.3, 0.9, '#e0862a', '#5a3e26')),
  },
];
