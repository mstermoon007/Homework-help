'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Plan = require(path.join(ROOT, 'shared', 'strategy', 'question-plan.js'));

test('合法完整 Plan 通过', () => {
  const plan = {
    knowledgePointId: 'math-g1-m0-make-ten',
    questionTypeId: 'calc',
    cognitiveLevel: 'apply',
    difficulty: 3,
    spiralLevel: 1,
    count: 5,
    constraints: {
      numberRange: { min: 1, max: 20 },
      maxSteps: 2,
      allowBracket: false,
      allowMultDiv: false,
      contextType: 'standard'
    }
  };
  const v = Plan.validateQuestionPlan(plan);
  assert.strictEqual(v.valid, true);
});

test('缺少 knowledgePointId -> 非法', () => {
  const v = Plan.validateQuestionPlan({
    questionTypeId: 'calc',
    difficulty: 3
  });
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some(e => e.includes('knowledgePointId')));
});

test('缺少 questionTypeId -> 非法', () => {
  const v = Plan.validateQuestionPlan({
    knowledgePointId: 'x',
    difficulty: 3
  });
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some(e => e.includes('questionTypeId')));
});

test('非法 questionTypeId -> 非法', () => {
  const v = Plan.validateQuestionPlan({
    knowledgePointId: 'x',
    questionTypeId: 'invalid_type'
  });
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some(e => e.includes('questionTypeId')));
});

test('非法 cognitiveLevel -> 非法', () => {
  const v = Plan.validateQuestionPlan({
    knowledgePointId: 'x',
    questionTypeId: 'calc',
    cognitiveLevel: 'invalid'
  });
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some(e => e.includes('cognitiveLevel')));
});

test('difficulty 越界 -> 非法', () => {
  let v = Plan.validateQuestionPlan({
    knowledgePointId: 'x',
    questionTypeId: 'calc',
    difficulty: 0
  });
  assert.strictEqual(v.valid, false);

  v = Plan.validateQuestionPlan({
    knowledgePointId: 'x',
    questionTypeId: 'calc',
    difficulty: 11
  });
  assert.strictEqual(v.valid, false);
});

test('spiralLevel 越界 -> 非法', () => {
  let v = Plan.validateQuestionPlan({
    knowledgePointId: 'x',
    questionTypeId: 'calc',
    spiralLevel: 0
  });
  assert.strictEqual(v.valid, false);

  v = Plan.validateQuestionPlan({
    knowledgePointId: 'x',
    questionTypeId: 'calc',
    spiralLevel: 7
  });
  assert.strictEqual(v.valid, false);
});

test('constraints.numberRange 格式错误 -> 非法', () => {
  const v = Plan.validateQuestionPlan({
    knowledgePointId: 'x',
    questionTypeId: 'calc',
    constraints: { numberRange: { min: 10, max: 1 } }
  });
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some(e => e.includes('min <= max')));
});

test('prohibited fields 被拒绝', () => {
  const v = Plan.validateQuestionPlan({
    knowledgePointId: 'x',
    questionTypeId: 'calc',
    svg: '<svg/>'
  });
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some(e => e.includes('禁止字段')));
});

test('cognitiveLevel 合法值通过', () => {
  const validLevels = ['recall', 'recognize', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
  validLevels.forEach(level => {
    const v = Plan.validateQuestionPlan({
      knowledgePointId: 'x',
      questionTypeId: 'calc',
      cognitiveLevel: level
    });
    assert.strictEqual(v.valid, true, 'cognitiveLevel ' + level + ' 应通过');
  });
});

test('constraints.contextType 合法值通过', () => {
  const validContexts = ['pure', 'simple', 'standard', 'complex'];
  validContexts.forEach(ctx => {
    const v = Plan.validateQuestionPlan({
      knowledgePointId: 'x',
      questionTypeId: 'calc',
      constraints: { contextType: ctx }
    });
    assert.strictEqual(v.valid, true, 'contextType ' + ctx + ' 应通过');
  });
});