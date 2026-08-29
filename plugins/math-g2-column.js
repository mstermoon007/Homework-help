/**
 * plugins/math-g2-column.js — 二年级竖式计算插件（M2 竖式）
 *
 * 知识点覆盖（shared/knowledge-math.js 二年级 M2 模块）：
 *   math-g2-m2-add-col         两位数加两位数竖式
 *   math-g2-m2-sub-col         两位数减两位数竖式
 *   math-g2-m2-chain-add-col   连加竖式
 *   math-g2-m2-chain-sub-col   连减竖式
 *   math-g2-m2-mixed-col       加减混合竖式
 *   math-g2-m2-mult-col        表内乘法竖式
 *   math-g2-m2-div-col         表内除法竖式
 *   math-g2-m2-remainder-col   有余数除法竖式
 *
 * 提供标准 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g2-column.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }

  // ============ 竖式渲染辅助 ============
  function vnum(s) {
    return '<span style="display:inline-block;min-width:78px;text-align:right;font-family:Menlo,Consolas,monospace;font-size:16px;font-weight:800;color:var(--ink);padding:1px 6px;">' + s + '</span>';
  }
  function vop(s) {
    return '<span style="display:inline-block;width:20px;text-align:right;font-weight:800;color:var(--ink);">' + (s || '&nbsp;') + '</span>';
  }
  var vline = '<div style="border-top:2px solid var(--ink);margin:2px 0 6px;width:118px;"></div>';

  function singleInp(idx) {
    return '<input type="text" data-index="' + idx + '" placeholder="?" autocomplete="off" style="width:96px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:16px;font-weight:700;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;">';
  }
  function remInp(idx) {
    return '<span style="display:inline-flex;align-items:center;gap:3px;">' +
      '<input type="text" data-idx="' + idx + '" data-field="0" placeholder="商" autocomplete="off" style="width:52px;height:30px;border:2px dashed var(--line-strong);border-radius:7px;font-size:15px;font-weight:700;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;">' +
      '<span style="font-size:14px;color:var(--muted);font-weight:700;">…</span>' +
      '<input type="text" data-idx="' + idx + '" data-field="1" placeholder="余" autocomplete="off" style="width:52px;height:30px;border:2px dashed var(--line-strong);border-radius:7px;font-size:15px;font-weight:700;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;">' +
      '</span>';
  }

  function cardHTML(idx, inner) {
    return '<div class="question-card math-card math-card--column" data-index="' + idx + '" style="border:1px solid var(--line);border-radius:14px;padding:14px 0.5cm;position:relative;background:var(--card);box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<div class="q-header">' +
      '<span class="num">' + (idx + 1) + '</span>' +
      '&nbsp;&nbsp;&nbsp;&nbsp;' +
      '<span class="q-text" style="font-size:12px;color:var(--muted);font-weight:700;display:inline;vertical-align:middle;">用竖式计算</span>' +
      '</div>' +
      inner +
      '<div class="feedback"></div>' +
      '</div>';
  }

  // 堆叠竖式（连加 / 连减 / 混合）：operands 与 ops(长度=operands-1) 对应
  function renderStack(idx, operands, ops) {
    var inner = '';
    operands.forEach(function (v, i) {
      var op = i === 0 ? '' : (ops[i - 1] || '+');
      inner += '<div>' + vop(op) + vnum(String(v)) + '</div>';
    });
    inner += '<div style="padding-left:20px;">' + vline + '</div>';
    inner += '<div style="padding-left:20px;">' + singleInp(idx) + '</div>';
    return cardHTML(idx, inner);
  }

  function renderMul(idx, a, b) {
    var inner =
      '<div>' + vop('') + vnum(String(a)) + '</div>' +
      '<div>' + vop('×') + vnum(String(b)) + '</div>' +
      '<div style="padding-left:20px;">' + vline + '</div>' +
      '<div style="padding-left:20px;">' + singleInp(idx) + '</div>';
    return cardHTML(idx, inner);
  }

  function renderDiv(idx, divisor, dividend, hasRem) {
    var qInp = hasRem ? remInp(idx) : singleInp(idx);
    var inner =
      '<table style="border-collapse:collapse;font-family:Menlo,Consolas,monospace;margin:2px 0 0 8px;">' +
      '<tr><td style="width:44px;"></td><td style="width:16px;"></td><td style="text-align:left;">' + qInp + '</td></tr>' +
      '<tr>' +
      '<td style="text-align:right;font-size:16px;font-weight:800;color:var(--ink);padding:2px 0;">' + divisor + '</td>' +
      '<td style="border-top:2px solid var(--ink);border-left:2px solid var(--ink);height:14px;"></td>' +
      '<td style="text-align:right;font-size:16px;font-weight:800;color:var(--ink);padding:2px 4px;">' + dividend + '</td>' +
      '</tr>' +
      '</table>';
    return cardHTML(idx, inner);
  }

  // ============ 题目生成 ============
  function twoDigit() { return rnd(10, 99); }

  function buildAdd() {
    var a = twoDigit(), b = twoDigit();
    return { kind: 'add', operands: [a, b], ops: ['+'], answer: a + b, q: a + '+' + b, hint: '相同数位对齐，从个位加起，满十进一。' };
  }
  function buildSub() {
    var a = twoDigit(), b = twoDigit();
    if (a < b) { var t = a; a = b; b = t; }
    return { kind: 'sub', operands: [a, b], ops: ['-'], answer: a - b, q: a + '-' + b, hint: '相同数位对齐，从个位减起，不够减向十位借一。' };
  }
  function buildChainAdd() {
    var a = twoDigit(), b = twoDigit(), c = twoDigit();
    return { kind: 'chain', operands: [a, b, c], ops: ['+', '+'], answer: a + b + c, q: a + '+' + b + '+' + c, hint: '三个数连加，相同数位对齐，从个位加起。' };
  }
  function buildChainSub() {
    var a = rnd(30, 99), b = rnd(10, a - 1), c = rnd(1, a - b);
    return { kind: 'chain', operands: [a, b, c], ops: ['-', '-'], answer: a - b - c, q: a + '-' + b + '-' + c, hint: '连减：从左往右依次减。' };
  }
  function buildMixed() {
    var a = twoDigit(), b = twoDigit(), c = twoDigit();
    var ops = rnd(0, 1) === 0 ? ['+', '-'] : ['-', '+'];
    var res = ops[0] === '+' ? a + b : a - b;
    if (ops[1] === '+') res = res + c; else res = res - c;
    if (res < 0) { // 保证结果非负，交换运算符重算
      ops = ops[0] === '+' ? ['-', '+'] : ['+', '-'];
      res = ops[0] === '+' ? a + b : a - b;
      res = ops[1] === '+' ? res + c : res - c;
      if (res < 0) return buildAdd();
    }
    return { kind: 'mix', operands: [a, b, c], ops: ops, answer: res, q: a + ops[0] + b + ops[1] + c, hint: '加减混合，相同数位对齐，从左往右计算。' };
  }
  function buildMult() {
    var a = rnd(2, 9), b = rnd(2, 9);
    return { kind: 'mult', a: a, b: b, answer: a * b, q: a + '×' + b, hint: '想乘法口诀：' + a + '×' + b + '=' + (a * b) + '。' };
  }
  function buildDiv() {
    var b = rnd(2, 9);
    var q = rnd(2, 9);
    var a = b * q;
    return { kind: 'div', divisor: b, dividend: a, q: q, r: 0, answer: q, qexpr: a + '÷' + b, hint: '想口诀：' + b + '×' + q + '=' + a + '，所以 ' + a + '÷' + b + '=' + q + '。' };
  }
  function buildRemainder() {
    var b = rnd(2, 9);
    var q = rnd(2, 12);
    var r = rnd(1, b - 1);
    var a = b * q + r;
    return { kind: 'div', divisor: b, dividend: a, q: q, r: r, answer: q + '……' + r, qexpr: a + '÷' + b, hint: '商 ' + q + '，余数 ' + r + '，且余数 ' + r + ' < 除数 ' + b + '。' };
  }

  function buildMixedType() {
    var r = rnd(1, 100);
    if (r <= 18) return buildAdd();
    if (r <= 32) return buildSub();
    if (r <= 46) return buildChainAdd();
    if (r <= 58) return buildChainSub();
    if (r <= 72) return buildMixed();
    if (r <= 82) return buildMult();
    if (r <= 90) return buildDiv();
    return buildRemainder();
  }

  var TYPE_BUILDERS = {
    'add-col': buildAdd, 'sub-col': buildSub, 'chain-add-col': buildChainAdd,
    'chain-sub-col': buildChainSub, 'mixed-col': buildMixed, 'mult-col': buildMult,
    'div-col': buildDiv, 'remainder-col': buildRemainder, 'mix': buildMixedType
  };
  var TYPE_NAMES = {
    'add-col': '两位数加两位数', 'sub-col': '两位数减两位数', 'chain-add-col': '连加',
    'chain-sub-col': '连减', 'mixed-col': '加减混合', 'mult-col': '表内乘法',
    'div-col': '表内除法', 'remainder-col': '有余数除法', 'mix': '混合竖式'
  };

  function qRender(q, idx) {
    if (q.kind === 'mult') return renderMul(idx, q.a, q.b);
    if (q.kind === 'div') return renderDiv(idx, q.divisor, q.dividend, q.r > 0);
    return renderStack(idx, q.operands, q.ops);
  }

  function qCheck(q, userAnswers, idx) {
    if (q.kind === 'div' && q.r > 0) {
      var vq = userAnswers[idx + ':0'], vr = userAnswers[idx + ':1'];
      if (vq == null || vq === '' || vr == null || vr === '') return false;
      return String(vq).trim() === String(q.q) && String(vr).trim() === String(q.r);
    }
    var v = userAnswers[idx];
    if (v == null || v === '') return false;
    return String(v).trim() === String(q.answer);
  }

  var plugin = _PU.createMathPlugin({
    id: 'math-g2-column',
    moduleId: 'M2',
    name: '竖式计算',
    pageSubtitle: '两位数加减、连加连减、混合、表内乘除与有余数除法竖式',
    grades: [2],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },
    knowledgePoints: {
      2: [
        'math-g2-m2-add-col',
        'math-g2-m2-sub-col',
        'math-g2-m2-chain-add-col',
        'math-g2-m2-chain-sub-col',
        'math-g2-m2-mixed-col',
        'math-g2-m2-mult-col',
        'math-g2-m2-div-col',
        'math-g2-m2-remainder-col'
      ]
    },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',          label: '混合竖式' },
          { value: 'add-col',      label: '两位数加两位数' },
          { value: 'sub-col',      label: '两位数减两位数' },
          { value: 'chain-add-col', label: '连加' },
          { value: 'chain-sub-col', label: '连减' },
          { value: 'mixed-col',    label: '加减混合' },
          { value: 'mult-col',     label: '表内乘法' },
          { value: 'div-col',      label: '表内除法' },
          { value: 'remainder-col', label: '有余数除法' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixedType;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 40, 300);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = (p.kind === 'div') ? ('d' + p.dividend + '|' + p.divisor) : (p.q);
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        var q = {
          type: 'vertical',
          kind: p.kind,
          data: p,
          q: (p.kind === 'div') ? p.qexpr : p.q,
          answer: p.answer,
          hint: p.hint,
          render: function (idx) { return qRender(this.data, idx); },
          check: function (userAnswers, idx) { return qCheck(this.data, userAnswers, idx); }
        };
        return q;
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学二年级竖式计算（' + (TYPE_NAMES[type] || '混合竖式') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
