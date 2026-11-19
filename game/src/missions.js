// The story: 12 missions for Milo Kade, from a first stolen car to the
// fall of Big Lou, plus taxi fares and the Bay Circuit street races.
// A mission is data: steps of a few kinds (go to, deliver a car, collect,
// shake down, lose the heat, race checkpoints, escort, take out a target),
// so the loop stays small and the test can drive any of them.

import { MISSION_NAMES, ECONOMY } from './config.js';
import { nearestRoadPoint, roadCenterV, roadCenterH } from './city.js';
import { nearestCar } from './vehicles.js';
import { addWanted } from './player.js';

function at(city, rv, rh, dx = 0, dy = 0) {
  return { x: roadCenterV(rv) + dx, y: roadCenterH(rh) + dy };
}

export function missionDefs(city) {
  const P = city.places;
  return [
    { name: MISSION_NAMES[0], giver: 'Vera Solano', brief: 'Steal a car and bring it to Volt Garage.', reward: 300,
      steps: [{ kind: 'steal-any', label: 'Steal any car' }, { kind: 'deliver', to: P.garage, label: 'Bring it to Volt Garage' }] },
    { name: MISSION_NAMES[1], giver: 'Vera Solano', brief: 'Pick up the package at the Neon Diner, deliver it to the pier in 90 seconds.', reward: 400,
      steps: [{ kind: 'goto', to: P.diner, label: 'Pick up the package' }, { kind: 'deliver', to: P.pier, label: 'Deliver to the pier', time: 90 }] },
    { name: MISSION_NAMES[2], giver: 'Big Lou', brief: 'Collect protection money from three shops. Press E at each one.', reward: 450,
      steps: [{ kind: 'shakedown', spots: [P.gunshop, P.diner, P.garage], label: 'Shake down the shops' }] },
    { name: MISSION_NAMES[3], giver: 'Vera Solano', brief: 'Draw 3 stars of heat, then lose it and reach the safehouse.', reward: 500,
      steps: [{ kind: 'heat', stars: 3, label: 'Draw 3 stars of heat' }, { kind: 'loseheat', to: P.safehouse, label: 'Lose the heat, reach the safehouse' }] },
    { name: MISSION_NAMES[4], giver: 'Big Lou', brief: 'Rob the Solmar Reserve Bank, grab the vault cash, escape with 5 stars.', reward: 800,
      steps: [{ kind: 'goto', to: P.bank, label: 'Reach the bank' }, { kind: 'collect', count: 3, at: P.bank, label: 'Grab the vault cash' }, { kind: 'escape', to: P.safehouse, label: 'Escape to the safehouse' }] },
    { name: MISSION_NAMES[5], giver: 'Vera Solano', brief: 'Midnight race: hit all 5 checkpoints in 75 seconds.', reward: 600,
      steps: [{ kind: 'race', points: [at(city, 1, 5), at(city, 5, 4), at(city, 6, 1), at(city, 2, 0), at(city, 3, 3)], time: 75, label: 'Midnight Race' }] },
    { name: MISSION_NAMES[6], giver: 'Big Lou', brief: 'Take out Big Lou\'s lieutenant at the Marina, then meet Vera at the pier.', reward: 700,
      steps: [{ kind: 'kill', at: P.harbor, label: 'Take out the lieutenant' }, { kind: 'goto', to: P.pier, label: 'Meet Vera at the pier' }] },
    { name: MISSION_NAMES[7], giver: 'Vera Solano', brief: 'Bay Circuit: three races, four checkpoints each. Win them all.', reward: 900,
      steps: [
        { kind: 'race', points: [at(city, 0, 5), at(city, 3, 5), at(city, 6, 4), at(city, 4, 2)], time: 60, label: 'Bay Circuit — Race 1' },
        { kind: 'race', points: [at(city, 6, 0), at(city, 3, 1), at(city, 0, 2), at(city, 2, 4)], time: 60, label: 'Bay Circuit — Race 2' },
        { kind: 'race', points: [at(city, 1, 0), at(city, 5, 2), at(city, 6, 5), at(city, 2, 3)], time: 60, label: 'Bay Circuit — Race 3' },
      ] },
    { name: MISSION_NAMES[8], giver: 'Big Lou', brief: 'Pick up the smuggled goods at Dockside, deliver them to Industrial in 120 seconds.', reward: 750,
      steps: [{ kind: 'goto', to: P.harbor, label: 'Pick up the goods' }, { kind: 'deliver', to: at(city, 1, 3), label: 'Deliver to Industrial', time: 120 }] },
    { name: MISSION_NAMES[9], giver: 'Vera Solano', brief: 'Steal the gold marked car and bring it to Volt Garage.', reward: 650,
      steps: [{ kind: 'steal-marked', label: 'Steal the gold car' }, { kind: 'deliver', to: P.garage, label: 'Deliver to Volt Garage' }] },
    { name: MISSION_NAMES[10], giver: 'Vera Solano', brief: 'Escort the witness from Old Town to the safehouse in 100 seconds. Keep them alive.', reward: 800,
      steps: [{ kind: 'escort', from: at(city, 1, 1), to: P.safehouse, time: 100, label: 'Escort the witness' }] },
    { name: MISSION_NAMES[11], giver: 'Vera Solano', brief: "Storm Big Lou's compound downtown, take out all three guards, then escape to the pier.", reward: 1500,
      steps: [{ kind: 'kill', at: P.bank, count: 3, label: "Take out Big Lou's guards" }, { kind: 'goto', to: P.pier, label: 'Escape to the pier' }] },
  ];
}

