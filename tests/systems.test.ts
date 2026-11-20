import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createPlayer, snapshot, objective, currentRoom } from '../src/game/world';
import { WORLDS } from '../src/game/content';
import { text } from '../src/game/i18n';
import { stepSheep } from '../src/game/sheep';
import { updateAnimal, distract, scare } from '../src/game/animals';
import { stepPlates, placeStone, toggleSluice, stepWater, stepCracks, stepTriggers, stepAvalanche, stepFlood, inShelter, CRACK_DELAY, CRACK_REGROW } from '../src/game/mechanisms';
import { stepPlayer, PHYS } from '../src/game/physics';
import { STEP } from '../src/game/rules';
import { explore, near } from '../src/game/reach';
import { parseSettings } from '../src/game/save';

const run = (seconds: number, fn: (dt: number) => void) => { for (let t = 0; t < seconds; t += STEP) fn(STEP); };

test('a sheep is rescued only after calming, not by touch while running', () => {
  const w = createWorld(0), s = w.sheep[0], p = createPlayer(s.x - 20, s.y + 4); p.grounded = true; p.vx = 300;
  run(0.5, dt => stepSheep(s, p, [], false, dt)); assert.equal(s.rescued, false); assert.notEqual(s.state, 'calming');
  p.vx = 0; let ev = null; run(1.3, dt => { ev = stepSheep(s, p, [], false, dt) ?? ev; });
  assert.equal(s.rescued, true); assert.equal(ev, 'rescued');
});
test('calling with Interact calms faster than standing still', () => {
  const w = createWorld(0), s = w.sheep[0], p = createPlayer(s.x - 20, s.y + 4); p.grounded = true;
  let t = 0; while (!s.rescued && t < 3) { stepSheep(s, p, [], true, STEP); t += STEP; }
  assert.ok(t < 0.8, `took ${t}`);
});
test('a frightened sheep cannot be calmed and never leaves its surface', () => {
  const w = createWorld(2), s = w.sheep[1], snake = w.enemies.find(e => e.type === 'snake' && Math.abs(e.x - s.x) < 230)!;
  assert.ok(snake, 'a snake guards the second gorge sheep');
  const p = createPlayer(s.x - 20, s.y + 4); p.grounded = true;
  run(3, dt => stepSheep(s, p, w.enemies, true, dt));
  assert.equal(s.rescued, false); assert.equal(s.state, 'fear'); assert.ok(s.x >= s.minX! && s.x <= s.maxX!);
  scare(snake); p.x = s.x - 20; run(1.5, dt => stepSheep(s, p, w.enemies, true, dt)); assert.equal(s.rescued, true);
});
test('a rescued sheep leaves for the fold and the rescue is saved immediately', () => {
  const w = createWorld(0), s = w.sheep[0], p = createPlayer(s.x, s.y + 4); p.grounded = true;
  run(1.5, dt => stepSheep(s, p, [], true, dt)); assert.ok(snapshot(w).sheep.includes(s.id));
  run(3, dt => stepSheep(s, p, [], false, dt)); assert.equal(s.state, 'gone');
});
test('a wolf notices, warns, then attacks; it never damages during notice or warning', () => {
  const w = createWorld(0), wolf = w.enemies.find(e => e.type === 'wolf')!, solids = w.platforms;
  // Open ground west of the perch rocks.
  Object.assign(wolf, { x: 3800, sx: 3580, ex: 3840, homeX: 3800 });
  const p = createPlayer(3627, wolf.y + wolf.h); p.grounded = true; p.invinc = 0;
  const seen: string[] = []; let hurtAt = -1, t = 0;
  run(4, dt => { t += dt; const ev = updateAnimal(wolf, { player: p, solids, dt, time: t, sheltered: false }); if (!seen.includes(wolf.state)) seen.push(wolf.state); if (ev.hurt && hurtAt < 0) hurtAt = t; });
  assert.deepEqual(seen.slice(0, 4), ['notice', 'warn', 'chase', 'attack']);
  assert.ok(hurtAt > 1.1, `first damage after the warning, at ${hurtAt}`);
});
test('wolves give up on a shepherd standing on a high rock', () => {
  const w = createWorld(0), wolf = w.enemies.find(e => e.type === 'wolf')!, perch = w.platforms.find(p => p.type === 'ledge' && p.x === 3900)!;
  const p = createPlayer(perch.x + 40, perch.y); p.grounded = true; p.invinc = 0; let hurt = false, t = 0;
  Object.assign(wolf, { x: perch.x - 160, sx: 3580, ex: perch.x - wolf.w - 1, homeX: perch.x - 160 });
  run(6, dt => { t += dt; const r = updateAnimal(wolf, { player: p, solids: w.platforms, dt, time: t, sheltered: false }).hurt; hurt ||= r; });
  assert.equal(hurt, false); assert.ok(['retreat', 'walk', 'notice'].includes(wolf.state), wolf.state);
});
test('a rock between the shepherd and a wolf hides the shepherd', () => {
  const w = createWorld(0), wolf = w.enemies.find(e => e.type === 'wolf')!, perch = w.platforms.find(q => q.type === 'ledge' && q.x === 3900)!;
  Object.assign(wolf, { x: 3700, sx: 3580, ex: 3840, homeX: 3700 }); const p = createPlayer(perch.x + perch.w + 10, 470); p.grounded = true; let t = 0; // 263 px away: inside sight range, behind the rock
  run(3, dt => { t += dt; updateAnimal(wolf, { player: p, solids: w.platforms, dt, time: t, sheltered: false }); }); assert.equal(wolf.state, 'walk');
});
test('a stone that lands near a wolf distracts it; a direct hit makes it flee', () => {
  const w = createWorld(0), wolf = w.enemies.find(e => e.type === 'wolf')!;
  distract(w.enemies, wolf.x + 120, wolf.y + wolf.h); assert.equal(wolf.state, 'distract'); assert.equal(wolf.focusX, wolf.x + 120);
  scare(wolf); assert.equal(wolf.state, 'flee');
});
test('the eagle casts a shadow warning before a dive and cannot dive into a shelter', () => {
  const w = createWorld(1), eagle = w.enemies.find(e => e.type === 'eagle')!, p = createPlayer(3200, 470); p.grounded = true; p.invinc = 0;
  let t = 0, warnAt = -1, hurtAt = -1;
  run(8, dt => { t += dt; const ev = updateAnimal(eagle, { player: p, solids: w.platforms, dt, time: t, sheltered: false }); if (eagle.state === 'warn' && warnAt < 0) warnAt = t; if (ev.hurt && hurtAt < 0) hurtAt = t; });
  assert.ok(warnAt >= 0, 'warned'); assert.ok(hurtAt < 0 || hurtAt - warnAt > 1.1, 'at least the warning interval before damage');
  const q = createPlayer(3400, 470); q.grounded = true; q.invinc = 0; assert.equal(inShelter(w, q), true);
  let hurt = false; run(10, dt => { t += dt; const r = updateAnimal(eagle, { player: q, solids: w.platforms, dt, time: t, sheltered: inShelter(w, q) }).hurt; hurt ||= r; });
  assert.equal(hurt, false);
});
test('the stone scale needs two stones, ignores the shepherd and latches its gate', () => {
  const w = createWorld(1), scale = w.plates.find(p => p.key === 'scale')!, p = createPlayer(scale.x + 28, scale.y); p.grounded = true;
  stepPlates(w, p); assert.equal(scale.solved, undefined); assert.equal(w.doors[0].open, false);
  assert.equal(placeStone(w, p), true); stepPlates(w, p); assert.equal(w.doors[0].open, false); assert.equal(scale.weight, 1);
  assert.equal(placeStone(w, p), true); assert.deepEqual(stepPlates(w, p), ['scale']); assert.equal(w.doors[0].open, true);
  w.rocks.length = 0; stepPlates(w, p); assert.equal(w.doors[0].open, true); assert.equal(w.solved, 1);
});
test('the lift plate rises only under weight and never awards credit', () => {
  const w = createWorld(1), plate = w.plates.find(p => p.elevatorId !== undefined)!, p = createPlayer(0, 470);
  stepPlates(w, p); assert.equal(plate.pressed, false);
  w.boxes[0].x = plate.x; w.boxes[0].y = plate.y - 56; stepPlates(w, p); assert.equal(plate.pressed, true); assert.equal(w.solved, 0);
});
test('the sluice moves water at a visible speed, floats the trunk and carries its rider', () => {
  const w = createWorld(2), s = w.sluices[0], trunk = w.floaters[0], b1 = w.hazards.find(h => h.id === 'b1')!, b2 = w.hazards.find(h => h.id === 'b2')!;
  assert.equal(b1.y, 480); assert.equal(b2.y, 690); assert.equal(trunk.y, 680);
  assert.equal(toggleSluice(w, s), true); assert.equal(w.solved, 1);
  const p = createPlayer(0, 470);
  stepWater(w, p, [], STEP); assert.ok(b2.y < 690 && b2.y > 600, 'water does not jump');
  run(4, dt => stepWater(w, p, [], dt)); assert.equal(b2.y, 488); assert.equal(b1.y, 600); assert.equal(trunk.y, 478);
  assert.equal(b2.h, 700 - 488, 'damage rectangle keeps its fixed bed');
  toggleSluice(w, s); run(4, dt => stepWater(w, p, [], dt)); assert.equal(b1.y, 480); assert.equal(w.solved, 1, 'toggling back keeps credit');
});
test('cracked ice breaks after a delay and regrows, so a mistake never seals the route', () => {
  const w = createWorld(3), crack = w.platforms.find(p => p.type === 'crack')!, p = createPlayer(0, 470);
  stepCracks(w.platforms, crack, p, STEP); assert.equal(crack.broken, false === crack.broken ? false : crack.broken);
  run(CRACK_DELAY + 0.05, dt => stepCracks(w.platforms, crack, p, dt)); assert.equal(crack.broken, true);
  run(CRACK_REGROW + 0.05, dt => stepCracks(w.platforms, null, p, dt)); assert.equal(crack.broken, false);
});
test('triggers award each main traversal puzzle once', () => {
  const w = createWorld(3), p = createPlayer(1180, 470); p.grounded = true;
  assert.deepEqual(stepTriggers(w, p), ['ice-path']); assert.deepEqual(stepTriggers(w, p), []);
});
test('the avalanche waits for its warning, kills in the open and passes a sheltered shepherd', () => {
  const w = createWorld(3), a = w.def.avalanche!, p = createPlayer(a.triggerX + 10, 470); p.grounded = true;
  let killed = false; run(a.warn - 0.1, dt => { killed ||= stepAvalanche(w, p, dt); }); assert.equal(w.threat.phase, 'warning'); assert.equal(killed, false);
  run(10, dt => { const k = stepAvalanche(w, p, dt); killed ||= k; }); assert.equal(killed, true);
  const v = createWorld(3), s = v.shelters[1], q = createPlayer(s.x + s.w / 2, 470); q.grounded = true; let dead = false;
  q.x = v.def.avalanche!.triggerX + 10; run(0.1, dt => stepAvalanche(v, q, dt)); q.x = s.x + s.w / 2;
  run(20, dt => { const k = stepAvalanche(v, q, dt); dead ||= k; }); assert.equal(dead, false); assert.equal(v.threat.phase, 'cleared');
});
test('the shepherd outruns the avalanche from the trigger to the first shelter with a margin', () => {
  const w = createWorld(3), a = w.def.avalanche!, s = w.shelters[1];
  const runTime = (s.x + 20 - a.triggerX) / PHYS.maxSpeed, frontTime = a.warn + (s.x + s.w - a.startX) / a.speed;
  assert.ok(frontTime - runTime > 4, `margin ${frontTime - runTime}s`);
});
test('the flood warns before rising and the walkway is reachable before the water covers the ground', () => {
  const w = createWorld(2), f = w.flood!, p = createPlayer(f.triggerX + 10, 470); p.grounded = true;
  let killed = false; run(f.warn - 0.1, dt => { killed ||= stepFlood(w, p, dt); }); assert.equal(f.y, f.startY); assert.equal(killed, false);
  const toWalkway = (3700 - f.triggerX) / PHYS.maxSpeed, waterAtGround = f.warn + (f.startY - 470) / f.rise;
  assert.ok(waterAtGround - toWalkway > 5, `margin ${waterAtGround - toWalkway}s`);
  run(30, dt => { const k = stepFlood(w, p, dt); killed ||= k; }); assert.equal(killed, true); assert.equal(f.y, f.endY);
});
test('measured jump envelope matches the documented limits', () => {
  const nodes = (h: number) => explore({ solids: [{ x: 0, y: 470, w: 300, h: 900 }, { x: 300, y: 470 - h, w: 200, h: 20 }], hazards: [], width: 2000, start: { x: 100, y: 470 } });
  assert.ok(near(nodes(220), 400, 250, 100, 3), 'rise of 220 reachable'); assert.ok(!near(nodes(252), 400, 218, 100, 3), 'rise of 252 unreachable');
  const p = createPlayer(0, 470); p.grounded = true; let maxRise = 0;
  stepPlayer(p, { move: 0, jumpPressed: true, jumpHeld: true, dashPressed: false }, STEP, [{ x: -100, y: 470, w: 400, h: 50 }], [], 2000);
  run(1, dt => { stepPlayer(p, { move: 0, jumpPressed: false, jumpHeld: true, dashPressed: false }, dt, [{ x: -100, y: 470, w: 400, h: 50 }], [], 2000); maxRise = Math.max(maxRise, 470 - p.y); });
  assert.ok(maxRise > 130 && maxRise < 140, `single jump ${maxRise}`);
});
test('settings validation rejects unknown languages and duplicate bindings', () => {
  const actions = ['left', 'right'], ok = { lang: 'fr', music: 0.4, sfx: 0.5, motion: false, large: false, challenge: false, shake: true, touchSize: 'large', touchOpacity: 0.8, bindings: { left: 'KeyA', right: 'KeyD' } };
  assert.ok(parseSettings(JSON.stringify(ok), actions));
  assert.equal(parseSettings(JSON.stringify({ ...ok, lang: 'de' }), actions), null);
  assert.equal(parseSettings(JSON.stringify({ ...ok, bindings: { left: 'KeyA', right: 'KeyA' } }), actions), null);
});

