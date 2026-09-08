'use strict';

/**
 * shared/generator/generators/picture-equation.js — Picture Equation / Diagram Generator
 *
 * 看图列式族 Generator：看图列加减、看图列连加连减、线段图、大括号图、天平图、数阵图、幻方
 */

var Rng = require('../core/rng.js');
var KP = require('../../knowledge-point.js');

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

  var prompt, answer, steps;
  if (type === 'segment') {
    var total = Rng.randInt(rng, 20, 100);
    var part = Rng.randInt(rng, 5, total - 5);
    prompt = '根据线段图：总长' + total + '，其中一部分是' + part + '，求另一部分是多少？';
    answer = total - part; steps = 1;
  } else if (type === 'brace') {
    var a = Rng.randInt(rng, 5, 30);
    var b = Rng.randInt(rng, 5, 30);
    prompt = '根据大括号图：左边有' + a + '个苹果，右边有' + b + '个苹果，一共有多少个？';
    answer = a + b; steps = 1;
  } else if (type === 'balance') {
    var left = Rng.randInt(rng, 5, 20);
    var right = left;
    var unknown = Rng.randInt(rng, 2, 8);
    prompt = '天平平衡：左边有' + left + '，右边有' + unknown + ' + ?。求?的值。';
    answer = left - unknown; steps = 2;
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
  } else if (type === 'scale') {
    var scale = Rng.randInt(rng, 1000, 50000);
    var mapDist = Rng.randInt(rng, 2, 10);
    prompt = name + '：比例尺1:' + scale + '，地图上量得距离' + mapDist + 'cm，求实际距离（单位：km）。';
    answer = (mapDist * scale / 100000).toFixed(2); steps = 2;
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
  }

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
    data: { mode: plan.questionTypeId, steps: steps, questionType: plan.questionTypeId, graphic: { type: 'diagram' } }
  };
}

var PICTURE_EQ_KPS = [
  'math-g2-m7-pic-mixed',
  'math-g4-m7-g4-pic-segment',
  'math-g4-m7-g4-pic-brace',
  'math-g4-m7-g4-pic-speed',
  'math-g4-m7-g4-pic-dec',
  'math-g4-c1-c1-array',
  'math-g4-c1-c1-magic',
  'math-g5-m7-g5-pic-balance',
  'math-g5-m7-g5-pic-segment',
  'math-g5-m7-g5-pic-tree',
  'math-g5-c1-number-array-closed',
  'math-g5-c1-number-array-radial',
  'math-g5-c1-number-array-composite',
  'math-g5-c1-magic-square-3',
  'math-g5-c1-magic-square-4',
  'math-g6-m7-g6-pic-frac-line',
  'math-g6-m7-g6-pic-scale',
  'math-g6-c1-magic-square-adv',
  'math-g6-c1-number-array'
];

function createPictureEquationGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:picture-equation';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || PICTURE_EQ_KPS,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));

      for (var i = 0; i < count; i++) {
        questions.push(makePictureEquationQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createPictureEquationGenerator({
      id: 'generator:picture-equation',
      knowledgePoints: PICTURE_EQ_KPS
    })
  ];
}

module.exports = {
  PICTURE_EQ_KPS: PICTURE_EQ_KPS,
  createPictureEquationGenerator: createPictureEquationGenerator,
  buildAll: buildAll
};
