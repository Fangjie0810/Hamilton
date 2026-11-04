import { RELICS, type ExperienceId } from './data';

export const EXPERIENCE_STORAGE_KEY = 'project-hamilton:scene-experience:v1';
const known = new Set(RELICS.map(item => item.id));
export interface ReviewSnapshot { version: 1; enabled: boolean; collected: string[] }
export function parseReviewState(raw: string | null): ReviewSnapshot {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (value?.version === 1) return { version: 1, enabled: value.enabled !== false, collected: Array.isArray(value.collected) ? [...new Set<string>(value.collected.filter((id: unknown) => typeof id === 'string' && known.has(id)))] : [] };
  } catch { /* Private browsing and malformed saved data do not block exploration. */ }
  return { version: 1, enabled: true, collected: [] };
}
export class ReviewCollection {
  private value: ReviewSnapshot;
  constructor(private storage?: Pick<Storage, 'getItem' | 'setItem'>) {
    let raw = null; try { raw = storage?.getItem(EXPERIENCE_STORAGE_KEY) ?? null; } catch { /* In-memory fallback. */ }
    this.value = parseReviewState(raw);
  }
  get enabled() { return this.value.enabled; }
  has(id: string) { return this.value.collected.includes(id); }
  count(scene?: ExperienceId) { return RELICS.filter(item => (!scene || item.scene === scene) && this.has(item.id)).length; }
  snapshot(): ReviewSnapshot { return { ...this.value, collected: [...this.value.collected] }; }
  setEnabled(enabled: boolean) { this.value.enabled = enabled; this.persist(); }
  collect(id: string) {
    if (!this.enabled || !known.has(id) || this.has(id)) return false;
    this.value.collected.push(id); this.persist(); return true;
  }
  reset(scene: ExperienceId) { const ids = new Set(RELICS.filter(item => item.scene === scene).map(item => item.id)); this.value.collected = this.value.collected.filter(id => !ids.has(id)); this.persist(); }
  private persist() { try { this.storage?.setItem(EXPERIENCE_STORAGE_KEY, JSON.stringify(this.value)); } catch { /* Keep the current session usable. */ } }
}
