import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { playActivity } from './gameplay-helpers.mjs';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], failures = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`); });
const url = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/');
const story = () => page.evaluate(() => window.__streetTest.story());
const canvas = () => page.locator('.d3-canvas').evaluate(node => ({ ...node.dataset }));
const inventory = () => page.locator('.s3-inventory [data-item="scattered-newspaper"]');
const compass = stat => page.locator(`.s3-compass [data-stat="${stat}"]`);
const quietDialogue = () => page.locator('.s3-dialogue:not([hidden]):not(.s3-choosing)');
const progress = state => ({ chapter: state.chapter, phase: state.phase, index: state.index, completed: state.completed, state: state.state });
const removed = '.s3-objective,.s3-chapter,.s3-dialogue-footer,.s3-advance';
const obsoleteNotes = /双语仅用于对话|Bilingual text is used only for dialogue|走近亮起的目标推进剧情|Approach lit targets to advance|重开本幕会恢复进入时的选择与数值/;
await page.addInitScript(() => {
  if (sessionStorage.getItem('release-040-initialized')) return;
  sessionStorage.setItem('release-040-initialized', 'true');
  localStorage.clear();
  localStorage.setItem('project-hamilton:3d-quality:v1', 'low');
  localStorage.setItem('project-hamilton:3d-text-speed:v1', '0');
  localStorage.setItem('project-hamilton:voiceover-enabled:v1', 'false');
  localStorage.setItem('project-hamilton:music-enabled:v1', 'false');
});

async function ready(chapter) {
  await page.locator('.d3-canvas[data-mode="story"][data-ready="true"]').waitFor({ timeout: 60000 });
  await page.waitForFunction(expected => window.__streetTest?.story?.().chapter === expected, chapter, { timeout: 60000 });
  await page.waitForFunction(() => Number.isFinite(Number(document.querySelector('.d3-canvas')?.dataset.pitch)));
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
async function fit(selector, label) {
  assert.ok(await page.locator(selector).evaluate(node => {
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;
  }), `${label} fits the viewport`);
}
async function checkSettings(selector, languageSelector, name) {
  const panel = page.locator(selector);
  assert.equal(await panel.locator('input[type="checkbox"]').count(), 0, `${name} has no obsolete toggle controls`);
  assert.equal(await panel.locator('[data-volume-channel]').count(), 2, `${name} retains both volume sliders`);
  for (const language of ['zh', 'en', 'dual', 'dual-en']) {
    await page.locator(languageSelector).selectOption(language);
    assert.ok(!obsoleteNotes.test(await panel.innerText()), `${name}/${language} has no deleted explanatory notes`);
    assert.equal(await panel.locator('.text-secondary').count(), 0, 'settings use only the primary language');
    assert.deepEqual(await page.locator(`${languageSelector} option`).allTextContents(), ['双语 · 中文主字幕', 'Bilingual · English first', '中文', 'English']);
    if (language.startsWith('dual')) {
      await page.setViewportSize({ width: 390, height: 844 });
      for (const channel of ['voiceover', 'music']) {
        const slider = panel.locator(`[data-volume-channel="${channel}"]`);
        await slider.scrollIntoViewIfNeeded();
        assert.ok(await slider.evaluate(node => { const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.width >= 80; }));
      }
      await page.screenshot({ path: `artifacts/release-0.4.0-${name}-${language}-390.png` });
      await page.setViewportSize({ width: 1440, height: 900 });
    }
  }
}
async function readDialogue() {
  for (let step = 0; await quietDialogue().isVisible(); step++) {
    assert.ok(step < 30, 'conversation completes in bounded inputs');
    await quietDialogue().focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);
  }
}

/** Route queries are read-only; every movement and interaction is a real user input. */
async function walkTo(destination, interactionId) {
  const route = await page.evaluate(point => window.__streetTest.route(point.x, point.z), destination);
  assert.ok(route.free && route.path.length, `walkable route to ${JSON.stringify(destination)}`);
  for (const target of route.path) {
    let reached = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const scene = await story();
      if (scene.smallTalk || scene.discovery.phase !== 'idle' || scene.phase === 'dialogue'
        || interactionId === 'pickup:scattered-newspaper' && scene.state.choices['inventory:scattered-newspaper'] === 'collected') return;
      const current = await canvas(), start = { x: Number(current.x), z: Number(current.z) };
      const distance = Math.hypot(target.x - start.x, target.z - start.z);
      if (distance < .22) { reached = true; break; }
      const choice = await page.evaluate(({ start, target, distance }) => {
        const hook = window.__streetTest;
        for (const length of [...new Set([3, 1.5, .7, distance].map(value => Math.min(value, distance)))]) {
          const next = { x: start.x + (target.x - start.x) * length / distance, z: start.z + (target.z - start.z) * length / distance };
          const point = hook.project(next.x, next.z);
          if (point.x < 30 || point.x > innerWidth - 30 || point.y < 180 || point.y > innerHeight - 110) continue;
          if (!document.elementFromPoint(point.x, point.y)?.classList.contains('d3-canvas')) continue;
          const yaw = Number(document.querySelector('.d3-canvas').dataset.yaw);
          if (hook.story().cast.some(actor => {
            const corners = [-1, 1].flatMap(offset => [-.15, 1.95].map(height => hook.project(actor.position.x + Math.cos(yaw) * offset, actor.position.z - Math.sin(yaw) * offset, (actor.height ?? 0) + height)));
            return point.x >= Math.min(...corners.map(p => p.x)) - 4 && point.x <= Math.max(...corners.map(p => p.x)) + 4
              && point.y >= Math.min(...corners.map(p => p.y)) - 4 && point.y <= Math.max(...corners.map(p => p.y)) + 4;
          })) continue;
          const samples = Math.ceil(length / .08);
          if (Array.from({ length: samples + 1 }, (_, i) => hook.free(start.x + (next.x - start.x) * i / samples, start.z + (next.z - start.z) * i / samples)).every(Boolean)) return { next, point };
        }
      }, { start, target, distance });
      if (choice) {
        await page.mouse.click(choice.point.x, choice.point.y);
        await page.waitForFunction(({ point, interactionId }) => {
          const scene = window.__streetTest.story();
          if (scene.smallTalk || scene.discovery.phase !== 'idle' || scene.phase === 'dialogue'
            || interactionId === 'pickup:scattered-newspaper' && scene.state.choices['inventory:scattered-newspaper'] === 'collected') return true;
          const data = document.querySelector('.d3-canvas')?.dataset;
          return data?.moving === 'false' && data.path === '0' && Math.hypot(Number(data.x) - point.x, Number(data.z) - point.z) < .25;
        }, { point: choice.next, interactionId }, { timeout: 18000 });
      } else {
        const yaw = Number(current.yaw), dx = target.x - start.x, dz = target.z - start.z;
        const right = dx * Math.cos(yaw) - dz * Math.sin(yaw), forward = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
        const angle = Math.round(Math.atan2(forward, right) / (Math.PI / 4)) * Math.PI / 4;
        const horizontal = Math.round(Math.cos(angle)), vertical = Math.round(Math.sin(angle));
        const keys = [horizontal && (horizontal > 0 ? 'd' : 'a'), vertical && (vertical > 0 ? 'w' : 's')].filter(Boolean);
        await page.locator('.d3-canvas').focus();
        for (const key of keys) await page.keyboard.down(key);
        await page.waitForTimeout(Math.max(40, Math.min(160, distance / 2.8 * 1000)));
        for (const key of keys) await page.keyboard.up(key);
        await page.waitForTimeout(160);
      }
    }
    assert.ok(reached, `bounded path segment ${JSON.stringify(target)}`);
  }
}
async function activate(target) {
  assert.ok(target, 'interaction target exists');
  const marker = page.locator(`.d3-place[data-point="${target.id}"]`);
  if (await marker.isVisible()) await marker.click();
  else {
    await walkTo(target.position, target.id);
    const scene = await story();
    if (scene.smallTalk || scene.discovery.phase !== 'idle' || scene.phase === 'dialogue'
      || target.id === 'pickup:scattered-newspaper' && scene.state.choices['inventory:scattered-newspaper'] === 'collected') return;
    if (await marker.isVisible()) await marker.click();
    else await page.keyboard.press('e');
  }
  await page.waitForTimeout(250);
}
async function mainTarget(attempt = 0) {
  assert.ok(attempt < 5, 'main target remains reachable after incidental map interactions');
  const before = await story();
  await activate(before.target);
  if (before.target.exit) {
    await page.waitForFunction(chapter => {
      const scene = window.__streetTest.story();
      return scene.chapter !== chapter || scene.discovery.phase !== 'idle' || scene.smallTalk;
    }, before.chapter, { timeout: 60000 });
    if ((await story()).chapter === before.chapter) { await readDialogue(); return mainTarget(attempt + 1); }
    await ready((await story()).chapter);
  } else {
    await quietDialogue().waitFor({ timeout: 25000 });
    const scene = await story();
    if (scene.discovery.phase !== 'idle' || scene.smallTalk) { await readDialogue(); return mainTarget(attempt + 1); }
  }
}
async function readMainlineUntil(chapter) {
  for (let step = 0; step < 65; step++) {
    const current = await story();
    if (current.chapter === chapter && current.phase === 'explore') return;
    if (current.phase === 'dialogue') await readDialogue();
    else if (current.phase === 'choice') { await page.locator('.s3-choice:not(:disabled)').first().click(); await readDialogue(); }
    else if (current.phase === 'activity') await playActivity(page, false);
    else if (['explore', 'exit'].includes(current.phase)) await mainTarget();
    else throw new Error(`Unexpected progression ${current.chapter}/${current.phase}`);
  }
  throw new Error(`Did not reach ${chapter}`);
}
async function pickupPaper() {
  const before = await story();
  const target = [...(before.pickups ?? []), ...(before.discoveryTargets ?? []), ...before.discoveries, ...before.targets].find(item => item.id === 'pickup:scattered-newspaper');
  assert.ok(target, 'paper is a separate pickup behind the tavern');
  await activate(target);
  await page.waitForFunction(() => window.__streetTest.story().state.choices['inventory:scattered-newspaper'] === 'collected', undefined, { timeout: 25000 });
  await readDialogue();
  await inventory().waitFor();
  const after = await story();
  assert.equal(after.state.influence, before.state.influence, 'pickup alone does not grant return reward');
  assert.equal(after.state.choices['side:arrival-scattered-paper'], undefined);
  assert.equal(after.index, before.index, 'pickup preserves main progression');
  assert.equal(await page.locator('.d3-place[data-point="pickup:scattered-newspaper"]').count(), 0);
}
async function newsboyChat(expected) {
  const before = await story(), target = before.repeatTargets.find(item => item.smallTalk === 'newsboy');
  await activate(target);
  await quietDialogue().waitFor({ timeout: 25000 });
  assert.ok((await page.locator('.s3-line').innerText()).includes(expected));
  await readDialogue();
  assert.deepEqual(progress(await story()), progress(before), 'ordinary chatter has no gameplay effects');
}

try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(url.href);
  await page.locator('.entry-settings-trigger').click();
  for (const channel of ['voiceover', 'music']) {
    const slider = page.locator(`[data-volume-channel="${channel}"]`);
    assert.equal(await slider.inputValue(), '0', 'old disabled preference becomes zero volume');
    await slider.fill('63'); assert.equal(await slider.inputValue(), '63');
    await slider.fill('0');
  }
  await checkSettings('.entry-settings', '#entry-settings-language', 'entry-settings');
  await page.locator('#entry-settings-language').selectOption('dual');
  await page.locator('.entry-settings .entry-dialog-close').click();
  url.search = '?story=3d&debug=1';
  await page.goto(url.href); await ready('Opening');
  await page.locator('.s3-tutorial[data-tutorial="movement"]:not([hidden])').waitFor();
  assert.equal(Number((await canvas()).pitch), .43);
  assert.equal(await page.locator(removed).count(), 0);
  assert.equal(await compass('washingtonTrust').getAttribute('data-locked'), 'true');
  assert.equal(await page.locator('.s3-compass').isVisible(), false, 'compass starts in Act I, not the prologue');
  checks.push('entry toggles removed; old off preferences migrate to zero volume; four language modes and narrow settings');

  const orbit = page.locator('.d3-camera-orbit');
  await fit('.d3-camera-orbit', 'camera sphere');
  const original = await canvas(), box = await orbit.boundingBox();
  const spherePoint = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(spherePoint.x, spherePoint.y); await page.mouse.down();
  await page.mouse.move(spherePoint.x + 30, spherePoint.y + 40, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(250);
  const sphereResult = await canvas();
  assert.ok(Math.abs(Number(sphereResult.pitch) - .59) < .002);
  assert.ok(Math.abs(Number(sphereResult.yaw) - Number(original.yaw) + .18) < .002);
  assert.equal(sphereResult.x, original.x); assert.equal(sphereResult.z, original.z);
  await page.locator('.d3-canvas').focus(); await page.keyboard.press('r'); await page.waitForTimeout(150);
  await page.mouse.move(720, 430); await page.mouse.down({ button: 'right' });
  await page.mouse.move(750, 470, { steps: 6 }); await page.mouse.up({ button: 'right' }); await page.waitForTimeout(200);
  const rightResult = await canvas();
  assert.equal(rightResult.pitch, sphereResult.pitch); assert.equal(rightResult.yaw, sphereResult.yaw);
  await page.keyboard.press('r'); await page.waitForTimeout(150);
  await page.mouse.move(720, 430); await page.mouse.wheel(0, -100); await page.waitForTimeout(180);
  assert.ok(Number((await canvas()).radius) < Number(original.radius));
  await page.keyboard.press('r');
  checks.push('default lowest camera; sphere and right drag share deltas without moving player; wheel zoom');

  await pause(); await checkSettings('.d3-settings', '#d3-language', 'story-settings');
  await page.locator('#d3-language').selectOption('dual'); await resume();
  await mainTarget();
  await page.locator('.s3-tutorial[data-tutorial="dialogue"]:not([hidden])').waitFor();
  const beforeE = await page.locator('.s3-line').innerText();
  await quietDialogue().focus(); await page.keyboard.press('e'); await page.waitForTimeout(160);
  assert.equal(await page.locator('.s3-line').innerText(), beforeE, 'E cannot advance dialogue');
  for (const mode of ['zh', 'en', 'dual', 'dual-en']) {
    const before = await story();
    await pause(); await page.locator('#d3-language').selectOption(mode); await resume();
    assert.deepEqual(progress(await story()), progress(before));
    assert.equal(await page.locator('.s3-line > .text-secondary').count(), mode.startsWith('dual') ? 1 : 0);
    assert.equal(await page.locator('.s3-line > .text-primary').getAttribute('lang'), mode === 'en' || mode === 'dual-en' ? 'en' : 'zh-CN');
    assert.equal(await page.locator(removed).count(), 0);
    if (mode.startsWith('dual')) {
      await page.setViewportSize({ width: 1024, height: 640 });
      await fit('.s3-dialogue', `${mode} small dialogue`);
      await fit('.s3-dialogue-stage .dialogue-portraits', `${mode} small portraits`);
      await page.screenshot({ path: `artifacts/release-0.4.0-dialogue-${mode}-1024.png` });
      await page.setViewportSize({ width: 1440, height: 900 });
    }
  }
  await pause(); await page.locator('#d3-language').selectOption('dual'); await resume();
  const first = await page.locator('.s3-line').innerText();
  await page.locator('.s3-line').click(); await page.waitForTimeout(90);
  assert.notEqual(await page.locator('.s3-line').innerText(), first, 'left click advances to the next line');
  const second = await page.locator('.s3-line').innerText();
  await page.keyboard.press('Space'); await page.waitForTimeout(90);
  assert.notEqual(await page.locator('.s3-line').innerText(), second, 'Space advances to the next line');
  await readDialogue(); await mainTarget(); await ready('Arrival');
  await page.locator('.s3-tutorial[data-tutorial="camera"]:not([hidden])').waitFor();
  checks.push('opening movement/dialogue and Act I camera tutorials; E excluded; click/Space continue; all subtitle modes preserve scene and narrow dialogue layout');

  for (const stat of ['momentum', 'influence', 'washingtonTrust', 'burrRivalry', 'burrRespect']) {
    const part = compass(stat);
    assert.equal(await part.getAttribute('role'), 'button');
    assert.ok(await part.getAttribute('aria-label'));
    // Each number stays inside its own sector, including the changing red/blue halves.
    // Click there rather than a bounding-box center or an obsolete arc path.
    const hit = await part.evaluate(node => {
      const number = node.querySelector('text');
      return new DOMPoint(number.x.baseVal[0].value, number.y.baseVal[0].value).matrixTransform(number.getScreenCTM()).toJSON();
    });
    await page.mouse.move(hit.x, hit.y);
    await page.locator('.s3-compass-tooltip:not([hidden])').waitFor();
    await page.mouse.click(hit.x, hit.y);
    await page.locator('.s3-growth-dialog[open]').waitFor();
    assert.ok((await page.locator('.s3-growth-dialog').innerText()).trim());
    await page.locator('.s3-growth-close').click();
  }
  const entry = await story();
  assert.equal(entry.target.title.zh, '今日号外');
  await mainTarget(); await readDialogue();
  await newsboyChat('报纸被风吹走了好多页，这下赚不到钱了......');
  await pickupPaper();
  await page.screenshot({ path: 'artifacts/release-0.4.0-newspaper-picked-up.png' });
  await pause(); await page.locator('.s3-restart').click(); await ready('Arrival');
  assert.deepEqual((await story()).state, entry.state, 'chapter restart restores its original inventory and stats');
  assert.equal(await inventory().count(), 0);
  await mainTarget(); await readDialogue(); await pickupPaper();
  const carrying = await story();
  for (const mode of ['en', 'zh', 'dual-en', 'dual']) {
    await pause(); await page.locator('#d3-language').selectOption(mode); await resume();
    assert.deepEqual((await story()).state, carrying.state);
    assert.ok(await inventory().isVisible(), 'carried pixel icon survives language switches');
  }
  const returnTarget = (await story()).discoveries.find(item => item.discovery === 'arrival-scattered-paper');
  assert.ok(returnTarget, 'carried paper enables return at newsboy');
  await activate(returnTarget); await quietDialogue().waitFor({ timeout: 25000 });
  assert.ok(await inventory().isVisible(), 'paper remains carried until handover finishes');
  await readDialogue();
  const returned = await story();
  assert.ok(returned.state.choices['side:arrival-scattered-paper']);
  assert.equal(returned.state.influence, carrying.state.influence + 2);
  assert.equal(await inventory().count(), 0, 'handover removes the inventory icon');
  await newsboyChat('谢谢您先生！我会记住您的名字');
  await newsboyChat('谢谢您先生！我会记住您的名字');
  assert.equal((await story()).state.influence, returned.state.influence, 'repeat thanks cannot duplicate the return reward');
  checks.push('radial metric hover/click controls; trust initially locked; newspaper pickup, persistent icon, return reward, chatter and restart rollback');

  const initialRespect = Number(await compass('burrRespect').getAttribute('data-value'));
  await readMainlineUntil('Tavern');
  assert.ok(Number((await story()).state.burrRespect) > initialRespect, 'Burr choice changes respect');
  await readMainlineUntil('Debate');
  assert.equal(Number((await canvas()).pitch), .43);
  assert.equal(Number((await canvas()).radius), 24, 'Act I scene 3 enters closer than the old radius 29');
  assert.equal(await compass('washingtonTrust').getAttribute('data-locked'), 'true');
  await page.screenshot({ path: 'artifacts/release-0.4.0-square.png' });
  await readMainlineUntil('Washington');
  assert.equal(await compass('washingtonTrust').getAttribute('data-locked'), 'false', 'trust unlocks on camp entry');
  checks.push('Burr relation changes through real choices; scene 3 default zoom; Washington trust unlocks only on camp entry');
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  const report = { passed: true, url: url.href, checks, final: await story(), errors, failures };
  await writeFile('artifacts/release-0.4.0-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: 'artifacts/release-0.4.0-failure.png', fullPage: true }).catch(() => {});
  await writeFile('artifacts/release-0.4.0-check.json', JSON.stringify({ passed: false, error: String(error), checks, story: await story().catch(() => null), canvas: await canvas().catch(() => null), errors, failures }, null, 2));
  throw error;
} finally { await browser.close(); }
