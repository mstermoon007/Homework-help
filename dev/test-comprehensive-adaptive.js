#!/usr/bin/env node
/**
 * dev/test-comprehensive-adaptive.js — 综合练习「知识点密度与前置优先」验证
 *
 * 覆盖：
 *   1. 薄弱加权：rate<0.7 的知识点抽题权重 ×1.5（确定性断言，最大余数法无随机）
 *   2. 极薄弱降档：rate<0.5 → 子插件 difficulty −1，题目 difficulty 字段同步
 *   3. 前置优先：薄弱知识点的薄弱前置被额外注入 2 题标准难度基础题（__prereqFor 标记）
 *   4. 全卷标注：每题携带 knowledgePointId / difficulty（供批改后 recordSession 采集）
 */
'use strict';
global.localStorage = {
  _d: {},
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem: function (k, v) { this._d[k] = String(v); },
  removeItem: function (k) { delete this._d[k]; }
};

var path = require('path');
var ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'shared/common.js'));
global.KnowledgeBank = require(path.join(ROOT, 'shared/knowledge-bank.js'));
require(path.join(ROOT, 'plugins/registry.js'));

var A = global.App.Adaptive;
var KB = global.KnowledgeBank;
var comp = require(path.join(ROOT, 'plugins/math-comprehensive.js'));

var passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg); }
}

// 工具：在真实知识库中找某插件在六年级的一个知识点 ID
function firstKpOf(pluginId, grade) {
  var hit = null;
  KB.forEach(function (entry) {
    if (entry.grade !== grade) return;
    (entry.modules || []).forEach(function (mod) {
      (mod.knowledgePoints || []).forEach(function (kp) {
        if (!hit && kp.pluginId === pluginId) hit = kp.id;
      });
    });
  });
  return hit;
}
function planCounts(plan, kpid) {
  var found = null;
  plan.forEach(function (item) {
    (item.points || []).forEach(function (pt) { if (pt.id === kpid) found = pt; });
  });
  return found;
}

// ============ 1. 薄弱加权 + 降档标记（kbEntryPlan 确定性断言） ============
console.log('\n===== kbEntryPlan：薄弱加权与降档标记 =====');
(function () {
  var stubs = [
    { id: 'math-g6-calc', category: 'number', grades: [6], name: '计算' },
    { id: 'math-g6-oral', category: 'number', grades: [6], name: '口算' }
  ];
  var K1 = firstKpOf('math-g6-calc', 6); // 将被设为极薄弱（<0.5）
  ok(!!K1, '定位 g6-calc 知识点：' + K1);

  // 基线：无任何历史
  var basePlan = comp.__debug_kbEntryPlan(6, stubs, 200);
  var basePt = planCounts(basePlan, K1);
  ok(!!basePt && basePt.count > 0, '基线计划含该知识点（count=' + (basePt ? basePt.count : 0) + '）');

  // 种子：K1 极薄弱（rate=0.4）——必须带 knowledgePointId 才会写入 KP 级桶
  A.record('math', 6, 'math-g6-calc', 4, 10, { knowledgePointId: K1 });
  var weakPlan = comp.__debug_kbEntryPlan(6, stubs, 200);
  var weakPt = planCounts(weakPlan, K1);
  ok(weakPt.lowerDiff === true, '极薄弱（rate<0.5）→ lowerDiff=true');
  ok(weakPt.count > basePt.count,
    '薄弱加权生效：题量 ' + basePt.count + ' → ' + weakPt.count + '（权重 ×1.5）');

  // 对照：另一知识点设为轻度薄弱（0.5≤rate<0.7）→ 加权但不降档
  var g6oralKp = firstKpOf('math-g6-oral', 6);
  if (g6oralKp) {
    A.record('math', 6, 'math-g6-oral', 6, 10, { knowledgePointId: g6oralKp }); // rate=0.6
    var midPlan = comp.__debug_kbEntryPlan(6, stubs, 200);
    var midPt = planCounts(midPlan, g6oralKp);
    ok(midPt.lowerDiff === false, '轻度薄弱（0.5≤rate<0.7）：不降档');
  }
})();

// ============ 2. 端到端：降档 + 前置注入 + 全卷标注 ============
console.log('\n===== 端到端生成（grade 6 · kb 模式 · difficulty 5） =====');
(function () {
  var TARGET = 'g6-c9-inclusion-exclusion';      // 六年级 C9 容斥（pluginId=g5-c9）
  var PREREQ = 'g5-c9-inclusion-exclusion';      // 其前置（五年级容斥）
  // 双双置为薄弱
  A.record('math', 6, 'math-competition-g5-c9', 4, 10, { knowledgePointId: TARGET }); // 目标 rate=0.4 <0.5
  A.record('math', 5, 'math-competition-g5-c9', 4, 10, { knowledgePointId: PREREQ }); // 前置 rate=0.4 <0.7

  var set;
  comp.generate({ grade: 6, count: 200, type: 'kb', difficulty: 5 })
    .then(function (result) {
      set = result;
      var qs = set.questions;
      ok(qs.length >= 200, '出卷题数 ≥200（含前置注入，实际 ' + qs.length + '）');

      // 全卷标注
      ok(qs.every(function (q) { return typeof q.difficulty === 'number' && isFinite(q.difficulty); }),
        '全部题目携带数值 difficulty');
      ok(qs.every(function (q) { return q.__kp ? !!q.knowledgePointId : true; }),
        '有来源知识点的题目均带 knowledgePointId');

      // 极薄弱降档链路（g6-calc 点位密集，必出题）：difficulty 应为 5−1=4
      var VWEAK = firstKpOf('math-g6-calc', 6);
      var vweakQs = qs.filter(function (q) { return q.knowledgePointId === VWEAK; });
      ok(vweakQs.length > 0, '极薄弱知识点出现在卷中（' + vweakQs.length + ' 题）');
      ok(vweakQs.every(function (q) { return q.difficulty === 4; }),
        '极薄弱降档生效：其题目 difficulty=4（5−1）');

      // 前置注入：__prereqFor 标记 + 标准难度 3（c9 容斥 → 五年级容斥）
      var preQs = qs.filter(function (q) { return q.__prereqFor === TARGET; });
      ok(preQs.length >= 2, '薄弱前置被额外注入 ≥2 题（实际 ' + preQs.length + '）');
      ok(preQs.every(function (q) {
        return q.knowledgePointId === PREREQ && q.difficulty === 3;
      }), '注入题为前置知识点自身、标准难度 3');

      // meta 记录注入信息
      ok(Array.isArray(set.meta.weight) && set.meta.weight.some(function (w) {
        return String(w).indexOf('前置·') === 0;
      }), 'meta.weight 含「前置·」条目');
    })
    .catch(function (e) {
      failed++;
      console.log('  ✗ 生成异常：' + e.message);
    })
    .then(function () {
      console.log('\n========================================');
      if (failed) { console.log('❌ ' + failed + ' 项失败'); process.exit(1); }
      console.log('✅ 全部通过（共 ' + passed + ' 项断言）');
    });
})();
