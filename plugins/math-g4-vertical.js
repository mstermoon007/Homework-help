/**
 * plugins/math-g4-vertical.js — 四年级竖式计算插件
 *
 * 知识点覆盖（shared/knowledge-bank.js 四年级 M2 模块）：
 *   g4-m2-g4-v-mul3x2  三位数乘两位数        （type: 'mul3x2'）
 *   g4-m2-g4-v-mulzero 因数中间或末尾有 0    （type: 'mul-zero'）
 *   g4-m2-g4-v-div2    除数是两位数的除法    （type: 'div-2digit'）
 *   g4-m2-g4-v-div2q   商是两位数的除法      （type: 'div-2quotient'）
 *   g4-m2-g4-v-dec     小数加减法竖式        （type: 'dec-vertical'）
 *
 * 提供标准 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 供 practice.html / dev/plugin-check.html 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g4-vertical.js 依赖 shared/common.js（PluginUtil），请先加载');
  // 竖式题受位数/整除等结构性约束，数值范围不随难度缩放；
  // 仍统一消费 profile 以标注 q.difficulty（用于难度标注）。
  var _D = (typeof App !== 'undefined' && App.Difficulty) ? App.Difficulty
    : (typeof require !== 'undefined' ? require('../shared/difficulty.js') : null);
  if (!_D || !_D.paramsFor) throw new Error('plugins/math-g4-vertical.js 依赖 shared/difficulty.js（App.Difficulty），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }

  // ============ 竖式渲染辅助 ============
  // 数字串：右对齐、等宽字体，保证数位/小数点对齐
  function vnum(s) {
    return '<span style="display:inline-block;min-width:78px;text-align:right;font-family:Menlo,Consolas,monospace;font-size:16px;font-weight:800;color:var(--ink);padding:1px 6px;">' + s + '</span>';
  }
  // 运算符号列（保持各行的符号列同宽）
  function vop(s) {
    return '<span style="display:inline-block;width:20px;text-align:right;font-weight:800;color:var(--ink);">' + (s || '&nbsp;') + '</span>';
  }
  // 横线
  var vline = '<div style="border-top:2px solid var(--ink);margin:2px 0 6px;width:118px;"></div>';

  // 单空输入（乘法 / 整除除法 / 小数加减）
  function singleInp(idx) {
    return '<input type="text" data-index="' + idx + '" placeholder="?" autocomplete="off" style="width:96px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:16px;font-weight:700;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;">';
  }
  // 商 + 余数 两空输入（有余数除法）
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

  // 乘法竖式：被乘数 / ×乘数 / 横线 / 答案
  function renderMul(idx, a, b) {
    var inner =
      '<div>' + vop('') + vnum(String(a)) + '</div>' +
      '<div>' + vop('×') + vnum(String(b)) + '</div>' +
      '<div style="padding-left:20px;">' + vline + '</div>' +
      '<div style="padding-left:20px;">' + singleInp(idx) + '</div>';
    return cardHTML(idx, inner);
  }

  // 除法竖式：商(含余数)在上，除数 + 半括号 + 被除数在下
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

  // 小数加减竖式：被加数 / +加数 / 横线 / 答案
  function renderDec(idx, aText, bText, op) {
    var inner =
      '<div>' + vop('') + vnum(aText) + '</div>' +
      '<div>' + vop(op) + vnum(bText) + '</div>' +
      '<div style="padding-left:20px;">' + vline + '</div>' +
      '<div style="padding-left:20px;">' + singleInp(idx) + '</div>';
    return cardHTML(idx, inner);
  }

  // ============ 题目生成 ============

  // 三位数乘两位数：a 三位数，b 两位数
  function buildMul3x2() {
    var a = rnd(100, 999);
    var b = rnd(10, 99);
    return { kind: 'mul', a: a, b: b, answer: a * b, hint: '先用两位数的个位乘三位数，再用十位乘，最后相加。' };
  }

  // 因数中间或末尾有 0：保证至少一个因数含 0
  function buildMulZero() {
    var kind = rnd(1, 4);
    var a, b;
    if (kind === 1) {          // 三位数末尾有 0（120 × 34）
      a = rnd(1, 9) * 100 + rnd(1, 9) * 10;
      b = rnd(12, 99);
    } else if (kind === 2) {   // 三位数中间有 0（204 × 35）
      a = rnd(1, 9) * 100 + rnd(1, 9);
      b = rnd(12, 99);
    } else if (kind === 3) {   // 两位数末尾有 0（356 × 40）
      a = rnd(100, 999);
      b = rnd(2, 9) * 10;
    } else {                   // 整百（1200 × 34）
      a = rnd(11, 99) * 100;
      b = rnd(11, 99);
    }
    return { kind: 'mul', a: a, b: b, answer: a * b, hint: '因数末尾有 0 时，可先把 0 前面的数相乘，再在积的末尾添上相应个数的 0。' };
  }

  // 除数是两位数的除法（可能有余数）
  function buildDiv2() {
    var divisor = rnd(12, 99);
    var hasRem = rnd(1, 2) === 1;
    var q = hasRem ? rnd(2, 40) : rnd(11, 45);
    var r = hasRem ? rnd(1, divisor - 1) : 0;
    var dividend = divisor * q + r;
    // 整除（r=0）渲染单输入框，答案只写商；有余数时双框（商……余数）
    return { kind: 'div', divisor: divisor, dividend: dividend, q: q, r: r, answer: r > 0 ? q + '……' + r : String(q), hint: '用两位数试商：把除数看作整十数，先试商再调商。' };
  }

  // 商是两位数的除法（可有余数）
  function buildDiv2Quotient() {
    var divisor = rnd(11, 49);
    var hasRem = rnd(1, 2) === 1;
    var q = rnd(10, 99);
    var r = hasRem ? rnd(1, divisor - 1) : 0;
    var dividend = divisor * q + r;
    // 整除（r=0）渲染单输入框，答案只写商；有余数时双框（商……余数）
    return { kind: 'div', divisor: divisor, dividend: dividend, q: q, r: r, answer: r > 0 ? q + '……' + r : String(q), hint: '被除数的前两位够除，商就是两位数，先除前两位再除个位。' };
  }

  // 小数加减竖式：同位数对齐，1~2 位小数
  function buildDecVertical() {
    var dp = rnd(1, 2) === 1 ? 1 : 2;
    var scale = Math.pow(10, dp);
    var a = rnd(10, 999), b = rnd(10, 999);
    var isAdd = rnd(1, 2) === 1;
    var aText = (a / scale).toFixed(dp), bText = (b / scale).toFixed(dp);
    if (isAdd) {
      return { kind: 'dec', aText: aText, bText: bText, op: '+', answer: ((a + b) / scale).toFixed(dp), hint: '小数点对齐，从低位算起，哪一位相加满十向前一位进一。' };
    }
    if (a < b) { var t = a; a = b; b = t; aText = (a / scale).toFixed(dp); bText = (b / scale).toFixed(dp); }
    return { kind: 'dec', aText: aText, bText: bText, op: '−', answer: ((a - b) / scale).toFixed(dp), hint: '小数点对齐，从低位算起，哪一位不够减就向前一位借一当十。' };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 25) return buildMul3x2();
    if (r <= 45) return buildMulZero();
    if (r <= 70) return buildDiv2();
    if (r <= 88) return buildDiv2Quotient();
    return buildDecVertical();
  }

  var TYPE_BUILDERS = {
    'mul3x2': buildMul3x2,
    'mul-zero': buildMulZero,
    'div-2digit': buildDiv2,
    'div-2quotient': buildDiv2Quotient,
    'dec-vertical': buildDecVertical,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'mul3x2': '三位数乘两位数',
    'mul-zero': '因数中间或末尾有0',
    'div-2digit': '除数是两位数的除法',
    'div-2quotient': '商是两位数的除法',
    'dec-vertical': '小数加减法竖式',
    mix: '混合竖式'
  };

  // ============ 单题渲染 / 判定 ============
  function qRender(q, idx) {
    if (q.kind === 'mul') return renderMul(idx, q.a, q.b);
    if (q.kind === 'div') return renderDiv(idx, q.divisor, q.dividend, q.r > 0);
    return renderDec(idx, q.aText, q.bText, q.op);
  }

  function qCheck(q, userAnswers, idx) {
    var ua = userAnswers || {};
    if (q.kind === 'div' && q.r > 0) {
      var vq = ua[idx + ':0'], vr = ua[idx + ':1'];
      if (vq == null || vq === '' || vr == null || vr === '') return false;
      return String(vq).trim() === String(q.q) && String(vr).trim() === String(q.r);
    }
    var v = ua[idx];
    if (v == null || v === '') return false;
    if (q.kind === 'dec') {
      var u = parseFloat(v);
      if (isNaN(u)) return false;
      return Math.abs(u - parseFloat(q.answer)) < 1e-6;
    }
    return String(v).trim() === String(q.answer);
  }

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g4-vertical',
    moduleId: 'M2',
    name: '竖式计算',
    pageSubtitle: '三位数乘两位数、除法竖式与小数加减',
    grades: [4],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },
    // 声明本插件覆盖的知识点（用于开发期覆盖校验与提示）
    knowledgePoints: [
        'math-g4-m2-g4-v-mul3x2',
        'math-g4-m2-g4-v-mulzero',
        'math-g4-m2-g4-v-div2',
        'math-g4-m2-g4-v-div2q',
        'math-g4-m2-g4-v-dec'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',         label: '混合竖式' },
          { value: 'mul3x2',      label: '三位数乘两位数' },
          { value: 'mul-zero',    label: '因数有 0' },
          { value: 'div-2digit',  label: '除数是两位数' },
          { value: 'div-2quotient', label: '商是两位数' },
          { value: 'dec-vertical', label: '小数加减竖式' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var dp = opts.difficultyParams || (_D && _D.paramsFor ? _D.paramsFor('math', (opts.difficulty != null ? opts.difficulty : (opts.level || 3))) : { level: opts.difficulty != null ? opts.difficulty : (opts.level || 3) });
      var dpLevel = dp.level, dpScale = dp.scale, dpSteps = dp.steps, dpAllowBracket = dp.allowBracket, dpAllowMultDiv = dp.allowMultDiv, dpHasOwnLevel = (opts.level != null && opts.level !== '');
      var diffStamp = dpHasOwnLevel ? null : dpLevel;
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 40, 300);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = (p.kind + '|' + (p.a != null ? p.a + 'x' + p.b : p.divisor + 'd' + p.dividend) + (p.kind === 'dec' ? '|' + p.aText + p.op + p.bText : ''));
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        var q = {
          type: 'vertical',
          kind: p.kind,
          data: p,
          answer: p.answer,
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
        title: '小学四年级竖式计算（' + (TYPE_NAMES[type] || '混合竖式') + '）'
      };
    }
  });

  // ============ 导出 ============
  global.__currentPlugin = plugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);