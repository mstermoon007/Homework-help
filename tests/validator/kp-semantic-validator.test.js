/**
 * tests/validator/kp-semantic-validator.test.js — P28-SEM-GATE-01 运行时语义门禁
 *
 * 验证 checkOperationSemanticGate：题目 data.operation ⊆ plan.semanticParams.operations（KBL SSOT）。
 * 属根因 A「语义决策多写者」的 forcing function；先 warn-only（不阻断生成）。
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const KpSem = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));

// ============ P28-SEM-GATE-01：单元（checkOperationSemanticGate 直接） ============
test('P28-SEM-GATE-01 题目运算 ⊆ SSOT → 无 warning', () => {
  const sq = { data: { operation: 'add' } };
  const plan = { semanticParams: { operations: ['+'] } };
  const w = KpSem.checkOperationSemanticGate(sq, plan);
  assert.strictEqual(w.length, 0, 'add ∈ [+] 应通过');
});

test('P28-SEM-GATE-01 多运算 SSOT：题目任一运算命中即通过', () => {
  const plan = { semanticParams: { operations: ['+', '−'] } };
  assert.strictEqual(KpSem.checkOperationSemanticGate({ data: { operation: 'add' } }, plan).length, 0);
  assert.strictEqual(KpSem.checkOperationSemanticGate({ data: { operation: 'sub' } }, plan).length, 0);
  assert.strictEqual(KpSem.checkOperationSemanticGate({ data: { operation: ['+', '−'] } }, plan).length, 0, '多运算数组应逐个判定');
});

test('P28-SEM-GATE-01 题目运算 ⊄ SSOT → warning（warn-only）', () => {
  const sq = { data: { operation: 'div' } };
  const plan = { semanticParams: { operations: ['+'] } };
  const w = KpSem.checkOperationSemanticGate(sq, plan);
  assert.strictEqual(w.length, 1, 'div ∉ [+] 应出 1 warning');
  assert.strictEqual(w[0].code, 'KP_SEMANTIC_OPERATION');
  assert.strictEqual(w[0].severity, 'WARNING', 'warn-only：不阻断生成');
  assert.ok(/\[SEM-GATE\]/.test(w[0].message), 'warning 文案标识 SEM-GATE');
});

test('P28-SEM-GATE-01 mixed × 多运算 SSOT → 合法（与 checkOperation 同口径）', () => {
  const sq = { data: { operation: 'mixed' } };
  const plan = { semanticParams: { operations: ['+', '−', '×', '÷'] } };
  const w = KpSem.checkOperationSemanticGate(sq, plan);
  assert.strictEqual(w.length, 0, 'mixed 在多运算 SSOT 下应合法');
  // 反向：mixed 但 SSOT 单运算 → 应 warning（mixed 不在单运算集内）
  const w2 = KpSem.checkOperationSemanticGate(sq, { semanticParams: { operations: ['+'] } });
  assert.strictEqual(w2.length, 1, 'mixed 在单运算 SSOT 下应出 warning');
});

test('P28-SEM-GATE-01 KBL 全称 vs 题目短名：normalizeOp 归一后不误报', () => {
  // KBL semantic.operations 用全称（'division'/'addition'/'multiplication'/'subtraction'），
  // 题目 data.operation 用短名（'div'/'add'/'mult'/'sub'）。
  // normalizeOp 须双向归一，否则门禁会对所有算术 KP 误报 warning。
  assert.strictEqual(KpSem.checkOperationSemanticGate(
    { data: { operation: 'div' } }, { semanticParams: { operations: ['division'] } }).length, 0,
    'div ∈ [division] 应通过（normalizeOp 归一）');
  assert.strictEqual(KpSem.checkOperationSemanticGate(
    { data: { operation: 'add' } }, { semanticParams: { operations: ['addition'] } }).length, 0,
    'add ∈ [addition] 应通过');
  assert.strictEqual(KpSem.checkOperationSemanticGate(
    { data: { operation: 'mult' } }, { semanticParams: { operations: ['multiplication'] } }).length, 0,
    'mult ∈ [multiplication] 应通过');
  assert.strictEqual(KpSem.checkOperationSemanticGate(
    { data: { operation: 'sub' } }, { semanticParams: { operations: ['subtraction'] } }).length, 0,
    'sub ∈ [subtraction] 应通过');
  // 反向：KBL 全称多运算 + 题目 mixed → 合法
  assert.strictEqual(KpSem.checkOperationSemanticGate(
    { data: { operation: 'mixed' } },
    { semanticParams: { operations: ['addition', 'subtraction'] } }).length, 0,
    'mixed ∈ [addition, subtraction] 应通过');
});

test('P28-SEM-GATE-01 跳过：无 plan / 无 semanticParams.operations / 题目无 data.operation', () => {
  const sq = { data: { operation: 'add' } };
  assert.strictEqual(KpSem.checkOperationSemanticGate(sq, null).length, 0, '无 plan 跳过');
  assert.strictEqual(KpSem.checkOperationSemanticGate(sq, {}).length, 0, '无 semanticParams 跳过');
  assert.strictEqual(KpSem.checkOperationSemanticGate(sq, { semanticParams: {} }).length, 0, 'semanticParams 无 operations 跳过');
  assert.strictEqual(KpSem.checkOperationSemanticGate(sq, { semanticParams: { operations: [] } }).length, 0, '空 operations 跳过');
  assert.strictEqual(KpSem.checkOperationSemanticGate({ data: {} }, { semanticParams: { operations: ['+'] } }).length, 0, '题目无 data.operation 跳过');
  assert.strictEqual(KpSem.checkOperationSemanticGate({}, { semanticParams: { operations: ['+'] } }).length, 0, '题目无 data 跳过');
});

// ============ P41-A1：checkQuestionType 题型字段口径 ============
// 缺陷：原实现仅读 sq.questionTypeId（工厂从不写该字段）→ 校验恒为 no-op。
// 期望：以 canonical sq.questionType 为准，兼容 sq.questionTypeId 别名。
const KP_CONSTRAINTS = {
  presentationQuestionTypes: ['calc', 'fill'],
  generationCapabilities: [{ id: 'calc' }],
  operation: null, numericRange: null, structure: {},
  factualContent: null, graphicType: null, spiral: {}
};

test('P41-A1 合法题型（sq.questionType ∈ KP 允许）→ 无错误', () => {
  assert.strictEqual(KpSem.checkQuestionType({ questionType: 'calc' }, KP_CONSTRAINTS).length, 0);
  assert.strictEqual(KpSem.checkQuestionType({ questionType: 'fill' }, KP_CONSTRAINTS).length, 0);
});

test('P41-A1 非法题型（sq.questionType ∉ KP 允许）→ 触发 KP_SEMANTIC_QUESTION_TYPE', () => {
  const errs = KpSem.checkQuestionType({ questionType: 'judge' }, KP_CONSTRAINTS);
  assert.strictEqual(errs.length, 1, 'judge 不在 [calc,fill] 内应报错');
  assert.strictEqual(errs[0].code, 'KP_SEMANTIC_QUESTION_TYPE');
  assert.strictEqual(errs[0].field, 'questionType');
});

test('P41-A1 兼容别名 sq.questionTypeId 仍被识别', () => {
  assert.strictEqual(KpSem.checkQuestionType({ questionTypeId: 'fill' }, KP_CONSTRAINTS).length, 0, '别名 fill 合法');
  const errs = KpSem.checkQuestionType({ questionTypeId: 'geometry' }, KP_CONSTRAINTS);
  assert.strictEqual(errs.length, 1, '别名 geometry 非法应报错');
});

test('P41-A1 canonical 字段优先于别名（questionType 存在时以 questionType 为准）', () => {
  // questionType 合法、questionTypeId 非法 → 以 canonical 字段判定，不误杀
  assert.strictEqual(KpSem.checkQuestionType({ questionType: 'calc', questionTypeId: 'judge' }, KP_CONSTRAINTS).length, 0);
});

test('P41-A1 缺失题型 → 跳过（不抛错、不误判），由 schema 层负责必填', () => {
  assert.deepStrictEqual(KpSem.checkQuestionType({}, KP_CONSTRAINTS), []);
  assert.deepStrictEqual(KpSem.checkQuestionType({ questionType: null }, KP_CONSTRAINTS), []);
});

test('P41-A1 kpConstraints 缺失或无允许集 → 跳过（不越权判定）', () => {
  assert.deepStrictEqual(KpSem.checkQuestionType({ questionType: 'judge' }, null), []);
  assert.deepStrictEqual(KpSem.checkQuestionType({ questionType: 'judge' }, { presentationQuestionTypes: [], generationCapabilities: [] }), []);
});

test('P41-A1 聚合：validateKpSemantics 通过注入 kpConstraints 使非法题型进入 valid=false', () => {
  const sq = { knowledgePointIds: ['kp-x'], questionType: 'judge', data: {} };
  const plan = { knowledgePointIds: ['kp-x'], questionTypeId: 'judge' };
  const r = KpSem.validateKpSemantics(sq, { plan: plan, kpId: 'kp-x', kpConstraints: KP_CONSTRAINTS });
  assert.strictEqual(r.valid, false, '非法题型不再是静默放行');
  assert.strictEqual(r.checks.questionType, 'fail');
});

test('P41-A1 聚合：错误 KP 关联（knowledgePointIds 与 plan 不一致）→ KP_SEMANTIC_IDENTITY', () => {
  const sq = { knowledgePointIds: ['kp-a'], questionType: 'calc', data: {} };
  const plan = { knowledgePointIds: ['kp-b'], questionTypeId: 'calc' };
  const r = KpSem.validateKpSemantics(sq, { plan: plan, kpId: 'kp-b', kpConstraints: KP_CONSTRAINTS });
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some(function (e) { return e.code === 'KP_SEMANTIC_IDENTITY'; }), '应含 KP 身份不一致错误');
});

// ============ P28-SEM-GATE-01：集成（validateKpSemantics warn-only 不阻断） ============
test('P28-SEM-GATE-01 集成：运算不一致 → warning 但 valid 保持 true（warn-only）', () => {
  // 最小 sq + plan：kpConstraints=null 使 checkQuestionType/Numeric/Structure/Content 跳过；
  // knowledgePointIds 一致使 checkKpIdentity 通过；mismatch 的 data.operation 触发 SEM-GATE
  const sq = {
    knowledgePointIds: ['math-test-g001'],
    questionTypeId: 'calc',
    questionType: 'calc',
    data: { operation: 'div' }
  };
  const plan = {
    knowledgePointIds: ['math-test-g001'],
    questionTypeId: 'calc',
    difficulty: 3,
    count: 1,
    semanticParams: { operations: ['+'] }
  };
  const r = KpSem.validateKpSemantics(sq, { plan: plan, kpConstraints: null, kpId: 'math-test-g001' });
  const gateWarn = (r.warnings || []).filter(function (w) { return /\[SEM-GATE\]/.test(w.message || ''); });
  assert.ok(gateWarn.length >= 1, '应含 SEM-GATE warning');
  assert.strictEqual(r.valid, true, 'warn-only：valid 保持 true，不阻断生成');
});
