import { chapters } from '../data/chapters';
import { interactionEchoes } from '../data/discoveries';
import { TAVERN_RESPONSE_MS } from '../data/rules';
import type { Chapter, ChapterId, DialogueLine, Interaction } from '../data/types';
import { bi } from '../i18n/text';
import { DialogueCursor } from '../systems/DialogueSystem';
import { conversationPartner } from '../data/dialogueCast';
import type { DebateSystem } from '../systems/DebateSystem';
import { StateSystem, type StateChange } from '../systems/StateSystem';
import { activeDelta } from '../systems/TimingSystem';
import type { WritingSystem } from '../systems/WritingSystem';
import type { YorktownSystem } from '../systems/YorktownSystem';

export type StoryPhase = 'explore' | 'dialogue' | 'choice' | 'activity' | 'exit' | 'ending';
export type StoryActivity = NonNullable<Interaction['activity']>;
type AfterLines = 'choice' | 'activity' | 'finish';

/** Original chapter rules, independent of the renderer and all browser timers. */
export class StoryProgress {
  private currentChapter: Chapter = chapters.Opening;
  private currentPhase: StoryPhase = 'explore';
  private index = 0;
  private completed = new Set<string>();
  private cursor?: DialogueCursor<DialogueLine>;
  private dialogueLines: readonly DialogueLine[] = [];
  private afterLines: AfterLines = 'finish';
  private remaining = 0;
  private version = 0;
  private changes: StateChange[] = [];

  constructor(readonly state = new StateSystem()) {
    this.state.checkpoint(this.currentChapter.id);
  }

  /** At the ending this remains Yorktown, so the host can retain its world. */
  get chapter(): Chapter { return this.currentChapter; }
  get chapterId(): ChapterId | 'Ending' { return this.phase === 'ending' ? 'Ending' : this.chapter.id; }
  get phase(): StoryPhase { return this.currentPhase; }
  get interactionIndex(): number { return this.index; }
  get interaction(): Interaction | undefined { return this.chapter.interactions[this.index]; }
  get currentLine(): DialogueLine | undefined { return this.phase === 'dialogue' ? this.cursor?.current : undefined; }
  get dialoguePartner() { return conversationPartner(this.dialogueLines, this.cursor?.index ?? 0, this.interaction?.character); }
  get choice(): Interaction['choice'] { return this.phase === 'choice' ? this.interaction?.choice : undefined; }
  get remainingMs(): number { return this.remaining; }
  get activity(): StoryActivity | undefined { return this.phase === 'activity' ? this.interaction?.activity : undefined; }
  /** Changes only when content/progression changes, not on each timer frame. */
  get revision(): number { return this.version; }
  get lastChanges(): StateChange[] { return this.changes.map(change => ({ ...change })); }
  get completedInteractions(): string[] { return this.chapter.interactions.filter(interaction => this.isComplete(interaction.id)).map(interaction => interaction.id); }
  isComplete(id: string): boolean { return this.completed.has(id); }
  canBegin(id: string): boolean {
    return this.phase === 'explore' && !this.isComplete(id) && this.chapter.interactions.some(interaction => interaction.id === id)
      && (this.chapter.interactionOrder === 'free' || this.interaction?.id === id);
  }

  /** The host owns distance, pause and transition checks before invoking this. */
  begin(id: string): boolean {
    if (!this.canBegin(id)) return false;
    this.index = this.chapter.interactions.findIndex(interaction => interaction.id === id);
    const interaction = this.interaction!;
    this.changes = [];
    const state = this.state.state;
    const variant = interaction.variants?.find(entry => state[entry.stat] >= entry.min);
    this.playLines([...(variant?.lines ?? interaction.lines), ...interactionEchoes(interaction.id, state)], interaction.choice ? 'choice' : 'activity');
    return this.changed();
  }

  /** Finishing the last visible line requires an explicit advance. */
  next(): boolean {
    if (this.phase !== 'dialogue') return false;
    this.changes = [];
    this.cursor?.next();
    if (this.cursor?.done) this.finishLines();
    return this.changed();
  }

  choose(index: number): boolean {
    const choice = this.choice;
    if (!choice || !Number.isInteger(index)) return false;
    const option = choice.options[index];
    if (!option) return false;
    if (option.requires && this.state.state[option.requires.stat] < option.requires.min) return false;
    this.changes = this.state.choose(choice.id, option.id, option.effect);
    this.remaining = 0;
    this.playLines(option.reply, 'activity');
    return this.changed();
  }

  /** Milliseconds of active host time; suspension gaps use the original cap. */
  tick(delta: number, blocked = false): boolean {
    if (blocked || this.phase !== 'choice' || this.chapter.id !== 'Tavern') return false;
    this.remaining = Math.max(0, this.remaining - activeDelta(delta));
    return this.remaining === 0 ? this.timeout() : false;
  }

