'use strict';

/**
 * tests/learner/p28-32-learner-data-chain.test.js — Learner 数据链端到端（P28-32）
 *
 * 验证链路（真实生产执行器，非 stub）：
 *   Question → KP → Semantic Target → Answer → Result → Error Pattern → KnowledgePracticeState
 *
 * 走完整生产链：GenerationAPI.generate（POL orchestrate + runPlans + Generator + Validator
 * + PresentationEngine 渲染），随后 PracticeResult.fromSemanticQuestion → ResultCollector.collect
 * → LearnerModel → KnowledgePracticeState。不触碰生成算法本身（不改变主生成链）。
 *
 * 冻结不变量：
 *   1. 每条 SemanticQuestion 携带 knowledgePoint（Question→KP，逐题）
 *   2. 每条 SemanticQuestion 携带字符串 semanticTarget（来自 plan.explainability，P28-32 注入；
 *      'algebra' 形对象已标量化，杜绝 '[object Object]'）
 *   3. answer 存在（Answer）
 *   4. PracticeResult.fromSemanticQuestion：kp/questionType/semanticTarget 与题一致（Result）
 *   5. ResultCollector.collect → KPS：per-KP 桶、semanticTargetStats 键名 = 逐题 semanticTarget 字符串
 *   6. 可靠 errorType（R10 白名单）→ errorPatterns + recentErrors.semanticTarget 同步记录（Error Pattern→KPS）
 *   7. 无 errorType 不伪造（errorPatterns 空）；无 semanticTarget 归 'null' 桶
 *   8. RenderFormat 透传 semanticTarget / knowledgePointId / spiralLevel / errorType（供页面 feed 消费）
 */

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const env = require(path.join(ROOT, 'dev', '_bundle-env.js'));

const req = (p) => require(path.join(ROOT, p));

let GenerationAPI;

before(() => {
  // P28-30 起渲染栈/打印为页面惰性装载；Node 端到端在测试内按 practice.html 顺序补齐
  [
    'shared/presentation/render-options.js',
    'shared/presentation/render-result.js',
    'shared/presentation/svg-sanitizer.js',
    'shared/presentation/svg-registry.js',
    'shared/generator/graphic-renderer.js',
    'shared/svg/svg-core.js',
    'shared/svg/svg-geometry.js',
    'shared/svg/svg-calculation.js',
    'shared/svg/svg-make-ten.js',
    'shared/svg/svg-chart.js',
    'shared/svg/svg-diagram.js',
    'shared/svg/svg-currency.js',
    'plugins/svg-clock.js',
    'plugins/svg-area.js',
    'plugins/svg-fraction.js',
    'plugins/svg-data-stats.js',
    'plugins/svg-draw.js',
    'plugins/svg-competition.js',
    'shared/presentation/html-renderer.js',
    'shared/presentation/renderer.js'
  ].forEach(req);
  global.LearnerModel = req('shared/learner/learner-model.js');
  global.LearnerErrorModel = req('shared/learner/error-model.js');
  global.PracticeResult = req('shared/learner/practice-result.js');
  global.ResultCollector = req('shared/learner/result-collector.js');
  GenerationAPI = req('shared/generation/api.js');
});

function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

test('P28-32 数据链 1：真实生成 6 题，逐题 KP + 字符串 semanticTarget + answer（Qu→KP→ST→Answer）', async () => {
  const KP = 'math-g2-down-u02-k001';
  const g = await GenerationAPI.generate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP], questionType: 'calc', count: 6, difficulty: 5 },
    { renderOptions: { mode: 'screen' } }
  );
  assert.equal(g.status, 'SUCCESS');
  assert.ok(g.questions.length >= 6, '产题 ≥6');
  g.questions.slice(0, 6).forEach((q, i) => {
    assert.equal(q.knowledgePoint, KP, `t${i} 逐题 KP`);
    assert.ok(q.knowledgePointIds && q.knowledgePointIds.indexOf(KP) !== -1, `t${i} kpIds 含 KP`);
    assert.ok(typeof q.semanticTarget === 'string' && q.semanticTarget.length > 0,
      `t${i} semanticTarget 为非空字符串（实际 ${JSON.stringify(q.semanticTarget)}）`);
    assert.ok(q.semanticTarget.indexOf('[object') === -1, `t${i} 无对象污染`);
    assert.ok(q.answer && q.answer.value != null, `t${i} 有答案`);
    assert.equal(typeof q.difficulty, 'number', `t${i} difficulty`);
  });
});

