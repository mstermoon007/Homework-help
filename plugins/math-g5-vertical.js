/**
 * plugins/math-g5-vertical.js — 五年级竖式计算插件
 *
 * 知识点覆盖（shared/knowledge-bank.js 五年级 M2 模块）：
 *   g5-m2-g5-v-decmul    小数乘法竖式       （type: 'dec-mul-vertical'）
 *   g5-m2-g5-v-divint    除数是整数的小数除法（type: 'dec-div-int'）
 *   g5-m2-g5-v-ddivdec   除数是小数的小数除法（type: 'dec-div-dec'）
 *   g5-m2-g5-v-repeating 循环小数竖式表示   （type: 'repeating-dec'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g5-vertical.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  // ============ 竖式渲染辅助（与四年级一致） ============
  function vnum(s) {
    return '<span style="display:inline-block;min-width:84px;text-align:right;font-family:Menlo,Consolas,monospace;font-size:16px;font-weight:800;color:var(--ink);padding:1px 6px;">' + s + '</span>';
  }
  function vop(s) {
    return '<span style="display:inline-block;width:20px;text-align:right;font-weight:800;color:var(--ink);">' + (s || '&nbsp;') + '</span>';
  }
  var vline = '<div style="border-top:2px solid var(--ink);margin:2px 0 6px;width:122px;"></div>';

  function singleInp(idx) {
    return '<input type="text" data-index="' + idx + '" placeholder="?" autocomplete="off" style="width:104px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:16px;font-weight:700;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;">';
  }

  function cardHTML(idx, inner) {
    return '<div class="question-card" data-index="' + idx + '" style="border:1px solid var(--line);border-radius:14px;padding:14px 0.5cm;position:relative;background:var(--card);box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<div class="q-header" style="display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:6px;">' +
      '<span class="num" style="flex:0 0 auto;width:22px;height:22px;border-radius:50%;background:var(--brand-bg);color:var(--brand-d);font-weight:800;font-size:12px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;flex-shrink:0;">' + (idx + 1) + '</span>' +
      '&nbsp;&nbsp;&nbsp;&nbsp;' +
      '<span class="q-text" style="font-size:12px;color:var(--muted);font-weight:700;display:inline;vertical-align:middle;">用竖式计算</span>' +
      '</div>' +
      inner +
      '<div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:8px;"></div>' +
      '</div>';
  }

  // 乘法竖式
  function renderMul(idx, a, b) {
    var inner =
      '<div>' + vop('') + vnum(String(a)) + '</div>' +
      '<div>' + vop('×') + vnum(String(b)) + '</div>' +
      '<div style="padding-left:20px;">' + vline + '</div>' +
      '<div style="padding-left:20px;">' + singleInp(idx) + '</div>';
    return cardHTML(idx, inner);
  }

  // 除法竖式（商为单空输入）
  function renderDiv(idx, divisor, dividend) {
    var inner =
      '<table style="border-collapse:collapse;font-family:Menlo,Consolas,monospace;margin:2px 0 0 8px;">' +
      '<tr><td style="width:52px;"></td><td style="width:16px;"></td><td style="text-align:left;">' + singleInp(idx) + '</td></tr>' +
      '<tr>' +
      '<td style="text-align:right;font-size:16px;font-weight:800;color:var(--ink);padding:2px 0;">' + divisor + '</td>' +
      '<td style="border-top:2px solid var(--ink);border-left:2px solid var(--ink);height:14px;"></td>' +
      '<td style="text-align:right;font-size:16px;font-weight:800;color:var(--ink);padding:2px 4px;">' + dividend + '</td>' +
      '</tr>' +
      '</table>';
    return cardHTML(idx, inner);
  }

  // ============ 小数乘法竖式 ============
  // a 有 d1 位小数，b 有 d2 位小数，积有 d1+d2 位小数
  function trimD(s) { return String(parseFloat(s)); }
  function buildDecMul() {
    var v = pick(['dd', 'di', 'dd2']);
    var a, b, ans, aText, bText;
    if (v === 'dd') {
      var a1 = rnd(10, 99), b1 = rnd(10, 99);
      a = a1 / 10; b = b1 / 10; aText = a.toFixed(1); bText = b.toFixed(1);
      ans = a * b;
    } else if (v === 'di') {
      var a2 = rnd(10, 999) / 10, b2 = rnd(2, 99);
      a = a2; b = b2; aText = a.toFixed(1); bText = String(b);
      ans = a * b;
    } else {
      var a3 = rnd(11, 99), b3 = rnd(11, 99);
      a = a3 / 100; b = b3 / 100; aText = a.toFixed(2); bText = b.toFixed(2);
      ans = a * b;
    }
    return { kind: 'mul', a: a, b: b, aText: aText, bText: bText, answer: trimD(ans.toFixed(6)), hint: '小数乘法：先按整数乘法计算，再看因数一共有几位小数，从积的右边起数出几位点上小数点。' };
  }

  // ============ 除数是整数的小数除法 ============
  function buildDivInt() {
    var divisor = rnd(2, 9);
    var qWhole = rnd(2, 9), qDec = rnd(1, 9);
    var q = qWhole + qDec / 10;
    var dividend = divisor * q;
    return { kind: 'div', divisor: divisor, dividend: trimD(dividend.toFixed(2)), qText: q.toFixed(1), answer: trimD(q.toFixed(2)), hint: '除数是整数的小数除法：按照整数除法计算，商的小数点要和被除数的小数点对齐。' };
  }

  // ============ 除数是小数的小数除法 ============
  function buildDivDec() {
    var dInt = rnd(2, 9);
    var divisor = dInt / 10;                       // 一位小数除数
    var qWhole = rnd(1, 9), qDec = rnd(1, 9);
    var q = qWhole + qDec / 10;
    var dividend = divisor * q;
    return { kind: 'div', divisor: divisor.toFixed(1), dividend: trimD(dividend.toFixed(2)), qText: q.toFixed(1), answer: trimD(q.toFixed(2)), hint: '除数是小数：先把除数变成整数，除数的小数点向右移动几位，被除数的小数点也向右移动几位，再按整数除法计算。' };
  }

  // ============ 循环小数竖式 ============
  // 长除法求前两位小数；若分母只含 2、5 的质因数则整除（递归重试）
  function longDiv2(n, d) {
    var intPart = Math.floor(n / d);
    var rem = n % d;
    var digits = [];
    for (var i = 0; i < 2; i++) {
      if (rem === 0) return null; // 整除（有限小数）
      rem *= 10;
      digits.push(Math.floor(rem / d));
      rem %= d;
    }
    return { intPart: intPart, digits: digits };
  }
  function buildRepeating() {
    var d = pick([3, 6, 7, 9, 11, 12, 13, 14, 15, 18]);
    var n = rnd(1, d - 1);
    var res = longDiv2(n, d);
    if (!res) return buildRepeating(); // 有限小数则重试
    var dec2 = res.digits[0] + '' + res.digits[1];
    var qText = res.intPart + '.' + dec2;
    return { kind: 'div', divisor: d, dividend: n, qText: qText + '……', answer: qText + '……', hint: '循环小数：小数部分从某一位起依次不断重复出现，用省略号表示，如 0.33……。' };
  }

  // ============ 综合竖式 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 35) return buildDecMul();
    if (r <= 60) return buildDivInt();
    if (r <= 80) return buildDivDec();
    return buildRepeating();
  }

  var TYPE_BUILDERS = {
    'dec-mul-vertical': buildDecMul,
    'dec-div-int': buildDivInt,
    'dec-div-dec': buildDivDec,
    'repeating-dec': buildRepeating,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'dec-mul-vertical': '小数乘法竖式',
    'dec-div-int': '除数是整数的小数除法',
    'dec-div-dec': '除数是小数的小数除法',
    'repeating-dec': '循环小数竖式',
    mix: '混合竖式'
  };

  // ============ 单题渲染 / 判定 ============
  function qRender(q, idx) {
    if (q.kind === 'mul') return renderMul(idx, q.aText, q.bText);
    return renderDiv(idx, q.divisor, q.dividend);
  }

  function qCheck(q, userAnswers, idx) {
    var ua = userAnswers || {};
    var v = ua[idx];
    if (v == null || String(v).trim() === '') return false;
    var s = String(v).trim();
    if (q.kind === 'mul' || q.kind === 'repeating') return s === String(q.answer);
    // 除法：数值近似比对（允许 2.5 与 2.50 等价）
    var u = parseFloat(s);
    if (isNaN(u)) return false;
    return Math.abs(u - parseFloat(q.answer)) < 1e-6;
  }

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g5-vertical',
    moduleId: 'M2',
    name: '竖式计算',
    pageSubtitle: '小数乘法、小数除法与循环小数',
    grades: [5],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['g5-m2-g5-v-decmul', 'g5-m2-g5-v-divint', 'g5-m2-g5-v-ddivdec', 'g5-m2-g5-v-repeating'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',             label: '混合竖式' },
          { value: 'dec-mul-vertical', label: '小数乘法竖式' },
          { value: 'dec-div-int',     label: '除数是整数' },
          { value: 'dec-div-dec',     label: '除数是小数' },
          { value: 'repeating-dec',   label: '循环小数竖式' }
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
        var key = p.kind + '|' + p.divisor + 'd' + p.dividend + (p.kind === 'mul' ? 'm' + p.aText + p.bText : '');
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return {
          type: 'vertical',
          kind: p.kind,
          data: p,
          answer: p.answer,
          hint: p.hint,
          render: function (idx) { return qRender(this.data, idx); },
          check: function (userAnswers, idx) { return qCheck(this.data, userAnswers, idx); }
        };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学五年级竖式计算（' + (TYPE_NAMES[type] || '混合竖式') + '）'
      };
    }
  });

  // ============ 导出 ============
  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);