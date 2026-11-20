// The story of Neon Palms, told in six jobs for Mara Voss of The Gilded
// Gull, plus the everyday work of the city: taxi fares and phone tips.
// A mission is a list of steps (go somewhere, pick something up, beat a
// clock through checkpoints, shake the law); this module runs the steps,
// moves the objective beacon, plays the phone dialogue and pays out.
import { G } from './state.js';
import { dist, fmtMoney, clamp } from './config.js';
import { Input } from './input.js';
import { createCar, CAR_TYPES } from './vehicles.js';
import { setHeat } from './police.js';
import { FX } from './effects.js';
import { sfx } from './audio.js';
import { storeSave } from './save.js';

export const MARA = 'Mara Voss';

export const MISSIONS = [
  {
    title: 'Gull Wing Welcome',
    reward: 400,
    intro: [
      { who: MARA, text: 'Reyes. Sit. You owe Old Sef money, I owe Sef a favour, so now you work for me. Simple arithmetic.' },
      { who: 'Reyes', text: 'You always were kind with numbers, Mara.' },
      { who: MARA, text: 'A cooler is waiting at the Marina docks, south-west corner. Bring it to the Downtown garage on 1500 Avenue. Do not open it.' },
    ],
    steps: [
      { kind: 'pickup', x: 356, y: 1620, r: 52, label: 'Pick up the cooler at the Marina docks' },
      { kind: 'goto', x: 1560, y: 1010, r: 62, label: 'Deliver the cooler to the Downtown garage' },
    ],
    outro: [
      { who: MARA, text: 'Cold and sealed. Good. Four hundred, and Sef hears you are useful. Come back when you want more.' },
    ],
  },
  {
    title: 'Borrowed Wings',
    reward: 650,
    intro: [
      { who: MARA, text: 'A guest at the Palm Beach hotel left his sports car running and his manners at home. Take the car. Leave it at Shine & Go.' },
      { who: 'Reyes', text: 'Grand theft in broad daylight. You spoil me.' },
      { who: MARA, text: 'Daylight is when nobody looks twice. Go.' },
    ],
    steps: [
      { kind: 'getcar', label: 'Steal the marked sports car at the Palm Beach hotel' },
      { kind: 'goto', x: 1171, y: 1105, r: 78, label: 'Park the car at the Shine & Go lot' },
    ],
    outro: [
      { who: MARA, text: 'The hotel is furious, the car is gone, and you are six-fifty richer. The city provides, Reyes.' },
    ],
  },
  {
    title: 'Four Corners',
    reward: 700,
    intro: [
      { who: MARA, text: 'Four of my people, four corners of Palmera Bay, one envelope each. They hate waiting and I hate excuses. Clock is running when you are.' },
    ],
    steps: [
      {
        kind: 'checkpoints', time: 165, label: 'Run the four corners before the clock dies',
        pts: [
          { x: 560, y: 470 }, { x: 2560, y: 470 }, { x: 2560, y: 1830 }, { x: 560, y: 1830 },
        ],
      },
    ],
    outro: [
      { who: MARA, text: 'All four, with time to spare. Sef is starting to ask your name like it is good news.' },
    ],
  },
  {
    title: 'Hot Passenger',
    reward: 900,
    intro: [
      { who: MARA, text: 'Change of plan, and it is not a kind one. I need to be at the Industrial docks in ten minutes and every patrol in the bay just got my photograph.' },
      { who: 'Reyes', text: 'You are the passenger. Of course you are.' },
      { who: MARA, text: 'Pick me up outside the Gull. Drive like the rent is due, and shake them before the docks — I cannot arrive with an escort.' },
    ],
    steps: [
      { kind: 'pickup', x: 330, y: 1252, r: 56, label: 'Pick up Mara outside The Gilded Gull', heat: 300 },
      { kind: 'goto', x: 2450, y: 2050, r: 70, label: 'Drive Mara to the Industrial docks' },
      { kind: 'loseheat', label: 'Lose the police before Mara will get out' },
    ],
    outro: [
      { who: MARA, text: 'Nine hundred. And Reyes — whatever they offered you to hand me over, I will double it when Sef is paid. Remember that.' },
    ],
  },
  {
    title: 'Bay Lights Run',
    reward: 1100,
    intro: [
      { who: MARA, text: 'Every Friday the bay runs an unsanctioned little parade. Six lights, no brakes, winner takes the pot. Tonight the pot is mine and you are driving.' },
    ],
    steps: [
      {
        kind: 'checkpoints', time: 185, label: 'Hit all six bay lights against the clock', night: true,
        pts: [
          { x: 330, y: 960 }, { x: 1060, y: 470 }, { x: 2060, y: 960 },
          { x: 2560, y: 1460 }, { x: 1560, y: 1960 }, { x: 560, y: 1460 },
        ],
      },
    ],
    outro: [
      { who: MARA, text: 'The whole bay saw those lights. Half of it saw your driving. Eleven hundred, champion.' },
    ],
  },
  {
    title: 'The Palmera Score',
    reward: 2000,
    intro: [
      { who: MARA, text: 'Last job, Reyes. Three bags: the Downtown bank, the Industrial warehouse, the Palm Beach jeweller. Take all three, bring them to the Marina hideout. Then your debt is ash.' },
      { who: 'Reyes', text: 'And if the whole bay lights up behind me?' },
      { who: MARA, text: 'Then drive like it, darling. You have had the practice.' },
    ],
    steps: [
      { kind: 'pickup', x: 1620, y: 1180, r: 52, label: 'Take the bag from the Downtown bank', heat: 130 },
      { kind: 'pickup', x: 1150, y: 2080, r: 52, label: 'Take the bag from the Industrial warehouse', heat: 130 },
      { kind: 'pickup', x: 2720, y: 1330, r: 52, label: 'Take the bag from the Palm Beach jeweller', heat: 130 },
      { kind: 'goto', x: 420, y: 700, r: 66, label: 'Bring the bags to the Marina hideout' },
    ],
    outro: [
      { who: MARA, text: 'Three bags, one free Reyes. Sef is paid, the Gull is yours whenever you need a roof, and Palmera Bay... Palmera Bay is yours too. Go and enjoy it.' },
    ],
  },
];

