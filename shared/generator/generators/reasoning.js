'use strict';

/**
 * shared/generator/generators/reasoning.js — Reasoning / Logic Generator
 *
 * 逻辑推理族 Generator：逻辑推理、抽屉原理、最值问题、鸡兔同笼、植树问题、找次品、握手问题、数独
 */

var Rng = require('../core/rng.js');
var KP = require('../../knowledge/knowledge-point.js');

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
  var name = (kp && (kp.name || (kp.identity && kp.identity.name))) || '逻辑推理';

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
  var v = i; // 变体序号：同 KP 同题型下轮换不同结构/设问，提升语义容量（R6）
  if (type === 'drawer') {
    var DRAWER = [
      { c: ['红', '黄', '蓝', '绿'], k: 2, ans: 5 },
      { c: ['红', '黄', '蓝'], k: 2, ans: 4 },
      { c: ['红', '黄', '蓝', '绿'], k: 3, ans: 9 },
      { c: ['黑', '白'], k: 2, ans: 3 }
    ];
    var d = DRAWER[v % DRAWER.length];
    prompt = '有' + d.c.length + '种颜色的球（' + d.c.join('、') + '），至少要摸出多少个，才能保证有' + d.k + '个球颜色相同？';
    answer = d.ans; steps = 2;
  } else if (type === 'extreme') {
    if (v % 3 === 0) {
      var twoSum = Rng.randInt(rng, 10, 50);
      var half = Math.floor(twoSum / 2);
      prompt = '两个数的和是' + twoSum + '，这两个数的乘积最大是多少？';
      answer = half * (twoSum - half); steps = 2;
    } else if (v % 3 === 1) {
      var twoSum2 = Rng.randInt(rng, 10, 50);
      var half2 = Math.floor(twoSum2 / 2);
      prompt = '两个数的和是' + twoSum2 + '，这两个数相差最小时分别是多少？';
      answer = half2 + ' 和 ' + (twoSum2 - half2); steps = 2;
    } else {
      var threeSum = Rng.randInt(rng, 12, 60);
      var base = Math.floor(threeSum / 3);
      var rem = threeSum - 3 * base;
      var parts = [base, base, base]; parts[2] += rem;
      prompt = '三个数的和是' + threeSum + '，这三个数尽可能接近时乘积最大，最大乘积是多少？';
      answer = parts[0] * parts[1] * parts[2]; steps = 2;
    }
  } else if (type === 'chicken-rabbit') {
    if (v % 3 === 0) {
      var heads = Rng.randInt(rng, 8, 20);
      var rabb0 = Rng.randInt(rng, 3, 8);
      var feet = heads * 2 + rabb0 * 2;
      prompt = '鸡兔同笼，共有' + heads + '个头，' + feet + '只脚。鸡和兔各多少只？';
      var r0 = (feet - heads * 2) / 2;
      answer = '鸡' + (heads - r0) + '只，兔' + r0 + '只'; steps = 3;
    } else if (v % 3 === 1) {
      var D = Rng.randInt(rng, 1, 5);
      var R = Rng.randInt(rng, 3, 8);
      var F = 6 * R + 2 * D;
      prompt = '鸡兔同笼，鸡比兔多' + D + '只，共有' + F + '只脚。鸡和兔各多少只？';
      answer = '鸡' + (R + D) + '只，兔' + R + '只'; steps = 3;
    } else {
      var D2 = Rng.randInt(rng, 1, 4);
      var C = Rng.randInt(rng, 3, 8);
      var F2 = 6 * C + 4 * D2;
      prompt = '鸡兔同笼，兔比鸡多' + D2 + '只，共有' + F2 + '只脚。鸡和兔各多少只？';
      answer = '鸡' + C + '只，兔' + (C + D2) + '只'; steps = 3;
    }
  } else if (type === 'tree-planting') {
    var L = Rng.randInt(rng, 100, 500);
    var G = Rng.randInt(rng, 5, 20);
    var TP = [
      { desc: '两端都栽', ans: Math.floor(L / G) + 1 },
      { desc: '两端都不栽', ans: Math.floor(L / G) - 1 },
      { desc: '只在一端栽', ans: Math.floor(L / G) },
      { desc: '在环形操场周围栽（封闭）', ans: Math.floor(L / G) }
    ];
    var tp = TP[v % TP.length];
    prompt = '在一条长' + L + '米的公路一边植树，每隔' + G + '米栽一棵（' + tp.desc + '），一共要栽多少棵？';
    answer = tp.ans; steps = 2;
  } else if (type === 'find-defect') {
    var DEFECT = [
      { n: 3, ans: 1 }, { n: 9, ans: 2 }, { n: 27, ans: 3 }, { n: 81, ans: 4 }
    ];
    var df = DEFECT[v % DEFECT.length];
    prompt = '有' + df.n + '瓶水，其中1瓶是次品（略轻）。用天平称，至少称几次就能找出次品？';
    answer = df.ans; steps = 2;
  } else if (type === 'handshake') {
    var HSK = [
      { w: '个人，每两个人握一次手', ans: function (n) { return n * (n - 1) / 2; } },
      { w: '支球队进行单循环比赛，每两队赛一场', ans: function (n) { return n * (n - 1) / 2; } },
      { w: '个点，每两个点连一条线段', ans: function (n) { return n * (n - 1) / 2; } }
    ];
    var hs = HSK[v % HSK.length];
    var n = Rng.randInt(rng, 4, 12);
    prompt = n + hs.w + '，一共需要多少次？';
    answer = hs.ans(n); steps = 2;
  } else if (type === 'sudoku') {
    var SUD = [
      { w: '请根据已知数字推理出空格中的数字。' },
      { w: '在 4×4 数独中，根据已知数字填出空格。' },
      { w: '在 6×6 数独中，根据已知数字填出空格。' }
    ];
    var su = SUD[v % SUD.length];
    prompt = name + '：' + su.w;
    answer = '（推理过程略）'; steps = 4;
  } else if (type === 'winning') {
    var WIN = [
      { w: '两堆棋子，每次只能从一堆中取 1~3 个，取到最后一个棋子者胜', a: '先手必胜（对称策略）' },
      { w: '一堆石子，每次可取 1~4 个，取到最后一个者胜', a: '先手必胜（凑 5 策略）' },
      { w: '三堆石子，每次从一堆取任意个，取到最后一个者胜', a: '先手必胜（尼姆和策略）' }
    ];
    var win = WIN[v % WIN.length];
    prompt = name + '：' + win.w + '。先手必胜还是后手必胜？';
    answer = win.a; steps = 3;
  } else if (type === 'optimization') {
    if (v % 3 === 0) {
      var pans = Rng.randInt(rng, 2, 5);
      prompt = '用一口锅烙' + pans + '张饼，每张饼两面都要烙，每面需要 2 分钟。至少需要多少分钟？';
      answer = pans * 2; steps = 3;
    } else if (v % 3 === 1) {
      prompt = '煮一个鸡蛋需要 8 分钟，同时可以洗锅 2 分钟。至少需要多少分钟？';
      answer = 8; steps = 2;
    } else {
      prompt = '看一集动画需要 15 分钟，同时可以写完作业 10 分钟。至少需要多少分钟？';
      answer = 15; steps = 2;
    }
  } else if (type === 'seq') {
    var SEQ = [
      { s: '2, 4, 6, 8', ans: 10 },
      { s: '1, 3, 5, 7', ans: 9 },
      { s: '1, 2, 4, 8', ans: 16 },
      { s: '1, 1, 2, 3, 5', ans: 8 }
    ];
    var sq = SEQ[v % SEQ.length];
    prompt = name + '：观察数列规律，写出下一个数：' + sq.s + ', ?';
    answer = sq.ans; steps = 1;
  } else {
    var LOGIC = [
      { w: 'A、B、C、D 四人中有一人说谎。根据条件推理谁在说谎。' },
      { w: '甲、乙、丙三人中只有一人说真话，根据各自陈述推理谁说真话。' },
      { w: '三个盒子分别标“苹果”“橘子”“混合”，标签全贴错。只从一个盒子取一个水果，就能判断全部，如何判断？' }
    ];
    var lg = LOGIC[v % LOGIC.length];
    prompt = name + '：' + lg.w;
    answer = '（逻辑推理略）'; steps = 4;
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
