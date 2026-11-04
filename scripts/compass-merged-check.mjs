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
const url = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/?story=3d&debug=1');
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
    else if (current.phase === 'choice') {
      assert.equal(await page.locator('.s3-choice-kicker,.s3-choice:not(:disabled) .s3-choice-hint').count(), 0, 'responses omit their kicker and subtitles');
      await page.locator('.s3-choice:not(:disabled)').first().click(); await readDialogue();
    }
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
  await mkdir('artifacts/compass-merge', { recursive: true });
  await page.goto(url.href);
  await ready('Opening');
  assert.equal(await page.locator('.s3-compass').isVisible(), false);
  assert.equal(await page.locator('.cf-feedback').isVisible(), false);
  await readMainlineUntil('Arrival');
  await page.emulateMedia({reducedMotion:'no-preference'});
  const before = await story();
  assert.equal(before.state.influence,10);
  assert.equal(await page.locator('.s3-tutorial[data-tutorial="camera"]').isVisible(),false);
  await mainTarget();
  await readDialogue();
  await page.waitForFunction(()=>document.querySelector('.cf-feedback')?.dataset.phase==='hold');
  await pause();
  const changed = await story();
  assert.equal(changed.state.influence,12);
  assert.equal(await page.locator('.cf-disc [data-stat="influence"]').getAttribute('data-value'),'12');
  const source=await page.locator('.s3-compass').boundingBox(), enlarged=await page.locator('.cf-panel').boundingBox();
  assert.ok(Math.abs(enlarged.width/source.width-1.5)<.01);
  assert.ok(Math.abs(enlarged.x-source.x)<1&&Math.abs(enlarged.y-source.y)<1);
  const style=await page.locator('.cf-panel').getAttribute('style');
  await page.waitForTimeout(600);
  assert.equal(await page.locator('.cf-panel').getAttribute('style'),style);
  checks.push('Real prologue → Arrival → newsboy dialogue grants influence +2 and triggers the left HUD at 150%; settings freeze it');
  // Inspect the real game's paused frame without the settings covering it.
  await page.addStyleTag({content:'.d3-settings[open]{opacity:0!important}.d3-settings::backdrop{background:transparent!important;backdrop-filter:none!important}'});
  assert.equal(await page.locator('.s3-growth-notice').isVisible(),false);
  for(const mode of ['dual','dual-en','zh','en']) {
    await page.evaluate(async mode => (await import('/src/i18n/text.ts')).setLanguage(mode),mode);
    assert.equal(await page.locator('.cf-changes .text-secondary').count(),0);
    const text=await page.locator('.cf-changes').innerText();
    assert.ok(text.includes(mode==='dual'||mode==='zh'?'影响力':'Influence')&&text.includes('+2'));
    await page.screenshot({path:`artifacts/compass-merge/actual-${mode}.png`});
  }
  checks.push('All four languages render only primary-language change labels; review tools are absent');
  assert.equal(await page.locator('.af-review').count(),0);
  await resume();
  await page.locator('.cf-feedback').waitFor({state:'hidden'});
  assert.equal(await page.locator('.s3-compass').isVisible(),true);
  assert.equal(await page.locator('.s3-compass [data-stat="influence"]').getAttribute('data-value'),'12');
  await page.locator('.s3-growth-notice').waitFor({state:'visible'});
  await page.screenshot({path:'artifacts/compass-merge/restored-hud.png'});
  assert.equal(await page.locator('.s3-tutorial[data-tutorial="camera"]').isVisible(),true);
  await pause();await page.locator('.s3-restart').click();await ready('Arrival');
  assert.equal(await page.locator('.cf-feedback').isVisible(),false);
  assert.equal((await story()).state.influence,10);
  checks.push('HUD restores after the cue; current post-newsboy camera tutorial remains; chapter restart clears feedback and restores checkpoint');
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  await writeFile('artifacts/compass-merge/browser-check.json',JSON.stringify({checks,errors,failures},null,2));
  console.log(JSON.stringify({checks,errors,failures},null,2));
} catch(error) {
  await page.screenshot({path:'artifacts/compass-merge/failure.png'});
  throw error;
} finally {await browser.close();}
