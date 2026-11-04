import assert from 'node:assert/strict';
import { chromium } from '/Users/fangjie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
const errors=[],checks=[],shots=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
  localStorage.setItem('project-hamilton:language:v1','dual');
  localStorage.setItem('project-hamilton:3d-quality:v1','balanced');
  localStorage.setItem('project-hamilton:3d-text-speed:v1','0');
  localStorage.setItem('project-hamilton:voiceover-volume:v1','0');
  localStorage.setItem('project-hamilton:music-volume:v1','0');
});
const api=(method,arg)=>page.evaluate(([m,a])=>window.__attributeReview[m](a),[method,arg]);
async function at(time){await api('hold',false);await page.waitForFunction(t=>window.__attributeReview.snapshot().elapsed>=t,time);await api('hold',true);}
async function shot(name){const path=`artifacts/compass-${name}.png`;await page.screenshot({path});shots.push(path);}
try{
  await mkdir('artifacts',{recursive:true});
  await page.goto('http://127.0.0.1:1781/?story=3d&debug=1&review=compass');
  await page.waitForFunction(()=>window.__attributeReview);
  await api('clean',true);await api('clear');
  await page.waitForFunction(()=>document.querySelector('.s3-tutorial')?.hidden);
  await shot('hud-before');
  await api('sample','mixed');
  await at(180);await shot('enlarging');
  await at(570);
  assert.equal(await page.locator('.cf-disc [data-stat="momentum"]').getAttribute('data-value'),'40');
  await shot('left-before');
  await at(1120);await shot('changing');
  const middle=Number(await page.locator('.cf-disc [data-stat="momentum"]').getAttribute('data-value'));
  assert.ok(middle>40&&middle<48);
  const circle=await page.locator('.cf-panel').boundingBox();const source=await page.locator('.s3-compass').boundingBox();assert.ok(Math.abs(circle.width/source.width-1.5)<.01);assert.ok(Math.abs(circle.x-source.x)<1&&Math.abs(circle.y-source.y)<1);
  await at(2100);await shot('left-after');
  assert.equal(await page.locator('.cf-disc [data-stat="momentum"]').getAttribute('data-value'),'48');
  assert.equal(await page.locator('.cf-disc [data-stat="burrRespect"]').getAttribute('data-value'),'15');
  await at(3240);await shot('returning');
  await api('hold',false);await page.waitForFunction(()=>window.__attributeReview.snapshot().current.length===0);
  await shot('hud-after');
  assert.equal(await page.locator('.s3-compass').isVisible(),true);
  assert.equal(await page.locator('.s3-compass [data-stat="momentum"]').getAttribute('data-value'),'48');
  checks.push('same HUD renderer: 174 px left HUD grows to 261 px with its top-left position unchanged, changes 40→48 and 20→15, then returns');
  await api('sample','burst');await at(1100);const frozen=await api('snapshot');
  await page.keyboard.press('Escape');await page.locator('.d3-settings[open]').waitFor();await api('hold',false);
  const frozenPath=await page.locator('.cf-panel').getAttribute('style');await page.waitForTimeout(700);
  assert.equal((await api('snapshot')).elapsed,frozen.elapsed);assert.equal(await page.locator('.cf-panel').getAttribute('style'),frozenPath);
  await page.locator('.d3-settings .d3-primary').click();await api('clear');checks.push('settings freeze travel, values and queue');
  for(const mode of ['dual','dual-en','zh','en']){
    await api('language',mode);await api('sample','mixed');await at(2100);
    assert.equal(await page.locator('.cf-changes .text-secondary').count(),0);
    const text=await page.locator('.cf-changes').innerText();assert.ok(mode==='dual-en'||mode==='en'?text.includes('Momentum'):text.includes('锐气'));
  }
  await api('language','dual');await api('dialogue',true);await api('sample','mixed');await at(2100);await shot('dialogue');
  const bounds=await page.locator('.cf-changes').boundingBox(),dialogue=await page.locator('.s3-dialogue').boundingBox();assert.ok(bounds.y+bounds.height<dialogue.y);
  await page.setViewportSize({width:390,height:740});await api('language','dual-en');await api('sample','gain');await at(2100);await shot('small-dialogue');
  const small=await page.locator('.cf-changes').boundingBox();assert.ok(small.x>=0&&small.x+small.width<=390);const smallDialogue=await page.locator('.s3-dialogue').boundingBox();assert.ok(small.y+small.height<smallDialogue.y);
  checks.push('four languages, desktop dialogue and small English-first dialogue keep the captions readable');
  await api('dialogue',false);await page.setViewportSize({width:1440,height:900});await api('sample','limit');await at(2100);
  assert.ok((await page.locator('.cf-changes').innerText()).includes('+2'));assert.equal(await page.locator('.cf-disc [data-stat="momentum"]').getAttribute('data-value'),'100');
  await api('clear');await api('hold',false);
  await api('sample','burst');await page.waitForFunction(()=>window.__attributeReview.snapshot().current[0]?.delta===-3);await page.waitForFunction(()=>window.__attributeReview.snapshot().current[0]?.stat==='burrRespect');
  checks.push('actual clamped +2 and three consecutive complete changes remain accurate and ordered');
  await api('clear');await page.emulateMedia({reducedMotion:'reduce'});await api('sample','mixed');await at(1100);await shot('reduced-motion');
  const reduced=await page.locator('.cf-panel').boundingBox();assert.ok(Math.abs(reduced.width-261)<1&&Math.abs(reduced.x-30)<1);
  checks.push('system reduced motion keeps left-side feedback without scaling animation');
  await api('language','dual');await api('clean',false);await api('clear');await shot('preview-controls');
  assert.deepEqual(errors,[]);await writeFile('artifacts/compass-feedback-check.json',JSON.stringify({checks,shots,errors},null,2));
  console.log(JSON.stringify({checks,shots,errors},null,2));
}catch(e){await shot('failure');throw e;}finally{await browser.close();}
