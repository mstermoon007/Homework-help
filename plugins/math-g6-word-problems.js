/**
 * plugins/math-g6-word-problems.js — 六年级解决问题插件（M8 分数百分数与比的应用题）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M8 模块）：
 *   g6-m8-g6-app-frac-mult       分数乘法应用题        （type: 'frac-mult'）
 *   g6-m8-g6-app-frac-div        分数除法应用题        （type: 'frac-div'）
 *   g6-m8-g6-app-percent-discount 百分数与折扣应用题    （type: 'percent-discount'）
 *   g6-m8-g6-app-ratio-prop      比与比例解决问题      （type: 'ratio-prop'）
 *   g6-m8-g6-app-circle          圆的周长面积应用      （type: 'circle'）
 *   g6-m8-g6-app-cyl-cone        圆柱圆锥应用          （type: 'cyl-cone'）
 *   g6-m8-g6-app-travel-work     行程与工程问题        （type: 'travel-work'）
 *   g6-m8-g6-app-pigeonhole      鸽巢问题              （type: 'pigeonhole'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-word-problems.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function trimD(x) { return String(Number(x.toFixed(3))); }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function reduce(n, d) { var g = gcd(Math.abs(n), d); return [n / g, d / g]; }
  function fracAns(n, d) { var r = reduce(n, d); return r[1] === 1 ? String(r[0]) : r[0] + '/' + r[1]; }
  var PI3 = 3.14;

  // ============ 分数乘法应用题 ============
  function buildFracMult() {
    var v = pick(['of', 'twostep', 'frac']);
    if (v === 'of') {
      var total = rnd(4, 9) * 30;
      var d = pick([3, 4, 5, 6]);
      var a = rnd(1, d - 1);
      return { q: '六年级有学生 ' + total + ' 人，其中女生占 ' + a + '/' + d + '，女生有（  ）人', answer: total * a / d, hint: '求一个数的几分之几用乘法：总数 × 对应的分数，自己算一算。' };
    }
    if (v === 'twostep') {
      var pages = rnd(4, 9) * 20;
      var d2 = pick([4, 5]), a2 = rnd(1, d2 - 1);
      var d3 = pick([3, 4]), a3 = rnd(1, d3 - 1);
      var first = pages * a2 / d2;
      var second = first * a3 / d3;
      if (second !== Math.floor(second)) return buildFracMult();
      return { q: '一本书 ' + pages + ' 页，第一天读了全书的 ' + a2 + '/' + d2 + '，第二天读了第一天的 ' + a3 + '/' + d3 + '，第二天读了（  ）页', answer: second, hint: '先求第一天读了多少页（全书 × ' + a2 + '/' + d2 + '），再求第二天是第一天的 ' + a3 + '/' + d3 + '。' };
    }
    var d4 = pick([3, 5, 6]), a4 = rnd(1, d4 - 1);
    return { q: '一根绳子长 ' + a4 + '/' + d4 + ' 米，截去它的 1/2，截去了（  ）米', answer: fracAns(a4, d4 * 2), hint: '分数乘分数：分子相乘作分子，分母相乘作分母，能约分的先约分。' };
  }

  // ============ 分数除法应用题 ============
  function buildFracDiv() {
    var v = pick(['unit1', 'reverse', 'divide']);
    if (v === 'unit1') {
      var d = pick([3, 4, 5]), a = rnd(1, d - 1);
      var given = rnd(2, 6) * a;
      var total = given * d / a;
      return { q: '一堆煤，运走了它的 ' + a + '/' + d + '，正好运走 ' + given + ' 吨，这堆煤共有（  ）吨', answer: total, hint: '已知一个数的几分之几是多少，求这个数用除法：用已知数量除以对应的分数。' };
    }
    if (v === 'reverse') {
      var d2 = pick([3, 4, 5]), a2 = rnd(1, d2 - 1);
      var rest = d2 - a2;
      var unit = rnd(2, 8) * rest;
      var total2 = unit * d2 / rest;
      if (total2 !== Math.floor(total2)) return buildFracDiv();
      return { q: '一本书已经看了全书的 ' + a2 + '/' + d2 + '，还剩 ' + unit + ' 页没看，全书共（  ）页', answer: total2, hint: '先算出剩下的占全书的几分之几（1 − ' + a2 + '/' + d2 + '），再用剩下的页数除以这个分数。' };
    }
    var d3 = pick([3, 4, 5, 8]), a3 = rnd(1, d3 - 1);
    var k = rnd(3, 8);
    return { q: '把 ' + a3 + '/' + d3 + ' 千克的糖平均分成 ' + k + ' 份，每份（  ）千克', answer: fracAns(a3, d3 * k), hint: '平均分成几份用除法，除以一个整数等于乘它的倒数，能约分的先约分。' };
  }

  // ============ 按比分配 ============
  function buildRatioPart() {
    var v = pick(['parts', 'total', 'diff']);
    if (v === 'parts') {
      var x = rnd(2, 6), y = rnd(2, 6);
      var k = rnd(2, 4);
      var total = (x + y) * k;
      return { q: '甲、乙两队人数的比是 ' + x + ':' + y + '，两队共 ' + total + ' 人，甲队有（  ）人', answer: x * k, hint: '先求出总份数（' + x + ' + ' + y + '），用总数除以总份数得每份人数，再乘甲队的份数。' };
    }
    if (v === 'total') {
      var x2 = rnd(2, 5), y2 = rnd(2, 5);
      var k2 = rnd(3, 8);
      return { q: '按 ' + x2 + ':' + y2 + ' 分配，其中一份是 ' + k2 + '，总数是（  ）', answer: (x2 + y2) * k2, hint: '总份数是 ' + (x2 + y2) + ' 份，总数 = 每份的数量 × 总份数，自己算一算。' };
    }
    var x3 = rnd(3, 6), y3 = rnd(2, x3 - 1);
    var k3 = rnd(2, 5);
    return { q: '甲、乙两数的比是 ' + x3 + ':' + y3 + '，甲比乙多 ' + ((x3 - y3) * k3) + '，甲是（  ）', answer: x3 * k3, hint: '先算出甲比乙多的份数（' + x3 + ' − ' + y3 + '），用差量除以多的份数得每份，再乘甲的份数。' };
  }

  // ============ 比例解决问题 ============
  function buildProportionPart() {
    var v = pick(['direct', 'scale', 'inverse']);
    if (v === 'direct') {
      var q1 = rnd(3, 9), price = rnd(3, 8) * 1.5;
      var q2 = rnd(4, 10);
      var unitPrice = price / q1;
      var total = Math.round(unitPrice * q2 * 100) / 100;
      return { q: q1 + ' 本练习本 ' + trimD(price) + ' 元，照这样计算，买 ' + q2 + ' 本需要（  ）元', answer: trimD(total), hint: '单价 = ' + trimD(price) + ' ÷ ' + q1 + '，总价 = 单价 × ' + q2 + '（正比例）。' };
    }
    if (v === 'scale') {
      var km = rnd(2, 6), cm = 3;
      return { q: '地图比例尺 1:50000，图上 ' + cm + ' 厘米表示实际（  ）千米', answer: cm * 50000 / 100000, hint: '图上距离 × 比例尺的分母得实际厘米数，再把厘米换算成千米。' };
    }
    var rate = rnd(4, 8), days = rnd(4, 9), rate2 = rnd(2, 4);
    var totalWork = rate * days;
    var days2 = totalWork / rate2;
    if (days2 !== Math.floor(days2)) return buildProportionPart();
    return { q: '一项工程，每天做 ' + rate + ' 个需要 ' + days + ' 天完成；每天做 ' + rate2 + ' 个，需要（  ）天（反比例）', answer: days2, hint: '工作总量不变：先求出总量，再用总量除以新的每天工作量。' };
  }

  // ============ 百分数与折扣应用题 ============
  function buildPercentDiscount() {
    var v = pick(['discount', 'rate', 'interest', 'growth']);
    if (v === 'discount') {
      var price = rnd(4, 9) * 20;
      var off = pick([80, 85, 90, 95]);
      return { q: '一件商品原价 ' + price + ' 元，打' + off + '折出售，现价（  ）元', answer: price * off / 100, hint: '现价 = 原价 × 折扣，几折就是百分之几十（' + off + ' 折 = ' + off + '%）。' };
    }
    if (v === 'rate') {
      var total = rnd(4, 9) * 10, present = rnd(total - 9, total - 1);
      return { q: '某班 ' + total + ' 人，今天出勤 ' + present + ' 人，出勤率是（  ）%', answer: Math.round(present / total * 1000) / 10, hint: '出勤率 = 出勤人数 ÷ 总人数 × 100%。' };
    }
    if (v === 'interest') {
      var money = rnd(2, 8) * 500, rate = pick([2, 2.5, 3, 3.5]);
      return { q: '把 ' + money + ' 元存入银行，年利率 ' + rate + '%，存一年可得利息（  ）元', answer: trimD(money * rate / 100), hint: '利息 = 本金 × 利率 × 时间，把利率的百分数化成小数再相乘。' };
    }
    var last = rnd(4, 9) * 20, pct = pick([10, 15, 20, 25]);
    return { q: '去年产量 ' + last + ' 吨，今年比去年增产 ' + pct + '%，今年产量（  ）吨', answer: last * (1 + pct / 100), hint: '今年产量 = 去年 × (1 + 增产率)，先算出括号里的和，再乘去年产量。' };
  }

  // ============ 圆的周长面积应用 ============
  function buildCircle() {
    var v = pick(['circum', 'area', 'diam']);
    if (v === 'circum') {
      var d = rnd(3, 8) / 10;
      return { q: '自行车车轮直径 ' + d + ' 米，滚动一周前进（  ）米（π 取 3.14）', answer: trimD(PI3 * d), hint: '周长 = π × 直径 = 3.14 × ' + d + '。' };
    }
    if (v === 'area') {
      var r = rnd(3, 8);
      return { q: '圆形花坛半径 ' + r + ' 米，它的面积是（  ）平方米（π 取 3.14）', answer: trimD(PI3 * r * r), hint: '面积 = π × 半径² = 3.14 × ' + r + '²。' };
    }
    var c = rnd(2, 6) * PI3;
    return { q: '圆形水池的周长是 ' + trimD(c) + ' 米，直径是（  ）米（π 取 3.14）', answer: trimD(c / PI3), hint: '直径 = 周长 ÷ π = ' + trimD(c) + ' ÷ 3.14。' };
  }

  // ============ 圆柱圆锥应用 ============
  function buildCylCone() {
    var v = pick(['vol', 'cone', 'water']);
    if (v === 'vol') {
      var r = rnd(2, 5), h = rnd(3, 8);
      return { q: '圆柱底面半径 ' + r + ' 分米，高 ' + h + ' 分米，体积是（  ）立方分米（π 取 3.14）', answer: trimD(PI3 * r * r * h), hint: '体积 = πr²h = 3.14 × ' + r + '² × ' + h + '。' };
    }
    if (v === 'cone') {
      var r2 = rnd(2, 4), h2 = rnd(3, 9);
      return { q: '圆锥底面半径 ' + r2 + ' 厘米，高 ' + h2 + ' 厘米，体积是（  ）立方厘米（π 取 3.14）', answer: trimD(PI3 * r2 * r2 * h2 / 3), hint: '圆锥体积 = 1/3 × πr²h = 3.14 × ' + r2 + '² × ' + h2 + ' ÷ 3。' };
    }
    var d = rnd(2, 4) * 2, h3 = rnd(3, 7);
    var rr = d / 2;
    return { q: '圆柱形水桶底面直径 ' + d + ' 分米，高 ' + h3 + ' 分米，能装水（  ）升（π 取 3.14，1 立方分米 = 1 升）', answer: trimD(PI3 * rr * rr * h3), hint: '容积 = 底面积 × 高 = π × 半径² × 高，半径 = 直径 ÷ 2，再换算成升。' };
  }

  // ============ 行程与工程问题 ============
  var WORK_PAIRS = [[6, 12], [10, 15], [4, 12], [12, 6], [6, 3], [10, 10], [15, 10], [8, 8], [12, 4], [3, 6], [6, 6]];
  function buildTravelWork() {
    var v = pick(['dist', 'time', 'speed', 'work', 'fracwork']);
    var speed = rnd(3, 9) * 10;
    var t1 = rnd(2, 5);
    var dist1 = speed * t1;
    if (v === 'dist') {
      var t2 = rnd(3, 6) / 2;
      var dist = speed * t2;
      return { q: '一辆汽车每小时行 ' + speed + ' 千米，行驶 ' + trimD(t2) + ' 小时，行了（  ）千米', answer: trimD(dist), hint: '路程 = 速度 × 时间，把速度和时间直接代入相乘。' };
    }
    if (v === 'time') {
      var dist2 = speed * rnd(2, 6);
      return { q: '一辆汽车 ' + t1 + ' 小时行了 ' + dist1 + ' 千米，照这样的速度，行 ' + dist2 + ' 千米需要（  ）小时', answer: dist2 / speed, hint: '先求出速度（路程 ÷ 时间），再用新的路程除以速度求时间。' };
    }
    if (v === 'speed') {
      return { q: '一辆汽车 ' + t1 + ' 小时行驶了 ' + dist1 + ' 千米，平均每小时行（  ）千米', answer: speed, hint: '速度 = 路程 ÷ 时间，把路程和时间代入相除。' };
    }
    if (v === 'work') {
      var pair = pick(WORK_PAIRS);
      var total = pair[0] * pair[1] / (pair[0] + pair[1]);
      return { q: '一项工程，甲队单独做 ' + pair[0] + ' 天完成，乙队单独做 ' + pair[1] + ' 天完成，两队合做（  ）天完成', answer: total, hint: '把总量看作 1，先分别求出两队的工作效率，再求合做效率，最后用 1 除以合做效率。' };
    }
    var d5 = pick([6, 8, 10, 12]);
    return { q: '一项工程，每天完成全工程的 1/' + d5 + '，（  ）天可以完成', answer: d5, hint: '把工作总量看作 1，用工作总量除以每天的工作量。' };
  }

  // ============ 鸽巢问题 ============
  function buildPigeonhole() {
    var v = pick(['apple', 'shengxiao', 'socks']);
    if (v === 'apple') {
      var a = rnd(5, 9), b = rnd(2, 4);
      return { q: '把 ' + a + ' 个苹果放进 ' + b + ' 个抽屉里，总有一个抽屉至少放（  ）个', answer: Math.ceil(a / b), hint: '用进一法：算出 ' + a + ' ÷ ' + b + ' 的商，有余数就向前进一。' };
    }
    if (v === 'shengxiao') {
      var n = rnd(13, 15);
      return { q: n + ' 个同学中，至少有（  ）个同学的属相相同（12 个属相）', answer: 2, hint: '想一想：人数比属相的种类（12 种）还多，会有什么必然结果。' };
    }
    var c = rnd(3, 5);
    return { q: '有 ' + c + ' 种不同颜色的袜子，一次至少摸（  ）只，才能保证有 2 只颜色相同', answer: c + 1, hint: '最不利时先每种颜色摸 1 只，再多摸 1 只就一定有两只颜色相同。' };
  }

  // ============ 综合解决问题 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 13) return buildFracMult();
    if (r <= 26) return buildFracDiv();
    if (r <= 42) return buildRatioPart();
    if (r <= 58) return buildProportionPart();
    if (r <= 72) return buildPercentDiscount();
    if (r <= 84) return buildCircle();
    if (r <= 92) return buildCylCone();
    if (r <= 94) return buildTravelWork();
    return buildPigeonhole();
  }

  var TYPE_BUILDERS = {
    'frac-mult': buildFracMult,
    'frac-div': buildFracDiv,
    'percent-discount': buildPercentDiscount,
    'ratio-prop': function () { return pick([buildRatioPart, buildProportionPart])(); },
    'circle': buildCircle,
    'cyl-cone': buildCylCone,
    'travel-work': buildTravelWork,
    'pigeonhole': buildPigeonhole,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'frac-mult': '分数乘法应用',
    'frac-div': '分数除法应用',
    'percent-discount': '百分数与折扣应用',
    'ratio-prop': '比与比例解决问题',
    'circle': '圆的周长面积应用',
    'cyl-cone': '圆柱圆锥应用',
    'travel-work': '行程与工程问题',
    'pigeonhole': '鸽巢问题',
    mix: '综合解决问题'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-word-problems',
    moduleId: 'M8',
    name: '解决问题',
    pageSubtitle: '分数、百分数与折扣、比和比例、圆、圆柱圆锥、行程工程与鸽巢',
    grades: [6],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'g6-m8-g6-app-frac-mult',
        'g6-m8-g6-app-frac-div',
        'g6-m8-g6-app-percent-discount',
        'g6-m8-g6-app-ratio-prop',
        'g6-m8-g6-app-circle',
        'g6-m8-g6-app-cyl-cone',
        'g6-m8-g6-app-travel-work',
        'g6-m8-g6-app-pigeonhole'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',             label: '综合解决问题' },
          { value: 'frac-mult',       label: '分数乘法应用' },
          { value: 'frac-div',        label: '分数除法应用' },
          { value: 'percent-discount', label: '百分数与折扣应用' },
          { value: 'ratio-prop',      label: '比与比例解决问题' },
          { value: 'circle',          label: '圆的周长面积应用' },
          { value: 'cyl-cone',        label: '圆柱圆锥应用' },
          { value: 'travel-work',     label: '行程与工程问题' },
          { value: 'pigeonhole',      label: '鸽巢问题' }
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
        title: '小学六年级解决问题（' + (TYPE_NAMES[type] || '综合解决问题') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);