/**
 * Animal behaviour. Every hostile animal moves through readable phases:
 * walk (patrol) → notice → warn → chase/attack → recover → retreat. Fox and macaque never attack.
 * A stone that lands nearby distracts an animal; a direct hit makes it flee. Killing is never required.
 */
import type { Enemy, Player } from './types';
import { clamp, clearLine, overlap, type Rect } from './rules';
import { playerRect } from './physics';

export type AnimalSound = 'growl' | 'hiss' | 'screech' | 'snort' | 'yelp' | 'chirp' | null;
export type AnimalEvent = { hurt: boolean; sound: AnimalSound };
type Ctx = { player: Player; solids: Rect[]; dt: number; time: number; sheltered: boolean };

const SPEC = {
  wolf: { sight: 280, chase: 150, patrol: 60, warn: 0.7, windup: 0.4, recover: 0.9, sound: 'growl' as AnimalSound },
  boar: { sight: 230, chase: 250, patrol: 50, warn: 0.9, windup: 0.2, recover: 1.4, sound: 'snort' as AnimalSound },
  lynx: { sight: 300, chase: 170, patrol: 60, warn: 0.7, windup: 0.4, recover: 0.9, sound: 'growl' as AnimalSound },
  snake: { sight: 90, chase: 0, patrol: 30, warn: 0.6, windup: 0.25, recover: 1.0, sound: 'hiss' as AnimalSound },
};
const GRAVITY = 2100;

export const isHostile = (e: Enemy) => e.type !== 'fox' && e.type !== 'macaque';
const enter = (e: Enemy, state: Enemy['state']) => { e.state = state; e.stateT = 0; };

export function updateAnimal(e: Enemy, c: Ctx): AnimalEvent {
  const ev: AnimalEvent = { hurt: false, sound: null };
  if (e.state === 'dead') { e.deadT -= c.dt; return ev; }
  e.stateT = (e.stateT ?? 0) + c.dt; e.anim += c.dt; if (e.dmgT > 0) e.dmgT -= c.dt;
  if (e.type === 'eagle') return updateEagle(e, c, ev);

  // Ground physics.
  e.vy += GRAVITY * c.dt; const prevBottom = e.y + e.h; e.y += e.vy * c.dt; e.onGround = false;
  let best = Infinity;
  for (const p of c.solids) if (overlap({ x: e.x, y: e.y, w: e.w, h: e.h }, p) && e.vy >= 0 && prevBottom <= p.y + 4 && e.x + e.w > p.x + 1 && e.x < p.x + p.w - 1 && p.y < best) best = p.y;
  if (best < Infinity) { e.y = best - e.h; e.vy = 0; e.onGround = true; }
  if (e.kbX !== 0) { const nx = clamp(e.x + e.kbX * c.dt, e.sx, e.ex); if (!c.solids.some(p => overlap({ x: nx, y: e.y, w: e.w, h: e.h - 1 }, p))) e.x = nx; e.kbX *= Math.pow(0.85, c.dt * 60); if (Math.abs(e.kbX) < 5) e.kbX = 0; }

  const p = c.player, cx = e.x + e.w / 2, dx = p.x - cx, adx = Math.abs(dx), dy = Math.abs(p.y - (e.y + e.h));
  const visible = clearLine({ x: cx, y: e.y + e.h / 2 }, { x: p.x, y: p.y - 20 }, c.solids);
  const home = e.homeX ?? (e.sx + e.ex) / 2;
  let speed = 0;

  if (!isHostile(e)) {
    // Ambient wildlife keeps its distance from the shepherd.
    if (adx < 150 && dy < 90 && e.state !== 'flee') { enter(e, 'flee'); ev.sound = 'chirp'; }
    if (e.state === 'flee') { e.faceR = dx < 0; speed = 160; if (e.stateT! > 1.6) enter(e, 'walk'); }
    else { if (e.state !== 'walk') enter(e, 'walk'); speed = 45; if (e.x <= e.sx + 2) e.faceR = true; if (e.x >= e.ex - 2) e.faceR = false; }
    move(e, speed, c); return ev;
  }

  const s = SPEC[e.type as keyof typeof SPEC] ?? SPEC.wolf;
  const elevated = p.grounded && p.y < e.y + e.h - 60;
  const sees = visible && adx < s.sight && dy < 130 && !c.sheltered;
  switch (e.state) {
    case 'idle': case 'walk':
      if (e.state === 'idle') enter(e, 'walk');
      speed = s.patrol; if (e.x <= e.sx + 2) e.faceR = true; if (e.x >= e.ex - 2) e.faceR = false;
      if (sees) { enter(e, 'notice'); e.faceR = dx > 0; }
      break;
    case 'notice':
      e.faceR = dx > 0; if (e.stateT! > 0.45) { enter(e, sees ? 'warn' : 'walk'); if (sees) ev.sound = s.sound; }
      break;
    case 'warn':
      e.faceR = dx > 0; if (e.stateT! > s.warn) { enter(e, e.type === 'snake' ? 'attack' : 'chase'); e.focusX = dx > 0 ? 1 : -1; }
      break;
    case 'chase':
      if (e.type === 'boar') { e.faceR = (e.focusX ?? 1) > 0; speed = s.chase; if (e.stateT! > 1.3 || atLimit(e)) enter(e, 'recover'); }
      else { e.faceR = dx > 0; speed = s.chase; if (adx < 56 && dy < 50) enter(e, 'attack'); }
      if (elevated && e.stateT! > 1.2) enter(e, 'retreat');
      if (Math.abs(p.x - home) > 560) enter(e, 'retreat');
      break;
    case 'attack': {
      const lunge = e.type === 'snake' ? 120 : e.type === 'boar' ? s.chase : 80;
      if (e.stateT! > s.windup) speed = lunge;
      if (e.stateT! > s.windup && p.invinc <= 0 && overlap(playerRect(p), { x: e.x - 6, y: e.y, w: e.w + 12, h: e.h })) { ev.hurt = true; enter(e, 'recover'); }
      else if (e.stateT! > s.windup + 0.35) enter(e, 'recover');
      break;
    }
    case 'recover':
      e.faceR = dx > 0; speed = -35; if (e.stateT! > s.recover) enter(e, sees && !elevated ? (e.type === 'snake' ? 'warn' : 'chase') : 'retreat');
      break;
    case 'retreat':
      e.faceR = home > e.x; speed = 80; if (Math.abs(home - e.x) < 12 || e.stateT! > 4) enter(e, 'walk');
      break;
    case 'flee':
      e.faceR = dx < 0; speed = 150; if (e.stateT! > (e.type === 'snake' ? 5 : 2.2)) enter(e, 'retreat');
      break;
    case 'distract':
      e.faceR = (e.focusX ?? e.x) > cx; speed = Math.abs((e.focusX ?? cx) - cx) > 10 ? 70 : 0;
      if (e.stateT! > 2.6) enter(e, 'walk');
      break;
  }
  move(e, speed, c);
  return ev;
}

