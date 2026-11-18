import { createWorld, support, awardKeys } from '../src/game/world';
import { WORLDS, PUZZLES } from '../src/game/content';
import { overlap } from '../src/game/rules';

export function auditWorlds() {
  const problems: string[] = [];
  for (const [index, factory] of WORLDS.entries()) {
    const world = createWorld(index), def = factory();
    const fail = (message: string) => problems.push(`${def.id}: ${message}`);
    for (const [label, list] of [['lever', world.levers], ['enemy', world.enemies], ['sheep', world.sheep], ['door', world.doors]] as const) {
      if (new Set(list.map(e => e.id)).size !== list.length) fail(`Duplicate ${label} IDs.`);
    }
    for (const enemy of world.enemies) if (enemy.type !== 'eagle' && world.platforms.some(p => overlap(enemy, p))) fail(`Enemy ${enemy.id} intersects solid terrain.`);
    for (const sheep of world.sheep) if (support(world.platforms, sheep.x, 36) !== sheep.y + 4) fail(`Sheep ${sheep.id} has no full support.`);
    for (const box of world.boxes) if (world.platforms.some(p => overlap(box, p))) fail(`Box ${box.id} intersects solid terrain.`);
    for (const ev of world.elevators) {
      if (!world.plates.some(p => p.id === ev.plateId && p.elevatorId === ev.id)) fail(`Lift ${ev.id} has no matching plate.`);
      const shaft = { x: ev.x, y: ev.topY, w: ev.w, h: ev.baseY - ev.topY };
      if (world.platforms.some(p => overlap(shaft, p)) || world.doors.some(d => overlap(shaft, d))) fail(`Lift ${ev.id} has an obstructed shaft.`);
    }
    if (world.portal.w && support(world.platforms, world.portal.x + world.portal.w / 2, world.portal.w) !== world.portal.y + world.portal.h) fail('The exit lacks a walking surface.');
    if (def.goalP !== def.main.length) fail(`The puzzle goal ${def.goalP} differs from ${def.main.length} main puzzles.`);
    const keys = awardKeys(world);
    for (const m of def.main) if (!keys.includes(m)) fail(`Main puzzle ${m} has no mechanism that can award it.`);
    if (def.sheep.length !== def.goalS) fail('The rescue goal differs from the number of sheep.');
    for (const room of def.rooms) for (const id of room.done) if (!keys.includes(id) && !world.sheep.some(s => s.id === id)) fail(`Room ${room.id} waits for unknown ${id}.`);
    for (const f of world.floaters) if (!world.hazards.some(h => h.id === f.basin)) fail(`Floater ${f.id} has no basin.`);
    for (const s of world.sluices) for (const id of [s.a, s.b]) { const h = world.hazards.find(z => z.id === id); if (!h || h.lowY === undefined || h.highY === undefined) fail(`Sluice ${s.id} feeds an undefined basin.`); }
    for (const c of world.checkpoints) if (support(world.platforms.filter(p => p.type !== 'crack'), c.x, 40) !== c.y) fail(`Checkpoint at ${c.x} is not on flat, solid ground.`);
    for (const lever of world.levers) {
      if (lever.puzzleId !== undefined && !PUZZLES[lever.puzzleId]) fail(`Lever ${lever.id} has no puzzle.`);
      if (lever.lid >= 0 && !world.doors.some(d => d.id === lever.lid)) fail(`Lever ${lever.id} has no door.`);
      if (lever.bridgeId !== undefined && !world.bridges.some(b => b.id === lever.bridgeId)) fail(`Lever ${lever.id} has no bridge.`);
    }
    for (const door of world.doors) if (!world.levers.some(l => l.lid === door.id) && !world.plates.some(p => p.lid === door.id)) fail(`Door ${door.id} has no controller.`);
  }
  return problems;
}
// Geometry validation does not establish puzzle reachability or a complete playthrough.
if (process.argv[1]?.endsWith('audit-worlds.ts')) {
  const problems = auditWorlds(); problems.forEach(p => console.error(p));
  console.log(`Geometry audit: ${problems.length} errors. Full journey acceptance requires recorded playthroughs.`);
  if (problems.length) process.exitCode = 1;
}
