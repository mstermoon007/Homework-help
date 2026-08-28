// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g5-c2.js — 五年级竞赛 C2 数论（新语义题型）
// 实现题型（type 与知识库一致）：
//   divisibility    整除特征（填数字使 3/9 整除）
//   gcd-lcm         最大公因数与最小公倍数
//   prime-factor    分解质因数（2^□ × 3^□ 填指数）
//   remainder       余数与同余（同余求最小数）
//   perfect-square  完全平方数（m×n 为完全平方数，求最小 n）
//   prime           质数与合数判断
// 设计要点：答案唯一，先定答案再反推参数；使用质因数分解辅助。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g5-c2.js 依赖 shared/common.js');

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
  function lcm(a, b) { return a / gcd(a, b) * b; }

  // ============ 1. 整除特征 ============
  function genDivisibility() {
    var digits = [_PU.randInt(1, 9), _PU.randInt(0, 9), _PU.randInt(0, 9), _PU.randInt(0, 9)];
    var pos = _PU.randInt(0, 3);           // □ 的位置
    var divisor = _PU.randInt(0, 1) ? 3 : 9;
    var S = 0;
    for (var i = 0; i < 4; i++) if (i !== pos) S += digits[i];
    var ans = -1;
    for (var d = 0; d <= 9; d++) { if ((S + d) % divisor === 0) { ans = d; break; } }
    var numStr = digits.map(function (dd, i) { return i === pos ? '□' : dd; }).join('');
    return fillQ({
      type: 'divisibility',
      text: '在 □ 里填一个数字（0~9），使 ' + numStr + ' 能被 ' + divisor + ' 整除，请写出最小的一个。',
      answer: [ans],
      hint: '能被 ' + divisor + ' 整除：各位数字之和能被 ' + divisor + ' 整除（现和为 ' + S + '＋□），最小填 ' + ans
    });
  }

  // ============ 2. 最大公因数与最小公倍数 ============
  function genGcdLcm() {
    var g = _PU.randInt(2, 12);
    var x = _PU.randInt(2, 9), y = _PU.randInt(2, 9);
    if (x === y) y = y === 9 ? 8 : y + 1;
    if (gcd(x, y) !== 1) { x = x === 7 ? 3 : 7; if (gcd(x, y) !== 1) y = y === 5 ? 9 : 5; }
    var a = g * x, b = g * y;
    return fillQ({
      type: 'gcd-lcm',
      text: '求 ' + a + ' 和 ' + b + ' 的最大公因数与最小公倍数（先填最大公因数，再填最小公倍数）。',
      answer: [g, a / gcd(a, b) * b],
      hint: '最大公因数 = ' + g + '，最小公倍数 = ' + a + '×' + b + '÷' + g + ' = ' + (a / gcd(a, b) * b)
    });
  }

  // ============ 3. 分解质因数（2^□ × 3^□） ============
  function genPrimeFactorization() {
    var e1 = _PU.randInt(2, 6), e2 = _PU.randInt(1, 5);
    var n = Math.pow(2, e1) * Math.pow(3, e2);
    return fillQ({
      type: 'prime-factor',
      text: '把 ' + n + ' 分解质因数：' + n + ' = 2^□ × 3^□（两空依次填 2、3 的指数）。',
      answer: [e1, e2],
      hint: '连续除以质因数：' + n + ' = 2^' + e1 + ' × 3^' + e2
    });
  }

  // ============ 4. 余数与同余 ============
  function genRemainderCongruence() {
    var m1 = _PU.randInt(4, 12), m2 = _PU.randInt(4, 12);
    if (m1 === m2) m2 = m2 === 12 ? 5 : m2 + 1;
    var r = _PU.randInt(1, Math.min(m1, m2) - 1);
    var ans = lcm(m1, m2) + r;
    return fillQ({
      type: 'remainder',
      text: '一个数除以 ' + m1 + ' 余 ' + r + '、除以 ' + m2 + ' 也余 ' + r + '，这个数最小是 ____。',
      answer: [ans],
      hint: '该数 = ' + m1 + '、' + m2 + ' 的最小公倍数（' + lcm(m1, m2) + '）＋' + r + ' = ' + ans
    });
  }

  // ============ 5. 完全平方数（m×n 为完全平方，求最小 n） ============
  function genPerfectSquare() {
    // 构造 m = p^odd × q^even，使补乘 n 恰为奇指数质因数之积
    var primes = [2, 3, 5, 7];
    var p = primes[_PU.randInt(0, 3)];          // 奇指数质数
    var q = primes[_PU.randInt(0, 3)];          // 偶指数质数
    if (q === p) q = primes[(primes.indexOf(p) + 1) % primes.length];
    var eOdd = _PU.randInt(0, 1) ? 3 : 1;        // p 的奇指数
    var eEven = _PU.randInt(1, 3) * 2;           // q 的偶指数（≥2）
    if (eEven < 2) eEven = 2;
    var m = Math.pow(p, eOdd) * Math.pow(q, eEven);
    var n = p;                                   // 只需补 p（奇指数补成偶）
    return fillQ({
      type: 'perfect-square',
      text: '要使 ' + m + ' × n 是完全平方数（m、n 都是自然数，n ≥ 1），n 最小是 ____。',
      answer: [n],
      hint: m + ' = ' + p + '^' + eOdd + ' × ' + q + '^' + eEven + '，补乘 ' + p + ' 后指数全为偶数 → n = ' + n
    });
  }

  // ============ 6. 质数与合数判断 ============
  var PRIMES = [47, 53, 59, 61, 67, 71, 73, 79, 83];
  var COMPOSITES = [77, 91, 119, 121, 143, 169, 187, 209, 221];
  function genPrimeComposite() {
    var isPrime = _PU.randInt(0, 1) === 1;
    var n = isPrime ? PRIMES[_PU.randInt(0, PRIMES.length - 1)] : COMPOSITES[_PU.randInt(0, COMPOSITES.length - 1)];
    return fillQ({
      type: 'prime',
      text: '判断 ' + n + ' 是质数还是合数（填「质数」或「合数」）。',
      answer: [isPrime ? '质数' : '合数'],
      hint: isPrime ? n + ' 只有 1 和它本身两个因数，是质数' : n + ' 除 1 和本身外还有其他因数（如 ' + (n % 7 === 0 ? 7 : n % 11 === 0 ? 11 : n % 13 === 0 ? 13 : 3) + '），是合数'
    });
  }


  // ============ 奇偶分析 ============
  function genParity() {
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      // 奇偶运算性质
      var a = _PU.randInt(10, 50), b = _PU.randInt(10, 50);
      var sumIsEven = (a + b) % 2 === 0;
      return fillQ({
        type: 'parity',
        text: a + ' 是' + (a % 2 === 0 ? '偶' : '奇') + '数，' + b + ' 是' + (b % 2 === 0 ? '偶' : '奇') +
          '数。那么 ' + a + ' ＋ ' + b + ' 的和是奇数还是偶数？（填"奇"或"偶"）',
        answer: [sumIsEven ? '偶' : '奇'],
        hint: '奇偶加法：同奇同偶相加得偶，一奇一偶相加得奇。' + a + ' 和 ' + b + ' ' + (a % 2 === b % 2 ? '同为' + (a % 2 === 0 ? '偶' : '奇') : '一奇一偶') + ' → 和是' + (sumIsEven ? '偶' : '奇') + '数'
      });
    }
    // 多个奇数 / 偶数相加的奇偶性
    var n = _PU.randInt(1, 9);
    var kind = _PU.randInt(0, 1) ? '奇数' : '偶数';
    var sumIsEven = (kind === '奇数') ? (n % 2 === 0) : true;
    return fillQ({
      type: 'parity',
      text: n + ' 个' + kind + '相加，和是奇数还是偶数？（填"奇"或"偶"）',
      answer: [sumIsEven ? '偶' : '奇'],
      hint: (kind === '奇数')
        ? (n % 2 === 0 ? '偶数个奇数相加得偶数。' : '奇数个奇数相加得奇数。') + n + ' 个 → 和为' + (sumIsEven ? '偶' : '奇') + '数'
        : '任意个偶数相加都得偶数。' + n + ' 个偶数相加 → 和为偶数'
    });
  }

  // ============ 因数个数与因数和 ============
  function genFactorCount() {
    var n = [12, 16, 18, 20, 21, 24, 28, 30, 32, 36, 40, 42, 44, 45, 48, 54, 56, 60, 63, 66, 70, 72, 80, 84, 90, 96][ _PU.randInt(0, 25)];
    var cnt = 0;
    for (var i = 1; i <= n; i++) { if (n % i === 0) cnt++; }
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      return fillQ({
        type: 'factor-count',
        text: n + ' 有多少个因数？',
        answer: [cnt],
        hint: '成对枚举：1×' + n + ', 2×' + (n/2) + '…共 ' + cnt + ' 个'
      });
    }
    // 求所有因数之和
    var fsum = 0;
    for (var j = 1; j <= n; j++) { if (n % j === 0) fsum += j; }
    return fillQ({
      type: 'factor-count',
      text: n + ' 的所有因数之和是多少？',
      answer: [fsum],
      hint: '先列出全部因数，再求和。' + n + ' 的因数和 = ' + fsum
    });
  }

  // ============ 位值原理 ============
  function genPlace() {
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      // 位值拆分
      var abc = _PU.randInt(100, 999);
      var h = Math.floor(abc / 100), t = Math.floor(abc / 10) % 10, o = abc % 10;
      return fillQ({
        type: 'place',
        text: '一个三位数，百位数字是 ' + h + '，十位数字是 ' + t + '，个位数字是 ' + o + '。这个三位数是多少？',
        answer: [abc],
        hint: '三位数 = 100×' + h + ' + 10×' + t + ' + ' + o + ' = ' + abc
      });
    }
    // 数字交换差值
    var ab = _PU.randInt(21, 98);
    var tens = Math.floor(ab / 10), ones = ab % 10;
    if (ones === 0 || tens === ones) return genPlace();
    var swapped = ones * 10 + tens;
    return fillQ({
      type: 'place',
      text: '一个两位数，把它的十位和个位交换后得到新数。如果原数比新数大 ' + Math.abs(ab - swapped) +
        '，那么原数是多少？（提示：原数 > 新数）',
      answer: [Math.max(ab, swapped)],
      hint: '原数 − 新数 = 9×(十位−个位)，即 9×|差| = ' + Math.abs(ab - swapped)
    });
  }

  // ============ 数论最值 ============
  function genNtExtreme() {
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      // 被 d 除余 r 的最大/最小 N 位数
      var d = _PU.randInt(3, 9);
      var digits = _PU.randInt(2, 3);
      var lo = Math.pow(10, digits - 1), hi = Math.pow(10, digits) - 1;
      var r = _PU.randInt(0, d - 1);
      var candidates = [];
      for (var n = lo; n <= hi; n++) { if (n % d === r) candidates.push(n); }
      if (!candidates.length) return genNtExtreme();
      var askMax = _PU.randInt(0, 1) === 0;
      var ans = askMax ? candidates[candidates.length - 1] : candidates[0];
      return fillQ({
        type: 'nt-extreme',
        text: digits + ' 位数中，被 ' + d + ' 除余 ' + r + ' 的' + (askMax ? '最大' : '最小') + '数是多少？',
        answer: [ans],
        hint: d + ' 的倍数在 ' + lo + '~' + hi + ' 中每隔 ' + d + ' 出现一次，加余数 r 即为目标；' + (askMax ? '最大' : '最小') + '为 ' + ans
      });
    }
    // 因数个数最值
    var targets = [[4, 6], [6, 12], [8, 24], [9, 36], [10, 48], [12, 60], [16, 120], [18, 180], [20, 240]];
    var pick = targets[_PU.randInt(0, targets.length - 1)];
    var target = pick[0], smallestN = pick[1];
    return fillQ({
      type: 'nt-extreme',
      text: '恰好有 ' + target + ' 个因数的最小自然数是多少？',
      answer: [smallestN],
      hint: smallestN + ' 的因数个数为 ' + target + '，且是满足条件的最小自然数'
    });
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['divisibility', 'gcd-lcm', 'prime-factor', 'remainder', 'perfect-square', 'prime',
         'parity', 'factor-count', 'place', 'nt-extreme']
      : [type];
    var count = opts.count || 10;
    var genMap = {
      divisibility: genDivisibility, 'gcd-lcm': genGcdLcm, 'prime-factor': genPrimeFactorization,
      remainder: genRemainderCongruence, 'perfect-square': genPerfectSquare, prime: genPrimeComposite,
      parity: genParity, 'factor-count': genFactorCount, place: genPlace, 'nt-extreme': genNtExtreme
    };
    var questions = [], seen = {}, MAXTRY = count * 80;
    for (var i = 0; i < count; i++) {
      var key = keys[_PU.randInt(0, keys.length - 1)];
      var q = null;
      for (var tries = 0; tries < MAXTRY; tries++) {
        q = genMap[key]();
        if (q && !seen[q.q]) break;
      }
      if (!q) q = genMap[key]();
      if (q) { seen[q.q] = true; questions.push(q); }
    }
    return questions;
  }

  var plugin = _PU.createPlugin({
    id: 'math-competition-g5-c2',
    name: '数论（五年级）',
    subject: 'math',
    category: 'number',
    grades: [5],
    moduleId: 'C2',
    knowledgePoints: {
      5: ['math-g5-c2-divisibility', 'math-g5-c2-gcd-lcm', 'math-g5-c2-prime-factorization',
          'math-g5-c2-remainder-congruence', 'math-g5-c2-perfect-square', 'math-g5-c2-parity-analysis', 'math-g5-c2-factor-count-sum', 'math-g5-c2-place-value',
        'math-g5-c2-number-theory-extreme', 'math-g5-c2-prime-composite']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',            label: '综合' },
        { value: 'divisibility',   label: '整除特征' },
        { value: 'gcd-lcm',        label: '最大公因数与最小公倍数' },
        { value: 'prime-factor',   label: '分解质因数' },
        { value: 'remainder',      label: '余数与同余' },
        { value: 'perfect-square', label: '完全平方数' },
        { value: 'prime',          label: '质数与合数' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 5, count: (opts && opts.count) || 10, columns: 2, title: '数论（五年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
