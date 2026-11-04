import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { VoiceoverSystem, type VoiceCue } from '../src/systems/VoiceoverSystem';
import type { CharacterId } from '../src/data/types';
import type { DialoguePerformance } from '../src/data/mainPixelArt';
import { bi, setLanguage } from '../src/i18n/text';

// The presentation is real; only its DOM/canvas port is replaced. CSS has no
// lifecycle semantics, so Node can load the same browser module without a DOM.
const css = registerHooks({ load(url, context, next) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return next(url, context);
} });
const localStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
const { DialoguePresentation } = await import('../src/ui/DialoguePresentation');
css.deregister();
if (localStorage) Object.defineProperty(globalThis, 'localStorage', localStorage);
else Reflect.deleteProperty(globalThis, 'localStorage');

class Media extends EventTarget {
  src = ''; preload: HTMLAudioElement['preload'] = ''; volume = 1;
  result = () => Promise.resolve();
  play() { return this.result(); }
  pause() {}
  load() {}
  removeAttribute() { this.src = ''; }
  emit(name: string) { this.dispatchEvent(new Event(name)); }
}
class Portraits {
  element = {} as HTMLDivElement;
  focused?: CharacterId;
  partner?: CharacterId;
  performance?: DialoguePerformance;
  talking = false;
  settled = false;
  paused = false;
  reduced = false;
  shown: Array<{ speaker: CharacterId; partner?: CharacterId; performance?: DialoguePerformance }> = [];
  show(speaker: CharacterId, partner?: CharacterId, performance?: DialoguePerformance) {
    this.focused = speaker; this.partner = partner; this.performance = performance;
    this.shown.push({ speaker, partner, performance });
  }
  setPerformance(performance: DialoguePerformance) { this.performance = performance; }
  setSpeaking(_speaker: string | undefined, talking: boolean, settled = false) { this.talking = talking; this.settled = settled; }
  update(_delta: number, paused: boolean, reduced: boolean) { this.paused = paused; this.reduced = reduced; }
  reset() { this.focused = undefined; }
  destroy() {}
}
const cues: VoiceCue[] = [
  { id: 'selection', speaker: 'hamilton', text: bi('现在行动！', 'Act now!'), src: '/audio/en/hamilton-selection.mp3', generated: true },
  { id: 'reply', speaker: 'lafayette', text: bi('我赞同。', 'I agree.'), src: '/audio/en/lafayette-reply.mp3', generated: true },
];
const attitudes: DialoguePerformance[] = [
  { speaking: 'assertive', settled: 'reflect', listener: 'concern', emphasis: true },
  { speaking: 'approve', settled: 'amused', listener: 'approve', emphasis: false },
];
function setup() {
  const media: Media[] = [], portraits = new Portraits();
  const voice = new VoiceoverSystem(cues, () => { const audio = new Media(); media.push(audio); return audio; });
  const presentation = new DialoguePresentation({ portraits, voice, performance: line => attitudes[line.speaker === 'lafayette' ? 1 : 0] });
  return { media, portraits, voice, presentation };
}
function advance(presentation: InstanceType<typeof DialoguePresentation>, ms: number, paused = false) {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) presentation.update(Math.min(100, ms - elapsed), paused, false);
}

test('dialogue waits for actual playing and settles only after the current cue ends', t => {
  const { presentation, portraits, media } = setup(); t.after(() => presentation.destroy());
  presentation.play([cues[0]], 'lafayette');
  assert.equal(portraits.focused, 'hamilton'); assert.equal(portraits.talking, false); assert.equal(portraits.settled, false);
  assert.deepEqual(portraits.performance, attitudes[0]);
  media[0].emit('playing'); assert.equal(portraits.talking, true);
  media[0].emit('waiting'); assert.equal(portraits.talking, false); assert.equal(portraits.settled, false, 'buffering is not a completed reaction');
  media[0].emit('playing'); assert.equal(portraits.talking, true);
  media[0].emit('pause'); assert.equal(portraits.talking, false); assert.equal(portraits.settled, false, 'a media pause is not completion');
  media[0].emit('playing'); media[0].emit('ended');
  assert.equal(portraits.talking, false); assert.equal(portraits.settled, true);
  advance(presentation, 3000); assert.equal(portraits.settled, true, 'the final attitude is held');
});

