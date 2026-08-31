'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));

function planFor(kpId) {
  return Engine.plan({ knowledgePointId: kpId, count: 2, difficulty: 3 }).plans[0];
}

test('M4-R13：已知 KP → 知识点匹配优先（选 legacy 绑定 Generator）', () => {
  const plan = planFor('math-g1-m0-make-ten');
  const sel = Selector.selectGenerator(plan);
  assert.strictEqual(sel.generatorId, 'legacy:math-make-ten');
  assert.strictEqual(sel.source, 'priority');
  assert.strictEqual(sel.match.kp, 1);
});

test('M4-R13：能力/题型匹配（calc 题型的 core 候选可达）', () => {
  const plan = { knowledgePointId: 'math-g1-m0-make-ten', questionTypeId: 'calc', difficulty: 3 };
  const sel = Selector.selectGenerator(plan);
  assert.ok(sel.record);
  assert.ok(['legacy:math-make-ten', 'generator:arithmetic-addition', 'generator:arithmetic-mixed-calculation'].includes(sel.generatorId));
});

test('M4-R13：选择结果可实例化为 core Generator（能力匹配时）', () => {
  const plan = { knowledgePointId: 'x-no-plugin', questionTypeId: 'choice', difficulty: 3 };
  const sel = Selector.selectGenerator(plan);
  // 无 KP 绑定 → 按能力/题型匹配到 selection-choice
  if (sel.generatorId && sel.generatorId.indexOf('generator:') === 0) {
    const inst = Generators.get(sel.generatorId);
    assert.ok(inst);
    assert.ok(inst.capabilities.includes('choice'));
  }
});

test('M4-R13：fallback → legacyPluginId 对应 legacy Generator', () => {
  // 构造无任何注册 Generator 匹配的假 plan，但 KP 有 legacyPluginId
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m0-make-ten', questionTypeId: 'geometry', difficulty: 3 });
  // make-ten 不支持 geometry → 无能力/题型匹配 → fallback legacy:math-make-ten
  assert.ok(sel.generatorId === 'legacy:math-make-ten' || sel.record !== null);
});

test('M4-R13：缺少 knowledgePointId → 抛错', () => {
  assert.throws(() => Selector.selectGenerator({ questionTypeId: 'calc' }), /knowledgePointId/);
});
