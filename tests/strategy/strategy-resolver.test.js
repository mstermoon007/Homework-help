'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Resolver = require(path.join(ROOT, 'shared', 'strategy', 'strategy-resolver.js'));
const StrategyError = require(path.join(ROOT, 'shared', 'strategy', 'strategy-error.js')).StrategyError;

test('resolveKnowledgePoint 返回标准 KP', () => {
  const kp = Resolver.resolveKnowledgePoint('math-g1-m0-make-ten');
  assert.ok(kp);
  assert.strictEqual(kp.id, 'math-g1-m0-make-ten');
  assert.ok(kp.knowledge);
  assert.ok(kp.generation);
});

test('KP 不存在 -> 抛出 StrategyError(KP_NOT_FOUND)', () => {
  let threw = false;
  try {
    Resolver.resolveKnowledgePoint('__no_such_kp__');
  } catch (e) {
    assert.ok(e instanceof StrategyError);
    assert.strictEqual(e.code, 'KP_NOT_FOUND');
    threw = true;
  }
  assert.ok(threw, '应抛出异常');
});

test('KP ID 为空/非字符串 -> 抛出 INVALID_REQUEST', () => {
  let threw = false;
  try {
    Resolver.resolveKnowledgePoint('');
  } catch (e) {
    assert.ok(e.code === 'INVALID_REQUEST');
    threw = true;
  }
  assert.ok(threw);
});

test('resolveMultiple 批量解析', () => {
  const ids = ['math-g1-m0-make-ten', '__no_such__'];
  const result = Resolver.resolveMultiple(ids);
  assert.ok(result['math-g1-m0-make-ten']);
  assert.strictEqual(result['__no_such__'], null);
});

test('hasKnowledgePoint 检查存在性', () => {
  assert.ok(Resolver.hasKnowledgePoint('math-g1-m0-make-ten'));
  assert.strictEqual(Resolver.hasKnowledgePoint('__no_such__'), false);
});