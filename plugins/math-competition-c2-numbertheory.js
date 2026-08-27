// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-c2-numbertheory.js — 竞赛 C2 数论初步
//
// 覆盖 C2 模块六个子题型（type 与 shared/knowledge-bank.js 四年级 C2 知识点一致）：
//   parity     奇偶性与运算规律（1..N 中奇/偶数个数）
//   divisible  整除特征（2/3/5/9）：在 □ 里填最小数字使整除
//   prime      质数与合数（拆成两个质数之和 / 区间内质数个数）
//   factor     因数与倍数（最大公因数 + 最小公倍数）
//   remainder  余数问题（中国剩余构造，最小正整数解）
//   place      位值原理（已知两数字和差求两位数）
//
// 设计要点（竞赛题必须答案唯一）：所有子题型均为「构造即唯一」或「求最小/最值」，
// 不存在多解歧义；校验器从题面反解参数独立重算比对。
//
// 规范对齐（CONTRIBUTING 三点六）：
//   moduleId:'C2'、category:'number'、grades 与模块目录一致 [4,5,6]、
//   多空题一律数组 answer + inputType:'multi'、随机数走 PluginUtil、题面无内联 style。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-c2-numbertheory.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');

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

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a; }
  function isPrime(n) {
    if (n < 2) return false;
    if (n < 4) return true;
    if (n % 2 === 0) return false;
    for (var i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
    return true;
  }
  /** 1..N 中质数个数 */
  function primeCount(N) { var c = 0; for (var n = 2; n <= N; n++) if (isPrime(n)) c++; return c; }

  /** 难度 → 各子题型规模 */
  function scale(lv) {
    if (lv >= 8) return { Nmax: 99, div: [2, 3, 5, 9], facMax: 200, len: 3 };
    if (lv >= 5) return { Nmax: 49, div: [2, 3, 5], facMax: 100, len: 3 };
    return { Nmax: 29, div: [2, 3, 5], facMax: 60, len: 2 };
  }

  // ============ 1. 奇偶性 ============
  var PARITY_TAILS = [
    '（先写奇数个数，再写偶数个数）',
    '（按奇数、偶数的顺序填写）',
    '（第一行填奇数个数，第二行填偶数个数）'
  ];
  function genParity(sc) {
    var N = _PU.randInt(10, 99);              // 宽范围保证可抽题空间充足（1..99 共 90 个 N）
    var odd = Math.ceil(N / 2), even = N - odd;
    return fillQ({
      type: 'parity',
      text: '从 1 到 ' + N + ' 中，奇数有 ____ 个，偶数有 ____ 个。' + _PU.rand(PARITY_TAILS),
      answer: [odd, even],
      hint: '奇数从 1 开始每隔一个，数一数；总数减去奇数就是偶数'
    });
  }

  // ============ 2. 整除特征 ============
  function genDivisible(sc) {
    for (var t = 0; t < 400; t++) {
      var divisor = _PU.rand(sc.div);
      var len = Math.max(3, sc.len);              // 至少 3 位，保证可抽题空间充足（避免低难度重复）
      var pos = _PU.randInt(1, len - 1);          // □ 不放首位，避免前导 0 歧义
      var digits = [];
      for (var i = 0; i < len; i++) {
        if (i === pos) { digits.push('□'); }
        else if (i === 0) { digits.push(String(_PU.randInt(1, 9))); }
        else { digits.push(String(_PU.randInt(0, 9))); }
      }
      var numStr = digits.join('');
      // 枚举 □ 处可填的数字，找所有满足整除的
      var valid = [];
      for (var d = 0; d <= 9; d++) {
        var s = numStr.replace('□', String(d));
        if (Number(s) % divisor === 0) valid.push(d);
      }
      if (!valid.length) continue;
      var ans = Math.min.apply(null, valid);       // 题面要求「最小的一个」→ 答案唯一
      return fillQ({
        type: 'divisible',
        text: '在 □ 里填一个数字（0~9），使 ' + numStr + ' 能被 ' + divisor + ' 整除。请写出最小的一个。',
        answer: [ans],
        hint: divisor === 2 ? '看个位是不是偶数' :
          divisor === 5 ? '看个位是不是 0 或 5' :
          '把各位数字加起来，和是 ' + divisor + ' 的倍数'
      });
    }
    return null;
  }

  // ============ 3. 质数与合数 ============
  function genPrime() {
    if (_PU.randInt(0, 1) === 0) {
      // 变体 A：拆成两个质数之和（N 为奇数且 N-2 是质数 → 唯一表示 2+(N-2)）
      for (var t = 0; t < 200; t++) {
        var N = _PU.randInt(5, 49) * 2 + 1;        // 奇数
        if (!isPrime(N - 2)) continue;
        return fillQ({
          type: 'prime',
          text: '把 ' + N + ' 写成两个质数相加的形式（按从小到大写出这两个质数，中间用逗号隔开）。',
          answer: [2, N - 2],
          hint: '奇数 = 偶数 + 奇数，唯一的偶质数是 2'
        });
      }
      return null;
    }
    // 变体 B：1..N 中质数个数
    var M = _PU.randInt(10, 50);
    return fillQ({
      type: 'prime',
      text: '1 到 ' + M + ' 中，质数一共有 ____ 个。',
      answer: [primeCount(M)],
      hint: '质数只有 1 和它本身两个因数；2 是最小的质数'
    });
  }

  // ============ 4. 因数与倍数 ============
  function genFactor(sc) {
    var a = _PU.randInt(8, sc.facMax), b = _PU.randInt(8, sc.facMax);
    if (a === b) b = b === sc.facMax ? b - 1 : b + 1;
    var g = gcd(a, b), l = a * b / g;
    return fillQ({
      type: 'factor',
      text: a + ' 和 ' + b + ' 的最大公因数是 ____，最小公倍数是 ____。（先填最大公因数，再填最小公倍数）',
      answer: [g, l],
      hint: '短除法或列举法：公有的因数相乘得最大公因数，全部因数相乘再除重叠得最小公倍数'
    });
  }

  // ============ 5. 余数问题（中国剩余，最小解唯一） ============
  var COPRIME_PAIRS = [[3, 5], [4, 5], [3, 7], [4, 7], [5, 6], [5, 7], [3, 8], [4, 9], [5, 8]];
  function genRemainder() {
    for (var t = 0; t < 300; t++) {
      var pr = _PU.rand(COPRIME_PAIRS), m1 = pr[0], m2 = pr[1];
      var L = m1 * m2;
      var x = _PU.randInt(1, L - 1);               // x < lcm → x 即最小正整数解
      var r1 = x % m1, r2 = x % m2;
      return fillQ({
        type: 'remainder',
        text: '一个自然数除以 ' + m1 + ' 余 ' + r1 + '，除以 ' + m2 + ' 余 ' + r2 +
          '。在满足这两个条件的数中，最小的一个是 ____。（提示：在 1 到 ' + x + ' 之间找）',
        answer: [x],
        hint: '从 ' + m1 + ' 的倍数加 ' + r1 + ' 开始试，再看除以 ' + m2 + ' 余 ' + r2
      });
    }
    return null;
  }

  // ============ 6. 位值原理 ============
  function genPlace() {
    var unitsLarger = _PU.randInt(0, 1) === 0;
    var a, b, S, D, text;
    if (unitsLarger) {
      var a0 = _PU.randInt(1, 8), D0 = _PU.randInt(1, 9 - a0);   // b = a0 + D0 ≤ 9
      a = a0; b = a0 + D0; S = a + b; D = D0;
      text = '一个两位数，十位数字与个位数字的和是 ' + S + '，且个位数字比十位数字大 ' + D + '。这个两位数是 ____。';
    } else {
      var b0 = _PU.randInt(1, 8), D1 = _PU.randInt(1, 9 - b0);   // a = b0 + D1 ≤ 9
      b = b0; a = b0 + D1; S = a + b; D = D1;
      text = '一个两位数，十位数字与个位数字的和是 ' + S + '，且十位数字比个位数字大 ' + D + '。这个两位数是 ____。';
    }
    return fillQ({
      type: 'place',
      text: text,
      answer: [10 * a + b],
      hint: '两数字之和加两数字之差，等于较大数字的 2 倍'
    });
  }

  // ============ 子题型分发 ============
  var GENERATORS = {
    parity: genParity,
    divisible: genDivisible,
    prime: genPrime,
    factor: genFactor,
    remainder: genRemainder,
    place: genPlace
  };
  var ALL_KEYS = ['parity', 'divisible', 'prime', 'factor', 'remainder', 'place'];

  var plugin = _PU.createPlugin({
    id: 'math-competition-c2-numbertheory',
    name: '数论初步',
    subject: 'math',
    grades: [4],
    category: 'number',
    moduleId: 'C2',
    description: '整除特征、奇偶性、质数合数、因数倍数与余数规律',
    columns: 2,
    printConfig: { pageType: 'math' },

    settings: [
      {
        key: 'type', type: 'chip', label: '题型', default: 'mix',
        options: [
          { value: 'mix', label: '随机混合' },
          { value: 'parity', label: '奇偶性' },
          { value: 'divisible', label: '整除特征' },
          { value: 'prime', label: '质数合数' },
          { value: 'factor', label: '因数倍数' },
          { value: 'remainder', label: '余数问题' },
          { value: 'place', label: '位值原理' }
        ]
      }
    ],

    knowledgePoints: {
      4: [
          'math-g4-c2-c2-parity',
          'math-g4-c2-c2-divisible',
          'math-g4-c2-c2-prime',
          'math-g4-c2-c2-factor',
          'math-g4-c2-c2-remainder',
          'math-g4-c2-c2-place'
      ]
    },

    generateQuestions: function (opts) {
      opts = opts || {};
      var count = Math.max(1, opts.count || 10);
      var sc = scale(opts.difficulty || 3);
      var keys = (opts.type && opts.type !== 'mix' && GENERATORS[opts.type]) ? [opts.type] : ALL_KEYS;
      var out = [], seen = {}, guard = 0;

      while (out.length < count && guard < count * 40) {
        guard++;
        var k = keys.length === 1 ? keys[0] : _PU.rand(keys);
        var q = GENERATORS[k](sc);
        if (!q) continue;
        var sig = k + '|' + q.q + '|' + (q.svg || '');
        if (seen[sig]) continue;
        seen[sig] = 1;
        out.push(q);
      }
      var fill = 0;
      while (out.length < count && fill < count * 10) {
        fill++;
        var k2 = keys.length === 1 ? keys[0] : _PU.rand(keys);
        var q2 = GENERATORS[k2](sc);
        if (q2) out.push(q2);
      }
      return out;
    },

    meta: function (opts) {
      return {
        grade: (opts && opts.grade) || 4,
        count: (opts && opts.count) || 10,
        columns: 2,
        title: '数论初步'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
