#!/usr/bin/env node
/**
 * dev/verify-competition.js — 竞赛插件（C1-C9）专项校验
 *
 * 为什么单独一个工具：竞赛题与常规练习的质量标准不同。常规口算题「答案唯一」是天然的，
 * 而数字谜/数阵/幻方/计数这类题目，随机构造出来的题面很容易出现
 *   ① 答案根本不成立（构造时算错）
 *   ② 存在多组解（学生答另一组同样正确的答案会被误判为错）
 * 这两类缺陷都无法靠「插件自答自批一致」发现——自答自批只能证明 answer 与 check 自洽。
 * 因此本工具不信任插件给出的 answer，而是从题面反解出题目，独立枚举求解后比对。
 *
 * 校验维度：
 *   1. 满分回填必须判对（模拟 practice.html 的 collectAnswers）
 *   2. 同一份练习内题面不得重复
 *   3. 独立求解：答案正确 + 解唯一（按 question.type 分派 CHECKERS）
 *   4. 键盘等价写法（× 打成 *、÷ 打成 /）必须判对（填运算符号类题目）
 *
 * 用法：
 *   node dev/verify-competition.js                    # 校验全部已注册竞赛插件
 *   node dev/verify-competition.js --only C1          # 只校验某模块
 *   node dev/verify-competition.js --count 60         # 每个子题型的抽样题量（默认 40）
 *
 * 新增 Cx 插件时：在 CHECKERS 里为新的 question.type 增加独立求解器。
 * 未登记求解器的 type 会被计为「未覆盖独立校验」并在末尾提示（不算失败，但应尽快补上）。
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');

const args = process.argv.slice(2);
function argVal(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const ONLY = (argVal('--only', '') || '').toUpperCase();
const COUNT = Number(argVal('--count', 40)) || 40;

require(path.join(ROOT, 'shared/common.js'));
const PLUGIN_REGISTRY = require(path.join(ROOT, 'plugins/registry.js'));

let FAIL = 0;
const uncoveredTypes = new Set();
function bad(msg, q) {
  FAIL++;
  console.log('    ✗ ' + msg);
  console.log('       题干：' + String(q.q || '').slice(0, 80));
  if (q.svg) console.log('       图形：' + String(q.svg).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90));
  console.log('       答案：' + JSON.stringify(q.answer));
}
const strip = s => String(s).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

/* ==================== 独立求解器（按 question.type 分派） ==================== */

/** 竖式数字谜：反解三行掩码与运算符，枚举 □ 的全部填法 */
function checkVertical(q) {
  const rows = [];
  const re = /<span class="ve-op">([^<]*)<\/span>([^<]*)</g;
  let m;
  while ((m = re.exec(q.svg))) rows.push({ op: m[1], s: m[2] });
  if (rows.length !== 3) return bad('竖式行数不为 3', q);
  const op = rows[1].op;
  if (op !== '＋' && op !== '－') return bad('竖式运算符异常：' + op, q);
  const masks = rows.map(r => r.s);
  if (masks.some(s => s.length !== 3)) return bad('竖式位数不为 3', q);
  const blanks = [];
  masks.forEach((s, r) => s.split('').forEach((ch, c) => { if (ch === '□') blanks.push([r, c]); }));
  if (blanks.length !== q.answer.length) return bad('□ 数量与答案长度不符', q);

  const sols = [];
  for (let n = 0; n < Math.pow(10, blanks.length); n++) {
    const grid = masks.map(s => s.split(''));
    let rest = n; const combo = [];
    for (let i = 0; i < blanks.length; i++) {
      const d = rest % 10; combo.push(d);
      grid[blanks[i][0]][blanks[i][1]] = String(d);
      rest = Math.floor(rest / 10);
    }
    const nums = grid.map(g => g.join(''));
    if (nums.some(s => s[0] === '0')) continue;             // 三个数首位均不为 0
    const [A, B, C] = nums.map(Number);
    if (op === '＋' ? A + B === C : A - B === C) sols.push(combo);
  }
  if (!sols.length) return bad('竖式无解（答案不成立）', q);
  if (sols.length > 1) return bad('竖式解不唯一（' + sols.length + ' 组）', q);
  if (JSON.stringify(sols[0]) !== JSON.stringify(q.answer.map(Number))) {
    return bad('竖式答案与唯一解不符，唯一解=' + JSON.stringify(sols[0]), q);
  }
}

const H_OPS = ['＋', '－', '×', '÷'];
/** 按四则运算优先级求值；除不尽/除以 0/负数中间值 → null */
function evalOps(nums, ops) {
  const v = nums.slice(), o = ops.slice();
  let i = 0;
  while (i < o.length) {
    if (o[i] === '×' || o[i] === '÷') {
      const x = v[i], y = v[i + 1];
      let r;
      if (o[i] === '×') r = x * y;
      else { if (y === 0 || x % y !== 0) return null; r = x / y; }
      v.splice(i, 2, r); o.splice(i, 1);
    } else i++;
  }
  let acc = v[0];
  for (let j = 0; j < o.length; j++) {
    acc = o[j] === '＋' ? acc + v[j + 1] : acc - v[j + 1];
    if (acc < 0) return null;
  }
  return acc;
}
/** 横式数字谜（填运算符号）：枚举全部 4^(n-1) 种符号组合 */
function checkHorizontal(q) {
  const txt = strip(q.svg);
  const [lhs, rhsRaw] = txt.split('＝');
  if (rhsRaw === undefined) return bad('横式缺少等号', q);
  const target = Number(rhsRaw.trim());
  const nums = lhs.split('□').map(s => Number(s.trim()));
  if (nums.some(isNaN) || isNaN(target)) return bad('横式解析失败：' + txt, q);
  const k = nums.length - 1;
  if (k !== q.answer.length) return bad('□ 数量与答案长度不符', q);
  let combos = [[]];
  for (let i = 0; i < k; i++) {
    const nx = [];
    combos.forEach(c => H_OPS.forEach(o => nx.push(c.concat([o]))));
    combos = nx;
  }
  const sols = combos.filter(c => evalOps(nums, c) === target);
  if (!sols.length) return bad('横式无解（答案不成立）', q);
  if (sols.length > 1) return bad('横式解不唯一（' + sols.length + ' 组）：' + JSON.stringify(sols), q);
  if (JSON.stringify(sols[0]) !== JSON.stringify(q.answer)) {
    return bad('横式答案与唯一解不符，唯一解=' + JSON.stringify(sols[0]), q);
  }
  // 键盘上打不出 ×÷，学生会输入 * /，必须同样判对
  const SYN = { '＋': '+', '－': '-', '×': '*', '÷': '/' };
  const typed = {};
  q.answer.forEach((a, j) => { typed['0:' + j] = SYN[a]; });
  if (typeof q.check === 'function' && !q.check(typed, 0)) return bad('键盘等价写法（+ - * /）未判对', q);
}

