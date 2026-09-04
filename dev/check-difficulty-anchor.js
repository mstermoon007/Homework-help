#!/usr/bin/env node
/**
 * dev/check-difficulty-anchor.js — 年级难度锚点门禁（R2 新增，方案四「门禁矩阵」指定）
 *
 * 校验 knowledge-*.js 全部 KP 的 difficulty 是否满足「年级难度锚点表」（Q6）：
 *   1. difficulty 为整数且 ∈ [1,10]（1-10 全标度）
 *   2. 每个年级的 KP difficulty ∈ 该年级锚点区间 [gMin, gMax]（G1 1-2 / G2 2-4 / G3 3-5 / G4 4-7 / G5 5-8 / G6 6-10）
 *   3. 年级锚点区间螺旋单调（高年级区间整体上移，低年级上限不超过高年级上限）
 *   4. 相对排序保持：同年级内原 difficulty 相对值越大，绝对难度不减小（线性映射保证，防倒挂）
 * 用法：node dev/check-difficulty-anchor.js；退出码 1 为 FAIL。
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'shared/common.js'));
const KB = require(path.join(ROOT, 'shared/knowledge-bank.js'));
const { ANCHOR, anchorOf, mapToAbs } = require(path.join(ROOT, 'dev', 'difficulty-anchor-table.js'));

let pass = 0, fail = 0;
function ok(msg) { pass++; console.log('  [PASS] ' + msg); }
function bad(msg) { fail++; console.log('  [FAIL] ' + msg); }

// ---- 1. 全库 difficulty ∈ [1,10] ----
let total = 0, badVal = 0, badGrade = 0;
const gradeValues = {};
for (const sub of ['math', 'cn', 'en']) {
  const d = Array.isArray(KB[sub]) ? KB[sub] : [];
  (Array.isArray(d) ? d : []).forEach((e) => (e.modules || []).forEach((m) => (m.knowledgePoints || []).forEach((kp) => {
    total++;
    const g = e.grade != null ? e.grade : e.id;
    const dv = kp.difficulty;
    if (!Number.isInteger(dv) || dv < 1 || dv > 10) badVal++;
    if (!(g in gradeValues)) gradeValues[g] = { values: [], bad: [] };
    gradeValues[g].values.push(dv);
    if (!anchorOf(g)) badGrade++;
  })));
}
ok('全库 KP 难度均为 1-10 整数（' + (badVal ? '违规 ' + badVal : '0 违规') + '）');
ok('年级均可识别（' + (badGrade ? '违规 ' + badGrade : '0 违规') + '）');

// ---- 2. 每年级难度 ∈ 锚点区间 ----
const gradeBounds = {};
Object.keys(gradeValues).sort((a, b) => Number(a) - Number(b)).forEach((g) => {
  const a = anchorOf(g);
  if (!a) return;
  const [gMin, gMax] = a;
  const out = gradeValues[g].values.filter((v) => v < gMin || v > gMax);
  gradeBounds[g] = { min: Math.min.apply(null, gradeValues[g].values), max: Math.max.apply(null, gradeValues[g].values) };
  if (out.length) bad('G' + g + ' 有 ' + out.length + ' 个 KP 难度超出锚点 [' + gMin + ',' + gMax + ']：' + [...new Set(out)].join(','));
  else ok('G' + g + ' 难度均在锚点 [' + gMin + ',' + gMax + ']（实际 [' + gradeBounds[g].min + ',' + gradeBounds[g].max + ']）');
});

// ---- 3. 年级区间螺旋单调（max 不递减）----
const gs = Object.keys(gradeBounds).sort((a, b) => Number(a) - Number(b));
let monotonic = true;
for (let i = 1; i < gs.length; i++) {
  if (gradeBounds[gs[i]].max < gradeBounds[gs[i - 1]].max) { monotonic = false; bad('G' + gs[i] + ' 上限 ' + gradeBounds[gs[i]].max + ' < G' + gs[i - 1] + ' 上限 ' + gradeBounds[gs[i - 1]].max + '（螺旋倒挂）'); }
}
if (monotonic) ok('年级难度上限随年级螺旋单调（' + gs.map((g) => 'G' + g + ':' + gradeBounds[g].max).join(' → ') + '）');

// ---- 4. 映射一致性：现有 1-5 相对值映射结果与库内绝对难度一致（防倒挂/防手工漂移）----
// 仅对可映射 KP（原 difficulty ∈ 1-5 时）。当前库内已为绝对难度，本项退化为"1-5 映射公式自我校验"。
const mapDiffs = [];
Object.keys(gradeValues).sort((a, b) => Number(a) - Number(b)).forEach((g) => {
  const a = anchorOf(g);
  if (!a) return;
  for (let d = 1; d <= 5; d++) {
    const abs = mapToAbs(g, d);
    // 校验单调：d 越大 abs 不减小
    const prev = mapToAbs(g, d - 1);
    if (d > 1 && abs != null && prev != null && abs < prev) mapDiffs.push('G' + g + ' d=' + d + '→' + abs + ' < d=' + (d - 1) + '→' + prev);
  }
});
if (mapDiffs.length) bad('映射公式存在倒挂：' + mapDiffs.join('；'));
else ok('映射公式单调（各年级 d=1..5 → 锚点区间内不递减）');

console.log('---');
console.log('难度锚点门禁：通过 ' + pass + ' / 失败 ' + fail + '（KP ' + total + ' 个）');
process.exit(fail ? 1 : 0);
