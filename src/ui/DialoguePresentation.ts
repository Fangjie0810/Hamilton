import type { CharacterId } from '../data/types';
import { characters } from '../data/characters';
import { getDialoguePerformance } from '../data/dialoguePerformance';
import type { DialoguePerformance } from '../data/mainPixelArt';
import type { SpokenLine, VoicePlayback, VoicePlaybackState, VoiceoverSystem } from '../systems/VoiceoverSystem';
import { DialoguePortraits } from './DialoguePortraits';
import { voiceover } from './voiceover';

const sameLine = (a: SpokenLine, b: SpokenLine) => a.speaker === b.speaker
  && (typeof a.text === 'string' ? a.text : a.text.en) === (typeof b.text === 'string' ? b.text : b.text.en);
const character = (speaker: string): CharacterId => speaker in characters ? speaker as CharacterId : 'narrator';
const silentDuration = (line: SpokenLine) => Math.max(900, Math.min(6500, (typeof line.text === 'string' ? line.text : line.text.en).length * 38));
type PortraitPort = Pick<DialoguePortraits, 'element' | 'show' | 'setPerformance' | 'setSpeaking' | 'update' | 'reset' | 'destroy'>;
type VoicePort = Pick<VoiceoverSystem, 'enabled' | 'has' | 'play' | 'onPlaybackChange'>;
export interface DialoguePresentationPorts {
  portraits?: PortraitPort;
  voice?: VoicePort;
  performance?: (line: SpokenLine, partner?: CharacterId) => DialoguePerformance;
}

/** The same presentation lifecycle serves story lines and actual minigame speech. */
export class DialoguePresentation {
  readonly portraits: PortraitPort;
  readonly element: HTMLDivElement;
  private readonly voice: VoicePort;
  private readonly performance: (line: SpokenLine, partner?: CharacterId) => DialoguePerformance;
  private readonly unsubscribe: () => void;
  private lines: readonly SpokenLine[] = [];
  private speech?: VoicePlayback;
  private state?: VoicePlaybackState;
  private partner?: CharacterId;
  private focused?: CharacterId;
  private lineIndex = -1;
  private silentElapsed = 0;
  private silent = false;
  private finished = false;
  private sessionFinished = false;
  private sawOwnedCue = false;
  private starting = false;
  private completionReaction?: DialoguePerformance;
  private completionReactionApplied = false;
  private paused = false;
  private reducedMotion = false;

  constructor(ports: DialoguePresentationPorts = {}) {
    this.portraits = ports.portraits ?? new DialoguePortraits();
    this.element = this.portraits.element;
    this.voice = ports.voice ?? voiceover;
    this.performance = ports.performance ?? getDialoguePerformance;
    this.unsubscribe = this.voice.onPlaybackChange(state => { this.state = state; this.sync(); });
  }

  show(speaker: CharacterId, partner?: CharacterId) {
    this.stop(); this.focused = speaker; this.partner = partner;
    this.portraits.show(speaker, partner);
    this.portraits.setSpeaking(speaker, false, false);
  }

  play(lines: readonly SpokenLine[], partner?: CharacterId, completionReaction?: DialoguePerformance): VoicePlayback {
    this.stop();
    this.lines = lines; this.partner = partner; this.lineIndex = -1;
    this.silentElapsed = 0; this.finished = false; this.sessionFinished = false; this.sawOwnedCue = false;
    this.completionReaction = completionReaction;
    this.completionReactionApplied = false;
    this.silent = !this.voice.enabled || !lines.some(line => this.voice.has(line));
    const initial = this.silent ? 0 : lines.findIndex(line => this.voice.has(line));
    if (lines.length) this.focusLine(Math.max(0, initial));
    // play() publishes stop/loading synchronously. Until its ownership handle is
    // returned, those setup notifications must not settle the newly shown line.
    this.starting = true;
    try { this.speech = this.voice.play(lines); }
    finally { this.starting = false; }
    this.sync();
    return this.speech;
  }

