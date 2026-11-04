import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.HAMILTON_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.HAMILTON_URL ?? 'http://127.0.0.1:1795/';
const mbps = Number(process.env.HAMILTON_TEST_MBPS ?? 3);
assert.ok(mbps > 0);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { base, mbps, latencyMs: 80, cache: 'disabled', errors: [], failedRequests: [] };
await mkdir('artifacts/cg-cdn', { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('requestfailed', request => {
    if (!request.failure()?.errorText.includes('ERR_ABORTED')) report.failedRequests.push({ url: request.url(), error: request.failure() });
  });
  await page.addInitScript(() => {
    localStorage.setItem('project-hamilton:3d-quality:v1', 'low');
    window.__filmTrace = [];
    new MutationObserver(() => {
      const video = document.querySelector('.opening-film-video');
      if (!video || video.dataset.measuring) return;
      video.dataset.measuring = 'true';
      window.__filmStart = performance.now();
      for (const type of ['loadstart', 'loadedmetadata', 'waiting', 'stalled', 'playing', 'pause', 'ended', 'error']) {
        // Capture before the film's ending handler unloads the media element.
        video.addEventListener(type, () => window.__filmTrace.push({ type, wallSeconds: (performance.now() - window.__filmStart) / 1000, mediaSeconds: video.currentTime, readyState: video.readyState }), { capture: true });
      }
    }).observe(document, { childList: true, subtree: true });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: report.latencyMs, downloadThroughput: mbps * 1e6 / 8, uploadThroughput: mbps * 1e6 / 8 });
  await page.goto(base, { waitUntil: 'networkidle', timeout: 90000 });
  await page.locator('.entry-begin').click();
  await page.locator('.opening-film').waitFor();
  await page.locator('.d3-canvas[data-ready=true]').waitFor({ timeout: 180000 });
  Object.assign(report, await page.evaluate(() => {
    const events = window.__filmTrace;
    return { events, postStartWaits: events.filter(event => event.type === 'waiting' && event.mediaSeconds > .25), elapsedToGameSeconds: (performance.now() - window.__filmStart) / 1000, resources: performance.getEntriesByType('resource').map(r => ({ name: r.name, transferSize: r.transferSize, duration: r.duration })) };
  }));
  assert.ok(report.events.some(e => e.type === 'ended' && e.mediaSeconds >= 57.19), 'complete natural playback');
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.failedRequests, []);
  console.log(JSON.stringify({ mbps, postStartWaits: report.postStartWaits, elapsedToGameSeconds: report.elapsedToGameSeconds, errors: report.errors }));
} catch (error) {
  report.failure = String(error); throw error;
} finally {
  await writeFile(`artifacts/cg-cdn/network-${mbps}mbps.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
