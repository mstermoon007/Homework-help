'use strict';
/* C7 分数与巧算独立求解器
 * g4 插件：telescope / complex / clever / pattern
 * g6 插件（math-competition-g6-c7）：sequence-sum
 *
 * 本模块所有题型都「逐项真算」而不套用插件用的闭式公式，
 * 这样闭式推错也能被抓出来。每步都约分，分子分母不会膨胀。
 */
var U = require('./_shared.js');
var register = require('./_registry.js').register;
var fail = U.fail, ok = U.ok;
var rat = U.rat, rAdd = U.rAdd, rMul = U.rMul, rDiv = U.rDiv, rFmt = U.rFmt;

register('telescope', checkTelescope);
register('complex', checkComplex);
register('clever', checkClever);
register('pattern', checkPattern);
register('sequence-sum', checkSequenceSum);

/** 分数答案比较：expected 为有理数；附带检查 q.answer 已约分（格式检查，非解题依据） */
function fracOk(q, right) {
  var got = U.rParse(q.answer && q.answer[0]);
  if (!got) return fail('答案无法解析为分数：' + q.answer[0]);
  if (got.n * right.d !== right.n * got.d) return fail('不符，应为 ' + rFmt(right));
  // 竞赛题要求最简分数：插件给出的标准答案本身必须已约分
  if (rFmt(got) !== String(q.answer[0]).trim()) {
    return fail('标准答案未约分：' + q.answer[0] + ' 应写作 ' + rFmt(got));
  }
  return ok([rFmt(right)]);
}

/* ---------- 裂项相消：从题面取首两项与末项，反推公差与跨度，再逐项累加 ---------- */
function checkTelescope(q) {
  var pairs = Array.from(q.q.matchAll(/1\/\((\d+)×(\d+)\)/g)).map(function (m) { return [Number(m[1]), Number(m[2])]; });
  if (pairs.length < 4) return fail('裂项题未解析到足够的项（' + pairs.length + '）');
  var a1 = pairs[0][0], d = pairs[0][1] - pairs[0][0];
  var step = pairs[1][0] - pairs[0][0];
  var aLast = pairs[pairs.length - 1][0];
  if (step <= 0 || d <= 0) return fail('裂项题项间步长解析异常');
  if ((aLast - a1) % step !== 0) return fail('裂项题末项与步长不匹配');
  for (var i = 0; i < 3; i++) {
    var a = a1 + i * step;
    if (pairs[i][0] !== a || pairs[i][1] !== a + d) return fail('裂项题第 ' + (i + 1) + ' 项不符合等差规律');
  }
  if (aLast <= pairs[2][0]) return fail('裂项题末项 1/(' + aLast + '×' + (aLast + d) + ') 已在省略号前展示过（题面自相矛盾）');
  var sum = rat(0, 1), terms = 0;
  for (var b = a1; b <= aLast; b += step) {
    sum = rAdd(sum, rat(1, b * (b + d)));
    if (++terms > 5000) return fail('裂项题项数异常');
  }
  return fracOk(q, sum);
}

/* ---------- 繁分数化简：按三种题面结构反解参数，用有理数逐层真算 ---------- */
function checkComplex(q) {
  var m = q.q.match(/1\s*÷\s*\((\d+)\s*\+\s*1\s*÷\s*\((\d+)\s*\+\s*1\/(\d+)\)\)/);
  if (m) { // 三层连分数（须先匹配，其片段包含单层结构）
    var a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
    var inner = rAdd(rat(b, 1), rat(1, c));            // b + 1/c
    var val = rDiv(rat(1, 1), rAdd(rat(a, 1), rDiv(rat(1, 1), inner)));
    return fracOk(q, val);
  }
  m = q.q.match(/\(1\s*\+\s*1\/(\d+)\)\s*÷\s*\(1\s*-\s*1\/(\d+)\)/);
  if (m) {
    if (m[1] !== m[2]) return fail('繁分数题两处分母不一致');
    var a2 = Number(m[1]);
    if (a2 < 2) return fail('繁分数题分母过小（会出现除以 0）');
    var val2 = rDiv(rAdd(rat(1, 1), rat(1, a2)), rAdd(rat(1, 1), rat(-1, a2)));
    return fracOk(q, val2);
  }
  m = q.q.match(/1\s*÷\s*\((\d+)\s*\+\s*1\/(\d+)\)/);
  if (m) {
    var a3 = Number(m[1]), b3 = Number(m[2]);
    var val3 = rDiv(rat(1, 1), rAdd(rat(a3, 1), rat(1, b3)));
    return fracOk(q, val3);
  }
  return fail('繁分数题未识别结构');
}

