/** Builds reachability scenes from real world data for a chosen set of solved mechanisms. Used by the audit and the tests. */
import { createWorld, basinLevel, type WorldState } from './world';
import { bridgeSolid, overlap, launch, trajectory, type Rect } from './rules';
import { exploreWithLinks, type ReachScene } from './reach';
import type { Surface } from './physics';

export type Solved = { bridges?: number[]; doors?: number[]; sluices?: string[]; lift?: boolean; boxes?: { x: number; y: number }[] };

export function scene(world: WorldState, solved: Solved = {}): { scene: ReachScene; links: { from: { x: number; y: number }; to: { x: number; y: number } }[] } {
  world.sluices.forEach(s => { s.toB = !!solved.sluices?.includes(s.id); });
  const water = world.hazards.map(h => { const y = basinLevel(world, h.id) ?? h.y; return { ...h, y, h: (h.bottom ?? h.y + h.h) - y }; });
  const solids: Surface[] = [
    ...world.platforms.filter(p => p.type !== 'crack'),
    ...world.bridges.map(b => bridgeSolid({ ...b, progress: solved.bridges?.includes(b.id) ? 1 : 0 })),
    ...world.doors.filter(d => !solved.doors?.includes(d.id)),
    ...world.floaters.map(f => { const h = water.find(z => z.id === f.basin); return { x: f.x, y: (h?.y ?? f.y) - 10, w: f.w, h: f.h }; }),
    ...world.mplatforms.flatMap(m => [0, 0.5, 1].map(k => m.axis === 'x' ? { x: m.sx + (m.ex - m.sx) * k, y: m.y, w: m.w, h: m.h } : { x: m.x, y: m.sy! + (m.ey! - m.sy!) * k, w: m.w, h: m.h })),
    ...world.elevators.map(e => ({ x: e.x, y: e.baseY, w: e.w, h: e.h })),
    ...(solved.boxes ?? []).map(b => ({ x: b.x, y: b.y, w: 56, h: 56 })),
  ];
  const links = solved.lift ? world.elevators.map(e => ({ from: { x: e.x + e.w / 2, y: e.baseY }, to: { x: e.x + e.w / 2, y: e.topY } })) : [];
  if (solved.lift) world.elevators.forEach(e => solids.push({ x: e.x, y: e.topY, w: e.w, h: e.h }));
  return { scene: { solids, hazards: water, width: world.def.width, start: { x: world.def.spawnX, y: world.def.spawnY + 48 } }, links };
}
export function reachable(index: number, solved: Solved = {}, start?: { x: number; y: number }) {
  const world = createWorld(index), s = scene(world, solved);
  if (start) s.scene.start = start;
  return { world, nodes: exploreWithLinks(s.scene, s.links), solids: s.scene.solids };
}
/** True when a throw from some point in [x0, x1] at standing height y hits the target rectangle before any solid. */
export function canHit(solids: Rect[], x0: number, x1: number, y: number, target: Rect, facing = true) {
  for (let x = x0; x <= x1; x += 8) for (let aim = -Math.PI / 2; aim <= 0.001; aim += Math.PI / 48) for (let power = 0; power <= 1; power += 0.05) {
    const pts = trajectory(launch(x, y, facing, aim, power, 0), solids, 2);
    if (pts.some(p => overlap({ x: p.x - 7, y: p.y - 7, w: 14, h: 14 }, target))) return true;
  }
  return false;
}
export const leverBox = (l: { x: number; y: number }) => ({ x: l.x - 10, y: l.y - 40, w: 28, h: 42 });
