import React, { useEffect, useRef, useState } from 'react';
import type { Player, Rock, Plat, Lever, Door, Bridge, Check, Portal, Enemy, Proj, Haz, Pal } from './game/types';
import { A, type MusicState, type Surface } from './game/audio';
import { drawSky, drawMountains, cedar, drawPlatform, drawSheep, drawDecor, drawSluice, drawFloater, drawBell, drawPlate, drawAnimalCue, drawShelterHint } from './game/art';
import { PUZZLES, WORLDS, MOODS, type LogicPuzzle } from './game/content';
import { FixedClock, bridgeSolid, strikeEnemy, activate, damageEnemy, downwardContact, ending, launch, movePlatform, projectileStep, trajectory } from './game/rules';
import { createPlayer, createWorld, resetResources, snapshot, currentRoom, objective, type Session } from './game/world';
import { PHYS, stepPlayer, playerRect } from './game/physics';
import { updateAnimal, distract, scare, isHostile } from './game/animals';
import { stepSheep } from './game/sheep';
import { stepPlates, placeStone, toggleSluice, stepWater, stepCracks, stepTriggers, stepFlood, resetFlood, stepAvalanche, inShelter } from './game/mechanisms';
import { drawPrologue, drawEnding } from './game/scenes';
import { text } from './game/i18n';
import { Settings, PuzzlePanel, HintPanel, type TouchSize } from './game/ui';
import { canonicalCode, defaultBindings, type Action, type Bindings } from './game/input';
import { browserStorage, emptySave, eraseSave, loadSave, writeSave, parseSave, loadSettings, writeSettings, type Save } from './game/save';


// ============================================================
//  ⴰⵎⴽⵙⴰ — AMKSA  (The Shepherd)  — v3 redesign
//  A Limbo-style atmospheric puzzle-platformer set in the
//  Middle Atlas (Béni Mellal – Khénifra), Morocco.
// ============================================================

// Throw
const ROCK_BOUNCE = 0.34;
const ROCK_FRIC = 240;
const CHARGE_SPD = 1.7;

// Defensive push. It is never required to progress.
const PUNCH_CD = 0.45;

const W = 1024, H = 576, MAXHP = 3, GY = 470;

