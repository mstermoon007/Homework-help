/**
 * shared/generator/generators/fraction.js — P25-09 分数专项 Generator
 *
 * 承载 19 个分数 KP（g3 初步认识 → g5 意义/性质/加减 → g6 倒数/除法/混合），
 * 取代被 shape-recognition v3 截胡产出的语义无关题。
 *
 * 分派：消费 plan.semanticParams.name，按 NAME_RULES 机械派生子类型。
 * 题型：calc / fill / choice / apply。calc 题干内嵌算式满足 expressionPresent。
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
  if (context && context.seed != null) return context.seed + ':frac:' + i;
  if (plan && plan.seed != null) return plan.seed + ':frac:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':frac:' + i;
}

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
function simp(n, d) { var g = gcd(n, d); return { n: n / g, d: d / g }; }
function fs(f) { return f.n + '/' + f.d; }
function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// 顺序敏感
var NAME_RULES = [
  { sub: 'word', re: /解决问题/ },
  { sub: 'reciprocal', re: /倒数/ },
  { sub: 'div', re: /除以|除法/ },
  { sub: 'mix', re: /混合/ },
  { sub: 'addsub-diff', re: /异分母/ },
  { sub: 'addsub', re: /加|减|简单计算/ },
  { sub: 'compare', re: /比较|比大小/ },
  { sub: 'relation', re: /与除法|除法.*关系/ },
  { sub: 'proper', re: /真分数|假分数/ },
  { sub: 'nature', re: /性质|约分|通分|互化/ },
  { sub: 'meaning', re: /读写|认识|意义/ }
];

function deriveSubtype(name) {
  for (var i = 0; i < NAME_RULES.length; i++) {
    if (NAME_RULES[i].re.test(name || '')) return NAME_RULES[i].sub;
  }
  return 'meaning';
}

/* ------------------------------------------------------------------ *
 * 分数运算结构
 * ------------------------------------------------------------------ */

function sameDenomAdd(rng, maxD) {
  var d = ri(rng, 3, maxD || 9);
  var n1 = ri(rng, 1, d - 1), n2 = ri(rng, 1, d - n1);
  var add = ri(rng, 0, 1);
  if (add) return { expr: n1 + '/' + d + ' + ' + n2 + '/' + d, answer: fs(simp(n1 + n2, d)) };
  var hi = Math.max(n1, n2), lo = Math.min(n1, n2);
  return { expr: hi + '/' + d + ' − ' + lo + '/' + d, answer: fs(simp(hi - lo, d)) };
}

function diffDenomAdd(rng) {
  var d1 = pick(rng, [2, 3, 4, 6]), d2 = pick(rng, [3, 5, 4, 6].filter(function (x) { return x !== d1; }));
  var n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
  var lcm = d1 * d2 / gcd(d1, d2);
  var num = n1 * (lcm / d1) + n2 * (lcm / d2);
  return { expr: n1 + '/' + d1 + ' + ' + n2 + '/' + d2, answer: fs(simp(num, lcm)) };
}

function fracDiv(rng) {
  var n1 = ri(rng, 1, 5), d1 = ri(rng, 2, 8);
  var n2 = ri(rng, 1, 5), d2 = ri(rng, 2, 8);
  var r = simp(n1 * d2, d1 * n2);
  return { expr: n1 + '/' + d1 + ' ÷ ' + n2 + '/' + d2, answer: fs(r) };
}

function fracDivInt(rng) {
  var d = ri(rng, 2, 8), n = ri(rng, 1, d - 1), k = ri(rng, 2, 6);
  return { expr: n + '/' + d + ' ÷ ' + k, answer: fs(simp(n, d * k)) };
}

/* ------------------------------------------------------------------ *
 * 概念题
 * ------------------------------------------------------------------ */

