import React, { useEffect, useRef, useState } from 'react';
import type { Player, Rock, Box, Hanging, PType, Plat, MP, Lever, Door, Plate, Bridge, Elevator, Coin, Check, Portal, Sheep, EType, Enemy, Proj, Part, Haz, Threat, Pal, WD } from './game/types';
import { A } from './game/audio';
import { drawSky, drawMountains, cedar, drawPlatform, drawSheep } from './game/art';
import { PUZZLES, WORLDS, MOODS, type LogicPuzzle } from './game/content';
import { FixedClock, bridgeSolid, strikeEnemy, activate, award, clearLine, damageEnemy, downwardContact, ending, launch, movePlatform, projectileStep, trajectory } from './game/rules';
import { createPlayer, createWorld, resetResources, snapshot, type Session } from './game/world';
import { text } from './game/i18n';
import { Settings, PuzzlePanel } from './game/ui';
import { canonicalCode, defaultBindings, type Action, type Bindings } from './game/input';
import { browserStorage, emptySave, eraseSave, loadSave, writeSave, parseSave, type Save } from './game/save';


// ============================================================
//  ⴰⵎⴽⵙⴰ — AMKSA  (The Shepherd)  — v3 redesign
//  A Limbo-style atmospheric puzzle-platformer set in the
//  Middle Atlas (Béni Mellal – Khénifra), Morocco.
// ============================================================

// ---- Physics ----
const GRAVITY = 2100;
const FALL_MUL = 2.0;
const LOWJ_MUL = 2.0;
const JUMP = 760;
const MAXSPD = 300;
const ACC = 1500;
const FRIC_G = 1100;
const FRIC_A = 360;
const DASH_SPD = 700;
const DASH_T = 0.15;
const DASH_CD = 0.4;

// Throw
const ROCK_BOUNCE = 0.34;
const ROCK_FRIC = 240;
const T_MIN = 480, T_MAX = 1280;
const CHARGE_SPD = 1.7;

// Punch (when out of rocks)
const PUNCH_RANGE = 56;
const PUNCH_DMG = 1;
const PUNCH_CD = 0.45;
const PUNCH_KNOCK = 260;

const W = 1024, H = 576, MAXHP = 3, GY = 470;