/** 符号代表数：反解方程组，枚举 △∈1..9 / ○∈0..9 */
function checkSymbol(q) {
  const lines = String(q.svg).replace(/<\/?div[^>]*>/g, '')
    .split(/<br\s*\/?>/).map(strip).filter(Boolean);
  const eqs = lines.filter(l => l.includes('＝'));
  if (!eqs.length) return bad('符号题无方程', q);
  const needGreater = lines.some(l => l.includes('△ ＞ ○'));
  const sols = [];
  for (let x = 1; x <= 9; x++) {
    for (let y = 0; y <= 9; y++) {
      if (x === y) continue;
      if (needGreater && !(x > y)) continue;
      let ok = true;
      for (const eq of eqs) {
        const [L, R] = eq.split('＝');
        const expr = L.replace(/△○/g, '(' + (x * 10 + y) + ')')
          .replace(/○△/g, '(' + (y * 10 + x) + ')')
          .replace(/△△/g, '(' + (x * 11) + ')')
          .replace(/○○/g, '(' + (y * 11) + ')')
          .replace(/△/g, '(' + x + ')')
          .replace(/○/g, '(' + y + ')')
          .replace(/＋/g, '+').replace(/－/g, '-').replace(/×/g, '*');
        if (/[△○]/.test(expr)) return bad('符号未能全部替换：' + expr, q);
        if (eval(expr) !== Number(R.trim())) { ok = false; break; }
      }
      if (ok) sols.push([x, y]);
    }
  }
  if (!sols.length) return bad('符号题无解（答案不成立）', q);
  if (sols.length > 1) return bad('符号题解不唯一（' + sols.length + ' 组）：' + JSON.stringify(sols), q);
  if (JSON.stringify(sols[0]) !== JSON.stringify(q.answer.map(Number))) {
    return bad('符号题答案与唯一解不符，唯一解=' + JSON.stringify(sols[0]), q);
  }
}

/** 辐射型数阵图：每线恰好一空（否则两端顺序不唯一）+ 线和成立 + 外圈 1~7 各一次 */
function checkArray(q) {
  const rows = String(q.svg).match(/<div class="al-row">([\s\S]*?)<\/div>/g) || [];
  if (rows.length !== 3) return bad('数阵线数不为 3', q);
  let ai = 0, center = null, sum = null;
  const outer = [];
  for (const row of rows) {
    const t = strip(row).replace(/^线[①②③]：/, '');
    const [L, R] = t.split('＝');
    const parts = L.split('＋').map(s => s.trim());
    if (parts.length !== 3) return bad('数阵某行不是三数相加', q);
    const nBlank = parts.filter(p => p === '□').length;
    if (nBlank !== 1) return bad('数阵该行 □ 数量为 ' + nBlank + '（须恰好 1 个，否则两端顺序不唯一）', q);
    const vals = parts.map(p => (p === '□' ? Number(q.answer[ai++]) : Number(p)));
    if (vals.some(isNaN)) return bad('数阵解析失败：' + t, q);
    const S = Number(R.trim());
    if (sum === null) sum = S; else if (sum !== S) return bad('数阵各线的和不一致', q);
    if (center === null) center = vals[0]; else if (center !== vals[0]) return bad('数阵中心数不一致', q);
    if (vals[0] + vals[1] + vals[2] !== S) return bad('数阵该线三数之和 ≠ ' + S, q);
    outer.push(vals[1], vals[2]);
  }
  if (ai !== q.answer.length) return bad('数阵 □ 数量与答案长度不符', q);
  const all = outer.concat([center]).sort((a, b) => a - b);
  if (JSON.stringify(all) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7])) {
    return bad('数阵未用 1~7 各一次：' + JSON.stringify(all), q);
  }
}

function permute(a) {
  if (a.length <= 1) return [a.slice()];
  const out = [];
  a.forEach((v, i) => permute(a.slice(0, i).concat(a.slice(i + 1))).forEach(p => out.push([v].concat(p))));
  return out;
}
function isMagic(f) {
  const S = 15;
  for (let r = 0; r < 3; r++) if (f[r * 3] + f[r * 3 + 1] + f[r * 3 + 2] !== S) return false;
  for (let c = 0; c < 3; c++) if (f[c] + f[c + 3] + f[c + 6] !== S) return false;
  return f[0] + f[4] + f[8] === S && f[2] + f[4] + f[6] === S;
}
/** 三阶幻方：回填答案验幻和 + 全排列验解唯一 + 1~9 各一次 */
function checkMagic(q) {
  const cells = (String(q.svg).match(/<td[^>]*>([^<]*)<\/td>/g) || []).map(strip);
  if (cells.length !== 9) return bad('幻方格子数不为 9', q);
  const pos = [];
  cells.forEach((c, i) => { if (c === '□') pos.push(i); });
  if (pos.length !== q.answer.length) return bad('□ 数量与答案长度不符', q);
  const base = cells.map(c => (c === '□' ? null : Number(c)));
  const filled = base.slice();
  pos.forEach((p, i) => { filled[p] = Number(q.answer[i]); });
  if (!isMagic(filled)) return bad('幻方回填答案后幻和不成立', q);
  const used = filled.slice().sort((a, b) => a - b);
  if (JSON.stringify(used) !== JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9])) return bad('幻方未用 1~9 各一次', q);
  const vals = pos.map((p, i) => Number(q.answer[i]));
  const ok = permute(vals).filter(pm => {
    const f = base.slice();
    pos.forEach((p, i) => { f[p] = pm[i]; });
    return isMagic(f);
  });
  if (ok.length !== 1) return bad('幻方解不唯一（' + ok.length + ' 种排法）', q);
}

/* ---------- 通用数学工具（校验器内部用） ---------- */
function vIsPrime(n) {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}
function vPrimeCount(N) { let c = 0; for (let n = 2; n <= N; n++) if (vIsPrime(n)) c++; return c; }
function vGcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = b; b = a % b; a = t; } return a; }

