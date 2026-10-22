'use strict';

/**
 * tests/generation/p42-1c-truth-verifier.test.js — P42-1C
 *
 * 独立数学真值验证器（dev/p42/truth-verifier.js）：
 *   Part 1 单元——五类记法（P42-DEFECT-REGISTER §0.4 最小集）必须正确判定，
 *   不可解析/代数式/未完链式必须 UNVERIFIED（null），不得复刻同类误报。
 *   Part 2 登记 18 例——P42-0 审计的 18 个样本（7 例 P42-1B 已修复 + 11 例原误报）
 *   经 PracticeSession 确定性复现后，验证器逐例判定：17 例 PASS；
 *   P42-013 于 P42-4/P42-031 纯算式形态守卫后诚实退化为 UNVERIFIED（非 FAIL）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const V = require(path.join(ROOT, 'dev', 'p42', 'truth-verifier.js'));

/* ---------------- Part 1: 五类记法单元 ---------------- */

test('① 带余除法「商……余数」：整除意图正确判定，多步左值 UNVERIFIED', () => {
  assert.equal(V.checkClause('20 ÷ 3 = 6……2'), 'PASS');
  assert.equal(V.checkClause('19 ÷ 6 = 3……1'), 'PASS');
  assert.equal(V.checkClause('空格里填 20：20 ÷ 3 = 6……2，等式成立'.split('：')[1]), 'PASS');
  assert.ok(V.checkClause('20 ÷ 3 = 6……1').indexOf('FAIL') === 0, '余数错误必须 FAIL');
  assert.ok(V.checkClause('20 ÷ 3 = 7……2').indexOf('FAIL') === 0, '商错误必须 FAIL');
  assert.equal(V.checkClause('15 + 18 − 5 = 33 − 5……2'), null, '多步左值配余数记法 → UNVERIFIED');
});

test('② 分数 a/b：等值判定（分子截断误报不再复现）', () => {
  assert.equal(V.checkClause('1/3 = 5/15'), 'PASS');
  assert.equal(V.checkClause('1/5 = 2/10'), 'PASS');
  assert.equal(V.checkClause('1/6 = 3/18'), 'PASS');
  assert.equal(V.checkClause('3/6 × 2 = 6/6'), 'PASS');
  assert.ok(V.checkClause('1/3 = 5/14').indexOf('FAIL') === 0, '分数不等值必须 FAIL');
});

test('③ 链式/多步：逐段取相邻对，代数段 UNVERIFIED，不跨段子串匹配', () => {
  // P42-013 形态：3a + 1 = 3 × 5 + 1 = 16 —— 3a 段 UNVERIFIED，纯数值段照常验证
  assert.equal(V.checkClause('3a + 1 = 3 × 5 + 1 = 16'), 'PASS');
  assert.ok(V.checkClause('3 × 5 + 1 = 16').indexOf('PASS') === 0);
  assert.ok(V.checkClause('5 + 1 = 16').indexOf('FAIL') === 0, '错误等式仍须 FAIL（控制组）');
  assert.ok(V.checkClause('15 + 18 − 5 = 33 − 5 = 28').indexOf('PASS') === 0, '链式两段全验');
  assert.equal(V.checkClause('当 a = 5 时'), null, '代数子句 → UNVERIFIED');
});

test('④ 百分数 xx%：与分数/小数等值判定（百分号剥离误报不再复现）', () => {
  assert.equal(V.checkClause('二成 = 2/10 = 20%'), 'PASS');
  assert.equal(V.checkClause('三成五 = 3.5/10 = 35%'), 'PASS');
  assert.equal(V.checkClause('一成 = 1/10 = 10%'), 'PASS');
  assert.ok(V.checkClause('2/10 = 30%').indexOf('FAIL') === 0, '百分数不等必须 FAIL');
});

test('⑤ 分数除法 a/b ÷ c/d：分数原子优先，不当连除链', () => {
  assert.equal(V.checkClause('3/4 ÷ 1/4 = 3'), 'PASS');
  assert.equal(V.checkClause('除数 = 被除数 ÷ 商'.split('：')[0]), null);
  assert.ok(V.checkClause('3/4 ÷ 1/4 = 4').indexOf('FAIL') === 0);
});

