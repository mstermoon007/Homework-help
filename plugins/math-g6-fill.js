/**
 * plugins/math-g6-fill.js — 六年级填空题插件（M4 概念公式与单位换算填空）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M4 模块）：
 *   g6-m4-g6-fill-negative      负数的意义与读写        （type: 'negative'）
 *   g6-m4-g6-fill-percent       百分数的意义、互化与折扣（type: 'percent'）
 *   g6-m4-g6-fill-ratio         比和比例的基本性质      （type: 'ratio'）
 *   g6-m4-g6-fill-circle        圆的周长与面积公式      （type: 'circle'）
 *   g6-m4-g6-fill-cylinder-cone 圆柱侧面积、表面积、体积与圆锥体积（type: 'cylinder-cone'）
 *   g6-m4-g6-fill-pie-chart     扇形统计图的特点        （type: 'pie-chart'）
 *   g6-m4-unit-convert  单位换算                （type: 'unit-convert'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-fill.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function trimD(x) { return String(Number(x.toFixed(3))); }
  var PI3 = 3.14;

  // ============ 负数的意义与读写 ============
  function buildNegative() {
    var v = pick(['money', 'read', 'temp', 'zero']);
    if (v === 'money') {
      var out = rnd(2, 9) * 10;
      return { q: '如果 +200 元表示收入 200 元，那么 −' + out + ' 元表示（  ）', answer: '支出' + out + '元', hint: '用正负数表示相反意义的量，负号表示支出。' };
    }
    if (v === 'read') {
      var n = rnd(2, 9);
      return { q: '−' + n + ' 读作（  ）', answer: '负' + n, hint: '负号读作「负」。' };
    }
    if (v === 'temp') {
      var a = rnd(2, 9);
      return { q: '零下 ' + a + '℃ 记作 −' + a + '℃，零上 ' + a + '℃ 记作（  ）℃', answer: a, hint: '零上用正数表示。' };
    }
    return { q: '0 既不是正数，也不是（  ）', answer: '负数', hint: '0 是正数和负数的分界点。' };
  }

  // ============ 百分数的意义、互化与折扣 ============
  function buildPercent() {
    var v = pick(['discount', 'toPct', 'meaning', 'tofrac']);
    if (v === 'discount') {
      var pair = pick([[65, '六五'], [85, '八五'], [90, '九'], [75, '七五'], [80, '八'], [50, '五']]);
      return { q: pair[1] + '折写成百分数是（  ）%', answer: pair[0], hint: '几几折就是百分之几十几。' };
    }
    if (v === 'toPct') {
      var tenths = pick([15, 25, 35, 45, 60, 85, 95]);
      var dec = tenths / 100;
      return { q: trimD(dec) + ' =（  ）%', answer: tenths + '%', hint: '小数化成百分数：小数点向右移动两位，添上百分号。' };
    }
    if (v === 'meaning') {
      return { q: '表示一个数是另一个数的百分之几的数，叫（  ）', answer: '百分数', hint: '百分数也叫百分率或百分比。' };
    }
    var pair2 = pick([[50, '1/2'], [25, '1/4'], [75, '3/4'], [20, '1/5'], [80, '4/5']]);
    return { q: pair2[0] + '% =（  ）（填分数）', answer: pair2[1], hint: '先写成分母是 100 的分数再约分。' };
  }

  // ============ 比和比例的基本性质 ============
  function buildRatio() {
    var v = pick(['chain', 'basic', 'prop', 'solve']);
    if (v === 'chain') {
      var x = rnd(2, 6), y = rnd(2, 6);
      while (gcd(x, y) !== 1) y = rnd(2, 6);
      var k = rnd(2, 5);
      var num = x * k, den = y * k;
      var pct = Math.round(x / y * 1000) / 10;
      var v2 = pick([0, 1, 2, 3]);
      if (v2 === 0) return { q: x + ' : ' + y + ' =（  ）÷ ' + den, answer: num, hint: '比的前项相当于除法中的被除数。' };
      if (v2 === 1) return { q: x + ' : ' + y + ' = ' + num + ' :（  ）', answer: den, hint: '前项后项同时乘 ' + k + '，比值不变。' };
      if (v2 === 2) return { q: x + ' : ' + y + ' =（  ）%（保留一位小数）', answer: trimD(pct) + '%', hint: '用前项除以后项求出比值（小数），再把小数化成百分数。' };
      return { q: x + ' : ' + y + ' =（填小数）', answer: trimD(x / y), hint: '比值 = 前项 ÷ 后项 = ' + x + ' ÷ ' + y + '。' };
    }
    if (v === 'basic') {
      return { q: '比的前项和后项同时乘或除以相同的数（0 除外），比值（  ）', answer: '不变', hint: '比的基本性质。' };
    }
    if (v === 'prop') {
      return { q: '在比例里，两个内项的积等于两个外项的积，这叫做比例的（  ）', answer: '基本性质', hint: '解比例的依据。' };
    }
    var a = rnd(1, 5), b = rnd(2, 9), xx = rnd(2, 9);
    var c = b * xx / a;
    if (c !== Math.floor(c)) return buildRatio();
    return { q: a + ' : ' + b + ' = ' + xx + ' :（  ）', answer: c, hint: '内项积 = 外项积：' + b + ' × ' + xx + ' ÷ ' + a + '。' };
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  // ============ 圆的周长与面积公式 ============
  function buildCircle() {
    var v = pick(['circ', 'area', 'formula']);
    var r = rnd(2, 8);
    if (v === 'circ') {
      return { q: '一个圆形花坛半径 ' + r + ' 米，周长是（  ）米（π 取 3.14）', answer: trimD(2 * PI3 * r), hint: '周长 = 2 × π × 半径 = 2 × 3.14 × ' + r + '。' };
    }
    if (v === 'area') {
      return { q: '一个圆形花坛半径 ' + r + ' 米，面积是（  ）平方米（π 取 3.14）', answer: trimD(PI3 * r * r), hint: '面积 = π × 半径² = 3.14 × ' + r + '²。' };
    }
    var pair = pick([['圆的周长公式是（  ）', 'C=2πr'], ['圆的面积公式是（  ）', 'S=πr²'], ['圆周率 π 是圆的周长与（  ）的比值', '直径']]);
    return { q: pair[0], answer: pair[1], hint: '熟记圆的两个基本公式。' };
  }

  // ============ 圆柱侧面积、表面积、体积与圆锥体积 ============
  function buildCylinderCone() {
    var v = pick(['relation', 'vol', 'cone', 'side', 'surface']);
    if (v === 'relation') {
      return { q: '等底等高的圆柱和圆锥，圆柱体积是圆锥体积的（  ）倍', answer: 3, hint: '圆锥体积是等底等高圆柱体积的 1/3。' };
    }
    if (v === 'vol') {
      var r = rnd(1, 4), h = rnd(2, 7);
      return { q: '底面半径 ' + r + ' 厘米、高 ' + h + ' 厘米的圆柱，体积是（  ）立方厘米（π 取 3.14）', answer: trimD(PI3 * r * r * h), hint: '圆柱体积 = π × 半径² × 高 = 3.14 × ' + r + '² × ' + h + '。' };
    }
    if (v === 'cone') {
      var r2 = rnd(1, 4), h2 = rnd(3, 9);
      return { q: '底面半径 ' + r2 + ' 厘米、高 ' + h2 + ' 厘米的圆锥，体积是（  ）立方厘米（π 取 3.14）', answer: trimD(PI3 * r2 * r2 * h2 / 3), hint: '圆锥体积 = 1/3 × 底面积 × 高。' };
    }
    if (v === 'side') {
      var r3 = rnd(1, 4), h3 = rnd(2, 7);
      return { q: '底面半径 ' + r3 + ' 厘米、高 ' + h3 + ' 厘米的圆柱，侧面积是（  ）平方厘米（π 取 3.14）', answer: trimD(2 * PI3 * r3 * h3), hint: '侧面积 = 底面周长 × 高 = 2 × 3.14 × ' + r3 + ' × ' + h3 + '。' };
    }
    var r4 = rnd(1, 3), h4 = rnd(2, 6);
    var side = 2 * PI3 * r4 * h4;
    var base = PI3 * r4 * r4;
    return { q: '底面半径 ' + r4 + ' 厘米、高 ' + h4 + ' 厘米的圆柱，表面积是（  ）平方厘米（π 取 3.14）', answer: trimD(side + 2 * base), hint: '表面积 = 侧面积 + 2 × 底面积，先分别算出侧面积和底面积，再相加。' };
  }

  // ============ 扇形统计图的特点 ============
  function buildPieChart() {
    var v = pick(['relation', 'sum', 'size']);
    if (v === 'relation') {
      return { q: '扇形统计图可以清楚地表示各部分数量与（  ）之间的关系', answer: '总数', hint: '扇形统计图反映部分占整体的百分比。' };
    }
    if (v === 'sum') {
      return { q: '扇形统计图中，各部分所占百分比的和是（  ）%', answer: 100, hint: '想一想：整个圆表示总数，各部分百分比合起来应占多少。' };
    }
    return { q: '扇形统计图中，扇形面积越大，所占的（  ）越大', answer: '百分比', hint: '扇形大小与所占百分比对应。' };
  }

  // ============ 单位换算 ============
  var UNIT_ITEMS = [
    [['0.5', '时', '分'], 30, '1 时 = 60 分'],
    [['1.25', '时', '分'], 75, '1 时 = 60 分'],
    [['2.4', '时', '分'], 144, '1 时 = 60 分'],
    [['4.5', '时', '分'], 270, '1 时 = 60 分'],
    [['2.4', '平方千米', '公顷'], 240, '1 平方千米 = 100 公顷'],
    [['3.6', '平方千米', '公顷'], 360, '1 平方千米 = 100 公顷'],
    [['0.75', '平方千米', '公顷'], 75, '1 平方千米 = 100 公顷'],
    [['0.3', '公顷', '平方米'], 3000, '1 公顷 = 10000 平方米'],
    [['0.85', '吨', '千克'], 850, '1 吨 = 1000 千克'],
    [['2.05', '千克', '克'], 2050, '1 千克 = 1000 克'],
    [['1.5', '立方米', '立方分米'], 1500, '1 立方米 = 1000 立方分米'],
    [['0.6', '立方分米', '毫升'], 600, '1 立方分米 = 1 升 = 1000 毫升']
  ];
  function buildUnitConvert() {
    var item = pick(UNIT_ITEMS);
    return { q: item[0][0] + ' ' + item[0][1] + ' =（  ）' + item[0][2], answer: item[1], hint: item[2] + '。' };
  }

  // ============ 综合填空 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 14) return buildNegative();
    if (r <= 30) return buildPercent();
    if (r <= 46) return buildRatio();
    if (r <= 61) return buildCircle();
    if (r <= 78) return buildCylinderCone();
    if (r <= 88) return buildPieChart();
    return buildUnitConvert();
  }

  var TYPE_BUILDERS = {
    'negative': buildNegative,
    'percent': buildPercent,
    'ratio': buildRatio,
    'circle': buildCircle,
    'cylinder-cone': buildCylinderCone,
    'pie-chart': buildPieChart,
    'unit-convert': buildUnitConvert,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'negative': '负数的意义与读写',
    'percent': '百分数的意义、互化与折扣',
    'ratio': '比和比例的基本性质',
    'circle': '圆的周长与面积公式',
    'cylinder-cone': '圆柱侧面积、表面积、体积与圆锥体积',
    'pie-chart': '扇形统计图的特点',
    'unit-convert': '单位换算',
    mix: '综合填空'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-fill',
    moduleId: 'M4',
    name: '填空题',
    pageSubtitle: '负数、百分数、比和比例、圆、圆柱圆锥、统计图与单位换算',
    grades: [6],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'g6-m4-g6-fill-negative',
        'g6-m4-g6-fill-percent',
        'g6-m4-g6-fill-ratio',
        'g6-m4-g6-fill-circle',
        'g6-m4-g6-fill-cylinder-cone',
        'g6-m4-g6-fill-pie-chart',
        'g6-m4-unit-convert'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',           label: '综合填空' },
          { value: 'negative',      label: '负数的意义与读写' },
          { value: 'percent',       label: '百分数的意义、互化与折扣' },
          { value: 'ratio',         label: '比和比例的基本性质' },
          { value: 'circle',        label: '圆的周长与面积公式' },
          { value: 'cylinder-cone', label: '圆柱侧面积、表面积、体积与圆锥体积' },
          { value: 'pie-chart',     label: '扇形统计图的特点' },
          { value: 'unit-convert',  label: '单位换算' }
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
        return { type: 'fill', q: p.q, answer: String(p.answer), hint: p.hint, inputType: 'text' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学六年级填空练习（' + (TYPE_NAMES[type] || '综合填空') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);