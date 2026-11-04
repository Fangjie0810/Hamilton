import * as THREE from 'three';
import type { Point } from './Navigation';
import { ATLAS_COLUMNS, ATLAS_ROWS, screenFacing, actorPose, type Facing } from './Facing';
export { loadPixelAtlas } from './PixelAtlas';

export class PixelActor {
  readonly root = new THREE.Group();
  readonly body: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  readonly texture: THREE.Texture;
  frame = -1;
  facing: Facing = 's';
  constructor(atlas: THREE.Texture, readonly npc = false) {
    this.texture = atlas.clone(); this.texture.needsUpdate = true;
    const geometry = new THREE.PlaneGeometry(1.5, 2);
    geometry.translate(0, .875, 0);
    const material = new THREE.MeshLambertMaterial({ map: this.texture, alphaTest: .5, side: THREE.DoubleSide, color: 0xffffff, emissive: 0xffffff, emissiveMap: this.texture, emissiveIntensity: .22 });
    this.body = new THREE.Mesh(geometry, material); this.body.castShadow = true; this.body.receiveShadow = true;
    this.body.customDepthMaterial = new THREE.MeshDepthMaterial({ map: this.texture, alphaTest: .5, depthPacking: THREE.RGBADepthPacking });
    this.root.add(this.body);
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
    const ctx = shadowCanvas.getContext('2d')!, fill = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    fill.addColorStop(0, 'rgba(25,30,20,0.5)'); fill.addColorStop(1, 'rgba(25,30,20,0)'); ctx.fillStyle = fill; ctx.fillRect(0, 0, 64, 64);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(.95, .7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .005; this.root.add(shadow);
    this.setFrame(npc ? 15 : 12);
  }
  setFrame(frame: number) {
    if (frame === this.frame) return;
    this.frame = frame; this.texture.offset.set((frame % ATLAS_COLUMNS) / ATLAS_COLUMNS, 1 - (Math.floor(frame / ATLAS_COLUMNS) + 1) / ATLAS_ROWS);
  }
  update(position: Point, direction: Point, distance: number, moving: boolean, cameraYaw: number, reduceMotion: boolean) {
    this.root.position.set(position.x, 0, position.z); this.body.rotation.y = cameraYaw;
    this.facing = screenFacing(direction, cameraYaw, this.facing);
    const pose = actorPose(this.facing, distance, moving && !reduceMotion, this.npc);
    this.body.scale.x = pose.flip ? -1 : 1;
    this.setFrame(pose.frame);
  }
}
