'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');

const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
const LearnerModel = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));
const PracticeResult = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));

const KP = 'math-g1-m0-make-ten';

function learnerState(kpId, overrides) {
  return { version: 1, knowledgePoints: { [kpId]: Object.assign({
    mastery: 0, confidence: 0, attempts: 0, correct: 0, accuracy: 0,
    recentAccuracy: 0, recentResults: [], errorPatterns: {}, recommendedDifficulty: 1, recommendedSpiralLevel: 1
  }, overrides || {}) } };
}

function planWith(state) {
  return Engine.plan({ knowledgePointId: KP, count: 2, difficulty: 4, learnerProfile: state });
}

test('M6-R24 L1 无 learner 数据 → 引擎沿用默认难度', () => {
  const r = planWith(learnerState(KP));
  assert.strictEqual(r.plans[0].difficulty, 4);
  assert.strictEqual(r.plans[0].learner.mode, 'new');
  assert.strictEqual(r.plans[0].learner.adjustment, 0);
});

test('M6-R24 L2 低掌握 → 引擎给出更低难度', () => {
  const r = planWith(learnerState(KP, { mastery: 0.1, confidence: 0.7, recentAccuracy: 0.1, attempts: 30, correct: 3, recentResults: [0, 0, 0, 0, 0] }));
  assert.ok(r.plans[0].difficulty < 4, '低掌握应降低难度, got ' + r.plans[0].difficulty);
  assert.strictEqual(r.plans[0].learner.adjustment, -1);
});

test('M6-R24 L3 高掌握 → 引擎给出更高难度与更高螺旋', () => {
  const low = planWith(learnerState(KP, { mastery: 0.1, confidence: 0.7, recentAccuracy: 0.1, attempts: 30, correct: 3, recentResults: [0, 0, 0, 0, 0] }));
  const high = planWith(learnerState(KP, { mastery: 0.9, confidence: 0.8, recentAccuracy: 0.95, attempts: 30, correct: 28, recentResults: [1, 1, 1, 1, 1] }));
  assert.ok(high.plans[0].difficulty >= high.plans[0].difficulty ? high.plans[0].difficulty > low.plans[0].difficulty : true);
  assert.ok(high.plans[0].difficulty > low.plans[0].difficulty);
  assert.ok(high.plans[0].spiralLevel >= low.plans[0].spiralLevel);
});

test('M6-R24 L4 错因聚焦传递到计划（errorFocus / variant）', () => {
  const r = planWith(learnerState(KP, {
    mastery: 0.3, confidence: 0.6, recentAccuracy: 0.3, attempts: 20, correct: 6,
    recentResults: [0, 0, 0, 0, 0],
    errorPatterns: { '计算错误': { errorType: '计算错误', count: 3, recentCount: 3, confidence: 0.8, lastOccurredAt: 0 } }
  }));
  assert.ok(Array.isArray(r.plans[0].errorFocus) && r.plans[0].errorFocus.includes('计算错误'));
  assert.strictEqual(r.plans[0].variant, '基础'); // 低掌握+错因 → 基础变体
});

test('M6-R25 跨会话连续性：两次独立练习累积 → 难度随掌握度演进', () => {
  // 会话 1：全对
  let state = learnerState(KP);
  for (let i = 0; i < 10; i++) {
    state = LearnerModel.update(state, PracticeResult.create({ questionId: 'q' + i, knowledgePointId: KP, correct: true, timestamp: i }), { now: i });
  }
  // 会话 2：新 plan 读到会话 1 学到的掌握度
  const p1 = planWith(state);
  const m1 = p1.plans[0].learner.mastery;
  // 会话 2：连错 5 次
  for (let i = 10; i < 15; i++) {
    state = LearnerModel.update(state, PracticeResult.create({ questionId: 'q' + i, knowledgePointId: KP, correct: false, timestamp: i }), { now: i });
  }
  const p2 = planWith(state);
  assert.ok(p2.plans[0].learner.mastery < p1.plans[0].learner.mastery, '连错后 mastery 应下降');
  assert.ok(p2.plans[0].difficulty <= p1.plans[0].difficulty, '掌握度下降后难度不应上升');
});

test('M6-R26 容错：脏 learnerProfile 传递到引擎不崩溃且可运行', () => {
  const dirty = learnerState(KP, { mastery: -9, confidence: 99, recentAccuracy: NaN, attempts: 'x', correct: -3, recentResults: ['bad', 1], errorPatterns: { '未知': { count: 1 } } });
  const r = planWith(dirty); // 内部 normalizeLearnerState 自愈
  assert.ok(r.plans[0].difficulty >= 1 && r.plans[0].difficulty <= 10);
  const lm = r.plans[0].learner;
  assert.ok(lm.mastery >= 0 && lm.mastery <= 1);
  assert.ok(lm.confidence >= 0 && lm.confidence <= 1);
});