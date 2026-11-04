/** User-approved review range: 100% (far) through 140% (near). */
export const REVIEW_ZOOM = { referenceRadius: 27, minPercent: 100, maxPercent: 140, minRadius: 27 / 1.4, maxRadius: 27 } as const;
export function clampZoomRadius(radius: number) {
  return Math.max(REVIEW_ZOOM.minRadius, Math.min(REVIEW_ZOOM.maxRadius, Number.isFinite(radius) ? radius : REVIEW_ZOOM.referenceRadius));
}
export function zoomPercent(radius: number) { return REVIEW_ZOOM.referenceRadius / radius * 100; }
export function zoomRadius(percent: number) {
  const radius = REVIEW_ZOOM.referenceRadius * 100 / (Number.isFinite(percent) && percent > 0 ? percent : 100);
  return clampZoomRadius(radius);
}
/** A dead band prevents floating-point/footstep noise from toggling the same boundary. */
export function withinDistance(distance: number, active: boolean, enter: number, leave: number) {
  return distance <= (active ? leave : enter);
}
