'use strict';

/**
 * tests/generation/p42-1b-explanation-equation-truth.test.js — P42-1B
 *
 * 背景（P42-DEFECT-REGISTER §0.3，P42-003~009 复核确认）：concept-meaning.js
 * makeByItem 解析拼装把最终答案填作支撑算式右值——calc 路径固定拼
 * `expr + ' = ' + answer`（忽略算式自带正确结果 exprAns）；exprAns 尾部
 * 非纯数字（带余形「9……1」、尾部带说明文字）时解析失败并回退最终答案；
 * 支撑串无「=」时整句题干被当算式拼接（「____ 不是 2 的倍数 = 21」）。
 * 产出「先算 5 + 8 = 39」「10 ÷ 2 = 10」「如 5 × 6 = 13」等错误等式。
 *
 * 修复（concept-meaning.js makeByItem）：
 *   a. exprAns 提取扩展为「整数 | 整数……余数」，其后不紧跟运算符（未完链式交回退）；
 *   b. calc 路径当 exprAns 与最终答案不同时改拼 `expr = exprAns，所以答案是 answer`；
 *   c. expr 含空位「____」（整句题干非算式）时不拼接任何等式、不走答案回退。
 *
 * 冻结不变量：
 *   1. 真值不变量：七缺陷族（P42-003~009 对应 KP×题型）全 seed 面（d1..4 × v0..3）
 *      解析内每个可整段求值的数值等式必须成立；÷ 支持「商……余数」记法；
 *      链式等式逐段求值；不可求值记 UNVERIFIED 跳过；空位后不得拼接「= 数值」。
 *   2. 登记样本回归：七个 p42 登记种子经 PracticeSession 复现，
 *      错误等式不再出现，正确中间结果与最终答案同在解析中。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));

/* ---------------- 数值等式真值检查器 ---------------- */

// 整数四则精确求值（先 ×÷ 后 +−，左结合）。
// 返回：数值 | { frac:true, n, d }（末步非整除，仅用于与余数记法对照）| null（UNVERIFIED）
function evalExpr(s) {
  const stripped = String(s).replace(/\s+/g, '');
  if (!/^[0-9]+(?:[+−\-×÷][0-9]+)*$/.test(stripped)) return null;
  const toks = stripped.match(/[0-9]+|[+−\-×÷]/g);
  const mid = [Number(toks[0])];
  for (let i = 1; i < toks.length; i += 2) {
    const op = toks[i], b = Number(toks[i + 1]);
    if (op === '×') mid[mid.length - 1] = mid[mid.length - 1] * b;
    else if (op === '÷') {
      const a = mid[mid.length - 1];
      if (b === 0) return null;
      if (a % b !== 0) return { frac: true, n: a, d: b };
      mid[mid.length - 1] = a / b;
    } else mid.push(op, b);
  }
  let acc = mid[0];
  for (let i = 1; i < mid.length; i += 2) acc = mid[i] === '+' ? acc + mid[i + 1] : acc - mid[i + 1];
  return acc;
}

// 从片段尾部提取数值表达式（容忍前导说明文字：「先算 5 + 8」「如 19 ÷ 2」「第一步 15 + 18」）
function tailExpr(seg) {
  const m = /([0-9]+(?:\s*[+−\-×÷]\s*[0-9]+)*)\s*$/.exec(String(seg));
  return m ? m[1] : null;
}

