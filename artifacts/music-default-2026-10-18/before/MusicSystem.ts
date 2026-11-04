import { chapterMusic, musicTracks, titleMusicTracks, type MusicTrack } from '../data/music';
import type { ChapterId } from '../data/types';
import { clampVolume, loadVolumeOnlyPreference } from './AudioVolume';

export const MUSIC_KEY = 'project-hamilton:music-enabled:v1';
export const MUSIC_VOLUME_KEY = 'project-hamilton:music-volume:v1';
export const MUSIC_FADE_MS = 550;
export type MusicMedia = Pick<HTMLAudioElement, 'src' | 'preload' | 'loop' | 'volume' | 'muted' | 'currentTime' | 'play' | 'pause' | 'load' | 'removeAttribute'>
  & Partial<Pick<HTMLAudioElement, 'addEventListener'>>;
export type MusicPlaybackState = 'playing' | 'paused' | 'loading' | 'blocked' | 'error' | 'muted';
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
  private titleActive = false;
  private mediaPlaying = false;
  private mediaFailed = false;
  private listeners = new Set<() => void>();

  constructor(private createMedia: () => MusicMedia, private storage?: StoragePort, private clock = scheduler) {
    this.level = loadVolumeOnlyPreference(storage, MUSIC_VOLUME_KEY, MUSIC_KEY, 1);
  }
  get enabled() { return this.preference; }
  get volume() { return this.level; }
  setVolume(value: number) {
    this.level = clampVolume(value, this.level);
    try { this.storage?.setItem(MUSIC_VOLUME_KEY, String(this.level)); } catch { /* Session volume still works. */ }
    this.applyVolume(); this.notify();
  }
  get currentTrack() { return this.track; }
  get playbackState(): MusicPlaybackState {
    if (!this.track) return 'paused';
    if (this.mediaFailed) return 'error';
    if (this.waitingForGesture) return 'blocked';
    if (!this.enabled || this.pauses.size) return 'paused';
    if (!this.level || this.mutes.size) return 'muted';
    return this.mediaPlaying && this.loadedTrack === this.track ? 'playing' : 'loading';
  }
  onChange(listener: () => void) {
    this.listeners.add(listener); listener();
    return () => { this.listeners.delete(listener); };
  }
  /** A title playlist shares the existing media element and volume preference. */
  enterTitle() {
    this.stop(true); this.titleActive = true; this.select(titleMusicTracks[0]);
  }
  playTitle(track = this.track) {
    if (!this.titleActive || !track) return;
    this.pauses.delete('title'); this.waitingForGesture = false;
    if (this.mediaFailed) this.media?.load();
    this.mediaFailed = false;
    if (this.track === track) this.sync(); else this.select(track);
  }
  nextTitle() {
    if (!this.titleActive || !this.track) return;
    this.playTitle(titleMusicTracks[(titleMusicTracks.indexOf(this.track) + 1) % titleMusicTracks.length]);
  }
  pauseTitle() { if (this.titleActive) this.setPaused('title', true); }
  /** Must run synchronously in the Begin click, before imports or film fades. */
  beginJourney() {
    this.stop(this.titleActive); this.chapter = 'Opening'; this.select('alexanderHamilton');
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
    this.notify();
  }
  unlock() {
    // Title controls explicitly start playback; an unrelated settings click does not.
    if (this.titleActive || !this.waitingForGesture) return;
    this.waitingForGesture = false; this.sync();
  }
  /** Page unload may opt into immediate cleanup; normal stops always fade. */
  stop(immediate = false) {
    this.titleActive = false; this.pauses.delete('title'); this.mediaFailed = false;
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
    this.track = track; this.waitingForGesture = false; this.mediaFailed = false;
    this.sync();
  }
  private sync() {
    this.syncMedia(); this.notify();
  }
  private notify() { this.listeners.forEach(listener => listener()); }
  private syncMedia() {
    if (!this.media && this.track) {
      try { this.media = this.createMedia(); } catch { this.mediaFailed = true; return; }
      this.media.preload = 'auto';
      this.media.muted = this.mutes.size > 0;
      this.media.addEventListener?.('playing', () => { this.mediaPlaying = true; this.notify(); });
      for (const event of ['pause', 'waiting']) this.media.addEventListener?.(event, () => { this.mediaPlaying = false; this.notify(); });
      this.media.addEventListener?.('error', () => { this.mediaFailed = true; this.mediaPlaying = false; this.playing = false; this.notify(); });
      this.media.addEventListener?.('ended', () => {
        this.mediaPlaying = false; this.playing = false;
        if (this.titleActive && this.track) {
          // An outgoing song can end during a manual switch's fade.
          if (this.loadedTrack !== this.track) this.sync();
          else this.select(titleMusicTracks[(titleMusicTracks.indexOf(this.track) + 1) % titleMusicTracks.length]);
        }
        else this.notify();
      });
    }
    const media = this.media;
    if (!media) return;
    media.loop = !this.titleActive;
    if (this.loadedTrack !== this.track || this.loadedSession !== this.session) {
      if (this.playing && this.gain > 0 && this.level > 0 && !media.muted) { this.fadeOut(); return; }
      this.cancelFade(); this.pauseMedia();
      if (!this.titleActive && this.loadedTrack && this.loadedSession === this.session) this.positions.set(this.loadedTrack, media.currentTime);
      this.loadedTrack = this.track; this.loadedSession = this.session;
      this.waitingForGesture = false;
      this.mediaFailed = false;
      if (this.track) {
        media.src = musicTracks[this.track];
        media.currentTime = this.titleActive ? 0 : this.positions.get(this.track) ?? 0;
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
      this.mediaFailed = !this.waitingForGesture;
      // A rejected outgoing play must not strand a replacement queued by a fade.
      if (this.loadedTrack !== this.track || this.loadedSession !== this.session) this.sync();
      else this.notify();
    };
    try { void media.play().then(() => {
      if (this.attempt !== attempt) return;
      this.mediaPlaying = true; this.notify();
    }, failed); } catch (error) { failed(error); }
  }
  private applyVolume() {
    if (this.media) this.media.volume = this.level * this.gain;
  }
  private pauseMedia() {
    this.attempt++; this.media?.pause(); this.playing = false; this.mediaPlaying = false;
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
