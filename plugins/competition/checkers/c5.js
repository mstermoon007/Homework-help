'use strict';
/* C5 行程问题独立求解器
 * g4 插件（math-competition-c5-journey）：basic / meet / chase / train / river
 * g6 插件（math-competition-g6-c5）：basic / meet / chase / train（同 type 不同题面）+
 *   boat / circular / clock / journey-complex / competition / interval-departure / pick-up
 */
var U = require('./_shared.js');
var register = require('./_registry.js').register;
var fail = U.fail, ok = U.ok;

register('basic', checkBasic);
register('meet', checkMeet);
register('chase', checkChase);
register('train', checkTrain);
register('river', checkRiver);

/* ---------- g4 基本行程：求路程 / 求时间 / 求速度 ---------- */
function checkBasic(q) {
  var t = q.q;
  // g6 mode0：路程 = 速度 × 时间（题面可能带 SVG 插图，正则仅匹配文字部分）
  var mG0 = t.match(/每小时行驶\s*(\d+)\s*千米，行驶了\s*(\d+)\s*小时/);
  if (mG0) return ok([Number(mG0[1]) * Number(mG0[2])]);
  // g6 mode1：时间 = 路程 ÷ 速度
  var mG1 = t.match(/行驶了\s*(\d+)\s*千米，速度是每小时\s*(\d+)\s*千米/);
  if (mG1) return ok([Number(mG1[1]) / Number(mG1[2])]);
  if (/一共走了/.test(t) && /每分钟\s*(\d+)\s*米.*走了\s*(\d+)\s*分钟/.test(t)) {
    var m = t.match(/每分钟\s*(\d+)\s*米.*走了\s*(\d+)\s*分钟/);
    return ok([Number(m[1]) * Number(m[2])]);
  }
  if (/需要\s*____\s*分钟/.test(t)) {
    var m2 = t.match(/路长\s*(\d+)\s*米.*每分钟\s*(\d+)\s*米/);
    if (!m2) return fail('基本行程（求时间）题未解析');
    return ok([Number(m2[1]) / Number(m2[2])]);
  }
  if (/每分钟\s*____\s*米/.test(t)) {
    var m3 = t.match(/路长\s*(\d+)\s*米.*走了\s*(\d+)\s*分钟/);
    if (!m3) return fail('基本行程（求速度）题未解析');
    return ok([Number(m3[1]) / Number(m3[2])]);
  }
  return fail('基本行程题未识别模式');
}

/* ---------- g4 相遇问题 ---------- */
function checkMeet(q) {
  var t = q.q;
  // g6 格式：客车/货车，千米/时
  if (/客车速度|货车速度|千米\/时/.test(t)) {
    var v1, v2;
    var kv = t.match(/客车速度\s*(\d+)\s*千米\/时，货车速度\s*(\d+)\s*千米\/时/);
    if (kv) { v1 = Number(kv[1]); v2 = Number(kv[2]); }
    else {
      var kv2 = t.match(/速度分别为\s*(\d+)\s*和\s*(\d+)\s*千米\/时/);
      if (kv2) { v1 = Number(kv2[1]); v2 = Number(kv2[2]); }
    }
    if (v1 === undefined || v2 === undefined) return fail('相遇题（g6）未解析速度');
    // mode2：已知相遇时间求全程（题面不给出全程）
    var tm = t.match(/(\d+)\s*小时后两车相遇/);
    if (tm) return ok([(v1 + v2) * Number(tm[1])]);
    // mode0/mode1：求相遇时间（含多次相遇）
    var Dm = t.match(/甲、乙两地相距\s*(\d+)\s*千米/);
    if (Dm === null) return fail('相遇题（g6）未解析全程');
    var D = Number(Dm[1]);
    var nMeet = t.match(/第\s*(\d+)\s*次相遇/);
    var n = nMeet ? Number(nMeet[1]) : 1;
    return ok([n * D / (v1 + v2)]);
  }
  // g4 格式：甲/乙每分钟走，米
  var v1m = t.match(/甲每分钟走\s*(\d+)\s*米/);
  var v2m = t.match(/乙每分钟走\s*(\d+)\s*米/);
  if (!v1m || !v2m) return fail('相遇题未解析速度');
  var v1 = Number(v1m[1]), v2 = Number(v2m[1]);
  if (/____\s*分钟/.test(t)) {
    var sm = t.match(/相距\s*(\d+)\s*米/);
    if (!sm) return fail('相遇题（求时间）未解析总路程');
    return ok([Number(sm[1]) / (v1 + v2)]);
  }
  var tm2 = t.match(/经过\s*(\d+)\s*分钟/);
  if (!tm2) return fail('相遇题（求路程）未解析时间');
  return ok([(v1 + v2) * Number(tm2[1])]);
}

