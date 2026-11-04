export const MIN_CAMERA_PITCH = .43;
export const MAX_CAMERA_PITCH = .98;

/** Both the scene's right drag and the visible orbit sphere use these deltas. */
export function orbitCamera(view: { yaw: number; pitch: number }, dx: number, dy: number) {
  return {
    yaw: view.yaw - dx * .006,
    pitch: Math.max(MIN_CAMERA_PITCH, Math.min(MAX_CAMERA_PITCH, view.pitch + dy * .004)),
  };
}
