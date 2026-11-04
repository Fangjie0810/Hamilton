import assert from 'node:assert/strict';
import test from 'node:test';
import { RhythmJudge, WINDOWS } from './engine';
import type { ChartNote } from './types';

const note = (id: string, time: number, lane = 0, duration?: number): ChartNote => ({ id, time, lane, duration });

for (const sign of [-1, 1]) {
  for (const [window, expected] of [[WINDOWS.perfect, 'perfect'], [WINDOWS.great, 'great'], [WINDOWS.good, 'good']] as const) {
    test(`inclusive ${expected} boundary, ${sign < 0 ? 'early' : 'late'}`, () => {
      const judge = new RhythmJudge([note('one', 10)]);
      assert.equal(judge.press(0, 10 + sign * window)?.kind, expected);
      assert.equal(judge.stats.judged, 1);
      assert.equal(judge.state.get('one'), 'hit');
    });
  }
}

test('just beyond the late window misses, then records an invalid press', () => {
  const judge = new RhythmJudge([note('one', 10)]);
  assert.equal(judge.press(0, 10.14001)?.kind, 'ghost');
  assert.equal(judge.stats.miss, 1);
  assert.equal(judge.stats.ghost, 1);
  assert.deepEqual(judge.drainEvents().map(event => event.kind), ['miss', 'ghost']);
  assert.deepEqual(judge.drainEvents(), []);
});

test('just beyond an early window cannot claim a future note', () => {
  const judge = new RhythmJudge([note('one', 10)]);
  assert.equal(judge.press(0, 9.85999)?.kind, 'ghost');
  assert.equal(judge.state.get('one'), 'pending');
  assert.equal(judge.stats.judged, 0);
});

test('simultaneous notes in different lanes both count', () => {
  const judge = new RhythmJudge([note('left', 1, 0), note('right', 1, 3)]);
  judge.press(0, 1);
  judge.press(3, 1);
  assert.equal(judge.stats.score, 1_000_000);
  assert.equal(judge.stats.combo, 2);
  assert.equal(judge.stats.accuracy, 100);
});

test('held or repeated keydown cannot score a second note', () => {
  const judge = new RhythmJudge([note('one', 1), note('two', 2)]);
  judge.press(0, 1);
  assert.equal(judge.press(0, 2), null);
  judge.update(2.15);
  assert.equal(judge.stats.perfect, 1);
  assert.equal(judge.stats.miss, 1);
  assert.equal(judge.stats.ghost, 0);
});

test('a separate press after keyup can hit the next note', () => {
  const judge = new RhythmJudge([note('one', 1), note('two', 2)]);
  judge.press(0, 1);
  judge.release(0, 1.1);
  judge.press(0, 2);
  assert.equal(judge.stats.score, 1_000_000);
});

test('long note is pending judgement until its end, then scores once', () => {
  const judge = new RhythmJudge([note('hold', 1, 0, 2)]);
  assert.equal(judge.press(0, 1)?.kind, 'hold');
  assert.equal(judge.state.get('hold'), 'holding');
  assert.equal(judge.stats.score, 0);
  judge.update(2);
  assert.equal(judge.stats.judged, 0);
  judge.update(3);
  assert.equal(judge.stats.perfect, 1);
  assert.equal(judge.stats.score, 1_000_000);
  judge.release(0, 3.2);
  judge.update(10);
  assert.equal(judge.stats.judged, 1);
});

test('releasing a hold too early fails the entire note', () => {
  const judge = new RhythmJudge([note('hold', 1, 0, 2)]);
  judge.press(0, 1);
  assert.equal(judge.release(0, 2.89999)?.kind, 'miss');
  judge.update(3);
  assert.equal(judge.stats.miss, 1);
  assert.equal(judge.stats.score, 0);
});

test('hold release tolerance is inclusive', () => {
  const judge = new RhythmJudge([note('hold', 1, 0, 2)]);
  judge.press(0, 1.08);
  assert.equal(judge.release(0, 2.9)?.kind, 'great');
  assert.equal(judge.stats.great, 1);
  assert.equal(judge.stats.score, 800_000);
});

