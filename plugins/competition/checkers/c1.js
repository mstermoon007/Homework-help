'use strict';
/* C1 数字谜独立求解器
 * g4 插件（math-competition-c1-numberpuzzle）：vertical / horizontal / symbol / array / magic
 * g6 插件（math-competition-g6-c1）：vertical-multi / carry-complex / horizontal / symbol /
 *                                   magic-adv / array-adv / digit-reason / competition
 */
var U = require('./_shared.js');
var register = require('./_registry.js').register;
var fail = U.fail, ok = U.ok, strip = U.strip;

register('vertical', checkVertical);
register('vertical-multi', checkVerticalMulti);
register('carry-complex', checkVerticalMulti);
register('horizontal', checkHorizontal);
register('symbol', checkSymbol);
register('array', checkArray);
register('magic', checkMagic);
register('magic-adv', checkMagicAdv);
register('array-adv', checkArrayAdv);
register('digit-reason', checkDigitReason);
register('competition', checkCompetition);

function setChar(s, i, ch) { return s.slice(0, i) + String(ch) + s.slice(i + 1); }

/* ---------- g4 竖式数字谜：反解三行掩码与运算符，枚举 □ 的全部填法 ---------- */
function checkVertical(q) {
  var rows = [];
  var re = /<span class="ve-op">([^<]*)<\/span>([^<]*)</g;
  var m;
  while ((m = re.exec(q.svg))) rows.push({ op: m[1], s: m[2] });
  if (rows.length !== 3) return fail('竖式行数不为 3');
  var op = rows[1].op;
  if (op !== '＋' && op !== '－') return fail('竖式运算符异常：' + op);
  var masks = rows.map(function (r) { return r.s; });
  if (masks.some(function (s) { return s.length !== 3; })) return fail('竖式位数不为 3');
  var blanks = [];
  masks.forEach(function (s, r) {
    s.split('').forEach(function (ch, c) { if (ch === '□') blanks.push([r, c]); });
  });
  if (blanks.length !== q.answer.length) return fail('□ 数量与答案长度不符');

  var sols = [];
  for (var n = 0; n < Math.pow(10, blanks.length); n++) {
    var grid = masks.map(function (s) { return s.split(''); });
    var rest = n; var combo = [];
    for (var i = 0; i < blanks.length; i++) {
      var d = rest % 10; combo.push(d);
      grid[blanks[i][0]][blanks[i][1]] = String(d);
      rest = Math.floor(rest / 10);
    }
    var nums = grid.map(function (g) { return g.join(''); });
    if (nums.some(function (s) { return s[0] === '0'; })) continue; // 三个数首位均不为 0
    var A = +nums[0], B = +nums[1], C = +nums[2];
    if (op === '＋' ? A + B === C : A - B === C) sols.push(combo);
  }
  if (!sols.length) return fail('竖式无解（答案不成立）');
  if (sols.length > 1) return fail('竖式解不唯一（' + sols.length + ' 组）');
  return ok(sols[0]);
}

/* ---------- 通用四则求值（横式数字谜用） ---------- */
var H_OPS = ['＋', '－', '×', '÷'];
function evalOps(nums, ops) {
  var v = nums.slice(), o = ops.slice();
  var i = 0;
  while (i < o.length) {
    if (o[i] === '×' || o[i] === '÷') {
      var x = v[i], y = v[i + 1], r;
      if (o[i] === '×') r = x * y;
      else { if (y === 0 || x % y !== 0) return null; r = x / y; }
      v.splice(i, 2, r); o.splice(i, 1);
    } else i++;
  }
  var acc = v[0];
  for (var j = 0; j < o.length; j++) {
    acc = o[j] === '＋' ? acc + v[j + 1] : acc - v[j + 1];
    if (acc < 0) return null;
  }
  return acc;
}

