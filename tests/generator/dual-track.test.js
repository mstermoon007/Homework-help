'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Mode = require(path.join(ROOT, 'shared', 'generator', 'generator-mode.js'));

test('M4-R14 P2：native 模式 → 只选 core，无候选返回 GENERATOR_UNSUPPORTED（Step 14）', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  // math-oral KP 有 core arithmetic 能力 → 选中 core
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(sel.record.scope, 'core');
  assert.strictEqual(sel.mode, 'native');
  // P0-03 Step 14：native 无 core 候选（非算术语义 KP）→ 禁止静默 fallback legacy，返回 unsupported
  const sel2 = Selector.selectGenerator({ knowledgePointId: 'math-g1-m0-make-ten', questionTypeId: 'review', difficulty: 3 });
  assert.strictEqual(sel2.source, 'unsupported');
  assert.strictEqual(sel2.errorCode, 'GENERATOR_UNSUPPORTED');
  assert.strictEqual(sel2.generatorId, null);
});

test('MATH-14：legacy 轨道已删除 → 任何模式都不存在 legacy: 记录，hybrid 也无回退宿主', () => {
  Mode.clearAll();
  // registry 仅含 core，不再有任何 scope==='legacy' 记录
  const GenRegistry = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
  const legacyRecs = GenRegistry.all().filter(r => r.scope === 'legacy' || /^legacy:/.test(r.id));
  assert.strictEqual(legacyRecs.length, 0);
  // 即使显式切 hybrid，旧的 legacy 绑定 KP 也不再回退到 legacy（无宿主）
  Mode.setGlobal('hybrid');
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m0-make-ten', questionTypeId: 'review', difficulty: 3 });
  assert.ok(!/^legacy:/.test(sel.generatorId || ''));
  assert.notStrictEqual(sel.source, 'fallback:legacy');
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