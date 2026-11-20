// Everything the camera sees: the bay and the beach, the avenues with
// their markings, the extruded buildings of six districts, palms and
// lamps, cars with lit windows and flashing light bars, the people, the
// objective beacon — and, over it all, the day/night light of Palmera Bay.
import { G } from './state.js';
import {
  VIEW_W, VIEW_H, WORLD_W, WORLD_H, ROAD_W, ROADS_X, ROADS_Y,
  WATER_X, BEACH_X, PALETTE, clamp, lerp,
} from './config.js';
import { districtAt } from './city.js';
import { FX } from './effects.js';

/** 0 in daylight, 1 in the small hours; smooth ramps at dawn and dusk. */
export function nightFactor() {
  const h = (G.clockMin % 1440) / 60;
  if (h >= 7 && h < 17.5) return 0;
  if (h >= 19.5 || h < 5) return 1;
  if (h >= 17.5 && h < 19.5) return (h - 17.5) / 2;
  return 1 - (h - 5) / 2; // 05:00–07:00 dawn ramp
}

function viewRect() {
  return {
    x0: G.camera.x - VIEW_W / 2 - 90, y0: G.camera.y - VIEW_H / 2 - 90,
    x1: G.camera.x + VIEW_W / 2 + 90, y1: G.camera.y + VIEW_H / 2 + 90,
  };
}

function inView(v, x, y, pad = 0) {
  return x > v.x0 - pad && x < v.x1 + pad && y > v.y0 - pad && y < v.y1 + pad;
}

function drawGround(ctx, v) {
  // Water first, with slow moving glints.
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(v.x0, v.y0, Math.max(0, WATER_X + 46 - v.x0), v.y1 - v.y0);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = Math.floor(v.y0 / 64) * 64; y < v.y1; y += 64) {
    for (let x = -40; x < WATER_X + 30; x += 90) {
      const wx = x + Math.sin(G.time * 0.7 + y * 0.05 + x) * 9;
      ctx.moveTo(wx, y + (x % 128 === 0 ? 10 : 34));
      ctx.lineTo(wx + 26, y + (x % 128 === 0 ? 10 : 34));
    }
  }
  ctx.stroke();
  // Sand, then the city slab.
  ctx.fillStyle = PALETTE.sandWet;
  ctx.fillRect(WATER_X, v.y0, BEACH_X - WATER_X + 26, v.y1 - v.y0);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(WATER_X + 22, v.y0, BEACH_X - WATER_X, v.y1 - v.y0);
  ctx.fillStyle = PALETTE.sidewalk;
  ctx.fillRect(BEACH_X, v.y0, v.x1 - BEACH_X, v.y1 - v.y0);

  // District ground inside each block.
  const xEdges = [BEACH_X];
  for (const cx of ROADS_X) { xEdges.push(cx - ROAD_W / 2, cx + ROAD_W / 2); }
  xEdges.push(WORLD_W);
  const yEdges = [0];
  for (const cy of ROADS_Y) { yEdges.push(cy - ROAD_W / 2, cy + ROAD_W / 2); }
  yEdges.push(WORLD_H);
  for (let xi = 0; xi < xEdges.length - 1; xi += 2) {
    for (let yi = 0; yi < yEdges.length - 1; yi += 2) {
      const bx = xEdges[xi] + 13, by = yEdges[yi] + 13;
      const bw = xEdges[xi + 1] - xEdges[xi] - 26, bh = yEdges[yi + 1] - yEdges[yi] - 26;
      if (bw <= 0 || bh <= 0) continue;
      if (!inView(v, bx + bw / 2, by + bh / 2, Math.max(bw, bh))) continue;
      const d = districtAt(bx + bw / 2, by + bh / 2);
      ctx.fillStyle = d === 'Suburbs' ? PALETTE.grass : d === 'Industrial' ? PALETTE.dirt
        : d === 'Marina' || d === 'Palm Beach' ? PALETTE.pavers : PALETTE.concrete;
      ctx.fillRect(bx, by, bw, bh);
    }
  }

  // Avenues.
  ctx.fillStyle = PALETTE.asphalt;
  for (const cx of ROADS_X) ctx.fillRect(cx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const cy of ROADS_Y) ctx.fillRect(0, cy - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.fillStyle = PALETTE.asphaltEdge;
  for (const cx of ROADS_X) { ctx.fillRect(cx - ROAD_W / 2, 0, 3, WORLD_H); ctx.fillRect(cx + ROAD_W / 2 - 3, 0, 3, WORLD_H); }
  for (const cy of ROADS_Y) { ctx.fillRect(0, cy - ROAD_W / 2, WORLD_W, 3); ctx.fillRect(0, cy + ROAD_W / 2 - 3, WORLD_W, 3); }

  // Lane dashes.
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  for (const cx of ROADS_X) { ctx.moveTo(cx - ROAD_W / 4, 0); ctx.lineTo(cx - ROAD_W / 4, WORLD_H); ctx.moveTo(cx + ROAD_W / 4, 0); ctx.lineTo(cx + ROAD_W / 4, WORLD_H); }
  for (const cy of ROADS_Y) { ctx.moveTo(0, cy - ROAD_W / 4); ctx.lineTo(WORLD_W, cy - ROAD_W / 4); ctx.moveTo(0, cy + ROAD_W / 4); ctx.lineTo(WORLD_W, cy + ROAD_W / 4); }
  ctx.stroke();
  ctx.strokeStyle = PALETTE.laneYellow;
  ctx.beginPath();
  for (const cx of ROADS_X) { ctx.moveTo(cx, 0); ctx.lineTo(cx, WORLD_H); }
  for (const cy of ROADS_Y) { ctx.moveTo(0, cy); ctx.lineTo(WORLD_W, cy); }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Crosswalks at the intersections.
  ctx.fillStyle = PALETTE.crosswalk;
  ctx.globalAlpha = 0.5;
  for (const cx of ROADS_X) {
    for (const cy of ROADS_Y) {
      if (!inView(v, cx, cy, 130)) continue;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(cx - ROAD_W / 2 - 14, cy + i * 22 - 6, 12, 12);
        ctx.fillRect(cx + ROAD_W / 2 + 2, cy + i * 22 - 6, 12, 12);
        ctx.fillRect(cx + i * 22 - 6, cy - ROAD_W / 2 - 14, 12, 12);
        ctx.fillRect(cx + i * 22 - 6, cy + ROAD_W / 2 + 2, 12, 12);
      }
    }
  }
  ctx.globalAlpha = 1;

  // The respray lot.
  const z = G.city.spray.zone;
  ctx.fillStyle = '#57504a';
  ctx.fillRect(z.x - 8, z.y - 8, z.w + 16, z.h + 16);
  ctx.fillStyle = '#6e665c';
  ctx.fillRect(z.x, z.y, z.w, z.h);
  ctx.save();
  ctx.translate(z.x + z.w / 2, z.y + z.h / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '700 21px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHINE & GO', 0, 7);
  ctx.restore();
}

