import type { Text } from '../i18n/text';
import { clampVolume, loadVolumeOnlyPreference } from './AudioVolume';

export const VOICEOVER_KEY = 'project-hamilton:voiceover-enabled:v1';
export const VOICEOVER_VOLUME_KEY = 'project-hamilton:voiceover-volume:v1';
export interface SpokenLine { speaker: string; text: Text }
export interface VoiceCue extends SpokenLine { id: string; src: string; generated: boolean }
export interface VoicePlaybackState {
  readonly cue?: VoiceCue;
  /** True only after the current media emits `playing`, never merely after play() is requested. */
  readonly playing: boolean;
  /** Explicit presentation pauses, such as settings or a hidden document. */
  readonly paused: boolean;
  readonly enabled: boolean;
  readonly waitingForGesture: boolean;
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export type VoiceMedia = Pick<HTMLAudioElement, 'src' | 'preload' | 'volume' | 'play' | 'pause' | 'load' | 'removeAttribute' | 'addEventListener' | 'removeEventListener'>;
export interface VoicePlayback { readonly busy: boolean; stop(): void }
type Session = { cues: VoiceCue[]; index: number; waitingForGesture: boolean };
const key = (line: SpokenLine) => `${line.speaker}\n${typeof line.text === 'string' ? line.text : line.text.en}`;
export function loadVoiceoverEnabled(storage?: Pick<Storage, 'getItem'>): boolean {
  try { return storage?.getItem(VOICEOVER_KEY) !== 'false'; } catch { return true; }
}

/** A single voice at a time; presentation owns sessions, never game state. */
export class VoiceoverSystem {
  private catalog = new Map<string, VoiceCue>();
  private session?: Session;
  private media?: VoiceMedia;
  private clearMediaListeners?: () => void;
  private watchdog?: ReturnType<typeof setTimeout>;
  private pauses = new Set<string>();
  private playbackAttempt = 0;
  private preference: boolean;
  private level: number;
  private mediaPlaying = false;
  private playbackListeners = new Set<(state: VoicePlaybackState) => void>();
  private lastPlaybackState?: VoicePlaybackState;

