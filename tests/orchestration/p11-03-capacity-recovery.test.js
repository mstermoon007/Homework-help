'use strict';

/**
 * tests/orchestration/p11-03-capacity-recovery.test.js — Capacity / Recovery / Partial Contract（P11-03）
 *
 * 冻结：
 *   - Capacity ≠ requestedCount ≠ plannedCount ≠ retry 次数；Capacity 只回答「还有多少可生成空间」
 *   - RetryLoop = 单 Cell 内部尝试（POL 不重试同一 cell）；POL Recovery = Cell/Range 重新安排
 *   - Recovery ≤ 3 轮；每轮 progress = 新增唯一题 > 0，否则立即停止
 *   - 状态：SUCCESS（final = requested）/ PARTIAL（0 < final < requested）/ FAILED（final = 0）
 *   - 不突破 selectedKPs × selectedTypes；不突破 plannedCount / requestedCount；不偷换 KP/Type/Difficulty
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
require(path.join(ROOT, 'shared', 'presentation', 'html-renderer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
const API = require(path.join(ROOT, 'shared', 'generation', 'api.js'));
const PO = require(path.join(ROOT, 'shared', 'orchestration', 'practice-orchestrator.js'));
const Budget = require(path.join(ROOT, 'shared', 'orchestration', 'budget-allocation.js'));

const KP_LARGE = 'math-g2-down-u02-k001';
const KP_TINY = 'math-g1-down-u08-k001';
// P13-04 容量表 canonical 化后：KP_A/KP_B 选用 calc 容量充足的真实 KP（原 u01-k001 calc 容量为 0）
const KP_A = 'math-g2-down-u02-k002'; // calc 容量 42
const KP_B = 'math-g2-down-u02-k003'; // calc 容量 81

function fps(questions) {
  return (questions || []).map((q) => q.questionFingerprint).filter(Boolean);
}
function uniq(arr) { return Array.from(new Set(arr)); }
function mkQ(fp, req) {
  return { questionFingerprint: fp, knowledgePointIds: req.knowledgePointIds, questionType: req.questionTypes[0], difficulty: 5 };
}
function stubExecute(makeQuestions) {
  let round = 0;
  const calls = [];
  const fn = function (req) {
    round += 1;
    calls.push(req);
    return Promise.resolve({ questions: makeQuestions(round, req, calls), plans: [], trace: {}, failedPlans: [], seenKeys: null });
  };
  fn.calls = calls;
  fn.rounds = () => round;
  return fn;
}
function statusOf(res, requested) {
  const final = res.orchestration.finalCount;
  if (final === 0) return 'FAILED';
  return final >= requested ? 'SUCCESS' : 'PARTIAL';
}

test('R1 正常容量：20/20 SUCCESS，四数全等', async () => {
  const r = await API.generate({ subject: 'math', grade: 2, knowledgePointIds: [KP_LARGE], questionTypes: ['calc'], count: 20, difficulty: 5 }, {});
  const o = r.orchestration;
  assert.equal(r.status, 'SUCCESS');
  assert.equal(o.requestedCount, 20);
  assert.equal(o.plannedCount, 20);
  assert.equal(o.generatedCount, 20);
  assert.equal(o.finalCount, 20);
  assert.equal(o.generatedCount, o.finalCount);
});

test('R2 单 Cell 容量不足：规划封顶（unit）+ 实际短产 → 8/20 PARTIAL', async () => {
  // 规划层：typeCaps 封顶 → plannedTotal = 8
  const alloc = Budget.allocateTypeBudgets({ count: 20, questionTypes: ['calc'], typeCaps: { calc: 8 } });
  assert.equal(alloc.plannedTotal, 8);
  assert.equal(alloc.coverageStatus, 'CAPACITY_LIMITED');
  // 执行层：Cell 实际只产出 8（生成空间不足）
  const stub = stubExecute((round, req) => (round === 1 ? Array.from({ length: 8 }, (_, i) => mkQ('cap-' + i, req)) : []));
  const res = await PO.orchestrate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP_LARGE], questionTypes: ['calc'], count: 20, difficulty: 5 },
    {}, { execute: stub }
  );
  assert.equal(res.status, 'PARTIAL');
  assert.equal(res.orchestration.requestedCount, 20);
  assert.equal(res.orchestration.finalCount, 8);
  assert.ok(res.orchestration.budgetRecovered <= res.orchestration.requestedCount, 'recovery 不增用户总量');
});

test('R3 Retry 边界：POL 不在同一轮重试同一 cell（RetryLoop 属 executor）', async () => {
  const req = { subject: 'math', grade: 2, knowledgePointIds: [KP_A, KP_B], questionTypes: ['calc'], count: 10, difficulty: 5 };
  const p = await PO.plan(req, {});
  const stub = stubExecute((round, r) => Array.from({ length: r.count }, (_, i) => mkQ('r' + round + '-' + r.knowledgePointIds[0] + '-' + i, r)));
  const res = await PO.orchestrate(req, {}, { execute: stub });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(stub.calls.length, p.kpTypeMatrix.length, '初始轮每 cell 恰执行一次（无 POL 层重试）');
  const keys = stub.calls.map((c) => c.knowledgePointIds[0] + ':' + c.questionTypes[0]);
  assert.equal(uniq(keys).length, keys.length, '同一轮内不重复执行同一 cell');
});

test('R4 Recovery 有效：Round1=8 → Round2=+5 → final 13（PARTIAL）', async () => {
  const stub = stubExecute((round, req) => {
    if (round === 1) return Array.from({ length: 8 }, (_, i) => mkQ('a-' + i, req));
    if (round === 2) return Array.from({ length: 5 }, (_, i) => mkQ('b-' + i, req));
    return [];
  });
  const res = await PO.orchestrate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP_LARGE], questionTypes: ['calc'], count: 20, difficulty: 5 },
    {}, { execute: stub }
  );
  assert.equal(res.orchestration.finalCount, 13);
  assert.equal(res.orchestration.budgetRecovered, 5);
  assert.equal(res.status, 'PARTIAL');
});

test('R5 Recovery 无进展：立即停止（calls = 2，final = 8）', async () => {
  const stub = stubExecute((round, req) => (round === 1 ? Array.from({ length: 8 }, (_, i) => mkQ('a-' + i, req)) : []));
  const res = await PO.orchestrate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP_LARGE], questionTypes: ['calc'], count: 20, difficulty: 5 },
    {}, { execute: stub }
  );
  assert.equal(stub.calls.length, 2, '无进展轮后不再继续');
  assert.equal(res.orchestration.finalCount, 8);
});

test('R6 Recovery ≤ 3：每轮 +1 时 final = 4 且轮次有界', async () => {
  const stub = stubExecute((round, req) => [mkQ('g' + round, req)]);
  const res = await PO.orchestrate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP_LARGE], questionTypes: ['calc'], count: 10, difficulty: 5 },
    {}, { execute: stub }
  );
  assert.ok(stub.rounds() <= 1 + PO.MAX_RECOVERY_ROUNDS, '总轮次 ≤ 1 + 3');
  assert.equal(res.orchestration.finalCount, 1 + PO.MAX_RECOVERY_ROUNDS, '初始 + 3 轮各 1 题');
  assert.equal(res.orchestration.finalCount, uniq(fps(res.questions)).length);
});

test('R7 多 Cell 转移：A 耗尽但 B 有容量 → B 承接缺口（Recovery ≤3 轮内尽可能逼近预算）', async () => {
  const stub = stubExecute((round, req) => {
    const kp = req.knowledgePointIds[0];
    if (kp === KP_A) return []; // A 无空间
    return Array.from({ length: req.count }, (_, i) => mkQ('B-' + round + '-' + i, req));
  });
  const res = await PO.orchestrate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP_A, KP_B], questionTypes: ['calc'], count: 10, difficulty: 5 },
    {}, { execute: stub }
  );
  const o = res.orchestration;
  // 冻结语义：Recovery 将缺口均摊到全部可行 KP（含已耗尽者），≤3 轮；B 承接新增产出，最终允许 PARTIAL。
  assert.ok(o.finalCount > 5, 'B 初始产出之外仍有 Recovery 新增（final=' + o.finalCount + '）');
  assert.ok(o.finalCount <= 10, '不突破预算');
  assert.ok(o.budgetRecovered > 0, 'Recovery 有新增产出');
  assert.ok(['SUCCESS', 'PARTIAL'].indexOf(res.status) !== -1);
  assert.ok(stub.calls.length <= 2 + PO.MAX_RECOVERY_ROUNDS * 2, '执行次数有界（2 初始 cell + ≤3 轮 × ≤2 cell）');
  const kpsUsed = uniq(res.questions.map((q) => (q.knowledgePointIds || [])[0]));
  assert.deepEqual(kpsUsed, [KP_B], '缺口全部由 B 承担（不伪造 A 题）');
});

test('R8 全范围耗尽：generated = 0 → FAILED（不偷换 KP/Type，不无限循环）', async () => {
  const stub = stubExecute(() => []);
  const res = await PO.orchestrate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP_TINY], questionTypes: ['calc'], count: 5, difficulty: 5 },
    {}, { execute: stub }
  );
  assert.equal(res.status, 'FAILED');
  assert.equal(res.orchestration.finalCount, 0);
  assert.ok(stub.rounds() <= 1 + PO.MAX_RECOVERY_ROUNDS);
  stub.calls.forEach((c) => {
    assert.deepEqual(c.knowledgePointIds, [KP_TINY], '不偷换 KP');
    assert.deepEqual(c.questionTypes, ['calc'], '不偷换 Type');
  });
  // 真实链（stub 驱动，替代旧 capacity=1 遗留）
  const res2 = await PO.orchestrate(
    { subject: 'math', grade: 1, knowledgePointIds: [KP_TINY], questionTypes: ['calc'], count: 5, difficulty: 5 },
    {}, { execute: stubExecute(() => []) }
  );
  assert.equal(fps(res2.questions).length, 0);
  assert.equal(res2.status, 'FAILED');
});

test('R9 部分可交付：0 < final < requested → PARTIAL（数量不变量保持）', async () => {
  // stub 驱动：请求 5，实际只产出 2 → PARTIAL
  const stub = stubExecute((round, req) => (round === 1 ? Array.from({ length: 2 }, (_, i) => mkQ('partial-' + i, req)) : []));
  const res = await PO.orchestrate(
    { subject: 'math', grade: 1, knowledgePointIds: [KP_TINY], questionTypes: ['choice'], count: 5, difficulty: 5 },
    {}, { execute: stub }
  );
  const o = res.orchestration;
  assert.equal(res.status, 'PARTIAL');
  assert.ok(o.finalCount > 0 && o.finalCount < o.requestedCount);
  assert.ok(o.requestedCount >= o.plannedCount, 'requested ≥ planned');
  assert.ok(o.plannedCount >= o.generatedCount, 'planned ≥ generated');
  assert.equal(o.generatedCount, o.finalCount, 'generated = final');
});

test('R10 真实 API E2E：状态与数量一致，题目归属选区', async () => {
  const types = ['calc', 'fill'];
  const r = await API.generate({ subject: 'math', grade: 2, knowledgePointIds: [KP_LARGE, KP_A], questionTypes: types, count: 20, difficulty: 5 }, {});
  const o = r.orchestration;
  assert.equal(r.status, statusOf(r, 20), '状态与 final/requested 一致');
  assert.ok(o.requestedCount >= o.plannedCount);
  assert.ok(o.plannedCount >= o.generatedCount);
  assert.equal(o.generatedCount, o.finalCount);
  assert.equal(o.finalCount, r.producedCount);
  assert.equal(o.finalCount, uniq(fps(r.questions)).length, 'final = unique');
  (r.questions || []).forEach((q) => {
    assert.ok([KP_LARGE, KP_A].indexOf(q.knowledgePointIds[0]) !== -1, 'KP ∈ selectedKPs');
    assert.ok(types.indexOf(q.questionType) !== -1, 'Type ∈ selectedTypes');
  });
});
