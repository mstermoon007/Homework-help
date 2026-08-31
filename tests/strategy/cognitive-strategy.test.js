'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Cognitive = require(path.join(ROOT, 'shared', 'strategy', 'cognitive-strategy.js'));
const Registry = require(path.join(ROOT, 'shared', 'question-type-registry.js'));
const KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

test('统一三层均为 Registry 枚举子集（不重新定义枚举）', () => {
  Cognitive.UNIFIED_LEVELS.forEach(l => {
    assert.ok(Registry.COGNITIVE_LEVELS.includes(l), l);
  });
});

test('① 用户明确指定 -> 归一化到统一三层', () => {
  assert.strictEqual(Cognitive.resolveCognitiveLevel({ knowledgePoint: KP.get('math-g1-m0-make-ten'), questionType: 'calc', cognitiveLevel: 'create' }), 'apply');
  assert.strictEqual(Cognitive.resolveCognitiveLevel({ knowledgePoint: KP.get('math-g1-m0-make-ten'), questionType: 'calc', cognitiveLevel: 'recall' }), 'recognize');
  assert.strictEqual(Cognitive.resolveCognitiveLevel({ knowledgePoint: KP.get('math-g1-m0-make-ten'), questionType: 'calc', cognitiveLevel: 'understand' }), 'understand');
});

test('① 非法 cognitiveLevel -> 抛出错误', () => {
  assert.throws(() => {
    Cognitive.resolveCognitiveLevel({ cognitiveLevel: 'mastery' });
  }, /非法 cognitiveLevel/);
});

test('② 题型支持范围过滤 ③：KP 掌握(apply) 但 oral 不支持 apply -> understand', () => {
  const r = Cognitive.resolveCognitiveLevel({ knowledgePoint: KP.get('math-g1-m0-make-ten'), questionType: 'oral' });
  assert.strictEqual(r, 'understand');
});

test('③ KP cognitiveLevel：掌握 -> apply', () => {
  const r = Cognitive.resolveCognitiveLevel({ knowledgePoint: KP.get('math-g1-m0-make-ten') });
  assert.strictEqual(r, 'apply');
});

test('④ 默认认知层级：无 KP 无题型 -> understand', () => {
  assert.strictEqual(Cognitive.resolveCognitiveLevel({}), 'understand');
});

test('④ 题型范围不含 understand（open: apply/analyze/create）-> apply', () => {
  assert.strictEqual(Cognitive.resolveCognitiveLevel({ questionType: 'open' }), 'apply');
});

test('kpToUnified：中文认知层级映射', () => {
  const fake = (raw) => ({ cognition: { raw } });
  assert.strictEqual(Cognitive.kpToUnified(fake('了解')), 'recognize');
  assert.strictEqual(Cognitive.kpToUnified(fake('理解')), 'understand');
  assert.strictEqual(Cognitive.kpToUnified(fake('掌握')), 'apply');
  assert.strictEqual(Cognitive.kpToUnified(fake('运用')), 'apply');
});

test('knowledgePointId 解析', () => {
  const r = Cognitive.resolveCognitiveLevel({ knowledgePointId: 'math-g1-m0-make-ten' });
  assert.strictEqual(r, 'apply');
});
