/**
 * plugins/math-g4-oral.js — 四年级口算插件
 *
 * 知识点覆盖（shared/knowledge-bank.js 四年级 M1 模块）：
 *   g4-oral-big   大数加减口算      （type: 'big-addsub'）
 *   g4-oral-mul3x1 三位数乘一位数口算（type: 'mul3x1'）
 *   g4-oral-mul2t  两位数乘整十数口算（type: 'mul2tens'）
 *   g4-oral-divt   除数是整十数的口算（type: 'div-tens'）
 *   g4-oral-dec    小数加减法口算    （type: 'dec-addsub'）
 *   g4-oral-law    运用运算律简便口算（type: 'law-oral'）
 *
 * 提供标准 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 供 practice.html / dev/plugin-check.html / math-comprehensive 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g4-oral.js 依赖 shared/common.js（PluginUtil），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  // 随机 100 的倍数：lo~hi 为「百」单位（返回 100~hi*100）
  function mul100(lo, hi) { return rnd(lo, hi) * 100; }

  // ============ 大数加减口算（万以内） ============
  function buildBigAddsub() {
    if (pick([1, 2]) === 1) {
      // 加法：整百 / 整千 / 千+百 / 两个三位数
      var kind = pick(['hh', 'kk', 'hk', 'dd']);
      var a, b;
      if (kind === 'hh') {
        a = mul100(1, 9);
        b = mul100(1, 90 - a / 100);
      } else if (kind === 'kk') {
        a = rnd(1, 8) * 1000;
        b = rnd(1, Math.floor((10000 - a) / 1000)) * 1000;
      } else if (kind === 'hk') {
        a = rnd(1, 8) * 1000;
        b = mul100(1, Math.floor((10000 - a) / 100));
      } else {
        a = rnd(100, 499);
        b = rnd(100, 499);
      }
      return { text: a + ' + ' + b + ' =', answer: a + b,
        hint: '口算整百整千数：先算数字部分，再补上相同个数的 0。' };
    }
    // 减法：整百 / 整千 / 千-百 / 两个三位数，保证差为正
    var kind2 = pick(['hh', 'kk', 'hk', 'dd']);
    var a2, b2;
    if (kind2 === 'hh') {
      a2 = mul100(2, 90);
      b2 = mul100(1, a2 / 100 - 1);
    } else if (kind2 === 'kk') {
      a2 = rnd(2, 9) * 1000;
      b2 = rnd(1, a2 / 1000 - 1) * 1000;
    } else if (kind2 === 'hk') {
      a2 = rnd(2, 9) * 1000;
      b2 = mul100(1, a2 / 100 - 1);
    } else {
      a2 = rnd(300, 900);
      b2 = rnd(100, a2 - 100);
    }
    return { text: a2 + ' − ' + b2 + ' =', answer: a2 - b2,
      hint: '口算减法：相同数位相减，从高位算起。' };
  }

  // ============ 三位数乘一位数口算 ============
  function buildMul3x1() {
    // 40% 整十（如 320×4），60% 一般三位数（如 234×3）
    var a = (pick([1, 2, 3]) === 1) ? rnd(10, 99) * 10 : rnd(100, 999);
    var f = rnd(2, 9);
    return { text: a + ' × ' + f + ' =', answer: a * f,
      hint: '把三位数拆成百、十、个位分别乘一位数，再相加。' };
  }

  // ============ 两位数乘整十数口算 ============
  function buildMul2tens() {
    var a = rnd(11, 99);
    var t = rnd(2, 9);
    var b = t * 10;
    return { text: a + ' × ' + b + ' =', answer: a * b,
      hint: '先算 a×t，再在结果末尾添一个 0。' };
  }

  // ============ 除数是整十数的口算 ============
  function buildDivTens() {
    var t = rnd(2, 9);
    var b = t * 10;
    var v = pick(['s', 'd', 'tens']);
    var q;
    if (v === 's') q = rnd(2, 9);          // 商是一位数
    else if (v === 'd') q = rnd(11, 49);   // 商是两位数
    else q = rnd(2, 9) * 10;               // 商是整十数
    var a = b * q;
    return { text: a + ' ÷ ' + b + ' =', answer: q,
      hint: '被除数与除数同时除以 10，再用乘法口诀求商。' };
  }

  // ============ 小数加减法口算（一位小数） ============
  function fmtDec(w, t) { return w + '.' + t; }
  function buildDecAddsub() {
    var aW = rnd(0, 6), aT = rnd(1, 9);
    var bW = rnd(0, 6), bT = rnd(1, 9);
    var a = aW * 10 + aT, b = bW * 10 + bT;
    if (pick([1, 2]) === 1) {
      var s = a + b;
      return { text: fmtDec(aW, aT) + ' + ' + fmtDec(bW, bT) + ' =',
        answer: (s / 10).toFixed(1),
        hint: '小数加法：小数点对齐，按整数加法从低位算起。' };
    }
    if (a < b) { // 保证被减数不小于减数
      var tw = aW; aW = bW; bW = tw;
      var tt = aT; aT = bT; bT = tt;
      a = aW * 10 + aT; b = bW * 10 + bT;
    }
    var d = a - b;
    return { text: fmtDec(aW, aT) + ' − ' + fmtDec(bW, bT) + ' =',
      answer: (d / 10).toFixed(1),
      hint: '小数减法：小数点对齐，不够减时向前一位借 1。' };
  }

  // ============ 运用运算律简便口算 ============
  function buildLawOral() {
    var v = pick(['25', '125', '99', '101']);
    if (v === '25') {
      var n = pick([4, 8, 12, 16, 24, 28, 32, 36, 40]);
      return { text: '25 × ' + n + ' =', answer: 25 * n,
        hint: '25×4=100，用乘法结合律凑整。' };
    }
    if (v === '125') {
      var n2 = pick([8, 16, 24, 32, 40, 48, 56, 64, 72, 80]);
      return { text: '125 × ' + n2 + ' =', answer: 125 * n2,
        hint: '125×8=1000，用乘法结合律凑整。' };
    }
    if (v === '99') {
      var n3 = rnd(2, 9);
      return { text: '99 × ' + n3 + ' =', answer: 99 * n3,
        hint: '99=100−1，用乘法分配律：100×n−n。' };
    }
    var n4 = rnd(2, 9);
    return { text: '101 × ' + n4 + ' =', answer: 101 * n4,
      hint: '101=100+1，用乘法分配律：100×n+n。' };
  }

  // ============ 综合口算（按知识点权重混合） ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 22) return buildBigAddsub();
    if (r <= 40) return buildMul3x1();
    if (r <= 55) return buildMul2tens();
    if (r <= 70) return buildDivTens();
    if (r <= 85) return buildDecAddsub();
    return buildLawOral();
  }

  var TYPE_BUILDERS = {
    'big-addsub': buildBigAddsub,
    'mul3x1': buildMul3x1,
    'mul2tens': buildMul2tens,
    'div-tens': buildDivTens,
    'dec-addsub': buildDecAddsub,
    'law-oral': buildLawOral,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'big-addsub': '大数加减',
    'mul3x1': '三位数乘一位数',
    'mul2tens': '两位数乘整十数',
    'div-tens': '除数是整十数',
    'dec-addsub': '小数加减',
    'law-oral': '运算律简便',
    mix: '综合口算'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g4-oral',
    moduleId: 'M1',
    name: '口算',
    pageTitle: '四年级口算练习',
    pageSubtitle: '大数加减、乘除口算、小数加减与简便运算',
    grades: [4],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },
    // 声明本插件覆盖的知识点（用于开发期覆盖校验与提示）
    knowledgePoints: ['g4-oral-big', 'g4-oral-mul3x1', 'g4-oral-mul2t', 'g4-oral-divt', 'g4-oral-dec', 'g4-oral-law'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',          label: '综合口算' },
          { value: 'big-addsub',   label: '大数加减' },
          { value: 'mul3x1',       label: '三位数乘一位数' },
          { value: 'mul2tens',     label: '两位数乘整十数' },
          { value: 'div-tens',     label: '除数是整十数' },
          { value: 'dec-addsub',   label: '小数加减法' },
          { value: 'law-oral',     label: '运算律简便' }
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
        title: '小学四年级口算练习（' + (TYPE_NAMES[type] || '综合口算') + '）'
      };
    }
  });

  // ============ 导出 ============
  global.__currentPlugin = plugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);