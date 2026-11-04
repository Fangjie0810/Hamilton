import './story.css';
import { bi, cat, f, onLanguageChange, primaryText, setLabel, setText, type Text } from '../i18n/text';
import type { Chapter, ChoiceOption, DialogueLine, Interaction } from '../data/types';
import type { GameState, StatKey } from '../core/GameState';
import { characters } from '../data/characters';
import { endingSummary, endingTitle } from '../data/ending';
import { el, action, type Activity } from '../ui/Activity';
import { DebateActivity } from '../ui/DebateActivity';
import { WritingActivity } from '../ui/WritingActivity';
import { YorktownActivity } from '../ui/YorktownActivity';
import type { StateSystem } from '../systems/StateSystem';
import type { DebateSystem } from '../systems/DebateSystem';
import type { WritingSystem } from '../systems/WritingSystem';
import type { YorktownSystem } from '../systems/YorktownSystem';
import { TAVERN_RESPONSE_MS } from '../data/rules';
import { choiceEffects } from '../ui/ChoiceEffects';
import { voiceover } from '../ui/voiceover';
import type { VoicePlayback } from '../systems/VoiceoverSystem';

export type StoryActivityKind = NonNullable<Interaction['activity']>;
export type StoryActivityResult = DebateSystem | WritingSystem | YorktownSystem;
type StoryChoice = NonNullable<Interaction['choice']>;

const statLabels: Record<StatKey, Text> = {
  momentum: bi('锐气', 'Momentum'), influence: bi('影响力', 'Influence'),
  burrRivalry: bi('伯尔 · 竞争', 'Burr · Rivalry'), burrRespect: bi('伯尔 · 尊重', 'Burr · Respect'),
  washingtonTrust: bi('华盛顿 · 信任', 'Washington · Trust'),
  debatePerformance: bi('辩论表现', 'Debate Performance'), yorktownPerformance: bi('战役表现', 'Campaign Performance'),
};

/** DOM presentation only. StoryProgress owns choice timing, checkpoints and result commits. */
export class StoryUI {
  private root = el('div', 's3-interface');
  private screen = el('section', 'screen s3-screen');
  private hud = el('aside', 's3-hud');
  private heading = el('p', 's3-chapter');
  private objective = el('p', 's3-objective');
  private stats = el('div', 's3-stats');
  private feedback = el('p', 's3-feedback');
  private dialogue = el('section', 's3-dialogue');
  private ending?: HTMLElement;
  private lineNode?: HTMLElement;
  private line: Text = '';
  private revealed = 1;
  private next?: () => void;
  private options: (() => void)[] = [];
  private activity?: Activity;
  private choiceMeter?: HTMLElement;
  private choiceTime?: HTMLElement;
  private feedbackRemaining = 0;
  private unsubscribeLanguage: () => void;
  private speech?: VoicePlayback;
  textSpeed = 24;
  reduceMotion = false;

  constructor(container: HTMLElement, private blocked: () => boolean = () => false) {
    this.root.id = 'interface';
    this.dialogue.hidden = true; this.hud.hidden = true;
    this.dialogue.tabIndex = -1;
    this.dialogue.setAttribute('role', 'dialog');
    this.dialogue.setAttribute('aria-modal', 'true');
    setLabel(this.dialogue, 'aria-label', bi('剧情对话', 'Story Dialogue'));
    this.feedback.setAttribute('aria-live', 'polite');
    this.feedback.hidden = true;
    this.hud.append(this.heading, this.objective, this.stats, this.feedback);
    this.screen.append(this.hud, this.dialogue);
    this.root.append(this.screen); container.append(this.root);
    this.dialogue.addEventListener('keydown', event => this.trapFocus(event, this.dialogue));
    this.unsubscribeLanguage = onLanguageChange(() => this.refreshLine());
  }

  get dialogueOpen() { return !this.dialogue.hidden; }
  get activityActive() { return Boolean(this.activity); }

