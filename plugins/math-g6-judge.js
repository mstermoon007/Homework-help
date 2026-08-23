/**
 * plugins/math-g6-judge.js — 六年级判断题插件（M11 易错概念判断）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M11 模块）：
 *   g6-m11-g6-judge-circle        圆                  （type: 'circle'）
 *   g6-m11-g6-judge-cyl-cone      圆柱与圆锥          （type: 'cyl-cone'）
 *   g6-m11-g6-judge-negative      负数                （type: 'negative'）
 *   g6-m11-g6-judge-percent-ratio 百分数与比          （type: 'percent-ratio'）
 *   g6-m11-g6-judge-chart         扇形统计图          （type: 'chart'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-judge.js 依赖 shared/common.js（PluginUtil），请先加载');

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

  // ============ 圆 ============
  function buildCircle() {
    return pick([
      { q: '在同一个圆里，直径是半径的 2 倍。', right: true, hint: 'd = 2r。' },
      { q: '圆的周长与直径的比值是 π。', right: true, hint: 'π 是圆周率。' },
      { q: '半径 2 厘米的圆的周长和面积相等。', right: false, hint: '数值都是 12.56，但周长是长度、面积是大小，不能比较。' },
      { q: '半圆的周长等于圆周长的一半。', right: false, hint: '还要加上直径的长度。' },
      { q: '圆的半径扩大到原来的 2 倍，周长也扩大到原来的 2 倍。', right: true, hint: '周长 = 2πr，与半径成正比。' },
      { q: '圆的半径扩大到原来的 2 倍，面积扩大到原来的 2 倍。', right: false, hint: '面积 = πr²，扩大到原来的 4 倍。' },
      { q: 'π 是一个无限不循环小数。', right: true, hint: 'π ≈ 3.14159……' },
      { q: '圆是轴对称图形，有无数条对称轴。', right: true, hint: '任意一条直径所在直线都是对称轴。' },
      { q: '圆心决定圆的位置，半径决定圆的大小。', right: true, hint: '圆的要素。' }
    ]);
  }

  // ============ 圆柱与圆锥 ============
  function buildCylCone() {
    return pick([
      { q: '圆柱有无数条高。', right: true, hint: '两个底面间的距离处处相等。' },
      { q: '圆锥的体积是圆柱体积的 1/3。', right: false, hint: '必须等底等高时才是 1/3。' },
      { q: '圆柱的侧面沿高展开是一个长方形。', right: true, hint: '底面周长 = 长，高 = 宽。' },
      { q: '圆锥只有 1 条高。', right: true, hint: '顶点到底面圆心的距离。' },
      { q: '圆柱的体积 = 底面积 × 高。', right: true, hint: '圆柱体积公式。' },
      { q: '圆柱的侧面展开一定是一个长方形。', right: false, hint: '只有沿高展开才是长方形。' },
      { q: '圆锥的体积 = 底面积 × 高 ÷ 3。', right: true, hint: '圆锥体积公式。' },
      { q: '圆柱有 2 个底面，圆锥有 1 个底面。', right: true, hint: '立体图形的特征。' },
      { q: '等底等高的圆柱体积是圆锥体积的 3 倍。', right: true, hint: '圆柱与圆锥的关系。' }
    ]);
  }

  // ============ 负数 ============
  function buildNegative() {
    return pick([
      { q: '0 既不是正数也不是负数。', right: true, hint: '0 是正负数的分界。' },
      { q: '负数都比 0 小。', right: true, hint: '负数小于 0。' },
      { q: '−5 比 −3 大。', right: false, hint: '−5 < −3。' },
      { q: '气温 −2℃ 比 −6℃ 高。', right: true, hint: '−2 > −6。' },
      { q: '温度上升 3℃ 记作 +3℃，下降 3℃ 记作 −3℃。', right: true, hint: '相反意义的量。' },
      { q: '正数都比负数大。', right: true, hint: '正数 > 0 > 负数。' },
      { q: '数轴上，−1 在 1 的左边。', right: true, hint: '数轴左小右大。' },
      { q: '整数包括正整数、0 和负整数。', right: true, hint: '整数的分类。' }
    ]);
  }

  // ============ 百分数与比 ============
  function buildPercentRatio() {
    var r = rnd(1, 100);
    if (r <= 50) {
      return pick([
        { q: '百分数也叫百分率或百分比。', right: true, hint: '百分数的别名。' },
        { q: '百分数的分母是 100。', right: false, hint: '百分数通常不写成分数形式，不讨论分母。' },
        { q: '一件商品先提价 10%，再降价 10%，价格不变。', right: false, hint: '提价后价格 × 110%，再降 10% 后为原价的 99%。' },
        { q: '1/4 改写成百分数是 25%。', right: true, hint: '1 ÷ 4 = 0.25 = 25%。' },
        { q: '出勤率 = 出勤人数 ÷ 总人数 × 100%。', right: true, hint: '出勤率公式。' },
        { q: '百分数可以超过 100%。', right: true, hint: '如增长率可以超过 100%。' },
        { q: '小数 0.5 改写成百分数是 5%。', right: false, hint: '0.5 = 50%。' },
        { q: '百分数表示一个数是另一个数的百分之几。', right: true, hint: '百分数的意义。' }
      ]);
    }
    return pick([
      { q: '比的前项和后项同时乘或除以相同的数（0 除外），比值不变。', right: true, hint: '比的基本性质。' },
      { q: '比的后项可以是任意数。', right: false, hint: '比的后项不能是 0。' },
      { q: '足球比赛 2:0 中的比和我们学的比意义相同。', right: false, hint: '比赛比分不是数学中的比。' },
      { q: '比值通常用分数、小数或整数表示。', right: true, hint: '比值是一个数。' },
      { q: '比的前项相当于除法中的被除数。', right: true, hint: '比、分数、除法三者的关系。' },
      { q: '一个比的前项是 5，后项是 2，比值是 2.5。', right: true, hint: '5 ÷ 2 = 2.5。' },
      { q: '最简整数比的前项和后项都是整数且互质。', right: true, hint: '最简整数比的定义。' },
      { q: '正方形的边长和周长成正比例。', right: true, hint: '周长 ÷ 边长 = 4（一定）。' },
      { q: '正方形的面积和边长成正比例。', right: false, hint: '面积 ÷ 边长 = 边长（不一定）。' },
      { q: '圆的周长和直径成正比例。', right: true, hint: '周长 ÷ 直径 = π（一定）。' },
      { q: '路程一定，速度和时间成反比例。', right: true, hint: '速度 × 时间 = 路程（一定）。' },
      { q: '圆柱体积一定，底面积和高成反比例。', right: true, hint: '底面积 × 高 = 体积（一定）。' },
      { q: '比例尺 = 图上距离 × 实际距离。', right: false, hint: '比例尺 = 图上距离 ÷ 实际距离。' },
      { q: '在比例中，两个内项的积等于两个外项的积。', right: true, hint: '比例的基本性质。' },
      { q: '正比例图象是一条过原点的直线。', right: true, hint: '正比例图象。' }
    ]);
  }

  // ============ 扇形统计图 ============
  function buildChart() {
    return pick([
      { q: '扇形统计图能清楚地表示各部分与总数之间的关系。', right: true, hint: '扇形统计图的特点。' },
      { q: '折线统计图能反映数量的增减变化情况。', right: true, hint: '折线统计图的特点。' },
      { q: '条形统计图适合表示各部分与整体的关系。', right: false, hint: '条形图适合比较数量多少，扇形图适合表示与整体的关系。' },
      { q: '扇形统计图中，各部分百分比之和是 100%。', right: true, hint: '整体是 100%。' },
      { q: '扇形统计图中，占 30% 的部分，圆心角是 108°。', right: true, hint: '360° × 30% = 108°。' },
      { q: '要表示气温变化趋势应选用扇形统计图。', right: false, hint: '应选用折线统计图。' }
    ]);
  }

  // ============ 综合判断 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 25) return buildCircle();
    if (r <= 50) return buildCylCone();
    if (r <= 68) return buildNegative();
    if (r <= 88) return buildPercentRatio();
    return buildChart();
  }

  var TYPE_BUILDERS = {
    'circle': buildCircle,
    'cyl-cone': buildCylCone,
    'negative': buildNegative,
    'percent-ratio': buildPercentRatio,
    'chart': buildChart,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'circle': '圆',
    'cyl-cone': '圆柱与圆锥',
    'negative': '负数',
    'percent-ratio': '百分数与比',
    'chart': '扇形统计图',
    mix: '综合判断'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-judge',
    moduleId: 'M11',
    name: '判断题',
    pageSubtitle: '圆、圆柱圆锥、负数、百分数与比、扇形统计图',
    grades: [6],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'g6-m11-g6-judge-circle',
        'g6-m11-g6-judge-cyl-cone',
        'g6-m11-g6-judge-negative',
        'g6-m11-g6-judge-percent-ratio',
        'g6-m11-g6-judge-chart'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',           label: '综合判断' },
          { value: 'circle',        label: '圆' },
          { value: 'cyl-cone',      label: '圆柱与圆锥' },
          { value: 'negative',      label: '负数' },
          { value: 'percent-ratio', label: '百分数与比' },
          { value: 'chart',         label: '扇形统计图' }
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
        return { type: 'judge', q: p.q, answer: p.right ? '√' : '×', options: shuffle(['√', '×']), hint: p.hint, inputType: 'choice' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学六年级判断练习（' + (TYPE_NAMES[type] || '综合判断') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);