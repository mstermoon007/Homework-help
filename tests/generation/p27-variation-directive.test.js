'use strict';

/**
 * tests/generation/p27-variation-directive.test.js — P27-11 Misconception→NextVariation 接线
 *
 * P30-31 接通后冻结不变量：
 *   1. VariationDirective.resolveForPlan：纯解析，overlay 条目只经 opts.profile 注入
 *      （Strategy 禁直读 KBL；FINAL-22 直读已移除，P30-31 经 KnowledgeContext 正规通道重建）。
 *      profile 缺失/无 slots → 空指令（数据缺失如实为空，非兜底伪造）。
 *   2. 数据通道：KnowledgeContext.misconceptionsFor(kpId) 经 KBL Runtime 公开 API
 *      返回真实 overlay 条目（读信号真实发生），未知 KP → null。
 *   3. AdaptiveStrategy.resolve：misconceptionDirectives 非空且有错因聚焦时
 *      R18 variant 被指令转向（数据驱动，非硬编码）；指令随决策回传。
 *   4. 端到端：StrategyEngine.plan 携带含错因记录的 learnerProfile →
 *      计划自动携带 variationDirectives（六字段 errorType/expectedError/variant/axis/feedback/basis
 *      齐全，P30-32），variant 被指令转向，plan.variation 对应桶开启；
 *      KP/题型不随变式漂移（P30-34）。
 *   5. 生成器通用消费（arithmetic 族，无 KP 分支）：axis='numeric' 指令 →
 *      运算数收窄到 numberRange 下半区；题面报告 numberRange 保持原值
 *      （validator check#4 语义边界不动）。
 *   6. 无 learnerProfile / 无错因 → 计划不带 variationDirectives（现状不变）。
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
const KnowledgeContext = Env.KnowledgeContext;
const Arithmetic = Bundle.req('shared/generator/generators/arithmetic.js');

// P30-31：真实 overlay 条目经 KnowledgeContext 正规通道取出（与产品同一通道，
// 非测试私造数据）；该 KP 在 misconception-profiles.json 中有「口诀混淆」slot：
// triggerPattern={questionTypes:[calc,fill], operations:[mult,div]}，response={variant:数值, axis:numeric}
const KP_MULT = 'math-g2-up-u07-k001'; // 7~9乘除法（g2，multiplication-division 族）
const PROFILE = KnowledgeContext.misconceptionsFor(KP_MULT);

/* ---------------- 1. resolveForPlan（纯解析 + profile 注入） ---------------- */

test('P30-31：注入真实 profile + 触发匹配 → 产出六字段指令；不注入 → 空（数据缺失如实为空）', () => {
  assert.ok(PROFILE && Array.isArray(PROFILE.slots) && PROFILE.slots.length > 0,
    'KnowledgeContext 通道须返回真实 overlay 条目（读信号真实发生）');
  ['×', 'mult', 'multiplication'].forEach((tok) => {
    const d = VariationDirective.resolveForPlan({
      kpId: KP_MULT,
      errorTypes: ['口诀混淆'],
      questionTypeId: 'calc',
      operationTokens: [tok],
      profile: PROFILE
    });
    assert.equal(d.length, 1, 'token ' + tok + ' 触发匹配 → 恰 1 条指令');
    const x = d[0];
    assert.equal(x.errorType, '口诀混淆');
    assert.equal(x.expectedError, '口诀混淆');
    assert.equal(x.variant, '数值');
    assert.equal(x.axis, 'numeric');
    assert.equal(typeof x.feedback, 'string');
    assert.ok(x.feedback.length > 0, 'feedback 非空（FINAL-51 标准补救指引）');
    assert.equal(typeof x.basis, 'string');
    assert.ok(x.basis.length > 0, 'basis 引文非空（可溯源）');
  });
  // 数据缺失面：不注入 profile / 注入无 slots 条目 → 空指令（如实，不伪造）
  assert.equal(VariationDirective.resolveForPlan({
    kpId: KP_MULT, errorTypes: ['口诀混淆'], questionTypeId: 'calc', operationTokens: ['×']
  }).length, 0, '无 profile 注入 → 空');
  assert.equal(VariationDirective.resolveForPlan({
    kpId: KP_MULT, errorTypes: ['口诀混淆'], questionTypeId: 'calc', operationTokens: ['×'],
    profile: { knowledgePointId: KP_MULT, slots: [] }
  }).length, 0, '空 slots → 空');
});