/* ---------- g4/g6 追及问题 ---------- */
function checkChase(q) {
  var t = q.q;
  // g6 格式：已知初始距离，求追及时间 = 距离差 ÷ 速度差
  //   format1: 甲在乙后面 Gap 米，甲每分钟走 vF，乙每分钟走 vS
  //   format2: 哥哥先出发…弟弟以每分钟 vF 米…两人相距 Gap 米
  var gapM = t.match(/甲在乙后面\s*(\d+)\s*米/) || t.match(/两人相距\s*(\d+)\s*米/);
  if (gapM) {
    var vFast = num(t, /甲每分钟走\s*(\d+)\s*米/) || num(t, /弟弟以每分钟\s*(\d+)\s*米/);
    var vSlow = num(t, /乙每分钟走\s*(\d+)\s*米/) || num(t, /哥哥先出发，每分钟走\s*(\d+)\s*米/);
    if (vFast === null || vSlow === null) return fail('追及题（g6）未解析速度');
    if (vFast <= vSlow) return fail('追及题快者速度应大于慢者');
    var g = Number(gapM[1]), d = vFast - vSlow;
    if (g % d !== 0) return fail('追及题距离差不能被速度差整除');
    return ok([g / d]);
  }
  // g4 格式：乙先出发 t0 分钟（求追及时间 / 求路程差）
  var v1m = t.match(/甲每分钟走\s*(\d+)\s*米/);
  var v2m = t.match(/乙每分钟走\s*(\d+)\s*米/);
  if (v1m && v2m) {
    var v1 = Number(v1m[1]), v2 = Number(v2m[1]);
    if (v2 >= v1) return fail('追及题甲速应大于乙速');
    var diff = v1 - v2;
    var t0m = t.match(/乙先出发\s*(\d+)\s*分钟/);
    if (!t0m) return fail('追及题未解析先出发时间');
    var gap2 = v2 * Number(t0m[1]);
    if (/____\s*分钟/.test(t)) {
      if (gap2 % diff !== 0) return fail('追及题路程差不能被速度差整除');
      return ok([gap2 / diff]);
    }
    return ok([gap2]);
  }
  return fail('追及题未识别模式');
}

/* ---------- g4 火车过桥 ---------- */
function checkTrain(q) {
  var t = q.q;
  var speed = num(t, /每秒\s*(\d+)\s*米/);
  var trainLen = num(t, /长\s*(\d+)\s*米的火车/);
  if (trainLen === null) trainLen = num(t, /火车长\s*(\d+)\s*米/); // g6 格式：一列火车长 X 米
  var bridgeLen = num(t, /长\s*(\d+)\s*米的大桥/);
  if (bridgeLen === null) bridgeLen = num(t, /长\s*(\d+)\s*米的桥/);
  if (speed === null) return fail('火车过桥题未解析速度');
  // 求时间：已知车长、桥长
  if (/需要多少秒|____\s*秒/.test(t)) {
    if (trainLen === null || bridgeLen === null) return fail('火车过桥（求时间）未解析车长或桥长');
    return ok([(trainLen + bridgeLen) / speed]);
  }
  // 求车长（g6：已知桥长、时间）
  if (/火车的长度|车长/.test(t)) {
    var tmC = num(t, /用了\s*(\d+)\s*秒/);
    if (bridgeLen === null || tmC === null) return fail('火车过桥（求车长）未解析桥长或时间');
    return ok([speed * tmC - bridgeLen]);
  }
  // 求桥长（g4：已知车长、时间）
  var tmB = num(t, /用了\s*(\d+)\s*秒/);
  if (trainLen !== null && tmB !== null) return ok([speed * tmB - trainLen]);
  return fail('火车过桥题未识别');
}

/* ---------- g4 流水行船 ---------- */
function checkRiver(q) {
  if (/顺水航行速度是\s*\d+/.test(q.q)) {
    var dm = q.q.match(/顺水航行速度是\s*(\d+)\s*千米\/时/);
    var um = q.q.match(/逆水航行速度是\s*(\d+)\s*千米\/时/);
    if (!dm || !um) return fail('流水行船题未解析顺逆水速');
    var d = Number(dm[1]), u = Number(um[1]);
    if ((d + u) % 2 !== 0 || (d - u) % 2 !== 0) return fail('顺逆水速之和/差不为偶数');
    return ok([(d + u) / 2, (d - u) / 2]);
  }
  var bm = q.q.match(/静水中的速度是\s*(\d+)\s*千米\/时/);
  var wm = q.q.match(/水流速度是\s*(\d+)\s*千米\/时/);
  if (!bm || !wm) return fail('流水行船题未解析速度');
  var vb = Number(bm[1]), vw = Number(wm[1]);
  return ok([vb + vw, vb - vw]);
}

