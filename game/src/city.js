// The deterministic seeded city of Solmar Bay: a 7x6 block grid cut by
// roads, with buildings, parks, palms, a beach and the sea to the south,
// six named districts and the fixed places the story uses (garage, gun
// shop, diner, safehouse, bank, pier, harbor). The same seed always
// builds the same city, so missions, traffic and screenshots repeat.

import { WORLD, GRID, DISTRICTS, PALETTE } from './config.js';

const ROAD_HALF = GRID.roadW / 2;
const PITCH_X = GRID.blockW + GRID.roadW;
const PITCH_Y = GRID.blockH + GRID.roadW;

export function roadCenterV(i) { return ROAD_HALF + i * PITCH_X; }
export function roadCenterH(j) { return ROAD_HALF + j * PITCH_Y; }

function blockRect(c, r) {
  return {
    x: GRID.roadW + c * PITCH_X, y: GRID.roadW + r * PITCH_Y,
    w: GRID.blockW, h: GRID.blockH,
  };
}

export function districtAt(city, x, y) {
  const c = Math.floor((x - GRID.roadW) / PITCH_X);
  const r = Math.floor((y - GRID.roadW) / PITCH_Y);
  if (c < 0 || c >= GRID.cols || r < 0 || r >= GRID.rows) {
    return y >= WORLD.beachY ? city.districts[5] : city.districts[1];
  }
  for (const d of city.districts) {
    if (c >= d.x0 && c < d.x1 && r >= d.y0 && r < d.y1) return d;
  }
  return city.districts[1];
}

export function isOnRoad(city, x, y) {
  if (y >= WORLD.beachY) return y < WORLD.seaY; // beachfront avenue
  for (let i = 0; i <= GRID.cols; i += 1) {
    if (Math.abs(x - roadCenterV(i)) <= ROAD_HALF) return true;
  }
  for (let j = 0; j <= GRID.rows; j += 1) {
    if (Math.abs(y - roadCenterH(j)) <= ROAD_HALF) return true;
  }
  return false;
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of every building it overlaps and clamp it to the map.
export function collideCircle(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        // Dead centre inside: push out along the shortest side.
        const left = x - b.x, right = b.x + b.w - x;
        const top = y - b.y, bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  x = Math.max(r, Math.min(WORLD.w - r, x));
  y = Math.max(r, Math.min(WORLD.h - r, y));
  return { x, y };
}

// Line of sight: true when no building stands between the two points
// (sampled every 40 units — cheap, and what the wanted decay uses).
export function hasLineOfSight(city, x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(d / 40));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointInBuilding(city, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
  }
  return true;
}

// Snap a point to the nearest road centre line and return the road's angle.
export function nearestRoadPoint(city, x, y) {
  let best = null;
  for (let i = 0; i <= GRID.cols; i += 1) {
    const cx = roadCenterV(i);
    const d = Math.abs(x - cx);
    if (!best || d < best.d) best = { x: cx, y, angle: Math.PI / 2, d };
  }
  for (let j = 0; j <= GRID.rows; j += 1) {
    const cy = roadCenterH(j);
    const d = Math.abs(y - cy);
    if (!best || d < best.d) best = { x, y: cy, angle: 0, d };
  }
  if (y >= WORLD.beachY) {
    const d = Math.abs(y - (WORLD.beachY + 40));
    if (!best || d < best.d) best = { x, y: WORLD.beachY + 40, angle: 0, d };
  }
  return best;
}

const NEON_SIGNS = ['LUMEN', 'NEON', 'BAR', 'HOTEL', 'CASINO', 'PIER', 'TACOS', '24H', 'CLUB', 'MOTEL', 'DANCE', 'SUNSET'];
const BUILDING_COLORS = ['#2e2a3d', '#3a3049', '#2b3a4a', '#413345', '#332e2a', '#2e4038'];

