'use strict';

/**
 * shared/generator/generators/c7-clever-calc.js — C7 Clever Calculation Generator
 *
 * 竞赛级 C7 巧算/计算技巧族 Generator：
 *   提取公因数、凑整巧算、分数裂项、整数裂项、等差数列、循环小数化分数、
 *   定义新运算、估算放缩、繁分数化简、数列求和（平方和/立方和）
 *
 * 注：C7 中两个「比较大小」KP（math-g5-c7-compare-size / math-g6-c7-compare-size）
 *     的题型为 recognize（元题型），按 recognize 豁免哲学保留给 selection 家族，不在本族。
 */

var Rng = require('../core/rng.js');
var KP = require('../../knowledge/knowledge-point.js');
var OS = require('../core/op-semantics.js');
var MUL = OS.symbol('multiply') || '×';
var DIV = OS.symbol('divide') || '÷';

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':c7:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':c7:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':c7:' + i;
}

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }

// 分数化简为最简字符串 "p/q"（q=1 时返回整数）
function frac(n, d) {
  if (d < 0) { n = -n; d = -d; }
  var g = gcd(n, d);
  n /= g; d /= g;
  return d === 1 ? String(n) : n + '/' + d;
}

function makeQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = (kp && kp.identity && kp.identity.name) || (kp && kp.name) || '巧算';
  var id = (kp && (kp.identity && kp.identity.id)) || (kp && kp.id) || '';

  // —— 题型判定（优先 id slug，其次中文名）——
  var isExtract = id.indexOf('extract') !== -1 || name.indexOf('提取公因数') !== -1 || name.indexOf('公因数') !== -1;
  var isRounding = id.indexOf('rounding') !== -1 || name.indexOf('凑整') !== -1;
  var isFracSplit = id.indexOf('fraction-splitting') !== -1 || name.indexOf('分数裂项') !== -1;
  var isIntSplit = id.indexOf('integer-splitting') !== -1 || name.indexOf('整数裂项') !== -1;
  var isSeries = id.indexOf('arithmetic-series') !== -1 || name.indexOf('等差数列') !== -1;
  var isRecurring = id.indexOf('recurring') !== -1 || name.indexOf('循环小数') !== -1;
  var isDefineOp = id.indexOf('define-operation') !== -1 || name.indexOf('定义新运算') !== -1 || name.indexOf('新运算') !== -1;
  var isEstimate = id.indexOf('estimate') !== -1 || name.indexOf('估算') !== -1 || name.indexOf('放缩') !== -1;
  var isComplexFrac = id.indexOf('complex-fraction') !== -1 || name.indexOf('繁分数') !== -1;
  var isSeqSum = id.indexOf('sequence-sum') !== -1 || name.indexOf('数列求和') !== -1 || name.indexOf('平方和') !== -1 || name.indexOf('立方和') !== -1;

  var v = i; // 变体序号：同 KP 同题型下轮换不同设问/参数，提升语义容量（R6）
  var prompt, answer, steps;

  if (isExtract) {
    // 提取公因数：a×c + b×c = (a+b)×c，取 a+b=100
    var c = [25, 28, 36, 48][Rng.randInt(rng, 0, 3)];
    var a = Rng.randInt(rng, 20, 80);
    var b = 100 - a;
    prompt = '用简便方法计算：' + a + MUL + c + ' + ' + b + MUL + c;
    answer = (a + b) * c;
    steps = 2;
  } else if (isRounding) {
    // 凑整：补数凑整
    var RND = [{ t: [9, 99, 999, 9999], sum: 11106 }, { t: [8, 98, 998, 9998], sum: 11102 }, { t: [19, 199, 1999], sum: 2217 }, { t: [4, 44, 444], sum: 492 }];
    var rnd = RND[v % RND.length];
    prompt = '用凑整法巧算：' + rnd.t.join(' + ');
    answer = rnd.sum;
    steps = 2;
  } else if (isFracSplit) {
    // 分数裂项：1/(1·2)+1/(2·3)+…+1/[n(n+1)] = 1 - 1/(n+1) = n/(n+1)
    var n = Rng.randInt(rng, 3, 5);
    var terms = [];
    for (var k = 1; k <= n; k++) terms.push('1/(' + k + MUL + (k + 1) + ')');
    prompt = '用裂项法计算：' + terms.join(' + ');
    answer = frac(n, n + 1);
    steps = 3;
  } else if (isIntSplit) {
    // 整数裂项：1×2+2×3+…+n(n+1) = n(n+1)(n+2)/3
    var m = Rng.randInt(rng, 3, 5);
    var iterms = [];
    for (var k2 = 1; k2 <= m; k2++) iterms.push(k2 + MUL + (k2 + 1));
    prompt = '用裂项法计算：' + iterms.join(' + ');
    answer = m * (m + 1) * (m + 2) / 3;
    steps = 3;
  } else if (isSeries) {
    // 等差数列求和：1+2+…+n = n(n+1)/2
    var last = Rng.randInt(rng, 20, 100);
    prompt = '计算等差数列之和：1 + 2 + 3 + … + ' + last;
    answer = last * (last + 1) / 2;
    steps = 2;
  } else if (isRecurring) {
    // 循环小数化分数
    var REC = [{ s: '0.333…（3 循环）', n: 1, d: 3 }, { s: '0.666…（6 循环）', n: 2, d: 3 }, { s: '0.1666…（6 循环）', n: 1, d: 6 }, { s: '0.8333…（3 循环）', n: 5, d: 6 }];
    var rec = REC[v % REC.length];
    prompt = '把循环小数化成分数：' + rec.s;
    answer = frac(rec.n, rec.d);
    steps = 2;
  } else if (isDefineOp) {
    // 定义新运算：规定 a※b = 2a + b，求 x※y
    var x = Rng.randInt(rng, 2, 9);
    var y = Rng.randInt(rng, 2, 9);
    prompt = '定义新运算：a※b = 2a + b。求 ' + x + '※' + y + ' 的值。';
    answer = 2 * x + y;
    steps = 2;
  } else if (isEstimate) {
    // 估算放缩：求若干单位分数和的整数部分
    var EST = [{ t: ['1/2', '1/3', '1/4'], val: 1.0833, ans: 1 }, { t: ['1/3', '1/4', '1/5'], val: 0.7833, ans: 0 }, { t: ['1/2', '1/4', '1/8'], val: 0.875, ans: 0 }, { t: ['1/2', '1/3', '1/6'], val: 1, ans: 1 }];
    var est = EST[v % EST.length];
    prompt = '估算（写出整数部分）：' + est.t.join(' + ') + ' 的结果的整数部分是多少？';
    answer = est.ans;
    steps = 2;
  } else if (isComplexFrac) {
    // 繁分数化简：(n1/d1) / (n2/d2) = n1·d2 / (d1·n2)
    var CF = [{ n1: 1, d1: 2, n2: 3, d2: 4 }, { n1: 2, d1: 3, n2: 4, d2: 5 }, { n1: 3, d1: 4, n2: 1, d2: 2 }, { n1: 1, d1: 3, n2: 2, d2: 5 }];
    var cf = CF[v % CF.length];
    prompt = '化简繁分数：( ' + cf.n1 + '/' + cf.d1 + ' ) ' + DIV + ' ( ' + cf.n2 + '/' + cf.d2 + ' )';
    answer = frac(cf.n1 * cf.d2, cf.d1 * cf.n2);
    steps = 2;
  } else if (isSeqSum) {
    // 数列求和：1²+2²+…+n² = n(n+1)(2n+1)/6
    var s = Rng.randInt(rng, 3, 5);
    var sterms = [];
    for (var k3 = 1; k3 <= s; k3++) sterms.push(k3 + '²');
    prompt = '用公式计算平方和：' + sterms.join(' + ');
    answer = s * (s + 1) * (2 * s + 1) / 6;
    steps = 3;
  } else {
    // 兜底：简单巧算
    var ga = Rng.randInt(rng, 2, 9);
    var gb = Rng.randInt(rng, 2, 9);
    prompt = name + '：用简便方法计算 ' + ga + ' ' + MUL + ' 25 ' + MUL + ' 4';
    answer = ga * 25 * 4;
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
      mode: 'calc',
      steps: steps,
      questionType: plan.questionTypeId,
      family: 'c7-clever-calc'
    }
  };
}

