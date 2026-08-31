const test = require('node:test');
const assert = require('node:assert');
const Ops = require('../../shared/knowledge-operation.js');
const OpsMap = require('../../shared/ontology-operation-map.js');
const Ontology = require('../../shared/knowledge-ontology.js');

test('canonical operation', () => {
  const r = Ops.normalize('multiply');
  assert.strictEqual(r.canonical, 'multiply');
  assert.strictEqual(r.status, 'canonical');
});

test('alias', () => {
  assert.strictEqual(Ops.normalize('addition').canonical, 'add');
  assert.strictEqual(Ops.normalize('plus').canonical, 'add');
  assert.strictEqual(Ops.normalize('除法').canonical, 'divide');
});

test('unknown -> unresolved', () => {
  const r = Ops.normalize('foo-operation');
  assert.strictEqual(r.canonical, null);
  assert.strictEqual(r.status, 'unresolved');
});

test('null -> unresolved', () => {
  assert.strictEqual(Ops.normalize(null).status, 'unresolved');
  assert.strictEqual(Ops.normalize('').status, 'unresolved');
});

test('alias 无循环', () => {
  assert.strictEqual(Ops.hasAliasCycle(), false);
});

test('normalizer 填充 canonical operations', () => {
  const c = Ontology.normalize({ id: 'math-g1-multiplication-table', name: '表内乘法', pluginId: 'math-g1-multiplication-table' });
  assert.deepStrictEqual(c.knowledge.operations, ['multiply']);
});

test('normalizer 去重 operation', () => {
  const c = Ontology.normalize({ id: 'x', name: 'X', pluginId: 'math-make-ten', operations: ['add', 'add', 'subtract'] });
  assert.deepStrictEqual(c.knowledge.operations, ['add', 'subtract']);
});

test('plugin 映射全部 canonical', () => {
  const ids = Object.keys(OpsMap.MAP);
  ids.forEach(function (pid) {
    OpsMap.operationsForPlugin(pid).forEach(function (o) {
      assert.ok(Ops.isCanonical(o), pid + ' -> ' + o + ' 非 canonical');
    });
  });
});

test('comprehensive 插件 unresolved（不猜测）', () => {
  assert.deepStrictEqual(OpsMap.operationsForPlugin('math-comprehensive'), []);
  assert.deepStrictEqual(OpsMap.operationsForPlugin('chinese-comprehensive'), []);
});
