import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameState, type GameState } from '../src/core/GameState';
import { chapters } from '../src/data/chapters';
import { characters } from '../src/data/characters';
import { allDiscoveryDialogue, discoveries, discoveryAvailable, discoveryChoiceKey, interactionEchoes, resolveDiscovery } from '../src/data/discoveries';
import { endingGrowthSummary } from '../src/data/ending';
import { checkDiscoveryContent } from '../scripts/check-i18n';
import { NEWSPAPER_PICKUP_KEY } from '../src/data/inventory';

const state = (overrides: Partial<GameState> = {}): GameState => ({ ...initialGameState(), ...overrides });
const discovery = (id: string) => discoveries.find(item => item.id === id)!;

test('optional scenes have valid prerequisites, stable keys and exhaustive bilingual dialogue', () => {
  assert.equal(discoveries.length, 9);
  assert.equal(new Set(discoveries.map(discoveryChoiceKey)).size, discoveries.length);
  for (const def of discoveries) {
    const mainIds = chapters[def.chapter].interactions.map(item => item.id);
    for (const id of def.requiresCompleted ?? []) assert.ok(mainIds.includes(id), `${def.id} prerequisite ${id}`);
    if (def.closesOn) assert.ok(mainIds.includes(def.closesOn), `${def.id} deadline`);
    if (def.requiresChoice) assert.ok(discoveries.some(item => discoveryChoiceKey(item) === def.requiresChoice));
    if (def.choice) assert.equal(def.choice.id, discoveryChoiceKey(def));
    assert.ok(def.lines.length >= 2 && def.lines.length <= 4);
    assert.ok(def.repeatLines.length);
  }
  for (const line of allDiscoveryDialogue()) {
    assert.ok(characters[line.speaker]);
    assert.ok(line.text.zh.trim() && line.text.en.trim());
  }
  assert.deepEqual(checkDiscoveryContent(), []);
});

test('a preparation event expires on activity start, and rereading never promises a past reward', () => {
  const paper = discovery('arrival-scattered-paper');
  assert.equal(discoveryAvailable(paper, state(), []), false);
  assert.equal(resolveDiscovery(paper, state(), ['arrival-newspaper']).active, false);
  assert.equal(resolveDiscovery(paper, state({ choices: { [NEWSPAPER_PICKUP_KEY]: 'collected' } }), ['arrival-newspaper']).active, true);
  const camp = discovery('camp-misfiled-dispatch');
  assert.equal(resolveDiscovery(camp, state(), ['washington-offer']).active, true);
  const started = resolveDiscovery(camp, state(), ['washington-offer'], ['washington-dispatch']);
  assert.equal(started.active, false);
  assert.equal(started.choice, undefined);
  assert.deepEqual(started.effect, {});
  assert.equal(started.lines, camp.inactiveLines);
  const ended = resolveDiscovery(camp, state(), ['washington-offer', 'washington-dispatch']);
  assert.equal(ended.lines, camp.inactiveLines);
  const repeated = resolveDiscovery(camp, state({ choices: { 'side:camp-misfiled-dispatch': 'correct' } }), ['washington-offer', 'washington-dispatch']);
  assert.equal(repeated.completed, true);
  assert.equal(repeated.active, false);
  assert.equal(repeated.lines, camp.repeatLines);
  assert.deepEqual(repeated.effect, {});
});

test('the second letter scene remains ordinary without the original discovery and cannot reward twice', () => {
  const echo = discovery('letter-name-echo');
  assert.equal(discoveryAvailable(echo, state(), ['washington-offer']), true);
  const ordinary = resolveDiscovery(echo, state(), ['washington-offer']);
  assert.equal(ordinary.active, false);
  assert.equal(ordinary.lines, echo.inactiveLines);
  const unlocked = resolveDiscovery(echo, state({ choices: { 'side:letter-name': 'completed' } }), ['washington-offer']);
  assert.equal(unlocked.active, true);
  assert.equal(unlocked.lines, echo.lines);
  assert.deepEqual(unlocked.effect, {});
});

