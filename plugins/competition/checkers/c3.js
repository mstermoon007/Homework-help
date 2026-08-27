'use strict';
/* C3 组合计数独立求解器
 * g4 插件（math-competition-c3-counting）：enum / am / perm / geomcount / worst
 * g6 插件（math-competition-g6-c3）：inclusion-exclusion / recursion / derangement / geometry-count /
 *   add-principle / mult-principle / permutation / combination / enumeration / bundling / insertion /
 *   stars-bars / pigeonhole / worst-case
 *
 * g4 与 g6 的 type 字符串互不重叠（perm vs permutation、worst vs worst-case 等），
 * 因此本文件保留 g4 求解器并追加 14 个 g6 求解器。所有求解器仅从题面反解，零逻辑共享。
 */
var U = require('./_shared.js');
var register = require('./_registry.js').register;
var fail = U.fail, ok = U.ok;

/* ---------- 工具 ---------- */
function num(s, re) { var m = s.match(re); return m ? Number(m[1]) : null; }
function fact(n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; }
var C = U.comb, P = U.perm;

register('enum', checkEnum);
register('am', checkAM);
register('perm', checkPerm);
register('geomcount', checkGeomCount);
register('worst', checkWorst);

/* ===================== g4 求解器（保持原样） ===================== */
function checkEnum(q) {
  var m = q.q.match(/1\s*到\s*(\d+)\s*中，是\s*(\d+)\s*的倍数/);
  if (!m) return fail('枚举题未解析');
  var N = Number(m[1]), d = Number(m[2]), cnt = 0;
  for (var x = 1; x <= N; x++) if (x % d === 0) cnt++;
  return ok([cnt]);
}
function checkAM(q) {
  if (/上衣/.test(q.q)) {
    var m = q.q.match(/(\d+)\s*件不同的上衣和\s*(\d+)\s*条不同的裤子/);
    if (!m) return fail('加乘（上衣裤子）题未解析');
    return ok([Number(m[1]) * Number(m[2])]);
  }
  var m2 = q.q.match(/(\d+)\s*本科技书和\s*(\d+)\s*本故事书/);
  if (!m2) return fail('加乘（选书）题未解析');
  return ok([Number(m2[1]) + Number(m2[2])]);
}
function checkPerm(q) {
  var m = q.q.match(/从\s*(\d+)\s*个不同的[\s\S]*?中(?:选出|任选)\s*(\d+)\s*个/);
  if (!m) return fail('排列组合题未解析');
  var n = Number(m[1]), k = Number(m[2]);
  var isPerm = /排成一排|顺序不同/.test(q.q);
  return ok([isPerm ? U.perm(n, k) : U.comb(n, k)]);
}
function checkGeomCount(q) {
  if (/点/.test(q.q)) {
    var m = q.q.match(/[画标]了\s*(\d+)\s*个不同的点/);
    if (!m) return fail('几何计数（线段）题未解析');
    return ok([U.comb(Number(m[1]), 2)]);
  }
  var m2 = q.q.match(/由\s*(\d+)\s*[×x*]\s*(\d+)\s*个小正方形/);
  if (!m2) return fail('几何计数（网格）题未解析');
  var r = Number(m2[1]), c = Number(m2[2]);
  return ok([U.comb(r + 1, 2) * U.comb(c + 1, 2)]);
}
function checkWorst(q) {
  var m = q.q.match(/这\s*(\d+)\s*种颜色的球各[\s\S]*?有\s*(\d+)\s*个颜色相同/);
  if (!m) return fail('最不利原则题未解析');
  return ok([Number(m[1]) * (Number(m[2]) - 1) + 1]);
}

/* ===================== g6 求解器 ===================== */

/* ---------- inclusion-exclusion（容斥原理） ----------
 * 四种变形均可由题面独立反解：
 *   mode1 求「至少一组」(三交集已知) / mode2 求「都没参加」(三交集已知)
 *   mode3 求「只参加一个」(三交集已知) / mode0 求「三交集」(给出 none=都没参加人数)
 * 所有数值均从题面正则解析，与生成器零共享。 */