  constructor(cues: readonly VoiceCue[], private createMedia: () => VoiceMedia,
    private storage?: StoragePort, private stallMs = 15000) {
    for (const cue of cues) if (cue.generated && /^\/audio\/en\/[a-z0-9-]+\.mp3$/.test(cue.src)) this.catalog.set(key(cue), cue);
    this.preference = true;
    this.level = loadVolumeOnlyPreference(storage, VOICEOVER_VOLUME_KEY, VOICEOVER_KEY, 1);
  }
  get enabled() { return this.preference; }
  get volume() { return this.level; }
  setVolume(value: number) {
    this.level = clampVolume(value, this.level);
    try { this.storage?.setItem(VOICEOVER_VOLUME_KEY, String(this.level)); } catch { /* Session volume still works. */ }
    if (this.media) this.media.volume = this.level;
  }
  get busy() { return this.enabled && !!this.session && !this.session.waitingForGesture; }
  get currentCue() { return this.session?.cues[this.session.index]; }
  onPlaybackChange(listener: (state: VoicePlaybackState) => void): () => void {
    this.playbackListeners.add(listener);
    listener(this.playbackState());
    return () => { this.playbackListeners.delete(listener); };
  }
  has(line: SpokenLine) { return this.catalog.has(key(line)); }
  setEnabled(enabled: boolean) {
    this.preference = enabled;
    try { this.storage?.setItem(VOICEOVER_KEY, String(enabled)); } catch { /* Playback still works without storage. */ }
    this.syncPlayback();
  }
  setPaused(reason: string, paused: boolean) {
    const previous = this.pauses.has(reason);
    if (previous === paused) return;
    if (paused) this.pauses.add(reason); else this.pauses.delete(reason);
    this.syncPlayback();
  }
  play(lines: readonly SpokenLine[]): VoicePlayback {
    this.stop();
    const cues = lines.flatMap(line => { const cue = this.catalog.get(key(line)); return cue ? [cue] : []; });
    const session: Session = { cues, index: 0, waitingForGesture: false };
    if (cues.length) { this.session = session; this.syncPlayback(); }
    const owner = this;
    return { get busy() { return owner.session === session && owner.busy; }, stop() { if (owner.session === session) owner.stop(); } };
  }
  stop() { this.session = undefined; this.releaseMedia(); this.publishPlayback(); }
  /** Retry a browser autoplay refusal only after a real user gesture. */
  unlock() {
    if (!this.session?.waitingForGesture) return;
    this.session.waitingForGesture = false; this.syncPlayback();
  }
  private clearWatchdog() { clearTimeout(this.watchdog); this.watchdog = undefined; }
  private playbackState(): VoicePlaybackState {
    return {
      cue: this.currentCue,
      playing: this.mediaPlaying,
      paused: this.pauses.size > 0,
      enabled: this.enabled,
      waitingForGesture: this.session?.waitingForGesture ?? false,
    };
  }
  private publishPlayback() {
    const state = this.playbackState(), previous = this.lastPlaybackState;
    if (previous && previous.cue === state.cue && previous.playing === state.playing && previous.paused === state.paused
      && previous.enabled === state.enabled && previous.waitingForGesture === state.waitingForGesture) return;
    this.lastPlaybackState = state;
    for (const listener of [...this.playbackListeners]) listener(state);
  }
  private releaseMedia() {
    this.playbackAttempt++; this.clearWatchdog(); this.clearMediaListeners?.(); this.clearMediaListeners = undefined;
    this.mediaPlaying = false;
    if (this.media) { this.media.pause(); this.media.removeAttribute('src'); this.media.load(); this.media = undefined; }
  }
  private syncPlayback() {
    this.playbackAttempt++; this.clearWatchdog();
    if (!this.enabled || this.pauses.size || !this.session || this.session.waitingForGesture) {
      this.mediaPlaying = false; this.media?.pause(); this.publishPlayback(); return;
    }
    const session = this.session;
    if (!this.media) {
      try { this.media = this.createMedia(); } catch { this.stop(); return; }
      this.media.preload = 'auto'; this.media.volume = this.level; this.media.src = session.cues[session.index].src;
      const media = this.media;
      const next = () => {
        if (this.session !== session || this.media !== media) return;
        this.releaseMedia(); session.index++;
        if (session.index === session.cues.length) { this.session = undefined; this.publishPlayback(); }
        else this.syncPlayback();
      };
      const progress = () => {
        if (this.session !== session || this.media !== media || !this.enabled || this.pauses.size || session.waitingForGesture) return;
        this.clearWatchdog(); this.watchdog = setTimeout(next, this.stallMs);
      };
      const playing = () => {
        if (this.session !== session || this.media !== media || !this.enabled || this.pauses.size || session.waitingForGesture) return;
        this.mediaPlaying = true; progress(); this.publishPlayback();
      };
      const silent = () => {
        if (this.session !== session || this.media !== media) return;
        this.mediaPlaying = false; this.publishPlayback();
      };
      const events = [['ended', next], ['error', next], ['timeupdate', progress], ['playing', playing], ['waiting', silent], ['pause', silent]] as const;
      for (const [event, listener] of events) media.addEventListener(event, listener);
      this.clearMediaListeners = () => { for (const [event, listener] of events) media.removeEventListener(event, listener); };
    }
    const media = this.media, attempt = this.playbackAttempt;
    this.publishPlayback();
    if (attempt !== this.playbackAttempt || this.session !== session || this.media !== media) return;
    this.watchdog = setTimeout(() => { if (this.session === session && this.media === media) this.stop(); }, this.stallMs);
    const failed = (error: unknown) => {
      if (attempt !== this.playbackAttempt || this.session !== session || this.media !== media) return;
      this.clearWatchdog(); this.mediaPlaying = false;
      if (error instanceof Error && error.name === 'NotAllowedError') {
        session.waitingForGesture = true; media.pause(); this.publishPlayback();
      } else this.stop();
    };
    try {
      void media.play().catch(failed);
    } catch (error) { failed(error); }
  }
}
