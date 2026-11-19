// Cars: traffic AI on the road grid, the player's arcade driving, police
// chase cars, the 4-star helicopter and police roadblocks. A car is one
// object in G.cars; its kind decides who drives it.

import { CAR, TRAFFIC, WANTED, WORLD, ECONOMY } from './config.js';
import { nearestRoadPoint, collideCircle, isOnRoad, roadCenterV, roadCenterH, hasLineOfSight } from './city.js';

const TRAFFIC_COLORS = ['#c9c9d4', '#8a94a6', '#b0483e', '#3e6fb0', '#c9a227', '#5d7a52', '#7a5a8a'];
const POLICE_COLOR = '#2f6df6';

let nextId = 1;

export function makeCar(kind, x, y, angle, color) {
  return {
    id: nextId, kind, x, y, angle, speed: 0, color,
    hp: CAR.hp, maxHp: CAR.hp, stolen: false, driver: kind !== 'parked',
    wp: null, wpTimer: 0, honk: 0, smoke: false, dead: false,
    nos: CAR.nosMax, armor: 0, engine: 0, paint: color,
  };
}

function randomRoadPoint(city, rng) {
  const vertical = rng.chance(0.5);
  if (vertical) {
    const i = rng.int(0, 7);
    return { x: roadCenterV(i), y: rng.range(100, 3400), angle: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
  }
  const j = rng.int(0, 6);
  return { x: rng.range(100, 4700), y: roadCenterH(j), angle: rng.chance(0.5) ? 0 : Math.PI };
}

export function spawnTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(city, rng);
    const car = makeCar('traffic', p.x, p.y, p.angle, rng.pick(TRAFFIC_COLORS));
    car.speed = TRAFFIC.speed + rng.range(-TRAFFIC.speedJitter, TRAFFIC.speedJitter);
    car.wp = pickWaypoint(city, rng, car);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(city, rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard < count * 20) {
    guard += 1;
    const p = randomRoadPoint(city, rng);
    const off = rng.chance(0.5) ? 46 : -46;
    const x = p.angle === 0 || p.angle === Math.PI ? p.x : p.x + off;
    const y = p.angle === 0 || p.angle === Math.PI ? p.y + off : p.y;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 90)) continue;
    cars.push(makeCar('parked', x, y, p.angle + (rng.chance(0.5) ? 0 : Math.PI), rng.pick(TRAFFIC_COLORS)));
  }
  return cars;
}

function pickWaypoint(city, rng, car) {
  // Drive to a nearby intersection, then choose a new road there.
  const p = nearestRoadPoint(city, car.x, car.y);
  const ahead = 260 + rng.range(0, 240);
  const nx = car.x + Math.cos(car.angle) * ahead;
  const ny = car.y + Math.sin(car.angle) * ahead;
  const snap = nearestRoadPoint(city, nx, ny);
  return { x: snap.x, y: snap.y, angle: snap.angle };
}

function carAhead(G, car, dist) {
  let best = null;
  for (const other of G.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d > dist || d < 1) continue;
    const along = (dx * Math.cos(car.angle) + dy * Math.sin(car.angle)) / d;
    if (along > 0.86 && (!best || d < best.d)) best = { car: other, d };
  }
  return best;
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.kind !== 'traffic' || car.dead) continue;
    if (!car.wp || Math.hypot(car.wp.x - car.x, car.wp.y - car.y) < 40) {
      car.wp = pickWaypoint(G.city, G.rng, car);
    }
    const want = Math.atan2(car.wp.y - car.y, car.wp.x - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-1.9 * dt, Math.min(1.9 * dt, diff));
    const ahead = carAhead(G, car, TRAFFIC.safeGap);
    const target = ahead ? Math.max(0, ahead.car.speed - 20) : TRAFFIC.speed;
    car.speed += Math.max(-260 * dt, Math.min(160 * dt, target - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(G.city, car.x, car.y, CAR.radius);
    car.x = fixed.x; car.y = fixed.y;
  }
}

