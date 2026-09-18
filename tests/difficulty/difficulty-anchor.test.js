'use strict';

/**
 * tests/difficulty/difficulty-anchor.test.js — 年级难度锚点门禁（M16 重建）
 *
 * 数据源：KBL canonical seedDifficulty（复用 dev/difficulty-anchor-table.js 锚点表）。
 *   1) seedDifficulty 均为 [1,10] 整数
 *   2) 每年级 KP 落在锚点区间 [gMin,gMax]（允许 1 个已知例外：math-g4-up-u09-k001）
 *   3) 年级上限螺旋单调（不递减）
 *   4) 映射公式 mapToAbs 单调（d=1..5 不递减）
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const KC = require(path.join(ROOT, 'shared', 'orchestration', 'knowledge-context.js'));
const { ANCHOR, mapToAbs } = require(path.join(ROOT, 'dev', 'difficulty-anchor-table.js'));

const KNOWN_OUTLIERS = new Set([]);

function scan() {
  const byGrade = {};
  const badVal = [];
  const missing = [];
  const outliers = [];
  for (let g = 1; g <= 6; g++) {
    byGrade[g] = [];
    KC.kpsForGrade('math', g).forEach((kp) => {
      const d = kp.difficultyAnnotation && kp.difficultyAnnotation.seedDifficulty;
      if (d == null) { missing.push(kp.knowledgeId); return; }
      if (!Number.isInteger(d) || d < 1 || d > 10) badVal.push(kp.knowledgeId + ':' + d);
      byGrade[g].push(d);
      const a = ANCHOR[g];
      if (d < a[0] || d > a[1]) {
        if (!KNOWN_OUTLIERS.has(kp.knowledgeId)) outliers.push('G' + g + ' ' + kp.knowledgeId + '=' + d);
      }
    });
  }
  return { byGrade: byGrade, badVal: badVal, missing: missing, outliers: outliers };
}

test('全库 seedDifficulty 为 [1,10] 整数（缺失 SKIP+WARN）', () => {
  const r = scan();
  if (r.missing.length) console.log('[WARN] 缺 seedDifficulty 已 SKIP（' + r.missing.length + '）');
  assert.deepEqual(r.badVal, []);
});

test('每年级落在锚点区间（除已知例外，0 新增越界）', () => {
  const r = scan();
  assert.deepEqual(r.outliers, [], '新增锚点越界: ' + r.outliers.join(' | '));
  for (let g = 1; g <= 6; g++) {
    const a = ANCHOR[g];
    const min = Math.min.apply(null, r.byGrade[g]);
    const max = Math.max.apply(null, r.byGrade[g]);
    assert.ok(max <= a[1], 'G' + g + ' 上限 ' + max + ' > ' + a[1]);
  }
});

test('年级上限螺旋单调（不递减）', () => {
  const r = scan();
  let prev = -Infinity;
  for (let g = 1; g <= 6; g++) {
    const max = Math.max.apply(null, r.byGrade[g]);
    assert.ok(max >= prev, 'G' + g + ' 上限倒挂');
    prev = max;
  }
});

test('映射公式 mapToAbs 单调（d=1..5 不递减，且落在锚点区间内）', () => {
  for (let g = 1; g <= 6; g++) {
    const a = ANCHOR[g];
    let prev = -Infinity;
    for (let d = 1; d <= 5; d++) {
      const abs = mapToAbs(g, d);
      assert.ok(abs != null, 'G' + g + ' d=' + d + ' 可映射');
      assert.ok(abs >= prev, 'G' + g + ' d=' + d + ' 倒挂');
      assert.ok(abs >= a[0] && abs <= a[1], 'G' + g + ' d=' + d + ' 越界');
      prev = abs;
    }
  }
});
