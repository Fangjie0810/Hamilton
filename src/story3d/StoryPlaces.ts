import type { ChapterId } from '../data/types';
import type { SceneId } from '../demo3d/SceneCatalog';
import type { Point } from '../demo3d/Navigation';

export type CastId = 'burr' | 'newsboy' | 'citizen' | 'loyalist' | 'laurens' | 'lafayette' | 'mulligan' | 'washington';
export interface CastPlacement {
  id: CastId; position: Point; height?: number; direction?: Point; interactionIds?: string[];
  /** Before this conversation starts, face the partner and alternate authored gestures. */
  argument?: { interactionId: string; partnerId: CastId; phase: number };
}
export interface StoryPlace { scene: SceneId; spawn: Point; interactions: Record<string, Point>; exit: Point; cast: CastPlacement[] }

/** Standing points stay separate from solid NPC footprints and from raised props. */
export const STORY_PLACES: Record<ChapterId, StoryPlace> = {
  Opening: { scene: 'street', spawn: { x: 13, z: 5 }, interactions: { 'opening-letter': { x: 15.5, z: 5 } }, exit: { x: 9, z: 5 }, cast: [] },
  Arrival: {
    scene: 'street', spawn: { x: 8, z: 4 },
    interactions: { 'arrival-newspaper': { x: 3.7, z: -2.95 }, 'arrival-street': { x: -5.3, z: 5.45 }, 'arrival-burr': { x: -15.1, z: .6 } },
    exit: { x: -8, z: -2.2 },
    cast: [
      { id: 'newsboy', position: { x: 3.55, z: -4.25 } },
      { id: 'loyalist', position: { x: -6.25, z: 6.15 }, interactionIds: ['arrival-street'], argument: { interactionId: 'arrival-street', partnerId: 'citizen', phase: 0 } },
      { id: 'citizen', position: { x: -4.5, z: 6.15 }, interactionIds: ['arrival-street'], argument: { interactionId: 'arrival-street', partnerId: 'loyalist', phase: .8 } },
      { id: 'burr', position: { x: -16, z: -.3 } },
    ],
  },
  Tavern: {
    scene: 'tavern', spawn: { x: 0, z: 6 },
    // The lower-right table is at (5, 2); stand in front of its near bench at z = 3.3.
    interactions: { 'tavern-laurens': { x: 0, z: -.2 }, 'tavern-lafayette': { x: 3.55, z: 5.1 }, 'tavern-mulligan': { x: 2, z: -4.7 } },
    exit: { x: 8, z: 6 },
    cast: [{ id: 'laurens', position: { x: .8, z: -.8 } }, { id: 'lafayette', position: { x: 5.25, z: 4.35 }, direction: { x: -.7, z: 1 } }, { id: 'mulligan', position: { x: 3.5, z: -4.5 } }],
  },
  Debate: {
    scene: 'square', spawn: { x: 0, z: 10 }, interactions: { 'debate-loyalist': { x: 5, z: -2.2 } }, exit: { x: 12, z: 10 },
    cast: [
      { id: 'loyalist', position: { x: 3.4, z: -4.05 }, height: .79, argument: { interactionId: 'debate-loyalist', partnerId: 'citizen', phase: 0 } },
      { id: 'citizen', position: { x: 6.05, z: -2.15 }, interactionIds: ['debate-loyalist'], argument: { interactionId: 'debate-loyalist', partnerId: 'loyalist', phase: .8 } },
      // The fountain is centered at (-5, -3), with a two-unit basin radius.
      { id: 'burr', position: { x: -1.7, z: -3 }, interactionIds: ['debate-loyalist'] },
    ],
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

/** Optional standing points are independent of the required chapter interactions. */
export const DISCOVERY_PLACES: Record<string, Point> = {
  'letter-name': { x: 15.3, z: 6.3 },
  'arrival-scattered-paper': { x: 3.7, z: -2.95 },
  'arrival-burr-margin': { x: -16, z: 1.95 },
  'tavern-unfinished-draft': { x: -4.2, z: 6.7 },
  // Stand alongside the left-hand stall; the bill itself rests on its counter.
  'square-bread-and-prices': { x: -8.5, z: 4 },
  'camp-misfiled-dispatch': { x: -10.3, z: 2.3 },
  'burr-respect': { x: -.7, z: -1.6 },
  'burr-rivalry': { x: -2.1, z: -1.6 },
};

/** Props can sit on furniture while the player stands on nearby walkable ground. */
export const DISCOVERY_PROPS: Record<string, { position: Point; height: number }> = {
  'arrival-burr-margin': { position: { x: -16, z: 3 }, height: .6 },
  'square-bread-and-prices': { position: { x: -9.9, z: 5.04 }, height: 1.12 },
};
export const NEWSPAPER_PICKUP_PLACE: Point = { x: -11, z: -12.5 };
