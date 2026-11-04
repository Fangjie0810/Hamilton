import { debateArguments, responseTypes, type ResponseType } from '../data/debate';
import type { StateEffect } from '../core/GameState';
import { activeDelta, BEAT_TARGET_MS, GOOD_MS, judgeBeat, gradeValue, clamp, type BeatGrade } from './TimingSystem';
import { noDebateBenefits, type DebateBenefits } from '../data/growth';

export class DebateSystem {
  phase: 'argument' | 'choose' | 'beat' | 'feedback' | 'result' = 'argument';
  round = 0;
  elapsed = 0;
  crowd = 25;
  credibility = 90;
  flow = 0;
  bestFlow = 0;
  selected: ResponseType | null = null;
  grade: BeatGrade = 'MISS';
  readonly crowdBonus: number;
  readonly attackRecoveriesGranted: number;
  attackRecoveriesUsed = 0;
  attackRecoveryTriggered = false;
  readonly history: { response: ResponseType | null; grade: BeatGrade }[] = [];
  constructor(benefits: DebateBenefits = noDebateBenefits) {
    this.crowdBonus = Number.isFinite(benefits.crowdBonus) ? Math.min(10, Math.max(0, benefits.crowdBonus)) : 0;
    this.attackRecoveriesGranted = benefits.attackRecovery > 0 ? 1 : 0;
    this.crowd += this.crowdBonus;
  }
  get attackRecoveriesRemaining() { return this.attackRecoveriesGranted - this.attackRecoveriesUsed; }
  get argument() { return debateArguments[this.round]; }
  get won() { return this.crowd >= 75 || this.credibility <= 25; }
  get performance() { return Math.round(this.history.reduce((total, turn) => total + gradeValue(turn.grade), 0) / Math.max(1, this.history.length) * 100); }
  get dominant(): ResponseType | null {
    const counts = responseTypes.map(type => ({ type, count: this.history.filter(turn => turn.response === type).length }));
    const leader = counts.sort((a, b) => b.count - a.count)[0];
    return leader.count ? leader.type : null;
  }
  ready() { if (this.phase === 'argument') { this.phase = 'choose'; this.elapsed = 0; } }
  tick(delta: number) {
    if (this.phase !== 'choose' && this.phase !== 'beat') return;
    this.elapsed += activeDelta(delta);
    if (this.phase === 'choose' && this.elapsed >= 2500) this.resolve('MISS');
    else if (this.phase === 'beat' && this.elapsed > BEAT_TARGET_MS + GOOD_MS) this.resolve('MISS');
  }
  select(response: ResponseType) {
    if (this.phase !== 'choose' || !responseTypes.includes(response)) return;
    this.selected = response;
    this.phase = 'beat'; this.elapsed = 0;
  }
  hit() { if (this.phase === 'beat') this.resolve(judgeBeat(this.elapsed)); }
  next() {
    if (this.phase !== 'feedback') return;
    if (this.won || this.round === debateArguments.length - 1) this.phase = 'result';
    else { this.round++; this.phase = 'argument'; this.selected = null; this.elapsed = 0; }
  }
  private resolve(grade: BeatGrade) {
    this.grade = grade;
    this.attackRecoveryTriggered = false;
    const success = grade !== 'MISS';
    this.flow = success ? this.flow + 1 : 0;
    this.bestFlow = Math.max(this.bestFlow, this.flow);
    if (!this.selected) { this.crowd = clamp(this.crowd - 5); this.credibility = clamp(this.credibility + 4); }
    else if (this.selected === 'ATTACK' && !success) {
      if (this.attackRecoveriesRemaining) { this.attackRecoveriesUsed++; this.attackRecoveryTriggered = true; }
      else { this.crowd = clamp(this.crowd - 12); this.credibility = clamp(this.credibility + 8); }
    }
    else {
      const [support, damage] = { FACT: [10, 18], PRINCIPLE: [16, 8], ATTACK: [15, 22], CROWD: [22, -3] }[this.selected];
      const multiplier = (success ? grade === 'PERFECT' ? 1 : 0.8 : 0.2) + (success ? Math.min(0.3, (this.flow - 1) * 0.1) : 0);
      const contextBonus = success && this.selected === this.argument.emphasis ? 3 : 0;
      this.crowd = clamp(this.crowd + Math.round(support * multiplier) + contextBonus);
      this.credibility = clamp(this.credibility - Math.round(damage * multiplier) - contextBonus);
    }
    this.history.push({ response: this.selected, grade });
    this.phase = 'feedback';
  }
  effects(): StateEffect {
    if (this.phase !== 'result') return {};
    const facts = this.history.filter(turn => turn.response === 'FACT').length;
    const attacks = this.history.filter(turn => turn.response === 'ATTACK').length;
    return {
      debatePerformance: this.performance,
      influence: this.won ? 10 + Math.round(this.performance / 10) : 3 + Math.round(this.performance / 20),
      momentum: this.won ? 5 + Math.round(this.performance / 10) : -5,
      burrRespect: facts >= 3 ? 10 : 0, burrRivalry: attacks >= 3 ? 10 : 0,
    };
  }
}
