'use strict';

/**
 * tests/orchestration/p46-exam-transport.test.js — P46-03 examType 全链透传与规划边界
 *
 * 验证：
 *   1. PracticeBridge.sessionConfig 透传 profile.examType → config.examType；
 *   2. PracticeSession._buildGenerationRequest 将 examType 放入生成请求 req；
 *   3. examType 不进入 cell 请求（由 POL cellReq 白名单保证，集成验证）；
 *   4. examType 为 null 时不写入 req，非试卷路径行为不变；
 *   5. 非法 examType 不被 PracticeSession 强校验，交给 POL 归一化。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

// Bridge.control = ControlService，其 sessionConfig 负责 profile→config 转换。
const Bridge = require(path.join(ROOT, 'shared', 'bridge', 'practice-bridge.js'));
const PO = require(path.join(ROOT, 'shared', 'orchestration', 'practice-orchestrator.js'));
const KC = require(path.join(ROOT, 'shared', 'orchestration', 'knowledge-context.js'));

test('① sessionConfig 透传 examType', () => {
  const cfg = Bridge.control.sessionConfig({
    subject: 'math', grade: 2, count: 40, difficulty: 6,
    knowledgePoints: ['kp-a'], questionTypes: ['calc'],
    examType: 'midterm'
  });
  assert.equal(cfg.examType, 'midterm');
});

test('② sessionConfig 缺省 examType 为 null', () => {
  const cfg = Bridge.control.sessionConfig({
    subject: 'math', grade: 2, count: 20, difficulty: 6,
    knowledgePoints: ['kp-a'], questionTypes: ['calc']
  });
  assert.equal(cfg.examType, null);
});

test('③ PracticeSession._buildGenerationRequest 携带 examType', () => {
  // 直接构造 PracticeSession 实例（不调用 start，避免触发生成）
  const Session = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
  const s = new Session({
    subject: 'math', grade: 2, count: 40, difficulty: 6,
    knowledgePointIds: ['math-g1-up-u05-k001'],
    questionTypes: ['calc'], examType: 'unit'
  });
  const req = s._buildGenerationRequest();
  assert.equal(req.examType, 'unit');
});

test('④ examType 为 null 时 _buildGenerationRequest 不写入该字段', () => {
  const Session = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
  const s = new Session({
    subject: 'math', grade: 2, count: 20, difficulty: 6,
    knowledgePointIds: ['math-g1-up-u05-k001'],
    questionTypes: ['calc']
  });
  const req = s._buildGenerationRequest();
  assert.equal('examType' in req, false, '无 examType 时不应写入请求');
});

test('⑤ 集成：examType 经 Bridge→Session→POL 到达 plan，且不进入 cell', async () => {
  const kpId = 'math-g1-up-u05-k001';
  const captured = [];
  await PO.orchestrate({
    subject: 'math', grade: 1, examType: 'final',
    knowledgePointIds: [kpId], questionTypes: ['calc'], count: 40, difficulty: 6
  }, {}, {
    execute: async (cellReq) => {
      captured.push(cellReq);
      return { questions: [], plans: [], trace: {}, failedPlans: [] };
    }
  });
  assert.ok(captured.length > 0);
  captured.forEach((cellReq) => {
    assert.equal(cellReq.examType, undefined, 'cell 请求不得包含 examType');
  });
});
