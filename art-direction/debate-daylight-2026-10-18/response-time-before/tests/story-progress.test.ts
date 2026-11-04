import assert from 'node:assert/strict';
import test from 'node:test';
import { chapters, chapterOrder } from '../src/data/chapters';
import type { ChapterId } from '../src/data/types';
import { initialGameState } from '../src/core/GameState';
import { StoryProgress } from '../src/story3d/StoryProgress';
import { STORY_PLACES } from '../src/story3d/StoryPlaces';
import { storyMarkerTargets } from '../src/story3d/StoryMarkers';
import { DebateSystem } from '../src/systems/DebateSystem';
import { WritingSystem } from '../src/systems/WritingSystem';
import { YorktownSystem } from '../src/systems/YorktownSystem';
import { endingSummary } from '../src/data/ending';

function tick(system: { tick(delta: number): unknown }, ms: number): void {
  while (ms > 0) { const delta = Math.min(ms, 100); system.tick(delta); ms -= delta; }
}

function readLines(story: StoryProgress): void {
  for (let safety = 0; story.phase === 'dialogue'; safety++) {
    assert.ok(safety < 20, 'dialogue must terminate');
    assert.ok(story.currentLine?.text.zh.trim());
    assert.ok(story.currentLine?.text.en.trim());
    assert.equal(story.next(), true);
  }
}

function debateResult(perfect = false): DebateSystem {
  const result = new DebateSystem();
  for (let safety = 0; result.phase !== 'result'; safety++) {
    assert.ok(safety < 6);
    result.ready();
    if (perfect) { result.select('FACT'); tick(result, 1200); result.hit(); }
    else tick(result, 2500);
    result.next();
  }
  return result;
}

function writingResult(perfect = false): WritingSystem {
  const result = new WritingSystem(); result.begin();
  if (perfect) {
    for (let round = 0; round < 3; round++) {
      result.dispatch.fragments.forEach(fragment => result.assign(fragment.id, fragment.bin));
      result.submit(); result.next();
    }
  } else { tick(result, 150000); result.next(); }
  assert.equal(result.phase, 'result');
  return result;
}

function yorktownResult(): YorktownSystem {
  const result = new YorktownSystem(); result.begin(); result.direction = 1;
  for (let safety = 0; result.phase === 'approach'; safety++) {
    assert.ok(safety < 200); tick(result, 100);
  }
  assert.equal(String(result.phase), 'command');
  for (let squad = 0; squad < 3; squad++) result.order(squad, 'HOLD');
  result.deploy(); result.assault();
  for (let safety = 0; result.phase !== 'result'; safety++) {
    assert.ok(safety < 300); tick(result, 100);
  }
  assert.equal(result.phase, 'result');
  assert.ok(result.grades.every(grade => grade === 'MISS'));
  return result;
}

function finishInteraction(story: StoryProgress, silent = false): void {
  assert.equal(String(story.phase), 'explore');
  assert.equal(story.begin(story.interaction!.id), true);
  readLines(story);
  if (story.phase === 'choice') {
    if (silent && story.chapter.id === 'Tavern') tick(story, 10000);
    else assert.equal(story.choose(0), true);
    readLines(story);
  }
  if (story.phase === 'activity') {
    if (story.activity === 'debate') assert.equal(story.completeActivity('debate', debateResult()), true);
    else if (story.activity === 'writing') assert.equal(story.completeActivity('writing', writingResult()), true);
    else assert.equal(story.completeActivity('yorktown', yorktownResult()), true);
  }
  assert.ok(story.phase === 'explore' || story.phase === 'exit');
}

function reach(story: StoryProgress, chapter: ChapterId): void {
  for (let safety = 0; story.chapterId !== chapter; safety++) {
    assert.ok(safety < 20);
    if (story.phase === 'exit') assert.equal(story.nextChapter(), true);
    else finishInteraction(story);
  }
}

function markerIds(story: StoryProgress): string[] {
  const place = STORY_PLACES[story.chapter.id];
  return storyMarkerTargets([
    ...story.chapter.interactions.map(interaction => ({ id: interaction.id, position: place.interactions[interaction.id], complete: story.isComplete(interaction.id), exit: false })),
    { id: 'story-exit', position: place.exit, complete: false, exit: true },
  ]).map(target => target.id);
}

