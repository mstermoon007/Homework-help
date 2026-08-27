'use strict';
/* C8 最值与逻辑推理独立求解器
 * g4 插件（math-competition-c8-logic）：extreme / drawer / logic
 * g6 插件（math-competition-g6-c8）：extremum / logic（同 type 不同题面）+ optimization / winning
 */
var U = require('./_shared.js');
var register = require('./_registry.js').register;
var fail = U.fail, ok = U.ok;

register('extreme', checkExtreme);
register('drawer', checkDrawer);
register('logic', checkLogic);
register('optimization', checkOptimization);
register('winning', checkWinning);
register('extremum', checkExtremum);

/* ---------- g4 最值问题：①定和求最大积 ②给定数字组成最大/最小数 ---------- */
function checkExtreme(q) {
  if (/拆成两个正整数/.test(q.q)) {
    var m = q.q.match(/把\s*(\d+)\s*拆成两个正整数/);
    if (!m) return fail('最值（定和）题未解析');
    var S = Number(m[1]);
    var a = Math.floor(S / 2);
    return ok([a * (S - a)]);
  }
  var dm = q.q.match(/用数字\s*([0-9、]+)\s*各一次，组成(最大|最小)的\s*(\d+)\s*位数/);
  if (!dm) return fail('最值（组数）题未解析');
  var digits = dm[1].split('、').map(Number);
  var big = dm[2] === '最大';
  var d = Number(dm[3]);
  if (digits.length !== d) return fail('最值（组数）数字个数与位数不符');
  var arr;
  if (big) {
    arr = digits.slice().sort(function (a, b) { return b - a; });
  } else {
    arr = digits.slice().sort(function (a, b) { return a - b; });
    if (arr[0] === 0) { // 0 不能作首位，与首个非零交换
      var ni = 1;
      for (var i = 1; i < arr.length; i++) { if (arr[i] !== 0) { ni = i; break; } }
      var t = arr[0]; arr[0] = arr[ni]; arr[ni] = t;
    }
  }
  return ok([Number(arr.join(''))]);
}

/* ---------- g4 抽屉原理：N 物体 M 抽屉，至少 ⌈N/M⌉ 同屉 ---------- */
function checkDrawer(q) {
  var nums = (q.q.match(/\d+/g) || []).map(Number);
  if (nums.length < 2) return fail('抽屉原理题未解析到 N、M');
  var N = nums[0], M = nums[1];
  return ok([Math.floor((N - 1) / M) + 1]); // = ⌈N/M⌉
}

