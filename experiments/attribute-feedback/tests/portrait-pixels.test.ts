import assert from 'node:assert/strict';
import test from 'node:test';
import { extractPortraitFrames, keyPortraitPixels, type PortraitPixels } from '../src/ui/portraitPixels';

type RGBA = readonly [number, number, number, number];
function buffer(width: number, height: number, background: RGBA = [0, 0, 0, 0]): PortraitPixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(background, i * 4);
  return { width, height, data };
}
function paint(source: PortraitPixels, x: number, y: number, color: RGBA, width = 1, height = 1) {
  for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) source.data.set(color, (row * source.width + col) * 4);
}
function pixel(source: PortraitPixels, x: number, y: number) { return [...source.data.slice((y * source.width + x) * 4, (y * source.width + x + 1) * 4)]; }
function near(actual: number, expected: number, label: string, tolerance = 2) { assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`); }

for (const [name, key] of [['magenta', [255, 0, 255]], ['green', [0, 255, 0]]] as const) {
  test(`${name} key recovers blended contour colour and continuous alpha without cutting the dark outline`, () => {
    const source = buffer(9, 7, [...key, 255]), foreground = [22, 29, 37] as const;
    paint(source, 4, 1, [...foreground, 255], 3, 5);
    for (let y = 1; y <= 5; y++) {
      const alpha = y / 6;
      paint(source, 3, y, [...foreground.map((channel, i) => Math.round(alpha * channel + (1 - alpha) * key[i])), 255] as unknown as RGBA);
    }
    const original = new Uint8ClampedArray(source.data), result = keyPortraitPixels(source, { color: key });
    assert.deepEqual(source.data, original, 'preparation never changes the authored source buffer');
    assert.deepEqual(pixel(result, 0, 0), [0, 0, 0, 0], 'removed background carries no hidden key colour');
    assert.deepEqual(pixel(result, 4, 3), [...foreground, 255], 'the opaque hair/coat outline survives exactly');
    for (let y = 1; y <= 5; y++) {
      const edge = pixel(result, 3, y);
      near(edge[3], y / 6 * 255, `edge ${y} alpha`);
      foreground.forEach((channel, index) => near(edge[index], channel, `edge ${y} channel ${index}`, 4));
    }
  });
}

test('already transparent input is preserved and native partial alpha is multiplied by the matte', () => {
  const source = buffer(6, 5, [255, 0, 255, 0]);
  paint(source, 3, 1, [20, 20, 20, 255], 2, 3);
  paint(source, 2, 2, [138, 10, 138, 128]);
  const result = keyPortraitPixels(source, { color: '#ff00ff' });
  near(pixel(result, 2, 2)[3], 64, 'native alpha remains partial');
  assert.deepEqual(pixel(result, 0, 0), [0, 0, 0, 0]);
});

test('a tiny enclosed curl gap is unmixed even when it contains no exact background pixel', () => {
  const source = buffer(45, 45, [255, 0, 255, 255]);
  paint(source, 2, 2, [20, 20, 20, 255], 41, 41);
  paint(source, 22, 22, [184, 6, 184, 255]);
  const result = keyPortraitPixels(source, { color: '#ff00ff' }), gap = pixel(result, 22, 22);
  near(gap[0], 20, 'curl gap has no pink RGB');
  near(gap[1], 20, 'curl gap keeps the underlying contour colour');
  near(gap[2], 20, 'curl gap has no blue spill');
  near(gap[3], 77, 'a blended gap keeps its fractional coverage');
});

test('small green-background noise cannot become a pink fringe when divided by a tiny alpha', () => {
  const source = buffer(9, 7, [0, 255, 0, 255]);
  paint(source, 4, 1, [20, 20, 20, 255], 3, 5);
  paint(source, 3, 3, [19, 241, 19, 255]);
  const result = keyPortraitPixels(source, { color: '#00ff00' }), edge = pixel(result, 3, 3);
  assert.ok(edge[3] > 0 && edge[3] < 50, 'the edge keeps its fractional coverage');
  assert.deepEqual(edge.slice(0, 3), [20, 20, 20], 'near-transparent colour follows the real contour rather than amplified RGB noise');
});

test('dark green blended into an enclosed brown curl is recovered without erasing the curl', () => {
  const source = buffer(45, 45, [0, 255, 0, 255]);
  paint(source, 2, 2, [90, 40, 4, 255], 41, 41);
  paint(source, 22, 22, [59, 115, 3, 255]);
  const result = keyPortraitPixels(source, { color: '#00ff00' }), gap = pixel(result, 22, 22);
  [90, 40, 4].forEach((value, index) => near(gap[index], value, `dark curl channel ${index}`));
  near(gap[3], 166, 'the enclosed curl edge keeps its partial coverage');
  assert.deepEqual(pixel(result, 21, 22), [90, 40, 4, 255], 'surrounding brown hair remains intact');
});

test('green-key stabilization preserves burgundy clothing and warm skin at the silhouette', () => {
  const source = buffer(15, 9, [0, 255, 0, 255]);
  const wine: RGBA = [126, 37, 82, 255], skin: RGBA = [173, 116, 82, 255];
  paint(source, 5, 2, wine, 6, 5); paint(source, 6, 1, skin, 3, 2);
  paint(source, 4, 4, [63, 146, 41, 255]);
  const result = keyPortraitPixels(source, { color: '#00ff00' });
  assert.deepEqual(pixel(result, 5, 4), wine, 'the wine-red coat edge is not treated as a second key colour');
  assert.deepEqual(pixel(result, 6, 1), skin, 'the skin silhouette stays intact');
  pixel(result, 4, 4).slice(0, 3).forEach((channel, i) => near(channel, wine[i], `blended burgundy channel ${i}`));
  near(pixel(result, 4, 4)[3], 128, 'blended coat alpha stays continuous');
});

test('white-key matte removes the exterior while protecting white cloth enclosed by an outline', () => {
  const source = buffer(13, 11, [250, 250, 250, 255]);
  paint(source, 4, 2, [20, 20, 20, 255], 6, 7);
  paint(source, 5, 3, [250, 250, 250, 255], 4, 5);
  paint(source, 3, 4, [135, 135, 135, 255]);
  const result = keyPortraitPixels(source, { color: '#fafafa', sampleRadius: 3 });
  assert.deepEqual(pixel(result, 0, 0), [0, 0, 0, 0]);
  assert.deepEqual(pixel(result, 6, 5), [250, 250, 250, 255], 'white shirt has an enclosed silhouette');
  assert.deepEqual(pixel(result, 4, 5), [20, 20, 20, 255], 'black outline remains opaque');
  near(pixel(result, 3, 4)[3], 128, 'white blended edge is continuous');
  near(pixel(result, 3, 4)[0], 20, 'white spill is unmixed');
});

test('six cells are extracted in row-major order and a detached neighboring fragment does not affect framing', () => {
  const source = buffer(60, 40, [0, 255, 0, 255]);
  for (let i = 0; i < 6; i++) {
    const x = i % 3 * 20, y = Math.floor(i / 3) * 20;
    paint(source, x + 6, y + 3, [30 + i * 20, 30, 20, 255], 8, 15);
    paint(source, x, y + 6, [20, 30, 40, 255], 2, 6);
  }
  const result = extractPortraitFrames(source, { columns: 3, rows: 2, outputWidth: 20, outputHeight: 20, padding: 1 });
  assert.equal(result.frames.length, 6);
  result.bounds.forEach(bound => assert.deepEqual(bound, { x: 6, y: 3, width: 8, height: 15 }));
  result.frames.forEach((frame, index) => assert.deepEqual(pixel(frame, 10, 10), [30 + index * 20, 30, 20, 255]));
});

test('an emphasis hand extension never changes the head position or the scale between frames', () => {
  const source = buffer(60, 20);
  for (let i = 0; i < 3; i++) {
    paint(source, i * 20 + 6, 3, [40, 50, 60, 255], 7, 15);
    paint(source, i * 20 + 8, 5, [220, 170, 120, 255], 2, 2);
  }
  paint(source, 52, 10, [40, 50, 60, 255], 6, 3);
  const result = extractPortraitFrames(source, { columns: 3, rows: 1, key: false, outputWidth: 40, outputHeight: 40, padding: 2 });
  const facialPixels = result.frames.map(frame => {
    const locations: number[] = [];
    for (let i = 0; i < frame.width * frame.height; i++) if (frame.data[i * 4] === 220) locations.push(i);
    return locations;
  });
  assert.ok(facialPixels[0].length > 0);
  assert.deepEqual(facialPixels[0], facialPixels[1]);
  assert.deepEqual(facialPixels[0], facialPixels[2], 'opening the gesture does not re-center or rescale the face');
});

test('artist-reviewed frame offsets can correct atlas drift before uniform registration', () => {
  const source = buffer(40, 20);
  paint(source, 6, 3, [90, 60, 30, 255], 7, 15);
  paint(source, 28, 4, [90, 60, 30, 255], 7, 15);
  const result = extractPortraitFrames(source, { columns: 2, rows: 1, key: false, frameOffsets: [{ x: 0, y: 0 }, { x: -2, y: -1 }] });
  assert.deepEqual(result.frames[0].data, result.frames[1].data);
});

test('horizontal overscan preserves a connected hand across a column boundary and removes neighboring fragments', () => {
  const source = buffer(40, 24, [0, 255, 0, 255]);
  const coat: RGBA = [35, 45, 65, 255], face: RGBA = [220, 170, 110, 255], fingertips: RGBA = [190, 120, 75, 255];
  for (const start of [0, 20]) {
    paint(source, start + 5, 4, coat, 7, 17);
    paint(source, start + 8, 6, face, 2, 2);
  }
  paint(source, 11, 11, coat, 13, 3);
  paint(source, 20, 11, fingertips, 4, 3);
  paint(source, 23, 1, [100, 80, 50, 255], 2, 1);
  const options = { columns: 2, rows: 1, outputWidth: 40, outputHeight: 48 };
  const clipped = extractPortraitFrames(source, options);
  const result = extractPortraitFrames(source, { ...options, horizontalOverscan: 6 });
  const positions = (frame: PortraitPixels, color: RGBA) => {
    const found: number[] = [];
    for (let i = 0; i < frame.width * frame.height; i++) if (color.every((value, c) => frame.data[i * 4 + c] === value)) found.push(i);
    return found;
  };
  assert.equal(positions(clipped.frames[0], fingertips).length, 0, 'the authored fingertips lie beyond the equal column boundary');
  assert.ok(positions(result.frames[0], fingertips).length > 0, 'overscan recovers the original connected fingertips');
  assert.equal(positions(result.frames[1], fingertips).length, 0, 'the same fingertips are discarded from the neighboring actor');
  assert.equal(positions(result.frames[0], [100, 80, 50, 255]).length, 0, 'a detached neighboring fragment is not imported');
  assert.deepEqual(result.bounds[0], { x: 5, y: 4, width: 19, height: 17 }, 'bounds keep original cell coordinates and include the complete hand');
  assert.deepEqual(result.bounds[1], { x: 5, y: 4, width: 7, height: 17 });
  assert.deepEqual(positions(result.frames[0], face), positions(result.frames[1], face), 'both heads keep the same scale and registration');
});

test('leftward overscan keeps a thumb at negative cell coordinates without borrowing the previous actor', () => {
  const source = buffer(40, 24, [0, 255, 0, 255]);
  for (const start of [0, 20]) paint(source, start + 5, 4, [35, 45, 65, 255], 7, 17);
  paint(source, 16, 11, [190, 120, 75, 255], 11, 3);
  const result = extractPortraitFrames(source, { columns: 2, rows: 1, horizontalOverscan: 6 });
  assert.deepEqual(result.bounds[0], { x: 5, y: 4, width: 7, height: 17 });
  assert.deepEqual(result.bounds[1], { x: -4, y: 4, width: 16, height: 17 });
  assert.equal(result.registration.sourceBounds.x, -4, 'overscan preserves the original column origin');
  const fingertips = result.frames.map(frame => [...frame.data].filter((value, i) => i % 4 === 0 && value === 190).length);
  assert.equal(fingertips[0], 0); assert.ok(fingertips[1] > 0);
});

test('unused trailing cells cannot turn overscanned hand fragments into extra frames or change registration', () => {
  const source = buffer(40, 40, [0, 255, 0, 255]);
  for (const [x, y] of [[0, 0], [20, 0], [0, 20]]) paint(source, x + 5, y + 4, [35, 45, 65, 255], 7, 15);
  paint(source, 11, 31, [190, 120, 75, 255], 13, 3);
  const options = { columns: 2, rows: 2, horizontalOverscan: 6 };
  const allCells = extractPortraitFrames(source, options);
  const authored = extractPortraitFrames(source, { ...options, frameCount: 3 });
  assert.equal(authored.frames.length, 3); assert.equal(authored.bounds.length, 3);
  assert.deepEqual(authored.registration.sourceBounds, { x: 5, y: 4, width: 19, height: 15 });
  assert.ok(allCells.registration.sourceBounds.x < authored.registration.sourceBounds.x, 'the unused cell contains only a differently registered neighbor fragment');
});

test('empty sheets stay transparent and invalid dimensions fail before processing', () => {
  const result = extractPortraitFrames(buffer(12, 8, [0, 255, 0, 255]), { columns: 3, rows: 2 });
  assert.ok(result.frames.every(frame => frame.data.every(channel => channel === 0)));
  assert.throws(() => keyPortraitPixels({ width: 2, height: 2, data: new Uint8ClampedArray(8) }), RangeError);
  assert.throws(() => extractPortraitFrames(buffer(4, 4), { columns: 0, rows: 2 }), RangeError);
  assert.throws(() => extractPortraitFrames(buffer(4, 4), { columns: 2, rows: 2, frameOffsets: [] }), RangeError);
  assert.throws(() => extractPortraitFrames(buffer(4, 4), { columns: 2, rows: 2, horizontalOverscan: -1 }), RangeError);
  assert.throws(() => extractPortraitFrames(buffer(4, 4), { columns: 2, rows: 2, frameCount: 5 }), RangeError);
});
