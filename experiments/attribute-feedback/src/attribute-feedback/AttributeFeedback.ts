import './feedback.css';
import './stamp.css';
import './spark.css';
import './ruler.css';
import { bi, cat, f, setLabel } from '../i18n/text';
import { el } from '../ui/Activity';
import type { StatKey } from '../core/GameState';
import type { StateChange } from '../systems/StateSystem';
import { FeedbackQueue, type FeedbackVariant } from './FeedbackQueue';

const attributes = {
  momentum: { label: bi('锐气', 'Momentum'), accent: '#efd16e', ink: '#cfae45', path: 'M12 2 5 13h6l-1 9 9-13h-7z' },
  influence: { label: bi('影响力', 'Influence'), accent: '#d4d9d7', ink: '#313b3c', path: 'm3 18 1-12 5 6 3-9 3 9 5-6 1 12z M5 21h14' },
  washingtonTrust: { label: bi('华盛顿信任', 'Washington Trust'), accent: '#9cc4ac', ink: '#285742', path: 'm12 2 8 4-1 10-7 6-7-6L4 6z M8 12l3 3 5-6' },
  burrRivalry: { label: bi('伯尔竞争', 'Burr Rivalry'), accent: '#ecaa97', ink: '#a4483b', path: 'm4 3 13 13 M3 4l1 5 11 11 5-5L9 4z M20 3 7 16 M21 4l-1 5-4 4 M9 15l-5 5' },
  burrRespect: { label: bi('伯尔尊重', 'Burr Respect'), accent: '#b5d8e7', ink: '#527f99', path: 'm3 12 5-5 4 2 4-2 5 5-8 8-5-2z M8 7l4 5 4-2 M7 16l3-3' },
  debatePerformance: { label: bi('辩论表现', 'Debate Performance'), accent: '#ecd096', ink: '#ba975c', path: 'M3 4h18v12H11l-6 5v-5H3z M7 8h10 M7 12h7' },
  yorktownPerformance: { label: bi('战役表现', 'Campaign Performance'), accent: '#ecd096', ink: '#ba975c', path: 'M5 22V3h14l-3 5 3 5H5 M3 22h6' },
} as const;

export class AttributeFeedback {
  readonly element = el('aside', 'af-feedback');
  readonly queue = new FeedbackQueue();
  private composition = el('div', 'af-composition');
  private rows = el('div', 'af-rows');
  private life = el('div', 'af-life');
  private rendered = -1;
  private hover = false;
  private focus = false;
  private externalHold = false;
  private phase = '';
  private layoutBlocked = false;

