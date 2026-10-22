// Baanstukken op het raster, zoals in RollerCoaster Tycoon.
//
// Het raster bestaat uit tegels van 2 x 2 meter. Een baan loopt van "aansluiting" naar "aansluiting":
//  - recht (richting 0, 2, 4, 6): een aansluiting ligt midden op een tegelrand;
//  - diagonaal (richting 1, 3, 5, 7): een aansluiting ligt op een tegelhoek.
// Richting d is een veelvoud van 45 graden: 0 = +x, 2 = +z, 4 = -x, 6 = -z.
// Hoogte gaat in niveaus van 0,5 meter. Hellingen hebben vaste standen (zie HELLING in config.js).

import { TEGEL, NIVEAU, HELLING, RASTER, MAX_NIVEAU } from './config.js';

const S2 = Math.SQRT1_2;
const TAU = Math.PI * 2;

export function koers(d) {
  switch (((d % 8) + 8) % 8) {
    case 0: return [1, 0];
    case 1: return [S2, S2];
    case 2: return [0, 1];
    case 3: return [-S2, S2];
    case 4: return [-1, 0];
    case 5: return [-S2, -S2];
    case 6: return [0, -1];
    default: return [S2, -S2];
  }
}

// Draai (x, z) een aantal kwartslagen (+x gaat naar +z).
export function draaiKwart(x, z, k) {
  k = ((k % 4) + 4) % 4;
  for (let i = 0; i < k; i++) { const t = x; x = -z; z = t; }
  return [x, z];
}

function hermite(p0, m0, p1, m1, t) {
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
}
function hermite2(P0, T0, P1, T1) {
  return (t) => [hermite(P0[0], T0[0], P1[0], T1[0], t), hermite(P0[1], T0[1], P1[1], T1[1], t)];
}
const glad = (t) => t * t * (3 - 2 * t);

// ------------------------------------------------------------------ soorten stukken

// vorm: welke plattegrond; basis: 0 = start recht, 1 = start diagonaal, 'beide'.
// bocht: of er een linker- en rechterversie is.  vast: hoogte vast (vlak in en uit).
export const SOORTEN = {
  recht:    { naam: 'Recht',            groep: 'vorm',    basis: 'beide', hellingen: 'alle' },
  bocht1:   { naam: 'Kleine bocht',     groep: 'vorm',    basis: 0, bocht: true, hellingen: 'licht', tegels: '1×1' },
  bocht2:   { naam: 'Middelgrote bocht', groep: 'vorm',   basis: 0, bocht: true, hellingen: 'licht', tegels: '2×2' },
  bocht3:   { naam: 'Grote bocht',      groep: 'vorm',    basis: 0, bocht: true, hellingen: 'licht', tegels: '3×3' },
  kwart1:   { naam: 'Kleine 45°-bocht', groep: 'vorm',    basis: 'beide', bocht: true, hellingen: 'licht', tegels: '45°' },
  kwart3:   { naam: 'Grote 45°-bocht',  groep: 'vorm',    basis: 'beide', bocht: true, hellingen: 'licht', tegels: '45°' },
  sbocht:   { naam: 'S-bocht',          groep: 'vorm',    basis: 0, bocht: true, hellingen: 'licht', tegels: '3×2' },
  spiraal1: { naam: 'Kleine spiraal',   groep: 'speciaal', basis: 0, bocht: true, vast: true, spiraal: 4 },
  spiraal2: { naam: 'Grote spiraal',    groep: 'speciaal', basis: 0, bocht: true, vast: true, spiraal: 8 },
  looping:  { naam: 'Looping',          groep: 'speciaal', basis: 0, vast: true, buis: true },
  kurk:     { naam: 'Kurkentrekker',    groep: 'speciaal', basis: 0, bocht: true, vast: true, buis: true },
  aqua:     { naam: 'Aquariumtunnel',   groep: 'speciaal', basis: 0, vast: true, buis: true },
  aquaB:    { naam: 'Aquariumbocht',    groep: 'speciaal', basis: 0, bocht: true, vast: true, buis: true },
  launch:   { naam: 'Launchtunnel',     groep: 'speciaal', basis: 0, vast: true, buis: true },
  finish:   { naam: 'Finish',           groep: 'speciaal', basis: 0, vast: true, einde: true },
  start:    { naam: 'Startpunt',        groep: 'start',   basis: 0, vast: true },
};