export function buildSaveData() {
  const p = G.player;
  return {
    money: G.money,
    missionsDone: G.missionsDone,
    packagesTaken: G.city ? G.city.packages.filter((pk) => pk.taken).map((pk) => pk.id) : [],
    packagesFound: G.stats.packagesFound,
    faresDone: G.stats.faresDone,
    weapon: p ? p.weapon : 'fist',
    ammo: p ? p.ammo : 0,
    x: p ? Math.round(p.x) : 330,
    y: p ? Math.round(p.y) : 1300,
    clockMin: Math.floor(G.clockMin),
  };
}

export function persistSave() {
  storeSave(buildSaveData());
}

function say(lines, onDone) {
  G.dialogue = { lines, idx: 0, onDone: onDone || null };
}

export function updateDialogue() {
  const d = G.dialogue;
  if (!d) return;
  if (G.flags.interact || Input.mouse.clicked) {
    G.flags.interact = false;
    d.idx += 1;
    sfx('blip');
    if (d.idx >= d.lines.length) {
      const done = d.onDone;
      G.dialogue = null;
      if (done) done();
    }
  }
}

function startMission(idx) {
  const def = MISSIONS[idx];
  const m = { idx, def, step: 0, timer: 0, cpIndex: 0, targetCar: null };
  G.mission = m;
  say(def.intro, () => {
    G.banner = { title: def.title, sub: 'Job ' + (idx + 1) + ' of ' + MISSIONS.length + ' — ' + MARA, t: 0, dur: 2.6 };
    primeStep(m);
  });
}

function primeStep(m) {
  const step = m.def.steps[m.step];
  if (!step) return;
  if (step.kind === 'checkpoints') {
    m.timer = step.time;
    m.cpIndex = 0;
    if (step.night) G.clockMin = 19 * 60 + 35;
  }
  if (step.kind === 'getcar' && !m.targetCar) {
    const car = createCar('sport', 2620, 1330, Math.PI, '#e03a5f');
    car.driver = null;
    car.isTarget = true;
    G.cars.push(car);
    m.targetCar = car;
  }
  if (step.heat) setHeat(Math.max(G.heat, step.heat));
}