export function startMission(G, index) {
  const defs = missionDefs(G.city);
  const def = defs[index];
  if (!def) return false;
  G.mission = { index, def, step: 0, timer: 0, data: {}, done: false };
  enterStep(G);
  G.events.push('mission-start');
  return true;
}

function enterStep(G) {
  const m = G.mission;
  const step = m.def.steps[m.step];
  m.timer = step.time || 0;
  m.data = {};
  if (step.kind === 'collect') {
    m.data.items = [];
    for (let i = 0; i < step.count; i += 1) {
      m.data.items.push({ x: step.at.x + (i - 1) * 46, y: step.at.y + 30, taken: false });
    }
  }
  if (step.kind === 'shakedown') {
    m.data.spots = step.spots.map((s) => ({ ...s, done: false }));
  }
  if (step.kind === 'race') {
    m.data.points = step.points.map((p) => ({ ...p, done: false }));
    m.data.idx = 0;
  }
  if (step.kind === 'steal-marked') {
    const near = nearestCar(G, G.player.x, G.player.y, 4000, ['parked']);
    const car = near ? near.car : G.cars.find((c) => c.kind === 'parked');
    if (car) {
      car.marked = true;
      car.color = '#ffd700';
      m.data.car = car;
    }
  }
  if (step.kind === 'kill') {
    const count = step.count || 1;
    m.data.targets = [];
    for (let i = 0; i < count; i += 1) {
      m.data.targets.push({ x: step.at.x + (i - 1) * 60, y: step.at.y + 40, hp: 100, dead: false });
    }
  }
  if (step.kind === 'escort') {
    m.data.witness = { x: step.from.x, y: step.from.y, hp: 100, inCar: false };
  }
}

function stepDone(G) {
  const m = G.mission;
  m.step += 1;
  if (m.step >= m.def.steps.length) {
    G.cash += m.def.reward;
    G.lastReward = m.def.reward;
    G.missionsDone.push(m.index);
    G.stats.missions += 1;
    G.events.push('mission-complete');
    G.mission = null;
    // Auto-start the next mission after a beat.
    const next = m.index + 1;
    if (next < MISSION_NAMES.length) G.nextMissionAt = G.time + 6;
    return;
  }
  enterStep(G);
}

