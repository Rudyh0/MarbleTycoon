// Knikkerfysica. Op de baan rolt een knikker langs de hartlijn (1D), met zwaartekracht langs de helling,
// rolweerstand, luchtweerstand en wrijving in bochten. Effectstukken duwen of remmen.
// Vliegt een knikker van de baan (open einde of te snel in een bocht), dan valt hij vrij,
// stuitert op de grond en kan op een lager stuk baan landen.

import * as THREE from '../lib/three.min.js';
import { KNIKKER_R, ZWAARTEKRACHT as G, ROL_FACTOR, ROLWEERSTAND, LUCHTWEERSTAND, BOCHTWRIJVING, KMU, TEGEL, RASTER } from './config.js';
import { SOORTEN, stukPad } from './stukken.js';

const DT = 1 / 240;
export const RACE_VMAX = 12.5;      // m/s: daarboven trekt de motor niet meer (bergaf kan het harder)
const RACE_ACC = 8;                  // m/s² motorkracht bij vol gas en stilstand
const RACE_REM = 11;                 // m/s² remkracht
const BOOST_ACC = 15;
export const ITEMS = ['banaan', 'boost', 'rood', 'blauw'];
const GRIP = 1.0;                   // hoeveel zijwaartse kracht de goot aankan (t.o.v. de druk op de bodem)

// ------------------------------------------------------------------ ketens als één lang pad

function ketenPad(keten, kIndex) {
  const stukken = keten.stukken;
  let n = 0;
  const paden = stukken.map((st) => stukPad(st, 20));
  for (let j = 0; j < paden.length; j++) n += paden[j].n - (j > 0 ? 1 : 0);
  const P = new Float64Array(n * 3), T = new Float64Array(n * 3), U = new Float64Array(n * 3), R = new Float64Array(n * 3), K = new Float64Array(n * 3);
  const S = new Float64Array(n);
  const stukIdx = new Int32Array(n);
  const info = [];
  let o = 0, s0 = 0;
  for (let j = 0; j < paden.length; j++) {
    const p = paden[j];
    const begin = j > 0 ? 1 : 0;
    const startS = s0;
    for (let i = begin; i < p.n; i++) {
      for (let c = 0; c < 3; c++) {
        P[o * 3 + c] = p.P[i * 3 + c]; T[o * 3 + c] = p.T[i * 3 + c]; U[o * 3 + c] = p.U[i * 3 + c]; R[o * 3 + c] = p.R[i * 3 + c];
      }
      S[o] = startS + p.S[i];
      stukIdx[o] = j;
      o++;
    }
    s0 = startS + p.lengte;
    const st = stukken[j];
    const def = SOORTEN[st.t];
    info.push({ st, s0: startS, s1: s0, buis: !!def.buis, fx: st.fx || (st.t === 'launch' ? 'launch' : ''), v: (st.v || 0) / KMU, t: st.t });
  }
  // kromming als vector: dT/ds
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const ds = S[b] - S[a] || 1;
    for (let c = 0; c < 3; c++) K[i * 3 + c] = (T[b * 3 + c] - T[a * 3 + c]) / ds;
  }
  const laatste = stukken[stukken.length - 1];
  return { k: kIndex, n, P, T, U, R, K, S, stukIdx, info, lengte: s0, start: keten.start, finish: laatste && laatste.t === 'finish' };
}

// ------------------------------------------------------------------ knikker

let knikkerTeller = 0;

class Knikker {
  constructor(skin) {
    this.id = ++knikkerTeller;
    this.skin = skin;
    this.toestand = 'wacht';
    this.keten = 0; this.s = 0; this.v = 0; this.i = 0;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.draai = new THREE.Quaternion();
    this.as = new THREE.Vector3(0, 0, 1);
    this.hoek = 0;
    this.hitte = 0;
    this.rust = 0;
    this.launch = null;
    this.binnenT = 0;
    this.vrijT = 0;
    this.overT = 0;
    this.gevaar = 0;
    this.zijOffset = 0;
    this.speler = null;
    this.ronde = 0;
    this.rondeStart = 0;
    this.besteRonde = Infinity;
    this.gefinisht = false;
    this.finishTijd = 0;
    this.vliegS = 0;
    this.uitgevlogen = 0;
    this.topSnelheid = 0;
    this.vorigeFx = '';
    this.boostE = 0;   // extra bewegingsenergie van boosters (telt niet mee voor uit de bocht vliegen)
  }
}

// ------------------------------------------------------------------ simulatie

export class Simulatie {
  constructor() {
    this.ketens = [];
    this.knikkers = [];
    this.wachtrij = [];
    this.tijd = 0;
    this.actief = false;
    this.loslaatT = 0;
    this.interval = 0.9;
    this.rondgaan = true;
    this.uitDeBocht = false;
    this.race = null;
    this.gebeurtenis = () => {};   // (soort, knikker, extra)
    this.stats = { binnen: 0, topSnelheid: 0, besteRonde: Infinity, uitgevlogen: 0 };
    this.hash = new Map();
    this.launchStatusMap = new Map();
    this.launchStatus = (id) => this.launchStatusMap.get(id) || null;
  }

  // baan + analyse -> paden
  bouw(info, magazijn) {
    this.ketens = info.ketens.map((k, i) => ketenPad(k, i));
    this.magazijn = magazijn;
    this.bouwHash();
  }

