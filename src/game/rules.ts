/** Rules shared by the live simulation, trajectory preview and regression tests. */
export type Rect = { x: number; y: number; w: number; h: number };
export const STEP = 1 / 60;
export const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export class FixedClock {
  debt = 0;
  time = 0;
  advance(seconds: number, tick: (dt: number, time: number) => boolean | void) {
    // A suspended tab pauses the game. It must not simulate a minute of damage on return.
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 0.5) { this.debt = 0; return; }
    this.debt += seconds;
    while (this.debt + 1e-9 >= STEP) {
      this.debt = Math.max(0, this.debt - STEP); this.time += STEP;
      if (tick(STEP, this.time) === false) { this.debt = 0; break; }
    }
  }
}

type Mechanism = { id: string; on: boolean; solved?: boolean; puzzleId?: number; target?: boolean; bridgeId?: number; seq?: number; seqMax?: number; lid: number; timed?: number };
type Machines = {
  awards: string[]; solved: number; main?: string[]; seqProgress: number; seqFailed: boolean; seqSolved: boolean;
  levers: Mechanism[]; bridges: { id: number; down: boolean }[];
  doors: { id: number; open: boolean; timer?: number }[];
};
/** Records a unique award. Only the world's main puzzles count toward its puzzle goal. */
export function award(world: { awards: string[]; solved: number; main?: string[] }, id: string) {
  if (world.awards.includes(id)) return false;
  world.awards.push(id); world.solved = world.main ? world.awards.filter(a => world.main!.includes(a)).length : world.awards.length; return true;
}

/** Every input, including PuzzleSolved, enters this transition. */
export function activate(world: Machines, lever: Mechanism, source: 'hand' | 'rock' | 'puzzle') {
  if (lever.on) return 'unchanged';
  if (lever.target && source !== 'rock') return 'blocked';
  if (lever.puzzleId !== undefined && !lever.solved) {
    if (source !== 'puzzle') return source === 'hand' ? 'puzzle' : 'blocked';
    lever.solved = true;
  }
  if (lever.seq !== undefined) {
    if (lever.seq !== world.seqProgress + 1) {
      world.seqFailed = true; world.seqProgress = 0;
      world.levers.filter(l => l.seq !== undefined).forEach(l => { l.on = false; });
      return 'wrong';
    }
    world.seqProgress++; world.seqFailed = false;
    if (lever.seq === lever.seqMax) { world.seqSolved = true; award(world, 'sequence'); }
  } else award(world, lever.id);
  lever.on = true;
  if (lever.bridgeId !== undefined) {
    const bridge = world.bridges.find(b => b.id === lever.bridgeId);
    if (bridge) bridge.down = true;
  }
  world.doors.filter(d => d.id === lever.lid).forEach(d => { d.open = true; if (lever.timed) d.timer = lever.timed; });
  return 'activated';
}

export type Combatant = Rect & { id: string; hp: number; state: string; deadT: number; dmgT: number; kbX: number };
export function damageEnemy(world: { killed: number }, enemy: Combatant, damage: number) {
  if (enemy.state === 'dead' || enemy.hp <= 0) return false;
  enemy.hp = Math.max(0, enemy.hp - damage); enemy.dmgT = 0.2;
  if (enemy.hp === 0) { enemy.state = 'dead'; enemy.deadT = 1.2; world.killed++; return true; }
  return false;
}

export function clearLine(a: { x: number; y: number }, b: { x: number; y: number }, walls: Rect[]) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
  for (let i = 1; i < steps; i++) {
    const x = a.x + (b.x - a.x) * i / steps, y = a.y + (b.y - a.y) * i / steps;
    if (walls.some(w => x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h)) return false;
  }
  return true;
}

export type Projectile = { x: number; y: number; vx: number; vy: number; r: number };
export function launch(x: number, footY: number, facing: boolean, aim: number, power: number, speedX: number): Projectile {
  const angle = facing ? aim : Math.PI - aim, speed = 480 + clamp(power, 0, 1) * 800;
  return { x: x + (facing ? 8 : -8), y: footY - 12, vx: Math.cos(angle) * speed + speedX * 0.4, vy: Math.sin(angle) * speed, r: 7 };
}
export function projectileStep(p: Projectile, dt: number) {
  p.vy += 2100 * dt; p.vx *= Math.pow(0.99, dt * 60); p.x += p.vx * dt; p.y += p.vy * dt;
}
export function trajectory(p: Projectile, walls: Rect[], seconds = 0.9) {
  const copy = { ...p }, points: { x: number; y: number }[] = [{ x: copy.x, y: copy.y }];
  for (let i = 0; i < seconds / STEP; i++) {
    projectileStep(copy, STEP); points.push({ x: copy.x, y: copy.y });
    if (walls.some(w => overlap({ x: copy.x - copy.r, y: copy.y - copy.r, w: copy.r * 2, h: copy.r * 2 }, w))) break;
  }
  return points;
}