register('inclusion-exclusion', checkInclusionExclusion);
function checkInclusionExclusion(q) {
  var t = q.q;
  var total = num(t, /对\s*(\d+)\s*名同学/);
  var aAll = num(t, /参加数学社的有\s*(\d+)/);
  var bAll = num(t, /参加文学社的有\s*(\d+)/);
  var cAll = num(t, /参加英语社的有\s*(\d+)/);
  var PAB = num(t, /同时参加数学社和文学社的有\s*(\d+)/);
  var PBC = num(t, /同时参加文学社和英语社的有\s*(\d+)/);
  var PAC = num(t, /同时参加数学社和英语社的有\s*(\d+)/);
  if ([total, aAll, bAll, cAll, PAB, PBC, PAC].some(function (v) { return v === null; }))
    return fail('容斥题未解析');
  var triM = t.match(/三个社都参加的有\s*(\d+)/);
  var tri = triM ? Number(triM[1]) : null;
  var noneM = t.match(/(?:其中\s*)?(\d+)\s*人三个社都没有参加/);
  var none = noneM ? Number(noneM[1]) : null;
  if (/至少参加一个社的有/.test(t)) {
    if (tri === null) return fail('容斥（至少一组）未给出三交集');
    return ok([aAll + bAll + cAll - (PAB + PBC + PAC) + tri]);
  }
  if (/三个社都没有参加的有\s*____/.test(t)) {
    if (tri === null) return fail('容斥（都没参加）未给出三交集');
    var union = aAll + bAll + cAll - (PAB + PBC + PAC) + tri;
    return ok([total - union]);
  }
  if (/恰好只参加其中一个社的有/.test(t)) {
    if (tri === null) return fail('容斥（只参加一个）未给出三交集');
    var onlyOne = (aAll - PAB - PAC + tri) + (bAll - PAB - PBC + tri) + (cAll - PAC - PBC + tri);
    return ok([onlyOne]);
  }
  if (/三个社都参加的有\s*____/.test(t)) {
    // mode0 求三交集：题面已给出 none（都没参加的人数），可反解
    if (none === null) return fail('容斥（求三交集）题面未给出「都没参加」的人数，信息不足定（缺陷）');
    var union2 = total - none;
    var triCalc = union2 - (aAll + bAll + cAll) + (PAB + PBC + PAC);
    return ok([triCalc]);
  }
  return fail('容斥题未识别');
}

/* ---------- recursion（递推计数） ---------- */
register('recursion', checkRecursion);
function checkRecursion(q) {
  var t = q.q;
  if (/每步可以跨 1 级、2 级或 3 级/.test(t)) {
    var m = num(t, /共有\s*(\d+)\s*级/); if (m === null) return fail('递推（1~3级）未解析');
    var g = [1, 1, 2, 4]; for (var j = 4; j <= m; j++) g[j] = g[j - 1] + g[j - 2] + g[j - 3];
    return ok([g[m]]);
  }
  var corr = t.match(/2×(\d+)\s*的走廊/);
  if (corr) {
    var w = Number(corr[1]), h = [0, 1, 2];
    for (var k = 3; k <= w; k++) h[k] = h[k - 1] + h[k - 2];
    return ok([h[w]]);
  }
  if (/兔子|出生.*月/.test(t)) {
    var mo = num(t, /到第\s*(\d+)\s*个月/); if (mo === null) return fail('递推（兔子）未解析');
    var rab = [0, 1, 1]; for (var r = 3; r <= mo; r++) rab[r] = rab[r - 1] + rab[r - 2];
    return ok([rab[mo]]);
  }
  if (/传球/.test(t)) {
    var ps = num(t, /经过\s*(\d+)\s*次传球/); if (ps === null) return fail('递推（传球）未解析');
    return ok([(Math.pow(3, ps) + 3 * (ps % 2 === 0 ? 1 : -1)) / 4]);
  }
  var n = num(t, /楼梯共有\s*(\d+)\s*级/); if (n === null) return fail('递推（楼梯）未解析');
  var f = [1, 1]; for (var i = 2; i <= n; i++) f[i] = f[i - 1] + f[i - 2];
  return ok([f[n]]);
}

/* ---------- derangement（错排） ---------- */
register('derangement', checkDerangement);
function checkDerangement(q) {
  var t = q.q;
  var m = t.match(/(\d+)\s*位同学/) || t.match(/(\d+)\s*封信/) || t.match(/(\d+)\s*把钥匙/);
  if (!m) return fail('错排题未解析');
  var n = Number(m[1]);
  var D = [0, 0, 1]; for (var i = 3; i <= n; i++) D[i] = (i - 1) * (D[i - 1] + D[i - 2]);
  var fc = 1; for (var j = 2; j <= n; j++) fc *= j;
  if (/至少有一位同学拿到自己的礼物/.test(t)) return ok([fc - D[n]]);
  return ok([D[n]]);
}

