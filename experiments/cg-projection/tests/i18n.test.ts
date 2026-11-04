import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { bi, cat, f, loadLanguage, primaryText, accessibleText, setLanguage } from '../src/i18n/text';
import { CURTAIN_FADE_MS, CURTAIN_HOLD_MS, REDUCED_CURTAIN_MS } from '../src/ui/transitions';
import { checkSource } from '../scripts/check-i18n';

test('language defaults to bilingual and survives missing, invalid, or blocked storage', () => {
  assert.equal(loadLanguage(), 'dual');
  assert.equal(loadLanguage({ getItem: () => 'invalid' }), 'dual');
  assert.equal(loadLanguage({ getItem: () => { throw new Error('blocked'); } }), 'dual');
  for (const mode of ['zh', 'en', 'dual'] as const) assert.equal(loadLanguage({ getItem: () => mode }), mode);
});
test('paired text composes nested data and numeric feedback without object coercion', () => {
  const name = bi('伯尔', 'Burr');
  assert.deepEqual(f(bi('{0} 尊重 +{1}', '{0} Respect +{1}'), name, 10), bi('伯尔 尊重 +10', 'Burr Respect +10'));
  assert.deepEqual(cat`${name} · 10`, bi('伯尔 · 10', 'Burr · 10'));
  setLanguage('en'); assert.equal(primaryText(name), 'Burr'); assert.equal(accessibleText(name), 'Burr');
  setLanguage('zh'); assert.equal(primaryText(name), '伯尔');
  setLanguage('dual'); assert.equal(primaryText(name), '伯尔'); assert.equal(accessibleText(name), '伯尔 / Burr');
});
test('translation gate rejects missing partners and mismatched dynamic parameters', () => {
  const check = (code: string) => checkSource(ts.createSourceFile('fixture.ts', code, ts.ScriptTarget.Latest, true));
  assert.equal(check('const x = bi("下一幕", "Next chapter");').length, 0);
  assert.ok(check('const x = "下一幕";').length > 0);
  assert.ok(check('const x = bi("下一幕", "");').length > 0);
  assert.ok(check('const x = bi("得分 {0}", "Score {1}");').length > 0);
  assert.ok(check('const x = bi("得分", "得分");').length > 0);
  assert.ok(check('el("p", "", "Next chapter");').length > 0);
  assert.ok(check('setText(node, "Next chapter");').length > 0);
  assert.ok(check('el("p", "", `Score ${score}`);').length > 0);
  assert.equal(check('class Scene { constructor() { super("Boot"); } }').length, 0);
});
test('ordinary fade, title wait, and reduced-motion wait are exactly 2.5 times their prior values', () => {
  assert.equal(CURTAIN_FADE_MS, 220 * 2.5); assert.equal(CURTAIN_HOLD_MS, 1150 * 2.5); assert.equal(REDUCED_CURTAIN_MS, 100 * 2.5);
});
