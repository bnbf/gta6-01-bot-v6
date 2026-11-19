// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between title, play, paused, busted and wasted screens, with shop
// and garage overlays on top of play.
//
// ?seed=N fixes the city. ?shot=chase|title|foot|escape (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. ?test=1 runs the 25-check
// self-test synchronously at boot and sets window.__testDone.

import { STEP, WEAPONS, ECONOMY, CAR } from './config.js';
import { createGame, resetGame } from './state.js';
import { stepGame } from './update.js';
import { drawWorld, drawMinimap } from './render.js';
import {
  drawHud, drawTitle, drawPaused, drawBusted, drawWasted, drawShop, drawGarage,
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_WASTED,
} from './hud.js';
import { saveGame, loadGame } from './save.js';
import { startMission, startTaxi, startRace } from './missions.js';
import { tryEnterCar, buyWeapon, switchWeapon, reloadWeapon } from './player.js';
import { paintCar, repairCar } from './vehicles.js';
import { stageShot } from './shots.js';
import {
  createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_RELOAD,
  ACTION_RADIO, ACTION_TAXI, ACTION_MUTE, ACTION_DIGIT, ACTION_INTERACT,
} from './input.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const testMode = params.get('test') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
}
resize();
window.addEventListener('resize', resize);

function announce(message) { status.textContent = message; }

// ---- Shops and garage ----

function openGunshop(G) {
  G.shop = {
    title: 'LUMEN ARMS',
    hint: 'Ammo refills the magazine stock. 1-4 also switch weapons in the field.',
    items: WEAPONS.slice(1).map((w, i) => ({
      name: `${w.name} — ${w.damage} dmg, ${w.rate}/s, mag ${w.mag}`,
      price: w.price, index: i + 1,
    })),
  };
}

function buyFromShop(G, n) {
  const item = G.shop && G.shop.items[n - 1];
  if (!item) return;
  if (buyWeapon(G, item.index)) {
    G.banner = { text: 'PURCHASED', sub: WEAPONS[item.index].name, t: 2, color: '#39ff88' };
    saveGame(G);
  } else {
    G.banner = { text: 'NOT ENOUGH CASH', sub: `Need $${item.price}`, t: 2, color: '#ff2d2d' };
  }
}

export function buyGarage(G, n) {
  const up = G.upgrades;
  const g = ECONOMY.garage;
  if (n === 1 && up.armor < 3 && G.cash >= g.armor[up.armor + 1]) {
    G.cash -= g.armor[up.armor + 1];
    up.armor += 1;
    if (G.player.car) G.player.car.armor = up.armor;
    return true;
  }
  if (n === 2 && up.engine < 3 && G.cash >= g.engine[up.engine + 1]) {
    G.cash -= g.engine[up.engine + 1];
    up.engine += 1;
    if (G.player.car) G.player.car.engine = up.engine;
    return true;
  }
  if (n === 3 && up.nos < 3 && G.cash >= g.nos[up.nos + 1]) {
    G.cash -= g.nos[up.nos + 1];
    up.nos += 1;
    return true;
  }
  if (n === 4 && G.cash >= g.paint) {
    G.cash -= g.paint;
    const idx = (ECONOMY.paints.indexOf(up.paint) + 1) % ECONOMY.paints.length;
    paintCar(G, ECONOMY.paints[idx]);
    return true;
  }
  if (n === 5 && G.cash >= g.repairCost + g.nosRefill) {
    G.cash -= g.repairCost + g.nosRefill;
    repairCar(G);
    return true;
  }
  return false;
}

