import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const previewPath = resolve('docs/designs/intro-background-0.5.2/preview.html');
const output = resolve('docs/designs/intro-background-0.5.2/verification');
const markup = await readFile(previewPath, 'utf8');
const sourceSha256 = createHash('sha256').update(markup).digest('hex');
const content = JSON.parse(markup.match(/const content = (\{.+\});\n/)?.[1] ?? 'null');
assert.ok(content?.versions?.a && content?.versions?.b, 'the standalone document embeds both complete content variants');
const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(15000);
const base = new URL('/docs/designs/intro-background-0.5.2/preview.html', process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776');
const requests = [], pageErrors = [], requestFailures = [], cases = [], screenshots = [];
page.on('request', request => requests.push({ url: request.url(), type: request.resourceType() }));
page.on('pageerror', error => pageErrors.push(error.message));
page.on('requestfailed', request => requestFailures.push({ url: request.url(), failure: request.failure()?.errorText }));
await page.addInitScript(() => {
  window.__previewStorageProbe = { accesses: 0 };
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { window.__previewStorageProbe.accesses++; throw new Error('The standalone preview accessed localStorage'); },
  });
});
const mainLanguage = mode => mode === 'en' || mode === 'dual-en' ? 'en' : 'zh';
async function verifyCopy(variant, mode, after = false) {
  const language = mainLanguage(mode), expected = content.versions[variant];
  assert.equal(await page.locator('html').getAttribute('lang'), language === 'en' ? 'en' : 'zh-CN');
  assert.equal(await page.locator('html').getAttribute('data-language'), mode);
  assert.equal(await page.locator('#version').inputValue(), variant);
  assert.equal(await page.locator('#language').inputValue(), mode);
  assert.equal(await page.locator('.stage').getAttribute('data-after'), String(after));
  assert.ok((await page.locator('.stage').getAttribute('class')).includes(`version-${variant}`));
  assert.equal(await page.title(), content.labels.project[language]);
  for (const field of ['era', 'title', 'subtitle', 'closing']) {
    assert.equal(await page.locator(`[data-copy="${field}"]`).textContent(), expected[field][language]);
  }
  assert.deepEqual(await page.locator('.body p').allTextContents(), expected.paragraphs.map(pair => pair[language]));
  const labels = await page.locator('[data-label]').evaluateAll(nodes => nodes.map(node => ({ key: node.dataset.label, text: node.textContent })));
  for (const label of labels) assert.equal(label.text, content.labels[label.key][language]);
  assert.equal(await page.locator('.player-role').isVisible(), variant === 'b' && !after);
  const languageOptions = await page.locator('#language option').evaluateAll(options => options.map(option => ({ text: option.textContent, lang: option.lang })));
  assert.deepEqual(languageOptions, content.languageOptions.map(option => ({ text: option.text[option.native], lang: option.native })));
  assert.equal(await page.locator('.after h2').textContent(), content.labels.nextTitle[language]);
  assert.equal(await page.evaluate(() => window.__previewStorageProbe.accesses), 0, 'the standalone preview neither reads nor writes localStorage');
  assert.equal(await page.locator('.text-secondary').count(), 0, 'only the primary language is rendered');
  assert.equal(await page.locator('article').isVisible(), !after);
  assert.equal(await page.locator('.after').isVisible(), after);
}
async function verifyLayout(name) {
  const result = await page.evaluate(() => {
    const stage = document.querySelector('.stage'), article = document.querySelector('article');
    const bounds = stage.getBoundingClientRect();
    const texts = [...article.querySelectorAll('[data-copy], .body p, .player-role, .chronology, .continue')];
    const clipped = texts.flatMap(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      const lines = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
      return lines.some(rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)
        ? [{ text: node.textContent, rectangles: lines.map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })), stage: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom } }] : [];
    });
    const paragraphs = [...article.querySelectorAll('.body p')].map(node => {
      const css = getComputedStyle(node);
      return { fontSize: Number.parseFloat(css.fontSize), lineHeight: Number.parseFloat(css.lineHeight), text: node.textContent };
    });
    const controls = [...document.querySelectorAll('select')].map(node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    });
    return {
      viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, documentHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight, stageHeight: bounds.height, articleHeight: article.getBoundingClientRect().height,
      columns: getComputedStyle(document.querySelector('.body')).columnCount, clipped, paragraphs, controls,
    };
  });
  assert.ok(result.documentWidth <= result.viewportWidth + 1, `${name}: no horizontal page overflow`);
  assert.deepEqual(result.clipped, [], `${name}: every body/title/footer line remains within the unclipped stage`);
  assert.ok(result.stageHeight + 1 >= result.articleHeight, `${name}: the stage grows with its content`);
  assert.ok(result.paragraphs.every(p => p.fontSize >= 16 && p.lineHeight / p.fontSize >= 1.6), `${name}: readable body size and leading`);
  assert.ok(result.controls.every(control => control.left >= 0 && control.right <= result.viewportWidth + 1 && control.width > 80), `${name}: selectors remain usable`);
  if (result.viewportWidth === 390) assert.ok(['auto', '1'].includes(result.columns), `${name}: mobile copy uses one column`);
  return { documentHeight: result.documentHeight, viewportHeight: result.viewportHeight, naturalScroll: result.documentHeight > result.viewportHeight, clippedTextLines: result.clipped.length };
}
async function exercise(transport, variant, mode, width, height, capture) {
  const url = new URL(transport === 'file' ? pathToFileURL(previewPath) : base);
  url.searchParams.set('v', variant); url.searchParams.set('lang', mode);
  await page.setViewportSize({ width, height });
  const firstRequest = requests.length;
  await page.goto(url.href); await page.locator('.body p').first().waitFor();
  await verifyCopy(variant, mode);
  const otherVariant = variant === 'a' ? 'b' : 'a';
  await page.locator('#version').selectOption(otherVariant); await verifyCopy(otherVariant, mode);
  await page.locator('#version').selectOption(variant); await verifyCopy(variant, mode);
  const otherLanguage = mainLanguage(mode) === 'en' ? 'zh' : 'en';
  await page.locator('#language').selectOption(otherLanguage); await verifyCopy(variant, otherLanguage);
  await page.locator('#language').selectOption(mode); await verifyCopy(variant, mode);
  const name = `${transport}/${variant}/${mode}/${width}x${height}`;
  const layout = await verifyLayout(name);
  await page.evaluate(() => scrollTo(0, 0));
  if (capture) {
    const path = resolve(output, `${variant}-${width}x${height}-${mode}.png`);
    await page.screenshot({ path, fullPage: true }); screenshots.push(path);
  }
  await page.locator('.continue').click(); await verifyCopy(variant, mode, true);
  assert.ok(await page.locator('.after h2').evaluate(node => node === document.activeElement), `${name}: entering the prologue preview moves focus to its title`);
  await page.locator('#language').selectOption(otherLanguage); await verifyCopy(variant, otherLanguage, true);
  await page.locator('#language').selectOption(mode); await verifyCopy(variant, mode, true);
  await page.locator('.replay').click(); await verifyCopy(variant, mode);
  assert.ok(await page.locator('.continue').evaluate(node => node === document.activeElement), `${name}: Read Again restores the continuation focus`);
  await verifyLayout(`${name}/replay`);
  const actualRequests = requests.slice(firstRequest);
  const unexpected = actualRequests.filter(request => {
    const requestURL = new URL(request.url);
    if (request.type === 'document' && requestURL.href === url.href) return false;
    // Vite adds these development-only modules; none belongs to the preview or game.
    const viteInfrastructure = requestURL.pathname === '/@vite/client'
      || requestURL.pathname.startsWith('/node_modules/') && requestURL.pathname.endsWith('/vite/dist/client/env.mjs');
    return transport !== 'vite' || requestURL.origin !== base.origin || !viteInfrastructure;
  });
  assert.deepEqual(unexpected, [], `${name}: no external, game, media, or extra resource requests`);
  cases.push({ transport, variant, mode, width, height, ...layout, checks: ['exact primary-language copy', 'native language option names', 'variant and language switching', 'continue to prologue preview', 'language switch retains preview phase', 'Read Again and keyboard focus', 'no horizontal overflow', 'body text not clipped', 'zero localStorage access'], requests: actualRequests });
}

try {
  await mkdir(output, { recursive: true });
  for (const variant of ['a', 'b']) for (const [width, height] of [[1440, 1000], [390, 844]]) for (const mode of ['dual', 'dual-en', 'zh', 'en']) {
    await exercise('vite', variant, mode, width, height, true);
  }
  for (const variant of ['a', 'b']) for (const mode of ['dual', 'dual-en', 'zh', 'en']) {
    await exercise('file', variant, mode, 390, 844, false);
  }
  assert.deepEqual(pageErrors, []); assert.deepEqual(requestFailures, []);
  assert.equal(createHash('sha256').update(await readFile(previewPath, 'utf8')).digest('hex'), sourceSha256, 'all evidence belongs to one unchanged preview revision');
  const report = { status: 'passed', sourceSha256, cases, screenshots, pageErrors, requestFailures, resourcePolicy: 'Vite preview requests only the HTML and Vite development modules. file:// requests only the HTML. No external resources, game resources, or localStorage accesses.' };
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, cases: cases.length, screenshots: screenshots.length, pageErrors, requestFailures }, null, 2));
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ status: 'failed', sourceSha256, cases, screenshots, pageErrors, requestFailures, error: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
