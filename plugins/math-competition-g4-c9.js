// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g4-c9.js — 四年级竞赛 C9 综合（新语义题型）
// 实现题型（type 与知识库一致）：
//   integrated  综合应用题（多步计算 + 推理混合）
//   misc        杂题选讲（统筹优化：烙饼/排队）
//   mock        模拟竞赛卷（竞赛风格混合题）
// 设计要点：独立实现，不依赖其他插件；答案均为确定整数。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g4-c9.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type, q: cfg.text,
      answer: cfg.answer, inputType: 'multi', inputCount: cfg.answer.length,
      hint: cfg.hint, render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  // ============ 综合应用题 ============
  function genIntegrated() {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      // 和差倍复合
      var small = _PU.randInt(5, 20), diff = _PU.randInt(3, 15);
      var big = small + diff;
      return fillQ({
        type: 'integrated',
        text: '果园里有梨树 ' + big + ' 棵，比苹果树多 ' + diff + ' 棵。梨树和苹果树一共有多少棵？',
        answer: [big + small],
        hint: '苹果树 = ' + big + '−' + diff + '=' + small + ' 棵；一共 = ' + big + '+' + small + '=' + (big + small) + ' 棵'
      });
    }
    if (mode === 1) {
      // 行程 × 计算
      var v = _PU.randInt(30, 60), t = _PU.randInt(2, 5);
      var rest = _PU.randInt(10, 30);
      return fillQ({
        type: 'integrated',
        text: '一辆汽车每小时行驶 ' + v + ' 千米，行驶了 ' + t + ' 小时后休息了 ' + rest + ' 分钟，然后又以同样速度行驶了 ' + t +
          ' 小时。这辆汽车一共行驶了多少千米？（休息时间不计路程）',
        answer: [v * t * 2],
        hint: '总行驶时间 = ' + t + '+' + t + '=' + (2 * t) + ' 小时；总路程 = ' + v + '×' + (2 * t) + '=' + (v * t * 2) + ' 千米'
      });
    }
    // 面积 × 周长复合
    var side = _PU.randInt(4, 12);
    return fillQ({
      type: 'integrated',
      text: '一个正方形的边长是 ' + side + ' 厘米。它的周长是多少厘米？面积是多少平方厘米？（先填周长，再填面积）',
      answer: [side * 4, side * side],
      hint: '周长 = ' + side + '×4 = ' + (side * 4) + ' cm；面积 = ' + side + '² = ' + (side * side) + ' cm²'
    });
  }

  // ============ 杂题选讲 ============
  function genMisc() {
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      // 烙饼问题
      var n = _PU.randInt(3, 7), t = _PU.randInt(1, 3);
      return fillQ({
        type: 'misc',
        text: '一个平底锅每次最多可以烙 2 张饼，每张饼要烙两面，每面需要 ' + t + ' 分钟。烙 ' + n + ' 张饼最少需要多少分钟？',
        answer: [n * t],
        hint: '总面数 ' + (2 * n) + ' ÷ 每次烙 2 面 × 每面 ' + t + ' 分钟 = ' + (n * t) + ' 分钟'
      });
    }
    // 排队打水
    var k = _PU.randInt(3, 4);
    var times = [];
    while (times.length < k) {
      var v = _PU.randInt(1, 8);
      if (!times.includes(v)) times.push(v);
    }
    times.sort(function (a, b) { return a - b; });
    var total = 0, prefix = 0;
    for (var i = 0; i < k; i++) { prefix += times[i]; total += prefix; }
    return fillQ({
      type: 'misc',
      text: k + ' 个人接水，每人接水时间分别为 ' + times.slice().sort(function () { return Math.random() - 0.5; }).join('、') +
        ' 分钟，只有一个水龙头。按最省时间的顺序接水，所有人的等待时间加接水时间总和最少是多少分钟？',
      answer: [total],
      hint: '按用时从短到长排：' + times.join('→') + '，前缀和相加 = ' + total + ' 分钟'
    });
  }

  // ============ 模拟竞赛卷 ============
  function genMock() {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      // 计算竞赛题
      var a = _PU.randInt(11, 99), b = _PU.randInt(11, 99);
      var result = a * b;
      return fillQ({
        type: 'mock',
        text: '计算：' + a + ' × ' + b + ' ＝ ____。',
        answer: [result],
        hint: a + '×' + b + ' = ' + result
      });
    }
    if (mode === 1) {
      // 数字谜风格
      var x = _PU.randInt(10, 50), y = _PU.randInt(10, 50), sum = x + y;
      var maskedA = String(x).replace(/./g, function (_, i) { return i === 0 ? String(x)[0] : '□'; });
      var maskedB = String(y).replace(/./g, function (_, i) { return i === 0 ? String(y)[0] : '□'; });
      return fillQ({
        type: 'mock',
        text: '在竖式中填入合适的数字：' + maskedA + ' + ' + maskedB + ' = ' + sum + '。第一个加数是多少？',
        answer: [x],
        hint: '首位已给出，其余位由和的唯一性确定 → 加数为 ' + x
      });
    }
    // 找规律
    var start = _PU.randInt(1, 5), step = _PU.randInt(2, 6);
    var seq = [];
    for (var i = 0; i < 4; i++) seq.push(start + i * step);
    var next = start + 4 * step;
    return fillQ({
      type: 'mock',
      text: '找规律：' + seq.join('、') + '、… 下一个数是多少？',
      answer: [next],
      hint: '等差数列，公差为 ' + step + ' → 下一项 = ' + seq[3] + '+' + step + '=' + next
    });
  }

  function generateQuestions(opts) {
    opts = opts || {};
    var type = opts.type || 'mix';
    var keys = type === 'mix' ? ['integrated', 'misc', 'mock'] : [type];
    var count = opts.count || 10;
    var genMap = { integrated: genIntegrated, misc: genMisc, mock: genMock };
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
    id: 'math-competition-g4-c9',
    name: '竞赛综合（四年级）',
    subject: 'math',
    category: 'mixed',
    grades: [4],
    moduleId: 'C9',
    knowledgePoints: {
      4: ['g4-c9-c9-integrated', 'g4-c9-c9-misc', 'g4-c9-c9-mock']
    },
    columns: 1,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',        label: '综合' },
        { value: 'integrated', label: '综合应用题' },
        { value: 'misc',       label: '杂题选讲' },
        { value: 'mock',       label: '模拟竞赛卷' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 4, count: (opts && opts.count) || 10, columns: 1, title: '竞赛综合（四年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
