import type { Pal, Plat, Sheep, Decor, Enemy, Floater, Sluice, Lever, Plate, Shelter } from './types';

const W = 1024, H = 576;

// Original vector scenery. These painters never change simulation state or collision bounds.
export function drawSky(ctx: CanvasRenderingContext2D, cx: number, pal: Pal, id: string) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, id === 'cedar' ? '#607f79' : pal.skyTop);
  sky.addColorStop(0.7, id === 'cedar' ? '#c8c79f' : pal.skyBot);
  sky.addColorStop(1, pal.mid);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const sx = 730 - cx * 0.02;
  const glow = ctx.createRadialGradient(sx, 132, 12, sx, 132, 190);
  glow.addColorStop(0, '#ffe9af60'); glow.addColorStop(1, '#ffe9af00');
  ctx.fillStyle = glow; ctx.fillRect(sx - 190, 0, 380, 322);
  ctx.fillStyle = id === 'snow' ? '#e0edf0' : '#f2dfac';
  ctx.beginPath(); ctx.arc(sx, 132, id === 'snow' ? 24 : 32, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff3d618'; ctx.lineWidth = 14;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(110 + i * 320 - cx * 0.015, 91 + i * 38);
    ctx.bezierCurveTo(220 + i * 320, 73 + i * 38, 260 + i * 320, 111 + i * 38, 360 + i * 320, 87 + i * 38); ctx.stroke();
  }
}

