'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Validator = require(path.join(ROOT, 'shared', 'strategy', 'strategy-validator.js'));

const VALID_PLAN = () => ({
  knowledgePointId: 'math-g1-m0-make-ten',
  questionTypeId: 'calc',
  count: 3,
  difficulty: 4,
  cognitiveLevel: 'apply',
  spiralLevel: 1,
  contextType: 'standard',
  constraints: {
    numberRange: { min: 1, max: 20 },
    maxSteps: 2,
    allowBracket: false,
    allowMultDiv: false
  }
});

test('合法 Plan 全部 11 项通过', () => {
  const r = Validator.validatePlan(VALID_PLAN());
  assert.strictEqual(r.valid, true);
  assert.deepStrictEqual(r.errors, []);
});

test('① KP 不存在', () => {
  const r = Validator.validatePlan(Object.assign(VALID_PLAN(), { knowledgePointId: 'nope' }));
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some(e => e.includes('知识点不存在')));
});

test('② questionType 非法', () => {
  const r = Validator.validatePlan(Object.assign(VALID_PLAN(), { questionTypeId: 'invalid_type' }));
  assert.ok(r.errors.some(e => e.includes('非法 questionTypeId')));
});

test('③ KP 不支持 questionType', () => {
  const r = Validator.validatePlan(Object.assign(VALID_PLAN(), { questionTypeId: 'geometry' }));
  assert.ok(r.errors.some(e => e.includes('KP 不支持该题型')));
});

test('④ cognitiveLevel 非法', () => {
  const r = Validator.validatePlan(Object.assign(VALID_PLAN(), { cognitiveLevel: 'mastery' }));
  assert.ok(r.errors.some(e => e.includes('非法 cognitiveLevel')));
});

test('⑤ difficulty 越界', () => {
  [0, 11, 3.5].forEach(d => {
    const r = Validator.validatePlan(Object.assign(VALID_PLAN(), { difficulty: d }));
    assert.ok(r.errors.some(e => e.includes('difficulty')), 'difficulty=' + d);
  });
});

test('⑥ spiralLevel 非法', () => {
  const r = Validator.validatePlan(Object.assign(VALID_PLAN(), { spiralLevel: 7 }));
  assert.ok(r.errors.some(e => e.includes('spiralLevel')));
});

test('⑦ spiralLevel > maxSpiralLevel', () => {
  const r = Validator.validatePlan(Object.assign(VALID_PLAN(), { spiralLevel: 2 }));
  assert.ok(r.errors.some(e => e.includes('maxSpiralLevel')));
});

test('⑧ count 非法', () => {
  const r = Validator.validatePlan(Object.assign(VALID_PLAN(), { count: 0 }));
  assert.ok(r.errors.some(e => e.includes('count')));
});

test('⑨ numberRange 非法', () => {
  const r = Validator.validatePlan(Object.assign(VALID_PLAN(), { constraints: Object.assign({}, VALID_PLAN().constraints, { numberRange: { min: 20, max: 1 } }) }));
  assert.ok(r.errors.some(e => e.includes('numberRange')));
});

test('⑩ maxSteps < 1', () => {
  const r = Validator.validatePlan(Object.assign(VALID_PLAN(), { constraints: Object.assign({}, VALID_PLAN().constraints, { maxSteps: 0 }) }));
  assert.ok(r.errors.some(e => e.includes('maxSteps')));
});

test('⑪ context 非法', () => {
  const r = Validator.validatePlan(Object.assign(VALID_PLAN(), { contextType: 'life' }));
  assert.ok(r.errors.some(e => e.includes('contextType')));
});

test('contextType none 合法', () => {
  const r = Validator.validatePlan(Object.assign(VALID_PLAN(), { contextType: 'none' }));
  assert.strictEqual(r.valid, true);
});
