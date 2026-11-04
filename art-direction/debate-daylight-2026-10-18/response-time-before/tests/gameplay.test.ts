import assert from 'node:assert/strict';
import test from 'node:test';
import { DebateSystem } from '../src/systems/DebateSystem';
import { judgeBeat, activeDelta } from '../src/systems/TimingSystem';
import type { ResponseType } from '../src/data/debate';
import { StateSystem } from '../src/systems/StateSystem';
import { YorktownSystem } from '../src/systems/YorktownSystem';
import { WritingSystem } from '../src/systems/WritingSystem';
import { squads, guards, covers } from '../src/data/yorktown';
import { endingSummary } from '../src/data/ending';

function tick(system: { tick(delta: number): void }, ms: number) { while (ms > 0) { const delta = Math.min(ms, 100); system.tick(delta); ms -= delta; } }
function debate(type: ResponseType, good: boolean) {
  const game = new DebateSystem();
  for (let i = 0; i < 6 && game.phase !== 'result'; i++) {
    game.ready(); game.select(type); if (good) tick(game, 1200); game.hit(); game.next();
  }
  return game;
}
test('beat boundaries are inclusive and suspended frames do not consume a whole prompt', () => {
  assert.equal(judgeBeat(1100), 'PERFECT'); assert.equal(judgeBeat(1300), 'PERFECT');
  assert.equal(judgeBeat(950), 'GOOD'); assert.equal(judgeBeat(1450), 'GOOD');
  assert.equal(judgeBeat(949), 'MISS'); assert.equal(judgeBeat(1451), 'MISS');
  assert.equal(judgeBeat(NaN), 'MISS'); assert.equal(activeDelta(60000), 100);
});
test('debate waits for reading, expires at 2.5 seconds and accepts a response only once', () => {
  const game = new DebateSystem(); tick(game, 10000); assert.equal(game.phase, 'argument');
  game.ready(); tick(game, 2499); assert.equal(game.phase, 'choose'); tick(game, 1);
  assert.equal(game.phase, 'feedback'); assert.equal(game.history[0].response, null);
  game.next(); game.ready(); game.select('FACT'); game.select('ATTACK'); tick(game, 1200); game.hit(); game.hit();
  assert.equal(game.history.length, 2); assert.equal(game.history[1].response, 'FACT'); assert.equal(game.flow, 1);
});
test('every debate strategy can win; facts and attacks have different relation outcomes', () => {
  for (const type of ['FACT', 'PRINCIPLE', 'ATTACK', 'CROWD'] as const) {
    const game = debate(type, true); assert.equal(game.won, true, type); assert.equal(game.performance, 100);
    assert.ok(game.crowd >= 75 || game.credibility <= 25);
  }
  assert.equal(debate('FACT', true).effects().burrRespect, 10);
  assert.equal(debate('ATTACK', true).effects().burrRivalry, 10);
});
test('misses reset Flow, risky attacks hurt support, and a losing route still ends', () => {
  const game = debate('ATTACK', false);
  assert.equal(game.phase, 'result'); assert.equal(game.won, false); assert.equal(game.performance, 0); assert.equal(game.flow, 0);
  assert.equal(game.crowd, 0); assert.equal(game.credibility, 100);
  const timeout = new DebateSystem();
  for (let i = 0; i < 6; i++) { timeout.ready(); tick(timeout, 2500); timeout.next(); }
  assert.equal(timeout.phase, 'result'); assert.equal(timeout.dominant, null);
});
test('gameplay results commit once, and chapter restart rolls them back', () => {
  const state = new StateSystem(); state.checkpoint('Debate');
  const effect = debate('FACT', true).effects(); state.choose('debate_result', 'won', effect);
  const result = state.state; state.choose('debate_result', 'won', effect); assert.deepEqual(state.state, result);
  state.restart('Debate'); assert.equal(state.state.debatePerformance, 0); assert.equal(state.state.choices.debate_result, undefined);
});

