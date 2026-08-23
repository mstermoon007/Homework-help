#!/usr/bin/env node
/**
 * dev/test-adaptive.js — App.Adaptive v2 行为验证
 *
 * 覆盖：v1→v2 迁移、难度加权正确率、EMA 平滑、调整规则矩阵、
 *       知识点级记录门控（仅 competition/comprehensive）、getPrerequisiteStatus。
 */
'use strict';
// localStorage 探针 shim（必须先于 common.js 加载）
global.localStorage = {
  _d: {},
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
  setItem: function (k, v) { this._d[k] = String(v); },
  removeItem: function (k) { delete this._d[k]; }
};

var path = require('path');
var ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'shared/common.js'));
var KB = require(path.join(ROOT, 'shared/knowledge-bank.js')); // getPrerequisiteStatus 依赖
var A = global.App.Adaptive;

var passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg); }
}
function approx(a, b) { return Math.abs(a - b) < 1e-9; }

// ============ 1. v1 → v2 迁移 ============
console.log('\n===== v1 → v2 迁移 =====');
(function () {
  var v1 = {
    'math:3:math-oral': [{ c: 8, t: 10, ts: 111 }, { c: 9, t: 10, ts: 222 }]
  };
  global.localStorage.setItem('hw_adaptive_v1', JSON.stringify(v1));
  // 触发一次读取即迁移
  var adj = A.computeAdjustment('math', 3, 'math-oral');
  var raw = JSON.parse(global.localStorage.getItem('hw_adaptive_v2'));
  ok(raw && raw['math:3:math-oral'] && Array.isArray(raw['math:3:math-oral'].sessions),
    'v2 桶结构为 { ema, sessions }');
  ok(adj.sessions === 2 && adj.rate !== null && approx(adj.rate, 0.85),
    '迁移后历史可用（2 次会话，rate=0.85）');
  ok(global.localStorage.getItem('hw_adaptive_v1') === null, '旧键 hw_adaptive_v1 已清除');
})();

// ============ 2. 难度加权正确率（对比普通正确率） ============
console.log('\n===== 难度加权正确率 =====');
(function () {
  A.reset('math', 4, 'math-competition-g6-c2');
  // 1 错 1 对：错的低难度(1)，对的高难度(9) → 普通 0.5，加权 0.9
  A.record('math', 4, 'math-competition-g6-c2', 1, 2,
    { questionDifficulties: [1, 9], correctFlags: [false, true] });
  var adj = A.computeAdjustment('math', 4, 'math-competition-g6-c2');
  ok(approx(adj.rate, 0.9), '加权 rate=0.9（普通应为 0.5）');
  ok(adj.difficultyDelta === 1 && adj.typeBias === 'hard',
    '加权后触发 +1 hard（按普通率本应 −2 easy）——证明加权生效');

  // 无 correctFlags：即使给了难度数组也退化为普通率
  A.reset('math', 4, 'math-fraction');
  A.record('math', 4, 'math-fraction', 1, 2, { questionDifficulties: [1, 9] });
  var adj2 = A.computeAdjustment('math', 4, 'math-fraction');
  ok(approx(adj2.rate, 0.5), '仅有难度无数组标记时回退普通率 0.5');
})();

// ============ 3. EMA 平滑 ============
console.log('\n===== EMA 平滑 =====');
(function () {
  A.reset('math', 5, 'math-g5-oral');
  A.record('math', 5, 'math-g5-oral', 20, 20);
  ok(approx(A.computeAdjustment('math', 5, 'math-g5-oral').emaRate, 1),
    '首记 emaRate 初始化为本次率 1.0');
  A.record('math', 5, 'math-g5-oral', 0, 20);
  var e2 = A.computeAdjustment('math', 5, 'math-g5-oral').emaRate;
  ok(approx(e2, 0.4 * 0 + 0.6 * 1) && approx(e2, 0.6),
    'emaRate = 0.4×0 + 0.6×1 = 0.6');
  A.record('math', 5, 'math-g5-oral', 20, 20);
  var e3 = A.computeAdjustment('math', 5, 'math-g5-oral').emaRate;
  ok(approx(e3, 0.4 * 1 + 0.6 * 0.6) && approx(e3, 0.76),
    '递推 emaRate = 0.76');
})();

