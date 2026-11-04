import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveries } from '../src/data/discoveries';
import { DiscoverySession } from '../src/story3d/Discoveries';
import { StoryProgress } from '../src/story3d/StoryProgress';
import { DISCOVERY_PLACES, NEWSPAPER_PICKUP_PLACE, STORY_PLACES } from '../src/story3d/StoryPlaces';
import { StateSystem } from '../src/systems/StateSystem';
import { StreetWorld } from '../src/demo3d/World';
import { TavernWorld } from '../src/demo3d/TavernWorld';
import { SquareWorld } from '../src/demo3d/SquareWorld';
import { CampWorld } from '../src/demo3d/CampWorld';
import { Walker } from '../src/demo3d/Navigation';
import { disposeWorld } from '../src/demo3d/SceneWorld';
import { collectNewspaper, inventoryItems, NEWSPAPER_PICKUP_KEY, NEWSPAPER_RETURN_KEY } from '../src/data/inventory';
import { smallTalkLine } from '../src/data/smallTalk';

const get = (id: string) => discoveries.find(d => d.id === id)!;
function finish(session: DiscoverySession, option = 0) {
  for (let i = 0; session.busy && i < 30; i++) {
    if (session.phase === 'choice') session.choose(option); else session.next();
  }
  assert.equal(session.busy, false);
}

test('optional dialogue cannot overlap main dialogue, and rewards commit only after the final reply', () => {
  const state = new StateSystem(), session = new DiscoverySession(state), draft = get('tavern-unfinished-draft');
  assert.equal(session.begin(draft, [], 'dialogue'), false);
  assert.equal(session.begin(draft, [], 'activity'), false);
  assert.equal(session.begin(draft, [], 'explore'), true);
  assert.equal(session.begin(draft, [], 'explore'), false);
  while (session.phase === 'dialogue') session.next();
  assert.equal(session.phase, 'choice'); session.choose(0);
  assert.equal(state.state.momentum, 40); assert.equal(state.state.choices['side:tavern-unfinished-draft'], undefined);
  finish(session); assert.equal(state.state.momentum, 43);
  session.begin(draft, [], 'exit'); finish(session); assert.equal(state.state.momentum, 43);
});

test('aborted choices award nothing and chapter checkpoints roll discoveries back together with stats', () => {
  const state = new StateSystem(), session = new DiscoverySession(state), burr = get('arrival-burr-margin');
  state.checkpoint('Arrival'); session.begin(burr, ['arrival-burr'], 'exit');
  while (session.phase === 'dialogue') session.next();
  session.choose(1); session.abort(); assert.equal(state.state.burrRivalry, 10);
  session.begin(burr, ['arrival-burr'], 'exit'); finish(session, 1); assert.equal(state.state.burrRivalry, 13);
  state.restart('Arrival'); session.abort(); assert.equal(state.state.burrRivalry, 10);
  assert.equal(state.state.choices['side:arrival-burr-margin'], undefined);
  session.begin(burr, ['arrival-burr'], 'exit'); finish(session, 0); assert.equal(state.state.burrRespect, 23);
});

test('preparation events expire without retroactive rewards, and cross-chapter echoes need the original discovery', () => {
  const state = new StateSystem(), session = new DiscoverySession(state);
  session.begin(get('square-bread-and-prices'), [], 'exit', ['debate-loyalist']); finish(session);
  assert.equal(state.state.influence, 10); assert.equal(state.state.choices['side:square-bread-and-prices'], undefined);
  session.begin(get('letter-name-echo'), ['washington-offer'], 'explore'); finish(session);
  assert.equal(state.state.choices['side:letter-name-echo'], undefined);
  session.begin(get('letter-name'), ['opening-letter'], 'exit'); finish(session);
  state.checkpoint('Washington'); session.begin(get('letter-name-echo'), ['washington-offer'], 'explore'); finish(session);
  assert.equal(state.state.momentum, 43); assert.ok(state.state.choices['side:letter-name-echo']);
  state.restart('Washington'); assert.ok(state.state.choices['side:letter-name']); assert.equal(state.state.choices['side:letter-name-echo'], undefined);
});

