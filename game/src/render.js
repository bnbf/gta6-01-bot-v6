// Canvas rendering: the city at golden dusk sliding into neon night, the
// cars and people on it, the helicopter's spotlight, mission markers and
// the live minimap. Light is the visual: neon signs, lamps, headlights
// and a light pool around the player as the sky darkens.

import { WORLD, GRID, PALETTE, VIEW, CAR, PLAYER } from './config.js';
import { roadCenterV, roadCenterH, districtAt } from './city.js';

export function nightFactor(G) {
  const start = 18 * 3600 + 40 * 60;
  const end = 20 * 3600;
  return Math.max(0, Math.min(1, (G.clock - start) / (end - start)));
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

export function drawWorld(ctx, G) {
  const cam = G.camera;
  const night = nightFactor(G);
  const w = VIEW.w, h = VIEW.h;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2 - cam.x * cam.zoom, h / 2 - cam.y * cam.zoom);
  ctx.scale(cam.zoom, cam.zoom);
  const vx0 = cam.x - w / 2 / cam.zoom - 80, vx1 = cam.x + w / 2 / cam.zoom + 80;
  const vy0 = cam.y - h / 2 / cam.zoom - 80, vy1 = cam.y + h / 2 / cam.zoom + 80;

  // Sea and beach along the south edge.
  ctx.fillStyle = shade(PALETTE.sea, 1 - night * 0.55);
  ctx.fillRect(Math.max(vx0, 0), WORLD.seaY, WORLD.w, WORLD.h - WORLD.seaY);
  ctx.fillStyle = shade(PALETTE.sand, 1 - night * 0.45);
  ctx.fillRect(Math.max(vx0, 0), WORLD.beachY, WORLD.w, WORLD.seaY - WORLD.beachY);
  // Waves.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const wy = WORLD.seaY + 18 + i * 26 + Math.sin(G.time * 0.7 + i * 1.7) * 5;
    ctx.beginPath();
    ctx.moveTo(Math.max(vx0, 0), wy);
    ctx.lineTo(Math.min(vx1, WORLD.w), wy);
    ctx.stroke();
  }
  // Sunset pier.
  const pier = G.city.places.pier;
  ctx.fillStyle = '#5a4632';
  ctx.fillRect(pier.x - 14, WORLD.beachY - 40, 28, WORLD.seaY - WORLD.beachY + 40);

  // Ground: grass base for the city, then roads and sidewalks.
  ctx.fillStyle = shade(PALETTE.grass, 1 - night * 0.5);
  ctx.fillRect(0, 0, WORLD.w, WORLD.beachY);
  for (const park of G.city.parks) {
    ctx.fillStyle = park.lot ? '#2c2c38' : shade(PALETTE.grass, 1 - night * 0.35);
    ctx.fillRect(park.x, park.y, park.w, park.h);
    if (park.lot) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i += 1) {
        const lx = park.x + 40 + i * 100;
        ctx.beginPath(); ctx.moveTo(lx, park.y + 30); ctx.lineTo(lx, park.y + 90); ctx.stroke();
      }
    }
  }
  // Roads.
  ctx.fillStyle = shade(PALETTE.asphalt, 1 - night * 0.3);
  for (let i = 0; i <= GRID.cols; i += 1) {
    ctx.fillRect(roadCenterV(i) - GRID.roadW / 2, 0, GRID.roadW, WORLD.beachY);
  }
  for (let j = 0; j <= GRID.rows; j += 1) {
    ctx.fillRect(0, roadCenterH(j) - GRID.roadW / 2, WORLD.w, GRID.roadW);
  }
  // Beachfront avenue.
  ctx.fillRect(0, WORLD.beachY, WORLD.w, 80);
  // Road centre dashes.
  ctx.strokeStyle = 'rgba(255,220,120,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (let i = 0; i <= GRID.cols; i += 1) {
    ctx.beginPath(); ctx.moveTo(roadCenterV(i), 0); ctx.lineTo(roadCenterV(i), WORLD.beachY); ctx.stroke();
  }
  for (let j = 0; j <= GRID.rows; j += 1) {
    ctx.beginPath(); ctx.moveTo(0, roadCenterH(j)); ctx.lineTo(WORLD.w, roadCenterH(j)); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Buildings with lit windows and neon signs.
  for (const b of G.city.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = shade(b.color, 1 - night * 0.25);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x, b.y + b.h - 8, b.w, 8);
    // Windows: warm at dusk, brighter at night.
    const cols = Math.max(2, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 30));
    const lit = 0.25 + night * 0.55;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const on = ((c * 7 + r * 13 + b.floors) % 10) / 10 < lit;
        ctx.fillStyle = on ? (night > 0.5 ? '#ffd97a' : '#ffe9b0') : 'rgba(0,0,0,0.3)';
        ctx.fillRect(b.x + 8 + c * 34, b.y + 10 + r * 30, 18, 14);
      }
    }
    if (b.neon) {
      ctx.save();
      ctx.shadowColor = b.neonColor;
      ctx.shadowBlur = 14 + night * 12;
      ctx.fillStyle = b.neonColor;
      ctx.font = `bold ${Math.min(26, b.w / Math.max(3, b.sign.length) + 6)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + 24);
      ctx.restore();
    }
    if (b.landmark) {
      // Never paint a label under the HUD: the top strip holds the stars
      // and the objective, the top-right holds the minimap, the bottom
      // holds the speed and weapon readouts.
      const sx = b.x + b.w / 2 - G.camera.x + 640;
      const sy = b.y + b.h + 18 - G.camera.y + 360;
      if (sy >= 70 && sy <= 640 && !(sx > 1020 && sy < 230) && sx >= 30 && sx <= 1250) {
        ctx.fillStyle = '#f4f1ea';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.landmark, b.x + b.w / 2, b.y + b.h + 18);
      }
    }
  }
  // Palms.
  for (const p of G.city.palms) {
    if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
    ctx.strokeStyle = '#3d2c1e';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 4 * p.s, p.y - 22 * p.s); ctx.stroke();
    ctx.strokeStyle = shade('#2e7d32', 1 - night * 0.4);
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x + 4 * p.s, p.y - 22 * p.s);
      ctx.lineTo(p.x + 4 * p.s + Math.cos(a) * 18 * p.s, p.y - 22 * p.s + Math.sin(a) * 10 * p.s + 8);
      ctx.stroke();
    }
  }

  // District labels on the ground.
  ctx.fillStyle = 'rgba(244,241,234,0.5)';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const d of G.city.districts) {
    const cx = GRID.roadW + ((d.x0 + d.x1) / 2) * (GRID.blockW + GRID.roadW) - GRID.roadW / 2;
    const cy = GRID.roadW + ((d.y0 + d.y1) / 2) * (GRID.blockH + GRID.roadW) - GRID.roadW / 2;
    if (cx < vx0 || cx > vx1 || cy < vy0 || cy > vy1) continue;
    const sy = cy - G.camera.y + 360;
    if (sy < 70 || sy > 640) continue; // keep the top and bottom HUD clear
    ctx.fillText(d.name.toUpperCase(), cx, cy);
  }

  // Mission / job markers: light pillars + rings.
  const markers = [];
  const mm = G.missionMarker;
  if (mm) markers.push({ ...mm, color: PALETTE.neonGold });
  if (G.taxi) markers.push({ x: G.taxi.picked ? G.taxi.dest.x : G.taxi.ped.x, y: G.taxi.picked ? G.taxi.dest.y : G.taxi.ped.y, color: PALETTE.neonCyan, label: 'TAXI' });
  if (G.race) {
    const pt = G.race.points[G.race.idx];
    if (pt) markers.push({ x: pt.x, y: pt.y, color: '#ffffff', label: 'RACE' });
  }
  for (const mk of markers) {
    const pulse = 0.6 + 0.4 * Math.sin(G.time * 4);
    const grad = ctx.createLinearGradient(mk.x, mk.y - 320, mk.x, mk.y);
    grad.addColorStop(0, 'rgba(255,210,51,0)');
    grad.addColorStop(1, mk.color);
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.35 * pulse;
    ctx.fillRect(mk.x - 8, mk.y - 320, 16, 320);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = mk.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(mk.x, mk.y, 34 + pulse * 8, 14 + pulse * 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Mission collect items / targets / witness.
  if (G.mission && G.mission.data) {
    const d = G.mission.data;
    if (d.items) {
      for (const it of d.items) {
        if (it.taken) continue;
        ctx.fillStyle = PALETTE.neonGold;
        ctx.beginPath(); ctx.arc(it.x, it.y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#201a08';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', it.x, it.y + 5);
      }
    }
    if (d.targets) {
      for (const t of d.targets) {
        if (t.dead) continue;
        ctx.fillStyle = '#ff2d2d';
        ctx.beginPath(); ctx.arc(t.x, t.y, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', t.x, t.y + 5);
      }
    }
    if (d.witness && !d.witness.inCar) {
      ctx.fillStyle = PALETTE.neonCyan;
      ctx.beginPath(); ctx.arc(d.witness.x, d.witness.y, 12, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Pickups.
  for (const pk of G.pickups) {
    ctx.fillStyle = pk.kind === 'health' ? '#39ff88' : pk.kind === 'ammo' ? '#ffc233' : '#f4f1ea';
    ctx.beginPath(); ctx.arc(pk.x, pk.y, 10 + Math.sin(G.time * 5 + pk.x) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#14101f';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', pk.x, pk.y + 4);
  }
  // Place labels (garage, shops, safehouse, bank).
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(G.city.places)) {
    const pl = G.city.places[key];
    if (pl.x < vx0 || pl.x > vx1 || pl.y < vy0 || pl.y > vy1) continue;
    const sy = pl.y - 26 - G.camera.y + 360;
    if (sy < 70 || sy > 640) continue; // keep the top and bottom HUD clear
    ctx.fillStyle = pl.kind === 'garage' ? PALETTE.neonOrange : pl.kind === 'gunshop' ? PALETTE.neonCyan : pl.kind === 'safehouse' ? PALETTE.neonGreen : '#f4f1ea';
    ctx.fillText(pl.name.toUpperCase(), pl.x, pl.y - 26);
    ctx.beginPath(); ctx.arc(pl.x, pl.y, 6, 0, Math.PI * 2); ctx.fill();
  }

  // Cars.
  for (const car of G.cars) {
    if (car.dead) continue;
    drawCar(ctx, car, G, night);
  }
  // Pedestrians and officers.
  for (const ped of G.peds) {
    if (ped.dead) continue;
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1710';
    ctx.beginPath(); ctx.arc(ped.x, ped.y - 3, 4, 0, Math.PI * 2); ctx.fill();
    if (ped.fare) {
      ctx.fillStyle = PALETTE.neonCyan;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI?', ped.x, ped.y - 18);
    }
  }
  for (const off of G.officers) {
    if (off.dead) continue;
    ctx.fillStyle = '#1d3fae';
    ctx.beginPath(); ctx.arc(off.x, off.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cdd7ff';
    ctx.beginPath(); ctx.arc(off.x, off.y - 3, 4, 0, Math.PI * 2); ctx.fill();
  }
  // The player on foot.
  if (G.player.onFoot) {
    const p = G.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim);
    ctx.fillStyle = '#ff2d95';
    ctx.fillRect(-10, -7, 20, 14);
    ctx.fillStyle = '#20242e';
    ctx.fillRect(8, -2, 12, 4);
    ctx.restore();
    ctx.fillStyle = '#ffd9ec';
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Helicopter + spotlight.
  if (G.heli) {
    const h = G.heli;
    const tx = G.player.onFoot ? G.player.x : G.player.car.x;
    const ty = G.player.onFoot ? G.player.y : G.player.car.y;
    const grad = ctx.createLinearGradient(h.x, h.y, tx, ty);
    grad.addColorStop(0, 'rgba(255,255,200,0.30)');
    grad.addColorStop(1, 'rgba(255,255,200,0.05)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    const perp = Math.atan2(ty - h.y, tx - h.x) + Math.PI / 2;
    ctx.lineTo(tx + Math.cos(perp) * 70, ty + Math.sin(perp) * 70);
    ctx.lineTo(tx - Math.cos(perp) * 70, ty - Math.sin(perp) * 70);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.fillStyle = PALETTE.heli;
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 12, h.angle, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;
    const r = h.rotor || 0;
    ctx.beginPath(); ctx.moveTo(Math.cos(r) * 34, Math.sin(r) * 8); ctx.lineTo(-Math.cos(r) * 34, -Math.sin(r) * 8); ctx.stroke();
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Particles.
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Muzzle flash.
  if (G.muzzle > 0 && G.lastShot) {
    const s = G.lastShot;
    ctx.strokeStyle = '#ffe9a0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + Math.cos(s.angle) * s.dist, s.y + Math.sin(s.angle) * s.dist);
    ctx.stroke();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(s.x + Math.cos(s.angle) * 18, s.y + Math.sin(s.angle) * 18, 7, 0, Math.PI * 2); ctx.fill();
  }
  // Night darkness + light pool around the player.
  if (night > 0.05) {
    ctx.fillStyle = `rgba(8, 6, 26, ${night * 0.42})`;
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    const px = G.player.onFoot ? G.player.x : G.player.car.x;
    const py = G.player.onFoot ? G.player.y : G.player.car.y;
    const pool = ctx.createRadialGradient(px, py, 60, px, py, 420);
    pool.addColorStop(0, 'rgba(255,220,150,0.20)');
    pool.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(px - 420, py - 420, 840, 840);
  }
  ctx.restore();
}

function drawCar(ctx, car, G, night) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-24, -12, 48, 26);
  const body = car.marked ? '#ffd700' : (car.paint || car.color);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-24, -13, 48, 26, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(10,14,24,0.85)';
  ctx.beginPath();
  ctx.roundRect(-8, -10, 18, 20, 4);
  ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    const blink = Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2d2d' : '#2f6df6';
    ctx.beginPath(); ctx.arc(-14, -8, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = blink ? '#2f6df6' : '#ff2d2d';
    ctx.beginPath(); ctx.arc(-14, 8, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (car.kind === 'player') {
    ctx.fillStyle = PALETTE.neonPink;
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Headlights at night.
  if (night > 0.3 && car.speed > 5) {
    const grad = ctx.createLinearGradient(24, 0, 190, 0);
    grad.addColorStop(0, 'rgba(255,240,180,0.35)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(24, -10);
    ctx.lineTo(190, -44);
    ctx.lineTo(190, 44);
    ctx.lineTo(24, 10);
    ctx.closePath();
    ctx.fill();
  }
  // Smoke when wrecked.
  if (car.smoke) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    const t = G.time * 3;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(-10 - i * 6, -6 + Math.sin(t + i) * 6, 7 + i * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Damage bar for the player's car.
  if (car.kind === 'player' && car.hp < car.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-24, -20, 48, 5);
    ctx.fillStyle = car.hp > 40 ? '#39ff88' : '#ff2d2d';
    ctx.fillRect(-24, -20, 48 * (car.hp / car.maxHp), 5);
  }
  ctx.restore();
}

export function drawMinimap(ctx, G) {
  const mw = 218, mh = Math.round((218 * WORLD.h) / WORLD.w);
  const x0 = VIEW.w - mw - 14, y0 = 14;
  const sx = mw / WORLD.w, sy = mh / WORLD.h;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 8, 22, 0.78)';
  ctx.beginPath();
  ctx.roundRect(x0 - 6, y0 - 6, mw + 12, mh + 12, 8);
  ctx.fill();
  // Sea + land.
  ctx.fillStyle = '#0e3a5c';
  ctx.fillRect(x0, y0, mw, mh);
  ctx.fillStyle = '#1e4d2a';
  ctx.fillRect(x0, y0, mw, (WORLD.beachY / WORLD.h) * mh);
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID.cols; i += 1) {
    ctx.beginPath(); ctx.moveTo(x0 + roadCenterV(i) * sx, y0); ctx.lineTo(x0 + roadCenterV(i) * sx, y0 + mh); ctx.stroke();
  }
  for (let j = 0; j <= GRID.rows; j += 1) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + roadCenterH(j) * sy); ctx.lineTo(x0 + mw, y0 + roadCenterH(j) * sy); ctx.stroke();
  }
  // District label for the current district.
  const d = districtAt(G.city, G.player.x, G.player.y);
  ctx.fillStyle = '#f4f1ea';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(d.name.toUpperCase(), x0, y0 + mh + 18);
  // Dots: player, cops, mission.
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x0 + x * sx, y0 + y * sy, r, 0, Math.PI * 2); ctx.fill();
  };
  for (const car of G.cars) {
    if (car.dead) continue;
    if (car.kind === 'police') dot(car.x, car.y, '#ff2d2d', 2.5);
  }
  if (G.heli) dot(G.heli.x, G.heli.y, '#ff2d2d', 3.5);
  const mm = G.missionMarker;
  if (mm) dot(mm.x, mm.y, PALETTE.neonGold, 3.5);
  const px = G.player.onFoot ? G.player.x : G.player.car.x;
  const py = G.player.onFoot ? G.player.y : G.player.car.y;
  dot(px, py, '#ffffff', 3.5);
  ctx.strokeStyle = '#ff2d95';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x0 + px * sx, y0 + py * sy, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
