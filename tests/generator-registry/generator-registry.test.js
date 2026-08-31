/**
 * tests/generator-registry.test.js — M7-R17 GeneratorRegistry 能力注册表
 *
 * 验证 register/resolve/has/list/records：
 *   - 基于 M4 generator-registry 数据（103 条）无副作用扩增；
 *   - capability 语义解析（subject 过滤 + capability/questionType 评分 + 版本决胜）；
 *   - register 注入执行器可被 resolve 命中；未知 subject 解析为 null。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const G = require(path.join(ROOT, 'shared', 'generator-registry.js'));

test('R17-1 records/list 返回能力声明且无插件对象', () => {
  const recs = G.records();
  assert.ok(recs.length >= 100, 'records >= 100');
  assert.ok(G.list().length === recs.length);
  recs.forEach(r => {
    assert.ok(Array.isArray(r.capabilities), 'capabilities array');
    assert.ok(typeof r.subject === 'string', 'subject string');
    assert.strictEqual(r.plugin, undefined, '记录不得携带插件对象（capability 语义）');
    assert.strictEqual(r.generate, undefined, '数据声明不得携带 generate');
  });
});

test('R17-2 resolve 能力语义解析 + subject 过滤', () => {
  const res = G.resolve({ subject: 'math', capability: 'calc' });
  assert.ok(res && res.record, 'resolve 命中');
  assert.ok((res.record.capabilities || []).includes('calc'), '命中记录含 calc 能力');
  assert.strictEqual(G.resolve({ subject: 'zzz-unknown-subject', capability: 'calc' }), null);
  assert.strictEqual(G.resolve({ subject: 'math', capability: 'zzz-no-such-capability' }), null);
  assert.strictEqual(G.resolve(null), null);
});

test('R17-3 has() 能力/题型存在性', () => {
  assert.strictEqual(G.has('oral'), true, 'oral 为既有能力');
  assert.strictEqual(G.has('zzz-impossible'), false);
  assert.strictEqual(G.has(''), false);
});

test('R17-4 register 注入执行器并参与 resolve', () => {
  const before = G.list().length;
  G.register({
    id: '__m7test',
    subject: 'math',
    capabilities: ['zzz_unqiue_m7'],
    questionTypes: ['calc'],
    generate: () => ({ questions: [] })
  });
  try {
    assert.strictEqual(G.list().length, before + 1, 'list 扩增 1');
    const res = G.resolve({ subject: 'math', capability: 'zzz_unqiue_m7', questionType: 'calc' });
    assert.ok(res && res.record && res.record.id === '__m7test');
    assert.strictEqual(typeof res.execute.generate, 'function');
  } finally {
    // 清理：避免影响后续用例（重载不可行，逐个移除注入项）
    const idx = G.list().findIndex(r => r.id === '__m7test');
    if (idx !== -1) {
      G.list().splice(idx, 1);
    }
  }
});

test('R17-5 注册参数校验', () => {
  assert.throws(() => G.register(null));
  assert.throws(() => G.register({ capabilities: [] }));
});