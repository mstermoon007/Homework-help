'use strict';

/**
 * tests/strategy/p25-13-explainability.test.js — P25-13 QuestionPlan Explainability Metadata
 *
 * 验收：
 *   1. StrategyEngine.plan() 产出的 QuestionPlan 包含 explainability 字段
 *   2. explainability 七个子字段全部填充（knowledgePoint/semanticTarget/questionIntent/
 *      questionType/difficulty/variation/selectionReason）
 *   3. validateQuestionPlan 接受合法 explainability、拒绝非法类型
 *   4. explainability 不在 forbidden 列表中（与 svg/html/generate 等并列校验）
 *   5. selectionReason 包含可追溯的拼装踪迹（KP/intent/variant/errorFocus/generator）
 *   6. 无 learnerProfile 时 explainability 仍可降级产出（variation='fixed'）
 *
 * 测试环境：strategy-engine.js 通过 require('../../kbl/teaching/qt-intent.json') 读
 * 意图数据。在 Node 直载下天然可读；在 bundle 环境下需要注入数据，模拟产品浏览器场景
 * （与 p27-variation-directive.test.js 同款机制）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const Bundle = global.StrategyBundle;
const StrategyEngine = Env.StrategyEngine;
const QuestionPlan = require(path.join(ROOT, 'shared', 'strategy', 'question-plan.js'));

// 注入 qt-intent.json 数据到 bundle 模块注册表（与 strategy-engine.js require 路径逐字一致）
const QT_INTENT_PATH = '../../kbl/teaching/qt-intent.json';
if (Bundle && Bundle.modules) {
  Bundle.modules[QT_INTENT_PATH] = function (m) {
    m.exports = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'qt-intent.json'), 'utf8'));
  };
}

// 选一个有 qt-intent 行的 A 类 KP 做 E2E
const KP_ID = 'math-g1-up-u01-k001'; // 1-5数的认识
const QT = 'calc';

test('P25-13 #1：plan() 产出的 QuestionPlan 包含 explainability 字段', () => {
  const result = StrategyEngine.plan({
    subject: 'math', grade: 1, count: 1,
    knowledgePointId: KP_ID, questionType: QT
  });
  assert.ok(result && result.plans && result.plans.length, '应产出至少 1 个 plan');
  const plan = result.plans[0];
  assert.ok(plan.explainability, 'explainability 字段必须存在');
  assert.equal(typeof plan.explainability, 'object', 'explainability 必须是对象');
  assert.ok(!Array.isArray(plan.explainability), 'explainability 不能是数组');
});

test('P25-13 #2：explainability 七个子字段全部填充', () => {
  const result = StrategyEngine.plan({
    subject: 'math', grade: 1, count: 1,
    knowledgePointId: KP_ID, questionType: QT
  });
  const ex = result.plans[0].explainability;
  const REQUIRED = ['knowledgePoint', 'semanticTarget', 'questionIntent', 'questionType', 'difficulty', 'variation', 'selectionReason'];
  REQUIRED.forEach(function (k) {
    assert.ok(ex[k] !== undefined && ex[k] !== null && ex[k] !== '',
      'explainability.' + k + ' 必须填充（实际: ' + JSON.stringify(ex[k]) + ')');
  });
  assert.equal(ex.questionType, QT, 'questionType 字段应等于请求题型');
  assert.equal(typeof ex.difficulty, 'number', 'difficulty 应是 number');
  assert.ok(ex.knowledgePoint.indexOf(KP_ID) !== -1, 'knowledgePoint 应含 KP ID');
});

test('P25-13 #3：validateQuestionPlan 接受合法 explainability', () => {
  const valid = QuestionPlan.validateQuestionPlan({
    knowledgePointIds: [KP_ID],
    questionTypeId: QT,
    difficulty: 3,
    explainability: {
      knowledgePoint: KP_ID + ' 测试KP',
      semanticTarget: '测试语义目标',
      questionIntent: '测试意图',
      questionType: QT,
      difficulty: 3,
      variation: 'fixed',
      selectionReason: 'KP=test; intent=declared'
    }
  });
  assert.ok(valid.valid, '合法 explainability 应通过校验（错误: ' + (valid.errors || []).join('; ') + '）');
});

test('P25-13 #4：validateQuestionPlan 拒绝非法 explainability 类型', () => {
  // 非对象
  let r = QuestionPlan.validateQuestionPlan({
    knowledgePointIds: [KP_ID], questionTypeId: QT, difficulty: 3,
    explainability: 'not-an-object'
  });
  assert.ok(!r.valid, '字符串型 explainability 应被拒绝');
  assert.ok(r.errors.some(function (e) { return e.indexOf('explainability 必须是对象') !== -1; }));

  // 子字段非法类型
  r = QuestionPlan.validateQuestionPlan({
    knowledgePointIds: [KP_ID], questionTypeId: QT, difficulty: 3,
    explainability: { knowledgePoint: 123 }
  });
  assert.ok(!r.valid, 'number 型 knowledgePoint 应被拒绝');
  assert.ok(r.errors.some(function (e) { return e.indexOf('explainability.knowledgePoint') !== -1; }));

  // 数组型 difficulty 非法
  r = QuestionPlan.validateQuestionPlan({
    knowledgePointIds: [KP_ID], questionTypeId: QT, difficulty: 3,
    explainability: { difficulty: [1, 2] }
  });
  assert.ok(!r.valid, '数组型 difficulty 应被拒绝');
});

test('P25-13 #5：explainability 不在 forbidden 列表（与 svg/html/generate 并列校验）', () => {
  // explainability 字段应可通过校验，不被 forbidden 拦截
  const r = QuestionPlan.validateQuestionPlan({
    knowledgePointIds: [KP_ID], questionTypeId: QT, difficulty: 3,
    explainability: { knowledgePoint: 'test' }
  });
  assert.ok(r.valid, 'explainability 不应在 forbidden 列表中');
  assert.ok(!r.errors.some(function (e) { return e.indexOf('禁止字段: explainability') !== -1; }),
    '不应有 "禁止字段: explainability" 错误');

  // 对照：svg 字段应被 forbidden 拦截
  const r2 = QuestionPlan.validateQuestionPlan({
    knowledgePointIds: [KP_ID], questionTypeId: QT, difficulty: 3,
    svg: '<circle/>'
  });
  assert.ok(!r2.valid, 'svg 应被 forbidden 拦截');
  assert.ok(r2.errors.some(function (e) { return e.indexOf('禁止字段: svg') !== -1; }));
});

test('P25-13 #6：无 learnerProfile 时 explainability 降级 variation="fixed"', () => {
  const result = StrategyEngine.plan({
    subject: 'math', grade: 1, count: 1,
    knowledgePointId: KP_ID, questionType: QT
    // 不传 learnerProfile
  });
  const ex = result.plans[0].explainability;
  assert.equal(ex.variation, 'fixed', '无 learnerProfile 时 variation 应降级为 fixed');
  assert.ok(ex.selectionReason.indexOf('variant=fixed') !== -1,
    'selectionReason 应含 variant=fixed');
  assert.ok(ex.selectionReason.indexOf('KP=' + KP_ID) !== -1,
    'selectionReason 应含 KP=' + KP_ID);
  assert.ok(ex.selectionReason.indexOf('generator=') !== -1,
    'selectionReason 应含 generator=');
});
