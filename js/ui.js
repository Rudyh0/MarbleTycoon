// De interface: bovenbalk, gereedschapsbalk onderin (zoals Cities: Skylines), bouwvenster (zoals RCT),
// infopaneel, meldingen en vensters.

import { SOORTEN, EFFECTEN, stukPad, uitgang } from './stukken.js';
import { KLEUREN, HELLING_NAAM, EFFECT_BEREIK, EFFECT_STANDAARD, KMU, NIVEAU, MAX_KNIKKERS } from './config.js';
import { THEMAS, ITEMS } from './decor.js';
import { SKINS } from './knikkers.js';
import { stukIkoon, decorIkoon, skinIkoon } from './ikonen.js';
import { geluid, initGeluid } from './geluid.js';
import { naarJSON, vanJSON } from './baan.js';
import { mijnBanen, verwijderBaan, maakDeelcode, leesDeelcode, community, mijnGedeeld, bewaarGedeeld, vergeetGedeeld, opslag } from './opslag.js';

// ------------------------------------------------------------------ hulp

export function el(tag, attrs = {}, ...kinderen) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'klasse') e.className = v;
    else if (k === 'tekst') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'stijl') e.style.cssText = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kinderen.flat()) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}

const P = {
  baan: '<path d="M3 18c4 0 4-12 9-12s5 12 9 12"/><circle cx="12" cy="6" r="1.6" fill="currentColor"/>',
  thema: '<path d="M7 20v-5M17 20v-4"/><path d="M7 15l-4 0 4-8 4 8z"/><path d="M12 20V9l5-4 5 4v11"/><path d="M15 20v-4h4v4"/>',
  knikker: '<circle cx="12" cy="12" r="8"/><path d="M7.5 9.5c2.5-3 6.5-3 9 0M8 15c2 1.6 6 1.6 8 0"/>',
  verf: '<path d="M14 4l6 6-8 8-6-6z"/><path d="M6 12l-3 3c-1 1 0 4 2 4s3-1 4-2l3-3"/>',
  selecteer: '<path d="M5 3l13 7-6 1.6L9.4 18z"/>',
  sloop: '<path d="M3 17h11v-5H8l-2 5"/><path d="M14 12l3-4h2v9"/><path d="M19 17l2 3"/><circle cx="6" cy="19" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  terug: '<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 010 12h-2" transform="translate(0 -6)"/>',
  vooruit: '<path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 000 12h2" transform="translate(0 -6)"/>',
  nieuw: '<path d="M12 5v14M5 12h14"/>',
  opslaan: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  map: '<path d="M3 7h6l2 2h10v10H3z"/>',
  delen: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6"/>',
  community: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M14 15c3 0 6 1.5 6 5"/>',
  instellingen: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  hamer: '<path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7l-8 8 3 3 8-8"/>',
  speel: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  pauze: '<path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/>',
  vlag: '<path d="M5 21V4"/><path d="M5 4h13l-3 4 3 4H5"/>',
  herstart: '<path d="M4 12a8 8 0 108-8"/><path d="M4 4v5h5"/>',
  oog: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  sluit: '<path d="M6 6l12 12M18 6L6 18"/>',
  draai: '<path d="M20 12a8 8 0 11-3-6.2"/><path d="M20 4v5h-5"/>',
  omhoog: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  omlaag: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  min: '<path d="M5 12h14"/>',
  verplaats: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  prullenbak: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  hart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
  kopieer: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  hulp: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17v.5"/>',
  wijzer: '<path d="M12 4v10M8 10l4 4 4-4"/><path d="M5 20h14"/>',
};

export function icoon(naam, extra = '') {
  const span = document.createElement('span');
  span.className = 'icoon ' + extra;
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[naam] || ''}</svg>`;
  return span;
}

function knop(label, ico, onclick, extra = {}) {
  return el('button', { klasse: 'knop ' + (extra.klasse || ''), title: extra.title || label, onclick: (e) => { initGeluid(); geluid.klik(); onclick(e); }, type: 'button', 'aria-label': label }, ico ? icoon(ico) : null, extra.verberg ? null : el('span', { klasse: 'label', tekst: label }));
}

// Bovenaanzicht van een stuk als klein SVG-plaatje
function vormSvg(t, lr, d = 0) {
  const st = { t, lr, x: 0, z: 0, d, l: 4, e: 0, s: 0 };
  if (SOORTEN[t].spiraal) st.dh = -1;
  const pad = stukPad(st, 4);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pad.n; i++) {
    minX = Math.min(minX, pad.P[i * 3]); maxX = Math.max(maxX, pad.P[i * 3]);
    minZ = Math.min(minZ, pad.P[i * 3 + 2]); maxZ = Math.max(maxZ, pad.P[i * 3 + 2]);
  }
  // in beeld: rijrichting omhoog (vooruit = -y), rechts = +x
  const pts = [];
  for (let i = 0; i < pad.n; i++) pts.push([pad.P[i * 3 + 2], -pad.P[i * 3]]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
  const schaal = 30 / Math.max(2.2, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const d2 = pts.map((p, i) => `${i ? 'L' : 'M'}${(20 + (p[0] - mx) * schaal).toFixed(1)} ${(20 + (p[1] - my) * schaal).toFixed(1)}`).join(' ');
  const [ex, ey] = pts[pts.length - 1];
  const [px, py] = pts[Math.max(0, pts.length - 3)];
  const hoek = Math.atan2(ey - py, ex - px);
  const ax = 20 + (ex - mx) * schaal, ay = 20 + (ey - my) * schaal;
  const pijl = `M${(ax + Math.cos(hoek) * 4).toFixed(1)} ${(ay + Math.sin(hoek) * 4).toFixed(1)} L${(ax + Math.cos(hoek + 2.4) * 4).toFixed(1)} ${(ay + Math.sin(hoek + 2.4) * 4).toFixed(1)} L${(ax + Math.cos(hoek - 2.4) * 4).toFixed(1)} ${(ay + Math.sin(hoek - 2.4) * 4).toFixed(1)}Z`;
  void minX; void maxX; void minZ; void maxZ;
  const s = document.createElement('span');
  s.className = 'vorm';
  s.innerHTML = `<svg viewBox="0 0 40 40"><path d="${d2}" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" opacity=".25"/><path d="${d2}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="${pijl}" fill="currentColor"/></svg>`;
  return s;
}

function hellingSvg(s) {
  const hoeken = { '-2': 50, '-1': 22, '0': 0, '1': -22, '2': -50 };
  const a = (hoeken[s] * Math.PI) / 180;
  const x1 = 8, y1 = 20 - Math.tan(-a) * -12, x2 = 32, y2 = 20 + Math.tan(-a) * -12;
  const sp = document.createElement('span');
  sp.className = 'vorm';
  sp.innerHTML = `<svg viewBox="0 0 40 40"><path d="M${x1} ${y1.toFixed(1)} L${x2} ${y2.toFixed(1)}" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M6 33h28" stroke="currentColor" stroke-width="1.5" opacity=".35"/></svg>`;
  return sp;
}

function plaatje(promise, alt) {
  const img = el('img', { alt: '', klasse: 'plaatje', draggable: 'false', title: alt || null });
  promise.then((url) => { if (url) img.src = url; });
  return img;
}

const kmu = (v) => Math.round(v * KMU);

// ------------------------------------------------------------------ hoofd

