'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Spiral = require(path.join(ROOT, 'shared', 'strategy', 'spiral-strategy.js'));
const KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

test('S1..S6 固定映射', () => {
  const expected = ['prototype', 'numeric', 'presentation', 'context', 'structure', 'transfer'];
  for (let i = 1; i <= 6; i++) {
    const r = Spiral.resolveSpiral({ spiral_level: i, max_spiral_level: 6 });
    assert.strictEqual(r.spiralLevel, i);
    assert.strictEqual(r.variationMode, expected[i - 1], 'S' + i);
  }
});

test('不得超过 max_spiral_level', () => {
  const r = Spiral.resolveSpiral({ spiral_level: 7, max_spiral_level: 6 });
  assert.strictEqual(r.spiralLevel, 6);
  assert.strictEqual(r.variationMode, 'transfer');

  const r2 = Spiral.resolveSpiral({ spiral_level: 4, max_spiral_level: 2 });
  assert.strictEqual(r2.spiralLevel, 2);
  assert.strictEqual(r2.variationMode, 'numeric');
});

test('超过 S6 固定 transfer', () => {
  const r = Spiral.resolveSpiral({ spiral_level: 9, max_spiral_level: 9 });
  assert.strictEqual(r.spiralLevel, 9);
  assert.strictEqual(r.variationMode, 'transfer');
});

test('从 KnowledgePoint 读取 spiral', () => {
  const r = Spiral.resolveSpiral({ knowledgePoint: KP.get('math-g1-m0-make-ten') });
  assert.strictEqual(r.spiralLevel, 1);
  assert.strictEqual(r.variationMode, 'prototype');
});

test('缺省 -> S1 prototype', () => {
  assert.deepStrictEqual(Spiral.resolveSpiral({}), { spiralLevel: 1, variationMode: 'prototype' });
});

test('非法值回落 1', () => {
  const r = Spiral.resolveSpiral({ spiral_level: 0, max_spiral_level: 'x' });
  assert.strictEqual(r.spiralLevel, 1);
  assert.strictEqual(r.variationMode, 'prototype');
});

test('knowledgePointId 解析', () => {
  const r = Spiral.resolveSpiral({ knowledgePointId: 'math-g1-m0-make-ten' });
  assert.deepStrictEqual(r, { spiralLevel: 1, variationMode: 'prototype' });
});
