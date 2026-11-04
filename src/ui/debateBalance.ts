/** Positive rotation points toward the right-hand Loyalist. */
export function crowdNeedleAngle(support: number): number {
  const bounded = Number.isFinite(support) ? Math.max(0, Math.min(100, support)) : 50;
  return (50 - bounded) * 1.2;
}
