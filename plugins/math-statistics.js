/**
 * plugins/math-statistics.js — 统计与概率插件（一年级：分类与整理/统计表/象形统计图）
 *
 * 提供 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 供 practice.html / dev/plugin-check.html 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil；图形全部为动态 SVG。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-statistics.js 依赖 shared/common.js（PluginUtil），请先加载');
  // 难度统一经 App.Difficulty.paramsFor 解析（批次7）
  var _D = (typeof App !== 'undefined' && App.Difficulty) ? App.Difficulty
    : (typeof require !== 'undefined' ? require('../shared/difficulty.js') : null);
  if (!_D || !_D.paramsFor) throw new Error('plugins/math-statistics.js 依赖 shared/difficulty.js（App.Difficulty），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  // ============ 图形 SVG（按形状+颜色区分分类依据） ============
  var SHAPES = {
    '三角形': function (c) { return '<svg width="28" height="26" viewBox="0 0 28 26"><polygon points="14,2 2,24 26,24" fill="' + c + '" stroke="#2b3a55" stroke-width="1.5"/></svg>'; },
    '圆形':   function (c) { return '<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="12" fill="' + c + '" stroke="#2b3a55" stroke-width="1.5"/></svg>'; },
    '正方形': function (c) { return '<svg width="26" height="26" viewBox="0 0 26 26"><rect x="2" y="2" width="22" height="22" fill="' + c + '" stroke="#2b3a55" stroke-width="1.5"/></svg>'; }
  };
  var SHAPE_KEYS = Object.keys(SHAPES);
  var COLORS = ['#5b8def', '#e8870a', '#27ae60']; /* allow-color */
  var COLOR_NAMES = ['蓝色', '橙色', '绿色'];

  // ============ 难度（1-10，由 generate 设置） ============
  function diffMax(base, level) { return _PU.diffMax(base, level); }

  /** 生成一组混排图形：{ shapes: [{k, c}], counts: {k: n}, colorCounts: {c: n} } */
  function makeGroup(level) {
    var items = [];
    var counts = { '三角形': 0, '圆形': 0, '正方形': 0 };
    var colorCounts = { '#5b8def': 0, '#e8870a': 0, '#27ae60': 0 }; /* allow-color */
    var total = rnd(Math.min(8, Math.max(5, diffMax(12, level))), Math.max(8, diffMax(12, level)));
    for (var i = 0; i < total; i++) {
      var k = pick(SHAPE_KEYS);
      var c = pick(COLORS);
      items.push({ k: k, c: c });
      counts[k]++;
      colorCounts[c]++;
    }
    // 保证至少两种形状、两种颜色，且数量不完全相同
    var distinctShape = Object.keys(counts).filter(function (k) { return counts[k] > 0; }).length;
    var distinctColor = Object.keys(colorCounts).filter(function (c) { return colorCounts[c] > 0; }).length;
    if (distinctShape < 2 || distinctColor < 2) return makeGroup(level);
    return { items: items, counts: counts, colorCounts: colorCounts };
  }

  function renderGroup(group) {
    var html = '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:6px auto;max-width:300px;background:var(--soft-bg);border-radius:12px;padding:10px;">';
    group.items.forEach(function (it) {
      html += '<span style="display:inline-block;">' + SHAPES[it.k](it.c) + '</span>';
    });
    return html + '</div>';
  }

  // ============ 题目生成 ============
  // 分类与整理：按形状数出数量
  function buildClassify(level) {
    var group = makeGroup(level);
    var targets = SHAPE_KEYS.filter(function (k) { return group.counts[k] > 0; });
    var target = pick(targets);
    return {
      kind: 'classify',
      group: group,
      target: target,
      question: '把下面的图形按形状分类，数一数【' + target + '】有几个？',
      answer: String(group.counts[target]),
      inputType: 'text'
    };
  }

  // 填写统计表：按形状整理并填写三种数量
  function buildTable(level) {
    var group = makeGroup(level);
    var active = SHAPE_KEYS.filter(function (k) { return group.counts[k] > 0; });
    var activeCount = active.length;
    var per = Math.max(3, activeCount); // 显示 3 行，不足补齐为 0
    var rows = SHAPE_KEYS.slice(0, per).map(function (k) {
      return { shape: k, count: group.counts[k] };
    });
    return {
      kind: 'table',
      group: group,
      rows: rows,
      question: '把下面的图形按形状分类整理，填一填统计表：',
      answer: rows.map(function (r) { return String(r.count); }),
      blanks: rows.map(function (r) { return r.shape; }),
      inputType: 'multi'
    };
  }

  // 象形统计图：用涂色方块表示数量，比较谁最多
  function buildPicto(level) {
    var group = makeGroup(level);
    var active = SHAPE_KEYS.filter(function (k) { return group.counts[k] > 0; });
    var maxK = active[0];
    active.forEach(function (k) { if (group.counts[k] > group.counts[maxK]) maxK = k; });
    var rows = active.map(function (k) { return { shape: k, count: group.counts[k] }; });
    return {
      kind: 'picto',
      group: group,
      rows: rows,
      maxShape: maxK,
      question: '观察下面的图形并数一数，哪一种图形最多？',
      answer: maxK,
      options: shuffleArr(active),
      inputType: 'choice'
    };
  }

  function buildMixed(level) {
    var r = rnd(1, 100);
    if (r <= 45) return buildClassify(level);
    if (r <= 75) return buildTable(level);
    return buildPicto(level);
  }

  function generateProblems(type, count, level) {
    var builder = { classify: buildClassify, table: buildTable, picto: buildPicto, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder(level);
      var key = q.kind + '|' + (q.target || '') + '|' + (Array.isArray(q.answer) ? q.answer.join(',') : String(q.answer)) + '|' +
        (q.rows ? q.rows.map(function (r) { return r.shape + ':' + r.count; }).join(',') : '') + '|' + q.question;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderCard(p, i) {
    var mid;
    if (p.kind === 'classify') {
      mid = renderGroup(p.group);
    } else if (p.kind === 'table') {
      var tableHTML = '<table style="border-collapse:collapse;margin:6px auto;font-size:14px;">' +
        '<tr><td class="stat-th">图形</td>' +
        p.rows.map(function (r) { return '<td class="stat-td">' + SHAPES[r.shape](COLORS[0]) + '</td>'; }).join('') + '</tr>' +
        '<tr><td class="stat-th">数量</td>' +
        p.rows.map(function (r, j) { return '<td class="stat-td" style="padding:4px 8px;"><input type="text" class="answer-inp" data-idx="' + i + '" data-field="' + j + '" placeholder="?" autocomplete="off" style="width:40px;height:28px;border:2px dashed var(--line-strong);border-radius:6px;font-size:14px;font-weight:800;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;"></td>'; }).join('') + '</tr>' +
        '</table>';
      mid = renderGroup(p.group) + tableHTML;
    } else {
      var barHTML = '<div style="margin:6px auto;max-width:280px;">';
      p.rows.forEach(function (r) {
        barHTML += '<div style="display:flex;align-items:center;gap:6px;margin:4px 0;">' +
          '<span style="width:56px;text-align:right;font-size:13px;font-weight:700;color:var(--ink);">' + SHAPES[r.shape](COLORS[0]) + '</span>' +
          '<span style="display:flex;gap:2px;">';
        for (var c = 0; c < r.count; c++) barHTML += '<span style="width:12px;height:16px;background:var(--brand);border:1px solid var(--brand-d);display:inline-block;"></span>';
        barHTML += '</span></div>';
      });
      barHTML += '</div>';
      var optHTML = '';
      p.options.forEach(function (o) {
        optHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
          '>' + o + '</button>';
      });
      mid = renderGroup(p.group) + barHTML +
        '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optHTML + '</div>' +
        '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">';
    }

    var inputHTML = '';
    if (p.inputType === 'text') {
      inputHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;">' +
        '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off">' +
        '<span class="unit">个</span></div>';
    } else if (p.inputType === 'multi' && p.kind !== 'table') {
      var blanksHTML = '';
      p.blanks.forEach(function (label, j) {
        blanksHTML += '<span style="margin:0 4px;font-size:14px;font-weight:700;color:var(--ink);">' + label + '：</span>' +
          '<input type="text" class="answer-inp" data-idx="' + i + '" data-field="' + j + '" placeholder="?" autocomplete="off" style="width:44px;height:30px;border:2px dashed var(--line-strong);border-radius:6px;font-size:14px;font-weight:800;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;margin:0 6px;">';
      });
      inputHTML = '<div style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:6px;">' + blanksHTML + '</div>';
    }

    return '<div class="question-card" data-index="' + i + '">' +
      '<div class="q-header">' +
        '<span class="num">' + (i + 1) + '</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;' +
        '<span class="q-text">' + p.question + '</span>' +
      '</div>' +
      mid +
      inputHTML +
      '<div class="feedback"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    if (q.inputType === 'choice') {
      var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
      return v === String(q.answer);
    }
    if (q.inputType === 'multi') {
      var expected = Array.isArray(q.answer) ? q.answer : [q.answer];
      for (var j = 0; j < expected.length; j++) {
        var key = idx + ':' + j;
        var ua = userAnswers && userAnswers[key] != null ? String(userAnswers[key]).trim() : '';
        if (String(ua) !== String(expected[j])) return false;
      }
      return true;
    }
    var val = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return String(val) === String(q.answer);
  }

  // ============ ExercisePlugin ============
  var mathStatisticsPlugin = {
    id: 'math-statistics',
    moduleId: 'M9',
    name: '分类与统计',
    grades: [1],
    subject: 'math',
    category: 'statistics',
    printConfig: { pageType: 'statistics' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',      label: '混合' },
          { value: 'classify', label: '分类与整理' },
          { value: 'table',    label: '填写统计表' },
          { value: 'picto',    label: '象形统计图' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      // 难度统一经 App.Difficulty.paramsFor 解析（批次7）：profile.effectiveLevel 替代直调 diffLevel
      var dp = opts.difficultyParams || (_D && _D.paramsFor ? _D.paramsFor('math', (opts.difficulty != null ? opts.difficulty : (opts.level || 3))) : { level: opts.difficulty != null ? opts.difficulty : (opts.level || 3) });
      var dpLevel = dp.level, dpScale = dp.scale, dpSteps = dp.steps, dpAllowBracket = dp.allowBracket, dpAllowMultDiv = dp.allowMultDiv, dpHasOwnLevel = (opts.level != null && opts.level !== '');

      var diffStamp = dpHasOwnLevel ? null : dpLevel;
      // 子题型 → 知识点（用于知识点关联）
      var KP_BY_KIND = {
        classify: 'math-g1-m9-classify',
        table: 'math-g1-m9-stats-table',
        picto: 'math-g1-m9-pictograph'
      };
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count, dpLevel);
      var typeNames = { mix: '混合练习', classify: '分类与整理', table: '填写统计表', picto: '象形统计图' };
      var label = typeNames[type] || '混合';
      var questions = list.map(function (p) {
        var q = {
          type: 'statistics',
          kind: p.kind,
          data: p,
          answer: Array.isArray(p.answer) ? p.answer.join('、') : String(p.answer),
          knowledgePointId: KP_BY_KIND[p.kind],
          hint: p.kind === 'classify' ? '先数出每一种图形有几个，再回答。' :
                p.kind === 'table' ? '按形状分别数一数，把数量填进统计表。' :
                '数一数每种图形各有多少个，比较谁最多。',
          render: function (idx, ctx) { return renderCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkQuestion(this, userAnswers, idx); }
        };
        if (diffStamp != null) q.difficulty = diffStamp;
        return q;
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: '小学一年级分类与统计（' + label + '）' }
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
        btns[i].style.background = 'var(--soft-bg)';
        btns[i].style.borderColor = 'var(--line-strong)';
      }
      btn.style.background = 'var(--brand)';
      btn.style.borderColor = 'var(--brand-d)';
      btn.style.color = 'var(--card)';
    }
  };

  // ============ 导出 ============
  global.__currentPlugin = mathStatisticsPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathStatisticsPlugin;

})(typeof window !== 'undefined' ? window : globalThis);