// 单个子句（不含 ，。；：分隔符）内的等式链校验；返回 null（无断言/UNVERIFIED）或 'PASS' / 'FAIL:…'
function checkClause(clause) {
  const segs = String(clause).split('=');
  if (segs.length < 2) return null;
  for (let i = 0; i < segs.length - 1; i++) {
    const lhsSeg = segs[i], rhsSeg = segs[i + 1];
    const lhsStr = tailExpr(lhsSeg);
    if (!lhsStr) continue;
    const lhsVal = evalExpr(lhsStr);
    if (lhsVal == null) continue; // UNVERIFIED
    // 右值形态一：「商……余数」（仅允许紧跟单步整除意图的除法）
    const rm = /([0-9]+)……([0-9]+)\s*$/.exec(rhsSeg);
    if (rm) {
      const divM = /^([0-9]+)[÷]([0-9]+)$/.exec(lhsStr.replace(/\s+/g, ''));
      if (!divM) return null; // 余数记法配多步除法：UNVERIFIED
      const a = Number(divM[1]), b = Number(divM[2]), q = Number(rm[1]), r = Number(rm[2]);
      if (!(a === b * q + r && r >= 0 && r < b)) {
        return 'FAIL: ' + lhsStr + ' ≠ ' + q + '……' + r + ' (clause: ' + clause + ')';
      }
      continue;
    }
    // 右值形态二：整数
    const vm = /[0-9]+\s*$/.exec(rhsSeg);
    if (!vm) continue;
    const rhsVal = evalExpr(vm[0]);
    if (rhsVal == null) continue; // 负数等 UNVERIFIED
    if (typeof lhsVal !== 'number') {
      return 'FAIL: 非整除结果 ' + lhsStr + ' 不得等于整数 ' + vm[0] + ' (clause: ' + clause + ')';
    }
    if (lhsVal !== rhsVal) {
      return 'FAIL: ' + lhsStr + ' = ' + vm[0] + ' 不成立(实为 ' + lhsVal + ') (clause: ' + clause + ')';
    }
  }
  return 'PASS';
}

// 解析全文等式真值；返回 { checked, failures[] }
function auditExplanation(explanation) {
  const clauses = String(explanation).split(/[，。；：！？\n]/);
  const failures = [];
  let checked = 0;
  for (const c of clauses) {
    const r = checkClause(c);
    if (r === 'PASS') checked++;
    else if (r && r.indexOf('FAIL') === 0) failures.push(r);
  }
  return { checked, failures };
}

/* ---------------- 生成骨架 ---------------- */

const FAMILIES = [
  ['math-g3-up-u02-k003', 'calc', 'P42-003 括号运算'],
  ['math-g3-up-u02-k004', 'calc', 'P42-004 脱式计算'],
  ['math-g5-down-u02-k002', 'calc', 'P42-005 倍数'],
  ['math-g5-down-u02-k004', 'calc', 'P42-006 奇偶'],
  ['math-g5-down-u02-k004', 'fill', 'P42-007 倍数填空'],
  ['math-g5-down-u02-k005', 'calc', 'P42-008 质数'],
  ['math-g5-down-u02-k005', 'fill', 'P42-009 质数填空'],
  // P42-4（P42-031）：句子型支撑串（教学指令句）——1B 空位守卫的同根因姊妹形态
  ['math-g5-down-u02-k003', 'calc', 'P42-031 倍数特征句子支撑'],
  ['math-g5-down-u02-k003', 'fill', 'P42-031 倍数特征句子支撑填空'],
  ['math-g5-down-u02-k003', 'apply', 'P42-031 倍数特征句子支撑应用'],
];

function genRow(kp, qt, d, v) {
  const plan = SP.attachToPlan({
    knowledgePointIds: [kp], questionTypeId: qt, difficulty: d, count: 1,
    seed: 'p42-1b|' + kp + '|' + qt + '|d' + d + '|v' + v
  });
  const sel = Selector.selectGenerator({ knowledgePointIds: [kp], questionTypeId: qt, difficulty: d, count: 1 });
  assert.equal(sel.generatorId, 'generator:concept-meaning', kp + '|' + qt + ' 路由');
  const gen = Generators.get(sel.generatorId);
  const qs = gen.generate(plan, {});
  assert.equal(qs.length, 1, kp + '|' + qt + '|d' + d + '|v' + v + ' 产出 1 题');
  return qs[0];
}

/* ---------------- 1. 真值不变量（全 seed 面） ---------------- */

test('P42-003~009 七缺陷族全 seed 面：解析内数值等式全部成立、空位不被拼成等式', () => {
  const failures = [];
  let checkedTotal = 0;
  FAMILIES.forEach(([kp, qt, label]) => {
    for (let d = 1; d <= 4; d++) {
      for (let v = 0; v < 4; v++) {
        const q = genRow(kp, qt, d, v);
        const expl = q.answer && q.answer.explanation != null ? String(q.answer.explanation) : '';
        // 空位（整句题干）不得被拼接成「____ …… = 数值」假等式（P42-1B 发现的同根因变体）
        if (/____[^=，。]*=/.test(expl)) {
          failures.push(kp + '|' + qt + '|d' + d + '|v' + v + ': 空位被拼接为等式: ' + expl.slice(0, 80));
        }
        const r = auditExplanation(expl);
        checkedTotal += r.checked;
        r.failures.forEach((f) => failures.push(kp + '|' + qt + '|d' + d + '|v' + v + ': ' + f));
      }
    }
  });
  assert.deepEqual(failures, [], '解析等式真值失败:\n' + failures.join('\n'));
  assert.ok(checkedTotal >= 7, '真值检查须实际覆盖到等式（checked=' + checkedTotal + '）');
});

