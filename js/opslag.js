// Opslaan in de browser, deelcodes en de community-server.

const PREFIX = 'marbletycoon.';

function lees(sleutel, std) {
  try {
    const v = localStorage.getItem(PREFIX + sleutel);
    return v === null ? std : JSON.parse(v);
  } catch { return std; }
}
function schrijf(sleutel, waarde) {
  try { localStorage.setItem(PREFIX + sleutel, JSON.stringify(waarde)); return true; } catch { return false; }
}
function wis(sleutel) { try { localStorage.removeItem(PREFIX + sleutel); } catch { /* niets */ } }

export const opslag = { lees, schrijf, wis };

export function klantId() {
  let id = lees('klant', null);
  if (!id) {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    id = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    schrijf('klant', id);
  }
  return id;
}

// ------------------------------------------------------------------ eigen banen

export function mijnBanen() {
  return lees('index', []).sort((a, b) => (b.bijgewerkt || 0) - (a.bijgewerkt || 0));
}

export function bewaarBaan(id, data, thumb) {
  const index = lees('index', []).filter((x) => x.id !== id);
  const item = { id, naam: data.naam, bijgewerkt: Date.now(), stukken: data.stukken.length, thumb };
  if (!schrijf('baan.' + id, data)) return false;
  index.push(item);
  if (!schrijf('index', index)) {
    // te vol: thumbnails van oude banen weggooien
    for (const x of index) if (x.id !== id) x.thumb = '';
    return schrijf('index', index);
  }
  return true;
}

export function laadBaan(id) { return lees('baan.' + id, null); }

export function verwijderBaan(id) {
  wis('baan.' + id);
  schrijf('index', lees('index', []).filter((x) => x.id !== id));
}

export function nieuwBaanId() {
  return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ------------------------------------------------------------------ deelcode

function naarBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function vanBase64(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

async function pers(bytes, soort) {
  const stroom = new Blob([bytes]).stream().pipeThrough(soort === 'in' ? new CompressionStream('deflate-raw') : new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stroom).arrayBuffer());
}

export async function maakDeelcode(data) {
  const json = new TextEncoder().encode(JSON.stringify(data));
  if (typeof CompressionStream !== 'undefined') return 'MT1.' + naarBase64(await pers(json, 'in'));
  return 'MT0.' + naarBase64(json);
}

export async function leesDeelcode(code) {
  code = String(code || '').trim();
  const m = code.match(/MT([01])\.([A-Za-z0-9_-]+)/);
  if (!m) throw new Error('Dit is geen geldige deelcode.');
  let bytes = vanBase64(m[2]);
  if (m[1] === '1') bytes = await pers(bytes, 'uit');
  return JSON.parse(new TextDecoder().decode(bytes));
}

// ------------------------------------------------------------------ community-server

async function api(pad, opties = {}) {
  let r;
  try {
    r = await fetch('/api' + pad, {
      method: opties.methode || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opties.headers || {}) },
      body: opties.body ? JSON.stringify(opties.body) : undefined,
    });
  } catch {
    throw new Error('De community is nu niet bereikbaar.');
  }
  let data = {};
  try { data = await r.json(); } catch { /* geen json */ }
  if (!r.ok) throw new Error(data.fout || 'Er ging iets mis (' + r.status + ').');
  return data;
}

export const community = {
  status: () => api('/status'),
  lijst: ({ sort = 'nieuw', q = '', offset = 0, limiet = 24, ids = '' } = {}) =>
    api(`/banen?sort=${encodeURIComponent(sort)}&q=${encodeURIComponent(q)}&offset=${offset}&limiet=${limiet}${ids ? '&ids=' + encodeURIComponent(ids) : ''}&klant=${klantId()}`),
  haal: (id) => api('/banen/' + encodeURIComponent(id) + '?klant=' + klantId()),
  publiceer: (body) => api('/banen', { methode: 'POST', body: { ...body, klant: klantId() } }),
  werkBij: (id, sleutel, body) => api('/banen/' + encodeURIComponent(id), { methode: 'PUT', body, headers: { 'X-Baan-Sleutel': sleutel } }),
  verwijder: (id, sleutel) => api('/banen/' + encodeURIComponent(id), { methode: 'DELETE', headers: { 'X-Baan-Sleutel': sleutel } }),
  like: (id) => api('/banen/' + encodeURIComponent(id) + '/like', { methode: 'POST', body: { klant: klantId() } }),
  gebruikt: (id) => api('/banen/' + encodeURIComponent(id) + '/gebruikt', { methode: 'POST', body: { klant: klantId() } }),
  thumbUrl: (id, versie) => '/api/banen/' + encodeURIComponent(id) + '/thumb.jpg' + (versie ? '?v=' + encodeURIComponent(versie) : ''),
};

export function mijnGedeeld() { return lees('gedeeld', {}); }
export function bewaarGedeeld(id, sleutel, naam) {
  const g = mijnGedeeld();
  g[id] = { sleutel, naam, t: Date.now() };
  schrijf('gedeeld', g);
}
export function vergeetGedeeld(id) {
  const g = mijnGedeeld();
  delete g[id];
  schrijf('gedeeld', g);
}
