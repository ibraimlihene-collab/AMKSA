/** Prologue and ending scenes. They reuse the gameplay painters, so the fold, flock and shepherd match the journey. */
import { drawSky, drawMountains, cedar, drawSheep } from './art';
import type { Pal, Sheep } from './types';

const W = 1024, H = 576, GY = 470;
const DAWN: Pal = { skyTop: '#3b5a63', skyBot: '#e2c58f', far: '#56756f', mid: '#6e8a74', near: '#3c6a4f', ground: '#2b3b2a', groundTop: '#8aa165', accent: '#e0b86a', fog: '#d8d4b0', particle: '#e8dcc0' };
const NIGHT: Pal = { skyTop: '#0b1620', skyBot: '#2b3c48', far: '#1b2a30', mid: '#24363a', near: '#1b2e26', ground: '#141d18', groundTop: '#3b4a34', accent: '#b9a46a', fog: '#6c7f86', particle: '#9fb3be' };

const flockSheep = (x: number, i: number, t: number, state: Sheep['state'] = 'idle', faceR = true): Sheep => ({ id: `f${i}`, x, y: GY - 4, vx: 0, vy: 0, rescued: false, bob: t / 1000 + i, state, faceR, fade: 1 });

function ground(ctx: CanvasRenderingContext2D, pal: Pal) {
  ctx.fillStyle = pal.ground; ctx.fillRect(0, GY, W, H - GY); ctx.fillStyle = pal.groundTop; ctx.fillRect(0, GY, W, 5);
}
/** Dry-stone fold with a wooden gate and the bell post. */
function fold(ctx: CanvasRenderingContext2D, x: number, gate: number, bell: 'post' | 'swing' | 'none', t: number) {
  ctx.fillStyle = '#7b7465';
  for (let row = 0; row < 4; row++) for (let i = 0; i < 16; i++) { const bx = x + i * 22 + (row % 2) * 11, by = GY - 18 - row * 15; if (bx > x + 330) continue; ctx.beginPath(); ctx.ellipse(bx, by, 11, 7, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#5c5548'; ctx.fillRect(x + 340, GY - 70, 8, 70);
  // Gate: 0 closed, 1 fully open.
  ctx.save(); ctx.translate(x + 344, GY - 66); ctx.scale(Math.cos(gate * Math.PI / 2.3), 1);
  ctx.fillStyle = '#7a5434'; for (let i = 0; i < 4; i++) ctx.fillRect(0, 6 + i * 15, 70, 6); ctx.fillRect(4, 0, 6, 66); ctx.fillRect(62, 0, 6, 66); ctx.restore();
  ctx.fillStyle = '#5a4630'; ctx.fillRect(x + 430, GY - 120, 6, 120); ctx.fillRect(x + 430, GY - 120, 30, 5);
  if (bell !== 'none') {
    const swing = bell === 'swing' ? Math.sin(t / 220) * 0.4 : Math.sin(t / 900) * 0.05;
    ctx.save(); ctx.translate(x + 456, GY - 115); ctx.rotate(swing); ctx.fillStyle = '#c99a48'; ctx.beginPath(); ctx.moveTo(-9, 22); ctx.quadraticCurveTo(-8, 3, 0, 3); ctx.quadraticCurveTo(8, 3, 9, 22); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // Water bowl, rope and staff by the wall.
  ctx.fillStyle = '#6b4d32'; ctx.beginPath(); ctx.ellipse(x + 380, GY - 4, 16, 6, 0, 0, Math.PI); ctx.fill(); ctx.fillStyle = '#9fd1d6'; ctx.fillRect(x + 367, GY - 7, 26, 2);
  ctx.strokeStyle = '#b7924f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x + 410, GY - 8, 10, 5, 0, 0, Math.PI * 2); ctx.stroke();
}
function shepherd(ctx: CanvasRenderingContext2D, x: number, t: number, walking: boolean, bell = false) {
  const step = walking ? Math.sin(t / 110) * 7 : 0;
  ctx.save(); ctx.translate(x, GY);
  ctx.strokeStyle = '#3a2616'; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(step, -2); ctx.moveTo(0, -13); ctx.lineTo(-step, -2); ctx.stroke();
  ctx.fillStyle = '#718477'; ctx.beginPath(); ctx.moveTo(-12, -34); ctx.lineTo(12, -34); ctx.lineTo(16, -2); ctx.lineTo(-16, -2); ctx.fill();
  ctx.fillStyle = '#ead8ac'; ctx.beginPath(); ctx.moveTo(-11, -34); ctx.lineTo(11, -34); ctx.lineTo(14, -4); ctx.lineTo(-14, -4); ctx.fill();
  ctx.fillStyle = '#d6c394'; ctx.beginPath(); ctx.arc(0, -37, 12, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#c8946a'; ctx.beginPath(); ctx.arc(1, -38, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#48776b'; ctx.beginPath(); ctx.moveTo(-12, -33); ctx.lineTo(9, -29); ctx.lineTo(11, -23); ctx.lineTo(-13, -28); ctx.fill();
  ctx.strokeStyle = '#9a7a44'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(17, -40); ctx.lineTo(18, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(20, -41, 3, Math.PI * 0.3, Math.PI * 1.4); ctx.stroke();
  if (bell) { ctx.fillStyle = '#c99a48'; ctx.beginPath(); ctx.moveTo(-17, -10); ctx.quadraticCurveTo(-16, -20, -12, -20); ctx.quadraticCurveTo(-8, -20, -7, -10); ctx.fill(); }
  ctx.restore();
}

/** Four prologue beats: the quiet fold, the storm, the empty fold at dawn, the shepherd sets out. */
export function drawPrologue(ctx: CanvasRenderingContext2D, beat: number, t: number, still: boolean) {
  const pal = beat === 1 ? NIGHT : DAWN, tt = still ? 0 : t;
  ctx.clearRect(0, 0, W, H); drawSky(ctx, 0, pal, 'cedar'); drawMountains(ctx, 0, pal);
  [80, 820, 930].forEach((x, i) => cedar(ctx, x, GY, 190 + i * 20, pal.near));
  ground(ctx, pal);
  const fx = 260;
  if (beat === 0) { fold(ctx, fx, 0, 'post', tt); for (let i = 0; i < 6; i++) drawSheep(ctx, flockSheep(fx + 40 + i * 48, i, tt, 'idle', i % 2 === 0), tt); }
  if (beat === 1) {
    fold(ctx, fx, 0.5 + Math.sin(tt / 160) * 0.4, 'swing', tt);
    for (let i = 0; i < 6; i++) drawSheep(ctx, flockSheep(fx + 380 + i * 70 + (tt / 4) % 120, i, tt, 'fear', true), tt);
    ctx.strokeStyle = '#a9bdc988'; ctx.lineWidth = 1; for (let i = 0; i < 90; i++) { const x = (i * 97 + tt * 0.9) % W, y = (i * 53 + tt * 1.4) % H; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 18); ctx.stroke(); }
    if (!still && Math.sin(tt / 900) > 0.97) { ctx.fillStyle = '#e8f1ff55'; ctx.fillRect(0, 0, W, H); }
  }
  if (beat === 2) {
    fold(ctx, fx, 1, 'swing', tt);
    ctx.fillStyle = '#2a1d12a0'; for (let i = 0; i < 12; i++) for (const o of [-3, 3]) { ctx.beginPath(); ctx.ellipse(fx + 430 + i * 30 + o, GY - 2 + (i % 2), 2.2, 1.4, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  if (beat === 3) { fold(ctx, fx, 1, 'none', tt); shepherd(ctx, 560 + (still ? 0 : (tt / 20) % 300), tt, !still, true); ctx.fillStyle = '#2a1d12a0'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.ellipse(700 + i * 34, GY - 2, 2.2, 1.4, 0, 0, Math.PI * 2); ctx.fill(); } }
  const v = ctx.createLinearGradient(0, 0, 0, H); v.addColorStop(0.55, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,16,14,0.65)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

/** Return to the fold. The flock that walks in is exactly the set of rescued sheep. */
export function drawEnding(ctx: CanvasRenderingContext2D, rescued: number, total: number, t: number, still: boolean) {
  const pal = DAWN, tt = still ? 99999 : t;
  ctx.clearRect(0, 0, W, H); drawSky(ctx, 0, pal, 'cedar'); drawMountains(ctx, 0, pal);
  [60, 860, 960].forEach((x, i) => cedar(ctx, x, GY, 200 + i * 15, pal.near)); ground(ctx, pal);
  const fx = 300, all = rescued >= total && total > 0, arrive = Math.min(1, tt / 7000);
  fold(ctx, fx, all && arrive >= 1 ? Math.max(0, 1 - (tt - 7000) / 1500) : 1, all && arrive >= 1 ? 'post' : 'none', tt);
  // Empty places for sheep that did not come home.
  ctx.strokeStyle = '#f2e6c866'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5;
  for (let i = rescued; i < total; i++) { ctx.beginPath(); ctx.ellipse(fx + 30 + i * 38, GY - 10, 15, 9, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.setLineDash([]);
  const leader = -80 + arrive * (fx + 470);
  for (let i = 0; i < rescued; i++) {
    const target = fx + 30 + i * 38, x = arrive < 1 ? Math.min(target, leader - 50 - i * 34) : target;
    drawSheep(ctx, flockSheep(x, i, tt, arrive < 1 ? 'rescued' : 'idle', true), tt);
  }
  shepherd(ctx, Math.min(fx + 470, leader), tt, arrive < 1, !all || arrive < 1);
  if (all && arrive >= 1) { ctx.fillStyle = `rgba(255,226,150,${Math.min(0.25, (tt - 7000) / 8000)})`; ctx.fillRect(0, 0, W, H); }
}
