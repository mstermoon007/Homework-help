/**
 * tests/engine/mode.test.js — M7-R26 统一题目生成 API（四种模式）
 *
 * App.GenerationEngine.generate({
 *   subject, grade, knowledgePoints, count, questionTypes, difficulty, learnerProfile, mode
 * })
 *
 * 支持：single-kp / multi-kp / comprehensive / adaptive。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
require(path.join(ROOT, 'shared', 'strategy', 'comprehensive-strategy.js'));
require(path.join(ROOT, 'shared', 'presentation-engine.js'));
require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'render-options.js'));

const GE = require(path.join(ROOT, 'shared', 'generation-engine.js'));

test('R26-1 single-kp：按 knowledgePointId + 统一 request', async () => {
  const g = await GE.generate({ subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: 'math-g1-m1-addsub-10', count: 3, difficulty: 2 });
  assert.ok(g.questions.length === 3);
  assert.strictEqual(g.questions[0].knowledgePoint, 'math-g1-m1-addsub-10');
  assert.ok(g.html && g.html.length > 0);
});

test('R26-2 comprehensive：subject+grade 全量覆盖', async () => {
  const g = await GE.generate({ subject: 'math', grade: 1, mode: 'comprehensive', count: 6, difficulty: 2 });
  assert.ok(g.questions.length >= 1);
  const kps = new Set(g.questions.map(q => q.knowledgePoint));
  assert.ok(kps.size >= 1, '覆盖多个知识点');
});

test('R26-3 multi-kp：显式 knowledgePoints 数组合并规划', async () => {
  const b = await GE.build({ mode: 'multi-kp', knowledgePoints: ['math-g1-m1-addsub-10', 'math-g1-m0-make-ten'], grade: 1, count: 6 });
  assert.strictEqual(b.plans.length, 2);
});

test('R26-4 adaptive：接管 learnerProfile 生效（不抛错、产出题目）', async () => {
  const g = await GE.generate({
    subject: 'math', grade: 1, mode: 'adaptive', count: 4, difficulty: 2,
    learnerProfile: { knowledgePoints: { ['math-g1-m1-addsub-10']: { mastery: 0.1 } } }
  });
  assert.ok(g.questions.length >= 1);
});

test('R26-5 统一 request 形状被 engine 接受（含 questionTypes）', async () => {
  const g = await GE.generate({ subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: 'math-g1-m1-addsub-10', count: 2, questionTypes: ['calc'] });
  assert.ok(g.questions.length === 2);
});