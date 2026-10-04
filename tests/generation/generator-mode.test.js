'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Mode = require(path.join(ROOT, 'shared', 'generator', 'generator-mode.js'));

test('M4-R14 P2：默认 global = native', () => {
  Mode.clearAll();
  assert.strictEqual(Mode.getGlobal(), 'native');
  assert.strictEqual(Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-5' }), 'native');
});

test('M4-R14 P2：非法 mode/scope 抛错', () => {
  Mode.clearAll();
  assert.throws(() => Mode.setGlobal('turbo'), /generatorMode/);
  assert.throws(() => Mode.override('badScope', 'x', 'native'), /scope/);
  assert.throws(() => Mode.override('knowledgePoint', 'math-g1-m1-addsub-5', 'turbo'), /mode/);
});

test('M4-R14 P2：两级覆盖优先级 KP > global', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  Mode.override('knowledgePoint', 'math-g1-m1-addsub-5', 'native');
  // KP 精确匹配优先
  assert.strictEqual(Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-5' }), 'native');
  // 无 KP 覆盖 → global
  assert.strictEqual(Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-10' }), 'hybrid');
  // 无 KP 且无 subject → global (default native 清除后)
  Mode.clearOverride('knowledgePoint');
  assert.strictEqual(Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-10' }), 'hybrid');
});

test('M4-R14 P2：仅 knowledgePoint scope 合法', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  // plugin/subject/questionType scope 均抛错
  assert.throws(() => Mode.override('plugin', 'math-oral', 'legacy'), /scope/);
  assert.throws(() => Mode.override('subject', 'math', 'legacy'), /scope/);
  assert.throws(() => Mode.override('questionType', 'calc', 'legacy'), /scope/);
});

test('M4-R14 P2：dump 输出全局模式与 knowledgePointOverrides', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  Mode.override('knowledgePoint', 'math-g1-m1-addsub-5', 'hybrid');
  const d = Mode.dump();
  assert.strictEqual(d.generatorMode, 'native');
  assert.strictEqual(d.knowledgePointOverrides['math-g1-m1-addsub-5'], 'hybrid');
  assert.ok(!('pluginOverrides' in d));
  assert.ok(!('questionTypeOverrides' in d));
  assert.ok(!('subjectOverrides' in d));
});
// ===== Phase 9：并入原 dev/check-generator-mode.js 的独有检查（一事实一入口） =====
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const Selector = Env.GeneratorSelector;
const GenRegistry = Env.GeneratorRegistry;
// 选择器来自 bundle，其内部 Mode 实例与源码 Mode 不同 → 选择相关测试用 bundle Mode
const BundleMode = Env.GeneratorMode;

test('M4-R14：native 模式选中 core track；无候选显式 unsupported（Step 14 禁止 fallback）', () => {
  BundleMode.clearAll();
  BundleMode.setGlobal('native');
  const n = Selector.selectGenerator({ knowledgePointId: 'math-g1-up-u01-k001', questionTypeId: 'calc', difficulty: 3 });
  assert.equal(n.record && n.record.scope, 'core');
  const f = Selector.selectGenerator({ knowledgePointId: 'math-g1-up-u05-k001', questionTypeId: 'review', difficulty: 3 });
  assert.equal(f.source, 'unsupported');
  assert.equal(f.errorCode, 'GENERATOR_UNSUPPORTED');
});

test('M4-R14：hybrid 无 legacy 并轨（legacy 记录已清空）；选择结果携带 mode', () => {
  BundleMode.setGlobal('hybrid');
  const legacyCount = GenRegistry.all().filter((r) => r.scope === 'legacy' || /^legacy:/.test(r.id)).length;
  assert.equal(legacyCount, 0);
  const hsel = Selector.selectGenerator({ knowledgePointId: 'math-g1-up-u01-k001', questionTypeId: 'calc', difficulty: 3 });
  assert.equal(hsel.record && hsel.record.scope, 'core');
  assert.equal(hsel.mode, 'hybrid');
  const hNone = Selector.selectGenerator({ knowledgePointId: 'math-g1-up-u05-k001', questionTypeId: 'review', difficulty: 3 });
  assert.equal(hNone.source, 'unsupported');
});

test('M4-R14：instantiate 可实例化 core 生成器并产出题量', () => {
  BundleMode.clearAll();
  BundleMode.setGlobal('native');
  const n = Selector.selectGenerator({ knowledgePointId: 'math-g1-up-u01-k001', questionTypeId: 'calc', difficulty: 3 });
  const inst = Selector.instantiate(n);
  const qs = inst.generate({ knowledgePointId: 'math-g1-up-u01-k001', questionTypeId: 'calc', difficulty: 3, count: 2 }, { seed: 'gate' });
  assert.equal(qs.length, 2);
});
