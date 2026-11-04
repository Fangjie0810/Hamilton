import test from 'node:test';
import assert from 'node:assert/strict';
import { chapters } from '../src/data/chapters';
import { effectDirections } from '../src/systems/ChoiceEffects';
import { StateSystem } from '../src/systems/StateSystem';

test('all narrative option previews match committed stat directions, including both limits', () => {
  const options = Object.values(chapters).flatMap(chapter => chapter.interactions.flatMap(item => item.choice?.options ?? []));
  assert.equal(options.length, 18);
  for (const initial of [0, 50, 100]) for (const option of options) {
    const system = new StateSystem();
    system.apply(Object.fromEntries(Object.entries(system.state).filter(([key]) => key !== 'choices').map(([key, value]) => [key, initial - Number(value)])));
    const before = system.state, preview = effectDirections(option.effect, before);
    assert.deepEqual(system.state, before, 'rendering a preview cannot change gameplay state');
    const changes = system.choose('preview-comparison', option.id, option.effect);
    for (const item of preview) {
      const committed = changes.find(change => change.stat === item.stat)?.delta ?? 0;
      assert.equal(item.direction, committed > 0 ? 'up' : committed < 0 ? 'down' : 'flat', option.id);
    }
    assert.equal(preview.length, Object.values(option.effect).filter(value => value !== 0).length);
  }
});
