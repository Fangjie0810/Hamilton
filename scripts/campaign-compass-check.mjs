import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// A real scene checks host integration. An in-memory Vite fixture then exercises
// the production StoryUI/GrowthCompass without mutating the game's debug hook.
const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(15000);
const base = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/');
const checks = [], errors = [], failures = [], snapshots = [], artifacts = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.status() >= 400 && response.url().startsWith(base.origin) && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`);
});
const statIds = ['momentum', 'influence', 'washingtonTrust', 'burrRivalry', 'burrRespect'];
const outerStats = statIds.slice(0, 3);
const part = id => page.locator(`.s3-compass [data-stat="${id}"]`);
const tip = () => page.locator('.s3-compass-tooltip');
const dialog = () => page.locator('.s3-growth-dialog');
const story = () => page.evaluate(() => window.__streetTest.story());
const progress = value => ({ chapter: value.chapter, phase: value.phase, index: value.index, completed: value.completed, state: value.state });
const fixture = () => page.evaluate(() => window.__campaignCompassFixture.snapshot());

const fixtureHTML = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Campaign compass production fixture</title>
<style>body{background-color:#32483b!important;background-image:linear-gradient(45deg,#87928335 25%,transparent 25%),linear-gradient(-45deg,#87928335 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#87928335 75%),linear-gradient(-45deg,transparent 75%,#87928335 75%)!important;background-size:32px 32px!important;background-position:0 0,0 16px,16px -16px,-16px 0!important}#fixture-note{position:absolute;left:30px;top:30px;max-width:calc(100vw - 60px);font:14px Georgia,serif;color:#f1e5c5;line-height:1.7;pointer-events:none}.s3-screen{background:none!important}</style></head><body><div id="app"></div><p id="fixture-note">Production StoryUI / GrowthCompass<br>Transparent surface and state boundary fixture</p>
<script type="module">
import '/src/style.css';
import '/src/demo3d/demo.css';
import { StoryUI } from '/src/story3d/StoryUI.ts';
import { initialGameState, cloneState } from '/src/core/GameState.ts';
import { chapters } from '/src/data/chapters.ts';
import { growthAttributes } from '/src/data/growth.ts';
import { setLanguage, getLanguage } from '/src/i18n/text.ts';
const ui = new StoryUI(document.querySelector('#app'));
let state = initialGameState(), chapter = 'Arrival';
const completed = ['arrival-burr'];
function refresh(){ui.showChapter(chapters[chapter], 1, state);ui.setGrowthContext(chapters[chapter], state, completed);}
refresh();
const chart = document.querySelector('.s3-compass > svg');
const originalParts = [...document.querySelectorAll('.s3-compass [data-stat]')];
window.__campaignCompassFixture = {
  snapshot: () => ({ state: cloneState(state), chapter, language: getLanguage(), chartRetained: chart === document.querySelector('.s3-compass > svg'), partsRetained: originalParts.every(part => part.isConnected), attributes: growthAttributes }),
  update: (patch, nextChapter = chapter) => { state = {...state, ...patch}; chapter = nextChapter; refresh(); },
  language: setLanguage,
};
</script></body></html>`;

