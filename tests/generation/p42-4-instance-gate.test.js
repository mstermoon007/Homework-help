'use strict';

/**
 * tests/generation/p42-4-instance-gate.test.js — P42-4（P42-028/029）
 *
 * dev/p42/check-instance-gates.js 分类逻辑直测（CLI 之外纯函数面）：
 *   A（P42-028 实例级难度完整性）：difficulty-integrity errors → diffFail=true。
 *   B（P42-029 解析质量分级门禁）：质量分 <0.5 → fail；[0.5,0.6) → watch；≥0.6 → pass。
 *
 * 附：P42-029 登记样本回归——makeAngleFill（math-g3-up-u07-k002 fill）解析补答案后
 * 质量分须 ≥0.6（修复前判据③④双失 → 0.5）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
const Gate = require(path.join(ROOT, 'dev', 'p42', 'check-instance-gates.js'));
const QS = require(path.join(ROOT, 'shared', 'validator', 'quality-scorer.js'));

function sq(over) {
  return Object.assign({
    id: 't1', questionType: 'fill', prompt: '1 + 1 = ____',
    answer: { value: '2', explanation: '先算 1 + 1 = 2，所以答案是 2。' },
    difficulty: 3, difficultyParams: {}
  }, over);
}

test('P42-028 分类：难度结构参数漂移 → diffFail，合规参数 → 通过', () => {
  const good = Gate.classifyQuestion(sq({}));
  assert.equal(good.diffFail, false, '合规题目不得报难度完整性错误');
  const bad = Gate.classifyQuestion(sq({ difficultyParams: { maxSteps: 99 } }));
  assert.equal(bad.diffFail, true, 'maxSteps 与 difficulty(3) 标准不一致须报 error');
  assert.ok(bad.diffErrN >= 1);
});

test('P42-029 分类：质量分级（硬底线 ' + Gate.QUALITY_FLOOR + ' / watch 目标 ' + Gate.QUALITY_TARGET + '）', () => {
  assert.equal(Gate.QUALITY_FLOOR, 0.5);
  assert.equal(Gate.QUALITY_TARGET, 0.6);
  // 0 分：空解析 → fail
  assert.equal(Gate.classifyQuestion(sq({ answer: { value: '2', explanation: '' } })).qualityGate, 'fail');
  // 0.25：纯照抄题面（②复述③无步骤④不含答案）→ fail
  assert.equal(Gate.classifyQuestion(sq({
    prompt: '一个角有一个顶点和两条边',
    answer: { value: '7', explanation: '一个角有一个顶点和两条边' }
  })).qualityGate, 'fail');
  // 0.5：非空非复述，但无步骤标记且不含答案 → watch（0.6 目标以下不阻断）
  assert.equal(Gate.classifyQuestion(sq({
    answer: { value: '7', explanation: '这是关于加法运算的知识。' }
  })).qualityGate, 'watch');
  // 0.75：非复述 + 含步骤标记，不含答案 → pass
  assert.equal(Gate.classifyQuestion(sq({
    answer: { value: '2', explanation: '先看加法，再算 1 加 1。' }
  })).qualityGate, 'pass');
  // 1.0：四判据全过 → pass
  assert.equal(Gate.classifyQuestion(sq({})).qualityGate, 'pass');
});

test('P42-029 登记样本回归：角结构 fill 解析含答案，质量分 ≥0.6', async () => {
  const s = new PracticeSession({
    subject: 'math', grade: 3, count: 1, difficulty: 3,
    knowledgePointId: 'math-g3-up-u07-k002', questionType: 'fill',
    seed: 'p42|math-g3-up-u07-k002|fill|d3'
  });
  await s.start();
  const q = (s.semanticQuestions || [])[0];
  assert.ok(q, '登记样本复现产出');
  const score = QS.scoreExplanationQuality(q);
  assert.ok(score >= Gate.QUALITY_TARGET,
    '质量分 ' + score + ' 应 ≥' + Gate.QUALITY_TARGET + '；解析: ' + (q.answer && q.answer.explanation));
});