test('ranges include only whole notes and have an independent million-point ceiling', () => {
  const judge = new RhythmJudge([
    note('before', 0), note('overlaps-start', 0.5, 0, 1), note('start', 1, 1),
    note('inside', 2, 2, 1), note('overlaps-end', 2.9, 3, 0.2), note('end', 3, 3), note('after', 4),
  ], { start: 1, end: 3 });
  assert.deepEqual(judge.notes.map(item => item.id), ['start', 'inside', 'end']);
  judge.press(1, 1);
  judge.press(2, 2);
  judge.update(3);
  judge.press(3, 3);
  assert.equal(judge.stats.score, 1_000_000);
  assert.equal(judge.stats.total, 3);
});

test('late frames expire all missed notes instead of one per frame', () => {
  const judge = new RhythmJudge([note('a', 1), note('b', 2), note('c', 3)]);
  assert.equal(judge.update(10).length, 3);
  assert.equal(judge.stats.miss, 3);
  assert.equal(judge.stats.accuracy, 0);
});

test('finish with no input counts every note missed and is idempotent', () => {
  const judge = new RhythmJudge([note('a', 1), note('b', 2), note('c', 3)]);
  assert.equal(judge.finish(0).length, 3);
  assert.equal(judge.stats.miss, 3);
  assert.equal(judge.stats.total, 3);
  assert.deepEqual(judge.finish(100), []);
  assert.equal(judge.press(0, 1), null);
  assert.equal(judge.stats.judged, 3);
});

test('wrong-lane presses break combo and reduce score to deter mashing', () => {
  const judge = new RhythmJudge([note('a', 1), note('b', 2, 1)]);
  judge.press(0, 1);
  assert.equal(judge.stats.combo, 1);
  judge.press(3, 1);
  assert.equal(judge.stats.combo, 0);
  judge.press(1, 2);
  assert.equal(judge.stats.score, 875_000);
  assert.equal(judge.stats.accuracy, 87.5);
  assert.equal(judge.stats.maxCombo, 1);
  assert.equal(judge.stats.ghost, 1);
});

test('zero-note chart starts and finishes with zero score and accuracy', () => {
  const judge = new RhythmJudge([]);
  assert.equal(judge.stats.accuracy, 0);
  assert.equal(judge.stats.score, 0);
  judge.finish();
  assert.equal(judge.stats.accuracy, 0);
});

test('only audio time drives progress, including pause and pre-roll', () => {
  const judge = new RhythmJudge([note('a', 1)]);
  judge.update(-3);
  judge.update(0.9);
  judge.update(0.9);
  assert.equal(judge.stats.judged, 0);
  judge.press(0, 1);
  assert.equal(judge.stats.perfect, 1);
});

test('invalid notes fail explicitly instead of poisoning scores', () => {
  assert.throws(() => new RhythmJudge([note('same', 1), note('same', 2)]));
  assert.throws(() => new RhythmJudge([note('bad', NaN)]));
  assert.throws(() => new RhythmJudge([note('bad', 0, 4)]));
  assert.throws(() => new RhythmJudge([note('bad', 0, 0, -1)]));
});


test('frame jumps resolve a missed note before a later completed hold', () => {
  const judge = new RhythmJudge([note('hold', 1, 0, 2), note('miss', 2, 1)]);
  judge.press(0, 1);
  assert.deepEqual(judge.update(4).map(event => event.kind), ['miss', 'perfect']);
  assert.equal(judge.stats.combo, 1);
  assert.equal(judge.stats.maxCombo, 1);
});

test('completion preserves the initial timing quality of a hold', () => {
  const judge = new RhythmJudge([note('hold', 1, 0, 2)]);
  judge.press(0, 1.13);
  judge.update(3);
  assert.equal(judge.stats.good, 1);
  assert.equal(judge.stats.score, 500_000);
});

test('clearing physical keys releases an active hold and allows future taps', () => {
  const judge = new RhythmJudge([note('hold', 1, 0, 2), note('next', 4)]);
  judge.press(0, 1);
  judge.clearPressed(2);
  assert.equal(judge.state.get('hold'), 'miss');
  judge.press(0, 4);
  assert.equal(judge.stats.perfect, 1);
});