/* ---------- geometry-count（几何计数） ---------- */
register('geometry-count', checkGeometryCountG6);
function checkGeometryCountG6(q) {
  var t = q.q;
  var mg = t.match(/(\d+)×(\d+)\s*的方格网/);
  if (mg) { var m = Number(mg[1]), nn = Number(mg[2]); return ok([C(m + 1, 2) * C(nn + 1, 2)]); }
  var vp = t.match(/凸\s*(\d+)\s*边形/);
  if (vp) { var v = Number(vp[1]); return ok([C(v, 3)]); }
  var lp = t.match(/画\s*(\d+)\s*条直线/);
  if (lp) { var L = Number(lp[1]); return ok([L * (L + 1) / 2 + 1]); }
  return fail('几何计数题未解析');
}

/* ---------- add-principle（加法原理） ---------- */
register('add-principle', checkAddPrinciple);
function checkAddPrinciple(q) {
  var t = q.q;
  var a = num(t, /高铁每天有\s*(\d+)\s*班/);
  var b = num(t, /普通列车每天有\s*(\d+)\s*班/);
  var c = num(t, /长途汽车每天有\s*(\d+)\s*班/);
  if (a !== null && b !== null && c !== null) return ok([a + b + c]);
  var x = num(t, /小包\s*(\d+)\s*种花色/);
  var y = num(t, /中包\s*(\d+)\s*种花色/);
  var z = num(t, /大包\s*(\d+)\s*种花色/);
  if (x !== null && y !== null && z !== null) return ok([x + y + z]);
  return fail('加法原理题未解析');
}

/* ---------- mult-principle（乘法原理） ---------- */
register('mult-principle', checkMultPrinciple);
function checkMultPrinciple(q) {
  var t = q.q;
  var m = num(t, /甲村到乙村有\s*(\d+)\s*条路/);
  var n = num(t, /乙村到丙村有\s*(\d+)\s*条路/);
  if (m !== null && n !== null) return ok([m * n]);
  var top = num(t, /(\d+)\s*件上衣/);
  var pant = num(t, /(\d+)\s*条裤子/);
  var hat = num(t, /(\d+)\s*顶帽子/);
  if (top !== null && pant !== null && hat !== null) return ok([top * pant * hat]);
  return fail('乘法原理题未解析');
}

/* ---------- permutation（排列） ---------- */
register('permutation', checkPermutation);
function checkPermutation(q) {
  var t = q.q;
  var full = t.match(/(\d+)\s*名同学排成一排照相/);
  if (full) return ok([fact(Number(full[1]))]);
  var fixed = t.match(/(\d+)\s*名同学排成一排，要求/);
  if (fixed) return ok([fact(Number(fixed[1]) - 1)]);
  var nn = num(t, /从\s*(\d+)\s*名选手/);
  var kk = num(t, /选出\s*(\d+)\s*人/);
  if (nn !== null && kk !== null) return ok([P(nn, kk)]);
  return fail('排列题未解析');
}

/* ---------- combination（组合与分组） ---------- */
register('combination', checkCombination);
function checkCombination(q) {
  var t = q.q;
  var n = num(t, /从\s*(\d+)\s*名同学中选出/);
  var k = num(t, /选出\s*(\d+)\s*名参加/);
  if (n !== null && k !== null) return ok([C(n, k)]);
  var total = num(t, /将\s*(\d+)\s*名同学分成/);
  var g1 = num(t, /第一组\s*(\d+)\s*人/);
  if (total !== null && g1 !== null) return ok([C(total, g1)]);
  return fail('组合题未解析');
}

/* ---------- enumeration（枚举计数） ---------- */
register('enumeration', checkEnumeration);
function checkEnumeration(q) {
  var t = q.q;
  // 数字范围：从 1~M 取出两个不同数字（默认 M=9）
  var Mm = t.match(/从\s*1\s*[~到]\s*(\d+)/);
  var M = Mm ? Number(Mm[1]) : 9;
  // 比较关系与阈值
  var opM = t.match(/和\s*(小于|大于|不超过|不大于)\s*(\d+)/);
  if (!opM) return fail('枚举题未解析');
  var op = opM[1], K = Number(opM[2]);
  var cnt = 0;
  for (var a = 1; a <= M; a++) for (var b = a + 1; b <= M; b++) {
    var s = a + b;
    if (op === '小于' && s < K) cnt++;
    else if (op === '大于' && s > K) cnt++;
    else if (op === '不超过' || op === '不大于') { if (s <= K) cnt++; }
  }
  return ok([cnt]);
}

