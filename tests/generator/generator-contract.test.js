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

test('合法 GeneratorContract 通过', () => {
  assert.strictEqual(Contract.validateGeneratorContract(VALID_GENERATOR(), null).valid, true);
});

test('id / subject / capabilities / knowledgePoints / supports / generate 缺失均拒绝', () => {
  const g = VALID_GENERATOR();
  delete g.id;
  assert.ok(Contract.validateGeneratorContract(g, null).errors.some(e => e.includes('id')));

  assert.ok(Contract.validateGeneratorContract(Object.assign(VALID_GENERATOR(), { subject: 'physics' }), null).errors.some(e => e.includes('subject')));

  assert.ok(Contract.validateGeneratorContract(Object.assign(VALID_GENERATOR(), { capabilities: [] }), null).errors.some(e => e.includes('capabilities')));

  assert.ok(Contract.validateGeneratorContract(Object.assign(VALID_GENERATOR(), { capabilities: ['nope'] }), null).errors.some(e => e.includes('capability 非法')));

  assert.ok(Contract.validateGeneratorContract(Object.assign(VALID_GENERATOR(), { knowledgePoints: 'x' }), null).errors.some(e => e.includes('knowledgePoints')));

  const noSupports = VALID_GENERATOR(); delete noSupports.supports;
  assert.ok(Contract.validateGeneratorContract(noSupports, null).errors.some(e => e.includes('supports')));

  const noGenerate = VALID_GENERATOR(); delete noGenerate.generate;
  assert.ok(Contract.validateGeneratorContract(noGenerate, null).errors.some(e => e.includes('generate')));
});

test('源码禁止项：Math.random / DOM / HTML / SVG / 自行决定难度', () => {
  assert.ok(Contract.validateGeneratorContract(VALID_GENERATOR(), 'var x = Math.random();').errors.some(e => e.includes('Math.random')));
  assert.ok(Contract.validateGeneratorContract(VALID_GENERATOR(), 'document.getElementById("x")').errors.some(e => e.includes('DOM')));
  assert.ok(Contract.validateGeneratorContract(VALID_GENERATOR(), 'el.innerHTML = "<div>"').errors.some(e => e.includes('HTML')));
  assert.ok(Contract.validateGeneratorContract(VALID_GENERATOR(), 'var s = "<svg></svg>"').errors.some(e => e.includes('SVG')));
  assert.ok(Contract.validateGeneratorContract(VALID_GENERATOR(), 'App.Difficulty.paramsFor("math", 3)').errors.some(e => e.includes('全局难度')));
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
  q.answer = null;
  q.answerMode = 'read-aloud';
  q.prompt = 'A';
  assert.strictEqual(Contract.validateSemanticQuestion(q).valid, true);
});

test('SemanticQuestion：questionType / numberRange / prompt 非法均拒绝', () => {
  assert.ok(Contract.validateSemanticQuestion(Object.assign(VALID_QUESTION(), { questionType: 'nope' })).errors.some(e => e.includes('questionType')));
  assert.ok(Contract.validateSemanticQuestion(Object.assign(VALID_QUESTION(), { numberRange: { min: 5, max: 1 } })).errors.some(e => e.includes('numberRange')));
  const noPrompt = VALID_QUESTION(); delete noPrompt.prompt;
  assert.ok(Contract.validateSemanticQuestion(noPrompt).errors.some(e => e.includes('prompt')));
});