export function drawMountains(ctx: CanvasRenderingContext2D, cx: number, pal: Pal) {
  for (let layer = 0; layer < 3; layer++) {
    const step = 92 - layer * 12, offset = cx * (0.06 + layer * 0.09);
    const ridge = (x: number) => 205 + layer * 88 + Math.sin((x + offset) / 149 + layer) * 57 + Math.sin((x + offset) / 61 + layer * 2) * 23;
    ctx.save(); ctx.globalAlpha = layer === 0 ? 0.43 : layer === 1 ? 0.65 : 0.9;
    ctx.fillStyle = [pal.far, pal.mid, pal.far][layer];
    ctx.beginPath(); ctx.moveTo(-step, H);
    for (let x = -step; x <= W + step; x += step) ctx.lineTo(x, ridge(x));
    ctx.lineTo(W + step, H); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e3d9ae16';
    for (let x = 0; x < W; x += step * 2) {
      ctx.beginPath(); ctx.moveTo(x, ridge(x)); ctx.lineTo(x + step * .65, ridge(x + step)); ctx.lineTo(x + step * .3, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // Distant silhouettes stay behind the playable terrain.
  ctx.save(); ctx.globalAlpha = .24;
  for (let i = -1; i < 14; i++) cedar(ctx, i * 105 - (cx * .3) % 105, 457 + Math.sin(i * 2) * 14, 65 + (i % 3) * 19, pal.near);
  ctx.restore();
}

export function cedar(ctx: CanvasRenderingContext2D, x: number, baseY: number, height: number, color: string) {
  ctx.save(); ctx.translate(x, baseY); ctx.scale(height / 200, height / 200);
  ctx.fillStyle = '#483c2d'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-3, -166); ctx.lineTo(2, -191); ctx.lineTo(7, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#483c2d'; ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const y = -42 - i * 29, span = 67 - i * 10;
    ctx.beginPath(); ctx.moveTo(1, y + 13); ctx.lineTo(-span, y - 7); ctx.moveTo(1, y + 13); ctx.lineTo(span * .9, y - 13); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-span - 9, y + 5);
    ctx.bezierCurveTo(-span + 1, y - 13, -span * .5, y - 19, -span * .18, y - 14);
    ctx.bezierCurveTo(3, y - 30, span * .3, y - 19, span * .45, y - 22);
    ctx.bezierCurveTo(span * .8, y - 33, span + 11, y - 8, span + 14, y - 2);
    ctx.lineTo(span * .5, y + 8); ctx.lineTo(-span * .4, y + 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#aac18730'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-span * .7, y + 1); ctx.quadraticCurveTo(-span * .2, y - 9, span * .5, y - 8); ctx.stroke();
    ctx.strokeStyle = '#483c2d'; ctx.lineWidth = 3;
  }
  ctx.restore();
}

export function drawPlatform(ctx: CanvasRenderingContext2D, p: Plat, pal: Pal, id: string) {
  if (p.type === 'crack') return drawCrack(ctx, p);
  if (p.type === 'ledge' || p.type === 'wall' || p.type === 'curb') return drawLedge(ctx, p, pal, id);
  const ice = p.type === 'ice' || (id === 'snow' && p.type === 'goal'), fragile = p.type === 'break';
  const top = ice ? '#e2edf0' : fragile ? '#c1a576' : pal.groundTop;
  ctx.save();
  if (fragile && p.broken) ctx.translate(Math.sin(Date.now() / 28) * 3, 0);
  ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
  const rock = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + Math.min(p.h, 350));
  rock.addColorStop(0, ice ? '#567e8b' : id === 'gorge' ? '#8b9a91' : '#67624b');
  rock.addColorStop(.35, ice ? '#305264' : id === 'gorge' ? '#596f65' : '#444938'); rock.addColorStop(1, pal.ground);
  ctx.fillStyle = rock; ctx.fillRect(p.x, p.y, p.w, p.h);
  for (let row = 0; row < Math.min(p.h, 720); row += 39) {
    const shift = Math.sin(p.x + row * 3) * 12;
    ctx.fillStyle = row % 78 === 0 ? '#d6c39b14' : '#071e241c';
    ctx.beginPath(); ctx.moveTo(p.x, p.y + row + 13); ctx.lineTo(p.x + p.w * .43, p.y + row + 6 + shift);
    ctx.lineTo(p.x + p.w, p.y + row - 3); ctx.lineTo(p.x + p.w, p.y + row + 17);
    ctx.lineTo(p.x + p.w * .3, p.y + row + 29); ctx.lineTo(p.x, p.y + row + 23); ctx.fill();
  }
  ctx.strokeStyle = '#0c242735'; ctx.lineWidth = 1.5;
  for (let col = 14; col < p.w; col += 61) {
    ctx.beginPath(); ctx.moveTo(p.x + col, p.y + 13); ctx.lineTo(p.x + col + 6, p.y + 36);
    ctx.lineTo(p.x + col - 5, p.y + 49); ctx.lineTo(p.x + col + 12, p.y + 82); ctx.stroke();
  }
  ctx.fillStyle = '#b9c5a025'; ctx.fillRect(p.x, p.y + 9, 4, p.h);
  ctx.fillStyle = '#071b2735'; ctx.fillRect(p.x + p.w - 7, p.y + 6, 7, p.h);
  ctx.fillStyle = top; ctx.fillRect(p.x, p.y, p.w, ice ? 7 : 5);
  ctx.fillStyle = '#ebdbae45'; ctx.fillRect(p.x, p.y, p.w, 1);
  ctx.restore();
  if (!ice && !fragile && (id !== 'gorge' || p.w >= 200)) {
    ctx.save(); ctx.strokeStyle = id === 'gorge' ? '#709375' : id === 'cedar' ? '#9eac72' : '#b1bc73'; ctx.lineWidth = 1;
    for (let i = 7; i < p.w - 5; i += 11) {
      const h = 3 + Math.sin(p.x + i * 7) * 2;
      ctx.beginPath(); ctx.moveTo(p.x + i - 2, p.y); ctx.lineTo(p.x + i - 4, p.y - h); ctx.moveTo(p.x + i, p.y); ctx.lineTo(p.x + i + 1, p.y - h - 2); ctx.stroke();
    }
    ctx.restore();
  }
  if (p.label) { ctx.fillStyle = '#f0dfb6'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center'; ctx.fillText(p.label, p.x + p.w / 2, p.y - 12); }
  if (p.type === 'goal') {
    ctx.strokeStyle = '#b9a579'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x + p.w / 2, p.y); ctx.lineTo(p.x + p.w / 2, p.y - 47); ctx.stroke();
    ctx.fillStyle = '#e0b86a'; ctx.fillRect(p.x + p.w / 2, p.y - 47, 18, 10);
  }
}

export function drawSheep(ctx: CanvasRenderingContext2D, s: Sheep, t: number) {
  // WorldState uses y = surface - 4. Hooves end at y + 4.
  if (s.state === 'gone') return;
  const fear = s.state === 'fear', alert = s.state === 'alert', calm = s.state === 'calming';
  const walk = s.state === 'rescued' ? Math.sin(t / 70) * 3 : fear ? Math.sin(t / 30) * 1.2 : 0;
  ctx.save(); ctx.globalAlpha = s.fade ?? 1; ctx.translate(Math.round(s.x + (fear ? Math.sin(t / 25) : 0)), Math.round(s.y)); if (s.faceR === false) ctx.scale(-1, 1);
  ctx.fillStyle = '#081a2340'; ctx.beginPath(); ctx.ellipse(0, 4, 16, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#443b30'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-9 + walk, 3); ctx.moveTo(5, -4); ctx.lineTo(5 - walk, 3); ctx.stroke();
  ctx.fillStyle = '#c7b99a'; ctx.beginPath(); ctx.ellipse(-1, -8, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2e8cd';
  for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 9, -12 + Math.sin(a) * 4, 6, 5, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#fff4d8'; ctx.beginPath(); ctx.ellipse(-3, -15, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  // Head height shows state: lowered while grazing, raised when alert or afraid.
  const headY = fear || alert ? -6 : calm ? -1 : Math.sin(s.bob * 0.7) > 0.6 ? 3 : 0;
  ctx.save(); ctx.translate(0, headY);
  ctx.fillStyle = '#514a38'; ctx.beginPath(); ctx.ellipse(13, -10, 5, 7, -.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, -16, 5, 2, fear ? -1.1 : -.45, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = fear ? '#f6f0e0' : '#141e1c'; ctx.beginPath(); ctx.arc(15, -12, fear ? 1.8 : 1, 0, Math.PI * 2); ctx.fill();
  if (fear) { ctx.fillStyle = '#141e1c'; ctx.beginPath(); ctx.arc(15.3, -12, 0.8, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle = '#ae8450'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, -5); ctx.lineTo(16, -5); ctx.stroke();
  ctx.fillStyle = '#e5bd68'; ctx.fillRect(10, -3, 3, 3); ctx.restore();
  ctx.save(); ctx.translate(Math.round(s.x), Math.round(s.y));
  if (calm) { ctx.strokeStyle = '#f2d58f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -36, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, (s.calm ?? 0) / 1.1)); ctx.stroke(); }
  if (fear) { ctx.fillStyle = '#ffdca0'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('!', 0, -32 + Math.sin(t / 90) * 2); }
  if (s.state === 'rescued') { ctx.globalAlpha = s.fade ?? 1; ctx.fillStyle = '#f5d889'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-14 + i * 14, -34 - ((t / 6 + i * 20) % 30), 2, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
}

/** Drawn clues and environmental storytelling. None of them carry collision. */
export function drawDecor(ctx: CanvasRenderingContext2D, d: Decor, t: number, state: { bellPulse?: number } = {}) {
  ctx.save();
  if (d.kind === 'tracks') {
    ctx.fillStyle = '#2a1d1290';
    for (let i = 0; i < (d.n ?? 4); i++) { const x = d.x + i * 26 * (d.dir ?? 1), y = d.y - 2; for (const o of [-3, 3]) { ctx.beginPath(); ctx.ellipse(x + o, y + (i % 2 ? 1 : 0), 2.2, 1.4, 0, 0, Math.PI * 2); ctx.fill(); } }
  } else if (d.kind === 'wool') {
    ctx.fillStyle = '#f2e8cd'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(d.x + i * 4 - 6, d.y - 2 - (i % 2) * 2, 3, 0, Math.PI * 2); ctx.fill(); }
  } else if (d.kind === 'scale') {
    // A balance: left pan load (large stones), right pan load (small stones). data = [left, rightSmall, rightSmall].
    const [left, ...right] = d.data ?? [2, 1, 1];
    ctx.strokeStyle = '#3e2d1c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x, d.y - 60); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(d.x - 40, d.y - 60); ctx.lineTo(d.x + 40, d.y - 60); ctx.stroke();
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d.x + side * 40, d.y - 60); ctx.lineTo(d.x + side * 40, d.y - 40); ctx.stroke(); ctx.fillStyle = '#7a5a36'; ctx.fillRect(d.x + side * 40 - 16, d.y - 40, 32, 4); }
    ctx.fillStyle = '#8a8478'; if (left) { ctx.beginPath(); ctx.ellipse(d.x - 40, d.y - 48, 11, 8, 0, 0, Math.PI * 2); ctx.fill(); }
    const smalls = right.reduce((a, b) => a + b, 0);
    for (let i = 0; i < smalls; i++) { ctx.beginPath(); ctx.ellipse(d.x + 33 + i * 14, d.y - 45, 6, 5, 0, 0, Math.PI * 2); ctx.fill(); }
    if (!smalls) { ctx.strokeStyle = '#e8d7a8'; ctx.lineWidth = 1.5; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(d.x + 33 + i * 14, d.y - 45, 6, 5, 0, 0, Math.PI * 2); ctx.stroke(); } }
  } else if (d.kind === 'tablet') {
    // Three bells in order. Size shows pitch; dots show order. No letters are involved.
    ctx.fillStyle = '#6d7b86'; ctx.fillRect(d.x - 22, d.y - 92, 64, 92); ctx.fillStyle = '#8e9ca6'; ctx.fillRect(d.x - 19, d.y - 89, 58, 86);
    (d.data ?? [0, 2, 1]).forEach((pitch, i) => {
      const size = [10, 6, 8][pitch === 0 ? 0 : pitch === 2 ? 1 : 2], cx = d.x - 6 + i * 18, cy = d.y - 60;
      const glow = state.bellPulse !== undefined && Math.floor(state.bellPulse) % 4 === i;
      ctx.fillStyle = glow ? '#ffe7a0' : '#2f3a42'; ctx.beginPath(); ctx.moveTo(cx - size, cy + size); ctx.quadraticCurveTo(cx, cy - size * 1.6, cx + size, cy + size); ctx.fill();
      ctx.fillStyle = '#2f3a42'; for (let k = 0; k <= i; k++) { ctx.beginPath(); ctx.arc(cx - i * 3 + k * 6, cy + 26, 2, 0, Math.PI * 2); ctx.fill(); }
    });
  } else if (d.kind === 'marks') {
    // Water level marks carved into the bank: high and low lines.
    const [high, low] = d.data ?? [d.y, d.y + 100];
    ctx.strokeStyle = '#eaf6ef'; ctx.lineWidth = 2;
    for (const [y, n] of [[high, 3], [low, 1]] as const) { ctx.beginPath(); ctx.moveTo(d.x - 8, y); ctx.lineTo(d.x + 8, y); ctx.stroke(); for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.moveTo(d.x - 6 + i * 6, y - 3); ctx.lineTo(d.x - 6 + i * 6, y - 9); ctx.stroke(); } }
  } else if (d.kind === 'shelterSign') {
    // A stacked cairn marks a shelter.
    ctx.fillStyle = '#9aa3a8'; [[0, 0, 16], [2, -9, 12], [3, -16, 8]].forEach(([dx, dy, w]) => { ctx.beginPath(); ctx.ellipse(d.x + dx, d.y - 4 + dy, w / 2, 4, 0, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#e8c27a'; ctx.beginPath(); ctx.moveTo(d.x + 3, d.y - 26); ctx.lineTo(d.x + 15, d.y - 22); ctx.lineTo(d.x + 3, d.y - 18); ctx.fill();
  } else if (d.kind === 'grass') {
    ctx.strokeStyle = '#a7b86888'; ctx.lineWidth = 1.2;
    const sway = Math.sin(t / 700) * 4 + 4;
    for (let i = 0; i < (d.n ?? 20); i++) { const x = d.x + i * 10.5; ctx.beginPath(); ctx.moveTo(x, d.y); ctx.quadraticCurveTo(x + sway * 0.5, d.y - 6, x + sway, d.y - 11 - (i % 3) * 3); ctx.stroke(); }
  } else if (d.kind === 'crackDemo') {
    ctx.fillStyle = '#e9f2f6'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center'; ctx.fillText('✓', d.x + 112, d.y - 30); ctx.fillText('✕', d.x + 178, d.y - 30);
  }
  ctx.restore();
}

/** Cracked ice: visible fracture lines, and a shaking plate once weight starts to break it. */
export function drawCrack(ctx: CanvasRenderingContext2D, p: Plat) {
  if (p.broken) { ctx.fillStyle = '#d7ecf41a'; ctx.fillRect(p.x, p.y, p.w, 3); return; }
  const shake = p.breakT !== undefined ? Math.sin(Date.now() / 18) * 2 : 0;
  ctx.save(); ctx.translate(shake, 0);
  ctx.fillStyle = '#9fc4d4'; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.fillStyle = '#d7ecf4'; ctx.fillRect(p.x, p.y, p.w, 3);
  ctx.strokeStyle = '#2a4d5e'; ctx.lineWidth = 1.5; ctx.beginPath();
  ctx.moveTo(p.x + p.w * 0.2, p.y); ctx.lineTo(p.x + p.w * 0.35, p.y + p.h * 0.6); ctx.lineTo(p.x + p.w * 0.5, p.y + p.h);
  ctx.moveTo(p.x + p.w * 0.35, p.y + p.h * 0.6); ctx.lineTo(p.x + p.w * 0.7, p.y + 2); ctx.moveTo(p.x + p.w * 0.6, p.y + p.h); ctx.lineTo(p.x + p.w * 0.8, p.y + p.h * 0.4); ctx.stroke();
  ctx.restore();
}

export function drawLedge(ctx: CanvasRenderingContext2D, p: Plat, pal: Pal, id: string) {
  if (p.type === 'wall') {
    // Overhead mass. Cedar walls are bough canopies, snow walls are icicle overhangs, others are rock.
    // The lower edge is drawn exactly on the collision edge so the player can read the clearance.
    const bottom = p.y + p.h, top = Math.max(p.y, bottom - 420);
    ctx.save(); ctx.beginPath(); ctx.rect(p.x - 30, top, p.w + 60, bottom - top); ctx.clip();
    if (id === 'cedar') {
      const fade = ctx.createLinearGradient(0, top, 0, bottom); fade.addColorStop(0, '#0f2a2000'); fade.addColorStop(0.35, '#163829cc'); fade.addColorStop(1, '#1d4632');
      ctx.fillStyle = fade; ctx.fillRect(p.x, top, p.w, bottom - top);
      for (let row = 0; row < 6; row++) {
        const y = bottom - 14 - row * 34;
        ctx.fillStyle = row === 0 ? '#2f6447' : row % 2 ? '#24533b' : '#1d4632';
        for (let x = p.x - 10 + (row % 2) * 16; x < p.x + p.w + 10; x += 32) { ctx.beginPath(); ctx.ellipse(x + 16, y, 22, 12, 0, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.strokeStyle = '#7fa66b'; ctx.lineWidth = 1.5;
      for (let x = p.x + 8; x < p.x + p.w - 8; x += 26) { ctx.beginPath(); ctx.moveTo(x, bottom - 3); ctx.quadraticCurveTo(x + 8, bottom - 9, x + 18, bottom - 3); ctx.stroke(); }
      ctx.fillStyle = '#4a3a28'; ctx.fillRect(p.x + p.w * 0.15, top, 6, bottom - top - 24); ctx.fillRect(p.x + p.w * 0.7, top, 5, bottom - top - 30);
    } else if (id === 'snow') {
      const g = ctx.createLinearGradient(0, top, 0, bottom); g.addColorStop(0, '#2e4f6200'); g.addColorStop(0.4, '#4c6f84cc'); g.addColorStop(1, '#7fa3b6');
      ctx.fillStyle = g; ctx.fillRect(p.x, top, p.w, bottom - top);
      ctx.fillStyle = '#e2f0f6'; ctx.fillRect(p.x, bottom - 6, p.w, 6);
      for (let x = p.x + 4; x < p.x + p.w - 4; x += 9) { ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x + 3, bottom + 8 + (x % 3) * 3); ctx.lineTo(x + 6, bottom); ctx.fill(); }
    } else {
      const g = ctx.createLinearGradient(0, top, 0, bottom); g.addColorStop(0, '#3c4a4a00'); g.addColorStop(0.4, '#3c4a4acc'); g.addColorStop(1, '#5d6d6b');
      ctx.fillStyle = g; ctx.fillRect(p.x, top, p.w, bottom - top); ctx.fillStyle = '#7b8b88'; ctx.fillRect(p.x, bottom - 5, p.w, 5);
    }
    ctx.restore(); return;
  }
  ctx.fillStyle = id === 'snow' ? '#4c6f84' : '#5b5644'; ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = id === 'snow' ? '#e2edf0' : pal.groundTop; ctx.fillRect(p.x, p.y, p.w, 4);
  ctx.fillStyle = '#00000030'; ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
}

export function drawSluice(ctx: CanvasRenderingContext2D, s: Sluice, t: number) {
  ctx.save(); ctx.translate(s.x, s.y);
  ctx.fillStyle = '#4b3a28'; ctx.fillRect(-26, -54, 6, 54); ctx.fillRect(20, -54, 6, 54); ctx.fillRect(-26, -58, 52, 6);
  ctx.fillStyle = '#866343'; ctx.fillRect(-20, s.toB ? -50 : -24, 40, 22);
  ctx.strokeStyle = '#d4a857'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -62); ctx.lineTo(s.toB ? 16 : -16, -82); ctx.stroke();
  // Arrow shows which basin receives the water now.
  ctx.fillStyle = '#c8eee5'; const dir = s.toB ? 1 : -0.4, ax = 34 + Math.sin(t / 200) * 3;
  ctx.beginPath(); ctx.moveTo(ax * Math.sign(dir), -20); ctx.lineTo(ax * Math.sign(dir) - 8 * Math.sign(dir), -26); ctx.lineTo(ax * Math.sign(dir) - 8 * Math.sign(dir), -14); ctx.fill();
  ctx.restore();
}

export function drawFloater(ctx: CanvasRenderingContext2D, f: Floater) {
  ctx.fillStyle = '#5a3c22'; ctx.beginPath(); ctx.roundRect(f.x, f.y, f.w, f.h, 7); ctx.fill();
  ctx.strokeStyle = '#8a6440'; ctx.lineWidth = 1.5; for (let x = f.x + 20; x < f.x + f.w - 10; x += 46) { ctx.beginPath(); ctx.moveTo(x, f.y + 3); ctx.lineTo(x + 30, f.y + 4); ctx.stroke(); }
  ctx.fillStyle = '#a07a52'; ctx.beginPath(); ctx.ellipse(f.x + f.w, f.y + f.h / 2, 4, f.h / 2, 0, 0, Math.PI * 2); ctx.fill();
}

export function drawBell(ctx: CanvasRenderingContext2D, l: Lever, ring: number) {
  const size = [12, 9, 7][l.bell === 0 ? 0 : l.bell === 1 ? 1 : 2], swing = Math.sin(ring * 18) * ring * 0.5;
  ctx.save(); ctx.strokeStyle = '#4b3a28'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(l.x - 14, l.y); ctx.lineTo(l.x - 14, l.y - 64); ctx.lineTo(l.x + 14, l.y - 64); ctx.lineTo(l.x + 14, l.y); ctx.stroke();
  ctx.translate(l.x, l.y - 62); ctx.rotate(swing);
  ctx.fillStyle = l.on ? '#f2d27a' : '#b58d43'; ctx.beginPath(); ctx.moveTo(-size, size * 2.4); ctx.quadraticCurveTo(-size * 0.9, 4, 0, 4); ctx.quadraticCurveTo(size * 0.9, 4, size, size * 2.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a4020'; ctx.beginPath(); ctx.arc(0, size * 2.5, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (ring > 0) { ctx.strokeStyle = `rgba(255,231,160,${ring})`; ctx.lineWidth = 2; for (let i = 1; i <= 2; i++) { ctx.beginPath(); ctx.arc(l.x, l.y - 45, size + i * 8 * (1.2 - ring), -Math.PI * 0.8, -Math.PI * 0.2); ctx.stroke(); } }
}

/** Weight plate. A scale shows one empty socket per required stone. */
export function drawPlate(ctx: CanvasRenderingContext2D, pl: Plate) {
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(pl.x, pl.y, pl.w, 8);
  ctx.fillStyle = pl.pressed ? '#86c48f' : '#8a6a3a'; ctx.fillRect(pl.x + 2, pl.y + (pl.pressed ? 4 : 1), pl.w - 4, pl.pressed ? 4 : 7);
  if (pl.need !== undefined && !pl.solved) {
    for (let i = 0; i < pl.need; i++) { const filled = (pl.weight ?? 0) > i; ctx.fillStyle = filled ? '#f2d27a' : 'transparent'; ctx.strokeStyle = '#f2e6c8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.x + pl.w / 2 - (pl.need - 1) * 8 + i * 16, pl.y - 18, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
}

/** Shadow on the ground under a hostile animal, plus readable state marks over its head. */
export function drawAnimalCue(ctx: CanvasRenderingContext2D, e: Enemy, groundY: number, t: number) {
  if (e.state === 'dead') return;
  if (e.type === 'eagle' && (e.state === 'warn' || e.state === 'attack')) {
    const x = e.state === 'warn' ? (e.diveX ?? e.x) + e.w / 2 : e.x + e.w / 2, k = e.state === 'warn' ? Math.min(1, (e.stateT ?? 0) / 1.15) : 1;
    ctx.fillStyle = `rgba(10,20,25,${0.18 + 0.3 * k})`; ctx.beginPath(); ctx.ellipse(x, groundY - 2, 18 + 26 * (1 - k), 5, 0, 0, Math.PI * 2); ctx.fill();
  }
  const mark = e.state === 'notice' ? '?' : e.state === 'warn' ? '!' : e.state === 'distract' ? '…' : '';
  if (mark) { ctx.fillStyle = e.state === 'warn' ? '#ffb38a' : '#f5e6c8'; ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center'; ctx.fillText(mark, e.x + e.w / 2, e.y - 10 + Math.sin(t / 100) * 2); }
}

export function drawShelterHint(ctx: CanvasRenderingContext2D, s: Shelter, t: number, urgent: boolean) {
  if (!urgent) return;
  ctx.strokeStyle = `rgba(255,226,160,${0.35 + Math.sin(t / 140) * 0.25})`; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
  ctx.strokeRect(s.x + 4, s.y + 4, s.w - 8, s.h - 8); ctx.setLineDash([]);
}
