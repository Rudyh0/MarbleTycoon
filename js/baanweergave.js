// Tekent de baan: goten, glazen buizen, steunen, effecten (lift, booster, rem, vuur)
// en de speciale stukken (starttoren, finish-trechter, aquarium, launchtunnel).

import * as THREE from '../lib/three.min.js';
import { NIVEAU, GOOT_R, KNIKKER_R, BUIS_R, TEGEL } from './config.js';
import { SOORTEN, stukPad, stukSleutel, koers, draaiKwart, FINISH, finishOppervlak, vakSleutel, PAD_INFO } from './stukken.js';
import { startStuk } from './baan.js';
import { Kit, MAT, kleurMix } from './modelkit.js';
import { kettingTex, pijlTex, vlamTex, geblokteVlagTex, belTex, tekstTex } from './texturen.js';

const DEG = Math.PI / 180;
const CY = GOOT_R - KNIKKER_R;
const DIK = 0.055;

const baanMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.12, side: THREE.DoubleSide });
const kleurTmp = new THREE.Color();

function boog(r, a0, a1, n, cy = CY) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + (a1 - a0) * (i / n)) * DEG;
    pts.push([r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
function cirkel(r, cx, cy, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function gootProfiel(kleur) {
  const basis = new THREE.Color(kleur);
  const donker = basis.clone().multiplyScalar(0.62);
  const licht = basis.clone().lerp(new THREE.Color(0xffffff), 0.42);
  const binnen = boog(GOOT_R, 198, 342, 12);
  const buiten = boog(GOOT_R + DIK, 342, 198, 12);
  const railR = 0.032;
  const rl = [(GOOT_R + DIK * 0.5) * Math.cos(198 * DEG), CY + (GOOT_R + DIK * 0.5) * Math.sin(198 * DEG) + 0.012];
  const rr = [(GOOT_R + DIK * 0.5) * Math.cos(342 * DEG), CY + (GOOT_R + DIK * 0.5) * Math.sin(342 * DEG) + 0.012];
  return [
    { pts: binnen, kleur: basis },
    { pts: buiten, kleur: donker },
    { pts: [binnen[0], buiten[buiten.length - 1]], kleur: basis },
    { pts: [binnen[binnen.length - 1], buiten[0]], kleur: basis },
    { pts: cirkel(railR, rl[0], rl[1], 8), kleur: licht },
    { pts: cirkel(railR, rr[0], rr[1], 8), kleur: licht },
  ];
}

// Zet een profiel langs een pad. pad heeft P, U, R (Float64Array) en n.
function veeg(pad, profiel, opties = {}) {
  const geos = [];
  const van = opties.van || 0, tot = opties.tot ?? pad.n - 1;
  const n = tot - van + 1;
  for (const lijn of profiel) {
    const m = lijn.pts.length;
    const pos = new Float32Array(n * m * 3);
    const col = new Float32Array(n * m * 3);
    const uv = opties.uv ? new Float32Array(n * m * 2) : null;
    const c = lijn.kleur || kleurTmp.set(0xffffff);
    for (let ii = 0; ii < n; ii++) {
      const i = van + ii;
      const px = pad.P[i * 3], py = pad.P[i * 3 + 1], pz = pad.P[i * 3 + 2];
      const ux = pad.U[i * 3], uy = pad.U[i * 3 + 1], uz = pad.U[i * 3 + 2];
      const rx = pad.R[i * 3], ry = pad.R[i * 3 + 1], rz = pad.R[i * 3 + 2];
      for (let j = 0; j < m; j++) {
        const [r, u] = lijn.pts[j];
        const k = (ii * m + j) * 3;
        pos[k] = px + rx * r + ux * u;
        pos[k + 1] = py + ry * r + uy * u;
        pos[k + 2] = pz + rz * r + uz * u;
        col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
        if (uv) { uv[(ii * m + j) * 2] = (pad.S[i] - pad.S[van]) / (opties.uvSchaal || 1); uv[(ii * m + j) * 2 + 1] = j / (m - 1); }
      }
    }
    const idx = [];
    for (let ii = 0; ii < n - 1; ii++) for (let j = 0; j < m - 1; j++) {
      const a = ii * m + j, b = a + 1, c2 = a + m, d = c2 + 1;
      idx.push(a, c2, b, b, c2, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    geos.push(g);
  }
  if (geos.length === 1) return geos[0];
  const samen = THREE.mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return samen;
}

function padIndex(pad, u) {
  return Math.min(pad.n - 1, Math.max(0, Math.round(u * (pad.n - 1))));
}
function v3(arr, i) { return new THREE.Vector3(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]); }

// Lokaal assenstelsel van een stuk (basisstand): groep op de ingang, gedraaid in kwartslagen.
function lokaleGroep(st) {
  const g = new THREE.Group();
  const kw = (st.d - (st.d % 2)) / 2;
  g.position.set(st.x, st.l * NIVEAU, st.z);
  g.rotation.y = -kw * Math.PI / 2;
  return g;
}

// ------------------------------------------------------------------ steunen

function zetSteun(kit, top, kleur, bodem, R) {
  const hoogte = top.y - bodem;
  if (hoogte < 0.12) return;
  const dik = hoogte > 8 ? 0.075 : 0.055;
  kit.cil(dik, dik * 1.15, hoogte, kleur, { x: top.x, y: bodem, z: top.z, seg: 8 });
  if (R) {
    const hoek = Math.atan2(R.z, R.x);
    kit.blok(0.52, 0.05, 0.07, kleur, { x: top.x, y: top.y - 0.03, z: top.z, ry: -hoek });
  }
  if (bodem < 0.05) kit.cil(0.15, 0.18, 0.07, kleurMix(kleur, '#000000', 0.35), { x: top.x, y: 0, z: top.z, seg: 10 });
  // dwarsverbanden bij hoge steunen
  for (let y = bodem + 2.4; y < top.y - 0.8; y += 2.4) {
    kit.cil(dik * 1.6, dik * 1.6, 0.08, kleurMix(kleur, '#000000', 0.2), { x: top.x, y, z: top.z, seg: 8 });
  }
}

function steunPosities(st) {
  switch (st.t) {
    case 'recht': return [0.5];
    case 'bocht1': case 'kwart1': return [0.5];
    case 'bocht2': return [0.5];
    case 'bocht3': case 'sbocht': return [0.28, 0.72];
    case 'kwart3': return [0.35, 0.78];
    case 'kurk': return [0.07, 0.93];
    case 'looping': return 'looping';
    default: return [];
  }
}

// ------------------------------------------------------------------ één stuk

export function bouwStukMesh(st, ctx = {}) {
  const def = SOORTEN[st.t];
  const groep = new THREE.Group();
  groep.userData = { soort: 'stuk', id: st.id };
  const anim = [];
  const pad = stukPad(st, 6);
  const kleur = st.c || '#4fa3ff';
  const steun = st.sc || '#c9d0da';
  const bodemVan = ctx.steunBodem || ((x, z) => 0);
  const kit = new Kit();

  // goot
  let gootTot = pad.n - 1;
  if (st.t === 'finish') {
    // de goot loopt alleen tot de trechter
    gootTot = Math.max(2, Math.round((pad.n - 1) * 0.2));
  }
  const goot = new THREE.Mesh(veeg(pad, gootProfiel(kleur), { tot: gootTot }), baanMat);
  goot.castShadow = true; goot.receiveShadow = true;
  goot.userData.baan = true;
  groep.add(goot);

  if (def.buis) {
    const buis = new THREE.Mesh(veeg(pad, [{ pts: cirkel(BUIS_R, 0, 0, 16) }]), MAT.glas);
    buis.renderOrder = 3;
    groep.add(buis);
    // dunne ringen om de buis
    const ringKleur = kleurMix(kleur, '#ffffff', 0.3);
    const aantal = Math.max(2, Math.round(pad.lengte / 0.75));
    const m = new THREE.Matrix4();
    for (let r = 0; r <= aantal; r++) {
      const i = padIndex(pad, r / aantal);
      const T = v3(pad.T, i), U = v3(pad.U, i), R = v3(pad.R, i);
      m.makeBasis(R, U, T).setPosition(v3(pad.P, i));
      kit.voeg(new THREE.TorusGeometry(BUIS_R + 0.012, 0.022, 6, 20), ringKleur, { na: m });
    }
  }

  // steunen
  const pos = steunPosities(st);
  if (pos === 'looping') {
    // poten onder de lus en een A-frame
    const lijst = [0.02, 0.5, 0.98];
    for (const u of lijst) {
      const i = padIndex(pad, u);
      const P = v3(pad.P, i), U = v3(pad.U, i), R = v3(pad.R, i);
      const top = P.clone().addScaledVector(U, -0.27);
      zetSteun(kit, top, steun, bodemVan(top.x, top.z, top.y, st.id), R);
    }
    const lg = lokaleGroep(st);
    const lk = new Kit();
    const h = st.l * NIVEAU;
    const LR = PAD_INFO.LOOP_R;
    for (const zx of [-1, 1]) {
      lk.blok(0.08, h + LR * 0.9, 0.08, steun, { x: 2 + zx * (LR + 0.35), y: -h, z: 0 });
      lk.blok(0.07, 0.07, LR * 0.5, steun, { x: 2 + zx * (LR + 0.35), y: LR * 0.85, z: 0 });
    }
    lk.blok(2 * LR + 0.8, 0.07, 0.07, steun, { x: 2, y: LR * 0.9 - 0.05, z: 0 });
    lg.add(lk.bouw());
    groep.add(lg);
  } else {
    for (const u of pos) {
      const i = padIndex(pad, u);
      const P = v3(pad.P, i), U = v3(pad.U, i), R = v3(pad.R, i);
      if (U.y < 0.4) continue;
      const top = P.clone().addScaledVector(U, -0.27);
      if (top.y < 0.15) continue;
      zetSteun(kit, top, steun, bodemVan(top.x, top.z, top.y, st.id), R);
    }
  }

  // spiraal: middenpaal met armen
  if (def.spiraal) {
    const r = st.t === 'spiraal1' ? 1 : 3;
    const zijde = st.lr === 'L' ? -1 : 1;
    const kw = (st.d - (st.d % 2)) / 2;
    const [ax, az] = draaiKwart(0, zijde * r, kw);
    const cx = st.x + ax, cz = st.z + az;
    let hoogste = -Infinity;
    for (let i = 0; i < pad.n; i++) hoogste = Math.max(hoogste, pad.P[i * 3 + 1]);
    const voet = bodemVan(cx, cz, hoogste, st.id);
    kit.cil(0.09, 0.11, hoogste + 0.3 - voet, steun, { x: cx, y: voet, z: cz, seg: 10 });
    kit.bol(0.14, kleurMix(kleur, '#ffffff', 0.3), { x: cx, y: hoogste + 0.32, z: cz });
    if (voet < 0.05) kit.cil(0.25, 0.3, 0.08, kleurMix(steun, '#000000', 0.35), { x: cx, y: 0, z: cz });
    for (const u of [0.125, 0.375, 0.625, 0.875]) {
      const i = padIndex(pad, u);
      const P = v3(pad.P, i), U = v3(pad.U, i);
      const onder = P.clone().addScaledVector(U, -0.26);
      const dx = onder.x - cx, dz = onder.z - cz;
      const len = Math.hypot(dx, dz);
      kit.blok(len, 0.06, 0.06, steun, { x: cx + dx / 2, y: onder.y - 0.03, z: cz + dz / 2, ry: -Math.atan2(dz, dx) });
    }
  }

  // effecten
  if (st.fx === 'lift') effectLift(groep, pad, st, anim);
  if (st.fx === 'boost') effectBoost(groep, pad, st, anim);
  if (st.fx === 'rem') effectRem(kit, pad);
  if (st.fx === 'vuur') effectVuur(groep, kit, pad, st, anim, ctx);

  // speciale stukken
  if (st.t === 'start') bouwStart(groep, st, ctx, anim);
  if (st.t === 'finish') bouwFinish(groep, st, pad, ctx, anim);
  if (st.t === 'aqua' || st.t === 'aquaB') bouwAquarium(groep, st, anim);
  if (st.t === 'launch') bouwLaunch(groep, st, anim, ctx);
  if (st.t === 'kurk') {
    const lg = lokaleGroep(st);
    const lk = new Kit();
    const h = st.l * NIVEAU;
    lk.blok(0.09, h + PAD_INFO.KURK_R * 0.55, 0.09, steun, { x: 3, y: -h, z: 0 });
    lk.bol(0.08, kleurMix(kleur, '#ffffff', 0.3), { x: 3, y: PAD_INFO.KURK_R * 0.55, z: 0 });
    lg.add(lk.bouw());
    groep.add(lg);
  }

  groep.add(kit.bouw());
  groep.userData.anim = anim;
  return groep;
}

// ------------------------------------------------------------------ effecten

function effectLift(groep, pad, st, anim) {
  const tex = kettingTex().clone();
  tex.needsUpdate = true;
  tex.wrapS = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.45, color: 0xdddddd });
  mat.userData.eigen = true; tex.userData.eigen = true;
  const profiel = [{ pts: [[-0.04, -KNIKKER_R + 0.006], [0.04, -KNIKKER_R + 0.006]] }];
  const geo = veeg(pad, profiel, { uv: true, uvSchaal: 0.16 });
  const m = new THREE.Mesh(geo, mat);
  m.userData.effect = true;
  groep.add(m);
  // tandwielkastjes aan begin en eind
  const kit = new Kit();
  for (const u of [0.02, 0.98]) {
    const i = padIndex(pad, u);
    const P = v3(pad.P, i), U = v3(pad.U, i);
    const p = P.clone().addScaledVector(U, -0.34);
    kit.blok(0.26, 0.16, 0.26, '#3b414b', { x: p.x, y: p.y - 0.08, z: p.z, mat: 'metaal' });
    kit.cil(0.07, 0.07, 0.28, '#f2c14e', { x: p.x, y: p.y, z: p.z, rx: Math.PI / 2, midden: true, mat: 'metaal' });
  }
  groep.add(kit.bouw());
  const snelheid = (st.v || 9) / 3.6;
  anim.push((t, dt) => { tex.offset.x -= (snelheid * dt) / 0.16; });
}

function effectBoost(groep, pad, st, anim) {
  const tex = pijlTex().clone();
  tex.needsUpdate = true;
  tex.wrapS = THREE.RepeatWrapping;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: 0x6ff6ff, toneMapped: false, depthWrite: false });
  mat.userData.eigen = true; tex.userData.eigen = true;
  const profiel = [{ pts: [[-0.07, -KNIKKER_R + 0.008], [0.07, -KNIKKER_R + 0.008]] }];
  const m = new THREE.Mesh(veeg(pad, profiel, { uv: true, uvSchaal: 0.3 }), mat);
  m.renderOrder = 4;
  m.userData.effect = true;
  groep.add(m);
  // gloeiende zijstrips
  const kit = new Kit();
  const strip = [{ pts: [[-0.27, 0.035], [-0.27, 0.06]], kleur: new THREE.Color(0x4ff0ff) }, { pts: [[0.27, 0.035], [0.27, 0.06]], kleur: new THREE.Color(0x4ff0ff) }];
  const sg = new THREE.Mesh(veeg(pad, strip), MAT.gloei);
  groep.add(sg);
  groep.add(kit.bouw());
  anim.push((t, dt) => { tex.offset.x -= dt * 2.6; mat.opacity = 0.75 + 0.25 * Math.sin(t * 9); });
}

