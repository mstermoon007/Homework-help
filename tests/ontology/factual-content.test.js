const test = require('node:test');
const assert = require('node:assert');
const FactOnt = require('../../shared/knowledge-factual.js');
const FactMap = require('../../shared/ontology-factual-map.js');
const Ontology = require('../../shared/knowledge-ontology.js');

test('合法 formula / unit / vocabulary', () => {
  assert.strictEqual(FactOnt.validate({ formula: 'a^2+b^2=c^2' }).valid, true);
  assert.strictEqual(FactOnt.validate({ units: ['cm', 'm'] }).valid, true);
});

test('空 factualContent 合法', () => {
  assert.strictEqual(FactOnt.validate({}).valid, true);
  assert.strictEqual(FactOnt.validate(null).valid, true);
});

test('策略字段混入 = 非法', () => {
  const r = FactOnt.validate({ questionCount: 10 });
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some(function (e) { return /策略字段/.test(e); }));
});

test('未知 fact type 仅 WARNING，不阻断', () => {
  const r = FactOnt.validate({ madeUpField: 1 });
  assert.strictEqual(r.valid, true);
  assert.ok(r.warnings.length > 0);
});

test('map 仅输出合法 factualContent', () => {
  Object.keys(FactMap.MAP).forEach(function (pid) {
    const fc = FactMap.factualForPlugin(pid);
    assert.strictEqual(FactOnt.validate(fc).valid, true, pid + ' 含非法事实');
  });
});

test('normalizer 注入 factualContent', () => {
  const c = Ontology.normalize({ id: 'math-g1-multiplication-table', name: '表', pluginId: 'math-g1-multiplication-table' });
  assert.deepStrictEqual(c.knowledge.factualContent, { table: '1-9' });
  const c2 = Ontology.normalize({ id: 'x', name: 'X', pluginId: 'math-comprehensive' });
  assert.deepStrictEqual(c2.knowledge.factualContent, {});
});
