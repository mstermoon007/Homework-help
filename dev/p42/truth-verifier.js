/**
 * dev/p42/truth-verifier.js — P42-1C 独立数学真值验证器（只读审计工具，非生产链）
 *
 * 背景（P42-DEFECT-REGISTER §0.4）：P42-0 审计工具有五类解析缺陷，产生 11 例误报：
 *   1. 带余除法「商……余数」被截断（001/002）
 *   2. 分数 a/b 在右值位置被截成 a（010/011/012/018）
 *   3. 多步算式内嵌单步等式被子串摘出（013）
 *   4. 百分数 xx% 被剥成 xx（014/015/016）
 *   5. a/b ÷ c/d 被当连除链（017）
 *
 * 本验证器对题干/解析中每个等式子句做逐段独立重算：
 *   - 精确有理数运算（整数/小数/分数原子/百分数原子/括号），交叉相乘判等，不用浮点
 *   - 「商……余数」记法：仅当左值恰为单步除法 a ÷ b 时验证 b×q+r=a 且 0≤r<b
 *   - 等式逐「=」分段取相邻对，左段取尾部完整表达式——不做跨段子串匹配
 *   - 含拉丁字母（代数式）、不可解析、左段尾部为未完链式（后随运算符）→ UNVERIFIED（跳过，不判错）
 *
 * 导出：
 *   evalExprFull(s)      → 有理数 {n,d} | null（不可解析）
 *   checkClause(clause)  → 'PASS' | 'FAIL:…' | null（无断言/UNVERIFIED）
 *   auditExplanation(text, answerValue?) → { status:'PASS'|'UNVERIFIED'|'FAIL', checked, failures }
 *     answerValue 提供时，含单个空位（____/（ ））的子句先代入答案再校验（题干↔答案一致性）
 *   auditQuestion(sq)    → 汇总题干+解析：{ status, checked, failures }
 */
'use strict';

/* ---------------- 精确有理数 ---------------- */

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a; }
function R(n, d) {
  if (d === 0 || !isFinite(n) || !isFinite(d)) return null;
  if (d < 0) { n = -n; d = -d; }
  var g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
function rAdd(a, b) { return R(a.n * b.d + b.n * a.d, a.d * b.d); }
function rSub(a, b) { return R(a.n * b.d - b.n * a.d, a.d * b.d); }
function rMul(a, b) { return R(a.n * b.n, a.d * b.d); }
function rDiv(a, b) { if (b.n === 0) return null; return R(a.n * b.d, a.d * b.n); }
function rEq(a, b) { return a.n * b.d === b.n * a.d; }
function rFromDecimal(s) {
  var i = s.indexOf('.');
  if (i < 0) return R(parseInt(s, 10), 1);
  var ip = s.slice(0, i) || '0';
  var fp = s.slice(i + 1);
  if (!/^\d+$/.test(fp)) return null;
  return R(parseInt(ip + fp, 10), Math.pow(10, fp.length));
}

// 全角 → ASCII（仅数学记号；不转字母，拉丁字母在子句级已判 UNVERIFIED）。
// P42-1C 面审计补：全角运算符 ＋－＊／ 与 ＝（）（全角正文高频），一律归一后参与解析。
function normalizeMath(s) {
  return String(s)
    .replace(/＝/g, '=').replace(/（/g, '(').replace(/）/g, ')')
    .replace(/＋/g, '+').replace(/－/g, '-').replace(/＊/g, '*').replace(/／/g, '/')
    .replace(/％/g, '%').replace(/×/g, '*').replace(/÷/g, '/')
    .replace(/−/g, '-').replace(/[\u00A0\u3000]/g, ' ');
}

/* ---------------- 表达式解析（token → 递归下降 → 有理数） ---------------- */

// 原子：整数/小数 [ / 整数/小数 ] [ % ]
var ATOM_SRC = '\\d+(?:\\.\\d+)?(?:/\\d+(?:\\.\\d+)?)?%?';

function tokenize(s) {
  var tokens = [], i = 0;
  while (i < s.length) {
    var ch = s[i];
    if (ch === ' ') { i++; continue; }
    if ('+-*/()%'.indexOf(ch) !== -1) { tokens.push({ t: ch }); i++; continue; }
    var m = new RegExp('^' + ATOM_SRC).exec(s.slice(i));
    if (m) { tokens.push({ t: 'atom', v: m[0] }); i += m[0].length; continue; }
    return null; // 非法字符 → 不可解析
  }
  return tokens;
}

function parseTokens(tokens) {
  var pos = 0;
  function peek() { return tokens[pos]; }
  function eat() { return tokens[pos++]; }
  function parseExpr() {
    var left = parseTerm();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      var op = eat().t;
      var right = parseTerm();
      left = { op: op, l: left, r: right };
    }
    return left;
  }
  function parseTerm() {
    var left = parseUnary();
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      var op = eat().t;
      var right = parseUnary();
      left = { op: op, l: left, r: right };
    }
    return left;
  }
  function parseUnary() {
    if (peek() && peek().t === '-') { eat(); var v = parseUnary(); return { op: 'neg', v: v }; }
    return parsePostfix();
  }
  function parsePostfix() {
    var node = parsePrimary();
    return node;
  }
  function parsePrimary() {
    var tk = peek();
    if (!tk) return null;
    if (tk.t === 'atom') { eat(); return { atom: tk.v }; }
    if (tk.t === '(') {
      eat();
      var inner = parseExpr();
      if (!inner || !peek() || peek().t !== ')') return null;
      eat();
      return inner;
    }
    return null;
  }
  var ast = parseExpr();
  if (!ast || pos !== tokens.length) return null;
  return ast;
}

