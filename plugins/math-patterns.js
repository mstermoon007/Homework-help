// @ts-check
/// <reference path="../shared/plugin-types.js" />

// 使用 shared/common.js 的 PluginUtil.createPlugin 工厂：
// 开发者只需实现 generateQuestions(opts)，render/check 由工厂自动生成。
// 通过 knowledgePoints 声明本插件覆盖的知识点，开发期会自动校验 / 提示覆盖情况。
(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-patterns.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');
  // 难度统一经 App.Difficulty.paramsFor 解析（批次7）
  var _D = (typeof App !== 'undefined' && App.Difficulty) ? App.Difficulty
    : (typeof require !== 'undefined' ? require('../shared/difficulty.js') : null);
  if (!_D || !_D.paramsFor) throw new Error('plugins/math-patterns.js 依赖 shared/difficulty.js（App.Difficulty），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  // ============ 图形 SVG ============
  var SHAPES = {
    '△': function () {
      return '<svg width="30" height="26" viewBox="0 0 30 26"><polygon points="15,3 3,23 27,23" fill="#5b8def" stroke="#3b5bdb" stroke-width="1.5"/></svg>';
    },
    '□': function () {
      return '<svg width="26" height="26" viewBox="0 0 26 26"><rect x="3" y="3" width="20" height="20" fill="#e8870a" stroke="#c96a06" stroke-width="1.5"/></svg>';
    },
    '○': function () {
      return '<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="#27ae60" stroke="#1c8448" stroke-width="1.5"/></svg>';
    },
    '◇': function () {
      return '<svg width="26" height="26" viewBox="0 0 26 26"><polygon points="13,2 24,13 13,24 2,13" fill="#9b59b6" stroke="#7d3a96" stroke-width="1.5"/></svg>';
    }
  };
  var SHAPE_KEYS = Object.keys(SHAPES);

  // ============ 题目生成（diff 为 1-10 难度） ============
  function buildNumber(diff) {
    var up = rnd(0, 1) === 1;
    var steps = diff <= 3 ? [1, 2, 3, 5, 10] : (diff <= 6 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 20]);
    var step = pick(steps);
    var start = rnd(1, diff <= 4 ? 20 : (diff <= 7 ? 40 : 60));
    var count = diff <= 4 ? rnd(3, 5) : (diff <= 7 ? rnd(4, 6) : rnd(5, 7));
    var seq = [];
    for (var i = 0; i < count; i++) {
      seq.push(up ? start + i * step : start - i * step);
    }
    var next = up ? seq[count - 1] + step : seq[count - 1] - step;
    if (next < 0 || next > 100) return buildNumber(diff);
    return { kind: 'number', seq: seq, answer: String(next), question: '按规律填数：', inputType: 'text' };
  }

  function buildShape(diff) {
    var cycleLen = pick([2, 3, 4, 5]);
    var keys = shuffleArr(SHAPE_KEYS);
    var cycle = keys.slice(0, cycleLen);
    var showCount = diff <= 4 ? rnd(6, 9) : rnd(8, 12);
    var seq = [];
    for (var i = 0; i < showCount; i++) seq.push(cycle[i % cycle.length]);
    var next = cycle[showCount % cycle.length];
    return { kind: 'shape', seq: seq, answer: next, options: shuffleArr(SHAPE_KEYS), question: '按规律，横线上应该是什么图形？', inputType: 'choice' };
  }

  function buildMixed(diff) {
    return rnd(1, 100) <= 55 ? buildNumber(diff) : buildShape(diff);
  }

  function generateProblems(type, count, diff) {
    var builder = { number: buildNumber, shape: buildShape, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder(diff);
      var key = q.kind + '|' + q.answer + '|' + (q.seq.join(','));
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  function renderCard(p, i) {
    var mid = '';
    if (p.kind === 'number') {
      var numHTML = p.seq.map(function (v, j) {
        return '<span style="font-size:20px;font-weight:800;color:var(--ink);">' + v + '</span>' +
          (j < p.seq.length - 1 ? '<span style="color:var(--muted);margin:0 4px;">、</span>' : '');
      }).join('');
      numHTML += '<span style="color:var(--muted);margin:0 4px;">、</span>';
      mid = '<div style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;margin:8px 0;">' + numHTML +
        '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off" style="width:52px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:16px;font-weight:800;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;">' +
        '</div>';
    } else {
      var shapeHTML = p.seq.map(function (k) { return '<span style="display:inline-block;">' + SHAPES[k]() + '</span>'; }).join('');
      var optHTML = '';
      p.options.forEach(function (o) {
        optHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
          'style="cursor:pointer;border:1.5px solid var(--line-strong);background:var(--soft-bg);color:var(--ink);border-radius:9px;padding:4px 10px;margin:3px;transition:.15s;">' + SHAPES[o]() + '</button>';
      });
      mid = '<div style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px;margin:8px 0;">' + shapeHTML +
        '<span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:30px;border:2px dashed var(--line-strong);border-radius:8px;background:var(--soft-bg);margin:0 2px;">?</span>' +
        '</div>' +
        '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optHTML + '</div>' +
        '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">';
    }
    return '<div class="question-card" data-index="' + i + '">' +
      '<div class="q-header">' +
        '<span class="num">' + (i + 1) + '</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;' +
        '<span class="q-text">' + p.question + '</span>' +
      '</div>' +
      mid +
      '<div class="feedback"></div>' +
      '</div>';
  }

  function checkQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return v === String(q.answer);
  }

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-patterns',
    moduleId: 'M4',
    name: '找规律',
    grades: [1],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'patterns' },
    // 声明本插件覆盖的知识点（用于开发期覆盖校验与提示）
    knowledgePoints: {
      1: ['math-g1-m4-number-pattern'],
      2: ['math-g2-m4-number-pattern']
    },

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
      // 难度统一经 App.Difficulty.paramsFor 解析（批次7）：profile.effectiveLevel 替代直调 diffLevel
      var dp = opts.difficultyParams || (_D && _D.paramsFor ? _D.paramsFor('math', (opts.difficulty != null ? opts.difficulty : (opts.level || 3))) : { level: opts.difficulty != null ? opts.difficulty : (opts.level || 3) });
      var dpLevel = dp.level, dpScale = dp.scale, dpSteps = dp.steps, dpAllowBracket = dp.allowBracket, dpAllowMultDiv = dp.allowMultDiv, dpHasOwnLevel = (opts.level != null && opts.level !== '');
      var diffStamp = dpHasOwnLevel ? null : dpLevel;
      var diff = dpLevel;
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count, diff);
      var typeNames = { mix: '混合练习', number: '数字规律', shape: '图形规律' };
      var label = typeNames[type] || '混合';
      var questions = list.map(function (p) {
        var seqText = p.seq.map(function (k) {
          return (typeof k === 'string' && SHAPES[k]) ? k : String(k);
        }).join(p.kind === 'number' ? '、' : ' ');
        var fullQ = p.kind === 'number'
          ? (p.question + seqText + '、')
          : (p.question + seqText + ' ');
        var q = {
          type: 'patterns',
          kind: p.kind,
          data: p,
          q: fullQ,
          answer: String(p.answer),
          knowledgePointId: 'math-g1-m4-number-pattern',
          hint: p.kind === 'number' ? '先找相邻两个数相差几，再看下一个数。' : '图形是按照一定顺序重复出现的，先找出循环的一组。',
          render: function (idx) { return renderCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkQuestion(this, userAnswers, idx); }
        };
        if (diffStamp != null) q.difficulty = diffStamp;
        return q;
      });
      // 通过 meta 把题型标题带出去（工厂默认 meta 仅含 grade/count）
      plugin._lastLabel = label;
      return questions;
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      var typeNames = { mix: '混合', number: '数字规律', shape: '图形规律' };
      return { type: type, count: (opts && opts.count) || 8, title: '小学一年级找规律（' + (typeNames[type] || '混合') + '）' };
    },

    // 选项按钮点击（choice 题型），由 render 内联 onclick 调用
    __choose: function (btn) {
    // TODO(M4): 选项高亮属交互层，迁移到 check/render 层
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
