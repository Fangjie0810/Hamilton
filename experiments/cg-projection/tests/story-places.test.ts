import test from 'node:test';
import assert from 'node:assert/strict';
import { chapterOrder, chapters } from '../src/data/chapters';
import { STORY_PLACES } from '../src/story3d/StoryPlaces';
import { StreetWorld } from '../src/demo3d/World';
import { TavernWorld } from '../src/demo3d/TavernWorld';
import { SquareWorld } from '../src/demo3d/SquareWorld';
import { CampWorld } from '../src/demo3d/CampWorld';
import { YorktownWorld } from '../src/demo3d/YorktownWorld';
import { Walker, WalkMap, type Point } from '../src/demo3d/Navigation';
import { disposeWorld } from '../src/demo3d/SceneWorld';

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
  } finally { disposeWorld(world.root); }
});
