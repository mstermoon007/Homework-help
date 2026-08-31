'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const TargetDifficulty = require(path.join(ROOT, 'shared', 'strategy', 'target-difficulty.js'));
const StaticDifficulty = require(path.join(ROOT, 'shared', 'strategy', 'static-difficulty.js'));
const KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

const MAKE_TEN = () => KP.get('math-g1-m0-make-ten');
const staticLevel = () => StaticDifficulty.resolveStaticDifficulty(MAKE_TEN(), 'calc', {}).level;

test('用户明确选择难度且允许覆盖 -> targetDifficulty = 用户难度', () => {
  const r = TargetDifficulty.resolveTargetDifficulty({ knowledgePoint: MAKE_TEN(), questionType: 'calc', difficulty: 7 });
  assert.strictEqual(r.targetDifficulty, 7);
  assert.strictEqual(r.source, 'user');
  assert.strictEqual(r.effectiveDifficulty, 7);
});

test('未选择难度 -> KnowledgePoint → StaticDifficulty', () => {
  const r = TargetDifficulty.resolveTargetDifficulty({ knowledgePoint: MAKE_TEN(), questionType: 'calc' });
  assert.strictEqual(r.targetDifficulty, staticLevel());
  assert.strictEqual(r.source, 'static');
});

test('不允许覆盖 -> staticDifficulty（忽略用户难度）', () => {
  const r = TargetDifficulty.resolveTargetDifficulty({
    knowledgePoint: MAKE_TEN(), questionType: 'calc', difficulty: 9, allowDifficultyOverride: false
  });
  assert.strictEqual(r.targetDifficulty, staticLevel());
  assert.strictEqual(r.source, 'static');
  assert.strictEqual(r.requestedDifficulty, 9);
});

test('用户难度小数 -> 四舍五入 clamp 1..10', () => {
  const r = TargetDifficulty.resolveTargetDifficulty({ knowledgePoint: MAKE_TEN(), difficulty: 1.6 });
  assert.strictEqual(r.targetDifficulty, 2);
  const r2 = TargetDifficulty.resolveTargetDifficulty({ knowledgePoint: MAKE_TEN(), difficulty: 99 });
  assert.strictEqual(r2.targetDifficulty, 10);
});

test('自适应开启 -> effective = clamp(target + delta, 1, 10)', () => {
  const r = TargetDifficulty.resolveTargetDifficulty({
    knowledgePoint: MAKE_TEN(), questionType: 'calc', difficulty: 5, adaptive: true, adaptiveDelta: 2
  });
  assert.strictEqual(r.targetDifficulty, 5);
  assert.strictEqual(r.effectiveDifficulty, 7);

  const rClamp = TargetDifficulty.resolveTargetDifficulty({
    knowledgePoint: MAKE_TEN(), questionType: 'calc', difficulty: 9, adaptive: true, adaptiveDelta: 5
  });
  assert.strictEqual(rClamp.effectiveDifficulty, 10);

  const rLow = TargetDifficulty.resolveTargetDifficulty({
    knowledgePoint: MAKE_TEN(), questionType: 'calc', difficulty: 2, adaptive: true, adaptiveDelta: -10
  });
  assert.strictEqual(rLow.effectiveDifficulty, 1);
});

test('自适应关闭（缺省）-> effective = targetDifficulty', () => {
  const r = TargetDifficulty.resolveTargetDifficulty({ knowledgePoint: MAKE_TEN(), questionType: 'calc', difficulty: 6 });
  assert.strictEqual(r.adaptive, false);
  assert.strictEqual(r.adaptiveDelta, 0);
  assert.strictEqual(r.effectiveDifficulty, 6);
});

test('difficulty 非有限数字 -> 抛出错误', () => {
  ['7', NaN, Infinity].forEach(bad => {
    assert.throws(() => {
      TargetDifficulty.resolveTargetDifficulty({ knowledgePoint: MAKE_TEN(), difficulty: bad });
    }, /difficulty 必须是有限数字/);
  });
});

test('自适应开启但 adaptiveDelta 非法 -> 抛出错误', () => {
  assert.throws(() => {
    TargetDifficulty.resolveTargetDifficulty({ knowledgePoint: MAKE_TEN(), adaptive: true, adaptiveDelta: 'x' });
  }, /adaptiveDelta 必须是有限数字/);
});

test('knowledgePointId 解析', () => {
  const r = TargetDifficulty.resolveTargetDifficulty({ knowledgePointId: 'math-g1-m0-make-ten', difficulty: 4 });
  assert.strictEqual(r.targetDifficulty, 4);
  assert.strictEqual(r.source, 'user');
});
