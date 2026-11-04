import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { chapterOrder, chapters } from '../src/data/chapters';
import { STORY_PLACES } from '../src/story3d/StoryPlaces';
import { StreetWorld } from '../src/demo3d/World';
import { TavernWorld } from '../src/demo3d/TavernWorld';
import { SquareWorld } from '../src/demo3d/SquareWorld';
import { CampWorld } from '../src/demo3d/CampWorld';
import { YorktownWorld } from '../src/demo3d/YorktownWorld';
import { Walker, WalkMap, type Point } from '../src/demo3d/Navigation';
import { disposeWorld } from '../src/demo3d/SceneWorld';
import { SCENES } from '../src/demo3d/SceneCatalog';
import { characterInteractions, smallTalkPosition } from '../src/story3d/SmallTalk';

// Construct the actual meshes/maps; only procedural texture paint needs a canvas stub.
function withTextureCanvas<T>(run: () => T): T {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: (tag: string) => {
      assert.equal(tag, 'canvas');
      return { width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {} }) };
    } },
  });
  try { return run(); }
  finally { if (original) Object.defineProperty(globalThis, 'document', original); else Reflect.deleteProperty(globalThis, 'document'); }
}

const worlds = { street: StreetWorld, tavern: TavernWorld, square: SquareWorld, camp: CampWorld, yorktown: YorktownWorld };

test('Lafayette and Hamilton remain separated when standing on the recommended tavern diamond', () => {
  const place = STORY_PLACES.Tavern, player = place.interactions['tavern-lafayette'];
  const lafayette = place.cast.find(actor => actor.id === 'lafayette')!.position;
  assert.ok(lafayette.x >= 3.5 && lafayette.x <= 6.5 && lafayette.z > 3.8 && lafayette.z < 5,
    'Lafayette stands in front of the lower-right table and its near bench');
  const { yaw, pitch, radius } = SCENES.tavern.camera;
  const camera = new PerspectiveCamera(40, 1440 / 900, .1, 130);
  const target = new Vector3(player.x, .7, player.z - 1);
  camera.position.copy(target).add(new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(radius));
  camera.lookAt(target); camera.updateMatrixWorld();
  const screenBounds = (position: Point) => {
    const corners = [-.75, .75].flatMap(width => [-.125, 1.875].map(height =>
      new Vector3(position.x + Math.cos(yaw) * width, height, position.z - Math.sin(yaw) * width).project(camera)));
    return { left: Math.min(...corners.map(point => point.x)), right: Math.max(...corners.map(point => point.x)) };
  };
  assert.ok(screenBounds(player).right < screenBounds(lafayette).left, 'the full character billboards do not overlap in the default camera');
});

test('both arguments have a distinct actor for every speaking role and mutually paired gestures', () => {
  for (const id of ['Arrival', 'Debate'] as const) {
    const place = STORY_PLACES[id], interactionId = id === 'Arrival' ? 'arrival-street' : 'debate-loyalist';
    const interaction = chapters[id].interactions.find(item => item.id === interactionId)!;
    for (const speaker of new Set(interaction.lines.map(line => line.speaker).filter(speaker => speaker !== 'hamilton' && speaker !== 'narrator')))
      assert.equal(place.cast.filter(actor => actor.id === speaker).length, 1, `${id} has exactly one visible ${speaker}`);
    for (const actor of place.cast.filter(actor => actor.argument)) {
      const partner = place.cast.find(candidate => candidate.id === actor.argument!.partnerId)!;
      assert.ok(partner && partner.id !== actor.id);
      assert.equal(partner.argument?.partnerId, actor.id);
      assert.equal(actor.argument!.interactionId, interactionId);
      assert.notEqual(actor.argument!.phase, partner.argument!.phase, 'the argument gestures take turns');
    }
  }
});

for (const id of chapterOrder) test(`${id}: every story target is reachable in order with NPC footprints present`, () => {
  const place = STORY_PLACES[id], chapter = chapters[id];
  assert.deepEqual(Object.keys(place.interactions), chapter.interactions.map(interaction => interaction.id), 'each original interaction has exactly one standing point');
  const world = withTextureCanvas(() => new worlds[place.scene]());
  try {
    const cast = place.cast.filter(actor => !actor.height);
    for (const actor of cast) {
      // Street already reserves Burr's footprint. Remove only that reservation
      // when checking whether the scenery itself leaves room for him.
      const scenery = world.map.obstacles.filter(obstacle => !(actor.id === 'burr' && obstacle.x === actor.position.x && obstacle.z === actor.position.z && obstacle.width === .5 && obstacle.depth === .5));
      const actorMap = new WalkMap(world.map.bounds, scenery);
      assert.ok(actorMap.free(actor.position, .25), `${id}/${actor.id} stands clear of solid scenery`);
    }
    const storyProps = id === 'Opening' ? [{ x: 16.2, z: 5, width: .6, depth: .65 }] : [];
    const map = new WalkMap(world.map.bounds, [...world.map.obstacles, ...cast.map(actor => ({ ...actor.position, width: .5, depth: .5 })), ...storyProps]);
    assert.ok(map.free(place.spawn), `${id} spawn is clear with the full cast present`);
    const targets = [...chapter.interactions.map(interaction => ({ id: interaction.id, position: place.interactions[interaction.id] })), { id: 'chapter-exit', position: place.exit }];
    const walker = new Walker({ ...place.spawn }, map);
    for (const target of targets) {
      assert.ok(map.free(target.position), `${id}/${target.id} uses an exact free destination`);
      const route = map.path(walker.position, target.position);
      assert.ok(route.length, `${id}/${target.id} is connected to the preceding story beat`);
      assert.deepEqual(route.at(-1), target.position, 'navigation does not silently snap a blocked objective');
      let previous: Point = walker.position;
      for (const point of route) { assert.ok(map.clear(previous, point)); previous = point; }
      assert.equal(walker.travel(target.position), true);
      for (let frame = 0; frame < 12000 && walker.path.length; frame++) {
        walker.tick({ x: 0, z: 0 }, 1 / 60);
        assert.ok(map.free(walker.position), `${id}/${target.id} does not cross furniture, earthworks or a character`);
      }
      assert.equal(walker.path.length, 0, `${id}/${target.id} finishes without a collision dead end`);
      assert.ok(Math.hypot(walker.position.x - target.position.x, walker.position.z - target.position.z) < .15);
    }
    assert.ok(map.path(place.exit, place.spawn).length, `${id} completed route permits exploration back to its start`);
    for (const actor of place.cast) {
      const lastInteraction = characterInteractions(chapter, actor).at(-1);
      assert.ok(lastInteraction, `${id}/${actor.id} belongs to a dialogue`);
      const point = smallTalkPosition(actor, place.interactions[lastInteraction.id], map);
      assert.ok(map.free(point), `${id}/${actor.id} has a clear optional conversation point`);
      const path = map.path(place.exit, point);
      assert.ok(path.length, `${id}/${actor.id} can be revisited after the chapter`);
      assert.deepEqual(path.at(-1), point, `${id}/${actor.id} repeat destination does not snap into scenery`);
    }
  } finally { disposeWorld(world.root); }
});
