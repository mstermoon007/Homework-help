/**
 * plugins/math-g6-picture-equation.js — 六年级看图列式插件（M7 线段图与扇形统计图列式）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M7 模块）：
 *   g6-m7-g6-pic-frac-line    线段图（分数应用题）  （type: 'frac-line'）
 *   g6-m7-g6-pic-pie-chart    扇形统计图读图        （type: 'pie-chart'）
 *   g6-m7-g6-pic-scale        比例尺与正比例图象    （type: 'scale'）
 *
 * 每题带 SVG 示意图，学生看图列式并填空（text/choice 输入）。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-picture-equation.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function trimD(x) { return String(Number(x.toFixed(3))); }

  // ============ 线段图（分数应用题） ============
  function buildFracLine() {
    var v = pick(['part', 'total']);
    var d = pick([3, 4, 5, 6, 8]);
    var a = rnd(1, d - 1);
    var unit = rnd(3, 9) * d;
    if (v === 'part') {
      var part = unit * a / d;
      return { q: '看图列式：一袋大米 ' + unit + ' 千克，吃去它的 ' + a + '/' + d + '，吃去（  ）千克', answer: part, svg: segSVG(a, d), hint: '求一个数的几分之几用乘法：总量 × 对应的分数，自己算一算。' };
    }
    var given = unit * a / d;
    return { q: '看图列式：一段路行了全长的 ' + a + '/' + d + '，正好 ' + given + ' 千米，全长（  ）千米', answer: unit, svg: segSVG(a, d), hint: '已知一个数的几分之几是多少，求这个数用除法：用已知数量除以对应的分数。' };
  }
  function segSVG(a, d) {
    var W = 220, H = 78;
    var w = 180, x = 20;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    out += '<line x1="' + x + '" y1="8" x2="' + (x + w) + '" y2="8" stroke="#27324a" stroke-width="1.5"/>';
    out += '<line x1="' + x + '" y1="4" x2="' + x + '" y2="12" stroke="#27324a" stroke-width="1.5"/>';
    out += '<line x1="' + (x + w) + '" y1="4" x2="' + (x + w) + '" y2="12" stroke="#27324a" stroke-width="1.5"/>';
    for (var i = 1; i < d; i++) {
      var px = x + w * i / d;
      out += '<line x1="' + px + '" y1="8" x2="' + px + '" y2="12" stroke="#27324a" stroke-width="1"/>';
    }
    for (var j = 0; j < d; j++) {
      var fill = j < a ? 'rgba(242,169,59,.45)' : 'rgba(63,111,209,.15)';
      var stroke = j < a ? 'rgba(242,169,59,.7)' : 'rgba(63,111,209,.4)';
      out += '<rect x="' + (x + w * j / d) + '" y="16" width="' + (w / d) + '" height="14" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1"/>';
    }
    out += '<text x="' + (x + w * a / d + 3) + '" y="44" font-size="10" fill="#f2a93b">' + a + '/' + d + '</text>';
    out += '<text x="' + (x + w - 46) + '" y="44" font-size="10" fill="#7a879c">单位「1」</text>';
    out += '</svg>';
    return out;
  }

  // ============ 扇形统计图读图 ============
  function buildPieChart() {
    var v = pick(['count', 'pct', 'diff']);
    var parts = pick([[40, 30, 20, 10], [45, 25, 20, 10], [35, 25, 25, 15], [50, 25, 15, 10]]);
    var names = ['篮球', '足球', '乒乓球', '其他'];
    var total = rnd(2, 8) * 10;
    if (v === 'count') {
      var idx = rnd(0, 3);
      return { q: '看图列式：全班 ' + total + ' 人，根据扇形统计图，喜欢' + names[idx] + '的有（  ）人', answer: total * parts[idx] / 100, svg: pieReadSVG(parts, names), hint: '求一个数的百分之几用乘法：总数 × 对应的百分比，自己算一算。' };
    }
    if (v === 'pct') {
      var idx2 = rnd(0, 3);
      return { q: '看图列式：根据扇形统计图，喜欢' + names[idx2] + '的占全班的（  ）%', answer: parts[idx2], svg: pieReadSVG(parts, names), hint: '直接读图中 ' + names[idx2] + ' 对应的百分比。' };
    }
    var i3 = rnd(0, 3), j3 = rnd(0, 3);
    while (j3 === i3) j3 = rnd(0, 3);
    var diff = Math.abs(parts[i3] - parts[j3]);
    return { q: '看图列式：全班 ' + total + ' 人，喜欢' + names[i3] + '的比喜欢' + names[j3] + '的多（  ）人', answer: total * diff / 100, svg: pieReadSVG(parts, names), hint: '先算出两个百分比相差多少，再用总数乘这个差，自己算一算。' };
  }
  function pieReadSVG(parts, names) {
    var x0 = 55, y0 = 55, r = 34;
    var W = 150, H = 110;
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
      out += '<rect x="118" y="' + (ly - 8) + '" width="8" height="8" fill="' + colors[j] + '"/>';
      out += '<text x="130" y="' + ly + '" font-size="9" fill="#27324a">' + names[j] + ' ' + parts[j] + '%</text>';
      ly += 15;
    }
    out += '</svg>';
    return out;
  }

  // ============ 比例尺与正比例图象 ============
  function buildScale() {
    var v = pick(['map', 'map2', 'read', 'line', 'slope']);
    if (v === 'map') {
      var km = rnd(2, 6), cm = 3;
      return { q: '看图列式：地图比例尺 1:50000，图上 ' + cm + ' 厘米表示实际（  ）千米', answer: cm * 50000 / 100000, hint: '图上距离 × 比例尺的分母得实际厘米数，再把厘米换算成千米。' };
    }
    if (v === 'map2') {
      var km2 = rnd(2, 6) * 10, cm2 = km2 * 100000 / 100000;
      var scale = 100000;
      return { q: '实际距离 ' + km2 + ' 千米，比例尺 1:' + scale + '，图上距离是（  ）厘米', answer: km2 * 100000 / scale, hint: '图上距离 = 实际距离 × 比例尺，先把实际距离换算成厘米再除以比例尺的分母。' };
    }
    var k = rnd(2, 4);
    if (v === 'read') {
      var x = rnd(2, 5);
      return { q: '看图列式：正比例图象（y = ' + k + 'x），当 x = ' + x + ' 时，y =（  ）', answer: k * x, svg: lineSVG(k), hint: '把 x 的值代入关系式 y = ' + k + 'x，自己算一算。' };
    }
    if (v === 'line') {
      return { q: '看图列式：正比例图象是一条经过原点的（  ）', options: ['直线', '曲线', '折线'], answer: '直线', svg: lineSVG(2), hint: '正比例图象是过原点的一条直线。' };
    }
    return { q: '看图列式：图象是一条过原点的直线，说明 y ÷ x = k（一定），y 和 x 成（  ）比例', options: ['正', '反', '不成'], answer: '正', svg: lineSVG(3), hint: '比值一定，成正比例。' };
  }
  function lineSVG(k) {
    var W = 140, H = 120;
    var ox = 25, oy = 95, step = 15;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    for (var i = 0; i <= 7; i++) {
      out += '<line x1="' + (ox + i * step) + '" y1="' + oy + '" x2="' + (ox + i * step) + '" y2="' + (oy - 6 * step) + '" stroke="#eef1f6" stroke-width="1"/>';
    }
    for (var j = 0; j <= 6; j++) {
      out += '<line x1="' + ox + '" y1="' + (oy - j * step) + '" x2="' + (ox + 7 * step) + '" y2="' + (oy - j * step) + '" stroke="#eef1f6" stroke-width="1"/>';
    }
    out += '<line x1="' + ox + '" y1="' + oy + '" x2="' + (ox + 7 * step) + '" y2="' + oy + '" stroke="#27324a" stroke-width="1.5"/>';
    out += '<line x1="' + ox + '" y1="' + oy + '" x2="' + ox + '" y2="' + (oy - 6 * step) + '" stroke="#27324a" stroke-width="1.5"/>';
    out += '<polyline points="' + ox + ',' + oy + ' ' + (ox + 6 * step) + ',' + (oy - 6 * k * step / 4) + '" fill="none" stroke="#3f6fd1" stroke-width="2.5"/>';
    out += '</svg>';
    return out;
  }

  // ============ 综合看图列式 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 40) return buildFracLine();
    if (r <= 70) return buildPieChart();
    return buildScale();
  }

  var TYPE_BUILDERS = {
    'frac-line': buildFracLine,
    'pie-chart': buildPieChart,
    'scale': buildScale,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'frac-line': '线段图（分数应用题）',
    'pie-chart': '扇形统计图读图',
    'scale': '比例尺与正比例图象',
    mix: '综合看图列式'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-picture-equation',
    moduleId: 'M7',
    name: '看图列式',
    pageSubtitle: '分数线段图、扇形统计图与比例尺、正比例图象',
    grades: [6],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['math-g6-m7-g6-pic-frac-line', 'math-g6-m7-g6-pic-pie-chart', 'math-g6-m7-g6-pic-scale'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',        label: '综合看图列式' },
          { value: 'frac-line',  label: '线段图（分数应用题）' },
          { value: 'pie-chart',  label: '扇形统计图读图' },
          { value: 'scale',      label: '比例尺与正比例图象' }
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
        var q = { type: 'picture', q: p.q, answer: String(p.answer), hint: p.hint, svg: p.svg };
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
        title: '小学六年级看图列式（' + (TYPE_NAMES[type] || '综合看图列式') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);