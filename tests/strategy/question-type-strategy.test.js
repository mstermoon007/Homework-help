'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Strategy = require(path.join(ROOT, 'shared', 'strategy', 'question-type-strategy.js'));
const KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

test('用户明确指定 questionType -> 直接返回', () => {
  const qt = Strategy.selectQuestionType(
    KP.get('math-g1-m0-make-ten'),
    { questionTypeId: 'calc' }
  );
  assert.strictEqual(qt, 'calc');
});

test('非法 questionType -> 抛出错误', () => {
  let threw = false;
  try {
    Strategy.selectQuestionType(
      KP.get('math-g1-m0-make-ten'),
      { questionTypeId: 'invalid_type' }
    );
  } catch (e) {
    assert.ok(e.message.includes('非法 questionTypeId'));
  }
});

test('KP 不支持的题型 -> 抛出错误', () => {
  let threw = false;
  try {
    Strategy.selectQuestionType(
      KP.get('math-g1-m0-make-ten'),
      { questionTypeId: 'geometry' }
    );
  } catch (e) {
    assert.ok(e.message.includes('KP 不支持该题型'));
  }
});

test('默认返回 calc', () => {
  const qt = Strategy.selectQuestionType(
    KP.get('math-g1-m0-make-ten'),
    {}
  );
  assert.strictEqual(qt, 'calc');
});

test('subtype 归一化后受支持 -> 返回 (②)', () => {
  const qt = Strategy.selectQuestionType(
    KP.get('math-g1-m0-make-ten'),
    { subtype: 'cushi' }
  );
  assert.strictEqual(qt, 'calc');
});

test('subtype 归一化后不受支持 -> 落到默认 (②→④)', () => {
  const qt = Strategy.selectQuestionType(
    KP.get('math-g1-m0-make-ten'),
    { subtype: 'circle' }
  );
  assert.strictEqual(qt, 'calc');
});

test('cognitiveLevel 匹配 -> 返回匹配题型 (③)', () => {
  const qt = Strategy.selectQuestionType(
    KP.get('math-g1-m0-make-ten'),
    { cognitiveLevel: 'apply' }
  );
  assert.strictEqual(qt, 'calc');
});

test('cognitiveLevel 无匹配 -> 落到默认 (③→④)', () => {
  const qt = Strategy.selectQuestionType(
    KP.get('math-g1-m0-make-ten'),
    { cognitiveLevel: 'create' }
  );
  assert.strictEqual(qt, 'calc');
});

test('KP 默认题型来自 presentation.questionTypes (④)', () => {
  const qt = Strategy.selectQuestionType(
    KP.get('math-g1-m0-make-ten'),
    {}
  );
  assert.strictEqual(qt, 'calc');
  const kp = KP.get('math-g1-m0-make-ten');
  assert.ok(kp.presentation.questionTypes.length >= 1);
});