'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const DifficultyStrategy = require(path.join(ROOT, 'shared', 'strategy', 'difficulty-strategy.js'));
const StaticDifficulty = require(path.join(ROOT, 'shared', 'strategy', 'static-difficulty.js'));
const KP = require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-point.js'));

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

test('P0-02 Step 8：用户显式难度权威，不叠加内容/结构偏移', () => {
  const r = DifficultyStrategy.resolveComposedDifficulty({ base: 5 });
  assert.strictEqual(r.composedDifficulty, 6); // 5(standard)+1
  assert.strictEqual(r.composition.source, 'composed');
  const ru = DifficultyStrategy.resolveComposedDifficulty({ base: 5, hasUserDifficulty: true });
  assert.strictEqual(ru.composedDifficulty, 5);
  assert.strictEqual(ru.composition.source, 'user');
  assert.strictEqual(ru.composition.questionComplexityAdjustment, 0);
  assert.strictEqual(ru.composition.compositeAdjustment, 0);
});

test('P0-02 Step 8：question complexity 偏移（standard +1 / complex +2）', () => {
  assert.strictEqual(DifficultyStrategy.resolveComposedDifficulty({ base: 4 }).composedDifficulty, 5);
  assert.strictEqual(DifficultyStrategy.resolveComposedDifficulty({ base: 8 }).composedDifficulty, 10);
  // 低档（simple）不加偏移
  assert.strictEqual(DifficultyStrategy.resolveComposedDifficulty({ base: 3 }).composedDifficulty, 3);
});

test('P0-02 Step 8：composite complexity 偏移（显式复合结构 +1）', () => {
  const bracket = { structure: { allowBracket: true, allowMultDiv: false } };
  const sem = { structure: { allowBracket: false } };
  const simple = { structure: { allowBracket: false } };
  assert.strictEqual(DifficultyStrategy.compositeComplexityOf(bracket), 1);
  assert.strictEqual(DifficultyStrategy.compositeComplexityOf(sem), 0);
  assert.strictEqual(DifficultyStrategy.compositeComplexityOf(simple), 0);
  const r = DifficultyStrategy.resolveComposedDifficulty({ base: 4, knowledgePoint: bracket });
  assert.strictEqual(r.composedDifficulty, 6);
  assert.strictEqual(r.composition.compositeAdjustment, 1);
});

test('P0-02 Step 8：competition mode profile —— 未显式难度时向年级锚点上沿顶格且不越过', () => {
  const r = DifficultyStrategy.resolveComposedDifficulty({ base: 3, mode: 'competition', grade: 1 });
  assert.strictEqual(r.composedDifficulty, 2); // G1 锚点 [1,2] 上沿
  const rHigh = DifficultyStrategy.resolveComposedDifficulty({ base: 9, mode: 'competition', grade: 4 });
  assert.strictEqual(rHigh.composedDifficulty, 7); // G4 锚点 [4,7] 上沿，不越过
  // 用户显式难度不被 mode profile 改
  const ru = DifficultyStrategy.resolveComposedDifficulty({ base: 9, mode: 'competition', grade: 1, hasUserDifficulty: true });
  assert.strictEqual(ru.composedDifficulty, 9);
});