function distTo(x, y, tx, ty) { return Math.hypot(tx - x, ty - y); }

export function updateMissions(G, dt) {
  if (G.nextMissionAt && G.time >= G.nextMissionAt && !G.mission) {
    G.nextMissionAt = 0;
    startMission(G, G.missionsDone.length);
  }
  const m = G.mission;
  if (!m) return;
  const step = m.def.steps[m.step];
  const px = G.player.onFoot ? G.player.x : G.player.car.x;
  const py = G.player.onFoot ? G.player.y : G.player.car.y;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      G.events.push('mission-failed');
      G.mission = null;
      return;
    }
  }
  switch (step.kind) {
    case 'goto':
      if (distTo(px, py, step.to.x, step.to.y) < 70) stepDone(G);
      break;
    case 'deliver':
      if (!G.player.onFoot && distTo(px, py, step.to.x, step.to.y) < 80) stepDone(G);
      break;
    case 'steal-any':
      if (!G.player.onFoot) stepDone(G);
      break;
    case 'steal-marked':
      if (!G.player.onFoot && G.player.car === m.data.car) stepDone(G);
      break;
    case 'collect':
      for (const it of m.data.items) {
        if (!it.taken && distTo(px, py, it.x, it.y) < 46) {
          it.taken = true;
          G.cash += 400;
          G.events.push('pickup-cash');
        }
      }
      if (m.data.items.every((it) => it.taken)) stepDone(G);
      break;
    case 'shakedown':
      for (const s of m.data.spots) {
        if (!s.done && distTo(px, py, s.x, s.y) < 80 && G.interactPressed) {
          s.done = true;
          G.cash += 150;
          G.events.push('pickup-cash');
        }
      }
      if (m.data.spots.every((s) => s.done)) stepDone(G);
      break;
    case 'heat':
      if (G.wanted >= step.stars) stepDone(G);
      break;
    case 'loseheat':
      if (G.wanted === 0 && distTo(px, py, step.to.x, step.to.y) < 80) stepDone(G);
      break;
    case 'escape':
      if (G.wanted >= 5 && distTo(px, py, step.to.x, step.to.y) < 80) stepDone(G);
      break;
    case 'race': {
      const pt = m.data.points[m.data.idx];
      if (pt && distTo(px, py, pt.x, pt.y) < 90) {
        pt.done = true;
        m.data.idx += 1;
        G.events.push('checkpoint');
        if (m.data.idx >= m.data.points.length) {
          G.cash += ECONOMY.racePrize;
          stepDone(G);
        }
      }
      break;
    }
    case 'kill': {
      // Targets are shot by the player's ray; player.js marks them via G.shotTargets.
      for (const t of m.data.targets) {
        if (!t.dead && G.shotTargets.some((s) => s === t)) t.dead = true;
      }
      if (m.data.targets.every((t) => t.dead)) stepDone(G);
      break;
    }
    case 'escort': {
      const w = m.data.witness;
      if (!w.inCar) {
        if (distTo(px, py, w.x, w.y) < 50 && !G.player.onFoot) {
          w.inCar = true;
          G.events.push('pickup-cash');
        }
      } else {
        w.x = px; w.y = py;
        if (G.wanted > 0) w.hp = Math.max(0, w.hp - 2 * dt);
        if (w.hp <= 0) {
          G.events.push('mission-failed');
          G.mission = null;
          return;
        }
        if (distTo(px, py, step.to.x, step.to.y) < 80) stepDone(G);
      }
      break;
    }
    default:
      break;
  }
}

