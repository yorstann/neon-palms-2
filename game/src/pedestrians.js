// The people of Palmera Bay: they stroll the sidewalks, cross at the
// avenues, run from gunfire and fast cars, and — when one is knocked down
// by a driver the law can see — they are how most crimes get witnessed.
// A pedestrian knocked down drops cash; some carry more than others.
import { G } from './state.js';
import {
  ROAD_W, ROADS_X, ROADS_Y, WORLD_W, WORLD_H, clamp, dist, turnToward,
} from './config.js';
import { resolveCircle } from './city.js';
import { FX } from './effects.js';
import { sfx } from './audio.js';
import { reportCrime } from './police.js';

const SKIN = ['#f2c9a0', '#d9a066', '#a06a38', '#7a4a24', '#ffe0bd'];
const SHIRTS = ['#e8e4da', '#d95f4b', '#4b7fd9', '#59b06a', '#e5b83e', '#9a6bc7', '#e07bab', '#3fb5ac', '#f07f3e'];

export function createPed(x, y, rng) {
  return {
    x, y, angle: rng.range(0, Math.PI * 2),
    speed: 0, walkSpeed: rng.range(52, 84),
    dir: rng.int(0, 3), state: 'walk', // walk | flee | down
    timer: rng.range(1, 4), phase: rng.range(0, 6),
    skin: rng.pick(SKIN), shirt: rng.pick(SHIRTS),
    downT: 0, cash: rng.range(4, 46),
  };
}

export function spawnPedAt(x, y, rng) {
  const ped = createPed(x, y, rng);
  G.peds.push(ped);
  return ped;
}

/** A sidewalk point: just off a random avenue, somewhere along it. */
function sidewalkPoint(rng) {
  if (rng.chance(0.5)) {
    const cx = rng.pick(ROADS_X);
    return { x: cx + rng.sign() * (ROAD_W / 2 + 16), y: rng.range(60, WORLD_H - 60), vertical: true };
  }
  const cy = rng.pick(ROADS_Y);
  return { x: rng.range(330, WORLD_W - 60), y: cy + rng.sign() * (ROAD_W / 2 + 16), vertical: false };
}

export function spawnPeds(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const pt = sidewalkPoint(rng);
    const ped = createPed(pt.x, pt.y, rng);
    ped.dir = pt.vertical ? (rng.chance(0.5) ? 1 : 3) : (rng.chance(0.5) ? 0 : 2);
    peds.push(ped);
  }
  return peds;
}

const DIR_ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

function knockDown(ped, byPlayerCar, hard) {
  ped.state = 'down';
  ped.downT = hard ? 16 : 7;
  ped.speed = 0;
  FX.splashPuff(ped.x, ped.y);
  if (Math.random() < 0.62) {
    G.pickups.push({ kind: 'cash', amount: Math.round(ped.cash), x: ped.x + 14, y: ped.y + 6, t: 0 });
    ped.cash = 0;
  }
  if (byPlayerCar) reportCrime('hitped', ped.x, ped.y);
}

export function updatePeds(dt, rng) {
  const threat = G.threat && G.time < G.threat.until ? G.threat : null;
  for (const ped of G.peds) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0) {
        ped.state = 'walk';
        ped.timer = 1;
      }
      continue;
    }

    // Cars are the real danger: a fast one close by means run, and contact means down.
    let fleeing = false;
    for (const car of G.cars) {
      const d = dist(ped.x, ped.y, car.x, car.y);
      const reach = car.r + 13;
      if (d < reach) {
        if (Math.abs(car.speed) > 55) {
          knockDown(ped, car.driver === 'player', Math.abs(car.speed) > 250);
          if (car.driver === 'player') sfx('crash', 0.5);
        }
        continue;
      }
      if (d < 120 && Math.abs(car.speed) > 215) fleeing = true;
    }
    if (threat && dist(ped.x, ped.y, threat.x, threat.y) < 190) fleeing = true;
    if (G.player && G.player.state === 'foot' && G.player.punchT > 0.22 && dist(ped.x, ped.y, G.player.x, G.player.y) < 30) fleeing = true;

    if (fleeing) ped.state = 'flee';
    else if (ped.state === 'flee') {
      ped.timer -= dt;
      if (ped.timer <= 0) { ped.state = 'walk'; ped.timer = rng.range(1, 3); }
    }

    let speedGoal = ped.walkSpeed;
    if (ped.state === 'flee') {
      speedGoal = 238;
      const src = threat || nearestThreatCar(ped) || G.player;
      if (src) {
        const away = Math.atan2(ped.y - src.y, ped.x - src.x);
        ped.angle = turnToward(ped.angle, away, 7 * dt);
      }
      ped.timer = Math.max(ped.timer, 0.6);
    } else {
      // Stroll: follow the current avenue direction, turn at junctions sometimes.
      ped.timer -= dt;
      const want = DIR_ANGLE[ped.dir];
      ped.angle = turnToward(ped.angle, want, 5 * dt);
      if (ped.timer <= 0) {
        ped.timer = rng.range(1.5, 4);
        if (rng.chance(0.4)) ped.dir = rng.int(0, 3);
        if (rng.chance(0.12)) ped.dir = (ped.dir + 2) % 4;
      }
      // Keep roughly to the sidewalk band of the road they walk beside.
      keepToSidewalk(ped);
    }

    ped.speed = speedGoal;
    ped.phase += dt * (ped.state === 'flee' ? 13 : 8);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    ped.x = clamp(ped.x, 138, WORLD_W - 14);
    ped.y = clamp(ped.y, 14, WORLD_H - 14);
    resolveCircle(G.city, ped, 10);
  }
}

function nearestThreatCar(ped) {
  let best = null, bd = 130;
  for (const car of G.cars) {
    if (Math.abs(car.speed) < 150) continue;
    const d = dist(ped.x, ped.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function keepToSidewalk(ped) {
  // Nudge back toward the nearest sidewalk line when drifting into the road or a wall.
  let bestDx = 0, bestDy = 0, bestD = Infinity;
  for (const cx of ROADS_X) {
    for (const s of [-1, 1]) {
      const lx = cx + s * (ROAD_W / 2 + 16);
      const d = Math.abs(ped.x - lx);
      if (d < bestD && Math.abs(ped.x - cx) < ROAD_W) { bestD = d; bestDx = lx - ped.x; bestDy = 0; }
    }
  }
  for (const cy of ROADS_Y) {
    for (const s of [-1, 1]) {
      const ly = cy + s * (ROAD_W / 2 + 16);
      const d = Math.abs(ped.y - ly);
      if (d < bestD && Math.abs(ped.y - cy) < ROAD_W) { bestD = d; bestDx = 0; bestDy = ly - ped.y; }
    }
  }
  if (bestD > 4 && bestD < 60) {
    ped.x += bestDx * 0.03;
    ped.y += bestDy * 0.03;
  }
}
