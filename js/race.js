// Multiplayer race (host). Het hostscherm maakt een kamer aan, toont een QR-code en
// laat de knikkers rijden. Telefoons sturen gas; de host stuurt stand, snelheid en "gevaar" terug.

import * as THREE from '../lib/three.min.js';
import qrcode from '../lib/qrcode.min.js';
import { KMU } from './config.js';
import { SKIN_MAP } from './knikkers.js';
import { skinIkoon } from './ikonen.js';
import { geluid } from './geluid.js';

const LABEL_KLEUREN = ['#ff5d5d', '#4fa3ff', '#7ed957', '#f8d84a', '#c77dff', '#ff9f43', '#3ccfe0', '#ff6fb5', '#b8e34d', '#e8c99b', '#8b95a5', '#f4f1ea'];

export class RaceHost {
  constructor(app, deps) {
    this.app = app;
    this.d = deps;
    this.spelers = new Map();
    this.fase = 'lobby';
    this.rondes = 2;
    this.ws = null;
    this.code = null;
    this.statusT = 0;
    this.standT = 0;
    this.camModus = 'leider';
    this.autoStartT = null;
    this.labels = document.getElementById('labels');
  }

  // ---------------------------------------------------------------- verbinding

  open() {
    this.fase = 'lobby';
    this.bouwUI();
    this.verbind();
  }

