const test = require('node:test');
const assert = require('node:assert');
const O = require('../../shared/knowledge-ontology.js');

test('VERSION / schemaVersion', () => {
  assert.strictEqual(O.VERSION, 1);
  assert.strictEqual(O.schemaVersion(), 1);
});

test('create 默认值', () => {
  const c = O.create();
  assert.strictEqual(c.id, '');
  assert.strictEqual(c.subject, null);
  assert.strictEqual(c.grade, null);
  assert.deepStrictEqual(c.module, { id: '', name: '' });
  assert.strictEqual(c.structure.minSteps, 1);
  assert.strictEqual(c.structure.maxSteps, 1);
  assert.strictEqual(c.numeric.integerOnly, true);
  assert.strictEqual(c.numeric.decimalPlaces, 0);
  assert.strictEqual(c.metadata.version, 1);
  assert.deepStrictEqual(c.knowledge.operations, []);
  assert.deepStrictEqual(c.knowledge.factualContent, {});
  assert.deepStrictEqual(c.generation.capabilities, []);
});

test('create 覆盖字段并保留嵌套默认', () => {
  const c = O.create({ id: 'x', subject: 'math', grade: 2, structure: { maxSteps: 3 } });
  assert.strictEqual(c.id, 'x');
  assert.strictEqual(c.subject, 'math');
  assert.strictEqual(c.grade, 2);
  assert.strictEqual(c.structure.maxSteps, 3);
  assert.strictEqual(c.structure.minSteps, 1);
  assert.strictEqual(c.numeric.integerOnly, true);
});

test('create 不修改入参', () => {
  const input = { id: 'x', structure: { maxSteps: 5 } };
  const before = JSON.stringify(input);
  O.create(input);
  assert.strictEqual(JSON.stringify(input), before);
});