/* ---------- g4 横式数字谜（填运算符号）：枚举全部 4^(n-1) 种符号组合 ---------- */
function checkHorizontal(q) {
  var txt = strip(q.svg);
  var parts = txt.split('＝');
  var lhs = parts[0], rhsRaw = parts[1];
  if (rhsRaw === undefined) return fail('横式缺少等号');
  var target = Number(rhsRaw.trim());
  var nums = lhs.split('□').map(function (s) { return Number(s.trim()); });
  if (nums.some(isNaN) || isNaN(target)) return fail('横式解析失败：' + txt);
  var k = nums.length - 1;
  if (k !== q.answer.length) return fail('□ 数量与答案长度不符');
  var combos = [[]];
  for (var i = 0; i < k; i++) {
    var nx = [];
    combos.forEach(function (c) { H_OPS.forEach(function (o) { nx.push(c.concat([o])); }); });
    combos = nx;
  }
  var sols = combos.filter(function (c) { return evalOps(nums, c) === target; });
  if (!sols.length) return fail('横式无解（答案不成立）');
  if (sols.length > 1) return fail('横式解不唯一（' + sols.length + ' 组）');
  // 键盘上打不出 ×÷，学生会输入 * /，必须同样判对
  var SYN = { '＋': '+', '－': '-', '×': '*', '÷': '/' };
  var typed = {};
  q.answer.forEach(function (a, j) { typed['0:' + j] = SYN[a]; });
  if (typeof q.check === 'function' && !q.check(typed, 0)) return fail('键盘等价写法（+ - * /）未判对');
  return ok(sols[0]);
}

/* ---------- g4 符号代表数：反解方程组，枚举 △∈1..9 / ○∈0..9 ---------- */
function checkSymbol(q) {
  var lines = String(q.svg).replace(/<\/?div[^>]*>/g, '')
    .split(/<br\s*\/?>/).map(strip).filter(Boolean);
  var eqs = lines.filter(function (l) { return l.indexOf('＝') >= 0; });
  if (!eqs.length) return fail('符号题无方程');
  var needGreater = lines.some(function (l) { return l.indexOf('△ ＞ ○') >= 0; });
  var sols = [];
  for (var x = 1; x <= 9; x++) {
    for (var y = 0; y <= 9; y++) {
      if (x === y) continue;
      if (needGreater && !(x > y)) continue;
      var okAll = true;
      for (var e = 0; e < eqs.length; e++) {
        var eq = eqs[e];
        var lr = eq.split('＝');
        var expr = lr[0]
          .replace(/△○/g, '(' + (x * 10 + y) + ')')
          .replace(/○△/g, '(' + (y * 10 + x) + ')')
          .replace(/△△/g, '(' + (x * 11) + ')')
          .replace(/○○/g, '(' + (y * 11) + ')')
          .replace(/△/g, '(' + x + ')')
          .replace(/○/g, '(' + y + ')')
          .replace(/＋/g, '+').replace(/－/g, '-').replace(/×/g, '*');
        if (/[△○]/.test(expr)) return fail('符号未能全部替换：' + expr);
        if (eval(expr) !== Number(lr[1].trim())) { okAll = false; break; }
      }
      if (okAll) sols.push([x, y]);
    }
  }
  if (!sols.length) return fail('符号题无解（答案不成立）');
  if (sols.length > 1) return fail('符号题解不唯一（' + sols.length + ' 组）');
  return ok(sols[0]);
}

