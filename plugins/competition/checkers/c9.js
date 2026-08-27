'use strict';
/* C9 竞赛综合独立求解器
 * g6 插件（math-competition-g6-c9）：ratio（按比例分配/反比例/由差求总量/速度比分程）
 *   mixture（平均价/合金含铜率/十字交叉反求配比）、grass（牛吃草多块草地）
 * 求解器仅从题面反解，与生成逻辑零共享。
 */
var U = require('./_shared.js');
var register = require('./_registry.js').register;
var fail = U.fail, ok = U.ok, gcd = U.gcd, strip = U.strip;

function num(s, re) {
  var m = String(s).match(re);
  return m ? Number(m[1]) : null;
}

/* ---------- 比例应用题 ---------- */
function checkRatio(q) {
  var t = strip(q.q);

  // 速度比分程：两车相向而行，相遇时路程比 = 速度比
  var vM = t.match(/速度比是\s*(\d+)\s*[:：]\s*(\d+)/);
  if (vM && /相向而行/.test(t) && /相遇时.*一共行驶了\s*____/.test(t)) {
    var S = num(t, /相距\s*(\d+)\s*千米/);
    if (S === null) return fail('比例（速度比）未解析总路程');
    var v1 = Number(vM[1]), v2 = Number(vM[2]);
    return ok([S * v1 / (v1 + v2)]);
  }

  // 按比例分配（三班）
  var t3m = t.match(/把\s*(\d+)\s*个练习本按\s*(\d+)\s*[:：]\s*(\d+)\s*[:：]\s*(\d+)\s*的比例/);
  if (t3m) {
    var total3 = Number(t3m[1]), a3 = Number(t3m[2]), b3 = Number(t3m[3]), c3 = Number(t3m[4]);
    var k3 = total3 / (a3 + b3 + c3);
    if (!Number.isInteger(k3)) return fail('比例（三班分配）每份非整数（信息矛盾）');
    return ok([a3 * k3, b3 * k3]);
  }

  // 按比例分配（两组）
  var t2m = t.match(/把\s*(\d+)\s*个气球按\s*(\d+)\s*[:：]\s*(\d+)\s*的比例/);
  if (t2m) {
    var total2 = Number(t2m[1]), a2r = Number(t2m[2]), b2r = Number(t2m[3]);
    var k2 = total2 / (a2r + b2r);
    if (!Number.isInteger(k2)) return fail('比例（两组分配）每份非整数（信息矛盾）');
    return ok([a2r * k2, b2r * k2]);
  }

  // 反比例：工作量一定，人数×天数守恒
  if (/名工人加工/.test(t)) {
    var pairM = t.match(/由\s*(\d+)\s*名工人加工，需要\s*(\d+)\s*天完成。如果由\s*(\d+)\s*名工人加工/);
    if (!pairM) return fail('比例（反比例）未解析工人数/天数');
    var p1 = Number(pairM[1]), d1 = Number(pairM[2]), p2 = Number(pairM[3]);
    var w = p1 * d1;
    if (w % p2 !== 0) return fail('比例（反比例）天数非整数（信息矛盾）');
    return ok([w / p2]);
  }

  // 由差求总量：a:b、差 D → 和 = D(a+b)/|a−b|
  var diffM = t.match(/两数的比是\s*(\d+)\s*[:：]\s*(\d+)\s*，它们的差是\s*(\d+)/);
  if (diffM) {
    var ra = Number(diffM[1]), rb = Number(diffM[2]), D = Number(diffM[3]);
    if (ra === rb) return fail('比例（由差求总量）比例两数相等，矛盾');
    return ok([D * (ra + rb) / Math.abs(ra - rb)]);
  }

  return fail('比例应用题未识别模式');
}

