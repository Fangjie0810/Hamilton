import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPASS_CENTER, COMPASS_INNER_RADIUS, COMPASS_OUTER_RADIUS, COMPASS_SECTORS,
  compassPoint, compassProgressRadius, compassSector, relationshipSplit,
} from '../src/story3d/CompassGeometry';

test('Burr disc exaggerates independent score differences without hiding either relationship', () => {
  assert.equal(relationshipSplit(20, 20), 120);
  assert.ok(relationshipSplit(25, 20) - 120 > 8);
  assert.equal(relationshipSplit(25, 20), relationshipSplit(45, 40));
  assert.ok(Math.abs(relationshipSplit(10, 30) + relationshipSplit(30, 10) - 240) < .00001);
  assert.ok(relationshipSplit(0, 100) >= 94);
  assert.ok(relationshipSplit(100, 0) <= 146);
});

test('radial progress adds equal colored area for equal score changes', () => {
  const totalArea = Math.PI / 3 * (108 ** 2 - 52 ** 2);
  const coloredArea = (score: number) => Math.PI / 3 * (compassProgressRadius(score) ** 2 - 52 ** 2);
  for (const score of [0, 1, 25, 50, 75, 99, 100]) {
    assert.ok(Math.abs(coloredArea(score) / totalArea - score / 100) < 1e-12);
  }
  assert.ok(Math.abs((coloredArea(20) - coloredArea(10)) - (coloredArea(90) - coloredArea(80))) < 1e-9);
});

test('progress starts exactly at the center boundary and reaches the full outer edge', () => {
  assert.equal(COMPASS_CENTER, 120);
  assert.equal(COMPASS_INNER_RADIUS, 52);
  assert.equal(COMPASS_OUTER_RADIUS, 108);
  assert.equal(compassProgressRadius(0), 52);
  assert.equal(compassProgressRadius(100), 108);
  assert.equal(compassProgressRadius(-20), 52);
  assert.equal(compassProgressRadius(120), 108);
  assert.equal(compassProgressRadius(Number.NaN), 52);
  assert.equal(compassSector(52, compassProgressRadius(0), -150, -30), '');
});

test('three full sectors share every radial boundary without angular gaps', () => {
  assert.deepEqual(COMPASS_SECTORS.map(sector => sector.key), ['momentum', 'influence', 'washingtonTrust']);
  for (let index = 0; index < COMPASS_SECTORS.length; index++) {
    const current = COMPASS_SECTORS[index];
    const next = COMPASS_SECTORS[(index + 1) % COMPASS_SECTORS.length];
    assert.equal(current.end - current.start, 120);
    for (const radius of [COMPASS_INNER_RADIUS, COMPASS_OUTER_RADIUS]) {
      const end = compassPoint(radius, current.end);
      const start = compassPoint(radius, next.start);
      assert.ok(Math.hypot(end.x - start.x, end.y - start.y) < 1e-10);
    }
  }
});

test('a partly filled sector retains the full angular span at both radii', () => {
  const radius = compassProgressRadius(25);
  const a = compassPoint(radius, -150), b = compassPoint(radius, -30);
  const c = compassPoint(52, -30), d = compassPoint(52, -150);
  const path = compassSector(52, radius, -150, -30);
  assert.ok(path.startsWith(`M${a.x} ${a.y}A${radius} ${radius}`));
  assert.ok(path.includes(`1 ${b.x} ${b.y}L${c.x} ${c.y}`));
  assert.ok(path.endsWith(`0 ${d.x} ${d.y}Z`));
  assert.deepEqual(compassPoint(0, 42), { x: 120, y: 120 });
  assert.deepEqual(compassPoint(52, 0), { x: 172, y: 120 });
});
