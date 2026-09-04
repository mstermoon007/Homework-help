/**
 * plugins/math-g1-judge.js — 一年级判断题插件（M11 判断）
 *
 * 知识点覆盖（shared/knowledge-math.js 一年级 M11 模块）：
 *   math-g1-m4-compare-number    比大小判断      （category: number）
 *   math-g1-m6-solid-shape       图形特征判断    （category: shapes）
 *   math-g1-m6-flat-shape        平面图形判断    （category: shapes）
 *   math-g1-m4-clock-read        钟表判断        （category: clock）
 *   math-g1-m4-rmb-unit          人民币判断      （category: rmb）
 *   math-g1-m0-make-ten-cushi    计算正误判断    （category: cushi）
 *   math-g1-m11-judge-mixed      判断综合        （category: mix）
 *
 * 判断题以 choice 呈现（√ / ×），复用 renderCard 的 choice 分支。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g1-judge.js 依赖 shared/common.js（PluginUtil），请先加载');


  // 每条：{ q: 题干, right: boolean, hint: 解析, cat: 类别 }
  var STATEMENTS = [
    // 图形特征（球易滚、正方体面形、长方体面数、圆柱上下圆）
    { q: '球容易滚动，没有平平的面。', right: true, hint: '球是曲面，能向任意方向滚动。', cat: 'shapes' },
    { q: '正方体有 6 个面，每个面都是正方形。', right: true, hint: '正方体的 6 个面完全相同。', cat: 'shapes' },
    { q: '长方体有 6 个面，相对的面一样大。', right: true, hint: '长方体相对的两个面形状和大小相同。', cat: 'shapes' },
    { q: '圆柱上下两个面都是圆形。', right: true, hint: '圆柱有两个大小相等的圆形底面。', cat: 'shapes' },
    { q: '正方体有 8 个顶点。', right: true, hint: '正方体有 8 个顶点、12 条棱。', cat: 'shapes' },
    { q: '球有平平的面，可以稳稳地放着。', right: false, hint: '球是曲面，没有平平的面，容易滚动。', cat: 'shapes' },

    // 数的大小（含相邻数、比大小正误）
    { q: '5 比 3 大。', right: true, hint: '从前往后数，5 在 3 的后面。', cat: 'number' },
    { q: '9 比 10 大。', right: false, hint: '10 比 9 大 1，所以 9 比 10 小。', cat: 'number' },
    { q: '8 的相邻数是 7 和 9。', right: true, hint: '相邻数是它前面和后面的数：8-1=7，8+1=9。', cat: 'number' },
    { q: '12 比 11 小。', right: false, hint: '12 比 11 大 1。', cat: 'number' },
    { q: '与 10 相邻的数是 9 和 11。', right: true, hint: '10-1=9，10+1=11。', cat: 'number' },

    // 计算正误（加减法、连加连减）
    { q: '9 + 6 = 15。', right: true, hint: '把 6 分成 1 和 5，9+1=10，10+5=15。', cat: 'calc' },
    { q: '13 - 5 = 8。', right: true, hint: '把 13 分成 10 和 3，10-5=5，5+3=8。', cat: 'calc' },
    { q: '7 + 8 = 15。', right: true, hint: '把 8 分成 3 和 5，7+3=10，10+5=15。', cat: 'calc' },
    { q: '15 - 8 = 6。', right: false, hint: '15-8 应等于 7，不是 6。', cat: 'calc' },
    { q: '10 - 3 = 7。', right: true, hint: '10 去掉 3 还剩 7。', cat: 'calc' },

    // 钟表常识（时针比分针短、整时判断）
    { q: '时针比分针短。', right: true, hint: '钟面上时针短、分针长。', cat: 'clock' },
    { q: '3 时整，分针指向 12。', right: true, hint: '整时的时候分针都指向 12。', cat: 'clock' },
    { q: '6 时整，时针指向 6。', right: true, hint: '6 时整时针指向 6、分针指向 12。', cat: 'clock' },
    { q: '分针比时针长。', right: true, hint: '分针比时针更细长。', cat: 'clock' },

    // 人民币常识（单位换算、简单计算）
    { q: '1 元 = 10 角。', right: true, hint: '1 元可以换 10 个 1 角。', cat: 'rmb' },
    { q: '1 角 = 10 分。', right: true, hint: '1 角可以换 10 个 1 分。', cat: 'rmb' },
    { q: '5 元 = 50 角。', right: true, hint: '1 元=10 角，5 元=5×10=50 角。', cat: 'rmb' },
    { q: '1 元 = 100 分。', right: true, hint: '1 元=10 角=100 分。', cat: 'rmb' },
    { q: '1 元 = 10 分。', right: false, hint: '1 元=100 分，不是 10 分。', cat: 'rmb' },

    // 凑十法计算正误
    { q: '计算 9 + 6 时，把 6 分成 1 和 5，9 + 1 = 10，10 + 5 = 15。', right: true, hint: '用凑十法先凑成 10 再相加。', cat: 'cushi' }
  ];

  function buildOf(cat) {
    var pool = STATEMENTS.filter(function (s) { return s.cat === cat; });
    return pool[_PU.randInt(0, pool.length - 1)];
  }
  function buildMixed() { return STATEMENTS[_PU.randInt(0, STATEMENTS.length - 1)]; }

  var TYPE_BUILDERS = {
    'mix': buildMixed,
    'judge': buildMixed,
    'shapes': function () { return buildOf('shapes'); },
    'number': function () { return buildOf('number'); },
    'calc': function () { return buildOf('calc'); },
    'clock': function () { return buildOf('clock'); },
    'rmb': function () { return buildOf('rmb'); },
    'cushi': function () { return buildOf('cushi'); }
  };
  var TYPE_NAMES = {
    'mix': '综合判断', 'judge': '综合判断', 'shapes': '图形特征', 'number': '数的大小',
    'calc': '计算正误', 'clock': '钟表常识', 'rmb': '人民币常识', 'cushi': '凑十法判断'
  };

  // 题目池：供 dev/check-duplicates.js 读取池大小（池有限时自动豁免）
  var _pool = _PU.createPoolCache('math-g1-judge:mix', function () { return STATEMENTS.slice(); });

  var plugin = _PU.createMathPlugin({
    id: 'math-g1-judge',
    moduleId: 'M11',
    name: '判断题',
    pageSubtitle: '图形特征、数的大小、计算正误、钟表与人民币常识',
    grades: [1],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
      'math-g1-m4-compare-number',
      'math-g1-m6-solid-shape',
      'math-g1-m6-flat-shape',
      'math-g1-m4-rmb-unit',
      'math-g1-m0-make-ten-cushi',
      'math-g1-m11-judge-mixed'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',    label: '综合判断' },
          { value: 'shapes', label: '图形特征' },
          { value: 'number', label: '数的大小' },
          { value: 'calc',   label: '计算正误' },
          { value: 'clock',  label: '钟表常识' },
          { value: 'rmb',    label: '人民币常识' }
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
        if (!seen[p.q]) { seen[p.q] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return {
          type: 'judge',
          q: p.q,
          answer: p.right ? '√' : '×',
          options: _PU.shuffle(['√', '×']),
          inputType: 'choice',
          hint: p.hint
        };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学一年级判断练习（' + (TYPE_NAMES[type] || '综合判断') + '）'
      };
    }
  });

  plugin.poolCache = _pool; // 供 dev/check-duplicates.js 读取池大小

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
