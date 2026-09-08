'use strict';

/**
 * M3-23 单知识点测试
 * 数学 × 5——每例测试基础(2)/中等(5)/高难(8)，验证 7 个决策维度。
 *
 * Core Domain 收缩（Refactor Step 1）：核心生成链仅接受 math。
 * cn/en 知识点已随语文/英语生成器一并移除，其 ID 必须抛 KP_NOT_FOUND。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
const Validator = require(path.join(ROOT, 'shared', 'strategy', 'strategy-validator.js'));
const Registry = require(path.join(ROOT, 'shared', 'question-type-registry.js'));
const Resolver = require(path.join(ROOT, 'shared', 'capability-resolver.js'));
const KnowledgePoint = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

const MATH_KPS = [
  'math-g1-m0-make-ten',
  'math-g2-m1-mult-table',
  'math-g3-m1-g3-mul-multi1',
  'math-g4-m1-g4-oral-big',
  'math-g5-m1-g5-oral-decmul'
];

const LEVELS = { 基础: 2, 中等: 5, 高难: 8 };

function verifySevenDimensions(kpId, difficulty, label) {
  const r = Engine.plan({ knowledgePointId: kpId, count: 3, difficulty });
  assert.strictEqual(r.valid, true, label + ' result.valid');
  const plan = r.plans[0];

  // ① questionType
  assert.ok(Registry.has(plan.questionTypeId), label + ' ① questionType 合法');
  const supported = Resolver.getCapabilities(KnowledgePoint.get(kpId)).questionTypes;
  assert.ok(supported.includes(plan.questionTypeId), label + ' ① KP 支持该题型');

  // ② cognitiveLevel
  assert.ok(['recognize', 'understand', 'apply'].includes(plan.cognitiveLevel), label + ' ② cognitiveLevel');

  // ③ difficulty
  assert.strictEqual(plan.difficulty, difficulty, label + ' ③ difficulty 等于用户指定');
  assert.ok(plan.difficulty >= 1 && plan.difficulty <= 10, label + ' ③ difficulty 1-10');

  // ④ structure
  assert.ok(plan.constraints.maxSteps >= 1, label + ' ④ maxSteps>=1');
  assert.strictEqual(typeof plan.constraints.allowBracket, 'boolean', label + ' ④ allowBracket');
  assert.strictEqual(typeof plan.constraints.allowMultDiv, 'boolean', label + ' ④ allowMultDiv');
  assert.strictEqual(typeof plan.constraints.scale, 'number', label + ' ④ scale');

  // ⑤ spiralLevel
  assert.ok(plan.spiralLevel >= 1 && plan.spiralLevel <= 6, label + ' ⑤ spiralLevel 1-6');
  const kp = KnowledgePoint.get(kpId);
  const maxSpiral = (kp.spiral && kp.spiral.maxLevel) || 1;
  assert.ok(plan.spiralLevel <= maxSpiral, label + ' ⑤ spiralLevel <= maxSpiralLevel');

  // ⑥ context
  assert.ok(['pure', 'simple', 'standard', 'complex', 'none'].includes(plan.contextType), label + ' ⑥ context 合法');

  // ⑦ count
  assert.strictEqual(plan.count, 3, label + ' ⑦ count');

  // 全链校验（M3-18）
  assert.strictEqual(Validator.validatePlan(plan).valid, true, label + ' M3-18 校验');
  return plan;
}

test('M3-23 数学 × 5（基础/中等/高难）', () => {
  MATH_KPS.forEach(kpId => {
    Object.keys(LEVELS).forEach(tier => {
      verifySevenDimensions(kpId, LEVELS[tier], 'math ' + kpId + ' ' + tier);
    });
  });
});

// cn/en 知识点已随语文/英语生成器连同知识库一并移除（P0-16 剔除），
// 其 ID 不再解析，必须抛 KP_NOT_FOUND（不会静默产出语文/英语内容）。
test('P0-16 语文/英语知识点已移除（KP_NOT_FOUND）', () => {
  const CN_KPS = [
    'cn-g1-n1-pinyin-basic',
    'cn-g1-n2-stroke-order',
    'cn-g2-n2-radical-grouping',
    'cn-g3-n1-multi-pronunciation',
    'cn-g3-n2-dictionary-lookup'
  ];
  const EN_KPS = [
    'en-g3-e1-letter-recognition',
    'en-g3-e1-letter-sound',
    'en-g3-e2-word-spelling'
  ];
  [...CN_KPS, ...EN_KPS].forEach(kpId => {
    let err = null;
    try { Engine.plan({ knowledgePointId: kpId, count: 3, difficulty: 2 }); }
    catch (e) { err = e; }
    assert.ok(err, kpId + ' 应抛出错误');
    assert.strictEqual(err && err.name, 'StrategyError', kpId + ' 错误类型');
    assert.strictEqual(err && err.code, 'KP_NOT_FOUND', kpId + ' 知识点应不存在');
  });
});

test('M3-23 难度单调性：高难 >= 中等 >= 基础（level/steps）', () => {
  MATH_KPS.forEach(kpId => {
    const low = verifySevenDimensions(kpId, LEVELS['基础'], kpId + ' 基础');
    const mid = verifySevenDimensions(kpId, LEVELS['中等'], kpId + ' 中等');
    const high = verifySevenDimensions(kpId, LEVELS['高难'], kpId + ' 高难');
    assert.ok(high.difficulty >= mid.difficulty && mid.difficulty >= low.difficulty);
    assert.ok(high.constraints.maxSteps >= mid.constraints.maxSteps && mid.constraints.maxSteps >= low.constraints.maxSteps,
      kpId + ' steps 非单调递减');
  });
});
