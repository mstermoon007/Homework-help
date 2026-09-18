'use strict';

/**
 * tests/difficulty/difficulty-distribution-regression.test.js — 分布回归（M16）
 *
 * 数据源：KBL canonical（KnowledgeContext）的 difficultyAnnotation.seedDifficulty。
 *   375 KP：375 有值（usable）→ 纳入测试；0 缺失（canonical 派生全覆盖）。
 * 断言：静态公式对 usable KP 产出的 level ∈ [1,10]、分布守恒、确定性。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const KC = require(path.join(ROOT, 'shared', 'orchestration', 'knowledge-context.js'));
const StaticDifficulty = require(path.join(ROOT, 'shared', 'strategy', 'static-difficulty.js'));
const DS = require(path.join(ROOT, 'shared', 'catalog', 'difficulty-static.js'));

function collect() {
  const rows = [];
  const missing = [];
  for (let g = 1; g <= 6; g++) {
    KC.kpsForGrade('math', g).forEach((kp) => {
      const seed = kp.difficultyAnnotation && kp.difficultyAnnotation.seedDifficulty;
      if (seed == null) { missing.push(kp.knowledgeId); return; }
      rows.push({ grade: g, id: kp.knowledgeId, seed: seed, kp: kp });
    });
  }
  return { rows: rows, missing: missing };
}

test('数据覆盖：total=375 / usable=375 / missing=0（canonical 全覆盖）', () => {
  const { rows, missing } = collect();
  const total = rows.length + missing.length;
  console.log('[difficulty-distribution] total=' + total + ' usable=' + rows.length + ' missing=' + missing.length);
  if (missing.length) console.log('[WARN] 缺 seedDifficulty 已 SKIP（' + missing.length + '）：' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? ' …' : ''));
  assert.equal(total, 375);
  assert.equal(rows.length, 375);
  assert.equal(missing.length, 0);
});

test('静态公式输出：全部 usable KP 的 level ∈ [1,10]、D ∈ [1,10]、结构合法', () => {
  const { rows } = collect();
  const dist = {};
  rows.forEach((r) => {
    const view = KC.strategyView(r.id);
    const out = StaticDifficulty.resolveStaticDifficulty(view, 'calc');
    assert.ok(out.level >= 1 && out.level <= 10, r.id + ' level');
    assert.ok(out.staticMeta.D >= 1 && out.staticMeta.D <= 10, r.id + ' D');
    assert.ok(out.steps >= 1 && out.steps <= 5, r.id + ' steps');
    dist[out.level] = (dist[out.level] || 0) + 1;
  });
  const sum = Object.keys(dist).reduce((a, k) => a + dist[k], 0);
  assert.equal(sum, rows.length, '分布守恒');
  console.log('[difficulty-distribution] level 分布:', JSON.stringify(dist));
});

test('确定性：同输入两次输出一致（无随机）', () => {
  const { rows } = collect();
  const sample = rows.slice(0, 20);
  sample.forEach((r) => {
    const a = StaticDifficulty.resolveStaticDifficulty(KC.strategyView(r.id), 'calc');
    const b = StaticDifficulty.resolveStaticDifficulty(KC.strategyView(r.id), 'calc');
    assert.deepEqual(a, b);
  });
});

test('权重/结构关系：D 与 paramsForKnowledgePoint 的 staticMeta.D 一致（唯一公式）', () => {
  const { rows } = collect();
  rows.slice(0, 30).forEach((r) => {
    const view = KC.strategyView(r.id);
    const meta = StaticDifficulty.toEngineMeta(view);
    const direct = DS.paramsForKnowledgePoint(meta, 'calc');
    const via = StaticDifficulty.resolveStaticDifficulty(view, 'calc');
    assert.equal(via.level, direct.level);
    assert.ok(Math.abs(via.staticMeta.D - direct.staticMeta.D) < 1e-9);
  });
});