export function buildCity(rng) {
  const buildings = [];
  const parks = [];
  const palms = [];
  const districts = DISTRICTS.map((d) => ({ ...d }));
  const neonColors = [PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonGold, PALETTE.neonPurple, PALETTE.neonGreen, PALETTE.neonOrange];

  for (let r = 0; r < GRID.rows; r += 1) {
    for (let c = 0; c < GRID.cols; c += 1) {
      const rect = blockRect(c, r);
      const d = districtAt({ districts }, rect.x + 10, rect.y + 10);
      const roll = rng.next();
      if (roll < 0.14) {
        // A park: grass, palms and a path, no buildings.
        parks.push({ ...rect, district: d.name });
        const n = rng.int(4, 8);
        for (let i = 0; i < n; i += 1) {
          palms.push({ x: rect.x + rng.range(30, rect.w - 30), y: rect.y + rng.range(30, rect.h - 30), s: rng.range(0.8, 1.3) });
        }
        continue;
      }
      if (roll < 0.24) {
        // A parking lot: flat, with a few parked cars placed by vehicles.js.
        parks.push({ ...rect, district: d.name, lot: true });
        continue;
      }
      // 1-3 buildings per block, seeded.
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i += 1) {
        const bw = rng.range(120, 240);
        const bh = rng.range(100, 200);
        const bx = rect.x + rng.range(16, rect.w - bw - 16);
        const by = rect.y + rng.range(16, rect.h - bh - 16);
        const neon = d.name === 'Neon Strip' ? rng.chance(0.75) : d.name === 'Downtown' ? rng.chance(0.4) : rng.chance(0.12);
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          floors: d.name === 'Downtown' ? rng.int(6, 14) : d.name === 'Neon Strip' ? rng.int(3, 7) : rng.int(1, 4),
          color: rng.pick(BUILDING_COLORS), district: d.name,
          neon, sign: neon ? rng.pick(NEON_SIGNS) : null,
          neonColor: neon ? rng.pick(neonColors) : null,
        });
      }
      // Street palms along the block edge.
      const pn = rng.int(1, 3);
      for (let i = 0; i < pn; i += 1) {
        palms.push({ x: rect.x + rng.range(10, rect.w - 10), y: rect.y + 8, s: rng.range(0.8, 1.2) });
      }
    }
  }

  // Landmarks: one unmissable building per district.
  const landmarks = [
    { name: 'Solmar Tower', x: roadCenterV(3) + 90, y: roadCenterH(1) + 40, w: 150, h: 150, floors: 22, district: 'Downtown' },
    { name: 'Fountain Plaza', x: roadCenterV(1) + 60, y: roadCenterH(1) + 60, w: 180, h: 140, floors: 1, district: 'Old Town' },
    { name: 'Harbor Lights', x: roadCenterV(6) - 40, y: roadCenterH(2) + 40, w: 160, h: 120, floors: 3, district: 'Marina' },
    { name: 'Foundry Crane', x: roadCenterV(1) + 60, y: roadCenterH(3) + 40, w: 200, h: 130, floors: 2, district: 'Industrial' },
    { name: 'LUMEN Mile', x: roadCenterV(3) + 80, y: roadCenterH(3) + 50, w: 170, h: 130, floors: 4, district: 'Neon Strip' },
  ];
  for (const lm of landmarks) {
    buildings.push({ ...lm, color: '#3d3350', neon: true, sign: lm.name.toUpperCase().slice(0, 6), neonColor: PALETTE.neonPink, landmark: lm.name });
  }

  // Fixed story places, all on road edges so the player can reach them.
  const places = {
    garage: { name: 'Volt Garage', x: roadCenterV(3) + 70, y: roadCenterH(3) - 70, kind: 'garage' },
    gunshop: { name: 'LUMEN ARMS', x: roadCenterV(4) - 70, y: roadCenterH(2) + 70, kind: 'gunshop' },
    diner: { name: 'Neon Diner', x: roadCenterV(3) - 70, y: roadCenterH(1) + 70, kind: 'diner' },
    safehouse: { name: "Milo's Safehouse", x: roadCenterV(1) - 70, y: roadCenterH(1) - 70, kind: 'safehouse' },
    bank: { name: 'Solmar Reserve Bank', x: roadCenterV(4) + 70, y: roadCenterH(1) - 70, kind: 'bank' },
    pier: { name: 'Sunset Pier', x: roadCenterV(3), y: WORLD.seaY - 40, kind: 'pier' },
    harbor: { name: 'Dockside', x: WORLD.w - 90, y: roadCenterH(2), kind: 'harbor' },
    raceStart: { name: 'Bay Circuit Start', x: roadCenterV(2), y: WORLD.beachY + 40, kind: 'race' },
  };

  return { buildings, parks, palms, districts, landmarks, places, rng };
}
