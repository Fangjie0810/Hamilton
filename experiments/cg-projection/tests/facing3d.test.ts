import test from 'node:test';
import assert from 'node:assert/strict';
import { FACINGS, screenFacing, actorPose, ATLAS_COLUMNS, ATLAS_ROWS } from '../src/demo3d/Facing';

function worldDirection(angle: number, yaw = 0) { return { x: Math.sin(angle + yaw), z: Math.cos(angle + yaw) }; }
test('eight views follow screen direction at any camera yaw, including angle wrap', () => {
  for (const yaw of [0, .48, -1.2, Math.PI, Math.PI * 7]) {
    FACINGS.forEach((facing, i) => assert.equal(screenFacing(worldDirection(i * Math.PI / 4, yaw), yaw), facing));
  }
});
test('view selection stays stable near a boundary and preserves the last idle heading', () => {
  const radians = (degree: number) => degree * Math.PI / 180;
  assert.equal(screenFacing(worldDirection(radians(23)), 0, 's'), 's');
  assert.equal(screenFacing(worldDirection(radians(26)), 0, 's'), 'se');
  assert.equal(screenFacing(worldDirection(radians(22)), 0, 'se'), 'se');
  assert.equal(screenFacing(worldDirection(radians(19)), 0, 'se'), 's');
  assert.equal(screenFacing(worldDirection(radians(-179)), 0, 'n'), 'n');
  assert.equal(screenFacing({ x: 0, z: 0 }, .7, 'nw'), 'nw');
  assert.equal(screenFacing({ x: NaN, z: 1 }, 0, 'se'), 'se');
});
test('all eight Hamilton views have distinct idle/step poses, mirrored diagonals, and valid cells', () => {
  const signatures = new Set<string>();
  for (const facing of FACINGS) {
    const idle = actorPose(facing, 100, false), steps = [0, .41, .81, 1.21].map(distance => actorPose(facing, distance, true));
    signatures.add(`${idle.frame}:${idle.flip}`);
    assert.equal(new Set(steps.map(pose => pose.frame)).size, 4);
    assert.ok(steps.every(pose => pose.frame !== idle.frame && pose.frame >= 0 && pose.frame < ATLAS_COLUMNS * ATLAS_ROWS));
    assert.deepEqual(actorPose(facing, 1.61, true), steps[0]);
  }
  assert.equal(signatures.size, 8);
  for (const [right, left] of [['se', 'sw'], ['ne', 'nw'], ['e', 'w']] as const) {
    assert.equal(actorPose(right, .41, true).frame, actorPose(left, .41, true).frame);
    assert.equal(actorPose(right, .41, true).flip, false); assert.equal(actorPose(left, .41, true).flip, true);
  }
});
test('Burr has eight idle views independent of the player walk phase', () => {
  const signatures = new Set(FACINGS.map(facing => { const pose = actorPose(facing, 0, false, true); assert.deepEqual(pose, actorPose(facing, 10, true, true)); return `${pose.frame}:${pose.flip}`; }));
  assert.equal(signatures.size, 8);
});
