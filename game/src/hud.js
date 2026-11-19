// The HUD and the screens: wanted stars, cash, health, ammo, speed, the
// clock and the district, the objective line and compass arrow, the title
// screen with the full feature list, pause / busted / wasted panels and
// the shop and garage menus.

import { VIEW, PALETTE, WEAPONS, ECONOMY, RADIO_STATIONS } from './config.js';
import { districtAt } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

function clockText(G) {
  const t = Math.floor(G.clock) % 86400;
  const hh = Math.floor(t / 3600);
  const mm = Math.floor((t % 3600) / 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function rankName(G) {
  const done = G.missionsDone.length;
  if (done >= 12) return 'King of the Bay';
  if (done >= 9) return 'Bay Boss';
  if (done >= 6) return 'Wheelman';
  if (done >= 3) return 'Hustler';
  if (done >= 1) return 'Runner';
  return 'Nobody';
}

export function drawHud(ctx, G) {
  const p = G.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // Wanted stars, top-left.
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = G.wanted > 0 ? '#ffd21f' : 'rgba(244,241,234,0.35)';
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < G.wanted ? '★' : '☆';
  ctx.fillText(stars, 16, 40);
  if (G.wanted > 0) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#ff5a5a';
    ctx.fillText('WANTED', 16, 58);
  }
  // Cash + rank.
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = '#39ff88';
  ctx.fillText(`$${Math.floor(G.cash)}`, 16, 92);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(rankName(G), 16, 114);
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(16, 126, 180, 12);
  ctx.fillStyle = p.health > 40 ? '#39ff88' : '#ff2d2d';
  ctx.fillRect(16, 126, 180 * (p.health / 100), 12);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.health)}`, 20, 136);
  // Weapon + ammo, bottom-left.
  const w = WEAPONS[p.weapon];
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = w.color;
  const ammo = w.name === 'Pistol' ? `${p.mag[w.name] ?? 0} / ∞` : `${p.mag[w.name] ?? 0} / ${p.ammo[w.name] || 0}`;
  ctx.fillText(`${w.name}  ${ammo}`, 16, VIEW.h - 44);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('1-4 weapons · Q radio · M mute', 16, VIEW.h - 22);
  // Speed + clock + district, bottom-right.
  const speed = p.onFoot ? 0 : Math.abs(Math.round((p.car.speed / 620) * 120));
  ctx.textAlign = 'right';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(p.onFoot ? 'ON FOOT' : `${speed} mph`, VIEW.w - 16, VIEW.h - 44);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`${clockText(G)} · ${districtAt(G.city, p.x, p.y).name}`, VIEW.w - 16, VIEW.h - 22);
  // NOS meter when driving.
  if (!p.onFoot && p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(VIEW.w - 196, VIEW.h - 78, 180, 10);
    ctx.fillStyle = '#19e3ff';
    ctx.fillRect(VIEW.w - 196, VIEW.h - 78, 180 * (p.car.nos / 100), 10);
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#19e3ff';
    ctx.fillText('NOS — hold Shift', VIEW.w - 16, VIEW.h - 84);
  }
  // Radio station.
  ctx.textAlign = 'right';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.neonPink;
  ctx.fillText(`♪ ${G.audio.stationName()}`, VIEW.w - 16, 210);
  // Objective line + compass arrow, top-centre.
  const obj = G.objectiveText;
  if (obj) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.neonGold;
    ctx.fillText(obj, VIEW.w / 2, 34);
    if (G.missionMarker) {
      const dx = G.missionMarker.x - p.x;
      const dy = G.missionMarker.y - p.y;
      const d = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(VIEW.w / 2, 62);
      ctx.rotate(ang);
      ctx.fillStyle = PALETTE.neonGold;
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-8, -7); ctx.lineTo(-8, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(`${Math.round(d)}m`, VIEW.w / 2, 82);
    }
  }
  // Banner (mission start / complete / busted warnings).
  if (G.banner && G.banner.t > 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = G.banner.color || PALETTE.neonGold;
    ctx.globalAlpha = Math.min(1, G.banner.t);
    ctx.fillText(G.banner.text, VIEW.w / 2, 150);
    if (G.banner.sub) {
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(G.banner.sub, VIEW.w / 2, 178);
    }
    ctx.globalAlpha = 1;
  }
  // Heat vignette at high wanted.
  if (G.wanted >= 4) {
    const grad = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.35, VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.75);
    grad.addColorStop(0, 'rgba(255,0,0,0)');
    grad.addColorStop(1, `rgba(255,0,0,${0.10 + 0.05 * Math.sin(G.time * 3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }
  // Interaction prompt.
  if (G.prompt) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = '#14101f';
    const tw = ctx.measureText(G.prompt).width + 28;
    ctx.fillStyle = 'rgba(244,241,234,0.92)';
    ctx.beginPath();
    ctx.roundRect(VIEW.w / 2 - tw / 2, VIEW.h - 120, tw, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#14101f';
    ctx.fillText(G.prompt, VIEW.w / 2, VIEW.h - 97);
  }
  ctx.restore();
}

function panel(ctx, title, lines, prompt, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(8, 6, 20, 0.72)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  const w = 680;
  const h = 150 + lines.length * 30;
  const x = (VIEW.w - w) / 2;
  const y = (VIEW.h - h) / 2;
  ctx.fillStyle = PALETTE.panel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = color || PALETTE.neonPink;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = color || PALETTE.neonPink;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(title, VIEW.w / 2, y + 70);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '17px system-ui, sans-serif';
  lines.forEach((ln, i) => ctx.fillText(ln, VIEW.w / 2, y + 112 + i * 30));
  ctx.fillStyle = PALETTE.neonGold;
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(prompt, VIEW.w / 2, y + h - 24);
  ctx.restore();
}

export function drawTitle(ctx, G) {
  const lines = [
    '12 story missions · police helicopter + roadblocks · 4 weapons',
    '4 radio stations · garage upgrades · shops · safehouse · NOS · saves',
    'Steal cars · taxi fares · street races · 6 districts of Solmar Bay',
    `Milo Kade vs Big Lou — golden dusk 18:40 into neon night`,
    `Best rank: ${rankName(G)} · Missions done: ${G.missionsDone.length}/12 · Cash $${Math.floor(G.cash)}`,
  ];
  panel(ctx, 'LUMEN BAY', lines, 'Press Space or click to start  ·  WASD drive · E enter car · mouse aim', PALETTE.neonPink);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.neonCyan;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('— NEON HEAT —', VIEW.w / 2, VIEW.h / 2 - 118);
  ctx.restore();
}

export function drawPaused(ctx) {
  panel(ctx, 'PAUSED', ['The bay waits for no one. But it will wait for you.'], 'Press P or Esc to resume', PALETTE.neonCyan);
}

export function drawBusted(ctx, G) {
  panel(ctx, 'BUSTED', [`The Solmar Bay PD caught Milo Kade.`, `Missions done: ${G.missionsDone.length}/12 · Cash kept: $${Math.floor(G.cash * 0.8)}`], 'Press Space to walk free', '#2f6df6');
}

export function drawWasted(ctx, G) {
  panel(ctx, 'WASTED', [`Milo Kade went down in ${districtAt(G.city, G.player.x, G.player.y).name}.`, `Missions done: ${G.missionsDone.length}/12`], 'Press Space to try again', '#ff2d2d');
}

export function drawShop(ctx, G) {
  const shop = G.shop;
  if (!shop) return;
  const lines = shop.items.map((it, i) => `${i + 1}. ${it.name} — $${it.price}${it.owned ? ' (owned — buys ammo)' : ''}`);
  lines.push('');
  lines.push(`Cash: $${Math.floor(G.cash)} · ${shop.hint}`);
  panel(ctx, shop.title, lines, 'Press a number to buy · E or Esc to leave', PALETTE.neonCyan);
}

export function drawGarage(ctx, G) {
  const up = G.upgrades;
  const lines = [
    `1. Armor tier ${up.armor}/3 — $${ECONOMY.garage.armor[up.armor + 1] ?? 'MAX'}`,
    `2. Engine tier ${up.engine}/3 — $${ECONOMY.garage.engine[up.engine + 1] ?? 'MAX'}`,
    `3. NOS tier ${up.nos}/3 — $${ECONOMY.garage.nos[up.nos + 1] ?? 'MAX'}`,
    `4. Repaint — $${ECONOMY.garage.paint} (cycles 6 neon paints)`,
    `5. Repair + NOS refill — $${ECONOMY.repairCost + ECONOMY.nosRefill}`,
    '',
    `Cash: $${Math.floor(G.cash)} · Car HP ${G.player.car ? Math.round(G.player.car.hp) : '—'}/100`,
  ];
  panel(ctx, 'VOLT GARAGE', lines, 'Press a number to buy · E or Esc to leave', PALETTE.neonOrange);
}
