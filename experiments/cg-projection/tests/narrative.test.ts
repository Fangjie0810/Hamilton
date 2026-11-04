import assert from 'node:assert/strict';
import test from 'node:test';
import { chapters, chapterOrder } from '../src/data/chapters';
import { characters } from '../src/data/characters';
import { endingSummary, endingTitle } from '../src/data/ending';
import type { GameState } from '../src/core/GameState';
import { WritingSystem } from '../src/systems/WritingSystem';

const state = (overrides: Partial<GameState> = {}): GameState => ({
  momentum: 40, influence: 10, burrRivalry: 10, burrRespect: 20, washingtonTrust: 0,
  debatePerformance: 0, yorktownPerformance: 0, choices: {}, ...overrides,
});

test('the six chapter route is complete, sequential and reaches Ending', () => {
  assert.deepEqual(chapterOrder, ['Opening', 'Arrival', 'Tavern', 'Debate', 'Washington', 'Yorktown']);
  const ids = new Set<string>();
  for (const [index, id] of chapterOrder.entries()) {
    const chapter = chapters[id];
    assert.equal(chapter.id, id);
    assert.equal(chapter.next, chapterOrder[index + 1] ?? 'Ending');
    assert.ok(chapter.interactions.length > 0);
    assert.ok(chapter.width <= 3840);
    let previousX = 0;
    for (const interaction of chapter.interactions) {
      assert.ok(!ids.has(interaction.id), `duplicate interaction ${interaction.id}`);
      ids.add(interaction.id);
      assert.ok(interaction.label.zh.trim());
      assert.ok(characters[interaction.character]);
      assert.ok(interaction.x > previousX && interaction.x < chapter.width - 170);
      previousX = interaction.x;
      assert.ok(interaction.lines.length);
      for (const line of [...interaction.lines, ...(interaction.variants?.flatMap((variant) => variant.lines) ?? [])]) {
        assert.ok(line.text.zh.trim());
        assert.ok(characters[line.speaker]);
      }
      if (!interaction.choice) continue;
      assert.ok(!ids.has(interaction.choice.id));
      ids.add(interaction.choice.id);
      assert.ok(interaction.choice.prompt.zh.trim());
      assert.ok(interaction.choice.options.length >= 1 && interaction.choice.options.length <= 4);
      for (const option of interaction.choice.options) {
        assert.ok(!ids.has(option.id), `duplicate option ${option.id}`);
        ids.add(option.id);
        assert.ok(option.text.zh.trim());
        assert.ok(Object.values(option.effect).some((value) => value !== 0));
        assert.ok(option.reply.length);
        for (const line of option.reply) {
          assert.ok(line.text.zh.trim());
          assert.ok(characters[line.speaker]);
        }
        assert.equal(option.effect.debatePerformance, undefined);
        assert.equal(option.effect.yorktownPerformance, undefined);
      }
    }
  }
});

test('Washington trust has reachable high and low Yorktown introductions', () => {
  const offer = chapters.Washington.interactions[0].choice!;
  const writing = new WritingSystem(); writing.begin();
  for (let i = 0; i < 3; i++) { for (const fragment of writing.dispatch.fragments) writing.assign(fragment.id, fragment.bin); writing.submit(); writing.next(); }
  const high = offer.options[1].effect.washingtonTrust! + writing.effects().washingtonTrust!;
  const low = Math.max(0, offer.options[2].effect.washingtonTrust!) + writing.effects().washingtonTrust!;
  const threshold = chapters.Yorktown.interactions[0].variants![0].min;
  assert.ok(high >= threshold);
  assert.ok(low < threshold);
  assert.equal(chapters.Debate.interactions[0].activity, 'debate');
  assert.equal(chapters.Yorktown.interactions[0].activity, 'yorktown');
  assert.equal(chapters.Washington.interactions[1].activity, 'writing');
});

test('ending recounts recorded choices without inventing played combat or debate scores', () => {
  const quiet = endingSummary(state()).map(text => text.zh);
  assert.equal(quiet.length, 1);
  assert.ok(!quiet.some((line) => /初到纽约|公开质疑|第一次下令/.test(line)));
  const result = endingSummary(state({
    momentum: 81, washingtonTrust: 25, burrRespect: 40, burrRivalry: 30,
    choices: {
      burr_first_impression: 'burr-observe', debate_approach: 'debate-fact',
      washington_position: 'washington-negotiate', yorktown_leadership: 'yorktown-coordinate',
    },
  })).map(text => text.zh);
  assert.ok(result.some((line) => line.includes('先观察')));
  assert.ok(result.some((line) => line.includes('厘清事实')));
  assert.ok(result.some((line) => line.includes('核对分工')));
  assert.ok(result.some((line) => line.includes('尊重与竞争心同时增长')));
  assert.ok(!result.some((line) => /完美|连击|得分|获胜|击败/.test(line)));
  assert.notEqual(endingTitle(state()), endingTitle(state({ momentum: 81, washingtonTrust: 25 })));
});
