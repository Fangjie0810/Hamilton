import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE ?? '/Users/fangjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
const base = process.env.HAMILTON_URL ?? 'http://127.0.0.1:1781/';
const errors = [], checks = [], captures = [], geometry = [];
page.on('pageerror', e => errors.push(e.message));
page.setDefaultTimeout(20000);
const snap = () => page.evaluate(() => window.__attributeReview.snapshot());
const invoke = (method, arg) => page.evaluate(([method, arg]) => window.__attributeReview[method](arg), [method, arg]);
async function capture(name) { const path = `artifacts/${name}.png`; await page.screenshot({ path }); captures.push(path); }
async function sample(key = 'mixed') {
  await page.mouse.move(1420, 880); await invoke('hold', false); await invoke('sample', key);
  await page.waitForFunction(() => window.__attributeReview.snapshot().elapsed >= 650);
  await invoke('hold', true);
}
async function measure(name) {
  const result = await page.locator('.af-feedback').evaluate(node => {
    const box = node.getBoundingClientRect();
    return { box: box.toJSON(), viewport: [innerWidth, innerHeight], rows: [...node.querySelectorAll('.af-row')].map(row => {
      const label = row.querySelector('.af-label'), rect = row.getBoundingClientRect(), lr = label.getBoundingClientRect();
      return { stat: row.dataset.stat, text: row.innerText, box: rect.toJSON(), label: lr.toJSON(), overflow: label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1 };
    }) };
  });
  assert.ok(result.box.left >= 0 && result.box.right <= result.viewport[0] && result.box.top >= 0 && result.box.bottom <= result.viewport[1], `${name}: fits viewport`);
  assert.ok(Math.abs((result.box.left + result.box.right) / 2 - result.viewport[0]/2) < 2, `${name}: horizontally centered`);
  assert.ok(result.rows.every(row => !row.overflow), `${name}: labels do not clip`);
  geometry.push({ name, ...result });
}
try {
  await mkdir('artifacts', { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem('project-hamilton:language:v1', 'dual');
    localStorage.setItem('project-hamilton:3d-quality:v1', 'medium');
    localStorage.setItem('project-hamilton:3d-text-speed:v1', '0');
    localStorage.setItem('project-hamilton:voiceover-volume:v1', '0');
    localStorage.setItem('project-hamilton:music-volume:v1', '0');
  });
  await page.goto(`${base}?story=3d&debug=1&review=stamp`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__attributeReview && window.__streetTest?.story().chapter === 'Arrival', { timeout: 60000 });
  await page.locator('.d3-canvas[data-ready="true"]').waitFor();
  await invoke('hold', false); await page.waitForTimeout(9200);
  await invoke('clean', true);
  for (const variant of ['stamp', 'spark', 'ruler']) {
    await invoke('select', variant); await sample(); await measure(`${variant}-desktop`); await capture(`${variant}-desktop`);
    await invoke('dialogue', true); await sample(); await capture(`${variant}-dialogue`); await invoke('dialogue', false);
  }
  checks.push('three live variants captured in the real Arrival scene, in exploration and dialogue');
  const original = await page.evaluate(() => window.__streetTest.story().state);
  for (const mode of ['dual', 'dual-en', 'zh', 'en']) {
    await invoke('language', mode);
    for (const variant of ['stamp', 'spark', 'ruler']) {
      await invoke('select', variant); await sample('trust');
      const text = await page.locator('.af-feedback').innerText();
      assert.ok(mode === 'en' || mode === 'dual-en' ? text.includes('Washington Trust') && !/\p{Script=Han}/u.test(text) : text.includes('华盛顿信任'));
      assert.equal(await page.locator('.af-feedback .text-secondary').count(), 0);
      await measure(`${variant}-${mode}`);
    }
  }
  assert.deepEqual(await page.evaluate(() => window.__streetTest.story().state), original);
  checks.push('all four language modes use primary language only and preserve real game state');
  for (const viewport of [{ width: 760, height: 540 }, { width: 390, height: 740 }]) {
    await page.setViewportSize(viewport);
    for (const mode of ['dual', 'dual-en']) {
      await invoke('language', mode);
      for (const variant of ['stamp', 'spark', 'ruler']) {
        await invoke('select', variant); await sample('trust');
        await measure(`${variant}-${mode}-${viewport.width}`); await capture(`${variant}-${mode}-${viewport.width}`);
      }
    }
  }
  checks.push('both bilingual primary languages fit at 760×540 and 390×740 with three simultaneous changes');
  await page.setViewportSize({ width: 1440, height: 900 }); await invoke('language', 'dual');
  await invoke('select', 'stamp'); await sample('limit');
  assert.deepEqual((await snap()).current, [{ stat: 'momentum', delta: 2, value: 100 }]);
  await invoke('clear'); await invoke('hold', false);
  await invoke('enqueue', [{ momentum: 5 }, { momentum: -3 }, { burrRespect: 6 }]);
  assert.equal((await snap()).queued, 2);
  await page.waitForFunction(() => window.__attributeReview.snapshot().current[0]?.delta === -3);
  await page.waitForFunction(() => window.__attributeReview.snapshot().current[0]?.stat === 'burrRespect');
  await page.waitForFunction(() => window.__attributeReview.snapshot().current.length === 0);
  checks.push('clamped +2 at 98→100 and three consecutive events render in order, never overwrite');
  await sample(); await invoke('hold', false);
  await page.locator('.af-row').first().hover();
  const held = (await snap()).elapsed; await page.waitForTimeout(650); assert.equal((await snap()).elapsed, held);
  await page.locator('.af-row').first().click(); await page.locator('.s3-growth-dialog[open]').waitFor();
  assert.equal(await page.locator('.s3-growth-dialog').getAttribute('data-stat'), 'momentum');
  const frozen = await snap(); await page.waitForTimeout(450); assert.equal((await snap()).elapsed, frozen.elapsed);
  await page.keyboard.press('Escape'); await page.locator('.s3-growth-dialog[open]').waitFor({state:'hidden'});
  assert.equal(await page.locator('.d3-canvas').evaluate(node => node === document.activeElement), true);
  await page.mouse.move(1420, 880);
  checks.push('hover holds; clicking a change opens its metric detail without changing state');
  await sample(); await invoke('hold', false); await page.keyboard.press('Escape');
  await page.locator('.d3-settings[open]').waitFor();
  const pauseState = await snap();
  const animationState = await page.locator('.af-feedback').evaluate(node => node.getAnimations({subtree:true}).map(a => a.currentTime));
  await page.waitForTimeout(700);
  assert.equal((await snap()).elapsed, pauseState.elapsed);
  assert.deepEqual(await page.locator('.af-feedback').evaluate(node => node.getAnimations({subtree:true}).map(a => a.currentTime)), animationState);
  await page.locator('.d3-settings .d3-primary').click();
  checks.push('settings freeze both queue lifetime and every CSS animation clock');

  // Trigger a real reward by completing the authored newsboy conversation through normal controls.
  await invoke('clear'); await invoke('hold', false);
  const beforeStory = await page.evaluate(() => window.__streetTest.story());
  await page.locator(`.d3-place[data-point="${beforeStory.target.id}"]`).click();
  await page.locator('.s3-dialogue:not([hidden])').waitFor();
  const realText = await page.locator('.s3-line').innerText();
  await invoke('dialogue', true); await invoke('dialogue', false);
  assert.equal(await page.locator('.s3-line').innerText(), realText);
  for (let i = 0; i < 15 && await page.evaluate(() => window.__streetTest.story().phase === 'dialogue'); i++) {
    await page.locator('.s3-dialogue').focus(); await page.keyboard.press('Space');
  }
  await page.waitForFunction(() => window.__attributeReview.snapshot().current.length > 0);
  const committed = await page.evaluate(() => window.__streetTest.story().state);
  const notice = await snap();
  assert.ok(notice.current.every(c => c.value === committed[c.stat] && c.delta === committed[c.stat] - beforeStory.state[c.stat]));
  await page.waitForFunction(() => window.__attributeReview.snapshot().elapsed >= 650); await invoke('hold', true);
  assert.equal(await page.locator('.af-feedback').isVisible(), true);
  await capture('actual-story-reward');
  checks.push('completing the real authored newsboy interaction displays exactly its committed +2 Influence');
  checks.push('the dialogue preview cannot overwrite a live story dialogue');
  await invoke('dialogue', true);

  for (const viewport of [{ width: 760, height: 540 }, { width: 390, height: 740 }]) {
    await page.setViewportSize(viewport);
    for (const mode of ['dual', 'dual-en']) {
      await invoke('language', mode);
      for (const variant of ['stamp', 'spark', 'ruler']) {
        await invoke('select', variant); await sample('trust');
        await capture(`${variant}-dialogue-${mode}-${viewport.width}`);
        const dialogue = await page.locator('.s3-dialogue').boundingBox(), feedback = await page.locator('.af-feedback').boundingBox();
        assert.ok(feedback && feedback.y + feedback.height <= dialogue.y - 8, `${variant}: small bilingual dialogue remains unobstructed`);
        geometry.push({ name: `${variant}-dialogue-${mode}-${viewport.width}`, dialogue, feedback });
      }
    }
  }
  checks.push('small bilingual dialogue cues move above the text and split into queued individual changes when needed');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const variant of ['stamp', 'spark', 'ruler']) {
    await invoke('select', variant); await sample('mixed');
    assert.equal(await page.locator('.af-feedback').evaluate(node => node.getAnimations({subtree:true}).length), 0);
  }
  checks.push('three variants honor system reduced motion without losing the values');
  await page.setViewportSize({ width: 1440, height: 900 }); await invoke('language', 'dual');
  await invoke('clear'); await invoke('clean', false);
  await capture('review-controls');
  assert.deepEqual(errors, []);
  await writeFile('artifacts/attribute-feedback-check.json', JSON.stringify({ checks, errors, captures, geometry }, null, 2));
  console.log(JSON.stringify({ checks, errors, captures }, null, 2));
} catch (error) {
  await capture('failure').catch(() => {});
  await writeFile('artifacts/attribute-feedback-failure.json', JSON.stringify({ error: String(error), checks, errors, captures, geometry }, null, 2));
  throw error;
} finally { await browser.close(); }
