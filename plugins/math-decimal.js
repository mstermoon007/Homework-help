/**
 * plugins/math-decimal.js — 小数的初步认识插件（三年级）
 *
 * 知识点覆盖：g3-m4-g3-decimal（小数的初步认识）
 * 题型：
 *   read   —— 小数读法→写法，写小数（text）；出示读法写数字
 *   compare—— 两个小数比大小，选择 > / < / =（choice）
 *   addsub —— 一位小数的简单加减（text）
 *   unit   —— 元角分 / 米分米 换算成小数（choice 或 text）
 *
 * 提供 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 供 practice.html / dev/plugin-check.html / math-comprehensive 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-decimal.js 依赖 shared/common.js（PluginUtil），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  // ============ 难度（1-10，由 generate 设置） ============
  var _DIFF = 3;

  // 生成一个小数（不超过 1 / 一位或两位小数）；maxInt 是整数部分上限
  function genDecimal(maxInt, allowTwoDigits) {
    var intPart = rnd(0, maxInt);
    if (allowTwoDigits && _DIFF >= 6) {
      // 两位小数（明显难度更高）
      var tenths = rnd(1, 9), hund = rnd(0, 9);
      if (hund === 0 && rnd(1, 2) !== 1) hund = rnd(1, 9);
      return { int: intPart, t: tenths, h: hund, val: intPart + tenths / 10 + hund / 100, digits: 2 };
    }
    var t = rnd(0, 9);
    if (intPart === 0 && t === 0) t = 1;
    return { int: intPart, t: t, h: 0, val: intPart + t / 10, digits: 1 };
  }

  // 小数数字 → 中文读法（如 3.5 → 三点五）
  function decToChinese(d) {
    var digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    var intPart = Math.floor(d.val);
    var frac = Math.round((d.val - intPart) * Math.pow(10, d.digits));
    var s = (intPart === 0 ? '零' : (function (n) {
      var str = '';
      var g = n;
      if (n >= 100) { str += digits[Math.floor(n / 100)] + '百'; n %= 100; }
      if (n >= 10) { str += digits[Math.floor(n / 10)] + '十'; n %= 10; }
      str += digits[n];
      return str;
    })(intPart));
    s += '点';
    var fs = String(frac);
    while (fs.length < d.digits) fs = '0' + fs;
    for (var i = 0; i < fs.length; i++) s += digits[Number(fs[i])];
    return s;
  }

  // ============ 题目生成 ============
  // 读法→写法：出示中文读法，写出小数
  function buildRead() {
    var allowTwo = _DIFF >= 6;
    var d = genDecimal(9, allowTwo);
    var chinese = decToChinese(d);
    return {
      kind: 'read',
      question: '读作「' + chinese + '」，写作小数：',
      answer: String(d.val),
      hint: '小数点左边是整数部分，右边是小数部分，读成「几点几」。',
      inputType: 'text'
    };
  }

  // 两个小数比大小
  function buildCompare() {
    var allowTwo = _DIFF >= 6;
    var a = genDecimal(9, allowTwo);
    var b = genDecimal(9, allowTwo);
    // 规避完全相等
    if (a.val === b.val) b = genDecimal(9, allowTwo);
    var operand;
    if (a.val > b.val) operand = '>';
    else if (a.val < b.val) operand = '<';
    else { return buildCompare(); }
    return {
      kind: 'compare',
      question: '比较大小，在横线上填 >、< 或 =：' + a.val + ' ○ ' + b.val,
      answer: operand,
      options: shuffleArr(['>', '<', '=']),
      hint: '先比较整数部分，整数部分大的小数就大；整数相同再比十分位。',
      inputType: 'choice'
    };
  }

  // 一位小数加减（结果不超过一位小数，便于初识）
  function buildAddsub() {
    var isAdd = rnd(1, 2) === 1;
    var aT = rnd(1, 9), bT = rnd(1, 9);
    var aI = rnd(0, 3), bI = rnd(0, 3);
    if (isAdd) {
      var sumT = aT + bT;
      var carry = Math.floor(sumT / 10);
      var sumI = aI + bI + carry;
      var resT = sumT % 10;
      return {
        kind: 'addsub',
        question: aI + '.' + aT + ' + ' + bI + '.' + bT + ' = ？',
        answer: String(sumI) + '.' + resT,
        hint: '小数点对齐，先加小数部分，再加整数部分。',
        inputType: 'text'
      };
    }
    // 减法：保证 a > b（整数部分>，或相等时分位大）
    if (aI < bI || (aI === bI && aT <= bT)) { var t = aI; aI = bI; bI = t; var t2 = aT; aT = bT; bT = t2; }
    var resT2 = aT - bT;
    if (resT2 < 0) { aI--; resT2 += 10; }
    if (aI < 0) { aI = 0; resT2 = aT - bT; }
    return {
      kind: 'addsub',
      question: aI + '.' + aT + ' - ' + bI + '.' + bT + ' = ？',
      answer: String(aI) + '.' + resT2,
      hint: '小数点对齐，先减小数部分，再减整数部分。',
      inputType: 'text'
    };
  }

  // 元角分 / 米分米 单位换算成小数
  function buildUnit() {
    var variant = rnd(1, 2);
    if (variant === 1) {
      // 元角分 → 元：x元y角 → x.y 元
      var yuan = rnd(0, 9), jiao = rnd(1, 9);
      var chinese = (yuan === 0 ? '' : yuan + '元') + jiao + '角';
      if (yuan === 0 && jiao === 0) jiao = 1;
      var v = '0.' + jiao;
      if (yuan > 0) v = yuan + '.' + jiao;
      if (jiao === 10) v = String(yuan + 1) + '.0';
      return {
        kind: 'unit',
        question: chinese + '用元作单位写作（ ）元。',
        answer: v,
        hint: '1 元有 10 角，几角就是十分之几，写成零点几。',
        inputType: 'text'
      };
    }
    // 米分米 → 米：x米y分米 → x.y 米
    var mi = rnd(0, 9), dm = rnd(1, 9);
    var chineseM = (mi === 0 ? '' : mi + '米') + dm + '分米';
    var valM = '0.' + dm;
    if (mi > 0) valM = mi + '.' + dm;
    if (dm === 10) valM = String(mi + 1) + '.0';
    return {
      kind: 'unit',
      question: chineseM + '用米作单位写作（ ）米。',
      answer: valM,
      hint: '1 米有 10 分米，几分米就是十分之几米，写成零点几米。',
      inputType: 'text'
    };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 30) return buildRead();
    if (r <= 55) return buildCompare();
    if (r <= 78) return buildAddsub();
    return buildUnit();
  }

  function generateProblems(type, count) {
    var builder = { read: buildRead, compare: buildCompare, addsub: buildAddsub, unit: buildUnit, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 40, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + q.answer + '|' + (q.question || '');
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderDecimalCard(p, i) {
    var hintHTML = p.hint ? '<div style="font-size:11px;color:#7a879c;margin-bottom:6px;">💡 ' + p.hint + '</div>' : '';

    var inputHTML = '';
    if (p.inputType === 'choice') {
      var optsHTML = '';
      p.options.forEach(function (o) {
        optsHTML += '<button type="button" data-val="' + o + '" onclick="window.__pickOpt(this)" ' +
          'style="cursor:pointer;border:1.5px solid #d5dff0;background:#fafbff;color:#2b3a55;border-radius:9px;padding:6px 16px;font-size:17px;font-weight:800;margin:3px;transition:.15s;">' + o + '</button>';
      });
      inputHTML = '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;margin-top:6px;">' + optsHTML + '</div>' +
        '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">';
    } else {
      inputHTML = '<div class="input-group" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;">' +
        '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="如 3.5" autocomplete="off" ' +
        'style="width:110px;height:32px;border:2px dashed #ccc;border-radius:7px;font-size:15px;font-weight:700;text-align:center;color:#3f6fd1;background:#fafafa;outline:none;">' +
        '</div>';
    }

    return '<div class="question-card" data-index="' + i + '" style="border:1px solid #e3e9f2;border-radius:14px;padding:14px 12px;position:relative;text-align:center;background:#fff;box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<div class="q-header" style="display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:6px;">' +
        '<span class="num" style="position:static;width:22px;height:22px;border-radius:50%;background:#eef3fb;color:#5b8def;font-weight:800;font-size:12px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;flex-shrink:0;">' + (i + 1) + '</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;' +
        hintHTML +
      '</div>' +
      '<div style="font-size:15px;font-weight:800;color:#27324a;margin:4px 0 6px;">' + p.question + '</div>' +
      inputHTML +
      '<div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:8px;"></div>' +
      '</div>';
  }

  /** 小数答案规范化：去空格/全角点，允许 3.50 == 3.5 */
  function normDec(s) {
    if (!s) return '';
    var t = String(s).replace(/\s+/g, '').replace(/．/g, '.');
    var n = Number(t);
    if (isFinite(n) && t.indexOf('.') !== -1) return n + '';
    return t;
  }

  /** 单题判定（标准 Question.check） */
  function checkDecimalQuestion(question, userAnswers, idx) {
    var p = question.data || question;
    if (p.inputType === 'choice') {
      var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
      return v === p.answer;
    }
    var val = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return normDec(val) === normDec(p.answer);
  }

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-decimal',
    moduleId: 'M4',
    name: '小数的初步认识',
    grades: [3],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'decimal' },
    // 声明本插件覆盖的知识点（用于开发期覆盖校验与提示）
    knowledgePoints: ['g3-m4-g3-decimal'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',     label: '混合' },
          { value: 'read',    label: '读写小数' },
          { value: 'compare', label: '小数比大小' },
          { value: 'addsub',  label: '简单加减' },
          { value: 'unit',    label: '单位换算' }
        ]
      }
    ],

    sortOrder: 2,

    generateQuestions: function (options) {
      var opts = options || {};
      _DIFF = _PU.diffLevel(opts.difficulty);
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', read: '读写小数', compare: '小数比大小', addsub: '简单加减', unit: '单位换算' };
      var label = typeNames[type] || '混合';
      var questions = list.map(function (p) {
        return {
          type: 'decimal',
          kind: p.kind,
          data: p,
          answer: String(p.answer),
          hint: p.hint,
          render: function (idx) { return renderDecimalCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkDecimalQuestion(this, userAnswers, idx); }
        };
      });
      plugin._lastLabel = label;
      return questions;
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      var typeNames = { mix: '混合', read: '读写小数', compare: '小数比大小', addsub: '简单加减', unit: '单位换算' };
      return { type: type, count: (opts && opts.count) || 8, title: '小学三年级小数的初步认识（' + (typeNames[type] || '混合') + '）' };
    },

    // 选项按钮点击（choice 题型），由 render 内联 onclick 调用
    __choose: function (btn) {
      var card = btn;
      while (card && card.className.indexOf('question-card') === -1) card = card.parentElement;
      if (!card) return;
      var inp = card.querySelector('.choice-inp');
      if (inp) inp.value = btn.getAttribute('data-val');
      var btns = card.querySelectorAll('.opt-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].style.background = '#fafbff';
        btns[i].style.borderColor = '#d5dff0';
      }
      btn.style.background = '#5b8def';
      btn.style.borderColor = '#3b5bdb';
      btn.style.color = '#fff';
    }
  });

  // ============ 导出 ============
  global.__currentPlugin = plugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);