function drawPackagesAndPickups(ctx, v) {
  for (const pkg of G.city.packages) {
    if (pkg.taken || !inView(v, pkg.x, pkg.y, 30)) continue;
    const bob = Math.sin(G.time * 3 + pkg.id) * 3;
    ctx.save();
    ctx.translate(pkg.x, pkg.y + bob);
    ctx.rotate(G.time * 1.6 + pkg.id);
    ctx.fillStyle = '#ffd83c';
    ctx.strokeStyle = '#a87f00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 11 : 5;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  for (const pk of G.pickups) {
    if (!inView(v, pk.x, pk.y, 30)) continue;
    const bob = Math.sin(G.time * 4 + pk.x) * 2;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#3f9e4d';
      ctx.fillRect(pk.x - 10, pk.y - 6 + bob, 20, 12);
      ctx.fillStyle = '#bfe8c4';
      ctx.fillRect(pk.x - 3, pk.y - 6 + bob, 6, 12);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(pk.x - 10, pk.y - 10 + bob, 20, 20);
      ctx.fillStyle = '#e0483e';
      ctx.fillRect(pk.x - 3, pk.y - 7 + bob, 6, 14);
      ctx.fillRect(pk.x - 7, pk.y - 3 + bob, 14, 6);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(pk.x - 10, pk.y - 7 + bob, 20, 14);
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(pk.x - 7, pk.y - 4 + bob, 4, 8);
      ctx.fillRect(pk.x + 3, pk.y - 4 + bob, 4, 8);
    }
  }
}