/* ---------- 分数巧算：分配律型 / 连乘裂项型 / 等比凑整型，均逐项真算 ---------- */
function checkClever(q) {
  var m = q.q.match(/(\d+)\/(\d+)\s*×\s*(\d+)\s*\+\s*(\d+)\/(\d+)\s*×\s*(\d+)\s*=/);
  if (m) {
    var a1 = Number(m[1]), b1 = Number(m[2]), x = Number(m[3]);
    var a2 = Number(m[4]), b2 = Number(m[5]), y = Number(m[6]);
    if (a1 !== a2 || b1 !== b2) return fail('巧算（分配律）两处分数不一致，无法提取公因数');
    var val = rAdd(rMul(rat(a1, b1), rat(x, 1)), rMul(rat(a2, b2), rat(y, 1)));
    return fracOk(q, val);
  }
  m = q.q.match(/\(1\s*-\s*1\/2\)[\s\S]*×\s*\(1\s*-\s*1\/(\d+)\)\s*=/);
  if (m) {
    var n = Number(m[1]);
    if (n <= 4) return fail('巧算（连乘）末项 (1 - 1/' + n + ') 已在省略号前展示过（题面自相矛盾）');
    var prod = rat(1, 1);
    for (var k = 2; k <= n; k++) prod = rMul(prod, rAdd(rat(1, 1), rat(-1, k)));
    return fracOk(q, prod);
  }
  m = q.q.match(/1\/2\s*\+\s*1\/4\s*\+\s*1\/8[\s\S]*\+\s*1\/(\d+)\s*=/);
  if (m) {
    var last = Number(m[1]);
    if (last <= 8) return fail('巧算（等比）末项 1/' + last + ' 已在省略号前展示过（题面自相矛盾）');
    var sum = rat(0, 1), p = 2, guard = 0;
    while (p <= last) {
      sum = rAdd(sum, rat(1, p));
      p *= 2;
      if (++guard > 60) return fail('巧算（等比）末项不是 2 的幂');
    }
    if (p !== last * 2) return fail('巧算（等比）末项 ' + last + ' 不是 2 的幂');
    return fracOk(q, sum);
  }
  return fail('巧算题未识别结构');
}

/* ---------- 分数数列规律：四个候选通项族逐一验证，要求规律唯一可辨 ---------- */
var PAT_FAMILIES = [
  function (k) { return [k, k + 1]; },
  function (k) { return [1, Math.pow(2, k)]; },
  function (k) { return [2 * k - 1, 2 * k + 1]; },
  function (k) { return [k, 2 * k + 1]; }
];
function checkPattern(q) {
  var terms = Array.from(q.q.matchAll(/(\d+)\/(\d+)/g)).map(function (m) { return [Number(m[1]), Number(m[2])]; });
  if (terms.length !== 4) return fail('规律题展示项数为 ' + terms.length + '（应为 4）');
  var km = q.q.match(/第\s*(\d+)\s*(?:项|个数)/);
  if (!km) return fail('规律题未解析到项数 k');
  var k = Number(km[1]);
  if (k <= 4) return fail('规律题所求第 ' + k + ' 项已在题面展示（答案被直接给出）');
  var hit = PAT_FAMILIES.filter(function (f) {
    return terms.every(function (t, i) {
      var e = f(i + 1);
      return e[0] * t[1] === t[0] * e[1]; // 按数值等价比较，容许展示项非最简
    });
  });
  if (!hit.length) return fail('规律题前 4 项不符合任何候选通项族（规律不明确）');
  if (hit.length > 1) return fail('规律题前 4 项同时符合 ' + hit.length + ' 个通项族（规律不唯一）');
  var e = hit[0](k);
  return fracOk(q, rat(e[0], e[1]));
}

/* ---------- 数列求和（g6-c7）：平方和 / 立方和公式 ---------- */
function checkSequenceSum(q) {
  var t = q.q;
  var sq = t.match(/(\d+)²\s*=\s*____/);
  if (sq) {
    var n = Number(sq[1]);
    return ok([n * (n + 1) * (2 * n + 1) / 6]);
  }
  var cu = t.match(/(\d+)³\s*=\s*____/);
  if (cu) {
    var m = Number(cu[1]);
    var tri = m * (m + 1) / 2;
    return ok([tri * tri]);
  }
  return fail('数列求和题未识别');
}
