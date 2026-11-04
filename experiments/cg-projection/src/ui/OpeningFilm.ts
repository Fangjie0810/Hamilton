import { bi, setLabel, setText, type Text } from '../i18n/text';
import { CURTAIN_FADE_MS, CURTAIN_HOLD_MS, REDUCED_CURTAIN_MS } from './transitions';
import './opening-film.css';
import { createProjectionScene } from './ProjectionScene';

// The user's edit fades to black at 49.43 s; its soundtrack continues to 57.2 s.
// Reveal the chapter during that existing black tail, retaining the entire audio.
const TITLE_CUE_SECONDS = 49.5;
const VIDEO_SOURCE = '/video/opening-2026-09-11.mp4';
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
function latch() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: Text = '') {
  const node = document.createElement(tag); node.className = className; setText(node, text); return node;
}

/** Owns only the film. The existing chapter lifecycle owns the world and its reveal. */
export class OpeningFilm {
  private root = el('section', 'opening-film');
  private picture = el('div', 'opening-film-picture');
  private video = el('video', 'opening-film-video');
  private status = el('p', 'opening-film-status');
  private controls = el('div', 'opening-film-controls');
  private pause = el('button', 'opening-film-pause');
  private mute = el('button', 'opening-film-mute');
  private skip = el('button', 'opening-film-skip', bi('跳过 CG', 'Skip film'));
  private reveal = latch();
  private ended = latch();
  private listener = new AbortController();
  private duration: number;
  private finishing = false;
  private disposed = false;
  private prepared = false;
  private revealing = false;
  private waitTimer = 0;
  private stalledTimer = 0;
  private frame = 0;
  private tailFading = false;
  private app = document.querySelector<HTMLElement>('#app')!;

  constructor(private reduced: boolean) {
    this.duration = reduced ? REDUCED_CURTAIN_MS : CURTAIN_FADE_MS;
    this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true');
    setLabel(this.root, 'aria-label', bi('启程影片', 'Opening film'));
    this.status.setAttribute('role', 'status'); this.status.hidden = true;
    this.video.src = VIDEO_SOURCE; this.video.preload = 'auto'; this.video.playsInline = true;
    this.video.disablePictureInPicture = true; this.video.tabIndex = -1;
    this.video.style.transitionDuration = `${this.duration}ms`;
    setLabel(this.video, 'aria-label', bi('汉密尔顿的海岛往事与启程', 'Hamilton’s island past and departure'));
    for (const node of [this.pause, this.mute, this.skip]) node.type = 'button';
    this.controls.append(this.pause, this.mute, this.skip);
    const signal = this.listener.signal;
    createProjectionScene(this.root, this.picture, this.video, reduced, signal);
    this.root.append(this.picture, this.status, this.controls);
    this.pause.addEventListener('click', () => this.togglePause(), { signal });
    this.mute.addEventListener('click', () => { this.video.muted = !this.video.muted; this.labels(); }, { signal });
    this.skip.addEventListener('click', () => { void this.finish(); }, { signal });
    this.video.addEventListener('playing', () => {
      this.clearWaiting(); this.status.hidden = true; this.video.classList.add('is-playing'); this.labels();
    }, { signal });
    this.video.addEventListener('pause', () => this.labels(), { signal });
    this.video.addEventListener('timeupdate', () => {
      if (this.video.currentTime >= TITLE_CUE_SECONDS) this.requestReveal();
      if (!this.tailFading && !this.finishing && this.video.duration - this.video.currentTime <= 1) {
        this.tailFading = true; this.fadeTail();
      }
    }, { signal });
    this.video.addEventListener('ended', () => {
      this.ended.resolve(); this.requestReveal(); this.labels();
    }, { signal });
    this.video.addEventListener('error', () => {
      this.clearWaiting();
      this.notice(bi('影片暂时无法播放，可以重试或跳过继续旅程。', 'The film could not play. Retry or skip to continue your journey.'));
      this.labels();
    }, { signal });
    this.video.addEventListener('waiting', () => this.waiting(), { signal });
    this.video.addEventListener('stalled', () => this.waiting(), { signal });
    const pauseOnLeave = () => {
      if (!this.disposed && !this.finishing && !this.video.ended) {
        this.video.pause(); this.clearWaiting();
        this.notice(bi('影片已暂停，准备好后继续。', 'Film paused. Continue when you are ready.'));
      }
    };
    window.addEventListener('blur', pauseOnLeave, { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnLeave(); }, { signal });
    window.addEventListener('keydown', event => {
      // Never pass film controls or held movement keys into the warming game.
      event.stopImmediatePropagation();
      if (event.code === 'Tab') {
        event.preventDefault();
        const buttons = [...this.root.querySelectorAll<HTMLButtonElement>('button')].filter(node => !node.disabled && node.getClientRects().length > 0 && !node.closest('[inert]'));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
      } else if (event.code === 'Escape' || (event.code === 'Space' && !(event.target instanceof HTMLButtonElement))) {
        event.preventDefault(); if (!event.repeat) this.togglePause();
      }
    }, { capture: true, signal });
    this.labels();
  }

