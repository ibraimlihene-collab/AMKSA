/**
 * Reachability bot. It replays the real player physics from every standing position with a set of
 * input scripts (run-up, held or short jump, double jump timing, dash timing). It never guesses arcs.
 * The audit uses it to prove that mandatory routes exist and that gated areas stay closed.
 */
import { createPlayer } from './world';
import { stepPlayer, type Surface } from './physics';
import { overlap, STEP, type Rect } from './rules';
import type { Box } from './types';

export type ReachScene = { solids: Surface[]; hazards: Rect[]; width: number; start: { x: number; y: number }; boxes?: Box[] };
export type Node = { x: number; y: number; s: number };

const BUCKET = 16;
const DOUBLE_AT = [-1, 0.12, 0.24, 0.36, 0.48];
const DASH_AT = [-1, 0.02, 0.3];
const RELEASE_AT = [Infinity, 0.12];
/** Steering may start late, so a player can jump straight up and then drift onto a ledge. */
const STEER_AT = [0, 0.22];

function standingFree(x: number, y: number, solids: Surface[], ignore: Surface) {
  const r = { x: x - 11, y: y - 46, w: 22, h: 46 };
  return !solids.some(q => q !== ignore && overlap(r, q));
}

export function explore(scene: ReachScene, limit = 6000) {
  const surfaces = [...scene.solids, ...(scene.boxes ?? [])] as Surface[];
  const seen = new Map<string, Node>(), queue: Node[] = [];
  const key = (s: number, x: number) => `${s}:${Math.round(x / BUCKET)}`;
  const add = (s: number, x: number) => {
    const q = surfaces[s]; const cx = Math.max(q.x + 1, Math.min(q.x + q.w - 1, x));
    const k = key(s, cx); if (seen.has(k) || seen.size > limit) return;
    if (!standingFree(cx, q.y, scene.solids, q)) return;
    const n = { x: cx, y: q.y, s }; seen.set(k, n); queue.push(n);
  };
  const startSurface = surfaces.findIndex(q => scene.start.x >= q.x && scene.start.x <= q.x + q.w && Math.abs(q.y - scene.start.y) < 3);
  if (startSurface < 0) return [];
  add(startSurface, scene.start.x);
  while (queue.length) {
    const n = queue.shift()!, q = surfaces[n.s];
    for (const dx of [-BUCKET, BUCKET]) { const nx = n.x + dx; if (nx >= q.x && nx <= q.x + q.w) add(n.s, nx); }
    for (const dir of [-1, 1] as const) for (const run of [0, 300]) for (const jump of [false, true]) for (const steer of jump && run === 0 ? STEER_AT : [0]) for (const release of jump ? RELEASE_AT : [Infinity]) for (const dbl of jump ? DOUBLE_AT : [-1]) for (const dash of DASH_AT) {
      const landing = simulate(scene, surfaces, n, dir, run, jump, release, dbl, dash, steer);
      if (landing) add(landing.s, landing.x);
    }
  }
  return [...seen.values()];
}

function simulate(scene: ReachScene, surfaces: Surface[], n: Node, dir: -1 | 1, run: number, jump: boolean, release: number, dbl: number, dash: number, steer = 0) {
  const p = createPlayer(n.x, n.y); p.vx = dir * run; p.grounded = true; p.invinc = 0;
  let t = 0, airborne = false;
  while (t < 2.2) {
    const input = { move: (t >= steer ? dir : 0) as -1 | 0 | 1, jumpPressed: (jump && t === 0) || (dbl >= 0 && Math.abs(t - dbl) < STEP / 2), jumpHeld: jump && t < release, dashPressed: dash >= 0 && Math.abs(t - dash) < STEP / 2 };
    const r = stepPlayer(p, input, STEP, scene.solids, scene.boxes ?? [], scene.width);
    t += STEP;
    if (!p.grounded) airborne = true;
    if (scene.hazards.some(h => overlap({ x: p.x - p.w / 2, y: p.y - p.h, w: p.w, h: p.h }, h))) return null;
    if (p.y > 900) return null;
    if (airborne && r.landed && r.landedOn) { const s = surfaces.indexOf(r.landedOn as Surface); return s >= 0 ? { s, x: p.x } : null; }
    if (!jump && !airborne && t > 0.6) return null; // walking is handled by the BFS neighbours
  }
  return null;
}

export const near = (nodes: Node[], x: number, y: number, dx = 40, dy = 60) => nodes.some(n => Math.abs(n.x - x) <= dx && Math.abs(n.y - y) <= dy);

/** Explore, then follow rides (lifts) whose boarding point was reached. */
export function exploreWithLinks(scene: ReachScene, links: { from: { x: number; y: number }; to: { x: number; y: number } }[] = []) {
  let nodes = explore(scene); const used = new Set<number>();
  for (let changed = true; changed;) {
    changed = false;
    links.forEach((l, i) => { if (!used.has(i) && near(nodes, l.from.x, l.from.y, 30, 4)) { used.add(i); changed = true; nodes = [...nodes, ...explore({ ...scene, start: l.to })]; } });
  }
  return nodes;
}
