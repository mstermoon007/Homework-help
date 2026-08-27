'use strict';
/* C4 几何模型独立求解器
 * g4 插件（math-competition-c4-geometry）：pa / cutfill / angle / count / transform / solid
 * g6 插件（math-competition-g6-c4）：solid（同 type 不同题面）+ circle / circle-angle / solid-rotation
 */
var U = require('./_shared.js');
var register = require('./_registry.js').register;
var fail = U.fail, ok = U.ok;

function num(s, re) { var m = s.match(re); return m ? Number(m[1]) : null; }

register('pa', checkPA);
register('cutfill', checkCutFill);
register('angle', checkAngle);
register('count', checkCount);
register('transform', checkTransform);
register('solid', checkSolid);
register('circle-angle', checkCircleAngle);
register('solid-rotation', checkSolidRotation);
register('circle', checkCircle);

/* ---------- g4 周长与面积 ---------- */
function checkPA(q) {
  if (/正方形/.test(q.q)) {
    var m = q.q.match(/边长是\s*(\d+)\s*厘米/);
    if (!m) return fail('周长面积（正方形）题未解析');
    var s = Number(m[1]);
    return ok([4 * s, s * s]);
  }
  if (/宽是\s*____\s*厘米/.test(q.q)) {
    var m2 = q.q.match(/周长是\s*(\d+)\s*厘米，长是\s*(\d+)\s*厘米/);
    if (!m2) return fail('周长面积（求宽）题未解析');
    var P = Number(m2[1]), L = Number(m2[2]);
    return ok([P / 2 - L]);
  }
  var m3 = q.q.match(/长是\s*(\d+)\s*厘米，宽是\s*(\d+)\s*厘米/);
  if (!m3) return fail('周长面积（长方形）题未解析');
  var L2 = Number(m3[1]), W = Number(m3[2]);
  return ok([2 * (L2 + W), L2 * W]);
}

/* ---------- g4 割补法 ---------- */
function checkCutFill(q) {
  var m = q.q.match(/长\s*(\d+)\s*厘米、宽\s*(\d+)\s*厘米的长方形和一个边长\s*(\d+)\s*厘米的正方形/);
  if (!m) return fail('割补法题未解析');
  return ok([Number(m[1]) * Number(m[2]) + Number(m[3]) * Number(m[3])]);
}

/* ---------- g4 角度初步 ---------- */
function checkAngle(q) {
  if (/∠1 = \d+°．∠2 = \d+°/.test(q.q) || /∠1 = \d+°，∠2 = \d+°/.test(q.q)) {
    var m = q.q.match(/∠1 = (\d+)°[，,]\s*∠2 = (\d+)°/);
    if (!m) return fail('角度（三角形）题未解析');
    return ok([180 - Number(m[1]) - Number(m[2])]);
  }
  if (/互余/.test(q.q)) {
    var m2 = q.q.match(/∠A = (\d+)°/);
    if (!m2) return fail('角度（互余）题未解析');
    return ok([90 - Number(m2[1])]);
  }
  if (/互补/.test(q.q)) {
    var m3 = q.q.match(/∠A = (\d+)°/);
    if (!m3) return fail('角度（互补）题未解析');
    return ok([180 - Number(m3[1])]);
  }
  return fail('角度题未识别模式');
}

/* ---------- g4 图形计数：正方形总数 ---------- */
function checkCount(q) {
  var a = null, b = null;
  var m = q.q.match(/由\s*(\d+)×(\d+)\s*个小正方形组成/);
  if (m) { a = Number(m[1]); b = Number(m[2]); }
  else {
    m = q.q.match(/(\d+)×(\d+)\s*方格的网格纸/);
    if (m) { a = Number(m[1]); b = Number(m[2]); }
    else {
      m = q.q.match(/共\s*(\d+)\s*行、(\d+)\s*列小正方形/);
      if (m) { a = Number(m[1]); b = Number(m[2]); }
    }
  }
  if (a === null) return fail('图形计数题未解析');
  var mn = Math.min(a, b);
  var total = 0;
  for (var k = 1; k <= mn; k++) total += (a - k + 1) * (b - k + 1);
  return ok([total]);
}

