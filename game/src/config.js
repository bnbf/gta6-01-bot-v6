// LUMEN BAY — Neon Heat: every tuning number and colour in one place.
// The world is a fixed 4760 x 3800 unit map: a 7x6 block city grid, a beach
// strip and the sea along the south edge. The renderer draws it scaled to
// the window, so no rule below depends on the screen size.

export const WORLD = { w: 4880, h: 3800, beachY: 3600, seaY: 3700 };
export const GRID = { cols: 7, rows: 6, blockW: 560, blockH: 460, roadW: 120 };
export const STEP = 1 / 60;
export const VIEW = { w: 1280, h: 720 };

// The clock starts at golden dusk and slides into neon night.
export const CLOCK = { start: 18 * 3600 + 40 * 60, night: 20 * 3600, dayLength: 3600 };

export const PALETTE = {
  skyDusk: '#ff9a5c', skyNight: '#12082e', sea: '#0e3a5c', sand: '#d9b380',
  asphalt: '#23232e', asphaltNight: '#191922', sidewalk: '#3a3a48',
  grass: '#1e4d2a', grassNight: '#122e18',
  neonPink: '#ff2d95', neonCyan: '#19e3ff', neonGold: '#ffc233',
  neonPurple: '#a259ff', neonGreen: '#39ff88', neonOrange: '#ff7a1a',
  text: '#f4f1ea', muted: '#9a94a8', panel: 'rgba(12, 10, 26, 0.82)',
  police: '#2f6df6', policeLight: '#ff2d2d', heli: '#20242e',
};

export const DISTRICTS = [
  { name: 'Old Town', x0: 0, y0: 0, x1: 2, y1: 2, tint: '#c9a86a', landmark: 'Fountain Plaza' },
  { name: 'Downtown', x0: 2, y0: 0, x1: 5, y1: 2, tint: '#7fb2ff', landmark: 'Solmar Tower' },
  { name: 'Marina', x0: 5, y0: 0, x1: 7, y1: 4, tint: '#4fd8c9', landmark: 'Harbor Lights' },
  { name: 'Industrial', x0: 0, y0: 2, x1: 2, y1: 4, tint: '#b08954', landmark: 'Foundry Crane' },
  { name: 'Neon Strip', x0: 2, y0: 2, x1: 5, y1: 4, tint: '#ff2d95', landmark: 'LUMEN Mile' },
  { name: 'Beachfront', x0: 0, y0: 4, x1: 7, y1: 6, tint: '#ffd166', landmark: 'Sunset Pier' },
];

export const PLAYER = {
  walkSpeed: 170, runSpeed: 300, radius: 13, health: 100,
  enterRange: 56, bustRadius: 26,
};

export const CAR = {
  accel: 420, brake: 700, reverse: 240, maxSpeed: 620, maxReverse: 220,
  steer: 2.6, grip: 8.5, drag: 0.55, nosBoost: 340, nosDrain: 34, nosMax: 100,
  radius: 20, hp: 100, stealWanted: 1,
};

export const TRAFFIC = { count: 26, speed: 150, speedJitter: 60, safeGap: 70 };

export const WEAPONS = [
  { name: 'Pistol', key: '1', damage: 34, rate: 3.2, range: 520, spread: 0.02, mag: 12, price: 0, ammoPrice: 25, color: '#cfd6e4' },
  { name: 'SMG', key: '2', damage: 17, rate: 9.0, range: 460, spread: 0.09, mag: 32, price: 450, ammoPrice: 60, color: '#19e3ff' },
  { name: 'Shotgun', key: '3', damage: 13, pellets: 6, rate: 1.3, range: 300, spread: 0.16, mag: 6, price: 800, ammoPrice: 90, color: '#ff7a1a' },
  { name: 'Rifle', key: '4', damage: 62, rate: 2.1, range: 780, spread: 0.008, mag: 10, price: 1400, ammoPrice: 120, color: '#ffc233' },
];

export const WANTED = {
  max: 5, decayUnseen: 4, decayPerSec: 0.5,
  copCars: [0, 1, 2, 3, 4, 5], heliAt: 4, roadblockAt: 4,
  bustTime: 2.5, copSpeed: 560,
};

export const ECONOMY = {
  startCash: 250, taxiFare: [40, 120], racePrize: 300, missionBase: 300,
  repairCost: 100, nosRefill: 50, healCost: 50,
  garage: { armor: [0, 400, 900, 1600], engine: [0, 500, 1100, 2000], nos: [0, 350, 800, 1400], paint: 100 },
  paints: ['#ff2d95', '#19e3ff', '#ffc233', '#39ff88', '#a259ff', '#f4f1ea'],
};

export const MISSION_NAMES = [
  'First Wheels', 'Neon Courier', 'Protection Money', 'Heat Wave',
  'The Big Score', 'Midnight Race', 'King of the Bay', 'Bay Circuit',
  'Dockside Run', 'Garage Job', 'Safe Witness', "Kingpin's Fall",
];

export const RADIO_STATIONS = ['NEON FM', 'SUNSET DRIVE', 'BAY BASS', 'PALM LO-FI'];

export const SAVE_KEY = 'lumen-bay-v6.save';
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