/* ---------- 混合问题 ---------- */
function checkMixture(q) {
  var t = strip(q.q);

  // 十字交叉反求配比：甲(高价):乙(低价) = (avg−p2):(p1−avg)，化最简
  if (/质量比是多少/.test(t)) {
    var p1m = t.match(/甲种糖果每千克\s*(\d+)\s*元/);
    var p2m = t.match(/乙种糖果每千克\s*(\d+)\s*元/);
    var avgm = t.match(/混合成每千克\s*(\d+)\s*元的什锦糖/);
    if (!p1m || !p2m || !avgm) return fail('混合（十字交叉）未解析单价/均价');
    var P1 = Number(p1m[1]), P2 = Number(p2m[1]), AVG = Number(avgm[1]);
    var hi = AVG - P2, lo = P1 - AVG;
    if (hi <= 0 || lo <= 0) return fail('混合（十字交叉）均价不在两单价之间，矛盾');
    var g = gcd(hi, lo);
    return ok([hi / g, lo / g]);
  }

  // 合金含铜率（正向求新含铜率 / 反向求乙合金质量）
  if (/含铜率/.test(t)) {
    var rvM = t.match(/含铜率为\s*(\d+)%\s*的乙合金熔合后，得到含铜率为\s*(\d+)%\s*的新合金共\s*(\d+)\s*克/);
    if (rvM) {
      // 反向：铜量守恒 m1·a1 + x·a2 = rate·tot
      var a2c = Number(rvM[1]), rate = Number(rvM[2]), tot = Number(rvM[3]);
      var fwdM = t.match(/含铜率为\s*(\d+)%\s*的甲合金\s*(\d+)\s*克/);
      if (!fwdM) return fail('混合（含铜率反向）未解析甲合金');
      var a1c = Number(fwdM[1]), m1c = Number(fwdM[2]);
      var cop = rate * tot / 100 - m1c * a1c / 100; // 新合金总铜 − 甲贡献
      if (cop <= 0 || a2c === 0) return fail('混合（含铜率反向）铜量矛盾');
      if (Math.abs(cop * 100 / a2c - Math.round(cop * 100 / a2c)) > 1e-9) return fail('混合（含铜率反向）质量非整数');
      return ok([Math.round(cop * 100 / a2c)]);
    }
    var fwM = t.match(/含铜率为\s*(\d+)%\s*的甲合金\s*(\d+)\s*克和含铜率为\s*(\d+)%\s*的乙合金\s*(\d+)\s*克/);
    if (fwM) {
      var A1 = Number(fwM[1]), M1 = Number(fwM[2]), A2 = Number(fwM[3]), M2 = Number(fwM[4]);
      var copper = M1 * A1 + M2 * A2;
      var mass = M1 + M2;
      if (copper % mass !== 0) return fail('混合（含铜率正向）含铜率非整数');
      return ok([copper / mass]);
    }
    return fail('混合（含铜率）未识别模式');
  }

  // 平均价：总价 ÷ 总量
  var avgM = t.match(/奶糖每千克\s*(\d+)\s*元，水果糖每千克\s*(\d+)\s*元。把\s*(\d+)\s*千克奶糖和\s*(\d+)\s*千克水果糖/);
  if (avgM) {
    var pp1 = Number(avgM[1]), pp2 = Number(avgM[2]), nn1 = Number(avgM[3]), nn2 = Number(avgM[4]);
    var sum = nn1 * pp1 + nn2 * pp2;
    if (sum % (nn1 + nn2) !== 0) return fail('混合（平均价）均价非整数');
    return ok([sum / (nn1 + nn2)]);
  }

  return fail('混合问题未识别模式');
}

/* ---------- 牛吃草（多块草地，按公顷归一） ----------
 * 每块地：N·T = A·P + A·g·T（P=每公顷原有草份数，g=每公顷日长份数）
 * 两组条件联立：g = (T2·A1·N2 − T1·A2·N1) ÷ (A1·A2·(T2−T1))，P = T1(N1−A1·g)/A1
 */
function solveGrassParams(t) {
  var areaM = t.match(/面积分别为\s*(\d+)\s*公顷和\s*(\d+)\s*公顷/);
  var condM = t.match(/可供\s*(\d+)\s*头牛吃\s*(\d+)\s*天[、，]?\s*(?:乙草地可供\s*)?(\d+)\s*头牛吃\s*(\d+)\s*天/);
  if (!areaM || !condM) return null;
  var A1 = Number(areaM[1]), A2 = Number(areaM[2]);
  var N1 = Number(condM[1]), T1 = Number(condM[2]), N2 = Number(condM[3]), T2 = Number(condM[4]);
  if (T1 === T2) return null;
  var denom = A1 * A2 * (T2 - T1);
  if (denom === 0) return null;
  var g = (T2 * A1 * N2 - T1 * A2 * N1) / denom;
  var P = T1 * (N1 - A1 * g) / A1;
  if (!Number.isInteger(g) || g <= 0) return null;
  if (!Number.isInteger(P) || P <= 0) return null;
  return { A1: A1, A2: A2, g: g, P: P };
}

