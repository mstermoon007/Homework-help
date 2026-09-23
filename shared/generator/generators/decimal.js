/**
 * shared/generator/generators/decimal.js — P25-09 小数专项 Generator
 *
 * 承载 23 个小数 KP（g3 初步认识 → g4 意义/性质/加减 → g5 乘除），
 * 取代 P25-08 后被 shape-recognition v3 平局截胡产出的「绳子减法/图形命名」。
 *
 * 分派：消费 selector 注入的 plan.semanticParams.name，按 NAME_RULES 机械派生子类型，
 * 禁止 KP ID 猜测；子类型 × 题型无 maker 时 fail-closed 返回 []。
 *
 * 题型：calc / fill / choice / apply（C 类小数 KP 的 ALLOW 集）。
 * calc 题干内嵌算式满足 type-contract expressionPresent；概念类 calc 以支撑算式承载。
 */
'use strict';

var Rng = require('../core/rng.js');
var SemanticEvidence = require('../core/semantic-evidence.js');
var VariationApply = require('../core/variation-apply.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':dec:' + i;
  if (plan && plan.seed != null) return plan.seed + ':dec:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':dec:' + i;
}

// 浮点去噪
function r1(x) { return Math.round(x * 10) / 10; }
function r2(x) { return Math.round(x * 100) / 100; }
function r4(x) { return Math.round(x * 10000) / 10000; }
function fmt(x) { return String(r4(x)); }

// 顺序敏感：应用/混合/估算等具体词在前，认识类兜底在后
var NAME_RULES = [
  { sub: 'word', re: /应用|解决问题/ },
  { sub: 'unit', re: /单位换算/ },
  { sub: 'addsub-mix', re: /加减混合/ },
  { sub: 'mult-estimate', re: /乘法的估算|乘.*估算/ },
  { sub: 'div', re: /除以|除法|循环小数/ },
  { sub: 'mult', re: /乘/ },
  { sub: 'addsub', re: /加|减/ },
  { sub: 'point-move', re: /小数点.*移动/ },
  { sub: 'approx', re: /近似/ },
  { sub: 'nature', re: /性质/ },
  { sub: 'compare', re: /比较/ },
  { sub: 'readwrite', re: /读法|写法|读写|认识|意义/ }
];

function deriveSubtype(name) {
  for (var i = 0; i < NAME_RULES.length; i++) {
    if (NAME_RULES[i].re.test(name || '')) return NAME_RULES[i].sub;
  }
  return 'readwrite';
}

/* ------------------------------------------------------------------ *
 * 纯计算结构（返回 {expr, answer, story}）
 * ------------------------------------------------------------------ */

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

function addsubStructure(rng, mixed) {
  var a = r2(ri(rng, 11, 99) / 10);
  var b = r2(ri(rng, 11, Math.max(12, Math.floor(a * 10) - 1)) / 10);
  var add = rng() < 0.5;
  if (mixed) {
    var c = r2(ri(rng, 11, 50) / 10);
    var ops = rng() < 0.5 ? ['+', '−'] : ['−', '+'];
    var v = ops[0] === '+' ? a + b : a - b;
    v = ops[1] === '+' ? v + c : v - c;
    return { expr: fmt(a) + ' ' + ops[0] + ' ' + fmt(b) + ' ' + ops[1] + ' ' + fmt(c), answer: fmt(r2(v)) };
  }
  return add
    ? { expr: fmt(a) + ' + ' + fmt(b), answer: fmt(r2(a + b)) }
    : { expr: fmt(a) + ' − ' + fmt(b), answer: fmt(r2(a - b)) };
}

function multStructure(rng) {
  if (rng() < 0.5) {
    var a = r2(ri(rng, 12, 88) / 10);
    var n = ri(rng, 2, 9);
    return { expr: fmt(a) + ' × ' + n, answer: fmt(r2(a * n)) };
  }
  var x = r1(ri(rng, 11, 35) / 10);
  var y = r1(ri(rng, 12, Math.max(13, Math.floor(x * 10) - 2)) / 10);
  return { expr: fmt(x) + ' × ' + fmt(y), answer: fmt(r2(x * y)) };
}

