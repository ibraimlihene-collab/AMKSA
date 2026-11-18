/**
 * Route integrity for all four worlds. The reachability bot replays the real player physics.
 * Each gate must stay closed until its mechanism is solved, and every sheep, puzzle and exit must be reachable once it is.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { reachable, canHit, leverBox } from '../src/game/scenario';
import { near } from '../src/game/reach';
import type { WorldState } from '../src/game/world';

const sheep = (w: WorldState, id: string) => { const s = w.sheep.find(v => v.id === id)!; return [s.x, s.y + 4] as const; };
const lever = (w: WorldState, id: string) => w.levers.find(l => l.id === id)!;

test('cedar: rope bridge, crate step and throwing slot gate both sheep; the exit is reachable', () => {
  const a = reachable(0), [x1, y1] = sheep(a.world, 'sheep-960'), [x2, y2] = sheep(a.world, 'sheep-2490');
  assert.ok(near(a.nodes, 650, 370), 'throwing ledge reachable'); assert.ok(!near(a.nodes, x1, y1), 'sheep 1 sealed by the raised bridge');
  assert.ok(canHit(a.solids, 620, 700, 370, leverBox(lever(a.world, 'target-bridge'))), 'bridge peg can be hit from the ledge');
  const b = reachable(0, { bridges: [0] });
  assert.ok(near(b.nodes, x1, y1), 'sheep 1 after the bridge'); assert.ok(!near(b.nodes, x2, y2), 'sheep 2 sealed by the log gate');
  assert.ok(!near(b.nodes, 2068, 212, 30, 4), 'high ledge needs the crate');
  assert.ok(!canHit(b.solids, 1866, 2090, 470, leverBox(lever(a.world, 'target-gate'))), 'gate target cannot be hit from the floor');
  const c = reachable(0, { bridges: [0], boxes: [{ x: 1990, y: 414 }] });
  assert.ok(near(c.nodes, 2068, 212, 30, 4), 'crate gives the high ledge'); assert.ok(!near(c.nodes, x2, y2), 'the crate alone does not pass the gate');
  assert.ok(canHit(c.solids, 2046, 2090, 212, leverBox(lever(a.world, 'target-gate'))), 'gate target through the slot from the ledge');
  const d = reachable(0, { bridges: [0], doors: [2] });
  assert.ok(near(d.nodes, x2, y2), 'sheep 2 after the gate'); assert.ok(near(d.nodes, 4362, 470, 50, 4), 'exit portal');
});

test('pasture: the stone scale, lift and crate step gate the route', () => {
  const a = reachable(1), [x1, y1] = sheep(a.world, 'sheep-920'), [x2, y2] = sheep(a.world, 'sheep-2540');
  assert.ok(near(a.nodes, 1208, 470), 'scale reachable'); assert.ok(!near(a.nodes, x1, y1), 'sheep 1 behind the scale gate');
  const b = reachable(1, { doors: [1] });
  assert.ok(near(b.nodes, x1, y1), 'sheep 1 after the scale'); assert.ok(!near(b.nodes, x2, y2), 'high ledge needs the lift');
  assert.ok(near(b.nodes, 2324, 470), 'lift plate reachable'); assert.ok(!near(b.nodes, 3440, 220, 140, 4), 'terrace needs the crate');
  assert.ok(near(b.nodes, 3400, 470), 'shelter under the terrace'); assert.ok(!near(b.nodes, 4372, 470, 50, 4), 'exit needs the terrace');
  assert.ok(near(reachable(1, { doors: [1], lift: true }).nodes, x2, y2), 'sheep 2 by lift');
  const c = reachable(1, { doors: [1], boxes: [{ x: 3236, y: 414 }] });
  assert.ok(near(c.nodes, 3440, 220, 60, 4), 'crate gives the terrace'); assert.ok(near(c.nodes, 4372, 470, 50, 4), 'exit portal');
});

test('gorge: the sluice drains one basin and floats the trunk; the lob lowers the bridge; the flood walkways reach the exit', () => {
  const a = reachable(2), [x1, y1] = sheep(a.world, 'sheep-1000'), [x2, y2] = sheep(a.world, 'sheep-2440');
  assert.ok(near(a.nodes, 1150, 470), 'sluice reachable'); assert.ok(!near(a.nodes, 1700, 470), 'flooded basin blocks the route'); assert.ok(!near(a.nodes, x1, y1));
  const b = reachable(2, { sluices: ['s1'] });
  assert.ok(near(b.nodes, 1700, 470), 'drained basin crossable'); assert.ok(near(b.nodes, x1, y1), 'floating trunk reaches sheep 1'); assert.ok(!near(b.nodes, x2, y2), 'raised bridge seals sheep 2');
  assert.ok(canHit(b.solids, 2210, 2450, 470, leverBox(lever(b.world, 'target-gorge'))), 'a lob over the raised bridge hits the peg');
  const c = reachable(2, { sluices: ['s1'], bridges: [0] });
  assert.ok(near(c.nodes, x2, y2), 'sheep 2 after the bridge'); assert.ok(near(c.nodes, 4300, 230, 60, 4), 'high walkway beside the exit');
});

test('snow: safe ice reaches sheep 1 without cracked plates; the bells lower the ice bridge; the summit is reachable', () => {
  const a = reachable(3), [x1, y1] = sheep(a.world, 'sheep-1000'), [x2, y2] = sheep(a.world, 'sheep-2580');
  assert.ok(near(a.nodes, x1, y1), 'sheep 1 over safe columns'); assert.ok(near(a.nodes, 2110, 470), 'bells reachable'); assert.ok(!near(a.nodes, x2, y2), 'raised ice bridge seals sheep 2');
  const b = reachable(3, { bridges: [0] });
  assert.ok(near(b.nodes, x2, y2), 'sheep 2'); assert.ok(near(b.nodes, 4700, 410, 100, 4), 'summit');
  for (const s of b.world.shelters) assert.ok(near(b.nodes, s.x + s.w / 2, s.y + s.h, s.w / 2, 4), `shelter at ${s.x} reachable`);
});
