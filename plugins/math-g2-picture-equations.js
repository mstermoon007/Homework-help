/**
 * plugins/math-g2-picture-equations.js — 二年级看图列式插件（M7 看图列式）
 *
 * 知识点覆盖（shared/knowledge-math.js 二年级 M7 模块）：
 *   math-g2-m7-pic-add       看图列加法
 *   math-g2-m7-pic-sub       看图列减法
 *   math-g2-m7-pic-mult      看图列乘法
 *   math-g2-m7-pic-div       看图列等分除
 *   math-g2-m7-pic-div-include 看图列包含除
 *   math-g2-m7-pic-mixed     看图列混合算式
 *
 * 随机数统一使用 PluginUtil；图示全部为动态 SVG（mirror math-picture-equations）。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g2-picture-equations.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  var COLORS = ['#5b8def', '#e8870a', '#27ae60', '#9b59b6', '#e74c3c']; /* allow-color */
  function dotsSVG(n, color) {
    var rows = Math.ceil(n / 5);
    var width = rows > 1 ? 120 : Math.max(40, n * 24);
    var html = '<svg width="' + width + '" height="' + (rows * 26 + 6) + '" viewBox="0 0 ' + width + ' ' + (rows * 26 + 6) + '">';
    for (var i = 0; i < n; i++) {
      var x = 12 + (i % 5) * 24;
      var y = 14 + Math.floor(i / 5) * 26;
      html += '<circle cx="' + x + '" cy="' + y + '" r="10" fill="' + color + '" stroke="#2b3a55" stroke-width="1.5"/>';
    }
    return html + '</svg>';
  }
  function groupsSVG(a, b, color) {
    var parts = [];
    for (var g = 0; g < a; g++) {
      parts.push('<div style="display:inline-flex;flex-direction:column;align-items:center;border:1.5px dashed var(--line-strong);border-radius:10px;padding:4px 6px;margin:2px;">' + dotsSVG(b, color) + '</div>');
    }
    return '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px;margin:6px 0;">' + parts.join('<span style="font-size:20px;font-weight:800;color:var(--ink);">+</span>') + '</div>';
  }

  // ============ 题目生成 ============
  function buildAdd() {
    var hi = 45;
    var a = rnd(10, hi), b = rnd(5, hi);
    var sum = a + b;
    if (sum > 99) return buildAdd();
    var c1 = pick(COLORS), c2 = pick(COLORS);
    if (c1 === c2) c2 = COLORS[(COLORS.indexOf(c1) + 1) % COLORS.length];
    return { kind: 'add', a: a, b: b, sum: sum, c1: c1, c2: c2,
      q: a + ' + ' + b + ' = (  )', answer: String(sum),
      text: '左边有 ' + a + ' 个，右边有 ' + b + ' 个，一共有几个？',
      pic: '<div style="display:flex;align-items:center;justify-content:center;gap:6px;">' +
        '<div style="border:1.5px dashed var(--line-strong);border-radius:10px;padding:6px 8px;">' + dotsSVG(a, c1) + '</div>' +
        '<span style="font-size:20px;font-weight:800;color:var(--ink);">+</span>' +
        '<div style="border:1.5px dashed var(--line-strong);border-radius:10px;padding:6px 8px;">' + dotsSVG(b, c2) + '</div></div>',
      hint: '左边有几个，右边有几个，合起来用加法。' };
  }
  function buildSub() {
    var a = rnd(15, 60), b = rnd(5, a - 1);
    var total = a + b;
    var color = pick(COLORS);
    return { kind: 'sub', a: a, b: b, total: total, color: color,
      q: total + ' - ' + b + ' = (  )', answer: String(a),
      text: '一共有 ' + total + ' 个，圈走 ' + b + ' 个，还剩几个？',
      pic: '<div style="display:flex;align-items:center;justify-content:center;gap:6px;">' +
        '<div style="border:1.5px dashed var(--line-strong);border-radius:10px;padding:6px 8px;">' + dotsSVG(total, color) +
        '<div style="font-size:11px;color:var(--bad);font-weight:800;margin-top:2px;">划去 ' + b + ' 个</div></div></div>',
      hint: '从总数里去掉一部分，用减法。' };
  }
  function buildMult() {
    var a = rnd(2, 9), b = rnd(2, 9);
    var color = pick(COLORS);
    return { kind: 'mult', a: a, b: b, answer: String(a * b),
      q: a + ' × ' + b + ' = (  )', answer2: a * b,
      text: '有 ' + a + ' 堆，每堆 ' + b + ' 个，一共几个？',
      pic: groupsSVG(a, b, color),
      hint: '求几个相同加数的和，用乘法：' + a + ' × ' + b + '。' };
  }
  function buildDivPart() {
    var groups = rnd(2, 9), each = rnd(2, 9);
    var total = groups * each;
    var color = pick(COLORS);
    return { kind: 'div', a: groups, b: each, total: total, answer: String(each),
      q: total + ' ÷ ' + groups + ' = (  )', answer2: each,
      text: '把 ' + total + ' 个平均分成 ' + groups + ' 组，每组几个？',
      pic: groupsSVG(groups, each, color),
      hint: '把总数平均分成几份，求每份是多少，用除法。' };
  }
  function buildDivInclude() {
    var each = rnd(2, 9), groups = rnd(2, 9);
    var total = each * groups;
    var color = pick(COLORS);
    return { kind: 'div', a: groups, b: each, total: total, answer: String(groups),
      q: total + ' ÷ ' + each + ' = (  )', answer2: groups,
      text: '有 ' + total + ' 个，每 ' + each + ' 个放一盘，可以放几盘？',
      pic: groupsSVG(groups, each, color),
      hint: '求总数里包含几个几，用除法（包含除）。' };
  }
  function buildMixed() {
    return pick([buildAdd, buildSub, buildMult, buildDivPart, buildDivInclude])();
  }

  function generateProblems(type, count) {
    var builder = { add: buildAdd, sub: buildSub, mult: buildMult, 'div': buildDivPart, 'div-include': buildDivInclude, mix: buildMixed }[type] || buildMixed;
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + q.q;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return _PU.shuffle(list);
  }

  function renderCard(p, i) {
    var picHTML = p.pic;
    return '<div class="question-card" data-index="' + i + '">' +
      '<div class="q-header"><span class="num">' + (i + 1) + '</span>' +
      '&nbsp;&nbsp;&nbsp;&nbsp;<span class="q-text">' + p.text + '</span></div>' +
      picHTML +
      '<div style="font-size:20px;font-weight:800;color:var(--ink);margin:6px 0;">' + p.q.replace('(  )', '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off" style="width:52px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:16px;font-weight:800;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;">') + '</div>' +
      '<div class="feedback"></div></div>';
  }

  function checkQuestion(question, userAnswers, idx) {
    var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return v === String(question.answer);
  }

  var TYPE_NAMES = { mix: '混合练习', add: '看图列加法', sub: '看图列减法', mult: '看图列乘法', 'div': '看图列等分除', 'div-include': '看图列包含除' };

  var KP_BY_KIND = {
    add: 'math-g2-m7-pic-add', sub: 'math-g2-m7-pic-sub', mult: 'math-g2-m7-pic-mult',
    div: 'math-g2-m7-pic-div', 'div-include': 'math-g2-m7-pic-div-include', mixed: 'math-g2-m7-pic-mixed'
  };

  function buildQuestions(options) {
    var opts = options || {};
    var type = opts.type || 'mix';
    var count = opts.count || 8;
    var list = generateProblems(type, count);
    return list.map(function (p) {
      var kp = (type === 'mix') ? 'math-g2-m7-pic-mixed' : (KP_BY_KIND[p.kind] || 'math-g2-m7-pic-mixed');
      return {
        type: 'picture-eq',
        kind: p.kind,
        data: p,
        q: p.text,
        answer: String(p.answer),
        knowledgePointId: kp,
        hint: p.hint,
        render: function (idx) { return renderCard(this.data, idx); },
        check: function (userAnswers, idx) { return checkQuestion(this, userAnswers, idx); }
      };
    });
  }

  var plugin = _PU.createMathPlugin({
    id: 'math-g2-picture-equations',
    moduleId: 'M7',
    name: '看图列式',
    pageSubtitle: '看图写加法、减法、乘法与除法算式',
    grades: [2],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'pictureEq' },
    knowledgePoints: {
      2: [
        'math-g2-m7-pic-add',
        'math-g2-m7-pic-sub',
        'math-g2-m7-pic-mult',
        'math-g2-m7-pic-div',
        'math-g2-m7-pic-div-include',
        'math-g2-m7-pic-mixed'
      ]
    },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',          label: '混合' },
          { value: 'add',          label: '加法' },
          { value: 'sub',          label: '减法' },
          { value: 'mult',         label: '乘法' },
          { value: 'div',          label: '等分除' },
          { value: 'div-include',  label: '包含除' }
        ]
      }
    ],

    generateQuestions: function (options) {
      return buildQuestions(options);
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return { type: type, count: (opts && opts.count) || 8, title: '小学二年级看图列式（' + (TYPE_NAMES[type] || '混合练习') + '）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
