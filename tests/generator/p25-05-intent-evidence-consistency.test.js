'use strict';

/**
 * tests/generator/p25-05-intent-evidence-consistency.test.js — P25-05 意图×证据一致性门禁
 *
 * 冻结不变量：
 *   1. 三态：skip=题目未声明 relations / pass=声明关系全在 allowedRelations 内 /
 *      fail=存在跨家族矛盾关系（KP_SEMANTIC_INTENT_CONFLICT, ERROR）。
 *   2. 跨家族矛盾：几何 KP 声明算术关系（add-combine 等）→ fail；
 *      算术 KP 声明几何关系（vertex-rays 等）→ fail。
 *   3. 同家族共存：几何 KP 同时声明 vertex-rays + area-surface → pass。
 *   4. A 类 4 代表 KP 规则行端到端：evidence=pass 且 intent=pass。
 *   5. 规则数据 intent-relations.json 完整性：family+operations 映射覆盖 8 大家族，
 *      forbiddenAcrossFamilies 双向禁表存在。
 */

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const KpSemantic = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

const KP_TIMES = 'math-g2-down-u03-k003';
const KP_FRACTION = 'math-g5-down-u04-k001';
const KP_ANGLE = 'math-g3-up-u07-k002';
const KP_AREA = 'math-g3-down-u04-k001';

function sqOf(kp, relations) {
  return { knowledgePointIds: [kp], questionType: 'fill', data: { semanticEvidence: { relations: relations || [] } } };
}

before(() => {});

test('skip：题目未声明 relations → 不产 error', () => {
  const r = KpSemantic.checkIntentEvidenceConsistency(sqOf(KP_ANGLE), KP_ANGLE);
  assert.equal(r.state, 'skip');
  assert.equal(r.errors.length, 0);
});

test('pass：几何 KP 声明同家族关系（vertex-rays + area-surface）→ 通过', () => {
  const r = KpSemantic.checkIntentEvidenceConsistency(sqOf(KP_ANGLE, ['vertex-rays', 'area-surface']), KP_ANGLE);
  assert.equal(r.state, 'pass');
  assert.equal(r.errors.length, 0);
});

test('fail：几何 KP 声明算术关系 add-combine → 跨家族矛盾 ERROR', () => {
  const r = KpSemantic.checkIntentEvidenceConsistency(sqOf(KP_ANGLE, ['add-combine']), KP_ANGLE);
  assert.equal(r.state, 'fail');
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].code, 'KP_SEMANTIC_INTENT_CONFLICT');
  assert.equal(r.errors[0].severity, 'ERROR');
  assert.deepEqual(r.errors[0].detail.conflicts, ['add-combine']);
});

test('fail：算术（倍）KP 声明几何关系 vertex-rays → 跨家族矛盾', () => {
  const r = KpSemantic.checkIntentEvidenceConsistency(sqOf(KP_TIMES, ['vertex-rays']), KP_TIMES);
  assert.equal(r.state, 'fail');
});

test('pass：倍的 KP 声明 multiply-by-times + times-compare → 同家族通过', () => {
  const r = KpSemantic.checkIntentEvidenceConsistency(sqOf(KP_TIMES, ['multiply-by-times', 'times-compare']), KP_TIMES);
  assert.equal(r.state, 'pass');
});

test('pass：分数 KP 声明 unit-one + equal-partition → 通过', () => {
  const r = KpSemantic.checkIntentEvidenceConsistency(sqOf(KP_FRACTION, ['unit-one', 'equal-partition']), KP_FRACTION);
  assert.equal(r.state, 'pass');
});

test('fail：分数 KP 声明 vertex-rays → 跨家族矛盾', () => {
  const r = KpSemantic.checkIntentEvidenceConsistency(sqOf(KP_FRACTION, ['vertex-rays']), KP_FRACTION);
  assert.equal(r.state, 'fail');
});

test('三态进入 validateKpSemantics.checks.intentConsistency 与 result.intentConsistency', () => {
  const passSq = sqOf(KP_ANGLE, ['vertex-rays']);
  const out = KpSemantic.validateKpSemantics(passSq, { kpId: KP_ANGLE, kpConstraints: null, plan: null });
  assert.equal(out.intentConsistency, 'pass');
  assert.equal(out.checks.intentConsistency, 'pass');

  const failSq = sqOf(KP_ANGLE, ['add-combine']);
  const out2 = KpSemantic.validateKpSemantics(failSq, { kpId: KP_ANGLE, kpConstraints: null, plan: null });
  assert.equal(out2.intentConsistency, 'fail');
  assert.equal(out2.valid, false, '跨家族矛盾必须使整体 invalid');
});

test('intent-relations.json：规则覆盖 8 大家族 + 双向禁表', () => {
  const doc = require(path.join(ROOT, 'kbl', 'teaching', 'intent-relations.json'));
  assert.ok(Array.isArray(doc.rules) && doc.rules.length >= 8, '规则数 ≥ 8');
  assert.ok(doc.forbiddenAcrossFamilies.geometry, '几何禁表存在');
  assert.ok(doc.forbiddenAcrossFamilies['algebra-arithmetic'], '算术禁表存在');
  // 禁表对称性：几何禁的关系不应出现在几何 allow 规则中
  assert.ok(doc.forbiddenAcrossFamilies.geometry.indexOf('add-combine') !== -1);
  assert.ok(doc.forbiddenAcrossFamilies['algebra-arithmetic'].indexOf('vertex-rays') !== -1);
});

test('端到端：4 代表 KP 规则行 evidence=pass 且 intent=pass', async () => {
  const rows = [
    [KP_TIMES, 2, 'calc'], [KP_TIMES, 2, 'fill'],
    [KP_FRACTION, 5, 'calc'], [KP_FRACTION, 5, 'fill'],
    [KP_ANGLE, 3, 'fill'], [KP_AREA, 3, 'fill']
  ];
  for (const [kp, grade, qt] of rows) {
    const session = new PracticeSession({ subject: 'math', grade, count: 1, knowledgePointId: kp, questionType: qt });
    await session.start();
    const q = (session.semanticQuestions || [])[0];
    assert.ok(q, kp + '×' + qt + ' 可生成');
    assert.equal(KpSemantic.checkSemanticEvidence(q, kp).state, 'pass', kp + '×' + qt + ' evidence');
    assert.equal(KpSemantic.checkIntentEvidenceConsistency(q, kp).state, 'pass', kp + '×' + qt + ' intent');
  }
});
