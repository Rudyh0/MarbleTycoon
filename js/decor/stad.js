// Metropool: gebouwen, verkeer en straatmeubilair.
import { M, deel, boomRond, ramenGevel, wiel, figuur, kleurVar } from './hulp.js';

function kantoor(k, w, d, h, kleur, glasKleur) {
  k.blok(w, 0.5, d, '#3d4552', {});
  k.blok(w * 0.94, h, d * 0.94, kleur, { y: 0.5, mat: 'glans' });
  const etages = Math.floor(h / 0.9);
  for (let i = 0; i < etages; i++) {
    const y = 0.75 + i * 0.9;
    k.blok(w * 0.96, 0.42, d * 0.96, i % 3 === 0 ? kleurVar(glasKleur, 0.12) : glasKleur, { y, mat: (i * 7) % 5 === 0 ? 'gloei' : 'glans' });
  }
  k.blok(w * 0.98, 0.18, d * 0.98, '#d6dde6', { y: h + 0.5 });
}

function auto(k, kleur, o = {}) {
  const l = o.l || 1.5, b = o.b || 0.72;
  k.blok(l, 0.28, b, kleur, { y: 0.14, mat: 'glans' });
  k.blok(l * 0.55, 0.26, b * 0.9, kleurVar(kleur, -0.08), { x: -l * 0.05, y: 0.42, mat: 'glans' });
  k.blok(l * 0.5, 0.2, b * 0.92, '#9fd3ff', { x: -l * 0.05, y: 0.45, mat: 'glans' });
  for (const [x, z] of [[l * 0.32, b / 2], [-l * 0.32, b / 2], [l * 0.32, -b / 2], [-l * 0.32, -b / 2]]) wiel(k, x, 0.15, z, 0.15, 0.1);
  k.blok(0.03, 0.08, 0.12, '#fff7cf', { x: l / 2, y: 0.22, z: b * 0.32, mat: 'gloei' });
  k.blok(0.03, 0.08, 0.12, '#fff7cf', { x: l / 2, y: 0.22, z: -b * 0.32, mat: 'gloei' });
  k.blok(0.03, 0.07, 0.12, '#ff3b30', { x: -l / 2, y: 0.22, z: b * 0.32, mat: 'gloei' });
  k.blok(0.03, 0.07, 0.12, '#ff3b30', { x: -l / 2, y: 0.22, z: -b * 0.32, mat: 'gloei' });
}

