/**
 * plugins/math-g5-fill.js — 五年级填空题插件
 *
 * 知识点覆盖（shared/knowledge-bank.js 五年级 M4 模块）：
 *   g5-fill-decloc    小数的计数单位与数位  （type: 'dec-place'）
 *   g5-fill-deccmp    小数大小比较          （type: 'dec-compare'）
 *   g5-fill-prodrule  积的变化规律          （type: 'product-rule'）
 *   g5-fill-repeating 循环小数与简便记法    （type: 'repeating-note'）
 *   g5-fill-equation  方程概念与等式的性质  （type: 'equation-prop'）
 *   g5-fill-fm        因数与倍数的概念      （type: 'factor-multiple'）
 *   g5-fill-prime     质数与合数            （type: 'prime-composite'）
 *   g5-fill-fracmean  分数的意义与分数单位  （type: 'frac-meaning'）
 *   g5-fill-fracprop  分数的基本性质        （type: 'frac-property'）
 *   g5-fill-fracdec   分数与小数的互化      （type: 'frac-decimal'）
 *   g5-fill-coord     数对的含义            （type: 'coordinate'）
 *   g5-fill-area      多边形面积公式        （type: 'area-formula'）
 *   g5-fill-solid     长方体正方体特征与公式（type: 'solid-formula'）
 *   g5-fill-rotate    旋转三要素            （type: 'rotation-elem'）
 *   g5-fill-possible  可能性描述            （type: 'possibility'）
 *   g5-fill-linechart 折线统计图特点        （type: 'linechart-feature'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g5-fill.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffle(arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = rnd(0, i); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  // ============ 小数的计数单位与数位 ============
  function buildDecPlace() {
    var v = pick(['count', 'digit', 'expand']);
    if (v === 'count') {
      // 0.几 由几个十分之一组成
      var t = rnd(1, 9);
      return { q: '0.' + t + ' 里面有（  ）个 0.1', answer: t, hint: '0.1 是十分之一，0.' + t + ' 有 ' + t + ' 个 0.1。' };
    }
    if (v === 'digit') {
      // 指出某位上的数字
      var n = rnd(10, 999) / 10;
      var s = n.toFixed(1);
      var pos = pick(['十分位', '个位', '十分位']);
      var dp = s.indexOf('.');
      var idx = pos === '十分位' ? dp + 1 : dp - 1;
      var d = Number(s[idx]);
      return { q: s + ' 中' + pos + '上的数字是（  ）', answer: d, hint: '小数点右边第一位是十分位。' };
    }
    // 改写：0.01 组成
    var h = rnd(1, 9), t2 = rnd(0, 9);
    var val = h + t2 / 100;
    return { q: '由 ' + h + ' 个 0.1 和 ' + t2 + ' 个 0.01 组成的数是（  ）', answer: val.toFixed(2), hint: '十分位写' + h + '，百分位写' + t2 + '。' };
  }

  // ============ 小数大小比较 ============
  function buildDecCompare() {
    var a = (rnd(10, 99) / 10).toFixed(1);
    var b = (rnd(10, 99) / 10).toFixed(1);
    var sym = Number(a) > Number(b) ? '>' : Number(a) < Number(b) ? '<' : '=';
    return { q: a + ' ○ ' + b + '，○ 里填', answer: sym, hint: '先比较整数部分，整数部分相同再比较十分位。' };
  }

  // ============ 积的变化规律 ============
  function buildProductRule() {
    var v = pick(['times', 'divide', 'both']);
    var a = rnd(12, 99), b = rnd(12, 99);
    var prod = a * b;
    if (v === 'times') {
      var k = pick([10, 100, 1000]);
      return { q: a + ' × ' + b + ' = ' + prod + '，那么 (' + a + '×' + k + ') × ' + b + ' =（  ）', answer: prod * k, hint: '一个因数不变，另一个因数乘 ' + k + '，积也乘 ' + k + '。' };
    }
    if (v === 'divide') {
      var k2 = pick([10, 100]);
      return { q: a + ' × ' + b + ' = ' + prod + '，那么 (' + a + '÷' + k2 + ') × ' + b + ' =（  ）', answer: prod / k2, hint: '一个因数不变，另一个因数除以 ' + k2 + '，积也除以 ' + k2 + '。' };
    }
    var k3 = pick([10, 100]), k4 = pick([10, 100]);
    return { q: a + ' × ' + b + ' = ' + prod + '，那么 (' + a + '×' + k3 + ') × (' + b + '÷' + k4 + ') =（  ）', answer: prod * k3 / k4, hint: '一个因数乘 ' + k3 + '，另一个因数除以 ' + k4 + '，积先乘 ' + k3 + '再除以 ' + k4 + '。' };
  }

  // ============ 循环小数与简便记法 ============
  function buildRepeatingNote() {
    var v = pick(['pick', 'cycle', 'nearest']);
    if (v === 'pick') {
      // 选出循环小数
      var n = rnd(1, 9);
      var rep = n + '.' + n + n + n + '…';
      return { q: '下面各数中是循环小数的是：写「是」', answer: '是', hint: '小数部分从某一位起依次不断重复出现的数叫循环小数。' };
    }
    if (v === 'cycle') {
      // 用简便记法表示循环小数
      var d = pick([3, 6, 7, 9, 11, 13]);
      var r = rnd(1, d - 1);
      var s = (r / d).toString().replace(/^0\./, '0.');
      // 取前两位 + …
      var first = Math.floor((r * 10) / d);
      var rem = (r * 10) % d;
      var second = Math.floor((rem * 10) / d);
      return { q: (r / d).toFixed(3) + '… 的循环节是（  ）', answer: '' + first + second, hint: '循环节是小数部分依次不断重复出现的数字。' };
    }
    var m = rnd(2, 9) / 10;
    return { q: '把 ' + m.toFixed(1) + ' 改写成两位小数是（  ）', answer: m.toFixed(2), hint: '小数的末尾添上 0，大小不变。' };
  }

  // ============ 方程概念与等式的性质 ============
  function buildEquationProp() {
    var v = pick(['which', 'solve', 'prop']);
    if (v === 'which') {
      var x = rnd(2, 9), b = rnd(2, 9);
      var eq = x + ' + ' + b + ' = ' + (x + b);
      return { q: eq + '，这个式子叫（填：方程/等式）', answer: '等式', hint: '含有未知数的等式才是方程；这个式子没有未知数，是等式。' };
    }
    if (v === 'solve') {
      var x2 = rnd(2, 9), b2 = rnd(2, 9);
      var total = x2 + b2;
      var place = pick([0, 1]);
      var expr = place === 0 ? 'x + ' + b2 + ' = ' + total : b2 + ' + x = ' + total;
      return { q: '方程 ' + expr + ' 的解是 x =（  ）', answer: x2, hint: '等式两边同时减去 ' + b2 + '。' };
    }
    var x3 = rnd(2, 9), b3 = rnd(2, 9);
    return { q: '方程 ' + x3 + 'x = ' + (x3 * b3) + ' 的解是 x =（  ）', answer: b3, hint: '等式两边同时除以 ' + x3 + '。' };
  }

  // ============ 因数与倍数的概念 ============
  function buildFactorMultiple() {
    var v = pick(['factors', 'multiple', 'minmax']);
    if (v === 'factors') {
      var n = pick([6, 8, 9, 10, 12, 15, 18, 20]);
      var fs = [];
      for (var i = 1; i <= n; i++) if (n % i === 0) fs.push(i);
      return { q: n + ' 的全部因数：1、' + fs.slice(1, -1).join('、') + '、（  ）', answer: n, hint: '一个数的因数是成对出现的，1 和它本身是它的因数。' };
    }
    if (v === 'multiple') {
      var k = rnd(2, 9), base = rnd(2, 9);
      return { q: base + ' 的最小倍数是（  ）', answer: base, hint: '一个数的最小倍数是它本身。' };
    }
    var n3 = rnd(12, 99) * 2;
    return { q: n3 + ' 是（填：奇数/偶数）', answer: '偶数', hint: '个位是 0、2、4、6、8 的数是偶数。' };
  }

  // ============ 质数与合数 ============
  function buildPrimeComposite() {
    var v = pick(['judge', 'factors', 'min']);
    if (v === 'judge') {
      var p = pick([2, 3, 5, 7, 11, 13, 17, 19]);
      return { q: p + ' 是（填：质数/合数）', answer: '质数', hint: '只有 1 和它本身两个因数的数是质数。' };
    }
    if (v === 'factors') {
      var c = pick([4, 6, 8, 9, 10, 12, 14, 15]);
      return { q: c + ' 是（填：质数/合数）', answer: '合数', hint: '除了 1 和它本身还有别的因数的数是合数。' };
    }
    return { q: '最小的质数是（  ）', answer: 2, hint: '质数是只有 1 和它本身两个因数的数，最小的质数是 2。' };
  }

  // ============ 分数的意义与分数单位 ============
  function buildFracMeaning() {
    var v = pick(['unit', 'parts', 'meaning']);
    if (v === 'unit') {
      var d = pick([2, 3, 4, 5, 6, 8]);
      return { q: '1/' + d + ' 的分数单位是（  ）', answer: '1/' + d, hint: '把单位「1」平均分成' + d + '份，取一份就是分数单位。' };
    }
    if (v === 'parts') {
      var d2 = pick([4, 5, 8, 10]);
      var n2 = rnd(1, d2 - 1);
      return { q: '把单位「1」平均分成 ' + d2 + ' 份，取 ' + n2 + ' 份，用分数表示是（  ）', answer: n2 + '/' + d2, hint: '平均分成的份数作分母，取的份数作分子。' };
    }
    var a = rnd(2, 9), b = rnd(2, 9);
    return { q: a + '/' + b + ' 表示把单位「1」平均分成 ' + b + ' 份，取（  ）份', answer: a, hint: '分母表示平均分的份数，分子表示取的份数。' };
  }

  // ============ 分数的基本性质 ============
  function buildFracProperty() {
    var v = pick(['enlarge', 'reduce', 'equals']);
    var n = rnd(1, 4), d = pick([3, 5, 6, 8, 10]);
    if (v === 'enlarge') {
      var k = rnd(2, 3);
      return { q: n + '/' + d + ' 的分子、分母同时乘 ' + k + '，得到（  ）', answer: (n * k) + '/' + (d * k), hint: '分数的分子和分母同时乘一个相同的数，分数大小不变。' };
    }
    if (v === 'reduce') {
      var d2 = d * 2, n2 = n * 2;
      return { q: n2 + '/' + d2 + ' 约分后是（  ）', answer: n + '/' + d, hint: '分子和分母同时除以它们的最大公因数。' };
    }
    var eq1 = n + '/' + d;
    var eq2 = (n * 2) + '/' + (d * 2);
    return { q: eq1 + ' ○ ' + eq2 + '，○ 里填', answer: '=', hint: '根据分数的基本性质，这两个分数相等。' };
  }

  // ============ 分数与小数的互化 ============
  function buildFracDecimal() {
    var v = pick(['f2d', 'd2f']);
    if (v === 'f2d') {
      var d = pick([2, 4, 5, 8, 10]);
      var n = rnd(1, d - 1);
      var dec = (n / d).toFixed(2);
      return { q: n + '/' + d + ' 化成小数是（  ）', answer: dec, hint: '用分子除以分母。' };
    }
    var m = pick([0.2, 0.25, 0.4, 0.5, 0.6, 0.75, 0.8]);
    return { q: m + ' 化成分数是（  ）', answer: mStr(m), hint: m + ' = ' + m + ' 化成分数并约分。' };
  }
  function mStr(m) {
    if (m === 0.2) return '1/5';
    if (m === 0.25) return '1/4';
    if (m === 0.4) return '2/5';
    if (m === 0.5) return '1/2';
    if (m === 0.6) return '3/5';
    if (m === 0.75) return '3/4';
    if (m === 0.8) return '4/5';
    return String(m);
  }

  // ============ 数对的含义 ============
  function buildCoordinate() {
    var v = pick(['read', 'write']);
    var x = rnd(1, 6), y = rnd(1, 6);
    if (v === 'read') {
      return { q: '数对（' + x + ', ' + y + '）表示第 ' + x + ' 列第（  ）行', answer: y, hint: '数对中第一个数表示列，第二个数表示行。' };
    }
    return { q: '第 ' + x + ' 列第 ' + y + ' 行用数对表示是（  ）', answer: '(' + x + ', ' + y + ')', hint: '先写列再写行，用逗号隔开。' };
  }

  // ============ 多边形面积公式 ============
  function buildAreaFormula() {
    var v = pick(['rect', 'sq', 'tri', 'para', 'trap']);
    if (v === 'rect') {
      var a = rnd(3, 12), b = rnd(3, 12);
      return { q: '长 ' + a + '、宽 ' + b + ' 的长方形面积 =（  ）', answer: a * b, hint: '长方形面积 = 长 × 宽。' };
    }
    if (v === 'sq') {
      var s = rnd(3, 12);
      return { q: '边长 ' + s + ' 的正方形面积 =（  ）', answer: s * s, hint: '正方形面积 = 边长 × 边长。' };
    }
    if (v === 'tri') {
      var b3 = rnd(4, 12), h = rnd(3, 10);
      var ans = b3 * h / 2;
      return { q: '底 ' + b3 + '、高 ' + h + ' 的三角形面积 =（  ）', answer: ans, hint: '三角形面积 = 底 × 高 ÷ 2。' };
    }
    if (v === 'para') {
      var b4 = rnd(4, 12), h4 = rnd(3, 10);
      return { q: '底 ' + b4 + '、高 ' + h4 + ' 的平行四边形面积 =（  ）', answer: b4 * h4, hint: '平行四边形面积 = 底 × 高。' };
    }
    var up = rnd(2, 6), down = rnd(3, 9), h5 = rnd(3, 8);
    var a5 = (up + down) * h5 / 2;
    return { q: '上底 ' + up + '、下底 ' + down + '、高 ' + h5 + ' 的梯形面积 =（  ）', answer: a5, hint: '梯形面积 =（上底 + 下底）× 高 ÷ 2。' };
  }

  // ============ 长方体正方体特征与公式 ============
  function buildSolidFormula() {
    var v = pick(['vol', 'surface', 'feature']);
    if (v === 'vol') {
      var a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9);
      return { q: '长 ' + a + '、宽 ' + b + '、高 ' + c + ' 的长方体体积 =（  ）', answer: a * b * c, hint: '长方体体积 = 长 × 宽 × 高。' };
    }
    if (v === 'surface') {
      var a2 = rnd(2, 6), b2 = rnd(2, 6), c2 = rnd(2, 6);
      var s = 2 * (a2 * b2 + a2 * c2 + b2 * c2);
      return { q: '长 ' + a2 + '、宽 ' + b2 + '、高 ' + c2 + ' 的长方体表面积 =（  ）', answer: s, hint: '长方体表面积 = 2×(长×宽 + 长×高 + 宽×高)。' };
    }
    var s3 = rnd(2, 6);
    return { q: '正方体棱长 ' + s3 + '，体积 =（  ）', answer: s3 * s3 * s3, hint: '正方体体积 = 棱长 × 棱长 × 棱长。' };
  }

  // ============ 旋转三要素 ============
  function buildRotationElem() {
    var v = pick(['degree', 'direction', 'center']);
    if (v === 'degree') {
      var d = pick([90, 180]);
      return { q: '图形旋转了 ' + d + '°，旋转角是（  ）°', answer: d, hint: '旋转三要素：旋转中心、旋转方向、旋转角度。' };
    }
    if (v === 'direction') {
      return { q: '与时针方向相同的是（填：顺时针/逆时针）', answer: '顺时针', hint: '时针走动的方向叫顺时针。' };
    }
    return { q: '旋转时要绕着一个固定点转，这个点叫（  ）', answer: '旋转中心', hint: '旋转三要素之一是旋转中心。' };
  }

  // ============ 可能性描述 ============
  function buildPossibility() {
    var v = pick(['sure', 'likely', 'impossible']);
    var n = rnd(5, 10), red = rnd(1, n - 1);
    var other = n - red;
    if (v === 'sure') {
      return { q: '袋子里全是红球，摸一个球（填：一定/可能/不可能）是红球', answer: '一定', hint: '全是红球，摸出的一定是红球。' };
    }
    if (v === 'likely') {
      return { q: '袋子里有 ' + red + ' 个红球和 ' + other + ' 个白球，摸出一个球（填：可能/一定）是红球', answer: '可能', hint: '袋子里有红球也有白球，摸出的可能是红球也可能是白球。' };
    }
    return { q: '袋子里全是红球，摸一个球（填：一定/可能/不可能）是黄球', answer: '不可能', hint: '没有黄球，所以不可能摸出黄球。' };
  }

  // ============ 折线统计图特点 ============
  function buildLinechartFeature() {
    var v = pick(['purpose', 'trend', 'compare']);
    if (v === 'purpose') {
      return { q: '要清楚地表示数量的增减变化情况，应选用（填：折线/条形）统计图', answer: '折线', hint: '折线统计图能清楚地反映数量的增减变化趋势。' };
    }
    if (v === 'trend') {
      var up = pick([true, false]);
      return { q: '折线统计图上升表示数量（填：增加/减少）', answer: '增加', hint: '折线上升表示数量在增加。' };
    }
    return { q: '既能表示数量多少，又能表示增减变化的是（填：折线/条形）统计图', answer: '折线', hint: '折线统计图的特点是表示数量变化趋势。' };
  }

  // ============ 综合填空 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 8) return buildDecPlace();
    if (r <= 15) return buildDecCompare();
    if (r <= 22) return buildProductRule();
    if (r <= 29) return buildRepeatingNote();
    if (r <= 36) return buildEquationProp();
    if (r <= 43) return buildFactorMultiple();
    if (r <= 50) return buildPrimeComposite();
    if (r <= 57) return buildFracMeaning();
    if (r <= 64) return buildFracProperty();
    if (r <= 71) return buildFracDecimal();
    if (r <= 78) return buildCoordinate();
    if (r <= 85) return buildAreaFormula();
    if (r <= 90) return buildSolidFormula();
    if (r <= 94) return buildRotationElem();
    if (r <= 97) return buildPossibility();
    return buildLinechartFeature();
  }

  var TYPE_BUILDERS = {
    'dec-place': buildDecPlace,
    'dec-compare': buildDecCompare,
    'product-rule': buildProductRule,
    'repeating-note': buildRepeatingNote,
    'equation-prop': buildEquationProp,
    'factor-multiple': buildFactorMultiple,
    'prime-composite': buildPrimeComposite,
    'frac-meaning': buildFracMeaning,
    'frac-property': buildFracProperty,
    'frac-decimal': buildFracDecimal,
    'coordinate': buildCoordinate,
    'area-formula': buildAreaFormula,
    'solid-formula': buildSolidFormula,
    'rotation-elem': buildRotationElem,
    'possibility': buildPossibility,
    'linechart-feature': buildLinechartFeature,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'dec-place': '小数的计数单位与数位',
    'dec-compare': '小数大小比较',
    'product-rule': '积的变化规律',
    'repeating-note': '循环小数与简便记法',
    'equation-prop': '方程概念与等式的性质',
    'factor-multiple': '因数与倍数的概念',
    'prime-composite': '质数与合数',
    'frac-meaning': '分数的意义与分数单位',
    'frac-property': '分数的基本性质',
    'frac-decimal': '分数与小数的互化',
    'coordinate': '数对的含义',
    'area-formula': '多边形面积公式',
    'solid-formula': '长方体正方体特征与公式',
    'rotation-elem': '旋转三要素',
    'possibility': '可能性描述',
    'linechart-feature': '折线统计图特点',
    mix: '综合填空'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g5-fill',
    moduleId: 'M4',
    name: '填空题',
    pageTitle: '五年级填空练习',
    pageSubtitle: '小数、因数倍数、分数、图形与统计',
    grades: [5],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['g5-fill-decloc', 'g5-fill-deccmp', 'g5-fill-prodrule', 'g5-fill-repeating',
      'g5-fill-equation', 'g5-fill-fm', 'g5-fill-prime', 'g5-fill-fracmean', 'g5-fill-fracprop',
      'g5-fill-fracdec', 'g5-fill-coord', 'g5-fill-area', 'g5-fill-solid', 'g5-fill-rotate',
      'g5-fill-possible', 'g5-fill-linechart'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix', label: '综合填空' },
          { value: 'dec-place', label: '小数的计数单位与数位' },
          { value: 'dec-compare', label: '小数大小比较' },
          { value: 'product-rule', label: '积的变化规律' },
          { value: 'repeating-note', label: '循环小数与简便记法' },
          { value: 'equation-prop', label: '方程概念与等式的性质' },
          { value: 'factor-multiple', label: '因数与倍数的概念' },
          { value: 'prime-composite', label: '质数与合数' },
          { value: 'frac-meaning', label: '分数的意义与分数单位' },
          { value: 'frac-property', label: '分数的基本性质' },
          { value: 'frac-decimal', label: '分数与小数的互化' },
          { value: 'coordinate', label: '数对的含义' },
          { value: 'area-formula', label: '多边形面积公式' },
          { value: 'solid-formula', label: '长方体正方体公式' },
          { value: 'rotation-elem', label: '旋转三要素' },
          { value: 'possibility', label: '可能性描述' },
          { value: 'linechart-feature', label: '折线统计图特点' }
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
        title: '小学五年级填空练习（' + (TYPE_NAMES[type] || '综合填空') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);