import './compass-feedback.css';
import { cloneState, initialGameState, STAT_KEYS, type GameState, type StatKey } from '../core/GameState';
import type { ChapterId } from '../data/types';
import { type GrowthAttributeId } from '../data/growth';
import { bi, cat, setLabel, type Text } from '../i18n/text';
import { el } from '../ui/Activity';
import { CampaignCompass } from '../story3d/CampaignCompass';
import type { StateChange } from '../systems/StateSystem';
import { compassCueFrame, CompassFeedbackTimeline } from './CompassFeedbackTimeline';

const labels: Record<StatKey, Text> = {
  momentum: bi('锐气', 'Momentum'), influence: bi('影响力', 'Influence'),
  washingtonTrust: bi('华盛顿信任', 'Washington Trust'), burrRivalry: bi('伯尔竞争', 'Burr Rivalry'), burrRespect: bi('伯尔尊重', 'Burr Respect'),
  debatePerformance: bi('辩论表现', 'Debate Performance'), yorktownPerformance: bi('战役表现', 'Campaign Performance'),
};
let instance = 0;

/** Reuses the HUD's actual SVG renderer. Only its position, size and displayed state animate. */
export class CompassFeedback {
  readonly element = el('aside', 'cf-feedback');
  private panel = el('div', 'cf-panel');
  private disc = el('div', 'cf-disc');
  private changes = el('div', 'cf-changes');
  private appearance = new CampaignCompass(`feedback-compass-${++instance}`);
  readonly timeline = new CompassFeedbackTimeline();
  private state = initialGameState();
  private chapter: ChapterId = 'Opening';
  private rendered = -1;
  private held = false;
  private reduced = false;
  private layoutBlocked = false;

  constructor(private source: HTMLElement) {
    this.element.hidden = true;
    this.changes.setAttribute('aria-live', 'polite'); this.changes.setAttribute('aria-atomic', 'true');
    setLabel(this.element, 'aria-label', bi('属性圆盘变化', 'Attribute dial change'));
    this.disc.append(this.appearance.element);
    this.panel.append(this.disc, this.changes); this.element.append(this.panel);
    // The enlarged copy is presentation only. The original HUD keeps its regular interactions.
    this.disc.setAttribute('aria-hidden', 'true');
    for (const part of this.appearance.parts.values()) { part.removeAttribute('tabindex'); part.removeAttribute('role'); }
  }
  setContext(state: GameState, chapter: ChapterId) { this.state = cloneState(state); this.chapter = chapter; }
  setHold(hold: boolean) { this.held = hold; }
  show(changes: readonly StateChange[]) { this.timeline.enqueue(changes, this.state, this.chapter); this.paint(); }
  clear() { this.timeline.clear(); this.source.removeAttribute('data-cue-lifted'); this.paint(); }
  update(delta: number, paused: boolean, reduced: boolean) {
    this.reduced = reduced;
    this.timeline.tick(delta, paused || this.held || this.chapter === 'Opening' || this.layoutBlocked);
    this.paint();
  }
  snapshot() { return { variant: 'compass', current: this.timeline.current?.changes ?? [], queued: this.timeline.queued, elapsed: this.timeline.elapsed, phase: compassCueFrame(this.timeline.elapsed).phase, before: this.timeline.current?.before, after: this.timeline.current?.after, layoutBlocked: this.layoutBlocked }; }

  private paint() {
    const q = this.timeline, cue = q.current;
    this.element.hidden = !cue || this.chapter === 'Opening';
    if (!cue) { this.source.removeAttribute('data-cue-lifted'); return; }
    if (this.chapter === 'Opening') return;
    if (this.rendered !== q.serial) {
      this.rendered = q.serial;
      this.changes.replaceChildren();
      for (const part of this.appearance.parts.values()) part.removeAttribute('data-changing');
      for (const change of cue.changes) {
        const row = el('span', 'cf-change'); row.dataset.direction = change.delta > 0 ? 'up' : 'down'; row.dataset.stat = change.stat;
        row.append(el('span', 'cf-name', labels[change.stat]), el('strong', 'cf-delta', `${change.delta > 0 ? '+' : '−'}${Math.abs(change.delta)}`));
        setLabel(row, 'aria-label', cat`${labels[change.stat]} ${change.delta > 0 ? '+' : ''}${change.delta} · ${change.value - change.delta} → ${change.value}`);
        this.changes.append(row);
        this.appearance.parts.get(change.stat as GrowthAttributeId)?.setAttribute('data-changing', 'true');
      }
    }
    const frame = compassCueFrame(q.elapsed);
    const state = cloneState(cue.before);
    const progress = this.reduced ? (q.elapsed >= 620 ? 1 : 0) : frame.value;
    for (const key of STAT_KEYS) state[key] = cue.before[key] + (cue.after[key] - cue.before[key]) * progress;
    this.appearance.update(state, !['Washington', 'Yorktown'].includes(cue.chapter));
    const pulse = frame.phase === 'change' ? Math.sin(Math.PI * frame.value) : 0;
    this.element.style.setProperty('--cf-brightness', String(1 + pulse * .38));
    this.element.style.setProperty('--cf-glow', `${pulse * 5}px`);
    this.element.dataset.phase = frame.phase;
    this.element.dataset.reduced = String(this.reduced);
    this.changes.style.opacity = String(frame.label);

    // Enlarge in place from the HUD's top-left edge, keeping the feedback on the left.
    const rect = this.source.getBoundingClientRect();
    const sourceSize = rect.width || 174;
    const left = rect.width ? rect.left : 30;
    const top = rect.width ? rect.top : 162;
    const dialogue = this.element.parentElement?.querySelector<HTMLElement>('.s3-dialogue:not([hidden])');
    const bottom = dialogue ? dialogue.getBoundingClientRect().top - 12 : innerHeight - 95;
    const desiredSize = Math.min(sourceSize * 1.5, innerWidth - left - 16);
    this.panel.style.width = `${desiredSize}px`;
    const labelHeight = this.changes.offsetHeight + 12;
    const size = Math.min(desiredSize, bottom - top - labelHeight);
    this.layoutBlocked = size < 100;
    this.element.hidden = this.layoutBlocked;
    if (this.layoutBlocked) { this.source.removeAttribute('data-cue-lifted'); return; }
    this.source.setAttribute('data-cue-lifted', 'true');
    const scale = this.reduced ? 1 : sourceSize / size + (1 - sourceSize / size) * frame.travel;
    this.panel.style.width = `${size}px`; this.panel.style.height = `${size}px`;
    this.panel.style.left = `${left}px`; this.panel.style.top = `${top}px`;
    this.panel.style.transform = `scale(${scale})`;
    // A HUD hidden during dialogue has no visible return target; fade during the last leg.
    const hudVisible = getComputedStyle(this.source.parentElement!).visibility !== 'hidden' && !this.source.hidden;
    this.panel.style.opacity = String(this.reduced || !hudVisible ? Math.min(1, q.elapsed / 180, (3500 - q.elapsed) / 300) : 1);
    this.element.dataset.small = String(size < 210);
  }
}
