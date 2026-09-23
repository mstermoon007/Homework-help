'use strict';

/**
 * tests/generator/p27-variation-directive.test.js — P27-11 Misconception→NextVariation 接线
 *
 * 冻结不变量：
 *   1. VariationDirective.resolveForPlan：FINAL-22 移除 kbl/teaching overlay 直读后，
 *      恒返回空数组（fail-open 回归守卫）；指令仅经显式输入进入消费链。
 *   2. AdaptiveStrategy.resolve：misconceptionDirectives 非空且有错因聚焦时
 *      R18 variant 被指令转向（数据驱动，非硬编码）；指令随决策回传。
 *   3. 端到端：StrategyEngine.plan 携带含错因记录的 learnerProfile →
 *      计划不自动携带 variationDirectives（FINAL-22：数据源移除），
 *      variant 走 R18 兜底「基础」；指令转向链由用例 2 覆盖（数据重建延后，
 *      见 FINAL-REPAIR-DEFERRED）。
 *   4. 生成器通用消费（arithmetic 族，无 KP 分支）：axis='numeric' 指令 →
 *      运算数收窄到 numberRange 下半区；题面报告 numberRange 保持原值
 *      （validator check#4 语义边界不动）。
 *   5. 无 learnerProfile / 无错因 → 计划不带 variationDirectives（现状不变）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
// StrategyEngine 依赖 bundle shim（KnowledgeContext 等），经 dev/_bundle-env.js 装配；
// AdaptiveStrategy/Arithmetic 从 bundle 取（与产品运行链同一副本）。
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const Bundle = global.StrategyBundle;
const VariationDirective = require(path.join(ROOT, 'shared', 'strategy', 'variation-directive.js'));
const AdaptiveStrategy = Bundle.req('shared/strategy/adaptive-strategy.js');
const StrategyEngine = Env.StrategyEngine;
const Arithmetic = Bundle.req('shared/generator/generators/arithmetic.js');

// FINAL-22：bundle 内 variation-directive 已移除 kbl/teaching/misconception-profiles.json
// 直读（Strategy→KBL=禁止），overlay 注入模拟块随之删除；指令数据经 KnowledgeContext
// 正规通道重建前，resolveForPlan 恒返回空（fail-open）。

const KP_MULT = 'math-g2-up-u07-k001'; // 7~9乘除法（g2，multiplication-division 族）

/* ---------------- 1. resolveForPlan ---------------- */

test('FINAL-22：overlay 数据源已移除 → resolveForPlan 恒返回空（fail-open 回归守卫）', () => {
  ['×', 'mult', 'multiplication'].forEach((tok) => {
    const d = VariationDirective.resolveForPlan({
      kpId: KP_MULT,
      errorTypes: ['口诀混淆'],
      questionTypeId: 'calc',
      operationTokens: [tok]
    });
    assert.equal(d.length, 0, 'token ' + tok + ' 无 overlay 数据 → 空指令');
  });
});

test('trigger 不匹配：题型越界 / 运算不匹配 / 错因不在聚焦 / KP 无 overlay → 空', () => {
  assert.equal(VariationDirective.resolveForPlan({
    kpId: KP_MULT, errorTypes: ['口诀混淆'], questionTypeId: 'judge', operationTokens: ['×']
  }).length, 0, '题型不匹配');
  assert.equal(VariationDirective.resolveForPlan({
    kpId: KP_MULT, errorTypes: ['口诀混淆'], questionTypeId: 'calc', operationTokens: ['+']
  }).length, 0, '运算不匹配（口诀 slot 需乘除）');
  assert.equal(VariationDirective.resolveForPlan({
    kpId: KP_MULT, errorTypes: ['格式错误'], questionTypeId: 'calc', operationTokens: ['×']
  }).length, 0, '错因不在聚焦');
  assert.equal(VariationDirective.resolveForPlan({
    kpId: 'math-unknown-kp', errorTypes: ['口诀混淆'], questionTypeId: 'calc', operationTokens: ['×']
  }).length, 0, '未知 KP');
  assert.equal(VariationDirective.resolveForPlan({
    kpId: KP_MULT, errorTypes: [], questionTypeId: 'calc', operationTokens: ['×']
  }).length, 0, '空聚焦');
});

test('normalizeOps：符号/标签/KBL 运算名混排 → {add,sub,mult,div} 标签集', () => {
  assert.deepEqual(VariationDirective.normalizeOps(['+', '−', '×', '÷']), ['add', 'sub', 'mult', 'div']);
  assert.deepEqual(VariationDirective.normalizeOps(['addition', 'division']), ['add', 'div']);
  assert.deepEqual(VariationDirective.normalizeOps(null), []);
  assert.deepEqual(VariationDirective.normalizeOps('mult'), ['mult']);
});

/* ---------------- 2. R18 变体转向 ---------------- */

