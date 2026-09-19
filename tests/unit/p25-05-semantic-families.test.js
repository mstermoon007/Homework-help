'use strict';

/**
 * tests/unit/p25-05-semantic-families.test.js — P25-05 语义族映射
 *
 * 冻结不变量（计划 P25-05）：
 *   1. 375 KP 全覆盖、每 KP ≥1 族；引用族全部已定义；每族 ≥1 KP（无死族）。
 *   2. 一个 KP 可属多族；多族归属必须有证据，primary ∈ families。
 *   3. 归属全部机械派生自 KBL（semantic.family / name / unitName），
 *      每条归属携带 evidence（rule/field/matched），无 AI 推测。
 *   4. 已提交 JSON 与派生脚本实时结果逐字节一致（防漂移 SSOT）。
 *   5. 典型 KP 归属冻结（倍数/数论、分数乘除噪声单元、图形测量、分类、比例等）。
 *   6. 计划列出的 13 族全部存在；KBL 8 个粗 family 在 crosswalk 中全部可追溯。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const artifact = require(path.join(ROOT, 'kbl', 'teaching', 'semantic-families.json'));
const deriver = require(path.join(ROOT, 'dev', 'p25', 'derive-semantic-families.js'));

const PLAN_FAMILIES = [
  'integer-arithmetic', 'multiplicative-relation', 'multiple-ratio',
  'fraction', 'decimal', 'percent', 'unit-measurement',
  'geometric-figure', 'geometric-measurement', 'spatial-reasoning',
  'statistics-probability', 'classification', 'word-application'
];
const COARSE_FAMILIES = [
  'calculation', 'multiplication-division', 'fraction', 'decimal',
  'percent', 'geometry', 'statistics', 'application-word'
];

function kp(id) {
  return artifact.kpFamilies['math-' + id];
}

test('P25-05 词表：15 族定义完整，计划 13 族全部在场', () => {
  assert.equal(artifact.families.length, 15);
  artifact.families.forEach((f) => {
    assert.ok(f.id && f.name && f.purpose, '族定义不完整: ' + f.id);
    assert.equal(typeof f.planListed, 'boolean');
  });
  PLAN_FAMILIES.forEach((id) => {
    assert.ok(artifact.families.some((f) => f.id === id), '缺少计划语义族: ' + id);
  });
});

test('P25-05 覆盖：375 KP，每 KP ≥1 族，引用合法，族无死族', () => {
  const ids = Object.keys(artifact.kpFamilies);
  assert.equal(ids.length, 375);
  const defined = new Set(artifact.families.map((f) => f.id));
  const membershipCount = {};
  ids.forEach((id) => {
    const a = artifact.kpFamilies[id];
    assert.ok(a.families.length >= 1, id + ' 零族归属');
    assert.ok(defined.has(a.primary), id + ' primary 未定义: ' + a.primary);
    assert.ok(a.families.includes(a.primary), id + ' primary 不在 families');
    a.families.forEach((f) => {
      assert.ok(defined.has(f), id + ' 引用未定义族 ' + f);
      membershipCount[f] = (membershipCount[f] || 0) + 1;
    });
  });
  artifact.families.forEach((f) => {
    assert.ok((membershipCount[f.id] || 0) >= 1, '死族（无 KP）: ' + f.id);
  });
  assert.equal(artifact.coverage.totalKp, 375);
});

test('P25-05 证据：每条归属可溯源到 rule/field/matched', () => {
  Object.keys(artifact.kpFamilies).forEach((id) => {
    const a = artifact.kpFamilies[id];
    assert.ok(Array.isArray(a.evidence) && a.evidence.length >= a.families.length);
    a.families.forEach((f) => {
      const ev = a.evidence.find((e) => e.family === f);
      assert.ok(ev, id + ' 缺少证据: ' + f);
      assert.ok(ev.rule && ev.field && ev.matched, id + ' 证据字段不完整: ' + f);
      assert.ok(['name', 'unitName', 'semantic.family', 'semantic.family+name'].includes(ev.field),
        id + ' 证据 field 非 KBL 事实: ' + ev.field);
    });
  });
  assert.equal(artifact.meta.status, 'kbl-derived');
});

test('P25-05 多族：存在大量多族 KP 且数量在合理区间', () => {
  assert.ok(artifact.coverage.multiFamilyKp >= 100,
    '多族 KP 偏少: ' + artifact.coverage.multiFamilyKp);
  assert.ok(artifact.coverage.multiFamilyKp <= 200,
    '多族 KP 偏多（族边界失效）: ' + artifact.coverage.multiFamilyKp);
});

test('P25-05 SSOT：已提交 JSON 与派生脚本实时结果逐字节一致', () => {
  const live = deriver.build();
  assert.deepEqual(live, artifact, '语义族产物与派生规则漂移，请重跑 derive-semantic-families.js');
});

test('P25-05 crosswalk：KBL 8 个粗 family 全部可映射到新族', () => {
  COARSE_FAMILIES.forEach((c) => {
    assert.ok(artifact.coarseToFamilyCrosswalk[c], 'crosswalk 缺少粗族: ' + c);
    assert.ok(Object.keys(artifact.coarseToFamilyCrosswalk[c]).length >= 1);
  });
});

// ---------- 典型 KP 归属冻结 ----------

test('倍数族：倍的认识/倍数应用题归 multiple-ratio，数论倍数不混入', () => {
  assert.ok(kp('g2-down-u03-k003').families.includes('multiple-ratio'));
  assert.ok(kp('g2-down-u03-k004').families.includes('multiple-ratio'));
  assert.ok(kp('g2-down-u03-k005').families.includes('multiple-ratio'));
  // g5 因数与倍数单元是数论，不是倍比关系
  assert.ok(!kp('g5-down-u02-k001').families.includes('multiple-ratio'));
  assert.equal(kp('g5-down-u02-k001').primary, 'number-sense');
  assert.ok(!kp('g5-down-u02-k003').families.includes('multiple-ratio'));
  assert.equal(kp('g5-down-u02-k003').primary, 'number-sense');
  assert.equal(kp('g5-down-u02-k004').primary, 'number-sense'); // 奇数与偶数
});

test('分数乘除噪声单元 g6-up-u02：不挂任何图形族，按 name/unitName 归分数', () => {
  ['g6-up-u02-k001', 'g6-up-u02-k002', 'g6-up-u02-k003', 'g6-up-u02-k004'].forEach((id) => {
    const a = kp(id);
    assert.ok(!a.families.some((f) => /geometric|spatial/.test(f)), id + ' 误挂图形族');
    assert.ok(a.families.includes('fraction'), id + ' 应归分数族');
    assert.ok(a.flags.includes('coarse-family-conflict'), id + ' 应列账 root 冲突');
  });
  // k004 名称无领域词，由 unitName=分数乘法 提供证据，且属问题解决
  assert.ok(kp('g6-up-u02-k004').families.includes('word-application'));
  assert.ok(kp('g6-up-u02-k004').evidence.some((e) => e.field === 'unitName' && /分数/.test(e.matched)));
});

test('百分数族：折扣/税率/利率/成数/达标线归 percent，与分数族重叠', () => {
  assert.equal(kp('g6-down-u02-k001').primary, 'percent'); // 折扣
  assert.equal(kp('g6-down-u02-k003').primary, 'percent'); // 税率
  assert.equal(kp('g6-down-u02-k004').primary, 'percent'); // 利率
  assert.ok(kp('g6-down-u02-k002').families.includes('percent')); // 成数
  assert.ok(kp('g6-up-u05-k003').families.includes('percent'));   // 折扣应用
  assert.ok(kp('g6-up-u05-k003').families.includes('fraction')); // 百分数是分数特例
});

test('比例族：正反比例/比例尺/图形放缩归 ratio-proportion', () => {
  ['g6-down-u04-k001', 'g6-down-u04-k003', 'g6-down-u04-k004',
   'g6-down-u04-k005', 'g6-down-u04-k006', 'g6-down-u04-k007'].forEach((id) => {
    assert.equal(kp(id).primary, 'ratio-proportion', id);
  });
});

test('图形测量族：周长/面积/体积归 measurement，长度单位同时属计量单位族', () => {
  assert.equal(kp('g5-up-u06-k002').primary, 'geometric-measurement'); // 三角形的面积
  assert.ok(kp('g5-up-u06-k002').families.includes('geometric-figure'));
  assert.equal(kp('g5-down-u03-k003').primary, 'geometric-measurement'); // 表面积
  assert.equal(kp('g3-down-u03-k002').primary, 'geometric-measurement'); // 认识周长
  assert.deepEqual(kp('g2-up-u05-k001').families.sort(),
    ['geometric-measurement', 'unit-measurement'].sort());               // 认识厘米和米
  assert.ok(!kp('g2-up-u05-k001').families.includes('geometric-figure'));
});

test('空间族：观察/方向/位置/变换归 spatial-reasoning', () => {
  assert.equal(kp('g2-up-u04-k001').primary, 'spatial-reasoning'); // 辨认方向
  assert.equal(kp('g6-up-u01-k001').primary, 'spatial-reasoning'); // 数对确定位置
  assert.equal(kp('g6-up-u01-k003').primary, 'spatial-reasoning'); // 定位方法（名称无图形词）
  assert.equal(kp('g4-down-u02-k001').primary, 'spatial-reasoning'); // 观察物体
  assert.ok(kp('g3-down-u01-k001').families.includes('spatial-reasoning')); // 轴对称图形
  assert.ok(kp('g3-down-u01-k001').families.includes('geometric-figure'));
});

test('分类族：分类单元 primary=classification；几何分类仍以图形为主', () => {
  assert.equal(kp('g2-up-u01-k001').primary, 'classification');
  assert.equal(kp('g2-up-u01-k004').primary, 'classification');
  assert.ok(kp('g2-up-u01-k001').families.includes('statistics-probability'));
  assert.equal(kp('g4-down-u05-k004').primary, 'geometric-figure'); // 三角形的分类
  assert.ok(kp('g4-down-u05-k004').families.includes('classification'));
});

test('运算/乘除/小数族基线冻结', () => {
  assert.equal(kp('g1-down-u02-k002').primary, 'integer-arithmetic'); // 减法口算
  assert.equal(kp('g3-up-u02-k001').primary, 'integer-arithmetic');  // 混合运算定义
  assert.equal(kp('g2-up-u03-k002').primary, 'multiplicative-relation'); // 除法的含义
  assert.ok(kp('g2-up-u03-k002').families.includes('integer-arithmetic'));
  assert.equal(kp('g3-down-u07-k001').primary, 'decimal');           // 认识小数
  assert.equal(kp('g4-down-u04-k006').primary, 'decimal');           // 小数与单位换算
  assert.ok(kp('g4-down-u04-k006').families.includes('unit-measurement'));
});

test('数感/数论/负数：number-sense 边界冻结', () => {
  assert.equal(kp('g1-down-u03-k001').primary, 'number-sense'); // 数数
  assert.equal(kp('g6-down-u01-k001').primary, 'number-sense'); // 负数的意义
  assert.equal(kp('g5-up-u05-k001').primary, 'number-sense');   // 用字母表示数
  assert.equal(kp('g6-up-u03-k001').primary, 'fraction');       // 倒数的认识不因子串误归数感
  assert.ok(!kp('g6-up-u03-k001').families.includes('number-sense'));
});

test('问题解决/综合实践：应用族为弱归属，可与领域族共存', () => {
  assert.equal(kp('g6-down-u05-k001').primary, 'word-application'); // 鸽巢原理
  assert.equal(kp('g3-up-u06-k002').primary, 'word-application');   // 身份证编码
  assert.ok(kp('g2-down-u03-k004').families.includes('word-application')); // 两类倍应用题
});