test('selected line and reply each receive their own focus and attitude at the real cue boundary', t => {
  const { presentation, portraits, media } = setup(); t.after(() => presentation.destroy());
  presentation.play(cues, 'lafayette');
  assert.equal(portraits.focused, 'hamilton', 'the last response must not appear before its voice');
  media[0].emit('playing'); media[0].emit('ended');
  assert.equal(portraits.focused, 'lafayette'); assert.equal(portraits.partner, 'hamilton');
  assert.deepEqual(portraits.performance, attitudes[1]);
  assert.equal(portraits.talking, false); assert.equal(portraits.settled, false);
  media[1].emit('playing'); assert.equal(portraits.talking, true);
  media[1].emit('ended'); assert.equal(portraits.settled, true);
  assert.deepEqual(portraits.shown.map(state => state.speaker), ['hamilton', 'lafayette']);
});

test('settings pause and language changes preserve the current cue and attitude', t => {
  const { presentation, portraits, media, voice } = setup();
  t.after(() => { presentation.destroy(); setLanguage('dual'); });
  presentation.play(cues); media[0].emit('playing');
  const shown = portraits.shown.length;
  voice.setPaused('settings', true); advance(presentation, 4000, true);
  assert.equal(portraits.paused, true); assert.equal(portraits.settled, false);
  for (const language of ['zh', 'en', 'dual-en', 'dual'] as const) {
    setLanguage(language); presentation.update(0, true, false);
    assert.equal(portraits.focused, 'hamilton'); assert.deepEqual(portraits.performance, attitudes[0]);
  }
  assert.equal(portraits.shown.length, shown, 'language does not recreate a performance');
  voice.setPaused('settings', false); presentation.update(0, false, true);
  assert.equal(portraits.talking, false, 'resuming a setting still awaits real media playback');
  media[0].emit('playing'); assert.equal(portraits.talking, true); assert.equal(portraits.reduced, true);
});

test('quickly replacing a line makes late old media events harmless', async t => {
  const { presentation, portraits, media } = setup(); t.after(() => presentation.destroy());
  presentation.play([cues[0]]); media[0].emit('playing');
  const old = media[0];
  presentation.play([cues[1]]); media[1].emit('playing');
  const shown = portraits.shown.length;
  for (const event of ['playing', 'waiting', 'pause', 'ended', 'error']) old.emit(event);
  await Promise.resolve();
  assert.equal(portraits.focused, 'lafayette'); assert.equal(portraits.talking, true); assert.equal(portraits.settled, false);
  assert.equal(portraits.shown.length, shown);
});

test('a foreign presentation using an identical cue cannot reactivate a completed owner', t => {
  const { presentation, portraits, media, voice } = setup(); t.after(() => { presentation.destroy(); voice.stop(); });
  presentation.play([cues[0]]); media[0].emit('playing');
  voice.play([cues[0]]); media[1].emit('playing');
  assert.equal(portraits.talking, false); assert.equal(portraits.settled, true);
  presentation.update(100, false, false); assert.equal(portraits.talking, false);
});

test('muted dialogue acts through both lines in order, respects pause, and holds the final reaction', t => {
  const { presentation, portraits, voice } = setup(); t.after(() => presentation.destroy());
  voice.setEnabled(false); presentation.play(cues);
  assert.equal(portraits.focused, 'hamilton'); assert.equal(portraits.talking, true);
  advance(presentation, 5000, true);
  assert.equal(portraits.focused, 'hamilton'); assert.equal(portraits.talking, false); assert.equal(portraits.settled, false);
  advance(presentation, 900);
  assert.equal(portraits.focused, 'lafayette'); assert.deepEqual(portraits.performance, attitudes[1]);
  advance(presentation, 900);
  assert.equal(portraits.talking, false); assert.equal(portraits.settled, true);
  advance(presentation, 5000); assert.equal(portraits.settled, true);
});

