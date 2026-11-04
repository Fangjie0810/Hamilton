import catalog from '../data/voiceover-catalog.json';
import { bi, setText } from '../i18n/text';
import { VoiceoverSystem } from '../systems/VoiceoverSystem';

function storage() { try { return globalThis.localStorage; } catch { return undefined; } }
export const voiceover = new VoiceoverSystem(catalog, () => new Audio(), storage());
export function voiceoverSetting(id: string, className: string) {
  const row = document.createElement('label'); row.className = className; row.htmlFor = id;
  const label = document.createElement('span'); setText(label, bi('角色与旁白配音（英文）', 'Character voices & narration (English)'));
  const input = document.createElement('input'); input.id = id; input.type = 'checkbox'; input.checked = voiceover.enabled;
  input.dataset.voiceoverToggle = ''; input.addEventListener('change', () => voiceover.setEnabled(input.checked));
  row.append(label, input); return row;
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
