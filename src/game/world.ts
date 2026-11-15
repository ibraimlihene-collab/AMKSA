import { WORLDS } from './content';
import type { Player, Plat, Proj, Part, Threat } from './types';
import type { RoomSave } from './save';
import { overlap, clamp } from './rules';

export function support(platforms: Plat[], x: number, width = 0) {
  const surfaces = platforms.filter(p => x - width / 2 >= p.x && x + width / 2 <= p.x + p.w);
  return surfaces.length ? Math.min(...surfaces.map(p => p.y)) : null;
}
export function placeOnSurface(platforms: Plat[], center: number, width: number, height: number, foot: number) {
  const candidates = platforms.filter(p => p.w >= width).map(p => {
    const x = clamp(center, p.x + width / 2, p.x + p.w - width / 2);
    return { p, x, y: p.y, cost: Math.abs(x - center) + Math.abs(p.y - foot) * 0.25 };
  }).filter(c => !platforms.some(p => p !== c.p && overlap({ x: c.x - width / 2, y: c.y - height, w: width, h: height }, p))).sort((a, b) => a.cost - b.cost);
  if (!candidates[0]) throw new Error('No safe support surface exists.');
  return candidates[0];
}
export function createPlayer(x: number, y: number): Player {
  return { x, y, prevX: x, prevY: y, vx: 0, vy: 0, w: 22, h: 46, grounded: false, faceR: true, anim: 0, stepT: 0, state: 'idle', jumpBuf: 0, coyote: 0, jumps: 2, squash: 1, stretch: 1, rockN: 4, charging: false, power: 0, aim: -Math.PI / 4, hp: 3, invinc: 1.4, hitFlash: 0, dashT: 0, dashCD: 0, dashDir: 1, punchT: 0, punchCD: 0, attackHits: [] };
}
export function createWorld(index: number, saved?: RoomSave) {
  const d = WORLDS[index]();
  const sheep = d.sheep.map(s => { const place = placeOnSurface(d.platforms, s.x, 36, 26, s.y + 4); return { ...s, x: place.x, y: place.y - 4, rescued: saved?.sheep.includes(s.id) ?? false }; });
  const boxes = safeBoxes(d.platforms, d.boxes);
  const enemies = d.enemies.map(e => {
    if (e.type === 'eagle') return { ...e, homeY: e.y };
    const candidates = d.platforms.filter(p => p.w >= e.w).map(p => {
      const x = clamp(e.x, p.x + 1, p.x + p.w - e.w - 1), y = p.y - e.h;
      return { p, x, y, cost: Math.abs(x - e.x) + Math.abs(y - e.y) };
    }).filter(c => !d.platforms.some(p => p !== c.p && overlap({ x: c.x, y: c.y, w: e.w, h: e.h }, p))).sort((a, b) => a.cost - b.cost);
    const spawn = candidates[0];
    return spawn ? { ...e, x: spawn.x, y: spawn.y, sx: spawn.p.x + 1, ex: spawn.p.x + spawn.p.w - e.w - 1 } : e;
  }).map(e => saved?.killed.includes(e.id) ? { ...e, hp: 0, state: 'dead' as const, deadT: 0 } : e);
  const world = {
    def: d, platforms: d.platforms, mplatforms: d.mplatforms, bridges: d.bridges, elevators: d.elevators,
    levers: d.levers, doors: d.doors, plates: d.plates, enemies, rocks: d.rocks, boxes, hanging: d.hanging,
    hazards: d.hazards.map(h => ({ ...h, baseY: h.y, bottom: h.y + h.h })), checkpoints: d.checkpoints,
    coins: d.coins.map((c, i) => ({ ...c, got: saved?.coins.includes(i) ?? false })), sheep, portal: d.portal, projectiles: [] as Proj[], particles: [] as Part[],
    threat: { kind: d.threat, timer: 0, level: 0, phase: 'calm', frontX: 0 } as Threat,
    awards: [] as string[], seqProgress: 0, seqFailed: false, seqSolved: false,
    killed: enemies.filter(e => e.state === 'dead').length, rescued: sheep.filter(s => s.rescued).length,
    solved: 0, opened: true, streak: 0, completionAwarded: saved?.completionAwarded ?? false, avalancheCleared: false, nextRockId: 100,
  };
  if (saved) {
    const keys = ['sequence', ...world.levers.filter(l => l.seq === undefined).map(l => l.id), ...world.plates.flatMap((p, i) => p.elevatorId === undefined ? [`plate-${i}`] : [])];
    world.awards = [...new Set(saved.awards.filter(a => keys.includes(a)))]; world.solved = world.awards.length;
    world.seqProgress = saved.seqProgress; world.seqSolved = saved.seqSolved && world.awards.includes('sequence');
    world.levers.forEach(l => { const v = saved.levers.find(r => r.id === l.id); if (v) { l.solved = v.solved; l.on = v.on && (l.puzzleId === undefined || l.solved); } });
    // Timed gates resume closed and can be activated again. Historical credit remains.
    world.doors.forEach(d => { const controller = world.levers.find(l => l.lid === d.id), plateIndex = world.plates.findIndex(p => p.lid === d.id); const credited = controller ? (controller.seq !== undefined ? controller.puzzleId === undefined || !!controller.solved : controller.on) : world.awards.includes(`plate-${plateIndex}`); d.open = credited && (saved.doors.find(r => r.id === d.id)?.open ?? false); if (world.levers.some(l => l.lid === d.id && l.timed)) { d.open = false; world.levers.filter(l => l.lid === d.id).forEach(l => { l.on = false; }); } });
    world.bridges.forEach(b => { b.down = saved.bridges.find(r => r.id === b.id)?.down ?? false; b.progress = b.down ? 1 : 0; });
    world.plates.forEach((p, i) => { if (p.elevatorId === undefined && world.awards.includes(`plate-${i}`)) { p.solved = true; p.pressed = true; } });
    if (saved.checkpoint > 0 && world.checkpoints[saved.checkpoint - 1]) {
      world.checkpoints.slice(0, saved.checkpoint).forEach(c => { c.on = true; });
      const c = world.checkpoints[saved.checkpoint - 1]; d.spawnX = c.x + 60; d.spawnY = c.y;
    }
  }
  return world;
}
export type WorldState = ReturnType<typeof createWorld>;
export type Session = { world: WorldState; player: Player; camX: number; camY: number; camTX: number; camTY: number; deaths: number; totalCoins: number; wCoins: number; time: number };
export function snapshot(world: WorldState): RoomSave {
  return { checkpoint: world.checkpoints.reduce((last, c, i) => c.on ? i + 1 : last, 0), coins: world.coins.flatMap((c, i) => c.got ? [i] : []), completionAwarded: world.completionAwarded, awards: [...world.awards], sheep: world.sheep.filter(s => s.rescued).map(s => s.id), killed: world.enemies.filter(e => e.state === 'dead').map(e => e.id), levers: world.levers.map(l => ({ id: l.id, on: l.on, solved: !!l.solved })), doors: world.doors.map(d => ({ id: d.id, open: d.open })), bridges: world.bridges.map(b => ({ id: b.id, down: b.down })), seqProgress: world.seqProgress, seqSolved: world.seqSolved };
}
export function resetResources(world: WorldState) {
  const stock = WORLDS.find(f => f().id === world.def.id)!();
  world.rocks = stock.rocks; world.boxes = safeBoxes(world.platforms, stock.boxes);
  world.hanging = stock.hanging; world.projectiles = [];
}

function safeBoxes(platforms: Plat[], boxes: import('./types').Box[]) {
  return boxes.map((b, i) => { const p = placeOnSurface(platforms, b.x + b.w / 2, b.w, b.h, b.y + b.h); return { ...b, id: `box-${i}`, x: p.x - b.w / 2, y: p.y - b.h }; });
}
