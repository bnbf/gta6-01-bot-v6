// The player on foot and behind the wheel: walking and running, stealing
// and exiting cars, mouse-aim hitscan shooting with four weapons, drive-by
// fire from a car, and pickups. Shooting is a ray against buildings,
// cars, the helicopter and people, nearest hit wins.

import { PLAYER, CAR, WEAPONS, WANTED } from './config.js';
import { collideCircle, pointInBuilding } from './city.js';
import { nearestCar, damageCar, damageHeli, makeCar } from './vehicles.js';

export function updatePlayer(G, input, dt) {
  const p = G.player;
  if (p.onFoot) {
    const move = input.move();
    const len = Math.hypot(move.x, move.y);
    const speed = (input.run ? PLAYER.runSpeed : PLAYER.walkSpeed) * (len > 0 ? 1 : 0);
    if (len > 0) {
      p.angle = Math.atan2(move.y, move.x);
      p.x += (move.x / len) * speed * dt;
      p.y += (move.y / len) * speed * dt;
      const fixed = collideCircle(G.city, p.x, p.y, PLAYER.radius);
      p.x = fixed.x; p.y = fixed.y;
      p.moving = true;
    } else {
      p.moving = false;
    }
    // Aim follows the mouse.
    const m = input.mouse();
    const wx = G.camera.x + (m.x - 640) / G.camera.zoom;
    const wy = G.camera.y + (m.y - 360) / G.camera.zoom;
    p.aim = Math.atan2(wy - p.y, wx - p.x);
  }
  p.fireTimer = Math.max(0, (p.fireTimer || 0) - dt);
  if (input.firing && p.fireTimer <= 0) shoot(G);
}

function currentWeapon(G) {
  return WEAPONS[G.player.weapon];
}

export function shoot(G) {
  const p = G.player;
  const w = currentWeapon(G);
  const reserve = p.ammo[w.name] ?? 0;
  if ((p.mag[w.name] ?? 0) <= 0) {
    G.events.push('click-empty');
    p.fireTimer = 0.25;
    return;
  }
  p.fireTimer = 1 / w.rate;
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i += 1) {
    const spread = (G.rng.next() - 0.5) * 2 * w.spread * (p.onFoot ? 1 : 2.2);
    fireRay(G, p.aim + spread, w);
  }
  p.mag[w.name] -= 1;
  G.shotsFired += 1;
  G.shotsTimer = 1.5;
  G.muzzle = 0.06;
  G.events.push('shot');
  if (!p.onFoot) G.events.push('drive-by');
  // A gunshot in public draws the law.
  if (G.wanted < 1) G.wanted = 1;
}

function fireRay(G, angle, w) {
  const p = G.player;
  const ox = p.onFoot ? p.x : p.car.x;
  const oy = p.onFoot ? p.y : p.car.y;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = { d: w.range, kind: null, ref: null };
  // Buildings stop the bullet.
  for (let d = 12; d < w.range; d += 14) {
    if (pointInBuilding(G.city, ox + dx * d, oy + dy * d)) { best = { d, kind: 'wall' }; break; }
  }
  // Cars.
  for (const car of G.cars) {
    if (car.dead || car === p.car) continue;
    const t = rayCircle(ox, oy, dx, dy, car.x, car.y, CAR.radius + 4);
    if (t !== null && t < best.d) best = { d: t, kind: 'car', ref: car };
  }
  // Helicopter.
  if (G.heli) {
    const t = rayCircle(ox, oy, dx, dy, G.heli.x, G.heli.y, 46);
    if (t !== null && t < best.d) best = { d: t, kind: 'heli', ref: G.heli };
  }
  // People.
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const t = rayCircle(ox, oy, dx, dy, ped.x, ped.y, 12);
    if (t !== null && t < best.d) best = { d: t, kind: 'ped', ref: ped };
  }
  for (const off of G.officers) {
    if (off.dead) continue;
    const t = rayCircle(ox, oy, dx, dy, off.x, off.y, 12);
    if (t !== null && t < best.d) best = { d: t, kind: 'officer', ref: off };
  }
  G.lastShot = { x: ox, y: oy, angle, dist: best.d };
  if (best.kind === 'car') {
    damageCar(G, best.ref, w.damage);
    if (best.ref.kind === 'police') addWanted(G, 1);
    else if (best.ref.kind === 'traffic') addWanted(G, 1);
  } else if (best.kind === 'heli') {
    damageHeli(G, w.damage);
  } else if (best.kind === 'ped') {
    best.ref.dead = true;
    G.stats.kills += 1;
    addWanted(G, 1);
    G.events.push('ped-down');
    if (G.rng.chance(0.35)) spawnPickup(G, best.ref.x, best.ref.y, 'cash');
  } else if (best.kind === 'officer') {
    best.ref.dead = true;
    G.stats.kills += 1;
    addWanted(G, 1);
    G.events.push('officer-down');
  }
}

