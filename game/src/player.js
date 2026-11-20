// Reyes, the player character: walking and sprinting the streets, pulling
// drivers out of their cars, driving anything with wheels, and fighting —
// fists for free, or the pistol Mara's work eventually provides. Also the
// one who picks things up: dropped cash, hidden packages, health kits.
import { G } from './state.js';
import {
  PLAYER_R, WALK_SPEED, RUN_SPEED, WORLD_W, WORLD_H, WATER_X,
  clamp, dist, fmtMoney,
} from './config.js';
import { Input } from './input.js';
import { resolveCircle } from './city.js';
import { driveCar, nearestCar, damageCar } from './vehicles.js';
import { spawnPedAt } from './pedestrians.js';
import { reportCrime } from './police.js';
import { FX } from './effects.js';
import { sfx } from './audio.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, aim: -Math.PI / 2, r: PLAYER_R,
    health: 100, armor: 0, speed: 0, stepPhase: 0,
    state: 'foot', car: null,
    weapon: 'fist', ammo: 0, punchT: 0, fireT: 0,
  };
}

export function mouseWorld() {
  return {
    x: G.camera.x - 640 + Input.mouse.x,
    y: G.camera.y - 360 + Input.mouse.y,
  };
}

export function damagePlayer(amount) {
  const p = G.player;
  if (!p || G.mode !== 'play') return;
  const absorbed = Math.min(p.armor, amount * 0.6);
  p.armor -= absorbed;
  p.health -= (amount - absorbed);
  G.hurtT = 0.4;
  FX.shake(3);
  if (p.health <= 0 && G.mode === 'play') {
    p.health = 0;
    G.mode = 'wasted';
    G.overT = 0;
    G.fine = Math.min(G.money, 200);
    if (G.sfx) G.sfx.setEngine(false);
    sfx('fail');
  }
}

function tryEnterCar() {
  const p = G.player;
  const car = nearestCar(p.x, p.y, 64, (c) => !c.dead);
  if (!car) return false;
  if (car.driver === 'traffic') {
    // The driver is pulled out onto the street and runs.
    const driver = spawnPedAt(car.x + 26, car.y + 10, G.rng);
    driver.state = 'flee';
    driver.timer = 2.6;
    reportCrime('carjack', car.x, car.y);
    FX.text(car.x, car.y - 34, 'CARJACKED', '#ffb35c', 14);
  } else if (car.driver === 'police') {
    reportCrime('theft', car.x, car.y);
  }
  car.driver = 'player';
  p.state = 'car';
  p.car = car;
  sfx('door');
  if (G.sfx) G.sfx.setEngine(true, 0);
  return true;
}

function exitCar() {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  p.x = clamp(car.x + Math.cos(side) * (car.wid / 2 + 18), 20, WORLD_W - 20);
  p.y = clamp(car.y + Math.sin(side) * (car.wid / 2 + 18), 20, WORLD_H - 20);
  resolveCircle(G.city, p, p.r);
  if (car.driver === 'player') car.driver = null;
  p.state = 'foot';
  p.car = null;
  sfx('door');
  if (G.sfx) G.sfx.setEngine(false);
}

function shoot() {
  const p = G.player;
  p.fireT = 0.24;
  if (p.ammo <= 0) { sfx('dry'); return; }
  p.ammo -= 1;
  sfx('shot');
  FX.muzzle(p.x, p.y, p.aim);
  FX.shake(1.6);
  G.threat = { x: p.x, y: p.y, until: G.time + 2.5 };
  reportCrime('shot', p.x, p.y);

  const range = 470;
  const dx = Math.cos(p.aim), dy = Math.sin(p.aim);
  let bestT = range, bestKind = null, bestRef = null;
  const rayHit = (ox, oy, orad, kind, ref) => {
    const rx = ox - p.x, ry = oy - p.y;
    const t = rx * dx + ry * dy;
    if (t < 8 || t > range) return;
    const lat = Math.abs(rx * -dy + ry * dx);
    if (lat < orad && t < bestT) { bestT = t; bestKind = kind; bestRef = ref; }
  };
  for (const ped of G.peds) if (ped.state !== 'down') rayHit(ped.x, ped.y, 13, 'ped', ped);
  for (const off of G.officers) rayHit(off.x, off.y, 13, 'officer', off);
  for (const car of G.cars) rayHit(car.x, car.y, car.r, 'car', car);

  const hx = p.x + dx * bestT, hy = p.y + dy * bestT;
  if (bestKind === 'ped') {
    bestRef.state = 'down';
    bestRef.downT = 12;
    FX.splashPuff(hx, hy);
    if (Math.random() < 0.7) {
      G.pickups.push({ kind: 'cash', amount: Math.round(bestRef.cash || 18), x: bestRef.x + 12, y: bestRef.y, t: 0 });
      bestRef.cash = 0;
    }
  } else if (bestKind === 'officer') {
    bestRef.gone = true;
    if (bestRef.car) bestRef.car.officersOut = Math.max(0, (bestRef.car.officersOut || 1) - 1);
    reportCrime('hitcop', hx, hy);
    FX.splashPuff(hx, hy);
  } else if (bestKind === 'car') {
    damageCar(bestRef, 16, hx, hy);
  } else {
    FX.sparks(hx, hy, 3);
  }
}

