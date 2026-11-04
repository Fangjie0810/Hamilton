export type BeatGrade = 'PERFECT' | 'GOOD' | 'MISS';
export const PERFECT_MS = 100;
export const GOOD_MS = 250;
export const BEAT_TARGET_MS = 1200;

export function judgeBeat(elapsed: number, target = BEAT_TARGET_MS): BeatGrade {
  if (!Number.isFinite(elapsed)) return 'MISS';
  const distance = Math.abs(elapsed - target);
  return distance <= PERFECT_MS ? 'PERFECT' : distance <= GOOD_MS ? 'GOOD' : 'MISS';
}
export const gradeValue = (grade: BeatGrade) => grade === 'PERFECT' ? 1 : grade === 'GOOD' ? 0.7 : 0;
export const clamp = (n: number, max = 100) => Math.max(0, Math.min(max, n));
// Scene updates use active time only. Discard suspended-frame gaps instead of skipping prompts.
export const activeDelta = (delta: number) => Number.isFinite(delta) ? clamp(delta, 100) : 0;