/* ===================== g6 行程求解器 ===================== */
function num(s, re) { var m = s.match(re); return m ? Number(m[1]) : null; }

/* ---------- 流水行船（g6：顺水速度 / 水速 / 往返平均速度） ---------- */
register('boat', checkBoat);
function checkBoat(q) {
  var t = q.q;
  // mode1：已知顺水、逆水求水速
  var m1 = t.match(/顺水航行时速度为每小时\s*(\d+)\s*千米，逆水航行时速度为每小时\s*(\d+)\s*千米。水流速度/);
  if (m1) return ok([(Number(m1[1]) - Number(m1[2])) / 2]);
  // mode2：静水+水流，往返平均速度 = 2D/(D/顺 + D/逆)
  var m2 = t.match(/静水中的速度是每小时\s*(\d+)\s*千米，水流速度是每小时\s*(\d+)\s*千米。该船在两码头之间往返一次（两码头距离\s*(\d+)\s*千米），平均速度/);
  if (m2) {
    var bv = Number(m2[1]), wv = Number(m2[2]), dist = Number(m2[3]);
    var down = bv + wv, up = bv - wv;
    return ok([2 * dist / (dist / down + dist / up)]);
  }
  // mode0：静水+水流求顺水速度
  var m0 = t.match(/静水中的速度是每小时\s*(\d+)\s*千米，水流速度是每小时\s*(\d+)\s*千米。这条船顺水航行/);
  if (m0) return ok([Number(m0[1]) + Number(m0[2])]);
  return fail('流水行船（g6）题未解析');
}

/* ---------- 环形跑道（同向追及 / 反向相遇） ---------- */
register('circular', checkCircular);
function checkCircular(q) {
  var t = q.q;
  var L = num(t, /环形跑道周长为\s*(\d+)\s*米/);
  var v1 = num(t, /甲每秒跑\s*(\d+)\s*米/);
  var v2 = num(t, /乙每秒跑\s*(\d+)\s*米/);
  if (L === null || v1 === null || v2 === null) return fail('环形跑道题未解析');
  if (/同向而行/.test(t)) return ok([L / (v1 - v2)]);
  if (/反向而行/.test(t)) return ok([L / (v1 + v2)]);
  return fail('环形跑道题未识别');
}

/* ---------- 时钟问题（夹角 / 重合时刻） ---------- */
register('clock', checkClock);
function checkClock(q) {
  var t = q.q;
  // mode1：从某点整到第一次重合
  var m1 = t.match(/从\s*(\d+)\s*点整开始，经过多少分钟后时针与分针第一次重合/);
  if (m1) {
    var bh = Number(m1[1]);
    return ok([Math.round(bh * 30 / 5.5 * 10) / 10]);
  }
  // mode0：某时刻夹角
  var m0 = t.match(/时钟显示\s*(\d+)\s*点\s*(\d+)\s*分。此时时针与分针的夹角/);
  if (m0) {
    var h = Number(m0[1]), mm = Number(m0[2]);
    var ha = (h % 12) * 30 + mm * 0.5, ma = mm * 6;
    var d = Math.abs(ha - ma);
    if (d > 180) d = 360 - d;
    return ok([d]);
  }
  return fail('时钟题未解析');
}

/* ---------- 行程综合（前/后一半路程不同速度 → 平均速度） ---------- */
register('journey-complex', checkJourneyComplex);
function checkJourneyComplex(q) {
  var t = q.q;
  var v1 = num(t, /前一半路程的速度是每小时\s*(\d+)\s*千米/);
  var v2 = num(t, /后一半路程的速度是每小时\s*(\d+)\s*千米/);
  if (v1 === null || v2 === null) return fail('行程综合题未解析');
  return ok([2 * v1 * v2 / (v1 + v2)]);
}

/* ---------- 发车间隔（迎面 x / 背后 y → T=2xy/(x+y)） ---------- */
register('interval-departure', checkIntervalDeparture);
function checkIntervalDeparture(q) {
  var t = q.q;
  var x = num(t, /迎面每隔\s*(\d+)\s*分钟来一辆公交车/);
  var y = num(t, /背后每隔\s*(\d+)\s*分钟超过他一辆/);
  if (x === null || y === null) return fail('发车间隔题未解析');
  return ok([2 * x * y / (x + y)]);
}

/* ---------- 接送问题（乘车占比 = 车/(车+人)） ---------- */
register('pick-up', checkPickUp);
function checkPickUp(q) {
  var t = q.q;
  var m = t.match(/车速:人速\s*=\s*(\d+):(\d+)/);
  if (!m) return fail('接送题未解析');
  var pc = Number(m[1]), pw = Number(m[2]);
  return ok([Math.round(pc / (pc + pw) * 100)]);
}
