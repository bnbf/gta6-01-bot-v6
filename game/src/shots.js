// Staged scenes for screenshots (?shot=...). Each one builds a fresh world
// from a fixed seed, puts the player in a telling situation, runs the
// simulation for a few seconds so traffic, cops and the helicopter settle
// into place, and hands the game back to main.js for painting.

import { STEP, CAR } from './config.js';
import { stepGame } from './update.js';
import { tryEnterCar } from './player.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './hud.js';
import { roadCenterV, roadCenterH } from './city.js';

function sim(over) {
  return {
    move: () => over.move || { x: 0, y: 0 },
    run: !!over.run, nos: !!over.nos, firing: !!over.firing,
    mouseDown: !!over.firing, mouse: () => over.mouse || { x: 640, y: 360 },
    takeActions: () => 0, takeDigit: () => 0,
  };
}

function step(G, n, input) {
  for (let i = 0; i < n; i += 1) stepGame(G, input || sim({}), STEP);
}

function putPlayerInCar(G, x, y, angle) {
  const car = G.cars.find((c) => c.kind === 'parked');
  car.x = x; car.y = y; car.angle = angle; car.speed = 0;
  G.player.x = car.x + 10; G.player.y = car.y;
  tryEnterCar(G);
  return car;
}

function chase(G) {
  // 4 stars on the Neon Strip at night: cops behind, helicopter above,
  // a roadblock sealing the road ahead.
  G.clock = 1200; // 20:00 — full neon
  const car = putPlayerInCar(G, roadCenterV(4), roadCenterH(1), 0);
  car.speed = 420;
  G.wanted = 4;
  step(G, 150, sim({ move: { x: 0, y: -1 } }));
  frameChase(G, 800, 4);
  return { G, screen: SCREEN_PLAY };
}

function title(G) {
  // Dusk over the city: the title screen shows the world behind the
  // feature list.
  G.clock = 1120; // 18:40 — golden dusk
  step(G, 90);
  return { G, screen: SCREEN_TITLE };
}

function foot(G) {
  // On foot, SMG out, two officers closing in — the Neon Strip at 19:30.
  G.clock = 1170;
  G.player.x = roadCenterV(4) + 40;
  G.player.y = roadCenterH(2) - 40;
  G.player.aim = -0.4;
  G.player.owned[1] = true;
  G.player.ammo.SMG = 96;
  G.player.mag.SMG = 32;
  G.player.weapon = 1;
  G.wanted = 2;
  step(G, 120, sim({ firing: true, mouse: { x: 900, y: 300 } }));
  G.muzzle = 0.12;
  G.lastShot = { x: G.player.x + 60, y: G.player.y - 20, x2: G.player.x + 400, y2: G.player.y - 120 };
  // Two officers close enough to read.
  G.officers = [
    { x: G.player.x + 260, y: G.player.y - 60, angle: Math.PI, speed: 0, dead: false, bustTimer: 0 },
    { x: G.player.x + 320, y: G.player.y + 90, angle: Math.PI, speed: 0, dead: false, bustTimer: 0 },
  ];
  return { G, screen: SCREEN_PLAY };
}

function escape(G) {
  // 5 stars: the bank job just went loud, the PD sealed the Marina road.
  G.clock = 1200;
  const car = putPlayerInCar(G, roadCenterV(2), roadCenterH(3), Math.PI);
  car.speed = 460;
  car.damage = 42;
  G.cash = 12480;
  G.wanted = 5;
  step(G, 150, sim({ move: { x: 0, y: -1 }, nos: true }));
  frameChase(G, 860, 5);
  return { G, screen: SCREEN_PLAY };
}

// After the simulation runs, the chase has usually scattered: the player
// has driven past the roadblock and the cops are far behind. Pull the
// composition back together — roadblock 350 ahead in frame, two cops
// chasing behind, helicopter overhead, speedometer reading fast, banner
// fresh so it is bright at screenshot time. The frame is then painted
// without another step, so nothing moves again before the shot.
function frameChase(G, speed, wanted) {
  const car = G.player.car;
  const ax = Math.cos(car.angle), ay = Math.sin(car.angle);
  for (const block of G.roadblocks) {
    if (block.expired) continue;
    block.x = car.x + ax * 350;
    block.y = car.y + ay * 350;
    block.angle = car.angle;
    block.cars.forEach((cop, i) => {
      const side = i === 0 ? -34 : 34;
      cop.x = block.x - ay * side;
      cop.y = block.y + ax * side;
      cop.angle = car.angle + Math.PI / 2;
      cop.speed = 0;
    });
  }
  const blockCars = new Set(G.roadblocks.flatMap((b) => b.cars));
  const cops = G.cars.filter((c) => c.kind === 'police' && !c.dead && !blockCars.has(c)).slice(0, 2);
  cops.forEach((cop, i) => {
    const back = 260 + i * 130;
    const lat = i === 0 ? -80 : 100;
    cop.x = car.x - ax * back - ay * lat;
    cop.y = car.y - ay * back + ax * lat;
    cop.angle = car.angle;
    cop.speed = 380;
  });
  car.speed = speed;
  car.damage = Math.max(car.damage, 0);
  G.banner = { text: 'ROADBLOCK AHEAD', sub: `${wanted} stars — the PD sealed the roads`, t: 3, color: '#ff2d2d' };
  if (G.heli) {
    G.heli.x = car.x + 120;
    G.heli.y = car.y - 140;
  }
}

export function stageShot(name, G) {
  if (name === 'chase') return chase(G);
  if (name === 'title') return title(G);
  if (name === 'foot') return foot(G);
  if (name === 'escape') return escape(G);
  throw new Error(`unknown shot: ${name}`);
}

export { CAR };
