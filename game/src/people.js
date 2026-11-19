// People: pedestrians strolling the sidewalks who flee from gunfire and
// crime, and foot officers who chase the player down when the heat is on.

import { PLAYER, WORLD } from './config.js';
import { nearestRoadPoint, collideCircle, isOnRoad } from './city.js';

const SHIRTS = ['#e8e4d8', '#d94f4f', '#4f7fd9', '#e8b94f', '#7fd94f', '#c96fd9', '#e8e8e8', '#4fd9c9'];

export function spawnPeds(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const vertical = rng.chance(0.5);
    const x = rng.range(200, WORLD.w - 200);
    const y = rng.range(200, 3300);
    const snap = nearestRoadPoint(city, x, y);
    peds.push({
      x: snap.x + rng.range(-70, 70), y: snap.y + rng.range(-70, 70),
      angle: rng.range(0, Math.PI * 2), speed: rng.range(28, 52),
      shirt: rng.pick(SHIRTS), state: 'walk', panic: 0, dead: false,
      fare: false, wave: 0,
    });
  }
  return peds;
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const dPlayer = Math.hypot(ped.x - G.player.x, ped.y - G.player.y);
    const scared = G.shotsFired > 0 && dPlayer < 420 && G.shotsTimer > 0;
    if (scared || (G.wanted >= 3 && dPlayer < 260)) {
      ped.state = 'flee';
      ped.panic = 2;
    }
    if (ped.state === 'flee') {
      ped.panic -= dt;
      const away = Math.atan2(ped.y - G.player.y, ped.x - G.player.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 150 * dt;
      ped.y += Math.sin(away) * 150 * dt;
      if (ped.panic <= 0) ped.state = 'walk';
    } else {
      // Stroll along the sidewalk: keep near a road, turn at random.
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (!isOnRoad(G.city, ped.x, ped.y) && G.rng.chance(dt * 0.4)) {
        const snap = nearestRoadPoint(G.city, ped.x, ped.y);
        ped.angle = Math.atan2(snap.y - ped.y, snap.x - ped.x);
      }
      if (G.rng.chance(dt * 0.12)) ped.angle += G.rng.range(-1.2, 1.2);
      if (ped.x < 60 || ped.x > WORLD.w - 60 || ped.y < 60 || ped.y > 3300) {
        ped.angle += Math.PI;
      }
    }
    const fixed = collideCircle(G.city, ped.x, ped.y, 8);
    ped.x = fixed.x; ped.y = fixed.y;
  }
}

export function updateOfficers(G, dt) {
  // Foot officers appear when the player is wanted and on foot.
  const want = G.wanted > 0 && G.player.onFoot ? Math.min(3, G.wanted) : 0;
  const officers = G.officers.filter((o) => !o.dead);
  if (officers.length < want) {
    const a = G.rng.range(0, Math.PI * 2);
    G.officers.push({
      x: G.player.x + Math.cos(a) * 320, y: G.player.y + Math.sin(a) * 320,
      angle: 0, speed: 215, dead: false, bust: 0,
    });
  }
  for (const off of G.officers) {
    if (off.dead) continue;
    const d = Math.hypot(off.x - G.player.x, off.y - G.player.y);
    if (G.wanted === 0 || !G.player.onFoot) {
      if (d > 900) off.dead = true;
      continue;
    }
    off.angle = Math.atan2(G.player.y - off.y, G.player.x - off.x);
    const speed = d > 40 ? off.speed : 0;
    off.x += Math.cos(off.angle) * speed * dt;
    off.y += Math.sin(off.angle) * speed * dt;
    const fixed = collideCircle(G.city, off.x, off.y, 10);
    off.x = fixed.x; off.y = fixed.y;
    if (d < PLAYER.bustRadius) G.bustTimer += dt;
  }
  G.officers = G.officers.filter((o) => !o.dead);
}

export function nearestPed(G, x, y, maxDist, filter) {
  let best = null;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    if (filter && !filter(ped)) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d <= maxDist && (!best || d < best.d)) best = { ped, d };
  }
  return best;
}
