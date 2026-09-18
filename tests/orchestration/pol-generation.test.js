'use strict';

/**
 * tests/orchestration/pol-generation.test.js — POL 生成接入契约测试（POL–KBL Phase 6）
 *
 * 覆盖：
 *   ⑯ Count 守恒（Σ typeCounts = plannedTotal ≤ count）
 *   ⑰ Type 最低配额（count ≥ 题型数 → 每题型 ≥1）
 *   ⑱ KP Allocation 守恒（Σ cells = Σ typeCounts）
 *   ⑳ Capacity Exhaustion 语义（CAPACITY_LIMITED / TYPE_COVERAGE_INFEASIBLE）
 *   6B Practice Plan 契约（plan() 输出字段 + comprehensive 显式回退）
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Budget = require(path.join(ROOT, 'shared', 'orchestration', 'budget-allocation.js'));
const PO = require(path.join(ROOT, 'shared', 'orchestration', 'practice-orchestrator.js'));

function sumTypeCounts(typeCounts) {
  return typeCounts.reduce((a, t) => a + t.count, 0);
}

test('⑯⑰ Type 预算：count ≥ 题型数 → 每题型 ≥1 且总量守恒', () => {
  const types = ['calc', 'fill', 'choice', 'judge', 'geometry', 'apply', 'oral'];
  const r = Budget.allocateTypeBudgets({ count: 20, questionTypes: types });
  assert.equal(r.typeCounts.length, types.length);
  r.typeCounts.forEach((t) => assert.ok(t.count >= 1, t.questionType + ' 保底 ≥1'));
  assert.equal(sumTypeCounts(r.typeCounts), 20);
  assert.equal(r.plannedTotal, 20);
  assert.equal(r.coverageStatus, 'OK');
});

test('⑯ Count < 题型数：不可覆盖 → TYPE_COVERAGE_INFEASIBLE 且每题型 ≤1', () => {
  const r = Budget.allocateTypeBudgets({ count: 3, questionTypes: ['calc', 'fill', 'choice', 'judge', 'apply'] });
  assert.equal(sumTypeCounts(r.typeCounts), 3);
  r.typeCounts.forEach((t) => assert.equal(t.count, 1));
  assert.equal(r.coverageStatus, 'TYPE_COVERAGE_INFEASIBLE');
});

test('⑳ Capacity 封顶：题型容量耗尽 → CAPACITY_LIMITED 且不超容量', () => {
  const r = Budget.allocateTypeBudgets({
    count: 10,
    questionTypes: ['calc', 'fill', 'choice'],
    typeCaps: { calc: 1, fill: 1, choice: 1 }
  });
  assert.equal(sumTypeCounts(r.typeCounts), 3);
  assert.equal(r.plannedTotal, 3);
  assert.equal(r.coverageStatus, 'CAPACITY_LIMITED');
  r.typeCounts.forEach((t) => assert.ok(t.count <= 1));
});

test('⑱ KP Allocation：Σ cells = Σ typeCounts 且只落在可行 KP', () => {
  const r = Budget.allocateKpTypeBudget({
    typeCounts: [{ questionType: 'calc', count: 5 }],
    kps: ['a', 'b', 'c'],
    eligibleKpsForType: { calc: ['a', 'b'] }
  });
  const cellTotal = r.cells.reduce((s, c) => s + c.count, 0);
  assert.equal(cellTotal, 5);
  assert.ok(r.cells.every((c) => c.kpId === 'a' || c.kpId === 'b'));
  assert.deepEqual(r.kpDistribution, { a: 3, b: 2 });
});

test('⑱ cellsForType：平摊守恒且极差 ≤1', () => {
  const cells = Budget.cellsForType({ questionType: 'calc', count: 7, kps: ['a', 'b', 'c'] });
  const total = cells.reduce((s, c) => s + c.count, 0);
  assert.equal(total, 7);
  const counts = cells.map((c) => c.count);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
});

test('6B Practice Plan 契约：plan() 输出字段与预算守恒', async () => {
  const kpId = require(path.join(ROOT, 'shared', 'orchestration', 'knowledge-context.js'))
    .poolKpIds({ subject: 'math', grade: 2 })[0];
  const p = await PO.plan({
    subject: 'math', grade: 2,
    knowledgePointIds: [kpId],
    questionTypes: ['calc', 'fill'],
    count: 6
  }, {});
  assert.equal(p.active, true);
  // Practice Plan 契约字段（6B）
  ['requestedCount', 'selectedTypes', 'feasibleTypes', 'typeCaps', 'kpTypeMatrix', 'kpDistribution', 'kpIds', 'difficulty', 'difficultyContext', 'plannedTotal', 'targetTotal'].forEach((k) => {
    assert.ok(k in p, 'Practice Plan 缺少字段 ' + k);
  });
  // 守恒：Σ cells = Σ typeCounts = plannedTotal ≤ requestedCount
  const cellTotal = (p.kpTypeMatrix || []).reduce((s, c) => s + c.count, 0);
  const allocTotal = (p.request.typeCounts || []).reduce((s, t) => s + t.count, 0);
  assert.equal(cellTotal, allocTotal);
  assert.equal(cellTotal, p.plannedTotal);
  assert.ok(p.plannedTotal <= p.requestedCount);
  assert.ok(p.kpIds.every((id) => typeof id === 'string' && id));
});

test('6B comprehensive 显式回退（不进入 POL cell 编排）', async () => {
  const p = await PO.plan({ subject: 'math', grade: 2, mode: 'comprehensive', questionTypes: ['calc'], count: 10 }, {});
  assert.equal(p.active, false);
  assert.equal(p.reason, 'comprehensive');
});
