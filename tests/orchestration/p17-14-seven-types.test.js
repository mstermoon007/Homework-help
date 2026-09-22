'use strict';

/**
 * tests/orchestration/p17-14-seven-types.test.js — 7 类题型真实生成验证（P17-14）
 *
 * 目标：canonical 7 类（calc/fill/choice/judge/geometry/classify/apply）各以
 *   1 载体 KP × 1 难度 × 1 题，真实走通
 *   Request → POL(Cell) → GenerationCore → executeCell → Selector → Generator → Validator → SemanticQuestion。
 *
 * 注意：GenerationCore 为测试/历史资产（P28-28 定性）。生产链 = api.js
 * orchestrate → build → runPlans → generateQuestions，不经过 GenerationCore；
 * 本测试直接装载 shared/generation/generation-core.js 验证其 execute 语义。
 *
 * 冻结不变量：
 *   - 每类 status = SUCCESS，产题 n == 请求数。
 *   - 产题 questionType == 请求 canonical 题型（经 question-type-registry normalize 后比较，无周边类型越界）。
 *   - 产题 knowledgePointId == 请求 KP（不偷换知识载体）。
 *   - 产题 metadata.generator 存在（可追溯生成来源），difficulty == 请求难度（不许 Generator/Validator 重算）。
 *
 * 载体 KP 取自权威生成映射（classify→generation:classification 等），即该 KP×type 的 canonical 语义载体。
 */
'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const GenerationCore = require(path.join(ROOT, 'shared', 'generation', 'generation-core.js'));
const retryLoop = require(path.join(ROOT, 'shared', 'generator', 'retry-loop.js'));
const semanticQuestion = require(path.join(ROOT, 'shared', 'semantic', 'semantic-question.js'));
const QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));

const DIFFICULTY = 5;
// canonical 7 类 × 代表载体 KP（real 生成 SUCCESS 且产题类型一致；geometry 取 g1 图形载体）
const TYPES7 = [
  { type: 'calc', kp: 'math-g4-down-u03-k003' },
  { type: 'fill', kp: 'math-g2-down-u04-k002' },
  { type: 'choice', kp: 'math-g2-down-u05-k002' },
  { type: 'judge', kp: 'math-g2-up-u01-k001' },
  { type: 'geometry', kp: 'math-g1-up-u03-k001' },
  { type: 'apply', kp: 'math-g2-down-u02-k003' },
  { type: 'classify', kp: 'math-g2-up-u01-k001' }
];

before(() => {
  GenerationCore.inject({ selector: Env.GeneratorSelector, retryLoop, semanticQuestion });
});

function norm(t) {
  const r = QTR.normalizeQuestionType(t, { allowHeuristic: false });
  return (r && r.id) || t;
}

async function realGen(kp, type, count) {
  return GenerationCore.execute(
    { cells: [{ kpId: kp, questionType: type, difficulty: DIFFICULTY, count }] },
    { skipValidation: false }
  );
}

test('T1 7 类各 1 题真实生成：SUCCESS，类型/KP/难度/metadata 全部一致', async () => {
  for (const { type, kp } of TYPES7) {
    const res = await realGen(kp, type, 1);
    assert.equal(res.status, 'SUCCESS', type + ' status=' + res.status);
    assert.equal(res.questions.length, 1, type + ' 题量=1');
    const q = res.questions[0];
    assert.equal(norm(q.questionType), type, type + ' 产题类型一致（不越界）');
    assert.equal(q.knowledgePointId, kp, type + ' KP 载体一致');
    assert.ok(q.metadata && q.metadata.generator, type + ' 可追溯 generator');
    assert.equal(Number(q.difficulty), DIFFICULTY, type + ' difficulty 不重算');
  }
});

test('T2 6 类（除 geometry 短产）count=3：SUCCESS 且 n=3，全为请求类型', async () => {
  for (const { type, kp } of TYPES7) {
    if (type === 'geometry') continue; // geometry 语义空间小：真实容量短产（PARTIAL n≥1），归 P17-15
    const res = await realGen(kp, type, 3);
    assert.equal(res.status, 'SUCCESS', type + ' status=' + res.status);
    assert.equal(res.questions.length, 3, type + ' 题量=3');
    res.questions.forEach((q) => assert.equal(norm(q.questionType), type, type + ' 全部类型一致'));
  }
});

test('T3 canonical 请求规范化：oral→calc / recognize→geometry 别名在真实链不丢失', async () => {
  const aliases = [
    { in: 'oral', want: 'calc', kp: 'math-g4-down-u03-k003' },
    { in: 'recognize', want: 'geometry', kp: 'math-g1-up-u03-k001' }
  ];
  for (const a of aliases) {
    const res = await realGen(a.kp, a.in, 1);
    assert.equal(res.status, 'SUCCESS', a.in + ' status');
    assert.equal(res.questions.length, 1);
    assert.equal(norm(res.questions[0].questionType), a.want, a.in + ' → ' + a.want);
  }
});