function effectRem(kit, pad) {
  const n = Math.max(2, Math.floor(pad.lengte / 0.22));
  const m = new THREE.Matrix4();
  for (let k = 0; k < n; k++) {
    const i = padIndex(pad, (k + 0.5) / n);
    const P = v3(pad.P, i), T = v3(pad.T, i), U = v3(pad.U, i), R = v3(pad.R, i);
    for (const zijde of [-1, 1]) {
      const p = P.clone().addScaledVector(R, zijde * 0.17).addScaledVector(U, -0.075);
      m.makeBasis(T, U, R).setPosition(p);
      kit.voeg(new THREE.BoxGeometry(0.13, 0.075, 0.022), '#e0662f', { na: m, mat: 'metaal' });
    }
    if (k % 2 === 0) {
      const p = P.clone().addScaledVector(U, -0.3);
      m.makeBasis(T, U, R).setPosition(p);
      kit.voeg(new THREE.BoxGeometry(0.1, 0.05, 0.5), k % 4 === 0 ? '#f2c14e' : '#22252b', { na: m });
    }
  }
}

let vuurLichten = 0;
export function resetVuurLichten() { vuurLichten = 0; }

function effectVuur(groep, kit, pad, st, anim, ctx) {
  const n = Math.max(2, Math.floor(pad.lengte / 0.45));
  const mat = new THREE.SpriteMaterial({ map: vlamTex(), color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  mat.userData.eigen = true;
  const vlammen = [];
  const m = new THREE.Matrix4();
  for (let k = 0; k < n; k++) {
    const i = padIndex(pad, (k + 0.5) / n);
    const P = v3(pad.P, i), T = v3(pad.T, i), U = v3(pad.U, i), R = v3(pad.R, i);
    for (const zijde of [-1, 1]) {
      const p = P.clone().addScaledVector(R, zijde * 0.36).addScaledVector(U, -0.02);
      m.makeBasis(T, U, R).setPosition(p);
      kit.voeg(new THREE.CylinderGeometry(0.045, 0.06, 0.12, 8), '#30343b', { na: m, mat: 'metaal' });
      kit.voeg(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8).translate(0, 0.065, 0), '#ff8a3a', { na: m, mat: 'gloei' });
      if (!ctx.geest) {
        const s = new THREE.Sprite(mat);
        const top = p.clone().addScaledVector(U, 0.3);
        s.position.copy(top);
        s.scale.set(0.3, 0.55, 1);
        s.userData.basis = top;
        s.userData.fase = Math.random() * 10;
        s.renderOrder = 5;
        groep.add(s);
        vlammen.push(s);
      }
    }
  }
  if (ctx.geest) return;
  let licht = null;
  if (vuurLichten < 8) {
    vuurLichten++;
    licht = new THREE.PointLight(0xff7a2a, 3, 5.5, 1.8);
    const i = padIndex(pad, 0.5);
    licht.position.copy(v3(pad.P, i)).addScaledVector(v3(pad.U, i), 0.4);
    groep.add(licht);
  }
  anim.push((t) => {
    for (const s of vlammen) {
      const f = s.userData.fase;
      const k = 0.8 + 0.3 * Math.sin(t * 17 + f) + 0.15 * Math.sin(t * 31 + f * 2);
      s.scale.set(0.3 * k, 0.62 * k, 1);
      s.position.copy(s.userData.basis);
      s.position.y += 0.1 * (k - 0.8);
    }
    if (licht) licht.intensity = 2.4 + Math.sin(t * 23) * 0.6 + Math.sin(t * 7) * 0.4;
  });
}

// ------------------------------------------------------------------ starttoren

export function magazijnPositie(start) {
  const st = startStuk(start);
  const pad = stukPad(st, 6);
  const P = v3(pad.P, 1);
  return { x: P.x, y: P.y, z: P.z };
}

function bouwStart(groep, st, ctx, anim) {
  const lg = lokaleGroep(st);
  const kit = new Kit();
  const kleur = st.c;
  const steun = st.sc;
  const h = st.l * NIVEAU; // hoogte van de achterkant van de goot (oorsprong van de groep)
  const top = -0.78;        // bovenkant van het platform, lokaal
  // vier poten van een vakwerktoren in het midden van de tegel (lokaal x = 1)
  for (const [px, pz] of [[0.55, -0.55], [1.45, -0.55], [0.55, 0.55], [1.45, 0.55]]) {
    kit.blok(0.1, Math.max(0.05, top - 0.14 + h), 0.1, steun, { x: px, y: -h, z: pz });
  }
  for (let y = -h + 0.9; y < top - 0.2; y += 0.9) {
    kit.blok(1.0, 0.06, 0.06, steun, { x: 1, y: y, z: -0.55 });
    kit.blok(1.0, 0.06, 0.06, steun, { x: 1, y: y, z: 0.55 });
    kit.blok(0.06, 0.06, 1.0, steun, { x: 0.55, y: y, z: 0 });
    kit.blok(0.06, 0.06, 1.0, steun, { x: 1.45, y: y, z: 0 });
  }
  kit.blok(1.4, 0.06, 1.4, kleurMix(steun, '#000000', 0.4), { x: 1, y: -h, z: 0 });
  kit.blok(1.7, 0.14, 1.5, kleurMix(kleur, '#1a1f28', 0.55), { x: 1, y: top - 0.14, z: 0 });
  kit.blok(1.76, 0.05, 1.56, kleurMix(kleur, '#ffffff', 0.25), { x: 1, y: top, z: 0 });
  // magazijn: glazen buis achteraan
  const mx = 0.16;
  kit.cil(0.22, 0.22, 2.4, '#ffffff', { x: mx, y: 0.05, z: 0, mat: 'glas', seg: 16, open: true });
  kit.ring(0.22, 0.03, kleur, { x: mx, y: 2.45, z: 0, rx: Math.PI / 2 });
  kit.ring(0.22, 0.03, kleur, { x: mx, y: 0.1, z: 0, rx: Math.PI / 2 });
  kit.kegel(0.3, 0.32, kleur, { x: mx, y: 2.47, z: 0, seg: 14 });
  kit.bol(0.07, '#fff6c8', { x: mx, y: 2.82, z: 0, mat: 'gloei' });
  // portaal met bord
  for (const pz of [-0.55, 0.55]) kit.blok(0.08, 1.35, 0.08, steun, { x: 1.2, y: top, z: pz });
  kit.blok(0.12, 0.38, 1.25, kleurMix(kleur, '#10151d', 0.4), { x: 1.2, y: top + 1.1, z: 0 });
  groep.add(lg);
  lg.add(kit.bouw());
  // bord "START"
  const bordMat = new THREE.MeshBasicMaterial({ map: tekstTex('START', { achter: '#10151d', kleur: '#ffffff' }), toneMapped: false });
  bordMat.userData.eigen = true;
  const bord = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.3), bordMat);
  bord.position.set(1.135, top + 1.29, 0);
  bord.rotation.y = -Math.PI / 2;
  const bord2 = bord.clone();
  bord2.position.x = 1.265;
  bord2.rotation.y = Math.PI / 2;
  lg.add(bord, bord2);
  // lampjes op het bord
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x55ff88, toneMapped: false });
  lampMat.userData.eigen = true;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), lampMat);
  lamp.position.set(1.2, top + 1.56, 0);
  lg.add(lamp);
  if (!ctx.geest) anim.push((t, dt, spel) => {
    const actief = spel && spel.actief;
    lampMat.color.setHex(actief ? (Math.sin(t * 6) > 0 ? 0x55ff88 : 0x1f6a3a) : 0xff5a4a);
  });
}