// ============================================================
//  Audio
// ============================================================
type Mood = 'menu' | 'cedar' | 'pasture' | 'gorge' | 'snow';
// ============================================================
//  Logic Puzzles — real deduction, not just pressing buttons
// ============================================================
// ---- helpers ----
const pR = (p: Player) => ({ x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h });
const hit = (a: any, b: any) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
// ============================================================
//  RENDER — atmospheric, hand-drawn feel, multi-layered
// ============================================================
// find the top surface y at a given world x among platforms (for anchoring trees to ground)
const topAt = (plats: Plat[], x: number, width = 0): number | null => {
  let best: number | null = null;
  for (const p of plats) { if (p.type === 'break' && p.broken) continue; if (x - width / 2 >= p.x && x + width / 2 <= p.x + p.w) { if (best === null || p.y < best) best = p.y; } }
  return best;
};
function drawFog(ctx: CanvasRenderingContext2D, cx: number, cy: number, pal: Pal, level: number) {
  if (level <= 0) return;
  ctx.fillStyle = pal.fog; ctx.globalAlpha = 0.12 * level;
  for (let i = 0; i < 5; i++) { const x = (cx * 0.4 + i * 260) % (W + 260) - 130; const y = H - 60 - i * 18 + Math.sin(Date.now() / 2000 + i) * 10; ctx.beginPath(); ctx.ellipse(x, y - cy * 0.3, 160, 30, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function drawHazard(ctx: CanvasRenderingContext2D, h: Haz, t: number) {
  if (h.type === 'water') {
    // Atlas river water — deep teal with depth gradient, layered waves, foam, reflections
    const x = h.x, y = h.y, wW = h.w, hH = h.h;
    // depth gradient: lighter teal at top, darker deep below
    const g = ctx.createLinearGradient(0, y, 0, y + hH);
    g.addColorStop(0, '#1f6f78'); g.addColorStop(0.4, '#16565e'); g.addColorStop(1, '#0c353c');
    ctx.fillStyle = g; ctx.fillRect(x, y, wW, hH);
    // back wave layer (slower, darker)
    ctx.fillStyle = 'rgba(26,90,98,0.22)';
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 0; i <= wW; i += 6) { ctx.lineTo(x + i, y + Math.sin(t / 160 + i * 0.05) * 3 - 2); }
    ctx.lineTo(x + wW, y + hH); ctx.lineTo(x, y + hH); ctx.closePath(); ctx.fill();
    // front wave layer (faster, lighter teal)
    ctx.fillStyle = 'rgba(42,128,136,0.22)';
    ctx.beginPath(); ctx.moveTo(x, y + 3);
    for (let i = 0; i <= wW; i += 6) { ctx.lineTo(x + i, y + 3 + Math.sin(t / 110 + i * 0.08) * 3); }
    ctx.lineTo(x + wW, y + hH); ctx.lineTo(x, y + hH); ctx.closePath(); ctx.fill();
    // surface highlight line (shimmering)
    ctx.strokeStyle = 'rgba(180,240,235,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= wW; i += 4) { const yy = y + 2 + Math.sin(t / 110 + i * 0.08) * 3; if (i === 0) ctx.moveTo(x + i, yy); else ctx.lineTo(x + i, yy); }
    ctx.stroke();
    // foam band at the very top edge
    ctx.fillStyle = 'rgba(220,250,245,0.7)';
    for (let i = 0; i <= wW; i += 14) { const yy = y - 1 + Math.sin(t / 110 + i * 0.08) * 3; ctx.fillRect(x + i + (Math.sin(t / 300 + i) * 3), yy, 6, 2); }
    // moving reflection streaks
    ctx.strokeStyle = 'rgba(200,245,240,0.18)'; ctx.lineWidth = 1;
    for (let r = 0; r < 4; r++) { const ry = y + 10 + r * 9; const off = Math.sin(t / 600 + r) * 14; ctx.beginPath(); ctx.ellipse(x + wW / 2 + off, ry, wW * 0.3, 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    // sparkle dots
    ctx.fillStyle = 'rgba(220,250,245,0.6)';
    for (let i = 0; i < 5; i++) { const sx = x + ((t / 30 + i * 37) % wW); const sy = y + 6 + Math.sin(t / 200 + i) * 3; ctx.fillRect(sx, sy, 2, 1); }
  } else {
    ctx.fillStyle = h.type === 'ice' ? '#bce0ee' : '#b8c0c8';
    const n = Math.floor(h.w / 16);
    for (let i = 0; i < n; i++) { const sx = h.x + i * 16; ctx.beginPath(); ctx.moveTo(sx, h.y + h.h); ctx.lineTo(sx + 8, h.y); ctx.lineTo(sx + 16, h.y + h.h); ctx.fill(); }
    ctx.fillStyle = '#5a6068'; ctx.fillRect(h.x, h.y + h.h - 6, h.w, 6);
  }
}
function drawPortal(ctx: CanvasRenderingContext2D, p: Portal, t: number, pal: Pal, open: boolean) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  if (!open) { ctx.fillStyle = 'rgba(60,40,30,0.6)'; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.fillStyle = '#8a6a4a'; ctx.fillRect(p.x + 4, p.y, 4, p.h); ctx.fillRect(p.x + p.w - 8, p.y, 4, p.h); }
  else {
    for (let i = 0; i < 4; i++) { const r = 14 + i * 11 + Math.sin(t / 280 + i) * 3; ctx.strokeStyle = pal.accent; ctx.globalAlpha = 0.5 - i * 0.1; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy, r, p.h / 2 + i * 5, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1; const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, p.w); g.addColorStop(0, 'rgba(255,240,200,0.85)'); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, p.w / 2, p.h / 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = pal.accent; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ⴰⵎⴽⵙⴰ', cx, p.y - 8);
}
function drawLever(ctx: CanvasRenderingContext2D, l: Lever) {
  if (l.target) {
    // unmistakable distant target: bright concentric disc connected to a hanging pin
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(l.x, l.y - 58); ctx.lineTo(l.x, l.y - 34); ctx.stroke();
    ctx.fillStyle = l.on ? '#34d399' : '#d4a857'; ctx.beginPath(); ctx.arc(l.x, l.y - 22, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2414'; ctx.beginPath(); ctx.arc(l.x, l.y - 22, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = l.on ? '#34d399' : '#f5d889'; ctx.beginPath(); ctx.arc(l.x, l.y - 22, 3, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(l.x - 3, l.y - 30, 6, 30);
  ctx.strokeStyle = l.on ? pal_accent : '#8a7a5a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(l.x, l.y - 26); ctx.lineTo(l.x + (l.on ? 14 : -14), l.y - 36); ctx.stroke();
  ctx.fillStyle = l.on ? pal_accent : '#6a5a3a'; ctx.beginPath(); ctx.arc(l.x + (l.on ? 14 : -14), l.y - 36, 5, 0, Math.PI * 2); ctx.fill();
  if (l.seq !== undefined) { ctx.fillStyle = '#f5e6c8'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(l.seq), l.x, l.y - 47); }
  if (l.puzzleId !== undefined && !l.solved) { ctx.fillStyle = '#8ac0e0'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🧩', l.x, l.y - 54); }
}
const pal_accent = '#d4a857';
function drawPlate(ctx: CanvasRenderingContext2D, pl: Plate) {
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(pl.x, pl.y, pl.w, 8);
  ctx.fillStyle = pl.pressed ? '#34d399' : '#8a6a3a'; ctx.fillRect(pl.x + 2, pl.y + (pl.pressed ? 4 : 1), pl.w - 4, pl.pressed ? 4 : 7);
  if (!pl.solved) { ctx.fillStyle = '#f5e6c8'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▼ ⚖', pl.x + pl.w / 2, pl.y - 7); }
}
function drawBridge(ctx: CanvasRenderingContext2D, b: Bridge) {
  ctx.save();
  ctx.translate(b.x, b.y + b.h / 2);
  ctx.rotate(-Math.PI / 2 * (1 - b.progress));
  // rope rails
  ctx.strokeStyle = '#3b2517'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(b.w, -7); ctx.moveTo(0, 7); ctx.lineTo(b.w, 7); ctx.stroke();
  // planks
  ctx.fillStyle = '#795330';
  for (let x = 0; x < b.w; x += 15) { ctx.fillRect(x, -b.h / 2, 13, b.h); ctx.fillStyle = '#9a7042'; ctx.fillRect(x + 2, -b.h / 2 + 2, 9, 2); ctx.fillStyle = '#795330'; }
  // hinge
  ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawDoor(ctx: CanvasRenderingContext2D, d: Door, glyph = '') {
  if (d.open || d.w === 0) return;
  const g = ctx.createLinearGradient(d.x, 0, d.x + d.w, 0); g.addColorStop(0, '#342014'); g.addColorStop(0.5, '#765238'); g.addColorStop(1, '#342014');
  ctx.fillStyle = g; ctx.fillRect(d.x, d.y, d.w, d.h);
  ctx.strokeStyle = '#b89058'; ctx.lineWidth = 2;
  for (let y = d.y + 14; y < d.y + d.h; y += 28) { ctx.beginPath(); ctx.moveTo(d.x + 3, y); ctx.lineTo(d.x + d.w - 3, y); ctx.stroke(); }
  ctx.fillStyle = '#b89058'; ctx.fillRect(d.x + d.w / 2 - 2, d.y, 4, d.h);
  ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(d.x + d.w - 6, d.y + d.h / 2, 3, 0, Math.PI * 2); ctx.fill();
  if (glyph) { ctx.fillStyle = '#f5e6c8'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(glyph, d.x + d.w / 2, d.y + 24); }
}
function drawCheck(ctx: CanvasRenderingContext2D, c: Check) {
  // akomas: stacked stones
  ctx.fillStyle = c.on ? '#c8a45c' : '#6a6a6a';
  ctx.fillRect(c.x - 2, c.y - 34, 4, 34);
  [[-9, -8, 18], [-7, -20, 14], [-5, -30, 9]].forEach(([dx, dy, s]) => { ctx.fillStyle = c.on ? '#b8924c' : '#5a5a5a'; ctx.fillRect(c.x + dx, c.y + dy, s, 9); });
  if (c.on) { ctx.fillStyle = 'rgba(200,164,92,0.22)'; ctx.beginPath(); ctx.arc(c.x, c.y - 34, 13 + Math.sin(Date.now() / 300) * 3, 0, Math.PI * 2); ctx.fill(); }
}
// ===== Animals — detailed, realistic silhouettes, clearly visible =====
function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  ctx.save(); ctx.translate(Math.round(e.x + e.w / 2), Math.round(e.y + e.h / 2));
  if (!e.faceR) ctx.scale(-1, 1);
  if (e.state === 'dead') { ctx.globalAlpha = Math.max(0, e.deadT / 1.2); ctx.rotate(Math.PI); }
  const hurt = e.dmgT > 0;
  const ls = (e.state === 'walk') ? Math.sin(Date.now() / 90) * 6 : 0;

  // WOLF — long-bodied, visible, realistic
  if (e.type === 'wolf') {
    const base = hurt ? '#ef4444' : '#3e382e';
    ctx.fillStyle = base;
    // body (elongated)
    ctx.beginPath(); ctx.ellipse(0, -2, e.w / 2, e.h / 2 - 2, 0, 0, Math.PI * 2); ctx.fill();
    // chest highlight
    ctx.fillStyle = hurt ? '#ef4444' : '#52483a'; ctx.beginPath(); ctx.ellipse(-4, 2, e.w / 2 - 8, e.h / 2 - 6, 0, 0, Math.PI * 2); ctx.fill();
    // legs
    ctx.fillStyle = base; ctx.fillRect(-e.w / 2 + 6 + ls, e.h / 2 - 4, 6, 10); ctx.fillRect(-e.w / 2 + 16 - ls, e.h / 2 - 4, 6, 10); ctx.fillRect(e.w / 2 - 18 + ls, e.h / 2 - 4, 6, 10); ctx.fillRect(e.w / 2 - 8 - ls, e.h / 2 - 4, 6, 10);
    // tail (bushy, down)
    ctx.fillStyle = base; ctx.save(); ctx.translate(-e.w / 2, -4); ctx.rotate(-0.5); ctx.beginPath(); ctx.ellipse(-8, 0, 12, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = hurt ? '#ef4444' : '#2a241c'; ctx.beginPath(); ctx.ellipse(-16, 2, 5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (e.state !== 'dead') {
      // head (snout forward)
      ctx.fillStyle = base; ctx.save(); ctx.translate(e.w / 2 - 4, -e.h / 2 + 6); ctx.beginPath(); ctx.ellipse(8, 4, 14, 11, -0.1, 0, Math.PI * 2); ctx.fill();
      // snout
      ctx.beginPath(); ctx.ellipse(18, 8, 8, 5, 0.1, 0, Math.PI * 2); ctx.fill();
      // ears (pointed, alert)
      ctx.fillStyle = hurt ? '#ef4444' : '#2a241c'; ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(0, -14); ctx.lineTo(4, -6); ctx.fill(); ctx.beginPath(); ctx.moveTo(8, -7); ctx.lineTo(11, -15); ctx.lineTo(13, -6); ctx.fill();
      // eyes (glowing amber — visible)
      ctx.fillStyle = e.state === 'attack' ? '#ff5050' : '#f0c050'; ctx.fillRect(4, 2, 3, 3); ctx.fillRect(12, 3, 3, 3);
      // nose
      ctx.fillStyle = '#1a0e08'; ctx.beginPath(); ctx.arc(24, 8, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  // MACAQUE (Barbary macaque) — compact, tailless, expressive
  else if (e.type === 'macaque') {
    const base = hurt ? '#ef4444' : '#5a4030';
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    // lighter face area
    ctx.fillStyle = hurt ? '#ef4444' : '#7a5a40'; ctx.beginPath(); ctx.arc(e.w / 2 - 6, -e.h / 2 + 8, 10, 0, Math.PI * 2); ctx.fill();
    // limbs
    ctx.fillStyle = base; ctx.fillRect(-e.w / 2 - 2, -4 + ls, 7, 12); ctx.fillRect(e.w / 2 - 4, -4 - ls, 7, 12); ctx.fillRect(-e.w / 2 + 4, e.h / 2 - 2, 6, 8 + ls); ctx.fillRect(e.w / 2 - 10, e.h / 2 - 2, 6, 8 - ls);
    // face (pinkish)
    ctx.fillStyle = hurt ? '#ef4444' : '#c8a888'; ctx.beginPath(); ctx.arc(e.w / 2 - 6, -e.h / 2 + 8, 6, 0, Math.PI * 2); ctx.fill();
    // ears
    ctx.fillStyle = base; ctx.beginPath(); ctx.arc(e.w / 2 - 14, -e.h / 2 + 6, 4, 0, Math.PI * 2); ctx.fill();
    // eyes
    ctx.fillStyle = '#1a1008'; ctx.fillRect(e.w / 2 - 8, -e.h / 2 + 6, 2, 2); ctx.fillRect(e.w / 2 - 4, -e.h / 2 + 6, 2, 2);
  }
  // BOAR — stocky, bristly mane, tusks
  else if (e.type === 'boar') {
    const base = hurt ? '#ef4444' : '#42301c';
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    // bristle mane
    ctx.fillStyle = '#241810'; for (let i = -3; i <= 3; i++) ctx.fillRect(i * 7 - 2, -e.h / 2 - 5, 4, 7);
    // legs
    ctx.fillStyle = base; ctx.fillRect(-e.w / 2 + 6, e.h / 2 - 2, 7, 8 + ls); ctx.fillRect(e.w / 2 - 13, e.h / 2 - 2, 7, 8 - ls);
    // head + snout
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(e.w / 2 - 6, 0, 12, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(e.w / 2 + 6, 4, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    // tusk
    ctx.fillStyle = '#e8d8b8'; ctx.beginPath(); ctx.moveTo(e.w / 2 + 8, 6); ctx.lineTo(e.w / 2 + 12, 9); ctx.lineTo(e.w / 2 + 7, 8); ctx.fill();
    // eye
    ctx.fillStyle = '#1a1008'; ctx.fillRect(e.w / 2 - 2, -2, 2, 2); ctx.fillStyle = e.state === 'attack' ? '#ef4444' : '#1a1008';
  }
  // FOX — slender, bushy tail, pointed ears, orange
  else if (e.type === 'fox') {
    const base = hurt ? '#ef4444' : '#c4602a';
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    // white belly
    ctx.fillStyle = hurt ? '#ef4444' : '#e8d8c0'; ctx.beginPath(); ctx.ellipse(0, 4, e.w / 2 - 8, e.h / 2 - 6, 0, 0, Math.PI * 2); ctx.fill();
    // bushy tail with white tip
    ctx.fillStyle = base; ctx.save(); ctx.translate(-e.w / 2, -2); ctx.rotate(-0.4); ctx.beginPath(); ctx.ellipse(-10, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f0e8d8'; ctx.beginPath(); ctx.ellipse(-20, 1, 6, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // legs
    ctx.fillStyle = '#3a2418'; ctx.fillRect(-e.w / 2 + 6, e.h / 2 - 2, 5, 7 + ls); ctx.fillRect(e.w / 2 - 11, e.h / 2 - 2, 5, 7 - ls);
    // head
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(e.w / 2 - 4, -2, 10, 9, 0, 0, Math.PI * 2); ctx.fill();
    // pointed ears
    ctx.fillStyle = '#a85020'; ctx.beginPath(); ctx.moveTo(e.w / 2 - 10, -e.h / 2); ctx.lineTo(e.w / 2 - 8, -e.h / 2 - 7); ctx.lineTo(e.w / 2 - 4, -e.h / 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(e.w / 2 + 2, -e.h / 2); ctx.lineTo(e.w / 2 + 4, -e.h / 2 - 7); ctx.lineTo(e.w / 2 + 7, -e.h / 2); ctx.fill();
    // snout (white) + nose
    ctx.fillStyle = '#f0e8d8'; ctx.beginPath(); ctx.ellipse(e.w / 2 + 6, 2, 6, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1a1008'; ctx.beginPath(); ctx.arc(e.w / 2 + 10, 2, 2, 0, Math.PI * 2); ctx.fill();
    // eye
    ctx.fillStyle = '#1a1008'; ctx.fillRect(e.w / 2 - 2, -2, 2, 2);
  }
  // EAGLE — soaring, flapping wings, hooked beak
  else if (e.type === 'eagle') {
    const base = hurt ? '#ef4444' : '#4a3420';
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2 - 4, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    // wings (flap)
    const fl = Math.sin(Date.now() / 70) * 0.6;
    ctx.fillStyle = '#2e2014';
    ctx.save(); ctx.rotate(fl); ctx.beginPath(); ctx.moveTo(-e.w / 2, -2); ctx.quadraticCurveTo(-e.w / 2 - 22, -8, -e.w / 2 - 16, 8); ctx.lineTo(-e.w / 2, 6); ctx.fill(); ctx.restore();
    ctx.save(); ctx.rotate(-fl); ctx.beginPath(); ctx.moveTo(e.w / 2, -2); ctx.quadraticCurveTo(e.w / 2 + 22, -8, e.w / 2 + 16, 8); ctx.lineTo(e.w / 2, 6); ctx.fill(); ctx.restore();
    // head
    ctx.fillStyle = '#e8d8b0'; ctx.beginPath(); ctx.arc(e.w / 2 - 2, -e.h / 2 + 3, 7, 0, Math.PI * 2); ctx.fill();
    // hooked beak
    ctx.fillStyle = '#d4a040'; ctx.beginPath(); ctx.moveTo(e.w / 2 + 4, -e.h / 2 + 2); ctx.lineTo(e.w / 2 + 10, -e.h / 2 + 4); ctx.lineTo(e.w / 2 + 4, -e.h / 2 + 7); ctx.fill();
    // eye
    ctx.fillStyle = '#d4a040'; ctx.fillRect(e.w / 2 - 4, -e.h / 2 + 1, 2, 2);
    // tail
    ctx.fillStyle = '#2e2014'; ctx.beginPath(); ctx.moveTo(-e.w / 2 + 2, 2); ctx.lineTo(-e.w / 2 - 6, -2); ctx.lineTo(-e.w / 2 - 6, 6); ctx.fill();
  }
  // SNAKE — serpentine, coiled/slithering
  else if (e.type === 'snake') {
    ctx.fillStyle = hurt ? '#ef4444' : '#3a6a3a';
    const seg = 6; const ph = Date.now() / 100;
    for (let i = 0; i < seg; i++) { const sx = -e.w / 2 + i * (e.w / seg) + Math.sin(ph + i * 0.8) * 3; ctx.beginPath(); ctx.ellipse(sx, Math.sin(ph + i) * 2, e.w / seg + 1, e.h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
    // diamond pattern
    ctx.fillStyle = hurt ? '#ef4444' : '#5a8a4a'; for (let i = 0; i < 4; i++) { const sx = -e.w / 2 + 8 + i * 9; ctx.beginPath(); ctx.moveTo(sx, -3); ctx.lineTo(sx + 3, 0); ctx.lineTo(sx, 3); ctx.lineTo(sx - 3, 0); ctx.fill(); }
    // head
    ctx.fillStyle = hurt ? '#ef4444' : '#3a6a3a'; ctx.beginPath(); ctx.ellipse(e.w / 2 - 4, 0, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
    // tongue
    ctx.strokeStyle = '#e04040'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(e.w / 2 + 4, 0); ctx.lineTo(e.w / 2 + 10, -1 + Math.sin(Date.now() / 80) * 2); ctx.stroke();
    // eye
    ctx.fillStyle = '#e0c040'; ctx.fillRect(e.w / 2 - 2, -2, 2, 2);
  }
  // LYNX — tufted ears, spotted, powerful
  else if (e.type === 'lynx') {
    const base = hurt ? '#ef4444' : '#9a8062';
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    // spots
    ctx.fillStyle = '#5a4030'; for (let i = -3; i <= 3; i++) for (let j = -1; j <= 1; j++) { if ((i + j) % 2 === 0) { ctx.beginPath(); ctx.arc(i * 9, j * 7 - 2, 2.5, 0, Math.PI * 2); ctx.fill(); } }
    // legs
    ctx.fillStyle = base; ctx.fillRect(-e.w / 2 + 8 + ls, e.h / 2 - 4, 7, 12); ctx.fillRect(-e.w / 2 + 20 - ls, e.h / 2 - 4, 7, 12); ctx.fillRect(e.w / 2 - 20 + ls, e.h / 2 - 4, 7, 12); ctx.fillRect(e.w / 2 - 8 - ls, e.h / 2 - 4, 7, 12);
    // short bobbed tail
    ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(-e.w / 2 - 2, -2, 6, 4, 0.3, 0, Math.PI * 2); ctx.fill();
    if (e.state !== 'dead') {
      // head
      ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(e.w / 2 - 6, -e.h / 2 + 8, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
      // tufted ears (lynx signature)
      ctx.fillStyle = '#5a4030'; ctx.beginPath(); ctx.moveTo(e.w / 2 - 12, -e.h / 2); ctx.lineTo(e.w / 2 - 11, -e.h / 2 - 8); ctx.lineTo(e.w / 2 - 7, -e.h / 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(e.w / 2 - 2, -e.h / 2); ctx.lineTo(e.w / 2, -e.h / 2 - 8); ctx.lineTo(e.w / 2 + 3, -e.h / 2); ctx.fill();
      // ear tufts (black tips)
      ctx.fillStyle = '#1a1008'; ctx.fillRect(e.w / 2 - 11, -e.h / 2 - 8, 2, 3); ctx.fillRect(e.w / 2 - 1, -e.h / 2 - 8, 2, 3);
      // facial ruff
      ctx.fillStyle = '#b89878'; ctx.beginPath(); ctx.ellipse(e.w / 2 - 6, -e.h / 2 + 12, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      // eyes (amber)
      ctx.fillStyle = e.state === 'attack' ? '#ff5050' : '#e0a040'; ctx.fillRect(e.w / 2 - 4, -e.h / 2 + 5, 3, 3); ctx.fillRect(e.w / 2 + 3, -e.h / 2 + 5, 3, 3);
      // nose
      ctx.fillStyle = '#1a1008'; ctx.beginPath(); ctx.arc(e.w / 2 + 8, -e.h / 2 + 10, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  // health bar
  if (e.hp > 0 && e.hp < e.maxHp) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - 1, e.y - 9, e.w + 2, 4); ctx.fillStyle = '#ef4444'; ctx.fillRect(e.x, e.y - 8, (e.w * e.hp) / e.maxHp, 3); }
}
function drawProj(ctx: CanvasRenderingContext2D, p: Proj) { ctx.fillStyle = '#e0c060'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.fillRect(-p.r, -2, p.r * 2, 4); ctx.restore(); }

// Shepherd player — burnous, staff, detailed
function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, solids: { x: number; y: number; w: number; h: number }[]) {
  ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y));
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 2, p.w / 2, 3, 0, 0, Math.PI * 2); ctx.fill();
  if (p.invinc > 0 && Math.floor(Date.now() / 80) % 2 === 0) ctx.globalAlpha = 0.4;
  let sq = p.squash, st = p.stretch;
  if (p.state === 'run' && p.grounded) { const r = Math.sin(p.anim * 2); sq *= 1 - r * 0.08; st *= 1 + r * 0.08; }
  ctx.scale(sq, st);
  if (p.charging) {
    ctx.restore(); ctx.save();
    const points = trajectory(launch(p.x, p.y, p.faceR, p.aim, p.power, p.vx), solids);
    ctx.strokeStyle = '#ffe2a6'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath();
    points.forEach((point, i) => { if (i === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); }); ctx.stroke(); ctx.setLineDash([]);
    ctx.translate(Math.round(p.x), Math.round(p.y)); ctx.scale(sq, st);
    ctx.fillStyle = '#100e0b'; ctx.fillRect(-23, -48, 46, 7); ctx.fillStyle = '#f9d47c'; ctx.fillRect(-23, -48, 46 * p.power, 7);
  }
  ctx.scale(p.faceR ? 1 : -1, 1);
  const t = p.anim; let legL = 0, legR = 0, bodyY = 0, tilt = 0;
  if (p.state === 'run') { legL = Math.sin(t) * 13; legR = Math.sin(t + Math.PI) * 13; bodyY = Math.abs(Math.sin(t * 2)) * 3; tilt = 0.08; }
  else if (p.state === 'walk') { legL = Math.sin(t) * 8; legR = Math.sin(t + Math.PI) * 8; tilt = 0.04; }
  else if (p.state === 'jump') { legL = -8; legR = -4; tilt = -0.1; }
  else if (p.state === 'fall') { legL = -4; legR = -8; tilt = 0.1; }
  else if (p.state === 'dash') { legL = -12; legR = -6; tilt = 0.2; }
  else if (p.state === 'punch') { legL = -4; legR = -2; tilt = 0.05; }
  else { bodyY = Math.sin(t * 2) * 1; }
  // legs (trousers) + sandals
  ctx.strokeStyle = '#3a2616'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -13 + bodyY); ctx.lineTo(legL, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -13 + bodyY); ctx.lineTo(legR, -2); ctx.stroke();
  ctx.fillStyle = '#241208'; ctx.fillRect(legL - 2, -2, 5, 3); ctx.fillRect(legR - 2, -2, 5, 3);
  ctx.save(); ctx.translate(0, -13 + bodyY); ctx.rotate(tilt);
  // burnous (selham) — earthy brown, draped with depth
  const cloak = p.hitFlash > 0 ? '#dc2626' : '#ead8ac';
  // back drape (slightly darker, behind)
  ctx.fillStyle = p.hitFlash > 0 ? '#b91c1c' : '#718477';
  ctx.beginPath(); ctx.moveTo(-12, -21); ctx.lineTo(12, -21); ctx.lineTo(16, 11); ctx.lineTo(-16, 11); ctx.closePath(); ctx.fill();
  // front cloak
  ctx.fillStyle = cloak;
  ctx.beginPath(); ctx.moveTo(-11, -21); ctx.lineTo(11, -21); ctx.lineTo(14, 9); ctx.lineTo(-14, 9); ctx.closePath(); ctx.fill();
  // Woven belt stripe
  ctx.fillStyle = '#8c6541'; ctx.fillRect(-12, 2, 24, 3);
  ctx.fillStyle = '#e0c074'; ctx.fillRect(-12, 2, 24, 1);
  // cloak folds
  ctx.strokeStyle = '#a89168'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, -19); ctx.lineTo(-8, 8); ctx.moveTo(6, -19); ctx.lineTo(8, 8); ctx.stroke();
  // hood (deeper, with inner shadow)
  ctx.fillStyle = '#d6c394'; ctx.beginPath(); ctx.arc(0, -24, 12, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#82795c'; ctx.beginPath(); ctx.arc(0, -24, 9, Math.PI, 0); ctx.fill();
  // face (warm tan) — clearer
  ctx.fillStyle = '#c8946a'; ctx.beginPath(); ctx.arc(1, -25, 7, 0, Math.PI * 2); ctx.fill();
  // cheek shading
  ctx.fillStyle = '#b07a52'; ctx.beginPath(); ctx.arc(5, -23, 3, 0, Math.PI * 2); ctx.fill();
  // beard
  ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(1, -19, 5.5, 3.5, 0, 0, Math.PI); ctx.fill();
  // eyes (clearer)
  ctx.fillStyle = '#1a0e08'; ctx.fillRect(3, -26, 2, 2.5); ctx.fillRect(-3, -26, 2, 2.5);
  // eyebrow
  ctx.fillStyle = '#1a0e08'; ctx.fillRect(2, -28, 4, 1); ctx.fillRect(-4, -28, 4, 1);
  // A woven shoulder wrap gives the shepherd a readable silhouette at gameplay size.
  ctx.fillStyle = '#48776b'; ctx.beginPath(); ctx.moveTo(-12, -20); ctx.lineTo(9, -16); ctx.lineTo(11, -10); ctx.lineTo(-13, -15); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#9eb29a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-10, -18); ctx.lineTo(8, -14); ctx.stroke();
  // carved shepherd staff (with crook)
  ctx.strokeStyle = '#9a7a44'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(17, -27); ctx.lineTo(18, 12); ctx.stroke();
  ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(17, -27); ctx.lineTo(18, 12); ctx.stroke();
  ctx.strokeStyle = '#9a7a44'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(20, -28, 3, Math.PI * 0.3, Math.PI * 1.4); ctx.stroke();
  // rock in hand OR punch fist
  if (p.state === 'punch') { ctx.fillStyle = '#c8946a'; ctx.beginPath(); ctx.arc(18, -8, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#a8784a'; ctx.fillRect(15, -11, 4, 2); }
  else if (p.rockN > 0) { ctx.fillStyle = '#7a7060'; ctx.beginPath(); ctx.arc(13, -8, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9a9080'; ctx.beginPath(); ctx.arc(12, -9, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore(); ctx.restore();
}
// ============================================================
//  Component
// ============================================================
type Screen = 'title' | 'intro' | 'transition' | 'playing' | 'complete' | 'reset' | 'puzzle' | 'paused';
type Lang = 'ar' | 'en' | 'fr';
// Tri-lingual story, sentence by sentence (shown together over the Atlas song)
const STORY = [
  { ar: 'عند الفجر، تركت العاصفة باب الحظيرة مفتوحاً. اختفى صوت الجرس بين الأشجار.', en: 'At dawn, the storm left the pen open. The bell faded among the trees.', fr: 'À l’aube, la tempête a laissé l’enclos ouvert. La cloche s’est tue parmi les arbres.' },
  { ar: 'يتتبع الراعي الصوف وآثار الحوافر عبر الأرز والمرعى ومجرى الماء والممر الثلجي.', en: 'The shepherd follows wool and hoofprints through cedars, pasture, water and snow.', fr: 'Le berger suit la laine et les empreintes à travers la cédraie, le pâturage, l’eau et la neige.' },
  { ar: 'افهم الآلات وافتح المسار. كل غنمة تنقذها تصل إلى المأوى، وستذكر النهاية ما أنقذته فعلاً.', en: 'Understand each mechanism and open the path. Rescued sheep reach shelter. The ending records your actual rescues.', fr: 'Comprenez les mécanismes et ouvrez le passage. Les moutons sauvés rejoignent l’abri. La fin reflète vos sauvetages.' },
];

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen>('title');
  const [lang, setLang] = useState<Lang>('ar');
  const [storyIdx, setStoryIdx] = useState(0);
  const [wi, setWi] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const [totalCoins, setTotalCoins] = useState(0);
  const [hasSave, setHasSave] = useState(false);
  const [activePuzzle, setActivePuzzle] = useState<LogicPuzzle | null>(null);
  const [puzzleLever, setPuzzleLever] = useState<string | null>(null);
  const S = useRef<Session | null>(null);
  const saveRef = useRef<Save>(emptySave());
  const [notice, setNotice] = useState('');
  const [challenge, setChallenge] = useState(false);
  const challengeRef = useRef(false);
  useEffect(() => { challengeRef.current = challenge; }, [challenge]);
  const [hud, setHud] = useState({ hp: 3, coins: 0, sheep: 0, solved: 0, deaths: 0 });
  const [musicVolume, setMusicVolume] = useState(0.4);
  const [sfxVolume, setSfxVolume] = useState(0.6);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const motionRef = useRef(reducedMotion);
  const [confirmNew, setConfirmNew] = useState(false);
  const [chapters, setChapters] = useState(false);
  const [large, setLarge] = useState(false);
  const [bindings, setBindings] = useState<Bindings>({ ...defaultBindings });
  const held = useRef<Set<Action>>(new Set());
  const pendingActions = useRef<Set<Action>>(new Set());
  const t = (key: string) => text(lang, key);
  useEffect(() => { motionRef.current = reducedMotion; }, [reducedMotion]);
  useEffect(() => { A.volume(musicVolume, sfxVolume); }, [musicVolume, sfxVolume, screen]);
  useEffect(() => { try { const loaded = loadSave(browserStorage); saveRef.current = loaded.data; setHasSave(Object.keys(loaded.data.rooms).length > 0 || loaded.data.coins > 0 || loaded.data.world > 0); if (loaded.recovered) setNotice('saveRecovered'); } catch { setNotice('saveFailed'); } }, []);
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; }, [lang]);
  const persist = (nextWorld = wi, complete = false) => {
    const st = S.current; if (!st) return;
    const data: Save = { version: 4, world: nextWorld, coins: st.totalCoins + st.wCoins, deaths: st.deaths, rooms: { ...saveRef.current.rooms, [st.world.def.id]: snapshot(st.world) }, complete: complete || saveRef.current.complete, unlocked: Math.max(saveRef.current.unlocked, nextWorld) };
    saveRef.current = data;
    if (writeSave(browserStorage, data)) setHasSave(true); else setNotice('saveFailed');
  };
  const start = (resume: boolean, chapter?: number) => {
    if (!resume && hasSave && !confirmNew) { setConfirmNew(true); return; }
    if (!resume) { if (!eraseSave(browserStorage)) { setNotice('eraseFailed'); return; } saveRef.current = emptySave(); setHasSave(false); }
    A.init(); A.volume(musicVolume, sfxVolume); setConfirmNew(false);
    const sv = saveRef.current; setWi(chapter ?? (resume ? sv.world : 0)); setDeaths(resume ? sv.deaths : 0); setTotalCoins(resume ? sv.coins : 0); setStoryIdx(0);
    setScreen(resume ? 'transition' : 'intro');
  };
  const resetRoom = () => {
    const st = S.current; if (!st) return;
    resetResources(st.world); Object.assign(st.player, createPlayer(st.world.def.spawnX, st.world.def.spawnY));
    st.world.threat = { kind: st.world.def.threat, timer: 0, level: 0, phase: 'calm', frontX: 0 };
    st.world.hazards.forEach(h => { if (h.baseY !== undefined) { h.y = h.baseY; h.h = h.bottom - h.y; } });
    persist(); setScreen('playing'); A.resume();
  };
  useEffect(() => {
    const pause = () => { if (screen === 'playing') { held.current.clear(); persist(); setScreen('paused'); A.pause(); } };
    const visibility = () => { if (document.hidden) { held.current.clear(); if (screen === 'intro' || screen === 'puzzle') A.pause(); pause(); } else if (screen === 'intro' || screen === 'puzzle') A.resume(); };
    const escape = (e: KeyboardEvent) => { if (e.code === 'Escape') { if (screen === 'playing') pause(); else if (screen === 'paused') { setScreen('playing'); A.resume(); } } };
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', visibility); window.addEventListener('keydown', escape); const pagehide = () => persist(); window.addEventListener('pagehide', pagehide);
    if (screen === 'title' || screen === 'complete' || screen === 'reset') { A.stop(); A.pause(); }
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('keydown', escape); window.removeEventListener('pagehide', pagehide); };
  }, [screen, wi]);
  useEffect(() => () => { A.stop(); A.pause(); }, []);
  useEffect(() => { if (screen !== 'intro') return; A.init(); A.startSong(); return () => A.stopSong(); }, [screen]);
  useEffect(() => {
    if (screen !== 'transition') return;
    const timer = setTimeout(() => {
      const def = WORLDS[wi](), world = createWorld(wi, saveRef.current.rooms[def.id]);
      S.current = { time: 0, world, player: createPlayer(world.def.spawnX, world.def.spawnY), camX: 0, camY: 0, camTX: 0, camTY: 0, deaths, totalCoins, wCoins: 0 };
      A.init(); A.music(MOODS[wi]); setScreen('playing');
    }, 700);
    return () => clearTimeout(timer);
  }, [screen, wi]);

  useEffect(() => {
    if (screen !== 'playing' || !ref.current) return;
    const cv = ref.current, ctx = cv.getContext('2d'); if (!ctx) return;
    let raf = 0, last = performance.now(), stopped = false, respawned = false; const clock = new FixedClock(); clock.time = S.current?.time ?? 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 3); cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pressed = new Set<string>(); const k: Record<string, boolean> = {};
    const kd = (e: KeyboardEvent) => { const c = canonicalCode(e.code, bindings); if (c) { e.preventDefault(); pressed.add(c); } };
    const ku = (e: KeyboardEvent) => { pressed.delete(canonicalCode(e.code, bindings)); };
    window.addEventListener('keydown', kd, { passive: false }); window.addEventListener('keyup', ku);
    const pollInput = () => {
      const pad = navigator.getGamepads?.()[0];
      const gp: Partial<Record<Action, boolean>> = pad ? { left: pad.axes[0] < -0.35 || pad.buttons[14]?.pressed, right: pad.axes[0] > 0.35 || pad.buttons[15]?.pressed, jump: pad.buttons[0]?.pressed, interact: pad.buttons[2]?.pressed, dash: pad.buttons[1]?.pressed, punch: pad.buttons[3]?.pressed, aim: pad.buttons[7]?.pressed, quick: pad.buttons[5]?.pressed, up: pad.axes[1] < -0.35, down: pad.axes[1] > 0.35 } : {};
      for (const a of Object.keys(defaultBindings) as Action[]) { const key = a === 'interact' ? 'inter' : a; const down = pressed.has(defaultBindings[a]) || held.current.has(a) || !!gp[a]; if ((down && !k[key]) || pendingActions.current.has(a)) k[key + 'JP'] = true; k[key] = down; }
      pendingActions.current.clear();
    };
    const st = S.current; if (!st) return; const { world, player } = st; const def = world.def; const pal = def.pal; let pT = 0;

    const hurt = (force = false) => {
      if (player.invinc > 0 || respawned) return;
      player.hp--; player.invinc = 1.1; player.hitFlash = 0.25; A.hurt();
      player.vy = -280; player.vx = (player.faceR ? -1 : 1) * 180;
      if (player.hp > 0 && !force) return;
      respawned = true; st.deaths++; world.streak++; setDeaths(st.deaths);
      if (challengeRef.current && world.streak >= 3) { persist(); stopped = true; A.pause(); setScreen('reset'); return; }
      Object.assign(player, createPlayer(def.spawnX, def.spawnY)); resetResources(world);
      world.threat = { kind: def.threat, timer: 0, level: 0, phase: 'calm', frontX: 0 };
      world.hazards.forEach(h => { h.y = h.baseY; h.h = h.bottom - h.y; });
      persist();
    };
    const burst = (x: number, y: number, col: string, n = 12) => { for (let i = 0; i < n; i++) world.particles.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: -70 - Math.random() * 110, life: 0.5, max: 0.5, size: 3 + Math.random() * 3, color: col, kind: 'spark' }); };

    const activateLever = (lever: Lever, byRock: boolean) => {
      const result = activate(world, lever, byRock ? 'rock' : 'hand');
      if (result === 'puzzle') {
        const puzzle = PUZZLES[lever.puzzleId!];
        if (!puzzle) return;
        setActivePuzzle(puzzle); setPuzzleLever(lever.id);
        stopped = true; setScreen('puzzle');
      } else if (result === 'activated') { A.task(); burst(lever.x, lever.y - 20, pal.accent); persist(); }
      else if (result === 'wrong') A.hurt();
    };
    const tick = (dt: number, simulationTime: number) => {
      if (stopped) return false;
      pollInput(); st.time = simulationTime;
      const time = simulationTime * 1000; respawned = false; player.prevX = player.x; player.prevY = player.y;
      // camera (smooth, slight lookahead)
      st.camTX = player.x - W / 2 + (player.faceR ? 30 : -30); st.camTX = cl(st.camTX, 0, def.width - W);
      let camTY = 0; if (player.y < 320) camTY = player.y - 320; camTY = Math.max(-240, camTY);
      st.camX += (st.camTX - st.camX) * Math.min(1, dt * 7); st.camY += (camTY - st.camY) * Math.min(1, dt * 5);
      const cx = Math.round(st.camX), cy = Math.round(st.camY);

      // aim
      if (player.rockN > 0) { if (k.up) player.aim -= 2.5 * dt; if (k.down) player.aim += 2.5 * dt; player.aim = cl(player.aim, -Math.PI / 2, 0); }

      // pickup rock (E)
      if (k.interJP) {
        if (player.rockN === 0 && world.levers.some(l => Math.abs(player.x - l.x) < 130)) player.rockN = 4;
        let bi = -1, md = 90; world.rocks.forEach((r: Rock, i: number) => { const d = Math.hypot(r.x - player.x, r.y - player.y); if (d < md) { md = d; bi = i; } });
        if (bi !== -1 && player.rockN < 4) { world.rocks.splice(bi, 1); player.rockN++; player.aim = 0; A.collect(); }
        // Solved timed gates can be reopened from either side without another reward.
        world.doors.filter(d => !d.open && Math.abs(player.x - d.x) < 80).forEach(d => { const lever = world.levers.find(l => l.lid === d.id && l.timed && l.solved); if (lever) activateLever(lever, false); });
        // nearby physical switches; distant targets are rock-only
        world.levers.forEach((l: Lever) => {
          if (Math.abs(player.x - l.x) < 38 && Math.abs((player.y - 24) - l.y) < 50) activateLever(l, false);
        });
      }
      k.interJP = false; if (stopped) return false;

      // Preview and live throws share launch() and projectileStep().
      if (k.aim && player.rockN > 0) { player.charging = true; player.power = cl(player.power + CHARGE_SPD * dt, 0, 1); }
      else if (!k.aim && player.charging) { player.charging = false; if (player.rockN > 0) { player.rockN--; world.rocks.push({ id: world.nextRockId++, ...launch(player.x, player.y, player.faceR, player.aim, player.power, player.vx) }); A.throwS(); } player.power = 0; }
      if (k.quickJP && player.rockN > 0 && !player.charging) { player.rockN--; const rock = launch(player.x, player.y, player.faceR, 0, 0.96, player.vx); world.rocks.push({ id: world.nextRockId++, ...rock }); A.throwS(); }
      k.quickJP = false;
      // PUNCH (G/Q) — works always, especially when out of rocks
      if (player.punchCD > 0) player.punchCD -= dt;
      if (k.punchJP && player.punchCD <= 0 && player.dashT <= 0) { player.attackHits = []; player.punchT = 0.18; player.punchCD = PUNCH_CD; player.state = 'punch'; A.punch(); }
      k.punchJP = false;
      if (player.punchT > 0) { player.punchT -= dt; // apply punch damage in range
        for (const e of world.enemies) {
          const result = strikeEnemy(world, player, e, [...world.platforms.filter(p => !p.broken), ...world.doors.filter(d => !d.open)]);
          if (result !== 'miss') A.enemyH();
          if (result === 'killed') { A.task(); burst(e.x, e.y, '#ef4444'); persist(); }
        }
      }

      // movement
      let md = 0; if (k.left) md -= 1; if (k.right) md += 1; if (md !== 0) player.faceR = md > 0;
      if (player.dashCD > 0) player.dashCD -= dt;
      if (k.dashJP && player.dashCD <= 0 && player.dashT <= 0) { player.dashT = DASH_T; player.dashCD = DASH_CD; player.dashDir = player.faceR ? 1 : -1; A.dash(); player.invinc = Math.max(player.invinc, DASH_T + 0.05); }
      k.dashJP = false;
      if (player.dashT > 0) { player.dashT -= dt; player.vx = player.dashDir * DASH_SPD; player.vy = 0; player.state = 'dash'; if (Math.random() < 0.5) world.particles.push({ x: player.x, y: player.y - 18, vx: -player.dashDir * 50, vy: (Math.random() - 0.5) * 30, life: 0.25, max: 0.25, size: 3 + Math.random() * 2, color: pal.accent, kind: 'spark' }); }
      else if (md !== 0) { player.vx += md * ACC * dt; player.vx = cl(player.vx, -MAXSPD, MAXSPD); }
      else { const fr = player.grounded ? FRIC_G : FRIC_A; if (player.vx > 0) { player.vx -= fr * dt; if (player.vx < 0) player.vx = 0; } else if (player.vx < 0) { player.vx += fr * dt; if (player.vx > 0) player.vx = 0; } }

      // jump
      if (k.jumpJP) player.jumpBuf = 0.14; if (player.jumpBuf > 0) player.jumpBuf -= dt;
      if (player.grounded) { player.coyote = 0.14; player.jumps = 2; } else if (player.coyote > 0) player.coyote -= dt;
      if (player.jumpBuf > 0) { if (player.coyote > 0 || player.grounded) { A.jump(); player.vy = -JUMP; player.grounded = false; player.jumpBuf = 0; player.coyote = 0; player.jumps = 1; player.squash = 0.6; player.stretch = 1.4; } else if (player.jumps > 0 && player.dashT <= 0) { A.jump(); player.vy = -JUMP * 0.9; player.jumpBuf = 0; player.jumps--; player.squash = 0.7; player.stretch = 1.3; } }
      k.jumpJP = false;
      player.squash += (1 - player.squash) * 14 * dt; player.stretch += (1 - player.stretch) * 14 * dt;
      let g = GRAVITY; if (player.vy > 0) g *= FALL_MUL; else if (player.vy < 0 && !k.jump) g *= LOWJ_MUL; player.vy += g * dt;

      // ===== collisions (previous-position resolved) =====
      // Timed gates close predictably; their lever can then be used again without duplicating puzzle credit.
      world.doors.forEach((d: Door) => {
        if (d.timer !== undefined && d.open) {
          d.timer -= dt;
          if (d.timer <= 0) {
            const occupied = hit(pR(player), d) || world.boxes.some((b: Box) => hit({ x: b.x, y: b.y, w: b.w, h: b.h }, d));
            if (occupied) d.timer = 0.25; // never close a gate inside the player or a box
            else { d.open = false; d.timer = undefined; world.levers.forEach((l: Lever) => { if (l.lid === d.id && l.timed) l.on = false; }); }
          }
        }
      });
      // Bridges animate from vertical to horizontal after a distant target is struck.
      world.bridges.forEach((b: Bridge) => { b.progress = cl(b.progress + (b.down ? dt * 2.2 : -dt * 2.2), 0, 1); });
      const bridgeSolids = world.bridges.map(bridgeSolid);
      const mp = world.mplatforms;
      const fixedSolids = [...world.platforms.filter(p => !(p.type === 'break' && p.broken)), ...bridgeSolids, ...world.doors.filter(d => !d.open)];
      mp.forEach(m => {
        const vertical = m.axis === 'y', value = vertical ? m.y : m.x;
        const lo = vertical ? m.sy! : m.sx, hi = vertical ? m.ey! : m.ex;
        const next = cl(value + m.vx * dt, lo, hi);
        movePlatform(m, vertical ? m.x : next, vertical ? next : m.y, player, world.boxes, fixedSolids);
        if (next <= lo || next >= hi) m.vx *= -1;
      });
      world.elevators.forEach(ev => {
        const plate = world.plates.find(p => p.id === ev.plateId);
        const pressed = plate && (hit(pR(player), { x: plate.x, y: plate.y - 6, w: plate.w, h: 12 }) || world.boxes.some(b => b.x + b.w > plate.x && b.x < plate.x + plate.w && Math.abs(b.y + b.h - plate.y) < 3) || world.rocks.some(r => Math.abs(r.y + r.r - plate.y) < 3 && r.x > plate.x && r.x < plate.x + plate.w));
        if (plate) plate.pressed = !!pressed;
        const mover = Object.assign(ev, { vx: ev.speed });
        movePlatform(mover, ev.x, cl(ev.y + (pressed ? -1 : 1) * ev.speed * dt, ev.topY, ev.baseY), player, world.boxes, fixedSolids);
      });
      const solids = [...fixedSolids, ...mp, ...world.elevators];
      // Sub-stepped horizontal sweep prevents dash tunnelling through thin gates and raised bridges.
      const totalDX = player.vx * dt; const hSteps = Math.max(1, Math.ceil(Math.abs(totalDX) / 7)); const stepDX = totalDX / hSteps;
      let pr = pR(player); let hBlocked = false;
      for (let hs = 0; hs < hSteps && !hBlocked; hs++) {
        const prevTop = player.y - player.h, prevBottom = player.y;
        player.x += stepDX; pr = pR(player);
        for (const p of solids) {
          if (!hit(pr, p)) continue;
          const beside = !(prevBottom <= p.y + 2 || prevTop >= p.y + p.h - 2); if (!beside) continue;
          if (stepDX > 0) player.x = p.x - player.w / 2; else if (stepDX < 0) player.x = p.x + p.w + player.w / 2;
          player.vx = 0; hBlocked = true; pr = pR(player); break;
        }
        if (hBlocked) break;
        for (const b of world.boxes) {
          const br = { x: b.x, y: b.y, w: b.w, h: b.h }; if (!hit(pr, br)) continue;
          const beside = !(prevBottom <= b.y + 2 || prevTop >= b.y + b.h - 2); if (!beside) continue;
          if (stepDX > 0) { b.vx = Math.max(b.vx, player.vx * 0.6); player.x = b.x - player.w / 2; }
          else if (stepDX < 0) { b.vx = Math.min(b.vx, player.vx * 0.6); player.x = b.x + b.w + player.w / 2; }
          player.vx = 0; hBlocked = true; pr = pR(player); break;
        }
      }
      // Boxes also use sub-steps, so fast pushes cannot pass through a wall.
      for (const b of world.boxes) {
        b.vx *= Math.pow(0.85, dt * 60); const boxDX = b.vx * dt; const bs = Math.max(1, Math.ceil(Math.abs(boxDX) / 7));
        for (let s = 0; s < bs; s++) { b.x += boxDX / bs; let br = { x: b.x, y: b.y, w: b.w, h: b.h }; let stop = false; for (const p of solids) { if (hit(br, p)) { if (boxDX > 0) b.x = p.x - b.w; else if (boxDX < 0) b.x = p.x + p.w; b.vx = 0; stop = true; break; } } if (stop) break; }
      }
      // Sub-stepped vertical sweep prevents falling through moving platforms and narrow bridge planks.
      const impactVy = player.vy; const totalDY = player.vy * dt; const vSteps = Math.max(1, Math.ceil(Math.abs(totalDY) / 7)); const stepDY = totalDY / vSteps;
      player.grounded = false;  let vBlocked = false;
      for (let vs = 0; vs < vSteps && !vBlocked; vs++) {
        const beforeY = player.y, beforeTop = beforeY - player.h;
        player.y += stepDY; pr = pR(player);
        let bestY = Infinity, bestP: any = null;
        for (const p of solids) {
          if (!hit(pr, p)) continue;
          if (stepDY >= 0 && beforeY <= p.y + 2 && p.y < bestY) { bestY = p.y; bestP = p; }
          else if (stepDY < 0 && beforeTop >= p.y + p.h - 2) { player.y = p.y + p.h + player.h; player.vy = 0; vBlocked = true; pr = pR(player); break; }
        }
        if (bestP) {
          player.y = bestY; player.vy = 0; player.grounded = true; vBlocked = true;
          if (impactVy > 200) { player.squash = 1.4; player.stretch = 0.6; A.land(); }
          const bp = bestP as Plat; if (bp.type === 'break' && !bp.broken) { bp.broken = true; bp.breakT = 0.4; }
          pr = pR(player); break;
        }
        for (const b of world.boxes) {
          const br = { x: b.x, y: b.y, w: b.w, h: b.h }; if (!hit(pr, br)) continue;
          if (stepDY >= 0 && beforeY <= b.y + 2) { player.y = b.y; player.vy = 0; player.grounded = true; vBlocked = true; if (impactVy > 200) { player.squash = 1.4; player.stretch = 0.6; A.land(); } pr = pR(player); break; }
          if (stepDY < 0 && beforeTop >= b.y + b.h - 2) { player.y = b.y + b.h + player.h; player.vy = 0; vBlocked = true; pr = pR(player); break; }
        }
      }
      // Box gravity with sub-steps; no fall-through at low frame rates.
      for (const b of world.boxes) {
        b.prevY = b.y; b.vy += GRAVITY * dt; b.impactVy = b.vy; const boxDY = b.vy * dt; const bs = Math.max(1, Math.ceil(Math.abs(boxDY) / 7));
        for (let s = 0; s < bs; s++) { const prevBottom = b.y + b.h, prevTop = b.y; b.y += boxDY / bs; const br = { x: b.x, y: b.y, w: b.w, h: b.h }; let stop = false; for (const p of solids) { if (!hit(br, p)) continue; if (boxDY >= 0 && prevBottom <= p.y + 2) { b.y = p.y - b.h; b.impactVy = b.vy; b.vy = 0; stop = true; break; } if (boxDY < 0 && prevTop >= p.y + p.h - 2) { b.y = p.y + p.h; b.vy = 0; stop = true; break; } } if (stop) break; }
      }
      if (player.x < player.w / 2) { player.x = player.w / 2; player.vx = 0; } if (player.x > def.width - player.w / 2) { player.x = def.width - player.w / 2; player.vx = 0; }
      world.platforms.forEach((p: Plat) => { if (p.broken && p.breakT !== undefined) p.breakT -= dt; });

      // rocks physics
      const s2 = [...solids, ...world.boxes];
      for (let i = world.rocks.length - 1; i >= 0; i--) {
        const r = world.rocks[i]; const px = r.x, py = r.y; projectileStep(r, dt);
        for (const pl of s2) { if (r.x + r.r > pl.x && r.x - r.r < pl.x + pl.w && r.y + r.r > pl.y && r.y - r.r < pl.y + pl.h) { if (py + r.r <= pl.y && r.vy > 0) { r.y = pl.y - r.r; if (r.vy > 120) A.rockHit(); r.vy *= -ROCK_BOUNCE; if (Math.abs(r.vx) > 0) { r.vx -= Math.sign(r.vx) * ROCK_FRIC * dt; if (Math.abs(r.vx) < 12) r.vx = 0; } if (Math.abs(r.vy) < 50) r.vy = 0; } else if (py - r.r >= pl.y + pl.h && r.vy < 0) { r.y = pl.y + pl.h + r.r; r.vy *= -ROCK_BOUNCE; } else { if (px + r.r <= pl.x && r.vx > 0) { r.x = pl.x - r.r; r.vx *= -ROCK_BOUNCE; } else if (px - r.r >= pl.x + pl.w && r.vx < 0) { r.x = pl.x + pl.w + r.r; r.vx *= -ROCK_BOUNCE; } } } }
        world.levers.forEach((l: Lever) => {
          if (!l.on && hit({ x: r.x - r.r, y: r.y - r.r, w: r.r * 2, h: r.r * 2 }, { x: l.x - 10, y: l.y - 40, w: 28, h: 42 })) activateLever(l, true);
        });
        for (const hb of world.hanging) { if (!hb.hit && hit({ x: r.x - r.r, y: r.y - r.r, w: r.r * 2, h: r.r * 2 }, { x: hb.x, y: hb.y, w: hb.w, h: hb.h })) { hb.hit = true; world.boxes.push({ x: hb.x, y: hb.y, w: hb.w, h: hb.h, vx: 0, vy: 0 }); A.rockHit(); r.vy = -50; r.vx = r.vx > 0 ? -40 : 40; } }
        if (r.y > H + 200) world.rocks.splice(i, 1);
      }

      // enemies
      for (const e of world.enemies) {
        if (e.state === 'dead') { e.deadT -= dt; continue; }
        // knockback
        if (e.kbX !== 0) { const nx = cl(e.x + e.kbX * dt, e.sx, e.ex); if (!solids.some(p => hit({ x: nx, y: e.y, w: e.w, h: e.h - 1 }, p))) e.x = nx; e.kbX *= Math.pow(0.85, dt * 60); if (Math.abs(e.kbX) < 5) e.kbX = 0; }
        if (e.type === 'eagle') {
          e.homeY ??= e.y; e.anim += dt; e.shootT -= dt;
          // Flight has an absolute reference, with a visible preparation and recovery interval.
          const phase = (simulationTime + e.sx / 100) % 7;
          e.state = phase > 4 && phase < 4.8 ? 'attack' : 'walk';
          const dive = phase >= 4.8 && phase < 5.7 ? Math.sin((phase - 4.8) / 0.9 * Math.PI) * 170 : 0;
          e.x = (e.sx + e.ex) / 2 + Math.sin(simulationTime * 0.5) * (e.ex - e.sx) / 2;
          e.y = cl(e.homeY + Math.sin(simulationTime * 1.2) * 18 + dive, 60, 390); e.faceR = Math.cos(simulationTime * 0.5) > 0;
          if (dive > 80 && hit(pR(player), e)) hurt();
          if (respawned) return false;
          continue;
        }
        e.vy += GRAVITY * dt; const ePB = e.y + e.h; e.y += e.vy * dt; e.anim += dt;
        let er = { x: e.x, y: e.y, w: e.w, h: e.h }; e.onGround = false; let bestEY = Infinity;
        for (const p of solids) { if (hit(er, p)) { if (e.vy >= 0 && ePB <= p.y + 4 && (e.x + e.w > p.x + 1 && e.x < p.x + p.w - 1)) { if (p.y < bestEY) bestEY = p.y; } } er = { x: e.x, y: e.y, w: e.w, h: e.h }; }
        if (bestEY < Infinity) { e.y = bestEY - e.h; e.vy = 0; e.onGround = true; }
        if (e.dmgT > 0) e.dmgT -= dt;
        const dx = Math.abs(player.x - e.x), dy = Math.abs(player.y - e.y);
        const relevantThreat = world.threat.kind === 'wolfpack' && e.type === 'wolf';
        const pressureBoost = relevantThreat ? 1 + world.threat.level * 0.28 : 1;
        const sight = (e.type === 'lynx' ? 360 : 300) * pressureBoost;
        const visible = clearLine({ x: e.x + e.w / 2, y: e.y + e.h / 2 }, { x: player.x, y: player.y - 20 }, solids); const ambient = e.type === 'fox' || e.type === 'macaque';
        const inSight = !ambient && dx < sight && dy < 130 && visible; const inRange = !ambient && dx < 56 && dy < 50 && visible;
        if (e.type === 'snake') { e.state = 'walk'; if (e.faceR) { e.vx = 55; if (e.x > e.ex) e.faceR = false; } else { e.vx = -55; if (e.x < e.sx) e.faceR = true; } if (inRange && player.invinc <= 0) hurt(); }
        else { // realistic wolf speed (moderate, visible)
          if (inSight) { if (inRange) { e.vx = 0; if (e.state !== 'attack') { e.state = 'attack'; e.atkT = 0; e.faceR = player.x > e.x; A.hurt(); } e.atkT += dt; if (e.atkT > 0.45 && inRange && player.invinc <= 0) { hurt(); e.state = 'walk'; e.atkT = 0; } } else { e.state = 'walk'; e.faceR = player.x > e.x; const baseSp = e.type === 'lynx' ? 175 : e.type === 'wolf' ? 145 : e.type === 'boar' ? 120 : 125; const sp = baseSp * pressureBoost; e.vx = e.faceR ? sp : -sp; } }
          else { e.state = 'walk'; if (e.faceR) { e.vx = 65; if (e.x > e.ex) e.faceR = false; } else { e.vx = -65; if (e.x < e.sx) e.faceR = true; } }
        }
        const nextX = e.x + e.vx * dt;
        const edge = e.vx > 0 ? nextX + e.w : nextX;
        const floorAhead = solids.some(p => edge >= p.x && edge <= p.x + p.w && Math.abs(p.y - (e.y + e.h)) < 8);
        if ((e.onGround && !floorAhead) || solids.some(p => hit({ x: nextX, y: e.y, w: e.w, h: e.h - 1 }, p))) { e.vx = 0; e.faceR = !e.faceR; } else e.x = nextX;
        if (respawned) return false;
        if (e.x < e.sx) { e.x = e.sx; e.faceR = true; } if (e.x > e.ex) { e.x = e.ex; e.faceR = false; }
      }
      // Resolve all animal contacts through the same idempotent damage rules.
      for (const e of world.enemies) {
        for (const r of world.rocks) {
          if (e.hp <= 0) break;
          const cX = cl(r.x, e.x, e.x + e.w), cY = cl(r.y, e.y, e.y + e.h);
          if ((r.x - cX) ** 2 + (r.y - cY) ** 2 < r.r * r.r && Math.hypot(r.vx, r.vy) > 90) {
            if (damageEnemy(world, e, 1)) { A.task(); persist(); }
            r.vx = -Math.sign(r.vx) * 35; r.vy = -35;
          }
        }
        for (const b of world.boxes) {
          if (e.hp <= 0) break;
          if (downwardContact(b, (b.prevY ?? b.y) + b.h, b.impactVy ?? 0, e) && damageEnemy(world, e, e.hp)) { A.task(); persist(); }
        }
      }
      // projectiles
      for (let i = world.projectiles.length - 1; i >= 0; i--) { const p = world.projectiles[i]; p.vy += GRAVITY * 0.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (player.invinc <= 0) { const cX = cl(p.x, player.x - player.w / 2, player.x + player.w / 2), cY = cl(p.y, player.y - player.h, player.y); if ((p.x - cX) ** 2 + (p.y - cY) ** 2 < p.r * p.r) { hurt(); world.projectiles.splice(i, 1); continue; } } if (p.life <= 0 || p.y > H + 100) world.projectiles.splice(i, 1); }
      if (respawned) return false;
      // coins
      let collected = false;
      world.coins.forEach((c: Coin) => { c.bob += dt; if (!c.got && Math.abs(player.x - c.x) < 24 && Math.abs((player.y - 22) - c.y) < 28) { c.got = true; st.wCoins++; collected = true; A.collect(); burst(c.x, c.y, pal.accent, 6); } });
      if (collected) persist();
      // sheep
      world.sheep.forEach((s: Sheep) => { s.bob += dt; if (!s.rescued && Math.abs(player.x - s.x) < 36 && Math.abs((player.y - 20) - s.y) < 30) { s.rescued = true; world.rescued++; persist(); A.sheep(); A.task(); burst(s.x, s.y, '#f0ece4', 10); } });
      // checkpoints
      world.checkpoints.forEach((c: Check) => { if (!c.on && Math.abs(player.x - c.x) < 38 && player.grounded) { c.on = true; A.task(); def.spawnX = c.x + 60; def.spawnY = c.y; world.streak = 0; persist(); } });
      // hazards
      for (const h of world.hazards) { if (respawned) break; if (hit(pR(player), { x: h.x, y: h.y, w: h.w, h: h.h }) && player.invinc <= 0) hurt(true); }

      if (respawned) return false;
      // pressure plates (Limbo-style: pressed while player/box/rock stands on it)
      let plateChanged = false;
      world.plates.forEach((pl: Plate, plateIndex: number) => {
        if (pl.elevatorId === undefined && !pl.solved) {
          pl.pressed = false;
          // player, boxes, and resting rocks all provide weight
          if (hit(pR(player), { x: pl.x, y: pl.y - 6, w: pl.w, h: 12 }) && player.grounded) pl.pressed = true;
          for (const b of world.boxes) { if (b.x + b.w > pl.x && b.x < pl.x + pl.w && Math.abs((b.y + b.h) - pl.y) < 12) pl.pressed = true; }
          for (const r of world.rocks) { if (r.x + r.r > pl.x && r.x - r.r < pl.x + pl.w && Math.abs((r.y + r.r) - pl.y) < 10) pl.pressed = true; }
          if (pl.pressed) { pl.solved = true; award(world, `plate-${plateIndex}`); plateChanged = true; A.task(); burst(pl.x + pl.w / 2, pl.y - 8, pal.accent, 10); }
        }
        // Elevator plates are dynamic: the platform rises only while weight is on the plate.
        if (pl.elevatorId !== undefined) {
          pl.pressed = false;
          if (hit(pR(player), { x: pl.x, y: pl.y - 6, w: pl.w, h: 12 }) && player.grounded) pl.pressed = true;
          for (const b of world.boxes) { if (b.x + b.w > pl.x && b.x < pl.x + pl.w && Math.abs((b.y + b.h) - pl.y) < 12) pl.pressed = true; }
          for (const r of world.rocks) { if (r.x + r.r > pl.x && r.x - r.r < pl.x + pl.w && Math.abs((r.y + r.r) - pl.y) < 10) pl.pressed = true; }
          // do not latch or count as solved — it's a dynamic mechanism, not a one-shot puzzle
        } else if (pl.solved) pl.pressed = true; // Solved plates latch the mechanism permanently.
        // Door-linked plates
        if (pl.lid >= 0) world.doors.forEach((d: Door) => { if (d.id === pl.lid) d.open = !!pl.pressed; });
      });

      if (plateChanged) persist();
      // Environmental pressure: telegraphed, escapable, and reset-safe.
      const th = world.threat; if (!world.avalancheCleared && (th.kind !== 'avalanche' || (world.levers.every(l => l.on || !!l.solved) && player.x > 2780))) th.timer += dt;
      if (th.kind === 'flood') {
        th.level = cl(th.timer / 150, 0, 1); th.phase = th.level > 0.62 ? 'warning' : 'calm';
        // slow, capped rise; water never consumes half the screen
        world.hazards.forEach((h: Haz) => { if (h.type === 'water' && h.y > GY - 50) { h.y = Math.max(GY - 50, h.y - 2.4 * dt * (0.35 + th.level)); h.h = h.bottom - h.y; } });
      } else if (th.kind === 'avalanche') {
        th.level = cl(th.timer / 12, 0, 1);
        if (th.timer > 4 && th.phase === 'calm') th.phase = 'warning'; // eight-second visual/audio warning
        if (th.timer > 12 && th.phase !== 'active') { th.phase = 'active'; th.frontX = 2250; A.hurt(); }
        if (th.phase === 'active') {
          const safe = world.platforms.some(p => p.h < 40 && p.w >= 150 && player.x > p.x && player.x < p.x + p.w && player.y - player.h >= p.y + p.h && player.y <= p.y + 160);
          if (safe) {
            if (th.frontX > player.x + 100) { world.avalancheCleared = true; th.phase = 'calm'; th.level = 0; } else th.frontX += 250 * dt;
          } else {
            th.frontX += (215 + th.level * 35) * dt;
            if (th.frontX > player.x - 32 && player.invinc <= 0) hurt(true);
          }
        }
      } else {
        th.level = cl(th.timer / 105, 0, 1); th.phase = th.level > 0.7 ? 'warning' : 'calm';
        // Wolf/eagle pressure is expressed through their AI, not unavoidable periodic damage.
      }

      if (respawned) return false;
      // world progression: portal is always usable (smooth pass-through); tasks give bonus + feedback
      const done = world.rescued >= def.goalS && world.solved >= def.goalP;
      if (done && !world.completionAwarded) { world.completionAwarded = true; st.wCoins += 10; A.portal(); burst(player.x, player.y - 30, '#34d399', 20); persist(); }
      world.opened = true; // Rescue totals determine the ending. Animals never gate the route.
      // success / portal
      if (def.id === 'snow' && player.x > 4560 && player.grounded) { persist(wi, true); setTotalCoins(st.totalCoins + st.wCoins); stopped = true; setScreen('complete'); return false; }
      if (def.portal.w > 0 && hit(pR(player), def.portal)) { const next = wi + 1; persist(Math.min(next, WORLDS.length - 1)); setTotalCoins(st.totalCoins + st.wCoins); stopped = true; setWi(next); setScreen('transition'); return false; }
      if (player.y > H + 80) hurt(true);
      if (respawned) return false;
      if (player.invinc > 0) player.invinc -= dt; if (player.hitFlash > 0) player.hitFlash -= dt;

      // particles
      pT -= dt; if (pT <= 0) { pT = 0.07; const kk = def.pType; if (kk === 'snow') world.particles.push({ x: cx + Math.random() * W, y: cy - 10, vx: -18 + Math.random() * 8, vy: 40 + Math.random() * 30, life: 6, max: 6, size: 2 + Math.random() * 2, color: pal.particle, kind: 'snow' }); if (kk === 'leaf') world.particles.push({ x: cx + Math.random() * W, y: cy - 10, vx: -25 + Math.random() * 25, vy: 25 + Math.random() * 15, life: 7, max: 7, size: 3 + Math.random() * 2, color: pal.particle, kind: 'leaf' }); if (kk === 'mist') world.particles.push({ x: cx + Math.random() * W, y: cy + H * 0.7 + Math.random() * 120, vx: 30 + Math.random() * 20, vy: 0, life: 5, max: 5, size: 30 + Math.random() * 20, color: pal.particle, kind: 'mist' }); }
      for (let i = world.particles.length - 1; i >= 0; i--) { const p = world.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.kind === 'leaf') p.vx += Math.sin(p.life * 4) * 18 * dt; if (p.life <= 0) world.particles.splice(i, 1); }

      // anim
      if (player.dashT <= 0 && player.punchT <= 0) { if (!player.grounded) player.state = player.vy < 0 ? 'jump' : 'fall'; else if (Math.abs(player.vx) > 10) { const sp = Math.abs(player.vx) / MAXSPD; player.state = sp > 0.6 ? 'run' : 'walk'; player.anim += dt * 14 * sp; player.stepT += dt * sp; if (player.stepT > 0.24) { A.land(); player.stepT = 0; } } else { player.state = 'idle'; player.anim += dt; player.stepT = 0; } }

      if (Math.floor(clock.time * 5) !== Math.floor((clock.time - dt) * 5)) setHud({ hp: player.hp, coins: st.totalCoins + st.wCoins, sheep: world.rescued, solved: world.solved, deaths: st.deaths });
    };
    const render = (time: number, alpha: number) => {
      const cx = Math.round(st.camX), cy = Math.round(st.camY), mp = world.mplatforms;
      const solids = [...world.platforms.filter(p => !(p.type === 'break' && p.broken)), ...mp, ...world.elevators, ...world.doors.filter(d => !d.open), ...world.boxes, ...world.bridges.map(bridgeSolid)];
      // ===== RENDER =====
      ctx.clearRect(0, 0, W, H);
      drawSky(ctx, cx, pal, def.id); drawMountains(ctx, cx, pal);
      if (def.id === 'snow') { [200, 850, 1750, 2650, 3550].forEach((px, i) => { ctx.fillStyle = '#dce8f0'; ctx.beginPath(); ctx.moveTo(px - cx * 0.22, H); ctx.lineTo(px - cx * 0.22 + 80, H - 210 - (i % 2) * 40); ctx.lineTo(px - cx * 0.22 + 160, H); ctx.fill(); }); }
      drawFog(ctx, cx, cy, pal, motionRef.current ? 0 : 1 + world.threat.level * 0.6);
      ctx.save(); ctx.translate(-cx, -cy);
      // cedar trees anchored to actual platforms (no floating)
      if (def.id === 'cedar') { [380, 760, 1450, 2200, 2900, 3600, 4200].forEach((tx, i) => { const base = topAt(world.platforms, tx, 12); if (base !== null) cedar(ctx, tx, base, 170 + (i % 2) * 35, i % 2 ? '#214a36' : '#2c5a3e'); }); }
      for (const h of world.hazards) drawHazard(ctx, h, time);
      for (const p of world.platforms) { if (p.type === 'break' && p.broken && (p.breakT ?? 0) <= 0) continue; drawPlatform(ctx, p, pal, def.id); }
      for (const m of mp) { ctx.fillStyle = pal.accent; ctx.fillRect(Math.round(m.x), Math.round(m.y), m.w, m.h); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(Math.round(m.x), Math.round(m.y), m.w, 4); }
      // elevators: wooden platform on a vertical rail, linked to a weight plate
      for (const ev of world.elevators) {
        ctx.strokeStyle = '#4a3a24'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(ev.x - 4, ev.baseY); ctx.lineTo(ev.x - 4, ev.topY); ctx.moveTo(ev.x + ev.w + 4, ev.baseY); ctx.lineTo(ev.x + ev.w + 4, ev.topY); ctx.stroke();
        const plate = world.plates.find(p => p.id === ev.plateId); if (plate) { ctx.beginPath(); ctx.moveTo(plate.x + plate.w / 2, plate.y); ctx.lineTo(plate.x + plate.w / 2, ev.topY - 30); ctx.lineTo(ev.x + ev.w / 2, ev.topY - 30); ctx.lineTo(ev.x + ev.w / 2, ev.y); ctx.stroke(); }
        ctx.fillStyle = '#795330'; ctx.fillRect(Math.round(ev.x), Math.round(ev.y), ev.w, ev.h);
        ctx.fillStyle = '#9a7042'; ctx.fillRect(Math.round(ev.x + 3), Math.round(ev.y + 3), ev.w - 6, 3);
        ctx.fillStyle = '#5a3a20'; ctx.fillRect(Math.round(ev.x + ev.w / 2 - 2), Math.round(ev.y), 4, ev.h);
      }
      // visible mechanical cable tells the player exactly what a distant target controls
      for (const l of world.levers) { if (l.bridgeId !== undefined) { const br = world.bridges.find((b: Bridge) => b.id === l.bridgeId); if (br) { ctx.strokeStyle = 'rgba(212,168,87,0.45)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(l.x, l.y - 22); ctx.lineTo(br.x, br.y); ctx.stroke(); ctx.setLineDash([]); } } }
      for (const b of world.bridges) { drawBridge(ctx, b); if (b.progress < 1) { ctx.fillStyle = '#604932'; ctx.fillRect(b.x - b.h / 2, b.y, b.h, H + 200 - b.y); } }
      for (const l of world.levers) drawLever(ctx, l);
      for (const pl of world.plates) drawPlate(ctx, pl);
      for (const d of world.doors) {
        const ctrl = world.levers.find((l: Lever) => l.lid === d.id); const plateCtrl = world.plates.find((p: Plate) => p.lid === d.id);
        const glyph = ctrl?.seq ? String(ctrl.seq) : ctrl?.timed ? '⏱' : plateCtrl ? '⚖' : '';
        drawDoor(ctx, d, glyph);
        if (d.timer !== undefined) { ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${Math.max(0, d.timer).toFixed(1)}s`, d.x + d.w / 2, Math.max(70, d.y - 8)); }
      }
      for (const c of world.checkpoints) drawCheck(ctx, c);
      for (const c of world.coins) { if (c.got) continue; const by = c.y + Math.sin(c.bob * 3) * 4; ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(c.x, by, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(c.x - 2, by - 2, 2.5, 0, Math.PI * 2); ctx.fill(); }
      for (const s of world.sheep) if (!s.rescued) drawSheep(ctx, s);
      for (const r of world.rocks) { ctx.fillStyle = '#7a7060'; ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), Math.round(r.r), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9a9080'; ctx.beginPath(); ctx.arc(Math.round(r.x - 2), Math.round(r.y - 2), 2, 0, Math.PI * 2); ctx.fill(); }
      for (const b of world.boxes) { ctx.fillStyle = '#6a4a30'; ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h); ctx.fillStyle = '#8a6a4a'; ctx.fillRect(Math.round(b.x + 4), Math.round(b.y + 4), b.w - 8, b.h - 8); ctx.strokeStyle = '#4a2e1c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.moveTo(b.x + b.w, b.y); ctx.lineTo(b.x, b.y + b.h); ctx.stroke(); }
      for (const hb of world.hanging) { if (!hb.hit) { ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hb.x + hb.w / 2, hb.y - 70); ctx.lineTo(hb.x + hb.w / 2, hb.y); ctx.stroke(); ctx.fillStyle = '#5a3a2a'; ctx.fillRect(Math.round(hb.x), Math.round(hb.y), hb.w, hb.h); } }
      for (const e of world.enemies) { if (e.state === 'dead' && e.deadT <= 0) continue; drawEnemy(ctx, e); }
      for (const p of world.projectiles) drawProj(ctx, p);
      if (def.portal.w > 0) drawPortal(ctx, def.portal, time, pal, world.opened);
      drawPlayer(ctx, { ...player, x: (player.prevX ?? player.x) + (player.x - (player.prevX ?? player.x)) * alpha, y: (player.prevY ?? player.y) + (player.y - (player.prevY ?? player.y)) * alpha }, solids);
      for (const p of motionRef.current ? [] : world.particles) { const a = Math.max(0, p.life / p.max); ctx.globalAlpha = a * (p.kind === 'mist' ? 0.2 : 1); ctx.fillStyle = p.color; if (p.kind === 'mist') { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }
      ctx.globalAlpha = 1; ctx.restore();
      // Avalanche is visible, telegraphed, and escapable; checkpoints act as shelters.
      if (def.id === 'snow' && world.threat.phase === 'warning') {
        const pulse = 0.35 + Math.sin(time / 160) * 0.18;
        ctx.fillStyle = `rgba(220,240,250,${pulse})`; ctx.fillRect(0, 0, W, 5);
        ctx.fillStyle = '#e0f2fe'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text(lang, 'avalanche'), W / 2, 92);
      }
      if (def.id === 'snow' && world.threat.phase === 'active') {
        const fx = world.threat.frontX - cx;
        const grad = ctx.createLinearGradient(Math.max(0, fx - 230), 0, fx + 30, 0);
        grad.addColorStop(0, 'rgba(210,232,244,0.2)'); grad.addColorStop(1, 'rgba(245,252,255,0.92)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, Math.max(0, fx + 30), H);
        ctx.fillStyle = 'rgba(245,252,255,0.9)';
        for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(fx - (i % 3) * 18, H - 70 - Math.floor(i / 3) * 35 + Math.sin(time / 90 + i) * 8, 45 + (i % 2) * 18, 0, Math.PI * 2); ctx.fill(); }
      }
      // threat vignette
      if (world.threat.level > 0.3) { ctx.fillStyle = `rgba(0,0,0,${world.threat.level * 0.18})`; ctx.fillRect(0, 0, W, H); }
      // contextual puzzle affordances: clear goal, no pixel-hunt ambiguity
      const nearTarget = world.levers.find((l: Lever) => l.target && !l.on && Math.abs(player.x - l.x) < 360);
      const nearPlate = world.plates.find((pl: Plate) => !pl.solved && Math.abs(player.x - pl.x) < 250);
      const nextSeq = world.levers.find((l: Lever) => l.seq === world.seqProgress + 1 && !l.on && Math.abs(player.x - l.x) < 280);
      if (world.seqFailed || nearTarget || nearPlate || nextSeq) {
        const msg = world.seqFailed ? text(lang, 'sequenceWrong') : nearTarget ? text(lang, 'targetHint') : nearPlate ? text(lang, 'plateHint') : `${text(lang, 'sequenceHint')}: ${nextSeq?.seq}`;
        ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(100, H - 76, W - 200, 30);
        ctx.fillStyle = '#f5e6c8'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(msg, W / 2, H - 58);
      }
      // progress hint near portal (encouraging, not blocking)
      if (def.portal.w > 0 && Math.abs(player.x - def.portal.x) < 130) {
        const pct = Math.min(100, Math.round(((world.rescued / def.goalS) + (world.solved / def.goalP)) / 2 * 100));
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 140, H - 48, 280, 30);
        ctx.fillStyle = pct >= 100 ? '#34d399' : '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`${text(lang, 'progress')}: ${pct}% · ${text(lang, 'exit')}`, W / 2, H - 30);
      }

    };
    const frame = (time: number) => {
      const seconds = (time - last) / 1000; last = time;
      if (seconds > 0.5) { persist(); setScreen('paused'); A.pause(); return; }
      clock.advance(seconds, tick);
      if (stopped) return;
      render(motionRef.current ? 0 : time, clock.debt * 60);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); pressed.clear(); held.current.clear(); pendingActions.current.clear(); player.charging = false; player.power = 0; cancelAnimationFrame(raf); };
  }, [screen, wi, bindings, lang]);

  const settings = <Settings lang={lang} music={musicVolume} sfx={sfxVolume} motion={reducedMotion} large={large} challenge={challenge} bindings={bindings} onMusic={setMusicVolume} onSfx={setSfxVolume} onMotion={setReducedMotion} onLarge={setLarge} onChallenge={setChallenge} onBindings={setBindings} />;
  const shell = (content: React.ReactNode) => <main className={`app-shell screen-${screen} ${large ? 'large-text' : ''} ${reducedMotion ? 'reduced-motion' : ''}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>{notice && <p className="notice" role="status">{t(notice)}</p>}{content}</main>;
  const exportSave = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(saveRef.current, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'amksa-save.json'; a.click(); URL.revokeObjectURL(url); };
  const saveTools = <div className="save-tools"><button onClick={exportSave}>{t('export')}</button><label className="file-button">{t('import')}<input type="file" accept="application/json,.json" onChange={async e => { const file = e.target.files?.[0]; if (!file || file.size > 100000) { setNotice('importFailed'); return; } const value = parseSave(await file.text()); if (!value) { setNotice('importFailed'); return; } if (!writeSave(browserStorage, value)) { setNotice('saveFailed'); return; } saveRef.current = value; setHasSave(true); setNotice('imported'); }} /></label></div>;
  if (screen === 'title') return shell(<section className="panel title-panel" data-testid="title-screen">
    <header className="title-nav">
      <span className="wordmark"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m4 29 13-19 8 11 4-6 8 14H4Z"/><path d="m13 16 4 6 4-6M9 34h23"/></svg><span>AMKSA<small>{t('region')}</small></span></span>
      <div className="language-picker" aria-label={t('language')}>{(['ar', 'en', 'fr'] as Lang[]).map(l => <button key={l} lang={l} aria-pressed={l === lang} onClick={() => setLang(l)}>{({ ar: 'العربية', en: 'English', fr: 'Français' })[l]}</button>)}</div>
    </header>
    <div className="hero-layout">
      <div className="vista-caption"><span className="compass" aria-hidden="true">✧</span><span>{t('landscape')}<small>{t('journeyType')}</small></span></div>
      <div className="hero-copy" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <p className="eyebrow"><span />{t('journeyType')}</p>
        <h1 className="hero-name">{t('brand')}</h1><h2>{t('journeyName')}</h2><p className="lead">{t('subtitle')}</p>
        <div className="actions hero-actions"><button className="primary" data-testid="new-game" onClick={() => start(false)}>{t('start')}<span aria-hidden="true">{lang === 'ar' ? '←' : '→'}</span></button>{hasSave && <button data-testid="continue" onClick={() => start(true)}>{t('resume')}</button>}</div>
        {confirmNew && <div className="confirmation" role="alertdialog" aria-label={t('erase')}><p>{t('erase')}</p><button onClick={() => setConfirmNew(false)}>{t('cancel')}</button><button data-testid="confirm-new" onClick={() => start(false)}>{t('confirm')}</button></div>}
        {hasSave && <><button onClick={() => setChapters(v => !v)}>{t('chapters')}</button>{chapters && <div className="actions">{WORLDS.map((f, i) => i <= saveRef.current.unlocked && <button key={i} onClick={() => start(true, i)}>{t(f().id)}</button>)}</div>}</>}
        {settings}
      </div>
    </div>
    <ol className="journey-route" aria-label={t('landscape')}>{(['cedar', 'pasture', 'gorge', 'snow']).map((id, i) => <li key={id}><span aria-hidden="true">0{i + 1}</span><span>{t(id)}</span><i aria-hidden="true" /></li>)}</ol>
    <footer className="title-footer"><p>{t('policy')}</p>{saveTools}</footer>
  </section>);
  if (screen === 'intro') return shell(<section className="panel" data-testid="intro-screen"><p className="eyebrow">AMKSA</p><h1>{t('title')}</h1><p className="story">{STORY[storyIdx][lang]}</p><progress value={storyIdx + 1} max={STORY.length} aria-label={t('progress')} /><div className="actions"><button onClick={() => setScreen('transition')} data-testid="skip-intro">{t('skip')}</button><button className="primary" onClick={() => storyIdx < STORY.length - 1 ? setStoryIdx(i => i + 1) : setScreen('transition')}>{t('next')}</button></div></section>);
  if (screen === 'transition') return shell(<section className="panel"><h1>{t(MOODS[wi])}</h1><p>{wi + 1} / 4</p></section>);
  if (screen === 'puzzle' && activePuzzle) return shell(<PuzzlePanel key={activePuzzle.id} puzzle={activePuzzle} lang={lang} onBack={() => { setScreen('playing'); setActivePuzzle(null); }} onSolve={() => { const w = S.current?.world; const l = w?.levers.find(v => v.id === puzzleLever); if (w && l) activate(w, l, 'puzzle'); persist(); A.task(); setActivePuzzle(null); setScreen('playing'); }} />);
  if (screen === 'complete') {
    const rescued = WORLDS.reduce((n, f) => { const d = f(); return n + d.sheep.filter(s => saveRef.current.rooms[d.id]?.sheep.includes(s.id)).length; }, 0);
    const total = WORLDS.reduce((n, f) => n + f().sheep.length, 0);
    return shell(<section className="panel" data-testid="journey-result"><p className="eyebrow">AMKSA</p><h1>{t('finish')}</h1><p className="lead" data-testid="ending-message">{t(ending(rescued, total))}</p><p>{t('sheep')}: {rescued} / {total}</p><p>{t('coins')}: {totalCoins}</p><button className="primary" onClick={() => setScreen('title')}>{t('back')}</button></section>);
  }
  if (screen === 'reset') return shell(<section className="panel"><h1>{t('resetTitle')}</h1><p>{t('challenge')}</p><button className="primary" onClick={() => { const id = WORLDS[wi]().id; const previous = saveRef.current.rooms[id]; if (previous) saveRef.current.rooms[id] = { ...previous, checkpoint: 0, awards: [], levers: [], doors: [], bridges: [], seqProgress: 0, seqSolved: false }; setTotalCoins(saveRef.current.coins); writeSave(browserStorage, saveRef.current); S.current = null; setScreen('transition'); }}>{t('start')}</button><button onClick={() => setScreen('title')}>{t('back')}</button></section>);
  const touch = (action: Action) => <button key={action} aria-label={t(action)} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); held.current.add(action); pendingActions.current.add(action); }} onPointerUp={() => held.current.delete(action)} onPointerCancel={() => held.current.delete(action)} onLostPointerCapture={() => held.current.delete(action)}>{t(action)}</button>;
  const def = S.current?.world.def;
  return shell(<div className="game-layout" data-testid={screen === 'paused' ? 'paused-screen' : 'playing-screen'}>
    <header className="hud"><strong><small>AMKSA · 0{wi + 1}</small>{t(MOODS[wi])}</strong><span className="health-stat"><small>{t('health')}</small><b role="img" aria-label={`${t('health')}: ${hud.hp}/3`}>{Array.from({ length: 3 }, (_, i) => <i key={i} className={i < hud.hp ? 'heart active' : 'heart'} aria-hidden="true">♥</i>)}</b></span><span><small>{t('sheep')}</small><b dir="ltr">{hud.sheep}<em> / {def?.goalS}</em></b></span><span><small>{t('puzzles')}</small><b dir="ltr">{hud.solved}<em> / {def?.goalP}</em></b></span><span><small>{t('coins')}</small><b>{hud.coins}</b></span><span className="deaths-stat"><small>{t('deaths')}</small><b>{hud.deaths}</b></span><button data-testid="pause-game" onClick={() => { persist(); held.current.clear(); A.pause(); setScreen('paused'); }}>{t('pause')}</button></header>
    <div className="game-frame"><canvas ref={ref} width={W} height={H} aria-label={t('title')} data-testid="game-canvas" />{screen === 'paused' && <div className="pause-overlay"><section className="panel" role="dialog" aria-modal="true" aria-label={t('paused')}><h1>{t('paused')}</h1><div className="actions"><button className="primary" onClick={() => { A.resume(); setScreen('playing'); }}>{t('resume')}</button><button onClick={resetRoom}>{t('reset')}</button><button onClick={() => { persist(); setTotalCoins(saveRef.current.coins); setScreen('title'); }}>{t('menu')}</button></div>{settings}<p>{t('policy')}</p></section></div>}</div>
    <p className="controls-help">{t('controls')} {t('rockCache')}</p>
    {screen === 'playing' && <div className="touch-controls" data-testid="touch-controls">{(['left', 'right', 'jump', 'interact', 'aim', 'up', 'down', 'quick', 'dash', 'punch'] as Action[]).map(touch)}</div>}
  </div>);
}
