import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameState } from '../src/core/GameState';
import { GrowthGuide } from '../src/story3d/GrowthGuide';

test('arrival tutorial appears once per run, not again after a chapter restart', () => {
  const guide = new GrowthGuide(), state = initialGameState();
  guide.setContext('Opening', state, []); assert.equal(guide.takeIntro(), false);
  guide.setContext('Arrival', state, []); assert.equal(guide.takeIntro(), true);
  guide.setContext('Arrival', state, []); assert.equal(guide.takeIntro(), false);
  guide.setContext('Tavern', state, []); assert.equal(guide.takeIntro(), false);
  guide.reset(); guide.setContext('Arrival', state, []); assert.equal(guide.takeIntro(), true);
});

test('newspaper tutorial uses the actual state change and never awards or repeats it', () => {
  const guide = new GrowthGuide(), state = initialGameState();
  guide.setContext('Arrival', state, []);
  const after = { ...state, influence: state.influence + 2 };
  const notices = guide.setContext('Arrival', after, ['arrival-newspaper']);
  assert.equal(notices.length, 1); assert.match(notices[0].text.en, /Influence \+2/);
  assert.equal(after.influence, 12); assert.equal(state.influence, 10);
  guide.setContext('Arrival', state, []);
  assert.deepEqual(guide.setContext('Arrival', after, ['arrival-newspaper']), []);
});

test('threshold notifications are deduplicated across rollback and a jump shows only the higher influence tier', () => {
  const guide = new GrowthGuide(), state = { ...initialGameState(), influence: 24, momentum: 54 };
  guide.setContext('Tavern', state, []);
  const after = { ...state, influence: 30, momentum: 55 };
  const notices = guide.setContext('Tavern', after, []);
  assert.deepEqual(notices.map(notice => notice.id), ['momentum-recovery', 'influence-crowd-high']);
  assert.match(notices[1].text.en, /increase by 10/);
  guide.setContext('Tavern', state, []);
  assert.deepEqual(guide.setContext('Tavern', after, []), []);
});

test('deferred notices re-evaluate their use after an activity ends', () => {
  const guide = new GrowthGuide(), state = { ...initialGameState(), influence: 24 };
  guide.setContext('Debate', state, []);
  const notices = guide.setContext('Debate', { ...state, influence: 25 }, []);
  assert.match(guide.noticeText(notices[0]).en, /increase by 5/);
  guide.setContext('Debate', { ...state, influence: 30, choices: { debate_result: 'won' } }, ['debate-loyalist']);
  const text = guide.noticeText(notices[0]).en;
  assert.match(text, /debate is over/); assert.doesNotMatch(text, /will increase|start the debate/i);
});

test('trust gained from completed activities explains future uses without retroactive hints', () => {
  const guide = new GrowthGuide(), state = { ...initialGameState(), washingtonTrust: 7 };
  guide.setContext('Washington', state, ['washington-offer']);
  const notices = guide.setContext('Washington', { ...state, washingtonTrust: 18, choices: { writing_result: '100' } }, ['washington-offer', 'washington-dispatch']);
  assert.equal(notices.length, 2);
  assert.match(notices[0].text.en, /Dispatch writing is complete/);
  assert.match(notices[1].text.en, /Yorktown/);
});

test('choice explanation waits for an untimed main choice and does not replay within the run', () => {
  const guide = new GrowthGuide();
  assert.equal(guide.takeChoiceTip('side:margin', false), undefined);
  assert.equal(guide.takeChoiceTip('laurens_question', true), undefined);
  assert.ok(guide.takeChoiceTip('burr_first_impression', false));
  assert.equal(guide.takeChoiceTip('burr_first_impression', false), undefined);
  guide.reset(); assert.ok(guide.takeChoiceTip('burr_first_impression', false));
});

test('relationship details reveal after meeting Burr and both dimensions remain independent', () => {
  const guide = new GrowthGuide(), state = initialGameState();
  guide.setContext('Arrival', state, []);
  assert.match(guide.usage('burrRespect').en, /Meet Burr/);
  guide.setContext('Arrival', { ...state, burrRespect: 25, burrRivalry: 15, choices: { burr_first_impression: 'burr-revolution' } }, []);
  assert.match(guide.usage('burrRespect').en, /25/); assert.match(guide.usage('burrRivalry').en, /15/);
  guide.setContext('Washington', state, []);
  assert.match(guide.usage('burrRespect').en, /ending/); assert.match(guide.usage('burrRivalry').en, /ending/);
});
