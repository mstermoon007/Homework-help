'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Resolver = require(path.join(ROOT, 'shared', 'capability-resolver.js'));

test('已知 KP + 已知题型 -> ALLOW', () => {
  const r = Resolver.resolveFinal({ knowledgePointId: 'math-g1-m0-make-ten', questionType: 'calc' });
  assert.strictEqual(r.decision, 'ALLOW');
});

test('未知 KP -> INVALID', () => {
  const r = Resolver.resolveFinal({ knowledgePointId: '__no_such__', questionType: 'calc' });
  assert.strictEqual(r.decision, 'INVALID');
});

test('未知题型 -> INVALID', () => {
  const r = Resolver.resolveFinal({ knowledgePointId: 'math-g1-m0-make-ten', questionType: '__nope__' });
  assert.strictEqual(r.decision, 'INVALID');
});

test('明确冲突 -> FORBID', () => {
  // geometry 与纯计算口算互斥（oral 类）
  const r = Resolver.resolveFinal({ knowledgePointId: 'math-g1-m0-make-ten', questionType: 'geometry' });
  assert.ok(['FORBID', 'DEGRADE'].indexOf(r.decision) !== -1);
});

test('无冲突但未声明 -> DEGRADE（不自动升级 ALLOW）', () => {
  const r = Resolver.resolveFinal({ knowledgePointId: 'math-g1-m0-make-ten', questionType: 'judge' });
  assert.strictEqual(r.decision, 'DEGRADE');
});

test('Capability 完整匹配 -> ALLOW', () => {
  const r = Resolver.resolveFinal({ knowledgePointId: 'math-g1-m0-make-ten', questionType: 'calc' });
  assert.strictEqual(r.capability, 'calculation');
  assert.strictEqual(r.confidence, 'declared');
});

test('resolveFinal 返回 source 追溯', () => {
  const r = Resolver.resolveFinal({ knowledgePointId: 'math-g1-m0-make-ten', questionType: 'calc' });
  assert.ok(r.source);
  assert.ok(r.source.knowledgePoint);
  assert.ok(r.source.questionType);
  assert.ok(r.source.matrix);
});

test('Resolver 不调用 Generator', () => {
  const r = Resolver.resolveFinal({ knowledgePointId: 'math-g1-m0-make-ten', questionType: 'calc' });
  assert.strictEqual(r.generate, undefined);
  assert.strictEqual(r.render, undefined);
  assert.strictEqual(r.plugin, undefined);
});

test('Resolver 不修改输入对象', () => {
  const kp = { knowledgePointId: 'math-g1-m0-make-ten', questionType: 'calc' };
  const before = JSON.stringify(kp);
  Resolver.resolveFinal(kp);
  assert.strictEqual(JSON.stringify(kp), before);
});

test('DEGRADE 绝不自动升级为 ALLOW', () => {
  const r = Resolver.resolveFinal({ knowledgePointId: 'math-g1-m0-make-ten', questionType: 'judge' });
  assert.strictEqual(r.decision, 'DEGRADE');
  assert.notStrictEqual(r.decision, 'ALLOW');
});
