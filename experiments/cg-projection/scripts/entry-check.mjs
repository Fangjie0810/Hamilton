import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
const page = await context.newPage();
const base = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/'); base.search = ''; base.hash = '';
const errors = [], failures = [], checks = [], layouts = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`);
});

async function entryReady() {
  await page.locator('.entry-screen').waitFor();
  await page.waitForFunction(() => {
    const art = document.querySelector('.entry-art'); return art?.complete && art.naturalWidth > 0;
  }, undefined, { timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
}
async function mode(language) {
  await page.locator(`.entry-language[data-language="${language}"]`).click();
  assert.equal(await page.locator('html').getAttribute('data-language'), language);
  assert.equal(await page.locator('.entry-language[aria-pressed=true]').getAttribute('data-language'), language);
  assert.equal(await page.locator('#entry-settings-language').inputValue(), language);
  assert.equal(await page.locator('.entry-actions a').count(), 1, 'entry has one journey action');
  assert.equal(await page.locator('.entry-begin').getAttribute('href'), '/?story=3d');
  assert.equal(await page.locator('.entry-secondary-actions, .entry-secondary, a[href="/?story=2d"], a[href="/?demo=3d"]').count(), 0, 'removed modes have no entry controls');
  assert.ok(!/经典叙事|自由漫游|Classic story|Explore the world|All modes|exploration settings/i.test(await page.locator('.entry-screen').textContent()), 'entry copy does not advertise removed modes');
  if (language === 'en') assert.ok(!/\p{Script=Han}/u.test(await page.locator('.entry-screen').innerText()), 'English entry has no Chinese residue');
  if (language === 'zh') assert.equal(await page.locator('.entry-screen .text-secondary').count(), 0, 'Chinese entry has no secondary subtitles');
  if (language === 'dual') {
    assert.equal(await page.locator('.entry-begin-label .text-primary').textContent(), '启程');
    assert.equal(await page.locator('.entry-begin-label .text-secondary').textContent(), 'Begin your story');
  }
}
async function checkLayout(language, viewport, name) {
  await page.setViewportSize(viewport); await mode(language);
  // End finite entrance effects before measuring the final visible geometry.
  await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
  const layout = await page.locator('.entry-screen').evaluate(screen => {
    const essential = ['.entry-header', '.entry-title', '.entry-subtitle', '.entry-description', '.entry-begin', '.entry-footer'];
    return {
      width: innerWidth, documentWidth: document.documentElement.scrollWidth,
      screenWidth: screen.clientWidth, contentWidth: screen.scrollWidth,
      height: screen.clientHeight, contentHeight: screen.scrollHeight,
      contentBottom: screen.querySelector('.entry-content').getBoundingClientRect().bottom,
      footerTop: screen.querySelector('.entry-footer').getBoundingClientRect().top,
      footerBottom: screen.querySelector('.entry-footer').getBoundingClientRect().bottom,
      bounds: essential.map(selector => {
        const rect = screen.querySelector(selector).getBoundingClientRect();
        return { selector, left: rect.left, right: rect.right, width: rect.width };
      }),
    };
  });
  assert.ok(layout.documentWidth <= viewport.width + 1, `${name}/${language}: no document overflow`);
  assert.ok(layout.contentWidth <= layout.screenWidth + 1, `${name}/${language}: no hidden entry overflow`);
  if (name !== 'mobile') {
    assert.ok(layout.footerBottom <= viewport.height + 1, `${name}/${language}: footer fits viewport`);
    assert.ok(layout.contentBottom <= layout.footerTop + 1, `${name}/${language}: main content does not overlap footer`);
  }
  for (const bounds of layout.bounds) {
    // The compact desktop layout intentionally omits the optional two-line description.
    if (bounds.selector === '.entry-description' && name === 'compact' && bounds.width === 0) continue;
    assert.ok(bounds.width > 0 && bounds.left >= -1 && bounds.right <= viewport.width + 1, `${name}/${language}: ${bounds.selector} fits horizontally: ${JSON.stringify(bounds)}`);
  }
  layouts.push({ name, language, ...layout });
  if (language === 'dual' || name === 'desktop') await page.screenshot({ path: `artifacts/entry-${language}-${name}.png`, animations: 'disabled' });
}
async function checkDialog(trigger, dialog) {
  await page.locator(trigger).click(); await page.locator(`${dialog}[open]`).waitFor();
  assert.ok(await page.locator(dialog).evaluate(node => node instanceof HTMLDialogElement && node.matches(':modal') && node.contains(document.activeElement)), `${dialog}: native modal owns focus`);
  await page.keyboard.press('Tab');
  // Native dialogs can tab into browser chrome, represented by BODY, after their last control.
  // Any focused page control must still belong to the modal, never the inert entry background.
  assert.ok(await page.locator(dialog).evaluate(node => node.matches(':modal') && (node.contains(document.activeElement) || document.activeElement === document.body)), `${dialog}: Tab cannot focus background page controls`);
  await page.keyboard.press('Escape'); await page.locator(`${dialog}[open]`).waitFor({ state: 'hidden' });
  assert.ok(await page.locator(trigger).evaluate(node => node === document.activeElement), `${dialog}: Esc restores trigger focus`);
}
async function threeReady(mode) {
  await page.locator(`.d3-canvas[data-mode=${mode}][data-ready=true]`).waitFor({ timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('.d3-canvas')?.dataset.quality === 'low');
  assert.equal(await page.locator('html').getAttribute('data-language'), 'en');
}
async function returnToTitle() {
  await page.locator('.d3-header a.d3-back[href="/"]').click(); await entryReady();
  assert.equal(await page.locator('canvas').count(), 0, 'returning to entry unloads game canvas');
}

try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(base.href); await entryReady();
  assert.equal(await page.locator('html').getAttribute('data-language'), 'dual', 'fresh default is bilingual');
  assert.equal(await page.locator('canvas').count(), 0, 'entry does not launch either game engine');
  const originalScreen = await page.locator('.entry-screen').elementHandle();
  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 900 }], ['compact', { width: 1024, height: 640 }], ['mobile', { width: 390, height: 844 }],
  ]) {
    for (const language of ['dual', 'zh', 'en']) await checkLayout(language, viewport, name);
  }
  assert.ok(await originalScreen.evaluate(node => node === document.querySelector('.entry-screen')), 'language changes preserve the entry screen instance');
  checks.push('fresh default dual', 'three live languages preserve DOM', 'nine language/viewport layouts without horizontal clipping', 'entry starts no game canvas', 'one main-story action with no classic or exploration entry controls or copy');

  await mode('dual');
  await checkDialog('.entry-settings-trigger', '.entry-settings');
  await checkDialog('.entry-help', '.entry-help-dialog');
  await page.setViewportSize({ width: 1440, height: 900 });
  await checkDialog('.entry-settings-trigger', '.entry-settings');
  await checkDialog('.entry-help', '.entry-help-dialog');
  checks.push('settings and help are native modal dialogs', 'Tab does not focus background controls and Esc restores focus on desktop and mobile');

  await page.locator('.entry-settings-trigger').click();
  await page.locator('#entry-settings-language').selectOption('en');
  await page.locator('#entry-settings-quality').selectOption('low');
  await page.locator('#entry-settings-speed').selectOption('0');
  await page.locator('#entry-settings-motion').check();
  assert.ok(await page.locator('.entry-screen').evaluate(node => node.classList.contains('entry-reduce-motion')), 'motion preference applies immediately to entry');
  await page.screenshot({ path: 'artifacts/entry-settings-desktop.png', animations: 'disabled' });
  await page.keyboard.press('Escape'); await page.reload(); await entryReady();
  assert.equal(await page.locator('html').getAttribute('data-language'), 'en');
  assert.ok(await page.locator('.entry-screen').evaluate(node => node.classList.contains('entry-reduce-motion')));
  await page.locator('.entry-settings-trigger').click();
  assert.equal(await page.locator('#entry-settings-language').inputValue(), 'en');
  assert.equal(await page.locator('#entry-settings-quality').inputValue(), 'low');
  assert.equal(await page.locator('#entry-settings-speed').inputValue(), '0');
  assert.ok(await page.locator('#entry-settings-motion').isChecked());
  await page.keyboard.press('Escape');
  checks.push('language, graphics, text speed and motion persist after reload');

  // Launch through the single entry action; the game route is not synthesized in the test.
  await page.locator('.entry-begin').focus(); await page.keyboard.press('Enter');
  await page.locator('.opening-film-skip').click(); await threeReady('story');
  assert.equal(new URL(page.url()).searchParams.get('story'), '3d');
  await page.locator('.d3-settings-button').click(); await page.locator('.d3-settings[open]').waitFor();
  assert.equal(await page.locator('#d3-quality').inputValue(), 'low');
  assert.equal(await page.locator('#d3-text-speed').inputValue(), '0');
  assert.ok(await page.locator('#d3-motion').isChecked());
  await page.locator('.d3-settings .d3-primary').click();
  await page.screenshot({ path: 'artifacts/entry-story-start.png' }); await returnToTitle();
  checks.push('keyboard Enter opens actual 3D story', '3D story inherits all entry preferences', '3D return link opens shared title');

  await mode('en');
  checks.push('returning to entry preserves the single main-story action');

  // Presentation-only ending harness: exercise the production StoryUI button and real
  // navigation callback without claiming that this script has completed all six chapters.
  await page.evaluate(async () => {
    const { StoryUI } = await import('/src/story3d/StoryUI.ts');
    const { initialGameState } = await import('/src/core/GameState.ts');
    const app = document.querySelector('#app'); app.className = 'demo3d story3d'; app.replaceChildren();
    const ui = new StoryUI(app);
    ui.showEnding(initialGameState(), () => {}, () => { location.href = '/'; });
  });
  await page.locator('.s3-return-title').waitFor();
  assert.equal(await page.locator('.s3-explore').count(), 0, 'ending no longer offers free exploration');
  for (const language of ['en', 'zh', 'dual']) {
    await page.evaluate(async language => (await import('/src/i18n/text.ts')).setLanguage(language), language);
    const expected = language === 'en' ? 'Return to Title' : '返回标题';
    assert.equal(await page.locator('.s3-return-title .text-primary').textContent(), expected);
    if (language === 'dual') assert.equal(await page.locator('.s3-return-title .text-secondary').textContent(), 'Return to Title');
  }
  await page.locator('.s3-return-title').focus(); await page.keyboard.press('Enter'); await entryReady();
  await mode('dual');
  checks.push('ending presentation shows bilingual Return to Title with no exploration control', 'native Enter on the production ending return button opens the single-action entry');
  assert.deepEqual(errors, [], 'no uncaught browser errors'); assert.deepEqual(failures, [], 'no failed HTTP resources');
  await writeFile('artifacts/entry-report.json', JSON.stringify({ checks, layouts, errors, failures }, null, 2));
  console.log(`PASS entry: ${checks.join('; ')}`);
} catch (error) {
  await page.screenshot({ path: 'artifacts/entry-failure.png', animations: 'disabled' }).catch(() => {});
  await writeFile('artifacts/entry-report.json', JSON.stringify({ checks, layouts, errors, failures, error: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
