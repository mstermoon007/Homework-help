/**
 * plugins/math-money.js — 认识人民币插件（一年级：元角分）
 *
 * 三种题型：
 *   recognize —— 认识面值：元 / 角 / 分的换算关系（1 元 = 10 角，1 角 = 10 分）
 *   convert   —— 单位换算：元↔角↔分 互化
 *   calc      —— 简单计算：同单位（元或角）加减
 *
 * 提供 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 供 practice.html / dev/plugin-check.html / math-comprehensive 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil；标准 Question 对象走 render/check。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-money.js 依赖 shared/common.js（PluginUtil），请先加载');
  // 难度统一经 App.Difficulty.consume 解析（批次7）
  var _D = (typeof App !== 'undefined' && App.Difficulty) ? App.Difficulty
    : (typeof require !== 'undefined' ? require('../shared/difficulty.js') : null);
  if (!_D || !_D.consume) throw new Error('plugins/math-money.js 依赖 shared/difficulty.js（App.Difficulty），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  // ============ 难度（1-10，由 generate 设置） ============
  var _DIFF = 3;
  // 换算题最大值（元/角的数值范围，难度越高数值越大）
  function convertMax() { return _PU.diffMax(9, _DIFF); }

  // ============ 题目生成 ============
  // 认识面值：给定面值，问换算关系（choice）
  function buildRecognize() {
    var items = [
      { label: '「1 元」纸币', q: '1 元等于几角？', answer: '10', options: ['10', '5', '1'] },
      { label: '「1 角」硬币', q: '1 角等于几分？', answer: '10', options: ['10', '5', '1'] },
      { label: '「5 角」硬币', q: '5 角等于几分？', answer: '50', options: ['50', '10', '5'] },
      { label: '「1 元」纸币', q: '几个 1 角合起来是 1 元？', answer: '10', options: ['10', '5', '2'] },
      { label: '「1 角」硬币', q: '几个 1 分合起来是 1 角？', answer: '10', options: ['10', '5', '2'] },
      { label: '「1 元」纸币', q: '1 元等于几个 5 角？', answer: '2', options: ['2', '5', '10'] },
      { label: '「1 元」硬币', q: '1 元可以换几个 2 角？', answer: '5', options: ['5', '2', '10'] },
      { label: '「2 元」纸币', q: '2 元等于几角？', answer: '20', options: ['20', '10', '2'] },
      { label: '「5 元」纸币', q: '5 元等于几角？', answer: '50', options: ['50', '5', '10'] },
      { label: '「10 角」', q: '10 角等于几元？', answer: '1', options: ['1', '10', '5'] }
    ];
    var it = pick(items);
    return {
      kind: 'recognize',
      inputType: 'choice',
      q: '认识面值：' + it.label + '，想一想',
      question: it.q,
      answer: it.answer,
      options: _PU.shuffle(it.options.slice())
    };
  }

  // 单位换算：元↔角↔分 互化（text 单输入）
  function buildConvert() {
    var M = convertMax();
    var builders = [
      // 元 → 角
      function () {
        var yuan = rnd(1, M);
        return { q: yuan + ' 元 = ? 角', answer: String(yuan * 10), unit: '角', tip: '1 元 = 10 角' };
      },
      // 角 → 元
      function () {
        var jiao = rnd(1, M) * 10;
        return { q: jiao + ' 角 = ? 元', answer: String(jiao / 10), unit: '元', tip: '10 角 = 1 元' };
      },
      // 角 → 分
      function () {
        var jiao = rnd(1, M);
        return { q: jiao + ' 角 = ? 分', answer: String(jiao * 10), unit: '分', tip: '1 角 = 10 分' };
      },
      // 分 → 角
      function () {
        var fen = rnd(1, M) * 10;
        return { q: fen + ' 分 = ? 角', answer: String(fen / 10), unit: '角', tip: '10 分 = 1 角' };
      }
    ];
    // 难度高时追加复合换算：元 ↔ 分（需先经过角）
    if (_DIFF >= 6) {
      builders.push(
        // 元 → 分
        function () {
          var yuan = rnd(1, Math.min(M, 5));
          return { q: yuan + ' 元 = ? 分', answer: String(yuan * 100), unit: '分', tip: '1 元 = 10 角 = 100 分' };
        },
        // 分 → 元
        function () {
          var fen = rnd(1, Math.min(M, 5)) * 100;
          return { q: fen + ' 分 = ? 元', answer: String(fen / 100), unit: '元', tip: '100 分 = 10 角 = 1 元' };
        }
      );
    }
    var b = pick(builders)();
    return { kind: 'convert', inputType: 'text', q: b.q, answer: b.answer, unit: b.unit, hint: '想想 ' + b.tip + '。' };
  }

  // 简单计算：同单位加减（text 单输入，答案不带单位，纯数字）
  function buildCalc() {
    var M = convertMax();
    var sumCap = _DIFF <= 4 ? 20 : (_DIFF <= 7 ? 50 : 100);
    var builders = [
      // 元 + 元
      function () {
        var a = rnd(1, M), b = rnd(1, M);
        var r = a + b;
        if (r > sumCap) return null;
        return { q: a + ' 元 + ' + b + ' 元 = ? 元', answer: String(r), unit: '元', sign: '+', a: a, b: b };
      },
      // 角 + 角
      function () {
        var a = rnd(1, M), b = rnd(1, M);
        var r = a + b;
        if (r > sumCap) return null;
        return { q: a + ' 角 + ' + b + ' 角 = ? 角', answer: String(r), unit: '角', sign: '+', a: a, b: b };
      },
      // 元 - 元
      function () {
        var b = rnd(1, Math.max(1, M - 4)), a = rnd(b, b + M);
        return { q: a + ' 元 - ' + b + ' 元 = ? 元', answer: String(a - b), unit: '元', sign: '-', a: a, b: b };
      },
      // 角 - 角
      function () {
        var b = rnd(1, Math.max(1, M - 4)), a = rnd(b, b + M);
        return { q: a + ' 角 - ' + b + ' 角 = ? 角', answer: String(a - b), unit: '角', sign: '-', a: a, b: b };
      },
      // 元 + 角 → 元角复合（高难度：跨单位求和，如 2 元 5 角 + 1 元 3 角 = 3 元 8 角）
      function () {
        if (_DIFF < 6) return null;
        var aY = rnd(1, Math.min(M, 9)), aJ = rnd(1, 9), bY = rnd(1, Math.min(M, 9)), bJ = rnd(1, 9);
        var rY = aY + bY, rJ = aJ + bJ;
        if (rJ >= 10) { rY += 1; rJ -= 10; }
        if (rY > 20) return null;
        return { q: aY + ' 元 ' + aJ + ' 角 + ' + bY + ' 元 ' + bJ + ' 角 = ? 元 ? 角', answer: rY + ' 元 ' + rJ + ' 角', unit: '', sign: '+', a: aY, b: bY };
      }
    ];
    var item = null;
    for (var tries = 0; tries < 30 && !item; tries++) {
      var candidate = pick(builders)();
      if (candidate) item = candidate;
    }
    if (!item) item = builders[0]();
    return { kind: 'calc', inputType: 'text', q: item.q, answer: item.answer, unit: item.unit, hint: item.sign === '+' ? '同单位直接相加，满 10 角就换成 1 元。' : '同单位直接相减。' };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 30) return buildRecognize();
    if (r <= 65) return buildConvert();
    return buildCalc();
  }

  function generateProblems(type, count) {
    var builder = { recognize: buildRecognize, convert: buildConvert, calc: buildCalc, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 30, 400);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + q.q + '|' + q.answer;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return _PU.shuffle(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderCard(p, i) {
    var num = '<span class="num" style="position:static;width:22px;height:22px;border-radius:50%;background:#fdf3e3;color:#b8860b;font-weight:800;font-size:12px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;flex-shrink:0;">' + (i + 1) + '</span>'; /* allow-color */

    var qText = '<span class="q-text" style="font-size:15px;font-weight:800;color:var(--ink);display:inline;vertical-align:middle;margin:4px 0 8px;">' + (p.question || p.q) + '</span>';

    var qHeader = '<div class="q-header">' + num + '&nbsp;&nbsp;&nbsp;&nbsp;' + qText + '</div>';

    var inputHTML = '';
    if (p.inputType === 'choice') {
      var optsHTML = '';
      p.options.forEach(function (o) {
        optsHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
          'style="cursor:pointer;border:1.5px solid #e8d9b8;background:#fffdf6;color:#6b5310;border-radius:9px;padding:6px 16px;font-size:16px;font-weight:800;margin:3px;transition:.15s;">' + o + (p.unit ? ' ' + p.unit : '') + '</button>'; /* allow-color */
      });
      inputHTML = '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optsHTML + '</div>' +
        '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">';
    } else {
      inputHTML = '<div class="input-group" style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;">' +
        '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off" style="width:96px;height:32px;border:2px dashed #e0c98f;border-radius:7px;font-size:15px;font-weight:700;text-align:center;color:#b8860b;background:#fffdf6;outline:none;">' + /* allow-color */
        (p.unit ? '<span class="unit">' + p.unit + '</span>' : '') +
        '</div>';
    }

    var hintHTML = p.hint ? '<div class="q-hint">💡 ' + p.hint + '</div>' : '';

    return '<div class="question-card" data-index="' + i + '" style="border:1px solid #f0e3c0;border-radius:14px;padding:14px 12px;position:relative;text-align:center;background:var(--card);box-shadow:0 8px 24px rgba(120,90,20,.08);">' + /* allow-color */
      qHeader + hintHTML + inputHTML +
      '<div class="feedback"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim().replace(/\s+/g, '') : '';
    return String(v) === String(q.answer).replace(/\s+/g, '');
  }

  // ============ ExercisePlugin ============
  var mathMoneyPlugin = {
    id: 'math-money',
    moduleId: 'M4',
    name: '认识人民币',
    grades: [1],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',       label: '混合' },
          { value: 'recognize', label: '认识面值' },
          { value: 'convert',   label: '单位换算' },
          { value: 'calc',      label: '简单计算' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      // 难度统一经 App.Difficulty.consume 解析（批次7）：profile.effectiveLevel 替代直调 diffLevel
      var prof = _D.consume(opts);
      _DIFF = prof.effectiveLevel;
      var diffStamp = prof.hasOwnLevel ? null : prof.effectiveLevel;
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', recognize: '认识面值', convert: '单位换算', calc: '简单计算' };
      var label = typeNames[type] || '混合';
      var questions = list.map(function (p) {
        var q = {
          type: 'money',
          kind: p.kind,
          data: p,
          q: p.question || p.q || '',
          svg: p.svg || '',
          answer: String(p.answer),
          knowledgePointId: 'math-g1-m4-rmb-unit',
          hint: p.hint,
          render: function (idx, ctx) { return renderCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkQuestion(this, userAnswers, idx); }
        };
        if (diffStamp != null) q.difficulty = diffStamp;
        return q;
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: '小学一年级认识人民币（' + label + '）' }
      };
    },

    render: function (exerciseSet) {
      var html = '';
      exerciseSet.questions.forEach(function (q, i) { html += q.render(i); });
      return html;
    },

    check: function (exerciseSet, userAnswers) {
      var correct = 0;
      var results = [];
      var correctAnswers = [];
      exerciseSet.questions.forEach(function (q, i) {
        var isRight = q.check ? q.check(userAnswers, i) : checkQuestion(q, userAnswers, i);
        if (isRight) correct++;
        results.push(isRight);
        correctAnswers.push(String(q.answer));
      });
      var total = exerciseSet.questions.length;
      var score = total === 0 ? 0 : Math.round((correct / total) * 100);
      var message = '继续加油！';
      if (score === 100) message = '太棒了！全对！';
      else if (score >= 80) message = '很不错！';
      return { score: score, total: total, correct: correct, message: message, results: results, correctAnswers: correctAnswers };
    },

    // 选项按钮点击（choice 题型）：写入隐藏输入 + 高亮
    __choose: function (btn) {
      var card = btn;
      while (card && card.className.indexOf('question-card') === -1) card = card.parentElement;
      if (!card) return;
      var inp = card.querySelector('.choice-inp');
      if (inp) inp.value = btn.getAttribute('data-val');
      var btns = card.querySelectorAll('.opt-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].style.background = '#fffdf6'; /* allow-color */
        btns[i].style.borderColor = '#e8d9b8'; /* allow-color */
      }
      btn.style.background = '#b8860b'; /* allow-color */
      btn.style.borderColor = '#8a6508'; /* allow-color */
      btn.style.color = 'var(--card)'; /* allow-color */
    }
  };

  // ============ 导出 ============
  global.__currentPlugin = mathMoneyPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathMoneyPlugin;

})(typeof window !== 'undefined' ? window : globalThis);
