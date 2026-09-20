'use strict';

/**
 * tests/generator/p25-04-semantic-evidence.test.js — P25-04 Semantic Evidence 体系
 *
 * 冻结不变量：
 *   1. 四态语义：skip=KP×题型无规则 / warn=有规则但未声明（过渡期，仅 WARNING）/
 *      pass=声明齐+required 全满足+forbidden 无命中 / fail=required 缺或 forbidden 命中（ERROR）。
 *   2. A 类 4 代表 KP（倍的认识/分数的意义/角的认识/面积的认识）native 绑定
 *      generator:concept-meaning，selector 首选；规则行（×calc/fill）全量 PASS。
 *   3. maker 覆盖 4 KP 的全部 ALLOW 行（native binding kp=1 不分题型胜出，
 *      未覆盖题型会 0 产出破坏 verify:allow-gen 1570 门禁）。
 *   4. 证据规则数据 kbl/teaching/evidence-rules.json：断言 kind 仅
 *      field/fieldNot/relation/relationNot 四种。
 *
 * P26 evidence 全量扩建：规则表从 4 代表 KP 扩到 A 类全量（kp-matrix.json
 * draftSemanticLevel==='A' 的 75 KP × ALLOW 题型，机械派生契约）+ 既有 6 行保留。
 * 候选真值源 dev/p25/reports/evidence-derive-report.json（真实生成产出字段稳定性
 * + KBL 语义事实跨家族守卫）；本测试冻结：总行数、A 类全覆盖、断言 kind 合法、
 * 键不重复、既有 4 代表 KP 规则行不被扩建侵蚀。
 */

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const KpSemantic = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));
const GenRegistry = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

// A 类 4 代表 KP（canonical id 仅测试文件可裸写；bundle 源码禁用）
const KP_TIMES = 'math-g2-down-u03-k003';   // 倍的认识
const KP_FRACTION = 'math-g5-down-u04-k001'; // 分数的意义
const KP_ANGLE = 'math-g3-up-u07-k002';     // 角的认识
const KP_AREA = 'math-g3-down-u04-k001';    // 面积的认识

function sqOf(overrides) {
  return Object.assign({
    knowledgePointIds: [KP_TIMES],
    questionType: 'calc',
    data: {}
  }, overrides);
}

before(() => {});

/* ---------------- 1. 四态语义 ---------------- */

test('skip：KP×题型 无证据规则 → 不产出任何 error/warning', () => {
  // P26 后 4 代表 KP 已入 A 类、其 ALLOW 行均有规则；skip 夹具改用无规则的 KP×题型（面积×calc 无 ALLOW 无规则）
  const r = KpSemantic.checkSemanticEvidence(sqOf({ knowledgePointIds: [KP_AREA], questionType: 'calc' }), KP_AREA);
  assert.equal(r.state, 'skip');
  assert.equal(r.errors.length, 0);
  assert.equal(r.warnings.length, 0);
});

test('pass：声明齐 + required 全满足 + forbidden 无命中', () => {
  const r = KpSemantic.checkSemanticEvidence(sqOf({
    data: {
      operation: 'mult',
      timesRelation: 'times-of',
      semanticEvidence: { relations: ['times-compare', 'multiply-by-times'], constructs: ['base-quantity'] }
    }
  }), KP_TIMES);
  assert.equal(r.state, 'pass');
  assert.equal(r.errors.length, 0);
});

test('warn：规则行存在但题面未声明 semanticEvidence → 仅 WARNING，不产 error', () => {
  const r = KpSemantic.checkSemanticEvidence(sqOf({ data: { operation: 'mult' } }), KP_TIMES);
  assert.equal(r.state, 'warn');
  assert.equal(r.errors.length, 0);
  assert.equal(r.warnings.length, 1);
  assert.equal(r.warnings[0].severity, 'WARNING');
  assert.equal(r.warnings[0].code, 'KP_SEMANTIC_EVIDENCE');
});

test('fail：required 缺失 + forbidden 命中 → ERROR，且 detail 可溯源', () => {
  // 加法冒充倍的认识（P25-04 探针实证的泛型兜底形态）
  const r = KpSemantic.checkSemanticEvidence(sqOf({
    data: {
      operation: 'add',
      semanticEvidence: { relations: ['add-combine'], constructs: [] }
    }
  }), KP_TIMES);
  assert.equal(r.state, 'fail');
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].code, 'KP_SEMANTIC_EVIDENCE');
  assert.equal(r.errors[0].severity, 'ERROR');
  assert.ok(r.errors[0].detail.missing.length >= 1, 'missing 断言可溯源');
  assert.ok(r.errors[0].detail.forbiddenHits.length >= 1, 'forbiddenHits 可溯源');
});

