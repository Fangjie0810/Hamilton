import { cloneState, type GameState } from '../core/GameState';
import type { ChapterId } from '../data/types';
import type { StateChange } from '../systems/StateSystem';

export const COMPASS_CUE_MS = 3500;
export const compassEase = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
export function compassCueFrame(elapsed: number) {
  return {
    travel: elapsed < 520 ? compassEase(elapsed / 520) : elapsed < 2980 ? 1 : 1 - compassEase((elapsed - 2980) / 520),
    value: compassEase((elapsed - 620) / 1000),
    label: Math.min(1, Math.max(0, (elapsed - 460) / 220), Math.max(0, (3100 - elapsed) / 200)),
    phase: elapsed < 520 ? 'arrive' : elapsed < 1620 ? 'change' : elapsed < 2980 ? 'hold' : 'return',
  };
}
export interface CompassCue { changes: StateChange[]; before: GameState; after: GameState; chapter: ChapterId }
/** Whole commits stay together, including all five sectors and the independent performance scores. */
export class CompassFeedbackTimeline {
  private pending: CompassCue[] = [];
  current?: CompassCue;
  elapsed = 0;
  serial = 0;
  get queued() { return this.pending.length; }
  enqueue(changes: readonly StateChange[], after: GameState, chapter: ChapterId) {
    const actual = changes.filter(c => c.delta !== 0 && Number.isFinite(c.delta) && Number.isFinite(c.value));
    if (!actual.length) return;
    const before = cloneState(after), final = cloneState(after);
    for (const c of actual) { before[c.stat] = c.value - c.delta; final[c.stat] = c.value; }
    this.pending.push({ changes: actual.map(c => ({ ...c })), before, after: final, chapter });
    if (!this.current) this.next();
  }
  tick(delta: number, paused: boolean) {
    if (!this.current || paused) return;
    this.elapsed += Math.max(0, Math.min(100, delta));
    if (this.elapsed >= COMPASS_CUE_MS) this.next();
  }
  private next() { this.current = this.pending.shift(); this.elapsed = 0; this.serial++; }
  clear() { this.pending = []; this.current = undefined; this.elapsed = 0; this.serial++; }
}
