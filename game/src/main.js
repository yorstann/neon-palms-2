// Neon Palms — boot and the one loop. The world advances in fixed 1/60 s
// steps from a requestAnimationFrame accumulator; rendering paints what
// the state holds. Modes: title, help, play, pause, busted, wasted.
// ?shot=title|downtown|chase|mission&seed=N stages a screenshot scene
// instead of the title flow and raises window.__SHOT_READY when framed.
import { G } from './state.js';
import {
  STEP, VIEW_W, VIEW_H, WORLD_W, WORLD_H, MIN_PER_SEC, clamp, dist,
} from './config.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { FX } from './effects.js';
import { buildWorld } from './world.js';
import { updatePlayer, damagePlayer } from './player.js';
import { updateTrafficCar, resolveCarCollisions } from './vehicles.js';
import { updatePeds } from './pedestrians.js';
import { updatePolice, updateRespray, reportCrime } from './police.js';
import { updateMissions, introCall, persistSave } from './missions.js';
import { loadSave, wipeSave, hasSave } from './save.js';
import { drawScene } from './render.js';
import { drawHUD, drawTitle, drawHelp, drawPause, drawEndScreen, titleItems, PAUSE_ITEMS } from './hud.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

Input.init(canvas);
G.sfx = new Sfx();
G.hasSave = hasSave();

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const isShot = shotName !== null;
if (isShot) {
  stageShot(shotName, parseInt(params.get('seed') || '1', 10) || 1);
} else {
  buildWorld(7);
  G.mode = 'title';
  G.menuSel = 0;
}

/* ---------------- mode transitions ---------------- */

function startNewGame() {
  wipeSave();
  buildWorld((Date.now() % 90000) + 11);
  G.mode = 'play';
  G.hasSave = false;
  introCall();
  G.banner = { title: 'NEON PALMS', sub: 'Palmera Bay — see Mara Voss at The Gilded Gull', t: 0, dur: 3.4 };
  G.sfx.unlock();
  G.sfx.startMusic();
}

function startFromSave() {
  const data = loadSave();
  if (!data) { startNewGame(); return; }
  buildWorld(7, data);
  G.mode = 'play';
  G.banner = { title: 'WELCOME BACK', sub: 'Job ' + Math.min(G.missionsDone + 1, 6) + ' is waiting at The Gilded Gull', t: 0, dur: 2.6 };
  G.sfx.unlock();
  G.sfx.startMusic();
}

function respawn() {
  const p = G.player;
  const spot = G.mode === 'busted' ? G.city.station : G.city.hospital;
  G.money = Math.max(0, G.money - G.fine);
  if (p.state === 'car' && p.car) {
    if (p.car.driver === 'player') p.car.driver = null;
    p.car = null;
    p.state = 'foot';
  }
  p.x = spot.x;
  p.y = spot.y;
  p.health = 100;
  p.armor = 0;
  G.heat = 0;
  G.stars = 0;
  G.bustedMeter = 0;
  G.officers = [];
  for (const car of G.cars) {
    if (car.driver === 'police') { car.driver = 'traffic'; car.officersOut = 0; }
  }
  G.mode = 'play';
  G.saveDirty = true;
  if (G.sfx) G.sfx.setSiren(false);
}

/* ---------------- per-step updates ---------------- */

function updateAmbient(dt) {
  for (const car of G.cars) {
    if (car.driver === 'traffic') updateTrafficCar(car, dt, G.rng);
  }
  updatePeds(dt, G.rng);
  FX.update(dt);
}

