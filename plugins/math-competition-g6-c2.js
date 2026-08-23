// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g6-c2.js — 六年级竞赛 C2 数论深化（新语义题型）
// 实现题型（type 与知识库一致）：
//   remainder       同余方程与剩余定理（互质模数联立求最小解）
//   modulo          模运算与周期（大指数的末位 / 余数周期）
//   diophantine     不定方程整数解（解的组数 / 最小 x 解 / x+y 最小值）
//   perfect-square  完全平方数性质（求平方根 / 区间计数 / 个位排除 / 连续平方差）
// 设计要点：幂余用周期检测；同余方程模数两两互质保证唯一解；
// 不定方程按枚举计数出题；完全平方各模式均有唯一数值答案。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g6-c2.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
      answer: cfg.answer,
      inputType: cfg.single ? 'text' : 'multi',
      inputCount: cfg.single ? undefined : cfg.answer.length,
      hint: cfg.hint,
      check: cfg.check,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  // ============ 1. 同余方程与剩余定理 ============
  /** 两两互质的模数组合（乘积控制在 250 内，保证最小解 < 250） */
  var CRT_GROUPS = [
    [3, 4], [3, 5], [4, 5], [5, 7], [3, 7], [7, 8], [5, 8], [4, 7],
    [3, 4, 5], [3, 4, 7], [3, 5, 7], [4, 5, 7], [3, 5, 8]
  ];
  function genCongruence() {
    var mods = CRT_GROUPS[_PU.randInt(0, CRT_GROUPS.length - 1)];
    var conds = mods.map(function (d) { return { d: d, r: _PU.randInt(0, d - 1) }; });
    var prod = mods.reduce(function (s, d) { return s * d; }, 1);
    var x = 1;
    while (x <= prod && !conds.every(function (c) { return x % c.d === c.r; })) x++;
    if (x > prod || x < 2 || x >= 200) return genCongruence();
    var condText = conds.map(function (c) { return '除以 ' + c.d + ' 余 ' + c.r; }).join('，');
    var lastIdx = condText.lastIndexOf('，');
    if (lastIdx >= 0) condText = condText.slice(0, lastIdx) + '，且' + condText.slice(lastIdx + 1);
    return fillQ({
      type: 'remainder',
      text: '一个数' + condText + '。满足这些条件的最小正整数是 ____。',
      answer: [x],
      hint: '枚举/中国剩余定理：先满足除以 ' + conds[conds.length - 1].d + ' 余 ' +
        conds[conds.length - 1].r + ' 的数，再逐一检验其余条件，最小为 ' + x +
        '（通解为 x ＋ ' + prod + '·k，k≥0）'
    });
  }

  // ============ 2. 模运算与周期 ============
  /** 幂 a^e mod m 的周期与结果 */
  function powerCycle(a, e, m) {
    var seen = {}, seq = [];
    var r = a % m;
    while (!seen[r]) {
      seen[r] = seq.length;
      seq.push(r);
      r = (r * a) % m;
    }
    var start = seen[r];               // 循环起点（纯循环时为 0）
    var period = seq.length - start;
    var idx = start + ((e - (start + 1)) % period);
    if (e <= seq.length) idx = e - 1;
    return { val: seq[idx], period: period, cycleStr: seq.slice(start).join('→') };
  }

  function genModulo() {
    var mode = _PU.randInt(0, 1);
    var a = _PU.randInt(2, 9), e = _PU.randInt(30, 999);
    if (mode === 0) {
      var cyc = powerCycle(a, e, 10);
      return fillQ({
        type: 'modulo',
        text: a + '^' + e + ' 的个位数字是 ____。',
        answer: [cyc.val],
        hint: a + ' 的乘方个位按 ' + cyc.cycleStr + ' 循环，周期 ' + cyc.period + '；' + e +
          ' ÷ ' + cyc.period + ' 余 ' + (((e - 1) % cyc.period) + 1) + ' → 个位为 ' + cyc.val
      });
    }
    var mods = [3, 4, 5, 7, 8, 9, 11];
    var m = mods[_PU.randInt(0, mods.length - 1)];
    var cyc2 = powerCycle(a, e, m);
    return fillQ({
      type: 'modulo',
      text: a + '^' + e + ' 除以 ' + m + ' 的余数是 ____。',
      answer: [cyc2.val],
      hint: '余数序列 ' + cyc2.cycleStr + ' 循环，周期 ' + cyc2.period + '，第 ' + e + ' 项对应余数 ' + cyc2.val
    });
  }

  // ============ 3. 不定方程整数解 ============
  function enumPositiveSols(a, b, c) {
    var sols = [];
    for (var xx = 1; xx * a < c; xx++) {
      var rem = c - a * xx;
      if (rem % b === 0 && rem / b >= 1) sols.push([xx, rem / b]);
    }
    return sols;
  }
  function genDiophantine() {
    for (var t = 0; t < 500; t++) {
      var a = _PU.randInt(3, 12), b = _PU.randInt(3, 12);
      if (a === b) continue;
      var x0 = _PU.randInt(1, 15), y0 = _PU.randInt(1, 15);
      var c = a * x0 + b * y0;
      var sols = enumPositiveSols(a, b, c);
      if (!sols.length) continue;
      var mode = _PU.randInt(0, 2);
      if (mode === 0 && sols.length >= 2 && sols.length <= 5) {
        // 问解的组数
        return fillQ({
          type: 'diophantine',
          text: '方程 ' + a + 'x + ' + b + 'y = ' + c + ' 共有 ____ 组正整数解。',
          answer: [sols.length],
          hint: 'x 从 1 试到 ' + Math.floor((c - a) / b) + '，逐一检验 (' + c + '−' + a + 'x) 是否被 ' + b + ' 整除且商≥1，共 ' + sols.length + ' 组'
        });
      }
      if (mode === 1) {
        // 问最小 x 的一组解
        var first = sols[0];
        return fillQ({
          type: 'diophantine',
          text: '方程 ' + a + 'x + ' + b + 'y = ' + c + ' 的正整数解中，x 最小的一组是 x = ____，y = ____。（先填 x，再填 y）',
          answer: first,
          hint: 'x 取最小可行值 ' + first[0] + ' 时，y = (' + c + ' − ' + a + '×' + first[0] + ') ÷ ' + b + ' = ' + first[1]
        });
      }
      if (mode === 2 && sols.length >= 2) {
        // 问 x+y 最小的一组解（要求最小和唯一，避免并列歧义）
        var sums = sols.map(function (s) { return s[0] + s[1]; });
        var minSum = Math.min.apply(null, sums);
        var winners = sols.filter(function (s) { return s[0] + s[1] === minSum; });
        if (winners.length !== 1) continue;
        return fillQ({
          type: 'diophantine',
          text: '方程 ' + a + 'x + ' + b + 'y = ' + c + ' 的正整数解中，使 x＋y 最小的一组是 x = ____，y = ____。（先填 x，再填 y）',
          answer: winners[0],
          hint: '各组解为 (' + sols.map(function (s) { return s.join(','); }).join(')、(') + ')，x＋y 最小的是 (' + winners[0].join(',') + ')，和为 ' + minSum
        });
      }
    }
    return genDiophantine();
  }

  // ============ 4. 完全平方数性质 ============
  var SQ_LAST_IMPOSSIBLE = [2, 3, 7, 8];
  function genPerfectSquare(sc) {
    var mode = _PU.randInt(0, 3);
    if (mode === 0) {
      // 求平方根
      var k = _PU.randInt(11, 25);
      var n = k * k;
      return fillQ({
        type: 'perfect-square',
        text: '已知 ' + n + ' 是一个完全平方数，它的（正的）平方根是 ____。',
        answer: [k],
        hint: '试平方：' + Math.floor(Math.sqrt(n)) + '² < ' + n + ' ≤ ' + Math.ceil(Math.sqrt(n)) + '²，且 ' + k + '² = ' + n
      });
    }
    if (mode === 1) {
      // 区间计数
      var lo = sc.kmax >= 12 ? _PU.randInt(100, 300) : _PU.randInt(50, 150);
      var len = _PU.randInt(60, 120);
      var hi = lo + len;
      var sLo = Math.ceil(Math.sqrt(lo)), sHi = Math.floor(Math.sqrt(hi));
      var cnt = Math.max(0, sHi - sLo + 1);
      if (cnt < 2 || cnt > 8) return genPerfectSquare(sc);
      return fillQ({
        type: 'perfect-square',
        text: '在 ' + lo + ' 到 ' + hi + '（含两端）之间，完全平方数共有 ____ 个。',
        answer: [cnt],
        hint: Math.ceil(Math.sqrt(lo)) + '² ≥ ' + lo + '，' + Math.floor(Math.sqrt(hi)) + '² ≤ ' + hi +
          ' → 平方根取 ' + sLo + ' 到 ' + sHi + '，共 ' + cnt + ' 个'
      });
    }
    if (mode === 2) {
      // 个位数字排除（四个不可能个位均正确，容差判定）
      return fillQ({
        type: 'perfect-square',
        text: '完全平方数的个位数字不可能是 0~9 中的某些数字。请写出其中一个不可能的个位数字：____。（只填一个数字）',
        answer: [2],
        single: true,
        check: function (userAnswers, idx) {
          var raw = userAnswers ? (userAnswers[idx] != null ? userAnswers[idx] : userAnswers[idx + ':0']) : '';
          var v = parseInt(String(raw == null ? '' : raw).trim(), 10);
          return SQ_LAST_IMPOSSIBLE.indexOf(v) >= 0;
        },
        hint: '计算 0~9 各数的平方个位：0,1,4,9,6,5,6,9,4,1 —— 只出现 0、1、4、5、6、9，故 2、3、7、8 都不可能'
      });
    }
    // 连续两数平方差
    var kk = _PU.randInt(10, 40);
    var diff = 2 * kk + 1;
    var askSmall = _PU.randInt(0, 1) === 0;
    if (askSmall) {
      return fillQ({
        type: 'perfect-square',
        text: '两个连续自然数的平方差是 ' + diff + '。其中较小的自然数是 ____。',
        answer: [kk],
        hint: '(n＋1)² − n² = 2n＋1 = ' + diff + ' → n = (' + diff + '−1)÷2 = ' + kk
      });
    }
    return fillQ({
      type: 'perfect-square',
      text: '两个连续自然数的平方差是 ' + diff + '。这两个数中较大的数是 ____。',
      answer: [kk + 1],
      hint: '(n＋1)² − n² = 2n＋1 = ' + diff + ' → n = ' + kk + '，较大的数 = n＋1 = ' + (kk + 1)
    });
  }

  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = { kmax: lv >= 8 ? 14 : (lv >= 5 ? 10 : 7) };
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['remainder', 'modulo', 'diophantine', 'perfect-square']
      : [type];
    var count = opts.count || 10;
    var genMap = {
      remainder: genCongruence,
      modulo: genModulo,
      diophantine: genDiophantine,
      'perfect-square': function () { return genPerfectSquare(sc); }
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
    id: 'math-competition-g6-c2',
    name: '数论（六年级）',
    subject: 'math',
    category: 'number',
    grades: [6],
    moduleId: 'C2',
    knowledgePoints: {
      6: ['g6-c2-remainder-congruence', 'g6-c2-modulo-arithmetic', 'g6-c2-diophantine-equation', 'g6-c2-perfect-square']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',            label: '综合' },
        { value: 'remainder',      label: '同余方程' },
        { value: 'modulo',         label: '模运算与周期' },
        { value: 'diophantine',    label: '不定方程整数解' },
        { value: 'perfect-square', label: '完全平方数性质' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 6, count: (opts && opts.count) || 10, columns: 2, title: '数论（六年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
