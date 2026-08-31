#!/usr/bin/env node
/**
 * dev/check-generator-migration-switch.js — M4-R17 迁移切换生效 Gate
 *
 * 断言 apply() 后：
 *   - 已迁移 KP（MIGRATED_KPS）经 Selector 选择 core 轨（scope=core, mode=native）；
 *   - math-oral 其余（N/A）KP 仍选择 legacy 轨（scope=legacy，不被 native 覆盖语义）；
 *   - 实例化后可经 StrategyEngine 生效（generate 尊重 plan KP 语义）。
 *
 * 用途：npm run verify:m4；切换粒度必须是 knowledgePoint（插件级会把 N/A KP 误切 native）。
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
var Mode = Selector.Mode;
var Switch = require(path.join(ROOT, 'shared', 'generator', 'migration-switch.js'));
var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));

var errors = [];

function selectFor(kpId, qt) {
  return Selector.selectGenerator({ knowledgePointId: kpId, questionTypeId: qt || 'calc', difficulty: 3 });
}

// 1) 应用切换
Mode.clearAll();
var applied = Switch.apply();
if (applied !== Switch.ALL_MIGRATED.length) errors.push('apply() 返回数量异常');

// 2) 已迁移 KP → core/native
Switch.MIGRATED_KPS.forEach(function (kpId) {
  var sel = selectFor(kpId);
  if (!sel.record || sel.record.scope !== 'core') errors.push(kpId + ': 期望 scope=core，实际 ' + (sel.record && sel.record.scope) + ' (' + sel.generatorId + ')');
  if (sel.mode !== 'native') errors.push(kpId + ': 期望 mode=native，实际 ' + sel.mode);
});

// 3) math-oral 其余 KP → legacy/hybrid（不被 native 覆盖语义）
var oralKps = GenCap.buildGeneratorCapabilityRegistry()
  .find(function (r) { return r.pluginId === 'math-oral'; }).knowledgePoints;
oralKps.forEach(function (kpId) {
  if (Switch.isMigrated(kpId)) return;
  var sel = selectFor(kpId);
  if (!sel.record || sel.record.scope !== 'legacy') errors.push(kpId + ': N/A KP 不应被切到 native（实际 ' + (sel.record && sel.record.scope) + '）');
});

// 4) 端到端：已迁移 KP 经引擎 → 选择 → 实例化 → 生成，尊重 plan KP 语义
var plan = Engine.plan({ knowledgePointId: 'math-g2-m1-mult-table', questionTypeId: 'calc', count: 3, difficulty: 5 }).plans[0];
var sel2 = Selector.selectGenerator(plan);
var inst = Selector.instantiate(sel2);
var qs = inst.generate(plan, { seed: 'mig-a' });
var ops = {};
qs.forEach(function (q) { q.prompt.replace(/[×÷]/, function (m) { return m; }); });
var allMult = qs.every(function (q) { return /×/.test(q.prompt); });
if (!allMult) errors.push('mult-table 端到端生成未遵守 × 语义: ' + qs.map(function (q) { return q.prompt; }).join(' | '));

if (!errors.length) {
  console.log('[PASS] M4-R17 迁移切换生效：' + Switch.MIGRATED_KPS.length + ' KP → native，其余保留 legacy');
  process.exitCode = 0;
} else {
  console.error('[FAIL] M4-R17 迁移切换：');
  errors.forEach(function (e) { console.error('  - ' + e); });
  process.exitCode = 1;
}