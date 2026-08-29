// test/plugins/pinyin-to-char.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { generate } = require('../helpers.js');
const plugin = require('../../plugins/pinyin-to-char.js');

test.describe('pinyin-to-char', () => {
  test('generate 按 count 出题，每题含拼音题干 q 与汉字答案 answer', () => {
    const set = generate(plugin, { count: 6 });
    assert.ok(Array.isArray(set.questions), 'questions 应为数组');
    assert.strictEqual(set.questions.length, 6, '题量应等于 count');
    for (const q of set.questions) {
      assert.strictEqual(typeof q.q, 'string', '题干 q（拼音）应为字符串');
      assert.ok(q.q.length > 0, '拼音题干不应为空');
      assert.strictEqual(typeof q.answer, 'string', '答案（汉字）应为字符串');
      assert.ok(q.answer.length > 0, '汉字答案不应为空');
    }
  });

  test('100 次调用稳定无异常且产出多样性', () => {
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
      const set = generate(plugin, { count: 6 });
      assert.strictEqual(set.questions.length, 6);
      for (const q of set.questions) seen.add(q.q + '=>' + q.answer);
    }
    assert.ok(seen.size >= 2, '应至少出现两种不同题目，实际: ' + seen.size);
  });
});