// ------------------------------------------------------------------ finish

function bouwFinish(groep, st, pad, ctx, anim) {
  const lg = lokaleGroep(st);
  const zijde = st.lr === 'L' ? -1 : 1;
  const kit = new Kit();
  const kleur = st.c;
  const h = st.l * NIVEAU;
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const r = 0.13 + (1.0 - 0.13) * (i / 14);
    pts.push([r, finishOppervlak(Math.min(r, FINISH.r0)) - (r > FINISH.r0 ? (r - FINISH.r0) * -0.25 : 0) - KNIKKER_R - 0.01]);
  }
  const centrum = { x: FINISH.cx, z: 0 };
  kit.draai(pts, kleur, { x: centrum.x, y: 0, z: centrum.z, seg: 28, mat: 'dubbel' });
  kit.ring(1.0, 0.04, kleurMix(kleur, '#ffffff', 0.4), { x: centrum.x, y: pts[pts.length - 1][1], z: 0, rx: Math.PI / 2, seg: 28 });
  // spiraalstreep op de trechter
  const bodemY = pts[0][1];
  kit.cil(0.2, 0.2, Math.max(0.1, h + bodemY - 0.02), kleurMix(st.sc, '#000000', 0.1), { x: centrum.x, y: -h, z: 0, seg: 12 });
  kit.cil(0.4, 0.46, 0.1, kleurMix(st.sc, '#000000', 0.35), { x: centrum.x, y: -h, z: 0, seg: 14 });
  kit.cil(0.16, 0.13, 0.18, '#20242b', { x: centrum.x, y: bodemY - 0.18, z: 0 });
  // vlaggenmast
  kit.cil(0.025, 0.025, 1.4, '#d9dde3', { x: centrum.x + 0.95, y: pts[pts.length - 1][1], z: 0.65 * zijde, mat: 'metaal' });
  lg.add(kit.bouw());
  const vlagMat = new THREE.MeshStandardMaterial({ map: geblokteVlagTex(), side: THREE.DoubleSide, roughness: 0.8 });
  vlagMat.userData.eigen = true;
  const vlag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38, 6, 1), vlagMat);
  vlag.position.set(centrum.x + 0.95 + 0.3, pts[pts.length - 1][1] + 1.18, 0.65 * zijde);
  vlag.castShadow = true;
  lg.add(vlag);
  groep.add(lg);
  if (!ctx.geest) {
    const p = vlag.geometry.attributes.position;
    const basis = Float32Array.from(p.array);
    anim.push((t) => {
      for (let i = 0; i < p.count; i++) {
        const x = basis[i * 3];
        p.array[i * 3 + 2] = Math.sin(t * 5 + x * 7) * 0.05 * (x + 0.3);
      }
      p.needsUpdate = true;
    });
  }
}

