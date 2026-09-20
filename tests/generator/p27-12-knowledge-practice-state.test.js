'use strict';

/**
 * tests/generator/p27-12-knowledge-practice-state.test.js — P27-12 KnowledgePracticeState
 *
 * 冻结不变量（任务书 P25-12 最小掌握度闭环）：
 *   1. update 累计 questionTypeStats[qt]（attempts/correct/incorrect/recentResults/lastPracticedAt）
 *      —— 语义与 attempts/correct 同步：跳过不计；重做只更新 recentResults，不重复 first-pass。
 *   2. update 累计 semanticTargetStats[st|null]（P25 新增维度 semanticTarget 落地；
 *      无值归入 'null' 桶，绝不伪造）。
 *   3. update 错题追加 recentErrors（{questionType, semanticTarget, errorType, correct:false, timestamp}）；
 *      正确不进；redo 错题也追加（与 errorPatterns 同步）；超过 cap 20 保留末段。
 *   4. incorrect = attempts - correct（派生，不另算）。
 *   5. misconceptionStats 由 errorPatterns 经 ErrorModel.getErrorFocus 派生（只读视图，不另存 SSOT）；
 *      与 AdaptiveStrategy.errorFocusFor 同源。
 *   6. normalizeLearnerState 自愈：旧数据无新字段 → 默认空对象/数组；损坏字段 → sanitize。
 *   7. PracticeResult.fromSemanticQuestion / fromLegacy / create 携带 semanticTarget。
 *   8. 红线：mastery/confidence/recommended* 仍是唯一评分入口；新增字段不参与评分。
 *
 * 红线（任务书 P25-12）：不改 Difficulty Core；不建第二套评分系统；只提供学习状态数据。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const ErrorModel = require(path.join(ROOT, 'shared', 'learner', 'error-model.js'));
const PracticeResult = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));
const LearnerModel = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));

const KP = 'math-g3-up-u07-k001';

function makeResult(correct, extra) {
  return PracticeResult.create(Object.assign({
    questionId: 'q1',
    knowledgePointId: KP,
    correct: correct,
    questionType: 'calc',
    semanticTarget: '运算含义',
    timestamp: 1000
  }, extra || {}));
}

test('P27-12 #1 正确回答 → questionTypeStats[qt] 累计 1/1/0，recentErrors 空', () => {
  const s = LearnerModel.update(null, makeResult(true), { now: 1000 });
  const kp = s.knowledgePoints[KP];
  const qt = kp.questionTypeStats['calc'];
  assert.ok(qt, 'calc 桶应存在');
  assert.strictEqual(qt.attempts, 1);
  assert.strictEqual(qt.correct, 1);
  assert.strictEqual(qt.incorrect, 0);
  assert.deepEqual(qt.recentResults, [1]);
  assert.strictEqual(qt.lastPracticedAt, 1000);
  assert.strictEqual(kp.recentErrors.length, 0, '正确不进 recentErrors');
  assert.strictEqual(kp.incorrect, 0);
  // semanticTargetStats 同步
  const st = kp.semanticTargetStats['运算含义'];
  assert.ok(st);
  assert.strictEqual(st.attempts, 1);
  assert.strictEqual(st.correct, 1);
  assert.strictEqual(st.incorrect, 0);
});

test('P27-12 #2 错误回答 → questionTypeStats[qt] 累计 1/0/1，recentErrors 1 条带错因', () => {
  const r = makeResult(false, { errorType: '计算错误' });
  const s = LearnerModel.update(null, r, { now: 2000 });
  const kp = s.knowledgePoints[KP];
  const qt = kp.questionTypeStats['calc'];
  assert.strictEqual(qt.attempts, 1);
  assert.strictEqual(qt.correct, 0);
  assert.strictEqual(qt.incorrect, 1);
  assert.deepEqual(qt.recentResults, [0]);
  assert.strictEqual(kp.recentErrors.length, 1);
  const re = kp.recentErrors[0];
  assert.strictEqual(re.questionType, 'calc');
  assert.strictEqual(re.semanticTarget, '运算含义');
  assert.strictEqual(re.errorType, '计算错误');
  assert.strictEqual(re.correct, false);
  assert.strictEqual(re.timestamp, 2000);
  assert.strictEqual(kp.incorrect, 1);
});

test('P27-12 #3 跳过 → questionTypeStats 不动，exposureCount +1', () => {
  const skip = makeResult(false, { status: 'skipped' });
  const s = LearnerModel.update(null, skip, { now: 3000 });
  const kp = s.knowledgePoints[KP];
  assert.strictEqual(kp.exposureCount, 1);
  assert.strictEqual(kp.attempts, 0);
  assert.strictEqual(Object.keys(kp.questionTypeStats).length, 0, '跳过不计入题型分布');
  assert.strictEqual(kp.recentErrors.length, 0);
  assert.strictEqual(kp.incorrect, 0);
});

test('P27-12 #4 重做 → questionTypeStats.attempts 不重复计入 first-pass，但 recentResults 更新', () => {
  let s = LearnerModel.update(null, makeResult(false, { errorType: '计算错误' }), { now: 1000 });
  // 重做纠正：attempts 不应再 +1，但 recentResults 应 push 新结果
  const redo = makeResult(true, { status: 'redo' });
  s = LearnerModel.update(s, redo, { now: 2000 });
  const kp = s.knowledgePoints[KP];
  const qt = kp.questionTypeStats['calc'];
  assert.strictEqual(qt.attempts, 1, 'redo 不重复计入 first-pass attempts');
  assert.strictEqual(qt.correct, 0, 'redo 不改变 first-pass correct');
  assert.strictEqual(qt.incorrect, 1);
  assert.deepEqual(qt.recentResults, [0, 1], 'redo 仍 push recentResults');
  // 重做错误（redo 且 res===0）也会追加 recentErrors（与 errorPatterns 同步）
  assert.strictEqual(kp.recentErrors.length, 1, '此次 redo 是正确，不追加 recentErrors');
});

test('P27-12 #5 多题型混合 → 各桶独立', () => {
  let s = null;
  s = LearnerModel.update(s, makeResult(true, { questionType: 'calc' }), { now: 1000 });
  s = LearnerModel.update(s, makeResult(false, { questionType: 'choice', errorType: '概念混淆' }), { now: 2000 });
  s = LearnerModel.update(s, makeResult(true, { questionType: 'calc' }), { now: 3000 });
  const kp = s.knowledgePoints[KP];
  const calc = kp.questionTypeStats['calc'];
  const choice = kp.questionTypeStats['choice'];
  assert.strictEqual(calc.attempts, 2);
  assert.strictEqual(calc.correct, 2);
  assert.strictEqual(choice.attempts, 1);
  assert.strictEqual(choice.correct, 0);
  assert.strictEqual(choice.incorrect, 1);
  assert.strictEqual(kp.recentErrors.length, 1);
  assert.strictEqual(kp.recentErrors[0].questionType, 'choice');
});

test('P27-12 #6 semanticTarget=null 归入 null 桶（绝不伪造）', () => {
  const r = makeResult(true, { semanticTarget: null });
  const s = LearnerModel.update(null, r, { now: 1000 });
  const kp = s.knowledgePoints[KP];
  assert.ok(!kp.semanticTargetStats['运算含义'], '语义目标为空时不应写入具体桶');
  const n = kp.semanticTargetStats['null'];
  assert.ok(n, '应归入 null 桶');
  assert.strictEqual(n.attempts, 1);
  assert.strictEqual(n.correct, 1);
});

test('P27-12 #7 misconceptionStats 由 errorPatterns 派生（只读视图）', () => {
  let s = LearnerModel.update(null, makeResult(false, { errorType: '计算错误' }), { now: 1000 });
  s = LearnerModel.update(s, makeResult(false, { errorType: '计算错误' }), { now: 2000 });
  s = LearnerModel.update(s, makeResult(false, { errorType: '审题错误' }), { now: 3000 });
  const kp = s.knowledgePoints[KP];
  assert.ok(Array.isArray(kp.misconceptionStats), 'misconceptionStats 应为数组派生视图');
  assert.strictEqual(kp.misconceptionStats.length, 2, '应有 2 类错因');
  // 与 ErrorModel.getErrorFocus 同源：按 recentCount 降序、count 次之
  const focus = ErrorModel.getErrorFocus(kp.errorPatterns);
  assert.deepEqual(
    kp.misconceptionStats.map(function (m) { return m.errorType; }),
    focus.map(function (m) { return m.errorType; })
  );
  // 不另存 SSOT：misconceptionStats 字段不参与 update 累计
  // 验证：直接设置 misconceptionStats 后再 update，应被重新派生覆盖
  s.knowledgePoints[KP].misconceptionStats = [{ errorType: '伪造错因', count: 999 }];
  const s2 = LearnerModel.normalizeLearnerState(s);
  const ms2 = s2.knowledgePoints[KP].misconceptionStats;
  assert.ok(!ms2.find(function (m) { return m.errorType === '伪造错因'; }), '伪造数据应被派生覆盖');
});

test('P27-12 #8 normalizeLearnerState 自愈：旧数据无新字段 → 默认空对象/数组', () => {
  const legacy = {
    version: 1,
    updatedAt: 1000,
    knowledgePoints: {
      'KP-legacy': { mastery: 0.5, attempts: 3, correct: 2, recentResults: [1, 0, 1] }
    }
  };
  const norm = LearnerModel.normalizeLearnerState(legacy);
  const kp = norm.knowledgePoints['KP-legacy'];
  assert.ok(kp.questionTypeStats && typeof kp.questionTypeStats === 'object');
  assert.strictEqual(Object.keys(kp.questionTypeStats).length, 0);
  assert.ok(kp.semanticTargetStats && typeof kp.semanticTargetStats === 'object');
  assert.strictEqual(Object.keys(kp.semanticTargetStats).length, 0);
  assert.ok(Array.isArray(kp.recentErrors));
  assert.strictEqual(kp.recentErrors.length, 0);
  assert.ok(Array.isArray(kp.misconceptionStats));
  assert.strictEqual(kp.misconceptionStats.length, 0);
  assert.strictEqual(kp.incorrect, 1, '派生 incorrect = 3 - 2 = 1');
});

test('P27-12 #8b normalizeKpState 自愈：questionTypeStats 损坏字段被 sanitize', () => {
  const dirty = {
    mastery: 0.5, attempts: 2, correct: 1,
    questionTypeStats: {
      'calc': { attempts: -3, correct: 9, recentResults: ['x', 1, 0], lastPracticedAt: 'bad' },
      '': { attempts: 5 } // 空 key 应丢弃
    },
    recentErrors: [
      { questionType: 'calc', semanticTarget: 'x', errorType: '未知错因', timestamp: 1 }, // 未知错因 → null
      null, 'bad', // 损坏条目应丢弃
      { questionType: 'calc', errorType: '计算错误', timestamp: 2 }
    ]
  };
  const norm = LearnerModel.normalizeKpState(dirty, 'KP-dirty');
  assert.strictEqual(Object.keys(norm.questionTypeStats).length, 1);
  const qt = norm.questionTypeStats['calc'];
  assert.strictEqual(qt.attempts, 0, '负数 attempts → 0');
  assert.strictEqual(qt.correct, 0);
  assert.strictEqual(qt.incorrect, 0);
  assert.deepEqual(qt.recentResults, [0, 1, 0]); // 'x' → 0，1→1，0→0
  assert.strictEqual(qt.lastPracticedAt, null, '非法 ts → null');
  assert.strictEqual(norm.recentErrors.length, 2, '损坏条目应被丢弃；错题事实保留，错因归 null');
  // 第 1 条：未知错因 → null（错题事实仍记录，绝不伪造错因）
  assert.strictEqual(norm.recentErrors[0].errorType, null, '未知错因应归 null');
  // 第 2 条：可靠错因保留
  assert.strictEqual(norm.recentErrors[1].errorType, '计算错误');
});

test('P27-12 #8c normalizeKpState 自愈：semanticTargetStats 损坏字段被 sanitize', () => {
  const dirty = {
    mastery: 0.5, attempts: 1, correct: 0,
    semanticTargetStats: {
      '运算含义': { attempts: 'x', correct: -2, lastPracticedAt: 1000 },
      'null': { attempts: 2, correct: 1 }
    }
  };
  const norm = LearnerModel.normalizeKpState(dirty, 'KP-st');
  const st = norm.semanticTargetStats['运算含义'];
  assert.strictEqual(st.attempts, 0);
  assert.strictEqual(st.correct, 0);
  assert.strictEqual(st.incorrect, 0);
  assert.strictEqual(st.lastPracticedAt, 1000);
  const n = norm.semanticTargetStats['null'];
  assert.strictEqual(n.attempts, 2);
  assert.strictEqual(n.correct, 1);
  assert.strictEqual(n.incorrect, 1);
});

test('P27-12 #9 PracticeResult.fromSemanticQuestion 携带 semanticTarget', () => {
  const sq = { id: 'q1', knowledgePoint: KP, questionType: 'calc', semanticTarget: '数量关系' };
  const pr = PracticeResult.fromSemanticQuestion(sq, { correct: true });
  assert.strictEqual(pr.semanticTarget, '数量关系');
  // 兼容 semanticTargets 数组
  const sq2 = { id: 'q2', knowledgePoint: KP, questionType: 'calc', semanticTargets: ['图形识别', '空间感'] };
  const pr2 = PracticeResult.fromSemanticQuestion(sq2, { correct: true });
  assert.strictEqual(pr2.semanticTarget, '图形识别', 'semanticTargets 数组取首项');
  // 无语义目标 → null（绝不伪造）
  const sq3 = { id: 'q3', knowledgePoint: KP, questionType: 'calc' };
  const pr3 = PracticeResult.fromSemanticQuestion(sq3, { correct: true });
  assert.strictEqual(pr3.semanticTarget, null);
});

test('P27-12 #9b PracticeResult.fromLegacy 与 create 携带 semanticTarget', () => {
  const q = { id: 'q1', questionType: 'calc', semanticTarget: '计量单位' };
  const pr = PracticeResult.fromLegacy(q, { knowledgePointId: KP, correct: true });
  assert.strictEqual(pr.semanticTarget, '计量单位');
  // fromLegacy opts.semanticTarget 优先
  const pr2 = PracticeResult.fromLegacy({ questionType: 'calc' }, {
    knowledgePointId: KP, correct: true, semanticTarget: '应用情境'
  });
  assert.strictEqual(pr2.semanticTarget, '应用情境');
  // create 直接传入
  const pr3 = PracticeResult.create({ knowledgePointId: KP, correct: true, semanticTarget: '逻辑推理' });
  assert.strictEqual(pr3.semanticTarget, '逻辑推理');
});

test('P27-12 #10 recentErrors 超 cap 20 保留末段', () => {
  let s = null;
  for (let i = 0; i < 25; i++) {
    s = LearnerModel.update(s, makeResult(false, { errorType: '计算错误', timestamp: 1000 + i }), { now: 1000 + i });
  }
  const kp = s.knowledgePoints[KP];
  assert.strictEqual(kp.recentErrors.length, 20);
  assert.strictEqual(kp.recentErrors[0].timestamp, 1005, '应保留最后 20 条');
  assert.strictEqual(kp.recentErrors[19].timestamp, 1024);
});

test('P27-12 #11 红线：新增字段不参与评分（mastery/confidence 仍是唯一评分入口）', () => {
  // 两道相同 correctness 但不同 questionType 的题，mastery 演进应只受 correct 序列影响
  const r1 = makeResult(true, { questionType: 'calc' });
  const r2 = makeResult(true, { questionType: 'choice' });
  const s1 = LearnerModel.update(null, r1, { now: 1 });
  const s2 = LearnerModel.update(null, r2, { now: 1 });
  assert.strictEqual(s1.knowledgePoints[KP].mastery, s2.knowledgePoints[KP].mastery, '不同题型同 correctness → mastery 相同');
  assert.strictEqual(s1.knowledgePoints[KP].confidence, s2.knowledgePoints[KP].confidence);
});

test('P27-12 #12 端到端：ResultCollector.collectCheck 多题 → state 含 questionTypeStats', () => {
  const ResultCollector = require(path.join(ROOT, 'shared', 'learner', 'result-collector.js'));
  const questions = [
    { id: 'q1', knowledgePoint: KP, questionType: 'calc', semanticTarget: '运算含义' },
    { id: 'q2', knowledgePoint: KP, questionType: 'choice', semanticTarget: '逻辑判断' },
    { id: 'q3', knowledgePoint: KP, questionType: 'calc', semanticTarget: '运算含义' }
  ];
  const checkResult = { results: [true, false, true] };
  const s = ResultCollector.collectCheck(null, questions, checkResult, {
    errorTypeByIndex: [null, '概念混淆', null],
    now: 5000
  });
  const kp = s.knowledgePoints[KP];
  assert.strictEqual(kp.attempts, 3);
  assert.strictEqual(kp.correct, 2);
  assert.strictEqual(kp.incorrect, 1);
  // 题型分布
  const calc = kp.questionTypeStats['calc'];
  assert.strictEqual(calc.attempts, 2);
  assert.strictEqual(calc.correct, 2);
  const choice = kp.questionTypeStats['choice'];
  assert.strictEqual(choice.attempts, 1);
  assert.strictEqual(choice.incorrect, 1);
  // 语义目标分布
  const op = kp.semanticTargetStats['运算含义'];
  assert.strictEqual(op.attempts, 2);
  assert.strictEqual(op.correct, 2);
  const lg = kp.semanticTargetStats['逻辑判断'];
  assert.strictEqual(lg.attempts, 1);
  assert.strictEqual(lg.incorrect, 1);
  // 错题摘要
  assert.strictEqual(kp.recentErrors.length, 1);
  assert.strictEqual(kp.recentErrors[0].questionType, 'choice');
  assert.strictEqual(kp.recentErrors[0].semanticTarget, '逻辑判断');
  assert.strictEqual(kp.recentErrors[0].errorType, '概念混淆');
  // 错因派生视图
  assert.strictEqual(kp.misconceptionStats.length, 1);
  assert.strictEqual(kp.misconceptionStats[0].errorType, '概念混淆');
});
