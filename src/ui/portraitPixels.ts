/** Pixel-only preparation of authored portrait atlases. This never draws or changes source art. */
export interface PortraitPixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray<ArrayBuffer>;
}
export interface PixelRect { x: number; y: number; width: number; height: number }
export type PortraitKeyColor = `#${string}` | readonly [number, number, number];
export interface ChromaKeyOptions {
  /** Green for new sheets; magenta for the approved older art. White is also supported. */
  color?: PortraitKeyColor;
  /** Maximum per-channel error that still counts as the flat background. Default 18/255. */
  tolerance?: number;
  /** Search radius for a nearby uncontaminated foreground colour. Default 6 source pixels. */
  sampleRadius?: number;
  /** White-key edge treatment is restricted to this exterior band. Default 4 source pixels. */
  edgeRadius?: number;
}
export interface PortraitFrameOptions {
  columns: number;
  rows: number;
  /** Authored row-major prefix; unused atlas cells never influence registration. */
  frameCount?: number;
  key?: ChromaKeyOptions | false;
  outputWidth?: number;
  outputHeight?: number;
  padding?: number;
  /** Include authored hands that cross a nominal column boundary, in source pixels. */
  horizontalOverscan?: number;
  removeFragments?: boolean;
  /** Keep tiny disconnected details only this close to the main silhouette. Default 3. */
  fragmentDistance?: number;
  /** Optional artist-reviewed corrections, in source pixels, applied before shared registration. */
  frameOffsets?: readonly { x: number; y: number }[];
}
export interface PortraitFrameSet {
  frames: PortraitPixels[];
  /** Cleaned bounds in each original cell, before optional registration offsets. */
  bounds: PixelRect[];
  registration: { scale: number; sourceBounds: PixelRect; offsetX: number; offsetY: number };
}

