import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Uses an isolated browser profile and the real Vite modules. Production state is
// read through existing debug hooks; movement, settings and orbit use user input.
const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE
  ?? '/Users/fangjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(modulePath).href);
const base = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/');
const output = 'artifacts/release-0.5.1';
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
const errors = [], failures = [], checks = [];
const report = { passed: false, url: base.href, checks, errors, failures };
context.on('page', page => {
  page.on('pageerror', error => errors.push(`${page.url()}: ${error.message}`));
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`);
  });
});
await context.addInitScript(() => {
  if (!/^https?:$/.test(location.protocol)) return;
  if (sessionStorage.getItem('release-051-initialized')) return;
  sessionStorage.setItem('release-051-initialized', 'true');
  localStorage.clear();
  localStorage.setItem('project-hamilton:3d-quality:v1', 'low');
  localStorage.setItem('project-hamilton:3d-text-speed:v1', '0');
  localStorage.setItem('project-hamilton:voiceover-volume:v1', '0');
  localStorage.setItem('project-hamilton:music-volume:v1', '0');
});
const page = await context.newPage();
const state = () => page.locator('.d3-canvas').evaluate(node => ({ ...node.dataset }));
const story = () => page.evaluate(() => window.__streetTest.story());
const nextFrame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const unchangedStory = value => ({ chapter: value.chapter, phase: value.phase, index: value.index, completed: value.completed, state: value.state });

async function ready(chapter) {
  await page.locator('.d3-canvas[data-mode="story"][data-ready="true"]').waitFor({ timeout: 60000 });
  await page.waitForFunction(expected => window.__streetTest?.story?.().chapter === expected, chapter, { timeout: 60000 });
  await page.waitForFunction(() => ['high', 'standard'].includes(document.querySelector('.d3-canvas')?.dataset.spriteView));
}

async function orbitTo(pitch, yaw) {
  const before = await state();
  const dx = yaw === undefined ? 0 : (Number(before.yaw) - yaw) / .006;
  const dy = (pitch - Number(before.pitch)) / .004;
  await page.mouse.move(740, 430);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(740 + dx, 430 + dy, { steps: 12 });
  await page.mouse.up({ button: 'right' });
  await page.waitForFunction(pitch => Math.abs(Number(document.querySelector('.d3-canvas')?.dataset.pitch) - pitch) <= .002, pitch);
  await nextFrame();
  const after = await state();
  assert.equal(after.x, before.x, 'orbit does not move Hamilton in x');
  assert.equal(after.z, before.z, 'orbit does not move Hamilton in z');
  return after;
}

/** Follow real walkable routes using ground clicks, never teleport the player. */
async function walkTo(destination) {
  const route = await page.evaluate(point => window.__streetTest.route(point.x, point.z), destination);
  assert.ok(route.free && route.path.length, `walkable route to ${JSON.stringify(destination)}`);
  for (const target of route.path) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const current = await state(), start = { x: Number(current.x), z: Number(current.z) };
      const distance = Math.hypot(target.x - start.x, target.z - start.z);
      if (distance < .13) break;
      const click = await page.evaluate(({ start, target, distance }) => {
        const hook = window.__streetTest;
        for (const length of [...new Set([3, 1.5, .65, distance].map(value => Math.min(value, distance)))]) {
          const next = { x: start.x + (target.x - start.x) * length / distance, z: start.z + (target.z - start.z) * length / distance };
          const point = hook.project(next.x, next.z);
          if (point.x < 20 || point.x > innerWidth - 20 || point.y < 120 || point.y > innerHeight - 100) continue;
          if (!document.elementFromPoint(point.x, point.y)?.classList.contains('d3-canvas')) continue;
          const yaw = Number(document.querySelector('.d3-canvas').dataset.yaw);
          if (hook.story().cast.some(actor => {
            const corners = [-1, 1].flatMap(offset => [-.15, 1.95].map(height => hook.project(actor.position.x + Math.cos(yaw) * offset, actor.position.z - Math.sin(yaw) * offset, (actor.height ?? 0) + height)));
            return point.x >= Math.min(...corners.map(corner => corner.x)) - 4 && point.x <= Math.max(...corners.map(corner => corner.x)) + 4
              && point.y >= Math.min(...corners.map(corner => corner.y)) - 4 && point.y <= Math.max(...corners.map(corner => corner.y)) + 4;
          })) continue;
          return { next, point };
        }
      }, { start, target, distance });
      if (!click) {
        // A near interaction diamond may project behind its speaking partner.
        // Use ordinary keyboard movement for that final approach rather than
        // clicking through the actor or changing any scene coordinates.
        const yaw = Number(current.yaw), dx = target.x - start.x, dz = target.z - start.z;
        const right = dx * Math.cos(yaw) - dz * Math.sin(yaw), forward = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
        const angle = Math.round(Math.atan2(forward, right) / (Math.PI / 4)) * Math.PI / 4;
        const horizontal = Math.round(Math.cos(angle)), vertical = Math.round(Math.sin(angle));
        const keys = [horizontal && (horizontal > 0 ? 'd' : 'a'), vertical && (vertical > 0 ? 'w' : 's')].filter(Boolean);
        await page.locator('.d3-canvas').focus();
        for (const key of keys) await page.keyboard.down(key);
        await page.waitForTimeout(Math.max(40, Math.min(140, distance / 2.8 * 1000)));
        for (const key of keys) await page.keyboard.up(key);
        await page.waitForTimeout(220);
        continue;
      }
      await page.mouse.click(click.point.x, click.point.y);
      await page.waitForFunction(point => {
        const data = document.querySelector('.d3-canvas')?.dataset;
        return data?.moving === 'false' && data.path === '0' && Math.hypot(Number(data.x) - point.x, Number(data.z) - point.z) < .16;
      }, click.next, { timeout: 15000 });
    }
    const reached = await state();
    assert.ok(Math.hypot(Number(reached.x) - target.x, Number(reached.z) - target.z) < .16, 'the real walker reaches its route waypoint');
  }
}

async function verifySettings() {
  await page.locator('.d3-settings-button').click();
  await page.locator('.d3-settings[open]').waitFor();
  const baseline = unchangedStory(await story()), settings = [];
  for (const mode of ['zh', 'en', 'dual', 'dual-en']) {
    await page.locator('#d3-language').selectOption(mode);
    const heading = await page.locator('.d3-settings h2').innerText();
    const text = await page.locator('.d3-settings').innerText();
    assert.equal(heading, ['en', 'dual-en'].includes(mode) ? 'Settings' : '设置');
    assert.doesNotMatch(text, /在旅途中歇一会儿|A MOMENT ON THE JOURNEY|设置与暂停|Settings\s*&\s*pause/i);
    assert.equal(await page.locator('.d3-settings .d3-kicker').count(), 0, 'the deleted pause subtitle leaves no empty kicker');
    assert.equal(await page.locator('.d3-settings .text-secondary').count(), 0);
    assert.deepEqual(unchangedStory(await story()), baseline, 'language preserves story progress and stats');
    if (mode.startsWith('dual')) {
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(await page.locator('.d3-settings h2').evaluate(node => {
        const box = node.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight;
      }), 'the simplified settings heading fits a narrow viewport');
      await page.screenshot({ path: `${output}/settings-${mode}-390.png` });
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    settings.push({ mode, heading });
  }
  await page.locator('#d3-language').selectOption('dual');
  await page.locator('.d3-settings .d3-primary').click();
  await page.waitForFunction(() => document.querySelector('.d3-canvas')?.dataset.paused === 'false');
  report.settings = settings;
  checks.push('Four language modes show only 设置 / Settings; the pause subtitle is removed; both bilingual settings fit 390 px');
}

async function verifyDistancesAndIntegratedView() {
  const initial = unchangedStory(await story()), views = [];
  for (const [pitch, expected] of [[.43, 'standard'], [.814, 'standard'], [.816, 'high'], [.98, 'high'], [.81, 'standard']]) {
    const view = await orbitTo(pitch, 0);
    assert.equal(view.spriteView, expected, `sprite switches around the .815-radian upper-30% threshold at ${pitch}`);
    assert.deepEqual(unchangedStory(await story()), initial, 'camera switches preserve progress and stats');
    views.push({ pitch: Number(view.pitch), spriteView: view.spriteView });
  }
  await orbitTo(.43, 0);
  // The sequence crosses the former 11-unit title radius and the unchanged
  // 1.65-unit E radius without clicking a label or mutating a debug fixture.
  const target = (await story()).targets.find(target => target.id === 'opening-letter');
  assert.ok(target);
  const markers = [];
  for (const [distance, titleVisible, promptVisible] of [[5.7, false, false], [5.3, true, false], [1.8, true, false], [1.5, false, true]]) {
    await walkTo({ x: target.position.x - distance, z: target.position.z });
    await nextFrame();
    const current = await state();
    const actualDistance = Math.hypot(Number(current.x) - target.position.x, Number(current.z) - target.position.z);
    assert.ok(Math.abs(actualDistance - distance) < .17);
    const visible = await page.locator('.d3-place[data-point="opening-letter"]').isVisible();
    const prompt = await page.locator('.d3-interact[data-target="opening-letter:true"]').isVisible();
    assert.equal(visible, titleVisible, `title visibility at distance ${actualDistance.toFixed(3)}`);
    assert.equal(prompt, promptVisible, `the unchanged interaction radius at distance ${actualDistance.toFixed(3)}`);
    if (distance === 1.8) {
      await page.locator('.d3-canvas').focus(); await page.keyboard.press('e'); await nextFrame();
      assert.equal((await story()).phase, 'explore', 'E remains inactive outside 1.65 units');
    }
    markers.push({ requestedDistance: distance, actualDistance, titleVisible: visible, promptVisible: prompt });
  }
  await page.locator('.d3-canvas').focus(); await page.keyboard.press('e');
  await page.waitForFunction(() => window.__streetTest.story().phase === 'dialogue');
  for (let step = 0; (await story()).phase === 'dialogue'; step++) {
    assert.ok(step < 20); await page.locator('.s3-dialogue').focus(); await page.keyboard.press('Space'); await nextFrame();
  }
  assert.equal((await story()).phase, 'exit');
  const exit = (await story()).targets.find(target => target.exit);
  await walkTo(exit.position);
  await page.locator('.d3-canvas').focus(); await page.keyboard.press('e');
  await ready('Arrival');
  const arrival = unchangedStory(await story()), castViews = [];
  for (const [pitch, high] of [[.43, false], [.816, true], [.98, true], [.814, false]]) {
    const view = await orbitTo(pitch);
    const current = await story(), cast = current.castPoses ?? current.cast;
    assert.ok(cast.length >= 4, 'Arrival supplies both PixelActor Burr and StoryNpc cast');
    assert.ok(cast.every(actor => actor.highAngle === high), `all current scene actors share high-angle selection at ${pitch}`);
    assert.ok(cast.every(actor => Number.isFinite(actor.tilt)), 'every actor exposes a finite billboard tilt');
    assert.deepEqual(unchangedStory(current), arrival, 'switching visible cast does not restart Arrival');
    castViews.push({ pitch: Number(view.pitch), cast: cast.map(({ id, highAngle, tilt }) => ({ id, highAngle, tilt })) });
    if (pitch === .98) await page.screenshot({ path: `${output}/arrival-high-angle.png` });
  }
  report.cameraViews = views; report.markerBoundary = markers; report.integratedCastViews = castViews;
  checks.push('Real right-drag input switches at .815 radians and reverses cleanly without moving actors or changing story state');
  checks.push('Actual ground navigation verifies 5.5-unit title visibility and unchanged 1.65-unit E interaction; Arrival updates every cast member');
}

async function verifyHighAngleLifecycle() {
  const lifecycle = [];
  await orbitTo(.98);
  for (const id of ['arrival-newspaper', 'arrival-street', 'arrival-burr']) {
    const target = (await story()).targets.find(target => target.id === id);
    assert.ok(target?.enabled, `${id} is the next normal story interaction`);
    await walkTo(target.position);
    await page.locator('.d3-canvas').focus(); await page.keyboard.press('e');
    await page.waitForFunction(() => window.__streetTest.story().phase === 'dialogue');
    for (let step = 0; ; step++) {
      assert.ok(step < 35, 'Arrival conversations finish through normal dialogue and choices');
      const current = await story();
      if (current.phase === 'dialogue') {
        await page.locator('.s3-dialogue').focus(); await page.keyboard.press('Space');
      } else if (current.phase === 'choice') await page.locator('.s3-choice:not(:disabled)').first().click();
      else break;
      await page.waitForTimeout(80);
    }
    const tutorial = page.locator(`.s3-growth-dialog[open][data-tutorial="${id}"]`);
    await tutorial.waitFor({ timeout: 10000 });
    await tutorial.locator('.s3-growth-close').click();
    await page.waitForFunction(() => !window.__streetTest.story().growthOpen);
    assert.equal((await state()).spriteView, 'high', 'the current atlas survives dialogue, attribute feedback and its tutorial');
  }
  const arrival = await story(); assert.equal(arrival.phase, 'exit');
  const exit = arrival.targets.find(target => target.exit);
  await walkTo(exit.position);
  assert.equal((await state()).spriteView, 'high');
  await page.locator('.d3-canvas').focus(); await page.keyboard.press('e');
  await ready('Tavern');
  const entry = unchangedStory(await story());
  assert.equal((await state()).spriteView, 'standard', 'chapter entry resets the camera and safely disposes high-angle street actors');
  assert.deepEqual((await story()).castPoses.map(actor => actor.id), ['laurens', 'lafayette', 'mulligan']);
  assert.ok((await story()).castPoses.every(actor => !actor.highAngle));
  lifecycle.push({ action: 'Arrival high-angle → Tavern', state: await state(), cast: (await story()).castPoses });

  await walkTo({ x: 1.4, z: 1.5 });
  for (const pitch of [.98, .43, .98]) {
    await orbitTo(pitch, .38);
    assert.ok((await story()).castPoses.every(actor => actor.highAngle === (pitch > .815)), 'each tavern actor switches independently after the old chapter was disposed');
    assert.deepEqual(unchangedStory(await story()), entry);
  }
  // Center the four-character group and zoom enough to inspect the proportions
  // at the exact maximum camera pitch from the user's original tavern report.
  const zoom = await state();
  await page.mouse.move(740, 430); await page.mouse.wheel(0, (18 - Number(zoom.radius)) / .015);
  await page.waitForFunction(() => Math.abs(Number(document.querySelector('.d3-canvas')?.dataset.radius) - 18) < .02);
  await page.locator('.d3-toast.visible').waitFor({ state: 'hidden', timeout: 10000 });
  await nextFrame();
  await page.screenshot({ path: `${output}/tavern-high-angle-maximum.png` });
  lifecycle.push({ action: 'Tavern maximum-angle inspection', state: await state(), cast: (await story()).castPoses });

  await page.locator('.d3-settings-button').click();
  await page.locator('.d3-settings[open] .s3-restart').click();
  await ready('Tavern');
  await page.waitForFunction(() => document.querySelector('.d3-canvas')?.dataset.spriteView === 'standard');
  assert.deepEqual(unchangedStory(await story()), entry, 'high-angle restart restores the same chapter checkpoint');
  assert.ok((await story()).castPoses.every(actor => !actor.highAngle));
  await orbitTo(.98);
  assert.ok((await story()).castPoses.every(actor => actor.highAngle), 'new tavern actors still load and display high-angle art after restart');
  lifecycle.push({ action: 'High-angle chapter restart then switch high again', state: await state(), cast: (await story()).castPoses });
  await page.screenshot({ path: `${output}/tavern-high-angle-after-restart.png` });

  await page.locator('.d3-actions .d3-back').click();
  await page.locator('.entry-screen').waitFor({ timeout: 30000 });
  assert.equal(await page.locator('.d3-canvas').count(), 0, 'high-angle exit releases the game and returns to the title');
  lifecycle.push({ action: 'High-angle exit to title', titleVisible: true });
  // A new renderer in the same browser profile must remain usable after exit.
  const storyUrl = new URL(base); storyUrl.search = '?story=3d&debug=1';
  await page.goto(storyUrl.href); await ready('Opening');
  assert.deepEqual((await story()).completed, []);
  await orbitTo(.98); assert.equal((await state()).spriteView, 'high');
  lifecycle.push({ action: 'Fresh game after high-angle exit', state: await state() });
  report.highAngleLifecycle = lifecycle;
  checks.push('High-angle Arrival safely enters Tavern; maximum-angle tavern toggles, chapter restart, exit to title and a fresh renderer complete without texture/disposal failures');
}

async function verifyMapAndGallery() {
  const gallery = await context.newPage();
  const galleryUrl = new URL('/release-051-inspection', base);
  await gallery.route('**/release-051-inspection', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body style="margin:0;background:#172c2b;color:#eee1be"></body></html>' }));
  await gallery.goto(galleryUrl.href);
  const result = await gallery.evaluate(async () => {
    const { loadPixelAtlas, PixelActor } = await import('/src/demo3d/PixelActor.ts');
    const { loadStoryNpcAtlas, StoryNpc, STORY_NPC_IDS } = await import('/src/story3d/StoryNpc.ts');
    const { isOpaqueSpriteHit } = await import('/src/demo3d/SpriteHit.ts');
    const { STORY_PLACES, DISCOVERY_PLACES, DISCOVERY_PROPS } = await import('/src/story3d/StoryPlaces.ts');
    const { discoveries } = await import('/src/data/discoveries.ts');
    const { endingGrowthSummary } = await import('/src/data/ending.ts');
    const { initialGameState } = await import('/src/core/GameState.ts');
    const { SquareWorld } = await import('/src/demo3d/SquareWorld.ts');
    const { WalkMap, Walker } = await import('/src/demo3d/Navigation.ts');
    const { disposeWorld } = await import('/src/demo3d/SceneWorld.ts');
    // Vite resolves Three identically for this module and the production actors.
    const THREE = await import('/node_modules/.vite/deps/three.js');
    const require = (condition, message) => { if (!condition) throw new Error(message); };
    const close = (a, b, tolerance = .001) => Math.abs(a - b) <= tolerance;
    const place = STORY_PLACES.Debate, square = new SquareWorld();
    const burr = place.cast.find(actor => actor.id === 'burr').position;
    const basin = square.map.obstacles.find(obstacle => obstacle.x === -5 && obstacle.z === -3 && obstacle.width === 4 && obstacle.depth === 4);
    require(!!basin && burr.x > basin.x + basin.width / 2 && close(burr.z, basin.z), 'Burr stands immediately right of the actual fountain basin');
    const bread = DISCOVERY_PLACES['square-bread-and-prices'], bill = DISCOVERY_PROPS['square-bread-and-prices'];
    const stall = square.map.obstacles.find(obstacle => obstacle.x === -11 && obstacle.z === 4 && obstacle.width === 3.5 && obstacle.depth === 3.3);
    require(!!stall && bread.x < 0 && Math.abs(bread.x - (stall.x + stall.width / 2)) < 1.25 && Math.abs(bread.z - stall.z) < 1, 'bread interaction is beside the existing left stall');
    require(bill && Math.abs(bill.position.x - stall.x) < stall.width / 2 && Math.abs(bill.position.z - stall.z) < stall.depth / 2 && bill.height > .9, 'the bill sits on the stall rather than floating over the standing diamond');
    const map = new WalkMap(square.map.bounds, [...square.map.obstacles, ...place.cast.filter(actor => !actor.height).map(actor => ({ ...actor.position, width: .5, depth: .5 }))]);
    const mapTargets = [bread, DISCOVERY_PLACES['burr-respect'], DISCOVERY_PLACES['burr-rivalry'], place.interactions['debate-loyalist'], place.exit];
    for (const target of mapTargets) {
      require(map.free(target), `map target is not blocked: ${JSON.stringify(target)}`);
      const walker = new Walker({ ...place.spawn }, map); require(walker.travel(target), 'a real path reaches every moved target');
      for (let frame = 0; walker.path.length && frame < 12000; frame++) { walker.tick({ x: 0, z: 0 }, 1 / 60); require(map.free(walker.position), 'walker never enters scenery or an NPC'); }
      require(!walker.path.length && Math.hypot(walker.position.x - target.x, walker.position.z - target.z) < .15, 'walker reaches its exact target');
    }
    for (const id of ['burr-respect', 'burr-rivalry']) require(Math.hypot(DISCOVERY_PLACES[id].x - burr.x, DISCOVERY_PLACES[id].z - burr.z) < 2.5, `${id} follows relocated Burr`);
    require(!discoveries.some(discovery => discovery.id === 'letter-name-echo') && !Object.hasOwn(DISCOVERY_PLACES, 'letter-name-echo'), 'the retired signature has no dialogue entry or map prop');
    const oldState = initialGameState(); oldState.choices['side:letter-name'] = 'completed';
    const beforeLegacy = JSON.stringify(endingGrowthSummary(oldState)); oldState.choices['side:letter-name-echo'] = 'completed';
    require(JSON.stringify(endingGrowthSummary(oldState)) === beforeLegacy, 'old signature saves do not restore the retired ending branch');
    const mapResult = { burr, fountain: basin, bread, bill, stall, reachableTargets: mapTargets };
    disposeWorld(square.root);

    const [standardPixel, highPixel, standardNpc, highNpc] = await Promise.all([
      loadPixelAtlas(false), loadPixelAtlas(true), loadStoryNpcAtlas(false), loadStoryNpcAtlas(true),
    ]);
    const ids = ['hamilton', 'burr', ...STORY_NPC_IDS];
    const facings = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'];
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(172, 178); renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight(0xffffff, 2));
    const camera = new THREE.OrthographicCamera(-1.35, 1.35, 1.55, -1.25, .1, 30);
    const stats = [], galleries = [], footAnchors = new Map();
    const localPoint = (actor, u, v) => {
      actor.body.geometry.computeBoundingBox(); const box = actor.body.geometry.boundingBox;
      return actor.body.localToWorld(new THREE.Vector3(box.min.x + (box.max.x - box.min.x) * u, box.min.y + (box.max.y - box.min.y) * v, 0));
    };
    const inspect = (actor, id, view, facing) => {
      const texture = actor.texture, image = texture.image;
      require(image instanceof HTMLCanvasElement, 'real normalized actor pixels are readable');
      const width = Math.round(image.width * texture.repeat.x), height = Math.round(image.height * texture.repeat.y);
      const x0 = Math.round(image.width * texture.offset.x), y0 = Math.round(image.height * (1 - texture.offset.y - texture.repeat.y));
      const pixels = image.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, width, height).data;
      let opaque = 0, transparent = 0, edge = 0, magenta = 0, bottom = -1, top = height, hash = 2166136261;
      const opaqueSamples = [], transparentSamples = [];
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4, alpha = pixels[i + 3];
        for (let channel = 0; channel < 4; channel++) hash = Math.imul(hash ^ pixels[i + channel], 16777619);
        if (alpha >= 128) {
          opaque++; bottom = Math.max(bottom, y); top = Math.min(top, y);
          if (!x || x === width - 1 || !y || y === height - 1) edge++;
          if (pixels[i] > 100 && pixels[i + 2] > 100 && pixels[i] - pixels[i + 1] > 50 && pixels[i + 2] - pixels[i + 1] > 50) magenta++;
          if ((x + y * width) % 83 === 0 && opaqueSamples.length < 6) opaqueSamples.push({ x, y, opaque: true });
        } else if (!alpha) {
          transparent++;
          if ((x + y * width) % 131 === 0 && transparentSamples.length < 6) transparentSamples.push({ x, y, opaque: false });
        }
      }
      require(opaque > 500 && transparent > width * height * .15, `${id}/${view}/${facing} contains a substantial actor and real transparent padding`);
      require(edge === 0 && magenta === 0, `${id}/${view}/${facing} has unclipped edges and no chroma-key residue`);
      require(bottom >= 117 && bottom <= 120, `${id}/${view}/${facing} retains the normalized boot line: ${bottom}`);
      actor.root.updateMatrixWorld(true);
      // This uses actual ray intersections against the tilted and mirrored plane,
      // then the same per-pixel hit rejection used by the main scene.
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(actor.body.matrixWorld);
      let hitChecks = 0;
      for (const sample of [...opaqueSamples, ...transparentSamples]) {
        const point = localPoint(actor, (sample.x + .5) / width, 1 - (sample.y + .5) / height);
        const ray = new THREE.Raycaster(point.clone().addScaledVector(normal, 5), normal.clone().negate(), 0, 10);
        const hit = ray.intersectObject(actor.body)[0]; require(!!hit, 'the authored billboard intersects geometrically');
        require(isOpaqueSpriteHit(hit, texture, actor.body.material.alphaTest) === sample.opaque, `${id}/${view}/${facing} raycast respects real alpha at ${sample.x},${sample.y}`);
        hitChecks++;
      }
      require(hitChecks >= 8, 'both visible art and transparent padding were tested');
      const foot = localPoint(actor, .5, 1 - (bottom + .5) / height);
      const groundError = Math.abs(foot.y - actor.root.position.y), anchorError = foot.distanceTo(actor.root.position);
      require(groundError < .035 && anchorError < .055, `${id}/${view}/${facing} boots stay at the ground anchor (${groundError}, ${anchorError})`);
      const key = `${id}/${facing}`, earlier = footAnchors.get(key);
      if (earlier) require(foot.distanceTo(new THREE.Vector3(...earlier)) < .055, 'changing the atlas never shifts the feet away from their prior world anchor');
      else footAnchors.set(key, foot.toArray());
      return { id, view, facing, frame: actor.frame, flip: actor.body.scale.x < 0, highAngle: actor.highAngle, tilt: actor.body.rotation.x, width, height, opaque, transparent, edge, magenta, top, bottom, groundError, anchorError, hitChecks, hash: (hash >>> 0).toString(16) };
    };

    for (const high of [false, true]) {
      const pitch = high ? .98 : .43, view = high ? 'high' : 'standard';
      const sheet = document.createElement('canvas'); sheet.width = 1560; sheet.height = 1960;
      const paint = sheet.getContext('2d'); paint.imageSmoothingEnabled = false;
      paint.fillStyle = '#172c2b'; paint.fillRect(0, 0, sheet.width, sheet.height);
      paint.fillStyle = '#eee1be'; paint.font = 'bold 25px Georgia'; paint.fillText(`0.5.1 · ${high ? 'HIGH ANGLE / 俯视 Q 版像素美术' : 'STANDARD / 常规 Q 版像素美术'}`, 24, 38);
      paint.font = '15px sans-serif'; facings.forEach((facing, i) => paint.fillText(facing.toUpperCase(), 170 + i * 172 + 70, 74));
      camera.position.set(0, .7 + Math.sin(pitch) * 10, Math.cos(pitch) * 10); camera.lookAt(0, .7, 0); camera.updateMatrixWorld();
      for (let row = 0; row < ids.length; row++) {
        const id = ids[row];
        // Construct and switch the same actors and atlas pairs as the main scene.
        const actor = id === 'hamilton' || id === 'burr'
          ? new PixelActor(standardPixel, id === 'burr', highPixel)
          : new StoryNpc(standardNpc, id, highNpc);
        scene.add(actor.root);
        paint.fillStyle = '#eee1be'; paint.font = '15px sans-serif'; paint.fillText(id, 18, 128 + row * 205);
        for (let column = 0; column < facings.length; column++) {
          const facing = facings[column], angle = column * Math.PI / 4;
          const direction = { x: Math.sin(angle), z: Math.cos(angle) };
          if (id === 'hamilton' || id === 'burr') actor.update({ x: 0, z: 0 }, direction, 0, false, 0, false, pitch);
          else actor.update({ x: 0, z: 0 }, direction, 0, { delta: 0, arguing: false, paused: false, reducedMotion: false }, pitch);
          require(actor.facing === facing && actor.highAngle === high, `${id}/${view} selects the ${facing} drawing through the production update API`);
          require((actor.body.scale.x < 0) === (column > 4), `${id}/${view}/${facing} uses the authored east views with correct west mirroring`);
          const item = inspect(actor, id, view, facing); stats.push(item);
          const x = 165 + column * 172, y = 92 + row * 205;
          for (let gy = 0; gy < 178; gy += 14) for (let gx = 0; gx < 172; gx += 14) {
            paint.fillStyle = (gx / 14 + gy / 14) % 2 ? '#38504b' : '#2e4540'; paint.fillRect(x + gx, y + gy, Math.min(14, 172 - gx), Math.min(14, 178 - gy));
          }
          renderer.render(scene, camera); paint.drawImage(renderer.domElement, x, y);
          paint.fillStyle = '#b6c6b8'; paint.font = '11px monospace'; paint.fillText(`f${actor.frame} · alpha ${item.opaque}`, x + 8, y + 193);
        }
        scene.remove(actor.root); disposeWorld(actor.root);
      }
      galleries.push({ view, png: sheet.toDataURL().split(',')[1] });
    }
    for (const id of ids) for (const facing of facings) {
      const standard = stats.find(item => item.id === id && item.facing === facing && item.view === 'standard');
      const high = stats.find(item => item.id === id && item.facing === facing && item.view === 'high');
      require(standard.hash !== high.hash, `${id}/${facing} switches to genuinely different authored art`);
    }
    renderer.dispose(); standardPixel.dispose(); highPixel.dispose();
    return { map: mapResult, actorIds: ids, stats, galleries };
  });
  assert.equal(result.actorIds.length, 9);
  assert.equal(result.stats.length, 9 * 8 * 2);
  for (const sheet of result.galleries) await writeFile(`${output}/cast-${sheet.view}-eight-directions.png`, Buffer.from(sheet.png, 'base64'));
  delete result.galleries;
  report.gallery = result;
  checks.push('Actual SquareWorld geometry, NPC collision footprints and Walker routes validate the relocated bread bill and fountain-side Burr');
  checks.push('The removed signature has no runtime discovery or standing point, and historical saves cannot restore its ending branch');
  checks.push('Nine real actor classes × eight directions × two views render distinct art with transparent, unclipped pixels, correct mirrored ray hits and fixed ground anchors');
  await gallery.close();
}

try {
  await mkdir(output, { recursive: true });
  const storyUrl = new URL(base); storyUrl.search = '?story=3d&debug=1';
  await page.goto(storyUrl.href); await ready('Opening');
  await verifySettings();
  await verifyDistancesAndIntegratedView();
  await verifyHighAngleLifecycle();
  await verifyMapAndGallery();
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  report.passed = true;
  await rm(`${output}/failure.png`, { force: true });
  console.log(`PASS 0.5.1: ${checks.length} acceptance groups; 144 actor/view/direction cases. See ${output}/report.json`);
} catch (error) {
  report.error = error.stack ?? String(error);
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
