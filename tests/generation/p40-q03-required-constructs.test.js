'use strict';

/**
 * tests/generation/p40-q03-required-constructs.test.js — P40-Q-03 requiredConstructs 接通
 *
 * 双证据验收（任务书 §1.2 Q-03）：
 *   证据 1（读信号发生）：validator Intent Alignment 第 5 维消费 intent.requiredConstructs，
 *     合成违例输入（题目运算 ∉ 构念域）→ FAIL（产出变化：越界组合被阻断）；
 *   证据 2（复现题产出变化）：R1 复现题 #8/#85/#88/#143/#161 经真实生成链重跑，
 *     choice 空壳题干 / fill 答案-题面错配全部修复。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));

const KpSem = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

// ---------- 证据 1：validator 构念闸门（合成输入，双证据之「读信号+产出变化」） ----------

function makeSqPlan(operation, requiredConstructs) {
  return {
    sq: { questionType: 'calc', data: { operation: operation } },
    plan: { semanticParams: { intent: {
      focus: 'calculation', allowedRepresentations: [], graphicRole: null,
      expressionModes: ['expression'], requiredConstructs: requiredConstructs
    } } }
  };
}

function constructsErrors(operation, rc) {
  var p = makeSqPlan(operation, rc);
  var res = KpSem.checkIntentAlignment(p.sq, p.plan);
  return (res.errors || []).filter(function (e) { return e.field === 'constructs'; });
}

test('P40-Q-03 构念闸门：op=div vs rc=[multiplication] 越界 → FAIL（读信号发生+产出变化）', () => {
  var errs = constructsErrors('div', ['multiplication']);
  assert.equal(errs.length, 1, '越界运算应产出 1 条 constructs 错误');
  assert.equal(errs[0].severity, 'ERROR');
  assert.ok(/requiredConstructs/.test(errs[0].message));
});

test('P40-Q-03 构念闸门：op=div vs rc=[division] → pass', () => {
  assert.equal(constructsErrors('div', ['division']).length, 0);
});

test('P40-Q-03 构念闸门：跨命名体系归一 op=add vs rc=[addition] → pass', () => {
  assert.equal(constructsErrors('add', ['addition']).length, 0);
  assert.equal(constructsErrors('sub', ['subtraction']).length, 0);
  assert.equal(constructsErrors('mult', ['multiplication']).length, 0);
});

test('P40-Q-03 构念闸门：rc 含 mixed（宽构念域）→ 任一四则 pass', () => {
  assert.equal(constructsErrors('add', ['mixed']).length, 0);
  assert.equal(constructsErrors('sub', ['mixed']).length, 0);
});

test('P40-Q-03 构念闸门：op=mixed 且 rc≥2 四则 → pass；rc 单四则 → FAIL', () => {
  assert.equal(constructsErrors('mixed', ['addition', 'subtraction']).length, 0);
  assert.equal(constructsErrors('mixed', ['addition']).length, 1, 'mixed 在单运算构念域内应越界');
});

test('P40-Q-03 构念闸门：skip 条件（rc 空 / 题目无 operation）', () => {
  assert.equal(constructsErrors('div', []).length, 0, 'rc 空（T2 未派生构念约束）→ skip');
  var p = makeSqPlan(null, ['multiplication']);
  p.sq.data = {};
  assert.equal(KpSem.checkIntentAlignment(p.sq, p.plan).state, 'pass', '题目无 operation → skip');
});

// ---------- 证据 2：R1 复现题回归（真实生成链，双证据之「复现题修复」） ----------

var REPRO = [
  // #8 1-5数的认识 choice：空壳「排队报数，下面哪个选项正确？」→ 具体设问
  { i: 8, kp: 'math-g1-up-u01-k001', qt: 'choice', must: /前面有 .* 人.*报/, forbid: '下面哪个选项正确' },
  // #85 数位与数级 choice：空壳「计数器拨出 66，下面哪个选项正确？」→ 位值设问
  { i: 85, kp: 'math-g4-up-u01-k002', qt: 'choice', must: /在哪一位上/, forbid: '下面哪个选项正确' },
  // #88 数位与数级 fill：问「80 + 2 = ____」答「十位」错配 → 组成求值，答 82 形态
  { i: 88, kp: 'math-g4-up-u01-k002', qt: 'fill', must: /= ____/, forbid: '十位' },
  // #143 负数的意义 choice：空壳「存折上支出 5 元记作 −5，下面哪个选项正确？」→ 读法设问
  { i: 143, kp: 'math-g6-down-u01-k001', qt: 'choice', must: /读作什么/, forbid: '下面哪个选项正确' },
  // #161 鸽巢原理 choice：空壳「正确选项是哪一个？」→ 条件完整承载
  { i: 161, kp: 'math-g6-down-u05-k001', qt: 'choice', must: /颜色相同.*正确选项是哪一个/, forbid: null }
];

REPRO.forEach(function (r) {
  test('P40-Q-03 复现题 #' + r.i + '（' + r.kp + ' ' + r.qt + '）修复回归', async () => {
    var session = new PracticeSession({
      subject: 'math', grade: Number(/^math-g(\d)-/.exec(r.kp)[1]), count: 1, difficulty: 3,
      knowledgePointId: r.kp, questionType: r.qt,
      seed: 'p40q01|' + r.kp + '|' + r.qt + '|d3|a'
    });
    await session.start();
    var sq = (session.semanticQuestions || [])[0];
    assert.ok(sq, '应产出题目');
    var prompt = String(sq.prompt || '');
    if (r.forbid) {
      assert.ok(prompt.indexOf(r.forbid) === -1,
        '#' + r.i + ' 题面不应含「' + r.forbid + '」空壳形态：' + prompt);
    }
    assert.ok(r.must.test(prompt), '#' + r.i + ' 题面应承载具体设问（' + r.must + '）：' + prompt);
  });
});