function punch() {
  const p = G.player;
  p.punchT = 0.34;
  sfx('punch');
  const fx = p.x + Math.cos(p.aim) * 30, fy = p.y + Math.sin(p.aim) * 30;
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    if (dist(fx, fy, ped.x, ped.y) < 24) {
      ped.state = 'down';
      ped.downT = 5;
      FX.splashPuff(ped.x, ped.y);
      reportCrime('assault', ped.x, ped.y);
      if (Math.random() < 0.4) {
        G.pickups.push({ kind: 'cash', amount: Math.round(ped.cash || 12), x: ped.x + 10, y: ped.y + 4, t: 0 });
        ped.cash = 0;
      }
      return;
    }
  }
  const car = nearestCar(fx, fy, 40);
  if (car) { FX.sparks(fx, fy, 4); sfx('crash', 0.3); }
}

function collectPickups() {
  const p = G.player;
  const px = p.state === 'car' && p.car ? p.car.x : p.x;
  const py = p.state === 'car' && p.car ? p.car.y : p.y;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i];
    if (dist(px, py, pk.x, pk.y) > 30) continue;
    if (pk.kind === 'cash') {
      G.money += pk.amount;
      FX.text(px, py - 30, '+ ' + fmtMoney(pk.amount), '#8be09a', 14);
      sfx('cash');
    } else if (pk.kind === 'health') {
      p.health = Math.min(100, p.health + 32);
      FX.text(px, py - 30, '+ HEALTH', '#ff9db0', 14);
      sfx('pickup');
    } else if (pk.kind === 'ammo') {
      p.ammo += pk.amount;
      if (p.weapon === 'fist') p.weapon = 'pistol';
      FX.text(px, py - 30, '+ ' + pk.amount + ' ROUNDS', '#ffd76a', 14);
      sfx('pickup');
    }
    G.pickups.splice(i, 1);
  }
  // Hidden packages are walked or driven over, like pickups.
  if (p.state === 'foot' || p.state === 'car') {
    for (const pkg of G.city.packages) {
      if (pkg.taken) continue;
      if (dist(px, py, pkg.x, pkg.y) < 30) {
        pkg.taken = true;
        G.stats.packagesFound += 1;
        G.money += 100;
        FX.text(px, py - 36, 'HIDDEN PACKAGE ' + G.stats.packagesFound + '/20  +$100', '#ffe066', 15);
        sfx('pickup');
        G.saveDirty = true;
      }
    }
  }
}

export function updatePlayer(dt) {
  const p = G.player;
  if (!p) return;
  p.punchT = Math.max(0, p.punchT - dt);
  p.fireT = Math.max(0, p.fireT - dt);

  if (p.state === 'car' && p.car) {
    const car = p.car;
    const throttle = (Input.down('KeyW') || Input.down('ArrowUp') ? 1 : 0) - (Input.down('KeyS') || Input.down('ArrowDown') ? 1 : 0);
    const steer = (Input.down('KeyD') || Input.down('ArrowRight') ? 1 : 0) - (Input.down('KeyA') || Input.down('ArrowLeft') ? 1 : 0);
    driveCar(car, dt, throttle, steer);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    if (G.sfx) G.sfx.setEngine(true, Math.abs(car.speed) / 470);
    if (Input.pressed('KeyE') && Math.abs(car.speed) < 34) exitCar();
    if (car.dead) G.objectiveHint = 'This car is wrecked — press E and find another';
    collectPickups();
    return;
  }

  // On foot.
  const ax = Input.axes();
  const running = Input.down('ShiftLeft') || Input.down('ShiftRight');
  const speedGoal = running ? RUN_SPEED : WALK_SPEED;
  if (ax.x !== 0 || ax.y !== 0) {
    const inv = 1 / Math.hypot(ax.x, ax.y);
    p.x += ax.x * inv * speedGoal * dt;
    p.y += ax.y * inv * speedGoal * dt;
    p.angle = Math.atan2(ax.y, ax.x);
    p.speed = speedGoal;
    p.stepPhase += dt * (running ? 12.5 : 9);
  } else {
    p.speed = 0;
  }
  if (p.x < WATER_X + 8) p.x = WATER_X + 8; // the bay is not for walking
  p.x = clamp(p.x, 16, WORLD_W - 16);
  p.y = clamp(p.y, 16, WORLD_H - 16);
  resolveCircle(G.city, p, p.r);

  const mw = mouseWorld();
  p.aim = Math.atan2(mw.y - p.y, mw.x - p.x);

  if (Input.pressed('KeyE')) {
    if (!tryEnterCar()) G.flags.interact = true;
  }
  if ((Input.mouse.clicked || Input.pressed('KeyJ')) && p.fireT <= 0 && p.punchT <= 0) {
    if (p.weapon === 'pistol') shoot();
    else punch();
  }
  if (Input.pressed('KeyQ')) {
    if (p.weapon === 'pistol') { p.weapon = 'fist'; }
    else if (p.ammo > 0 || G.stats.ammoEver) { p.weapon = 'pistol'; }
  }
  collectPickups();
}