const atLimit = (e: Enemy) => (e.faceR && e.x >= e.ex - 2) || (!e.faceR && e.x <= e.sx + 2);

function move(e: Enemy, speed: number, c: Ctx) {
  const dir = e.faceR ? 1 : -1; e.vx = dir * speed;
  const nextX = clamp(e.x + e.vx * c.dt, e.sx, e.ex), edge = e.vx > 0 ? nextX + e.w : nextX;
  const floorAhead = c.solids.some(p => edge >= p.x && edge <= p.x + p.w && Math.abs(p.y - (e.y + e.h)) < 8);
  if ((e.onGround && !floorAhead) || c.solids.some(p => overlap({ x: nextX, y: e.y, w: e.w, h: e.h - 1 }, p))) { e.vx = 0; if (e.state === 'walk') e.faceR = !e.faceR; return; }
  e.x = nextX;
}

function updateEagle(e: Enemy, c: Ctx, ev: AnimalEvent): AnimalEvent {
  const p = c.player; e.homeY ??= e.y;
  const glide = () => { const t = c.time * 0.45 + (e.sx % 7); return { x: (e.sx + e.ex) / 2 + Math.sin(t) * (e.ex - e.sx) / 2, y: e.homeY! + Math.sin(c.time * 1.2) * 14 }; };
  const exposed = !c.sheltered && clearLine({ x: e.x + e.w / 2, y: e.y + e.h }, { x: p.x, y: p.y - 30 }, c.solids);
  switch (e.state) {
    case 'idle': case 'walk': {
      const g = glide(); e.faceR = g.x > e.x; e.x += clamp(g.x - e.x, -160 * c.dt, 160 * c.dt); e.y += clamp(g.y - e.y, -120 * c.dt, 120 * c.dt);
      if (e.state === 'idle') enter(e, 'walk');
      if (e.stateT! > 2.5 && exposed && Math.abs(p.x - (e.x + e.w / 2)) < 260 && p.x > e.sx - 80 && p.x < e.ex + 80) { enter(e, 'warn'); ev.sound = 'screech'; }
      break;
    }
    case 'warn':
      // The shadow and cry mark the landing point for over a second before the dive.
      e.faceR = p.x > e.x; e.diveX = p.x - e.w / 2; e.diveY = p.y - e.h - 6;
      if (!exposed) enter(e, 'recover'); else if (e.stateT! > 1.15) enter(e, 'attack');
      break;
    case 'attack': {
      const tx = e.diveX ?? e.x, ty = e.diveY ?? e.y, k = Math.min(1, c.dt * 4.2);
      e.x += (tx - e.x) * k; e.y += (ty - e.y) * k;
      if (!exposed && e.stateT! > 0.1) { enter(e, 'recover'); break; }
      if (p.invinc <= 0 && overlap(playerRect(p), e)) { ev.hurt = true; enter(e, 'recover'); }
      else if (e.stateT! > 0.75) enter(e, 'recover');
      break;
    }
    case 'recover': case 'retreat': case 'flee':
      e.y += clamp(e.homeY - e.y, -150 * c.dt, 150 * c.dt); if (e.stateT! > 1.2) enter(e, 'walk');
      break;
    default: enter(e, 'walk');
  }
  e.y = clamp(e.y, 40, 440);
  return ev;
}

/** A stone that lands near an animal draws its attention to the landing point. */
export function distract(enemies: Enemy[], x: number, y: number) {
  for (const e of enemies) {
    if (e.state === 'dead' || e.type === 'eagle' || !isHostile(e)) continue;
    const d = Math.abs(e.x + e.w / 2 - x);
    if (e.type === 'snake') { if (d < 80 && Math.abs(e.y - y) < 60) { e.state = 'flee'; e.stateT = 0; } continue; }
    if (d < 200 && Math.abs(e.y - y) < 120 && e.state !== 'attack') { e.state = 'distract'; e.stateT = 0; e.focusX = x; }
  }
}
/** A direct hit drives the animal away instead of provoking it. */
export function scare(e: Enemy) { if (e.state === 'dead') return; e.state = e.type === 'eagle' ? 'recover' : 'flee'; e.stateT = 0; }
