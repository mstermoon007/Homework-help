'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

// 依赖装配顺序与浏览器一致：先 KB（Node 自动并入三科分片）→ StrategyEngine → PresentationEngine → 综合策略。
const KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
assert.ok(Array.isArray(KnowledgeBank.math) && KnowledgeBank.math.length > 0, '数学知识分片应已装配');
const StrategyEngine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
require(path.join(ROOT, 'shared', 'presentation-engine.js'));
require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'render-options.js'));
const CS = require(path.join(ROOT, 'shared', 'strategy', 'comprehensive-strategy.js'));

function buildReq(overrides) {
  return Object.assign({ model: 'comprehensive', subject: 'math', grade: 1, count: 10 }, overrides);
}

test('M7-R09 allocateByWeight：总量守恒 + 最大余数', () => {
  const shares = CS.allocateByWeight([1, 1, 1], 5);
  assert.strictEqual(shares.reduce((a, b) => a + b, 0), 5);
  assert.deepStrictEqual(shares.sort().reverse(), [2, 2, 1]);
  assert.deepStrictEqual(CS.allocateByWeight([0, 0, 0], 4), [0, 0, 0]);
});

test('M7-R09 scoreEntries：weighted=base / balanced=等权', () => {
  const entries = [{ id: 'A', weight: 3 }, { id: 'B', weight: 1 }, { id: 'C' }];
  const w = CS.scoreEntries(entries, 'weighted', null).map(s => s.policyScore);
  assert.deepStrictEqual(w, [3, 1, 1]);
  const b = CS.scoreEntries(entries, 'balanced', null).map(s => s.policyScore);
  assert.deepStrictEqual(b, [1, 1, 1]);
});

test('M7-R09 weak-first：薄弱知识点加权；未学过的条目翻倍', () => {
  const entries = [{ id: 'K1', weight: 1 }, { id: 'K2', weight: 1 }, { id: 'K3', weight: 1 }];
  const profile = { knowledgePoints: { K1: { mastery: 0.9 }, K2: { mastery: 0.4 } } }; // K3 未见过
  const scores = CS.scoreEntries(entries, 'weak-first', profile).map(s => s.policyScore);
  assert.ok(scores[1] > scores[0], '薄弱 K2 应高于熟练 K1');
  assert.ok(scores[2] > scores[0], '未见过 K3 应高于熟练 K1');
  assert.strictEqual(scores[2], 2);
});

test('M7-R09 recent-first：近期练习少的知识点加权', () => {
  const entries = [{ id: 'K1', weight: 1 }, { id: 'K2', weight: 1 }];
  const profile = { knowledgePoints: { K1: { exposure: 20 }, K2: { exposure: 1 } } };
  const [a, b] = CS.scoreEntries(entries, 'recent-first', profile).map(s => s.policyScore);
  assert.ok(b > a, 'K2 近练少应高于 K1');
});

test('M7-R10 build：一年级综合练习产出计划复数且题量守恒', async () => {
  const res = await CS.build(buildReq());
  assert.ok(res.plans.length >= 2);
  const total = res.plans.reduce((s, p) => s + (p.count || 0), 0);
  assert.strictEqual(total, 10);
  assert.strictEqual(res.allocation.reduce((s, a) => s + a.count, 0), 10);
  assert.strictEqual(res.trace.policy, 'weighted');
  assert.ok(res.trace.coverage.ratio > 0);
  res.plans.forEach(p => assert.ok(p.__comprehensive && p.__comprehensive.kpId));
});

test('M7-R12 跨知识点混合：相邻计划尽量异 plugin', async () => {
  const res = await CS.build(buildReq());
  const mixed = res.plans;
  let hetero = 0;
  for (let i = 1; i < mixed.length; i++) {
    if (mixed[i].__comprehensive.pluginId !== mixed[i - 1].__comprehensive.pluginId) hetero++;
  }
  // 同 plugin 的连续对不应超过一半（一年级多 plugin 满足异组条件）
  assert.ok(hetero >= Math.ceil(mixed.length / 2) - 1, '相邻异 plugin 对数不足: ' + hetero + '/' + mixed.length);
});

