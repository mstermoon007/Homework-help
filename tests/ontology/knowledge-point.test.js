const test = require('node:test');
const assert = require('node:assert');
const KnowledgeBank = require('../../shared/knowledge-bank.js');
const Ontology = require('../../shared/knowledge-ontology.js');
const KP = require('../../shared/knowledge-point.js');

function countAll() {
  let total = 0;
  Ontology.SUBJECTS.forEach(function (s) {
    const arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function () { total++; });
      });
    });
  });
  return total;
}

test('574 KP 真实 math/cn/en 均可归一化', () => {
  assert.strictEqual(countAll(), 574);
});

test('get 返回标准 Canonical KnowledgePoint（5 类齐全）', () => {
  const c = KP.get('math-g1-m0-make-ten');
  assert.ok(c);
  assert.strictEqual(c.id, 'math-g1-m0-make-ten');
  assert.ok(c.identity && c.identity.name);
  assert.ok(Array.isArray(c.knowledge.operations));
  assert.ok(c.knowledge.factualContent && typeof c.knowledge.factualContent === 'object');
  assert.ok(Array.isArray(c.knowledge.prerequisites));
  assert.ok(c.spiral && typeof c.spiral.level === 'number');
  assert.ok(c.cognition && typeof c.cognition.level === 'number');
  assert.ok(Array.isArray(c.presentation.questionTypes));
  assert.ok(Array.isArray(c.errors));
  assert.ok(c.generation && Array.isArray(c.generation.capabilities));
});

test('Legacy → Canonical，不修改 Legacy 原对象', () => {
  const legacy = KP.findLegacy('math-g1-m0-make-ten');
  const before = JSON.stringify(legacy);
  const c = Ontology.normalize(legacy);
  assert.strictEqual(JSON.stringify(legacy), before);
  assert.notStrictEqual(c, legacy);
});

test('重复调用结果一致（无 Math.random）', () => {
  const a = JSON.stringify(KP.get('math-g1-m0-make-ten'));
  const b = JSON.stringify(KP.get('math-g1-m0-make-ten'));
  assert.strictEqual(a, b);
});

test('未知 id 返回 null', () => {
  assert.strictEqual(KP.get('__no_such_kp__'), null);
});

test('real cn / en 也能归一化', () => {
  assert.ok(KP.get('cn-g1-n1-pinyin-basic'));
  assert.ok(KP.get('en-g3-e1-letter-recognition'));
});
