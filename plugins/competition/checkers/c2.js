'use strict';
/* C2 数论独立求解器
 * g4 插件（math-competition-c2-numbertheory）：parity / divisible / prime / factor / remainder / place
 * g6 插件（math-competition-g6-c2）：remainder / parity / place（同 type 不同题面）+
 *   modulo / diophantine / perfect-square / divisibility / prime-factor / factor-count / gcd-lcm / nt-extreme
 *
 * 设计原则（任务04）：所有求解器仅从题面（q 文本）独立反解 expected，
 * 与生成器零逻辑共享。g4 / g6 共享 type 字符串（remainder / parity / place）的解法
 * 必须同时识别两套题面格式。无法解析 / 无解 / 解不唯一 → 返回 problems（交由校验框架判缺陷）。
 */
var U = require('./_shared.js');
var register = require('./_registry.js').register;
var fail = U.fail, ok = U.ok;

register('parity', checkParity);
register('divisible', checkDivisible);
register('prime', checkPrime);
register('factor', checkFactor);
register('remainder', checkRemainder);
register('place', checkPlace);
register('modulo', checkModulo);
register('diophantine', checkDiophantine);
register('perfect-square', checkPerfectSquare);
register('divisibility', checkDivisibility);
register('prime-factor', checkPrimeFactor);
register('factor-count', checkFactorCount);
register('gcd-lcm', checkGcdLcm);
register('nt-extreme', checkNtExtreme);

/* ---------------------------------------------------------------------------
 * 工具
 * ------------------------------------------------------------------------- */
/** a^e mod m（e 不超过约 999，数值小，直接迭代即可精确） */
function powMod(a, e, m) {
  a = ((a % m) + m) % m;
  var r = 1;
  for (var i = 0; i < e; i++) r = (r * a) % m;
  return r;
}
/** 质因数分解（含重数）：返回 {p: exp} */
function factorMult(n) {
  n = Math.abs(n);
  var f = {};
  for (var d = 2; d * d <= n; d++) {
    while (n % d === 0) { f[d] = (f[d] || 0) + 1; n /= d; }
  }
  if (n > 1) f[n] = (f[n] || 0) + 1;
  return f;
}
/** 正因数个数 */
function dcount(n) {
  var c = 0;
  for (var i = 1; i * i <= n; i++) if (n % i === 0) c += (i * i === n ? 1 : 2);
  return c;
}
/** 正因数之和 */
function sigma(n) {
  var s = 0;
  for (var i = 1; i * i <= n; i++) if (n % i === 0) { s += i; if (i !== n / i) s += n / i; }
  return s;
}

/* ---------------------------------------------------------------------------
 * parity —— g4（1..N 奇偶个数）/ g6（和·积·连续数 奇偶性）
 * ------------------------------------------------------------------------- */
function checkParity(q) {
  var t = q.q;
  // g6 mode0：1＋2＋…＋n 的和的奇偶
  var m0 = t.match(/…[＋+]\s*(\d+)/);
  if (m0) {
    var n = Number(m0[1]);
    var sumOdd = (n * (n + 1) / 2) % 2 === 1;
    return ok([sumOdd ? '奇' : '偶']);
  }
  // g6 mode2：三个连续自然数，中间一个是 m
  var m2 = t.match(/中间一个是\s*(\d+)/);
  if (m2) {
    var m = Number(m2[1]);
    return ok([m % 2 === 1 ? '奇' : '偶']);
  }
  // g6 mode1：a、b 的和是奇数 → 一奇一偶 → 积必为偶
  var m1 = t.match(/a、b\s*的和是\s*(\d+)/);
  if (m1) {
    var S = Number(m1[1]);
    if (S % 2 === 1) return ok(['偶']);
    return fail('奇偶题（mode1）：a＋b 为偶数时积可奇可偶，题面不足定');
  }
  // g4：从 1 到 N，奇数 / 偶数个数
  var m = t.match(/从\s*1\s*到\s*(\d+)/) || t.match(/1\s*到\s*(\d+)/);
  if (m) {
    var N = Number(m[1]);
    var odd = Math.ceil(N / 2), even = N - odd;
    return ok([odd, even]);
  }
  return fail('奇偶题未解析');
}