function updatePlay(dt) {
  G.clockMin = (G.clockMin + MIN_PER_SEC * dt) % 1440;
  updatePlayer(dt);
  updateAmbient(dt);
  updatePolice(dt, G.rng);
  updateMissions(dt);
  updateRespray(dt);

  // Car-to-car crashes: noise, sparks, and the law's opinion.
  for (const ev of resolveCarCollisions()) {
    if (ev.impact > 130) {
      FX.shake(Math.min(7, ev.impact / 60));
      if (G.sfx) G.sfx.crash(Math.min(1, ev.impact / 420));
    }
    const p = G.player;
    const playerInvolved = p.state === 'car' && (ev.a === p.car || ev.b === p.car);
    const other = ev.a === p.car ? ev.b : ev.a;
    if (playerInvolved && ev.impact > 120 && G.time - (p.car.lastHitT || -9) > 1.2) {
      p.car.lastHitT = G.time;
      if (other.driver === 'police') reportCrime('hitcop', ev.x, ev.y);
      else reportCrime('hitcar', ev.x, ev.y);
    }
  }

  // A car meeting Reyes on foot.
  const p = G.player;
  if (p.state === 'foot') {
    for (const car of G.cars) {
      if (car.driver === 'player' || Math.abs(car.speed) < 70) continue;
      if (dist(p.x, p.y, car.x, car.y) < car.r + 12) {
        damagePlayer(Math.min(26, Math.abs(car.speed) * 0.07));
        p.x += Math.cos(Math.atan2(p.y - car.y, p.x - car.x)) * 22;
        p.y += Math.sin(Math.atan2(p.y - car.y, p.x - car.x)) * 22;
        if (car.driver === 'traffic') { car.speed *= 0.3; }
      }
    }
  }

  // Camera: follow, with a look-ahead along the car's velocity.
  const focus = p.state === 'car' && p.car ? p.car : p;
  const lead = p.state === 'car' && p.car ? 0.34 : 0.1;
  const tx = clamp(focus.x + Math.cos(focus.angle) * (focus.speed || 0) * lead, VIEW_W / 2 - 60, WORLD_W - VIEW_W / 2 + 60);
  const ty = clamp(focus.y + Math.sin(focus.angle) * (focus.speed || 0) * lead, VIEW_H / 2 - 60, WORLD_H - VIEW_H / 2 + 60);
  G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 4.2);
  G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 4.2);

  if (G.bustedMeter >= 1 && G.mode === 'play') {
    G.mode = 'busted';
    G.overT = 0;
    G.fine = Math.min(G.money, 150 + G.stars * 110);
    if (G.sfx) { G.sfx.setEngine(false); G.sfx.setSiren(false); }
  }
  if (G.phoneMsg) {
    G.phoneMsg.ttl -= dt;
    if (G.phoneMsg.ttl <= 0) G.phoneMsg = null;
  }
  if (G.banner) {
    G.banner.t += dt;
    if (G.banner.t >= G.banner.dur) G.banner = null;
  }
  G.hurtT = Math.max(0, G.hurtT - dt);
  if (G.saveDirty) {
    G.saveTimer = (G.saveTimer || 0) + dt;
    if (G.saveTimer > 1.2) { G.saveTimer = 0; G.saveDirty = false; persistSave(); G.hasSave = true; }
  }
}

function menuNav(items) {
  if (Input.pressed('ArrowUp') || Input.pressed('KeyW')) G.menuSel = (G.menuSel + items.length - 1) % items.length;
  if (Input.pressed('ArrowDown') || Input.pressed('KeyS')) G.menuSel = (G.menuSel + 1) % items.length;
  // Mouse hover selects too.
  const rowY = G.mode === 'pause' ? 330 : 372;
  for (let i = 0; i < items.length; i++) {
    const y = rowY + i * 44;
    if (Math.abs(Input.mouse.y - (y - 8)) < 20 && Input.mouse.x > VIEW_W / 2 - 190 && Input.mouse.x < VIEW_W / 2 + 190) {
      G.menuSel = i;
    }
  }
  return Input.pressed('Enter') || Input.pressed('Space') || Input.mouse.clicked;
}

