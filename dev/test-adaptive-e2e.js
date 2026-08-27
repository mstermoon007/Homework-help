#!/usr/bin/env node
/**
 * dev/test-adaptive-e2e.js — 端到端：生成一次练习并批改，验证 hw_adaptive_v2 落库
 *
 * 链路：插件 generate()（含 knowledgePointId/difficulty 标注）
 *       → 模拟批改 flags → App.Adaptive.recordSession()
 *       → 断言 localStorage['hw_adaptive_v2'] 的插件级 + 知识点级条目。
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
var registry = require(path.join(ROOT, 'plugins/registry.js'));

var passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg); }
}
function store() { return JSON.parse(global.localStorage.getItem('hw_adaptive_v2')); }

function loadPlugin(id) {
  var rec = registry.find(function (r) { return r.id === id; });
  return require(path.join(ROOT, rec.file));
}

// ============ 场景 A：竞赛插件（已标注 KP/难度）→ 插件级 + 知识点级双落库 ============
console.log('\n===== A. 竞赛插件端到端（math-competition-g6-c2） =====');
(function () {
  var plugin = loadPlugin('math-competition-g6-c2');
  var set = plugin.generate({ grade: 6, count: 20, type: 'mix', difficulty: 8 });
  var qs = set.questions;
  ok(qs.length === 20, '生成 20 题');
  ok(qs.every(function (q) { return !!q.knowledgePointId; }), '全部题目携带 knowledgePointId');
  ok(qs.every(function (q) { return q.difficulty === 8; }), '全部题目携带 difficulty=8（透传 effectiveLevel）');

  // 模拟批改：每 5 题错 1 题（16 对 4 错）
  var flags = qs.map(function (_, i) { return i % 5 !== 0; });
  var correct = flags.filter(Boolean).length;

  var sum = global.App.Adaptive.recordSession('math', 6, plugin.id, qs, flags);
  ok(sum.total === 20 && sum.correct === correct && correct === 16, 'recordSession 返回 20 题/16 对');

  var raw = store();
  var pluginKey = 'math:6:math-competition-g6-c2';
  ok(!!raw[pluginKey], 'localStorage 存在插件级条目');
  ok(raw[pluginKey].sessions.length === 1 && raw[pluginKey].sessions[0].t === 20,
    '插件级会话 t=20');
  ok(raw[pluginKey].sessions[0].wAll > 0 && raw[pluginKey].sessions[0].wOk > 0,
    '插件级含难度加权字段（wOk/wAll）');

  var kpKeys = Object.keys(raw).filter(function (k) { return k.indexOf(pluginKey + ':math-g6-c2-') === 0; });
  ok(kpKeys.length >= 4 && kpKeys.length <= 11, '存在知识点级条目（' + kpKeys.length + ' 个 KP 桶）');
  var kpTotal = kpKeys.reduce(function (s, k) { return s + raw[k].sessions[0].t; }, 0);
  ok(kpTotal === 20, 'KP 桶题数之和 = 20（分组无遗漏无重复）');
  var kpOkSum = kpKeys.reduce(function (s, k) { return s + raw[k].sessions[0].c; }, 0);
  ok(kpOkSum === 16, 'KP 桶答对数之和 = 16');
  ok(kpKeys.every(function (k) { return raw[k].ema != null && raw[k].ema >= 0 && raw[k].ema <= 1; }),
    '每个 KP 桶均有 emaRate ∈ [0,1]（全错的桶合法地为 0）');

  // 批改后 computeAdjustment 应反映加权数据（有 wAll → 加权率路径）
  var kpAdj = global.App.Adaptive.computeAdjustment('math', 6, plugin.id, qs[0].knowledgePointId);
  ok(kpAdj.sessions === 1 && kpAdj.rate != null, 'computeAdjustment 可按知识点查询');
})();

// ============ 场景 B：未标注插件的兼容路径（不产生 KP 条目） ============
console.log('\n===== B. 未标注插件兼容（math-g5-oral 无 KP 字段） =====');
(function () {
  var before = Object.keys(store()).filter(function (k) {
    return k.indexOf('math:5:math-g5-oral:') >= 0;
  }).length;
  var plugin = loadPlugin('math-g5-oral');
  var set = plugin.generate({ grade: 5, count: 10 });
  var flags = set.questions.map(function (_, i) { return i % 3 !== 0; });
  global.App.Adaptive.recordSession('math', 5, plugin.id, set.questions, flags);
  var after = Object.keys(store()).filter(function (k) {
    return k.indexOf('math:5:math-g5-oral:') >= 0;
  }).length;
  ok(before === 0 && after === 0, '未标注插件零 KP 键（保持原有插件级记录方式）');
  var pk = 'math:5:math-g5-oral';
  ok(!!store()[pk], '插件级摘要照常落库');
})();

// ============ 输出 ============
console.log('\n========================================');
if (failed) { console.log('❌ ' + failed + ' 项失败'); process.exit(1); }
console.log('✅ 端到端全部通过（共 ' + passed + ' 项断言）');
