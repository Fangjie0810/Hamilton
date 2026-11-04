import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { instrumentMusic, expectSong, expectMusicPaused, musicState, checkMusicTiming } from './music-test-helpers.mjs';

const { chromium } = await import(process.env.HAMILTON_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const checks = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
await instrumentMusic(page);
await page.addInitScript(() => {
  localStorage.setItem('project-hamilton:3d-quality:v1', 'low');
  localStorage.setItem('project-hamilton:3d-text-speed:v1', '0');
});
try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/');
  assert.deepEqual(await musicState(page), [], 'title screen is silent');
  await page.locator('.entry-begin').click(); await expectSong(page, 'alexander-hamilton');
  await page.waitForFunction(() => window.__musicMedia[0].currentTime > .3);
  const beforePause = await page.evaluate(() => ({ volume: window.__musicMedia[0].volume, writes: window.__musicVolumeWrites.length, stops: window.__musicStops.length }));
  await page.locator('.opening-film-pause').click();
  await expectMusicPaused(page);
  // Record native volume writes synchronously: a busy browser can finish the tail
  // before Playwright's next animation-frame poll observes an intermediate value.
  const pauseFade = await page.evaluate(before => ({ writes: window.__musicVolumeWrites.slice(before.writes), stops: window.__musicStops.slice(before.stops) }), beforePause);
  assert.ok(pauseFade.writes.some(sample => sample.volume > 0 && sample.volume < beforePause.volume), 'film pause applies an intermediate audible volume');
  assert.ok(pauseFade.writes.every((sample, index, samples) => sample.volume <= (index ? samples[index - 1].volume : beforePause.volume)), 'film pause gradually lowers the native audio volume');
  assert.equal(pauseFade.writes.at(-1).volume, 0, 'film pause reaches zero before pausing');
  assert.equal(pauseFade.stops.at(-1).volume, 0, 'native pause occurs only after the fade reaches zero');
  let state = (await musicState(page))[0]; assert.ok(state.paused);
  await page.waitForTimeout(250); assert.equal((await musicState(page))[0].time, state.time);
  await page.locator('.opening-film-pause').click(); await expectSong(page, 'alexander-hamilton');
  await page.locator('.opening-film-mute').click(); assert.ok((await musicState(page))[0].muted);
  await page.locator('.opening-film-mute').click();
  const beforeSkip = (await musicState(page))[0].time;
  await page.locator('.opening-film-skip').click();
  await page.locator('.d3-canvas[data-ready=true]').waitFor({ timeout: 60000 });
  await expectSong(page, 'alexander-hamilton'); assert.ok((await musicState(page))[0].time >= beforeSkip);
  checks.push('Begin starts real MP3; film pause/mute work; skip and curtain preserve position');
  await page.keyboard.press('Escape');
  await page.locator('.d3-settings[open]').waitFor();
  await expectMusicPaused(page);
  state = (await musicState(page))[0]; assert.ok(state.paused);
  for (const language of ['zh', 'en', 'dual-en', 'dual']) {
    await page.locator('#d3-language').selectOption(language);
    await page.setViewportSize({ width: 390, height: 844 });
    const volume = page.locator('[data-volume-channel=music]'); await volume.scrollIntoViewIfNeeded();
    assert.ok(await volume.isVisible());
    assert.equal((await musicState(page))[0].time, state.time);
    await page.screenshot({ path: `artifacts/music-settings-${language}.png` });
  }
  await page.locator('[data-volume-channel=music]').fill('0'); await page.locator('[data-volume-channel=music]').dispatchEvent('input');
  await page.locator('[data-volume-channel=music]').fill('100'); await page.locator('[data-volume-channel=music]').dispatchEvent('input');
  assert.ok((await musicState(page))[0].paused, 'volume cannot resume behind pause modal');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.d3-settings .d3-primary').click(); await expectSong(page, 'alexander-hamilton');
  // Verify native loop using the actual decoder and end of the MP3.
  await page.evaluate(() => { const media = window.__musicMedia[0]; media.currentTime = media.duration - .3; });
  await page.waitForFunction(() => window.__musicMedia[0].currentTime < 3 && !window.__musicMedia[0].paused, undefined, { timeout: 10000 });
  checks.push('pause/preferences/languages retain playhead; native MP3 loops at its end');
  await page.keyboard.press('Escape'); await page.locator('.s3-restart').click();
  await page.locator('.d3-canvas[data-ready=true]').waitFor(); await expectSong(page, 'alexander-hamilton');
  assert.ok((await musicState(page))[0].time < 3, 'restart starts at zero');
  await page.locator('.d3-place[data-point="opening-letter"]').click();
  await page.locator('.s3-dialogue:not([hidden])').waitFor({ timeout: 20000 });
  for (let i = 0; i < 3; i++) { await page.locator('.s3-dialogue').focus(); await page.keyboard.press('Space'); }
  await page.locator('.d3-place[data-point="story-exit"]').click();
  await page.locator('.d3-chapter-loading[data-chapter=Arrival]').waitFor({ timeout: 20000 });
  await expectMusicPaused(page); assert.ok((await musicState(page))[0].paused);
  await page.locator('.d3-canvas[data-ready=true]').waitFor(); await expectSong(page, 'aaron-burr-sir');
  const timing = await checkMusicTiming(page);
  await page.evaluate(() => {
    window.__returnMusicStart = performance.now();
    window.addEventListener('pagehide', () => sessionStorage.setItem('return-music-check', JSON.stringify({
      elapsed: performance.now() - window.__returnMusicStart, stops: window.__musicStops,
    })), { once: true });
  });
  await page.locator('.d3-actions .d3-back').click();
  await page.locator('.entry-begin').waitFor();
  const returning = await page.evaluate(() => JSON.parse(sessionStorage.getItem('return-music-check')));
  assert.ok(returning.elapsed >= 500, 'return title waits for the audible tail instead of unloading immediately');
  assert.equal(returning.stops.at(-1).volume, 0, 'return title pauses only at the end of the fade');
  checks.push('active-game return to title waits for the real fade before navigating');
  assert.deepEqual(errors, []);
  checks.push('restart resets track; Arrival pauses prologue and starts only after curtain removal');
  await writeFile('artifacts/music-check.json', JSON.stringify({ checks, pauseFade, timing, returning, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally { await browser.close(); }