test('guard detection is capped per post, cover requires crouching, and soldiers must arrive too', () => {
  const g = new YorktownSystem(); g.begin(); g.x = 230; g.squadX = 202; g.crouched = true;
  tick(g, 1000); assert.equal(g.surprise, 100);
  g.crouched = false; tick(g, 100); assert.equal(g.surprise, 80); tick(g, 100); assert.equal(g.surprise, 80);
  g.following = false; g.x = 1270; tick(g, 100); assert.equal(g.phase, 'approach');
  g.following = true; tick(g, 10000); assert.equal(g.phase, 'command');
  assert.ok(g.surprise >= 40);
});
test('a cautious route can carry the entire squad past all three guards undetected', () => {
  const g = new YorktownSystem(); g.begin();
  for (const [i, cover] of covers.entries()) {
    const guard = guards[i];
    g.direction = 1;
    while (g.x < cover) { g.crouched = g.x > cover - 110; tick(g, 16); }
    g.direction = 0; g.crouched = true;
    const departure = 4800 - (guard + 14 - g.x) / 132 * 1000;
    while (Math.abs((g.elapsed + i * 950) % 4800 - departure) > 20) tick(g, 16);
    g.crouched = false; g.direction = 1;
    while (g.x < guard + 65) tick(g, 16);
  }
  while (g.phase === 'approach') tick(g, 16);
  assert.equal(g.phase, 'command');
  assert.equal(g.surprise, 100);
});
test('deployment needs all three orders, rewards coordination, and cannot be farmed', () => {
  const g = new YorktownSystem(); g.phase = 'command'; g.deploy(); assert.equal(g.phase, 'command');
  squads.forEach((squad, i) => g.order(i, squad.best)); g.deploy();
  assert.equal(g.tactics, 100); assert.equal(g.morale, 30); assert.ok(g.position.zh.includes('左侧'));
  g.deploy(); g.order(0, 'HOLD'); assert.equal(g.tactics, 100);
});
test('Yorktown rhythm rejects wrong and repeated keys, and all misses still reach results', () => {
  const g = new YorktownSystem(); g.phase = 'assault-ready'; g.assault(); tick(g, 1200); g.hit('s'); g.hit(' ');
  assert.deepEqual(g.grades, ['MISS']); tick(g, 850);
  for (let i = 1; i < 12; i++) { tick(g, 1500); tick(g, 850); }
  assert.equal(g.phase, 'result'); assert.equal(g.grades.length, 12);
  const best = new YorktownSystem(); best.phase = 'assault-ready'; best.tactics = 100; best.assault();
  for (let i = 0; i < 12; i++) { tick(best, 1200); best.hit(best.command.key); tick(best, 850); }
  assert.equal(best.performance, 100); assert.equal(best.effects().washingtonTrust, 8);
});
test('Writing accepts only current fragments, allows corrections before submit, and grades actual assignments', () => {
  const g = new WritingSystem(); g.assign('north-time', 'PRIORITY'); assert.deepEqual(g.assignments, {}); g.begin();
  g.assign('foreign-fragment', 'ACTION'); assert.deepEqual(g.assignments, {});
  for (let i = 0; i < 3; i++) {
    for (const fragment of g.dispatch.fragments) { g.assign(fragment.id, 'CONTEXT'); g.assign(fragment.id, fragment.bin); }
    g.submit(); g.submit(); assert.equal(g.scores.length, i + 1); tick(g, 5000); assert.equal(g.remaining, 150000); g.next();
  }
  assert.equal(g.phase, 'result'); assert.equal(g.performance, 100); assert.equal(g.effects().washingtonTrust, 10);
});
test('Writing timeout counts omissions, presents correction, and continues without a dead end', () => {
  const g = new WritingSystem(); g.begin(); tick(g, 150000);
  assert.equal(g.phase, 'feedback'); assert.equal(g.remaining, 0); g.next();
  assert.equal(g.phase, 'result'); assert.equal(g.performance, 0); assert.equal(g.effects().washingtonTrust, -3);
});
test('the ending reports actual completed gameplay scores and preserves old narrative saves', () => {
  const state = new StateSystem(); state.choose('debate_result', 'won', { debatePerformance: 70 });
  state.choose('writing_result', '80', {}); state.choose('yorktown_result', 'complete', { yorktownPerformance: 66 });
  const summary = endingSummary(state.state).map(text => text.zh).join('\n');
  assert.match(summary, /70 \/ 100/); assert.match(summary, /80 \/ 100/); assert.match(summary, /66 \/ 100/);
});