// ------------------------------------------------------------------ aquarium

const VIS_KLEUREN = [['#ff8a2a', '#ffffff'], ['#ffd23a', '#2b6cff'], ['#3ad1ff', '#ffe96a'], ['#ff4f7a', '#ffd1dc'], ['#8a6cff', '#ffd23a'], ['#2ee6a8', '#106a50']];

function maakVis(kleuren, schaal) {
  const g = new THREE.Group();
  const k = new Kit();
  k.bol(0.12, kleuren[0], { sx: 1.5, sy: 0.85, sz: 0.55, seg: 10 });
  k.blok(0.05, 0.16, 0.12, kleuren[1], { x: 0.02, y: -0.08, z: 0, sz: 0.62, midden: false });
  k.bol(0.022, '#111111', { x: 0.12, y: 0.03, z: 0.05, seg: 6 });
  k.bol(0.022, '#111111', { x: 0.12, y: 0.03, z: -0.05, seg: 6 });
  k.kegel(0.06, 0.09, kleuren[1], { x: 0, y: 0.06, z: 0, rz: -0.6, sz: 0.25 });
  g.add(k.bouw({ schaduw: false }));
  const staart = new THREE.Group();
  const ks = new Kit();
  ks.kegel(0.1, 0.16, kleuren[0], { x: -0.08, y: 0, z: 0, rz: Math.PI / 2, sz: 0.2, midden: true });
  staart.add(ks.bouw({ schaduw: false }));
  staart.position.x = -0.16;
  g.add(staart);
  g.scale.setScalar(schaal);
  g.userData.staart = staart;
  return g;
}

