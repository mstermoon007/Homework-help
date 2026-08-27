/**
 * plugins/math-g4-stats.js — 四年级分类与整理插件（M9 分类整理）
 *
 * 知识点覆盖（shared/knowledge-bank.js 四年级 M9 模块）：
 *   g4-m9-g4-stats-bar     条形统计图（1 格表示多个单位）  （type: 'bar-chart'）
 *   g4-m9-g4-stats-double  复式条形统计图                （type: 'double-bar'）
 *   g4-m9-g4-stats-avg     平均数与统计                  （type: 'avg-stats'）
 *
 * 提供标准 ExercisePlugin 接口。随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g4-stats.js 依赖 shared/common.js（PluginUtil），请先加载');

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

  // 生成一组 3~5 个项目的统计值（条形图）
  function genData(items, unit) {
    var vals = [];
    for (var i = 0; i < items.length; i++) vals.push(rnd(2, 9));
    return { items: items, vals: vals, unit: unit };
  }

  // ============ 条形统计图（1 格表示多个单位） ============
  function buildBarChart() {
    var v = pick(['read', 'max', 'total', 'scale']);
    var fruits = pick([
      ['苹果', '香蕉', '梨', '橘子'],
      ['语文', '数学', '英语', '科学'],
      ['周一', '周二', '周三', '周四'],
      ['篮球', '足球', '乒乓球', '羽毛球'],
      ['小猫', '小狗', '小兔', '小猴']
    ]);
    var unit = fruits[0] === '语文' ? '人' : (fruits[0] === '周一' ? '本' : '个');
    if (fruits[0] === '篮球') unit = '人';
    var data = genData(fruits, unit);
    var per = pick([1, 2, 5]); // 1 格表示 per 个单位
    var scaleVals = data.vals.map(function (x) { return x * per; });
    var svg = barChartSVG(fruits, scaleVals, per, unit);
    if (v === 'read') {
      var idx = rnd(0, fruits.length - 1);
      return { q: '根据统计图，' + fruits[idx] + ' 有（  ）' + unit,
        answer: scaleVals[idx], svg: svg,
        hint: '看 ' + fruits[idx] + ' 对应的条形占几格，乘以 1 格代表的数。' };
    }
    if (v === 'max') {
      var mi = 0;
      for (var i = 1; i < scaleVals.length; i++) if (scaleVals[i] > scaleVals[mi]) mi = i;
      return { q: '根据统计图，数量最多的是（  ）', answer: fruits[mi], options: shuffle(fruits.slice()),
        svg: svg, hint: '找条形最高的那个项目。' };
    }
    if (v === 'total') {
      var total = scaleVals.reduce(function (a, b) { return a + b; }, 0);
      return { q: '根据统计图，' + fruits.length + ' 种' + unit + '一共（  ）' + unit,
        answer: total, svg: svg, hint: '把各条形表示的数值加起来。' };
    }
    return { q: '统计图中 1 格表示（  ）个' + unit, answer: per, svg: svg,
      hint: '看纵轴上的刻度，相邻两刻度相差多少。' };
  }

  function barChartSVG(items, vals, per, unit) {
    var H = 150, W = 150, barW = 22, gap = 20, baseY = 118;
    var maxV = Math.max.apply(null, vals);
    var pxPerUnit = 90 / maxV;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    // 轴
    out += '<line x1="18" y1="10" x2="18" y2="' + baseY + '" stroke="#9aa7b8" stroke-width="1.5"/>';
    out += '<line x1="18" y1="' + baseY + '" x2="' + W + '" y2="' + baseY + '" stroke="#9aa7b8" stroke-width="1.5"/>';
    for (var i = 0; i < items.length; i++) {
      var x = 30 + i * (barW + gap);
      var h = Math.round(vals[i] * pxPerUnit);
      var y = baseY - h;
      out += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + h + '" fill="rgba(63,111,209,.55)" stroke="#3f6fd1" stroke-width="1.5"/>';
      out += '<text x="' + (x + barW / 2) + '" y="' + (y - 4) + '" font-size="10" fill="#3f6fd1" text-anchor="middle" font-weight="700">' + vals[i] + '</text>';
      out += '<text x="' + (x + barW / 2) + '" y="' + (baseY + 12) + '" font-size="10" fill="#27324a" text-anchor="middle">' + items[i] + '</text>';
    }
    // 纵轴刻度提示（1 格代表）
    out += '<text x="50" y="130" font-size="9" fill="#7a879c">1 格 = ' + per + ' ' + unit + '</text>';
    return out + '</svg>';
  }

  // ============ 复式条形统计图 ============
  function buildDoubleBar() {
    var v = pick(['read', 'compare', 'total']);
    var cats = pick([
      ['一班', '二班', '三班'],
      ['周一', '周二', '周三'],
      ['第一组', '第二组', '第三组']
    ]);
    var units = pick(['男生', '女生']);
    var vals1 = [], vals2 = [];
    for (var i = 0; i < cats.length; i++) { vals1.push(rnd(2, 9)); vals2.push(rnd(2, 9)); }
    var svg = doubleBarSVG(cats, units, vals1, vals2);
    if (v === 'read') {
      var ci = rnd(0, cats.length - 1);
      var ui = rnd(0, 1);
      var val = ui === 0 ? vals1[ci] : vals2[ci];
      return { q: '根据统计图，' + cats[ci] + ' 的' + units[ui] + '有（  ）人',
        answer: val, svg: svg, hint: '看 ' + cats[ci] + ' 下面' + (ui === 0 ? '蓝色' : '橙色') + '条形的高度。' };
    }
    if (v === 'compare') {
      // 找某类男女差
      var ci2 = rnd(0, cats.length - 1);
      var diff = Math.abs(vals1[ci2] - vals2[ci2]);
      return { q: '根据统计图，' + cats[ci2] + ' 男生比女生多（  ）人', answer: diff,
        svg: svg, hint: '男生人数 − 女生人数 = ？' };
    }
    var total = vals1.reduce(function (a, b) { return a + b; }, 0) + vals2.reduce(function (a, b) { return a + b; }, 0);
    return { q: '根据统计图，' + cats.length + ' 个班男女生一共（  ）人', answer: total,
      svg: svg, hint: '把所有条形表示的人数相加。' };
  }

  function doubleBarSVG(cats, units, v1, v2) {
    var H = 155, W = 155, barW = 12, gap = 22, baseY = 120;
    var allV = v1.concat(v2);
    var maxV = Math.max.apply(null, allV);
    var pxPerUnit = 90 / maxV;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    out += '<line x1="18" y1="10" x2="18" y2="' + baseY + '" stroke="#9aa7b8" stroke-width="1.5"/>';
    out += '<line x1="18" y1="' + baseY + '" x2="' + W + '" y2="' + baseY + '" stroke="#9aa7b8" stroke-width="1.5"/>';
    for (var i = 0; i < cats.length; i++) {
      var x = 28 + i * gap;
      var h1 = Math.round(v1[i] * pxPerUnit), h2 = Math.round(v2[i] * pxPerUnit);
      out += '<rect x="' + x + '" y="' + (baseY - h1) + '" width="' + barW + '" height="' + h1 + '" fill="rgba(63,111,209,.6)" stroke="#3f6fd1" stroke-width="1.2"/>';
      out += '<rect x="' + (x + barW + 1) + '" y="' + (baseY - h2) + '" width="' + barW + '" height="' + h2 + '" fill="rgba(255,107,107,.6)" stroke="#ff6b6b" stroke-width="1.2"/>';
      out += '<text x="' + (x + barW / 2) + '" y="' + (baseY + 12) + '" font-size="9" fill="#27324a" text-anchor="middle">' + cats[i] + '</text>';
    }
    out += '<rect x="' + (W - 34) + '" y="12" width="10" height="8" fill="rgba(63,111,209,.6)" stroke="#3f6fd1" stroke-width="1"/>';
    out += '<text x="' + (W - 22) + '" y="20" font-size="9" fill="#27324a">' + units[0] + '</text>';
    out += '<rect x="' + (W - 34) + '" y="24" width="10" height="8" fill="rgba(255,107,107,.6)" stroke="#ff6b6b" stroke-width="1"/>';
    out += '<text x="' + (W - 22) + '" y="32" font-size="9" fill="#27324a">' + units[1] + '</text>';
    return out + '</svg>';
  }

  // ============ 平均数与统计 ============
  function buildAvgStats() {
    var v = pick(['avg', 'recover']);
    var names = pick([
      ['小红', '小明', '小刚', '小丽'],
      ['第一组', '第二组', '第三组', '第四组']
    ]);
    var vals = [];
    for (var i = 0; i < 4; i++) vals.push(rnd(10, 30));
    var avg = Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / 4);
    var svg = listSVG(names, vals);
    if (v === 'avg') {
      return { q: names.join('、') + ' 收集的矿泉水瓶分别是 ' + vals.join('、') + ' 个，平均每人收集（  ）个',
        answer: avg, svg: svg, hint: '平均数 = 总数 ÷ 人数 = (' + vals.join('+') + ')÷4。' };
    }
    // 已知平均数和 3 个数据求第 4 个
    var a1 = vals[0], a2 = vals[1], a3 = vals[2];
    var a4 = avg * 4 - a1 - a2 - a3;
    return { q: names[0] + '、' + names[1] + '、' + names[2] + ' 分别收集了 ' + a1 + '、' + a2 + '、' + a3 + ' 个，' + names[3] + ' 收集了（  ）个，他们平均收集 ' + avg + ' 个',
      answer: a4, svg: svg, hint: '第 4 个数 = 平均数 × 4 − 前三个数之和。' };
  }

  function listSVG(names, vals) {
    var W = 170, H = 84;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    for (var i = 0; i < names.length; i++) {
      var y = 12 + i * 18;
      out += '<text x="6" y="' + (y + 8) + '" font-size="11" fill="#27324a">' + names[i] + '</text>';
      out += '<rect x="40" y="' + y + '" width="' + (vals[i] * 3) + '" height="12" fill="rgba(63,111,209,.4)" stroke="#3f6fd1" stroke-width="1.2"/>';
      out += '<text x="' + (40 + vals[i] * 3 + 4) + '" y="' + (y + 11) + '" font-size="10" fill="#3f6fd1">' + vals[i] + '</text>';
    }
    return out + '</svg>';
  }

  // ============ 综合统计 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 40) return buildBarChart();
    if (r <= 75) return buildDoubleBar();
    return buildAvgStats();
  }

  var TYPE_BUILDERS = {
    'bar-chart': buildBarChart,
    'double-bar': buildDoubleBar,
    'avg-stats': buildAvgStats,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'bar-chart': '条形统计图',
    'double-bar': '复式条形统计图',
    'avg-stats': '平均数与统计',
    mix: '综合统计'
  };

  var plugin = _PU.createPlugin({
    id: 'math-g4-stats',
    moduleId: 'M9',
    name: '分类与整理',
    pageSubtitle: '条形统计图、复式条形统计图与平均数',
    grades: [4],
    subject: 'math',
    category: 'statistics',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['math-g4-m9-g4-stats-bar', 'math-g4-m9-g4-stats-double', 'math-g4-m9-g4-stats-avg'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',         label: '综合统计' },
          { value: 'bar-chart',   label: '条形统计图' },
          { value: 'double-bar',  label: '复式条形统计图' },
          { value: 'avg-stats',   label: '平均数与统计' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 50, 300);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = p.q + '|' + p.answer;
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        var q = { type: 'stats', q: p.q, answer: String(p.answer), svg: p.svg, hint: p.hint };
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
        title: '小学四年级统计练习（' + (TYPE_NAMES[type] || '综合统计') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);