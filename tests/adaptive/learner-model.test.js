'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');

const ErrorModel = require(path.join(ROOT, 'shared', 'learner', 'error-model.js'));
const PracticeResult = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));
const LearnerModel = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));

function res(correct, kpId, extra) {
  return PracticeResult.create(Object.assign({
    questionId: 'q1',
    knowledgePointId: kpId || 'KP-加法',
    correct: correct,
    userAnswer: 'x',
    correctAnswer: 'y',
    questionDifficulty: 3,
    questionType: 'calc',
    timestamp: Date.now()
  }, extra || {}));
}

test('M6-R02 初始状态：mastery 默认 0，attempts 0', () => {
  const s = LearnerModel.getState(null, 'KP-加法');
  assert.strictEqual(s.mastery, 0);
  assert.strictEqual(s.attempts, 0);
  assert.strictEqual(s.confidence, 0);
  assert.strictEqual(s.recentResults.length, 0);
});

test('M6-R23a 正确回答 → mastery 上升（EMA α=0.3：0→0.3）', () => {
  let s = LearnerModel.update(null, res(true), { now: 1000 });
  const kp = s.knowledgePoints['KP-加法'];
  assert.strictEqual(kp.mastery, 0.3);
  assert.strictEqual(kp.attempts, 1);
  assert.strictEqual(kp.correct, 1);
});

test('M6-R23b 错误回答 → mastery 下降（0.3 → 0.21）', () => {
  let s = LearnerModel.update(null, res(true), { now: 1000 });
  s = LearnerModel.update(s, res(false), { now: 2000 });
  assert.strictEqual(s.knowledgePoints['KP-加法'].mastery, 0.21);
});

test('M6-R23c 连续正确 → mastery 逐步上升', () => {
  let s = null;
  [0.3, 0.51, 0.657].forEach((m, i) => {
    s = LearnerModel.update(s, res(true), { now: i + 1 });
    assert.strictEqual(s.knowledgePoints['KP-加法'].mastery, m);
  });
});

test('M6-R23d 连续错误 → mastery 逐步下降', () => {
  let s = LearnerModel.update(null, res(true), { now: 1 });
  const seq = [0.21, 0.147, 0.103];
  seq.forEach((m, i) => {
    s = LearnerModel.update(s, res(false), { now: i + 2 });
    assert.strictEqual(s.knowledgePoints['KP-加法'].mastery, m);
  });
});

test('M6-R23e 低样本：1 次正确 ≠ 完全掌握（mastery=0.3，confidence<0.5）', () => {
  let s = LearnerModel.update(null, res(true), { now: 1 });
  const kp = s.knowledgePoints['KP-加法'];
  assert.ok(kp.mastery < 1, 'mastery 不能一次拉满');
  assert.ok(kp.confidence < 0.5, '低样本置信度必须低');
  assert.strictEqual(kp.confidence, 0.415);
});

test('M6-R08 置信度随样本量与一致性增长（分离于 mastery）', () => {
  let s = null;
  // 高一致性：连续作答
  for (let i = 0; i < 30; i++) s = LearnerModel.update(s, res(i % 10 === 0 ? false : true), { now: i + 1 });
  const good = s.knowledgePoints['KP-加法'];
  assert.ok(good.confidence > 0.5, '高样本高一致性置信度高，got ' + good.confidence);

  // 低一致性对照：对半正确/错误 20 次 → 置信度显著低于前者
  let s2 = null;
  for (let i = 0; i < 20; i++) s2 = LearnerModel.update(s2, res(i % 2 === 0), { now: i + 1 });
  const vol = s2.knowledgePoints['KP-加法'];
  assert.ok(vol.confidence > 0, '有样本置信度>0');
  assert.ok(vol.confidence < good.confidence, '波动数据置信度应更低');
});

test('M6-R06 accuracy 与 recentAccuracy', () => {
  let s = null;
  const seq = [true, true, false, true, true];
  seq.forEach((c, i) => { s = LearnerModel.update(s, res(c), { now: i + 1 }); });
  const kp = s.knowledgePoints['KP-加法'];
  assert.strictEqual(kp.accuracy, 0.8);
  assert.ok(Math.abs(kp.recentAccuracy - 0.8) < 0.001);
});

