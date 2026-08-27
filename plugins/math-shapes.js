/**
 * plugins/math-shapes.js — 图形练习插件（一年级：立体图形/平面图形/方位辨别/简单拼组）
 *
 * 提供 ExercisePlugin 接口（id/name/grades/subject/generate/render/check），
 * 供 practice.html / dev/plugin-check.html 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil；图形全部为动态 SVG。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-shapes.js 依赖 shared/common.js（PluginUtil），请先加载');
  // 难度统一经 App.Difficulty.consume 解析（批次8）
  var _D = (typeof App !== 'undefined' && App.Difficulty) ? App.Difficulty
    : (typeof require !== 'undefined' ? require('../shared/difficulty.js') : null);
  if (!_D || !_D.consume) throw new Error('plugins/math-shapes.js 依赖 shared/difficulty.js（App.Difficulty），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  // ============ 难度（1-10，由 generate 设置） ============
  var _DIFF = 3;
  var _GRADE = 1;

  // 方格纸上的长方形（三年级：数单位正方形求面积）
  // w×h 个单位正方形拼成的长方形，画在网格上
  function gridRectSVG(w, h) {
    var cell = 24;
    var html = '<svg width="' + (w * cell + 12) + '" height="' + (h * cell + 12) + '" viewBox="0 0 ' + (w * cell + 12) + ' ' + (h * cell + 12) + '">';
    for (var x = 0; x <= w; x++) {
      html += '<line x1="' + (6 + x * cell) + '" y1="6" x2="' + (6 + x * cell) + '" y2="' + (6 + h * cell) + '" stroke="#c9d4e6" stroke-width="1"/>';
    }
    for (var y = 0; y <= h; y++) {
      html += '<line x1="6" y1="' + (6 + y * cell) + '" x2="' + (6 + w * cell) + '" y2="' + (6 + y * cell) + '" stroke="#c9d4e6" stroke-width="1"/>';
    }
    for (var i = 0; i < w; i++) {
      for (var j = 0; j < h; j++) {
        html += '<rect x="' + (7 + i * cell) + '" y="' + (7 + j * cell) + '" width="' + (cell - 2) + '" height="' + (cell - 2) + '" fill="#5b8def" opacity="0.55" stroke="none"/>';
      }
    }
    return html + '</svg>';
  }

  // ============ 平面图形 SVG ============
  function svgTriangle() {
    return '<svg width="80" height="72" viewBox="0 0 80 72">' +
      '<polygon points="40,6 6,66 74,66" fill="#5b8def" stroke="#3b5bdb" stroke-width="2.5"/>' +
      '</svg>';
  }
  function svgSquare() {
    return '<svg width="72" height="72" viewBox="0 0 72 72">' +
      '<rect x="8" y="8" width="56" height="56" rx="3" fill="#5b8def" stroke="#3b5bdb" stroke-width="2.5"/>' +
      '</svg>';
  }
  function svgRect() {
    return '<svg width="88" height="60" viewBox="0 0 88 60">' +
      '<rect x="6" y="10" width="76" height="40" rx="3" fill="#5b8def" stroke="#3b5bdb" stroke-width="2.5"/>' +
      '</svg>';
  }
  function svgCircle() {
    return '<svg width="72" height="72" viewBox="0 0 72 72">' +
      '<circle cx="36" cy="36" r="30" fill="#5b8def" stroke="#3b5bdb" stroke-width="2.5"/>' +
      '</svg>';
  }
  function svgTrapezoid() {
    return '<svg width="88" height="62" viewBox="0 0 88 62">' +
      '<polygon points="20,8 68,8 82,54 6,54" fill="#5b8def" stroke="#3b5bdb" stroke-width="2.5"/>' +
      '</svg>';
  }

  // ============ 立体图形 SVG（等距画法） ============
  function svgCube() {
    return '<svg width="80" height="80" viewBox="0 0 80 80">' +
      '<path d="M30,25 L60,25 L60,55 L30,55 Z" fill="#eef3fb" stroke="#2b3a55" stroke-width="2"/>' +
      '<path d="M30,25 L40,32 L70,32 L60,25 Z" fill="#a9c0ea" stroke="#2b3a55" stroke-width="2"/>' +
      '<path d="M60,25 L70,32 L70,62 L60,55 Z" fill="#cbd9f0" stroke="#2b3a55" stroke-width="2"/>' +
      '<path d="M40,32 L40,62 L70,62 L70,32 Z" fill="#dce6f7" stroke="#2b3a55" stroke-width="2"/>' +
      '</svg>';
  }
  function svgCuboid() {
    return '<svg width="80" height="84" viewBox="0 0 80 84">' +
      '<path d="M20,20 L50,20 L50,60 L20,60 Z" fill="#eef3fb" stroke="#2b3a55" stroke-width="2"/>' +
      '<path d="M20,20 L30,27 L60,27 L50,20 Z" fill="#a9c0ea" stroke="#2b3a55" stroke-width="2"/>' +
      '<path d="M50,20 L60,27 L60,67 L50,60 Z" fill="#cbd9f0" stroke="#2b3a55" stroke-width="2"/>' +
      '</svg>';
  }
  function svgCylinder() {
    return '<svg width="76" height="90" viewBox="0 0 76 90">' +
      '<ellipse cx="38" cy="18" rx="26" ry="9" fill="#a9c0ea" stroke="#2b3a55" stroke-width="2"/>' +
      '<path d="M12,18 L12,66" stroke="#2b3a55" stroke-width="2"/>' +
      '<path d="M64,18 L64,66" stroke="#2b3a55" stroke-width="2"/>' +
      '<path d="M12,66 A26,9 0 0 0 64,66 Z" fill="#eef3fb" stroke="#2b3a55" stroke-width="2"/>' +
      '</svg>';
  }
  function svgSphere() {
    return '<svg width="80" height="80" viewBox="0 0 80 80">' +
      '<circle cx="40" cy="40" r="34" fill="#eef3fb" stroke="#2b3a55" stroke-width="2"/>' +
      '<ellipse cx="40" cy="40" rx="34" ry="12" fill="none" stroke="#b7c9ec" stroke-width="1.5"/>' +
      '<ellipse cx="40" cy="40" rx="12" ry="34" fill="none" stroke="#b7c9ec" stroke-width="1.5"/>' +
      '</svg>';
  }
  function svgCone() {
    return '<svg width="76" height="90" viewBox="0 0 76 90">' +
      '<path d="M38,6 L10,74 A28,12 0 0 0 66,74 Z" fill="#eef3fb" stroke="#2b3a55" stroke-width="2"/>' +
      '<ellipse cx="38" cy="74" rx="28" ry="10" fill="#dce6f7" stroke="#2b3a55" stroke-width="2"/>' +
      '</svg>';
  }

  var FLAT_SHAPES = [
    { name: '三角形', svg: svgTriangle },
    { name: '正方形', svg: svgSquare },
    { name: '长方形', svg: svgRect },
    { name: '圆形', svg: svgCircle }
  ];
  var FLAT_ALL = FLAT_SHAPES.concat([{ name: '梯形', svg: svgTrapezoid }]);
  var FLAT_OPTIONS = ['三角形', '正方形', '长方形', '圆形', '梯形'];

  var SOLID_SHAPES = [
    { name: '长方体', svg: svgCuboid },
    { name: '正方体', svg: svgCube },
    { name: '圆柱', svg: svgCylinder },
    { name: '球', svg: svgSphere }
  ];
  var SOLID_OPTIONS = ['长方体', '正方体', '圆柱', '球'];

  function flatSvg(name) {
    for (var i = 0; i < FLAT_ALL.length; i++) if (FLAT_ALL[i].name === name) return FLAT_ALL[i].svg();
    return '';
  }

  // ============ 拼组图形（已知数量的组合图形） ============
  var COMPOSITES = [
    {
      name: '房子',
      svg: function () {
        return '<svg width="170" height="180" viewBox="0 0 170 180">' +
          '<polygon points="85,5 8,60 162,60" fill="#f5a623" stroke="#2b3a55" stroke-width="2"/>' +
          '<rect x="30" y="60" width="110" height="110" fill="#eef3fb" stroke="#2b3a55" stroke-width="2"/>' +
          '<rect x="55" y="85" width="32" height="32" fill="#fff" stroke="#2b3a55" stroke-width="2"/>' +
          '<rect x="103" y="112" width="22" height="58" fill="#d9b38c" stroke="#2b3a55" stroke-width="2"/>' +
          '</svg>';
      },
      targets: [
        { name: '正方形', count: 2, q: '房子图中共有几个正方形？' },
        { name: '三角形', count: 1, q: '房子图中共有几个三角形？' }
      ]
    },
    {
      name: '小鱼',
      svg: function () {
        return '<svg width="170" height="120" viewBox="0 0 170 120">' +
          '<polygon points="30,60 85,18 85,102" fill="#f5a623" stroke="#2b3a55" stroke-width="2"/>' +
          '<polygon points="85,45 135,18 135,92" fill="#e8870a" stroke="#2b3a55" stroke-width="2"/>' +
          '<circle cx="58" cy="46" r="5" fill="#2b3a55"/>' +
          '</svg>';
      },
      targets: [
        { name: '三角形', count: 2, q: '小鱼图中共有几个三角形？' },
        { name: '圆形', count: 1, q: '小鱼图中共有几个圆形？' }
      ]
    },
    {
      name: '帆船',
      svg: function () {
        return '<svg width="170" height="130" viewBox="0 0 170 130">' +
          '<polygon points="70,12 70,100 128,100" fill="#5b8def" stroke="#3b5bdb" stroke-width="2"/>' +
          '<rect x="38" y="100" width="120" height="24" rx="3" fill="#e8870a" stroke="#2b3a55" stroke-width="2"/>' +
          '</svg>';
      },
      targets: [
        { name: '三角形', count: 1, q: '帆船图中共有几个三角形？' },
        { name: '长方形', count: 1, q: '帆船图中共有几个长方形？' }
      ]
    }
  ];

  // ============ 题行/网格渲染 ============
  function renderRow(names) {
    var html = '<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin:6px 0;">';
    names.forEach(function (n) { html += flatSvg(n); });
    return html + '</div>';
  }
  function renderGrid(grid) {
    // grid: [a,b,c,d] 排成 2x2：a b / c d
    var html = '<div style="display:inline-flex;flex-direction:column;gap:12px;margin:6px 0;">';
    html += '<div style="display:flex;gap:18px;justify-content:center;">' + flatSvg(grid[0]) + flatSvg(grid[1]) + '</div>';
    html += '<div style="display:flex;gap:18px;justify-content:center;">' + flatSvg(grid[2]) + flatSvg(grid[3]) + '</div>';
    return html + '</div>';
  }

  // ============ 题目生成 ============
  function distinctShapes(n, pool) {
    var src = shuffleArr(pool);
    return src.slice(0, n);
  }

  function buildFlat() {
    var target = pick(FLAT_ALL);
    return {
      kind: 'flat',
      svg: target.svg(),
      question: '这是什么图形？',
      answer: target.name,
      options: shuffleArr(FLAT_OPTIONS)
    };
  }

  function buildSolid() {
    var target = pick(SOLID_SHAPES);
    return {
      kind: 'solid',
      svg: target.svg(),
      question: '这是什么立体图形？',
      answer: target.name,
      options: shuffleArr(SOLID_OPTIONS)
    };
  }

  function buildPosition() {
    var variant = rnd(1, 3);
    // 难度越高，一排图形越多（3→5），数序难度更大
    var rowLen = Math.min(5, 3 + Math.floor((_DIFF - 3) / 2));
    var row = distinctShapes(rowLen, FLAT_SHAPES).map(function (s) { return s.name; });

    if (variant === 1) {
      // 从左数第几个是什么图形
      var pos = rnd(1, row.length);
      return {
        kind: 'position',
        svg: renderRow(row),
        question: '从左数，第' + pos + '个图形是什么？',
        answer: row[pos - 1],
        options: shuffleArr(FLAT_OPTIONS)
      };
    }

    if (variant === 2) {
      // 某图形左边/右边是什么
      var anchor = rnd(0, row.length - 1);
      var choices = [];
      if (anchor > 0) choices.push({ side: '左边', idx: anchor - 1 });
      if (anchor < row.length - 1) choices.push({ side: '右边', idx: anchor + 1 });
      var c = pick(choices);
      return {
        kind: 'position',
        svg: renderRow(row),
        question: row[anchor] + '的' + c.side + '是什么图形？',
        answer: row[c.idx],
        options: shuffleArr(FLAT_OPTIONS)
      };
    }

    // 上/下方位：2x2 网格
    var grid = distinctShapes(4, FLAT_SHAPES).map(function (s) { return s.name; });
    var cell = rnd(0, 3);
    var ups = [];
    if (cell >= 2) ups.push({ side: '上面', idx: cell - 2 });
    if (cell < 2) ups.push({ side: '下面', idx: cell + 2 });
    var u = pick(ups);
    return {
      kind: 'position',
      svg: renderGrid(grid),
      question: grid[cell] + '的' + u.side + '是什么图形？',
      answer: grid[u.idx],
      options: shuffleArr(FLAT_OPTIONS)
    };
  }

  function buildCount() {
    var comp = pick(COMPOSITES);
    var target = pick(comp.targets);
    return {
      kind: 'count',
      svg: comp.svg(),
      question: target.q,
      answer: String(target.count),
      options: shuffleArr(['1', '2', '3', '4', '5', '6'])
    };
  }

  // 三年级：方格纸数面积（用单位正方形拼成长方形，数出面积）
  function buildAreaGrid() {
    var w = rnd(3, 9), h = rnd(2, Math.min(6, w - 1));
    if (h >= w) h = w - 1;
    return {
      kind: 'areaGrid',
      svg: gridRectSVG(w, h),
      question: '下面的长方形由边长 1 厘米的小正方形拼成，它的面积是多少平方厘米？',
      answer: String(w * h),
      inputType: 'text',
      hint: '一行有 ' + w + ' 个，有 ' + h + ' 行，用乘法算一算一共有多少个小正方形。'
    };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (_GRADE >= 3) {
      if (r <= 55) return buildAreaGrid();
      if (r <= 80) return buildCount();
      return buildFlat();
    }
    if (r <= 30) return buildFlat();
    if (r <= 55) return buildSolid();
    if (r <= 80) return buildPosition();
    return buildCount();
  }

  function generateProblems(type, count) {
    var builder = { flat: buildFlat, solid: buildSolid, position: buildPosition, count: buildCount, areaGrid: buildAreaGrid, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + q.answer + '|' + q.question;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderShapeCard(p, i) {
    var inputHTML = '';
    if (p.inputType === 'text') {
      inputHTML = '<div class="input-group" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;">' +
        '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off">' +
        '<span class="unit">平方厘米</span>' +
        '</div>';
    } else {
      var optsHTML = '';
      p.options.forEach(function (o) {
        optsHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
          'style="cursor:pointer;border:1.5px solid var(--line-strong);background:var(--soft-bg);color:var(--ink);border-radius:9px;padding:6px 12px;font-size:14px;font-weight:700;margin:3px;transition:.15s;">' + o + '</button>';
      });
      inputHTML = '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optsHTML + '</div>' +
        '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">';
    }

    var hintHTML = p.hint ? '<div class="q-hint">💡 ' + p.hint + '</div>' : '';

    return '<div class="question-card math-card math-card--geometry" data-index="' + i + '">' +
      '<div class="q-header">' +
        '<span class="num">' + (i + 1) + '</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;' +
        hintHTML +
      '</div>' +
      '<div class="q-shape" style="margin:4px auto 6px;">' + p.svg + '</div>' +
      '<div style="font-size:15px;font-weight:800;color:var(--ink);margin:4px 0 8px;">' + p.question + '</div>' +
      inputHTML +
      '<div class="feedback"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkShapeQuestion(question, userAnswers, idx) {
    var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    if (question.inputType === 'text') {
      return String(v).replace(/\s/g, '') === String(question.answer).replace(/\s/g, '');
    }
    return _PU.normHZ(v) === _PU.normHZ(question.answer);
  }

  // ============ ExercisePlugin ============
  var mathShapesPlugin = {
    id: 'math-shapes',
    moduleId: 'M6',
    name: '认识图形',
    grades: [1, 2, 3],
    subject: 'math',
    category: 'geometry',
    printConfig: { pageType: 'shapes' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',      label: '混合' },
          { value: 'flat',     label: '平面图形' },
          { value: 'solid',    label: '立体图形' },
          { value: 'position', label: '方位辨别' },
          { value: 'count',    label: '拼组图形' },
          { value: 'areaGrid', label: '方格纸数面积' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      // 难度统一经 App.Difficulty.consume 解析（批次8）：profile.effectiveLevel 替代直调 diffLevel
      var prof = _D.consume(opts);
      _DIFF = prof.effectiveLevel;
      var diffStamp = prof.hasOwnLevel ? null : prof.effectiveLevel;
      _GRADE = opts.grade || 1;
      // 子题型 → 知识点（按年级区分；三年级无本插件知识点，不标注）
      var KP_BY_GRADE_KIND = {
        1: {
          flat: 'math-g1-m6-flat-shapes', solid: 'math-g1-m6-solid-shapes',
          position: 'math-g1-m6-position', count: 'math-g1-m6-shape-compose'
        },
        2: {
          flat: 'math-g2-m6-shapes-2', solid: 'math-g2-m6-shapes-2',
          position: 'math-g2-m6-shapes-2', count: 'math-g2-m6-shapes-2', areaGrid: 'math-g2-m6-shapes-2'
        }
      };
      var kpMap = KP_BY_GRADE_KIND[_GRADE] || null;
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { flat: '平面图形', solid: '立体图形', position: '方位辨别', count: '拼组图形', areaGrid: '方格纸数面积', mix: '混合练习' };
      var label = typeNames[type] || '图形';
      var gradeName = { 1: '一', 2: '二', 3: '三' }[_GRADE] || '三';
      var questions = list.map(function (p) {
        var q = {
          type: 'shapes',
          kind: p.kind,
          svg: p.svg,
          question: p.question,
          answer: p.answer,
          options: p.options,
          inputType: p.inputType || 'choice',
          knowledgePointId: kpMap ? (kpMap[p.kind] || undefined) : undefined,
          hint: p.kind === 'areaGrid' ? '每行几个、有几行，乘起来就是小正方形的总数。' :
                p.kind === 'count' ? '仔细观察，按图形种类分别数一数，不要漏数哦。' : '先看看图形像什么，再想一想它的名称和位置。',
          render: function (idx, ctx) { return renderShapeCard(this, idx); },
          check: function (userAnswers, idx) { return checkShapeQuestion(this, userAnswers, idx); }
        };
        if (diffStamp != null) q.difficulty = diffStamp;
        return q;
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: '小学' + gradeName + '年级图形练习（' + label + '）' }
      };
    },

    render: function (exerciseSet) {
      var html = '';
      exerciseSet.questions.forEach(function (q, i) {
        html += q.render(i);
      });
      return html;
    },

    check: function (exerciseSet, userAnswers) {
      var correct = 0;
      var results = [];
      var correctAnswers = [];
      exerciseSet.questions.forEach(function (q, i) {
        var isRight = q.check ? q.check(userAnswers, i) : checkShapeQuestion(q, userAnswers, i);
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

    // 选项按钮点击：高亮 + 写入隐藏 input（practice.html 收集 input[data-index]）
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
  global.__currentPlugin = mathShapesPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathShapesPlugin;

})(typeof window !== 'undefined' ? window : globalThis);
