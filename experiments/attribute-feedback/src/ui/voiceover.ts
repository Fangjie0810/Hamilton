import catalog from '../data/voiceover-catalog.json';
import { bi } from '../i18n/text';
import { VoiceoverSystem } from '../systems/VoiceoverSystem';
import { volumeSetting } from './volumeSetting';

function storage() { try { return globalThis.localStorage; } catch { return undefined; } }
export const voiceover = new VoiceoverSystem(catalog, () => new Audio(), storage());
export function voiceoverSetting(id: string, className: string) {
  return volumeSetting(`${id}-volume`, className, bi('对白与旁白音量', 'Dialogue & narration volume'), 'voiceover', voiceover);
}
if (typeof window !== 'undefined') {
  document.addEventListener('pointerdown', () => voiceover.unlock(), { capture: true });
  document.addEventListener('keydown', () => voiceover.unlock(), { capture: true });
  window.addEventListener('blur', () => voiceover.setPaused('focus', true));
  window.addEventListener('focus', () => voiceover.setPaused('focus', false));
  document.addEventListener('visibilitychange', () => voiceover.setPaused('hidden', document.hidden));
  window.addEventListener('pagehide', () => voiceover.stop());
  voiceover.setPaused('hidden', document.hidden);
}
