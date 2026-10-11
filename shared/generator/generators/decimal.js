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

function nrOf(plan) {
  return (plan && plan.constraints && plan.constraints.numberRange) || { min: 1, max: 20 };
}
function riC(rng, lo, hi, nr) {
  var min = Math.max(lo, nr.min);
  var max = Math.min(hi, nr.max);
  if (min > max) { min = lo; max = hi; }
  return min + Math.floor(rng() * (max - min + 1));
}

function addsubStructure(rng, nr, mixed) {
  var a = r2(riC(rng, 11, 99, nr) / 10);
  var b = r2(riC(rng, 11, Math.max(12, Math.floor(a * 10) - 1), nr) / 10);
  var add = rng() < 0.5;
  if (mixed) {
    var c = r2(riC(rng, 11, 50, nr) / 10);
    var ops = rng() < 0.5 ? ['+', '−'] : ['−', '+'];
    var v = ops[0] === '+' ? a + b : a - b;
    v = ops[1] === '+' ? v + c : v - c;
    return { expr: fmt(a) + ' ' + ops[0] + ' ' + fmt(b) + ' ' + ops[1] + ' ' + fmt(c), answer: fmt(r2(v)) };
  }
  return add
    ? { expr: fmt(a) + ' + ' + fmt(b), answer: fmt(r2(a + b)) }
    : { expr: fmt(a) + ' − ' + fmt(b), answer: fmt(r2(a - b)) };
}

function multStructure(rng, nr) {
  if (rng() < 0.5) {
    var a = r2(riC(rng, 12, 88, nr) / 10);
    var n = riC(rng, 2, 9, nr);
    return { expr: fmt(a) + ' × ' + n, answer: fmt(r2(a * n)) };
  }
  var x = r1(riC(rng, 11, 35, nr) / 10);
  var y = r1(riC(rng, 12, Math.max(13, Math.floor(x * 10) - 2), nr) / 10);
  return { expr: fmt(x) + ' × ' + fmt(y), answer: fmt(r2(x * y)) };
}

function divStructure(rng, nr) {
  if (rng() < 0.5) {
    var b = riC(rng, 2, 9, nr);
    var q = r2(riC(rng, 12, 84, nr) / 10);
    var a = r2(b * q);
    return { expr: fmt(a) + ' ÷ ' + b, answer: fmt(q), explain: fmt(b) + ' × ' + fmt(q) + ' = ' + fmt(a) };
  }
  var d = r1(riC(rng, 12, 25, nr) / 10);
  var q2 = riC(rng, 2, 8, nr);
  var a2 = r2(d * q2);
  return { expr: fmt(a2) + ' ÷ ' + fmt(d), answer: String(q2), explain: fmt(d) + ' × ' + q2 + ' = ' + fmt(a2) };
}

/* ------------------------------------------------------------------ *
 * P30-GEN-06（P30-16）：子类型 × 题型 Assessment Target 真分工
 *
 * 同一小数概念在四种题型上承担不同训练目标（KBL 概念/运算受限派生，非随机换壳）：
 *   calc   —— 列式计算（直接求值，算式在场）
 *   fill   —— 形式转换/逆推填空（空位承担结构性子目标，如 小数↔分数、小数点移动填倍数）
 *   choice —— 表征/关系辨析（选项是不同表征或不同算式，不是同值 ±0.1）
 *   apply  —— 真实情境迁移（米/分米/元/角/商品/身高）
 *
 * 题型集仍为 calc/fill/choice/apply（C 类小数 KP 的 ALLOW 集，未扩题型）。
 * ------------------------------------------------------------------ */

var GOODS = ['笔记本', '橡皮', '彩带', '布料'];
var MEASURE_TAILS = { add: ['米', '元'], sub: ['元', '千克'] };