/* ---------- g4 辐射型数阵图：每线恰好一空 + 线和成立 + 外圈 1~7 各一次 ---------- */
function checkArray(q) {
  var rows = String(q.svg).match(/<div class="al-row">([\s\S]*?)<\/div>/g) || [];
  if (rows.length !== 3) return fail('数阵线数不为 3');
  var ai = 0, center = null, sum = null;
  var outer = [];
  for (var r = 0; r < rows.length; r++) {
    var t = strip(rows[r]).replace(/^线[①②③]：/, '');
    var lr = t.split('＝');
    var parts = lr[0].split('＋').map(function (s) { return s.trim(); });
    if (parts.length !== 3) return fail('数阵某行不是三数相加');
    var nBlank = parts.filter(function (p) { return p === '□'; }).length;
    if (nBlank !== 1) return fail('数阵该行 □ 数量为 ' + nBlank + '（须恰好 1 个，否则两端顺序不唯一）');
    var vals = parts.map(function (p) { return p === '□' ? Number(q.answer[ai++]) : Number(p); });
    if (vals.some(isNaN)) return fail('数阵解析失败：' + t);
    var S = Number(lr[1].trim());
    if (sum === null) sum = S; else if (sum !== S) return fail('数阵各线的和不一致');
    if (center === null) center = vals[0]; else if (center !== vals[0]) return fail('数阵中心数不一致');
    if (vals[0] + vals[1] + vals[2] !== S) return fail('数阵该线三数之和 ≠ ' + S);
    outer.push(vals[1], vals[2]);
  }
  if (ai !== q.answer.length) return fail('数阵 □ 数量与答案长度不符');
  var all = outer.concat([center]).sort(function (a, b) { return a - b; });
  if (JSON.stringify(all) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7])) {
    return fail('数阵未用 1~7 各一次：' + JSON.stringify(all));
  }
  return ok(q.answer.slice());
}

/* ---------- g4 三阶幻方：验幻和 + 全排列验解唯一 + 1~9 各一次 ---------- */
function isMagic(f) {
  var S = 15;
  for (var r = 0; r < 3; r++) if (f[r * 3] + f[r * 3 + 1] + f[r * 3 + 2] !== S) return false;
  for (var c = 0; c < 3; c++) if (f[c] + f[c + 3] + f[c + 6] !== S) return false;
  return f[0] + f[4] + f[8] === S && f[2] + f[4] + f[6] === S;
}
function checkMagic(q) {
  var cells = (String(q.svg).match(/<td[^>]*>([^<]*)<\/td>/g) || []).map(strip);
  if (cells.length !== 9) return fail('幻方格子数不为 9');
  var pos = [];
  cells.forEach(function (c, i) { if (c === '□') pos.push(i); });
  if (pos.length !== q.answer.length) return fail('□ 数量与答案长度不符');
  var base = cells.map(function (c) { return c === '□' ? null : Number(c); });
  var filled = base.slice();
  pos.forEach(function (p, i) { filled[p] = Number(q.answer[i]); });
  if (!isMagic(filled)) return fail('幻方回填答案后幻和不成立');
  var used = filled.slice().sort(function (a, b) { return a - b; });
  if (JSON.stringify(used) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9])) return fail('幻方未用 1~9 各一次');
  var vals = pos.map(function (p, i) { return Number(q.answer[i]); });
  var okCnt = U.permute(vals).filter(function (pm) {
    var f = base.slice();
    pos.forEach(function (p, i) { f[p] = pm[i]; });
    return isMagic(f);
  });
  if (okCnt.length !== 1) return fail('幻方解不唯一（' + okCnt.length + ' 种排法）');
  return ok(q.answer.slice());
}

/* ============================================================
 * 以下为 g6-c1 新增题型（题面格式与 g4 不同，需独立解析）
 * ============================================================ */

