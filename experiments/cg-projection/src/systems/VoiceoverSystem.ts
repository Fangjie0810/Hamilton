import type { Text } from '../i18n/text';

export const VOICEOVER_KEY = 'project-hamilton:voiceover-enabled:v1';
export interface SpokenLine { speaker: string; text: Text }
export interface VoiceCue extends SpokenLine { id: string; src: string; generated: boolean }
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export type VoiceMedia = Pick<HTMLAudioElement, 'src' | 'preload' | 'play' | 'pause' | 'load' | 'removeAttribute' | 'addEventListener' | 'removeEventListener'>;
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

  constructor(cues: readonly VoiceCue[], private createMedia: () => VoiceMedia,
    private storage?: StoragePort, private stallMs = 15000) {
    for (const cue of cues) if (cue.generated && /^\/audio\/en\/[a-z0-9-]+\.mp3$/.test(cue.src)) this.catalog.set(key(cue), cue);
    this.preference = loadVoiceoverEnabled(storage);
  }
  get enabled() { return this.preference; }
  get busy() { return this.enabled && !!this.session && !this.session.waitingForGesture; }
  get currentCue() { return this.session?.cues[this.session.index]; }
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
  stop() { this.session = undefined; this.releaseMedia(); }
  /** Retry a browser autoplay refusal only after a real user gesture. */
  unlock() {
    if (!this.session?.waitingForGesture) return;
    this.session.waitingForGesture = false; this.syncPlayback();
  }
  private clearWatchdog() { clearTimeout(this.watchdog); this.watchdog = undefined; }
  private releaseMedia() {
    this.playbackAttempt++; this.clearWatchdog(); this.clearMediaListeners?.(); this.clearMediaListeners = undefined;
    if (this.media) { this.media.pause(); this.media.removeAttribute('src'); this.media.load(); this.media = undefined; }
  }
  private syncPlayback() {
    this.playbackAttempt++; this.clearWatchdog();
    if (!this.enabled || this.pauses.size || !this.session || this.session.waitingForGesture) { this.media?.pause(); return; }
    const session = this.session;
    if (!this.media) {
      try { this.media = this.createMedia(); } catch { this.stop(); return; }
      this.media.preload = 'auto'; this.media.src = session.cues[session.index].src;
      const media = this.media;
      const next = () => {
        if (this.session !== session || this.media !== media) return;
        this.releaseMedia(); session.index++;
        if (session.index === session.cues.length) this.session = undefined;
        else this.syncPlayback();
      };
      const progress = () => {
        if (this.session !== session || this.media !== media || !this.enabled || this.pauses.size) return;
        this.clearWatchdog(); this.watchdog = setTimeout(next, this.stallMs);
      };
      media.addEventListener('ended', next); media.addEventListener('error', next); media.addEventListener('timeupdate', progress);
      this.clearMediaListeners = () => { media.removeEventListener('ended', next); media.removeEventListener('error', next); media.removeEventListener('timeupdate', progress); };
    }
    const media = this.media, attempt = this.playbackAttempt;
    this.watchdog = setTimeout(() => { if (this.session === session && this.media === media) this.stop(); }, this.stallMs);
    try {
      void media.play().catch((error: unknown) => {
        if (attempt !== this.playbackAttempt || this.session !== session || this.media !== media) return;
        this.clearWatchdog(); media.pause();
        if (error instanceof Error && error.name === 'NotAllowedError') session.waitingForGesture = true;
        else this.stop();
      });
    } catch { this.stop(); }
  }
}
