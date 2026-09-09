/**
 * shared/generator/generators/classify.js — 分类整理生成器（V2.1 补充）
 *
 * 为「分类整理 / 排序」类知识点（如 math-g1-m4-count-quantity 数数比较）提供
 * 语义正确的专用生成逻辑，补齐 7 类规范题型中唯一无生成器的 classify 类型。
 *
 * 挂载点：
 *   - generators/index.js  require + buildAll 合并
 *   - generator-registry.js CORE_RECORDS 增补 1 条 native 绑定
 *   - selector 无需改动：classify 为元题型（isMetaExempt），硬阻断全部豁免
 *
 * 输出契约：SemanticQuestion[]（字段与 semantic-special.js buildBase 一致）
 */
'use strict';

var Rng = require('../core/rng.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':' + i;
  if (plan && plan.seed != null) return plan.seed + ':' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
}

function buildBase(plan, context, i, extra) {
  var constraints = plan.constraints || {};
  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    difficultyParams: {
      level: plan.difficulty,
      scale: constraints.scale != null ? constraints.scale : 1,
      steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
      allowBracket: !!constraints.allowBracket,
      allowMultDiv: !!constraints.allowMultDiv
    },
    numberRange: constraints.numberRange || { min: 1, max: 10 },
    spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
    context: plan.contextType != null ? plan.contextType : 'standard',
    seed: seedFor(plan, context, i),
    hint: null,
    answerMode: 'input',
    data: extra || {}
  };
}

function buildQuestions(plan, context, count, make) {
  var out = [];
  for (var i = 0; i < count; i++) out.push(make(plan, context, i));
  return out;
}

/* ================================================================
 * generator:classification — 分类整理 / 排序
 * ================================================================ */

function makeSort(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var range = (plan.constraints && plan.constraints.numberRange) || { min: 1, max: 10 };
  var n = Rng.randInt(rng, 3, 5);
  var nums = [];
  var guard = 0;
  while (nums.length < n && guard < 100) {
    var v = Rng.randInt(rng, range.min, range.max);
    if (nums.indexOf(v) === -1) nums.push(v);
    guard++;
  }
  var desc = Rng.randInt(rng, 0, 1) === 1;
  var sorted = nums.slice().sort(function (a, b) { return desc ? b - a : a - b; });
  var orderText = desc ? '从大到小' : '从小到大';
  var q = buildBase(plan, context, i, { mode: 'classify', sort: { desc: desc, count: n } });
  q.prompt = '把下面各数按' + orderText + '的顺序排列：' + nums.join('，') + '。';
  q.answer = { value: sorted.join('，'), acceptable: [] };
  return q;
}

function createClassificationGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:classification';
  var generator = {
    id: id,
    subject: 'math',
    capabilities: ['classify'],
    questionTypes: ['classify'],
    knowledgePoints: spec.knowledgePoints || ['math-g1-m4-count-quantity'],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return plan.questionTypeId === 'classify';
    },

    generate: function (plan, context) {
      var count = (plan && plan.count) || 1;
      return buildQuestions(plan, context, count, makeSort);
    }
  };
  return generator;
}

function buildAll() {
  return [createClassificationGenerator()];
}

module.exports = {
  createClassificationGenerator: createClassificationGenerator,
  buildAll: buildAll
};
