'use strict';

/**
 * shared/generator/generators/reasoning.js — Reasoning / Logic Generator
 *
 * 逻辑推理族 Generator：逻辑推理、抽屉原理、最值问题、鸡兔同笼、植树问题、找次品、握手问题、数独
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
  if (context && context.seed != null) return context.seed + ':reason:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':reason:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':reason:' + i;
}

function makeReasoningQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kp.name || '逻辑推理';

  var type = 'generic';
  if (name.indexOf('抽屉') !== -1 || name.indexOf('鸽巢') !== -1) type = 'drawer';
  else if (name.indexOf('最值') !== -1 || name.indexOf('极值') !== -1) type = 'extreme';
  else if (name.indexOf('鸡兔') !== -1) type = 'chicken-rabbit';
  else if (name.indexOf('植树') !== -1) type = 'tree-planting';
  else if (name.indexOf('找次品') !== -1 || name.indexOf('天平') !== -1) type = 'find-defect';
  else if (name.indexOf('握手') !== -1) type = 'handshake';
  else if (name.indexOf('数独') !== -1) type = 'sudoku';
  else if (name.indexOf('必胜') !== -1) type = 'winning';
  else if (name.indexOf('优化') !== -1 || name.indexOf('沏茶') !== -1 || name.indexOf('烙饼') !== -1 || name.indexOf('统筹') !== -1) type = 'optimization';
  else if (name.indexOf('线段') !== -1 || name.indexOf('数字推理') !== -1) type = 'seq';
  else type = 'logic';

  var prompt, answer, steps;
  if (type === 'drawer') {
    var colors = Rng.randInt(rng, 3, 5);
    prompt = '有红、黄、蓝、绿四种颜色的球，至少要摸出多少个，才能保证有2个球颜色相同？';
    answer = colors + 1;
    steps = 2;
  } else if (type === 'extreme') {
    var twoSum = Rng.randInt(rng, 10, 50);
    prompt = '两个数的和是' + twoSum + '，这两个数的乘积最大是多少？';
    var half = Math.floor(twoSum / 2);
    answer = half * (twoSum - half);
    steps = 2;
  } else if (type === 'chicken-rabbit') {
    var heads = Rng.randInt(rng, 8, 20);
    var feet = heads * 2 + Rng.randInt(rng, 6, 20);
    prompt = '鸡兔同笼，共有' + heads + '个头，' + feet + '只脚。鸡和兔各多少只？';
    var rabb = (feet - heads * 2) / 2;
    answer = '鸡' + (heads - rabb) + '只，兔' + rabb + '只';
    steps = 3;
  } else if (type === 'tree-planting') {
    var total = Rng.randInt(rng, 100, 500);
    var gap = Rng.randInt(rng, 5, 20);
    prompt = '在一条长' + total + '米的公路一边植树，每隔' + gap + '米栽一棵（两端都栽），一共要栽多少棵？';
    answer = Math.floor(total / gap) + 1;
    steps = 2;
  } else if (type === 'find-defect') {
    prompt = '有9瓶水，其中1瓶是次品（略轻）。用天平称，至少称几次就能找出次品？';
    answer = 2;
    steps = 2;
  } else if (type === 'handshake') {
    var n = Rng.randInt(rng, 4, 10);
    prompt = n + '个人握手，每两个人握一次手，一共要握多少次？';
    answer = n * (n - 1) / 2;
    steps = 2;
  } else if (type === 'sudoku') {
    prompt = name + '：请根据已知数字推理出空格中的数字。';
    answer = '（推理过程略）';
    steps = 4;
  } else if (type === 'winning') {
    prompt = name + '：两堆棋子，每次只能从一堆中取1~3个，取到最后一个棋子者胜。先手必胜还是后手必胜？';
    answer = '先手必胜（对称策略）';
    steps = 3;
  } else if (type === 'optimization') {
    var pans = Rng.randInt(rng, 2, 4);
    prompt = '用一口锅烙' + pans + '张饼，每张饼两面都要烙，每面需要2分钟。至少需要多少分钟？';
    answer = pans * 2;
    steps = 3;
  } else if (type === 'seq') {
    prompt = name + '：观察数列规律，写出下一个数：2, 4, 6, 8, ?';
    answer = 10;
    steps = 1;
  } else {
    prompt = name + '：A、B、C、D四人中有一人说谎。根据条件推理谁在说谎。';
    answer = '（逻辑推理略）';
    steps = 4;
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: typeof answer === 'number' ? { value: String(answer), acceptable: [] } : { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: { mode: 'apply', steps: steps, questionType: plan.questionTypeId }
  };
}

var REASONING_KPS = [
  'math-g2-m10-logic-reasoning',
  'math-g2-m10-sudoku3',
  'math-g2-m10-combination',
  'math-g2-m10-handshake',
  'math-g4-m10-g4-reason-opt',
  'math-g4-m10-g4-reason-cr',
  'math-g4-m10-logic-reasoning',
  'math-g4-c8-c8-extreme',
  'math-g4-c8-c8-drawer',
  'math-g4-c8-c8-logic',
  'math-g5-m10-g5-reason-tree3',
  'math-g5-m10-g5-reason-defect',
  'math-g5-m10-logic-reasoning',
  'math-g5-m10-g5-reason-seq',
  'math-g5-c8-extremum-problem',
  'math-g5-c8-logic-inference',
  'math-g5-c8-winning-strategy',
  'math-g6-m10-g6-reason-pigeonhole',
  'math-g6-c8-extremum-problem',
  'math-g6-c8-logic-inference',
  'math-g6-c8-winning-strategy',
  'math-g6-c8-optimization'
];

function createReasoningGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:reasoning';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || REASONING_KPS,

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
        questions.push(makeReasoningQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createReasoningGenerator({
      id: 'generator:reasoning',
      knowledgePoints: REASONING_KPS
    })
  ];
}

module.exports = {
  REASONING_KPS: REASONING_KPS,
  createReasoningGenerator: createReasoningGenerator,
  buildAll: buildAll
};
