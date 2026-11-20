// World assembly: build the city and everyone in it for a fresh run, or
// rebuild it around a save game. main.js calls this for real games and
// shots.js calls it for the screenshot scenes, so both see the same city.
import { G } from './state.js';
import { DAY_START_MIN } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { createPlayer } from './player.js';
import { spawnTraffic, spawnParked } from './vehicles.js';
import { spawnPeds } from './pedestrians.js';

export const SPAWN = { x: 330, y: 1308 };

export function buildWorld(seed, save = null) {
  const rng = makeRng(seed);
  G.seed = seed;
  G.rng = rng;
  G.city = buildCity(rng);
  G.time = 0;
  G.clockMin = save && typeof save.clockMin === 'number' ? save.clockMin : DAY_START_MIN;
  G.heat = 0;
  G.stars = 0;
  G.bustedMeter = 0;
  G.hurtT = 0;
  G.mission = null;
  G.taxi = null;
  G.dialogue = null;
  G.phoneMsg = null;
  G.banner = null;
  G.marker = null;
  G.objective = '';
  G.officers = [];
  G.pickups = [];
  G.storyDone = false;

  const startX = save ? save.x : SPAWN.x;
  const startY = save ? save.y : SPAWN.y;
  G.player = createPlayer(startX, startY);
  if (save) {
    G.player.weapon = save.weapon || 'fist';
    G.player.ammo = save.ammo || 0;
    if (save.weapon === 'pistol') G.stats.ammoEver = true;
  }
  G.money = save ? save.money : 250;
  G.missionsDone = save ? save.missionsDone || 0 : 0;
  G.stats.packagesFound = save ? save.packagesFound || 0 : 0;
  G.stats.faresDone = save ? save.faresDone || 0 : 0;
  if (save && Array.isArray(save.packagesTaken)) {
    for (const pkg of G.city.packages) pkg.taken = save.packagesTaken.includes(pkg.id);
  }
  G.storyDone = G.missionsDone >= 6;

  G.cars = [...spawnTraffic(rng, 26), ...spawnParked(rng, 30)];
  G.peds = spawnPeds(rng, 34);
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  return G;
}
