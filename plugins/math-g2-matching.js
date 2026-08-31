/**
 * plugins/math-g2-matching.js — 二年级连线题插件（M5 连线）
 *
 * 知识点覆盖（shared/knowledge-math.js 二年级 M5 模块）：
 *   math-g2-m5-match-calc     算式与得数连线
 *   math-g2-m5-match-shape    图形与名称连线
 *   math-g2-m5-match-angle    角的类型连线
 *   math-g2-m5-match-clock    钟面与时间连线
 *   math-g2-m5-match-unit     单位与物品连线
 *   math-g2-m5-match-multdiv  口诀与算式连线
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
  if (!_PU) throw new Error('plugins/math-g2-matching.js 依赖 shared/common.js（PluginUtil），请先加载');

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 每条配对：{ left, right, wrong: 干扰项[], cat }
  var PAIRS = [
    // 算式与得数（match-calc）
    { left: '37 + 25', right: '62', wrong: ['52', '60', '63'], cat: 'calc' },
    { left: '52 - 27', right: '25', wrong: ['35', '24', '15'], cat: 'calc' },
    { left: '8 × 7', right: '56', wrong: ['54', '63', '48'], cat: 'calc' },
    { left: '42 ÷ 6', right: '7', wrong: ['6', '8', '9'], cat: 'calc' },
    { left: '80 - 25 - 18', right: '37', wrong: ['47', '43', '33'], cat: 'calc' },

    // 图形与名称（match-shape）
    { left: '长方体', right: '相对的面一样大', wrong: ['6个面都是正方形', '能滚动没有平平的面', '上下两个面是圆'], cat: 'shape' },
    { left: '正方体', right: '6个面都是正方形', wrong: ['相对的面一样大', '能滚动没有平平的面', '上下两个面是圆'], cat: 'shape' },
    { left: '球', right: '能滚动，没有平平的面', wrong: ['相对的面一样大', '6个面都是正方形', '上下两个面是圆'], cat: 'shape' },
    { left: '圆柱', right: '上下两个面都是圆', wrong: ['相对的面一样大', '6个面都是正方形', '能滚动没有平平的面'], cat: 'shape' },

    // 角的类型（match-angle）
    { left: '比直角小的角', right: '锐角', wrong: ['直角', '钝角', '平角'], cat: 'angle' },
    { left: '等于 90° 的角', right: '直角', wrong: ['锐角', '钝角', '周角'], cat: 'angle' },
    { left: '比直角大的角', right: '钝角', wrong: ['锐角', '直角', '平角'], cat: 'angle' },

    // 钟面与时间（match-clock）
    { left: '分针指向12、时针指向8', right: '8时', wrong: ['3时', '6时', '12时'], cat: 'clock' },
    { left: '分针指向12、时针指向3', right: '3时', wrong: ['8时', '6时', '12时'], cat: 'clock' },
    { left: '分针指向12、时针指向6', right: '6时', wrong: ['8时', '3时', '12时'], cat: 'clock' },

    // 单位与物品（match-unit）
    { left: '一棵大树的高', right: '米', wrong: ['厘米', '毫米', '克'], cat: 'unit' },
    { left: '一枚硬币的厚度', right: '毫米', wrong: ['米', '厘米', '千克'], cat: 'unit' },
    { left: '一袋盐的质量', right: '克', wrong: ['千克', '米', '厘米'], cat: 'unit' },
    { left: '小明的体重', right: '千克', wrong: ['克', '米', '厘米'], cat: 'unit' },

    // 口诀与算式（match-multdiv）
    { left: '三八二十四', right: '3 × 8 = 24', wrong: ['3 + 8 = 24', '24 ÷ 8 = 2', '3 × 8 = 23'], cat: 'multdiv' },
    { left: '六七四十二', right: '42 ÷ 6 = 7', wrong: ['6 × 7 = 40', '42 ÷ 7 = 5', '6 + 7 = 42'], cat: 'multdiv' },
    { left: '五九四十五', right: '5 × 9 = 45', wrong: ['5 + 9 = 45', '45 ÷ 9 = 4', '9 × 5 = 44'], cat: 'multdiv' }
  ];

  function buildOf(cat) {
    var pool = PAIRS.filter(function (s) { return s.cat === cat; });
    return pool[_PU.randInt(0, pool.length - 1)];
  }
  function buildMixed() { return PAIRS[_PU.randInt(0, PAIRS.length - 1)]; }

    var TYPE_BUILDERS = {
    'mix': buildMixed,
    'match-calc': function () { return buildOf('calc'); },
    'match-shape': function () { return buildOf('shape'); },
    'match-angle': function () { return buildOf('angle'); },
    'match-clock': function () { return buildOf('clock'); },
    'match-unit': function () { return buildOf('unit'); },
    'match-multdiv': function () { return buildOf('multdiv'); }
  };
  var CAT_KP = {
    calc: 'math-g2-m5-match-calc', shape: 'math-g2-m5-match-shape', angle: 'math-g2-m5-match-angle',
    clock: 'math-g2-m5-match-clock', unit: 'math-g2-m5-match-unit', multdiv: 'math-g2-m5-match-multdiv'
  };
  var TYPE_NAMES = {
    'mix': '综合连线', 'match-calc': '算式与得数', 'match-shape': '图形与名称',
    'match-angle': '角的类型', 'match-clock': '钟面与时间', 'match-unit': '单位与物品', 'match-multdiv': '口诀与算式'
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

  var _pool = _PU.createPoolCache('math-g2-matching:mix', function () { return PAIRS.slice(); });

  var plugin = _PU.createMathPlugin({
    id: 'math-g2-matching',
    moduleId: 'M5',
    name: '连线题',
    pageSubtitle: '算式与得数、图形与名称、角的类型、钟面与时间、单位与物品、口诀与算式',
    grades: [2],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: {
      2: [
        'math-g2-m5-match-calc',
        'math-g2-m5-match-shape',
        'math-g2-m5-match-angle',
        'math-g2-m5-match-clock',
        'math-g2-m5-match-unit',
        'math-g2-m5-match-multdiv'
      ]
    },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',          label: '综合连线' },
          { value: 'match-calc',   label: '算式与得数' },
          { value: 'match-shape',  label: '图形与名称' },
          { value: 'match-angle',  label: '角的类型' },
          { value: 'match-clock',  label: '钟面与时间' },
          { value: 'match-unit',   label: '单位与物品' },
          { value: 'match-multdiv', label: '口诀与算式' }
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
        var data = { left: p.left, options: _PU.shuffle([p.right].concat(p.wrong)) };
        return {
          type: 'match',
          data: data,
          q: '把「' + p.left + '」连到正确的（  ）',
          answer: p.right,
          options: data.options,
          inputType: 'choice',
          knowledgePointId: CAT_KP[p.cat],
          hint: '想一想对应的得数 / 特征 / 时间 / 单位 / 口诀。',
          render: function (idx) { return renderPair(this.data, idx); }
        };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学二年级连线练习（' + (TYPE_NAMES[type] || '综合连线') + '）'
      };
    }
  });

  plugin.poolCache = _pool;

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