// ============ 4. 调整规则矩阵 ============
console.log('\n===== 调整规则矩阵（emaRate × lastRate） =====');
function simulate(tag, base, perSessionC, total, extraLastPerfect) {
  var key = 'math:' + base.grade + ':' + base.plugin.replace(/-/g, '') + ':' + tag;
  void key;
  for (var i = 0; i < 5; i++) A.record(base.subject, base.grade, base.plugin, perSessionC, total);
  if (extraLastPerfect) A.record(base.subject, base.grade, base.plugin, total, total);
  return A.computeAdjustment(base.subject, base.grade, base.plugin);
}
(function () {
  var r;
  r = simulate('', { subject: 'math', grade: 3, plugin: 'math-g3-a' }, 18, 20, true);
  ok(r.difficultyDelta === 2, '+2：ema≈0.94≥0.85 且 lastRate=1.0（5 次 90% 后全对一次）');
  r = simulate('', { subject: 'math', grade: 3, plugin: 'math-g3-b' }, 17, 20, false);
  ok(r.difficultyDelta === 1, '+1：ema=0.85（边界含）且 last<1');
  r = simulate('', { subject: 'math', grade: 3, plugin: 'math-g3-c' }, 13, 20, false);
  ok(r.difficultyDelta === -1, '−1：ema=0.65（边界含），高于 −2 线');
  r = simulate('', { subject: 'math', grade: 3, plugin: 'math-g3-d' }, 10, 20, false);
  ok(r.difficultyDelta === -2, '−2：ema=0.5');
  r = simulate('', { subject: 'math', grade: 3, plugin: 'math-g3-e' }, 15, 20, false);
  ok(r.difficultyDelta === 0 && r.typeBias === null, '0：ema=0.75 处于中间带');
})();

// ============ 5. 知识点粒度门控与读写 ============
console.log('\n===== 知识点粒度门控 =====');
(function () {
  A.reset();
  // 非综合/竞赛插件：kpid 被忽略
  A.record('math', 6, 'math-g6-calc', 18, 20, { knowledgePointId: 'g6-m1-x' });
  var raw1 = JSON.parse(global.localStorage.getItem('hw_adaptive_v2'));
  ok(!Object.keys(raw1).some(function (k) { return k.indexOf(':g6-m1-x') >= 0; }),
    '普通插件不接受知识点级记录');
  // 竞赛插件：kpid 生效，且与插件级摘要互不干扰
  A.record('math', 6, 'math-competition-g6-c2', 19, 20, { knowledgePointId: 'g6-c2-divisibility' });
  var raw2 = JSON.parse(global.localStorage.getItem('hw_adaptive_v2'));
  ok(!!raw2['math:6:math-competition-g6-c2:g6-c2-divisibility'], '竞赛插件的 KP 级键已建立');
  var kpAdj = A.computeAdjustment('math', 6, 'math-competition-g6-c2', 'g6-c2-divisibility');
  ok(kpAdj.sessions === 1 && approx(kpAdj.emaRate, 0.95), 'KP 级独立统计可查（ema=0.95）');
  var plugAdj = A.computeAdjustment('math', 6, 'math-competition-g6-c2');
  ok(plugAdj.sessions === 0, '未传 kpid 时插件级摘要不受 KP 记录污染（会话数 0）');
})();

// ============ 6. getPrerequisiteStatus（真实知识库链路） ============
console.log('\n===== getPrerequisiteStatus =====');
(function () {
  var st0 = A.getPrerequisiteStatus('g6-c9-inclusion-exclusion');
  ok(st0 !== null && st0.items.length === 1 && st0.items[0].id === 'g5-c9-inclusion-exclusion',
    '定位到唯一前置 g5-c9-inclusion-exclusion');
  ok(st0.ready === false, '无练习数据时 ready=false');
  // 为前置灌入高正确率历史
  A.record('math', 5, 'math-competition-g5-c9', 19, 20);
  var st1 = A.getPrerequisiteStatus('g6-c9-inclusion-exclusion');
  ok(st1.items[0].sessions === 1 && approx(st1.items[0].rate, 0.95),
    '前置历史正确率 0.95');
  ok(st1.ready === true, '前置达标（≥0.7）→ ready=true');
  var none = A.getPrerequisiteStatus('g1-m0-make-ten');
  ok(none !== null && none.ready === null && none.items.length === 0,
    '无前置知识点 → ready=null');
})();

// ============ 输出 ============
console.log('\n========================================');
if (failed) { console.log('❌ ' + failed + ' 项失败'); process.exit(1); }
console.log('✅ 全部通过（共 ' + passed + ' 项断言）');
