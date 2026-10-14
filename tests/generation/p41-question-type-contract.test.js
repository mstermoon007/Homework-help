/**
 * tests/generation/p41-question-type-contract.test.js — P41-A3 / D
 *
 * A3 审计结论（三处题型谓词）：
 *   - Schema.isValidQuestionType  = canonical 7 ∪ 显式别名（CANONICAL_ALIASES，无启发式）；不含 read-aloud。
 *   - QTR.has                     = canonical 7 ∪ 显式别名；与 Schema 等价。
 *   - 工厂 semantic-question.js   = canonical 7 ∪ {read-aloud}；【不收别名】。
 *   - generator-contract.js       = QTR.has ∪ Schema ∪ {read-aloud}；收别名。
 *
 * 权威定义：canonical 题型 = 7 类；别名 = 显式历史深链；read-aloud = answerMode（非 canonical 题型）。
 * 本测试锁定三层现状与 read-aloud 边界，作为谓词统一前的回归护栏；
 * 谓词合并（需改 bundled shared 源并重建 strategy-engine.bundle.js）列为后续决策项。
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Schema = require(path.join(ROOT, 'shared', 'schemas', 'semantic-question.schema.js'));
const QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
const SQ = require(path.join(ROOT, 'shared', 'semantic', 'semantic-question.js'));
const Contract = require(path.join(ROOT, 'shared', 'generator', 'generator-contract.js'));

const CANONICAL = ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];
const ALIASES = ['operate', 'oral', 'word', 'multdiv', 'matching'];

function factoryHasQuestionTypeError(qt) {
  const q = SQ.createSemanticQuestion({
    knowledgePointId: 'math-g1-up-u01-k001', questionType: qt,
    difficulty: 3, numberRange: { min: 1, max: 10 }, prompt: 'p', answer: '1'
  });
  return SQ.validateSchema(q).errors.some((e) => e.field === 'questionType');
}

function contractQuestion(qt, extra) {
  return Object.assign({
    knowledgePointId: 'math-g1-up-u01-k001', questionType: qt, difficulty: 3,
    difficultyParams: { level: 3, scale: 1, steps: 2 },
    numberRange: { min: 1, max: 20 }, prompt: '9 + 5 = ?', answer: '14'
  }, extra || {});
}

test('D 七类 canonical：Schema / QTR / 工厂 / GeneratorContract 全部接受', () => {
  assert.deepStrictEqual(Schema.QUESTION_TYPES, CANONICAL);
  CANONICAL.forEach((t) => {
    assert.strictEqual(Schema.isValidQuestionType(t), true, 'Schema 应接受 ' + t);
    assert.strictEqual(QTR.has(t), true, 'QTR 应接受 ' + t);
    assert.strictEqual(factoryHasQuestionTypeError(t), false, '工厂应接受 ' + t);
    assert.strictEqual(Contract.validateSemanticQuestion(contractQuestion(t)).valid, true, 'Contract 应接受 ' + t);
  });
});

test('D 显式别名：Schema / QTR / GeneratorContract 接受（工厂为更窄边界，不含别名）', () => {
  ALIASES.forEach((t) => {
    assert.strictEqual(Schema.isValidQuestionType(t), true, 'Schema 应接受别名 ' + t);
    assert.strictEqual(QTR.has(t), true, 'QTR 应接受别名 ' + t);
    assert.strictEqual(Contract.validateSemanticQuestion(contractQuestion(t)).valid, true, 'Contract 应接受别名 ' + t);
    assert.strictEqual(factoryHasQuestionTypeError(t), true, '工厂当前不收别名（边界锁定）: ' + t);
  });
});

test('D read-aloud 边界：Schema 不作题型接受；工厂/Contract 作为兼容题型接受', () => {
  assert.strictEqual(Schema.isValidQuestionType('read-aloud'), false, 'read-aloud 非 canonical 题型');
  assert.strictEqual(QTR.has('read-aloud'), false, 'read-aloud 不在 canonical/别名表');
  assert.strictEqual(factoryHasQuestionTypeError('read-aloud'), false, '工厂兼容接受 read-aloud');
  assert.strictEqual(
    Contract.validateSemanticQuestion(contractQuestion('read-aloud', { answerMode: 'read-aloud', answer: null })).valid,
    true, 'Contract 兼容接受 read-aloud（且 answer 可空）'
  );
});

test('D read-aloud 是合法 answerMode（权威归属）', () => {
  assert.strictEqual(Schema.isValidAnswerMode('read-aloud'), true);
  ['input', 'choice', 'multi', 'none'].forEach((m) => assert.strictEqual(Schema.isValidAnswerMode(m), true));
  assert.strictEqual(Schema.isValidAnswerMode('nope'), false);
});

test('D 未知题型：四层一致拒绝', () => {
  assert.strictEqual(Schema.isValidQuestionType('nope'), false);
  assert.strictEqual(QTR.has('nope'), false);
  assert.strictEqual(factoryHasQuestionTypeError('nope'), true);
  assert.ok(Contract.validateSemanticQuestion(contractQuestion('nope')).errors.some((e) => e.includes('questionType')));
});
