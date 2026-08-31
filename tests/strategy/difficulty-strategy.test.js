'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const DifficultyStrategy = require(path.join(ROOT, 'shared', 'strategy', 'difficulty-strategy.js'));
const StaticDifficulty = require(path.join(ROOT, 'shared', 'strategy', 'static-difficulty.js'));
const KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

const MAKE_TEN = () => KP.get('math-g1-m0-make-ten');

test('无 adaptiveDelta -> 默认 0，effective === staticLevel', () => {
  const staticLevel = StaticDifficulty.resolveStaticDifficulty(MAKE_TEN(), 'calc', {}).level;
  const r = DifficultyStrategy.computeEffectiveDifficulty({ knowledgePoint: MAKE_TEN(), questionType: 'calc' });
  assert.strictEqual(r.adaptiveDelta, 0);
  assert.strictEqual(r.staticLevel, staticLevel);
  assert.strictEqual(r.effectiveDifficulty, staticLevel);
});

test('effectiveDifficulty = staticLevel + adaptiveDelta', () => {
  const staticLevel = StaticDifficulty.resolveStaticDifficulty(MAKE_TEN(), 'calc', {}).level;
  const r = DifficultyStrategy.computeEffectiveDifficulty({ knowledgePoint: MAKE_TEN(), questionType: 'calc', adaptiveDelta: 2 });
  assert.strictEqual(r.staticLevel, staticLevel);
  assert.strictEqual(r.effectiveDifficulty, staticLevel + 2);
});

test('clamp 上限 10', () => {
  const r = DifficultyStrategy.computeEffectiveDifficulty({ knowledgePoint: MAKE_TEN(), questionType: 'calc', adaptiveDelta: 100 });
  assert.strictEqual(r.effectiveDifficulty, 10);
});

test('clamp 下限 1', () => {
  const r = DifficultyStrategy.computeEffectiveDifficulty({ knowledgePoint: MAKE_TEN(), questionType: 'calc', adaptiveDelta: -100 });
  assert.strictEqual(r.effectiveDifficulty, 1);
});

test('小数 delta -> 四舍五入到整数难度', () => {
  const staticLevel = StaticDifficulty.resolveStaticDifficulty(MAKE_TEN(), 'calc', {}).level;
  const r = DifficultyStrategy.computeEffectiveDifficulty({ knowledgePoint: MAKE_TEN(), questionType: 'calc', adaptiveDelta: 0.5 });
  assert.strictEqual(r.effectiveDifficulty, Math.round(staticLevel + 0.5));
});

test('adaptiveDelta 非法（字符串/NaN/Infinity）-> 抛出错误', () => {
  ['3', NaN, Infinity].forEach(bad => {
    assert.throws(() => {
      DifficultyStrategy.computeEffectiveDifficulty({ knowledgePoint: MAKE_TEN(), questionType: 'calc', adaptiveDelta: bad });
    }, /adaptiveDelta 必须是有限数字/);
  });
});

test('knowledgePointId 解析', () => {
  const r = DifficultyStrategy.computeEffectiveDifficulty({ knowledgePointId: 'math-g1-m0-make-ten', questionType: 'calc' });
  assert.ok(r.effectiveDifficulty >= 1 && r.effectiveDifficulty <= 10);
});

test('未知 knowledgePointId -> 抛出错误', () => {
  assert.throws(() => {
    DifficultyStrategy.computeEffectiveDifficulty({ knowledgePointId: 'not-exist', questionType: 'calc' });
  }, /知识点不存在/);
});

test('缺少 KnowledgePoint -> 抛出错误', () => {
  assert.throws(() => {
    DifficultyStrategy.computeEffectiveDifficulty({ questionType: 'calc' });
  }, /KnowledgePoint 不能为空/);
});