/* ---------- g4/g6 逻辑推理：g6 名次推断 / 硬币盒 + g4 比较链 / 唯一真话 ---------- */
function checkLogic(q) {
  var t = q.q;
  // g6 名次推断：甲、乙、丙百米赛跑，若干「X 是第 K 名 / X 不是第 K 名」线索 → 求乙名次
  if (/乙是第几名/.test(t) && /百米赛跑/.test(t)) {
    return solveRankLogic(t);
  }
  // g6 硬币盒：三人各说一句话，恰 W 人说真话 → 硬币所在盒号
  if (/硬币藏在三个盒子/.test(t)) {
    return solveBoxLogic(t);
  }
  // 模式 B：唯一真话推理（p 指认 q，q 与 r 都否认，恰一人说真话 ⇒ r 做的）
  var m1 = q.q.match(/([\u4e00-\u9fa5])说[：:]\s*[「""']?是([\u4e00-\u9fa5])拿的/);
  if (m1 && /只有一人说了真话/.test(q.q)) {
    var speaker = m1[1], accused = m1[2];
    var denies = Array.from(q.q.matchAll(/([\u4e00-\u9fa5])说[：:]\s*[「""']?不是我拿的/g)).map(function (x) { return x[1]; });
    if (denies.length < 2) return fail('逻辑（真话）题否定句解析失败');
    var r = denies.find(function (d) { return d !== accused; });
    if (!r) return fail('逻辑（真话）题无法确定第三人');
    var cand = [speaker, accused, r];
    var hit = cand.filter(function (doer) {
      var t1 = (doer === accused) ? 1 : 0;   // p 说「是 q 拿的」
      var t2 = (doer !== accused) ? 1 : 0;   // q 说「不是我」
      var t3 = (doer !== r) ? 1 : 0;         // r 说「不是我」
      return t1 + t2 + t3 === 1;
    });
    if (hit.length !== 1) return fail('逻辑（真话）题解不唯一（' + hit.length + '）');
    return ok([hit[0]]);
  }
  // 模式 A：比较链排位（A 比 B 维度词 ⇒ A>B 或 A<B；传递闭包求全序后取最值端）
  if (/比/.test(q.q) && /最(高|重|快|大|矮|轻|慢|小)的/.test(q.q)) {
    var sign = { '高': 1, '重': 1, '快': 1, '大': 1, '矮': -1, '轻': -1, '慢': -1, '小': -1 };
    var rel = Array.from(q.q.matchAll(/([\u4e00-\u9fa5])比([\u4e00-\u9fa5])(高|重|快|大|矮|轻|慢|小)/g));
    if (!rel.length) return fail('逻辑（比较链）题未解析到比较关系');
    var names = {};
    var greater = {}; // node → 它严格大于的节点集合（含传递）
    rel.forEach(function (m) {
      var A = m[1], B = m[2], w = m[3];
      names[A] = 1; names[B] = 1;
      if (!greater[A]) greater[A] = {};
      if (!greater[B]) greater[B] = {};
      if (sign[w] === 1) greater[A][B] = 1; else greater[B][A] = 1;
    });
    var nameArr = Object.keys(names);
    if (nameArr.length !== 3) return fail('逻辑（比较链）题涉及人数不为 3（' + nameArr.length + '）');
    // 传递闭包（节点极少，简单迭代即可）
    var changed = true;
    while (changed) {
      changed = false;
      nameArr.forEach(function (a) {
        Object.keys(greater[a]).forEach(function (b) {
          Object.keys(greater[b]).forEach(function (c) {
            if (!greater[a][c]) { greater[a][c] = 1; changed = true; }
          });
        });
      });
    }
    var sizes = nameArr.map(function (n) { return Object.keys(greater[n]).length; });
    var maxEnt = nameArr[sizes.indexOf(2)]; // 严格大于另外两人
    var minEnt = nameArr[sizes.indexOf(0)]; // 严格小于另外两人
    var askMax = /最(高|重|快|大)的/.test(q.q);
    var ans = askMax ? maxEnt : minEnt;
    if (!ans) return fail('逻辑（比较链）题无法确定唯一最值');
    return ok([ans]);
  }
  return fail('逻辑推理题未识别模式');
}

/* ===================== g6 求解器 ===================== */
function num(s, re) { var m = s.match(re); return m ? Number(m[1]) : null; }

/* ---------- 统筹优化：烙饼 / 排队打水 / 三人过桥 / 四人过桥 ---------- */
function checkOptimization(q) {
  var t = q.q;
  if (/过桥/.test(t)) {
    var mt = t.match(/分别需要\s*([\d、，\s]+?)\s*分钟/);
    if (!mt) return fail('过桥题未解析时间');
    var ts = mt[1].split(/[、，\s]+/).filter(function (x) { return x !== ''; }).map(Number);
    if (ts.length < 3) return fail('过桥题时间数不足');
    ts.sort(function (a, b) { return a - b; });
    if (ts.length >= 4) {
      var a = ts[0], b = ts[1], c = ts[2], d = ts[3];
      return ok([Math.min(a + 3 * b + d, 2 * a + b + c + d)]);
    }
    var sum = ts.reduce(function (x, y) { return x + y; }, 0);
    return ok([sum]);
  }
  if (/烙/.test(t)) {
    var Tm = num(t, /每面需要\s*(\d+)\s*分钟/);
    var Nm = num(t, /要烙\s*(\d+)\s*张饼/);
    if (Tm === null || Nm === null) return fail('烙饼题未解析');
    return ok([Nm * Tm]);
  }
  if (/接水/.test(t)) {
    var lm = t.match(/接水时间分别为\s*([\d、，]+)\s*分钟/);
    if (!lm) return fail('排队打水题未解析时间列表');
    var nums = lm[1].split(/[、，]/).map(Number);
    nums.sort(function (a, b) { return a - b; });
    var total = 0, pref = 0;
    for (var i = 0; i < nums.length; i++) { pref += nums[i]; total += pref; }
    return ok([total]);
  }
  return fail('统筹优化题未识别');
}

/* ---------- 必胜策略：单堆取子 / 双堆对称 ---------- */
function checkWinning(q) {
  var t = q.q;
  // 双堆相等 → 后手必胜（填「败」）
  if (/每堆各有/.test(t) || /有必胜策略吗/.test(t)) return ok(['败']);
  // 双堆不等 → 取差值造对称
  var dm = t.match(/一堆\s*(\d+)\s*枚、另一堆\s*(\d+)\s*枚/);
  if (dm) return ok([Math.abs(Number(dm[1]) - Number(dm[2]))]);
  // 单堆取子：取到最后胜 / 算输，求先手首步
  if (/枚棋子/.test(t)) {
    var Tm = num(t, /桌上有\s*(\d+)\s*枚棋子/);
    var Mm = num(t, /每次可以取\s*1\s*~\s*(\d+)\s*枚/);
    if (Tm === null || Mm === null) return fail('单堆取子题未解析');
    var lastWins = !/反而算输/.test(t);
    var r = lastWins ? (Tm % (Mm + 1)) : ((Tm - 1) % (Mm + 1));
    if (r === 0) return fail('单堆取子题先手处于必败态');
    return ok([r]);
  }
  return fail('必胜策略题未识别');
}

/* ---------- 最值：和定积最大（两/三数） / 周长定面积最大（正方形） ---------- */
function checkExtremum(q) {
  var t = q.q;
  if (/周长是/.test(t)) {
    var per = num(t, /周长是\s*(\d+)\s*厘米/);
    if (per === null) return fail('最值（周长）未解析');
    var side = per / 4;
    return ok([side * side]);
  }
  if (/三个自然数/.test(t)) {
    var S3 = num(t, /三个自然数的和是\s*(\d+)/);
    if (S3 === null) return fail('最值（三数）未解析');
    var v = S3 / 3;
    return ok([v * v * v]);
  }
  if (/两个自然数/.test(t)) {
    var S = num(t, /两个自然数的和是\s*(\d+)/);
    if (S === null) return fail('最值（两数）未解析');
    var x = Math.floor(S / 2);
    return ok([x * (S - x)]);
  }
  return fail('最值题未识别');
}

/* ---------- g6 逻辑：名次推断 ---------- */
function solveRankLogic(t) {
  var clues = [];
  var re = /([甲乙丙])\s*(不是第|是第)\s*(\d+)\s*名/g, cm;
  while ((cm = re.exec(t))) {
    clues.push({ who: cm[1], rank: Number(cm[3]), neg: cm[2] === '不是第' });
  }
  if (!clues.length) return fail('名次推断题未解析到线索');
  var perms = [], p;
  for (var a = 1; a <= 3; a++) for (var b = 1; b <= 3; b++) for (var c = 1; c <= 3; c++) {
    if (a === b || a === c || b === c) continue;
    p = { '甲': a, '乙': b, '丙': c };
    if (clues.every(function (cl) { return cl.neg ? p[cl.who] !== cl.rank : p[cl.who] === cl.rank; })) perms.push(p);
  }
  if (perms.length !== 1) return fail('名次推断解' + (perms.length === 0 ? '不存在' : '不唯一（' + perms.length + '）'));
  return ok([perms[0]['乙']]);
}

/* ---------- g6 逻辑：硬币盒（肯定/否定声明混合，逐盒统计真话人数） ---------- */
function solveBoxLogic(t) {
  var claims = [];
  var re = /([甲乙丙])说[：:]\s*[「"']?\s*(?:硬币)?(不在第|在第)\s*(\d+)\s*号/g;
  var mm;
  while ((mm = re.exec(t)) !== null) {
    claims.push({ neg: mm[2].charAt(0) === '不', box: Number(mm[3]) });
  }
  if (claims.length < 3) return fail('硬币盒题未解析声明（' + claims.length + '/3）');
  var wM = t.match(/恰好只有\s*([0-9一二两三])\s*人(?:说了)?真话/);
  if (!wM) return fail('硬币盒题未解析真话人数');
  var cnum = { '一': 1, '二': 2, '两': 2, '三': 3 };
  var W = cnum[wM[1]] !== undefined ? cnum[wM[1]] : Number(wM[1]);
  var hits = [];
  for (var bx = 1; bx <= 3; bx++) {
    var cnt = 0;
    for (var i = 0; i < claims.length; i++) {
      var c = claims[i];
      if (c.neg ? (bx !== c.box) : (bx === c.box)) cnt++;
    }
    if (cnt === W) hits.push(bx);
  }
  if (hits.length !== 1) return fail('硬币盒题解' + (hits.length === 0 ? '不存在' : '不唯一（' + hits + '）'));
  return ok([hits[0]]);
}