export const EFFECTEN = {
  '': 'Geen',
  lift: 'Kettinglift',
  boost: 'Booster',
  rem: 'Rem',
  vuur: 'Vuur',
};

export function magOpBasis(t, basis) {
  const b = SOORTEN[t].basis;
  return b === 'beide' || b === basis;
}

// Welke hellingstanden mag dit stuk hebben (in- en uitgang)?
export function hellingMag(t, e, s) {
  const def = SOORTEN[t];
  if (!def) return false;
  if (def.vast) return e === 0 && s === 0;
  if (Math.abs(e - s) > 1) return false;
  if (def.hellingen === 'licht' && (Math.abs(e) > 1 || Math.abs(s) > 1)) return false;
  return true;
}

// ------------------------------------------------------------------ plattegronden

function cirkel(r) {
  return (t) => { const f = t * Math.PI / 2; return [r * Math.sin(f), r * (1 - Math.cos(f))]; };
}
function rondje(r) {
  return (t) => { const f = t * TAU; return [r * Math.sin(f), r * (1 - Math.cos(f))]; };
}

// Vormen in de basisstand, rechtsom. Links = gespiegeld.
const VORMEN = {
  0: {
    recht:  { raw: (t) => [2 * t, 0], eind: [2, 0], dd: 0 },
    bocht1: { raw: cirkel(1), eind: [1, 1], dd: 2 },
    bocht2: { raw: cirkel(3), eind: [3, 3], dd: 2 },
    bocht3: { raw: cirkel(5), eind: [5, 5], dd: 2 },
    kwart1: { raw: hermite2([0, 0], [2.33, 0], [2, 1], [2.33 * S2, 2.33 * S2]), eind: [2, 1], dd: 1 },
    kwart3: { raw: hermite2([0, 0], [6.98, 0], [6, 3], [6.98 * S2, 6.98 * S2]), eind: [6, 3], dd: 1 },
    sbocht: { raw: hermite2([0, 0], [6, 0], [6, 2], [6, 0]), eind: [6, 2], dd: 0 },
    spiraal1: { raw: rondje(1), eind: [0, 0], dd: 0 },
    spiraal2: { raw: rondje(3), eind: [0, 0], dd: 0 },
    aqua:   { raw: (t) => [4 * t, 0], eind: [4, 0], dd: 0 },
    aquaB:  { raw: cirkel(3), eind: [3, 3], dd: 2 },
    launch: { raw: (t) => [6 * t, 0], eind: [6, 0], dd: 0 },
    start:  { raw: (t) => [2 * t, 0], eind: [2, 0], dd: 0 },
    looping: { eind: [4, 0], dd: 0 },
    kurk:   { eind: [6, 0], dd: 0 },
    finish: { eind: [2, 0], dd: 0 },
  },
  1: {
    recht:  { raw: (t) => [2 * t, 2 * t], eind: [2, 2], dd: 0 },
    kwart1: { raw: hermite2([0, 0], [2.33 * S2, 2.33 * S2], [1, 2], [0, 2.33]), eind: [1, 2], dd: 1 },
    kwart3: { raw: hermite2([0, 0], [6.98 * S2, 6.98 * S2], [3, 6], [0, 6.98]), eind: [3, 6], dd: 1 },
  },
};

function spiegel(basis, x, z) {
  return basis === 0 ? [x, -z] : [z, x];
}