/* ---------- C2 数论 ---------- */
function checkParity(q) {
  const m = q.q.match(/1\s*到\s*(\d+)/);
  if (!m) return bad('奇偶性题未解析到 N', q);
  const N = Number(m[1]);
  const odd = Math.ceil(N / 2), even = N - odd;
  if (JSON.stringify([odd, even]) !== JSON.stringify(q.answer.map(Number)))
    return bad('奇偶性答案不符，应为 ' + JSON.stringify([odd, even]), q);
}
function checkDivisible(q) {
  const m = q.q.match(/使\s*([\d□]+)\s*能被\s*(\d+)\s*整除/);
  if (!m) return bad('整除题未解析', q);
  const numStr = m[1], divisor = Number(m[2]);
  const valid = [];
  for (let d = 0; d <= 9; d++) {
    if (Number(numStr.replace('□', String(d))) % divisor === 0) valid.push(d);
  }
  if (!valid.length) return bad('整除题无解（答案不成立）', q);
  const ans = Math.min.apply(null, valid);
  if (ans !== Number(q.answer[0])) return bad('整除题最小解不符，应为 ' + ans, q);
}
function checkPrime(q) {
  if (/两个质数相加/.test(q.q)) {
    const m = q.q.match(/把\s*(\d+)\s*写成两个质数相加/);
    if (!m) return bad('质数拆分题未解析', q);
    const N = Number(m[1]);
    if (N % 2 === 0) return bad('质数拆分题为偶数（不应有唯一非 2 解）', q);
    if (!vIsPrime(N - 2)) return bad('质数拆分题 N-2 非质数（答案不成立）', q);
    if (JSON.stringify([2, N - 2]) !== JSON.stringify(q.answer.map(Number)))
      return bad('质数拆分答案不符，应为 [2,' + (N - 2) + ']', q);
  } else {
    const m = q.q.match(/1\s*到\s*(\d+)\s*中[，,]?质数一共有/);
    if (!m) return bad('质数计数题未解析', q);
    const M = Number(m[1]);
    const ans = vPrimeCount(M);
    if (ans !== Number(q.answer[0])) return bad('质数计数不符，应为 ' + ans, q);
  }
}
function checkFactor(q) {
  const m = q.q.match(/(\d+)\s*和\s*(\d+)\s*的最大公因数/);
  if (!m) return bad('因数倍数题未解析', q);
  const a = Number(m[1]), b = Number(m[2]);
  const g = vGcd(a, b), l = a * b / g;
  if (JSON.stringify([g, l]) !== JSON.stringify(q.answer.map(Number)))
    return bad('因数倍数答案不符，应为 ' + JSON.stringify([g, l]), q);
}
function checkRemainder(q) {
  const ms = [...q.q.matchAll(/除以\s*(\d+)\s*余\s*(\d+)/g)];
  if (ms.length < 2) return bad('余数题未解析', q);
  const m1 = Number(ms[0][1]), r1 = Number(ms[0][2]);
  const m2 = Number(ms[1][1]), r2 = Number(ms[1][2]);
  const Mm = q.q.match(/1\s*到\s*(\d+)\s*之间/);
  const M = Mm ? Number(Mm[1]) : 99999;
  let sol = null;
  for (let n = 1; n <= M; n++) {
    if (n % m1 === r1 && n % m2 === r2) { sol = n; break; }
  }
  if (sol === null) return bad('余数题在范围内无解（答案不成立）', q);
  if (sol !== Number(q.answer[0])) return bad('余数题最小解不符，应为 ' + sol, q);
}
function checkPlace(q) {
  const m = q.q.match(/和是\s*(\d+)[^。]*大\s*(\d+)/);
  if (!m) return bad('位值题未解析', q);
  const S = Number(m[1]), D = Number(m[2]);
  const tensLarger = /十位数字比个位数字大/.test(q.q);   // 区分"十位比个位大"与"个位比十位大"
  const a = tensLarger ? (S + D) / 2 : (S - D) / 2;
  const b = tensLarger ? (S - D) / 2 : (S + D) / 2;
  if (!Number.isInteger(a) || !Number.isInteger(b)) return bad('位值题参数奇偶不一致', q);
  const num = 10 * a + b;
  if (a < 1 || a > 9 || b < 0 || b > 9) return bad('位值题解出非法数字', q);
  if (num !== Number(q.answer[0])) return bad('位值题答案不符，应为 ' + num, q);
}

/* ---------- C3 组合计数 ---------- */
function vP(n, k) { if (k < 0 || k > n) return 0; return vFact(n) / vFact(n - k); }
function vC(n, k) { if (k < 0 || k > n) return 0; return vFact(n) / (vFact(k) * vFact(n - k)); }
function vFact(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }

function checkEnum(q) {
  const m = q.q.match(/1\s*到\s*(\d+)\s*中，是\s*(\d+)\s*的倍数/);
  if (!m) return bad('枚举题未解析', q);
  const N = Number(m[1]), d = Number(m[2]);
  let cnt = 0; for (let x = 1; x <= N; x++) if (x % d === 0) cnt++;
  if (cnt !== Number(q.answer[0])) return bad('枚举计数不符，应为 ' + cnt, q);
}
function checkAM(q) {
  if (/上衣/.test(q.q)) {
    const m = q.q.match(/(\d+)\s*件不同的上衣和\s*(\d+)\s*条不同的裤子/);
    if (!m) return bad('加乘（上衣裤子）题未解析', q);
    const a = Number(m[1]), b = Number(m[2]);
    if (a * b !== Number(q.answer[0])) return bad('搭配数不符，应为 ' + (a * b), q);
  } else {
    const m = q.q.match(/(\d+)\s*本科技书和\s*(\d+)\s*本故事书/);
    if (!m) return bad('加乘（选书）题未解析', q);
    const a = Number(m[1]), b = Number(m[2]);
    if (a + b !== Number(q.answer[0])) return bad('选法数不符，应为 ' + (a + b), q);
  }
}
function checkPerm(q) {
  const m = q.q.match(/从\s*(\d+)\s*个不同的[\s\S]*?中(?:选出|任选)\s*(\d+)\s*个/);
  if (!m) return bad('排列组合题未解析', q);
  const n = Number(m[1]), k = Number(m[2]);
  const isPerm = /排成一排|顺序不同/.test(q.q);
  const ans = isPerm ? vP(n, k) : vC(n, k);
  if (ans !== Number(q.answer[0])) return bad('排列组合不符，应为 ' + ans, q);
}
function checkGeomCount(q) {
  if (/点/.test(q.q)) {
    const m = q.q.match(/[画标]了\s*(\d+)\s*个不同的点/);
    if (!m) return bad('几何计数（线段）题未解析', q);
    const n = Number(m[1]);
    const ans = vC(n, 2);
    if (ans !== Number(q.answer[0])) return bad('线段数不符，应为 ' + ans, q);
  } else {
    const m = q.q.match(/由\s*(\d+)\s*[×x*]\s*(\d+)\s*个小正方形/);
    if (!m) return bad('几何计数（网格）题未解析', q);
    const r = Number(m[1]), c = Number(m[2]);
    const ans = vC(r + 1, 2) * vC(c + 1, 2);
    if (ans !== Number(q.answer[0])) return bad('长方形数不符，应为 ' + ans, q);
  }
}
function checkWorst(q) {
  const m = q.q.match(/这\s*(\d+)\s*种颜色的球各[\s\S]*?有\s*(\d+)\s*个颜色相同/);
  if (!m) return bad('最不利原则题未解析', q);
  const c = Number(m[1]), k = Number(m[2]);
  const ans = c * (k - 1) + 1;
  if (ans !== Number(q.answer[0])) return bad('最不利答案不符，应为 ' + ans, q);
}

