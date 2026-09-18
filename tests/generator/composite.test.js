'use strict';

/**
 * tests/generator/composite.test.js — 最小 Composite 契约测试（POL–KBL Phase 4）
 *
 * 覆盖最小接口：supportsComposite / supports(combine) / generate（单组合、多组合、非法输入、
 * 结果 Practice Context 契约与确定性）。
 * 说明：combine 生成当前受 B6 绑定迁移约束（生产不可达）；本测试锁定接口契约，
 * 待绑定迁移完成后可直接复用。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Composite = require(path.join(ROOT, 'shared', 'generator', 'generators', 'composite.js'));

function makePlan(overrides) {
  return Object.assign({
    combine: true,
knowledgePointIds: ['math-g1-up-u01-k001', 'math-g1-up-u05-k001'],
    questionTypeId: 'judge',
    difficulty: 3,
    count: 2,
    seed: 'composite-test'
  }, overrides || {});
}

test('composite：buildAll 产出唯一 supportsComposite 生成器', () => {
  const all = Composite.buildAll();
  assert.equal(all.length, 1);
  assert.equal(all[0].id, 'generator:composite');
  assert.equal(all[0].supportsComposite, true);
});

test('composite：supports 仅接受 combine 且 ≥2 KP', () => {
  const g = Composite.buildAll()[0];
  assert.equal(g.supports(makePlan()), true);
  assert.equal(g.supports(makePlan({ combine: false })), false);
  assert.equal(g.supports(makePlan({ knowledgePointIds: ['math-g1-up-u01-k001'] })), false);
  assert.equal(g.supports(null), false);
});

test('composite：单组合生成题量与 KP 覆盖契约', () => {
  const g = Composite.buildAll()[0];
  const qs = g.generate(makePlan({ count: 3 }), {});
  assert.equal(qs.length, 3);
  qs.forEach((q) => {
    assert.deepEqual(q.knowledgePointIds, makePlan().knowledgePointIds);
    assert.equal(q.knowledgePointId, makePlan().knowledgePointIds[0]);
    assert.equal(q.answerMode, 'judge');
    assert.equal(typeof q.answer, 'boolean');
    assert.equal(typeof q.prompt, 'string');
    assert.equal(q.data.composite, true);
    assert.equal(q.data.mode, 'calc-to-judge');
    assert.equal(q.difficulty, 3);
  });
});

test('composite：多组合（多对 KP）分别生成且互不串扰', () => {
  const g = Composite.buildAll()[0];
  const a = g.generate(makePlan({ knowledgePointIds: ['math-g1-up-u01-k001', 'math-g1-up-u05-k001'], seed: 'A' }), {});
  const b = g.generate(makePlan({ knowledgePointIds: ['math-g2-up-u02-k001', 'math-g2-up-u02-k004'], seed: 'B' }), {});
  assert.deepEqual(a[0].knowledgePointIds, ['math-g1-up-u01-k001', 'math-g1-up-u05-k001']);
  assert.deepEqual(b[0].knowledgePointIds, ['math-g2-up-u02-k001', 'math-g2-up-u02-k004']);
});

test('composite：非法输入（<2 KP）抛错', () => {
  const g = Composite.buildAll()[0];
  assert.throws(() => g.generate({ combine: true, knowledgePointIds: ['math-g1-up-u01-k001'], count: 1 }, {}), /至少 2 个知识点/);
  assert.throws(() => g.generate({ combine: true, count: 1 }, {}), /至少 2 个知识点/);
});

test('composite：同种子输出确定（可复现）', () => {
  const g = Composite.buildAll()[0];
  const a = g.generate(makePlan(), {});
  const b = g.generate(makePlan(), {});
  assert.deepEqual(a, b);
});
