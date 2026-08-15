/**
 * plugins/math-g5-word.js — 五年级解决问题插件（M8 解决问题）
 *
 * 知识点覆盖（shared/knowledge-bank.js 五年级 M8 模块）：
 *   g5-word-decmul    小数乘法应用题       （type: 'dec-mul-app'）
 *   g5-word-decdiv    小数除法应用题       （type: 'dec-div-app'）
 *   g5-word-equ       列方程解决问题       （type: 'equation-app'）
 *   g5-word-fm        因数与倍数简单应用   （type: 'factor-app'）
 *   g5-word-frac      分数加减法应用题     （type: 'frac-app'）
 *   g5-word-area      多边形面积应用题     （type: 'area-app'）
 *   g5-word-solid     长方体正方体应用题   （type: 'solid-app'）
 *   g5-word-possib    可能性问题           （type: 'possibility-app'）
 *   g5-word-linechart 折线统计图分析       （type: 'linechart-app'）
 *   g5-word-tree      植树问题             （type: 'tree-app'）
 *   g5-word-defect    找次品               （type: 'defective'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g5-word.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function trimD(x) { return String(Number(x.toFixed(2))); }

  // ============ 小数乘法应用题 ============
  function buildDecMulApp() {
    var v = pick(['money', 'speed', 'qty']);
    if (v === 'money') {
      var price = rnd(3, 9) / 10 + rnd(1, 5); // 1.x~5.x 元
      var qty = rnd(3, 9);
      var total = Math.round(price * qty * 10) / 10;
      var ps = trimD(price);
      return { q: '每千克苹果 ' + ps + ' 元，买 ' + qty + ' 千克，一共（  ）元', answer: trimD(total), hint: trimD(price) + '×' + qty + ' = ' + trimD(total) + '（总价 = 单价 × 数量）' };
    }
    if (v === 'speed') {
      var sp = rnd(5, 9) / 10 + 6; // 6.5~9.9 千米/时
      var tm = rnd(2, 6);
      var dist = Math.round(sp * tm * 10) / 10;
      return { q: '小华骑车每小时行 ' + trimD(sp) + ' 千米，' + tm + ' 小时行（  ）千米', answer: trimD(dist), hint: trimD(sp) + '×' + tm + ' = ' + trimD(dist) + '（路程 = 速度 × 时间）' };
    }
    var len = rnd(12, 99) / 10; // 1.2~9.9 米
    var n = rnd(3, 8);
    var total2 = Math.round(len * n * 10) / 10;
    return { q: '一根绳子长 ' + trimD(len) + ' 米，' + n + ' 根这样的绳子一共（  ）米', answer: trimD(total2), hint: trimD(len) + '×' + n + ' = ' + trimD(total2) + '。' };
  }

  // ============ 小数除法应用题（进一法、去尾法） ============
  function buildDecDivApp() {
    var v = pick(['carry', 'floor']);
    if (v === 'carry') {
      // 进一法：油桶装油
      var total = rnd(15, 30); // 油总量（升）
      var cap = pick([2.5, 4.5, 5]);
      var need = Math.ceil(total / cap);
      return { q: '有 ' + total + ' 升油，每个油桶能装 ' + cap + ' 升，需要（  ）个油桶', answer: need, hint: total + '÷' + cap + ' ≈ ' + trimD(total / cap) + '，进一法取整：' + need + '。' };
    }
    // 去尾法：布做衣服
    var len = rnd(20, 60);
    var per = pick([2.5, 3.5, 4]);
    var canMake = Math.floor(len / per);
    if (canMake < 1) canMake = 1;
    return { q: '一块布长 ' + len + ' 米，做一件衣服用 ' + per + ' 米，最多能做（  ）件衣服', answer: canMake, hint: len + '÷' + per + ' ≈ ' + trimD(len / per) + '，去尾法取整：' + canMake + '。' };
  }

  // ============ 列方程解决问题 ============
  function buildEquationApp() {
    var v = pick(['sum', 'diff', 'mul']);
    if (v === 'sum') {
      var x = rnd(3, 12), b = rnd(5, 20);
      var total = x + b;
      return { q: '学校有故事书 ' + b + ' 本，科技书比故事书多，两种书一共 ' + total + ' 本。设科技书有 x 本，列方程并求出 x =（  ）', answer: x, hint: 'x + ' + b + ' = ' + total + '，x = ' + total + ' − ' + b + '。' };
    }
    if (v === 'diff') {
      var x2 = rnd(5, 20), b2 = rnd(2, 8);
      var total2 = x2 * b2;
      return { q: '苹果的千克数是梨的 ' + b2 + ' 倍，两种水果共 ' + total2 + ' 千克。设梨有 x 千克，x =（  ）', answer: x2, hint: 'x + ' + b2 + 'x = ' + total2 + '，即 ' + (b2 + 1) + 'x = ' + total2 + '，x = ' + x2 + '。' };
    }
    var a = rnd(5, 20);
    var x3 = rnd(3, 9), b3 = rnd(3, 9);
    var extra = rnd(1, 3);
    var dad = x3 * b3 + extra;
    return { q: '小明今年 x 岁，爸爸的年龄是小明的 ' + b3 + ' 倍多 ' + extra + ' 岁，爸爸今年 ' + dad + ' 岁，x =（  ）', answer: x3, hint: '列方程：' + b3 + 'x + ' + extra + ' = ' + dad + '，解出 x。' };
  }

  // ============ 因数与倍数简单应用 ============
  function buildFactorApp() {
    var v = pick(['group', 'div', 'lcm']);
    if (v === 'group') {
      var tot = rnd(30, 60);
      var g = pick([2, 3, 4, 5, 6, 8, 10]);
      while (tot % g !== 0) tot++;
      return { q: '有 ' + tot + ' 个同学，平均分成 ' + g + ' 组，每组（  ）人', answer: tot / g, hint: '每组人数 = 总数 ÷ 组数。' };
    }
    if (v === 'div') {
      var a = rnd(20, 60), b = rnd(2, 9);
      while (a % b !== 0) a++;
      return { q: a + ' 本练习本，平均分给 ' + b + ' 个同学，每人分（  ）本，正好分完', answer: a / b, hint: a + ' 是 ' + b + ' 的倍数，' + a + ' ÷ ' + b + ' = ' + (a / b) + '。' };
    }
    var m = pick([3, 4, 5, 6]);
    var n2 = pick([2, 3, 4]);
    var k = m * n2;
    return { q: m + ' 和 ' + n2 + ' 的最小公倍数是（  ）', answer: k, hint: '用列举法或短除法求最小公倍数。' };
  }

  // ============ 分数加减法应用题 ============
  function buildFracApp() {
    var d = pick([4, 5, 8, 10]);
    var a = rnd(1, d - 1), b = rnd(1, d - 1);
    var q, ans;
    if (pick([1, 2]) === 1) {
      var sum = a + b;
      if (sum >= d) {
        var whole = Math.floor(sum / d), rem = sum % d;
        ans = rem === 0 ? String(whole) : whole + '又' + rem + '/' + d;
      } else {
        ans = sum + '/' + d;
      }
      q = '一本书，第一天看了它的 ' + a + '/' + d + '，第二天看了它的 ' + b + '/' + d + '，两天一共看了全书的（  ）';
      return { q: q, answer: ans, hint: '同分母分数相加：' + a + '/' + d + ' + ' + b + '/' + d + '。' };
    }
    var mx = Math.max(a, b), mn = Math.min(a, b);
    var less = rnd(1, mn);
    var second = mx - less;
    if (second <= 0) { second = 1; less = mx - second; }
    q = '一本书，第一天看了全书的 ' + mx + '/' + d + '，第二天比第一天少看全书的 ' + less + '/' + d + '，第二天看了全书的（  ）';
    ans = second + '/' + d;
    return { q: q, answer: ans, hint: '同分母分数相减：' + mx + '/' + d + ' − ' + less + '/' + d + ' = ' + ans + '。' };
  }

  // ============ 多边形面积应用题 ============
  function buildAreaApp() {
    var v = pick(['tri', 'para', 'trap', 'rect']);
    var q, ans;
    if (v === 'tri') {
      var b = rnd(6, 20), h = rnd(4, 12);
      var area = b * h / 2;
      q = '一块三角形菜地，底 ' + b + ' 米，高 ' + h + ' 米，面积是（  ）平方米';
      ans = area;
    } else if (v === 'para') {
      var b2 = rnd(6, 20), h2 = rnd(4, 12);
      var area2 = b2 * h2;
      q = '一块平行四边形草地，底 ' + b2 + ' 米，高 ' + h2 + ' 米，面积是（  ）平方米';
      ans = area2;
    } else if (v === 'trap') {
      var up = rnd(3, 8), down = rnd(8, 15), h3 = rnd(4, 10);
      var area3 = (up + down) * h3 / 2;
      q = '一块梯形菜地，上底 ' + up + ' 米，下底 ' + down + ' 米，高 ' + h3 + ' 米，面积是（  ）平方米';
      ans = area3;
    } else {
      var L = rnd(8, 30), W = rnd(4, 20);
      var area4 = L * W;
      q = '一间长方形教室长 ' + L + ' 米，宽 ' + W + ' 米，面积是（  ）平方米';
      ans = area4;
    }
    var hint = v === 'tri' ? '面积 = 底 × 高 ÷ 2' : v === 'para' ? '面积 = 底 × 高' : v === 'trap' ? '面积 =（上底 + 下底）× 高 ÷ 2' : '面积 = 长 × 宽';
    return { q: q, answer: ans, hint: hint };
  }

  // ============ 长方体正方体应用题 ============
  function buildSolidApp() {
    var v = pick(['vol', 'surface', 'water']);
    if (v === 'vol') {
      var a = rnd(3, 8), b = rnd(2, 6), c = rnd(2, 5);
      var vol = a * b * c;
      return { q: '一个长方体水箱，长 ' + a + ' 分米、宽 ' + b + ' 分米、高 ' + c + ' 分米，容积是（  ）立方分米', answer: vol, hint: '容积 = 长 × 宽 × 高。' };
    }
    if (v === 'surface') {
      var a2 = rnd(2, 6), b2 = rnd(2, 6), c2 = rnd(2, 5);
      var s = 2 * (a2 * b2 + a2 * c2 + b2 * c2);
      return { q: '一个长方体纸盒，长 ' + a2 + ' 厘米、宽 ' + b2 + ' 厘米、高 ' + c2 + ' 厘米，表面积是（  ）平方厘米', answer: s, hint: '表面积 = 2×(长×宽 + 长×高 + 宽×高)。' };
    }
    var len = rnd(3, 9);
    var vol2 = len * len * len;
    return { q: '一个正方体容器，棱长 ' + len + ' 分米，能装水（  ）升', answer: vol2, hint: '容积 = 棱长 × 棱长 × 棱长，1 立方分米 = 1 升。' };
  }

  // ============ 可能性问题 ============
  function buildPossibilityApp() {
    var red = rnd(2, 5), white = rnd(2, 5);
    var total = red + white;
    var v = pick(['which', 'count']);
    if (v === 'which') {
      var q = '袋子里有 ' + red + ' 个红球和 ' + white + ' 个白球，摸出一个球，摸到（填：红球/白球）的可能性大';
      var ans = red > white ? '红球' : red < white ? '白球' : '一样大';
      return { q: q, answer: ans, hint: '哪种球的数量多，摸到的可能性就大。' };
    }
    return { q: '袋子里有 ' + red + ' 个红球和 ' + white + ' 个白球，任意摸一个，摸到红球的可能性是（  ）（填分数）', answer: red + '/' + total, hint: '红球个数 ÷ 总个数 = ' + red + '/' + total + '。' };
  }

  // ============ 折线统计图分析 ============
  function buildLinechartApp() {
    var v = pick(['max', 'up', 'compare']);
    var vals = [];
    for (var i = 0; i < 5; i++) vals.push(rnd(10, 50));
    var maxIdx = 0, minIdx = 0;
    for (var j = 1; j < 5; j++) { if (vals[j] > vals[maxIdx]) maxIdx = j; if (vals[j] < vals[minIdx]) minIdx = j; }
    if (v === 'max') {
      return { q: '一周气温（℃）：' + vals.join('、') + '，最高气温是（  ）℃', answer: vals[maxIdx], hint: '找这组数中最大的。' };
    }
    if (v === 'up') {
      var q = '一周气温（℃）：' + vals.join('、') + '，气温整体呈（填：上升/下降/不变）趋势';
      var trend = vals[4] > vals[0] ? '上升' : vals[4] < vals[0] ? '下降' : '不变';
      return { q: q, answer: trend, hint: '比较第一天和最后一天的气温。' };
    }
    return { q: '一周气温（℃）：' + vals.join('、') + '，最低气温是（  ）℃', answer: vals[minIdx], hint: '找这组数中最小的。' };
  }

  // ============ 植树问题 ============
  function buildTreeApp() {
    var v = pick(['both', 'one', 'none', 'ring']);
    if (v === 'both') {
      var n = rnd(4, 10);
      var trees = n + 1;
      return { q: '在一条 ' + n + ' 米的小路一边植树，每隔 1 米栽一棵，两端都栽，要栽（  ）棵', answer: trees, hint: '两端都栽：棵数 = 段数 + 1。' };
    }
    if (v === 'one') {
      var n2 = rnd(4, 10);
      return { q: '在一条 ' + n2 + ' 米的小路一边植树，每隔 1 米栽一棵，只栽一端，要栽（  ）棵', answer: n2, hint: '只栽一端：棵数 = 段数。' };
    }
    if (v === 'none') {
      var n3 = rnd(4, 10);
      if (n3 < 3) n3 = 4;
      return { q: '在一条 ' + n3 + ' 米的小路一边植树，每隔 1 米栽一棵，两端都不栽，要栽（  ）棵', answer: n3 - 1, hint: '两端都不栽：棵数 = 段数 − 1。' };
    }
    var n4 = rnd(4, 10);
    return { q: '在一个周长 ' + n4 + ' 米的圆形花坛周围种树，每隔 1 米种一棵，一共种（  ）棵', answer: n4, hint: '封闭图形：棵数 = 段数。' };
  }

  // ============ 找次品 ============
  function buildDefective() {
    // 用天平找次品：3^n 内最少称 n 次
    var n = rnd(2, 3);
    var items = Math.pow(3, n);
    return { q: '有 ' + items + ' 个零件，其中有 1 个次品（略轻），用天平至少称（  ）次能保证找出次品', answer: n, hint: '3^' + n + ' = ' + items + ' 个以内，最多称 ' + n + ' 次。' };
  }

  // ============ 综合解决问题 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 12) return buildDecMulApp();
    if (r <= 24) return buildDecDivApp();
    if (r <= 36) return buildEquationApp();
    if (r <= 45) return buildFactorApp();
    if (r <= 56) return buildFracApp();
    if (r <= 68) return buildAreaApp();
    if (r <= 78) return buildSolidApp();
    if (r <= 84) return buildPossibilityApp();
    if (r <= 90) return buildLinechartApp();
    if (r <= 97) return buildTreeApp();
    return buildDefective();
  }

  var TYPE_BUILDERS = {
    'dec-mul-app': buildDecMulApp,
    'dec-div-app': buildDecDivApp,
    'equation-app': buildEquationApp,
    'factor-app': buildFactorApp,
    'frac-app': buildFracApp,
    'area-app': buildAreaApp,
    'solid-app': buildSolidApp,
    'possibility-app': buildPossibilityApp,
    'linechart-app': buildLinechartApp,
    'tree-app': buildTreeApp,
    'defective': buildDefective,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'dec-mul-app': '小数乘法应用',
    'dec-div-app': '小数除法应用',
    'equation-app': '列方程解决问题',
    'factor-app': '因数倍数应用',
    'frac-app': '分数加减应用',
    'area-app': '多边形面积应用',
    'solid-app': '长方体正方体应用',
    'possibility-app': '可能性问题',
    'linechart-app': '折线统计图分析',
    'tree-app': '植树问题',
    'defective': '找次品',
    mix: '综合解决问题'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g5-word',
    moduleId: 'M8',
    name: '解决问题',
    pageTitle: '五年级解决问题',
    pageSubtitle: '小数、方程、因数倍数、分数、面积、体积、统计与植树',
    grades: [5],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['g5-word-decmul', 'g5-word-decdiv', 'g5-word-equ', 'g5-word-fm', 'g5-word-frac',
      'g5-word-area', 'g5-word-solid', 'g5-word-possib', 'g5-word-linechart', 'g5-word-tree', 'g5-word-defect'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix', label: '综合解决问题' },
          { value: 'dec-mul-app', label: '小数乘法应用' },
          { value: 'dec-div-app', label: '小数除法应用' },
          { value: 'equation-app', label: '列方程解决问题' },
          { value: 'factor-app', label: '因数倍数应用' },
          { value: 'frac-app', label: '分数加减应用' },
          { value: 'area-app', label: '多边形面积应用' },
          { value: 'solid-app', label: '长方体正方体应用' },
          { value: 'possibility-app', label: '可能性问题' },
          { value: 'linechart-app', label: '折线统计图分析' },
          { value: 'tree-app', label: '植树问题' },
          { value: 'defective', label: '找次品' }
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
        return { type: 'word', q: p.q, answer: String(p.answer), hint: p.hint, inputType: 'text' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学五年级解决问题（' + (TYPE_NAMES[type] || '综合解决问题') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);