/**
 * tests/engine/boundary.test.js — M7-R28 assertGenerationBoundary 数据流断言
 *
 * 边界断言：UI → GenerationRequest → Strategy → QuestionPlan → Generator
 *   → Validator → SemanticQuestion → Renderer。
 * 跨层（尤其 UI→Plugin）检测报错。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
const GE = require(path.join(ROOT, 'shared', 'generation-engine.js'));

test('R28-1 assertGenerationBoundary 提供 violations/restore', () => {
  const b = GE.assertGenerationBoundary();
  assert.strictEqual(b.enabled, true);
  assert.ok(typeof b.violations === 'function');
  assert.ok(Array.isArray(b.violations()));
  b.restore();
});

test('R28-2 关闭时不拦截', () => {
  const b = GE.assertGenerationBoundary({ enabled: false });
  assert.strictEqual(b.enabled, false);
  b.restore();
});

test('R28-3 boundary 不影响正常 engine 生成', async () => {
  const b = GE.assertGenerationBoundary();
  try {
    const g = await GE.generate({ mode: 'single-kp', subject: 'math', grade: 1, knowledgePointId: 'math-g1-m1-addsub-10', count: 2 });
    assert.ok(g.questions.length === 2);
    assert.strictEqual(b.violations().length, 0);
  } finally {
    b.restore();
  }
});