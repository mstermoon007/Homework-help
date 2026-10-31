'use strict';

// P42-024（2026-10-31 用户裁决：标 read-aloud，保留题）
// 开放式 Apply 答案（「举例合理即可」/「方案不唯一」/估测口述）不输出无判据的书面输入框。
// 覆盖：生成侧 answerMode 读信号 + 渲染侧消费（read-aloud 不生成 <input>）+ 旁证题不被连带改动。

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
const HTMLRenderer = require(path.join(ROOT, 'shared', 'presentation', 'html-renderer.js'));

function gradeOf(kp) {
  return Number(kp.split('-')[1].replace('g', ''));
}

async function generate(kp, count) {
  const session = new PracticeSession({
    subject: 'math', grade: gradeOf(kp), count: count || 1,
    knowledgePointId: kp, questionType: 'apply', seed: 'p42-024|' + kp
  });
  await session.start();
  return session.semanticQuestions || [];
}

// P42-2B 分类器在 1570 面的 placeholder 7 行（rowId = kp|apply）
const OPEN_ROWS = [
  'math-g1-down-u01-k001',
  'math-g2-up-u06-k001',
  'math-g3-up-u06-k005',
  'math-g4-down-u02-k002',
  'math-g4-up-u02-k001',
  'math-g4-up-u02-k003',
  'math-g6-up-u04-k001'
];

test('P42-024：7 例开放式 apply 全部标 answerMode=read-aloud', async () => {
  for (const kp of OPEN_ROWS) {
    const qs = await generate(kp, 1);
    assert.strictEqual(qs.length, 1, kp + ' 应生成 1 题');
    assert.strictEqual(qs[0].answerMode, 'read-aloud', kp + ' 应为 read-aloud');
  }
});

test('P42-024：read-aloud 被渲染层消费——屏幕态不再输出作答输入框', async () => {
  const q = (await generate(OPEN_ROWS[0], 1))[0];
  const html = HTMLRenderer.render(q, 0, { mode: 'screen' });
  assert.ok(!/<input/.test(html), 'read-aloud 题不应渲染 <input>');
  assert.ok(!/answer-inp/.test(html), 'read-aloud 题不应渲染 .answer-inp');
});

test('P42-024：旁证——同生成器的可判分 apply 题保持 input 并仍渲染输入框', async () => {
  const qs = await generate('math-g1-down-u02-k001', 1); // 数值答案 apply
  assert.strictEqual(qs[0].answerMode, 'input');
  assert.ok(/<input/.test(HTMLRenderer.render(qs[0], 0, { mode: 'screen' })), 'input 题应保留输入框');
});
