/** Sheep behaviour: idle, alert, fear, calming, rescued, gone. Pure state transitions, shared by the game and the tests. */
import type { Sheep, Player, Enemy } from './types';
import { clamp } from './rules';

export const CALM_TIME = 1.1, CALM_RANGE = 74, FEAR_RANGE = 230, ALERT_RANGE = 170;
const hostile = (e: Enemy) => e.state !== 'dead' && e.state !== 'flee' && e.state !== 'retreat' && e.type !== 'fox' && e.type !== 'macaque';

export type SheepEvent = 'rescued' | 'frightened' | 'bleat' | null;

/**
 * A sheep is rescued only after the shepherd calms it: a slow approach or the Interact call within range,
 * with no hostile animal nearby. Running at it makes it step back. Touching it is not enough.
 */
export function stepSheep(s: Sheep, player: Player, enemies: Enemy[], calling: boolean, dt: number): SheepEvent {
  s.bob += dt; s.bleatT = (s.bleatT ?? 3) - dt;
  if (s.state === 'gone') return null;
  if (s.state === 'rescued') {
    // The rescued sheep walks toward the fold and fades. Its record is already saved.
    s.x += 80 * dt; s.faceR = true; s.fade = Math.max(0, (s.fade ?? 1) - dt * 0.55);
    if (s.fade <= 0) s.state = 'gone';
    return null;
  }
  const lo = s.minX ?? s.x, hi = s.maxX ?? s.x;
  const threat = enemies.find(e => hostile(e) && Math.abs(e.x + e.w / 2 - s.x) < FEAR_RANGE && Math.abs(e.y + e.h - s.y) < 120);
  const dx = player.x - s.x, dist = Math.abs(dx), dy = Math.abs(player.y - 20 - s.y);
  if (threat) {
    const was = s.state; s.state = 'fear'; s.calm = Math.max(0, (s.calm ?? 0) - dt * 2);
    const away = Math.sign(s.x - (threat.x + threat.w / 2)) || 1; s.faceR = away > 0;
    s.x = clamp(s.x + away * 40 * dt, lo, hi);
    return was !== 'fear' ? 'frightened' : null;
  }
  const near = dist < CALM_RANGE && dy < 46 && player.grounded;
  const running = Math.abs(player.vx) > 200;
  if (near && (calling || !running)) {
    s.state = 'calming'; s.faceR = dx > 0;
    s.calm = (s.calm ?? 0) + dt * (calling ? 1.6 : 1);
    if (s.calm >= CALM_TIME) { s.state = 'rescued'; s.rescued = true; s.calm = CALM_TIME; return 'rescued'; }
    return null;
  }
  s.calm = Math.max(0, (s.calm ?? 0) - dt * 0.8);
  if (dist < ALERT_RANGE && running) { s.state = 'alert'; s.faceR = dx > 0; s.x = clamp(s.x - Math.sign(dx) * 30 * dt, lo, hi); return null; }
  s.state = 'idle';
  // Small grazing steps around the spot where the sheep was found.
  const home = s.homeX ?? s.x, drift = Math.sin(s.bob * 0.35) * 14;
  s.x = clamp(s.x + clamp(home + drift - s.x, -12 * dt, 12 * dt), lo, hi);
  if ((s.bleatT ?? 0) <= 0) { s.bleatT = 5 + (s.bob % 3); return dist < 900 ? 'bleat' : null; }
  return null;
}
