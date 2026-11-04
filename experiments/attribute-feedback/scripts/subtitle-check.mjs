import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.HAMILTON_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.HAMILTON_BROWSER ?? 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 640 }, reducedMotion: 'reduce' });
const base = new URL(process.env.HAMILTON_URL ?? 'http://127.0.0.1:1776/'); base.search = ''; base.hash = '';
const modes = ['zh', 'en', 'dual', 'dual-en'];
const checks = [], errors = [], failures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('favicon.ico')) failures.push(`${response.status()} ${response.url()}`); });

async function setMode(mode) {
  await page.evaluate(async mode => (await import('/src/i18n/text.ts')).setLanguage(mode), mode);
  assert.equal(await page.locator('html').getAttribute('lang'), ['en', 'dual-en'].includes(mode) ? 'en' : 'zh-CN');
}

/** Compare real bound translations, including dynamically formatted feedback. */
async function expectText(scope, mode, dialogueSelectors = []) {
  const problems = await page.locator(scope).evaluate(async (root, { mode, dialogueSelectors }) => {
    const { boundText } = await import('/src/i18n/text.ts');
    const primary = mode === 'en' || mode === 'dual-en' ? 'en' : 'zh';
    const secondary = primary === 'en' ? 'zh' : 'en';
    const errors = [];
    for (const node of [root, ...root.querySelectorAll('[data-localized]')]) {
      const text = boundText(node);
      if (!text || typeof text === 'string') continue;
      const main = node.querySelector(':scope > .text-primary');
      const sub = node.querySelector(':scope > .text-secondary');
      const dialogue = dialogueSelectors.some(selector => node.matches(selector));
      const bilingual = dialogue && mode.startsWith('dual') && text.zh !== text.en;
      if (node instanceof HTMLOptionElement) {
        if (node.textContent !== text[primary]) errors.push(`option ${node.value}: wrong language`);
      } else {
        if (main?.textContent !== text[primary]) errors.push(`${node.className || node.tagName}: wrong primary text`);
        if (main?.lang !== (primary === 'en' ? 'en' : 'zh-CN')) errors.push(`${node.className}: wrong primary lang`);
        if (bilingual ? sub?.textContent !== text[secondary] : !!sub) errors.push(`${node.className || node.tagName}: wrong subtitle scope`);
        if (bilingual && sub?.lang !== (secondary === 'en' ? 'en' : 'zh-CN')) errors.push(`${node.className}: wrong secondary lang`);
      }
    }
    return errors;
  }, { mode, dialogueSelectors });
  assert.deepEqual(problems, [], `${scope}/${mode}`);
}

async function expectLayout(scope, name) {
  const bounds = await page.locator(scope).evaluate(root => {
    const rect = root.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewport: innerWidth, height: innerHeight, width: root.clientWidth, scroll: root.scrollWidth };
  });
  assert.ok(bounds.left >= -1 && bounds.right <= bounds.viewport + 1 && bounds.scroll <= bounds.width + 1, `${name}: no horizontal clipping ${JSON.stringify(bounds)}`);
  assert.ok(bounds.top >= -1 && bounds.bottom <= bounds.height + 1, `${name}: panel fits vertically ${JSON.stringify(bounds)}`);
}

async function tick(ms) {
  await page.evaluate(ms => { for (let remaining = ms; remaining > 0; remaining -= 100) window.__subtitle.ui.update(Math.min(100, remaining)); }, ms);
}

