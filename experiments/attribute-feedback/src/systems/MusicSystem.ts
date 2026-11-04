import { chapterMusic, musicTracks, type MusicTrack } from '../data/music';
import type { ChapterId } from '../data/types';
import { clampVolume, loadVolumeOnlyPreference } from './AudioVolume';

export const MUSIC_KEY = 'project-hamilton:music-enabled:v1';
export const MUSIC_VOLUME_KEY = 'project-hamilton:music-volume:v1';
export const MUSIC_FADE_MS = 550;
export type MusicMedia = Pick<HTMLAudioElement, 'src' | 'preload' | 'loop' | 'volume' | 'muted' | 'currentTime' | 'play' | 'pause' | 'load' | 'removeAttribute'>;
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
export interface MusicScheduler {
  now(): number;
  schedule(callback: () => void, delayMs: number): () => void;
}
const scheduler: MusicScheduler = {
  now: () => performance.now(),
  schedule(callback, delayMs) {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

/** One reusable media element retains browser activation; only one track can sound. */
export class MusicSystem {
  private media?: MusicMedia;
  private chapter?: ChapterId;
  /** Requested track can differ from the audible track during its fade-out. */
  private track?: MusicTrack;
  private loadedTrack?: MusicTrack;
  private session = 0;
  private loadedSession = -1;
  private positions = new Map<MusicTrack, number>();
  private pauses = new Set<string>();
  private mutes = new Set<string>();
  private attempt = 0;
  private waitingForGesture = false;
  private preference = true;
  private level: number;
  private playing = false;
  private gain = 1;
  private fade?: { started: number; from: number; cancel: () => void };
  private pendingStop?: Promise<void>;
  private resolveStop?: () => void;

  constructor(private createMedia: () => MusicMedia, private storage?: StoragePort, private clock = scheduler) {
    this.level = loadVolumeOnlyPreference(storage, MUSIC_VOLUME_KEY, MUSIC_KEY, 1);
  }
  get enabled() { return this.preference; }
  get volume() { return this.level; }
  setVolume(value: number) {
    this.level = clampVolume(value, this.level);
    try { this.storage?.setItem(MUSIC_VOLUME_KEY, String(this.level)); } catch { /* Session volume still works. */ }
    this.applyVolume();
  }
  get currentTrack() { return this.track; }
  /** Must run synchronously in the Begin click, before imports or film fades. */
  beginJourney() {
    this.stop(); this.chapter = 'Opening'; this.select('alexanderHamilton');
  }
  enterChapter(chapter: ChapterId, preserveOpening = false) {
    if (preserveOpening && chapter === 'Opening' && this.chapter === chapter) return;
    this.stop(); this.chapter = chapter;
    this.setPaused('transition', true);
  }
  revealChapter(chapter: ChapterId) {
    if (this.chapter !== chapter) return;
    this.select(chapterMusic[chapter]); this.setPaused('transition', false);
  }
  setDebate(active: boolean) {
    if (this.chapter === 'Debate') this.select(active ? 'cabinetBattle' : 'farmerRefuted');
  }
  setEnabled(enabled: boolean) {
    if (this.preference === enabled) return;
    this.preference = enabled;
    try { this.storage?.setItem(MUSIC_KEY, String(enabled)); } catch { /* Session setting still works. */ }
    this.sync();
  }
  setPaused(reason: string, paused: boolean) {
    if (this.pauses.has(reason) === paused) return;
    if (paused) this.pauses.add(reason); else this.pauses.delete(reason);
    this.sync();
  }
  setMuted(reason: string, muted: boolean) {
    if (muted) this.mutes.add(reason); else this.mutes.delete(reason);
    if (this.media) this.media.muted = this.mutes.size > 0;
  }
  unlock() {
    if (!this.waitingForGesture) return;
    this.waitingForGesture = false; this.sync();
  }
  /** Page unload may opt into immediate cleanup; normal stops always fade. */
  stop(immediate = false) {
    this.track = undefined; this.chapter = undefined; this.session++;
    this.positions.clear(); this.waitingForGesture = false; this.pauses.delete('transition');
    if (immediate) { this.cancelFade(); this.pauseMedia(); }
    this.sync();
  }
  /** Await the outgoing audio's actual stop before leaving the page. */
  stopAndWait(): Promise<void> {
    this.stop();
    if (!this.playing) return Promise.resolve();
    return this.pendingStop ??= new Promise<void>(resolve => { this.resolveStop = resolve; });
  }
  private select(track: MusicTrack) {
    if (this.track === track) return;
    this.track = track; this.waitingForGesture = false;
    this.sync();
  }
  private sync() {
    if (!this.media && this.track) {
      try { this.media = this.createMedia(); } catch { return; }
      this.media.preload = 'auto'; this.media.loop = true;
      this.media.muted = this.mutes.size > 0;
    }
    const media = this.media;
    if (!media) return;
    if (this.loadedTrack !== this.track || this.loadedSession !== this.session) {
      if (this.playing && this.gain > 0 && this.level > 0 && !media.muted) { this.fadeOut(); return; }
      this.cancelFade(); this.pauseMedia();
      if (this.loadedTrack && this.loadedSession === this.session) this.positions.set(this.loadedTrack, media.currentTime);
      this.loadedTrack = this.track; this.loadedSession = this.session;
      this.waitingForGesture = false;
      if (this.track) {
        media.src = musicTracks[this.track];
        media.currentTime = this.positions.get(this.track) ?? 0;
      } else { media.removeAttribute('src'); media.load(); }
    }
    if (!this.track) return;
    if (!this.enabled || this.pauses.size || this.waitingForGesture) {
      if (this.playing && this.gain > 0 && this.level > 0 && !media.muted) this.fadeOut();
      else { this.cancelFade(); this.pauseMedia(); }
      return;
    }
    this.cancelFade();
    if (this.playing) return;
    const attempt = ++this.attempt;
    this.playing = true;
    const failed = (error: unknown) => {
      if (this.attempt !== attempt) return;
      this.cancelFade(); this.pauseMedia();
      this.waitingForGesture = error instanceof Error && error.name === 'NotAllowedError';
      // A rejected outgoing play must not strand a replacement queued by a fade.
      if (this.loadedTrack !== this.track || this.loadedSession !== this.session) this.sync();
    };
    try { void media.play().catch(failed); } catch (error) { failed(error); }
  }
  private applyVolume() {
    if (this.media) this.media.volume = this.level * this.gain;
  }
  private pauseMedia() {
    this.attempt++; this.media?.pause(); this.playing = false;
    this.resolveStop?.(); this.resolveStop = undefined; this.pendingStop = undefined;
  }
  private cancelFade() {
    this.fade?.cancel(); this.fade = undefined;
    this.gain = 1; this.applyVolume();
  }
  private fadeOut() {
    // Adding another pause reason or changing the pending destination keeps the same tail.
    if (this.fade) return;
    const fade = { started: this.clock.now(), from: this.gain, cancel: () => {} };
    this.fade = fade;
    const tick = () => {
      if (this.fade !== fade) return;
      const elapsed = this.clock.now() - fade.started;
      this.gain = fade.from * Math.max(0, 1 - elapsed / MUSIC_FADE_MS);
      this.applyVolume();
      if (elapsed >= MUSIC_FADE_MS) {
        this.fade = undefined;
        this.pauseMedia(); this.sync();
      } else fade.cancel = this.clock.schedule(tick, Math.min(16, MUSIC_FADE_MS - elapsed));
    };
    fade.cancel = this.clock.schedule(tick, 16);
  }
}
