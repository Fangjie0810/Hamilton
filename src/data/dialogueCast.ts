import type { CharacterId, DialogueLine } from './types';

/** Every speaking role has a portrait, including the chronicler who represents narration. */
export const DIALOGUE_CAST = [
  'hamilton', 'burr', 'washington', 'laurens', 'lafayette', 'mulligan',
  'loyalist', 'newsboy', 'citizen', 'narrator',
] as const satisfies readonly CharacterId[];

/**
 * Keep the listener from this conversation, preferring an adjacent human reply over
 * an intervening narration line. Looking backwards first preserves the pair at a
 * speaker handover; the interaction character covers a one-line response.
 */
export function conversationPartner(lines: readonly DialogueLine[], index: number, fallback?: CharacterId): CharacterId {
  const position = Math.max(0, Math.min(lines.length - 1, Number.isFinite(index) ? Math.floor(index) : 0));
  const speaker = lines[position]?.speaker ?? fallback ?? 'hamilton';
  for (const includeNarrator of [false, true]) {
    for (let distance = 1; distance < lines.length; distance++) {
      for (const candidate of [lines[position - distance]?.speaker, lines[position + distance]?.speaker]) {
        if (candidate && candidate !== speaker && (includeNarrator || candidate !== 'narrator')) return candidate;
      }
    }
    if (fallback && fallback !== speaker && (includeNarrator || fallback !== 'narrator')) return fallback;
  }
  return speaker === 'hamilton' ? 'burr' : 'hamilton';
}