type Mover = Rect & { vx: number; axis?: 'x' | 'y'; sx?: number; ex?: number; sy?: number; ey?: number; dx?: number; dy?: number };
type Rider = { x: number; y: number; w: number; h: number; vy: number; grounded?: boolean };
/** Move riders by the measured displacement once, before character collision. */
export function movePlatform(platform: Mover, nextX: number, nextY: number, player: Rider, boxes: Rider[], walls: Rect[]) {
  const dx = nextX - platform.x, dy = nextY - platform.y;
  const riders = [
    ...(Math.abs(player.y - platform.y) <= 2 && player.vy >= 0 && player.x + player.w / 2 > platform.x && player.x - player.w / 2 < platform.x + platform.w ? [{ body: player, foot: true }] : []),
    ...boxes.filter(b => Math.abs(b.y + b.h - platform.y) <= 2 && b.vy >= 0 && b.x + b.w > platform.x && b.x < platform.x + platform.w).map(body => ({ body, foot: false })),
  ];
  // A passenger can stand on a box which itself rides the platform.
  if (!riders.some(r => r.body === player) && boxes.some(b => riders.some(r => r.body === b) && Math.abs(player.y - b.y) <= 2 && player.vy >= 0 && player.x + player.w / 2 > b.x && player.x - player.w / 2 < b.x + b.w)) riders.push({ body: player, foot: true });
  // Stop at an obstruction instead of pushing a passenger into a ceiling.
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
  let movedX = 0, movedY = 0;
  for (let i = 0; i < steps; i++) {
    const blocked = riders.some(({ body: b, foot }) => walls.some(w => overlap({ x: b.x + dx / steps - (foot ? b.w / 2 : 0), y: b.y + dy / steps - (foot ? b.h : 0), w: b.w, h: b.h }, w)));
    if (blocked) break;
    platform.x += dx / steps; platform.y += dy / steps; movedX += dx / steps; movedY += dy / steps;
    riders.forEach(({ body }) => { body.x += dx / steps; body.y += dy / steps; });
  }
  platform.dx = movedX; platform.dy = movedY;
}

export function downwardContact(body: Rect, previousBottom: number, speed: number, enemy: Rect) {
  return speed > 200 && previousBottom <= enemy.y + 2 && body.y + body.h >= enemy.y && body.x < enemy.x + enemy.w && body.x + body.w > enemy.x;
}

export function ending(rescued: number, total: number) { return rescued >= total ? 'all' : rescued > 0 ? 'some' : 'none'; }

export function strikeEnemy(world: { killed: number }, player: { x: number; y: number; faceR: boolean; attackHits?: string[] }, enemy: Combatant, walls: Rect[]) {
  player.attackHits ??= [];
  const center = enemy.x + enemy.w / 2, distance = (center - player.x) * (player.faceR ? 1 : -1);
  if (enemy.hp <= 0 || player.attackHits.includes(enemy.id) || distance <= 0 || distance >= 66 || Math.abs(enemy.y + enemy.h / 2 - (player.y - 12)) >= 40) return 'miss';
  if (!clearLine({ x: player.x, y: player.y - 20 }, { x: center, y: enemy.y + enemy.h / 2 }, walls)) return 'miss';
  player.attackHits.push(enemy.id); enemy.kbX = (player.faceR ? 1 : -1) * 260;
  return damageEnemy(world, enemy, 1) ? 'killed' : 'hit';
}

/** A lowered bridge is a deck. Any other state is a full-height barrier at the hinge. */
export function bridgeSolid(bridge: Rect & { progress: number; hinge?: 'left' | 'right' }) {
  if (bridge.progress >= 1) return { x: bridge.hinge === 'right' ? bridge.x - bridge.w : bridge.x, y: bridge.y, w: bridge.w, h: bridge.h };
  const top = bridge.y + bridge.h / 2 - bridge.w;
  return { x: bridge.x - bridge.h / 2, y: top, w: bridge.h, h: 776 - top };
}
