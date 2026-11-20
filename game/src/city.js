// Palmera Bay itself: a grid of avenues over six districts, generated once
// from the run's seed. Produces the building colliders, the street props,
// the respray lot, Mara's bar, the respawn points and the hidden packages,
// plus the spatial questions the rest of the game asks (road? water? which
// district? push this circle out of the buildings).
import {
  WORLD_W, WORLD_H, ROAD_W, ROADS_X, ROADS_Y, WATER_X, BEACH_X,
  ROOF_COLORS, PACKAGE_COUNT, clamp,
} from './config.js';

export function districtAt(x, y) {
  if (x < WATER_X) return 'The Bay';
  if (x < BEACH_X) return 'Palm Beach';
  if (x > 2380 && y > 1050 && y < 1750) return 'Palm Beach';
  if (x > 940 && x < 2260 && y > 560 && y < 1760) return 'Downtown';
  if (y >= 1760) return 'Industrial';
  if (y <= 560) return 'Suburbs';
  if (x <= 940) return 'Marina';
  return 'Palm Beach';
}

export function isRoad(x, y) {
  for (const cx of ROADS_X) if (Math.abs(x - cx) <= ROAD_W / 2) return true;
  for (const cy of ROADS_Y) if (Math.abs(y - cy) <= ROAD_W / 2) return true;
  return false;
}

export function isWater(x, y) {
  return x < WATER_X;
}

function makeBuilding(rng, x, y, w, h, district) {
  const kind = district === 'Downtown' ? 'tower'
    : district === 'Suburbs' ? 'house'
      : district === 'Industrial' ? 'warehouse' : 'block';
  const floors = kind === 'tower' ? rng.int(6, 14) : kind === 'block' ? rng.int(3, 6) : kind === 'warehouse' ? 1 : rng.int(1, 2);
  const colors = ROOF_COLORS[district] || ROOF_COLORS.Marina;
  return {
    x, y, w, h, district, kind, floors,
    height: floors * 9 + rng.int(0, 8),
    color: colors[rng.int(0, colors.length - 1)],
    trim: rng.chance(0.5),
  };
}

/**
 * Build the whole city. `sprayCell` is reserved by hand: the block east of
 * the 1000 avenue between the 900 and 1400 streets becomes the Shine & Go
 * lot, so its buildings are placed to leave a drive-in forecourt.
 */
