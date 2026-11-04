import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { playActivity } from './gameplay-helpers.mjs';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const base = process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/';
const checks = [], errors = [], failures = [];
const output = 'artifacts/growth-guide-0.5.2';
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`); });
const story = () => page.evaluate(() => window.__growthDirector.debug());
const dialog = () => page.locator('.s3-growth-dialog[open]');
const metric = stat => `.s3-compass [data-stat="${stat}"]`;
const expected = {
  influence: '人们愿意听你说话、传播你的主张。',
  momentum: '锐气使你主动争取机会。克制会降低锐气，但维持其较高可能有更多回报。',
  burrRespect: '伯尔对你判断力的认可，与竞争可以同时增长。',
  burrRivalry: '他开始把你当作必须认真面对的对手',
  washingtonTrust: '先有信任、再有带兵',
};

async function readCurrent() {
  for (let step = 0; (await story()).phase === 'dialogue'; step++) {
    assert.ok(step < 30, 'conversation completes in bounded advances');
    assert.equal(await dialog().count(), 0, 'automatic tutorials wait until the last reply finishes');
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
    return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: node.clientWidth, scrollWidth: node.scrollWidth, viewport: innerWidth, height: innerHeight };
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
  assert.deepEqual(badTranslations, [], `${name}: copy follows only the primary language`);
}
async function checkIllustration(stats, name) {
  const result = await page.evaluate(async highlighted => {
    const root = document.querySelector('.s3-growth-dialog[open]');
    const graphic = root.querySelector('.s3-growth-visual');
    const svg = graphic?.querySelector('svg');
    const state = window.__growthDirector.debug().state;
    const chapter = window.__growthDirector.debug().chapter;
    const { growthAttributes } = await import('/src/data/growth.ts');
    const { getPrimaryLanguage } = await import('/src/i18n/text.ts');
    const language = getPrimaryLanguage();
    const values = [...(svg?.querySelectorAll('[data-stat]') ?? [])].map(node => {
      const stat = node.dataset.stat;
      const surface = node.querySelector('.part-surface');
      const hudPart = document.querySelector(`.s3-compass [data-stat="${stat}"]`);
      const hudSurface = hudPart.querySelector('.part-surface');
      const shape = element => ['d', 'cx', 'cy', 'r'].map(key => element.getAttribute(key));
      return {
        stat, value: Number(node.dataset.value), source: state[stat], rendered: node.querySelector('text')?.textContent,
        locked: stat === 'washingtonTrust' && !['Washington', 'Yorktown'].includes(chapter),
        emphasis: node.dataset.emphasis, opacity: Number(getComputedStyle(node).opacity),
        shapeMatchesHUD: JSON.stringify(shape(surface)) === JSON.stringify(shape(hudSurface)),
        radiusMatchesHUD: node.dataset.radius === hudPart.dataset.radius,
        interactive: node.hasAttribute('tabindex') || node.hasAttribute('role'),
        pointerEvents: getComputedStyle(node).pointerEvents,
      };
    });
    const bounds = svg?.getBoundingClientRect();
    const description = root.querySelector('.s3-growth-description').getBoundingClientRect();
    const label = graphic?.getAttribute('aria-label') ?? '';
    window.__firstGrowthIllustration ??= svg;
    const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
    return {
      values, label, accessible: graphic?.getAttribute('role') === 'img' && highlighted.every(stat => label.includes(growthAttributes.find(item => item.id === stat).name[language])),
      rendererRetained: window.__firstGrowthIllustration === svg,
      uniqueIds: new Set(ids).size === ids.length,
      aboveCopy: !!bounds && bounds.bottom <= description.top,
      fits: !!bounds && bounds.width >= 140 && bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight,
      animationCount: graphic?.getAnimations({ subtree: true }).length,
    };
  }, stats);
  assert.equal(result.values.length, 5, `${name}: full production badge retains five modules`);
  assert.ok(result.rendererRetained && result.uniqueIds, `${name}: persistent production renderer with unique SVG definitions`);
  assert.ok(result.aboveCopy && result.fits, `${name}: visible badge sits above the short explanation`);
  assert.ok(result.accessible, `${name}: the graphic has a current-language accessible label`);
  assert.equal(result.animationCount, 0, `${name}: no simulated reward animation`);
  for (const part of result.values) {
    const focused = stats.includes(part.stat);
    assert.equal(part.value, part.source, `${name}/${part.stat}: real state value`);
    assert.equal(part.rendered, part.locked ? '—' : String(part.source), `${name}/${part.stat}: visible value respects the real lock`);
    assert.equal(part.emphasis, focused ? 'focus' : 'context');
    assert.equal(part.opacity, focused ? 1 : .2, `${name}/${part.stat}: selected modules stand out`);
    assert.ok(part.shapeMatchesHUD && part.radiusMatchesHUD, `${name}/${part.stat}: production HUD geometry and real fill radius`);
    assert.equal(part.interactive, false, `${name}/${part.stat}: illustration adds no extra keyboard targets`);
    assert.equal(part.pointerEvents, 'none', `${name}/${part.stat}: illustration is read-only`);
  }
}
async function closeAndRestore(selector) {
  await page.keyboard.press('Escape');
  assert.equal(await dialog().count(), 0, 'Escape closes growth');
  assert.equal(await page.locator('.d3-settings[open]').count(), 0, 'Escape does not also open settings');
  await page.waitForFunction(() => document.querySelector('.d3-canvas')?.dataset.paused === 'false');
  if (selector) assert.ok(await page.locator(selector).evaluate(node => node === document.activeElement), 'closing growth restores focus');
}
async function verifyTutorial(id, stats, { pause = false } = {}) {
  await dialog().waitFor();
  assert.equal(await dialog().getAttribute('data-intro'), 'true');
  assert.equal(await dialog().getAttribute('data-tutorial'), id);
  assert.deepEqual(await dialog().locator('.s3-growth-row').evaluateAll(rows => rows.map(row => row.dataset.stat)), stats);
  assert.equal(await dialog().locator('.s3-growth-use,.s3-growth-note,.s3-growth-overview,.s3-growth-value').count(), 0, 'tutorial contains only the requested meaning');
  const snapshot = await story();
  const feedback = await page.evaluate(() => window.__growthDirector.ui.attributeFeedback.snapshot());
  if (pause) {
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.locator('.d3-settings[open]').waitFor();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.locator('.d3-settings .d3-primary').click();
    assert.equal(await dialog().getAttribute('data-tutorial'), id, 'settings resume restores the same tutorial');
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const mode of ['zh', 'en', 'dual', 'dual-en']) {
      await setMode(mode); await checkModalLayout(`${id}/${width}/${mode}`); await checkIllustration(stats, `${id}/${width}/${mode}`);
      if (mode === 'zh' || mode === 'dual') {
        for (const stat of stats) assert.equal(await dialog().locator(`[data-stat="${stat}"] .s3-growth-description`).innerText(), expected[stat]);
      }
      await page.screenshot({ path: `${output}/${id}-${width}-${mode}.png` });
    }
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await checkIllustration(stats, `${id}/motion-enabled`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('w'); await page.waitForTimeout(120);
  assert.deepEqual((await story()).state, snapshot.state, 'tutorial and language changes preserve game state');
  assert.equal((await story()).remaining, snapshot.remaining, 'tutorial preserves the original choice clock');
  assert.deepEqual(await page.evaluate(() => window.__growthDirector.ui.attributeFeedback.snapshot()), feedback, 'attribute animation remains paused under the tutorial');
  await closeAndRestore(); await page.setViewportSize({ width: 1440, height: 900 });
  checks.push(`${id}: production badge highlights ${stats.join('+')} with real values above concise copy; 4 languages at 1440px and 390px; read-only, accessible, static with either motion preference; state and feedback preserved${pause ? ', settings pause/resume' : ''}`);
}

try {
  await mkdir(output, { recursive: true });
  await page.goto(base); await page.locator('.entry-screen').waitFor();
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
  assert.equal(await dialog().count(), 0, 'no tutorial interrupts the prologue');
  assert.ok(await page.locator('.s3-compass').isHidden(), 'the prologue keeps the compass hidden');
  await beginCurrent(); await nextChapter(true);
  await page.locator('.d3-settings[open]').waitFor();
  assert.equal(await dialog().count(), 0, 'Arrival entry does not introduce all attributes at once');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.locator('.d3-settings .d3-primary').click();
  assert.equal(await dialog().count(), 0);
  checks.push('prologue and Arrival entry remain uninterrupted, including transition blur/resume');

  for (const stat of Object.keys(expected)) {
    await page.locator(metric(stat)).focus(); await page.keyboard.press('Enter');
    await dialog().waitFor(); await setMode('zh');
    assert.equal(await dialog().getAttribute('data-intro'), 'false');
    assert.equal(await dialog().locator('.s3-growth-row').count(), 1);
    assert.equal(await dialog().locator('.s3-growth-description').innerText(), expected[stat]);
    await checkIllustration([stat], `manual/${stat}`);
    await page.screenshot({ path: `${output}/manual-${stat}-1440-zh.png` });
    await closeAndRestore(metric(stat));
  }
  checks.push('all five compass sections reopen their own concise meaning and focused badge module with keyboard focus restored');
  await beginCurrent(); assert.equal((await story()).state.influence, 12);
  await verifyTutorial('arrival-newspaper', ['influence'], { pause: true });
  const momentumBeforeStreet = (await story()).state.momentum;
  await beginCurrent(); assert.equal((await story()).state.momentum, momentumBeforeStreet + 2);
  await verifyTutorial('arrival-street', ['momentum']);
  await beginCurrent(); assert.equal((await story()).phase, 'choice');
  await page.locator('.s3-choice').first().click(); await readCurrent();
  await verifyTutorial('arrival-burr', ['burrRespect', 'burrRivalry']);

  await page.evaluate(async () => { await window.__growthDirector.restart(); window.__growthDirector.ui.textSpeed = 0; });
  for (let i = 0; i < 3; i++) {
    await beginCurrent();
    if ((await story()).phase === 'choice') { await page.locator('.s3-choice').first().click(); await readCurrent(); }
    await page.waitForTimeout(50); assert.equal(await dialog().count(), 0, 'completed teachings do not repeat on chapter restart');
  }
  assert.equal((await story()).state.influence, 12); assert.equal((await story()).phase, 'exit');
  checks.push('chapter checkpoint restores original rewards while already-read tutorials stay deduplicated');
  await nextChapter(); await beginCurrent();
  assert.equal((await story()).phase, 'choice');
  await page.keyboard.press('Escape'); await page.locator('.d3-settings[open]').waitFor();
  const timed = await story();
  for (const mode of ['zh', 'en', 'dual', 'dual-en']) { await page.locator('#d3-language').selectOption(mode); await page.waitForTimeout(50); }
  assert.equal((await story()).remaining, timed.remaining); assert.deepEqual((await story()).state, timed.state);
  await page.locator('.d3-settings .d3-primary').click();
  await page.waitForTimeout(120); assert.ok((await story()).remaining < timed.remaining);
  checks.push('Tavern settings and language switching preserve and resume the existing choice timer');
  for (let step = 0; (await story()).phase !== 'exit'; step++) {
    assert.ok(step < 12);
    if ((await story()).phase === 'choice') { await page.locator('.s3-choice').first().click(); await readCurrent(); }
    else await beginCurrent();
  }
  await nextChapter(); await beginCurrent();
  await page.locator('.activity-overlay[data-activity="debate"]').waitFor();
  await page.locator('.activity-header .s3-growth-toggle').click();
  const activity = await page.evaluate(() => { const a = window.__growthDirector.ui.activity; window.__growthActivity = a; return JSON.stringify(a.game); });
  for (const mode of ['zh', 'en', 'dual', 'dual-en']) { await setMode(mode); await checkModalLayout(`activity/${mode}`); await checkIllustration(Object.keys(expected), `activity/${mode}`); }
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__growthDirector.ui.activity.game)), activity);
  assert.ok(await page.evaluate(() => window.__growthDirector.ui.activity === window.__growthActivity));
  await closeAndRestore('.activity-header .s3-growth-toggle');
  checks.push('manual growth review preserves the existing minigame instance, score, timer, and assistance');
  await playActivity(page, true);
  await nextChapter(); await beginCurrent();
  assert.equal((await story()).phase, 'choice');
  await page.locator('.s3-choice').last().click(); await readCurrent();
  assert.equal((await story()).state.washingtonTrust, 0);
  await verifyTutorial('washington-offer', ['washingtonTrust']);
  await page.evaluate(async () => { await window.__growthDirector.restart(); window.__growthDirector.ui.textSpeed = 0; });
  await beginCurrent(); await page.locator('.s3-choice').first().click(); await readCurrent();
  assert.equal(await dialog().count(), 0, 'Washington tutorial also deduplicates after restart');
  checks.push('Washington tutorial follows the first reply even when trust falls to zero, then stays deduplicated on restart');
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ checks, errors, failures }, null, 2));
  console.log(JSON.stringify({ checks, errors, failures }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  await writeFile(`${output}/report.json`, JSON.stringify({ checks, errors, failures, error: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
