'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const NumberRange = require(path.join(ROOT, 'shared', 'strategy', 'number-range-strategy.js'));
const PluginUtil = require(path.join(ROOT, 'shared', 'common.js'));
const KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

const MAKE_TEN = () => KP.get('math-g1-m0-make-ten');

test('① 用户 settings 优先', () => {
  const r = NumberRange.resolveNumberRange({
    settings: { numberRange: { min: 5, max: 100 } },
    knowledgePoint: MAKE_TEN()
  });
  assert.deepStrictEqual({ min: r.min, max: r.max }, { min: 5, max: 100 });
  assert.strictEqual(r.source, 'user-settings');
});

test('② KP numberRangeDefault（Canonical numeric.range）', () => {
  const r = NumberRange.resolveNumberRange({ knowledgePoint: MAKE_TEN() });
  assert.deepStrictEqual({ min: r.min, max: r.max }, { min: 1, max: 20 });
  assert.strictEqual(r.source, 'knowledge-point');
});

test('min > max -> 交换，保证 min <= max', () => {
  const r = NumberRange.resolveNumberRange({
    settings: { numberRange: { min: 50, max: 3 } }
  });
  assert.strictEqual(r.min, 3);
  assert.strictEqual(r.max, 50);
  assert.ok(r.min <= r.max);
});

test('③ DifficultyStatic 回退（无 KP 数值范围时按静态 scale）', () => {
  const fakeKp = { id: 'fake', subject: 'math' };
  const r = NumberRange.resolveNumberRange({ knowledgePoint: fakeKp });
  assert.strictEqual(r.source, 'difficulty-static');
  assert.strictEqual(r.min, 1);
  assert.ok(r.max >= 1);
});

test('④ Difficulty Profile 回退（无 KP 时按 level）', () => {
  const r = NumberRange.resolveNumberRange({ level: 5 });
  assert.strictEqual(r.source, 'difficulty-profile');
  assert.strictEqual(r.min, 1);
  assert.strictEqual(r.max, PluginUtil.diffMax(20, 5));
  assert.ok(r.min <= r.max);
});

test('非法 settings.numberRange 跳过，落到下一级', () => {
  const r = NumberRange.resolveNumberRange({
    settings: { numberRange: { min: 'x' } },
    knowledgePoint: MAKE_TEN()
  });
  assert.strictEqual(r.source, 'knowledge-point');
});
