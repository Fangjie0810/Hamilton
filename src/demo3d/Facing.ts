import type { Point } from './Navigation';

/** Directions are relative to the screen: south faces the viewer. */
export const FACINGS = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'] as const;
export type Facing = typeof FACINGS[number];
export const ATLAS_COLUMNS = 8;
export const ATLAS_ROWS = 4;
const SECTOR = Math.PI / 4;
const TURN_MARGIN = Math.PI / 60;

export function screenFacing(direction: Point, cameraYaw: number, previous?: Facing): Facing {
  if (!Number.isFinite(direction.x + direction.z + cameraYaw) || Math.hypot(direction.x, direction.z) < .0001) return previous ?? 's';
  const right = direction.x * Math.cos(cameraYaw) - direction.z * Math.sin(cameraYaw);
  const down = direction.x * Math.sin(cameraYaw) + direction.z * Math.cos(cameraYaw);
  const angle = Math.atan2(right, down);
  if (previous) {
    const delta = angle - FACINGS.indexOf(previous) * SECTOR;
    // Small changes near a sector boundary must not flicker between two drawings.
    if (Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))) <= SECTOR / 2 + TURN_MARGIN) return previous;
  }
  return FACINGS[(Math.round(angle / SECTOR) + 8) % 8];
}

const frames: Record<Facing, { idle: number; walk: number; burr: number; flip: boolean }> = {
  s:  { idle: 12, walk: 0,  burr: 15, flip: false },
  se: { idle: 16, walk: 17, burr: 29, flip: false },
  e:  { idle: 14, walk: 8,  burr: 28, flip: false },
  ne: { idle: 21, walk: 22, burr: 27, flip: false },
  n:  { idle: 13, walk: 4,  burr: 26, flip: false },
  nw: { idle: 21, walk: 22, burr: 27, flip: true },
  w:  { idle: 14, walk: 8,  burr: 28, flip: true },
  sw: { idle: 16, walk: 17, burr: 29, flip: true },
};

export function actorPose(facing: Facing, distance: number, moving: boolean, npc = false) {
  const pose = frames[facing];
  const phase = Math.floor((Number.isFinite(distance) ? Math.max(0, distance) : 0) / 1.6 * 4) % 4;
  return { frame: npc ? pose.burr : moving ? pose.walk + phase : pose.idle, flip: pose.flip };
}
