'use strict';

/**
 * tests/orchestration/p17-15-quantity-closure.test.js — 数量闭环验证（P17-15）
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
const GenerationCore = require(path.join(ROOT, 'shared', 'generation', 'generation-core.js'));
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

test('Q2 真实 capacity=1：时间类 KP count=3 → PARTIAL，final ≤ 1，不伪装 SUCCESS', async () => {
  const KP = 'math-g2-down-u01-k001'; // 钟面结构，真实容量=1（P17-1 审计证据）
  const res = await realGen(KP, 'calc', 3, 5);
  assert.notEqual(res.status, 'SUCCESS', '容量=1 不得 SUCCESS');
  assert.ok(res.questions.length <= 1, 'actual final ≤ 1（短产如实上报）');
  if (res.questions.length) {
    res.questions.forEach((q) => assert.equal(q.questionType, 'calc', '产出的仍是请求类型'));
  }
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