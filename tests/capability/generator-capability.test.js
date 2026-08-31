'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
const Registry = require(path.join(ROOT, 'shared', 'question-type-registry.js'));
const pluginRegistry = require(path.join(ROOT, 'plugins', 'registry.js'));

test('99 个插件全部进入注册表', () => {
  const recs = GenCap.buildGeneratorCapabilityRegistry();
  assert.strictEqual(recs.length, pluginRegistry.length);
});

test('每条记录包含必备字段且不携带执行函数', () => {
  GenCap.buildGeneratorCapabilityRegistry().forEach(rec => {
    assert.ok(rec.pluginId);
    assert.ok(Array.isArray(rec.questionTypes));
    assert.ok(Array.isArray(rec.capabilities));
    assert.ok(Array.isArray(rec.knowledgePoints));
    assert.strictEqual(rec.generateFunction, undefined);
    assert.strictEqual(rec.generator, undefined);
    assert.strictEqual(rec.pluginFunction, undefined);
  });
});

test('所有 questionTypes 均来自标准 Registry', () => {
  GenCap.buildGeneratorCapabilityRegistry().forEach(rec => {
    rec.questionTypes.forEach(qt => {
      assert.ok(Registry.has(qt), rec.pluginId + ' 含非法题型 ' + qt);
    });
  });
});

test('注册表只读：构建结果不引用插件对象', () => {
  const recs = GenCap.buildGeneratorCapabilityRegistry();
  recs.forEach(rec => {
    assert.strictEqual(typeof rec.generate, 'undefined');
    assert.strictEqual(typeof rec.render, 'undefined');
  });
});
