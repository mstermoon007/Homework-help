/**
 * plugins/math-g5-stats.js — 五年级分类与整理插件（M9 分类与整理）
 *
 * 知识点覆盖（shared/knowledge-bank.js 五年级 M9 模块）：
 *   g5-m9-g5-stats-possib  可能性大小比较       （type: 'possibility-compare'）
 *   g5-m9-g5-stats-line1   单式折线统计图       （type: 'linechart-single'）
 *   g5-m9-g5-stats-line2   复式折线统计图       （type: 'linechart-double'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g5-stats.js 依赖 shared/common.js（PluginUtil），请先加载');


  // ============ 可能性大小比较 ============
  // 比较从不同袋子里摸到红球的可能性
  function buildPossibilityCompare() {
    var v = _PU.rand(['bigger', 'frac']);
    var red1 = _PU.randInt(1, 5), total1 = red1 + _PU.randInt(1, 5);
    var red2 = _PU.randInt(1, 5), total2 = red2 + _PU.randInt(1, 5);
    if (v === 'bigger') {
      var p1 = red1 / total1, p2 = red2 / total2;
      var ans = Math.abs(p1 - p2) < 1e-9 ? '一样大' : p1 > p2 ? '袋子一' : '袋子二';
      return { q: '袋子一有 ' + red1 + ' 个红球和 ' + (total1 - red1) + ' 个白球，袋子二有 ' + red2 + ' 个红球和 ' + (total2 - red2) + ' 个白球。摸到红球可能性大的是（袋子一/袋子二/一样大）', answer: ans, hint: '比较红球占总数比例：' + red1 + '/' + total1 + ' 和 ' + red2 + '/' + total2 + '。' };
    }
    var p = red1 + '/' + total1;
    return { q: '袋子有 ' + red1 + ' 个红球和 ' + (total1 - red1) + ' 个白球，摸到红球的可能性是（  ）', answer: p, hint: '可能性 = 红球个数 ÷ 总个数。' };
  }

  // ============ 折线图通用 SVG ============
  function lineSVG(vals, labels, second) {
    var W = 210, H = 130;
    var ox = 34, oy = 100, stepX = 32, stepY = 14;
    var maxV = Math.max.apply(null, vals.concat(second || []));
    if (maxV === 0) maxV = 1;
    var scale = stepY * 4 / maxV; // 高度限制在 4*stepY 内
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    // 网格
    for (var g = 0; g <= 4; g++) {
      var gy = oy - g * stepY;
      out += '<line x1="' + ox + '" y1="' + gy + '" x2="' + (ox + stepX * (vals.length - 1)) + '" y2="' + gy + '" stroke="#eef1f6" stroke-width="1"/>';
      out += '<text x="2" y="' + (gy + 4) + '" font-size="9" fill="#b3bccb">' + Math.round(maxV * g / 4) + '</text>';
    }
    // 坐标轴
    out += '<line x1="' + ox + '" y1="' + oy + '" x2="' + (ox + stepX * (vals.length - 1)) + '" y2="' + oy + '" stroke="#27324a" stroke-width="1.5"/>';
    out += '<line x1="' + ox + '" y1="' + oy + '" x2="' + ox + '" y2="' + (oy - 4 * stepY) + '" stroke="#27324a" stroke-width="1.5"/>';
    // 标签
    for (var i = 0; i < vals.length; i++) {
      out += '<text x="' + (ox + i * stepX - 6) + '" y="' + (oy + 14) + '" font-size="9" fill="#7a879c">' + (labels ? labels[i] : i + 1) + '</text>';
    }
    // 第一组数据
    for (var j = 0; j < vals.length; j++) {
      var px = ox + j * stepX, py = oy - vals[j] * scale;
      out += '<circle cx="' + px + '" cy="' + py + '" r="3" fill="#3f6fd1"/>';
      if (j > 0) out += '<line x1="' + (ox + (j - 1) * stepX) + '" y1="' + (oy - vals[j - 1] * scale) + '" x2="' + px + '" y2="' + py + '" stroke="#3f6fd1" stroke-width="2"/>';
    }
    // 第二组数据（复式）
    if (second) {
      for (var k = 0; k < second.length; k++) {
        var px2 = ox + k * stepX, py2 = oy - second[k] * scale;
        out += '<circle cx="' + px2 + '" cy="' + py2 + '" r="3" fill="#f2a93b"/>';
        if (k > 0) out += '<line x1="' + (ox + (k - 1) * stepX) + '" y1="' + (oy - second[k - 1] * scale) + '" x2="' + px2 + '" y2="' + py2 + '" stroke="#f2a93b" stroke-width="2"/>';
      }
    }
    out += '</svg>';
    return out;
  }

  // ============ 单式折线统计图 ============
  function buildLinechartSingle() {
    var v = _PU.rand(['value', 'max', 'trend']);
    var vals = [];
    for (var i = 0; i < 5; i++) vals.push(_PU.randInt(10, 90));
    var labels = ['周一', '周二', '周三', '周四', '周五'];
    var svg = lineSVG(vals, labels);
    var maxIdx = 0, minIdx = 0;
    for (var j = 1; j < 5; j++) { if (vals[j] > vals[maxIdx]) maxIdx = j; if (vals[j] < vals[minIdx]) minIdx = j; }
    if (v === 'value') {
      var idx = _PU.randInt(0, 4);
      return { q: '根据折线统计图，' + labels[idx] + ' 的气温是（  ）℃', answer: vals[idx], svg: svg, hint: '看' + labels[idx] + '对应的点的高度。' };
    }
    if (v === 'max') {
      return { q: '根据折线统计图，气温最高的一天是（  ）', answer: labels[maxIdx], options: _PU.shuffle(labels.slice()), svg: svg, hint: '找折线最高点对应的日期。' };
    }
    var trend = vals[4] > vals[0] ? '上升' : vals[4] < vals[0] ? '下降' : '不变';
    return { q: '根据折线统计图，这周气温整体呈（填：上升/下降/不变）趋势', answer: trend, svg: svg, hint: '比较第一天与最后一天。' };
  }

  // ============ 复式折线统计图 ============
  function buildLinechartDouble() {
    var v = _PU.rand(['value', 'diff', 'trend']);
    var vals1 = [], vals2 = [];
    for (var i = 0; i < 5; i++) { vals1.push(_PU.randInt(20, 80)); vals2.push(_PU.randInt(10, 70)); }
    var labels = ['一', '二', '三', '四', '五'];
    var svg = lineSVG(vals1, labels, vals2);
    if (v === 'value') {
      var idx = _PU.randInt(0, 4);
      var which = _PU.rand([0, 1]);
      var arr = which === 0 ? vals1 : vals2;
      var col = which === 0 ? '蓝色' : '橙色';
      return { q: '根据复式折线统计图，' + labels[idx] + '（' + col + '线）销售量是（  ）件', answer: arr[idx], svg: svg, hint: '看' + labels[idx] + '对应的' + col + '线的点。' };
    }
    if (v === 'diff') {
      var idx2 = _PU.randInt(0, 4);
      var d = Math.abs(vals1[idx2] - vals2[idx2]);
      return { q: '根据复式折线统计图，' + labels[idx2] + ' 两条线相差（  ）件', answer: d, svg: svg, hint: '两条线高度差。' };
    }
    var t1 = vals1[4] > vals1[0], t2 = vals2[4] > vals2[0];
    if (t1 === t2) return buildLinechartDouble();
    return { q: '根据复式折线统计图，销量上升的是（填：蓝色线/橙色线）', answer: t1 ? '蓝色线' : '橙色线', svg: svg, hint: '看哪条线从第一天到第五天是升高的。' };
  }

  // ============ 综合分类与整理 ============
  function buildMixed() {
    var r = _PU.randInt(1, 100);
    if (r <= 35) return buildPossibilityCompare();
    if (r <= 70) return buildLinechartSingle();
    return buildLinechartDouble();
  }

  var TYPE_BUILDERS = {
    'possibility-compare': buildPossibilityCompare,
    'linechart-single': buildLinechartSingle,
    'linechart-double': buildLinechartDouble,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'possibility-compare': '可能性大小比较',
    'linechart-single': '单式折线统计图',
    'linechart-double': '复式折线统计图',
    mix: '综合统计'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g5-stats',
    moduleId: 'M9',
    name: '分类与整理',
    pageSubtitle: '可能性比较与折线统计图',
    grades: [5],
    subject: 'math',
    category: 'statistics',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['math-g5-m9-g5-stats-possib', 'math-g5-m9-g5-stats-line1', 'math-g5-m9-g5-stats-line2'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',                 label: '综合统计' },
          { value: 'possibility-compare', label: '可能性大小比较' },
          { value: 'linechart-single',    label: '单式折线统计图' },
          { value: 'linechart-double',    label: '复式折线统计图' }
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
        title: '小学五年级分类与整理（' + (TYPE_NAMES[type] || '综合统计') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);