test('M6-R09/R10 错因：只记录可靠错因，未知不伪造', () => {
  assert.strictEqual(ErrorModel.normalizeErrorType(null), null);
  assert.strictEqual(ErrorModel.normalizeErrorType('unknown-weird'), null);
  assert.strictEqual(ErrorModel.normalizeErrorType('计算错误'), '计算错误');
  assert.strictEqual(ErrorModel.normalizeErrorType('other'), 'other');

  let s = LearnerModel.update(null, res(false, 'KP-乘法', { errorType: '口诀混淆' }), { now: 1 });
  s = LearnerModel.update(s, res(true), { now: 2 });
  const kp = s.knowledgePoints['KP-乘法'];
  assert.ok(kp.errorPatterns['口诀混淆'], '应记录可靠错因');
  assert.strictEqual(kp.errorPatterns['口诀混淆'].count, 1);
  // 无错因的题目不会凭空产生错误类型
  assert.strictEqual(Object.keys(kp.errorPatterns).length, 1);

  // resolveErrorType 对无来源返回 null
  assert.strictEqual(ErrorModel.resolveErrorType({ correct: false }), null);
  assert.strictEqual(ErrorModel.resolveErrorType(null), null);
});

test('M6-R11 getErrors 排序：近期反复出现的错因优先', () => {
  let s = null;
  [false, false, false, true].forEach((c, i) => {
    s = LearnerModel.update(s, res(c, 'KP-乘法', { errorType: '口诀混淆' }), { now: i + 1 });
  });
  const errors = LearnerModel.getErrors(s, 'KP-乘法');
  assert.ok(errors.length >= 1);
  assert.strictEqual(errors[0].errorType, '口诀混淆');
});

test('M6-R26 normalizeLearnerState 容错', () => {
  const bad = {
    version: 0,
    updatedAt: null,
    knowledgePoints: {
      'KP-标准': { mastery: -5, confidence: 9, attempts: 3, correct: 9, accuracy: NaN, recentResults: ['x', 1], errorPatterns: { '未知类型': { count: 2 }, '计算错误': 'bad' } },
      'KP-小数': { mastery: 0.6, attempts: 1, correct: 1 }
    }
  };
  const norm = LearnerModel.normalizeLearnerState(bad);
  assert.strictEqual(norm.knowledgePoints['KP-标准'].mastery, 0);
  assert.strictEqual(norm.knowledgePoints['KP-标准'].confidence, 1);
  assert.strictEqual(norm.knowledgePoints['KP-标准'].correct, 3, 'correct 不得超过 attempts');
  assert.deepEqual(norm.knowledgePoints['KP-标准'].recentResults, [0, 1]);
  assert.ok(!norm.knowledgePoints['KP-标准'].errorPatterns['未知类型'], '非法错因需丢弃');
  assert.strictEqual(norm.knowledgePoints['KP-小数'].mastery, 0.6);
  // 完全损坏 → 默认
  const empty = LearnerModel.normalizeLearnerState({ knowledgePoints: null });
  assert.deepEqual(empty.knowledgePoints, {});
  // 扁平旧格式包装
  const flat = LearnerModel.normalizeLearnerState({ kpId: 'KP-A', mastery: 0.5, attempts: 2 });
  assert.strictEqual(flat.knowledgePoints['KP-A'].mastery, 0.5);
});

test('M6-R16 高掌握 → spiral 提升', () => {
  const low = LearnerModel.normalizeKpState({ masterKp: true, attempts: 50, correct: 50, mastery: 0.2, confidence: 0.7, recentResults: [0, 0, 0, 0, 0] }, 'KP');
  const high = LearnerModel.normalizeKpState({ attempts: 50, correct: 50, mastery: 0.9, confidence: 0.8, recentResults: [1, 1, 1, 1, 1] }, 'KP');

  // 通过 recommendDefaults 对比螺旋推荐
  const recLow = LearnerModel.recommendDefaults(low);
  const recHigh = LearnerModel.recommendDefaults(high);
  assert.ok(recHigh.recommendedSpiralLevel > recLow.recommendedSpiralLevel,
    `高掌握 spiral(${recHigh.recommendedSpiralLevel}) 应高于低掌握(${recLow.recommendedSpiralLevel})`);
  assert.ok(recHigh.recommendedDifficulty > recLow.recommendedDifficulty,
    `高掌握难度(${recHigh.recommendedDifficulty}) 应高于低掌握(${recLow.recommendedDifficulty})`);
});

test('M6-R05 未作答/重做/跳过 不产生错误错因且不计入掌握度（跳过）', () => {
  // 跳过：仅曝光，mastery 不变
  let s = LearnerModel.update(null, res(false, 'KP-跳过', { status: 'skipped' }), { now: 1 });
  let kp = s.knowledgePoints['KP-跳过'];
  assert.strictEqual(kp.mastery, 0);
  assert.strictEqual(kp.attempts, 0);
  assert.strictEqual(kp.exposureCount, 1);

  // 重做：attempts 增加但正确数不重复累计超过 attempts
  s = LearnerModel.update(null, res(true), { now: 1 });
  s = LearnerModel.update(s, res(true, 'KP-加法', { status: 'redo' }), { now: 2 });
  kp = s.knowledgePoints['KP-加法'];
  assert.strictEqual(kp.correct, 1);
});