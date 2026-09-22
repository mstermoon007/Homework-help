'use strict';

/**
 * shared/generator/generators/picture-equation.js — Picture Equation / Diagram Generator
 *
 * 看图列式族 Generator：看图列加减、看图列连加连减、线段图、大括号图、天平图、数阵图、幻方
 */

var Rng = require('../core/rng.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':picture:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':picture:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':picture:' + i;
}

function makePictureEquationQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kp.name || '看图列式';

  var type = 'generic';
  if (name.indexOf('线段') !== -1) type = 'segment';
  else if (name.indexOf('大括号') !== -1 || name.indexOf('看图列') !== -1) type = 'brace';
  else if (name.indexOf('天平') !== -1) type = 'balance';
  else if (name.indexOf('数阵') !== -1) type = 'number-array';
  else if (name.indexOf('幻方') !== -1) type = 'magic-square';
  else if (name.indexOf('植树') !== -1) type = 'tree';
  else if (name.indexOf('比例尺') !== -1) type = 'scale';
  else if (name.indexOf('小数') !== -1) type = 'decimal-context';
  else type = 'generic';

  var prompt, answer, steps, graphic;
  if (type === 'segment') {
    var total = Rng.randInt(rng, 20, 100);
    var part = Rng.randInt(rng, 5, total - 5);
    prompt = '根据线段图：总长' + total + '，其中一部分是' + part + '，求另一部分是多少？';
    answer = total - part; steps = 1;
    graphic = { type: 'diagram', subtype: 'segment', params: { total: total, part: part, unit: '' } };
  } else if (type === 'brace') {
    var a = Rng.randInt(rng, 5, 30);
    var b = Rng.randInt(rng, 5, 30);
    prompt = '根据大括号图：左边有' + a + '个苹果，右边有' + b + '个苹果，一共有多少个？';
    answer = a + b; steps = 1;
    graphic = { type: 'diagram', subtype: 'brace', params: { left: a, right: b, unit: '个' } };
    // P25-07：calc 计划下列式计算形态，题干内嵌可求值算式
    if (plan.questionTypeId === 'calc') {
      prompt = '看图列式：大括号图左边有 ' + a + ' 个苹果，右边有 ' + b + ' 个苹果。'
        + '列式计算一共有多少个：' + a + ' + ' + b + ' = ？';
    }
  } else if (type === 'balance') {
    var left = Rng.randInt(rng, 5, 20);
    var right = left;
    var unknown = Rng.randInt(rng, 2, 8);
    prompt = '天平平衡：左边有' + left + '，右边有' + unknown + ' + ?。求?的值。';
    answer = left - unknown; steps = 2;
    graphic = { type: 'diagram', subtype: 'balance', params: { left: left, rightUnknown: unknown, unit: '' } };
  } else if (type === 'number-array') {
    prompt = name + '：请在数阵图的空位中填入1-5的数字，使每条线上三个数的和都相等。';
    answer = '（数阵解略）'; steps = 3;
  } else if (type === 'magic-square') {
    prompt = name + '：请完成三阶幻方，使每行、每列、每条对角线上三个数的和都相等。';
    answer = '（幻方解略）'; steps = 4;
  } else if (type === 'tree') {
    var roadLen = Rng.randInt(rng, 100, 500);
    var gap = Rng.randInt(rng, 5, 15);
    prompt = name + '：线段图表示一条长' + roadLen + '米的公路，每隔' + gap + '米种一棵树（两端都栽），一共种多少棵？';
    answer = Math.floor(roadLen / gap) + 1; steps = 2;
    graphic = { type: 'diagram', subtype: 'segment', params: { total: roadLen, part: gap, unit: '米', otherLabel: '…' } };
  } else if (type === 'scale') {
    var scale = Rng.randInt(rng, 1000, 50000);
    var mapDist = Rng.randInt(rng, 2, 10);
    prompt = name + '：比例尺1:' + scale + '，地图上量得距离' + mapDist + 'cm，求实际距离（单位：km）。';
    answer = (mapDist * scale / 100000).toFixed(2); steps = 2;
    graphic = { type: 'diagram', subtype: 'scale', params: { scale: scale, mapDist: mapDist } };
  } else if (type === 'decimal-context') {
    var w = Rng.randInt(rng, 1, 9);
    var d = Rng.randInt(rng, 1, 9);
    prompt = name + '：根据情境图列式计算：' + w + '.' + d + ' + ' + (w + 1) + '.' + (d + 1) + ' = ?';
    answer = (parseFloat(w + '.' + d) + parseFloat((w + 1) + '.' + (d + 1))).toFixed(2); steps = 1;
  } else {
    var x = Rng.randInt(rng, 3, 20);
    var y = Rng.randInt(rng, 3, 20);
    prompt = name + '：根据图示信息列式并计算。';
    answer = x + y; steps = 1;
    graphic = { type: 'diagram', subtype: 'brace', params: { left: x, right: y, unit: '' } };
  }

  var data = { mode: plan.questionTypeId, steps: steps, questionType: plan.questionTypeId };
  if (graphic) data.graphic = graphic;

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: data
  };
}

// P25-06 H2：原 PICTURE_EQ_KPS（math-gN-m7-* 模块制 / math-gN-c1-* 竞赛制 历史 ID）
// 已随旧体系 KP 全部剔除，对 canonical 375 永不命中；
// 绑定 SSOT 在 generator-registry.js CORE_RECORDS。
function createPictureEquationGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:picture-equation';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};

      for (var i = 0; i < count; i++) {
        questions.push(makePictureEquationQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [createPictureEquationGenerator()];
}

module.exports = {
  createPictureEquationGenerator: createPictureEquationGenerator,
  buildAll: buildAll
};
