import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameState } from '../src/core/GameState';
import { growthAttributes } from '../src/data/growth';
import { GrowthGuide } from '../src/story3d/GrowthGuide';
import { StoryProgress } from '../src/story3d/StoryProgress';

test('attribute introductions wait for their main interactions and appear once per run', () => {
  const guide = new GrowthGuide(), state = initialGameState();
  guide.setContext('Opening', state, []); assert.equal(guide.takeTutorial(), undefined);
  guide.setContext('Arrival', state, []); assert.equal(guide.takeTutorial(), undefined);
  const completed = ['arrival-newspaper', 'arrival-street', 'arrival-burr'];
  guide.setContext('Arrival', state, completed);
  assert.deepEqual(guide.takeTutorial()?.stats, ['influence']);
  assert.deepEqual(guide.takeTutorial()?.stats, ['momentum']);
  assert.deepEqual(guide.takeTutorial()?.stats, ['burrRespect', 'burrRivalry']);
  assert.equal(guide.takeTutorial(), undefined);
  guide.setContext('Arrival', state, []);
  guide.setContext('Arrival', state, completed); assert.equal(guide.takeTutorial(), undefined);
  guide.reset(); guide.setContext('Arrival', state, completed);
  assert.equal(guide.takeTutorial()?.id, 'arrival-newspaper');
});

test('newsboy and street introductions coincide with their actual grants; Burr waits for his final reply', () => {
  const guide = new GrowthGuide(), story = new StoryProgress();
  const sync = () => guide.setContext(story.chapter.id, story.state.state, story.completedInteractions);
  story.begin('opening-letter');
  while (String(story.phase) === 'dialogue') story.next();
  story.nextChapter(); sync();
  for (const [id, stat] of [['arrival-newspaper', 'influence'], ['arrival-street', 'momentum']] as const) {
    const before = story.state.state[stat];
    story.begin(id); sync();
    while (String(story.phase) === 'dialogue') {
      assert.equal(guide.takeTutorial(), undefined, 'not during the conversation');
      assert.equal(story.state.state[stat], before, 'no early reward');
      story.next(); sync();
    }
    assert.equal(story.state.state[stat], before + 2);
    assert.deepEqual(guide.takeTutorial()?.stats, [stat]);
    assert.equal(story.state.state[stat], before + 2, 'reading the explanation does not grant again');
  }
  story.begin('arrival-burr');
  while (String(story.phase) === 'dialogue') { story.next(); sync(); }
  story.choose(0); sync();
  assert.ok(story.state.state.burrRespect > 0);
  assert.equal(guide.takeTutorial(), undefined, 'a choice effect is not the end of the interaction');
  while (String(story.phase) === 'dialogue') { story.next(); sync(); }
  assert.deepEqual(guide.takeTutorial()?.stats, ['burrRespect', 'burrRivalry']);
});

test('unread tutorials remain pending during repeated pause context, and restart cancels stale pending work', () => {
  const guide = new GrowthGuide(), state = initialGameState();
  guide.setContext('Arrival', state, ['arrival-newspaper']);
  for (let i = 0; i < 4; i++) guide.setContext('Arrival', state, ['arrival-newspaper']);
  assert.equal(guide.takeTutorial()?.id, 'arrival-newspaper');
  assert.equal(guide.takeTutorial(), undefined);
  guide.setContext('Arrival', state, ['arrival-newspaper', 'arrival-street']);
  guide.setContext('Arrival', state, []);
  assert.equal(guide.takeTutorial(), undefined);
  guide.setContext('Arrival', state, ['arrival-newspaper', 'arrival-street']);
  assert.equal(guide.takeTutorial()?.id, 'arrival-street', 'an unread tutorial can be earned again after restart');
});

test('Washington introduction requires the completed offer and applies even if the player loses trust', () => {
  const guide = new GrowthGuide(), state = initialGameState();
  guide.setContext('Washington', state, []); assert.equal(guide.takeTutorial(), undefined);
  const after = { ...state, washingtonTrust: 0, choices: { washington_position: 'washington-demand' } };
  guide.setContext('Washington', after, []); assert.equal(guide.takeTutorial(), undefined);
  guide.setContext('Washington', after, ['washington-offer']);
  assert.deepEqual(guide.takeTutorial()?.stats, ['washingtonTrust']);
  guide.setContext('Washington', state, []);
  guide.setContext('Washington', after, ['washington-offer']); assert.equal(guide.takeTutorial(), undefined);
});

test('tutorial descriptions retain the requested concise Chinese copy and complete English translations', () => {
  const expected = {
    influence: '人们愿意听你说话、传播你的主张。',
    momentum: '锐气使你主动争取机会。克制会降低锐气，但维持其较高可能有更多回报。',
    burrRespect: '伯尔对你判断力的认可，与竞争可以同时增长。',
    burrRivalry: '他开始把你当作必须认真面对的对手',
    washingtonTrust: '先有信任、再有带兵',
  };
  for (const attribute of growthAttributes) {
    assert.equal(attribute.description.zh, expected[attribute.id]);
    assert.ok(attribute.description.en.trim());
  }
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
