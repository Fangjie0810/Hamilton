import { dispatches, dispatchBins, type DispatchBin } from '../data/writing';
import { activeDelta } from './TimingSystem';
import type { StateEffect } from '../core/GameState';
import { noWritingBenefits, type WritingBenefits } from '../data/growth';

export class WritingSystem {
  phase: 'briefing' | 'sort' | 'feedback' | 'result' = 'briefing';
  round = 0;
  remaining = 150000;
  assignments: Record<string, DispatchBin> = {};
  scores: number[] = [];
  readonly referencesGranted: number;
  referencesUsed = 0;
  referenceHint: { round: number; fragmentId: string; bin: DispatchBin } | null = null;
  constructor(benefits: WritingBenefits = noWritingBenefits) { this.referencesGranted = benefits.referenceUses > 0 ? 1 : 0; }
  get referencesRemaining() { return this.referencesGranted - this.referencesUsed; }
  get dispatch() { return dispatches[this.round]; }
  get performance() { return Math.round(this.scores.reduce((sum, score) => sum + score, 0) / 15 * 100); }
  begin() { if (this.phase === 'briefing') this.phase = 'sort'; }
  reference(id: string | null): DispatchBin | null {
    if (this.phase !== 'sort' || !this.referencesRemaining || !id) return null;
    const fragment = this.dispatch.fragments.find(fragment => fragment.id === id);
    if (!fragment) return null;
    this.referencesUsed++;
    this.referenceHint = { round: this.round, fragmentId: fragment.id, bin: fragment.bin };
    return fragment.bin;
  }
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