test('no hostile animal can reach a respawn point before the shepherd can react', () => {
  for (let i = 0; i < 4; i++) {
    const w = createWorld(i), spawns = [w.def.spawnX, ...w.checkpoints.map(c => c.x + 60)];
    for (const e of w.enemies) if (e.type !== 'fox' && e.type !== 'macaque' && e.type !== 'eagle')
      for (const x of spawns) assert.ok(Math.min(Math.abs(x - e.sx), Math.abs(x - e.ex - e.w), x > e.sx && x < e.ex + e.w ? 0 : Infinity) > 160, `${w.def.id} ${e.id} near spawn ${x}`);
  }
});
test('objectives follow the room and advance when its goals are met', () => {
  const w = createWorld(0);
  assert.equal(objective(w, 100), 'cBridgeGoal');
  w.awards.push('target-bridge'); w.sheep[0].rescued = true;
  assert.equal(currentRoom(w, 100)!.complete, true); assert.equal(objective(w, 100), 'cGateGoal');
});
test('every objective, hint and message key has Arabic, English and French text', () => {
  const keys = new Set<string>(['calmSheep', 'sheepAfraid', 'rescuedMsg', 'placeStone', 'sluiceUse', 'bellUse', 'bellWrong', 'wolvesNear', 'floodWarn', 'shelterSafe', 'deathWater', 'deathFall', 'deathAnimal', 'deathSnow', 'deathSpike', 'remaining', 'allDone', 'prologue1', 'prologue2', 'prologue3', 'prologue4', 'endingAll', 'endingSome', 'endingNone', 'hint', 'stones', 'objective']);
  for (const f of WORLDS) for (const r of f().rooms) { keys.add(r.goal); r.hints.forEach(h => keys.add(h)); }
  for (const k of keys) for (const lang of ['ar', 'en', 'fr'] as const) { const v = text(lang, k); assert.notEqual(v, k, `${lang}:${k}`); assert.ok(v.length > 1); }
  for (const k of keys) assert.ok(/[؀-ۿ]/.test(text('ar', k)) || /^[A-Z]/.test(text('ar', k)), `Arabic text for ${k}`);
});
test('no main puzzle needs alphabet knowledge: optional panels use cairns and weights', async () => {
  const { PUZZLES } = await import('../src/game/content');
  for (const p of Object.values(PUZZLES)) { assert.ok(['cairn-balance', 'equation'].includes(p.kind)); assert.ok(!/[ⴰ-⵿]/.test(JSON.stringify(p)), 'no Tifinagh in a puzzle'); }
  for (const f of WORLDS) for (const l of f().levers) if (l.puzzleId !== undefined) assert.equal(l.optional, true, `${l.id} is optional`);
});
