// test/plugins/english-alphabet.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { generate } = require('../helpers.js');
const plugin = require('../../plugins/english-alphabet.js');

test.describe('english-alphabet', () => {
  test('generate 按 count 出题，每题为字母卡片（letter/name/sound/example）', () => {
    const set = generate(plugin, { count: 5 });
    assert.ok(Array.isArray(set.questions), 'questions 应为数组');
    assert.strictEqual(set.questions.length, 5, '题量应等于 count');
    for (const q of set.questions) {
      assert.strictEqual(typeof q.letter, 'string', 'letter 应为字符串');
      assert.strictEqual(q.letter.length, 1, 'letter 应为单字母');
      assert.strictEqual(typeof q.name, 'string', 'name 应为字符串');
      assert.strictEqual(typeof q.sound, 'string', 'sound 应为字符串');
      assert.strictEqual(typeof q.example, 'string', 'example 应为字符串');
      // 注：跟读型插件在插件级自定义 render，题目对象本身不挂默认 render
    }
  });

  test('filter=vowel 仅产出元音字母', () => {
    const set = generate(plugin, { count: 5, type: 'vowel' });
    const vowels = ['A', 'E', 'I', 'O', 'U'];
    for (const q of set.questions) {
      assert.ok(vowels.indexOf(q.letter) >= 0, '元音过滤应只产出 AEIOU，实际: ' + q.letter);
    }
  });

  test('100 次调用稳定无异常且产出多样性', () => {
    const seen = new Set();
    for (let i = 0; i < 100; i++) {
      const set = generate(plugin, { count: 5 });
      assert.strictEqual(set.questions.length, 5);
      for (const q of set.questions) seen.add(q.letter);
    }
    assert.ok(seen.size >= 2, '应至少出现两种不同字母，实际: ' + seen.size);
  });
});