export function missionMarker(G) {
  const m = G.mission;
  if (!m) return null;
  const step = m.def.steps[m.step];
  switch (step.kind) {
    case 'goto': case 'deliver': case 'loseheat': case 'escape':
      return { x: step.to.x, y: step.to.y, label: step.label };
    case 'shakedown': {
      const s = m.data.spots.find((sp) => !sp.done);
      return s ? { x: s.x, y: s.y, label: step.label } : null;
    }
    case 'collect': {
      const it = m.data.items.find((i) => !i.taken);
      return it ? { x: it.x, y: it.y, label: step.label } : null;
    }
    case 'race': {
      const pt = m.data.points[m.data.idx];
      return pt ? { x: pt.x, y: pt.y, label: `${step.label} ${m.data.idx + 1}/${m.data.points.length}` } : null;
    }
    case 'kill': {
      const t = m.data.targets.find((tg) => !tg.dead);
      return t ? { x: t.x, y: t.y, label: step.label } : null;
    }
    case 'escort': {
      const w = m.data.witness;
      return w.inCar ? { x: step.to.x, y: step.to.y, label: step.label } : { x: w.x, y: w.y, label: step.label };
    }
    default:
      return null;
  }
}

// ---- Side jobs ----

export function startTaxi(G) {
  if (G.taxi) return false;
  const peds = G.peds.filter((p) => !p.dead && !p.fare);
  if (!peds.length) return false;
  const px = G.player.onFoot ? G.player.x : G.player.car.x;
  const py = G.player.onFoot ? G.player.y : G.player.car.y;
  let best = null;
  for (const p of peds) {
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < 320 && (!best || d < best.d)) best = { ped: p, d };
  }
  if (!best) return false;
  best.ped.fare = true;
  const dest = nearestRoadPoint(G.city, px + G.rng.range(-1600, 1600), py + G.rng.range(-1200, 1200));
  G.taxi = { ped: best.ped, dest, fare: G.rng.int(ECONOMY.taxiFare[0], ECONOMY.taxiFare[1]), picked: false };
  G.events.push('taxi-start');
  return true;
}

export function updateTaxi(G, dt) {
  const t = G.taxi;
  if (!t) return;
  const px = G.player.onFoot ? G.player.x : G.player.car.x;
  const py = G.player.onFoot ? G.player.y : G.player.car.y;
  if (!t.picked) {
    if (!G.player.onFoot && Math.hypot(px - t.ped.x, py - t.ped.y) < 60) {
      t.picked = true;
      t.ped.x = px; t.ped.y = py;
      G.events.push('taxi-pickup');
    }
  } else {
    t.ped.x = px; t.ped.y = py;
    if (Math.hypot(px - t.dest.x, py - t.dest.y) < 80) {
      G.cash += t.fare;
      G.events.push('taxi-done');
      t.ped.fare = false;
      G.taxi = null;
    }
  }
  void dt;
}

export function startRace(G) {
  if (G.race) return false;
  const pts = [
    { x: roadCenterV(4), y: roadCenterH(4) },
    { x: roadCenterV(6), y: roadCenterH(1) },
    { x: roadCenterV(1), y: roadCenterH(0) },
    { x: roadCenterV(2), y: roadCenterH(3) },
  ];
  G.race = { points: pts.map((p) => ({ ...p, done: false })), idx: 0, timer: 90 };
  G.events.push('race-start');
  return true;
}

export function updateRace(G, dt) {
  const r = G.race;
  if (!r) return;
  r.timer -= dt;
  if (r.timer <= 0) {
    G.race = null;
    G.events.push('race-failed');
    return;
  }
  const px = G.player.onFoot ? G.player.x : G.player.car.x;
  const py = G.player.onFoot ? G.player.y : G.player.car.y;
  const pt = r.points[r.idx];
  if (pt && Math.hypot(px - pt.x, py - pt.y) < 90) {
    pt.done = true;
    r.idx += 1;
    G.events.push('checkpoint');
    if (r.idx >= r.points.length) {
      G.cash += ECONOMY.racePrize;
      G.events.push('race-done');
      G.race = null;
    }
  }
}
