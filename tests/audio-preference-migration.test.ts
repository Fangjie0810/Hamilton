import test from 'node:test';
import assert from 'node:assert/strict';
import { loadVolumeOnlyPreference } from '../src/systems/AudioVolume';
import { MusicSystem, MUSIC_KEY, MUSIC_VOLUME_KEY } from '../src/systems/MusicSystem';
import { VoiceoverSystem, VOICEOVER_KEY, VOICEOVER_VOLUME_KEY } from '../src/systems/VoiceoverSystem';

test('retired audio switches migrate once to a visible zero; raising volume survives reload', () => {
  const values = new Map([[MUSIC_KEY, 'false'], [MUSIC_VOLUME_KEY, '.7'], [VOICEOVER_KEY, 'false']]);
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const unusedMedia = () => { throw new Error('preference changes do not create media'); };
  const music = new MusicSystem(unusedMedia, storage), voice = new VoiceoverSystem([], unusedMedia, storage);
  assert.equal(music.enabled, true); assert.equal(music.volume, 0);
  assert.equal(voice.enabled, true); assert.equal(voice.volume, 0);
  music.setVolume(.4); voice.setVolume(.6);
  assert.equal(new MusicSystem(unusedMedia, storage).volume, .4);
  assert.equal(new VoiceoverSystem([], unusedMedia, storage).volume, .6);
  assert.equal(values.get(MUSIC_KEY), 'true'); assert.equal(values.get(VOICEOVER_KEY), 'true');
  assert.equal(values.get(VOICEOVER_VOLUME_KEY), '0.6');
});

test('migration works in read-only storage and ordinary zero-volume preferences remain muted', () => {
  assert.equal(loadVolumeOnlyPreference({ getItem: () => 'false', setItem() { throw Error('blocked'); } }, 'volume', 'enabled', 1), 0);
  assert.equal(loadVolumeOnlyPreference({ getItem: key => key === 'volume' ? '0' : null, setItem() {} }, 'volume', 'enabled', 1), 0);
  assert.equal(loadVolumeOnlyPreference(undefined, 'volume', 'enabled', 1), 1);
});
