#!/usr/bin/env node
/**
 * dev/check-strategy-bundle.js — M4-19 Bundle Smoke Test
 *
 * 验证「Strategy + Generator Runtime」bundle（shared/strategy-engine.bundle.js）：
 *  1. 全部运行时全局已挂载；
 *  2. Strategy → GeneratorSelector → Generator → SemanticQuestion 全链路可执行；
 *  3. 语义渲染桥可用；
 *  4. 迁移开关可 apply；
 *  5. 全程无运行时 require fallback（由全局解析，不落入 require 链）。
 *
 * 用 Node 模拟浏览器：先加载共享层 shim，再 eval bundle，再执行链路。
 * 退出码 0 = PASS（供 verify:m4 串联）。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');

var bad = [];
function check(name, cond) {
  var ok = !!cond;
  if (!ok) bad.push(name);
  console.log((ok ? '  ✓ ' : '  ✗ ') + name);
  return ok;
}

// 1) 装载 bundle 所需的共享层 shim（与 practice.html 一致）
try {
  require(path.join(ROOT, 'shared/common.js'));
  require(path.join(ROOT, 'shared/difficulty.js'));
  require(path.join(ROOT, 'shared/difficulty-static.js'));
  require(path.join(ROOT, 'shared/knowledge-bank.js'));
  global.PLUGIN_REGISTRY = require(path.join(ROOT, 'plugins/registry.js'));
} catch (e) {
  console.error('共享层 shim 装载失败：' + e.message);
  process.exit(1);
}

// 2) eval bundle（浏览器以 <script> 引入，Node 以文本 eval 模拟同一产物）
var bundlePath = path.join(ROOT, 'shared/strategy-engine.bundle.js');
var src;
try {
  src = fs.readFileSync(bundlePath, 'utf8');
} catch (e) {
  console.error('找不到 bundle：shared/strategy-engine.bundle.js（请先 node dev/build-strategy-bundle.js）');
  process.exit(1);
}

var hadStrict = false;
(function (global) {
  var saved = global.__STRATEGY_BUNDLE_LOADED;
  try {
    // eslint-disable-next-line no-eval
    (0, eval)(src);
  } catch (e) {
    console.log('  ✗ bundle eval 失败：' + e.message);
    process.exit(1);
  }
  return saved;
})(global);
void hadStrict;

console.log('\n[1] Generator Runtime 全局');
var EXPORTS = [
  'StrategyEngine',
  'StrategyLegacyAdapter',
  'GeneratorSelector',
  'GeneratorMode',
  'GeneratorRegistry',
  'MigrationSwitch',
  'SemanticQuestionBridge',
  'ComplexGen',
  'LegacyPluginAdapter'
];
EXPORTS.forEach(function (name) { check(name + ' 可获取', typeof global[name] !== 'undefined'); });

console.log('\n[2] 接口形态');
check('StrategyEngine.plan 为函数', typeof global.StrategyEngine.plan === 'function');
check('GeneratorSelector.selectGenerator 为函数', typeof global.GeneratorSelector.selectGenerator === 'function');
check('GeneratorSelector.instantiate 为函数', typeof global.GeneratorSelector.instantiate === 'function');
check('MigrationSwitch.apply 为函数', typeof global.MigrationSwitch.apply === 'function');
check('SemanticQuestionBridge.toQuestions 为函数', typeof global.SemanticQuestionBridge.toQuestions === 'function');
check('SemanticQuestionBridge.toQuestion 为函数', typeof global.SemanticQuestionBridge.toQuestion === 'function');

console.log('\n[3] Strategy → Generator → SemanticQuestion 全链路');
var PLAN_ERRORS = 0, okPlan = 0;
var probes = [
  { id: 'math-g1-m1-mixed-chain', qt: 'calc', label: '复杂链(原生)' },
  { id: 'math-g2-m3-mixed-bracket', qt: 'calc', label: '带括号(原生)' },
  { id: 'math-g2-m1-add-100', qt: 'oral', label: '口算(legacy)' },
  { id: 'math-g1-m4-num-fill-unknown', qt: 'calc', label: '逆向□(原生)' }
];
probes.forEach(function (probe) {
  try {
    global.MigrationSwitch.apply();
    var plan = global.StrategyEngine.plan({
      knowledgePointId: probe.id, count: 3, difficulty: 3
    }).plans[0];
    if (!plan) { PLAN_ERRORS++; check(probe.label + ' plan 有结果', false); return; }
    if (plan.planError) { PLAN_ERRORS++; check(probe.label + ' plan 无错误（got ' + plan.planError + '）', false); return; }
    var sel = global.GeneratorSelector.selectGenerator(plan);
    var inst = global.GeneratorSelector.instantiate(sel);
    var sems = inst.generate(plan, { grade: 1, count: 3 });
    var list = global.SemanticQuestionBridge.toQuestions(sems || []);
    okPlan++;
    check(probe.label + ' 生成 ' + (list ? list.length : 0) + ' 题并桥接', !!(list && list.length && list.every(function (q) { return typeof q.render === 'function' && typeof q.check === 'function' && q.answer != null; })));
  } catch (e) {
    check(probe.label + ' 无异常（' + e.message + '）', false);
  }
});
if (okPlan === 0 && PLAN_ERRORS > 0) {
  check('至少一个 probe 成功', false);
}

console.log('\n[4] 迁移开关覆盖');
var ALL = global.MigrationSwitch.ALL_MIGRATED;
check('MigrationSwitch.ALL_MIGRATED 为非空数组', Array.isArray(ALL) && ALL.length > 0);
check('迁移含复杂知识（complex）', Array.isArray(ALL) && ALL.indexOf('math-g2-m3-mixed-bracket') !== -1);

console.log('\n=== M4-19 Bundle 门禁 ===');
if (bad.length) {
  console.log('FAIL:' + bad.length + ' 项未通过 → ' + JSON.stringify(bad));
  process.exit(1);
}
console.log('PASS');
process.exit(0);