var C7_KPS = [
  // —— G5 C7 巧算（math-competition-g5-c7，9 个 apply/calc；compare-size 为 recognize 留 selection）——
  'math-g5-c7-extract-common-factor',
  'math-g5-c7-rounding-calc',
  'math-g5-c7-fraction-splitting',
  'math-g5-c7-integer-splitting',
  'math-g5-c7-arithmetic-series',
  'math-g5-c7-recurring-decimal-frac',
  'math-g5-c7-define-operation',
  'math-g5-c7-estimate-bounds',
  'math-g5-c7-complex-fraction',
  // —— G6 C7 巧算（math-competition-g6-c7，10 个 apply/calc；compare-size 为 recognize 留 selection）——
  'math-g6-c7-extract-common-factor',
  'math-g6-c7-rounding-calc',
  'math-g6-c7-fraction-splitting',
  'math-g6-c7-integer-splitting',
  'math-g6-c7-arithmetic-series',
  'math-g6-c7-recurring-decimal-frac',
  'math-g6-c7-define-operation',
  'math-g6-c7-estimate-bounds',
  'math-g6-c7-complex-fraction',
  'math-g6-c7-sequence-sum'
];

function createC7Generator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c7-clever-calc';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || C7_KPS,

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
        questions.push(makeQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createC7Generator({
      id: 'generator:c7-clever-calc',
      knowledgePoints: C7_KPS
    })
  ];
}

module.exports = {
  C7_KPS: C7_KPS,
  createC7Generator: createC7Generator,
  buildAll: buildAll
};
