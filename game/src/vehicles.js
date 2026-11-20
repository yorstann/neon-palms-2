// Cars: the five types, how they are spawned (traffic flow and parked),
// the lane-following traffic driver, and the shared arcade physics every
// driver — traffic, police and Reyes — uses. A car is a rectangle with a
// heading; collisions are tested with two circles along its spine.
import { G } from './state.js';
import {
  ROAD_W, ROADS_X, ROADS_Y, WORLD_W, WORLD_H,
  clamp, dist, normAngle, turnToward,
} from './config.js';
import { circleHitsBuilding, resolveCircle } from './city.js';
import { FX } from './effects.js';
import { sfx } from './audio.js';

export const CAR_TYPES = {
  sedan: { len: 47, wid: 24, accel: 195, maxF: 335, maxR: 120, turn: 3.1, colors: ['#c94f43', '#4a7fb5', '#57a773', '#d9d3c3', '#7d6ba8', '#3f4854', '#c7a23a'] },
  taxi: { len: 47, wid: 24, accel: 195, maxF: 330, maxR: 120, turn: 3.1, colors: ['#f2b63c'] },
  sport: { len: 49, wid: 25, accel: 305, maxF: 478, maxR: 132, turn: 3.5, colors: ['#e03a5f', '#ffb340', '#38c6d9', '#f2f2f2', '#23232b'] },
  truck: { len: 66, wid: 30, accel: 138, maxF: 262, maxR: 100, turn: 2.4, colors: ['#8d8578', '#5d7261', '#74584a', '#4e5d6c'] },
  police: { len: 49, wid: 25, accel: 268, maxF: 436, maxR: 128, turn: 3.3, colors: ['#20242c'] },
};

/** Direction helpers: 0 east, 1 south, 2 west, 3 north (screen y grows down). */
export const DIR_ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export function createCar(type, x, y, angle, color) {
  const spec = CAR_TYPES[type];
  return {
    type, x, y, angle, speed: 0,
    len: spec.len, wid: spec.wid,
    r: spec.len * 0.40,
    color: color || spec.colors[0],
    health: 100, driver: null, // null | 'traffic' | 'player' | 'police'
    dir: 0, turnCd: 0, blockedT: 0, honkCd: 0, smokeAcc: 0,
    steerVis: 0, dead: false, lastHitT: -9, reverseT: 0,
  };
}

function laneOffset(dir) {
  // Right-hand traffic: the lane centre sits a quarter road to the driver's right.
  return ROAD_W * 0.24;
}

/** The point a lane-following car steers for: ahead of it, on its lane line. */
function laneTarget(car) {
  const dir = car.dir;
  if (dir === 0 || dir === 2) {
    const cy = nearestOf(ROADS_Y, car.y);
    const ty = cy + (dir === 0 ? laneOffset(dir) : -laneOffset(dir));
    return { x: car.x + (dir === 0 ? 150 : -150), y: ty };
  }
  const cx = nearestOf(ROADS_X, car.x);
  const tx = cx + (dir === 1 ? -laneOffset(dir) : laneOffset(dir));
  return { x: tx, y: car.y + (dir === 1 ? 150 : -150) };
}

function nearestOf(arr, v) {
  let best = arr[0], bd = Infinity;
  for (const a of arr) { const d = Math.abs(a - v); if (d < bd) { bd = d; best = a; } }
  return best;
}

function atIntersection(car) {
  const nx = nearestOf(ROADS_X, car.x), ny = nearestOf(ROADS_Y, car.y);
  return Math.abs(car.x - nx) < 16 && Math.abs(car.y - ny) < 16;
}

/** Is there a vehicle (or Reyes on foot) close ahead of this car? Returns the gap or Infinity. */
function obstacleAhead(car, lookDist) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let best = Infinity;
  const test = (ox, oy, orad) => {
    const dx = ox - car.x, dy = oy - car.y;
    const along = dx * fx + dy * fy;
    if (along < 6 || along > lookDist + orad) return;
    const lat = Math.abs(dx * -fy + dy * fx);
    if (lat < car.wid * 0.72 + orad * 0.6) best = Math.min(best, along - orad);
  };
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    test(other.x, other.y, other.r);
  }
  const p = G.player;
  if (p && p.state === 'foot') test(p.x, p.y, 12);
  return best;
}

