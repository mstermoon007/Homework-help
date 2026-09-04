#!/usr/bin/env node
/**
 * dev/check-spiral-consistency.js — 三维螺旋·深度度量一致性门禁（整改方案 R5）
 *
 * R5「深度转折」：spiral-strategy S1-S6 已接入，本门禁补「深度度量随年级严格递增」校验。
 *
 * 深度度量（R5 公式）：
 *   depth(kp) = complexityScore(kp.difficulty) + spiral_level + 前置链深度
 *   - complexityScore：由 shared/difficulty.js difficultyToStructure(difficulty).complexityScore
 *     （1-10 难度 → 结构复杂度分，全档严格单调）
 *   - spiral_level：知识点螺旋层级（1..max_spiral_level，R2-c 已完备）
 *   - 前置链深度：prerequisites 递归链的最大深度（无前置为 0）
 *
 * 校验（随年级严格递增）：
 *   1. 各年级 KP 的最小深度严格递增（G1 < G2 < … < G6）——深度下界随年级抬升
 *   2. 各年级 KP 的中位深度严格递增——典型深度随年级抬升
 *   3. 深度度量内各分量可算（无 NaN / 缺失 spiral_level）
 *
 * 退出码 1 表示存在 FAIL。
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');

function run() {
  const results = [];
  const errors = [];
  function record(name, pass, detail) {
    results.push({ name, pass, detail });
    if (!pass) errors.push({ name, detail });
  }

  // ---------- 加载 ----------
  global.window = global;
  require(path.join(ROOT, 'shared', 'common.js'));
  const Diff = require(path.join(ROOT, 'shared', 'difficulty.js'));
  require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
  const KM = require(path.join(ROOT, 'shared', 'knowledge-math.js'));

  // 展平数学 KB
  const all = [];
  KM.forEach((g) => {
    const mods = (g && g.modules) || {};
    Object.keys(mods).forEach((mid) => {
      const mod = mods[mid];
      ((mod && mod.knowledgePoints) || []).forEach((k) => {
        k.__grade = g.grade;
        all.push(k);
      });
    });
  });

  const byId = {};
  all.forEach((k) => { byId[k.id] = k; });

  // 前置链深度（递归，环保护）
  function prereqDepth(k, seen) {
    if (seen[k.id]) return 0;
    seen[k.id] = true;
    const ps = (k.prerequisites) || [];
    if (!ps.length) return 0;
    let max = 0;
    ps.forEach((pid) => {
      const p = byId[pid];
      if (p) { const d = prereqDepth(p, seen) + 1; if (d > max) max = d; }
    });
    return max;
  }

  // 深度度量
  function depthOf(k) {
    const cs = Diff.difficultyToStructure(k.difficulty).complexityScore;
    const sl = (k.spiral_level != null ? k.spiral_level : 1);
    return cs + sl + prereqDepth(k, {});
  }

  // ---------- 3) 分量可算性（先算） ----------
  const badDepth = [];
  all.forEach((k) => {
    const cs = Diff.difficultyToStructure(k.difficulty).complexityScore;
    if (k.spiral_level == null) badDepth.push(k.id + ':缺 spiral_level');
    if (!isFinite(cs)) badDepth.push(k.id + ':complexityScore NaN');
    if (!isFinite(depthOf(k))) badDepth.push(k.id + ':深度 NaN');
  });
  record('深度度量分量可算（无 NaN / 无缺失 spiral_level）', badDepth.length === 0,
    'KP ' + all.length + ' 个，异常 ' + badDepth.length + (badDepth.length ? '：' + badDepth.slice(0, 8).join(', ') : ''));

  // ---------- 按年级聚合深度 ----------
  const byGrade = {};
  all.forEach((k) => { (byGrade[k.__grade] = byGrade[k.__grade] || []).push(depthOf(k)); });
  const grades = Object.keys(byGrade).map(Number).sort((a, b) => a - b);

  function statOf(arr) {
    const s = arr.slice().sort((a, b) => a - b);
    return { min: s[0], med: s[Math.floor(s.length / 2)], max: s[s.length - 1] };
  }
  const stats = {};
  grades.forEach((g) => { stats[g] = statOf(byGrade[g]); });

  // ---------- 1) 最小深度严格递增 ----------
  const minInc = [];
  for (let i = 1; i < grades.length; i++) {
    if (stats[grades[i]].min <= stats[grades[i - 1]].min) {
      minInc.push('G' + grades[i - 1] + '→G' + grades[i] + '（' + stats[grades[i - 1]].min + '→' + stats[grades[i]].min + '）');
    }
  }
  record('年级最小深度严格递增（深度下界随年级抬升）', minInc.length === 0,
    grades.map((g) => 'G' + g + ':' + stats[g].min).join(' → ') + (minInc.length ? ' | 违例:' + minInc.join('; ') : ''));

  // ---------- 2) 中位深度严格递增 ----------
  const medInc = [];
  for (let i = 1; i < grades.length; i++) {
    if (stats[grades[i]].med <= stats[grades[i - 1]].med) {
      medInc.push('G' + grades[i - 1] + '→G' + grades[i] + '（' + stats[grades[i - 1]].med + '→' + stats[grades[i]].med + '）');
    }
  }
  record('年级中位深度严格递增（典型深度随年级抬升）', medInc.length === 0,
    grades.map((g) => 'G' + g + ':' + stats[g].med).join(' → ') + (medInc.length ? ' | 违例:' + medInc.join('; ') : ''));

  // ---------- 汇总 ----------
  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;
  console.log('==== 螺旋一致性门禁（check-spiral-consistency） ====');
  results.forEach((r) => console.log('  [' + (r.pass ? 'PASS' : 'FAIL') + '] ' + r.name + (r.pass ? '' : ' — ' + r.detail)));
  console.log('-------------------------------------------');
  console.log('步骤 ' + results.length + ' 项，通过 ' + passCount + ' / 失败 ' + failCount);
  return { name: 'spiral-consistency', pass: failCount === 0, errors, summary: 'SPIRAL-CONSISTENCY ' + passCount + '/' + results.length };
}

// 直接执行
if (require.main === module) {
  const r = run();
  process.exitCode = r.pass ? 0 : 1;
}
module.exports = { run };
