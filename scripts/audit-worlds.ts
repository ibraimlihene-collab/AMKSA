import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLDS } from '../src/App';

const PLAYER_HALF_W = 11;
const MAX_FLAT_GAP = 370;
const MAX_ASCENT = 165;

type Problem = { world: string; severity: 'error' | 'warn'; message: string };
const problems: Problem[] = [];
const fail = (world: string, message: string) => problems.push({ world, severity: 'error', message });
const warn = (world: string, message: string) => problems.push({ world, severity: 'warn', message });

function topAt(platforms: any[], x: number): number | null {
  const candidates = platforms.filter(p => x >= p.x && x <= p.x + p.w && !(p.type === 'break' && p.broken));
  return candidates.length ? Math.min(...candidates.map(p => p.y)) : null;
}

for (const createWorld of WORLDS) {
  const w: any = createWorld();
  const name = w.id;
  const doorsById = new Map<number, any>();
  for (const d of w.doors) {
    if (doorsById.has(d.id)) fail(name, `Duplicate door id ${d.id}`);
    doorsById.set(d.id, d);
    if (d.w > 0 && d.h < 300) fail(name, `Door ${d.id} is only ${d.h}px tall and can be jump/dash-bypassed`);
  }
  const bridgesById = new Map(w.bridges.map((b: any) => [b.id, b]));

  for (const l of w.levers) {
    const support = topAt(w.platforms, l.x);
    if (support === null) fail(name, `Lever at x=${l.x} has no supporting platform`);
    else if (Math.abs(l.y - support) > 50) fail(name, `Lever at x=${l.x} floats ${Math.abs(l.y - support)}px from its platform`);
    if (l.bridgeId !== undefined && !bridgesById.has(l.bridgeId)) fail(name, `Lever at x=${l.x} targets missing bridge ${l.bridgeId}`);
    if (l.lid >= 0 && !doorsById.has(l.lid)) fail(name, `Lever at x=${l.x} targets missing door ${l.lid}`);
    if (l.target && l.bridgeId === undefined) fail(name, `Distant target at x=${l.x} controls no bridge`);
  }

  const seq = w.levers.filter((l: any) => l.seq !== undefined).sort((a: any, b: any) => a.seq - b.seq);
  if (seq.length) {
    seq.forEach((l: any, i: number) => {
      if (l.seq !== i + 1) fail(name, `Sequence lever numbers are not contiguous at ${i + 1}`);
      if (i && l.x <= seq[i - 1].x) warn(name, `Sequence lever ${l.seq} is not later in the natural left-to-right route`);
    });
  }

  for (const p of w.plates) {
    const support = topAt(w.platforms, p.x + p.w / 2);
    if (support === null) fail(name, `Pressure plate at x=${p.x} floats over a gap`);
    else if (Math.abs(p.y - support) > 12) fail(name, `Pressure plate at x=${p.x} is ${Math.abs(p.y - support)}px off its surface`);
    if (p.lid >= 0 && !doorsById.has(p.lid)) fail(name, `Pressure plate at x=${p.x} targets missing door ${p.lid}`);
    if (p.elevatorId !== undefined && !w.elevators.some((e: any) => e.id === p.elevatorId)) fail(name, `Pressure plate at x=${p.x} targets missing elevator ${p.elevatorId}`);
  }

  for (const s of w.sheep) if (topAt(w.platforms, s.x) === null) fail(name, `Sheep at x=${s.x} has no platform beneath it`);
  for (const b of w.boxes) if (topAt(w.platforms, b.x + b.w / 2) === null) warn(name, `Box at x=${b.x} begins without a supporting platform`);

  if (w.goalE > w.enemies.length) fail(name, `Enemy goal ${w.goalE} exceeds ${w.enemies.length} enemies`);
  if (w.goalS > w.sheep.length) fail(name, `Sheep goal ${w.goalS} exceeds ${w.sheep.length} sheep`);
  const possiblePuzzles = (seq.length ? 1 : 0) + w.levers.filter((l: any) => l.seq === undefined).length + w.plates.filter((p: any) => p.elevatorId === undefined).length;
  if (w.goalP !== possiblePuzzles) fail(name, `Puzzle goal ${w.goalP} does not match ${possiblePuzzles} solvable puzzle events`);

  const landable = [
    ...w.platforms.filter((p: any) => p.h >= 100),
    ...w.mplatforms,
    ...w.bridges.map((b: any) => ({ x: b.x, y: b.y, w: b.w, h: b.h, type: 'bridge' })),
  ].sort((a: any, b: any) => a.x - b.x);
  for (let i = 0; i < landable.length - 1; i++) {
    const a = landable[i];
    const right = a.x + a.w;
    const next = landable.find((b: any, j: number) => j > i && b.x >= right - 1);
    if (!next) continue;
    const gap = next.x - right;
    const rise = a.y - next.y; // positive means next platform is higher
    if (gap > MAX_FLAT_GAP && rise > -45) warn(name, `Long ${gap}px gap from x=${right} to ${next.x}`);
    if (rise > MAX_ASCENT) fail(name, `Required ascent ${rise}px exceeds safe jump envelope`);
  }

  for (const d of w.doors) {
    if (!d.w) continue;
    const leverControls = w.levers.filter((l: any) => l.lid === d.id);
    const plateControls = w.plates.filter((p: any) => p.lid === d.id);
    const controls = [...leverControls, ...plateControls];
    if (!controls.length) fail(name, `Door ${d.id} blocks the route but has no controller`);
    if (controls.length && controls.every((c: any) => c.x >= d.x)) fail(name, `Door ${d.id} is before all of its controllers and can soft-lock the route`);
    for (const l of leverControls) {
      if (l.timed) {
        const travelSeconds = Math.max(0, d.x - l.x) / 300;
        if (travelSeconds > l.timed * 0.78) fail(name, `Timed door ${d.id} allows ${l.timed}s but needs about ${travelSeconds.toFixed(1)}s of travel`);
      }
    }
  }
  for (const ev of (w.elevators || [])) {
    const plateCtrl = w.plates.find((p: any) => p.id === ev.plateId);
    if (!plateCtrl) fail(name, `Elevator ${ev.id} has no linked pressure plate`);
    if (plateCtrl && Math.abs(plateCtrl.x - ev.x) > 300) warn(name, `Elevator ${ev.id} plate is far from the elevator`);
    if (ev.topY >= ev.baseY) fail(name, `Elevator ${ev.id} topY must be above baseY`);
  }
  for (const b of w.bridges) {
    const targets = w.levers.filter((l: any) => l.bridgeId === b.id);
    if (!targets.length) fail(name, `Bridge ${b.id} has no target/controller`);
    if (targets.length && targets.every((t: any) => t.x >= b.x + b.w)) fail(name, `Bridge ${b.id} controller is only reachable after crossing the bridge`);
    if (b.w < 80) warn(name, `Bridge ${b.id} is only ${b.w}px long and may not cover a meaningful gap`);
  }
  if (w.portal.w > 0 && (w.portal.x < 0 || w.portal.x > w.width + PLAYER_HALF_W)) fail(name, `Portal is outside world bounds`);
  if (w.threat === 'avalanche' && w.checkpoints.length < 2) fail(name, `Avalanche world needs multiple shelters/checkpoints`);
}

