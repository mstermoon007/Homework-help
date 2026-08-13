/**
 * plugins/math-time-date.js — 时间与日期插件（三年级：年月日/时分秒/24时制）
 *
 * 题型：
 *   ym   —— 年月日：大月小月/闰年平年/一年几个月等（choice + text）
 *   cal  —— 经过时间：同月几号到几号、经过几分钟等（text）
 *   ampm —— 24时制与12时制互化（choice）
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
  if (!_PU) throw new Error('plugins/math-time-date.js 依赖 shared/common.js（PluginUtil），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  var BIG_MONTHS = [1, 3, 5, 7, 8, 10, 12];
  var SMALL_MONTHS = [4, 6, 9, 11];

  function isBigMonth(m) { return BIG_MONTHS.indexOf(m) !== -1; }

  // ============ 题目生成 ============
  // 年月日：常识题
  function buildYM() {
    var variant = rnd(1, 6);
    if (variant === 1) {
      // 大月有几天
      var m = pick(BIG_MONTHS);
      return {
        kind: 'ym',
        variant: 'bigDays',
        question: m + ' 月是大月，这个月有多少天？',
        answer: '31',
        options: shuffleArr(['31', '30', '28']),
        inputType: 'choice'
      };
    }
    if (variant === 2) {
      // 小月有几天
      var sm = pick(SMALL_MONTHS);
      return {
        kind: 'ym',
        variant: 'smallDays',
        question: sm + ' 月是小月，这个月有多少天？',
        answer: '30',
        options: shuffleArr(['31', '30', '28']),
        inputType: 'choice'
      };
    }
    if (variant === 3) {
      // 一个季度几个月（含第几季度）
      var q = pick([[1, '一'], [2, '二'], [3, '三'], [4, '四']]);
      return {
        kind: 'ym',
        variant: 'quarter',
        question: '一年有（ ）个季度，每个季度有（ ）个月。',
        answer: '3',
        options: shuffleArr(['3', '4', '12']),
        inputType: 'choice'
      };
    }
    if (variant === 4) {
      // 平年/闰年 2 月
      var leap = rnd(1, 2) === 1;
      var year = leap ? pick([2020, 2024, 2028]) : pick([2021, 2023, 2025]);
      return {
        kind: 'ym',
        variant: 'feb',
        question: year + ' 年是' + (leap ? '闰' : '平') + '年，这一年的 2 月有多少天？',
        answer: leap ? '29' : '28',
        options: shuffleArr(['29', '28', '30']),
        inputType: 'choice'
      };
    }
    if (variant === 5) {
      // 平年/闰年全年天数
      var leap2 = rnd(1, 2) === 1;
      var year2 = leap2 ? pick([2020, 2024, 2028]) : pick([2021, 2022, 2023]);
      return {
        kind: 'ym',
        variant: 'wholeYear',
        question: year2 + ' 年是' + (leap2 ? '闰' : '平') + '年，这一年一共有多少天？',
        answer: leap2 ? '366' : '365',
        options: shuffleArr(['366', '365', '364']),
        inputType: 'choice'
      };
    }
    // 判断平年/闰年（能被4整除，整百年能被400整除）
    var yr = rnd(1996, 2032);
    var isLeap = (yr % 400 === 0) || (yr % 4 === 0 && yr % 100 !== 0);
    return {
      kind: 'ym',
      variant: 'leapJudge',
      question: yr + ' 年是平年还是闰年？',
      answer: isLeap ? '闰年' : '平年',
      options: shuffleArr(['平年', '闰年']),
      inputType: 'choice'
    };
  }

  // 经过时间：同月几号到几号（含起止） / 品牌价
  function buildCal() {
    if (rnd(1, 2) === 1) {
      // 同月经过
      var m = pick([4, 5, 6, 7, 8, 9, 10]);
      var a = rnd(5, 18);
      var b = rnd(a + 2, 28);
      return {
        kind: 'cal',
        variant: 'days',
        m: m, a: a, b: b,
        question: m + ' 月 ' + a + ' 日到 ' + m + ' 月 ' + b + ' 日，一共经过了多少天？',
        answer: String(b - a),
        hint: '同月内经过天数 = 后一个日期 - 前一个日期，注意不把开头那天算进去：' + (b - a) + ' 天。',
        inputType: 'text'
      };
    }
    // 经过小时（8:00 → 11:30）
    var h1 = rnd(6, 12), h2 = rnd(h1 + 2, 18);
    var pts = pick([[0, 30], [15, 45]]);
    var start = h1 + ':' + String(pts[0]).padStart(2, '0');
    var end = h2 + ':' + String(pts[1]).padStart(2, '0');
    var minutes = (h2 * 60 + pts[1]) - (h1 * 60 + pts[0]);
    return {
      kind: 'cal',
      variant: 'time',
      start: start, end: end,
      question: '从上午 ' + start + ' 到上午 ' + end + '，一共经过了多少分钟？',
      answer: String(minutes),
      hint: '都用分钟来算：' + (h2 * 60 + pts[1]) + ' − ' + (h1 * 60 + pts[0]) + ' = ' + minutes + ' 分钟。',
      inputType: 'text'
    };
  }

  // 24时制互化
  function buildAmpm() {
    var variant = rnd(1, 3);
    if (variant === 1) {
      // 24时制 → 12时制
      var h24 = rnd(13, 21);
      var mm = pick([0, 5, 15, 30, 45]);
      return {
        kind: 'ampm',
        variant: 'to12',
        h24: h24, mm: mm,
        question: h24 + ':' + String(mm).padStart(2, '0') + ' 用普通计时法（12时制）表示是几时几分？',
        answer: (h24 - 12) + ':' + String(mm).padStart(2, '0'),
        options: shuffleArr([(h24 - 12) + ':' + String(mm).padStart(2, '0'), (h24 - 12) + ':' + String((mm + 10) % 60).padStart(2, '0'), h24 + ':' + String(mm).padStart(2, '0')]),
        inputType: 'choice'
      };
    }
    if (variant === 2) {
      // 12时制（下午） → 24时制
      var h12 = rnd(2, 11);
      var mm2 = pick([0, 10, 20, 30, 40]);
      return {
        kind: 'ampm',
        variant: 'to24',
        h12: h12, mm2: mm2,
        question: '下午 ' + h12 + ':' + String(mm2).padStart(2, '0') + ' 用 24 时计时法表示是几时几分？',
        answer: (h12 + 12) + ':' + String(mm2).padStart(2, '0'),
        options: shuffleArr([(h12 + 12) + ':' + String(mm2).padStart(2, '0'), h12 + ':' + String(mm2).padStart(2, '0'), (h12 + 12) + ':' + String((mm2 + 30) % 60).padStart(2, '0')]),
        inputType: 'choice'
      };
    }
    // 判断上/下午时段
    var t24 = pick([8, 9, 11, 14, 16, 20]);
    return {
      kind: 'ampm',
      variant: 'ampm',
      t24: t24,
      question: t24 + ' 时对应的是上午还是下午？',
      answer: t24 < 12 ? '上午' : '下午',
      options: shuffleArr(['上午', '下午']),
      inputType: 'choice'
    };
  }

  // 钟面读写：生成模拟钟表 SVG，问时间或选钟面
  function buildClockFace() {
    var variant = rnd(1, 2);
    // 生成整点、半点、刻度时间
    var hour = rnd(1, 12);
    var minute = pick([0, 15, 30, 45]);
    if (minute === 0 && rnd(1, 2) === 1) minute = pick([10, 20, 40, 50]);

    function clockSVG(h, m) {
      var cx = 60, cy = 60, R = 52;
      var hourAngle = ((h % 12) + m / 60) * 30 - 90;
      var minAngle = m * 6 - 90;
      var hourRad = hourAngle * Math.PI / 180;
      var minRad = minAngle * Math.PI / 180;
      var hx = cx + 28 * Math.cos(hourRad);
      var hy = cy + 28 * Math.sin(hourRad);
      var mx = cx + 42 * Math.cos(minRad);
      var my = cy + 42 * Math.sin(minRad);
      // 刻度
      var ticks = '';
      for (var i = 0; i < 12; i++) {
        var ang = (i * 30 - 90) * Math.PI / 180;
        var x1 = cx + 46 * Math.cos(ang);
        var y1 = cy + 46 * Math.sin(ang);
        var x2 = cx + 50 * Math.cos(ang);
        var y2 = cy + 50 * Math.sin(ang);
        ticks += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#2b3a55" stroke-width="2"/>';
      }
      return '<svg width="130" height="130" viewBox="0 0 130 130">' +
        '<circle cx="60" cy="60" r="54" fill="#fafbff" stroke="#c9d4e6" stroke-width="2"/>' +
        ticks +
        '<line x1="60" y1="60" x2="' + hx.toFixed(1) + '" y2="' + hy.toFixed(1) + '" stroke="#2b3a55" stroke-width="3.5" stroke-linecap="round"/>' +
        '<line x1="60" y1="60" x2="' + mx.toFixed(1) + '" y2="' + my.toFixed(1) + '" stroke="#e8870a" stroke-width="2.5" stroke-linecap="round"/>' +
        '<circle cx="60" cy="60" r="4" fill="#2b3a55"/>' +
        '</svg>';
    }

    if (variant === 1) {
      // 看钟面写时间
      return {
        kind: 'clockFace',
        variant: 'read',
        svg: clockSVG(hour, minute),
        hour: hour, minute: minute,
        question: '看钟面，现在是几时几分？',
        answer: hour + ':' + String(minute).padStart(2, '0'),
        hint: '短针是时针，长针是分针。分针指 ' + minute + ' 分时，时针在 ' + hour + ' 和 ' + (hour % 12 + 1) + ' 之间。',
        inputType: 'text'
      };
    }
    // 给时间，选正确的钟面（choice）
    var correctSVG = clockSVG(hour, minute);
    var distractors = [];
    for (var i = 0; i < 3; i++) {
      var dh = rnd(1, 12);
      var dm = pick([0, 15, 30, 45]);
      if (dh !== hour || dm !== minute) {
        distractors.push(clockSVG(dh, dm));
      }
    }
    var items = [correctSVG].concat(distractors).slice(0, 3);
    var options = shuffleArr(items);
    var correctIdx = options.indexOf(correctSVG);
    return {
      kind: 'clockFace',
      variant: 'match',
      svg: correctSVG,
      hour: hour, minute: minute,
      options: options,
      correctIdx: correctIdx,
      question: '下面哪个钟面显示的是 ' + hour + ':' + String(minute).padStart(2, '0') + '？',
      answer: String(correctIdx),
      hint: '时针指向 ' + hour + '，分针指向 ' + minute + ' 分的位置。',
      inputType: 'choice'
    };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 30) return buildYM();
    if (r <= 55) return buildCal();
    if (r <= 75) return buildAmpm();
    return buildClockFace();
  }

  function generateProblems(type, count) {
    var builder = { ym: buildYM, cal: buildCal, ampm: buildAmpm, clockFace: buildClockFace, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + (q.question || q.start || q.h24 || '') + '|' + q.answer;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderDateCard(p, i) {
    var inputHTML = '';
    if (p.inputType === 'choice') {
      var optsHTML = '';
      // clockFace match 模式：options 是 SVG 字符串，渲染为图片按钮
      if (p.kind === 'clockFace' && p.variant === 'match') {
        p.options.forEach(function (svg, idx) {
          optsHTML += '<button type="button" class="opt-btn" data-val="' + idx + '" onclick="window.__currentPlugin.__choose(this)" ' +
            'style="cursor:pointer;border:2px solid #d5dff0;background:#fafbff;border-radius:8px;padding:4px;margin:4px;transition:.15s;">' + svg + '</button>';
        });
      } else {
        p.options.forEach(function (o) {
          optsHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
            'style="cursor:pointer;border:1.5px solid #d5dff0;background:#fafbff;color:#2b3a55;border-radius:9px;padding:6px 14px;font-size:16px;font-weight:800;margin:3px;transition:.15s;">' + o + '</button>';
        });
      }
      inputHTML = '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optsHTML + '</div>' +
        '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">';
    } else {
      inputHTML = '<div class="input-group" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;">' +
        '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off">' +
        '</div>';
    }

    var hintHTML = p.hint ? '<div style="font-size:11px;color:#7a879c;margin-bottom:6px;">💡 ' + p.hint + '</div>' : '';

    var mid = '';
    if (p.svg) {
      mid = '<div class="q-shape" style="margin:4px auto 6px;">' + p.svg + '</div>';
    }

    return '<div class="question-card" data-index="' + i + '" style="border:1px solid #e3e9f2;border-radius:14px;padding:14px 12px;position:relative;text-align:center;background:#fff;box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<span class="num" style="position:absolute;left:8px;top:8px;width:20px;height:20px;border-radius:50%;background:#eef3fb;color:#5b8def;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</span>' +
      hintHTML +
      '<div style="font-size:15px;font-weight:800;color:#27324a;margin:4px 0 8px;">' + p.question + '</div>' +
      mid +
      inputHTML +
      '<div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:8px;"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkDateQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    if (q.inputType === 'choice') {
      var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
      // clockFace match: answer 存的是正确选项的索引字符串
      if (q.kind === 'clockFace' && q.variant === 'match') {
        return v === q.answer;
      }
      return _PU.normHZ(v) === _PU.normHZ(q.answer);
    }
    var val = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return String(val).replace(/\s/g, '') === String(q.answer).replace(/\s/g, '');
  }

  // ============ ExercisePlugin ============
  var mathTimeDatePlugin = {
    id: 'math-time-date',
    name: '时间与日期',
    grades: [3],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'timeDate' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',       label: '混合' },
          { value: 'ym',        label: '年月日' },
          { value: 'cal',       label: '经过时间' },
          { value: 'ampm',      label: '24时制' },
          { value: 'clockFace', label: '钟面读写' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', ym: '年月日', cal: '经过时间', ampm: '24时制', clockFace: '钟面读写' };
      var label = typeNames[type] || '混合';
      var questions = list.map(function (p) {
        return {
          type: 'time-date',
          kind: p.kind,
          data: p,
          answer: Array.isArray(p.answer) ? p.answer.join('、') : String(p.answer),
          hint: p.kind === 'cal' && p.variant === 'time' ? '都用分钟来算就方便啦。' :
                p.kind === 'cal' ? '同月内经过天数 = 后日期 − 前日期（开头那天不算）。' :
                p.kind === 'ym' ? '大月31天、小月30天；平年2月28天、闰年2月29天。' :
                p.kind === 'ampm' && p.variant === 'to24' ? '下午的时间在 12 时制上加 12 就是 24 时制。' :
                p.kind === 'ampm' && p.variant === 'to12' ? '24 时制超过 12 的部分减去 12，就是下午的时间。' :
                p.kind === 'ampm' ? '12 点以前是上午，12 点以后是下午。' :
                p.kind === 'clockFace' && p.variant === 'read' ? '短针是时针，长针是分针。看分针指在哪个数字上。' :
                p.kind === 'clockFace' ? '时针短、分针长。找到匹配的钟面。' : undefined,
          render: function (idx, ctx) { return renderDateCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkDateQuestion(this, userAnswers, idx); }
        };
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: '小学三年级时间与日期（' + label + '）' }
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
        var isRight = q.check ? q.check(userAnswers, i) : checkDateQuestion(q, userAnswers, i);
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
  global.__currentPlugin = mathTimeDatePlugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = mathTimeDatePlugin;

})(typeof window !== 'undefined' ? window : globalThis);