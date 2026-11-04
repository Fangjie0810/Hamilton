import { chromium } from '/Users/fangjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
await page.addInitScript(() => {
  localStorage.setItem('project-hamilton:language:v1', 'dual');
  localStorage.setItem('project-hamilton:3d-quality:v1', 'balanced');
  localStorage.setItem('project-hamilton:3d-text-speed:v1', '0');
  localStorage.setItem('project-hamilton:voiceover-volume:v1', '0');
  localStorage.setItem('project-hamilton:music-volume:v1', '0');
});
const dir = resolve('artifacts'); await mkdir(dir, { recursive: true });
try {
  await page.goto('http://127.0.0.1:1781/?story=3d&debug=1&review=compass');
  await page.waitForFunction(() => window.__attributeReview);
  await page.evaluate(() => window.__attributeReview.clean(true));
  await page.waitForFunction(() => document.querySelector('.s3-tutorial')?.hidden, undefined, { timeout: 30000 });
  const cdp = await page.context().newCDPSession(page);
  for (const variant of ['compass']) {
    await page.evaluate(v => { window.__attributeReview.select(v); window.__attributeReview.clear(); window.__attributeReview.hold(false); }, variant);
    await page.mouse.move(1420, 880);
    const frames = [], frameDir = resolve(dir, `${variant}-frames`); await mkdir(frameDir, {recursive:true});
    const onFrame = event => { frames.push({ data: event.data, time: event.metadata.timestamp }); void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }); };
    cdp.on('Page.screencastFrame', onFrame);
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1280, maxHeight: 800, everyNthFrame: 1 });
    await page.waitForTimeout(250);
    await page.evaluate(() => window.__attributeReview.sample('mixed'));
    await page.waitForFunction(() => window.__attributeReview.snapshot().current.length === 0, undefined, { timeout: 30000 });
    await page.waitForTimeout(350);
    await cdp.send('Page.stopScreencast'); cdp.off('Page.screencastFrame', onFrame);
    await Promise.all(frames.map((f, index) => writeFile(resolve(frameDir, `${index}.jpg`), Buffer.from(f.data, 'base64'))));
    const lines = frames.map((f, index) => `file '${index}.jpg'\nduration ${index + 1 < frames.length ? Math.max(.01, frames[index+1].time-f.time) : .04}`).join('\n');
    await writeFile(resolve(frameDir, 'frames.txt'), lines);
    execFileSync(resolve('../../art-direction/tools/ffmpeg-runtime/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'), ['-y','-loglevel','error','-f','concat','-safe','0','-i',resolve(frameDir,'frames.txt'),'-vf','fps=30,scale=1280:800','-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',resolve(dir,`${variant}-motion.mp4`)]);
    await rm(frameDir, {recursive:true});
    await page.evaluate(() => window.__attributeReview.sample('mixed'));
    await page.waitForFunction(() => window.__attributeReview.snapshot().elapsed > 2100);
    await page.evaluate(() => window.__attributeReview.hold(true));
    await page.screenshot({path:resolve(dir,`${variant}-final.png`)});
    console.log(`${variant}: ${frames.length} actual browser frames, clip and final screenshot saved`);
  }
} finally { await browser.close(); }
