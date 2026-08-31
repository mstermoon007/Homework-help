'use strict';

/**
 * M3-26 数量回归测试
 * count = 1 / 3 / 5 / 10 / 20
 * 要求：sum(plan.count) === request.count
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
const Allocation = require(path.join(ROOT, 'shared', 'strategy', 'question-type-allocation.js'));

const KP_ID = 'math-g1-m0-make-ten';
const COUNTS = [1, 3, 5, 10, 20];

test('引擎：count 1/3/5/10/20 → sum(plan.count) === request.count', () => {
  COUNTS.forEach(count => {
    const r = Engine.plan({ knowledgePointId: KP_ID, count });
    const sum = r.plans.reduce((s, p) => s + p.count, 0);
    assert.strictEqual(sum, count, 'count=' + count);
    assert.ok(r.plans.every(p => p.count >= 1), 'count=' + count + ' 每 plan count>=1');
  });
});

test('引擎：count 缺失 → 默认 1', () => {
  const r = Engine.plan({ knowledgePointId: KP_ID });
  assert.strictEqual(r.plans.reduce((s, p) => s + p.count, 0), 1);
});

test('引擎：count 非法（0/-1/小数/非数字）→ 明确拒绝', () => {
  [0, -1, 2.5, '3'].forEach(bad => {
    assert.throws(() => {
      Engine.plan({ knowledgePointId: KP_ID, count: bad });
    }, bad === 0 ? /count/ : /count/);
  });
});

test('M3-07 分配：多题型 count 1/3/5/10/20 → sum 恒等', () => {
  const types = ['oral', 'fill', 'choice'];
  COUNTS.forEach(count => {
    const r = Allocation.allocateQuestionTypes({ count, questionTypes: types });
    const sum = r.plans.reduce((s, p) => s + p.count, 0);
    assert.strictEqual(sum, count, 'count=' + count);
    assert.strictEqual(r.total, count);
  });
});
