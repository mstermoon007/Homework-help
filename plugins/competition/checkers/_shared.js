'use strict';
/* plugins/competition/checkers/_shared.js — 独立校验器共享工具
 *
 * 这些工具只服务于「从题面反解答案」的独立求解器，
 * 与插件的生成逻辑零共享，避免生成器与校验器犯同一个错误。
 */

/** 去掉 HTML 标签与实体，得到纯文本 */
function strip(s) {
  return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/** 求解失败：统一返回 { problems } 结构 */
function fail(msg) { return { problems: [msg] }; }
/** 求解成功：返回 { expected }（expected 为数组，多空题按空序） */
function ok(expected) { return { expected: Array.isArray(expected) ? expected : [expected] }; }

/* ---------- 数论工具 ---------- */
function isPrime(n) {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  for (var i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}
function primeCount(N) { var c = 0; for (var n = 2; n <= N; n++) if (isPrime(n)) c++; return c; }
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a; }
function lcm(a, b) { return a / gcd(a, b) * b; }

/* ---------- 组合计数工具 ---------- */
function fact(n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; }
function perm(n, k) { if (k < 0 || k > n) return 0; return fact(n) / fact(n - k); }
function comb(n, k) { if (k < 0 || k > n) return 0; return fact(n) / (fact(k) * fact(n - k)); }
function permute(a) {
  if (a.length <= 1) return [a.slice()];
  var out = [];
  a.forEach(function (v, i) {
    permute(a.slice(0, i).concat(a.slice(i + 1))).forEach(function (p) { out.push([v].concat(p)); });
  });
  return out;
}

/* ---------- 有理数精确运算（分数类题型用） ---------- */
function rat(n, d) {
  if (d < 0) { n = -n; d = -d; }
  var g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
function rAdd(x, y) { return rat(x.n * y.d + y.n * x.d, x.d * y.d); }
function rMul(x, y) { return rat(x.n * y.n, x.d * y.d); }
function rDiv(x, y) { return rat(x.n * y.d, x.d * y.n); }
/** 解析「整数 / a/b / 小数」为有理数 */
function rParse(s) {
  s = String(s == null ? '' : s).trim().replace(/\s+/g, '');
  var m = s.match(/^(-?\d+)\/(\d+)$/);
  if (m) return Number(m[2]) ? rat(Number(m[1]), Number(m[2])) : null;
  if (/^-?\d+$/.test(s)) return rat(Number(s), 1);
  m = s.match(/^(-?)(\d*)\.(\d+)$/);
  if (m) {
    var den = Math.pow(10, m[3].length);
    return rat((m[1] === '-' ? -1 : 1) * (Number(m[2] || '0') * den + Number(m[3])), den);
  }
  return null;
}
function rFmt(r) { return r.d === 1 ? String(r.n) : r.n + '/' + r.d; }

/** 取题干全文（q + svg 纯文本），解析题面用 */
function textOf(q) { return strip(q && q.q) + ' ' + strip(q && q.svg); }

module.exports = {
  strip: strip, fail: fail, ok: ok,
  isPrime: isPrime, primeCount: primeCount, gcd: gcd, lcm: lcm,
  fact: fact, perm: perm, comb: comb, permute: permute,
  rat: rat, rAdd: rAdd, rMul: rMul, rDiv: rDiv, rParse: rParse, rFmt: rFmt,
  textOf: textOf
};
