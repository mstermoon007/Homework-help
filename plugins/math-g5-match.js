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

  // ============ 图形与面积公式连线（随机维度，题面池极大） ============
  function buildAreaFormula() {
    var rights = ['长 × 宽', '边长 × 边长', '底 × 高 ÷ 2', '底 × 高', '(上底 + 下底) × 高 ÷ 2', 'π × 半径 × 半径', '(长×宽 + 长×高 + 宽×高) × 2', '棱长 × 棱长 × 6', 'π × 半径² ÷ 2', '(长 + 宽) × 2', '边长 × 4'];
    var makers = [
      function () { var a = rnd(2, 40), b = rnd(2, 40); return ['一个长方形长 ' + a + ' 厘米、宽 ' + b + ' 厘米，面积 = ？', '长 × 宽']; },
      function () { var s = rnd(2, 40); return ['一个正方形的边长是 ' + s + ' 厘米，面积 = ？', '边长 × 边长']; },
      function () { var d = rnd(2, 40), h = rnd(2, 40); return ['一个三角形的底是 ' + d + ' 厘米、高是 ' + h + ' 厘米，面积 = ？', '底 × 高 ÷ 2']; },
      function () { var d = rnd(2, 40), h = rnd(2, 40); return ['一个平行四边形底 ' + d + ' 厘米、高 ' + h + ' 厘米，面积 = ？', '底 × 高']; },
      function () { var a = rnd(2, 30), b = rnd(2, 30), h = rnd(2, 30); return ['一个梯形上底 ' + a + '、下底 ' + b + '、高 ' + h + '，面积 = ？', '(上底 + 下底) × 高 ÷ 2']; },
      function () { var r = rnd(2, 30); return ['一个圆半径 ' + r + ' 厘米，面积 = ？', 'π × 半径 × 半径']; },
      function () { var a = rnd(2, 20), b = rnd(2, 20), c = rnd(2, 20); return ['一个长方体长 ' + a + '、宽 ' + b + '、高 ' + c + '，表面积 = ？', '(长×宽 + 长×高 + 宽×高) × 2']; },
      function () { var e = rnd(2, 20); return ['一个正方体棱长 ' + e + '，表面积 = ？', '棱长 × 棱长 × 6']; },
      function () { var r = rnd(2, 30); return ['一个半圆半径 ' + r + ' 厘米，面积 = ？', 'π × 半径² ÷ 2']; },
      function () { var a = rnd(2, 40), b = rnd(2, 40); return ['一个长方形长 ' + a + '、宽 ' + b + '，周长 = ？', '(长 + 宽) × 2']; },
      function () { var s = rnd(2, 40); return ['一个正方形边长 ' + s + '，周长 = ？', '边长 × 4']; }
    ];
    var pr = pick(makers)();
    return mk(pr[0], pr[1], rights);
  }

  // ============ 立体图形特征连线（随机编号，题面池极大） ============
  function buildSolidFeature() {
    var rights = ['6 个面都是长方形（特殊情况下有两个相对面是正方形）', '6 个面都是完全相同的正方形', '相对的面完全相同', '12 条棱都相等', '有 8 个顶点，12 条棱', '棱长总和 = 棱长 × 12', '体积 = 长 × 宽 × 高', '体积 = 棱长 × 棱长 × 棱长', '上下两个底面是完全相同的圆', '侧面展开一般是长方形', '只有一个顶点', '侧面展开是扇形', '表面积 = (长×宽 + 长×高 + 宽×高) × 2', '有 6 个完全相同的面', '高有无数条', '表面是一个曲面', '棱长总和 = （长 + 宽 + 高） × 4', '半径处处相等', '是特殊的长方体', '上下一样粗', '两个底面之间的距离叫做高', '高只有一条', '任意一个面的面积都相等', '占地面的面积 = 长 × 宽'];
    var shapes = ['长方体', '正方体', '圆柱', '圆锥', '球'];
    var tag = '【图' + rnd(1, 9) + rnd(1, 9) + '】';
    var shape = pick(shapes);
    var right = pick(rights);
    return mk(tag + shape, right, rights);
  }

  // ============ 事件与可能性描述连线（含随机数字模板） ============
  function buildPossibilityDesc() {
    var r3 = ['一定发生', '可能发生', '不可能发生'];
    var makers = [
      function () { var x = rnd(2, 20), y = rnd(1, 20); return ['盒子里有 ' + x + ' 个红球和 ' + y + ' 个蓝球，摸出一个，是红球', '可能发生']; },
      function () { var x = rnd(2, 20); return ['盒子里只有 ' + x + ' 个红球，摸出一个，是红球', '一定发生']; },
      function () { var x = rnd(2, 20); return ['盒子里只有 ' + x + ' 个红球，摸出一个，是蓝球', '不可能发生']; },
      function () { var n = rnd(1, 6); return ['掷一个骰子，点数是 ' + n, '可能发生']; },
      function () { return ['太阳从东方升起', '一定发生']; },
      function () { return ['猴子在天上飞', '不可能发生']; },
      function () { var n = rnd(2, 12); return ['一年有 ' + n + ' 个月', '不可能发生']; },
      function () { var n = rnd(2, 12); return ['一个月最多有 ' + n + ' 天', '可能发生']; },
      function () { return ['1 分钟 = 60 秒', '一定发生']; },
      function () { var n = rnd(2, 30); return ['从 ' + n + ' 名同学中至少有 2 人同月出生', '可能发生']; },
      function () { var n = rnd(2, 30); return ['从 ' + n + ' 名同学中至少有 2 人生日同天', '可能发生']; }
    ];
    var pr = pick(makers)();
    return mk(pr[0], pr[1], r3);
  }

  // ============ 方程与解连线（多模板 + 随机数字） ============
  function buildEquationSolve() {
    var x = rnd(2, 60);
    var tmpl = rnd(0, 3);
    var left, right = 'x = ' + x;
    if (tmpl === 0) { var b = rnd(2, 60); left = 'x + ' + b + ' = ' + (x + b); }
    else if (tmpl === 1) { var b2 = rnd(2, 60); left = 'x - ' + b2 + ' = ' + (x - b2); }
    else if (tmpl === 2) { var a = rnd(2, 12); left = a + ' x = ' + (a * x); }
    else { var a2 = rnd(2, 12); left = 'x ÷ ' + a2 + ' = ' + (x / a2); }
    var rightPool = ['x = ' + x];
    for (var d = 0; d < 5; d++) { var other = x + rnd(1, 9) * (rnd(0, 1) ? 1 : -1); if (other !== x) rightPool.push('x = ' + other); }
    return mk(left, right, rightPool);
  }

  // ============ 分数与小数连线 ============
  function buildFracDecimal() {
    // 由 2/5 因子分母（必为有限小数）批量生成，保证题面池充足
    var denoms = [2, 4, 5, 8, 10, 16, 20, 25, 32, 40, 50, 64, 80, 100, 125, 200, 250, 500];
    var raw = [];
    denoms.forEach(function (den) {
      for (var num = 1; num < den; num++) {
        var val = num / den;
        var dec = (val % 1 === 0) ? String(val) : val.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
        raw.push([num + '/' + den, dec]);
      }
    });
    var seen = {}, pairs = [];
    raw.forEach(function (p) { if (!seen[p[1]]) { seen[p[1]] = 1; pairs.push(p); } });
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