  bouwHash() {
    this.hash.clear();
    for (const k of this.ketens) {
      for (let i = 0; i < k.n; i += 2) {
        const key = this.hashKey(k.P[i * 3], k.P[i * 3 + 1], k.P[i * 3 + 2]);
        let lijst = this.hash.get(key);
        if (!lijst) { lijst = []; this.hash.set(key, lijst); }
        lijst.push(k.k, i);
      }
    }
  }

  hashKey(x, y, z) {
    return ((Math.floor(x / 0.8) + 512) * 1024 + (Math.floor(z / 0.8) + 512)) * 256 + (Math.floor(y / 0.8) + 32);
  }

  // Zet knikkers klaar in het magazijn
  vul(aantal, skins) {
    this.knikkers = [];
    this.wachtrij = [];
    for (let i = 0; i < aantal; i++) {
      const k = new Knikker(skins[i % skins.length]);
      this.knikkers.push(k);
      this.wachtrij.push(k);
    }
    this.stats = { binnen: 0, topSnelheid: 0, besteRonde: Infinity, uitgevlogen: 0 };
    this.tijd = 0;
    this.loslaatT = 0;
  }

  heeftStart() { return this.ketens.length && this.ketens[0].start; }

  // ---------------------------------------------------------------- opzoeken langs een pad

  zoek(k, kn) {
    const S = k.S;
    let i = Math.min(Math.max(kn.i, 0), k.n - 2);
    const s = kn.s;
    if (S[i] > s || S[i + 1] < s) {
      // eerst lokaal lopen, anders binair zoeken
      let stappen = 0;
      while (i > 0 && S[i] > s && stappen < 8) { i--; stappen++; }
      while (i < k.n - 2 && S[i + 1] < s && stappen < 16) { i++; stappen++; }
      if (S[i] > s || S[i + 1] < s) {
        let lo = 0, hi = k.n - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
        i = Math.min(lo, k.n - 2);
      }
    }
    kn.i = i;
    return i;
  }

  interp(k, i, s, uit) {
    const S = k.S;
    const f = S[i + 1] > S[i] ? Math.min(1, Math.max(0, (s - S[i]) / (S[i + 1] - S[i]))) : 0;
    const a = i * 3, b = a + 3;
    uit.px = k.P[a] + (k.P[b] - k.P[a]) * f;
    uit.py = k.P[a + 1] + (k.P[b + 1] - k.P[a + 1]) * f;
    uit.pz = k.P[a + 2] + (k.P[b + 2] - k.P[a + 2]) * f;
    uit.tx = k.T[a] + (k.T[b] - k.T[a]) * f;
    uit.ty = k.T[a + 1] + (k.T[b + 1] - k.T[a + 1]) * f;
    uit.tz = k.T[a + 2] + (k.T[b + 2] - k.T[a + 2]) * f;
    const tl = Math.hypot(uit.tx, uit.ty, uit.tz) || 1;
    uit.tx /= tl; uit.ty /= tl; uit.tz /= tl;
    uit.ux = k.U[a] + (k.U[b] - k.U[a]) * f;
    uit.uy = k.U[a + 1] + (k.U[b + 1] - k.U[a + 1]) * f;
    uit.uz = k.U[a + 2] + (k.U[b + 2] - k.U[a + 2]) * f;
    uit.rx = k.R[a] + (k.R[b] - k.R[a]) * f;
    uit.ry = k.R[a + 1] + (k.R[b + 1] - k.R[a + 1]) * f;
    uit.rz = k.R[a + 2] + (k.R[b + 2] - k.R[a + 2]) * f;
    uit.kx = k.K[a] + (k.K[b] - k.K[a]) * f;
    uit.ky = k.K[a + 1] + (k.K[b + 1] - k.K[a + 1]) * f;
    uit.kz = k.K[a + 2] + (k.K[b + 2] - k.K[a + 2]) * f;
    uit.stuk = k.info[k.stukIdx[f < 0.5 ? i : i + 1]];
    return uit;
  }

  // ---------------------------------------------------------------- stappen

  stap(dt) {
    if (!this.actief) return;
    if (this.race) this.raceTik(Math.min(dt, 0.1));
    let rest = Math.min(dt, 0.1);
    while (rest > 1e-6) {
      const h = Math.min(DT, rest);
      this.subStap(h);
      rest -= h;
    }
    this.werkLaunchStatusBij();
  }

  subStap(dt) {
    this.tijd += dt;
    const race = this.race;
    // loslaten uit het magazijn
    if (!race && this.heeftStart() && this.wachtrij.length) {
      this.loslaatT -= dt;
      if (this.loslaatT <= 0 && this.startVrij()) {
        const kn = this.wachtrij.shift();
        this.zetOpBaan(kn, 0, 0.32, 0.4);
        kn.rondeStart = this.tijd;
        this.loslaatT = this.interval;
        this.gebeurtenis('los', kn);
      }
    }
    if (race && race.fase === 'aftellen') return;
    const g = this._g || (this._g = {});
    for (const kn of this.knikkers) {
      if (kn.toestand === 'baan') this.rol(kn, dt, g);
      else if (kn.toestand === 'vrij') this.vlieg(kn, dt);
      else if (kn.toestand === 'binnen') {
        kn.binnenT += dt;
        kn.pos.y -= dt * 0.6;
        if (kn.binnenT > 0.7) this.naBinnen(kn);
      }
      kn.hitte = Math.max(0, kn.hitte - dt * 0.35);
    }
    if (!race) this.botsingen();
    else if (race.fase === 'race') this.raceExtra(dt);
  }

