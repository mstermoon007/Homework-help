/**
 * plugins/math-g1-patterns.js — 一年级找规律插件（M4 找规律）
 *
 * 知识点覆盖（shared/knowledge-math.js 一年级 M4 模块）：
 *   math-g1-m4-number-pattern   数字规律 / 图形规律 / 颜色规律（category: number / shape）
 *
 * 题库 ≥12 道：图形规律（△○□ 循环）、数字规律（等差数列）、填规律后继。
 * 数字题用文本输入，图形题用图形选项（自定义渲染 + window.__currentPlugin.__choose）。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g1-patterns.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  // ============ 图形 SVG ============
  var SHAPES = {
    '△': function () { return '<svg width="30" height="26" viewBox="0 0 30 26"><polygon points="15,3 3,23 27,23" fill="#5b8def" stroke="#3b5bdb" stroke-width="1.5"/></svg>'; },
    '○': function () { return '<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="#27ae60" stroke="#1c8448" stroke-width="1.5"/></svg>'; },
    '□': function () { return '<svg width="26" height="26" viewBox="0 0 26 26"><rect x="3" y="3" width="20" height="20" fill="#e8870a" stroke="#c96a06" stroke-width="1.5"/></svg>'; },
    '◇': function () { return '<svg width="26" height="26" viewBox="0 0 26 26"><polygon points="13,2 24,13 13,24 2,13" fill="#9b59b6" stroke="#7d3a96" stroke-width="1.5"/></svg>'; }
  };
  var SHAPE_KEYS = Object.keys(SHAPES);

  // ============ 固定题库（≥12 道，去重稳定） ============
  var NUMBER_POOL = [
    { seq: [1, 3, 5, 7], answer: 9 },
    { seq: [2, 4, 6, 8], answer: 10 },
    { seq: [5, 10, 15], answer: 20 },
    { seq: [10, 20, 30], answer: 40 },
    { seq: [1, 2, 3, 4], answer: 5 },
    { seq: [9, 8, 7, 6], answer: 5 },
    { seq: [3, 6, 9], answer: 12 },
    { seq: [4, 8, 12], answer: 16 },
    { seq: [11, 13, 15], answer: 17 },
    { seq: [20, 18, 16], answer: 14 }
  ];
  var SHAPE_POOL = [
    { seq: ['△', '○', '□', '△', '○', '□'], answer: '△' },
    { seq: ['○', '□', '△', '○', '□', '△'], answer: '○' },
    { seq: ['□', '△', '○', '□', '△', '○'], answer: '□' },
    { seq: ['△', '□', '△', '□', '△', '□'], answer: '△' },
    { seq: ['○', '△', '○', '△', '○', '△'], answer: '○' },
    { seq: ['□', '○', '□', '○', '□', '○'], answer: '□' }
  ];

  function buildNumber() {
    var p = NUMBER_POOL[rnd(0, NUMBER_POOL.length - 1)];
    return { kind: 'number', seq: p.seq, answer: String(p.answer) };
  }
  function buildShape() {
    var p = SHAPE_POOL[rnd(0, SHAPE_POOL.length - 1)];
    return { kind: 'shape', seq: p.seq, answer: p.answer };
  }
  function buildMixed() { return rnd(1, 100) <= 60 ? buildNumber() : buildShape(); }

  var TYPE_BUILDERS = {
    'mix': buildMixed, 'number': buildNumber, 'shape': buildShape,
    'number-pattern': buildNumber, 'figure': buildShape
  };
  var TYPE_NAMES = { mix: '混合', number: '数字规律', shape: '图形规律', 'number-pattern': '数字规律', figure: '图形规律' };

  // ============ 渲染 / 判定 ============
  function renderNumber(p, i) {
    var seqHTML = p.seq.map(function (v, j) {
      return '<span style="font-size:20px;font-weight:800;color:var(--ink);">' + v + '</span>' +
        (j < p.seq.length - 1 ? '<span style="color:var(--muted);margin:0 4px;">、</span>' : '');
    }).join('');
    seqHTML += '<span style="color:var(--muted);margin:0 4px;">、</span>';
    return '<div class="question-card" data-index="' + i + '">' +
      '<div class="q-header"><span class="num">' + (i + 1) + '</span>' +
      '&nbsp;&nbsp;&nbsp;&nbsp;<span class="q-text">按规律填数：</span></div>' +
      '<div style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;margin:8px 0;">' + seqHTML +
      '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off" ' +
      'style="width:52px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:16px;font-weight:800;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;"></div>' +
      '<div class="feedback"></div></div>';
  }
  function renderShape(p, i) {
    var shapeHTML = p.seq.map(function (k) { return '<span style="display:inline-block;">' + SHAPES[k]() + '</span>'; }).join('');
    var optHTML = '';
    shuffleArr(SHAPE_KEYS).forEach(function (o) {
      optHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
        'style="cursor:pointer;border:1.5px solid var(--line-strong);background:var(--soft-bg);color:var(--ink);border-radius:9px;padding:4px 10px;margin:3px;transition:.15s;">' + SHAPES[o]() + '</button>';
    });
    return '<div class="question-card" data-index="' + i + '">' +
      '<div class="q-header"><span class="num">' + (i + 1) + '</span>' +
      '&nbsp;&nbsp;&nbsp;&nbsp;<span class="q-text">按规律，横线上应该是什么图形？</span></div>' +
      '<div style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px;margin:8px 0;">' + shapeHTML +
      '<span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:30px;border:2px dashed var(--line-strong);border-radius:8px;background:var(--soft-bg);margin:0 2px;">?</span></div>' +
      '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optHTML + '</div>' +
      '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">' +
      '<div class="feedback"></div></div>';
  }
  function makeCheck(q) {
    return function (userAnswers, idx) {
      var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
      return v === String(q.answer);
    };
  }

  var _pool = _PU.createPoolCache('math-g1-patterns:mix', function () {
    return NUMBER_POOL.concat(SHAPE_POOL).map(function (p, k) {
      return { kind: p.seq && typeof p.seq[0] === 'string' ? 'shape' : 'number', p: p, k: k };
    });
  });

  var plugin = _PU.createMathPlugin({
    id: 'math-g1-patterns',
    moduleId: 'M4',
    name: '找规律',
    pageSubtitle: '数字规律、图形规律与填规律后继',
    grades: [1],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'patterns' },
    knowledgePoints: ['math-g1-m4-number-pattern'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',    label: '混合' },
          { value: 'number', label: '数字规律' },
          { value: 'shape',  label: '图形规律' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 12;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 30, 200);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = p.kind + '|' + p.seq.join(',') + '|' + p.answer;
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        var q = {
          type: 'patterns',
          kind: p.kind,
          q: p.kind === 'number' ? '按规律填数：' + p.seq.join('、') + '、' : '按规律，横线上应该是什么图形？',
          answer: String(p.answer),
          knowledgePointId: 'math-g1-m4-number-pattern',
          hint: p.kind === 'number' ? '先找相邻两个数相差几，再看下一个数。' : '图形按一定顺序重复出现，先找出循环的一组。',
          render: function (idx) { return p.kind === 'number' ? renderNumber(p, idx) : renderShape(p, idx); },
          check: makeCheck(p)
        };
        if (p.kind === 'shape') q.options = shuffleArr(SHAPE_KEYS);
        else q.inputType = 'text';
        return q;
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 12,
        title: '小学一年级找规律（' + (TYPE_NAMES[type] || '混合') + '）'
      };
    },

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

  plugin.poolCache = _pool;

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