function bouwAquarium(groep, st, anim) {
  const lg = lokaleGroep(st);
  const h = st.l * NIVEAU;
  const zijde = st.lr === 'L' ? -1 : 1;
  const bocht = st.t === 'aquaB';
  const x0 = 0.06, x1 = bocht ? 3.94 : 3.94;
  const z0 = bocht ? (zijde > 0 ? -0.94 : -2.94) : -0.94;
  const z1 = bocht ? (zijde > 0 ? 2.94 : 0.94) : 0.94;
  const yb = Math.max(0.06 - h, -1.15), yt = 0.95;
  const W = x1 - x0, D = z1 - z0, H = yt - yb;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const kit = new Kit();
  // water en glas
  kit.blok(W - 0.04, H - 0.12, D - 0.04, '#ffffff', { x: cx, y: yb + 0.08, z: cz, mat: 'water' });
  kit.blok(W, H, D, '#ffffff', { x: cx, y: yb, z: cz, mat: 'glas' });
  // frame
  const fr = '#2a3240';
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) kit.blok(0.07, H + 0.04, 0.07, fr, { x, y: yb - 0.02, z, mat: 'metaal' });
  for (const y of [yb - 0.02, yt]) {
    kit.blok(W, 0.07, 0.07, fr, { x: cx, y, z: z0, mat: 'metaal' });
    kit.blok(W, 0.07, 0.07, fr, { x: cx, y, z: z1, mat: 'metaal' });
    kit.blok(0.07, 0.07, D, fr, { x: x0, y, z: cz, mat: 'metaal' });
    kit.blok(0.07, 0.07, D, fr, { x: x1, y, z: cz, mat: 'metaal' });
  }
  // zand, stenen, koraal
  kit.blok(W - 0.06, 0.1, D - 0.06, '#e3cf98', { x: cx, y: yb + 0.02, z: cz });
  const rnd = mulberry(st.x * 31 + st.z * 17 + st.l);
  for (let i = 0; i < (bocht ? 9 : 5); i++) {
    const x = x0 + 0.3 + rnd() * (W - 0.6), z = z0 + 0.25 + rnd() * (D - 0.5);
    if (Math.abs(z) < 0.45 && !bocht) continue;
    kit.voeg(new THREE.DodecahedronGeometry(0.12 + rnd() * 0.12, 0), rnd() > 0.5 ? '#8f8a80' : '#6f6a63', { x, y: yb + 0.12, z, sy: 0.7 });
  }
  for (let i = 0; i < (bocht ? 5 : 3); i++) {
    const x = x0 + 0.3 + rnd() * (W - 0.6), z = (rnd() > 0.5 ? z1 - 0.3 : z0 + 0.3);
    const c = ['#ff6f91', '#ff9f43', '#c56cf0'][i % 3];
    kit.cil(0.03, 0.05, 0.35, c, { x, y: yb + 0.1, z });
    kit.bol(0.08, c, { x, y: yb + 0.45, z });
    kit.cil(0.025, 0.03, 0.22, c, { x: x + 0.08, y: yb + 0.12, z, rz: -0.5 });
  }
  // onderstel
  if (yb > -h + 0.05) {
    const pootH = h + yb;
    for (const [x, z] of [[x0 + 0.1, z0 + 0.1], [x1 - 0.1, z0 + 0.1], [x0 + 0.1, z1 - 0.1], [x1 - 0.1, z1 - 0.1]]) {
      kit.blok(0.12, pootH, 0.12, st.sc, { x, y: -h, z });
    }
    kit.blok(W + 0.1, 0.12, D + 0.1, kleurMix(st.c, '#1a1f28', 0.5), { x: cx, y: yb - 0.14, z: cz });
  } else {
    kit.blok(W + 0.12, 0.08, D + 0.12, kleurMix(st.c, '#1a1f28', 0.5), { x: cx, y: yb - 0.08, z: cz });
  }
  lg.add(kit.bouw());

  // zeewier
  const wier = [];
  for (let i = 0; i < (bocht ? 8 : 5); i++) {
    const w = new THREE.Group();
    const k = new Kit();
    const hoog = 0.4 + rnd() * 0.6;
    for (let j = 0; j < 4; j++) k.blok(0.05, hoog / 4, 0.03, j % 2 ? '#3fb36b' : '#2e9a59', { x: 0, y: (j * hoog) / 4, z: 0, rz: (j - 1.5) * 0.08 });
    w.add(k.bouw({ schaduw: false }));
    let x = x0 + 0.25 + rnd() * (W - 0.5), z = z0 + 0.2 + rnd() * (D - 0.4);
    if (!bocht && Math.abs(z) < 0.4) z = z < 0 ? -0.6 : 0.6;
    w.position.set(x, yb + 0.1, z);
    w.userData.f = rnd() * 6;
    lg.add(w);
    wier.push(w);
  }
  // vissen
  const vissen = [];
  const aantal = bocht ? 8 : 6;
  for (let i = 0; i < aantal; i++) {
    const v = maakVis(VIS_KLEUREN[i % VIS_KLEUREN.length], 0.8 + rnd() * 0.6);
    v.userData.pad = { rx: W * (0.25 + rnd() * 0.18), rz: D * (0.2 + rnd() * 0.2), y: yb + 0.35 + rnd() * (H - 0.6), snel: (0.25 + rnd() * 0.35) * (rnd() > 0.5 ? 1 : -1), f: rnd() * 6.28 };
    lg.add(v);
    vissen.push(v);
  }
  // bellen
  const belMat = new THREE.SpriteMaterial({ map: belTex(), transparent: true, depthWrite: false });
  belMat.userData.eigen = true;
  const bellen = [];
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Sprite(belMat);
    b.scale.setScalar(0.05 + rnd() * 0.05);
    b.userData = { x: x0 + 0.3 + rnd() * (W - 0.6), z: z0 + 0.3 + rnd() * (D - 0.6), t: rnd() * H, v: 0.3 + rnd() * 0.3 };
    b.renderOrder = 4;
    lg.add(b);
    bellen.push(b);
  }
  groep.add(lg);
  anim.push((t, dt) => {
    for (const w of wier) w.rotation.z = Math.sin(t * 1.3 + w.userData.f) * 0.18;
    for (const v of vissen) {
      const p = v.userData.pad;
      const a = t * p.snel + p.f;
      const x = cx + Math.cos(a) * p.rx, z = cz + Math.sin(a) * p.rz;
      const y = p.y + Math.sin(t * 0.9 + p.f) * 0.08;
      v.position.set(x, y, z);
      const vx = -Math.sin(a) * p.rx * p.snel, vz = Math.cos(a) * p.rz * p.snel;
      v.rotation.y = -Math.atan2(vz, vx);
      v.userData.staart.rotation.y = Math.sin(t * 9 + p.f) * 0.5;
    }
    for (const b of bellen) {
      const u = b.userData;
      u.t += u.v * dt;
      if (u.t > H - 0.2) u.t = 0;
      b.position.set(u.x + Math.sin(u.t * 6) * 0.03, yb + 0.15 + u.t, u.z);
    }
  });
}

