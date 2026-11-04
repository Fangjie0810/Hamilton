import { discoveryAvailable, resolveDiscovery, type Discovery } from '../data/discoveries';
import type { ChoiceOption, DialogueLine } from '../data/types';
import type { StateEffect } from '../core/GameState';
import { StateSystem, type StateChange } from '../systems/StateSystem';
import { conversationPartner } from '../data/dialogueCast';

/** A short optional conversation owns no main-story cursor or completion count. */
export class DiscoverySession {
  phase: 'idle' | 'dialogue' | 'choice' = 'idle';
  definition?: Discovery;
  lastChanges: StateChange[] = [];
  private resolved?: ReturnType<typeof resolveDiscovery>;
  private lines: DialogueLine[] = [];
  private index = 0;
  private selected?: ChoiceOption;
  private replying = false;
  constructor(private state: StateSystem) {}
  get busy() { return this.phase !== 'idle'; }
  get line() { return this.phase === 'dialogue' ? this.lines[this.index] : undefined; }
  get dialoguePartner() { return conversationPartner(this.lines, this.index, this.definition?.character); }
  get choice() { return this.phase === 'choice' ? this.resolved?.choice : undefined; }
  begin(definition: Discovery, completed: string[], mainPhase: string, started: string[] = []) {
    if (this.busy || !['explore', 'exit'].includes(mainPhase) || !discoveryAvailable(definition, this.state.state, completed)) return false;
    this.definition = definition; this.resolved = resolveDiscovery(definition, this.state.state, completed, started);
    this.lines = this.resolved.lines; this.index = 0; this.selected = undefined; this.replying = false; this.lastChanges = [];
    this.phase = 'dialogue'; if (!this.lines.length) this.finishLines();
    return true;
  }
  next() {
    if (this.phase !== 'dialogue') return false;
    this.index++; if (this.index >= this.lines.length) this.finishLines();
    return true;
  }
  choose(index: number) {
    const option = this.choice?.options[index];
    if (!option || (option.requires && this.state.state[option.requires.stat] < option.requires.min)) return false;
    this.selected = option; this.replying = true; this.lines = option.reply; this.index = 0; this.phase = 'dialogue';
    if (!this.lines.length) this.finishLines();
    return true;
  }
  abort() { this.phase = 'idle'; this.definition = undefined; this.resolved = undefined; this.lines = []; this.lastChanges = []; }
  private finishLines() {
    if (this.resolved?.choice && !this.replying) { this.phase = 'choice'; return; }
    if (this.resolved?.active) {
      const effect: StateEffect = { ...this.resolved.effect };
      for (const [key, delta] of Object.entries(this.selected?.effect ?? {})) {
        const stat = key as keyof StateEffect; effect[stat] = (effect[stat] ?? 0) + delta!;
      }
      this.lastChanges = this.state.choose(this.resolved.choiceKey, this.selected?.id ?? 'completed', effect);
    }
    this.phase = 'idle';
  }
}