  /** A real gameplay result can hold a closed-mouth reaction without creating speech. */
  react(speaker: CharacterId, partner: CharacterId, performance: DialoguePerformance) {
    this.stop(); this.focused = speaker; this.partner = partner;
    this.portraits.show(speaker, partner, performance);
    this.portraits.setSpeaking(speaker, false, true);
    this.portraits.update(0, this.paused || !!this.state?.paused, this.reducedMotion);
  }

  private partnerFor(speaker: CharacterId): CharacterId {
    const other = this.lines.find(line => line.speaker !== speaker);
    if (other) return character(other.speaker);
    return this.partner && this.partner !== speaker ? this.partner : speaker === 'hamilton' ? 'burr' : 'hamilton';
  }

  private focusLine(index: number) {
    const line = this.lines[index];
    if (!line || index === this.lineIndex) return;
    this.lineIndex = index; this.silentElapsed = 0;
    this.focused = character(line.speaker);
    const partner = this.partnerFor(this.focused);
    this.portraits.show(this.focused, partner, this.performance(line, partner));
  }

  private sync() {
    if (!this.lines.length || this.starting) return;
    const cue = this.state?.cue;
    const silent = !this.voice.enabled || !this.lines.some(line => this.voice.has(line));
    if (silent !== this.silent) {
      this.silent = silent; this.silentElapsed = 0; this.finished = false;
      // Enabling voices resumes the existing media position, so select its cue
      // again even if a muted fallback already reached a later response.
      if (!silent && cue && this.lines.some(line => sameLine(line, cue))) this.sessionFinished = false;
    }
    const ownedIndex = !this.sessionFinished && cue ? this.lines.findIndex(line => sameLine(line, cue)) : -1;
    if (!silent) {
      if (ownedIndex >= 0) {
        this.sawOwnedCue = true; this.finished = false;
        this.focusLine(ownedIndex);
      } else if (this.sawOwnedCue || !this.speech?.busy) {
        this.sessionFinished = true; this.finished = true;
      }
    }
    // A cue survives waiting/pause/autoplay refusal; only losing the owned cue
    // ends its performance. A later unrelated voice cannot reactivate this panel.
    const paused = this.paused || !!this.state?.paused;
    const talking = !paused && !this.finished && (silent || (ownedIndex >= 0 && !!this.state?.playing));
    if (this.finished && this.completionReaction && !this.completionReactionApplied) {
      this.portraits.setPerformance(this.completionReaction);
      this.completionReactionApplied = true;
    } else if (!this.finished && this.completionReactionApplied) {
      const line = this.lines[this.lineIndex];
      if (line && this.focused) this.portraits.setPerformance(this.performance(line, this.partnerFor(this.focused)));
      this.completionReactionApplied = false;
    }
    this.portraits.setSpeaking(this.focused, talking, this.finished);
    this.portraits.update(0, paused, this.reducedMotion);
  }

  update(delta: number, paused: boolean, reducedMotion: boolean) {
    this.paused = paused; this.reducedMotion = reducedMotion;
    this.sync();
    if (this.lines.length && this.silent && !this.finished && !paused && !this.state?.paused) {
      this.silentElapsed += Math.max(0, Math.min(100, delta));
      if (this.silentElapsed >= silentDuration(this.lines[this.lineIndex])) {
        if (this.lineIndex + 1 < this.lines.length) this.focusLine(this.lineIndex + 1);
        else this.finished = true;
      }
      this.sync();
    }
    this.portraits.update(delta, paused || !!this.state?.paused, reducedMotion);
  }

  stop(clear = false) {
    this.lines = []; this.completionReaction = undefined; this.completionReactionApplied = false; this.speech?.stop(); this.speech = undefined;
    this.finished = true; this.sessionFinished = true; this.lineIndex = -1;
    this.portraits.setSpeaking(this.focused, false, true);
    if (clear) { this.focused = undefined; this.portraits.reset(); }
  }
  destroy() { this.stop(true); this.unsubscribe(); this.portraits.destroy(); }
}