function stepPoint(m) {
  const step = m.def.steps[m.step];
  if (!step) return null;
  if (step.kind === 'checkpoints') {
    const pt = step.pts[m.cpIndex];
    return pt ? { x: pt.x, y: pt.y } : null;
  }
  if (step.kind === 'getcar') return m.targetCar ? { x: m.targetCar.x, y: m.targetCar.y } : null;
  if (step.kind === 'loseheat') return null;
  return { x: step.x, y: step.y };
}

function completeMission() {
  const m = G.mission;
  G.money += m.def.reward;
  G.missionsDone = m.idx + 1;
  if (m.idx === 1) {
    // Payment in kind: the Gull's spare pistol changes hands after job two.
    G.player.weapon = 'pistol';
    G.player.ammo += 40;
    G.stats.ammoEver = true;
    FX.text(G.player.x, G.player.y - 44, 'MARA LEFT YOU A PISTOL (+40 ROUNDS)', '#ffd76a', 15);
  }
  if (m.idx === MISSIONS.length - 1) {
    G.storyDone = true;
    G.banner = { title: 'PALMERA BAY IS YOURS', sub: 'Story complete — the city stays open. Fares, packages and trouble remain.', t: 0, dur: 4.5 };
  }
  G.mission = null;
  persistSave();
  sfx('ok');
  say(m.def.outro, null);
}

function failMission(reason) {
  const m = G.mission;
  G.mission = null;
  G.marker = null;
  sfx('fail');
  say([{ who: MARA, text: reason + ' The job is still there when you are ready, Reyes. Come and see me.' }], null);
}

function updateMission(dt) {
  const m = G.mission;
  if (!m) return;
  const step = m.def.steps[m.step];
  if (!step) { completeMission(); return; }
  const p = G.player;
  const pt = stepPoint(m);

  if (step.kind === 'checkpoints') {
    m.timer -= dt;
    if (m.timer <= 0) { failMission('Out of time. The bay does not wait.'); return; }
    G.objective = step.label + ' — light ' + (m.cpIndex + 1) + '/' + step.pts.length + ' — ' + Math.ceil(m.timer) + 's';
  } else if (step.kind === 'loseheat') {
    G.objective = step.label + ' — wanted ' + '★'.repeat(G.stars);
    if (G.stars === 0) {
      m.step += 1;
      if (m.step >= m.def.steps.length) completeMission(); else primeStep(m);
    }
    G.marker = null;
    return;
  } else if (step.kind === 'getcar') {
    G.objective = step.label;
    if (m.targetCar && m.targetCar.driver === 'player') {
      m.step += 1;
      primeStep(m);
    }
  } else {
    G.objective = step.label;
  }

  if (pt) {
    G.marker = { x: pt.x, y: pt.y, label: step.kind === 'checkpoints' ? 'LIGHT ' + (m.cpIndex + 1) : '' };
    const here = p.state === 'car' && p.car ? p.car : p;
    if (dist(here.x, here.y, pt.x, pt.y) < (step.r || 58)) {
      if (step.kind === 'pickup') {
        FX.text(pt.x, pt.y - 26, 'COLLECTED', '#8be09a', 15);
        sfx('pickup');
        if (step.heat) setHeat(Math.max(G.heat, step.heat + 60));
      }
      if (step.kind === 'checkpoints') {
        m.cpIndex += 1;
        sfx('pickup');
        if (m.cpIndex >= step.pts.length) {
          m.step += 1;
          if (m.step >= m.def.steps.length) { completeMission(); return; }
          primeStep(m);
        }
      } else {
        m.step += 1;
        if (m.step >= m.def.steps.length) { completeMission(); return; }
        primeStep(m);
      }
    }
  }
}

/* ---------------- taxi fares ---------------- */

