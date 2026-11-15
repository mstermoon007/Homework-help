'use strict';

/**
 * tests/orchestration/p46-exam-allocation.test.js — P46-02 POL 试卷模板配额
 *
 * 验证：
 *   1. 全部可行且无容量限制 → 精确基准 40 题，quotaAdjustments 为空，coverageStatus=OK；
 *   2. 部分题型不可行 → 配额按优先级循环重分配，总量仍为 40，coverageStatus=TYPE_COVERAGE_INFEASIBLE；
 *   3. 容量不足 → plannedTotal 如实小于 40，coverageStatus=CAPACITY_LIMITED，不补假题；
 *   4. count=1/50 时 plan() 仍强制按 40 规划；
 *   5. 同一输入重复调用 → 输出逐字段一致（确定性）；
 *   6. 非试卷显式 typeCounts 行为不变；
 *   7. examType 不进入 cell 请求；
 *   8. 配额守恒：Σ typeCounts === plannedTotal，只含 canonical 七题型。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PO = require(path.join(ROOT, 'shared', 'orchestration', 'practice-orchestrator.js'));
const KC = require(path.join(ROOT, 'shared', 'orchestration', 'knowledge-context.js'));

const SEVEN = ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];

function sumCounts(typeCounts) {
  return typeCounts.reduce((a, x) => a + (Number(x.count) || 0), 0);
}

function toMap(typeCounts) {
  const m = {};
  typeCounts.forEach((x) => { m[x.questionType] = x.count; });
  return m;
}

test('① 全部可行且无容量限制 → 精确基准 40，无调整', () => {
  const r = PO.examAllocation(SEVEN, {});
  assert.equal(r.plannedTotal, 40);
  assert.equal(sumCounts(r.typeCounts), 40);
  assert.equal(r.coverageStatus, 'OK');
  assert.equal(r.reason, null);
  assert.deepEqual(r.quotaAdjustments, []);
  assert.deepEqual(r.skipped, []);
  const m = toMap(r.typeCounts);
  assert.equal(m.calc, 12);
  assert.equal(m.fill, 8);
  assert.equal(m.choice, 6);
  assert.equal(m.judge, 4);
  assert.equal(m.geometry, 4);
  assert.equal(m.classify, 2);
  assert.equal(m.apply, 4);
});

test('② geometry/classify 不可行 → 重分配后仍为 40', () => {
  const feasible = ['calc', 'fill', 'choice', 'judge', 'apply'];
  const r = PO.examAllocation(feasible, {});
  assert.equal(r.plannedTotal, 40, `重分配后总量应为 40，实际 ${r.plannedTotal}`);
  assert.equal(sumCounts(r.typeCounts), 40);
  assert.equal(r.coverageStatus, 'TYPE_COVERAGE_INFEASIBLE');
  assert.ok(r.reason && r.reason.indexOf('不可行') !== -1);
  assert.deepEqual(r.skipped.sort(), ['classify', 'geometry']);
  const m = toMap(r.typeCounts);
  assert.equal(m.geometry, 0);
  assert.equal(m.classify, 0);
  // 重分配示例：calc 14 / fill 9 / choice 7 / judge 5 / apply 5
  assert.equal(m.calc, 14);
  assert.equal(m.fill, 9);
  assert.equal(m.choice, 7);
  assert.equal(m.judge, 5);
  assert.equal(m.apply, 5);
});

test('③ 容量不足 → plannedTotal 如实小于 40，不补假题', () => {
  const caps = { calc: 5, fill: 5, choice: 5, judge: 5, geometry: 5, classify: 5, apply: 5 };
  const r = PO.examAllocation(SEVEN, caps);
  assert.ok(r.plannedTotal < 40, `容量受限时 plannedTotal 应 < 40，实际 ${r.plannedTotal}`);
  assert.equal(sumCounts(r.typeCounts), r.plannedTotal);
  assert.equal(r.coverageStatus, 'CAPACITY_LIMITED');
  // 每题型不超过其容量
  const m = toMap(r.typeCounts);
  SEVEN.forEach((t) => assert.ok(m[t] <= caps[t], `${t} 不应超过容量 ${caps[t]}`));
});

test('④ 配额守恒：只含 canonical 七题型且 count 非负', () => {
  const r = PO.examAllocation(SEVEN, {});
  r.typeCounts.forEach((tc) => {
    assert.ok(SEVEN.indexOf(tc.questionType) !== -1, `题型 ${tc.questionType} 非法`);
    assert.ok(Number.isInteger(tc.count) && tc.count >= 0, `${tc.questionType} count 应为非负整数`);
  });
  assert.equal(sumCounts(r.typeCounts), r.plannedTotal);
});

test('⑤ 确定性：同一输入输出逐字段一致', () => {
  const feasible = ['calc', 'fill', 'choice', 'apply'];
  const a = PO.examAllocation(feasible, { calc: 3, apply: 3 });
  const b = PO.examAllocation(feasible, { calc: 3, apply: 3 });
  assert.deepEqual(a, b);
});

test('⑥ plan() 试卷模式强制 40：count=1 和 count=50 均规划 40', async () => {
  const kpId = KC.poolKpIds({ subject: 'math', grade: 2 })[0];
  for (const c of [1, 50]) {
    const p = await PO.plan({
      subject: 'math', grade: 2, examType: 'unit',
      knowledgePointIds: [kpId], questionTypes: SEVEN, count: c, difficulty: 6
    });
    assert.ok(p.active, `count=${c} 应 active`);
    assert.equal(p.requestedCount, 40, `count=${c} 时 requestedCount 应为 40`);
    assert.equal(p.plannedTotal <= 40, true, `plannedTotal 不得超过 40`);
    assert.equal(p.examType, 'unit');
  }
});

test('⑦ plan() 非试卷显式 typeCounts 行为不变', async () => {
  // 凑十法 KP 明确支持 calc，避免因能力不可行被 skipped 干扰断言
  const kpId = 'math-g1-up-u05-k001';
  const p = await PO.plan({
    subject: 'math', grade: 1,
    knowledgePointIds: [kpId], questionTypes: ['calc'],
    count: 20, difficulty: 6,
    typeCounts: [{ questionType: 'calc', count: 10 }]
  });
  assert.ok(p.active);
  assert.equal(p.explicitCombo, true);
  assert.equal(p.examType, null);
  // 显式组合：plannedTotal 以显式配额为准，不被 count=20 拉高
  assert.equal(p.plannedTotal, 10);
  assert.equal(p.targetTotal, 10);
});

test('⑧ examType 不进入 cell 请求', async () => {
  const kpId = KC.poolKpIds({ subject: 'math', grade: 2 })[0];
  const captured = [];
  await PO.orchestrate({
    subject: 'math', grade: 2, examType: 'midterm',
    knowledgePointIds: [kpId], questionTypes: ['calc'], count: 40, difficulty: 6
  }, {}, {
    execute: async (cellReq) => {
      captured.push(cellReq);
      return { questions: [], plans: [], trace: {}, failedPlans: [] };
    }
  });
  assert.ok(captured.length > 0, '应至少执行一个 cell');
  captured.forEach((cellReq) => {
    assert.equal(cellReq.examType, undefined, 'cell 请求不得包含 examType');
  });
});

test('⑨ 非法 examType 被忽略，不破坏非试卷路径', async () => {
  const kpId = KC.poolKpIds({ subject: 'math', grade: 2 })[0];
  const p = await PO.plan({
    subject: 'math', grade: 2, examType: 'bogus',
    knowledgePointIds: [kpId], questionTypes: ['calc'], count: 15, difficulty: 6
  });
  assert.ok(p.active);
  assert.equal(p.examType, null);
  assert.equal(p.requestedCount, 15, '非法 examType 不应强制 40');
});
