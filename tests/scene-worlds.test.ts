import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENE_IDS, SCENES, sceneId, type SceneId } from '../src/demo3d/SceneCatalog';
import { TavernWorld } from '../src/demo3d/TavernWorld';
import { SquareWorld } from '../src/demo3d/SquareWorld';
import { CampWorld } from '../src/demo3d/CampWorld';
import { YorktownWorld } from '../src/demo3d/YorktownWorld';
import { Walker, type Point } from '../src/demo3d/Navigation';
import { disposeWorld, type SceneWorld } from '../src/demo3d/SceneWorld';

// These tests exercise real geometry constructors and collision maps. Raster painting
// is irrelevant to navigation; rendering, lighting and texture loading have browser coverage.
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

test('the scene route graph lets every scene return to the street and rejects unknown URLs', () => {
  for (const id of SCENE_IDS) {
    assert.equal(sceneId(id), id);
    const visited = new Set<SceneId>(), queue: SceneId[] = [id];
    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const exit of SCENES[current].exits) {
        assert.ok(SCENE_IDS.includes(exit.to), `${current}/${exit.id} has a real destination`);
        queue.push(exit.to);
      }
    }
    assert.equal(visited.size, SCENE_IDS.length, `${id} can reach all other scenes through physical exits`);
    const scene = SCENES[id];
    assert.equal(new Set(scene.points.map(point => point.id)).size, scene.points.length);
    assert.equal(new Set(scene.exits.map(exit => exit.id)).size, scene.exits.length);
    assert.ok(scene.camera.min <= scene.camera.radius && scene.camera.radius <= scene.camera.max);
    for (const text of [scene.title, scene.kicker, scene.subtitle, scene.intro, ...scene.points.flatMap(point => [point.title, point.body]), ...scene.exits.map(exit => exit.title)]) {
      assert.ok(text.zh.trim() && text.en.trim(), `${id} has complete paired scene text`);
    }
  }
  for (const value of [null, '', 'unknown', 'TAVERN', '../camp']) assert.equal(sceneId(value), 'street');
});

const constructors = { tavern: TavernWorld, square: SquareWorld, camp: CampWorld, yorktown: YorktownWorld };
for (const id of ['tavern', 'square', 'camp', 'yorktown'] as const) {
  test(`${id}: real walking reaches every inspection and exit without crossing solid scenery`, () => {
    const world: SceneWorld = withTextureCanvas(() => new constructors[id]());
    try {
      const definition = SCENES[id], targets = [...definition.points, ...definition.exits];
      assert.ok(world.map.free(definition.spawn), `${id} spawn is clear for the whole player radius`);
      const bounds = world.map.bounds;
      assert.equal(world.map.free({ x: bounds.x + bounds.width / 2 + .1, z: bounds.z }), false);
      assert.equal(world.map.free({ x: bounds.x, z: bounds.z - bounds.depth / 2 - .1 }), false);
      for (const target of targets) {
        assert.ok(world.map.free(target.position), `${id}/${target.id} is an exact standing point, not a snapped blocked destination`);
        const path = world.map.path(definition.spawn, target.position);
        assert.ok(path.length, `${id}/${target.id} is connected to spawn`);
        assert.deepEqual(path.at(-1), target.position);
        let previous: Point = definition.spawn;
        for (const step of path) { assert.ok(world.map.clear(previous, step), `${id}/${target.id} route respects player radius`); previous = step; }
      }

      // A chain of real Walker journeys also tests acceleration, corner following and
      // collision sliding when the previous destination is not on the navigation grid.
      const walker = new Walker({ ...definition.spawn }, world.map);
      for (const target of [...targets, { id: 'return-to-spawn', position: definition.spawn }]) {
        assert.ok(walker.travel(target.position), `${id}/${target.id} accepts a route from the previous inspection`);
        for (let frame = 0; frame < 12000 && walker.path.length; frame++) {
          walker.tick({ x: 0, z: 0 }, 1 / 60);
          assert.ok(world.map.free(walker.position), `${id}/${target.id} never enters furniture or earthworks`);
        }
        assert.equal(walker.path.length, 0, `${id}/${target.id} finishes in bounded time`);
        assert.ok(Math.hypot(walker.position.x - target.position.x, walker.position.z - target.position.z) < .15, `${id}/${target.id} is reached, not abandoned at a collision`);
      }
      world.update(1, false, .48); world.update(2, true, 1.5);
      assert.ok(Number.isFinite(walker.distance));
    } finally { disposeWorld(world.root); }
  });
}
