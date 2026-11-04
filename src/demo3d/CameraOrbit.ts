export const MIN_CAMERA_PITCH = .43;
export const MAX_CAMERA_PITCH = .98;
export const HIGH_ANGLE_CAMERA_PITCH = MIN_CAMERA_PITCH + (MAX_CAMERA_PITCH - MIN_CAMERA_PITCH) * .7;

/** The upper 30% of the controllable elevation uses authored overhead sprites. */
export function usesHighAngleArt(pitch: number) { return pitch >= HIGH_ANGLE_CAMERA_PITCH; }

/** Both the scene's right drag and the visible orbit sphere use these deltas. */
export function orbitCamera(view: { yaw: number; pitch: number }, dx: number, dy: number) {
  return {
    yaw: view.yaw - dx * .006,
    pitch: Math.max(MIN_CAMERA_PITCH, Math.min(MAX_CAMERA_PITCH, view.pitch + dy * .004)),
  };
}