test('⑥ 括号/负号/未完链式边界', () => {
  assert.ok(V.checkClause('(5 + 8) × 3 = 13 × 3').indexOf('PASS') === 0);
  assert.ok(V.checkClause('15 + 18 − 5 = 28').indexOf('PASS') === 0);
  assert.equal(V.checkClause('15 + 18 − 5 = 33 −'), null, '未完链式右值 → UNVERIFIED');
  assert.equal(V.checkClause('结果 − 5'), null, '左段尾部前随运算符截出的负数 → UNVERIFIED');
  assert.equal(V.checkClause('在 19、12、15 中'), null, '无等式 → 无断言');
});

test('⑦ 空位代入一致性（题干 ↔ 答案）', () => {
  assert.equal(V.auditExplanation('填空：____ ÷ 3 = 6……2', '20').status, 'PASS');
  assert.equal(V.auditExplanation('分数的基本性质，在 ____ 里填数：1/3 = ____/15', '5').status, 'PASS');
  assert.equal(V.auditExplanation('列式：把二成改写成百分数，2 ÷ 10 = （ ）%（只填数字）。', '20').status, 'PASS');
  assert.equal(V.auditExplanation('三成五 = ____%（只填数字）', '35').status, 'UNVERIFIED', '左值为汉字成数（三成五）不可解析 → UNVERIFIED（该题由解析 3.5/10 = 35% 判定）');
  assert.equal(V.auditExplanation('3/4 ÷ ____ = 1/4', '3').status, 'PASS');
  assert.equal(V.auditExplanation('____ ÷ 3 = 6……2', '21').status, 'FAIL', '代入错误答案必须 FAIL');
  assert.equal(V.auditExplanation('____ + ____ = 10', '5').status, 'UNVERIFIED', '多空位不代入');
});

test('⑧ P42-1C 面审计增补：全角运算符/万亿单位/位值短语/比号/judge 题干/分子位空位', () => {
  // 全角运算符归一（＋－＊／）——面审计 21 条误报根因
  assert.equal(V.checkClause('3＋3＝6'), 'PASS');
  assert.equal(V.checkClause('45－30＝15'), 'PASS');
  assert.equal(V.checkClause('26＋36＋21＋12＝95'), 'PASS');
  assert.equal(V.checkClause('2＋2＝4 格'), 'PASS');
  assert.equal(V.checkClause('1254＋911＝2165 千焦'), 'PASS');
  assert.equal(V.checkClause('30－21＝9℃'), 'PASS');
  assert.ok(V.checkClause('4＋1＝6').indexOf('FAIL') === 0, '全角假等式仍须 FAIL（控制组）');
  // 万/亿计数单位精确缩放；复合数（其后有数字）不缩放
  assert.equal(V.checkClause('40000 = 4万'), 'PASS');
  assert.equal(V.checkClause('80000 = 8万'), 'PASS');
  assert.equal(V.checkClause('100000 = 12万3千'), null, '复合数「12万3千」→ UNVERIFIED');
  // 位值短语：尾注含数字 → 首原子不代表完整值
  assert.equal(V.checkClause('10 + 7 = 1 个十和 7 个一'), null);
  // 比号 ∶（比例/代数式）→ 两侧均不可判定
  assert.equal(V.checkClause('x∶2 = 6∶2'), null);
  assert.equal(V.checkClause('1∶4 = 6∶x）'), null);
  // judge 题干等式是被判断对象 → 题干跳过（UNVERIFIED），不按断言判 FAIL
  assert.equal(V.auditQuestion({
    questionType: 'judge',
    prompt: '10 + 9 = 20（对还是错？）',
    answer: { value: false, explanation: '正确结果是 19，不是 20，题中说法错误。' }
  }).status, 'UNVERIFIED');
  assert.equal(V.auditQuestion({
    questionType: 'fill',
    prompt: '算一算：3 + 4 = ____',
    answer: { value: '7', explanation: '3 + 4 = 7，所以答案是 7。' }
  }).status, 'PASS', '非 judge 题干断言照常校验（控制组）');
  // 分子位空位：____/12 仅在答案恰为 a/12 时代入分子 a
  assert.equal(V.auditExplanation('先通分再填空：2/4 = ____/12', '6/12').status, 'PASS');
  assert.equal(V.auditExplanation('先通分再填空：2/4 = ____/12', '3/10').status, 'UNVERIFIED', '分母不吻合 → 放弃代入，不制造伪断言');
});