test('unavailable audio uses a finite local performance without requesting narration', t => {
  const { presentation, portraits, media } = setup(); t.after(() => presentation.destroy());
  presentation.play([{ speaker: 'hamilton', text: bi('继续', 'Continue') }], 'washington');
  assert.equal(portraits.talking, true); assert.equal(media.length, 0);
  advance(presentation, 900);
  assert.equal(portraits.talking, false); assert.equal(portraits.settled, true);
});

test('reenabling speech after muted progress follows the media cue instead of the silent response', t => {
  const { presentation, portraits, media, voice } = setup(); t.after(() => presentation.destroy());
  voice.setEnabled(false); presentation.play(cues); advance(presentation, 900);
  assert.equal(portraits.focused, 'lafayette');
  voice.setEnabled(true);
  assert.equal(portraits.focused, 'hamilton'); assert.equal(portraits.talking, false); assert.equal(portraits.settled, false);
  media[0].emit('playing'); assert.equal(portraits.talking, true);
});

test('autoplay refusal remains ready and retries only when the media really starts', async t => {
  const media: Media[] = [], portraits = new Portraits();
  const voice = new VoiceoverSystem(cues, () => {
    const audio = new Media(); audio.result = () => Promise.reject(new DOMException('gesture required', 'NotAllowedError')); media.push(audio); return audio;
  });
  const presentation = new DialoguePresentation({ portraits, voice, performance: () => attitudes[0] });
  t.after(() => presentation.destroy());
  presentation.play([cues[0]]); await Promise.resolve();
  advance(presentation, 2000); assert.equal(portraits.talking, false); assert.equal(portraits.settled, false);
  media[0].result = () => Promise.resolve(); voice.unlock();
  assert.equal(portraits.talking, false); media[0].emit('playing'); assert.equal(portraits.talking, true);
});

test('gameplay outcome waits for the final spoken fragment, then replaces only the held reaction', t => {
  const { presentation, portraits, media } = setup(); t.after(() => presentation.destroy());
  const reaction: DialoguePerformance = { speaking: 'concern', settled: 'concern', listener: 'reflect', emphasis: false };
  presentation.play(cues, 'lafayette', reaction);
  media[0].emit('playing'); media[0].emit('ended'); media[1].emit('playing');
  assert.deepEqual(portraits.performance, attitudes[1], 'the real reply keeps its own spoken attitude');
  media[1].emit('waiting'); assert.deepEqual(portraits.performance, attitudes[1], 'buffering never reveals the score reaction early');
  media[1].emit('playing'); media[1].emit('ended');
  assert.deepEqual(portraits.performance, reaction); assert.equal(portraits.settled, true); assert.equal(portraits.talking, false);
  presentation.play([cues[0]]); assert.deepEqual(portraits.performance, attitudes[0], 'a new phase discards the old outcome');
});

test('static result reactions never enqueue speech and clear cleanly before the next presentation', t => {
  const { presentation, portraits, media } = setup(); t.after(() => presentation.destroy());
  const reaction: DialoguePerformance = { speaking: 'approve', settled: 'approve', listener: 'approve', emphasis: false };
  presentation.react('hamilton', 'washington', reaction);
  advance(presentation, 3000);
  assert.equal(media.length, 0); assert.equal(portraits.focused, 'hamilton'); assert.equal(portraits.partner, 'washington');
  assert.equal(portraits.settled, true); assert.equal(portraits.talking, false); assert.deepEqual(portraits.performance, reaction);
  presentation.stop(true); assert.equal(portraits.focused, undefined);
  presentation.show('hamilton', 'lafayette'); assert.equal(portraits.performance, undefined); assert.equal(portraits.settled, false);
});
