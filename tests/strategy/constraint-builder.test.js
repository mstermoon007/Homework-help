'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Builder = require(path.join(ROOT, 'shared', 'strategy', 'constraint-builder.js'));
const Difficulty = require(path.join(ROOT, 'shared', 'difficulty.js'));

const PIECES = () => ({
  difficulty: 4,
  questionType: 'calc',
  cognitiveLevel: 'apply',
  spiralLevel: 1,
  contextType: 'complex',
  numberRange: { min: 1, max: 20 },
  maxSteps: 2,
  allowBracket: false,
  allowMultDiv: false
});

test('组装输出 Generator 可直接消费的结构', () => {
  const c = Builder.buildConstraints(PIECES());
  assert.deepStrictEqual(Object.keys(c).sort(), [
    'allowBracket', 'allowMultDiv', 'cognitiveLevel', 'contextType', 'difficulty',
    'maxSteps', 'numberRange', 'questionType', 'scale', 'spiralLevel'
  ]);
  assert.strictEqual(c.difficulty, 4);
  assert.strictEqual(c.questionType, 'calc');
  assert.strictEqual(c.cognitiveLevel, 'apply');
  assert.strictEqual(c.spiralLevel, 1);
  assert.strictEqual(c.contextType, 'complex');
  assert.deepStrictEqual(c.numberRange, { min: 1, max: 20 });
  assert.strictEqual(c.maxSteps, 2);
  assert.strictEqual(c.allowBracket, false);
  assert.strictEqual(c.allowMultDiv, false);
});

test('scale 复用 difficulty.js 既有逻辑（不复制公式）', () => {
  const c = Builder.buildConstraints(PIECES());
  assert.strictEqual(c.scale, Difficulty.paramsFor('math', 4).scale);
});

test('numberRange min > max -> 抛出错误', () => {
  assert.throws(() => {
    Builder.buildConstraints(Object.assign(PIECES(), { numberRange: { min: 50, max: 3 } }));
  }, /numberRange 非法/);
});

test('缺少部件 -> 抛出错误', () => {
  ['difficulty', 'questionType', 'cognitiveLevel', 'spiralLevel', 'contextType',
    'numberRange', 'maxSteps', 'allowBracket', 'allowMultDiv'].forEach(key => {
    const pieces = PIECES();
    delete pieces[key];
    assert.throws(() => Builder.buildConstraints(pieces), /缺少部件/);
  });
});
