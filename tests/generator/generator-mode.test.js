'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Mode = require(path.join(ROOT, 'shared', 'generator', 'generator-mode.js'));

test('M4-R14：默认 global = hybrid', () => {
  Mode.clearAll();
  assert.strictEqual(Mode.getGlobal(), 'hybrid');
  assert.strictEqual(Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-5' }), 'hybrid');
});

test('M4-R14：非法 mode/scope 抛错', () => {
  Mode.clearAll();
  assert.throws(() => Mode.setGlobal('turbo'), /generatorMode/);
  assert.throws(() => Mode.override('badScope', 'x', 'native'), /scope/);
  assert.throws(() => Mode.override('plugin', 'math-oral', 'turbo'), /mode/);
});

test('M4-R14：四级覆盖优先级 plugin > KP > questionType > subject > global', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  Mode.override('subject', 'math', 'legacy');
  Mode.override('questionType', 'calc', 'native');
  Mode.override('knowledgePoint', 'math-g1-m1-addsub-5', 'hybrid');
  Mode.override('plugin', 'math-oral', 'legacy');
  // plugin 最具体 → legacy
  assert.strictEqual(Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', subject: 'math' }), 'legacy');
  // 去掉 plugin 覆盖 → KP 覆盖 hybrid
  Mode.clearOverride('plugin', 'math-oral');
  assert.strictEqual(Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', subject: 'math' }), 'hybrid');
  // 去掉 KP 覆盖（换一个无覆盖的 KP）→ questionType 覆盖 native
  assert.strictEqual(Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-10', questionTypeId: 'calc', subject: 'math' }), 'native');
  // 去掉 questionType 覆盖 → subject 覆盖 legacy
  Mode.clearOverride('questionType');
  assert.strictEqual(Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-10', questionTypeId: 'calc', subject: 'math' }), 'legacy');
  // 去掉 subject → 全局 hybrid
  Mode.clearOverride('subject');
  assert.strictEqual(Mode.resolve({ knowledgePointId: 'math-g1-m1-addsub-10', questionTypeId: 'calc', subject: 'math' }), 'hybrid');
});

test('M4-R14：无 knowledgePointId 也能按 subject/questionType 解析', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  Mode.override('subject', 'chinese', 'native');
  assert.strictEqual(Mode.resolve({ subject: 'chinese' }), 'native');
  assert.strictEqual(Mode.resolve({ subject: 'english' }), 'hybrid');
});

test('M4-R14：dump 输出全局模式与各级覆盖', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  Mode.override('plugin', 'math-make-ten', 'legacy');
  const d = Mode.dump();
  assert.strictEqual(d.generatorMode, 'native');
  assert.strictEqual(d.pluginOverrides['math-make-ten'], 'legacy');
});