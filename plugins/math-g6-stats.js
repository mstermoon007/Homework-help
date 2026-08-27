/**
 * plugins/math-g6-stats.js — 六年级统计插件（M9 扇形统计图与可能性）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M9 模块）：
 *   g6-m9-g6-stat-pie-chart    扇形统计图          （type: 'pie-chart'）
 *   g6-m9-g6-stat-possibility  可能性              （type: 'possibility'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-stats.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(0, i);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ============ 扇形统计图 ============
  function buildPieChart() {
    var v = pick(['total', 'angle', 'part', 'count', 'pct', 'diff']);
    if (v === 'total') {
      var total = rnd(4, 9) * 50;
      var p = pick([10, 20, 25, 30]);
      return { q: '某校共有学生 ' + total + ' 人，合唱团人数占全校的 ' + p + '%，合唱团有（  ）人', answer: total * p / 100, hint: '求一个数的百分之几用乘法：总数 × 对应的百分比，自己算一算。' };
    }
    if (v === 'angle') {
      var p2 = pick([15, 25, 40, 60]);
      return { q: '制作扇形统计图时，占总数的 ' + p2 + '% 的部分，应画圆心角（  ）°的扇形', answer: p2 * 360 / 100, hint: '圆心角 = 百分比 × 360° = ' + p2 + '% × 360°。' };
    }
    if (v === 'part') {
      var p3 = pick([20, 30, 40]);
      var t3 = rnd(4, 9) * 10;
      return { q: '扇形统计图中，某部分占 ' + p3 + '%，另一部分占 ' + (100 - p3) + '%，两个扇形的圆心角相差（  ）°', answer: Math.abs(p3 - (100 - p3)) * 360 / 100, hint: '先算出两个百分比相差多少，再乘 360°（每 1% 对应 3.6°）。' };
    }
    var parts = pick([[40, 30, 20, 10], [45, 25, 20, 10], [35, 25, 25, 15], [50, 25, 15, 10]]);
    var names = ['步行', '乘车', '骑车', '其他'];
    var total2 = rnd(2, 8) * 20;
    if (v === 'count') {
      var idx = rnd(0, 3);
      return { q: '根据扇形统计图，全校 ' + total2 + ' 名同学中，' + names[idx] + '上学的有（  ）人', answer: total2 * parts[idx] / 100, svg: pieSVG(parts, names), hint: '求一个数的百分之几用乘法：总数 × 对应的百分比，自己算一算。' };
    }
    if (v === 'pct') {
      var idx2 = rnd(0, 3);
      return { q: '根据扇形统计图，' + names[idx2] + '上学的占全校人数的（  ）%', answer: parts[idx2], svg: pieSVG(parts, names), hint: '直接读图中 ' + names[idx2] + ' 对应的百分比。' };
    }
    var i3 = rnd(0, 3), j3 = rnd(0, 3);
    while (j3 === i3) j3 = rnd(0, 3);
    var diff = Math.abs(parts[i3] - parts[j3]);
    return { q: '根据扇形统计图，全校 ' + total2 + ' 人，' + names[i3] + '的比' + names[j3] + '的多（  ）人', answer: total2 * diff / 100, svg: pieSVG(parts, names), hint: '先算出两个百分比相差多少，再用总数乘这个差，自己算一算。' };
  }
  function pieSVG(parts, names) {
    var x0 = 55, y0 = 55, r = 32;
    var W = 145, H = 110;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    var start = -90;
    var colors = ['#3f6fd1', '#f2a93b', '#59b88f', '#c7d0dd'];
    for (var i = 0; i < parts.length; i++) {
      var ang = parts[i] * 360 / 100;
      var a1 = start * Math.PI / 180, a2 = (start + ang) * Math.PI / 180;
      var x1 = x0 + r * Math.cos(a1), y1 = y0 + r * Math.sin(a1);
      var x2 = x0 + r * Math.cos(a2), y2 = y0 + r * Math.sin(a2);
      var large = ang > 180 ? 1 : 0;
      out += '<path d="M ' + x0 + ' ' + y0 + ' L ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2 + ' Z" fill="' + colors[i] + '" stroke="#fff" stroke-width="1.5"/>';
      start += ang;
    }
    var ly = 14;
    for (var j = 0; j < parts.length; j++) {
      out += '<rect x="114" y="' + (ly - 8) + '" width="8" height="8" fill="' + colors[j] + '"/>';
      out += '<text x="126" y="' + ly + '" font-size="9" fill="#27324a">' + names[j] + ' ' + parts[j] + '%</text>';
      ly += 15;
    }
    out += '</svg>';
    return out;
  }

  // ============ 可能性 ============
  function buildPossibility() {
    var v = pick(['coin', 'ball', 'even', 'certain', 'draw']);
    if (v === 'coin') {
      return { q: '掷一枚硬币，正面朝上的可能性是（  ）', answer: '1/2', options: shuffle(['1/2', '1/3', '1/4', '1']), hint: '想一想：硬币只有正反两面，正面朝上是其中一种结果。' };
    }
    if (v === 'ball') {
      var red = rnd(2, 5), white = rnd(1, 3);
      return { q: '袋子里有 ' + red + ' 个红球和 ' + white + ' 个白球，任意摸出一个，摸到红球的可能性是（  ）', answer: red + '/' + (red + white), options: shuffle([red + '/' + (red + white), white + '/' + (red + white), '1/' + (red + white), '1']), hint: '可能性 = 红球个数 ÷ 球的总数 = ' + red + ' ÷ ' + (red + white) + '。' };
    }
    if (v === 'even') {
      var n = pick([6, 8, 10]);
      return { q: '从 1 到 ' + n + ' 中任意抽取一个数，抽到偶数的可能性是（  ）', answer: '1/2', options: shuffle(['1/2', '1/3', '2/3', '1/' + n]), hint: '想一想：1 到 ' + n + ' 里偶数有几个，占全部的几分之几。' };
    }
    if (v === 'certain') {
      return { q: '盒子里有 5 个球，全是红球。任意摸出一个，摸到红球的可能性是（  ）', answer: '1', options: shuffle(['1', '1/2', '1/5', '0']), hint: '所有结果都是红球，是必然事件。' };
    }
    return { q: '从 0 到 9 这 10 个数字中任意抽一个，抽到 5 的可能性是（  ）', answer: '1/10', options: shuffle(['1/10', '1/9', '1/5', '9/10']), hint: '想一想：10 个数字里数字 5 只有 1 个，它占几分之几。' };
  }

  // ============ 综合统计 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 70) return buildPieChart();
    return buildPossibility();
  }

  var TYPE_BUILDERS = {
    'pie-chart': buildPieChart,
    'possibility': buildPossibility,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'pie-chart': '扇形统计图',
    'possibility': '可能性',
    mix: '综合统计'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-stats',
    moduleId: 'M9',
    name: '统计',
    pageSubtitle: '扇形统计图与可能性',
    grades: [6],
    subject: 'math',
    category: 'stats',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['math-g6-m9-g6-stat-pie-chart', 'math-g6-m9-g6-stat-possibility'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',          label: '综合统计' },
          { value: 'pie-chart',    label: '扇形统计图' },
          { value: 'possibility',  label: '可能性' }
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
        var q = { type: 'stats', q: p.q, answer: String(p.answer), hint: p.hint, svg: p.svg };
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
        title: '小学六年级统计（' + (TYPE_NAMES[type] || '综合统计') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);