export function updateTrafficCar(car, dt, rng) {
  const spec = CAR_TYPES[car.type];
  car.turnCd -= dt;
  car.honkCd -= dt;

  // Choose a new heading at intersections: mostly straight on.
  if (car.turnCd <= 0 && atIntersection(car)) {
    const roll = rng.next();
    if (roll > 0.58) {
      const turn = roll > 0.8 ? 1 : 3; // right or left
      car.dir = (car.dir + turn) % 4;
    }
    car.turnCd = 2.6;
  }
  // At the map rim, turn back into the city.
  if ((car.dir === 0 && car.x > WORLD_W - 130) || (car.dir === 2 && car.x < 330) ||
      (car.dir === 1 && car.y > WORLD_H - 90) || (car.dir === 3 && car.y < 90)) {
    car.dir = (car.dir + 2) % 4;
    car.turnCd = 2;
  }

  const target = laneTarget(car);
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  car.angle = turnToward(car.angle, want, spec.turn * 0.62 * dt);

  const cruise = spec.maxF * 0.52;
  const gap = obstacleAhead(car, 96);
  let goal = cruise;
  if (gap < 40) goal = 0;
  else if (gap < 96) goal = cruise * ((gap - 40) / 56) * 0.8;
  if (gap < 34 && car.honkCd <= 0 && Math.abs(car.speed) < 30) {
    sfx('honk');
    car.honkCd = rng.range(2, 5);
  }
  car.speed = approachSpeed(car.speed, goal, spec.accel * 0.7, dt);
  moveCar(car, dt);
}

export function approachSpeed(speed, goal, accel, dt) {
  if (speed < goal) return Math.min(goal, speed + accel * dt);
  return Math.max(goal, speed - accel * 1.7 * dt);
}

/** Arcade driving for a steered car: throttle -1..1, steer -1..1. */
export function driveCar(car, dt, throttle, steer) {
  const spec = CAR_TYPES[car.type];
  if (car.dead) throttle = 0;
  if (throttle > 0) car.speed = Math.min(spec.maxF, car.speed + spec.accel * throttle * dt);
  else if (throttle < 0) {
    if (car.speed > 12) car.speed = Math.max(0, car.speed + spec.accel * 1.5 * throttle * dt);
    else car.speed = Math.max(-spec.maxR, car.speed + spec.accel * 0.8 * throttle * dt);
  } else {
    car.speed = approachSpeed(car.speed, 0, 46, dt);
  }
  // Rolling drag so top speed settles instead of being a hard wall.
  car.speed -= car.speed * 0.12 * dt;
  const sf = clamp(car.speed / 130, -1.25, 1.25);
  car.angle += steer * spec.turn * 0.42 * dt * sf * (car.speed < 0 ? -1 : 1);
  car.steerVis = steer;
  moveCar(car, dt);
  // Tyre marks and noise when the car is working hard.
  if (Math.abs(car.speed) > 190 && Math.abs(steer) > 0.55) {
    const bx = car.x - Math.cos(car.angle) * car.len * 0.32;
    const by = car.y - Math.sin(car.angle) * car.len * 0.32;
    FX.skid(bx + Math.cos(car.angle + Math.PI / 2) * 9, by + Math.sin(car.angle + Math.PI / 2) * 9);
    FX.skid(bx - Math.cos(car.angle + Math.PI / 2) * 9, by - Math.sin(car.angle + Math.PI / 2) * 9);
  }
}

/** Integrate a car and keep it out of the buildings; returns impact speed if it hit one. */
export function moveCar(car, dt) {
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 26, WORLD_W - 26);
  car.y = clamp(car.y, 26, WORLD_H - 26);
  let impact = 0;
  for (const s of [0.34, -0.34]) {
    const px = car.x + Math.cos(car.angle) * car.len * s;
    const py = car.y + Math.sin(car.angle) * car.len * s;
    if (circleHitsBuilding(G.city, px, py, car.wid * 0.46)) {
      const probe = { x: px, y: py };
      resolveCircle(G.city, probe, car.wid * 0.46);
      car.x += probe.x - px;
      car.y += probe.y - py;
      impact = Math.max(impact, Math.abs(car.speed));
      car.speed *= -0.22;
    }
  }
  if (impact > 130) damageCar(car, (impact - 110) * 0.055, car.x, car.y);
  // Damage smoke.
  if (car.health < 52 && !car.dead) {
    car.smokeAcc += dt;
    if (car.smokeAcc > (car.health < 24 ? 0.07 : 0.22)) {
      car.smokeAcc = 0;
      FX.smoke(car.x + Math.cos(car.angle) * car.len * 0.3, car.y + Math.sin(car.angle) * car.len * 0.3, car.health < 24);
    }
  }
  return impact;
}