test('respect and rivalry both unlock at their boundary and remember the chosen margin response', () => {
  const respect = discovery('burr-respect');
  const rivalry = discovery('burr-rivalry');
  const completed = ['debate-loyalist'];
  assert.equal(discoveryAvailable(respect, state({ burrRespect: 24 }), completed), false);
  assert.equal(discoveryAvailable(rivalry, state({ burrRivalry: 14 }), completed), false);
  const both = state({ burrRespect: 25, burrRivalry: 15 });
  assert.equal(discoveryAvailable(respect, both, completed), true);
  assert.equal(discoveryAvailable(rivalry, both, completed), true);
  assert.equal(discoveryAvailable(respect, both, []), false);
  for (const [def, response] of [[respect, 'ask'], [rivalry, 'challenge']] as const) {
    const result = resolveDiscovery(def, { ...both, choices: { 'side:arrival-burr-margin': response } }, completed);
    assert.equal(result.lines, def.variants![0].lines);
    assert.deepEqual(result.effect, {});
    assert.equal(result.choice, undefined);
  }
});

test('all discoveries together stay within the authored reward cap without changing activity scores', () => {
  const totals = { momentum: 0, influence: 0, washingtonTrust: 0, burrRespect: 0, burrRivalry: 0, debatePerformance: 0, yorktownPerformance: 0 };
  for (const def of discoveries) {
    const effect = { ...def.reward };
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
      totals[key] += (effect[key] ?? 0) + Math.max(0, ...(def.choice?.options.map(option => option.effect[key] ?? 0) ?? []));
    }
  }
  assert.deepEqual(totals, { momentum: 6, influence: 5, washingtonTrust: 3, burrRespect: 3, burrRivalry: 3, debatePerformance: 0, yorktownPerformance: 0 });
  const options = discovery('arrival-burr-margin').choice!.options;
  assert.ok(options.every(option => !(option.effect.burrRespect && option.effect.burrRivalry)));
});

test('conditional echoes keep two-line limits and never invent a discovered object', () => {
  const allChoices = Object.fromEntries(discoveries.map(def => [discoveryChoiceKey(def), 'completed']));
  for (const momentum of [0, 54, 55, 100]) {
    for (const influence of [0, 24, 25, 100]) {
      for (const choices of [{}, allChoices]) {
        const snapshot = state({ momentum, influence, choices });
        for (const id of ['debate-loyalist', 'washington-dispatch', 'yorktown-command']) {
          const lines = interactionEchoes(id, snapshot);
          assert.ok(lines.length <= 2);
        }
      }
    }
  }
  assert.deepEqual(interactionEchoes('debate-round-1', state()), []);
  assert.equal(interactionEchoes('debate-round-1', state({ choices: { 'side:square-bread-and-prices': 'completed' } })).length, 1);
  assert.ok(!interactionEchoes('debate-loyalist', state({ influence: 30 })).some(line => line.text.zh.includes('报童')));
  assert.ok(interactionEchoes('debate-loyalist', state({ influence: 30, choices: { 'side:arrival-scattered-paper': 'completed' } })).some(line => line.text.zh.includes('报童')));
});

test('ending records only completed discoveries and assistance actually consumed within three additions', () => {
  assert.deepEqual(endingGrowthSummary(state()), []);
  assert.deepEqual(endingGrowthSummary(state({ choices: { 'assist:debate-recovery': 'available' } })), []);
  const firstLetter = endingGrowthSummary(state({ choices: { 'side:letter-name': 'completed' } }));
  assert.equal(firstLetter.length, 1);
  assert.ok(!firstLetter[0].zh.includes('军令'));
  const allChoices = Object.fromEntries(discoveries.map(def => [discoveryChoiceKey(def), 'completed']));
  const explored = endingGrowthSummary(state({ choices: allChoices }));
  assert.equal(explored.length, 3);
  assert.ok(explored[0].zh.includes('军令签名'));
  const assisted = endingGrowthSummary(state({ choices: { ...allChoices, 'assist:debate-recovery': 'used', 'assist:writing-reference': 'used', 'assist:yorktown-check': 'used' } }));
  assert.equal(assisted.length, 3);
  assert.match(assisted[2].zh, /失误仍照实记录/);
  assert.match(assisted[2].zh, /归类由你完成/);
  assert.match(assisted[2].zh, /命令由你确认/);
});

test('i18n explicitly checks inactive dialogue rather than only the visible route', () => {
  const inactive = discovery('letter-name-echo').inactiveLines![0];
  const original = inactive.text;
  try {
    inactive.text = { zh: original.zh, en: '' };
    assert.ok(checkDiscoveryContent().some(problem => problem.includes('Both Chinese and English are required.')));
  } finally {
    inactive.text = original;
  }
});