  verbind() {
    if (this.ws) { try { this.ws.close(); } catch { /* */ } }
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    let ws;
    try { ws = new WebSocket(url); } catch { this.zetStatus('Kan geen verbinding maken met de server.', true); return; }
    this.ws = ws;
    this.zetStatus('Verbinden met de server…');
    ws.onopen = () => {
      let oud = null;
      try { oud = JSON.parse(sessionStorage.getItem('marbletycoon.racekamer') || 'null'); } catch { /* */ }
      ws.send(JSON.stringify({ t: 'maak', code: oud?.code, sleutel: oud?.sleutel }));
    };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      this.bericht(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.app.modus === 'race') {
        this.zetStatus('Verbinding verbroken. Opnieuw verbinden…', true);
        setTimeout(() => { if (this.app.modus === 'race' && !this.ws) this.verbind(); }, 2000);
      }
    };
  }

  stuur(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  naar(id, d) { this.stuur({ t: 'naar', id, d }); }
  allen(d) { this.stuur({ t: 'allen', d }); }

  bericht(m) {
    switch (m.t) {
      case 'kamer':
        this.code = m.code;
        try { sessionStorage.setItem('marbletycoon.racekamer', JSON.stringify({ code: m.code, sleutel: m.sleutel })); } catch { /* */ }
        this.toonQR();
        this.zetStatus('Scan de QR-code met je telefoon om mee te doen.');
        break;
      case 'speler': {
        let sp = this.spelers.get(m.id);
        if (!sp) {
          sp = { id: m.id, naam: m.naam, skin: m.skin, klaar: false, verbonden: true, gas: 0, kleur: LABEL_KLEUREN[this.spelers.size % LABEL_KLEUREN.length] };
          this.spelers.set(m.id, sp);
          geluid.aansluiten();
        }
        sp.naam = m.naam; sp.skin = SKIN_MAP.has(m.skin) ? m.skin : 'kattenoog'; sp.verbonden = m.verbonden !== false;
        this.naar(sp.id, { t: 'kleur', kleur: sp.kleur, fase: this.fase === 'race' ? 'race' : 'lobby' });
        if (this.fase === 'race' && sp.kn) this.naar(sp.id, { t: 'go' });
        this.werkLobbyBij();
        break;
      }
      case 'speler_weg': {
        const sp = this.spelers.get(m.id);
        if (sp) { sp.verbonden = false; sp.gas = 0; sp.klaar = false; }
        this.werkLobbyBij();
        break;
      }
      case 'van': {
        const sp = this.spelers.get(m.id);
        if (!sp) return;
        const d = m.d || {};
        if (d.t === 'gas') sp.gas = Math.min(1, Math.max(0, Number(d.w) || 0));
        else if (d.t === 'klaar') { sp.klaar = !!d.klaar; this.werkLobbyBij(); if (sp.klaar) geluid.klik(); }
        break;
      }
      case 'overgenomen':
        this.zetStatus('Deze race is in een ander venster geopend.', true);
        this.ws = null;
        break;
      case 'fout':
        this.zetStatus(m.melding || 'Er ging iets mis.', true);
        break;
      default:
    }
  }

  // ---------------------------------------------------------------- scherm

  bouwUI() {
    const { el, knop, icoon } = this.d.ui;
    document.getElementById('race')?.remove();
    this.qr = el('div', { klasse: 'qr' }, el('div', { klasse: 'qrleeg', tekst: '…' }));
    this.codeVak = el('div', { klasse: 'kamercode', tekst: '····' });
    this.linkVak = el('div', { klasse: 'kamerlink' });
    this.spelerLijst = el('div', { klasse: 'spelerlijst' });
    this.statusVak = el('p', { klasse: 'racestatus' });
    this.startKnop = knop('Start de race', 'vlag', () => this.start(), { klasse: 'primair groot' });
    const rondeKeuze = el('div', { klasse: 'segment' }, ...[1, 2, 3, 5].map((n) => el('button', { klasse: 'seg' + (n === this.rondes ? ' actief' : ''), type: 'button', onclick: (e) => { this.rondes = n; rondeKeuze.querySelectorAll('.seg').forEach((b) => b.classList.remove('actief')); e.currentTarget.classList.add('actief'); geluid.klik(); } }, n === 1 ? '1 ronde' : n + ' rondes')));
    this.lobby = el('div', { klasse: 'racelobby paneel-glas' },
      el('div', { klasse: 'lobbykop' }, icoon('vlag'), el('h2', { tekst: 'Race' })),
      el('div', { klasse: 'lobbyrij' },
        el('div', { klasse: 'qrvak' }, this.qr, el('p', { klasse: 'sub', tekst: 'Scan om mee te doen' }), this.codeVak, this.linkVak),
        el('div', { klasse: 'lobbyrechts' },
          el('h3', { tekst: 'Spelers' }), this.spelerLijst,
          el('h3', { tekst: 'Aantal rondes' }), rondeKeuze,
          this.statusVak, this.startKnop,
          el('p', { klasse: 'uitleg', tekst: 'Iedereen bestuurt zijn eigen knikker met de gashendel op de telefoon. Te snel in een bocht of over een bult? Dan vlieg je eruit en word je teruggezet. Je telefoon trilt als het spannend wordt.' }),
        ),
      ),
    );
    this.stand = el('div', { klasse: 'racestand paneel-glas', hidden: true });
    this.aftel = el('div', { klasse: 'aftellen', hidden: true });
    this.uitslag = el('div', { klasse: 'uitslag paneel-glas', hidden: true });
    this.raceKnoppen = el('div', { klasse: 'raceknoppen paneel-glas', hidden: true },
      knop('Volg leider', 'oog', () => { this.camModus = 'leider'; this.werkKnoppenBij(); }),
      knop('Overzicht', 'baan', () => { this.camModus = 'vrij'; this.d.cam.volg = null; this.werkKnoppenBij(); }),
      knop('Stop race', 'sluit', () => this.naarLobby()),
    );
    this.wortel = el('div', { id: 'race' }, this.lobby, this.stand, this.aftel, this.uitslag, this.raceKnoppen);
    document.getElementById('ui').append(this.wortel);
    this.werkLobbyBij();
  }

  werkKnoppenBij() {
    const [a, b] = this.raceKnoppen.querySelectorAll('.knop');
    a.classList.toggle('actief', this.camModus === 'leider');
    b.classList.toggle('actief', this.camModus === 'vrij');
  }

  toonQR() {
    const url = location.origin + location.pathname.replace(/[^/]*$/, '') + 'bediening.html?k=' + this.code;
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const img = new Image();
    img.src = qr.createDataURL(6, 2);
    img.alt = 'QR-code om mee te doen';
    this.qr.replaceChildren(img);
    this.codeVak.textContent = this.code;
    this.linkVak.textContent = url.replace(/^https?:\/\//, '');
  }

  zetStatus(t, fout) {
    if (!this.statusVak) return;
    this.statusVak.textContent = t;
    this.statusVak.classList.toggle('fout', !!fout);
  }

  werkLobbyBij() {
    if (!this.spelerLijst) return;
    const { el } = this.d.ui;
    const lijst = [...this.spelers.values()];
    this.spelerLijst.replaceChildren(...(lijst.length ? lijst.map((sp) => {
      const img = el('img', { klasse: 'skinbol', alt: '' });
      skinIkoon(sp.skin).then((u) => { img.src = u; });
      return el('div', { klasse: 'speler' + (sp.verbonden ? '' : ' weg') },
        img,
        el('span', { klasse: 'spelernaam', stijl: `border-color:${sp.kleur}`, tekst: sp.naam }),
        el('span', { klasse: 'klaar ' + (sp.klaar ? 'ja' : 'nee'), tekst: !sp.verbonden ? 'weg' : sp.klaar ? 'Klaar' : 'wacht…' }),
        el('button', { klasse: 'mini-knop', type: 'button', title: 'Verwijderen', onclick: () => { this.stuur({ t: 'kick', id: sp.id }); this.spelers.delete(sp.id); this.werkLobbyBij(); } }, '✕'),
      );
    }) : [el('p', { klasse: 'leeg', tekst: 'Nog niemand. Scan de QR-code!' })]));
    const actief = lijst.filter((s) => s.verbonden);
    const allemaalKlaar = actief.length > 0 && actief.every((s) => s.klaar);
    this.startKnop.disabled = !actief.length;
    if (this.fase === 'lobby') {
      if (allemaalKlaar && !this.autoStartT) {
        this.autoStartT = setTimeout(() => { this.autoStartT = null; if (this.fase === 'lobby') this.start(); }, 2500);
        this.zetStatus('Iedereen is klaar. De race begint zo!');
      } else if (!allemaalKlaar) {
        if (this.autoStartT) { clearTimeout(this.autoStartT); this.autoStartT = null; }
        if (this.code) this.zetStatus(actief.length ? 'Wachten tot iedereen op Klaar drukt (of start zelf).' : 'Scan de QR-code met je telefoon om mee te doen.');
      }
    }
  }

  // ---------------------------------------------------------------- race

  start() {
    if (this.autoStartT) { clearTimeout(this.autoStartT); this.autoStartT = null; }
    const actief = [...this.spelers.values()].filter((s) => s.verbonden);
    if (!actief.length) { this.d.melding('Er doet nog niemand mee.', 'fout'); return; }
    const keten = this.app.info.ketens[0];
    if (!keten || !keten.start || keten.stukken.length < 3) { this.d.melding('Bouw eerst een langere baan vanaf het startpunt.', 'fout'); return; }
    this.fase = 'race';
    for (const sp of this.spelers.values()) { sp.gas = 0; sp.kn = null; sp.plek = 0; }
    this.d.startRace(actief, this.rondes);
    for (const kn of this.d.sim.knikkers) kn.speler.kn = kn;
    this.lobby.hidden = true;
    this.uitslag.hidden = true;
    this.stand.hidden = false;
    this.raceKnoppen.hidden = false;
    this.camModus = 'leider';
    this.werkKnoppenBij();
    this.d.cam.afstand = 16;
    this.maakLabels();
    this.allen({ t: 'aftel', n: 3, rondes: this.rondes });
    this.toonAftel('3');
  }

  toonAftel(t) {
    this.aftel.hidden = false;
    this.aftel.textContent = t;
    this.aftel.classList.remove('pop');
    void this.aftel.offsetWidth;
    this.aftel.classList.add('pop');
    clearTimeout(this.aftelT);
    this.aftelT = setTimeout(() => { this.aftel.hidden = true; }, t === 'GO!' ? 900 : 1100);
  }

  gebeurtenis(soort, kn, extra) {
    const sp = kn && kn.speler;
    switch (soort) {
      case 'aftel': this.toonAftel(String(extra)); this.allen({ t: 'aftel', n: extra, rondes: this.rondes }); break;
      case 'go': this.toonAftel('GO!'); this.allen({ t: 'go' }); break;
      case 'eruit': if (sp) this.naar(sp.id, { t: 'eruit' }); break;
      case 'terug': if (sp) this.naar(sp.id, { t: 'terug' }); break;
      case 'ronde': if (sp) this.naar(sp.id, { t: 'ronde', ronde: kn.ronde + 1, tijd: extra }); break;
      case 'raceFinish':
        if (sp) this.naar(sp.id, { t: 'finish', plek: extra, tijd: kn.finishTijd });
        geluid.finish();
        break;
      case 'raceKlaar': this.toonUitslag(); break;
      default:
    }
  }

  maakLabels() {
    this.labels.replaceChildren();
    for (const kn of this.d.sim.knikkers) {
      const sp = kn.speler;
      const div = document.createElement('div');
      div.className = 'naamlabel';
      div.style.setProperty('--kleur', sp.kleur);
      const plek = document.createElement('b');
      const naam = document.createElement('span');
      naam.textContent = sp.naam;
      div.append(plek, naam);
      this.labels.append(div);
      kn.label = div;
      kn.labelPlek = plek;
    }
  }

  frame(dt) {
    if (this.fase !== 'race' && this.fase !== 'uitslag') return;
    const sim = this.d.sim;
    const cam = this.d.wereld.camera;
    const r = this.d.wereld.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    const stand = sim.stand();
    stand.forEach((kn, i) => { kn.plek = i + 1; });
    for (const kn of sim.knikkers) {
      if (!kn.label) continue;
      v.copy(kn.pos); v.y += 0.42;
      v.project(cam);
      const zicht = v.z < 1 && kn.toestand !== 'wacht' && kn.toestand !== 'uit';
      kn.label.style.display = zicht ? '' : 'none';
      if (zicht) kn.label.style.transform = `translate(${((v.x * 0.5 + 0.5) * r.width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * r.height).toFixed(1)}px) translate(-50%, -100%)`;
      kn.labelPlek.textContent = kn.plek;
      kn.label.classList.toggle('gevaar', kn.gevaar > 0.8);
    }
    if (this.camModus === 'leider' && stand.length) {
      const leider = stand.find((k) => !k.gefinisht && (k.toestand === 'baan' || k.toestand === 'vrij')) || stand[0];
      this.d.cam.volg = () => leider.pos;
    }
    this.statusT += dt;
    if (this.statusT > 0.08) {
      this.statusT = 0;
      for (const kn of sim.knikkers) {
        const sp = kn.speler;
        this.naar(sp.id, { t: 'status', plek: kn.plek, van: stand.length, ronde: Math.min(kn.ronde + 1, sim.race?.rondes || 1), rondes: sim.race?.rondes || 1, v: Math.round(Math.abs(kn.v) * KMU), g: Math.round(Math.min(1.5, kn.gevaar) * 100) / 100, uit: kn.toestand === 'vrij' });
      }
    }
    this.standT += dt;
    if (this.standT > 0.25) { this.standT = 0; this.werkStandBij(stand); }
  }

  werkStandBij(stand) {
    const { el } = this.d.ui;
    const sim = this.d.sim;
    const rondes = sim.race?.rondes || 1;
    this.stand.replaceChildren(
      el('h3', { tekst: sim.race?.fase === 'aftellen' ? 'Klaar voor de start…' : `Stand · ${rondes === 1 ? '1 ronde' : rondes + ' rondes'}` }),
      ...stand.map((kn, i) => el('div', { klasse: 'standregel' + (kn.gefinisht ? ' binnen' : '') + (kn.toestand === 'vrij' ? ' eruit' : '') },
        el('b', { klasse: 'plek', tekst: i + 1 }),
        el('span', { klasse: 'spelernaam', stijl: `border-color:${kn.speler.kleur}`, tekst: kn.speler.naam }),
        el('span', { klasse: 'rondeinfo', tekst: kn.gefinisht ? formatTijd(kn.finishTijd) : kn.toestand === 'vrij' ? 'eruit!' : `R${Math.min(kn.ronde + 1, rondes)} · ${Math.round(Math.abs(kn.v) * KMU)} km/u` }),
      )),
    );
  }

  toonUitslag() {
    const { el, knop } = this.d.ui;
    this.fase = 'uitslag';
    const stand = this.d.sim.stand();
    const lijst = stand.map((kn, i) => ({ plek: i + 1, naam: kn.speler.naam, tijd: kn.gefinisht ? kn.finishTijd : null, beste: kn.besteRonde < Infinity ? kn.besteRonde : null, eruit: kn.uitgevlogen }));
    this.allen({ t: 'uitslag', lijst });
    this.uitslag.replaceChildren(
      el('h2', { tekst: 'Uitslag' }),
      el('div', { klasse: 'podium' }, ...lijst.slice(0, 3).map((r) => el('div', { klasse: 'podiumplek p' + r.plek }, el('div', { klasse: 'podiumnaam', tekst: r.naam }), el('div', { klasse: 'podiumblok', tekst: r.plek })))),
      el('table', { klasse: 'uitslaglijst' }, ...lijst.map((r) => el('tr', {}, el('td', { tekst: r.plek + '.' }), el('td', { tekst: r.naam }), el('td', { tekst: r.tijd !== null ? formatTijd(r.tijd) : '—' }), el('td', { tekst: r.beste !== null ? 'snelste ronde ' + formatTijd(r.beste) : '' }), el('td', { tekst: r.eruit ? r.eruit + '× eruit' : '' })))),
      el('div', { klasse: 'knoppenrij' }, knop('Nog een race', 'vlag', () => this.naarLobby(true), { klasse: 'primair' }), knop('Terug naar lobby', 'community', () => this.naarLobby())),
    );
    this.uitslag.hidden = false;
  }

  naarLobby(meteen) {
    this.fase = 'lobby';
    this.d.sim.stopRace();
    this.labels.replaceChildren();
    for (const sp of this.spelers.values()) { sp.klaar = !!meteen && sp.verbonden; sp.gas = 0; sp.kn = null; }
    this.allen({ t: 'lobby', klaar: !!meteen });
    this.lobby.hidden = false;
    this.stand.hidden = true;
    this.uitslag.hidden = true;
    this.raceKnoppen.hidden = true;
    this.aftel.hidden = true;
    this.d.cam.volg = null;
    this.werkLobbyBij();
    if (meteen) this.start();
  }

  klik() {}

  stop() {
    if (this.autoStartT) { clearTimeout(this.autoStartT); this.autoStartT = null; }
    this.allen({ t: 'einde' });
    const ws = this.ws;
    this.ws = null;
    if (ws) setTimeout(() => { try { ws.close(); } catch { /* */ } }, 100);
    this.d.sim.stopRace();
    this.labels.replaceChildren();
    this.wortel?.remove();
    this.d.cam.volg = null;
    this.fase = 'lobby';
  }
}

function formatTijd(s) {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return (m ? m + ':' + (r < 10 ? '0' : '') : '') + r.toFixed(2) + (m ? '' : ' s');
}
