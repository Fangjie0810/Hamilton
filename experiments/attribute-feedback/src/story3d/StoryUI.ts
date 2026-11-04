import './story.css';
import { CompassFeedback } from '../attribute-feedback/CompassFeedback';
import type { StateChange } from '../systems/StateSystem';
import { bi, cat, f, onLanguageChange, primaryText, setDialogueText, setLabel, setText, type Text } from '../i18n/text';
import type { Chapter, CharacterId, ChoiceOption, DialogueLine, Interaction } from '../data/types';
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
import { DialoguePresentation } from '../ui/DialoguePresentation';
import { growthAttributes, type GrowthAttributeId } from '../data/growth';
import { inventoryItems } from '../data/inventory';
import { GrowthCompass } from './GrowthCompass';
import { growthBenefits } from '../systems/GrowthSystem';
import { interactionEchoes } from '../data/discoveries';
import { GrowthGuide, type GrowthNotice } from './GrowthGuide';

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
  private compass = new GrowthCompass(stat => this.openGrowth(false, stat));
  private stats = this.compass.element;
  private chapter: Chapter['id'] = 'Opening';
  private inventory = el('aside', 's3-inventory');
  private tutorial = el('aside', 's3-tutorial');
  private tutorialRemaining = 0;
  private tutorialsSeen = new Set<string>();
  private input = new AbortController();
  private dialoguePointerReady = false;
  readonly attributeFeedback = new CompassFeedback(this.stats);
  private dialogue = el('section', 's3-dialogue');
  private dialogueStage = el('div', 's3-dialogue-stage');
  private dialoguePresentation = new DialoguePresentation();
  private ending?: HTMLElement;
  private lineNode?: HTMLElement;
  private line: Text = '';
  private revealed = 1;
  private next?: () => void;
  private options: (() => void)[] = [];
  private activity?: Activity;
  private choiceMeter?: HTMLElement;
  private choiceTime?: HTMLElement;
  private unsubscribeLanguage: () => void;
  private growth = new GrowthGuide();
  private growthDialog = el('dialog', 's3-growth-dialog');
  private growthNotice = el('div', 's3-growth-notice');
  private growthNotices: GrowthNotice[] = [];
  private currentGrowthNotice?: GrowthNotice;
  private growthNoticeRemaining = 0;
  private growthPreviousFocus?: Element | null;
  onGrowthOpenChange?: (open: boolean) => void;
  textSpeed = 24;
  reduceMotion = false;

  constructor(container: HTMLElement, private blocked: () => boolean = () => false) {
    this.root.id = 'interface';
    this.dialogue.hidden = true; this.dialogueStage.hidden = true; this.hud.hidden = true; this.stats.hidden = true;
    this.dialogue.tabIndex = -1;
    this.dialogue.setAttribute('role', 'dialog');
    this.dialogue.setAttribute('aria-modal', 'true');
    setLabel(this.dialogue, 'aria-label', bi('剧情对话', 'Story Dialogue'));
    this.growthNotice.hidden = true; this.growthNotice.setAttribute('aria-live', 'polite');
    this.growthDialog.id = 's3-growth';
    this.growthDialog.tabIndex = -1;
    setLabel(this.growthDialog, 'aria-label', bi('成长与关系', 'Growth and Relationships'));
    this.growthDialog.addEventListener('cancel', event => { event.preventDefault(); this.closeGrowth(); });
    this.growthDialog.addEventListener('keydown', event => {
      // Keep the host's exploration/choice shortcuts outside this modal.
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); this.closeGrowth(); }
    });
    this.hud.append(this.stats, this.growthNotice);
    this.inventory.hidden = true; this.tutorial.hidden = true;
    setLabel(this.inventory, 'aria-label', bi('随身物品', 'Inventory'));
    this.inventory.setAttribute('aria-live', 'polite'); this.tutorial.setAttribute('role', 'status');
    this.dialogueStage.append(this.dialoguePresentation.element, this.dialogue);
    this.screen.append(this.hud, this.inventory, this.dialogueStage, this.tutorial);
    this.root.append(this.screen, this.attributeFeedback.element, this.growthDialog); container.append(this.root);
    this.dialogue.addEventListener('keydown', event => this.trapFocus(event, this.dialogue));
    // Arm on pointerdown so the click that opens a conversation cannot also skip its first line.
    document.addEventListener('pointerdown', event => {
      this.dialoguePointerReady = event.button === 0 && !!this.next && !this.blocked() && !this.growthOpen;
    }, { capture: true, signal: this.input.signal });
    document.addEventListener('click', event => {
      const armed = this.dialoguePointerReady; this.dialoguePointerReady = false;
      if (!armed || event.button !== 0 || this.growthOpen || !this.next) return;
      if (event.target instanceof Element && event.target.closest('button, input, select, a, [role="button"], dialog')) return;
      if (!document.getSelection()?.isCollapsed) return;
      this.advance();
    }, { signal: this.input.signal });
    this.unsubscribeLanguage = onLanguageChange(() => this.refreshLine());
  }

  get dialogueOpen() { return !this.dialogue.hidden; }
  get activityActive() { return Boolean(this.activity); }
  get growthOpen() { return this.growthDialog.open; }

  setGrowthContext(chapter: Chapter, state: GameState, completed: Iterable<string>, readyForIntro = false) {
    this.growthNotices.push(...this.growth.setContext(chapter.id, state, completed));
    if (this.currentGrowthNotice) {
      const content = this.growthNotice.querySelector('p');
      if (content) setText(content, this.growth.noticeText(this.currentGrowthNotice));
    }
  }
  resetGrowthGuide() { this.closeGrowth(); this.growth.reset(); this.growthNotices = []; this.hideGrowthNotice(); this.tutorialsSeen.clear(); }

  openGrowth(intro = false, selectedStat?: GrowthAttributeId) {
    const state = this.growth.state;
    if (!state || this.growthOpen || this.blocked()) return;
    this.growthPreviousFocus = document.activeElement;
    this.growthDialog.dataset.intro = String(intro);
    this.growthDialog.dataset.stat = selectedStat ?? '';
    const header = el('header', 's3-growth-header');
    header.append(el('p', 's3-growth-kicker', intro ? bi('抵达纽约 · 你的成长', 'NEW YORK · YOUR GROWTH') : bi('一路走来的变化', 'WHAT THE JOURNEY CHANGES')),
      el('h2', '', selectedStat ? growthAttributes.find(item => item.id === selectedStat)!.name : bi('3 项主要指标，2 项伯尔关系', '3 main attributes, 2 Burr relationships')),
      el('p', 's3-growth-overview', bi('选择与地图发现改变这些数值，影响人物回应和小游戏中的帮助。', 'Choices and discoveries change these values, shaping character responses and help in minigames.')));
    const list = el('div', 's3-growth-list');
    for (const attribute of growthAttributes.filter(item => !selectedStat || item.id === selectedStat)) {
      const row = el('section', 's3-growth-row'); row.dataset.stat = attribute.id;
      const title = el('div', 's3-growth-row-title');
      const locked = attribute.id === 'washingtonTrust' && !['Washington', 'Yorktown'].includes(this.chapter);
      title.append(el('h3', '', attribute.name), el('strong', 's3-growth-value', locked ? bi('尚未解锁', 'Locked') : String(state[attribute.id])));
      row.append(title);
      if (!intro) row.append(el('p', 's3-growth-description', attribute.description));
      row.append(el('p', 's3-growth-use', intro ? this.growth.introUsage(attribute.id) : this.growth.usage(attribute.id)));
      list.append(row);
    }
    if (selectedStat?.startsWith('burr')) list.append(el('p', 's3-growth-description', bi('红色在上，代表竞争；蓝色在下，代表尊重。两项数值独立增减，面积夸张呈现差异，不表示百分比。', 'Red above represents rivalry; blue below represents respect. The two values change independently. Their visual balance exaggerates the difference; it is not a percentage.')));
    const footer = el('footer', 's3-growth-footer');
    footer.append(el('p', 's3-growth-note', intro
      ? bi('成绩另算；尊重与竞争可以并存。点击圆盘的不同部分，回看门槛与用途。', 'Scores are separate; respect and rivalry can coexist. Click a part of the dial to review its thresholds and uses.')
      : bi('帮助在每场小游戏开始时确定，切换语言或重开面板不会补回次数。所有路线都能完成主线；发现事件每轮只奖励一次。', 'Help is fixed when each minigame begins. Switching language or reopening this panel does not refill it. Every path can finish the story; each discovery rewards you once per run.')),
      action(intro ? bi('明白了，开始探索 →', 'Got it · Explore →') : bi('返回游戏', 'Return to the Game'), () => this.closeGrowth(), 's3-growth-close d3-primary'));
    this.growthDialog.replaceChildren(header, list, footer);
    this.onGrowthOpenChange?.(true);
    this.growthDialog.showModal();
    this.growthDialog.scrollTop = 0; this.growthDialog.focus({ preventScroll: true });
  }

  closeGrowth() {
    if (!this.growthOpen) return;
    this.growthDialog.close(); this.onGrowthOpenChange?.(false);
    if ((this.growthPreviousFocus instanceof HTMLElement || this.growthPreviousFocus instanceof SVGElement) && this.growthPreviousFocus.isConnected && !this.growthPreviousFocus.closest('[inert]'))
      this.growthPreviousFocus.focus({ preventScroll: true });
    this.growthPreviousFocus = undefined;
  }

  /** Resume inside the active modal surface so Tab cannot enter background navigation. */
  focus(): boolean {
    const target = this.growthOpen ? this.growthDialog : this.root.querySelector<HTMLElement>('.activity-overlay')
      ?? (!this.dialogue.hidden ? this.dialogue : this.ending);
    if (!target?.isConnected) return false;
    target.focus({ preventScroll: true });
    return document.activeElement === target;
  }

  showChapter(chapter: Chapter, index: number, state: GameState) {
    this.ending?.remove(); this.ending = undefined;
    this.hud.hidden = false;
    this.chapter = chapter.id; this.updateState(state); this.updateInventory(state);
  }
  // Objective markers remain in the world; there is no persistent task-list HUD.
  setObjective(_text: Text) { this.hud.hidden = false; }
  updateState(state: GameState) {
    this.stats.hidden = this.chapter === 'Opening';
    this.compass.update(state, this.chapter);
    this.attributeFeedback.setContext(state, this.chapter);
  }
  updateInventory(state: GameState) {
    const items = inventoryItems(state);
    this.inventory.replaceChildren(); this.inventory.hidden = !items.length;
    for (const item of items) {
      const slot = el('div', 's3-inventory-item'); slot.dataset.item = item.id; slot.tabIndex = 0;
      setLabel(slot, 'aria-label', item.name); setLabel(slot, 'title', item.description);
      const icon = el('span', 's3-item-newspaper'); icon.setAttribute('aria-hidden', 'true');
      const tip = el('span', 's3-inventory-tip', item.name);
      slot.append(icon, tip); this.inventory.append(slot);
    }
  }
  showTutorial(kind: 'movement' | 'dialogue' | 'camera') {
    if (this.tutorialsSeen.has(kind)) return;
    this.tutorialsSeen.add(kind); this.tutorial.dataset.tutorial = kind;
    const copy = {
      movement: bi('WASD 或鼠标点击移动 · E 键交互', 'WASD or click to move · E to interact'),
      dialogue: bi('左键单击屏幕或按空格，显示全文或继续对话', 'Left-click the screen or press Space to reveal or continue dialogue'),
      camera: bi('滚轮缩放 · 拖动右下角半透明球调整视角，也可按住右键拖动', 'Scroll to zoom · Drag the translucent orb at bottom right, or right-drag, to adjust the view'),
    };
    setText(this.tutorial, copy[kind]); this.tutorial.hidden = false; this.tutorialRemaining = 9000;
  }
  toast(changes: readonly StateChange[]) {
    this.attributeFeedback.show(changes);
  }

  showLine(line: DialogueLine, next: () => void, last = false, selected?: DialogueLine, partner?: CharacterId) {
    this.clearDialogue(true); this.dialogue.hidden = false; this.dialogueStage.hidden = false;
    this.dialogueStage.classList.add('has-portraits');
    this.root.dataset.presentation = 'dialogue';
    this.dialogue.dataset.speaker = line.speaker;
    this.line = line.text; this.revealed = this.reduceMotion || this.textSpeed === 0 ? 1 : 0;
    this.next = next;
    const speaker = characters[line.speaker];
    const byline = el('div', 's3-speaker');
    byline.append(el('strong', 's3-speaker-name', speaker.name), el('span', 's3-speaker-role', speaker.role));
    this.lineNode = el('p', 's3-line'); this.refreshLine();
    if (selected) {
      const response = el('p', 's3-selected-response');
      const spoken = el('span', 's3-selected-line'); setDialogueText(spoken, selected.text);
      response.append(el('span', 's3-selected-label', bi('你的回应', 'Your response')), spoken);
      this.dialogue.append(response);
    }
    this.dialogue.append(byline, this.lineNode);
    this.dialogue.focus({ preventScroll: true });
    this.dialoguePresentation.update(0, this.blocked() || this.growthOpen, this.reduceMotion);
    this.dialoguePresentation.play(selected ? [selected, line] : [line], selected?.speaker !== line.speaker ? selected?.speaker ?? partner : partner);
  }

  showChoice(choice: StoryChoice, state: GameState, onChoose: (option: ChoiceOption) => void, remainingMs?: number) {
    this.clearDialogue(true); this.dialogue.hidden = false; this.dialogueStage.hidden = false; this.dialogue.classList.add('s3-choosing');
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
    const guide = this.growth.takeChoiceTip(choice.id, remainingMs !== undefined);
    if (guide) this.dialogue.append(el('p', 's3-choice-growth-guide', guide));
    if (remainingMs !== undefined) {
      const track = el('div', 's3-choice-track'); this.choiceMeter = el('span', 's3-choice-meter');
      track.setAttribute('role', 'progressbar'); track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', String(TAVERN_RESPONSE_MS));
      setLabel(track, 'aria-label', bi('回应剩余时间', 'Response time remaining'));
      track.append(this.choiceMeter); this.choiceTime = el('p', 's3-choice-time');
      this.dialogue.append(track, this.choiceTime); this.updateChoiceTime(remainingMs);
    }
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
    if (this.blocked() || this.growthOpen || !this.next) return;
    if (this.revealed < 1) { this.revealed = 1; this.refreshLine(); return; }
    const next = this.next; this.next = undefined; next();
  }
  choose(index: number) { if (!this.blocked()) this.options[index]?.(); }
  clearDialogue(preserveCast = false) {
    this.dialoguePresentation.stop(!preserveCast);
    this.dialoguePresentation.element.hidden = true;
    this.dialogueStage.hidden = true; this.dialogueStage.classList.remove('has-portraits');
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
    const benefits = growthBenefits(state.state);
    if (kind === 'debate') this.activity = new DebateActivity(isBlocked, complete, benefits.debate, interactionEchoes('debate-round-1', state.state));
    else if (kind === 'writing') this.activity = new WritingActivity(isBlocked, complete, benefits.writing);
    else this.activity = new YorktownActivity(isBlocked, complete, benefits.yorktown);
    this.root.querySelector('.activity-header')?.append(this.growthButton());
  }

  update(delta: number) {
    const paused = this.blocked() || this.growthOpen;
    this.attributeFeedback.update(delta, paused, this.reduceMotion);
    this.dialoguePresentation.update(delta, paused, this.reduceMotion);
    this.activity?.updatePresentation?.(delta, paused, this.reduceMotion);
    if (this.blocked()) return;
    if (this.growthOpen) return;
    const elapsed = Math.max(0, Math.min(100, delta));
    if (this.tutorialRemaining > 0) {
      this.tutorialRemaining = Math.max(0, this.tutorialRemaining - elapsed);
      if (!this.tutorialRemaining) this.tutorial.hidden = true;
    }
    if (!this.root.dataset.presentation && !this.hud.hidden) {
      if (this.growthNoticeRemaining > 0) {
        this.growthNoticeRemaining = Math.max(0, this.growthNoticeRemaining - elapsed);
        if (!this.growthNoticeRemaining) this.hideGrowthNotice();
      }
      if (!this.growthNoticeRemaining && this.growthNotices.length) this.showGrowthNotice(this.growthNotices.shift()!);
    }
    this.activity?.update(elapsed);
    if (this.lineNode && this.revealed < 1) {
      this.revealed = this.reduceMotion || this.textSpeed === 0 ? 1
        : Math.min(1, this.revealed + elapsed / (Math.max(1, primaryText(this.line).length) * this.textSpeed));
      this.refreshLine();
    }

  }
  key(key: string, down: boolean): boolean {
    if (this.growthOpen) return true;
    if (!down) { this.activity?.key(key, false); return this.activityActive || this.dialogueOpen; }
    if (this.blocked()) return false;
    // Local modal handlers wrap the boundaries; native Tab moves between their controls.
    if (key === 'tab') return false;
    // Native buttons activate on Enter/Space. Let their click handler be the only action.
    if ((key === ' ' || key === 'enter') && document.activeElement instanceof HTMLButtonElement) return false;
    if (this.activity) { this.activity.key(key, true); return true; }
    if (!this.dialogueOpen) return false;
    if (key === ' ') this.advance();
    else if (/^[1-4]$/.test(key)) this.choose(Number(key) - 1);
    return true;
  }
  release() { this.activity?.release(); }

  showEnding(state: GameState, onNewRun: () => void, onTitle: () => void) {
    this.clear(true); this.root.dataset.presentation = 'ending';
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
  clear(keepFeedback = false) {
    this.tutorial.hidden = true; this.tutorialRemaining = 0; this.inventory.hidden = true;
    this.closeGrowth(); this.hideGrowthNotice(); this.growthNotices = [];
    this.activity?.destroy(); this.activity = undefined; this.clearDialogue();
    this.ending?.remove(); this.ending = undefined; this.hud.hidden = true;
    if (!keepFeedback) this.attributeFeedback.clear(); this.screen.removeAttribute('inert');
  }
  destroy() { this.clear(); this.input.abort(); this.dialoguePresentation.destroy(); this.unsubscribeLanguage(); this.root.remove(); }
  private growthButton() {
    const button = action(bi('成长', 'Growth'), () => this.openGrowth(), 's3-growth-toggle text-button');
    button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', 's3-growth');
    return button;
  }
  private showGrowthNotice(notice: GrowthNotice) {
    this.currentGrowthNotice = notice;
    const content = el('p', '', this.growth.noticeText(notice));
    const dismiss = action(bi('知道了', 'Got it'), () => this.hideGrowthNotice(), 's3-growth-dismiss text-button');
    this.growthNotice.dataset.notice = notice.id;
    this.growthNotice.replaceChildren(content, dismiss); this.growthNotice.hidden = false; this.growthNoticeRemaining = 14000;
    this.stats.querySelector<HTMLElement>(`[data-stat='${notice.stat}']`)?.setAttribute('data-gained', 'true');
  }
  private hideGrowthNotice() {
    this.growthNotice.hidden = true; this.growthNoticeRemaining = 0;
    this.currentGrowthNotice = undefined;
    this.stats.querySelectorAll('[data-gained]').forEach(node => node.removeAttribute('data-gained'));
  }
  private refreshLine() { if (this.lineNode) setDialogueText(this.lineNode, this.line, this.revealed); }
  private trapFocus(event: KeyboardEvent, container: HTMLElement) {
    if (event.key !== 'Tab' || this.blocked()) return;
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === container)) { event.preventDefault(); first?.focus(); }
  }
}
