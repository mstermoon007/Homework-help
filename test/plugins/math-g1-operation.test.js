// test/plugins/math-g1-operation.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { generate } = require('../helpers.js');
const plugin = require('../../plugins/math-g1-operation.js');

test.describe('math-g1-operation', () => {
  test('generate 返回含 questions 数组的对象，长度等于 count', () => {
    const set = generate(plugin, { count: 5 });
    assert.ok(Array.isArray(set.questions), 'questions 应为数组');
    assert.strictEqual(set.questions.length, 5, '题量应等于 count');
    assert.ok(set.meta && typeof set.meta === 'object', '应返回 meta');
  });

  test('每题含必要字段 type / q / answer 且类型正确', () => {
    const set = generate(plugin, { count: 8 });
    for (const q of set.questions) {
      assert.strictEqual(typeof q.type, 'string', 'type 应为字符串');
      assert.strictEqual(typeof q.q, 'string', '题干 q 应为字符串');
      assert.ok(q.q.length > 0, '题干不应为空');
      assert.notStrictEqual(q.answer, null, 'answer 不应为 null');
      assert.notStrictEqual(q.answer, undefined, 'answer 不应为 undefined');
      assert.strictEqual(typeof q.answer, 'string', 'answer 应为字符串');
      assert.strictEqual(typeof q.render, 'function', '应挂默认 render');
      assert.strictEqual(typeof q.check, 'function', '应挂默认 check');
    }
  });

  test('加法/减法结果在一年级合理范围（答案可解析为非负整数）', () => {
    const set = generate(plugin, { count: 20, difficulty: 2 });
    for (const q of set.questions) {
      const n = Number(String(q.answer).replace(/[^\d]/g, ''));
      assert.ok(Number.isFinite(n) && n >= 0, '答案应为可解析非负整数: ' + q.answer);
      assert.ok(n <= 100, '一年级运算结果不应超出 100: ' + q.answer);
    }
  });

  test('100 次调用稳定无异常且产出多样性', () => {
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
      const set = generate(plugin, { count: 5 });
      assert.strictEqual(set.questions.length, 5);
      for (const q of set.questions) seen.add(q.q);
    }
    assert.ok(seen.size >= 2, '应至少出现两种不同题目，实际: ' + seen.size);
  });
});
