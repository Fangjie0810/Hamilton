import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const base = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/'); base.search = ''; base.hash = '';
const report = { lifecycle: [], presentation: [], layouts: [], contrasts: [], errors: [], failures: [] };
const chapterIds = ['Opening', 'Arrival', 'Tavern', 'Debate', 'Washington', 'Yorktown'];
let activePage;

function monitor(page, name) {
  activePage = page;
  page.on('pageerror', error => report.errors.push(`${name}: ${error.message}`));
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) report.failures.push(`${name}: ${response.status()} ${response.url()}`);
  });
}

// Instrument timings without replacing their duration or advancing the story.
async function instrument(context, reduced) {
  await context.addInitScript(({ reduced }) => {
    localStorage.setItem('project-hamilton:3d-quality:v1', 'low');
    localStorage.setItem('project-hamilton:3d-motion:v1', String(reduced));
    localStorage.setItem('project-hamilton:3d-text-speed:v1', '0');
    localStorage.setItem('project-hamilton:language:v1', 'dual');
    window.__curtainTiming = { animations: [], waits: [] };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options);
      if (this.matches('.d3-chapter-loading')) {
        const canvas = document.querySelector('.d3-canvas');
        const item = { chapter: this.dataset.chapter, duration: animation.effect.getTiming().duration, start: performance.now(), frames,
          canvasReady: canvas?.dataset.frameReady, canvasVisibility: canvas ? getComputedStyle(canvas).visibility : null,
          backdrop: getComputedStyle(this).backgroundColor };
        window.__curtainTiming.animations.push(item);
        animation.finished.then(() => { item.end = performance.now(); }, () => { item.cancelled = true; });
      }
      return animation;
    };
    const timeout = window.setTimeout;
    window.setTimeout = function (callback, delay, ...args) {
      if ([250, 2875].includes(delay) && typeof callback === 'function' && new Error().stack?.includes('switchScene')) {
        const item = { delay, start: performance.now() }; window.__curtainTiming.waits.push(item);
        return timeout.call(window, (...values) => { item.end = performance.now(); callback(...values); }, delay, ...args);
      }
      return timeout.call(window, callback, delay, ...args);
    };
  }, { reduced });
}

async function actualLifecycle({ reduced = false, missing = false, delayed = false } = {}) {
  const name = missing ? 'missing artwork' : delayed ? 'delayed artwork' : reduced ? 'reduced motion' : 'normal motion';
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  await instrument(context, reduced);
  const page = await context.newPage(); monitor(page, name);
  let requestedAt, imageReleased = false;
  if (missing || delayed) await page.route('**/art/backgrounds/opening-a.png', async route => {
    requestedAt ??= Date.now();
    if (missing) return route.abort('failed');
    await new Promise(resolve => setTimeout(resolve, 7500));
    imageReleased = true;
    await route.continue().catch(() => {}); // The test may already have closed its isolated context.
  });
  const url = new URL(base); url.search = '?story=3d&debug=1';
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.locator('.d3-loading.d3-chapter-loading[data-chapter=Opening]').waitFor();
  assert.equal(await page.locator('.d3-chapter-copy h1 .text-primary').textContent(), '海的另一边');
  if (!missing && !delayed) {
    await page.locator('.d3-chapter-art.is-ready').waitFor();
    assert.equal(await page.locator('.d3-chapter-art').getAttribute('src'), '/art/backgrounds/opening-a.png');
  }
  if (!reduced && !missing && !delayed) {
    await page.waitForFunction(() => window.__curtainTiming.waits.some(item => item.delay === 2875 && !item.end));
    const curtain = await page.locator('.d3-chapter-loading').elementHandle();
    const art = await page.locator('.d3-chapter-art').elementHandle();
    for (const language of ['en', 'zh', 'dual']) {
      await page.evaluate(async language => (await import('/src/i18n/text.ts')).setLanguage(language), language);
      assert.ok(await curtain.evaluate(node => node === document.querySelector('.d3-chapter-loading')), 'language retains the real transition element');
      assert.ok(await art.evaluate(node => node === document.querySelector('.d3-chapter-art')), 'language retains the loaded image');
    }
    await page.screenshot({ path: 'artifacts/chapter-transition-actual-opening.png', animations: 'allow' });
  }
  if (missing) {
    await page.locator('.d3-chapter-art').waitFor({ state: 'detached' });
    assert.ok(await page.locator('.d3-chapter-copy').isVisible(), 'failed artwork preserves readable title card');
    await page.screenshot({ path: 'artifacts/chapter-transition-missing-art.png', animations: 'allow' });
  }
  await page.locator('.d3-canvas[data-mode=story][data-ready=true]').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => window.__streetTest?.story()?.chapter === 'Opening');
  assert.equal(await page.locator('.d3-chapter-loading').count(), 0, 'actual story removes the completed curtain');
  assert.ok(await page.locator('.d3-canvas').evaluate(node => node === document.activeElement), 'actual story regains canvas focus');
  const timing = await page.evaluate(() => window.__curtainTiming);
  assert.equal(timing.animations.length, 2, `${name}: precisely one fade in and one fade out`);
  assert.ok(timing.animations.every(item => item.duration === (reduced ? 250 : 550) && item.end && !item.cancelled), `${name}: unchanged fade timings`);
  const reveal = timing.animations[1];
  assert.equal(reveal.canvasReady, 'true', `${name}: world has actually rendered before curtain reveals it`);
  assert.equal(reveal.canvasVisibility, 'visible', `${name}: revealed world canvas is visible`);
  assert.ok(timing.animations.every(item => item.backdrop === 'rgb(11, 11, 11)'), `${name}: fading curtain has neutral backing, never green`);
  assert.equal(timing.waits.length, 1, `${name}: one title hold, unaffected by language or images`);
  assert.equal(timing.waits[0].delay, reduced ? 250 : 2875);
  assert.ok(timing.waits[0].end - timing.waits[0].start >= timing.waits[0].delay - 20, `${name}: actual hold elapsed`);
  if (delayed) {
    assert.ok(requestedAt && !imageReleased, 'actual story starts while its artwork response remains deliberately withheld');
    assert.ok(Date.now() - requestedAt < 7500, 'artwork never becomes a 7.5-second critical dependency');
  }
  report.lifecycle.push({ name, timing, readyBeforeImage: delayed ? !imageReleased : undefined });
  await context.close();
}