// Plattegrond herbemonsterd op gelijke booglengte, met koers en kromming.
const planCache = new Map();
function plan(basis, t, zijde) {
  const sleutel = basis + t + zijde;
  let p = planCache.get(sleutel);
  if (p) return p;
  const vorm = VORMEN[basis][t];
  const raw = zijde < 0 ? (u) => { const q = vorm.raw(u); return spiegel(basis, q[0], q[1]); } : vorm.raw;
  const N = 600;
  const xs = new Float64Array(N + 1), zs = new Float64Array(N + 1), cum = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const q = raw(i / N);
    xs[i] = q[0]; zs[i] = q[1];
    if (i > 0) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
  }
  const L = cum[N];
  const M = 400;
  const X = new Float64Array(M + 1), Z = new Float64Array(M + 1), HX = new Float64Array(M + 1), HZ = new Float64Array(M + 1), K = new Float64Array(M + 1);
  let j = 0;
  for (let i = 0; i <= M; i++) {
    const doel = (i / M) * L;
    while (j < N - 1 && cum[j + 1] < doel) j++;
    const f = cum[j + 1] > cum[j] ? (doel - cum[j]) / (cum[j + 1] - cum[j]) : 0;
    X[i] = xs[j] + (xs[j + 1] - xs[j]) * f;
    Z[i] = zs[j] + (zs[j + 1] - zs[j]) * f;
  }
  for (let i = 0; i <= M; i++) {
    const a = Math.max(0, i - 1), b = Math.min(M, i + 1);
    const dx = X[b] - X[a], dz = Z[b] - Z[a];
    const l = Math.hypot(dx, dz) || 1;
    HX[i] = dx / l; HZ[i] = dz / l;
  }
  const ds = L / M;
  for (let i = 0; i <= M; i++) {
    const a = Math.max(0, i - 1), b = Math.min(M, i + 1);
    const hoekA = Math.atan2(HZ[a], HX[a]), hoekB = Math.atan2(HZ[b], HX[b]);
    let dh = hoekB - hoekA;
    while (dh > Math.PI) dh -= TAU;
    while (dh < -Math.PI) dh += TAU;
    K[i] = dh / ((b - a) * ds);
  }
  p = {
    L,
    at(u) {
      const f = Math.min(Math.max(u, 0), 1) * M;
      const i = Math.min(M - 1, Math.floor(f));
      const g = f - i;
      return [X[i] + (X[i + 1] - X[i]) * g, Z[i] + (Z[i + 1] - Z[i]) * g, K[i] + (K[i + 1] - K[i]) * g];
    },
  };
  planCache.set(sleutel, p);
  return p;
}

export function planLengte(t, basis, zijde = 1) {
  if (t === 'looping' || t === 'kurk' || t === 'finish') return VORMEN[0][t].eind[0];
  return plan(basis, t, zijde).L;
}

// Hoogteverschil van een stuk in niveaus.
export function hoogteVerschil(st) {
  const def = SOORTEN[st.t];
  if (st.t === 'start') return -1;
  if (def.spiraal) return st.dh >= 0 ? def.spiraal : -def.spiraal;
  if (def.vast) return 0;
  const L = planLengte(st.t, st.d % 2, st.lr === 'L' ? -1 : 1);
  const gem = (HELLING[st.e] + HELLING[st.s]) / 2;
  let dh = Math.round((L * gem) / NIVEAU);
  if (dh === 0 && gem !== 0) dh = gem > 0 ? 1 : -1;
  return dh;
}

// Waar komt het stuk uit?
export function uitgang(st) {
  const basis = ((st.d % 2) + 2) % 2;
  const vorm = VORMEN[basis][st.t];
  const zijde = st.lr === 'L' ? -1 : 1;
  let [ex, ez] = vorm.eind;
  if (zijde < 0) [ex, ez] = spiegel(basis, ex, ez);
  const k = (st.d - basis) / 2;
  const [wx, wz] = draaiKwart(ex, ez, k);
  return {
    x: Math.round(st.x + wx),
    z: Math.round(st.z + wz),
    d: (((st.d + zijde * vorm.dd) % 8) + 8) % 8,
    l: st.l + hoogteVerschil(st),
    e: SOORTEN[st.t].vast ? 0 : st.s,
  };
}