async function capture(name) {
  const path = `artifacts/campaign-compass-${name}.png`;
  await page.screenshot({ path }); artifacts.push(path);
}
async function screenPoint(id) {
  return page.locator('.s3-compass > svg').evaluate((svg, stat) => {
    // Deliberately choose the interior of each painted sector rather than its
    // rectangular bounding-box centre, which may fall in a different SVG part.
    const points = { momentum: [120, 36], influence: [193, 157], washingtonTrust: [47, 157] };
    const split = Number(svg.parentElement.dataset.relationshipSplit);
    const point = points[stat] ?? [120, stat === 'burrRivalry' ? (68 + split) / 2 : (172 + split) / 2];
    const transformed = new DOMPoint(...point).matrixTransform(svg.getScreenCTM());
    return { x: transformed.x, y: transformed.y };
  }, id);
}
async function hover(id) {
  // Clip geometry and its composited hit map settle on a paint frame after a
  // synchronous fixture update. No game/debug state is changed by this wait.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const point = await screenPoint(id);
  await page.mouse.move(point.x, point.y);
  await tip().waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-stat]')?.dataset.stat, point), id, `${id} receives its geometric hit`);
  const text = await tip().innerText();
  assert.ok(text.trim().length > 3, `${id} has a populated tooltip`);
  return text;
}
async function expectDialog(id, description) {
  await page.locator(`.s3-growth-dialog[open][data-stat="${id}"]`).waitFor();
  assert.equal(await dialog().locator('.s3-growth-row').count(), 1, `${id} opens its own explanation`);
  assert.equal(await dialog().locator('.s3-growth-row').getAttribute('data-stat'), id);
  assert.ok((await dialog().locator('.s3-growth-use').innerText()).trim().length > 8, `${id} explains actual gameplay uses`);
  if (description) assert.ok((await dialog().innerText()).includes(description), `${id} displays the production definition`);
}
async function closeAndExpectFocus(id, key = false) {
  if (key) await page.keyboard.press('Escape');
  else await page.locator('.s3-growth-close').click();
  await page.locator('.s3-growth-dialog[open]').waitFor({ state: 'hidden' });
  assert.ok(await part(id).evaluate(node => node === document.activeElement), `${id} regains focus after closing its explanation`);
}
async function fit(selector, name) {
  assert.ok(await page.locator(selector).evaluate(node => {
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1;
  }), `${name} fits inside the viewport`);
}
async function readGeometry() {
  return page.locator('.s3-compass').evaluate(node => ({
    split: Number(node.dataset.relationshipSplit),
    parts: [...node.querySelectorAll('[data-stat]')].map(group => ({
      stat: group.dataset.stat, value: Number(group.dataset.value), locked: group.dataset.locked,
      radius: Number(group.dataset.radius ?? group.querySelector('[data-radius]')?.dataset.radius),
      dash: group.querySelector('[stroke-dasharray]')?.getAttribute('stroke-dasharray'),
    })),
  }));
}
async function rasterProbe(name) {
  const result = await page.locator('.s3-compass > svg').evaluate(async svg => {
    const copy = svg.cloneNode(true);
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', '240'); copy.setAttribute('height', '240');
    const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob), image = new Image(); image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 240;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 240, 240); URL.revokeObjectURL(url);
    const pixel = (x, y) => [...context.getImageData(x, y, 1, 1).data];
    return { png: canvas.toDataURL('image/png'), pixels: {
      topLeft: pixel(2, 2), bottomRight: pixel(237, 237), emptyTop: pixel(86, 26),
      filledTop: pixel(120, 46), trust: pixel(25, 103), core: pixel(120, 76),
    }, backdrop: getComputedStyle(svg.parentElement).backgroundColor };
  });
  const path = `artifacts/campaign-compass-${name}.png`;
  await writeFile(path, Buffer.from(result.png.split(',')[1], 'base64')); artifacts.push(path);
  delete result.png;
  return result;
}