export function damageCar(car, amount, x, y) {
  if (car.dead) return;
  car.health -= amount;
  FX.sparks(x, y, amount > 8 ? 10 : 5);
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    FX.smoke(x, y, true);
    FX.burst(x, y, '#ff9a3c', 16, 200, 0.6, 4, 120);
  }
}

/** Pairwise car-to-car resolution; returns a list of crash events for main.js to judge. */
export function resolveCarCollisions() {
  const events = [];
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      const rr = (a.r + b.r) * 0.82;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, ny = dy / d;
      const push = (rr - d) / 2;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const rel = Math.abs((a.speed - b.speed) * (Math.cos(a.angle) * nx + Math.sin(a.angle) * ny));
      const impact = Math.max(rel, Math.abs(a.speed - b.speed) * 0.5);
      a.speed *= 0.52; b.speed *= 0.52;
      if (impact > 95) {
        damageCar(a, impact * 0.045, (a.x + b.x) / 2, (a.y + b.y) / 2);
        damageCar(b, impact * 0.045, (a.x + b.x) / 2, (a.y + b.y) / 2);
        events.push({ a, b, impact, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    }
  }
  return events;
}

export function nearestCar(x, y, maxD, filter = null) {
  let best = null, bd = maxD;
  for (const car of G.cars) {
    if (filter && !filter(car)) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

const TRAFFIC_MIX = ['sedan', 'sedan', 'sedan', 'taxi', 'sport', 'truck', 'sedan'];

export function spawnTraffic(rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng.chance(0.5);
    let x, y, dir;
    if (vertical) {
      const cx = rng.pick(ROADS_X);
      dir = rng.chance(0.5) ? 1 : 3;
      x = cx + (dir === 1 ? -laneOffset(dir) : laneOffset(dir));
      y = rng.range(120, WORLD_H - 120);
    } else {
      const cy = rng.pick(ROADS_Y);
      dir = rng.chance(0.5) ? 0 : 2;
      y = cy + (dir === 0 ? laneOffset(dir) : -laneOffset(dir));
      x = rng.range(380, WORLD_W - 120);
    }
    if (cars.some((c) => dist(x, y, c.x, c.y) < 110)) continue;
    const type = rng.pick(TRAFFIC_MIX);
    const car = createCar(type, x, y, DIR_ANGLE[dir], rng.pick(CAR_TYPES[type].colors));
    car.driver = 'traffic';
    car.dir = dir;
    car.speed = CAR_TYPES[type].maxF * rng.range(0.3, 0.5);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < 600) {
    const vertical = rng.chance(0.5);
    let x, y, angle;
    if (vertical) {
      const cx = rng.pick(ROADS_X);
      const side = rng.sign();
      x = cx + side * (ROAD_W / 2 + 15);
      y = rng.range(80, WORLD_H - 80);
      if (Math.abs(y - nearestOf(ROADS_Y, y)) < 96) continue;
      angle = Math.PI / 2;
    } else {
      const cy = rng.pick(ROADS_Y);
      const side = rng.sign();
      y = cy + side * (ROAD_W / 2 + 15);
      x = rng.range(360, WORLD_W - 80);
      if (Math.abs(x - nearestOf(ROADS_X, x)) < 96) continue;
      angle = 0;
    }
    if (circleHitsBuilding({ buildings: G.city.buildings }, x, y, 20)) continue;
    if (cars.some((c) => dist(x, y, c.x, c.y) < 70)) continue;
    const type = rng.pick(TRAFFIC_MIX);
    const car = createCar(type, x, y, angle, rng.pick(CAR_TYPES[type].colors));
    car.driver = null;
    cars.push(car);
  }
  return cars;
}