/* ---------- bundling（捆绑法） ---------- */
register('bundling', checkBundling);
function checkBundling(q) {
  var t = q.q;
  var n = num(t, /(\d+)\s*个文艺节目/);
  var m = num(t, /(\d+)\s*个舞蹈节目/);
  if (n === null) { n = num(t, /(\d+)\s*位同学/); m = num(t, /(\d+)\s*名好朋友/); }
  if (n === null || m === null) return fail('捆绑法题未解析');
  return ok([fact(n - m + 1) * fact(m)]);
}

/* ---------- insertion（插空法） ---------- */
register('insertion', checkInsertion);
function checkInsertion(q) {
  var boys = num(q.q, /(\d+)\s*名男生/);
  var girls = num(q.q, /(\d+)\s*名女生/);
  if (boys === null || girls === null) return fail('插空法题未解析');
  return ok([fact(boys) * P(boys + 1, girls)]);
}

/* ---------- stars-bars（隔板法） ---------- */
register('stars-bars', checkStarsBars);
function checkStarsBars(q) {
  var t = q.q;
  var n = num(t, /把\s*(\d+)\s*个完全相同/);
  var k = num(t, /放进\s*(\d+)\s*个不同的盒子/);
  if (n === null || k === null) return fail('隔板法题未解析');
  if (/允许盒子空着/.test(t)) return ok([C(n + k - 1, k - 1)]);
  return ok([C(n - 1, k - 1)]);
}

/* ---------- pigeonhole（抽屉原理） ---------- */
register('pigeonhole', checkPigeonhole);
var CN_NUM = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
function checkPigeonhole(q) {
  var t = q.q;
  // 优先按数字解析类别数："X 种…" 或 "X 类…"，其次中文数字（"X 种颜色"）
  var kinds = num(t, /(\d+)\s*种/);
  if (kinds === null) kinds = num(t, /(\d+)\s*类/);
  if (kinds === null) { var cm = t.match(/([一二三四五六七八九十])\s*种颜色/); if (cm) kinds = CN_NUM[cm[1]]; }
  var want = num(t, /保证一定有\s*(\d+)/);
  if (kinds === null || want === null) return fail('抽屉原理题未解析');
  return ok([(want - 1) * kinds + 1]);
}

/* ---------- worst-case（最不利原则） ---------- */
register('worst-case', checkWorstCase);
function checkWorstCase(q) {
  var t = q.q;
  if (/一定能抽出一张/.test(t)) {
    var T3 = num(t, /扑克牌共\s*(\d+)\s*张/); if (T3 === null) return fail('最不利（抽花色）未解析');
    return ok([T3 - 12]);
  }
  if (/点数相同/.test(t)) {
    var T1 = num(t, /扑克牌共\s*(\d+)\s*张/);
    var K1 = num(t, /保证其中有\s*(\d+)\s*张牌的点数相同/);
    if (T1 === null || K1 === null) return fail('最不利（点数）未解析');
    return ok([13 * (K1 - 1) + (T1 === 54 ? 2 : 0) + 1]);
  }
  if (/花色相同/.test(t)) {
    var K2 = num(t, /保证其中有\s*(\d+)\s*张牌的花色相同/); if (K2 === null) return fail('最不利（花色）未解析');
    return ok([4 * (K2 - 1) + 1]);
  }
  if (/双颜色相同/.test(t)) {
    var k = num(t, /(\d+)\s*种颜色的袜子/);
    var pairs = num(t, /保证一定有\s*(\d+)\s*双颜色相同/);
    if (k === null || pairs === null) return fail('最不利（袜子配双）未解析');
    return ok([2 * pairs - 1 + k]);
  }
  if (/恰有同一款式的/.test(t)) {
    var kinds = num(t, /(\d+)\s*种不同样式/);
    var m = num(t, /恰有同一款式的\s*(\d+)/);
    if (kinds === null || m === null) return fail('最不利（款式）未解析');
    return ok([kinds * (m - 1) + 1]);
  }
  return fail('最不利原则题未识别');
}
