'use strict';

/**
 * tests/generation/p45-10-a-item.test.js — P45-10（§4.4-A 解冻：X3 / X4 / X9 / C6）
 *
 * 用户 2026-11-02 裁决口径：
 *   X3：4 项为常态 + 天然三元域保留 3 项，禁用「以上说法都不对 / 都不对（N）」凑位；
 *   X4：跨 KP 解析桥接模板仅作空解析兜底，已有本题解析不再前置；
 *   X9：calc 题面去「参考：」脚手架、重复「列式」改「算式」、judge 去「（标出 Ncm）」；
 *   C6：倒数 KP math-g6-up-u03-k001 纳入 P45-03 分数既约回归。
 *
 * 断言以学生可见产出为准（PracticeSession，seed 与冻结矩阵同源）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

function gradeOf(kp) { return Number(/^math-g(\d)-/.exec(kp)[1]); }

async function gen(kp, qt) {
  const session = new PracticeSession({
    subject: 'math', grade: gradeOf(kp), count: 1, difficulty: 3,
    knowledgePointId: kp, questionType: qt,
    seed: 'freeze:p28-v1|' + kp + '|' + qt + '|d3'
  });
  await session.start();
  return (session.semanticQuestions || [])[0];
}

const META_FILLERS = /以上说法都不对|以上都对|都不对（\d）/;

/* ---------------- X3：干扰项派生，禁止凑位短语 ---------------- */

// 审计 35 行「含以上都不对型选项」的全部 KP
const X3_KPS = [
  'math-g1-down-u03-k001', 'math-g1-down-u03-k003', 'math-g1-down-u03-k004',
  'math-g1-down-u03-k005', 'math-g1-down-u03-k006', 'math-g1-down-u06-k002',
  'math-g1-up-u01-k001', 'math-g1-up-u02-k001', 'math-g1-up-u04-k001',
  'math-g1-up-u05-k001', 'math-g2-down-u03-k001', 'math-g2-down-u04-k001',
  'math-g2-down-u04-k003', 'math-g2-down-u04-k004', 'math-g2-down-u04-k005',
  'math-g2-down-u04-k006', 'math-g3-up-u02-k003', 'math-g3-up-u02-k004',
  'math-g4-down-u01-k002', 'math-g4-up-u01-k001', 'math-g4-up-u01-k002',
  'math-g4-up-u01-k003', 'math-g4-up-u01-k004', 'math-g4-up-u01-k005',
  'math-g4-up-u01-k006', 'math-g5-down-u02-k003', 'math-g5-down-u02-k004',
  'math-g5-down-u02-k005', 'math-g5-down-u02-k006', 'math-g5-up-u05-k002',
  'math-g5-up-u05-k003', 'math-g5-up-u05-k004', 'math-g6-down-u01-k003',
  'math-g6-down-u01-k004', 'math-g6-down-u04-k002'
];

// 天然三元域（正确项 + 2 个真实候选）：> < = / 奇数 偶数 无法确定
const NATURAL_THREE = new Set([
  'math-g1-down-u03-k006', 'math-g2-down-u04-k005', 'math-g4-up-u01-k005',
  'math-g5-down-u02-k006', 'math-g6-down-u01-k004'
]);

test('X3：35 行选项零凑位短语，选项去重且 correctIndex 正确', async () => {
  const fail = [];
  for (const kp of X3_KPS) {
    const q = await gen(kp, 'choice');
    assert.ok(q, kp + ' 应产出 choice');
    const opts = (q.data && q.data.options) || [];
    if (opts.some((o) => META_FILLERS.test(String(o)))) fail.push(kp + ' 残留凑位短语: ' + opts.join('/'));
    if (new Set(opts.map(String)).size !== opts.length) fail.push(kp + ' 选项重复: ' + opts.join('/'));
    if (q.data.correctIndex < 0 || q.data.correctIndex >= opts.length) fail.push(kp + ' correctIndex 越界');
    assert.equal(opts[q.data.correctIndex], String(q.answer.value), kp + ' correctIndex 指向正确项');
    if (NATURAL_THREE.has(kp)) {
      if (opts.length !== 3) fail.push(kp + ' 天然三元域应保留 3 项，实得 ' + opts.length);
    } else if (opts.length !== 4) {
      fail.push(kp + ' 应补足 4 项，实得 ' + opts.length + ': ' + opts.join('/'));
    }
  }
  assert.deepEqual(fail, [], 'X3 违例:\n' + fail.join('\n'));
});

