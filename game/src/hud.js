// The screen furniture: health and armour, cash and the clock, the wanted
// stars, the weapon readout, the objective line, the phone, the minimap —
// and the full-screen states: title, pause, busted, wasted. Drawn in
// screen space over render.js's world, every frame, from G alone.
import { G } from './state.js';
import {
  VIEW_W, VIEW_H, WORLD_W, WORLD_H, ROADS_X, ROADS_Y, WATER_X, BEACH_X,
  FONT, clamp, fmtMoney, fmtClock, dist,
} from './config.js';
import { nightFactor } from './render.js';

function star(ctx, x, y, r, filled, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color || '#ffd83c';
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(8,10,16,0.62)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.font = '700 10px ' + FONT;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(label, x + 2, y + h - 2.5);
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const trial = line ? line + ' ' + w : w;
    if (ctx.measureText(trial).width > maxW && line) { lines.push(line); line = w; }
    else line = trial;
  }
  if (line) lines.push(line);
  return lines;
}

const MAP = { x: 18, y: VIEW_H - 168, w: 196, h: 148 };

function drawMinimap(ctx) {
  const { x, y, w, h } = MAP;
  ctx.fillStyle = 'rgba(8,12,20,0.78)';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  const sx = w / WORLD_W, sy = h / WORLD_H;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#14425c';
  ctx.fillRect(x, y, WATER_X * sx, h);
  ctx.fillStyle = '#cbb27f';
  ctx.fillRect(x + WATER_X * sx, y, (BEACH_X - WATER_X) * sx, h);
  ctx.fillStyle = '#596068';
  ctx.fillRect(x + BEACH_X * sx, y, w - BEACH_X * sx, h);
  ctx.strokeStyle = 'rgba(235,235,225,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const cx of ROADS_X) { ctx.moveTo(x + cx * sx, y); ctx.lineTo(x + cx * sx, y + h); }
  for (const cy of ROADS_Y) { ctx.moveTo(x, y + cy * sy); ctx.lineTo(x + w, y + cy * sy); }
  ctx.stroke();
  // Packages still out there.
  ctx.fillStyle = '#ffd83c';
  for (const pkg of G.city.packages) {
    if (!pkg.taken) ctx.fillRect(x + pkg.x * sx - 1.4, y + pkg.y * sy - 1.4, 2.8, 2.8);
  }
  // The respray and Mara.
  ctx.fillStyle = '#8be09a';
  ctx.fillRect(x + G.city.spray.zone.x * sx - 2, y + G.city.spray.zone.y * sy - 2, 4, 4);
  ctx.fillStyle = '#ff9ecb';
  ctx.fillRect(x + G.city.maraSpot.x * sx - 2, y + G.city.maraSpot.y * sy - 2, 4, 4);
  // Police blips.
  for (const car of G.cars) {
    if (car.driver !== 'police') continue;
    ctx.fillStyle = Math.floor(G.time * 4) % 2 === 0 ? '#ff5147' : '#4f7dff';
    ctx.beginPath();
    ctx.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The objective.
  if (G.marker) {
    ctx.strokeStyle = '#ffd83c';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x + G.marker.x * sx, y + G.marker.y * sy, 4.5 + Math.sin(G.time * 5) * 1.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Reyes.
  const p = G.player;
  const px = x + p.x * sx, py = y + p.y * sy;
  const ang = p.state === 'car' && p.car ? p.car.angle : p.angle;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4.4, -4);
  ctx.lineTo(-4.4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.font = '700 10px ' + FONT;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('PALMERA BAY', x + 4, y + 13);
  ctx.fillText('★ ' + G.stats.packagesFound + '/20', x + w - 44, y + 13);
}

function drawDialogue(ctx) {
  const d = G.dialogue;
  const phone = !d && G.phoneMsg && G.phoneMsg.ttl > 0 ? G.phoneMsg : null;
  const line = d ? d.lines[d.idx] : phone ? { who: phone.from, text: phone.text } : null;
  if (!line) return;
  const w = 620, x = (VIEW_W - w) / 2, y = VIEW_H - 118;
  ctx.font = '15px ' + FONT;
  const lines = wrapText(ctx, line.text, w - 36);
  const h = 34 + lines.length * 20 + 14;
  ctx.fillStyle = 'rgba(10,12,20,0.86)';
  ctx.fillRect(x, y - (h - 62), w, h);
  ctx.strokeStyle = d ? '#ffd83c' : '#59c2d6';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y - (h - 62), w, h);
  ctx.font = '700 13px ' + FONT;
  ctx.fillStyle = line.who === 'Reyes' ? '#7ae0d3' : '#ffd83c';
  ctx.fillText(line.who.toUpperCase(), x + 18, y - (h - 62) + 22);
  ctx.font = '15px ' + FONT;
  ctx.fillStyle = '#f2f4f6';
  lines.forEach((ln, i) => ctx.fillText(ln, x + 18, y - (h - 62) + 46 + i * 20));
  if (d) {
    ctx.font = '700 11px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(G.time * 6)) + ')';
    ctx.textAlign = 'right';
    ctx.fillText('E ▸', x + w - 14, y + 48);
    ctx.textAlign = 'left';
  }
}