test('P28-32 数据链 2：多 KP 会话逐题 KP 归属（不把全部题记到首个 kpId）', async () => {
  const A = 'math-g2-down-u02-k001';
  const B = 'math-g2-down-u01-k001';
  const g = await GenerationAPI.generate(
    { subject: 'math', grade: 2, knowledgePointIds: [A, B], questionTypes: ['calc', 'fill'], count: 8, difficulty: 5 },
    { renderOptions: { mode: 'screen' } }
  );
  assert.ok(g.questions.length >= 4, '产题 ≥4');
  const bad = g.questions.filter((q) => {
    return q.knowledgePoint !== A && q.knowledgePoint !== B;
  });
  assert.deepEqual(bad, [], '逐题 KP 必须 ∈ {A,B}');
  const seen = new Set(g.questions.map((q) => q.knowledgePoint));
  assert.ok(seen.size >= 1, '至少覆盖一个 KP');
});

test('P28-32 数据链 3：Result→KPS 全链路（KP 桶 / semanticTargetStats / 计数一致）', async () => {
  const KP = 'math-g2-down-u02-k001';
  const g = await GenerationAPI.generate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP], questionType: 'calc', count: 6, difficulty: 5 },
    { renderOptions: { mode: 'screen' } }
  );
  const qs = g.questions.slice(0, 6);
  // 4 对 2 错（第 4 题为错，且注入 R10 白名单错因 '计算错误' 验证 Error Pattern 链）
  const results = qs.map((q, i) => global.PracticeResult.fromSemanticQuestion(q, {
    correct: i !== 4,
    userAnswer: i !== 4 ? String(q.answer && q.answer.value != null ? q.answer.value : 0) : 'zzz',
    errorType: i === 4 ? '计算错误' : undefined
  }));
  // Result 字段逐题对齐
  results.forEach((pr, i) => {
    assert.equal(pr.knowledgePointId, qs[i].knowledgePoint, `r${i} kp 对齐`);
    assert.equal(pr.questionType, qs[i].questionType, `r${i} qt 对齐`);
    assert.equal(pr.semanticTarget, qs[i].semanticTarget, `r${i} semanticTarget 对齐`);
  });

  let state = global.ResultCollector.collect(global.LearnerModel.normalizeLearnerState(null), results, { alpha: 0.3 });
  assert.ok(hasOwn(state.knowledgePoints, KP), 'KP 桶存在');
  const kpState = state.knowledgePoints[KP];
  assert.equal(kpState.attempts, 6);
  assert.equal(kpState.correct, 5);
  assert.equal(kpState.incorrect, 1);

  // semanticTargetStats：键 = 逐题 semanticTarget 字符串（非 '[object Object]'/非 'null' 兜底）
  const st = qs[0].semanticTarget;
  assert.ok(hasOwn(kpState.semanticTargetStats, st), `semanticTarget 桶 ${st} 存在`);
  assert.equal(kpState.semanticTargetStats[st].attempts, 6);

  // Error Pattern → KPS：'计算错误' 一次，recentErrors 同步（含 semanticTarget）
  assert.ok(hasOwn(kpState.errorPatterns, '计算错误'), 'errorPatterns 记录计算错误');
  assert.equal(kpState.errorPatterns['计算错误'].count, 1);
  const err = kpState.recentErrors[0];
  assert.ok(err, 'recentErrors 有错题摘要');
  assert.equal(err.errorType, '计算错误');
  assert.equal(err.semanticTarget, st, '错题摘要携带 semanticTarget');
});

test('P28-32 数据链 4：R10 门（无 errorType 不伪造；无 semanticTarget 归 null 桶）', async () => {
  let state = global.LearnerModel.normalizeLearnerState(null);
  // 无 errorType：errorPatterns 空；有 semanticTarget
  state = global.ResultCollector.collect(state, [global.PracticeResult.create({
    questionId: 'q1', knowledgePointId: 'math-g1-down-u01-k001', correct: false,
    userAnswer: 'x', questionType: 'calc', semanticTarget: '数值表征', status: 'wrong', timestamp: Date.now()
  })], {});
  const kp = state.knowledgePoints['math-g1-down-u01-k001'];
  assert.deepEqual(kp.errorPatterns, {}, '无可靠错因 → 不伪造');
  assert.deepEqual(kp.semanticTargetStats, { 数值表征: { attempts: 1, correct: 0, incorrect: 1, lastPracticedAt: kp.semanticTargetStats['数值表征'].lastPracticedAt } });

  // 无 semanticTarget → 'null' 桶（绝不伪造标签）
  state = global.ResultCollector.collect(state, [global.PracticeResult.create({
    questionId: 'q2', knowledgePointId: 'math-g1-down-u01-k001', correct: false,
    userAnswer: 'y', questionType: 'fill', semanticTarget: null, status: 'wrong', timestamp: Date.now()
  })], {});
  assert.ok(hasOwn(state.knowledgePoints['math-g1-down-u01-k001'].semanticTargetStats, 'null'), '缺失标签归 null 桶');
});