function numOpt(rng, correct, pool) {
  var uniq = {}, out = [];
  uniq[String(correct)] = 1; out.push(String(correct));
  for (var k = 0; k < pool.length && out.length < 4; k++) {
    var v = pool[k];
    if (v == null) continue;
    var s = fmt(v);
    if (!uniq[s] && Number(s) > 0) { uniq[s] = 1; out.push(s); }
  }
  var guard = 0;
  while (out.length < 4 && guard++ < 30) out.push(fmt(r2(Number(correct) + 0.1 * (out.length + 1))));
  return Rng.shuffle(rng, out.slice(0, 4));
}

// 受限算式求值（仅支持小数与 + − × ÷，先乘除后加减；用于校验干扰项得数不与正确答案相撞）
function evalExpr(s) {
  var tokens = String(s).match(/[\d.]+|[+\-−×÷]/g);
  if (!tokens) return null;
  var vals = [], ops = [], i, t;
  function prec(o) { return (o === '×' || o === '÷') ? 2 : 1; }
  function calc(x, o, y) {
    if (o === '+') return x + y;
    if (o === '−' || o === '-') return x - y;
    if (o === '×' || o === 'x' || o === '*') return x * y;
    if (o === '÷' || o === '/') return x / y;
    return null;
  }
  for (i = 0; i < tokens.length; i++) {
    t = tokens[i];
    if (/[\d.]/.test(t)) {
      vals.push(Number(t));
    } else {
      while (ops.length && prec(ops[ops.length - 1]) >= prec(t)) {
        var y = vals.pop(), x = vals.pop(), o = ops.pop(), v = calc(x, o, y);
        if (v == null) return null;
        vals.push(v);
      }
      ops.push(t);
    }
  }
  while (ops.length) {
    var y2 = vals.pop(), x2 = vals.pop(), o2 = ops.pop(), v2 = calc(x2, o2, y2);
    if (v2 == null) return null;
    vals.push(v2);
  }
  return vals.length === 1 ? r4(vals[0]) : null;
}