function drawBanner(ctx) {
  const b = G.banner;
  if (!b) return;
  const a = b.t < 0.3 ? b.t / 0.3 : b.t > b.dur - 0.5 ? Math.max(0, (b.dur - b.t) / 0.5) : 1;
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.font = '800 44px ' + FONT;
  ctx.fillStyle = '#ffd83c';
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = 6;
  ctx.strokeText(b.title, VIEW_W / 2, 196);
  ctx.fillText(b.title, VIEW_W / 2, 196);
  if (b.sub) {
    ctx.font = '600 17px ' + FONT;
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeText(b.sub, VIEW_W / 2, 228);
    ctx.fillText(b.sub, VIEW_W / 2, 228);
  }
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

export function drawHUD(ctx) {
  const p = G.player;
  if (!p) return;
  // Health and armour, top-left.
  bar(ctx, 20, 18, 168, 13, p.health / 100, p.health > 30 ? '#58c96b' : '#e0483e', 'HEALTH');
  bar(ctx, 20, 40, 168, 10, p.armor / 100, '#7d9fc4', 'ARMOUR');

  // Cash, clock and stars, top-right.
  ctx.textAlign = 'right';
  ctx.font = '800 26px ' + FONT;
  ctx.fillStyle = '#8be09a';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 4;
  ctx.strokeText(fmtMoney(G.money), VIEW_W - 20, 40);
  ctx.fillText(fmtMoney(G.money), VIEW_W - 20, 40);
  ctx.font = '700 16px ' + FONT;
  ctx.fillStyle = '#ffffff';
  const night = nightFactor();
  ctx.fillText(fmtClock(G.clockMin) + (night > 0.5 ? '  ☾' : '  ☀'), VIEW_W - 20, 64);
  for (let i = 0; i < 5; i++) {
    star(ctx, VIEW_W - 34 - i * 30, 88, 12, i < G.stars, '#ffd83c');
  }
  if (G.bustedMeter > 0.02) {
    ctx.font = '700 13px ' + FONT;
    ctx.fillStyle = '#ff8a7a';
    ctx.fillText('BUSTED ' + Math.round(G.bustedMeter * 100) + '%', VIEW_W - 20, 116);
  }
  ctx.textAlign = 'left';

  // Objective pill, top-centre.
  if (G.objective) {
    ctx.font = '600 15px ' + FONT;
    let text = G.objective;
    if (G.marker) {
      const d = Math.round(dist(p.x, p.y, G.marker.x, G.marker.y));
      text += '  —  ' + d + 'm';
    }
    const w = ctx.measureText(text).width + 34;
    ctx.fillStyle = 'rgba(8,10,16,0.66)';
    ctx.fillRect((VIEW_W - w) / 2, 14, w, 30);
    ctx.fillStyle = '#ffd83c';
    ctx.fillRect((VIEW_W - w) / 2, 14, 3, 30);
    ctx.fillStyle = '#f2f4f6';
    ctx.fillText(text, (VIEW_W - w) / 2 + 15, 35);
  }
  if (G.objectiveHint) {
    ctx.font = '600 14px ' + FONT;
    const w = ctx.measureText(G.objectiveHint).width + 26;
    ctx.fillStyle = 'rgba(8,10,16,0.6)';
    ctx.fillRect((VIEW_W - w) / 2, 50, w, 26);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(G.objectiveHint, (VIEW_W - w) / 2 + 13, 68);
  }

  // Weapon and speed, bottom-right.
  ctx.textAlign = 'right';
  if (p.state === 'car' && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    ctx.font = '800 30px ' + FONT;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(kmh + '', VIEW_W - 20, VIEW_H - 52);
    ctx.font = '600 12px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('KM/H  ·  ' + p.car.type.toUpperCase() + (p.car.dead ? '  ·  WRECKED' : ''), VIEW_W - 20, VIEW_H - 34);
  } else {
    ctx.font = '700 16px ' + FONT;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(p.weapon === 'pistol' ? 'PISTOL  ' + p.ammo : 'FISTS', VIEW_W - 20, VIEW_H - 36);
    ctx.font = '600 11px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(p.weapon === 'pistol' ? 'Click / J — fire · Q — fists' : 'Click / J — punch · E — enter car', VIEW_W - 20, VIEW_H - 18);
  }
  ctx.textAlign = 'left';

  drawMinimap(ctx);
  drawDialogue(ctx);
  drawBanner(ctx);

  // Hurt vignette.
  if (G.hurtT > 0) {
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.36, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
    g.addColorStop(0, 'rgba(200,30,20,0)');
    g.addColorStop(1, 'rgba(200,30,20,' + 0.4 * Math.min(1, G.hurtT * 2.4) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

/* ---------------- full-screen states ---------------- */

function menuItems(ctx, items, sel, cx, y0, gap = 44) {
  ctx.textAlign = 'center';
  items.forEach((item, i) => {
    const y = y0 + i * gap;
    if (i === sel) {
      ctx.fillStyle = 'rgba(255,216,60,0.16)';
      ctx.fillRect(cx - 170, y - 26, 340, 36);
      ctx.fillStyle = '#ffd83c';
      ctx.font = '700 22px ' + FONT;
      ctx.fillText('▸ ' + item + ' ◂', cx, y);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 20px ' + FONT;
      ctx.fillText(item, cx, y);
    }
  });
  ctx.textAlign = 'left';
}

export function titleItems() {
  return ['NEW GAME', ...(G.hasSave ? ['CONTINUE'] : []), 'HOW TO PLAY'];
}

export function drawTitle(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, 'rgba(24,10,44,0.42)');
  grad.addColorStop(0.55, 'rgba(120,30,80,0.30)');
  grad.addColorStop(1, 'rgba(8,8,18,0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.textAlign = 'center';
  ctx.font = '800 92px ' + FONT;
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#ffe95e';
  ctx.fillText('NEON PALMS', VIEW_W / 2, 208);
  ctx.shadowBlur = 0;
  ctx.font = '600 25px ' + FONT;
  ctx.fillStyle = '#7ae0d3';
  ctx.fillText('P A L M E R A   B A Y', VIEW_W / 2, 252);
  ctx.font = '400 16px ' + FONT;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('One driver. One debt. Six jobs for Mara Voss — and a whole city that is watching.', VIEW_W / 2, 292);

  menuItems(ctx, titleItems(), G.menuSel, VIEW_W / 2, 372);

  ctx.font = '500 14px ' + FONT;
  ctx.fillStyle = 'rgba(255,255,255,0.66)';
  ctx.fillText('WASD drive & walk · E enter cars / talk · Shift sprint · Mouse aim, click to fight · Q swap weapon · P pause · M mute', VIEW_W / 2, VIEW_H - 30);
  ctx.textAlign = 'left';
}

export function drawHelp(ctx) {
  ctx.fillStyle = 'rgba(6,8,14,0.9)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = '800 34px ' + FONT;
  ctx.fillStyle = '#ffd83c';
  ctx.fillText('HOW TO PLAY', VIEW_W / 2, 110);
  ctx.font = '400 17px ' + FONT;
  ctx.fillStyle = '#eef1f5';
  const lines = [
    'Walk with WASD or the arrow keys. Hold Shift to sprint.',
    'Press E beside any car to take it — traffic drivers object, and witnesses talk.',
    'Drive with WASD. E again to get out. Space is the handbrake... it is not fitted. Drive kindly.',
    'Aim with the mouse. Click (or J) to punch — or to fire, once Mara trusts you with a pistol. Q swaps.',
    'Stars are trouble: crimes seen by pedestrians or police raise them, and the PD answers in kind.',
    'Lose the heat, or pay Shine & Go (green square on the map) $300 for a respray and a cold trail.',
    'Follow the gold beacon to Mara at The Gilded Gull for story jobs. Taxis pay fares. Stars hide packages.',
    'Your progress saves itself when a job ends — and from the pause menu, whenever you like.',
  ];
  lines.forEach((ln, i) => ctx.fillText(ln, VIEW_W / 2, 168 + i * 34));
  ctx.font = '600 16px ' + FONT;
  ctx.fillStyle = '#7ae0d3';
  ctx.fillText('Press Esc or click to go back', VIEW_W / 2, 168 + lines.length * 34 + 26);
  ctx.textAlign = 'left';
}

export const PAUSE_ITEMS = ['RESUME', 'SAVE GAME', 'QUIT TO TITLE'];

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(6,8,14,0.68)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = '800 40px ' + FONT;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PAUSED', VIEW_W / 2, 240);
  ctx.textAlign = 'left';
  menuItems(ctx, PAUSE_ITEMS, G.menuSel, VIEW_W / 2, 330);
}

export function drawEndScreen(ctx, kind) {
  const busted = kind === 'busted';
  ctx.fillStyle = busted ? 'rgba(30,40,90,0.55)' : 'rgba(70,10,10,0.5)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = '800 84px ' + FONT;
  ctx.fillStyle = busted ? '#9db9ff' : '#ff6a5e';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 22;
  ctx.fillText(busted ? 'BUSTED' : 'WASTED', VIEW_W / 2, 320);
  ctx.shadowBlur = 0;
  ctx.font = '600 19px ' + FONT;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(
    busted
      ? 'The Palmera Bay PD processed you, fined you ' + fmtMoney(G.fine) + ', and kept your wanted level as a souvenir.'
      : 'St. Solana General patched you up and billed you ' + fmtMoney(G.fine) + '. The bay is still out there.',
    VIEW_W / 2, 366,
  );
  ctx.textAlign = 'left';
}
