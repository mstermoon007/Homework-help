'use strict';

/**
 * tests/generator/p27-variation-profile.test.js — P27-09 VariationProfile 变式剖面
 *
 * 冻结不变量：
 *   1. 剖面 SSOT kbl/teaching/variation-profiles.json：schema/policy 完整，
 *      行数 = A 类 KP × ALLOW 动态枚举（与 dev/check-allow-generation.js 同机制），
 *      键不重复、无缺行、无多余行（矩阵滞后立即暴露）。
 *   2. 五轴字段形态合法：unknown.positions 有序字符串数组 / numeric.varies 布尔 /
 *      context.present 布尔 + ratio∈[0,1] / representation.paths 有序 /
 *      structure.steps 有序。
 *   3. flags 纪律：profiled 行 unknown-not-observed ⟺ unknown.positions 为空。
 *   4. 五轴观测 Observe.observeRow：合成样本上的机械提取行为（答案承载位、
 *      情境阈值 ≥2 汉字、表征路径、步数集合）。
 *   5. 漂移硬契约抽样复验：抽样行重生成后硬轴（context/representation）
 *      与剖面一致（全量硬门禁由 dev/p27/check-variation-drift.js 执行）。
 */

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
const QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
const Observe = require(path.join(ROOT, 'dev', 'p27', 'variation-observe.js'));

const profile = require(path.join(ROOT, 'kbl', 'teaching', 'variation-profiles.json'));
const matrix = require(path.join(ROOT, 'kbl', 'teaching', 'kp-matrix.json'));

const ALL = QTR.TYPES.map((t) => t.id);
const aKps = {};
matrix.kps.filter((k) => k.draftSemanticLevel === 'A').forEach((k) => { aKps[k.id] = true; });

const expectedPairs = [];
for (let g = 1; g <= 6; g++) {
  (Env.KnowledgeContext.kpsForGrade('math', g) || []).forEach((k) => {
    if (!aKps[k.knowledgeId]) return;
    const ev = KCV.buildEligibility([k.knowledgeId], ALL);
    const m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
    ALL.forEach((t) => { if (m[t] === 'ALLOW') expectedPairs.push(k.knowledgeId + '|' + t + '|' + g); });
  });
}

const rowsByKey = {};
before(() => {
  profile.rows.forEach((r) => { rowsByKey[r.knowledgePointId + '|' + r.questionType + '|' + r.grade] = r; });
});

/* ---------------- 1. Schema 与覆盖 ---------------- */

test('schema/policy 完整：五轴定义 + 硬/软漂移契约声明', () => {
  assert.equal(profile.schemaVersion, 'p27-variation.1');
  assert.deepEqual(profile.policy.hardAxes, ['context', 'representation']);
  assert.deepEqual(profile.policy.softAxes, ['unknown', 'numeric', 'structure']);
  ['unknown', 'numeric', 'context', 'representation', 'structure'].forEach((a) => {
    assert.equal(typeof profile.axes[a], 'string');
  });
});

test('行覆盖 = A 类 KP × ALLOW 动态枚举，键不重复、无缺无多', () => {
  assert.equal(profile.rows.length, expectedPairs.length);
  const keys = profile.rows.map((r) => r.knowledgePointId + '|' + r.questionType + '|' + r.grade);
  assert.equal(new Set(keys).size, keys.length, '键不得重复');
  expectedPairs.forEach((k) => {
    assert.ok(rowsByKey[k], '缺剖面行: ' + k);
  });
  assert.deepEqual(keys.slice().sort(), expectedPairs.slice().sort(), '剖面键集合与动态枚举必须一致');
});

test('五轴字段形态合法（全行）', () => {
  profile.rows.forEach((r) => {
    const v = r.variation;
    assert.ok(v, 'profiled 行必须有 variation: ' + r.knowledgePointId);
    assert.ok(Array.isArray(v.unknown.positions));
    assert.deepEqual(v.unknown.positions, v.unknown.positions.slice().sort());
    assert.equal(typeof v.numeric.varies, 'boolean');
    assert.equal(typeof v.context.present, 'boolean');
    assert.ok(v.context.ratio >= 0 && v.context.ratio <= 1);
    assert.equal(typeof v.representation.present, 'boolean');
    assert.deepEqual(v.representation.paths, v.representation.paths.slice().sort());
    assert.deepEqual(v.structure.steps, v.structure.steps.slice().sort());
  });
});

test('flags 纪律：unknown-not-observed ⟺ unknown.positions 为空', () => {
  profile.rows.forEach((r) => {
    const flagged = r.flags.indexOf('unknown-not-observed') !== -1;
    assert.equal(flagged, r.variation && r.variation.unknown.positions.length === 0,
      'flags 与轴观测不一致: ' + r.knowledgePointId + '×' + r.questionType);
  });
});

