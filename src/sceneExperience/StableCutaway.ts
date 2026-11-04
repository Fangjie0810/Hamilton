import * as THREE from 'three';

/** Solid world-space cuts: no screen-door noise, transparent sorting or frame-count sampling. */
export class StableCutaway {
  private originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private copies = new Set<THREE.Material>();
  private entries: { group: THREE.Group; box: THREE.Box3; plane: THREE.Plane; top: number; held: number }[];
  private ray = new THREE.Raycaster();
  private sampleIn = 0;
  constructor(groups: THREE.Group[]) {
    this.entries = [...new Set(groups)].map(group => {
      group.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(group), top = box.isEmpty() ? 20 : box.max.y + .15;
      const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), top);
      const clones = new Map<THREE.Material, THREE.Material>();
      group.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const prepare = (source: THREE.Material) => {
          let copy = clones.get(source);
          if (!copy) {
            copy = source.clone(); copy.clippingPlanes = [plane]; copy.clipShadows = true;
            // Opaque clipping avoids partial MSAA coverage fighting with the permanent wall cap.
            copy.alphaToCoverage = false; clones.set(source, copy); this.copies.add(copy);
          }
          return copy;
        };
        this.originals.set(object, object.material);
        object.material = Array.isArray(object.material) ? object.material.map(prepare) : prepare(object.material);
      });
      return { group, box, plane, top, held: 0 };
    });
  }
  update(camera: THREE.Camera, target: THREE.Vector3, dt: number, instant: boolean) {
    this.sampleIn -= dt;
    for (const entry of this.entries) entry.held = Math.max(0, entry.held - dt);
    if (this.sampleIn <= 0) {
      this.sampleIn = .04;
      for (const height of [.3, 1, 1.65]) {
        const destination = target.clone().add(new THREE.Vector3(0, height, 0));
        this.ray.set(camera.position, destination.clone().sub(camera.position).normalize());
        this.ray.far = camera.position.distanceTo(destination) - .55;
        for (const entry of this.entries) {
          if (!entry.group.visible || entry.group.userData.roomStructure || entry.group.userData.roomCutaway || !this.ray.ray.intersectsBox(entry.box)) continue;
          if (this.ray.intersectObject(entry.group, true).length) entry.held = .28;
        }
      }
    }
    for (const entry of this.entries) {
      const cut = entry.held > 0 || entry.group.userData.roomCutaway === true;
      const goal = cut ? .62 : entry.top;
      // Time-based, monotonic easing; clip shadows with the same plane as the wall.
      entry.plane.constant = THREE.MathUtils.lerp(entry.plane.constant, goal, instant ? 1 : 1 - Math.exp(-dt * 14));
      if (Math.abs(entry.plane.constant - goal) < .002) entry.plane.constant = goal;
    }
  }
  get count() { return this.entries.filter(entry => entry.plane.constant < entry.top - .1).length; }
  dispose() {
    this.originals.forEach((material, mesh) => { mesh.material = material; });
    this.copies.forEach(material => material.dispose()); this.copies.clear(); this.originals.clear(); this.entries = [];
  }
}
