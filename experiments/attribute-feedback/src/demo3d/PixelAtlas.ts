import * as THREE from 'three';
import { ATLAS_COLUMNS, ATLAS_ROWS } from './Facing';

const SOURCES = [
  { path: '/art/actors/pixel-cast-v1.png', columns: 4, rows: 4, offset: 0 },
  { path: '/art/actors/pixel-cast-directions-v2.png', columns: 5, rows: 3, offset: 16 },
];
const CELL_WIDTH = 96, CELL_HEIGHT = 128, FOOT_LINE = 120, BODY_HEIGHT = 112;

function boundaries(projection: Uint32Array, count: number) {
  const edges = [0], cell = projection.length / count;
  for (let i = 1; i < count; i++) {
    let start = -1, longest = 0, center = Math.round(i * cell);
    const low = Math.floor(i * cell - cell * .36), high = Math.ceil(i * cell + cell * .36);
    for (let j = low; j <= high; j++) {
      if (j < high && projection[j] < 3) { if (start < 0) start = j; }
      else if (start >= 0) { if (j - start > longest) { longest = j - start; center = Math.floor((start + j) / 2); } start = -1; }
    }
    edges.push(center);
  }
  edges.push(projection.length); return edges;
}

/** Color-key and normalize authored frames for rendering, retaining both source images. */
export async function loadPixelAtlas() {
  const images = await Promise.all(SOURCES.map(({ path }) => new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error(`Pixel atlas could not load: ${path}`)); img.src = path;
  })));
  const atlas = document.createElement('canvas'); atlas.width = CELL_WIDTH * ATLAS_COLUMNS; atlas.height = CELL_HEIGHT * ATLAS_ROWS;
  const output = atlas.getContext('2d')!; output.imageSmoothingEnabled = false;
  images.forEach((image, index) => {
    const layout = SOURCES[index];
    const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
    const ctx = source.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, source.width, source.height);
    const rows = new Uint32Array(source.height), cols = new Uint32Array(source.width);
    for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
      const i = (y * source.width + x) * 4, r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
      if (r > 100 && b > 100 && r - g > 50 && b - g > 50) pixels.data[i + 3] = 0;
      else if (pixels.data[i + 3] > 100) { rows[y]++; cols[x]++; }
    }
    ctx.putImageData(pixels, 0, 0);
    const xs = boundaries(cols, layout.columns), ys = boundaries(rows, layout.rows);
    for (let row = 0; row < layout.rows; row++) for (let col = 0; col < layout.columns; col++) {
      let left = xs[col + 1], right = xs[col], top = ys[row + 1], bottom = ys[row];
      for (let y = ys[row]; y < ys[row + 1]; y++) for (let x = xs[col]; x < xs[col + 1]; x++) {
        if (pixels.data[(y * source.width + x) * 4 + 3] > 100) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
      }
      if (right <= left || bottom <= top) throw new Error(`Pixel atlas frame missing: ${layout.path} ${row},${col}`);
      const frame = layout.offset + row * layout.columns + col;
      const scale = Math.min(BODY_HEIGHT / (bottom - top + 1), (CELL_WIDTH - 8) / (right - left + 1));
      const height = Math.round((bottom - top + 1) * scale), width = Math.round((right - left + 1) * scale);
      output.drawImage(source, left, top, right - left + 1, bottom - top + 1, (frame % ATLAS_COLUMNS) * CELL_WIDTH + Math.round((CELL_WIDTH - width) / 2), Math.floor(frame / ATLAS_COLUMNS) * CELL_HEIGHT + FOOT_LINE - height, width, height);
    }
  });
  const texture = new THREE.CanvasTexture(atlas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.generateMipmaps = false;
  texture.repeat.set(1 / ATLAS_COLUMNS, 1 / ATLAS_ROWS); return texture;
}