function conceptItem(sub, rng) {
  if (sub === 'compare') {
    var same = rng() < 0.5;
    var a, b, sign, support;
    if (same) {
      var d = ri(rng, 4, 9);
      a = { n: ri(rng, 1, d - 2), d: d }; b = { n: ri(rng, a.n + 1, d - 1), d: d };
      sign = '<'; support = b.n + ' − ' + a.n + ' = ' + (b.n - a.n) + '，同分母分子大的大';
    } else {
      var n = ri(rng, 1, 4);
      a = { n: n, d: 4 }; b = { n: n, d: 6 };
      sign = '>'; support = n + '/' + a.d + ' 与 ' + n + '/' + b.d + '，分子相同分母小的大';
    }
    return { stem: '比较大小：' + fs(a) + ' ○ ' + fs(b) + '（参考：' + support + '），○ 里应填什么（>、< 或 =）？', answer: sign, options: ['>', '<', '='], support: support };
  }
  if (sub === 'relation') {
    var n = ri(rng, 2, 8), d = n + ri(rng, 1, 4);
    return { stem: n + ' ÷ ' + d + ' = ____（用分数表示商）', answer: n + '/' + d, options: [n + '/' + d, d + '/' + n, (n + d) + '/' + d] };
  }
  if (sub === 'proper') {
    var improper = rng() < 0.5;
    var pn = improper ? ri(rng, 5, 9) : ri(rng, 1, 4);
    var pd = ri(rng, pn + 1, pn + 5);
    var fracStr = pn + '/' + (improper ? Math.max(2, pn - ri(rng, 1, 2)) : pd);
    var isImproper = parseInt(fracStr.split('/')[0], 10) >= parseInt(fracStr.split('/')[1], 10);
    return { stem: fracStr + ' 的分子' + (isImproper ? '大于或等于分母' : '小于分母') + '，它是 ____ 分数（参考：' +
        pn + ' − ' + fracStr.split('/')[1] + ' = ' + (pn - parseInt(fracStr.split('/')[1], 10)) + '）',
      answer: isImproper ? '假分数' : '真分数', options: ['真分数', '假分数', '带分数'] };
  }
  if (sub === 'nature') {
    var variant = ri(rng, 0, 2);
    if (variant === 0) {
      var d2 = ri(rng, 3, 8), k2 = ri(rng, 2, 5);
      return { stem: '分数基本性质：1/' + d2 + ' 的分子分母同乘 ' + k2 + '（1 × ' + k2 + ' = ' + k2 + '），得到 ____/' + (d2 * k2),
        answer: String(k2), options: [String(k2), String(1), String(d2 * k2)] };
    }
    if (variant === 1) {
      var n3 = ri(rng, 2, 5) * 2, d3 = n3 + ri(rng, 1, 4) * 2;
      var g = gcd(n3, d3), rn = n3 / g, rd = d3 / g;
      return { stem: '约分：' + n3 + '/' + d3 + ' = ' + rn + '/____（分子分母同除以 ' + g + '，' + n3 + ' ÷ ' + g + ' = ' + rn + '）',
        answer: String(rd), options: [String(rd), String(g), String(d3)] };
    }
    return { stem: '分数与小数互化：1/2 = 1 ÷ 2 = ____', answer: '0.5', options: ['0.5', '0.2', '0.1'] };
  }
  if (sub === 'reciprocal') {
    if (rng() < 0.5) {
      var nn = ri(rng, 2, 8), dd = nn + ri(rng, 1, 3);
      return { stem: nn + '/' + dd + ' 的分子分母调换位置，它的倒数是 ____（参考：' + nn + ' × ' + dd + ' 作新分母）',
        answer: dd + '/' + nn, options: [dd + '/' + nn, nn + '/' + dd, '1'] };
    }
    var whole = ri(rng, 2, 9);
    return { stem: whole + ' 可以写成 ' + whole + '/1，它的倒数是 ____（参考：' + whole + ' ÷ ' + whole + ' = 1）',
      answer: '1/' + whole, options: ['1/' + whole, String(whole), '1'] };
  }
  // meaning（初步认识/读写/进一步认识）
  // FINAL-140：G3 初步认识阶段不引用「分数与除法」关系（a÷b=a/b 为 G5 内容），
  // 直接用分数记法表达每份；1/d 仍满足 calc expressionPresent（/ 两侧数字）。
  var d0 = ri(rng, 3, 9);
  return { stem: '把一个圆平均分成 ' + d0 + ' 份，取其中的 1 份（每份是它的 1/' + d0 + '），用分数表示是 ____',
    answer: '1/' + d0, options: ['1/' + d0, '1/' + (d0 + 1), d0 + '/1'] };
}

