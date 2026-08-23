// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g6-c6.js — 六年级竞赛 C6 工程与浓度（新语义题型）
// 实现题型（type 与知识库一致）：
//   work          工程问题（合作完工 / 先单独后合作 / 中途休息）
//   concentration 浓度问题（加水稀释 / 加糖变浓 / 两溶液混合）
// 设计要点：工程题把总量设为「天数乘积」保证整数运算；
// 浓度题从目标浓度反推参数，确保答案为正整数百分比。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g6-c6.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
      answer: cfg.answer,
      inputType: cfg.single ? 'text' : 'multi',
      inputCount: cfg.single ? undefined : cfg.answer.length,
      hint: cfg.hint,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }

  // ============ 1. 工程问题 ============

  /** 构造：甲 a 天、乙 b 天单独完成，合作天数 t=a*b/(a+b) 为整数 */
  function pickCoopPair() {
    for (var t = 4; t <= 15; t++) {
      var cands = [];
      for (var a = t + 1; a <= 4 * t; a++) {
        var num = a * t, den = a - t;
        if (num % den === 0) {
          var b = num / den;
          if (b > a && b <= 40) cands.push([a, b]);
        }
      }
      if (cands.length) return cands[_PU.randInt(0, cands.length - 1)].concat([t]);
    }
    return [6, 12, 4];
  }

  function genWork(sc) {
    var mode = _PU.randInt(0, 2);
    var pair = pickCoopPair();
    var a = pair[0], b = pair[1];
    if (mode === 0) {
      var t = pair[2];
      return fillQ({
        type: 'work',
        text: '一项工程，甲队单独做需要 ' + a + ' 天完成，乙队单独做需要 ' + b + ' 天完成。两队合作，需要 ____ 天完成。',
        answer: [pair[2]],
        hint: '设总量为 ' + (a * b) + '：甲每天 ' + (b) + '、乙每天 ' + (a) + '，合作每天 ' + (a + b) +
          ' → ' + (a * b) + '÷' + (a + b) + ' = ' + t + ' 天'
      });
    }
    if (mode === 1) {
      // 甲先做 m 天，再两队合作 d 天恰好完成：d = (1 - m/a) ÷ (1/a + 1/b)
      var W = a * b;
      for (var m = 1; m < a - 1; m++) {
        var remain = W - m * b;               // 甲每天做 W/a=b 份
        var rate = a + b;                      // 合作每天 a+b 份
        if (remain > 0 && remain % rate === 0) {
          var d = remain / rate;
          if (d >= 2 && d <= 12) {
            return fillQ({
              type: 'work',
              text: '一项工程，甲队单独做需要 ' + a + ' 天完成，乙队单独做需要 ' + b +
                ' 天完成。甲队先单独做了 ' + m + ' 天后，乙队加入一起做。还需要 ____ 天才能完成。',
              answer: [d],
              hint: '设总量为 ' + W + '：甲每天做 ' + b + '，先做 ' + m + ' 天剩 ' + remain +
                '；合作每天做 ' + rate + ' → 还需 ' + remain + '÷' + rate + '=' + d + ' 天'
            });
          }
        }
      }
      // 未找到合适的 m 则退化为合作模式
      return fillQ({
        type: 'work',
        text: '一项工程，甲队单独做需要 ' + a + ' 天完成，乙队单独做需要 ' + b + ' 天完成。两队合作，需要 ____ 天完成。',
        answer: [pair[2]],
        hint: '设总量为 ' + W + '：合作每天 ' + (a + b) + ' → ' + W + '÷' + (a + b) + ' = ' + pair[2] + ' 天'
      });
    }
    // 中途休息：甲实际工作 T-k 天、乙全程 T 天完成
    for (var T = Math.max(a, b) + 1; T <= 30; T++) {
      var total = a * b;
      var needA = total - T * (total / b);
      if (needA > 0 && needA % (total / a) === 0) {
        var daysA = needA / (total / a);
        var rest = T - daysA;
        if (rest >= 1 && rest < T) {
          return fillQ({
            type: 'work',
            text: '一项工程，甲队单独做需要 ' + a + ' 天完成，乙队单独做需要 ' + b +
              ' 天完成。两队同时开工，中途甲队离开休息了几天，前后共用了 ' + T + ' 天完工。甲队休息了 ____ 天。',
            answer: [rest],
            hint: '设总量为 ' + total + '：乙全程做了 ' + T + '×' + (total / b) + '=' + (T * total / b) +
              '，剩余由甲完成 → 甲实做 ' + daysA + ' 天 → 休息 ' + rest + ' 天'
          });
        }
      }
    }
    // 兜底：合作模式
    return fillQ({
      type: 'work',
      text: '一项工程，甲队单独做需要 ' + a + ' 天完成，乙队单独做需要 ' + b + ' 天完成。两队合作，需要 ____ 天完成。',
      answer: [pair[2]],
      hint: '设总量为 ' + (a * b) + '：合作每天 ' + (a + b) + ' → ' + (a * b) + '÷' + (a + b) + ' = ' + pair[2] + ' 天'
    });
  }

  // ============ 2. 浓度问题 ============
  function genConcentration() {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      // 加水稀释
      var sugar = _PU.randInt(10, 60);
      var water0 = sugar * _PU.randInt(1, 3);
      for (var add = 20; add <= 300; add += 5) {
        var conc = sugar * 100 / (sugar + water0 + add);
        if (conc >= 1 && Number.isInteger(conc)) {
          var c0 = sugar * 100 / (sugar + water0);
          return fillQ({
            type: 'concentration',
            text: '一杯糖水 ' + (sugar + water0) + ' 克，含糖 ' + sugar + ' 克。向杯中加入 ' + add +
              ' 克水后，糖水的浓度是百分之几？（只填百分号前的数字）____',
            answer: [conc],
            hint: '糖不变仍为 ' + sugar + ' 克：浓度 = ' + sugar + '÷' + (sugar + water0 + add) +
              ' ≈ ' + conc + '%（原浓度 ' + c0.toFixed(0) + '%）'
          });
        }
      }
    }
    if (mode === 1) {
      // 加糖变浓
      var s2 = _PU.randInt(15, 50);
      var w2 = s2 * _PU.randInt(2, 4);
      for (var adds = 5; adds <= 100; adds += 5) {
        var conc2 = (s2 + adds) * 100 / (s2 + adds + w2);
        if (Number.isInteger(conc2) && conc2 <= 60) {
          var c02 = s2 * 100 / (s2 + w2);
          return fillQ({
            type: 'concentration',
            text: '一杯糖水 ' + (s2 + w2) + ' 克，含糖 ' + s2 + ' 克。加入 ' + adds +
              ' 克糖并全部溶解后，糖水的浓度是百分之几？（只填百分号前的数字）____',
            answer: [conc2],
            hint: '糖变为 ' + (s2 + adds) + ' 克，总重变为 ' + (s2 + adds + w2) + ' 克：' +
              (s2 + adds) + '÷' + (s2 + adds + w2) + ' = ' + conc2 + '%（原浓度 ' + c02.toFixed(0) + '%）'
          });
        }
      }
    }
    // 混合两种溶液
    for (var tries = 0; tries < 200; tries++) {
      var cA = _PU.randInt(10, 30), cB = _PU.randInt(45, 70);
      var mA = _PU.randInt(2, 9) * 20, mB = _PU.randInt(2, 9) * 20;
      var mixC = (cA * mA + cB * mB) * 100 / ((mA + mB) * 100);
      if (Number.isInteger(mixC)) {
        return fillQ({
          type: 'concentration',
          text: '有甲、乙两种盐水：甲种浓度 ' + cA + '%，重 ' + mA + ' 克；乙种浓度 ' + cB + '%，重 ' + mB +
            ' 克。把它们混合后，盐水的浓度是百分之几？（只填百分号前的数字）____',
          answer: [mixC],
          hint: '盐量 = ' + cA + '%×' + mA + '+' + cB + '%×' + mB + '=' + (cA * mA / 100 + cB * mB / 100) +
            ' 克，总重 ' + (mA + mB) + ' 克 → 浓度 = ' + mixC + '%'
        });
      }
    }
    // 稳妥兜底（必然整数）
    return fillQ({
      type: 'concentration',
      text: '有甲、乙两种盐水：甲种浓度 20%，重 100 克；乙种浓度 50%，重 150 克。把它们混合后，盐水的浓度是百分之几？（只填百分号前的数字）____',
      answer: [38],
      hint: '盐量 = 20%×100＋50%×150 = 95 克，总重 250 克 → 浓度 = 95÷250 = 38%'
    });
  }

  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = { big: lv >= 8 };
    var type = opts.type || 'mix';
    var keys = type === 'mix' ? ['work', 'concentration'] : [type];
    var count = opts.count || 10;
    var genMap = {
      work: function () { return genWork(sc); },
      concentration: genConcentration
    };
    var questions = [], seen = {}, MAXTRY = count * 80;
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

  var plugin = _PU.createPlugin({
    id: 'math-competition-g6-c6',
    name: '工程与浓度（六年级）',
    subject: 'math',
    category: 'mixed',
    grades: [6],
    moduleId: 'C6',
    knowledgePoints: {
      6: ['g6-c6-work-problem', 'g6-c6-concentration-problem']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',           label: '综合' },
        { value: 'work',          label: '工程问题' },
        { value: 'concentration', label: '浓度问题' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 6, count: (opts && opts.count) || 10, columns: 2, title: '工程与浓度（六年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
