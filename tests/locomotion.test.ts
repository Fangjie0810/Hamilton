import test from 'node:test';
import assert from 'node:assert/strict';
import { LocomotionSystem, WALK_SPEED } from '../src/systems/LocomotionSystem';

test('walking accelerates, brakes to rest, and advances gait only by actual distance', () => {
  const move = new LocomotionSystem(100, 0, 2000);
  move.step(1, 16);
  assert.ok(move.velocity > 0 && move.velocity < WALK_SPEED);
  assert.equal(move.pose, 'start');
  for (let i = 0; i < 30; i++) move.step(1, 16);
  assert.equal(move.velocity, WALK_SPEED); assert.equal(move.pose, 'walk');
  const before = move.x;
  move.step(0, 16); assert.ok(move.x > before && move.velocity < WALK_SPEED);
  for (let i = 0; i < 30; i++) move.step(0, 16);
  assert.equal(move.velocity, 0); assert.equal(move.pose, 'idle');
  const phase = move.phase; move.step(0, 16); assert.equal(move.phase, phase);
});
test('reversing brakes, shows a turn, then changes facing and direction', () => {
  const move = new LocomotionSystem(500, 0, 2000);
  for (let i = 0; i < 20; i++) move.step(1, 16);
  move.step(-1, 16); assert.ok(move.velocity > 0); assert.equal(move.facing, 1);
  let turning = false;
  for (let i = 0; i < 35; i++) { move.step(-1, 16); turning ||= move.pose === 'turn'; }
  assert.ok(turning); assert.equal(move.facing, -1); assert.equal(move.velocity, -WALK_SPEED);
});
test('click travel arrives exactly once without overshoot or oscillation at normal frame rates', () => {
  for (const frame of [8, 16, 33, 50]) {
    for (const destination of [101, 380, 75]) {
      const move = new LocomotionSystem(100, 70, 1000);
      let arrived = false;
      for (let i = 0; i < 1000 && !arrived; i++) {
        const before = move.x; arrived = move.step(0, frame, destination);
        assert.ok(move.x >= Math.min(100, destination) && move.x <= Math.max(100, destination));
        if (destination > 100) assert.ok(move.x >= before); else assert.ok(move.x <= before);
      }
      assert.ok(arrived); assert.equal(move.x, destination); assert.equal(move.velocity, 0);
    }
  }
});
test('walls do not produce tread-in-place animation, and explicit halt prevents resume drift', () => {
  const move = new LocomotionSystem(997, 70, 1000);
  for (let i = 0; i < 30; i++) move.step(1, 16);
  const phase = move.phase;
  assert.equal(move.x, 1000); assert.equal(move.pose, 'idle');
  move.step(1, 16); assert.equal(move.phase, phase);
  move.step(-1, 16); move.halt();
  const x = move.x; move.step(0, 16); assert.equal(move.x, x);
  const resumed = new LocomotionSystem(100, 70, 2000);
  resumed.step(1, 60000); assert.ok(resumed.x - 100 <= WALK_SPEED * 0.05);
  assert.throws(() => resumed.step(NaN, 16), RangeError);
});
