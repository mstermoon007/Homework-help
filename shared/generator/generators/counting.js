'use strict';

/**
 * shared/generator/generators/counting.js — Counting / Combinatorics Generator
 *
 * 计数/排列组合族 Generator：加法原理、乘法原理、枚举法、最不利原则、搭配问题、集合思想
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
  if (context && context.seed != null) return context.seed + ':counting:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':counting:' + i;
}

// —— 组合数学辅助 ——
function factorial(n) {
  var f = 1;
  for (var k = 2; k <= n; k++) f *= k;
  return f;
}

function nCr(n, r) {
  if (r < 0 || r > n) return 0;
  r = Math.min(r, n - r);
  var f = 1;
  for (var k = 0; k < r; k++) f = (f * (n - k)) / (k + 1);
  return Math.round(f);
}

// 错排数 D(n)：n 封信全部装错信封
function derangement(n) {
  if (n === 0) return 1;
  if (n === 1) return 0;
  var d0 = 1, d1 = 0; // D(0), D(1)
  for (var k = 2; k <= n; k++) {
    var dk = (k - 1) * (d1 + d0);
    d0 = d1; d1 = dk;
  }
  return d1;
}

// 爬楼梯走法：每次 1 级或 2 级，上 n 级
function stairWays(n) {
  if (n <= 2) return n;
  var a = 1, b = 2;
  for (var k = 3; k <= n; k++) { var c = a + b; a = b; b = c; }
  return b;
}

function makeCountingQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // KP.get() 返回归一化对象，中文名在 identity.name
  var name = (kp && kp.identity && kp.identity.name) || (kp && kp.name) || '计数问题';

  // 根据 KP 名称选择题型
  var type = 'generic';
  if (name.indexOf('加法') !== -1 || name.indexOf('乘法原理') !== -1) type = 'principle';
  else if (name.indexOf('枚举') !== -1) type = 'enumeration';
  else if (name.indexOf('最不利') !== -1) type = 'worst-case';
  else if (name.indexOf('抽屉') !== -1) type = 'pigeonhole';
  else if (name.indexOf('容斥') !== -1) type = 'inclusion';
  else if (name.indexOf('递推') !== -1) type = 'recursion';
  else if (name.indexOf('错排') !== -1) type = 'derangement';
  else if (name.indexOf('捆绑') !== -1) type = 'bundling';
  else if (name.indexOf('插空') !== -1) type = 'insertion';
  else if (name.indexOf('隔板') !== -1) type = 'starsbars';
  else if (name.indexOf('排列') !== -1) type = 'permutation';
  else if (name.indexOf('搭配') !== -1) type = 'combination';
  else if (name.indexOf('组合') !== -1) type = 'choose';
  else if (name.indexOf('集合') !== -1) type = 'set';

  var prompt, answer, steps;
  if (type === 'principle') {
    var m = Rng.randInt(rng, 3, 8);
    var n = Rng.randInt(rng, 2, 6);
    prompt = '从A城到B城有' + m + '条路线，从B城到C城有' + n + '条路线，从A城到C城共有多少种走法？';
    answer = m * n;
    steps = 2;
  } else if (type === 'enumeration') {
    var digits = [1, 2, 3, 4, 5];
    var len = Rng.randInt(rng, 2, 3);
    prompt = '用' + digits.slice(0, len + 1).join('、') + '这' + (len + 1) + '个数字，可以组成多少个没有重复数字的' + len + '位数？';
    var ans = 1; for (var d = len + 1; d > len + 1 - len; d--) ans *= d;
    answer = ans;
    steps = 3;
  } else if (type === 'worst-case') {
    prompt = '一个盒子里有红、黄、蓝三种颜色的球各若干个，至少要摸出多少个球，才能保证有3个球颜色相同？';
    answer = 7;
    steps = 2;
  } else if (type === 'combination') {
    var shirts = Rng.randInt(rng, 2, 5);
    var pants = Rng.randInt(rng, 2, 5);
    prompt = '小明有' + shirts + '件上衣和' + pants + '条裤子，一共有多少种不同的搭配方法？';
    answer = shirts * pants;
    steps = 2;
  } else if (type === 'set') {
    var inBoth = Rng.randInt(rng, 3, 8);
    var onlyA = Rng.randInt(rng, 5, 15);
    var onlyB = Rng.randInt(rng, 5, 15);
    prompt = '全班40人，有' + onlyA + '人喜欢数学，' + onlyB + '人喜欢语文，有' + inBoth + '人两门都喜欢。两门都不喜欢的有多少人？';
    answer = 40 - (onlyA + onlyB - inBoth);
    steps = 2;
  } else if (type === 'permutation') {
    // 排列：n 个不同元素全排列
    var pn = Rng.randInt(rng, 4, 6);
    prompt = pn + '本不同的书排成一排放在书架上，一共有多少种不同的排法？';
    answer = factorial(pn);
    steps = 2;
  } else if (type === 'choose') {
    // 组合：从 n 人中选 2 人
    var cn = Rng.randInt(rng, 5, 7);
    prompt = '从' + cn + '名同学中选出 2 名代表参加会议，一共有多少种不同的选法？';
    answer = nCr(cn, 2);
    steps = 2;
  } else if (type === 'bundling') {
    // 捆绑法：n 本不同书，其中 2 本必须相邻 → 2! × (n-1)!
    var bn = Rng.randInt(rng, 5, 6);
    prompt = bn + '本不同的书排成一排，其中有 2 本必须相邻，一共有多少种不同的排法？';
    answer = factorial(2) * factorial(bn - 1);
    steps = 3;
  } else if (type === 'insertion') {
    // 插空法：3 名男生固定顺序排好形成 4 个空位，2 名女生插入且互不相邻 → 4×3
    prompt = '3 名男生已按固定顺序排成一排（形成 4 个空位），现将 2 名女生插入空位，要求两名女生互不相邻，一共有多少种插入方法？';
    answer = 4 * 3;
    steps = 2;
  } else if (type === 'starsbars') {
    // 隔板法：7 个相同苹果分给 3 人，每人至少 1 个 → C(6,2)
    var sn = 7, sm = 3;
    prompt = '把 ' + sn + ' 个相同的苹果分给 ' + sm + ' 个小朋友，每人至少分到 1 个，一共有多少种不同的分法？';
    answer = nCr(sn - 1, sm - 1);
    steps = 2;
  } else if (type === 'pigeonhole') {
    // 抽屉原理：4 种颜色，保证 4 个同色 → 4×(4-1)+1
    var colors = 4, want = 4;
    prompt = '盒子里有红、黄、蓝、绿 4 种颜色的球各 10 个（球除颜色外完全相同）。至少要摸出多少个球，才能保证其中有 ' + want + ' 个球颜色相同？';
    answer = colors * (want - 1) + 1;
    steps = 2;
  } else if (type === 'inclusion') {
    // 容斥原理（三集合）
    var aN = 20, bN = 18, cN = 16, ab = 8, ac = 7, bc = 6, abc = 3, total = 40;
    prompt = '某班共有 ' + total + ' 人，参加数学小组的有 ' + aN + ' 人，参加英语小组的有 ' + bN + ' 人，参加科学小组的有 ' + cN + ' 人；'
      + '同时参加数学和英语的有 ' + ab + ' 人，同时参加数学和科学的有 ' + ac + ' 人，同时参加英语和科学的有 ' + bc + ' 人；'
      + '三个小组都参加的有 ' + abc + ' 人。三个小组都没参加的有多少人？';
    answer = total - (aN + bN + cN - ab - ac - bc + abc);
    steps = 3;
  } else if (type === 'recursion') {
    // 递推计数：爬楼梯，每次 1 或 2 级
    var rn = 5;
    prompt = '小明上楼梯，每次可以走 1 级或 2 级台阶。他上到第 ' + rn + ' 级台阶时，一共有多少种不同的走法？';
    answer = stairWays(rn);
    steps = 3;
  } else if (type === 'derangement') {
    // 错排：4 封信全部装错信封 → D(4)=9
    var dn = 4;
    prompt = '有 ' + dn + ' 封信和写好对应地址的 ' + dn + ' 个信封，把信全部装错（没有一封信装进正确的信封），一共有多少种装法？';
    answer = derangement(dn);
    steps = 2;
  } else {
    var a = Rng.randInt(rng, 2, 6);
    var b = Rng.randInt(rng, 2, 6);
    prompt = name + '：从' + a + '种水果和' + b + '种饮料中各选一种，共有多少种搭配？';
    answer = a * b;
    steps = 2;
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
    data: {
      mode: 'apply',
      steps: steps,
      questionType: plan.questionTypeId
    }
  };
}

var COUNTING_KPS = [
  // —— 基础/标准模块 ——
  'math-g3-m10-g3-combination',
  'math-g3-m10-g3-set',
  // —— G4 C3 competition（math-competition-c3-counting）——
  'math-g4-c3-c3-enum',
  'math-g4-c3-c3-am',
  'math-g4-c3-c3-perm',
  'math-g4-c3-c3-worst',
  // 注：math-g4-c3-c3-geomcount（几何计数，qt=geometry）由 shape-recognition 承接
  // —— G5 C3 competition（math-competition-g5-c3，10 个）——
  'math-g5-c3-addition-principle',
  'math-g5-c3-multiplication-principle',
  'math-g5-c3-permutation',
  'math-g5-c3-combination',
  'math-g5-c3-enumeration-counting',
  'math-g5-c3-bundling-method',
  'math-g5-c3-insertion-method',
  'math-g5-c3-stars-bars',
  'math-g5-c3-pigeonhole-principle',
  'math-g5-c3-worst-case-principle',
  // —— G6 C3 competition（math-competition-g6-c3，13 个 apply；geometry-counting 归 shape）——
  'math-g6-c3-addition-principle',
  'math-g6-c3-multiplication-principle',
  'math-g6-c3-permutation',
  'math-g6-c3-combination',
  'math-g6-c3-enumeration-counting',
  'math-g6-c3-bundling-method',
  'math-g6-c3-insertion-method',
  'math-g6-c3-stars-bars',
  'math-g6-c3-pigeonhole-principle',
  'math-g6-c3-worst-case-principle',
  'math-g6-c3-inclusion-exclusion',
  'math-g6-c3-recursion-counting',
  'math-g6-c3-derangement'
];

function createCountingGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:counting';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || COUNTING_KPS,

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
        questions.push(makeCountingQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createCountingGenerator({
      id: 'generator:counting',
      knowledgePoints: COUNTING_KPS
    })
  ];
}

module.exports = {
  COUNTING_KPS: COUNTING_KPS,
  createCountingGenerator: createCountingGenerator,
  buildAll: buildAll
};