  startVrij() {
    for (const kn of this.knikkers) {
      if (kn.toestand === 'baan' && kn.keten === 0 && kn.s < 0.32 + 2.4 * KNIKKER_R) return false;
    }
    return true;
  }

  zetOpBaan(kn, keten, s, v) {
    kn.toestand = 'baan';
    kn.keten = keten; kn.s = s; kn.v = v; kn.i = 0;
    kn.launch = null; kn.overT = 0; kn.gevaar = 0; kn.vrijT = 0; kn.rust = 0; kn.boostE = 0;
    const k = this.ketens[keten];
    this.zoek(k, kn);
    const p = this.interp(k, kn.i, kn.s, this._p || (this._p = {}));
    kn.pos.set(p.px, p.py, p.pz);
  }

  rol(kn, dt, g) {
    const k = this.ketens[kn.keten];
    const i = this.zoek(k, kn);
    const p = this.interp(k, i, kn.s, g);
    const stuk = p.stuk;
    let a = -G * ROL_FACTOR * p.ty;
    const v = kn.v;
    const kl = Math.hypot(p.kx, p.ky, p.kz);
    const wrijving = ROLWEERSTAND * G + LUCHTWEERSTAND * v * v + BOCHTWRIJVING * kl * v * v;
    // effecten
    const fx = stuk.fx;
    let lift = 0, aBoost = 0, aRem = 0;
    if (fx === 'lift') lift = stuk.v;
    else if (fx === 'boost') { if (v < stuk.v) aBoost += 16; }
    else if (fx === 'rem') { if (v > stuk.v) aRem = 24 * Math.min(1, (v - stuk.v) / 0.6 + 0.25); }
    else if (fx === 'vuur') kn.hitte = 1;
    if (fx !== kn.vorigeFx) {
      if (fx) this.gebeurtenis(fx === 'launch' ? 'launchIn' : fx, kn, stuk);
      if (stuk.t === 'aqua' || stuk.t === 'aquaB') this.gebeurtenis('aqua', kn, stuk);
      kn.vorigeFx = fx;
    }
    // launch: vasthouden, aftellen, lanceren
    if (fx === 'launch') {
      const hold = stuk.s0 + 0.5;
      // invoerbandje: duwt knikkers rustig naar het startpunt van de launch
      if (!kn.launch && kn.s < hold && v < 0.9) a += 2.2;
      // bezet? dan wachten voor het startpunt
      if (!kn.launch && v >= 0 && kn.s > hold - 0.02 && kn.s < stuk.s1 - 1 && !this.launchVrij(stuk, kn)) {
        kn.s = hold - 2 * KNIKKER_R - 0.01; kn.v = 0;
        this.zetPositie(kn, k, g, 0);
        return;
      }
      if (!kn.launch && v >= 0 && kn.s >= hold - 0.02 && kn.s < stuk.s1 - 1 && this.launchVrij(stuk, kn)) {
        kn.launch = { stuk, fase: 'wacht', t: 0 };
        kn.s = hold; kn.v = 0;
        this.gebeurtenis('launchWacht', kn, stuk);
      }
      if (kn.launch) {
        const l = kn.launch;
        l.t += dt;
        if (l.fase === 'wacht') {
          kn.v = 0; kn.s = hold;
          if (l.t > 1.1) { l.fase = 'lanceer'; l.t = 0; this.gebeurtenis('launch', kn, stuk); }
          this.zetPositie(kn, k, g, 0);
          return;
        }
        const acc = (stuk.v * stuk.v) / (2 * Math.max(1, stuk.s1 - hold - 0.8));
        if (kn.v < stuk.v) a += acc;
      }
    } else if (kn.launch) kn.launch = null;
    // racebesturing: het gas is een motor, geen snelheidsbegrenzer. Zwaartekracht blijft gewoon werken,
    // dus met te weinig gas rol je een helling weer af.
    let remWrijving = 0;
    if (kn.speler && this.race) {
      const gas = kn.spinT > 0 ? 0 : Math.min(1, Math.max(0, kn.speler.gas || 0));
      // meer gas = meer trekkracht en een hogere topsnelheid; boven die snelheid trekt de motor niet meer
      if (gas > 0) a += gas * RACE_ACC * (kn.v >= 0 ? Math.max(0, 1 - kn.v / (RACE_VMAX * gas)) : 1);
      if (kn.speler.rem || kn.spinT > 0) remWrijving = RACE_REM;
      if (kn.boostT > 0 && kn.v < RACE_VMAX * 1.5) aBoost += BOOST_ACC;
    }
    a += aBoost - aRem;
    // Vlakke stukken lopen in een echte knikkerbaan een heel klein beetje af: knikkers blijven niet stilliggen.
    const vlak = Math.abs(p.ty) < 0.012 && !kn.speler && !kn.launch;
    if (vlak && v < 0.32 && fx !== 'rem') a += 0.55 + ROLWEERSTAND * G;
    // wrijving tegen de bewegingsrichting
    let nv;
    kn.sVorig = kn.s;
    if (Math.abs(v) < 0.03 && Math.abs(a) <= ROLWEERSTAND * G * 1.05 + remWrijving && !lift) nv = 0;
    else {
      nv = v + a * dt;
      const w = (wrijving + remWrijving) * dt;
      if (nv > 0) nv = Math.max(0, nv - w); else if (nv < 0) nv = Math.min(0, nv + w);
    }
    if (lift && nv < lift) nv = lift;
    // Boostenergie: de extra bewegingsenergie (per kg) die van een booster komt. Die telt niet mee
    // voor uit de bocht vliegen. Wrijving en remmen halen er naar verhouding iets af; wat er bergaf
    // bij komt, is gewone vaart en telt wel mee.
    let be = kn.boostE || 0;
    if (nv <= 0.05 || v < 0) be = 0;
    else {
      if (aBoost > 0) { const dv = aBoost * dt; be += v * dv + dv * dv / 2; }
      if (be > 0) {
        const verlies = (wrijving + remWrijving + aRem) * dt;
        be *= Math.max(0, 1 - (2 * verlies) / Math.max(v, 0.05));
        be = Math.min(be, nv * nv / 2);
      }
    }
    kn.boostE = be;
    kn.v = nv;
    kn.s += nv * dt;
    const as = Math.abs(nv);
    if (as > kn.topSnelheid) kn.topSnelheid = as;
    if (as > this.stats.topSnelheid) this.stats.topSnelheid = as;

    // uit de bocht vliegen?
    const magVliegen = (this.uitDeBocht || this.race) && !stuk.buis && stuk.t !== 'start' && stuk.t !== 'finish';
    if (magVliegen) {
      // alleen de "eigen" vaart telt: boostersnelheid laat je niet uit de bocht vliegen
      const v2 = Math.max(0, nv * nv - 2 * be);
      const fx_ = v2 * p.kx, fy_ = v2 * p.ky + G, fz_ = v2 * p.kz;
      const fu = fx_ * p.ux + fy_ * p.uy + fz_ * p.uz;
      const fr = fx_ * p.rx + fy_ * p.ry + fz_ * p.rz;
      // zijwaarts: de goot houdt de knikker zolang de zijkracht kleiner is dan de druk op de bodem
      const grip = GRIP * (this.race ? this.race.grip : 1);
      let gevaar = Math.abs(fr) / (grip * Math.max(fu, 0.35 * G));
      // over een bult: pas los als de baan hem harder omlaag zou moeten trekken dan een beetje
      if (fu < 0.3 * G) gevaar = Math.max(gevaar, 0.75 + 0.25 * (0.3 * G - fu) / (1.1 * G));
      kn.gevaar = kn.gevaar * 0.85 + Math.min(1.5, gevaar) * 0.15;
      if (gevaar > 1) {
        kn.overT += dt;
        if (kn.overT > 0.045) { this.vliegEruit(kn, k, g, fr); return; }
      } else kn.overT = Math.max(0, kn.overT - dt * 0.5);
    } else kn.gevaar *= 0.9;

    // einde van de keten
    if (kn.s < 0) {
      if (k.start) { kn.s = 0; kn.v = Math.abs(kn.v) * 0.3; }
      else { this.zetPositie(kn, k, g, 0); this.wordVrij(kn, -1); return; }
    }
    if (kn.s >= k.lengte) {
      if (this.race && kn.keten === 0) { this.raceRonde(kn); return; }
      if (k.finish) { this.binnen(kn); return; }
      kn.s = k.lengte - 1e-4;
      this.zetPositie(kn, k, g, 0);
      this.wordVrij(kn, 1);
      return;
    }
    this.zetPositie(kn, k, g, dt);
  }

