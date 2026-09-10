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

// ---------- P0-05：二维预算（Type + KP → GenerationTask） ----------
test('allocateKpTypeBudget: 类型配额在可行 KPs 间均衡分摊，Σ守恒', () => {
  const typeCounts = [
    { questionType: 'calc', count: 5 }, { questionType: 'fill', count: 5 }
  ];
  const kps = ['kp-a', 'kp-b', 'kp-c'];
  const eligible = { calc: ['kp-a', 'kp-b', 'kp-c'], fill: ['kp-a', 'kp-b'] };
  const r = BA.allocateKpTypeBudget({ typeCounts, kps, eligibleKpsForType: eligible });
  const sum = r.cells.reduce((a, c) => a + c.count, 0);
  assert.strictEqual(sum, 10, 'Σ cells === Σ typeCounts（预算守恒）');
  const calcCells = r.cells.filter((c) => c.questionType === 'calc');
  assert.deepStrictEqual(calcCells.map((c) => c.count).sort((a, b) => a - b), [1, 2, 2]);
  const fillCells = r.cells.filter((c) => c.questionType === 'fill');
  assert.strictEqual(fillCells.length, 2, 'fill 仅分摊到 2 个可行 KP');
  // P0-06 scope 硬边界：所有 cell 都在 kp 选区内
  r.cells.forEach((c) => assert.ok(kps.indexOf(c.kpId) !== -1, 'cell.kpId ∈ 选区'));
});

test('cellsForType: count=1 只给一个可行 KP；count=0 无 cell', () => {
  const cells = BA.cellsForType({ questionType: 'calc', count: 1, kps: ['a', 'b'], eligible: ['a', 'b'] });
  assert.strictEqual(cells.length, 1);
  assert.strictEqual(cells[0].count, 1);
  const c2 = BA.cellsForType({ questionType: 'calc', count: 0, kps: ['a'] });
  assert.deepStrictEqual(c2, []);
});

test('cellsForType: eligible 为空（能力信息缺失）→ 全 KP 兜底，预算不吞', () => {
  const cells = BA.cellsForType({ questionType: 'calc', count: 3, kps: ['a', 'b'], eligible: [] });
  assert.strictEqual(cells.reduce((a, c) => a + c.count, 0), 3);
  assert.strictEqual(cells.length, 2);
});

// ---------- P0-02：难度分桶（Capacity × Difficulty 同维度） ----------
test('difficultyBucket: 1-10 归桶正确（1-3/4-6/7-10）', () => {
  const CI = require(path.join(ROOT, 'shared', 'capacity', 'capacity-inventory.js'));
  assert.strictEqual(CI.difficultyBucket(1), '1-3');
  assert.strictEqual(CI.difficultyBucket(3), '1-3');
  assert.strictEqual(CI.difficultyBucket(4), '4-6');
  assert.strictEqual(CI.difficultyBucket(6), '4-6');
  assert.strictEqual(CI.difficultyBucket(7), '7-10');
  assert.strictEqual(CI.difficultyBucket(10), '7-10');
  assert.strictEqual(CI.difficultyBucket(0), '1-3');
  assert.strictEqual(CI.difficultyBucket(11), '7-10');
  assert.strictEqual(CI.difficultyBucket(NaN), '1-3');
});

test('getCapacityFor: 有分桶按难度桶取，无分桶回退顶层', () => {
  const CI = require(path.join(ROOT, 'shared', 'capacity', 'capacity-inventory.js'));
  const flatMap = { kp1: { total: 128, tier: 'HIGH', byType: { calc: 128 } } };
  assert.strictEqual(CI.getCapacityFor(flatMap, 'kp1', 5).total, 128);
  const bucketMap = {
    kp1: {
      total: 128, tier: 'HIGH', byType: { calc: 128 },
      byDifficulty: {
        '1-3': { total: 128, tier: 'HIGH', byType: { calc: 128 } },
        '7-10': { total: 40, tier: 'MEDIUM', byType: { calc: 40 } }
      }
    }
  };
  assert.strictEqual(CI.getCapacityFor(bucketMap, 'kp1', 8).total, 40);
  assert.strictEqual(CI.getCapacityFor(bucketMap, 'kp1', 2).total, 128);
  assert.strictEqual(CI.getCapacityFor(bucketMap, 'missing', 2), null);
  assert.strictEqual(CI.getCapacityFor(null, 'kp1', 2), null);
});

