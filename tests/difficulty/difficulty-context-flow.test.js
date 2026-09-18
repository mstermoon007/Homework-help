'use strict';

/**
 * tests/difficulty/difficulty-context-flow.test.js — DifficultyContext 贯通（M16）
 *
 * 浏览器等价环境（dev/_bundle-env：runtime + KC + compat + strategy bundle）：
 *   request.difficulty → POL.plan → difficultyContext（来自 resolveContext）
 *   → cellReq.difficulty → StrategyEngine.plan（冻结链）→ plan.difficulty
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const PO = require(path.join(ROOT, 'shared', 'orchestration', 'practice-orchestrator.js'));
const KC = Env.KnowledgeContext;

function pickKp() {
  return KC.poolKpIds({ subject: 'math', grade: 6 })[0];
}

test('用户难度：POL Context 经 resolveContext 产出（requested/target/source=user）', async () => {
  const p = await PO.plan({ subject: 'math', grade: 6, knowledgePointIds: [pickKp()], questionTypes: ['calc'], count: 3, difficulty: 7 }, {});
  assert.equal(p.active, true);
  assert.equal(p.difficultyContext.requested, 7);
  assert.equal(p.difficultyContext.target, 7);
  assert.equal(p.difficultyContext.source, 'user');
  assert.equal(p.difficulty, 7);
  assert.equal(p.request.difficulty, 7);
});

test('未给难度：POL 预测容量维度（target 非空；不复制公式）', async () => {
  const p = await PO.plan({ subject: 'math', grade: 6, knowledgePointIds: [pickKp()], questionTypes: ['calc'], count: 3 }, {});
  assert.equal(p.difficultyContext.requested, null);
  assert.equal(p.difficultyContext.source, 'auto');
  assert.ok(Number.isInteger(p.difficulty) && p.difficulty >= 1 && p.difficulty <= 10);
});

test('Strategy 链消费 POL 传递的 difficulty（plan.difficulty 一致）', () => {
  const r = global.StrategyEngine.plan({
    subject: 'math', grade: 6,
    knowledgePointIds: [pickKp()],
    questionTypes: ['calc'],
    count: 3,
    difficulty: 6
  });
  const plan = r.plans[0];
  assert.equal(plan.difficulty, 6);
  assert.ok(plan.constraints && typeof plan.constraints.maxSteps === 'number');
});
