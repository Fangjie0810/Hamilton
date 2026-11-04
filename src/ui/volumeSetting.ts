import { setText, type BiText } from '../i18n/text';
import './volume-setting.css';

export function volumeSetting(id: string, className: string, label: BiText, channel: string,
  audio: { readonly volume: number; setVolume(value: number): void }) {
  const row = document.createElement('label'); row.className = `${className} audio-volume-setting`; row.htmlFor = id;
  const title = document.createElement('span'); setText(title, label);
  const control = document.createElement('span'); control.className = 'audio-volume-control';
  const input = document.createElement('input'); input.type = 'range'; input.id = id;
  input.min = '0'; input.max = '100'; input.step = '1'; input.value = String(Math.round(audio.volume * 100));
  input.dataset.volumeChannel = channel;
  const value = document.createElement('output'); value.htmlFor = id;
  const refresh = () => setText(value, `${input.value}%`);
  input.addEventListener('input', () => { audio.setVolume(Number(input.value) / 100); refresh(); });
  refresh(); control.append(input, value); row.append(title, control); return row;
}