// ---- C5 行程问题 ----
function checkBasic(q) {
  // 三种模式：求路程 / 求时间 / 求速度
  if (/一共走了/.test(q.q) && /每分钟\s*(\d+)\s*米.*走了\s*(\d+)\s*分钟/.test(q.q)) {
    const m = q.q.match(/每分钟\s*(\d+)\s*米.*走了\s*(\d+)\s*分钟/);
    const ans = Number(m[1]) * Number(m[2]);
    if (ans !== Number(q.answer[0])) return bad('路程不符，应为 ' + ans, q);
  } else if (/需要\s*____\s*分钟/.test(q.q)) {
    const m = q.q.match(/路长\s*(\d+)\s*米.*每分钟\s*(\d+)\s*米/);
    if (!m) return bad('基本行程（求时间）题未解析', q);
    const ans = Number(m[1]) / Number(m[2]);
    if (ans !== Number(q.answer[0])) return bad('时间不符，应为 ' + ans, q);
  } else if (/每分钟\s*____\s*米/.test(q.q)) {
    const m = q.q.match(/路长\s*(\d+)\s*米.*走了\s*(\d+)\s*分钟/);
    if (!m) return bad('基本行程（求速度）题未解析', q);
    const ans = Number(m[1]) / Number(m[2]);
    if (ans !== Number(q.answer[0])) return bad('速度不符，应为 ' + ans, q);
  } else {
    return bad('基本行程题未识别模式', q);
  }
}
function checkMeet(q) {
  const v1m = q.q.match(/甲每分钟走\s*(\d+)\s*米/);
  const v2m = q.q.match(/乙每分钟走\s*(\d+)\s*米/);
  if (!v1m || !v2m) return bad('相遇题未解析速度', q);
  const v1 = Number(v1m[1]), v2 = Number(v2m[1]);
  if (/____\s*分钟/.test(q.q)) {
    // 求相遇时间
    const sm = q.q.match(/相距\s*(\d+)\s*米/);
    if (!sm) return bad('相遇题（求时间）未解析总路程', q);
    const ans = Number(sm[1]) / (v1 + v2);
    if (ans !== Number(q.answer[0])) return bad('相遇时间不符，应为 ' + ans, q);
  } else {
    // 求总路程
    const tm = q.q.match(/经过\s*(\d+)\s*分钟/);
    if (!tm) return bad('相遇题（求路程）未解析时间', q);
    const ans = (v1 + v2) * Number(tm[1]);
    if (ans !== Number(q.answer[0])) return bad('总路程不符，应为 ' + ans, q);
  }
}
function checkChase(q) {
  const v1m = q.q.match(/甲每分钟走\s*(\d+)\s*米/);
  const v2m = q.q.match(/乙每分钟走\s*(\d+)\s*米/);
  if (!v1m || !v2m) return bad('追及题未解析速度', q);
  const v1 = Number(v1m[1]), v2 = Number(v2m[2] ? v2m[2] : v2m[1]);
  // Actually fix: v2m captures "乙每分钟走 V2 米"
  const v2real = Number(v2m[1]);
  if (v2real >= v1) return bad('追及题甲速应大于乙速', q);
  const diff = v1 - v2real;
  const t0m = q.q.match(/乙先出发\s*(\d+)\s*分钟/);
  if (!t0m) return bad('追及题未解析先出发时间', q);
  const t0 = Number(t0m[1]);
  const gap = v2real * t0;
  if (/____\s*分钟/.test(q.q)) {
    // 求追及时间
    if (gap % diff !== 0) return bad('追及题路程差不能被速度差整除', q);
    const ans = gap / diff;
    if (ans !== Number(q.answer[0])) return bad('追及时间不符，应为 ' + ans, q);
  } else {
    // 求路程差
    if (gap !== Number(q.answer[0])) return bad('路程差不符，应为 ' + gap, q);
  }
}
function checkTrain(q) {
  const lm = q.q.match(/长\s*(\d+)\s*米的火车/);
  const vm = q.q.match(/每秒\s*(\d+)\s*米/);
  if (!lm || !vm) return bad('火车过桥题未解析', q);
  const trainLen = Number(lm[1]), speed = Number(vm[1]);
  if (/____\s*秒/.test(q.q)) {
    // 求过桥时间
    const bm = q.q.match(/长\s*(\d+)\s*米的桥/);
    if (!bm) return bad('火车过桥（求时间）未解析桥长', q);
    const total = trainLen + Number(bm[1]);
    if (total % speed !== 0) return bad('火车过桥总路程不能被速度整除', q);
    const ans = total / speed;
    if (ans !== Number(q.answer[0])) return bad('过桥时间不符，应为 ' + ans, q);
  } else {
    // 求桥长
    const tm = q.q.match(/用了\s*(\d+)\s*秒/);
    if (!tm) return bad('火车过桥（求桥长）未解析时间', q);
    const total = speed * Number(tm[1]);
    const ans = total - trainLen;
    if (ans !== Number(q.answer[0])) return bad('桥长不符，应为 ' + ans, q);
  }
}
function checkRiver(q) {
  if (/顺水航行速度是\s*\d+/.test(q.q)) {
    // 已知顺逆水速求船速和水速（mode 2）
    const dm = q.q.match(/顺水航行速度是\s*(\d+)\s*千米\/时/);
    const um = q.q.match(/逆水航行速度是\s*(\d+)\s*千米\/时/);
    if (!dm || !um) return bad('流水行船题未解析顺逆水速', q);
    const d = Number(dm[1]), u = Number(um[1]);
    if ((d + u) % 2 !== 0 || (d - u) % 2 !== 0) return bad('顺逆水速之和/差不为偶数', q);
    const vb = (d + u) / 2, vw = (d - u) / 2;
    if (vb !== Number(q.answer[0]) || vw !== Number(q.answer[1]))
      return bad('船速/水速不符', q);
  } else {
    // 已知船速、水速求顺逆水速（mode 1）
    const bm = q.q.match(/静水中的速度是\s*(\d+)\s*千米\/时/);
    const wm = q.q.match(/水流速度是\s*(\d+)\s*千米\/时/);
    if (!bm || !wm) return bad('流水行船题未解析速度', q);
    const vb = Number(bm[1]), vw = Number(wm[1]);
    if (vb + vw !== Number(q.answer[0]) || vb - vw !== Number(q.answer[1]))
      return bad('顺逆水速不符', q);
  }
}

