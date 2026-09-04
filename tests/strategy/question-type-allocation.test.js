'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Allocation = require(path.join(ROOT, 'shared', 'strategy', 'question-type-allocation.js'));
const KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

test('10 题 × 3 题型 -> oral 4 / fill 3 / choice 3', () => {
  const r = Allocation.allocateQuestionTypes({
    count: 10,
    questionTypes: ['oral', 'fill', 'choice']
  });
  assert.deepStrictEqual(r.plans.map(p => [p.questionTypeId, p.count]), [
    ['oral', 4], ['fill', 3], ['choice', 3]
  ]);
  assert.strictEqual(r.total, 10);
});

test('不变式：各种 count/题型数组合 sum(plan.count) === count', () => {
  const types = ['oral', 'fill', 'choice', 'judge', 'apply'];
  for (let count = 1; count <= 25; count++) {
    for (let n = 1; n <= types.length; n++) {
      const r = Allocation.allocateQuestionTypes({ count, questionTypes: types.slice(0, n) });
      const sum = r.plans.reduce((s, p) => s + p.count, 0);
      assert.strictEqual(sum, count, `count=${count} n=${n}`);
      assert.strictEqual(r.total, count);
      assert.ok(sum !== 9 || count === 9, `count=${count} 时不得出现 9 题`);
      assert.ok(sum !== 11 || count === 11, `count=${count} 时不得出现 11 题`);
    }
  }
});

// G1 字段完善（知识点驱动专项）后，math-g1-m0-make-ten 支持 calc+fill 双题型；
// 分配口径 = 均分 + 余数优先给首选题型（coefficient 不参与本步，属既定契约）。
test('KP 集成：count=10 双题型 KP（calc 优先）-> 均分 calc 5 / fill 5', () => {
  const r = Allocation.allocateQuestionTypes({
    count: 10,
    knowledgePointId: 'math-g1-m0-make-ten'
  });
  assert.deepStrictEqual(r.plans.map(p => [p.questionTypeId, p.count]), [['calc', 5], ['fill', 5]]);
  assert.strictEqual(r.total, 10);
});

test('KP 集成：count=11 双题型 KP -> 余数给首选 calc（6/5）', () => {
  const r = Allocation.allocateQuestionTypes({
    count: 11,
    knowledgePointId: 'math-g1-m0-make-ten'
  });
  assert.deepStrictEqual(r.plans.map(p => [p.questionTypeId, p.count]), [['calc', 6], ['fill', 5]]);
  assert.strictEqual(r.total, 11);
});

test('KP 不支持的题型 -> 抛出错误', () => {
  assert.throws(() => {
    Allocation.allocateQuestionTypes({
      count: 3,
      knowledgePointId: 'math-g1-m0-make-ten',
      questionTypes: ['geometry']
    });
  }, /KP 不支持该题型/);
});

test('非法题型 -> 抛出错误', () => {
  assert.throws(() => {
    Allocation.allocateQuestionTypes({
      count: 3,
      questionTypes: ['invalid_type']
    });
  }, /非法 questionTypeId/);
});

test('count 非正整数 -> 抛出错误', () => {
  [0, -1, 1.5, '3', null, NaN].forEach(bad => {
    assert.throws(() => {
      Allocation.allocateQuestionTypes({ count: bad, questionTypes: ['oral'] });
    }, /count 必须是 >=1 的整数/);
  });
});

test('validateAllocation: 总数一致 -> valid', () => {
  const v = Allocation.validateAllocation(
    [{ questionTypeId: 'oral', count: 4 }, { questionTypeId: 'fill', count: 3 }, { questionTypeId: 'choice', count: 3 }],
    10
  );
  assert.strictEqual(v.valid, true);
});

test('validateAllocation: 9 题 / 11 题 -> invalid', () => {
  const v9 = Allocation.validateAllocation(
    [{ questionTypeId: 'oral', count: 4 }, { questionTypeId: 'fill', count: 3 }, { questionTypeId: 'choice', count: 2 }],
    10
  );
  assert.strictEqual(v9.valid, false);
  assert.ok(v9.errors.some(e => e.includes('9')));

  const v11 = Allocation.validateAllocation(
    [{ questionTypeId: 'oral', count: 4 }, { questionTypeId: 'fill', count: 4 }, { questionTypeId: 'choice', count: 3 }],
    10
  );
  assert.strictEqual(v11.valid, false);
  assert.ok(v11.errors.some(e => e.includes('11')));
});

test('count=1 -> 单计划 count=1', () => {
  const r = Allocation.allocateQuestionTypes({
    count: 1,
    knowledgePointId: 'math-g1-m0-make-ten'
  });
  assert.strictEqual(r.plans.length, 1);
  assert.strictEqual(r.plans[0].count, 1);
  assert.strictEqual(r.plans[0].questionTypeId, 'calc');
  assert.strictEqual(r.total, 1);
});

test('questionTypes 去重且保持顺序', () => {
  const r = Allocation.allocateQuestionTypes({
    count: 6,
    questionTypes: ['oral', 'oral', 'fill']
  });
  assert.deepStrictEqual(r.plans.map(p => p.questionTypeId), ['oral', 'fill']);
  assert.strictEqual(r.plans.reduce((s, p) => s + p.count, 0), 6);
});
