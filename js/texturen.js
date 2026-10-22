// Kleine getekende texturen (canvas), zodat er geen afbeeldingsbestanden nodig zijn.

import * as THREE from '../lib/three.min.js';

const cache = new Map();

function canvas(w, h, teken) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  teken(c.getContext('2d'), w, h);
  return c;
}

function tex(naam, w, h, teken, opties = {}) {
  if (cache.has(naam)) return cache.get(naam);
  const t = new THREE.CanvasTexture(canvas(w, h, teken));
  t.colorSpace = THREE.SRGBColorSpace;
  if (opties.herhaal) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  cache.set(naam, t);
  return t;
}

export function kettingTex() {
  return tex('ketting', 64, 16, (g, w, h) => {
    g.fillStyle = '#2a2d33'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a9b1bd'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(18, 8, 13, 4.5, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#6e7682';
    g.beginPath(); g.moveTo(34, 8); g.lineTo(62, 8); g.stroke();
    g.fillStyle = '#c9d0da'; g.fillRect(44, 5, 6, 6);
  }, { herhaal: true });
}

export function pijlTex() {
  return tex('pijl', 64, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(120,255,255,0.15)');
    grad.addColorStop(1, 'rgba(160,255,255,1)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(8, 2); g.lineTo(40, 16); g.lineTo(8, 30); g.lineTo(22, 16); g.closePath();
    g.fill();
  }, { herhaal: true });
}

export function vlamTex() {
  return tex('vlam', 64, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.62, h * 0.5);
    grad.addColorStop(0, 'rgba(255,255,220,1)');
    grad.addColorStop(0.2, 'rgba(255,214,90,0.95)');
    grad.addColorStop(0.5, 'rgba(255,110,30,0.65)');
    grad.addColorStop(1, 'rgba(200,30,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(w / 2, 4);
    g.bezierCurveTo(w * 0.95, h * 0.45, w * 0.98, h * 0.82, w / 2, h - 4);
    g.bezierCurveTo(w * 0.02, h * 0.82, w * 0.05, h * 0.45, w / 2, 4);
    g.fill();
  });
}

export function geblokteVlagTex() {
  return tex('finishvlag', 64, 40, (g, w, h) => {
    const n = 8, m = 5;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      g.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4';
      g.fillRect((i * w) / n, (j * h) / m, w / n + 1, h / m + 1);
    }
  });
}

export function tekstTex(tekst, opties = {}) {
  const sleutel = 'tekst:' + tekst + JSON.stringify(opties);
  return tex(sleutel, opties.w || 256, opties.h || 64, (g, w, h) => {
    g.fillStyle = opties.achter || '#1d2735';
    g.fillRect(0, 0, w, h);
    g.fillStyle = opties.kleur || '#ffffff';
    g.font = `800 ${Math.round(h * 0.62)}px system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(tekst, w / 2, h / 2 + 2);
  });
}

export function belTex() {
  return tex('bel', 32, 32, (g, w, h) => {
    const grad = g.createRadialGradient(12, 11, 1, 16, 16, 15);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.5, 'rgba(200,240,255,0.35)');
    grad.addColorStop(0.9, 'rgba(220,250,255,0.6)');
    grad.addColorStop(1, 'rgba(220,250,255,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(16, 16, 15, 0, Math.PI * 2); g.fill();
  });
}

export function gloedTex() {
  return tex('gloed', 64, 64, (g, w, h) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
}
