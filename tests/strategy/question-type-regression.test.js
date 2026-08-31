'use strict';

/**
 * M3-25 题型回归测试
 * 指定题型 / 不指定题型 / 非法题型 / KP 不支持题型
 * 要求：合法 → 正常 Plan；非法 → 明确拒绝。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
const KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

const KP_ID = 'math-g1-m0-make-ten';

test('指定题型（合法）-> 正常 Plan', () => {
  const r = Engine.plan({ knowledgePointId: KP_ID, count: 2, questionType: 'calc' });
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.plans[0].questionTypeId, 'calc');
});

test('指定 subtype（legacy 归一化）-> 正常 Plan', () => {
  const r = Engine.plan({ knowledgePointId: KP_ID, count: 2, subtype: 'cushi' });
  assert.strictEqual(r.plans[0].questionTypeId, 'calc');
  assert.strictEqual(r.plans[0].subtype, 'cushi');
});

test('不指定题型 -> KP 默认题型（正常 Plan）', () => {
  const r = Engine.plan({ knowledgePointId: KP_ID, count: 2 });
  assert.strictEqual(r.valid, true);
  const caps = require(path.join(ROOT, 'shared', 'capability-resolver.js')).getCapabilities(KP.get(KP_ID));
  assert.ok(caps.questionTypes.includes(r.plans[0].questionTypeId));
});

test('非法题型 -> 明确拒绝', () => {
  assert.throws(() => {
    Engine.plan({ knowledgePointId: KP_ID, count: 2, questionType: 'invalid_type' });
  }, /非法 questionType/);
});

test('KP 不支持题型 -> 明确拒绝', () => {
  assert.throws(() => {
    Engine.plan({ knowledgePointId: KP_ID, count: 2, questionType: 'geometry' });
  }, /KP 不支持该题型/);
});

test('拒绝时抛出 StrategyError（不允许进入 Generator）', () => {
  try {
    Engine.plan({ knowledgePointId: KP_ID, count: 2, questionType: 'geometry' });
    assert.fail('应当抛出');
  } catch (e) {
    assert.strictEqual(e.name, 'StrategyError');
    assert.strictEqual(e.code, 'NO_CAPABILITY');
  }
});
