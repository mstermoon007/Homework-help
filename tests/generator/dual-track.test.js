'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Mode = require(path.join(ROOT, 'shared', 'generator', 'generator-mode.js'));
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));

function planFor(kpId) {
  return Engine.plan({ knowledgePointId: kpId, count: 2, difficulty: 3 }).plans[0];
}

test('M4-R14 P2：native 模式 → 只选 core，无候选回退 legacy', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  // math-oral KP 有 core arithmetic 能力 → 选中 core
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(sel.record.scope, 'core');
  assert.strictEqual(sel.mode, 'native');
  // 无 core 候选（make-ten review）→ fallback legacy
  const sel2 = Selector.selectGenerator({ knowledgePointId: 'math-g1-m0-make-ten', questionTypeId: 'review', difficulty: 3 });
  assert.strictEqual(sel2.source, 'fallback:legacy');
  assert.strictEqual(sel2.generatorId, 'legacy:math-make-ten');
});

test('M4-R14 P2：hybrid 模式 → 双轨并轨，KP 绑定优先', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  const plan = planFor('math-g1-m0-make-ten');
  const sel = Selector.selectGenerator(plan);
  assert.strictEqual(sel.generatorId, 'legacy:math-make-ten');
  assert.strictEqual(sel.match.kp, 1);
  assert.strictEqual(sel.mode, 'hybrid');
});

test('M4-R14 P2：knowledgePoint 覆盖 → 指定 KP 切模式', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  // 将某 KP 切为 native
  Mode.override('knowledgePoint', 'math-g1-m1-addsub-5', 'native');
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(sel.record.scope, 'core');
  assert.strictEqual(sel.mode, 'native');
  // 无覆盖的 KP 仍用 global hybrid
  const sel2 = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-10', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(sel2.mode, 'hybrid');
  // mode 解析结果为 hybrid（global）
  assert.strictEqual(sel2.mode, 'hybrid');
});

test('M4-R14 P2：global 切换影响无覆盖 KP', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(sel.mode, 'native');
  assert.strictEqual(sel.record.scope, 'core');
  Mode.setGlobal('hybrid');
  const sel2 = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(sel2.mode, 'hybrid');
});

test('M4-R14 P2：非法 scope/mode 抛错', () => {
  Mode.clearAll();
  assert.throws(() => Mode.override('plugin', 'x', 'native'), /scope/);
  assert.throws(() => Mode.override('subject', 'x', 'native'), /scope/);
  assert.throws(() => Mode.override('questionType', 'x', 'native'), /scope/);
  assert.throws(() => Mode.setGlobal('legacy'), /generatorMode/);
});

test('M4-R14 P2：selectGenerator 返回 mode 字段，instantiate 解析 core 实例', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(sel.mode, 'native');
  const inst = Selector.instantiate(sel);
  assert.ok(inst && inst.generate);
  const qs = inst.generate({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3, count: 2 }, { seed: 'm4-r14' });
  assert.strictEqual(qs.length, 2);
});