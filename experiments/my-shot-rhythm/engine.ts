import type { ChartNote, Judgement, JudgementEvent, NoteState, RhythmStats } from './types';

export const WINDOWS = Object.freeze({ perfect: 0.045, great: 0.09, good: 0.14, holdRelease: 0.1 });
const EPSILON = 1e-9;
const VALUE: Record<Judgement, number> = { perfect: 1, great: 0.8, good: 0.5, miss: 0 };

/**
 * Pure judgement state, driven exclusively by an audio clock supplied by the caller.
 * All emitted events are also queued for drainEvents(); consume either the return
 * values or that queue, not both. Browser key repeat must not become extra hits.
 */
export class RhythmJudge {
  readonly notes: readonly ChartNote[];
  readonly state = new Map<string, NoteState>();
  private readonly byLane: ChartNote[][] = [[], [], [], []];
  private readonly pressed = new Set<number>();
  private readonly holds = new Map<number, { note: ChartNote; head: Judgement; delta: number }>();
  private readonly events: JudgementEvent[] = [];
  private readonly counts = { perfect: 0, great: 0, good: 0, miss: 0, ghost: 0 };
  private points = 0;
  private combo = 0;
  private maxCombo = 0;
  private nextExpiration = 0;
  private finished = false;
  private lastTime = 0;

  constructor(notes: readonly ChartNote[], range: { start?: number; end?: number } = {}) {
    const start = range.start ?? 0;
    const end = range.end ?? Infinity;
    if (!Number.isFinite(start) || Number.isNaN(end) || end < start) throw new Error('Invalid chart range');
    const ids = new Set<string>();
    for (const note of notes) {
      if (!note.id || ids.has(note.id) || !Number.isFinite(note.time) || note.time < 0 ||
          !Number.isInteger(note.lane) || note.lane < 0 || note.lane > 3 ||
          (note.duration !== undefined && (!Number.isFinite(note.duration) || note.duration < 0))) {
        throw new Error('Invalid or duplicate chart note');
      }
      ids.add(note.id);
    }
    this.notes = notes.filter(note => note.time >= start - EPSILON && note.time + (note.duration ?? 0) <= end + EPSILON)
      .map(note => ({ ...note }))
      .sort((a, b) => a.time - b.time || a.lane - b.lane);
    for (const note of this.notes) {
      this.state.set(note.id, 'pending');
      this.byLane[note.lane].push(note);
    }
    this.lastTime = start;
  }

  get stats(): RhythmStats {
    const { perfect, great, good, miss, ghost } = this.counts;
    const judged = perfect + great + good + miss;
    // Invalid presses cost a quarter note, preventing four-key mashing from
    // producing a perfect result even when it happens to hit the real lane.
    const earned = Math.max(0, this.points - ghost * 0.25);
    return {
      ...this.counts,
      score: this.notes.length ? Math.round(earned / this.notes.length * 1_000_000) : 0,
      combo: this.combo,
      maxCombo: this.maxCombo,
      accuracy: judged ? earned / judged * 100 : 0,
      judged,
      total: this.notes.length,
    };
  }

  /** Negative times are allowed for a pre-roll; no notes expire before zero. */
  update(songTime: number): JudgementEvent[] {
    if (!Number.isFinite(songTime) || this.finished) return [];
    this.lastTime = songTime;
    const due: { note: ChartNote; kind: Judgement; delta: number; time: number }[] = [];
    for (const [lane, hold] of this.holds) {
      const end = hold.note.time + (hold.note.duration ?? 0);
      if (songTime + EPSILON >= end) {
        this.holds.delete(lane);
        due.push({ note: hold.note, kind: hold.head, delta: hold.delta, time: end });
      }
    }
    // A cursor processes every expired note even if a frame is delayed badly.
    while (this.nextExpiration < this.notes.length) {
      const note = this.notes[this.nextExpiration];
      if (songTime - note.time <= WINDOWS.good + EPSILON) break;
      this.nextExpiration++;
      if (this.state.get(note.id) === 'pending') {
        due.push({ note, kind: 'miss', delta: songTime - note.time, time: note.time + WINDOWS.good });
      }
    }
    // Resolve by musical time, so a dropped frame cannot reorder combo events.
    return due.sort((a, b) => a.time - b.time || a.note.lane - b.note.lane)
      .map(event => this.resolve(event.note, event.kind, event.delta, event.time));
  }

  press(lane: number, songTime: number): JudgementEvent | null {
    if (this.finished || !Number.isFinite(songTime) || !this.byLane[lane] || this.pressed.has(lane)) return null;
    this.update(songTime);
    this.pressed.add(lane);
    const note = this.byLane[lane].find(candidate => this.state.get(candidate.id) === 'pending' &&
      Math.abs(songTime - candidate.time) <= WINDOWS.good + EPSILON);
    if (!note) {
      this.counts.ghost++;
      this.combo = 0;
      return this.emit({ lane, kind: 'ghost', delta: 0, time: songTime });
    }
    const delta = songTime - note.time;
    const absolute = Math.abs(delta);
    const kind: Judgement = absolute <= WINDOWS.perfect + EPSILON ? 'perfect' :
      absolute <= WINDOWS.great + EPSILON ? 'great' : 'good';
    if ((note.duration ?? 0) > 0) {
      this.state.set(note.id, 'holding');
      this.holds.set(lane, { note, head: kind, delta });
      return this.emit({ noteId: note.id, lane, kind: 'hold', delta, time: songTime });
    }
    return this.resolve(note, kind, delta, songTime);
  }

  release(lane: number, songTime: number): JudgementEvent | null {
    if (this.finished || !Number.isFinite(songTime) || !this.byLane[lane]) return null;
    this.update(songTime);
    this.pressed.delete(lane);
    const hold = this.holds.get(lane);
    if (!hold) return null;
    this.holds.delete(lane);
    const tailDelta = songTime - hold.note.time - (hold.note.duration ?? 0);
    return this.resolve(hold.note, tailDelta >= -WINDOWS.holdRelease - EPSILON ? hold.head : 'miss', hold.delta, songTime);
  }

  /** For an interrupted physical input (blur etc.); freeze time before calling. */
  clearPressed(songTime = this.lastTime): JudgementEvent[] {
    const before = this.events.length;
    for (const lane of [...this.pressed]) this.release(lane, songTime);
    return this.events.slice(before);
  }

  /** Idempotently mark every unresolved note missed at the end of a run. */
  finish(songTime = this.lastTime): JudgementEvent[] {
    if (this.finished) return [];
    const emitted = this.update(songTime);
    for (const note of this.notes) {
      const state = this.state.get(note.id);
      if (state === 'pending' || state === 'holding') emitted.push(this.resolve(note, 'miss', songTime - note.time, songTime));
    }
    this.holds.clear();
    this.pressed.clear();
    this.finished = true;
    return emitted;
  }

  drainEvents(): JudgementEvent[] { return this.events.splice(0); }

  private resolve(note: ChartNote, kind: Judgement, delta: number, time: number): JudgementEvent {
    this.state.set(note.id, kind === 'miss' ? 'miss' : 'hit');
    this.counts[kind]++;
    this.points += VALUE[kind];
    if (kind === 'miss') this.combo = 0;
    else {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    }
    return this.emit({ noteId: note.id, lane: note.lane, kind, delta, time });
  }

  private emit(event: JudgementEvent): JudgementEvent { this.events.push(event); return event; }
}
