'use strict';

/**
 * tests/semantic/p40-t02-t07-foundation.test.js — P40 战役二地基任务验收断言（T-02~T-07）
 *
 * 补录（P40-FINAL）：T-02/T-03/T-04/T-05/T-06/T-07 此前仅由派生器内联断言 + T-12 回归基线间接覆盖，
 * 无独立测试文件。本测试对六个地基任务的验收判据逐条冻结：
 *   T-02 族表声明化：validateFamilyTable 通过；14 主干 + 11 扩展，familyId/name 唯一；computeStageOrders 全序唯一。
 *   T-03 T2 副本自检：kbl/teaching ↔ shared/knowledge/teaching 镜像逐字节一致（漂移即失败）。
 *   T-04 evolution：44/44 边带合法 evolution（op∈闭集、stageOrder 严格递增、familyId 非空）；validateEvolution 通过。
 *   T-05 capability 回填：375/375 带 familyId + stageOrder；manifest.rootHash 为 64 位十六进制。
 *   T-06 跨族前置投影：reportCrossFamily 返回族内/跨族计数与族间边；intra+cross=全部边；KP 级图无环。
 *   T-07 族内难度偏离：progressLevel 派生覆盖 375/375；validateFamilyDifficultyMonotonic 按
 *        「seedDifficulty < progressLevel（期望下界）」检出 126 处偏离（挂 needs-review，不自动改数）。
 *        P44 H10 前口径为局部相邻倒挂 53 处；P44 T-07 改全局期望下界口径后为 126 处（原 53 为其子集）。
 *   P44/H10-C：fam_direction 升主干链（g2 上→g4 上→g6 上）且 R-REL-02 取消综合实践/复习单元排除，
 *   族表 13/12→14/11、evolution 42→44、族间边 60→82（倒挂 53 未变）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
const json = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const DR = require(path.join(ROOT, 'tools', 'kbl', 'derive-relations.js'));
const DiffVal = require(path.join(ROOT, 'shared', 'validator', 'difficulty-integrity-validator.js'));

const knowledge = json('kbl/canonical/knowledge.json').knowledge;
const rels = json('kbl/canonical/relations.json').relations;
const cap = json('kbl/canonical/capability.json').capability;
const EVO_OPS = ['extend_number', 'increase_complexity', 'abstract_up', 'inverse'];

test('T-02 族表声明化：validateFamilyTable 通过 + 族名/ID 唯一 + stageOrder 全序唯一', () => {
  assert.doesNotThrow(() => DR.validateFamilyTable(), '族表语义合法（同名多族/重复 ID/op 非法一律抛错）');
  assert.equal(DR.CONCEPT_FAMILIES.length, 14, '主干族 14 条');
  assert.equal(Object.keys(DR.EXTRA_FAMILIES).length, 11, '扩展族 11 条');

  const orders = DR.computeStageOrders(knowledge);
  const ids = Object.keys(orders);
  assert.equal(ids.length, 375, 'stageOrder 覆盖 375 KP');
  const perFamily = {};
  ids.forEach((id) => {
    const o = orders[id];
    assert.ok(o.familyId && Number.isInteger(o.stageOrder) && o.stageOrder >= 1, id + ' 应有 {familyId,stageOrder≥1}');
    const key = o.familyId + '#' + o.stageOrder;
    assert.ok(!perFamily[key], '族内 stageOrder 不得并列: ' + key);
    perFamily[key] = 1;
  });
  knowledge.forEach((kp) => assert.ok(DR.classifyFamily(kp), kp.id + ' 有归类'));
});

test('T-03 T2 副本自检：kbl/teaching ↔ shared/knowledge/teaching 镜像逐字节一致', () => {
  ['misconception-profiles.json', 'context-library.json'].forEach((f) => {
    const a = JSON.stringify(json('kbl/teaching/' + f));
    const b = JSON.stringify(json('shared/knowledge/teaching/' + f));
    assert.equal(a, b, f + ' 两副本必须一致（漂移即需 kbl:build 重冻）');
  });
});

test('T-04 evolution：44/44 边合法 + validateEvolution 无环通过', () => {
  const evo = rels.filter((r) => r.evolution);
  assert.equal(evo.length, 44, 'evolution 边 44 条');
  evo.forEach((r) => {
    assert.ok(DR.CONCEPT_FAMILIES.some((f) => f.familyId === r.evolution.familyId), 'familyId 属主干族: ' + r.evolution.familyId);
    assert.ok(EVO_OPS.includes(r.evolution.op), 'op 合法: ' + r.evolution.op);
    assert.ok(r.evolution.toStageOrder > r.evolution.fromStageOrder, 'stageOrder 严格递增');
  });
  assert.doesNotThrow(() => DR.validateEvolution(rels, knowledge, DR.computeStageOrders(knowledge)), 'evolution 图/年级无倒置、无环');
});

test('T-05 capability 回填：375/375 familyId+stageOrder + manifest rootHash 合法', () => {
  assert.equal(cap.length, 375, 'capability 375 行');
  const withFam = cap.filter((c) => c.familyId && Number.isInteger(c.stageOrder)).length;
  assert.equal(withFam, 375, 'familyId+stageOrder 覆盖率 100%');
  const rootHash = json('kbl/manifest/manifest.json').rootHash;
  assert.match(String(rootHash), /^[0-9a-f]{64}$/, 'manifest rootHash 为 64 位十六进制');
});

test('T-06 跨族前置投影：intra+cross=全部边 + 族间边 + KP 级图无环', () => {
  const rep = DR.reportCrossFamily(rels, knowledge);
  assert.equal(rep.intra + rep.cross, rels.length, '族内+跨族=全部前置边');
  assert.equal(Object.keys(rep.familyEdges).length, 82, '族间边 82 条（P44/H10-C 方向与位置升主干链后 60→82）');
  assert.equal(typeof rep.acyclic, 'boolean', '族间图无环标志存在');

  const adj = {}, indeg = {}, nodes = {};
  rels.forEach((r) => {
    nodes[r.fromId] = 1; nodes[r.toId] = 1;
    (adj[r.fromId] = adj[r.fromId] || []).push(r.toId); indeg[r.toId] = (indeg[r.toId] || 0) + 1;
    if (indeg[r.fromId] == null) indeg[r.fromId] = 0;
  });
  const q = Object.keys(nodes).filter((n) => !indeg[n]); let vis = 0;
  while (q.length) { const n = q.shift(); vis++; (adj[n] || []).forEach((m) => { if (--indeg[m] === 0) q.push(m); }); }
  assert.equal(vis, Object.keys(nodes).length, 'KP 级前置图无环');
});

test('T-07 族内难度偏离：progressLevel 覆盖 375 + 现网偏离 126 处（needs-review）+ 真实消费 progressLevel', () => {
  assert.equal(cap.filter((c) => c.progressLevel != null).length, 375, 'progressLevel 派生覆盖 375/375');
  const rows = cap.map((c) => ({ knowledgeId: c.knowledgeId, grade: c.grade, familyId: c.familyId, stageOrder: c.stageOrder, seedDifficulty: c.seedDifficulty, progressLevel: c.progressLevel }));
  const res = DiffVal.validateFamilyDifficultyMonotonic(rows);
  assert.equal(res.checked, 375, '扫描 375 行');
  assert.equal(res.violations.length, 126, '现网偏离期望下界 126 处（全局口径，含局部相邻倒挂 53）');
  assert.equal(res.valid, false, '存在偏离 → valid=false（挂 needs-review 不自动改数）');
  res.violations.forEach((v) => {
    assert.ok(v.seedDifficulty < v.progressLevel, v.knowledgeId + ' 违规行必然低于期望下界');
    assert.equal(v.difficultyDelta, v.seedDifficulty - v.progressLevel, 'difficultyDelta 为负偏离');
  });
  const artifact = json('dev/p40/out/t07-family-difficulty.json');
  assert.equal(artifact.violations, res.violations.length, '扫描产物与校验器一致');

  // 真实消费证据：携带 progressLevel 时按字段判定（邻接口径下第 3 行不会告警）
  const synth = DiffVal.validateFamilyDifficultyMonotonic([
    { knowledgeId: 'a', familyId: 'x', stageOrder: 1, seedDifficulty: 6, progressLevel: 6 },
    { knowledgeId: 'b', familyId: 'x', stageOrder: 2, seedDifficulty: 6, progressLevel: 6 },
    { knowledgeId: 'c', familyId: 'x', stageOrder: 3, seedDifficulty: 6, progressLevel: 7 }
  ]);
  assert.equal(synth.violations.length, 1, 'progressLevel=7 时 seed 6 被检出（仅邻接比较不会）');
  assert.equal(synth.violations[0].knowledgeId, 'c', '命中偏离行 c');
});
