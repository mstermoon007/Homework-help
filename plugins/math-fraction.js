/**
 * plugins/math-fraction.js — 分数的初步认识插件（三年级）
 *
 * 知识点覆盖：g3-m4-g3-fraction（分数的初步认识）
 * 题型：
 *   shard  —— 图形分块涂色，写出涂色部分占全图的几分之一/几分之几（text）
 *   compare—— 两个分数比大小，选择 > / < / =（choice）
 *   addsub —— 同分母分数加减（text）
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
  if (!_PU) throw new Error('plugins/math-fraction.js 依赖 shared/common.js（PluginUtil），请先加载');
  // 难度统一经 App.Difficulty.consume 解析（批次8）
  var _D = (typeof App !== 'undefined' && App.Difficulty) ? App.Difficulty
    : (typeof require !== 'undefined' ? require('../shared/difficulty.js') : null);
  if (!_D || !_D.consume) throw new Error('plugins/math-fraction.js 依赖 shared/difficulty.js（App.Difficulty），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  // ============ 难度（1-10，由 generate 设置） ============
  var _DIFF = 3;

  // 分母范围：难度越高允许更大的分母
  function denRange() {
    if (_DIFF <= 4) return [2, 6];
    if (_DIFF <= 6) return [2, 8];
    if (_DIFF <= 8) return [2, 10];
    return [2, 12];
  }

  // ============ 分数图形 SVG（块状条等分 n 份，涂色 m 份） ============
  function barFracSVG(n, m, w) {
    w = w || 180;
    var cell = w / n;
    var gap = n > 8 ? 1 : 2;
    var h = 26;
    var html = '<svg width="' + w + '" height="' + (h + 14) + '" viewBox="0 0 ' + w + ' ' + (h + 14) + '" style="vertical-align:middle;">';
    for (var i = 0; i < n; i++) {
      var fill = i < m ? '#5b8def' : '#e8eef7';
      html += '<rect x="' + (i * cell + gap / 2) + '" y="7" width="' + (cell - gap) + '" height="' + h + '" fill="' + fill + '" stroke="#3b5bdb" stroke-width="1"/>';
    }
    html += '</svg>';
    return html;
  }

  // 分数文本（HTML）：分子在上，分母在下
  function fracHTML(num, den) {
    if (num % den === 0) return '<span style="font-size:1.15em;font-weight:800;color:var(--brand-d);">' + (num / den) + '</span>';
    return '<span style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;line-height:1.15;margin:0 2px;">' +
      '<span style="border-bottom:1.5px solid var(--ink);padding:0 5px;font-size:1.15em;font-weight:800;color:var(--brand-d);">' + num + '</span>' +
      '<span style="padding:0 5px;font-size:1.15em;font-weight:800;color:var(--brand-d);">' + den + '</span></span>';
  }

  // ============ 题目生成 ============
  // 图形分块涂色，写出几分之几
  function buildShard() {
    var r = denRange();
    var den = rnd(r[0], r[1]);
    // 避免等于 1；涂色份数 1 ~ den-1（保证分数 < 1）
    var num = den === 2 ? rnd(1, 1) : rnd(1, den - 1);
    var unitLike = (num === 1); // 几分之一

    // 约分显示（三年级可约分如 2/4=1/2，但初识阶段显示原样更直观）
    var svg = barFracSVG(den, num);
    var display = fracHTML(num, den);
    var q = (unitLike ? '下面图形被分成' + den + '等份，涂色部分是其中的1份。请写出涂色部分占整个图形的几分之几：'
      : '下面图形被分成' + den + '等份，涂色了' + num + '份。请写出涂色部分占整个图形的几分之几：');

    return {
      kind: 'shard',
      svg: svg,
      question: q,
      expectNum: num,
      expectDen: den,
      display: display,
      answer: num + '/' + den,
      unitFrac: unitLike,
      hint: unitLike ? '总数是几份，就“几分之一”，先写分子1，再写分成几份的分母。' : '涂色的份数写在上面（分子），总共分成的份数写在下面（分母）。',
      inputType: 'text'
    };
  }

  // 两个分数比大小，选择 > / < / =
  function buildCompare() {
    var r = denRange();
    var variant = rnd(1, 3);
    var aNum, aDen, bNum, bDen;
    var question, answer, hint, operand;

    if (variant === 1) {
      // 同分母比大小
      aDen = rnd(r[0], r[1]);
      if (aDen === 2) aDen = rnd(3, Math.max(3, r[1])); // 分母为 2 时分子只能取 1，无法构成两个不同分数，改用 ≥3
      var a2 = rnd(1, aDen - 1);
      var b2 = a2;
      while (b2 === a2) { b2 = rnd(1, aDen - 1); }
      aNum = Math.max(a2, b2); bNum = Math.min(a2, b2);
      operand = '>';
      question = '比较大小，在横线上填 >、< 或 =：' + fracHTML(aNum, aDen) + ' ○ ' + fracHTML(bNum, bDen);
      answer = '>';
      hint = '分母相同比分子，分子大的分数大。';
    } else if (variant === 2) {
      // 分子同为 1，分母不同比大小
      aNum = 1; bNum = 1;
      aDen = rnd(r[0], Math.max(r[0] + 1, r[1]));
      var bDen = rnd(r[0], r[1]);
      while (bDen === aDen) { bDen = rnd(r[0], r[1]); }
      var big = Math.max(aDen, bDen), small = Math.min(aDen, bDen);
      // 分母大的分数反而小
      if (aDen === big) { aNum = 1; aDen = big; bNum = 1; bDen = small; operand = '<'; answer = '<'; }
      else { aNum = 1; aDen = small; bNum = 1; bDen = big; operand = '>'; answer = '>'; }
      question = '比较大小，在横线上填 >、< 或 =：' + fracHTML(aNum, aDen) + ' ○ ' + fracHTML(bNum, bDen);
      hint = '分子相同比分母，分母小的分数反而大。';
    } else {
      // 与 1 比较
      var d = rnd(r[0], r[1]);
      var n = rnd(1, d - 1);
      var vsWhole = rnd(1, 2) === 1;
      if (vsWhole) {
        question = '比较大小，在横线上填 >、< 或 =：' + fracHTML(n, d) + ' ○ 1';
        answer = '<';
        hint = '分母大于分子的分数都小于 1。';
      } else {
        question = '比较大小，在横线上填 >、< 或 =：' + fracHTML(d, d) + ' ○ 1';
        answer = '=';
        hint = '分子等于分母的分数等于 1。';
      }
    }

    return {
      kind: 'compare',
      question: question,
      expectNum: aNum, expectDen: aDen,
      answer: answer,
      operand: operand,
      options: shuffleArr(['>', '<', '=']),
      hint: hint,
      inputType: 'choice'
    };
  }

  // 同分母分数加减
  function buildAddsub() {
    var r = denRange();
    var den = rnd(4, r[1] > 4 ? r[1] : 6);
    var maxNum = den - 1;
    var isAdd = rnd(1, 2) === 1;
    var a, b;
    if (isAdd) {
      // a/den + b/den，结果 < 1（对应初步认识阶段不出现假分数）
      a = rnd(1, maxNum - 1);
      var remain = maxNum - a;
      b = rnd(1, remain);
      var res = a + b;
      return {
        kind: 'addsub',
        question: fracHTML(a, den) + ' + ' + fracHTML(b, den) + ' = ？',
        expectNum: res, expectDen: den,
        answer: res + '/' + den,
        isAdd: true,
        hint: '同分母分数相加，分母不变，分子相加。',
        inputType: 'text'
      };
    }
    // 减法，被减数大于减数
    a = rnd(2, maxNum);
    b = rnd(1, a - 1);
    var res2 = a - b;
    return {
      kind: 'addsub',
      question: fracHTML(a, den) + ' - ' + fracHTML(b, den) + ' = ？',
      expectNum: res2, expectDen: den,
      answer: res2 + '/' + den,
      isAdd: false,
      hint: '同分母分数相减，分母不变，分子相减。',
      inputType: 'text'
    };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 45) return buildShard();
    if (r <= 72) return buildCompare();
    return buildAddsub();
  }

  function generateProblems(type, count) {
    var builder = { shard: buildShard, compare: buildCompare, addsub: buildAddsub, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 40, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + q.answer + '|' + (q.question || '');
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render，处理分数输入框） */
  function renderFracCard(p, i) {
    var hintHTML = p.hint ? '<div class="q-hint">💡 ' + p.hint + '</div>' : '';

    var inputHTML = '';
    if (p.inputType === 'choice') {
      var optsHTML = '';
      p.options.forEach(function (o) {
        optsHTML += '<button type="button" data-val="' + o + '" onclick="window.__pickOpt(this)" ' +
          'style="cursor:pointer;border:1.5px solid var(--line-strong);background:var(--soft-bg);color:var(--ink);border-radius:9px;padding:6px 16px;font-size:17px;font-weight:800;margin:3px;transition:.15s;">' + o + '</button>';
      });
      inputHTML = '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;margin-top:6px;">' + optsHTML + '</div>' +
        '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">';
    } else {
      inputHTML = '<div class="input-group" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;">' +
        '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="如 1/2" autocomplete="off" ' +
        'style="width:110px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:15px;font-weight:700;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;">' +
        '</div>';
    }

    return '<div class="question-card" data-index="' + i + '">' +
      '<div class="q-header">' +
        '<span class="num">' + (i + 1) + '</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;' +
        hintHTML +
      '</div>' +
      '<div>' + p.question + '</div>' +
      (p.svg ? '<div style="margin:4px 0;">' + p.svg + '</div>' : '') +
      inputHTML +
      '<div class="feedback"></div>' +
      '</div>';
  }

  /** 分数答案规范化：把「1 / 2」「1/2」「1／2」统一为 num/den */
  function normFrac(s) {
    if (!s) return '';
    var t = String(s).replace(/\s+/g, '').replace(/／/g, '/');
    var m = t.match(/^(-?\d+)\/(\d+)$/);
    if (m) return Number(m[1]) + '/' + Number(m[2]);
    return t;
  }

  /** 单题判定（标准 Question.check） */
  function checkFracQuestion(question, userAnswers, idx) {
    var p = question.data || question;
    if (p.inputType === 'choice') {
      var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
      return v === p.answer;
    }
    var val = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return normFrac(val) === normFrac(p.answer);
  }

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-fraction',
    moduleId: 'M4',
    name: '分数的初步认识',
    grades: [3],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'fraction' },
    // 声明本插件覆盖的知识点（用于开发期覆盖校验与提示）
    knowledgePoints: ['math-g3-m4-g3-fraction'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',     label: '混合' },
          { value: 'shard',   label: '几分之几' },
          { value: 'compare', label: '分数比大小' },
          { value: 'addsub',  label: '同分母加减' }
        ]
      }
    ],

    sortOrder: 2,

    generateQuestions: function (options) {
      var opts = options || {};
      // 难度统一经 App.Difficulty.consume 解析（批次8）：profile.effectiveLevel 替代直调 diffLevel
      var prof = _D.consume(opts);
      _DIFF = prof.effectiveLevel;
      var diffStamp = prof.hasOwnLevel ? null : prof.effectiveLevel;
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', shard: '几分之几', compare: '分数比大小', addsub: '同分母加减' };
      var label = typeNames[type] || '混合';
      var questions = list.map(function (p) {
        var q = {
          type: 'fraction',
          kind: p.kind,
          data: p,
          answer: String(p.answer),
          knowledgePointId: 'math-g3-m4-g3-fraction',
          hint: p.hint,
          render: function (idx) { return renderFracCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkFracQuestion(this, userAnswers, idx); }
        };
        if (diffStamp != null) q.difficulty = diffStamp;
        return q;
      });
      plugin._lastLabel = label;
      return questions;
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      var typeNames = { mix: '混合', shard: '几分之几', compare: '分数比大小', addsub: '同分母加减' };
      return { type: type, count: (opts && opts.count) || 8, title: '小学三年级分数的初步认识（' + (typeNames[type] || '混合') + '）' };
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
        btns[i].style.background = '#fafbff';
        btns[i].style.borderColor = '#d5dff0';
      }
      btn.style.background = '#5b8def';
      btn.style.borderColor = '#3b5bdb';
      btn.style.color = '#fff';
    }
  });

  // ============ 导出 ============
  global.__currentPlugin = plugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);