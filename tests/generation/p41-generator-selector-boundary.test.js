/**
 * tests/generation/p41-generator-selector-boundary.test.js — P41-A2
 *
 * 缺陷：shared/generator/generator-selector.js 的 attachMeta(sqs, ...) 在
 *   非数组且无 .questions 输入下执行 `return sq;`，但方法内不存在局部变量 sq
 *   （严格模式下 ReferenceError）。契约应为原样返回入参 sqs。
 *
 * 本测试经既有 instantiate/wrapGenerator 链路 + 注入式假 Generator（monkeypatch
 * Generators.get）覆盖四种输入形态：空值 / 非数组 / 缺 .questions / 正常数组。
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));

// questionTypeId 取「无教育契约」token：使 TypeContract.enforce 直通，
// 将测试聚焦在 attachMeta 的入参形态边界（而非契约收口）。
const PLAN = { knowledgePointIds: ['math-g1-up-u01-k001'], questionTypeId: '__p41_passthrough__', difficulty: 3, count: 1 };

function withFakeGenerate(returnValue, fn) {
  const orig = Generators.get;
  Generators.get = function () {
    return { id: 'p41-probe', version: '1.0.0', generate: function () { return returnValue; } };
  };
  try {
    const gen = Selector.instantiate({ record: { id: 'p41-probe', version: '1.0.0' } });
    assert.ok(gen && typeof gen.generate === 'function', '假 Generator 应可实例化');
    return fn(gen);
  } finally {
    Generators.get = orig;
  }
}

test('P41-A2 非数组且无 .questions → 原样返回，不抛 ReferenceError', () => {
  const payload = { foo: 1 };
  withFakeGenerate(payload, (gen) => {
    const out = gen.generate(PLAN);
    assert.deepStrictEqual(out, payload, '应原样返回入参对象');
  });
});

test('P41-A2 空值输入 → 原样返回（null/undefined 短路）', () => {
  withFakeGenerate(null, (gen) => assert.strictEqual(gen.generate(PLAN), null));
  withFakeGenerate(undefined, (gen) => assert.strictEqual(gen.generate(PLAN), undefined));
});

test('P41-A2 正常数组输入 → 附加追溯元数据并返回同一集合', () => {
  const arr = [{ knowledgePointId: 'math-g1-up-u01-k001', questionType: 'calc', seed: 42 }];
  withFakeGenerate(arr, (gen) => {
    const out = gen.generate(PLAN);
    assert.strictEqual(out, arr, '数组输入应返回同一引用');
    assert.strictEqual(arr[0].metadata.generator, 'p41-probe');
    assert.strictEqual(arr[0].metadata.generatorVersion, '1.0.0');
    assert.strictEqual(arr[0].metadata.seed, 42);
  });
});

test('P41-A2 同构 { questions: [...] } 输入 → 就地附加元数据', () => {
  const box = { questions: [{ knowledgePointId: 'math-g1-up-u01-k001', questionType: 'calc', seed: 7 }] };
  withFakeGenerate(box, (gen) => {
    const out = gen.generate(PLAN);
    assert.strictEqual(out, box, '同构对象应返回同一引用');
    assert.strictEqual(box.questions[0].metadata.generator, 'p41-probe');
  });
});