test('M7-R13 覆盖统计含 failedPlans 与 entries 明细', async () => {
  const res = await CS.build(buildReq());
  assert.ok(Array.isArray(res.trace.entries));
  assert.ok(Array.isArray(res.trace.failedPlans));
  assert.ok(res.trace.coverage.plugins >= 1 && res.trace.coverage.plugins <= res.trace.coverage.total);
  assert.ok(res.trace.coverage.coveredEntries <= res.trace.coverage.entries);
  assert.ok(res.trace.coverage.ratio <= 1);
});

test('M7-R10 balanced 策略：等权分配（题量分散合理）', async () => {
  const res = await CS.build(buildReq({ coveragePolicy: 'balanced' }));
  const counts = res.allocation.filter(a => a.count > 0).map(a => a.count);
  const max = Math.max.apply(null, counts);
  const min = Math.min.apply(null, counts);
  assert.ok(max - min <= 1, 'balanced 下各知识点题量应几乎相等');
});

test('M7-R10 count 非法参数拒绝', async () => {
  await assert.rejects(() => CS.build(buildReq({ count: 0 })), /count/);
  await assert.rejects(() => CS.build(buildReq({ count: 3.5 })), /count/);
  await assert.rejects(() => CS.build({ grade: 1 }), /subject|comprehensive/);
});

test('M7-R08/14 GenerationEngine 综合主链：计划→SemanticQuestion→RenderResult', async () => {
  const GE = require(path.join(ROOT, 'shared', 'generation-engine.js'));
  const g = await GE.generate({ model: 'comprehensive', subject: 'math', grade: 1, count: 6, difficulty: 2 });
  assert.ok(Array.isArray(g.questions) && g.questions.length > 0, '应产出 SemanticQuestion[]');
  assert.ok(g.questions.every(q => q && q.prompt), '每题应有 prompt');
  assert.strictEqual(g.items.length, g.questions.length, 'RenderResult 与题目一一对应');
  assert.ok(g.html && g.html.indexOf('question-card') !== -1);
  assert.ok(g.items.every(it => it && it.html && typeof it.graphic === 'string'));
  assert.ok(Array.isArray(g.failedPlans));
  assert.strictEqual(g.renderOptions.mode, 'screen');
});

test('M7-R08 单点生成（knowledgePointId）不走综合策略', async () => {
  const GE = require(path.join(ROOT, 'shared', 'generation-engine.js'));
  const kpId = KnowledgeBank.getEntries('math', 1)[0].id;
  const built = await GE.build({ knowledgePointId: kpId, count: 3, grade: 1 });
  assert.strictEqual(built.plans.length, 1);
  assert.strictEqual(built.plans[0].knowledgePointId, kpId);
});

test('M7-R09 interleaveByPlugin：两组交替', () => {
  const plans = [
    { count: 2, __comprehensive: { kpId: 'A', pluginId: 'p1', weight: 1 } },
    { count: 2, __comprehensive: { kpId: 'B', pluginId: 'p1', weight: 1 } },
    { count: 2, __comprehensive: { kpId: 'C', pluginId: 'p2', weight: 1 } },
    { count: 2, __comprehensive: { kpId: 'D', pluginId: 'p2', weight: 1 } },
    { count: 2, __comprehensive: { kpId: 'E', pluginId: 'p1', weight: 1 } }
  ];
  const out = CS.interleaveByPlugin(plans);
  assert.strictEqual(out.length, 5);
  let runs = 1;
  for (let i = 1; i < out.length; i++) {
    if (out[i].__comprehensive.pluginId === out[i - 1].__comprehensive.pluginId) runs++;
  }
  assert.ok(runs <= 2, '混排后同 plugin 最长连续应受控，实测连续 ' + runs);
});