export function maakUI(app, acties) {
  const wortel = document.getElementById('ui');
  const ui = {};
  let paneel = 'baan';

  // ---------------------------------------------------------------- bovenbalk
  const naamVeld = el('input', { id: 'baanNaam', maxlength: 40, spellcheck: 'false', 'aria-label': 'Naam van de baan', oninput: (e) => { app.baan.naam = e.target.value; acties.herbereken(); } });
  const modusKnoppen = {
    bouwen: knop('Bouwen', 'hamer', () => acties.zetModus('bouwen'), { klasse: 'modus' }),
    spelen: knop('Spelen', 'speel', () => acties.zetModus('spelen'), { klasse: 'modus' }),
    race: knop('Race', 'vlag', () => acties.zetModus('race'), { klasse: 'modus' }),
  };
  const topRechts = el('div', { klasse: 'groep rechts' },
    knop('Nieuw', 'nieuw', () => nieuweBaanVraag()),
    knop('Opslaan', 'opslaan', () => ui.opslaan()),
    knop('Mijn banen', 'map', () => mijnBanenVenster()),
    knop('Delen', 'delen', () => delenVenster()),
    knop('Community', 'community', () => communityVenster()),
    knop('Hulp', 'hulp', () => hulpVenster(), { verberg: true }),
    knop('Instellingen', 'instellingen', () => instellingenVenster(), { verberg: true }),
  );
  const top = el('header', { id: 'topbalk' },
    el('div', { klasse: 'logo' }, el('span', { klasse: 'logo-bol' }), el('span', { klasse: 'logo-tekst', html: 'MARBLE<b>TYCOON</b>' })),
    el('div', { klasse: 'naamvak' }, naamVeld),
    el('div', { klasse: 'groep modusgroep' }, ...Object.values(modusKnoppen)),
    topRechts,
  );

  // ---------------------------------------------------------------- speelbalk
  const pauzeKnop = knop('Pauze', 'pauze', () => { app.pauze = !app.pauze; ui.werkBij(); }, { verberg: true });
  const snelKnoppen = [1, 2, 3].map((n) => el('button', { klasse: 'knop snel', type: 'button', onclick: () => { geluid.klik(); app.snelheid = n; app.pauze = false; ui.werkBij(); }, title: `Snelheid ${n}×` }, el('span', { klasse: 'pijltjes', tekst: '▶'.repeat(n) })));
  const volgKnop = knop('Volg knikker', 'oog', () => { if (app.volg) acties.stopVolgen(); else acties.volgVolgende(); });
  const speelbalk = el('div', { id: 'speelbalk', klasse: 'paneel-glas' },
    pauzeKnop, ...snelKnoppen,
    knop('Opnieuw', 'herstart', () => acties.herstartSpel()),
    volgKnop,
  );
  const stats = el('div', { id: 'statistiek', klasse: 'paneel-glas' });

  // ---------------------------------------------------------------- onderbalk
  const tabKnoppen = {};
  const tab = (id, label, ico) => {
    tabKnoppen[id] = el('button', { klasse: 'tab', type: 'button', title: label, onclick: () => { initGeluid(); geluid.klik(); kiesPaneel(id); } }, icoon(ico), el('span', { klasse: 'label', tekst: label }));
    return tabKnoppen[id];
  };
  const gereedschap = {
    selecteer: el('button', { klasse: 'tab klein', type: 'button', title: 'Selecteren (klik op een stuk of decor)', onclick: () => { geluid.klik(); kiesTool('selecteer'); } }, icoon('selecteer'), el('span', { klasse: 'label', tekst: 'Kiezen' })),
    sloop: el('button', { klasse: 'tab klein sloop', type: 'button', title: 'Bulldozer: klik om weg te halen', onclick: () => { geluid.klik(); kiesTool('sloop'); } }, icoon('sloop'), el('span', { klasse: 'label', tekst: 'Slopen' })),
  };
  const terugKnop = el('button', { klasse: 'tab klein', type: 'button', title: 'Ongedaan maken (Ctrl+Z)', onclick: () => acties.ongedaan() }, icoon('terug'), el('span', { klasse: 'label', tekst: 'Terug' }));
  const vooruitKnop = el('button', { klasse: 'tab klein', type: 'button', title: 'Opnieuw (Ctrl+Y)', onclick: () => acties.opnieuw() }, icoon('vooruit'), el('span', { klasse: 'label', tekst: 'Vooruit' }));
  const paneelInhoud = el('div', { id: 'paneel', klasse: 'paneel-glas' });
  const onder = el('nav', { id: 'onderbalk' },
    paneelInhoud,
    el('div', { id: 'tabs', klasse: 'paneel-glas' },
      tab('baan', 'Baan', 'baan'), tab('thema', "Thema's", 'thema'), tab('knikkers', 'Knikkers', 'knikker'), tab('verf', 'Verf', 'verf'),
      el('span', { klasse: 'scheiding' }),
      gereedschap.selecteer, gereedschap.sloop,
      el('span', { klasse: 'scheiding' }),
      terugKnop, vooruitKnop,
    ),
  );

  const info = el('aside', { id: 'info', klasse: 'paneel-glas', hidden: true });
  const hint = el('div', { id: 'hint' });
  const toasts = el('div', { id: 'toasts', 'aria-live': 'polite' });
  const modal = el('div', { id: 'modal', hidden: true, onclick: (e) => { if (e.target === modal) sluitModal(); } });
  wortel.append(top, speelbalk, stats, info, hint, onder, toasts, modal);

  // ---------------------------------------------------------------- panelen

  function kiesPaneel(id) {
    paneel = paneel === id && paneelInhoud.dataset.open === '1' ? null : id;
    if (id === 'baan' && app.baan.start) kiesTool('baan', true);
    if (id === 'verf') kiesTool('verf', true);
    if (id === 'thema' && app.tool !== 'decor') { if (app.decorKeuze) kiesTool('decor', true); }
    if (paneel !== 'thema' && app.tool === 'decor') kiesTool(app.baan.start ? 'baan' : 'start', true);
    if (paneel !== 'verf' && app.tool === 'verf') kiesTool(app.baan.start ? 'baan' : 'start', true);
    bouwPaneel();
    ui.werkBij();
  }

  function kiesTool(tool, stil) {
    if (tool === 'baan' && !app.baan.start) tool = 'start';
    app.tool = app.tool === tool && (tool === 'sloop' || tool === 'selecteer') ? (app.baan.start ? 'baan' : 'start') : tool;
    app.verplaats = null;
    if (!stil) acties.herbereken(); else acties.werkSpookBij();
    ui.werkBij();
  }

  function sectie(titel, ...inhoud) {
    return el('section', { klasse: 'sectie' }, el('h3', { tekst: titel }), ...inhoud);
  }
  function groeiSectie(titel, ...inhoud) {
    const s = sectie(titel, ...inhoud);
    s.classList.add('groei');
    return s;
  }

  const bouwStatus = el('div', { klasse: 'bouwstatus' });
  let bouwKnoppen = [];

  function baanPaneel() {
    const inhoud = [];
    bouwKnoppen = [];
    if (!app.baan.start) {
      inhoud.push(el('div', { klasse: 'start-uitleg' },
        el('h3', { tekst: 'Begin met een startpunt' }),
        el('p', { tekst: 'Klik op een tegel om de starttoren neer te zetten. Druk op R om hem te draaien. Vanaf het startpunt bouw je de rest van de baan.' }),
      ));
      return inhoud;
    }
    const vormKnop = (t, lr, label) => {
      const b = el('button', { klasse: 'vormknop', type: 'button', title: label, onclick: () => { geluid.klik(); app.keuze.t = t; app.keuze.lr = lr || 'R'; acties.werkSpookBij(); werkBouwKnoppenBij(); } }, vormSvg(t, lr || 'R'), el('span', { klasse: 'mini', tekst: label }));
      b.dataset.t = t; b.dataset.lr = lr || '';
      bouwKnoppen.push(b);
      return b;
    };
    const richting = el('div', { klasse: 'vormen' },
      vormKnop('bocht3', 'L', 'Groot L'), vormKnop('bocht2', 'L', 'Middel L'), vormKnop('bocht1', 'L', 'Klein L'),
      vormKnop('recht', '', 'Recht'),
      vormKnop('bocht1', 'R', 'Klein R'), vormKnop('bocht2', 'R', 'Middel R'), vormKnop('bocht3', 'R', 'Groot R'),
      vormKnop('kwart3', 'L', '45° groot L'), vormKnop('kwart1', 'L', '45° klein L'), vormKnop('sbocht', 'L', 'S-bocht L'),
      vormKnop('sbocht', 'R', 'S-bocht R'), vormKnop('kwart1', 'R', '45° klein R'), vormKnop('kwart3', 'R', '45° groot R'),
    );

    const hellingKnoppen = el('div', { klasse: 'hellingen' });
    for (const s of [2, 1, 0, -1, -2]) {
      const b = el('button', { klasse: 'hellingknop', type: 'button', title: HELLING_NAAM[s], onclick: () => { geluid.klik(); app.keuze.s = s; if (SOORTEN[app.keuze.t].vast && !SOORTEN[app.keuze.t].spiraal) app.keuze.t = 'recht'; acties.werkSpookBij(); werkBouwKnoppenBij(); } }, hellingSvg(String(s)), el('span', { klasse: 'mini', tekst: HELLING_NAAM[s] }));
      b.dataset.s = s;
      bouwKnoppen.push(b);
      hellingKnoppen.append(b);
    }
    const kol = sectie('Richting', richting);
    kol.append(el('h3', { tekst: 'Helling' }), hellingKnoppen);
    inhoud.push(kol);

    const speciaal = el('div', { klasse: 'kaarten' });
    const spec = [
      ['looping', '', 'Looping'], ['kurk', 'L', 'Kurkentrekker L'], ['kurk', 'R', 'Kurkentrekker R'],
      ['spiraal1', 'L', 'Spiraal klein L'], ['spiraal1', 'R', 'Spiraal klein R'], ['spiraal2', 'L', 'Spiraal groot L'], ['spiraal2', 'R', 'Spiraal groot R'],
      ['aqua', '', 'Aquarium'], ['aquaB', 'L', 'Aquariumbocht L'], ['aquaB', 'R', 'Aquariumbocht R'],
      ['launch', '', 'Launchtunnel'], ['finish', '', 'Finish'],
    ];
    for (const [t, lr, naam] of spec) {
      const b = el('button', { klasse: 'kaart', type: 'button', title: naam, onclick: () => { geluid.klik(); app.keuze.t = t; app.keuze.lr = lr || 'R'; acties.werkSpookBij(); werkBouwKnoppenBij(); } },
        plaatje(stukIkoon(t, { lr: lr || 'R', kleur: app.kleur }), naam), el('span', { klasse: 'naam', tekst: naam }));
      b.dataset.t = t; b.dataset.lr = lr || '';
      bouwKnoppen.push(b);
      speciaal.append(b);
    }
    inhoud.push(groeiSectie('Speciale stukken', speciaal));

    const fxRij = el('div', { klasse: 'segment' });
    for (const [id, naam] of Object.entries(EFFECTEN)) {
      const b = el('button', { klasse: 'seg', type: 'button', onclick: () => {
        geluid.klik();
        app.keuze.fx = id;
        if (id) app.keuze.v = EFFECT_STANDAARD[id] ?? app.keuze.v;
        if (id && SOORTEN[app.keuze.t].vast && !SOORTEN[app.keuze.t].spiraal) app.keuze.t = 'recht';
        acties.werkSpookBij(); werkBouwKnoppenBij();
      } }, naam);
      b.dataset.fx = id;
      bouwKnoppen.push(b);
      fxRij.append(b);
    }
    const snelLabel = el('span', { klasse: 'waarde' });
    const snelSchuif = el('input', { type: 'range', min: 1, max: 120, step: 1, oninput: (e) => { if (app.keuze.t === 'launch') app.keuze.lv = Number(e.target.value); else app.keuze.v = Number(e.target.value); snelLabel.textContent = e.target.value + ' km/u'; } });
    const snelRij = el('label', { klasse: 'schuif' }, el('span', { klasse: 'snelnaam', tekst: 'Snelheid' }), snelSchuif, snelLabel);
    const kantel = el('input', { type: 'checkbox', onchange: (e) => { app.keuze.k = e.target.checked; acties.werkSpookBij(); } });
    const bouwKnop = el('button', { klasse: 'knop groot primair', type: 'button', onclick: () => { initGeluid(); acties.bouw(); } }, icoon('hamer'), el('span', { klasse: 'label', tekst: 'Bouwen' }), el('kbd', { tekst: '⏎' }));
    const wegKnop = el('button', { klasse: 'knop', type: 'button', title: 'Laatste of gekozen stuk weghalen (Backspace)', onclick: () => { initGeluid(); acties.verwijderLaatste(); } }, icoon('prullenbak'), el('span', { klasse: 'label', tekst: 'Weghalen' }));
    const effSectie = sectie('Effect',
      fxRij, snelRij,
      el('label', { klasse: 'vinkje' }, kantel, 'Bochten kantelen'),
      el('div', { klasse: 'bouwacties' }, bouwKnop, wegKnop),
      bouwStatus,
    );
    effSectie.classList.add('effectkolom');
    inhoud.push(effSectie);
    ui._snel = { snelSchuif, snelLabel, snelRij, kantel };
    return inhoud;
  }

  function werkBouwKnoppenBij() {
    if (paneel !== 'baan' || !app.baan.start) return;
    for (const b of bouwKnoppen) {
      if (b.dataset.t) {
        const actief = b.dataset.t === app.keuze.t && (!SOORTEN[b.dataset.t].bocht || b.dataset.lr === app.keuze.lr);
        b.classList.toggle('actief', actief);
        const g = acties.keuzeGeldig(b.dataset.t, SOORTEN[b.dataset.t].vast ? 0 : app.keuze.s);
        // vorm mag als er een helling is die past
        let ok = g.ok;
        if (!ok && !SOORTEN[b.dataset.t].vast && app.cursor) ok = [-2, -1, 0, 1, 2].some((s) => acties.keuzeGeldig(b.dataset.t, s).ok);
        b.classList.toggle('uit', !ok);
        b.title = (b.title.split(' — ')[0]) + (ok ? '' : ' — ' + g.reden);
      } else if (b.dataset.s !== undefined) {
        const s = Number(b.dataset.s);
        const vast = SOORTEN[app.keuze.t].vast && !SOORTEN[app.keuze.t].spiraal;
        b.classList.toggle('actief', !vast && s === app.keuze.s);
        const spir = SOORTEN[app.keuze.t].spiraal;
        const ok = spir ? Math.abs(s) === 1 : acties.keuzeGeldig(vast ? 'recht' : app.keuze.t, s).ok;
        b.classList.toggle('uit', !ok);
      } else if (b.dataset.fx !== undefined) {
        const vast = SOORTEN[app.keuze.t].vast && !SOORTEN[app.keuze.t].spiraal;
        b.classList.toggle('actief', vast ? b.dataset.fx === '' : b.dataset.fx === (app.keuze.fx || ''));
      }
    }
    const s = ui._snel;
    if (s) {
      const launch = app.keuze.t === 'launch';
      const fx = launch ? 'launch' : app.keuze.fx;
      const heeft = launch || (fx && fx !== 'vuur' && !(SOORTEN[app.keuze.t].vast && !SOORTEN[app.keuze.t].spiraal));
      s.snelRij.hidden = !heeft;
      if (heeft) {
        const [min, max] = EFFECT_BEREIK[fx];
        s.snelSchuif.min = min; s.snelSchuif.max = max;
        const v = launch ? app.keuze.lv : app.keuze.v;
        s.snelSchuif.value = v;
        s.snelLabel.textContent = Math.round(v) + ' km/u';
        s.snelRij.querySelector('.snelnaam').textContent = { lift: 'Kettingsnelheid', boost: 'Boost tot', rem: 'Remmen tot', launch: 'Launchsnelheid' }[fx];
      }
      s.kantel.checked = app.keuze.k !== false;
    }
  }

  ui.zetBouwStatus = (reden, ok) => {
    bouwStatus.textContent = reden ? reden : ok ? 'Klik op het groene stuk of druk op Bouwen' : '';
    bouwStatus.classList.toggle('fout', !!reden);
    werkBouwKnoppenBij();
  };

  let actiefThema = 'stad';
  function themaPaneel() {
    const tabs = el('div', { klasse: 'themas' });
    for (const t of THEMAS) {
      tabs.append(el('button', { klasse: 'themaknop' + (t.id === actiefThema ? ' actief' : ''), type: 'button', onclick: () => { geluid.klik(); actiefThema = t.id; bouwPaneel(); } }, t.naam, el('small', { tekst: ' ' + t.items.length })));
    }
    const kaarten = el('div', { klasse: 'kaarten breed' });
    const thema = THEMAS.find((t) => t.id === actiefThema);
    for (const it of thema.items) {
      const b = el('button', { klasse: 'kaart' + (app.decorKeuze === it.id && app.tool === 'decor' ? ' actief' : ''), type: 'button', title: it.naam, onclick: () => { initGeluid(); geluid.klik(); acties.kiesDecor(it.id); bouwPaneel(); } }, plaatje(decorIkoon(it.id), it.naam), el('span', { klasse: 'naam', tekst: it.naam }));
      kaarten.append(b);
    }
    const bediening = el('div', { klasse: 'decorbediening' },
      knop('Draai', 'draai', () => { app.decorRot += Math.PI / 2; geluid.draai(); }, { title: 'Draaien (R, Shift+R = 45°)' }),
      knop('Hoger', 'omhoog', () => { app.decorHoogte = Math.min(30, app.decorHoogte + 0.5); ui.werkBij(); }, { title: 'Hoger (Page Up)' }),
      knop('Lager', 'omlaag', () => { app.decorHoogte = Math.max(0, app.decorHoogte - 0.5); ui.werkBij(); }, { title: 'Lager (Page Down)' }),
      knop('Groter', 'plus', () => { app.decorSchaal = Math.min(3, Math.round((app.decorSchaal + 0.25) * 100) / 100); ui.werkBij(); }),
      knop('Kleiner', 'min', () => { app.decorSchaal = Math.max(0.5, Math.round((app.decorSchaal - 0.25) * 100) / 100); ui.werkBij(); }),
      el('span', { klasse: 'decorinfo' }),
    );
    return [el('div', { klasse: 'themakolom' }, tabs, kaarten, bediening)];
  }

  function knikkerPaneel() {
    const k = app.baan.knikkers;
    const aantalLabel = el('span', { klasse: 'waarde', tekst: k.aantal });
    const intLabel = el('span', { klasse: 'waarde', tekst: k.interval.toFixed(1) + ' s' });
    const skins = el('div', { klasse: 'kaarten skins' });
    const werk = () => { acties.herbereken(); };
    for (const s of SKINS) {
      const b = el('button', { klasse: 'kaart skin' + (k.skins.includes(s.id) ? ' actief' : ''), type: 'button', title: s.naam, onclick: () => {
        geluid.klik();
        if (k.skins.includes(s.id)) { if (k.skins.length > 1) k.skins = k.skins.filter((x) => x !== s.id); }
        else k.skins = [...k.skins, s.id];
        b.classList.toggle('actief', k.skins.includes(s.id));
        werk();
      } }, plaatje(skinIkoon(s.id), s.naam), el('span', { klasse: 'naam', tekst: s.naam }));
      skins.append(b);
    }
    return [
      sectie('Knikkers',
        el('label', { klasse: 'schuif' }, 'Aantal', el('input', { type: 'range', min: 1, max: MAX_KNIKKERS, value: k.aantal, oninput: (e) => { k.aantal = Number(e.target.value); aantalLabel.textContent = k.aantal; werk(); } }), aantalLabel),
        el('label', { klasse: 'schuif' }, 'Tussenpauze', el('input', { type: 'range', min: 0.2, max: 3, step: 0.1, value: k.interval, oninput: (e) => { k.interval = Number(e.target.value); intLabel.textContent = k.interval.toFixed(1) + ' s'; werk(); } }), intLabel),
        el('label', { klasse: 'vinkje' }, el('input', { type: 'checkbox', checked: k.rondgaan !== false, onchange: (e) => { k.rondgaan = e.target.checked; werk(); } }), 'Na de finish terug naar de start'),
        el('label', { klasse: 'vinkje' }, el('input', { type: 'checkbox', checked: !!k.uitDeBocht, onchange: (e) => { k.uitDeBocht = e.target.checked; werk(); } }), 'Realistisch: te snel = uit de bocht vliegen'),
        el('div', { klasse: 'rij' }, knop('Alle skins', null, () => { k.skins = SKINS.map((s) => s.id); bouwPaneel(); werk(); }), knop('Eén skin', null, () => { k.skins = [k.skins[0]]; bouwPaneel(); werk(); })),
      ),
      groeiSectie('Skins (kies er een of meer)', skins),
    ];
  }

  function verfPaneel() {
    const doelKnoppen = el('div', { klasse: 'segment' },
      ...[['baan', 'Baan'], ['steun', 'Steunen']].map(([id, naam]) => el('button', { klasse: 'seg' + (app.verfDoel === id ? ' actief' : ''), type: 'button', onclick: () => { geluid.klik(); app.verfDoel = id; bouwPaneel(); } }, naam)));
    const huidig = app.verfDoel === 'baan' ? app.kleur : app.steun;
    const zet = (c) => { if (app.verfDoel === 'baan') app.kleur = c; else app.steun = c; bouwPaneel(); acties.werkSpookBij(); };
    const stalen = el('div', { klasse: 'stalen' });
    for (const c of KLEUREN) stalen.append(el('button', { klasse: 'staal' + (c === huidig ? ' actief' : ''), type: 'button', stijl: `background:${c}`, title: c, onclick: () => { geluid.klik(); zet(c); } }));
    const eigen = el('input', { type: 'color', value: huidig, oninput: (e) => zet(e.target.value) });
    return [
      sectie('Wat wil je verven?', doelKnoppen,
        el('div', { klasse: 'kleurvoorbeeld' }, el('span', { klasse: 'staal groot', stijl: `background:${app.kleur}` }), 'Baan', el('span', { klasse: 'staal groot', stijl: `background:${app.steun}` }), 'Steunen'),
        el('p', { klasse: 'uitleg', tekst: 'Klik op een stuk om het te verven. Nieuwe stukken krijgen deze kleuren.' }),
        knop(app.verfDoel === 'baan' ? 'Hele baan verven' : 'Alle steunen verven', 'verf', () => acties.verfAlles()),
      ),
      sectie('Kleuren', stalen, el('label', { klasse: 'eigenkleur' }, eigen, 'Eigen kleur')),
    ];
  }

  function bouwPaneel() {
    paneelInhoud.replaceChildren();
    paneelInhoud.dataset.open = paneel ? '1' : '0';
    if (!paneel || app.modus !== 'bouwen') return;
    const delen = { baan: baanPaneel, thema: themaPaneel, knikkers: knikkerPaneel, verf: verfPaneel }[paneel]();
    paneelInhoud.append(...delen);
    werkBouwKnoppenBij();
  }

  // ---------------------------------------------------------------- infopaneel

  function infoPaneel() {
    const sel = app.selectie;
    info.replaceChildren();
    if (!sel || app.modus !== 'bouwen') { info.hidden = true; return; }
    info.hidden = false;
    const kop = (titel, sub) => el('div', { klasse: 'infokop' }, el('div', {}, el('h2', { tekst: titel }), sub ? el('div', { klasse: 'sub', tekst: sub }) : null), el('button', { klasse: 'sluitknop', type: 'button', 'aria-label': 'Sluiten', onclick: () => { app.selectie = null; acties.herbereken(); } }, icoon('sluit')));
    if (sel.soort === 'decor') {
      const d = app.baan.decor.find((x) => x.id === sel.id);
      if (!d) { info.hidden = true; return; }
      const item = ITEMS.get(d.i);
      const thema = THEMAS.find((t) => t.id === item.thema);
      info.append(
        kop(item.naam, thema.naam),
        el('div', { klasse: 'knoppenrij' },
          knop('Draai', 'draai', () => acties.wijzigDecor(d.id, (x) => { x.r += Math.PI / 2; })),
          knop('Hoger', 'omhoog', () => acties.wijzigDecor(d.id, (x) => { x.y = Math.min(30, x.y + 0.5); })),
          knop('Lager', 'omlaag', () => acties.wijzigDecor(d.id, (x) => { x.y = Math.max(0, x.y - 0.5); })),
          knop('Groter', 'plus', () => acties.wijzigDecor(d.id, (x) => { x.s = Math.min(3, x.s + 0.25); })),
          knop('Kleiner', 'min', () => acties.wijzigDecor(d.id, (x) => { x.s = Math.max(0.5, x.s - 0.25); })),
        ),
        el('div', { klasse: 'knoppenrij' },
          knop('Verplaats', 'verplaats', () => { acties.verplaatsDecor(d.id); paneel = 'thema'; actiefThema = item.thema; bouwPaneel(); }),
          knop('Weghalen', 'prullenbak', () => acties.verwijderDecor(d.id), { klasse: 'gevaar' }),
        ),
      );
      return;
    }
    if (sel.id === 'start') {
      const s = app.baan.start;
      if (!s) { info.hidden = true; return; }
      info.append(
        kop('Startpunt', `Hoogte ${(s.h * NIVEAU).toFixed(1)} m · ${app.baan.knikkers.aantal} knikkers`),
        el('div', { klasse: 'knoppenrij' },
          knop('Hoger', 'omhoog', () => acties.startHoogte(1), { title: 'Hele baan omhoog (Page Up)' }),
          knop('Lager', 'omlaag', () => acties.startHoogte(-1), { title: 'Hele baan omlaag (Page Down)' }),
          knop('Draai baan', 'draai', () => acties.draaiHeleBaan()),
          knop('Verplaats', 'verplaats', () => acties.verplaatsStart()),
        ),
        el('div', { klasse: 'kleurknoppen' },
          el('button', { klasse: 'knop', type: 'button', onclick: () => acties.wijzigStuk('start', { c: app.kleur }) }, el('span', { klasse: 'staal', stijl: `background:${app.kleur}` }), 'Baankleur toepassen'),
          el('button', { klasse: 'knop', type: 'button', onclick: () => acties.wijzigStuk('start', { sc: app.steun }) }, el('span', { klasse: 'staal', stijl: `background:${app.steun}` }), 'Steunkleur toepassen'),
        ),
        el('p', { klasse: 'uitleg', tekst: 'Hoger, lager, draaien en verplaatsen doen de hele baan mee.' }),
      );
      return;
    }
    const st = app.baan.stukken.find((x) => x.id === sel.id);
    if (!st) { info.hidden = true; return; }
    const def = SOORTEN[st.t];
    const naam = def.naam + (def.bocht ? (st.lr === 'L' ? ' links' : ' rechts') : '') + (st.d % 2 ? ' (diagonaal)' : '');
    const u = st._uit || uitgang(st);
    const helling = def.vast ? (def.spiraal ? (st.dh > 0 ? 'omhoog' : 'omlaag') : 'vlak') : (st.e === st.s ? HELLING_NAAM[st.e] : `${HELLING_NAAM[st.e]} → ${HELLING_NAAM[st.s]}`);
    const sub = `Hoogte ${(st.l * NIVEAU).toFixed(1)} → ${(u.l * NIVEAU).toFixed(1)} m · ${helling}`;
    const delen = [kop(naam, sub)];
    if (!def.vast || def.spiraal) {
      const seg = el('div', { klasse: 'segment klein' });
      for (const [id, n] of Object.entries(EFFECTEN)) {
        seg.append(el('button', { klasse: 'seg' + ((st.fx || '') === id ? ' actief' : ''), type: 'button', onclick: () => { geluid.klik(); acties.wijzigStuk(st.id, { fx: id || undefined, v: id ? (st.v && st.fx === id ? st.v : EFFECT_STANDAARD[id]) : undefined }); } }, n));
      }
      delen.push(seg);
    }
    const fx = st.t === 'launch' ? 'launch' : st.fx;
    if (fx && fx !== 'vuur') {
      const [min, max] = EFFECT_BEREIK[fx];
      const lab = el('span', { klasse: 'waarde', tekst: Math.round(st.v) + ' km/u' });
      delen.push(el('label', { klasse: 'schuif' }, { lift: 'Kettingsnelheid', boost: 'Boost tot', rem: 'Remmen tot', launch: 'Launchsnelheid' }[fx],
        el('input', { type: 'range', min, max, value: st.v, oninput: (e) => { lab.textContent = e.target.value + ' km/u'; }, onchange: (e) => acties.wijzigStuk(st.id, { v: Number(e.target.value) }) }), lab));
    }
    if (def.bocht && !def.vast) {
      delen.push(el('label', { klasse: 'vinkje' }, el('input', { type: 'checkbox', checked: st.k !== false, onchange: (e) => acties.wijzigStuk(st.id, { k: e.target.checked ? undefined : false }) }), 'Gekanteld'));
    }
    delen.push(el('div', { klasse: 'kleurknoppen' },
      el('button', { klasse: 'knop', type: 'button', onclick: () => acties.wijzigStuk(st.id, { c: app.kleur }) }, el('span', { klasse: 'staal', stijl: `background:${app.kleur}` }), 'Baankleur'),
      el('button', { klasse: 'knop', type: 'button', onclick: () => acties.wijzigStuk(st.id, { sc: app.steun }) }, el('span', { klasse: 'staal', stijl: `background:${app.steun}` }), 'Steunkleur'),
    ));
    const open = app.info.open.find((o) => o.van === st.id);
    delen.push(el('div', { klasse: 'knoppenrij' },
      open ? knop('Bouw hier verder', 'hamer', () => { app.cursor = open; app.selectie = null; paneel = 'baan'; kiesTool('baan'); bouwPaneel(); acties.herbereken(); }) : null,
      knop('Weghalen', 'prullenbak', () => acties.verwijderStuk(st.id), { klasse: 'gevaar' }),
    ));
    info.append(...delen);
  }

  // ---------------------------------------------------------------- statistiek

  ui.werkStatsBij = () => {
    if (app.modus !== 'spelen') return;
    const s = app.sim.stats;
    const op = app.sim.knikkers.filter((k) => k.toestand === 'baan' || k.toestand === 'vrij').length;
    const regels = [
      ['Op de baan', `${op} / ${app.sim.knikkers.length}`],
      ['Binnen', s.binnen],
      ['Topsnelheid', kmu(s.topSnelheid) + ' km/u'],
      ['Beste rondetijd', s.besteRonde < Infinity ? s.besteRonde.toFixed(2) + ' s' : '—'],
    ];
    if (app.sim.uitDeBocht || s.uitgevlogen) regels.push(['Uit de bocht', s.uitgevlogen]);
    stats.replaceChildren(...regels.map(([a, b]) => el('div', { klasse: 'statregel' }, el('span', { tekst: a }), el('b', { tekst: String(b) }))));
  };

  // ---------------------------------------------------------------- hint onderin

  function werkHintBij() {
    let t = '';
    if (app.modus === 'bouwen') {
      if (app.verplaats) t = 'Klik op een tegel om de baan te verplaatsen · R draait · Esc annuleert';
      else if (app.tool === 'start') t = 'Klik op een tegel om het startpunt te plaatsen · R draait';
      else if (app.tool === 'decor') {
        const it = ITEMS.get(app.decorKeuze);
        t = `${it ? it.naam : 'Decor'} plaatsen: klik · R draait · Page Up/Down hoogte · Alt = vrij · Esc stopt`;
      } else if (app.tool === 'verf') t = 'Klik op een stuk om het te verven';
      else if (app.tool === 'sloop') t = 'Bulldozer: klik op een stuk of decor om het weg te halen';
      else if (app.tool === 'selecteer') t = 'Klik op een stuk of decor om het te kiezen';
      else t = app.cursor ? 'Kies een vorm en helling, klik op het groene stuk of druk Enter · groene pijlen = open einden' : 'Klik op een stuk met een open einde om daar verder te bouwen';
    } else if (app.modus === 'spelen') t = 'Klik op een knikker om hem te volgen · Spatie = pauze · 1-3 = snelheid · B = bouwen';
    hint.textContent = t;
  }

  // ---------------------------------------------------------------- alles bijwerken

  ui.werkBij = () => {
    document.body.dataset.modus = app.modus;
    if (document.activeElement !== naamVeld) naamVeld.value = app.baan.naam;
    for (const [m, b] of Object.entries(modusKnoppen)) b.classList.toggle('actief', app.modus === m);
    for (const [id, b] of Object.entries(tabKnoppen)) b.classList.toggle('actief', paneel === id);
    gereedschap.selecteer.classList.toggle('actief', app.tool === 'selecteer');
    gereedschap.sloop.classList.toggle('actief', app.tool === 'sloop');
    terugKnop.disabled = !app.terug.length;
    vooruitKnop.disabled = !app.vooruit.length;
    onder.hidden = app.modus !== 'bouwen';
    speelbalk.hidden = app.modus !== 'spelen';
    stats.hidden = app.modus !== 'spelen';
    if (app.modus === 'spelen' && !stats.childElementCount) ui.werkStatsBij();
    pauzeKnop.replaceChildren(icoon(app.pauze ? 'speel' : 'pauze'));
    snelKnoppen.forEach((b, i) => b.classList.toggle('actief', !app.pauze && app.snelheid === i + 1));
    volgKnop.classList.toggle('actief', !!app.volg);
    const di = paneelInhoud.querySelector('.decorinfo');
    if (di) di.textContent = `Hoogte ${app.decorHoogte.toFixed(1)} m · ${Math.round(app.decorSchaal * 100)}%`;
    if (paneel === 'baan' && paneelInhoud.dataset.heeftStart !== String(!!app.baan.start)) { paneelInhoud.dataset.heeftStart = String(!!app.baan.start); bouwPaneel(); }
    werkBouwKnoppenBij();
    infoPaneel();
    werkHintBij();
  };

  // ---------------------------------------------------------------- meldingen

  ui.toast = (tekst, soort = 'info') => {
    const t = el('div', { klasse: 'toast ' + soort, tekst });
    toasts.append(t);
    while (toasts.children.length > 4) toasts.firstChild.remove();
    setTimeout(() => { t.classList.add('weg'); setTimeout(() => t.remove(), 400); }, soort === 'fout' ? 3200 : 2600);
  };

  // ---------------------------------------------------------------- vensters

  function openModal(titel, inhoud, opties = {}) {
    modal.replaceChildren(el('div', { klasse: 'venster paneel-glas ' + (opties.klasse || ''), role: 'dialog', 'aria-label': titel },
      el('div', { klasse: 'vensterkop' }, el('h2', { tekst: titel }), el('button', { klasse: 'sluitknop', type: 'button', 'aria-label': 'Sluiten', onclick: () => sluitModal() }, icoon('sluit'))),
      el('div', { klasse: 'vensterinhoud' }, inhoud),
    ));
    modal.hidden = false;
    ui.modalOpen = true;
  }
  function sluitModal() { modal.hidden = true; modal.replaceChildren(); ui.modalOpen = false; }
  ui.sluitModal = sluitModal;
  ui.openModal = openModal;
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) { e.stopImmediatePropagation(); sluitModal(); } }, true);

  function nieuweBaanVraag() {
    openModal('Nieuwe baan', el('div', {},
      el('p', { tekst: 'Wil je opnieuw beginnen met een lege baan? Sla je huidige baan eerst op als je die wilt bewaren.' }),
      el('div', { klasse: 'knoppenrij rechts' },
        knop('Annuleren', null, () => sluitModal()),
        knop('Opslaan en nieuw', 'opslaan', () => { ui.opslaan(); nieuw(); }),
        knop('Nieuwe baan', 'nieuw', () => nieuw(), { klasse: 'primair' }),
      ),
    ));
    function nieuw() {
      sluitModal();
      acties.nieuwId();
      acties.zetBaan({ v: 1, naam: 'Mijn knikkerbaan', start: null, stukken: [], decor: [], knikkers: app.baan.knikkers });
      acties.focusBaan();
      paneel = 'baan';
      bouwPaneel();
    }
  }

  ui.opslaan = () => {
    let thumb = '';
    try { thumb = acties.maakThumbnail(240, 150); } catch (e) { console.warn(e); }
    if (acties.bewaar(thumb)) { geluid.opslaan(); ui.toast(`"${app.baan.naam}" is opgeslagen`, 'goed'); }
    else ui.toast('Opslaan lukte niet: de opslag van je browser is vol', 'fout');
  };

  function mijnBanenVenster() {
    const lijst = mijnBanen();
    const raster = el('div', { klasse: 'banenraster' });
    if (!lijst.length) raster.append(el('p', { klasse: 'leeg', tekst: 'Je hebt nog geen banen opgeslagen.' }));
    for (const b of lijst) {
      raster.append(el('div', { klasse: 'baankaart' },
        b.thumb ? el('img', { src: b.thumb, alt: '' }) : el('div', { klasse: 'geenbeeld' }),
        el('div', { klasse: 'baaninfo' }, el('b', { tekst: b.naam }), el('small', { tekst: `${b.stukken} stukken · ${new Date(b.bijgewerkt).toLocaleDateString('nl-NL')}` })),
        el('div', { klasse: 'knoppenrij' },
          knop('Openen', 'map', () => { sluitModal(); acties.laad(b.id); }, { klasse: 'primair' }),
          knop('Weg', 'prullenbak', () => { verwijderBaan(b.id); mijnBanenVenster(); }, { klasse: 'gevaar', verberg: true, title: 'Verwijderen' }),
        ),
      ));
    }
    openModal('Mijn banen', raster, { klasse: 'breed' });
  }

  async function delenVenster() {
    const data = naarJSON(app.baan);
    const naam = el('input', { value: app.baan.naam, maxlength: 40 });
    const maker = el('input', { value: app.inst.bouwer || app.baan.maker || '', maxlength: 24, placeholder: 'Je bouwersnaam' });
    const beschrijving = el('textarea', { maxlength: 300, rows: 3, placeholder: 'Vertel iets over je baan (mag leeg)' });
    const status = el('p', { klasse: 'status' });
    const codeVeld = el('textarea', { rows: 3, readonly: true, klasse: 'code' });
    maakDeelcode(data).then((c) => { codeVeld.value = c; });
    const gedeeld = mijnGedeeld();
    const bestaand = app.baan.gedeeldId && gedeeld[app.baan.gedeeldId] ? app.baan.gedeeldId : null;
    const publiceer = async (bijwerken) => {
      status.textContent = 'Bezig met delen…';
      status.className = 'status';
      app.baan.naam = naam.value.trim() || app.baan.naam;
      app.inst.bouwer = maker.value.trim();
      opslag.schrijf('instellingen', app.inst);
      app.baan.maker = app.inst.bouwer;
      let thumb = '';
      try { thumb = acties.maakThumbnail(); } catch (e) { console.warn(e); }
      const body = { naam: app.baan.naam, maker: app.baan.maker, beschrijving: beschrijving.value, data: naarJSON(app.baan), thumb };
      try {
        let id;
        if (bijwerken && bestaand) { await community.werkBij(bestaand, gedeeld[bestaand].sleutel, body); id = bestaand; }
        else { const r = await community.publiceer(body); id = r.id; bewaarGedeeld(id, r.sleutel, app.baan.naam); app.baan.gedeeldId = id; }
        const link = location.origin + location.pathname + '?baan=' + id;
        status.replaceChildren('Gedeeld! Link: ', el('a', { href: link, target: '_blank', rel: 'noopener', tekst: link }));
        status.className = 'status goed';
        navigator.clipboard?.writeText(link).then(() => ui.toast('Link gekopieerd', 'goed')).catch(() => {});
        geluid.opslaan();
        acties.herbereken();
      } catch (e) {
        status.textContent = e.message;
        status.className = 'status fout';
      }
    };
    const importVeld = el('textarea', { rows: 2, placeholder: 'Plak hier een deelcode (MT1…)' });
    const bestandInvoer = el('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { laadData(JSON.parse(await f.text())); } catch { ui.toast('Dit bestand kon ik niet lezen', 'fout'); }
    } });
    const laadData = (d) => { vanJSON(d); sluitModal(); acties.nieuwId(); acties.zetBaan(d); acties.focusBaan(); ui.toast('Baan geladen', 'goed'); };
    openModal('Baan delen', el('div', { klasse: 'delen' },
      sectie('Delen in de community',
        el('label', { klasse: 'veld' }, 'Naam', naam),
        el('label', { klasse: 'veld' }, 'Gemaakt door', maker),
        el('label', { klasse: 'veld' }, 'Beschrijving', beschrijving),
        el('div', { klasse: 'knoppenrij' },
          knop(bestaand ? 'Als nieuwe baan delen' : 'Publiceren', 'community', () => publiceer(false), { klasse: bestaand ? '' : 'primair' }),
          bestaand ? knop('Mijn gedeelde baan bijwerken', 'opslaan', () => publiceer(true), { klasse: 'primair' }) : null,
        ),
        status,
      ),
      sectie('Deelcode (werkt ook zonder internet)',
        codeVeld,
        el('div', { klasse: 'knoppenrij' },
          knop('Kopieer code', 'kopieer', () => { navigator.clipboard?.writeText(codeVeld.value).then(() => ui.toast('Code gekopieerd', 'goed')).catch(() => { codeVeld.select(); }); }),
          knop('Download bestand', 'opslaan', () => {
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const a = el('a', { href: URL.createObjectURL(blob), download: (app.baan.naam || 'baan').replace(/[^\w\- ]+/g, '') + '.marbletycoon.json' });
            document.body.append(a); a.click(); a.remove();
          }),
        ),
      ),
      sectie('Baan laden',
        importVeld,
        el('div', { klasse: 'knoppenrij' },
          knop('Laad code', 'map', async () => { try { laadData(await leesDeelcode(importVeld.value)); } catch (e) { ui.toast(e.message || 'Ongeldige code', 'fout'); } }),
          knop('Open bestand', 'map', () => bestandInvoer.click()),
          bestandInvoer,
        ),
      ),
    ), { klasse: 'breed' });
  }

  // ---------------------------------------------------------------- community

  const comm = { sort: 'nieuw', q: '', offset: 0 };
  function communityVenster() {
    const raster = el('div', { klasse: 'banenraster' });
    const meer = knop('Meer laden', null, () => laad(true));
    const zoek = el('input', { type: 'search', placeholder: 'Zoek op naam of maker', value: comm.q, maxlength: 40 });
    let zoekTimer = 0;
    zoek.addEventListener('input', () => { clearTimeout(zoekTimer); zoekTimer = setTimeout(() => { comm.q = zoek.value; laad(false); }, 350); });
    const sorteer = el('div', { klasse: 'segment' }, ...[['nieuw', 'Nieuwste'], ['populair', 'Populair'], ['gebruikt', 'Meest gebruikt'], ['mijn', 'Mijn gedeelde']].map(([id, n]) =>
      el('button', { klasse: 'seg' + (comm.sort === id ? ' actief' : ''), type: 'button', onclick: (e) => { geluid.klik(); comm.sort = id; sorteer.querySelectorAll('.seg').forEach((b) => b.classList.remove('actief')); e.currentTarget.classList.add('actief'); laad(false); } }, n)));
    async function laad(erbij) {
      if (!erbij) { comm.offset = 0; raster.replaceChildren(el('p', { klasse: 'leeg', tekst: 'Laden…' })); }
      try {
        const ids = comm.sort === 'mijn' ? Object.keys(mijnGedeeld()).join(',') : '';
        if (comm.sort === 'mijn' && !ids) { raster.replaceChildren(el('p', { klasse: 'leeg', tekst: 'Je hebt nog niets gedeeld. Gebruik "Delen" bovenin.' })); meer.hidden = true; return; }
        const r = await community.lijst({ sort: comm.sort === 'mijn' ? 'nieuw' : comm.sort, q: comm.q, offset: comm.offset, ids: ids || '' });
        if (!erbij) raster.replaceChildren();
        if (!r.banen.length && !erbij) raster.append(el('p', { klasse: 'leeg', tekst: 'Nog geen banen gevonden.' }));
        for (const b of r.banen) raster.append(communityKaart(b));
        comm.offset += r.banen.length;
        meer.hidden = !r.meer;
      } catch (e) {
        raster.replaceChildren(el('p', { klasse: 'leeg fout', tekst: e.message }));
        meer.hidden = true;
      }
    }
    openModal('Community', el('div', { klasse: 'community' }, el('div', { klasse: 'communitybalk' }, sorteer, zoek), raster, el('div', { klasse: 'midden' }, meer)), { klasse: 'breed' });
    laad(false);
  }

  function communityKaart(b) {
    return el('button', { klasse: 'baankaart klikbaar', type: 'button', onclick: () => communityDetail(b.id) },
      b.heeftThumb ? el('img', { src: community.thumbUrl(b.id, b.bijgewerkt), alt: '', loading: 'lazy' }) : el('div', { klasse: 'geenbeeld' }),
      el('div', { klasse: 'baaninfo' },
        el('b', { tekst: b.naam }),
        el('small', { tekst: (b.maker ? 'door ' + b.maker + ' · ' : '') + `${b.stukken} stukken` }),
        el('small', { klasse: 'tellers' }, icoon('hart', b.geliked ? 'rood' : ''), ` ${b.likes}  ·  ${b.gebruikt}× gebruikt`),
      ),
    );
  }

  async function communityDetail(id) {
    openModal('Community', el('p', { klasse: 'leeg', tekst: 'Laden…' }), { klasse: 'breed' });
    let b;
    try { b = (await community.haal(id)).baan; } catch (e) { openModal('Community', el('p', { klasse: 'leeg fout', tekst: e.message })); return; }
    const gedeeld = mijnGedeeld();
    const eigen = gedeeld[id];
    const likeKnop = el('button', { klasse: 'knop' + (b.geliked ? ' actief' : ''), type: 'button', onclick: async () => {
      try { const r = await community.like(id); b.likes = r.likes; b.geliked = r.geliked; likeKnop.classList.toggle('actief', r.geliked); likeTekst.textContent = ` ${r.likes}`; geluid.klik(); } catch (e) { ui.toast(e.message, 'fout'); }
    } }, icoon('hart'));
    const likeTekst = el('span', { klasse: 'label', tekst: ` ${b.likes}` });
    likeKnop.append(likeTekst);
    const link = location.origin + location.pathname + '?baan=' + id;
    openModal(b.naam, el('div', { klasse: 'detail' },
      b.heeftThumb ? el('img', { klasse: 'grootbeeld', src: community.thumbUrl(b.id, b.bijgewerkt), alt: '' }) : null,
      el('div', { klasse: 'detailinfo' },
        el('p', { klasse: 'sub', tekst: (b.maker ? 'Gemaakt door ' + b.maker : 'Maker onbekend') + ' · ' + new Date(b.gemaakt).toLocaleDateString('nl-NL') }),
        b.beschrijving ? el('p', { tekst: b.beschrijving }) : null,
        el('p', { klasse: 'sub', tekst: `${b.stukken} stukken · ${b.decor} decorstukken · ${b.knikkers} knikkers · ${b.gebruikt}× gebruikt` }),
        el('div', { klasse: 'knoppenrij' },
          knop('Gebruik deze baan', 'speel', () => {
            const d = b.data;
            d.gebaseerdOp = { naam: b.naam, maker: b.maker, id: b.id };
            if (!eigen) delete d.gedeeldId;
            acties.nieuwId();
            acties.zetBaan(d);
            if (eigen) app.baan.gedeeldId = id;
            acties.focusBaan();
            community.gebruikt(id).catch(() => {});
            sluitModal();
            ui.toast(`"${b.naam}" geladen. Veel plezier!`, 'goed');
          }, { klasse: 'primair' }),
          likeKnop,
          knop('Kopieer link', 'kopieer', () => navigator.clipboard?.writeText(link).then(() => ui.toast('Link gekopieerd', 'goed')).catch(() => {})),
        ),
        eigen ? el('div', { klasse: 'knoppenrij' },
          knop('Verwijder uit community', 'prullenbak', async () => {
            if (!confirm('Weet je zeker dat je deze baan uit de community haalt?')) return;
            try { await community.verwijder(id, eigen.sleutel); vergeetGedeeld(id); sluitModal(); ui.toast('Verwijderd uit de community', 'goed'); } catch (e) { ui.toast(e.message, 'fout'); }
          }, { klasse: 'gevaar' }),
        ) : null,
      ),
    ), { klasse: 'breed' });
  }
  ui.openCommunityBaan = (id) => { if (/^[a-z0-9]{6,12}$/.test(id)) communityDetail(id); };

  // ---------------------------------------------------------------- instellingen

  function instellingenVenster() {
    const i = app.inst;
    const zet = (k, v) => { i[k] = v; acties.pasInstellingenToe(); };
    const vink = (k, tekst) => el('label', { klasse: 'vinkje' }, el('input', { type: 'checkbox', checked: !!i[k], onchange: (e) => zet(k, e.target.checked) }), tekst);
    const keuze = (k, opties) => el('div', { klasse: 'segment' }, ...opties.map(([w, n]) => el('button', { klasse: 'seg' + (i[k] === w ? ' actief' : ''), type: 'button', onclick: (e) => { zet(k, w); e.currentTarget.parentNode.querySelectorAll('.seg').forEach((b) => b.classList.remove('actief')); e.currentTarget.classList.add('actief'); } }, n)));
    const volLabel = el('span', { klasse: 'waarde', tekst: Math.round(i.volume * 100) + '%' });
    openModal('Instellingen', el('div', { klasse: 'instellingen' },
      sectie('Geluid',
        vink('geluid', 'Geluid aan'),
        el('label', { klasse: 'schuif' }, 'Volume', el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: i.volume, oninput: (e) => { zet('volume', Number(e.target.value)); volLabel.textContent = Math.round(i.volume * 100) + '%'; } }), volLabel),
        vink('bouwGeluid', 'Geluiden tijdens het bouwen'),
        vink('spelGeluid', 'Geluiden van de knikkers'),
        vink('uiGeluid', 'Klikjes in het menu'),
      ),
      sectie('Beeld',
        vink('schaduw', 'Schaduwen'),
        vink('raster', 'Raster tonen tijdens het bouwen'),
        el('div', { klasse: 'veld' }, 'Kwaliteit', keuze('kwaliteit', [['laag', 'Laag'], ['normaal', 'Normaal'], ['hoog', 'Hoog']])),
        el('div', { klasse: 'veld' }, 'Achtergrond', keuze('sfeer', [['nacht', 'Nacht'], ['diepzee', 'Diepzee'], ['paars', 'Schemer'], ['grafiet', 'Grafiet']])),
      ),
      sectie('Camera',
        el('label', { klasse: 'schuif' }, 'Snelheid', el('input', { type: 'range', min: 0.4, max: 2, step: 0.1, value: i.camSnelheid, oninput: (e) => zet('camSnelheid', Number(e.target.value)) })),
        vink('camOmgekeerd', 'Draaien omkeren'),
      ),
      sectie('Jij',
        el('label', { klasse: 'veld' }, 'Bouwersnaam (voor de community)', el('input', { value: i.bouwer || '', maxlength: 24, oninput: (e) => { i.bouwer = e.target.value; opslag.schrijf('instellingen', i); } })),
      ),
    ));
  }

  function hulpVenster() {
    const r = (a, b) => el('tr', {}, el('td', {}, el('kbd', { tekst: a })), el('td', { tekst: b }));
    openModal('Besturing', el('div', { klasse: 'hulp' },
      el('table', {},
        r('Rechts slepen', 'Camera draaien en kantelen'),
        r('Links slepen', 'Camera schuiven'),
        r('Scrollwiel', 'Zoomen'),
        r('W A S D', 'Camera schuiven'),
        r('Q / E', 'Camera draaien'),
        r('Enter', 'Stuk bouwen'),
        r('Backspace', 'Laatste of gekozen stuk weghalen'),
        r('R', 'Decor of startpunt draaien'),
        r('Page Up/Down', 'Decor of hele baan hoger/lager'),
        r('Ctrl+Z / Ctrl+Y', 'Ongedaan maken / opnieuw'),
        r('Esc', 'Stoppen met plaatsen'),
        r('P', 'Spelen'),
        r('Spatie', 'Pauze (in de speelmodus)'),
      ),
      el('p', { klasse: 'uitleg', tekst: 'Het raster werkt zoals in RollerCoaster Tycoon: elk stuk sluit aan op een open einde (groene pijl). Van vlak naar steil gaat altijd via een lichte helling. Haal je een stuk uit het midden weg, dan ontstaat er een gat: knikkers vliegen daar van de baan en kunnen op een stuk eronder landen.' }),
    ));
  }

  ui.start = () => {
    bouwPaneel();
    ui.werkBij();
    if (!opslag.lees('welkom', false)) {
      opslag.schrijf('welkom', true);
      openModal('Welkom bij Marble Tycoon', el('div', {},
        el('p', { tekst: 'Bouw je eigen knikkerbaan op het raster. Begin met een startpunt en bouw daarna verder met bochten, hellingen, liften, loopings, kurkentrekkers, aquariums, vuur, boosters en launchtunnels.' }),
        el('p', { tekst: 'Kies "Spelen" om de knikkers te laten rollen of "Race" om met vrienden te racen met je telefoon als afstandsbediening.' }),
        el('div', { klasse: 'knoppenrij rechts' }, knop('Besturing bekijken', 'hulp', () => hulpVenster()), knop('Aan de slag', 'hamer', () => sluitModal(), { klasse: 'primair' })),
      ));
    }
  };

  void kiesTool;
  ui.el = el;
  ui.knop = knop;
  ui.icoon = icoon;
  ui.kiesPaneel = kiesPaneel;
  return ui;
}
