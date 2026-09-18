'use strict';

/**
 * tests/difficulty/difficulty-static-weights.test.js — 静态难度公式契约（M16）
 *
 * 锁定 Difficulty Authority 的唯一公式与权重表：
 *   wsum = 0.12G + 0.15S + 0.12C + 0.08T + 0.12St + 0.08N + 0.12A + 0.15Comb
 *   D = 1 + 9 × (wsum / 0.94)，level = clamp(round(D), 1, 10)
 *
 * 本测试只做契约断言（不新增计算实现）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DS = require(path.join(ROOT, 'shared', 'catalog', 'difficulty-static.js'));

const WEIGHTS = { G: 0.12, S: 0.15, C: 0.12, T: 0.08, St: 0.12, N: 0.08, A: 0.12, Comb: 0.15 };
const WSUM_MAX = 0.94;

const MAX_META = {
  difficulty: 10,
  spiral_level: 6,
  max_spiral_level: 6,
  cognitive_level: '运用',
  applicable_question_types: [{ type: 'open', coefficient: 1 }],
  max_steps_default: 5,
  number_range_default: { min: 1, max: 100000 },
  context_default: 'complex',
  operator_types: ['+', '−', '×']
};

const MIN_META = {
  difficulty: 1,
  spiral_level: 1,
  max_spiral_level: 1,
  cognitive_level: '了解',
  applicable_question_types: [{ type: 'calc', coefficient: 1 }],
  max_steps_default: 1,
  number_range_default: { min: 1, max: 1 },
  context_default: 'pure',
  operator_types: ['+']
};

function recomputeD(meta) {
  const sm = meta.staticMeta;
  const wsum = WEIGHTS.G * sm.G + WEIGHTS.S * sm.S + WEIGHTS.C * sm.C + WEIGHTS.T * sm.T +
    WEIGHTS.St * sm.St + WEIGHTS.N * sm.N + WEIGHTS.A * sm.A + WEIGHTS.Comb * sm.Comb;
  return 1 + 9 * (wsum / WSUM_MAX);
}

test('权重表契约：staticMeta.D 与文档权重/WSUM_MAX 一致（0.12/0.15/0.12/0.08/0.12/0.08/0.12/0.15，0.94）', () => {
  [MAX_META, MIN_META].forEach((meta) => {
    const r = DS.paramsForKnowledgePoint(meta, meta.applicable_question_types[0].type);
    assert.ok(Math.abs(recomputeD(r) - r.staticMeta.D) < 1e-9, 'D 与权重表推导一致');
    assert.ok(Math.abs(r.difficulty - Math.min(10, Math.max(1, Math.round(r.staticMeta.D)))) < 1e-9, 'level = clamp(round(D))');
  });
});

test('可达性：全维满值 → level 10；全维最低 → level 1', () => {
  const hi = DS.paramsForKnowledgePoint(MAX_META, 'open');
  const lo = DS.paramsForKnowledgePoint(MIN_META, 'calc');
  assert.equal(hi.level, 10);
  assert.equal(lo.level, 1);
});

test('单调性：单维提升不降低 level', () => {
  const base = DS.paramsForKnowledgePoint(MIN_META, 'calc');
  const higher = DS.paramsForKnowledgePoint(Object.assign({}, MIN_META, { max_steps_default: 5, number_range_default: { min: 1, max: 100000 } }), 'calc');
  assert.ok(higher.level >= base.level);
  assert.ok(higher.staticMeta.St >= base.staticMeta.St);
  assert.ok(higher.staticMeta.N >= base.staticMeta.N);
});

test('输出结构：level/scale/steps/allowBracket/allowMultDiv + staticMeta 八维齐备', () => {
  const r = DS.paramsForKnowledgePoint(MAX_META, 'open');
  ['level', 'scale', 'steps', 'allowBracket', 'allowMultDiv'].forEach((k) => assert.ok(k in r, k));
  ['G', 'S', 'C', 'T', 'St', 'N', 'A', 'Comb', 'D', 'level'].forEach((k) => assert.ok(k in r.staticMeta, 'staticMeta.' + k));
});
