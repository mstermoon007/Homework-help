/**
 * plugins/math-number-sense.js — 数的认识插件（一年级：数数/顺序/组成/数位/比大小）
 *
 * 提供 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 供 practice.html / dev/plugin-check.html 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-number-sense.js 依赖 shared/common.js（PluginUtil），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  // ============ 难度（1-10，由 generate 设置） ============
  var _DIFF = 3;
  var _GRADE = 1;
  // 难度 → 数值上限（base 为难度 3 的基准）
  function diffMax(base) { return _PU.diffMax(base, _DIFF); }
  // 难度 → 十位上限（组成/数位题，难度越高允许更大的数）
  function tensMax() {
    if (_DIFF <= 4) return 1;
    if (_DIFF <= 6) return 4;
    if (_DIFF <= 8) return 6;
    return 9;
  }
  // 二年级：万以内数（9999）；一年级：百以内（99）
  function gradeMax() { return _GRADE >= 2 ? 9999 : 99; }

  // 数字 → 中文读法（用于 万以内 读写题）
  function numToChinese(n) {
    if (n === 0) return '零';
    var digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    var units = ['', '十', '百', '千'];
    var bigUnits = ['', '万'];
    var parts = [];
    var groups = []; // 每四位一组（低位在前）
    while (n > 0) { groups.push(n % 10000); n = Math.floor(n / 10000); }
    for (var gi = groups.length - 1; gi >= 0; gi--) {
      var g = groups[gi];
      var seg = '';
      var prevZero = false;
      var hasAny = false;
      var place = 0;
      var tmp = g;
      while (tmp > 0) {
        var d = tmp % 10;
        if (d === 0) {
          if (hasAny) prevZero = true;
        } else {
          if (prevZero) seg = '零' + seg;
          seg = digits[d] + units[place] + seg;
          hasAny = true;
          prevZero = false;
        }
        tmp = Math.floor(tmp / 10);
        place++;
      }
      if (gi < groups.length - 1 && g < 1000 && groups.length > 1 && g !== 0) seg = '零' + seg;
      parts.push(seg + bigUnits[gi]);
    }
    return parts.join('') || '零';
  }

  // 万以内随机数（可选到十位，二年级用）
  function randNum(max) {
    return rnd(1, max);
  }

  // ============ 数点 SVG（行布局：每行 5 个圆点） ============
  function dotsSVG(n) {
    var rows = Math.ceil(n / 5);
    var html = '<svg width="' + (rows > 1 ? 120 : Math.max(40, n * 22)) + '" height="' + (rows * 26 + 4) + '" viewBox="0 0 ' + (rows > 1 ? 120 : Math.max(40, n * 22)) + ' ' + (rows * 26 + 4) + '">';
    for (var i = 0; i < n; i++) {
      var x = 12 + (i % 5) * 24;
      var y = 14 + Math.floor(i / 5) * 26;
      html += '<circle cx="' + x + '" cy="' + y + '" r="9" fill="#5b8def" stroke="#3b5bdb" stroke-width="1.5"/>';
    }
    return html + '</svg>';
  }

  // ============ 题目生成 ============
  // 数数：展示 n 个圆点，数出总数（2~20）
  function buildCount() {
    var n = rnd(2, diffMax(20));
    return {
      kind: 'count',
      n: n,
      question: '数一数，一共有多少个圆点？',
      answer: String(n),
      inputType: 'text'
    };
  }

  // 顺序：给定一个数，写出前面/后面一个数（或填空）
  function buildOrder() {
    var variant = rnd(1, 3);
    var n = rnd(2, diffMax(19));
    if (variant === 1) {
      return {
        kind: 'order',
        variant: 'before',
        n: n,
        question: n + '的前一个数是几？',
        answer: String(n - 1),
        inputType: 'text'
      };
    }
    if (variant === 2) {
      return {
        kind: 'order',
        variant: 'after',
        n: n,
        question: n + '的后一个数是几？',
        answer: String(n + 1),
        inputType: 'text'
      };
    }
    // 数列填空：n-2、n-1、__、n+1
    var a = n - 2, b = n - 1, c = n + 1;
    return {
      kind: 'order',
      variant: 'seq',
      seq: [a, b, null, c],
      question: '按顺序在横线上填数：',
      answer: String(n),
      inputType: 'text'
    };
  }

  // 组成：几个十和几个一组成几（二年级：含百/千位）
  function buildCompose() {
    var variant = rnd(1, 2);
    var tens, ones, num;
    if (_GRADE >= 2) {
      var digits = [rnd(1, 9), rnd(1, 9), rnd(1, 9), rnd(1, 9)];
      num = digits[0] * 1000 + digits[1] * 100 + digits[2] * 10 + digits[3];
      var dT = Math.floor(num / 10) % 10, dO = num % 10, dH = Math.floor(num / 100) % 10, dTh = Math.floor(num / 1000) % 10;
      var desc = '';
      var blanks = [];
      var ansParts = [];
      if (dTh > 0) { desc += dTh + '个千'; blanks.push('个千'); ansParts.push(String(dTh)); }
      if (dH > 0) { desc += dH + '个百'; blanks.push('个百'); ansParts.push(String(dH)); }
      desc += dT + '个十'; blanks.push('个十'); ansParts.push(String(dT));
      desc += dO + '个一'; blanks.push('个一'); ansParts.push(String(dO));
      if (variant === 1) {
        return {
          kind: 'compose',
          variant: 'toNum',
          tens: tens, ones: ones, num: num, desc: desc,
          question: desc + '组成的数是几？',
          answer: String(num),
          inputType: 'text'
        };
      }
      return {
        kind: 'compose',
        variant: 'split',
        tens: tens, ones: ones, num: num, desc: desc,
        question: num + '里面有( )个千、( )个百、( )个十和( )个一。',
        answer: ansParts,
        inputType: 'multi',
        blanks: blanks
      };
    }
    tens = rnd(1, tensMax());
    ones = rnd(1, 9);
    num = tens * 10 + ones;    if (variant === 1) {
      return {
        kind: 'compose',
        variant: 'toNum',
        tens: tens, ones: ones, num: num,
        question: tens + '个十和' + ones + '个一组成的数是几？',
        answer: String(num),
        inputType: 'text'
      };
    }
    return {
      kind: 'compose',
      variant: 'split',
      tens: tens, ones: ones, num: num,
      question: num + '里面有( )个十和( )个一。',
      answer: [String(tens), String(ones)],
      inputType: 'multi',
      blanks: ['个十', '个一']
    };
  }

  // 数位：各位上的数字（二年级：含千/百位）
  function buildDigit() {
    var variant = rnd(1, 3);
    var num, place;
    if (_GRADE >= 2) {
      num = rnd(1000, gradeMax());
      var places = ['千位', '百位', '十位', '个位'];
      place = pick(places);
      if (variant === 3) {
        // 组合：给出各位上的数字
        var t = rnd(1, 9), h = rnd(1, 9), d = rnd(1, 9), o = rnd(1, 9);
        return {
          kind: 'digit',
          variant: 'combine',
          tens: d, ones: o,
          question: '一个四位数，千位上是' + t + '，百位上是' + h + '，十位上是' + d + '，个位上是' + o + '，这个数是几？',
          answer: String(t * 1000 + h * 100 + d * 10 + o),
          inputType: 'text'
        };
      }
      var digitVal = place === '千位' ? Math.floor(num / 1000) : place === '百位' ? Math.floor(num / 100) % 10 : place === '十位' ? Math.floor(num / 10) % 10 : num % 10;
      return {
        kind: 'digit',
        variant: place,
        num: num,
        question: num + '的' + place + '上是几？',
        answer: String(digitVal),
        inputType: 'text'
      };
    }
    num = rnd(11, diffMax(19));
    var tens = Math.floor(num / 10);
    var ones = num % 10;
    if (variant === 1) {
      return {
        kind: 'digit',
        variant: 'tens',
        num: num,
        question: num + '的十位上是几？',
        answer: String(tens),
        inputType: 'text'
      };
    }
    if (variant === 2) {
      return {
        kind: 'digit',
        variant: 'ones',
        num: num,
        question: num + '的个位上是几？',
        answer: String(ones),
        inputType: 'text'
      };
    }
    // 组合：十位是 t、个位是 o，这个数是？
    var t = rnd(1, tensMax()), o = rnd(0, 9);
    return {
      kind: 'digit',
      variant: 'combine',
      tens: t, ones: o,
      question: '一个数，十位上是' + t + '，个位上是' + o + '，这个数是几？',
      answer: String(t * 10 + o),
      inputType: 'text'
    };
  }

  // 比大小：两数比较，选 > < =（二年级：万以内）
  function buildCompare() {
    var maxN = _GRADE >= 2 ? diffMax(9999) : diffMax(20);
    var a = rnd(1, maxN), b = rnd(1, maxN);
    if (a === b) b = (b === maxN) ? maxN - 1 : b + 1;
    var symbol = a > b ? '>' : (a < b ? '<' : '=');
    return {
      kind: 'compare',
      a: a, b: b, symbol: symbol,
      question: '比较大小，在〇里填上“>”“<”或“=”。',
      expr: a + ' 〇 ' + b,
      answer: symbol,
      options: shuffleArr(['>', '<', '=']),
      inputType: 'choice'
    };
  }

  // 二年级：读写题（给出数字写读法 / 给出读法写数字）
  function buildReadWrite() {
    var min = _GRADE >= 2 ? 100 : 2;
    var num = rnd(min, gradeMax());
    var variant = rnd(1, 2);
    if (variant === 1) {
      // 数字 → 读作
      return {
        kind: 'readwrite',
        variant: 'toChinese',
        num: num,
        question: '写出 ' + num + ' 的读法：',
        answer: numToChinese(num),
        inputType: 'text'
      };
    }
    // 读法 → 数字
    return {
      kind: 'readwrite',
      variant: 'toNum',
      num: num,
      chinese: numToChinese(num),
      question: '写出下面这个数的数字：' + numToChinese(num),
      answer: String(num),
      inputType: 'text'
    };
  }

  // 二年级：近似数（估成整十/整百/整千）
  function buildApprox() {
    var maxN = gradeMax();
    var roundTo = rnd(1, 3) === 1 ? 10 : (rnd(1, 2) === 1 ? 100 : 1000);
    if (roundTo >= maxN) roundTo = 100;
    var base = rnd(1, Math.floor(maxN / roundTo)) * roundTo;
    var num = base + rnd(1, roundTo - 1);
    var approx = Math.round(num / roundTo) * roundTo;
    if (approx > maxN) approx = maxN;
    return {
      kind: 'approx',
      num: num, roundTo: roundTo, approx: approx,
      question: num + ' 大约是几？（精确到' + (roundTo >= 1000 ? '千位' : (roundTo >= 100 ? '百位' : '十位')) + '）',
      answer: String(approx),
      options: shuffleArr([String(approx), String(approx - roundTo), String(approx + roundTo)].filter(function (x) { return x >= 0; })),
      inputType: 'choice'
    };
  }

  // ===== 三年级：分数的初步认识 =====
  // 分数条：一个长方形平均分成 d 份，涂了 n 份（SVG 可视化）
  function fractionBarSVG(n, d) {
    var w = 220, h = 34, seg = w / d;
    var html = '<svg width="' + w + '" height="' + (h + 8) + '" viewBox="0 0 ' + w + ' ' + (h + 8) + '">';
    for (var i = 0; i < d; i++) {
      var fill = i < n ? '#5b8def' : '#e8eefb';
      html += '<rect x="' + (i * seg) + '" y="4" width="' + seg + '" height="' + h + '" fill="' + fill + '" stroke="#3b5bdb" stroke-width="1.5"/>';
    }
    return html + '</svg>';
  }

  function buildFraction() {
    var variant = rnd(1, 3);
    var d = pick([2, 3, 4, 5, 6, 8]);
    var n = rnd(1, d - 1);
    if (variant === 1) {
      // 涂色部分用分数表示
      return {
        kind: 'fraction',
        variant: 'shape',
        n: n, d: d,
        svg: fractionBarSVG(n, d),
        question: '涂色部分用分数表示是（  ）',
        answer: n + '/' + d,
        inputType: 'text'
      };
    }
    if (variant === 2) {
      // 几分之几里有多少个分数单位：3/5 里面有（ ）个 1/5
      var units = rnd(1, d - 1);
      return {
        kind: 'fraction',
        variant: 'units',
        d: d, units: units,
        question: units + '/' + d + ' 里面有（ ）个 1/' + d,
        answer: String(units),
        inputType: 'text'
      };
    }
    // 同分母分数比大小：1/3 〇 2/3
    var a = rnd(1, d - 2);
    var b = rnd(a + 1, d - 1);
    return {
      kind: 'fraction',
      variant: 'compare',
      a: a, b: b, d: d,
      question: '比较大小，在〇里填上“>”“<”或“=”。',
      expr: a + '/' + d + ' 〇 ' + b + '/' + d,
      answer: '<',
      options: shuffleArr(['>', '<', '=']),
      inputType: 'choice'
    };
  }

  // ===== 三年级：小数的初步认识 =====
  function buildDecimal() {
    var variant = rnd(1, 3);
    if (variant === 1) {
      // 元角互化：3 元 5 角 = ? 元
      var yuan = rnd(1, 9), jiao = pick([2, 5, 8, 3, 6]);
      return {
        kind: 'decimal',
        variant: 'money',
        yuan: yuan, jiao: jiao,
        question: yuan + '元' + jiao + '角 = ? 元',
        answer: (yuan + jiao / 10).toFixed(1),
        inputType: 'text'
      };
    }
    if (variant === 2) {
      // 几个 0.1：4 个 0.1 是（  ）
      var cnt = rnd(1, 9), tenth = rnd(1, 9);
      var tenths = rnd(1, 9);
      return {
        kind: 'decimal',
        variant: 'tenths',
        tenths: tenths,
        question: tenths + ' 个 0.1 是（  ）',
        answer: (tenths / 10).toFixed(1),
        inputType: 'text'
      };
    }
    // 一位小数比大小：0.6 〇 0.9
    var x = rnd(1, 9), y = rnd(1, 9);
    if (x === y) y = (y === 9) ? 8 : y + 1;
    return {
      kind: 'decimal',
      variant: 'compare',
      x: x, y: y,
      question: '比较大小，在〇里填上“>”“<”或“=”。',
      expr: '0.' + x + ' 〇 0.' + y,
      answer: x > y ? '>' : '<',
      options: shuffleArr(['>', '<', '=']),
      inputType: 'choice'
    };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (_GRADE >= 3) {
      // 三年级：万以内为主，穿插分数/小数初步认识
      if (r <= 18) return buildFraction();
      if (r <= 36) return buildDecimal();
      if (r <= 55) return buildCompose();
      if (r <= 70) return buildReadWrite();
      if (r <= 80) return buildApprox();
      if (r <= 90) return buildCompare();
      return buildDigit();
    }
    if (_GRADE >= 2) {
      if (r <= 25) return buildCompose();
      if (r <= 50) return buildReadWrite();
      if (r <= 65) return buildApprox();
      if (r <= 85) return buildCompare();
      return buildDigit();
    }
    if (r <= 20) return buildCount();
    if (r <= 40) return buildOrder();
    if (r <= 60) return buildCompose();
    if (r <= 80) return buildDigit();
    return buildCompare();
  }

  function generateProblems(type, count) {
    var builders = { count: buildCount, order: buildOrder, compose: buildCompose, digit: buildDigit, compare: buildCompare, readwrite: buildReadWrite, approx: buildApprox, fraction: buildFraction, decimal: buildDecimal, mix: buildMixed };
    var builder = builders[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + (q.a || q.n || q.num || q.tens || q.seq || q.chinese || q.roundTo) + '|' + (q.b || '') + '|' + (q.answer || '');
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderCard(p, i) {
    var mid = '';
    if (p.kind === 'count') {
      mid = '<div style="display:flex;justify-content:center;margin:6px 0;">' + dotsSVG(p.n) + '</div>';
    } else if (p.kind === 'fraction' && p.variant === 'shape') {
      mid = '<div style="display:flex;justify-content:center;margin:6px 0;">' + p.svg + '</div>';
    } else if (p.kind === 'order' && p.variant === 'seq') {
      mid = '<div style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:20px;font-weight:800;color:#27324a;margin:8px 0;">' +
        p.seq.map(function (v) {
          if (v == null) return '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off">';
          return '<span>' + v + '</span>';
        }).join('<span style="color:#c3ccd8;">、</span>') + '</div>';
    } else if (p.kind === 'compare' || (p.kind === 'fraction' && p.variant === 'compare') || (p.kind === 'decimal' && p.variant === 'compare')) {
      mid = '<div style="font-size:26px;font-weight:800;color:#27324a;margin:8px 0;">' +
        p.expr.replace('〇', '<span style="color:#e8870a;">〇</span>') + '</div>';
    }

    var inputHTML = '';
    if (p.inputType === 'choice') {
      var optsHTML = '';
      p.options.forEach(function (o) {
        optsHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
          'style="cursor:pointer;border:1.5px solid #d5dff0;background:#fafbff;color:#2b3a55;border-radius:9px;padding:6px 14px;font-size:16px;font-weight:800;margin:3px;transition:.15s;">' + o + '</button>';
      });
      inputHTML = '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optsHTML + '</div>' +
        '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">';
    } else if (p.inputType === 'multi') {
      var blanksHTML = '';
      p.blanks.forEach(function (label, j) {
        blanksHTML += '<input type="text" class="answer-inp" data-idx="' + i + '" data-field="' + j + '" placeholder="?" autocomplete="off" style="width:48px;height:32px;border:2px dashed #ccc;border-radius:7px;font-size:15px;font-weight:700;text-align:center;color:#3f6fd1;background:#fafafa;outline:none;margin:0 4px;">' + label;
      });
      inputHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:2px;margin-top:6px;">' + blanksHTML + '</div>';
    } else {
      inputHTML = '<div class="input-group" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;">' +
        '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off">' +
        '</div>';
    }

    var hintHTML = p.hint ? '<div style="font-size:11px;color:#7a879c;margin-bottom:6px;">💡 ' + p.hint + '</div>' : '';

    return '<div class="question-card" data-index="' + i + '" style="border:1px solid #e3e9f2;border-radius:14px;padding:14px 12px;position:relative;text-align:center;background:#fff;box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<span class="num" style="position:absolute;left:8px;top:8px;width:20px;height:20px;border-radius:50%;background:#eef3fb;color:#5b8def;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</span>' +
      hintHTML +
      '<div style="font-size:15px;font-weight:800;color:#27324a;margin:4px 0 6px;">' + (p.question || '') + '</div>' +
      mid +
      inputHTML +
      '<div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:8px;"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    if (q.inputType === 'choice') {
      var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
      return v === q.answer;
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
  var mathNumberSensePlugin = {
    id: 'math-number-sense',
    name: '数的认识',
    grades: [1, 2, 3],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'numberSense' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',       label: '混合' },
          { value: 'count',     label: '数数' },
          { value: 'order',     label: '顺序' },
          { value: 'compose',   label: '组成' },
          { value: 'digit',     label: '数位' },
          { value: 'compare',   label: '比大小' },
          { value: 'readwrite', label: '读写' },
          { value: 'approx',    label: '近似数' },
          { value: 'fraction',  label: '分数的初步认识' },
          { value: 'decimal',   label: '小数的初步认识' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      _DIFF = _PU.diffLevel(opts.difficulty);
      _GRADE = opts.grade || 1;
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', count: '数数', order: '顺序', compose: '组成', digit: '数位', compare: '比大小', readwrite: '读写', approx: '近似数', fraction: '分数的初步认识', decimal: '小数的初步认识' };
      var label = typeNames[type] || '混合';
      var gradeName = { 1: '一', 2: '二', 3: '三' }[_GRADE] || '三';
      var questions = list.map(function (p) {
        return {
          type: 'number-sense',
          kind: p.kind,
          data: p,
          answer: Array.isArray(p.answer) ? p.answer.join('、') : String(p.answer),
          hint: p.kind === 'compare' ? '先比较两个数的大小，再选符号。' :
                p.kind === 'fraction' ? (p.variant === 'compare' ? '分母相同，分子大的分数大。' : '把这个整体平均分成若干份，取其中的几份就是几分之几。') :
                p.kind === 'decimal' ? (p.variant === 'compare' ? '先比较整数部分，再比较十分位。' : '十分位上的数表示几个 0.1。') :
                p.kind === 'count' ? '一个一个地点着数，数到最后一个就是总数。' :
                p.kind === 'compose' ? '几个十是几十，几个一是几，合起来就是答案。' :
                p.kind === 'approx' ? '看这个数离哪个整十/整百/整千更近，就大约是几。' : undefined,
          render: function (idx, ctx) { return renderCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkQuestion(this, userAnswers, idx); }
        };
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: '小学' + gradeName + '年级数的认识（' + label + '）' }
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
        btns[i].style.background = '#fafbff';
        btns[i].style.borderColor = '#d5dff0';
      }
      btn.style.background = '#5b8def';
      btn.style.borderColor = '#3b5bdb';
      btn.style.color = '#fff';
    }
  };

  // ============ 导出 ============
  global.__currentPlugin = mathNumberSensePlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathNumberSensePlugin;

})(typeof window !== 'undefined' ? window : globalThis);
