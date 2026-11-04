export const clamp = value => Math.max(0, Math.min(100, Number(value) || 0));
export function point(radius, degrees) {
  const angle = degrees * Math.PI / 180;
  return { x: 120 + radius * Math.cos(angle), y: 120 + radius * Math.sin(angle) };
}
export function sector(inner, outer, start, end) {
  if (outer <= inner) return '';
  const a = point(outer, start), b = point(outer, end), c = point(inner, end), d = point(inner, start);
  const large = end - start > 180 ? 1 : 0;
  return `M${a.x} ${a.y}A${outer} ${outer} 0 ${large} 1 ${b.x} ${b.y}L${c.x} ${c.y}A${inner} ${inner} 0 ${large} 0 ${d.x} ${d.y}Z`;
}
// Equal score changes add equal coloured area, always outward across the whole sector.
export const progressRadius = (value, inner = 52, outer = 108) => Math.sqrt(inner ** 2 + clamp(value) / 100 * (outer ** 2 - inner ** 2));
export const splitY = (rivalry, respect) => 120 + 26 * Math.tanh((clamp(rivalry) - clamp(respect)) / 14);
export const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
