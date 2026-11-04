import type { BiText } from '../../src/i18n/text';

/** Audio-buffer seconds, not wall-clock or animation-frame time. */
export interface ChartNote {
  id: string;
  time: number;
  lane: number;
  duration?: number;
}
export interface ChartSection {
  id: string;
  start: number;
  end: number;
  label: BiText;
  description: BiText;
}
export interface ChartDifficulty {
  notes: ChartNote[];
  label?: BiText;
  description?: BiText;
  [key: string]: unknown;
}
export interface Chart {
  id: string;
  title: string;
  artist: string;
  duration: number;
  bpm: number;
  offset: number;
  beats: number[];
  sections: ChartSection[];
  difficulties: { beginner: ChartDifficulty; normal: ChartDifficulty };
  analysis?: unknown;
  [key: string]: unknown;
}
export type NoteState = 'pending' | 'holding' | 'hit' | 'miss';
export type Judgement = 'perfect' | 'great' | 'good' | 'miss';
export interface JudgementEvent {
  /** Ghost presses have no corresponding note. */
  noteId?: string;
  lane: number;
  kind: Judgement | 'hold' | 'ghost';
  /** Input minus expected audio time, in seconds. Positive means late. */
  delta: number;
  time: number;
}
export interface RhythmStats {
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
  ghost: number;
  /** 0..100; zero until at least one note is judged. */
  accuracy: number;
  judged: number;
  total: number;
}
