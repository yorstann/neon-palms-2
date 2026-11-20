// Neon Palms — tuning numbers, colours and city dimensions in one place.
// The view is a fixed 1280x720 logical frame; the page scales it to the window,
// so no rule below depends on the player's screen size.

export const VIEW_W = 1280;
export const VIEW_H = 720;

/** The simulation's fixed step, in seconds: 60 updates a second at any refresh rate. */
export const STEP = 1 / 60;

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 120;
/** Centre lines of the avenues (west-east traffic uses ROADS_Y, north-south ROADS_X). */
export const ROADS_X = [500, 1000, 1500, 2000, 2500, 3000];
export const ROADS_Y = [400, 900, 1400, 1900];
export const WATER_X = 120; // west of this line is open bay
export const BEACH_X = 252; // the sand strip between the water and the first street

export const PLAYER_R = 13;
export const WALK_SPEED = 178;
export const RUN_SPEED = 292;

export const DAY_START_MIN = 10 * 60; // a new game starts at 10:00
export const MIN_PER_SEC = 3;         // game minutes passing per real second
export const HEAT_MAX = 600;          // wanted heat that tops out the stars
export const HEAT_PER_STAR = 120;
export const SPRAY_COST = 300;
export const PACKAGE_COUNT = 20;
export const SAVE_KEY = 'neon-palms.save.v1';

export const PALETTE = {
  water: '#1a6a8a',
  waterDeep: '#12506b',
  sand: '#eed49e',
  sandWet: '#e0c48d',
  sidewalk: '#c9c1af',
  grass: '#7cab5e',
  grassDark: '#6d9c52',
  concrete: '#a4a9ab',
  dirt: '#ab9164',
  pavers: '#d8b48f',
  asphalt: '#3d4149',
  asphaltEdge: '#33373e',
  lane: '#e9e4d2',
  laneYellow: '#e8c766',
  crosswalk: '#d9d9d2',
};

/** Roof colours by district, picked per building by the city generator. */
export const ROOF_COLORS = {
  Downtown: ['#5f7f9e', '#546e8a', '#6d8dab', '#4d647c', '#71879b'],
  'Palm Beach': ['#e8e0cc', '#eed9b7', '#e5cfa5', '#f0e6d2', '#e9d3ae'],
  Marina: ['#c96f4a', '#d08357', '#b85f3d', '#cf7a52', '#bd6a45'],
  Industrial: ['#8d8578', '#7c766a', '#968d7d', '#847d70', '#797165'],
  Suburbs: ['#b0563f', '#a34f3a', '#bd6248', '#9c4a36', '#b25a41'],
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }
export function dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; }

/** Wrap an angle to (-PI, PI]. */
export function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Turn from angle `a` toward `b` by at most `maxStep` radians. */
export function turnToward(a, b, maxStep) {
  const d = normAngle(b - a);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

export function fmtMoney(n) {
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function fmtClock(clockMin) {
  const m = ((Math.floor(clockMin) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return hh + ':' + mm;
}