  zetPositie(kn, k, g, dt) {
    const i = this.zoek(k, kn);
    const p = this.interp(k, i, kn.s, g);
    const zij = kn.zijOffset;
    kn.pos.set(p.px + p.rx * zij, p.py + p.ry * zij, p.pz + p.rz * zij);
    kn.tan = kn.tan || new THREE.Vector3();
    kn.tan.set(p.tx, p.ty, p.tz);
    // rollen: as = U x T
    kn.as.set(p.uy * p.tz - p.uz * p.ty, p.uz * p.tx - p.ux * p.tz, p.ux * p.ty - p.uy * p.tx).normalize();
    kn.hoek = (kn.v * dt) / KNIKKER_R;
    kn.vel.set(p.tx * kn.v, p.ty * kn.v, p.tz * kn.v);
    if (kn.hoek) {
      const q = this._q || (this._q = new THREE.Quaternion());
      q.setFromAxisAngle(kn.as, kn.hoek);
      kn.draai.premultiply(q);
    }
  }

  launchVrij(stuk, kn) {
    if (this.race) return true;
    for (const o of this.knikkers) if (o !== kn && o.launch && o.launch.stuk === stuk) return false;
    return true;
  }

  werkLaunchStatusBij() {
    this.launchStatusMap.clear();
    for (const kn of this.knikkers) {
      if (kn.launch && kn.toestand === 'baan') {
        const id = kn.launch.stuk.st.id;
        if (!this.launchStatusMap.has(id)) this.launchStatusMap.set(id, { fase: kn.launch.fase, f: Math.min(1, kn.launch.t / 1.1) });
      }
    }
  }

  vliegEruit(kn, k, g, fr) {
    this.zetPositie(kn, k, g, 0);
    kn.vliegS = kn.s;
    // naar buiten de bocht
    const p = g;
    const sgn = fr > 0 ? -1 : 1;
    kn.vel.addScaledVector(new THREE.Vector3(p.rx, p.ry, p.rz), sgn * Math.min(3, Math.abs(kn.v) * 0.25));
    kn.vel.addScaledVector(new THREE.Vector3(p.ux, p.uy, p.uz), 1.2);
    kn.toestand = 'vrij';
    kn.vrijT = 0; kn.rust = 0; kn.uitgevlogen++;
    kn.verlatenKeten = kn.keten; kn.verlatenS = kn.s;
    this.stats.uitgevlogen++;
    kn.launch = null;
    this.gebeurtenis('eruit', kn);
    const r = this.race;
    if (r && r.fase === 'race' && r.maxUit > 0 && kn.uitgevlogen >= r.maxUit && !kn.uitgeschakeld && !kn.gefinisht) {
      kn.uitgeschakeld = true;
      kn.uitTijd = this.tijd;
      kn.uitVoortgang = this.voortgang(kn);
      kn.item = null; kn.itemRol = 0;
      this.gebeurtenis('uitgeschakeld', kn);
      this.controleerEinde();
    }
  }