export default [
  {
    id: 'kantoortoren', naam: 'Kantoortoren', tegels: 2,
    maak: () => M((k) => {
      kantoor(k, 3.4, 3.4, 11, '#5f7f9f', '#4b6b8d');
      k.blok(1.2, 0.6, 1.2, '#8a96a6', { y: 11.68 });
      k.cil(0.04, 0.05, 2.2, '#c9ced6', { y: 12.2, mat: 'metaal' });
      k.bol(0.09, '#ff3b30', { y: 14.45, mat: 'gloei' });
    }),
  },
  {
    id: 'wolkenkrabber', naam: 'Wolkenkrabber', tegels: 2,
    maak: () => M((k) => {
      kantoor(k, 3.6, 3.6, 8, '#405a7a', '#2f4d73');
      k.blok(2.8, 6, 2.8, '#46658a', { y: 8.6, mat: 'glans' });
      for (let i = 0; i < 6; i++) k.blok(2.86, 0.3, 2.86, i % 2 ? '#7fb2e6' : '#355a85', { y: 8.9 + i * 0.95, mat: i % 2 ? 'gloei' : 'glans' });
      k.blok(2.0, 4, 2.0, '#50739c', { y: 14.6, mat: 'glans' });
      k.blok(2.1, 0.25, 2.1, '#dde4ee', { y: 18.6 });
      k.kegel(0.6, 2.2, '#c9d4e3', { y: 18.85, seg: 4, ry: Math.PI / 4, mat: 'metaal' });
      k.cil(0.03, 0.04, 2.4, '#d0d6de', { y: 21, mat: 'metaal' });
      k.bol(0.08, '#ff3b30', { y: 23.4, mat: 'gloei' });
    }),
  },
  {
    id: 'appartement', naam: 'Appartementen', tegels: 2,
    maak: () => M((k) => {
      k.blok(3.6, 7, 2.8, '#b5673f', {});
      k.blok(3.8, 0.25, 3.0, '#e3d6c4', { y: 7 });
      for (const zijde of [1, -1]) {
        ramenGevel(k, { x: 0, y: 0.5, z: 0, w: 3.2, h: 6.2, nx: 5, ny: 6, ry: zijde > 0 ? 0 : Math.PI, uit: 1.41, zaad: zijde > 0 ? 3 : 8 });
        for (let j = 1; j < 6; j++) k.blok(3.3, 0.06, 0.35, '#e9ddd0', { y: 0.45 + j * 1.03, z: zijde * 1.55 });
      }
      k.blok(0.9, 0.9, 0.05, '#3b2a20', { y: 0, z: 1.42 });
      k.blok(0.8, 0.6, 0.8, '#9aa3ae', { x: 0.9, y: 7.25, mat: 'metaal' });
      k.blok(0.5, 0.4, 0.5, '#9aa3ae', { x: -1.1, y: 7.25, z: 0.6, mat: 'metaal' });
    }),
  },
  {
    id: 'rijtjeshuis', naam: 'Rijtjeshuis', tegels: 1,
    maak: () => M((k) => {
      const kleuren = ['#e8d9c0', '#c9e3e8', '#f1c6b6'];
      for (let i = 0; i < 3; i++) {
        const z = (i - 1) * 0.62;
        k.blok(1.8, 1.6, 0.6, kleuren[i], { z });
        k.zadeldak(0.62, 1.96, 0.75, i === 1 ? '#5a6878' : '#8c3b2e', { y: 1.6, z, ry: Math.PI / 2 });
        k.blok(0.04, 0.55, 0.22, '#4a3326', { x: 0.9, y: 0, z });
        k.blok(0.03, 0.3, 0.3, '#ffe1a0', { x: 0.91, y: 0.95, z, mat: 'gloei' });
        k.blok(0.03, 0.3, 0.3, '#ffe1a0', { x: -0.91, y: 0.95, z, mat: 'gloei' });
      }
      k.blok(0.3, 0.5, 0.3, '#8a4a3a', { x: -0.4, y: 2.0, z: 0.62 });
    }),
  },
  {
    id: 'winkel', naam: 'Winkel', tegels: 1,
    maak: () => M((k) => {
      k.blok(1.9, 1.7, 1.6, '#e7e0d2', {});
      k.blok(0.04, 0.9, 1.3, '#ffe9b8', { x: 0.96, y: 0.15, mat: 'gloei' });
      for (let i = 0; i < 6; i++) k.blok(0.5, 0.06, 0.24, i % 2 ? '#ffffff' : '#e74c3c', { x: 1.12, y: 1.25, z: -0.6 + i * 0.24, rz: -0.35 });
      k.blok(0.06, 0.32, 1.5, '#2e86de', { x: 0.98, y: 1.35 });
      k.blok(2.0, 0.12, 1.7, '#b9b1a3', { y: 1.7 });
    }),
  },
  {
    id: 'lantaarn', naam: 'Lantaarnpaal', tegels: 0.5,
    maak: () => M((k) => {
      k.cil(0.08, 0.1, 0.15, '#2b2f36', {});
      k.cil(0.035, 0.045, 2.4, '#2b2f36', { mat: 'metaal' });
      k.blok(0.55, 0.05, 0.06, '#2b2f36', { x: 0.25, y: 2.38, mat: 'metaal' });
      k.blok(0.26, 0.08, 0.16, '#2b2f36', { x: 0.5, y: 2.3 });
      k.blok(0.22, 0.03, 0.12, '#fff1c2', { x: 0.5, y: 2.28, mat: 'gloei' });
    }),
  },
  {
    id: 'stadsboom', naam: 'Stadsboom', tegels: 0.5,
    maak: () => M((k) => {
      k.blok(0.7, 0.35, 0.7, '#8d939c', {});
      k.blok(0.6, 0.06, 0.6, '#4a3a2c', { y: 0.33 });
      boomRond(k, 0, 0, 1.8, 0.55, '#5aa04d');
    }),
  },
  {
    id: 'bushokje', naam: 'Bushokje', tegels: 1,
    maak: () => M((k) => {
      k.blok(1.8, 0.06, 0.8, '#9aa1ab', {});
      for (const x of [-0.85, 0.85]) k.blok(0.05, 1.3, 0.05, '#3a4049', { x, z: -0.35, mat: 'metaal' });
      k.blok(1.75, 1.2, 0.04, '#ffffff', { y: 0.08, z: -0.36, mat: 'glas' });
      k.blok(1.9, 0.07, 0.85, '#2e86de', { y: 1.3 });
      k.blok(1.2, 0.08, 0.3, '#5d6670', { y: 0.45, z: -0.2 });
      k.blok(0.04, 0.6, 0.4, '#ffd166', { x: 0.88, y: 0.5, z: -0.2, mat: 'gloei' });
    }),
  },
  { id: 'taxi', naam: 'Taxi', tegels: 1, maak: () => M((k) => { auto(k, '#f4c430'); k.blok(0.3, 0.1, 0.16, '#222', { x: -0.05, y: 0.56 }); k.blok(0.26, 0.06, 0.14, '#ffe680', { x: -0.05, y: 0.61, mat: 'gloei' }); }) },
  { id: 'auto', naam: 'Auto', tegels: 1, maak: () => M((k) => auto(k, '#d63a3a')) },
  { id: 'auto2', naam: 'Stationwagen', tegels: 1, maak: () => M((k) => auto(k, '#3a7bd5', { l: 1.7 })) },
  {
    id: 'bus', naam: 'Stadsbus', tegels: 2,
    maak: () => M((k) => {
      k.blok(3.6, 0.9, 0.95, '#2e86de', { y: 0.18, mat: 'glans' });
      k.blok(3.62, 0.32, 0.97, '#a9dcff', { y: 0.62, mat: 'glans' });
      k.blok(3.6, 0.08, 0.95, '#ffffff', { y: 1.08 });
      for (const x of [1.2, -1.2]) for (const z of [0.48, -0.48]) wiel(k, x, 0.18, z, 0.18, 0.12);
      k.blok(0.03, 0.14, 0.7, '#fff3b0', { x: 1.81, y: 0.35, mat: 'gloei' });
      k.blok(0.03, 0.14, 0.6, '#ff9a3c', { x: 1.81, y: 0.92, mat: 'gloei' });
    }),
  },
  {
    id: 'stoplicht', naam: 'Stoplicht', tegels: 0.5,
    maak: () => M((k) => {
      k.cil(0.04, 0.05, 1.6, '#2b2f36', { mat: 'metaal' });
      k.blok(0.18, 0.5, 0.16, '#1c1f24', { y: 1.55 });
      k.bol(0.05, '#ff3b30', { x: 0.09, y: 1.92, mat: 'gloei' });
      k.bol(0.05, '#3a2a00', { x: 0.09, y: 1.79 });
      k.bol(0.05, '#1d3a22', { x: 0.09, y: 1.66 });
    }),
  },
  {
    id: 'fontein', naam: 'Fontein', tegels: 1,
    maak: () => M((k) => {
      k.cil(0.95, 1.0, 0.35, '#c9c3b8', { seg: 20 });
      k.cil(0.85, 0.85, 0.3, '#ffffff', { y: 0.08, seg: 20, mat: 'water' });
      k.cil(0.12, 0.16, 0.9, '#d8d2c6', { y: 0.3 });
      k.cil(0.42, 0.3, 0.12, '#d8d2c6', { y: 1.15, seg: 16 });
      k.cil(0.05, 0.2, 0.55, '#ffffff', { y: 1.27, mat: 'water' });
      k.kegel(0.5, 0.25, '#ffffff', { y: 1.0, mat: 'water' });
    }),
  },
  {
    id: 'bankje', naam: 'Bankje', tegels: 0.5,
    maak: () => M((k) => {
      k.blok(1.0, 0.05, 0.32, '#a06a3c', { y: 0.32 });
      k.blok(1.0, 0.28, 0.05, '#a06a3c', { y: 0.38, z: -0.15, rx: -0.15 });
      for (const x of [-0.42, 0.42]) k.blok(0.06, 0.32, 0.3, '#2b2f36', { x, mat: 'metaal' });
    }),
  },
  {
    id: 'weg', naam: 'Wegdek', tegels: 1, plat: true,
    maak: () => M((k) => {
      k.blok(2, 0.04, 2, '#33373e', {});
      for (let i = 0; i < 3; i++) k.blok(0.35, 0.01, 0.08, '#f4f1ea', { x: -0.66 + i * 0.66, y: 0.04 });
      k.blok(2, 0.05, 0.12, '#8d939c', { z: 0.94 });
      k.blok(2, 0.05, 0.12, '#8d939c', { z: -0.94 });
    }),
  },
  {
    id: 'kruispunt', naam: 'Kruispunt', tegels: 1, plat: true,
    maak: () => M((k) => {
      k.blok(2, 0.04, 2, '#33373e', {});
      for (let i = 0; i < 5; i++) {
        k.blok(0.1, 0.01, 0.45, '#f4f1ea', { x: -0.6 + i * 0.3, y: 0.04, z: 0.72 });
        k.blok(0.45, 0.01, 0.1, '#f4f1ea', { x: 0.72, y: 0.04, z: -0.6 + i * 0.3 });
      }
    }),
  },
  {
    id: 'zendmast', naam: 'Zendmast', tegels: 1,
    maak: () => M((k) => {
      for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) k.cil(0.03, 0.05, 9, '#d9dde3', { x, z, rx: x > 0 ? -0.04 : 0.04, rz: z > 0 ? 0.04 : -0.04, mat: 'metaal' });
      for (let y = 1; y < 9; y += 1.2) k.blok(0.8 - y * 0.06, 0.04, 0.8 - y * 0.06, '#e74c3c', { y });
      k.cil(0.03, 0.03, 2, '#d9dde3', { y: 9, mat: 'metaal' });
      k.bol(0.1, '#ff3b30', { y: 11, mat: 'gloei' });
    }),
  },
  {
    id: 'billboard', naam: 'Reclamebord', tegels: 1,
    maak: () => M((k) => {
      k.cil(0.07, 0.09, 2.2, '#3a4049', { mat: 'metaal' });
      k.blok(2.0, 1.0, 0.1, '#20252d', { y: 2.2 });
      k.blok(1.86, 0.86, 0.02, '#ff5ea8', { y: 2.27, z: 0.06, mat: 'gloei' });
      k.blok(1.2, 0.3, 0.02, '#ffe66d', { y: 2.55, z: 0.075, mat: 'gloei' });
      k.bol(0.22, '#5ff2ff', { x: 0.55, y: 2.55, z: 0.06, sz: 0.1, mat: 'gloei' });
    }),
  },
  {
    id: 'voetganger', naam: 'Voetgangers', tegels: 0.5,
    maak: () => M((k) => {
      figuur(k, { x: 0, z: -0.2, shirt: '#3a86ff', broek: '#2b2f36' });
      figuur(k, { x: 0.25, z: 0.2, shirt: '#ffbe0b', broek: '#4a4e69', ry: 1.2, s: 0.9 });
    }),
  },
  {
    id: 'parkeergarage', naam: 'Parkeergarage', tegels: 2,
    maak: () => M((k) => {
      for (let i = 0; i < 4; i++) {
        k.blok(3.8, 0.15, 3.8, '#a3a9b2', { y: i * 1.1 });
        k.blok(3.8, 0.35, 0.08, '#d0d4da', { y: i * 1.1 + 0.15, z: 1.86 });
        k.blok(3.8, 0.35, 0.08, '#d0d4da', { y: i * 1.1 + 0.15, z: -1.86 });
      }
      for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8], [0, -1.8], [0, 1.8]]) k.blok(0.18, 4.4, 0.18, '#8d939c', { x, z });
      auto(k, '#5cc96b', { l: 1.4 });
      k.blok(0.5, 0.5, 0.05, '#2e86de', { x: 1.9, y: 3.6, ry: Math.PI / 2 });
      k.blok(0.3, 0.3, 0.03, '#ffffff', { x: 1.93, y: 3.7, ry: Math.PI / 2, mat: 'gloei' });
    }),
  },
];