test('四态进入 validateKpSemantics.checks.semanticEvidence 与 result.semanticEvidence', () => {
  const passSq = sqOf({
    data: {
      operation: 'mult', timesRelation: 'times-of',
      semanticEvidence: { relations: ['times-compare', 'multiply-by-times'], constructs: [] }
    }
  });
  const out = KpSemantic.validateKpSemantics(passSq, { kpId: KP_TIMES, kpConstraints: null, plan: null });
  assert.equal(out.semanticEvidence, 'pass');
  assert.equal(out.checks.semanticEvidence, 'pass');

  const warnSq = sqOf({ data: {} });
  const out2 = KpSemantic.validateKpSemantics(warnSq, { kpId: KP_TIMES, kpConstraints: null, plan: null });
  assert.equal(out2.semanticEvidence, 'warn');

  const skipSq = sqOf({ knowledgePointIds: [KP_ANGLE], questionType: 'calc', data: {} });
  const out3 = KpSemantic.validateKpSemantics(skipSq, { kpId: KP_ANGLE, kpConstraints: null, plan: null });
  assert.equal(out3.semanticEvidence, 'skip');
});

/* ---------------- 2. 证据规则数据完整性 ---------------- */

test('evidence-rules.json：断言 kind 合法、键不重复、A 类 ALLOW 行全覆盖（口径自维护）', () => {
  const doc = require(path.join(ROOT, 'kbl', 'teaching', 'evidence-rules.json'));
  const matrix = require(path.join(ROOT, 'kbl', 'teaching', 'kp-matrix.json'));
  const mappings = require(path.join(ROOT, 'kbl', 'canonical', 'mappings.json')).mappings;
  assert.ok(Array.isArray(doc.rules));
  const seen = new Set();
  const KINDS = new Set(['field', 'fieldNot', 'relation', 'relationNot']);
  doc.rules.forEach((r) => {
    const key = r.knowledgePointId + '|' + r.questionType;
    assert.ok(!seen.has(key), '规则键不重复: ' + key);
    seen.add(key);
    assert.ok(Array.isArray(r.required) && r.required.length >= 1, key + ' 必须有 required');
    (r.required || []).concat(r.forbidden || []).forEach((a) => assert.ok(KINDS.has(a.kind), 'kind 合法: ' + a.kind));
  });
  // 既有规则覆盖面（P25-04 人工规则，不被扩建侵蚀）：倍 calc/fill、分数 calc/fill、角 fill、面积 fill
  ['calc', 'fill'].forEach((qt) => assert.ok(seen.has(KP_TIMES + '|' + qt)));
  ['calc', 'fill'].forEach((qt) => assert.ok(seen.has(KP_FRACTION + '|' + qt)));
  assert.ok(seen.has(KP_ANGLE + '|fill'));
  assert.ok(seen.has(KP_AREA + '|fill'));
  // P26 扩建覆盖面（口径自维护，无魔法数字）：
  // A 类 = kp-matrix draftSemanticLevel==='A'；ALLOW 行 = canonical mappings permission==='allow'。
  const aKps = new Set(matrix.kps.filter((k) => k.draftSemanticLevel === 'A').map((k) => k.id));
  assert.ok(aKps.size >= 75, 'A 类 KP 应 ≥75（P26 刷新后矩阵），实际 ' + aKps.size);
  const aAllowRows = new Set();
  mappings.forEach((m) => {
    if (aKps.has(m.knowledgeId) && m.permission === 'allow') aAllowRows.add(m.knowledgeId + '|' + m.questionType);
  });
  aAllowRows.forEach((key) => {
    assert.ok(seen.has(key), 'A 类 ALLOW 行缺证据规则: ' + key);
  });
  // 规则行范围精确：= A 类 ALLOW 行（既有 6 行 ⊆ 其中——4 代表 KP 已随矩阵刷新入 A）
  assert.equal(doc.rules.length, aAllowRows.size,
    '规则行数应恰为 A 类 ALLOW 行数');
  doc.rules.forEach((r) => {
    assert.ok(aKps.has(r.knowledgePointId),
      '规则行 KP 越界（非 A 类）: ' + r.knowledgePointId);
  });
});

/* ---------------- 3. 绑定与路由 ---------------- */

test('generator:concept-meaning native 绑定 4 KP；selector 首选', () => {
  [KP_TIMES, KP_FRACTION, KP_ANGLE, KP_AREA].forEach((kp) => {
    const bound = GenRegistry.forKnowledgePoint(kp).map((r) => r.id);
    assert.ok(bound.indexOf('generator:concept-meaning') !== -1, kp + ' 应含 concept-meaning 绑定');
  });
  const sel = Env.GeneratorSelector.selectGenerator({ knowledgePointIds: [KP_TIMES], questionTypeId: 'calc' });
  assert.equal(sel.generatorId, 'generator:concept-meaning');
  assert.equal(sel.match.kp, 1);
});

