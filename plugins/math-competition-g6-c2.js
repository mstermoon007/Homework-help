// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g6-c2.js — 六年级竞赛 C2 数论深化（新语义题型）
// 实现题型（type 与知识库一致）：
//   remainder       同余方程与剩余定理（互质模数联立求最小解）
//   modulo          模运算与周期（大指数的末位 / 余数周期）
//   diophantine     不定方程整数解（解的组数 / 最小 x 解 / x+y 最小值）
//   perfect-square  完全平方数性质（求平方根 / 区间计数 / 个位排除 / 连续平方差）
//   divisibility    整除特征（含 □ 缺数、7/9/11/13 判定）
//   parity          奇偶分析（和的奇偶、积的奇偶、连续自然数）
//   prime-factor    分解质因数（最大质因数 / 质数个数 / 两质乘积）
//   factor-count    因数个数与因数和（正用 / 最小数逆用 / 因数和）
//   gcd-lcm         公因数公倍数（和与较大数逆用 / 发车间隔 / 裁方片）
//   place           位值原理（反序差 / 反序和 / 减数字和）
//   nt-extreme      数论最值（余数最值 / 或整除计数 / 同时整除计数）
// 设计要点：幂余用周期检测；同余方程模数两两互质保证唯一解；
// 不定方程按枚举计数出题；缺数整除题暴力验证唯一解；gcd/lcm 逆用
// 取 l/g 为素数幂保证答案唯一。

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

  // ============ 5. 整除特征（7、11、13 综合） ============
  /** 含一个 □ 的多位数整除判定：暴力验证答案唯一 */
  function genDivisibility() {
    var divisors = [7, 9, 11, 13];
    var d = divisors[_PU.randInt(0, divisors.length - 1)];
    var len = _PU.randInt(4, 5);
    var digits = [];
    for (var i = 0; i < len; i++) digits.push(_PU.randInt(0, 9));
    digits[0] = _PU.randInt(1, 9);
    var hole = _PU.randInt(1, len - 1);
    var sols = [];
    for (var dd = 0; dd <= 9; dd++) {
      var val = 0;
      for (var k2 = 0; k2 < len; k2++) {
        val = val * 10 + (k2 === hole ? dd : digits[k2]);
      }
      if (val % d === 0) sols.push({ d: dd, v: val });
    }
    if (sols.length !== 1) return genDivisibility();
    var shown = '';
    for (var s = 0; s < len; s++) shown += (s === hole ? '□' : String(digits[s]));
    var hit = sols[0];
    return fillQ({
      type: 'divisibility',
      text: '在 □ 中填入一个数字，使' + (len === 5 ? '五' : '四') + '位数 ' + shown +
        ' 能被 ' + d + ' 整除。□ 里应填 ____。',
      answer: [hit.d],
      hint: '逐一试填 0~9（或用 ' + d + ' 的整除特征检验），只有填 ' + hit.d +
        ' 时成立：' + hit.v + ' = ' + d + '×' + (hit.v / d)
    });
  }

  // ============ 6. 奇偶分析（构造与证明） ============
  function genParity() {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      var n = _PU.randInt(8, 30);
      var sumOdd = (n * (n + 1) / 2) % 2 === 1;
      return fillQ({
        type: 'parity',
        text: '1＋2＋3＋…＋' + n + ' 的和是奇数还是偶数？（填「奇」或「偶」）',
        answer: [sumOdd ? '奇' : '偶'],
        single: true,
        hint: '和 = ' + n + '×' + (n + 1) + '÷2 = ' + (n * (n + 1) / 2) +
          '；也可以看其中奇数的个数：有 ' + Math.ceil(n / 2) + ' 个奇数，奇数个数为' +
          (Math.ceil(n / 2) % 2 === 1 ? '奇数个 → 和为奇数' : '偶数个 → 和为偶数')
      });
    }
    if (mode === 1) {
      var s = _PU.randInt(21, 99) * 2 + 1;
      return fillQ({
        type: 'parity',
        text: '两个自然数 a、b 的和是 ' + s + '，那么 a×b 的积是奇数还是偶数？（填「奇」或「偶」）',
        answer: ['偶'],
        single: true,
        hint: '和 ' + s + ' 为奇数 → a、b 必为一奇一偶 → 奇×偶 = 偶，故乘积一定是偶数'
      });
    }
    var m = _PU.randInt(10, 60);
    return fillQ({
      type: 'parity',
      text: '三个连续自然数，中间一个是 ' + m + '。这三个数的和是奇数还是偶数？（填「奇」或「偶」）',
      answer: [m % 2 === 1 ? '奇' : '偶'],
      single: true,
      hint: '三数之和 = 3×' + m + ' = ' + (3 * m) + '；' + m + ' 是' + (m % 2 === 1 ? '奇数，3×奇数仍为奇数' : '偶数，3×偶数仍为偶数')
    });
  }

  // ============ 7. 分解质因数（大数） ============
  var PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];
  function genPrimeFactor() {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      var i1 = _PU.randInt(5, 11), i2, i3;
      do { i2 = _PU.randInt(5, 13); } while (i2 === i1);
      do { i3 = _PU.randInt(0, 4); } while (i3 === i1 || i3 === i2);
      var p1 = PRIMES[i1], p2 = PRIMES[i2], p3 = PRIMES[i3];
      var n = p1 * p2 * p3;
      return fillQ({
        type: 'prime-factor',
        text: '把 ' + n + ' 分解质因数，其中最大的质因数是 ____。',
        answer: [Math.max(p1, p2, p3)],
        hint: '短除法：' + n + ' = ' + p1 + '×' + p2 + '×' + p3 + '，最大的质因数是 ' + Math.max(p1, p2, p3)
      });
    }
    if (mode === 1) {
      var a = _PU.randInt(2, 5), b = _PU.randInt(1, 3), c = _PU.randInt(0, 2);
      var m = Math.pow(2, a) * Math.pow(3, b) * Math.pow(5, c);
      var cnt = a + b + c;
      var parts = ['2^' + a, '3^' + b];
      if (c) parts.push('5^' + c);
      return fillQ({
        type: 'prime-factor',
        text: '把 ' + m + ' 分解质因数，写成若干质数连乘的形式（相同的质数也分开写），一共写了 ____ 个质数。',
        answer: [cnt],
        hint: m + ' = ' + parts.join('×') + ' → 质数个数 = 指数之和 ' + a + '+' + b + (c ? '+' + c : '') + '=' + cnt
      });
    }
    var pi = _PU.randInt(4, 9), pj;
    do { pj = _PU.randInt(4, 13); } while (pj === pi);
    var lo = Math.min(PRIMES[pi], PRIMES[pj]), hi = Math.max(PRIMES[pi], PRIMES[pj]);
    return fillQ({
      type: 'prime-factor',
      text: '一个合数恰好等于两个不同质数的乘积，这个合数是 ' + (lo * hi) + '。这两个质数中较大的是 ____。',
      answer: [hi],
      hint: (lo * hi) + ' = ' + lo + '×' + hi + '（' + lo + '、' + hi + ' 都是质数），较大的是 ' + hi
    });
  }

  // ============ 8. 因数个数与因数和（逆用） ============
  var MIN_WITH_DIVISORS = { 2: 2, 3: 4, 4: 6, 5: 16, 6: 12, 8: 24, 9: 36, 10: 48, 12: 60, 16: 120, 18: 180, 20: 240, 24: 360 };
  function sigma(n) {
    var s = 0;
    for (var i = 1; i * i <= n; i++) {
      if (n % i === 0) { s += i; if (i !== n / i) s += n / i; }
    }
    return s;
  }
  function genFactorCount() {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      var a = _PU.randInt(1, 5), b = _PU.randInt(1, 3);
      var n = Math.pow(2, a) * Math.pow(3, b);
      var cnt = (a + 1) * (b + 1);
      return fillQ({
        type: 'factor-count',
        text: n + ' 一共有 ____ 个因数。',
        answer: [cnt],
        hint: n + ' = 2^' + a + '×3^' + b + '，因数个数 = (' + a + '+1)×(' + b + '+1) = ' + cnt
      });
    }
    if (mode === 1) {
      var keys = Object.keys(MIN_WITH_DIVISORS);
      var k = keys[_PU.randInt(0, keys.length - 1)];
      var min = MIN_WITH_DIVISORS[k];
      return fillQ({
        type: 'factor-count',
        text: '一个自然数恰好有 ' + k + ' 个因数，满足条件的最小自然数是 ____。',
        answer: [min],
        hint: '按因数个数公式逆推：取指数方案使乘积最小 → ' + min + ' 恰有 ' + k + ' 个因数，且没有更小的数有 ' + k + ' 个因数'
      });
    }
    var nn = _PU.randInt(20, 120);
    return fillQ({
      type: 'factor-count',
      text: nn + ' 的所有因数之和是 ____。',
      answer: [sigma(nn)],
      hint: '成对找因数（1 和本身、2 和对偶……）逐对相加，总和 = ' + sigma(nn)
    });
  }

  // ============ 9. 最大公因数与最小公倍数（应用） ============
  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  function lcm(a, b) { return a / gcd(a, b) * b; }
  /** 最小公倍数÷最大公因数取素数幂，保证互质拆分唯一、答案唯一 */
  var PP_RATIOS = [4, 8, 9, 16, 25, 27];
  function genGcdLcm() {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      var ratio = PP_RATIOS[_PU.randInt(0, PP_RATIOS.length - 1)];
      var g = _PU.randInt(3, 12);
      var A = g, B = g * ratio;
      if (_PU.randInt(0, 1) === 0) {
        return fillQ({
          type: 'gcd-lcm',
          text: '两个数的最大公因数是 ' + g + '，最小公倍数是 ' + lcm(A, B) + '。这两个数的和是 ____。',
          answer: [A + B],
          hint: '最小公倍数 ÷ 最大公因数 = ' + ratio + '，两数之比只能拆成 1:' + ratio +
            '（' + ratio + ' 是素数幂）→ 两数为 ' + A + ' 和 ' + B + '，和为 ' + (A + B)
        });
      }
      return fillQ({
        type: 'gcd-lcm',
        text: '两个数的最大公因数是 ' + g + '，最小公倍数是 ' + lcm(A, B) + '。这两个数中较大的是 ____。',
        answer: [B],
        hint: '最小公倍数 ÷ 最大公因数 = ' + ratio + '，两数只能是 ' + A + ' 和 ' + B + '（比 ' + ratio +
          ':1），较大的是 ' + B
      });
    }
    if (mode === 1) {
      var a = _PU.randInt(6, 15), b = a + _PU.randInt(1, 8);
      return fillQ({
        type: 'gcd-lcm',
        text: '公交总站有两条线路，1 路车每 ' + a + ' 分钟发出一班，2 路车每 ' + b +
          ' 分钟发出一班。早上 8:00 两路车同时发车，下次同时发车是经过 ____ 分钟之后。',
        answer: [lcm(a, b)],
        hint: '再次同时发车的间隔是两班间隔的最小公倍数：[' + a + ', ' + b + '] = ' + lcm(a, b) + ' 分钟'
      });
    }
    var g2 = _PU.randInt(4, 9);
    var mx = _PU.randInt(4, 8), my;
    do { my = _PU.randInt(3, 7); } while (my === mx);
    var L = g2 * mx, W = g2 * my;
    return fillQ({
      type: 'gcd-lcm',
      text: '一张长 ' + L + ' 厘米、宽 ' + W + ' 厘米的长方形纸，要剪成同样大小的正方形小纸片且没有剩余，小纸片的边长最大是 ____ 厘米。',
      answer: [g2],
      hint: '最大边长 = 长、宽的最大公因数：(' + L + ', ' + W + ') = ' + g2 + ' 厘米，可剪 ' +
        (L / g2) + '×' + (W / g2) + ' 张'
    });
  }

  // ============ 10. 位值原理（多位数） ============
  function genPlace() {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      var a = _PU.randInt(2, 9), b;
      do { b = _PU.randInt(1, 8); } while (b === a);
      var diff = 9 * Math.abs(a - b);
      return fillQ({
        type: 'place',
        text: '一个两位数，把它的十位数字与个位数字交换位置得到一个新的两位数，已知新数与原数的差是 ' + diff +
          '。原来两位数十位数字与个位数字相差 ____。',
        answer: [Math.abs(a - b)],
        hint: '差 = 9×两数字之差：' + diff + ' ÷ 9 = ' + (diff / 9)
      });
    }
    if (mode === 1) {
      var aa = _PU.randInt(3, 9), bb;
      do { bb = _PU.randInt(1, aa - 1); } while (aa - bb < 1);
      var S = 11 * (aa + bb);
      return fillQ({
        type: 'place',
        text: '一个两位数与其反序数（数字交换后的数）相加，和是 ' + S + '；又知道它的十位数字比个位数字大。原来的两位数是 ____。',
        answer: [aa * 10 + bb],
        hint: '两数之和 = 11×数字和 → 数字和 = ' + (S / 11) + '；十位大于个位，只能拆成 ' + aa + '+' + bb +
          ' → 原数为 ' + (aa * 10 + bb)
      });
    }
    var h = _PU.randInt(1, 9), t = _PU.randInt(0, 9), u = _PU.randInt(0, 9);
    var N = h * 100 + t * 10 + u;
    return fillQ({
      type: 'place',
      text: '一个三位数是 ' + N + '，它减去自己的各位数字之和，差是 ____。',
      answer: [N - (h + t + u)],
      hint: N + ' − (' + h + '+' + t + '+' + u + ') = ' + N + ' − ' + (h + t + u) +
        ' = ' + (N - h - t - u) + '（规律：差 = 99×百位 ＋ 9×十位）'
    });
  }

  // ============ 11. 数论最值（整除与余数） ============
  var OR_PAIRS = [[4, 6, 12], [6, 10, 30], [4, 10, 20], [6, 14, 42], [8, 12, 24], [6, 15, 30], [9, 12, 36], [10, 14, 70]];
  function genNtExtreme() {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      var N = _PU.randInt(5, 12), r = _PU.randInt(1, N - 1);
      var best = -1;
      for (var x = 999; x >= 100; x--) {
        if (x % N === r) { best = x; break; }
      }
      return fillQ({
        type: 'nt-extreme',
        text: '一个数除以 ' + N + ' 余 ' + r + '。这样的三位数中，最大的是 ____。',
        answer: [best],
        hint: '从 999 往下枚举，第一个除以 ' + N + ' 余 ' + r + ' 的就是答案：999÷' + N +
          ' 余 ' + (999 % N) + '，最大为 ' + best
      });
    }
    if (mode === 1) {
      var pr = OR_PAIRS[_PU.randInt(0, OR_PAIRS.length - 1)];
      var M = [_PU.randInt(2, 9) * 100][0];
      var cnt = Math.floor(M / pr[0]) + Math.floor(M / pr[1]) - Math.floor(M / pr[2]);
      return fillQ({
        type: 'nt-extreme',
        text: '不超过 ' + M + ' 的正整数中，能被 ' + pr[0] + ' 或 ' + pr[1] + ' 整除的数共有 ____ 个。',
        answer: [cnt],
        hint: '被 ' + pr[0] + ' 整除有 ' + Math.floor(M / pr[0]) + ' 个，被 ' + pr[1] + ' 整除有 ' +
          Math.floor(M / pr[1]) + ' 个，同时整除（即被 [' + pr[0] + ', ' + pr[1] + ']=' + pr[2] +
          ' 整除）被算了两次，减去 ' + Math.floor(M / pr[2]) + ' → 共 ' + cnt + ' 个'
      });
    }
    var pr2 = OR_PAIRS[_PU.randInt(0, OR_PAIRS.length - 1)];
    var L = _PU.randInt(3, 8) * pr2[2];
    return fillQ({
      type: 'nt-extreme',
      text: '不超过 ' + L + ' 的正整数中，既能被 ' + pr2[0] + ' 整除、又能被 ' + pr2[1] + ' 整除的数共有 ____ 个。',
      answer: [Math.floor(L / pr2[2])],
      hint: '同时被两数整除 = 被 [' + pr2[0] + ', ' + pr2[1] + ']=' + pr2[2] + ' 整除 → ⌊' + L + '÷' + pr2[2] + '⌋ = ' + Math.floor(L / pr2[2])
    });
  }

  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = { kmax: lv >= 8 ? 14 : (lv >= 5 ? 10 : 7) };
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['remainder', 'modulo', 'diophantine', 'perfect-square',
        'divisibility', 'parity', 'prime-factor', 'factor-count',
        'gcd-lcm', 'place', 'nt-extreme']
      : [type];
    var count = opts.count || 10;
    var genMap = {
      remainder: genCongruence,
      modulo: genModulo,
      diophantine: genDiophantine,
      'perfect-square': function () { return genPerfectSquare(sc); },
      divisibility: genDivisibility,
      parity: genParity,
      'prime-factor': genPrimeFactor,
      'factor-count': genFactorCount,
      'gcd-lcm': genGcdLcm,
      place: genPlace,
      'nt-extreme': genNtExtreme
    };
    // type → 知识点 ID（与知识库/声明一致），供自适应难度做知识点粒度统计
    var TYPE_TO_KP = {
      remainder: 'g6-c2-remainder-congruence',
      modulo: 'g6-c2-modulo-arithmetic',
      diophantine: 'g6-c2-diophantine-equation',
      'perfect-square': 'g6-c2-perfect-square',
      divisibility: 'g6-c2-divisibility',
      parity: 'g6-c2-parity-analysis',
      'prime-factor': 'g6-c2-prime-factorization',
      'factor-count': 'g6-c2-factor-count-sum',
      'gcd-lcm': 'g6-c2-gcd-lcm',
      place: 'g6-c2-place-value',
      'nt-extreme': 'g6-c2-number-theory-extreme'
    };
    var questions = [], seen = {}, MAXTRY = count * 80;
    for (var i = 0; i < count; i++) {
      var key = keys[i % keys.length];
      var q = null;
      for (var tries = 0; tries < MAXTRY; tries++) {
        q = genMap[key]();
        if (q && !seen[q.q]) break;
      }
      if (q) {
        seen[q.q] = true;
        if (TYPE_TO_KP[key]) q.knowledgePointId = TYPE_TO_KP[key];
        q.difficulty = lv;
        questions.push(q);
      }
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
      6: ['g6-c2-remainder-congruence', 'g6-c2-modulo-arithmetic', 'g6-c2-diophantine-equation', 'g6-c2-perfect-square',
        'g6-c2-divisibility', 'g6-c2-parity-analysis', 'g6-c2-prime-factorization', 'g6-c2-factor-count-sum',
        'g6-c2-gcd-lcm', 'g6-c2-place-value', 'g6-c2-number-theory-extreme']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',            label: '综合' },
        { value: 'remainder',      label: '同余方程' },
        { value: 'modulo',         label: '模运算与周期' },
        { value: 'diophantine',    label: '不定方程整数解' },
        { value: 'perfect-square', label: '完全平方数性质' },
        { value: 'divisibility',   label: '整除特征' },
        { value: 'parity',         label: '奇偶分析' },
        { value: 'prime-factor',   label: '分解质因数' },
        { value: 'factor-count',   label: '因数个数与因数和' },
        { value: 'gcd-lcm',        label: '公因数与公倍数' },
        { value: 'place',          label: '位值原理' },
        { value: 'nt-extreme',     label: '数论最值' }
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