test('chapter playtest starts at its real entry checkpoint without fabricating earlier outcomes', () => {
  const story = new StoryProgress(undefined, 'Debate');
  assert.equal(story.chapterId, 'Debate'); assert.equal(story.phase, 'explore');
  assert.deepEqual(story.state.state, initialGameState());
  assert.deepEqual(story.completedInteractions, []);
  const first = story.interaction!.id;
  finishInteraction(story);
  story.restart();
  assert.equal(story.chapterId, 'Debate'); assert.equal(story.phase, 'explore');
  assert.equal(story.interaction!.id, first);
  assert.deepEqual(story.state.state, initialGameState());
  while (String(story.phase) !== 'exit') finishInteraction(story);
  assert.equal(story.nextChapter(), true); assert.equal(story.chapterId, 'Washington');
  story.reset(); assert.equal(story.chapterId, 'Opening');
});

test('shared camp markers advance after the final reply, and chapter restart restores the first marker', () => {
  const story = new StoryProgress(); reach(story, 'Washington');
  assert.deepEqual(markerIds(story), ['washington-offer', 'story-exit']);
  story.begin('washington-offer'); readLines(story);
  assert.equal(story.phase, 'choice');
  assert.deepEqual(markerIds(story), ['washington-offer', 'story-exit']);
  story.choose(0);
  assert.equal(story.phase, 'dialogue');
  assert.deepEqual(markerIds(story), ['washington-offer', 'story-exit'], 'choosing an answer does not reveal the second task before its reply is read');
  readLines(story);
  assert.deepEqual(markerIds(story), ['washington-dispatch', 'story-exit']);
  assert.equal(story.canBegin('washington-dispatch'), true);
  story.restart();
  assert.deepEqual(markerIds(story), ['washington-offer', 'story-exit']);
  finishInteraction(story); finishInteraction(story);
  assert.deepEqual(markerIds(story), ['story-exit']);
});

test('separate locked places and every available tavern companion retain their markers', () => {
  const story = new StoryProgress(); reach(story, 'Arrival');
  assert.equal(story.canBegin('arrival-burr'), false);
  assert.deepEqual(markerIds(story), ['arrival-newspaper', 'arrival-street', 'arrival-burr', 'story-exit']);
  reach(story, 'Tavern');
  assert.deepEqual(markerIds(story), ['tavern-laurens', 'tavern-lafayette', 'tavern-mulligan', 'story-exit']);
  story.begin('tavern-mulligan'); readLines(story); story.choose(0); readLines(story);
  assert.deepEqual(markerIds(story), ['tavern-laurens', 'tavern-lafayette', 'story-exit']);
});

test('3D story gates interactions and exits, and waits until the final line is acknowledged', () => {
  const story = new StoryProgress();
  assert.equal(story.nextChapter(), false);
  assert.equal(story.next(), false);
  assert.equal(story.begin('arrival-burr'), false);
  assert.equal(story.begin('opening-letter'), true);
  assert.equal(story.begin('opening-letter'), false);
  for (const line of chapters.Opening.interactions[0].lines) {
    assert.equal(story.phase, 'dialogue');
    assert.equal(story.currentLine, line);
    assert.equal(story.nextChapter(), false);
    story.next();
  }
  assert.equal(story.phase, 'exit');
  assert.equal(story.chapterId, 'Opening');
  assert.equal(story.nextChapter(), true);
  assert.equal(story.chapterId, 'Arrival');
  assert.equal(story.begin('arrival-street'), false);
  story.begin('arrival-newspaper');
  const influence = story.state.state.influence;
  story.next();
  assert.equal(story.state.state.influence, influence);
  story.next();
  assert.equal(story.state.state.influence, influence + 2);
  assert.deepEqual(story.completedInteractions, ['arrival-newspaper']);
  assert.equal(story.begin('arrival-newspaper'), false);
  assert.equal(story.nextChapter(), false);
});