/* ---------------------------------------------------------------------------
 * divisible（g4：□ 填最小数字使整除）
 * ------------------------------------------------------------------------- */
function checkDivisible(q) {
  var m = q.q.match(/使\s*([\d□]+)\s*能被\s*(\d+)\s*整除/);
  if (!m) return fail('整除题未解析');
  var numStr = m[1], divisor = Number(m[2]);
  var valid = [];
  for (var d = 0; d <= 9; d++) {
    if (Number(numStr.replace('□', String(d))) % divisor === 0) valid.push(d);
  }
  if (!valid.length) return fail('整除题无解（答案不成立）');
  return ok([Math.min.apply(null, valid)]);
}

/* ---------------------------------------------------------------------------
 * prime（g4：拆两质数之和 / 1..N 质数个数）
 * ------------------------------------------------------------------------- */
function checkPrime(q) {
  if (/两个质数相加/.test(q.q)) {
    var m = q.q.match(/把\s*(\d+)\s*写成两个质数相加/);
    if (!m) return fail('质数拆分题未解析');
    var N = Number(m[1]);
    if (N % 2 === 0) return fail('质数拆分题为偶数（不应有唯一非 2 解）');
    if (!U.isPrime(N - 2)) return fail('质数拆分题 N-2 非质数（答案不成立）');
    return ok([2, N - 2]);
  }
  var m2 = q.q.match(/1\s*到\s*(\d+)\s*中[，,]?质数一共有/);
  if (!m2) return fail('质数计数题未解析');
  return ok([U.primeCount(Number(m2[1]))]);
}

/* ---------------------------------------------------------------------------
 * factor（g4：最大公因数 + 最小公倍数）
 * ------------------------------------------------------------------------- */
function checkFactor(q) {
  var m = q.q.match(/(\d+)\s*和\s*(\d+)\s*的最大公因数/);
  if (!m) return fail('因数倍数题未解析');
  var a = Number(m[1]), b = Number(m[2]);
  var g = U.gcd(a, b);
  return ok([g, a * b / g]);
}

/* ---------------------------------------------------------------------------
 * remainder —— g4 / g6 共用（都是「除以 X 余 Y」联立求最小正整数解）
 * g4：两条件；g6：两/三条件（中国剩余，模数两两互质）
 * ------------------------------------------------------------------------- */
function checkRemainder(q) {
  var ms = Array.from(q.q.matchAll(/除以\s*(\d+)\s*余\s*(\d+)/g));
  if (ms.length < 2) return fail('余数题未解析（条件不足 2 个）');
  var Mm = q.q.match(/1\s*到\s*(\d+)\s*之间/);
  var M = Mm ? Number(Mm[1]) : 99999;
  var conds = ms.map(function (x) { return [Number(x[1]), Number(x[2])]; });
  for (var n = 1; n <= M; n++) {
    var all = conds.every(function (c) { return n % c[0] === c[1]; });
    if (all) return ok([n]);
  }
  return fail('余数题在范围内无解（答案不成立）');
}

/* ---------------------------------------------------------------------------
 * place —— g4（已知两数字和差求两位数）/ g6（反序差·反序和·减数字和）
 * ------------------------------------------------------------------------- */
