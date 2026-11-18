/** World mechanisms that are independent of rendering: scales, sluices, floating logs, cracking ice, triggers, shelters and threats. */
import type { Plate, Player, Rock, Box, Plat, Sluice } from './types';
import { award, movePlatform, overlap, clamp, type Rect } from './rules';
import { basinLevel, plateKey, type WorldState } from './world';
import { playerRect } from './physics';

export const CRACK_DELAY = 0.45, CRACK_REGROW = 3;
export const WATER_SPEED = 70;

/** Weight resting on a plate. Rocks weigh 1 and boxes weigh 2. The shepherd weighs 2 only on plain plates. */
export function plateWeight(plate: Plate, player: Player, boxes: Box[], rocks: Rock[]) {
  let w = 0;
  for (const r of rocks) if (r.x + r.r > plate.x && r.x - r.r < plate.x + plate.w && Math.abs(r.y + r.r - plate.y) < 10 && Math.hypot(r.vx, r.vy) < 40) w += 1;
  for (const b of boxes) if (b.x + b.w > plate.x && b.x < plate.x + plate.w && Math.abs(b.y + b.h - plate.y) < 12) w += 2;
  if (plate.need === undefined && player.grounded && overlap(playerRect(player), { x: plate.x, y: plate.y - 6, w: plate.w, h: 12 })) w += 2;
  return w;
}

/** Updates every plate. Returns the award keys that were earned in this step. */
export function stepPlates(world: WorldState, player: Player) {
  const earned: string[] = [];
  world.plates.forEach((pl, i) => {
    const weight = plateWeight(pl, player, world.boxes, world.rocks); pl.weight = weight;
    if (pl.elevatorId !== undefined) { pl.pressed = weight > 0; return; }
    if (!pl.solved) {
      pl.pressed = weight >= (pl.need ?? 1);
      if (pl.pressed) { pl.solved = true; if (award(world, plateKey(pl, i))) earned.push(plateKey(pl, i)); }
    } else pl.pressed = true;
    if (pl.lid >= 0) world.doors.forEach(d => { if (d.id === pl.lid) d.open = !!pl.pressed; });
  });
  return earned;
}

/** Places one carried stone on the nearest scale that still needs weight. */
export function placeStone(world: WorldState, player: Player) {
  const plate = world.plates.find(p => p.need !== undefined && !p.solved && Math.abs(player.x - (p.x + p.w / 2)) < 60 && Math.abs(player.y - p.y) < 30);
  if (!plate || player.rockN <= 0) return false;
  const count = world.rocks.filter(r => r.x > plate.x && r.x < plate.x + plate.w && Math.abs(r.y + r.r - plate.y) < 10).length;
  player.rockN--;
  world.rocks.push({ id: world.nextRockId++, x: plate.x + 12 + (count % 3) * 16, y: plate.y - 8, vx: 0, vy: 0, r: 8, landed: true });
  return true;
}

export function toggleSluice(world: WorldState, sluice: Sluice) {
  sluice.toB = !sluice.toB;
  for (const id of [sluice.a, sluice.b]) { const h = world.hazards.find(z => z.id === id); const y = basinLevel(world, id); if (h && y !== undefined) h.targetY = y; }
  return sluice.toB && !!sluice.award && award(world, sluice.award);
}

/** Water moves toward its level at a visible speed. Floating logs ride the surface and carry passengers. */
export function stepWater(world: WorldState, player: Player, walls: Rect[], dt: number) {
  for (const h of world.hazards) {
    if (h.targetY === undefined || h.bottom === undefined || h.y === h.targetY) continue;
    const step = WATER_SPEED * dt; h.y = Math.abs(h.targetY - h.y) <= step ? h.targetY : h.y + Math.sign(h.targetY - h.y) * step; h.h = h.bottom - h.y;
  }
  for (const f of world.floaters) {
    const h = world.hazards.find(z => z.id === f.basin); if (!h) continue;
    movePlatform(f as Parameters<typeof movePlatform>[0], f.x, h.y - 10, player, world.boxes, walls);
  }
}

/** A cracked plate breaks shortly after weight lands on it and regrows later, so a mistake never seals the route. */
export function stepCracks(platforms: Plat[], standing: Plat | null, player: Player, dt: number) {
  let started = 0;
  for (const p of platforms) {
    if (p.type !== 'crack') continue;
    if (!p.broken && standing === p && p.breakT === undefined) { p.breakT = CRACK_DELAY; started++; }
    if (!p.broken && p.breakT !== undefined) { p.breakT -= dt; if (p.breakT <= 0) { p.broken = true; p.breakT = 0; p.regrowT = CRACK_REGROW; } }
    else if (p.broken && p.regrowT !== undefined) {
      p.regrowT -= dt;
      if (p.regrowT <= 0 && !overlap(playerRect(player), p)) { p.broken = false; p.breakT = undefined; p.regrowT = undefined; }
    }
  }
  return started;
}

export function stepTriggers(world: WorldState, player: Player) {
  const earned: string[] = [];
  for (const t of world.triggers) if (!world.awards.includes(t.key) && player.grounded && overlap(playerRect(player), t) && award(world, t.key)) earned.push(t.key);
  return earned;
}

export const inShelter = (world: Pick<WorldState, 'shelters'>, player: Player) => world.shelters.some(s => player.x > s.x + 6 && player.x < s.x + s.w - 6 && player.y > s.y + 20 && player.y <= s.y + s.h + 2);

/** Telegraphed flood. It starts only after the warning interval and rises at a fixed, tested speed. */
export function stepFlood(world: WorldState, player: Player, dt: number) {
  const f = world.flood, th = world.threat; if (!f || th.phase === 'cleared') return false;
  if (th.phase === 'calm' && player.x > f.triggerX) { th.phase = 'warning'; th.timer = 0; }
  if (th.phase === 'calm') return false;
  th.timer += dt; th.level = clamp(th.timer / (f.warn + 8), 0, 1);
  if (th.phase === 'warning' && th.timer >= f.warn) th.phase = 'active';
  if (th.phase === 'active') f.y = Math.max(f.endY, f.y - f.rise * dt);
  return th.phase === 'active' && overlap(playerRect(player), { x: f.x, y: f.y, w: f.w, h: f.bottom - f.y });
}
export function resetFlood(world: WorldState) { if (world.flood) world.flood.y = world.flood.startY; }

/** Avalanche front. It waits for the warning, then advances; a sheltered shepherd lets it pass. */
export function stepAvalanche(world: WorldState, player: Player, dt: number) {
  const a = world.def.avalanche, th = world.threat; if (!a || th.phase === 'cleared') return false;
  if (th.phase === 'calm') { if (player.x > a.triggerX) { th.phase = 'warning'; th.timer = 0; th.frontX = a.startX; } return false; }
  th.timer += dt; th.level = clamp(th.timer / a.warn, 0, 1);
  if (th.phase === 'warning') { if (th.timer >= a.warn) th.phase = 'active'; return false; }
  th.frontX += a.speed * dt;
  const sheltered = inShelter(world, player);
  if (th.frontX > player.x + 160 && (sheltered || player.x >= (world.def.endX ?? Infinity))) { th.phase = 'cleared'; th.level = 0; return false; }
  if (th.frontX > (world.def.endX ?? world.def.width)) { th.phase = 'cleared'; th.level = 0; return false; }
  return !sheltered && th.frontX > player.x - 20;
}
