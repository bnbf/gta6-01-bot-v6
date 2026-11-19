// One fixed step of the whole game: the clock, the player, every car and
// person, the missions and side jobs, the wanted level with line-of-sight
// decay, the camera, the audio cues and the autosave. main.js calls this
// sixty times a second; shots.js calls it with scripted input.

import { WANTED } from './config.js';
import { hasLineOfSight } from './city.js';
import { updatePlayer } from './player.js';
import { updateTraffic, updatePlayerCar, collideCars, updatePolice, updateHeli, updateRoadblocks } from './vehicles.js';
import { updatePeds, updateOfficers } from './people.js';
import { updatePickups } from './player.js';
import { updateMissions, updateTaxi, updateRace, missionMarker } from './missions.js';
import { saveGame } from './save.js';

const SFX_EVENTS = new Set([
  'shot', 'crash', 'pickup-cash', 'pickup-health', 'pickup-ammo',
  'mission-complete', 'mission-failed', 'checkpoint', 'heli-down', 'buy',
  'buy-ammo', 'buy-weapon', 'click-empty',
]);

export function stepGame(G, input, dt) {
  G.time += dt;
  G.clock += dt * 30;
  G.playSeconds += dt;
  G.muzzle = Math.max(0, G.muzzle - dt);
  G.shotsTimer = Math.max(0, G.shotsTimer - dt);
  if (G.banner) G.banner.t -= dt;

  // Wanted: seen while a cop or officer has line of sight, the helicopter
  // is up, or shots were just fired; unseen for 4 seconds, the heat falls.
  const px = G.player.onFoot ? G.player.x : G.player.car.x;
  const py = G.player.onFoot ? G.player.y : G.player.car.y;
  let seen = G.shotsTimer > 0 || !!G.heli;
  if (!seen) {
    for (const car of G.cars) {
      if (car.kind === 'police' && !car.dead && Math.hypot(car.x - px, car.y - py) < 500 && hasLineOfSight(G.city, car.x, car.y, px, py)) { seen = true; break; }
    }
  }
  if (!seen) {
    for (const off of G.officers) {
      if (!off.dead && Math.hypot(off.x - px, off.y - py) < 320 && hasLineOfSight(G.city, off.x, off.y, px, py)) { seen = true; break; }
    }
  }
  if (seen) G.unseenTimer = 0;
  else {
    G.unseenTimer += dt;
    if (G.unseenTimer > WANTED.decayUnseen && G.wanted > 0) {
      G.wanted = Math.max(0, G.wanted - WANTED.decayPerSec * dt);
      if (G.wanted < 0.05) G.wanted = 0;
    }
  }

  updatePlayer(G, input, dt);
  if (!G.player.onFoot) updatePlayerCar(G, input, dt);
  updateTraffic(G, dt);
  collideCars(G, dt);
  updatePolice(G, dt);
  updateHeli(G, dt);
  updateRoadblocks(G);
  updatePeds(G, dt);
  updateOfficers(G, dt);
  updatePickups(G, dt);
  updateMissions(G, dt);
  updateTaxi(G, dt);
  updateRace(G, dt);

  // Busted: a cop or officer held the player long enough.
  if (G.bustTimer > WANTED.bustTime) {
    G.bustTimer = 0;
    G.events.push('busted');
  } else {
    G.bustTimer = Math.max(0, G.bustTimer - dt * 0.5);
  }
  if (G.player.health <= 0) G.events.push('wasted');

  // Particles.
  for (const pt of G.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);

  // Objective + marker for the HUD.
  G.missionMarker = missionMarker(G);
  if (G.mission) {
    const step = G.mission.def.steps[G.mission.step];
    G.objectiveText = `${G.mission.def.name} (${G.mission.step + 1}/${G.mission.def.steps.length}): ${step.label}`;
  } else if (G.taxi) {
    G.objectiveText = G.taxi.picked ? `Taxi: take the fare to the marker ($${G.taxi.fare})` : 'Taxi: pick up the fare';
  } else if (G.race) {
    G.objectiveText = `Bay Circuit race: checkpoint ${G.race.idx + 1}/${G.race.points.length} — ${Math.ceil(G.race.timer)}s`;
  } else {
    G.objectiveText = G.missionsDone.length >= 12
      ? 'All 12 missions done — King of the Bay. Free roam.'
      : 'Next mission starts soon — explore Solmar Bay';
  }

  // Interaction prompts near places.
  G.prompt = null;
  const places = G.city.places;
  const near = (pl, range = 90) => Math.hypot(px - pl.x, py - pl.y) < range;
  if (near(places.garage)) G.prompt = 'Press E — Volt Garage (upgrades, paint, repair)';
  else if (near(places.gunshop)) G.prompt = 'Press E — LUMEN ARMS (weapons, ammo)';
  else if (near(places.diner)) G.prompt = 'Press E — Neon Diner (heal $50)';
  else if (near(places.safehouse)) G.prompt = 'Press E — Safehouse (heal + save)';
  else if (near(places.raceStart, 110)) G.prompt = 'Press E — Bay Circuit race start ($300)';

  // Audio cues.
  const audio = G.audio;
  audio.setEngine(G.player.car ? G.player.car.speed : 0, !G.player.onFoot);
  audio.setSiren(G.cars.some((c) => c.kind === 'police' && !c.dead && Math.hypot(c.x - px, c.y - py) < 700));
  // Screen-change events stay in the queue for main.js; everything else
  // is consumed here (sound, banners, particles).
  const kept = [];
  while (G.events.length) {
    const ev = G.events.shift();
    if (ev === 'busted' || ev === 'wasted') { kept.push(ev); continue; }
    if (SFX_EVENTS.has(ev)) audio.sfx(ev);
    if (ev === 'mission-complete') {
      G.banner = { text: 'MISSION COMPLETE', sub: `+$${G.lastReward || 0} — cash banked`, t: 3, color: '#39ff88' };
      saveGame(G);
    }
    if (ev === 'mission-start') {
      const m = G.mission;
      if (m) G.banner = { text: m.def.name.toUpperCase(), sub: m.def.brief, t: 4, color: '#ffc233' };
    }
    if (ev === 'mission-failed') G.banner = { text: 'MISSION FAILED', sub: 'Talk to Vera to try again', t: 3, color: '#ff2d2d' };
    if (ev === 'heli-down') G.banner = { text: 'HELICOPTER DOWN', sub: '+$500', t: 3, color: '#39ff88' };
    if (ev === 'roadblock') G.banner = { text: 'ROADBLOCK AHEAD', sub: '4 stars — the PD sealed the roads', t: 2.5, color: '#ff2d2d' };
    if (ev === 'car-exploded') {
      for (let i = 0; i < 14; i += 1) {
        G.particles.push({ x: px, y: py, vx: (G.rng.next() - 0.5) * 300, vy: (G.rng.next() - 0.5) * 300, life: 0.7, max: 0.7, size: 4 + G.rng.next() * 4, color: G.rng.pick(['#ff7a1a', '#ffc233', '#ff2d2d']) });
      }
    }
  }
  G.events.push(...kept);

  // Autosave.
  G.saveTimer -= dt;
  if (G.saveTimer <= 0) {
    G.saveTimer = 20;
    saveGame(G);
  }

  // Camera: follow the player, lead in the driving direction, shake on crash.
  const lead = !G.player.onFoot && G.player.car ? Math.min(90, Math.abs(G.player.car.speed) * 0.12) : 0;
  const lx = !G.player.onFoot && G.player.car ? Math.cos(G.player.car.angle) * lead : 0;
  const ly = !G.player.onFoot && G.player.car ? Math.sin(G.player.car.angle) * lead : 0;
  const targetX = px + lx;
  const targetY = py + ly;
  const k = 1 - Math.pow(0.001, dt);
  G.camera.x += (targetX - G.camera.x) * k;
  G.camera.y += (targetY - G.camera.y) * k;
  G.camera.zoom = 1;
}
