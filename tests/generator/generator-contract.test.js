'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Contract = require(path.join(ROOT, 'shared', 'generator', 'generator-contract.js'));

const VALID_GENERATOR = () => ({
  id: 'generator:test',
  subject: 'math',
  capabilities: ['calc'],
  knowledgePoints: ['math-g1-m0-make-ten'],
  supports: function (plan) { return plan && plan.questionTypeId === 'calc'; },
  generate: function (plan, context) { return []; }
});

const VALID_QUESTION = () => ({
  knowledgePointId: 'math-g1-m0-make-ten',
  questionType: 'calc',
  difficulty: 3,
  difficultyParams: { level: 3, scale: 1, steps: 2, allowBracket: false, allowMultDiv: false },
  numberRange: { min: 1, max: 20 },
  spiralLevel: 1,
  context: 'standard',
  seed: 's:0',
  prompt: '9 + 5 = ?',
  answer: '14',
  hint: null,
  data: { kind: 'cushi' }
});

test('合法 GeneratorContract 通过（仅检查 supports/generate）', () => {
  assert.strictEqual(Contract.validateGeneratorContract(VALID_GENERATOR(), null).valid, true);
});

test('supports / generate 缺失均拒绝', () => {
  const noSupports = VALID_GENERATOR(); delete noSupports.supports;
  assert.ok(Contract.validateGeneratorContract(noSupports, null).errors.some(e => e.includes('supports')));

  const noGenerate = VALID_GENERATOR(); delete noGenerate.generate;
  assert.ok(Contract.validateGeneratorContract(noGenerate, null).errors.some(e => e.includes('generate')));
});

test('合法 SemanticQuestion 通过', () => {
  assert.strictEqual(Contract.validateSemanticQuestion(VALID_QUESTION()).valid, true);
});

test('SemanticQuestion：渲染/执行字段被拒绝', () => {
  const q = VALID_QUESTION();
  q.render = function () {};
  q.check = function () {};
  assert.ok(Contract.validateSemanticQuestion(q).errors.some(e => e.includes('禁止字段')));
});

test('SemanticQuestion：answer 必填（input 模式）', () => {
  const q = VALID_QUESTION();
  q.answer = null;
  assert.ok(Contract.validateSemanticQuestion(q).errors.some(e => e.includes('answer 必填')));
});

test('SemanticQuestion：read-aloud 模式 answer 可空', () => {
  const q = VALID_QUESTION();
  q.answerMode = 'read-aloud';
  q.answer = null;
  assert.strictEqual(Contract.validateSemanticQuestion(q).valid, true);
});

test('SemanticQuestion：questionType / numberRange / prompt 非法均拒绝', () => {
  const q = VALID_QUESTION();
  q.questionType = 'nope';
  assert.ok(Contract.validateSemanticQuestion(q).errors.some(e => e.includes('questionType')));

  q.questionType = 'calc'; q.numberRange = { min: 20, max: 1 };
  assert.ok(Contract.validateSemanticQuestion(q).errors.some(e => e.includes('numberRange')));

  q.numberRange = { min: 1, max: 20 }; q.prompt = 123;
  assert.ok(Contract.validateSemanticQuestion(q).errors.some(e => e.includes('prompt')));
});