/* ---------------- 2. Observe.observeRow 机械提取 ---------------- */

test('unknown 轴：data 叶子值==答案值 → 该路径入选承载位', () => {
  const obs = Observe.observeRow([
    { prompt: '填空：3 + 5 = ?', answer: { value: '8' }, data: { a: 3, b: 5, result: 8 } },
    { prompt: '填空：? + 5 = 8', answer: { value: '3' }, data: { a: 3, b: 5, result: 8 } }
  ]);
  assert.deepEqual(obs.variation.unknown.positions, ['data.a', 'data.result']);
  assert.equal(obs.variation.numeric.varies, true); // 两样本答案 {8,3} distinct=2
});

test('numeric 轴：distinct 答案 ≥2 → varies=true，附值域', () => {
  const obs = Observe.observeRow([
    { prompt: '1+1=?', answer: { value: '2' }, data: {} },
    { prompt: '2+3=?', answer: { value: '5' }, data: {} },
    { prompt: '4+4=?', answer: { value: '8' }, data: {} }
  ]);
  assert.equal(obs.variation.numeric.varies, true);
  assert.equal(obs.variation.numeric.distinctAnswers, 3);
  assert.equal(obs.variation.numeric.answerMin, 2);
  assert.equal(obs.variation.numeric.answerMax, 8);
});

test('context 轴：≥2 汉字样本占比 ≥0.5 → present；纯算式 → absent', () => {
  const withCtx = Observe.observeRow([
    { prompt: '小明有 3 个苹果，吃掉 1 个，还剩几个？', answer: { value: '2' }, data: {} },
    { prompt: '树上原有 5 只鸟，飞走 2 只，还剩几只？', answer: { value: '3' }, data: {} }
  ]);
  assert.equal(withCtx.variation.context.present, true);
  assert.equal(withCtx.variation.context.ratio, 1);
  const bare = Observe.observeRow([
    { prompt: '7 × 8 = ____', answer: { value: '56' }, data: {} },
    { prompt: '6 × 9 = ____', answer: { value: '54' }, data: {} }
  ]);
  assert.equal(bare.variation.context.present, false);
  assert.equal(bare.variation.context.ratio, 0);
});

test('representation 轴：graphic 类路径识别 + 取值集合；structure 轴：steps 集合', () => {
  const obs = Observe.observeRow([
    { prompt: '看图填空', answer: { value: '6' }, data: { graphicType: 'angle', steps: 2 } },
    { prompt: '看图填空', answer: { value: '7' }, data: { graphicType: 'angle', steps: 3 } }
  ]);
  assert.equal(obs.variation.representation.present, true);
  assert.deepEqual(obs.variation.representation.paths, ['data.graphicType']);
  assert.deepEqual(obs.variation.representation.values['data.graphicType'], ['"angle"']);
  assert.deepEqual(obs.variation.structure.steps, ['data.steps=2', 'data.steps=3']);
});

/* ---------------- 3. 漂移硬契约抽样复验 ---------------- */

test('抽样行重生成：硬轴（context/representation/structure）与剖面一致', async () => {
  // 抽 8 行（覆盖不同题型），全量硬门禁由 dev/p27/check-variation-drift.js 执行
  const sample = profile.rows.filter((r) => r.variation).filter((r, i) => i % 160 === 0).slice(0, 8);
  assert.ok(sample.length >= 4, '抽样行不足');
  for (const r of sample) {
    const session = new PracticeSession({
      subject: 'math', grade: r.grade, count: 6,
      knowledgePointId: r.knowledgePointId, questionType: r.questionType
    });
    await session.start();
    const samples = (session.semanticQuestions || []).filter((q) => {
      const qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
      return q.questionType === r.questionType && qk === r.knowledgePointId;
    });
    if (!samples.length) continue; // 生成异常行由漂移门禁 genErrors 通道追踪
    const obs = Observe.observeRow(samples);
    assert.equal(obs.variation.context.present, r.variation.context.present,
      'context 漂移: ' + r.knowledgePointId + '×' + r.questionType);
    assert.equal(obs.variation.representation.present, r.variation.representation.present,
      'representation 漂移: ' + r.knowledgePointId + '×' + r.questionType);
    assert.deepEqual(obs.variation.representation.paths, r.variation.representation.paths,
      'representation.paths 漂移: ' + r.knowledgePointId + '×' + r.questionType);
    assert.deepEqual(obs.variation.structure.steps, r.variation.structure.steps,
      'structure.steps 漂移: ' + r.knowledgePointId + '×' + r.questionType);
  }
});
