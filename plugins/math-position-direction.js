/**
 * plugins/math-position-direction.js — 方向与位置插件（三年级：东南西北/八个方向/简单路线）
 *
 * 题型：
 *   compass —— 四个基本方向辨识：东南西北（choice）
 *   rel     —— 相对位置：某个物体在另一个物体的哪一面（choice）
 *   turn    —— 方向旋转：面向东，向右转90°面向哪？（choice）
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
  if (!_PU) throw new Error('plugins/math-position-direction.js 依赖 shared/common.js（PluginUtil），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  var DIRS = ['东', '南', '西', '北'];
  var ORDER = { '东': 0, '南': 1, '西': 2, '北': 3 };
  var OPPOSITE = { '东': '西', '西': '东', '南': '北', '北': '南' };

  // 相对位置图：中心+四个方向各放一个物体（十字布局）
  function relSVG(center, items) {
    // items: { n: 北边物体, s: 南边, w: 西边, e: 东边 }
    function cell(x, y, name, color) {
      return '<div style="width:56px;height:40px;border:1.5px solid var(--line-strong);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:' + color + ';background:var(--soft-bg);">' + name + '</div>';
    }
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">' +
      '<div>' + cell(60, 0, items.n, '#e8870a') + '</div>' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<div>' + cell(0, 60, items.w, '#e8870a') + '</div>' +
      '<div style="width:60px;height:46px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;color:var(--ink);border:2px solid var(--brand);border-radius:10px;background:var(--brand-bg);">' + center + '</div>' +
      '<div>' + cell(120, 60, items.e, '#e8870a') + '</div>' +
      '</div>' +
      '<div>' + cell(60, 120, items.s, '#e8870a') + '</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:2px;">上=北　右=东　下=南　左=西</div>' +
      '</div>';
  }

  // ============ 题目生成 ============
  // 方向辨识：给出生活中常见场景的方向常识
  function buildCompass() {
    var items = [
      { q: '太阳每天从哪一边升起？', a: '东' },
      { q: '太阳每天从哪一边落下？', a: '西' },
      { q: '我国北方冬天的风常常从哪边吹来？', a: '北' },
      { q: '面向太阳升起的方向（东方），我的后面是哪个方向？', a: '西' },
      { q: '面向东，我的左手边是哪个方向？', a: '北' },
      { q: '面向东，我的右手边是哪个方向？', a: '南' },
      { q: '面向北，我的后面是哪个方向？', a: '南' },
      { q: '面向北，我的左手边是哪个方向？', a: '西' },
      { q: '面向北，我的右手边是哪个方向？', a: '东' }
    ];
    var it = pick(items);
    return {
      kind: 'compass',
      question: it.q,
      answer: it.a,
      options: shuffleArr(DIRS.slice()),
      inputType: 'choice'
    };
  }

  // 相对位置：十字布局，判断物体方位
  function buildRel() {
    var names = ['教学楼', '图书馆', '操场', '食堂', '花园', '宿舍', '体育馆', '实验楼'];
    var center = pick(['学校', '广场', '公园']);
    var others = shuffleArr(names).slice(0, 4);
    var pos = { n: others[0], s: others[1], w: others[2], e: others[3] };
    var target = pick(['n', 's', 'w', 'e']);
    var dirCN = { n: '北', s: '南', w: '西', e: '东' };
    return {
      kind: 'rel',
      svg: relSVG(center, pos),
      question: '下面地图中，' + pos[target] + '在' + center + '的哪一面？',
      answer: dirCN[target],
      options: shuffleArr(DIRS.slice()),
      inputType: 'choice'
    };
  }

  // 方向旋转：面向某方向，左/右转90°面向哪里
  function buildTurn() {
    var facing = pick(DIRS);
    var turn = pick(['左', '右']);
    // 顺时针：东→南→西→北；逆时针反之
    var CW = ['东', '南', '西', '北'];
    var idx = CW.indexOf(facing);
    var target = turn === '右' ? CW[(idx + 1) % 4] : CW[(idx + 3) % 4];
    return {
      kind: 'turn',
      question: '面向' + facing + '，向' + turn + '转 90°，面向哪个方向？',
      answer: target,
      options: shuffleArr(DIRS.slice()),
      inputType: 'choice'
    };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 40) return buildCompass();
    if (r <= 75) return buildRel();
    return buildTurn();
  }

  function generateProblems(type, count) {
    var builder = { compass: buildCompass, rel: buildRel, turn: buildTurn, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + q.question + '|' + q.answer;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderDirCard(p, i) {
    var optsHTML = '';
    p.options.forEach(function (o) {
      optsHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
        'style="cursor:pointer;border:1.5px solid var(--line-strong);background:var(--soft-bg);color:var(--ink);border-radius:9px;padding:6px 14px;font-size:16px;font-weight:800;margin:3px;transition:.15s;">' + o + '</button>';
    });

    var mid = p.svg ? '<div class="q-shape" style="margin:4px auto 6px;">' + p.svg + '</div>' : '';

    return '<div class="question-card" data-index="' + i + '">' +
      '<div class="q-header">' +
        '<span class="num">' + (i + 1) + '</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;' +
        mid +
      '</div>' +
      '<div style="font-size:15px;font-weight:800;color:var(--ink);margin:4px 0 8px;">' + p.question + '</div>' +
      '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optsHTML + '</div>' +
      '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">' +
      '<div class="feedback"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkDirQuestion(question, userAnswers, idx) {
    var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return _PU.normHZ(v) === _PU.normHZ(question.answer);
  }

  // ============ ExercisePlugin ============
  var mathPosDirPlugin = {
    id: 'math-position-direction',
    moduleId: 'M6',
    name: '方向与位置',
    grades: [3],
    subject: 'math',
    category: 'geometry',
    printConfig: { pageType: 'positionDirection' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',     label: '混合' },
          { value: 'compass', label: '方向辨识' },
          { value: 'rel',     label: '相对位置' },
          { value: 'turn',    label: '方向旋转' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', compass: '方向辨识', rel: '相对位置', turn: '方向旋转' };
      var label = typeNames[type] || '混合';
      var questions = list.map(function (p) {
        return {
          type: 'position-direction',
          kind: p.kind,
          svg: p.svg || '',
          question: p.question,
          answer: p.answer,
          options: p.options,
          hint: p.kind === 'turn' ? '面对的方向确定后，向右转就是按顺时针方向转。' :
                p.kind === 'rel' ? '图上方向：上北、下南、左西、右东。' :
                p.kind === 'compass' ? '太阳东升西落；面向北时，左西右东。' : undefined,
          render: function (idx, ctx) { return renderDirCard(this, idx); },
          check: function (userAnswers, idx) { return checkDirQuestion(this, userAnswers, idx); }
        };
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: '小学三年级方向与位置（' + label + '）' }
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
        var isRight = q.check ? q.check(userAnswers, i) : checkDirQuestion(q, userAnswers, i);
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
  global.__currentPlugin = mathPosDirPlugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = mathPosDirPlugin;

})(typeof window !== 'undefined' ? window : globalThis);