  /** Resume inside the active modal surface so Tab cannot enter background navigation. */
  focus(): boolean {
    const target = this.root.querySelector<HTMLElement>('.activity-overlay')
      ?? (!this.dialogue.hidden ? this.dialogue : this.ending);
    if (!target?.isConnected) return false;
    target.focus({ preventScroll: true });
    return document.activeElement === target;
  }

  showChapter(chapter: Chapter, index: number, state: GameState) {
    this.ending?.remove(); this.ending = undefined;
    this.hud.hidden = false;
    setText(this.heading, cat`${String(index + 1).padStart(2, '0')} / 06 · ${chapter.title}`);
    this.setObjective(chapter.objective); this.updateState(state);
  }
  setObjective(text: Text) { this.hud.hidden = false; setText(this.objective, text); }
  updateState(state: GameState) {
    this.stats.replaceChildren();
    for (const stat of ['momentum', 'influence', 'washingtonTrust'] as const) {
      const value = el('span', 's3-stat');
      value.append(el('span', '', statLabels[stat]), el('strong', '', String(state[stat])));
      this.stats.append(value);
    }
  }
  toast(changes: Array<{ stat: StatKey; delta: number }>) {
    const actual = changes.filter(change => change.delta !== 0);
    if (!actual.length) return;
    this.feedback.replaceChildren();
    for (const change of actual) this.feedback.append(el('span', '', cat`${statLabels[change.stat]} ${change.delta > 0 ? '+' : ''}${change.delta}`));
    this.feedback.hidden = false; this.feedbackRemaining = 3600;
  }

  showLine(line: DialogueLine, next: () => void, last = false, selected?: DialogueLine) {
    this.clearDialogue(); this.dialogue.hidden = false;
    this.root.dataset.presentation = 'dialogue';
    this.dialogue.dataset.speaker = line.speaker;
    this.line = line.text; this.revealed = this.reduceMotion || this.textSpeed === 0 ? 1 : 0;
    this.next = next;
    const speaker = characters[line.speaker];
    const byline = el('div', 's3-speaker');
    byline.append(el('strong', 's3-speaker-name', speaker.name), el('span', 's3-speaker-role', speaker.role));
    this.lineNode = el('p', 's3-line'); this.refreshLine();
    const footer = el('footer', 's3-dialogue-footer');
    footer.append(el('span', '', bi('E / SPACE · 显示全文或继续', 'E / SPACE · Reveal or continue')),
      action(last ? bi('继续 →', 'Continue →') : bi('下一句 →', 'Next Line →'), () => this.advance(), 's3-advance d3-choice'));
    if (selected) this.dialogue.append(el('p', 's3-selected-response', cat`${bi('你的回应', 'Your response')} · ${selected.text}`));
    this.dialogue.append(byline, this.lineNode, footer);
    this.dialogue.focus({ preventScroll: true });
    this.speech = voiceover.play(selected ? [selected, line] : [line]);
  }

