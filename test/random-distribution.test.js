// test/random-distribution.test.js
// 任务 4.3：randInt 随机源分布测试
//   - 验证 crypto.getRandomValues 路径的均匀性（卡方检验）
//   - 验证可注入随机源（rng）的确定性与无类型转换偏差
//   - 边界行为（min===max、单值区间）
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const PU = require('../shared/common.js');
const randInt = PU.randInt;
const randFloat = PU.randFloat;

// 卡方临界值（自由度 df，显著性 alpha=0.05）
const CHI2_CRIT = { 1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488, 5: 11.070, 6: 12.592, 7: 14.067, 8: 15.507, 9: 16.919, 10: 18.307, 19: 30.144, 99: 123.225 };
// α=0.01 临界值（用于 CI 冒烟检验，降低 ~5% 误报导致的偶发红灯；仍可捕获明显非均匀源）
const CHI2_CRIT_01 = { 9: 21.666, 99: 134.642 };

function chiSquare(observed, expected) {
  let sum = 0;
  for (let i = 0; i < observed.length; i++) {
    const e = expected[i];
    if (e <= 0) continue;
    const d = observed[i] - e;
    sum += (d * d) / e;
  }
  return sum;
}

// 可重现 PRNG（mulberry32）
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test.describe('randInt 分布（真实 crypto 随机源）', () => {
  test('randInt(1,10) 卡方均匀性检验（100k 样本，df=9, α=0.01）', () => {
    const N = 100000;
    const k = 10;
    const observed = new Array(k).fill(0);
    for (let i = 0; i < N; i++) {
      const v = randInt(1, 10);
      assert.ok(v >= 1 && v <= 10, '应落在 [1,10]');
      observed[v - 1]++;
    }
    const expected = new Array(k).fill(N / k);
    const chi2 = chiSquare(observed, expected);
    assert.ok(chi2 < CHI2_CRIT_01[9], '卡方应低于临界值 21.666（α=0.01），实际: ' + chi2.toFixed(3));
  });

  test('每值频率落在期望值 ±10% 范围内（100k 样本）', () => {
    const N = 100000;
    const k = 10;
    const observed = new Array(k).fill(0);
    for (let i = 0; i < N; i++) observed[randInt(1, 10) - 1]++;
    const exp = N / k;
    for (let i = 0; i < k; i++) {
      assert.ok(observed[i] >= exp * 0.9 && observed[i] <= exp * 1.1,
        '值 ' + (i + 1) + ' 频率应落在 ±10%：实际 ' + observed[i]);
    }
  });

  test('大区间 randInt(0,99) 卡方均匀性（50k 样本，df=99, α=0.01）', () => {
    const N = 50000;
    const k = 100;
    const observed = new Array(k).fill(0);
    for (let i = 0; i < N; i++) observed[randInt(0, 99)]++;
    const expected = new Array(k).fill(N / k);
    const chi2 = chiSquare(observed, expected);
    assert.ok(chi2 < CHI2_CRIT_01[99], '卡方应低于临界值 134.642（α=0.01），实际: ' + chi2.toFixed(3));
  });
});

test.describe('randInt 可注入随机源（确定性 + 无偏差）', () => {
  test('注入 rng 后结果确定性且映射无类型转换偏差', () => {
    // rng 返回 [0,1)，randInt 计算 min + floor(rng()*range)
    const cases = [
      { rng: function () { return 0; }, min: 1, max: 10, expect: 1 },
      { rng: function () { return 0.999999; }, min: 1, max: 10, expect: 10 },
      { rng: function () { return 0.1; }, min: 1, max: 10, expect: 2 },
      { rng: function () { return 0.5; }, min: 0, max: 3, expect: 2 }, // floor(0.5*4=2.0)=2 → 0+2=2
      { rng: function () { return 0.4999; }, min: 0, max: 3, expect: 1 } // floor(0.4999*4=1.9996)=1 → 1
    ];
    cases.forEach(function (c) {
      assert.strictEqual(randInt(c.min, c.max, c.rng), c.expect, 'rng 映射应精确');
    });
  });

  test('同一 rng 种子两次调用序列一致（便于测试复现）', () => {
    const s1 = []; const s2 = [];
    let r1 = mulberry32(99), r2 = mulberry32(99);
    for (let i = 0; i < 50; i++) { s1.push(randInt(1, 6, r1)); s2.push(randInt(1, 6, r2)); }
    assert.deepStrictEqual(s1, s2, '相同种子应产生相同序列');
  });

  test('注入 rng 下 randInt(1,10) 仍均匀分布（10k 样本）', () => {
    const N = 10000, k = 10;
    const observed = new Array(k).fill(0);
    let r = mulberry32(7);
    for (let i = 0; i < N; i++) observed[randInt(1, 10, r) - 1]++;
    const expected = new Array(k).fill(N / k);
    const chi2 = chiSquare(observed, expected);
    assert.ok(chi2 < CHI2_CRIT[9], '注入 rng 也应均匀，卡方: ' + chi2.toFixed(3));
  });
});

test.describe('randInt 边界行为', () => {
  test('randInt(0,0) 恒为 0', () => {
    for (let i = 0; i < 50; i++) assert.strictEqual(randInt(0, 0), 0);
  });
  test('randInt(5,5) 恒为 5', () => {
    for (let i = 0; i < 50; i++) assert.strictEqual(randInt(5, 5), 5);
  });
  test('randInt(1,2) 仅返回 1 或 2', () => {
    for (let i = 0; i < 1000; i++) {
      const v = randInt(1, 2);
      assert.ok(v === 1 || v === 2, '应只返回 1 或 2，实际: ' + v);
    }
  });
  test('负区间 randInt(-3,-1) 仅返回 -3/-2/-1', () => {
    for (let i = 0; i < 1000; i++) {
      const v = randInt(-3, -1);
      assert.ok(v >= -3 && v <= -1, '应落在 [-3,-1]');
    }
  });
});

test.describe('randFloat（crypto 浮点随机源，方案 A）', () => {
  test('返回值严格落在 [0, 1) 且类型稳定', () => {
    for (let i = 0; i < 20000; i++) {
      const v = randFloat();
      assert.ok(typeof v === 'number' && v >= 0 && v < 1, '应 ∈ [0,1)，实际: ' + v);
    }
  });

  test('crypto 固定序列下确定性可复现', () => {
    const orig = globalThis.crypto.getRandomValues;
    // 固定填充：每个 32 位槽写入常量，保证 randFloat 两次调用一致
    globalThis.crypto.getRandomValues = function (arr) {
      for (let i = 0; i < arr.length; i++) arr[i] = 0x12345678;
    };
    try {
      const a = randFloat();
      const b = randFloat();
      assert.strictEqual(a, b, '相同 crypto 序列应产生相同浮点');
      // 0x12345678 & 0x1FFFFF = 0x12345678 & 0x1FFFFF = 0x123456 高位；结果应 < 1 且 > 0
      assert.ok(a >= 0 && a < 1, '结果应在 [0,1)');
    } finally {
      globalThis.crypto.getRandomValues = orig;
    }
  });
});
