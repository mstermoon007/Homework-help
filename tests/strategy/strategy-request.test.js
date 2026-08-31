'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Request = require(path.join(ROOT, 'shared', 'strategy', 'strategy-request.js'));

test('合法 knowledgePointId 可创建 Request', () => {
  const req = Request.createRequest({ knowledgePointId: 'math-g1-m0-make-ten' });
  const v = Request.validateRequest(req);
  assert.strictEqual(v.valid, true);
});

test('缺少 knowledgePointId -> 非法', () => {
  const req = Request.createRequest({ subject: 'math', grade: 1 });
  const v = Request.validateRequest(req);
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some(e => e.includes('knowledgePointId')));
});

test('非法 questionType -> 非法', () => {
  const req = Request.createRequest({ knowledgePointId: 'x', questionType: 'invalid_type' });
  const v = Request.validateRequest(req);
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some(e => e.includes('questionType')));
});

test('合法 questionType 可通过', () => {
  const req = Request.createRequest({ knowledgePointId: 'x', questionType: 'calc' });
  const v = Request.validateRequest(req);
  assert.strictEqual(v.valid, true);
});

test('targetDifficulty 必须 1-10', () => {
  let req = Request.createRequest({ knowledgePointId: 'x', targetDifficulty: 0 });
  let v = Request.validateRequest(req);
  assert.strictEqual(v.valid, false);

  req = Request.createRequest({ knowledgePointId: 'x', targetDifficulty: 11 });
  v = Request.validateRequest(req);
  assert.strictEqual(v.valid, false);

  req = Request.createRequest({ knowledgePointId: 'x', targetDifficulty: 5 });
  v = Request.validateRequest(req);
  assert.strictEqual(v.valid, true);
});

test('禁止字段 svg/html/generate 被拒绝', () => {
  let req = Request.createRequest({ knowledgePointId: 'x', svg: '<svg/>' });
  let v = Request.validateRequest(req);
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.some(e => e.includes('禁止字段')));

  req = Request.createRequest({ knowledgePointId: 'x', html: '<div/>' });
  v = Request.validateRequest(req);
  assert.strictEqual(v.valid, false);

  req = Request.createRequest({ knowledgePointId: 'x', generate: () => {} });
  v = Request.validateRequest(req);
  assert.strictEqual(v.valid, false);
});

test('旧 UI 参数兼容映射', () => {
  const req = Request.createFromLegacyUI({ subject: 'math', grade: 2, count: 5, difficulty: 3 });
  assert.strictEqual(req.subject, 'math');
  assert.strictEqual(req.grade, 2);
  assert.strictEqual(req.count, 5);
  assert.strictEqual(req.targetDifficulty, 3);
  assert.strictEqual(Request.isLegacyRequest(req), true);
});

test('targetDifficulty 自动钳制在 1-10', () => {
  const req = Request.createFromLegacyUI({ difficulty: 15 });
  assert.strictEqual(req.targetDifficulty, 10);

  const req2 = Request.createFromLegacyUI({ difficulty: 0 });
  assert.strictEqual(req2.targetDifficulty, 1);
});

test('isLegacyRequest 识别旧 UI 参数', () => {
  assert.strictEqual(Request.isLegacyRequest(Request.createFromLegacyUI({})), true);
  assert.strictEqual(Request.isLegacyRequest(Request.createRequest({})), false);
});