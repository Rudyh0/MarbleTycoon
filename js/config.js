// Vaste maten en instellingen van Marble Tycoon.
// Eenheden: 1 wereld-eenheid = 1 meter. Een tegel is 2 x 2 meter, een hoogtestap 0,5 meter.

export const TEGEL = 2;
export const NIVEAU = 0.5;
export const RASTER = 24;            // tegels vanaf het midden in elke richting (48 x 48 tegels)
export const MAX_NIVEAU = 60;
export const MIN_START = 2;

export const KNIKKER_R = 0.15;       // straal van een knikker
export const GOOT_R = 0.24;          // binnenstraal van de goot
export const BUIS_R = 0.3;           // straal van de glazen buis

export const ZWAARTEKRACHT = 9.81;
export const ROL_FACTOR = 5 / 7;     // massieve bol die rolt: 5/7 van de zwaartekracht
export const ROLWEERSTAND = 0.012;
export const LUCHTWEERSTAND = 0.006;
export const BOCHTWRIJVING = 0.012;

export const MAX_KNIKKERS = 60;

export const KLEUREN = [
  '#e74c3c', '#ff7a45', '#f5a623', '#f8d84a', '#b8e34d', '#5cc96b',
  '#2fb59a', '#3ccfe0', '#4fa3ff', '#3f6fd8', '#6d5bd0', '#a35bd6',
  '#e35fb0', '#ff9fc1', '#f4f1ea', '#c9ced6', '#8b95a5', '#4a5260',
  '#2b2f36', '#8a5a3c', '#c58b52', '#e8c99b', '#1f7a5a', '#7a1f2b',
];

export const STANDAARD_KLEUR = '#4fa3ff';
export const STANDAARD_STEUN = '#c9ced6';

export const KMU = 3.6;              // m/s naar km/u

// Hellingstanden zoals in RollerCoaster Tycoon: steil omlaag, licht omlaag, vlak, licht omhoog, steil omhoog.
// Waarde = stijging per meter. Van vlak naar steil kan alleen via licht (overgangsstukken gaan vanzelf).
export const HELLING = { '-2': -1.5, '-1': -0.5, '0': 0, '1': 0.5, '2': 1.5 };
export const HELLING_NAAM = { '-2': 'Steil omlaag', '-1': 'Omlaag', '0': 'Vlak', '1': 'Omhoog', '2': 'Steil omhoog' };

export const EFFECT_STANDAARD = {
  lift: 9,      // km/u
  boost: 32,
  rem: 8,
  launch: 45,
};

export const EFFECT_BEREIK = {
  lift: [3, 25],
  boost: [10, 90],
  rem: [2, 40],
  launch: [10, 120],
};
