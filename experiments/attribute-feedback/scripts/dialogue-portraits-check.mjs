import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const base = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/'); base.search = ''; base.hash = '';
const checks = [], errors = [], failures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`); });
const storyScope = '.s3-dialogue-stage';
const activityScope = '.activity-stage';

async function tick(ms) {
  await page.evaluate(ms => { for (let left = ms; left > 0; left -= 100) window.__portraits.ui.update(Math.min(100, left)); }, ms);
}

async function pair(scope = storyScope) {
  return page.locator(`${scope} .dialogue-portraits`).evaluate(root => ({
    hidden: root.hidden, speaker: root.dataset.speaker, talking: root.dataset.talking,
    paused: root.dataset.paused, reduced: root.dataset.reducedMotion,
    slots: [...root.querySelectorAll('.dialogue-portrait-slot')].map(slot => ({
      id: slot.dataset.character, side: slot.dataset.side, facing: slot.dataset.facing,
      active: slot.dataset.active, talking: slot.dataset.talking, frame: slot.dataset.frame, art: slot.dataset.art,
    })),
  }));
}

async function expectPair(speaker, partner, scope = storyScope) {
  const state = await pair(scope);
  assert.equal(state.hidden, false);
  assert.equal(state.speaker, speaker);
  assert.deepEqual(state.slots.map(slot => slot.id).sort(), [speaker, partner].sort());
  assert.deepEqual(state.slots.filter(slot => slot.active === 'true').map(slot => slot.id), [speaker]);
  for (const slot of state.slots) assert.equal(slot.facing, slot.side === 'left' ? 'right' : 'left', 'both figures face inward');
  return state;
}

async function canvasStats(character, scope = storyScope) {
  return page.locator(`${scope} .dialogue-portrait-slot[data-character="${character}"] canvas`).evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0, brightness = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 100) {
      count++; brightness += .2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2];
    }
    return { count, brightness: brightness / Math.max(1, count), width: canvas.width, height: canvas.height };
  });
}

async function expectLayout(scope, panelSelector, label) {
  const result = await page.locator(scope).evaluate((root, panelSelector) => {
    const panel = root.querySelector(panelSelector), box = panel.getBoundingClientRect();
    const slots = [...root.querySelectorAll('.dialogue-portrait-slot')].map(slot => {
      const rect = slot.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height };
    });
    return { panel: { left: box.left, right: box.right, top: box.top, bottom: box.bottom, client: panel.clientWidth, scroll: panel.scrollWidth },
      slots, width: innerWidth, height: innerHeight, docScroll: document.documentElement.scrollWidth };
  }, panelSelector);
  const { panel, slots, width, height } = result;
  assert.ok(panel.left >= -1 && panel.right <= width + 1 && panel.scroll <= panel.client + 1, `${label}: panel horizontal overflow ${JSON.stringify(result)}`);
  assert.ok(panel.top >= 0 && panel.bottom <= height + 1, `${label}: panel outside viewport ${JSON.stringify(result)}`);
  assert.ok(result.docScroll <= width + 1, `${label}: document horizontal overflow`);
  assert.equal(slots.length, 2);
  for (const slot of slots) {
    assert.ok(slot.left >= -1 && slot.right <= width + 1 && slot.top >= -1, `${label}: portrait clipped by viewport ${JSON.stringify(result)}`);
    assert.ok(slot.height >= 60 && slot.top < panel.top, `${label}: upper body rises above dialogue ${JSON.stringify(result)}`);
  }
}

try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(base.href); await page.locator('.entry-screen').waitFor();
  // Keep real voice queue ownership and events deterministic. Actual MP3 decoding is
  // separately covered by voiceover-check.mjs; no gameplay phase/timer is overwritten.
  await page.evaluate(async () => {
    class TestAudio extends EventTarget {
      src = ''; preload = ''; volume = 1; currentTime = 0; paused = true; ended = false;
      play() { this.paused = false; this.ended = false; this.dispatchEvent(new Event('playing')); return Promise.resolve(); }
      pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
      load() {}
      removeAttribute(name) { if (name === 'src') this.src = ''; }
      finish() { this.ended = true; this.paused = true; this.dispatchEvent(new Event('ended')); }
      constructor() { super(); window.__portraitAudio.push(this); }
    }
    window.__portraitAudio = []; window.Audio = TestAudio;
    const [{ StoryUI }, { StateSystem }, { chapters }, { characters }, { smallTalk }, i18n, { voiceover }] = await Promise.all([
      import('/src/story3d/StoryUI.ts'), import('/src/systems/StateSystem.ts'), import('/src/data/chapters.ts'),
      import('/src/data/characters.ts'), import('/src/data/smallTalk.ts'), import('/src/i18n/text.ts'), import('/src/ui/voiceover.ts'), import('/src/demo3d/demo.css'),
    ]);
    voiceover.stop(); voiceover.setEnabled(true); voiceover.setPaused('hidden', false); voiceover.setPaused('focus', false);
    const app = document.querySelector('#app'); app.className = 'demo3d story3d'; app.replaceChildren();
    const lines = Object.values(chapters).flatMap(chapter => chapter.interactions.flatMap(interaction => interaction.lines));
    const h = window.__portraits = { state: new StateSystem(), blocked: false, chapters, characters, lines, i18n, voiceover, advanced: 0 };
    h.bySpeaker = Object.fromEntries(Object.keys(characters).map(id => [id, lines.find(line => line.speaker === id) ?? smallTalk[id]]));
    h.ui = new StoryUI(app, () => h.blocked); h.ui.textSpeed = 0; h.ui.reduceMotion = false;
    // Forward the actual Space gesture as Demo does; the isolated fixture has no Demo host.
    document.addEventListener('keydown', event => {
      if (event.key === ' ' && event.target instanceof Element && event.target.closest('.s3-dialogue') && !(event.target instanceof HTMLButtonElement)) {
        if (h.ui.key(' ', true)) event.preventDefault();
      }
    });
    await (await import('/src/ui/DialoguePortraits.ts')).preloadDialoguePortraits();
    h.ui.showChapter(chapters.Arrival, 1, h.state.state);
  });

  for (const speaker of ['hamilton', 'burr', 'washington', 'laurens', 'lafayette', 'mulligan', 'loyalist', 'newsboy', 'citizen', 'narrator']) {
    const partner = speaker === 'hamilton' ? 'burr' : 'hamilton';
    await page.evaluate(({ speaker, partner }) => { const h = window.__portraits; h.ui.showLine(h.bySpeaker[speaker], () => h.advanced++, false, undefined, partner); }, { speaker, partner });
    await page.waitForFunction(scope => [...document.querySelectorAll(`${scope} .dialogue-portrait-slot`)].every(slot => slot.dataset.art === 'atlas'), storyScope);
    const state = await expectPair(speaker, partner);
    assert.equal(state.talking, 'true', `${speaker}: voice starts the speaking pose`);
    assert.ok((await canvasStats(speaker)).count > 100, `${speaker}: portrait contains visible authored pixels`);
  }
  await page.screenshot({ path: 'artifacts/dialogue-portraits-narrator.png' });
  checks.push('all ten actual story speakers have visible portraits, opposite inward facings, and one active figure');

  await page.evaluate(() => { const h = window.__portraits; h.ui.showLine(h.bySpeaker.hamilton, () => {}, false, undefined, 'burr'); });
  const leftBefore = (await pair()).slots.find(slot => slot.id === 'hamilton').side;
  const bright = await canvasStats('hamilton');
  await page.evaluate(() => { const h = window.__portraits; h.ui.showLine(h.bySpeaker.burr, () => {}, false, undefined, 'hamilton'); });
  const dark = await canvasStats('hamilton');
  assert.equal((await pair()).slots.find(slot => slot.id === 'hamilton').side, leftBefore, 'characters stay on their side when the speaker changes');
  assert.ok(bright.brightness > dark.brightness * 1.3, `inactive Hamilton is actually darkened ${JSON.stringify({ bright, dark })}`);
  const frames = new Set();
  for (let step = 0; step < 16; step++) { await tick(100); frames.add((await pair()).slots.find(slot => slot.id === 'burr').frame); }
  assert.ok(frames.size >= 2, 'talking changes the pixel pose');
  await page.evaluate(() => { const h = window.__portraits; h.blocked = true; h.voiceover.setPaused('portrait-test', true); });
  await tick(100); const paused = await pair();
  await tick(700); assert.deepEqual(await pair(), paused, 'pause freezes portrait frames and emphasis');
  assert.equal(paused.talking, 'false');
  await page.evaluate(() => { const h = window.__portraits; h.blocked = false; h.voiceover.setPaused('portrait-test', false); });
  await tick(100); assert.equal((await pair()).talking, 'true');
  await page.evaluate(() => window.__portraits.ui.reduceMotion = true); await tick(100);
  const reduced = await pair(); await tick(900); assert.deepEqual(await pair(), reduced, 'reduced motion freezes mouth/gesture cycling');
  await page.evaluate(() => window.__portraits.ui.reduceMotion = false);
  checks.push('stable left/right placement, real grey-dark listener pixels, talking poses, pause/resume, and reduced motion');

  await page.evaluate(() => {
    const h = window.__portraits, interaction = h.chapters.Arrival.interactions.find(item => item.id === 'arrival-burr'), option = interaction.choice.options[0];
    h.ui.showLine(option.reply[0], () => {}, false, { speaker: 'hamilton', text: option.text }, 'hamilton');
    h.oldAudio = window.__portraitAudio.at(-1);
  });
  assert.equal((await pair()).speaker, 'hamilton', 'selected player response owns the first voice cue');
  await page.evaluate(() => window.__portraitAudio.at(-1).finish());
  assert.equal((await pair()).speaker, 'burr', 'opponent takes emphasis when their queued voice begins');
  await page.evaluate(() => {
    const h = window.__portraits; h.oldAudio = window.__portraitAudio.at(-1);
    h.ui.showLine(h.bySpeaker.washington, () => {}, false, undefined, 'hamilton');
    h.oldAudio.dispatchEvent(new Event('playing')); h.oldAudio.dispatchEvent(new Event('ended'));
  });
  await expectPair('washington', 'hamilton');
  await page.evaluate(() => window.__portraitAudio.at(-1).dispatchEvent(new Event('waiting')));
  assert.equal((await pair()).talking, 'false', 'buffering stops mouth movement');
  await page.evaluate(() => window.__portraitAudio.at(-1).dispatchEvent(new Event('playing')));
  assert.equal((await pair()).talking, 'true');
  await page.evaluate(() => window.__portraitAudio.at(-1).finish());
  assert.equal((await pair()).talking, 'false', 'end of speech rests the portrait');
  checks.push('selected response queue transfers emphasis with voice; stale audio after fast advance cannot reclaim it; buffering and end rest poses');

  await page.evaluate(() => {
    const h = window.__portraits; h.voiceover.setEnabled(false);
    h.longLine = h.lines.reduce((longest, line) => line.text.zh.length + line.text.en.length > longest.text.zh.length + longest.text.en.length ? line : longest);
    h.ui.showLine(h.longLine, () => h.advanced++, false, h.bySpeaker.hamilton, h.longLine.speaker === 'hamilton' ? 'burr' : 'hamilton');
    h.lineNode = document.querySelector('.s3-line'); h.voiceCount = window.__portraitAudio.length;
  });
  assert.equal((await pair()).speaker, 'hamilton', 'without audio, the selected player response still acts before the reply');
  assert.equal((await pair()).talking, 'true', 'the selected response has a finite silent speaking performance');
  const mutedReplySpeaker = await page.evaluate(() => window.__portraits.longLine.speaker);
  await tick(500);
  assert.equal((await pair()).speaker, 'hamilton', 'the selected response is not skipped immediately');
  for (let guard = 0; guard < 80 && (await pair()).speaker === 'hamilton'; guard++) await tick(100);
  assert.equal((await pair()).speaker, mutedReplySpeaker, 'the silent sequence hands focus to the actual reply in order');
  assert.equal((await pair()).talking, 'true', 'the reply begins its own silent speaking performance');
  for (let guard = 0; guard < 80 && (await pair()).talking === 'true'; guard++) await tick(100);
  assert.equal((await pair()).speaker, mutedReplySpeaker, 'the reply retains focus after finishing');
  assert.equal((await pair()).talking, 'false', 'the silent reply finishes with a closed mouth');
  assert.equal(await page.locator(`${storyScope} .dialogue-portraits`).getAttribute('data-phase'), 'settled', 'the silent reply holds its authored final attitude');
  const mutedSettled = await pair(); await tick(1000);
  assert.deepEqual(await pair(), mutedSettled, 'a finished silent sequence never loops or replays the selected response');
  assert.ok(await page.evaluate(() => { const h = window.__portraits; return h.voiceCount === window.__portraitAudio.length && h.advanced === 0; }), 'silent acting neither creates audio nor advances the dialogue');
  checks.push('muted selected response acts first, hands focus to the reply, then holds its closed-mouth final reaction without audio or automatic advance');
  for (const viewport of [{ width: 1280, height: 900 }, { width: 1024, height: 640 }, { width: 390, height: 720 }]) {
    await page.setViewportSize(viewport);
    for (const mode of ['zh', 'en', 'dual', 'dual-en']) {
      await page.evaluate(mode => window.__portraits.i18n.setLanguage(mode), mode);
      assert.ok(await page.evaluate(() => { const h = window.__portraits; return h.lineNode === document.querySelector('.s3-line') && h.voiceCount === window.__portraitAudio.length && h.advanced === 0; }), 'language changes preserve dialogue DOM and voice session');
      assert.equal(await page.locator('.s3-line > .text-secondary').count(), mode.startsWith('dual') ? 1 : 0);
      await expectLayout(storyScope, '.s3-dialogue', `story ${mode} ${viewport.width}`);
      assert.equal(await page.locator('.s3-dialogue-footer,.s3-advance').count(), 0, 'removed dialogue footer stays absent');
      await page.locator('.s3-line').scrollIntoViewIfNeeded();
      assert.ok(await page.locator('.s3-line').isVisible(), 'long dialogue text remains reachable by scrolling');
      await page.locator('.s3-dialogue').focus();
      assert.ok(await page.locator('.s3-dialogue').evaluate(node => node === document.activeElement), 'dialogue retains a keyboard target for Space');
      if (mode.startsWith('dual')) await page.screenshot({ path: `artifacts/dialogue-portraits-${mode}-${viewport.width}.png` });
    }
  }
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => window.__portraits.advanced), 1, 'Space advances exactly once after every non-mutating language/layout check');
  await page.evaluate(() => window.__portraits.ui.clearDialogue());
  assert.equal(await page.locator(`${storyScope}:not([hidden]) .dialogue-portraits:not([hidden])`).count(), 0, 'closing dialogue removes both portraits');
  checks.push('four languages at 1280/1024/390 widths preserve state, keep large portraits and scrollable dialogue in viewport, omit the old footer, and allow one final Space advance');

  await page.setViewportSize({ width: 1024, height: 640 });
  for (const kind of ['debate', 'writing', 'yorktown']) {
    await page.evaluate(kind => { const h = window.__portraits; h.voiceover.setEnabled(true); h.ui.showActivity(kind, h.state, () => {}); }, kind);
    if (kind === 'debate') {
      await expectPair('loyalist', 'hamilton', activityScope);
      await page.locator('.activity-body .primary').click();
      assert.equal((await expectPair('loyalist', 'hamilton', activityScope)).talking, 'false', 'displayed argument keeps its pair while choosing');
      await page.locator('[data-response="FACT"]').click();
      assert.equal((await expectPair('hamilton', 'loyalist', activityScope)).talking, 'false', 'selected response has portraits before its scored delivery');
      await tick(1200);
      await page.locator('.beat-button').click();
      await expectPair('hamilton', 'loyalist', activityScope);
    } else {
      assert.equal(await page.locator(`${activityScope} .dialogue-portraits:not([hidden])`).count(), 0, `${kind}: rules have no invented speaker`);
      await page.locator('.activity-body .primary').click();
      if (kind === 'writing') await page.locator('[data-fragment]').first().click();
      else {
        await page.evaluate(() => window.__portraits.ui.key('d', true));
        for (let guard = 0; await page.locator('.activity-overlay').getAttribute('data-phase') === 'approach' && guard < 30; guard++) await tick(1000);
        await page.evaluate(() => window.__portraits.ui.key('d', false));
        await page.locator('[data-squad="0"][data-order="ADVANCE"]').click();
        await page.locator('[data-squad="1"][data-order="FLANK"]').click();
        await page.locator('[data-squad="2"][data-order="HOLD"]').click();
        await page.locator('.deploy-button').click(); await page.locator('.activity-body .primary').click();
      }
      await expectPair('hamilton', kind === 'writing' ? 'washington' : 'lafayette', activityScope);
    }
    await tick(100);
    for (const viewport of [{ width: 1024, height: 640 }, { width: 390, height: 720 }]) {
      await page.setViewportSize(viewport);
      for (const mode of ['dual', 'dual-en']) {
        await page.evaluate(mode => window.__portraits.i18n.setLanguage(mode), mode);
        await expectLayout(activityScope, '.activity-panel', `${kind} ${mode} ${viewport.width}`);
      }
    }
    await page.screenshot({ path: `artifacts/dialogue-portraits-${kind}-390.png` });
    await page.evaluate(() => window.__portraits.ui.clear());
    assert.equal(await page.locator('.activity-overlay').count(), 0);
    assert.ok(await page.evaluate(() => window.__portraitAudio.every(audio => audio.paused)), `${kind}: cleanup stops previous voice`);
    await page.setViewportSize({ width: 1024, height: 640 });
  }
  checks.push('debate, clicked dispatch fragments and Yorktown spoken commands show portraits; unspoken rules do not; all activities fit both bilingual small-window modes and clean up');
  assert.deepEqual(errors, []); assert.deepEqual(failures, []);
  await page.evaluate(() => window.__portraits.ui.destroy());
  await writeFile('artifacts/dialogue-portraits-check.json', JSON.stringify({ checks, errors, failures }, null, 2));
  console.log(JSON.stringify({ checks, errors, failures }, null, 2));
} catch (error) {
  await page.screenshot({ path: 'artifacts/dialogue-portraits-failure.png' }).catch(() => {});
  await writeFile('artifacts/dialogue-portraits-failure.json', JSON.stringify({ message: String(error), checks, errors, failures }, null, 2));
  throw error;
} finally {
  await browser.close();
}