function checkGrass(q) {
  var t = strip(q.q);
  var par = solveGrassParams(t);
  if (!par) return fail('牛吃草题未解析/归一参数非整数（信息矛盾）');

  // mode0：第三块草地供 n3 头牛，求天数 t3：A3·P = (n3 − A3·g)·t3
  var thirdM = t.match(/另有一块面积为\s*(\d+)\s*公顷的同类草地，恰好也可供\s*(\d+)\s*头牛吃完/);
  if (thirdM) {
    var A3 = Number(thirdM[1]), n3 = Number(thirdM[2]);
    var net = n3 - A3 * par.g;
    if (net <= 0) return fail('牛吃草（第三块）净消耗非正，矛盾');
    var t3 = A3 * par.P / net;
    if (!Number.isInteger(t3)) return fail('牛吃草（第三块）天数非整数');
    return ok([t3]);
  }

  // mode1：求每公顷每天长草份数
  if (/每公顷草地每天长出的草是多少份/.test(t)) return ok([par.g]);

  // mode2：永远吃不完 → 头数 ≤ 目标面积 × g
  var keepM = t.match(/若想让一片\s*(\d+)\s*公顷的同类草地永远吃不完/);
  if (keepM) return ok([Number(keepM[1]) * par.g]);

  return fail('牛吃草题未识别模式');
}

register('ratio', checkRatio);
register('mixture', checkMixture);
register('grass', checkGrass);

/* ---------- g4 综合应用题 ---------- */
function checkIntegrated(q) {
  var t = strip(q.q);
  // 和差复合：梨 big 棵，比苹果多 diff 棵 → 总数 = 2big − diff
  var sdM = t.match(/梨树\s*(\d+)\s*棵，比苹果树多\s*(\d+)\s*棵。梨树和苹果树一共有多少棵/);
  if (sdM) {
    var big = Number(sdM[1]), diff = Number(sdM[2]);
    return ok([big + (big - diff)]);
  }
  // 行程复合：v ×（前段时 + 后段时），休息不计路程
  if (/一共行驶了多少千米/.test(t)) {
    var v = num(t, /每小时行驶\s*(\d+)\s*千米/);
    var ts = t.match(/行驶了\s*(\d+)\s*小时后休息了\s*(\d+)\s*分钟，然后又以同样速度行驶了\s*(\d+)\s*小时/);
    if (v === null || !ts) return fail('综合（行程）未解析');
    return ok([v * (Number(ts[1]) + Number(ts[3]))]);
  }
  // 正方形：周长、面积
  var sqM = t.match(/正方形的边长是\s*(\d+)\s*厘米。它的周长是多少厘米/);
  if (sqM) {
    var s = Number(sqM[1]);
    return ok([s * 4, s * s]);
  }
  return fail('综合应用题未识别模式');
}

/* ---------- g4 杂题选讲（烙饼 / 排队） ---------- */
function checkMisc(q) {
  var t = strip(q.q);
  // 烙饼：2n 面每锅 2 面、每面 t 分钟 → 总时间 = n·t
  var pm = t.match(/每面需要\s*(\d+)\s*分钟。烙\s*(\d+)\s*张饼最少需要多少分钟/);
  if (pm) {
    var perFace = Number(pm[1]), nPancake = Number(pm[2]);
    return ok([nPancake * perFace]);
  }
  // 排队打水：升序排列，总等待 = Σ 前缀和
  if (/接水/.test(t)) {
    var qm = t.match(/每人接水时间分别为\s*([\d、]+)\s*分钟/);
    if (!qm) return fail('杂题（排队）未解析时间列表');
    var times = qm[1].split('、').map(Number).sort(function (a, b) { return a - b; });
    var total = 0, prefix = 0;
    for (var i = 0; i < times.length; i++) { prefix += times[i]; total += prefix; }
    return ok([total]);
  }
  return fail('杂题未识别模式');
}

/* ---------- g4 模拟竞赛卷 ---------- */
function checkMock(q) {
  var t = strip(q.q);
  // 计算题：a × b
  var cm = t.match(/计算：\s*(\d+)\s*×\s*(\d+)/);
  if (cm) return ok([Number(cm[1]) * Number(cm[2])]);
  // 数字谜：X□ + y = sum → x = sum − y，并验证与已给首位吻合（解唯一）
  var dm = t.match(/填入合适的数字：\s*(\d)□\s*\+\s*(\d+)\s*=\s*(\d+)/);
  if (dm) {
    var first = Number(dm[1]), y = Number(dm[2]), sum = Number(dm[3]);
    var x = sum - y;
    if (x < 10 || x > 99 || Math.floor(x / 10) !== first) return fail('模拟卷（数字谜）与首位约束矛盾');
    return ok([x]);
  }
  // 找规律：等差数列下一项
  var rm = t.match(/找规律：\s*(\d+)、(\d+)、(\d+)、(\d+)、…/);
  if (rm) {
    var s1 = Number(rm[1]), s2 = Number(rm[2]), s3 = Number(rm[3]), s4 = Number(rm[4]);
    var d = s2 - s1;
    if (s3 - s2 !== d || d <= 0) return fail('模拟卷（找规律）非递增等差数列');
    return ok([s4 + d]);
  }
  return fail('模拟竞赛卷未识别模式');
}

register('integrated', checkIntegrated);
register('misc', checkMisc);
register('mock', checkMock);
