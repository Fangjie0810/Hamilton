import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { variant as enamel } from './enamel.mjs';
import { variant as glass } from './glass.mjs';
import { variant as tactical } from './tactical.mjs';
import { progressRadius, sector, point } from './shared.mjs';

const folder = new URL('.', import.meta.url);
const variants = [enamel, glass, tactical];
const unlocked = { momentum: 61, influence: 36, washingtonTrust: 44, burrRivalry: 18, burrRespect: 24, locked: false };
const locked = { ...unlocked, washingtonTrust: 0, locked: true };
await mkdir(new URL('exports/', folder), { recursive: true });
for (const value of [0, 25, 50, 75, 100]) {
  const r = progressRadius(value);
  assert.ok(Math.abs((r * r - 52 * 52) / (108 * 108 - 52 * 52) - value / 100) < 1e-10);
}
for (const variant of variants) for (const value of [0, 25, 50, 75, 100]) {
  const rendered = variant.render({ ...unlocked, momentum: value }, `geometry-${variant.id}`);
  assert.equal((rendered.match(/data-stat=/g) || []).length, 5);
  if (value > 0) assert.ok(rendered.includes(sector(52, progressRadius(value), -150, -30)), `${variant.id} fills the entire angle outward`);
}
const { chromium } = await import(process.env.HAMILTON_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1540, height: 960 }, deviceScaleFactor: 1 });
const errors = [], failures = [], pixelChecks = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) failures.push(r.url()); });
const url = 'http://127.0.0.1:1776/art-direction/compass-ui-studies-2026-09-14/index.html';
try {
  await page.goto(url); await page.waitForFunction(() => !!window.compassStudies);
  for (const variant of variants) {
    const metric = page.locator(`[data-variant=${variant.id}] [data-stat=momentum]`);
    await metric.focus(); await page.keyboard.press('Enter');
    assert.ok(await page.locator('#detail').evaluate(el => el.open));
    assert.equal(await page.locator('#detail-name').textContent(), '锐气');
    await page.locator('#close-detail').click();
    assert.equal(await metric.evaluate(el => el === document.activeElement), true);
  }
  for (const value of [0, 25, 50, 75, 100]) {
    await page.locator('[data-key=momentum]').fill(String(value));
    const radii = await page.locator('.dial [data-stat=momentum]').evaluateAll(nodes => nodes.map(n => Number(n.dataset.radius)));
    assert.ok(radii.every(r => Math.abs(r - progressRadius(value)) < 1e-8));
  }
  await page.locator('#locked').uncheck();
  assert.equal(await page.locator('[data-key=washingtonTrust]').isDisabled(), false);
  await page.locator('#language').click();
  assert.equal(await page.locator('.range-label').first().textContent(), 'Momentum');
  await page.locator('#language').click();
  await page.setViewportSize({ width: 390, height: 850 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1540, height: 960 });
  await page.locator('#reset').click();
  await page.screenshot({ path: fileURLToPath(new URL('interactive-preview.png', folder)), fullPage: true });

  for (const variant of variants) for (const [name, state] of [['unlocked', unlocked], ['locked', locked]]) {
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="720" height="720">${variant.render(state, `export-${variant.id}-${name}`)}</svg>`;
    await writeFile(new URL(`exports/${variant.id}-${name}.svg`, folder), markup);
    const sample = await page.evaluate(async markup => {
      const source = new Image(); source.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
      await source.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 240;
      const ctx = canvas.getContext('2d'); ctx.drawImage(source, 0, 0, 240, 240);
      const rgba = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
      // Sample away from glyphs, seams and the outer bevel, in unfilled sectors.
      return { corner: rgba(2, 2), unfilled: rgba(86, 26), trust: rgba(25, 103) };
    }, markup);
    assert.equal(sample.corner[3], 0, `${variant.id} has a transparent background`);
    pixelChecks.push({ variant: variant.id, state: name, ...sample });
    const asset = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
    await asset.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${markup}`);
    await asset.screenshot({ path: fileURLToPath(new URL(`exports/${variant.id}-${name}.png`, folder)), omitBackground: true });
    await asset.close();
  }
  for (const variant of variants) {
    const open = pixelChecks.find(p => p.variant === variant.id && p.state === 'unlocked');
    const closed = pixelChecks.find(p => p.variant === variant.id && p.state === 'locked');
    assert.ok(open.unfilled[3] < 240, `${variant.id} has a translucent empty track`);
    assert.ok(closed.trust[3] > open.trust[3] + 40, `${variant.id} lock is more opaque than an empty track`);
    const luminance = rgba => .2126 * rgba[0] + .7152 * rgba[1] + .0722 * rgba[2];
    assert.ok(luminance(closed.trust) < luminance(open.trust) - 25, `${variant.id} lock uses a darker grey`);
  }
  // A single review board puts the coloured and locked states next to their material names.
  await page.setViewportSize({ width: 1260, height: 850 });
  await page.evaluate(({ variants, unlocked, locked }) => {
    document.body.classList.add('capture-mode');
    document.querySelector('#comparisons').innerHTML = variants.map((v, i) => `<article class="design"><header><span class="option-code">${String.fromCharCode(65 + i)}</span><div><h2>${v.title}</h2><p>${v.subtitle}</p></div></header><div class="stage" data-background="scene">${window.compassStudies.render(v.id, unlocked, 'board-' + v.id)}</div><div class="locked-row"><div>${window.compassStudies.render(v.id, locked, 'board-lock-' + v.id)}</div><p>军营前锁定<br><small>深灰斜纹＋锁头<br>浅灰仍是未填充区域</small></p></div><p class="board-summary">${v.summary}</p></article>`).join('');
    const style = document.createElement('style'); style.textContent = '.capture-mode .stage{height:345px}.stage>svg{width:292px;height:292px}.locked-row{display:flex;align-items:center;gap:8px;padding:16px 8px;border-bottom:1px solid #6f7c6d45;background:conic-gradient(#d7e4dc08 25%,transparent 0 50%,#d7e4dc08 0 75%,transparent 0) 0 0/20px 20px}.locked-row svg{width:150px;height:150px;display:block}.locked-row p{font-size:12px;line-height:1.85;color:#d0d3c5}.locked-row small{font-size:10px;color:#97a79b}.board-summary{font-size:12px;line-height:1.8;color:#b3c0b2;margin:18px 0 0}.capture-mode .page-head{margin-bottom:30px}'; document.head.append(style);
  }, { variants: variants.map(v => ({ id: v.id, title: v.title.zh.replace(/^B · /, ''), subtitle: v.subtitle.zh, summary: v.summary.zh })), unlocked, locked });
  await page.screenshot({ path: fileURLToPath(new URL('comparison.png', folder)), fullPage: true });
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  await writeFile(new URL('verification.json', folder), JSON.stringify({ passed: true, variants: variants.map(v => v.id), radialAreaStops: [0, 25, 50, 75, 100], interactions: 'five metric groups, keyboard dialog/focus restoration, lock toggle, bilingual labels, 390px layout', pixelChecks, errors, failures }, null, 2) + '\n');
  console.log('PASS three compass designs: radial fills, transparent exports, lock distinction, keyboard interactions, bilingual labels and narrow layout.');
} finally { await browser.close(); }
