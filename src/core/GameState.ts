export const STAT_KEYS = [
  'momentum',
  'influence',
  'burrRivalry',
  'burrRespect',
  'washingtonTrust',
  'debatePerformance',
  'yorktownPerformance',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];
export type StateEffect = Partial<Record<StatKey, number>>;

export interface GameState {
  momentum: number;
  influence: number;
  burrRivalry: number;
  burrRespect: number;
  washingtonTrust: number;
  debatePerformance: number;
  yorktownPerformance: number;
  choices: Record<string, string>;
}

export function initialGameState(): GameState {
  return {
    momentum: 40,
    influence: 10,
    burrRivalry: 10,
    burrRespect: 20,
    washingtonTrust: 0,
    debatePerformance: 0,
    yorktownPerformance: 0,
    choices: {},
  };
}

export function cloneState(state: GameState): GameState {
  return { ...state, choices: { ...state.choices } };
}
