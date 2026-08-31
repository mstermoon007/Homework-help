#!/usr/bin/env node
/**
 * dev/check-m6-final.js — M6-R29 M6 最终验收 Gate
 *
 * 必须全部通过：
 * [ ] Learner Model 模块可加载
 * [ ] 知识点级状态结构完整（R02）
 * [ ] Learner Storage 读写（R03）
 * [ ] 标准 PracticeResult（R04）
 * [ ] Result 收集器覆盖正确/错误/未作答/重做/跳过（R05）
 * [ ] accuracy / recentAccuracy（R06）
 * [ ] EMA 掌握度单调性（R07）
 * [ ] confidence 与 mastery 分离（R08）
 * [ ] 错因录入与聚焦（R09）
 * [ ] 错因不伪造（unknown→null，R10）
 * [ ] 只读 Mastery API（R11）
 * [ ] 自适应规则 1（R12-R15）
 * [ ] 自适应规则 2（R16-R18）
 * [ ] StrategyEngine 集成（R19）
 * [ ] practice.html 已加载 learner 模块（R20）
 * [ ] Legacy Adapter 输出 difficultyParams（R21）
 * [ ] shadow / legacy 对照（R22）
 * [ ] 迁移脚本保留旧数据（R27）
 * [ ] 监控工具存在（R28）
 * [ ] 自动化测试（learner + adaptive）通过
 * [ ] 策略回归（strategy tests）通过
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');

function banner(t) { console.log('\n=== ' + t + ' ==='); }
function check(name, fn) { try { return { name: name, pass: !!fn(), error: null }; } catch (e) { return { name: name, pass: false, error: e.message }; } }

var checks = [];

// 1. Learner Model 模块可加载
checks.push(check('Learner 模块可加载', function () {
  var LM = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));
  var LS = require(path.join(ROOT, 'shared', 'learner', 'learner-storage.js'));
  var PR = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));
  var RC = require(path.join(ROOT, 'shared', 'learner', 'result-collector.js'));
  var EM = require(path.join(ROOT, 'shared', 'learner', 'error-model.js'));
  var AS = require(path.join(ROOT, 'shared', 'strategy', 'adaptive-strategy.js'));
  return LM && LS && PR && RC && EM && AS;
}));

// 2. KP 级状态结构完整（R02）
checks.push(check('知识点级状态结构完整 (R02)', function () {
  var LM = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));
  var s = LM.defaultKpState('KP');
  var keys = ['mastery', 'confidence', 'attempts', 'correct', 'accuracy', 'recentAccuracy',
    'recentResults', 'errorPatterns', 'exposureCount', 'lastPracticedAt',
    'recommendedDifficulty', 'recommendedSpiralLevel', 'updatedAt'];
  return keys.every(function (k) { return k in s; });
}));

// 3. LearnerStorage 读写（R03）
checks.push(check('LearnerStorage 读写 (R03)', function () {
  var LS = require(path.join(ROOT, 'shared', 'learner', 'learner-storage.js'));
  var LM = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));
  var PR = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));
  var s = LM.update(null, PR.create({ questionId: 'q', knowledgePointId: 'KP', correct: true }), { now: 1 });
  LS.save(s);
  var kp = LS.getKnowledgePoint('KP');
  return kp && kp.attempts === 1 && kp.mastery === 0.3;
}));

// 4. 标准 PracticeResult（R04）
checks.push(check('标准 PracticeResult & KP 来源约束 (R04)', function () {
  var PR = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));
  var r = PR.fromSemanticQuestion({ id: 'q1', knowledgePoint: 'KP-加', difficulty: 3, questionType: 'calc' }, { correct: true });
  var fields = ['questionId', 'knowledgePointId', 'correct', 'userAnswer', 'correctAnswer', 'responseTime',
    'questionDifficulty', 'questionType', 'spiralLevel', 'errorType', 'status', 'timestamp'];
  var ok = fields.every(function (f) { return f in r; }) && r.knowledgePointId === 'KP-加';
  // 禁止 UI 猜测：缺少 knowledgePoint 必须抛错
  var threw = false;
  try { PR.fromSemanticQuestion({ id: 'q2', difficulty: 3 }, { correct: true }); } catch (e) { threw = true; }
  return ok && threw;
}));

// 5. ResultCollector 覆盖（R05）
checks.push(check('ResultCollector 覆盖五类结果 (R05)', function () {
  var RC = require(path.join(ROOT, 'shared', 'learner', 'result-collector.js'));
  var LM = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));
  var PR = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));
  var s = null;
  [['correct', true], ['wrong', false], ['unanswered', false], ['redo', true], ['skipped', true]].forEach(function (t, i) {
    s = LM.update(s, PR.create({ questionId: 'q' + i, knowledgePointId: 'KP', correct: t[1], status: t[0] }), { now: i });
  });
  var kp = s.knowledgePoints['KP'];
  // correct+wrong+unanswered 计 3 次尝试；redo/skipped 不计入 attempts；skipped 仍计曝光
  return kp.attempts === 3 && kp.exposureCount === 5;
}));

// 6. accuracy / recentAccuracy（R06）
checks.push(check('accuracy / recentAccuracy (R06)', function () {
  var LM = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));
  var PR = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));
  var s = null;
  [true, true, false, true, true].forEach(function (c, i) { s = LM.update(s, PR.create({ questionId: 'q' + i, knowledgePointId: 'KP', correct: c }), { now: i }); });
  return s.knowledgePoints['KP'].accuracy === 0.8;
}));

// 7. EMA 掌握度（R07）
checks.push(check('EMA 掌握度单调性 (R07)', function () {
  var LM = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));
  var PR = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));
  var s = null, m = [];
  for (var i = 0; i < 5; i++) { s = LM.update(s, PR.create({ questionId: 'q' + i, knowledgePointId: 'KP', correct: true }), { now: i }); m.push(s.knowledgePoints['KP'].mastery); }
  var mono = true;
  for (i = 1; i < m.length; i++) { if (m[i] <= m[i - 1]) mono = false; }
  return mono && m[4] === 0.832 && s.knowledgePoints['KP'].mastery < 1;
}));

// 8. confidence 与 mastery 分离（R08）
checks.push(check('confidence 分离于 mastery (R08)', function () {
  var LM = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));
  var PR = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));
  // 同 mastery≈0.3：1 次回答 vs 20 次回答，置信度应显著不同
  var s1 = LM.update(null, PR.create({ questionId: 'a', knowledgePointId: 'KP', correct: true }), { now: 1 });
  var s2 = null;
  for (var i = 0; i < 20; i++) s2 = LM.update(s2, PR.create({ questionId: 'b' + i, knowledgePointId: 'KP', correct: true }), { now: i });
  var c1 = s1.knowledgePoints['KP'].confidence, c2 = s2.knowledgePoints['KP'].confidence;
  return c2 > c1 + 0.2;
}));

// 9. 错因录入与聚焦（R09）
checks.push(check('错因录入与聚焦 (R09)', function () {
  var LM = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));
  var PR = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));
  var s = null;
  [false, false, false, false, false].forEach(function (c, i) { s = LM.update(s, PR.create({ questionId: 'q' + i, knowledgePointId: 'KP', correct: c, errorType: '计算错误' }), { now: i }); });
  var focus = LM.getErrors(s, 'KP');
  return focus.length === 1 && focus[0].errorType === '计算错误' && focus[0].count === 5;
}));

// 10. 错因不伪造（R10）
checks.push(check('错因不伪造：unknown → null (R10)', function () {
  var EM = require(path.join(ROOT, 'shared', 'learner', 'error-model.js'));
  return EM.normalizeErrorType(null) === null && EM.normalizeErrorType('random-stuff') === null && EM.normalizeErrorType('计算错误') === '计算错误';
}));

// 11. 只读 Mastery API（R11）
checks.push(check('只读 Mastery API (R11)', function () {
  var LM = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));
  var PR = require(path.join(ROOT, 'shared', 'learner', 'practice-result.js'));
  var s = LM.update(null, PR.create({ questionId: 'q', knowledgePointId: 'KP', correct: true }), { now: 1 });
  return LM.getMastery(s, 'KP') === 0.3 && LM.getAccuracy(s, 'KP') === 1 && LM.getState(s, 'KP').kpId === 'KP';
}));

// 12. 自适应难度规则（R12-R15）
checks.push(check('自适应难度规则 (R12-R15)', function () {
  var AS = require(path.join(ROOT, 'shared', 'strategy', 'adaptive-strategy.js'));
  var low = AS.resolve({ learnerState: { mastery: 0.2, confidence: 0.6, attempts: 20, recentAccuracy: 0.2, recentResults: [0, 0, 0, 0, 0] }, staticDifficulty: 5 });
  var high = AS.resolve({ learnerState: { mastery: 0.9, confidence: 0.8, attempts: 30, recentAccuracy: 0.95, recentResults: [1, 1, 1, 1, 1] }, staticDifficulty: 5 });
  return low.effectiveDifficulty === 4 && high.effectiveDifficulty === 7 && high.adjustment === 2 && low.adjustment === -1;
}));

// 13. 平台/变体/spiral（R16-R18）
checks.push(check('spiral/变体/错因聚焦 (R16-R18)', function () {
  var AS = require(path.join(ROOT, 'shared', 'strategy', 'adaptive-strategy.js'));
  var low = AS.resolve({ learnerState: { mastery: 0.15, confidence: 0.5, attempts: 20, recentAccuracy: 0.1, recentResults: [0] }, staticDifficulty: 5 });
  var high = AS.resolve({ learnerState: { mastery: 0.95, confidence: 0.85, attempts: 30, recentAccuracy: 0.95, recentResults: [1, 1, 1] }, staticDifficulty: 5 });
  return low.targetSpiralLevel < high.targetSpiralLevel && high.variant === '迁移';
}));

// 14. StrategyEngine 集成（R19）
checks.push(check('StrategyEngine 集成 (R19)', function () {
  var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
  var KP = 'math-g1-m0-make-ten';
  var base = Engine.plan({ knowledgePointId: KP, count: 2, difficulty: 4 });
  var lp = Engine.plan({ knowledgePointId: KP, count: 2, difficulty: 4, learnerProfile: { knowledgePoints: { [KP]: { mastery: 0.9, confidence: 0.8, recentAccuracy: 0.9, attempts: 30, correct: 27, recentResults: [1, 1, 1, 1, 1] } } } });
  var legacyFlat = base.plans[0].learner == null && base.plans[0].variant == null;
  return legacyFlat && lp.plans[0].learner && lp.plans[0].difficulty === 6 && lp.plans[0].variant === '迁移';
}));

// 15. practice.html 已接入 learner 模块（R20）
checks.push(check('practice.html 接入 learner 模块 (R20)', function () {
  var html = fs.readFileSync(path.join(ROOT, 'practice.html'), 'utf8');
  var all = ['storage.js', 'learner/error-model.js', 'learner/practice-result.js', 'learner/learner-model.js', 'learner/learner-storage.js', 'learner/result-collector.js'];
  return all.every(function (f) { return html.indexOf(f) !== -1; })
    && html.indexOf('learnerProfile') !== -1
    && html.indexOf('feedLearnerModel') !== -1;
}));

// 16. Legacy Adapter 输出 difficultyParams（R21）
checks.push(check('Legacy Adapter difficultyParams (R21)', function () {
  var Adapter = require(path.join(ROOT, 'shared', 'strategy', 'legacy-adapter.js'));
  var plan = { questionTypeId: 'calc', difficulty: 5, cognitiveLevel: 'understand', spiralLevel: 2, constraints: { numberRange: { min: 1, max: 100 } } };
  var opts = Adapter.adaptPlanToLegacyOptions(plan, {});
  return opts.difficulty === 5 && opts.difficultyParams && opts.difficultyParams.level === 5;
}));

// 17. shadow / legacy 对照（R22）
checks.push(check('shadow/legacy 对照 (R22)', function () {
  var AS = require(path.join(ROOT, 'shared', 'strategy', 'adaptive-strategy.js'));
  var sh = AS.resolve({ adaptiveMode: 'shadow', legacyDelta: 1, staticDifficulty: 5, learnerState: { mastery: 0.2, confidence: 0.6, attempts: 20, recentAccuracy: 0.1, recentResults: [0, 0, 0] } });
  var lg = AS.resolve({ adaptiveMode: 'legacy', legacyDelta: 1, staticDifficulty: 5, learnerState: { mastery: 0.9, confidence: 0.8, attempts: 30, recentResults: [1, 1, 1] } });
  return sh.mode === 'shadow' && sh.effectiveDifficulty === 6 && sh.shadow && lg.mode === 'legacy' && lg.effectiveDifficulty === 6;
}));

// 18. 迁移脚本保留旧数据（R27）
checks.push(check('迁移脚本保留旧数据 (R27)', function () {
  var mig = require(path.join(ROOT, 'dev', 'm6-learner-migration.js'));
  var old = { version: 2, lastPractice: { pluginId: 'math-oral' }, difficultyState: { 'math-oral': { emaRate: 0.85, currentDelta: 1 } }, wrongList: [] };
  var after = mig.ensureCompatible(old);
  return after && after.difficultyState && after.difficultyState['math-oral'] && after.difficultyState['math-oral'].currentDelta === 1
    && after.learnerState && Object.keys(after.learnerState.knowledgePoints).length === 0;
}));

// 19. 监控工具存在（R28）
checks.push(check('监控工具存在 (R28)', function () {
  return fs.existsSync(path.join(ROOT, 'dev', 'm6-monitor.js'));
}));

// 20. 自动化测试（learner + adaptive）通过
checks.push(check('learner + adaptive 自动化测试通过', function () {
  try {
    require('child_process').execSync('node --test tests/learner/*.test.js tests/adaptive/*.test.js', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    return true;
  } catch (e) { return false; }
}));

// 21. 策略回归（strategy tests）通过
checks.push(check('策略回归（strategy tests）通过', function () {
  try {
    require('child_process').execSync('node --test tests/strategy/*.test.js', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    return true;
  } catch (e) { return false; }
}));

banner('M6-R29 M6 最终验收 Gate');
var passed = checks.filter(function (c) { return c.pass; });
var failed = checks.filter(function (c) { return !c.pass; });

checks.forEach(function (c) { console.log('  [' + (c.pass ? 'PASS' : 'FAIL') + '] ' + c.name + (c.error ? ' — ' + c.error : '')); });

console.log('\n通过: ' + passed.length + ' / ' + checks.length);
if (failed.length) {
  console.log('失败项:');
  failed.forEach(function (f) { console.log('  ✗ ' + f.name + (f.error ? ': ' + f.error : '')); });
}

var ok = failed.length === 0;
console.log('\n' + (ok ? '[PASS] M6-R29 所有验收项通过' : '[FAIL] M6-R29 存在 ' + failed.length + ' 项未通过'));
process.exitCode = ok ? 0 : 1;