/* ---------------- Part 2: P42-0 登记 18 例逐例判定 ---------------- */

// [编号, kp, qt]（P42-018 归属按 §0.2 修正为 math-g6-up-u02-k001）
const REGISTER18 = [
  ['P42-001', 'math-g2-down-u02-k001', 'fill'],
  ['P42-002', 'math-g2-down-u02-k002', 'fill'],
  ['P42-003', 'math-g3-up-u02-k003', 'calc'],
  ['P42-004', 'math-g3-up-u02-k004', 'calc'],
  ['P42-005', 'math-g5-down-u02-k002', 'calc'],
  ['P42-006', 'math-g5-down-u02-k004', 'calc'],
  ['P42-007', 'math-g5-down-u02-k004', 'fill'],
  ['P42-008', 'math-g5-down-u02-k005', 'calc'],
  ['P42-009', 'math-g5-down-u02-k005', 'fill'],
  ['P42-010', 'math-g5-down-u04-k004', 'fill'],
  ['P42-011', 'math-g5-down-u04-k005', 'fill'],
  ['P42-012', 'math-g5-down-u04-k006', 'fill'],
  ['P42-013', 'math-g5-up-u05-k003', 'calc'],
  ['P42-014', 'math-g6-down-u02-k002', 'calc'],
  ['P42-015', 'math-g6-down-u02-k002', 'fill'],
  ['P42-016', 'math-g6-down-u02-k002', 'apply'],
  ['P42-017', 'math-g6-up-u03-k002', 'fill'],
  ['P42-018', 'math-g6-up-u02-k001', 'fill'],
];

test('P42-0 登记 18 例：验证器逐例判定（17 PASS + P42-013 UNVERIFIED，0 FAIL，不复活误报）', async () => {
  require(path.join(ROOT, 'dev', '_bundle-env.js'));
  const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
  // P42-013 预期调整（携复现依据重写，非删用例）——复现依据（P42-4 批次 npm test 失败原文）：
  //   AssertionError: P42-013 验证器判定须 PASS，实得 UNVERIFIED：
  //   | prompt=当 a = 5 时，3a + 1 = 3 × 5 + 1 = 多少？
  //   | expl=我们之前学过〈用字母表示数量关系〉（…）。把〈…〉和〈求含有字母的式子的值〉结合起来看：答案是 16。
  // 根因语义：P42-4/P42-031 纯算式形态守卫——句子前缀支撑串「当 a = 5 时，3 × 5 + 1」
  //   不再拼接等式，诚实退化为「答案是 16。」→ 无可验证数值等式 → UNVERIFIED。
  // 口径依据：P42-011 先例——UNVERIFIED（无可验证等式）= 诚实退化预期态，非 FAIL；
  //   真值不损（旧解析「3 × 5 + 1 = 16」本为真等式，验证器 Part 1 ③ 仍保有该判定能力）。
  // 规则依据：旧阈值断言随复现证据重写，不许只删（P42 规则第 9 条红线例外条款）。
  const EXPECTED = { 'P42-013': 'UNVERIFIED' };
  const detail = [];
  for (const [id, kp, qt] of REGISTER18) {
    const grade = Number(/^math-g(\d+)/.exec(kp)[1]);
    const s = new PracticeSession({
      subject: 'math', grade, count: 1, difficulty: 3,
      knowledgePointId: kp, questionType: qt, seed: 'p42|' + kp + '|' + qt + '|d3'
    });
    await s.start();
    const q = (s.semanticQuestions || [])[0];
    assert.ok(q, id + ' 复现产出');
    const r = V.auditQuestion(q);
    detail.push(id + ':' + r.status + '(checked=' + r.checked + ')');
    const want = EXPECTED[id] || 'PASS';
    assert.equal(r.status, want, id + ' 验证器判定须 ' + want + '，实得 ' + r.status + '：' + r.failures.join('; ')
      + ' | prompt=' + q.prompt + ' | expl=' + (q.answer && q.answer.explanation));
    // 硬底线：任何登记例不得 FAIL（真缺陷回归或误报复活都撞这条）
    assert.ok(r.status !== 'FAIL', id + ' 不得 FAIL：' + r.failures.join('; '));
  }
  console.log('  18 例判定：' + detail.join(' '));
});
