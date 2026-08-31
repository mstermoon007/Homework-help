'use strict';

/**
 * M3-24 难度回归测试
 * 固定同一 KP（math-g1-m0-make-ten），difficulty 1/3/5/7/10：
 * 检查 level / steps / numberRange / bracket / multDiv 确实发生预期变化。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
const Difficulty = require(path.join(ROOT, 'shared', 'difficulty.js'));
const NumberRange = require(path.join(ROOT, 'shared', 'strategy', 'number-range-strategy.js'));
const PluginUtil = require(path.join(ROOT, 'shared', 'common.js'));

const KP_ID = 'math-g1-m0-make-ten';
const DIFFICULTIES = [1, 3, 5, 7, 10];

function plansAt(d) {
  return Engine.plan({ knowledgePointId: KP_ID, count: 3, difficulty: d }).plans[0];
}

test('level：跟随用户难度 1/3/5/7/10', () => {
  const levels = DIFFICULTIES.map(d => plansAt(d).difficulty);
  assert.deepStrictEqual(levels, [1, 3, 5, 7, 10]);
});

test('steps：随难度分档变化 1→5', () => {
  const steps = DIFFICULTIES.map(d => plansAt(d).constraints.maxSteps);
  assert.deepStrictEqual(steps, [1, 2, 3, 4, 5]);
  // 与 difficulty.js 既有分档一致（回归对照，不复制实现）
  DIFFICULTIES.forEach((d, i) => {
    assert.strictEqual(steps[i], Difficulty.paramsFor('math', d).steps, 'difficulty=' + d);
  });
});

test('bracket：难度 5 起放开', () => {
  const brackets = DIFFICULTIES.map(d => plansAt(d).constraints.allowBracket);
  assert.deepStrictEqual(brackets, [false, false, true, true, true]);
});

test('multDiv：难度 5 起放开', () => {
  const multDivs = DIFFICULTIES.map(d => plansAt(d).constraints.allowMultDiv);
  assert.deepStrictEqual(multDivs, [false, false, true, true, true]);
});

test('scale：随难度单调递增', () => {
  const scales = DIFFICULTIES.map(d => plansAt(d).constraints.scale);
  for (let i = 1; i < scales.length; i++) {
    assert.ok(scales[i] > scales[i - 1], 'scale 应单调递增: ' + scales.join(','));
  }
  assert.strictEqual(scales[0], Difficulty.paramsFor('math', 1).scale);
  assert.strictEqual(scales[4], Difficulty.paramsFor('math', 10).scale);
});

test('numberRange：固定 KP 由 KB 权威声明（M3-12 ②），各难度保持 {1,20} 且合法', () => {
  DIFFICULTIES.forEach(d => {
    const nr = plansAt(d).constraints.numberRange;
    assert.ok(nr.min <= nr.max, 'difficulty=' + d);
    assert.deepStrictEqual(nr, { min: 1, max: 20 }, 'difficulty=' + d);
  });
});

test('numberRange：难度回退路径（无 KB 范围时）确实随难度变化', () => {
  // M3-12 ④ Difficulty Profile 回退：max = diffMax(20, level)
  const expectedMax = DIFFICULTIES.map(d => PluginUtil.diffMax(20, d));
  const actualMax = DIFFICULTIES.map(d => NumberRange.resolveNumberRange({ level: d }).max);
  assert.deepStrictEqual(actualMax, expectedMax);
  // 保证确实发生了变化（1→10 不同）
  assert.notStrictEqual(actualMax[0], actualMax[4]);
});

test('steps/bracket/multDiv 确实发生了预期变化（非恒定）', () => {
  const all = DIFFICULTIES.map(d => plansAt(d).constraints);
  assert.ok(all[0].maxSteps !== all[4].maxSteps);
  assert.ok(all[0].allowBracket !== all[4].allowBracket);
  assert.ok(all[0].allowMultDiv !== all[4].allowMultDiv);
});