function updateTaxi(dt) {
  const p = G.player;
  if (G.mission) { G.taxi = null; return; }
  if (!G.taxi) {
    if (p.state === 'car' && p.car && p.car.type === 'taxi' && G.stars === 0) {
      G.taxiTimer = (G.taxiTimer || 0) + dt;
      if (G.taxiTimer > 2.5) {
        G.taxiTimer = 0;
        const a = Math.random() * Math.PI * 2;
        const px = clamp(p.x + Math.cos(a) * 420, 320, 3100);
        const py = clamp(p.y + Math.sin(a) * 420, 60, 2340);
        G.taxi = { stage: 'pickup', x: px, y: py, waitT: 0, fare: 0 };
        G.phoneMsg = { from: 'Cab Radio', text: 'Fare waiting nearby — follow the yellow marker.', ttl: 5 };
        sfx('blip');
      }
    }
    return;
  }
  const t = G.taxi;
  if (p.state !== 'car' || !p.car || p.car.type !== 'taxi') {
    G.taxi = null;
    G.phoneMsg = { from: 'Cab Radio', text: 'Fare lost — you left the cab.', ttl: 4 };
    return;
  }
  if (t.stage === 'pickup') {
    G.marker = { x: t.x, y: t.y, label: 'FARE' };
    G.objective = 'Pick up the fare';
    if (dist(p.car.x, p.car.y, t.x, t.y) < 52 && Math.abs(p.car.speed) < 26) {
      t.waitT += dt;
      if (t.waitT > 0.8) {
        const a = Math.random() * Math.PI * 2;
        t.stage = 'dropoff';
        t.x = clamp(p.x + Math.cos(a) * 900, 320, 3100);
        t.y = clamp(p.y + Math.sin(a) * 900, 60, 2340);
        t.fare = Math.round(dist(p.car.x, p.car.y, t.x, t.y) * 0.055) + 12;
        t.startedAt = G.time;
        G.phoneMsg = { from: 'Passenger', text: 'Across town, driver — and step on it.', ttl: 4 };
        sfx('door');
      }
    } else t.waitT = 0;
  } else {
    G.marker = { x: t.x, y: t.y, label: 'DROP' };
    G.objective = 'Drop the fare — ' + fmtMoney(t.fare) + ' on the meter';
    if (dist(p.car.x, p.car.y, t.x, t.y) < 56 && Math.abs(p.car.speed) < 26) {
      const quick = G.time - (t.startedAt || G.time) < 55;
      const pay = t.fare + (quick ? Math.round(t.fare * 0.4) : 0);
      G.money += pay;
      G.stats.faresDone += 1;
      FX.text(p.car.x, p.car.y - 38, 'FARE PAID ' + fmtMoney(pay) + (quick ? ' (fast tip!)' : ''), '#8be09a', 15);
      sfx('cash');
      G.taxi = null;
      G.marker = null;
      G.saveDirty = true;
    }
  }
}

/* ---------------- the top-level mission update ---------------- */

export function updateMissions(dt) {
  G.objectiveHint = '';
  if (G.dialogue) { updateDialogue(); return; }
  if (G.mission) {
    updateMission(dt);
  } else if (G.missionsDone < MISSIONS.length) {
    const spot = G.city.maraSpot;
    const p = G.player;
    G.marker = { x: spot.x, y: spot.y, label: 'MARA' };
    G.objective = 'See Mara Voss at The Gilded Gull — job ' + (G.missionsDone + 1) + ': ' + MISSIONS[G.missionsDone].title;
    if (dist(p.x, p.y, spot.x, spot.y) < 64) {
      G.objectiveHint = 'Press E — talk to Mara Voss';
      if (G.flags.interact) {
        G.flags.interact = false;
        startMission(G.missionsDone);
      }
    }
  } else {
    G.objective = 'Free roam — fares, packages and trouble. Story complete.';
    if (G.marker && G.marker.label === 'MARA') G.marker = null;
  }
  updateTaxi(dt);
  if (!G.mission && G.taxi) { /* taxi sets its own objective above */ }
  else if (!G.mission && !G.taxi && G.missionsDone >= MISSIONS.length) { /* free roam line stays */ }
}

/** The opening call, played once when a new game starts. */
export function introCall() {
  say([
    { who: MARA, text: 'Reyes? You are really in my city. Old Sef sends his love — and his ledger. You owe, I collect, we both eat.' },
    { who: 'Reyes', text: 'Tell me where to start, Mara.' },
    { who: MARA, text: 'My bar, The Gilded Gull, on the sand west of the Marina. Come and see me. And Reyes — the bay is kind to drivers. Walk if you must, but drive if you can.' },
  ], null);
}
