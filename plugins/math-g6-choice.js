/**
 * plugins/math-g6-choice.js — 六年级选择题插件（M12 综合选择）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M12 模块）：
 *   g6-m12-g6-choice-negative  负数        （type: 'negative'）
 *   g6-m12-g6-choice-percent   百分数      （type: 'percent'）
 *   g6-m12-g6-choice-circle    圆          （type: 'circle'）
 *   g6-m12-g6-choice-cyl-cone  圆柱与圆锥  （type: 'cyl-cone'）
 *   g6-m12-g6-choice-chart     扇形统计图  （type: 'chart'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-choice.js 依赖 shared/common.js（PluginUtil），请先加载');

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
  function trimD(x) { return String(Number(x.toFixed(3))); }

  // 生成 n 个两两不同选项（answer 必在其中）
  function mkOptions(answer, cands, n, genKind) {
    n = n || 4;
    var ans = String(answer);
    var pool = [ans];
    cands.forEach(function (c) {
      var s = String(c);
      if (s && s !== ans && pool.indexOf(s) === -1) pool.push(s);
    });
    var guard = 0;
    while (pool.length < n && guard < 80) {
      var e;
      if (genKind === 'text') {
        e = '其他';
      } else {
        e = String(rnd(2, 99));
      }
      if (e !== ans && pool.indexOf(e) === -1) pool.push(e);
      guard++;
    }
    var rest = shuffle(pool.slice(1));
    var out = [ans];
    for (var i = 0; i < n - 1; i++) out.push(rest[i % rest.length]);
    return shuffle(out);
  }

  // ============ 负数 ============
  function buildNegative() {
    var v = pick(['which', 'temp', 'order']);
    if (v === 'which') {
      var ans = '-3';
      var cands = [ans, '0', '3', '+1'];
      return { q: '下面各数中，是负数的是（  ）', answer: ans, options: mkOptions(ans, cands, 4, 'text'), hint: '小于 0 的数是负数。' };
    }
    if (v === 'temp') {
      var up = rnd(2, 9), down = rnd(2, 9);
      var ans2 = String(up + down) + '℃';
      var cands2 = [ans2, String(up - down) + '℃', String(down - up) + '℃', String(up) + '℃'];
      return { q: '温度从 ' + up + '℃ 降到 −' + down + '℃，下降了（  ）', answer: ans2, options: mkOptions(ans2, cands2, 4, 'text'), hint: '温差 = 最高温度 − 最低温度，减去负数等于加上它的相反数。' };
    }
    var a = rnd(2, 9), b = rnd(2, 9);
    var pair = pick([[a + '、' + b, a + ' > ' + b], [a + '、−' + b, a + ' > −' + b], ['−' + a + '、−' + b, a < b ? ('−' + a + ' > −' + b) : ('−' + b + ' > −' + a)]]);
    return { q: '比较大小：' + pair[0] + '，正确的是（  ）', answer: pair[1], options: mkOptions(pair[1], [pair[1].replace('>', '<'), pair[1].replace('>', '=')], 4, 'text'), hint: '正数大于负数，负数越小数值越大。' };
  }

  // ============ 百分数 ============
  function buildPercent() {
    var v = pick(['frac', 'dec', 'pct', 'discount']);
    if (v === 'frac') {
      var ans = '75%';
      var cands = [ans, '7.5%', '0.75%', '750%'];
      return { q: '3/4 改写成百分数是（  ）', answer: ans, options: mkOptions(ans, cands, 4, 'text'), hint: '分数化百分数：先用分子除以分母得到小数，再把小数点向右移两位并添上百分号。' };
    }
    if (v === 'dec') {
      var ans2 = '0.1';
      var cands2 = [ans2, '10', '1', '0.01'];
      return { q: '10% 改写成小数是（  ）', answer: ans2, options: mkOptions(ans2, cands2, 4, 'text'), hint: '百分数化小数，去掉百分号小数点左移两位。' };
    }
    if (v === 'pct') {
      var n = pick([1, 2, 4, 5]);
      var pct = n * 5;
      var ans3 = pct + '%';
      var cands3 = [ans3, String(n) + '%', (pct / 10) + '%', (pct * 10) + '%'];
      return { q: '0.' + (pct < 10 ? '0' + pct : pct) + ' 改写成百分数是（  ）', answer: ans3, options: mkOptions(ans3, cands3, 4, 'text'), hint: '小数化百分数，小数点右移两位加百分号。' };
    }
    var price = rnd(4, 9) * 20;
    var off = pick([80, 85, 90, 95]);
    var ans4 = trimD(price * off / 100);
    var cands4 = [ans4, String(price), trimD(price * (100 - off) / 100), trimD(price * off / 10)];
    return { q: '一件商品原价 ' + price + ' 元，打' + off + '折后的现价是（  ）元', answer: ans4, options: mkOptions(ans4, cands4, 4, 'num'), hint: '现价 = 原价 × 折扣 = ' + price + ' × ' + off + '%。' };
  }

  // ============ 圆 ============
  function buildCircle() {
    var v = pick(['circum', 'area', 'formula']);
    var r = rnd(3, 8), d = 2 * r;
    if (v === 'circum') {
      var ans = trimD(3.14 * d);
      var cands = [ans, trimD(3.14 * r), trimD(3.14 * d * 2), trimD(3.14 * r * r)];
      return { q: '半径 ' + r + ' 的圆，周长是（  ）（π 取 3.14）', answer: ans, options: mkOptions(ans, cands, 4, 'num'), hint: '周长 = π × 直径 = 3.14 × ' + d + '。' };
    }
    if (v === 'area') {
      var ans2 = trimD(3.14 * r * r);
      var cands2 = [ans2, trimD(3.14 * d), trimD(3.14 * r), trimD(3.14 * d * d)];
      return { q: '半径 ' + r + ' 的圆，面积是（  ）（π 取 3.14）', answer: ans2, options: mkOptions(ans2, cands2, 4, 'num'), hint: '面积 = πr² = 3.14 × ' + r + '²。' };
    }
    var ans3 = 'C = 2πr';
    var cands3 = [ans3, 'C = πr', 'C = 2r', 'C = πr²'];
    return { q: '圆的周长公式是（  ）', answer: ans3, options: mkOptions(ans3, cands3, 4, 'text'), hint: '想一想：圆的周长与直径的比值是圆周率 π，周长还等于 2 个半径对应的关系。' };
  }

  // ============ 圆柱与圆锥 ============
  function buildCylCone() {
    var v = pick(['vol', 'cone', 'surface']);
    if (v === 'vol') {
      var r = rnd(2, 4), h = rnd(3, 6);
      var ans = trimD(3.14 * r * r * h);
      var cands = [ans, trimD(3.14 * r * r), trimD(3.14 * r * r * h / 3), trimD(3.14 * 2 * r * h)];
      return { q: '圆柱底面半径 ' + r + '、高 ' + h + '，体积是（  ）（π 取 3.14）', answer: ans, options: mkOptions(ans, cands, 4, 'num'), hint: '体积 = 底面积 × 高 = 3.14 × ' + r + '² × ' + h + '。' };
    }
    if (v === 'cone') {
      var r2 = rnd(2, 3), h2 = rnd(3, 9);
      var ans2 = trimD(3.14 * r2 * r2 * h2 / 3);
      var cands2 = [ans2, trimD(3.14 * r2 * r2 * h2), trimD(3.14 * r2 * r2), trimD(3.14 * 2 * r2 * h2)];
      return { q: '圆锥底面半径 ' + r2 + '、高 ' + h2 + '，体积是（  ）（π 取 3.14）', answer: ans2, options: mkOptions(ans2, cands2, 4, 'num'), hint: '圆锥体积 = 底面积 × 高 ÷ 3。' };
    }
    var ans3 = '底面周长';
    var cands3 = [ans3, '直径', '半径', '底面积'];
    return { q: '圆柱的侧面沿高展开后，长方形的长等于圆柱的（  ）', answer: ans3, options: mkOptions(ans3, cands3, 4, 'text'), hint: '展开后长 = 底面周长，宽 = 高。' };
  }

  // ============ 扇形统计图 ============
  function buildChart() {
    var v = pick(['chart', 'angle', 'sum']);
    if (v === 'chart') {
      var ans = '扇形统计图';
      var cands = [ans, '条形统计图', '折线统计图', '统计表'];
      return { q: '要表示各部分与整体的关系，应选（  ）', answer: ans, options: mkOptions(ans, cands, 4, 'text'), hint: '想一想：哪种统计图能直观地表示各部分占整体的百分比。' };
    }
    if (v === 'angle') {
      var p = pick([25, 30, 40]);
      var ans2 = trimD(p * 360 / 100) + '°';
      var cands2 = [ans2, trimD(p) + '°', trimD(p * 36) + '°', trimD(p * 3.6 / 10) + '°'];
      return { q: '占 ' + p + '% 的扇形，圆心角是（  ）', answer: ans2, options: mkOptions(ans2, cands2, 4, 'text'), hint: '圆心角 = 百分比 × 360° = ' + p + '% × 360°。' };
    }
    var ans3 = '100%';
    var cands3 = [ans3, '90%', '180%', '360%'];
    return { q: '扇形统计图中，各部分所占百分比的和是（  ）', answer: ans3, options: mkOptions(ans3, cands3, 4, 'text'), hint: '想一想：整个圆表示总数，各部分百分比合起来应该占多少。' };
  }

  // ============ 综合选择 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 18) return buildNegative();
    if (r <= 36) return buildPercent();
    if (r <= 56) return buildCircle();
    if (r <= 76) return buildCylCone();
    return buildChart();
  }

  var TYPE_BUILDERS = {
    'negative': buildNegative,
    'percent': buildPercent,
    'circle': buildCircle,
    'cyl-cone': buildCylCone,
    'chart': buildChart,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'negative': '负数',
    'percent': '百分数',
    'circle': '圆',
    'cyl-cone': '圆柱与圆锥',
    'chart': '扇形统计图',
    mix: '综合选择'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-choice',
    moduleId: 'M12',
    name: '选择题',
    pageSubtitle: '负数、百分数、圆、圆柱圆锥与扇形统计图',
    grades: [6],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'g6-m12-g6-choice-negative',
        'g6-m12-g6-choice-percent',
        'g6-m12-g6-choice-circle',
        'g6-m12-g6-choice-cyl-cone',
        'g6-m12-g6-choice-chart'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',      label: '综合选择' },
          { value: 'negative', label: '负数' },
          { value: 'percent',  label: '百分数' },
          { value: 'circle',   label: '圆' },
          { value: 'cyl-cone', label: '圆柱与圆锥' },
          { value: 'chart',    label: '扇形统计图' }
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
        return { type: 'choice', q: p.q, answer: String(p.answer), options: p.options, hint: p.hint, inputType: 'choice' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学六年级选择练习（' + (TYPE_NAMES[type] || '综合选择') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);