// ------------------------------------------------------------------ vaste 3D-vormen

const LOOP_R = 1.45;
const LOOP_W = 0.9;
function loopingPunt(t) {
  // t over drie delen: aanloop (lengte 2), lus (2 pi R), uitloop (2)
  const LA = 2, LL = TAU * LOOP_R, LB = 2, tot = LA + LL + LB;
  const s = t * tot;
  if (s <= LA) {
    const u = s / LA;
    return { p: [2 * u, 0, -LOOP_W / 2 * glad(u)], op: [0, 1, 0] };
  }
  if (s <= LA + LL) {
    const u = (s - LA) / LL;
    const th = u * TAU;
    return {
      p: [2 + LOOP_R * Math.sin(th), LOOP_R * (1 - Math.cos(th)), -LOOP_W / 2 + LOOP_W * glad(u)],
      op: [-Math.sin(th), Math.cos(th), 0],
    };
  }
  const u = (s - LA - LL) / LB;
  return { p: [2 + 2 * u, 0, LOOP_W / 2 * (1 - glad(u))], op: [0, 1, 0] };
}

const KURK_R = 0.9;
function kurkPunt(t, zijde) {
  const R = KURK_R * Math.sin(Math.PI * t) ** 2;
  const a = TAU * t;
  return {
    p: [6 * t, R * (1 - Math.cos(a)), zijde * R * Math.sin(a)],
    op: [0, Math.cos(a), -zijde * Math.sin(a)],
  };
}

export const FINISH = { cx: 1, r0: 0.8, r1: 0.17, rondes: 1.75, diep: 0.55, rand: -0.1 };
const finishAanloop = hermite2([0, 0], [1.3, 0], [FINISH.cx, -FINISH.r0], [1.3, 0]);
function finishPunt(t) {
  const deelA = 0.22;
  if (t <= deelA) {
    const u = t / deelA;
    const q = finishAanloop(u);
    return { p: [q[0], FINISH.rand * glad(u), q[1]], op: [0, 1, 0] };
  }
  const u = (t - deelA) / (1 - deelA);
  const fi = u * TAU * FINISH.rondes;
  const r = FINISH.r0 - (FINISH.r0 - FINISH.r1) * Math.pow(u, 0.9);
  const diepte = (FINISH.r0 - r) / (FINISH.r0 - FINISH.r1);
  const y = FINISH.rand - FINISH.diep * Math.pow(diepte, 1.15);
  const x = FINISH.cx + r * Math.sin(fi), z = -r * Math.cos(fi);
  const nx = FINISH.cx - x, nz = -z, nl = Math.hypot(nx, nz) || 1;
  return { p: [x, y, z], op: [0.6 * nx / nl, 0.8, 0.6 * nz / nl] };
}
export function finishOppervlak(r) {
  // hoogte van de trechterwand (onder het midden van de knikker)
  const diepte = Math.min(1.2, Math.max(0, (FINISH.r0 - r) / (FINISH.r0 - FINISH.r1)));
  return FINISH.rand - FINISH.diep * Math.pow(diepte, 1.15);
}

// ------------------------------------------------------------------ bemonsteren

function geschatteLengte(st) {
  if (st.t === 'looping') return 4 + TAU * LOOP_R;
  if (st.t === 'kurk') return 8.5;
  if (st.t === 'finish') return 1.5 + TAU * 0.5 * FINISH.rondes;
  const L = planLengte(st.t, st.d % 2, st.lr === 'L' ? -1 : 1);
  return Math.hypot(L, hoogteVerschil(st) * NIVEAU) * 1.1;
}

export function stukSleutel(st) {
  return `${st.t}|${st.lr || ''}|${st.x}|${st.z}|${st.d}|${st.l}|${st.e}|${st.s}|${st.dh || 0}|${st.k === false ? 0 : 1}`;
}

const padCache = new Map();

