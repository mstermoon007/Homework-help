/**
 * plugins/math-make-ten.js — 拆十法（凑十/平十/破十）插件
 *
 * 迁移自 math-make-ten.html 内联脚本，提供 ExercisePlugin 接口
 * （id/name/grades/subject/generate/render/check）。
 * 随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-make-ten.js 依赖 shared/common.js（PluginUtil），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return _PU.rand(arr); }
  function shuffleArr(arr) { return _PU.shuffle(arr); }

  // ============ 难度（1-10，由 generate 设置） ============
  var _DIFF = 3;
  // 被减数上限：难度 3 基准 19（一年级 20 以内），难度越高数值越大
  function totalMax() { return Math.min(99, _PU.diffMax(19, _DIFF)); }

  // ============ SVG 分解图生成 ============
  function svgInput(idx, field, w, h) {
    return '<foreignObject x="0" y="0" width="' + w + '" height="' + h + '">' +
      '<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">' +
      '<input type="text" data-idx="' + idx + '" data-field="' + field + '" placeholder="?" autocomplete="off"' +
      ' style="width:' + (w - 4) + 'px;height:' + (h - 4) + 'px;border:2px dashed #ccc;border-radius:5px;font-size:14px;font-weight:700;text-align:center;color:#5b8def;background:#fafafa;outline:none;font-family:inherit;box-sizing:border-box;"/>' +
      '</div></foreignObject>';
  }

  // 凑十法：5+8=[__]，5分解为[__][__]
  function cushiFullSVG(big, small, need, rest, idx) {
    var w = 300, h = 155;
    var xSmall = 30, xBig = 92, xEq = 140, xAns = 174;
    var xSplitL = xSmall - 20, xSplitR = xSmall + 20;
    var inpW = 34, inpH = 26;
    return '<svg class="decomp-svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<text x="' + xSmall + '" y="22" class="num-big" text-anchor="middle">' + small + '</text>' +
      '<text x="' + (xSmall + 30) + '" y="22" class="num-big" text-anchor="middle" fill="#5b8def">+</text>' +
      '<text x="' + xBig + '" y="22" class="num-big" text-anchor="middle">' + big + '</text>' +
      '<text x="' + xEq + '" y="22" class="num-big" text-anchor="middle" fill="#7a879c">=</text>' +
      svgInput(idx, 'answer', 36, 26).replace(/x="0" y="0"/, 'x="' + xAns + '" y="8"') +
      '<line x1="' + xSmall + '" y1="32" x2="' + xSmall + '" y2="58" class="split-line"/>' +
      '<line x1="' + xSplitL + '" y1="58" x2="' + xSplitR + '" y2="58" class="split-line"/>' +
      '<line x1="' + xSplitL + '" y1="58" x2="' + xSplitL + '" y2="82" class="split-line"/>' +
      '<line x1="' + xSplitR + '" y1="58" x2="' + xSplitR + '" y2="82" class="split-line"/>' +
      '<line x1="' + xBig + '" y1="32" x2="' + xBig + '" y2="82" class="split-line"/>' +
      '<line x1="' + xBig + '" y1="72" x2="' + xSplitL + '" y2="72" class="split-line" stroke-dasharray="4,3"/>' +
      svgInput(idx, 'need', inpW, inpH).replace(/x="0" y="0"/, 'x="' + (xSplitL - inpW / 2) + '" y="64"') +
      svgInput(idx, 'rest', inpW, inpH).replace(/x="0" y="0"/, 'x="' + (xSplitR - inpW / 2) + '" y="64"') +
      '<text x="' + ((xBig + xSplitL) / 2) + '" y="96" class="num-small" text-anchor="middle" fill="#5b8def">' + big + '+?=10</text>' +
      '<text x="' + (w / 2) + '" y="118" class="num-small" text-anchor="middle" fill="#7a879c">看大数' + big + '，' + big + '+?=10，将' + small + '分成' + need + '和' + rest + '</text>' +
      '<text x="' + (w / 2) + '" y="136" class="num-small" text-anchor="middle" fill="#7a879c">' + big + '+' + need + '=10，10+' + rest + '=' + (big + small) + '</text>' +
      '</svg>';
  }

  // 平十法：15−7=[__]，15→5，7→5+2
  function pingshiFullSVG(total, sub, to10, rest, idx) {
    var w = 220, h = 100, x1 = 28, x2 = 84, x3 = 140, xAns = 168;
    return '<svg class="decomp-svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<text x="' + x1 + '" y="22" class="num-big" text-anchor="middle">' + total + '</text>' +
      '<text x="' + (x1 + 28) + '" y="22" class="num-big" text-anchor="middle" fill="#5b8def">−</text>' +
      '<text x="' + x2 + '" y="22" class="num-big" text-anchor="middle">' + sub + '</text>' +
      '<text x="' + x3 + '" y="22" class="num-big" text-anchor="middle" fill="#7a879c">=</text>' +
      svgInput(idx, 'answer', 36, 26).replace(/x="0" y="0"/, 'x="' + (xAns - 4) + '" y="8"') +
      '<line x1="' + x1 + '" y1="32" x2="' + x1 + '" y2="62" class="split-line"/>' +
      '<text x="' + x1 + '" y="80" class="num-mid" text-anchor="middle">' + to10 + '</text>' +
      '<line x1="' + x2 + '" y1="32" x2="' + x2 + '" y2="50" class="split-line"/>' +
      '<line x1="' + (x2 - 26) + '" y1="50" x2="' + (x2 + 26) + '" y2="50" class="split-line"/>' +
      '<line x1="' + (x2 - 26) + '" y1="50" x2="' + (x2 - 26) + '" y2="62" class="split-line"/>' +
      '<line x1="' + (x2 + 26) + '" y1="50" x2="' + (x2 + 26) + '" y2="62" class="split-line"/>' +
      '<text x="' + (x2 - 26) + '" y="80" class="num-mid" text-anchor="middle">' + to10 + '</text>' +
      '<text x="' + (x2 + 26) + '" y="80" class="num-mid" text-anchor="middle">' + rest + '</text>' +
      '</svg>';
  }

  // 破十法：13−5=[__]，13→10+3
  function poshiFullSVG(total, sub, to10, tenSub, idx) {
    var w = 220, h = 100, x1 = 28, x2 = 84, x3 = 140, xAns = 168;
    return '<svg class="decomp-svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
      '<text x="' + x1 + '" y="22" class="num-big" text-anchor="middle">' + total + '</text>' +
      '<text x="' + (x1 + 28) + '" y="22" class="num-big" text-anchor="middle" fill="#5b8def">−</text>' +
      '<text x="' + x2 + '" y="22" class="num-big" text-anchor="middle">' + sub + '</text>' +
      '<text x="' + x3 + '" y="22" class="num-big" text-anchor="middle" fill="#7a879c">=</text>' +
      svgInput(idx, 'answer', 36, 26).replace(/x="0" y="0"/, 'x="' + (xAns - 4) + '" y="8"') +
      '<line x1="' + x1 + '" y1="32" x2="' + x1 + '" y2="50" class="split-line"/>' +
      '<line x1="' + (x1 - 26) + '" y1="50" x2="' + (x1 + 26) + '" y2="50" class="split-line"/>' +
      '<line x1="' + (x1 - 26) + '" y1="50" x2="' + (x1 - 26) + '" y2="62" class="split-line"/>' +
      '<line x1="' + (x1 + 26) + '" y1="50" x2="' + (x1 + 26) + '" y2="62" class="split-line"/>' +
      '<text x="' + (x1 - 26) + '" y="80" class="num-mid" text-anchor="middle">10</text>' +
      '<text x="' + (x1 + 26) + '" y="80" class="num-mid" text-anchor="middle">' + to10 + '</text>' +
      '<line x1="' + x2 + '" y1="32" x2="' + x2 + '" y2="62" class="split-line"/>' +
      '<text x="' + x2 + '" y="80" class="num-mid" text-anchor="middle">' + tenSub + '</text>' +
      '</svg>';
  }

  // ============ 题目生成 ============
  function buildCushi() {
    var big = rnd(5, 9);
    var need = 10 - big;
    var small = rnd(Math.max(2, need), 9);
    var rest = small - need;
    return {
      kind: 'cushi', label: '凑十法',
      big: big, small: small, need: need, rest: rest,
      answer: big + small,
      decompInputs: [{ id: 'need', expect: need }, { id: 'rest', expect: rest }],
      combineInputs: [{ id: 'c_need', expect: need }, { id: 'c_rest', expect: rest }, { id: 'c_answer', expect: big + small }],
      combinePrefix: big + ' + ', combineMid: ' = 10，10 + ',
      hint: '看大数，想' + big + '加几为10？将' + small + '分成' + need + '和' + rest + '，' + big + '+' + need + '=10，10+' + rest + '=' + (big + small)
    };
  }

  function buildPingshi() {
    var total = rnd(11, totalMax());
    var to10 = total - 10;
    var sub = rnd(Math.max(2, to10 + 1), Math.min(9, total - 1));
    var rest = sub - to10;
    return {
      kind: 'pingshi', label: '平十法',
      total: total, sub: sub, to10: to10, rest: rest,
      answer: total - sub,
      decompInputs: [{ id: 'to10_left', expect: to10 }, { id: 'to10_right', expect: to10 }, { id: 'rest', expect: rest }],
      combineInputs: [{ id: 'c_to10', expect: to10 }, { id: 'c_rest', expect: rest }, { id: 'c_answer', expect: total - sub }],
      combinePrefix: total + ' − ', combineMid: ' = 10，10 − ',
      hint: '平十法：看减数，把减数拆成两部分，先减到10，再减去剩下的数。'
    };
  }

  function buildPoshi() {
    var total = rnd(11, totalMax());
    var to10 = total - 10;
    var sub = rnd(2, 9);
    var tenSub = 10 - sub;
    return {
      kind: 'poshi', label: '破十法',
      total: total, sub: sub, to10: to10, tenSub: tenSub,
      answer: total - sub,
      decompInputs: [{ id: 'ten', expect: 10 }, { id: 'to10', expect: to10 }, { id: 'tenSub', expect: tenSub }],
      combineInputs: [{ id: 'c_tenSub', expect: tenSub }, { id: 'c_answer', expect: total - sub }],
      combinePrefix: '10 − ' + sub + ' = ', combineMid: '，', combineSuffix: ' + ' + to10 + ' = ',
      hint: '破十法：把被减数拆成10和几，先用10去减，再把剩下的数加回来。'
    };
  }

  function buildMixed() {
    var r = _PU.randInt(1, 100);
    if (r <= 35) return buildCushi();
    if (r <= 65) return buildPingshi();
    return buildPoshi();
  }

  function generateProblems(type, count) {
    var builder = { cushi: buildCushi, pingshi: buildPingshi, poshi: buildPoshi, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 10, 200);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind === 'cushi' ? (q.kind + '|' + q.big + '+' + q.small) : (q.kind + '|' + q.total + '−' + q.sub);
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（拆解 SVG + 组合行，标准 Question.render） */
  function renderCard(p, i) {
    var svg;
    if (p.kind === 'cushi') svg = cushiFullSVG(p.big, p.small, p.need, p.rest, i);
    else if (p.kind === 'pingshi') svg = pingshiFullSVG(p.total, p.sub, p.to10, p.rest, i);
    else svg = poshiFullSVG(p.total, p.sub, p.to10, p.tenSub, i);

    var combineHTML;
    if (p.kind === 'poshi') {
      combineHTML = p.combinePrefix + '<input type="text" class="combine-inp" data-idx="' + i + '" data-field="c_tenSub" placeholder="?" autocomplete="off">' +
        p.combineMid + '<input type="text" class="combine-inp" data-idx="' + i + '" data-field="c_answer" placeholder="?" autocomplete="off">' + p.combineSuffix;
    } else {
      combineHTML = p.combinePrefix +
        '<input type="text" class="combine-inp" data-idx="' + i + '" data-field="' + p.combineInputs[0].id + '" placeholder="?" autocomplete="off">' + p.combineMid +
        '<input type="text" class="combine-inp" data-idx="' + i + '" data-field="' + p.combineInputs[1].id + '" placeholder="?" autocomplete="off"> = <input type="text" class="combine-inp" data-idx="' + i + '" data-field="' + p.combineInputs[2].id + '" placeholder="?" autocomplete="off">';
    }

    return '<div class="problem" data-i="' + i + '">' +
      '<div class="num">' + (i + 1) + '</div>' +
      '<div class="decomp-row">' + svg + '</div>' +
      '<div class="combine-row">' + combineHTML + '</div>' +
      '<div class="think-hint">' + p.hint + '</div>' +
      '<div class="feedback"></div>' +
      '</div>';
  }

  /** 单题判定（多输入：answer + decompInputs + combineInputs，标准 Question.check） */
  function checkMakeTenQuestion(question, userAnswers, idx) {
    var data = question.data;
    var allInputs = [{ id: 'answer', expect: data.answer }]
      .concat(data.decompInputs || [], data.combineInputs || []);
    for (var j = 0; j < allInputs.length; j++) {
      var key = idx + ':' + allInputs[j].id;
      var v = userAnswers && userAnswers[key] != null ? userAnswers[key] : '';
      if (String(v).trim() !== String(allInputs[j].expect)) return false;
    }
    return true;
  }

  // ============ ExercisePlugin ============
  var mathMakeTenPlugin = {
    id: 'math-make-ten',
    name: '凑十法',
    grades: [1, 2],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'makeTen' },

    generate: function (options) {
      var opts = options || {};
      _DIFF = _PU.diffLevel(opts.difficulty);
      var type = opts.type || 'cushi';
      var count = opts.count || 5;
      var list = generateProblems(type, count);
      var typeNames = { cushi: '凑十法', pingshi: '平十法', poshi: '破十法', mix: '混合练习' };
      var label = opts.label || typeNames[type] || type;
      var questions = list.map(function (p) {
        return {
          type: 'make-ten',
          kind: p.kind,
          data: p,
          answer: String(p.answer),
          hint: p.hint,
          render: function (idx, ctx) { return renderCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkMakeTenQuestion(this, userAnswers, idx); }
        };
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: '小学一年级' + label + '练习' }
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
        var isRight = q.check ? q.check(userAnswers, i) : checkMakeTenQuestion(q, userAnswers, i);
        if (isRight) correct++;
        results.push(isRight);
        correctAnswers.push(String(q.answer));
      });
      var total = exerciseSet.questions.length;
      var score = Math.round((correct / total) * 100);
      var message = '继续加油！';
      if (score === 100) message = '太棒了！全对！';
      else if (score >= 80) message = '很不错！';
      return { score: score, total: total, correct: correct, message: message, results: results, correctAnswers: correctAnswers };
    }
  };

  // ============ 导出 ============
  global.__currentPlugin = mathMakeTenPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathMakeTenPlugin;

})(typeof window !== 'undefined' ? window : globalThis);