function drawProps(ctx, v, night) {
  for (const prop of G.city.props) {
    if (!inView(v, prop.x, prop.y, 60)) continue;
    if (prop.kind === 'palm') {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(prop.x + 5, prop.y + 7);
      ctx.quadraticCurveTo(prop.x + 8, prop.y - 6, prop.x + 13 * (prop.lean > 0 ? 1 : -1) * Math.abs(prop.lean) * 6, prop.y - 13);
      ctx.stroke();
      ctx.strokeStyle = '#8a6b42';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y + 4);
      ctx.quadraticCurveTo(prop.x + 2, prop.y - 6, prop.x + prop.lean * 46, prop.y - 14);
      ctx.stroke();
      const tx = prop.x + prop.lean * 46, ty = prop.y - 14;
      ctx.strokeStyle = '#3f8f4f';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + Math.cos(a) * 13 * prop.s, ty + Math.sin(a) * 9 * prop.s - 2, tx + Math.cos(a) * 21 * prop.s, ty + Math.sin(a) * 13 * prop.s + 4);
        ctx.stroke();
      }
      ctx.fillStyle = '#6d4c2a';
      ctx.beginPath();
      ctx.arc(tx, ty, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'bench') {
      ctx.fillStyle = '#7a5c38';
      ctx.fillRect(prop.x - 11, prop.y - 4, 22, 8);
      ctx.fillStyle = '#96754a';
      ctx.fillRect(prop.x - 11, prop.y - 4, 22, 3);
    } else if (prop.kind === 'lamp') {
      ctx.fillStyle = '#3c4046';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = night > 0.4 ? '#ffe9a8' : '#cfd4d8';
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.kind === 'sign-pd' || prop.kind === 'sign-hosp') {
      ctx.fillStyle = prop.kind === 'sign-pd' ? '#274b8f' : '#e8e8e8';
      ctx.fillRect(prop.x - 11, prop.y - 11, 22, 22);
      ctx.fillStyle = prop.kind === 'sign-pd' ? '#ffffff' : '#e0483e';
      ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(prop.kind === 'sign-pd' ? 'P' : 'H', prop.x, prop.y + 5);
      ctx.textAlign = 'left';
    }
  }
}

function drawBuildings(ctx, v) {
  for (const b of G.city.buildings) {
    if (!inView(v, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) + b.height)) continue;
    const lift = b.height * 0.34;
    // Shadow, then the extruded south wall, then the roof.
    ctx.fillStyle = 'rgba(20,20,30,0.20)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = shade(b.color, -34);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w, b.y + b.h - lift);
    ctx.lineTo(b.x, b.y + b.h - lift);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y - lift, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x, b.y - lift, b.w, b.h);
    // Roof furniture and parapet.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 5, b.y - lift + 5, b.w - 10, b.h - 10);
    if (b.kind === 'tower') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + b.w * 0.18, b.y - lift + b.h * 0.16, b.w * 0.2, b.h * 0.18);
      ctx.fillRect(b.x + b.w * 0.6, b.y - lift + b.h * 0.55, b.w * 0.16, b.h * 0.14);
    } else if (b.kind === 'house') {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(b.x + 4, b.y - lift + b.h / 2);
      ctx.lineTo(b.x + b.w - 4, b.y - lift + b.h / 2);
      ctx.stroke();
    } else if (b.kind === 'bar') {
      ctx.fillStyle = '#8a5a20';
      ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('THE GILDED GULL', b.x + b.w / 2, b.y - lift + b.h / 2 + 4);
      ctx.textAlign = 'left';
    }
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

