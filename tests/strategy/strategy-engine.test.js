'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
const Validator = require(path.join(ROOT, 'shared', 'strategy', 'strategy-validator.js'));

test('plan：完整链（Request → … → Validator）', () => {
  const r = Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 3, difficulty: 4 });
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.plans.length, 1);
  const plan = r.plans[0];
  assert.strictEqual(plan.knowledgePointId, 'math-g1-m0-make-ten');
  assert.strictEqual(plan.questionTypeId, 'calc');
  assert.strictEqual(plan.count, 3);
  assert.strictEqual(plan.difficulty, 4);
  assert.ok(['recognize', 'understand', 'apply'].includes(plan.cognitiveLevel));
  assert.ok(plan.constraints.numberRange.min <= plan.constraints.numberRange.max);
  assert.ok(plan.constraints.maxSteps >= 1);
  // 引擎产出必须通过 M3-18 校验
  assert.strictEqual(Validator.validatePlan(plan).valid, true);
});

test('plan：未指定难度 -> 静态难度', () => {
  const r = Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 2 });
  assert.ok(r.plans[0].difficulty >= 1 && r.plans[0].difficulty <= 10);
  assert.strictEqual(r.meta.targetDifficulty, r.meta.staticLevel);
});

test('plan：自适应开启 -> effective = target + delta', () => {
  const r = Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 2, difficulty: 3, adaptive: true, adaptiveDelta: 2 });
  assert.strictEqual(r.plans[0].difficulty, 5);
  assert.strictEqual(r.plans[0].adaptiveDelta, 2);
});

test('plan：settings.numberRange 优先进入 constraints', () => {
  const r = Engine.plan({
    knowledgePointId: 'math-g1-m0-make-ten', count: 2,
    settings: { numberRange: { min: 10, max: 50 } }
  });
  assert.deepStrictEqual(r.plans[0].constraints.numberRange, { min: 10, max: 50 });
});

test('plan：KP 不支持的显式 questionType -> 抛出错误（不允许进入 Generator）', () => {
  assert.throws(() => {
    Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 2, questionType: 'geometry' });
  }, /KP 不支持该题型/);
});

test('plan：缺少 knowledgePointId -> 抛出错误', () => {
  assert.throws(() => {
    Engine.plan({ count: 2 });
  }, /knowledgePointId/);
});

test('plan：未知 KP -> 抛出错误', () => {
  assert.throws(() => {
    Engine.plan({ knowledgePointId: 'not-exist', count: 2 });
  }, /知识点不存在/);
});

test('plan：count 非法 -> 抛出错误', () => {
  assert.throws(() => {
    Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 0 });
  }, /count/);
});

test('plan：subtype 归一化（cushi -> calc）', () => {
  const r = Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 1, subtype: 'cushi' });
  assert.strictEqual(r.plans[0].questionTypeId, 'calc');
  assert.strictEqual(r.plans[0].subtype, 'cushi');
});

test('M3-22：debug=true 输出 11 步 strategyTrace', () => {
  const r = Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 2, debug: true });
  assert.ok(Array.isArray(r.strategyTrace));
  assert.strictEqual(r.strategyTrace.length, 11);
  const names = r.strategyTrace.map(s => s.name);
  assert.deepStrictEqual(names, [
    'KP', 'Capability', 'QuestionType', 'Cognitive', 'Static Difficulty',
    'Adaptive Delta', 'Effective Difficulty', 'Structure', 'Spiral', 'Context', 'Count'
  ]);
  assert.strictEqual(r.strategyTrace[0].value, 'math-g1-m0-make-ten');
  assert.strictEqual(r.strategyTrace[2].value, 'calc');
  assert.strictEqual(r.strategyTrace[6].value, r.plans[0].difficulty);
  assert.strictEqual(r.strategyTrace[10].value, 2);
});

test('M3-22：debug 缺省不输出 strategyTrace', () => {
  const r = Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 2 });
  assert.strictEqual(r.strategyTrace, undefined);
});

test('M3-22：formatStrategyTrace 渲染决策链文本', () => {
  const r = Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 2, debug: true });
  const text = Engine.formatStrategyTrace(r.strategyTrace);
  const lines = text.split('\n  ↓\n');
  assert.strictEqual(lines.length, 11);
  assert.ok(lines[0].startsWith('KP : '));
  assert.ok(lines[10].startsWith('Count : 2'));
});
