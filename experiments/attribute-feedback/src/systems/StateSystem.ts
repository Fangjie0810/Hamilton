import {
  cloneState,
  initialGameState,
  STAT_KEYS,
  type GameState,
  type StateEffect,
  type StatKey,
} from '../core/GameState';

export interface StateChange {
  stat: StatKey;
  delta: number;
  value: number;
}

export class StateSystem {
  private current: GameState = initialGameState();
  private checkpoints = new Map<string, GameState>();

  get state(): GameState {
    return cloneState(this.current);
  }

  apply(effect: StateEffect): StateChange[] {
    // Validate the whole effect first; malformed data must not partly apply.
    for (const stat of STAT_KEYS) {
      const delta = effect[stat];
      if (delta !== undefined && !Number.isFinite(delta)) {
        throw new RangeError(`Invalid effect for ${stat}: expected a finite number.`);
      }
    }

    const changes: StateChange[] = [];
    for (const stat of STAT_KEYS) {
      const delta = effect[stat];
      if (delta === undefined) continue;
      const previous = this.current[stat];
      const value = Math.max(0, Math.min(100, previous + delta));
      if (value === previous) continue;
      this.current[stat] = value;
      changes.push({ stat, delta: value - previous, value });
    }
    return changes;
  }

  choose(choiceId: string, optionId: string, effect: StateEffect): StateChange[] {
    if (Object.prototype.hasOwnProperty.call(this.current.choices, choiceId)) return [];
    const changes = this.apply(effect);
    this.current.choices = { ...this.current.choices, [choiceId]: optionId };
    return changes;
  }

  reset(): void {
    this.current = initialGameState();
    this.checkpoints.clear();
  }

  checkpoint(chapter: string): void {
    this.checkpoints.set(chapter, this.state);
  }

  restart(chapter: string): void {
    const checkpoint = this.checkpoints.get(chapter);
    if (!checkpoint) throw new Error(`No checkpoint exists for chapter ${chapter}.`);
    this.current = cloneState(checkpoint);
  }
}

export interface ResultStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const RESULT_STORAGE_KEY = 'project-hamilton:last-result:v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseResult(value: unknown): GameState | null {
  if (!isRecord(value) || !isRecord(value.choices)) return null;
  const state = initialGameState();
  for (const stat of STAT_KEYS) {
    const number = value[stat];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > 100) {
      return null;
    }
    state[stat] = number;
  }
  const choices = Object.entries(value.choices);
  if (choices.some(([, option]) => typeof option !== 'string')) return null;
  state.choices = Object.fromEntries(choices) as Record<string, string>;
  return state;
}

/** Persist only a completed run. Call from Ending; never from chapter updates. */
export function saveResult(storage: ResultStorage | undefined, state: GameState): boolean {
  if (!storage) return false;
  try {
    const result = parseResult(state);
    if (!result) return false;
    storage.setItem(RESULT_STORAGE_KEY, JSON.stringify({ completed: true, result }));
    return true;
  } catch {
    // Privacy settings and storage quotas must not prevent reaching the ending.
    return false;
  }
}

/** A previous result is for display only. StateSystem always starts a fresh run. */
export function loadResult(storage: ResultStorage | undefined): GameState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(RESULT_STORAGE_KEY);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    if (!isRecord(saved) || saved.completed !== true) return null;
    return parseResult(saved.result);
  } catch {
    return null;
  }
}
