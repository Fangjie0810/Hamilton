import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { instrumentMusic, musicState } from './music-test-helpers.mjs';
const { chromium } = await import(process.env.HAMILTON_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const checks = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
await instrumentMusic(page);
await page.addInitScript(() => {
  localStorage.setItem('project-hamilton:3d-quality:v1', 'low');
  window.__filmVolumes = []; window.__filmStops = [];
  const descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
  Object.defineProperty(HTMLMediaElement.prototype, 'volume', { ...descriptor, set(value) {
    descriptor.set.call(this, value);
    if (this instanceof HTMLVideoElement) window.__filmVolumes.push({ volume: this.volume, remaining: this.duration - this.currentTime });
  } });
  const pause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function () {
    if (this instanceof HTMLVideoElement) window.__filmStops.push(this.volume);
    return pause.call(this);
  };
});
const expected = ['双语 · 中文主字幕', 'Bilingual · English first', '中文', 'English'];
const level = () => page.locator('.opening-film-video').evaluate(video => ({ volume: video.volume, paused: video.paused, muted: video.muted, time: video.currentTime }));
const range = () => page.locator('#opening-film-volume');
async function setVolume(value) {
  await range().evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  assert.equal(await page.locator('.opening-film-volume output').innerText(), `${value}%`);
}
try {
  await mkdir('artifacts/film-volume', { recursive: true });
  for (const [index, mode] of ['dual', 'en', 'zh', 'dual-en'].entries()) {
    await page.goto(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1784/');
    await page.locator(`.entry-language[data-language="${mode}"]`).click();
    assert.deepEqual(await page.locator('.entry-language').allTextContents(), expected);
    assert.deepEqual(await page.locator('.entry-language').evaluateAll(nodes => nodes.map(node => node.lang)), ['zh-CN', 'en', 'zh-CN', 'en']);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.entry-settings-trigger').click();
    assert.deepEqual(await page.locator('#entry-settings-language option').allTextContents(), expected);
    assert.equal(await page.locator('#entry-settings-language').inputValue(), mode);
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `artifacts/film-volume/entry-${mode}.png` });
    await page.locator('.entry-begin').click();
    await range().waitFor();
    await page.waitForFunction(() => document.querySelector('video')?.currentTime > .15);
    assert.equal((await level()).volume, index === 0 ? .6 : .27, 'default 60% or saved film volume');
    assert.equal(await range().inputValue(), index === 0 ? '60' : '27');
    const bgm = (await musicState(page))[0].volume;
    await page.locator('.opening-film-pause').click();
    await page.waitForFunction(() => document.querySelector('video').paused);
    const paused = await level();
    await setVolume(27);
    assert.equal((await level()).volume, .27); assert.equal((await level()).time, paused.time);
    await range().focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await range().inputValue(), '28'); assert.equal((await level()).volume, .28);
    assert.ok((await level()).paused, 'keyboard adjustment cannot resume playback');
    await page.keyboard.press('Tab'); assert.ok(await page.locator('.opening-film-skip').evaluate(node => node === document.activeElement));
    await page.keyboard.press('Shift+Tab'); assert.ok(await range().evaluate(node => node === document.activeElement));
    await setVolume(0); assert.equal((await level()).volume, 0); assert.equal((await level()).muted, false);
    await setVolume(27);
    await page.locator('.opening-film-mute').click(); assert.ok((await level()).muted);
    await page.locator('.opening-film-mute').click(); assert.equal((await level()).muted, false); assert.equal((await level()).volume, .27);
    assert.ok(await page.locator('.opening-film-controls').evaluate(node => {
      const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    }));
    await page.screenshot({ path: `artifacts/film-volume/film-${mode}-mobile.png` });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('.opening-film-pause').click();
    await page.waitForFunction(() => !document.querySelector('video').paused);
    await page.waitForFunction(() => window.__musicMedia[0].volume === 1);
    assert.equal((await musicState(page))[0].volume, bgm, 'film volume does not change the separate music level');
    await page.screenshot({ path: `artifacts/film-volume/film-${mode}-desktop.png` });
    if (index === 0) {
      await page.locator('.d3-canvas[data-frame-ready=true]').waitFor({ timeout: 60000 });
      await page.locator('video').evaluate(video => { video.currentTime = video.duration - .9; });
      await page.locator('.d3-canvas[data-ready=true]').waitFor({ timeout: 30000 });
      const tail = await page.evaluate(() => window.__filmVolumes.filter(sample => sample.remaining >= 0 && sample.remaining <= 1));
      assert.ok(tail.length > 2 && tail.some(sample => sample.volume > 0 && sample.volume < .2));
      assert.ok(tail.every(sample => sample.volume <= .27), 'tail fade never raises the selected volume');
      checks.push('real movie ending scales the fade by personal volume and reveals the prepared chapter');
    } else {
      const cursor = await page.evaluate(() => window.__filmVolumes.length);
      await page.locator('.opening-film-skip').click();
      await page.locator('.d3-canvas[data-ready=true]').waitFor({ timeout: 60000 });
      const skipped = await page.evaluate(cursor => ({ volumes: window.__filmVolumes.slice(cursor), stops: window.__filmStops }), cursor);
      assert.ok(skipped.volumes.some(sample => sample.volume > 0 && sample.volume < .27));
      assert.equal(skipped.stops.at(-1), 0, 'skip pauses only after volume reaches zero');
    }
    assert.equal(await page.locator('.opening-film').count(), 0);
    await page.keyboard.press('Escape'); await page.locator('.d3-settings[open]').waitFor();
    assert.deepEqual(await page.locator('#d3-language option').allTextContents(), expected);
    checks.push(`${mode}: language autonyms, 390px/desktop film control, saved volume, keyboard, mute, zero, pause, independent BGM`);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  errors.push(String(error)); await page.screenshot({ path: 'artifacts/film-volume/failure.png' }); throw error;
} finally {
  await writeFile('artifacts/film-volume/report.json', JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