test('3D choices apply once and repeated chapter restarts restore the original entry state', () => {
  const story = new StoryProgress(); reach(story, 'Arrival');
  const entry = story.state.state;
  finishInteraction(story); finishInteraction(story);
  story.begin('arrival-burr'); readLines(story);
  assert.equal(story.choose(-1), false); assert.equal(story.choose(99), false); assert.equal(story.choose(1.5), false);
  assert.equal(story.choose(2), true);
  const afterChoice = story.state.state;
  assert.equal(afterChoice.choices.burr_first_impression, 'burr-revolution');
  assert.equal(story.choose(0), false);
  assert.deepEqual(story.state.state, afterChoice);
  assert.equal(story.restart(), true);
  assert.equal(story.phase, 'explore'); assert.equal(story.interactionIndex, 0);
  assert.equal(story.currentLine, undefined); assert.deepEqual(story.state.state, entry);
  finishInteraction(story);
  assert.equal(story.state.state.influence, entry.influence + 2);
  assert.equal(story.restart(), true);
  assert.deepEqual(story.state.state, entry);
  assert.deepEqual(story.completedInteractions, []);
});

test('Tavern deadlines begin after reading, exclude pause, cap suspension gaps, and fail forward', () => {
  const story = new StoryProgress(); reach(story, 'Tavern');
  const entry = story.state.state;
  story.begin('tavern-laurens'); tick(story, 60000);
  assert.equal(story.phase, 'dialogue'); assert.equal(story.remainingMs, 0);
  readLines(story);
  assert.equal(story.phase, 'choice'); assert.equal(story.remainingMs, 10000);
  const revision = story.revision;
  assert.equal(story.timeout(), false);
  assert.equal(story.tick(60000, true), false); assert.equal(story.remainingMs, 10000);
  assert.equal(story.tick(NaN), false); assert.equal(story.tick(-10), false);
  assert.equal(story.tick(60000), false); assert.equal(story.remainingMs, 9900);
  assert.equal(story.revision, revision);
  tick(story, 9899); assert.equal(story.remainingMs, 1);
  assert.equal(story.tick(1), true);
  assert.equal(story.phase, 'dialogue'); assert.equal(story.remainingMs, 0);
  assert.equal(story.state.state.choices.laurens_question, 'timeout');
  assert.equal(story.state.state.momentum, entry.momentum);
  assert.equal(story.choose(2), false); assert.equal(story.timeout(), false);
  readLines(story); assert.equal(story.interaction?.id, 'tavern-lafayette');
  assert.equal(story.restart(), true); assert.deepEqual(story.state.state, entry);
  story.begin('tavern-laurens'); readLines(story);
  assert.equal(story.remainingMs, 10000);
  assert.equal(story.choose(1), true); assert.equal(story.remainingMs, 0);
  tick(story, 60000); assert.equal(story.phase, 'dialogue');
});

test('all six tavern orders require three distinct conversations and never replay an answer', () => {
  const ids = chapters.Tavern.interactions.map(item => item.id);
  const orders = ids.flatMap(first => ids.filter(id => id !== first).map(second => [first, second, ids.find(id => id !== first && id !== second)!]));
  for (const order of orders) {
    const story = new StoryProgress(); reach(story, 'Tavern');
    for (let count = 0; count < order.length; count++) {
      assert.equal(story.nextChapter(), false, 'the exit remains locked until all three conversations finish');
      for (const id of ids) assert.equal(story.canBegin(id), !order.slice(0, count).includes(id));
      assert.equal(story.begin(order[count]), true); readLines(story);
      assert.equal(story.remainingMs, 10000);
      assert.equal(story.begin(order[(count + 1) % 3]), false, 'cannot switch conversations during a question');
      if (count === 0) { tick(story, 5000); assert.equal(story.phase, 'choice', 'five seconds no longer causes timeout'); tick(story, 5000); }
      else assert.equal(story.choose(0), true);
      assert.equal(story.nextChapter(), false, 'the final reply must also be read');
      readLines(story);
      assert.equal(story.completedInteractions.length, count + 1);
      const answered = story.state.state;
      assert.equal(story.begin(order[count]), false); assert.deepEqual(story.state.state, answered);
    }
    assert.equal(story.phase, 'exit'); assert.equal(story.nextChapter(), true); assert.equal(story.chapterId, 'Debate');
  }
});

test('restarting a partially answered out-of-order tavern resets all three companions and effects', () => {
  const story = new StoryProgress(); reach(story, 'Tavern');
  const entry = story.state.state;
  story.begin('tavern-mulligan'); readLines(story); story.choose(2); readLines(story);
  assert.deepEqual(story.completedInteractions, ['tavern-mulligan']);
  story.begin('tavern-lafayette'); readLines(story); tick(story, 1200);
  story.restart();
  assert.deepEqual(story.state.state, entry); assert.deepEqual(story.completedInteractions, []);
  assert.equal(story.remainingMs, 0);
  for (const item of chapters.Tavern.interactions) assert.equal(story.canBegin(item.id), true);
});