test('trigger 不匹配：题型越界 / 运算不匹配 / 错因不在聚焦 / KP 无 overlay → 空', () => {
  assert.equal(VariationDirective.resolveForPlan({
    kpId: KP_MULT, errorTypes: ['口诀混淆'], questionTypeId: 'judge', operationTokens: ['×'], profile: PROFILE
  }).length, 0, '题型不匹配');
  assert.equal(VariationDirective.resolveForPlan({
    kpId: KP_MULT, errorTypes: ['口诀混淆'], questionTypeId: 'calc', operationTokens: ['+'], profile: PROFILE
  }).length, 0, '运算不匹配（口诀 slot 需乘除）');
  assert.equal(VariationDirective.resolveForPlan({
    kpId: KP_MULT, errorTypes: ['格式错误'], questionTypeId: 'calc', operationTokens: ['×'], profile: PROFILE
  }).length, 0, '错因不在聚焦');
  assert.equal(KnowledgeContext.misconceptionsFor('math-unknown-kp'), null, '未知 KP → null（通道如实）');
  assert.equal(VariationDirective.resolveForPlan({
    kpId: 'math-unknown-kp', errorTypes: ['口诀混淆'], questionTypeId: 'calc', operationTokens: ['×'],
    profile: KnowledgeContext.misconceptionsFor('math-unknown-kp')
  }).length, 0, '未知 KP');
  assert.equal(VariationDirective.resolveForPlan({
    kpId: KP_MULT, errorTypes: [], questionTypeId: 'calc', operationTokens: ['×'], profile: PROFILE
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

/* ---------------- 3. 端到端：StrategyEngine.plan 挂载（P30-31/32 接通证据） ---------------- */

function learnerProfileWithRhyme() {
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

test('P30-31/32：learnerProfile 携带口诀混淆 → 计划经 KnowledgeContext 通道携带 variationDirectives', () => {
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
  assert.ok(Array.isArray(plan.variationDirectives) && plan.variationDirectives.length > 0,
    'P30-31：overlay 经 KnowledgeContext 接通，计划自动携带变式指令');
  const d = plan.variationDirectives[0];
  // P30-32：命中错误须产出六字段并进入 QuestionPlan
  ['errorType', 'expectedError', 'variant', 'axis', 'feedback', 'basis'].forEach((f) => {
    assert.ok(d[f] != null && d[f] !== '', '指令字段 ' + f + ' 存在且非空');
  });
  assert.equal(d.errorType, '口诀混淆');
  assert.equal(d.axis, 'numeric');
  assert.equal(plan.variant, '数值', 'R18 variant 被指令转向（原兜底为基础）');
  assert.equal(plan.variation && plan.variation.numeric, true, '六桶 variation.numeric 开启');
  // P30-34：变式不突破 Intent——同 KP / 同题型
  assert.equal(plan.knowledgePointIds[0], KP_MULT, 'KP 不漂移');
  assert.equal(plan.questionTypeId, 'calc', '题型不漂移');
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

/* ---------------- 5. P30-33：下一题确实发生变化（全链 E2E，产品级入口 PracticeSession） ---------------- */

const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
const KP_STRUCT = 'math-g1-down-u04-k005'; // 解决问题（g1，add/sub）：计算错误→numeric / 步骤错误→structure / 审题错误→context

function learnerProfileWithError(kpId, errorType) {
  return {
    knowledgePoints: {
      [kpId]: {
        kpId, mastery: 0.3, confidence: 0.6, attempts: 6,
        correct: 2, accuracy: 0.34, recentResults: [0, 0, 1],
        errorPatterns: { [errorType]: { errorType, count: 3, recentCount: 2, confidence: 0.6 } }
      }
    }
  };
}

async function genQuestions(opts) {
  const session = new PracticeSession(Object.assign({
    subject: 'math', grade: 1, count: 3, knowledgePointId: KP_STRUCT, questionType: 'calc'
  }, opts));
  await session.start();
  return session.semanticQuestions || [];
}

test('P30-33：步骤错误 → 结构变式（未知数位置+数值），同 KP/QT，答案仍正确', async () => {
  const seed = 'p30-33-struct';
  const baseline = await genQuestions({ seed });
  const steered = await genQuestions({ seed, adaptive: true, learnerProfile: learnerProfileWithError(KP_STRUCT, '步骤错误') });
  assert.equal(baseline.length, 3);
  assert.equal(steered.length, 3);

  const changed = steered.filter((q, i) => q.prompt !== baseline[i].prompt);
  assert.ok(changed.length > 0, '同 seed 下带错因题面必须不同于基线（非仅换数字的同一题）');

  steered.forEach((q) => {
    // P30-34：变式不突破 Intent——同 KP / 同题型
    const qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
    assert.equal(qk, KP_STRUCT, 'KP 不漂移');
    assert.equal(q.questionType, 'calc', '题型不漂移');
    const applied = (q.data && q.data.variationApplied) || [];
    assert.ok(applied.length > 0, '结构变式必须实际应用（variationApplied 非空）');
    // 未知数位置变化的证据：prompt 含未知操作数位（? 在等号左侧运算数位）
    if (applied.indexOf('unknown-position') !== -1) {
      assert.ok(/^\?\s*[+\-−×÷]/.test(q.prompt) || /[+\-−×÷]\s*\?\s*=/.test(q.prompt),
        'unknown-position：未知数应移到运算数位，实际 prompt=' + q.prompt);
    }
    // 答案正确性不变式破坏：若 prompt 形如 ? op b = c，则 answer op b = c 成立
    const m = q.prompt.match(/^(\d+|\?)\s*([+\-−×÷])\s*(\d+|\?)\s*=\s*(\d+|\?)$/);
    if (m) {
      const ans = Number(q.answer && q.answer.value);
      const a = m[1] === '?' ? ans : Number(m[1]);
      const b = m[3] === '?' ? ans : Number(m[3]);
      const c = m[4] === '?' ? ans : Number(m[4]);
      const calc = { '+': a + b, '-': a - b, '−': a - b, '×': a * b, '÷': b === 0 ? NaN : a / b }[m[2]];
      assert.equal(calc, c, '变式后答案仍满足等式: ' + q.prompt + ' answer=' + ans);
    }
  });
});

test('P30-33：审题错误 → 情境变式（表达方式变化），同 KP/QT', async () => {
  const seed = 'p30-33-context';
  const baseline = await genQuestions({ seed, questionType: 'apply', count: 2 });
  const steered = await genQuestions({ seed, questionType: 'apply', count: 2, adaptive: true, learnerProfile: learnerProfileWithError(KP_STRUCT, '审题错误') });
  assert.equal(baseline.length, 2);
  assert.equal(steered.length, 2);
  steered.forEach((q, i) => {
    const qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
    assert.equal(qk, KP_STRUCT);
    assert.equal(q.questionType, 'apply');
    const applied = (q.data && q.data.variationApplied) || [];
    assert.ok(applied.indexOf('context') !== -1, '审题错误须触发情境变式，实际 applied=' + JSON.stringify(applied));
    assert.notEqual(q.prompt, baseline[i].prompt, '题面表达须变化');
    assert.ok(typeof q.data.contextType === 'string' && q.data.contextType.length > 0, 'contextType 溯源字段存在');
  });
});

test('P30-33：同一 learnerProfile + 同 seed → 输出逐字节相等（确定性重放）', async () => {
  const seed = 'p30-33-replay';
  const lp = learnerProfileWithError(KP_STRUCT, '步骤错误');
  const a = await genQuestions({ seed, adaptive: true, learnerProfile: lp });
  const b = await genQuestions({ seed, adaptive: true, learnerProfile: lp });
  assert.equal(JSON.stringify(a.map((q) => [q.prompt, q.answer && q.answer.value])),
    JSON.stringify(b.map((q) => [q.prompt, q.answer && q.answer.value])),
    '同种子同错因重放必须确定性相等');
});
