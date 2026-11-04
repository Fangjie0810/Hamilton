import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.HAMILTON_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.HAMILTON_PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/');
  await page.locator('.entry-screen').waitFor();
  const exercise = async () => {
    const checks = [], audio = [];
    class TestAudio extends EventTarget {
      src = ''; preload = ''; volume = 1;
      play() { this.dispatchEvent(new Event('playing')); return Promise.resolve(); }
      pause() { this.dispatchEvent(new Event('pause')); }
      removeAttribute() { this.src = ''; }
      load() {}
      finish() { this.dispatchEvent(new Event('ended')); }
      constructor() { super(); audio.push(this); }
    }
    window.Audio = TestAudio;
    const [{ StoryUI }, { DebateActivity }, { WritingActivity }, { YorktownActivity }, { voiceover }, { squads }, { setLanguage }] = await Promise.all([
      import('/src/story3d/StoryUI.ts'), import('/src/ui/DebateActivity.ts'), import('/src/ui/WritingActivity.ts'), import('/src/ui/YorktownActivity.ts'),
      import('/src/ui/voiceover.ts'), import('/src/data/yorktown.ts'), import('/src/i18n/text.ts'), import('/src/demo3d/demo.css'),
    ]);
    voiceover.stop(); voiceover.setEnabled(true); voiceover.setPaused('focus', false); voiceover.setPaused('hidden', false);
    setLanguage('dual');
    const app = document.querySelector('#app'); app.className = 'demo3d story3d'; app.replaceChildren();
    const ui = new StoryUI(app, () => false);
    await (await import('/src/ui/DialoguePortraits.ts')).preloadDialoguePortraits();
    window.__activityReactionCheck = { ui, setLanguage };
    const check = (condition, message) => { if (!condition) throw new Error(message); checks.push(message); };
    const root = () => document.querySelector('.activity-overlay');
    const portrait = () => root().querySelector('.dialogue-portraits');
    const active = () => portrait().querySelector('[data-active="true"]');
    const listener = () => portrait().querySelector('[data-active="false"]');
    const finishSpeech = () => { let left = 30; while (voiceover.currentCue && left--) audio.at(-1).finish(); if (!left) throw new Error('Voice queue did not terminate'); };
    const settled = (outcome, pose, partner) => {
      check(root().dataset.reaction === outcome && portrait().dataset.phase === 'settled' && portrait().dataset.talking === 'false' && active().dataset.pose === pose, `${root().dataset.activity}: ${outcome} holds ${pose} without speech`);
      check(listener().dataset.character === partner && listener().dataset.active === 'false', `${root().dataset.activity}: ${partner} remains the dimmed listener`);
      if (active().dataset.art !== 'atlas' || listener().dataset.art !== 'atlas')
        throw new Error(`${root().dataset.activity}: reaction must use the authored main art, not a fallback`);
      const panel = root().querySelector('.activity-panel'), box = panel.getBoundingClientRect();
      if (box.top < 0 || box.bottom > innerHeight + 1 || box.left < 0 || box.right > innerWidth + 1 || panel.scrollWidth > panel.clientWidth + 1)
        throw new Error(`${root().dataset.activity}/${root().dataset.phase}: reaction panel overflows ${innerWidth} × ${innerHeight}`);
    };
    let activity = new DebateActivity(() => false, () => {});
    activity.game.ready(); activity.refresh(); activity.game.select('FACT'); activity.refresh();
    for (let i = 0; i < 12; i++) activity.update(100);
    activity.game.hit(); activity.refresh();
    check(root().dataset.reaction === 'success' && portrait().dataset.phase === 'speaking', 'debate keeps the existing Hamilton response before the successful reaction');
    finishSpeech(); settled('success', 'approve', 'loyalist');
    activity.game.next(); activity.refresh();
    check(!root().dataset.reaction && portrait().dataset.phase === 'speaking', 'next debate argument discards the previous result reaction');
    activity.game.ready(); activity.refresh();
    const beforeMiss = audio.length;
    for (let i = 0; i < 26; i++) activity.update(100);
    settled('miss', 'concern', 'loyalist'); check(audio.length === beforeMiss, 'unanswered debate feedback creates no narration');
    activity.destroy();

    activity = new WritingActivity(() => false, () => {});
    check(portrait().hidden, 'dispatch instructions contain no reaction portrait');
    activity.game.begin(); activity.refresh();
    for (const fragment of activity.game.dispatch.fragments) activity.game.assign(fragment.id, fragment.bin);
    activity.game.submit(); activity.refresh();
    check(activity.game.scores[0] === 5 && portrait().dataset.phase === 'speaking', 'an accurate dispatch still reads only the existing corrected Hamilton fragments');
    finishSpeech(); settled('success', 'approve', 'washington');
    activity.game.next(); activity.refresh();
    check(portrait().hidden && !root().dataset.reaction, 'next sorting phase hides and clears the prior correction reaction');
    activity.game.submit(); activity.refresh(); finishSpeech(); settled('miss', 'concern', 'washington');
    activity.game.next(); activity.refresh(); activity.game.submit(); activity.refresh(); finishSpeech(); activity.game.next(); activity.refresh();
    settled('miss', 'concern', 'washington'); activity.destroy();

    activity = new YorktownActivity(() => false, () => {});
    check(portrait().hidden, 'Yorktown instructions contain no reaction portrait');
    const beforeApproach = audio.length;
    activity.game.begin(); activity.refresh(); activity.key('d', true);
    for (let i = 0; i < 180 && activity.game.phase === 'approach'; i++) activity.update(100);
    activity.key('d', false);
    check(activity.game.phase === 'command' && portrait().hidden, 'real approach progression reaches an uncluttered deployment interface');
    for (let i = 0; i < squads.length; i++) activity.game.order(i, squads[i].best);
    activity.game.deploy(); activity.refresh(); settled('success', 'approve', 'lafayette');
    check(audio.length === beforeApproach, 'coordination feedback creates no instructional narration');
    activity.game.assault(); activity.refresh(); finishSpeech();
    for (let i = 0; i < 12; i++) activity.update(100);
    activity.game.hit(activity.game.command.key); activity.refresh(); settled('success', 'approve', 'lafayette');
    for (let i = 0; i < 9; i++) activity.update(100);
    check(!root().dataset.reaction && portrait().dataset.phase === 'speaking', 'the next assault command replaces the prior static result');
    finishSpeech(); activity.game.hit(activity.game.command.key === 'a' ? 'd' : 'a'); activity.refresh(); settled('miss', 'concern', 'lafayette');
    // Leave a real result panel mounted for responsive-layout checks below.
    while (activity.game.phase !== 'result') {
      if (activity.game.phase === 'feedback') for (let i = 0; i < 9; i++) activity.update(100);
      else {
        finishSpeech(); for (let i = 0; i < 12; i++) activity.update(100);
        activity.game.hit(activity.game.command.key); activity.refresh();
      }
    }
    settled('success', 'approve', 'lafayette');
    check(audio.every(item => !item.src.includes('/narrator-')), 'all new gameplay reactions leave the narrator scope unchanged');
    window.__activityReactionCheck.activity = activity;
    return checks;
  };
  const checks = await page.evaluate(exercise);
  const layouts = [];
  for (const size of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    if (size.width === 390) {
      await page.evaluate(() => { window.__activityReactionCheck.activity.destroy(); window.__activityReactionCheck.ui.destroy(); });
      await page.evaluate(exercise);
    }
    for (const language of ['dual', 'dual-en', 'zh', 'en']) {
      await page.evaluate(language => window.__activityReactionCheck.setLanguage(language), language);
      const metrics = await page.locator('.activity-stage').evaluate(stage => {
        const panel = stage.querySelector('.activity-panel'), box = panel.getBoundingClientRect();
        const figures = [...stage.querySelectorAll('.dialogue-portrait-slot')].map(slot => { const r = slot.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
        return { panel: { top: box.top, bottom: box.bottom, left: box.left, right: box.right, client: panel.clientWidth, scroll: panel.scrollWidth }, figures, width: innerWidth, height: innerHeight, docWidth: document.documentElement.scrollWidth };
      });
      assert.ok(metrics.panel.top >= 0 && metrics.panel.bottom <= size.height + 1 && metrics.panel.left >= 0 && metrics.panel.right <= size.width + 1, `${language}: result panel stays in viewport`);
      assert.ok(metrics.docWidth <= size.width + 1 && metrics.panel.scroll <= metrics.panel.client + 1, `${language}: no horizontal overflow`);
      assert.ok(metrics.figures.every(figure => figure.top >= 0 && figure.top < metrics.panel.top && figure.left >= 0 && figure.right <= size.width + 1), `${language}: visible figures leave room for the result`);
      layouts.push({ ...size, language, metrics });
    }
    await page.screenshot({ path: `artifacts/activity-reactions-${size.width}.png` });
  }
  assert.deepEqual(errors, []);
  await writeFile('artifacts/activity-reactions-check.json', JSON.stringify({ checks, layouts, errors }, null, 2));
  console.log(JSON.stringify({ checks, layouts: layouts.length, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: 'artifacts/activity-reactions-failure.png' }).catch(() => {});
  throw error;
} finally { await browser.close(); }
