import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { VoiceoverSystem, VOICEOVER_KEY, loadVoiceoverEnabled, type VoiceCue, type VoicePlaybackState } from '../src/systems/VoiceoverSystem';
import { chapters } from '../src/data/chapters';
import { smallTalk, newsboyThanks } from '../src/data/smallTalk';
import { debateArguments, responseTypes } from '../src/data/debate';
import { dispatches } from '../src/data/writing';
import { assaultCommands } from '../src/data/yorktown';
import { bi } from '../src/i18n/text';

class Media extends EventTarget {
  volume = 1;
  src = ''; preload: HTMLAudioElement['preload'] = ''; paused = true; position = 0; calls = 0;
  result: () => Promise<void> = () => Promise.resolve();
  play() { this.calls++; this.paused = false; return this.result(); }
  pause() { this.paused = true; }
  load() { this.position = 0; }
  removeAttribute() { this.src = ''; }
  end() { this.dispatchEvent(new Event('ended')); }
}
const cues: VoiceCue[] = [
  { id: 'one', speaker: 'hamilton', text: bi('你好', 'Hello'), generated: true, src: '/audio/en/hamilton-one.mp3' },
  { id: 'two', speaker: 'narrator', text: bi('你好', 'Hello'), generated: true, src: '/audio/en/narrator-two.mp3' },
];
function setup(stallMs = 15000) {
  const media: Media[] = [], values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const system = new VoiceoverSystem(cues, () => { const audio = new Media(); media.push(audio); return audio; }, storage, stallMs);
  return { system, media, values, storage };
}
test('voice defaults on, remembers off, and tolerates unavailable storage', () => {
  assert.equal(loadVoiceoverEnabled(), true);
  assert.equal(loadVoiceoverEnabled({ getItem() { throw Error('blocked'); } }), true);
  const { system, values, storage, media } = setup();
  system.setEnabled(false); assert.equal(values.get(VOICEOVER_KEY), 'false');
  assert.equal(loadVoiceoverEnabled(storage), false);
  const track = system.play(cues); assert.equal(media.length, 0); assert.equal(track.busy, false);
  system.setEnabled(true); assert.equal(media.length, 1); assert.equal(track.busy, true); system.stop();
});
test('speaker matching, sequential playback, interruption and stale owners never overlap', () => {
  const { system, media } = setup();
  const old = system.play(cues); assert.equal(media[0].src, cues[0].src);
  media[0].end(); assert.equal(media[0].paused, true); assert.equal(media[1].src, cues[1].src);
  const current = system.play([cues[0]]); old.stop(); media[1].end();
  assert.equal(old.busy, false); assert.equal(current.busy, true); assert.equal(media.length, 3);
  assert.equal(media.filter(m => !m.paused).length, 1);
  assert.equal(system.play([{ speaker: 'citizen', text: cues[0].text }]).busy, false);
  assert.ok(media.every(m => m.paused)); system.stop();
});
test('pause reasons and voice toggle retain position without resuming behind a modal', () => {
  const { system, media } = setup(); const track = system.play(cues); media[0].position = 3;
  system.setPaused('settings', true); system.setPaused('hidden', true);
  system.setEnabled(false); assert.equal(track.busy, false);
  system.setEnabled(true); system.setPaused('settings', false); assert.equal(media[0].paused, true);
  system.setPaused('hidden', false); assert.equal(media[0].paused, false); assert.equal(media[0].position, 3);
  assert.equal(media.length, 1); system.stop();
});
test('late play rejection cannot clear a replacement or a paused current line', async () => {
  const { system, media } = setup(); let reject!: (error: Error) => void;
  // The first play is pending when a pause invalidates its attempt.
  system.setPaused('settings', true); system.play(cues); system.setPaused('settings', false);
  system.setPaused('settings', true);
  media[0].result = () => new Promise((_, fail) => { reject = fail; });
  system.setPaused('settings', false); system.setPaused('settings', true);
  reject(new Error('AbortError')); await Promise.resolve(); assert.equal(system.busy, true);
  system.setPaused('settings', false); const late = reject;
  const replacement = system.play([cues[1]]); late(new Error('late failure')); await Promise.resolve();
  assert.equal(replacement.busy, true); assert.equal(system.currentCue?.speaker, 'narrator'); system.stop();
});
test('autoplay refusal releases game timing and retries only the current line on a gesture', async () => {
  let audio!: Media;
  const system = new VoiceoverSystem(cues, () => { audio = new Media(); audio.result = () => Promise.reject(new DOMException('gesture needed', 'NotAllowedError')); return audio; });
  const track = system.play([cues[0]]); await Promise.resolve(); assert.equal(track.busy, false);
  audio.result = () => Promise.resolve(); system.unlock(); assert.equal(track.busy, true); assert.equal(audio.paused, false);
  system.stop(); system.unlock(); assert.equal(system.busy, false);
});
test('missing media and stalled loads release timing; destroy clears every pending clip', async () => {
  const { system, media } = setup(20);
  system.play(cues); media[0].dispatchEvent(new Event('error')); assert.equal(system.currentCue?.id, 'two');
  await new Promise(resolve => setTimeout(resolve, 35)); assert.equal(system.busy, false);
  system.play(cues); system.stop(); media.at(-1)!.end();
  assert.equal(system.busy, false); assert.ok(media.every(m => m.paused));
});
test('playback subscriptions expose loading, audible speech, buffering and each available queue cue', async t => {
  const { system, media } = setup(); t.after(() => system.stop());
  const states: VoicePlaybackState[] = [];
  const unsubscribe = system.onPlaybackChange(state => states.push(state));
  assert.deepEqual(states[0], { cue: undefined, playing: false, paused: false, enabled: true, waitingForGesture: false });
  const missing = { speaker: 'missing', text: bi('缺失', 'Missing') };
  system.play([missing, cues[0], missing, cues[1]]);
  await Promise.resolve();
  assert.equal(states.at(-1)?.cue?.id, 'one');
  assert.equal(states.at(-1)?.playing, false, 'a fulfilled play request does not prove the voice has started');
  media[0].dispatchEvent(new Event('playing'));
  media[0].dispatchEvent(new Event('waiting'));
  media[0].dispatchEvent(new Event('playing'));
  media[0].end();
  assert.equal(states.at(-1)?.cue?.id, 'two');
  assert.equal(states.at(-1)?.playing, false, 'the next speaker waits for its own media to start');
  media[1].dispatchEvent(new Event('playing')); media[1].end();
  assert.deepEqual(states.filter(state => state.cue).map(state => [state.cue!.id, state.playing]), [
    ['one', false], ['one', true], ['one', false], ['one', true], ['two', false], ['two', true],
  ]);
  assert.equal(states.at(-1)?.cue, undefined); assert.equal(states.at(-1)?.playing, false);
  system.play([cues[0]]); system.play([missing]);
  assert.equal(states.at(-1)?.cue, undefined, 'an unavailable replacement clears the previous speaker');
  const count = states.length; unsubscribe(); system.play(cues);
  assert.equal(states.length, count, 'unsubscribed portraits receive no later events');
});
test('pause reasons, disabled speech, raw pause events and stop silence the current observable voice', t => {
  const { system, media } = setup(); t.after(() => system.stop());
  let state!: VoicePlaybackState;
  system.onPlaybackChange(value => { state = value; });
  system.play(cues); media[0].dispatchEvent(new Event('playing'));
  system.setPaused('settings', true); system.setPaused('hidden', true);
  assert.equal(state.cue?.id, 'one'); assert.equal(state.paused, true); assert.equal(state.playing, false);
  media[0].dispatchEvent(new Event('playing'));
  assert.equal(state.playing, false, 'a delayed media event cannot bypass a modal pause');
  system.setPaused('settings', false); assert.equal(state.paused, true);
  system.setPaused('hidden', false); assert.equal(state.paused, false); assert.equal(state.playing, false);
  media[0].dispatchEvent(new Event('playing')); assert.equal(state.playing, true);
  media[0].dispatchEvent(new Event('pause')); assert.equal(state.playing, false);
  media[0].dispatchEvent(new Event('playing')); system.setEnabled(false);
  assert.equal(state.enabled, false); assert.equal(state.playing, false); assert.equal(state.cue?.id, 'one');
  media[0].dispatchEvent(new Event('playing')); assert.equal(state.playing, false);
  system.setEnabled(true); assert.equal(state.playing, false);
  media[0].dispatchEvent(new Event('playing')); system.stop();
  assert.equal(state.cue, undefined); assert.equal(state.playing, false);
});
test('autoplay refusal remains observable and only a current gesture retry can start its animation', async t => {
  let audio!: Media;
  const system = new VoiceoverSystem(cues, () => {
    audio = new Media(); audio.result = () => Promise.reject(new DOMException('gesture needed', 'NotAllowedError')); return audio;
  });
  t.after(() => system.stop());
  let state!: VoicePlaybackState;
  system.onPlaybackChange(value => { state = value; });
  system.setEnabled(false); system.play([cues[0]]);
  assert.equal(state.cue?.id, 'one'); assert.equal(state.enabled, false); assert.equal(state.playing, false);
  system.setEnabled(true); await Promise.resolve();
  assert.equal(state.waitingForGesture, true); assert.equal(state.cue?.id, 'one'); assert.equal(state.playing, false);
  audio.dispatchEvent(new Event('playing')); assert.equal(state.playing, false);
  audio.result = () => Promise.resolve(); system.unlock();
  assert.equal(state.waitingForGesture, false); assert.equal(state.playing, false);
  audio.dispatchEvent(new Event('playing')); assert.equal(state.playing, true);
});
test('late media events and rejected requests cannot animate or clear a replacement speaker', async t => {
  const { system, media } = setup(); t.after(() => system.stop());
  const states: VoicePlaybackState[] = [];
  system.onPlaybackChange(state => states.push(state));
  system.play([cues[0]]); system.setPaused('settings', true);
  let reject!: (error: Error) => void;
  media[0].result = () => new Promise((_, fail) => { reject = fail; });
  system.setPaused('settings', false);
  system.play([cues[1]]); media[1].dispatchEvent(new Event('playing'));
  const count = states.length;
  for (const event of ['playing', 'waiting', 'pause', 'ended', 'error', 'timeupdate']) media[0].dispatchEvent(new Event(event));
  reject(new Error('late failure')); await Promise.resolve();
  assert.equal(states.length, count); assert.equal(states.at(-1)?.cue?.id, 'two'); assert.equal(states.at(-1)?.playing, true);
  media[1].dispatchEvent(new Event('error'));
  assert.equal(states.at(-1)?.cue, undefined); assert.equal(states.at(-1)?.playing, false);
});
test('all story roles resolve to local audio and narration is restricted to source dialogue', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/audio/en/manifest.json', import.meta.url), 'utf8'));
  const runtime = JSON.parse(readFileSync(new URL('../src/data/voiceover-catalog.json', import.meta.url), 'utf8'));
  assert.deepEqual(runtime, manifest.cues.map((cue: VoiceCue) => ({id:cue.id,speaker:cue.speaker,text:typeof cue.text === 'string' ? cue.text : cue.text.en,src:cue.src,generated:cue.generated})));
  const voices = JSON.parse(readFileSync(new URL('../docs/voiceover/voice-map.json', import.meta.url), 'utf8'));
  const catalog = new VoiceoverSystem(manifest.cues, () => new Media());
  for (const cue of manifest.cues) { assert.ok(catalog.has(cue), cue.id); assert.ok(existsSync(new URL(`../public${cue.src}`, import.meta.url)), cue.src); }
  const check = (line: {speaker: string; text: {zh: string; en: string}}) => { assert.ok(voices[line.speaker], line.speaker); assert.ok(catalog.has(line), `${line.speaker}: ${line.text.en}`); };
  for (const chapter of Object.values(chapters)) {
    assert.equal(catalog.has({ speaker: 'narrator', text: chapter.title }), false);
    assert.equal(catalog.has({ speaker: 'narrator', text: chapter.subtitle }), false);
    for (const interaction of chapter.interactions) {
      interaction.lines.forEach(check); interaction.variants?.forEach(variant => variant.lines.forEach(check));
      if (interaction.choice) { assert.equal(catalog.has({ speaker: 'narrator', text: interaction.choice.prompt }), false); interaction.choice.options.forEach(option => { check({ speaker: 'hamilton', text: option.text }); option.reply.forEach(check); }); }
    }
  }
  debateArguments.forEach(argument => responseTypes.forEach(type => check({speaker: 'hamilton', text: argument.responses[type]})));
  Object.values(smallTalk).forEach(check);
  check(newsboyThanks);
  assert.equal(catalog.has({ speaker: 'newsboy', text: bi('先别把报纸折起来，墨还没干呢。', "Don't fold the paper yet. The ink is still wet.") }), false, 'retired newspaper chatter is excluded');
  dispatches.forEach(dispatch => dispatch.fragments.forEach(fragment => check({speaker: 'hamilton', text: fragment.text})));
  assaultCommands.forEach(command => check({speaker: 'hamilton', text: command.label}));
  const variants = JSON.parse(readFileSync(new URL('../docs/voiceover/dynamic-variants.json', import.meta.url), 'utf8'));
  variants.cues.forEach((cue: VoiceCue) => assert.equal(catalog.has(cue), false));
  const source = JSON.parse(readFileSync(new URL('../docs/voiceover/manifest.json', import.meta.url), 'utf8'));
  const allowedNarration = source.cues.filter((cue: {speaker: string; kind: string; chapter: string}) => cue.speaker === 'narrator' && cue.kind === 'dialogue' && cue.chapter !== 'Demo');
  assert.deepEqual(runtime.filter((cue: VoiceCue) => cue.speaker === 'narrator').map((cue: VoiceCue) => cue.id).sort(), allowedNarration.map((cue: VoiceCue) => cue.id).sort());
  assert.ok(manifest.cues.every((cue: {speaker: string; kind: string}) => cue.speaker !== 'narrator' || cue.kind === 'dialogue'));
  debateArguments.forEach(argument => check({speaker: 'loyalist', text: argument.text}));
});
