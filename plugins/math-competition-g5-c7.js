// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g5-c7.js — 五年级竞赛 C7 分数与巧算（新语义题型）
// 实现题型（type 与 shared/knowledge-bank.js 五年级 C7 知识点一致）：
//   frac-split      分数裂项  1/(1×2)+1/(2×3)+…+1/(n(n+1)) = n/(n+1)
//   int-split       整数裂项  1×2+2×3+…+n(n+1) = n(n+1)(n+2)/3
//   series          等差数列  通项与求和
//   extract-factor  提取公因数  a×b + a×c = a×(b+c)
//   rounding        凑整巧算  接近整十整百的加法
//   compare         比较大小  分数比较（交叉相乘）
// 设计要点：答案唯一，先定答案再反推参数；随机数走 PluginUtil。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g5-c7.js 依赖 shared/common.js（PluginUtil.createPlugin）');

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

  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }

  // ============ 1. 分数裂项 ============
  function genFractionSplitting() {
    var n = _PU.randInt(2, 14);
    var terms = [];
    for (var k = 1; k <= n; k++) terms.push('1/(' + k + '×' + (k + 1) + ')');
    var ans = n + '/' + (n + 1);
    return fillQ({
      type: 'frac-split',
      text: '计算（结果填最简分数）：' + terms.join('＋') + ' = ____',
      answer: [ans],
      hint: '裂项相消：1/(k×(k+1)) = 1/k − 1/(k+1)，结果为 ' + ans
    });
  }

  // ============ 2. 整数裂项 ============
  function genIntegerSplitting() {
    var n = _PU.randInt(2, 12);
    var terms = [];
    for (var k = 1; k <= n; k++) terms.push(k + '×' + (k + 1));
    var ans = n * (n + 1) * (n + 2) / 3;
    return fillQ({
      type: 'int-split',
      text: '计算：' + terms.join('＋') + ' = ____',
      answer: [ans],
      hint: '整数裂项：n(n+1)(n+2) 的差分，结果 = ' + n + '×' + (n + 1) + '×' + (n + 2) + '÷3 = ' + ans
    });
  }

  // ============ 3. 等差数列（求和） ============
  function genArithmeticSeries() {
    var a = _PU.randInt(1, 5);
    var d = _PU.randInt(2, 6);
    var n = _PU.randInt(3, 8);
    var last = a + (n - 1) * d;
    var terms = [];
    for (var i = 0; i < n; i++) terms.push(a + i * d);
    var sum = (a + last) * n / 2;
    return fillQ({
      type: 'series',
      text: '等差数列 ' + terms.join('，') + ' 的和是 ____。',
      answer: [sum],
      hint: '末项 = ' + a + '＋(' + n + '−1)×' + d + ' = ' + last + '；和 = (首项＋末项)×项数÷2 = (' + a + '＋' + last + ')×' + n + '÷2'
    });
  }

  // ============ 4. 提取公因数 ============
  function genExtractCommonFactor() {
    var a = _PU.randInt(2, 9);
    var b = _PU.randInt(2, 9);
    var c = _PU.randInt(2, 9);
    var ans = a * (b + c);
    return fillQ({
      type: 'extract-factor',
      text: '用提取公因数的方法计算：' + a + '×' + b + '＋' + a + '×' + c + ' = ____',
      answer: [ans],
      hint: '提取公因数 ' + a + '：' + a + '×(' + b + '＋' + c + ') = ' + a + '×' + (b + c) + ' = ' + ans
    });
  }

  // ============ 5. 凑整巧算 ============
  function genRoundingCalc() {
    var r = _PU.randInt(0, 2);
    var n1 = [97, 98, 99][r];
    var n2 = _PU.randInt(24, 89);
    var ans = n1 + n2;
    var near = [100, 100, 100][r];
    var adj = near - n1;
    return fillQ({
      type: 'rounding',
      text: '用凑整法计算：' + n1 + '＋' + n2 + ' = ____',
      answer: [ans],
      hint: '凑整：' + n1 + '＝' + near + '−' + adj + '，即 ' + near + '＋' + (n2 - adj) + ' = ' + ans
    });
  }

  // ============ 6. 分数比较大小 ============
  function genCompareSize() {
    var a = _PU.randInt(2, 7), b = _PU.randInt(a + 1, 11);
    var c = _PU.randInt(2, 7), d = _PU.randInt(c + 1, 11);
    // 避免分子相同、分母相同或相等
    if (a === c || b === d) return null;
    var l = a * d, r = c * b;
    if (l === r) return null;
    var op = l > r ? '>' : '<';
    return fillQ({
      type: 'compare',
      text: '在 ○ 里填上 "＞"、"＜" 或 "＝"：' + a + '/' + b + ' ○ ' + c + '/' + d,
      answer: [op],
      hint: '交叉相乘：' + a + '×' + d + ' 与 ' + c + '×' + b + ' 比较（' + l + ' ' + op + ' ' + r + '）'
    });
  }


  function genRecurring() {
    var num = _PU.randInt(1, 9), den = _PU.randInt(2, 9);
    if (den === num) return genRecurring();
    var frac = num + '/' + den;
    return fillQ({ type: 'recurring',
      text: '将循环小数 0.' + '\\dot{' + num + '}\\dot{' + den + '}（即 ' + num + '/' + den + ' 的循环小数表示）化成分数。答案格式：分子/分母',
      answer: [num + '/' + den], check: function(ua, idx) {
        var raw = ua ? (ua[idx] != null ? ua[idx] : ua[idx + ':0']) : '';
        var parts = String(raw).split('/');
        return parts.length === 2 && Number(parts[0]) / Number(parts[1]) === num / den;
      }, hint: '纯循环小数化分数：分子为循环节数字，分母为等长的 9。'
    });
  }
  function genDefineOp() {
    var a = _PU.randInt(2, 9), b = _PU.randInt(2, 9), c = _PU.randInt(2, 5);
    // 定义 a*b = a*b + a + b
    var result = a * b + a + b;
    return fillQ({ type: 'define-op',
      text: '定义新运算 a★b ＝ a×b ＋ a ＋ b。求 ' + a + '★' + b + ' ＝ ____。',
      answer: [result], hint: a + '×' + b + '＋' + a + '＋' + b + '＝' + (a*b) + '＋' + (a+b) + '＝' + result
    });
  }
  function genEstimate() {
    var n = _PU.randInt(5, 12);
    var sum = 0; for (var i = 1; i <= n; i++) sum += 1;
    return fillQ({ type: 'estimate',
      text: '估算：1 + 2 + 3 + … + ' + n + ' = ____。',
      answer: [n * (n + 1) / 2], hint: '等差数列求和 = n(n+1)/2 = ' + n*(n+1)/2
    });
  }
  function genComplexFrac() {
    var a = _PU.randInt(2, 6), b = _PU.randInt(2, 6);
    var result = b; // 1/(1/a) = a... 简单双层繁分数
    var val = a * b / (a + b); // 1/(1/a + 1/b)
    return fillQ({ type: 'complex-frac',
      text: '化简：1 ÷ (1/' + a + ' ＋ 1/' + b + ') ＝ ____。（结果保留两位小数）',
      answer: [Math.round(val * 100) / 100],
      hint: '1/' + a + ' ＋ 1/' + b + ' ＝ ' + (a+b) + '/' + (a*b) + '，倒数 = ' + (a*b) + '/' + (a+b) + ' ≈ ' + Math.round(val*100)/100
    });
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['frac-split', 'int-split', 'series', 'extract-factor', 'rounding', 'compare',
         'recurring', 'define-op', 'estimate', 'complex-frac']
      : [type];
    var count = opts.count || 10;
    var genMap = {
      'frac-split': genFractionSplitting, 'int-split': genIntegerSplitting, 'series': genArithmeticSeries,
      'extract-factor': genExtractCommonFactor, 'rounding': genRoundingCalc, 'compare': genCompareSize, recurring: genRecurring, 'define-op': genDefineOp, estimate: genEstimate, 'complex-frac': genComplexFrac
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
    id: 'math-competition-g5-c7',
    name: '分数与巧算（五年级）',
    subject: 'math',
    category: 'number',
    grades: [5, 6],
    moduleId: 'C7',
    knowledgePoints: {
      6: ['g6-c7-extract-common-factor','g6-c7-rounding-calc','g6-c7-fraction-splitting','g6-c7-integer-splitting',
        'g6-c7-arithmetic-series','g6-c7-recurring-decimal-frac','g6-c7-define-operation','g6-c7-compare-size',
        'g6-c7-estimate-bounds','g6-c7-complex-fraction'],
      5: ['g5-c7-fraction-splitting', 'g5-c7-integer-splitting', 'g5-c7-arithmetic-series',
          'g5-c7-extract-common-factor', 'g5-c7-rounding-calc', 'g5-c7-compare-size']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',           label: '综合' },
        { value: 'frac-split',    label: '分数裂项' },
        { value: 'int-split',     label: '整数裂项' },
        { value: 'series',        label: '等差数列' },
        { value: 'extract-factor', label: '提取公因数' },
        { value: 'rounding',      label: '凑整巧算' },
        { value: 'compare',       label: '比较大小' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 5, count: (opts && opts.count) || 10, columns: 2, title: '分数与巧算（五年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