function rayCircle(ox, oy, dx, dy, cx, cy, r) {
  const lx = cx - ox, ly = cy - oy;
  const t = lx * dx + ly * dy;
  if (t < 0) return null;
  const d2 = lx * lx + ly * ly - t * t;
  if (d2 > r * r) return null;
  return t - Math.sqrt(r * r - d2);
}

export function addWanted(G, amount) {
  G.wanted = Math.min(WANTED.max, G.wanted + amount);
  G.unseenTimer = 0;
}

export function tryEnterCar(G) {
  const p = G.player;
  if (!p.onFoot) {
    // Exit the car and keep walking.
    const car = p.car;
    p.car = null;
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
    const fixed = collideCircle(G.city, p.x, p.y, PLAYER.radius);
    p.x = fixed.x; p.y = fixed.y;
    car.kind = car.owned ? 'parked' : 'parked';
    G.events.push('exit-car');
    return true;
  }
  const near = nearestCar(G, p.x, p.y, PLAYER.enterRange, ['parked', 'traffic']);
  if (!near) return false;
  const car = near.car;
  p.car = car;
  p.onFoot = false;
  car.kind = 'player';
  car.driver = true;
  car.owned = true;
  if (!car.stolen) {
    car.stolen = true;
    addWanted(G, CAR.stealWanted);
    G.stats.carsStolen += 1;
    G.events.push('steal');
  } else {
    G.events.push('enter-car');
  }
  return true;
}

export function spawnPickup(G, x, y, kind) {
  G.pickups.push({ x, y, kind, t: 0 });
}

export function updatePickups(G, dt) {
  for (const pk of G.pickups) {
    pk.t += dt;
    const d = Math.hypot(pk.x - G.player.x, pk.y - G.player.y);
    if (d < 30) {
      pk.taken = true;
      if (pk.kind === 'health') {
        G.player.health = Math.min(PLAYER.health, G.player.health + 30);
        G.events.push('pickup-health');
      } else if (pk.kind === 'cash') {
        G.cash += 60;
        G.events.push('pickup-cash');
      } else if (pk.kind === 'ammo') {
        const w = WEAPONS[G.player.weapon];
        G.player.ammo[w.name] = (G.player.ammo[w.name] || 0) + w.mag;
        G.events.push('pickup-ammo');
      }
    }
  }
  G.pickups = G.pickups.filter((pk) => !pk.taken && pk.t < 45);
}

export function buyWeapon(G, index) {
  const w = WEAPONS[index];
  if (!w) return false;
  if (G.player.owned[index]) {
    // Already owned: buy a magazine instead.
    if (G.cash < w.ammoPrice) return false;
    G.cash -= w.ammoPrice;
    G.player.ammo[w.name] = (G.player.ammo[w.name] || 0) + w.mag;
    G.events.push('buy-ammo');
    return true;
  }
  if (G.cash < w.price) return false;
  G.cash -= w.price;
  G.player.owned[index] = true;
  G.player.ammo[w.name] = w.mag * 2;
  G.player.mag[w.name] = w.mag;
  G.events.push('buy-weapon');
  return true;
}

export function reloadWeapon(G) {
  const w = WEAPONS[G.player.weapon];
  const mag = G.player.mag[w.name] ?? 0;
  const need = w.mag - mag;
  if (need <= 0) return false;
  if (w.name === 'Pistol') {
    G.player.mag[w.name] = w.mag;
    return true;
  }
  const reserve = G.player.ammo[w.name] ?? 0;
  const take = Math.min(need, reserve);
  if (take <= 0) return false;
  G.player.mag[w.name] = mag + take;
  G.player.ammo[w.name] = reserve - take;
  return true;
}

export function switchWeapon(G, index) {
  if (index < 0 || index >= WEAPONS.length) return;
  if (!G.player.owned[index] && index !== 0) return;
  G.player.weapon = index;
}
