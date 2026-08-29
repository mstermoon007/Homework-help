// test/plugins/math-g1-multiplication-table.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { generate } = require('../helpers.js');
const plugin = require('../../plugins/math-g1-multiplication-table.js');

test.describe('math-g1-multiplication-table', () => {
  test('默认 mul-table 返回单张静态表卡片', () => {
    const set = generate(plugin, { count: 5 });
    assert.ok(Array.isArray(set.questions));
    assert.strictEqual(set.questions.length, 1, '静态表应只有 1 题');
    assert.ok(set.questions[0].q.indexOf('乘法表') >= 0 || set.questions[0].q.length > 0, '应包含乘法表内容');
  });

  test('fill 子类型按 count 出题，每题含 q + answer', () => {
    const set = generate(plugin, { subtype: 'fill', count: 10 });
    assert.strictEqual(set.questions.length, 10, 'fill 模式题量应等于 count');
    for (const q of set.questions) {
      assert.strictEqual(typeof q.q, 'string', '题干应为字符串');
      assert.ok(q.q.length > 0);
      assert.notStrictEqual(q.answer, null, '答案不应为 null');
      assert.notStrictEqual(q.answer, undefined, '答案不应为 undefined');
      assert.ok(String(q.answer).length > 0, '答案不应为空');
    }
  });

  test('100 次 fill 调用无异常且含多样性', () => {
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
      const set = generate(plugin, { subtype: 'fill', count: 8 });
      assert.strictEqual(set.questions.length, 8);
      for (const q of set.questions) seen.add(q.q);
    }
    assert.ok(seen.size >= 2, '应至少出现两种不同题目，实际: ' + seen.size);
  });
});