  /** Called directly from the entry click, preserving browser audio activation. */
  async coverEntry() {
    document.body.append(this.root); this.app.inert = true; this.pause.focus({ preventScroll: true });
    void this.play();
    await this.root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: this.duration, fill: 'forwards' }).finished;
  }

  /** Called once the opening world has actually rendered behind its chapter curtain. */
  async presentChapter() {
    this.prepared = true;
    await this.reveal.promise;
    if (this.disposed) return;
    this.revealing = true; this.root.dataset.phase = 'chapter';
    this.picture.inert = true; this.pause.focus({ preventScroll: true });
    if (!this.video.paused || this.video.ended || this.finishing) this.status.hidden = true;
    await this.picture.animate([{ opacity: 1 }, { opacity: 0 }], { duration: this.duration, fill: 'forwards' }).finished;
    await Promise.all([this.ended.promise, delay(this.reduced ? REDUCED_CURTAIN_MS : CURTAIN_HOLD_MS)]);
    this.destroy();
  }

  /** Surface the game's existing retry screen if engine/assets fail during the film. */
  cancel() { this.reveal.resolve(); this.ended.resolve(); this.destroy(); }

  private labels() {
    setText(this.pause, this.video.error ? bi('重试播放', 'Retry film') : this.video.paused ? bi('继续播放', 'Resume film') : bi('暂停', 'Pause'));
    setText(this.mute, this.video.muted ? bi('开启声音', 'Sound on') : bi('静音', 'Mute'));
    this.mute.setAttribute('aria-pressed', String(this.video.muted));
    this.pause.disabled = this.finishing || this.video.ended;
  }
  private notice(text: Text) { setText(this.status, text); this.status.hidden = false; }
  private async play() {
    if (this.disposed || this.finishing || this.video.ended) return;
    if (this.video.error) this.video.load();
    this.waiting();
    try { await this.video.play(); }
    catch {
      if (this.disposed || this.finishing) return;
      this.clearWaiting(); this.labels();
      this.notice(bi('点击继续播放，或跳过影片开始旅程。', 'Press Resume film, or skip to begin your journey.'));
    }
  }
  private togglePause() {
    if (this.finishing || this.disposed || this.video.ended) return;
    if (this.video.paused) void this.play();
    else { this.video.pause(); this.clearWaiting(); this.notice(bi('影片已暂停', 'Film paused')); }
  }
  private waiting() {
    if (this.disposed || this.finishing || this.waitTimer || this.stalledTimer) return;
    this.waitTimer = window.setTimeout(() => {
      this.notice(bi('影片正在缓冲…', 'Buffering film…'));
    }, 1800);
    this.stalledTimer = window.setTimeout(() => {
      this.notice(bi('影片加载较慢，你可以等待或跳过继续旅程。', 'The film is loading slowly. You can wait or skip to continue.'));
    }, 12000);
  }
  private clearWaiting() {
    clearTimeout(this.waitTimer); clearTimeout(this.stalledTimer); this.waitTimer = this.stalledTimer = 0;
  }
  private requestReveal() {
    this.reveal.resolve();
    if (!this.prepared) this.notice(bi('即将抵达…', 'Arriving soon…'));
  }
  private fadeTail() {
    if (this.disposed || this.finishing) return;
    // Follow media time so pausing at the end also pauses the sound envelope.
    this.video.volume = Math.min(1, Math.max(0, (this.video.duration - this.video.currentTime) / .55));
    if (!this.video.ended) this.frame = requestAnimationFrame(() => this.fadeTail());
  }
  private async finish() {
    if (this.finishing || this.disposed) return;
    this.finishing = true; this.clearWaiting(); this.labels(); this.skip.disabled = true;
    cancelAnimationFrame(this.frame);
    // A skip fades the current sound instead of cutting a rain/wave transient abruptly.
    const start = performance.now(), volume = this.video.volume;
    const fade = (now: number) => {
      this.video.volume = volume * Math.max(0, 1 - (now - start) / this.duration);
      if (!this.disposed && now - start < this.duration) this.frame = requestAnimationFrame(fade);
    };
    this.frame = requestAnimationFrame(fade);
    if (!this.revealing) await this.video.animate([{ opacity: 1 }, { opacity: 0 }], { duration: this.duration, fill: 'forwards' }).finished;
    else await delay(this.duration);
    if (this.disposed) return;
    this.video.pause(); this.ended.resolve(); this.requestReveal();
  }
  private destroy() {
    if (this.disposed) return;
    this.disposed = true; this.listener.abort(); this.clearWaiting(); cancelAnimationFrame(this.frame);
    this.video.pause(); this.video.removeAttribute('src'); this.video.load();
    this.root.remove(); this.app.inert = false;
  }
}