export function updatePlayerCar(G, input, dt) {
  const car = G.player.car;
  if (!car) return;
  const move = input.move();
  const engineMul = 1 + 0.18 * (car.engine || 0);
  if (move.y < 0) car.speed += CAR.accel * engineMul * dt;
  else if (move.y > 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverse) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.drag * 220 * dt);
  if (input.nos && car.nos > 0 && car.speed > 60) {
    car.speed += CAR.nosBoost * dt;
    car.nos = Math.max(0, car.nos - CAR.nosDrain * dt);
  }
  const maxF = CAR.maxSpeed * engineMul + (car.nos > 0 && input.nos ? 120 : 0);
  car.speed = Math.max(-CAR.maxReverse, Math.min(maxF, car.speed));
  const steer = move.x * CAR.steer * Math.min(1, Math.abs(car.speed) / 140);
  car.angle += steer * Math.sign(car.speed) * dt * (car.speed > 0 ? 1 : -1) * 1.4;
  // Handbrake drift: Space while moving cuts grip and lets the tail out.
  const sliding = input.move().y === 0 && false;
  void sliding;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const fixed = collideCircle(G.city, car.x, car.y, CAR.radius);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    if (Math.abs(car.speed) > 240) damageCar(G, car, 6);
    car.speed *= 0.55;
    car.x = fixed.x; car.y = fixed.y;
  }
  car.smoke = car.hp < 40;
  if (car.hp <= 0 && !car.dead) {
    car.dead = true;
    G.events.push('car-exploded');
    G.player.car = null;
    G.player.onFoot = true;
    G.player.x = car.x + 40; G.player.y = car.y + 40;
    G.player.health = Math.max(10, G.player.health - 25);
  }
}

export function damageCar(G, car, amount) {
  const eff = amount * (1 - 0.12 * (car.armor || 0));
  car.hp = Math.max(0, car.hp - eff);
  if (car.hp <= 0 && car.kind === 'police') {
    car.dead = true;
    G.events.push('cop-down');
    G.cash += 50;
  }
  if (car.hp <= 0 && car.kind === 'traffic') {
    car.dead = true;
    G.events.push('traffic-wreck');
  }
}

export function collideCars(G, dt) {
  void dt;
  const cars = G.cars.filter((c) => !c.dead);
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = CAR.radius * 2 - 4;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 120) {
          damageCar(G, a, 3);
          damageCar(G, b, 3);
          G.events.push('crash');
        }
        if (a.kind === 'police' || b.kind === 'police') {
          const cop = a.kind === 'police' ? a : b;
          const other = cop === a ? b : a;
          if (other.kind === 'player' && Math.abs(other.speed) < 60) G.bustTimer += dt;
        }
      }
    }
  }
}

export function nearestCar(G, x, y, maxDist, kinds) {
  let best = null;
  for (const car of G.cars) {
    if (car.dead) continue;
    if (kinds && !kinds.includes(car.kind)) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d <= maxDist && (!best || d < best.d)) best = { car, d };
  }
  return best;
}

export function updatePolice(G, dt) {
  const want = WANTED.copCars[Math.min(G.wanted, WANTED.max)] || 0;
  const cops = G.cars.filter((c) => c.kind === 'police' && !c.dead);
  // Backup only rolls out while the player is seen (or was, a moment ago).
  // Once the heat is properly lost, no fresh units arrive.
  if (G.wanted > 0 && cops.length < want && (G.shotsTimer > 0 || G.unseenTimer < 0.5 || !!G.heli)) {
    const p = randomRoadPoint(G.city, G.rng);
    // Spawn a few blocks away, on a road near the player.
    const near = nearestRoadPoint(G.city, G.player.x + G.rng.range(-900, 900), G.player.y + G.rng.range(-900, 900));
    const cop = makeCar('police', near.x, near.y, Math.atan2(G.player.y - near.y, G.player.x - near.x), POLICE_COLOR);
    cop.speed = 200;
    G.cars.push(cop);
  }
  for (const cop of cops) {
    const tx = G.player.onFoot ? G.player.x : G.player.car.x;
    const ty = G.player.onFoot ? G.player.y : G.player.car.y;
    const wantAngle = Math.atan2(ty - cop.y, tx - cop.x);
    let diff = wantAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const d = Math.hypot(tx - cop.x, ty - cop.y);
    const sees = d < 500 && hasLineOfSight(G.city, cop.x, cop.y, tx, ty);
    // Lost the trail: patrol the roads, and give up entirely once far away.
    if (!sees && G.unseenTimer > 8 && d > 900) {
      cop.dead = true;
      continue;
    }
    if (!sees && G.unseenTimer > 0.5) {
      if (!cop.waypoint || Math.hypot(cop.x - cop.waypoint.x, cop.y - cop.waypoint.y) < 80) {
        cop.waypoint = randomRoadPoint(G.city, G.rng, cop.x + G.rng.range(-600, 600), cop.y + G.rng.range(-600, 600));
      }
      const wa = Math.atan2(cop.waypoint.y - cop.y, cop.waypoint.x - cop.x);
      let wdiff = wa - cop.angle;
      while (wdiff > Math.PI) wdiff -= Math.PI * 2;
      while (wdiff < -Math.PI) wdiff += Math.PI * 2;
      cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, wdiff));
      cop.speed += Math.max(-500 * dt, Math.min(420 * dt, 200 - cop.speed));
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      const fixed = collideCircle(G.city, cop.x, cop.y, CAR.radius);
      cop.x = fixed.x; cop.y = fixed.y;
      continue;
    }
    const target = d > 90 ? WANTED.copSpeed : 0;
    cop.speed += Math.max(-500 * dt, Math.min(420 * dt, target - cop.speed));
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    const fixed = collideCircle(G.city, cop.x, cop.y, CAR.radius);
    cop.x = fixed.x; cop.y = fixed.y;
    // Ram the player's car.
    if (!G.player.onFoot && G.player.car && d < CAR.radius * 2 + 6 && cop.speed > 200) {
      damageCar(G, G.player.car, 4);
      cop.speed *= 0.5;
      G.events.push('crash');
    }
    // Bust on foot: close and slow for long enough.
    if (G.player.onFoot && d < 34) G.bustTimer += dt;
  }
  // Despawn far cops once the heat is gone.
  if (G.wanted === 0) {
    for (const cop of cops) {
      const d = Math.hypot(cop.x - G.player.x, cop.y - G.player.y);
      if (d > 1400) cop.dead = true;
    }
  }
}