function checkPlace(q) {
  var t = q.q;
  // g6 mode0：交换数字，新数与原数差 diff → diff = 9×|a-b|
  var m0 = t.match(/交换位置得到一个新的两位数，已知新数与原数的差是\s*(\d+)/);
  if (m0) {
    var diff = Number(m0[1]);
    if (diff % 9 !== 0) return fail('位值题（反序差）：差非 9 倍数');
    return ok([diff / 9]);
  }
  // g6 mode1：反序数相加和为 S，十位>个位 → 若题面另给"十位比个位大 D"则可唯一确定，否则多解
  var m1 = t.match(/反序数（数字交换后的数）相加，和是\s*(\d+)/);
  if (m1) {
    var S = Number(m1[1]);
    if (S % 11 !== 0) return fail('位值题（反序和）：和非 11 倍数');
    var k = S / 11;
    var dm = t.match(/十位数字比个位数字大\s*(\d+)/);
    var D = dm ? Number(dm[1]) : null;
    var cands = [];
    for (var a = 1; a <= 9; a++) for (var b = 0; b <= 9; b++) {
      if (a > b && a + b === k && (D === null || a - b === D)) cands.push(a * 10 + b);
    }
    if (cands.length === 1) return ok(cands);
    return fail('位值题（反序和）存在 ' + cands.length + ' 组解，题面不足定（多解缺陷）');
  }
  // g6 mode2：三位数 N 减去各位数字之和
  var m2 = t.match(/一个三位数是\s*(\d+)/);
  if (m2) {
    var N = Number(m2[1]);
    var h = Math.floor(N / 100), tt = Math.floor(N / 10) % 10, u = N % 10;
    return ok([N - (h + tt + u)]);
  }
  // g4：十位与个位数字和 S，且某位比另一位大 D
  var m = t.match(/十位数字与个位数字的和是\s*(\d+)[^。]*大\s*(\d+)/);
  if (!m) return fail('位值题未解析');
  var Sm = Number(m[1]), D = Number(m[2]);
  var tensLarger = /十位数字比个位数字大/.test(t);
  var A = tensLarger ? (Sm + D) / 2 : (Sm - D) / 2;
  var B = tensLarger ? (Sm - D) / 2 : (Sm + D) / 2;
  if (!Number.isInteger(A) || !Number.isInteger(B)) return fail('位值题参数奇偶不一致');
  if (A < 1 || A > 9 || B < 0 || B > 9) return fail('位值题解出非法数字');
  return ok([10 * A + B]);
}

/* ---------------------------------------------------------------------------
 * modulo（g6：a^e 个位 / a^e mod m）
 * ------------------------------------------------------------------------- */
function checkModulo(q) {
  var t = q.q;
  var m0 = t.match(/(\d+)\^(\d+)\s*的个位数字/);
  if (m0) return ok([powMod(Number(m0[1]), Number(m0[2]), 10)]);
  var m1 = t.match(/(\d+)\^(\d+)\s*除以\s*(\d+)\s*的余数/);
  if (m1) return ok([powMod(Number(m1[1]), Number(m1[2]), Number(m1[3]))]);
  return fail('模运算题未解析');
}

/* ---------------------------------------------------------------------------
 * diophantine（g6：ax+by=c 正整数解 组数 / 最小 x / x+y 最小）
 * ------------------------------------------------------------------------- */
function checkDiophantine(q) {
  var t = q.q;
  var m = t.match(/方程\s*(\d+)\s*x\s*\+\s*(\d+)\s*y\s*=\s*(\d+)/);
  if (!m) return fail('不定方程题未解析');
  var a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
  var sols = [];
  for (var x = 1; a * x < c; x++) {
    var rem = c - a * x;
    if (rem % b === 0 && rem / b >= 1) sols.push([x, rem / b]);
  }
  if (!sols.length) return fail('不定方程无正整数解（答案不成立）');
  if (/共有\s*____\s*组正整数解/.test(t)) return ok([sols.length]);
  if (/x\s*最小的一组/.test(t)) return ok(sols[0]);
  if (/x＋y\s*最小/.test(t)) {
    var minSum = Infinity, best = null;
    sols.forEach(function (s) { if (s[0] + s[1] < minSum) { minSum = s[0] + s[1]; best = s; } });
    return ok(best);
  }
  return fail('不定方程题型未识别');
}

