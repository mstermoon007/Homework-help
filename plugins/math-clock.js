/**
 * plugins/math-clock.js — 认识钟表插件（一年级：整时）
 *
 * 提供 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 供 practice.html / dev/plugin-check.html 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil；钟表全部为动态 SVG。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-clock.js 依赖 shared/common.js（PluginUtil），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  // 钟表 SVG 统一由 shared/common.js 的全局 clockSVG(hour, minute) 提供，此处不再重复定义。

  // ============ 题目生成 ============
  // 读钟面：说出钟面表示的整时（1~12 时）
  function buildRead() {
    var hour = rnd(1, 12);
    return {
      kind: 'read',
      hour: hour,
      svg: clockSVG(hour, 0),
      question: '钟面上是几时？',
      answer: String(hour),
      options: (function () {
        var opts = [String(hour), String(((hour % 12) + 1)), String(((hour + 10) % 12) + 1)];
        return _PU.shuffle(opts.slice());
      })()
    };
  }

  // 画整时：给出整时，问时针指向数字几（简化：只考时针）
  function buildPoint() {
    var hour = rnd(1, 12);
    var choices = [hour, ((hour % 12) + 1), ((hour + 10) % 12) + 1];
    return {
      kind: 'point',
      hour: hour,
      question: hour + '时，时针应该指向数字几？',
      answer: String(hour),
      options: _PU.shuffle(choices.slice())
    };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 60) return buildRead();
    return buildPoint();
  }

  function generateProblems(type, count) {
    var builder = { read: buildRead, point: buildPoint, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + q.hour + '|' + q.question;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return _PU.shuffle(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderCard(p, i) {
    var optsHTML = '';
    p.options.forEach(function (o) {
      optsHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
        'style="cursor:pointer;border:1.5px solid #d5dff0;background:#fafbff;color:#2b3a55;border-radius:9px;padding:6px 14px;font-size:16px;font-weight:800;margin:3px;transition:.15s;">' + o + '时</button>';
    });

    var svgHTML = p.svg ? '<div style="display:flex;justify-content:center;margin:4px auto;">' + p.svg + '</div>' : '';

    return '<div class="question-card" data-index="' + i + '" style="border:1px solid #e3e9f2;border-radius:14px;padding:14px 12px;position:relative;text-align:center;background:#fff;box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<span class="num" style="position:absolute;left:8px;top:8px;width:20px;height:20px;border-radius:50%;background:#eef3fb;color:#5b8def;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</span>' +
      svgHTML +
      '<div style="font-size:15px;font-weight:800;color:#27324a;margin:4px 0 8px;">' + p.question + '</div>' +
      '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optsHTML + '</div>' +
      '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">' +
      '<div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:8px;"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return String(v) === String(q.answer);
  }

  // ============ ExercisePlugin ============
  var mathClockPlugin = {
    id: 'math-clock',
    name: '认识钟表',
    grades: [1],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'clock' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',   label: '混合' },
          { value: 'read',  label: '读钟面' },
          { value: 'point', label: '时针指向' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', read: '读钟面', point: '时针指向' };
      var label = typeNames[type] || '混合';
      var questions = list.map(function (p) {
        return {
          type: 'clock',
          kind: p.kind,
          data: p,
          answer: String(p.answer),
          hint: p.kind === 'read' ? '分针指向 12，时针指向几就是几时。' : '分针指向 12 时，时针指向几就是几时。',
          render: function (idx, ctx) { return renderCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkQuestion(this, userAnswers, idx); }
        };
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: '小学一年级认识钟表（' + label + '）' }
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

    // 选项按钮点击（choice 题型）
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
  };

  // ============ 导出 ============
  global.__currentPlugin = mathClockPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathClockPlugin;

})(typeof window !== 'undefined' ? window : globalThis);