const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
function checkPixels(source: PortraitPixels) {
  if (!Number.isInteger(source.width) || !Number.isInteger(source.height) || source.width < 1 || source.height < 1 || source.data.length !== source.width * source.height * 4)
    throw new RangeError('Portrait pixel dimensions do not match the RGBA buffer');
}
function parseColor(color: PortraitKeyColor = '#00ff00'): readonly [number, number, number] {
  if (typeof color !== 'string') {
    if (color.length !== 3 || color.some(channel => !Number.isFinite(channel) || channel < 0 || channel > 255)) throw new RangeError('Invalid portrait key colour');
    return color;
  }
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new RangeError('Portrait key colour must use six hex digits');
  return [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
}
function eachNeighbor(index: number, width: number, height: number, visit: (next: number) => void) {
  const x = index % width, y = Math.floor(index / width);
  if (x) visit(index - 1);
  if (x + 1 < width) visit(index + 1);
  if (y) visit(index - width);
  if (y + 1 < height) visit(index + width);
}

/**
 * Remove a known flat key and unmix its contribution from edge RGB as well as alpha.
 * Binary alpha thresholding leaves magenta RGB in partially blended hair/coat edges;
 * a nearby clean foreground sample lets us solve C = a F + (1-a) K instead.
 * Existing transparency is multiplied by the recovered matte, never made opaque.
 * White keying uses exterior connectivity so enclosed white shirts/pages survive.
 */
export function keyPortraitPixels(source: PortraitPixels, options: ChromaKeyOptions = {}): PortraitPixels {
  checkPixels(source);
  const key = parseColor(options.color), tolerance = clamp(options.tolerance ?? 18, 0, 100);
  const radius = Math.round(clamp(options.sampleRadius ?? 6, 1, 24));
  const edgeRadius = Math.round(clamp(options.edgeRadius ?? 4, 1, 24));
  const { width, height } = source, count = width * height, input = source.data;
  const output = new Uint8ClampedArray(input), clear = new Uint8Array(count), candidate = new Uint8Array(count);
  const distance = new Uint8Array(count); distance.fill(255);
  const keyMin = Math.min(...key), keyMax = Math.max(...key), saturated = keyMax - keyMin > 100;
  const high = [0, 1, 2].filter(channel => key[channel] > (keyMin + keyMax) / 2);
  const low = [0, 1, 2].filter(channel => !high.includes(channel));
  // Generated greens need not be pure RGB primaries. Use the same channel
  // comparison for the key and the pixel, so the actual background is strength 1.
  // Dividing (G - max(R, B)) by (max(K) - min(K)) left residual green when B > R.
  const keyChroma = Math.min(...high.map(channel => key[channel])) - Math.max(...low.map(channel => key[channel]));
  const strength = (index: number) => saturated
    ? Math.max(0, (Math.min(...high.map(channel => input[index * 4 + channel])) - Math.max(...low.map(channel => input[index * 4 + channel]))) / keyChroma) : 0;
  const keyDistance = (index: number) => Math.max(...key.map((channel, c) => Math.abs(input[index * 4 + c] - channel)));
  const queue = new Int32Array(count);
  let head = 0, tail = 0;
  const enqueue = (index: number) => {
    if (clear[index]) return;
    clear[index] = 1; distance[index] = 0; queue[tail++] = index;
  };
  for (let i = 0; i < count; i++) {
    if (!input[i * 4 + 3]) enqueue(i);
    else if (keyDistance(i) <= tolerance) {
      if (saturated) enqueue(i);
      else {
        candidate[i] = 1;
        const x = i % width, y = Math.floor(i / width);
        if (!x || !y || x === width - 1 || y === height - 1) enqueue(i);
      }
    } else if (saturated && strength(i) > .15) {
      // Tiny enclosed gaps in curls/fingers may contain only blended key pixels,
      // with no exact flat-key seed. Treat them as matte candidates, not holes:
      // their alpha still comes from unmixing rather than a binary deletion.
      distance[i] = 0; queue[tail++] = i;
    }
  }
  // A white garment separated from the background by its dark outline is not key.
  if (!saturated) while (head < tail) eachNeighbor(queue[head++], width, height, next => {
    if (candidate[next]) enqueue(next);
  });
  head = 0;
  // Limit decontamination to the exterior fringe; preserve genuine interior colours.
  while (head < tail) {
    const current = queue[head++];
    if (distance[current] >= (saturated ? radius * 2 : edgeRadius)) continue;
    eachNeighbor(current, width, height, next => {
      if (distance[next] <= distance[current] + 1) return;
      distance[next] = distance[current] + 1;
      queue[tail++] = next;
    });
  }
  for (let i = 0; i < count; i++) {
    const offset = i * 4;
    if (clear[i]) { output.fill(0, offset, offset + 4); continue; }
    if (!saturated && candidate[i]) continue;
    if (distance[i] === 255 || (saturated && strength(i) <= .025)) continue;
    const x = i % width, y = Math.floor(i / width), ownDistance = keyDistance(i);
    let bestAlpha = 1, bestScore = Infinity, bestError = Infinity, bestForeground = -1;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if ((!dx && !dy) || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
      const neighbor = (y + dy) * width + x + dx, n = neighbor * 4;
      if (clear[neighbor] || input[n + 3] < 200) continue;
      if (saturated ? strength(neighbor) > .025 : keyDistance(neighbor) < ownDistance + 20) continue;
      let numerator = 0, denominator = 0;
      for (let c = 0; c < 3; c++) {
        const foreground = input[n + c] - key[c];
        numerator += (input[offset + c] - key[c]) * foreground;
        denominator += foreground * foreground;
      }
      if (denominator < 100) continue;
      const alpha = clamp(numerator / denominator);
      let error = 0;
      for (let c = 0; c < 3; c++) error += (input[offset + c] - (alpha * input[n + c] + (1 - alpha) * key[c])) ** 2;
      const score = error + (dx * dx + dy * dy) * 2;
      if (score < bestScore) { bestScore = score; bestAlpha = alpha; bestError = error; bestForeground = n; }
    }
    // If no matching local colour exists, neutral-axis unmixing removes only key
    // chroma. It keeps dark contours instead of erasing them with a colour cutoff.
    const localFit = bestError <= (saturated ? 900 : 144);
    let alpha = localFit
      ? bestAlpha : saturated ? 1 - clamp(strength(i)) : 1;
    // A slightly mismatched nearby shade must not reintroduce key chroma into
    // the recovered RGB. Cap its matte to the clean sample's chroma tolerance.
    if (saturated) alpha = Math.min(alpha, clamp((1 - strength(i)) / .975));
    if (alpha >= .999) continue;
    if (alpha < .015) { output.fill(0, offset, offset + 4); continue; }
    // Dividing tiny RGB noise by a tiny matte can invent the key's complementary
    // colour: (19,241,19) on green became a pink pixel at alpha ~.08. Measure the
    // fit error in recovered-foreground space. If it exceeds 12 RGB levels, use
    // the fitted local foreground colour rather than amplify that uncertainty.
    // This does not globally suppress magenta: real wine-red cloth and skin are
    // unchanged, including when they are the foreground sample at a keyed edge.
    const stabilize = localFit && bestForeground >= 0 && bestError > 144 * alpha * alpha;
    for (let c = 0; c < 3; c++) output[offset + c] = stabilize ? input[bestForeground + c]
      : clamp((input[offset + c] - (1 - alpha) * key[c]) / alpha, 0, 255);
    output[offset + 3] = Math.round(input[offset + 3] * alpha);
  }
  return { width, height, data: output };
}

function boundsOf(source: PortraitPixels): PixelRect {
  let left = source.width, top = source.height, right = -1, bottom = -1;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) if (source.data[(y * source.width + x) * 4 + 3] >= 8) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return right < left ? { x: 0, y: 0, width: 0, height: 0 } : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}
