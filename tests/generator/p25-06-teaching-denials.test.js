'use strict';

/**
 * tests/generator/p25-06-teaching-denials.test.js — P25-06 教学裁决撤销与语义参数链路
 *
 * P25-06 本体：首批 4 条 teaching deny（图形表征 KP × calc，execution-gap）
 * 已随 generator:semantic-relations 参数化族生成器补齐而全部撤销。
 *
 * 冻结不变量：
 *   1. ACTIVE 裁决为空：4 KP × calc（及全部 5 题型）resolveFinal=ALLOW，
 *      isTeachingDenied=false，getCapabilities 含 calc，buildEligibility 不 skip。
 *   2. 账本留痕：teaching-denials.json 4 行均 status=revoked 且带 resolution
 *      （revokedAt/replacedBy/verification）；代码 ACTIVE 表 ↔ JSON 非 revoked 集合一致。
 *   3. 路由：4 KP × 5 题型 selector 全部命中 generator:semantic-relations，
 *      生成题目经 KpSemanticValidator 无 ERROR。
 *   4. 端到端：PracticeSession 显式 calc 可真实生成 ≥1 题，
 *      metadata.generator=generator:semantic-relations、题型/KP 正确。
 *   5. 回归：普通 KP calc 不受裁决机制影响。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));

// 运行时实际使用 bundle 内联模块（strategy bundle 设置 global.*），与浏览器/PracticeSession 同源。
const Resolver = global.CapabilityResolver;
const Selector = global.GeneratorSelector;
const KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
const KC = require(path.join(ROOT, 'shared', 'orchestration', 'knowledge-context.js'));
const KpSemantic = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

const REVOKED = [
  { id: 'math-g1-down-u06-k002', grade: 1, subTopic: 'pictorial-additive-relation' },
  { id: 'math-g2-down-u02-k005', grade: 2, subTopic: 'periodic-pattern' },
  { id: 'math-g6-down-u04-k007', grade: 6, subTopic: 'scale-transform' },
  { id: 'math-g6-down-u04-k008', grade: 6, subTopic: 'proportion-application' }
];
const ALL_TYPES = ['calc', 'fill', 'apply', 'choice', 'geometry'];

test('bundle 可用（resolver/selector 已随最新源码重建）', () => {
  assert.ok(Resolver && typeof Resolver.resolveFinal === 'function', 'global.CapabilityResolver 不可用——先重建 bundle');
  assert.ok(Selector && typeof Selector.selectGenerator === 'function', 'global.GeneratorSelector 不可用——先重建 bundle');
});

test('ACTIVE 教学裁决为空（机制保留，首批 4 条已撤销）', () => {
  assert.deepEqual(Resolver.listTeachingDenials(), []);
  REVOKED.forEach(function (d) {
    ALL_TYPES.forEach(function (qt) {
      assert.equal(Resolver.isTeachingDenied(d.id, qt), false);
    });
  });
});

REVOKED.forEach(function (d) {
  ALL_TYPES.forEach(function (qt) {
    test('恢复 ALLOW：' + d.id + ' × ' + qt, () => {
      const r = Resolver.resolveFinal({ knowledgePointId: d.id, questionType: qt });
      assert.equal(r.decision, 'ALLOW');
      assert.equal(r.source.teachingDenial, null);
      assert.equal(Resolver.canGenerate(d.id, qt), true);
    });
  });

  test('getCapabilities：' + d.id + ' 能力列表含全部 5 题型', () => {
    const caps = Resolver.getCapabilities(KC.get(d.id));
    ALL_TYPES.forEach(function (qt) {
      assert.ok(caps.questionTypes.indexOf(qt) !== -1, qt + ' 应在能力列表');
    });
  });
});

test('buildEligibility：4 KP × calc 全部 ALLOW（不再 FORBID/skip）', () => {
  const ev = KCV.buildEligibility(REVOKED.map(function (d) { return d.id; }), ALL_TYPES);
  REVOKED.forEach(function (d) {
    ALL_TYPES.forEach(function (qt) {
      assert.equal(ev.matrix[d.id][qt], 'ALLOW');
    });
    assert.equal((ev.skip[d.id] || []).length, 0);
  });
});

test('防漂移：resolver ACTIVE 表与 teaching-denials.json 非 revoked 集合一致（空 ↔ 空）', () => {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'teaching-denials.json'), 'utf8'));
  const activeFromJson = (doc.denials || [])
    .filter(function (d) { return d.status !== 'revoked'; })
    .map(function (d) { return d.knowledgeId + '|' + d.questionType; })
    .sort();
  const activeFromCode = Resolver.listTeachingDenials().map(function (d) {
    return d.knowledgeId + '|' + d.questionType;
  }).sort();
  assert.deepEqual(activeFromCode, activeFromJson);

  // 4 条历史裁决必须以 revoked 形态保留完整审计链
  const revoked = (doc.denials || []).filter(function (d) { return d.status === 'revoked'; });
  assert.equal(revoked.length, 4);
  revoked.forEach(function (d) {
    assert.equal(d.kind, 'execution-gap');
    assert.ok(d.reason && d.evidence, d.knowledgeId + ' 缺原裁决理由/证据');
    assert.ok(d.resolution, d.knowledgeId + ' revoked 行缺 resolution');
    assert.ok(d.resolution.revokedAt && d.resolution.replacedBy && d.resolution.verification,
      d.knowledgeId + ' resolution 缺 revokedAt/replacedBy/verification');
    assert.ok(d.resolution.replacedBy.indexOf('generator:semantic-relations') !== -1,
      d.knowledgeId + ' replacedBy 应指向 semantic-relations');
    assert.deepEqual(d.retainedTypes, ['fill', 'apply', 'choice', 'geometry']);
  });
});

REVOKED.forEach(function (d) {
  ALL_TYPES.forEach(function (qt) {
    test('语义路由+校验：' + d.id + ' × ' + qt + ' → semantic-relations 且无 ERROR', () => {
      const plan = { knowledgePointIds: [d.id], questionTypeId: qt, difficulty: 2, count: 1, seed: 'p2506' };
      const sel = Selector.selectGenerator(plan, { mode: 'native' });
      assert.equal(sel.generatorId, 'generator:semantic-relations');
      const gen = Selector.instantiate(sel);
      const sqs = gen.generate(plan, {});
      assert.equal(sqs.length, 1);
      const sq = sqs[0];
      assert.equal(sq.questionType, qt);
      assert.equal(sq.knowledgePointId, d.id);
      assert.equal(sq.data.subTopic, d.subTopic);
      assert.equal(sq.metadata.generator, 'generator:semantic-relations');
      const result = KpSemantic.validateKpSemantics(sq, { kpId: d.id, kpConstraints: null, plan: plan });
      assert.deepEqual(result.errors, []);
    });
  });
});

REVOKED.forEach(function (d) {
  test('端到端：' + d.id + ' 显式 calc 真实生成（撤销 deny，不再 fail-fast）', async () => {
    const session = new PracticeSession({
      subject: 'math', grade: d.grade, count: 1,
      knowledgePointId: d.id, questionType: 'calc'
    });
    const result = await session.start();
    const qs = session.semanticQuestions || result.questions || [];
    assert.ok(qs.length >= 1, 'calc 应可真实生成');
    const sq = qs[0];
    assert.equal(sq.questionType, 'calc');
    const sqKp = sq.knowledgePointId || (sq.knowledgePointIds && sq.knowledgePointIds[0]);
    assert.equal(sqKp, d.id);
    assert.equal(sq.metadata && sq.metadata.generator, 'generator:semantic-relations');
  });
});

test('回归：普通 KP（倍 math-g2-down-u03-k003）calc 仍 ALLOW 且命中 concept-meaning', () => {
  const kp = 'math-g2-down-u03-k003';
  assert.equal(Resolver.isTeachingDenied(kp, 'calc'), false);
  assert.equal(Resolver.resolveFinal({ knowledgePointId: kp, questionType: 'calc' }).decision, 'ALLOW');
  assert.ok(Resolver.getCapabilities(KC.get(kp)).questionTypes.indexOf('calc') !== -1);
  const sel = Selector.selectGenerator(
    { knowledgePointIds: [kp], questionTypeId: 'calc', difficulty: 2, count: 1 },
    { mode: 'native' });
  assert.equal(sel.generatorId, 'generator:concept-meaning');
});
