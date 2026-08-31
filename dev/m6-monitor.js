#!/usr/bin/env node
/**
 * dev/m6-monitor.js — M6-R28 Learner Model 运行监控
 *
 * 输入：可选的 LearnerModel 状态 JSON（缺省用合成会话演示）。
 * 输出：mastery / difficulty / adjustment / errorPattern / variant 分布；
 *       重点告警 adjustment=-2 或 +2（连续强化达到限幅上限）。
 *
 * 用法：node dev/m6-monitor.js [state.json]
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var LearnerModel = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));
var PracticeResult = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));
var Adaptive = require(path.join(ROOT, 'shared', 'strategy', 'adaptive-strategy.js'));

function assert(cond, msg) { if (!cond) { console.error('[FAIL] ' + msg); process.exit(1); } }

// 合成会话：模拟一个学生对某 KP 序列作答
function simulate() {
  var kpId = 'math-g1-m1-addsub-5';
  var state = LearnerModel.normalizeLearnerState(null);
  var pattern = [true, true, false, true, true, true, false, true, true, true, true, true, true, false, true];
  pattern.forEach(function (ok, i) {
    state = LearnerModel.update(state, PracticeResult.create({
      questionId: 'sim-' + i, knowledgePointId: kpId, correct: ok,
      errorType: ok ? null : '计算错误',
      questionDifficulty: 3, questionType: 'calc'
    }), { now: i + 1 });
  });
  return state;
}

var state = (process.argv[2] && fs.existsSync(process.argv[2]))
  ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  : simulate();

var kps = state.knowledgePoints || {};
var names = Object.keys(kps);
assert(names.length > 0, '状态中没有知识点记录');

console.log('M6-R28 Learner Model 监控');
console.log('================================');

var dist = { '<0.4': 0, '0.4-0.7': 0, '>0.7': 0 };
var diffSums = [], adjustments = [], spiralAll = [];
var patterns = {};

names.forEach(function (n) {
  var kp = LearnerModel.normalizeKpState(kps[n], n);
  var d = Adaptive.resolve({ learnerState: kp, staticDifficulty: 3 });
  if (kp.mastery < 0.4) dist['<0.4']++;
  else if (kp.mastery < 0.7) dist['0.4-0.7']++;
  else dist['>0.7']++;

  if (kp.attempts) diffSums.push([n, kp.mastery, kp.confidence, d.effectiveDifficulty, d.adjustment, d.variant, d.targetSpiralLevel]);
  adjustments.push(d.adjustment);
  spiralAll.push(d.targetSpiralLevel);
  LearnerModel.getErrors(state, n).forEach(function (e) {
    patterns[e.errorType] = (patterns[e.errorType] || 0) + e.count;
  });
});

console.log('\nmastery 分布: ' + JSON.stringify(dist));
console.log('\nKP 明细 (kp / mastery / conf / effDiff / adj / variant / spiral):');
diffSums.forEach(function (r) { console.log('  ' + r.join(' / ')); });

var minAdj = Math.min.apply(null, adjustments);
var maxAdj = Math.max.apply(null, adjustments);
console.log('\nadjustment 范围: [' + minAdj + ', ' + maxAdj + ']');

// 连续强化达到限幅 → 告警（R29 Gate：移步到极限应属异常）
if (minAdj <= -2 || maxAdj >= 2) {
  console.warn('  [告警] 出现 adjustment = ±2：连续强化达限幅上限，需人工复核知识点难度标定');
}
assert(minAdj >= -2 && maxAdj <= 2, 'adjustment 越界（应限制在 [-2,+2]）');

if (Object.keys(patterns).length) {
  console.log('\nerrorPattern 分布: ' + JSON.stringify(patterns));
} else {
  console.log('\nerrorPattern 分布: （无错因记录）');
}
console.log('\nspiral 层级: [' + Math.min.apply(null, spiralAll) + ' ... ' + Math.max.apply(null, spiralAll) + ']');
console.log('\n[PASS] M6-R28 监控完成，未发现状态异常');
process.exitCode = 0;