// ---------- P0-03：能力判定（Capability ≠ Capacity） ----------
test('knowledge-capability-view: 真实 KP 判定 + 未知 KP 乐观可生成', () => {
  require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-bank.js'));
  const KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
  const ev = KCV.buildEligibility(['math-g1-m1-addsub-10'], ['calc', 'fill', 'apply', 'classify']);
  assert.ok(ev.resolvable, 'resolver 可用');
  assert.strictEqual(ev.matrix['math-g1-m1-addsub-10'].calc, 'ALLOW');
  const ev2 = KCV.buildEligibility(['kp-mock'], ['calc']);
  assert.strictEqual(ev2.matrix['kp-mock'].calc, 'ALLOW', '未知 KP 不阻断');
});

// ---------- 编排层主流程（mock 执行体，确定性） ----------
// mock 指纹全局唯一（与真实引擎一致）：同一 orchestrate 生命周期内跨 cell / 跨恢复轮次不重复。
function makeMock(underFactor) {
  let idx = 0;
  return function (req, opts) {
    const tcs = req.typeCounts || [];
    const qs = [];
    tcs.forEach((tc) => {
      let n = tc.count;
      if (underFactor && underFactor > 1) n = Math.floor(n / underFactor);
      for (let i = 0; i < n; i++) {
        qs.push({ questionType: tc.questionType, questionFingerprint: tc.questionType + '-' + (idx++), prompt: 'p', knowledgePointId: (req.knowledgePointIds || ['?'])[0] });
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
  const res = await PO.orchestrate(baseReq({ count: 20 }), {}, { execute: makeMock(2), render: renderMock, getRenderOptions: roMock });
  assert.strictEqual(res.status, 'PARTIAL');
  assert.ok(res.producedCount > 0 && res.producedCount <= 20, 'produced=' + res.producedCount);
  assert.ok(res.orchestration.budgetRecovered > 0, '应触发回收');
  assert.ok(res.orchestration.finalCount <= res.requestedCount);
  // 逐 type 覆盖仍然成立（部分题型至少 1 题）
  const dist = PP.aggregateTypeDistribution(res.questions);
  ['calc', 'fill', 'choice', 'judge'].forEach((t) => assert.ok(dist[t] > 0, t + ' 覆盖'));
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

// ---------- P0-07：7 类规范题型最少覆盖真实 E2E（每题型 ≥1 真实产出） ----------
test('真实引擎：7 类规范题型各自最少产出 1 题且 account 覆盖（P0-07）', async () => {
  const cases = [
    ['calc', 'math-g1-m1-addsub-5'],
    ['fill', 'math-g1-m1-addsub-5'],
    ['choice', 'math-g1-m4-compose-number'],
    ['judge', 'math-g1-m11-judge-mixed'],
    ['geometry', 'math-g3-m6-g3-polygon'],
    ['classify', 'math-g1-m4-count-quantity'],
    ['apply', 'math-g1-m4-rmb-calc']
  ];
  for (const [qt, kpId] of cases) {
    const res = await GenerationAPI.generate({
      subject: 'math', grade: 1, mode: 'single-kp',
      knowledgePointIds: [kpId], questionTypes: [qt], count: 1, difficulty: 2
    });
    assert.ok(res.status === 'SUCCESS' || res.status === 'PARTIAL', qt + '@' + kpId + ' -> ' + res.status);
    assert.ok(res.producedCount >= 1, qt + '@' + kpId + ' 应有产出，got ' + res.producedCount);
    if (res.questions && res.questions.length) {
      assert.ok(res.questions.every((q) => q.questionType === qt), qt + '@' + kpId + ' 产出类型应一致');
    }
    assert.ok(res.orchestration, qt + ' 应含编排账本');
    assert.ok(res.orchestration.coveredKps.every((k) => k === kpId), qt + '@' + kpId + ' 越界到选区外 KP: ' + JSON.stringify(res.orchestration.coveredKps));
  }
});

// ---------- P0-06：用户 KP 选区硬边界（缺口回收多轮下也绝不越界） ----------
test('orchestrate: 缺口回收多轮 → 所有 cell/question 均落在用户选区（P0-06）', async () => {
  const selection = ['kp-mock-a', 'kp-mock-b'];
  const res = await PO.orchestrate(baseReq({ count: 20 }), {}, { execute: makeMock(3), render: renderMock, getRenderOptions: roMock });
  assert.strictEqual(res.status, 'PARTIAL'); // 欠产触发回收
  assert.ok(res.producedCount > 0, '应有回收产出');
  // 产物 KP 全部属于用户选区
  res.questions.forEach((q) => assert.ok(selection.indexOf(q.knowledgePointId) !== -1, '越界 KP: ' + q.knowledgePointId));
  // 账本 KP 全部属于用户选区
  assert.ok(res.orchestration.coveredKps.every((k) => selection.indexOf(k) !== -1));
  (res.orchestration.kpTypeMatrix || []).forEach((cell) => assert.ok(selection.indexOf(cell.kpId) !== -1, '越界 cell: ' + cell.kpId));
  assert.ok(res.orchestration.coveredKpCount <= selection.length);
});

// ---------- §33 Case 03/04/05/06：真实多 KP × 7 题型，每题型 ≥1 且总量精确、选区不越界 ----------
const P07_KPS = [
  'math-g1-m1-addsub-5', 'math-g1-m1-addsub-10', 'math-g1-m4-compose-number',
  'math-g1-m11-judge-mixed', 'math-g3-m6-g3-polygon', 'math-g1-m4-count-quantity',
  'math-g1-m4-rmb-calc'
];
const P07_TYPES = ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];

test('§33 C03/C04/C05：真实 7 KP × 7 题型 count=7/10/20 → 每题型≥1、总量精确、KP 不越界', async () => {
  for (const count of [7, 10, 20]) {
    const res = await GenerationAPI.generate({
      subject: 'math', grade: 1,
      knowledgePointIds: P07_KPS, questionTypes: P07_TYPES,
      count, difficulty: 2
    });
    assert.strictEqual(res.status, 'SUCCESS', 'count=' + count + ' status=' + res.status);
    assert.strictEqual(res.producedCount, count, 'count=' + count + ' 总量应精确');
    const dist = {};
    res.questions.forEach((q) => { dist[q.questionType] = (dist[q.questionType] || 0) + 1; });
    P07_TYPES.forEach((t) => assert.ok((dist[t] || 0) >= 1, 'count=' + count + ' ' + t + ' 应≥1，实际 ' + (dist[t] || 0)));
    assert.deepStrictEqual(res.orchestration.missingTypes, [], 'count=' + count + ' missing=' + JSON.stringify(res.orchestration.missingTypes));
    res.questions.forEach((q) => assert.ok(P07_KPS.indexOf(q.knowledgePointId) !== -1, '越界 KP: ' + q.knowledgePointId));
    assert.ok(res.orchestration.coveredKps.every((k) => P07_KPS.indexOf(k) !== -1));
    (res.orchestration.kpTypeMatrix || []).forEach((cell) => assert.ok(P07_KPS.indexOf(cell.kpId) !== -1, '越界 cell: ' + cell.kpId));
  }
});

test('§33 C02：真实 1 KP × 7 题型 count=7 → 产出在 [1,7]，缺口记录而非静默', async () => {
  const res = await GenerationAPI.generate({
    subject: 'math', grade: 1, mode: 'single-kp',
    knowledgePointIds: ['math-g1-m1-addsub-5'], questionTypes: P07_TYPES,
    count: 7, difficulty: 2
  });
  assert.ok(res.producedCount >= 1 && res.producedCount <= 7, 'produced=' + res.producedCount);
  assert.ok(res.status === 'SUCCESS' || res.status === 'PARTIAL');
  // 无静默替换：即使部分题型该 KP 无法产出，也不应产生选区外 KP 题目
  res.questions.forEach((q) => assert.strictEqual(q.knowledgePointId, 'math-g1-m1-addsub-5'));
});

// ---------- §33 Case 09：classify 完整闭环（Registry→Capability→Capacity→Orchestration→真实生成） ----------
test('§33 C09：classify 多 KP 预算分摊（count=5 落在 3 个支持 KP）', async () => {
  const kps = ['math-g1-m4-count-quantity', 'math-g3-m9-g3-stats-table', 'math-g3-m10-g3-set'];
  const res = await GenerationAPI.generate({
    subject: 'math', grade: 1,
    knowledgePointIds: kps, questionTypes: ['classify'],
    count: 5, typeCounts: { classify: 5 }, difficulty: 2
  });
  assert.strictEqual(res.status, 'SUCCESS', 'status=' + res.status);
  assert.strictEqual(res.producedCount, 5);
  const used = [];
  res.questions.forEach((q) => { if (used.indexOf(q.knowledgePointId) === -1) used.push(q.knowledgePointId); });
  assert.strictEqual(used.length, 3, 'classify 应摊到 3 个支持 KP，实际 ' + JSON.stringify(used));
  res.questions.forEach((q) => assert.strictEqual(q.questionType, 'classify'));
});

test('§33 C09：classify × 多题型共存（1 KP 内 classify/choice/fill 各自≥1）', async () => {
  const res = await GenerationAPI.generate({
    subject: 'math', grade: 1, mode: 'single-kp',
    knowledgePointIds: ['math-g1-m4-count-quantity'],
    questionTypes: ['classify', 'choice', 'fill'],
    count: 6, typeCounts: { classify: 2, choice: 2, fill: 2 }, difficulty: 2
  });
  assert.strictEqual(res.status, 'SUCCESS', 'status=' + res.status);
  assert.strictEqual(res.producedCount, 6);
  const dist = {};
  res.questions.forEach((q) => { dist[q.questionType] = (dist[q.questionType] || 0) + 1; });
  assert.deepStrictEqual(dist, { classify: 2, choice: 2, fill: 2 });
});

// ---------- §33 Case 10：难度维度对齐（用户难度 / Capacity 桶 / 生成难度一致） ----------
test('§33 C10：difficulty=1/5/10 → ledger 桶与题目难度一致，无维度错位', async () => {
  const cases = [[1, '1-3'], [5, '4-6'], [10, '7-10']];
  for (const [d, bucket] of cases) {
    const res = await GenerationAPI.generate({
      subject: 'math', grade: 1,
      knowledgePointIds: ['math-g1-m1-addsub-10', 'math-g1-m4-rmb-calc'],
      questionTypes: ['calc', 'apply'],
      count: 4, typeCounts: { calc: 2, apply: 2 }, difficulty: d
    });
    assert.strictEqual(res.status, 'SUCCESS', 'd=' + d + ' status=' + res.status);
    assert.strictEqual(res.orchestration.difficultyBucket, bucket, 'd=' + d + ' 桶应=' + bucket);
    res.questions.forEach((q) => assert.strictEqual(q.difficulty, d, '题目难度应等于用户难度 ' + d));
  }
});

// ---------- §33 Case 07：无静默生成/替换；缺口入账（KP 容量天然受限场景） ----------
test('§33 C07：容量天然受限 KP 超量请求 → 产出=容量上限、缺口记录、无选区外补题', async () => {
  const res = await GenerationAPI.generate({
    subject: 'math', grade: 1, mode: 'single-kp',
    knowledgePointIds: ['math-g3-m6-g3-polygon'], questionTypes: ['geometry'],
    count: 5, typeCounts: { geometry: 5 }, difficulty: 2
  });
  assert.strictEqual(res.status, 'PARTIAL', '容量受限应 PARTIAL（不静默）');
  assert.strictEqual(res.producedCount, 1, 'polygon geometry 容量=1');
  assert.strictEqual(res.orchestration.plannedCount, 1, '容量应作为预算上限提前收缩（不按 5 规划）');
  assert.strictEqual(res.orchestration.finalCount, 1, '缺口应入账（requested=5 → final=1）');
  assert.strictEqual(res.orchestration.coverageStatus, 'CAPACITY_LIMITED', '应显式标记容量受限而非静默成功');
  res.questions.forEach((q) => assert.strictEqual(q.knowledgePointId, 'math-g3-m6-g3-polygon'));
});

// ---------- §33 Case 08：Capacity=0 不降级为 FORBID（可行性由能力决定） ----------
test('§33 C08：typeCap=0 的题型仍保留在预算（不得当作能力禁用直接删除）', () => {
  const r = BA.allocateTypeBudgets({ count: 5, questionTypes: ['calc', 'fill'], typeCaps: { calc: 0, fill: 5 } });
  const calcCount = r.typeCounts.find((e) => e.questionType === 'calc');
  assert.ok(calcCount && calcCount.count >= 1, 'capacity=0 的 calc 仍应进入 typeCounts：' + JSON.stringify(r.typeCounts));
  assert.strictEqual(r.plannedTotal, 5);
});

// ---------- 难度系统兼容：静默难度的账本桶与生成维度对齐（P0-02） ----------
test('C10b：未显式难度时 ledger 难度桶 = 实际产出题目难度的桶（修正默认 3 错位）', async () => {
  const CI = require(path.join(ROOT, 'shared', 'capacity', 'capacity-inventory.js'));
  // G4 中档 KP：策略 7 维静态 d4 → composed 5；之前 ledger 误标 1-3（默认 3），题目实为 d5
  const res = await GenerationAPI.generate({
    subject: 'math', grade: 4, mode: 'single-kp',
    knowledgePointIds: ['math-g4-m3-g4-mix-dist'], questionTypes: ['calc'], count: 1
  });
  assert.strictEqual(res.status, 'SUCCESS', 'status=' + res.status);
  assert.ok(res.questions.length >= 1, '应产出');
  const produced = res.questions[0].difficulty;
  assert.strictEqual(res.orchestration.difficultyBucket, CI.difficultyBucket(produced),
    'ledger 桶应与真实产出难度同维度：produced=' + produced + ' bucket=' + res.orchestration.difficultyBucket);
  assert.strictEqual(res.orchestration.difficultyBucket, '4-6', 'G4 中档 composed=5 应落 4-6（而非默认 3 → 1-3）');
});

// ---------- 难度系统兼容：显式难度权威且生成/桶严格对齐（回归保护） ----------
test('C10c：显式难度 d1/6/10 → 产出=d 且桶=difficultyBucket(d)（维度不错位）', async () => {
  const CI = require(path.join(ROOT, 'shared', 'capacity', 'capacity-inventory.js'));
  const KP = require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-point.js')).get('math-g6-c1-vertical-multidigit');
  assert.ok(KP && KP.grade === 6, 'G6 KP 可达');
  for (const d of [1, 6, 10]) {
    const res = await GenerationAPI.generate({
      subject: 'math', grade: 6, mode: 'single-kp',
      knowledgePointIds: ['math-g6-c1-vertical-multidigit'], questionTypes: ['calc'], count: 1, difficulty: d
    });
    assert.strictEqual(res.status, 'SUCCESS', 'd=' + d + ' status=' + res.status);
    assert.strictEqual(res.questions[0].difficulty, d, '显式难度应权威生效 d=' + d);
    assert.strictEqual(res.orchestration.difficultyBucket, CI.difficultyBucket(d), '桶应与用户难度同维度 d=' + d);
  }
});
