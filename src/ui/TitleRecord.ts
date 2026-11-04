import { musicTrackNames, titleMusicTracks, type MusicTrack } from '../data/music';
import { bi, f, setLabel, setText, type Text } from '../i18n/text';
import { music } from './music';
import './title-record.css';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: Text = '') {
  const node = document.createElement(tag); node.className = className; setText(node, text); return node;
}

/** Title-only controls; the shared music system owns all playback and volume. */
export class TitleRecord {
  readonly root = el('aside', 'title-record');
  private trigger = el('button', 'title-record-next');
  private toggle = el('button', 'title-record-toggle');
  private title = el('span', 'title-record-title');
  private hint = el('span', 'title-record-hint');
  private status = el('span', 'title-record-status');
  private listener = new AbortController();
  private unsubscribe: () => void;
  private previousTrack?: MusicTrack;
  private previousState = '';

  constructor() {
    setLabel(this.root, 'aria-label', bi('背景音乐', 'Background music'));
    const vinyl = el('span', 'title-record-vinyl'); vinyl.setAttribute('aria-hidden', 'true');
    vinyl.append(el('span', 'title-record-label', 'H'), el('span', 'title-record-spindle'));
    const sleeve = el('span', 'title-record-sleeve'); sleeve.append(vinyl);
    const caption = el('span', 'title-record-caption');
    this.title.lang = 'en';
    caption.append(this.title, this.hint);
    this.trigger.type = this.toggle.type = 'button';
    this.trigger.append(sleeve, caption);
    this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
    const controls = el('div', 'title-record-controls'); controls.append(this.toggle, this.status);

    this.root.append(this.trigger, controls);
    const signal = this.listener.signal;
    this.trigger.addEventListener('click', () => music.nextTitle(), { signal });
    this.toggle.addEventListener('click', () => {
      if (music.playbackState === 'playing' || music.playbackState === 'loading' || music.playbackState === 'muted') music.pauseTitle();
      else music.playTitle();
    }, { signal });
    this.unsubscribe = music.onChange(() => this.update());
  }

  destroy() { this.listener.abort(); this.unsubscribe(); this.root.inert = true; }

  private update() {
    const track = music.currentTrack ?? titleMusicTracks[0], state = music.playbackState;
    if (track === this.previousTrack && state === this.previousState) return;
    this.previousTrack = track; this.previousState = state;
    this.root.dataset.state = state; this.root.dataset.track = track;
    setText(this.title, musicTrackNames[track].en);
    setLabel(this.trigger, 'aria-label', f(bi('{0} · 下一首', '{0} · Next track'), musicTrackNames[track]));
    setText(this.hint, bi('点击切换下一首', 'Click for next track'));
    const active = state === 'playing' || state === 'loading' || state === 'muted';
    this.toggle.dataset.action = active ? 'pause' : 'play';
    setLabel(this.toggle, 'aria-label', active ? bi('暂停音乐', 'Pause music') : bi('播放音乐', 'Play music'));
    setLabel(this.toggle, 'title', active ? bi('暂停音乐', 'Pause music') : bi('播放音乐', 'Play music'));
    setText(this.status, state === 'playing' ? bi('播放中', 'Playing') : state === 'blocked' ? bi('点击播放', 'Click to play')
      : state === 'loading' ? bi('加载中', 'Loading') : state === 'error' ? bi('暂时无法播放', 'Unable to play')
      : state === 'muted' ? bi('已静音 · 可在设置调整', 'Muted · Adjust in Settings') : bi('已暂停', 'Paused'));
  }
}
