import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorAudio} from './audio';
const pending: ((buffer: unknown) => void)[] = [];
class FakeContext {
  currentTime = 0; baseLatency = 0; outputLatency = 0; destination = {};
  createGain() { return {gain:{value:1}, connect() {}}; }
  decodeAudioData() { return new Promise(resolve => pending.push(resolve)); }
  resume() { return Promise.resolve(); }
  createBufferSource() { return {buffer:null, playbackRate:{value:1}, connect(){}, start(){}, stop(){}, disconnect(){}, onended:null}; }
}
Object.defineProperty(globalThis,'AudioContext',{value:FakeContext,configurable:true});
const buffer = {duration:10,getChannelData:()=>new Float32Array(1000)};
test('seeking or pausing during decoding does not strand audio in loading state', async () => { const audio=new EditorAudio(); const loading=audio.load(new ArrayBuffer(10)); await audio.seek(1000); audio.pause(); pending.shift()!(buffer); assert.equal(await loading,true); assert.equal(audio.loaded,true); assert.equal(audio.durationMs,10000); });
test('new song load discards an older decode result', async () => { const audio=new EditorAudio(); const first=audio.load(new ArrayBuffer(1)); const second=audio.load(new ArrayBuffer(2)); pending.shift()!(buffer); assert.equal(await first,false); assert.equal(audio.loaded,false); pending.shift()!(buffer); assert.equal(await second,true); });
test('clear cancels unfinished load without restoring stale audio', async () => { const audio=new EditorAudio(); const loading=audio.load(new ArrayBuffer(1)); audio.clear(); pending.shift()!(buffer); assert.equal(await loading,false); assert.equal(audio.loaded,false); });
test('seek clamps to audio bounds and playback rate does not change the chart position', async () => { const audio=new EditorAudio(); const loading=audio.load(new ArrayBuffer(1)); pending.shift()!(buffer); await loading; await audio.seek(999999); assert.equal(audio.now(),10000); await audio.seek(-1); assert.equal(audio.now(),0); await audio.seek(2345); await audio.setRate(.5); assert.equal(audio.now(),2345); assert.equal(audio.rate,.5); });
