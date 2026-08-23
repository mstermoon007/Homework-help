/**
 * plugins/math-g6-matching.js — 六年级连线题插件（M5 正反比例与图形公式连线）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M5 模块）：
 *   g6-m5-g6-match-proportion  正反比例判断连线      （type: 'proportion'）
 *   g6-m5-g6-match-formula     圆与圆柱圆锥公式连线  （type: 'formula'）
 *   g6-m5-g6-match-chart       扇形统计图特点连线    （type: 'chart'）
 *
 * 连线题以「左项 → 选项」形式实现：题干展示左侧待连项，右侧为候选
 * （含干扰项），学生点击正确匹配项即可（choice 交互）。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-matching.js 依赖 shared/common.js（PluginUtil），请先加载');

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

  // 构建 choice 题：left + right(正确) + 最多 3 个干扰右项
  function mk(left, right, rightPool) {
    var distractors = [];
    (rightPool || []).forEach(function (r) { if (r !== right && distractors.indexOf(r) === -1 && distractors.length < 3) distractors.push(r); });
    var fillPool = rightPool && rightPool.length ? rightPool : [];
    var i = 0;
    while (distractors.length < 3 && fillPool.length && i < fillPool.length) {
      var c = fillPool[i];
      if (c !== right && distractors.indexOf(c) === -1) distractors.push(c);
      i++;
    }
    while (distractors.length < 3) {
      var x = '干扰项' + rnd(1, 99);
      if (x !== right && distractors.indexOf(x) === -1) distractors.push(x);
    }
    return { q: '把「' + left + '」连到对应的', answer: right, options: shuffle([right].concat(distractors)), hint: '记住对应的概念或公式。' };
  }

  function rightPoolOf(pairs) {
    var pool = [];
    pairs.forEach(function (p) { if (pool.indexOf(p[1]) === -1) pool.push(p[1]); });
    return pool;
  }

  // ============ 正反比例判断连线 ============
  function buildProportion() {
    var pairs = [
      ['速度一定，路程和时间', '成正比例'],
      ['路程一定，速度和时间', '成反比例'],
      ['单价一定，总价和数量', '成正比例'],
      ['长方形面积一定，长和宽', '成反比例'],
      ['圆的周长和直径', '成正比例'],
      ['工作总量一定，工作效率和工作时间', '成反比例'],
      ['一个人的年龄和身高', '不成比例']
    ];
    var pr = pick(pairs);
    return mk(pr[0], pr[1], ['成正比例', '成反比例', '不成比例']);
  }

  // ============ 圆与圆柱圆锥公式连线 ============
  function buildFormula() {
    var pairs = [
      ['圆的周长（知直径）', 'C = πd'],
      ['圆的周长（知半径）', 'C = 2πr'],
      ['圆的面积', 'S = πr²'],
      ['直径与半径', 'd = 2r'],
      ['圆柱的体积', 'V = Sh'],
      ['圆锥的体积', 'V = Sh ÷ 3'],
      ['圆柱的侧面积', 'S = 2πrh'],
      ['圆柱的表面积', 'S = 2πrh + 2πr²']
    ];
    var pr = pick(pairs);
    return mk(pr[0], pr[1], rightPoolOf(pairs));
  }

  // ============ 扇形统计图特点连线 ============
  function buildChart() {
    var pairs = [
      ['扇形统计图最适合表示', '各部分与整体的关系'],
      ['折线统计图最能反映', '数量的增减变化趋势'],
      ['条形统计图便于', '比较数量的多少'],
      ['扇形统计图各部分百分比之和', '100%'],
      ['占 25% 的扇形对应的圆心角', '90°'],
      ['占 30% 的扇形对应的圆心角', '108°']
    ];
    var pr = pick(pairs);
    return mk(pr[0], pr[1], rightPoolOf(pairs));
  }

  // ============ 综合连线 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 45) return buildProportion();
    if (r <= 75) return buildFormula();
    return buildChart();
  }

  var TYPE_BUILDERS = {
    'proportion': buildProportion,
    'formula': buildFormula,
    'chart': buildChart,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'proportion': '正反比例判断',
    'formula': '圆与圆柱圆锥公式',
    'chart': '扇形统计图特点',
    mix: '综合连线'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-matching',
    moduleId: 'M5',
    name: '连线题',
    pageSubtitle: '正反比例判断、图形公式与扇形统计图',
    grades: [6],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['g6-m5-g6-match-proportion', 'g6-m5-g6-match-formula', 'g6-m5-g6-match-chart'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',        label: '综合连线' },
          { value: 'proportion', label: '正反比例判断' },
          { value: 'formula',    label: '圆与圆柱圆锥公式' },
          { value: 'chart',      label: '扇形统计图特点' }
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
        return { type: 'match', q: p.q, answer: String(p.answer), options: p.options, hint: p.hint, inputType: 'choice' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学六年级连线练习（' + (TYPE_NAMES[type] || '综合连线') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);