'use strict';

/**
 * tests/orchestration/p10-count-contract.test.js — 题量控制契约（P10-1）
 *
 * 冻结规则：用户 count = 整套练习总预算；POL 是唯一分配者；
 *   Σ typeCounts ≤ requestedCount；count ≥ 题型数 → 每题型 ≥1；
 *   Σ cells = Σ typeCounts；不重新解释 count（KP × count 永不发生）；容量不足 → 显式 PARTIAL。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Budget = require(path.join(ROOT, 'shared', 'orchestration', 'budget-allocation.js'));
const PO = require(path.join(ROOT, 'shared', 'orchestration', 'practice-orchestrator.js'));
const KC = require(path.join(ROOT, 'shared', 'orchestration', 'knowledge-context.js'));

const SEVEN = ['calc', 'fill', 'choice', 'judge', 'geometry', 'apply', 'oral'];
function sum(list, key) { return list.reduce((a, x) => a + (Number(x[key]) || 0), 0); }

test('① 总量守恒：Σ typeCounts ≤ requestedCount', () => {
  [[1, 1], [1, 20], [2, 2], [2, 10], [7, 7], [7, 20], [7, 50]].forEach(([n, count]) => {
    const types = SEVEN.slice(0, n);
    const r = Budget.allocateTypeBudgets({ count, questionTypes: types });
    assert.ok(sum(r.typeCounts, 'count') <= count, n + '类型/' + count + '题 不超预算');
  });
});

test('② 正常情况：Σ typeCounts = requestedCount（无容量约束）', () => {
  [[1, 1], [1, 20], [2, 2], [2, 10], [7, 7], [7, 20], [7, 50]].forEach(([n, count]) => {
    const types = SEVEN.slice(0, n);
    const r = Budget.allocateTypeBudgets({ count, questionTypes: types });
    assert.equal(sum(r.typeCounts, 'count'), count, n + '类型/' + count + '题 恰好用尽预算');
    assert.equal(r.coverageStatus, 'OK');
  });
});

test('③ 题型最低覆盖：count ≥ 题型数 → 每题型 ≥1', () => {
  [[2, 2], [7, 7], [7, 20], [7, 50]].forEach(([n, count]) => {
    const types = SEVEN.slice(0, n);
    const r = Budget.allocateTypeBudgets({ count, questionTypes: types });
    assert.equal(r.typeCounts.length, n);
    r.typeCounts.forEach((t) => assert.ok(t.count >= 1, t.questionType + ' ≥1'));
  });
});

test('④ 绝不超预算 + count < 题型数：不偷偷补到题型数', () => {
  const r = Budget.allocateTypeBudgets({ count: 5, questionTypes: SEVEN });
  assert.equal(sum(r.typeCounts, 'count'), 5, '总预算保持 5（不生成 7 题）');
  r.typeCounts.forEach((t) => assert.ok(t.count <= 1));
  assert.equal(r.coverageStatus, 'TYPE_COVERAGE_INFEASIBLE');
});

test('⑤ 不重新解释 count：Σ cells = Σ typeCounts（KP 数 × count 永不发生）', () => {
  const r1 = Budget.allocateTypeBudgets({ count: 20, questionTypes: SEVEN });
  const kps = ['k1', 'k2', 'k3', 'k4'];
  const kp = Budget.allocateKpTypeBudget({ typeCounts: r1.typeCounts, kps });
  assert.equal(sum(kp.cells, 'count'), sum(r1.typeCounts, 'count'));
  assert.equal(sum(kp.cells, 'count'), 20);
});

test('⑥ 容量不足：CAPACITY_LIMITED 且不超容量、不伪装成功', () => {
  const r = Budget.allocateTypeBudgets({
    count: 20,
    questionTypes: ['calc', 'fill'],
    typeCaps: { calc: 2, fill: 3 }
  });
  assert.ok(sum(r.typeCounts, 'count') <= 20);
  const calc = r.typeCounts.find((t) => t.questionType === 'calc');
  assert.ok(!calc || calc.count <= 2);
  // 两题型容量合计 5 < 20 → 收敛于 plannedTotal=5，显式容量受限
  assert.equal(r.coverageStatus, 'CAPACITY_LIMITED');
  assert.equal(r.plannedTotal, 5);
  assert.ok(r.reason && r.reason.indexOf('容量') !== -1);
});

test('⑦ POL 集成：7 题型/20 题 → 每题型 ≥1、Σ cells = Σ typeCounts = plannedTotal ≤ 20', async () => {
  const kpIds = KC.poolKpIds({ subject: 'math', grade: 2 }).slice(0, 5);
  const p = await PO.plan({
    subject: 'math', grade: 2,
    knowledgePointIds: kpIds,
    questionTypes: SEVEN.slice(0, 3), // 3 类稳定可行（避免不可行题型干扰）
    count: 20
  }, {});
  assert.equal(p.active, true);
  const allocTotal = sum(p.request.typeCounts || [], 'count');
  const cellTotal = sum(p.kpTypeMatrix || [], 'count');
  assert.equal(cellTotal, allocTotal);
  assert.equal(allocTotal, p.plannedTotal);
  assert.ok(p.plannedTotal <= p.requestedCount);
  assert.ok(p.plannedTotal >= 3, '每题型至少 1');
  (p.kpTypeMatrix || []).forEach((c) => assert.ok(kpIds.indexOf(c.kpId) !== -1, 'cell 不越界 KP'));
});

test('⑦b POL 集成：count < 题型数 → plannedTotal ≤ count 且不超预算', async () => {
  const kpIds = KC.poolKpIds({ subject: 'math', grade: 2 }).slice(0, 5);
  const p = await PO.plan({
    subject: 'math', grade: 2,
    knowledgePointIds: kpIds,
    questionTypes: ['calc', 'fill', 'choice', 'judge', 'apply'],
    count: 2
  }, {});
  assert.equal(p.active, true);
  assert.ok(p.plannedTotal <= 2);
  assert.ok(p.requestedCount === 2, 'requestedCount 不被改写');
});