/* ---------- g6 多位数竖式 / 复杂进位竖式（运算符在 <span> 内，□ 为 <b> 标签） ---------- */
function parseG6Vertical(body) {
  var opm = String(body).match(/text-align:center;">([^<]+?)<\/span>/);
  if (!opm) return null;
  var op = opm[1].replace(/\+/g, '＋').replace(/-/g, '－');
  var rowRe = /padding-left:26px;">([\s\S]*?)<\/div>/g;
  var m, rows = [];
  while ((m = rowRe.exec(body))) rows.push(strip(m[1]));
  var midRe = /text-align:center;">[^<]+?<\/span>([\s\S]*?)<\/div>/;
  var mid = body.match(midRe);
  if (rows.length < 2 || !mid) return null;
  var all = [rows[0], strip(mid[1])].concat(rows.length >= 2 ? [rows[1]] : []);
  if (all.length !== 3) return null;
  all = all.map(function (s) { return s.replace(/<b[^>]*>□<\/b>/g, '□'); });
  return { op: op, rows: all };
}
function checkVerticalMulti(q) {
  var p = parseG6Vertical(String(q.q || ''));
  if (!p) return fail('竖式解析失败');
  var masks = [];
  p.rows.forEach(function (s, r) {
    s.split('').forEach(function (ch, c) { if (ch === '□') masks.push([r, c]); });
  });
  if (masks.length !== q.answer.length) return fail('□ 数量与答案长度不符');
  var sols = [];
  for (var n = 0; n < Math.pow(10, masks.length); n++) {
    var grid = p.rows.map(function (s) { return s.split(''); });
    var rest = n, combo = [];
    for (var i = 0; i < masks.length; i++) {
      var d = rest % 10; combo.push(d);
      grid[masks[i][0]][masks[i][1]] = String(d);
      rest = Math.floor(rest / 10);
    }
    if (grid.some(function (g) { return g[0] === '0'; })) continue; // 首位不为 0
    var A = +grid[0].join(''), B = +grid[1].join(''), C = +grid[2].join(''), good;
    if (p.op === '＋') good = A + B === C;
    else if (p.op === '－') good = A - B === C;
    else good = A * B === C;
    if (good) sols.push(combo);
  }
  if (!sols.length) return fail('竖式无解（答案不成立）');
  if (sols.length > 1) return fail('竖式解不唯一（' + sols.length + ' 组）');
  return ok(sols[0]);
}

/* ---------- g6 幻方进阶（3 模式：三阶中心 / 四阶幻和 / 四阶缺格补全） ---------- */
function checkMagicAdv(q) {
  var src = String(q.q || '');
  var txt = strip(src);
  // 模式 2：四阶缺格（网格含 width:42px 的 span）
  if (/width:42px/.test(src)) {
    var cells = [];
    var cre = /<span style="width:42px;[^"]*">([\s\S]*?)<\/span>/g;
    var cm;
    while ((cm = cre.exec(src))) cells.push(/□/.test(cm[1]) ? null : Number(cm[1]));
    if (cells.length !== 16) return fail('四阶网格格数不为 16（实为 ' + cells.length + '）');
    var lines = [];
    for (var r = 0; r < 4; r++) lines.push([r * 4, r * 4 + 1, r * 4 + 2, r * 4 + 3]);
    for (var c = 0; c < 4; c++) lines.push([c, c + 4, c + 8, c + 12]);
    lines.push([0, 5, 10, 15], [3, 6, 9, 12]);
    var expected = [];
    for (var p = 0; p < 16; p++) {
      if (cells[p] !== null) continue;
      var val = null;
      for (var li = 0; li < lines.length; li++) {
        var ln = lines[li];
        if (ln.indexOf(p) < 0) continue;
        var rest2 = ln.filter(function (x) { return x !== p; });
        if (rest2.some(function (x) { return cells[x] === null; })) continue;
        val = 34 - rest2.reduce(function (a, x) { return a + cells[x]; }, 0);
        break;
      }
      if (val === null) return fail('四阶第 ' + p + ' 格无确定行/列/对角线');
      expected.push(val);
    }
    return ok(expected);
  }
  // 模式 0：三阶幻和反求中心
  var m0 = txt.match(/幻和是\s*(\d+)/);
  if (m0 && /中心/.test(txt)) {
    var S3 = Number(m0[1]);
    if (S3 % 3 !== 0) return fail('幻和不是 3 的倍数');
    return ok([S3 / 3]);
  }
  // 模式 1：四阶幻和
  if (/四阶幻方/.test(txt)) return ok([34]);
  return fail('magic-adv 无法识别的题型');
}

