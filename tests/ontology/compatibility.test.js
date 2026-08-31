const test = require('node:test');
const assert = require('node:assert');
const O = require('../../shared/knowledge-ontology.js');
const KB = require('../../shared/knowledge-bank.js');

test('normalize 不修改原 KnowledgeBank 对象', () => {
  const kp = KB.math[0].modules[0].knowledgePoints[0];
  const snapshot = JSON.stringify(kp);
  O.normalize(kp);
  assert.strictEqual(JSON.stringify(kp), snapshot);
});

test('Legacy KnowledgeBank API 不变', () => {
  assert.ok(Array.isArray(KB.getEntries('math', 1)));
  assert.ok(KB.findGrade('math', 1));
  const e = KB.getEntries('math', 1);
  assert.ok(e.length > 0);
  assert.ok(e.every(function (x) { return 'id' in x && 'name' in x && 'pluginId' in x; }));
});

test('ontology 归一化不破坏现有 API 返回值', () => {
  const entries = KB.getEntries('math', 1);
  entries.forEach(function (e) { O.normalize(e); });
});
