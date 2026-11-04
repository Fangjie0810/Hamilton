import { bi } from '../i18n/text';
import { MusicSystem } from '../systems/MusicSystem';
import { volumeSetting } from './volumeSetting';

function storage() { try { return globalThis.localStorage; } catch { return undefined; } }
export const music = new MusicSystem(() => new Audio(), storage());
export function musicSetting(id: string, className: string) {
  return volumeSetting(`${id}-volume`, className, bi('背景音乐音量', 'Music volume'), 'music', music);
}
if (typeof window !== 'undefined') {
  document.addEventListener('pointerdown', () => music.unlock(), { capture: true });
  document.addEventListener('keydown', () => music.unlock(), { capture: true });
  window.addEventListener('blur', () => music.setPaused('focus', true));
  window.addEventListener('focus', () => music.setPaused('focus', false));
  document.addEventListener('visibilitychange', () => music.setPaused('hidden', document.hidden));
  window.addEventListener('pagehide', () => music.stop(true));
  music.setPaused('hidden', document.hidden);
}