test('3D activities require confirmed results and cannot duplicate or leak effects after restart', () => {
  const story = new StoryProgress(); reach(story, 'Debate');
  const entry = story.state.state;
  story.begin('debate-loyalist'); readLines(story);
  assert.equal(story.activity, 'debate');
  assert.equal(story.nextChapter(), false);
  assert.equal(story.completeActivity('debate', new DebateSystem()), false);
  assert.equal(story.completeActivity('writing', writingResult()), false);
  const result = debateResult(true);
  assert.deepEqual(story.state.state, entry);
  assert.equal(story.completeActivity('debate', result), true);
  assert.equal(story.phase, 'exit');
  assert.equal(story.state.state.choices.debate_result, 'won');
  assert.equal(story.state.state.choices.debate_approach, 'debate-fact');
  assert.equal(story.state.state.debatePerformance, 100);
  const completed = story.state.state;
  assert.equal(story.completeActivity('debate', result), false);
  assert.deepEqual(story.state.state, completed);
  assert.equal(story.restart(), true); assert.deepEqual(story.state.state, entry);
  assert.equal(story.completeActivity('debate', result), false);
  finishInteraction(story);
  assert.equal(story.state.state.choices.debate_result, 'held');
  assert.equal(story.state.state.debatePerformance, 0);
  story.restart(); assert.deepEqual(story.state.state, entry);
});

test('3D narrative evaluates state variants at interaction time and retains dispatch outcomes', () => {
  const story = new StoryProgress(); reach(story, 'Washington');
  story.state.apply({ influence: 100 });
  story.begin('washington-offer');
  assert.equal(story.currentLine, chapters.Washington.interactions[0].variants![0].lines[0]);
  readLines(story); story.choose(1); readLines(story);
  const trust = story.state.state.washingtonTrust;
  story.begin('washington-dispatch'); readLines(story);
  const writing = writingResult(true);
  assert.equal(story.completeActivity('writing', writing), true);
  assert.equal(story.state.state.choices.dispatch_method, 'dispatch-precise');
  assert.equal(story.state.state.choices.writing_result, '100');
  assert.equal(story.state.state.washingtonTrust, trust + 10);
  story.nextChapter(); story.begin('yorktown-command');
  assert.equal(story.currentLine, chapters.Yorktown.interactions[0].variants![0].lines[0]);
  assert.equal(story.restart(), true);
  story.state.apply({ washingtonTrust: -100 });
  story.begin('yorktown-command');
  assert.equal(story.currentLine, chapters.Yorktown.interactions[0].lines[0]);
});

test('the complete 3D route reaches the original ending after silence, losses and zero scores', () => {
  const story = new StoryProgress();
  const visited: string[] = [];
  for (const chapter of chapterOrder) {
    assert.equal(story.chapterId, chapter); visited.push(story.chapterId);
    while (story.phase !== 'exit') finishInteraction(story, true);
    assert.equal(story.interactionIndex, chapters[chapter].interactions.length);
    assert.equal(story.nextChapter(), true);
  }
  visited.push(story.chapterId);
  assert.deepEqual(visited, [...chapterOrder, 'Ending']);
  assert.equal(story.phase, 'ending');
  assert.equal(story.nextChapter(), false); assert.equal(story.restart(), false);
  const result = story.state.state;
  assert.equal(result.choices.laurens_question, 'timeout');
  assert.equal(result.choices.lafayette_question, 'timeout');
  assert.equal(result.choices.mulligan_question, 'timeout');
  assert.equal(result.choices.debate_result, 'held');
  assert.equal(result.choices.writing_result, '0');
  assert.equal(result.choices.yorktown_result, 'complete');
  assert.equal(result.choices['interaction:yorktown-surrender'], 'complete');
  const summary = endingSummary(result).map(text => text.en).join('\n');
  assert.match(summary, /0 \/ 100/);
  story.reset();
  assert.equal(story.chapterId, 'Opening'); assert.equal(story.phase, 'explore');
  assert.deepEqual(story.state.state, initialGameState());
});
