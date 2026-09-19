'use strict';

/**
 * tests/generator/p25-09-native-bindings.test.js — P25-09 B/C 类 KP 专项建设
 *
 * 冻结不变量：
 *   1. 全量 375 个 canonical KP 至少被 1 个 core 生成器 native 绑定
 *      （P25-09 收口 B=41 语义误绑 + C=166 无绑定；绑定表里不允许残留未知 KP ID）。
 *   2. 全部 1570 对 ALLOW(KP, QT) 经 selector 均由 kp=1 native 候选承载，
 *      禁止 kp=0 泛化兜底截胡（shape v3 扩 cap 平局截胡事故的回归门）。
 *   3. subTopic 消费生成器（percent/concept-meaning/semantic-relations）绑定的 KP，
 *      Node 族收窄派生与 bundle 降级全扫派生必须一致且非 null
 *      （「比例的意义」被 multdiv 裸「意义」规则跨族截胡事故的回归门）。
 *   4. E2E 语义抽样：P25-09 新建/重绑生成器代表 KP 经 PracticeSession 真实出题，
 *      题型/KP/承载生成器一致且通过七题型契约 check。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const KC = Env.KnowledgeContext;
const GR = Env.GeneratorRegistry;
const Selector = Env.GeneratorSelector;
const KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
const QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));
const TC = require(path.join(ROOT, 'shared', 'generator', 'core', 'type-contract.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

const ALL_TYPES = QTR.TYPES.map(function (t) { return t.id; });

// 全量 canonical KP（与 dev/check-allow-generation.js 同一枚举口）
const ALL_KPS = [];
for (let g = 1; g <= 6; g++) {
  (KC.kpsForGrade('math', g) || []).forEach(function (k) {
    ALL_KPS.push({ id: k.knowledgeId, grade: g });
  });
}

const ALLOW_PAIRS = [];
ALL_KPS.forEach(function (k) {
  const ev = KCV.buildEligibility([k.id], ALL_TYPES);
  const m = (ev.matrix && ev.matrix[k.id]) || {};
  ALL_TYPES.forEach(function (t) {
    if (m[t] === 'ALLOW') ALLOW_PAIRS.push({ kp: k.id, grade: k.grade, qt: t });
  });
});

const SUBTOPIC_CONSUMERS = [
  'generator:percent-calc',
  'generator:concept-meaning',
  'generator:semantic-relations'
];

/* ---------------- 1. 375 KP 全量 native 绑定 ---------------- */

test('注册表：全量 375 KP 均有 core 生成器 native 绑定，且无残留未知 KP ID', () => {
  const records = GR.all();
  const bound = new Set();
  records.forEach(function (r) {
    (r.knowledgePoints || []).forEach(function (kp) {
      assert.ok(/^math-/.test(kp), '绑定 ID 形态异常: ' + kp + ' @ ' + r.id);
      bound.add(kp);
    });
  });
  assert.equal(ALL_KPS.length, 375, 'canonical KP 基线为 375');
  const unbound = ALL_KPS.filter(function (k) { return !bound.has(k.id); }).map(function (k) { return k.id; });
  assert.deepEqual(unbound, [], '存在无 native 绑定的 KP');
  const stale = [];
  bound.forEach(function (id) { if (!ALL_KPS.some(function (k) { return k.id === id; })) stale.push(id); });
  assert.deepEqual(stale, [], '注册表残留已不存在的 KP ID（H2 回归）');
});

/* ---------------- 2. 1570 ALLOW 对全部 kp=1 native 承载 ---------------- */

test('selector：全部 1570 对 ALLOW 均由 kp=1 native 候选承载（无 kp=0 兜底截胡）', () => {
  assert.ok(ALLOW_PAIRS.length >= 1570, 'ALLOW 对数基线 1570，实际 ' + ALLOW_PAIRS.length);
  const bad = [];
  ALLOW_PAIRS.forEach(function (p) {
    const r = Selector.selectGenerator({
      knowledgePointIds: [p.kp], questionTypeId: p.qt, difficulty: 2, count: 1
    });
    if (r.source !== 'priority' || !r.match || r.match.kp !== 1) {
      bad.push(p.kp + '×' + p.qt + ' => ' + r.source + '/kp=' + (r.match && r.match.kp));
    }
  });
  assert.deepEqual(bad, [], '非 native 承载的 ALLOW 行');
});

test('selector：未知题型 fail-closed unsupported（kp=1 绑定不豁免无效题型）', () => {
  const r = Selector.selectGenerator({
    knowledgePointIds: ['math-g1-up-u05-k001'], questionTypeId: 'review', difficulty: 2
  });
  assert.equal(r.source, 'unsupported');
  assert.equal(r.errorCode, 'GENERATOR_UNSUPPORTED');
});