function removeFragments(source: PortraitPixels, detailDistance: number) {
  const { width, height, data } = source, count = width * height, labels = new Int32Array(count), queue = new Int32Array(count);
  const sizes = [0], rectangles: PixelRect[] = [{ x: 0, y: 0, width: 0, height: 0 }];
  let largest = 0;
  for (let seed = 0; seed < count; seed++) {
    if (labels[seed] || data[seed * 4 + 3] < 8) continue;
    const label = sizes.length;
    let head = 0, tail = 1, left = width, right = 0, top = height, bottom = 0;
    queue[0] = seed; labels[seed] = label;
    while (head < tail) {
      const current = queue[head++], x = current % width, y = Math.floor(current / width);
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
        const next = (y + dy) * width + x + dx;
        if (labels[next] || data[next * 4 + 3] < 8) continue;
        labels[next] = label; queue[tail++] = next;
      }
    }
    sizes.push(tail); rectangles.push({ x: left, y: top, width: right - left + 1, height: bottom - top + 1 });
    if (tail > sizes[largest]) largest = label;
  }
  if (!largest) return;
  // Retain nearby detached hair/jewellery pixels, but drop a neighbour's hand or
  // coat crossing a cell boundary. Bounds are only a quick rejection; distance
  // is measured to actual silhouette pixels so empty pose gaps do not count.
  const keep = new Set([largest]), main = rectangles[largest];
  for (let label = 1; label < sizes.length; label++) {
    if (label === largest) continue;
    const rect = rectangles[label];
    if (rect.x > main.x + main.width + detailDistance || rect.x + rect.width + detailDistance < main.x || rect.y > main.y + main.height + detailDistance || rect.y + rect.height + detailDistance < main.y) continue;
    let near = false;
    for (let y = rect.y; y < rect.y + rect.height && !near; y++) for (let x = rect.x; x < rect.x + rect.width && !near; x++) {
      if (labels[y * width + x] !== label) continue;
      for (let dy = -detailDistance; dy <= detailDistance && !near; dy++) for (let dx = -detailDistance; dx <= detailDistance; dx++) {
        if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height && labels[(y + dy) * width + x + dx] === largest) { near = true; break; }
      }
    }
    if (near) keep.add(label);
  }
  for (let i = 0; i < count; i++) if (!keep.has(labels[i])) data.fill(0, i * 4, i * 4 + 4);
}

