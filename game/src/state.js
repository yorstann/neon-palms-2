// G is the one shared game state every module reads and writes: the mode
// machine, the city, the actors, the wanted heat, the mission, the camera.
// Keeping it in a module of its own (importing nothing but constants) is
// what lets the other modules cooperate without circular imports.
import { DAY_START_MIN } from './config.js';

export const G = {
  mode: 'title', // title | play | pause | busted | wasted | help
  menuSel: 0,
  time: 0,
  clockMin: DAY_START_MIN,
  seed: 1,
  rng: null,
  city: null,

  player: null,
  cars: [],
  peds: [],
  officers: [],
  pickups: [],

  money: 250,
  heat: 0,
  stars: 0,
  lastCrimeAt: -100,
  lastCrimePos: null,
  bustedMeter: 0,
  hurtT: 0,
  threat: null, // {x, y, until} — a scare that pedestrians run from

  camera: { x: 1600, y: 1200 },
  marker: null,   // {x, y, label} — the world objective beacon
  objective: '',  // the line the HUD shows under the clock
  dialogue: null, // {lines: [{who, text}], idx, onDone}
  phoneMsg: null, // {from, text, ttl}
  banner: null,   // {title, sub, t, dur}
  flags: { interact: false },
  saveDirty: false,
  storyDone: false,

  mission: null,  // active story mission runtime (missions.js)
  missionsDone: 0,
  taxi: null,     // active taxi fare runtime (missions.js)
  stats: { packagesFound: 0, faresDone: 0 },

  sfx: null,      // the Sfx instance, set by main.js once audio unlocks
  overT: 0,       // timer for the busted / wasted screens
  fine: 0,        // what the last bust or wreck cost, shown on the end screen
};

/** Stars for a heat value: 0 below any heat, then one star per HEAT_PER_STAR. */
export function starsForHeat(heat) {
  if (heat <= 0) return 0;
  return Math.min(5, 1 + Math.floor(heat / 120));
}
