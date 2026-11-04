import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.HAMILTON_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const base = process.env.HAMILTON_URL ?? 'http://127.0.0.1:1779';
  await page.route('**/cast-art-inspection', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:#333"></body></html>' }));
  await page.goto(`${base}/cast-art-inspection`);
  const result = await page.evaluate(async () => {
    const { loadStoryNpcAtlas, StoryNpc } = await import('/src/story3d/StoryNpc.ts');
    const atlas = await loadStoryNpcAtlas(), context = atlas.getContext('2d');
    const counts = [], clips = [];
    for (let row = 0; row < 11; row++) for (let column = 0; column < 5; column++) {
      const data = context.getImageData(column * 128, row * 128, 128, 128).data;
      let pixels = 0, edge = 0;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        const index = (y * 128 + x) * 4;
        if (data[index + 3] > 100) { pixels++; if (x === 0 || x === 127 || y === 0 || y === 127) edge++; }
      }
      counts.push({ row, column, pixels });
      if (edge) clips.push({ row, column, edge });
    }
    const actor = new StoryNpc(atlas, 'citizen');
    actor.update({ x: 0, z: 0 }, { x: 1, z: 0 }, 0, { delta: 0, arguing: true, paused: false, reducedMotion: false });
    const first = actor.frame;
    actor.update({ x: 0, z: 0 }, { x: 1, z: 0 }, 0, { delta: .9, arguing: true, paused: false, reducedMotion: false });
    const second = actor.frame;
    const supplement = document.createElement('canvas'); supplement.width = 640; supplement.height = 640;
    supplement.getContext('2d').drawImage(atlas, 0, 768, 640, 640, 0, 0, 640, 640);
    supplement.style.cssText = 'width:640px;height:640px;image-rendering:pixelated;background:#546257;display:block;margin:auto';
    document.body.append(supplement);
    return { dimensions: [atlas.width, atlas.height], counts, clips, first, second, png: atlas.toDataURL().split(',')[1] };
  });
  assert.deepEqual(result.dimensions, [640, 1408]);
  assert.equal(result.counts.length, 55);
  assert.ok(result.counts.every(frame => frame.pixels > 1500), 'every authored view has a complete visible sprite');
  assert.deepEqual(result.clips, [], 'every sprite retains transparent margins on all four edges');
  assert.notEqual(result.first, result.second, 'runtime selects separate authored argument frames');
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/story-cast-normalized-atlas.png', Buffer.from(result.png, 'base64'));
  await page.screenshot({ path: 'artifacts/story-cast-supplement-preview.png' });
  delete result.png;
  await writeFile('artifacts/story-cast-art-check.json', JSON.stringify(result, null, 2));
  console.log('All 55 runtime sprite views are populated and unclipped; argument poses change correctly.');
} finally { await browser.close(); }