// Geeft de "hartlijn" (het midden van de knikker) van een stuk, in wereldcoordinaten.
// perMeter: hoe dicht de punten liggen.
export function stukPad(st, perMeter = 24) {
  const sleutel = stukSleutel(st) + '@' + perMeter;
  const c = padCache.get(sleutel);
  if (c) return c;
  if (padCache.size > 6000) padCache.clear();

  const basis = ((st.d % 2) + 2) % 2;
  const zijde = st.lr === 'L' ? -1 : 1;
  const kw = (st.d - basis) / 2;
  const y0 = st.l * NIVEAU;
  const def = SOORTEN[st.t];
  const n = Math.max(8, Math.ceil(geschatteLengte(st) * perMeter)) + 1;

  const P = new Float64Array(n * 3);
  const H = new Float64Array(n * 3);   // richting voor "omhoog"
  const B = new Float64Array(n);       // kanteling

  if (st.t === 'looping' || st.t === 'kurk' || st.t === 'finish') {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      let q;
      if (st.t === 'looping') q = loopingPunt(t);
      else if (st.t === 'kurk') q = kurkPunt(t, zijde);
      else q = finishPunt(t);
      let [px, pz] = [q.p[0], q.p[2]];
      let [hx, hz] = [q.op[0], q.op[2]];
      if (st.t === 'finish' && zijde < 0) { pz = -pz; hz = -hz; }
      const [wx, wz] = draaiKwart(px, pz, kw);
      const [ux, uz] = draaiKwart(hx, hz, kw);
      P[i * 3] = st.x + wx; P[i * 3 + 1] = y0 + q.p[1]; P[i * 3 + 2] = st.z + wz;
      H[i * 3] = ux; H[i * 3 + 1] = q.op[1]; H[i * 3 + 2] = uz;
    }
  } else {
    const pl = plan(basis, st.t, zijde);
    const dh = hoogteVerschil(st) * NIVEAU;
    const L = pl.L;
    const m0 = st.t === 'start' ? 0 : HELLING[st.e] * L;
    const m1 = st.t === 'start' ? 0 : HELLING[st.s] * L;
    const kantel = st.k !== false && def.bocht;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const [px, pz, kappa] = pl.at(u);
      const [wx, wz] = draaiKwart(px, pz, kw);
      P[i * 3] = st.x + wx;
      P[i * 3 + 1] = y0 + hermite(0, m0, dh, m1, u);
      P[i * 3 + 2] = st.z + wz;
      H[i * 3 + 1] = 1;
      if (kantel) {
        const rand = def.spiraal ? glad(Math.min(1, u / 0.12, (1 - u) / 0.12)) : glad(Math.min(1, u / 0.3)) * glad(Math.min(1, (1 - u) / 0.3));
        B[i] = Math.max(-0.62, Math.min(0.62, Math.atan(0.9 * kappa))) * rand;
      }
    }
  }

  // Raaklijn, omhoog en zijwaarts; booglengte.
  const T = new Float64Array(n * 3), U = new Float64Array(n * 3), R = new Float64Array(n * 3), S = new Float64Array(n);
  let vorigeU = [0, 1, 0];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    let tx = P[b * 3] - P[a * 3], ty = P[b * 3 + 1] - P[a * 3 + 1], tz = P[b * 3 + 2] - P[a * 3 + 2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    let hx = H[i * 3], hy = H[i * 3 + 1], hz = H[i * 3 + 2];
    const dot = hx * tx + hy * ty + hz * tz;
    hx -= dot * tx; hy -= dot * ty; hz -= dot * tz;
    let hl = Math.hypot(hx, hy, hz);
    if (hl < 1e-4) { [hx, hy, hz] = vorigeU; hl = 1; }
    hx /= hl; hy /= hl; hz /= hl;
    // zijwaarts = T x U
    let rx = ty * hz - tz * hy, ry = tz * hx - tx * hz, rz = tx * hy - ty * hx;
    const beta = B[i];
    if (beta) {
      const cb = Math.cos(beta), sb = Math.sin(beta);
      const ux = hx * cb + rx * sb, uy = hy * cb + ry * sb, uz = hz * cb + rz * sb;
      hx = ux; hy = uy; hz = uz;
      rx = ty * hz - tz * hy; ry = tz * hx - tx * hz; rz = tx * hy - ty * hx;
    }
    vorigeU = [hx, hy, hz];
    T[i * 3] = tx; T[i * 3 + 1] = ty; T[i * 3 + 2] = tz;
    U[i * 3] = hx; U[i * 3 + 1] = hy; U[i * 3 + 2] = hz;
    R[i * 3] = rx; R[i * 3 + 1] = ry; R[i * 3 + 2] = rz;
    if (i > 0) S[i] = S[i - 1] + Math.hypot(P[i * 3] - P[i * 3 - 3], P[i * 3 + 1] - P[i * 3 - 2], P[i * 3 + 2] - P[i * 3 - 1]);
  }
  const pad = { n, P, T, U, R, S, lengte: S[n - 1] };
  padCache.set(sleutel, pad);
  return pad;
}

