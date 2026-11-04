import { DialoguePresentation } from './DialoguePresentation';
import type { CharacterId } from '../data/types';
import type { VoicePlayback, SpokenLine } from '../systems/VoiceoverSystem';
import { getActivityReaction, type ActivityReactionOutcome } from '../data/dialoguePerformance';
import { setText, setLabel, getLanguage, setLanguage, onLanguageChange, primaryText, accessibleText } from '../i18n/text';
import { bi, f, cat, type Text, type BiText } from '../i18n/text';
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text: Text = '') {
  const node = document.createElement(tag); node.className = className; setText(node, text); return node;
}
export function action(text: Text, callback: () => void, className = 'secondary') {
  const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', callback); return node;
}
export interface Activity {
  update(delta: number): void;
  updatePresentation?(delta: number, paused: boolean, reducedMotion: boolean): void;
  key(key: string, down: boolean): void;
  release(): void;
  destroy(): void;
}

/** One scene-owned overlay; no independent timers survive pause or shutdown. */
export abstract class ActivityPanel implements Activity {
  protected root = el('section', 'activity-overlay');
  protected panel = el('div', 'activity-panel');
  protected stage = el('div', 'activity-stage');
  private dialoguePresentation = new DialoguePresentation();
  protected body = el('div', 'activity-body');
  protected live = el('p', 'activity-live');
  private previousFocus = document.activeElement;
  private screen = document.querySelector<HTMLElement>('.screen');
  private done = false;
  private static cueEnabled = true;
  private audio?: AudioContext;
  private lastCue = '';
  private speech?: VoicePlayback;
  protected get reading() { return !!this.speech?.busy; }
  protected presentSpeaker(speaker: CharacterId, partner: CharacterId) {
    this.stage.classList.add('has-portraits'); this.dialoguePresentation.show(speaker, partner);
  }
  private reactionContext() {
    const activity = this.root.dataset.activity === 'writing' ? 'writing' : this.root.dataset.activity === 'yorktown' ? 'yorktown' : 'debate';
    const partner: CharacterId = activity === 'writing' ? 'washington' : activity === 'yorktown' ? 'lafayette' : 'loyalist';
    return { activity, partner } as const;
  }
  protected react(outcome: ActivityReactionOutcome) {
    const { activity, partner } = this.reactionContext();
    this.stage.classList.add('has-portraits'); this.speech = undefined;
    this.dialoguePresentation.react('hamilton', partner, getActivityReaction(activity, outcome));
    this.root.dataset.reaction = outcome;
  }
  protected speak(lines: SpokenLine[], outcome?: ActivityReactionOutcome) {
    const spoken = lines.filter(line => line.speaker !== 'narrator');
    if (!spoken.length) return;
    const { activity, partner } = this.reactionContext();
    this.stage.classList.add('has-portraits');
    this.speech = this.dialoguePresentation.play(spoken, partner, outcome ? getActivityReaction(activity, outcome) : undefined);
    if (outcome) this.root.dataset.reaction = outcome;
    else delete this.root.dataset.reaction;
  }
  protected stopSpeech() { this.dialoguePresentation.stop(); this.speech = undefined; }
  updatePresentation(delta: number, paused: boolean, reducedMotion: boolean) { this.dialoguePresentation.update(delta, paused, reducedMotion); }
  protected speechStatus() { this.root.dataset.voiceReading = String(this.reading); }
  constructor(title: Text, protected blocked: () => boolean, headerControls = true) {
    this.root.tabIndex = -1;
    this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true'); setLabel(this.root, 'aria-label', title);
    const header = el('header', 'activity-header');
    const sound = action('', () => { ActivityPanel.cueEnabled = !ActivityPanel.cueEnabled; setText(sound, f(bi("提示音：{0}", "Audio cues: {0}"), ActivityPanel.cueEnabled ? bi("开", "On") : bi("关", "Off"))); sound.setAttribute('aria-pressed', String(ActivityPanel.cueEnabled)); }, 'text-button cue-toggle');
    setText(sound, f(bi("提示音：{0}", "Audio cues: {0}"), ActivityPanel.cueEnabled ? bi("开", "On") : bi("关", "Off"))); sound.setAttribute('aria-pressed', String(ActivityPanel.cueEnabled));
    header.append(el('span', 'eyebrow gold', title));
    if (headerControls) header.append(sound, action(bi("暂停 · ESC", "Pause · ESC"), () => window.dispatchEvent(new CustomEvent('game-pause')), 'text-button'));
    this.live.setAttribute('aria-live', 'polite');
    this.panel.append(header, this.body, this.live);
    this.stage.append(this.dialoguePresentation.element, this.panel); this.root.append(this.stage);
    this.screen?.setAttribute('inert', '');
    // Prevent pointer callbacks while paused, and contain keyboard focus behind the pause dialog.
    this.root.addEventListener('click', event => { if (this.blocked()) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
    const unlockAudio = () => {
      if (this.blocked() || !ActivityPanel.cueEnabled) return;
      try { this.audio ??= new AudioContext(); if (this.audio.state === 'suspended') void this.audio.resume().catch(() => {}); } catch { /* Visual rhythm remains fully playable without audio. */ }
    };
    this.root.addEventListener('pointerdown', unlockAudio);
    this.root.addEventListener('keydown', unlockAudio);
    this.root.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const nodes = [...this.root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === this.root)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === this.root)) { event.preventDefault(); first?.focus(); }
    });
    document.querySelector('#interface')!.append(this.root);
    this.root.focus({ preventScroll: true });
  }
  protected render(...nodes: Node[]) { this.stopSpeech(); this.dialoguePresentation.element.hidden = true; this.stage.classList.remove('has-portraits'); delete this.root.dataset.reaction; this.body.replaceChildren(...nodes); this.root.focus({ preventScroll: true }); }
  protected finish(callback: () => void) { if (this.done || this.blocked()) return; this.done = true; this.destroy(); callback(); }
  destroy() { this.stopSpeech(); this.dialoguePresentation.destroy(); this.root.remove(); if (this.audio && this.audio.state !== 'closed') void this.audio.close().catch(() => {}); this.screen?.removeAttribute('inert'); if (this.previousFocus instanceof HTMLElement && this.previousFocus.isConnected) this.previousFocus.focus({ preventScroll: true }); }
  protected cue(turn: string, elapsed: number) {
    const beat = Math.floor(elapsed / 400), token = `${turn}:${beat}`;
    if (token === this.lastCue) return; this.lastCue = token;
    if (!ActivityPanel.cueEnabled || this.blocked() || this.audio?.state !== 'running') return;
    const oscillator = this.audio.createOscillator(), gain = this.audio.createGain();
    oscillator.frequency.value = beat === 3 ? 880 : 440;
    gain.gain.setValueAtTime(0.035, this.audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + 0.055);
    oscillator.connect(gain); gain.connect(this.audio.destination); oscillator.start(); oscillator.stop(this.audio.currentTime + 0.06);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  release() {}
  abstract update(delta: number): void;
  abstract key(key: string, down: boolean): void;
}

export function beatTrack() {
  const track = el('div', 'beat-track');
  setLabel(track, 'aria-label', bi("节拍轨道；金色区域为命中窗口", "Rhythm track; the gold area is the hit window"));
  track.append(el('span', 'beat-good'), el('span', 'beat-perfect'), el('span', 'beat-target'), el('span', 'beat-cursor'));
  return track;
}
export function updateBeat(root: HTMLElement, elapsed: number) {
  const cursor = root.querySelector<HTMLElement>('.beat-cursor');
  if (cursor) cursor.style.left = `${Math.min(100, elapsed / 1600 * 100)}%`;
  root.dataset.elapsed = String(Math.round(elapsed));
}