/* ---------- g4 对称与变换 ---------- */
function checkTransform(q) {
  var m = q.q.match(/正\s*(\d+)\s*边形/);
  if (!m) return fail('对称题未解析');
  return ok([Number(m[1])]);
}

/* ---------- 立体图形：g4 为 a×b×c 长方体小正方体数；g6 为切割/8分/顶点挖孔（同 type 不同题面） ---------- */
function checkSolid(q) {
  var t = q.q;
  // g4：a×b×c 长方体由多少个小正方体组成
  var m = t.match(/(\d+)×(\d+)×(\d+)\s*的长方体/);
  if (m) return ok([Number(m[1]) * Number(m[2]) * Number(m[3])]);
  // g6 mode0：长方体沿垂直于长的方向切一刀 → 新增 2 个截面（宽×高）
  var m0 = t.match(/长\s*(\d+)\s*厘米、宽\s*(\d+)\s*厘米、高\s*(\d+)\s*厘米[\s\S]*?切一刀[\s\S]*?表面积比原来增加了/);
  if (m0) return ok([2 * Number(m0[2]) * Number(m0[3])]);
  // g6 mode1：横截面长×宽 的长方体，平行切 cuts 刀 → 新增 2×cuts 个截面
  var m1 = t.match(/横截面长\s*(\d+)\s*厘米、宽\s*(\d+)\s*厘米[\s\S]*?平行地切了\s*(\d+)\s*刀[\s\S]*?表面积一共比原来增加了/);
  if (m1) return ok([2 * Number(m1[3]) * Number(m1[1]) * Number(m1[2])]);
  // g6 mode2：正方体切成 8 个相同小正方体 → 表面积和 = 8×6×(a/2)²
  var m2 = t.match(/棱长为\s*(\d+)\s*厘米的正方体切成\s*8\s*个相同的小正方体/);
  if (m2) { var a2 = Number(m2[1]); return ok([8 * 6 * (a2 / 2) * (a2 / 2)]); }
  // g6 mode3：顶点处挖去小正方体 → 表面积不变 = 6a²
  var m3 = t.match(/棱长为\s*(\d+)\s*厘米的正方体，在其一个顶点处挖去一个棱长为\s*\d+\s*厘米的小正方体/);
  if (m3) return ok([6 * Number(m3[1]) * Number(m3[1])]);
  return fail('立体图形题未解析');
}

/* ---------- 圆角度（圆周角定理） ---------- */
function checkCircleAngle(q) {
  var t = q.q;
  // 同弧圆周角相等：已知 ∠ADB，求 ∠ACB
  var m2 = t.match(/圆周角\s*∠ADB\s*=\s*(\d+)°/);
  if (m2) return ok([Number(m2[1])]);
  // 已知圆心角 ∠AOB，求圆周角 ∠ACB = a/2
  var mA = t.match(/∠AOB\s*=\s*(\d+)°/);
  if (mA && /∠ACB\s*=\s*____/.test(t)) return ok([Number(mA[1]) / 2]);
  // 已知圆周角 ∠ACB，求圆心角 ∠AOB = 2b
  var mB = t.match(/圆周角\s*∠ACB\s*=\s*(\d+)°/);
  if (mB && /∠AOB\s*=\s*____/.test(t)) return ok([2 * Number(mB[1])]);
  return fail('圆角度题未解析');
}