// 算式结构（addsub/addsub-mix/mult/div/mult-estimate）的四题型真分工
// P34-14：讲解按题型承担的子目标给依据——calc 给算法、fill 给各部分关系、
// choice 指向正确算式项、apply 给情境运算意义；素材全部来自本题已生成的 expr/answer。
var ARITH_REASON = {
  '+': '一个加数 = 和 − 另一个加数',
  '×': '一个因数 = 积 ÷ 另一个因数'
};
function arithmeticTyped(sub, qt, rng, nr) {
  var st;
  if (sub === 'div') st = divStructure(rng, nr);
  else if (sub === 'addsub-mix') st = addsubStructure(rng, nr, true);
  else st = (sub === 'addsub') ? addsubStructure(rng, nr, false) : multStructure(rng, nr);
  var expr = st.expr, answer = st.answer;
  var nums = expr.match(/[\d.]+/g);
  var mOp = (/÷/.test(expr)) ? '÷' : (/×/.test(expr)) ? '×' : (/−/.test(expr)) ? '−' : '+';
  var correctVal = evalExpr(expr);

  if (qt === 'calc') {
    var calcExpl;
    if (sub === 'addsub-mix') calcExpl = '按从左到右的顺序计算：' + expr + ' = ' + answer;
    else if (mOp === '×') calcExpl = '小数乘法先按整数乘法算出积，再点上小数点：' + expr + ' = ' + answer;
    else if (mOp === '÷') calcExpl = '想乘法算除法：' + st.explain + '，所以 ' + expr + ' = ' + answer;
    else calcExpl = '小数点对齐，按整数加减法计算：' + expr + ' = ' + answer;
    return { prompt: '列式计算：' + expr + ' = ？', answer: answer, options: null, explain: calcExpl };
  }

  if (qt === 'fill') {
    // 逆推填空：已知得数与一个操作数，填另一个操作数（未知数位置子目标）
    var parts = /^([\d.]+)\s*([+\-−×÷])\s*([\d.]+)$/.exec(expr);
    if (parts) {
      var a = parts[1], op = parts[2], b = parts[3];
      var blankFirst = rng() < 0.5;
      var blankVal = blankFirst ? a : b;
      var reason;
      if (op === '+') reason = ARITH_REASON['+'];
      else if (op === '×') reason = ARITH_REASON['×'];
      else if (op === '−') reason = blankFirst ? '被减数 = 减数 + 差' : '减数 = 被减数 − 差';
      else reason = blankFirst ? '被除数 = 除数 × 商' : '除数 = 被除数 ÷ 商';
      var fillExpl = reason + '；由 ' + a + ' ' + op + ' ' + b + ' = ' + answer
        + ' 可知空格填 ' + blankVal + '。';
      if (blankFirst) return { prompt: '在 ____ 里填上合适的数：____ ' + op + ' ' + b + ' = ' + answer, answer: a, options: null, explain: fillExpl };
      return { prompt: '在 ____ 里填上合适的数：' + a + ' ' + op + ' ____ = ' + answer, answer: b, options: null, explain: fillExpl };
    }
    return { prompt: '在 ____ 里填上合适的数：' + expr + ' = ____', answer: answer, options: null,
      explain: '按从左到右的顺序计算：' + expr + ' = ' + answer + '，空格填 ' + answer + '。' };
  }

  if (qt === 'choice') {
    // 关系辨析：四个算式中找得数等于给定值的那个；干扰项替换首操作数并经求值去重
    var seenExpr = {}, optsArr = [expr];
    seenExpr[expr] = 1;
    var deltas = [1, -1, 2, 0.1, -0.1, 3];
    for (var k = 0; k < deltas.length && optsArr.length < 4; k++) {
      var nv = r4(Number(nums[0]) + deltas[k]);
      if (nv <= 0) continue;
      var cand = fmt(nv) + ' ' + expr.slice(String(nums[0]).length).replace(/^\s*/, '');
      if (seenExpr[cand]) continue;
      var cv = evalExpr(cand);
      if (cv == null || (correctVal != null && r4(Math.abs(cv - correctVal)) < 0.001)) continue;
      seenExpr[cand] = 1;
      optsArr.push(cand);
    }
    var guard = 0;
    while (optsArr.length < 4 && guard++ < 50) {
      var rv = r2(Number(nums[0]) + (guard % 2 === 0 ? guard : -guard) * 0.7);
      if (rv <= 0) continue;
      var cand2 = fmt(rv) + ' ' + expr.slice(String(nums[0]).length).replace(/^\s*/, '');
      if (!seenExpr[cand2]) { seenExpr[cand2] = 1; optsArr.push(cand2); }
    }
    return { prompt: '下面哪个算式的得数是 ' + answer + '？（  ）', answer: expr, options: Rng.shuffle(rng, optsArr.slice(0, 4)),
      explain: '把四个选项分别计算，只有「' + expr + '」的得数是 ' + answer + '。' };
  }

  // apply：真实情境迁移（小数数量须可连续计量：乘价用「每米彩带 × 米数」，不用「买 2.3 本」）
  var goods = pick(rng, GOODS);
  var story, storyWhy;
  if (nums.length === 3) {
    story = '文具店盘点：上午营业额 ' + nums[0] + ' 元，中午变化 ' + nums[1] + ' 元，下午变化 ' + nums[2] + ' 元，列式求现在的营业额';
    storyWhy = '根据营业额的三次变化按顺序列式';
  } else if (mOp === '×') {
    story = '彩带每米 ' + nums[1] + ' 元，买 ' + nums[0] + ' 米，列式求一共要付多少元';
    storyWhy = '单价 × 数量 = 总价，用乘法';
  } else if (mOp === '÷') {
    story = '把 ' + nums[0] + ' 米长的彩带平均分成 ' + nums[1] + ' 段，列式求每段长多少米';
    storyWhy = '把总长平均分，求每段长用除法';
  } else if (mOp === '−') {
    story = '买' + goods + '付 ' + nums[0] + ' 元，找回 ' + nums[1] + ' 元，列式求' + goods + '多少元';
    storyWhy = '付出的钱减去找回的钱等于商品价格，用减法';
  } else {
    story = '买' + goods + '用去 ' + nums[0] + ' 元，又买一支笔用去 ' + nums[1] + ' 元，列式求一共花了多少元';
    storyWhy = '把两部分钱合起来求总数，用加法';
  }
  return { prompt: story + '：' + expr + ' = ？', answer: answer, options: null,
    explain: storyWhy + '：' + expr + ' = ' + answer + '。' };
}

