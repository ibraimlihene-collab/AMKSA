import { createWorld, support } from '../src/game/world';
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
    const puzzleCount = (world.levers.some(l => l.seq !== undefined) ? 1 : 0) + world.levers.filter(l => l.seq === undefined).length + world.plates.filter(p => p.elevatorId === undefined).length;
    if (puzzleCount !== def.goalP) fail(`The puzzle goal differs from ${puzzleCount} unique awards.`);
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
