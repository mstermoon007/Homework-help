/**
 * plugins/math-g5-oral.js — 五年级口算插件
 *
 * 知识点覆盖（shared/knowledge-bank.js 五年级 M1 模块）：
 *   g5-m1-g5-oral-decmul   小数乘法口算       （type: 'dec-mul-oral'）
 *   g5-m1-g5-oral-decdiv   小数除法口算       （type: 'dec-div-oral'）
 *   g5-m1-g5-oral-fracadd  同分母分数加减口算（type: 'frac-addsub-oral'）
 *   g5-m1-g5-oral-equ      简易方程口算       （type: 'equation-oral'）
 *   g5-m1-g5-oral-fm       因数倍数特征判断   （type: 'factor-multiple'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g5-oral.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  // ============ 小数乘法口算 ============
  function buildDecMul() {
    // 一位小数×整数 / 整数×一位小数 / 一位小数×一位小数 / 整十整百×小数
    var v = pick(['i', 'ii', 'tens', 'zero']);
    var a, b, ans;
    if (v === 'i') {
      a = rnd(1, 9) / 10; b = rnd(2, 99);
      ans = (a * b);
    } else if (v === 'ii') {
      a = rnd(1, 9) / 10; b = rnd(1, 9) / 10;
      ans = (a * b);
    } else if (v === 'tens') {
      a = rnd(2, 9) * 10; b = rnd(1, 9) / 10;
      ans = (a * b);
    } else {
      a = rnd(2, 9) * 100; b = rnd(1, 9) / 10;
      ans = (a * b);
    }
    var as = trimDec(a), bs = trimDec(b);
    return { text: as + ' × ' + bs + ' =', answer: trimDec(ans),
      hint: '小数乘法：先按整数乘，再数因数小数位数，点上小数点。' };
  }

  function trimDec(x) {
    var s = String(Number(x.toFixed(2)));
    return s;
  }

  // ============ 小数除法口算 ============
  function buildDecDiv() {
    // 除数是一位小数的除法，商是整数/一位小数；被除数=除数×商构造
    var v = pick(['int', 'dec']);
    var divisor = rnd(2, 9) / 10;
    var q = v === 'int' ? rnd(2, 9) : rnd(1, 9) / 10;
    var dividend = divisor * q;
    return { text: trimDec(dividend) + ' ÷ ' + trimDec(divisor) + ' =', answer: trimDec(q),
      hint: '小数除法：把除数变成整数，被除数同时扩大相同倍数再除。' };
  }

  // ============ 同分母分数加减口算 ============
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function fracStr(n, d) { return n + '/' + d; }
  function buildFracAddsub() {
    var d = pick([3, 4, 5, 6, 8, 10, 12]);
    var a = rnd(1, d - 1), b = rnd(1, d - 1);
    if (pick([1, 2]) === 1) {
      var sn = a + b, sd = d;
      if (sn >= sd) { // 化带分数或整数
        if (sn % sd === 0) return { text: fracStr(a, d) + ' + ' + fracStr(b, d) + ' =', answer: String(sn / sd), hint: '同分母相加，分母不变分子相加，能约分要约分，分子≥分母化成整数或带分数。' };
        var whole = Math.floor(sn / sd), rem = sn % sd;
        return { text: fracStr(a, d) + ' + ' + fracStr(b, d) + ' =', answer: whole + '又' + fracStr(rem, sd), hint: '同分母相加，分母不变分子相加，化成带分数。' };
      }
      return { text: fracStr(a, d) + ' + ' + fracStr(b, d) + ' =', answer: fracStr(sn, sd), hint: '同分母分数相加，分母不变，分子相加。' };
    }
    if (a < b) { var t = a; a = b; b = t; }
    var dn = a - b;
    if (dn === 0) return { text: fracStr(a, d) + ' − ' + fracStr(b, d) + ' =', answer: '0', hint: '同分母分数相减，分母不变，分子相减，结果等于 0。' };
    return { text: fracStr(a, d) + ' − ' + fracStr(b, d) + ' =', answer: fracStr(dn, d), hint: '同分母分数相减，分母不变，分子相减。' };
  }

  // ============ 简易方程口算 ============
  function buildEquation() {
    var v = pick(['add', 'sub', 'mul', 'div']);
    var x, ans;
    if (v === 'add') {
      x = rnd(2, 9); var b = rnd(2, 20); ans = x + b;
      return { text: 'x + ' + b + ' = ' + ans + '，x =', answer: String(x), hint: '等式两边同时减 b，x = 和 − b。' };
    }
    if (v === 'sub') {
      var b2 = rnd(2, 20); x = b2 + rnd(1, 20); ans = x - b2;
      return { text: 'x − ' + b2 + ' = ' + ans + '，x =', answer: String(x), hint: '等式两边同时加 b2，x = 差 + b2。' };
    }
    if (v === 'mul') {
      x = rnd(2, 9); var b3 = rnd(2, 9); ans = x * b3;
      return { text: b3 + 'x = ' + ans + '，x =', answer: String(x), hint: '等式两边同时除以 b3，x = 积 ÷ b3。' };
    }
    x = rnd(2, 9); var b4 = rnd(2, 9); ans = x * b4;
    return { text: 'x ÷ ' + b4 + ' = ' + x + '，x =', answer: String(ans), hint: '等式两边同时乘 b4，x = 商 × b4。' };
  }

  // ============ 因数倍数特征快速判断 ============
  function buildFactorMultiple() {
    var v = pick(['even', '3', '5', '9', '10']);
    var n, q, ans;
    if (v === 'even') {
      n = rnd(10, 99) * 2; q = '偶数'; ans = n % 2 === 0 ? '是' : '不是';
      return { text: n + ' 是 ' + q + '吗？', answer: ans, hint: '个位是 0、2、4、6、8 的数是 2 的倍数（偶数）。' };
    }
    if (v === '3') {
      n = rnd(11, 99) * 3; q = '3 的倍数'; ans = n % 3 === 0 ? '是' : '不是';
      return { text: n + ' 是 ' + q + '吗？', answer: ans, hint: '各位数字之和能被 3 整除，这个数就是 3 的倍数。' };
    }
    if (v === '5') {
      n = rnd(11, 99) * 5; q = '5 的倍数'; ans = n % 5 === 0 ? '是' : '不是';
      return { text: n + ' 是 ' + q + '吗？', answer: ans, hint: '个位是 0 或 5 的数是 5 的倍数。' };
    }
    if (v === '9') {
      n = rnd(11, 99) * 9; q = '9 的倍数'; ans = n % 9 === 0 ? '是' : '不是';
      return { text: n + ' 是 ' + q + '吗？', answer: ans, hint: '各位数字之和能被 9 整除，这个数就是 9 的倍数。' };
    }
    n = rnd(11, 99) * 10; q = '10 的倍数'; ans = n % 10 === 0 ? '是' : '不是';
    return { text: n + ' 是 ' + q + '吗？', answer: ans, hint: '个位是 0 的数是 10 的倍数。' };
  }

  // ============ 综合口算 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 22) return buildDecMul();
    if (r <= 42) return buildDecDiv();
    if (r <= 62) return buildFracAddsub();
    if (r <= 82) return buildEquation();
    return buildFactorMultiple();
  }

  var TYPE_BUILDERS = {
    'dec-mul-oral': buildDecMul,
    'dec-div-oral': buildDecDiv,
    'frac-addsub-oral': buildFracAddsub,
    'equation-oral': buildEquation,
    'factor-multiple': buildFactorMultiple,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'dec-mul-oral': '小数乘法口算',
    'dec-div-oral': '小数除法口算',
    'frac-addsub-oral': '同分母分数加减',
    'equation-oral': '简易方程口算',
    'factor-multiple': '因数倍数判断',
    mix: '综合口算'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g5-oral',
    moduleId: 'M1',
    name: '口算',
    pageSubtitle: '小数乘除、分数加减、简易方程与因数倍数',
    grades: [5],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'g5-m1-g5-oral-decmul',
        'g5-m1-g5-oral-decdiv',
        'g5-m1-g5-oral-fracadd',
        'g5-m1-g5-oral-equ',
        'g5-m1-g5-oral-fm'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',              label: '综合口算' },
          { value: 'dec-mul-oral',     label: '小数乘法口算' },
          { value: 'dec-div-oral',     label: '小数除法口算' },
          { value: 'frac-addsub-oral', label: '同分母分数加减' },
          { value: 'equation-oral',    label: '简易方程口算' },
          { value: 'factor-multiple',  label: '因数倍数判断' }
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
        title: '小学五年级口算练习（' + (TYPE_NAMES[type] || '综合口算') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);