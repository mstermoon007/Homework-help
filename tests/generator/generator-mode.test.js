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