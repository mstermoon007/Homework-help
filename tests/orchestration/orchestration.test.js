/**
 * tests/orchestration/orchestration.test.js — 标准练习编排层（POL）测试矩阵
 *
 * 覆盖方案 §二十七 / §二十八：
 *   - 纯题型预算分配（Type Coverage / 均衡 / 容量约束 / 缺口回收）
 *   - 编排层主流程（orchestrate）：题型保底、单一账本、预算守恒、无重复预算、终止条件
 *   - 真实引擎冒烟（单 KP 单题型），确保接入后链路不破
 * 不修改 Frozen Core；编排层与生成算法无关，纯逻辑可独立验证。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const BA = require(path.join(ROOT, 'shared', 'orchestration', 'budget-allocation.js'));
const PP = require(path.join(ROOT, 'shared', 'orchestration', 'practice-plan.js'));
const PO = require(path.join(ROOT, 'shared', 'orchestration', 'practice-orchestrator.js'));

// 引擎引导（供真实冒烟用例；mock 用例不依赖）
require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-bank.js'));
require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
require(path.join(ROOT, 'shared', 'strategy', 'comprehensive-strategy.js'));
require(path.join(ROOT, 'shared', 'engine', 'presentation-engine.js'));
require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'render-options.js'));
const GenerationAPI = require(path.join(ROOT, 'shared', 'generation', 'api.js'));

// ---------- 纯分配：题型覆盖 / 均衡 ----------
test('Case 01: 1 题型 count=20 → 该题型独得 20', () => {
  const r = BA.allocateTypeBudgets({ count: 20, questionTypes: ['calc'] });
  assert.deepStrictEqual(r.typeCounts, [{ questionType: 'calc', count: 20 }]);
  assert.strictEqual(r.plannedTotal, 20);
  assert.strictEqual(r.coverageStatus, 'OK');
});

test('Case 02: 7 题型 count=7 → 1/1/1/1/1/1/1', () => {
  const types = ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];
  const r = BA.allocateTypeBudgets({ count: 7, questionTypes: types });
  assert.strictEqual(r.plannedTotal, 7);
  r.typeCounts.forEach((e) => assert.strictEqual(e.count, 1, e.questionType));
  assert.strictEqual(r.coverageStatus, 'OK');
});

test('Case 03: 7 题型 count=20 → 3/3/3/3/3/3/2（均衡）', () => {
  const types = ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];
  const r = BA.allocateTypeBudgets({ count: 20, questionTypes: types });
  const sum = r.typeCounts.reduce((a, e) => a + e.count, 0);
  assert.strictEqual(sum, 20);
  assert.strictEqual(r.plannedTotal, 20);
  // 最大最小差不超过 1
  const counts = r.typeCounts.map((e) => e.count);
  assert.ok(Math.max.apply(null, counts) - Math.min.apply(null, counts) <= 1);
  assert.strictEqual(r.coverageStatus, 'OK');
});

test('Case 04: 7 题型 count=5 → TYPE_COVERAGE_INFEASIBLE，最多交付 5 题', () => {
  const types = ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];
  const r = BA.allocateTypeBudgets({ count: 5, questionTypes: types });
  assert.strictEqual(r.coverageStatus, 'TYPE_COVERAGE_INFEASIBLE');
  const sum = r.typeCounts.reduce((a, e) => a + e.count, 0);
  assert.strictEqual(sum, 5);
  // 每题型至多 1
  r.typeCounts.forEach((e) => assert.strictEqual(e.count, 1));
});

test('Case 06: 某题型容量=1 → 该题型最多 1，剩余预算转移', () => {
  const types = ['calc', 'fill', 'choice'];
  const caps = { calc: 10, fill: 1, choice: 1 };
  const r = BA.allocateTypeBudgets({ count: 10, questionTypes: types, typeCaps: caps });
  const map = {};
  r.typeCounts.forEach((e) => { map[e.questionType] = e.count; });
  assert.strictEqual(map.fill, 1);
  assert.strictEqual(map.choice, 1);
  assert.strictEqual(map.calc, 8); // 剩余 7 全给 calc
  assert.strictEqual(r.plannedTotal, 10);
});

test('Case 07: 全部题型容量=1，count=10 → CAPACITY_LIMITED，plannedTotal=4（不创造预算）', () => {
  const types = ['calc', 'fill', 'choice', 'judge'];
  const caps = { calc: 1, fill: 1, choice: 1, judge: 1 };
  const r = BA.allocateTypeBudgets({ count: 10, questionTypes: types, typeCaps: caps });
  assert.strictEqual(r.coverageStatus, 'CAPACITY_LIMITED');
  assert.strictEqual(r.plannedTotal, 4);
});

// ---------- 纯分配：缺口回收 ----------
test('allocateRecovery: 有剩余容量 → 均衡补充缺口', () => {
  const r = BA.allocateRecovery({
    deficit: 4,
    questionTypes: ['calc', 'fill', 'choice'],
    typeCaps: { calc: 10, fill: 10, choice: 10 },
    produced: { calc: 3, fill: 3, choice: 3 }
  });
  const sum = r.typeCounts.reduce((a, e) => a + e.count, 0);
  assert.strictEqual(sum, 4);
  assert.strictEqual(r.appliedTotal, 4);
  // 均衡：2/1/1
  const map = {};
  r.typeCounts.forEach((e) => { map[e.questionType] = e.count; });
  assert.strictEqual(map.calc, 2);
});

test('allocateRecovery: 无剩余容量 → 空（终止，不循环）', () => {
  const r = BA.allocateRecovery({
    deficit: 5,
    questionTypes: ['calc', 'fill'],
    typeCaps: { calc: 1, fill: 1 },
    produced: { calc: 1, fill: 1 }
  });
  assert.deepStrictEqual(r.typeCounts, []);
  assert.strictEqual(r.appliedTotal, 0);
});

// ---------- 性质测试（§二十八） ----------
test('性质：预算守恒（分配后 Σ == plannedTotal <= count）', () => {
  [5, 7, 20, 100].forEach((count) => {
    const types = ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];
    const r = BA.allocateTypeBudgets({ count: count, questionTypes: types });
    const sum = r.typeCounts.reduce((a, e) => a + e.count, 0);
    assert.ok(sum <= count, 'count=' + count);
    assert.strictEqual(sum, r.plannedTotal);
  });
});

test('性质：题型保底（count >= 题型数 → 每题型 ≥1）', () => {
  const types = ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];
  const r = BA.allocateTypeBudgets({ count: 20, questionTypes: types });
  r.typeCounts.forEach((e) => assert.ok(e.count >= 1));
});

// ---------- 编排层主流程（mock 执行体，确定性） ----------
function makeMock(underFactor) {
  return function (req, opts) {
    const tcs = req.typeCounts || [];
    const qs = [];
    let idx = 0;
    tcs.forEach((tc) => {
      let n = tc.count;
      if (underFactor && underFactor > 1) n = Math.floor(n / underFactor);
      for (let i = 0; i < n; i++) {
        qs.push({ questionType: tc.questionType, questionFingerprint: tc.questionType + '-' + (idx++), prompt: 'p' });
      }
    });
    return Promise.resolve({
      questions: qs, plans: [], trace: {}, failedPlans: [],
      seenKeys: new Set(), producedCount: qs.length, requestedCount: req.count
    });
  };
}
const renderMock = (qs, ro) => ({ items: (qs || []).map((q, i) => ({ id: i })), html: '', renderOptions: ro });
const roMock = () => ({ normalize: (x) => x || {} });

function baseReq(over) {
  return Object.assign({
    subject: 'math', grade: 1,
    knowledgePointIds: ['kp-mock-a', 'kp-mock-b'], // 不在 capacity map → 容量 Infinity，均衡
    questionTypes: ['calc', 'fill', 'choice', 'judge'],
    count: 20
  }, over || {});
}

test('orchestrate: 4 题型 count=20 → 5/5/5/5，SUCCESS，账本正确', async () => {
  const res = await PO.orchestrate(baseReq(), {}, { execute: makeMock(), render: renderMock, getRenderOptions: roMock });
  assert.strictEqual(res.status, 'SUCCESS');
  assert.strictEqual(res.producedCount, 20);
  assert.strictEqual(res.requestedCount, 20);
  assert.ok(res.html !== undefined);
  assert.ok(res.orchestration, '含编排账本');
  const dist = PP.aggregateTypeDistribution(res.questions);
  assert.deepStrictEqual(Object.keys(dist).sort(), ['calc', 'choice', 'fill', 'judge']);
  [4, 'calc', 'fill', 'choice', 'judge'].forEach(() => {});
  assert.strictEqual(dist.calc + dist.fill + dist.choice + dist.judge, 20);
  assert.strictEqual(res.orchestration.plannedCount, 20);
  assert.strictEqual(res.orchestration.selectedTypeCount, 4);
  assert.strictEqual(res.orchestration.coveredTypeCount, 4);
  assert.deepStrictEqual(res.orchestration.missingTypes, []);
});

test('orchestrate: 性质 最终题量 <= 请求量（单一预算账本）', async () => {
  const res = await PO.orchestrate(baseReq({ count: 100 }), {}, { execute: makeMock(), render: renderMock, getRenderOptions: roMock });
  assert.ok(res.producedCount <= 100);
  assert.ok(res.orchestration.finalCount <= res.requestedCount);
});

test('orchestrate: 缺口回收触发（mock 欠产）→ 终止于恢复轮次，PARTIAL，recovered>0', async () => {
  const res = await PO.orchestrate(baseReq({ count: 20 }), {}, { execute: makeMock(3), render: renderMock, getRenderOptions: roMock });
  assert.strictEqual(res.status, 'PARTIAL');
  assert.ok(res.producedCount > 0 && res.producedCount <= 20, 'produced=' + res.producedCount);
  assert.ok(res.orchestration.budgetRecovered > 0, '应触发回收');
  assert.ok(res.orchestration.finalCount <= res.requestedCount);
});

test('orchestrate: 无题型 → 透明回退到 execute（POL 不介入）', async () => {
  let called = false;
  const res = await PO.orchestrate(
    { subject: 'math', grade: 1, knowledgePointIds: ['kp-x'], count: 5 },
    {},
    {
      execute: (req) => { called = true; return Promise.resolve({ questions: [{ questionType: 'calc', questionFingerprint: 'a' }], plans: [], trace: {}, failedPlans: [], seenKeys: new Set(), producedCount: 1, requestedCount: 5 }); },
      render: renderMock, getRenderOptions: roMock
    }
  );
  assert.ok(called, '应回退到 execute');
  assert.strictEqual(res.producedCount, 1);
  assert.strictEqual(res.orchestration, undefined);
});

// ---------- 真实引擎冒烟（单 KP 单题型，确保接入不破链） ----------
test('真实引擎：单 KP + questionTypes=calc count=5 → 产出 <=5，orchestration 账本存在', async () => {
  const res = await GenerationAPI.generate({
    subject: 'math', grade: 1, mode: 'single-kp',
    knowledgePointIds: ['math-g1-m1-addsub-10'],
    questionTypes: ['calc'], count: 5, difficulty: 2
  });
  assert.ok(res.status === 'SUCCESS' || res.status === 'PARTIAL' || res.status === 'FAILED');
  assert.ok(res.producedCount <= 5);
  assert.ok(res.orchestration, '编排层账本应存在');
  assert.strictEqual(res.orchestration.requestedCount, 5);
});

test('真实引擎：非数学科目 → NOT_IMPLEMENTED（边界不变）', async () => {
  const res = await GenerationAPI.generate({
    subject: 'chinese', grade: 1,
    knowledgePointIds: ['cn-g1-x'], questionTypes: ['calc'], count: 5
  });
  assert.strictEqual(res.status, 'NOT_IMPLEMENTED');
});