/* ---------- 旋转体（圆柱/圆锥，π=3.14，与生成器同公式同舍入） ---------- */
function checkSolidRotation(q) {
  var t = q.q, pi = 3.14;
  // 直角三角形绕直角边 → 圆锥体积 V = πr²h/3（h=旋转轴那条边，r=另一条直角边）
  var cone = t.match(/两条直角边分别为\s*(\d+)\s*厘米和\s*(\d+)\s*厘米的直角三角形绕长为\s*(\d+)\s*厘米的直角边旋转/);
  if (cone) {
    var hc = Number(cone[1]), rc = Number(cone[2]), axis = Number(cone[3]);
    var rcone = (hc === axis) ? rc : hc, hcone = axis;
    return ok([Math.round(pi * rcone * rcone * hcone / 3 * 100) / 100]);
  }
  // 长方形绕长边 → 圆柱体积 V = πr²h（r=宽，h=长）
  var cylV = t.match(/长\s*(\d+)\s*厘米、宽\s*(\d+)\s*厘米的长方形绕它的长边旋转一周，得到一个圆柱。这个圆柱的体积/);
  if (cylV) {
    var h = Number(cylV[1]), r = Number(cylV[2]);
    return ok([Math.round(pi * r * r * h * 100) / 100]);
  }
  // 长方形绕长边 → 圆柱表面积 S = 2πr(h+r)
  var cylS = t.match(/长\s*(\d+)\s*厘米、宽\s*(\d+)\s*厘米的长方形绕它的长边旋转一周得到圆柱。这个圆柱的表面积/);
  if (cylS) {
    var hh = Number(cylS[1]), rr = Number(cylS[2]);
    return ok([Math.round(2 * pi * rr * (hh + rr) * 100) / 100]);
  }
  return fail('旋转体题未解析');
}

/* ---------- 圆与扇形组合（阴影面积/半圆周长，π=3.14，与生成器同公式同舍入） ---------- */
function checkCircle(q) {
  var t = q.q, pi = 3.14;
  // 正方形内最大圆：正方形面积 − 圆面积 = a²(1−π/4)
  if (/正方形内画一个最大的圆/.test(t)) {
    var a = num(t, /边长为\s*(\d+)\s*厘米/);
    if (a === null) return fail('圆组合（正方内圆）未解析');
    return ok([Math.round((a * a - pi * (a / 2) * (a / 2)) * 100) / 100]);
  }
  // 90° 扇形弓形：扇形 − 等腰直角三角形
  if (/圆心角为\s*90°\s*的扇形/.test(t)) {
    var r2 = num(t, /半径为\s*(\d+)\s*厘米/);
    if (r2 === null) return fail('圆组合（扇形弓形）未解析');
    return ok([Math.round((pi * r2 * r2 / 4 - r2 * r2 / 2) * 100) / 100]);
  }
  // 叶形：两个四分之一圆 − 正方形 = πr²/2 − r²
  if (/叶形/.test(t)) {
    var r3 = num(t, /边长为\s*(\d+)\s*厘米/);
    if (r3 === null) return fail('圆组合（叶形）未解析');
    return ok([Math.round((pi * r3 * r3 / 2 - r3 * r3) * 100) / 100]);
  }
  // 圆环：π(R²−r²)
  if (/两个同心圆/.test(t)) {
    var mR = t.match(/半径分别为\s*(\d+)\s*厘米[和、]\s*(\d+)\s*厘米/);
    if (!mR) return fail('圆组合（圆环）未解析');
    var R = Number(mR[1]), rr = Number(mR[2]);
    return ok([Math.round(pi * (R * R - rr * rr) * 100) / 100]);
  }
  // 半圆周长：πd/2 + d
  if (/半圆/.test(t)) {
    var d = num(t, /直径是\s*(\d+)\s*厘米/);
    if (d === null) return fail('圆组合（半圆周长）未解析');
    return ok([Math.round((pi * d / 2 + d) * 100) / 100]);
  }
  // 圆内最大正方形：圆面积 − 正方形面积 = r²(π−2)
  if (/圆内画一个最大的正方形/.test(t)) {
    var r0 = num(t, /半径为\s*(\d+)\s*厘米/);
    if (r0 === null) return fail('圆组合（圆内正方形）未解析');
    return ok([Math.round((pi - 2) * r0 * r0 * 100) / 100]);
  }
  return fail('圆组合题未识别');
}
