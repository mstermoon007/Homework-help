'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const CapabilityModel = require(path.join(ROOT, 'shared', 'capability-model.js'));

test('defaultCapability 结构正确', () => {
  const c = CapabilityModel.defaultCapability();
  assert.strictEqual(c.knowledgePointId, '');
  assert.ok(Array.isArray(c.questionTypes));
});

test('isValidCapability 基本检查', () => {
  assert.strictEqual(CapabilityModel.isValidCapability(CapabilityModel.defaultCapability()), true);
  assert.strictEqual(CapabilityModel.isValidCapability(null), false);
  assert.strictEqual(CapabilityModel.isValidCapability({}), false);
});

test('resolveCapability 返回可验证对象', () => {
  const c = CapabilityModel.resolveCapability({
    id: 'math-g1-m0-make-ten', name: 'make ten'
  });
  assert.ok(c.knowledgePointId);
  assert.ok(Array.isArray(c.questionTypes));
});

test('inferDifficultyRange 基本功能', () => {
  const range = CapabilityModel.inferDifficultyRange(
    { max_steps_default: 3, number_range_default: { min: 1, max: 10 } }, 'calc');
  assert.ok(Array.isArray(range) && range.length === 2);
  assert.ok(range[0] >= 1 && range[1] <= 6);
});