/* ---------------- 3. subTopic 双环境一致（消费方绑定 KP） ---------------- */

test('语义参数：subTopic 消费生成器绑定 KP 的 Node/bundle 派生一致且非 null', () => {
  const consumerKps = new Set();
  GR.all().forEach(function (r) {
    if (SUBTOPIC_CONSUMERS.indexOf(r.id) !== -1) {
      (r.knowledgePoints || []).forEach(function (kp) { consumerKps.add(kp); });
    }
  });
  assert.ok(consumerKps.size >= 60, 'P25-09 后消费方绑定 KP 规模应 ≥60，实际 ' + consumerKps.size);
  const bad = [];
  consumerKps.forEach(function (id) {
    const kp = KC.get(id);
    if (!kp) { bad.push(id + ' KP 不存在'); return; }
    const facts = SP.readFacts(kp);
    const nodeSub = SP.resolve(id, 'calc').subTopic;
    const bundleSub = SP.deriveSubTopic(facts, null).subTopic;
    if (nodeSub == null || nodeSub !== bundleSub) {
      bad.push(id + '（' + facts.name + '）node=' + nodeSub + ' bundle=' + bundleSub);
    }
  });
  assert.deepEqual(bad, [], '双环境 subTopic 分歧（maker 分派将漂移）');
});

/* ---------------- 4. E2E 语义抽样 ---------------- */

function firstBoundKp(generatorId) {
  const rec = GR.all().filter(function (r) { return r.id === generatorId; })[0];
  assert.ok(rec, generatorId + ' 注册表记录存在');
  assert.ok((rec.knowledgePoints || []).length >= 1, generatorId + ' 至少绑定 1 KP');
  return rec.knowledgePoints[0];
}

function allowQts(kp) {
  const ev = KCV.buildEligibility([kp], ALL_TYPES);
  const m = (ev.matrix && ev.matrix[kp]) || {};
  return ALL_TYPES.filter(function (t) { return m[t] === 'ALLOW'; });
}

function gradeOf(kp) {
  const hit = ALL_KPS.filter(function (k) { return k.id === kp; })[0];
  return hit ? hit.grade : 1;
}

// 每个 P25-09 新建/重绑生成器取一个代表 KP × 其全部 ALLOW 题型做真实出题抽样
const SAMPLE_GROUPS = [
  { gen: 'generator:decimal-number', kp: firstBoundKp('generator:decimal-number') },
  { gen: 'generator:fraction-number', kp: firstBoundKp('generator:fraction-number') },
  { gen: 'generator:semantic-relations', kp: 'math-g6-down-u04-k001' }, // 比例的意义：双环境事故 KP
  { gen: 'generator:code-recognition', kp: 'math-g3-up-u06-k001' },     // 数字编码：apply 问号修复
  { gen: 'generator:reasoning', kp: 'math-g2-up-u07-k001' },            // 7~9 乘除：calc 分支
  { gen: 'generator:money-measurement', kp: 'math-g3-up-u04-k004' },    // 称重实践：concept 兜底
  { gen: 'generator:arithmetic-multiplication', kp: 'math-g4-down-u03-k003' }, // 误绑改正
  { gen: 'generator:application-word', kp: 'math-g3-up-u04-k001' },      // 等量代换
  { gen: 'generator:concept-meaning', kp: 'math-g5-down-u02-k003' }      // 倍数特征：number-theory 双环境
];

SAMPLE_GROUPS.forEach(function (group) {
  test('E2E 抽样：' + group.gen + ' 承载 ' + group.kp + ' 全部 ALLOW 题型', async () => {
    const qts = allowQts(group.kp);
    assert.ok(qts.length >= 1, group.kp + ' 存在 ALLOW 题型');
    for (const qt of qts) {
      const session = new PracticeSession({
        subject: 'math', grade: gradeOf(group.kp), count: 1,
        knowledgePointId: group.kp, questionType: qt
      });
      await session.start();
      const qs = session.semanticQuestions || [];
      assert.ok(qs.length >= 1, group.kp + '×' + qt + ' 真实生成 ≥1 题');
      const q = qs[0];
      assert.equal(q.questionType, qt, group.kp + '×' + qt + ' 题型一致');
      const qkp = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
      assert.equal(qkp, group.kp, group.kp + '×' + qt + ' KP 一致');
      assert.equal(q.metadata && q.metadata.generator, group.gen,
        group.kp + '×' + qt + ' 承载生成器应为 ' + group.gen + '，实际 ' + (q.metadata && q.metadata.generator));
      const chk = TC.check(qt, q);
      assert.ok(chk.ok, group.kp + '×' + qt + ' 契约违例: ' + chk.violations.join(','));
    }
  });
});
