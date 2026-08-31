/**
 * shared/generator/core/rng.js — M4-R06 核心随机源（可复现，禁止 Math.random）
 *
 * mulberry32 种子 PRNG + 整数/选择/洗牌助手。
 * 同一种子（seed）必须产生完全相同的序列 → 支持「相同 Plan/Seed 语义等价」验收。
 */
'use strict';

function hashSeed(str) {
  var h = 5381;
  str = String(str);
  for (var i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function createSeededRandom(seed) {
  var a = (seed == null ? 1 : (typeof seed === 'number' ? (seed >>> 0) : hashSeed(seed))) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  if (max < min) { var t = min; min = max; max = t; }
  return min + Math.floor(rng() * (max - min + 1));
}

function pick(rng, arr) {
  if (!arr || arr.length === 0) return undefined;
  return arr[randInt(rng, 0, arr.length - 1)];
}

function shuffle(rng, arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = randInt(rng, 0, i);
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

module.exports = {
  hashSeed: hashSeed,
  createSeededRandom: createSeededRandom,
  randInt: randInt,
  pick: pick,
  shuffle: shuffle
};
