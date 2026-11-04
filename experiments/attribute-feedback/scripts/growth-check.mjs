import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

// Browser integration fixture: the real StoryUI, activities and StoryProgress are
// imported from the local dev server. Only the map and frame clock are substituted.
const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage();
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
const base = process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/';
const fixture = new URL('/growth-activity-fixture', base).href;
await page.route(fixture, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/src/demo3d/demo.css"></head><body><main id="growth-fixture"></main></body></html>' }));
await page.goto(fixture);
await page.evaluate(async () => {
  const [{ StoryUI }, { StoryProgress }, { StateSystem }, { DebateSystem }, { WritingSystem }, { YorktownSystem }, i18n, { voiceover }] = await Promise.all([
    import('/src/story3d/StoryUI.ts'), import('/src/story3d/StoryProgress.ts'), import('/src/systems/StateSystem.ts'), import('/src/systems/DebateSystem.ts'),
    import('/src/systems/WritingSystem.ts'), import('/src/systems/YorktownSystem.ts'), import('/src/i18n/text.ts'), import('/src/ui/voiceover.ts'),
  ]);
  voiceover.setEnabled(false);
  const h = window.__growthCheck = { ui: null, progress: null, paused: false, result: null, language: i18n.setLanguage };
  const tick = (game, ms) => { while (ms > 0) { const dt = Math.min(100, ms); game.tick(dt); ms -= dt; } };
  function completeEarlier(kind) {
    if (kind === 'debate') {
      const game = new DebateSystem();
      while (game.phase !== 'result') { game.ready(); game.select('FACT'); tick(game, 1200); game.hit(); game.next(); }
      return game;
    }
    const game = new WritingSystem(); game.begin();
    for (let i = 0; i < 3; i++) { game.dispatch.fragments.forEach(fragment => game.assign(fragment.id, fragment.bin)); game.submit(); game.next(); }
    return game;
  }
  h.start = (kind, mode, assisted = true) => {
    h.ui?.destroy(); document.querySelector('#growth-fixture').replaceChildren(); h.paused = false; h.result = null;
    const state = new StateSystem();
    if (assisted) state.apply({ momentum: 20, influence: 20, washingtonTrust: 25 });
    const progress = new StoryProgress(state); h.progress = progress;
    for (let steps = 0; progress.activity !== kind && steps < 200; steps++) {
      if (progress.phase === 'explore') progress.begin(progress.interaction.id);
      else if (progress.phase === 'dialogue') progress.next();
      else if (progress.phase === 'choice') progress.choose(0);
      else if (progress.phase === 'exit') progress.nextChapter();
      else if (progress.phase === 'activity') progress.completeActivity(progress.activity, completeEarlier(progress.activity));
    }
    if (progress.activity !== kind) throw new Error(`Could not reach ${kind}`);
    // Exercise both sides of the assistance gates without relying on a particular narrative route.
    if (assisted) state.apply({ momentum: 100, influence: 100, washingtonTrust: 100 });
    else state.apply({ momentum: -100, influence: -100, washingtonTrust: -100 });
    i18n.setLanguage(mode);
    h.ui = new StoryUI(document.querySelector('#growth-fixture'), () => h.paused);
    h.ui.onGrowthOpenChange = open => { h.paused = open; h.ui.release(); };
    h.ui.setGrowthContext(progress.chapter, state.state, progress.completedInteractions);
    h.ui.showActivity(kind, state, result => {
      h.result = { kind, score: result.performance, committed: progress.completeActivity(kind, result), choices: state.state.choices,
        used: result.attackRecoveriesUsed ?? result.referencesUsed ?? result.deploymentChecksUsed };
    });
  };
  h.tick = ms => { while (ms > 0) { const dt = Math.min(100, ms); h.ui.update(dt); ms -= dt; } };
  window.addEventListener('keydown', event => { if (h.ui?.key(event.key.toLowerCase(), true)) event.preventDefault(); });
  window.addEventListener('keyup', event => { h.ui?.key(event.key.toLowerCase(), false); });
});
const overlay = page.locator('.activity-overlay');
const tick = ms => page.evaluate(ms => window.__growthCheck.tick(ms), ms);
const key = async value => { await overlay.focus(); await page.keyboard.press(value); };
const result = () => page.evaluate(() => window.__growthCheck.result);
const state = () => overlay.evaluate(node => ({ ...node.dataset }));

async function languageAndPause(phase, usedKey, expectedUsed, mode, width, kind) {
  const before = await state();
  await overlay.locator('.s3-growth-toggle').click();
  await page.locator('.s3-growth-dialog[open]').waitFor();
  assert.equal(await page.locator('.s3-growth-row').count(), 5);
  for (const language of ['zh', 'en', 'dual', 'dual-en']) {
    await page.evaluate(language => window.__growthCheck.language(language), language);
    await tick(4000);
    const paused = await state();
    assert.equal(paused.phase, phase); assert.equal(paused[usedKey], String(expectedUsed));
    assert.equal(paused.elapsed, before.elapsed); assert.equal(paused.remaining, before.remaining);
    const dialog = page.locator('.s3-growth-dialog');
    assert.equal(await dialog.locator('.text-secondary').count(), 0, 'growth UI is single language');
    if (language === 'en' || language === 'dual-en') assert.ok(!/\p{Script=Han}/u.test(await dialog.innerText()));
    const overflow = await dialog.evaluate(node => node.scrollWidth - node.clientWidth);
    assert.ok(overflow <= 2, `growth dialog has no horizontal overflow at ${width}`);
  }
  await page.evaluate(language => window.__growthCheck.language(language), mode);
  await page.locator('.s3-growth-close').click();
  assert.equal(await page.locator('.s3-growth-dialog[open]').count(), 0);
  const after = await state(); assert.equal(after[usedKey], String(expectedUsed)); assert.equal(after.elapsed, before.elapsed); assert.equal(after.remaining, before.remaining);
  checks.push({ kind, mode, width, check: 'growth modal freezes clock and usage through four language changes' });
}

try {
  for (const width of [1440, 390]) for (const mode of ['zh', 'en', 'dual', 'dual-en']) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.evaluate(mode => window.__growthCheck.start('debate', mode), mode);
    assert.equal((await state()).crowdBonus, '10');
    assert.equal(await overlay.locator('.growth-benefits .text-secondary').count(), 0);
    await overlay.locator('.primary').click(); await key('3'); await key('Space');
    assert.equal((await state()).attackRecoveriesUsed, '1');
    assert.match(await overlay.locator('.activity-live').innerText(), mode === 'en' || mode === 'dual-en' ? /still counts as a miss/ : /仍记为失误/);
    await languageAndPause('feedback', 'attackRecoveriesUsed', 1, mode, width, 'debate');
    await overlay.locator('.primary').click();
    for (let round = 1; round < 6; round++) { await overlay.locator('.primary').click(); await key('3'); await key('Space'); await overlay.locator('.primary').click(); }
    assert.equal((await state()).phase, 'result');
    assert.equal((await overlay.locator('.activity-score').innerText()).trim(), '0 / 100');
    await overlay.locator('.primary').click();
    assert.equal((await result()).choices['assist:debate-recovery'], 'used');
    assert.equal((await result()).committed, true);
    checks.push({ kind: 'debate', mode, width, check: 'one recovery, true MISS score, persisted assistance marker' });

    await page.evaluate(mode => window.__growthCheck.start('writing', mode), mode);
    await overlay.locator('.primary').click();
    assert.equal(await overlay.locator('.reference-button').isDisabled(), true);
    await overlay.locator('[data-fragment="north-time"]').click();
    assert.equal(await overlay.locator('.reference-button').isEnabled(), true);
    const beforeHint = (await state()).remaining;
    await overlay.locator('.reference-button').click();
    assert.equal((await state()).referencesUsed, '1'); assert.equal((await state()).remaining, beforeHint);
    assert.equal(await overlay.locator('.dispatch-bin p').count(), 0, 'reference does not assign a fragment');
    assert.equal(await overlay.locator('.reference-button').isDisabled(), true);
    await languageAndPause('sort', 'referencesUsed', 1, mode, width, 'writing');
    await tick(100); assert.equal(Number((await state()).remaining), Number(beforeHint) - 100, 'clock resumes after growth closes');
    await tick(150000); await overlay.locator('.primary').click();
    assert.equal((await state()).phase, 'result');
    assert.equal((await overlay.locator('.activity-score').innerText()).trim(), '0 / 100');
    await overlay.locator('.primary').click();
    assert.equal((await result()).choices['assist:writing-reference'], 'used'); assert.equal((await result()).committed, true);
    checks.push({ kind: 'writing', mode, width, check: 'selected-fragment requirement, one hint, original timer and true omissions, persisted marker' });

    await page.evaluate(mode => window.__growthCheck.start('yorktown', mode), mode);
    await overlay.locator('.primary').click();
    await overlay.focus(); await page.keyboard.down('d'); await tick(13000); await page.keyboard.up('d');
    assert.equal((await state()).phase, 'command');
    assert.equal(await overlay.locator('.deployment-check-button').isDisabled(), true);
    await overlay.locator('[data-squad-select="0"]').click();
    await overlay.locator('.deployment-check-button').click();
    assert.equal((await state()).deploymentChecksUsed, '1');
    assert.equal(await overlay.locator('button[data-order][aria-pressed=true]').count(), 0, 'checking does not issue an order');
    assert.equal(await overlay.locator('.deployment-check-button').isDisabled(), true);
    await languageAndPause('command', 'deploymentChecksUsed', 1, mode, width, 'yorktown');
    if (width === 390 && mode === 'dual-en') await page.screenshot({ path: 'artifacts/growth-deployment-390-dual-en.png', fullPage: true });
    for (const [squad, order] of [[0, 'HOLD'], [1, 'ADVANCE'], [2, 'FLANK']]) await overlay.locator(`button[data-squad="${squad}"][data-order="${order}"]`).click();
    await overlay.locator('.deploy-button').click(); await overlay.locator('.primary').click();
    for (let command = 0; command < 12; command++) { await tick(1500); await tick(900); }
    assert.equal((await state()).phase, 'result');
    await overlay.locator('.primary').click();
    assert.equal((await result()).choices['assist:yorktown-check'], 'used'); assert.equal((await result()).committed, true);
    checks.push({ kind: 'yorktown', mode, width, check: 'selected-squad requirement, one check, player-issued orders, all 12 commands, persisted marker' });
  }
  // A fresh unassisted activity must have complete base controls and no claimed help.
  for (const kind of ['debate', 'writing', 'yorktown']) {
    await page.evaluate(kind => window.__growthCheck.start(kind, 'en', false), kind);
    const data = await state();
    assert.equal(data.attackRecoveriesUsed ?? data.referencesUsed ?? data.deploymentChecksUsed, '0');
    assert.ok((await overlay.locator('.growth-benefits').innerText()).includes('0'));
    checks.push({ kind, mode: 'en', check: 'new unassisted activity starts with zero assistance' });
  }
  assert.deepEqual(errors, []);
  const report = { passed: true, scope: 'Actual StoryUI + activities + StoryProgress with deterministic frame clock; map traversal covered separately', checks, errors };
  await mkdir('artifacts', { recursive: true }); await writeFile('artifacts/growth-check.json', JSON.stringify(report, null, 2));
  console.log(`PASS growth browser integration: ${checks.length} checks, 24 activity runs, 4 languages, 1440 / 390 px`);
} catch (error) {
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/growth-check-failure.png', fullPage: true }).catch(() => {});
  await writeFile('artifacts/growth-check.json', JSON.stringify({ passed: false, checks, errors, error: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
