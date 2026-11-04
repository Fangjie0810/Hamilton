import test from 'node:test';
import assert from 'node:assert/strict';
import { StoryNpc } from '../src/story3d/StoryNpc';

test('argument art alternates, stays grounded, freezes on pause, and settles after interaction', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const canvas = { width: 0, height: 0, getContext: () => ({
    createRadialGradient: () => ({ addColorStop() {} }), fillStyle: '', fillRect() {},
  }) } as unknown as HTMLCanvasElement;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => canvas } });
  try {
    for (const id of ['citizen', 'loyalist'] as const) {
      const actor = new StoryNpc(canvas, id), position = { x: 2, z: 3 }, direction = { x: 1, z: 0 };
      const motion = { delta: 0, arguing: true, paused: false, reducedMotion: false };
      actor.update(position, direction, .48, motion);
      const first = actor.frame;
      actor.update(position, direction, .48, { ...motion, delta: .9 });
      const second = actor.frame;
      assert.notEqual(second, first, `${id} uses two authored gestures`);
      assert.deepEqual(actor.root.position.toArray(), [2, 0, 3], 'gestures do not move the actor footprint');
      actor.update(position, direction, .48, { ...motion, delta: .9, paused: true });
      assert.equal(actor.frame, second, 'settings pause freezes the current gesture');
      actor.update(position, direction, .48, { ...motion, delta: 2, reducedMotion: true });
      const reduced = actor.frame;
      actor.update(position, direction, .48, { ...motion, delta: 2, reducedMotion: true });
      assert.equal(actor.frame, reduced, 'reduced motion keeps a static expressive pose');
      actor.update(position, direction, .48, { ...motion, arguing: false });
      assert.notEqual(actor.frame, first, 'interaction settles to separate idle art');
      assert.notEqual(actor.frame, second);
    }
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original); else Reflect.deleteProperty(globalThis, 'document');
  }
});