function interactHere(G) {
  const places = G.city.places;
  const px = G.player.x, py = G.player.y;
  const near = (pl, range = 90) => Math.hypot(px - pl.x, py - pl.y) < range;
  if (near(places.garage)) {
    G.shop = null;
    G.garageOpen = true;
    return true;
  }
  if (near(places.gunshop)) {
    openGunshop(G);
    G.garageOpen = false;
    return true;
  }
  if (near(places.diner)) {
    if (G.cash >= ECONOMY.healCost) {
      G.cash -= ECONOMY.healCost;
      G.player.health = 100;
      G.banner = { text: 'FED AND RESTED', sub: 'Health full', t: 2, color: '#39ff88' };
    } else {
      G.banner = { text: 'NOT ENOUGH CASH', sub: 'A meal costs $50', t: 2, color: '#ff2d2d' };
    }
    return true;
  }
  if (near(places.safehouse)) {
    G.player.health = 100;
    saveGame(G);
    G.banner = { text: 'SAFEHOUSE', sub: 'Healed and saved', t: 2, color: '#39ff88' };
    return true;
  }
  if (near(places.raceStart, 110)) {
    startRace(G);
    return true;
  }
  return false;
}

function healSafehouse(G) {
  G.player.health = 100;
  saveGame(G);
}

// ---- Self-test (?test=1): 25 checks, synchronous, no audio, no loop ----

