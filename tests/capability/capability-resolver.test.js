'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Resolver = require(path.join(ROOT, 'shared', 'capability-resolver.js'));

test('resolve 返回 CapabilityModel', () => {
  const kp = { id: 'math-g1-m0-make-ten', name: 'make ten' };
  const cap = Resolver.resolve(kp);
  assert.ok(cap);
  assert.strictEqual(cap.knowledgePointId, kp.id);
  assert.ok(Array.isArray(cap.questionTypes));
});

test('canGenerate 基本检查', () => {
  assert.strictEqual(Resolver.canGenerate('math-g1-m0-make-ten', 'calc'), true);
  assert.strictEqual(Resolver.canGenerate('nonexistent', 'calc'), false);
});

test('matrix 输出结构', () => {
  const kp = { id: 'math-g1-m0-make-ten', name: 'make ten' };
  const m = Resolver.matrix(kp);
  assert.ok(Array.isArray(m.supported));
  assert.ok(Array.isArray(m.unsupported));
});
