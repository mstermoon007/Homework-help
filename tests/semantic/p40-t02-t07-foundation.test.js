'use strict';

/**
 * tests/semantic/p40-t02-t07-foundation.test.js — P40 战役二地基任务验收断言（T-02~T-07）
 *
 * 补录（P40-FINAL）：T-02/T-03/T-04/T-05/T-06/T-07 此前仅由派生器内联断言 + T-12 回归基线间接覆盖，
 * 无独立测试文件。本测试对六个地基任务的验收判据逐条冻结：
 *   T-02 族表声明化：validateFamilyTable 通过；11 主干 + 14 扩展，familyId/name 唯一；computeStageOrders 全序唯一。
 *   T-03 T2 副本自检：kbl/teaching ↔ shared/knowledge/teaching 镜像逐字节一致（漂移即失败）。
 *   T-04 evolution：38/38 边带合法 evolution（op∈闭集、stageOrder 严格递增、familyId 非空）；validateEvolution 通过。
 *   T-05 capability 回填：375/375 带 familyId + stageOrder；manifest.rootHash 为 64 位十六进制。
 *   T-06 跨族前置投影：reportCrossFamily 返回族内/跨族计数与族间边；intra+cross=全部边；KP 级图无环。
 *   T-07 族内难度递进：validateFamilyDifficultyMonotonic 检出 54 处倒挂（挂 needs-review，不自动改数）。
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
  assert.equal(DR.CONCEPT_FAMILIES.length, 11, '主干族 11 条');
  assert.equal(Object.keys(DR.EXTRA_FAMILIES).length, 14, '扩展族 14 条');

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

test('T-04 evolution：38/38 边合法 + validateEvolution 无环通过', () => {
  const evo = rels.filter((r) => r.evolution);
  assert.equal(evo.length, 38, 'evolution 边 38 条');
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
  assert.equal(Object.keys(rep.familyEdges).length, 61, '族间边 61 条');
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

test('T-07 族内难度递进：现网检出 54 处倒挂（needs-review）+ 合成倒挂可被判出', () => {
  const rows = cap.map((c) => ({ knowledgeId: c.knowledgeId, familyId: c.familyId, stageOrder: c.stageOrder, seedDifficulty: c.seedDifficulty }));
  const res = DiffVal.validateFamilyDifficultyMonotonic(rows);
  assert.equal(res.checked, 375, '扫描 375 行');
  assert.equal(res.violations.length, 54, '现网倒挂 54 处（与 T-07 扫描脚本一致）');
  assert.equal(res.valid, false, '存在倒挂 → valid=false（挂 needs-review 不自动改数）');
  const artifact = json('dev/p40/out/t07-family-difficulty.json');
  assert.equal(artifact.violations, res.violations.length, '扫描产物与校验器一致');

  const synth = DiffVal.validateFamilyDifficultyMonotonic([
    { knowledgeId: 'a', familyId: 'x', stageOrder: 1, seedDifficulty: 3 },
    { knowledgeId: 'b', familyId: 'x', stageOrder: 2, seedDifficulty: 2 }
  ]);
  assert.equal(synth.violations.length, 1, '合成倒挂被检出');
});
