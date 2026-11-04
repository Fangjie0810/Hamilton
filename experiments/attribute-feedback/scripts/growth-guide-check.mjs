import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const base = process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/';
const checks = [], errors = [], failures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`); });
const story = () => page.evaluate(() => window.__growthDirector.debug());
const dialog = () => page.locator('.s3-growth-dialog[open]');
const metric = stat => `.s3-compass [data-stat="${stat}"]`;

async function readCurrent() {
  for (let step = 0; (await story()).phase === 'dialogue'; step++) {
    assert.ok(step < 30, 'conversation completes in bounded advances');
    await page.locator('.s3-dialogue').focus(); await page.keyboard.press('Space');
  }
}
async function beginCurrent() {
  await page.evaluate(() => { const d = window.__growthDirector; if (!d.progress.begin(d.progress.interaction.id)) throw new Error('normal begin rejected'); d.sync(); });
  await readCurrent();
}
async function nextChapter(loseFocus = false) {
  await page.evaluate(async loseFocus => {
    const d = window.__growthDirector; if (!d.progress.nextChapter()) throw new Error('normal chapter exit rejected');
    const entering = d.enterChapter();
    if (loseFocus) window.dispatchEvent(new Event('blur'));
    await entering; d.ui.textSpeed = 0;
  }, loseFocus);
}
async function setMode(mode) { await page.evaluate(async mode => (await import('/src/i18n/text.ts')).setLanguage(mode), mode); }
async function checkModalLayout(name) {
  const result = await dialog().evaluate(node => {
    const bounds = node.getBoundingClientRect();
    return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: node.clientWidth, scrollWidth: node.scrollWidth, viewport: innerWidth, height: innerHeight, scrollTop: node.scrollTop };
  });
  assert.ok(result.left >= 0 && result.right <= result.viewport + 1 && result.width + 1 >= result.scrollWidth, `${name}: no horizontal clipping ${JSON.stringify(result)}`);
  assert.ok(result.top >= 0 && result.bottom <= result.height + 1, `${name}: modal stays within viewport`);
  const badTranslations = await dialog().evaluate(async root => {
    const { boundText, getPrimaryLanguage } = await import('/src/i18n/text.ts');
    return [...root.querySelectorAll('[data-localized]')].flatMap(node => {
      const pair = boundText(node); if (!pair || typeof pair === 'string') return [];
      return node.querySelector(':scope > .text-primary')?.textContent === pair[getPrimaryLanguage()] && !node.querySelector(':scope > .text-secondary') ? [] : [node.className];
    });
  });
  assert.deepEqual(badTranslations, [], `${name}: growth copy follows only the primary language`);
}
async function closeAndRestore(selector) {
  await page.keyboard.press('Escape');
  assert.equal(await dialog().count(), 0, 'Escape closes growth');
  assert.equal(await page.locator('.d3-settings[open]').count(), 0, 'Escape does not also open settings');
  await page.waitForFunction(() => document.querySelector('.d3-canvas')?.dataset.paused === 'false');
  if (selector) assert.ok(await page.locator(selector).evaluate(node => node === document.activeElement), 'closing growth returns the original focus');
}

try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(base); await page.locator('.entry-screen').waitFor();
  // Capture the real Director instance; all progression below uses its normal methods.
  // Map movement and discovery reachability are exercised by the full 3D regression.
  await page.evaluate(async () => {
    localStorage.setItem('project-hamilton:3d-quality:v1', 'low');
    const source = await (await fetch('/src/demo3d/Demo.ts')).text();
    const directorURL = source.match(/import\s*\{\s*StoryDirector\s*\}\s*from\s*["']([^"']+)["']/)?.[1];
    if (!directorURL) throw new Error('Director module import was not found');
    const { StoryDirector } = await import(directorURL);
    const start = StoryDirector.prototype.start;
    StoryDirector.prototype.start = async function () { window.__growthDirector = this; return start.call(this); };
    (await import('/src/ui/voiceover.ts')).voiceover.setEnabled(false);
    history.replaceState(null, '', '/?story=3d&debug=1');
    await (await import('/src/demo3d/Demo.ts')).startDemo();
    window.__growthDirector.ui.textSpeed = 0;
  });
  await page.locator('.d3-canvas[data-ready=true]').waitFor();
  assert.equal(await dialog().count(), 0, 'no automatic growth introduction interrupts the prologue');
  for (const stat of ['momentum', 'influence', 'washingtonTrust', 'burrRivalry', 'burrRespect']) {
    await page.locator(metric(stat)).focus(); await page.keyboard.press('Enter');
    await dialog().waitFor();
    assert.equal(await dialog().getAttribute('data-intro'), 'false');
    assert.equal(await dialog().locator('.s3-growth-row').count(), 1, 'each compass part opens its own meaning');
    assert.equal(await dialog().locator('.s3-growth-row').getAttribute('data-stat'), stat);
    if (stat.startsWith('burr')) assert.match(await dialog().innerText(), /与伯尔相识/);
    if (stat === 'washingtonTrust') assert.match(await dialog().innerText(), /尚未解锁/);
    const frozen = await story();
    await page.keyboard.press('w'); await page.waitForTimeout(100);
    assert.deepEqual((await story()).state, frozen.state);
    await closeAndRestore(metric(stat));
  }
  checks.push('each compass part opens its focused metric; locked trust and relationship meanings are clear; Escape restores SVG focus without opening settings');

  await beginCurrent(); await nextChapter(true);
  assert.equal((await story()).chapter, 'Arrival');
  await page.locator('.d3-settings[open]').waitFor();
  assert.equal(await dialog().count(), 0, 'transition blur opens only the settings pause');
  const beforeResume = await story();
  await page.waitForTimeout(180);
  assert.deepEqual((await story()).state, beforeResume.state, 'transition pause never changes progression');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.locator('.d3-settings .d3-primary').click();
  await page.waitForTimeout(150);
  assert.equal(await dialog().count(), 0, 'resuming Arrival does not open an automatic growth introduction');
  assert.equal((await story()).phase, 'explore');
  assert.deepEqual((await story()).state, beforeResume.state, 'resuming returns directly to the same exploration');
  checks.push('losing focus during Arrival transitions preserves state; resume returns to exploration without an automatic growth modal');
  await page.locator(metric('burrRespect')).focus(); await page.keyboard.press('Enter');
  await dialog().waitFor();
  assert.equal(await dialog().evaluate(node => node.scrollTop), 0, 'metric details open at their title');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const mode of ['zh', 'en', 'dual', 'dual-en']) {
      await setMode(mode); await checkModalLayout(`metric/${width}/${mode}`);
      if (mode === 'dual-en') await page.screenshot({ path: `artifacts/growth-guide-metric-${width}.png` });
    }
  }
  await closeAndRestore(); await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press('Escape'); await page.locator('.d3-settings[open]').waitFor();
  await page.locator('.s3-restart').click(); await page.waitForTimeout(900);
  assert.equal(await dialog().count(), 0, 'restart does not add an automatic growth introduction');
  await page.evaluate(() => { window.__growthDirector.ui.textSpeed = 0; });
  checks.push('focused metric details fit 390px and desktop in all four languages; chapter restart remains free of automatic growth modals');

  await beginCurrent();
  await page.locator('.s3-growth-notice:not([hidden])').waitFor();
  await page.waitForFunction(() => document.querySelector('.s3-growth-notice')?.innerText.includes('+2'));
  assert.equal((await story()).state.influence, 12);
  assert.match(await page.locator('.s3-growth-notice').innerText(), /\+2/);
  assert.equal(await page.locator(metric('influence')).getAttribute('data-gained'), 'true');
  await beginCurrent(); await beginCurrent();
  assert.equal((await story()).phase, 'choice');
  assert.equal(await page.locator('.s3-choice-growth-guide').count(), 1);
  assert.equal(await page.locator('.s3-dialogue .s3-growth-toggle,.s3-dialogue-footer,.s3-advance').count(), 0, 'choices do not restore the removed dialogue footer');
  const choice = await story();
  await page.locator('.s3-dialogue').focus(); await page.keyboard.press('e');
  for (const mode of ['zh', 'en', 'dual', 'dual-en']) await setMode(mode);
  assert.equal((await story()).phase, 'choice'); assert.deepEqual((await story()).state, choice.state);
  await page.locator('.s3-choice').first().click(); await readCurrent(); await nextChapter();
  await beginCurrent();
  assert.equal((await story()).chapter, 'Tavern'); assert.equal((await story()).phase, 'choice');
  assert.equal(await page.locator('.s3-choice-growth-guide').count(), 0, 'no tutorial is injected into the timed tavern choice');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.s3-dialogue .s3-growth-toggle').count(), 0);
  await page.keyboard.press('Escape'); await page.locator('.d3-settings[open]').waitFor();
  await page.waitForFunction(() => document.querySelector('.d3-canvas')?.dataset.paused === 'true');
  const timed = await story();
  for (const mode of ['zh', 'en', 'dual', 'dual-en']) { await page.locator('#d3-language').selectOption(mode); await page.waitForTimeout(70); }
  assert.equal((await story()).remaining, timed.remaining, 'settings pause freezes the original choice clock');
  assert.deepEqual((await story()).state, timed.state);
  await page.locator('.d3-settings .d3-primary').click();
  assert.ok(await page.locator('.s3-dialogue').evaluate(node => node === document.activeElement), 'resuming returns focus to the original choice');
  await page.waitForTimeout(120); assert.ok((await story()).remaining < timed.remaining, 'the same choice clock resumes');
  checks.push('newspaper feedback shows the real +2 on the compass; first choice explains arrows without footer controls; settings freeze/resume the actual tavern timer and choice state');

  for (let step = 0; (await story()).phase !== 'exit'; step++) {
    assert.ok(step < 12);
    const current = await story();
    if (current.phase === 'choice') { await page.locator('.s3-choice').first().click(); await readCurrent(); }
    else if (current.phase === 'explore') await beginCurrent();
    else await readCurrent();
  }
  await nextChapter(); await beginCurrent();
  await page.locator('.activity-overlay[data-activity="debate"]').waitFor();
  await page.locator('.activity-body > .primary').click();
  await page.locator('.activity-header .s3-growth-toggle').click();
  const snapshot = await page.evaluate(() => { const a = window.__growthDirector.ui.activity; window.__growthActivity = a; return JSON.stringify(a.game); });
  for (const mode of ['zh', 'en', 'dual', 'dual-en']) {
    await setMode(mode); await page.setViewportSize({ width: 390, height: 844 }); await checkModalLayout(`activity/390/${mode}`);
  }
  await page.screenshot({ path: 'artifacts/growth-guide-activity-390.png' });
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__growthDirector.ui.activity.game)), snapshot, 'growth modal preserves activity timer, score, and assistance counters');
  assert.ok(await page.evaluate(() => window.__growthDirector.ui.activity === window.__growthActivity), 'activity instance survives language and modal changes');
  await closeAndRestore('.activity-header .s3-growth-toggle');
  checks.push('activity growth modal retains the same game instance, timer, score, and assistance counters across four languages and 390px layout');
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  await writeFile('artifacts/growth-guide-report.json', JSON.stringify({ checks, errors, failures }, null, 2));
  console.log(JSON.stringify({ checks, errors, failures }, null, 2));
} catch (error) {
  await page.screenshot({ path: 'artifacts/growth-guide-failure.png' }).catch(() => {});
  await writeFile('artifacts/growth-guide-report.json', JSON.stringify({ checks, errors, failures, error: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
