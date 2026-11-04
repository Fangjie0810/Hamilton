import './review.css';
import { action, el } from '../ui/Activity';
import { bi, f, setLabel, setText, setLanguage, getLanguage, languageOptions, type LanguageMode } from '../i18n/text';
import { StateSystem } from '../systems/StateSystem';
import type { StateEffect } from '../core/GameState';
import type { StoryDirector } from '../story3d/StoryDirector';
import { chapters } from '../data/chapters';

export function mountReview(story: StoryDirector) {
  const feedback = story.ui.attributeFeedback;
  const panel = el('aside', 'af-review');
  const title = el('p', 'af-review-title', bi('HUD 圆盘 · 左侧放大预演', 'HUD DIAL · LEFT-SIDE GROWTH'));
  let sampleKey = 'mixed';
  const samples: Record<string, { label: ReturnType<typeof bi>; events: StateEffect[]; seed?: StateEffect }> = {
    mixed: { label: bi('增减同时', 'Gain & loss'), events: [{ momentum: 8, burrRespect: -5 }] },
    gain: { label: bi('单项增长', 'Single gain'), events: [{ influence: 4 }] },
    trust: { label: bi('三项变化', 'Three changes'), seed: { washingtonTrust: 12 }, events: [{ influence: 4, washingtonTrust: 6, burrRivalry: -2 }] },
    burst: { label: bi('连续三次', 'Three in a row'), events: [{ momentum: 5 }, { momentum: -3, influence: 4 }, { burrRespect: 6 }] },
    limit: { label: bi('临近上限', 'Near the limit'), seed: { momentum: 58 }, events: [{ momentum: 8 }] },
  };
  const info = el('p', 'af-review-note', bi('原 HUD 圆盘在左侧放大 50%，变化后恢复。示例不计入本局，正常游玩也会触发。', 'The original HUD dial grows by 50% on the left, changes, and returns. Samples do not affect this run; normal play also triggers it.'));
  function sample(key = sampleKey) {
    if (!samples[key]) return;
    sampleKey = key;
    story.ui.closeGrowth(); feedback.clear();
    const state = new StateSystem();
    if (samples[key].seed) state.apply(samples[key].seed!);
    story.ui.updateState(state.state);
    const chapter = samples[key].seed?.washingtonTrust ? 'Washington' : story.progress.chapter.id;
    samples[key].events.forEach(effect => { const changes = state.apply(effect); story.ui.updateState(state.state); feedback.setContext(state.state, chapter); feedback.show(changes); });
  }
  const url = new URL(location.href); url.searchParams.set('review', 'compass'); history.replaceState(null, '', url);
  const controls = el('div', 'af-review-controls');
  const select = el('select'); setLabel(select, 'aria-label', bi('预演情境', 'Preview scenario'));
  for (const [key, value] of Object.entries(samples)) { const option = el('option', '', value.label); option.value = key; select.append(option); }
  select.addEventListener('change', () => sample(select.value));
  const replay = action(bi('重播 ↻', 'Replay ↻'), () => sample());
  let hold = false;
  const freeze = action(bi('定格', 'Hold'), () => { hold = !hold; feedback.setHold(hold); setText(freeze, hold ? bi('继续', 'Resume') : bi('定格', 'Hold')); freeze.setAttribute('aria-pressed', String(hold)); });
  let dialogue = false;
  function setDialogue(show: boolean) {
    if (show && (story.busy || story.ui.dialogueOpen)) return;
    if (!show && (!dialogue || story.busy)) { dialogue = false; return; }
    dialogue = show;
    if (show) story.ui.showLine(chapters.Arrival.interactions[0].lines[0], () => {}, false, undefined, 'hamilton');
    else story.ui.clearDialogue();
  }
  const scene = action(bi('对话场景', 'Dialogue scene'), () => { setDialogue(!dialogue); scene.setAttribute('aria-pressed', String(dialogue)); sample(); });
  const language = el('select'); setLabel(language, 'aria-label', bi('语言', 'Language'));
  for (const [mode, label] of languageOptions) { const option = el('option', '', label); option.value = mode; option.lang = mode === 'en' || mode === 'dual-en' ? 'en' : 'zh-CN'; language.append(option); }
  language.value = getLanguage(); language.addEventListener('change', () => setLanguage(language.value as LanguageMode));
  controls.append(select, replay, freeze, scene, language);
  panel.append(title, controls, info);
  // Review tools are siblings of the game so no gameplay handlers receive these clicks/keys.
  panel.addEventListener('pointerdown', event => event.stopPropagation());
  panel.addEventListener('click', event => event.stopPropagation());
  panel.addEventListener('keydown', event => event.stopPropagation());
  document.body.append(panel);
  Object.assign(window, { __attributeReview: {
    select: () => sample(), sample, hold: (value: boolean) => feedback.setHold(value),
    snapshot: () => feedback.snapshot(), dialogue: setDialogue,
    clean: (value: boolean) => { panel.hidden = value; }, language: setLanguage,
    clear: () => feedback.clear(), enqueue: (events: StateEffect[]) => { const state = new StateSystem(); events.forEach(effect => { const changes = state.apply(effect); story.ui.updateState(state.state); feedback.setContext(state.state, effect.washingtonTrust ? 'Washington' : story.progress.chapter.id); feedback.show(changes); }); },
  } });
  sample();
  setLabel(panel, 'aria-label', f(bi('{0}，确认前独立保存', '{0}, isolated until approval'), title.textContent ?? ''));
}
