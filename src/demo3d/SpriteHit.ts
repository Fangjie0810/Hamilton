import type { Intersection, Texture } from 'three';

interface AlphaPixels { width: number; height: number; alpha: Uint8Array }
const alphaCache = new WeakMap<HTMLCanvasElement, AlphaPixels | null>();

/** The generated actor atlases are immutable canvases shared by cloned textures. */
function pixelsFor(texture: Texture): AlphaPixels | null {
  const source = texture.image as HTMLCanvasElement | undefined;
  if (!source || typeof source.getContext !== 'function' || !source.width || !source.height) return null;
  const cached = alphaCache.get(source);
  if (cached === null || (cached && cached.width === source.width && cached.height === source.height)) return cached;
  try {
    const context = source.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    const { width, height } = source, data = context.getImageData(0, 0, width, height).data;
    const alpha = new Uint8Array(width * height);
    for (let index = 0; index < alpha.length; index++) alpha[index] = data[index * 4 + 3];
    const pixels = { width, height, alpha }; alphaCache.set(source, pixels); return pixels;
  } catch {
    // A future non-readable texture keeps the existing geometric interaction fallback.
    alphaCache.set(source, null); return null;
  }
}

/** Discard transparent billboard padding, using the active frame's rendered UV transform. */
export function isOpaqueSpriteHit(hit: Pick<Intersection, 'uv'>, texture: Texture, alphaTest = .5): boolean {
  if (!hit.uv) return true;
  const pixels = pixelsFor(texture); if (!pixels) return true;
  if (texture.matrixAutoUpdate) texture.updateMatrix();
  // Mesh mirroring is already reflected in the ray intersection's local UV coordinates.
  const uv = texture.transformUv(hit.uv.clone());
  if (!Number.isFinite(uv.x) || !Number.isFinite(uv.y)) return false;
  const x = Math.max(0, Math.min(pixels.width - 1, Math.floor(uv.x * pixels.width)));
  const y = Math.max(0, Math.min(pixels.height - 1, Math.floor(uv.y * pixels.height)));
  return pixels.alpha[y * pixels.width + x] / 255 >= alphaTest;
}