/* ---------------- 2. 登记样本回归（p42 精确种子，PracticeSession 全链） ---------------- */

const REGISTER_SAMPLES = [
  ['P42-003', 'math-g3-up-u02-k003', 'calc', '先算 5 + 8 = 13，所以答案是 39'],
  ['P42-004', 'math-g3-up-u02-k004', 'calc', '第一步 15 + 18 = 33，所以答案是 28'],
  ['P42-005', 'math-g5-down-u02-k002', 'calc', '9 × 2 = 18，所以答案是 9'],
  ['P42-006', 'math-g5-down-u02-k004', 'calc', '如 19 ÷ 2 = 9……1，所以答案是 19'],
  ['P42-007', 'math-g5-down-u02-k004', 'fill', '10 ÷ 2 = 5，所以答案是 10'],
  ['P42-008', 'math-g5-down-u02-k005', 'calc', '如 5 × 6 = 30，所以答案是 13'],
  ['P42-009', 'math-g5-down-u02-k005', 'fill', '如 5 × 6 = 30，所以答案是 19'],
];

test('P42-003~009 登记样本回归：错误等式消除，正确中间结果+最终答案同在', async () => {
  for (const [id, kp, qt, expect] of REGISTER_SAMPLES) {
    const grade = Number(/^math-g(\d+)/.exec(kp)[1]);
    const s = new PracticeSession({
      subject: 'math', grade, count: 1, difficulty: 3,
      knowledgePointId: kp, questionType: qt, seed: 'p42|' + kp + '|' + qt + '|d3'
    });
    await s.start();
    const q = (s.semanticQuestions || [])[0];
    assert.ok(q, id + ' 复现产出');
    const expl = String(q.answer.explanation);
    assert.ok(expl.indexOf(expect) !== -1, id + ' 解析应含「' + expect + '」，实得: ' + expl);
    const r = auditExplanation(expl);
    assert.deepEqual(r.failures, [], id + ' 解析等式真值: ' + r.failures.join('; '));
  }
});

/* ---------------- 3. P42-031 句子型支撑串回归（p42 精确种子，PracticeSession 全链） ---------------- */

// 登记缺陷（register P42-031）：支撑串「仿照 7 ÷ 2 的做法，把每个选项除以 2，
// 看余数是不是 0」是教学指令句（仅内嵌示例算式），1B 前被整体当算式拼接出
// 「…看余数是不是 0 = 28」假等式。修复后句子型支撑串整体退化为「答案是 X」。
const P42_031_SAMPLES = [
  ['math-g5-down-u02-k003', 'calc', '答案是 28'],
  ['math-g5-down-u02-k003', 'fill', '答案是 27'],
  ['math-g5-down-u02-k003', 'apply', '答：48'],
];

test('P42-031 登记样本回归：句子支撑串不再拼出「非算式句 + = 数字」假等式', async () => {
  for (const [kp, qt, expect] of P42_031_SAMPLES) {
    const s = new PracticeSession({
      subject: 'math', grade: 5, count: 1, difficulty: 3,
      knowledgePointId: kp, questionType: qt, seed: 'p42|' + kp + '|' + qt + '|d3'
    });
    await s.start();
    const q = (s.semanticQuestions || [])[0];
    assert.ok(q, kp + '|' + qt + ' 复现产出');
    const expl = String(q.answer.explanation);
    assert.ok(expl.indexOf(expect) !== -1, kp + '|' + qt + ' 解析应含「' + expect + '」，实得: ' + expl);
    assert.doesNotMatch(expl, /是不是 0\s*=/, kp + '|' + qt + ' 句子支撑串被拼接为假等式: ' + expl);
    const r = auditExplanation(expl);
    assert.deepEqual(r.failures, [], kp + '|' + qt + ' 解析等式真值: ' + r.failures.join('; '));
  }
});