test('maker 覆盖 4 KP 全部 ALLOW 行（防 verify:allow-gen 1570 破门）', () => {
  const mappings = require(path.join(ROOT, 'kbl', 'canonical', 'mappings.json')).mappings;
  const allowByKp = {};
  [KP_TIMES, KP_FRACTION, KP_ANGLE, KP_AREA].forEach((kp) => { allowByKp[kp] = new Set(); });
  mappings.forEach((r) => {
    if (allowByKp[r.knowledgeId] && r.permission === 'allow') allowByKp[r.knowledgeId].add(r.questionType);
  });
  // 与 concept-meaning.js KP_MAKERS 同步的覆盖矩阵（键=年级-单元-序号）
  const covered = {
    [KP_TIMES]: new Set(['calc', 'fill', 'apply', 'choice']),
    [KP_FRACTION]: new Set(['calc', 'fill', 'apply', 'choice']),
    [KP_ANGLE]: new Set(['fill', 'apply', 'choice', 'geometry', 'judge']),
    [KP_AREA]: new Set(['fill', 'apply', 'choice', 'geometry', 'judge'])
  };
  Object.keys(allowByKp).forEach((kp) => {
    assert.ok(allowByKp[kp].size >= 1, kp + ' 存在 ALLOW 行');
    allowByKp[kp].forEach((qt) => {
      assert.ok(covered[kp].has(qt), kp + '×' + qt + ' ALLOW 行必须被 concept-meaning maker 覆盖');
    });
  });
});

/* ---------------- 4. 端到端：4 KP × 规则行全量 PASS ---------------- */

test('端到端：规则行（4 KP × calc/fill）运行时生成 → 概念类证据 PASS', async () => {
  // P25-09：KP_ANGLE/KP_AREA 从 shape-recognition 解绑、回归 concept-meaning 唯一承载
  // （角的认识→angle-concept / 面积的认识→area-concept maker 已补齐并发 semanticEvidence）。
  // 4 个 A 类代表 KP 全部由 concept-meaning 承载，规则行证据状态一律 pass。
  const rows = [
    [KP_TIMES, 2, 'calc', 'generator:concept-meaning'], [KP_TIMES, 2, 'fill', 'generator:concept-meaning'],
    [KP_FRACTION, 5, 'calc', 'generator:concept-meaning'], [KP_FRACTION, 5, 'fill', 'generator:concept-meaning'],
    [KP_ANGLE, 3, 'fill', 'generator:concept-meaning'],
    [KP_AREA, 3, 'fill', 'generator:concept-meaning']
  ];
  for (const [kp, grade, qt, expectedGen] of rows) {
    const session = new PracticeSession({ subject: 'math', grade, count: 1, knowledgePointId: kp, questionType: qt });
    await session.start();
    const qs = session.semanticQuestions || [];
    assert.ok(qs.length >= 1, kp + '×' + qt + ' 可生成');
    const q = qs[0];
    assert.equal(q.questionType, qt, '题型一致');
    assert.equal(q.metadata.generator, expectedGen, kp + '×' + qt + ' 由预期生成器承载');
    const ev = KpSemantic.checkSemanticEvidence(q, kp);
    if (expectedGen === 'generator:concept-meaning') {
      assert.equal(ev.state, 'pass', kp + '×' + qt + ' 证据应 PASS，实际 ' + ev.state);
    } else {
      // 几何类生成器不发 semanticEvidence，允许 warn/skip
      assert.ok(['pass', 'warn', 'skip'].indexOf(ev.state) !== -1, kp + '×' + qt + ' 证据状态异常 ' + ev.state);
    }
  }
});

test('端到端：4 KP 全 ALLOW 行真实生成 ≥1 题且题型/KP 一致', async () => {
  const rows = [
    [KP_TIMES, 2, ['calc', 'fill', 'apply', 'choice']],
    [KP_FRACTION, 5, ['calc', 'fill', 'apply', 'choice']],
    [KP_ANGLE, 3, ['fill', 'apply', 'choice', 'geometry', 'judge']],
    [KP_AREA, 3, ['fill', 'apply', 'choice', 'geometry', 'judge']]
  ];
  for (const [kp, grade, qts] of rows) {
    for (const qt of qts) {
      const session = new PracticeSession({ subject: 'math', grade, count: 1, knowledgePointId: kp, questionType: qt });
      await session.start();
      const qs = session.semanticQuestions || [];
      assert.ok(qs.length >= 1, kp + '×' + qt + ' 可生成');
      const q = qs[0];
      const qkp = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
      assert.equal(q.questionType, qt, kp + '×' + qt + ' 题型一致');
      assert.equal(qkp, kp, 'KP 一致');
    }
  }
});
