import * as THREE from 'three';
import { FACINGS, screenFacing, type Facing } from '../demo3d/Facing';
import type { Point } from '../demo3d/Navigation';

export const STORY_NPC_IDS = ['newsboy', 'loyalist', 'laurens', 'lafayette', 'mulligan', 'washington'] as const;
export type StoryNpcId = typeof STORY_NPC_IDS[number];

const COLUMNS = 5, ROWS = STORY_NPC_IDS.length;
const CELL_WIDTH = 96, CELL_HEIGHT = 128, FOOT_LINE = 120;
const DIRECTION_COLUMNS = [0, 1, 2, 3, 4, 3, 2, 1] as const;
const SOURCE_PATH = '/art/actors/story-cast-v1.png';

/** Find the authored magenta gutters, allowing small deviations from an exact grid. */
function boundaries(projection: Uint32Array, count: number) {
  const edges = [0], cell = projection.length / count;
  for (let index = 1; index < count; index++) {
    let start = -1, longest = 0, center = Math.round(index * cell);
    const low = Math.max(0, Math.floor(index * cell - cell * .36));
    const high = Math.min(projection.length, Math.ceil(index * cell + cell * .36));
    for (let pixel = low; pixel <= high; pixel++) {
      if (pixel < high && projection[pixel] < 3) { if (start < 0) start = pixel; }
      else if (start >= 0) {
        if (pixel - start > longest) { longest = pixel - start; center = Math.floor((start + pixel) / 2); }
        start = -1;
      }
    }
    edges.push(center);
  }
  edges.push(projection.length);
  return edges;
}

/** Prepare aligned transparent cells at runtime; retain the untouched generated source. */
export async function loadStoryNpcAtlas(): Promise<HTMLCanvasElement> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Story NPC atlas could not load: ${SOURCE_PATH}`));
    img.src = SOURCE_PATH;
  });
  const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
  const context = source.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height);
  const rows = new Uint32Array(source.height), columns = new Uint32Array(source.width);
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    const index = (y * source.width + x) * 4;
    const r = pixels.data[index], g = pixels.data[index + 1], b = pixels.data[index + 2];
    if (r > 100 && b > 100 && r - g > 50 && b - g > 50) pixels.data[index + 3] = 0;
    else if (pixels.data[index + 3] > 100) { rows[y]++; columns[x]++; }
  }
  context.putImageData(pixels, 0, 0);
  const xs = boundaries(columns, COLUMNS), ys = boundaries(rows, ROWS);
  const atlas = document.createElement('canvas'); atlas.width = CELL_WIDTH * COLUMNS; atlas.height = CELL_HEIGHT * ROWS;
  const output = atlas.getContext('2d')!; output.imageSmoothingEnabled = false;
  for (let row = 0; row < ROWS; row++) for (let column = 0; column < COLUMNS; column++) {
    let left = xs[column + 1], right = xs[column], top = ys[row + 1], bottom = ys[row];
    for (let y = ys[row]; y < ys[row + 1]; y++) for (let x = xs[column]; x < xs[column + 1]; x++) {
      if (pixels.data[(y * source.width + x) * 4 + 3] > 100) {
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    if (right <= left || bottom <= top) throw new Error(`Story NPC frame missing: ${row},${column}`);
    const bodyHeight = STORY_NPC_IDS[row] === 'newsboy' ? 98 : 112;
    const scale = Math.min(bodyHeight / (bottom - top + 1), (CELL_WIDTH - 8) / (right - left + 1));
    const width = Math.round((right - left + 1) * scale), height = Math.round((bottom - top + 1) * scale);
    output.drawImage(source, left, top, right - left + 1, bottom - top + 1,
      column * CELL_WIDTH + Math.round((CELL_WIDTH - width) / 2), row * CELL_HEIGHT + FOOT_LINE - height, width, height);
  }
  return atlas;
}

/** Eight-view stationary cast member, lit and grounded like the existing player. */
export class StoryNpc {
  readonly root = new THREE.Group();
  readonly body: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
  readonly texture: THREE.CanvasTexture;
  facing: Facing = 's';
  frame = -1;

  constructor(atlas: HTMLCanvasElement, readonly id: StoryNpcId) {
    this.root.name = `story-npc:${id}`;
    this.texture = new THREE.CanvasTexture(atlas); this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter; this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false; this.texture.repeat.set(1 / COLUMNS, 1 / ROWS);
    const geometry = new THREE.PlaneGeometry(1.5, 2); geometry.translate(0, .875, 0);
    const material = new THREE.MeshLambertMaterial({
      map: this.texture, alphaTest: .5, side: THREE.DoubleSide, color: 0xffffff,
      emissive: 0xffffff, emissiveMap: this.texture, emissiveIntensity: .22,
    });
    this.body = new THREE.Mesh(geometry, material); this.body.castShadow = true; this.body.receiveShadow = true;
    this.body.customDepthMaterial = new THREE.MeshDepthMaterial({ map: this.texture, alphaTest: .5, depthPacking: THREE.RGBADepthPacking });
    this.root.add(this.body);
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
    const context = shadowCanvas.getContext('2d')!;
    const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 30);
    gradient.addColorStop(0, 'rgba(25,30,20,0.5)'); gradient.addColorStop(1, 'rgba(25,30,20,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(id === 'newsboy' ? .7 : .95, .7),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .005; this.root.add(shadow);
    this.setFacing('s');
  }

  private setFacing(facing: Facing) {
    const directionIndex = FACINGS.indexOf(facing), column = DIRECTION_COLUMNS[directionIndex];
    this.facing = facing; this.body.scale.x = directionIndex > 4 ? -1 : 1;
    const row = STORY_NPC_IDS.indexOf(this.id), frame = row * COLUMNS + column;
    if (frame === this.frame) return;
    this.frame = frame; this.texture.offset.set(column / COLUMNS, 1 - (row + 1) / ROWS);
  }

  update(position: Point, direction: Point, cameraYaw: number): void {
    this.root.position.set(position.x, 0, position.z); this.body.rotation.y = cameraYaw;
    this.setFacing(screenFacing(direction, cameraYaw, this.facing));
  }
}
