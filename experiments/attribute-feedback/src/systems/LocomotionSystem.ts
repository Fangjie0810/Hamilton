export type Facing = -1 | 1;
export type LocomotionPose = 'idle' | 'start' | 'walk' | 'stop' | 'turn';
export const WALK_SPEED = 230;
export const WALK_STRIDE = 148;
const ACCELERATION = 1500;
const BRAKING = 1900;
const TURN_MS = 100;

/** Owns active movement time. The renderer only consumes the resulting pose. */
export class LocomotionSystem {
  velocity = 0;
  facing: Facing = 1;
  pose: LocomotionPose = 'idle';
  distance = 0;
  phase = 0;
  private transition = 0;
  private pendingFacing: Facing = 1;

  constructor(public x: number, readonly min: number, readonly max: number) {
    if (![x, min, max].every(Number.isFinite) || min > max) throw new RangeError('Invalid movement bounds.');
    this.x = Math.max(min, Math.min(max, x));
  }

  halt() {
    this.velocity = 0; this.transition = 0; this.pose = 'idle';
  }

  step(direction: number, deltaMs: number, target: number | null = null) {
    if (![direction, deltaMs].every(Number.isFinite) || target !== null && !Number.isFinite(target)) throw new RangeError('Invalid movement input.');
    const dtMs = Math.max(0, Math.min(50, deltaMs));
    if (!dtMs) return false;
    const dt = dtMs / 1000;
    const destination = target === null ? null : Math.max(this.min, Math.min(this.max, target));
    const remaining = destination === null ? null : destination - this.x;
    if (remaining !== null && Math.abs(remaining) <= 0.8) { this.x = destination!; this.halt(); return true; }
    let wanted = remaining === null ? Math.sign(direction) : Math.sign(remaining);
    if (this.x <= this.min && wanted < 0 || this.x >= this.max && wanted > 0) wanted = 0;

    // Brake before reversing; turn in place once the planted foot can carry the weight.
    if (this.pose === 'turn') {
      if (!wanted) { this.halt(); return false; }
      this.pendingFacing = wanted as Facing;
      this.transition -= dtMs;
      if (this.transition <= 0) { this.facing = this.pendingFacing; this.pose = 'start'; this.transition = 80; }
      return false;
    }
    if (wanted && wanted !== this.facing && Math.abs(this.velocity) < 1) {
      this.velocity = 0; this.pendingFacing = wanted as Facing; this.pose = 'turn'; this.transition = TURN_MS; return false;
    }
    const reversing = wanted !== 0 && wanted !== this.facing;
    let desired = reversing ? 0 : wanted * WALK_SPEED;
    if (remaining !== null && !reversing) desired = Math.sign(remaining) * Math.min(WALK_SPEED, Math.sqrt(2 * BRAKING * Math.abs(remaining)));
    const previousVelocity = this.velocity;
    const accelerating = Math.abs(desired) > Math.abs(this.velocity);
    const limit = (accelerating ? ACCELERATION : BRAKING) * dt;
    this.velocity += Math.max(-limit, Math.min(limit, desired - this.velocity));
    const previousX = this.x;
    let nextX = this.x + (previousVelocity + this.velocity) * 0.5 * dt;
    const arrived = remaining !== null && Math.sign(remaining) * (destination! - nextX) <= 0;
    if (arrived) nextX = destination!;
    this.x = Math.max(this.min, Math.min(this.max, nextX));
    const moved = Math.abs(this.x - previousX);
    this.distance += moved;
    this.phase = (this.distance / WALK_STRIDE) % 1;
    if (arrived || this.x === this.min && this.velocity < 0 || this.x === this.max && this.velocity > 0) {
      this.halt(); return arrived;
    }
    if (moved > 0.001) {
      this.pose = !accelerating && Math.abs(this.velocity) < WALK_SPEED * 0.75 ? 'stop' : Math.abs(this.velocity) < WALK_SPEED * 0.6 ? 'start' : 'walk';
      this.transition = 80;
    } else if (this.transition > 0) { this.pose = 'stop'; this.transition -= dtMs; }
    else this.pose = 'idle';
    return false;
  }
}
