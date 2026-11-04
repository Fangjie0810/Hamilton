import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutMarkerLabels, type MarkerLabel, type LabelRect } from '../src/demo3d/MarkerLayout';

const rectFor = (label: MarkerLabel, point: { x: number; y: number }): LabelRect => ({ left: point.x - label.width / 2, top: point.y - label.height, width: label.width, height: label.height });
const intersects = (a: LabelRect, b: LabelRect) => a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;

test('nearby citizen/loyalist labels remain separately clickable while main route keeps its anchor', () => {
  const bounds = { left: 12, top: 12, width: 1000, height: 700 };
  const labels = [
    { id: 'citizen', x: 500, y: 380, width: 150, height: 32, priority: 2 },
    { id: 'loyalist', x: 464, y: 376, width: 195, height: 32, priority: 2 },
    { id: 'exit', x: 480, y: 335, width: 180, height: 36, priority: 0 },
  ];
  const positions = layoutMarkerLabels(labels, bounds);
  assert.equal(positions.size, 3);
  assert.deepEqual(positions.get('exit'), { x: 480, y: 335 }, 'higher-priority route is placed first regardless of input order');
  const rects = labels.map(label => rectFor(label, positions.get(label.id)!));
  for (let index = 0; index < rects.length; index++) for (const other of rects.slice(index + 1))
    assert.equal(intersects(rects[index], other), false, 'no label intercepts another label');
});

test('camera-edge labels fit the viewport and avoid the objective panel after text reflows', () => {
  const bounds = { left: 12, top: 12, width: 616, height: 456 };
  const hud = { left: 20, top: 140, width: 218, height: 160 };
  for (const width of [130, 210]) {
    const labels = [
      { id: 'left', x: 25, y: 235, width, height: 48, priority: 2 },
      { id: 'right', x: 625, y: 280, width, height: 48, priority: 2 },
    ];
    const positions = layoutMarkerLabels(labels, bounds, [hud]);
    assert.equal(positions.size, 2);
    for (const label of labels) {
      const rect = rectFor(label, positions.get(label.id)!);
      assert.ok(rect.left >= bounds.left && rect.left + rect.width <= bounds.left + bounds.width);
      assert.ok(rect.top >= bounds.top && rect.top + rect.height <= bounds.top + bounds.height);
      assert.equal(intersects(rect, hud), false);
    }
  }
});

test('an unobstructed label follows its projected anchor on every camera update', () => {
  const bounds = { left: 0, top: 0, width: 800, height: 600 };
  for (const x of [250, 270, 320]) {
    const label = { id: 'moving', x, y: 300, width: 160, height: 32, priority: 0 };
    assert.deepEqual(layoutMarkerLabels([label], bounds).get('moving'), { x, y: 300 });
  }
});
