/**
 * plugins/math-g6-reasoning.js — 六年级推理插件（M10 数与形规律及鸽巢问题）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M10 模块）：
 *   g6-m10-g6-reason-number-shape  数与形规律        （type: 'number-shape'）
 *   g6-m10-g6-reason-pigeonhole    鸽巢问题          （type: 'pigeonhole'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-reasoning.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  // ============ 数与形规律 ============
  function buildNumberShape() {
    var v = pick(['tri', 'sq', 'oddsum', 'sum']);
    if (v === 'tri') {
      var n = rnd(4, 20);
      return { q: '用小圆点摆三角形，第 1 个用 1 个，第 2 个用 3 个，第 3 个用 6 个……第 ' + n + ' 个需要（  ）个圆点', answer: n * (n + 1) / 2, svg: triangleSVG(n), hint: '第 n 个 = n × (n+1) ÷ 2 = ' + n + ' × ' + (n + 1) + ' ÷ 2。' };
    }
    if (v === 'sq') {
      var n2 = rnd(4, 20);
      return { q: '按规律摆正方形：1、4、9、16……第 ' + n2 + ' 个图形需要（  ）个小正方形', answer: n2 * n2, hint: '想一想：从 1、4、9、16 的规律，第几个图形与数字几有什么关系。' };
    }
    if (v === 'oddsum') {
      var n3 = rnd(3, 20);
      return { q: '1 + 3 + 5 + ……（连续 ' + n3 + ' 个奇数）= （  ）²', answer: n3, hint: '想一想：连续几个奇数的和，与奇数的个数有什么关系。' };
    }
    var n4 = rnd(4, 40);
    return { q: '1 + 2 + 3 + …… + ' + n4 + ' =（  ）', answer: n4 * (n4 + 1) / 2, hint: '配对求和：(' + n4 + ' + 1) × ' + n4 + ' ÷ 2。' };
  }
  function triangleSVG(n) {
    var W = 150, H = 110;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    var R = 8;
    var rows = Math.min(n, 6);
    var y = 95;
    for (var i = 0; i < rows; i++) {
      var cnt = i + 1;
      var x0 = W / 2 - (cnt - 1) * R;
      for (var j = 0; j < cnt; j++) {
        out += '<circle cx="' + (x0 + j * 2 * R) + '" cy="' + y + '" r="' + (R - 2) + '" fill="rgba(63,111,209,.35)" stroke="#3f6fd1" stroke-width="1.5"/>';
      }
      y -= R * 2;
    }
    out += '</svg>';
    return out;
  }

  // ============ 鸽巢问题 ============
  function buildPigeonhole() {
    var v = pick(['parity', 'month', 'color', 'cards']);
    if (v === 'parity') {
      var n = rnd(5, 30);
      return { q: '任意 ' + n + ' 个自然数中，至少有（  ）个数的奇偶性相同', answer: Math.ceil(n / 2), hint: '自然数只有奇、偶 2 种情况，把这 ' + n + ' 个数平均分到 2 组里，用进一法。' };
    }
    if (v === 'month') {
      var n2 = rnd(25, 80);
      return { q: n2 + ' 名同学中，至少有（  ）人是同一月份出生的（一年 12 个月）', answer: Math.ceil(n2 / 12), hint: '一年只有 12 个月，把 ' + n2 + ' 名同学平均分到 12 个月里，用进一法。' };
    }
    if (v === 'color') {
      var c = rnd(3, 10);
      return { q: '布袋里有 ' + c + ' 种不同颜色的球，一次至少摸（  ）个，才能保证有 2 个同色', answer: c + 1, hint: '最不利时先每种颜色各摸 1 个，再多摸 1 个就一定有两只同色。' };
    }
    var d = rnd(2, 8);
    return { q: '一个盒子里有 ' + d + ' 种不同花色（每种花色足够多）的扑克牌，至少摸（  ）张，才能保证有 2 张同花色', answer: d + 1, hint: '最不利时先每种花色摸 1 张，再多摸 1 张就一定有两只同花色。' };
  }

  // ============ 综合推理 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 55) return buildNumberShape();
    return buildPigeonhole();
  }

  var TYPE_BUILDERS = {
    'number-shape': buildNumberShape,
    'pigeonhole': buildPigeonhole,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'number-shape': '数与形规律',
    'pigeonhole': '鸽巢问题',
    mix: '综合推理'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-reasoning',
    moduleId: 'M10',
    name: '推理',
    pageSubtitle: '数与形规律与鸽巢问题',
    grades: [6],
    subject: 'math',
    category: 'reasoning',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['math-g6-m10-g6-reason-number-shape', 'math-g6-m10-g6-reason-pigeonhole'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',          label: '综合推理' },
          { value: 'number-shape', label: '数与形规律' },
          { value: 'pigeonhole',   label: '鸽巢问题' }
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
        var key = p.q + '|' + p.answer;
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        var q = { type: 'reason', q: p.q, answer: String(p.answer), hint: p.hint, svg: p.svg };
        if (p.options) { q.inputType = 'choice'; q.options = p.options; }
        else q.inputType = 'text';
        return q;
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学六年级推理（' + (TYPE_NAMES[type] || '综合推理') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);