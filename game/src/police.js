// The law. Crimes only raise heat when somebody sees them — a pedestrian
// nearby, or an officer. Heat decays while Reyes keeps his head down, and
// the Palmera Bay PD answers with patrol cars that hunt, ram, and put
// officers on the ground to make the arrest. The Shine & Go respray is
// the classic way out: cash for a clean car and a cold trail.
import { G, starsForHeat } from './state.js';
import {
  HEAT_MAX, HEAT_PER_STAR, SPRAY_COST, ROADS_X, ROADS_Y,
  clamp, dist, turnToward,
} from './config.js';
import { circleHitsBuilding, resolveCircle } from './city.js';
import { createCar, CAR_TYPES, moveCar, approachSpeed } from './vehicles.js';
import { FX } from './effects.js';
import { sfx } from './audio.js';

export const CRIME_HEAT = {
  carjack: 70, hitped: 130, assault: 45, shot: 55,
  hitcar: 30, hitcop: 170, theft: 90, reckless: 15,
};

function witnessed(x, y) {
  for (const ped of G.peds) {
    if (ped.state !== 'down' && dist(x, y, ped.x, ped.y) < 245) return true;
  }
  for (const car of G.cars) {
    if (car.driver === 'police' && dist(x, y, car.x, car.y) < 430) return true;
  }
  for (const off of G.officers) {
    if (dist(x, y, off.x, off.y) < 300) return true;
  }
  return false;
}

/** Report a crime at a place. Unseen crimes are free; seen ones add heat. */
export function reportCrime(kind, x, y) {
  if (G.mode !== 'play') return;
  if (kind !== 'hitcop' && !witnessed(x, y)) return;
  const before = G.stars;
  G.heat = clamp(G.heat + (CRIME_HEAT[kind] || 30), 0, HEAT_MAX);
  G.stars = starsForHeat(G.heat);
  G.lastCrimeAt = G.time;
  G.lastCrimePos = { x, y };
  if (G.stars > before && G.player) {
    FX.text(G.player.x, G.player.y - 44, 'WANTED ' + '★'.repeat(G.stars), '#ffd76a', 17);
    sfx('blip');
  }
}

/** Script a heat level directly (missions that start hot). */
export function setHeat(heat) {
  G.heat = clamp(heat, 0, HEAT_MAX);
  G.stars = starsForHeat(G.heat);
  G.lastCrimeAt = G.time;
}

function spawnPoliceCar(rng) {
  const p = G.player;
  if (!p) return;
  // Come from a road junction a few blocks away, outside the player's view.
  for (let tries = 0; tries < 12; tries++) {
    const cx = ROADS_X[rng.int(0, ROADS_X.length - 1)];
    const cy = ROADS_Y[rng.int(0, ROADS_Y.length - 1)];
    const x = cx + rng.range(-40, 40), y = cy + rng.range(-40, 40);
    const d = dist(x, y, p.x, p.y);
    if (d < 560 || d > 980) continue;
    if (Math.abs(x - G.camera.x) < 760 && Math.abs(y - G.camera.y) < 520) continue;
    const car = createCar('police', x, y, Math.atan2(p.y - y, p.x - x), '#20242c');
    car.driver = 'police';
    G.cars.push(car);
    return;
  }
}

function updatePoliceCar(car, dt) {
  const p = G.player;
  const spec = CAR_TYPES.police;
  const target = p.state === 'car' && p.car ? p.car : p;
  const d = dist(car.x, car.y, target.x, target.y);

  // Aim at where the player will be, not where they were.
  const lead = clamp(d / 300, 0, 0.65);
  const tx = target.x + Math.cos(target.angle || 0) * (target.speed || 0) * lead;
  const ty = target.y + Math.sin(target.angle || 0) * (target.speed || 0) * lead;

  let want = Math.atan2(ty - car.y, tx - car.x);
  // If a building blocks the nose, veer until the way is clear.
  const noseX = car.x + Math.cos(car.angle) * 58, noseY = car.y + Math.sin(car.angle) * 58;
  if (circleHitsBuilding(G.city, noseX, noseY, 20)) {
    want = car.angle + (car.veer || (car.veer = Math.random() < 0.5 ? 1.1 : -1.1));
    car.blockedT += dt;
  } else {
    car.veer = 0;
    car.blockedT = Math.max(0, car.blockedT - dt);
  }

  if (car.reverseT > 0) {
    car.reverseT -= dt;
    car.speed = approachSpeed(car.speed, -120, spec.accel, dt);
    car.angle = turnToward(car.angle, want, spec.turn * 0.5 * dt);
  } else {
    if (car.blockedT > 0.8) { car.reverseT = 0.55; car.blockedT = 0; }
    const top = spec.maxF * (0.72 + G.stars * 0.055) * (d < 90 ? 0.45 : 1);
    car.angle = turnToward(car.angle, want, spec.turn * 0.9 * dt);
    car.speed = approachSpeed(car.speed, top, spec.accel * 0.9, dt);
  }
  moveCar(car, dt);

  // Officers pile out when the suspect is on foot and the car is close.
  if (p.state === 'foot' && d < 150 && Math.abs(car.speed) < 130 && (car.officersOut || 0) < 2) {
    car.officersOut = (car.officersOut || 0) + 1;
    G.officers.push({
      x: car.x + Math.cos(car.angle + Math.PI / 2) * 24,
      y: car.y + Math.sin(car.angle + Math.PI / 2) * 24,
      angle: car.angle, state: 'chase', car, phase: Math.random() * 6,
    });
    sfx('door');
  }
}