async function checkActivityPhase(name, dialogueSelectors = []) {
  const before = await page.evaluate(() => {
    const h = window.__subtitle; h.activityNode = document.querySelector('.activity-overlay');
    h.activityInstance = h.ui.activity; h.gameInstance = h.ui.activity.game;
    return { game: JSON.stringify(h.ui.activity.game, (_, value) => value instanceof Set ? [...value] : value), selected: h.ui.activity.selected ?? null, state: h.state.state };
  });
  for (const mode of modes) {
    await setMode(mode); await expectText('.activity-overlay', mode, dialogueSelectors);
    const after = await page.evaluate(() => {
      const h = window.__subtitle;
      return { sameNode: h.activityNode === document.querySelector('.activity-overlay'), sameActivity: h.activityInstance === h.ui.activity, sameGame: h.gameInstance === h.ui.activity.game,
        snapshot: { game: JSON.stringify(h.ui.activity.game, (_, value) => value instanceof Set ? [...value] : value), selected: h.ui.activity.selected ?? null, state: h.state.state } };
    });
    assert.ok(after.sameNode && after.sameActivity && after.sameGame, `${name}: mode changes retain activity and DOM`);
    assert.deepEqual(after.snapshot, before, `${name}: mode changes retain timer, score, selection, and game state`);
  }
  await expectLayout('.activity-panel', name);
  await page.screenshot({ path: `artifacts/subtitle-${name}-dual-en.png` });
  checks.push(`${name}: four modes, dialogue scope, retained activity and state`);
}

