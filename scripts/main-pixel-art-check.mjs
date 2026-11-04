import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const base = new URL(process.env.BASE_URL ?? process.env.HAMILTON_URL ?? 'http://127.0.0.1:1777/');
base.search = ''; base.hash = '';
const url = new URL('/art-direction/main-pixel-production-2026-09-14/', base);
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(60000);
const errors = [], failures = [], checks = [];
const report = { url: url.href, generatedAt: new Date().toISOString(), checks, errors, failures };
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`);
});

async function snapshot() {
  return page.evaluate(() => {
    const h = window.__mainPixelReview, root = h.portraits.element;
    return {
      phase: root.dataset.phase, speaker: root.dataset.speaker, talking: root.dataset.talking,
      paused: root.dataset.paused, reduced: root.dataset.reducedMotion,
      slots: [...root.querySelectorAll('.dialogue-portrait-slot')].map(slot => {
        const canvas = slot.querySelector('canvas'), transform = getComputedStyle(canvas).transform;
        return { character: slot.dataset.character, side: slot.dataset.side, facing: slot.dataset.facing,
          mirrored: slot.dataset.mirrored, actualMirror: transform !== 'none' && new DOMMatrixReadOnly(transform).m11 < 0,
          active: slot.dataset.active, talking: slot.dataset.talking, frame: Number(slot.dataset.frame),
          pose: slot.dataset.pose, art: slot.dataset.artSource, frameCount: Number(slot.dataset.frameCount),
          width: canvas.width, height: canvas.height,
          pixels: h.pixelStats(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)),
        };
      }),
    };
  });
}
async function tick(ms, paused = false, reduced = false) {
  await page.evaluate(({ ms, paused, reduced }) => {
    const p = window.__mainPixelReview.portraits;
    for (let elapsed = 0; elapsed < ms; elapsed += 50) p.update(Math.min(50, ms - elapsed), paused, reduced);
  }, { ms, paused, reduced });
}
const activeSlot = state => state.slots.find(slot => slot.active === 'true');

try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mainPixelReview?.complete, undefined, { timeout: 120000 });
  const assets = await page.evaluate(() => {
    const h = window.__mainPixelReview; h.state.auto = false;
    return { expectedFrames: h.expectedFrames, art: h.art, sheets: h.sheets, errors: h.errors,
      canvases: document.querySelectorAll('.frame-matte canvas').length };
  });
  report.assets = assets;
  assert.deepEqual(assets.errors, [], 'all ten production source sheets must load');
  assert.equal(Object.keys(assets.art).length, 10, 'the production cast contains ten characters');
  assert.equal(Object.keys(assets.sheets).length, 10, 'all ten sheets are decoded and processed');
  assert.equal(assets.expectedFrames, 59, 'the agreed production scope has 59 authored frames');
  assert.equal(assets.canvases, assets.expectedFrames, 'the gallery draws all 59 authored frames');
  // A chroma check alone misses a neutral grey rectangle. Probe reviewed empty
  // corners of every v2 cell and require genuinely zero alpha after shared keying.
  const regeneratedMattes = await page.evaluate(async () => {
    const { keyPortraitPixels } = await import('/src/ui/portraitPixels.ts');
    const art = window.__mainPixelReview.art, results = [];
    for (const id of ['loyalist', 'citizen']) {
      const layout = art[id], image = new Image(); image.src = layout.path; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      const source = context.getImageData(0, 0, image.width, image.height);
      const originalKey = keyPortraitPixels(source, { color: '#00ff00' });
      const measuredKey = keyPortraitPixels(source, { color: layout.key });
      const frames = [];
      for (let frame = 0; frame < layout.frameCount; frame++) {
        const x0 = Math.floor(frame % layout.columns * image.width / layout.columns);
        const y0 = Math.floor(Math.floor(frame / layout.columns) * image.height / layout.rows);
        const stats = pixels => {
          let nonzero = 0, totalAlpha = 0, maxAlpha = 0;
          for (let y = y0; y < y0 + 96; y++) for (let x = x0; x < x0 + 96; x++) {
            const alpha = pixels.data[(y * pixels.width + x) * 4 + 3];
            nonzero += Number(alpha > 0); totalAlpha += alpha; maxAlpha = Math.max(maxAlpha, alpha);
          }
          return { nonzero, meanAlpha: totalAlpha / (96 * 96), maxAlpha };
        };
        frames.push({ frame, probe: { x: x0, y: y0, width: 96, height: 96 }, before: stats(originalKey), after: stats(measuredKey) });
      }
      results.push({ id, path: layout.path, key: layout.key, frames });
    }
    return results;
  });
  report.regeneratedMattes = regeneratedMattes;
  for (const sheet of regeneratedMattes) for (const frame of sheet.frames)
    assert.equal(frame.after.nonzero, 0, `${sheet.id}/${frame.frame}: exterior background is completely transparent, without a neutral alpha veil`);
  checks.push('All ten regenerated loyalist/citizen frames have zero-alpha exterior probes; the loyalist no longer retains a neutral grey background rectangle.');
  let total = 0;
  for (const [id, layout] of Object.entries(assets.art)) {
    const sheet = assets.sheets[id];
    assert.equal(sheet.path, layout.path, `${id}: the production source path is used`);
    assert.equal(sheet.frames.length, layout.frameCount, `${id}: every declared frame is present`);
    assert.equal(sheet.bounds.length, layout.frameCount, `${id}: every declared frame has measured bounds`);
    assert.ok(Number.isFinite(sheet.registration.scale) && sheet.registration.scale > 0, `${id}: one valid shared registration`);
    for (const [index, frame] of sheet.frames.entries()) {
      assert.ok(sheet.bounds[index].width > 10 && sheet.bounds[index].height > 20, `${id}/${index}: an authored silhouette exists`);
      assert.ok(frame.width >= 320 && frame.height >= 400, `${id}/${index}: detailed canvas resolution`);
      assert.ok(frame.coverage > .02 && frame.coverage < .95, `${id}/${index}: visible foreground and transparent background (${frame.coverage})`);
      assert.equal(frame.green, 0, `${id}/${index}: no strong green background residue`);
      assert.equal(frame.magenta, 0, `${id}/${index}: no strong magenta background residue`);
      total++;
    }
  }
  assert.equal(total, 59);
  checks.push('Ten real production atlases load; all 59 nonempty detailed frames render with transparent backgrounds and no strong green/magenta residue.');

  const performances = [];
  for (const [id, layout] of Object.entries(assets.art)) {
    const partner = id === 'hamilton' ? 'lafayette' : 'hamilton';
    const settledPose = Object.keys(layout.poses).at(-1);
    const performance = { speaking: layout.defaultPose, settled: settledPose, listener: assets.art[partner].listenPose, emphasis: true };
    await page.evaluate(({ id, partner, performance }) => {
      const p = window.__mainPixelReview.portraits;
      p.show(id, partner, performance); p.update(0, false, false);
    }, { id, partner, performance });
    const ready = await snapshot();
    assert.equal(ready.phase, 'ready');
    assert.equal(ready.speaker, id);
    assert.equal(ready.slots.filter(slot => slot.active === 'true').length, 1);
    assert.deepEqual(ready.slots.map(slot => slot.character).sort(), [id, partner].sort());
    for (const slot of ready.slots) {
      const inward = slot.side === 'left' ? 'right' : 'left';
      assert.equal(slot.facing, inward, `${id}: each slot faces inward`);
      assert.equal(slot.mirrored === 'true', assets.art[slot.character].facing !== inward, `${id}: sheet facing determines mirroring`);
      assert.equal(slot.actualMirror, slot.mirrored === 'true', `${id}: the CSS actually mirrors its canvas`);
      assert.equal(slot.art, 'main-pixel', `${id}: production art is loaded rather than the fallback`);
      assert.equal(slot.frameCount, assets.art[slot.character].frameCount);
      assert.ok(slot.pixels.visible > 400, `${id}: real renderer draws visible foreground`);
    }
    assert.equal(activeSlot(ready).frame, layout.poses[layout.defaultPose]);
    await page.evaluate(id => window.__mainPixelReview.portraits.setSpeaking(id, true, false), id);
    const speechFrames = new Set();
    for (let i = 0; i < 18; i++) { await tick(50); speechFrames.add(activeSlot(await snapshot()).frame); }
    if (id !== 'narrator') {
      for (const frame of layout.talkFrames) assert.ok(speechFrames.has(frame), `${id}: authored speech frame ${frame} appears`);
      const laterFrames = new Set();
      for (let i = 0; i < 18; i++) { await tick(50); laterFrames.add(activeSlot(await snapshot()).frame); }
      assert.ok(!laterFrames.has(layout.talkFrames[2]), `${id}: the emphasis pose does not loop repeatedly`);
    } else {
      assert.ok(speechFrames.has(layout.poses.write), 'Eliza narrates in the authored writing pose');
      await tick(2450);
      assert.equal(activeSlot(await snapshot()).frame, layout.poses.turn, 'Eliza uses an authored page-turn pose, never a mouth overlay');
    }
    // Buffering closes the mouth without claiming that the cue has finished.
    await page.evaluate(id => window.__mainPixelReview.portraits.setSpeaking(id, false, false), id);
    const waiting = await snapshot();
    assert.equal(waiting.phase, 'speaking');
    assert.equal(activeSlot(waiting).frame, layout.talkFrames[0]);
    await tick(500, true, false); const paused = await snapshot();
    await tick(600, true, false); assert.deepEqual(await snapshot(), paused, `${id}: pause freezes every portrait state`);
    await page.evaluate(id => window.__mainPixelReview.portraits.setSpeaking(id, true, false), id);
    await tick(50, false, true); const reduced = await snapshot();
    await tick(600, false, true); assert.deepEqual(await snapshot(), reduced, `${id}: reduced motion holds a static closed pose`);
    await page.evaluate(id => { const p = window.__mainPixelReview.portraits; p.update(0, false, false); p.setSpeaking(id, false, true); }, id);
    const settled = await snapshot();
    assert.equal(settled.phase, 'settled');
    assert.equal(activeSlot(settled).frame, layout.poses[settledPose], `${id}: natural completion selects the authored reaction`);
    const listener = settled.slots.find(slot => slot.character === partner);
    assert.equal(listener.frame, assets.art[partner].poses[performance.listener], `${id}: listener keeps its authored reaction`);
    await tick(500); assert.deepEqual(await snapshot(), settled, `${id}: the finished reaction persists`);
    // Compare precisely the same base frame while speaking and listening.
    await page.evaluate(({ id, partner, pose }) => {
      const p = window.__mainPixelReview.portraits;
      p.show(id, partner, { speaking: pose, settled: pose, listener: 'calm', emphasis: false });
    }, { id, partner, pose: layout.defaultPose });
    const bright = activeSlot(await snapshot());
    await page.evaluate(({ id, partner, pose }) => {
      window.__mainPixelReview.portraits.show(partner, id, { speaking: 'assertive', settled: 'calm', listener: pose, emphasis: false });
    }, { id, partner, pose: layout.defaultPose });
    const dark = (await snapshot()).slots.find(slot => slot.character === id);
    assert.equal(dark.frame, bright.frame, `${id}: compare the same frame for the listener mask`);
    assert.ok(bright.pixels.brightness > dark.pixels.brightness * 1.3, `${id}: grey-black pixels clearly subdue the listener`);
    performances.push({ id, frames: [...speechFrames], ready, settled, listenerBrightness: { active: bright.pixels.brightness, inactive: dark.pixels.brightness } });
  }
  report.performances = performances;
  checks.push('All ten real renderers face inward, use the detailed atlases, display authored speech/reaction frames, preserve a dark listener, and distinguish buffering/pause from completion.');
  checks.push('One emphasis per spoken phrase; Eliza writes/turns pages; pause and reduced motion are static; settled reactions persist.');

  await page.evaluate(() => { const h = window.__mainPixelReview; h.setPreview({ speaker: 'hamilton', listener: 'lafayette', mode: 'settled', pose: 'approve' }); h.setMatte('dark'); });
  await page.screenshot({ path: 'artifacts/main-pixel-pair-dark.png' });
  await page.evaluate(() => window.__mainPixelReview.setMatte('light'));
  await page.screenshot({ path: 'artifacts/main-pixel-pair-light.png' });
  for (const id of Object.keys(assets.art)) await page.locator(`#character-${id}`).screenshot({ path: `artifacts/main-pixel-${id}.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { const h = window.__mainPixelReview; h.setMatte('dark'); h.setPreview({ speaker: 'lafayette', listener: 'hamilton', mode: 'pose', pose: 'amused' }); scrollTo(0, 0); });
  const mobile = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
    clippedControls: [...document.querySelectorAll('button,select')].filter(node => { const b = node.getBoundingClientRect(); return b.left < 0 || b.right > innerWidth; }).map(node => node.textContent) }));
  assert.ok(mobile.scroll <= mobile.width + 1, `review page has no mobile overflow: ${JSON.stringify(mobile)}`);
  assert.deepEqual(mobile.clippedControls, [], 'all mobile review controls remain accessible');
  await page.screenshot({ path: 'artifacts/main-pixel-mobile.png', fullPage: false });
  report.mobile = mobile;
  checks.push('Desktop dark/light edge-review images and all ten character sheets captured; mobile review controls fit a 390px viewport.');
  assert.deepEqual(errors, [], 'no browser page errors');
  assert.deepEqual(failures, [], 'no failed assets or modules');
  report.passed = true;
  console.log(JSON.stringify({ passed: true, roles: Object.keys(assets.art).length, frames: total, checks }, null, 2));
} catch (error) {
  report.passed = false; report.failure = error instanceof Error ? error.stack : String(error);
  try { await page.screenshot({ path: 'artifacts/main-pixel-failure.png', fullPage: false }); } catch {}
  console.error(report.failure); process.exitCode = 1;
} finally {
  await writeFile('artifacts/main-pixel-art-check.json', JSON.stringify(report, null, 2));
  await browser.close();
}
