import type { BiText, Text } from '../i18n/text';
import type { GameState, StateEffect } from '../core/GameState';

export type ChapterId = 'Opening' | 'Arrival' | 'Tavern' | 'Debate' | 'Washington' | 'Yorktown';
export type CharacterId = 'hamilton' | 'burr' | 'washington' | 'laurens' | 'lafayette' | 'mulligan' | 'loyalist' | 'newsboy' | 'citizen' | 'narrator';
export interface DialogueLine { speaker: CharacterId; text: BiText }
export interface ChoiceOption {
  id: string;
  text: BiText;
  hint?: BiText;
  effect: StateEffect;
  reply: DialogueLine[];
  requires?: { stat: 'momentum' | 'influence' | 'burrRespect'; min: number };
}
export interface Interaction {
  id: string;
  label: BiText;
  character: CharacterId;
  x: number;
  lines: DialogueLine[];
  variants?: { stat: keyof Omit<GameState, 'choices'>; min: number; lines: DialogueLine[] }[];
  choice?: { id: string; prompt: BiText; options: ChoiceOption[] };
  effect?: StateEffect;
  activity?: 'debate' | 'writing' | 'yorktown';
}
export interface Chapter {
  id: ChapterId;
  act: BiText;
  title: BiText;
  place: BiText;
  year: Text;
  subtitle: BiText;
  objective: BiText;
  width: number;
  interactions: Interaction[];
  interactionOrder?: 'free';
  exitLabel: BiText;
  next: ChapterId | 'Ending';
  prototypeNote?: BiText;
}
