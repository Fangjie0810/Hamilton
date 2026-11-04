import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.HAMILTON_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE).href : 'playwright');
const base = new URL(process.env.BASE_URL ?? process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const report = { generatedAt: new Date().toISOString(), checks: [], errors: [] };
page.on('pageerror', error => report.errors.push(error.message));
const directory = 'artifacts/lafayette-registration';

try {
  await mkdir(directory, { recursive: true });
  await page.goto(new URL('/art-direction/main-pixel-production-2026-09-14/', base).href);
  await page.waitForFunction(() => window.__mainPixelReview?.complete, undefined, { timeout: 120000 });
  const result = await page.evaluate(async () => {
    const { MAIN_PIXEL_ART } = await import('/src/data/mainPixelArt.ts');
    const { extractPortraitFrames } = await import('/src/ui/portraitPixels.ts');
    const layout = MAIN_PIXEL_ART.lafayette, h = window.__mainPixelReview; h.state.auto = false;
    const image = new Image(); image.src = layout.path; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const source = context.getImageData(0, 0, canvas.width, canvas.height);
    const options = { columns: layout.columns, rows: layout.rows, frameCount: layout.frameCount,
      horizontalOverscan: layout.frameOverscan, key: { color: layout.key }, outputWidth: 360, outputHeight: 450, padding: 5 };
    const before = extractPortraitFrames(source, options), after = extractPortraitFrames(source, { ...options, frameOffsets: layout.frameOffsets });
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const hash = data => { let value = 2166136261; for (const channel of data) value = Math.imul(value ^ channel, 16777619); return value >>> 0; };
    const toCanvas = pixels => { const c = document.createElement('canvas'); c.width = pixels.width; c.height = pixels.height; c.getContext('2d').putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0); return c; };
    // Reviewed stationary regions exclude the mouth and expressive hand. Search
    // the real rendered pixels, rather than merely checking the offset metadata.
    const regions = {
      hair: { x: 125, y: 25, width: 170, height: 75 },
      eyes: { x: 115, y: 80, width: 145, height: 70 },
      collar: { x: 145, y: 211, width: 125, height: 95 },
      torso: { x: 150, y: 300, width: 120, height: 145 },
    };
    function compare(set, frame, region) {
      const { scale, sourceBounds, offsetX, offsetY } = set.registration;
      const rect = { x: Math.ceil(offsetX + (region.x - sourceBounds.x) * scale), y: Math.ceil(offsetY + (region.y - sourceBounds.y) * scale),
        width: Math.floor(region.width * scale), height: Math.floor(region.height * scale) };
      const reference = set.frames[0], current = set.frames[frame]; let best = { error: Infinity, dx: 0, dy: 0 };
      for (let dy = -20; dy <= 20; dy++) for (let dx = -30; dx <= 30; dx++) {
        if (rect.x + dx < 0 || rect.y + dy < 0 || rect.x + rect.width + dx >= current.width || rect.y + rect.height + dy >= current.height) continue;
        let error = 0, samples = 0;
        for (let y = rect.y; y < rect.y + rect.height; y += 3) for (let x = rect.x; x < rect.x + rect.width; x += 3) {
          const a = (y * reference.width + x) * 4, b = ((y + dy) * current.width + x + dx) * 4;
          for (let channel = 0; channel < 4; channel++) { error += (reference.data[a + channel] - current.data[b + channel]) ** 2; samples++; }
        }
        error /= samples;
        if (error < best.error) best = { error, dx, dy };
      }
      return { dx: best.dx, dy: best.dy, error: Math.round(best.error * 100) / 100 };
    }
    const registration = [before, after].map(set => set.frames.map((_, index) => ({ frame: index,
      anchors: Object.fromEntries(Object.entries(regions).filter(([name]) => index < 3 || name === 'hair' || name === 'eyes').map(([name, region]) => [name, compare(set, index, region)])) })));
    // The same cleaned source bounds prove registration has neither clipped the
    // emphasis fingers nor imported a neighboring cell's disconnected fragments.
    check(JSON.stringify(before.bounds) === JSON.stringify(after.bounds), 'registration preserves all authored source bounds');
    for (const frame of registration[1].slice(0, 3)) for (const [name, anchor] of Object.entries(frame.anchors))
      check(Math.abs(anchor.dx) <= 2 && Math.abs(anchor.dy) <= 1, `speaking frame ${frame.frame} ${name} still drifts: ${JSON.stringify(anchor)}`);
    for (const frame of registration[1].slice(3))
      check(Math.abs(frame.anchors.hair.dx) <= 2 && Math.abs(frame.anchors.hair.dy) <= 2, `reaction frame ${frame.frame} head still jumps`);
    // Canvas stores premultiplied alpha; normalize expected pixels through the
    // same putImageData / drawImage route before checking the live renderer.
    const expectedHashes = after.frames.map(frame => {
      const c = document.createElement('canvas'); c.width = frame.width; c.height = frame.height;
      const context = c.getContext('2d'); context.drawImage(toCanvas(frame), 0, 0);
      return hash(context.getImageData(0, 0, c.width, c.height).data);
    });
    const p = h.portraits, runtime = [];
    const capture = label => {
      const slot = p.element.querySelector('[data-character="lafayette"]'), c = slot.querySelector('canvas'), frame = Number(slot.dataset.frame);
      const actual = c.getContext('2d').getImageData(0, 0, c.width, c.height);
      check(hash(actual.data) === expectedHashes[frame], `${label}: the real dialogue renderer must use the registered frame ${frame}`);
      runtime.push({ label, phase: p.element.dataset.phase, frame, hash: hash(actual.data) }); return frame;
    };
    for (const pose of Object.keys(layout.poses)) {
      p.update(0, false, false);
      p.show('lafayette', 'hamilton', { speaking: pose, settled: pose, listener: 'calm', emphasis: true }); capture(`${pose}/ready`);
      p.setSpeaking('lafayette', true, false); capture(`${pose}/speaking`);
      for (let elapsed = 0; elapsed < 1000; elapsed += 50) { p.update(50, false, false); capture(`${pose}/tick-${elapsed}`); }
      p.setSpeaking('lafayette', false, false); capture(`${pose}/buffering`);
      p.setSpeaking('lafayette', true, false); p.update(0, true, false); capture(`${pose}/paused`);
      p.update(100, false, true); capture(`${pose}/reduced-motion`);
      p.update(0, false, false); p.setSpeaking('lafayette', false, true); capture(`${pose}/settled`);
    }
    const beforePngs = before.frames.map(frame => toCanvas(frame).toDataURL()), afterPngs = after.frames.map(frame => toCanvas(frame).toDataURL());
    window.__lafayetteRegistrationReview = { before: before.frames.map(toCanvas), after: after.frames.map(toCanvas) };
    return { source: layout.path, offsets: layout.frameOffsets, before: { registration: before.registration, bounds: before.bounds, anchors: registration[0] },
      after: { registration: after.registration, bounds: after.bounds, anchors: registration[1] }, runtime, beforePngs, afterPngs };
  });
  for (const key of ['before', 'after']) for (const [index, png] of result[`${key}Pngs`].entries())
    await writeFile(`${directory}/${key}-${index}.png`, Buffer.from(png.split(',')[1], 'base64'));
  await writeFile(`${directory}/index.html`, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>拉法耶特说话帧对齐 / Lafayette speech registration</title>
<style>body{margin:24px;background:#10181d;color:#f4e9d2;font:16px/1.6 system-ui}h1{font-size:22px;margin-bottom:4px}p{color:#b2c3ca;margin:0 0 20px}main{display:flex;flex-wrap:wrap;gap:24px}figure{margin:0;background:#172127;border:1px solid #4a5962}figcaption{padding:8px 12px}img{display:block;width:min(360px,calc(100vw - 50px));height:auto;image-rendering:pixelated}button,select{padding:7px 12px;margin:12px 8px 20px 0;background:#26363f;color:inherit;border:1px solid #6b828b;border-radius:4px}output{margin-left:8px}</style>
<h1>拉法耶特 · 逐帧对齐 / Lafayette frame registration</h1><p>两侧使用同一原图和播放节奏，保留全部手势。 / Same authored art and playback timing; complete gestures preserved.</p>
<button id="toggle">暂停 / Pause</button><select id="mode" aria-label="播放模式 / Playback mode"><option value="speech">普通说话 / Speech</option><option value="emphasis">说话与重音 / Emphasis</option><option value="reactions">句前与句后 / Reactions</option></select><output id="frame"></output>
<main><figure><figcaption>修复前 / Before</figcaption><img id="before" src="before-0.png" width="360" height="450" alt="修复前人物 / Before registration"></figure><figure><figcaption>对齐后 / Aligned</figcaption><img id="after" src="after-0.png" width="360" height="450" alt="对齐后人物 / Aligned portrait"></figure></main>
<script>const cycles={speech:[1,0,1,1,0,0,1,0],emphasis:[0,1,0,1,2,2,1,0,1,0],reactions:[3,3,3,1,0,1,3,3,4,4,4,1,0,1,4,4,5,5,5,1,0,1,5,5,6,6,6,1,0,1,6,6]};let index=0,playing=true;const mode=document.getElementById('mode'),button=document.getElementById('toggle');function draw(){const frame=cycles[mode.value][index%cycles[mode.value].length];for(const side of ['before','after'])document.getElementById(side).src=side+'-'+frame+'.png';document.getElementById('frame').textContent='帧 / Frame '+frame;}button.onclick=()=>{playing=!playing;button.textContent=playing?'暂停 / Pause':'播放 / Play';};mode.onchange=()=>{index=0;draw();};setInterval(()=>{if(playing){index++;draw();}},115);draw();</script></html>`);
  delete result.beforePngs; delete result.afterPngs; report.result = result;
  await page.evaluate(() => {
    const data = window.__lafayetteRegistrationReview, panel = document.createElement('section'); panel.id = 'registration-comparison';
    panel.style.cssText = 'background:#172127;padding:20px;color:#f4e9d2;display:grid;grid-template-columns:repeat(3,360px);gap:12px;width:max-content';
    for (const kind of ['before', 'after']) for (let frame = 0; frame < 3; frame++) {
      const cell = document.createElement('div'), title = document.createElement('div');
      title.textContent = `${kind === 'before' ? '修复前 / Before' : '对齐后 / Aligned'} · ${frame}`;
      title.style.cssText = 'font:16px sans-serif;margin-bottom:8px'; cell.append(title, data[kind][frame]); panel.append(cell);
    }
    document.body.prepend(panel);
  });
  await page.locator('#registration-comparison').screenshot({ path: `${directory}/comparison.png` });
  assert.deepEqual(report.errors, [], 'no browser errors');
  report.checks.push('All three real Lafayette speech frames align their hair, eyes, collar and torso within 2 horizontal / 1 vertical output pixels.');
  report.checks.push('All four authored reaction heads remain within 2 output pixels, while their distinct gestures remain intact.');
  report.checks.push('Real DialoguePortraits ready, speech, buffering, pause, reduced-motion and settled canvases match registered frame pixels.');
  report.checks.push('Original source bounds including overscanned emphasis fingers are unchanged.');
  report.passed = true;
  console.log(JSON.stringify({ passed: true, checks: report.checks, anchors: report.result.after.anchors }, null, 2));
} catch (error) {
  report.passed = false; report.failure = error instanceof Error ? error.stack : String(error);
  console.error(report.failure); process.exitCode = 1;
} finally {
  await writeFile(`${directory}/check.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
