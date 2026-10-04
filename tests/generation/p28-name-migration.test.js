'use strict';

/**
 * tests/generation/p28-name-migration.test.js — P28-NAME-MIGRATION
 *
 * integer-arithmetic 族 name 派生→SSOT 边界迁移回归：
 *   1. semantic-parameters.js resolve 对余数 KP 暴露 kind='div-remainder'
 *      （派生 helper 已迁入 SSOT 边界，plan.semanticParams.kind 成为单一暴露点）。
 *   2. 余数 KP 经 PracticeSession 端到端产出 q……r 结构题（prompt 含「……」分隔符、
 *      answer.value 形如「q……r」、data.operation='div'）——验证迁移后行为零变化
 *      （写者从 generator 内 deriveKindFromName 改为 plan.semanticParams.kind）。
 *   3. 直驱乘法 KP（无 constraints.kind、op='mult' 不命中防御层）→ 产出普通结构无 q……r；
 *      验证 op='div' 防御层仍生效，mixed/mult 生成器不在余数 KP 上误派生。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));

const SemanticParameters = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));
const Arithmetic = require(path.join(ROOT, 'shared', 'generator', 'generators', 'arithmetic.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

// 余数 KP（kbl/data/math/g2/knowledge-points.json「有余数除法的含义」）
const REMAINDER_KP = 'math-g2-down-u02-k001';
// 乘法 KP（名不含「余数」，直驱路径不应触发 div-remainder）
const MULT_KP = 'math-g2-up-u07-k001';

/* -------- 1. SSOT 边界：semantic-parameters.js resolve 暴露 kind -------- */

test('NAME-MIGRATION：余数 KP resolve 返回 kind=div-remainder（SSOT 边界派生）', () => {
  const sp = SemanticParameters.resolve(REMAINDER_KP, 'calc');
  assert.ok(sp, 'resolve 应返回对象，不应为 null');
  assert.equal(sp.kind, 'div-remainder',
    '余数 KP semanticParams.kind 应为 div-remainder，实际: ' + sp.kind);
  assert.equal(sp.sources.kind, 'mechanical-rule:kbl-name-operations',
    'sources.kind 应为机械规则标识');
  // 派生原语等价
  assert.equal(SemanticParameters.deriveKindFromName({ name: '有余数除法的含义', operations: ['division'] }), 'div-remainder');
  // 防御：name 不含「余数」→ null
  assert.equal(SemanticParameters.deriveKindFromName({ name: '乘法口诀', operations: ['multiplication'] }), null);
  // 防御：operations 不含 division → null
  assert.equal(SemanticParameters.deriveKindFromName({ name: '有余数除法的含义', operations: ['multiplication'] }), null);
});

/* -------- 2. 端到端：余数 KP 端到端行为零变化（迁移后未引入回归） -------- */

test('NAME-MIGRATION：余数 KP 经 PracticeSession 端到端产出 div 题（行为零变化）', async () => {
  // 行为等价机制：generator-selector.js wrapGenerator 在每次 generate 前调
  // attachToPlan(plan) → plan.semanticParams 被填充（含 kind 字段）。迁移前
  // nameKind 经 deriveKindFromName(plan.semanticParams.name, op) 派生；
  // 迁移后 semKind 经 plan.semanticParams.kind 读取（resolve 内调同一派生逻辑）。
  // 二者在主路径行为等价。kind='div-remainder' → Arith.buildSpecialKind 产出 q……r 结构。
  const session = new PracticeSession({
    subject: 'math', grade: 2, count: 5,
    knowledgePointId: REMAINDER_KP, questionType: 'calc'
  });
  const result = await session.start();
  const qs = session.semanticQuestions || (result && result.questions) || [];
  assert.ok(qs.length >= 1, '余数 KP 应至少产出 1 题，实际 ' + qs.length);

  qs.forEach(function (q, i) {
    assert.equal(q.questionType, 'calc', '题 ' + i + ' 题型');
    const sqKp = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
    assert.equal(sqKp, REMAINDER_KP, '题 ' + i + ' KP');
    // 路由到 generator:arithmetic-division
    assert.equal(q.metadata && q.metadata.generator, 'generator:arithmetic-division',
      '题 ' + i + ' generator');
    // data.operation='div'（余数除法）
    assert.equal(q.data && q.data.operation, 'div',
      '题 ' + i + ' data.operation 应为 div');
    // 余数 KP 的余数答案特征：answer.value 形如「q……r」（Arith 内部 div 结构产出）
    const ans = String(q.answer && (q.answer.value != null ? q.answer.value : q.answer));
    assert.ok(/^\d+……\d+$/.test(ans),
      '题 ' + i + ' answer.value 应形如「q……r」（余数结构），实际: ' + ans);
  });
});

/* -------- 3. 直驱防御层：op='mult' 不命中 div-remainder -------- */

test('NAME-MIGRATION：直驱乘法 KP（op≠div）→ 普通结构题，无 q……r', () => {
  const gen = Arithmetic.createArithmeticGenerator({
    id: 'generator:arithmetic-multiplication', operation: 'mult'
  });
  const plan = {
    knowledgePointIds: [MULT_KP],
    questionTypeId: 'calc',
    count: 5,
    seed: 'p28-name-migration-02-mult',
    constraints: { numberRange: { min: 1, max: 100 }, maxSteps: 1 },
    semanticParams: SemanticParameters.resolve(MULT_KP, 'calc')
  };
  const qs = gen.generate(plan);
  assert.ok(qs.length === 5, '应产出 5 题，实际 ' + qs.length);

  qs.forEach(function (q, i) {
    // MULT_KP 名不含「余数」+ op='mult' → kind=null → 走通用结构 → 无 q……r
    assert.ok(q.prompt.indexOf('……') === -1,
      '题 ' + i + ' prompt 不应含余数记号「……」（普通乘法结构），实际: ' + q.prompt);
    assert.equal(q.data && q.data.operation, 'mult',
      '题 ' + i + ' data.operation 应为 mult');
  });
});