  wordVrij(kn, richting) {
    kn.toestand = 'vrij';
    kn.vrijT = 0; kn.rust = 0;
    kn.verlatenKeten = kn.keten; kn.verlatenS = kn.s;
    kn.vliegS = kn.s;
    if (richting < 0) kn.vel.multiplyScalar(1);
    this.gebeurtenis('sprong', kn);
  }

  vlieg(kn, dt) {
    kn.vrijT += dt;
    kn.vel.y -= G * dt;
    kn.pos.addScaledVector(kn.vel, dt);
    const opPlaat = Math.abs(kn.pos.x) < RASTER * TEGEL && Math.abs(kn.pos.z) < RASTER * TEGEL;
    let opGrond = false;
    if (opPlaat && kn.pos.y < KNIKKER_R) {
      kn.pos.y = KNIKKER_R;
      opGrond = true;
      if (kn.vel.y < -0.4) {
        kn.vel.y = -kn.vel.y * 0.42;
        kn.vel.x *= 0.82; kn.vel.z *= 0.82;
        this.gebeurtenis('stuiter', kn, Math.abs(kn.vel.y));
      } else kn.vel.y = 0;
      const f = Math.max(0, 1 - dt * 1.4);
      kn.vel.x *= f; kn.vel.z *= f;
    }
    // draaien terwijl hij rolt of vliegt
    const sp = Math.hypot(kn.vel.x, kn.vel.z);
    if (sp > 0.01) {
      kn.as.set(-kn.vel.z / sp, 0, kn.vel.x / sp).negate();
      const q = this._q || (this._q = new THREE.Quaternion());
      q.setFromAxisAngle(kn.as, (sp * dt) / KNIKKER_R);
      kn.draai.premultiply(q);
    }
    if (this.race) {
      if (kn.vrijT > 1.3) {
        if (kn.uitgeschakeld) kn.toestand = 'uit';
        else this.raceTerug(kn);
      }
      return;
    }
    // landen op een stuk baan
    if (kn.vrijT > 0.12) this.vang(kn);
    if (kn.toestand !== 'vrij') return;
    if (opGrond && sp < 0.06) kn.rust += dt; else kn.rust = 0;
    if (kn.rust > 1.6 || kn.pos.y < -25 || kn.vrijT > 30) this.terugNaarStart(kn);
  }

