/** A seekable audio clock: chart time is independent of rendering frame rate. */
export class EditorAudio {
  private context?: AudioContext; private gain?: GainNode; private source?: AudioBufferSourceNode;
  private buffer?: AudioBuffer; private startAt = 0; private startPosition = 0; private position = 0;
  private active = false; private generation = 0; private loadGeneration = 0; private volume = .7; private speed = 1;
  waveform: number[] = [];
  get loaded() { return !!this.buffer; }
  get playing() { return this.active; }
  get durationMs() { return Math.floor((this.buffer?.duration ?? 0) * 1000); }
  get rate() { return this.speed; }
  private init() {
    if (!this.context) { this.context = new AudioContext({latencyHint: 'interactive'}); this.gain = this.context.createGain(); this.gain.gain.value = this.volume; this.gain.connect(this.context.destination); }
    return this.context;
  }
  async load(data: ArrayBuffer) {
    this.clear(); const token = ++this.loadGeneration; const context = this.init();
    const decoded = await context.decodeAudioData(data.slice(0));
    if (token !== this.loadGeneration) return false;
    this.buffer = decoded; this.position = 0;
    const samples = decoded.getChannelData(0); const count = 3600; const stride = Math.max(1, Math.floor(samples.length / count));
    this.waveform = Array.from({length: count}, (_, index) => {
      let peak = 0; const start = index * stride; const end = Math.min(samples.length, start + stride);
      for (let i = start; i < end; i += 24) peak = Math.max(peak, Math.abs(samples[i])); return peak;
    });
    return true;
  }
  private outputTime() {
    const c = this.context; if (!c) return 0;
    const stamp = c.getOutputTimestamp?.();
    if (stamp?.contextTime && stamp.performanceTime) return Math.min(c.currentTime, stamp.contextTime + Math.max(0, performance.now() - stamp.performanceTime) / 1000);
    return Math.max(0, c.currentTime - (c.outputLatency || c.baseLatency || 0));
  }
  now() { return this.active ? Math.min(this.durationMs, Math.max(this.startPosition, this.startPosition + (this.outputTime() - this.startAt) * 1000 * this.speed)) : this.position; }
  async play() {
    if (!this.buffer) return;
    const c = this.init(); const token = ++this.generation; await c.resume();
    if (token !== this.generation || !this.buffer) return;
    if (this.position >= this.durationMs) this.position = 0;
    this.disconnect(); const source = c.createBufferSource(); source.buffer = this.buffer; source.playbackRate.value = this.speed; source.connect(this.gain!);
    this.startAt = c.currentTime + .015; this.startPosition = this.position; this.source = source;
    source.start(this.startAt, this.position / 1000); this.active = true;
  }
  pause() { this.position = this.now(); this.active = false; this.generation++; this.disconnect(); return this.position; }
  async seek(ms: number, keepPlaying = this.active) { this.pause(); this.position = Math.max(0, Math.min(this.durationMs || 3_600_000, ms)); if (keepPlaying) await this.play(); }
  async setRate(rate: number) { const playing = this.active; this.pause(); this.speed = Math.min(1.5, Math.max(.25, rate)); if (playing) await this.play(); }
  setVolume(value: number) { this.volume = Math.min(1, Math.max(0, value)); if (this.gain) this.gain.gain.value = this.volume; }
  clear() { this.loadGeneration++; this.pause(); this.buffer = undefined; this.waveform = []; this.position = 0; }
  private disconnect() { if (this.source) { this.source.onended = null; try { this.source.stop(); } catch { /* already stopped */ } this.source.disconnect(); this.source = undefined; } }
}

const DB_NAME = 'hamilton-rhythm-editor-audio-v1';
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, 1); request.onupgradeneeded = () => request.result.createObjectStore('audio'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
export async function cachedAudio(hash: string): Promise<ArrayBuffer | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => { const tx = db.transaction('audio'); const req = tx.objectStore('audio').get(hash); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); tx.oncomplete = () => db.close(); tx.onabort = () => { db.close(); reject(tx.error); }; });
}
export async function cacheAudio(hash: string, data: ArrayBuffer) {
  const db = await database();
  return new Promise<void>((resolve, reject) => { const tx = db.transaction('audio', 'readwrite'); tx.objectStore('audio').put(data, hash); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); }; });
}
