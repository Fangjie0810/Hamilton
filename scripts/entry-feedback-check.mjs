import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { instrumentMusic } from './music-test-helpers.mjs';

const { chromium } = await import(pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await instrumentMusic(page);
await page.addInitScript(() => localStorage.setItem('project-hamilton:3d-quality:v1', 'low'));
try {
  await mkdir('artifacts/intro-review', { recursive: true });
  await page.goto(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/');
  await page.locator('.entry-begin').waitFor();
  await page.evaluate(() => {
    document.querySelector('.entry-begin').addEventListener('click', () => {
      window.__feedbackSample = new Promise(resolve => setTimeout(() => {
        const button = document.querySelector('.entry-begin');
        resolve({ scale: new DOMMatrix(getComputedStyle(button).transform).a, shadow: getComputedStyle(button).boxShadow, filmOpacity: getComputedStyle(document.querySelector('.opening-film')).opacity });
        window.dispatchEvent(new Event('blur'));
      }, 700));
    }, { once: true, capture: true });
  });
  await page.locator('.entry-begin').click();
  const feedback = await page.evaluate(() => window.__feedbackSample);
  assert.ok(feedback.scale > 1.03 && feedback.shadow !== 'none');
  assert.equal(feedback.filmOpacity, '0');
  await page.screenshot({ path: 'artifacts/intro-review/entry-click-feedback.png' });
  // Even programmatic duplicate activation cannot replay the cue or create another film.
  await page.locator('.entry-begin').evaluate(node => node.click());
  assert.equal(await page.locator('.opening-film').count(), 1);
  assert.equal(await page.evaluate(() => window.__musicStarts.length), 1);
  await page.locator('.opening-film[data-phase="film"]').waitFor();
  const video = page.locator('.opening-film-video');
  assert.ok(await video.evaluate(node => node.paused && node.currentTime === 0), 'leaving during the feedback cannot start hidden film playback');
  assert.ok(await page.locator('.opening-film-status').isVisible());
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.locator('.opening-film-pause').click();
  await page.waitForFunction(() => document.querySelector('video').currentTime > .25);
  await page.locator('.opening-film-skip').click();
  await page.locator('.d3-canvas[data-ready="true"]').waitFor({ timeout: 60000 });
  assert.equal(await page.locator('.opening-film').count(), 0);
  assert.equal(await page.locator('.s3-compass').isVisible(), false);
  assert.ok(await page.locator('#app').evaluate(node => !node.inert));
  assert.deepEqual(errors, []);
  await writeFile('artifacts/intro-review/entry-feedback-focus.json', JSON.stringify({ passed: true, feedback, checks: ['large click feedback', 'single audio cue and film', 'blur during delay stays paused at first frame', 'resume and skip clean up', 'prologue compass hidden'], errors }, null, 2));
  console.log('PASS entry feedback, duplicate activation, delayed focus pause, resume, skip and prologue visibility');
} finally { await browser.close(); }