export function drawCarShape(ctx, car, night) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(15,15,20,0.30)';
  ctx.fillRect(-car.len / 2 + 3, -car.wid / 2 + 5, car.len, car.wid);
  // Wheels.
  ctx.fillStyle = '#17181c';
  const wx = car.len / 2 - 11, wy = car.wid / 2 - 2;
  ctx.fillRect(-wx - 4, -wy - 3, 11, 6);
  ctx.fillRect(wx - 7, -wy - 3, 11, 6);
  ctx.fillRect(-wx - 4, wy - 3, 11, 6);
  ctx.fillRect(wx - 7, wy - 3, 11, 6);
  // Body.
  ctx.fillStyle = car.dead ? '#3a3a3e' : car.color;
  roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (car.type === 'police') {
    ctx.fillStyle = '#eef1f4';
    ctx.fillRect(-8, -car.wid / 2 + 2, 17, car.wid - 4);
  }
  if (car.type === 'truck') {
    ctx.fillStyle = shade(car.color, 18);
    ctx.fillRect(-car.len / 2 + 4, -car.wid / 2 + 3, car.len * 0.52, car.wid - 6);
    ctx.fillStyle = 'rgba(190,220,235,0.85)';
    ctx.fillRect(car.len * 0.22, -car.wid / 2 + 4, 7, car.wid - 8);
  } else {
    // Cabin and glass.
    ctx.fillStyle = 'rgba(16,24,32,0.88)';
    roundRect(ctx, -car.len * 0.16, -car.wid / 2 + 3.5, car.len * 0.36, car.wid - 7, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(170,215,235,0.5)';
    ctx.fillRect(car.len * 0.13, -car.wid / 2 + 4.5, 4, car.wid - 9);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#23232b';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = '#ffd83c';
    ctx.font = '700 8px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
    ctx.textAlign = 'left';
  }
  if (car.type === 'sport') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-car.len / 2 + 1, -car.wid / 2 + 3, 5, car.wid - 6);
  }
  if (car.isTarget) {
    ctx.strokeStyle = '#ffd83c';
    ctx.lineWidth = 2;
    roundRect(ctx, -car.len / 2 - 4, -car.wid / 2 - 4, car.len + 8, car.wid + 8, 8);
    ctx.stroke();
  }
  // Police light bar, flashing.
  if (car.type === 'police') {
    const phase = Math.floor(G.time * 5 + car.x) % 2 === 0;
    ctx.fillStyle = phase ? '#ff4444' : '#7a1616';
    ctx.fillRect(-7, -car.wid / 2 + 3, 6, car.wid / 2 - 3);
    ctx.fillStyle = phase ? '#2850ff' : '#16277a';
    ctx.fillRect(1, 0, 6, car.wid / 2 - 3);
  }
  // Headlights after dark.
  if (night > 0.35) {
    ctx.fillStyle = 'rgba(255,240,190,0.9)';
    ctx.fillRect(car.len / 2 - 2, -car.wid / 2 + 3, 3, 5);
    ctx.fillRect(car.len / 2 - 2, car.wid / 2 - 8, 3, 5);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPerson(ctx, x, y, angle, phase, shirt, skin, opts = {}) {
  ctx.fillStyle = 'rgba(15,15,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 4, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (opts.down) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    roundRect(ctx, -5, -11, 10, 22, 4);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -15, 5.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(phase) * 1.6;
  // Legs.
  ctx.strokeStyle = '#2c2f38';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(x, y + 2);
  ctx.lineTo(x + Math.cos(angle + 2.5) * 6 + Math.sin(phase) * 2.4, y + Math.sin(angle + 2.5) * 6);
  ctx.moveTo(x, y + 2);
  ctx.lineTo(x + Math.cos(angle - 2.5) * 6 - Math.sin(phase) * 2.4, y + Math.sin(angle - 2.5) * 6);
  ctx.stroke();
  // Torso and head.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(x, y + bob * 0.3, 7.4, 0, Math.PI * 2);
  ctx.fill();
  if (opts.cap) {
    ctx.fillStyle = '#1d2f57';
    ctx.beginPath();
    ctx.arc(x, y + bob * 0.3, 7.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, y + bob * 0.3, 4.6, 0, Math.PI * 2);
  ctx.fill();
  if (opts.cap) {
    ctx.fillStyle = '#1d2f57';
    ctx.beginPath();
    ctx.arc(x, y - 1.6 + bob * 0.3, 4.8, Math.PI, Math.PI * 2);
    ctx.fill();
  }
}

function drawMarker(ctx, v) {
  const m = G.marker;
  if (!m) return;
  const pulse = 1 + Math.sin(G.time * 5) * 0.12;
  if (inView(v, m.x, m.y, 60)) {
    const grad = ctx.createLinearGradient(0, m.y - 190, 0, m.y);
    grad.addColorStop(0, 'rgba(255,216,60,0)');
    grad.addColorStop(1, 'rgba(255,216,60,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(m.x - 13, m.y - 190, 26, 190);
    ctx.strokeStyle = '#ffd83c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, 26 * pulse, 12 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (m.label) {
      ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd83c';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      const ly = m.y - 196 - Math.sin(G.time * 5) * 4;
      ctx.strokeText(m.label, m.x, ly);
      ctx.fillText(m.label, m.x, ly);
      ctx.textAlign = 'left';
    }
  }
}

export function drawScene(ctx) {
  const night = nightFactor();
  const shX = G.shakeMag ? (Math.random() - 0.5) * G.shakeMag * 2 : 0;
  const shY = G.shakeMag ? (Math.random() - 0.5) * G.shakeMag * 2 : 0;
  const v = viewRect();

  ctx.fillStyle = '#0e2a3a';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(VIEW_W / 2 - G.camera.x + shX, VIEW_H / 2 - G.camera.y + shY);

  drawGround(ctx, v);
  FX.drawSkids(ctx);
  drawPackagesAndPickups(ctx, v);
  drawProps(ctx, v, night);
  drawBuildings(ctx, v);
  drawMarker(ctx, v);

  for (const car of G.cars) {
    if (inView(v, car.x, car.y, 90)) drawCarShape(ctx, car, night);
  }
  for (const ped of G.peds) {
    if (inView(v, ped.x, ped.y, 30)) {
      drawPerson(ctx, ped.x, ped.y, ped.angle, ped.phase, ped.shirt, ped.skin, { down: ped.state === 'down' });
    }
  }
  for (const off of G.officers) {
    if (inView(v, off.x, off.y, 30)) {
      drawPerson(ctx, off.x, off.y, off.angle, off.phase, '#274b8f', '#e8b98d', { cap: true });
    }
  }
  const p = G.player;
  if (p && p.state === 'foot') {
    drawPerson(ctx, p.x, p.y, p.angle, p.stepPhase, '#12b5a5', '#c98a54', {});
    // The aim arm and, when carried, the pistol.
    ctx.strokeStyle = '#c98a54';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.aim) * 13, p.y + Math.sin(p.aim) * 13);
    ctx.stroke();
    if (p.weapon === 'pistol') {
      ctx.save();
      ctx.translate(p.x + Math.cos(p.aim) * 14, p.y + Math.sin(p.aim) * 14);
      ctx.rotate(p.aim);
      ctx.fillStyle = '#22242a';
      ctx.fillRect(0, -2, 11, 4);
      ctx.restore();
    }
    // A name tag in the screenshot scenes' stillness: Reyes reads clearly.
    ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('REYES', p.x, p.y - 18);
    ctx.textAlign = 'left';
  }

  FX.drawParts(ctx);
  FX.drawTexts(ctx);
  ctx.restore();

  drawLighting(ctx, night, v);
}

