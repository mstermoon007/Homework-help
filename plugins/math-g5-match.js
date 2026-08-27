/**
 * plugins/math-g5-match.js — 五年级连线题插件（M5 连线）
 *
 * 知识点覆盖（shared/knowledge-bank.js 五年级 M5 模块）：
 *   g5-m5-g5-match-areaf    图形与面积公式连线    （type: 'area-formula'）
 *   g5-m5-g5-match-solid    立体图形特征连线      （type: 'solid-feature'）
 *   g5-m5-g5-match-possib   事件与可能性描述连线  （type: 'possibility-desc'）
 *   g5-m5-g5-match-equ      方程与解连线          （type: 'equation-solve'）
 *   g5-m5-g5-match-fracdec  分数与小数连线        （type: 'frac-decimal'）
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
  if (!_PU) throw new Error('plugins/math-g5-match.js 依赖 shared/common.js（PluginUtil），请先加载');

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
    // 若干扰不足，用通用池补充
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

  // ============ 图形与面积公式连线 ============
  function buildAreaFormula() {
    var pairs = [
      ['长方形', '长 × 宽'],
      ['正方形', '边长 × 边长'],
      ['三角形', '底 × 高 ÷ 2'],
      ['平行四边形', '底 × 高'],
      ['梯形', '(上底 + 下底) × 高 ÷ 2']
    ];
    var pr = pick(pairs);
    var rightPool = pairs.map(function (p) { return p[1]; });
    return mk(pr[0], pr[1], rightPool);
  }

  // ============ 立体图形特征连线 ============
  function buildSolidFeature() {
    var pairs = [
      ['长方体', '6 个面都是长方形（特殊情况下有两个相对面是正方形）'],
      ['正方体', '6 个面都是完全相同的正方形'],
      ['长方体', '相对的面完全相同'],
      ['正方体', '12 条棱都相等'],
      ['长方体', '有 8 个顶点，12 条棱'],
      ['正方体', '棱长总和 = 棱长 × 12'],
      ['长方体', '体积 = 长 × 宽 × 高']
    ];
    var pr = pick(pairs);
    var rightPool = [];
    pairs.forEach(function (p) { if (rightPool.indexOf(p[1]) === -1) rightPool.push(p[1]); });
    return mk(pr[0], pr[1], rightPool);
  }

  // ============ 事件与可能性描述连线 ============
  function buildPossibilityDesc() {
    var pairs = [
      ['太阳从东方升起', '一定发生'],
      ['明天会下雨', '可能发生'],
      ['盒子里没有黄球却摸出黄球', '不可能发生'],
      ['掷骰子得到 6 点', '可能发生'],
      ['1 分钟等于 60 秒', '一定发生'],
      ['抛硬币正面朝上', '可能发生'],
      ['猴子会飞', '不可能发生'],
      ['今天是星期三，明天是星期四', '一定发生']
    ];
    var pr = pick(pairs);
    var rightPool = ['一定发生', '可能发生', '不可能发生'];
    return mk(pr[0], pr[1], rightPool);
  }

  // ============ 方程与解连线 ============
  function buildEquationSolve() {
    var pool = [2, 3, 4, 5, 6, 7, 8, 9];
    var sols = shuffle(pool).slice(0, 6);
    var pairs = [];
    for (var i = 0; i < sols.length; i++) {
      var x = sols[i], b = rnd(2, 9);
      pairs.push(['x + ' + b + ' = ' + (x + b), 'x = ' + x]);
    }
    var pr = pick(pairs);
    var rightPool = pairs.map(function (p) { return p[1]; });
    return mk(pr[0], pr[1], rightPool);
  }

  // ============ 分数与小数连线 ============
  function buildFracDecimal() {
    var pairs = [
      ['1/2', '0.5'],
      ['1/4', '0.25'],
      ['3/4', '0.75'],
      ['1/5', '0.2'],
      ['2/5', '0.4'],
      ['3/5', '0.6'],
      ['4/5', '0.8'],
      ['1/10', '0.1'],
      ['3/10', '0.3'],
      ['7/10', '0.7']
    ];
    var pr = pick(pairs);
    var rightPool = pairs.map(function (p) { return p[1]; });
    return mk(pr[0], pr[1], rightPool);
  }

  // ============ 综合连线 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 22) return buildAreaFormula();
    if (r <= 44) return buildSolidFeature();
    if (r <= 66) return buildPossibilityDesc();
    if (r <= 84) return buildEquationSolve();
    return buildFracDecimal();
  }

  var TYPE_BUILDERS = {
    'area-formula': buildAreaFormula,
    'solid-feature': buildSolidFeature,
    'possibility-desc': buildPossibilityDesc,
    'equation-solve': buildEquationSolve,
    'frac-decimal': buildFracDecimal,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'area-formula': '图形与面积公式',
    'solid-feature': '立体图形特征',
    'possibility-desc': '事件与可能性',
    'equation-solve': '方程与解',
    'frac-decimal': '分数与小数',
    mix: '综合连线'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g5-match',
    moduleId: 'M5',
    name: '连线题',
    pageSubtitle: '面积公式、立体图形、可能性、方程与分数小数',
    grades: [5],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'math-g5-m5-g5-match-areaf',
        'math-g5-m5-g5-match-solid',
        'math-g5-m5-g5-match-possib',
        'math-g5-m5-g5-match-equ',
        'math-g5-m5-g5-match-fracdec'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix', label: '综合连线' },
          { value: 'area-formula', label: '图形与面积公式' },
          { value: 'solid-feature', label: '立体图形特征' },
          { value: 'possibility-desc', label: '事件与可能性' },
          { value: 'equation-solve', label: '方程与解' },
          { value: 'frac-decimal', label: '分数与小数' }
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
        title: '小学五年级连线练习（' + (TYPE_NAMES[type] || '综合连线') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);