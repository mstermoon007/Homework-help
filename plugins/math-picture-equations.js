/**
 * plugins/math-picture-equations.js — 看图列式插件（一年级：看图写加法/减法算式）
 *
 * 提供 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 供 practice.html / dev/plugin-check.html 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil；图示全部为动态 SVG。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-picture-equations.js 依赖 shared/common.js（PluginUtil），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  // ============ 图形 SVG（小动物/水果用彩色圆点示意） ============
  var COLORS = ['#5b8def', '#e8870a', '#27ae60', '#9b59b6', '#e74c3c'];
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

  // ============ 难度（1-10，由 generate 设置） ============
  var _DIFF = 3;
  // 结果上限：难度 3 基准 20，难度越高数值越大
  function sumMax() { return Math.min(50, _PU.diffMax(20, _DIFF)); }

  // ============ 题目生成 ============
  // 加法：左边 a 个 + 右边 b 个 = a+b
  function buildAdd() {
    var a = rnd(2, 9), b = rnd(1, 9);
    var sum = a + b;
    if (sum > sumMax()) return buildAdd();
    var c1 = pick(COLORS), c2 = pick(COLORS);
    if (c1 === c2) c2 = COLORS[(COLORS.indexOf(c1) + 1) % COLORS.length];
    return {
      kind: 'add',
      a: a, b: b, sum: sum, c1: c1, c2: c2,
      question: '看图列算式：',
      expr: a + ' + ' + b + ' = (  )',
      answer: String(sum),
      inputType: 'text'
    };
  }

  // 减法：总数 a+b 个，圈走 b 个，剩 a 个
  function buildSub() {
    var a = rnd(2, 9), b = rnd(1, 9);
    var total = a + b;
    if (total > sumMax()) return buildSub();
    var color = pick(COLORS);
    return {
      kind: 'sub',
      a: a, b: b, total: total, color: color,
      question: '看图列算式：',
      expr: total + ' - ' + b + ' = (  )',
      answer: String(a),
      inputType: 'text'
    };
  }

  function buildMixed() {
    return rnd(0, 1) === 0 ? buildAdd() : buildSub();
  }

  function generateProblems(type, count) {
    var builder = { add: buildAdd, sub: buildSub, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + q.a + '|' + q.b;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return _PU.shuffle(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderCard(p, i) {
    var picHTML;
    if (p.kind === 'add') {
      picHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:6px 0;">' +
        '<div style="display:flex;flex-direction:column;align-items:center;border:1.5px dashed #c3ccd8;border-radius:10px;padding:6px 8px;">' + dotsSVG(p.a, p.c1) + '</div>' +
        '<span style="font-size:20px;font-weight:800;color:#27324a;">+</span>' +
        '<div style="display:flex;flex-direction:column;align-items:center;border:1.5px dashed #c3ccd8;border-radius:10px;padding:6px 8px;">' + dotsSVG(p.b, p.c2) + '</div>' +
        '</div>';
    } else {
      var totalSVG = dotsSVG(p.total, p.color);
      // 圈出后 b 个：在下方用斜线覆盖示意“去掉”
      picHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:6px 0;">' +
        '<div style="display:flex;flex-direction:column;align-items:center;border:1.5px dashed #c3ccd8;border-radius:10px;padding:6px 8px;">' + totalSVG +
        '<div style="font-size:11px;color:#e74c3c;font-weight:800;margin-top:2px;">划去 ' + p.b + ' 个</div></div>' +
        '</div>';
    }

    return '<div class="question-card" data-index="' + i + '" style="border:1px solid #e3e9f2;border-radius:14px;padding:14px 12px;position:relative;text-align:center;background:#fff;box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<span class="num" style="position:absolute;left:8px;top:8px;width:20px;height:20px;border-radius:50%;background:#eef3fb;color:#5b8def;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</span>' +
      '<div style="font-size:15px;font-weight:800;color:#27324a;margin:4px 0 6px;">' + p.question + '</div>' +
      picHTML +
      '<div style="font-size:20px;font-weight:800;color:#27324a;margin:6px 0;">' + p.expr.replace('(  )', '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off" style="width:52px;height:32px;border:2px dashed #ccc;border-radius:7px;font-size:16px;font-weight:800;text-align:center;color:#3f6fd1;background:#fafafa;outline:none;">') + '</div>' +
      '<div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:8px;"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return v === String(q.answer);
  }

  // ============ ExercisePlugin ============
  var mathPictureEquationsPlugin = {
    id: 'math-picture-equations',
    name: '看图列式',
    grades: [1],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'pictureEq' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix', label: '混合' },
          { value: 'add', label: '加法' },
          { value: 'sub', label: '减法' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      _DIFF = _PU.diffLevel(opts.difficulty);
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', add: '看图列加法', sub: '看图列减法' };
      var label = typeNames[type] || '混合';
      var questions = list.map(function (p) {
        return {
          type: 'picture-eq',
          kind: p.kind,
          data: p,
          answer: String(p.answer),
          hint: p.kind === 'add' ? '左边有几个，右边有几个，合起来一共有几个？' : '一共有几个，划去几个，还剩几个？',
          render: function (idx, ctx) { return renderCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkQuestion(this, userAnswers, idx); }
        };
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: '小学一年级看图列式（' + label + '）' }
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
    }
  };

  // ============ 导出 ============
  global.__currentPlugin = mathPictureEquationsPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathPictureEquationsPlugin;

})(typeof window !== 'undefined' ? window : globalThis);
