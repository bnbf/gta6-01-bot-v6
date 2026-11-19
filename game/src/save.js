// Save and load: cash, health, ammo, owned weapons, missions, garage
// upgrades and paint, best rank and play time, in one localStorage key.
// Autosave runs on a timer and on safehouse visits and mission ends.

import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  const data = {
    cash: Math.floor(G.cash),
    health: Math.round(G.player.health),
    ammo: G.player.ammo,
    mag: G.player.mag,
    owned: G.player.owned,
    weapon: G.player.weapon,
    missionsDone: G.missionsDone,
    upgrades: G.upgrades,
    stats: G.stats,
    clock: Math.floor(G.clock),
    playSeconds: Math.floor(G.playSeconds || 0),
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(G) {
  let data = null;
  try {
    data = JSON.parse(window.localStorage.getItem(SAVE_KEY) || 'null');
  } catch {
    data = null;
  }
  if (!data) return false;
  G.cash = data.cash ?? G.cash;
  G.player.health = data.health ?? G.player.health;
  G.player.ammo = data.ammo ?? G.player.ammo;
  G.player.mag = data.mag ?? G.player.mag;
  G.player.owned = data.owned ?? G.player.owned;
  G.player.weapon = data.weapon ?? G.player.weapon;
  G.missionsDone = data.missionsDone ?? [];
  G.upgrades = { ...G.upgrades, ...(data.upgrades || {}) };
  G.stats = { ...G.stats, ...(data.stats || {}) };
  G.clock = data.clock ?? G.clock;
  G.playSeconds = data.playSeconds ?? 0;
  return true;
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* off */ }
}
