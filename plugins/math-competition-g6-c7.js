// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g6-c7.js — 六年级竞赛 C7 分数与巧算深化（新语义题型）
// 实现题型（本轮激活部分）：
//   sequence-sum  数列求和（平方和、立方和公式应用）
// 设计要点：直接套用公式，n 范围控制使答案为适中整数。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g6-c7.js 依赖 shared/common.js');

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

  /** 难度 → 规模（取值范围下探到 2，确保每档可产出足够多的不重复题面） */
  function scale(lv) {
    if (lv >= 8) return { sqMax: 400, cuMax: 250 };
    if (lv >= 5) return { sqMax: 320, cuMax: 200 };
    return { sqMax: 240, cuMax: 160 };
  }

  function genSequenceSum(sc) {
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      var n = _PU.randInt(2, sc.sqMax);
      var s2 = n * (n + 1) * (2 * n + 1) / 6;
      return fillQ({
        type: 'sequence-sum',
        text: '计算：1² + 2² + 3² + … + ' + n + '² = ____。',
        answer: [s2],
        hint: '平方和公式 S = n(n+1)(2n+1)÷6 = ' + n + '×' + (n + 1) + '×' + (2 * n + 1) + '÷6 = ' + s2
      });
    }
    var m = _PU.randInt(2, sc.cuMax);
    var tri = m * (m + 1) / 2;
    var s3 = tri * tri;
    return fillQ({
      type: 'sequence-sum',
      text: '计算：1³ + 2³ + 3³ + … + ' + m + '³ = ____。',
      answer: [s3],
      hint: '立方和公式 S = [n(n+1)÷2]² = (' + tri + ')² = ' + s3
    });
  }

  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = scale(lv);
    var count = opts.count || 10;
    var questions = [], seen = {}, MAXTRY = count * 80;
    for (var i = 0; i < count; i++) {
      var q = null;
      for (var tries = 0; tries < MAXTRY; tries++) {
        q = genSequenceSum(sc);
        if (q && !seen[q.q]) break;
      }
      if (q) { seen[q.q] = true; questions.push(q); }
    }
    return questions;
  }

  var plugin = _PU.createPlugin({
    id: 'math-competition-g6-c7',
    name: '分数与巧算（六年级）',
    subject: 'math',
    category: 'number',
    grades: [6],
    moduleId: 'C7',
    knowledgePoints: {
      6: ['math-g6-c7-sequence-sum']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',          label: '综合' },
        { value: 'sequence-sum', label: '数列求和' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 6, count: (opts && opts.count) || 10, columns: 2, title: '分数与巧算（六年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
