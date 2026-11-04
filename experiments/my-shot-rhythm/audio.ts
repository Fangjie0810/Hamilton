/** Audio-device-aligned transport. Song positions and chart times are seconds. */
export class AudioTransport {
  private context?: AudioContext;
  private master?: GainNode;
  private analyser?: AnalyserNode;
  private buffer?: AudioBuffer;
  private source?: AudioBufferSourceNode;
  private sourceEnded = false;
  private active = false;
  private frozen = 0;
  private sourceOffset = 0;
  private sourceStart = 0;
  private lastClock = 0;
  private holdClockDuringCountIn = false;
  private generation = 0;
  private loadGeneration = 0;
  private loading?: { url: string; promise: Promise<void>; abort: AbortController };
  private loadedUrl?: string;
  private volume = 0.75;
  private guide = false;
  private countInEnabled = true;
  private beats: number[] = [];
  private beatIndex = 0;
  private clicks = new Map<OscillatorNode, 'guide' | 'count-in'>();
  private energy = 0;
  private energyTime = 0;
  private energyData?: Uint8Array<ArrayBuffer>;
  private waveforms = new Map<number, number[]>();

  get loaded(): boolean { return !!this.buffer; }
  get duration(): number { return this.buffer?.duration ?? 0; }
  /** Includes the count-in. Pause, stop and natural completion make this false. */
  get running(): boolean { return this.active; }
  get countInRemaining(): number {
    return this.active ? Math.max(0, this.sourceStart - this.outputTime()) : 0;
  }

