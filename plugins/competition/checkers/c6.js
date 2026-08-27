'use strict';
/* C6 工程与浓度独立求解器
 * 当前 active 插件（math-competition-g6-c6）：work / concentration（g6 题面）
 * 旧 g4 插件题面（甲单独做一项工程…清水/蒸发/混合）作为兜底分支保留。
 */
var U = require('./_shared.js');
var register = require('./_registry.js').register;
var fail = U.fail, ok = U.ok;
function num(s, re) { var m = s.match(re); return m ? Number(m[1]) : null; }

register('work', checkWork);
register('concentration', checkConcentration);

/* ---------- 工程问题 ---------- */
function checkWork(q) {
  var t = q.q;
  // g6 格式：一项工程，甲队单独做需要 A 天，乙队单独做需要 B 天
  var ag = num(t, /甲队单独做需要\s*(\d+)\s*天完成/);
  var bg = num(t, /乙队单独做需要\s*(\d+)\s*天完成/);
  if (ag !== null && bg !== null) {
    var a = ag, b = bg;
    // 中途休息：前后共用了 T 天，求甲休息天数
    if (/休息了\s*____\s*天/.test(t)) {
      var Tm = num(t, /前后共用了\s*(\d+)\s*天完工/);
      if (Tm === null) return fail('工程题（休息）未解析总天数');
      // 乙全程做 T*a，甲做实 (T-rest) 天做 (T-rest)*b，合计 a*b
      var numA = a * b - Tm * a;
      if (numA % b !== 0) return fail('工程题（休息）甲实做天数非整数');
      var rest = Tm - numA / b;
      if (rest < 0) return fail('工程题休息天数异常');
      return ok([rest]);
    }
    // 先单独做 M 天再合作
    if (/还需要\s*____\s*天/.test(t)) {
      var Mm = num(t, /甲队先单独做了\s*(\d+)\s*天/);
      if (Mm === null) return fail('工程题（先作）未解析甲先做天数');
      var remain = a * b - Mm * b;
      if (remain % (a + b) !== 0) return fail('工程题余数不能被效率和整除');
      return ok([remain / (a + b)]);
    }
    // 合作完成
    var coop = a * b / (a + b);
    if (!Number.isInteger(coop)) return fail('工程题合作天数非整数（构造缺陷）');
    return ok([coop]);
  }
  // g4 兜底：甲单独做一项工程需要 A 天，乙单独做同样的工程需要 B 天
  var m = t.match(/甲单独做一项工程需要\s*(\d+)\s*天，乙单独做同样的工程需要\s*(\d+)\s*天/);
  if (!m) return fail('工程题未解析');
  var a4 = Number(m[1]), b4 = Number(m[2]);
  var ans = (a4 * b4) / (a4 + b4);
  if (!Number.isInteger(ans)) return fail('工程题答案非整数（构造缺陷）');
  return ok([ans]);
}

/* ---------- 浓度问题 ---------- */
function checkConcentration(q) {
  var t = q.q;
  // g6 格式：一杯糖水 / 甲、乙两种盐水
  if (/一杯糖水|甲、乙两种盐水/.test(t)) {
    // 混合两种盐水：甲种浓度 cA%，重 mA 克；乙种浓度 cB%，重 mB 克
    if (/甲、乙两种盐水/.test(t)) {
      var cA = num(t, /甲种浓度\s*(\d+)%/);
      var mA = num(t, /重\s*(\d+)\s*克；乙种/);
      var cB = num(t, /乙种浓度\s*(\d+)%/);
      var mB = num(t, /乙种浓度\s*\d+%，重\s*(\d+)\s*克/);
      if (cA === null || mA === null || cB === null || mB === null) return fail('浓度（混合）未解析');
      var salt = cA * mA / 100 + cB * mB / 100;
      return ok([salt * 100 / (mA + mB)]);
    }
    // 一杯糖水：加水稀释 / 加糖变浓
    var sugarM = t.match(/含糖\s*(\d+)\s*克/);
    var totalM = t.match(/一杯糖水\s*(\d+)\s*克/);
    if (sugarM && totalM) {
      var sugar = Number(sugarM[1]), total = Number(totalM[1]);
      if (/加入\s*(\d+)\s*克水/.test(t)) {
        var addW = num(t, /加入\s*(\d+)\s*克水/);
        return ok([sugar * 100 / (total + addW)]);
      }
      if (/加入\s*(\d+)\s*克糖/.test(t)) {
        var addS = num(t, /加入\s*(\d+)\s*克糖/);
        return ok([(sugar + addS) * 100 / (total + addS)]);
      }
      return fail('浓度（糖水）未识别加水/加糖');
    }
    return fail('浓度（g6）题未解析');
  }
  // g4 兜底：清水稀释 / 蒸发 / 混合
  if (/清水/.test(t)) {
    var m = t.match(/(\d+)\s*克含盐\s*(\d+)%\s*的盐水加入\s*(\d+)\s*克清水/);
    if (!m) return fail('浓度（稀释）题未解析');
    var M = Number(m[1]), P = Number(m[2]), N = Number(m[3]);
    var ans = (M * P) / (M + N);
    if (!Number.isInteger(ans)) return fail('浓度（稀释）答案非整数');
    return ok([ans]);
  }
  if (/蒸发/.test(t)) {
    var m2 = t.match(/(\d+)\s*克含盐\s*(\d+)%\s*的盐水蒸发掉\s*(\d+)\s*克水/);
    if (!m2) return fail('浓度（蒸发）题未解析');
    var M2 = Number(m2[1]), P2 = Number(m2[2]), N2 = Number(m2[3]);
    var ans2 = (M2 * P2) / (M2 - N2);
    if (!Number.isInteger(ans2)) return fail('浓度（蒸发）答案非整数');
    return ok([ans2]);
  }
  var m3 = t.match(/(\d+)\s*克含盐\s*(\d+)%\s*的盐水和\s*(\d+)\s*克含盐\s*(\d+)%\s*的盐水/);
  if (!m3) return fail('浓度（混合）题未解析');
  var M3 = Number(m3[1]), P3 = Number(m3[2]), N3 = Number(m3[3]), Q3 = Number(m3[4]);
  var ans3 = (M3 * P3 + N3 * Q3) / (M3 + N3);
  if (!Number.isInteger(ans3)) return fail('浓度（混合）答案非整数');
  return ok([ans3]);
}