test('X3：数值型正确项按形态派生干扰项（消费答案信号）', async () => {
  const q = await gen('math-g1-down-u03-k001', 'choice');
  const opts = q.data.options.map(String);
  assert.equal(q.answer.value, '30');
  assert.ok(opts.indexOf('31') !== -1, '30 应派生 31 作为干扰项: ' + opts.join('/'));
});

/* ---------------- X3：星期选项收敛为 4 ---------------- */

test('X3：折线统计图星期选项由 7 收敛为 4', async () => {
  for (const kp of ['math-g5-down-u07-k001', 'math-g5-down-u07-k002', 'math-g5-down-u07-k003']) {
    const q = await gen(kp, 'choice');
    const opts = (q.data && q.data.options) || [];
    assert.equal(opts.length, 4, kp + ' 星期选项应为 4 项: ' + opts.join('/'));
    assert.equal(opts[q.data.correctIndex], String(q.answer.value), kp + ' correctIndex 指向正确项');
  }
});

/* ---------------- X4：跨 KP 解析模板仅空解析兜底 ---------------- */

test('X4：已有本题解析不再前置跨 KP 桥接句', async () => {
  const fail = [];
  for (const kp of ['math-g1-down-u03-k004', 'math-g1-down-u03-k005', 'math-g4-up-u01-k002',
    'math-g5-up-u05-k002', 'math-g6-down-u01-k004']) {
    const q = await gen(kp, 'calc');
    const ex = String((q.answer && q.answer.explanation) || '');
    if (ex.indexOf('我们之前学过〈') !== -1) fail.push(kp + ' 仍前置桥接句: ' + ex.slice(0, 40));
    if (!ex) fail.push(kp + ' 解析为空');
  }
  assert.deepEqual(fail, [], 'X4 违例:\n' + fail.join('\n'));
});

/* ---------------- X9：语言格式残留清零 ---------------- */

test('X9：calc 题面零「（参考：…）」脚手架', async () => {
  const fail = [];
  for (const kp of ['math-g1-down-u03-k004', 'math-g1-down-u03-k005', 'math-g1-down-u03-k006',
    'math-g2-down-u04-k005', 'math-g4-up-u01-k002', 'math-g4-up-u01-k005',
    'math-g5-up-u05-k002', 'math-g6-down-u01-k004']) {
    const q = await gen(kp, 'calc');
    if (String(q.prompt).indexOf('参考：') !== -1) fail.push(kp + ' 残留参考脚手架: ' + q.prompt);
  }
  assert.deepEqual(fail, [], 'X9 参考违例:\n' + fail.join('\n'));
});

test('X9：calc 题面「列式计算」与「算式」不再重复列式', async () => {
  const fail = [];
  for (const kp of ['math-g6-down-u02-k001', 'math-g6-down-u02-k003', 'math-g6-down-u02-k005',
    'math-g6-down-u04-k004', 'math-g6-down-u04-k005', 'math-g6-down-u04-k007',
    'math-g6-down-u04-k008', 'math-g6-up-u05-k003']) {
    const q = await gen(kp, 'calc');
    const p = String(q.prompt);
    const n = (p.match(/列式/g) || []).length;
    if (n !== 1) fail.push(kp + ' 「列式」出现 ' + n + ' 次: ' + p);
    if (p.indexOf('算式：') === -1) fail.push(kp + ' 缺「算式：」: ' + p);
  }
  assert.deepEqual(fail, [], 'X9 重复列式违例:\n' + fail.join('\n'));
});

test('X9：线段图 judge 题面零「（标出 Ncm）」', async () => {
  const fail = [];
  for (const kp of ['math-g2-up-u01-k001', 'math-g2-up-u01-k002', 'math-g3-down-u05-k001']) {
    const q = await gen(kp, 'judge');
    if (/（标出 \d+cm）/.test(String(q.prompt))) fail.push(kp + ' 残留标出脚手架: ' + q.prompt);
  }
  assert.deepEqual(fail, [], 'X9 标出违例:\n' + fail.join('\n'));
});