function evalAtom(a) {
  var s = a;
  var percent = /%$/.test(s);
  if (percent) s = s.slice(0, -1);
  var frac = s.split('/');
  var val;
  if (frac.length === 2) {
    var nu = rFromDecimal(frac[0]), de = rFromDecimal(frac[1]);
    if (!nu || !de) return null;
    val = rDiv(nu, de);
  } else {
    val = rFromDecimal(s);
  }
  if (!val) return null;
  return percent ? rDiv(val, R(100, 1)) : val;
}

function evalAst(node) {
  if (!node) return null;
  if (node.atom) return evalAtom(node.atom);
  if (node.op === 'neg') { var v = evalAst(node.v); return v ? R(-v.n, v.d) : null; }
  var l = evalAst(node.l), r = evalAst(node.r);
  if (!l || !r) return null;
  if (node.op === '+') return rAdd(l, r);
  if (node.op === '-') return rSub(l, r);
  if (node.op === '*') return rMul(l, r);
  if (node.op === '/') return rDiv(l, r);
  return null;
}

// 完整表达式求值：可解析返回有理数，否则 null（UNVERIFIED）
function evalExprFull(s) {
  var norm = normalizeMath(s).trim();
  if (!norm) return null;
  var tokens = tokenize(norm);
  if (!tokens) return null;
  var ast = parseTokens(tokens);
  if (!ast) return null;
  return evalAst(ast);
}

/* ---------------- 子句内等式校验 ---------------- */

// 左段尾部表达式：原子（运算符 原子）* 收尾；支持一层括号组
var TAIL_RE = new RegExp('(?:\\([^()]*\\)|' + ATOM_SRC + ')(?:\\s*[+*/\\-]\\s*(?:\\([^()]*\\)|' + ATOM_SRC + '))*\\s*$');
// 右值首原子
var LEAD_RE = new RegExp('^\\s*(' + ATOM_SRC + ')');
// 带余右值：q……r / q...r / q余r（后随文字允许，但 q、r 后不得紧跟数字）
var REM_LEAD_RE = /^(\d+)\s*(?:…+|\.{3,}|余)\s*(\d+)(?![0-9])/;

// 左段尾部提取（含边界守卫）；返回 { tail, ok } —— ok:false 表示有尾部但属未完链式等不可判定形态
function lhsTail(seg) {
  var norm = normalizeMath(seg);
  var m = TAIL_RE.exec(norm);
  if (!m) return { tail: null, ok: true };
  var tail = m[0].trim();
  // 边界守卫：尾部首字符前（忽略空格）不得为运算符/数字/点/斜杠/字母/百分号/比号——
  // 「15 + 18 −」截出「5」、「3a」截出「1」、「x∶2」截出「2」等部分操作数形态一律不可判定
  var before = norm.slice(0, m.index).replace(/\s+$/, '');
  if (before && /[+\-*/%.0-9a-zA-Z∶]$/.test(before)) return { tail: null, ok: false };
  return { tail: tail, ok: true };
}