function updateTitle(dt) {
  G.clockMin = (G.clockMin + MIN_PER_SEC * 0.4 * dt) % 1440;
  updateAmbient(dt);
  // A slow drift along the marina front.
  const t = G.time * 0.05;
  G.camera.x = 760 + Math.sin(t) * 190;
  G.camera.y = 1180 + Math.cos(t * 0.8) * 130;
  const items = titleItems();
  if (menuNav(items)) {
    const choice = items[G.menuSel];
    if (choice === 'NEW GAME') startNewGame();
    else if (choice === 'CONTINUE') startFromSave();
    else if (choice === 'HOW TO PLAY') G.mode = 'help';
  }
}

function updateHelp() {
  if (Input.pressed('Escape') || Input.mouse.clicked) G.mode = 'title';
}

function updatePause() {
  if (Input.pressed('Escape') || Input.pressed('KeyP')) { G.mode = 'play'; return; }
  if (menuNav(PAUSE_ITEMS)) {
    const choice = PAUSE_ITEMS[G.menuSel];
    if (choice === 'RESUME') G.mode = 'play';
    else if (choice === 'SAVE GAME') {
      persistSave();
      G.hasSave = true;
      G.banner = { title: 'SAVED', sub: 'Palmera Bay will remember this.', t: 0, dur: 1.6 };
      G.mode = 'play';
    } else if (choice === 'QUIT TO TITLE') {
      buildWorld(7);
      G.mode = 'title';
      G.menuSel = 0;
      if (G.sfx) { G.sfx.setEngine(false); G.sfx.setSiren(false); }
    }
  }
}

function update(dt) {
  G.time += dt;
  if (G.flags.interact) { /* consumed by missions within the same step */ }
  switch (G.mode) {
    case 'title': updateTitle(dt); break;
    case 'help': updateHelp(); break;
    case 'pause': updatePause(); break;
    case 'busted':
    case 'wasted':
      G.overT += dt;
      updateAmbient(dt);
      if (G.overT > 2.4) respawn();
      break;
    case 'play':
      if (Input.pressed('Escape') || Input.pressed('KeyP')) {
        G.mode = 'pause';
        G.menuSel = 0;
        break;
      }
      updatePlay(dt);
      break;
  }
  if (Input.pressed('KeyM')) {
    G.sfx.unlock();
    G.sfx.setMuted(!G.sfx.muted);
  }
  G.flags.interact = false;
  Input.endFrame();
}

/* ---------------- the loop ---------------- */

function render() {
  drawScene(ctx);
  if (G.mode === 'title') { drawHUDTitleSafe(); drawTitle(ctx); }
  else if (G.mode === 'help') { drawTitle(ctx); drawHelp(ctx); }
  else if (G.mode === 'pause') { drawHUD(ctx); drawPause(ctx); }
  else if (G.mode === 'busted') { drawHUD(ctx); drawEndScreen(ctx, 'busted'); }
  else if (G.mode === 'wasted') { drawHUD(ctx); drawEndScreen(ctx, 'wasted'); }
  else drawHUD(ctx);
}

// On the title screen the world is the menu's backdrop; only the banner
// layer of the HUD belongs there (drawHUD needs a player focus).
function drawHUDTitleSafe() {
  if (G.banner) {
    G.banner.t += 0.016;
    if (G.banner.t >= G.banner.dur) G.banner = null;
  }
}

let last = performance.now();
let acc = 0;
let shotFrames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25;
  acc += elapsed;
  while (acc >= STEP) {
    if (!isShot) update(STEP);
    acc -= STEP;
  }
  if (isShot) {
    // Hold the staged scene perfectly still apart from light and water.
    G.time += 1 / 60;
  }
  render();
  if (isShot && ++shotFrames >= 4) {
    window.__SHOT_READY = true;
  }
}
requestAnimationFrame(frame);

// The first pointer or key press unlocks audio (browser policy).
window.addEventListener('pointerdown', () => { G.sfx.unlock(); if (!isShot && G.mode === 'play') G.sfx.startMusic(); }, { passive: true });
window.addEventListener('keydown', () => { G.sfx.unlock(); }, { passive: true });