  vang(kn) {
    const x = kn.pos.x, y = kn.pos.y, z = kn.pos.z;
    let beste = null, besteD = 0.14 * 0.14;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) {
      const lijst = this.hash.get(this.hashKey(x + dx * 0.8, y + dy * 0.8, z + dz * 0.8));
      if (!lijst) continue;
      for (let j = 0; j < lijst.length; j += 2) {
        const k = this.ketens[lijst[j]], i = lijst[j + 1];
        if (k.k === kn.verlatenKeten && Math.abs(k.S[i] - kn.verlatenS) < 1.2) continue;
        const ex = x - k.P[i * 3], ey = y - k.P[i * 3 + 1], ez = z - k.P[i * 3 + 2];
        const ux = k.U[i * 3], uy = k.U[i * 3 + 1], uz = k.U[i * 3 + 2];
        const boven = ex * ux + ey * uy + ez * uz;
        if (boven < -0.08) continue;
        const d = ex * ex + ey * ey + ez * ez;
        if (d < besteD) { besteD = d; beste = [k, i]; }
      }
    }
    if (!beste) return;
    const [k, i] = beste;
    const v = kn.vel.x * k.T[i * 3] + kn.vel.y * k.T[i * 3 + 1] + kn.vel.z * k.T[i * 3 + 2];
    kn.toestand = 'baan';
    kn.keten = k.k; kn.s = k.S[i]; kn.i = i; kn.v = v * 0.85;
    kn.overT = 0; kn.vrijT = 0; kn.boostE = 0;
    this.gebeurtenis('land', kn);
  }

  binnen(kn) {
    kn.toestand = 'binnen';
    kn.binnenT = 0;
    const tijd = this.tijd - kn.rondeStart;
    if (kn.keten === 0) {
      this.stats.binnen++;
      if (tijd < this.stats.besteRonde) this.stats.besteRonde = tijd;
    }
    this.gebeurtenis('finish', kn, tijd);
  }

  naBinnen(kn) {
    if (this.rondgaan) this.terugNaarStart(kn);
    else kn.toestand = 'uit';
  }

  terugNaarStart(kn) {
    kn.toestand = 'wacht';
    kn.launch = null; kn.v = 0; kn.vel.set(0, 0, 0);
    kn.vorigeFx = '';
    if (!this.wachtrij.includes(kn)) this.wachtrij.push(kn);
    if (!this.heeftStart()) kn.toestand = 'uit';
  }

  // 1D-botsingen tussen knikkers op dezelfde keten
  botsingen() {
    const perKeten = new Map();
    for (const kn of this.knikkers) {
      if (kn.toestand !== 'baan') continue;
      let l = perKeten.get(kn.keten);
      if (!l) { l = []; perKeten.set(kn.keten, l); }
      l.push(kn);
    }
    const d = 2 * KNIKKER_R;
    for (const lijst of perKeten.values()) {
      if (lijst.length < 2) continue;
      lijst.sort((a, b) => a.s - b.s);
      for (let j = 0; j < lijst.length - 1; j++) {
        const a = lijst[j], b = lijst[j + 1];
        const gat = b.s - a.s;
        if (gat >= d) continue;
        const vastA = a.launch && a.launch.fase === 'wacht', vastB = b.launch && b.launch.fase === 'wacht';
        const rel = a.v - b.v;
        if (rel > 0) {
          if (rel > 0.8) this.gebeurtenis('tik', a, rel);
          const e = 0.55;
          if (vastB) { a.v = -a.v * e * 0.5; }
          else if (vastA) { b.v = Math.max(b.v, a.v); }
          else {
            const gem = (a.v + b.v) / 2, half = (rel * e) / 2;
            a.v = gem - half; b.v = gem + half;
          }
        }
        const over = d - gat;
        if (vastB) a.s -= over;
        else if (vastA) b.s += over;
        else { a.s -= over / 2; b.s += over / 2; }
      }
    }
  }

  // ---------------------------------------------------------------- race

  // opties: { rondes, modus: 'race' | 'lms', maxUit (0 = onbeperkt), arcade }
  startRace(spelers, opties) {
    const o = typeof opties === 'number' ? { rondes: opties } : (opties || {});
    const modus = o.modus === 'lms' ? 'lms' : 'race';
    this.race = {
      fase: 'aftellen', modus, rondes: modus === 'lms' ? Infinity : Math.max(1, o.rondes || 1),
      maxUit: modus === 'lms' ? Math.max(1, o.maxUit || 1) : Math.max(0, o.maxUit || 0),
      arcade: !!o.arcade, grip: 1, gladStap: 0,
      start: 0, uitslag: [], aftelT: 3.99, aftelEind: performance.now() + 3990,
      dozen: [], bananen: [], schelpen: [], explosies: [],
    };
    this.knikkers = [];
    this.wachtrij = [];
    const n = spelers.length;
    spelers.forEach((sp, i) => {
      const kn = new Knikker(sp.skin);
      kn.speler = sp;
      kn.zijOffset = n > 1 ? ((i / (n - 1)) - 0.5) * 0.12 : 0;
      kn.item = null; kn.itemRol = 0; kn.boostT = 0; kn.spinT = 0;
      kn.uitgeschakeld = false; kn.winnaar = false;
      this.knikkers.push(kn);
      this.zetOpBaan(kn, 0, 0.32, 0);
      kn.ronde = 0;
    });
    if (this.race.arcade) this.plaatsDozen();
    this.actief = true;
    this.tijd = 0;
  }

  plaatsDozen() {
    const k = this.ketens[0];
    if (!k) return;
    const r = this.race;
    let volgende = Math.min(9, k.lengte * 0.25);
    for (const info of k.info) {
      if (info.s1 < volgende) continue;
      const geschikt = !info.buis && info.t !== 'start' && info.t !== 'finish' && info.fx !== 'lift' && info.fx !== 'launch';
      if (!geschikt) continue;
      const s = Math.max(volgende, info.s0 + (info.s1 - info.s0) * 0.5);
      if (s > k.lengte - 2) break;
      r.dozen.push({ s, actief: true, terugT: 0, id: r.dozen.length });
      volgende = s + 18;
    }
  }

  raceTik(dt) {
    const r = this.race;
    if (!r) return;
    if (r.fase === 'aftellen') {
      const voor = Math.ceil(r.aftelT);
      // aftellen op de klok, zodat het ook bij een haperend beeld precies 3 seconden duurt
      r.aftelT = Math.max(0, (r.aftelEind - performance.now()) / 1000);
      void dt;
      const na = Math.ceil(r.aftelT);
      if (na !== voor && na > 0) this.gebeurtenis('aftel', null, na);
      if (r.aftelT <= 0) {
        r.fase = 'race'; r.start = this.tijd;
        for (const kn of this.knikkers) kn.rondeStart = this.tijd;
        this.gebeurtenis('go');
      }
    }
  }

  voortgang(kn) {
    const L = this.ketens[0] ? this.ketens[0].lengte : 1;
    return kn.ronde * L + (kn.toestand === 'vrij' ? kn.vliegS || 0 : kn.s);
  }

  // Alles wat per stapje in de race gebeurt: timers, itemdozen, bananen, schelpen.
  raceExtra(dt) {
    const r = this.race;
    for (const kn of this.knikkers) {
      if (kn.boostT > 0) kn.boostT -= dt;
      if (kn.spinT > 0) kn.spinT -= dt;
      if (kn.itemRol > 0) {
        kn.itemRol -= dt;
        if (kn.itemRol <= 0) { kn.itemRol = 0; this.gebeurtenis('itemKlaar', kn, kn.item); }
      }
    }
    if (!r.arcade) return;
    for (const d of r.dozen) if (!d.actief && (d.terugT -= dt) <= 0) d.actief = true;
    for (const kn of this.knikkers) {
      if (kn.toestand !== 'baan' || kn.keten !== 0 || kn.uitgeschakeld || kn.gefinisht) continue;
      const a = Math.min(kn.sVorig ?? kn.s, kn.s), b = Math.max(kn.sVorig ?? kn.s, kn.s);
      if (b - a > 3) continue;
      for (const d of r.dozen) {
        if (!d.actief || d.s < a - 0.05 || d.s > b + 0.05) continue;
        d.actief = false; d.terugT = 3.5;
        if (!kn.item && !kn.itemRol) {
          kn.item = this.kiesItem(kn);
          kn.itemRol = 1.3;
          this.gebeurtenis('itemRol', kn, kn.item);
        } else this.gebeurtenis('doos', kn);
      }
      for (let j = r.bananen.length - 1; j >= 0; j--) {
        const ban = r.bananen[j];
        if (ban.s < a - 0.12 || ban.s > b + 0.12) continue;
        if (ban.eigenaar === kn && this.tijd - ban.tijd < 0.6) continue;
        r.bananen.splice(j, 1);
        this.raakEruit(kn, 'banaan');
      }
    }
    this.beweegSchelpen(dt);
    for (const e of r.explosies) e.t += dt;
    r.explosies = r.explosies.filter((e) => e.t < 0.8);
  }

  kiesItem(kn) {
    const actief = this.stand().filter((k) => !k.uitgeschakeld && !k.gefinisht);
    const n = actief.length;
    const plek = Math.max(0, actief.indexOf(kn));
    const f = n > 1 ? plek / (n - 1) : 0;
    const blauwBezig = this.race.schelpen.some((s) => s.soort === 'blauw');
    const gewichten = {
      banaan: 4 * (1 - f) + 0.6,
      boost: 2 + 2.5 * f,
      rood: n > 1 ? 0.6 + 3 * f : 0.8,
      blauw: n >= 3 && f > 0.45 && !blauwBezig ? 1.4 * f : 0,
    };
    let som = 0;
    for (const w of Object.values(gewichten)) som += w;
    let x = Math.random() * som;
    for (const [item, w] of Object.entries(gewichten)) { x -= w; if (x <= 0) return item; }
    return 'boost';
  }

  // De speler drukt op "Gebruik"
  gebruikItem(kn) {
    const r = this.race;
    if (!r || r.fase !== 'race' || !kn.item || kn.itemRol > 0 || kn.uitgeschakeld || kn.gefinisht) return false;
    const item = kn.item;
    kn.item = null;
    const k = this.ketens[0];
    if (item === 'boost') {
      kn.boostT = 1.6;
    } else if (item === 'banaan') {
      let s = kn.toestand === 'vrij' ? (kn.vliegS || 0) - 0.6 : kn.s - 0.55;
      if (s < 0.6) s = Math.min(k.lengte - 0.5, kn.s + 1.2);
      r.bananen.push({ s, eigenaar: kn, tijd: this.tijd });
    } else if (item === 'rood') {
      const mijn = this.voortgang(kn);
      let doel = null, beste = Infinity;
      for (const o of this.knikkers) {
        if (o === kn || o.uitgeschakeld || o.gefinisht) continue;
        const d = this.voortgang(o) - mijn;
        if (d > 0 && d < beste) { beste = d; doel = o; }
      }
      r.schelpen.push({ soort: 'rood', eigenaar: kn, doel, voortgang: mijn + 0.4, v: Math.max(13, Math.abs(kn.v) + 7), t: 0 });
    } else if (item === 'blauw') {
      const pos = kn.pos.clone();
      r.schelpen.push({ soort: 'blauw', eigenaar: kn, doel: null, van: pos, pos: pos.clone(), t: 0, duur: 2.4 });
    }
    this.gebeurtenis('itemGebruikt', kn, item);
    return true;
  }

  leider() {
    return this.stand().find((k) => !k.uitgeschakeld && !k.gefinisht) || null;
  }

  // positie op de hoofdbaan bij een totale voortgang (ronden meegerekend)
  puntOpBaan(voortgang, uit) {
    const k = this.ketens[0];
    const s = ((voortgang % k.lengte) + k.lengte) % k.lengte;
    const tmp = this._pb || (this._pb = { i: 0, s: 0 });
    tmp.s = s;
    const i = this.zoek(k, tmp);
    return this.interp(k, i, s, uit || (this._pbu = this._pbu || {}));
  }

  beweegSchelpen(dt) {
    const r = this.race;
    const k = this.ketens[0];
    for (let j = r.schelpen.length - 1; j >= 0; j--) {
      const sc = r.schelpen[j];
      sc.t += dt;
      if (sc.soort === 'rood') {
        const doel = sc.doel;
        if (doel && (doel.uitgeschakeld || doel.gefinisht)) sc.doel = null;
        if (sc.doel) sc.v = Math.max(sc.v, Math.abs(sc.doel.v) + 6);
        sc.voortgang += sc.v * dt;
        const p = this.puntOpBaan(sc.voortgang);
        sc.pos = sc.pos || new THREE.Vector3();
        sc.pos.set(p.px + p.ux * 0.02, p.py + p.uy * 0.02, p.pz + p.uz * 0.02);
        if (sc.doel && this.voortgang(sc.doel) - sc.voortgang < 0.25) {
          if (sc.doel.toestand === 'baan') this.raakEruit(sc.doel, 'rood');
          r.explosies.push({ pos: sc.pos.clone(), t: 0, kleur: 0xff4030 });
          r.schelpen.splice(j, 1);
          continue;
        }
        // tegen een banaan op de baan
        const sNu = ((sc.voortgang % k.lengte) + k.lengte) % k.lengte;
        const bi = r.bananen.findIndex((b) => Math.abs(b.s - sNu) < 0.25);
        if (bi >= 0) { r.bananen.splice(bi, 1); r.explosies.push({ pos: sc.pos.clone(), t: 0, kleur: 0xffd23a }); r.schelpen.splice(j, 1); continue; }
        if (sc.t > 9) r.schelpen.splice(j, 1);
      } else {
        // blauwe schelp: vliegt in een boog naar de leider, ontwijken kan niet
        const leider = this.leider();
        if (!leider) { r.schelpen.splice(j, 1); continue; }
        sc.doel = leider;
        const f = Math.min(1, sc.t / sc.duur);
        const doelPos = leider.pos;
        sc.pos.lerpVectors(sc.van, doelPos, f * f * (3 - 2 * f));
        sc.pos.y += Math.sin(f * Math.PI) * 7 + 0.5 * f;
        if (f >= 1) {
          if (leider.toestand === 'baan') this.raakEruit(leider, 'blauw');
          r.explosies.push({ pos: leider.pos.clone(), t: 0, kleur: 0x3f8cff, groot: true });
          r.schelpen.splice(j, 1);
        }
      }
    }
  }

  // Geraakt door een banaan of schelp: van de baan, of in een buis een spin.
  raakEruit(kn, oorzaak) {
    if (kn.toestand !== 'baan' || kn.uitgeschakeld || kn.gefinisht) return;
    const k = this.ketens[kn.keten];
    const g = this._rg || (this._rg = {});
    const i = this.zoek(k, kn);
    const p = this.interp(k, i, kn.s, g);
    this.gebeurtenis('geraakt', kn, oorzaak);
    if (p.stuk.buis || p.stuk.t === 'start' || kn.launch) {
      kn.v *= 0.1;
      kn.spinT = 1.2;
      return;
    }
    kn.vel.set(p.tx * kn.v, p.ty * kn.v, p.tz * kn.v);
    this.vliegEruit(kn, k, g, Math.random() > 0.5 ? 1 : -1);
  }

  raceRonde(kn) {
    const r = this.race;
    const rondeTijd = this.tijd - kn.rondeStart;
    kn.besteRonde = Math.min(kn.besteRonde, rondeTijd);
    kn.ronde++;
    if (r.modus === 'race' && kn.ronde >= r.rondes && !kn.gefinisht) {
      kn.gefinisht = true;
      kn.finishTijd = this.tijd - r.start;
      r.uitslag.push(kn);
      kn.toestand = 'binnen';
      kn.binnenT = 0;
      kn.item = null;
      this.gebeurtenis('raceFinish', kn, r.uitslag.length);
      this.controleerEinde();
      return;
    }
    if (r.modus === 'lms') {
      // elke ronde van de koploper wordt de baan een beetje gladder
      const meeste = Math.max(...this.knikkers.filter((k) => !k.uitgeschakeld).map((k) => k.ronde));
      const grip = Math.max(0.6, 1 - 0.07 * meeste);
      if (grip < r.grip - 1e-6) { r.grip = grip; r.gladStap++; this.gebeurtenis('gladder', null, grip); }
    }
    this.gebeurtenis('ronde', kn, rondeTijd);
    kn.rondeStart = this.tijd;
    this.zetOpBaan(kn, 0, 0.32, Math.max(0, kn.v * 0.3));
  }

  controleerEinde() {
    const r = this.race;
    if (!r || r.fase === 'klaar') return;
    const n = this.knikkers.length;
    const levend = this.knikkers.filter((k) => !k.uitgeschakeld);
    let klaar = false;
    if (r.modus === 'race') klaar = this.knikkers.every((k) => k.gefinisht || k.uitgeschakeld);
    else {
      klaar = (n >= 2 && levend.length <= 1) || (n === 1 && levend.length === 0);
      if (klaar && levend.length === 1) { levend[0].winnaar = true; this.gebeurtenis('winnaar', levend[0]); }
    }
    if (klaar) {
      r.fase = 'klaar';
      r.eindTijd = this.tijd - r.start;
      this.gebeurtenis('raceKlaar');
    }
  }

  raceTerug(kn) {
    const k = this.ketens[0];
    let s = Math.max(0.32, (kn.vliegS || 0) - 1.6);
    if (s > k.lengte - 0.2) s = k.lengte - 0.2;
    // niet midden in een launchtunnel terugzetten
    const info = k.info.find((x) => s >= x.s0 && s < x.s1);
    if (info && info.fx === 'launch') s = Math.max(0.32, info.s0 - 0.4);
    this.zetOpBaan(kn, 0, s, 0);
    this.gebeurtenis('terug', kn);
  }

  // klassement: beste eerst
  stand() {
    const r = this.race;
    return [...this.knikkers].sort((a, b) => {
      if (a.gefinisht || b.gefinisht) {
        if (a.gefinisht && b.gefinisht) return a.finishTijd - b.finishTijd;
        return a.gefinisht ? -1 : 1;
      }
      if (a.uitgeschakeld || b.uitgeschakeld) {
        if (a.uitgeschakeld && b.uitgeschakeld) return r && r.modus === 'lms' ? b.uitTijd - a.uitTijd : b.uitVoortgang - a.uitVoortgang;
        return a.uitgeschakeld ? 1 : -1;
      }
      return this.voortgang(b) - this.voortgang(a);
    });
  }

  stopRace() {
    this.race = null;
    this.knikkers = [];
    this.wachtrij = [];
    this.actief = false;
  }

  stop() {
    this.actief = false;
    this.knikkers = [];
    this.wachtrij = [];
    this.race = null;
  }
}
