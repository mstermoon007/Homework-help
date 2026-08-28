// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g5-c6.js — 五年级竞赛 C6 工程与浓度（新语义题型）
// 实现题型（type 与知识库一致）：
//   work           工程问题   总量设 1，效率=1/时间；合作 / 先做再合作
//   concentration  浓度问题   浓度=溶质/溶液；求含率 / 求溶质 / 加水稀释 / 混合
//
// 设计要点：所有参数经构造保证结果为整数（合作天数、百分数等），答案唯一。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g5-c6.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
      answer: cfg.answer,
      inputType: 'multi',
      inputCount: cfg.answer.length,
      hint: cfg.hint,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  /** 难度 → 规模 */
  function scale(lv) {
    if (lv >= 8) return { dmax: 30, kmax: 12, pctMax: 40 };
    if (lv >= 5) return { dmax: 24, kmax: 9, pctMax: 30 };
    return { dmax: 16, kmax: 6, pctMax: 20 };
  }

  // ============ 1. 工程问题 ============
  /** 独做天数对 → 合作天数为整数的候选池。
   *  由 (a-t)(b-t)=t^2 构造，保证合作天数 t 为整数，池远大于原固定列表。 */
  var WORK_PAIRS = (function () {
    var arr = [];
    for (var t = 2; t <= 20; t++) {
      var ts = t * t;
      for (var u = 1; u <= ts; u++) {
        if (ts % u === 0) {
          var a = u + t, b = ts / u + t;
          if (a <= 60 && b <= 60) arr.push([a, b]);
        }
      }
    }
    return arr;
  })();
  function coopDays(p) { return p[0] * p[1] / (p[0] + p[1]); }

  function genWork(sc) {
    if (_PU.randInt(0, 1) === 0) {
      // 类型1：直接求合作时间
      var pair = WORK_PAIRS[_PU.randInt(0, Math.min(WORK_PAIRS.length - 1, sc.dmax > 20 ? 99 : 11))];
      var t = coopDays(pair);
      var names = ['甲', '乙'];
      if (_PU.randInt(0, 1)) pair = [pair[1], pair[0]];
      return fillQ({
        type: 'work',
        text: '一项工程，' + names[0] + '独做需要 ' + pair[0] + ' 天完成，' + names[1] + '独做需要 ' + pair[1] +
          ' 天完成。两人合作，多少天可以完成？',
        answer: [t],
        hint: '合作效率 = 1/' + pair[0] + ' + 1/' + pair[1] + ' = ' + (pair[0] + pair[1]) + '/' + (pair[0] * pair[1]) +
          '，合作天数 = 1 ÷ 合作效率 = ' + (pair[0] * pair[1]) + ' ÷ ' + (pair[0] + pair[1]) + ' = ' + t + ' 天'
      });
    }
    // 类型2：甲先做若干天，剩下合作
    for (var t = 0; t < 100; t++) {
      var p = WORK_PAIRS[_PU.randInt(0, WORK_PAIRS.length - 1)];
      var d1 = p[0], d2 = p[1];
      var xs = [];
      for (var x = 1; x < d1; x++) {
        var days = (d1 - x) * d2 / (d1 + d2);
        if (days > 0 && days === Math.floor(days)) xs.push([x, days]);
      }
      if (!xs.length) continue;
      var pick = xs[_PU.randInt(0, xs.length - 1)];
      return fillQ({
        type: 'work',
        text: '一项工程，甲独做需要 ' + d1 + ' 天完成，乙独做需要 ' + d2 + ' 天完成。甲先单独做 ' + pick[0] +
          ' 天，剩下的由甲乙合作完成，还需要多少天？',
        answer: [pick[1]],
        hint: '甲先完成 ' + pick[0] + '/' + d1 + '，剩 ' + (d1 - pick[0]) + '/' + d1 +
          '；合作效率 = ' + (d1 + d2) + '/' + (d1 * d2) + '，还需 (' + (d1 - pick[0]) + '/' + d1 + ') ÷ (' + (d1 + d2) + '/' + (d1 * d2) + ') = ' + pick[1] + ' 天'
      });
    }
    return genWork(scale(5));
  }

  // ============ 2. 浓度问题 ============
  function genConcentration(sc) {
    var mode = _PU.randInt(0, 3);
    if (mode === 0) {
      // 已知盐与水，求含盐率
      var p = _PU.randInt(4, sc.pctMax);
      var salt = p * _PU.randInt(2, sc.kmax);          // 保证整数
      var total = salt * 100 / p;                       // 溶液总质量
      var water = total - salt;
      if (water <= 0 || water !== Math.floor(water)) return genConcentration(scale(5));
      return fillQ({
        type: 'concentration',
        text: '把 ' + salt + ' 克盐完全溶解在 ' + water + ' 克水中，盐水的含盐率是多少？（只填数字，不含 % 号）',
        answer: [p],
        hint: '含盐率 = 盐 ÷ 盐水 ×100% = ' + salt + ' ÷ ' + (salt + water) + ' ×100% = ' + p + '%'
      });
    }
    if (mode === 1) {
      // 已知含率与溶液质量，求溶质（构造 W 使溶质为整数）
      var p1 = _PU.randInt(5, sc.pctMax);
      var g = (function gcd(a, b) { return b ? gcd(b, a % b) : a; })(p1, 100);
      var step = 100 / g;
      var W = step * _PU.randInt(2, sc.kmax);
      var salt1 = W * p1 / 100;
      if (salt1 !== Math.floor(salt1)) return genConcentration(scale(5));
      return fillQ({
        type: 'concentration',
        text: '一杯糖水重 ' + W + ' 克，含糖率为 ' + p1 + '%。这杯糖水中含糖多少克？',
        answer: [Math.round(salt1)],
        hint: '含糖量 = 糖水质量 × 含糖率 = ' + W + ' × ' + p1 + '% = ' + Math.round(salt1) + ' 克'
      });
    }
    if (mode === 2) {
      // 加水稀释，求新浓度（或反求加水量）
      var askWater = _PU.randInt(0, 1) === 0 && lvHigh(sc);
      for (var s = 10; s <= 400; s += 10) { // 枚举盐量使各量均为整数
        var pA = _PU.randInt(10, sc.pctMax + 10), pB = _PU.randInt(2, Math.max(3, pA - 4));
        var M1 = s * 100 / pA, M2 = s * 100 / pB;
        if (M1 !== Math.floor(M1) || M2 !== Math.floor(M2)) continue;
        var addW = M2 - M1;
        if (addW <= 0 || addW !== Math.floor(addW)) continue;
        if (askWater) {
          return fillQ({
            type: 'concentration',
            text: '有含盐率为 ' + pA + '% 的盐水 ' + M1 + ' 克。要把它稀释成含盐率 ' + pB + '% 的盐水，需要加入多少克水？',
            answer: [addW],
            hint: '加水前后盐不变（' + s + ' 克）：稀释后盐水总量 = ' + s + ' ÷ ' + pB + '% = ' + M2 + ' 克，加水量 = ' + M2 + ' − ' + M1 + ' = ' + addW + ' 克'
          });
        }
        return fillQ({
          type: 'concentration',
          text: '有含盐率为 ' + pA + '% 的盐水 ' + M1 + ' 克，加入 ' + addW + ' 克水后，含盐率变为多少？（只填数字，不含 % 号）',
          answer: [pB],
          hint: '盐不变仍为 ' + s + ' 克，盐水变为 ' + M1 + ' + ' + addW + ' = ' + M2 + ' 克，含盐率 = ' + s + ' ÷ ' + M2 + ' ×100% = ' + pB + '%'
        });
      }
      return genConcentration(scale(5));
    }
    // 混合两种盐水求新浓度
    for (var w = 20; w <= 500; w += 10) {
      var pa = _PU.randInt(4, sc.pctMax), pb = _PU.randInt(2, Math.max(3, pa - 3));
      var wa = w * _PU.randInt(1, 4), wb = w;
      var sa = wa * pa / 100, sb = wb * pb / 100;
      var tot = wa + wb, st = sa + sb;
      var pc = st * 100 / tot;
      if (sa !== Math.floor(sa) || sb !== Math.floor(sb) || pc !== Math.floor(pc)) continue;
      return fillQ({
        type: 'concentration',
        text: '把含盐率为 ' + pa + '% 的盐水 ' + wa + ' 克与含盐率为 ' + pb + '% 的盐水 ' + wb +
          ' 克混合在一起，混合后盐水的含盐率是多少？（只填数字，不含 % 号）',
        answer: [Math.round(pc)],
        hint: '盐共 ' + Math.round(st) + ' 克，盐水共 ' + tot + ' 克，含盐率 = ' + Math.round(st) + ' ÷ ' + tot + ' ×100% = ' + Math.round(pc) + '%'
      });
    }
    return genConcentration(scale(5));
  }
  function lvHigh(sc) { return sc.dmax >= 24; }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = scale(lv);
    var type = opts.type || 'mix';
    var keys = type === 'mix' ? ['work', 'concentration'] : [type];
    var count = opts.count || 10;
    var genMap = {
      work: function () { return genWork(sc); },
      concentration: function () { return genConcentration(sc); }
    };
    var questions = [], seen = {}, MAXTRY = count * 50;
    for (var i = 0; i < count; i++) {
      var key = keys[i % keys.length];
      var q = null;
      for (var tries = 0; tries < MAXTRY; tries++) {
        q = genMap[key]();
        if (q && !seen[q.q]) break;
      }
      if (q) { seen[q.q] = true; questions.push(q); }
    }
    return questions;
  }

  // ============ 注册 ============
  var plugin = _PU.createPlugin({
    id: 'math-competition-g5-c6',
    name: '工程与浓度（五年级）',
    subject: 'math',
    category: 'number',
    grades: [5],
    moduleId: 'C6',
    knowledgePoints: {
      5: ['math-g5-c6-work-problem', 'math-g5-c6-concentration-problem']
    },
    columns: 1,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',           label: '综合' },
        { value: 'work',          label: '工程问题' },
        { value: 'concentration', label: '浓度问题' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 5, count: (opts && opts.count) || 10, columns: 1, title: '工程与浓度（五年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
