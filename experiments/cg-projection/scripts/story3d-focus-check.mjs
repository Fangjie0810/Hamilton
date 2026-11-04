import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], failures = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`); });
const url = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/'); url.search = '?story=3d&debug=1';
const story = () => page.evaluate(() => window.__streetTest.story());
const canvas = () => page.locator('.d3-canvas').evaluate(node => ({ ...node.dataset }));
const waitPhase = phase => page.waitForFunction(expected => window.__streetTest?.story?.().phase === expected, phase, { timeout: 60000 });
const ready = () => page.locator('.d3-canvas[data-mode=story][data-ready=true]').waitFor({ timeout: 60000 });
const waitStill = () => page.waitForFunction(() => {
  const state = document.querySelector('.d3-canvas')?.dataset;
  return state?.moving === 'false' && state.path === '0';
}, undefined, { timeout: 18000 });

/** Read-only projection/path helpers; the real Demo receives every movement click. */
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

async function readLines() {
  for (let index = 0; (await story()).phase === 'dialogue'; index++) {
    assert.ok(index < 20, 'conversation finishes');
    await page.locator('.s3-advance').click(); await page.waitForTimeout(30);
  }
}
async function pause() {
  await page.keyboard.press('Escape');
  await page.locator('.d3-settings[open]').waitFor();
  await page.waitForFunction(() => document.querySelector('.d3-canvas')?.dataset.paused === 'true');
}
async function resume() {
  await page.locator('.d3-settings .d3-primary').click();
  await page.waitForFunction(() => document.querySelector('.d3-canvas')?.dataset.paused === 'false');
}
async function expectOption(index) {
  assert.ok(await page.locator('.s3-choice').nth(index).evaluate(node => node === document.activeElement), `choice ${index + 1} owns focus`);
}
async function choiceTabCycle() {
  assert.ok(await page.locator('.s3-dialogue').evaluate(node => node === document.activeElement), 'choice dialog starts or resumes with focus');
  await page.keyboard.press('Tab'); await expectOption(0);
  await page.keyboard.press('Tab'); await expectOption(1);
  await page.keyboard.press('Shift+Tab'); await expectOption(0);
  const last = (await page.locator('.s3-choice').count()) - 1;
  await page.keyboard.press('Shift+Tab'); await expectOption(last);
  await page.keyboard.press('Tab'); await expectOption(0);
  await page.keyboard.press('Tab'); await expectOption(1);
}

try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(url.href); await ready();
  await pause(); await page.locator('#d3-text-speed').selectOption('0'); await page.locator('#d3-motion').check(); await resume();
  for (let step = 0; step < 15; step++) {
    const current = await story();
    if (current.chapter === 'Arrival' && current.phase === 'choice') break;
    assert.ok(['Opening', 'Arrival'].includes(current.chapter), 'bounded route ends at the first narrative choice');
    if (current.target?.id === 'arrival-street' && current.phase === 'explore') {
      const actor = current.cast.find(item => item.id === 'loyalist');
      assert.ok(actor?.interactionIds?.includes('arrival-street'), 'the street speaker maps to the citizen-led interaction');
      const hit = await page.evaluate(actor => {
        for (const height of [1, .7, 1.3]) {
          const point = window.__streetTest.project(actor.position.x, actor.position.z, (actor.height ?? 0) + height);
          if (point.x > 0 && point.x < innerWidth && point.y > 0 && point.y < innerHeight
            && document.elementFromPoint(point.x, point.y)?.classList.contains('d3-canvas')) return point;
        }
        return null;
      }, actor);
      assert.ok(hit, 'street speaker is visible and can receive a real body click');
      await page.mouse.click(hit.x, hit.y); await waitPhase('dialogue');
      assert.equal((await story()).target, undefined);
      assert.equal(await page.locator('.s3-dialogue').getAttribute('data-speaker'), 'citizen');
      checks.push('clicking the visible loyalist body walks up and opens the citizen-led street argument');
      await readLines(); continue;
    }
    if (current.phase === 'dialogue') await readLines();
    else {
      assert.ok(current.target && ['explore', 'exit'].includes(current.phase));
      await walkTo(current.target.position); await page.keyboard.press('e');
      if (current.phase === 'exit') {
        await page.waitForFunction(previous => window.__streetTest.story().chapter !== previous, current.chapter);
        await ready(); await page.waitForTimeout(160);
      } else { await waitPhase('dialogue'); await readLines(); }
    }
  }
  await waitPhase('choice');
  const before = await story(); assert.equal(before.chapter, 'Arrival');
  assert.equal(await page.locator('.s3-dialogue').getAttribute('data-choice'), 'burr_first_impression');
  assert.equal(await page.locator('.s3-choice-hint').count(), 3);
  await choiceTabCycle();
  checks.push('real Demo Tab advances first to second choice', 'Shift+Tab returns to previous choice', 'forward and reverse boundary focus wrapping');
  for (const language of ['en', 'zh', 'dual']) {
    await pause(); await page.locator('#d3-language').selectOption(language); await resume();
    assert.equal(await page.locator('.s3-choice-hint').count(), 3, 'translated option hints remain in the DOM');
    const hints = await page.locator('.s3-choice-hint').allTextContents(); assert.ok(hints.every(text => text.trim()));
    if (language === 'en') assert.ok(hints.every(text => !/\p{Script=Han}/u.test(text)), 'English hints have no Han residue');
    if (language === 'zh') assert.equal(await page.locator('.s3-choice-hint .text-secondary').count(), 0);
    if (language === 'dual') assert.equal(await page.locator('.s3-choice-hint .text-secondary').count(), 3);
    await choiceTabCycle();
    const after = await story(); assert.equal(after.phase, 'choice'); assert.equal(after.index, before.index); assert.deepEqual(after.state, before.state);
  }
  checks.push('resume restores dialog focus in every language', 'all three option hints survive language switches', 'Tab and settings preserve narrative state');
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.screenshot({ path: 'artifacts/story3d-focus-choice-1024.png' });
  await page.keyboard.press('Enter'); await waitPhase('dialogue');
  const chosen = await story(); assert.equal(chosen.state.choices.burr_first_impression, 'burr-question'); assert.equal(chosen.index, before.index);
  checks.push('native Enter commits only the focused option and leaves its reply visible');
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  const report = { baseURL: url.href, checks, chapter: chosen.chapter, choice: chosen.state.choices.burr_first_impression, errors, failures };
  await writeFile('artifacts/story3d-focus-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: 'artifacts/story3d-focus-failure.png' }).catch(() => {});
  throw error;
} finally { await browser.close(); }
