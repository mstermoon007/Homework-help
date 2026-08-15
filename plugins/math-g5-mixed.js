/**
 * plugins/math-g5-mixed.js — 五年级脱式计算插件
 *
 * 知识点覆盖（shared/knowledge-bank.js 五年级 M3 模块）：
 *   g5-mix-decmixed  小数四则混合运算      （type: 'dec-mixed'）
 *   g5-mix-fracmixed 分数加减混合运算      （type: 'frac-mixed'）
 *   g5-mix-decsimple 运算律推广到小数简便计算（type: 'dec-simple'）
 *   g5-mix-fracsimple 运算律推广到分数简便计算（type: 'frac-simple'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g5-mixed.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  // 一位小数构造：整数(0~99)/10，输出一位小数
  function d1(x) { return (x / 10); }
  function dStr(x) { return String(Number(x.toFixed(2))); }

  // ============ 小数四则混合运算 ============
  function buildDecMixed() {
    var v = pick(['md', 'mdadd', 'br', 'three']);
    var expr, ans, hint;
    if (v === 'md') {
      // 乘除混合：选 c 整除 a*b（a、b 一位小数）
      var a = rnd(2, 9), b = rnd(2, 9);
      var ab = a * b;
      if (pick([1, 2]) === 1) {
        var ds = [2, 3, 4, 5, 6, 7, 8, 9].filter(function (x) { return ab % x === 0; });
        var c = pick(ds);
        ans = ab / c / 100;
        expr = dStr(a / 10) + ' × ' + dStr(b / 10) + ' ÷ ' + c;
        hint = '先算 ' + dStr(a / 10) + '×' + dStr(b / 10) + '=' + dStr(ab / 100) + '，再÷' + c + '。';
      } else {
        var c2 = rnd(2, 9);
        ans = ab * c2 / 100;
        expr = dStr(a / 10) + ' × ' + dStr(b / 10) + ' × ' + c2;
        hint = '连乘：' + dStr(a / 10) + '×' + dStr(b / 10) + '=' + dStr(ab / 100) + '，再×' + c2 + '。';
      }
      return { q: expr, answer: dStr(ans), hint: hint };
    }
    if (v === 'mdadd') {
      // 乘 + 加（减）
      var m = rnd(2, 9), n = rnd(2, 9);
      var p = d1(rnd(1, 9));
      var prod2 = m * n / 100;
      var isAdd = pick([1, 2]) === 1;
      if (isAdd) { ans = prod2 + p; }
      else { ans = prod2 - p; if (ans < 0) { isAdd = true; ans = prod2 + p; } }
      expr = dStr(m / 10) + ' × ' + dStr(n / 10) + (isAdd ? ' + ' : ' − ') + dStr(p);
      hint = '先算 ' + dStr(m / 10) + '×' + dStr(n / 10) + '=' + dStr(prod2) + '，再' + (isAdd ? '加' : '减') + dStr(p) + '。';
      return { q: expr, answer: dStr(ans), hint: hint };
    }
    if (v === 'br') {
      // (a + b) × c，a、b 一位小数
      var a1 = d1(rnd(2, 9)), b1 = d1(rnd(2, 9));
      var c1 = rnd(2, 9);
      var inner1 = a1 + b1;
      ans = inner1 * c1;
      expr = '(' + dStr(a1) + ' + ' + dStr(b1) + ') × ' + c1;
      hint = '先算括号内 ' + dStr(a1) + '+' + dStr(b1) + '=' + dStr(inner1) + '，再×' + c1 + '。';
      return { q: expr, answer: dStr(ans), hint: hint };
    }
    // 三步：a×b÷c ± e，c 整除 a*b
    var a3 = rnd(2, 9), b3 = rnd(2, 9);
    var ab3 = a3 * b3;
    var ds3 = [2, 3, 4, 5, 6, 7, 8, 9].filter(function (x) { return ab3 % x === 0; });
    var c3 = pick(ds3);
    var mid3 = ab3 / c3 / 100;
    var e = d1(rnd(1, 9));
    var isAdd3 = pick([1, 2]) === 1;
    var ans3 = isAdd3 ? mid3 + e : mid3 - e;
    if (!isAdd3 && ans3 < 0) { ans3 = mid3 + e; isAdd3 = true; }
    expr = dStr(a3 / 10) + ' × ' + dStr(b3 / 10) + ' ÷ ' + c3 + (isAdd3 ? ' + ' : ' − ') + dStr(e);
    hint = '先乘除：' + dStr(a3 / 10) + '×' + dStr(b3 / 10) + '÷' + c3 + '=' + dStr(mid3) + '，再' + (isAdd3 ? '加' : '减') + dStr(e) + '。';
    return { q: expr, answer: dStr(ans3), hint: hint };
  }

  // ============ 分数加减混合运算 ============
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function reduce(n, d) { var g = gcd(Math.abs(n), d); return [n / g, d / g]; }
  function fs(n, d) { return n + '/' + d; }
  function buildFracMixed() {
    var v = pick(['chain', 'br']);
    var d = pick([3, 4, 5, 6, 8, 10, 12]);
    if (v === 'chain') {
      // a/d ± b/d ± c/d（结果真分数或整数）
      var a = rnd(1, d - 1), b = rnd(1, d - 1);
      var op1 = pick(['+', '−']);
      var op2 = pick(['+', '−']);
      var n1 = op1 === '+' ? a + b : a - b;
      var n2 = op2 === '+' ? n1 + rnd(1, d - 1) : n1 - rnd(1, d - 1);
      if (n2 <= 0 || n2 >= d * 3) return buildFracMixed();
      var r = reduce(n2, d);
      var q = fs(a, d) + ' ' + op1 + ' ' + fs(b, d) + ' ' + op2 + ' ' + fs(rnd(1, d - 1), d);
      var ans = r[1] === 1 ? String(r[0]) : fs(r[0], r[1]);
      if (n2 >= d) {
        var whole = Math.floor(n2 / d), rem = n2 % d;
        ans = rem === 0 ? String(whole) : whole + '又' + fs(reduce(rem, d)[0], reduce(rem, d)[1]);
      }
      return { q: q, answer: ans, hint: '同分母分数连加减：分母不变，分子按顺序相加减，能约分要约分。' };
    }
    // 带括号：d 为公分母，(a/d + b/d) − c/d
    var a2 = rnd(1, d - 1), b2 = rnd(1, d - 1), c2 = rnd(1, d - 1);
    var inner = a2 + b2;
    var total = inner - c2;
    if (total <= 0) return buildFracMixed();
    var q2 = '(' + fs(a2, d) + ' + ' + fs(b2, d) + ') − ' + fs(c2, d);
    if (total >= d) {
      var w = Math.floor(total / d), rm = total % d;
      var ans2 = rm === 0 ? String(w) : w + '又' + fs(reduce(rm, d)[0], reduce(rm, d)[1]);
      return { q: q2, answer: ans2, hint: '先算括号内（同分母相加），再减去括号外的分数。' };
    }
    var r2 = reduce(total, d);
    return { q: q2, answer: r2[1] === 1 ? String(r2[0]) : fs(r2[0], r2[1]), hint: '先算括号内（同分母相加），再算减法。' };
  }

  // ============ 运算律推广到小数简便计算 ============
  function buildDecSimple() {
    var v = pick(['add', 'mul', 'dist']);
    if (v === 'add') {
      // 交换律凑整：0.x + n + 0.(10-x)
      var x = rnd(1, 9);
      var a = x / 10, b = (10 - x) / 10;
      var c = rnd(2, 9);
      var order = pick([0, 1]) === 0 ? a + ' + ' + c + ' + ' + b : a + ' + ' + b + ' + ' + c;
      return { q: order, answer: dStr(a + b + c), hint: '简便计算：先算 ' + dStr(a) + ' + ' + dStr(b) + ' = 1（凑整），再加 ' + c + '。' };
    }
    if (v === 'mul') {
      // 25×4、125×8 推广：2.5×4、1.25×8
      var pair = pick(['2.5', '1.25', '0.25', '12.5']);
      var partner = pair === '2.5' ? 4 : pair === '1.25' ? 8 : pair === '0.25' ? 4 : 8;
      var rest = rnd(3, 9);
      var nums = [pair, String(partner), String(rest)];
      // 打乱顺序
      nums.sort(function () { return rnd(0, 1) - 0.5; });
      return { q: nums.join(' × '), answer: dStr(Number(pair) * partner * rest), hint: '简便计算：' + pair + '×' + partner + '=' + dStr(Number(pair) * partner) + '，再×' + rest + '。' };
    }
    // 分配律：a × (b + c)，a 一位小数
    var a = d1(rnd(2, 9));
    var b = rnd(2, 9), c = rnd(2, 9);
    return { q: dStr(a) + ' × (' + b + ' + ' + c + ')', answer: dStr(a * (b + c)), hint: '简便计算：用乘法分配律 ' + dStr(a) + '×' + b + ' + ' + dStr(a) + '×' + c + '。' };
  }

  // ============ 运算律推广到分数简便计算 ============
  function buildFracSimple() {
    var v = pick(['add', 'mul']);
    if (v === 'add') {
      // 交换律：a/d + n + (d-a)/d 凑成整数
      var d = pick([3, 4, 5, 6, 8, 10]);
      var a = rnd(1, d - 1);
      var n = rnd(2, 5);
      var ord = pick([0, 1]) === 0 ? fs(a, d) + ' + ' + n + ' + ' + fs(d - a, d) : fs(a, d) + ' + ' + fs(d - a, d) + ' + ' + n;
      return { q: ord, answer: String(n + 1), hint: '简便计算：先算 ' + fs(a, d) + ' + ' + fs(d - a, d) + ' = 1，再加 ' + n + '。' };
    }
    // 乘法分配律：a/b × (c + d)
    var d2 = pick([2, 3, 4, 5, 6]);
    var a2 = rnd(1, d2 - 1);
    var c2 = rnd(2, 6), d3 = rnd(2, 6);
    var inner = c2 + d3;
    var n2 = a2 * inner, dd = d2;
    var r = reduce(n2, dd);
    var ans = r[1] === 1 ? String(r[0]) : fs(r[0], r[1]);
    return { q: fs(a2, d2) + ' × (' + c2 + ' + ' + d3 + ')', answer: ans, hint: '简便计算：用乘法分配律 ' + fs(a2, d2) + '×' + c2 + ' + ' + fs(a2, d2) + '×' + d3 + '。' };
  }

  // ============ 综合脱式 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 30) return buildDecMixed();
    if (r <= 55) return buildFracMixed();
    if (r <= 78) return buildDecSimple();
    return buildFracSimple();
  }

  var TYPE_BUILDERS = {
    'dec-mixed': buildDecMixed,
    'frac-mixed': buildFracMixed,
    'dec-simple': buildDecSimple,
    'frac-simple': buildFracSimple,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'dec-mixed': '小数四则混合',
    'frac-mixed': '分数加减混合',
    'dec-simple': '小数简便计算',
    'frac-simple': '分数简便计算',
    mix: '综合脱式'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g5-mixed',
    moduleId: 'M3',
    name: '脱式计算',
    pageTitle: '五年级脱式计算',
    pageSubtitle: '小数与分数混合、简便运算',
    grades: [5],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['g5-mix-decmixed', 'g5-mix-fracmixed', 'g5-mix-decsimple', 'g5-mix-fracsimple'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',          label: '综合脱式' },
          { value: 'dec-mixed',    label: '小数四则混合' },
          { value: 'frac-mixed',   label: '分数加减混合' },
          { value: 'dec-simple',   label: '小数简便计算' },
          { value: 'frac-simple',  label: '分数简便计算' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 40, 300);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        if (!seen[p.q]) { seen[p.q] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return { type: 'mixed', q: p.q, answer: String(p.answer), hint: p.hint, inputType: 'text' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学五年级脱式计算（' + (TYPE_NAMES[type] || '综合脱式') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);