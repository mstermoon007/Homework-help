'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Result = require(path.join(ROOT, 'shared', 'strategy', 'strategy-result.js'));

test('合法 StrategyResult 通过', () => {
  const r = Result.createStrategyResult([{ knowledgePointId: 'x', questionTypeId: 'calc' }]);
  const v = Result.validateStrategyResult(r);
  assert.strictEqual(v.valid, true);
});

test('plans 必须是数组', () => {
  const v = Result.validateStrategyResult({ plans: 'not-array' });
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some(e => e.includes('plans 必须是数组')));
});

test('plan 缺少 knowledgePointId -> 非法', () => {
  const r = { plans: [{ questionTypeId: 'calc' }] };
  const v = Result.validateStrategyResult(r);
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some(e => e.includes('knowledgePointId')));
});

test('plan 缺少 questionTypeId -> 非法', () => {
  const r = { plans: [{ knowledgePointId: 'x' }] };
  const v = Result.validateStrategyResult(r);
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some(e => e.includes('questionTypeId')));
});

test('prohibited fields (questions/svg/html) 被拒绝', () => {
  const r = { plans: [{ knowledgePointId: 'x', questionTypeId: 'calc' }], questions: [] };
  const v = Result.validateStrategyResult(r);
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some(e => e.includes('禁止字段')));

  const v2 = Result.validateStrategyResult({ plans: [], svg: '<svg/>' });
  assert.strictEqual(v2.valid, false);
});

test('createStrategyResult 生成标准结构', () => {
  const r = Result.createStrategyResult([{ knowledgePointId: 'x', questionTypeId: 'calc' }]);
  assert.ok(r.plans);
  assert.ok(r.meta);
  assert.strictEqual(r.meta.engine, 'strategy-v1');
  assert.ok(r.meta.version);
  assert.ok(r.meta.generatedAt);
  assert.ok(Array.isArray(r.warnings));
});