function divStructure(rng) {
  if (rng() < 0.5) {
    var b = ri(rng, 2, 9);
    var q = r2(ri(rng, 12, 84) / 10);
    var a = r2(b * q);
    return { expr: fmt(a) + ' ÷ ' + b, answer: fmt(q), explain: fmt(b) + ' × ' + fmt(q) + ' = ' + fmt(a) };
  }
  var d = r1(ri(rng, 12, 25) / 10);
  var q2 = ri(rng, 2, 8);
  var a2 = r2(d * q2);
  return { expr: fmt(a2) + ' ÷ ' + fmt(d), answer: String(q2), explain: fmt(d) + ' × ' + q2 + ' = ' + fmt(a2) };
}

/* ------------------------------------------------------------------ *
 * 概念结构（返回 {prompt, answer, options, story}）
 * ------------------------------------------------------------------ */

function conceptItem(sub, rng) {
  if (sub === 'compare') {
    var a = r1(ri(rng, 11, 88) / 10), b = r1(ri(rng, 11, 88) / 10);
    while (b === a) b = r1(ri(rng, 11, 88) / 10);
    var sign = a > b ? '>' : '<';
    return { stem: '比较大小：' + fmt(a) + ' ○ ' + fmt(b) + '（参考：' + fmt(Math.max(a, b)) + ' − ' + fmt(Math.min(a, b)) + ' = ' + fmt(r1(Math.abs(a - b))) + '），○ 里应填什么（>、< 或 =）？', answer: sign,
      options: ['>', '<', '='], support: fmt(Math.max(a, b)) + ' − ' + fmt(Math.min(a, b)) + ' = ' + fmt(r1(Math.abs(a - b))) };
  }
  if (sub === 'nature') {
    var base = r1(ri(rng, 12, 85) / 10);
    return { stem: '根据小数的性质，化简 ' + fmt(base) + '0 = ____', answer: fmt(base),
      options: [fmt(base), fmt(base) + '0', fmt(r1(base / 10))], support: fmt(base) + '0 − 0 = ' + fmt(base) + '0' };
  }
  if (sub === 'point-move') {
    var p = r2(ri(rng, 11, 99) / 100);
    var right = rng() < 0.5;
    return { expr: (right ? fmt(p) + ' × 10' : fmt(ri(rng, 11, 99) * 10) + ' ÷ 10'),
      answer: right ? fmt(r2(p * 10)) : fmt(r2(ri(rng, 11, 99) / 10)),
      stem: (right ? '小数点向右移动一位：' + fmt(p) + ' × 10 = ____' : '小数点向左移动一位：' + fmt(ri(rng, 11, 99)) + ' ÷ 10 = ____') };
  }
  if (sub === 'approx') {
    var x = r2(ri(rng, 105, 999) / 100);
    var one = r1(Math.round(x * 10) / 10);
    return { stem: fmt(x) + ' 保留一位小数 ≈ ____（参考：' + fmt(one) + ' + 0.0 = ' + fmt(one) + '）', answer: fmt(one),
      options: [fmt(one), fmt(Math.round(x)), fmt(r2(x + 0.1))] };
  }
  if (sub === 'unit') {
    var m = ri(rng, 2, 9), dm = m * 10;
    return { expr: m + ' × 10', answer: String(dm), stem: m + ' 米 = ' + m + ' × 10 = ____ 分米',
      options: [String(dm), String(m), String(dm * 10)] };
  }
  // readwrite / 意义：0.a 里面有几个 0.1
  var n = ri(rng, 2, 9);
  var dec = r1(n / 10);
  return { stem: fmt(dec) + ' 里面有 ____ 个 0.1（参考：' + n + ' ÷ 10 = ' + fmt(dec) + '）',
    answer: String(n), options: [String(n), String(dec), '10'] };
}

