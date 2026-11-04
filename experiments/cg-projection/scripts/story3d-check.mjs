import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { playActivity } from './gameplay-helpers.mjs';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const success = process.env.HAMILTON_ROUTE === 'success';
const routeName = success ? 'success' : 'failure';
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], failures = [], interactions = [], chapters = [], activities = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`); });
const url = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/'); url.search = '?story=3d&debug=1';
const canvas = () => page.locator('.d3-canvas').evaluate(node => ({ ...node.dataset }));
const story = () => page.evaluate(() => window.__streetTest.story());
const waitStory = expected => page.waitForFunction(values => {
  const current = window.__streetTest?.story?.();
  return current && Object.entries(values).every(([key, value]) => current[key] === value);
}, expected, { timeout: 60000 });
const waitStill = () => page.waitForFunction(() => {
  const data = document.querySelector('.d3-canvas')?.dataset;
  return data?.moving === 'false' && data.path === '0';
}, undefined, { timeout: 18000 });

async function ready(chapter) {
  await page.locator('.d3-canvas[data-mode=story][data-ready=true]').waitFor({ timeout: 60000 });
  if (chapter) await waitStory({ chapter });
  await page.waitForTimeout(160);
}

async function pause() {
  await page.keyboard.press('Escape');
  await page.locator('.d3-settings[open]').waitFor({ timeout: 3000 });
  await page.waitForFunction(() => document.querySelector('.d3-canvas')?.dataset.paused === 'true');
}
async function resume() {
  await page.locator('.d3-settings .d3-primary').click();
  await page.waitForFunction(() => document.querySelector('.d3-canvas')?.dataset.paused === 'false');
  const phase = (await story()).phase;
  const panel = phase === 'activity' ? '.activity-overlay' : ['choice', 'dialogue'].includes(phase) ? '.s3-dialogue:not([hidden])' : null;
  if (panel) {
    await page.waitForFunction(selector => document.querySelector(selector)?.contains(document.activeElement), panel, { timeout: 2000 });
    assert.ok(await page.locator(panel).evaluate(node => node.contains(document.activeElement)), `resuming ${phase} restores focus inside its modal panel`);
  }
}

async function freezeCheck3D(_page, selector, attribute) {
  await page.waitForFunction(({ selector, attribute }) => Number.isFinite(parseFloat(document.querySelector(selector)?.getAttribute(attribute))), { selector, attribute });
  await pause();
  const before = await page.locator(selector).getAttribute(attribute);
  const original = await page.locator('#d3-language').inputValue();
  for (const mode of ['en', 'zh', 'dual', original]) await page.locator('#d3-language').selectOption(mode);
  await page.waitForTimeout(350);
  assert.equal(await page.locator(selector).getAttribute(attribute), before, `3D pause preserves activity ${attribute}`);
  await resume();
  await page.keyboard.press('Tab');
  assert.ok(await page.locator('.activity-overlay').evaluate(node => node.contains(document.activeElement)), 'Tab stays inside the active activity after resuming');
  await page.locator('.activity-overlay').focus();
}

/** All movement uses real ground clicks. The debug hook only supplies read-only routes. */
async function walkTo(destination) {
  const route = await page.evaluate(point => window.__streetTest.route(point.x, point.z), destination);
  assert.ok(route.free && route.path.length, `walkable story target ${JSON.stringify(destination)}`);
  for (const target of route.path) {
    let reached = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      const current = await canvas();
      const start = { x: Number(current.x), z: Number(current.z) };
      const distance = Math.hypot(target.x - start.x, target.z - start.z);
      if (distance < .13) { reached = true; break; }
      await page.waitForTimeout(140);
      const candidates = [...new Set([3, 4.5, distance, 2, 1, .5].map(length => Math.min(distance, length)))].map(length => ({ x: start.x + (target.x - start.x) * length / distance, z: start.z + (target.z - start.z) * length / distance }));
      const choice = await page.evaluate(({ candidates, start }) => {
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
            const corners = [-.82, .82].flatMap(offset => [-.15, 1.95].map(height => hook.project(actor.position.x + Math.cos(yaw) * offset, actor.position.z - Math.sin(yaw) * offset, y + height)));
            return projected.x >= Math.min(...corners.map(point => point.x)) - 3 && projected.x <= Math.max(...corners.map(point => point.x)) + 3
              && projected.y >= Math.min(...corners.map(point => point.y)) - 3 && projected.y <= Math.max(...corners.map(point => point.y)) + 3;
          });
          if (overActor) continue;
          const samples = Math.max(1, Math.ceil(Math.hypot(next.x - start.x, next.z - start.z) / .08));
          let clear = true;
          for (let i = 0; i <= samples; i++) clear &&= hook.free(start.x + (next.x - start.x) * i / samples, start.z + (next.z - start.z) * i / samples);
          if (clear) return { next, projected };
        }
        return null;
      }, { candidates, start });
      assert.ok(choice, `visible clear ground along route: ${JSON.stringify({ start, target, candidates })}`);
      await page.mouse.click(choice.projected.x, choice.projected.y);
      // The diagnostic dataset is sampled every five frames. Wait for arrival,
      // rather than accepting a stale pre-click "still" sample on a busy renderer.
      await page.waitForFunction(point => {
        const data = document.querySelector('.d3-canvas')?.dataset;
        return data?.moving === 'false' && data.path === '0' && Math.hypot(Number(data.x) - point.x, Number(data.z) - point.z) < .24;
      }, choice.next, { timeout: 18000 });
      const arrived = await canvas();
      assert.ok(Math.hypot(Number(arrived.x) - choice.next.x, Number(arrived.z) - choice.next.z) < .24, `ground click reaches waypoint ${JSON.stringify({ next: choice.next, arrived })}`);
    }
    assert.ok(reached, `route segment finishes in bounded clicks: ${JSON.stringify(target)}`);
  }
}

async function beginTarget(targetId) {
  const before = await story();
  assert.equal(before.phase, 'explore');
  const target = targetId ? before.targets.find(item => item.id === targetId && item.enabled) : before.target;
  assert.ok(target);
  if (target.id === 'arrival-newspaper') {
    const newsboy = before.cast.find(actor => actor.id === 'newsboy');
    assert.ok(newsboy, 'the original newspaper interaction has an in-world newsboy');
    const hit = await page.evaluate(actor => {
      for (const height of [1, .7, 1.3]) {
        const projected = window.__streetTest.project(actor.position.x, actor.position.z, (actor.height ?? 0) + height);
        if (projected.x > 0 && projected.x < innerWidth && projected.y > 0 && projected.y < innerHeight
          && document.elementFromPoint(projected.x, projected.y)?.classList.contains('d3-canvas')) return projected;
      }
      return null;
    }, newsboy);
    assert.ok(hit, 'a visible pixel on the newsboy body can be clicked');
    await page.mouse.click(hit.x, hit.y);
    checks.push('clicking the visible newsboy body walks up and starts dialogue');
  } else if (before.chapter === 'Tavern') {
    const marker = page.locator(`.d3-place[data-point="${target.id}"]`);
    if (!await marker.isVisible()) await walkTo({ x: 0, z: -.2 });
    const position = await canvas();
    // Nearby markers intentionally become the bottom-screen E prompt.
    if (Math.hypot(Number(position.x) - target.position.x, Number(position.z) - target.position.z) < 1.65) await page.keyboard.press('e');
    else await marker.click();
  } else {
    await walkTo(target.position);
    await page.keyboard.press('e');
  }
  await waitStory({ phase: 'dialogue' });
  await page.locator('.s3-dialogue:not([hidden])').waitFor();
  return target.id;
}
async function readLines() {
  for (let step = 0; (await story()).phase === 'dialogue'; step++) {
    assert.ok(step < 20, 'each conversation ends in bounded advances');
    const button = page.locator('.s3-dialogue .s3-advance');
    await button.waitFor();
    assert.ok((await page.locator('.s3-line').innerText()).trim());
    await button.click(); await page.waitForTimeout(30);
  }
}

async function checkChoiceEffects() {
  const current = await story();
  assert.ok(current.choice);
  for (const option of current.choice.options) {
    const button = page.locator(`.s3-choice[data-option="${option.id}"]`);
    const actual = await button.locator('.choice-effect').evaluateAll(nodes => nodes.map(node => ({stat:node.dataset.stat,direction:node.dataset.direction})).sort((a,b)=>a.stat.localeCompare(b.stat)));
    const expected = Object.entries(option.effect).filter(([,delta])=>delta).map(([stat,delta])=>{
      const value=Math.max(0,Math.min(100,current.state[stat]+delta));
      return {stat,direction:value>current.state[stat]?'up':value<current.state[stat]?'down':'flat'};
    }).sort((a,b)=>a.stat.localeCompare(b.stat));
    assert.deepEqual(actual,expected,`effect arrows match ${option.id}`);
    assert.ok(!/[0-9]/.test(await button.locator('.choice-effects').innerText()), 'option effect preview contains no numeric amounts');
  }
}

async function checkTavernTimeoutAndRestart() {
  const entry = await story(); assert.equal(entry.chapter, 'Tavern');
  await beginTarget(); await readLines();
  await waitStory({ phase: 'choice' });
  await pause();
  await checkChoiceEffects();
  const paused = await story(); const beforeText = await page.locator('.s3-choice-prompt').innerText();
  const position = await canvas();
  assert.ok(paused.remaining > 9000 && paused.remaining <= 10000, 'each tavern answer starts with ten seconds');
  for (const language of ['en', 'zh', 'dual']) {
    await page.locator('#d3-language').selectOption(language);
    await checkChoiceEffects();
    if (language === 'en') assert.ok(!/\p{Script=Han}/u.test(await page.locator('.s3-interface').innerText()), 'English story text has no Chinese residue');
    if (language === 'zh') assert.equal(await page.locator('.s3-dialogue .text-secondary').count(), 0);
    if (language === 'dual') assert.ok(await page.locator('.s3-dialogue .text-secondary').count() > 0);
  }
  await page.waitForTimeout(400);
  const afterLanguage = await story(); const afterPosition = await canvas();
  assert.equal(afterLanguage.remaining, paused.remaining, 'language switching does not consume or reset the deadline');
  assert.equal(afterLanguage.phase, 'choice'); assert.equal(afterLanguage.index, paused.index);
  assert.deepEqual(afterLanguage.state, paused.state);
  assert.equal(afterPosition.x, position.x); assert.equal(afterPosition.z, position.z);
  assert.equal(await page.locator('.s3-choice-prompt').innerText(), beforeText);
  await page.setViewportSize({ width: 1024, height: 640 });
  await resume();
  await page.keyboard.press('Tab');
  assert.ok(await page.locator('.s3-dialogue').evaluate(node => node.contains(document.activeElement)), 'Tab stays within the resumed choice');
  await page.locator('.s3-dialogue').focus();
  const bounds = await page.locator('.s3-dialogue').boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 1024 && bounds.y + bounds.height <= 640, 'bilingual timed choice fits 1024 × 640');
  await page.screenshot({ path: 'artifacts/story3d-tavern-choice-1024.png' });
  const deadline = await page.locator('.s3-choice-time').boundingBox();
  assert.ok(deadline && deadline.y >= bounds.y && deadline.y + deadline.height <= bounds.y + bounds.height, 'the countdown stays visible when choices gain effect previews');
  await page.waitForTimeout(5100);
  assert.equal((await story()).phase, 'choice', 'a tavern answer remains available after five active seconds');
  await waitStory({ phase: 'dialogue' });
  const silence = await story();
  assert.equal(silence.state.choices.laurens_question, 'timeout');
  assert.equal(silence.state.momentum, entry.state.momentum);
  await readLines();
  assert.equal((await story()).index, 1);
  await pause(); await page.locator('.s3-restart').click();
  await ready('Tavern'); await waitStory({ phase: 'explore', index: 0 });
  const restarted = await story();
  assert.deepEqual(restarted.state, entry.state, 'restart rolls back to the original chapter entry state');
  assert.equal(restarted.remaining, 0);
  assert.equal(await page.locator('.activity-overlay').count(), 0);
  assert.ok(await page.locator('.s3-dialogue').evaluate(node => node.hidden));
  await page.setViewportSize({ width: 1440, height: 900 });
  checks.push('Tavern timeout fails forward', 'pause freezes choice timer and movement', 'three language modes preserve current choice', '1024 bilingual choice', 'chapter restart restores entry checkpoint');
}

try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(url.href); await ready('Opening');
  assert.equal(await page.locator('html').getAttribute('data-language'), 'dual');
  assert.equal((await story()).phase, 'explore');
  assert.equal((await story()).state.choices.burr_first_impression, undefined);
  await pause();
  await page.locator('#d3-text-speed').selectOption('0');
  await page.locator('#d3-motion').check();
  await resume();
  let tavernChecked = false, gateChecked = false;
  for (let step = 0; step < 80; step++) {
    const current = await story();
    if (current.phase === 'ending') break;
    if (!chapters.includes(current.chapter)) {
      chapters.push(current.chapter);
      await page.screenshot({ path: `artifacts/story3d-${current.chapter.toLowerCase()}.png` });
    }
    if (current.chapter === 'Arrival' && !gateChecked) {
      const later = current.targets.find(target => target.id === 'arrival-burr');
      assert.ok(later && !later.enabled, 'a future scene interaction is visibly locked');
      await walkTo(later.position); await page.keyboard.press('e'); await page.waitForTimeout(150);
      const gated = await story();
      assert.equal(gated.phase, 'explore'); assert.equal(gated.index, 0);
      assert.equal(gated.state.choices.burr_first_impression, undefined);
      checks.push('walking to a future character does not skip the story');
      gateChecked = true; continue;
    }
    if (current.chapter === 'Tavern' && !tavernChecked) {
      await checkTavernTimeoutAndRestart(); tavernChecked = true; continue;
    }
    if (current.phase === 'explore') {
      const order = ['tavern-mulligan', 'tavern-laurens', 'tavern-lafayette'];
      const next = current.chapter === 'Tavern' ? order.find(id => current.targets.some(target => target.id === id && target.enabled)) : undefined;
      const id = await beginTarget(next); interactions.push(id);
      await readLines();
    } else if (current.phase === 'dialogue') await readLines();
    else if (current.phase === 'choice') {
      await checkChoiceEffects();
      await page.locator('.s3-choice:not(:disabled)').first().click(); await readLines();
    } else if (current.phase === 'activity') {
      const kind = await page.locator('.activity-overlay').getAttribute('data-activity');
      const before = (await story()).state;
      await playActivity(page, !success, { freezeCheck: freezeCheck3D });
      const after = await story(); assert.ok(after.phase === 'explore' || after.phase === 'exit');
      const key = { debate: 'debate_result', writing: 'writing_result', yorktown: 'yorktown_result' }[kind];
      assert.equal(before.choices[key], undefined); assert.ok(after.state.choices[key]);
      activities.push({ kind, result: after.state.choices[key], state: after.state });
    } else if (current.phase === 'exit') {
      assert.ok(current.target);
      await walkTo(current.target.position); await page.keyboard.press('e');
      await page.waitForFunction(previous => window.__streetTest.story().chapter !== previous, current.chapter, { timeout: 60000 });
      if ((await story()).phase !== 'ending') await ready();
    } else throw new Error(`Unhandled story phase ${current.phase}`);
  }
  await waitStory({ phase: 'ending', chapter: 'Ending' });
  await page.locator('.s3-ending').waitFor({ timeout: 10000 });
  const ending = await story();
  assert.deepEqual(chapters, ['Opening', 'Arrival', 'Tavern', 'Debate', 'Washington', 'Yorktown']);
  assert.equal(new Set(interactions).size, 12);
  assert.deepEqual(interactions.filter(id => id.startsWith('tavern-')), ['tavern-mulligan', 'tavern-laurens', 'tavern-lafayette'], 'real tavern visits follow the chosen order, not the chapter array');
  assert.deepEqual(activities.map(activity => activity.kind), ['debate', 'writing', 'yorktown']);
  assert.equal(ending.state.choices.debate_result, success ? 'won' : 'held');
  if (success) {
    assert.ok(Number(ending.state.choices.writing_result) >= 80);
    assert.ok(ending.state.yorktownPerformance >= 80);
  } else {
    assert.equal(ending.state.choices.writing_result, '0');
    assert.equal(ending.state.debatePerformance, 0);
    assert.ok(ending.state.yorktownPerformance <= 20);
  }
  assert.equal(ending.state.choices.yorktown_result, 'complete');
  assert.equal(ending.state.choices['interaction:yorktown-surrender'], 'complete');
  assert.ok(await page.locator('.s3-ending .text-secondary').count() > 0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('project-hamilton:last-result:v1')));
  assert.equal(saved.completed, true); assert.deepEqual(saved.result, ending.state);
  await page.screenshot({ path: 'artifacts/story3d-ending.png' });
  await page.setViewportSize({ width: 1024, height: 640 });
  const endingBounds = await page.locator('.s3-ending').boundingBox();
  assert.ok(endingBounds && endingBounds.x >= 0 && endingBounds.y >= 0 && endingBounds.x + endingBounds.width <= 1024 && endingBounds.y + endingBounds.height <= 640);
  assert.ok(await page.locator('.s3-ending').evaluate(node => node.scrollWidth <= node.clientWidth));
  await page.screenshot({ path: 'artifacts/story3d-ending-1024.png' });
  checks.push('all six original chapters in 3D', 'all twelve interactions reached by real walking', 'all activities commit confirmed outcomes', success ? 'successful activity inputs reach ending' : 'losses and zero scores reach ending', 'completed result persists', '1024 bilingual ending', 'resume restores modal focus and Tab containment');
  await page.locator('.s3-new-run').click(); await ready('Opening');
  const fresh = await story();
  assert.equal(fresh.phase, 'explore'); assert.equal(fresh.index, 0);
  assert.deepEqual(fresh.state.choices, {}); assert.equal(fresh.state.momentum, 40);
  assert.equal(fresh.state.debatePerformance, 0); assert.equal(fresh.state.yorktownPerformance, 0);
  checks.push('new run resets progression without loading the previous result');
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  const report = { route: routeName, baseURL: url.href, checks, chapters, interactions, activities, ending, errors, failures };
  await writeFile('artifacts/story3d-check.json', JSON.stringify(report, null, 2));
  await writeFile(`artifacts/story3d-check-${routeName}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: 'artifacts/story3d-failure.png' }).catch(() => {});
  await writeFile('artifacts/story3d-failure.json', JSON.stringify({ message: String(error), canvas: await canvas().catch(() => null), story: await story().catch(() => null), errors, failures, chapters, interactions, activities }, null, 2));
  throw error;
} finally { await browser.close(); }
