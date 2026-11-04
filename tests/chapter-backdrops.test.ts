import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { chapterOrder } from '../src/data/chapters';
import { availableBackgrounds } from '../src/data/artInventory';
import { chapterBackdropSource } from '../src/story3d/ChapterTransition';

const manifest = JSON.parse(readFileSync(new URL('../public/art/manifest.json', import.meta.url), 'utf8'));

test('every playable chapter has a real, registered backdrop in all art modes', () => {
  for (const chapter of chapterOrder) for (const variant of ['a', 'b', 'c'] as const) {
    const source = chapterBackdropSource(chapter, variant);
    assert.ok(source, `${chapter}/${variant} must not fall back to a black curtain`);
    assert.ok(source.startsWith(`/art/backgrounds/${chapter.toLowerCase()}-`), 'fallback stays in the same chapter');
    const entry = manifest.backgrounds.find((item: { path: string }) => item.path === source);
    assert.ok(entry, `${source} is in the shipped manifest`);
    assert.ok(availableBackgrounds.has(entry.id), `${source} is in the runtime inventory`);
    const png = readFileSync(new URL(`../public${source}`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${source} is an actual PNG`);
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    assert.ok(width >= 1024 && height >= 576 && width / height >= 1.5, `${source} is a full-size landscape background`);
    assert.equal(entry.width, width); assert.equal(entry.height, height);
  }
});
