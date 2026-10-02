'use strict';

/**
 * tests/orchestration/p17-10-classify.test.js — 7 类口径统一：classify 真实生成（P17-10）
 *
 * 注意：GenerationCore 为测试/历史资产（P28-28 定性）。生产链 = api.js
 * orchestrate → build → runPlans → generateQuestions，不经过 GenerationCore；
 * 本测试直接装载 tests/fixtures/generation-core.js 验证其 execute 语义。
 *
 * P28-HOLLOW-01 演进：generator:classification 已退役（仅数字排序单模板、
 * 25 个统计/分类/概率 KP 全部空心）。25 个 canonical classify 载体的五类行
 * （fill/choice/judge/apply/classify 共 125 行）全部由 generator:stats 的
 * 8 形态组原生 maker 承接。
 *
 * 冻结不变量：
 *   权威生成映射 classify→generator:stats 恰 25 行；stats 运行时绑定覆盖该 25 KP，
 *   generator:classification 不再存在于注册表（无 legacy 回潮）。
 *   五类计划：selector 首选 generator:stats（match.kp=1，本体绑定）。
 *   25 载体 × 5 题型全量真实生成：execute SUCCESS，questionType/KP 精确回显（不越界）。
 *   反向作用域：25 载体的 calc/geometry 在能力端点即非 ALLOW（selector 前的 KCV 闸门拦截，
 *   stats maker 永不被这两类计划触达；五类计划内部不串题型已由 C3 全量覆盖）。
 */
'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const GenerationCore = require(path.join(ROOT, 'tests', 'fixtures', 'generation-core.js'));
const retryLoop = require(path.join(ROOT, 'shared', 'generator', 'retry-loop.js'));
const semanticQuestion = require(path.join(ROOT, 'shared', 'semantic', 'semantic-question.js'));

// canonical 25 个 classify 载体（kbl capability classify ∈ allowedTypes ∩ 权威生成映射 classify→generator:stats）
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
// P28-HOLLOW-01：25 载体在 stats maker 下真实承接的五类 ALLOW 行（无 calc/geometry）
const STATS_FIVE_TYPES = ['fill', 'choice', 'judge', 'apply', 'classify'];

before(() => {
  GenerationCore.inject({ selector: Env.GeneratorSelector, retryLoop, semanticQuestion });
});

async function execCell(kp, questionType, count) {
  return GenerationCore.execute(
    { cells: [{ kpId: kp, questionType, count }] },
    { skipValidation: false }
  );
}

test('C1 运行时绑定 == 权威生成映射（25 载体归 stats，classification 已退役）', () => {
  const mappings = require(path.join(ROOT, 'shared', 'knowledge', 'mappings', 'generation-contract', 'math.json')).mappings;
  const mapKps = mappings
    .filter((r) => r.questionType === 'classify' && r.pluginId === 'generator:stats')
    .map((r) => r.knowledgeId)
    .sort();
  assert.equal(mapKps.length, 25, '权威映射 classify→stats 恰 25 行');
  assert.deepEqual(mapKps, CANONICAL_CLASSIFY_KPS.slice().sort(), '映射 == canonical 载体清单');
  assert.equal(
    mappings.filter((r) => r.pluginId === 'generator:classification').length, 0,
    '映射不得残留 generator:classification'
  );

  assert.equal(Env.GeneratorRegistry.get('generator:classification'), null, 'generator:classification 已退役');
  const record = Env.GeneratorRegistry.get('generator:stats');
  assert.ok(record, '注册表含 generator:stats');
  assert.ok(mapKps.every((id) => record.knowledgePoints.indexOf(id) !== -1), 'stats 绑定覆盖 25 载体');
  STATS_FIVE_TYPES.forEach((t) => {
    assert.ok(record.questionTypes.indexOf(t) !== -1, 'stats 声明题型含 ' + t);
  });
  assert.ok(!LEGACY_LEFT.some((id) => record.knowledgePoints.indexOf(id) !== -1), 'legacy 旧层绑定已清理');

  // 25 载体全部来自 classify 能力声明（allowedTypes 含 classify）
  const capability = require(path.join(ROOT, 'kbl', 'canonical', 'capability.json')).capability;
  const carriers = capability.filter((c) => (c.allowedTypes || []).indexOf('classify') !== -1).map((c) => c.knowledgeId).sort();
  assert.ok(mapKps.every((id) => carriers.indexOf(id) !== -1), '载体 ⊆ 能力声明 classify 集合');
});

test('C2 五类计划：selector 首选 generator:stats（本体绑定 kp=1）', () => {
  STATS_FIVE_TYPES.forEach((qt) => {
    const s = Env.GeneratorSelector.selectGenerator(
      { knowledgePointIds: ['math-g2-up-u01-k001'], questionTypeId: qt, count: 2, constraints: {} },
      { mode: 'native' }
    );
    assert.equal(s.generatorId, 'generator:stats', qt + ' 应首选 stats');
    assert.equal(s.match.kp, 1, qt + ' 本体绑定命中（kp 优先）');
  });
});

test('C3 25 载体 × 5 题型全量真实生成：SUCCESS，题型/KP 精确回显（125 行不越界）', async () => {
  for (const kp of CANONICAL_CLASSIFY_KPS) {
    for (const qt of STATS_FIVE_TYPES) {
      const res = await execCell(kp, qt, 1);
      assert.equal(res.status, 'SUCCESS', kp + ' / ' + qt + ' status=' + res.status);
      assert.equal(res.questions.length, 1, kp + ' / ' + qt + ' 题量');
      const q = res.questions[0];
      assert.equal(q.questionType, qt, kp + ' / ' + qt + ' 题型回显，不越界');
      assert.equal(q.knowledgePointId, kp, kp + ' / ' + qt + ' KP 回显');
      assert.equal(q.metadata && q.metadata.generator, 'generator:stats', kp + ' / ' + qt + ' 由 stats 真实产出');
    }
  }
});

test('C4 反向作用域：25 载体 calc/geometry 在能力端点非 ALLOW（stats 不被触达，五类行不串题型）', () => {
  const KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
  CANONICAL_CLASSIFY_KPS.forEach((kp) => {
    const ev = KCV.buildEligibility([kp], ['calc', 'geometry', 'classify']);
    const m = (ev.matrix && ev.matrix[kp]) || {};
    assert.notEqual(m.calc, 'ALLOW', kp + ' calc 非 ALLOW');
    assert.notEqual(m.geometry, 'ALLOW', kp + ' geometry 非 ALLOW');
    assert.equal(m.classify, 'ALLOW', kp + ' classify 仍 ALLOW');
  });
});