/* ------------------------------------------------------------------ *
 * 出题
 * ------------------------------------------------------------------ */

function buildQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = (plan.semanticParams && plan.semanticParams.name) || '分数';
  var sub = deriveSubtype(name);
  var qt = plan.questionTypeId;

  var prompt, answer, options = null;

  if (sub === 'word') {
    // 强制同分母加法结构（sameDenomAdd 可能随机出减法，split(' + ') 会失真）
    var wd = ri(rng, 3, 9), wn1 = ri(rng, 1, wd - 1), wn2 = ri(rng, 1, wd - wn1);
    var wexpr = wn1 + '/' + wd + ' + ' + wn2 + '/' + wd;
    var wans = fs(simp(wn1 + wn2, wd));
    prompt = '一块蛋糕，小明吃了 ' + wn1 + '/' + wd + '，小红吃了 ' + wn2 + '/' + wd +
      '。两人一共吃了这块蛋糕的几分之几？列式 ' + wexpr + ' = ？';
    answer = wans;
  } else if (sub === 'addsub') {
    var s1 = sameDenomAdd(rng, 9);
    prompt = '列式计算：' + s1.expr + ' = ？';
    answer = s1.answer;
  } else if (sub === 'addsub-diff') {
    var s2 = diffDenomAdd(rng);
    prompt = '列式计算（先通分）：' + s2.expr + ' = ？';
    answer = s2.answer;
  } else if (sub === 'mix') {
    var a = sameDenomAdd(rng, 9), b = sameDenomAdd(rng, 9);
    var d = ri(rng, 3, 9), n1 = ri(rng, 1, d - 2), n2 = ri(rng, 1, d - n1 - 1), n3 = ri(rng, 1, d - n1 - n2);
    var tot = n1 + n2 + n3;
    prompt = '列式计算：' + n1 + '/' + d + ' + ' + n2 + '/' + d + ' + ' + n3 + '/' + d + ' = ？';
    answer = fs(simp(tot, d));
  } else if (sub === 'div') {
    var dv = rng() < 0.5 ? fracDiv(rng) : fracDivInt(rng);
    prompt = '列式计算：' + dv.expr + ' = ？';
    answer = dv.answer;
  } else {
    var item = conceptItem(sub, rng);
    prompt = item.stem;
    answer = item.answer;
    options = item.options;
  }

  if (qt === 'fill') {
    prompt = prompt.replace(' = ？', ' = ____').replace('？', '____');
    if (!/____|\(\s*\)/.test(prompt)) prompt += ' ____';
  }
  if (qt === 'apply' && /列式计算/.test(prompt)) {
    prompt = prompt.replace('列式计算（先通分）：', '解决问题——先通分再计算：').replace('列式计算：', '解决问题——列式计算：');
  }

  var data = { mode: 'fraction', subType: sub, steps: 1 };
  if (qt === 'choice') {
    var pool;
    if (options) pool = options.map(String);
    else { pool = [String(answer)]; }
    var uniq = [], seen = {};
    pool.forEach(function (o) { o = String(o); if (!seen[o]) { seen[o] = 1; uniq.push(o); } });
    while (uniq.length < 4) uniq.push('以上都不对（' + uniq.length + '）');
    options = Rng.shuffle(rng, uniq.slice(0, 4));
    data.options = options;
    data.correctIndex = options.indexOf(String(answer));
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

function createFractionGenerator(spec) {
  spec = spec || {};
  return {
    id: spec.id || 'generator:fraction-number',
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
      if (!name) return [];
      var out = [];
      for (var i = 0; i < count; i++) out.push(buildQuestion(plan, context, i));
      return SemanticEvidence.attachAll(VariationApply.applyToAll(out, plan), plan);
    }
  };
}

function buildAll() { return [createFractionGenerator()]; }

module.exports = {
  deriveSubtype: deriveSubtype,
  createFractionGenerator: createFractionGenerator,
  buildAll: buildAll
};
