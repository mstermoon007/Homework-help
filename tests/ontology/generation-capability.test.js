const test = require('node:test');
const assert = require('node:assert');
const Ontology = require('../../shared/knowledge-ontology.js');
const Schema = require('../../shared/schemas/knowledge-point.schema.js');

function capsOf(legacy) {
  return Ontology.normalize(legacy).generation.capabilities;
}

test('capability 仅来自既有数据（questionType -> capability）', () => {
  const caps = capsOf({ id: 'x', name: 'X', applicable_question_types: [{ type: 'calc' }] });
  const ids = caps.map((c) => c.id);
  assert.ok(ids.indexOf('calculation') !== -1);
  caps.forEach((c) => assert.ok(Schema.isKnownCapability(c.id), '未知 capability: ' + c.id));
});

test('multi-step 当 max_steps_default > 1', () => {
  const caps = capsOf({ id: 'x', name: 'X', max_steps_default: 3 });
  const ids = caps.map((c) => c.id);
  assert.ok(ids.indexOf('multi-step') !== -1);
  assert.ok(ids.indexOf('single-step') === -1);
});

test('single-step 当 max_steps_default <= 1', () => {
  const caps = capsOf({ id: 'x', name: 'X', max_steps_default: 1 });
  const ids = caps.map((c) => c.id);
  assert.ok(ids.indexOf('single-step') !== -1);
  assert.ok(ids.indexOf('multi-step') === -1);
});

test('type 也能推导 capability', () => {
  const caps = capsOf({ id: 'x', name: 'X', type: 'choice' });
  assert.ok(caps.map((c) => c.id).indexOf('choice') !== -1);
});

test('每个 capability 带合法 type 分组', () => {
  const caps = capsOf({ id: 'x', name: 'X', applicable_question_types: [{ type: 'fill' }, { type: 'apply' }] });
  caps.forEach((c) => {
    assert.ok(c.type && typeof c.type === 'string');
    assert.strictEqual(Schema.CAPABILITIES[c.id].type, c.type);
  });
});

test('严禁写入生成器/策略引用', () => {
  const c = Ontology.normalize({ id: 'x', name: 'X' });
  assert.strictEqual(c.generation.generateFunction, undefined);
  assert.strictEqual(c.generation.generator, undefined);
  assert.strictEqual(c.generation.pluginFunction, undefined);
  assert.strictEqual(c.generation.strategy, undefined);
  assert.strictEqual(c.generation.difficultyStrategy, undefined);
});
