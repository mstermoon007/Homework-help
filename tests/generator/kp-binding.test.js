'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const GenRegistry = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
const KnowledgePoint = require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-point.js'));

test('M4-R12：enhanceKp 注入 capabilities（MATH-14：legacyPluginId 随 legacy 轨道退役）', () => {
  const kp = GenRegistry.enhanceKp(KnowledgePoint.get('math-g1-m0-make-ten'));
  assert.ok(Array.isArray(kp.capabilities) && kp.capabilities.length > 0, 'capabilities 非空');
  assert.ok(kp.capabilities.includes('calc'), '含 calc 能力');
  assert.strictEqual(kp.legacyPluginId, undefined);
});

test('M4-R12：capabilities 与 Generator Registry 一致（KP → Generator → capability）', () => {
  const kp = GenRegistry.enhanceKp(KnowledgePoint.get('math-g1-m0-make-ten'));
  const gens = GenRegistry.forKnowledgePoint(kp.id);
  assert.ok(gens.length > 0);
  // 每个 capability 都对应至少一个 Generator 的类型/能力
  kp.capabilities.forEach(cap => {
    const match = GenRegistry.forQuestionType(cap);
    assert.ok(match.length > 0, 'capability ' + cap + ' 无 Generator 支持');
  });
});

test('M4-R12：不修改 KnowledgeBank 原始对象（只读增强）', () => {
  const KB = require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-bank.js'));
  const O = require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-ontology.js'));
  const before = O.normalize(KnowledgePoint.get('math-g1-m0-make-ten'));
  GenRegistry.enhanceKp(KnowledgePoint.get('math-g1-m0-make-ten'));
  const after = O.normalize(KnowledgePoint.get('math-g1-m0-make-ten'));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(before)), JSON.parse(JSON.stringify(after)));
});

test('M4-R12：无 Generator 绑定 KP 回退解析链 capability', () => {
  // cn/en 占位 KP 已随 P0-16 剔除；构造「无 Generator 绑定」的 math KP 验证回退解析链：
  // MATH-14 后无 legacy 绑定概念，capabilities 由 Generator/CapabilityResolver 解析
  const kp = GenRegistry.enhanceKp({
    id: 'math-g1-m0-make-ten',
    source: { pluginId: null }
  });
  assert.ok(Array.isArray(kp.capabilities) && kp.capabilities.length > 0);
  assert.strictEqual(kp.legacyPluginId, undefined);
});
