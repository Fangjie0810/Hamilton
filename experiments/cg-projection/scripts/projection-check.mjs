import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.HAMILTON_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const base = process.env.HAMILTON_URL ?? 'http://127.0.0.1:1777/';
const out = 'artifacts/projection-review';
await mkdir(out, { recursive: true });
const errors = [], checks = [], geometry = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(base);
  await page.evaluate(() => {
    localStorage.setItem('project-hamilton:3d-quality:v1', 'low');
    localStorage.setItem('project-hamilton:3d-motion:v1', 'false');
    localStorage.setItem('project-hamilton:language:v1', 'dual');
  });
  await page.reload();
  await page.locator('.projection-entry-picker').waitFor();
  await page.screenshot({ path: `${out}/title-picker.png` });
  await page.locator('.entry-begin').click();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > .2);
  await page.locator('.opening-film-pause').click();
  await page.locator('video').evaluate(v => { v.currentTime = 12; window.__projectionVideo = v; });
  await page.waitForFunction(() => !document.querySelector('video').seeking);
  for (const scene of ['crt', 'projector', 'archive']) {
    await page.locator(`.projection-option[data-scene=${scene}]`).click();
    assert.equal(await page.locator('.opening-film').getAttribute('data-scene'), scene);
    assert.ok(await page.evaluate(() => window.__projectionVideo === document.querySelector('video')));
    assert.equal(await page.locator('video').evaluate(v => v.currentTime), 12);
    // Briefly resume so the screenshot shows the actual viewing presentation, without a pause notice.
    await page.locator('.opening-film-pause').click();
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${out}/${scene}-desktop.png` });
    await page.locator('.opening-film-pause').click();
    await page.locator('video').evaluate(v => { v.currentTime = 12; });
    await page.waitForFunction(() => !document.querySelector('video').seeking);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 1024, height: 640 }, { width: 667, height: 375 }]) {
      await page.setViewportSize(viewport);
      // ResizeObserver updates the fixed-size scene on the next rendering frame.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      for (const language of ['zh', 'en', 'dual']) {
        await page.evaluate(async language => (await import('/src/i18n/text.ts')).setLanguage(language), language);
        assert.equal(await page.locator('video').evaluate(v => v.currentTime), 12, 'language/viewport changes retain playback');
        if (language === 'en') assert.ok(!/\p{Script=Han}/u.test(await page.locator('.opening-film').innerText()));
        const bounds = await page.locator('.projection-aperture').evaluate(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, vw: innerWidth, vh: innerHeight }; });
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= bounds.vw && bounds.y + bounds.height <= bounds.vh, `${scene} video fits ${JSON.stringify(bounds)}`);
        assert.ok(bounds.width < viewport.width * .9, 'video remains inset');
        const controls = await page.locator('.opening-film-controls button').evaluateAll(nodes => nodes.every(n => { const r = n.getBoundingClientRect(); return r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
        assert.ok(controls, 'controls fit');
        geometry.push({ scene, language, viewport, aperture: bounds });
      }
      if (viewport.width === 390) {
        await page.locator('.opening-film-pause').click(); await page.waitForTimeout(100);
        await page.screenshot({ path: `${out}/${scene}-mobile.png` });
        await page.locator('.opening-film-pause').click();
        await page.locator('video').evaluate(v => { v.currentTime = 12; });
        await page.waitForFunction(() => !document.querySelector('video').seeking);
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    checks.push(`${scene}: desktop, narrow, compact, landscape; Chinese, English, bilingual; same video and time`);
  }
  await page.locator('.opening-film-mute').click(); assert.ok(await page.locator('video').evaluate(v => v.muted));
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => document.querySelector('.opening-film').contains(document.activeElement)), 'focus remains inside film');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.reel').first().evaluate(n => getComputedStyle(n).animationName), 'none');
  checks.push('mute, focus trap and reduced motion');
  await page.locator('.opening-film-skip').click();
  await page.locator('.d3-canvas[data-ready=true]').waitFor({ timeout: 60000 });
  assert.equal(await page.locator('.opening-film').count(), 0);
  assert.ok(await page.evaluate(() => !document.querySelector('#app').inert));
  checks.push('skip releases media and hands control to the existing 3D opening');
  assert.deepEqual(errors, []);
  console.log(`PASS ${checks.join('; ')}`);
} catch (error) {
  errors.push(String(error)); await page.screenshot({ path: `${out}/failure.png` }); throw error;
} finally {
  await writeFile(`${out}/report.json`, JSON.stringify({ checks, geometry, errors }, null, 2));
  await browser.close();
}
