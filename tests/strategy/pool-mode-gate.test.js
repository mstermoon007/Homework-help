'use strict';

// Refactor Step 3 — Gate：quick / teacher / competition 三种池化模式由同一 StrategyEngine.plan() 直接扩展
// （不建三套 Strategy Engine）。Gate 断言：三种模式均输出合法 QuestionPlan，且满足池源/权重/守恒约束。
//   quick       → grade + volume(+questionType) 构成 KP Pool
//   teacher     → unitId 构成 KP Pool
//   competition → 同一池/同一流程，spiral/cognition/difficulty/context/composite 权重抬升，
//                 未显式给出时 difficulty / spiralLevel 抬到高位

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
const Validator = require(path.join(ROOT, 'shared', 'strategy', 'strategy-validator.js'));
const Request = require(path.join(ROOT, 'shared', 'strategy', 'strategy-request.js'));

const DIMS = ['spiral', 'cognition', 'difficulty', 'context', 'composite'];

function countSum(r) {
  return r.plans.reduce((a, p) => a + (p.count || 0), 0);
}

test('GATE-S3-1：quick —— grade+volume+questionType 池，全计划合法且题量守恒', () => {
  const r = Engine.plan({ mode: 'quick', subject: 'math', grade: 1, count: 10, questionType: 'calc' });
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.trace.mode, 'quick');
  assert.strictEqual(r.trace.pool.grade, 1);
  assert.strictEqual(countSum(r), 10, '题量守恒：selected plans 的 count 之和必须等于请求 count');
  assert.ok(r.plans.length >= 1);
  assert.ok(r.trace.failedPlans.length === 0, '池内选中项必须全部成功产出计划');
  for (const p of r.plans) {
    assert.strictEqual(Validator.validatePlan(p).valid, true, '每个池化计划都必须通过 M3-18 校验');
    assert.strictEqual(p.__pool.mode, 'quick');
    assert.ok(p.__pool.kpId.startsWith('math-g1-'), 'quick 池必须全部落在请求年级内');
    assert.strictEqual(p.questionTypeId, 'calc');
  }
  // 五维评分必须写入 trace（composite decision 结构）
  assert.ok(r.trace.selection.length >= 1);
  for (const d of DIMS) assert.strictEqual('number', typeof r.trace.selection[0].dims[d]);
  assert.strictEqual('number', typeof r.trace.selection[0].composite);
});

test('GATE-S3-2：teacher —— unitId 构成池，全计划归属该单元', () => {
  const r = Engine.plan({ mode: 'teacher', subject: 'math', grade: 1, unitId: 'M1', count: 6 });
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.trace.mode, 'teacher');
  assert.strictEqual(r.trace.pool.unitId, 'M1');
  assert.strictEqual(countSum(r), 6, '题量守恒');
  assert.ok(r.plans.length >= 1);
  for (const p of r.plans) {
    assert.strictEqual(Validator.validatePlan(p).valid, true);
    assert.strictEqual(p.__pool.mode, 'teacher');
    assert.ok(p.__pool.kpId.startsWith('math-g1-m1-'), 'teacher 池必须全部归属 unitId=M1');
  }
});

test('GATE-S3-3：competition —— 同等流程但维度权重抬升，默认难度/螺旋取高位', () => {
  const r = Engine.plan({ mode: 'competition', subject: 'math', grade: 4, count: 8, questionType: 'calc' });
  assert.strictEqual(r.valid, true);
  assert.deepStrictEqual(r.trace.dimWeights, Engine.DIM_WEIGHTS.competition, 'trace 必须携带 competition 权重');
  assert.strictEqual(countSum(r), 8, '题量守恒');
  assert.ok(r.plans.length >= 1);
  for (const p of r.plans) {
    assert.strictEqual(Validator.validatePlan(p).valid, true);
    assert.strictEqual(p.__pool.mode, 'competition');
    assert.strictEqual(p.difficulty, 7, 'competition 未显式难度 → 年级锚点上限');
  }
  // 维度权重恒大于基础权重的证明（结构断言）
  for (const d of DIMS) assert.ok(Engine.DIM_WEIGHTS.competition[d] > Engine.DIM_WEIGHTS.quick[d], d + ' 权重要求抬升');
  assert.deepStrictEqual(Engine.DIM_WEIGHTS.competition, { spiral: 1.6, cognition: 1.6, difficulty: 1.4, context: 1.4, composite: 1.6 });
});

test('GATE-S3-4：三模式共用同一 plan()（无第三套引擎），Request 层结构约束成立', () => {
  assert.deepStrictEqual(Engine.POOL_MODES, { quick: true, teacher: true, competition: true });
  for (const d of DIMS) {
    assert.strictEqual(Engine.DIM_WEIGHTS.quick[d], 1);
    assert.strictEqual(Engine.DIM_WEIGHTS.teacher[d], 1);
  }
  // 三模式均通过 plan() 入口产出合法 QuestionPlan（同一入口，无独立引擎文件）
  assert.strictEqual(typeof Engine.plan, 'function');
  // 别名归一
  for (const m of ['quick', 'teacher', 'competition']) {
    assert.ok(Request.VALID_MODES.includes(m));
    assert.strictEqual(Request.MODE_ALIAS[m], m);
  }
  // Request 校验：quick 需 grade；teacher 需 unitId；competition 需 grade 或 unitId
  assert.strictEqual(Request.validateRequest({ mode: 'quick', subject: 'math' }).valid, false);
  assert.strictEqual(Request.validateRequest({ mode: 'teacher', subject: 'math', grade: 1 }).valid, false);
  assert.strictEqual(Request.validateRequest({ mode: 'teacher', subject: 'math', unitId: 'M1' }).valid, true);
  assert.strictEqual(Request.validateRequest({ mode: 'competition', subject: 'math' }).valid, false);
  assert.strictEqual(Request.validateRequest({ mode: 'competition', subject: 'math', grade: 4 }).valid, true);
  assert.strictEqual(Request.validateRequest({ mode: 'quick', subject: 'math', grade: 1 }).valid, true);
});