function drawLighting(ctx, night, v) {
  // Dusk warmth.
  const h = (G.clockMin % 1440) / 60;
  if (h >= 16.5 && h < 19.5) {
    ctx.fillStyle = 'rgba(255,140,60,' + (0.10 * (1 - Math.abs(h - 18) / 1.5)) + ')';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (night <= 0.02) return;
  ctx.fillStyle = 'rgba(9,14,44,' + (0.52 * night) + ')';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(VIEW_W / 2 - G.camera.x, VIEW_H / 2 - G.camera.y);
  ctx.globalCompositeOperation = 'lighter';
  // Lamp pools.
  for (const prop of G.city.props) {
    if (prop.kind !== 'lamp' || !inView(v, prop.x, prop.y, 80)) continue;
    const g = ctx.createRadialGradient(prop.x, prop.y, 2, prop.x, prop.y, 44);
    g.addColorStop(0, 'rgba(255,214,130,' + 0.30 * night + ')');
    g.addColorStop(1, 'rgba(255,214,130,0)');
    ctx.fillStyle = g;
    ctx.fillRect(prop.x - 44, prop.y - 44, 88, 88);
  }
  // Headlight pools.
  for (const car of G.cars) {
    if (!inView(v, car.x, car.y, 120)) continue;
    const hx = car.x + Math.cos(car.angle) * (car.len / 2 + 26);
    const hy = car.y + Math.sin(car.angle) * (car.len / 2 + 26);
    const g = ctx.createRadialGradient(hx, hy, 2, hx, hy, 56);
    g.addColorStop(0, 'rgba(255,238,180,' + 0.20 * night + ')');
    g.addColorStop(1, 'rgba(255,238,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(hx - 56, hy - 56, 112, 112);
    if (car.type === 'police') {
      const phase = Math.floor(G.time * 5 + car.x) % 2 === 0;
      const g2 = ctx.createRadialGradient(car.x, car.y, 2, car.x, car.y, 74);
      const col = phase ? '255,70,60' : '70,110,255';
      g2.addColorStop(0, 'rgba(' + col + ',' + 0.30 * night + ')');
      g2.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = g2;
      ctx.fillRect(car.x - 74, car.y - 74, 148, 148);
    }
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}
