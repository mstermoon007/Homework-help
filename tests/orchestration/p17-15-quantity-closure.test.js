'use strict';

/**
 * tests/orchestration/p17-15-quantity-closure.test.js — 数量闭环验证（P17-15）
 *
 * 注意：GenerationCore 为测试/历史资产（P28-28 定性）。生产链 = api.js
 * orchestrate → build → runPlans → generateQuestions，不经过 GenerationCore；
 * 本测试直接装载 tests/fixtures/generation-core.js 验证其 execute 语义。
 *
 * 冻结不变量（真实生成链，非 stub）：
 *   contract ≥ planned ≥ generated = final；Σ cell.plannedCount = Plan.planned。
 *   计数档位 1/3/5/7/10 → SUCCESS 且 generated == count（高容量载体、真实题）。
 *   真实 capacity 约束如实上报：容量=1（时间类 KP）与 geometry 小语义空间 → PARTIAL，不伪装成功。
 *   短产 ≠ 零：0 < final ≤ planned → PARTIAL；final = 0 → FAILED（不偷换 KP/Type）。
 */
'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const GenerationCore = require(path.join(ROOT, 'tests', 'fixtures', 'generation-core.js'));
const retryLoop = require(path.join(ROOT, 'shared', 'generator', 'retry-loop.js'));
const semanticQuestion = require(path.join(ROOT, 'shared', 'semantic', 'semantic-question.js'));

before(() => {
  GenerationCore.inject({ selector: Env.GeneratorSelector, retryLoop, semanticQuestion });
});

async function realGen(kp, type, count, difficulty) {
  return GenerationCore.execute(
    { cells: [{ kpId: kp, questionType: type, difficulty: difficulty == null ? 5 : difficulty, count }] },
    { skipValidation: false }
  );
}

test('Q1 计数档位 1/3/5/7/10：SUCCESS，generated=final=count，Σcell=count', async () => {
  const KP = 'math-g4-down-u03-k003'; // 高容量 calc 载体（cap 128，映射 address 真实可生成）
  for (const n of [1, 3, 5, 7, 10]) {
    const res = await realGen(KP, 'calc', n, 5);
    assert.equal(res.status, 'SUCCESS', 'count=' + n + ' status=' + res.status);
    assert.equal(res.questions.length, n, 'count=' + n + ' 题量');
    assert.equal(res.generatedCount, n, 'count=' + n + ' generatedCount=final');
    assert.equal(res.shortfall, 0, 'count=' + n + ' 无短产');
    assert.equal(res.plannedCount, n, 'count=' + n + ' planned=count');
    res.questions.forEach((q) => assert.equal(q.questionType, 'calc', '全部为 calc 题'));
  }
});

test('Q2 时间类 KP calc：P25-07 修复 stats calc 伪容量后 → SUCCESS，3 题真实互异', async () => {
  // 前提变更留痕（P25-07）：本 KP×calc 在 P17-1 审计时「真实容量=1」，其根因是旧 stats
  // calc 产出与条目种子无关的同一道题、被去重削减为 1。P25-07 将 stats calc 收敛为
  // 「最多−最少」差值列式（题干内嵌算式，满足 calc 契约）后按条目种子出题，
  // 真实容量提升至 ≥3，SUCCESS 为如实上报而非伪装。短产如实上报不变量由 Q3 覆盖。
  const KP = 'math-g2-down-u01-k001';
  const res = await realGen(KP, 'calc', 3, 5);
  assert.equal(res.status, 'SUCCESS', '修复后真实容量 ≥3 → SUCCESS');
  assert.equal(res.questions.length, 3, 'final = count');
  res.questions.forEach((q) => assert.equal(q.questionType, 'calc', '产出的仍是请求类型'));
  const prompts = res.questions.map((q) => q.prompt);
  assert.equal(new Set(prompts).size, 3, '3 题真实互异（非重复填充）');
});

test('Q3 geometry 小语义空间：count=2 → PARTIAL n≥1（真实短产，非 0）', async () => {
  const res = await realGen('math-g5-down-u05-k003', 'geometry', 2, 5);
  assert.equal(res.status, 'PARTIAL', 'geometry 语义空间小 → PARTIAL 如实上报');
  assert.ok(res.questions.length >= 1 && res.questions.length < 2, '0 < final < planned');
  res.questions.forEach((q) => assert.equal(q.questionType, 'geometry'));
});

test('Q4 空请求不伪造：cells=0 → generated=0，无题目无失败', async () => {
  const res = await GenerationCore.execute({ cells: [] }, { skipValidation: false });
  assert.equal(res.questions.length, 0);
  assert.equal(res.generatedCount, 0);
  assert.ok(Array.isArray(res.failures) && res.failures.length === 0);
});