// test/plugins/chinese-pinyin.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { generate } = require('../helpers.js');
const plugin = require('../../plugins/chinese-pinyin.js');

test.describe('chinese-pinyin', () => {
  test('generate 返回含 questions 数组的对象', () => {
    const set = generate(plugin, { count: 5 });
    assert.ok(Array.isArray(set.questions), 'questions 应为数组');
    assert.ok(set.questions.length >= 1, '应至少产出 1 题');
  });

  test('每题含必要字段 q / answer，且选择题带 options', () => {
    const set = generate(plugin, { count: 12 });
    for (const q of set.questions) {
      assert.strictEqual(typeof q.q, 'string', '题干 q 应为字符串');
      assert.ok(q.q.length > 0, '题干不应为空');
      assert.notStrictEqual(q.answer, null, 'answer 不应为 null');
      assert.notStrictEqual(q.answer, undefined, 'answer 不应为 undefined');
      assert.strictEqual(typeof q.answer, 'string', 'answer 应为字符串');
      if (q.inputType === 'choice') {
        assert.ok(Array.isArray(q.options) && q.options.length >= 2, '选择题应提供 options');
      }
    }
  });

  test('100 次调用稳定无异常且产出多样性', () => {
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
      const set = generate(plugin, { count: 5 });
      assert.ok(set.questions.length >= 1);
      for (const q of set.questions) seen.add(q.q);
    }
    assert.ok(seen.size >= 2, '应至少出现两种不同题目，实际: ' + seen.size);
  });
});