/** Extract row-major cells, clean foreign fragments, then fit every frame with one transform. */
export function extractPortraitFrames(source: PortraitPixels, options: PortraitFrameOptions): PortraitFrameSet {
  checkPixels(source);
  const { columns, rows } = options;
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1 || columns > source.width || rows > source.height) throw new RangeError('Invalid portrait atlas grid');
  const frameCount = options.frameCount ?? columns * rows;
  if (!Number.isInteger(frameCount) || frameCount < 1 || frameCount > columns * rows) throw new RangeError('Invalid portrait frame count');
  const cellWidth = Math.ceil(source.width / columns), cellHeight = Math.ceil(source.height / rows);
  const overscan = options.horizontalOverscan ?? 0, storedWidth = cellWidth + overscan * 2;
  if (!Number.isInteger(overscan) || overscan < 0 || overscan > cellWidth / 2) throw new RangeError('Invalid portrait horizontal overscan');
  const width = options.outputWidth ?? cellWidth, height = options.outputHeight ?? cellHeight, padding = options.padding ?? 0;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || !Number.isFinite(padding) || padding < 0 || padding * 2 >= Math.min(width, height)) throw new RangeError('Invalid portrait output dimensions');
  if (options.frameOffsets && (options.frameOffsets.length !== frameCount || options.frameOffsets.some(offset => !Number.isFinite(offset.x) || !Number.isFinite(offset.y)))) throw new RangeError('Portrait frame offsets must match the authored frames');
  const keyed = options.key === false ? source : keyPortraitPixels(source, options.key);
  const cells: PortraitPixels[] = [], bounds: PixelRect[] = [];
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    if (cells.length >= frameCount) break;
    const x0 = Math.floor(column * source.width / columns), y0 = Math.floor(row * source.height / rows);
    const x1 = Math.floor((column + 1) * source.width / columns), y1 = Math.floor((row + 1) * source.height / rows);
    const sampleLeft = Math.max(0, x0 - overscan), sampleRight = Math.min(source.width, x1 + overscan);
    const data = new Uint8ClampedArray(storedWidth * cellHeight * 4);
    for (let y = y0; y < y1; y++) data.set(keyed.data.subarray((y * source.width + sampleLeft) * 4, (y * source.width + sampleRight) * 4), ((y - y0) * storedWidth + sampleLeft - x0 + overscan) * 4);
    const cell = { width: storedWidth, height: cellHeight, data };
    // Overscan intentionally samples neighbouring cells: keep only this cell's
    // connected actor, not a nearby disconnected sliver from the next portrait.
    if (options.removeFragments !== false) removeFragments(cell, Math.round(clamp(options.fragmentDistance ?? (overscan ? 0 : 3), 0, 24)));
    const bound = boundsOf(cell), offset = options.frameOffsets?.[cells.length] ?? { x: 0, y: 0 };
    if (bound.width) bound.x -= overscan;
    cells.push(cell); bounds.push(bound);
    if (bound.width && bound.height) {
      left = Math.min(left, bound.x + offset.x); top = Math.min(top, bound.y + offset.y);
      right = Math.max(right, bound.x + bound.width + offset.x); bottom = Math.max(bottom, bound.y + bound.height + offset.y);
    }
  }
  const sourceBounds: PixelRect = Number.isFinite(left) ? { x: left, y: top, width: right - left, height: bottom - top } : { x: 0, y: 0, width: cellWidth, height: cellHeight };
  const scale = Math.min((width - padding * 2) / sourceBounds.width, (height - padding * 2) / sourceBounds.height);
  const offsetX = (width - sourceBounds.width * scale) / 2, offsetY = height - padding - sourceBounds.height * scale;
  const frames = cells.map((cell, index) => {
    const data = new Uint8ClampedArray(width * height * 4), offset = options.frameOffsets?.[index] ?? { x: 0, y: 0 };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const sx = Math.floor((x + .5 - offsetX) / scale + sourceBounds.x - offset.x) + overscan;
      const sy = Math.floor((y + .5 - offsetY) / scale + sourceBounds.y - offset.y);
      if (sx < 0 || sx >= cell.width || sy < 0 || sy >= cell.height) continue;
      const original = (sy * cell.width + sx) * 4;
      data.set(cell.data.subarray(original, original + 4), (y * width + x) * 4);
    }
    return { width, height, data };
  });
  return { frames, bounds, registration: { scale, sourceBounds, offsetX, offsetY } };
}