// 乘法估算（mult-estimate）的四题型真分工：把一位小数估成最接近的整数再乘
function estimateTyped(qt, rng, nr) {
  var tx = riC(rng, 22, 88, nr);
  while (tx % 10 === 0) tx = riC(rng, 22, 88, nr); // 十分位非零，保证 exact ≠ est（选项不撞）
  var x = r1(tx / 10);                        // 2.2–8.8 的一位小数，nearest≥2
  var nearest = Math.round(x);
  var n = riC(rng, 2, 9, nr);
  var est = nearest * n;
  var exact = r2(x * n);
  var estWhy = '把 ' + fmt(x) + ' 看成最接近的整数 ' + nearest + '，' + nearest + ' × ' + n + ' = ' + est;
  if (qt === 'calc') {
    return { prompt: '估算（先把 ' + fmt(x) + ' 看成最接近的整数，再列式）：' + fmt(x) + ' × ' + n + ' ≈ ？', answer: String(est), options: null,
      explain: estWhy + '。' };
  }
  if (qt === 'fill') {
    return { prompt: '估算填空：把 ' + fmt(x) + ' 看成最接近的整数，____ × ' + n + ' ≈ ' + est, answer: String(nearest), options: null,
      explain: estWhy + '，所以空格填 ' + nearest + '。' };
  }
  if (qt === 'choice') {
    var optsE = Rng.shuffle(rng, [String(est), fmt(exact), String((nearest + 1) * n), String((nearest - 1) * n)]);
    return { prompt: '估算 ' + fmt(x) + ' × ' + n + '，下面哪个得数最合理？（  ）', answer: String(est), options: optsE,
      explain: estWhy + '，正确选项是「' + est + '」。' };
  }
  return { prompt: '彩带每米 ' + fmt(x) + ' 元，买 ' + n + ' 米，先估成整数再算，大约要带多少元？', answer: String(est), options: null,
    explain: '估算带的钱要够用：' + estWhy + '（元）。' };
}

