/**
 * plugins/math-g5-judge.js — 五年级判断题插件（M11 判断）
 *
 * 知识点覆盖（shared/knowledge-bank.js 五年级 M11 模块）：
 *   g5-judge-decmul  小数乘除法      （type: 'dec'）
 *   g5-judge-equ     方程概念        （type: 'equation'）
 *   g5-judge-fm      因数与倍数      （type: 'factor-multiple'）
 *   g5-judge-frac    分数的意义与性质（type: 'fraction'）
 *   g5-judge-area    多边形面积      （type: 'area'）
 *   g5-judge-solid   长方体正方体    （type: 'solid'）
 *   g5-judge-rotate  图形的运动      （type: 'rotation'）
 *   g5-judge-possib  可能性          （type: 'possibility'）
 *   g5-judge-stats   统计            （type: 'stats'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g5-judge.js 依赖 shared/common.js（PluginUtil），请先加载');

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

  // ============ 小数乘除法 ============
  function buildDec() {
    return pick([
      { q: '小数乘小数，积的小数位数等于两个因数小数位数之和。', right: true, hint: '0.3×0.2 = 0.06，两位小数。' },
      { q: '一个数（0 除外）乘小于 1 的小数，积比这个数小。', right: true, hint: '如 5×0.8 = 4 < 5。' },
      { q: '两个数相乘，积一定大于这两个数。', right: false, hint: '如 0.5×0.5 = 0.25，比两个数都小。' },
      { q: '小数除法中，商的小数点要和被除数的小数点对齐。', right: true, hint: '除数是整数时，商的小数点与被除数对齐。' },
      { q: '一个数除以 0.1 等于这个数乘 10。', right: true, hint: '如 5÷0.1 = 50 = 5×10。' },
      { q: '0.7 和 0.70 大小相等，计数单位也相同。', right: false, hint: '大小相等，但计数单位不同（0.1 和 0.01）。' },
      { q: '循环小数是无限小数。', right: true, hint: '循环小数的小数部分无限且循环。' },
      { q: '近似数 3.0 比 3 精确。', right: true, hint: '3.0 精确到十分位。' }
    ]);
  }

  // ============ 方程概念 ============
  function buildEquation() {
    return pick([
      { q: '含有未知数的式子叫方程。', right: false, hint: '必须是等式：含有未知数的等式才叫方程。' },
      { q: '方程一定是等式，等式不一定是方程。', right: true, hint: '方程是特殊的等式。' },
      { q: 'x + 3 = 8 是方程。', right: true, hint: '含有未知数的等式。' },
      { q: '5x > 10 是方程。', right: false, hint: '不是等式，是不等式。' },
      { q: '等式两边同时乘同一个数，等式仍然成立。', right: true, hint: '等式的性质。' },
      { q: '等式两边同时除以同一个数（0 除外），等式仍然成立。', right: true, hint: '等式的性质（除数不能为 0）。' },
      { q: '方程的解和解方程是同一个概念。', right: false, hint: '方程的解是一个值，解方程是一个过程。' },
      { q: 'x = 5 是方程 2x = 10 的解。', right: true, hint: '2×5 = 10。' }
    ]);
  }

  // ============ 因数与倍数 ============
  function buildFactorMultiple() {
    return pick([
      { q: '一个数的因数的个数是有限的，倍数的个数是无限的。', right: true, hint: '因数有限，倍数无限。' },
      { q: '一个数的最小倍数是 1。', right: false, hint: '一个数的最小倍数是它本身。' },
      { q: '2 的倍数都是偶数。', right: true, hint: '偶数是 2 的倍数。' },
      { q: '个位上是 0 或 5 的数是 5 的倍数。', right: true, hint: '5 的倍数特征。' },
      { q: '一个数的倍数一定比它的因数大。', right: false, hint: '如 12 的倍数 12 等于它的因数 12。' },
      { q: '所有的奇数都是质数。', right: false, hint: '如 9、15 是奇数但是合数。' },
      { q: '1 既不是质数也不是合数。', right: true, hint: '1 只有 1 个因数。' },
      { q: '两个质数的和一定是合数。', right: false, hint: '如 2+3 = 5 是质数。' }
    ]);
  }

  // ============ 分数的意义与性质 ============
  function buildFraction() {
    return pick([
      { q: '把单位「1」平均分成 5 份，取其中的 3 份是 3/5。', right: true, hint: '分数意义。' },
      { q: '分数的分子和分母同时乘同一个数，分数大小不变。', right: false, hint: '要同时乘或除以相同的数（0 除外）。' },
      { q: '约分和通分都是运用分数的基本性质。', right: true, hint: '分数基本性质的应用。' },
      { q: '两个分数的大小相等，分数单位一定相同。', right: false, hint: '如 1/2 和 2/4 相等，分数单位不同。' },
      { q: '分母越大，分数单位越小。', right: true, hint: '分数单位是 1/分母。' },
      { q: '分子比分母大的分数是假分数。', right: true, hint: '假分数 ≥ 1。' },
      { q: '真分数一定小于 1。', right: true, hint: '真分数的分子小于分母。' },
      { q: '1 的分数单位是 1。', right: true, hint: '1 = 1/1。' }
    ]);
  }

  // ============ 多边形面积 ============
  function buildArea() {
    return pick([
      { q: '两个完全一样的三角形可以拼成一个平行四边形。', right: true, hint: '三角形面积推导。' },
      { q: '三角形的面积等于平行四边形面积的一半。', right: false, hint: '必须等底等高时才成立。' },
      { q: '平行四边形面积 = 底 × 高。', right: true, hint: '面积公式。' },
      { q: '平行四边形的面积一定比三角形大。', right: false, hint: '要比较底和高。' },
      { q: '梯形面积 =（上底 + 下底）× 高 ÷ 2。', right: true, hint: '面积公式。' },
      { q: '等底等高的两个三角形面积一定相等。', right: true, hint: '面积只与底和高有关。' },
      { q: '长方形的周长和面积可以相等。', right: false, hint: '周长是长度，面积是大小，单位不同不能比。' },
      { q: '平行四边形的面积是三角形面积的 2 倍。', right: false, hint: '等底等高时才成立。' }
    ]);
  }

  // ============ 长方体正方体 ============
  function buildSolid() {
    return pick([
      { q: '长方体有 6 个面、12 条棱、8 个顶点。', right: true, hint: '长方体特征。' },
      { q: '正方体是特殊的长方体。', right: true, hint: '正方体是长宽高都相等的长方体。' },
      { q: '长方体 6 个面都是长方形。', right: false, hint: '可能有两个相对的面是正方形。' },
      { q: '长方体的体积 = 长 × 宽 × 高。', right: true, hint: '体积公式。' },
      { q: '1 立方分米 = 1 升。', right: true, hint: '容积单位换算。' },
      { q: '棱长 1 厘米的正方体体积是 1 立方厘米。', right: true, hint: '体积单位定义。' },
      { q: '长方体的表面积一定大于体积。', right: false, hint: '表面积和体积单位不同，不能比较。' },
      { q: '正方体的 12 条棱都相等。', right: true, hint: '正方体特征。' }
    ]);
  }

  // ============ 图形的运动 ============
  function buildRotation() {
    return pick([
      { q: '旋转后图形的大小和形状不变，只是位置方向改变。', right: true, hint: '旋转的性质。' },
      { q: '平移和旋转都不会改变图形的大小。', right: true, hint: '都是全等变换。' },
      { q: '轴对称图形沿对称轴对折后，两边完全重合。', right: true, hint: '轴对称定义。' },
      { q: '旋转 180° 后，图形会颠倒。', right: false, hint: '方向可能颠倒，说法不严谨。' },
      { q: '平移是沿直线方向运动。', right: true, hint: '平移的定义。' },
      { q: '所有三角形都是轴对称图形。', right: false, hint: '只有等腰/等边三角形是轴对称。' },
      { q: '正方形有 4 条对称轴。', right: true, hint: '两条对角线 + 两条中位线。' },
      { q: '旋转三要素是旋转中心、旋转方向、旋转角度。', right: true, hint: '旋转三要素。' }
    ]);
  }

  // ============ 可能性 ============
  function buildPossibility() {
    return pick([
      { q: '掷一枚硬币，正面朝上的可能性是 1/2。', right: true, hint: '两种等可能结果。' },
      { q: '事件发生的可能性一定可以用分数表示。', right: false, hint: '可能性大小时常用分数，但不是所有情况都能精确表示。' },
      { q: '袋子里红球比白球多，摸到红球的可能性大。', right: true, hint: '数量多的可能性大。' },
      { q: '可能性小的事件就一定不会发生。', right: false, hint: '可能性小也会发生。' },
      { q: '掷骰子，点数大于 3 的可能性是 1/2。', right: true, hint: '4、5、6 三个点数占 3/6。' },
      { q: '太阳每天从东方升起是确定事件。', right: true, hint: '一定会发生。' }
    ]);
  }

  // ============ 统计 ============
  function buildStats() {
    return pick([
      { q: '折线统计图能清楚地反映数量的增减变化情况。', right: true, hint: '折线统计图的特点。' },
      { q: '条形统计图适合表示数量变化趋势。', right: false, hint: '条形图适合比较数量多少，折线图适合变化趋势。' },
      { q: '复式折线统计图可以比较两组数据的变化。', right: true, hint: '复式图便于比较。' },
      { q: '平均数能反映一组数据的总体水平。', right: true, hint: '平均数的意义。' },
      { q: '折线统计图只能表示一个量。', right: false, hint: '复式折线图可表示多个量。' }
    ]);
  }

  // ============ 综合判断 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 13) return buildDec();
    if (r <= 26) return buildEquation();
    if (r <= 39) return buildFactorMultiple();
    if (r <= 52) return buildFraction();
    if (r <= 65) return buildArea();
    if (r <= 78) return buildSolid();
    if (r <= 88) return buildRotation();
    if (r <= 95) return buildPossibility();
    return buildStats();
  }

  var TYPE_BUILDERS = {
    'dec': buildDec,
    'equation': buildEquation,
    'factor-multiple': buildFactorMultiple,
    'fraction': buildFraction,
    'area': buildArea,
    'solid': buildSolid,
    'rotation': buildRotation,
    'possibility': buildPossibility,
    'stats': buildStats,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'dec': '小数乘除法',
    'equation': '方程概念',
    'factor-multiple': '因数与倍数',
    'fraction': '分数的意义与性质',
    'area': '多边形面积',
    'solid': '长方体正方体',
    'rotation': '图形的运动',
    'possibility': '可能性',
    'stats': '统计',
    mix: '综合判断'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g5-judge',
    moduleId: 'M11',
    name: '判断题',
    pageTitle: '五年级判断练习',
    pageSubtitle: '小数、方程、因数倍数、分数、面积、立体图形、运动、可能性与统计',
    grades: [5],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['g5-judge-decmul', 'g5-judge-equ', 'g5-judge-fm', 'g5-judge-frac',
      'g5-judge-area', 'g5-judge-solid', 'g5-judge-rotate', 'g5-judge-possib', 'g5-judge-stats'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix', label: '综合判断' },
          { value: 'dec', label: '小数乘除法' },
          { value: 'equation', label: '方程概念' },
          { value: 'factor-multiple', label: '因数与倍数' },
          { value: 'fraction', label: '分数的意义与性质' },
          { value: 'area', label: '多边形面积' },
          { value: 'solid', label: '长方体正方体' },
          { value: 'rotation', label: '图形的运动' },
          { value: 'possibility', label: '可能性' },
          { value: 'stats', label: '统计' }
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
        title: '小学五年级判断练习（' + (TYPE_NAMES[type] || '综合判断') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);