// Camera zoals in Cities: Skylines: rechts slepen = draaien en kantelen, links slepen = schuiven,
// scrollen = zoomen naar de muis, WASD/pijltjes = schuiven, Q/E = draaien.
// Op een touchscreen: één vinger = draaien, twee vingers = schuiven, knijpen en draaien.

import * as THREE from '../lib/three.min.js';
import { TEGEL, RASTER } from './config.js';

const GRENS = RASTER * TEGEL + 10;

export class CameraBesturing {
  constructor(camera, element) {
    this.camera = camera;
    this.el = element;
    this.doel = new THREE.Vector3(0, 0, 0);
    this.yaw = -0.75;
    this.pitch = 0.72;
    this.afstand = 46;
    this.nu = { doel: this.doel.clone(), yaw: this.yaw, pitch: this.pitch, afstand: this.afstand };
    this.snelheid = 1;
    this.omgekeerd = false;
    this.toetsen = new Set();
    this.volg = null;          // functie die een Vector3 teruggeeft
    this.aanwijzers = new Map();
    this.klikDrempel = 6;
    this.onKlik = null;        // (event) => void
    this.onSleepStart = null;
    this.grondVlak = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.ray = new THREE.Raycaster();
    this.bindEvents();
  }

  bindEvents() {
    const el = this.el;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => this.neer(e));
    window.addEventListener('pointermove', (e) => this.beweeg(e));
    window.addEventListener('pointerup', (e) => this.op(e));
    window.addEventListener('pointercancel', (e) => this.op(e, true));
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY, e.clientX, e.clientY); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      this.toetsen.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.toetsen.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.toetsen.clear());
  }

  neer(e) {
    this.el.setPointerCapture?.(e.pointerId);
    this.aanwijzers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, knop: e.button, tijd: performance.now(), type: e.pointerType, gesleept: false });
    if (this.aanwijzers.size === 2) {
      for (const a of this.aanwijzers.values()) a.gesleept = true;
      this.knijp = this.knijpInfo();
    }
  }

  knijpInfo() {
    const [a, b] = [...this.aanwijzers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), hoek: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  beweeg(e) {
    const a = this.aanwijzers.get(e.pointerId);
    if (!a) return;
    const dx = e.clientX - a.x, dy = e.clientY - a.y;
    a.x = e.clientX; a.y = e.clientY;
    if (!a.gesleept && Math.hypot(a.x - a.sx, a.y - a.sy) > this.klikDrempel) {
      a.gesleept = true;
      this.onSleepStart?.();
    }
    if (!a.gesleept) return;
    if (this.aanwijzers.size >= 2) {
      const k = this.knijpInfo();
      if (this.knijp) {
        if (k.d > 10 && this.knijp.d > 10) this.afstand = this.klem(this.afstand * (this.knijp.d / k.d));
        let dh = k.hoek - this.knijp.hoek;
        if (dh > Math.PI) dh -= Math.PI * 2;
        if (dh < -Math.PI) dh += Math.PI * 2;
        this.yaw -= dh;
        this.schuif(k.mx - this.knijp.mx, k.my - this.knijp.my);
      }
      this.knijp = k;
      return;
    }
    const draaien = a.knop === 2 || a.knop === 1 || (a.type === 'touch');
    if (draaien) {
      const r = this.omgekeerd ? -1 : 1;
      this.yaw += dx * 0.006 * r * this.snelheid;
      this.pitch = Math.min(1.5, Math.max(0.08, this.pitch + dy * 0.005 * this.snelheid));
    } else {
      this.schuif(dx, dy);
    }
  }

  op(e, geannuleerd) {
    const a = this.aanwijzers.get(e.pointerId);
    if (!a) return;
    this.aanwijzers.delete(e.pointerId);
    if (this.aanwijzers.size < 2) this.knijp = null;
    if (!geannuleerd && !a.gesleept && performance.now() - a.tijd < 800 && this.onKlik) {
      this.onKlik({ x: e.clientX, y: e.clientY, knop: a.knop, shift: e.shiftKey, alt: e.altKey, type: a.type });
    }
  }

  schuif(dx, dy) {
    const s = this.afstand * 0.0016 * this.snelheid;
    const c = Math.cos(this.yaw), n = Math.sin(this.yaw);
    // vooruit f = (-cos, -sin), rechts = (sin, -cos); sleep de grond mee met de muis
    this.doel.x += (-n * dx - c * dy) * s;
    this.doel.z += (c * dx - n * dy) * s;
    this.begrens();
    this.volg = null;
  }

  klem(a) { return Math.min(170, Math.max(2.5, a)); }

  zoom(delta, mx, my) {
    const oud = this.afstand;
    const factor = Math.pow(1.0012, delta * (this.snelheid || 1));
    const nieuw = this.klem(oud * factor);
    if (mx !== undefined && !this.volg) {
      const p = this.grondPunt(mx, my, this.doel.y);
      if (p) {
        const f = 1 - nieuw / oud;
        this.doel.x += (p.x - this.doel.x) * f;
        this.doel.z += (p.z - this.doel.z) * f;
        this.begrens();
      }
    }
    this.afstand = nieuw;
  }

  begrens() {
    this.doel.x = Math.min(GRENS, Math.max(-GRENS, this.doel.x));
    this.doel.z = Math.min(GRENS, Math.max(-GRENS, this.doel.z));
  }

  straal(mx, my) {
    const r = this.el.getBoundingClientRect();
    const v = new THREE.Vector2(((mx - r.left) / r.width) * 2 - 1, -((my - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    return this.ray;
  }

  grondPunt(mx, my, hoogte = 0) {
    const ray = this.straal(mx, my);
    this.grondVlak.constant = -hoogte;
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(this.grondVlak, p) ? p : null;
  }

  zetDirect() {
    this.nu.doel.copy(this.doel);
    this.nu.yaw = this.yaw; this.nu.pitch = this.pitch; this.nu.afstand = this.afstand;
  }

  kijkNaar(x, y, z, afstand) {
    this.doel.set(x, y, z);
    if (afstand) this.afstand = this.klem(afstand);
  }

  update(dt) {
    const t = this.toetsen;
    const sp = this.afstand * 0.9 * dt * this.snelheid;
    let fx = 0, fz = 0;
    if (t.has('w') || t.has('arrowup')) fz += 1;
    if (t.has('s') || t.has('arrowdown')) fz -= 1;
    if (t.has('a') || t.has('arrowleft')) fx -= 1;
    if (t.has('d') || t.has('arrowright')) fx += 1;
    if (fx || fz) {
      const c = Math.cos(this.yaw), n = Math.sin(this.yaw);
      this.doel.x += (-c * fz + n * fx) * sp;
      this.doel.z += (-n * fz - c * fx) * sp;
      this.begrens();
      this.volg = null;
    }
    if (t.has('q')) this.yaw -= 1.6 * dt;
    if (t.has('e')) this.yaw += 1.6 * dt;
    if (t.has('=') || t.has('+')) this.afstand = this.klem(this.afstand * (1 - dt * 1.5));
    if (t.has('-') || t.has('_')) this.afstand = this.klem(this.afstand * (1 + dt * 1.5));

    if (this.volg) {
      const p = this.volg();
      if (p) this.doel.lerp(p, Math.min(1, dt * 4));
    }

    const k = 1 - Math.exp(-dt * 12);
    this.nu.doel.lerp(this.doel, k);
    this.nu.yaw += (this.yaw - this.nu.yaw) * k;
    this.nu.pitch += (this.pitch - this.nu.pitch) * k;
    this.nu.afstand += (this.afstand - this.nu.afstand) * k;

    const { doel, yaw, pitch, afstand } = this.nu;
    const cp = Math.cos(pitch);
    this.camera.position.set(
      doel.x + Math.cos(yaw) * cp * afstand,
      doel.y + Math.sin(pitch) * afstand,
      doel.z + Math.sin(yaw) * cp * afstand,
    );
    if (this.camera.position.y < 0.6) this.camera.position.y = 0.6;
    this.camera.lookAt(doel);
  }
}