  constructor(private open: (stat: StatKey) => void, private blocked: () => boolean) {
    this.element.hidden = true;
    this.element.setAttribute('aria-live', 'polite'); this.element.setAttribute('aria-atomic', 'true');
    setLabel(this.element, 'aria-label', bi('属性变动', 'Attribute changes'));
    this.life.setAttribute('aria-hidden', 'true');
    this.composition.append(el('p', 'af-heading', bi('属性变动', 'ATTRIBUTE CHANGE')), this.rows, this.life);
    this.element.append(this.composition);
    this.rows.addEventListener('pointerenter', () => { this.hover = true; });
    this.rows.addEventListener('pointerleave', () => { this.hover = false; });
    this.rows.addEventListener('focusin', () => { this.focus = true; });
    this.rows.addEventListener('focusout', event => { this.focus = event.relatedTarget instanceof Node && this.rows.contains(event.relatedTarget); });
    this.element.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); });
    this.element.addEventListener('keydown', event => {
      if (event.key === ' ' || event.key === 'Enter') event.stopPropagation();
      else if (/^(w|a|s|d|e|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Escape)$/i.test(event.key))
        document.querySelector<HTMLElement>('.d3-canvas')?.focus({ preventScroll: true });
    });
  }

  setVariant(variant: FeedbackVariant) { this.queue.variant = variant; this.rendered = -1; this.paint(); }
  setHold(hold: boolean) { this.externalHold = hold; }
  show(changes: readonly StateChange[]) { this.queue.enqueue(changes); this.paint(); }
  update(delta: number, paused: boolean, reduced: boolean) {
    this.element.dataset.reduced = String(reduced);
    const hold = paused || this.blocked() || this.hover || this.focus || this.externalHold || this.layoutBlocked;
    this.element.dataset.paused = String(hold);
    this.queue.tick(delta, hold); this.paint();
  }
  clear() { this.queue.clear(); this.hover = false; this.focus = false; this.paint(); }

  private paint() {
    const q = this.queue;
    this.element.dataset.variant = q.variant;
    this.element.hidden = !q.current.length;
    this.element.dataset.queued = String(q.queued);
    if (this.rendered !== q.serial) {
      this.rendered = q.serial; this.phase = ''; this.rows.replaceChildren();
      for (const [index, change] of q.current.entries()) {
        const data = attributes[change.stat], before = change.value - change.delta;
        const row = el('button', 'af-row'); row.type = 'button';
        row.dataset.stat = change.stat; row.dataset.direction = change.delta > 0 ? 'up' : 'down';
        row.style.setProperty('--index', String(index)); row.style.setProperty('--accent', data.accent); row.style.setProperty('--stat-ink', data.ink);
        row.style.setProperty('--before', `${before}%`); row.style.setProperty('--after', `${change.value}%`);
        row.style.setProperty('--change-start', `${Math.min(before, change.value)}%`); row.style.setProperty('--change-width', `${Math.abs(change.delta)}%`);
        const icon = el('span', 'af-icon'); icon.setAttribute('aria-hidden', 'true');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', data.path); svg.append(path); icon.append(svg);
        const delta = `${change.delta > 0 ? '+' : '−'}${Math.abs(change.delta)}`;
        const values = el('span', 'af-values');
        values.append(el('span', 'af-before', String(before)), el('span', 'af-arrow', '→'), el('span', 'af-after', String(change.value)));
        const track = el('span', 'af-track'); track.setAttribute('aria-hidden', 'true');
        track.append(el('span', 'af-track-before'), el('span', 'af-track-change'));
        row.append(icon, el('span', 'af-label', data.label), el('strong', 'af-delta', delta), values, track);
        const label = f(bi('{0} {1}，{2} → {3}。点击查看属性含义。', '{0} {1}, {2} → {3}. Click for attribute details.'), data.label, delta, before, change.value);
        const clickable = !change.stat.endsWith('Performance');
        setLabel(row, 'aria-label', clickable ? label : cat`${data.label} ${delta} · ${before} → ${change.value}`);
        if (clickable) setLabel(row, 'title', bi('悬停停留 · 点击查看含义', 'Hover to hold · Click for details'));
        else { row.tabIndex = -1; row.setAttribute('aria-disabled', 'true'); }
        row.addEventListener('click', event => { event.stopPropagation(); if (clickable && !this.blocked()) { if (event.detail > 0) document.querySelector<HTMLElement>('.d3-canvas')?.focus({ preventScroll: true }); this.open(change.stat); } });
        this.rows.append(row);
      }
    }
    this.position();
    // CSS animation clocks are sought from the game clock; browser pause and hidden tabs cannot let them run ahead.
    // Entry persists through hold, so changing phase at 500 ms never replays the impact.
    const phase = q.phase === 'exit' ? 'exit' : 'enter';
    if (this.phase !== phase) { this.element.dataset.phase = phase; this.phase = phase; }
    this.element.style.setProperty('--remaining', String(Math.max(0, 1 - q.elapsed / q.duration)));
    const time = phase === 'exit' ? q.elapsed - (q.duration - 300) : q.elapsed;
    for (const animation of this.element.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = time; }
  }
  private position() {
    const dialogue = this.element.parentElement?.querySelector<HTMLElement>('.s3-dialogue:not([hidden])');
    this.layoutBlocked = false;
    this.element.dataset.compact = 'false';
    this.element.dataset.narrow = 'false';
    this.element.style.top = '50%';
    if (!dialogue || !this.queue.current.length) return;
    const bottom = dialogue.getBoundingClientRect().top - 14;
    const top = Math.max(80, ...Array.from(document.querySelectorAll('.d3-heading, .d3-actions')).map(node => node.getBoundingClientRect().bottom)) + 12;
    const available = bottom - top;
    if (innerWidth < 500) {
      this.element.dataset.narrow = 'true';
      if (this.queue.variant !== 'stamp') this.element.dataset.compact = 'true';
    }
    // On narrow portrait screens a single centered cue leaves both faces more visible.
    if (innerWidth < 500 && this.queue.limitCurrent(1)) { this.paint(); return; }
    let height = this.element.getBoundingClientRect().height;
    if (height > available) {
      this.element.dataset.compact = 'true';
      height = this.element.getBoundingClientRect().height;
      if (height > available && this.queue.limitCurrent(1)) { this.paint(); return; }
    }
    if (height > available) { this.layoutBlocked = true; this.element.hidden = true; return; }
    this.element.style.top = `${Math.min(innerHeight / 2, bottom - height / 2)}px`;
  }
  snapshot() { return { variant: this.queue.variant, current: this.queue.current, queued: this.queue.queued, elapsed: this.queue.elapsed, phase: this.queue.phase }; }
}
