import test from 'node:test';
import assert from 'node:assert/strict';
import { HIGH_ANGLE_CAMERA_PITCH, MAX_CAMERA_PITCH, MIN_CAMERA_PITCH, orbitCamera, usesHighAngleArt } from '../src/demo3d/CameraOrbit';
import { SCENES } from '../src/demo3d/SceneCatalog';

test('every entry camera starts at its lowest allowed elevation, with the debate square closer', () => {
  for (const scene of Object.values(SCENES)) assert.equal(scene.camera.pitch, MIN_CAMERA_PITCH, scene.id);
  assert.equal(SCENES.square.camera.radius, 24);
});

test('orbit preserves mouse sensitivity and returns immediately from either elevation bound', () => {
  const raised = orbitCamera({ yaw: .48, pitch: MIN_CAMERA_PITCH }, 20, 40);
  assert.ok(Math.abs(raised.yaw - .36) < 1e-10);
  assert.ok(Math.abs(raised.pitch - .59) < 1e-10);
  const ceiling = orbitCamera(raised, 0, 10000);
  assert.equal(ceiling.pitch, MAX_CAMERA_PITCH);
  assert.ok(orbitCamera(ceiling, 0, -1).pitch < MAX_CAMERA_PITCH);
  const floor = orbitCamera(raised, 0, -10000);
  assert.equal(floor.pitch, MIN_CAMERA_PITCH);
  assert.ok(orbitCamera(floor, 0, 1).pitch > MIN_CAMERA_PITCH);
});

test('overhead cast art starts at the upper 30 percent of the permitted camera range', () => {
  assert.ok(Math.abs(HIGH_ANGLE_CAMERA_PITCH - .815) < 1e-10);
  assert.equal(usesHighAngleArt(MIN_CAMERA_PITCH), false);
  assert.equal(usesHighAngleArt(HIGH_ANGLE_CAMERA_PITCH - .001), false);
  assert.equal(usesHighAngleArt(HIGH_ANGLE_CAMERA_PITCH), true);
  assert.equal(usesHighAngleArt(MAX_CAMERA_PITCH), true);
});
