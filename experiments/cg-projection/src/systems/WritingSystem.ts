import { dispatches, dispatchBins, type DispatchBin } from '../data/writing';
import { activeDelta } from './TimingSystem';
import type { StateEffect } from '../core/GameState';

export class WritingSystem {
  phase: 'briefing' | 'sort' | 'feedback' | 'result' = 'briefing';
  round = 0;
  remaining = 150000;
  assignments: Record<string, DispatchBin> = {};
  scores: number[] = [];
  get dispatch() { return dispatches[this.round]; }
  get performance() { return Math.round(this.scores.reduce((sum, score) => sum + score, 0) / 15 * 100); }
  begin() { if (this.phase === 'briefing') this.phase = 'sort'; }
  assign(id: string, bin: DispatchBin) {
    if (this.phase === 'sort' && this.dispatch.fragments.some(fragment => fragment.id === id) && dispatchBins.includes(bin)) this.assignments[id] = bin;
  }
  tick(delta: number) {
    if (this.phase !== 'sort') return;
    this.remaining = Math.max(0, this.remaining - activeDelta(delta));
    if (!this.remaining) this.submit();
  }
  submit() {
    if (this.phase !== 'sort') return;
    this.scores.push(this.dispatch.fragments.filter(fragment => this.assignments[fragment.id] === fragment.bin).length);
    this.phase = 'feedback';
  }
  next() {
    if (this.phase !== 'feedback') return;
    if (this.round === dispatches.length - 1 || !this.remaining) this.phase = 'result';
    else { this.round++; this.assignments = {}; this.phase = 'sort'; }
  }
  effects(): StateEffect {
    return this.phase === 'result' ? { washingtonTrust: this.performance >= 80 ? 10 : this.performance >= 50 ? 4 : -3, influence: Math.round(this.performance / 50) } : {};
  }
}
