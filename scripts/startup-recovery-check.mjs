import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/';
try {
  for (const [route, language] of [['entry', 'zh'], ['direct', 'en']]) {
    const page = await browser.newPage();
    await page.addInitScript(language => localStorage.setItem('project-hamilton:language:v1', language), language);
    await page.route('**/src/demo3d/Demo.ts*', request => request.abort());
    await page.goto(route === 'direct' ? `${base}?story=3d` : base);
    if (route === 'entry') await page.locator('.entry-begin').click();
    const panel = page.locator('.startup-error');
    await panel.waitFor();
    assert.match(await panel.innerText(), language === 'zh' ? /旅程暂时未能启动/ : /The journey could not start/);
    assert.equal(await page.locator('.opening-film').count(), 0);
    assert.ok(await page.locator('#app').evaluate(node => !node.inert));
    assert.equal(new URL(await panel.locator('a').getAttribute('href')).searchParams.has('story'), false);
    await page.unroute('**/src/demo3d/Demo.ts*');
    await panel.locator('a').click();
    await page.locator('.entry-begin').waitFor();
    await page.close();
  }
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.locator('.entry-begin').click();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > 1);
  assert.equal(await page.locator('.opening-film').evaluate(node => node.style.opacity), '1');
  assert.ok(await page.locator('.opening-film-skip').isVisible());
  assert.ok(await page.locator('video').evaluate(node => !node.paused && !node.muted && node.volume > 0));
  await page.locator('.opening-film-skip').click();
  await page.locator('.d3-canvas[data-ready=true]').waitFor({ timeout: 60000 });
  assert.deepEqual(errors, []);
  console.log('PASS: entry/direct module failure remains visible, bilingual retry returns to title, CG plays and skip reaches the game.');
} finally { await browser.close(); }
