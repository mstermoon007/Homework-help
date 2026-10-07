'use strict';

// P31-FIX-02：重做轮回车批改断链回归
//
// 断链（HEAD 既存，P31-06 登记）：页面重做只复位页面状态，PracticeSession 停于 CHECKED，
// 重做轮 PracticeBridge.submit() → session.submit() 被状态守卫以「当前状态不允许提交」拒绝。
// 修复：bridge 新增 redoWrong() 透传生成层既有 redoWrong()（复位状态机 + 切换错题子集），
// 页面重做时同步调用。本文件以 Node 可跑状态机断言覆盖该链（session.redoWrong 此前
// 零测试覆盖；_collectAnswers/_renderSet 的 DOM 依赖以最小 stub 满足，node --test
// 每文件独立进程，不污染其他用例）。

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// 最小 document stub（session._collectAnswers/_renderSet 的页面依赖）
global.document = {
  getElementById: () => null,
  querySelectorAll: () => []
};

const ROOT = path.resolve(__dirname, '..', '..');
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
const bridge = require(path.join(ROOT, 'shared', 'bridge', 'practice-bridge.js'));

// 三题 legacy 题集（第 2 题错）
function makeQuestions() {
  return [
    { questionType: 'calc', prompt: '2+3=', answer: '5' },
    { questionType: 'calc', prompt: '3+4=', answer: '7' },
    { questionType: 'calc', prompt: '1+2=', answer: '3' }
  ];
}

function makeCheckedSession() {
  const s = new PracticeSession({ subject: 'math', grade: 1, count: 3, difficulty: 1 });
  s.exerciseSet = { questions: makeQuestions(), meta: { title: 't' } };
  s.checkResult = {
    score: 2, total: 3, correct: 2,
    results: [true, false, true],
    correctAnswers: ['5', '7', '3']
  };
  s.state = 'checked'; // STATE.CHECKED
  s.lastSemantic = { generationId: 'g1', questions: makeQuestions() };
  return s;
}

test('P31-FIX-02 复现：CHECKED 状态直接 submit 被状态守卫拒绝（HEAD 既存断链）', async () => {
  const s = makeCheckedSession();
  await assert.rejects(() => s.submit(), /当前状态不允许提交/);
});

test('P31-FIX-02：redoWrong 复位状态机并切换错题子集（含 lastSemantic 清空）', async () => {
  const s = makeCheckedSession();
  const r = await s.redoWrong();
  assert.strictEqual(r.questions.length, 1);
  assert.strictEqual(r.questions[0].prompt, '3+4=');
  assert.strictEqual(s.state, 'answering');
  assert.strictEqual(s.checkResult, null);
  assert.strictEqual(s.lastSemantic, null, '重做轮须清除上一代语义题（P3-R04 同语义）');
  assert.strictEqual(s.exerciseSet.questions.length, 1);
});

test('P31-FIX-02：redoWrong 后 submit 恢复批改资格（断链修复的核心闭环）', async () => {
  const s = makeCheckedSession();
  await s.redoWrong();
  const result = await s.submit();
  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.results.length, 1);
  assert.strictEqual(s.state, 'checked');
});

test('P31-FIX-02：无错题（全对）时 redoWrong 拒绝', async () => {
  const s = makeCheckedSession();
  s.checkResult.results = [true, true, true];
  await assert.rejects(() => s.redoWrong(), /无错题/);
});

test('P31-FIX-02：bridge.redoWrong 透传当前会话（UI 只与 bridge 交互）', async () => {
  const s = bridge.newSession({ subject: 'math', grade: 1, count: 3, difficulty: 1 });
  assert.ok(s, 'bridge.newSession 应返回会话句柄');
  s.exerciseSet = { questions: makeQuestions(), meta: { title: 't' } };
  s.checkResult = { score: 2, total: 3, correct: 2, results: [true, false, true], correctAnswers: ['5', '7', '3'] };
  s.state = 'checked';
  const r = await bridge.redoWrong();
  assert.strictEqual(r.questions.length, 1);
  assert.strictEqual(s.state, 'answering');
});
