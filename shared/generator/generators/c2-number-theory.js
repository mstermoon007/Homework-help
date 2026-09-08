'use strict';

/**
 * shared/generator/generators/c2-number-theory.js — C2 Number Theory Generator
 *
 * 竞赛级 C2 数论族 Generator：奇偶性、整除特征、质因数分解、最大公因数、
 * 最小公倍数、余数与同余、位值原理、完全平方数、数论最值、不定方程、模运算
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
  if (context && context.seed != null) return context.seed + ':c2:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':c2:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':c2:' + i;
}

function gcd(a, b) { while (b) { var t = b; b = a % b; a = t; } return a; }
function lcm(a, b) { return a / gcd(a, b) * b; }

function makeTheoryQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kp.name || '数论问题';
  var id = kp.id || '';

  var isParity = name.indexOf('奇偶') !== -1;
  var isDivisible = name.indexOf('整除') !== -1 || id.indexOf('divisible') !== -1 || id.indexOf('divisibility') !== -1;
  var isPrimeFactor = name.indexOf('质因数') !== -1 || name.indexOf('分解质因数') !== -1;
  var isGcdLcm = name.indexOf('最大公') !== -1 || name.indexOf('最小公') !== -1;
  var isRemainder = name.indexOf('余数') !== -1 || name.indexOf('同余') !== -1 || id.indexOf('remainder') !== -1 || id.indexOf('congruence') !== -1;
  var isPlaceValue = name.indexOf('位值') !== -1 || id.indexOf('place-value') !== -1;
  var isPerfectSquare = name.indexOf('完全平方') !== -1;
  var isFactorCount = name.indexOf('因数个数') !== -1 || name.indexOf('因数和') !== -1;
  var isExtreme = name.indexOf('最值') !== -1;
  var isDiophantine = name.indexOf('不定方程') !== -1;
  var isModulo = name.indexOf('模运算') !== -1 || name.indexOf('周期') !== -1;

  var prompt, answer;

  if (isParity) {
    // 奇偶性运算
    var a = Rng.randInt(rng, 10, 99);
    var b = Rng.randInt(rng, 10, 99);
    prompt = '已知 a = ' + a + '，b = ' + b + '。判断 a + b 是奇数还是偶数？';
    answer = ((a + b) % 2 === 0) ? '偶数' : '奇数';
  } else if (isDivisible) {
    // 整除特征
    var n = Rng.randInt(rng, 100, 999);
    prompt = '三位数 ' + n + ' 能被 9 整除吗？请说明理由。';
    answer = (n % 9 === 0) ? '能' : '不能';
  } else if (isPrimeFactor) {
    // 分解质因数
    var nums = [30, 36, 48, 54, 60, 72, 84, 96, 108, 120];
    var num = nums[Rng.randInt(rng, 0, nums.length - 1)];
    prompt = '将 ' + num + ' 分解质因数。';
    var res = num; var factors = [];
    for (var p = 2; p * p <= res; p++) {
      while (res % p === 0) { factors.push(p); res /= p; }
    }
    if (res > 1) factors.push(res);
    answer = factors.join(' × ');
  } else if (isGcdLcm) {
    // 最大公因数 / 最小公倍数
    var m = Rng.randInt(rng, 10, 30);
    var k = Rng.randInt(rng, 10, 30);
    prompt = '求 ' + m + ' 和 ' + k + ' 的最大公因数和最小公倍数。';
    answer = '最大公因数 ' + gcd(m, k) + '，最小公倍数 ' + lcm(m, k);
  } else if (isRemainder) {
    // 余数 / 同余
    var big = Rng.randInt(rng, 100, 500);
    var div = Rng.randInt(rng, 3, 9);
    prompt = big + ' 除以 ' + div + ' 余几？';
    answer = big % div;
  } else if (isPlaceValue) {
    // 位值原理
    var hun = Rng.randInt(rng, 1, 9);
    var ten = Rng.randInt(rng, 0, 9);
    var one = Rng.randInt(rng, 0, 9);
    var val = hun * 100 + ten * 10 + one;
    prompt = '一个三位数，百位上是 ' + hun + '，十位上是 ' + ten + '，个位上是 ' + one + '。这个数是多少？';
    answer = val;
  } else if (isPerfectSquare) {
    // 完全平方数性质
    var sq = Rng.randInt(rng, 1, 15);
    prompt = (sq * sq) + ' 是完全平方数吗？请说明理由。';
    answer = '是';
  } else if (isFactorCount) {
    // 因数个数
    var n2 = Rng.randInt(rng, 12, 60);
    prompt = n2 + ' 有多少个正因数？';
    var count = 0;
    for (var i = 1; i <= n2; i++) if (n2 % i === 0) count++;
    answer = count;
  } else if (isExtreme) {
    // 数论最值
    prompt = '在 1~100 的自然数中，能被 3 整除但不能被 5 整除的数最大是多少？';
    answer = '99';
  } else if (isDiophantine) {
    // 不定方程
    prompt = '方程 3x + 2y = 17 有多少组正整数解？';
    answer = '2 组（x=1,y=7 和 x=3,y=4 和 x=5,y=1）';
  } else if (isModulo) {
    // 模运算周期
    prompt = '计算 3^2024 的个位数字。';
    // 3 的幂个位周期: 3,9,7,1 → 2024 % 4 = 0 → 1
    answer = '1';
  } else {
    prompt = name + '：请运用数论知识解答这个问题。';
    answer = '数论问题解答';
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
      steps: 3,
      questionType: plan.questionTypeId,
      family: 'c2-number-theory'
    }
  };
}

var C2_KPS = [
  // G4
  'math-g4-c2-c2-parity',
  'math-g4-c2-c2-remainder',
  'math-g4-c2-c2-place',
  // G5
  'math-g5-c2-divisibility',
  'math-g5-c2-parity-analysis',
  'math-g5-c2-prime-factorization',
  'math-g5-c2-factor-count-sum',
  'math-g5-c2-gcd-lcm',
  'math-g5-c2-remainder-congruence',
  'math-g5-c2-place-value',
  'math-g5-c2-perfect-square',
  'math-g5-c2-number-theory-extreme',
  // G6
  'math-g6-c2-divisibility',
  'math-g6-c2-parity-analysis',
  'math-g6-c2-prime-factorization',
  'math-g6-c2-factor-count-sum',
  'math-g6-c2-gcd-lcm',
  'math-g6-c2-remainder-congruence',
  'math-g6-c2-place-value',
  'math-g6-c2-perfect-square',
  'math-g6-c2-number-theory-extreme',
  'math-g6-c2-diophantine-equation',
  'math-g6-c2-modulo-arithmetic'
];

function createC2Generator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c2-number-theory';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || C2_KPS,

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
        questions.push(makeTheoryQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createC2Generator({
      id: 'generator:c2-number-theory',
      knowledgePoints: C2_KPS
    })
  ];
}

module.exports = {
  C2_KPS: C2_KPS,
  createC2Generator: createC2Generator,
  buildAll: buildAll
};
