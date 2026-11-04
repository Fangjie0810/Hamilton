import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], failures = [], checks = [], snapshots = [], routes = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  const location = message.location().url;
  if (location.endsWith('/favicon.ico') && /Failed to load resource.*404/.test(message.text())) return;
  if (message.type() === 'error' || (message.type() === 'warning' && /shader|validate_status|three\.webglprogram/i.test(message.text()))) errors.push(`${message.type()}: ${message.text()}${location ? ` (${location})` : ''}`);
});
page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`); });
const url = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/'); url.search = '?story=3d&debug=1';
const story = () => page.evaluate(() => window.__streetTest.story());
const environment = () => page.evaluate(() => window.__streetTest.environment());
const canvas = () => page.locator('.d3-canvas').evaluate(node => ({ ...node.dataset }));
const waitStory = expected => page.waitForFunction(values => {
  const current = window.__streetTest?.story?.();
  return current && Object.entries(values).every(([key, value]) => current[key] === value);
}, expected, { timeout: 60000 });
const waitStill = () => page.waitForFunction(() => {
  const data = document.querySelector('.d3-canvas')?.dataset;
  return data?.moving === 'false' && data.path === '0';
}, undefined, { timeout: 18000 });

async function ready(chapter) {
  await page.locator('.d3-canvas[data-mode=story][data-ready=true][data-frame-ready=true]').waitFor({ timeout: 60000 });
  await waitStory({ chapter }); await page.waitForTimeout(200);
}
async function pause() {
  await page.keyboard.press('Escape'); await page.locator('.d3-settings[open]').waitFor();
  await page.waitForFunction(() => document.querySelector('.d3-canvas')?.dataset.paused === 'true');
}
async function resume() {
  await page.locator('.d3-settings .d3-primary').click();
  await page.waitForFunction(() => document.querySelector('.d3-canvas')?.dataset.paused === 'false');
}

/** Routes and projection are read-only. Every move is a real, unobscured ground click. */
async function walkTo(destination) {
  const route = await page.evaluate(point => window.__streetTest.route(point.x, point.z), destination);
  assert.ok(route.free && route.path.length, `walkable target ${JSON.stringify(destination)}`);
  for (const target of route.path) {
    let reached = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      const current = await canvas(), start = { x: Number(current.x), z: Number(current.z) };
      const distance = Math.hypot(target.x - start.x, target.z - start.z);
      if (distance < .13) { reached = true; break; }
      await page.waitForTimeout(140);
      const candidates = [...new Set([3, 4.5, distance, 2, 1, .5].map(length => Math.min(distance, length)))]
        .map(length => ({ x: start.x + (target.x - start.x) * length / distance, z: start.z + (target.z - start.z) * length / distance }));
      const choice = await page.evaluate(({ candidates, start }) => {
        const hook = window.__streetTest;
        for (const next of candidates) {
          const projected = hook.project(next.x, next.z);
          if (projected.x <= 25 || projected.x >= innerWidth - 25 || projected.y <= 180 || projected.y >= innerHeight - 105) continue;
          if (!document.elementFromPoint(projected.x, projected.y)?.classList.contains('d3-canvas')) continue;
          const yaw = Number(document.querySelector('.d3-canvas').dataset.yaw);
          if (hook.story().cast.some(actor => {
            const corners = [-.82, .82].flatMap(offset => [-.15, 1.95].map(height => hook.project(actor.position.x + Math.cos(yaw) * offset, actor.position.z - Math.sin(yaw) * offset, (actor.height ?? 0) + height)));
            return projected.x >= Math.min(...corners.map(point => point.x)) - 3 && projected.x <= Math.max(...corners.map(point => point.x)) + 3
              && projected.y >= Math.min(...corners.map(point => point.y)) - 3 && projected.y <= Math.max(...corners.map(point => point.y)) + 3;
          })) continue;
          const count = Math.max(1, Math.ceil(Math.hypot(next.x - start.x, next.z - start.z) / .08));
          let clear = true;
          for (let i = 0; i <= count; i++) clear &&= hook.free(start.x + (next.x - start.x) * i / count, start.z + (next.z - start.z) * i / count);
          if (clear) return { next, projected };
        }
        return null;
      }, { candidates, start });
      assert.ok(choice, `visible ground waypoint ${JSON.stringify({ start, target })}`);
      await page.mouse.click(choice.projected.x, choice.projected.y);
      await page.waitForTimeout(220); await waitStill();
      const arrived = await canvas();
      assert.ok(Math.hypot(Number(arrived.x) - choice.next.x, Number(arrived.z) - choice.next.z) < .24, 'real ground click reaches its waypoint');
    }
    assert.ok(reached, 'route segment completes in bounded clicks');
  }
}

async function verifyRoutes(points, label) {
  const result = await page.evaluate(points => {
    const hook = window.__streetTest, data = document.querySelector('.d3-canvas').dataset;
    return points.map(point => {
      const { free, path } = hook.route(point.x, point.z);
      let previous = { x: Number(data.x), z: Number(data.z) }, clear = true;
      for (const step of path) {
        const count = Math.max(1, Math.ceil(Math.hypot(step.x - previous.x, step.z - previous.z) / .08));
        for (let index = 0; index <= count; index++) clear &&= hook.free(previous.x + (step.x - previous.x) * index / count, previous.z + (step.z - previous.z) * index / count);
        previous = step;
      }
      const last = path.at(-1);
      return { point, free, clear, steps: path.length, exact: !!last && Math.hypot(last.x - point.x, last.z - point.z) < .001 };
    });
  }, points);
  assert.ok(result.every(route => route.free && route.clear && route.steps && route.exact), `${label}: ${JSON.stringify(result)}`);
  routes.push({ label, result });
}

async function snapshot(name, expectedMist) {
  const current = await story(), atmosphere = await environment();
  assert.equal(atmosphere.harborMist, expectedMist, `${name}: harbor haze matches chapter progression`);
  await page.screenshot({ path: `artifacts/street-${name}.png` });
  snapshots.push({ name, chapter: current.chapter, phase: current.phase, atmosphere, position: await canvas() });
}

async function checkLanguages(expectedMist) {
  const before = await story(), position = await canvas(), atmosphere = await environment();
  for (const language of ['zh', 'en', 'dual']) {
    await pause(); await page.locator('#d3-language').selectOption(language); await resume();
    assert.equal(await page.locator('html').getAttribute('data-language'), language);
    assert.deepEqual(await story(), before, `${before.chapter}: ${language} preserves narrative and targets`);
    assert.deepEqual(await environment(), atmosphere, `${before.chapter}: ${language} preserves atmosphere`);
    const after = await canvas(); assert.equal(after.x, position.x); assert.equal(after.z, position.z);
    assert.equal((await environment()).harborMist, expectedMist);
  }
  checks.push(`${before.chapter}: zh/en/dual preserve chapter, state, position and haze`);
}

async function readLetter() {
  const current = await story();
  assert.equal(current.chapter, 'Opening'); assert.equal(current.phase, 'explore');
  assert.equal(current.target.id, 'opening-letter');
  await walkTo(current.target.position); await page.keyboard.press('e'); await waitStory({ phase: 'dialogue' });
  for (let index = 0; (await story()).phase === 'dialogue'; index++) {
    assert.ok(index < 20, 'opening letter finishes within its dialogue');
    assert.equal((await environment()).harborMist, true, 'haze remains while reading the letter');
    await page.locator('.s3-advance').click(); await page.waitForTimeout(30);
  }
  await waitStory({ chapter: 'Opening', phase: 'exit' });
  assert.equal((await story()).target.id, 'story-exit');
  assert.equal((await environment()).harborMist, true, 'unlocking the exit does not clear haze');
}

try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(url.href); await ready('Opening');
  assert.equal(await page.locator('html').getAttribute('data-language'), 'dual');
  await pause(); await page.locator('#d3-text-speed').selectOption('0'); await page.locator('#d3-motion').check(); await resume();
  const opening = await story();
  const openingSpawn = await canvas();
  assert.equal(opening.phase, 'explore');
  await snapshot('opening-dock-1440', true);
  await page.setViewportSize({ width: 1024, height: 640 }); await page.waitForTimeout(180);
  await snapshot('opening-dock-dual-1024', true);
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(180);
  await checkLanguages(true);
  for (const quality of ['low', 'balanced', 'high', 'balanced']) {
    await pause(); await page.locator('#d3-quality').selectOption(quality); await resume(); await page.waitForTimeout(220);
    assert.equal((await canvas()).quality, quality);
    assert.deepEqual(await story(), opening, `${quality} graphics preserve Opening narrative`);
    assert.equal((await environment()).harborMist, true, `${quality} graphics preserve harbor haze`);
  }
  checks.push('low/balanced/high graphics retain Opening haze and compile without shader errors');
  await verifyRoutes([{ x: Number(openingSpawn.x), z: Number(openingSpawn.z) }, ...opening.targets.map(target => target.position)], 'Opening spawn, letter and street exit');
  const expandedDock = [{ x: 19, z: 3.25 }, { x: 19, z: 6.75 }];
  await verifyRoutes(expandedDock, 'new north and south dock strips');
  for (const point of expandedDock) await walkTo(point);
  assert.equal((await story()).phase, 'explore'); assert.equal((await environment()).harborMist, true);
  const blocked = await page.evaluate(points => points.map(point => ({ point, free: window.__streetTest.free(point.x, point.z) })), [
    { x: -25, z: 3 }, { x: 0, z: -24 }, { x: 0, z: 25 }, { x: 19, z: -2 },
  ]);
  assert.ok(blocked.every(point => !point.free), `city scenery and water remain nonwalkable: ${JSON.stringify(blocked)}`);
  routes.push({ label: 'nonwalkable city scenery and harbor water', result: blocked });
  checks.push('new north and south dock strips accept real walking', 'fence-side city scenery and harbor water remain nonwalkable');

  await readLetter(); await snapshot('opening-unlocked-still-foggy-1440', true);
  await pause(); await page.locator('.s3-restart').click();
  await ready('Opening'); await waitStory({ phase: 'explore' });
  assert.deepEqual((await story()).state, opening.state, 'Opening restart restores its entry checkpoint');
  assert.equal((await environment()).harborMist, true, 'Opening restart restores the harbor haze');
  checks.push('letter dialogue and unlocked exit retain haze', 'restarting Opening restores entry state and haze');

  await readLetter();
  const exit = (await story()).target;
  await walkTo(exit.position); await page.waitForTimeout(350);
  assert.equal((await story()).chapter, 'Opening', 'approaching the unlocked exit never advances the chapter');
  assert.equal((await story()).phase, 'exit');
  await snapshot('opening-at-exit-still-foggy-1440', true);
  await page.keyboard.press('e'); await ready('Arrival');
  await snapshot('arrival-dusk-1440', false);
  checks.push('approaching exit preserves haze', 'real E interaction enters Arrival and reveals the street');

  const arrival = await story(), arrivalSpawn = await canvas(), dusk = await environment();
  await verifyRoutes([{ x: Number(arrivalSpawn.x), z: Number(arrivalSpawn.z) }, ...arrival.targets.map(target => target.position)], 'Arrival spawn, every story interaction and tavern exit');
  assert.ok(dusk.light.power < 2 && dusk.light.ambient < 1.35, 'street lighting is below the former daylight intensity');
  await checkLanguages(false);

  await walkTo({ x: 0, z: 5 });
  await page.mouse.move(720, 490); await page.mouse.wheel(0, 1400); await page.waitForTimeout(200);
  await snapshot('arrival-city-zoomed-out-1440', false);
  await page.mouse.move(730, 500); await page.mouse.down({ button: 'right' });
  await page.mouse.move(960, 460, { steps: 16 }); await page.mouse.up({ button: 'right' }); await page.waitForTimeout(200);
  await snapshot('arrival-city-orbit-1440', false);
  await page.setViewportSize({ width: 1024, height: 640 }); await page.waitForTimeout(200);
  await snapshot('arrival-city-orbit-dual-1024', false);
  assert.equal((await story()).chapter, 'Arrival'); assert.equal((await story()).phase, 'explore');
  checks.push('Arrival dusk remains revealed through walking, zoom, orbit and small bilingual layout');

  const report = { baseURL: url.href, checks, routes, snapshots, errors, failures };
  await writeFile('artifacts/street-atmosphere-check.json', JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  console.log(JSON.stringify({ report: 'artifacts/street-atmosphere-check.json', checks, screenshots: snapshots.map(snapshot => snapshot.name), errors, failures }, null, 2));
} catch (error) {
  await page.screenshot({ path: 'artifacts/street-atmosphere-failure.png' }).catch(() => {});
  throw error;
} finally { await browser.close(); }