try {
  await mkdir('artifacts', { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem('project-hamilton:language:v1', 'dual');
    localStorage.setItem('project-hamilton:3d-quality:v1', 'low');
    localStorage.setItem('project-hamilton:3d-text-speed:v1', '0');
    localStorage.setItem('project-hamilton:voiceover-volume:v1', '0');
    localStorage.setItem('project-hamilton:music-volume:v1', '0');
  });
  const gameURL = new URL(base); gameURL.search = '?story=3d&debug=1';
  await page.goto(gameURL.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('.d3-canvas[data-mode="story"][data-ready="true"]').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => window.__streetTest?.story?.().chapter === 'Opening', undefined, { timeout: 60000 });
  assert.equal(await page.locator('.s3-compass').isVisible(), false, 'the prologue does not expose the campaign dial');
  assert.equal(await part('momentum').evaluate(node => node.getClientRects().length), 0, 'hidden prologue metrics have no focusable painted area');
  await capture('game-opening-no-compass');
  await page.locator('.d3-place[data-point="opening-letter"]').click();
  await page.locator('.s3-dialogue:not([hidden])').waitFor({ timeout: 20000 });
  for (let line = 0; line < 3; line++) { await page.locator('.s3-dialogue').focus(); await page.keyboard.press('Space'); }
  await page.locator('.s3-dialogue').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.s3-compass').isVisible(), false, 'the completed prologue still hides the dial');
  await page.locator('.d3-place[data-point="story-exit"]').click();
  await page.waitForFunction(() => window.__streetTest.story().chapter === 'Arrival' && document.querySelector('.d3-canvas')?.dataset.ready === 'true', undefined, { timeout: 30000 });
  await page.locator('.s3-compass').waitFor({ state: 'visible', timeout: 60000 });
  assert.equal(await page.locator('.s3-compass > svg').getAttribute('viewBox'), '0 0 240 240', 'real game mounts the campaign renderer');
  assert.equal(await part('washingtonTrust').getAttribute('data-locked'), 'true');
  const original = progress(await story());
  const openingSize = await page.locator('.s3-compass').boundingBox();
  assert.equal(openingSize.width, 174); assert.equal(openingSize.height, 174);
  await capture('game-arrival-174');
  await hover('momentum');
  const point = await screenPoint('momentum'); await page.mouse.click(point.x, point.y);
  await expectDialog('momentum'); await capture('game-explanation');
  await closeAndExpectFocus('momentum');
  assert.deepEqual(progress(await story()), original, 'real compass click neither moves the character nor advances the story');
  checks.push('real Opening hides the dial through the letter and exit; Arrival first displays the 174 px campaign renderer, locked trust, live tooltip, explanation and focus restoration without changing story state');
  for (const mode of ['en', 'zh', 'dual-en', 'dual']) {
    await page.keyboard.press('Escape'); await page.locator('.d3-settings[open]').waitFor();
    await page.locator('#d3-language').selectOption(mode);
    await page.locator('.d3-settings .d3-primary').click();
    await page.locator('.d3-settings[open]').waitFor({ state: 'hidden' });
    assert.deepEqual(progress(await story()), original, `real ${mode} language change preserves story state`);
    const text = await hover('momentum');
    assert.ok(mode === 'en' || mode === 'dual-en' ? text.includes('Momentum') && !/\p{Script=Han}/u.test(text) : text.includes('锐气'));
  }
  checks.push('real game: four language changes keep chapter, phase, index, completed interactions and all GameState values');

  const fixtureURL = new URL('/__campaign-compass-check.html', base);
  await page.route(fixtureURL.href, route => route.fulfill({ status: 200, contentType: 'text/html', body: fixtureHTML }));
  await page.goto(fixtureURL.href);
  await page.waitForFunction(() => !!window.__campaignCompassFixture);
  assert.equal(await page.locator('.s3-compass [data-stat][role="button"][tabindex="0"]').count(), 5);
  const initial = await fixture();
  for (const id of statIds) {
    const tooltip = await hover(id);
    const attribute = initial.attributes.find(item => item.id === id);
    assert.ok(tooltip.includes(attribute.name.zh), `${id} tooltip names its actual attribute`);
    if (id === 'washingtonTrust') assert.ok(/军营|解锁/.test(tooltip));
    else assert.ok(tooltip.includes(String(initial.state[id])));
    const point = await screenPoint(id); await page.mouse.click(point.x, point.y);
    await expectDialog(id, attribute.description.zh); await closeAndExpectFocus(id);
    await part(id).focus(); await page.keyboard.press('Enter');
    await expectDialog(id); await closeAndExpectFocus(id, true);
    await page.keyboard.press('Space'); await expectDialog(id); await closeAndExpectFocus(id);
  }
  assert.deepEqual((await fixture()).state, initial.state);
  checks.push('all five production sectors: pointer hit/hover/click, actual definition and uses, Enter, Space, Escape/button close, focus restoration, no stat mutation');
  await part('momentum').evaluate(node => { node.dataset.gained = ''; });
  await page.evaluate(() => window.__campaignCompassFixture.update({ momentum: 61 }));
  assert.equal(await part('momentum').getAttribute('data-gained'), '', 'production stat updates retain the reward highlight attribute');
  assert.ok((await fixture()).partsRetained, 'updates preserve the original interactive SVG groups');
  await part('momentum').evaluate(node => { delete node.dataset.gained; });
  checks.push('updates preserve data-gained reward highlight and original focus/event targets');

  for (const chapter of ['Arrival', 'Tavern', 'Debate', 'Washington', 'Yorktown']) {
    await page.evaluate(chapter => window.__campaignCompassFixture.update({ washingtonTrust: 50 }, chapter), chapter);
    const locked = !['Washington', 'Yorktown'].includes(chapter);
    assert.equal(await part('washingtonTrust').getAttribute('data-locked'), String(locked));
    await hover('washingtonTrust');
    const point = await screenPoint('washingtonTrust'); await page.mouse.click(point.x, point.y); await expectDialog('washingtonTrust');
    const value = await dialog().locator('.s3-growth-value').innerText();
    assert.equal(value, locked ? '尚未解锁' : '50');
    await closeAndExpectFocus('washingtonTrust');
  }
  checks.push('street/tavern/debate trust stays locked; Washington camp/Yorktown unlock without discarding the stored value');

  for (const value of [0, 50, 100]) {
    await page.evaluate(value => window.__campaignCompassFixture.update({ momentum: value, influence: value, washingtonTrust: value }, 'Washington'), value);
    const geometry = await readGeometry(); snapshots.push({ kind: 'radial-progress', value, ...geometry });
    for (const id of outerStats) {
      const item = geometry.parts.find(part => part.stat === id);
      assert.ok(Math.abs(item.radius - Math.sqrt(52 ** 2 + value / 100 * (108 ** 2 - 52 ** 2))) < .02, `${id}/${value}: outward radius matches equal-area progress`);
      assert.equal(item.value, value); assert.equal(item.locked, 'false'); assert.equal(item.dash, undefined, `${id} never uses clockwise dash progress`);
    }
    await page.mouse.move(600, 500); await page.locator('#fixture-note').click({ force: true });
    await capture(`fixture-progress-${value}`);
  }
  checks.push('0/50/100 for all three unlocked attributes: 52/84.7585/108 radii, full-sector outward growth, no angular dash progress');

  for (const [rivalry, respect] of [[0, 0], [100, 100], [100, 0], [0, 100], [51, 50], [50, 51]]) {
    await page.evaluate(([burrRivalry, burrRespect]) => window.__campaignCompassFixture.update({ burrRivalry, burrRespect }), [rivalry, respect]);
    const geometry = await readGeometry();
    assert.ok(geometry.split >= 94 && geometry.split <= 146, 'extremes retain both relation hit regions');
    if (rivalry === respect) assert.equal(geometry.split, 120);
    else assert.ok(rivalry > respect ? geometry.split > 120 : geometry.split < 120, 'red rivalry grows upward-to-downward while blue respect grows below');
    assert.equal(Number(await part('burrRivalry').getAttribute('data-value')), rivalry);
    assert.equal(Number(await part('burrRespect').getAttribute('data-value')), respect);
    for (const id of ['burrRivalry', 'burrRespect']) await hover(id);
    snapshots.push({ kind: 'relationship', rivalry, respect, split: geometry.split });
    if (rivalry + respect === 100) { await page.mouse.move(600, 500); await capture(`fixture-relation-${rivalry}-${respect}`); }
  }
  checks.push('relation equal/zero/extreme/one-point changes: visible exaggerated split, preserved independent numbers, both regions remain hittable');

  await page.evaluate(() => window.__campaignCompassFixture.update({ momentum: 50, influence: 50, washingtonTrust: 50, burrRivalry: 18, burrRespect: 24 }, 'Washington'));
  const unfilled = await rasterProbe('transparent-unlocked');
  assert.equal(unfilled.pixels.topLeft[3], 0); assert.equal(unfilled.pixels.bottomRight[3], 0);
  assert.ok(unfilled.pixels.emptyTop[3] > 20 && unfilled.pixels.emptyTop[3] < 240, 'unfilled track is translucent');
  assert.ok(unfilled.pixels.filledTop[3] > 245 && unfilled.pixels.core[3] > 245, 'coloured radial fill and core have solid faces');
  assert.equal(unfilled.backdrop, 'rgba(0, 0, 0, 0)', 'no beige HTML backing');
  await page.evaluate(() => window.__campaignCompassFixture.update({}, 'Arrival'));
  const locked = await rasterProbe('transparent-locked');
  assert.ok(locked.pixels.trust[3] > 245, 'locked graphite remains opaque and differs from the light translucent unfilled track');
  assert.ok(unfilled.pixels.trust[3] < 240 && locked.pixels.trust[3] - unfilled.pixels.trust[3] > 70, 'the same trust location separates translucent empty track from solid locked graphite');
  assert.ok(unfilled.pixels.trust.slice(0, 3).reduce((sum, value) => sum + value, 0) > locked.pixels.trust.slice(0, 3).reduce((sum, value) => sum + value, 0) + 120, 'empty and locked grays differ visibly in brightness');
  snapshots.push({ kind: 'alpha-and-fill', unfilled, locked });
  checks.push('transparent SVG corners and HTML backdrop; translucent unfilled track, solid coloured face, opaque locked graphite');

  const beforeLanguages = (await fixture()).state;
  for (const mode of ['zh', 'en', 'dual', 'dual-en']) {
    await page.evaluate(mode => window.__campaignCompassFixture.language(mode), mode);
    const current = await fixture();
    assert.deepEqual(current.state, beforeLanguages); assert.ok(current.chartRetained && current.partsRetained, 'language changes preserve the chart and keyboard targets');
    const english = ['en', 'dual-en'].includes(mode);
    for (const id of statIds) {
      const text = await hover(id), attribute = initial.attributes.find(item => item.id === id);
      assert.ok(text.includes(attribute.name[english ? 'en' : 'zh']));
      assert.equal(await tip().locator('.text-secondary').count(), 0, 'tooltips follow primary language only');
      if (english) assert.ok(!/\p{Script=Han}/u.test(text));
    }
    await part('washingtonTrust').focus(); await page.keyboard.press('Enter'); await expectDialog('washingtonTrust');
    assert.ok((await dialog().innerText()).includes(initial.attributes.find(item => item.id === 'washingtonTrust').description[english ? 'en' : 'zh']));
    assert.equal(await dialog().locator('.text-secondary').count(), 0);
    await closeAndExpectFocus('washingtonTrust');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.waitForFunction(expected => document.querySelector('.s3-compass').getBoundingClientRect().width === expected, width === 1440 ? 174 : 118);
      assert.equal((await page.locator('.s3-compass').boundingBox()).width, width === 1440 ? 174 : 118);
      await fit('.s3-compass', `${mode}/${width} dial`); await hover('washingtonTrust'); await fit('.s3-compass-tooltip', `${mode}/${width} tooltip`);
      if (width === 390) await capture(`fixture-${mode}-118`);
    }
  }
  checks.push('four primary-language modes: translated tooltips/definitions, single-language UI, stable chart/targets/state, 174 px desktop and 118 px narrow fit');
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  const report = { status: 'passed', baseURL: base.href, checks, snapshots, artifacts, errors, failures };
  await writeFile('artifacts/campaign-compass-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await capture('failure').catch(() => {});
  await writeFile('artifacts/campaign-compass-check.json', JSON.stringify({ status: 'failed', baseURL: base.href, error: error.stack, checks, snapshots, artifacts, errors, failures }, null, 2));
  throw error;
} finally { await browser.close(); }
