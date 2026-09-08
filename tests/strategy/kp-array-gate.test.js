'use strict';
/**
 * Refactor Step 2（Request/QuestionPlan 数组化）Gate：
 *  - 旧调用（knowledgePointId 字符串 / knowledgePoints 数组）可归一为 knowledgePointIds[]；
 *  - 新模式请求（knowledgePointIds 数组 / combine / spiralLevel / volume）可输出规范请求；
 *  - 内部 QuestionPlan 唯一语义 = knowledgePointIds[]，不再存在 plan.knowledgePointId（单数）；
 *  - 多知识点 subject 门禁：cn/en 知识点已随 P0-16 剔除，混入即拒绝（不静默产出）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
const Req = require(path.join(ROOT, 'shared', 'strategy', 'strategy-request.js'));
const QP = require(path.join(ROOT, 'shared', 'strategy', 'question-plan.js'));
require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
require(path.join(ROOT, 'shared', 'strategy', 'comprehensive-strategy.js'));
require(path.join(ROOT, 'shared', 'presentation-engine.js'));
require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'render-options.js'));
const GE = require(path.join(ROOT, 'shared', 'generation-engine.js'));
const API = require(path.join(ROOT, 'shared', 'generation', 'api.js'));

const KP = 'math-g1-m0-make-ten';
const KP2 = 'math-g1-m1-addsub-5';

test('GATE-S2-1 旧调用（knowledgePointId 字符串）→ 计划输出数组、无单数字段', () => {
  const r = Engine.plan({ knowledgePointId: KP, count: 3, difficulty: 4 });
  assert.strictEqual(r.valid, true);
  assert.deepStrictEqual(r.plans[0].knowledgePointIds, [KP]);
  assert.strictEqual(r.plans[0].knowledgePointId, undefined, '规范 plan 不得携带单数 KP 语义');
});

test('GATE-S2-2 旧复数权限（knowledgePoints 数组）经归一后 multi-kp 拆分，逐计划数组', async () => {
  const built = await GE.build({ mode: 'multi-kp', knowledgePoints: [KP, KP2], grade: 1, count: 4 });
  assert.strictEqual(built.plans.length, 2);
  built.plans.forEach(p => {
    assert.ok(Array.isArray(p.knowledgePointIds), '每计划 knowledgePointIds 为数组');
    assert.strictEqual(p.knowledgePointIds.length, 1, '非 combine multi-kp 每计划单 KP');
    assert.strictEqual(p.knowledgePointId, undefined);
  });
  assert.equal(built.plans[0].knowledgePointIds[0], KP);
  assert.equal(built.plans[1].knowledgePointIds[0], KP2);
});

test('GATE-S2-3 新数组请求 + volume 别名 正常出计划', async () => {
  const built = await GE.build({ knowledgePointIds: [KP], mode: 'single-kp', grade: 1, volume: 5, difficulty: 3, spiralLevel: 2 });
  assert.strictEqual(built.plans.length, 1);
  assert.strictEqual(built.plans[0].count, 5, 'volume→count 别名生效');
  assert.ok(typeof built.plans[0].spiralLevel === 'number' && built.plans[0].spiralLevel >= 1, 'spiralLevel 已解析');
  assert.deepStrictEqual(built.plans[0].knowledgePointIds, [KP]);
});

test('GATE-S2-4 combine=true 多知识点 → 单合并计划（全量 knowledgePointIds）', async () => {
  const built = await GE.build({ knowledgePointIds: [KP, KP2], combine: true, grade: 1, count: 6, difficulty: 3 });
  assert.strictEqual(built.plans.length, 1, 'combine 应产出单个合并计划');
  assert.strictEqual(built.plans[0].combine, true);
  assert.deepStrictEqual(built.plans[0].knowledgePointIds, [KP, KP2]);
  assert.strictEqual(built.plans[0].knowledgePointId, undefined);
});

test('GATE-S2-5 引擎拒绝“多知识点且未 combine”的静默丢弃', async () => {
  try {
    Engine.plan({ knowledgePointIds: [KP, KP2], count: 4 });
    assert.fail('应抛出 INVALID_REQUEST');
  } catch (e) {
    assert.ok(/combine|单一知识点/.test(e.message), '报错应提示多 KP 需 combine 或拆单: ' + e.message);
  }
});

test('GATE-S2-6 混入已剔除科目的知识点被拒绝（不静默产出）', async () => {
  // cn/en 知识点已随 P0-16 从知识库剔除，不再是「合法但 unsupported」，而是未知/缺失；
  // 引擎对混入请求必须失败（compare：未知组合或 KP_NOT_FOUND），禁止静默规划产出。
  const cnKp = 'cn-g1-n1-pinyin-basic';
  try {
    Engine.plan({ knowledgePointIds: [KP, cnKp], combine: true, count: 4 });
    assert.fail('应抛出拒绝类错误（不得静默产出计划）');
  } catch (e) {
    assert.ok(/COMPOSITE_UNSUPPORTED|KP_NOT_FOUND/.test(e.code), '应明确拒绝：' + e.code);
  }
});

test('GATE-S2-7 消费端读取器：数组权威、旧单数边界归一一次', () => {
  assert.deepStrictEqual(QP.planKnowledgePointIds({ knowledgePointIds: ['a', 'b'] }), ['a', 'b']);
  assert.strictEqual(QP.planPrimaryKpId({ knowledgePointIds: ['a', 'b'] }), 'a');
  assert.deepStrictEqual(QP.planKnowledgePointIds({ knowledgePointId: 'legacy' }), ['legacy']);
  assert.strictEqual(QP.planPrimaryKpId({ knowledgePointId: 'legacy' }), 'legacy');
  assert.deepStrictEqual(QP.planKnowledgePointIds({}), []);
  assert.strictEqual(QP.validateQuestionPlan({ knowledgePointIds: ['a'], questionTypeId: 'calc' }).valid, true);
  assert.strictEqual(QP.validateQuestionPlan({ knowledgePointId: 'a', questionTypeId: 'calc' }).valid, true);
  assert.strictEqual(QP.validateQuestionPlan({}).valid, false);
});

test('GATE-S2-8 生成层 multi-kp 走 api.generate 端到端（计划数组 + 题目归属主 KP）', async () => {
  const g = await GE.generate({ knowledgePointIds: [KP, KP2], mode: 'multi-kp', grade: 1, count: 4, difficulty: 3 });
  assert.ok(g.questions.length > 0);
  assert.ok(g.failedPlans.length === 0);
  const mains = new Set(g.questions.map(q => q.knowledgePoint));
  assert.ok(mains.size >= 1, '应覆盖至少一个主知识点');
});

test('GATE-S2-9 GenerationAPI.generateSync 走独立归一（旧 knowledgePointId）', async () => {
  // PresentationEngine.generateQuestions 为异步接口，generateSync 仅同步推进规划；
  // 本 gate 聚焦归一语义：计划必须为 knowledgePointIds 数组，不再携带单数。
  const r = API.generateSync({ mode: 'single-kp', knowledgePointId: KP, count: 3, difficulty: 3, grade: 1 }, {});
  assert.ok((r.plans || []).every(p => Array.isArray(p.knowledgePointIds)), 'sync 计划应为数组语义');
  assert.ok(Array.isArray(r.questions), 'questions 结构完整');
});