import type { Point } from '../demo3d/Navigation';

interface MarkerTarget { position: Point; complete: boolean; exit: boolean }

/** A shared standing point belongs to its first unfinished story beat. */
export function storyMarkerTargets<T extends MarkerTarget>(targets: T[]): T[] {
  const pending = targets.filter(target => !target.complete);
  return pending.filter((target, index) => target.exit || !pending.slice(0, index).some(previous =>
    !previous.exit && previous.position.x === target.position.x && previous.position.z === target.position.z));
}