/* ------------------------------------------------------------------ *
 * 出题
 * ------------------------------------------------------------------ */

function buildQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = (plan.semanticParams && plan.semanticParams.name) || '小数';
  var sub = deriveSubtype(name);
  var qt = plan.questionTypeId;

  var prompt, answer, options = null, steps = 1;

  var calcSubs = { 'addsub': 1, 'addsub-mix': 1, 'mult': 1, 'mult-estimate': 1, 'div': 1, 'point-move': 1, 'unit': 1 };

  if (sub === 'word') {
    var inner = rng() < 0.5 ? addsubStructure(rng, false) : multStructure(rng);
    var goods = pick(rng, ['笔记本', '橡皮', '彩带', '布料']);
    prompt = '买' + goods + '一共花了 ' + inner.expr.replace(' ', '').replace(' ', '') + ' 元。列式计算 ' + inner.expr + ' = 多少元？';
    answer = inner.answer;
  } else if (calcSubs[sub]) {
    var st;
    if (sub === 'addsub' || sub === 'addsub-mix') st = addsubStructure(rng, sub === 'addsub-mix');
    else if (sub === 'div') st = divStructure(rng);
    else if (sub === 'point-move' || sub === 'unit') st = null;
    else st = multStructure(rng);
    if (st) {
      prompt = '列式计算：' + st.expr + ' = ？';
      answer = st.answer;
    } else {
      var c = conceptItem(sub, rng);
      prompt = '列式计算：' + c.stem;
      answer = c.answer; options = c.options;
    }
  } else {
    var item = conceptItem(sub, rng);
    prompt = item.stem;
    answer = item.answer; options = item.options;
  }

  // fill：把 ？/____ 归一为空位
  if (qt === 'fill') {
    prompt = prompt.replace(' = ？', ' = ____').replace('？', '____');
    if (!/____|\(\s*\)/.test(prompt)) prompt += ' ____';
  }

  var data = { mode: 'decimal', subType: sub, steps: steps };
  if (qt === 'choice') {
    var pool;
    if (options) {
      pool = options.map(String).slice(0, 4);
    } else if (!isNaN(Number(answer))) {
      var num = Number(answer);
      var cand = {};
      cand[String(num)] = 1;
      [r2(num + 0.1), r2(num - 0.1), r2(num + 1), r2(num - 1), r2(num + 0.2)].forEach(function (x) {
        if (x > 0) cand[fmt(x)] = 1;
      });
      pool = Object.keys(cand);
      while (pool.length < 4) pool.push(fmt(r2(num + pool.length + 0.3)));
      pool = pool.slice(0, 4);
    } else {
      pool = [String(answer), '都不是', '无法确定'];
    }
    var uniq = [], seen = {};
    pool.forEach(function (o) { o = String(o); if (!seen[o]) { seen[o] = 1; uniq.push(o); } });
    while (uniq.length < 4) uniq.push('以上都不对（' + uniq.length + '）');
    options = Rng.shuffle(rng, uniq.slice(0, 4));
    data.options = options;
    data.correctIndex = options.indexOf(String(answer));
    answer = String(answer);
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: qt,
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

function createDecimalGenerator(spec) {
  spec = spec || {};
  return {
    id: spec.id || 'generator:decimal-number',
    subject: 'math',
    capabilities: ['calc', 'fill', 'choice', 'apply'],
    questionTypes: ['calc', 'fill', 'choice', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return ['calc', 'fill', 'choice', 'apply'].indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = (plan && plan.count) || 1;
      var name = plan.semanticParams && plan.semanticParams.name;
      if (!name) return []; // fail-closed
      var out = [];
      for (var i = 0; i < count; i++) out.push(buildQuestion(plan, context, i));
      return SemanticEvidence.attachAll(VariationApply.applyToAll(out, plan), plan);
    }
  };
}

function buildAll() { return [createDecimalGenerator()]; }

module.exports = {
  deriveSubtype: deriveSubtype,
  createDecimalGenerator: createDecimalGenerator,
  buildAll: buildAll
};