/* ---------- g6 数阵图进阶（九宫格行·列等和半幻方，已知若干格求遮住格） ---------- */
function checkArrayAdv(q) {
  var txt = strip(q.q);
  var known = new Array(9).fill(null);
  var gre = /第(\d)行第(\d)格＝(\d)/g;
  var gm;
  while ((gm = gre.exec(txt))) known[(Number(gm[1]) - 1) * 3 + (Number(gm[2]) - 1)] = Number(gm[3]);
  var masked = [];
  for (var i = 0; i < 9; i++) if (known[i] === null) masked.push(i);
  if (masked.length !== q.answer.length) return fail('已知/遮住数量与答案长度不符');
  var remaining = [];
  for (var n = 1; n <= 9; n++) if (known.indexOf(n) < 0) remaining.push(n);
  if (remaining.length !== masked.length) return fail('剩余可用数字数量不符');
  var sols = [];
  U.permute(remaining).forEach(function (pm) {
    var g = known.slice();
    masked.forEach(function (idx, k) { g[idx] = pm[k]; });
    var S = g[0] + g[1] + g[2], okAll = true;
    for (var r = 0; r < 3; r++) if (g[r * 3] + g[r * 3 + 1] + g[r * 3 + 2] !== S) okAll = false;
    for (var c = 0; c < 3; c++) if (g[c] + g[c + 3] + g[c + 6] !== S) okAll = false;
    if (okAll) sols.push(masked.map(function (idx) { return g[idx]; }));
  });
  if (!sols.length) return fail('数阵图无解（答案不成立）');
  var first = sols[0];
  for (var s = 1; s < sols.length; s++)
    for (var k = 0; k < first.length; k++)
      if (sols[s][k] !== first[k]) return fail('数阵图解不唯一（' + sols.length + ' 种）');
  return ok(first);
}

/* ---------- g6 数字推理综合（□MID□ 被 div 整除） ---------- */
function checkDigitReason(q) {
  var txt = strip(q.q);
  var midm = txt.match(/□(\d+)□/);
  if (!midm) return fail('数字推理题面解析失败');
  var mid = Number(midm[1]);
  var divm = txt.match(/能被\s*(\d+)\s*整除/);
  if (!divm) return fail('未找到整除数');
  var div = Number(divm[1]);
  var sols = [];
  for (var first = 1; first <= 9; first++)
    for (var last = 0; last <= 9; last++) {
      var num = Number('' + first + mid + last); // 生成器按字符串拼接构造数字（mid 位数不固定）
      if (num % div === 0) sols.push([first, last, num]);
    }
  if (!sols.length) return fail('无满足条件的五位数');
  if (/求两端/.test(txt) || /最小数是/.test(txt)) return ok([sols[0][0], sols[0][1]]);
  var target = /最大/.test(txt) ? sols[sols.length - 1][2] : sols[0][2];
  return ok([target]);
}

/* ---------- g6 竞赛级综合（c1：六位数除以 D 余 R 的最大/最小；c5：往返行程综合） ---------- */
function checkCompetition(q) {
  var txt = strip(q.q);
  // c5 行程综合：题面给出去程速度、回程速度、两地距离 → 往返平均速度 / 往返总时间
  var Dm = txt.match(/相距\s*(\d+)\s*千米/);
  var vGom = txt.match(/甲地到乙地的速度是每小时\s*(\d+)\s*千米/);
  var vBackm = txt.match(/乙地原路返回甲地的速度是每小时\s*(\d+)\s*千米/);
  if (Dm && vGom && vBackm) {
    var Dj = Number(Dm[1]), vGo = Number(vGom[1]), vBack = Number(vBackm[1]);
    if (/平均速度/.test(txt)) return ok([2 * Dj / (Dj / vGo + Dj / vBack)]);
    if (/往返共用/.test(txt)) return ok([Dj / vGo + Dj / vBack]);
  }
  // c1 数字推理：六位数除以 D 余 R 的最大/最小
  var dm = txt.match(/除以\s*(\d+)\s*余\s*(\d+)/);
  if (!dm) return fail('竞赛综合题面解析失败');
  var D = Number(dm[1]), R = Number(dm[2]);
  var found = null;
  if (/最大/.test(txt)) {
    for (var n = 999999; n >= 100000; n--) if (n % D === R) { found = n; break; }
  } else {
    for (var m = 100000; m <= 999999; m++) if (m % D === R) { found = m; break; }
  }
  if (found === null) return fail('无满足条件的六位数');
  return ok([found]);
}
