const test = require('node:test');
const assert = require('node:assert');
const ErrOnt = require('../../shared/knowledge-error.js');
const ErrMap = require('../../shared/ontology-error-map.js');
const Ontology = require('../../shared/knowledge-ontology.js');

test('合法 string error', () => {
  assert.strictEqual(ErrOnt.validate(['unit-confusion']).valid, true);
});

test('合法 object error', () => {
  const r = ErrOnt.validate([{ id: 'unit-confusion', category: 'unit', description: '单位混淆' }]);
  assert.strictEqual(r.valid, true);
});

test('canonical error 来自 map', () => {
  const errs = ErrMap.errorsForPlugin('math-money');
  assert.strictEqual(ErrOnt.validate(errs).valid, true);
  assert.strictEqual(errs[0].id, 'unit-confusion');
});

test('别名对象归一到 canonical', () => {
  const r = ErrOnt.validate([{ id: 'unit-confusion', category: 'unit', description: 'x' }]);
  assert.strictEqual(r.valid, true);
});

test('unknown category = 非法', () => {
  const r = ErrOnt.validate([{ id: 'foo-bar', category: 'nope', description: 'x' }]);
  assert.strictEqual(r.valid, false);
});

test('duplicate id = 非法', () => {
  const r = ErrOnt.validate(['unit-confusion', 'unit-confusion']);
  assert.strictEqual(r.valid, false);
});

test('empty description = 非法', () => {
  const r = ErrOnt.validate([{ id: 'foo-bar', category: 'unit', description: '' }]);
  assert.strictEqual(r.valid, false);
});

test('plugin 依赖 id 非法', () => {
  assert.strictEqual(ErrOnt.isValidId('math-g1-error-001'), false);
  assert.strictEqual(ErrOnt.isValidId('question-123-error'), false);
});

test('空 errors 合法', () => {
  assert.strictEqual(ErrOnt.validate([]).valid, true);
});

test('normalizer 注入 errors', () => {
  const c = Ontology.normalize({ id: 'x', name: 'X', pluginId: 'math-g2-column' });
  assert.ok(c.errors.some(function (e) { return e.id === 'carry-omission'; }));
  const c2 = Ontology.normalize({ id: 'y', name: 'Y', pluginId: 'math-comprehensive' });
  assert.deepStrictEqual(c2.errors, []);
});
