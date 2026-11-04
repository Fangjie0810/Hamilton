import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configureBundledImages, imageAsset } from '../src/demo3d/imageAssets';
import { SCENE_IMAGE_PATHS } from '../src/sceneExperience/portable/distribution';

test('offline image map preserves all standard and overhead source sheets and never falls back to a file request', () => {
  const images = Object.fromEntries(SCENE_IMAGE_PATHS.map(path => {
    const data = readFileSync(new URL('../public' + path, import.meta.url));
    assert.equal(data.subarray(1, 4).toString(), 'PNG');
    return [path, 'data:image/png;base64,' + data.toString('base64')];
  }));
  assert.equal(Object.keys(images).length, 8);
  try {
    configureBundledImages(images);
    for (const path of SCENE_IMAGE_PATHS) {
      const loaded = Buffer.from(imageAsset(path).split(',')[1], 'base64');
      assert.deepEqual(loaded, readFileSync(new URL('../public' + path, import.meta.url)));
    }
    assert.throws(() => imageAsset('/missing.png'), /Missing bundled image/);
  } finally { configureBundledImages(); }
  assert.equal(imageAsset('/art/actors/story-cast-v1.png'), '/art/actors/story-cast-v1.png', 'ordinary browser builds retain the original asset location');
});
