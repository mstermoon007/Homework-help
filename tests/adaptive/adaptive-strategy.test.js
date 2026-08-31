'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Adaptive = require(path.join(ROOT, 'shared', 'strategy', 'adaptive-strategy.js'));
const LearnerModel = require(path.join(ROOT, 'shared', 'learner', 'learner-model.js'));

// 构造熟练度各异的 KpState
function kp(fields) {
  return LearnerModel.normalizeKpState(Object.assign({
    kpId: 'KP',
    mastery: 0.5,
    confidence: 0.5,
    attempts: 20,
    correct: 14,
    accuracy: 0.7,
    recentAccuracy: 0.7,
    recentResults: [1, 0, 1, 1, 1, 0, 1, 1],
    errorPatterns: {}
  }, fields), 'KP');
}

function resolve(opts) {
  return Adaptive.resolve(Object.assign({
    kpId: 'KP', learnerState: null, staticDifficulty: 5,
    difficulty: null, allowDifficultyOverride: true,
    adaptiveMode: 'new', legacyDelta: 0
  }, opts));
}

test('M6-R12 无记录：adjustment=0，难度不动，spiral 从最低开始', () => {
  const r = resolve({});
  assert.strictEqual(r.adjustment, 0);
  assert.strictEqual(r.effectiveDifficulty, 5);
  assert.strictEqual(r.targetSpiralLevel, 1);
  assert.strictEqual(r.variant, '基础');
});

test('M6-R13/14 低掌握 → 降难度（-1）；高掌握 → 升难度（+1）', () => {
  const low = resolve({ learnerState: kp({ mastery: 0.2, recentAccuracy: 0.2, confidence: 0.6, recentResults: [0, 0, 0, 0, 0] }) });
  assert.strictEqual(low.adjustment, -1);
  assert.strictEqual(low.effectiveDifficulty, 4);

  const high = resolve({ learnerState: kp({ mastery: 0.9, confidence: 0.8, recentAccuracy: 0.9, recentResults: [1, 1, 1, 1, 1] }) });
  assert.ok(high.adjustment >= 1, '高掌握 adjustment 应为 +1~+2, got ' + high.adjustment);
  assert.ok(high.effectiveDifficulty >= 6);
});

test('M6-R14 高度熟练且稳定 → 难度 +2（限幅内）', () => {
  const r = resolve({
    learnerState: kp({ mastery: 0.9, confidence: 0.8, recentAccuracy: 0.9, recentResults: [1, 1, 1, 1, 1] })
  });
  assert.strictEqual(r.adjustment, 2);
  assert.strictEqual(r.effectiveDifficulty, 7);
  assert.ok(r.adjustment <= Adaptive.ADJ_MAX);
});

test('M6-R15 连续错误 + 高 mastery → 不升难度（streak 保护）', () => {
  const r = resolve({
    learnerState: kp({ mastery: 0.9, confidence: 0.8, recentAccuracy: 0.3, recentResults: [0, 0, 0, 0, 0] })
  });
  // mastery 高但最近全错：连续错误保护不允许 +2
  assert.ok(r.adjustment <= 0, '最近连错时不得升难度, got ' + r.adjustment);
});

test('M6-R08 低置信/零尝试 → 难度不动 or 折半', () => {
  // 从未作答：adjustment 0
  const fresh = resolve({});
  assert.strictEqual(fresh.adjustment, 0);
  // 仅 1 次尝试 → 小样本折半（±1 以内）
  const one = resolve({ learnerState: kp({ mastery: 0.9, confidence: 0.2, attempts: 1, correct: 1, recentResults: [1] }) });
  assert.ok(Math.abs(one.adjustment) <= 1, '小样本 adjustment 限 ±1, got ' + one.adjustment);
});

test('M6-R16 spiral 随掌握度提升', () => {
  const low = resolve({ learnerState: kp({ mastery: 0.15, confidence: 0.5, recentAccuracy: 0.1, recentResults: [0] }) });
  const high = resolve({ learnerState: kp({ mastery: 0.95, confidence: 0.8, recentAccuracy: 0.95, recentResults: [1, 1, 1] }) });
  assert.ok(high.targetSpiralLevel >= low.targetSpiralLevel,
    `${high.targetSpiralLevel} >= ${low.targetSpiralLevel}`);
  assert.ok(high.targetSpiralLevel >= 3);
});

test('M6-R17 错因聚焦：高频错因出现于 errorFocus', () => {
  const st = kp({
    mastery: 0.3,
    errorPatterns: {
      '计算错误': { errorType: '计算错误', count: 2, recentCount: 2, confidence: 0.7 }
    }
  });
  const r = resolve({ learnerState: st });
  assert.ok(r.errorFocus.includes('计算错误'), 'errorFocus 应包含高频错因');
});

test('M6-R18 变体随掌握度迁移：基础→数值/呈现→情境/结构→迁移', () => {
  const a = resolve({ learnerState: kp({ mastery: 0.2 }) });
  const b = resolve({ learnerState: kp({ mastery: 0.5, confidence: 0.5 }) });
  const c = resolve({ learnerState: kp({ mastery: 0.75, confidence: 0.65 }) });
  const e = resolve({ learnerState: kp({ mastery: 0.95, confidence: 0.85 }) });
  assert.strictEqual(a.variant, '基础');
  assert.ok(['数值', '呈现'].includes(b.variant), '掌握中 → 数值/呈现, got ' + b.variant);
  assert.ok(['情境', '结构'].includes(c.variant), '熟练 → 情境/结构, got ' + c.variant);
  assert.strictEqual(e.variant, '迁移');
});

test('M6-R22 shadow/legacy：新旧对照，实际用 legacy', () => {
  const shadow = resolve({
    adaptiveMode: 'shadow', legacyDelta: 1,
    learnerState: kp({ mastery: 0.2, recentAccuracy: 0.1, recentResults: [0, 0, 0] }) // learner 想降难度
  });
  assert.strictEqual(shadow.mode, 'shadow');
  assert.strictEqual(shadow.effectiveDifficulty, 6, 'shadow 采用 legacy 结果');
  assert.ok(shadow.shadow, 'shadow 附带对照信息');
  assert.deepStrictEqual(shadow.shadow, {
    legacyDelta: 1,
    learnerAdjustment: -1,
    legacyEffective: 6,
    learnerEffective: 4
  });

  const legacy = resolve({
    adaptiveMode: 'legacy', legacyDelta: -2,
    learnerState: kp({ mastery: 0.9 })
  });
  assert.strictEqual(legacy.mode, 'legacy');
  assert.strictEqual(legacy.effectiveDifficulty, 3, 'legacy 用旧 delta');
  assert.ok(!legacy.shadow);
});

test('M6-R13 难度限幅：adjustment ∈ [-2, +2]，effective ∈ [1, 10]', () => {
  const r = resolve({
    learnerState: kp({ mastery: 0.9, confidence: 0.9, recentAccuracy: 0.95, recentResults: [1, 1, 1] }),
    staticDifficulty: 1
  });
  assert.ok(r.adjustment >= -2 && r.adjustment <= 2);
  assert.ok(r.effectiveDifficulty >= 1 && r.effectiveDifficulty <= 10);

  const lo = resolve({
    learnerState: kp({ mastery: 0.05, confidence: 0.9, recentAccuracy: 0, recentResults: [0, 0, 0] }),
    staticDifficulty: 10
  });
  assert.ok(lo.effectiveDifficulty >= 1 && lo.effectiveDifficulty <= 10);
});