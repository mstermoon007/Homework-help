'use strict';

/**
 * tests/generator/p25-06-teaching-denials.test.js — P25-06 教学裁决覆盖层
 *
 * 冻结不变量：
 *   1. 4 个图形表征 KP × calc（representation-conflict 旗标行）经教学裁决后：
 *      resolveFinal=FORBID + source.teachingDenial=P25-06 + confidence=teaching-denied；
 *      canGenerate=false；getCapabilities 不含 calc；buildEligibility 归入 skip。
 *   2. 同 KP 的 fill/apply/choice/geometry 不受影响（仍 ALLOW）。
 *   3. 普通 KP 的 calc 不受影响（回归）。
 *   4. 运行时代码表（resolver TEACHING_DENIALS）与审计 SSOT
 *      （kbl/teaching/teaching-denials.json）集合一致，防漂移。
 *   5. 端到端：显式请求被 deny 的 calc → fail-fast（无可生成题目），
 *      不再静默产出语义无关兜底题；fill 仍可正常生成。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));

// 运行时实际使用 bundle 内联的 resolver（strategy bundle 设置 global.CapabilityResolver），
// 与浏览器/PracticeSession 路径同源，保证测试即运行时行为。
const Resolver = global.CapabilityResolver;
const KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
const KC = require(path.join(ROOT, 'shared', 'orchestration', 'knowledge-context.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

const DENIED = [
  { id: 'math-g1-down-u06-k002', grade: 1 },
  { id: 'math-g2-down-u02-k005', grade: 2 },
  { id: 'math-g6-down-u04-k007', grade: 6 },
  { id: 'math-g6-down-u04-k008', grade: 6 }
];
const RETAINED = ['fill', 'apply', 'choice', 'geometry'];

test('resolver 可用（strategy bundle 已加载）', () => {
  assert.ok(Resolver && typeof Resolver.resolveFinal === 'function', 'global.CapabilityResolver 不可用——先重建 bundle');
});

DENIED.forEach(function (d) {
  test('deny：' + d.id + ' × calc → FORBID/teachingDenial', () => {
    const r = Resolver.resolveFinal({ knowledgePointId: d.id, questionType: 'calc' });
    assert.equal(r.decision, 'FORBID');
    assert.equal(r.source.teachingDenial, 'P25-06');
    assert.equal(r.confidence, 'teaching-denied');
    assert.equal(Resolver.canGenerate(d.id, 'calc'), false);
    assert.equal(Resolver.isTeachingDenied(d.id, 'calc'), true);
  });

  RETAINED.forEach(function (qt) {
    test('不波及：' + d.id + ' × ' + qt + ' 仍 ALLOW', () => {
      const r = Resolver.resolveFinal({ knowledgePointId: d.id, questionType: qt });
      assert.equal(r.decision, 'ALLOW', qt + ' 不应被教学裁决波及');
      assert.equal(r.source.teachingDenial, null);
    });
  });

  test('getCapabilities：' + d.id + ' 能力列表剔除 calc、保留其余题型', () => {
    const caps = Resolver.getCapabilities(KC.get(d.id));
    assert.ok(caps.questionTypes.indexOf('calc') === -1, 'calc 应被剔除');
    RETAINED.forEach(function (qt) {
      assert.ok(caps.questionTypes.indexOf(qt) !== -1, qt + ' 应保留');
    });
  });
});

test('buildEligibility：4 行 calc 归入 skip（POL 不再规划）', () => {
  const ev = KCV.buildEligibility(DENIED.map(function (d) { return d.id; }), ['calc', 'fill']);
  DENIED.forEach(function (d) {
    assert.equal(ev.matrix[d.id].calc, 'FORBID');
    assert.ok((ev.skip[d.id] || []).indexOf('calc') !== -1);
    assert.equal(ev.matrix[d.id].fill, 'ALLOW');
  });
});

test('回归：普通 KP（倍 math-g2-down-u03-k003）calc 仍 ALLOW', () => {
  const kp = 'math-g2-down-u03-k003';
  assert.equal(Resolver.isTeachingDenied(kp, 'calc'), false);
  assert.equal(Resolver.resolveFinal({ knowledgePointId: kp, questionType: 'calc' }).decision, 'ALLOW');
  assert.ok(Resolver.getCapabilities(KC.get(kp)).questionTypes.indexOf('calc') !== -1);
});

test('防漂移：resolver 代码表与 teaching-denials.json SSOT 集合一致', () => {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'teaching-denials.json'), 'utf8'));
  const fromJson = doc.denials.map(function (d) { return d.knowledgeId + '|' + d.questionType; }).sort();
  const fromCode = Resolver.listTeachingDenials().map(function (d) {
    return d.knowledgeId + '|' + d.questionType;
  }).sort();
  assert.deepEqual(fromCode, fromJson);
  // SSOT 每条裁决必须可审计
  doc.denials.forEach(function (d) {
    assert.ok(d.reason && d.evidence && d.kind === 'execution-gap', d.knowledgeId + ' 裁决缺理由/证据/kind');
    assert.deepEqual(d.retainedTypes, RETAINED, d.knowledgeId + ' retainedTypes 与测试冻结不一致');
  });
});

DENIED.forEach(function (d) {
  test('端到端：' + d.id + ' 显式请求 calc → fail-fast（不再静默出兜底题）', async () => {
    const session = new PracticeSession({
      subject: 'math', grade: d.grade, count: 1,
      knowledgePointId: d.id, questionType: 'calc'
    });
    await assert.rejects(function () { return session.start(); }, /没有可生成的题目|不可生成|FORBID/);
  });
});

test('端到端：math-g1-down-u06-k002 显式 fill 仍可真实生成 ≥1 题', async () => {
  const session = new PracticeSession({
    subject: 'math', grade: 1, count: 1,
    knowledgePointId: 'math-g1-down-u06-k002', questionType: 'fill'
  });
  const result = await session.start();
  const qs = session.semanticQuestions || result.questions || [];
  assert.ok(qs.length >= 1, 'fill 应仍可生成');
  assert.equal(qs[0].questionType, 'fill');
});