try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(base.href); await page.locator('.entry-screen').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-language'), 'dual');
  assert.deepEqual((await page.locator('.entry-language').evaluateAll(nodes => nodes.map(node => node.dataset.language))).sort(), [...modes].sort());
  await page.setViewportSize({ width: 390, height: 844 });
  for (const mode of modes) {
    await page.locator(`.entry-language[data-language="${mode}"]`).click();
    await expectText('.entry-screen', mode);
    await expectLayout('.entry-header', `entry/${mode}`);
    await page.locator('.entry-settings-trigger').click();
    assert.equal(await page.locator('#entry-settings-language').inputValue(), mode);
    await expectLayout('.entry-settings', `entry-settings/${mode}`);
    await page.keyboard.press('Escape');
  }
  await page.reload(); await page.locator('.entry-screen').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-language'), 'dual-en', 'English-first preference survives reload');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('.entry-language[aria-pressed=true]').getAttribute('data-language'), 'dual-en');
  checks.push('four entry options, narrow settings, English-first preference survives reload');

  // Deterministic presentation harness: production StoryUI, StoryProgress and activity
  // classes receive normal callbacks and host ticks; no game phase is assigned by tests.
  await page.evaluate(async () => {
    const [{ StoryUI }, { StateSystem }, { StoryProgress }, { chapters }, i18n, { voiceover }] = await Promise.all([
      import('/src/story3d/StoryUI.ts'), import('/src/systems/StateSystem.ts'), import('/src/story3d/StoryProgress.ts'),
      import('/src/data/chapters.ts'), import('/src/i18n/text.ts'), import('/src/ui/voiceover.ts'), import('/src/demo3d/demo.css'),
    ]);
    voiceover.setEnabled(false);
    const app = document.querySelector('#app'); app.className = 'demo3d story3d'; app.replaceChildren();
    const h = window.__subtitle = { state: new StateSystem(), blocked: false, completed: [], advanced: 0, chapters, i18n, story: new StoryProgress() };
    h.ui = new StoryUI(app, () => h.blocked);
    h.ui.showChapter(chapters.Arrival, 1, h.state.state);
    h.line = chapters.Arrival.interactions[0].lines[0];
    h.selected = { speaker: 'hamilton', text: i18n.bi('我会把这句话记在心里。', 'I will remember those words.') };
    h.ui.textSpeed = 40;
    h.ui.showLine(h.line, () => h.advanced++, false, h.selected);
    for (let i = 0; i < 4; i++) h.ui.update(100);
    h.lineNode = document.querySelector('.s3-line');
    h.progress = h.ui.revealed;
  });
  for (const mode of modes) {
    await setMode(mode);
    const typing = await page.evaluate(mode => {
      const h = window.__subtitle, primary = mode === 'en' || mode === 'dual-en' ? 'en' : 'zh', secondary = primary === 'en' ? 'zh' : 'en';
      return { same: h.lineNode === document.querySelector('.s3-line'), progress: h.ui.revealed, originalProgress: h.progress, advanced: h.advanced,
        main: h.lineNode.querySelector('.text-primary').textContent, expected: h.line.text[primary].slice(0, Math.ceil(h.line.text[primary].length * h.progress)),
        sub: h.lineNode.querySelector('.text-secondary')?.textContent ?? null, expectedSub: mode.startsWith('dual') ? h.line.text[secondary].slice(0, Math.ceil(h.line.text[secondary].length * h.progress)) : null };
    }, mode);
    assert.ok(typing.same && typing.progress > 0 && typing.progress < 1);
    assert.equal(typing.progress, typing.originalProgress); assert.equal(typing.advanced, 0);
    assert.equal(typing.main, typing.expected); assert.equal(typing.sub, typing.expectedSub);
  }
  await page.evaluate(() => window.__subtitle.ui.advance());
  for (const mode of modes) {
    await setMode(mode); await expectText('.s3-interface', mode, ['.s3-line', '.s3-selected-line']);
    assert.equal(await page.locator('.s3-dialogue').getAttribute('aria-label'), ['en', 'dual-en'].includes(mode) ? 'Story Dialogue' : '剧情对话');
    await expectLayout('.s3-dialogue', `dialogue/${mode}`);
  }
  await page.screenshot({ path: 'artifacts/subtitle-dialogue-dual-en-390.png' });
  checks.push('spoken lines and selected reply only are bilingual; primary/secondary reverse with correct lang attributes; typewriter fraction and DOM survive switching');

  await page.evaluate(() => {
    const h = window.__subtitle, s = h.story;
    for (let guard = 0; s.chapterId !== 'Tavern' && guard < 100; guard++) {
      if (s.phase === 'explore') s.begin(s.interaction.id);
      else if (s.phase === 'dialogue') s.next();
      else if (s.phase === 'choice') s.choose(0);
      else if (s.phase === 'exit') s.nextChapter();
      else throw Error(`Unexpected pre-Tavern phase: ${s.phase}`);
    }
    s.begin(s.interaction.id); while (s.phase === 'dialogue') s.next();
    for (let i = 0; i < 4; i++) s.tick(100);
    h.ui.showChoice(s.choice, s.state.state, option => s.choose(s.choice.options.indexOf(option)), s.remainingMs);
    h.choiceSnapshot = JSON.stringify({ state: s.state.state, remaining: s.remainingMs, phase: s.phase, index: s.interactionIndex, revision: s.revision });
    h.choiceNode = document.querySelector('.s3-choice-list');
  });
  for (const mode of modes) {
    await setMode(mode); await expectText('.s3-dialogue', mode);
    assert.ok(await page.evaluate(() => { const h = window.__subtitle, s = h.story; s.tick(100, true); return h.choiceNode === document.querySelector('.s3-choice-list') && h.choiceSnapshot === JSON.stringify({ state: s.state.state, remaining: s.remainingMs, phase: s.phase, index: s.interactionIndex, revision: s.revision }); }));
    await expectLayout('.s3-dialogue', `choice/${mode}`);
  }
  checks.push('timed story choices are primary-language only and retain remaining time, options, chapter and state');

  await page.setViewportSize({ width: 1024, height: 640 });
  for (const kind of ['debate', 'writing', 'yorktown']) {
    await page.evaluate(kind => { const h = window.__subtitle; h.ui.showActivity(kind, h.state, result => h.completed.push({ kind, score: result.performance })); }, kind);
    await checkActivityPhase(`${kind}-briefing`, kind === 'debate' ? ['blockquote'] : []);
    await page.locator('.activity-body .primary').click();
    if (kind === 'debate') {
      await tick(400); await checkActivityPhase('debate-choose', ['blockquote']);
      await page.locator('[data-response="FACT"]').click(); await tick(400);
      await checkActivityPhase('debate-beat', ['blockquote']);
      await tick(800); await page.locator('.beat-button').click();
      await checkActivityPhase('debate-feedback', ['.debate-dialogue']);
      for (let guard = 0; await page.locator('.activity-overlay').getAttribute('data-phase') !== 'result' && guard < 20; guard++) {
        await page.locator('.activity-body .primary').click();
        if (await page.locator('.activity-overlay').getAttribute('data-phase') === 'argument') { await page.locator('.activity-body .primary').click(); await tick(2500); }
      }
      await checkActivityPhase('debate-result');
    } else if (kind === 'writing') {
      await tick(400); await page.locator('[data-fragment]').first().click();
      await checkActivityPhase('writing-selected');
      await page.locator('[data-bin="PRIORITY"]').click();
      await checkActivityPhase('writing-assigned');
      await page.evaluate(() => window.__subtitle.blocked = true); const before = await page.locator('.activity-overlay').getAttribute('data-remaining');
      await tick(400); assert.equal(await page.locator('.activity-overlay').getAttribute('data-remaining'), before);
      await page.evaluate(() => window.__subtitle.blocked = false);
      await tick(100); assert.equal(Number(await page.locator('.activity-overlay').getAttribute('data-remaining')), Number(before) - 100);
      for (let round = 0; round < 3; round++) {
        await page.locator('.activity-body .primary').click();
        if (round === 0) await checkActivityPhase('writing-feedback');
        await page.locator('.activity-body .primary').click();
      }
      await checkActivityPhase('writing-result');
    } else {
      await page.evaluate(() => window.__subtitle.ui.key('d', true)); await tick(400);
      await checkActivityPhase('yorktown-approach');
      await page.evaluate(() => { const h = window.__subtitle; h.ui.release(); h.blocked = true; });
      const x = await page.locator('.activity-overlay').getAttribute('data-x'); await tick(400);
      assert.equal(await page.locator('.activity-overlay').getAttribute('data-x'), x);
      await page.evaluate(() => { const h = window.__subtitle; h.blocked = false; h.ui.key('d', true); });
      for (let guard = 0; await page.locator('.activity-overlay').getAttribute('data-phase') === 'approach' && guard < 20; guard++) await tick(1000);
      await page.evaluate(() => window.__subtitle.ui.key('d', false));
      await page.locator('[data-squad="0"][data-order="ADVANCE"]').click();
      await checkActivityPhase('yorktown-command');
      await page.locator('[data-squad="1"][data-order="FLANK"]').click(); await page.locator('[data-squad="2"][data-order="HOLD"]').click();
      await page.locator('.deploy-button').click(); await checkActivityPhase('yorktown-assault-ready');
      await page.locator('.activity-body .primary').click(); await tick(400); await checkActivityPhase('yorktown-assault');
      await page.locator('.assault-button').first().click(); await checkActivityPhase('yorktown-feedback');
      for (let guard = 0; await page.locator('.activity-overlay').getAttribute('data-phase') !== 'result' && guard < 40; guard++) {
        // The fixture advances game time faster than a real audio clip. Use the
        // supported skip-reading control before ticking each subsequent command.
        if (await page.locator('.activity-overlay').getAttribute('data-voice-reading') === 'true') await page.locator('.assault-button').first().click();
        await tick(1000);
      }
      assert.equal(await page.locator('.activity-overlay').getAttribute('data-phase'), 'result', 'all twelve battle commands finish before result verification');
      await checkActivityPhase('yorktown-result');
    }
    await page.locator('.activity-body .primary').click();
    assert.equal(await page.locator('.activity-overlay').count(), 0, `${kind} remains completable`);
  }
  assert.equal(await page.evaluate(() => window.__subtitle.completed.length), 3);
  assert.deepEqual(errors, [], 'no uncaught browser errors'); assert.deepEqual(failures, [], 'no failed resources');
  await writeFile('artifacts/subtitle-report.json', JSON.stringify({ checks, errors, failures }, null, 2));
  console.log(`PASS subtitle: ${checks.join('; ')}`);
} catch (error) {
  await page.screenshot({ path: 'artifacts/subtitle-failure.png' }).catch(() => {});
  await writeFile('artifacts/subtitle-report.json', JSON.stringify({ checks, errors, failures, error: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
