import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.HAMILTON_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE).href : 'playwright');
const expected = JSON.parse(await readFile('docs/voiceover/0.4.0-new-dialogue-pending.json', 'utf8')).clips;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errors = [], failures = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(response.url()); });
await page.addInitScript(() => {
  localStorage.setItem('project-hamilton:music-volume:v1', '0');
  window.__newspaperMedia = []; window.__newspaperStarts = []; window.__newspaperEnded = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (this.src.includes('/audio/en/')) {
      if (!window.__newspaperMedia.includes(this)) {
        window.__newspaperMedia.push(this);
        const source = this.src;
        // The production player releases and clears src inside its ended handler.
        this.addEventListener('ended', () => window.__newspaperEnded.push(source), { once: true });
      }
      window.__newspaperStarts.push(this.src);
    }
    return play.call(this);
  };
});
try {
  await page.goto(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/');
  await page.locator('.entry-settings-trigger').click();
  await page.evaluate(async () => {
    const { StoryUI } = await import('/src/story3d/StoryUI.ts');
    const { chapters } = await import('/src/data/chapters.ts');
    const { discoveries } = await import('/src/data/discoveries.ts');
    const { smallTalk, newsboyThanks } = await import('/src/data/smallTalk.ts');
    const { initialGameState } = await import('/src/core/GameState.ts');
    const { music } = await import('/src/ui/music.ts');
    music.stop();
    document.querySelector('#app').replaceChildren();
    window.__newspaperUi = new StoryUI(document.querySelector('#app'));
    // Use the exact player owned by this production presentation, including Vite's
    // timestamped modules when a development server has already processed HMR.
    const voiceover = window.__newspaperUi.dialoguePresentation.voice;
    voiceover.setEnabled(true); voiceover.setVolume(1);
    window.__newspaperUi.textSpeed = 0;
    window.__newspaperUi.showChapter(chapters.Arrival, 1, initialGameState());
    window.__newspaperVoice = voiceover;
    window.__newspaperLines = [discoveries.find(d => d.id === 'arrival-scattered-paper').lines[0], newsboyThanks, smallTalk.newsboy];
    let last = performance.now();
    const tick = now => { window.__newspaperUi.update(now - last); last = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.keyboard.press('Shift');
  for (let index = 0; index < expected.length; index++) {
    const clip = expected[index];
    await page.evaluate(index => {
      const line = window.__newspaperLines[index];
      window.__newspaperUi.showLine(line, () => {}, true, undefined, line.speaker === 'newsboy' ? 'hamilton' : 'newsboy');
    }, index);
    await page.waitForFunction(src => window.__newspaperMedia.some(m => m.src.endsWith(src) && !m.paused && m.currentTime > .08 && m.volume === 1), clip.src, { timeout: 12000 });
    const starts = await page.evaluate(() => window.__newspaperStarts.length);
    const chosen = await page.evaluate(() => window.__newspaperVoice.currentCue);
    assert.ok(chosen.src.endsWith(clip.src)); assert.equal(chosen.speaker, clip.speaker);
    for (const mode of ['en', 'dual-en', 'zh', 'dual']) await page.evaluate(async mode => (await import('/src/i18n/text.ts')).setLanguage(mode), mode);
    assert.equal(await page.evaluate(() => window.__newspaperStarts.length), starts, 'language changes do not replay a new recording');
    await page.evaluate(() => window.__newspaperVoice.setPaused('verification', true));
    const held = await page.evaluate(() => window.__newspaperMedia.at(-1).currentTime);
    await page.waitForTimeout(140);
    assert.equal(await page.evaluate(() => window.__newspaperMedia.at(-1).currentTime), held);
    await page.evaluate(() => window.__newspaperVoice.setPaused('verification', false));
    await page.waitForFunction(src => window.__newspaperEnded.some(value => value.endsWith(src)), clip.src, { timeout: 20000 });
    checks.push({ speaker: clip.speaker, src: clip.src, decodedAndPlayedToEnd: true, languageAndPausePreserved: true });
    console.log(`PASS ${clip.speaker}: ${clip.src}`);
    await page.evaluate(() => window.__newspaperUi.clearDialogue());
  }
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  await mkdir('artifacts', { recursive: true });
  await writeFile('docs/voiceover/0.4.1-newspaper-browser-verification.json', JSON.stringify({ passed: true, checks, errors, failures }, null, 2) + '\n');
  console.log('PASS all 3 new newspaper clips: exact speaker/text lookup, real MP3 playback to end, subtitle switching and pause/resume');
} finally { await browser.close(); }
