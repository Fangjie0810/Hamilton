import {decodeDataUrl, type TrackId} from './model';
let bundle: Partial<Record<TrackId, string>> | undefined;
/** The portable HTML carries the same recordings inline, with no file fetches. */
export function bundledAudio(id: TrackId): ArrayBuffer | undefined {
  const node = document.getElementById('hamilton-bundled-audio');
  if (!node) return undefined;
  if (!bundle) bundle = JSON.parse(node.textContent || '{}') as Partial<Record<TrackId, string>>;
  const value = bundle[id];
  return typeof value === 'string' ? decodeDataUrl(value) : undefined;
}