// 概念子类型的四题型真分工
function conceptTyped(sub, qt, rng, nr) {
  if (sub === 'readwrite') {
    var n = riC(rng, 2, 9, nr), dec = r1(n / 10);
    if (qt === 'calc') return { prompt: '列式（十分之几就是零点几）：' + n + '/10 = ？', answer: fmt(dec), options: null,
      explain: '十分之几就是零点几：' + n + '/10 = ' + fmt(dec) + '。' };
    if (qt === 'fill') return { prompt: fmt(dec) + ' 写成分数是 ____/10（填分子）', answer: String(n), options: null,
      explain: fmt(dec) + ' 表示十分之' + n + '，写成分数是 ' + n + '/10，所以分子填 ' + n + '。' };
    if (qt === 'choice') {
      var opts = numOpt(rng, fmt(dec), [r1((n === 9 ? 8 : n + 1) / 10), r1(Math.max(1, n - 1) / 10), r1(n / 100), n]);
      return { prompt: '下面哪个小数表示 ' + n + '/10 ？（  ）', answer: fmt(dec), options: opts,
        explain: '十分之几就是零点几，' + n + '/10 = ' + fmt(dec) + '，正确选项是「' + fmt(dec) + '」。' };
    }
    return { prompt: '把 1 米平均分成 10 份，取其中 ' + n + ' 份，这 ' + n + ' 份一共长多少米？', answer: fmt(dec), options: null,
      explain: '1 米平均分成 10 份，每份是 0.1 米；取 ' + n + ' 份就是 ' + n + '/10 米 = ' + fmt(dec) + ' 米。' };
  }

  if (sub === 'nature') {
    var base = r1(riC(rng, 12, 85, nr) / 10);
    var full = base.toFixed(1) + '0';   // 2.0 → '2.00'，不能用 '2'+'0'（会变成 20）
    var natureWhy = '小数的末尾添上 0 或去掉 0，小数的大小不变，' + full + ' = ' + fmt(base);
    if (qt === 'calc') return { prompt: '根据小数的性质化简，列式：' + full + ' − 0 = ？', answer: fmt(base), options: null,
      explain: natureWhy + '，所以 ' + full + ' − 0 = ' + fmt(base) + '。' };
    if (qt === 'fill') return { prompt: '小数的性质：在 ____ 里填上合适的数，' + full + ' = ____', answer: fmt(base), options: null,
      explain: natureWhy + '，所以空格填 ' + fmt(base) + '。' };
    if (qt === 'choice') {
      var opts2 = numOpt(rng, fmt(base), [fmt(r1(base / 10)), String(Math.round(base * 10)), fmt(r1(base + 1))]);
      return { prompt: '下面各数中，与 ' + full + ' 大小相等的是？（  ）', answer: fmt(base), options: opts2,
        explain: natureWhy + '，正确选项是「' + fmt(base) + '」。' };
    }
    return { prompt: '一块橡皮标价 ' + full + ' 元，根据小数的性质去掉末尾不影响大小的零，它可以写成多少元？', answer: fmt(base), options: null,
      explain: natureWhy + '，所以可以写成 ' + fmt(base) + ' 元。' };
  }

  if (sub === 'approx') {
    var x = r2(riC(rng, 105, 999, nr) / 100);
    var one = r1(Math.round(x * 10) / 10);
    if (qt === 'calc') {
      // 算式在场：先求两个两位小数之和，再用四舍五入法保留一位小数（得数是近似数）
      var u = r2(riC(rng, 105, 499, nr) / 100), v2 = r2(riC(rng, 105, 499, nr) / 100);
      var raw = r2(u + v2), rounded = r1(Math.round(raw * 10) / 10), guardAp = 0;
      while (fmt(raw) === fmt(rounded) && guardAp++ < 20) {
        v2 = r2(riC(rng, 105, 499, nr) / 100); raw = r2(u + v2); rounded = r1(Math.round(raw * 10) / 10);
      }
      return { prompt: '列式计算（得数用四舍五入法保留一位小数）：' + fmt(u) + ' + ' + fmt(v2) + ' = ？', answer: fmt(rounded), options: null,
        explain: '先算 ' + fmt(u) + ' + ' + fmt(v2) + ' = ' + fmt(raw) + '，再用四舍五入法保留一位小数，约是 ' + fmt(rounded) + '。' };
    }
    if (qt === 'fill') return { prompt: '一个两位小数保留一位小数后是 ' + fmt(one) + '，这个两位小数可能是 ____（写出一个即可）', answer: fmt(x), options: null,
      explain: fmt(x) + ' 的百分位四舍五入后保留一位小数约是 ' + fmt(one) + '，所以可填 ' + fmt(x) + '（答案不唯一）。' };
    if (qt === 'choice') {
      // 干扰项保留一位小数后必须是不同的近似值（one±0.1/0.2），避免出现第二个正确选项
      var opts3 = Rng.shuffle(rng, [fmt(x), fmt(r2(one + 0.12)), fmt(r2(one - 0.08)), fmt(r1(one + 0.2))]);
      return { prompt: '下面哪个数保留一位小数约是 ' + fmt(one) + ' ？（  ）', answer: fmt(x), options: opts3,
        explain: fmt(x) + ' 用四舍五入法保留一位小数约是 ' + fmt(one) + '，正确选项是「' + fmt(x) + '」。' };
    }
    return { prompt: '小华量得身高 ' + fmt(x) + ' 米，保留一位小数，他的身高大约是多少米？', answer: fmt(one), options: null,
      explain: fmt(x) + ' 米用四舍五入法保留一位小数，大约是 ' + fmt(one) + ' 米。' };
  }

  if (sub === 'point-move') {
    var p = r2(riC(rng, 11, 99, nr) / 100);
    var right = rng() < 0.5;
    if (right) {
      var after = r2(p * 10);
      if (qt === 'calc') return { prompt: '列式计算（小数点向右移动一位）：' + fmt(p) + ' × 10 = ？', answer: fmt(after), options: null,
        explain: '小数点向右移动一位，原数扩大到原来的 10 倍：' + fmt(p) + ' × 10 = ' + fmt(after) + '。' };
      if (qt === 'fill') return { prompt: '小数点向右移动一位，在 ____ 里填数：' + fmt(p) + ' × ____ = ' + fmt(after), answer: '10', options: null,
        explain: '小数点向右移动一位就是乘 10：' + fmt(p) + ' × 10 = ' + fmt(after) + '，所以填 10。' };
      if (qt === 'choice') {
        var opts4 = numOpt(rng, fmt(after), [fmt(r2(p * 100)), fmt(r2(p)), fmt(r2(p + 1))]);
        return { prompt: '把 ' + fmt(p) + ' 扩大到原来的 10 倍，得到多少？（  ）', answer: fmt(after), options: opts4,
          explain: '扩大到原来的 10 倍，小数点向右移动一位：' + fmt(p) + ' × 10 = ' + fmt(after)
            + '，正确选项是「' + fmt(after) + '」。' };
      }
      return { prompt: '1 米 = 10 分米，' + fmt(p) + ' 米是多少分米？', answer: fmt(after), options: null,
        explain: '1 米 = 10 分米，' + fmt(p) + ' 米 = ' + fmt(p) + ' × 10 = ' + fmt(after) + ' 分米。' };
    }
    var xi = riC(rng, 11, 99, nr);
    var afterL = r1(xi / 10);
    if (qt === 'calc') return { prompt: '列式计算（小数点向左移动一位）：' + xi + ' ÷ 10 = ？', answer: fmt(afterL), options: null,
      explain: '小数点向左移动一位，原数缩小到原来的 1/10：' + xi + ' ÷ 10 = ' + fmt(afterL) + '。' };
    if (qt === 'fill') return { prompt: '小数点向左移动一位，在 ____ 里填数：' + xi + ' ÷ ____ = ' + fmt(afterL), answer: '10', options: null,
      explain: '小数点向左移动一位就是除以 10：' + xi + ' ÷ 10 = ' + fmt(afterL) + '，所以填 10。' };
    if (qt === 'choice') {
      var opts5 = numOpt(rng, fmt(afterL), [fmt(r1(xi / 100)), String(xi), fmt(r1(xi / 10 + 1))]);
      return { prompt: '把 ' + xi + ' 缩小到原来的 1/10，得到多少？（  ）', answer: fmt(afterL), options: opts5,
        explain: '缩小到原来的 1/10，小数点向左移动一位：' + xi + ' ÷ 10 = ' + fmt(afterL)
          + '，正确选项是「' + fmt(afterL) + '」。' };
    }
    return { prompt: '计算器上显示 ' + xi + '，把这个数缩小到原来的十分之一，屏幕上变成多少？', answer: fmt(afterL), options: null,
      explain: '缩小到原来的十分之一，小数点向左移动一位：' + xi + ' ÷ 10 = ' + fmt(afterL) + '。' };
  }

  if (sub === 'unit') {
    var m = riC(rng, 2, 9, nr), dm = m * 10;
    var unitWhy = '1 米 = 10 分米，' + m + ' 米 = ' + m + ' × 10 = ' + dm + ' 分米';
    if (qt === 'calc') return { prompt: '列式换算：' + m + ' × 10 = ？（分米）', answer: String(dm), options: null,
      explain: unitWhy + '，所以得数是 ' + dm + '。' };
    if (qt === 'fill') return { prompt: '在 ____ 里填上合适的数：' + m + ' 米 = ____ 分米', answer: String(dm), options: null,
      explain: unitWhy + '，所以空格填 ' + dm + '。' };
    if (qt === 'choice') {
      var opts6 = numOpt(rng, String(dm), [String(m), String(dm * 10), String(dm + 10), String(dm - 10)]);
      return { prompt: m + ' 米等于多少分米？（  ）', answer: String(dm), options: opts6,
        explain: unitWhy + '，正确选项是「' + dm + '」。' };
    }
    return { prompt: '做一条彩带用布 ' + m + ' 米，合多少分米？', answer: String(dm), options: null,
      explain: unitWhy + '。' };
  }

  // compare：比较大小（calc 求差比较 / fill 填符号 / choice 比较式辨析 / apply 跳远情境）
  var a = r1(riC(rng, 11, 88, nr) / 10), b = r1(riC(rng, 11, 88, nr) / 10);
  while (b === a) b = r1(riC(rng, 11, 88, nr) / 10);
  var sign = a > b ? '>' : '<';
  var hi = fmt(Math.max(a, b)), lo = fmt(Math.min(a, b)), diff = fmt(r1(Math.abs(a - b)));
  if (qt === 'calc') return { prompt: '列式比一比：' + hi + ' − ' + lo + ' = ？（差大于 0，说明前者大）', answer: diff, options: null,
    explain: hi + ' − ' + lo + ' = ' + diff + '，差大于 0，说明 ' + hi + ' > ' + lo + '。' };
  if (qt === 'fill') return { prompt: '比较大小，在 ____ 里填上合适的符号（>、< 或 =）：' + fmt(a) + ' ____ ' + fmt(b), answer: sign, options: null,
    explain: '比较小数大小，从高位到低位逐位比较：' + fmt(a) + ' ' + sign + ' ' + fmt(b) + '，所以填 ' + sign + '。' };
  if (qt === 'choice') {
    // 比较式辨析：四个大小关系中只有一个成立
    var opp = sign === '>' ? '<' : '>';
    var correct = fmt(a) + ' ' + sign + ' ' + fmt(b);
    var opts7 = Rng.shuffle(rng, [
      correct,
      fmt(a) + ' ' + opp + ' ' + fmt(b),
      fmt(a) + ' = ' + fmt(b),
      fmt(b) + ' ' + sign + ' ' + fmt(a)
    ]);
    return { prompt: '下面大小关系正确的是？（  ）', answer: correct, options: opts7,
      explain: '从高位到低位逐位比较两个小数，' + fmt(a) + ' ' + sign + ' ' + fmt(b)
        + ' 成立，正确选项是「' + correct + '」。' };
  }
  var ming = sign === '>' ? '小明' : '小红';
  return { prompt: '跳远比赛，小明跳了 ' + fmt(a) + ' 米，小红跳了 ' + fmt(b) + ' 米，谁跳得更远？', answer: ming, options: null,
    explain: '比较两个成绩：' + fmt(a) + ' ' + sign + ' ' + fmt(b) + '，' + ming + '跳得更远。' };
}

/* ------------------------------------------------------------------ *
 * 出题
 * ------------------------------------------------------------------ */

function buildQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = (plan.semanticParams && plan.semanticParams.name) || '小数';
  var sub = deriveSubtype(name);
  var qt = plan.questionTypeId;
  var nr = nrOf(plan);

  var arithmeticSubs = { 'addsub': 1, 'addsub-mix': 1, 'mult': 1, 'div': 1, 'word': 1 };
  var typed = sub === 'mult-estimate' ? estimateTyped(qt, rng, nr)
    : arithmeticSubs[sub] ? arithmeticTyped(sub === 'word' ? 'mult' : sub, qt, rng, nr)
    : conceptTyped(sub, qt, rng, nr);

  var prompt = typed.prompt;
  var answer = typed.answer;
  var options = typed.options || null;

  var data = { mode: 'decimal', subType: sub, steps: 1 };
  if (qt === 'choice' && options) {
    data.options = options;
    data.correctIndex = options.map(String).indexOf(String(answer));
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [], explanation: typed.explain || null },
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
