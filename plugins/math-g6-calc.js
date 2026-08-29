/**
 * plugins/math-g6-calc.js — 六年级笔算与解方程插件（M2 小数乘除法与解比例笔算、M3 分数混合运算与解方程）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M2/M3 模块）：
 *   g6-m2-g6-calc-dec-mult            小数乘法笔算          （type: 'dec-mult'）
 *   g6-m2-g6-calc-dec-div             小数除法笔算          （type: 'dec-div'）
 *   g6-m2-g6-calc-frac-mult-div       分数乘除笔算          （type: 'frac-mult-div'）
 *   g6-m2-g6-calc-solve-proportion    解比例                （type: 'solve-proportion'）
 *   g6-m3-g6-mixed-frac-order         分数四则混合运算      （type: 'frac-order'）
 *   g6-m3-g6-mixed-frac-simple        分数简便运算          （type: 'frac-simple'）
 *   g6-m3-g6-mixed-solve-equation     解方程（含分数系数）  （type: 'solve-equation'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-calc.js 依赖 shared/common.js（PluginUtil），请先加载');
  var _D = (typeof App !== 'undefined' && App.Difficulty) ? App.Difficulty
    : (typeof require !== 'undefined' ? require('../shared/difficulty.js') : null);
  if (!_D || !_D.paramsFor) throw new Error('plugins/math-g6-calc.js 依赖 shared/difficulty.js（App.Difficulty），请先加载');

  // 难度缩放旋钮：generateQuestions 每轮由 profile.scale 刷新；dmax 用于安全的整数上界放大
  // （仅作用于因数/系数上界；除数位数、商位数字段等结构性约束保持原样）
  var SCALE = 1;
  function dmax(x) { return Math.max(1, Math.round(x * SCALE)); }

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function reduce(n, d) { var g = gcd(Math.abs(n), d); return [n / g, d / g]; }
  function fs(n, d) { return n + '/' + d; }
  function fracAns(n, d) {
    var r = reduce(n, d);
    if (r[1] === 1) return String(r[0]);
    return fs(r[0], r[1]);
  }
  function trimD(x) { return String(Number(x.toFixed(6))); }

  // ============ 竖式渲染辅助（与四五年级一致） ============
  function vnum(s) {
    return '<span style="display:inline-block;min-width:84px;text-align:right;font-family:Menlo,Consolas,monospace;font-size:16px;font-weight:800;color:var(--ink);padding:1px 6px;">' + s + '</span>';
  }
  function vop(s) {
    return '<span style="display:inline-block;width:20px;text-align:right;font-weight:800;color:var(--ink);">' + (s || '&nbsp;') + '</span>';
  }
  var vline = '<div style="border-top:2px solid var(--ink);margin:2px 0 6px;width:122px;"></div>';

  function singleInp(idx) {
    return '<input type="text" data-index="' + idx + '" placeholder="?" autocomplete="off" style="width:104px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:16px;font-weight:700;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;">';
  }

  function cardHTML(idx, inner, tag) {
    return '<div class="question-card math-card math-card--column" data-index="' + idx + '" style="border:1px solid var(--line);border-radius:14px;padding:14px 0.5cm;position:relative;background:var(--card);box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<div class="q-header">' +
      '<span class="num">' + (idx + 1) + '</span>' +
      '&nbsp;&nbsp;&nbsp;&nbsp;' +
      '<span class="q-text" style="font-size:12px;color:var(--muted);font-weight:700;display:inline;vertical-align:middle;">' + (tag || '计算下面各题') + '</span>' +
      '</div>' +
      inner +
      '<div class="feedback"></div>' +
      '</div>';
  }

  // 乘法竖式
  function renderMul(idx, a, b) {
    var inner =
      '<div>' + vop('') + vnum(String(a)) + '</div>' +
      '<div>' + vop('×') + vnum(String(b)) + '</div>' +
      '<div style="padding-left:20px;">' + vline + '</div>' +
      '<div style="padding-left:20px;">' + singleInp(idx) + '</div>';
    return cardHTML(idx, inner);
  }

  // 除法竖式（商为单空输入）
  function renderDiv(idx, divisor, dividend) {
    var inner =
      '<table style="border-collapse:collapse;font-family:Menlo,Consolas,monospace;margin:2px 0 0 8px;">' +
      '<tr><td style="width:52px;"></td><td style="width:16px;"></td><td style="text-align:left;">' + singleInp(idx) + '</td></tr>' +
      '<tr>' +
      '<td style="text-align:right;font-size:16px;font-weight:800;color:var(--ink);padding:2px 0;">' + divisor + '</td>' +
      '<td style="border-top:2px solid var(--ink);border-left:2px solid var(--ink);height:14px;"></td>' +
      '<td style="text-align:right;font-size:16px;font-weight:800;color:var(--ink);padding:2px 4px;">' + dividend + '</td>' +
      '</tr>' +
      '</table>';
    return cardHTML(idx, inner);
  }

  // ============ 小数乘法笔算 ============
  function buildDecMult() {
    var v = pick(['dd', 'di', 'dd2']);
    var a, b, ans, aText, bText;
    if (v === 'dd') {
      var a1 = rnd(10, dmax(99)), b1 = rnd(10, dmax(99));
      a = a1 / 10; b = b1 / 10; aText = a.toFixed(1); bText = b.toFixed(1);
      ans = a * b;
    } else if (v === 'di') {
      var a2 = rnd(10, dmax(999)) / 10, b2 = rnd(2, dmax(99));
      a = a2; b = b2; aText = a.toFixed(1); bText = String(b);
      ans = a * b;
    } else {
      var a3 = rnd(11, dmax(99)), b3 = rnd(11, dmax(99));
      a = a3 / 100; b = b3 / 100; aText = a.toFixed(2); bText = b.toFixed(2);
      ans = a * b;
    }
    return { kind: 'mul', a: a, b: b, aText: aText, bText: bText, answer: trimD(ans), hint: '小数乘法：先按整数乘法计算，再看因数一共有几位小数，从积的右边起数出几位点上小数点。' };
  }

  // ============ 小数除法笔算 ============
  function buildDecDiv() {
    var v = pick(['int', 'dec']);
    var divisor, dividend, q;
    if (v === 'int') {
      divisor = rnd(2, 9);
      var qWhole = rnd(2, 9), qDec = rnd(1, 9);
      q = qWhole + qDec / 10;
      dividend = divisor * q;
      return { kind: 'div', divisor: divisor, dividend: trimD(dividend), qText: q.toFixed(1), answer: trimD(q), hint: '除数是整数的小数除法：按照整数除法计算，商的小数点要和被除数的小数点对齐。' };
    }
    var dInt = rnd(2, 9);
    divisor = dInt / 10;
    var qWhole2 = rnd(1, 9), qDec2 = rnd(1, 9);
    q = qWhole2 + qDec2 / 10;
    dividend = divisor * q;
    return { kind: 'div', divisor: divisor.toFixed(1), dividend: trimD(dividend), qText: q.toFixed(1), answer: trimD(q), hint: '除数是小数：先把除数变成整数，除数小数点向右移动几位，被除数也向右移动几位，再按整数除法计算。' };
  }

  // ============ 分数乘除笔算 ============
  function buildFracMultDiv() {
    var v = pick(['mul', 'div', 'intdiv']);
    var d = pick([3, 4, 5, 6, 8]), a = rnd(1, d - 1);
    if (v === 'mul') {
      var d2 = pick([4, 5, 6, 8]), a2 = rnd(1, d2 - 1);
      var r = reduce(a * a2, d * d2);
      return { kind: 'text', q: fs(a, d) + ' × ' + fs(a2, d2) + ' =', answer: r[1] === 1 ? String(r[0]) : fs(r[0], r[1]), hint: '分数乘分数：分子相乘作分子，分母相乘作分母，能约分要约分。' };
    }
    if (v === 'div') {
      var d3 = pick([2, 3, 4, 5]), a3 = rnd(1, d3 - 1);
      var r2 = reduce(a * d3, d * a3);
      return { kind: 'text', q: fs(a, d) + ' ÷ ' + fs(a3, d3) + ' =', answer: r2[1] === 1 ? String(r2[0]) : fs(r2[0], r2[1]), hint: '除以一个分数等于乘它的倒数。' };
    }
    var a4 = rnd(2, 6), k = rnd(2, 4);
    return { kind: 'text', q: (k * a4) + ' ÷ ' + fs(a4, 5) + ' =', answer: String(k * 5), hint: '除以一个分数等于乘这个分数的倒数：' + (k * a4) + ' × ' + fs(5, a4) + '，再算一算。' };
  }

  // ============ 解比例 ============
  function buildSolveProportion() {
    var v = pick(['end', 'mid', 'frac1']);
    if (v === 'end') {
      var a = rnd(2, 9), b = rnd(2, 9), k = rnd(2, 9);
      var x = a * k, c = b * k;
      return { kind: 'text', q: a + ' : ' + b + ' = x : ' + c, answer: String(x), hint: '比例的基本性质：内项积 = 外项积，即 b × x = a × ' + c + '，x = 外项积 ÷ 已知内项。' };
    }
    if (v === 'mid') {
      var a2 = rnd(2, 9), b2 = rnd(2, 9), k2 = rnd(2, 9);
      var c2 = b2 * k2, x2 = a2 * k2;
      return { kind: 'text', q: a2 + ' : ' + b2 + ' = ' + c2 + ' : x', answer: String(x2), hint: '比例的基本性质：内项积 = 外项积，即 ' + b2 + ' × ' + c2 + ' = ' + a2 + ' × x，x = 外项积 ÷ 已知内项。' };
    }
    var a3 = rnd(2, 9), b3 = rnd(2, 9), k3 = rnd(2, 9);
    var c3 = a3 * k3, x3 = b3 * k3;
    return { kind: 'text', q: 'x / ' + a3 + ' = ' + b3 + ' / ' + c3, answer: String(x3), hint: '用交叉相乘：x × ' + c3 + ' = ' + a3 + ' × ' + b3 + '，x = 积 ÷ 已知因数。' };
  }

  // ============ 分数四则混合运算 ============
  function buildFracOrder() {
    var v = pick(['sum1', 'muladd', 'sub', 'div']);
    var d = pick([3, 4, 5, 6, 8, 10, 12]);
    var a = rnd(1, d - 1);
    if (v === 'sum1') {
      var e = rnd(2, 9);
      return { kind: 'text', q: '(' + fs(a, d) + ' + ' + fs(d - a, d) + ') × ' + e, answer: String(e), hint: '先算括号内：同分母分数相加，分子相加得分母，结果是 1；再用 1 乘括号外的整数。' };
    }
    if (v === 'muladd') {
      var b = rnd(2, dmax(12));
      return { kind: 'text', q: '(' + fs(a, d) + ' × ' + d + ') + ' + b, answer: String(a + b), hint: '先算括号里的分数乘整数（能约分的先约分），再加外面的整数。' };
    }
    if (v === 'sub') {
      var b2 = rnd(2, dmax(12)), c2 = a + b2;
      return { kind: 'text', q: c2 + ' − (' + fs(a, d) + ' × ' + d + ')', answer: String(b2), hint: '先算括号里的分数乘整数（能约分的先约分），再用外面的数减去它。' };
    }
    var a3 = rnd(2, 8), b3 = rnd(2, 5);
    var divs = [];
    for (var i = 2; i <= a3; i++) if (a3 % i === 0) divs.push(i);
    if (!divs.length) return buildFracOrder();
    var c = pick(divs);
    return { kind: 'text', q: fs(a3, b3) + ' ÷ ' + c + ' × ' + b3, answer: String(a3 / c), hint: '乘除混合按从左到右的顺序：先算除以整数（等于乘这个整数的倒数），再乘另一个整数。' };
  }

  // ============ 分数简便运算 ============
  function buildFracSimple() {
    var v = pick(['add', 'pair', 'common']);
    var d = pick([3, 4, 5, 6, 8, 10]);
    var a = rnd(1, d - 1);
    if (v === 'add') {
      var n = rnd(2, 6);
      var ord = pick([0, 1]) === 0 ? fs(a, d) + ' + ' + n + ' + ' + fs(d - a, d) : fs(a, d) + ' + ' + fs(d - a, d) + ' + ' + n;
      return { kind: 'text', q: ord, answer: String(n + 1), hint: '交换律凑整：' + fs(a, d) + ' + ' + fs(d - a, d) + ' = 1，再加 ' + n + '。' };
    }
    if (v === 'pair') {
      var c = rnd(1, d - 1), dd = d - c;
      return { kind: 'text', q: fs(a, d) + ' × (' + c + ' + ' + dd + ')', answer: String(a), hint: '乘法分配律：括号里两个分数相加恰好凑成一个整数，再乘前面的分数，能约分的先约分。' };
    }
    var n2 = rnd(4, 9) * 10 - 1;
    var common = pick([['1/2', 1], ['1/4', 1], ['3/4', 3], ['1/5', 1], ['2/5', 2], ['3/5', 3], ['4/5', 4], ['1/8', 1], ['3/8', 3], ['1/10', 1], ['3/10', 3]]);
    var base = common[0];
    var sum = n2 + 1;
    var ans = sum * common[1] / (base.indexOf('/') > 0 ? parseInt(base.split('/')[1], 10) : 1);
    return { kind: 'text', q: base + ' × ' + n2 + ' + ' + base, answer: trimD(ans), hint: '提取公因数：' + base + ' × (' + n2 + ' + 1) = ' + base + ' × ' + sum + '。' };
  }

  // ============ 解方程（含分数系数） ============
  function buildSolveEquation() {
    var v = pick(['xfrac', 'fracx', 'addfrac']);
    if (v === 'xfrac') {
      var d = pick([3, 4, 5, 6, 8]), a = rnd(1, d - 1);
      var rest = d - a;
      var k = rnd(1, 5) * rest;
      var x = k * d / rest;
      if (x !== Math.floor(x)) return buildSolveEquation();
      return { kind: 'text', q: 'x − ' + fs(a, d) + 'x = ' + k, answer: String(x), hint: '先把左边的同类项合并：1 − ' + fs(a, d) + ' = ' + fs(rest, d) + '，得到 ' + fs(rest, d) + 'x = ' + k + '，再用等式性质除以系数。' };
    }
    if (v === 'fracx') {
      var d2 = pick([3, 4, 5, 6, 8]), a2 = rnd(1, d2 - 1);
      var k2 = rnd(2, 5) * a2;
      var x2 = k2 * d2 / a2;
      return { kind: 'text', q: fs(a2, d2) + 'x = ' + k2, answer: String(x2), hint: '等式两边同时除以 ' + fs(a2, d2) + '（即乘它的倒数），就得到 x。' };
    }
    var d3 = pick([3, 4, 5, 6, 8, 10]), a3 = rnd(1, d3 - 1);
    var k3 = rnd(1, 5) * d3 + a3;
    return { kind: 'text', q: 'x + ' + fs(a3, d3) + ' = ' + k3, answer: fracAns(k3 * d3 - a3, d3), hint: '等式两边同时减去 ' + fs(a3, d3) + '，把 ' + k3 + ' 写成同分母分数再相减。' };
  }

  // ============ 综合计算 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 16) return buildDecMult();
    if (r <= 32) return buildDecDiv();
    if (r <= 46) return buildFracMultDiv();
    if (r <= 58) return buildSolveProportion();
    if (r <= 74) return buildFracOrder();
    if (r <= 87) return buildFracSimple();
    return buildSolveEquation();
  }

  var TYPE_BUILDERS = {
    'dec-mult': buildDecMult,
    'dec-div': buildDecDiv,
    'frac-mult-div': buildFracMultDiv,
    'solve-proportion': buildSolveProportion,
    'frac-order': buildFracOrder,
    'frac-simple': buildFracSimple,
    'solve-equation': buildSolveEquation,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'dec-mult': '小数乘法笔算',
    'dec-div': '小数除法笔算',
    'frac-mult-div': '分数乘除笔算',
    'solve-proportion': '解比例',
    'frac-order': '分数四则混合运算',
    'frac-simple': '分数简便运算',
    'solve-equation': '解方程',
    mix: '综合计算'
  };

  // ============ 单题渲染 / 判定 ============
  function qRender(q, idx) {
    if (q.kind === 'mul') return renderMul(idx, q.aText, q.bText);
    if (q.kind === 'div') return renderDiv(idx, q.divisor, q.dividend);
    return cardHTML(idx, '<div style="font-size:15px;font-weight:800;color:var(--ink);line-height:1.6;">' + q.q + '</div><div style="margin-top:6px;">' + singleInp(idx) + '</div>', '笔算/脱式');
  }

  function qCheck(q, userAnswers, idx) {
    var ua = userAnswers || {};
    var v = ua[idx];
    if (v == null || String(v).trim() === '') return false;
    var s = String(v).trim();
    if (q.kind === 'mul') return s === String(q.answer);
    var u = parseFloat(s);
    if (isNaN(u)) return false;
    return Math.abs(u - parseFloat(String(q.answer).replace('……', ''))) < 1e-6;
  }

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-calc',
    moduleId: 'M2',
    name: '笔算',
    pageSubtitle: '小数乘除、分数乘除、解比例、混合运算、简便运算与解方程',
    grades: [6],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'math-g6-m2-g6-calc-dec-mult',
        'math-g6-m2-g6-calc-dec-div',
        'math-g6-m2-g6-calc-frac-mult-div',
        'math-g6-m2-g6-calc-solve-proportion',
        'math-g6-m3-g6-mixed-frac-order',
        'math-g6-m3-g6-mixed-frac-simple',
        'math-g6-m3-g6-mixed-solve-equation'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',             label: '综合计算' },
          { value: 'dec-mult',        label: '小数乘法笔算' },
          { value: 'dec-div',         label: '小数除法笔算' },
          { value: 'frac-mult-div',   label: '分数乘除笔算' },
          { value: 'solve-proportion', label: '解比例' },
          { value: 'frac-order',      label: '分数四则混合运算' },
          { value: 'frac-simple',     label: '分数简便运算' },
          { value: 'solve-equation',  label: '解方程' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var dp = opts.difficultyParams || (_D && _D.paramsFor ? _D.paramsFor('math', (opts.difficulty != null ? opts.difficulty : (opts.level || 3))) : { level: opts.difficulty != null ? opts.difficulty : (opts.level || 3) });
      var dpLevel = dp.level, dpScale = dp.scale, dpSteps = dp.steps, dpAllowBracket = dp.allowBracket, dpAllowMultDiv = dp.allowMultDiv, dpHasOwnLevel = (opts.level != null && opts.level !== '');
      SCALE = dpHasOwnLevel ? 1 : dpScale;
      var diffStamp = dpHasOwnLevel ? null : dpLevel;
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 60, 400);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = p.kind + '|' + (p.q || p.aText || '') + '|' + p.answer;
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        var qText = p.q ||
          (p.kind === 'mul' ? p.aText + ' × ' + p.bText :
           p.kind === 'div' ? p.divisor + ' ⟮ ' + p.dividend : '');
        var q = {
          type: 'calc',
          kind: p.kind,
          data: p,
          q: qText,
          answer: String(p.answer),
          hint: p.hint,
          render: function (idx) { return qRender(this.data, idx); },
          check: function (userAnswers, idx) { return qCheck(this.data, userAnswers, idx); }
        };
        if (diffStamp != null) q.difficulty = diffStamp;
        return q;
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学六年级笔算与解方程（' + (TYPE_NAMES[type] || '综合计算') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);