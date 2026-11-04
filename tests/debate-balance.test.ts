import test from 'node:test';
import assert from 'node:assert/strict';
import { crowdNeedleAngle } from '../src/ui/debateBalance';
test('crowd needle points toward the supported side and stays inside its dial', () => {
  assert.equal(crowdNeedleAngle(50), 0);
  assert.ok(crowdNeedleAngle(25) > 0);
  assert.ok(crowdNeedleAngle(75) < 0);
  assert.equal(crowdNeedleAngle(-10), 60);
  assert.equal(crowdNeedleAngle(110), -60);
  assert.equal(crowdNeedleAngle(NaN), 0);
});
