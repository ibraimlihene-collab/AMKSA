import type { Pal, Plat, Sheep } from './types';

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
  const ice = p.type === 'ice', fragile = p.type === 'break';
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

export function drawSheep(ctx: CanvasRenderingContext2D, s: Sheep) {
  // WorldState uses y = surface - 4. Hooves end at y + 4.
  ctx.save(); ctx.translate(Math.round(s.x), Math.round(s.y));
  ctx.fillStyle = '#081a2340'; ctx.beginPath(); ctx.ellipse(0, 4, 16, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#443b30'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-9, 3); ctx.moveTo(5, -4); ctx.lineTo(5, 3); ctx.stroke();
  ctx.fillStyle = '#c7b99a'; ctx.beginPath(); ctx.ellipse(-1, -8, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2e8cd';
  for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 9, -12 + Math.sin(a) * 4, 6, 5, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#fff4d8'; ctx.beginPath(); ctx.ellipse(-3, -15, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#514a38'; ctx.beginPath(); ctx.ellipse(13, -10, 5, 7, -.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, -16, 5, 2, -.45, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#141e1c'; ctx.beginPath(); ctx.arc(15, -12, 1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ae8450'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, -5); ctx.lineTo(16, -5); ctx.stroke();
  ctx.fillStyle = '#e5bd68'; ctx.fillRect(10, -3, 3, 3); ctx.restore();
}
