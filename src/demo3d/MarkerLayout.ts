export interface LabelRect { left: number; top: number; width: number; height: number }
export interface MarkerLabel { id: string; x: number; y: number; width: number; height: number; priority: number }

function overlaps(a: LabelRect, b: LabelRect, gap: number) {
  return a.left < b.left + b.width + gap && a.left + a.width + gap > b.left
    && a.top < b.top + b.height + gap && a.top + a.height + gap > b.top;
}

/** Place higher-priority labels first, as close to their projected anchor as free space permits. */
export function layoutMarkerLabels(labels: readonly MarkerLabel[], bounds: LabelRect, blockers: readonly LabelRect[] = [], gap = 7) {
  const occupied = [...blockers], result = new Map<string, { x: number; y: number }>();
  for (const label of [...labels].sort((a, b) => a.priority - b.priority)) {
    const { width, height } = label;
    if (width > bounds.width || height > bounds.height || width <= 0 || height <= 0) continue;
    const clampX = (left: number) => Math.max(bounds.left, Math.min(bounds.left + bounds.width - width, left));
    const clampY = (top: number) => Math.max(bounds.top, Math.min(bounds.top + bounds.height - height, top));
    const left = clampX(label.x - width / 2), top = clampY(label.y - height);
    const original = { left, top, width, height };
    let chosen: LabelRect | undefined;
    if (!occupied.some(rect => overlaps(original, rect, gap))) chosen = original;
    else {
      // A nearest free rectangle touches a viewport or occupied-rectangle edge.
      const xs = new Set([left, bounds.left, bounds.left + bounds.width - width]);
      const ys = new Set([top, bounds.top, bounds.top + bounds.height - height]);
      for (const rect of occupied) {
        xs.add(clampX(rect.left - width - gap)); xs.add(clampX(rect.left + rect.width + gap));
        ys.add(clampY(rect.top - height - gap)); ys.add(clampY(rect.top + rect.height + gap));
      }
      let best = Infinity;
      for (const x of xs) for (const y of ys) {
        const candidate = { left: x, top: y, width, height };
        const score = (x - left) ** 2 * 1.3 + (y - top) ** 2;
        if (score < best && !occupied.some(rect => overlaps(candidate, rect, gap))) { chosen = candidate; best = score; }
      }
    }
    if (chosen) {
      occupied.push(chosen);
      result.set(label.id, { x: chosen.left + width / 2, y: chosen.top + height });
    }
  }
  return result;
}
