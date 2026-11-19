// The game state: one object, G, that every system reads and writes.
// createGame builds a fresh world from a seed — the same seed always
// builds the same city, traffic and pedestrians.

import { WORLD, CLOCK, ECONOMY, PLAYER, CAR, STEP } from './config.js';
import { createRandom } from './random.js';
import { buildCity, roadCenterV, roadCenterH } from './city.js';
import { spawnTraffic, spawnParked, makeCar } from './vehicles.js';
import { spawnPeds } from './people.js';
import { createAudio } from './audio.js';

export function createGame(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const G = {
    seed, rng, city,
    time: 0, clock: CLOCK.start, playSeconds: 0,
    cash: ECONOMY.startCash,
    wanted: 0, unseenTimer: 0, bustTimer: 0,
    shotsFired: 0, shotsTimer: 0, muzzle: 0, lastShot: null,
    interactPressed: false,
    events: [], particles: [], pickups: [],
    shotTargets: [],
    missionsDone: [], mission: null, nextMissionAt: 0,
    taxi: null, race: null, shop: null,
    heli: null, roadblocks: [],
    upgrades: { armor: 0, engine: 0, nos: 0, paint: '#ff2d95' },
    stats: { kills: 0, carsStolen: 0, missions: 0, heliDown: 0 },
    banner: null, prompt: null, objectiveText: '',
    missionMarker: null,
    saveTimer: 20,
    audio: createAudio(),
    camera: { x: 0, y: 0, zoom: 1 },
    player: {
      x: 0, y: 0, angle: 0, aim: 0, onFoot: true, moving: false,
      health: PLAYER.health, car: null, fireTimer: 0,
      weapon: 0, owned: [true, false, false, false],
      ammo: { Pistol: 999, SMG: 0, Shotgun: 0, Rifle: 0 },
      mag: { Pistol: 12, SMG: 0, Shotgun: 0, Rifle: 0 },
    },
    officers: [],
  };

  // Milo starts on foot outside the Neon Diner, downtown.
  G.player.x = roadCenterV(3) - 90;
  G.player.y = roadCenterH(1) + 90;
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;

  G.cars = [];
  G.cars.push(...spawnTraffic(city, rng, 26));
  G.cars.push(...spawnParked(city, rng, 14));
  // The player's first car: a pink coupe parked by the diner.
  const starter = makeCar('parked', roadCenterV(3) - 40, roadCenterH(1) + 40, 0, '#ff2d95');
  starter.owned = false;
  G.cars.push(starter);
  G.peds = spawnPeds(city, rng, 34);

  // A few pickups scattered on the map.
  const pickupSpots = [
    { x: roadCenterV(2) + 60, y: roadCenterH(2) - 60, kind: 'health' },
    { x: roadCenterV(5) - 60, y: roadCenterH(3) + 60, kind: 'ammo' },
    { x: roadCenterV(1) + 60, y: roadCenterH(4) - 60, kind: 'cash' },
    { x: roadCenterV(4) + 60, y: roadCenterH(0) + 60, kind: 'health' },
  ];
  for (const pk of pickupSpots) G.pickups.push({ ...pk, t: 0 });

  return G;
}

export function resetGame(G) {
  const fresh = createGame(G.seed);
  for (const key of Object.keys(fresh)) G[key] = fresh[key];
}
