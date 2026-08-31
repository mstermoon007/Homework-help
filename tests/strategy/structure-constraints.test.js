'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const StructureConstraints = require(path.join(ROOT, 'shared', 'strategy', 'structure-constraints.js'));
const StaticDifficulty = require(path.join(ROOT, 'shared', 'strategy', 'static-difficulty.js'));
const Difficulty = require(path.join(ROOT, 'shared', 'difficulty.js'));
const KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

const MAKE_TEN = () => KP.get('math-g1-m0-make-ten');

test('最终难度 === 静态难度 -> 复用 difficulty-static.js 已有逻辑', () => {
  const staticProfile = StaticDifficulty.resolveStaticDifficulty(MAKE_TEN(), 'calc', {});
  const r = StructureConstraints.resolveStructureConstraints({ knowledgePoint: MAKE_TEN(), questionType: 'calc' });
  assert.strictEqual(r.finalDifficulty, staticProfile.level);
  assert.strictEqual(r.maxSteps, staticProfile.steps);
  assert.strictEqual(r.allowBracket, staticProfile.allowBracket);
  assert.strictEqual(r.allowMultDiv, staticProfile.allowMultDiv);
  assert.ok(r.numberRange.min <= r.numberRange.max);
});

test('最终难度不同 -> 复用 paramsFor 既有链路（不复制分档表）', () => {
  const r = StructureConstraints.resolveStructureConstraints({
    knowledgePoint: MAKE_TEN(), questionType: 'calc', finalDifficulty: 9
  });
  const expected = Difficulty.paramsFor('math', 9);
  assert.strictEqual(r.maxSteps, expected.steps);
  assert.strictEqual(r.allowBracket, expected.allowBracket);
  assert.strictEqual(r.allowMultDiv, expected.allowMultDiv);
  assert.strictEqual(r.finalDifficulty, 9);
});

test('customParams 覆盖 steps', () => {
  const r = StructureConstraints.resolveStructureConstraints({
    knowledgePoint: MAKE_TEN(), questionType: 'calc', customParams: { steps: 4 }
  });
  assert.strictEqual(r.maxSteps, 4);
});

test('numberRange：用户 settings 优先', () => {
  const r = StructureConstraints.resolveStructureConstraints({
    knowledgePoint: MAKE_TEN(), questionType: 'calc',
    settings: { numberRange: { min: 10, max: 50 } }
  });
  assert.deepStrictEqual(r.numberRange, { min: 10, max: 50 });
});

test('numberRange：缺省来自 KP numberRangeDefault，min <= max', () => {
  const r = StructureConstraints.resolveStructureConstraints({ knowledgePoint: MAKE_TEN(), questionType: 'calc' });
  assert.deepStrictEqual(r.numberRange, { min: 1, max: 20 });
});

test('finalDifficulty 非有限数字 -> 抛出错误', () => {
  assert.throws(() => {
    StructureConstraints.resolveStructureConstraints({ knowledgePoint: MAKE_TEN(), finalDifficulty: 'x' });
  }, /finalDifficulty 必须是有限数字/);
});