test('finishing a discovery at an open exit preserves the required story cursor and exit', () => {
  const progress = new StoryProgress(); progress.begin('opening-letter');
  while (progress.phase === 'dialogue') progress.next();
  const before = { index: progress.interactionIndex, completed: progress.completedInteractions, phase: progress.phase };
  const session = new DiscoverySession(progress.state);
  session.begin(get('letter-name'), progress.completedInteractions, progress.phase); finish(session);
  assert.deepEqual({ index: progress.interactionIndex, completed: progress.completedInteractions, phase: progress.phase }, before);
  assert.equal(progress.nextChapter(), true);
});

test('newspaper pickup, handover, repeated chat and chapter rollback share one state lifecycle', () => {
  const state = new StateSystem(), session = new DiscoverySession(state), paper = get('arrival-scattered-paper');
  state.checkpoint('Arrival');
  assert.equal(session.begin(paper, ['arrival-newspaper'], 'explore'), false);
  assert.equal(smallTalkLine('newsboy', state.state).text.zh, '报纸被风吹走了好多页，这下赚不到钱了......');
  assert.equal(collectNewspaper(state), true);
  assert.equal(collectNewspaper(state), false);
  assert.deepEqual(inventoryItems(state.state).map(item => item.id), ['scattered-newspaper']);
  assert.equal(state.state.influence, 10, 'pickup itself grants no return reward');
  assert.equal(session.begin(paper, ['arrival-newspaper'], 'explore'), true);
  session.next(); session.abort();
  assert.equal(inventoryItems(state.state).length, 1, 'an interrupted handover keeps the item');
  assert.equal(state.state.choices[NEWSPAPER_RETURN_KEY], undefined);
  session.begin(paper, ['arrival-newspaper'], 'exit'); finish(session);
  assert.deepEqual(inventoryItems(state.state), []);
  assert.equal(state.state.influence, 12);
  assert.equal(smallTalkLine('newsboy', state.state).text.zh, '谢谢您先生！我会记住您的名字');
  assert.equal(session.begin(paper, ['arrival-newspaper'], 'exit'), false, 'completed return has no duplicate marker');
  assert.equal(collectNewspaper(state), false);
  assert.equal(state.state.influence, 12);
  state.restart('Arrival'); session.abort();
  assert.equal(state.state.choices[NEWSPAPER_PICKUP_KEY], undefined);
  assert.equal(state.state.choices[NEWSPAPER_RETURN_KEY], undefined);
  assert.equal(inventoryItems(state.state).length, 0);
  assert.equal(collectNewspaper(state), true);
  state.checkpoint('Tavern'); state.restart('Tavern');
  assert.equal(inventoryItems(state.state).length, 1, 'a carried item persists through later chapter checkpoints');
});

test('every discovery standing point is reachable by a real walker with story NPC footprints', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {} }) }) } });
  const worlds = { street: StreetWorld, tavern: TavernWorld, square: SquareWorld, camp: CampWorld };
  try {
    for (const definition of [...discoveries, { id: 'pickup:scattered-newspaper', chapter: 'Arrival' as const }]) {
      const place = STORY_PLACES[definition.chapter], world = new worlds[place.scene as keyof typeof worlds]();
      try {
        for (const cast of place.cast) if (!cast.height) world.map.obstacles.push({ ...cast.position, width: .5, depth: .5 });
        if (definition.chapter === 'Opening') world.map.obstacles.push({ x: 16.2, z: 5, width: .6, depth: .65 });
        const target = definition.id === 'pickup:scattered-newspaper' ? NEWSPAPER_PICKUP_PLACE : DISCOVERY_PLACES[definition.id]; assert.ok(target && world.map.free(target), definition.id);
        const walker = new Walker({ ...place.spawn }, world.map); assert.ok(walker.travel(target), definition.id);
        for (let frame = 0; frame < 10000 && walker.path.length; frame++) {
          walker.tick({ x: 0, z: 0 }, 1 / 60); assert.ok(world.map.free(walker.position), definition.id);
        }
        assert.equal(walker.path.length, 0); assert.ok(Math.hypot(walker.position.x - target.x, walker.position.z - target.z) < .15, definition.id);
      } finally { disposeWorld(world.root); }
    }
  } finally { if (original) Object.defineProperty(globalThis, 'document', original); else Reflect.deleteProperty(globalThis, 'document'); }
});
