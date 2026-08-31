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

  function comb2(n, m) {
    if (m < 0 || m > n) return 0;
    m = Math.min(m, n - m);
    var r = 1;
    for (var i = 1; i <= m; i++) r = r * (n - m + i) / i;
    return Math.round(r);
  }

  var NAME_POOL = ['步行', '乘车', '骑车', '其他', '地铁', '坐公交', '家长接送', '步行上学'];
  function pickNames() {
    var s = _PU.shuffle(NAME_POOL);
    return [s[0], s[1], s[2], s[3]];
  }
  function genParts() {
    var raw = [_PU.randInt(1, 40), _PU.randInt(1, 40), _PU.randInt(1, 40), _PU.randInt(1, 40)];
    var sum = raw[0] + raw[1] + raw[2] + raw[3];
    var parts = raw.map(function (x) { return Math.max(3, Math.round(x * 100 / sum)); });
    var diff = 100 - (parts[0] + parts[1] + parts[2] + parts[3]);
    parts[_PU.randInt(0, 3)] += diff;
    if (parts[0] < 1) parts[0] = 1;
    return parts;
  }

  // ============ 扇形统计图 ============
  function buildPieChart() {
    var v = _PU.rand(['total', 'angle', 'part', 'count', 'pct', 'diff']);
    var scope = _PU.rand(['全校', '全年级', '六年级', '三年级', '学校']);
    if (v === 'total') {
      var total = _PU.randInt(2, 12) * 100;
      var p = _PU.rand([5, 10, 15, 20, 25, 30, 40, 45, 50, 60]);
      return { q: scope + '共有学生 ' + total + ' 人，合唱团人数占' + scope + '的 ' + p + '%，合唱团有（  ）人', answer: total * p / 100, hint: '求一个数的百分之几用乘法：总数 × 对应的百分比，自己算一算。' };
    }
    if (v === 'angle') {
      var p2 = _PU.randInt(3, 50);
      return { q: '制作扇形统计图时，占总数的 ' + p2 + '% 的部分，应画圆心角（  ）°的扇形', answer: p2 * 360 / 100, hint: '圆心角 = 百分比 × 360° = ' + p2 + '% × 360°。' };
    }
    if (v === 'part') {
      var p3 = _PU.randInt(8, 92);
      if (p3 === 50) p3 = 48;
      return { q: '扇形统计图中，某部分占 ' + p3 + '%，另一部分占 ' + (100 - p3) + '%，两个扇形的圆心角相差（  ）°', answer: Math.abs(p3 - (100 - p3)) * 360 / 100, hint: '先算出两个百分比相差多少，再乘 360°（每 1% 对应 3.6°）。' };
    }
    var parts = genParts();
    var names = pickNames();
    var total2 = _PU.randInt(2, 12) * 20;
    if (v === 'count') {
      var idx = _PU.randInt(0, 3);
      return { q: '根据扇形统计图，' + scope + total2 + ' 名同学中，' + names[idx] + '上学的有（  ）人', answer: total2 * parts[idx] / 100, svg: pieSVG(parts, names), hint: '求一个数的百分之几用乘法：总数 × 对应的百分比，自己算一算。' };
    }
    if (v === 'pct') {
      var idx2 = _PU.randInt(0, 3);
      return { q: '根据扇形统计图，' + names[idx2] + '上学的占' + scope + '人数的（  ）%', answer: parts[idx2], svg: pieSVG(parts, names), hint: '直接读图中 ' + names[idx2] + ' 对应的百分比。' };
    }
    var i3 = _PU.randInt(0, 3), j3 = _PU.randInt(0, 3);
    while (j3 === i3) j3 = _PU.randInt(0, 3);
    var diff = Math.abs(parts[i3] - parts[j3]);
    return { q: '根据扇形统计图，' + scope + total2 + ' 人，' + names[i3] + '的比' + names[j3] + '的多（  ）人', answer: total2 * diff / 100, svg: pieSVG(parts, names), hint: '先算出两个百分比相差多少，再用总数乘这个差，自己算一算。' };
  }
  function pieSVG(parts, names) {
    var x0 = 55, y0 = 55, r = 32;
    var W = 145, H = 110;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    var start = -90;
    var colors = ['#3f6fd1', '#f2a93b', '#59b88f', '#c7d0dd']; /* allow-color */
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
    var v = _PU.rand(['coinBin', 'ball', 'even', 'certain', 'draw', 'dice', 'spinner', 'diceLt', 'diceGt', 'bag3']);
    if (v === 'coinBin') {
      var n = _PU.randInt(2, 6);
      var m = _PU.randInt(0, n);
      var total = Math.pow(2, n);
      var ways = comb2(n, m);
      var ans = ways + '/' + total;
      var others = _PU.shuffle([ways + '/' + total, comb2(n, m - 1) + '/' + total, (total - ways) + '/' + total, '1/' + total]);
      return { q: '抛 ' + n + ' 枚均匀的硬币，恰好有 ' + m + ' 枚正面朝上的可能性是（  ）', answer: ans, options: others, hint: '共有 2^' + n + ' 种等可能结果，恰好 ' + m + ' 枚正面有 C(' + n + ',' + m + ')=' + ways + ' 种，占 ' + ways + '/' + total + '。' };
    }
    if (v === 'ball') {
      var red = _PU.randInt(2, 9), white = _PU.randInt(1, 7);
      return { q: '袋子里有 ' + red + ' 个红球和 ' + white + ' 个白球，任意摸出一个，摸到红球的可能性是（  ）', answer: red + '/' + (red + white), options: _PU.shuffle([red + '/' + (red + white), white + '/' + (red + white), '1/' + (red + white), '1']), hint: '可能性 = 红球个数 ÷ 球的总数 = ' + red + ' ÷ ' + (red + white) + '。' };
    }
    if (v === 'even') {
      var ne = 2 * _PU.randInt(3, 12);
      return { q: '从 1 到 ' + ne + ' 中任意抽取一个数，抽到偶数的可能性是（  ）', answer: '1/2', options: _PU.shuffle(['1/2', '1/3', '2/3', '1/' + ne]), hint: '想一想：1 到 ' + ne + ' 里偶数有几个，占全部的几分之几。' };
    }
    if (v === 'certain') {
      var cnt = _PU.randInt(3, 9);
      return { q: '盒子里有 ' + cnt + ' 个球，全是红球。任意摸出一个，摸到红球的可能性是（  ）', answer: '1', options: _PU.shuffle(['1', '1/2', '1/' + cnt, '0']), hint: '所有结果都是红球，是必然事件。' };
    }
    if (v === 'draw') {
      var d = _PU.randInt(2, 12);
      var digit = _PU.randInt(0, d);
      return { q: '从 0 到 ' + d + ' 这 ' + (d + 1) + ' 个数字中任意抽一个，抽到 ' + digit + ' 的可能性是（  ）', answer: '1/' + (d + 1), options: _PU.shuffle(['1/' + (d + 1), '1/' + d, '1/' + (d + 2), '1']), hint: (d + 1) + ' 个数字里指定的那个只有 1 个，占几分之几。' };
    }
    if (v === 'dice') {
      var face = _PU.randInt(1, 6);
      return { q: '掷一枚均匀的骰子，朝上的点数是 ' + face + ' 的可能性是（  ）', answer: '1/6', options: _PU.shuffle(['1/6', '1/3', '1/2', '1']), hint: '骰子有 6 个面，每个面朝上的可能性相等。' };
    }
    if (v === 'spinner') {
      var k = _PU.rand([3, 4, 5, 6, 8, 10]);
      return { q: '转盘被平均分成 ' + k + ' 等份，指针指向其中任意一份的可能性是（  ）', answer: '1/' + k, options: _PU.shuffle(['1/' + k, '1/' + (k - 1), '1/' + (k + 1), '1']), hint: k + ' 等份中指定一份占 1/' + k + '。' };
    }
    if (v === 'diceLt') {
      var ml = _PU.randInt(2, 6);
      return { q: '掷一枚均匀的骰子，朝上的点数小于 ' + ml + ' 的可能性是（  ）', answer: (ml - 1) + '/6', options: _PU.shuffle([(ml - 1) + '/6', (7 - ml) + '/6', '1/2', '1/6']), hint: '点数小于 ' + ml + ' 的有 1 到 ' + (ml - 1) + ' 共 ' + (ml - 1) + ' 种结果，占 6 份中的 ' + (ml - 1) + ' 份。' };
    }
    if (v === 'diceGt') {
      var mg = _PU.randInt(1, 5);
      return { q: '掷一枚均匀的骰子，朝上的点数大于 ' + mg + ' 的可能性是（  ）', answer: (6 - mg) + '/6', options: _PU.shuffle([(6 - mg) + '/6', mg + '/6', '1/2', '1/6']), hint: '点数大于 ' + mg + ' 的有 ' + (mg + 1) + ' 到 6 共 ' + (6 - mg) + ' 种结果，占 6 份中的 ' + (6 - mg) + ' 份。' };
    }
    var r2 = _PU.randInt(2, 7), w2 = _PU.randInt(1, 6), b2 = _PU.randInt(1, 6);
    var tot3 = r2 + w2 + b2;
    var want = _PU.randInt(0, 2);
    var nm = want === 0 ? ('红') : (want === 1 ? '白' : '蓝');
    var cc = want === 0 ? r2 : (want === 1 ? w2 : b2);
    return { q: '袋子里有 ' + r2 + ' 个红球、' + w2 + ' 个白球和 ' + b2 + ' 个蓝球，任意摸出一个，摸到' + nm + '球的可能性是（  ）', answer: cc + '/' + tot3, options: _PU.shuffle([cc + '/' + tot3, (tot3 - cc) + '/' + tot3, '1/' + tot3, '1']), hint: '可能性 = ' + nm + '球个数 ÷ 球的总数 = ' + cc + ' ÷ ' + tot3 + '。' };
  }

  // ============ 综合统计 ============
  function buildMixed() {
    var r = _PU.randInt(1, 100);
    if (r <= 78) return buildPieChart();
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