export function buildCity(rng) {
  const buildings = [];
  const props = [];

  const xEdges = [BEACH_X];
  for (const cx of ROADS_X) { xEdges.push(cx - ROAD_W / 2, cx + ROAD_W / 2); }
  xEdges.push(WORLD_W);
  const yEdges = [0];
  for (const cy of ROADS_Y) { yEdges.push(cy - ROAD_W / 2, cy + ROAD_W / 2); }
  yEdges.push(WORLD_H);

  const spray = { zone: { x: 1096, y: 1010, w: 150, h: 190 }, sign: { x: 1171, y: 985 } };

  for (let xi = 0; xi < xEdges.length - 1; xi += 2) {
    for (let yi = 0; yi < yEdges.length - 1; yi += 2) {
      const bx0 = xEdges[xi], bx1 = xEdges[xi + 1];
      const by0 = yEdges[yi], by1 = yEdges[yi + 1];
      const bw = bx1 - bx0, bh = by1 - by0;
      if (bw < 150 || bh < 150) continue;
      const district = districtAt((bx0 + bx1) / 2, (by0 + by1) / 2);
      const isSprayCell = bx0 === ROADS_X[1] + ROAD_W / 2 && by0 === ROADS_Y[1] + ROAD_W / 2;
      const inset = 26;
      const ix = bx0 + inset, iy = by0 + inset, iw = bw - inset * 2, ih = bh - inset * 2;

      if (isSprayCell) {
        // The respray garage sits at the back of its lot; the forecourt stays open.
        buildings.push(makeBuilding(rng, ix + iw - 128, iy + 8, 120, ih - 16, district));
        buildings.push(makeBuilding(rng, ix, iy + ih - 74, 150, 66, district));
        continue;
      }

      const layout = district === 'Downtown' ? rng.int(1, 2)
        : district === 'Suburbs' ? 4
          : district === 'Industrial' ? rng.int(1, 2) : rng.int(2, 3);
      const gap = 16;
      if (layout === 1) {
        buildings.push(makeBuilding(rng, ix + 6, iy + 6, iw - 12, ih - 12, district));
      } else if (layout === 2) {
        const vertical = bw >= bh;
        if (vertical) {
          const w1 = (iw - gap) / 2;
          buildings.push(makeBuilding(rng, ix, iy, w1, ih, district));
          buildings.push(makeBuilding(rng, ix + w1 + gap, iy, w1, ih, district));
        } else {
          const h1 = (ih - gap) / 2;
          buildings.push(makeBuilding(rng, ix, iy, iw, h1, district));
          buildings.push(makeBuilding(rng, ix, iy + h1 + gap, iw, h1, district));
        }
      } else if (layout === 3) {
        const w1 = (iw - gap) * 0.55;
        buildings.push(makeBuilding(rng, ix, iy, w1, ih, district));
        const h2 = (ih - gap) / 2;
        buildings.push(makeBuilding(rng, ix + w1 + gap, iy, iw - w1 - gap, h2, district));
        buildings.push(makeBuilding(rng, ix + w1 + gap, iy + h2 + gap, iw - w1 - gap, h2, district));
      } else {
        const w1 = (iw - gap) / 2, h1 = (ih - gap) / 2;
        buildings.push(makeBuilding(rng, ix, iy, w1, h1, district));
        buildings.push(makeBuilding(rng, ix + w1 + gap, iy, w1, h1, district));
        buildings.push(makeBuilding(rng, ix, iy + h1 + gap, w1, h1, district));
        buildings.push(makeBuilding(rng, ix + w1 + gap, iy + h1 + gap, w1, h1, district));
      }
    }
  }

  // Mara's beach bar, The Gilded Gull: one hut on the sand with a clear apron.
  const bar = { x: 268, y: 1140, w: 120, h: 74 };
  buildings.push({ ...bar, district: 'Marina', kind: 'bar', floors: 1, height: 14, color: '#caa06a', trim: true });
  const maraSpot = { x: 330, y: 1252 };

  // Palms along the beach and scattered through the streets.
  for (let y = 60; y < WORLD_H - 40; y += rng.int(80, 150)) {
    props.push({ x: rng.range(150, 226), y, kind: 'palm', lean: rng.range(-0.14, 0.14), s: rng.range(0.85, 1.25) });
  }
  for (let i = 0; i < 90; i++) {
    const x = rng.range(BEACH_X + 30, WORLD_W - 30);
    const y = rng.range(30, WORLD_H - 30);
    if (isRoad(x, y) || pointInAnyBuilding(buildings, x, y, 20)) continue;
    props.push({ x, y, kind: rng.chance(0.62) ? 'palm' : 'bench', lean: rng.range(-0.12, 0.12), s: rng.range(0.8, 1.2) });
  }
  // Street lamps on the intersection corners.
  for (const cx of ROADS_X) {
    for (const cy of ROADS_Y) {
      for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        props.push({ x: cx + ox * (ROAD_W / 2 + 10), y: cy + oy * (ROAD_W / 2 + 10), kind: 'lamp' });
      }
    }
  }

  const station = { x: 2066, y: 1352 };  // Palmera Bay PD, east side of the 2000 avenue
  const hospital = { x: 434, y: 968 };   // St. Solana General, west side of the 500 avenue
  props.push({ x: station.x, y: station.y - 26, kind: 'sign-pd' });
  props.push({ x: hospital.x, y: hospital.y - 26, kind: 'sign-hosp' });

  // Hidden packages: tucked on block ground, never in a road or a wall.
  const packages = [];
  let guard = 0;
  while (packages.length < PACKAGE_COUNT && guard < 4000) {
    guard++;
    const x = rng.range(BEACH_X + 20, WORLD_W - 30);
    const y = rng.range(24, WORLD_H - 24);
    if (isRoad(x, y) || pointInAnyBuilding(buildings, x, y, 16)) continue;
    if (packages.some((p) => Math.abs(p.x - x) < 190 && Math.abs(p.y - y) < 190)) continue;
    packages.push({ id: packages.length, x, y, taken: false });
  }

  return {
    buildings, props, spray, bar, maraSpot, station, hospital, packages,
    districtAt, isRoad,
  };
}

export function pointInAnyBuilding(buildings, x, y, pad = 0) {
  for (const b of buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
  }
  return false;
}

/** True when the circle at (x, y) with radius r overlaps any building. */
export function circleHitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

/** Push the point object `p` (with .x/.y) out of every building it overlaps. */
export function resolveCircle(city, p, r) {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of city.buildings) {
      const cx = clamp(p.x, b.x, b.x + b.w);
      const cy = clamp(p.y, b.y, b.y + b.h);
      let dx = p.x - cx, dy = p.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.y = cy + (dy / d) * r;
      } else {
        // Centre inside the rect: leave by the nearest face.
        const left = p.x - b.x, right = b.x + b.w - p.x, top = p.y - b.y, bot = b.y + b.h - p.y;
        const m = Math.min(left, right, top, bot);
        if (m === left) p.x = b.x - r;
        else if (m === right) p.x = b.x + b.w + r;
        else if (m === top) p.y = b.y - r;
        else p.y = b.y + b.h + r;
      }
    }
  }
}
