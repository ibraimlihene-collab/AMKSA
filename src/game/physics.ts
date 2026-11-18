/** Player movement and collision shared by the live game, the reachability audit and the regression tests. */
import type { Player, Box } from './types';
import { clamp, overlap, type Rect } from './rules';

export const PHYS = {
  gravity: 2100, fallMul: 2, lowJumpMul: 2, jump: 760, doubleJump: 0.9,
  maxSpeed: 300, accel: 1500, frictionGround: 1100, frictionAir: 360,
  dashSpeed: 700, dashTime: 0.15, dashCooldown: 0.4, jumpBuffer: 0.14, coyote: 0.14,
  /** Pushing a box is slower than walking, so the box reads as heavy. */
  pushSpeed: 0.6,
} as const;

export type MoveInput = { move: -1 | 0 | 1; jumpPressed: boolean; jumpHeld: boolean; dashPressed: boolean };
export type Surface = Rect & { type?: string; broken?: boolean; breakT?: number };
export type MoveResult = { landed: boolean; impactVy: number; landedOn: Surface | Box | null; bumped: boolean; pushed: Box | null; jumped: 'single' | 'double' | null; dashed: boolean };

export const playerRect = (p: Player): Rect => ({ x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h });

/** Velocity, jump buffering, coyote time, double jump, dash and gravity. */
export function integrate(p: Player, input: MoveInput, dt: number): Pick<MoveResult, 'jumped' | 'dashed'> {
  let jumped: MoveResult['jumped'] = null, dashed = false;
  if (input.move !== 0) p.faceR = input.move > 0;
  if (p.dashCD > 0) p.dashCD -= dt;
  if (input.dashPressed && p.dashCD <= 0 && p.dashT <= 0) { p.dashT = PHYS.dashTime; p.dashCD = PHYS.dashCooldown; p.dashDir = p.faceR ? 1 : -1; p.invinc = Math.max(p.invinc, PHYS.dashTime + 0.05); dashed = true; }
  if (p.dashT > 0) { p.dashT -= dt; p.vx = p.dashDir * PHYS.dashSpeed; p.vy = 0; p.state = 'dash'; }
  else if (input.move !== 0) { p.vx = clamp(p.vx + input.move * PHYS.accel * dt, -PHYS.maxSpeed, PHYS.maxSpeed); }
  else { const fr = p.grounded ? PHYS.frictionGround : PHYS.frictionAir; p.vx = p.vx > 0 ? Math.max(0, p.vx - fr * dt) : Math.min(0, p.vx + fr * dt); }
  if (input.jumpPressed) p.jumpBuf = PHYS.jumpBuffer; if (p.jumpBuf > 0) p.jumpBuf -= dt;
  if (p.grounded) { p.coyote = PHYS.coyote; p.jumps = 2; } else if (p.coyote > 0) p.coyote -= dt;
  if (p.jumpBuf > 0) {
    if (p.coyote > 0 || p.grounded) { p.vy = -PHYS.jump; p.grounded = false; p.jumpBuf = 0; p.coyote = 0; p.jumps = 1; p.squash = 0.6; p.stretch = 1.4; jumped = 'single'; }
    else if (p.jumps > 0 && p.dashT <= 0) { p.vy = -PHYS.jump * PHYS.doubleJump; p.jumpBuf = 0; p.jumps--; p.squash = 0.7; p.stretch = 1.3; jumped = 'double'; }
  }
  p.squash += (1 - p.squash) * 14 * dt; p.stretch += (1 - p.stretch) * 14 * dt;
  let g = PHYS.gravity; if (p.vy > 0) g *= PHYS.fallMul; else if (p.vy < 0 && !input.jumpHeld) g *= PHYS.lowJumpMul;
  if (p.dashT <= 0) p.vy += g * dt;
  return { jumped, dashed };
}

/** Sub-stepped sweeps. Thin gates and fast dashes cannot tunnel. */
export function collide(p: Player, solids: Surface[], boxes: Box[], dt: number, worldWidth: number): Omit<MoveResult, 'jumped' | 'dashed'> {
  const result: Omit<MoveResult, 'jumped' | 'dashed'> = { landed: false, impactVy: p.vy, landedOn: null, bumped: false, pushed: null };
  const totalDX = p.vx * dt, hSteps = Math.max(1, Math.ceil(Math.abs(totalDX) / 7)), stepDX = totalDX / hSteps;
  for (let s = 0; s < hSteps; s++) {
    const prevTop = p.y - p.h, prevBottom = p.y; p.x += stepDX; let pr = playerRect(p), stop = false;
    for (const q of solids) {
      if (!overlap(pr, q) || prevBottom <= q.y + 2 || prevTop >= q.y + q.h - 2) continue;
      p.x = stepDX > 0 ? q.x - p.w / 2 : q.x + q.w + p.w / 2; p.vx = 0; stop = true; break;
    }
    if (!stop) for (const b of boxes) {
      if (!overlap(pr, b) || prevBottom <= b.y + 2 || prevTop >= b.y + b.h - 2) continue;
      if (stepDX > 0) { b.vx = Math.max(b.vx, p.vx * PHYS.pushSpeed); p.x = b.x - p.w / 2; } else { b.vx = Math.min(b.vx, p.vx * PHYS.pushSpeed); p.x = b.x + b.w + p.w / 2; }
      p.vx = 0; result.pushed = b; stop = true; break;
    }
    if (stop) break;
  }
  const totalDY = p.vy * dt, vSteps = Math.max(1, Math.ceil(Math.abs(totalDY) / 7)), stepDY = totalDY / vSteps;
  p.grounded = false;
  for (let s = 0; s < vSteps; s++) {
    const beforeY = p.y, beforeTop = beforeY - p.h; p.y += stepDY; const pr = playerRect(p);
    let best: Surface | Box | null = null;
    for (const q of [...solids, ...boxes]) {
      if (!overlap(pr, q)) continue;
      if (stepDY >= 0 && beforeY <= q.y + 2) { if (!best || q.y < best.y) best = q; }
      else if (stepDY < 0 && beforeTop >= q.y + q.h - 2) { p.y = q.y + q.h + p.h; p.vy = 0; result.bumped = true; break; }
    }
    if (result.bumped) break;
    if (best) { p.y = best.y; p.vy = 0; p.grounded = true; result.landed = true; result.landedOn = best; break; }
  }
  if (p.x < p.w / 2) { p.x = p.w / 2; p.vx = 0; }
  if (p.x > worldWidth - p.w / 2) { p.x = worldWidth - p.w / 2; p.vx = 0; }
  return result;
}

export function stepPlayer(p: Player, input: MoveInput, dt: number, solids: Surface[], boxes: Box[], worldWidth: number): MoveResult {
  const a = integrate(p, input, dt);
  return { ...a, ...collide(p, solids, boxes, dt, worldWidth) };
}