  timeout(): boolean {
    const interaction = this.interaction;
    if (this.phase !== 'choice' || this.chapter.id !== 'Tavern' || this.remaining > 0 || !interaction?.choice) return false;
    this.changes = this.state.choose(interaction.choice.id, 'timeout', {});
    this.playLines([{
      speaker: interaction.character,
      text: bi('你沉默了一会儿。没关系，先听听其他人的想法；这张桌子还会留一个位置。', "You fall silent for a moment. That's all right. Listen to the others first; there will still be a place for you at this table."),
    }], 'finish');
    return this.changed();
  }

  completeActivity(kind: 'debate', result: DebateSystem): boolean;
  completeActivity(kind: 'writing', result: WritingSystem): boolean;
  completeActivity(kind: 'yorktown', result: YorktownSystem): boolean;
  /** Call only from the activity's confirmed result callback. Scores may be zero. */
  completeActivity(kind: StoryActivity, result: DebateSystem | WritingSystem | YorktownSystem): boolean {
    if (this.phase !== 'activity' || this.activity !== kind || result.phase !== 'result') return false;
    this.changes = [];
    if (kind === 'debate') {
      if (!('history' in result)) return false;
      this.changes.push(...this.state.choose('debate_result', result.won ? 'won' : 'held', result.effects()));
      if (result.attackRecoveriesUsed) this.state.choose('assist:debate-recovery', 'used', {});
      this.state.choose('debate_approach', result.dominant ? `debate-${result.dominant.toLowerCase()}` : 'debate-silent', {});
    } else if (kind === 'writing') {
      if (!('scores' in result)) return false;
      this.changes.push(...this.state.choose('dispatch_method', result.performance >= 80 ? 'dispatch-precise' : 'dispatch-hurried', result.effects()));
      this.state.choose('writing_result', String(result.performance), {});
      if (result.referencesUsed) this.state.choose('assist:writing-reference', 'used', {});
    } else {
      if (!('grades' in result)) return false;
      this.changes.push(...this.state.choose('yorktown_result', 'complete', result.effects()));
      if (result.deploymentChecksUsed) this.state.choose('assist:yorktown-check', 'used', {});
    }
    this.finishInteraction();
    return this.changed();
  }

  /** Completing a chapter unlocks its exit; only using that exit advances it. */
  nextChapter(): boolean {
    if (this.phase !== 'exit') return false;
    this.changes = [];
    const next = this.chapter.next;
    if (next === 'Ending') this.currentPhase = 'ending';
    else {
      this.currentChapter = chapters[next];
      this.resetChapter();
      this.state.checkpoint(next);
    }
    return this.changed();
  }

  /** Do not replace the entry checkpoint: repeated restarts restore the same run. */
  restart(): boolean {
    if (this.phase === 'ending') return false;
    this.state.restart(this.chapter.id);
    this.resetChapter();
    return this.changed();
  }

  reset(): void {
    this.state.reset();
    this.currentChapter = chapters.Opening;
    this.resetChapter();
    this.state.checkpoint(this.chapter.id);
    this.changed();
  }

  private changed(): true { this.version += 1; return true; }
  private resetChapter(): void {
    this.index = 0;
    this.completed.clear();
    this.currentPhase = 'explore';
    this.cursor = undefined;
    this.afterLines = 'finish';
    this.remaining = 0;
    this.changes = [];
  }

  private playLines(lines: DialogueLine[], after: AfterLines): void {
    this.dialogueLines = lines;
    this.cursor = new DialogueCursor(lines);
    this.afterLines = after;
    this.currentPhase = 'dialogue';
    if (this.cursor.done) this.finishLines();
  }

  private finishLines(): void {
    this.cursor = undefined;
    if (this.afterLines === 'choice') {
      this.currentPhase = 'choice';
      this.remaining = this.chapter.id === 'Tavern' ? TAVERN_RESPONSE_MS : 0;
    } else if (this.afterLines === 'activity' && this.interaction?.activity) {
      this.currentPhase = 'activity';
      this.remaining = 0;
    } else this.finishInteraction();
  }

  private finishInteraction(): void {
    const interaction = this.interaction;
    if (interaction?.effect) this.changes.push(...this.state.choose(`interaction:${interaction.id}`, 'complete', interaction.effect));
    if (interaction) this.completed.add(interaction.id);
    const nextIndex = this.chapter.interactions.findIndex(item => !this.isComplete(item.id));
    this.index = nextIndex < 0 ? this.chapter.interactions.length : nextIndex;
    this.cursor = undefined;
    this.remaining = 0;
    this.currentPhase = this.interaction ? 'explore' : 'exit';
  }
}
