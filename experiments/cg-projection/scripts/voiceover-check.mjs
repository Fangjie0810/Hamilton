import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
await context.addInitScript(() => {
  window.__voiceMedia = []; window.__voiceStarts = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (!window.__voiceMedia.includes(this)) window.__voiceMedia.push(this);
    window.__voiceStarts.push(this.src);
    return play.call(this);
  };
});
const page = await context.newPage();
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
const base = process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/';
const media = () => page.evaluate(() => window.__voiceMedia.map(m => ({ src: m.src, paused: m.paused, time: m.currentTime, ended: m.ended })));
const audible = () => page.waitForFunction(() => window.__voiceMedia.some(m => !m.paused && m.currentTime > .05), undefined, { timeout: 10000 });
const quiet = async () => assert.ok((await media()).every(m => m.paused), 'all voices paused');
try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(base); await page.locator('.entry-settings-trigger').click();
  assert.equal(await page.locator('#entry-voiceover').isChecked(), true);
  await page.locator('#entry-voiceover').uncheck(); await page.reload();
  await page.locator('.entry-settings-trigger').click(); assert.equal(await page.locator('#entry-voiceover').isChecked(), false);
  for (const language of ['zh', 'en', 'dual']) {
    await page.locator('#entry-settings-language').selectOption(language);
    await page.setViewportSize({ width: 800, height: 600 });
    const layout = await page.locator('#entry-voiceover').evaluate(node => {
      const row = node.closest('label').getBoundingClientRect(), dialog = node.closest('dialog').getBoundingClientRect();
      return row.left >= dialog.left && row.right <= dialog.right && row.width > 100;
    });
    assert.ok(layout, `voice setting fits ${language}`);
  }
  await page.locator('#entry-voiceover').check(); await page.locator('#entry-settings-motion').check();
  await page.locator('#entry-settings-quality').selectOption('low'); await page.locator('#entry-settings-speed').selectOption('0');
  await page.screenshot({ path: 'artifacts/voiceover-settings-entry.png' });
  await page.goto(new URL('?story=2d&debug=1', base).href);
  await page.locator('.d3-canvas[data-ready=true][data-mode=story]').waitFor({ timeout: 60000 });
  assert.equal(new URL(page.url()).searchParams.get('story'), '3d');
  await page.keyboard.press('Shift'); await quiet();
  await page.keyboard.press('Escape'); await page.locator('.d3-settings[open]').waitFor(); await quiet();
  const held = (await media()).filter(m => m.src);
  await page.waitForTimeout(250); assert.deepEqual((await media()).filter(m => m.src), held);
  const starts = await page.evaluate(() => window.__voiceStarts.length);
  for (const language of ['zh', 'en', 'dual']) await page.locator('#d3-language').selectOption(language);
  assert.equal(await page.evaluate(() => window.__voiceStarts.length), starts, 'subtitle changes do not restart audio');
  await page.locator('#d3-voiceover').uncheck(); await page.locator('.d3-settings .d3-primary').click(); await quiet();
  await page.keyboard.press('Escape'); await page.locator('#d3-voiceover').check(); await quiet();
  await page.screenshot({ path: 'artifacts/voiceover-settings-story.png' });
  await page.locator('.d3-settings .d3-primary').click(); await quiet();
  await page.keyboard.press('Escape'); await page.locator('.s3-restart').click();
  await page.locator('.d3-canvas[data-ready=true]').waitFor({ timeout: 60000 });
  assert.ok((await media()).filter(m => !m.paused).length <= 1, 'restart has no overlapping old voice');
  checks.push('entry preference persistence and three-language small-window layout', 'retired 2D bookmark opens 3D', 'chapter title stays silent through settings, toggle and restart', 'subtitle mode never restarts speech');

  // Browser component fixtures use the production UI/player and real MP3 decoding.
  // The separate story3d-check covers physical traversal and committed game results.
  await page.goto(base); await page.locator('.entry-screen').waitFor();
  await page.keyboard.press('Shift');
  await page.evaluate(async () => {
    const { StoryUI } = await import('/src/story3d/StoryUI.ts');
    window.__voices = (await import('/src/ui/voiceover.ts')).voiceover;
    const { chapters } = await import('/src/data/chapters.ts');
    const { initialGameState } = await import('/src/core/GameState.ts');
    document.querySelector('#app').replaceChildren();
    const ui = window.__ui = new StoryUI(document.querySelector('#app'));
    ui.textSpeed = 0; ui.showChapter(chapters.Opening, 0, initialGameState());
    const lines = chapters.Opening.interactions[0].lines;
    ui.showLine(lines[0], () => ui.showLine(lines[1], () => {}));
  });
  await audible();
  assert.ok((await page.evaluate(() => window.__voiceStarts.at(-1))).includes('/narrator-'), 'George speaks genuine dialogue');
  await page.evaluate(() => window.__voices.setPaused('fixture-settings', true)); await quiet();
  const pausedDialogue = await media(); await page.waitForTimeout(150); assert.deepEqual(await media(), pausedDialogue);
  await page.evaluate(() => { window.__voices.setEnabled(false); window.__voices.setPaused('fixture-settings', false); }); await quiet();
  await page.evaluate(() => window.__voices.setEnabled(true)); await audible();
  await page.locator('.s3-advance').click(); await audible();
  assert.equal((await media()).filter(m => !m.paused).length, 1);
  await page.evaluate(() => window.__ui.clear()); await quiet();
  checks.push('actual dialogue advance replaces audio and clearing stops it');
  await page.evaluate(async () => {
    const { chapters } = await import('/src/data/chapters.ts');
    const { initialGameState } = await import('/src/core/GameState.ts');
    window.__ui.showChoice(chapters.Tavern.interactions[0].choice, initialGameState(), () => {}, 10000);
  });
  await quiet();
  await page.keyboard.press('Shift'); await quiet();
  await page.evaluate(() => { window.__ui.updateChoiceTime(10000); });
  assert.equal(await page.locator('.s3-dialogue').getAttribute('data-remaining'), '10000');
  await page.evaluate(() => window.__ui.clear()); await quiet();
  checks.push('tavern choice prompt stays silent and keeps its response timer');

  // All newly cast supporting characters use their own generated MP3s.
  for (const speaker of ['newsboy', 'citizen', 'loyalist']) {
    await page.evaluate(async speaker => {
      const { chapters } = await import('/src/data/chapters.ts');
      const line = chapters.Arrival.interactions.flatMap(i => i.lines).find(l => l.speaker === speaker);
      window.__ui.showLine(line, () => {});
    }, speaker);
    await audible();
    assert.ok((await page.evaluate(() => window.__voiceStarts.at(-1))).includes(`/${speaker}-`));
    await page.evaluate(() => window.__ui.clear()); await quiet();
  }
  checks.push('newsboy, citizen and loyalist play their own real generated MP3s');
  const outsideDialogueStarts = await page.evaluate(() => window.__voiceStarts.length);

  await page.evaluate(async () => {
    const { DebateActivity } = await import('/src/ui/DebateActivity.ts');
    window.__activity = new DebateActivity(() => false, () => {});
  });
  await audible();
  assert.ok((await page.evaluate(() => window.__voiceStarts.at(-1))).includes('/loyalist-'), 'debate argument uses Daniel');
  await page.locator('.activity-overlay .primary').click(); await quiet();
  await page.locator('[data-response=FACT]').click();
  await page.evaluate(() => { window.__activity.update(100); });
  assert.equal(await page.locator('.activity-overlay').getAttribute('data-phase'), 'beat');
  await page.keyboard.press('Shift'); // A real gesture enables normal audio policy in fixtures.
  await page.locator('.beat-button').click(); await audible();
  assert.ok((await page.evaluate(() => window.__voiceStarts.at(-1))).includes('/hamilton-'), 'selected response uses Hamilton audio');
  await page.evaluate(() => window.__activity.destroy()); await quiet();
  checks.push('debate speaks the selected response in feedback without consuming its beat');

  await page.evaluate(async () => { const { WritingActivity } = await import('/src/ui/WritingActivity.ts'); window.__activity = new WritingActivity(() => false, () => {}); });
  await quiet();
  await page.locator('.activity-overlay .primary').click(); await quiet(); await page.locator('.dispatch-fragment').first().click(); await audible();
  const remaining = await page.locator('.activity-overlay').getAttribute('data-remaining');
  await page.evaluate(() => { for (let i = 0; i < 10; i++) window.__activity.update(100); });
  assert.equal(await page.locator('.activity-overlay').getAttribute('data-remaining'), remaining);
  await page.locator('.dispatch-bin').first().click(); await quiet();
  await page.evaluate(() => window.__activity.update(100));
  assert.equal(Number(await page.locator('.activity-overlay').getAttribute('data-remaining')), Number(remaining) - 100);
  await page.evaluate(() => window.__activity.destroy());
  checks.push('selected dispatch reads in Hamilton voice, holds time, and assignment cancels it');

  await page.evaluate(async () => {
    const { YorktownActivity } = await import('/src/ui/YorktownActivity.ts');
    const activity = window.__activity = new YorktownActivity(() => false, () => {});
  });
  await quiet();
  await page.evaluate(() => {
    const activity = window.__activity; activity.game.phase = 'assault-ready'; activity.refresh();
  });
  await page.locator('.activity-overlay .primary').click(); await audible();
  await page.evaluate(() => { for (let i = 0; i < 5; i++) window.__activity.update(100); });
  assert.equal(await page.locator('.activity-overlay').getAttribute('data-elapsed'), '0');
  await page.locator('.assault-button').first().click(); await quiet();
  assert.equal(await page.locator('.activity-overlay').getAttribute('data-phase'), 'assault', 'skipping a command is not a scored hit');
  await page.evaluate(() => window.__activity.update(100));
  assert.equal(await page.locator('.activity-overlay').getAttribute('data-elapsed'), '100');
  await page.evaluate(() => window.__activity.destroy()); await quiet();
  checks.push('Yorktown reads before beat zero; skip is not scored; destroy stops speech');

  await page.evaluate(async () => {
    const { initialGameState } = await import('/src/core/GameState.ts');
    const state = initialGameState(); state.choices.debate_result = 'won'; state.debatePerformance = 100;
    state.choices.writing_result = '80'; state.choices.yorktown_result = 'complete'; state.yorktownPerformance = 100;
    window.__ui.showEnding(state, () => {}, () => {});
  });
  await quiet(); await page.keyboard.press('Shift'); await quiet();
  const outsideDialogue = await page.evaluate(start => window.__voiceStarts.slice(start), outsideDialogueStarts);
  assert.ok(outsideDialogue.length > 0);
  assert.ok(outsideDialogue.every(src => !src.includes('/narrator-')), 'no George speech outside story dialogue');
  await page.evaluate(() => window.__ui.destroy()); await quiet();
  checks.push('rules, instructions, score feedback and ending never queue George narration');
  assert.deepEqual(errors, []);
  await writeFile('artifacts/voiceover-check.json', JSON.stringify({ checks, errors, realMediaPlayback: true }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: 'artifacts/voiceover-failure.png' }).catch(() => {});
  throw error;
} finally { await browser.close(); }
