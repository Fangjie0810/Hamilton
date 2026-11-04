import { bi, f, cat, type Text, type BiText } from '../i18n/text';
import { approachWidth, guards, covers, orders, squads, assaultCommands, type Order } from '../data/yorktown';
import { activeDelta, BEAT_TARGET_MS, GOOD_MS, judgeBeat, gradeValue, clamp, type BeatGrade } from './TimingSystem';
import type { StateEffect } from '../core/GameState';
import { noYorktownBenefits, type YorktownBenefits } from '../data/growth';

export class YorktownSystem {
  phase: 'briefing' | 'approach' | 'command' | 'assault-ready' | 'assault' | 'feedback' | 'result' = 'briefing';
  x = 50;
  squadX = 25;
  following = true;
  crouched = false;
  direction = 0;
  elapsed = 0;
  surprise = 100;
  detected = new Set<number>();
  lastDetection: Text = '';
  deployment: (Order | null)[] = [null, null, null];
  tactics = 0;
  morale = 100;
  commandIndex = 0;
  grades: BeatGrade[] = [];
  grade: BeatGrade = 'MISS';
  readonly deploymentChecksGranted: number;
  deploymentChecksUsed = 0;
  deploymentHint: { squadIndex: number; order: Order } | null = null;
  constructor(benefits: YorktownBenefits = noYorktownBenefits) { this.deploymentChecksGranted = benefits.deploymentChecks > 0 ? 1 : 0; }
  get deploymentChecksRemaining() { return this.deploymentChecksGranted - this.deploymentChecksUsed; }
  checkDeployment(index: number | null): Order | null {
    if (this.phase !== 'command' || !this.deploymentChecksRemaining || index === null || !Number.isInteger(index) || index < 0 || index >= squads.length) return null;
    this.deploymentChecksUsed++;
    this.deploymentHint = { squadIndex: index, order: squads[index].best };
    return this.deploymentHint.order;
  }
  get command() { return assaultCommands[this.commandIndex]; }
  get performance() { return Math.round(this.surprise * 0.2 + this.tactics * 0.3 + this.grades.reduce((sum, grade) => sum + gradeValue(grade), 0) / assaultCommands.length * 50); }
  get alert() { return 100 - this.surprise; }
  get position() { return this.tactics >= 90 ? bi("守军被正面牵制，左侧退路受压", "The defenders are pinned at the front, with pressure on their left retreat") : this.tactics >= 30 ? bi("部分阵地受压，侧翼仍有空隙", "Some positions are under pressure, but gaps remain on the flanks") : bi("守军仍能集中兵力守住正面", "The defenders can still concentrate their forces at the front"); }
  begin() { if (this.phase === 'briefing') { this.phase = 'approach'; this.elapsed = 0; } }
  release() { this.direction = 0; this.crouched = false; }
  toggleSquad() { if (this.phase === 'approach') this.following = !this.following; }
  guardFacing(index: number) { return (this.elapsed + index * 950) % 4800 < 2400 ? -1 : 1; }
  isCovered(x: number) { return this.crouched && covers.some(cover => Math.abs(x - cover) <= 55); }
  tick(delta: number) {
    if (!['approach', 'assault', 'feedback'].includes(this.phase)) return;
    const dt = activeDelta(delta); this.elapsed += dt;
    if (this.phase === 'approach') {
      this.x = clamp(this.x + this.direction * (this.crouched ? 66 : 132) * dt / 1000, approachWidth - 10);
      if (this.following) {
        const distance = this.x - 28 - this.squadX;
        this.squadX = clamp(this.squadX + Math.sign(distance) * Math.min(Math.abs(distance), 132 * dt / 1000), approachWidth - 10);
      }
      guards.forEach((guard, i) => {
        const visible = [this.x, this.squadX].some(x => {
          const distance = (x - guard) * this.guardFacing(i);
          return distance >= 45 && distance <= 165 && !this.isCovered(x);
        });
        if (visible && !this.detected.has(i)) {
          this.detected.add(i); this.surprise = clamp(this.surprise - 20);
          this.lastDetection = f(bi("第 {0} 处哨岗发现动静 · 突袭优势 −20，继续推进", "Post {0} spotted movement · Surprise −20; keep going"), i + 1);
        }
      });
      if (this.x >= approachWidth - 30 && this.squadX >= approachWidth - 60) { this.phase = 'command'; this.release(); this.elapsed = 0; }
    } else if (this.phase === 'assault' && this.elapsed > BEAT_TARGET_MS + GOOD_MS) this.resolve('MISS');
    else if (this.phase === 'feedback' && this.elapsed >= 850) {
      if (this.commandIndex === assaultCommands.length - 1) this.phase = 'result';
      else { this.commandIndex++; this.phase = 'assault'; this.elapsed = 0; }
    }
  }
  order(index: number, order: Order) { if (this.phase === 'command' && index >= 0 && index < 3 && orders.includes(order)) this.deployment[index] = order; }
  deploy() {
    if (this.phase !== 'command' || this.deployment.some(order => order === null)) return;
    this.tactics = Math.round(this.deployment.filter((order, i) => order === squads[i].best).length / 3 * 100);
    this.morale = Math.round(clamp(100 - this.tactics * 0.55 - this.surprise * 0.15));
    this.phase = 'assault-ready';
  }
  assault() { if (this.phase === 'assault-ready') { this.phase = 'assault'; this.elapsed = 0; } }
  hit(key: string) {
    if (this.phase !== 'assault' || ![' ', 'a', 'd', 's'].includes(key)) return;
    this.resolve(key === this.command.key ? judgeBeat(this.elapsed) : 'MISS');
  }
  private resolve(grade: BeatGrade) {
    this.grade = grade; this.grades.push(grade);
    this.morale = clamp(this.morale - gradeValue(grade) * 5);
    this.phase = 'feedback'; this.elapsed = 0;
  }
  effects(): StateEffect {
    return this.phase === 'result' ? { yorktownPerformance: this.performance, influence: 5 + Math.round(this.performance / 10), washingtonTrust: this.performance >= 70 ? 8 : this.performance >= 40 ? 3 : -3, momentum: Math.round((this.performance - 40) / 10) } : {};
  }
}
