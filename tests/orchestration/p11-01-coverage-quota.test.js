'use strict';

/**
 * tests/orchestration/p11-01-coverage-quota.test.js — Coverage & Quota Contract（P11-01）
 *
 * 冻结不变量：
 *   requestedCount ≥ plannedCount ≥ generatedCount = finalCount（禁止 generated > planned / final > generated / planned > requested）
 *   Σ cell.count = Σ typeCounts = plannedCount
 *   count ≥ selectedTypes.length → 每个可行 selectedType ≥ 1（canonical 7 题型全量）
 *   count < selectedTypes.length → TYPE_COVERAGE_INFEASIBLE，且不得改写用户 count
 *   Recovery：不突破 selectedKPs × selectedTypes，不突破 plannedCount / requestedCount
 *
 * 注：canonical 题型为 7（calc/fill/choice/judge/geometry/classify/apply），本文件全量覆盖；
 *     测试 KP 取自容量 ≥ 20 的池（避免将「生成器语义空间小」的 KP 混入覆盖契约用例；`oral` 为 legacy 别名 → calc，C9 验证）。
 *     P17-10：classify 全量覆盖（KPS7 = canonical g2 分类载体池；25 个全部载体的真实生成另由 p17-10-classify 用例收口）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PO = require(path.join(ROOT, 'shared', 'orchestration', 'practice-orchestrator.js'));

const GRADE = 2;
// P0-13 收口修正：capacity-map.json 为旧 ID 体系的历史缓存（键非 canonical KP），
// 依赖其过滤会使选区静默退化为年级池路径。改用与 KPS7 同池的 canonical KP
// （KBL capability：7 类全可行，容量 64 ≥ 20，满足本文件「容量 ≥ 20」前提）。
const KPS = ['math-g2-up-u01-k001', 'math-g2-up-u01-k002', 'math-g2-up-u01-k003'];
const TYPES7 = ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];
// P17-10：canonical g2 分类载体池（kbl capability：classify ∈ allowedTypes，capacity 64 ≥ 20）。
// 覆盖契约以该池承载全部 7 类（classify 计划在该池 7 类全部可行，C2 实测每类恰 =1）。
const KPS7 = ['math-g2-up-u01-k001', 'math-g2-up-u01-k002', 'math-g2-up-u01-k003', 'math-g2-up-u01-k004', 'math-g2-up-u01-k005', 'math-g2-up-u01-k006'];

function sumCells(p) {
  return (p.kpTypeMatrix || []).reduce((a, c) => a + c.count, 0);
}
function sumTypeCounts(p) {
  return (p.request.typeCounts || []).reduce((a, t) => a + t.count, 0);
}
function byType(p) {
  const out = {};
  (p.kpTypeMatrix || []).forEach((c) => { out[c.questionType] = (out[c.questionType] || 0) + c.count; });
  return out;
}
function baseReq(extra) {
  return Object.assign({
    subject: 'math', grade: GRADE, knowledgePointIds: KPS.slice(0, 1),
    questionTypes: ['calc'], count: 20, difficulty: 5
  }, extra || {});
}
function planCase(extra) {
  return PO.plan(baseReq(extra), {});
}
// 精确产出 stub：每个 cell 按 count 产出唯一指纹题
function exactStub() {
  let n = 0;
  return function (req) {
    const out = [];
    for (let i = 0; i < req.count; i++) {
      n += 1;
      out.push({
        questionFingerprint: req.knowledgePointIds[0] + ':' + req.questionTypes[0] + ':' + n,
        knowledgePointIds: req.knowledgePointIds, questionType: req.questionTypes[0], difficulty: 5
      });
    }
    return Promise.resolve({ questions: out, plans: [], trace: {}, failedPlans: [], seenKeys: null });
  };
}
// 总量封顶 stub：全局最多产出 cap 题（模拟容量耗尽）
function cappedStub(cap) {
  let made = 0;
  return function (req) {
    const out = [];
    for (let i = 0; i < req.count && made < cap; i++) {
      made += 1;
      out.push({
        questionFingerprint: req.knowledgePointIds[0] + ':' + req.questionTypes[0] + ':' + made,
        knowledgePointIds: req.knowledgePointIds, questionType: req.questionTypes[0], difficulty: 5
      });
    }
    return Promise.resolve({ questions: out, plans: [], trace: {}, failedPlans: [], seenKeys: null });
  };
}
// 首轮产出后停止 stub（触发 recovery 无进展终止）
function firstRoundOnlyStub(perCell) {
  let round = 0;
  return function (req) {
    round += 1;
    if (round > 1) return Promise.resolve({ questions: [], plans: [], trace: {}, failedPlans: [], seenKeys: null });
    const out = [];
    for (let i = 0; i < Math.min(perCell, req.count); i++) {
      out.push({
        questionFingerprint: 'r1:' + req.knowledgePointIds[0] + ':' + req.questionTypes[0] + ':' + i,
        knowledgePointIds: req.knowledgePointIds, questionType: req.questionTypes[0], difficulty: 5
      });
    }
    return Promise.resolve({ questions: out, plans: [], trace: {}, failedPlans: [], seenKeys: null });
  };
}
async function orchestrateCase(reqExtra, execute) {
  const store = [];
  const wrapped = function (req, opts) { store.push(req); return execute(req, opts); };
  const res = await PO.orchestrate(baseReq(reqExtra), {}, { execute: wrapped });
  return { res, store, o: res.orchestration };
}
function assertInvariant(res, o, planned) {
  assert.ok(res.requestedCount >= planned, 'requested ≥ planned');
  assert.ok(planned >= o.generatedCount, 'planned ≥ generated');
  assert.equal(o.generatedCount, o.finalCount, 'generated = final');
  assert.equal(res.producedCount, o.finalCount, 'producedCount = final');
  assert.ok(o.finalCount <= planned, 'final ≤ planned');
}

test('C1 正常单题型：requested = planned = generated = final = 20（SUCCESS）', async () => {
  const p = await planCase({ questionTypes: ['calc'], count: 20 });
  assert.equal(p.requestedCount, 20);
  assert.equal(p.plannedTotal, 20);
  assert.equal(sumCells(p), 20);
  const { res, o } = await orchestrateCase({ questionTypes: ['calc'], count: 20 }, exactStub());
  assert.equal(res.status, 'SUCCESS');
  assertInvariant(res, o, 20);
  assert.equal(o.plannedCount, 20);
  assert.equal(o.finalCount, 20);
});

test('C2 全题型最低覆盖：7 题型 × count 7 → 每题型 = 1，Σ = 7', async () => {
  const p = await planCase({ questionTypes: TYPES7, knowledgePointIds: KPS7, count: 7 });
  const dist = byType(p);
  assert.equal(p.coverageStatus, 'OK');
  TYPES7.forEach((t) => assert.equal(dist[t], 1, t + ' = 1'));
  assert.equal(sumCells(p), 7);
  assert.equal(sumTypeCounts(p), 7);
});

test('C3 全题型平均分配：7 题型 × count 20 → Σ = 20，每题型 ≥ 1', async () => {
  const p = await planCase({ questionTypes: TYPES7, knowledgePointIds: KPS7, count: 20 });
  const dist = byType(p);
  TYPES7.forEach((t) => assert.ok(dist[t] >= 1, t + ' ≥ 1'));
  assert.equal(sumCells(p), 20);
  assert.equal(sumTypeCounts(p), 20);
  assert.equal(p.plannedTotal, 20);
});

test('C4 全题型较大题量：7 题型 × count 50 → Σ = 50，每题型 ≥ 1', async () => {
  const p = await planCase({ questionTypes: TYPES7, knowledgePointIds: KPS7, count: 50 });
  const dist = byType(p);
  TYPES7.forEach((t) => assert.ok(dist[t] >= 1, t + ' ≥ 1'));
  assert.equal(sumCells(p), 50);
  assert.equal(p.plannedTotal, 50);
});

test('C5 多 KP × 多 Type：Σ cell.count = Σ typeCounts = plannedCount，cell ⊆ 选区', async () => {
  const p = await planCase({ questionTypes: TYPES7, knowledgePointIds: KPS7, count: 30 });
  assert.equal(sumCells(p), p.plannedTotal);
  assert.equal(sumTypeCounts(p), p.plannedTotal);
  (p.kpTypeMatrix || []).forEach((c) => {
    assert.ok(KPS7.indexOf(c.kpId) !== -1, 'cell kp ∈ selectedKPs');
    assert.ok(TYPES7.indexOf(c.questionType) !== -1, 'cell type ∈ selectedTypes');
  });
  const { res, o } = await orchestrateCase({ questionTypes: TYPES7, knowledgePointIds: KPS7, count: 30 }, exactStub());
  assert.equal(res.status, 'SUCCESS');
  assertInvariant(res, o, p.plannedTotal);
  assert.equal(o.finalCount, p.plannedTotal);
});

test('C6 count < 题型数：7 题型 × count 5 → TYPE_COVERAGE_INFEASIBLE，不改写 count', async () => {
  const p = await planCase({ questionTypes: TYPES7, knowledgePointIds: KPS7, count: 5 });
  assert.equal(p.coverageStatus, 'TYPE_COVERAGE_INFEASIBLE');
  assert.equal(p.requestedCount, 5, 'requestedCount 保持 5');
  assert.equal(p.request.count, 5, 'request.count 保持 5');
  assert.equal(sumCells(p), 5);
  const dist = byType(p);
  Object.keys(dist).forEach((t) => assert.ok(dist[t] <= 1, t + ' ≤ 1'));
  assert.equal(Object.keys(dist).length, 5, '恰有 5 个题型获得 1 题');
});

test('C7 Capacity 限制：requested ≥ planned ≥ generated = final，status = PARTIAL', async () => {
  const p = await planCase({ questionTypes: ['calc'], count: 20 });
  const { res, o } = await orchestrateCase({ questionTypes: ['calc'], count: 20 }, cappedStub(8));
  assert.equal(res.status, 'PARTIAL');
  assertInvariant(res, o, p.plannedTotal);
  assert.equal(o.requestedCount, 20);
  assert.equal(o.plannedCount, 20);
  assert.equal(o.finalCount, 8);
  assert.ok(o.budgetRecovered <= o.requestedCount, 'recovery 不增加用户总题量');
});

test('C8 Recovery：不突破 selectedKPs × selectedTypes，不突破 plannedCount / requestedCount', async () => {
  const p = await planCase({ questionTypes: ['calc'], count: 20 });
  const { res, store, o } = await orchestrateCase({ questionTypes: ['calc'], count: 20 }, firstRoundOnlyStub(3));
  assert.equal(res.status, 'PARTIAL');
  assert.ok(store.length >= 2, 'recovery 实际发生（多轮 cell 执行）');
  assert.ok(store.length <= 1 + PO.MAX_RECOVERY_ROUNDS, 'recovery 轮次有界');
  store.forEach((cell, i) => {
    assert.equal(cell.questionTypes.length, 1, 'cell#' + i + ' 单题型');
    assert.equal(cell.knowledgePointIds.length, 1, 'cell#' + i + ' 单 KP');
    assert.ok(['calc'].indexOf(cell.questionTypes[0]) !== -1, 'cell#' + i + ' 题型不越界');
    assert.ok(KPS.slice(0, 1).indexOf(cell.knowledgePointIds[0]) !== -1, 'cell#' + i + ' KP 不越界');
    assert.ok(cell.count <= p.plannedTotal, 'cell#' + i + ' 不超计划');
  });
  assertInvariant(res, o, p.plannedTotal);
  assert.equal(o.finalCount, 3);
});

test('C9 legacy 别名不丢失：oral → calc（canonical 题型，无静默丢弃）', async () => {
  const p = await planCase({ questionTypes: ['calc', 'oral'], count: 10 });
  assert.deepEqual(p.selectedTypes, ['calc'], 'oral 归一为 calc 并去重');
  assert.deepEqual(p.feasibleTypes, ['calc']);
  assert.equal(p.plannedTotal, 10);
  assert.equal(sumCells(p), 10);
});
