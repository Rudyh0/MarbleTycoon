// Middeleeuwen: kasteel, vakwerk, molen en markt.
import { M, deel, kantelen, vierkantKantelen, boogVorm, figuur, wiel, den } from './hulp.js';

const STEEN = '#9b9a93';
const STEEN2 = '#86857e';
const HOUT = '#6e4a2e';
const DAK = '#3f5470';

function toren(k, x, z, r, h, dak = DAK) {
  k.cil(r, r * 1.08, h, STEEN, { x, z, seg: 14 });
  k.cil(r * 1.12, r * 1.12, 0.25, STEEN2, { x, y: h, z, seg: 14 });
  kantelen(k, x, h + 0.25, z, r * 1.05, 14, STEEN);
  if (dak) k.kegel(r * 1.2, r * 2.2, dak, { x, y: h + 0.25, z, seg: 14 });
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    k.blok(0.08, 0.35, 0.18, '#1d1d22', { x: x + Math.cos(a) * r, y: h * (0.4 + i * 0.18), z: z + Math.sin(a) * r, ry: -a });
  }
}

export default [
  {
    id: 'kasteeltoren', naam: 'Kasteeltoren', tegels: 1,
    maak: () => M((k, g) => {
      toren(k, 0, 0, 0.8, 5);
      k.cil(0.025, 0.025, 1.2, '#3a2a1a', { y: 7, mat: 'metaal' });
      g.add(deel('vlag', (v) => v.blok(0.6, 0.35, 0.02, '#c0392b', { x: 0.3 }), [0, 7.75, 0]));
    }),
    anim: (g, t) => { const v = g.getObjectByName('vlag'); if (v) v.rotation.y = Math.sin(t * 2) * 0.35; },
  },
  {
    id: 'kasteelmuur', naam: 'Kasteelmuur', tegels: 2,
    maak: () => M((k) => {
      k.blok(4, 3, 0.8, STEEN, {});
      k.blok(4.1, 0.2, 1.0, STEEN2, { y: 3 });
      for (let x = -1.75; x <= 1.8; x += 0.5) {
        k.blok(0.28, 0.4, 0.22, STEEN, { x, y: 3.2, z: 0.38 });
        k.blok(0.28, 0.4, 0.22, STEEN, { x, y: 3.2, z: -0.38 });
      }
      for (let i = 0; i < 10; i++) k.blok(0.4, 0.2, 0.02, STEEN2, { x: -1.6 + (i % 5) * 0.8 + (i > 4 ? 0.4 : 0), y: 0.6 + (i > 4 ? 1.2 : 0.4), z: 0.41 });
    }),
  },
  {
    id: 'poortgebouw', naam: 'Poortgebouw', tegels: 2,
    maak: () => M((k) => {
      k.vorm(boogVorm(2.2, 3.4, 1.1, 2.0), 1.4, STEEN, {});
      toren(k, -1.4, 0, 0.6, 4.2);
      toren(k, 1.4, 0, 0.6, 4.2);
      vierkantKantelen(k, 0, 3.4, 0, 2.2, 1.4, STEEN, 0.35);
      for (let i = 0; i < 6; i++) k.blok(0.05, 1.6, 0.05, '#2b2b2f', { x: -0.45 + i * 0.18, y: 0.4, z: 0.6, mat: 'metaal' });
      for (let i = 0; i < 4; i++) k.blok(1.0, 0.05, 0.05, '#2b2b2f', { y: 0.6 + i * 0.4, z: 0.6, mat: 'metaal' });
    }),
  },
  {
    id: 'vakwerkhuis', naam: 'Vakwerkhuis', tegels: 1,
    maak: () => M((k) => {
      k.blok(1.8, 0.9, 1.5, '#a39b8c', {});
      k.blok(1.9, 0.95, 1.6, '#f1e8d6', { y: 0.9 });
      for (const z of [-0.81, 0.81]) {
        for (const x of [-0.9, -0.3, 0.3, 0.9]) k.blok(0.07, 0.95, 0.03, HOUT, { x, y: 0.9, z });
        k.blok(1.9, 0.07, 0.03, HOUT, { y: 0.9, z });
        k.blok(1.9, 0.07, 0.03, HOUT, { y: 1.8, z });
        k.blok(0.07, 0.95, 0.03, HOUT, { x: -0.6, y: 0.9, z, rz: 0.55 });
        k.blok(0.07, 0.95, 0.03, HOUT, { x: 0.6, y: 0.9, z, rz: -0.55 });
        k.blok(0.25, 0.25, 0.03, '#ffd98a', { x: 0, y: 1.25, z: z * 1.01, mat: 'gloei' });
      }
      k.zadeldak(2.1, 1.9, 1.1, '#8c3b2e', { y: 1.85 });
      k.blok(0.4, 0.6, 0.05, HOUT, { y: 0, z: 0.76 });
      k.blok(0.25, 0.6, 0.25, '#7a6a5a', { x: 0.5, y: 2.3, z: -0.3 });
    }),
  },
  {
    id: 'windmolen', naam: 'Windmolen', tegels: 1,
    maak: () => M((k, g) => {
      k.cil(0.6, 0.9, 3.6, '#d9cdb3', { seg: 8 });
      k.kegel(0.75, 1.1, '#5a4636', { y: 3.6, seg: 8 });
      k.blok(0.4, 0.7, 0.05, HOUT, { y: 0, z: 0.86 });
      k.blok(0.25, 0.3, 0.05, '#ffd98a', { y: 1.9, z: 0.74, mat: 'gloei' });
      g.add(deel('wieken', (w) => {
        w.cil(0.12, 0.12, 0.5, '#4a3626', { rx: Math.PI / 2, midden: true });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          w.blok(0.08, 2.0, 0.04, HOUT, { x: Math.cos(a) * 1.0, y: Math.sin(a) * 1.0, z: 0.2, rz: a - Math.PI / 2, midden: true });
          w.blok(0.42, 1.6, 0.02, '#efe7d6', { x: Math.cos(a) * 1.1 + Math.cos(a + Math.PI / 2) * 0.24, y: Math.sin(a) * 1.1 + Math.sin(a + Math.PI / 2) * 0.24, z: 0.22, rz: a - Math.PI / 2, midden: true });
        }
      }, [0, 3.7, 0.85]));
    }),
    anim: (g, t) => { const w = g.getObjectByName('wieken'); if (w) w.rotation.z = -t * 0.9; },
  },
  {
    id: 'waterput', naam: 'Waterput', tegels: 0.5,
    maak: () => M((k) => {
      k.cil(0.5, 0.55, 0.6, STEEN, { seg: 12 });
      k.cil(0.4, 0.4, 0.05, '#3b6f9c', { y: 0.5, seg: 12, mat: 'glans' });
      for (const x of [-0.45, 0.45]) k.blok(0.08, 1.3, 0.08, HOUT, { x, y: 0.5 });
      k.zadeldak(1.2, 0.9, 0.45, '#7a3b2a', { y: 1.75 });
      k.cil(0.05, 0.05, 0.9, HOUT, { y: 1.45, rz: Math.PI / 2, midden: true });
      k.cil(0.12, 0.1, 0.18, '#5a4636', { y: 0.95 });
    }),
  },
  {
    id: 'marktkraam', naam: 'Marktkraam', tegels: 1,
    maak: () => M((k) => {
      k.blok(1.6, 0.8, 0.8, HOUT, {});
      for (const [x, z] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) k.blok(0.07, 1.8, 0.07, HOUT, { x, z });
      for (let i = 0; i < 6; i++) k.blok(0.28, 0.04, 1.1, i % 2 ? '#f4efe0' : '#c0392b', { x: -0.7 + i * 0.28, y: 1.85, z: 0.05, rx: 0.25 });
      for (let i = 0; i < 5; i++) k.bol(0.09, ['#e74c3c', '#f5a623', '#7ed957', '#e74c3c', '#f8d84a'][i], { x: -0.55 + i * 0.27, y: 0.88, z: 0.15 });
      k.blok(0.4, 0.3, 0.3, '#a07a4a', { x: 0.5, y: 0.8, z: -0.15 });
      figuur(k, { x: 0, z: -0.75, shirt: '#5a7d3a', broek: '#5a4636', ry: Math.PI / 2, s: 0.9 });
    }),
  },
  {
    id: 'hooiberg', naam: 'Hooiberg', tegels: 0.5,
    maak: () => M((k) => {
      k.cil(0.55, 0.65, 0.6, '#e0be5a', { seg: 12 });
      k.kegel(0.62, 0.8, '#d8b24a', { y: 0.6, seg: 12 });
      k.cil(0.03, 0.03, 0.6, HOUT, { x: 0.3, y: 1.0, rz: 0.7 });
    }),
  },
  {
    id: 'kar', naam: 'Hooikar', tegels: 1,
    maak: () => M((k) => {
      k.blok(1.4, 0.2, 0.9, HOUT, { y: 0.45 });
      k.blok(1.3, 0.5, 0.8, '#e0be5a', { y: 0.65 });
      wiel(k, 0.4, 0.38, 0.5, 0.38, 0.06, '#5a3e26');
      wiel(k, 0.4, 0.38, -0.5, 0.38, 0.06, '#5a3e26');
      wiel(k, -0.45, 0.3, 0.5, 0.3, 0.06, '#5a3e26');
      wiel(k, -0.45, 0.3, -0.5, 0.3, 0.06, '#5a3e26');
      k.blok(0.9, 0.05, 0.05, HOUT, { x: 1.1, y: 0.4, z: 0.25 });
      k.blok(0.9, 0.05, 0.05, HOUT, { x: 1.1, y: 0.4, z: -0.25 });
    }),
  },
  {
    id: 'trebuchet', naam: 'Blijde', tegels: 1,
    maak: () => M((k, g) => {
      k.blok(1.6, 0.15, 1.0, HOUT, { y: 0.1 });
      for (const z of [-0.4, 0.4]) {
        k.blok(0.1, 1.7, 0.1, HOUT, { x: -0.3, z, rz: 0.25 });
        k.blok(0.1, 1.7, 0.1, HOUT, { x: 0.3, z, rz: -0.25 });
      }
      wiel(k, 0.6, 0.15, 0.55, 0.15, 0.05, '#4a3626');
      wiel(k, -0.6, 0.15, 0.55, 0.15, 0.05, '#4a3626');
      wiel(k, 0.6, 0.15, -0.55, 0.15, 0.05, '#4a3626');
      wiel(k, -0.6, 0.15, -0.55, 0.15, 0.05, '#4a3626');
      g.add(deel('arm', (a) => {
        a.blok(2.4, 0.08, 0.08, '#5a3e26', { x: 0.5, midden: true });
        a.blok(0.35, 0.35, 0.35, '#6e6d66', { x: -0.6, y: -0.2, midden: true });
      }, [0, 1.6, 0]));
    }),
    anim: (g, t) => { const a = g.getObjectByName('arm'); if (a) a.rotation.z = -0.5 + Math.max(0, Math.sin(t * 0.7)) * 1.3; },
  },
  {
    id: 'banier', naam: 'Banieren', tegels: 0.5,
    maak: () => M((k, g) => {
      for (const [z, c] of [[-0.3, '#c0392b'], [0.3, '#2e5c9a']]) {
        k.cil(0.03, 0.03, 2.4, '#3a2a1a', { z, mat: 'metaal' });
        k.blok(0.04, 1.0, 0.45, c, { x: 0.04, y: 1.3, z: z + 0.25 });
        k.blok(0.045, 0.3, 0.2, '#f2c14e', { x: 0.04, y: 1.65, z: z + 0.25 });
      }
      void g;
    }),
  },
  {
    id: 'kapel', naam: 'Kapel', tegels: 2,
    maak: () => M((k) => {
      k.blok(3.0, 2.0, 1.8, '#b6b1a6', {});
      k.zadeldak(3.1, 2.0, 1.3, '#4a4f58', { y: 2.0 });
      k.blok(1.0, 3.4, 1.0, '#aaa59a', { x: 1.8 });
      k.kegel(0.75, 2.2, '#4a4f58', { x: 1.8, y: 3.4, seg: 4, ry: Math.PI / 4 });
      k.blok(0.05, 0.4, 0.04, '#d4af37', { x: 1.8, y: 5.6, mat: 'metaal' });
      k.blok(0.05, 0.04, 0.25, '#d4af37', { x: 1.8, y: 5.85, mat: 'metaal' });
      for (const x of [-1, 0, 1]) k.blok(0.25, 0.7, 0.03, '#7fb2e6', { x, y: 0.8, z: 0.91, mat: 'gloei' });
      k.blok(0.03, 0.9, 0.5, '#4a3326', { x: 2.31, y: 0 });
    }),
  },
  {
    id: 'ridder', naam: 'Ridder te paard', tegels: 1,
    maak: () => M((k) => {
      k.blok(1.0, 0.45, 0.35, '#e8e2d6', { y: 0.75 });
      for (const [x, z] of [[-0.35, 0.12], [-0.35, -0.12], [0.35, 0.12], [0.35, -0.12]]) k.blok(0.09, 0.75, 0.09, '#d8d2c6', { x, z });
      k.blok(0.25, 0.55, 0.22, '#e8e2d6', { x: 0.55, y: 1.0, rz: -0.5 });
      k.blok(0.38, 0.2, 0.18, '#e8e2d6', { x: 0.78, y: 1.38 });
      k.blok(1.0, 0.3, 0.4, '#2e5c9a', { y: 0.8 });
      figuur(k, { x: -0.05, z: 0, s: 0.75, shirt: '#b8bec7', broek: '#8d939c', helm: '#b8bec7' });
      k.cil(0.025, 0.04, 1.6, '#6e4a2e', { x: 0.4, y: 1.2, z: 0.22, rz: -1.35 });
      k.blok(0.05, 0.4, 0.3, '#c0392b', { x: -0.05, y: 1.0, z: -0.25 });
    }),
  },
  {
    id: 'schietschijf', naam: 'Schietschijf', tegels: 0.5,
    maak: () => M((k) => {
      k.cil(0.04, 0.04, 1.2, HOUT, { x: -0.25, rz: 0.2 });
      k.cil(0.04, 0.04, 1.2, HOUT, { x: 0.25, rz: -0.2 });
      const ringen = ['#f4f1ea', '#c0392b', '#f4f1ea', '#2e5c9a', '#f2c14e'];
      ringen.forEach((c, i) => k.cil(0.45 - i * 0.09, 0.45 - i * 0.09, 0.05 + i * 0.01, c, { y: 1.05, rx: Math.PI / 2, midden: true, z: 0.05 + i * 0.005, seg: 18 }));
    }),
  },
  {
    id: 'woudrand', naam: 'Dennenbos', tegels: 1,
    maak: () => M((k) => {
      den(k, -0.4, -0.3, 2.6);
      den(k, 0.45, 0.1, 2.1);
      den(k, -0.2, 0.55, 1.7);
    }),
  },
];
