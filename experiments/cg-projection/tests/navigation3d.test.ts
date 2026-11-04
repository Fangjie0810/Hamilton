import test from 'node:test';
import assert from 'node:assert/strict';
import { WalkMap, Walker } from '../src/demo3d/Navigation';

const bounds = { x: 0, z: 0, width: 20, depth: 20 };
test('3D paths walk around buildings and never cut obstacle corners', () => {
  const map = new WalkMap(bounds, [{ x: 0, z: 0, width: 4, depth: 6 }]);
  const start = { x: -5, z: 0 }, goal = { x: 5, z: 0 };
  const path = map.path(start, goal);
  assert.ok(path.length >= 2);
  let previous = start;
  for (const step of path) { assert.ok(map.clear(previous, step)); previous = step; }
  assert.deepEqual(path.at(-1), goal);
  const actor = new Walker({ ...start }, map); actor.travel(goal);
  for (let i = 0; i < 2000 && actor.path.length; i++) { actor.tick({ x: 0, z: 0 }, 1 / 60); assert.ok(map.free(actor.position)); }
  assert.ok(Math.hypot(actor.position.x - goal.x, actor.position.z - goal.z) < .15);
});
test('blocked destinations snap nearby, disconnected regions return no path', () => {
  const map = new WalkMap(bounds, [{ x: 0, z: 0, width: 2, depth: 30 }]);
  assert.deepEqual(map.path({ x: -5, z: 0 }, { x: 5, z: 0 }), []);
  assert.ok(map.free(map.nearest({ x: 0, z: 0 })!));
});
test('keyboard walking normalizes diagonals, collides, and halts without drift', () => {
  const map = new WalkMap(bounds, [{ x: 2, z: 0, width: 2, depth: 10 }]);
  const actor = new Walker({ x: 0, z: 0 }, map);
  for (let i = 0; i < 120; i++) actor.tick({ x: 1, z: 0 }, 1 / 60);
  assert.ok(actor.position.x <= .72); assert.equal(actor.moving, false);
  actor.halt(); const before = { ...actor.position };
  actor.tick({ x: 0, z: 0 }, 60); assert.deepEqual(actor.position, before);
  const straight = new Walker({ x: -5, z: -5 }, map), diagonal = new Walker({ x: -5, z: -5 }, map);
  straight.tick({ x: 0, z: 1 }, .05); diagonal.tick({ x: 1, z: 1 }, .05);
  assert.ok(Math.abs(straight.distance - diagonal.distance) < 1e-6);
  assert.ok(straight.distance <= 2.8 * .05);
});