  showChoice(choice: StoryChoice, state: GameState, onChoose: (option: ChoiceOption) => void, remainingMs?: number) {
    this.clearDialogue(); this.dialogue.hidden = false; this.dialogue.classList.add('s3-choosing');
    this.root.dataset.presentation = 'choice'; this.dialogue.dataset.choice = choice.id;
    this.dialogue.append(el('p', 's3-choice-kicker', bi('选择你的回应', 'Choose Your Words')), el('h2', 's3-choice-prompt', choice.prompt));
    const list = el('div', 's3-choice-list');
    this.options = choice.options.map((option, index) => {
      const available = !option.requires || state[option.requires.stat] >= option.requires.min;
      const choose = () => {
        if (this.blocked() || !available || !this.options.length) return;
        this.options = []; onChoose(option);
      };
      const button = action('', choose, 's3-choice'); button.disabled = !available; button.dataset.option = option.id;
      const copy = el('span', 's3-choice-copy');
      copy.append(el('span', 's3-choice-label', option.text));
      button.append(el('span', 's3-choice-number', String(index + 1)), copy);
      const hint = !available && option.requires
        ? f(bi('需要 {0} {1}', 'Requires {0} {1}'), statLabels[option.requires.stat], option.requires.min) : option.hint;
      if (hint) copy.append(el('small', 's3-choice-hint', hint));
      copy.append(choiceEffects(option.effect, state));
      list.append(button); return choose;
    });
    this.dialogue.append(list);
    if (remainingMs !== undefined) {
      const track = el('div', 's3-choice-track'); this.choiceMeter = el('span', 's3-choice-meter');
      track.setAttribute('role', 'progressbar'); track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', String(TAVERN_RESPONSE_MS));
      setLabel(track, 'aria-label', bi('回应剩余时间', 'Response time remaining'));
      track.append(this.choiceMeter); this.choiceTime = el('p', 's3-choice-time');
      this.dialogue.append(track, this.choiceTime); this.updateChoiceTime(remainingMs);
    } else this.dialogue.append(el('p', 's3-choice-help', bi('按数字键或点击选择 · 这次表态会留下痕迹', 'Press a number or click · Your choice leaves a mark')));
    this.dialogue.focus({ preventScroll: true });
  }
  updateChoiceTime(ms: number) {
    if (!this.choiceMeter || !this.choiceTime) return;
    const remaining = Math.max(0, Math.min(TAVERN_RESPONSE_MS, ms));
    this.dialogue.dataset.remaining = String(Math.round(remaining));
    this.choiceMeter.style.width = `${remaining / TAVERN_RESPONSE_MS * 100}%`;
    this.choiceMeter.parentElement?.setAttribute('aria-valuenow', String(Math.round(remaining)));
    setText(this.choiceTime, f(bi('{0} 秒 · 按数字键或点击；超时保持沉默', '{0} seconds · Press a number or click; remain silent on timeout'), (remaining / 1000).toFixed(1)));
  }
  advance() {
    if (this.blocked() || !this.next) return;
    if (this.revealed < 1) { this.revealed = 1; this.refreshLine(); return; }
    const next = this.next; this.next = undefined; next();
  }
  choose(index: number) { if (!this.blocked()) this.options[index]?.(); }
  clearDialogue() {
    this.speech?.stop(); this.speech = undefined;
    this.dialogue.hidden = true; this.dialogue.classList.remove('s3-choosing'); this.dialogue.replaceChildren();
    delete this.dialogue.dataset.speaker; delete this.dialogue.dataset.choice; delete this.dialogue.dataset.remaining;
    this.lineNode = undefined; this.next = undefined; this.options = []; this.revealed = 1;
    this.choiceMeter = undefined; this.choiceTime = undefined; this.root.dataset.presentation = '';
  }

  showActivity(kind: StoryActivityKind, state: StateSystem, onComplete: (result: StoryActivityResult) => void, isBlocked = this.blocked) {
    this.clearDialogue(); this.activity?.destroy(); this.activity = undefined;
    this.updateState(state.state); this.root.dataset.presentation = 'activity';
    const complete = (result: StoryActivityResult) => {
      this.activity = undefined; this.root.dataset.presentation = ''; onComplete(result);
    };
    if (kind === 'debate') this.activity = new DebateActivity(isBlocked, complete);
    else if (kind === 'writing') this.activity = new WritingActivity(isBlocked, complete);
    else this.activity = new YorktownActivity(isBlocked, complete);
  }

