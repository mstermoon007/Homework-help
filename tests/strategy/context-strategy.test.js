'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Context = require(path.join(ROOT, 'shared', 'strategy', 'context-strategy.js'));
const KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

const MAKE_TEN = () => KP.get('math-g1-m0-make-ten');

test('QuestionType 不支持 context（geometry）-> none', () => {
  assert.strictEqual(Context.resolveContextType({ knowledgePoint: MAKE_TEN(), questionType: 'geometry' }), 'none');
});

test('QuestionType 不支持 context（recognize）-> none', () => {
  assert.strictEqual(Context.resolveContextType({ knowledgePoint: MAKE_TEN(), questionType: 'recognize' }), 'none');
});

test('支持 context -> KP contextDefault（standard）', () => {
  assert.strictEqual(Context.resolveContextType({ knowledgePoint: MAKE_TEN(), questionType: 'calc' }), 'standard');
});

test('高螺旋（>=4）-> 提高一档（standard -> complex）', () => {
  assert.strictEqual(Context.resolveContextType({ knowledgePoint: MAKE_TEN(), questionType: 'calc', spiralLevel: 4 }), 'complex');
});

test('应用认知（apply）-> 提高一档（simple -> standard）', () => {
  const kp = { id: 'x', context: { defaults: ['simple'] } };
  assert.strictEqual(Context.resolveContextType({ knowledgePoint: kp, questionType: 'calc', cognitiveLevel: 'apply' }), 'standard');
});

test('封顶 complex', () => {
  assert.strictEqual(Context.resolveContextType({ knowledgePoint: MAKE_TEN(), questionType: 'calc', spiralLevel: 6, cognitiveLevel: 'apply' }), 'complex');
});

test('无 KP / 低螺旋 / 低认知 -> 默认 standard', () => {
  assert.strictEqual(Context.resolveContextType({ questionType: 'calc' }), 'standard');
});

test('高螺旋不作用于不支持 context 的题型', () => {
  assert.strictEqual(Context.resolveContextType({ knowledgePoint: MAKE_TEN(), questionType: 'geometry', spiralLevel: 6 }), 'none');
});

test('非法 questionTypeId -> 抛出错误', () => {
  assert.throws(() => {
    Context.resolveContextType({ questionType: 'invalid_type' });
  }, /非法 questionTypeId/);
});
