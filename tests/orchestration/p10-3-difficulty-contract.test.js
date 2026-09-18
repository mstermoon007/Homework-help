'use strict';

/**
 * tests/orchestration/p10-3-difficulty-contract.test.js — 难度产品语义契约（P10-3）
 *
 * 冻结语义：
 *   difficulty = 用户目标难度（UI 唯一产生）→ Request → POL 只统筹/传递 → Generation Plan → Strategy
 *   Difficulty Authority 定义/计算；POL 不重算、不覆盖；Generator 不重新解释用户目标难度。
 *   默认值仅在 difficulty == null 时生效；用户显式值（1/3/5/7/10）全链不丢失。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const PO = require(path.join(ROOT, 'shared', 'orchestration', 'practice-orchestrator.js'));
const KC = Env.KnowledgeContext;

const GRADE = 2;
const KPS = KC.poolKpIds({ subject: 'math', grade: GRADE }).slice(0, 4);
const TYPES = ['calc', 'fill'];

async function plan(difficulty, opts) {
  return PO.plan(Object.assign({
    subject: 'math', grade: GRADE,
    knowledgePointIds: KPS.slice(0, 2),
    questionTypes: TYPES,
    count: 12,
    difficulty
  }, opts || {}), {});
}

test('A/B 基础贯通：用户难度 1/3/5/7/10 全链不丢失（Request → POL → Generation Plan）', async () => {
  for (const d of [1, 3, 5, 7, 10]) {
    const p = await plan(d);
    assert.equal(p.request.difficulty, d, 'Request.difficulty=' + d);
    assert.equal(p.difficultyContext.requested, d, 'ctx.requested=' + d);
    assert.equal(p.difficultyContext.target, d, 'ctx.target=' + d);
    assert.equal(p.difficultyContext.source, 'user');
    const gplan = global.StrategyEngine.plan({
      subject: 'math', grade: GRADE, knowledgePointIds: [KPS[0]],
      questionTypes: ['calc'], count: 3, difficulty: d
    }).plans[0];
    assert.equal(gplan.difficulty, d, 'Generation Plan.difficulty=' + d);
    assert.equal(gplan.constraints.difficulty, d, 'constraints.difficulty=' + d);
  }
});

test('C 多维组合：Type × KP × count × difficulty 下用户值保持', async () => {
  const cases = [
    { types: ['calc'], kps: KPS.slice(0, 1), count: 10, d: 7 },
    { types: ['calc', 'fill', 'choice'], kps: KPS.slice(0, 1), count: 20, d: 5 },
    { types: ['calc'], kps: KPS.slice(0, 4), count: 30, d: 10 },
    { types: ['calc', 'fill'], kps: KPS.slice(0, 3), count: 50, d: 1 }
  ];
  for (const c of cases) {
    const p = await PO.plan({
      subject: 'math', grade: GRADE, knowledgePointIds: c.kps,
      questionTypes: c.types, count: c.count, difficulty: c.d
    }, {});
    assert.equal(p.active, true);
    assert.equal(p.request.difficulty, c.d, JSON.stringify(c));
    assert.equal(p.difficultyContext.requested, c.d);
    assert.ok(p.plannedTotal <= c.count);
  }
  // 容量/覆盖不足（planned < requested）时用户难度仍保持
  const partial = await PO.plan({
    subject: 'math', grade: GRADE, knowledgePointIds: [KPS[0]],
    questionTypes: ['calc', 'fill'], typeCounts: [{ questionType: 'calc', count: 2 }],
    count: 10, difficulty: 8
  }, {});
  assert.ok(partial.plannedTotal < 10, 'planned 缩水场景成立');
  assert.equal(partial.request.difficulty, 8);
  assert.equal(partial.difficultyContext.requested, 8);
  assert.equal(partial.difficultyContext.target, 8);
});

test('D/E 默认仅在 null 生效：用户值 ≠ 默认值（1 vs 默认 3/6）不被覆盖', async () => {
  const explicit = await plan(1);
  assert.equal(explicit.request.difficulty, 1, '用户 1 不被默认 3 覆盖');
  assert.equal(explicit.difficultyContext.source, 'user');

  const nul = await plan(null);
  assert.equal(nul.request.difficulty, null, 'null 保持 null（生成由 Strategy 静态决定）');
  assert.equal(nul.difficultyContext.requested, null);
  assert.equal(nul.difficultyContext.source, 'auto');

  const undef = await plan(undefined);
  assert.equal(undef.request.difficulty, undefined);
  assert.equal(undef.difficultyContext.requested, null);
  assert.equal(undef.difficultyContext.source, 'auto');
});

test('难度上下文随 cell 传递（P10-3 修复：adaptive/learnerProfile/customParams 不再丢失）', async () => {
  const profile = { mastery: 0.4, confidence: 0.5 };
  const p = await PO.plan({
    subject: 'math', grade: GRADE, knowledgePointIds: KPS.slice(0, 1),
    questionTypes: ['calc'], count: 6, difficulty: 4,
    adaptive: true, adaptiveMode: 'new', adaptiveDelta: 0.5,
    learnerProfile: profile, allowDifficultyOverride: true,
    customParams: { foo: 1 }, settings: { bar: 2 }
  }, {});
  assert.equal(p.active, true);
  // genReq 保留父请求语义字段（供 cell 执行）
  assert.equal(p.request.adaptive, true);
  assert.equal(p.request.adaptiveMode, 'new');
  assert.equal(p.request.adaptiveDelta, 0.5);
  assert.deepEqual(p.request.learnerProfile, profile);
  assert.equal(p.request.allowDifficultyOverride, true);
  assert.deepEqual(p.request.customParams, { foo: 1 });
  assert.deepEqual(p.request.settings, { bar: 2 });
});

test('浏览器等价真实链路：difficulty 1/5/10 生成 SemanticQuestion 且归属正确', async () => {
  for (const d of [1, 5, 10]) {
    const p = await PO.plan({
      subject: 'math', grade: GRADE, knowledgePointIds: KPS.slice(0, 1),
      questionTypes: ['calc'], count: 3, difficulty: d
    }, {});
    const cell = (p.kpTypeMatrix || [])[0];
    const gplan = global.StrategyEngine.plan({
      subject: 'math', grade: GRADE, knowledgePointIds: [cell.kpId],
      questionTypes: [cell.questionType], count: cell.count, difficulty: d, mode: 'single-kp'
    }).plans[0];
    assert.equal(gplan.difficulty, d, 'plan.difficulty=' + d);
    const res = await global.PresentationEngine.generateQuestions(gplan, { skipValidation: true });
    const sqs = res.semanticQuestions || res.questions || [];
    assert.ok(sqs.length > 0, 'd=' + d + ' 生成非空');
    sqs.forEach((q) => {
      const qKps = q.knowledgePointIds || [q.knowledgePointId];
      assert.ok(qKps.indexOf(cell.kpId) !== -1);
    });
  }
});
