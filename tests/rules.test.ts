import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedClock, bridgeSolid, STEP, strikeEnemy, activate, award, clearLine, damageEnemy, downwardContact, ending, launch, movePlatform, projectileStep, trajectory } from '../src/game/rules';
import { createWorld, createPlayer, resetResources, snapshot } from '../src/game/world';
import { auditWorlds } from '../scripts/audit-worlds';
import { canonicalCode, defaultBindings, rebind } from '../src/game/input';

// BUG-01 and BUG-02: a stone never bypasses a panel, and a panel answer enters the same transition.
test('a stone cannot bypass a mechanism panel and optional panels never count as main puzzles', () => {
  const w = createWorld(0), panel = w.levers.find(l => l.id === 'cairn-count')!;
  assert.equal(activate(w, panel, 'rock'), 'blocked'); assert.equal(panel.on, false);
  assert.equal(activate(w, panel, 'hand'), 'puzzle');
  assert.equal(activate(w, panel, 'puzzle'), 'activated'); assert.equal(w.solved, 0);
  assert.equal(activate(w, panel, 'puzzle'), 'unchanged');
});
test('bell order mistakes reset the attempt and never duplicate historical credit', () => {
  const w = createWorld(3), bells = [...w.levers].sort((a, b) => a.seq! - b.seq!);
  for (let i = 0; i < 10; i++) {
    w.levers.forEach(l => { l.on = false; }); w.seqProgress = 0;
    assert.equal(activate(w, bells[1], 'hand'), 'wrong'); assert.equal(w.seqProgress, 0);
    bells.forEach(l => activate(w, l, 'hand'));
  }
  assert.equal(w.solved, 1); assert.deepEqual(w.awards, ['sequence']); assert.equal(w.bridges[0].down, true);
});
test('timed mechanisms reopen without another award', () => {
  const w = { awards: [] as string[], solved: 0, seqProgress: 0, seqFailed: false, seqSolved: false, bridges: [], doors: [{ id: 1, open: false, timer: undefined as number | undefined }], levers: [{ id: 'gate', on: false, lid: 1, timed: 8, puzzleId: 4 }] };
  activate(w, w.levers[0], 'puzzle'); w.levers[0].on = false; w.doors[0].open = false;
  assert.equal(activate(w, w.levers[0], 'hand'), 'activated'); assert.equal(w.doors[0].open, true); assert.equal(w.doors[0].timer, 8); assert.equal(w.solved, 1);
});
test('the dynamic lift plate is absent from unique awards', () => {
  const w = createWorld(1), restored = createWorld(1, { ...snapshot(w), awards: ['plate-1', 'plate-1'] });
  assert.equal(restored.solved, 0); assert.equal(award(restored, 'scale'), true); assert.equal(award(restored, 'scale'), false); assert.equal(restored.solved, 1);
});
test('simultaneous lethal damage grants one death', () => {
  const w = createWorld(0), e = w.enemies[1];
  assert.equal(damageEnemy(w, e, 2), true); assert.equal(damageEnemy(w, e, 1), false); assert.equal(damageEnemy(w, e, 99), false); assert.equal(w.killed, 1);
});
test('a falling box can crush before it reaches the ground, while side contact cannot', () => {
  const enemy = { x: 50, y: 100, w: 50, h: 34 };
  assert.equal(downwardContact({ x: 60, y: 60, w: 50, h: 50 }, 80, 300, enemy), true);
  assert.equal(downwardContact({ x: 60, y: 60, w: 50, h: 50 }, 110, 0, enemy), false);
});
test('solid walls prevent a melee line and line of sight', () => {
  assert.equal(clearLine({ x: 0, y: 20 }, { x: 100, y: 20 }, [{ x: 40, y: 0, w: 10, h: 50 }]), false);
  assert.equal(clearLine({ x: 0, y: 20 }, { x: 30, y: 20 }, [{ x: 40, y: 0, w: 10, h: 50 }]), true);
});
for (const fps of [30, 60, 120]) test(`platform rider and projectile replay at ${fps} Hz`, () => {
  const clock = new FixedClock(), platform = { x: 0, y: 200, w: 120, h: 14, vx: 60 }, player = createPlayer(50, 200);
  player.vy = 0; const rock = launch(0, 0, true, -0.7, 0.5, 100);
  const expected = trajectory(rock, [], 1).at(-1)!;
  // One second gives the same sixty physics steps at each display refresh rate.
  for (let i = 0; i < fps; i++) clock.advance(1 / fps, dt => { movePlatform(platform, platform.x + 60 * dt, platform.y, player, [], []); projectileStep(rock, dt); });
  assert.ok(Math.abs(player.x - 110) < 1e-7); assert.ok(Math.abs(rock.x - expected.x) < 1e-7); assert.ok(Math.abs(rock.y - expected.y) < 1e-7);
});
test('platform reversal uses the actual delta, including boxes and stacked passengers', () => {
  const p = { x: 100, y: 200, w: 100, h: 14, vx: -80 }, box = { x: 120, y: 160, w: 40, h: 40, vy: 0 }, player = createPlayer(140, 160);
  movePlatform(p, 98, 198, player, [box], []);
  assert.equal(box.x, 118); assert.equal(box.y, 158); assert.equal(player.x, 138); assert.equal(player.y, 158);
});
test('a lift stops before it presses its rider into a ceiling', () => {
  const p = { x: 0, y: 200, w: 100, h: 14, vx: 60 }, rider = createPlayer(50, 200);
  movePlatform(p, 0, 100, rider, [], [{ x: 0, y: 140, w: 100, h: 10 }]);
  assert.ok(rider.y - rider.h >= 150); assert.equal(p.y, rider.y);
});
test('clock handles delayed frames and excludes tab suspension', () => {
  const clock = new FixedClock(); let ticks = 0;
  clock.advance(0.2, () => { ticks++; }); assert.equal(ticks, 12);
  clock.advance(5, () => { ticks++; }); assert.equal(ticks, 12);
  clock.advance(STEP, () => false); assert.equal(clock.debt, 0);
});
test('world snapshots preserve rescues, sluice state, bridges, collected coins and unique credit', () => {
  const w = createWorld(2); w.sheep[0].rescued = true; w.coins[0].got = true; w.completionAwarded = true;
  activate(w, w.levers.find(l => l.id === 'target-gorge')!, 'rock'); award(w, 'sluice');
  const restored = createWorld(2, snapshot(w));
  assert.equal(restored.sheep[0].rescued, true); assert.equal(restored.sheep[0].state, 'gone'); assert.equal(restored.coins[0].got, true); assert.equal(restored.completionAwarded, true);
  assert.equal(restored.bridges[0].progress, 1); assert.equal(restored.solved, 2); assert.equal(restored.sluices[0].toB, true);
  assert.equal(restored.hazards.find(h => h.id === 'b2')!.y, 488); assert.equal(restored.hazards.find(h => h.id === 'b1')!.y, 600); assert.equal(restored.floaters[0].y, 478);
});
test('an inconsistent save cannot open a protected gate', () => {
  const w = createWorld(0), saved = snapshot(w); saved.doors[0].open = true;
  const restored = createWorld(0, saved); assert.equal(restored.doors[0].open, false);
});
test('a save cannot invent awards that the room does not offer', () => {
  const w = createWorld(0), restored = createWorld(0, { ...snapshot(w), awards: ['target-gate', 'made-up', 'scale'] });
  assert.deepEqual(restored.awards, ['target-gate']); assert.equal(restored.solved, 1);
});
test('resource recovery restores lost boxes and rocks without clearing puzzle history', () => {
  const w = createWorld(1); award(w, 'scale'); w.boxes.length = 0; w.rocks.length = 0; resetResources(w);
  assert.equal(w.boxes.length, 2); assert.equal(w.rocks.length, 5); assert.equal(w.solved, 1);
});
test('each world passes full rectangle spawn, lift shaft and safe exit validation', () => assert.deepEqual(auditWorlds(), []));
test('endings distinguish no rescues, partial rescues and all eight sheep', () => {
  assert.equal(ending(0, 8), 'none'); assert.equal(ending(4, 8), 'some'); assert.equal(ending(8, 8), 'all');
});
test('the journey has eight main sheep, two in each world, with stable unique IDs', () => {
  for (let i = 0; i < 4; i++) { const w = createWorld(i); assert.equal(w.sheep.length, 2); assert.equal(w.def.goalS, 2); assert.equal(new Set(w.sheep.map(s => s.id)).size, 2); }
});
test('rebinding swaps conflicts and vertical arrows do not jump', () => {
  const keys = rebind(defaultBindings, 'jump', 'ArrowUp');
  assert.equal(keys.up, 'Space'); assert.equal(defaultBindings.hint, 'KeyH'); assert.equal(canonicalCode('ArrowUp', defaultBindings), 'ArrowUp'); assert.equal(canonicalCode('KeyZ', defaultBindings), '');
});

for (const fps of [30, 60, 120]) test(`one punch damages each enemy once at ${fps} Hz`, () => {
  const w = createWorld(0), e = w.enemies[1], p = createPlayer(e.x - 10, e.y + e.h / 2 + 12); p.faceR = true;
  const clock = new FixedClock();
  for (let i = 0; i < fps; i++) clock.advance(1 / fps, () => { strikeEnemy(w, p, e, []); });
  assert.equal(e.hp, 1); assert.equal(w.killed, 0);
  p.attackHits = []; assert.equal(strikeEnemy(w, p, e, []), 'killed'); assert.equal(w.killed, 1);
});

test('bridge entrance stays blocked above and below the deck until it locks', () => {
  const b = { x: 1630, y: 410, w: 220, h: 14, progress: 0.5 }, closed = bridgeSolid(b);
  assert.ok(closed.y < 410); assert.ok(closed.y + closed.h > 656);
  const down = bridgeSolid({ ...b, progress: 1 }); assert.equal(down.y, 410); assert.equal(down.h, 14);
  const right = bridgeSolid({ ...b, progress: 1, hinge: 'right' }); assert.equal(right.x, 1630 - 220);
});