test('P28-32 数据链 6（V5.1.0 judge）：自由文本错因 PracticeResult→recentErrors 持久化，且不入 errorType 聚类', async () => {
  const KP = 'math-g3-up-u07-k002';
  // 6.1 fromSemanticQuestion：sq.data.misconception 自动入事实对象；答对也可携带但 recentErrors 不记
  const sq = {
    id: 'q_judge_1', knowledgePoint: KP, questionType: 'judge',
    semanticTarget: '图形概念', answer: { value: false },
    data: { misconception: '误认为角的大小由边的长短决定' }
  };
  const pr = global.PracticeResult.fromSemanticQuestion(sq, { correct: false, userAnswer: 'true' });
  assert.equal(pr.misconception, '误认为角的大小由边的长短决定', 'sq.data.misconception 入 PracticeResult');
  assert.equal(pr.errorType, null, '自由文本错因不得冒充 R10 errorType');

  // 6.2 create：显式传入逐题错因（页面 feedLearnerModel 口径）
  const pr2 = global.PracticeResult.create({
    questionId: 'q_judge_2', knowledgePointId: KP, questionType: 'judge',
    correct: false, userAnswer: 'true', semanticTarget: '图形概念',
    misconception: '周长公式漏乘2'
  });
  assert.equal(pr2.misconception, '周长公式漏乘2');

  let state = global.ResultCollector.collect(global.LearnerModel.normalizeLearnerState(null), [pr, pr2], {});
  let kp = state.knowledgePoints[KP];
  assert.deepEqual(kp.errorPatterns, {}, '自由文本错因不进 errorPatterns 聚类');
  assert.equal(kp.recentErrors.length, 2);
  assert.equal(kp.recentErrors[0].misconception, '误认为角的大小由边的长短决定');
  assert.equal(kp.recentErrors[1].misconception, '周长公式漏乘2');

  // 6.3 重新归一（LearnerStorage 读写等价）后字段保留；脏数据容错（非串→null、超长截断）
  state.knowledgePoints[KP].recentErrors.push({
    questionType: 'judge', semanticTarget: null, errorType: null, correct: false,
    misconception: 12345, timestamp: Date.now()
  });
  const longText = '长'.repeat(250);
  state.knowledgePoints[KP].recentErrors.push({
    questionType: 'judge', semanticTarget: null, errorType: null, correct: false,
    misconception: longText, timestamp: Date.now()
  });
  state = global.LearnerModel.normalizeLearnerState(state);
  kp = state.knowledgePoints[KP];
  assert.equal(kp.recentErrors[0].misconception, '误认为角的大小由边的长短决定', '归一后保留');
  assert.equal(kp.recentErrors[2].misconception, null, '非字符串错因归 null');
  const longEntry = kp.recentErrors[kp.recentErrors.length - 1];
  assert.ok(longEntry.misconception.length === 200, '超长错因截断 200');

  // 6.4 答对题：misconception 允许在事实对象上存在，但 recentErrors 不收录
  const prOk = global.PracticeResult.fromSemanticQuestion(
    { id: 'q_ok', knowledgePoint: KP, questionType: 'judge', semanticTarget: null, answer: { value: true }, data: {} },
    { correct: true, userAnswer: 'true' }
  );
  assert.equal(prOk.misconception, null);
});

test('P28-32 数据链 5：RenderFormat 透传（semanticTarget/knowledgePointId/spiralLevel/errorType 供页面 feed）', async () => {
  const KP = 'math-g2-down-u02-k001';
  const g = await GenerationAPI.generate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP], questionType: 'calc', count: 4, difficulty: 5 },
    { renderOptions: { mode: 'screen' } }
  );
  assert.ok(env.RenderFormat && typeof env.RenderFormat.toRenderableQuestions === 'function', 'RenderFormat 可用');
  const legacy = env.RenderFormat.toRenderableQuestions(g.questions);
  const l0 = legacy[0];
  assert.equal(l0.knowledgePointId, KP);
  assert.equal(l0.semanticTarget, g.questions[0].semanticTarget, 'legacy 透传 semanticTarget');
  assert.equal(l0.errorType, null, '无题面错因透传为 null（R10）');
  assert.ok(typeof l0.spiralLevel === 'number' || l0.spiralLevel === null, 'spiralLevel 透传');
});