// Regression guards for global mechanics that previously caused reported glitches.
const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '../src/App.tsx'), 'utf8');
const mechanicsGuards: [RegExp, string][] = [
  [/Math\.ceil\(Math\.abs\(totalDX\) \/ 7\)/, 'Player horizontal collision must remain sub-stepped (dash anti-tunnelling)'],
  [/Math\.ceil\(Math\.abs\(totalDY\) \/ 7\)/, 'Player vertical collision must remain sub-stepped (fall-through prevention)'],
  [/const occupied = hit\(pR\(player\), d\)/, 'Timed gates must not close inside the player'],
  [/phase === 'warning'/, 'Avalanche must retain a warning phase'],
  [/th\.frontX > player\.x - 32/, 'Avalanche must use a physical moving front, not arbitrary periodic damage'],
  [/h\.y > GY - 50/, 'Flood rise must remain capped to a reasonable height'],
  [/world\.opened = true/, 'World portal must remain traversable without completing optional tasks'],
];
for (const [pattern, message] of mechanicsGuards) if (!pattern.test(source)) fail('global', message);

const errors = problems.filter(p => p.severity === 'error');
const warnings = problems.filter(p => p.severity === 'warn');
for (const p of problems) console.log(`${p.severity.toUpperCase()} [${p.world}] ${p.message}`);
console.log(`\nAudit summary: ${errors.length} error(s), ${warnings.length} warning(s)`);
if (errors.length) process.exit(1);
