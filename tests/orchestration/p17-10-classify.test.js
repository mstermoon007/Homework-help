'use strict';

/**
 * tests/orchestration/p17-10-classify.test.js — 7 类口径统一：classify 真实生成（P17-10）
 *
 * 注意：GenerationCore 为测试/历史资产（P28-28 定性）。生产链 = api.js
 * orchestrate → build → runPlans → generateQuestions，不经过 GenerationCore；
 * 本测试直接装载 shared/generation/generation-core.js 验证其 execute 语义。
 *
 * 冻结不变量（canonical 7 类对齐，assert 数据链为运行时绑定真值源）：
 *   generator:classification 运行时绑定 == 权威生成映射（mappings/generation-contract/math.json）
 *     classify→generator:classification 的 25 个 canonical 载体（无 legacy 残留绑定）。
 *   classify 计划：selector 首选 generator:classification（非 shape-recognition / 非选择类）。
 *   25 载体全量真实生成：execute 返回 SUCCESS，每张题 questionType = classify（不越界为 choice/geometry 等）。
 *   反向作用域：同 KP 的 calc/geometry 计划不产生 classify 题（classify 语义不泄漏到非 classify 计划）。
 *   选择优先级：kp 本体绑定 ≥ semanticOp ≥ capability ≥ qt（classify 载体与泛型家族 kp 并列时，
 *     由 capability/qt 决胜 → classification 胜出）。
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

// canonical 25 个 classify 载体（kbl capability classify ∈ allowedTypes ∩ 权威生成映射 classify→generation:classification）
const CANONICAL_CLASSIFY_KPS = [
  'math-g2-up-u01-k001', 'math-g2-up-u01-k002', 'math-g2-up-u01-k003', 'math-g2-up-u01-k004', 'math-g2-up-u01-k005', 'math-g2-up-u01-k006',
  'math-g3-down-u05-k001', 'math-g3-down-u05-k002', 'math-g3-down-u05-k003', 'math-g3-down-u05-k004',
  'math-g4-up-u06-k001', 'math-g4-up-u06-k002', 'math-g4-up-u06-k003', 'math-g4-up-u06-k004',
  'math-g4-down-u08-k001', 'math-g4-down-u08-k002', 'math-g4-down-u08-k003', 'math-g4-down-u08-k004',
  'math-g5-up-u07-k001', 'math-g5-up-u07-k002', 'math-g5-up-u07-k003', 'math-g5-up-u07-k004',
  'math-g5-down-u07-k001', 'math-g5-down-u07-k002', 'math-g5-down-u07-k003'
];
// 3.0 旧层残留绑定（必须不再出现在运行时注册表；DEV_LOG:1838「第三套旧层 ID」）
const LEGACY_LEFT = ['math-g3-down-u03-k001', 'math-g3-down-u08-k001', 'math-g3-up-u08-k001', 'math-g4-up-u01-k003'];

before(() => {
  GenerationCore.inject({ selector: Env.GeneratorSelector, retryLoop, semanticQuestion });
});

async function execClassify(kp, count) {
  return GenerationCore.execute(
    { cells: [{ kpId: kp, questionType: 'classify', count }] },
    { skipValidation: false }
  );
}

test('C1 运行时绑定 == 权威生成映射（25 载体，无 legacy 残留）', () => {
  const mappings = require(path.join(ROOT, 'shared', 'knowledge', 'mappings', 'generation-contract', 'math.json')).mappings;
  const mapKps = mappings
    .filter((r) => r.questionType === 'classify' && r.pluginId === 'generator:classification')
    .map((r) => r.knowledgeId)
    .sort();
  assert.equal(mapKps.length, 25, '权威映射 classify→classification 恰 25 行');
  assert.deepEqual(mapKps, CANONICAL_CLASSIFY_KPS.slice().sort(), '映射 == canonical 载体清单');

  const record = Env.GeneratorRegistry.get('generator:classification');
  assert.ok(record, '注册表含 generator:classification');
  assert.deepEqual(record.knowledgePoints.slice().sort(), mapKps, '运行时绑定已对齐权威映射');
  assert.ok(record.version >= 2, '注册表版本已随 P17-10 绑定重对齐提升');
  assert.ok(!LEGACY_LEFT.some((id) => record.knowledgePoints.indexOf(id) !== -1), 'legacy 旧层绑定已清理');

  // 25 载体全部来自 classify 能力声明（allowedTypes 含 classify）
  const capability = require(path.join(ROOT, 'kbl', 'canonical', 'capability.json')).capability;
  const carriers = capability.filter((c) => (c.allowedTypes || []).indexOf('classify') !== -1).map((c) => c.knowledgeId).sort();
  assert.ok(mapKps.every((id) => carriers.indexOf(id) !== -1), '载体 ⊆ 能力声明 classify 集合');
});

test('C2 classify 计划：selector 首选 generator:classification', () => {
  const s = Env.GeneratorSelector.selectGenerator(
    { knowledgePointIds: ['math-g2-up-u01-k001'], questionTypeId: 'classify', count: 2, constraints: {} },
    { mode: 'native' }
  );
  assert.equal(s.generatorId, 'generator:classification', '不应误选 shape-recognition / 选择类生成器');
  assert.equal(s.match.kp, 1, '本体绑定命中（kp 优先）');
});

test('C3 25 载体全量真实生成：SUCCESS，每张题 questionType = classify（不越界）', async () => {
  for (const kp of CANONICAL_CLASSIFY_KPS) {
    const res = await execClassify(kp, 2);
    assert.equal(res.status, 'SUCCESS', kp + ' status');
    assert.equal(res.questions.length, 2, kp + ' 题量');
    res.questions.forEach((q) => {
      assert.equal(q.questionType, 'classify', kp + ' 应产出 classify，而非 secondary 题型');
    });
  }
});

test('C4 反向作用域：classify 语义不泄漏到同 KP 的 calc/geometry 计划', async () => {
  const KP = 'math-g2-up-u01-k001';
  const calc = await GenerationCore.execute({ cells: [{ kpId: KP, questionType: 'calc', count: 2 }] }, { skipValidation: false });
  calc.questions.forEach((q) => assert.notEqual(q.questionType, 'classify', 'calc 计划不得产出 classify'));
  const geo = await GenerationCore.execute({ cells: [{ kpId: KP, questionType: 'geometry', count: 2 }] }, { skipValidation: false });
  geo.questions.forEach((q) => assert.equal(q.questionType, 'geometry', 'geometry 计划产出 geometry 类（shape 家族仍优先）'));
});