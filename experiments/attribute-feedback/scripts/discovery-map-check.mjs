import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { playActivity } from './gameplay-helpers.mjs';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const errors = [], failures = [], visits = [], interactions = [], activities = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`); });
const url = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/'); url.search = '?story=3d&debug=1';
const canvas = () => page.locator('.d3-canvas').evaluate(node => ({ ...node.dataset }));
const story = () => page.evaluate(() => window.__streetTest.story());
const waitStill = () => page.waitForFunction(() => {
  const data = document.querySelector('.d3-canvas')?.dataset;
  return data?.moving === 'false' && data.path === '0';
}, undefined, { timeout: 18000 });
async function ready() {
  await page.locator('.d3-canvas[data-ready=true]').waitFor({ timeout: 60000 });
  await page.waitForTimeout(200);
  const intro = page.locator('.s3-growth-dialog[open][data-intro=true]');
  if (await intro.count()) await intro.locator('.s3-growth-close').click();
}

function optionalActive(target, current) {
  if (target.pickup) return Object.hasOwn(current.state.choices, 'inventory:scattered-newspaper');
  if (target.smallTalk) return current.smallTalk === target.smallTalk;
  return current.discovery.id === target.discovery && current.discovery.phase !== 'idle';
}
async function selectDiscovery(target) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await story();
    if (optionalActive(target, current)) return;
    const marker = page.locator(`.d3-place[data-point="${target.id}"]`);
    const prompt = page.locator(`.d3-interact[data-target="${target.id}:true"]:not([hidden])`);
    if (await marker.isVisible()) await marker.click();
    else if (await prompt.count()) await page.keyboard.press('e');
    else {
      // Approach the selected paper by real ground clicks. If its E prompt is
      // crowded out, step back and choose its explicit visible marker.
      if (!attempt) { await walkTo(target.position, target); continue; }
      const candidate = await page.evaluate(({ point, attempt }) => {
        const hook = window.__streetTest;
        for (let i = 0; i < 16; i++) {
          const angle = (i + attempt * 3) * Math.PI / 8;
          const next = { x: point.x + Math.cos(angle) * 2.5, z: point.z + Math.sin(angle) * 2.5 };
          if (hook.free(next.x, next.z) && hook.route(next.x, next.z).path.length) return next;
        }
      }, { point: target.position, attempt });
      assert.ok(candidate, `a walkable viewpoint exists for ${target.id}`);
      await walkTo(candidate, target); continue;
    }
    await page.waitForFunction(target => {
      const current = window.__streetTest.story();
      if (target.pickup) return Object.hasOwn(current.state.choices, 'inventory:scattered-newspaper');
      if (target.smallTalk) return current.smallTalk === target.smallTalk;
      return current.discovery.id === target.discovery && current.discovery.phase !== 'idle';
    }, target, { timeout: 20000 });
    return;
  }
  throw new Error(`Discovery cannot be selected by its marker or E prompt: ${target.id}; ${JSON.stringify(await story())}`);
}

async function readDiscovery() {
  for (let step = 0; step < 15; step++) {
    const current = await story();
    if (current.discovery.phase === 'idle') return;
    if (current.discovery.phase === 'dialogue') await page.keyboard.press('Space');
    else if (current.discovery.phase === 'choice') await page.locator('.s3-choice:not(:disabled)').first().click();
    await page.waitForTimeout(40);
  }
  throw new Error('A discovery exceeded its expected short dialogue length');
}

const expectedReward = {
  'letter-name': { momentum: 3 }, 'arrival-scattered-paper': { influence: 2 },
  'arrival-burr-margin': { burrRespect: 3 }, 'tavern-unfinished-draft': { momentum: 3 },
  'square-bread-and-prices': { influence: 3 }, 'camp-misfiled-dispatch': { washingtonTrust: 3 },
  'letter-name-echo': {}, 'burr-respect': {}, 'burr-rivalry': {},
};
async function pickupNewspaper(target) {
  const before = await story();
  console.log(`PICKUP ${before.chapter}/${target.pickup}`);
  await selectDiscovery(target);
  const after = await story();
  assert.deepEqual(mainProgress(after), mainProgress(before), 'pickup preserves required progression');
  assert.equal(after.state.choices['inventory:scattered-newspaper'], 'collected');
  assert.equal(after.state.choices['side:arrival-scattered-paper'], undefined, 'pickup is not a handover');
  assert.equal(after.state.influence, before.state.influence, 'pickup grants no return reward');
  assert.deepEqual(after.pickups, [], 'collected pages leave the world');
  assert.deepEqual(after.inventory.map(item => item.id), ['scattered-newspaper']);
  assert.equal(await page.locator('.s3-inventory [data-item="scattered-newspaper"]').isVisible(), true);
  checks.push('Windblown pages behind the tavern are picked up once, displayed in inventory, and grant no early return reward');
}
async function visitDiscovery(target) {
  const before = await story();
  console.log(`VISIT ${before.chapter}/${target.discovery}`);
  await selectDiscovery(target);
  assert.deepEqual(mainProgress(await story()), mainProgress(before), 'optional dialogue preserves mainline progress');
  await readDiscovery();
  const after = await story();
  assert.deepEqual(mainProgress(after), mainProgress(before), 'optional completion preserves mainline progress');
  const choiceKey = `${target.reaction ? 'reaction' : 'side'}:${target.discovery}`;
  assert.ok(Object.hasOwn(after.state.choices, choiceKey), `${choiceKey} committed`);
  for (const key of ['momentum', 'influence', 'burrRespect', 'burrRivalry', 'washingtonTrust', 'debatePerformance', 'yorktownPerformance']) {
    assert.equal(after.state[key] - before.state[key], expectedReward[target.discovery]?.[key] ?? 0, `exact ${target.discovery} ${key} reward`);
  }
  const replayTarget = after.discoveries.find(item => item.id === target.id);
  if (target.discovery === 'arrival-scattered-paper') {
    assert.equal(replayTarget, undefined, 'the completed delivery marker disappears');
    assert.deepEqual(after.inventory, [], 'returned newspaper leaves the inventory');
    assert.equal(await page.locator('.s3-inventory').isVisible(), false);
    const chat = after.repeatTargets.find(item => item.smallTalk === 'newsboy');
    assert.ok(chat, 'the newsboy returns to ordinary chat');
    await selectDiscovery(chat);
    assert.ok((await page.locator('.s3-line').innerText()).includes('谢谢您先生！我会记住您的名字'));
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !window.__streetTest.story().smallTalk);
  } else {
    assert.equal(replayTarget.optionalComplete, true);
    await selectDiscovery(replayTarget); await readDiscovery();
  }
  const replay = await story();
  assert.deepEqual(replay.state, after.state, 'revisiting cannot issue a second reward or add a marker');
  assert.deepEqual(mainProgress(replay), mainProgress(after), 'revisiting preserves mainline progress');
  visits.push({ chapter: before.chapter, id: target.discovery, choiceKey, reward: expectedReward[target.discovery], repeatedWithoutReward: true });
  await page.screenshot({ path: `artifacts/discovery-map-${target.discovery}.png` });
}

async function readMainline() {
  for (let step = 0; (await story()).phase === 'dialogue'; step++) {
    assert.ok(step < 25, 'mainline dialogue advances within a bounded number of clicks');
    await page.keyboard.press('Space'); await page.waitForTimeout(30);
  }
}

try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(url.href); await ready();
  await page.keyboard.press('Escape'); await page.locator('.d3-settings[open]').waitFor();
  await page.locator('#d3-text-speed').selectOption('0');
  for (const channel of ['voiceover', 'music']) await page.locator(`[data-volume-channel="${channel}"]`).press('Home');
  await page.locator('.d3-settings .d3-primary').click();
  for (let step = 0; step < 100; step++) {
    const current = await story();
    if (current.phase === 'ending') break;
    if (['explore', 'exit'].includes(current.phase)) {
      if (current.pickups.length) { await pickupNewspaper(current.pickups[0]); continue; }
      const nextDiscovery = current.discoveries.find(target => !target.optionalComplete && !visits.some(visit => visit.id === target.discovery));
      if (nextDiscovery) { await visitDiscovery(nextDiscovery); continue; }
      const target = current.target;
      assert.ok(target, `mainline target exists in ${current.phase}`);
      console.log(`MAIN ${current.chapter}/${target.id}`);
      const marker = page.locator(`.d3-place[data-point="${target.id}"]`);
      if (await marker.isVisible()) await marker.click();
      else { await walkTo(target.position); await page.keyboard.press('e'); }
      if (target.exit) {
        await page.waitForFunction(chapter => window.__streetTest.story().chapter !== chapter, current.chapter, { timeout: 60000 });
        if ((await story()).phase !== 'ending') await ready();
      } else {
        await page.waitForFunction(() => window.__streetTest.story().phase === 'dialogue', undefined, { timeout: 30000 });
        interactions.push(target.id); await readMainline();
      }
    } else if (current.phase === 'dialogue') await readMainline();
    else if (current.phase === 'choice') { await page.locator('.s3-choice:not(:disabled)').first().click(); await readMainline(); }
    else if (current.phase === 'activity') {
      const kind = await page.locator('.activity-overlay').getAttribute('data-activity');
      await playActivity(page, false); activities.push(kind);
    }
  }
  const ending = await story(); assert.equal(ending.phase, 'ending');
  assert.deepEqual(visits.map(visit => visit.id).sort(), ['letter-name', 'arrival-scattered-paper', 'arrival-burr-margin', 'tavern-unfinished-draft', 'square-bread-and-prices', 'camp-misfiled-dispatch', 'letter-name-echo', 'burr-respect'].sort());
  assert.equal(interactions.length, 12); assert.deepEqual(activities, ['debate', 'writing', 'yorktown']);
  assert.equal(ending.state.choices['side:arrival-burr-margin'], 'ask');
  assert.equal(ending.state.choices['reaction:burr-rivalry'], undefined, 'this respect route does not fabricate rivalry');
  const summary = await page.locator('.s3-ending').innerText(); assert.ok(summary.includes('信纸') || summary.includes('名字'));
  checks.push('All five side events, both egg locations, and the respect reaction reached by real map clicks and E', 'Exact rewards occur once; every repeatable event and grateful post-delivery chat preserve state', 'Side conversations preserve chapter, mainline index, completed set and exit availability', 'All 12 mainline interactions and three successful activities still reach the ending');
  await page.screenshot({ path: 'artifacts/discovery-map-ending.png' });
  await page.locator('.s3-new-run').click(); await ready();
  assert.deepEqual((await story()).state.choices, {});
  checks.push('A new run clears all side and reaction markers');
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  await writeFile('artifacts/discovery-map-check.json', JSON.stringify({ passed: true, url: url.href, checks, visits, interactions, activities, ending, errors, failures }, null, 2));
  console.log(`PASS discovery map: ${visits.length} optional locations completed and revisited; all 12 mainline interactions and ending`);
} catch (error) {
  await page.screenshot({ path: 'artifacts/discovery-map-failure.png', fullPage: true }).catch(() => {});
  await writeFile('artifacts/discovery-map-check.json', JSON.stringify({ passed: false, message: String(error), story: await story().catch(() => null), canvas: await canvas().catch(() => null), visits, interactions, activities, errors, failures }, null, 2));
  throw error;
} finally { await browser.close(); }
function mainProgress({ chapter, phase, index, completed, remaining }) { return { chapter, phase, index, completed, remaining }; }
/** Use real ground clicks and short keyboard steps when a character covers the next ground point. */
async function walkTo(destination, expectedTarget) {
  const route = await page.evaluate(point => window.__streetTest.route(point.x, point.z), destination);
  assert.ok(route.free && route.path.length, `walkable story target ${JSON.stringify(destination)}`);
  for (const target of route.path) {
    let reached = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      if (expectedTarget && optionalActive(expectedTarget, await story())) return;
      const current = await canvas();
      const start = { x: Number(current.x), z: Number(current.z) };
      const distance = Math.hypot(target.x - start.x, target.z - start.z);
      if (distance < .13) { reached = true; break; }
      await page.waitForTimeout(140);
      const candidates = [...new Set([3, 4.5, distance, 2, 1, .5].map(length => Math.min(distance, length)))].map(length => ({ x: start.x + (target.x - start.x) * length / distance, z: start.z + (target.z - start.z) * length / distance }));
      const choice = await page.evaluate(({ candidates, start, expectedTarget }) => {
        const hook = window.__streetTest;
        for (const next of candidates) {
          const projected = hook.project(next.x, next.z);
          if (projected.x <= 25 || projected.x >= innerWidth - 25 || projected.y <= 180 || projected.y >= innerHeight - 105) continue;
          if (!document.elementFromPoint(projected.x, projected.y)?.classList.contains('d3-canvas')) continue;
          // Ground projected behind a billboard is an NPC click, so avoid the
          // cast's visible screen rectangles during ordinary navigation checks.
          const yaw = Number(document.querySelector('.d3-canvas').dataset.yaw);
          const overActor = hook.story().cast.some(actor => {
            const y = actor.height ?? 0;
            const corners = [-1, 1].flatMap(offset => [-.15, 1.95].map(height => hook.project(actor.position.x + Math.cos(yaw) * offset, actor.position.z - Math.sin(yaw) * offset, y + height)));
            return projected.x >= Math.min(...corners.map(point => point.x)) - 3 && projected.x <= Math.max(...corners.map(point => point.x)) + 3
              && projected.y >= Math.min(...corners.map(point => point.y)) - 3 && projected.y <= Math.max(...corners.map(point => point.y)) + 3;
          });
          if (overActor) continue;
          // A completed paper remains clickable for rereading. Ground-click routes
          // to another target must not accidentally open that old conversation.
          const state = hook.story();
          const overPaper = [...state.discoveries, ...state.pickups].some(item => {
            if (item.id === expectedTarget?.id || item.hideProp || item.reaction) return false;
            const position = item.propPosition ?? item.position, y = item.propHeight ?? .06;
            const corners = [-.45, .45].flatMap(dx => [-.5, .5].map(dz => hook.project(position.x + dx, position.z + dz, y)));
            return projected.x >= Math.min(...corners.map(point => point.x)) - 3 && projected.x <= Math.max(...corners.map(point => point.x)) + 3
              && projected.y >= Math.min(...corners.map(point => point.y)) - 3 && projected.y <= Math.max(...corners.map(point => point.y)) + 3;
          });
          if (overPaper) continue;
          const samples = Math.max(1, Math.ceil(Math.hypot(next.x - start.x, next.z - start.z) / .08));
          let clear = true;
          for (let i = 0; i <= samples; i++) clear &&= hook.free(start.x + (next.x - start.x) * i / samples, start.z + (next.z - start.z) * i / samples);
          if (clear) return { next, projected };
        }
        return null;
      }, { candidates, start, expectedTarget });
      if (!choice) {
        const yaw = Number(current.yaw), dx = target.x - start.x, dz = target.z - start.z;
        const right = dx * Math.cos(yaw) - dz * Math.sin(yaw), forward = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
        const step = Math.round(Math.atan2(forward, right) / (Math.PI / 4));
        const horizontal = Math.round(Math.cos(step * Math.PI / 4)), vertical = Math.round(Math.sin(step * Math.PI / 4));
        const keys = [horizontal && (horizontal > 0 ? 'd' : 'a'), vertical && (vertical > 0 ? 'w' : 's')].filter(Boolean);
        for (const key of keys) await page.keyboard.down(key);
        await page.waitForTimeout(Math.max(65, Math.min(180, distance / 2.8 * 1000)));
        for (const key of keys) await page.keyboard.up(key);
        await page.waitForTimeout(260); await waitStill();
        continue;
      }
      await page.mouse.click(choice.projected.x, choice.projected.y);
      // The diagnostic dataset is sampled every five frames. Wait for arrival,
      // rather than accepting a stale pre-click "still" sample on a busy renderer.
      await page.waitForFunction(({ point, expectedTarget }) => {
        const state = window.__streetTest.story();
        if (expectedTarget?.pickup && Object.hasOwn(state.state.choices, 'inventory:scattered-newspaper')) return true;
        if (expectedTarget?.smallTalk && state.smallTalk === expectedTarget.smallTalk) return true;
        if (expectedTarget?.discovery && state.discovery.id === expectedTarget.discovery && state.discovery.phase !== 'idle') return true;
        const data = document.querySelector('.d3-canvas')?.dataset;
        return data?.moving === 'false' && data.path === '0' && Math.hypot(Number(data.x) - point.x, Number(data.z) - point.z) < .24;
      }, { point: choice.next, expectedTarget }, { timeout: 18000 });
      if (expectedTarget && optionalActive(expectedTarget, await story())) return;
      const arrived = await canvas();
      assert.ok(Math.hypot(Number(arrived.x) - choice.next.x, Number(arrived.z) - choice.next.z) < .24, `ground click reaches waypoint ${JSON.stringify({ next: choice.next, arrived })}`);
    }
    assert.ok(reached, `route segment finishes in bounded clicks: ${JSON.stringify(target)}`);
  }
}
