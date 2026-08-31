'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const StaticDifficulty = require(path.join(ROOT, 'shared', 'strategy', 'static-difficulty.js'));
const DifficultyStatic = require(path.join(ROOT, 'shared', 'difficulty-static.js'));
const KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

test('输出结构：level/scale/steps/allowBracket/allowMultDiv/staticMeta', () => {
  const r = StaticDifficulty.resolveStaticDifficulty(
    KP.get('math-g1-m0-make-ten'), 'calc', {}
  );
  assert.strictEqual(typeof r.level, 'number');
  assert.ok(r.level >= 1 && r.level <= 10);
  assert.strictEqual(typeof r.scale, 'number');
  assert.strictEqual(typeof r.steps, 'number');
  assert.strictEqual(typeof r.allowBracket, 'boolean');
  assert.strictEqual(typeof r.allowMultDiv, 'boolean');
  assert.ok(r.staticMeta);
  ['G', 'S', 'C', 'T', 'St', 'N', 'A', 'D', 'level'].forEach(k => {
    assert.strictEqual(typeof r.staticMeta[k], 'number', 'staticMeta.' + k);
  });
});

test('与现有引擎一致：level 等于 paramsForKnowledgePoint 的 level（禁止重实现）', () => {
  const kp = KP.get('math-g1-m0-make-ten');
  const direct = DifficultyStatic.paramsForKnowledgePoint(StaticDifficulty.toEngineMeta(kp), 'calc', {});
  const via = StaticDifficulty.resolveStaticDifficulty(kp, 'calc', {});
  assert.strictEqual(via.level, direct.level);
  assert.deepStrictEqual(via.staticMeta, direct.staticMeta);
});

test('Canonical → legacy 元数据映射：真实 KB 数据流入引擎', () => {
  const kp = KP.get('math-g1-m0-make-ten');
  const via = StaticDifficulty.resolveStaticDifficulty(kp, 'calc', {});
  // 认知层级「掌握」→ C=0.67；数值范围 1..20 → N>0；情境 standard → A=0.5
  assert.strictEqual(via.staticMeta.C, 0.67);
  assert.ok(via.staticMeta.N > 0, 'N 应反映 numberRange');
  assert.strictEqual(via.staticMeta.A, 0.5);
});

test('customParams 覆盖生成参数', () => {
  const r = StaticDifficulty.resolveStaticDifficulty(
    KP.get('math-g1-m0-make-ten'), 'calc', { steps: 5, allowBracket: true }
  );
  assert.strictEqual(r.steps, 5);
  assert.strictEqual(r.allowBracket, true);
});

test('questionType 缺失 -> 引擎默认取系数最高题型', () => {
  const r = StaticDifficulty.resolveStaticDifficulty(
    KP.get('math-g1-m0-make-ten'), null, {}
  );
  assert.ok(r.level >= 1 && r.level <= 10);
});

test('缺少 KnowledgePoint -> 抛出错误', () => {
  assert.throws(() => {
    StaticDifficulty.resolveStaticDifficulty(null, 'calc', {});
  }, /KnowledgePoint 不能为空/);
});
