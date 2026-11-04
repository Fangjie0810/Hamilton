import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneState, initialGameState } from '../src/core/GameState';
import { EventBus } from '../src/core/EventBus';
import { DialogueCursor } from '../src/systems/DialogueSystem';
import { movePosition } from '../src/systems/MovementSystem';
import {
  loadResult,
  RESULT_STORAGE_KEY,
  saveResult,
  StateSystem,
  type ResultStorage,
} from '../src/systems/StateSystem';

test('initial state matches the specification and never shares mutable choices', () => {
  const original = initialGameState();
  assert.deepEqual(original, {
    momentum: 40, influence: 10, burrRivalry: 10, burrRespect: 20,
    washingtonTrust: 0, debatePerformance: 0, yorktownPerformance: 0, choices: {},
  });
  const clone = cloneState(original);
  clone.choices.burr = 'revolution';
  assert.deepEqual(original.choices, {});
  assert.deepEqual(initialGameState(), original);
});

test('effects clamp every statistic and report actual changes for HUD feedback', () => {
  const system = new StateSystem();
  assert.deepEqual(system.apply({ momentum: 70, washingtonTrust: -8, influence: -30 }), [
    { stat: 'momentum', delta: 60, value: 100 },
    { stat: 'influence', delta: -10, value: 0 },
  ]);
  assert.deepEqual(system.apply({ momentum: 10, influence: -2 }), []);
  assert.equal(system.state.washingtonTrust, 0);
});

test('invalid effects are rejected before any part changes the run', () => {
  const system = new StateSystem();
  assert.throws(() => system.apply({ momentum: 10, influence: Number.NaN }), RangeError);
  assert.deepEqual(system.state, initialGameState());
  assert.throws(() => system.choose('bad', 'option', { momentum: Infinity }), RangeError);
  assert.deepEqual(system.state.choices, {});
});

test('choices apply once even if a held input attempts a different answer', () => {
  const system = new StateSystem();
  system.choose('burr-advice', 'revolution', { momentum: 10, influence: 5, burrRivalry: 5 });
  const chosen = system.state;
  assert.deepEqual(system.choose('burr-advice', 'observe', { momentum: -5 }), []);
  assert.deepEqual(system.state, chosen);
  assert.equal(chosen.choices['burr-advice'], 'revolution');
  const external = system.state;
  external.momentum = 0;
  external.choices['burr-advice'] = 'observe';
  assert.deepEqual(system.state, chosen);
});

test('chapter restart restores stats and choices exactly, without duplicating rewards', () => {
  const system = new StateSystem();
  system.choose('arrival-news', 'read', { influence: 3 });
  system.checkpoint('Tavern');
  const entry = system.state;
  system.choose('laurens', 'independence', { momentum: 12, influence: 5 });
  system.apply({ burrRivalry: 10 });
  system.restart('Tavern');
  assert.deepEqual(system.state, entry);
  system.choose('laurens', 'independence', { momentum: 12, influence: 5 });
  assert.equal(system.state.momentum, 52);
  assert.equal(system.state.influence, 18);
  system.restart('Tavern');
  assert.deepEqual(system.state, entry);
});

test('new run resets state and removes old chapter checkpoints', () => {
  const system = new StateSystem();
  system.checkpoint('Arrival');
  system.choose('burr', 'act', { momentum: 20 });
  system.reset();
  assert.deepEqual(system.state, initialGameState());
  assert.throws(() => system.restart('Arrival'), /No checkpoint/);
});

test('dialogue keeps the last line visible until an explicit advance', () => {
  const cursor = new DialogueCursor(['first', 'last']);
  assert.equal(cursor.current, 'first');
  assert.equal(cursor.next(), 'last');
  assert.equal(cursor.done, false);
  assert.equal(cursor.next(), undefined);
  assert.equal(cursor.done, true);
  cursor.next();
  assert.equal(cursor.index, 2);
  cursor.reset();
  assert.equal(cursor.current, 'first');
  cursor.reset(['reply']);
  assert.equal(cursor.current, 'reply');
  cursor.reset([]);
  assert.equal(cursor.done, true);
});

test('movement is frame-rate independent for normal frames and clamps world bounds', () => {
  const oneFrame = movePosition(100, 1, 32, 0, 1000);
  const twoFrames = movePosition(movePosition(100, 1, 16, 0, 1000), 1, 16, 0, 1000);
  assert.ok(Math.abs(oneFrame - twoFrames) < 0.000001);
  assert.equal(movePosition(4, -1, 50, 0, 1000), 0);
  assert.equal(movePosition(998, 1, 50, 0, 1000), 1000);
  assert.equal(movePosition(100, 0, 50, 0, 1000), 100);
  assert.equal(movePosition(100, 1, -16, 0, 1000), 100);
});

test('movement cannot jump across a scene after losing focus', () => {
  assert.equal(movePosition(100, 1, 60_000, 0, 1000), 113.5);
  assert.equal(movePosition(100, 20, 50, 0, 1000), 113.5);
  assert.throws(() => movePosition(100, 1, Number.NaN, 0, 1000), RangeError);
});

test('event subscriptions can be removed when a scene is left', () => {
  const events = new EventBus<{ momentum: number; chapter: string }>();
  const heard: number[] = [];
  const dispose = events.on('momentum', (amount) => heard.push(amount));
  events.emit('momentum', 5);
  events.emit('chapter', 'Arrival');
  dispose();
  events.emit('momentum', 10);
  assert.deepEqual(heard, [5]);
  events.on('momentum', (amount) => heard.push(amount));
  events.clear();
  events.emit('momentum', 20);
  assert.deepEqual(heard, [5]);
});

function memoryStorage(): ResultStorage {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
  };
}

test('only explicitly saved completed results persist, never an active run', () => {
  const storage = memoryStorage();
  const system = new StateSystem();
  system.choose('burr', 'revolution', { momentum: 10 });
  assert.equal(loadResult(storage), null);
  assert.equal(saveResult(storage, system.state), true);
  assert.deepEqual(loadResult(storage), system.state);
  assert.deepEqual(new StateSystem().state, initialGameState());
  assert.deepEqual(JSON.parse(storage.getItem(RESULT_STORAGE_KEY) ?? '{}'), {
    completed: true, result: system.state,
  });
});

test('corrupt, incomplete, out-of-range, or unavailable result storage fails safely', () => {
  const storage = memoryStorage();
  for (const raw of ['not json', 'null', '{}', '{"completed":false}']) {
    storage.setItem(RESULT_STORAGE_KEY, raw);
    assert.equal(loadResult(storage), null);
  }
  storage.setItem(RESULT_STORAGE_KEY, JSON.stringify({
    completed: true, result: { ...initialGameState(), momentum: 200 },
  }));
  assert.equal(loadResult(storage), null);
  const unavailable: ResultStorage = {
    getItem: () => { throw new Error('Unavailable'); },
    setItem: () => { throw new Error('Unavailable'); },
  };
  assert.equal(loadResult(unavailable), null);
  assert.equal(saveResult(unavailable, initialGameState()), false);
  assert.equal(loadResult(undefined), null);
  assert.equal(saveResult(undefined, initialGameState()), false);
});