// ---- helpers ----
const pR = (p: Player) => ({ x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h });
const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
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
    const { x, y, w, h: depth } = h;
    ctx.save();
    // The same rectangle drives damage. No wave, foam, or reflection can escape it.
    ctx.beginPath(); ctx.rect(x, y, w, depth); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + depth);
    g.addColorStop(0, '#52b6bd'); g.addColorStop(0.28, '#267e8a'); g.addColorStop(1, '#123e50');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, depth);
    // Keep the depth gradient visible. Ripples are strokes, not opaque body fills.
    ctx.fillStyle = '#c8eee5'; ctx.fillRect(x, y, w, 1.5);
    for (let row = 0; row < 5; row++) {
      ctx.strokeStyle = row === 0 ? '#d8f3e6aa' : '#bce8df40'; ctx.lineWidth = row === 0 ? 1.5 : 1;
      for (let i = -50; i < w; i += 72) {
        const rx = x + i + (t / (32 + row * 8)) % 72;
        const ry = y + 5 + row * 13;
        ctx.beginPath(); ctx.moveTo(rx, ry);
        ctx.quadraticCurveTo(rx + 12, ry + Math.sin(t / 350 + i + row) * 2, rx + 30, ry); ctx.stroke();
      }
    }
    // Small foam fragments show the current without obscuring the surface boundary.
    ctx.fillStyle = '#e0f5e7b0';
    for (let i = 0; i < w; i += 49) {
      ctx.fillRect(x + (i + t / 45) % w, y + 2 + Math.sin(i) * 0.5, 8, 1);
    }
    ctx.restore();
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
    // Unmistakable target: a bright disc. A hanging target shows its cord; a wall target shows its peg.
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath();
    if (l.face) { ctx.moveTo(l.x + 8, l.y - 22); ctx.lineTo(l.x + 20, l.y - 22); } else { ctx.moveTo(l.x, l.y - 160); ctx.lineTo(l.x, l.y - 34); }
    ctx.stroke();
    ctx.fillStyle = l.on ? '#34d399' : '#d4a857'; ctx.beginPath(); ctx.arc(l.x, l.y - 22, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2414'; ctx.beginPath(); ctx.arc(l.x, l.y - 22, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = l.on ? '#34d399' : '#f5d889'; ctx.beginPath(); ctx.arc(l.x, l.y - 22, 3, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(l.x - 3, l.y - 30, 6, 30);
  ctx.strokeStyle = l.on ? pal_accent : '#8a7a5a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(l.x, l.y - 26); ctx.lineTo(l.x + (l.on ? 14 : -14), l.y - 36); ctx.stroke();
  ctx.fillStyle = l.on ? pal_accent : '#6a5a3a'; ctx.beginPath(); ctx.arc(l.x + (l.on ? 14 : -14), l.y - 36, 5, 0, Math.PI * 2); ctx.fill();
  if (l.puzzleId !== undefined && !l.solved) { ctx.fillStyle = '#8ac0e0'; ctx.beginPath(); ctx.arc(l.x, l.y - 52, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#12261e'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', l.x, l.y - 48); }
}
const pal_accent = '#d4a857';
function drawBridge(ctx: CanvasRenderingContext2D, b: Bridge) {
  ctx.save();
  ctx.translate(b.x, b.y + b.h / 2);
  // A right-hinged deck lowers to the left, so it mirrors the left-hinged drawing.
  if (b.hinge === 'right') ctx.scale(-1, 1);
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
  const ls = e.vx !== 0 ? Math.sin(Date.now() / 90) * 6 : 0;

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
function drawProj(ctx: CanvasRenderingContext2D, p: Proj) { ctx.fillStyle = '#8a8274'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.fillRect(-p.r, -2, p.r * 2, 4); ctx.restore(); }

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
  else if (p.state === 'push') { legL = Math.sin(t) * 6 - 4; legR = Math.sin(t + Math.PI) * 6 - 4; tilt = 0.22; }
  else if (p.state === 'calm') { legL = -3; legR = 5; bodyY = 3; tilt = 0.18; }
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
  if (p.state === 'calm') { ctx.strokeStyle = '#c8946a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, -14); ctx.lineTo(19, -6); ctx.stroke(); }
  if (p.state === 'punch') { ctx.fillStyle = '#c8946a'; ctx.beginPath(); ctx.arc(18, -8, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#a8784a'; ctx.fillRect(15, -11, 4, 2); }
  else if (p.rockN > 0) { ctx.fillStyle = '#7a7060'; ctx.beginPath(); ctx.arc(13, -8, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9a9080'; ctx.beginPath(); ctx.arc(12, -9, 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore(); ctx.restore();
}
// ============================================================
//  Component
// ============================================================
type Screen = 'title' | 'intro' | 'transition' | 'playing' | 'complete' | 'reset' | 'puzzle' | 'paused';
type Lang = 'ar' | 'en' | 'fr';
type Cause = 'deathWater' | 'deathFall' | 'deathAnimal' | 'deathSnow' | 'deathSpike';
const PROLOGUE = ['prologue1', 'prologue2', 'prologue3', 'prologue4'];
const ACTIONS = Object.keys(defaultBindings) as Action[];
const surfaceOf = (id: string, p: Plat | null | undefined): Surface => !p ? 'wood' : id === 'snow' || p.type === 'ice' || p.type === 'crack' ? 'snow' : p.type === 'ground' && (id === 'cedar' || id === 'pasture') ? 'dirt' : 'rock';

/** One bell per main sheep: filled when that sheep is home. */
function FlockBells({ lang, rooms }: { lang: Lang; rooms: Save['rooms'] }) {
  return <ol className="flock-bells" aria-label={text(lang, 'sheep')}>{WORLDS.map(f => { const d = f(); return <li key={d.id}><span>{text(lang, d.id)}</span>{d.sheep.map(s => { const home = !!rooms[d.id]?.sheep.includes(s.id); return <i key={s.id} className={home ? 'home' : ''} role="img" aria-label={home ? '✓' : '○'}>🔔</i>; })}</li>; })}</ol>;
}

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLCanvasElement>(null);
  const stored = useRef(loadSettings(browserStorage, ACTIONS));
  const [screen, setScreen] = useState<Screen>('title');
  const [lang, setLang] = useState<Lang>(stored.current?.lang ?? 'ar');
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
  const [challenge, setChallenge] = useState(stored.current?.challenge ?? false);
  const challengeRef = useRef(false);
  useEffect(() => { challengeRef.current = challenge; }, [challenge]);
  const [hud, setHud] = useState({ hp: 3, coins: 0, sheep: 0, solved: 0, deaths: 0, stones: 4, goal: '', threat: '' });
  const [musicVolume, setMusicVolume] = useState(stored.current?.music ?? 0.4);
  const [sfxVolume, setSfxVolume] = useState(stored.current?.sfx ?? 0.6);
  const [reducedMotion, setReducedMotion] = useState(() => stored.current?.motion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const motionRef = useRef(reducedMotion);
  const [shake, setShake] = useState(stored.current?.shake ?? true);
  const shakeRef = useRef(shake); useEffect(() => { shakeRef.current = shake; }, [shake]);
  const [touchSize, setTouchSize] = useState<TouchSize>(stored.current?.touchSize ?? 'medium');
  const [touchOpacity, setTouchOpacity] = useState(stored.current?.touchOpacity ?? 0.9);
  const [confirmNew, setConfirmNew] = useState(false);
  const [chapters, setChapters] = useState(false);
  const [large, setLarge] = useState(stored.current?.large ?? false);
  const [bindings, setBindings] = useState<Bindings>(() => ({ ...defaultBindings, ...(stored.current?.bindings as Partial<Bindings> | undefined) }));
  const [hintTier, setHintTier] = useState(0);
  const [hintRoom, setHintRoom] = useState<[string, string, string] | null>(null);
  const [endRescued, setEndRescued] = useState(0);
  const held = useRef<Set<Action>>(new Set());
  const pendingActions = useRef<Set<Action>>(new Set());
  const t = (key: string) => text(lang, key);
  useEffect(() => { motionRef.current = reducedMotion; }, [reducedMotion]);
  useEffect(() => { A.volume(musicVolume, sfxVolume); }, [musicVolume, sfxVolume, screen]);
  useEffect(() => { writeSettings(browserStorage, { lang, music: musicVolume, sfx: sfxVolume, motion: reducedMotion, large, challenge, shake, touchSize, touchOpacity, bindings }); }, [lang, musicVolume, sfxVolume, reducedMotion, large, challenge, shake, touchSize, touchOpacity, bindings]);
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
    if (st.world.threat.phase !== 'cleared') st.world.threat = { kind: st.world.def.threat, timer: 0, level: 0, phase: 'calm', frontX: 0 };
    resetFlood(st.world);
    persist(); setScreen('playing'); A.resume();
  };
  const revealHint = () => { const st = S.current; if (!st) return; st.world.hintTier = Math.min(3, st.world.hintTier + 1); setHintTier(st.world.hintTier); A.hint(); };
  useEffect(() => {
    const pause = () => { if (screen === 'playing') { held.current.clear(); persist(); openPause(); } };
    const visibility = () => { if (document.hidden) { held.current.clear(); if (screen === 'intro' || screen === 'puzzle') A.pause(); pause(); } else if (screen === 'intro' || screen === 'puzzle') A.resume(); };
    const escape = (e: KeyboardEvent) => { if (e.code === 'Escape') { if (screen === 'playing') pause(); else if (screen === 'paused') { setScreen('playing'); A.resume(); } } };
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', visibility); window.addEventListener('keydown', escape); const pagehide = () => persist(); window.addEventListener('pagehide', pagehide);
    if (screen === 'title' || screen === 'reset') { A.stop(); A.pause(); }
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('keydown', escape); window.removeEventListener('pagehide', pagehide); };
  }, [screen, wi]);
  const openPause = () => {
    const st = S.current; const r = st ? currentRoom(st.world, st.player.x) : null;
    setHintRoom(r?.room.hints ?? null); setHintTier(st?.world.hintTier ?? 0); setScreen('paused'); A.pause();
  };
  useEffect(() => () => { A.stop(); A.pause(); }, []);
  useEffect(() => { if (screen !== 'intro') return; A.init(); A.startSong(); return () => A.stopSong(); }, [screen]);
  useEffect(() => {
    if (screen !== 'transition') return;
    const timer = setTimeout(() => {
      const def = WORLDS[wi](), world = createWorld(wi, saveRef.current.rooms[def.id]);
      S.current = { time: 0, world, player: createPlayer(world.def.spawnX, world.def.spawnY), camX: Math.max(0, world.def.spawnX - W / 2), camY: 0, camTX: 0, camTY: 0, deaths, totalCoins, wCoins: 0 };
      A.init(); A.music(MOODS[wi]); setScreen('playing');
    }, 700);
    return () => clearTimeout(timer);
  }, [screen, wi]);
  // Illustrated prologue and ending scenes.
  useEffect(() => {
    if ((screen !== 'intro' && screen !== 'complete') || !sceneRef.current) return;
    const ctx = sceneRef.current.getContext('2d'); if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3); sceneRef.current.width = W * dpr; sceneRef.current.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0; const t0 = performance.now();
    const total = WORLDS.reduce((n, f) => n + f().sheep.length, 0);
    if (screen === 'complete') { A.init(); A.music('menu'); A.setState('ending'); if (endRescued >= total) setTimeout(() => A.bell(1, 0.08), 7000); }
    const loop = (now: number) => {
      const still = motionRef.current;
      if (screen === 'intro') drawPrologue(ctx, storyIdx, now - t0, still); else drawEnding(ctx, endRescued, total, now - t0, still);
      if (!still) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [screen, storyIdx, endRescued]);

  useEffect(() => {
    if (screen !== 'playing' || !ref.current) return;
    const cv = ref.current, ctx = cv.getContext('2d'); if (!ctx) return;
    let raf = 0, last = performance.now(), stopped = false, respawned = false; const clock = new FixedClock(); clock.time = S.current?.time ?? 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 3); cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pressed = new Set<string>(); const k: Record<string, boolean> = {};
    // A tap shorter than one simulation step still counts: keydown queues the action like a touch press.
    const kd = (e: KeyboardEvent) => { const c = canonicalCode(e.code, bindings); if (!c) return; e.preventDefault(); pressed.add(c); const a = ACTIONS.find(v => defaultBindings[v] === c); if (a && !e.repeat) pendingActions.current.add(a); };
    const ku = (e: KeyboardEvent) => { pressed.delete(canonicalCode(e.code, bindings)); };
    window.addEventListener('keydown', kd, { passive: false }); window.addEventListener('keyup', ku);
    const pollInput = () => {
      const pad = navigator.getGamepads?.()[0];
      const gp: Partial<Record<Action, boolean>> = pad ? { left: pad.axes[0] < -0.35 || pad.buttons[14]?.pressed, right: pad.axes[0] > 0.35 || pad.buttons[15]?.pressed, jump: pad.buttons[0]?.pressed, interact: pad.buttons[2]?.pressed, dash: pad.buttons[1]?.pressed, punch: pad.buttons[3]?.pressed, aim: pad.buttons[7]?.pressed, quick: pad.buttons[5]?.pressed, up: pad.axes[1] < -0.35, down: pad.axes[1] > 0.35, hint: pad.buttons[8]?.pressed } : {};
      for (const a of ACTIONS) { const key = a === 'interact' ? 'inter' : a; const down = pressed.has(defaultBindings[a]) || held.current.has(a) || !!gp[a]; if ((down && !k[key]) || pendingActions.current.has(a)) k[key + 'JP'] = true; k[key] = down; }
      pendingActions.current.clear();
    };
    const st = S.current; if (!st) return; const { world, player } = st; const def = world.def; const pal = def.pal; let pT = 0;
    let standing: Plat | null = null, cause: Cause | null = null, shakeT = 0, rescueT = 0, ringT: Record<string, number> = {}, tabletHeard = false, lastPhase = world.threat.phase, lastRoom = '';
    const say = (key: string, seconds = 3) => { world.message = key; world.messageT = seconds; };
    const focus = (x: number, y: number, seconds = 1.2) => { if (!motionRef.current) world.cinematic = { x, y, t: seconds }; };

    const hurt = (force = false, why: Cause = 'deathAnimal') => {
      if (player.invinc > 0 || respawned) return;
      player.hp--; player.invinc = 1.1; player.hitFlash = 0.25; A.hurt(); shakeT = Math.max(shakeT, 0.2);
      player.vy = -280; player.vx = (player.faceR ? -1 : 1) * 180;
      if (player.hp > 0 && !force) return;
      respawned = true; st.deaths++; world.streak++; setDeaths(st.deaths); cause = why;
      if (challengeRef.current && world.streak >= 3) { persist(); stopped = true; A.pause(); setScreen('reset'); return; }
      Object.assign(player, createPlayer(def.spawnX, def.spawnY)); resetResources(world);
      // Solved mechanisms stay solved. Only an unfinished threat restarts from its warning.
      if (world.threat.phase !== 'cleared') world.threat = { kind: def.threat, timer: 0, level: 0, phase: 'calm', frontX: 0 };
      resetFlood(world); st.camX = Math.max(0, player.x - W / 2);
      say(why, 2.5); persist();
    };
    const burst = (x: number, y: number, col: string, n = 12, kind: 'spark' | 'dust' | 'splash' | 'chunk' = 'spark') => { if (world.particles.length > 400) return; for (let i = 0; i < n; i++) world.particles.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: -70 - Math.random() * 110, life: 0.5, max: 0.5, size: 3 + Math.random() * 3, color: col, kind }); };

    const activateLever = (lever: Lever, byRock: boolean) => {
      const result = activate(world, lever, byRock ? 'rock' : 'hand');
      if (lever.bell !== undefined && result !== 'blocked') { A.bell(lever.bell); ringT[lever.id] = 1; }
      if (result === 'puzzle') {
        const puzzle = PUZZLES[lever.puzzleId!];
        if (!puzzle) return;
        setActivePuzzle(puzzle); setPuzzleLever(lever.id);
        stopped = true; persist(); A.setState('puzzle'); setScreen('puzzle');
      } else if (result === 'activated') {
        if (lever.bell === undefined) { A.task(); burst(lever.x, lever.y - 20, pal.accent); }
        if (lever.bridgeId !== undefined) { const b = world.bridges.find(v => v.id === lever.bridgeId); if (b) { A.creak(); focus(b.hinge === 'right' ? b.x - b.w / 2 : b.x + b.w / 2, b.y, 1.6); } }
        if (lever.lid >= 0) { A.gate(); const d = world.doors.find(v => v.id === lever.lid); if (d) focus(d.x, d.y + d.h / 2, 1.2); }
        if (lever.optional && lever.puzzleId !== undefined) st.wCoins += 5;
        persist();
      } else if (result === 'wrong') { A.wrong(); say('bellWrong', 3); }
    };
    const tick = (dt: number, simulationTime: number) => {
      if (stopped) return false;
      pollInput(); st.time = simulationTime;
      const time = simulationTime * 1000; respawned = false; player.prevX = player.x; player.prevY = player.y;
      if (world.messageT > 0) world.messageT -= dt;
      if (shakeT > 0) shakeT -= dt; if (rescueT > 0) rescueT -= dt;
      for (const id in ringT) ringT[id] = Math.max(0, ringT[id] - dt);

      // Camera: smooth follow with velocity look-ahead, wider look toward an active threat, short focus shots.
      const chase = world.threat.phase === 'active' || world.threat.phase === 'warning';
      const look = (player.faceR ? 60 : -60) + cl(player.vx * 0.3, -90, 90) + (chase && (def.threat === 'avalanche' || def.threat === 'flood') ? 140 : 0);
      if (world.cinematic) { world.cinematic.t -= dt; if (world.cinematic.t <= 0 || k.jumpJP || k.dashJP) world.cinematic = null; }
      const fx = world.cinematic ? world.cinematic.x : player.x + look, fy = world.cinematic ? world.cinematic.y : player.y;
      st.camTX = cl(fx - W / 2, 0, def.width - W);
      const camTY = Math.max(-240, Math.min(0, fy - 330));
      st.camX += (st.camTX - st.camX) * Math.min(1, dt * (world.cinematic ? 3 : 6)); st.camY += (camTY - st.camY) * Math.min(1, dt * 4);
      const cx = Math.round(st.camX), cy = Math.round(st.camY);

      // Hints: one more tier per press, only for the current room.
      const room = currentRoom(world, player.x);
      if (room && room.room.id !== world.hintRoom) { world.hintRoom = room.room.id; world.hintTier = 0; }
      if (room && room.room.id !== lastRoom) { lastRoom = room.room.id; }
      if (k.hintJP && room) { world.hintTier = Math.min(3, world.hintTier + 1); A.hint(); say(room.room.hints[world.hintTier - 1], 7); }
      k.hintJP = false;

      // aim
      if (player.rockN > 0) { if (k.up) player.aim -= 2.5 * dt; if (k.down) player.aim += 2.5 * dt; player.aim = cl(player.aim, -Math.PI / 2, 0); }

      // Interact: sluice, scale, bell, lever, gate, then stones. Calling also calms a nearby sheep.
      const calling = !!k.inter;
      if (k.interJP) {
        const sluice = world.sluices.find(s => Math.abs(player.x - s.x) < 50 && Math.abs(player.y - s.y) < 40);
        const bell = world.levers.find(l => l.bell !== undefined && Math.abs(player.x - l.x) < 34 && Math.abs(player.y - l.y) < 40);
        if (sluice) { if (toggleSluice(world, sluice)) { A.task(); persist(); } else persist(); A.water(); const f = world.floaters[0]; if (f) focus(f.x + f.w / 2, 480, 2.2); }
        else if (placeStone(world, player)) A.collect();
        else if (bell) activateLever(bell, false);
        else {
          let used = false;
          world.doors.filter(d => !d.open && Math.abs(player.x - d.x) < 80).forEach(d => { const lever = world.levers.find(l => l.lid === d.id && l.timed && l.solved); if (lever) { activateLever(lever, false); used = true; } });
          world.levers.forEach((l: Lever) => { if (!l.target && l.bell === undefined && Math.abs(player.x - l.x) < 38 && Math.abs((player.y - 24) - l.y) < 50) { activateLever(l, false); used = true; } });
          if (!used) {
            let bi = -1, md = 90; world.rocks.forEach((r: Rock, i: number) => { const d = Math.hypot(r.x - player.x, r.y - player.y); if (d < md && !world.plates.some(p => p.need !== undefined && r.x > p.x && r.x < p.x + p.w && Math.abs(r.y + r.r - p.y) < 10)) { md = d; bi = i; } });
            if (bi !== -1 && player.rockN < 4) { world.rocks.splice(bi, 1); player.rockN++; player.aim = 0; A.collect(); }
            // Each mechanism keeps a renewable cache of stones, so a lost stone never blocks progress.
            else if (player.rockN === 0 && (world.levers.some(l => Math.abs(player.x - l.x) < 160) || world.plates.some(p => Math.abs(player.x - p.x) < 160))) { player.rockN = 4; A.collect(); }
          }
        }
      }
      k.interJP = false; if (stopped) return false;

      // Preview and live throws share launch() and projectileStep().
      if (k.aim && player.rockN > 0) { player.charging = true; player.power = cl(player.power + CHARGE_SPD * dt, 0, 1); }
      else if (!k.aim && player.charging) { player.charging = false; if (player.rockN > 0) { player.rockN--; world.rocks.push({ id: world.nextRockId++, ...launch(player.x, player.y, player.faceR, player.aim, player.power, player.vx) }); A.throwS(); } player.power = 0; }
      if (k.quickJP && player.rockN > 0 && !player.charging) { player.rockN--; const rock = launch(player.x, player.y, player.faceR, 0, 0.96, player.vx); world.rocks.push({ id: world.nextRockId++, ...rock }); A.throwS(); }
      k.quickJP = false;
      // Defensive push. It drives an animal back; it is never required.
      if (player.punchCD > 0) player.punchCD -= dt;
      if (k.punchJP && player.punchCD <= 0 && player.dashT <= 0) { player.attackHits = []; player.punchT = 0.18; player.punchCD = PUNCH_CD; player.state = 'punch'; A.punch(); }
      k.punchJP = false;
      if (player.punchT > 0) { player.punchT -= dt;
        for (const e of world.enemies) {
          const result = strikeEnemy(world, player, e, [...world.platforms.filter(p => !p.broken), ...world.doors.filter(d => !d.open)]);
          if (result !== 'miss') { A.enemyH(); scare(e); }
          if (result === 'killed') { burst(e.x, e.y, '#c9b8a0'); persist(); }
        }
      }

      // Timed gates close predictably and never inside a body.
      world.doors.forEach((d: Door) => {
        if (d.timer !== undefined && d.open) { d.timer -= dt; if (d.timer <= 0) { const occupied = hit(pR(player), d) || world.boxes.some(b => hit(b, d)); if (occupied) d.timer = 0.25; else { d.open = false; d.timer = undefined; world.levers.forEach((l: Lever) => { if (l.lid === d.id && l.timed) l.on = false; }); } } }
      });
      world.bridges.forEach((b: Bridge) => { b.progress = cl(b.progress + (b.down ? dt * 1.4 : -dt * 1.4), 0, 1); });
      const bridgeSolids = world.bridges.map(bridgeSolid);
      const mp = world.mplatforms;
      const fixedSolids = [...world.platforms.filter(p => !p.broken), ...bridgeSolids, ...world.doors.filter(d => !d.open)];
      mp.forEach(m => {
        const vertical = m.axis === 'y', value = vertical ? m.y : m.x;
        const lo = vertical ? m.sy! : m.sx, hi = vertical ? m.ey! : m.ex;
        const next = cl(value + m.vx * dt, lo, hi);
        movePlatform(m, vertical ? m.x : next, vertical ? next : m.y, player, world.boxes, fixedSolids);
        if (next <= lo || next >= hi) m.vx *= -1;
      });
      // Plates first, so the lift reads this step's weight. Scales latch; lift plates do not.
      const earned = stepPlates(world, player);
      if (earned.length) { A.plate(); A.gate(); const d = world.doors.find(v => world.plates.some(p => p.lid === v.id && p.solved)); if (d) focus(d.x, d.y + d.h - 120, 1.4); persist(); }
      world.elevators.forEach(ev => {
        const plate = world.plates.find(p => p.id === ev.plateId); const up = !!plate?.pressed;
        const before = ev.y; ev.vx = ev.speed;
        movePlatform(ev as Parameters<typeof movePlatform>[0], ev.x, cl(ev.y + (up ? -1 : 1) * ev.speed * dt, ev.topY, ev.baseY), player, world.boxes, fixedSolids);
        if (Math.abs(ev.y - before) > 0.1 && Math.floor(simulationTime * 4) !== Math.floor((simulationTime - dt) * 4)) A.lift();
      });
      stepWater(world, player, fixedSolids, dt);
      const solids = [...fixedSolids, ...mp, ...world.elevators, ...world.floaters];

      // Shared physics: the reachability audit runs this same function.
      let md = 0; if (k.left) md -= 1; if (k.right) md += 1;
      const wasGrounded = player.grounded;
      const move = stepPlayer(player, { move: md as -1 | 0 | 1, jumpPressed: !!k.jumpJP, jumpHeld: !!k.jump, dashPressed: !!k.dashJP }, dt, solids, world.boxes, def.width);
      k.jumpJP = false; k.dashJP = false;
      if (move.jumped) A.jump(); if (move.dashed) A.dash();
      if (player.dashT > 0 && Math.random() < 0.5) world.particles.push({ x: player.x, y: player.y - 18, vx: -player.dashDir * 50, vy: (Math.random() - 0.5) * 30, life: 0.25, max: 0.25, size: 3 + Math.random() * 2, color: pal.accent, kind: 'spark' });
      standing = player.grounded ? (move.landedOn && 'type' in move.landedOn ? move.landedOn as Plat : standing && player.grounded ? standing : null) : null;
      if (move.landed && !wasGrounded && move.impactVy > 200) { player.squash = 1.4; player.stretch = 0.6; A.step(surfaceOf(def.id, standing), move.impactVy > 700); burst(player.x, player.y, def.id === 'snow' ? '#e8f2f6' : '#8a7a5e', 4, 'dust'); }
      if (stepCracks(world.platforms, standing, player, dt)) A.crack();
      // Boxes slide with friction and fall with gravity; sub-steps prevent tunnelling.
      for (const b of world.boxes) {
        b.vx *= Math.pow(0.85, dt * 60); const boxDX = b.vx * dt; const bs = Math.max(1, Math.ceil(Math.abs(boxDX) / 7));
        for (let s = 0; s < bs; s++) { b.x += boxDX / bs; const br = { x: b.x, y: b.y, w: b.w, h: b.h }; let stop = false; for (const p of solids) { if (hit(br, p)) { if (boxDX > 0) b.x = p.x - b.w; else if (boxDX < 0) b.x = p.x + p.w; b.vx = 0; stop = true; break; } } if (stop) break; }
        b.prevY = b.y; b.vy += PHYS.gravity * dt; b.impactVy = b.vy; const boxDY = b.vy * dt; const vs = Math.max(1, Math.ceil(Math.abs(boxDY) / 7));
        for (let s = 0; s < vs; s++) { const prevBottom = b.y + b.h, prevTop = b.y; b.y += boxDY / vs; const br = { x: b.x, y: b.y, w: b.w, h: b.h }; let stop = false; for (const p of solids) { if (!hit(br, p)) continue; if (boxDY >= 0 && prevBottom <= p.y + 2) { b.y = p.y - b.h; b.impactVy = b.vy; b.vy = 0; stop = true; break; } if (boxDY < 0 && prevTop >= p.y + p.h - 2) { b.y = p.y + p.h; b.vy = 0; stop = true; break; } } if (stop) break; }
      }

      // Rocks: bounce, roll, strike targets, and distract animals where they land.
      const s2 = [...solids, ...world.boxes];
      for (let i = world.rocks.length - 1; i >= 0; i--) {
        const r = world.rocks[i]; const px = r.x, py = r.y; if (r.landed && r.vx === 0 && r.vy === 0) continue;
        projectileStep(r, dt); let struck = false;
        for (const pl of s2) { if (r.x + r.r > pl.x && r.x - r.r < pl.x + pl.w && r.y + r.r > pl.y && r.y - r.r < pl.y + pl.h) { struck = true; if (py + r.r <= pl.y && r.vy > 0) { r.y = pl.y - r.r; if (r.vy > 120) A.rockHit(def.id === 'snow' ? 'ice' : 'rock'); r.vy *= -ROCK_BOUNCE; if (Math.abs(r.vx) > 0) { r.vx -= Math.sign(r.vx) * ROCK_FRIC * dt; if (Math.abs(r.vx) < 12) r.vx = 0; } if (Math.abs(r.vy) < 50) r.vy = 0; } else if (py - r.r >= pl.y + pl.h && r.vy < 0) { r.y = pl.y + pl.h + r.r; r.vy *= -ROCK_BOUNCE; } else { if (px + r.r <= pl.x && r.vx > 0) { r.x = pl.x - r.r; r.vx *= -ROCK_BOUNCE; } else if (px - r.r >= pl.x + pl.w && r.vx < 0) { r.x = pl.x + pl.w + r.r; r.vx *= -ROCK_BOUNCE; } } } }
        world.levers.forEach((l: Lever) => { if (!l.on && l.target && Math.hypot(r.vx, r.vy) > 60 && hit({ x: r.x - r.r, y: r.y - r.r, w: r.r * 2, h: r.r * 2 }, { x: l.x - 10, y: l.y - 40, w: 28, h: 42 })) { A.rockHit('wood'); activateLever(l, true); } });
        for (const hb of world.hanging) { if (!hb.hit && hit({ x: r.x - r.r, y: r.y - r.r, w: r.r * 2, h: r.r * 2 }, hb)) { hb.hit = true; world.boxes.push({ id: `drop-${hb.x}`, x: hb.x, y: hb.y, w: hb.w, h: hb.h, vx: 0, vy: 0 }); A.rockHit('wood'); r.vy = -50; r.vx = r.vx > 0 ? -40 : 40; } }
        if (struck && !r.landed && r.vy === 0) { r.landed = true; distract(world.enemies, r.x, r.y); }
        if (r.y > H + 200) world.rocks.splice(i, 1);
      }
      if (world.rocks.length > 40) world.rocks.splice(0, world.rocks.length - 40);

      // Animals.
      const sheltered = inShelter(world, player);
      for (const e of world.enemies) {
        const ev = updateAnimal(e, { player, solids, dt, time: simulationTime, sheltered });
        if (ev.sound && Math.abs(e.x - player.x) < 700) A.animal(ev.sound);
        if (ev.hurt) hurt(false, 'deathAnimal');
        if (respawned) return false;
      }
      if (!world.warnedWolves && def.threat === 'wolfpack') { const wolf = world.enemies.find(e => e.type === 'wolf' && e.state !== 'dead'); if (wolf && player.x > wolf.sx - 260) { world.warnedWolves = true; A.animal('howl'); say('wolvesNear', 3.5); } }
      for (const e of world.enemies) {
        for (const r of world.rocks) {
          if (e.hp <= 0) break;
          const cX = cl(r.x, e.x, e.x + e.w), cY = cl(r.y, e.y, e.y + e.h);
          if ((r.x - cX) ** 2 + (r.y - cY) ** 2 < r.r * r.r && Math.hypot(r.vx, r.vy) > 90) {
            A.enemyH(); scare(e); if (damageEnemy(world, e, 1)) persist();
            r.vx = -Math.sign(r.vx) * 35; r.vy = -35;
          }
        }
        for (const b of world.boxes) { if (e.hp <= 0) break; if (downwardContact(b, (b.prevY ?? b.y) + b.h, b.impactVy ?? 0, e) && damageEnemy(world, e, e.hp)) persist(); }
      }
      // Coins.
      let collected = false;
      world.coins.forEach(c => { c.bob += dt; if (!c.got && Math.abs(player.x - c.x) < 24 && Math.abs((player.y - 22) - c.y) < 28) { c.got = true; st.wCoins++; collected = true; A.collect(); burst(c.x, c.y, pal.accent, 6); } });
      if (collected) persist();
      // Sheep: calm, then rescue. The record is saved at the moment of rescue.
      player.state === 'calm' && (player.state = 'idle');
      for (const s of world.sheep) {
        const ev = stepSheep(s, player, world.enemies, calling, dt);
        if (s.state === 'calming' && player.grounded && Math.abs(player.vx) < 40) player.state = 'calm';
        if (ev === 'rescued') { world.rescued++; persist(); A.sheep('calm'); A.bell(1, 0.06); rescueT = 3.5; burst(s.x, s.y - 20, '#f2e8cd', 14); say('rescuedMsg', 3); focus(s.x, s.y, 1.2); }
        else if (ev === 'frightened') { A.sheep('fear'); }
        else if (ev === 'bleat') A.sheep(Math.abs(s.x - player.x) > 500 ? 'far' : 'near');
      }
      // Checkpoints.
      world.checkpoints.forEach((c: Check) => { if (!c.on && Math.abs(player.x - c.x) < 38 && player.grounded) { c.on = true; A.checkpoint(); burst(c.x, c.y - 34, pal.accent, 10); def.spawnX = c.x + 60; def.spawnY = c.y; world.streak = 0; persist(); } });
      // Hazards.
      for (const h of world.hazards) { if (respawned) break; if (hit(pR(player), h) && player.invinc <= 0) { if (h.type === 'water') { A.splash(); burst(player.x, h.y, '#c8eee5', 10, 'splash'); } hurt(true, h.type === 'water' ? 'deathWater' : 'deathSpike'); } }
      if (respawned) return false;
      for (const key of stepTriggers(world, player)) { A.task(); burst(player.x, player.y - 30, pal.accent, 12); void key; persist(); }

      // Environmental threats. Each one is announced, telegraphed and escapable.
      if (def.flood && stepFlood(world, player, dt)) { A.splash(); hurt(true, 'deathWater'); }
      if (def.avalanche && stepAvalanche(world, player, dt)) hurt(true, 'deathSnow');
      if (respawned) return false;
      if (world.threat.phase !== lastPhase) {
        if (world.threat.phase === 'warning') { A.rumble(0.18); say(def.flood ? 'floodWarn' : 'avalanche', 5); shakeT = 0.6; }
        if (world.threat.phase === 'active') { A.rumble(0.35); shakeT = 1; }
        if (world.threat.phase === 'cleared') { say('shelterSafe', 2); A.task(); persist(); }
        lastPhase = world.threat.phase;
      }
      if (world.threat.phase === 'active' && def.avalanche && Math.random() < dt * 6) world.particles.push({ x: world.threat.frontX + Math.random() * 120, y: cy - 10, vx: 60, vy: 200, life: 2, max: 2, size: 6 + Math.random() * 6, color: '#f3f8fb', kind: 'chunk' });
      A.storm(world.threat.phase === 'active' ? 1 : world.threat.phase === 'warning' ? 0.5 : 0);

      if (respawned) return false;
      const done = world.rescued >= def.goalS && world.solved >= def.goalP;
      if (done && !world.completionAwarded) { world.completionAwarded = true; st.wCoins += 10; A.portal(); burst(player.x, player.y - 30, '#e8d38c', 20); say('allDone', 3); persist(); }
      world.opened = true; // Rescue totals determine the ending. Animals never gate the route.
      if (def.endX !== undefined && player.x > def.endX && player.grounded) {
        persist(wi, true); setTotalCoins(st.totalCoins + st.wCoins);
        setEndRescued(WORLDS.reduce((n, f) => { const d = f(); return n + d.sheep.filter(s => saveRef.current.rooms[d.id]?.sheep.includes(s.id)).length; }, 0));
        stopped = true; setScreen('complete'); return false;
      }
      if (def.portal.w > 0 && hit(pR(player), def.portal)) { const next = wi + 1; persist(Math.min(next, WORLDS.length - 1)); setTotalCoins(st.totalCoins + st.wCoins); stopped = true; setWi(next); setScreen('transition'); return false; }
      if (player.y > H + 80) hurt(true, 'deathFall');
      if (respawned) return false;
      if (player.invinc > 0) player.invinc -= dt; if (player.hitFlash > 0) player.hitFlash -= dt;

      // Music follows the situation: threat, shelter, rescue, nearby unsolved mechanism, or exploration.
      const nearPuzzle = room && !room.complete && (world.levers.some(l => !l.on && !l.optional && Math.abs(l.x - player.x) < 320) || world.plates.some(p => p.need !== undefined && !p.solved && Math.abs(p.x - player.x) < 300) || world.sluices.some(s => !world.awards.includes(s.award ?? '') && Math.abs(s.x - player.x) < 300));
      const wanted: MusicState = world.threat.phase === 'active' ? (sheltered ? 'shelter' : 'chase') : world.threat.phase === 'warning' ? 'warning' : rescueT > 0 ? 'rescue' : nearPuzzle ? 'puzzle' : 'explore';
      A.setState(wanted);

      // Bell tablet plays its pattern once each time the shepherd approaches it.
      const tablet = world.decor.find(d => d.kind === 'tablet');
      if (tablet) { const nearT = Math.abs(player.x - tablet.x) < 140; if (nearT && !tabletHeard) { tabletHeard = true; (tablet.data ?? []).forEach((p, i) => setTimeout(() => A.bell(p as 0 | 1 | 2, 0.05), 300 + i * 650)); } if (!nearT) tabletHeard = false; }

      // Particles, capped so long sessions do not grow memory.
      pT -= dt; if (pT <= 0 && world.particles.length < 300) { const kk = def.pType; pT = kk === 'mist' ? 0.45 : 0.07; if (kk === 'snow') world.particles.push({ x: cx + Math.random() * W, y: cy - 10, vx: -18 - world.threat.level * 120 + Math.random() * 8, vy: 40 + Math.random() * 30, life: 6, max: 6, size: 2 + Math.random() * 2, color: pal.particle, kind: 'snow' }); if (kk === 'leaf' && Math.random() < 0.35) world.particles.push({ x: cx + Math.random() * W, y: cy - 10, vx: -25 + Math.random() * 25, vy: 25 + Math.random() * 15, life: 7, max: 7, size: 3 + Math.random() * 2, color: pal.particle, kind: 'leaf' }); if (kk === 'mist') world.particles.push({ x: cx + Math.random() * W, y: cy + H * 0.7 + Math.random() * 120, vx: 30 + Math.random() * 20, vy: 0, life: 5, max: 5, size: 30 + Math.random() * 20, color: pal.particle, kind: 'mist' }); }
      for (let i = world.particles.length - 1; i >= 0; i--) { const p = world.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.kind === 'leaf') p.vx += Math.sin(p.life * 4) * 18 * dt; if (p.kind === 'dust' || p.kind === 'splash' || p.kind === 'spark') p.vy += 500 * dt; if (p.life <= 0) world.particles.splice(i, 1); }

      // Animation and footsteps.
      if (player.dashT <= 0 && player.punchT <= 0 && player.state !== 'calm') { if (!player.grounded) player.state = player.vy < 0 ? 'jump' : 'fall'; else if (move.pushed) { player.state = 'push'; player.anim += dt * 8; } else if (Math.abs(player.vx) > 10) { const sp = Math.abs(player.vx) / PHYS.maxSpeed; player.state = sp > 0.6 ? 'run' : 'walk'; player.anim += dt * 14 * sp; player.stepT += dt * sp; if (player.stepT > 0.26) { A.step(surfaceOf(def.id, standing)); player.stepT = 0; if (Math.random() < 0.4) burst(player.x, player.y, def.id === 'snow' ? '#eef5f8' : '#9a8a6a', 1, 'dust'); } } else { player.state = 'idle'; player.anim += dt; player.stepT = 0; } }

      if (Math.floor(clock.time * 5) !== Math.floor((clock.time - dt) * 5)) setHud({ hp: player.hp, coins: st.totalCoins + st.wCoins, sheep: world.rescued, solved: world.solved, deaths: st.deaths, stones: player.rockN, goal: objective(world, player.x), threat: world.threat.phase === 'warning' || world.threat.phase === 'active' ? (def.flood ? 'floodWarn' : 'avalanche') : '' });
    };
    const render = (time: number, alpha: number) => {
      const sx = shakeT > 0 && shakeRef.current && !motionRef.current ? (Math.random() - 0.5) * 8 * Math.min(1, shakeT) : 0;
      const cx = Math.round(st.camX + sx), cy = Math.round(st.camY), mp = world.mplatforms;
      const solids = [...world.platforms.filter(p => !p.broken), ...mp, ...world.elevators, ...world.floaters, ...world.doors.filter(d => !d.open), ...world.boxes, ...world.bridges.map(bridgeSolid)];
      ctx.clearRect(0, 0, W, H);
      drawSky(ctx, cx, pal, def.id);
      // Distant snow peaks sit behind the mountain layers, so they never read as foreground ice.
      if (def.id === 'snow') { ctx.globalAlpha = 0.45; [200, 850, 1750, 2650, 3550].forEach((px, i) => { const x = px - cx * 0.08; ctx.fillStyle = '#c9dbe6'; ctx.beginPath(); ctx.moveTo(x - 40, H - 150); ctx.lineTo(x + 70, H - 330 - (i % 2) * 40); ctx.lineTo(x + 180, H - 150); ctx.fill(); }); ctx.globalAlpha = 1; }
      drawMountains(ctx, cx, pal);
      drawFog(ctx, cx, cy, pal, motionRef.current ? 0 : 1 + world.threat.level * 0.6);
      ctx.save(); ctx.translate(-cx, -cy);
      if (def.id === 'cedar') { [380, 1450, 2200, 2900, 3600, 4300].forEach((tx, i) => { const base = topAt(world.platforms.filter(p => p.type === 'ground'), tx, 12); if (base !== null) cedar(ctx, tx, base, 170 + (i % 2) * 35, i % 2 ? '#214a36' : '#2c5a3e'); }); }
      if (!motionRef.current) for (const p of world.particles) { if (p.kind !== 'mist') continue; ctx.globalAlpha = Math.sin(Math.PI * cl(p.life / p.max, 0, 1)) * 0.035; ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 2.8, p.size * 0.22, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      for (const h of world.hazards) drawHazard(ctx, h, time);
      for (const p of world.platforms) drawPlatform(ctx, p, pal, def.id);
      for (const d of world.decor) drawDecor(ctx, d, time, { bellPulse: time / 800 });
      for (const f of world.floaters) drawFloater(ctx, f);
      for (const m of mp) { ctx.fillStyle = '#5a3c22'; ctx.beginPath(); ctx.roundRect(Math.round(m.x), Math.round(m.y), m.w, m.h, 6); ctx.fill(); ctx.fillStyle = '#8a644066'; ctx.fillRect(Math.round(m.x + 6), Math.round(m.y + 3), m.w - 12, 2); }
      for (const ev of world.elevators) {
        ctx.strokeStyle = '#4a3a24'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(ev.x - 4, ev.baseY); ctx.lineTo(ev.x - 4, ev.topY); ctx.moveTo(ev.x + ev.w + 4, ev.baseY); ctx.lineTo(ev.x + ev.w + 4, ev.topY); ctx.stroke();
        const plate = world.plates.find(p => p.id === ev.plateId); if (plate) { ctx.strokeStyle = '#c9a463'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(plate.x + plate.w / 2, plate.y); ctx.lineTo(plate.x + plate.w / 2, ev.topY - 30); ctx.lineTo(ev.x + ev.w / 2, ev.topY - 30); ctx.lineTo(ev.x + ev.w / 2, ev.y); ctx.stroke(); ctx.fillStyle = '#4a3a24'; ctx.beginPath(); ctx.arc(plate.x + plate.w / 2, ev.topY - 30, 6, 0, Math.PI * 2); ctx.arc(ev.x + ev.w / 2, ev.topY - 30, 6, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#795330'; ctx.fillRect(Math.round(ev.x), Math.round(ev.y), ev.w, ev.h);
        ctx.fillStyle = '#9a7042'; ctx.fillRect(Math.round(ev.x + 3), Math.round(ev.y + 3), ev.w - 6, 3);
      }
      for (const l of world.levers) { if (l.bridgeId !== undefined && l.bell === undefined) { const br = world.bridges.find((b: Bridge) => b.id === l.bridgeId); if (br) { ctx.strokeStyle = 'rgba(212,168,87,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(l.x, l.y - 22); ctx.lineTo(br.x, br.y - 6); ctx.stroke(); ctx.setLineDash([]); } } if (l.lid >= 0 && l.target) { const d = world.doors.find(v => v.id === l.lid); if (d && !d.open) { ctx.strokeStyle = 'rgba(212,168,87,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(l.x, l.y - 22); ctx.lineTo(d.x + d.w / 2, d.y + 12); ctx.stroke(); ctx.setLineDash([]); } } }
      for (const b of world.bridges) { drawBridge(ctx, b); if (b.progress < 1) { ctx.fillStyle = '#604932'; ctx.fillRect(b.x - b.h / 2, b.y, b.h, H + 200 - b.y); } }
      for (const l of world.levers) { if (l.bell !== undefined) drawBell(ctx, l, ringT[l.id] ?? 0); else drawLever(ctx, l); }
      for (const pl of world.plates) drawPlate(ctx, pl);
      for (const s of world.sluices) drawSluice(ctx, s, time);
      for (const d of world.doors) drawDoor(ctx, d);
      for (const c of world.checkpoints) drawCheck(ctx, c);
      for (const c of world.coins) { if (c.got) continue; const by = c.y + Math.sin(c.bob * 3) * 4; ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(c.x, by, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(c.x - 2, by - 2, 2.5, 0, Math.PI * 2); ctx.fill(); }
      for (const s of world.sheep) drawSheep(ctx, s, time);
      for (const r of world.rocks) { ctx.fillStyle = '#7a7060'; ctx.beginPath(); ctx.arc(Math.round(r.x), Math.round(r.y), Math.round(r.r), 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#9a9080'; ctx.beginPath(); ctx.arc(Math.round(r.x - 2), Math.round(r.y - 2), 2, 0, Math.PI * 2); ctx.fill(); }
      for (const b of world.boxes) { ctx.fillStyle = '#6a4a30'; ctx.fillRect(Math.round(b.x), Math.round(b.y), b.w, b.h); ctx.fillStyle = '#8a6a4a'; ctx.fillRect(Math.round(b.x + 4), Math.round(b.y + 4), b.w - 8, b.h - 8); ctx.strokeStyle = '#4a2e1c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.moveTo(b.x + b.w, b.y); ctx.lineTo(b.x, b.y + b.h); ctx.stroke(); ctx.fillStyle = '#e2c27a'; ctx.fillRect(Math.round(b.x + b.w / 2 - 6), Math.round(b.y - 2), 12, 3); }
      for (const hb of world.hanging) { if (!hb.hit) { ctx.strokeStyle = '#6a5a4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hb.x + hb.w / 2, hb.y - 70); ctx.lineTo(hb.x + hb.w / 2, hb.y); ctx.stroke(); ctx.fillStyle = '#5a3a2a'; ctx.fillRect(Math.round(hb.x), Math.round(hb.y), hb.w, hb.h); } }
      for (const e of world.enemies) { if (e.state === 'dead' && e.deadT <= 0) continue; const g = e.type === 'eagle' ? topAt(world.platforms, (e.diveX ?? e.x) + e.w / 2) ?? GY : e.y + e.h; drawAnimalCue(ctx, e, g, time); drawEnemy(ctx, e); }
      if (def.portal.w > 0) drawPortal(ctx, def.portal, time, pal, world.opened);
      for (const s of world.shelters) drawShelterHint(ctx, s, time, world.threat.phase === 'warning' || world.threat.phase === 'active');
      drawPlayer(ctx, { ...player, x: (player.prevX ?? player.x) + (player.x - (player.prevX ?? player.x)) * alpha, y: (player.prevY ?? player.y) + (player.y - (player.prevY ?? player.y)) * alpha }, solids);
      if (world.flood && world.flood.y < world.flood.bottom) drawHazard(ctx, { x: world.flood.x, y: world.flood.y, w: world.flood.w, h: world.flood.bottom - world.flood.y, type: 'water' }, time);
      if (world.flood && world.threat.phase !== 'calm') { ctx.strokeStyle = '#eaf6ef'; ctx.lineWidth = 2; for (const y of [world.flood.endY, GY]) { ctx.beginPath(); ctx.moveTo(world.flood.x + 6, y); ctx.lineTo(world.flood.x + 22, y); ctx.stroke(); } }
      for (const p of motionRef.current ? [] : world.particles) { if (p.kind === 'mist') continue; ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }
      ctx.globalAlpha = 1; ctx.restore();
      if (def.avalanche && world.threat.phase === 'warning') { const pulse = 0.35 + Math.sin(time / 160) * 0.18; ctx.fillStyle = `rgba(220,240,250,${pulse})`; ctx.fillRect(0, 0, W, 5); ctx.fillRect(0, 0, 5, H); }
      if (def.avalanche && world.threat.phase === 'active') {
        const fx = world.threat.frontX - cx;
        const grad = ctx.createLinearGradient(Math.max(0, fx - 230), 0, fx + 30, 0);
        grad.addColorStop(0, 'rgba(210,232,244,0.25)'); grad.addColorStop(1, 'rgba(245,252,255,0.94)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, Math.max(0, fx + 30), H);
        ctx.fillStyle = 'rgba(245,252,255,0.9)';
        for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(fx - (i % 3) * 18, H - 70 - Math.floor(i / 3) * 35 + Math.sin(time / 90 + i) * 8, 45 + (i % 2) * 18, 0, Math.PI * 2); ctx.fill(); }
      }
      if (world.threat.phase === 'warning' || world.threat.phase === 'active') { ctx.fillStyle = `rgba(0,0,0,${0.08 + world.threat.level * 0.1})`; ctx.fillRect(0, 0, W, H); }
      // One contextual line at a time: a death cause, a story beat, a hint, or the nearest interaction.
      let msg = world.messageT > 0 ? text(lang, world.message) : '';
      if (!msg) {
        const sheep = world.sheep.find(s => !s.rescued && Math.abs(s.x - player.x) < 150 && Math.abs(s.y - player.y) < 120);
        const plate = world.plates.find(p => p.need !== undefined && !p.solved && Math.abs(player.x - (p.x + p.w / 2)) < 70);
        if (sheep) msg = text(lang, sheep.state === 'fear' ? 'sheepAfraid' : 'calmSheep');
        else if (plate) msg = text(lang, 'placeStone');
        else if (world.sluices.some(s => Math.abs(player.x - s.x) < 60)) msg = text(lang, 'sluiceUse');
        else if (world.levers.some(l => l.bell !== undefined && Math.abs(player.x - l.x) < 40)) msg = text(lang, 'bellUse');
        else if (def.portal.w > 0 && Math.abs(player.x - def.portal.x) < 160) {
          const sheepLeft = def.goalS - world.rescued, puzzlesLeft = def.goalP - world.solved;
          msg = sheepLeft <= 0 && puzzlesLeft <= 0 ? text(lang, 'allDone') : `${text(lang, 'remaining')}: ${text(lang, 'sheep')} ${Math.max(0, sheepLeft)} · ${text(lang, 'puzzles')} ${Math.max(0, puzzlesLeft)} — ${text(lang, 'leaveAnyway')}`;
        }
      }
      if (msg) { ctx.font = 'bold 13px system-ui'; const w = Math.min(W - 80, ctx.measureText(msg).width + 40); ctx.fillStyle = 'rgba(8,22,20,0.72)'; ctx.fillRect(W / 2 - w / 2, H - 64, w, 32); ctx.fillStyle = '#f5e6c8'; ctx.textAlign = 'center'; ctx.fillText(msg, W / 2, H - 43, W - 100); }
    };
    const frame = (time: number) => {
      const seconds = (time - last) / 1000; last = time;
      if (seconds > 0.5) { persist(); openPause(); return; }
      clock.advance(seconds, tick);
      if (stopped) return;
      render(motionRef.current ? 0 : time, clock.debt * 60);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); pressed.clear(); held.current.clear(); pendingActions.current.clear(); player.charging = false; player.power = 0; cancelAnimationFrame(raf); };
  }, [screen, wi, bindings, lang]);

  const settings = <Settings lang={lang} music={musicVolume} sfx={sfxVolume} motion={reducedMotion} large={large} challenge={challenge} shake={shake} touchSize={touchSize} touchOpacity={touchOpacity} bindings={bindings} onMusic={setMusicVolume} onSfx={setSfxVolume} onMotion={setReducedMotion} onLarge={setLarge} onChallenge={setChallenge} onShake={setShake} onTouchSize={setTouchSize} onTouchOpacity={setTouchOpacity} onBindings={setBindings} />;
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
  if (screen === 'intro') return shell(<section className="panel scene-panel" data-testid="intro-screen"><canvas ref={sceneRef} width={W} height={H} className="scene-canvas" role="img" aria-label={t(PROLOGUE[storyIdx])} /><p className="eyebrow">AMKSA · {storyIdx + 1} / {PROLOGUE.length}</p><p className="story" aria-live="polite">{t(PROLOGUE[storyIdx])}</p><progress value={storyIdx + 1} max={PROLOGUE.length} aria-label={t('progress')} /><div className="actions"><button onClick={() => setScreen('transition')} data-testid="skip-intro">{t('skip')}</button><button className="primary" data-testid="next-intro" onClick={() => storyIdx < PROLOGUE.length - 1 ? setStoryIdx(i => i + 1) : setScreen('transition')}>{t('next')}</button></div></section>);
  if (screen === 'transition') return shell(<section className="panel"><h1>{t(MOODS[wi])}</h1><p>{wi + 1} / 4</p></section>);
  if (screen === 'puzzle' && activePuzzle) return shell(<PuzzlePanel key={activePuzzle.id} puzzle={activePuzzle} lang={lang} onBack={() => { setScreen('playing'); setActivePuzzle(null); }} onSolve={() => { const w = S.current?.world; const l = w?.levers.find(v => v.id === puzzleLever); if (w && l && activate(w, l, 'puzzle') === 'activated' && l.optional && S.current) S.current.wCoins += 5; persist(); A.task(); setActivePuzzle(null); setScreen('playing'); }} />);
  if (screen === 'complete') {
    const total = WORLDS.reduce((n, f) => n + f().sheep.length, 0), rescued = endRescued, kind = ending(rescued, total);
    return shell(<section className="panel scene-panel" data-testid="journey-result"><canvas ref={sceneRef} width={W} height={H} className="scene-canvas" role="img" aria-label={t(kind === 'all' ? 'endingAll' : kind === 'some' ? 'endingSome' : 'endingNone')} /><p className="eyebrow">AMKSA</p><h1>{t('finish')}</h1><p className="lead" data-testid="ending-message">{t(kind === 'all' ? 'endingAll' : kind === 'some' ? 'endingSome' : 'endingNone')}</p><p>{t('sheep')}: <span dir="ltr">{rescued} / {total}</span></p><p>{t('coins')}: {totalCoins}</p><button className="primary" onClick={() => setScreen('title')}>{t('replayChapters')}</button></section>);
  }
  if (screen === 'reset') return shell(<section className="panel"><h1>{t('resetTitle')}</h1><p>{t('challenge')}</p><button className="primary" onClick={() => { const id = WORLDS[wi]().id; const previous = saveRef.current.rooms[id]; if (previous) saveRef.current.rooms[id] = { ...previous, checkpoint: 0, awards: [], levers: [], doors: [], bridges: [], seqProgress: 0, seqSolved: false }; setTotalCoins(saveRef.current.coins); writeSave(browserStorage, saveRef.current); S.current = null; setScreen('transition'); }}>{t('start')}</button><button onClick={() => setScreen('title')}>{t('back')}</button></section>);
  const touch = (action: Action) => <button key={action} className={`touch-${action}`} aria-label={t(action)} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); held.current.add(action); pendingActions.current.add(action); }} onPointerUp={() => held.current.delete(action)} onPointerCancel={() => held.current.delete(action)} onLostPointerCapture={() => held.current.delete(action)}>{t(action)}</button>;
  const def = S.current?.world.def;
  return shell(<div className="game-layout" data-testid={screen === 'paused' ? 'paused-screen' : 'playing-screen'}>
    <header className="hud"><strong><small>AMKSA · 0{wi + 1}</small>{t(MOODS[wi])}</strong><span className="health-stat"><small>{t('health')}</small><b role="img" aria-label={`${t('health')}: ${hud.hp}/3`}>{Array.from({ length: 3 }, (_, i) => <i key={i} className={i < hud.hp ? 'heart active' : 'heart'} aria-hidden="true">♥</i>)}</b></span><span><small>{t('sheep')}</small><b dir="ltr">{hud.sheep}<em> / {def?.goalS}</em></b></span><span><small>{t('puzzles')}</small><b dir="ltr">{hud.solved}<em> / {def?.goalP}</em></b></span><span><small>{t('stones')}</small><b dir="ltr" data-testid="stones">{hud.stones}<em> / 4</em></b></span><span className="coins-stat"><small>{t('coins')}</small><b>{hud.coins}</b></span><button data-testid="pause-game" onClick={() => { persist(); held.current.clear(); openPause(); }}>{t('pause')}</button></header>
    <p className="objective" data-testid="objective"><small>{t('objective')}</small>{hud.goal ? t(hud.goal) : ''}{hud.threat && <b className="threat" role="alert">{t(hud.threat)}</b>}<span className="hint-key">{t('hintKey')}</span></p>
    <div className="game-frame"><canvas ref={ref} width={W} height={H} aria-label={t('title')} data-testid="game-canvas" />{screen === 'paused' && <div className="pause-overlay"><section className="panel" role="dialog" aria-modal="true" aria-label={t('paused')}><h1>{t('paused')}</h1><FlockBells lang={lang} rooms={saveRef.current.rooms} /><div className="actions"><button className="primary" onClick={() => { A.resume(); setScreen('playing'); }}>{t('resume')}</button><button onClick={resetRoom}>{t('restartRoom')}</button><button onClick={() => { persist(); setTotalCoins(saveRef.current.coins); setScreen('title'); }}>{t('menu')}</button></div><HintPanel lang={lang} hints={hintRoom} tier={hintTier} onReveal={revealHint} />{settings}<p>{t('policy')}</p></section></div>}</div>
    <p className="controls-help">{t('controls')} {t('rockCache')}</p>
    {screen === 'playing' && <div className={`touch-controls touch-${touchSize}`} style={{ opacity: touchOpacity }} data-testid="touch-controls">{(['left', 'right', 'jump', 'interact', 'aim', 'up', 'down', 'quick', 'dash', 'punch', 'hint'] as Action[]).map(touch)}</div>}
  </div>);
}
