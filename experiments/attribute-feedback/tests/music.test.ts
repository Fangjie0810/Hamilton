import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MusicSystem, MUSIC_KEY, MUSIC_VOLUME_KEY, MUSIC_FADE_MS, type MusicScheduler } from '../src/systems/MusicSystem';
import { musicTracks, chapterMusic } from '../src/data/music';

class Media {
  src = ''; preload = 'auto' as const; loop = false; volume = 1; muted = false;
  currentTime = 0; paused = true; calls = 0;
  result: () => Promise<void> = () => Promise.resolve();
  play() { this.calls++; this.paused = false; return this.result(); }
  pause() { this.paused = true; }
  load() { this.currentTime = 0; }
  removeAttribute() { this.src = ''; }
}
class Clock implements MusicScheduler {
  time = 0;
  tasks = new Set<{ at: number; callback: () => void }>();
  now() { return this.time; }
  schedule(callback: () => void, delayMs: number) {
    const task = { at: this.time + delayMs, callback }; this.tasks.add(task);
    return () => { this.tasks.delete(task); };
  }
  advance(ms: number) {
    const until = this.time + ms;
    for (;;) {
      const task = [...this.tasks].sort((a, b) => a.at - b.at)[0];
      if (!task || task.at > until) break;
      this.time = task.at; this.tasks.delete(task); task.callback();
    }
    this.time = until;
  }
}
function setup(saved: [string, string][] = []) {
  const media = new Media(), values = new Map<string, string>(saved), clock = new Clock(); let created = 0;
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const music = new MusicSystem(() => { created++; return media; }, storage, clock);
  return { music, media, values, storage, clock, created: () => created };
}
test('Begin starts immediately and the film/chapter handoff preserves the prologue', () => {
  const { music, media, created } = setup(); music.beginJourney();
  assert.equal(media.paused, false); assert.equal(media.loop, true);
  media.currentTime = 51;
  music.enterChapter('Opening', true); music.revealChapter('Opening');
  assert.equal(media.currentTime, 51); assert.equal(media.calls, 1); assert.equal(created(), 1);
});
test('each new scene fades out then stays silent until revealed; restart begins from zero', () => {
  const { music, media, created, clock } = setup(); music.beginJourney();
  for (const chapter of Object.keys(chapterMusic) as (keyof typeof chapterMusic)[]) {
    music.enterChapter(chapter); assert.equal(media.paused, false, 'the outgoing music has an audible tail');
    clock.advance(MUSIC_FADE_MS); assert.equal(media.paused, true);
    assert.equal(music.currentTrack, undefined);
    music.revealChapter('Yorktown');
    if (chapter !== 'Yorktown') assert.equal(media.paused, true, 'stale reveal cannot start a different chapter');
    music.revealChapter(chapter);
    assert.equal(media.src, musicTracks[chapterMusic[chapter]]); assert.equal(media.paused, false);
    assert.equal(media.currentTime, 0); media.currentTime = 30;
  }
  music.enterChapter('Yorktown'); clock.advance(MUSIC_FADE_MS); assert.equal(media.paused, true); music.revealChapter('Yorktown');
  assert.equal(media.currentTime, 0); assert.equal(created(), 1);
});
test('debate temporarily replaces the chapter music and resumes its saved position', () => {
  const { music, media, clock } = setup(); music.enterChapter('Debate'); music.revealChapter('Debate');
  media.currentTime = 42; music.setDebate(true);
  assert.equal(media.src, musicTracks.farmerRefuted); clock.advance(MUSIC_FADE_MS);
  assert.equal(media.src, musicTracks.cabinetBattle); assert.equal(media.currentTime, 0);
  media.currentTime = 8; music.setDebate(true); assert.equal(media.currentTime, 8);
  music.setDebate(false); clock.advance(MUSIC_FADE_MS); assert.equal(media.src, musicTracks.farmerRefuted); assert.equal(media.currentTime, 42);
  music.setDebate(true); music.enterChapter('Debate'); music.setDebate(false);
  clock.advance(MUSIC_FADE_MS);
  assert.equal(media.paused, true); music.revealChapter('Debate'); assert.equal(media.currentTime, 0);
});
test('overlapping pause reasons, mute and preference changes preserve position', () => {
  const { music, media, storage, clock } = setup(); music.beginJourney(); media.currentTime = 15;
  music.setPaused('settings', true); music.setPaused('hidden', true);
  music.setEnabled(false); assert.equal(storage.getItem(MUSIC_KEY), 'false');
  clock.advance(MUSIC_FADE_MS);
  music.setEnabled(true); music.setPaused('settings', false); assert.equal(media.paused, true);
  music.setPaused('hidden', false); assert.equal(media.paused, false); assert.equal(media.currentTime, 15);
  music.setMuted('film', true); assert.equal(media.muted, true); assert.equal(media.paused, false);
  music.setMuted('film', false); assert.equal(media.muted, false);
  music.setEnabled(false); clock.advance(MUSIC_FADE_MS);
  const restored = new MusicSystem(() => new Media(), storage); assert.equal(restored.enabled, true); assert.equal(restored.volume, 0);
});
test('autoplay retries on gestures, and stale rejections cannot stop a replacement', async () => {
  const { music, media, clock } = setup();
  media.result = () => Promise.reject(new DOMException('gesture', 'NotAllowedError'));
  music.beginJourney(); await Promise.resolve(); assert.equal(media.paused, true);
  media.result = () => Promise.resolve(); music.unlock(); assert.equal(media.paused, false);
  let reject!: (error: Error) => void;
  music.setPaused('settings', true); clock.advance(MUSIC_FADE_MS);
  media.result = () => new Promise((_, fail) => { reject = fail; });
  music.setPaused('settings', false);
  music.enterChapter('Arrival'); media.result = () => Promise.resolve(); music.revealChapter('Arrival');
  clock.advance(MUSIC_FADE_MS);
  reject(Error('stale')); await Promise.resolve(); assert.equal(media.paused, false); assert.equal(media.src, musicTracks.aaronBurr);
  music.stop(); music.unlock(); music.setPaused('settings', false); clock.advance(MUSIC_FADE_MS);
  assert.equal(media.paused, true); assert.equal(media.src, '');
});
test('fresh or invalid stored music volume defaults to 100%, while saved choices survive', () => {
  for (const saved of [[], [[MUSIC_VOLUME_KEY, '']], [[MUSIC_VOLUME_KEY, 'invalid']]] as [string, string][][]) {
    const { music, media } = setup(saved); music.beginJourney();
    assert.equal(music.volume, 1); assert.equal(media.volume, 1);
  }
  for (const level of [0, .35, .8, 1]) {
    const { music, media, storage } = setup([[MUSIC_VOLUME_KEY, String(level)]]);
    music.beginJourney(); assert.equal(music.volume, level); assert.equal(media.volume, level);
    music.setVolume(.6); assert.equal(storage.getItem(MUSIC_VOLUME_KEY), '0.6');
  }
});
test('fade is gradual, overlapping pause reasons do not restart it, and volume changes scale its tail', () => {
  const { music, media, clock } = setup(); music.beginJourney();
  music.setPaused('settings', true); assert.equal(media.paused, false); assert.equal(media.volume, 1);
  clock.advance(160); const first = media.volume; assert.ok(first > .6 && first < .8);
  music.setPaused('hidden', true); music.setEnabled(false);
  music.setVolume(.5); assert.equal(media.volume, first * .5);
  clock.advance(160); assert.ok(media.volume > 0 && media.volume < first * .5);
  clock.advance(MUSIC_FADE_MS - 320); assert.equal(media.paused, true); assert.equal(clock.tasks.size, 0);
  music.setEnabled(true); music.setPaused('settings', false); assert.equal(media.paused, true);
  music.setPaused('hidden', false); assert.equal(media.paused, false); assert.equal(media.volume, .5);
});
test('a rapid resume cancels the fading pause without replaying, and stale callbacks cannot stop it', () => {
  const { music, media, clock } = setup(); music.beginJourney(); media.currentTime = 12;
  music.setPaused('settings', true); clock.advance(160);
  const stale = [...clock.tasks][0].callback;
  music.setPaused('settings', false); stale(); clock.advance(MUSIC_FADE_MS * 2);
  assert.equal(media.paused, false); assert.equal(media.volume, 1); assert.equal(media.currentTime, 12);
  assert.equal(media.calls, 1); assert.equal(clock.tasks.size, 0);
});
test('quick reveal, replacement and stop during a fade only apply the latest requested destination', () => {
  const { music, media, clock } = setup(); music.beginJourney();
  music.enterChapter('Arrival'); music.revealChapter('Arrival'); clock.advance(160);
  assert.equal(media.src, musicTracks.alexanderHamilton);
  music.enterChapter('Tavern'); music.revealChapter('Arrival'); music.revealChapter('Tavern');
  clock.advance(MUSIC_FADE_MS - 160);
  assert.equal(media.src, musicTracks.myShot); assert.equal(media.calls, 2); assert.equal(media.paused, false);
  music.setEnabled(false); clock.advance(160); music.stop(); clock.advance(MUSIC_FADE_MS - 160);
  assert.equal(media.paused, true); assert.equal(media.src, ''); assert.equal(music.currentTrack, undefined);
  music.setEnabled(true); clock.advance(MUSIC_FADE_MS); assert.equal(media.calls, 2);
});
test('canceling debate during its fade keeps the original song and unload immediately cancels timers', () => {
  const { music, media, clock } = setup(); music.enterChapter('Debate'); music.revealChapter('Debate');
  music.setDebate(true); clock.advance(160); music.setDebate(false); clock.advance(MUSIC_FADE_MS);
  assert.equal(media.src, musicTracks.farmerRefuted); assert.equal(media.calls, 1); assert.equal(media.volume, 1);
  music.stop(); clock.advance(160); const stale = [...clock.tasks][0].callback;
  music.stop(true); stale(); clock.advance(MUSIC_FADE_MS);
  assert.equal(media.src, ''); assert.equal(media.paused, true); assert.equal(clock.tasks.size, 0);
});
test('the last rejected play remains recoverable when a pending fade is canceled', async () => {
  const { music, media, clock } = setup(); let reject!: (error: Error) => void;
  media.result = () => new Promise((_, fail) => { reject = fail; }); music.beginJourney();
  music.setPaused('focus', true); clock.advance(160); music.setPaused('focus', false);
  reject(new DOMException('gesture', 'NotAllowedError')); await Promise.resolve();
  assert.equal(media.paused, true);
  media.result = () => Promise.resolve(); music.unlock();
  assert.equal(media.paused, false); assert.equal(media.volume, 1); assert.equal(clock.tasks.size, 0);
});
test('awaitable stop completes after the actual fade, sharing an in-progress stop without extending it', async () => {
  const { music, media, clock } = setup(); music.beginJourney();
  let stopped = false;
  const first = music.stopAndWait(); first.then(() => { stopped = true; });
  clock.advance(160); assert.equal(music.stopAndWait(), first);
  clock.advance(MUSIC_FADE_MS - 161); await Promise.resolve();
  assert.equal(stopped, false); assert.equal(media.paused, false);
  clock.advance(1); await first;
  assert.equal(stopped, true); assert.equal(media.paused, true); assert.equal(media.src, ''); assert.equal(clock.tasks.size, 0);
});
test('awaitable stop immediately completes for absent, paused, muted or zero-volume audio', async () => {
  for (const state of ['absent', 'paused', 'muted', 'zero']) {
    const { music, media, clock } = setup();
    if (state !== 'absent') music.beginJourney();
    if (state === 'paused') { music.setPaused('settings', true); clock.advance(MUSIC_FADE_MS); }
    if (state === 'muted') music.setMuted('film', true);
    if (state === 'zero') music.setVolume(0);
    let stopped = false; music.stopAndWait().then(() => { stopped = true; }); await Promise.resolve();
    assert.equal(stopped, true, state); assert.equal(media.paused, true); assert.equal(media.src, ''); assert.equal(clock.tasks.size, 0);
  }
});
test('immediate cleanup or a replacement releases pending stop waiters without affecting later stops', async () => {
  const { music, media, clock } = setup(); music.beginJourney();
  const first = music.stopAndWait(); clock.advance(160); music.stop(true); await first;
  assert.equal(media.paused, true); assert.equal(clock.tasks.size, 0);
  music.beginJourney(); let stopped = false;
  const second = music.stopAndWait(); second.then(() => { stopped = true; });
  assert.notEqual(second, first); await Promise.resolve(); assert.equal(stopped, false);
  music.enterChapter('Arrival'); music.revealChapter('Arrival'); clock.advance(MUSIC_FADE_MS); await second;
  assert.equal(stopped, true); assert.equal(media.src, musicTracks.aaronBurr); assert.equal(media.paused, false);
  const third = music.stopAndWait(); clock.advance(MUSIC_FADE_MS); await third;
  assert.equal(media.paused, true); assert.equal(media.src, ''); assert.equal(clock.tasks.size, 0);
});
test('a rejected play settles an awaited stop and cancels its remaining fade', async () => {
  const { music, media, clock } = setup(); let reject!: (error: Error) => void;
  media.result = () => new Promise((_, fail) => { reject = fail; }); music.beginJourney();
  const stopped = music.stopAndWait(); reject(new DOMException('gesture', 'NotAllowedError')); await stopped;
  assert.equal(media.paused, true); assert.equal(media.src, ''); assert.equal(clock.tasks.size, 0);
});
test('failed audio or storage never blocks chapter progression', async () => {
  const music = new MusicSystem(() => { throw Error('unavailable'); }, { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
  music.beginJourney(); music.setEnabled(false); music.enterChapter('Arrival'); music.revealChapter('Arrival'); music.stop();
  const { music: working, media } = setup(); media.result = () => Promise.reject(Error('missing MP3'));
  working.beginJourney(); await Promise.resolve(); assert.equal(media.paused, true);
  media.result = () => Promise.resolve(); working.enterChapter('Arrival'); working.revealChapter('Arrival'); assert.equal(media.paused, false);
});
test('all seven local tracks match the copied original hashes', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/audio/bgm/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.tracks.length, 7);
  for (const src of Object.values(musicTracks)) {
    const record = manifest.tracks.find((track: { file: string }) => src.endsWith(`/${track.file}`)); assert.ok(record);
    const bytes = readFileSync(new URL(`../public${src}`, import.meta.url));
    assert.equal(bytes.length, record.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
  }
});
