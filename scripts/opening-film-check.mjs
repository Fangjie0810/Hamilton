import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.HAMILTON_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const base = process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/';
const checks = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir('artifacts/intro-review', { recursive: true });
async function entry(language = 'dual', reduced = false) {
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto(base);
  await page.evaluate(({ language, reduced }) => {
    localStorage.setItem('project-hamilton:3d-quality:v1', 'low');
    localStorage.setItem('project-hamilton:3d-text-speed:v1', '0');
  }, { language, reduced });
  await page.reload();
  await page.locator(`.entry-language[data-language=${language}]`).click();
}
async function begin() {
  await page.evaluate(() => {
    window.__entryDocument = document;
    window.__entryTiming = { clicked: 0, phases: {}, media: [] };
    document.querySelector('.entry-begin').addEventListener('click', () => { window.__entryTiming.clicked = performance.now(); }, { capture: true, once: true });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.__entryTiming.media.push({ kind: this.tagName, src: this.src, volume: this.volume, at: performance.now() });
      return play.call(this);
    };
    const observe = new MutationObserver(() => {
      const film = document.querySelector('.opening-film'), phase = film?.dataset.phase;
      if (phase && !(phase in window.__entryTiming.phases)) window.__entryTiming.phases[phase] = performance.now();
    });
    observe.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-phase'] });
  });
  await page.locator('.entry-begin').click();
  assert.ok(await page.locator('.entry-begin').evaluate(node => node.classList.contains('is-starting') && node.getAttribute('aria-disabled') === 'true'));
  assert.equal(await page.locator('.opening-film').evaluate(node => getComputedStyle(node).opacity), '0', 'button feedback retains the title page');
  await page.locator('.opening-film[data-phase="film"]').waitFor();
  const timing = await page.evaluate(() => window.__entryTiming);
  assert.ok(timing.phases.covering - timing.clicked >= 1990, 'the title remains for two seconds before fading');
  assert.ok(timing.phases.film > timing.phases.covering + 200, 'a real fade separates feedback and film');
  const music = timing.media.find(media => media.kind === 'AUDIO' && media.src.includes('/audio/bgm/'));
  assert.ok(music && music.at - timing.clicked < 150, 'existing journey audio starts inside the click');
  assert.ok(timing.media.filter(media => media.kind === 'VIDEO' && media.at < timing.phases.covering).every(media => media.volume === 0), 'video activation cannot add a second audible click');
  await writeFile('artifacts/intro-review/entry-feedback-timing.json', JSON.stringify(timing, null, 2));
  assert.ok(await page.evaluate(() => window.__entryDocument === document), 'same document');
}
async function filmSize() {
  const size = await page.locator('.opening-film-video').evaluate(video => {
    const r = video.getBoundingClientRect();
    return { width: r.width / innerWidth, height: r.height / innerHeight, x: (r.x + r.width / 2) / innerWidth, y: (r.y + r.height / 2) / innerHeight, background: getComputedStyle(video.parentElement).backgroundColor };
  });
  assert.deepEqual(size, { width: .5, height: .5, x: .5, y: .5, background: 'rgb(0, 0, 0)' }, 'film is half-size, centred, with a black surround');
}
async function ready() {
  await page.locator('.d3-canvas[data-ready=true]').waitFor({ timeout: 60000 });
  assert.equal(await page.locator('.opening-film').count(), 0);
  assert.ok(await page.evaluate(() => !document.querySelector('#app').inert));
  assert.equal(await page.locator('.d3-settings[open]').count(), 0, 'no phantom pause menu');
}
try {
  await entry(); await begin();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > 1);
  const media = await page.locator('video').evaluate(v => ({ duration: v.duration, width: v.videoWidth, height: v.videoHeight, muted: v.muted }));
  assert.deepEqual(media, { duration: 57.2, width: 1280, height: 720, muted: false });
  await filmSize();
  await page.locator('.d3-canvas[data-frame-ready=true]').waitFor({ timeout: 60000 });
  assert.equal(await page.locator('.d3-canvas').getAttribute('data-ready'), 'false', 'world is rendered but not playable');
  const pos = await page.locator('.d3-canvas').getAttribute('data-x');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(300); await page.keyboard.up('KeyW');
  assert.equal(await page.locator('.d3-canvas').getAttribute('data-x'), pos);
  await page.locator('.opening-film-pause').click();
  const pausedAt = await page.locator('video').evaluate(v => v.currentTime);
  await page.waitForTimeout(400);
  assert.equal(await page.locator('video').evaluate(v => v.currentTime), pausedAt);
  for (const language of ['zh', 'en', 'dual-en', 'dual']) {
    await page.evaluate(async language => (await import('/src/i18n/text.ts')).setLanguage(language), language);
    assert.equal(await page.locator('video').evaluate(v => v.currentTime), pausedAt, 'language retains film position');
    if (language === 'en') assert.ok(!/\p{Script=Han}/u.test(await page.locator('.opening-film').innerText()));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await filmSize();
    assert.ok(await page.locator('.opening-film-controls').evaluate(node => {
      const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    }));
  }
  await page.screenshot({ path: 'artifacts/intro-review/film-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.opening-film-mute').click();
  assert.ok(await page.locator('video').evaluate(v => v.muted));
  await page.locator('.opening-film-mute').click();
  await page.locator('.opening-film-pause').click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert.ok(await page.locator('video').evaluate(v => v.paused));
  await page.locator('.opening-film-pause').click();
  await page.screenshot({ path: 'artifacts/intro-review/film-desktop.png' });
  checks.push('existing click audio and large button feedback; two-second hold before fade', 'half-size centred CG with black surround on desktop and mobile', 'real compressed 720p audio playback', 'same document', 'scene warms but cannot move', 'pause/resume and mute', 'blur pauses without game settings', 'four subtitle modes retain media time', 'bilingual narrow controls fit');
  console.log('PASS controls; watching the full cut through the real ending event…');
  await page.locator('.opening-film[data-phase=chapter]').waitFor({ timeout: 65000 });
  const tailTime = await page.locator('video').evaluate(v => v.currentTime);
  assert.ok(tailTime >= 49.5 && tailTime < 55, `title replaces black tail: ${tailTime}`);
  await page.waitForTimeout(650);
  await page.screenshot({ path: 'artifacts/intro-review/film-to-chapter.png' });
  await ready();
  await page.screenshot({ path: 'artifacts/intro-review/chapter-to-dock.png' });
  checks.push('natural playback of the entire cut', 'title over existing black tail while original audio continues', 'world reveal only after real ended', 'media and input cleanup');
  // The untouched letter remains playable, and its exit still reaches the first act.
  await page.locator('.d3-place[data-point="opening-letter"]').click();
  await page.locator('.s3-dialogue:not([hidden])').waitFor({ timeout: 20000 });
  checks.push('opening letter remains interactive after film');
  for (let i = 0; i < 3; i++) { await page.locator('.s3-dialogue').focus(); await page.keyboard.press('Space'); }
  await page.locator('.s3-dialogue').waitFor({ state: 'hidden' });
  await page.locator('.d3-place[data-point="story-exit"]').click();
  await page.locator('.d3-chapter-loading[data-chapter="Arrival"]').waitFor({ timeout: 20000 });
  await ready();
  assert.ok((await page.locator('.d3-heading').innerText()).includes('纽约，没有空位'));
  checks.push('letter completes and chapter exit reaches ACT I without replaying CG');

  for (const language of ['zh', 'en', 'dual-en', 'dual']) {
    await entry(language, true); await begin();
    await page.locator('.opening-film-skip').click(); await ready();
  }
  checks.push('immediate skip works before world ready in all four subtitle modes with reduced motion');

  await entry('en', true);
  await page.route('**/video/opening-2026-09-14-web720.mp4', route => route.abort());
  await begin();
  await page.waitForFunction(() => !!document.querySelector('video')?.error);
  await page.locator('.opening-film-skip').click(); await ready();
  await page.unroute('**/video/opening-2026-09-14-web720.mp4');
  checks.push('failed media can skip into the prepared game');

  await entry('dual', true);
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLVideoElement && !window.__filmResumeAllowed) return Promise.reject(new DOMException('Gesture required', 'NotAllowedError'));
      return play.call(this);
    };
    document.addEventListener('click', event => {
      if (event.target instanceof Element && event.target.closest('.opening-film-pause')) window.__filmResumeAllowed = true;
    }, { capture: true });
  });
  await page.reload(); await begin();
  await page.locator('.opening-film-status:not([hidden])').waitFor();
  await page.locator('.opening-film-pause').click();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > .1);
  await page.locator('.opening-film-skip').click(); await ready();
  checks.push('autoplay denial recovers on explicit resume');
  assert.deepEqual(errors, []);
  console.log(`PASS opening film: ${checks.join('; ')}`);
} catch (error) {
  await page.screenshot({ path: 'artifacts/intro-review/failure.png' });
  errors.push(String(error)); throw error;
} finally {
  await writeFile('artifacts/intro-review/browser-report.json', JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