// 右段值提取：优先整段表达式，其次首原子（带边界守卫）；带余形态单独返回
function rhsValue(seg) {
  var norm = normalizeMath(seg).trim();
  if (!norm) return { kind: 'none' };
  var rm = REM_LEAD_RE.exec(norm);
  if (rm && !/\d\s*[+*/-]/.test(norm.slice(rm[0].length, rm[0].length + 2))) {
    return { kind: 'remainder', q: parseInt(rm[1], 10), r: parseInt(rm[2], 10) };
  }
  var full = evalExprFull(norm);
  if (full) return { kind: 'value', val: full };
  var lm = LEAD_RE.exec(norm);
  if (lm) {
    var rest = norm.slice(lm[0].length);
    // P42-1C 面审计补（两类误报规避）：
    // ① 尾注含数字（「1 个十和 7 个一」位值短语）→ 首原子不代表完整值 → 不可判定；
    // ② 尾注为运算符/数字/比号开头 → 首原子只是片段 → 不可判定（既有守卫，增补 ∶）。
    if (/\d/.test(rest) || /^\s*[+\-*/%.0-9∶]/.test(rest)) return { kind: 'none' };
    var v = evalAtom(lm[1]);
    if (v) {
      // 万/亿计数单位：首原子后紧跟「万/亿」（其后无数字，排除「12万3千」复合数）→ 精确缩放
      var rt = rest.trim();
      var scale = rt.charAt(0) === '万' ? R(10000, 1) : rt.charAt(0) === '亿' ? R(100000000, 1) : null;
      return { kind: 'value', val: scale ? rMul(v, scale) : v };
    }
  }
  return { kind: 'none' };
}

/**
 * 单子句等式校验。
 * 返回 'PASS' | 'FAIL:…' | null（无断言或 UNVERIFIED——不判错）。
 */
function checkClause(clause) {
  var norm = normalizeMath(clause);
  if (norm.indexOf('=') === -1) return null;
  var segs = norm.split('=');
  if (segs.length < 2) return null;
  var verified = 0;
  for (var i = 0; i < segs.length - 1; i++) {
    var lhs = lhsTail(segs[i]);
    if (!lhs.ok || !lhs.tail) continue; // 左段无完整尾部 → UNVERIFIED
    var lhsVal = evalExprFull(lhs.tail);
    if (!lhsVal) continue; // 不可解析 → UNVERIFIED
    var rhs = rhsValue(segs[i + 1]);
    if (rhs.kind === 'none') continue;
    if (rhs.kind === 'remainder') {
      // 「商……余数」仅对单步除法断言（左段尾部恰为 a / b）
      var dm = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(lhs.tail);
      if (!dm) continue; // 多步/非除法配余数记法 → UNVERIFIED
      var a = rFromDecimal(dm[1]), b = rFromDecimal(dm[2]);
      if (!a || !b || b.n === 0) continue;
      // 仅整数除法验证余数语义
      if (a.d !== 1 || b.d !== 1) continue;
      var okRem = rhs.r >= 0 && rhs.r < b.n && b.n * rhs.q + rhs.r === a.n;
      if (!okRem) return 'FAIL: ' + lhs.tail + ' ≠ ' + rhs.q + '……' + rhs.r + ' (clause: ' + clause + ')';
      verified++;
      continue;
    }
    if (!rEq(lhsVal, rhs.val)) {
      return 'FAIL: ' + lhs.tail + ' ≠ ' + segs[i + 1].trim() + ' (clause: ' + clause + ')';
    }
    verified++;
  }
  // 全部相邻对均 UNVERIFIED → 本子句无有效断言，返回 null（不计 PASS）
  return verified > 0 ? 'PASS' : null;
}

/* ---------------- 文本级审计 ---------------- */

var CLAUSE_SPLIT = /[，。；：！？\n]+/;
var BLANK_RE = /(?:[_＿]{2,}|（\s*）|\(\s*\))/g;

/**
 * 审计一段题干/解析文本。
 * @param {string} text
 * @param {*} answerValue 可选：答案标量（用于空位代入一致性校验）
 * @returns {{status:'PASS'|'UNVERIFIED'|'FAIL', checked:number, failures:string[]}}
 */
