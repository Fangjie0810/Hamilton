/** Shared review scale. These safety bounds preserve the previous 12–76 radius. */
export const REVIEW_ZOOM = { referenceRadius: 27, minRadius: 12, maxRadius: 76 } as const;
export function zoomPercent(radius: number) { return REVIEW_ZOOM.referenceRadius / radius * 100; }
export function zoomRadius(percent: number) {
  const radius = REVIEW_ZOOM.referenceRadius * 100 / (Number.isFinite(percent) && percent > 0 ? percent : 100);
  return Math.max(REVIEW_ZOOM.minRadius, Math.min(REVIEW_ZOOM.maxRadius, radius));
}
/** A dead band prevents floating-point/footstep noise from toggling the same boundary. */
export function withinDistance(distance: number, active: boolean, enter: number, leave: number) {
  return distance <= (active ? leave : enter);
}