  private ensureContext(): AudioContext {
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.connect(this.master);
      this.energyData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    }
    return this.context;
  }

  /** Call from a user gesture. Creation/resume happen before the first await. */
  load(url: string): Promise<void> {
    const context = this.ensureContext();
    const transportGeneration = this.generation;
    const unlock = context.resume();
    // Some browser policies can reject resume even when fetch/decode can proceed.
    // start() retries resume from its own user gesture and propagates that error.
    void unlock.catch(() => undefined);
    if (this.loadedUrl === url && this.buffer) return Promise.resolve();
    if (this.loading?.url === url) return this.loading.promise;
    this.loading?.abort.abort();
    const abort = new AbortController();
    const loadGeneration = ++this.loadGeneration;
    const promise = (async () => {
      const response = await fetch(url, { signal: abort.signal });
      if (!response.ok) throw new Error(`Audio fetch failed: ${response.status}`);
      const data = await response.arrayBuffer();
      const decoded = await context.decodeAudioData(data);
      if (loadGeneration !== this.loadGeneration) return;
      this.buffer = decoded;
      this.loadedUrl = url;
      this.waveforms.clear();
      if (transportGeneration === this.generation && context.state === 'suspended') {
        await context.resume();
      }
    })().finally(() => {
      if (this.loading?.abort === abort) this.loading = undefined;
    });
    this.loading = { url, promise, abort };
    return promise;
  }

  /** Start at songTime, with the chart clock traversing songTime-leadIn to songTime. */
  async start(songTime: number, leadInSeconds = 2): Promise<void> {
    await this.playAt(songTime, leadInSeconds, false);
  }

  /** Resume holds the chart clock still through its count-in; no note is skipped. */
  async resume(leadInSeconds = 1): Promise<void> {
    await this.playAt(this.frozen, leadInSeconds, true);
  }

  private async playAt(songTime: number, leadInSeconds: number, holdClock: boolean): Promise<void> {
    if (!this.buffer) throw new Error('Audio is not loaded');
    if (!Number.isFinite(songTime) || !Number.isFinite(leadInSeconds)) {
      throw new Error('Audio positions must be finite');
    }
    const context = this.ensureContext();
    const generation = ++this.generation;
    this.clearSources();
    this.active = false;
    this.frozen = Math.max(0, Math.min(this.duration, songTime));
    // Keep a valid buffer offset even if pause() happens while resume() awaits.
    this.sourceOffset = this.frozen;
    await context.resume();
    if (generation !== this.generation) return;
    if (this.frozen >= this.duration) return;

    const lead = Math.max(0, leadInSeconds);
    this.sourceStart = context.currentTime + Math.max(0.025, lead);
    this.holdClockDuringCountIn = holdClock;
    this.lastClock = holdClock ? this.frozen : this.frozen - lead;
    this.sourceEnded = false;
    this.energy = 0;
    const source = context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.analyser!);
    source.onended = () => {
      // Render completion precedes audible completion by the device latency.
      if (generation === this.generation && this.source === source) this.sourceEnded = true;
    };
    this.source = source;
    source.start(this.sourceStart, this.sourceOffset);
    this.active = true;
    this.beatIndex = this.lowerBeat(this.sourceOffset - 0.001);
    if (this.countInEnabled && lead > 0.1) this.scheduleCountIn();
    this.tick();
  }

  pause(): number {
    const duringCountIn = this.active && this.countInRemaining > 0;
    const position = duringCountIn ? this.sourceOffset : this.now();
    ++this.generation;
    this.frozen = Math.max(0, Math.min(this.duration, position));
    this.active = false;
    this.clearSources();
    this.energy = 0;
    return this.frozen;
  }

  stop(): void {
    ++this.generation;
    this.active = false;
    this.clearSources();
    this.frozen = 0;
    this.lastClock = 0;
    this.energy = 0;
  }

  now(): number {
    if (!this.active) return this.frozen;
    let position = this.sourceOffset + this.outputTime() - this.sourceStart;
    if (this.holdClockDuringCountIn) position = Math.max(this.sourceOffset, position);
    // Timestamp estimates can jitter slightly between browser callbacks.
    this.lastClock = Math.min(this.duration, Math.max(this.lastClock, position));
    return this.lastClock;
  }

  private outputTime(): number {
    const context = this.context;
    if (!context) return 0;
    if (context.state !== 'running') return context.currentTime;
    if (typeof context.getOutputTimestamp === 'function') {
      const stamp = context.getOutputTimestamp();
      const contextTime = stamp.contextTime ?? 0;
      const performanceTime = stamp.performanceTime ?? 0;
      const age = (performance.now() - performanceTime) / 1000;
      if (contextTime > 0 && performanceTime > 0 && age >= -0.02 && age < 0.5) {
        return Math.min(context.currentTime, contextTime + Math.max(0, age));
      }
    }
    const latency = Number.isFinite(context.outputLatency) ? context.outputLatency : context.baseLatency;
    return Math.max(0, context.currentTime - (Number.isFinite(latency) ? latency : 0));
  }

  setVolume(value: number): void {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.015);
    }
  }

  setGuide(enabled: boolean, beats: readonly number[]): void {
    this.guide = enabled;
    this.beats = [...beats].filter(Number.isFinite).sort((a, b) => a - b);
    // clear only guide clicks: changing this switch cannot cancel the count-in.
    this.clearClicks('guide');
    this.beatIndex = this.lowerBeat(this.active ? Math.max(this.sourceOffset, this.now() + 0.015) : this.frozen);
    this.tick();
  }

  setCountIn(enabled: boolean): void {
    this.countInEnabled = enabled;
    if (!enabled) this.clearClicks('count-in');
  }

  /** Call once per animation frame. Scheduling uses context time, not RAF time. */
  tick(): void {
    const context = this.context;
    if (!this.active || !context) return;
    if (this.sourceEnded && this.now() >= this.duration) {
      this.frozen = this.duration;
      this.active = false;
      this.clearSources();
      return;
    }
    if (!this.guide) return;
    const horizon = context.currentTime + 0.12;
    while (this.beatIndex < this.beats.length) {
      const beat = this.beats[this.beatIndex];
      const at = this.sourceStart + beat - this.sourceOffset;
      if (at > horizon) break;
      if (beat >= this.sourceOffset - 0.001 && at >= context.currentTime + 0.002) {
        this.click(at, this.beatIndex % 4 === 0, 'guide');
      }
      this.beatIndex++;
    }
  }

  private scheduleCountIn(): void {
    const context = this.context!;
    const index = this.lowerBeat(this.sourceOffset);
    const prior = this.beats[Math.max(0, index - 1)];
    const next = this.beats[Math.min(this.beats.length - 1, index)];
    const step = next > prior ? Math.max(0.25, Math.min(1.5, next - prior)) : 60 / 92;
    for (let at = this.sourceStart - step; at >= context.currentTime + 0.015; at -= step) {
      this.click(at, false, 'count-in');
    }
  }

  private click(at: number, accent: boolean, kind: 'guide' | 'count-in'): void {
    const context = this.context!;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = accent ? 1320 : 880;
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(kind === 'count-in' ? 0.12 : 0.075, at + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.055);
    oscillator.connect(envelope);
    envelope.connect(this.master!);
    this.clicks.set(oscillator, kind);
    oscillator.onended = () => {
      this.clicks.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(at);
    oscillator.stop(at + 0.06);
  }

  private lowerBeat(time: number): number {
    let lo = 0;
    let hi = this.beats.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.beats[mid] < time) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private clearClicks(kind?: 'guide' | 'count-in'): void {
    for (const [click, clickKind] of this.clicks) {
      if (kind && clickKind !== kind) continue;
      try { click.stop(); } catch { /* Already ended. */ }
      click.disconnect();
      this.clicks.delete(click);
    }
  }

  private clearSources(): void {
    if (this.source) {
      this.source.onended = null;
      try { this.source.stop(); } catch { /* Already ended. */ }
      this.source.disconnect();
      this.source = undefined;
    }
    this.clearClicks();
    this.sourceEnded = false;
  }

  /** Normalized and smoothed waveform energy; visual only, never a score clock. */
  getEnergy(): number {
    if (!this.active || !this.analyser || !this.energyData || this.countInRemaining > 0) return 0;
    this.analyser.getByteTimeDomainData(this.energyData);
    let sum = 0;
    for (const sample of this.energyData) sum += ((sample - 128) / 128) ** 2;
    const raw = Math.min(1, Math.sqrt(sum / this.energyData.length) * 4);
    const at = performance.now();
    const blend = Math.min(1, Math.max(0.08, (at - this.energyTime) / 100));
    this.energy += (raw - this.energy) * blend;
    this.energyTime = at;
    return this.energy;
  }

  /** RMS overview of the actual decoded recording, normalized to [0,1]. */
  waveform(samples = 180): number[] {
    const count = Number.isFinite(samples) ? Math.max(1, Math.min(2000, Math.floor(samples))) : 180;
    if (!this.buffer) return [];
    const cached = this.waveforms.get(count);
    if (cached) return [...cached];
    const channel = this.buffer.getChannelData(0);
    const bins: number[] = [];
    let peak = 0;
    for (let bin = 0; bin < count; bin++) {
      const from = Math.floor(bin * channel.length / count);
      const to = Math.floor((bin + 1) * channel.length / count);
      let sum = 0;
      // Striding retains the waveform envelope without iterating every PCM sample.
      const stride = Math.max(1, Math.floor((to - from) / 1500));
      let n = 0;
      for (let i = from; i < to; i += stride) { sum += channel[i] ** 2; n++; }
      const value = Math.sqrt(sum / Math.max(1, n));
      bins.push(value);
      peak = Math.max(peak, value);
    }
    const normalized = bins.map(value => peak > 0 ? value / peak : 0);
    this.waveforms.set(count, normalized);
    return [...normalized];
  }
}
