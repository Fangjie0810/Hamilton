import * as THREE from 'three';
import { WalkMap, type Obstacle } from './Navigation';

export interface SceneWorld {
  root: THREE.Group;
  map: WalkMap;
  occluders: THREE.Group[];
  update(time: number, reduceMotion: boolean, cameraYaw: number): void;
}

/** Shared scale, pixel textures and construction tools for the walkable dioramas. */
export class WorldKit implements SceneWorld {
  readonly root = new THREE.Group();
  readonly obstacles: Obstacle[] = [];
  readonly occluders: THREE.Group[] = [];
  map!: WalkMap;
  private cube = new THREE.BoxGeometry(1, 1, 1);
  private seed = 1776;
  protected flames: { mesh: THREE.Mesh; light: THREE.PointLight; phase: number }[] = [];
  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  material(color: number, grain = false, emissive = 0) {
    let map: THREE.CanvasTexture | undefined;
    if (grain) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 180; i++) { ctx.fillStyle = `rgba(20,15,8,${this.random() * .23})`; ctx.fillRect(Math.floor(this.random() * 32), Math.floor(this.random() * 32), 1 + Math.floor(this.random() * 3), 1); }
      map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
      map.magFilter = THREE.NearestFilter; map.minFilter = THREE.NearestMipmapNearestFilter;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
    }
    return new THREE.MeshLambertMaterial({ color, map: map ?? null, emissive, flatShading: true });
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, parent: THREE.Object3D = this.root) {
    const mesh = new THREE.Mesh(this.cube, material); mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  cylinder(x: number, y: number, z: number, top: number, bottom: number, height: number, material: THREE.Material, parent: THREE.Object3D = this.root, segments = 8) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  block(x: number, z: number, width: number, depth: number) { this.obstacles.push({ x, z, width, depth }); }
  /** An axis-aligned rail keeps the visual boundary and collision footprint together. */
  fence(x1: number, z1: number, x2: number, z2: number, material: THREE.Material) {
    const horizontal = z1 === z2, length = Math.hypot(x2 - x1, z2 - z1), sections = Math.ceil(length / 2.5);
    for (let i = 0; i <= sections; i++) {
      const t = i / sections;
      this.box(x1 + (x2 - x1) * t, .65, z1 + (z2 - z1) * t, .16, 1.3, .16, material);
    }
    for (const y of [.45, 1]) this.box((x1 + x2) / 2, y, (z1 + z2) / 2, horizontal ? length : .12, .11, horizontal ? .12 : length, material);
    this.block((x1 + x2) / 2, (z1 + z2) / 2, horizontal ? length + .2 : .2, horizontal ? .2 : length + .2);
  }
  group(cutaway = false) { const group = new THREE.Group(); this.root.add(group); if (cutaway) this.occluders.push(group); return group; }
  fire(x: number, z: number, y = .3, power = 12, parent: THREE.Object3D = this.root) {
    const mesh = this.cylinder(x, y, z, .04, .2, .55, this.material(0xffce6c, false, 0xf7a032), parent, 5);
    const light = new THREE.PointLight(0xffb45b, power, 9, 1.5); light.position.set(x, y + .5, z); parent.add(light);
    this.flames.push({ mesh, light, phase: this.random() * 6 });
  }
  finish(bounds: Obstacle) {
    this.map = new WalkMap(bounds, this.obstacles);
    // Batch only static boxes, preserving the cutaway group boundaries.
    const parents: THREE.Object3D[] = []; this.root.traverse(obj => { if (obj.children.length) parents.push(obj); });
    for (const parent of parents) {
      const batches = new Map<THREE.Material, THREE.Mesh[]>();
      for (const child of [...parent.children]) if (child instanceof THREE.Mesh && child.geometry === this.cube && !Array.isArray(child.material)) {
        const list = batches.get(child.material) ?? []; list.push(child); batches.set(child.material, list);
      }
      for (const [material, meshes] of batches) {
        if (meshes.length < 3) continue;
        const batch = new THREE.InstancedMesh(this.cube, material, meshes.length); batch.castShadow = batch.receiveShadow = true;
        meshes.forEach((mesh, i) => { mesh.updateMatrix(); batch.setMatrixAt(i, mesh.matrix); parent.remove(mesh); });
        batch.computeBoundingSphere(); parent.add(batch);
      }
    }
  }
  update(time: number, reduceMotion: boolean, _cameraYaw: number) {
    for (const flame of this.flames) {
      const flicker = reduceMotion ? 1 : 1 + Math.sin(time * 8 + flame.phase) * .08 + Math.sin(time * 13) * .04;
      flame.mesh.scale.y = flicker; flame.light.intensity = (flame.light.userData.base ??= flame.light.intensity) * flicker;
    }
  }
}

/** Call after restoring cutaway materials; each world owns its geometry and textures. */
export function disposeWorld(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(obj => {
    if (obj instanceof THREE.InstancedMesh) obj.dispose();
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
      geometries.add(obj.geometry);
      for (const material of [...(Array.isArray(obj.material) ? obj.material : [obj.material]), ...(obj instanceof THREE.Mesh ? [obj.customDepthMaterial, obj.customDistanceMaterial] : [])]) {
        if (!material) continue; materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    }
    if (obj instanceof THREE.Light) obj.dispose();
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}
