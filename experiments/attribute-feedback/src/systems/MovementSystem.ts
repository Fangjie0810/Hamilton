/** Delta is bounded so returning to an unfocused tab cannot teleport a player. */
export function movePosition(
  x: number,
  direction: number,
  deltaMs: number,
  min: number,
  max: number,
  speed = 270,
): number {
  if (![x, direction, deltaMs, min, max, speed].every(Number.isFinite)) {
    throw new RangeError('Movement inputs must be finite numbers.');
  }
  if (min > max || speed < 0) throw new RangeError('Invalid movement bounds or speed.');

  const movement = Math.max(-1, Math.min(1, direction));
  const elapsed = Math.max(0, Math.min(50, deltaMs)) / 1000;
  return Math.max(min, Math.min(max, x + movement * elapsed * speed));
}
