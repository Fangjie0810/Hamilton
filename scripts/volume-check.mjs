import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.HAMILTON_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  localStorage.setItem('project-hamilton:3d-quality:v1', 'low');
  localStorage.setItem('project-hamilton:3d-text-speed:v1', '0');
  window.__volumeMedia = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (this instanceof HTMLAudioElement && !window.__volumeMedia.includes(this)) window.__volumeMedia.push(this);
    return play.call(this);
  };
});
const slider = channel => page.locator(`[data-volume-channel=${channel}]`);
async function setVolume(channel, value) {
  await slider(channel).fill(String(value));
  assert.equal(await slider(channel).locator('..').locator('output').textContent(), `${value}%`);
}
async function audioState() {
  return page.evaluate(() => window.__volumeMedia.filter(media => media.getAttribute('src')).map(media => ({ channel: media.src.includes('/bgm/') ? 'music' : 'voiceover', src: media.src, volume: media.volume, time: media.currentTime, paused: media.paused })));
}
async function layouts(prefix, languageSelector) {
  for (const language of ['zh', 'en', 'dual-en', 'dual']) {
    await page.locator(languageSelector).selectOption(language);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const channel of ['music', 'voiceover']) {
        await slider(channel).scrollIntoViewIfNeeded();
        assert.ok(await slider(channel).evaluate(node => {
          const r = node.closest('label').getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth && node.getBoundingClientRect().width >= 80;
        }), `${prefix} ${language} ${width}: accessible slider fits`);
      }
      await page.screenshot({ path: `artifacts/volume-${prefix}-${language}-${width}.png` });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}
try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/');
  await page.locator('.entry-settings-trigger').click();
  assert.equal(await slider('music').inputValue(), '60'); assert.equal(await slider('voiceover').inputValue(), '100');
  await setVolume('music', 20); await setVolume('voiceover', 65);
  await slider('music').focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await slider('music').inputValue(), '21');
  await setVolume('music', 20);
  await layouts('entry', '#entry-settings-language');
  await page.reload(); await page.locator('.entry-settings-trigger').click();
  assert.equal(await slider('music').inputValue(), '20'); assert.equal(await slider('voiceover').inputValue(), '65');
  await page.locator('.entry-settings .entry-dialog-close').click(); await page.locator('.entry-begin').click();
  await page.locator('.opening-film-skip').click();
  await page.locator('.d3-canvas[data-ready=true]').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => window.__volumeMedia.some(media => media.src.includes('/bgm/') && !media.paused));
  assert.equal((await audioState())[0].volume, .2);
  await page.locator('.d3-place[data-point="opening-letter"]').click();
  await page.locator('.s3-dialogue:not([hidden])').waitFor({ timeout: 20000 });
  await page.waitForFunction(() => window.__volumeMedia.some(media => media.src.includes('/audio/en/') && media.currentTime > .1 && !media.paused));
  assert.equal((await audioState()).find(media => media.channel === 'voiceover').volume, .65);
  await page.keyboard.press('Escape'); await page.locator('.d3-settings[open]').waitFor();
  await page.waitForFunction(() => window.__volumeMedia.filter(media => media.getAttribute('src')).every(media => media.paused));
  const before = await audioState(); assert.ok(before.every(media => media.paused));
  await setVolume('music', 0); await setVolume('voiceover', 40);
  let state = await audioState();
  assert.equal(state.find(media => media.channel === 'music').volume, 0);
  assert.equal(state.find(media => media.channel === 'voiceover').volume, .4);
  assert.equal(await page.locator('[data-music-toggle]').count(), 0, 'volume is the sole music mute control');
  await setVolume('music', 80);
  await layouts('story', '#d3-language');
  state = await audioState();
  for (const media of state) {
    assert.equal(media.src, before.find(item => item.channel === media.channel).src);
    assert.equal(media.time, before.find(item => item.channel === media.channel).time);
    assert.ok(media.paused, 'volume and language adjustments do not resume playback');
  }
  await page.locator('.d3-settings .d3-primary').click();
  await page.waitForFunction(() => window.__volumeMedia.filter(media => media.getAttribute('src')).every(media => !media.paused));
  await page.locator('.s3-dialogue').focus(); await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__volumeMedia.filter(media => media.src.includes('/audio/en/')).some(media => media.volume === .4 && !media.paused));
  await page.keyboard.press('Escape'); await page.locator('.d3-settings[open]').waitFor();
  assert.equal(await slider('music').inputValue(), '80'); assert.equal(await slider('voiceover').inputValue(), '40');
  await page.reload(); await page.locator('.d3-canvas[data-ready=true]').waitFor({ timeout: 60000 });
  await page.keyboard.press('Escape'); await page.locator('.d3-settings[open]').waitFor();
  assert.equal(await slider('music').inputValue(), '80'); assert.equal(await slider('voiceover').inputValue(), '40');
  checks.push('independent volume defaults, input and keyboard controls', 'persistent title and story settings', 'actual BGM and dialogue media volume', 'zero volume preserves toggle; pause and playhead preserved', 'next dialogue inherits voice volume', 'zh/en/dual/dual-en desktop and narrow layouts');
  assert.deepEqual(errors, []);
  await writeFile('artifacts/volume-check.json', JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: 'artifacts/volume-failure.png' }); throw error;
} finally { await browser.close(); }
