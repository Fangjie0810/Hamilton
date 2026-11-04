import type { Chapter } from '../data/types';
import type { CastPlacement } from './StoryPlaces';
import type { Point, WalkMap } from '../demo3d/Navigation';

export function characterInteractions(chapter: Chapter, actor: CastPlacement) {
  return chapter.interactions.filter(item => item.character === actor.id || actor.interactionIds?.includes(item.id)
    || item.lines.some(line => line.speaker === actor.id)
    || item.variants?.some(variant => variant.lines.some(line => line.speaker === actor.id))
    || item.choice?.options.some(option => option.reply.some(line => line.speaker === actor.id)));
}

export function canSmallTalk(chapter: Chapter, actor: CastPlacement, completed: readonly string[]) {
  const interactions = characterInteractions(chapter, actor);
  return interactions.length > 0 && interactions.every(item => completed.includes(item.id));
}

/** Keep each person's optional marker near their body, away from solid NPC footprints. */
export function smallTalkPosition(actor: CastPlacement, standingPoint: Point, map: WalkMap): Point {
  const dx = standingPoint.x - actor.position.x, dz = standingPoint.z - actor.position.z;
  const length = Math.hypot(dx, dz);
  return map.nearest({ x: actor.position.x + (length ? dx / length : 0) * 1.05,
    z: actor.position.z + (length ? dz / length : 1) * 1.05 }) ?? standingPoint;
}