async function presentationHarness() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); monitor(page, 'presentation harness');
  await page.goto(base.href); await page.locator('.entry-screen').waitFor();
  await page.addStyleTag({ url: '/src/demo3d/demo.css' });
  await page.evaluate(async () => {
    const transitions = await import('/src/story3d/ChapterTransition.ts');
    const data = await import('/src/data/chapters.ts');
    const language = await import('/src/i18n/text.ts');
    const app = document.querySelector('#app'); app.className = 'demo3d story3d'; app.replaceChildren();
    const ui = document.createElement('div'); ui.className = 'd3-ui';
    const root = document.createElement('div'); root.className = 'd3-loading'; ui.append(root); app.append(ui);
    window.__chapterPresentation = { ...transitions, ...data, ...language, root };
  });
  await page.evaluate(() => document.fonts.ready);

  async function render(chapter, variant = 'a', language = 'dual') {
    const expected = await page.evaluate(({ chapter, variant, language }) => {
      const harness = window.__chapterPresentation;
      harness.setLanguage(language); harness.renderChapterTransition(harness.root, harness.chapters[chapter], variant);
      return harness.chapterBackdropSource(chapter, variant) ?? null;
    }, { chapter, variant, language });
    assert.equal(await page.locator('.d3-chapter-loading').getAttribute('data-chapter'), chapter);
    if (expected) {
      await page.locator('.d3-chapter-art.is-ready').waitFor();
      assert.equal(await page.locator('.d3-chapter-art').getAttribute('src'), expected);
      assert.ok(await page.locator('.d3-chapter-art').evaluate(node => node.complete && node.naturalWidth > 0 && node.alt === ''), 'decorative image loaded without alternative text noise');
    } else assert.equal(await page.locator('.d3-chapter-art').count(), 0, `${chapter}/${variant}: intentional color fallback requests no unrelated image`);
    return expected;
  }

  for (const chapter of chapterIds) for (const variant of ['a', 'b', 'c']) {
    const expected = await render(chapter, variant);
    const source = ['Opening', 'Arrival'].includes(chapter) ? `/art/backgrounds/${chapter.toLowerCase()}-${variant}.png`
      : chapter === 'Tavern' ? '/art/backgrounds/tavern-a.png' : null;
    assert.equal(expected, source, `${chapter}/${variant}: approved matching chapter inventory`);
    report.presentation.push({ chapter, variant, source });
  }

  for (const [size, viewport] of [['desktop', { width: 1440, height: 900 }], ['compact', { width: 1024, height: 640 }]]) {
    await page.setViewportSize(viewport);
    for (const chapter of chapterIds) for (const language of size === 'compact' ? ['dual', 'zh', 'en'] : ['dual']) {
      await render(chapter, 'a', language);
      const layout = await page.locator('.d3-chapter-loading').evaluate(root => {
        const selectors = ['.d3-chapter-copy', '.d3-kicker', 'h1', '.d3-chapter-subtitle', '.d3-chapter-place'];
        return {
          width: innerWidth, height: innerHeight, scrollWidth: root.scrollWidth, scrollHeight: root.scrollHeight,
          bounds: selectors.map(selector => {
            const node = root.querySelector(selector), rect = node.getBoundingClientRect();
            return { selector, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
          }),
        };
      });
      assert.ok(layout.scrollWidth <= viewport.width + 1 && layout.scrollHeight <= viewport.height + 1, `${chapter}/${size}/${language}: no transition overflow`);
      for (const bounds of layout.bounds) assert.ok(bounds.width > 0 && bounds.height > 0 && bounds.left >= 0 && bounds.right <= viewport.width + 1 && bounds.top >= 0 && bounds.bottom <= viewport.height + 1, `${chapter}/${size}/${language}: ${bounds.selector} fits ${JSON.stringify(bounds)}`);
      if (language === 'en') assert.ok(!/\p{Script=Han}/u.test(await page.locator('.d3-chapter-copy').innerText()));
      if (language === 'zh') assert.equal(await page.locator('.d3-chapter-copy .text-secondary').count(), 0);
      if (language === 'dual') assert.equal(await page.locator('.d3-chapter-copy h1 .text-secondary').count(), 1);
      const contrast = await page.locator('.d3-chapter-loading').evaluate(root => {
        const color = value => {
          const channels = value.match(/[\d.]+/g).map(Number);
          return { rgb: channels.slice(0, 3), alpha: channels[3] ?? 1 };
        };
        const over = (front, back, opacity = 1) => front.rgb.map((channel, index) => channel * front.alpha * opacity + back[index] * (1 - front.alpha * opacity));
        const luminance = rgb => rgb.map(channel => {
          const value = channel / 255;
          return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
        }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
        const copy = root.querySelector('.d3-chapter-copy');
        const shadeColor = color(getComputedStyle(root.querySelector('.d3-chapter-shade')).backgroundColor);
        const copyColor = color(getComputedStyle(copy).backgroundColor);
        // Conservative bound: pure-white image, only the uniform shade and copy panel.
        // Additional dark gradients and text shadows intentionally contribute no credit.
        const background = over(copyColor, over(shadeColor, [255, 255, 255]));
        const readings = [];
        for (const selector of ['.d3-kicker', 'h1', '.d3-chapter-subtitle', '.d3-chapter-place']) {
          const block = copy.querySelector(selector);
          const leaves = block.querySelectorAll('.text-primary, .text-secondary');
          for (const node of leaves.length ? leaves : [block]) {
            const style = getComputedStyle(node);
            let opacity = 1;
            for (let ancestor = node; ancestor && ancestor !== root; ancestor = ancestor.parentElement) opacity *= Number(getComputedStyle(ancestor).opacity);
            const foreground = over(color(style.color), background, opacity);
            const ratio = (luminance(foreground) + .05) / (luminance(background) + .05);
            readings.push({ selector: `${selector}${node === block ? '' : ` .${node.className}`}`, color: style.color, opacity, ratio });
          }
        }
        return { background, readings };
      });
      for (const reading of contrast.readings) {
        if (reading.selector.includes('text-secondary')) assert.equal(reading.opacity, 1, `${chapter}/${size}: secondary text retains full opacity`);
        assert.ok(reading.ratio >= 7, `${chapter}/${size}/${language}: conservative contrast ${reading.selector} is ${reading.ratio.toFixed(2)}`);
      }
      report.contrasts.push({ chapter, size, language, ...contrast });
      report.layouts.push({ chapter, size, language, ...layout });
      if (['Opening', 'Arrival', 'Tavern'].includes(chapter) && (language === 'dual' || chapter === 'Arrival')) {
        await page.screenshot({ path: `artifacts/chapter-transition-${chapter.toLowerCase()}-${language}-${size}.png` });
      }
    }
  }

  // A superseded image may finish loading, but cannot append itself into a later curtain.
  const replaced = await page.evaluate(() => {
    const harness = window.__chapterPresentation;
    harness.renderChapterTransition(harness.root, harness.chapters.Opening, 'a');
    const stale = harness.root.querySelector('img');
    harness.renderChapterTransition(harness.root, harness.chapters.Debate, 'a');
    stale.dispatchEvent(new Event('load'));
    return { chapter: harness.root.dataset.chapter, images: harness.root.querySelectorAll('img').length, staleConnected: stale.isConnected };
  });
  assert.deepEqual(replaced, { chapter: 'Debate', images: 0, staleConnected: false });
  report.presentation.push({ check: 'a superseded image cannot reappear in a later chapter' });
  await context.close();
}

try {
  await mkdir('artifacts', { recursive: true });
  await actualLifecycle();
  await actualLifecycle({ reduced: true });
  await actualLifecycle({ missing: true });
  await actualLifecycle({ delayed: true });
  await presentationHarness();
  assert.deepEqual(report.errors, [], 'no uncaught browser errors');
  assert.deepEqual(report.failures, [], 'no unexpected failed HTTP resources');
  await writeFile('artifacts/chapter-transition-report.json', JSON.stringify(report, null, 2));
  const minimumContrast = Math.min(...report.contrasts.flatMap(item => item.readings.map(reading => reading.ratio)));
  console.log(`PASS chapter transitions: ${report.lifecycle.length} actual lifecycle cases; 18 inventory/variant cases; ${report.layouts.length} layouts; minimum computed contrast ${minimumContrast.toFixed(2)}:1 against a pure-white source with only uniform scrims; stale-image isolation; no unexpected browser or HTTP errors.`);
} catch (error) {
  await activePage?.screenshot({ path: 'artifacts/chapter-transition-failure.png' }).catch(() => {});
  await writeFile('artifacts/chapter-transition-report.json', JSON.stringify({ ...report, error: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
