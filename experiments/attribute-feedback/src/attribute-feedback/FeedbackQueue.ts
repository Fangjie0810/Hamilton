import type { StateChange } from '../systems/StateSystem';

export type FeedbackVariant = 'stamp' | 'spark' | 'ruler';
export const feedbackDurations: Record<FeedbackVariant, number> = { stamp: 3300, spark: 2900, ruler: 3700 };
/** Keeps each committed change intact, including opposite changes to the same attribute. */
export class FeedbackQueue {
  private pending: StateChange[][] = [];
  current: StateChange[] = [];
  elapsed = 0;
  serial = 0;
  variant: FeedbackVariant = 'stamp';
  get duration() { return feedbackDurations[this.variant]; }
  get phase() { return this.elapsed >= this.duration - 300 ? 'exit' : this.elapsed < 500 ? 'enter' : 'hold'; }
  get queued() { return this.pending.length; }
  enqueue(changes: readonly StateChange[]) {
    const actual = changes.filter(c => Number.isFinite(c.delta) && c.delta !== 0 && Number.isFinite(c.value));
    for (let i = 0; i < actual.length; i += 3) this.pending.push(actual.slice(i, i + 3).map(c => ({ ...c })));
    if (!this.current.length) this.advance();
  }
  tick(delta: number, paused = false) {
    if (paused || !this.current.length) return;
    this.elapsed += Math.max(0, Math.min(100, delta));
    if (this.elapsed >= this.duration) this.advance();
  }
  limitCurrent(limit: number) {
    if (this.current.length <= limit) return false;
    this.pending.unshift(this.current.splice(limit));
    this.serial++;
    return true;
  }
  private advance() { this.current = this.pending.shift() ?? []; this.elapsed = 0; this.serial++; }
  clear() { this.pending = []; this.current = []; this.elapsed = 0; this.serial++; }
}
