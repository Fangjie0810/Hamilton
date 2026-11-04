import type { ChapterId } from './types';

export const musicTracks = {
  alexanderHamilton: '/audio/bgm/alexander-hamilton.mp3',
  aaronBurr: '/audio/bgm/aaron-burr-sir.mp3',
  myShot: '/audio/bgm/my-shot.mp3',
  farmerRefuted: '/audio/bgm/farmer-refuted.mp3',
  cabinetBattle: '/audio/bgm/cabinet-battle-1.mp3',
  history: '/audio/bgm/history-has-its-eyes-on-you.mp3',
  yorktown: '/audio/bgm/yorktown.mp3',
} as const;
export type MusicTrack = keyof typeof musicTracks;
export const chapterMusic: Record<ChapterId, MusicTrack> = {
  Opening: 'alexanderHamilton', Arrival: 'aaronBurr', Tavern: 'myShot',
  Debate: 'farmerRefuted', Washington: 'history', Yorktown: 'yorktown',
};
