/**
 * plugins/math-logic-reasoning.js — 数学广角/逻辑推理插件（二年级：简单推理 + 3×3 数独启蒙）
 *
 * 题型：
 *   bookGuess —— 简单推理：三人各拿一本不同的书，根据线索判断谁拿哪本书（choice）
 *   sudoku3   —— 3×3 数独：每行每列都有 1/2/3 三个数，填出缺的数（choice）
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
  if (!_PU) throw new Error('plugins/math-logic-reasoning.js 依赖 shared/common.js（PluginUtil），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  // ============ 难度（1-10，由 generate 设置） ============
  var _DIFF = 3;

  // ============ 题目生成 ============
  // 三人各拿一本不同的东西：根据线索推理（choice）
  function buildBookGuess() {
    // 三样东西 / 三个人的组合（people[0]/[1]/[2] 对应 items[0]/[1]/[2]）
    var sets = [
      { items: ['语文书', '数学书', '英语书'], people: ['小明', '小红', '小刚'] },
      { items: ['故事书', '漫画书', '科技书'], people: ['小丽', '小军', '小美'] },
      { items: ['足球', '篮球', '排球'], people: ['小华', '小强', '小芳'] },
      { items: ['苹果', '香蕉', '桃子'], people: ['哥哥', '弟弟', '妹妹'] }
    ];
    var set = pick(sets);
    var items = shuffleArr(set.items.slice());
    var p0 = set.people[0], p1 = set.people[1], p2 = set.people[2];
    var i0 = items[0], i1 = items[1], i2 = items[2];
    var variant = rnd(1, 2);
    if (variant === 1) {
      // 排除法·同一人：p1 不拿 i0，也不拿 i1 → p1 拿 i2
      return {
        kind: 'bookGuess',
        scene: set.items,
        clue1: p1 + '拿的不是' + i0,
        clue2: p1 + '拿的不是' + i1,
        question: p1 + '拿的是哪本？',
        answer: i2,
        options: shuffleArr([i0, i1, i2]),
        inputType: 'choice',
        hint: '先把"拿的不是"的都排除掉，剩下那个就是答案。'
      };
    }
    // 排除法·不同人：p0 不拿 i2，p1 不拿 i2 → p2 拿 i2
    return {
      kind: 'bookGuess',
      scene: set.items,
      clue1: p0 + '拿的不是' + i2,
      clue2: p1 + '拿的不是' + i2,
      question: '谁拿的是「' + i2 + '」？',
      answer: p2,
      options: shuffleArr([p0, p1, p2]),
      inputType: 'choice',
      hint: '先排除前两个人，剩下的那个人就是答案。'
    };
  }

  // 3×3 数独：1/2/3 每行每列各出现一次，缺一个格子
  function buildSudoku() {
    // 生成一个 3×3 拉丁方
    var base = shuffleArr([1, 2, 3]);
    // 循环移位的行，保证行列都不重复
    var grid = [
      base.slice(),
      [base[1], base[2], base[0]],
      [base[2], base[0], base[1]]
    ];
    // 随机空掉一个格子
    var blankR = rnd(0, 2), blankC = rnd(0, 2);
    var answer = grid[blankR][blankC];
    // 干扰项
    var wrongs = shuffleArr([1, 2, 3].filter(function (n) { return n !== answer; }));
    // 渲染 3×3 表格
    var html = '<table style="border-collapse:collapse;margin:6px auto;">';
    for (var r = 0; r < 3; r++) {
      html += '<tr>';
      for (var c = 0; c < 3; c++) {
        var val = grid[r][c];
        var isBlank = (r === blankR && c === blankC);
        html += '<td style="border:2px solid #5b8def;width:44px;height:44px;text-align:center;font-size:22px;font-weight:800;color:#27324a;background:' + (isBlank ? '#fffbe8' : '#eef3fb') + ';">' +
          (isBlank ? '<span style="color:#e8870a;">?</span>' : val) +
          '</td>';
      }
      html += '</tr>';
    }
    html += '</table>';
    return {
      kind: 'sudoku3',
      svg: html,
      question: '在3×3的方格中，每行、每列都要有1、2、3三个数。? 处应该填几？',
      answer: String(answer),
      options: shuffleArr([String(answer), String(wrongs[0]), String(wrongs[1])]),
      inputType: 'choice',
      hint: '看 ? 所在的行，这一行已经有哪两个数？剩下的那个就是答案。'
    };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 55) return buildBookGuess();
    return buildSudoku();
  }

  function generateProblems(type, count) {
    var builder = { bookGuess: buildBookGuess, sudoku3: buildSudoku, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + (q.scene ? q.scene.join(',') : '') + '|' + (q.svg || '') + '|' + q.answer;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderLogicCard(p, i) {
    var mid = '';
    if (p.kind === 'bookGuess') {
      mid = '<div style="background:#f8fafd;border-radius:10px;padding:8px 10px;margin:6px auto;max-width:260px;font-size:14px;color:#2b3a55;line-height:1.7;">' +
        '① ' + p.clue1 + '<br>② ' + p.clue2 + '</div>';
    } else {
      mid = '<div style="margin:4px 0;">' + p.svg + '</div>';
    }

    var optsHTML = '';
    p.options.forEach(function (o) {
      optsHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
        'style="cursor:pointer;border:1.5px solid #d5dff0;background:#fafbff;color:#2b3a55;border-radius:9px;padding:6px 14px;font-size:16px;font-weight:800;margin:3px;transition:.15s;">' + o + '</button>';
    });

    var hintHTML = p.hint ? '<div style="font-size:11px;color:#7a879c;margin-bottom:6px;">💡 ' + p.hint + '</div>' : '';

    return '<div class="question-card" data-index="' + i + '" style="border:1px solid #e3e9f2;border-radius:14px;padding:14px 12px;position:relative;text-align:center;background:#fff;box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<span class="num" style="position:absolute;left:8px;top:8px;width:20px;height:20px;border-radius:50%;background:#eef3fb;color:#5b8def;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</span>' +
      hintHTML +
      '<div style="font-size:15px;font-weight:800;color:#27324a;margin:4px 0 8px;">' + p.question + '</div>' +
      mid +
      '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optsHTML + '</div>' +
      '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">' +
      '<div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:8px;"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkLogicQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return _PU.normHZ(v) === _PU.normHZ(q.answer);
  }

  // ============ ExercisePlugin ============
  var mathLogicReasoningPlugin = {
    id: 'math-logic-reasoning',
    name: '简单推理与数独',
    grades: [2],
    subject: 'math',
    category: 'statistics',
    printConfig: { pageType: 'logicReasoning' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',       label: '混合' },
          { value: 'bookGuess', label: '简单推理' },
          { value: 'sudoku3',   label: '3×3 数独' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      _DIFF = _PU.diffLevel(opts.difficulty);
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', bookGuess: '简单推理', sudoku3: '3×3 数独' };
      var label = typeNames[type] || '数学广角';
      var questions = list.map(function (p) {
        return {
          type: 'logic-reasoning',
          kind: p.kind,
          data: p,
          answer: Array.isArray(p.answer) ? p.answer.join('、') : String(p.answer),
          hint: p.hint,
          render: function (idx, ctx) { return renderLogicCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkLogicQuestion(this, userAnswers, idx); }
        };
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: '小学二年级数学广角（' + label + '）' }
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
        var isRight = q.check ? q.check(userAnswers, i) : checkLogicQuestion(q, userAnswers, i);
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
  global.__currentPlugin = mathLogicReasoningPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathLogicReasoningPlugin;

})(typeof window !== 'undefined' ? window : globalThis);