// ------------------------------------------------------------------ ruimtebeslag

export function vakSleutel(cx, cz, lv) {
  return ((cx + 128) * 256 + (cz + 128)) * 256 + (lv + 16);
}

const ruimteCache = new Map();

// Welke tegels en hoogtes neemt een stuk in beslag? Plus controle op grond en grenzen.
export function ruimte(st) {
  const sleutel = stukSleutel(st);
  const c = ruimteCache.get(sleutel);
  if (c) return c;
  if (ruimteCache.size > 6000) ruimteCache.clear();
  const pad = stukPad(st, 12);
  const vakken = new Set();
  const tegels = new Map();
  let laagste = Infinity, hoogste = -Infinity, buiten = false;
  const marge = pad.lengte * 0.02;
  for (let i = 0; i < pad.n; i++) {
    const s = pad.S[i];
    const x = pad.P[i * 3], y = pad.P[i * 3 + 1], z = pad.P[i * 3 + 2];
    laagste = Math.min(laagste, y); hoogste = Math.max(hoogste, y);
    if (s < marge || s > pad.lengte - marge) continue;
    const cx = Math.floor(x / TEGEL), cz = Math.floor(z / TEGEL);
    if (cx < -RASTER || cx >= RASTER || cz < -RASTER || cz >= RASTER) buiten = true;
    const l0 = Math.floor((y - 0.32) / NIVEAU), l1 = Math.floor((y + 0.34) / NIVEAU);
    for (let l = l0; l <= l1; l++) vakken.add(vakSleutel(cx, cz, l));
    const tk = cx + ',' + cz;
    const t = tegels.get(tk);
    if (t) { t[2] = Math.min(t[2], y); t[3] = Math.max(t[3], y); } else tegels.set(tk, [cx, cz, y, y]);
  }
  // Extra ruimte voor bakken en tunnels
  const extra = { aqua: [-4, 3], aquaB: [-4, 3], launch: [-1, 2], finish: [-3, 1] }[st.t];
  if (extra) {
    let lijst = [...tegels.values()];
    if (st.t === 'aquaB') {
      // de hele 2x2-bak
      const xs = lijst.map((t) => t[0]), zs = lijst.map((t) => t[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
      lijst = [];
      for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
        lijst.push([x, z, st.l * NIVEAU, st.l * NIVEAU]);
        if (!tegels.has(x + ',' + z)) tegels.set(x + ',' + z, [x, z, st.l * NIVEAU, st.l * NIVEAU]);
      }
    }
    for (const [cx, cz] of lijst) {
      for (let l = st.l + extra[0]; l <= st.l + extra[1]; l++) vakken.add(vakSleutel(cx, cz, l));
    }
  }
  const r = {
    vakken,
    tegels: [...tegels.values()],
    laagste,
    hoogste,
    buiten,
    teLaag: laagste < 0.45,
    teHoog: hoogste > MAX_NIVEAU * NIVEAU + 3,
  };
  ruimteCache.set(sleutel, r);
  return r;
}

export const PAD_INFO = { LOOP_R, LOOP_W, KURK_R };
