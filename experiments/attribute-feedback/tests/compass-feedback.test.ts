import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateSystem } from '../src/systems/StateSystem';
import { compassCueFrame, CompassFeedbackTimeline } from '../src/attribute-feedback/CompassFeedbackTimeline';

test('compass cue stores full before/after for each commit and never shows future values', () => {
  const state = new StateSystem(), q = new CompassFeedbackTimeline();
  const first = state.apply({ momentum: 5, influence: 4, burrRespect: -3, burrRivalry: 2, washingtonTrust: 6 });
  q.enqueue(first, state.state, 'Washington');
  q.enqueue(state.apply({ momentum: -2, burrRespect: 8 }), state.state, 'Washington');
  assert.equal(q.current?.changes.length, 5); assert.equal(q.current?.before.momentum, 40);
  assert.equal(q.current?.after.burrRespect, 17); assert.equal(q.queued, 1);
  for (let i = 0; i < 35; i++) q.tick(100, false);
  assert.equal(q.current?.before.burrRespect, 17); assert.equal(q.current?.after.burrRespect, 25);
});
test('values change only after enlargement, then settle before the return', () => {
  assert.equal(compassCueFrame(0).travel, 0); assert.equal(compassCueFrame(520).travel, 1);
  assert.equal(compassCueFrame(620).value, 0); assert.equal(compassCueFrame(1120).value, .5);
  assert.equal(compassCueFrame(1620).value, 1); assert.equal(compassCueFrame(2980).travel, 1);
  assert.equal(compassCueFrame(3500).travel, 0);
});
test('clamped values, pause, reset and non-compass performance scores remain accurate', () => {
  const state = new StateSystem(), q = new CompassFeedbackTimeline(); state.apply({momentum:58});
  q.enqueue(state.apply({momentum:8,debatePerformance:80}),state.state,'Debate');
  assert.equal(q.current?.changes[0].delta,2); assert.equal(q.current?.before.momentum,98);
  q.tick(100, false); q.tick(1000, true); assert.equal(q.elapsed,100);
  assert.equal(q.current?.after.debatePerformance,80); q.clear(); assert.equal(q.current,undefined);
});