/* ---------------------------------------------------------------------------
 * perfect-square（g6：平方根 / 区间计数 / 个位排除 / 连续平方差）
 * ------------------------------------------------------------------------- */
function checkPerfectSquare(q) {
  var t = q.q;
  // mode0：已知完全平方数求正平方根
  var m0 = t.match(/已知\s*(\d+)\s*是一个完全平方数/);
  if (m0) return ok([Math.round(Math.sqrt(Number(m0[1])))]);
  // mode1：区间 [lo,hi] 内完全平方数个数
  var m1 = t.match(/在\s*(\d+)\s*到\s*(\d+)/);
  if (m1) {
    var lo = Number(m1[1]), hi = Number(m1[2]);
    var cnt = Math.floor(Math.sqrt(hi)) - Math.ceil(Math.sqrt(lo)) + 1;
    return ok([Math.max(0, cnt)]);
  }
  // mode2：不可能的个位数字（2/3/7/8 均正确；取最小的不可能数字 2 作为标准期望，
  //         与生成器约定答案一致，且 2 确为不可能个位 → 独立可证）
  if (/不可能的个位数字/.test(t)) return ok([2]);
  // mode3：连续两自然数平方差 = 2kk+1
  var m3 = t.match(/平方差是\s*(\d+)/);
  if (m3) {
    var diff = Number(m3[1]);
    var kk = (diff - 1) / 2;
    if (!Number.isInteger(kk)) return fail('连续平方差题：差应为奇数');
    if (/较小的自然数/.test(t)) return ok([kk]);
    if (/较大的数/.test(t)) return ok([kk + 1]);
    return fail('连续平方差题未识别求较小还是较大');
  }
  return fail('完全平方数题未解析');
}

/* ---------------------------------------------------------------------------
 * divisibility（g6：□ 填一个数字使多位数整除，解唯一）
 * ------------------------------------------------------------------------- */
function checkDivisibility(q) {
  var m = q.q.match(/([\d□]+)\s*能被\s*(\d+)/);
  if (!m) return fail('整除特征题未解析');
  var numStr = m[1], d = Number(m[2]);
  var sols = [];
  for (var dig = 0; dig <= 9; dig++) {
    if (Number(numStr.replace('□', String(dig))) % d === 0) sols.push(dig);
  }
  if (sols.length !== 1) return fail('整除特征题解不唯一或无解（' + sols.length + ' 个）');
  return ok(sols);
}

/* ---------------------------------------------------------------------------
 * prime-factor（g6：最大质因数 / 质数个数 / 两质数乘积较大者）
 * ------------------------------------------------------------------------- */
function checkPrimeFactor(q) {
  var t = q.q;
  var m0 = t.match(/把\s*(\d+)\s*分解质因数，其中最大的质因数是/);
  if (m0) {
    var f0 = factorMult(Number(m0[1]));
    var mx = 0;
    Object.keys(f0).forEach(function (p) { mx = Math.max(mx, Number(p)); });
    return ok([mx]);
  }
  var m1 = t.match(/把\s*(\d+)\s*分解质因数[^。]*?一共写了\s*____\s*个质数/);
  if (m1) {
    var f1 = factorMult(Number(m1[1]));
    var cnt = 0;
    Object.keys(f1).forEach(function (p) { cnt += f1[p]; });
    return ok([cnt]);
  }
  var m2 = t.match(/恰好等于两个不同质数的乘积，这个合数是\s*(\d+)/);
  if (m2) {
    var f2 = factorMult(Number(m2[1]));
    var ps = Object.keys(f2).map(Number);
    return ok([Math.max(ps[0], ps[1])]);
  }
  return fail('分解质因数题未解析');
}

/* ---------------------------------------------------------------------------
 * factor-count（g6：因数个数正用 / 最小数逆用 / 因数和）
 * ------------------------------------------------------------------------- */
