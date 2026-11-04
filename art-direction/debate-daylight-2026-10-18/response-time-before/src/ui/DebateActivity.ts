import { setDialogueText, setText, setLabel } from '../i18n/text';
import { bi, f, cat, type Text, type BiText } from '../i18n/text';
import { beatGradeNames } from '../data/labels';
import { DebateSystem } from '../systems/DebateSystem';
import { responseHints, responseNames, responseTypes } from '../data/debate';
import { ActivityPanel, action, el, beatTrack, updateBeat } from './Activity';
import { noDebateBenefits, type DebateBenefits } from '../data/growth';
import type { DialogueLine } from '../data/types';
import { characters } from '../data/characters';
import './debate.css';
import { crowdNeedleAngle } from './debateBalance';

function dialogue<K extends 'p' | 'blockquote'>(tag: K, text: BiText) {
  const node = el(tag, 'debate-dialogue'); setDialogueText(node, text); return node;
}

export class DebateActivity extends ActivityPanel {
  private game: DebateSystem;
  private shown = '';
  private balance = el('div', 'debate-balance');
  private balanceValue = el('span', 'debate-balance-value');
  private layoutObserver?: ResizeObserver;
  private bubbles = el('div', 'debate-speech');
  constructor(blocked: () => boolean, private onComplete: (result: DebateSystem) => void, benefits: DebateBenefits = noDebateBenefits, private openingLines: DialogueLine[] = []) {
    super(bi("公开辩论", "PUBLIC DEBATE"), blocked, false);
    const instrument = el('div', 'debate-instrument');
    instrument.setAttribute('aria-hidden', 'true');
    instrument.append(el('span', 'debate-needle'), el('span', 'debate-pivot'));
    const sides = el('div', 'debate-sides');
    sides.append(el('span', '', characters.hamilton.name), this.balanceValue, el('span', '', characters.loyalist.name));
    this.balance.append(instrument, sides);
    this.balance.setAttribute('role', 'meter'); this.balance.setAttribute('aria-valuemin', '0'); this.balance.setAttribute('aria-valuemax', '100');
    setLabel(this.balance, 'aria-label', bi('群众支持；指针向左支持汉密尔顿，向右支持保皇派', 'Crowd support; left favors Hamilton, right favors the Loyalist'));
    this.stage.prepend(this.balance);
    this.stage.insertBefore(this.bubbles, this.panel);
    const portraits = this.stage.querySelector<HTMLElement>('.dialogue-portraits');
    if (portraits) portraits.dataset.lighting = 'daylight';
    this.layoutObserver = new ResizeObserver(() => {
      this.stage.style.setProperty('--debate-deck-height', `${this.panel.getBoundingClientRect().height}px`);
    });
    this.layoutObserver.observe(this.panel);
    this.game = new DebateSystem(benefits); this.refresh();
  }
  private responseIcon(type: string) {
    const icon = el('span', 'response-icon'); icon.dataset.icon = type; icon.setAttribute('aria-hidden', 'true'); return icon;
  }
  private showBubbles(lines: DialogueLine[]) {
    this.bubbles.hidden = !lines.length;
    this.bubbles.replaceChildren(...lines.map(line => {
      const bubble = el('div', 'debate-bubble'); bubble.dataset.speaker = line.speaker;
      // Spoken prompts use the primary language even in bilingual modes.
      bubble.append(el('span', 'debate-speaker', characters[line.speaker].name), el('p', 'debate-bubble-text', line.text));
      return bubble;
    }));
    this.syncBubbles();
  }
  private syncBubbles() {
    const portraits = this.root.querySelector('.dialogue-portraits');
    for (const bubble of this.bubbles.querySelectorAll<HTMLElement>('.debate-bubble')) {
      const slot = portraits?.querySelector<HTMLElement>(`[data-character="${bubble.dataset.speaker}"]`);
      bubble.dataset.side = slot?.dataset.side ?? 'left';
      bubble.dataset.active = String(portraits?.getAttribute('data-speaker') === bubble.dataset.speaker);
    }
  }
  override updatePresentation(delta: number, paused: boolean, reducedMotion: boolean) {
    super.updatePresentation(delta, paused, reducedMotion); this.syncBubbles();
    this.root.dataset.paused = String(paused); this.root.dataset.reducedMotion = String(reducedMotion);
  }
  override destroy() { this.layoutObserver?.disconnect(); super.destroy(); }
  key(key: string, down: boolean) {
    if (!down || this.blocked()) return;
    if (this.game.phase === 'choose' && /^[1-4]$/.test(key)) this.game.select(responseTypes[Number(key) - 1]);
    else if (this.game.phase === 'beat' && key === ' ') this.game.hit();
    this.refresh();
  }
  update(delta: number) { this.game.tick(delta); if (this.game.phase === 'beat') this.cue(String(this.game.round), this.game.elapsed); this.refresh(); }
  private refresh() {
    const g = this.game;
    this.root.dataset.activity = 'debate'; this.root.dataset.phase = g.phase; this.root.dataset.round = String(g.round);
    this.root.dataset.crowdBonus = String(g.crowdBonus); this.root.dataset.attackRecoveriesUsed = String(g.attackRecoveriesUsed);
    if (this.shown !== `${g.phase}:${g.round}`) {
      this.shown = `${g.phase}:${g.round}`;
      this.showBubbles([]);
      this.balance.style.setProperty('--crowd-angle', `${crowdNeedleAngle(g.crowd)}deg`);
      this.balance.setAttribute('aria-valuenow', String(g.crowd));
      setText(this.balanceValue, f(bi('群众支持 {0}%', 'Crowd support {0}%'), g.crowd));
      const stats = el('div', 'activity-stats');
      stats.append(el('span', '', f(bi("支持 {0} / 75", "Support {0} / 75"), g.crowd)), el('span', '', f(bi("对方可信度 {0} / 25", "Opponent Credibility {0} / 25"), g.credibility)), el('strong', 'gold', f(bi("连击 ×{0}", "FLOW ×{0}"), g.flow)));
      const heading = el('h2', '', g.argument.topic);
      const progress = el('p', 'muted', f(bi("第 {0} / 6 轮 · 支持达 75 或对方可信度降至 25 获胜", "Round {0} / 6 · Win at 75 support or 25 opponent credibility"), g.round + 1));
      if (g.phase === 'argument') {
        this.render(stats, progress, heading, el('p', 'muted', g.argument.opening), el('p', 'activity-instructions', bi("听完论点，准备接话。开始后 2.5 秒内按 1–4 选回应，再在金线处按空格发声。", "Hear the argument. When ready, choose with 1–4 within 2.5 seconds, then press SPACE at the gold line.")), action(bi("准备回应 →", "Ready to Respond →"), () => { g.ready(); this.refresh(); }, 'primary'));
      } else if (g.phase === 'choose') {
        const cards = el('div', 'response-cards');
        responseTypes.forEach((type, index) => {
          const card = action('', () => { g.select(type); this.refresh(); }, 'response-card');
          card.dataset.response = type;
          card.append(el('span', 'response-key', String(index + 1)), this.responseIcon(type), el('strong', '', responseNames[type]), el('p', '', g.argument.responses[type]), el('small', 'response-hint', responseHints[type])); cards.append(card);
        });
        this.render(stats, heading, el('p', 'activity-timer'), cards);
      } else if (g.phase === 'beat') {
        this.render(stats, heading, dialogue('blockquote', g.argument.responses[g.selected!]), el('p', 'activity-instructions', bi("游标靠近金线时按 SPACE，或点击下方按钮。只接受第一次输入。", "Press SPACE near the gold line, or click below. Only the first input counts.")), beatTrack(), action(bi("SPACE · 发声", "SPACE · Speak"), () => { g.hit(); this.refresh(); }, 'primary beat-button'));
      } else if (g.phase === 'feedback') {
        setText(this.live, f(bi("{0}，群众支持 {1}，对方可信度 {2}", "{0}, crowd support {1}, opponent credibility {2}"), beatGradeNames[g.grade], g.crowd, g.credibility));
        this.render(stats, el('h2', `grade ${g.grade.toLowerCase()}`, g.selected ? beatGradeNames[g.grade] : bi("没有回应", "No Response")), g.selected ? dialogue('p', g.argument.responses[g.selected]) : el('p', '', bi("你迟疑了一刻，讨论被对方接了过去。", "You hesitated, and your opponent took the floor.")), el('p', 'muted', g.grade === 'MISS' ? g.selected === 'ATTACK' ? bi("反击失去节奏，人群转而质疑你。", "Your attack lost its rhythm. The crowd turns its doubts toward you.") : bi("连击中断。听清下一轮，再找回节奏。", "Your Flow breaks. Listen to the next argument and find the rhythm again.") : bi("声音落在了节拍上，人群正在跟上你。", "Your words land on the beat. The crowd is beginning to follow.")), action(g.won || g.round === 5 ? bi("查看辩论结果 →", "View Debate Result →") : bi("听下一个论点 →", "Hear the Next Argument →"), () => { g.next(); this.refresh(); }, 'primary'));
      } else {
        const effect = g.effects();
        this.render(stats, el('h2', '', g.won ? bi("广场听见了你。", "The square has heard you.") : bi("这场争论，还没有结束。", "This argument is not over.")), el('p', 'activity-score', `${g.performance} / 100`), el('p', '', f(bi("节拍表现 · 最长连击 {0} · 影响力 +{1} · 锐气 {2}{3}", "Rhythm performance · Best Flow {0} · Influence +{1} · Momentum {2}{3}"), g.bestFlow, effect.influence, Number(effect.momentum) > 0 ? '+' : '', effect.momentum)), el('p', '', effect.burrRespect ? bi("伯尔记住了你反复核对事实的方式。尊重 +10。", "Burr remembers your care with the facts. Respect +10.") : effect.burrRivalry ? bi("伯尔记住了你连续反击的锋芒。竞争 +10。", "Burr remembers the edge of your repeated attacks. Rivalry +10.") : bi("伯尔看见了你的回应方式。", "Burr has noticed the way you respond.")), el('p', 'muted', g.won ? bi("你的名声将随文章传进军营。", "Your reputation will travel into camp with your writing.") : bi("你没有赢下广场，但写作与组织能力仍会把你带入军营。", "You did not win the square, but your writing and organizing will still take you into camp.")), action(bi("继续前往军营 →", "Continue toward Camp →"), () => this.finish(() => this.onComplete(g)), 'primary'));
      }
      if (g.phase === 'argument') {
        const help = el('p', 'activity-instructions growth-benefits', f(bi('本场成长：影响力带来初始群众支持 +{0}；锐气「稳住场面」剩余 {1} 次。首次反击失拍可免受反噬，节拍仍记失误。', 'Growth this debate: Influence grants +{0} initial crowd support; Momentum backlash protection has {1} use remaining. It protects the first missed attack from backlash; the beat still counts as a miss.'), g.crowdBonus, g.attackRecoveriesRemaining));
        const details = el('details', 'debate-details');
        details.append(el('summary', '', bi('本场加成与判定', 'Bonuses & timing')), help, el('p', '', bi('完美 ±100 ms · 良好 ±250 ms。指针只显示群众支持；对方可信度单独计算。', 'Perfect ±100 ms · Good ±250 ms. The needle shows crowd support; opponent credibility is scored separately.')));
        this.body.insertBefore(details, this.body.lastElementChild);
        this.speak([...(g.round === 0 ? this.openingLines : []), { speaker: 'loyalist', text: g.argument.text }]);
      }
      if (g.phase === 'feedback' && g.attackRecoveryTriggered) {
        const explanation = bi('锐气帮助你稳住场面；本次节拍仍记为失误，连击已中断。一次保护已用完。', 'Momentum helps you steady the room. This beat still counts as a miss and breaks your Flow. Your one protection has been used.');
        const feedback = this.body.querySelector('p.muted'); if (feedback) setText(feedback, explanation);
        setText(this.live, explanation);
      }
      if (g.phase === 'result') this.body.insertBefore(el('p', 'muted growth-result', f(bi('成长帮助：初始群众支持 +{0}；稳住场面已使用 {1} / {2} 次。节拍成绩按真实输入记录。', 'Growth assistance: +{0} initial crowd support; backlash protection used {1} / {2} times. Rhythm scores reflect your actual inputs.'), g.crowdBonus, g.attackRecoveriesUsed, g.attackRecoveriesGranted)), this.body.lastElementChild);
      if (g.phase === 'feedback') {
        const outcome = g.grade === 'MISS' ? 'miss' : 'success';
        if (g.selected) this.speak([{ speaker: 'hamilton', text: g.argument.responses[g.selected] }], outcome);
        else this.react(outcome);
      }
      if (g.phase === 'result') this.react(g.won ? 'success' : 'miss');
      if (g.phase === 'choose') this.presentSpeaker('loyalist', 'hamilton');
      if (g.phase === 'beat') this.presentSpeaker('hamilton', 'loyalist');
      if (g.phase === 'argument' || g.phase === 'choose') this.showBubbles([
        ...(g.phase === 'argument' && g.round === 0 ? this.openingLines : []),
        { speaker: 'loyalist', text: g.argument.text },
      ]);
    }
    this.speechStatus();
    const timer = this.root.querySelector('.activity-timer');
    if (timer) setText(timer, f(bi("选择回应 · {0} 秒", "Choose a response · {0} seconds"), Math.max(0, (2500 - g.elapsed) / 1000).toFixed(1)));
    updateBeat(this.root, g.elapsed);
  }
}