/* ---------- C4 几何模型 ---------- */
function checkPA(q) {
  if (/正方形/.test(q.q)) {
    const m = q.q.match(/边长是\s*(\d+)\s*厘米/);
    if (!m) return bad('周长面积（正方形）题未解析', q);
    const s = Number(m[1]);
    if (JSON.stringify([4 * s, s * s]) !== JSON.stringify(q.answer.map(Number)))
      return bad('正方形周长面积不符，应为 ' + JSON.stringify([4 * s, s * s]), q);
  } else if (/宽是\s*____\s*厘米/.test(q.q)) {
    const m = q.q.match(/周长是\s*(\d+)\s*厘米，长是\s*(\d+)\s*厘米/);
    if (!m) return bad('周长面积（求宽）题未解析', q);
    const P = Number(m[1]), L = Number(m[2]);
    if ((P / 2 - L) !== Number(q.answer[0])) return bad('宽不符，应为 ' + (P / 2 - L), q);
  } else {
    const m = q.q.match(/长是\s*(\d+)\s*厘米，宽是\s*(\d+)\s*厘米/);
    if (!m) return bad('周长面积（长方形）题未解析', q);
    const L = Number(m[1]), W = Number(m[2]);
    if (JSON.stringify([2 * (L + W), L * W]) !== JSON.stringify(q.answer.map(Number)))
      return bad('长方形周长面积不符，应为 ' + JSON.stringify([2 * (L + W), L * W]), q);
  }
}
function checkCutFill(q) {
  const m = q.q.match(/长\s*(\d+)\s*厘米、宽\s*(\d+)\s*厘米的长方形和一个边长\s*(\d+)\s*厘米的正方形/);
  if (!m) return bad('割补法题未解析', q);
  const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
  const ans = a * b + c * c;
  if (ans !== Number(q.answer[0])) return bad('割补面积不符，应为 ' + ans, q);
}
function checkAngle(q) {
  if (/∠1 = \d+°．∠2 = \d+°/.test(q.q) || /∠1 = \d+°，∠2 = \d+°/.test(q.q)) {
    const m = q.q.match(/∠1 = (\d+)°[，,]\s*∠2 = (\d+)°/);
    if (!m) return bad('角度（三角形）题未解析', q);
    const ans = 180 - Number(m[1]) - Number(m[2]);
    if (ans !== Number(q.answer[0])) return bad('三角形内角不符，应为 ' + ans, q);
  } else if (/互余/.test(q.q)) {
    const m = q.q.match(/∠A = (\d+)°/);
    if (!m) return bad('角度（互余）题未解析', q);
    if (90 - Number(m[1]) !== Number(q.answer[0])) return bad('余角不符，应为 ' + (90 - Number(m[1])), q);
  } else if (/互补/.test(q.q)) {
    const m = q.q.match(/∠A = (\d+)°/);
    if (!m) return bad('角度（互补）题未解析', q);
    if (180 - Number(m[1]) !== Number(q.answer[0])) return bad('补角不符，应为 ' + (180 - Number(m[1])), q);
  } else {
    return bad('角度题未识别模式', q);
  }
}
function checkCount(q) {
  // 三种表述：①"由 a×b 个小正方形组成" ②"a×b 方格的网格纸" ③"共 a 行、b 列小正方形"
  let a = null, b = null;
  let m = q.q.match(/由\s*(\d+)×(\d+)\s*个小正方形组成/);
  if (m) { a = Number(m[1]); b = Number(m[2]); }
  else {
    m = q.q.match(/(\d+)×(\d+)\s*方格的网格纸/);
    if (m) { a = Number(m[1]); b = Number(m[2]); }
    else {
      m = q.q.match(/共\s*(\d+)\s*行、(\d+)\s*列小正方形/);
      if (m) { a = Number(m[1]); b = Number(m[2]); }
    }
  }
  if (a === null) return bad('图形计数题未解析', q);
  const mn = Math.min(a, b);
  let total = 0; for (let k = 1; k <= mn; k++) total += (a - k + 1) * (b - k + 1);
  if (total !== Number(q.answer[0])) return bad('正方形计数不符，应为 ' + total, q);
}
function checkTransform(q) {
  const m = q.q.match(/正\s*(\d+)\s*边形/);
  if (!m) return bad('对称题未解析', q);
  if (Number(m[1]) !== Number(q.answer[0])) return bad('对称轴条数不符，应为 ' + m[1], q);
}
function checkSolid(q) {
  const m = q.q.match(/(\d+)×(\d+)×(\d+)\s*的长方体/);
  if (!m) return bad('立体图形题未解析', q);
  const ans = Number(m[1]) * Number(m[2]) * Number(m[3]);
  if (ans !== Number(q.answer[0])) return bad('小正方体数不符，应为 ' + ans, q);
}

/* ---------- C6 工程与浓度 ---------- */
function checkWork(q) {
  const m = q.q.match(/甲单独做一项工程需要\s*(\d+)\s*天，乙单独做同样的工程需要\s*(\d+)\s*天/);
  if (!m) return bad('工程题未解析', q);
  const a = Number(m[1]), b = Number(m[2]);
  const ans = (a * b) / (a + b);
  if (!Number.isInteger(ans)) return bad('工程题答案非整数（构造缺陷）', q);
  if (ans !== Number(q.answer[0])) return bad('合作天数不符，应为 ' + ans, q);
}
function checkConcentration(q) {
  if (/清水/.test(q.q)) {
    // 加水稀释
    const m = q.q.match(/(\d+)\s*克含盐\s*(\d+)%\s*的盐水加入\s*(\d+)\s*克清水/);
    if (!m) return bad('浓度（稀释）题未解析', q);
    const M = Number(m[1]), P = Number(m[2]), N = Number(m[3]);
    const ans = (M * P) / (M + N);
    if (!Number.isInteger(ans)) return bad('浓度（稀释）答案非整数', q);
    if (ans !== Number(q.answer[0])) return bad('稀释后含盐率不符，应为 ' + ans, q);
  } else if (/蒸发/.test(q.q)) {
    // 蒸发浓缩
    const m = q.q.match(/(\d+)\s*克含盐\s*(\d+)%\s*的盐水蒸发掉\s*(\d+)\s*克水/);
    if (!m) return bad('浓度（蒸发）题未解析', q);
    const M = Number(m[1]), P = Number(m[2]), N = Number(m[3]);
    const ans = (M * P) / (M - N);
    if (!Number.isInteger(ans)) return bad('浓度（蒸发）答案非整数', q);
    if (ans !== Number(q.answer[0])) return bad('蒸发后含盐率不符，应为 ' + ans, q);
  } else {
    // 混合
    const m = q.q.match(/(\d+)\s*克含盐\s*(\d+)%\s*的盐水和\s*(\d+)\s*克含盐\s*(\d+)%\s*的盐水/);
    if (!m) return bad('浓度（混合）题未解析', q);
    const M = Number(m[1]), P = Number(m[2]), N = Number(m[3]), Q = Number(m[4]);
    const ans = (M * P + N * Q) / (M + N);
    if (!Number.isInteger(ans)) return bad('浓度（混合）答案非整数', q);
    if (ans !== Number(q.answer[0])) return bad('混合后含盐率不符，应为 ' + ans, q);
  }
}

/* ---------- C7 分数与巧算 ---------- */
/* 有理数精确运算（校验器专用）：所有 C7 子题型都「逐项真算」而不套用插件用的闭式公式，
   这样闭式推错也能被抓出来。每步都约分，分子分母不会膨胀。 */
