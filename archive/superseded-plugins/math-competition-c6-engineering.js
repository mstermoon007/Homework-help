// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-c6-engineering.js — 竞赛 C6 工程与浓度
//
// 覆盖 C6 模块两个子题型（type 与 shared/knowledge-bank.js 知识点一致）：
//   work          工程问题（两人合作：合作天数 = a*b/(a+b)，保证整除）
//   concentration 浓度问题（混合 / 加水稀释 / 蒸发浓缩，含盐率均为整数 %）
//
// 设计要点（竞赛题必须答案唯一）：所有子题型均为确定型计算，题面含全部所需数字，
// 校验器从题面反解参数独立重算比对。
//
// 规范对齐（CONTRIBUTING 三点六）：
//   moduleId:'C6'、category:'number'、grades 与模块目录一致 [5,6]、
//   多空题一律数组 answer + inputType:'multi'、随机数走 PluginUtil、题面无内联 style。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-c6-engineering.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');

  // ============ 通用构造 ============
  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
      svg: cfg.figure || '',
      answer: cfg.answer,
      inputType: 'multi',
      inputCount: cfg.answer.length,
      hint: cfg.hint,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  /** 难度 → 规模 */
  function scale(lv) {
    if (lv >= 8) return { span: 90, pmax: 25 };
    if (lv >= 5) return { span: 55, pmax: 20 };
    return { span: 30, pmax: 15 };
  }

  var WORK_TAIL = [
    '如果两人合作，需要 ____ 天完成。（结果取整数）',
    '两人合作，一共需要 ____ 天完成。（结果取整数）',
    '若两人合做这份工程，需要 ____ 天才能完成？（结果取整数）'
  ];

  // ============ 1. 工程问题 ============
  function genWork(sc) {
    for (var t = 0; t < 600; t++) {
      var a = _PU.randInt(3, sc.span);
      var b = _PU.randInt(3, sc.span);
      if (a === b) b = b + 1;
      var days = (a * b) / (a + b);
      if (days !== Math.floor(days)) continue;     // 必须整除
      if (days < 2 || days >= Math.min(a, b)) continue;
      var tail = WORK_TAIL[_PU.randInt(0, WORK_TAIL.length - 1)];
      return fillQ({
        type: 'work',
        text: '甲单独做一项工程需要 ' + a + ' 天，乙单独做同样的工程需要 ' + b + ' 天。' + tail,
        answer: [days],
        hint: '合作每天完成 1/' + a + ' + 1/' + b + ' = ' + (a + b) + '/' + (a * b) + '，天数 = ' + (a * b) + ' ÷ ' + (a + b) + ' = ' + days
      });
    }
    return null;
  }

  // ============ 2. 浓度问题（先定答案再反推自由变量，保证每次必出有效题） ============
  function genConcentration(sc) {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      // 混合（等质量）：rate = (P + Q) / 2，只需 P、Q 同奇偶
      var M = _PU.randInt(80, 300);
      var P = _PU.randInt(2, sc.pmax), Q = _PU.randInt(2, sc.pmax);
      if (P % 2 !== Q % 2) Q = Q + 1;
      if (Q > sc.pmax) Q = Q - 2;
      if (P % 2 !== Q % 2) return null;
      var rate = (P + Q) / 2;
      return fillQ({
        type: 'concentration',
        text: '把 ' + M + ' 克含盐 ' + P + '% 的盐水和 ' + M + ' 克含盐 ' + Q + '% 的盐水混合，混合后的含盐率是 ____%。',
        answer: [rate],
        hint: '总盐 = ' + M + '×' + P + '% + ' + M + '×' + Q + '% = ' + (M * (P + Q)) + '%，总质量 ' + (2 * M) + ' 克，含盐率 = ' + (M * (P + Q)) + ' ÷ ' + (2 * M) + ' = ' + rate + '%'
      });
    }
    if (mode === 1) {
      // 加水稀释：rate = M*P/(M+N)，先选盐重 num=M*P 与可整除的 rate r(<P)，反推 N = num/r - M
      var M2 = _PU.randInt(120, 400), P2 = _PU.randInt(3, 20);
      var num2 = M2 * P2;
      var rs = [];
      for (var r = 2; r < P2; r++) if (num2 % r === 0) rs.push(r);
      if (!rs.length) rs = [1];
      var rate2 = _PU.rand(rs);
      var N2 = num2 / rate2 - M2;
      if (N2 <= 0 || N2 > 4000) return null;
      return fillQ({
        type: 'concentration',
        text: '把 ' + M2 + ' 克含盐 ' + P2 + '% 的盐水加入 ' + N2 + ' 克清水，含盐率变为 ____%。',
        answer: [rate2],
        hint: '盐重 = ' + M2 + '×' + P2 + '% = ' + num2 + '%，总质量 ' + (M2 + N2) + ' 克，含盐率 = ' + num2 + ' ÷ ' + (M2 + N2) + ' = ' + rate2 + '%'
      });
    }
    // 蒸发浓缩：rate = M*P/(M-N)。令 M 为偶数、取 k=2，则 N=M/2 时 rate = 2*P（恒整除、恒有效）
    var M3 = _PU.randInt(60, 200) * 2;   // 偶数，∈[120,400]
    var P3 = _PU.randInt(3, 20);
    var rate3 = 2 * P3;
    var N3 = M3 / 2;
    if (N3 <= 0 || N3 >= M3) return null;
    return fillQ({
      type: 'concentration',
      text: '把 ' + M3 + ' 克含盐 ' + P3 + '% 的盐水蒸发掉 ' + N3 + ' 克水，含盐率变为 ____%。',
      answer: [rate3],
      hint: '盐重 = ' + M3 + '×' + P3 + '% = ' + (M3 * P3) + '%，总质量 ' + (M3 - N3) + ' 克，含盐率 = ' + (M3 * P3) + ' ÷ ' + (M3 - N3) + ' = ' + rate3 + '%'
    });
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = scale(lv);
    var type = opts.type || 'mix';
    var keys = type === 'mix' ? ['work', 'concentration'] : [type];
    var count = opts.count || 10;
    var questions = [];
    var seen = {};
    var MAXTRY = count * 80;
    var map = { work: genWork, concentration: genConcentration };
    for (var i = 0; i < count; i++) {
      var key, q, tries = 0;
      do {
        key = keys[i % keys.length];
        q = map[key](sc);
        tries++;
      } while (q && seen[q.q] && tries < MAXTRY);
      if (!q) { q = key === 'work' ? genWork(sc) : genConcentration(sc); }
      if (q) { seen[q.q] = true; questions.push(q); }
    }
    return questions;
  }

  // ============ 注册 ============
  var plugin = _PU.createPlugin({
    id: 'math-competition-c6-engineering',
    name: '工程与浓度',
    subject: 'math',
    category: 'number',
    grades: [6],
    moduleIds: ['C6'],
    knowledgePoints: {
      6: ['g6-c6-c6-work', 'g6-c6-c6-concentration']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',            label: '综合' },
        { value: 'work',          label: '工程问题' },
        { value: 'concentration',  label: '浓度问题' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return {
        grade: (opts && opts.grade) || 5,
        count: (opts && opts.count) || 10,
        columns: 2,
        title: '工程与浓度'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
