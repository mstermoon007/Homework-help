/**
 * plugins/math-area.js — 面积插件（三年级：面积单位 + 长方形正方形面积计算）
 *
 * 知识点覆盖：g3-m6-g3-area（面积）
 * 题型：
 *   unit   —— 认识面积单位（平方厘米/平方分米/平方米），选合适单位（choice）
 *   rect   —— 长方形面积 = 长 × 宽（text）
 *   square —— 正方形面积 = 边长 × 边长（text）
 *   grid   —— 数方格看图形面积（看图数格子，S=长×宽 直接数格子）（text）
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
  if (!_PU) throw new Error('plugins/math-area.js 依赖 shared/common.js（PluginUtil），请先加载');
  // 难度统一经 App.Difficulty.paramsFor 解析（批次8）
  var _D = (typeof App !== 'undefined' && App.Difficulty) ? App.Difficulty
    : (typeof require !== 'undefined' ? require('../shared/difficulty.js') : null);
  if (!_D || !_D.paramsFor) throw new Error('plugins/math-area.js 依赖 shared/difficulty.js（App.Difficulty），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  // ============ 难度（1-10，由 generate 设置） ============
  // 难度 → 边长取值范围（扩大以降低重复率）
  function sideRange(level) {
    if (level <= 4) return [1, 12];
    if (level <= 6) return [3, 16];
    if (level <= 8) return [5, 24];
    return [8, 32];
  }

  // 面积单位选择情境（扩展条目以降低重复率）
  var UNIT_ITEMS = [
    { obj: '一枚邮票', unit: '平方厘米', distractor: ['平方分米', '平方米'] },
    { obj: '数学书封面', unit: '平方分米', distractor: ['平方厘米', '平方米'] },
    { obj: '教室地面', unit: '平方米', distractor: ['平方厘米', '平方分米'] },
    { obj: '课桌面', unit: '平方分米', distractor: ['平方厘米', '平方米'] },
    { obj: '大拇指指甲', unit: '平方厘米', distractor: ['平方分米', '平方米'] },
    { obj: '游泳池水面', unit: '平方米', distractor: ['平方分米', '平方厘米'] },
    { obj: '手掌面积', unit: '平方分米', distractor: ['平方厘米', '平方米'] },
    { obj: '一块橡皮', unit: '平方厘米', distractor: ['平方分米', '平方米'] },
    { obj: '一张身份证', unit: '平方厘米', distractor: ['平方分米', '平方米'] },
    { obj: '黑板表面', unit: '平方米', distractor: ['平方厘米', '平方分米'] },
    { obj: '一张课桌的桌面', unit: '平方分米', distractor: ['平方厘米', '平方米'] },
    { obj: '操场的面积', unit: '平方米', distractor: ['平方厘米', '平方分米'] },
    { obj: '一块手帕', unit: '平方分米', distractor: ['平方厘米', '平方米'] },
    { obj: '一张银行卡', unit: '平方厘米', distractor: ['平方分米', '平方米'] },
    { obj: '一间卧室地面', unit: '平方米', distractor: ['平方厘米', '平方分米'] },
    { obj: '一本练习本封面', unit: '平方分米', distractor: ['平方厘米', '平方米'] },
    { obj: '电脑屏幕', unit: '平方分米', distractor: ['平方厘米', '平方米'] },
    { obj: '一块地砖', unit: '平方分米', distractor: ['平方厘米', '平方米'] },
    { obj: '一张邮票的面积', unit: '平方厘米', distractor: ['平方分米', '平方米'] },
    { obj: '校园的占地面积', unit: '平方米', distractor: ['平方厘米', '平方分米'] },
    { obj: '一支铅笔的侧面', unit: '平方厘米', distractor: ['平方分米', '平方米'] },
    { obj: '电视屏幕', unit: '平方分米', distractor: ['平方厘米', '平方米'] },
    { obj: '一张餐巾纸', unit: '平方厘米', distractor: ['平方分米', '平方米'] },
    { obj: '篮球场', unit: '平方米', distractor: ['平方厘米', '平方分米'] }
  ];

  // ============ 图形渲染 ============
  // 网格图：rows × cols 方格，返回 SVG（每格 24px）
  function gridSVG(rows, cols, cell) {
    cell = cell || 24;
    var w = cols * cell, h = rows * cell;
    var html = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">';
    for (var r = 0; r <= rows; r++) {
      html += '<line x1="0" y1="' + (r * cell) + '" x2="' + w + '" y2="' + (r * cell) + '" stroke="#b9c8e0" stroke-width="1"/>';
    }
    for (var c = 0; c <= cols; c++) {
      html += '<line x1="' + (c * cell) + '" y1="0" x2="' + (c * cell) + '" y2="' + h + '" stroke="#b9c8e0" stroke-width="1"/>';
    }
    html += '<text x="' + (w / 2) + '" y="' + (h + 16) + '" text-anchor="middle" font-size="12" fill="#7a879c">每格面积是 1 平方厘米</text>';
    return html + '</svg>';
  }

  // 长方形（标注长和宽）
  function rectSVG(len, wid) {
    var scale = Math.min(18, 640 / len, 320 / wid);
    var wd = len * scale, hd = wid * scale;
    return '<svg width="' + (wd + 40) + '" height="' + (hd + 40) + '" viewBox="0 0 ' + (wd + 40) + ' ' + (hd + 40) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="20" y="20" width="' + wd + '" height="' + hd + '" fill="#EBF3FD" stroke="#3b5bdb" stroke-width="2"/>' +
      '<text x="' + (20 + wd / 2) + '" y="' + (14) + '" text-anchor="middle" font-size="12" fill="#3b5bdb">长 ' + len + ' 厘米</text>' +
      '<text x="' + (20 + wd / 2) + '" y="' + (20 + hd / 2) + '" text-anchor="middle" font-size="12" fill="#3b5bdb" writing-mode="tb">宽 ' + wid + ' 厘米</text>' +
      '</svg>';
  }

  // 正方形（标注边长）
  function squareSVG(side) {
    var scale = Math.min(18, 640 / side, 320 / side);
    var wd = side * scale;
    return '<svg width="' + (wd + 30) + '" height="' + (wd + 30) + '" viewBox="0 0 ' + (wd + 30) + ' ' + (wd + 30) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="15" y="15" width="' + wd + '" height="' + wd + '" fill="#E6F7EE" stroke="#1c8448" stroke-width="2"/>' +
      '<text x="' + (15 + wd / 2) + '" y="' + (12) + '" text-anchor="middle" font-size="12" fill="#1c8448">边长 ' + side + ' 厘米</text>' +
      '</svg>';
  }

  // ============ 题目生成 ============
  // 选合适面积单位
  function buildUnit() {
    var item = pick(UNIT_ITEMS);
    var options = shuffleArr([item.unit].concat(item.distractor));
    return {
      kind: 'unit',
      question: '填上合适的面积单位：' + item.obj + '的面积大约是 1（ ）。',
      answer: item.unit,
      options: options,
      hint: '想一想：指甲盖约 1 平方厘米，手掌约 1 平方分米，教室地面约 50 平方米。',
      inputType: 'choice'
    };
  }

  // 长方形面积
  function buildRect(level) {
    var r = sideRange(level);
    var len = rnd(r[0], r[1]);
    var wid = rnd(r[0], r[1]);
    var area = len * wid;
    return {
      kind: 'rect',
      svg: rectSVG(len, wid),
      question: '一个长方形，长 ' + len + ' 厘米，宽 ' + wid + ' 厘米。它的面积是多少平方厘米？',
      answer: String(area),
      hint: '长方形面积 = 长 × 宽。',
      unitLabel: '平方厘米',
      inputType: 'text'
    };
  }

  // 正方形面积
  function buildSquare(level) {
    var r = sideRange(level);
    var side = rnd(r[0], r[1]);
    var area = side * side;
    return {
      kind: 'square',
      svg: squareSVG(side),
      question: '一个正方形的边长是 ' + side + ' 厘米。它的面积是多少平方厘米？',
      answer: String(area),
      hint: '正方形面积 = 边长 × 边长。',
      unitLabel: '平方厘米',
      inputType: 'text'
    };
  }

  // 数方格：给定网格图形，求面积（直接数格子）
  function buildGrid() {
    var rows = rnd(2, 10), cols = rnd(2, 10);
    var area = rows * cols;
    return {
      kind: 'grid',
      svg: gridSVG(rows, cols),
      question: '下面每个小方格代表 1 平方厘米，这个长方形的长是 ' + cols + ' 格、宽是 ' + rows + ' 格。它的面积是多少平方厘米？',
      answer: String(area),
      hint: '数一数长边有几个格子，宽边有几个格子，长 × 宽。',
      unitLabel: '平方厘米',
      inputType: 'text'
    };
  }

  function buildMixed(level) {
    var r = rnd(1, 100);
    if (r <= 25) return buildUnit();
    if (r <= 55) return buildRect(level);
    if (r <= 75) return buildSquare(level);
    return buildGrid();
  }

  function generateProblems(type, count, level) {
    var builder = { unit: buildUnit, rect: buildRect, square: buildSquare, grid: buildGrid, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 40, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder(level);
      var key = q.kind + '|' + q.answer + '|' + (q.question || '');
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderAreaCard(p, i) {
    var hintHTML = p.hint ? '<div class="q-hint">💡 ' + p.hint + '</div>' : '';
    var svgHTML = p.svg ? '<div style="display:flex;justify-content:center;padding:8px 0;margin:4px 0;">' + p.svg + '</div>' : '';

    var inputHTML = '';
    if (p.inputType === 'choice') {
      var optsHTML = '';
      p.options.forEach(function (o) {
        optsHTML += '<button type="button" data-val="' + o + '" onclick="window.__pickOpt(this)" ' +
          'style="cursor:pointer;border:1.5px solid var(--line-strong);background:var(--soft-bg);color:var(--ink);border-radius:9px;padding:6px 14px;font-size:15px;font-weight:800;margin:3px;transition:.15s;">' + o + '</button>';
      });
      inputHTML = '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;margin-top:6px;">' + optsHTML + '</div>' +
        '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">';
    } else {
      inputHTML = '<div class="input-group" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;">' +
        '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off" ' +
        'style="width:80px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:15px;font-weight:700;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;">' +
        '<span class="unit">' + (p.unitLabel || '平方厘米') + '</span>' +
        '</div>';
    }

    return '<div class="question-card math-card math-card--geometry" data-index="' + i + '">' +
      '<div class="q-header">' +
        '<span class="num">' + (i + 1) + '</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;' +
        hintHTML +
      '</div>' +
      '<div>' + p.question + '</div>' +
      svgHTML +
      inputHTML +
      '<div class="feedback"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkAreaQuestion(question, userAnswers, idx) {
    var p = question.data || question;
    if (p.inputType === 'choice') {
      var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
      return v === p.answer;
    }
    var val = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return String(val).replace(/\s/g, '') === String(p.answer).replace(/\s/g, '');
  }

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-area',
    moduleId: 'M6',
    name: '面积',
    grades: [3],
    subject: 'math',
    category: 'geometry',
    printConfig: { pageType: 'area' },
    // 声明本插件覆盖的知识点（用于开发期覆盖校验与提示）
    knowledgePoints: ['math-g3-m6-g3-area'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',     label: '混合' },
          { value: 'unit',    label: '面积单位' },
          { value: 'rect',    label: '长方形面积' },
          { value: 'square',  label: '正方形面积' },
          { value: 'grid',    label: '数方格' }
        ]
      }
    ],

    sortOrder: 2,

    generateQuestions: function (options) {
      var opts = options || {};
      // 难度统一经 App.Difficulty.paramsFor 解析（批次8）：profile.effectiveLevel 替代直调 diffLevel
      var dp = opts.difficultyParams || (_D && _D.paramsFor ? _D.paramsFor('math', (opts.difficulty != null ? opts.difficulty : (opts.level || 3))) : { level: opts.difficulty != null ? opts.difficulty : (opts.level || 3) });
      var dpLevel = dp.level, dpScale = dp.scale, dpSteps = dp.steps, dpAllowBracket = dp.allowBracket, dpAllowMultDiv = dp.allowMultDiv, dpHasOwnLevel = (opts.level != null && opts.level !== '');

      var diffStamp = dpHasOwnLevel ? null : dpLevel;
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count, dpLevel);
      var typeNames = { mix: '混合练习', unit: '面积单位', rect: '长方形面积', square: '正方形面积', grid: '数方格' };
      var label = typeNames[type] || '混合';
      var questions = list.map(function (p) {
        var q = {
          type: 'area',
          kind: p.kind,
          data: p,
          q: p.question,
          svg: p.svg,
          answer: String(p.answer),
          knowledgePointId: 'math-g3-m6-g3-area',
          hint: p.hint,
          render: function (idx) { return renderAreaCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkAreaQuestion(this, userAnswers, idx); }
        };
        if (diffStamp != null) q.difficulty = diffStamp;
        return q;
      });
      plugin._lastLabel = label;
      return questions;
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      var typeNames = { mix: '混合', unit: '面积单位', rect: '长方形面积', square: '正方形面积', grid: '数方格' };
      return { type: type, count: (opts && opts.count) || 8, title: '小学三年级面积（' + (typeNames[type] || '混合') + '）' };
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
        btns[i].style.background = 'var(--soft-bg)';
        btns[i].style.borderColor = 'var(--line-strong)';
      }
      btn.style.background = 'var(--brand)';
      btn.style.borderColor = 'var(--brand-d)';
      btn.style.color = 'var(--card)';
    }
  });

  // ============ 导出 ============
  global.__currentPlugin = plugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);