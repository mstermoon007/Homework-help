'use strict';

/**
 * tests/orchestration/p17-16-difficulty-closure.test.js — 难度闭环验证（P17-16）
 *
 * 冻结不变量（真实生成链）：难度档位 1/3/5/7/10 逐档贯通
 *   Request → GenerationCore Cell(difficulty) → StrategyPlan.difficulty=请求值 → Generator 透传（不重算）
 *   → SemanticQuestion.difficulty == 请求值；generator 内部 difficultyParams（level 等）按单一来源策略
 *   不向产物外层泄出（还原即为 {}），难度只由请求权威决定。
 *   多 Cell 异构难度同帧无互相污染；同 Seed 确定性可复现。
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

const KP = 'math-g4-down-u03-k003'; // 高容量 calc 载体
const LEVELS = [1, 3, 5, 7, 10];

async function realGen(plan, options) {
  return GenerationCore.execute(plan, Object.assign({ skipValidation: false }, options || {}));
}

test('D1 难度 1/3/5/7/10 逐档单题：产题 difficulty 保留请求值（Generator 不重算）', async () => {
  for (const lev of LEVELS) {
    const res = await realGen({ cells: [{ kpId: KP, questionType: 'calc', difficulty: lev, count: 1 }] });
    assert.equal(res.status, 'SUCCESS', 'difficulty=' + lev + ' status=' + res.status);
    assert.equal(res.questions.length, 1);
    assert.equal(Number(res.questions[0].difficulty), lev, 'difficulty=' + lev + ' 不重算');
  }
});

test('D2 同档 count=5：5 题 difficulty 全同（同帧无档位渐变漂移）', async () => {
  const res = await realGen({ cells: [{ kpId: KP, questionType: 'calc', difficulty: 5, count: 5 }] });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.questions.length, 5);
  res.questions.forEach((q) => assert.equal(Number(q.difficulty), 5, '同档 5 题 difficulty 一致'));
});

test('D3 异构难度同帧（1/3/5/7/10 五 Cell）：各 Cell 产题难度与自身请求一致，互不污染', async () => {
  const res = await realGen({
    cells: LEVELS.map((lev, i) => ({ kpId: KP, questionType: 'calc', difficulty: lev, count: 1, order: i }))
  });
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.questions.length, LEVELS.length);
  res.questions.forEach((q) => {
    assert.ok(LEVELS.indexOf(Number(q.difficulty)) !== -1, '产题难度 ∈ {1,3,5,7,10}');
  });
  const counts = {};
  res.questions.forEach((q) => { counts[q.difficulty] = (counts[q.difficulty] || 0) + 1; });
  LEVELS.forEach((lev) => assert.equal(counts[String(lev)], 1, '难度档 ' + lev + ' 恰好 1 题'));
});

test('D4 同 Seed 确定性：同 Cell 重放得同题（难度路径确定，不随机改写难度）', async () => {
  const plan = { cells: [{ kpId: KP, questionType: 'calc', difficulty: 7, count: 1 }] };
  const a = await realGen(plan, { seed: 4242 });
  const b = await realGen(plan, { seed: 4242 });
  assert.equal(a.questions.length, 1);
  assert.equal(b.questions.length, 1);
  assert.equal(a.questions[0].questionFingerprint, b.questions[0].questionFingerprint, '同 Seed 指纹一致');
});