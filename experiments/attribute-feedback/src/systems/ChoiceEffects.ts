import { STAT_KEYS, type GameState, type StateEffect } from '../core/GameState';

/** Preview actual directions at the same 0–100 bounds, without committing a choice. */
export function effectDirections(effect: StateEffect, state: GameState) {
  return STAT_KEYS.flatMap(stat => {
    const delta = effect[stat];
    if (!delta) return [];
    const projected = Math.max(0, Math.min(100, state[stat] + delta));
    return [{ stat, direction: projected > state[stat] ? 'up' : projected < state[stat] ? 'down' : 'flat' }];
  });
}
