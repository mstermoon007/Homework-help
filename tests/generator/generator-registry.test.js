'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const GenRegistry = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
const QuestionRegistry = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
const KnowledgePoint = require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-point.js'));

test('Registry 非空且全部含必填声明字段', () => {
  const records = GenRegistry.all();
  assert.ok(records.length > 0);
  records.forEach(r => {
    assert.ok(typeof r.id === 'string' && (r.id.indexOf('legacy:') === 0 || r.id.indexOf('generator:') === 0));
    assert.ok(typeof r.subject === 'string');
    assert.ok(Array.isArray(r.capabilities));
    assert.ok(Array.isArray(r.questionTypes));
    assert.ok(Array.isArray(r.knowledgePoints));
    assert.ok(r.scope === 'legacy' || r.scope === 'core');
    assert.strictEqual(typeof r.version, 'number');
  });
});

test('无重复 Generator ID', () => {
  const ids = GenRegistry.all().map(r => r.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('无非法 capability（全部来自 QuestionType Registry）', () => {
  GenRegistry.all().forEach(r => {
    r.capabilities.forEach(c => assert.ok(QuestionRegistry.has(c), r.id + ' :: ' + c));
    r.questionTypes.forEach(c => assert.ok(QuestionRegistry.has(c), r.id + ' :: ' + c));
  });
});

test('禁止保存执行函数源码（JSON 可序列化）', () => {
  const records = GenRegistry.all();
  const roundTrip = JSON.parse(JSON.stringify(records));
  assert.deepStrictEqual(roundTrip, records);
});

test('KnowledgePoint → Capability → Generator 查询关系', () => {
  // MATH-14：legacy 轨道已删，改查一个由 core 显式绑定的 KP
  const chain = GenRegistry.resolveChain('math-g1-m1-addsub-5');
  assert.ok(chain);
  assert.strictEqual(chain.knowledgePointId, 'math-g1-m1-addsub-5');
  assert.ok(chain.capabilityQuestionTypes.length > 0);
  assert.ok(chain.generators.includes('generator:arithmetic-addition'));
  assert.ok(!chain.generators.some(g => g.indexOf('legacy:') === 0));
});

test('forKnowledgePoint 返回服务该 KP 的 Generator（仅 core）', () => {
  const gens = GenRegistry.forKnowledgePoint('math-g1-m1-addsub-5');
  assert.ok(gens.some(g => g.id === 'generator:arithmetic-addition'));
  assert.ok(gens.every(g => g.knowledgePoints.includes('math-g1-m1-addsub-5')));
  assert.ok(gens.every(g => g.scope === 'core'));
});

test('forQuestionType 返回具备该题型的 Generator', () => {
  const gens = GenRegistry.forQuestionType('calc');
  assert.ok(gens.length > 0);
  assert.ok(gens.every(g => g.questionTypes.includes('calc')));
});

test('MATH-14：注册表仅含 native core，无任何 legacy 记录', () => {
  const records = GenRegistry.all();
  assert.ok(records.length > 0);
  assert.strictEqual(records.filter(r => r.scope === 'legacy' || r.id.indexOf('legacy:') === 0).length, 0);
  assert.ok(records.every(r => r.scope === 'core' && r.id.indexOf('generator:') === 0));
});

test('get(id) 与 all() 一致', () => {
  const r = GenRegistry.all()[0];
  assert.deepStrictEqual(GenRegistry.get(r.id), r);
  assert.strictEqual(GenRegistry.get('legacy:not-exist'), null);
});
