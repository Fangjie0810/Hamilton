import test from 'node:test';
import assert from 'node:assert/strict';
import { CanvasTexture, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Texture, Vector2, Vector3 } from 'three';
import { isOpaqueSpriteHit } from '../src/demo3d/SpriteHit';

function alphaCanvas(width: number, height: number, opaque: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[(y * width + x) * 4 + 3] = opaque(x, y);
  let reads = 0;
  return {
    canvas: { width, height, getContext: () => ({ getImageData: () => { reads++; return { data }; } }) } as unknown as HTMLCanvasElement,
    reads: () => reads,
  };
}

test('sprite hit follows the current atlas frame, texture flipY, and alpha-test threshold', () => {
  const image = alphaCanvas(8, 4, (x, y) => x === 1 && y === 0 ? 255 : x === 5 && y === 2 ? 128 : 0);
  const texture = new CanvasTexture(image.canvas); texture.repeat.set(.5, .5); texture.offset.set(0, .5);
  const uv = new Vector2(.3, .8);
  assert.equal(isOpaqueSpriteHit({ uv }, texture), true, 'visible pixel in upper-left atlas frame is clickable');
  assert.deepEqual(uv.toArray(), [.3, .8], 'sampling preserves the original ray UV');
  assert.equal(isOpaqueSpriteHit({ uv: new Vector2(.85, .8) }, texture), false, 'transparent side padding lets the ground click through');
  texture.offset.set(.5, 0);
  assert.equal(isOpaqueSpriteHit({ uv }, texture), true, 'frame offset immediately selects the lower-right frame');
  assert.equal(isOpaqueSpriteHit({ uv }, texture, .51), false, 'alpha cutoff follows the rendered material');
  texture.flipY = false;
  assert.equal(isOpaqueSpriteHit({ uv }, texture), false, 'unflipped UV points to a different canvas row');
  texture.offset.set(0, 0);
  const upperRow = new Vector2(.3, .2);
  assert.equal(isOpaqueSpriteHit({ uv: upperRow }, texture), true, 'explicit flipY=false still samples the correct upper row');
  assert.equal(isOpaqueSpriteHit({ uv: upperRow }, texture.clone()), true, 'cloned actor textures share canvas pixels');
  assert.equal(image.reads(), 1, 'frame switches and texture clones do not re-read the atlas');
});

test('actual ray hits follow a mirrored actor silhouette instead of its rectangular plane', () => {
  const image = alphaCanvas(4, 4, x => x < 2 ? 255 : 0), texture = new CanvasTexture(image.canvas);
  const actor = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial({ map: texture, side: DoubleSide }));
  const hitAt = (x: number) => new Raycaster(new Vector3(x, 0, 2), new Vector3(0, 0, -1)).intersectObject(actor)[0];
  actor.updateMatrixWorld();
  assert.equal(isOpaqueSpriteHit(hitAt(-.5), texture), true);
  assert.equal(isOpaqueSpriteHit(hitAt(.5), texture), false);
  actor.scale.x = -1; actor.updateMatrixWorld();
  assert.equal(isOpaqueSpriteHit(hitAt(-.5), texture), false, 'mirrored transparent padding is still ignored');
  assert.equal(isOpaqueSpriteHit(hitAt(.5), texture), true, 'mirrored visible body remains clickable');
  actor.geometry.dispose(); actor.material.dispose(); texture.dispose();
});

test('unavailable texture pixels or UVs retain geometric interaction as a fallback', () => {
  const texture = new Texture();
  assert.equal(isOpaqueSpriteHit({ uv: new Vector2(.5, .5) }, texture), true);
  assert.equal(isOpaqueSpriteHit({}, texture), true);
});
