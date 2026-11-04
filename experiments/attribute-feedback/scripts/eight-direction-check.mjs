import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], missing = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) missing.push(response.url()); });
const directions = [
  { name: 's', keys: ['s'], idle: 12, first: 0, flip: false, label: '正面 / S' },
  { name: 'se', keys: ['s', 'd'], idle: 16, first: 17, flip: false, label: '右前 / SE' },
  { name: 'e', keys: ['d'], idle: 14, first: 8, flip: false, label: '右侧 / E' },
  { name: 'ne', keys: ['w', 'd'], idle: 21, first: 22, flip: false, label: '右后 / NE' },
  { name: 'n', keys: ['w'], idle: 13, first: 4, flip: false, label: '背面 / N' },
  { name: 'nw', keys: ['w', 'a'], idle: 21, first: 22, flip: true, label: '左后 / NW' },
  { name: 'w', keys: ['a'], idle: 14, first: 8, flip: true, label: '左侧 / W' },
  { name: 'sw', keys: ['s', 'a'], idle: 16, first: 17, flip: true, label: '左前 / SW' },
];
const state = () => page.locator('.d3-canvas').evaluate(el => ({ ...el.dataset }));
async function reset() { await page.locator('.d3-settings-button').click(); await page.locator('.d3-settings .d3-secondary').click(); await page.waitForTimeout(160); }
try {
  await mkdir('artifacts', { recursive: true });
  const url = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/'); url.search = '?demo=3d&debug=1';
  await page.goto(url.href); await page.locator('.d3-canvas[data-ready=true]').waitFor({ timeout: 60000 });
  const atlas = await page.evaluate(() => window.__streetTest.atlas());
  const results = [];
  for (const direction of directions) {
    await reset();
    for (const key of direction.keys) await page.keyboard.down(key);
    await page.waitForFunction(name => { const d = document.querySelector('.d3-canvas').dataset; return d.facing === name && d.moving === 'true'; }, direction.name);
    const samples = await page.evaluate(() => new Promise(resolve => {
      const poses = [], seen = new Set(), start = performance.now();
      function collect() {
        const pose = window.__streetTest.pose();
        if (pose.moving) { poses.push(pose); seen.add(pose.frame); }
        if (seen.size === 4 || performance.now() - start > 1600) resolve(poses); else requestAnimationFrame(collect);
      }
      requestAnimationFrame(collect);
    }));
    const frames = new Set(samples.map(pose => pose.frame));
    assert.ok(samples.every(pose => pose.flip === direction.flip && pose.facing === direction.name));
    for (const key of direction.keys) await page.keyboard.up(key);
    await page.waitForFunction(() => document.querySelector('.d3-canvas').dataset.moving === 'false');
    const idle = await state();
    assert.equal(idle.facing, direction.name); assert.equal(Number(idle.frame), direction.idle);
    assert.equal(frames.size, 4, `${direction.name} has four actual walk frames: ${[...frames]}`);
    assert.ok([...frames].every(frame => frame >= direction.first && frame <= direction.first + 3));
    if (['se', 'ne'].includes(direction.name)) await page.screenshot({ path: `artifacts/3d-facing-${direction.name}.png` });
    results.push({ direction: direction.name, frames: [...frames].sort((a, b) => a - b), idle: Number(idle.frame), flip: idle.flipped });
  }
  await reset(); await page.keyboard.down('d'); await page.waitForTimeout(450); await page.keyboard.up('d');
  await page.waitForFunction(() => document.querySelector('.d3-canvas').dataset.moving === 'false');
  const position = await state(), playerViews = new Set(), burrViews = new Set();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(750, 430); await page.mouse.down({ button: 'right' });
    await page.mouse.move(750 - Math.PI / 4 / .006, 430, { steps: 8 }); await page.mouse.up({ button: 'right' });
    const expected = directions[(2 - i + 16) % 8];
    await page.waitForFunction(name => document.querySelector('.d3-canvas').dataset.facing === name, expected.name);
    const current = await state(); playerViews.add(current.facing); burrViews.add(current.burrFacing);
    assert.equal(current.x, position.x); assert.equal(current.z, position.z); assert.equal(Number(current.frame), expected.idle);
  }
  assert.equal(playerViews.size, 8); assert.equal(burrViews.size, 8);
  await reset(); await page.locator('.d3-npc').click(); await page.locator('.d3-dialogue:not([hidden])').waitFor({ timeout: 15000 });
  assert.ok(await page.locator('.d3-line .text-secondary').isVisible());
  await page.screenshot({ path: 'artifacts/3d-eight-direction-dialogue.png' });
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  await writeFile('artifacts/eight-direction-check.json', JSON.stringify({ results, cameraPlayerViews: [...playerViews], cameraBurrViews: [...burrViews], errors, missing }, null, 2));

  // Render the same normalized atlas used by the game as a labeled review artifact.
  const gallery = await browser.newPage({ viewport: { width: 1360, height: 710 }, deviceScaleFactor: 1 });
  await gallery.setContent('<html><body style="margin:0;background:#22372b"><canvas width="1360" height="710"></canvas></body></html>');
  const cells = await gallery.evaluate(async ({ atlas, directions }) => {
    const image = new Image(); image.src = atlas; await image.decode();
    const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#22372b'; ctx.fillRect(0, 0, 1360, 710);
    ctx.fillStyle = '#eee0bb'; ctx.font = '24px Georgia, serif'; ctx.fillText('八方向人物 / EIGHT-DIRECTION CAST', 32, 43);
    ctx.fillStyle = '#b7c2a5'; ctx.font = '13px sans-serif'; ctx.fillText('汉密尔顿：待机 + 行走    /    HAMILTON: IDLE + WALK', 32, 78);
    const burr = [15, 29, 28, 27, 26, 27, 28, 29];
    const draw = (frame, x, y, flip) => { ctx.save(); ctx.translate(x + 72, y); if (flip) ctx.scale(-1, 1); ctx.drawImage(image, frame % 8 * 96, Math.floor(frame / 8) * 128, 96, 128, -72, 0, 144, 192); ctx.restore(); };
    directions.forEach((d, i) => {
      const x = 30 + i * 164;
      ctx.fillStyle = '#cfcaac'; ctx.font = '13px sans-serif'; ctx.fillText(d.label, x + 20, 111);
      draw(d.idle, x, 119, d.flip); draw(d.first, x, 309, d.flip);
      ctx.fillStyle = '#344b37'; ctx.fillRect(x + 9, 299, 128, 1); ctx.fillRect(x + 9, 489, 128, 1);
      draw(burr[i], x, 510, d.flip);
    });
    ctx.fillStyle = '#b7c2a5'; ctx.font = '13px sans-serif'; ctx.fillText('伯尔：待机 / BURR: IDLE', 32, 513);
    const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
    const sourceCtx = source.getContext('2d'); sourceCtx.drawImage(image, 0, 0);
    return Array.from({ length: 31 }, (_, frame) => {
      const pixels = sourceCtx.getImageData(frame % 8 * 96, Math.floor(frame / 8) * 128, 96, 128).data;
      let opaque = 0, bottom = 0, magenta = 0;
      for (let y = 0; y < 128; y++) for (let x = 0; x < 96; x++) { const i = (y * 96 + x) * 4; if (pixels[i + 3] > 128) { opaque++; bottom = Math.max(bottom, y); if (pixels[i] - pixels[i + 1] > 50 && pixels[i + 2] - pixels[i + 1] > 50 && pixels[i] > 100 && pixels[i + 2] > 100) magenta++; } }
      return { frame, opaque, bottom, magenta };
    });
  }, { atlas, directions });
  assert.ok(cells.every(cell => cell.opaque > 1200 && cell.bottom >= 117 && cell.bottom <= 119 && cell.magenta === 0), JSON.stringify(cells));
  await gallery.screenshot({ path: 'artifacts/eight-direction-cast.png' });
  console.log('PASS eight actual keyboard directions × four walk frames; eight idle views; Hamilton and Burr turn through eight views as camera orbits; unchanged position; bilingual dialogue; 31 atlas cells keyed and aligned');
} finally { await browser.close(); }
