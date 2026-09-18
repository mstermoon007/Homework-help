'use strict';

/**
 * shared/generator/generators/composite.js — 最小 Composite 生成器
 *
 * 现状（POL–KBL Phase 4）：
 *   combine 生成的可用性取决于 B6 绑定迁移（registry.knowledgePoints 仍为 legacy ID），
 *   当前生产不可达；本模块保留**最小接口**（supportsComposite + combine 组合出题）。
 *
 * 约束（Phase 4 硬边界）：
 *   - supportsComposite = true；combine=true 且 knowledgePointIds.length >= 2
 *   - 不查询 KBL / 不分配题量 / 不计算难度 / 不决定知识范围（只消费 Strategy Plan）
 *   - 不扩展模式：仅保留可达的 calc-to-judge 组合
 */

var Rng = require('../core/rng.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':composite:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':composite:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':composite:' + i;
}

/** 组合出题（calc-to-judge）：给出算式让判断对错，题目同时归属全部 combine KP */
function makeCalcToJudge(plan, context, i, kpIds) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var op = Rng.pick(rng, ['+', '−']);
  var a, b, correct;
  if (op === '+') {
    a = Rng.randInt(rng, 1, 9);
    b = Rng.randInt(rng, 1, 9);
    correct = a + b;
  } else {
    a = Rng.randInt(rng, 2, 10);
    b = Rng.randInt(rng, 1, a - 1);
    correct = a - b;
  }
  var isTrue = Rng.randInt(rng, 0, 1) === 1;
  var shown = isTrue ? correct : correct + (Rng.randInt(rng, 0, 1) ? 1 : -1);
  var prompt = a + ' ' + op + ' ' + b + ' = ' + shown + ' （对还是错？）';

  return {
    knowledgePointId: pkp(plan),
    knowledgePointIds: kpIds.slice(),
    questionType: 'judge',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: isTrue,
    answerMode: 'judge',    data: {
      mode: 'calc-to-judge',
      steps: 1,
      primaryKp: pkp(plan),
      operation: op,
      operands: [a, b],
      correct: correct,
      shown: shown,
      composite: true
    }
  };
}

function createCompositeGenerator(spec) {
  spec = spec || {};

  return {
    id: spec.id || 'generator:composite',
    subject: spec.subject || 'math',
    capabilities: ['calc', 'judge', 'fill', 'apply'],
    questionTypes: ['calc', 'judge', 'fill', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],
    supportsComposite: true,

    supports: function (plan) {
      return !!(plan && plan.combine === true &&
        Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds.length >= 2);
    },

    generate: function (plan, context) {
      context = context || {};
      var kpIds = (plan && Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds.length)
        ? plan.knowledgePointIds
        : (plan && plan.knowledgePointId ? [plan.knowledgePointId] : []);
      if (kpIds.length < 2) {
        throw new Error('Composite generator 需要至少 2 个知识点');
      }
      var count = plan.count || 1;
      var questions = [];
      for (var i = 0; i < count; i++) {
        questions.push(makeCalcToJudge(plan, context, i, kpIds));
      }
      return questions;
    }
  };
}

var COMPOSITE_KPS = [
  // 计算 + 判断
  'math-g1-m1-addsub-10', 'math-g1-m0-make-ten', 'math-g1-m0-make-ten-cushi', 'math-g1-m1-addsub-5', 'math-g1-m11-judge-mixed',
  // 单位换算 + 运算
  'math-g1-m4-rmb-unit', 'math-g1-m4-rmb-calc', 'math-g1-m8-rmb-shopping',
  'math-g2-m4-length-unit', 'math-g2-m4-mass-unit', 'math-g2-m4-time-unit',
  'math-g2-m8-money', 'math-g3-m4-g3-measure',
  // 图形 + 数量关系
  'math-g1-m6-solid-shape', 'math-g1-m6-flat-shape', 'math-g1-m6-shape-combine',
  'math-g2-m6-solid-shape', 'math-g4-c4-c4-solid', 'math-g5-c4-solid-geometry',
  'math-g6-c4-solid-geometry'
];

function buildAll() {
  return [
    createCompositeGenerator({
      id: 'generator:composite',
      knowledgePoints: COMPOSITE_KPS
    })
  ];
}

module.exports = {
  COMPOSITE_KPS: COMPOSITE_KPS,
  createCompositeGenerator: createCompositeGenerator,
  buildAll: buildAll
};