test('AdaptiveStrategy.resolve：有错因 + 有指令 → variant 被指令转向并回传', () => {
  const state = {
    kpId: KP_MULT, mastery: 0.9, confidence: 0.9, attempts: 8,
    recentResults: [1, 1, 1], errorPatterns: {
      '口诀混淆': { errorType: '口诀混淆', count: 3, recentCount: 2, confidence: 0.6 }
    }
  };
  const base = AdaptiveStrategy.resolve({ kpId: KP_MULT, learnerState: state, staticDifficulty: 3 });
  assert.equal(base.variant, '迁移', '无指令高掌握 → 迁移（R18 原行为）');
  assert.deepEqual(base.variationDirectives, []);

  const steered = AdaptiveStrategy.resolve({
    kpId: KP_MULT, learnerState: state, staticDifficulty: 3,
    misconceptionDirectives: [{ errorType: '口诀混淆', variant: '数值', axis: 'numeric', basis: 'x' }]
  });
  assert.equal(steered.variant, '数值', '有指令 → 转向指令变体');
  assert.equal(steered.variationDirectives.length, 1);
});

/* ---------------- 3. 端到端：StrategyEngine.plan 挂载 ---------------- */

function learnerProfileWithRhyme() {
  const state = AdaptiveStrategy; // 占位避免未使用告警（真实状态手工构造）
  void state;
  return {
    knowledgePoints: {
      [KP_MULT]: {
        kpId: KP_MULT, mastery: 0.3, confidence: 0.6, attempts: 6,
        correct: 2, accuracy: 0.34, recentResults: [0, 0, 1],
        errorPatterns: {
          '口诀混淆': { errorType: '口诀混淆', count: 3, recentCount: 2, confidence: 0.6 }
        }
      }
    }
  };
}

test('StrategyEngine.plan：learnerProfile 携带口诀混淆 → 计划不自动携带 variationDirectives（FINAL-22）', () => {
  const result = StrategyEngine.plan({
    subject: 'math', grade: 2,
    knowledgePointId: KP_MULT,
    questionType: 'calc',
    count: 2,
    adaptive: true,
    learnerProfile: learnerProfileWithRhyme()
  });
  const plan = result.plans[0];
  assert.ok(plan, '应有计划');
  assert.equal(plan.variationDirectives, undefined,
    'FINAL-22：overlay 数据源移除，计划不自动携带变式指令');
  assert.equal(plan.variant, '基础', 'R18 兜底：有错因 + 低掌握 → 基础（无指令转向）');
});

test('无 learnerProfile → 计划不带 variationDirectives（现状不变）', () => {
  const result = StrategyEngine.plan({
    subject: 'math', grade: 2, knowledgePointId: KP_MULT, questionType: 'calc', count: 1
  });
  const plan = result.plans[0];
  assert.ok(plan);
  assert.equal(plan.variationDirectives, undefined);
});

/* ---------------- 4. 生成器通用消费 ---------------- */

test('arithmetic：axis=numeric 指令 → 运算数收窄下半区；报告 numberRange 保持原值', () => {
  const gen = Arithmetic.createArithmeticGenerator({ id: 'generator:arithmetic-multiplication', operation: 'mult' });
  const basePlan = {
    knowledgePointIds: [KP_MULT],
    questionTypeId: 'calc',
    count: 12,
    seed: 'p27-test',
    constraints: { numberRange: { min: 1, max: 100 }, maxSteps: 1 }
  };

  const steered = gen.generate(Object.assign({}, basePlan, {
    variationDirectives: [{ errorType: '口诀混淆', variant: '数值', axis: 'numeric', basis: 'x' }]
  }));
  assert.ok(steered.length > 0);
  steered.forEach((q) => {
    assert.equal(q.numberRange.max, 100, '报告 numberRange 不变（validator 边界不动）');
    const operands = (q.prompt.match(/\d+/g) || []).map(Number);
    operands.forEach((n) => {
      assert.ok(n >= 1 && n <= 50, '指令消费：运算数必须收窄到下半区 [1,50]，实际 ' + n);
    });
  });
});

test('arithmetic：无指令 → 运算数可覆盖全区间（回归保护）', () => {
  const gen = Arithmetic.createArithmeticGenerator({ id: 'generator:arithmetic-addition', operation: 'add' });
  const plan = {
    knowledgePointIds: ['math-g1-up-u01-k001'],
    questionTypeId: 'calc',
    count: 12,
    seed: 'p27-test-plain',
    constraints: { numberRange: { min: 1, max: 100 }, maxSteps: 1 }
  };
  const qs = gen.generate(plan);
  assert.ok(qs.length > 0);
  let sawAboveMid = false;
  qs.forEach((q) => {
    (q.prompt.match(/\d+/g) || []).map(Number).forEach((n) => {
      if (n > 50) sawAboveMid = true;
    });
  });
  assert.ok(sawAboveMid, '无指令时 12 题应能出现上半区数值（否则收窄泄漏）');
});
