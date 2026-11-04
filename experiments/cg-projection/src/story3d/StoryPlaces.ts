import type { ChapterId } from '../data/types';
import type { SceneId } from '../demo3d/SceneCatalog';
import type { Point } from '../demo3d/Navigation';

export type CastId = 'burr' | 'newsboy' | 'loyalist' | 'laurens' | 'lafayette' | 'mulligan' | 'washington';
export interface CastPlacement { id: CastId; position: Point; height?: number; direction?: Point; interactionIds?: string[] }
export interface StoryPlace { scene: SceneId; spawn: Point; interactions: Record<string, Point>; exit: Point; cast: CastPlacement[] }

/** Standing points stay separate from solid NPC footprints and from raised props. */
export const STORY_PLACES: Record<ChapterId, StoryPlace> = {
  Opening: { scene: 'street', spawn: { x: 13, z: 5 }, interactions: { 'opening-letter': { x: 15.5, z: 5 } }, exit: { x: 9, z: 5 }, cast: [] },
  Arrival: {
    scene: 'street', spawn: { x: 8, z: 4 },
    interactions: { 'arrival-newspaper': { x: 5.8, z: 3.3 }, 'arrival-street': { x: 0, z: 3.5 }, 'arrival-burr': { x: -2.4, z: 2.7 } },
    exit: { x: -8, z: -2.2 },
    cast: [{ id: 'newsboy', position: { x: 5.8, z: 2.2 } }, { id: 'loyalist', position: { x: 0, z: 2.3 }, interactionIds: ['arrival-street'] }, { id: 'burr', position: { x: -3.2, z: 1.5 } }],
  },
  Tavern: {
    scene: 'tavern', spawn: { x: 0, z: 6 },
    interactions: { 'tavern-laurens': { x: 0, z: -.2 }, 'tavern-lafayette': { x: 6, z: -4 }, 'tavern-mulligan': { x: 2, z: -4.7 } },
    exit: { x: 8, z: 6 },
    cast: [{ id: 'laurens', position: { x: .8, z: -.8 } }, { id: 'lafayette', position: { x: 6.3, z: -5.1 } }, { id: 'mulligan', position: { x: 3.5, z: -4.5 } }],
  },
  Debate: {
    scene: 'square', spawn: { x: 0, z: 10 }, interactions: { 'debate-loyalist': { x: 5, z: -2.2 } }, exit: { x: 12, z: 10 },
    cast: [{ id: 'loyalist', position: { x: 5, z: -5.5 }, height: .79 }, { id: 'burr', position: { x: 7.3, z: -1.7 } }],
  },
  Washington: {
    scene: 'camp', spawn: { x: 0, z: 11 },
    interactions: { 'washington-offer': { x: -7, z: -3.3 }, 'washington-dispatch': { x: -7, z: -3.3 } }, exit: { x: 12, z: 10 },
    cast: [{ id: 'washington', position: { x: -8.9, z: -3.7 } }],
  },
  Yorktown: {
    scene: 'yorktown', spawn: { x: 0, z: 13 },
    interactions: { 'yorktown-command': { x: 0, z: 8 }, 'yorktown-surrender': { x: 0, z: -9 } }, exit: { x: 0, z: -12 },
    cast: [{ id: 'washington', position: { x: 1.3, z: 8.5 } }],
  },
};