function auditExplanation(text, answerValue) {
  var failures = [];
  var checked = 0;
  var clauses = String(text == null ? '' : text).split(CLAUSE_SPLIT);
  for (var i = 0; i < clauses.length; i++) {
    var clause = clauses[i];
    if (!clause) continue;
    var hasBlank = BLANK_RE.test(clause);
    BLANK_RE.lastIndex = 0;
    if (hasBlank) {
      // 空位子句：恰一个空位且答案为标量 → 代入后校验（题干↔答案一致性）
      BLANK_RE.lastIndex = 0;
      var blanks = clause.match(BLANK_RE) || [];
      BLANK_RE.lastIndex = 0;
      var av = answerValue == null ? null : String(answerValue).trim();
      if (blanks.length === 1 && av && /^[-−0-9./%…+*]+$/.test(av)) {
        // P42-1C 面审计补：空位后随「/N」（如「____/12」）时空位是分子位——
        // 仅当答案恰为 a/N 时代入分子 a（代入整分数会产出「6/12/12」伪影）；
        // 分母不吻合或答案非分数 → 放弃代入（原样保留空位 → UNVERIFIED，不制造伪断言）。
        BLANK_RE.lastIndex = 0;
        var bm = BLANK_RE.exec(clause);
        BLANK_RE.lastIndex = 0;
        var slashN = /^\/\s*(\d+(?:\.\d+)?)/.exec(clause.slice(bm.index + bm[0].length));
        var sub = av;
        if (slashN) {
          // 分子位空位：分数答案 a/b 仅当 b === N 时代入分子 a（防「6/12/12」伪影）；
          // 标量答案即为分子，直接代入（旧行为，如「1/3 = ____/15」填 5）。
          var fm = /^(-?[0-9]+(?:\.[0-9]+)?)\/(-?[0-9]+(?:\.[0-9]+)?)$/.exec(av);
          if (fm) sub = (fm[2] === slashN[1]) ? fm[1] : null;
        }
        if (sub != null) {
          var filled = clause.replace(BLANK_RE, sub);
          BLANK_RE.lastIndex = 0;
          var rf = checkClause(filled);
          if (rf === 'PASS') { checked++; continue; }
          if (rf && rf.indexOf('FAIL') === 0) { failures.push(rf); continue; }
          // 代入后仍不可解析 → 落回原文校验（多数为 UNVERIFIED）
        }
      }
      var rf0 = checkClause(clause);
      if (rf0 === 'PASS') checked++;
      else if (rf0 && rf0.indexOf('FAIL') === 0) failures.push(rf0);
      continue;
    }
    var r = checkClause(clause);
    if (r === 'PASS') checked++;
    else if (r && r.indexOf('FAIL') === 0) failures.push(r);
  }
  return { status: failures.length ? 'FAIL' : (checked > 0 ? 'PASS' : 'UNVERIFIED'), checked: checked, failures: failures };
}

/**
 * 整题审计：题干（含空位代入）+ 解析。
 * @param {Object} sq SemanticQuestion（prompt / answer.value / answer.explanation）
 */
function auditQuestion(sq) {
  var av = sq && sq.answer ? sq.answer.value : null;
  // P42-1C 面审计补：judge 题干等式是「被判断对象」而非真值声明（如「10 + 9 = 20（对还是错？）」
  // 答案为错——等式为假恰是教学意图），按断言校验必产伪 FAIL → 题干跳过，记 UNVERIFIED。
  // 「题干断言真假 ↔ answer 布尔一致性」属新语义校验，留待后续批次，不在本验证器最小集内。
  var p = (sq && sq.questionType === 'judge')
    ? { status: 'UNVERIFIED', checked: 0, failures: [] }
    : auditExplanation(sq && sq.prompt, av);
  var e = auditExplanation(sq && sq.answer && sq.answer.explanation, null);
  var failures = p.failures.concat(e.failures.map(function (f) { return '[解析] ' + f; }));
  var checked = p.checked + e.checked;
  return {
    status: failures.length ? 'FAIL' : (checked > 0 ? 'PASS' : 'UNVERIFIED'),
    checked: checked,
    prompt: { status: p.status, checked: p.checked },
    explanation: { status: e.status, checked: e.checked },
    failures: failures
  };
}

module.exports = {
  evalExprFull: evalExprFull,
  checkClause: checkClause,
  auditExplanation: auditExplanation,
  auditQuestion: auditQuestion,
  rEq: rEq
};
