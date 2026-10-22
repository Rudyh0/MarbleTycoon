// De 3D-wereld: renderer, licht, het bouwterrein (een donkere plaat in de ruimte) en het raster.

import * as THREE from '../lib/three.min.js';
import { TEGEL, RASTER } from './config.js';

export const SFEREN = {
  nacht:   { naam: 'Nacht',        lucht: 0x0d1219, horizon: 0x18212e, grond: 0x2e3d36, rand: 0x1d1712 },
  diepzee: { naam: 'Diepzee',      lucht: 0x07131c, horizon: 0x0f2733, grond: 0x2b3c3f, rand: 0x14191c },
  paars:   { naam: 'Schemer',      lucht: 0x120d1c, horizon: 0x241a33, grond: 0x34343d, rand: 0x1b1520 },
  grafiet: { naam: 'Grafiet',      lucht: 0x111214, horizon: 0x1d1f23, grond: 0x34383a, rand: 0x1a1a1a },
};

export class Wereld {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 900);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    this.hemi = new THREE.HemisphereLight(0xcad8ff, 0x2b2a24, 0.95);
    this.scene.add(this.hemi);
    this.zon = new THREE.DirectionalLight(0xfff2de, 2.3);
    this.zon.castShadow = true;
    this.zon.shadow.mapSize.set(2048, 2048);
    this.zon.shadow.bias = -0.0004;
    this.zon.shadow.normalBias = 0.035;
    const sc = this.zon.shadow.camera;
    sc.left = -36; sc.right = 36; sc.top = 36; sc.bottom = -36; sc.near = 1; sc.far = 220;
    this.scene.add(this.zon, this.zon.target);
    this.tegenlicht = new THREE.DirectionalLight(0x8fb4ff, 0.45);
    this.tegenlicht.position.set(-40, 30, -50);
    this.scene.add(this.tegenlicht);

    this.maakLucht();
    this.maakPlaat();
    this.maakRaster();
    this.zetSfeer('nacht');
    this.schaduwBereik = 36;
  }

  maakLucht() {
    const geo = new THREE.SphereGeometry(600, 32, 16);
    const kleuren = [];
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) kleuren.push(0, 0, 0);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(kleuren, 3));
    this.luchtGeo = geo;
    this.lucht = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.lucht.renderOrder = -10;
    this.scene.add(this.lucht);
    // een paar zwakke sterren, ver weg
    const n = 700, sp = [];
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, f = Math.random() * Math.PI * 2;
      const y = Math.abs(u) * 0.9 + 0.08;
      const r = Math.sqrt(1 - y * y);
      sp.push(Math.cos(f) * r * 560, y * 560, Math.sin(f) * r * 560);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.sterren = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9fb3d9, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
    this.scene.add(this.sterren);
  }

  maakPlaat() {
    const maat = RASTER * 2 * TEGEL;
    // grondtextuur met een beetje vlekken, zoals gras van dichtbij
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#808080';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const v = 110 + Math.random() * 40;
      g.fillStyle = `rgba(${v},${v},${v},${0.05 + Math.random() * 0.12})`;
      const r = 1 + Math.random() * 3.5;
      g.fillRect(Math.random() * 512, Math.random() * 512, r, r);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(RASTER / 2, RASTER / 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.grondMat = new THREE.MeshStandardMaterial({ color: 0x2e3d36, map: tex, roughness: 0.95, metalness: 0 });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(maat, maat), this.grondMat);
    top.rotation.x = -Math.PI / 2;
    top.receiveShadow = true;
    top.userData.grond = true;
    this.grond = top;
    this.scene.add(top);
    this.randMat = new THREE.MeshStandardMaterial({ color: 0x1d1712, roughness: 1 });
    const rand = new THREE.Mesh(new THREE.BoxGeometry(maat + 0.6, 2.4, maat + 0.6), this.randMat);
    rand.position.y = -1.22;
    rand.receiveShadow = true;
    this.scene.add(rand);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(maat + 0.9, 0.16, maat + 0.9), new THREE.MeshStandardMaterial({ color: 0x3a4550, roughness: 0.6, metalness: 0.3 }));
    lip.position.y = -0.1;
    this.scene.add(lip);
  }

  maakRaster() {
    const maat = RASTER * TEGEL;
    const fijn = [], grof = [];
    for (let i = -RASTER; i <= RASTER; i++) {
      const v = i * TEGEL;
      const doel = i % 4 === 0 ? grof : fijn;
      doel.push(v, 0, -maat, v, 0, maat, -maat, 0, v, maat, 0, v);
    }
    const maak = (pts, opacity) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xa9d2ff, transparent: true, opacity, depthWrite: false }));
      l.position.y = 0.015;
      l.renderOrder = 1;
      return l;
    };
    this.raster = new THREE.Group();
    this.raster.add(maak(fijn, 0.09), maak(grof, 0.2));
    this.scene.add(this.raster);
  }

  zetSfeer(naam) {
    const s = SFEREN[naam] || SFEREN.nacht;
    this.sfeer = naam;
    const lucht = new THREE.Color(s.lucht), horizon = new THREE.Color(s.horizon);
    this.scene.background = lucht.clone();
    this.scene.fog = new THREE.Fog(horizon.getHex(), 140, 420);
    const pos = this.luchtGeo.attributes.position, col = this.luchtGeo.attributes.color;
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 600;
      tmp.copy(horizon).lerp(lucht, Math.min(1, Math.max(0, y * 2.2)));
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    col.needsUpdate = true;
    this.grondMat.color.set(s.grond);
    this.randMat.color.set(s.rand);
  }

  zetSchaduw(aan) {
    this.renderer.shadowMap.enabled = aan;
    this.zon.castShadow = aan;
    this.scene.traverse((o) => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((x) => (x.needsUpdate = true)); } });
  }

  zetKwaliteit(k) {
    const dpr = window.devicePixelRatio || 1;
    const pr = k === 'laag' ? Math.min(dpr, 1) * 0.7 : k === 'hoog' ? Math.min(dpr, 2) : Math.min(dpr, 1.5);
    this.renderer.setPixelRatio(pr);
    this.zon.shadow.mapSize.set(k === 'laag' ? 1024 : k === 'hoog' ? 4096 : 2048, k === 'laag' ? 1024 : k === 'hoog' ? 4096 : 2048);
    if (this.zon.shadow.map) { this.zon.shadow.map.dispose(); this.zon.shadow.map = null; }
    this.formaat();
  }

  formaat() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // De zon schuift mee met waar de camera naar kijkt, zodat schaduwen scherp blijven.
  volgZon(doel, afstand) {
    const bereik = Math.min(90, Math.max(24, afstand * 0.9));
    if (Math.abs(bereik - this.schaduwBereik) > 2) {
      this.schaduwBereik = bereik;
      const sc = this.zon.shadow.camera;
      sc.left = -bereik; sc.right = bereik; sc.top = bereik; sc.bottom = -bereik;
      sc.updateProjectionMatrix();
    }
    const stap = (bereik * 2) / this.zon.shadow.mapSize.x;
    const tx = Math.round(doel.x / stap) * stap, tz = Math.round(doel.z / stap) * stap;
    this.zon.target.position.set(tx, 0, tz);
    this.zon.position.set(tx + 34, 62, tz + 22);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
