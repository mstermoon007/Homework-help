// test/unit/strategyFor.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Difficulty = require('../../shared/difficulty.js');

test.describe('strategyFor / DELTA_RULES', () => {
  test('math / cn / en 返回 DELTA_RULES（含 apply）', () => {
    ['math', 'cn', 'en'].forEach(function (subject) {
      const rules = Difficulty.strategyFor(subject);
      assert.ok(rules && typeof rules.apply === 'function', subject + ' 应返回含 apply 的规则');
    });
  });

  test('未知科目回落 math 策略（返回含 apply 的规则，非 null）', () => {
    const rules = Difficulty.strategyFor('music');
    assert.ok(rules && typeof rules.apply === 'function', '未知科目应回落 math 规则');
  });

  test('apply 分支符合 DELTA_RULES', () => {
    const rules = Difficulty.strategyFor('math');
    // 高正确率 + 近乎全对：强升档
    assert.deepStrictEqual(rules.apply({ emaRate: 0.9, lastRate: 1 }),
      { delta: 2, bias: 'hard' });
    // 正确率 0.8 以上：升档
    assert.deepStrictEqual(rules.apply({ emaRate: 0.83, lastRate: 0.7 }),
      { delta: 1, bias: 'hard' });
    // 正确率 <= 0.5：强降档
    assert.deepStrictEqual(rules.apply({ emaRate: 0.4, lastRate: 0.5 }),
      { delta: -2, bias: 'easy' });
    // 正确率 <= 0.65：降档
    assert.deepStrictEqual(rules.apply({ emaRate: 0.6, lastRate: 0.6 }),
      { delta: -1, bias: 'easy' });
    // 中段：不调整
    assert.deepStrictEqual(rules.apply({ emaRate: 0.72, lastRate: 0.7 }),
      { delta: 0, bias: null });
  });

  test('createProfile 叠加 delta 到 baseLevel 并夹紧到 1..10', () => {
    const p1 = Difficulty.createProfile(3, 2);
    assert.strictEqual(p1.effectiveLevel, 5, '3 + 2 = 5');
    const p2 = Difficulty.createProfile(9, 5);
    assert.strictEqual(p2.effectiveLevel, 10, '应夹紧到 10');
    const p3 = Difficulty.createProfile(2, -5);
    assert.strictEqual(p3.effectiveLevel, 1, '应夹紧到 1');
    assert.ok(typeof p1.scale === 'number' && p1.structure && p1.typePreference, '应返回 scale/structure/typePreference');
  });
});
