// test/unit/allocateByWeight.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const CS = require('../../shared/strategy/comprehensive-strategy.js');

// 分配器自 comprehensive 重构后移入 shared/strategy/comprehensive-strategy.js
// 签名：allocateByWeight(weights, total) → number[]（和为 total，长度 = weights.length）
// 旧版 math-comprehensive.js（已删）签名 allocateByWeight(count, plugins, weights) → 顺序调整
const allocateByWeight = (count, plugins, weights) => CS.allocateByWeight(weights, count);

test.describe('allocateByWeight', () => {
  test('返回数组长度等于插件数', () => {
    const plugins = ['a', 'b', 'c'];
    const alloc = allocateByWeight(10, plugins, [3, 1, 1]);
    assert.strictEqual(alloc.length, 3);
  });

  test('分配总和始终等于 count', () => {
    const cases = [
      { count: 10, plugins: ['a', 'b', 'c'], weights: [3, 1, 1] },
      { count: 7, plugins: ['a', 'b', 'c', 'd'], weights: [1, 1, 1, 1] },
      { count: 20, plugins: ['a', 'b'], weights: [2, 1] },
      { count: 1, plugins: ['a', 'b', 'c'], weights: [5, 3, 2] },
      { count: 13, plugins: ['a', 'b', 'c', 'd', 'e'], weights: [4, 4, 4, 4, 4] }
    ];
    cases.forEach(function (c) {
      const alloc = allocateByWeight(c.count, c.plugins, c.weights);
      const sum = alloc.reduce(function (s, x) { return s + x; }, 0);
      assert.strictEqual(sum, c.count, '分配总和应等于 count: ' + JSON.stringify(c));
    });
  });

  test('无负数且均为整数', () => {
    const alloc = allocateByWeight(17, ['a', 'b', 'c', 'd'], [3, 0, 5, 2]);
    alloc.forEach(function (x) {
      assert.ok(Number.isInteger(x), '应为整数: ' + x);
      assert.ok(x >= 0, '不应为负: ' + x);
    });
  });

  test('零权重项分配为 0（其余按权重均分，总和不变）', () => {
    const alloc = allocateByWeight(12, ['a', 'b', 'c'], [3, 0, 1]);
    assert.strictEqual(alloc[1], 0, '零权重项应得 0');
    const sum = alloc.reduce(function (s, x) { return s + x; }, 0);
    assert.strictEqual(sum, 12, '总和仍应等于 count');
  });

  test('全部无权重时返回全零（策略层语义：权重和为 0 → 不分配）', () => {
    const alloc = allocateByWeight(10, ['a', 'b', 'c'], [0, 0, 0]);
    assert.deepStrictEqual(alloc, [0, 0, 0], '无权重项不做均分退避，返回全零');
  });

  test('count=0 时返回全零数组', () => {
    const alloc = allocateByWeight(0, ['a', 'b', 'c'], [1, 2, 3]);
    assert.deepStrictEqual(alloc, [0, 0, 0]);
  });
});