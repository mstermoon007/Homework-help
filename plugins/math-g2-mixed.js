/**
 * plugins/math-g2-mixed.js — 二年级脱式/混合运算插件（M3 混合）
 *
 * 知识点覆盖（shared/knowledge-math.js 二年级 M3 模块）：
 *   math-g2-m3-mixed-no-bracket   无括号混合运算
 *   math-g2-m3-mixed-bracket      带括号混合运算
 *   math-g2-m3-chain-addsub       连加连减脱式
 *   math-g2-m3-multdiv-mixed      乘除混合脱式
 *   math-g2-m3-compare-simple     比较算式大小
 *   math-g2-m3-fill-operator      填运算符号
 *
 * 提供标准 ExercisePlugin 接口。随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g2-mixed.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  function inp(idx) {
    return '<input type="text" class="answer-inp" data-index="' + idx + '" placeholder="?" autocomplete="off" style="width:52px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:18px;font-weight:800;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;">';
  }
  function cardHTML(idx, label, body) {
    return '<div class="question-card math-card" data-index="' + idx + '" style="border:1px solid var(--line);border-radius:14px;padding:14px 0.4cm;position:relative;background:var(--card);box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<div class="q-header"><span class="num">' + (idx + 1) + '</span>' +
      '&nbsp;&nbsp;&nbsp;&nbsp;<span class="q-text" style="font-size:12px;color:var(--muted);font-weight:700;">' + label + '</span></div>' +
      '<div style="font-size:20px;font-weight:800;color:var(--ink);margin:8px 0;display:flex;align-items:center;flex-wrap:wrap;gap:6px;">' + body + '</div>' +
      '<div class="feedback"></div></div>';
  }

  // ============ 无括号混合运算 ============
  function buildNoBracket() {
    var v = pick(['muladd', 'mulsub', 'addmul', 'divadd', 'divsub', 'subdiv', 'chainaddsub', 'chainmuldiv']);
    var a, b, c, expr, ans;
    if (v === 'muladd') { a = rnd(2, 9); b = rnd(2, 9); c = rnd(1, 50); expr = a + ' × ' + b + ' + ' + c; ans = a * b + c; }
    else if (v === 'mulsub') { a = rnd(2, 9); b = rnd(2, 9); c = rnd(1, a * b - 1); expr = a + ' × ' + b + ' - ' + c; ans = a * b - c; }
    else if (v === 'addmul') { a = rnd(1, 50); b = rnd(2, 9); c = rnd(2, 9); expr = a + ' + ' + b + ' × ' + c; ans = a + b * c; }
    else if (v === 'divadd') { b = rnd(2, 9); var q1 = rnd(2, 9); a = b * q1; c = rnd(1, 40); expr = a + ' ÷ ' + b + ' + ' + c; ans = q1 + c; }
    else if (v === 'divsub') { b = rnd(2, 9); var q2 = rnd(2, 9); a = b * q2; c = rnd(1, q2 - 1); expr = a + ' ÷ ' + b + ' - ' + c; ans = q2 - c; }
    else if (v === 'subdiv') { b = rnd(2, 9); var q3 = rnd(2, 9); a = b * q3; c = rnd(1, 50); expr = c + ' - ' + a + ' ÷ ' + b; ans = c - q3; }
    else if (v === 'chainaddsub') { a = rnd(10, 60); b = rnd(5, 40); c = rnd(5, 30); expr = a + ' + ' + b + ' - ' + c; ans = a + b - c; }
    else { b = rnd(2, 9); var m = rnd(2, 9); var prod = b * m; c = rnd(2, 9); while (prod % c !== 0) c = rnd(2, 9); expr = b + ' × ' + m + ' ÷ ' + c; ans = prod / c; }
    return { kind: 'no-bracket', expr: expr + ' =', answer: String(ans), label: '无括号混合运算', hint: '先算乘除，后算加减：' + expr + ' = ' + ans + '。' };
  }

  // ============ 带括号混合运算 ============
  function buildBracket() {
    var v = pick(['add', 'sub', 'adddiv', 'subdiv']);
    var a, b, c, expr, ans;
    if (v === 'add') { a = rnd(2, 40); b = rnd(2, 40); c = rnd(2, 9); expr = '(' + a + ' + ' + b + ') × ' + c; ans = (a + b) * c; }
    else if (v === 'sub') { a = rnd(2, 80); b = rnd(1, a - 1); c = rnd(2, 9); expr = '(' + a + ' - ' + b + ') × ' + c; ans = (a - b) * c; }
    else if (v === 'adddiv') {
      c = rnd(2, 9);
      do { a = rnd(2, 40); b = rnd(2, 40); } while ((a + b) % c !== 0);
      expr = '(' + a + ' + ' + b + ') ÷ ' + c; ans = (a + b) / c;
    } else {
      c = rnd(2, 9);
      do { a = rnd(2, 80); b = rnd(1, a - 1); } while ((a - b) % c !== 0);
      expr = '(' + a + ' - ' + b + ') ÷ ' + c; ans = (a - b) / c;
    }
    return { kind: 'bracket', expr: expr + ' =', answer: String(ans), label: '带括号混合运算', hint: '先算括号里面的，再算括号外面的：' + expr + ' = ' + ans + '。' };
  }

  // ============ 连加连减脱式 ============
  function buildChainAddSub() {
    var v = pick(['add3', 'sub3', 'addsub']);
    var a, b, c, expr, ans;
    if (v === 'add3') { a = rnd(10, 60); b = rnd(10, 40); c = rnd(5, 30); expr = a + ' + ' + b + ' + ' + c; ans = a + b + c; }
    else if (v === 'sub3') { a = rnd(40, 99); b = rnd(5, a - 1); c = rnd(1, a - b); expr = a + ' - ' + b + ' - ' + c; ans = a - b - c; }
    else { a = rnd(20, 60); b = rnd(5, 30); c = rnd(5, 20); expr = a + ' + ' + b + ' - ' + c; ans = a + b - c; }
    return { kind: 'chain', expr: expr + ' =', answer: String(ans), label: '连加连减脱式', hint: '从左往右依次计算：' + expr + ' = ' + ans + '。' };
  }

  // ============ 乘除混合脱式 ============
  function buildMultDivMixed() {
    var b = rnd(2, 9), m = rnd(2, 9), prod = b * m, c = rnd(2, 9);
    while (prod % c !== 0) c = rnd(2, 9);
    var expr = b + ' × ' + m + ' ÷ ' + c;
    return { kind: 'multdiv', expr: expr + ' =', answer: String(prod / c), label: '乘除混合脱式', hint: '乘除同级，从左往右算：' + expr + ' = ' + (prod / c) + '。' };
  }

  // ============ 比较算式大小 ============
  function sideExpr() {
    var v = pick(['mul', 'add', 'sub', 'div']);
    if (v === 'mul') { var a = rnd(2, 9), b = rnd(2, 9); return { t: a + ' × ' + b, v: a * b }; }
    if (v === 'add') { var c = rnd(5, 50), d = rnd(5, 50); return { t: c + ' + ' + d, v: c + d }; }
    if (v === 'sub') { var e = rnd(10, 80), f = rnd(1, e - 1); return { t: e + ' - ' + f, v: e - f }; }
    var g = rnd(2, 9), h = rnd(2, 9); return { t: (g * h) + ' ÷ ' + h, v: g };
  }
  function buildCompare() {
    var L = sideExpr(), R = sideExpr();
    var rel = L.v === R.v ? '=' : (L.v > R.v ? '>' : '<');
    return { kind: 'compare', left: L.t, right: R.t, answer: rel, label: '比较算式大小', hint: L.t + ' = ' + L.v + '，' + R.t + ' = ' + R.v + '，所以填「' + rel + '」。' };
  }

  // ============ 填运算符号 ============
  function buildFillOperator() {
    var op = pick(['+', '-', '×', '÷']);
    var a, b, r;
    if (op === '+') { a = rnd(2, 60); b = rnd(2, 60); r = a + b; }
    else if (op === '-') { a = rnd(10, 80); b = rnd(1, a - 1); r = a - b; }
    else if (op === '×') { a = rnd(2, 9); b = rnd(2, 9); r = a * b; }
    else { b = rnd(2, 9); var q = rnd(2, 9); a = b * q; r = q; }
    return { kind: 'operator', left: a, right: b + ' = ' + r, answer: op, label: '填运算符号', hint: a + ' ' + op + ' ' + b + ' = ' + r + '。' };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 25) return buildNoBracket();
    if (r <= 45) return buildBracket();
    if (r <= 65) return buildChainAddSub();
    if (r <= 82) return buildMultDivMixed();
    if (r <= 91) return buildCompare();
    return buildFillOperator();
  }

  var TYPE_BUILDERS = {
    'no-bracket': buildNoBracket, 'bracket': buildBracket, 'chain-addsub': buildChainAddSub,
    'multdiv-mixed': buildMultDivMixed, 'compare-simple': buildCompare, 'fill-operator': buildFillOperator, 'mix': buildMixed
  };
  var TYPE_NAMES = {
    'no-bracket': '无括号混合运算', 'bracket': '带括号混合运算', 'chain-addsub': '连加连减脱式',
    'multdiv-mixed': '乘除混合脱式', 'compare-simple': '比较算式大小', 'fill-operator': '填运算符号', 'mix': '综合脱式'
  };

  function qRender(q, idx) {
    var body;
    if (q.kind === 'compare' || q.kind === 'operator') {
      body = q.left + ' ' + inp(idx) + ' ' + q.right;
    } else {
      body = q.expr + ' ' + inp(idx);
    }
    return cardHTML(idx, q.label, body);
  }

  var plugin = _PU.createMathPlugin({
    id: 'math-g2-mixed',
    moduleId: 'M3',
    name: '脱式计算',
    pageSubtitle: '无括号/带括号混合、连加连减、乘除混合、比较大小与填运算符号',
    grades: [2],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },
    knowledgePoints: {
      2: [
        'math-g2-m3-mixed-no-bracket',
        'math-g2-m3-mixed-bracket',
        'math-g2-m3-chain-addsub',
        'math-g2-m3-multdiv-mixed',
        'math-g2-m3-compare-simple',
        'math-g2-m3-fill-operator'
      ]
    },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',             label: '综合脱式' },
          { value: 'no-bracket',      label: '无括号混合' },
          { value: 'bracket',         label: '带括号混合' },
          { value: 'chain-addsub',    label: '连加连减' },
          { value: 'multdiv-mixed',   label: '乘除混合' },
          { value: 'compare-simple',  label: '比较大小' },
          { value: 'fill-operator',   label: '填运算符号' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 40, 300);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = (p.kind === 'compare' || p.kind === 'operator')
          ? (p.left + '|' + p.right + '|' + p.answer)
          : (p.expr + '|' + p.answer);
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return {
          type: 'mixed',
          q: (p.kind === 'compare' || p.kind === 'operator') ? (p.left + ' ○ ' + p.right) : p.expr,
          answer: p.answer,
          hint: p.hint,
          label: p.label,
          render: function (idx) { return qRender(this, idx); }
        };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学二年级脱式计算（' + (TYPE_NAMES[type] || '综合脱式') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
