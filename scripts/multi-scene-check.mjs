import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], failures = [], results = [], resourceSamples = [], lifecycle = {};
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`); });
const ids = ['street', 'tavern', 'square', 'camp', 'yorktown'];
const base = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/');
const urlFor = id => { const url = new URL(base); url.search = `?demo=3d&scene=${id}&debug=1`; return url.href; };
const state = () => page.locator('.d3-canvas').evaluate(el => ({ ...el.dataset }));
const scene = () => page.evaluate(() => window.__streetTest.scene());
const waitState = expected => page.waitForFunction(values => {
  const data = document.querySelector('.d3-canvas')?.dataset;
  return data && Object.entries(values).every(([key, value]) => data[key] === value);
}, expected, { timeout: 5000 });
async function ready(id) {
  await page.locator(`.d3-canvas[data-ready=true][data-scene=${id}]`).waitFor({ timeout: 60000 });
  await page.waitForTimeout(700);
  assert.equal((await scene()).id, id);
  assert.equal(await page.locator('.d3-scene-select').inputValue(), id);
  assert.equal(new URL(page.url()).searchParams.get('scene') ?? 'street', id);
}
async function switchTo(id) {
  await page.locator('.d3-scene-select').selectOption(id);
  await ready(id);
  const current = await state();
  assert.equal(current.path, '0', 'changing scenes clears click movement');
  assert.equal(current.moving, 'false', 'changing scenes clears held input');
  return current;
}
const waitStill = () => page.waitForFunction(() => {
  const data = document.querySelector('.d3-canvas')?.dataset;
  return data?.moving === 'false' && data?.path === '0';
}, undefined, { timeout: 18000 });

async function walkTo(destination) {
  const route = await page.evaluate(p => window.__streetTest.route(p.x, p.z), destination);
  assert.ok(route.free && route.path.length, `walkable target ${JSON.stringify(destination)}`);
  // Click along the same clear segment. Labels can cover a ground pixel, so choose
  // another distance along that segment instead of hiding UI or clicking through it.
  for (const target of route.path) {
    let reached = false;
    for (let attempt = 0; attempt < 45; attempt++) {
      const current = await state();
      const start = { x: Number(current.x), z: Number(current.z) };
      const distance = Math.hypot(target.x - start.x, target.z - start.z);
      if (distance < .1) { reached = true; break; }
      await page.waitForTimeout(140);
      const candidates = [...new Set([3, 4.5, distance, 2, 1, .5].map(length => Math.min(distance, length)))].map(length => ({ x: start.x + (target.x - start.x) * length / distance, z: start.z + (target.z - start.z) * length / distance }));
      const choice = await page.evaluate(({ candidates, start }) => {
        const hook = window.__streetTest;
        for (const next of candidates) {
          const projected = hook.project(next.x, next.z);
          if (projected.x <= 25 || projected.x >= innerWidth - 25 || projected.y <= 180 || projected.y >= innerHeight - 100) continue;
          if (!document.elementFromPoint(projected.x, projected.y)?.classList.contains('d3-canvas')) continue;
          const samples = Math.max(1, Math.ceil(Math.hypot(next.x - start.x, next.z - start.z) / .08));
          let clear = true;
          for (let i = 0; i <= samples; i++) clear &&= hook.free(start.x + (next.x - start.x) * i / samples, start.z + (next.z - start.z) * i / samples);
          if (clear) return { next, projected };
        }
        return null;
      }, { candidates, start });
      assert.ok(choice, `a visible ground click exists along the clear route segment: ${JSON.stringify({ start, target, candidates })}`);
      const { next, projected } = choice;
      await page.mouse.click(projected.x, projected.y);
      await page.waitForTimeout(220); await waitStill();
      const arrived = await state();
      assert.ok(Math.hypot(Number(arrived.x) - next.x, Number(arrived.z) - next.z) < .24, `real click reaches route step ${JSON.stringify({ next, arrived })}`);
    }
    assert.ok(reached, `the clear route segment finishes in bounded clicks: ${JSON.stringify(target)}`);
  }
}

async function validateRoutes(metadata) {
  return page.evaluate(meta => {
    const hook = window.__streetTest;
    return [...meta.points, ...meta.exits].map(target => {
      const { free, path } = hook.route(target.position.x, target.position.z);
      const data = document.querySelector('.d3-canvas').dataset;
      let previous = { x: Number(data.x), z: Number(data.z) }, clear = true;
      for (const step of path) {
        const samples = Math.max(1, Math.ceil(Math.hypot(step.x - previous.x, step.z - previous.z) / .08));
        for (let i = 0; i <= samples; i++) clear &&= hook.free(previous.x + (step.x - previous.x) * i / samples, previous.z + (step.z - previous.z) * i / samples);
        previous = step;
      }
      const end = path.at(-1);
      return { id: target.id, free, clear, steps: path.length, exact: !!end && Math.hypot(end.x - target.position.x, end.z - target.position.z) < .001 };
    });
  }, metadata);
}

try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(urlFor('street')); await ready('street');
  assert.equal(await page.locator('html').getAttribute('data-language'), 'dual');
  assert.deepEqual(await page.locator('.d3-scene-select option').evaluateAll(options => options.map(option => option.value)), ids);

  for (const id of ids.slice(1)) {
    await switchTo(id);
    const metadata = await scene();
    const routes = await validateRoutes(metadata);
    assert.ok(routes.length >= 4, `${id} has inspections and a usable exit`);
    assert.ok(routes.every(route => route.free && route.clear && route.exact && route.steps), `${id} routes: ${JSON.stringify(routes)}`);
    const spawn = await state();
    await page.screenshot({ path: `artifacts/3d-scene-${id}.png` });

    await page.keyboard.down('d'); await page.waitForTimeout(350); await page.keyboard.up('d'); await waitStill();
    const moved = await state();
    assert.ok(Math.hypot(Number(moved.x) - Number(spawn.x), Number(moved.z) - Number(spawn.z)) > .15, `${id}: keyboard walking leaves spawn`);
    await page.keyboard.down('w'); await page.waitForTimeout(180); await page.keyboard.press('Escape'); await page.keyboard.up('w');
    await waitState({ paused: 'true', moving: 'false' }); const paused = await state();
    await page.waitForTimeout(300); const pausedAgain = await state();
    assert.equal(paused.paused, 'true'); assert.equal(paused.moving, 'false');
    assert.equal(paused.x, pausedAgain.x); assert.equal(paused.z, pausedAgain.z);
    await page.locator('.d3-settings .d3-secondary').click(); await page.waitForTimeout(250);

    const point = metadata.points[0];
    await walkTo(point.position);
    await page.keyboard.press('e'); await page.locator('.d3-dialogue:not([hidden])').waitFor({ timeout: 5000 });
    await waitState({ talking: 'true' });
    assert.equal((await state()).talking, 'true');
    assert.equal(await page.locator('.d3-dialogue .text-secondary').count(), 0, `${id} inspection uses the primary language`);
    if (id === 'tavern') {
      const text = await page.locator('.d3-dialogue').innerText();
      const position = await state();
      await page.locator('.d3-settings-button').click(); await page.locator('#d3-language').selectOption('en');
      assert.ok(!/\p{Script=Han}/u.test(await page.locator('.d3-ui').innerText()), 'English mode translates new scene UI');
      await page.locator('#d3-language').selectOption('dual-en');
      assert.ok(!/\p{Script=Han}/u.test(await page.locator('.d3-ui').innerText()), 'English-first mode keeps inspection UI English');
      await page.locator('#d3-language').selectOption('zh');
      assert.equal(await page.locator('.d3-ui .text-secondary').count(), 0);
      await page.locator('#d3-language').selectOption('dual');
      await page.locator('.d3-settings .d3-primary').click();
      assert.equal(await page.locator('.d3-dialogue').innerText(), text, 'language changes preserve the inspection');
      const after = await state(); assert.equal(after.x, position.x); assert.equal(after.z, position.z);
      await page.setViewportSize({ width: 1024, height: 640 }); await page.waitForTimeout(160);
      const box = await page.locator('.d3-dialogue').boundingBox();
      assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1024 && box.y + box.height <= 640, 'primary-language inspection fits small viewport');
      await page.screenshot({ path: 'artifacts/3d-scene-tavern-dialogue-1024.png' });
      await page.setViewportSize({ width: 1440, height: 900 });
    }
    await page.keyboard.press('Escape'); await waitState({ talking: 'false' });
    assert.equal((await state()).talking, 'false');
    const exit = [...metadata.exits].sort((a, b) => Math.hypot(a.position.x - point.position.x, a.position.z - point.position.z) - Math.hypot(b.position.x - point.position.x, b.position.z - point.position.z))[0];
    await walkTo(exit.position); await page.keyboard.press('e'); await ready(exit.to);
    results.push({ scene: id, routes, inspected: point.id, exit: { id: exit.id, to: exit.to } });
  }

  // Alternate complete scenes twice: counters should stabilize once shaders/render targets are warm.
  const firstCycle = new Map();
  for (let cycle = 0; cycle < 2; cycle++) for (const id of ids) {
    const current = await switchTo(id);
    const sample = { scene: id, cycle, geometries: Number(current.geometries), textures: Number(current.textures) };
    assert.ok(Number.isFinite(sample.geometries) && Number.isFinite(sample.textures), 'resource counters are exposed for leak regression');
    resourceSamples.push(sample);
    if (!cycle) firstCycle.set(id, sample);
    else {
      const first = firstCycle.get(id);
      assert.ok(sample.geometries <= first.geometries + 2, `${id} geometries do not accumulate across switches: ${JSON.stringify({ first, sample })}`);
      assert.ok(sample.textures <= first.textures + 2, `${id} textures do not accumulate across switches: ${JSON.stringify({ first, sample })}`);
    }
  }

  await page.goto(urlFor('tavern')); await ready('tavern');
  await page.reload(); await ready('tavern');
  assert.equal(await page.locator('html').getAttribute('data-language'), 'dual');
  await page.goto(urlFor('missing-scene')); await ready('street');

  // A leaving-window event during an asynchronous scene change must not disappear.
  await page.locator('.d3-scene-select').selectOption('tavern');
  await page.locator('.d3-canvas[data-ready=false]').waitFor({ timeout: 3000 });
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await ready('tavern'); await waitState({ paused: 'true', moving: 'false' });
  assert.ok(await page.locator('.d3-settings').evaluate(dialog => dialog.open));
  const backgroundPaused = await state();
  await page.keyboard.down('d'); await page.waitForTimeout(250); await page.keyboard.up('d');
  const backgroundAfter = await state();
  assert.equal(backgroundAfter.x, backgroundPaused.x); assert.equal(backgroundAfter.z, backgroundPaused.z);
  await page.locator('.d3-settings .d3-primary').click(); await waitState({ paused: 'false' });
  lifecycle.blurDuringTransition = 'paused after loading; held movement ignored';

  await page.locator('.d3-settings-button').focus(); await page.keyboard.press('Space');
  await page.locator('.d3-settings[open]').waitFor({ timeout: 3000 });
  await waitState({ paused: 'true' });
  await page.locator('.d3-settings .d3-primary').click(); await waitState({ paused: 'false' });
  lifecycle.focusedButtonSpace = 'native Space opens Settings';

  // Exercise real navigation Back; Chrome decides whether this uses BFCache.
  // Record persisted pageshow events separately from whether the restored game works.
  const pageShows = [];
  await page.exposeFunction('__recordScenePageShow', persisted => pageShows.push(persisted));
  await page.evaluate(() => window.addEventListener('pageshow', event => { void window.__recordScenePageShow(event.persisted); }));
  await page.locator('.d3-actions .d3-back[href="/"]').click();
  await page.waitForURL(url => !url.searchParams.has('demo'), { timeout: 15000 });
  await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }); await ready('tavern');
  if (await page.locator('.d3-settings').evaluate(dialog => dialog.open)) {
    await page.locator('.d3-settings .d3-primary').click(); await waitState({ paused: 'false' });
  }
  const beforeBackWalk = await state();
  await page.locator('.d3-canvas').focus(); await page.keyboard.down('d'); await page.waitForTimeout(400); await page.keyboard.up('d'); await waitStill();
  const afterBackWalk = await state();
  assert.ok(Math.hypot(Number(afterBackWalk.x) - Number(beforeBackWalk.x), Number(afterBackWalk.z) - Number(beforeBackWalk.z)) > .2, 'browser Back restores working movement');
  lifecycle.navigationBack = { movement: 'working', bfcacheObserved: pageShows.includes(true) };

  // Synthetic context loss exercises the same registered handler without asking the
  // driver to recover a real GPU. The error must survive both transition awaits.
  await page.evaluate(() => {
    const canvas = document.querySelector('.d3-canvas');
    const observer = new MutationObserver(() => {
      if (canvas.dataset.scene !== 'square') return;
      observer.disconnect(); canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    });
    // The attribute changes after the new world installs and just as the outgoing
    // fade starts, so this specifically checks cancellation of the second await.
    observer.observe(canvas, { attributes: true, attributeFilter: ['data-scene'] });
  });
  await page.locator('.d3-scene-select').selectOption('square');
  const recovery = page.locator('.d3-loading .d3-primary');
  await recovery.waitFor({ timeout: 3000 }); await page.waitForTimeout(1400);
  assert.equal((await state()).ready, 'false', 'context loss cannot become falsely ready after a transition');
  assert.ok(await recovery.isVisible(), 'the recovery action survives the pending fade');
  assert.equal(await page.locator('.d3-loading').evaluate(node => Number(getComputedStyle(node).opacity)), 1, 'the error overlay stays opaque');
  await page.screenshot({ path: 'artifacts/3d-scene-transition-recovery.png' });
  lifecycle.contextLossDuringTransition = 'recovery remains visible and scene is not ready';
  await page.reload(); await ready('square');

  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  const report = { checks: ['five scene selector', 'all POI and exit routes', 'keyboard movement', 'pause without drift', 'real click inspection approach', 'primary-language environmental inspection', 'language preserves inspection', 'small viewport', 'walk through exits', 'repeat switch resource stability', 'direct link and reload', 'invalid scene fallback', 'blur during scene loading', 'native button Space', 'browser Back restores movement', 'context loss during scene loading'], results, resourceSamples, lifecycle, errors, failures };
  await writeFile('artifacts/multi-scene-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: 'artifacts/multi-scene-failure.png' }).catch(() => {});
  await writeFile('artifacts/multi-scene-failure.json', JSON.stringify({ message: String(error), state: await state().catch(() => null), scene: await scene().catch(() => null), errors, failures, results }, null, 2));
  throw error;
} finally { await browser.close(); }