function updateOfficer(off, dt) {
  const p = G.player;
  const d = dist(off.x, off.y, p.x, p.y);
  if (p.state === 'car' || d > 330) {
    // Back to the car; vanish into it when close.
    const cd = dist(off.x, off.y, off.car.x, off.car.y);
    off.angle = turnToward(off.angle, Math.atan2(off.car.y - off.y, off.car.x - off.x), 8 * dt);
    off.x += Math.cos(off.angle) * 190 * dt;
    off.y += Math.sin(off.angle) * 190 * dt;
    off.phase += dt * 11;
    if (cd < 26) {
      off.gone = true;
      off.car.officersOut = Math.max(0, (off.car.officersOut || 1) - 1);
    }
    return;
  }
  off.angle = turnToward(off.angle, Math.atan2(p.y - off.y, p.x - off.x), 9 * dt);
  const speed = 262;
  off.x += Math.cos(off.angle) * speed * dt;
  off.y += Math.sin(off.angle) * speed * dt;
  off.phase += dt * 13;
  resolveCircle(G.city, off, 10);
  if (d < 24 && Math.abs(p.speed || 0) < RUN_CATCH) {
    G.bustedMeter = Math.min(1, G.bustedMeter + dt / 1.5);
    if (Math.random() < dt * 2) FX.text(p.x, p.y - 30, 'BUSTED?', '#ff8a7a', 13);
  }
}

const RUN_CATCH = 305; // an officer can only hold a suspect who is not sprinting clear

export function updatePolice(dt, rng) {
  // Heat cools while no fresh crime is being watched.
  if (G.time - G.lastCrimeAt > 5 && G.heat > 0) {
    let watched = false;
    for (const car of G.cars) {
      if (car.driver === 'police' && G.player && dist(car.x, car.y, G.player.x, G.player.y) < 330) { watched = true; break; }
    }
    G.heat = Math.max(0, G.heat - (watched ? 1.1 : 5.2) * dt);
    G.stars = starsForHeat(G.heat);
  }
  if (G.stars === 0) G.bustedMeter = Math.max(0, G.bustedMeter - dt * 0.8);
  else if (!G.officers.some((o) => !o.gone && dist(o.x, o.y, G.player.x, G.player.y) < 26)) {
    G.bustedMeter = Math.max(0, G.bustedMeter - dt * 0.45);
  }

  const wanted = G.stars === 0 ? 0 : 1 + G.stars;
  const active = G.cars.filter((c) => c.driver === 'police');
  if (active.length < wanted) spawnPoliceCar(rng);
  for (const car of active) {
    if (car.dead) continue;
    if (G.stars === 0 && dist(car.x, car.y, G.player.x, G.player.y) > 900) {
      car.driver = 'traffic'; // stood down: becomes ordinary traffic
      car.dir = Math.abs(Math.sin(car.angle)) > 0.7 ? (car.angle > 0 ? 1 : 3) : (car.angle > -Math.PI / 2 && car.angle < Math.PI / 2 ? 0 : 2);
      continue;
    }
    updatePoliceCar(car, dt);
  }
  for (const off of G.officers) if (!off.gone) updateOfficer(off, dt);
  G.officers = G.officers.filter((o) => !o.gone);

  const anyNear = active.some((c) => G.player && dist(c.x, c.y, G.player.x, G.player.y) < 430);
  sfxSetSiren(anyNear && G.stars > 0);
}

function sfxSetSiren(on) {
  if (G.sfx && typeof G.sfx.setSiren === 'function') {
    try { G.sfx.setSiren(on); } catch { /* audio is best-effort */ }
  }
}

let sprayCd = 0;
/** The Shine & Go: stand in the lot in a car, pay, and the heat is gone. */
export function updateRespray(dt) {
  sprayCd -= dt;
  const p = G.player;
  if (!p || p.state !== 'car' || !p.car) return;
  const z = G.city.spray.zone;
  const inside = p.car.x > z.x && p.car.x < z.x + z.w && p.car.y > z.y && p.car.y < z.y + z.h;
  if (!inside) return;
  if (G.heat <= 0) {
    if (sprayCd <= 0) { G.objectiveHint = 'Shine & Go: a respray clears your wanted level for ' + '$' + SPRAY_COST; }
    return;
  }
  if (sprayCd > 0) return;
  let copNear = false;
  for (const car of G.cars) if (car.driver === 'police' && dist(car.x, car.y, p.car.x, p.car.y) < 240) copNear = true;
  if (copNear) {
    G.objectiveHint = 'Shine & Go: lose the cops watching you first';
    sprayCd = 1;
    return;
  }
  if (G.money < SPRAY_COST) {
    G.objectiveHint = 'Shine & Go: you need ' + '$' + SPRAY_COST + ' for a respray';
    sprayCd = 1;
    return;
  }
  G.money -= SPRAY_COST;
  G.heat = 0;
  G.stars = 0;
  p.car.color = '#' + Math.floor(Math.random() * 0x7fffff + 0x202020).toString(16);
  p.car.health = Math.min(100, p.car.health + 45);
  FX.text(p.car.x, p.car.y - 40, 'RESPRAYED — TRAIL COLD', '#8be09a', 16);
  sfx('ok');
  sprayCd = 2;
}