function vRat(n, d) {
  if (d < 0) { n = -n; d = -d; }
  const g = vGcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
function vAdd(x, y) { return vRat(x.n * y.d + y.n * x.d, x.d * y.d); }
function vMul(x, y) { return vRat(x.n * y.n, x.d * y.d); }
function vDiv(x, y) { return vRat(x.n * y.d, x.d * y.n); }
/** 解析「整数 / a/b / 小数」为有理数 */
function vParse(s) {
  s = String(s == null ? '' : s).trim().replace(/\s+/g, '');
  let m = s.match(/^(-?\d+)\/(\d+)$/);
  if (m) return Number(m[2]) ? vRat(Number(m[1]), Number(m[2])) : null;
  if (/^-?\d+$/.test(s)) return vRat(Number(s), 1);
  m = s.match(/^(-?)(\d*)\.(\d+)$/);
  if (m) {
    const den = Math.pow(10, m[3].length);
    return vRat((m[1] === '-' ? -1 : 1) * (Number(m[2] || '0') * den + Number(m[3])), den);
  }
  return null;
}
function vFmt(r) { return r.d === 1 ? String(r.n) : r.n + '/' + r.d; }
/** 把 q.answer[0] 与独立算出的有理数比对（等值即可，容许非最简写法） */
function vCmp(q, right, label) {
  const got = vParse(q.answer[0]);
  if (!got) return bad(label + '答案无法解析为分数：' + q.answer[0], q);
  if (got.n * right.d !== right.n * got.d) return bad(label + '不符，应为 ' + vFmt(right), q);
  // 竞赛题要求最简分数：插件给出的标准答案本身必须已约分
  if (vFmt(got) !== String(q.answer[0]).trim()) return bad(label + '标准答案未约分：' + q.answer[0] + ' 应写作 ' + vFmt(got), q);
}

/** 裂项相消：从题面取出首两项与末项，反推公差与分母跨度，再逐项累加求和 */
function checkTelescope(q) {
  const pairs = [...q.q.matchAll(/1\/\((\d+)×(\d+)\)/g)].map(m => [Number(m[1]), Number(m[2])]);
  if (pairs.length < 4) return bad('裂项题未解析到足够的项（' + pairs.length + '）', q);
  const a1 = pairs[0][0], d = pairs[0][1] - pairs[0][0];
  const step = pairs[1][0] - pairs[0][0];
  const aLast = pairs[pairs.length - 1][0];
  if (step <= 0 || d <= 0) return bad('裂项题项间步长解析异常', q);
  if ((aLast - a1) % step !== 0) return bad('裂项题末项与步长不匹配', q);
  // 前三项须与推出的通项一致（防止题面自身不成规律）
  for (let i = 0; i < 3; i++) {
    const a = a1 + i * step;
    if (pairs[i][0] !== a || pairs[i][1] !== a + d) return bad('裂项题第 ' + (i + 1) + ' 项不符合等差规律', q);
  }
  // 题面自洽：末项必须真的在省略号之后，不能与已展示的前三项重合（否则「… + 末项」自相矛盾）
  if (aLast <= pairs[2][0]) return bad('裂项题末项 1/(' + aLast + '×' + (aLast + d) + ') 已在省略号前展示过（题面自相矛盾）', q);
  let sum = vRat(0, 1), terms = 0;
  for (let a = a1; a <= aLast; a += step) {
    sum = vAdd(sum, vRat(1, a * (a + d)));
    if (++terms > 5000) return bad('裂项题项数异常', q);
  }
  return vCmp(q, sum, '裂项求和');
}

/** 繁分数化简：按三种题面结构反解参数，用有理数逐层真算 */
function checkComplex(q) {
  let m = q.q.match(/1\s*÷\s*\((\d+)\s*\+\s*1\s*÷\s*\((\d+)\s*\+\s*1\/(\d+)\)\)/);
  if (m) {  // 三层连分数（须先匹配，其片段包含单层结构）
    const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
    const inner = vAdd(vRat(b, 1), vRat(1, c));            // b + 1/c
    const val = vDiv(vRat(1, 1), vAdd(vRat(a, 1), vDiv(vRat(1, 1), inner)));
    return vCmp(q, val, '三层繁分数');
  }
  m = q.q.match(/\(1\s*\+\s*1\/(\d+)\)\s*÷\s*\(1\s*-\s*1\/(\d+)\)/);
  if (m) {
    if (m[1] !== m[2]) return bad('繁分数题两处分母不一致', q);
    const a = Number(m[1]);
    if (a < 2) return bad('繁分数题分母过小（会出现除以 0）', q);
    const val = vDiv(vAdd(vRat(1, 1), vRat(1, a)), vAdd(vRat(1, 1), vRat(-1, a)));
    return vCmp(q, val, '繁分数（和差型）');
  }
  m = q.q.match(/1\s*÷\s*\((\d+)\s*\+\s*1\/(\d+)\)/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    const val = vDiv(vRat(1, 1), vAdd(vRat(a, 1), vRat(1, b)));
    return vCmp(q, val, '繁分数（单层）');
  }
  return bad('繁分数题未识别结构', q);
}

/** 分数巧算：分配律型逐项相乘再相加；连乘型与等比型按项真算，均不套闭式 */
function checkClever(q) {
  let m = q.q.match(/(\d+)\/(\d+)\s*×\s*(\d+)\s*\+\s*(\d+)\/(\d+)\s*×\s*(\d+)\s*=/);
  if (m) {
    const a1 = Number(m[1]), b1 = Number(m[2]), x = Number(m[3]);
    const a2 = Number(m[4]), b2 = Number(m[5]), y = Number(m[6]);
    if (a1 !== a2 || b1 !== b2) return bad('巧算（分配律）两处分数不一致，无法提取公因数', q);
    const val = vAdd(vMul(vRat(a1, b1), vRat(x, 1)), vMul(vRat(a2, b2), vRat(y, 1)));
    return vCmp(q, val, '巧算（分配律）');
  }
  m = q.q.match(/\(1\s*-\s*1\/2\)[\s\S]*×\s*\(1\s*-\s*1\/(\d+)\)\s*=/);
  if (m) {
    const n = Number(m[1]);
    // 题面展示到 (1 − 1/4)，末项必须在其之后，否则「… × 末项」自相矛盾
    if (n <= 4) return bad('巧算（连乘）末项 (1 - 1/' + n + ') 已在省略号前展示过（题面自相矛盾）', q);
    let prod = vRat(1, 1);
    for (let k = 2; k <= n; k++) prod = vMul(prod, vAdd(vRat(1, 1), vRat(-1, k)));
    return vCmp(q, prod, '巧算（连乘裂项）');
  }
  m = q.q.match(/1\/2\s*\+\s*1\/4\s*\+\s*1\/8[\s\S]*\+\s*1\/(\d+)\s*=/);
  if (m) {
    const last = Number(m[1]);
    // 题面展示到 1/8，末项必须在其之后
    if (last <= 8) return bad('巧算（等比）末项 1/' + last + ' 已在省略号前展示过（题面自相矛盾）', q);
    let sum = vRat(0, 1), p = 2, guard = 0;
    while (p <= last) {
      sum = vAdd(sum, vRat(1, p));
      p *= 2;
      if (++guard > 60) return bad('巧算（等比）末项不是 2 的幂', q);
    }
    if (p !== last * 2) return bad('巧算（等比）末项 ' + last + ' 不是 2 的幂', q);
    return vCmp(q, sum, '巧算（等比凑整）');
  }
  return bad('巧算题未识别结构', q);
}

/** 分数数列规律：取出已展示的 4 项与项数 k，用四个候选通项族逐一验证，
    要求「恰好一个族与全部已展示项吻合」——这正是「规律唯一可辨」的独立证据。 */
const PAT_FAMILIES = [
  k => [k, k + 1],
  k => [1, Math.pow(2, k)],
  k => [2 * k - 1, 2 * k + 1],
  k => [k, 2 * k + 1]
];
function checkPattern(q) {
  const terms = [...q.q.matchAll(/(\d+)\/(\d+)/g)].map(m => [Number(m[1]), Number(m[2])]);
  if (terms.length !== 4) return bad('规律题展示项数为 ' + terms.length + '（应为 4）', q);
  const km = q.q.match(/第\s*(\d+)\s*(?:项|个数)/);
  if (!km) return bad('规律题未解析到项数 k', q);
  const k = Number(km[1]);
  // 题面自洽：所求项必须在省略号之后，落在已展示的 4 项内则等于直接给出答案
  if (k <= 4) return bad('规律题所求第 ' + k + ' 项已在题面展示（答案被直接给出）', q);
  const hit = PAT_FAMILIES.filter(f => terms.every((t, i) => {
    const e = f(i + 1);
    return e[0] * t[1] === t[0] * e[1];   // 按数值等价比较，容许展示项非最简
  }));
  if (!hit.length) return bad('规律题前 4 项不符合任何候选通项族（规律不明确）', q);
  if (hit.length > 1) return bad('规律题前 4 项同时符合 ' + hit.length + ' 个通项族（规律不唯一）', q);
  const e = hit[0](k);
  return vCmp(q, vRat(e[0], e[1]), '规律第 ' + k + ' 项');
}

/* ---------- C8 最值与逻辑推理 ---------- */
/** 最值问题：①定和求最大积 ②给定数字组成最大/最小数（不套闭式，从题面反解独立算） */
function checkExtreme(q) {
  if (/拆成两个正整数/.test(q.q)) {
    const m = q.q.match(/把\s*(\d+)\s*拆成两个正整数/);
    if (!m) return bad('最值（定和）题未解析', q);
    const S = Number(m[1]);
    const a = Math.floor(S / 2);
    const ans = a * (S - a);
    if (ans !== Number(q.answer[0])) return bad('最值（定和）乘积不符，应为 ' + ans, q);
    return;
  }
  const dm = q.q.match(/用数字\s*([0-9、]+)\s*各一次，组成(最大|最小)的\s*(\d+)\s*位数/);
  if (!dm) return bad('最值（组数）题未解析', q);
  const digits = dm[1].split('、').map(Number);
  const big = dm[2] === '最大';
  const d = Number(dm[3]);
  if (digits.length !== d) return bad('最值（组数）数字个数与位数不符', q);
  let arr;
  if (big) {
    arr = digits.slice().sort((a, b) => b - a);
  } else {
    arr = digits.slice().sort((a, b) => a - b);
    if (arr[0] === 0) {                 // 0 不能作首位，与首个非零交换
      let ni = 1;
      for (let i = 1; i < arr.length; i++) { if (arr[i] !== 0) { ni = i; break; } }
      const t = arr[0]; arr[0] = arr[ni]; arr[ni] = t;
    }
  }
  const ans = Number(arr.join(''));
  if (ans !== Number(q.answer[0])) return bad('最值（组数）' + (big ? '最大' : '最小') + '数不符，应为 ' + ans, q);
}

/** 抽屉原理：N 个物体放入 M 个抽屉，至少有 ⌈N/M⌉ 个同屉（题面恰含两个数字 N、M） */
function checkDrawer(q) {
  const nums = (q.q.match(/\d+/g) || []).map(Number);
  if (nums.length < 2) return bad('抽屉原理题未解析到 N、M', q);
  const N = nums[0], M = nums[1];
  const ans = Math.floor((N - 1) / M) + 1;   // = ⌈N/M⌉
  if (ans !== Number(q.answer[0])) return bad('抽屉原理答案不符，应为 ' + ans, q);
}

/** 逻辑推理：①比较链排位（全序链问最值端）②唯一真话推理（恰一人说真话 → 第三人做的） */
function checkLogic(q) {
  // 模式 B：唯一真话推理（p 指认 q，q 与 r 都否认，恰一人说真话 ⇒ r 做的）
  const m1 = q.q.match(/([\u4e00-\u9fa5])说[：:]\s*[「""']?是([\u4e00-\u9fa5])拿的/);
  if (m1 && /只有一人说了真话/.test(q.q)) {
    const speaker = m1[1], accused = m1[2];
    const denies = [...q.q.matchAll(/([\u4e00-\u9fa5])说[：:]\s*[「""']?不是我拿的/g)].map(x => x[1]);
    if (denies.length < 2) return bad('逻辑（真话）题否定句解析失败', q);
    const r = denies.find(d => d !== accused);
    if (!r) return bad('逻辑（真话）题无法确定第三人', q);
    const cand = [speaker, accused, r];
    const hit = cand.filter(doer => {
      const t1 = (doer === accused) ? 1 : 0;      // p 说「是 q 拿的」
      const t2 = (doer !== accused) ? 1 : 0;      // q 说「不是我」
      const t3 = (doer !== r) ? 1 : 0;            // r 说「不是我」
      return t1 + t2 + t3 === 1;
    });
    if (hit.length !== 1) return bad('逻辑（真话）题解不唯一（' + hit.length + '）', q);
    if (hit[0] !== q.answer[0]) return bad('逻辑（真话）答案不符，应为 ' + hit[0], q);
    return;
  }
  // 模式 A：比较链排位（A 比 B 维度词 ⇒ A>B 或 A<B；用传递闭包求全序后的最值端）
  if (/比/.test(q.q) && /最(高|重|快|大|矮|轻|慢|小)的/.test(q.q)) {
    const sign = { '高': 1, '重': 1, '快': 1, '大': 1, '矮': -1, '轻': -1, '慢': -1, '小': -1 };
    const rel = [...q.q.matchAll(/([\u4e00-\u9fa5])比([\u4e00-\u9fa5])(高|重|快|大|矮|轻|慢|小)/g)];
    if (!rel.length) return bad('逻辑（比较链）题未解析到比较关系', q);
    const names = new Set();
    const greater = {};                            // node → 它严格大于的节点集合（含传递）
    rel.forEach(m => {
      const A = m[1], B = m[2], w = m[3];
      names.add(A); names.add(B);
      if (!greater[A]) greater[A] = new Set(); if (!greater[B]) greater[B] = new Set();
      if (sign[w] === 1) greater[A].add(B); else greater[B].add(A);   // pos 词：A 更大；neg 词：B 更大
    });
    if (names.size !== 3) return bad('逻辑（比较链）题涉及人数不为 3（' + names.size + '）', q);
    // 传递闭包（节点极少，简单迭代即可）
    let changed = true;
    while (changed) {
      changed = false;
      [...names].forEach(a => [...greater[a]].forEach(b => [...greater[b]].forEach(c => {
        if (!greater[a].has(c)) { greater[a].add(c); changed = true; }
      })));
    }
    const arr = [...names];
    const sizes = arr.map(n => greater[n].size);
    const maxEnt = arr[sizes.indexOf(2)];          // 严格大于另外两人
    const minEnt = arr[sizes.indexOf(0)];          // 严格小于另外两人
    const askMax = /最(高|重|快|大)的/.test(q.q);
    const ans = askMax ? maxEnt : minEnt;
    if (!ans) return bad('逻辑（比较链）题无法确定唯一最值', q);
    if (ans !== q.answer[0]) return bad('逻辑（比较链）答案不符，应为 ' + ans, q);
    return;
  }
  return bad('逻辑推理题未识别模式', q);
}

// 新增 Cx 插件时在此登记该插件各 question.type 的独立求解器
const CHECKERS = {
  vertical: checkVertical,     // C1 竖式数字谜
  horizontal: checkHorizontal, // C1 横式数字谜
  symbol: checkSymbol,         // C1 符号代表数
  array: checkArray,           // C1 数阵图
  magic: checkMagic,           // C1 幻方
  parity: checkParity,         // C2 奇偶性
  divisible: checkDivisible,   // C2 整除特征
  prime: checkPrime,           // C2 质数合数
  factor: checkFactor,         // C2 因数倍数
  remainder: checkRemainder,   // C2 余数问题
  place: checkPlace,           // C2 位值原理
  enum: checkEnum,             // C3 枚举法
  am: checkAM,                 // C3 加乘原理
  perm: checkPerm,             // C3 排列组合
  geomcount: checkGeomCount,   // C3 几何计数
  worst: checkWorst,           // C3 最不利原则
  basic: checkBasic,           // C5 基本行程
  meet: checkMeet,             // C5 相遇问题
  chase: checkChase,          // C5 追及问题
  train: checkTrain,           // C5 火车过桥
  river: checkRiver,           // C5 流水行船
  pa: checkPA,                // C4 周长与面积
  cutfill: checkCutFill,       // C4 割补法
  angle: checkAngle,           // C4 角度初步
  count: checkCount,           // C4 图形计数
  transform: checkTransform,   // C4 对称与变换
  solid: checkSolid,           // C4 立体图形
  work: checkWork,             // C6 工程问题
  concentration: checkConcentration, // C6 浓度问题
  telescope: checkTelescope,   // C7 裂项相消
  complex: checkComplex,       // C7 繁分数化简
  clever: checkClever,         // C7 分数巧算
  pattern: checkPattern,       // C7 分数数列规律
  extreme: checkExtreme,       // C8 最值问题
  drawer: checkDrawer,         // C8 抽屉原理
  logic: checkLogic            // C8 逻辑推理
};

/* ==================== 主流程 ==================== */

/** 从插件 settings 里取 type chip 的候选值（无则只跑默认一轮） */
function subTypes(plugin) {
  const s = (plugin.settings || []).find(x => x && x.key === 'type');
  if (!s || !Array.isArray(s.options)) return [null];
  return s.options.map(o => o.value);
}

function runOne(plugin, rec) {
  const modules = (rec.moduleIds || []).join('/');
  console.log('\n▶ ' + rec.id + '（' + modules + ' ' + rec.name + '） grades=' + JSON.stringify(rec.grades));
  const grade = (rec.grades && rec.grades[0]) || 4;
  let cases = 0;
  [3, 6, 9].forEach(difficulty => {
    subTypes(plugin).forEach(type => {
      const before = FAIL;
      const opts = { grade, count: COUNT, difficulty };
      if (type) opts.type = type;
      let set;
      try {
        set = plugin.generate(opts);
      } catch (e) {
        FAIL++;
        console.log('    ✗ [' + (type || 'default') + ' lv' + difficulty + '] generate 抛错：' + e.message);
        return;
      }
      const qs = set.questions || [];
      const sigs = {};
      let dup = 0, selfFail = 0;
      qs.forEach((q, i) => {
        // ① 满分回填
        const answers = {};
        if (Array.isArray(q.answer)) q.answer.forEach((a, j) => { answers[i + ':' + j] = String(a); });
        else answers[i] = String(q.answer);
        const ok = typeof q.check === 'function' ? q.check(answers, i) : null;
        if (ok === false) { selfFail++; bad('满分回填未判对', q); }
        // ② 题面去重
        const sig = q.q + '|' + (q.svg || '');
        if (sigs[sig]) dup++; else sigs[sig] = 1;
        // ③ 独立求解
        const fn = CHECKERS[q.type];
        if (fn) fn(q); else uncoveredTypes.add(q.type);
      });
      if (qs.length < COUNT) { FAIL++; console.log('    ✗ [' + (type || 'default') + ' lv' + difficulty + '] 题量不足：' + qs.length + '/' + COUNT); }
      if (dup) { FAIL++; console.log('    ✗ [' + (type || 'default') + ' lv' + difficulty + '] 题面重复 ' + dup + ' 题'); }
      cases++;
      const tag = FAIL === before ? '✓' : '✗';
      console.log('  ' + tag + ' [' + (type || 'default') + ' lv' + difficulty + '] ' + qs.length + ' 题'
        + (dup ? '  重复 ' + dup : '') + (selfFail ? '  自批失败 ' + selfFail : ''));
    });
  });
  return cases;
}

const comp = PLUGIN_REGISTRY.filter(r => !r.isPlaceholder
  && Array.isArray(r.moduleIds) && r.moduleIds.some(id => /^C\d$/.test(id))
  // 五年级竞赛新语义题型由 dev/verify-g5-competition.js 专项校验，此处跳过
  && !/g5-c\d/.test(r.id)
  && (!ONLY || r.moduleIds.indexOf(ONLY) >= 0));

console.log('🏆 竞赛插件专项校验（答案正确性 / 解唯一性 / 题面去重）');
console.log('   抽样：每子题型 × 难度 3/6/9 各 ' + COUNT + ' 题');
if (!comp.length) {
  console.log('\n⚠️  没有匹配的已实现竞赛插件' + (ONLY ? '（--only ' + ONLY + '）' : '') + '，跳过。');
  process.exit(0);
}

let totalCases = 0;
comp.forEach(rec => {
  let plugin;
  try {
    plugin = require(path.join(ROOT, rec.file));
  } catch (e) {
    FAIL++;
    console.log('\n✗ ' + rec.id + ' 加载失败：' + e.message);
    return;
  }
  totalCases += runOne(plugin, rec);
});

console.log('\n' + '='.repeat(60));
if (uncoveredTypes.size) {
  console.log('⚠️  以下 question.type 尚无独立求解器，仅做了自批与去重校验：'
    + [...uncoveredTypes].join('、'));
  console.log('   请在 dev/verify-competition.js 的 CHECKERS 中补充对应求解器。');
}
if (FAIL === 0) {
  console.log('✅ 竞赛插件校验通过：' + comp.length + ' 个插件 / ' + totalCases + ' 组抽样，答案正确、解唯一、题面无重复。');
  process.exit(0);
} else {
  console.log('❌ 竞赛插件校验未通过：共 ' + FAIL + ' 个问题，请修复后重跑。');
  process.exit(1);
}
