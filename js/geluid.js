// Geluiden, allemaal ter plekke gemaakt met Web Audio (geen bestanden nodig).

let ctx = null, hoofd = null, ruisBuffer = null;
let rolBron = null, rolFilter = null, rolGain = null;

export const instellingen = { aan: true, volume: 0.7, bouw: true, spel: true, ui: true };

export function initGeluid() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  hoofd = ctx.createGain();
  hoofd.gain.value = instellingen.aan ? instellingen.volume : 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  hoofd.connect(comp).connect(ctx.destination);
  ruisBuffer = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const d = ruisBuffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function zetVolume() {
  if (hoofd) hoofd.gain.setTargetAtTime(instellingen.aan ? instellingen.volume : 0, ctx.currentTime, 0.05);
}

function mag(soort) {
  if (!ctx || !instellingen.aan) return false;
  if (soort === 'bouw') return instellingen.bouw;
  if (soort === 'spel') return instellingen.spel;
  if (soort === 'ui') return instellingen.ui;
  return true;
}

function toon(freq, duur, o = {}) {
  const t = ctx.currentTime + (o.na || 0);
  const osc = ctx.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.naar) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.naar), t + duur);
  const g = ctx.createGain();
  const v = o.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + (o.aanval || 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  osc.connect(g).connect(o.doel || hoofd);
  osc.start(t);
  osc.stop(t + duur + 0.05);
}

function ruis(duur, o = {}) {
  const t = ctx.currentTime + (o.na || 0);
  const bron = ctx.createBufferSource();
  bron.buffer = ruisBuffer;
  const f = ctx.createBiquadFilter();
  f.type = o.filter || 'bandpass';
  f.frequency.setValueAtTime(o.freq || 1500, t);
  if (o.naar) f.frequency.exponentialRampToValueAtTime(o.naar, t + duur);
  f.Q.value = o.q || 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol ?? 0.3, t + (o.aanval || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  bron.connect(f).connect(g).connect(hoofd);
  bron.start(t, Math.random() * 0.8);
  bron.stop(t + duur + 0.05);
}

// ------------------------------------------------------------------ bouwen

export const geluid = {
  plaats(variant = 0) {
    if (!mag('bouw')) return;
    const p = 1 + (variant % 5) * 0.06;
    ruis(0.08, { freq: 2200 * p, q: 2, vol: 0.35 });
    toon(320 * p, 0.16, { naar: 110, vol: 0.4, type: 'triangle' });
    toon(900 * p, 0.05, { vol: 0.08, na: 0.03 });
  },
  aansluiten() {
    if (!mag('bouw')) return;
    toon(660, 0.12, { vol: 0.18 });
    toon(990, 0.2, { vol: 0.16, na: 0.08 });
  },
  decor() {
    if (!mag('bouw')) return;
    toon(620, 0.1, { naar: 240, vol: 0.32 });
    ruis(0.05, { freq: 900, vol: 0.12 });
  },
  sloop() {
    if (!mag('bouw')) return;
    ruis(0.32, { freq: 3000, naar: 180, filter: 'lowpass', vol: 0.4 });
    toon(160, 0.22, { naar: 60, vol: 0.35, type: 'square' });
  },
  fout() {
    if (!mag('bouw')) return;
    toon(170, 0.09, { vol: 0.16, type: 'square' });
    toon(150, 0.12, { vol: 0.16, type: 'square', na: 0.11 });
  },
  draai() {
    if (!mag('bouw')) return;
    ruis(0.03, { freq: 4000, q: 4, vol: 0.2 });
    toon(1400, 0.04, { vol: 0.08 });
  },
  verf() {
    if (!mag('bouw')) return;
    ruis(0.22, { freq: 5200, filter: 'highpass', vol: 0.22, aanval: 0.03 });
  },
  start() {
    if (!mag('bouw')) return;
    [523, 659, 784, 1046].forEach((f, i) => toon(f, 0.25, { vol: 0.16, na: i * 0.08 }));
  },
  opslaan() {
    if (!mag('ui')) return;
    toon(880, 0.18, { vol: 0.14 });
    toon(1320, 0.3, { vol: 0.14, na: 0.1 });
  },
  klik() {
    if (!mag('ui')) return;
    toon(1800, 0.03, { vol: 0.06, type: 'triangle' });
  },
  modus(spelen) {
    if (!mag('ui')) return;
    ruis(0.35, { freq: spelen ? 400 : 3000, naar: spelen ? 3000 : 400, q: 3, vol: 0.18 });
    toon(spelen ? 440 : 660, 0.15, { naar: spelen ? 880 : 330, vol: 0.12 });
  },

  // ---------------------------------------------------------------- spelen
  boost() { if (mag('spel')) { toon(220, 0.28, { naar: 1100, vol: 0.12, type: 'sawtooth' }); } },
  launchLaad() { if (mag('spel')) toon(110, 1.05, { naar: 520, vol: 0.12, type: 'sawtooth', aanval: 0.2 }); },
  launch() { if (mag('spel')) { ruis(0.7, { freq: 300, naar: 4000, q: 0.8, vol: 0.45 }); toon(90, 0.5, { naar: 40, vol: 0.35, type: 'square' }); } },
  finish() { if (mag('spel')) { toon(1320, 0.6, { vol: 0.1 }); toon(1980, 0.5, { vol: 0.05 }); } },
  tik(sterkte = 1) { if (mag('spel')) toon(3200 + Math.random() * 1200, 0.04, { vol: Math.min(0.12, 0.03 * sterkte) }); },
  vuur() { if (mag('spel')) ruis(0.4, { freq: 600, filter: 'lowpass', vol: 0.3, aanval: 0.03 }); },
  ketting() { if (mag('spel')) toon(1200, 0.02, { vol: 0.04, type: 'square' }); },
  bubbel() { if (mag('spel')) toon(400 + Math.random() * 300, 0.08, { naar: 1100, vol: 0.08 }); },
  stuiter(v = 1) { if (mag('spel')) toon(240 + Math.random() * 120, 0.08, { naar: 140, vol: Math.min(0.2, 0.05 * v) }); },
  eruit() { if (mag('spel')) { ruis(0.3, { freq: 1200, naar: 300, vol: 0.25 }); toon(600, 0.3, { naar: 200, vol: 0.12 }); } },
  aftel(n) { if (mag('spel')) toon(n > 0 ? 660 : 1320, n > 0 ? 0.2 : 0.6, { vol: 0.22, type: 'square' }); },
  juich() { if (mag('spel')) [784, 988, 1175, 1568].forEach((f, i) => toon(f, 0.3, { vol: 0.12, na: i * 0.1, type: 'triangle' })); },
};

// Doorlopend rolgeluid, harder bij meer en snellere knikkers
export function rolGeluid(sterkte, toonhoogte) {
  if (!ctx) return;
  if (!rolBron) {
    rolBron = ctx.createBufferSource();
    rolBron.buffer = ruisBuffer;
    rolBron.loop = true;
    rolFilter = ctx.createBiquadFilter();
    rolFilter.type = 'bandpass';
    rolFilter.Q.value = 0.9;
    rolGain = ctx.createGain();
    rolGain.gain.value = 0;
    rolBron.connect(rolFilter).connect(rolGain).connect(hoofd);
    rolBron.start();
  }
  const aan = mag('spel');
  rolGain.gain.setTargetAtTime(aan ? Math.min(0.22, sterkte * 0.05) : 0, ctx.currentTime, 0.08);
  rolFilter.frequency.setTargetAtTime(300 + toonhoogte * 140, ctx.currentTime, 0.1);
}
