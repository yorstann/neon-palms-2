// The screenshot scenes behind ?shot=title|downtown|chase|mission&seed=N.
// Each builds the real world with the real rules, poses the actors, steps
// the simulation a fixed number of ticks so traffic and crowds settle,
// and leaves a living frame for the camera — the same seed always gives
// the same Palmera Bay. main.js renders the staged frame and raises
// window.__SHOT_READY once it is on screen.
import { G } from './state.js';
import { STEP } from './config.js';
import { buildWorld } from './world.js';
import { createCar } from './vehicles.js';
import { updateTrafficCar, moveCar } from './vehicles.js';
import { updatePeds, spawnPedAt } from './pedestrians.js';
import { setHeat } from './police.js';
import { FX } from './effects.js';

function settle(steps) {
  for (let i = 0; i < steps; i++) {
    G.time += STEP;
    for (const car of G.cars) {
      if (car.driver === 'traffic') updateTrafficCar(car, STEP, G.rng);
      else if (car.driver === 'police') moveCar(car, STEP);
    }
    updatePeds(STEP, G.rng);
    FX.update(STEP);
  }
}

function placePlayerCar(type, x, y, angle, speed, color) {
  const car = createCar(type, x, y, angle, color);
  car.driver = 'player';
  car.speed = speed;
  G.cars.push(car);
  G.player.state = 'car';
  G.player.car = car;
  G.player.x = x;
  G.player.y = y;
  return car;
}

export function stageShot(name, seed) {
  buildWorld(seed || 1);
  const p = G.player;

  if (name === 'downtown') {
    G.mode = 'play';
    G.clockMin = 11 * 60 + 20;
    // On the sidewalk corner of 1000 Avenue and 900 Street, mid-morning,
    // with the lunch crowd around and traffic rolling past.
    p.x = 1076; p.y = 976; p.angle = 0.4; p.aim = 0.4;
    spawnPedAt(1010, 1006, G.rng);
    spawnPedAt(1150, 838, G.rng);
    spawnPedAt(946, 880, G.rng);
    spawnPedAt(1120, 1090, G.rng);
    G.camera.x = p.x; G.camera.y = p.y;
    G.objective = 'Free roam — Palmera Bay';
    settle(80);
    G.camera.x = p.x; G.camera.y = p.y;
    return;
  }

  if (name === 'chase') {
    G.mode = 'play';
    G.clockMin = 20 * 60 + 25;
    const car = placePlayerCar('sport', 1480, 962, 0, 372, '#e03a5f');
    const copSpots = [[1310, 1004, 0.06], [1180, 928, -0.05], [1605, 1012, 0.32]];
    for (const [x, y, a] of copSpots) {
      const cop = createCar('police', x, y, a, '#20242c');
      cop.driver = 'police';
      cop.speed = 330;
      G.cars.push(cop);
    }
    setHeat(330); // three stars
    G.lastCrimePos = { x: car.x, y: car.y };
    for (let i = 0; i < 26; i++) {
      const bx = car.x - i * 13;
      FX.skid(bx, 962 + 10);
      FX.skid(bx, 962 - 10);
    }
    G.objective = 'Lose the police — or find Shine & Go';
    settle(24);
    G.camera.x = car.x + 60;
    G.camera.y = car.y;
    return;
  }

  if (name === 'mission') {
    G.mode = 'play';
    G.clockMin = 15 * 60 + 10;
    const car = placePlayerCar('sedan', 430, 1400, 0, 120, '#4a7fb5');
    G.missionsDone = 0;
    G.marker = { x: 356, y: 1620, label: 'PICKUP' };
    G.objective = 'Pick up the cooler at the Marina docks';
    G.dialogue = {
      lines: [{ who: 'Mara Voss', text: 'A cooler is waiting at the Marina docks, south-west corner. Bring it to the Downtown garage on 1500 Avenue. Do not open it.' }],
      idx: 0, onDone: null,
    };
    settle(36);
    G.camera.x = car.x + 130;
    G.camera.y = car.y + 40;
    return;
  }

  // title (and anything unknown): golden hour over the bay, world alive.
  G.mode = 'title';
  G.clockMin = 17 * 60 + 42;
  G.camera.x = 760;
  G.camera.y = 1180;
  settle(110);
  G.camera.x = 760;
  G.camera.y = 1180;
}