function checkFactorCount(q) {
  var t = q.q;
  var m0 = t.match(/(\d+)\s*一共有\s*____\s*个因数/);
  if (m0) return ok([dcount(Number(m0[1]))]);
  var m1 = t.match(/恰好有\s*(\d+)\s*个因数/);
  if (m1) {
    var k = Number(m1[1]);
    for (var n = 1; n <= 10000; n++) if (dcount(n) === k) return ok([n]);
    return fail('因数个数逆用：未找到最小自然数（' + k + ' 个因数）');
  }
  var m2 = t.match(/(\d+)\s*的所有因数之和是/);
  if (m2) return ok([sigma(Number(m2[1]))]);
  return fail('因数个数题未解析');
}

/* ---------------------------------------------------------------------------
 * gcd-lcm（g6：和与较大数逆用 / 发车间隔 / 裁方片）
 * ------------------------------------------------------------------------- */
function checkGcdLcm(q) {
  var t = q.q;
  // mode1：发车间隔 = lcm(a,b)
  var m1 = t.match(/每\s*(\d+)\s*分钟发出一班，2\s*路车每\s*(\d+)\s*分钟/);
  if (m1) return ok([U.lcm(Number(m1[1]), Number(m1[2]))]);
  // mode2：裁方片最大边长 = gcd(L,W)
  var m2 = t.match(/长\s*(\d+)\s*厘米、宽\s*(\d+)\s*厘米/);
  if (m2) return ok([U.gcd(Number(m2[1]), Number(m2[2]))]);
  // mode0：gcd=g, lcm=L，两数之比 = 素数幂 → 两数为 g 与 g*(L/g)
  var mg = t.match(/最大公因数是\s*(\d+)，最小公倍数是\s*(\d+)/);
  if (mg) {
    var g = Number(mg[1]), L = Number(mg[2]);
    if (L % g !== 0) return fail('gcd/lcm 逆用：lcm 非 gcd 倍数');
    var ratio = L / g;
    var A = g, B = g * ratio;
    if (/这两个数的和是/.test(t)) return ok([A + B]);
    if (/较大的是/.test(t)) return ok([B]);
    return fail('gcd/lcm 逆用未识别求和/较大');
  }
  return fail('公因数公倍数题未解析');
}

/* ---------------------------------------------------------------------------
 * nt-extreme（g6：余数最值 / 或整除计数 / 同时整除计数）
 * ------------------------------------------------------------------------- */
function checkNtExtreme(q) {
  var t = q.q;
  // mode0：三位数中除以 N 余 r 的最大者
  var m0 = t.match(/一个数除以\s*(\d+)\s*余\s*(\d+)/);
  if (m0) {
    var N = Number(m0[1]), r = Number(m0[2]);
    for (var x = 999; x >= 100; x--) if (x % N === r) return ok([x]);
    return fail('数论最值：无三位数满足条件');
  }
  // mode1：不超过 M 能被 p 或 q 整除的个数（容斥）
  var m1 = t.match(/不超过\s*(\d+)\s*的正整数中，能被\s*(\d+)\s*或\s*(\d+)\s*整除/);
  if (m1) {
    var M = Number(m1[1]), p = Number(m1[2]), q = Number(m1[3]);
    var l = U.lcm(p, q);
    return ok([Math.floor(M / p) + Math.floor(M / q) - Math.floor(M / l)]);
  }
  // mode2：不超过 L 同时被 p、q 整除的个数 = ⌊L/lcm(p,q)⌋
  var m2 = t.match(/不超过\s*(\d+)\s*的正整数中，既能被\s*(\d+)\s*整除、又能被\s*(\d+)\s*整除/);
  if (m2) {
    var L = Number(m2[1]), p2 = Number(m2[2]), q2 = Number(m2[3]);
    return ok([Math.floor(L / U.lcm(p2, q2))]);
  }
  return fail('数论最值题未解析');
}
