export interface Point { x: number; z: number }
export interface Obstacle { x: number; z: number; width: number; depth: number }
export const PLAYER_RADIUS = 0.28;

export class WalkMap {
  readonly step = 0.5;
  constructor(readonly bounds: Obstacle, readonly obstacles: Obstacle[]) {}
  free(p: Point, radius = PLAYER_RADIUS) {
    const b = this.bounds;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z) || Math.abs(p.x - b.x) > b.width / 2 - radius || Math.abs(p.z - b.z) > b.depth / 2 - radius) return false;
    return !this.obstacles.some(o => {
      const dx = Math.max(0, Math.abs(p.x - o.x) - o.width / 2), dz = Math.max(0, Math.abs(p.z - o.z) - o.depth / 2);
      return dx * dx + dz * dz < radius * radius;
    });
  }
  clear(a: Point, b: Point) {
    const count = Math.max(1, Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / 0.12));
    for (let i = 0; i <= count; i++) if (!this.free({ x: a.x + (b.x - a.x) * i / count, z: a.z + (b.z - a.z) * i / count })) return false;
    return true;
  }
  nearest(p: Point): Point | null {
    if (this.free(p)) return { ...p };
    const b = this.bounds;
    const base = { x: Math.max(b.x - b.width / 2 + .4, Math.min(b.x + b.width / 2 - .4, p.x)), z: Math.max(b.z - b.depth / 2 + .4, Math.min(b.z + b.depth / 2 - .4, p.z)) };
    for (let r = 0; r <= 3; r += .25) for (let i = 0; i < 24; i++) {
      const candidate = { x: base.x + Math.cos(i / 24 * Math.PI * 2) * r, z: base.z + Math.sin(i / 24 * Math.PI * 2) * r };
      if (this.free(candidate)) return candidate;
    }
    return null;
  }
  path(start: Point, requested: Point): Point[] {
    const goal = this.nearest(requested);
    if (!goal || !this.free(start)) return [];
    if (this.clear(start, goal)) return [goal];
    const toCell = (p: Point) => ({ x: Math.round(p.x / this.step), z: Math.round(p.z / this.step) });
    const toPoint = (p: Point) => ({ x: p.x * this.step, z: p.z * this.step });
    const key = (p: Point) => `${p.x},${p.z}`;
    const initial = toCell(start), end = toCell(goal);
    type Node = Point & { cost: number; estimate: number; parent?: Node };
    const open: Node[] = [{ ...initial, cost: 0, estimate: 0 }];
    const costs = new Map<string, number>([[key(initial), 0]]);
    let found: Node | undefined;
    for (let count = 0; open.length && count < 9000; count++) {
      let best = 0;
      for (let i = 1; i < open.length; i++) if (open[i].estimate < open[best].estimate) best = i;
      const current = open.splice(best, 1)[0];
      if (current.cost > costs.get(key(current))!) continue;
      if (Math.hypot(current.x - end.x, current.z - end.z) <= 1.5 && this.clear(toPoint(current), goal)) { found = current; break; }
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const next = { x: current.x + dx, z: current.z + dz };
        const from = current.parent ? toPoint(current) : start;
        if (!this.clear(from, toPoint(next))) continue;
        const cost = current.cost + Math.hypot(dx, dz);
        if (cost >= (costs.get(key(next)) ?? Infinity)) continue;
        costs.set(key(next), cost);
        open.push({ ...next, cost, estimate: cost + Math.hypot(next.x - end.x, next.z - end.z), parent: current });
      }
    }
    if (!found) return [];
    const points: Point[] = [goal];
    while (found.parent) { points.unshift(toPoint(found)); found = found.parent; }
    const simplified: Point[] = [];
    let anchor = start;
    while (points.length) {
      let furthest = points.length - 1;
      while (furthest > 0 && !this.clear(anchor, points[furthest])) furthest--;
      if (!this.clear(anchor, points[furthest])) return [];
      anchor = points[furthest]; simplified.push(anchor); points.splice(0, furthest + 1);
    }
    return simplified;
  }
}

export class Walker {
  velocity: Point = { x: 0, z: 0 };
  direction: Point = { x: 0, z: 1 };
  distance = 0;
  path: Point[] = [];
  moving = false;
  constructor(public position: Point, readonly map: WalkMap) {}
  halt() { this.velocity = { x: 0, z: 0 }; this.path = []; this.moving = false; }
  travel(target: Point) { this.path = this.map.path(this.position, target); return this.path.length > 0; }
  tick(input: Point, delta: number, fast = false) {
    const dt = Math.max(0, Math.min(.05, Number.isFinite(delta) ? delta : 0));
    if (!dt) return;
    let desired = { ...input }, speed = fast ? 4.5 : 2.8;
    if (Math.hypot(input.x, input.z) > 0.01) this.path = [];
    else if (this.path.length) {
      const target = this.path[0], distance = Math.hypot(target.x - this.position.x, target.z - this.position.z);
      if (distance < .12) {
        this.position = { ...target }; this.path.shift();
        if (!this.path.length) { this.halt(); return; }
      }
      const next = this.path[0];
      desired = { x: next.x - this.position.x, z: next.z - this.position.z };
      speed = Math.min(speed, Math.hypot(desired.x, desired.z) / dt);
    }
    const length = Math.hypot(desired.x, desired.z);
    if (length > 0) { desired.x /= length; desired.z /= length; }
    const blend = 1 - Math.exp(-(length > 0 ? 13 : 20) * dt);
    this.velocity.x += (desired.x * speed - this.velocity.x) * blend;
    this.velocity.z += (desired.z * speed - this.velocity.z) * blend;
    if (length === 0 && Math.hypot(this.velocity.x, this.velocity.z) < .03) this.velocity = { x: 0, z: 0 };
    const before = { ...this.position };
    const nextX = { x: this.position.x + this.velocity.x * dt, z: this.position.z };
    if (this.map.free(nextX)) this.position.x = nextX.x; else this.velocity.x = 0;
    const nextZ = { x: this.position.x, z: this.position.z + this.velocity.z * dt };
    if (this.map.free(nextZ)) this.position.z = nextZ.z; else this.velocity.z = 0;
    const dx = this.position.x - before.x, dz = this.position.z - before.z, travelled = Math.hypot(dx, dz);
    this.moving = travelled > .0005;
    this.distance += travelled;
    if (this.moving) this.direction = { x: dx / travelled, z: dz / travelled };
    else if (this.path.length && length > 0) this.path = [];
  }
}