// ------------------------------------------------------------------ launchtunnel

function bouwLaunch(groep, st, anim, ctx) {
  const lg = lokaleGroep(st);
  const h = st.l * NIVEAU;
  const kit = new Kit();
  const donker = '#2d3440';
  kit.blok(5.8, 0.14, 1.2, kleurMix(st.c, '#1a1f28', 0.55), { x: 3, y: -0.5, z: 0 });
  for (const x of [0.8, 3, 5.2]) {
    if (h - 0.5 > 0.1) kit.blok(0.14, h - 0.5, 0.14, st.sc, { x, y: -h, z: 0 });
    kit.cil(0.2, 0.24, 0.07, kleurMix(st.sc, '#000000', 0.35), { x, y: -h, z: 0 });
  }
  for (let x = 0.25; x <= 5.8; x += 0.5) {
    kit.ring(0.58, 0.045, donker, { x, y: -0.44, z: 0, ry: Math.PI / 2, sy: 1.35, boog: Math.PI, seg: 10, mat: 'metaal' });
    kit.blok(0.07, 0.1, 0.07, donker, { x, y: -0.46, z: -0.58 });
    kit.blok(0.07, 0.1, 0.07, donker, { x, y: -0.46, z: 0.58 });
  }
  kit.blok(5.7, 0.05, 0.12, donker, { x: 3, y: 0.33, z: 0, mat: 'metaal' });
  lg.add(kit.bouw());
  // ledstrips
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x2a6cff, toneMapped: false });
  ledMat.userData.eigen = true;
  for (const z of [-0.33, 0.33]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.03, 0.03), ledMat);
    l.position.set(3, -0.02, z);
    lg.add(l);
  }
  // startlichten
  const lichten = [0xff3b30, 0xffb000, 0x30ff6a].map((c, i) => {
    const m = new THREE.MeshBasicMaterial({ color: 0x222222, toneMapped: false });
    m.userData.eigen = true;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), m);
    b.position.set(0.1, 0.52 + i * 0.16, 0.64);
    b.userData.kleur = c;
    lg.add(b);
    return m;
  });
  const pk = new Kit();
  pk.blok(0.08, 0.95, 0.08, '#20252d', { x: 0.1, y: -0.5, z: 0.72 });
  pk.blok(0.16, 0.56, 0.12, '#111418', { x: 0.1, y: 0.42, z: 0.72 });
  lg.add(pk.bouw());
  groep.add(lg);
  if (ctx.geest) return;
  const kleuren = [0xff3b30, 0xffb000, 0x30ff6a];
  anim.push((t, dt, spel) => {
    const s = spel && spel.launchStatus ? spel.launchStatus(st.id) : null;
    if (!s) {
      lichten.forEach((m, i) => m.color.setHex(i === 0 ? 0x661510 : 0x222222));
      ledMat.color.setHex(0x1c3c88);
      return;
    }
    if (s.fase === 'wacht') {
      const n = Math.min(3, Math.floor(s.f * 3) + 1);
      lichten.forEach((m, i) => m.color.setHex(i < n ? kleuren[Math.min(i, 1)] : 0x222222));
      ledMat.color.setHex(0x3355ff);
    } else {
      lichten.forEach((m, i) => m.color.setHex(i === 2 ? kleuren[2] : 0x222222));
      const k = Math.sin(t * 40) > 0 ? 0xbfe6ff : 0x5fa8ff;
      ledMat.color.setHex(k);
    }
  });
}

