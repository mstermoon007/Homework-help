const test = require('node:test');
const assert = require('node:assert');
const O = require('../../shared/knowledge-ontology.js');
const KB = require('../../shared/knowledge-bank.js');

function findRaw(subject, id) {
  const arr = KB[subject];
  if (!Array.isArray(arr)) return null;
  for (const g of arr) {
    for (const m of (g.modules || [])) {
      for (const kp of (m.knowledgePoints || [])) {
        if (kp.id === id) return kp;
      }
    }
  }
  return null;
}

test('math: Legacy -> Canonical 映射', () => {
  const legacy = {
    id: 'math-g2-m1-mult-table',
    name: '表内乘法',
    pluginId: 'math-multiplication-table',
    weight: 3,
    type: 'oral',
    spiral_level: 2,
    max_spiral_level: 3,
    cognitive_level: '掌握',
    applicable_question_types: [{ type: 'oral', coefficient: 0.6 }],
    number_range_default: { min: 1, max: 9 },
    max_steps_default: 1,
    context_default: 'standard',
    description: '表内乘法'
  };
  const c = O.normalize(legacy);
  assert.strictEqual(c.id, 'math-g2-m1-mult-table');
  assert.strictEqual(c.subject, 'math');
  assert.strictEqual(c.grade, 2);
  assert.strictEqual(c.module.id, 'm1');
  assert.strictEqual(c.module.name, '口算练习');
  assert.strictEqual(c.identity.name, '表内乘法');
  assert.strictEqual(c.source.pluginId, 'math-multiplication-table');
  assert.strictEqual(c.source.legacyType, 'oral');
  assert.strictEqual(c.cognition.level, 0.67);
  assert.strictEqual(c.cognition.raw, '掌握');
  assert.strictEqual(c.structure.maxSteps, 1);
  assert.strictEqual(c.presentation.questionTypes.length, 1);
  assert.strictEqual(c.presentation.questionTypes[0].type, 'operate');
  assert.strictEqual(c.presentation.questionTypes[0].weight, 0.6);
  assert.deepStrictEqual(c.numeric.range, { min: 1, max: 9 });
  assert.deepStrictEqual(c.context.defaults, ['standard']);
  assert.strictEqual(c.spiral.level, 2);
  assert.strictEqual(c.spiral.maxLevel, 3);
  assert.strictEqual(c.metadata.weight, 3);
});

test('math: 确定性（同输入同输出）', () => {
  const legacy = {
    id: 'math-g1-m0-make-ten', name: '凑十法', pluginId: 'math-make-ten', weight: 1, type: 'cushi',
    spiral_level: 1, max_spiral_level: 1, cognitive_level: '掌握',
    applicable_question_types: [{ type: 'cushi', coefficient: 1 }],
    number_range_default: { min: 1, max: 20 }, max_steps_default: 2, context_default: 'standard'
  };
  assert.deepStrictEqual(O.normalize(legacy), O.normalize(legacy));
});

test('chinese: 真实 KB entry', () => {
  const raw = findRaw('cn', 'cn-g1-n1-pinyin-basic');
  assert.ok(raw, 'cn-g1-n1-pinyin-basic 应存在');
  const c = O.normalize(raw);
  assert.strictEqual(c.subject, 'cn');
  assert.strictEqual(c.grade, 1);
  assert.strictEqual(c.module.id, 'n1');
  assert.strictEqual(c.identity.name, raw.name);
  assert.strictEqual(c.cognition.level, 0.67);
  assert.strictEqual(c.cognition.raw, '掌握');
});

test('english: 真实 KB entry', () => {
  const raw = findRaw('en', 'en-g3-e1-letter-recognition');
  assert.ok(raw, 'en-g3-e1-letter-recognition 应存在');
  const c = O.normalize(raw);
  assert.strictEqual(c.subject, 'en');
  assert.strictEqual(c.grade, 3);
  assert.strictEqual(c.module.id, 'e1');
});
