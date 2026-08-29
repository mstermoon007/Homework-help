/**
 * plugins/math-g1-matching.js — 一年级连线题插件（M5 连线）
 *
 * 知识点覆盖（shared/knowledge-math.js 一年级 M5 / 相关模块）：
 *   math-g1-m1-addsub-10      算式与得数连线  （cat: calc）
 *   math-g1-m6-solid-shape     图形与名称连线  （cat: shape）
 *   math-g1-m4-clock-read       钟面与时间连线  （cat: clock）
 *   math-g1-m4-rmb-unit         人民币面值连线  （cat: rmb）
 *   math-g1-m5-match-calc / match-shape / match-clock / match-rmb （M5 新知识点）
 *
 * 渲染：自定义两栏（左：待连项；右：候选），复用 renderCard 的 choice 分支产物
 * （.opt + 隐藏 input[data-index] + window.__pickOpt），与 collectAnswers 完全兼容。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g1-matching.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(0, i);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 每条配对：{ left, right, wrong: 干扰项[], cat }
  var PAIRS = [
    // 算式与得数（4）
    { left: '3 + 4', right: '7', wrong: ['12', '15', '10', '9'], cat: 'calc' },
    { left: '8 + 4', right: '12', wrong: ['7', '15', '20', '11'], cat: 'calc' },
    { left: '9 + 6', right: '15', wrong: ['14', '16', '13', '21'], cat: 'calc' },
    { left: '7 + 8', right: '15', wrong: ['14', '16', '13', '23'], cat: 'calc' },
    // 图形与名称（4）
    { left: '长方体', right: '相对的面一样大', wrong: ['6个面都是正方形', '能滚动没有平平的面', '上下两个面是圆'], cat: 'shape' },
    { left: '正方体', right: '6个面都是正方形', wrong: ['相对的面一样大', '能滚动没有平平的面', '上下两个面是圆'], cat: 'shape' },
    { left: '球', right: '能滚动，没有平平的面', wrong: ['相对的面一样大', '6个面都是正方形', '上下两个面是圆'], cat: 'shape' },
    { left: '圆柱', right: '上下两个面都是圆', wrong: ['相对的面一样大', '6个面都是正方形', '能滚动没有平平的面'], cat: 'shape' },
    // 钟面与时间（3）
    { left: '分针指向12、时针指向8', right: '8时', wrong: ['3时', '6时', '12时'], cat: 'clock' },
    { left: '分针指向12、时针指向3', right: '3时', wrong: ['8时', '6时', '12时'], cat: 'clock' },
    { left: '分针指向12、时针指向6', right: '6时', wrong: ['8时', '3时', '12时'], cat: 'clock' },
    // 人民币面值（1）
    { left: '1元', right: '10角', wrong: ['100分', '1角', '5角'], cat: 'rmb' }
  ];

  function buildOf(cat) {
    var pool = PAIRS.filter(function (s) { return s.cat === cat; });
    return pool[rnd(0, pool.length - 1)];
  }
  function buildMixed() { return PAIRS[rnd(0, PAIRS.length - 1)]; }

  var TYPE_BUILDERS = {
    'mix': buildMixed,
    'match-calc': function () { return buildOf('calc'); },
    'match-shape': function () { return buildOf('shape'); },
    'match-clock': function () { return buildOf('clock'); },
    'match-rmb': function () { return buildOf('rmb'); }
  };
  var TYPE_NAMES = {
    'mix': '综合连线', 'match-calc': '算式与得数', 'match-shape': '图形与名称',
    'match-clock': '钟面与时间', 'match-rmb': '人民币面值'
  };

  function renderPair(p, i) {
    var optsHtml = '';
    p.options.forEach(function (o) {
      optsHtml += '<span class="opt" data-val="' + esc(o) + '" onclick="window.__pickOpt(this)">' + esc(o) + '</span>';
    });
    return '<div class="question-card matching-layout" data-index="' + i + '">' +
      '<div class="q-header"><span class="num">' + (i + 1) + '</span>' +
      '&nbsp;&nbsp;&nbsp;&nbsp;<span class="q-text">把「' + esc(p.left) + '」连到正确的（  ）</span></div>' +
      '<div class="matching-cols">' +
        '<div class="matching-left">' + esc(p.left) + '</div>' +
        '<div class="matching-right">' + optsHtml + '</div>' +
      '</div>' +
      '<input type="hidden" data-index="' + i + '">' +
      '<div class="feedback"></div></div>';
  }

  var _pool = _PU.createPoolCache('math-g1-matching:mix', function () { return PAIRS.slice(); });

  var plugin = _PU.createMathPlugin({
    id: 'math-g1-matching',
    moduleId: 'M5',
    name: '连线题',
    pageSubtitle: '算式与得数、图形与名称、钟面与时间、人民币面值',
    grades: [1],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
      'math-g1-m1-addsub-10',
      'math-g1-m6-solid-shape',
      'math-g1-m4-clock-read',
      'math-g1-m4-rmb-unit',
      'math-g1-m5-match-calc',
      'math-g1-m5-match-shape',
      'math-g1-m5-match-clock',
      'math-g1-m5-match-rmb'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',         label: '综合连线' },
          { value: 'match-calc',  label: '算式与得数' },
          { value: 'match-shape', label: '图形与名称' },
          { value: 'match-clock', label: '钟面与时间' },
          { value: 'match-rmb',   label: '人民币面值' }
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
        if (!seen[p.left]) { seen[p.left] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        var data = { left: p.left, options: shuffle([p.right].concat(p.wrong)) };
        return {
          type: 'match',
          data: data,
          q: '把「' + p.left + '」连到正确的（  ）',
          answer: p.right,
          options: data.options,
          inputType: 'choice',
          hint: '想一想对应的得数 / 特征 / 时间 / 单位。',
          render: function (idx) { return renderPair(this.data, idx); }
        };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学一年级连线练习（' + (TYPE_NAMES[type] || '综合连线') + '）'
      };
    }
  });

  plugin.poolCache = _pool;

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