// ------------------------------------------------------------------ hulp

function mulberry(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ de hele baan

const markeerMat = new Map();
function markeerMateriaal(mat, soort) {
  const sleutel = mat.uuid + soort;
  if (markeerMat.has(sleutel)) return markeerMat.get(sleutel);
  const m = mat.clone();
  const kleur = soort === 'sloop' ? 0x7a1010 : soort === 'selectie' ? 0x1d4f8a : 0x23405f;
  if (m.emissive) m.emissive.setHex(kleur);
  else if (m.color) m.color.lerp(new THREE.Color(kleur), 0.3);
  markeerMat.set(sleutel, m);
  return m;
}

export class BaanWeergave {
  constructor(scene) {
    this.groep = new THREE.Group();
    scene.add(this.groep);
    this.meshes = new Map();   // id -> { sleutel, groep }
    this.anim = [];
    this.gemarkeerd = new Map();
    this.extra = new THREE.Group();
    scene.add(this.extra);
    this.maakMarkers();
  }

  maakMarkers() {
    const pijlGeo = new THREE.ConeGeometry(0.18, 0.42, 14);
    pijlGeo.rotateZ(-Math.PI / 2);
    this.openMat = new THREE.MeshBasicMaterial({ color: 0x7ed957, transparent: true, opacity: 0.85, toneMapped: false, depthTest: false });
    this.openPijlen = new THREE.InstancedMesh(pijlGeo, this.openMat, 64);
    this.openPijlen.count = 0;
    this.openPijlen.renderOrder = 20;
    this.extra.add(this.openPijlen);
    this.cursorMat = new THREE.MeshBasicMaterial({ color: 0x5fd0ff, toneMapped: false, depthTest: false, transparent: true });
    this.cursor = new THREE.Group();
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.6, 16).rotateZ(-Math.PI / 2), this.cursorMat);
    c1.position.x = 0.55;
    const ringGeo = new THREE.TorusGeometry(0.42, 0.035, 8, 32);
    const ring = new THREE.Mesh(ringGeo, this.cursorMat);
    ring.rotation.y = Math.PI / 2;
    this.cursor.add(c1, ring);
    this.cursor.renderOrder = 21;
    c1.renderOrder = 21; ring.renderOrder = 21;
    this.cursor.visible = false;
    this.extra.add(this.cursor);
    // tegels die een stuk inneemt (zoals in RCT)
    this.tegelMat = new THREE.MeshBasicMaterial({ color: 0x7ed957, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false });
    const tg = new THREE.PlaneGeometry(TEGEL * 0.96, TEGEL * 0.96).rotateX(-Math.PI / 2);
    this.tegels = new THREE.InstancedMesh(tg, this.tegelMat, 96);
    this.tegels.count = 0;
    this.tegels.renderOrder = 2;
    this.extra.add(this.tegels);
    this.hoogteLijnMat = new THREE.LineBasicMaterial({ color: 0x7ed957, transparent: true, opacity: 0.5, depthWrite: false });
    this.hoogteLijn = new THREE.LineSegments(new THREE.BufferGeometry(), this.hoogteLijnMat);
    this.extra.add(this.hoogteLijn);
  }

  steunBodemFunctie(info) {
    return (x, z, top, eigen) => {
      const cx = Math.floor(x / TEGEL), cz = Math.floor(z / TEGEL);
      const max = Math.floor((top - 0.3) / NIVEAU);
      for (let l = max; l >= -2; l--) {
        const wie = info.bezet.get(vakSleutel(cx, cz, l));
        if (wie !== undefined && wie !== eigen) return (l + 1) * NIVEAU + 0.05;
      }
      return 0;
    };
  }

  // Bouw alleen opnieuw wat veranderd is.
  update(baan, info) {
    resetVuurLichten();
    const steunBodem = this.steunBodemFunctie(info);
    const nieuw = new Map();
    const lijst = [];
    if (info.st0) lijst.push(info.st0);
    lijst.push(...baan.stukken);
    for (const st of lijst) {
      const sleutel = stukSleutel(st) + '|' + st.c + st.sc + (st.fx || '') + (st.v || '') + '|' + this.steunHandtekening(st, steunBodem) + (st.t === 'start' ? '|' + baan.start.h : '');
      const oud = this.meshes.get(st.id);
      if (oud && oud.sleutel === sleutel) { nieuw.set(st.id, oud); this.meshes.delete(st.id); continue; }
      const groep = bouwStukMesh(st, { steunBodem });
      groep.userData.id = st.id;
      this.groep.add(groep);
      nieuw.set(st.id, { sleutel, groep });
    }
    for (const { groep } of this.meshes.values()) { this.groep.remove(groep); ruimOp(groep); }
    this.meshes = nieuw;
    this.anim = [];
    for (const { groep } of this.meshes.values()) this.anim.push(...(groep.userData.anim || []));
    // markeringen opnieuw toepassen
    const m = [...this.gemarkeerd.entries()];
    this.gemarkeerd.clear();
    for (const [id, soort] of m) this.markeer(id, soort);
  }

  steunHandtekening(st, steunBodem) {
    const pos = steunPosities(st);
    if (!Array.isArray(pos) || !pos.length) {
      if (SOORTEN[st.t].spiraal) {
        const pad = stukPad(st, 6);
        const i = padIndex(pad, 0);
        return Math.round(steunBodem(pad.P[i * 3], pad.P[i * 3 + 2], 60, st.id) * 10);
      }
      return '';
    }
    const pad = stukPad(st, 6);
    return pos.map((u) => {
      const i = padIndex(pad, u);
      return Math.round(steunBodem(pad.P[i * 3], pad.P[i * 3 + 2], pad.P[i * 3 + 1] - 0.27, st.id) * 10);
    }).join(',');
  }

  animeer(t, dt, spel) {
    for (const f of this.anim) f(t, dt, spel);
    if (this.cursor.visible) {
      const s = 1 + Math.sin(t * 5) * 0.12;
      this.cursor.scale.setScalar(s);
      this.cursorMat.opacity = 0.75 + Math.sin(t * 5) * 0.2;
    }
  }

  markeer(id, soort) {
    const item = this.meshes.get(id);
    const vorig = this.gemarkeerd.get(id);
    if (vorig === soort) return;
    if (!item) { this.gemarkeerd.delete(id); return; }
    item.groep.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.origMat === undefined) o.userData.origMat = o.material;
      const orig = o.userData.origMat;
      if (!soort || !orig.isMeshStandardMaterial || orig.transparent) o.material = orig;
      else o.material = markeerMateriaal(orig, soort);
    });
    if (soort) this.gemarkeerd.set(id, soort); else this.gemarkeerd.delete(id);
  }

  wisMarkeringen(soort) {
    for (const [id, s] of [...this.gemarkeerd.entries()]) if (!soort || s === soort) this.markeer(id, null);
  }

  toonOpenEinden(open, cursor, zichtbaar) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    let n = 0;
    if (zichtbaar) {
      for (const o of open) {
        if (cursor && o.x === cursor.x && o.z === cursor.z && o.l === cursor.l && o.d === cursor.d) continue;
        if (n >= 64) break;
        const [hx, hz] = koers(o.d);
        p.set(o.x + hx * 0.3, o.l * NIVEAU + 0.05, o.z + hz * 0.3);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(hz, hx));
        m.compose(p, q, s);
        this.openPijlen.setMatrixAt(n++, m);
      }
    }
    this.openPijlen.count = n;
    this.openPijlen.instanceMatrix.needsUpdate = true;
    if (cursor && zichtbaar) {
      const [hx, hz] = koers(cursor.d);
      this.cursor.position.set(cursor.x, cursor.l * NIVEAU + 0.02, cursor.z);
      this.cursor.rotation.set(0, -Math.atan2(hz, hx), 0);
      this.cursor.visible = true;
    } else this.cursor.visible = false;
  }

  toonTegels(tegels, ok) {
    const m = new THREE.Matrix4();
    let n = 0;
    const lijnen = [];
    for (const [cx, cz, ymin] of tegels || []) {
      if (n >= 96) break;
      m.makeTranslation((cx + 0.5) * TEGEL, 0.03, (cz + 0.5) * TEGEL);
      this.tegels.setMatrixAt(n++, m);
      lijnen.push((cx + 0.5) * TEGEL, 0.03, (cz + 0.5) * TEGEL, (cx + 0.5) * TEGEL, ymin - 0.28, (cz + 0.5) * TEGEL);
    }
    this.tegels.count = n;
    this.tegels.instanceMatrix.needsUpdate = true;
    this.tegelMat.color.setHex(ok ? 0x7ed957 : 0xff5d5d);
    this.hoogteLijnMat.color.setHex(ok ? 0x7ed957 : 0xff5d5d);
    this.hoogteLijn.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(lijnen, 3));
    this.hoogteLijn.geometry = g;
  }

  zichtbaarMarkers(aan) {
    this.extra.visible = aan;
  }
}

// ------------------------------------------------------------------ spook (voorbeeld)

const spookMat = {
  ok: new THREE.MeshBasicMaterial({ color: 0x7ed957, transparent: true, opacity: 0.45, depthWrite: false }),
  nee: new THREE.MeshBasicMaterial({ color: 0xff5d5d, transparent: true, opacity: 0.45, depthWrite: false }),
};

export function bouwSpook(st, ok) {
  const g = bouwStukMesh(st, { geest: true });
  const mat = ok ? spookMat.ok : spookMat.nee;
  const weg = [];
  g.traverse((o) => {
    if (o.isMesh) { o.material = mat; o.castShadow = false; o.receiveShadow = false; o.renderOrder = 6; }
    if (o.isSprite || o.isLight) weg.push(o);
  });
  weg.forEach((o) => o.parent.remove(o));
  g.userData.anim = [];
  return g;
}

export function ruimOp(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.isSprite) o.geometry.dispose();
    const m = o.userData?.origMat || o.material;
    if (m && m.userData?.eigen) {
      if (m.map && m.map.userData?.eigen) m.map.dispose();
      m.dispose();
    }
  });
}