function runTests() {
  const G = createGame(1337);
  const results = [];
  const check = (name, fn) => {
    try {
      const ok = fn();
      results.push({ name, pass: !!ok });
    } catch (e) {
      results.push({ name, pass: false, error: String(e && e.message ? e.message : e) });
    }
  };
  const sim = (over) => ({
    move: () => over.move || { x: 0, y: 0 },
    run: !!over.run, nos: !!over.nos, firing: !!over.firing,
    mouseDown: !!over.firing, mouse: () => over.mouse || { x: 640, y: 360 },
    takeActions: () => over.actions || 0, takeDigit: () => 0,
  });
  const step = (n, input) => { for (let i = 0; i < n; i += 1) stepGame(G, input || sim({}), STEP); };

  check('city-buildings', () => G.city.buildings.length > 50);
  check('districts-6', () => G.city.districts.length === 6);
  check('traffic-spawns', () => G.cars.filter((c) => c.kind === 'traffic').length >= 20);
  check('parked-cars', () => G.cars.filter((c) => c.kind === 'parked').length >= 10);
  check('peds-spawn', () => G.peds.length >= 20);
  check('mission-1-active', () => startMission(G, 0) && G.mission && G.mission.index === 0);
  check('player-walks', () => {
    const x0 = G.player.x;
    step(60, sim({ move: { x: 1, y: 0 } }));
    return G.player.x > x0 + 100;
  });
  check('steal-car', () => {
    const parked = G.cars.find((c) => c.kind === 'parked');
    G.player.x = parked.x + 10; G.player.y = parked.y;
    const ok = tryEnterCar(G);
    return ok && !G.player.onFoot && G.wanted >= 1;
  });
  check('car-drives', () => {
    step(120, sim({ move: { x: 0, y: -1 } }));
    return G.player.car && Math.abs(G.player.car.speed) > 100;
  });
  check('police-spawn', () => {
    G.wanted = 2;
    step(90);
    return G.cars.some((c) => c.kind === 'police' && !c.dead);
  });
  check('heli-spawns', () => {
    G.wanted = 4;
    step(30);
    return !!G.heli;
  });
  check('roadblocks', () => {
    step(30);
    return G.roadblocks.length >= 1;
  });
  check('wanted-decay', () => {
    G.cars = G.cars.filter((c) => c.kind !== 'police');
    G.officers = [];
    G.heli = null;
    G.wanted = 3;
    G.unseenTimer = 5; // already lost the heat — no fresh cops roll out
    G.shotsTimer = 0;
    G.player.x = 400; G.player.y = 400;
    step(600);
    return G.wanted < 1;
  });
  check('drive-by', () => {
    G.player.owned[1] = true;
    G.player.ammo.SMG = 32;
    G.player.mag.SMG = 32;
    G.player.weapon = 1;
    const before = G.player.mag.SMG;
    step(30, sim({ firing: true, mouse: { x: 900, y: 360 } }));
    return G.player.mag.SMG < before;
  });
  check('shooting-ammo', () => {
    // On foot, pistol magazine drops when fired.
    if (G.player.car) tryEnterCar(G);
    G.player.weapon = 0;
    G.player.mag.Pistol = 12;
    const before = G.player.mag.Pistol;
    step(30, sim({ firing: true, mouse: { x: 900, y: 360 } }));
    return G.player.mag.Pistol < before;
  });
  check('mission-1-completes', () => {
    const parked = G.cars.find((c) => c.kind === 'parked');
    G.player.x = parked.x + 10; G.player.y = parked.y;
    tryEnterCar(G);
    const gp = G.city.places.garage;
    G.player.car.x = gp.x; G.player.car.y = gp.y;
    step(10);
    return G.missionsDone.includes(0);
  });
  check('mission-2-starts', () => startMission(G, 1) && G.mission.index === 1);
  check('save-load', () => {
    G.cash = 1234;
    saveGame(G);
    const G2 = createGame(1337);
    return loadGame(G2) && G2.cash === 1234;
  });
  check('garage-purchase', () => {
    G.cash = 2000;
    const before = G.upgrades.armor;
    const ok = buyGarage(G, 1);
    return ok && G.upgrades.armor === before + 1 && G.cash < 2000;
  });
  check('radio-4-stations', () => {
    G.audio.setStation(3);
    return G.audio.stationCount() === 4 && G.audio.stationName() === 'PALM LO-FI';
  });
  check('shop-buys-ammo', () => {
    G.cash = 1000;
    return buyWeapon(G, 1) && G.player.owned[1] && G.player.ammo.SMG > 0;
  });
  check('safehouse-heals', () => {
    G.player.health = 40;
    healSafehouse(G);
    return G.player.health === 100;
  });
  check('taxi-starts', () => {
    if (G.player.car) tryEnterCar(G);
    const parked = G.cars.find((c) => c.kind === 'parked');
    G.player.x = parked.x + 10; G.player.y = parked.y;
    tryEnterCar(G);
    const ped = G.peds.find((p) => !p.dead && !p.fare);
    ped.x = G.player.car.x + 40; ped.y = G.player.car.y;
    return startTaxi(G) && !!G.taxi;
  });
  check('race-checkpoints', () => {
    const ok = startRace(G);
    if (!ok || !G.race) return false;
    for (const pt of G.race.points) {
      G.player.car.x = pt.x; G.player.car.y = pt.y;
      step(5);
      if (!G.race) break;
    }
    return !G.race;
  });
  check('nos-boost', () => {
    const car = G.player.car;
    car.speed = 300;
    car.nos = 100;
    const s0 = car.speed;
    step(60, sim({ move: { x: 0, y: -1 }, nos: true }));
    return car.speed > s0 && car.nos < 100;
  });

  const passed = results.filter((r) => r.pass).length;
  window.__testResults = results;
  window.__testDone = true;
  document.title = `TEST ${passed}/${results.length}`;
  const div = document.getElementById('test-results');
  if (div) div.textContent = JSON.stringify(results);
  // Paint the verdict on the canvas too.
  ctx.fillStyle = '#11141b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = passed === results.length ? '#39ff88' : '#ff2d2d';
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`SELF-TEST ${passed}/${results.length}`, canvas.width / 2, 120);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = '#f4f1ea';
  results.forEach((r, i) => {
    ctx.fillStyle = r.pass ? '#39ff88' : '#ff2d2d';
    ctx.fillText(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.error ? ' — ' + r.error : ''}`, canvas.width / 2, 170 + i * 26);
  });
  return results;
}

// ---- Screenshot staging (?shot=) ----

function runShot(name) {
  const G = createGame(Number.isInteger(seedParam) ? seedParam : 1);
  const scene = stageShot(name, G);
  let painted = 0;
  function paint() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#11141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / 1280, canvas.height / 720);
    ctx.setTransform(scale, 0, 0, scale, (canvas.width - 1280 * scale) / 2, (canvas.height - 720 * scale) / 2);
    drawWorld(ctx, scene.G);
    drawMinimap(ctx, scene.G);
    drawHud(ctx, scene.G);
    if (scene.screen === SCREEN_TITLE) drawTitle(ctx, scene.G);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// ---- The live game ----

function runGame() {
  const G = createGame(seed);
  loadGame(G);
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function startGame() {
    resetGame(G);
    loadGame(G);
    accumulator = 0;
    screen = SCREEN_PLAY;
    G.audio.ensure();
    if (!G.mission && G.missionsDone.length === 0) startMission(G, 0);
    announce('Playing. Steal a car, follow the gold marker.');
  }

  function endTo(screenName) {
    screen = screenName;
    if (screenName === SCREEN_BUSTED) {
      G.cash = Math.floor(G.cash * 0.8);
      G.wanted = 0;
      G.bustTimer = 0;
      saveGame(G);
      announce('Busted. The PD took 20 percent of your cash.');
    }
    if (screenName === SCREEN_WASTED) {
      G.wanted = 0;
      saveGame(G);
      announce('Wasted. Milo is back on his feet.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = G.audio.toggleMute();
      G.banner = { text: muted ? 'SOUND OFF' : 'SOUND ON', sub: '', t: 1.2, color: '#f4f1ea' };
    }
    if (G.shop || G.garageOpen) {
      if (actions & ACTION_DIGIT) {
        const d = input.takeDigit();
        if (G.shop) buyFromShop(G, d);
        else if (buyGarage(G, d)) {
          G.banner = { text: 'UPGRADED', sub: '', t: 1.5, color: '#39ff88' };
          saveGame(G);
        }
      }
      if (actions & (ACTION_PAUSE | ACTION_ENTER)) {
        G.shop = null;
        G.garageOpen = false;
      }
      return;
    }
    if (actions & ACTION_RADIO) {
      const name = G.audio.nextStation();
      G.banner = { text: `♪ ${name}`, sub: '', t: 1.5, color: '#ff2d95' };
    }
    if (actions & ACTION_RELOAD) reloadWeapon(G);
    if (actions & ACTION_TAXI) startTaxi(G);
    if (actions & ACTION_DIGIT) {
      const d = input.takeDigit();
      if (d >= 1 && d <= 4) switchWeapon(G, d - 1);
    }
    if (actions & ACTION_ENTER) {
      G.interactPressed = true;
      if (!interactHere(G)) tryEnterCar(G);
    } else {
      G.interactPressed = false;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_WASTED)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function stepOnce() {
    if (screen === SCREEN_TITLE) {
      // The title's backdrop: the city idles, traffic rolls.
      stepGame(G, input.scripted({}), STEP);
      return;
    }
    stepGame(G, input, STEP);
    while (G.events.length) {
      const ev = G.events.shift();
      if (ev === 'busted') endTo(SCREEN_BUSTED);
      else if (ev === 'wasted') endTo(SCREEN_WASTED);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        stepOnce();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    // Paint.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#11141b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / 1280, canvas.height / 720);
    ctx.setTransform(scale, 0, 0, scale, (canvas.width - 1280 * scale) / 2, (canvas.height - 720 * scale) / 2);
    drawWorld(ctx, G);
    drawMinimap(ctx, G);
    drawHud(ctx, G);
    if (screen === SCREEN_TITLE) drawTitle(ctx, G);
    else if (screen === SCREEN_PAUSED) drawPaused(ctx);
    else if (screen === SCREEN_BUSTED) drawBusted(ctx, G);
    else if (screen === SCREEN_WASTED) drawWasted(ctx, G);
    if (G.shop) drawShop(ctx, G);
    if (G.garageOpen) drawGarage(ctx, G);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('LUMEN BAY. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (testMode) runTests();
else if (shot) runShot(shot);
else runGame();
