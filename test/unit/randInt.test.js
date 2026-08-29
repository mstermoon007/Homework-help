// test/unit/randInt.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const PU = require('../../shared/common.js');

const randInt = PU.randInt;

// 简单可重现 PRNG（mulberry32），用于确定性测试
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test.describe('randInt', () => {
  test('边界：min === max 时恒等于该值', () => {
    for (let i = 0; i < 50; i++) assert.strictEqual(randInt(5, 5), 5);
    assert.strictEqual(randInt(-3, -3), -3);
  });

  test('范围：大量抽样均落在 [min, max] 闭区间内且为整数', () => {
    for (let i = 0; i < 2000; i++) {
      const v = randInt(1, 6);
      assert.ok(Number.isInteger(v), '应为整数');
      assert.ok(v >= 1 && v <= 6, '应落在 [1,6]: ' + v);
    }
  });

  test('分布：6000 次抽样各面出现次数粗略均匀', () => {
    const counts = {};
    for (let i = 0; i < 6000; i++) {
      const v = randInt(1, 6);
      counts[v] = (counts[v] || 0) + 1;
    }
    for (let f = 1; f <= 6; f++) {
      assert.ok(counts[f] >= 400, '面 ' + f + ' 出现次数应粗略均匀，实际: ' + counts[f]);
    }
  });

  test('确定性：固定 crypto.getRandomValues 序列下两次调用结果完全一致', () => {
    const origCrypto = globalThis.crypto;
    // Node 的 globalThis.crypto 是只读 getter，故以 defineProperty 替换为确定性实现
    let rng = mulberry32(12345);
    const mockCrypto = {
      getRandomValues: function (arr) {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(rng() * 4294967296);
        return arr;
      }
    };
    Object.defineProperty(globalThis, 'crypto', { value: mockCrypto, configurable: true });

    const seq = [];
    for (let i = 0; i < 30; i++) seq.push(randInt(1, 100));

    rng = mulberry32(12345); // 重置种子
    const seq2 = [];
    for (let i = 0; i < 30; i++) seq2.push(randInt(1, 100));

    assert.deepStrictEqual(seq, seq2, '相同随机种子应产生相同序列');
    assert.ok(seq.every(function (v) { return v >= 1 && v <= 100; }));

    // 恢复环境
    Object.defineProperty(globalThis, 'crypto', { value: origCrypto, configurable: true });
  });

  test('负区间：randInt(-5, -1) 落在闭区间内', () => {
    for (let i = 0; i < 100; i++) {
      const v = randInt(-5, -1);
      assert.ok(Number.isInteger(v) && v >= -5 && v <= -1, '应落在 [-5,-1]: ' + v);
    }
  });
});