  update(delta: number) {
    if (this.blocked()) return;
    const elapsed = Math.max(0, Math.min(100, delta));
    this.activity?.update(elapsed);
    if (this.lineNode && this.revealed < 1) {
      this.revealed = this.reduceMotion || this.textSpeed === 0 ? 1
        : Math.min(1, this.revealed + elapsed / (Math.max(1, primaryText(this.line).length) * this.textSpeed));
      this.refreshLine();
    }
    if (this.feedbackRemaining > 0) {
      this.feedbackRemaining = Math.max(0, this.feedbackRemaining - elapsed);
      if (!this.feedbackRemaining) this.feedback.hidden = true;
    }
  }
  key(key: string, down: boolean): boolean {
    if (!down) { this.activity?.key(key, false); return this.activityActive || this.dialogueOpen; }
    if (this.blocked()) return false;
    // Local modal handlers wrap the boundaries; native Tab moves between their controls.
    if (key === 'tab') return false;
    // Native buttons activate on Enter/Space. Let their click handler be the only action.
    if ((key === ' ' || key === 'enter') && document.activeElement instanceof HTMLButtonElement) return false;
    if (this.activity) { this.activity.key(key, true); return true; }
    if (!this.dialogueOpen) return false;
    if (key === 'e' || key === ' ' || key === 'enter') this.advance();
    else if (/^[1-4]$/.test(key)) this.choose(Number(key) - 1);
    return true;
  }
  release() { this.activity?.release(); }

  showEnding(state: GameState, onNewRun: () => void, onTitle: () => void) {
    this.clear(); this.root.dataset.presentation = 'ending';
    this.ending = el('section', 's3-ending'); this.ending.tabIndex = -1;
    this.ending.setAttribute('role', 'dialog'); this.ending.setAttribute('aria-modal', 'true');
    setLabel(this.ending, 'aria-label', bi('你的故事记录', 'Your Story Record'));
    const header = el('header', 's3-ending-header');
    header.append(el('p', 'eyebrow gold', bi('你的记录 / 1776 — 1781', 'The Record / 1776 — 1781')),
      el('h1', '', bi('你留下的名字。', 'The Name You Leave Behind')), el('p', 's3-ending-title', endingTitle(state)));
    const record = el('div', 's3-ending-record');
    const stats = el('div', 's3-ending-stats');
    for (const stat of Object.keys(statLabels) as StatKey[]) {
      if (stat === 'debatePerformance' && !state.choices.debate_result || stat === 'yorktownPerformance' && !state.choices.yorktown_result) continue;
      const row = el('div', 's3-result-stat');
      row.append(el('span', '', statLabels[stat]), el('strong', '', String(state[stat]))); stats.append(row);
    }
    const summary = el('div', 's3-ending-summary'); endingSummary(state).forEach(line => summary.append(el('p', '', line)));
    record.append(stats, summary);
    const epilogue = el('div', 's3-epilogue');
    epilogue.append(el('p', '', bi('革命使他成名。野心将决定此后的路。', 'The revolution made his name. Ambition would shape what came next.')),
      el('h2', '', bi('而伯尔仍在注视。', 'And Burr is still watching.')),
      el('p', 's3-ending-rivalry', f(bi('伯尔竞争感 {0}', 'Burr Rivalry {0}'), state.burrRivalry)));
    const actions = el('footer', 's3-ending-actions');
    actions.append(action(bi('重新启幕 →', 'Begin Again →'), () => { if (!this.blocked()) onNewRun(); }, 's3-new-run d3-primary'),
      action(bi('返回标题', 'Return to Title'), () => { if (!this.blocked()) onTitle(); }, 's3-return-title d3-secondary'));
    this.ending.append(header, record, epilogue, actions); this.screen.append(this.ending);
    this.ending.addEventListener('keydown', event => this.trapFocus(event, this.ending!));
    this.ending.focus({ preventScroll: true });
  }
  clear() {
    this.activity?.destroy(); this.activity = undefined; this.clearDialogue();
    this.ending?.remove(); this.ending = undefined; this.hud.hidden = true;
    this.feedback.hidden = true; this.feedbackRemaining = 0; this.screen.removeAttribute('inert');
  }
  destroy() { this.clear(); this.unsubscribeLanguage(); this.root.remove(); }
  private refreshLine() { if (this.lineNode) setText(this.lineNode, this.line, this.revealed); }
  private trapFocus(event: KeyboardEvent, container: HTMLElement) {
    if (event.key !== 'Tab' || this.blocked()) return;
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === container)) { event.preventDefault(); first?.focus(); }
  }
}
