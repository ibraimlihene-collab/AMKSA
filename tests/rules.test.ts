import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedClock, bridgeSolid, STEP, strikeEnemy, activate, award, clearLine, damageEnemy, downwardContact, ending, launch, movePlatform, projectileStep, trajectory } from '../src/game/rules';
import { createWorld, createPlayer, resetResources, snapshot } from '../src/game/world';
import { auditWorlds } from '../scripts/audit-worlds';
import { canonicalCode, defaultBindings, rebind } from '../src/game/input';

// BUG-01 and BUG-02: use the real cedar data, not a replacement mechanism.
test('a stone cannot bypass the cedar puzzle and solving it completes the sequence', () => {
  const w = createWorld(0), [a, b, c] = w.levers;
  assert.equal(activate(w, c, 'rock'), 'blocked');
  assert.equal(c.on, false); assert.equal(w.doors[0].open, false);
  assert.equal(activate(w, a, 'hand'), 'activated'); assert.equal(activate(w, b, 'rock'), 'activated');
  assert.equal(activate(w, c, 'hand'), 'puzzle'); assert.equal(w.seqProgress, 2);
  assert.equal(activate(w, c, 'puzzle'), 'activated');
  assert.equal(w.seqProgress, 3); assert.equal(w.doors[0].open, true); assert.equal(w.solved, 1);
  assert.equal(activate(w, c, 'puzzle'), 'unchanged'); assert.equal(w.solved, 1);
});
test('sequence mistakes and repeated attempts never duplicate historical credit', () => {
  const w = createWorld(0);
  for (let i = 0; i < 10; i++) {
    w.levers.forEach(l => { l.on = false; }); w.seqProgress = 0;
    activate(w, w.levers[1], 'hand'); assert.equal(w.seqProgress, 0);
    w.levers.forEach(l => activate(w, l, l.puzzleId ? 'puzzle' : 'hand'));
  }
  assert.equal(w.solved, 1); assert.deepEqual(w.awards, ['sequence']);
});
test('timed mechanisms reopen without another award', () => {
  const w = createWorld(3), l = w.levers[1];
  activate(w, l, 'puzzle'); l.on = false; w.doors[1].open = false;
  activate(w, l, 'hand'); assert.equal(w.doors[1].open, true); assert.equal(w.solved, 1);
});
test('the dynamic elevator plate is absent from unique awards', () => {
  const w = createWorld(1), restored = createWorld(1, { ...snapshot(w), awards: ['plate-1', 'plate-1'] });
  assert.equal(restored.solved, 0); assert.equal(award(restored, 'plate-0'), true); assert.equal(award(restored, 'plate-0'), false);
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
test('world snapshots preserve rescues, mechanisms, collected coins and unique credit', () => {
  const w = createWorld(2); w.sheep[0].rescued = true; w.coins[0].got = true; w.completionAwarded = true;
  activate(w, w.levers[0], 'rock'); activate(w, w.levers[1], 'puzzle');
  const restored = createWorld(2, snapshot(w));
  assert.equal(restored.sheep[0].rescued, true); assert.equal(restored.coins[0].got, true); assert.equal(restored.completionAwarded, true);
  assert.equal(restored.bridges[0].progress, 1); assert.equal(restored.levers[1].solved, true); assert.equal(restored.solved, 2);
});
test('an inconsistent save cannot open a protected puzzle gate', () => {
  const w = createWorld(2), saved = snapshot(w); saved.doors[2].open = true;
  const l = saved.levers[1]; l.on = true; l.solved = false;
  const restored = createWorld(2, saved); assert.equal(restored.doors[2].open, false);
});
test('resource recovery restores lost boxes and rocks without clearing puzzle history', () => {
  const w = createWorld(1); award(w, 'plate-0'); w.boxes.length = 0; w.rocks.length = 0; resetResources(w);
  assert.equal(w.boxes.length, 2); assert.equal(w.rocks.length, 4); assert.equal(w.solved, 1);
});
test('each world passes full rectangle spawn, lift shaft and safe exit validation', () => assert.deepEqual(auditWorlds(), []));
test('endings distinguish no rescues, partial rescues and all nine sheep', () => {
  assert.equal(ending(0, 9), 'none'); assert.equal(ending(4, 9), 'some'); assert.equal(ending(9, 9), 'all');
});
test('rebinding swaps conflicts and vertical arrows do not jump', () => {
  const keys = rebind(defaultBindings, 'jump', 'ArrowUp');
  assert.equal(keys.up, 'Space'); assert.equal(canonicalCode('ArrowUp', defaultBindings), 'ArrowUp'); assert.equal(canonicalCode('KeyZ', defaultBindings), '');
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
});
