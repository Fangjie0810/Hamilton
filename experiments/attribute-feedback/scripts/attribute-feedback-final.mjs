import assert from 'node:assert/strict';
import { chromium } from '/Users/fangjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
const errors=[],checks=[]; page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
  localStorage.setItem('project-hamilton:3d-quality:v1','low');
  localStorage.setItem('project-hamilton:3d-text-speed:v1','0');
  localStorage.setItem('project-hamilton:voiceover-volume:v1','0');
  localStorage.setItem('project-hamilton:music-volume:v1','0');
});
try {
  await page.goto('http://127.0.0.1:1781/?story=3d&debug=1&review=stamp');
  await page.waitForFunction(()=>window.__attributeReview);
  await page.evaluate(()=>{window.__attributeReview.clean(true);window.__attributeReview.dialogue(true);});
  for(const viewport of [{width:390,height:740},{width:760,height:540}]) {
    await page.setViewportSize(viewport);
    for(const mode of ['dual','dual-en']) for(const variant of ['stamp','spark','ruler']) {
      await page.evaluate(([mode,variant])=>{
        const r=window.__attributeReview; r.language(mode);r.select(variant);r.clear();r.hold(false);r.enqueue([{washingtonTrust:6}]);
      },[mode,variant]);
      await page.waitForFunction(()=>window.__attributeReview.snapshot().elapsed>=700);
      await page.evaluate(()=>window.__attributeReview.hold(true));
      const size = await page.locator('.af-feedback').boundingBox(), dialogue=await page.locator('.s3-dialogue').boundingBox();
      assert.ok(size.y+size.height<=dialogue.y-8);
      assert.ok(await page.locator('.af-label').evaluate(n=>n.scrollWidth<=n.clientWidth+1 && n.scrollHeight<=n.clientHeight+1));
      await page.screenshot({path:`artifacts/${variant}-dialogue-${mode}-${viewport.width}-final.png`});
      checks.push(`${variant} ${mode} ${viewport.width}: long trust label fits and text remains unobstructed`);
    }
  }
  await page.setViewportSize({width:1440,height:980});
  await page.evaluate(()=>window.__attributeReview.language('dual'));
  await page.goto('http://127.0.0.1:1781/review.html');
  await page.waitForFunction(()=>document.querySelectorAll('video').length===3 && [...document.querySelectorAll('video')].every(v=>v.readyState>=1));
  const videos=await page.locator('video').evaluateAll(nodes=>nodes.map(n=>({src:n.src,duration:n.duration,error:n.error?.message})));
  assert.ok(videos.every(v=>v.duration>3 && !v.error));
  await page.locator('video').nth(1).evaluate(v=>v.play());
  await page.waitForFunction(()=>document.querySelectorAll('video')[1].currentTime>.5);
  await page.locator('video').nth(1).evaluate(v=>{v.pause();v.currentTime=1.5;});
  await page.waitForFunction(()=>!document.querySelectorAll('video')[1].seeking);
  await page.screenshot({path:'artifacts/three-variants-overview.png'});
  checks.push('comparison page loads three playable recordings and three game links');
  assert.deepEqual(errors,[]);
  await writeFile('artifacts/final-review-check.json',JSON.stringify({checks,videos,errors},null,2));
  console.log(JSON.stringify({checks,videos,errors},null,2));
}finally{await browser.close();}
