/**
 * plugins/math-g6-oral.js — 六年级口算插件（M1 分数乘除法口算）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M1 模块）：
 *   g6-m1-g6-oral-frac-mult-int   分数乘整数          （type: 'frac-mult-int'）
 *   g6-m1-g6-oral-frac-mult-frac  分数乘分数          （type: 'frac-mult-frac'）
 *   g6-m1-g6-oral-frac-div-int    分数除以整数        （type: 'frac-div-int'）
 *   g6-m1-g6-oral-frac-div-frac   一个数除以分数      （type: 'frac-div-frac'）
 *   g6-m1-g6-oral-dec-perc        小数与百分数互化    （type: 'dec-perc'）
 *   g6-m1-g6-oral-ratio-simp      求比值与化简比      （type: 'ratio-simp'）
 *   g6-m1-g6-oral-neg-add-sub     负数加减            （type: 'neg-add-sub'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-oral.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function reduce(n, d) { var g = gcd(Math.abs(n), d); return [n / g, d / g]; }
  function fs(n, d) { return n + '/' + d; }
  function fracAns(n, d) {
    var r = reduce(n, d);
    if (r[1] === 1) return String(r[0]);
    return fs(r[0], r[1]);
  }
  function trimD(x) { return String(Number(x.toFixed(3))); }

  // ============ 分数乘整数 ============
  function buildFracMultInt() {
    var d = pick([3, 4, 5, 6, 8, 10]);
    var a = rnd(1, d - 1);
    var cs = [];
    for (var c = 2; c <= 5; c++) if (a * c <= d) cs.push(c);
    var c2 = cs.length ? pick(cs) : 1;
    var ans = fracAns(a * c2, d);
    return { text: fs(a, d) + ' × ' + c2 + ' =', answer: ans, hint: '分数乘整数：用分子乘整数作分子，分母不变，能约分要约分。' };
  }

  // ============ 分数乘分数 ============
  function buildFracMultFrac() {
    var d = pick([2, 3, 4, 5, 6, 8]);
    var a = rnd(1, d - 1);
    var d2 = pick([2, 3, 4, 5, 6, 8]);
    var a2 = rnd(1, d2 - 1);
    var r = reduce(a * a2, d * d2);
    return { text: fs(a, d) + ' × ' + fs(a2, d2) + ' =', answer: r[1] === 1 ? String(r[0]) : fs(r[0], r[1]), hint: '分数乘分数：分子相乘作分子，分母相乘作分母，能约分要约分。' };
  }

  // ============ 分数除以整数 ============
  function buildFracDivInt() {
    var d = pick([3, 4, 5, 6, 8, 10]);
    var a = rnd(1, d - 1);
    var c = rnd(2, 9);
    return { text: fs(a, d) + ' ÷ ' + c + ' =', answer: fracAns(a, d * c), hint: '分数除以整数：等于乘这个整数的倒数，能约分要约分。' };
  }

  // ============ 一个数除以分数 ============
  function buildFracDivFrac() {
    var v = pick(['frac', 'int']);
    if (v === 'frac') {
      var d = pick([2, 3, 4, 5, 6, 8]);
      var a = rnd(1, d - 1);
      var d2 = pick([2, 3, 4, 5]);
      var a2 = rnd(1, d2 - 1);
      var r = reduce(a * d2, d * a2);
      return { text: fs(a, d) + ' ÷ ' + fs(a2, d2) + ' =', answer: r[1] === 1 ? String(r[0]) : fs(r[0], r[1]), hint: '除以一个分数等于乘这个分数的倒数。' };
    }
    var c = rnd(2, 9);
    var d2 = pick([2, 3, 4, 5]);
    var a2 = rnd(1, d2 - 1);
    return { text: c + ' ÷ ' + fs(a2, d2) + ' =', answer: fracAns(c * d2, a2), hint: '整数除以分数：等于乘这个分数的倒数。' };
  }

  // ============ 小数与百分数互化 ============
  function buildDecPerc() {
    var v = pick(['toPct', 'toDec']);
    if (v === 'toPct') {
      var tenths = pick([5, 15, 25, 30, 45, 55, 60, 75, 80, 85, 90, 95]);
      var dec = tenths / 100;
      return { text: trimD(dec) + ' =（  ）%', answer: String(tenths) + '%', hint: '小数化成百分数：小数点向右移动两位，添上百分号。' };
    }
    var p = pick([5, 10, 15, 20, 25, 40, 50, 60, 75, 80]);
    return { text: p + '% =（填小数）', answer: trimD(p / 100), hint: '百分数化成小数：去掉百分号，小数点向左移动两位。' };
  }

  // ============ 求比值与化简比 ============
  function buildRatioSimp() {
    var v = pick(['simplify', 'value']);
    if (v === 'simplify') {
      var x = rnd(2, 7), y = rnd(2, 7);
      while (gcd(x, y) !== 1) y = rnd(2, 7);
      var k = rnd(2, 4);
      return { text: (x * k) + ' : ' + (y * k) + '，化成最简整数比 =', answer: x + ':' + y, hint: '比的前项和后项同时除以最大公因数 ' + k + '。' };
    }
    var b = rnd(2, 9), q = rnd(2, 9);
    return { text: (q * b) + ' : ' + b + '，求比值 =', answer: String(q), hint: '比值 = 前项 ÷ 后项 = ' + (q * b) + ' ÷ ' + b + '。' };
  }

  // ============ 负数加减 ============
  function buildNegAddSub() {
    var v = pick(['add', 'sub']);
    if (v === 'add') {
      var a = rnd(2, 9), b = rnd(1, 9);
      var ans = b - a;
      return { text: '−' + a + ' + ' + b + ' =', answer: String(ans), hint: '异号两数相加：取绝对值较大的数的符号，再用较大的绝对值减去较小的绝对值。' };
    }
    var a2 = rnd(1, 9), b2 = rnd(1, 9);
    return { text: '−' + a2 + ' − ' + b2 + ' =', answer: String(-(a2 + b2)), hint: '减去一个数等于加上它的相反数：−' + a2 + ' + (−' + b2 + ')，两个负数相加，把它们的绝对值加起来，结果取负号。' };
  }

  // ============ 综合口算 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 18) return buildFracMultInt();
    if (r <= 36) return buildFracMultFrac();
    if (r <= 52) return buildFracDivInt();
    if (r <= 70) return buildFracDivFrac();
    if (r <= 84) return buildDecPerc();
    if (r <= 94) return buildRatioSimp();
    return buildNegAddSub();
  }

  var TYPE_BUILDERS = {
    'frac-mult-int': buildFracMultInt,
    'frac-mult-frac': buildFracMultFrac,
    'frac-div-int': buildFracDivInt,
    'frac-div-frac': buildFracDivFrac,
    'dec-perc': buildDecPerc,
    'ratio-simp': buildRatioSimp,
    'neg-add-sub': buildNegAddSub,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'frac-mult-int': '分数乘整数',
    'frac-mult-frac': '分数乘分数',
    'frac-div-int': '分数除以整数',
    'frac-div-frac': '一个数除以分数',
    'dec-perc': '小数与百分数互化',
    'ratio-simp': '求比值与化简比',
    'neg-add-sub': '负数加减',
    mix: '综合口算'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-oral',
    moduleId: 'M1',
    name: '口算',
    pageSubtitle: '分数乘除法、小数与百分数互化、比与负数',
    grades: [6],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'g6-m1-g6-oral-frac-mult-int',
        'g6-m1-g6-oral-frac-mult-frac',
        'g6-m1-g6-oral-frac-div-int',
        'g6-m1-g6-oral-frac-div-frac',
        'g6-m1-g6-oral-dec-perc',
        'g6-m1-g6-oral-ratio-simp',
        'g6-m1-g6-oral-neg-add-sub'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',            label: '综合口算' },
          { value: 'frac-mult-int',  label: '分数乘整数' },
          { value: 'frac-mult-frac', label: '分数乘分数' },
          { value: 'frac-div-int',   label: '分数除以整数' },
          { value: 'frac-div-frac',  label: '一个数除以分数' },
          { value: 'dec-perc',       label: '小数与百分数互化' },
          { value: 'ratio-simp',     label: '求比值与化简比' },
          { value: 'neg-add-sub',    label: '负数加减' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 60, 400);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        if (!seen[p.text]) { seen[p.text] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return { type: 'oral', q: p.text, answer: String(p.answer), hint: p.hint, inputType: 'text' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学六年级口算练习（' + (TYPE_NAMES[type] || '综合口算') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);