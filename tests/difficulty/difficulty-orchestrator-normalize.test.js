'use strict';

/**
 * tests/difficulty/difficulty-orchestrator-normalize.test.js — POL DifficultyContext 归一（M16）
 *
 * 覆盖 DifficultyOrchestrator（POL 协调层；只归一/携带，不计算）：
 *   number / object / null 输入 → {requested,min,max,tolerance,source}
 *   resolveContext → {requested,base,target,min,max,tolerance,source}
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DO = require(path.join(ROOT, 'shared', 'orchestration', 'difficulty-orchestrator.js'));

test('number 输入 → requested=round, source=user；越界 clamp 1..10', () => {
  assert.deepEqual(DO.normalizeDifficultyInput({ difficulty: 5 }), { requested: 5, min: null, max: null, tolerance: 0, source: 'user' });
  assert.equal(DO.normalizeDifficultyInput({ difficulty: 0 }).requested, 1);
  assert.equal(DO.normalizeDifficultyInput({ difficulty: 99 }).requested, 10);
  assert.equal(DO.normalizeDifficultyInput({ difficulty: 5.6 }).requested, 6);
});

test('object 输入 → 字段原样归一（min/max 纯携带不 clamp；tolerance 负值归 0）', () => {
  const r = DO.normalizeDifficultyInput({ difficulty: { requested: 6, min: 4, max: 8, tolerance: 1, source: 'user' } });
  assert.deepEqual(r, { requested: 6, min: 4, max: 8, tolerance: 1, source: 'user' });
  assert.equal(DO.normalizeDifficultyInput({ difficulty: { requested: 6, min: 20, max: 3, tolerance: -2 } }).tolerance, 0);
});

test('null / 缺省 → requested=null, source=auto（不产生默认难度值）', () => {
  assert.deepEqual(DO.normalizeDifficultyInput({}), { requested: null, min: null, max: null, tolerance: 0, source: 'auto' });
  assert.deepEqual(DO.normalizeDifficultyInput({ difficulty: null }), { requested: null, min: null, max: null, tolerance: 0, source: 'auto' });
});

test('scope.difficulty 兼容旧路径', () => {
  assert.equal(DO.normalizeDifficultyInput({ scope: { difficulty: 7 } }).requested, 7);
});

test('resolveContext：requested 优先为 target；无 requested 时 target=base', () => {
  const a = DO.resolveContext(DO.normalizeDifficultyInput({ difficulty: 7 }), 3);
  assert.deepEqual(a, { requested: 7, base: 3, target: 7, min: null, max: null, tolerance: 0, source: 'user' });
  const b = DO.resolveContext(DO.normalizeDifficultyInput({}), 4);
  assert.equal(b.requested, null);
  assert.equal(b.base, 4);
  assert.equal(b.target, 4);
  assert.equal(b.source, 'auto');
});

