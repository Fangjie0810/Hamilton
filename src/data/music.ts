import type { ChapterId } from './types';
import { bi, type BiText } from '../i18n/text';

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
// Song titles always use the original English names, including in Chinese UI modes.
export const musicTrackNames: Record<MusicTrack, BiText> = {
  alexanderHamilton: bi('Alexander Hamilton', 'Alexander Hamilton'),
  aaronBurr: bi('Aaron Burr, Sir', 'Aaron Burr, Sir'),
  myShot: bi('My Shot', 'My Shot'),
  farmerRefuted: bi('Farmer Refuted', 'Farmer Refuted'),
  cabinetBattle: bi('Cabinet Battle #1', 'Cabinet Battle #1'),
  history: bi('History Has Its Eyes on You', 'History Has Its Eyes on You'),
  yorktown: bi('Yorktown', 'Yorktown'),
};
// Start the title record at My Shot, retaining the existing cyclic track order.
export const titleMusicTracks: readonly MusicTrack[] = [
  'myShot', 'farmerRefuted', 'cabinetBattle', 'history', 'yorktown', 'alexanderHamilton', 'aaronBurr',
];
export const chapterMusic: Record<ChapterId, MusicTrack> = {
  Opening: 'alexanderHamilton', Arrival: 'aaronBurr', Tavern: 'myShot',
  Debate: 'farmerRefuted', Washington: 'history', Yorktown: 'yorktown',
};
