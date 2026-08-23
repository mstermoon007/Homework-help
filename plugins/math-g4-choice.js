/**
 * plugins/math-g4-choice.js — 四年级选择题插件（M12 选择）
 *
 * 知识点覆盖（shared/knowledge-bank.js 四年级 M12 模块）：
 *   g4-m12-g4-choice-big      大数比较      （type: 'big-compare'）
 *   g4-m12-g4-choice-est      乘除法估算    （type: 'est-muldiv'）
 *   g4-m12-g4-choice-angle    角的认识      （type: 'angle'）
 *   g4-m12-g4-choice-shape    图形特征      （type: 'shape'）
 *   g4-m12-g4-choice-dec      小数意义      （type: 'dec-meaning'）
 *   g4-m12-g4-choice-law      运算律应用    （type: 'law'）
 *
 * 提供标准 ExercisePlugin 接口。随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g4-choice.js 依赖 shared/common.js（PluginUtil），请先加载');

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
  function uniqueNums(cands, hi, lo, n) {
    var pool = [];
    cands.forEach(function (c) {
      if (c >= lo && c < hi && pool.indexOf(c) === -1) pool.push(c);
    });
    var guard = 0;
    while (pool.length < n && guard < 60) {
      var extra = rnd(lo, hi - 1);
      if (pool.indexOf(extra) === -1) pool.push(extra);
      guard++;
    }
    var shuffled = shuffle(pool);
    var out = [];
    for (var i = 0; i < n; i++) out.push(shuffled[i % shuffled.length]);
    return shuffle(out);
  }
  // 从候选字符串生成 n 个两两不同的选项；cands 首项是正确项，保证被选中
  function uniqueStr(cands, n) {
    var answer = String(cands[0]);
    var pool = [answer];
    for (var i = 1; i < cands.length; i++) {
      var c = String(cands[i]);
      if (pool.indexOf(c) === -1) pool.push(c);
    }
    var guard = 0;
    while (pool.length < n && guard < 60) {
      var extra = String(rnd(1, 999));
      if (pool.indexOf(extra) === -1) pool.push(extra);
      guard++;
    }
    var rest = shuffle(pool.slice(1));
    var out = [answer];
    for (var i = 0; i < n - 1; i++) out.push(rest[i % rest.length]);
    return shuffle(out);
  }

  // ============ 大数比较 ============
  function buildBigCompare() {
    var v = pick(['which-big', 'arrange']);
    if (v === 'which-big') {
      var n1 = rnd(100000, 99999999), n2 = rnd(100000, 99999999);
      var bigger = Math.max(n1, n2);
      var opts = shuffle([n1, n2]);
      return { q: '在 ' + n1 + ' 和 ' + n2 + ' 中，较大的数是（  ）', answer: bigger, options: opts,
        hint: '数位多的数大；数位相同从高位比起。' };
    }
    // 比较几个大数选最大
    var a = rnd(1000000, 99999999), b = rnd(1000000, 99999999), c = rnd(1000000, 99999999);
    var mx = Math.max(a, b, c);
    var opts = shuffle([a, b, c]);
    return { q: '在 ' + a + '、' + b + '、' + c + ' 中，最大的数是（  ）', answer: mx, options: opts,
      hint: '先看数位多少，再比较最高位。' };
  }

  // ============ 乘除法估算 ============
  function buildEstMuldiv() {
    var v = pick(['mul', 'div']);
    if (v === 'mul') {
      var a = rnd(21, 98), b = rnd(21, 99);
      var real = a * b;
      // 估算到整十
      var ra = Math.round(a / 10) * 10, rb = Math.round(b / 10) * 10;
      var est = ra * rb;
      var opts = uniqueNums([est, real, est + 1000, est - 1000], 200000, 100, 4);
      return { q: '估算：' + a + ' × ' + b + ' ≈ （  ）', answer: est, options: opts,
        hint: '把两个因数看成整十数：' + ra + ' × ' + rb + '。' };
    }
    var d = rnd(220, 990), dv = rnd(21, 89);
    var real2 = Math.round(d / dv);
    var est2 = Math.round(Math.round(d / 10) * 10 / (Math.round(dv / 10) * 10));
    if (est2 === 0) est2 = real2;
    var opts2 = uniqueNums([est2, real2, est2 + 1, est2 - 1], 200, 1, 4);
    return { q: '估算：' + d + ' ÷ ' + dv + ' ≈ （  ）', answer: est2, options: opts2,
      hint: '把被除数和除数看成整十整百数再相除。' };
  }

  // ============ 角的认识 ============
  function buildAngle() {
    var v = pick(['type', 'clock', 'draw']);
    if (v === 'type') {
      var deg = pick([35, 89, 90, 91, 179, 180]);
      var cls = deg < 90 ? '锐角' : deg === 90 ? '直角' : deg === 180 ? '平角' : '钝角';
      var opts = shuffle(['锐角', '直角', '钝角', '平角']);
      return { q: deg + '° 的角是（  ）', answer: cls, options: opts,
        hint: '小于 90° 锐角，90° 直角，90°~180° 钝角，180° 平角。' };
    }
    if (v === 'clock') {
      var h = pick([2, 3, 4, 5, 6]);
      var ang = h * 30;
      var cls2 = ang < 90 ? '锐角' : ang === 90 ? '直角' : ang === 180 ? '平角' : '钝角';
      var opts2 = shuffle(['锐角', '直角', '钝角', '平角']);
      return { q: h + ' 时整，钟面上时针和分针成（  ）', answer: cls2, options: opts2,
        hint: '一个大格 30°。' };
    }
    var deg2 = pick([30, 45, 60, 90, 120]);
    var tool = deg2 % 15 === 0 ? '三角尺' : '量角器';
    if (deg2 === 120) tool = '量角器';
    var opts3 = shuffle(['量角器', '三角尺', '圆规']);
    return { q: '要精确画出 ' + deg2 + '° 的角，最好用（  ）', answer: tool, options: opts3,
      hint: '画任意度数的角用量角器；三角尺只能画特殊角。' };
  }

  // ============ 图形特征 ============
  function buildShape() {
    var v = pick(['which-shape', 'feature', 'sym']);
    if (v === 'which-shape') {
      var pairs = [
        ['四条边都相等，四个角都是直角', '正方形'],
        ['对边平行且相等，四个角都是直角', '长方形'],
        ['只有一组对边平行', '梯形'],
        ['两组对边分别平行', '平行四边形'],
        ['三条边围成的图形', '三角形']
      ];
      var pr = pick(pairs);
      var opts = shuffle(pairs.map(function (p) { return p[1]; }).slice(0, 4));
      if (opts.indexOf(pr[1]) === -1) opts = shuffle([pr[1]].concat(opts.slice(0, 3)));
      return { q: '（  ）' + pr[0], answer: pr[1], options: opts,
        hint: '根据边和角的特征判断。' };
    }
    if (v === 'feature') {
      var q2 = pick([
        { q: '平行四边形有（  ）组对边平行', a: '两', opts: shuffle(['一', '两', '三', '没有']) },
        { q: '梯形有（  ）组对边平行', a: '一', opts: shuffle(['一', '两', '三', '没有']) },
        { q: '等腰三角形有（  ）条对称轴', a: '一', opts: shuffle(['一', '两', '三', '四']) },
        { q: '等边三角形有（  ）条对称轴', a: '三', opts: shuffle(['一', '两', '三', '四']) }
      ]);
      return { q: q2.q, answer: q2.a, options: q2.opts, hint: '记住各图形的特征。' };
    }
    var symShapes = [
      ['长方形', '是', 2],
      ['正方形', '是', 4],
      ['平行四边形', '否', 0],
      ['等腰梯形', '是', 1],
      ['等边三角形', '是', 3]
    ];
    var pr2 = pick(symShapes);
    var opts2 = shuffle(['是轴对称图形', '不是轴对称图形']);
    return { q: '下面关于「' + pr2[0] + '」的说法正确的是（  ）', answer: pr2[1] === '是' ? '是轴对称图形' : '不是轴对称图形',
      options: opts2, hint: pr2[0] + (pr2[1] === '是' ? '有 ' + pr2[2] + ' 条对称轴。' : '没有对称轴。') };
  }

  // ============ 小数意义 ============
  function buildDecMeaning() {
    var v = pick(['count', 'compose', 'compare', 'frac']);
    if (v === 'count') {
      var t = rnd(1, 9);
      var cands = [(t / 10).toFixed(1), String(t), String(t) + '0', String(t * 10), (t / 100).toFixed(2), (t + '0.1')];
      var opts = uniqueStr(cands, 4);
      return { q: t + ' 个 0.1 是（  ）', answer: (t / 10).toFixed(1), options: opts,
        hint: '0.1 是十分之一，' + t + ' 个十分之一是 ' + (t / 10).toFixed(1) + '。' };
    }
    if (v === 'compose') {
      var w = rnd(1, 9), t2 = rnd(1, 9), h = rnd(1, 9);
      var num = (w + t2 / 10 + h / 100).toFixed(2);
      var cands2 = [num, (w + h / 10 + t2 / 100).toFixed(2), String(w * 100 + t2 * 10 + h), (w * 10 + t2 + h / 10).toFixed(1)];
      var opts2 = uniqueStr(cands2, 4);
      return { q: '由 ' + w + ' 个一、' + t2 + ' 个 0.1 和 ' + h + ' 个 0.01 组成的数是（  ）',
        answer: num, options: opts2, hint: '整数部分 + 十分位 + 百分位。' };
    }
    if (v === 'compare') {
      var a = rnd(10, 99) / 10, b = rnd(10, 99) / 10;
      while (a === b) b = rnd(10, 99) / 10;
      var bigger = Math.max(a, b);
      var opts = shuffle([a.toFixed(1), b.toFixed(1)]);
      return { q: '在 ' + a.toFixed(1) + ' 和 ' + b.toFixed(1) + ' 中，较大的数是（  ）',
        answer: bigger.toFixed(1), options: opts, hint: '先比整数部分，再比十分位。' };
    }
    var den = pick([10, 100]);
    var v3 = rnd(1, 9);
    var dec = (v3 / den).toFixed(den === 10 ? 1 : 2);
    var candsF = [dec, (v3 / (den * 10)).toFixed(2), (v3 * 10 / den).toFixed(1), (den / v3).toFixed(1)];
    var opts = uniqueStr(candsF, 4);
    return { q: v3 + '/' + den + ' 用小数表示是（  ）', answer: dec, options: opts,
      hint: '十分之几 = 零点几，百分之几 = 零点零几。' };
  }

  // ============ 运算律应用 ============
  function buildLaw() {
    var v = pick(['which', 'equal']);
    if (v === 'which') {
      var q = pick([
        { q: '25×4×8 = 25×(4×8) 运用了（  ）', a: '乘法结合律', opts: shuffle(['乘法结合律', '乘法交换律', '乘法分配律', '加法结合律']) },
        { q: '99×36 = 36×100−36 运用了（  ）', a: '乘法分配律', opts: shuffle(['乘法分配律', '乘法结合律', '乘法交换律', '加法交换律']) },
        { q: 'a+b = b+a 运用了（  ）', a: '加法交换律', opts: shuffle(['加法交换律', '加法结合律', '乘法交换律', '乘法结合律']) },
        { q: '125×8×4 = 125×4×8 运用了（  ）', a: '乘法交换律', opts: shuffle(['乘法交换律', '乘法结合律', '乘法分配律', '加法结合律']) }
      ]);
      return { q: q.q, answer: q.a, options: q.opts, hint: '看清是交换位置还是改变结合顺序。' };
    }
    var q2 = pick([
      { q: '25×4×8 与下面哪个算式相等', a: '25×(4×8)', opts: shuffle(['25×(4×8)', '25+4+8', '25×4+25×8', '4×8×8']) },
      { q: '(125+75)×8 与下面哪个算式相等', a: '125×8+75×8', opts: shuffle(['125×8+75×8', '125×8×75×8', '125+75×8', '125×8−75×8']) },
      { q: '25×44 与下面哪个算式相等', a: '25×40+25×4', opts: shuffle(['25×40+25×4', '25×40×4', '25×4×4×4', '20×44+5']) }
    ]);
    return { q: q2.q + '（  ）', answer: q2.a, options: q2.opts,
      hint: '用运算律展开或拆分因数比较。' };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 20) return buildBigCompare();
    if (r <= 40) return buildEstMuldiv();
    if (r <= 58) return buildAngle();
    if (r <= 76) return buildShape();
    if (r <= 88) return buildDecMeaning();
    return buildLaw();
  }

  var TYPE_BUILDERS = {
    'big-compare': buildBigCompare,
    'est-muldiv': buildEstMuldiv,
    'angle': buildAngle,
    'shape': buildShape,
    'dec-meaning': buildDecMeaning,
    'law': buildLaw,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'big-compare': '大数比较',
    'est-muldiv': '乘除法估算',
    'angle': '角的认识',
    'shape': '图形特征',
    'dec-meaning': '小数意义',
    'law': '运算律应用',
    mix: '综合选择'
  };

  var plugin = _PU.createPlugin({
    id: 'math-g4-choice',
    moduleId: 'M12',
    name: '选择题',
    pageSubtitle: '大数比较、估算、角、图形、小数与运算律',
    grades: [4],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'g4-m12-g4-choice-big',
        'g4-m12-g4-choice-est',
        'g4-m12-g4-choice-angle',
        'g4-m12-g4-choice-shape',
        'g4-m12-g4-choice-dec',
        'g4-m12-g4-choice-law'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',         label: '综合选择' },
          { value: 'big-compare', label: '大数比较' },
          { value: 'est-muldiv',  label: '乘除法估算' },
          { value: 'angle',       label: '角的认识' },
          { value: 'shape',       label: '图形特征' },
          { value: 'dec-meaning', label: '小数意义' },
          { value: 'law',         label: '运算律应用' }
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
        return { type: 'choice', q: p.q, answer: String(p.answer), options: p.options,
          inputType: 'choice', hint: p.hint };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学四年级选择练习（' + (TYPE_NAMES[type] || '综合选择') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);