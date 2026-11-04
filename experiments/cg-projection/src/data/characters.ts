import { bi, f, cat, type Text, type BiText } from '../i18n/text';
import type { CharacterId } from './types';

export const characters: Record<CharacterId, { name: BiText; english: string; color: number; role: BiText }> = {
  hamilton: { name: bi("亚历山大·汉密尔顿", "Alexander Hamilton"), english: 'ALEXANDER HAMILTON', color: 0x668496, role: bi("写作者 · 寻找位置的人", "Writer · Searching for a place") },
  burr: { name: bi("阿伦·伯尔", "Aaron Burr"), english: 'AARON BURR', color: 0x99918a, role: bi("律师 · 谨慎的观察者", "Lawyer · A cautious observer") },
  washington: { name: bi("乔治·华盛顿", "George Washington"), english: 'GEORGE WASHINGTON', color: 0x485966, role: bi("大陆军总司令", "Commander of the Continental Army") },
  laurens: { name: bi("约翰·劳伦斯", "John Laurens"), english: 'JOHN LAURENS', color: 0xa78c62, role: bi("理想主义者", "Idealist") },
  lafayette: { name: bi("拉法耶特", "Marquis de Lafayette"), english: 'MARQUIS DE LAFAYETTE', color: 0x9aabac, role: bi("来自法国的志愿者", "A volunteer from France") },
  mulligan: { name: bi("赫拉克勒斯·穆利根", "Hercules Mulligan"), english: 'HERCULES MULLIGAN', color: 0x947763, role: bi("裁缝 · 街头的组织者", "Tailor · Organizer in the streets") },
  loyalist: { name: bi("保皇派撰稿人", "Loyalist Pamphleteer"), english: 'LOYALIST PAMPHLETEER', color: 0x955d50, role: bi("公开辩论者", "Public speaker") },
  newsboy: { name: bi("报童", "Newsboy"), english: 'NEWSBOY', color: 0xbcae89, role: bi("港口的消息", "News from the harbor") },
  citizen: { name: bi("纽约市民", "New York Citizen"), english: 'NEW YORK CITIZEN', color: 0x8b816f, role: bi("街头的声音", "A voice from the street") },
  narrator: { name: bi("旁白", "Narrator"), english: 'THE CHRONICLE', color: 0xd6c6a3, role: bi("纸页之间", "Between the pages") },
};
