'use strict';

/**
 * tests/orchestration/p10-2-scope-contract.test.js — 题型 × 知识点范围契约（P10-2）
 *
 * 冻结语义：
 *   - selectedTypes = 允许使用的题型集合；selectedKPs = 生成范围
 *   - Type × KP cell 是 POL 内部编排单元（用户不直接控制）
 *   - 最终题目 ∈ selectedTypes ∧ ∈ selectedKPs；Σ allocation ≤ requestedCount
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const PO = require(path.join(ROOT, 'shared', 'orchestration', 'practice-orchestrator.js'));
const KC = Env.KnowledgeContext;

function pool(grade) { return KC.poolKpIds({ subject: 'math', grade }); }
function sum(list, key) { return list.reduce((a, x) => a + (Number(x[key]) || 0), 0); }

async function planFor(types, kpIds, count) {
  return PO.plan({ subject: 'math', grade: 2, knowledgePointIds: kpIds, questionTypes: types, count }, {});
}

test('范围契约：1 Type × 1 KP / 多 Type × 1 KP / 1 Type × 多 KP / 多 Type × 多 KP', async () => {
  const all = pool(2);
  const cases = [
    { types: ['calc'], kps: all.slice(0, 1) },
    { types: ['calc', 'fill'], kps: all.slice(0, 1) },
    { types: ['calc'], kps: all.slice(0, 3) },
    { types: ['calc', 'fill'], kps: all.slice(0, 3) }
  ];
  for (const c of cases) {
    const p = await planFor(c.types, c.kps, 8);
    assert.equal(p.active, true, JSON.stringify(c));
    // 题型 ∈ selectedTypes
    (p.request.typeCounts || []).forEach((t) => assert.ok(c.types.indexOf(t.questionType) !== -1, 'type 越界: ' + t.questionType));
    // KP ∈ selectedKPs（cell 不越界）
    (p.kpTypeMatrix || []).forEach((cell) => assert.ok(c.kps.indexOf(cell.kpId) !== -1, 'kp 越界: ' + cell.kpId));
    // 守恒
    assert.equal(sum(p.kpTypeMatrix || [], 'count'), sum(p.request.typeCounts || [], 'count'));
    assert.ok(p.plannedTotal <= 8);
  }
});

test('范围契约：最终题目 ∈ selectedTypes ∧ ∈ selectedKPs（真实生成 E2E）', async () => {
  const all = pool(2);
  const types = ['calc'];
  const kps = all.slice(0, 2);
  const p = await planFor(types, kps, 4);
  const cell = (p.kpTypeMatrix || [])[0];
  assert.ok(cell, '存在可执行 cell');
  const plan = global.StrategyEngine.plan({
    subject: 'math', grade: 2,
    knowledgePointIds: [cell.kpId],
    questionTypes: [cell.questionType],
    count: cell.count,
    difficulty: 3,
    mode: 'single-kp'
  }).plans[0];
  const res = await global.PresentationEngine.generateQuestions(plan, { skipValidation: true });
  const sqs = res.semanticQuestions || res.questions || [];
  assert.ok(sqs.length > 0, '生成非空');
  sqs.forEach((q) => {
    assert.equal(q.questionType, cell.questionType, '题目题型 ∈ selectedTypes');
    const qKps = q.knowledgePointIds || [q.knowledgePointId];
    assert.ok(qKps.some((id) => kps.indexOf(id) !== -1), '题目 KP ∈ selectedKPs: ' + JSON.stringify(qKps));
  });
});

test('空选语义：未选题型 → POL 不激活（no-types）；未选 KP + 年级 → 池展开', async () => {
  const kps = pool(2).slice(0, 2);
  const noTypes = await PO.plan({ subject: 'math', grade: 2, knowledgePointIds: kps, count: 6 }, {});
  assert.equal(noTypes.active, false);
  assert.equal(noTypes.reason, 'no-types');

  const noKps = await PO.plan({ subject: 'math', grade: 2, questionTypes: ['calc'], count: 6 }, {});
  assert.equal(noKps.active, true);
  assert.ok(noKps.kpIds.length > 2, '池展开覆盖年级候选');
});

test('全选/部分选：题型白名单之外不产出（feasibleTypes ⊆ selectedTypes）', async () => {
  const kps = pool(2).slice(0, 4);
  const p = await planFor(['calc', 'fill', 'choice'], kps, 9);
  (p.feasibleTypes || []).forEach((t) => assert.ok(['calc', 'fill', 'choice'].indexOf(t) !== -1));
  (p.request.typeCounts || []).forEach((t) => assert.ok(['calc', 'fill', 'choice'].indexOf(t.questionType) !== -1));
});

test('非法组合不崩溃：不可行题型 → 显式跳过或 PARTIAL 语义（不伪造）', async () => {
  const kps = pool(2).slice(0, 2);
  const p = await PO.plan({ subject: 'math', grade: 2, knowledgePointIds: kps, questionTypes: ['geometry'], count: 5 }, {});
  assert.equal(p.active, true);
  // 可行题型为空时 POL 兜底不吞请求（保留请求题型）；但分配守恒仍成立
  assert.equal(sum(p.kpTypeMatrix || [], 'count'), sum(p.request.typeCounts || [], 'count'));
  assert.ok(p.plannedTotal <= 5);
});