export function updateHeli(G, dt) {
  if (G.wanted >= WANTED.heliAt) {
    if (!G.heli) {
      G.heli = { x: G.player.x + 300, y: G.player.y - 300, angle: 0, hp: 120, shootTimer: 2, rotor: 0 };
      G.events.push('heli');
    }
    const h = G.heli;
    h.rotor += dt * 22;
    const tx = G.player.onFoot ? G.player.x : G.player.car.x;
    const ty = G.player.onFoot ? G.player.y : G.player.car.y;
    const dx = tx - h.x, dy = ty - h.y;
    const d = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    let diff = want - h.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    h.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    const speed = d > 160 ? 260 : 0;
    h.x += Math.cos(h.angle) * speed * dt;
    h.y += Math.sin(h.angle) * speed * dt;
    h.shootTimer -= dt;
    if (h.shootTimer <= 0 && d < 700) {
      h.shootTimer = 1.6;
      G.player.health = Math.max(0, G.player.health - 4);
      G.events.push('heli-shot');
      if (G.player.health <= 0) G.events.push('wasted');
    }
  } else if (G.heli) {
    G.heli = null;
  }
}

export function damageHeli(G, amount) {
  if (!G.heli) return;
  G.heli.hp -= amount;
  if (G.heli.hp <= 0) {
    G.heli = null;
    G.cash += 500;
    G.stats.heliDown += 1;
    G.events.push('heli-down');
  }
}

export function updateRoadblocks(G) {
  const want = G.wanted >= WANTED.roadblockAt ? 2 : 0;
  // Keep roadblocks ahead of the player on the roads they are driving on.
  G.roadblocks = G.roadblocks.filter((r) => !r.expired);
  if (G.roadblocks.length < want) {
    const ahead = G.player.car
      ? { x: G.player.car.x + Math.cos(G.player.car.angle) * 700, y: G.player.car.y + Math.sin(G.player.car.angle) * 700 }
      : { x: G.player.x + 500, y: G.player.y };
    const snap = nearestRoadPoint(G.city, ahead.x, ahead.y);
    const block = { x: snap.x, y: snap.y, angle: snap.angle, expired: false, cars: [] };
    for (const side of [-1, 1]) {
      const px = snap.x + Math.cos(snap.angle + Math.PI / 2) * side * 34;
      const py = snap.y + Math.sin(snap.angle + Math.PI / 2) * side * 34;
      const cop = makeCar('police', px, py, snap.angle + Math.PI / 2, POLICE_COLOR);
      cop.speed = 0;
      block.cars.push(cop);
      G.cars.push(cop);
    }
    G.roadblocks.push(block);
    G.events.push('roadblock');
  }
  for (const r of G.roadblocks) {
    const d = Math.hypot(r.x - G.player.x, r.y - G.player.y);
    if (d > 1600) {
      r.expired = true;
      for (const c of r.cars) c.dead = true;
    }
  }
}

export function paintCar(G, color) {
  if (G.player.car) {
    G.player.car.paint = color;
    G.player.car.color = color;
  }
  G.upgrades.paint = color;
}

export function repairCar(G) {
  if (G.player.car) {
    G.player.car.hp = G.player.car.maxHp;
    G.player.car.nos = CAR.nosMax;
    G.player.car.smoke = false;
  }
}
