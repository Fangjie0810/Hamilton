export const COMPASS_CENTER = 120;
export const COMPASS_INNER_RADIUS = 52;
export const COMPASS_OUTER_RADIUS = 108;

/** Complete adjacent sectors share their boundaries and touch the central disc. */
export const COMPASS_SECTORS = [
  { key: 'momentum', start: -150, end: -30 },
  { key: 'influence', start: -30, end: 90 },
  { key: 'washingtonTrust', start: 90, end: 210 },
] as const;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

/** Equal score changes add equal colored area across the entire sector, outward. */
export function compassProgressRadius(value: number, inner = COMPASS_INNER_RADIUS, outer = COMPASS_OUTER_RADIUS): number {
  return Math.sqrt(inner ** 2 + clamp(value) / 100 * (outer ** 2 - inner ** 2));
}

/** This expressive split is not a percentage; both independent scores stay visible. */
export function relationshipSplit(rivalry: number, respect: number): number {
  return COMPASS_CENTER + 26 * Math.tanh((clamp(rivalry) - clamp(respect)) / 14);
}

export function compassPoint(radius: number, degrees: number) {
  const angle = degrees * Math.PI / 180;
  return { x: COMPASS_CENTER + radius * Math.cos(angle), y: COMPASS_CENTER + radius * Math.sin(angle) };
}

export function compassSector(inner: number, outer: number, start: number, end: number): string {
  if (outer <= inner) return '';
  const a = compassPoint(outer, start), b = compassPoint(outer, end);
  const c = compassPoint(inner, end), d = compassPoint(inner, start);
  const large = end - start > 180 ? 1 : 0;
  return `M${a.x} ${a.y}A${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y}L${c.x} ${c.y}A${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y}Z`;
}
