/**
 * plugins/math-g1-choice.js — 一年级选择题插件（M12 选择）
 *
 * 知识点覆盖（shared/knowledge-math.js 一年级 M12 / 相关模块）：
 *   math-g1-m1-addsub-10      加减法计算    （cat: calc）
 *   math-g1-m1-carry-add-20    进位加法      （cat: carry）
 *   math-g1-m1-retreat-sub-20  退位减法      （cat: retreat）
 *   math-g1-m4-adjacent-number 相邻数        （cat: adjacent）
 *   math-g1-m4-clock-read       时间认读      （cat: clock）
 *   math-g1-m4-rmb-unit         人民币换算    （cat: rmb）
 *   math-g1-m6-solid-shape      图形识别      （cat: shape）
 *   math-g1-m12-choice-mixed    选择综合      （cat: mix）
 *
 * 每题 3-4 个选项：正确答案 + 常见错误干扰项；答案与选项索引比较由
 * renderCard 的 choice 分支 + PluginUtil.computeResult 处理。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g1-choice.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(0, i);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 每条：{ q, answer, wrong: 干扰项[], hint, cat }
  var ITEMS = [
    // 加减法计算
    { q: '9 + 6 = ?', answer: '15', wrong: ['14', '16', '13'], hint: '把 6 分成 1 和 5，9+1=10，10+5=15。', cat: 'calc' },
    { q: '8 + 7 = ?', answer: '15', wrong: ['14', '16', '17'], hint: '把 7 分成 2 和 5，8+2=10，10+5=15。', cat: 'calc' },
    { q: '13 - 5 = ?', answer: '8', wrong: ['7', '9', '6'], hint: '把 13 分成 10 和 3，10-5=5，5+3=8。', cat: 'calc' },
    { q: '7 + 8 = ?', answer: '15', wrong: ['14', '16', '17'], hint: '把 8 分成 3 和 5，7+3=10，10+5=15。', cat: 'calc' },
    { q: '15 - 8 = ?', answer: '7', wrong: ['6', '8', '9'], hint: '想 8 + 7 = 15，所以 15-8=7。', cat: 'calc' },
    { q: '10 - 3 = ?', answer: '7', wrong: ['6', '8', '13'], hint: '10 去掉 3 还剩 7。', cat: 'calc' },
    // 进位加法
    { q: '9 + 5 = ?', answer: '14', wrong: ['13', '15', '12'], hint: '把 5 分成 1 和 4，9+1=10，10+4=14。', cat: 'carry' },
    { q: '6 + 7 = ?', answer: '13', wrong: ['12', '14', '11'], hint: '把 7 分成 4 和 3，6+4=10，10+3=13。', cat: 'carry' },
    { q: '8 + 6 = ?', answer: '14', wrong: ['13', '15', '12'], hint: '把 6 分成 2 和 4，8+2=10，10+4=14。', cat: 'carry' },
    // 退位减法
    { q: '11 - 3 = ?', answer: '8', wrong: ['7', '9', '6'], hint: '把 11 分成 10 和 1，10-3=7，7+1=8。', cat: 'retreat' },
    { q: '14 - 6 = ?', answer: '8', wrong: ['7', '9', '6'], hint: '想 6 + 8 = 14，所以 14-6=8。', cat: 'retreat' },
    { q: '12 - 5 = ?', answer: '7', wrong: ['6', '8', '9'], hint: '把 12 分成 10 和 2，10-5=5，5+2=7。', cat: 'retreat' },
    // 相邻数
    { q: '8 的相邻数是？', answer: '7 和 9', wrong: ['6 和 8', '9 和 10', '7 和 8'], hint: '相邻数是前后相邻的数：8-1=7，8+1=9。', cat: 'adjacent' },
    { q: '5 的相邻数是？', answer: '4 和 6', wrong: ['3 和 5', '5 和 7', '3 和 4'], hint: '5-1=4，5+1=6。', cat: 'adjacent' },
    // 钟表认读
    { q: '分针指向 12、时针指向 3，是几时？', answer: '3 时', wrong: ['12 时', '6 时', '9 时'], hint: '整时看时针指向几就是几时。', cat: 'clock' },
    { q: '分针指向 12、时针指向 8，是几时？', answer: '8 时', wrong: ['3 时', '6 时', '12 时'], hint: '整时看时针指向几。', cat: 'clock' },
    { q: '分针指向 12、时针指向 6，是几时？', answer: '6 时', wrong: ['3 时', '8 时', '12 时'], hint: '整时看时针指向几。', cat: 'clock' },
    // 人民币换算
    { q: '1 元等于几角？', answer: '10 角', wrong: ['100 角', '1 角', '5 角'], hint: '1 元 = 10 角。', cat: 'rmb' },
    { q: '1 角等于几分？', answer: '10 分', wrong: ['1 分', '100 分', '5 分'], hint: '1 角 = 10 分。', cat: 'rmb' },
    { q: '5 元等于几角？', answer: '50 角', wrong: ['5 角', '15 角', '10 角'], hint: '1 元=10 角，5 元=50 角。', cat: 'rmb' },
    // 图形识别
    { q: '下面哪个是球体？', answer: '球', wrong: ['正方体', '长方体', '圆柱'], hint: '球能向任意方向滚动，没有平平的面。', cat: 'shape' },
    { q: '下面哪个有 6 个完全相同的正方形面？', answer: '正方体', wrong: ['长方体', '球', '圆柱'], hint: '正方体的 6 个面都是相同的正方形。', cat: 'shape' },
    { q: '圆柱的上下两个面是什么形状？', answer: '圆形', wrong: ['正方形', '三角形', '长方形'], hint: '圆柱上下两个底面都是圆形。', cat: 'shape' }
  ];

  function buildOf(cat) {
    var pool = ITEMS.filter(function (s) { return s.cat === cat; });
    return pool[rnd(0, pool.length - 1)];
  }
  function buildMixed() { return ITEMS[rnd(0, ITEMS.length - 1)]; }

  var TYPE_BUILDERS = {
    'mix': buildMixed, 'choice': buildMixed,
    'calc': function () { return buildOf('calc'); },
    'carry': function () { return buildOf('carry'); },
    'retreat': function () { return buildOf('retreat'); },
    'adjacent': function () { return buildOf('adjacent'); },
    'clock': function () { return buildOf('clock'); },
    'rmb': function () { return buildOf('rmb'); },
    'shape': function () { return buildOf('shape'); }
  };
  var TYPE_NAMES = {
    'mix': '综合选择', 'choice': '综合选择', 'calc': '加减法', 'carry': '进位加法',
    'retreat': '退位减法', 'adjacent': '相邻数', 'clock': '钟表认读', 'rmb': '人民币换算', 'shape': '图形识别'
  };

  var _pool = _PU.createPoolCache('math-g1-choice:mix', function () { return ITEMS.slice(); });

  var plugin = _PU.createMathPlugin({
    id: 'math-g1-choice',
    moduleId: 'M12',
    name: '选择题',
    pageSubtitle: '加减法、相邻数、钟表认读、人民币换算与图形识别',
    grades: [1],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
      'math-g1-m1-addsub-10',
      'math-g1-m1-carry-add-20',
      'math-g1-m1-retreat-sub-20',
      'math-g1-m4-adjacent-number',
      'math-g1-m4-clock-read',
      'math-g1-m4-rmb-unit',
      'math-g1-m6-solid-shape',
      'math-g1-m12-choice-mixed'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',     label: '综合选择' },
          { value: 'calc',    label: '加减法' },
          { value: 'carry',   label: '进位加法' },
          { value: 'retreat', label: '退位减法' },
          { value: 'adjacent', label: '相邻数' },
          { value: 'clock',   label: '钟表认读' },
          { value: 'rmb',     label: '人民币换算' },
          { value: 'shape',   label: '图形识别' }
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
          type: 'choice',
          q: p.q,
          answer: p.answer,
          options: shuffle([p.answer].concat(p.wrong)),
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
        title: '小学一年级选择练习（' + (TYPE_NAMES[type] || '综合选择') + '）'
      };
    }
  });

  plugin.poolCache = _pool;

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
