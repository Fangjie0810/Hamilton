import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FeedbackQueue } from '../src/attribute-feedback/FeedbackQueue';
import { StateSystem } from '../src/systems/StateSystem';

test('attribute queue retains real clamped changes and opposite consecutive events', () => {
  const state = new StateSystem(), q = new FeedbackQueue();
  state.apply({ momentum: 58 });
  q.enqueue(state.apply({ momentum: 8 })); q.enqueue(state.apply({ momentum: -3 }));
  assert.deepEqual(q.current, [{ stat: 'momentum', delta: 2, value: 100 }]);
  assert.equal(q.queued, 1);
  for (let i = 0; i < 33; i++) q.tick(100);
  assert.deepEqual(q.current, [{ stat: 'momentum', delta: -3, value: 97 }]);
});

test('large commits split without loss, zero changes do not replace active feedback', () => {
  const state = new StateSystem(), q = new FeedbackQueue();
  const changes = state.apply({ momentum: 1, influence: 2, washingtonTrust: 3, burrRespect: 4, burrRivalry: 5 });
  q.enqueue(changes); q.enqueue([]);
  const first = q.current;
  assert.equal(first.length, 3); assert.equal(q.queued, 1);
  for (let i = 0; i < 33; i++) q.tick(100);
  assert.deepEqual([...first, ...q.current], changes);
});

test('pause freezes lifetime; clear prevents old chapter rewards reappearing', () => {
  const q = new FeedbackQueue(), state = new StateSystem();
  q.enqueue(state.apply({ influence: 2 })); q.enqueue(state.apply({ influence: 1 }));
  q.tick(100); q.tick(10000, true); assert.equal(q.elapsed, 100);
  q.clear(); for (let i = 0; i < 100; i++) q.tick(100);
  assert.equal(q.current.length, 0); assert.equal(q.queued, 0);
});

test('small dialogue space splits the current commit ahead of later events without dropping or merging changes', () => {
  const q = new FeedbackQueue(), state = new StateSystem();
  const first = state.apply({ momentum: 5, influence: 2, burrRespect: -3 });
  q.enqueue(first); q.enqueue(state.apply({ momentum: -2 }));
  q.tick(100); q.limitCurrent(1);
  assert.equal(q.elapsed, 100); assert.equal(q.current[0].stat, first[0].stat);
  for (let i = 0; i < 32; i++) q.tick(100);
  assert.deepEqual(q.current, first.slice(1));
  for (let i = 0; i < 33; i++) q.tick(100);
  assert.equal(q.current[0].delta, -2);
});
