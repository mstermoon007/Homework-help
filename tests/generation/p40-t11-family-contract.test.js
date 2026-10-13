'use strict';

/**
 * tests/generation/p40-t11-family-contract.test.js — P40-T-11 概念族数据就绪透出契约
 *
 * 冻结断言：familyId/stageOrder 经 knowledge-contract 既有公开口只读可及——
 *   ① get(id).semantic.conceptFamily 返回 {id, stageOrder}（375/375 覆盖）；
 *   ② relationsFor 返回 R-REL-03 边的 evolution{familyId,fromStageOrder,toStageOrder,op}（38/38）；
 *   ③ 不新增 PUBLIC_API（白名单长度与成员冻结不变）；UI 展示不实施（P31 冻结，挂账）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev/_bundle-env.js'));
const K = global.App.KNOWLEDGE;
const Contract = global.App.KNOWLEDGE_CONTRACT;

const EVO_OPS = ['extend_number', 'increase_complexity', 'abstract_up', 'inverse'];

test('P40-T-11 ① get(id).semantic.conceptFamily 覆盖 375/375', () => {
  const allIds = [];
  ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach((g) => {
    K.byGrade(g).forEach((kp) => allIds.push(kp.knowledgeId));
  });
  assert.equal(allIds.length, 375, 'selectable KP = 375');
  let withFamily = 0;
  allIds.forEach((id) => {
    const kp = K.get(id);
    const cf = kp && kp.semantic && kp.semantic.conceptFamily;
    assert.ok(cf && cf.id && Number.isInteger(cf.stageOrder), id + ' 应有 conceptFamily{id,stageOrder}');
    withFamily++;
  });
  assert.equal(withFamily, 375, 'conceptFamily 覆盖率 100%');
});

test('P40-T-11 ② relationsFor 透出 evolution（38/38）', () => {
  const relDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl/canonical/relations.json'), 'utf8'));
  const evo = relDoc.relations.filter((r) => r.evolution);
  assert.equal(evo.length, 38, 'evolution 边 38 条');
  evo.forEach((r) => {
    assert.ok(EVO_OPS.includes(r.evolution.op), 'op 合法: ' + r.evolution.op);
    assert.ok(r.evolution.toStageOrder > r.evolution.fromStageOrder, 'stageOrder 严格递增');
    assert.ok(r.evolution.familyId, 'familyId 非空');
  });
  // 经运行时公开口可及：relationsFor 返回的对象保留 evolution
  const sample = evo[0];
  const got = K.relationsFor(sample.fromId, 'out');
  const found = (got.outgoing || []).filter((x) => x.toId === sample.toId && x.evolution);
  assert.ok(found.length >= 1, 'relationsFor(' + sample.fromId + ') 含带 evolution 的边');
});

test('P40-T-11 ③ 不新增 PUBLIC_API（白名单冻结）', () => {
  const api = Contract.publicApi.slice();
  assert.equal(api.length, 13, 'PUBLIC_API 仍为 13 项');
  assert.ok(!api.includes('familyId') && !api.includes('conceptFamily'), '未新增族相关公开方法');
  ['get', 'relationsFor', 'intentFor', 'contextLibrary', 'misconceptionsFor'].forEach((m) => {
    assert.ok(api.includes(m), '既有口保留: ' + m);
  });
});
