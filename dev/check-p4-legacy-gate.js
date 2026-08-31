#!/usr/bin/env node
/**
 * dev/check-p4-legacy-gate.js — P4-R05 Legacy 下线条件门禁
 *
 * 只有同时满足三条件才允许物理删除 Legacy 代码：
 *   ① Legacy 生产调用 = 0  —— 页面/Engine/Renderer 无 legacy plugin 调用
 *   ② Adapter 调用 = 0     —— 仅桥接层合法消费 LegacyPluginAdapter，其余无 Adapter 调用
 *   ③ R30 回归通过       —— 统一引擎 vs 旧插件输出等价，无发散
 *
 * 用法：
 *   node dev/check-p4-legacy-gate.js           # 常规检查（输出三项计数/状态）
 *   node dev/check-p4-legacy-gate.js --enforce # 删除前置 Gate：任一不满足即 exit 1
 */
'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..');
var ENFORCE = process.argv.indexOf('--enforce') !== -1;

function walkFiles(dir, suffix, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir).forEach(function (name) {
    var fp = path.join(dir, name);
    var st = fs.statSync(fp);
    if (st.isDirectory()) walkFiles(fp, suffix, out);
    else if (name.endsWith(suffix)) out.push(path.relative(ROOT, fp));
  });
  return out;
}

function stripComments(src) {
  src = src.replace(/<!--[\s\S]*?-->/g, '');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  src = src.replace(/^\s*\/\/.*$/gm, '');
  return src;
}

function countInFile(file, re) {
  var abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return 0;
  var m = stripComments(fs.readFileSync(abs, 'utf8')).match(re);
  return m ? m.length : 0;
}

// ---- 采集范围 ----
var htmlPages = walkFiles(ROOT, '.html', []).filter(function (f) {
  return f.indexOf('node_modules') === -1 && f.indexOf('dev/') === -1;
});
var presentationFiles = walkFiles(path.join(ROOT, 'shared', 'presentation'), '.js', []);
var sharedFiles = walkFiles(path.join(ROOT, 'shared'), '.js', []).filter(function (f) { return f.indexOf('strategy-engine.bundle.js') === -1; });
var pluginFiles = walkFiles(path.join(ROOT, 'plugins'), '.js', []);

// 允许触发 legacy 桥的文件（唯一的旧插件边界消费方）
var BRIDGE_FILES = [
  'shared/legacy/plugin-adapter.js',
  'shared/legacy/legacy-plugin-adapter.js',
  'shared/generator/legacy-plugin-adapter.js',
  'shared/generator/generator-selector.js', // 合法消费 shared/legacy/plugin-adapter.js（M7-R18）
  'shared/strategy/legacy-adapter.js',
  'shared/generation-engine.js' // 提供 generateLegacy/renderLegacySet API
];

// ============================================
// 条件 ①：Legacy 生产调用 = 0
// 定义：页面/Engine/Renderer 无 legacy plugin 直接调用
// 统计：UI direct plugin calls + Engine legacy calls + Renderer legacy calls
// ============================================
var uiRe = /(?:state\.)?plugin\.generate\s*\(|(?:state\.)?plugin\.render\s*\(|(?:state\.)?plugin\.svg\s*\(/g;
var uiCalls = 0;
htmlPages.forEach(function (f) { uiCalls += countInFile(f, uiRe); });

var engineRe = /(?:\.|global\.|App\.)?LegacyPluginAdapter\.(?:generateByPluginId|renderSet|generate\s*\(|render\s*\(|hydrateLegacyGenerator)/g;
var engineLegacy = 0;
walkFiles(path.join(ROOT, 'shared'), '.js', []).filter(function (f) { return f.indexOf('strategy-engine.bundle.js') === -1; }).forEach(function (f) {
  if (BRIDGE_FILES.indexOf(f) !== -1) return;
  engineLegacy += countInFile(f, engineRe);
});

var rendererLegacy = 0;
presentationFiles.forEach(function (f) { rendererLegacy += countInFile(f, uiRe); });

var prodCalls = uiCalls + engineLegacy + rendererLegacy;

// ============================================
// 条件 ②：Adapter 调用 = 0
// 定义：仅桥接层合法消费 LegacyPluginAdapter，其余无 Adapter 调用
// 统计：Engine 之外的 LegacyPluginAdapter 执行引用
// ============================================
var adapterRe = /(?:\.|global\.|App\.)?LegacyPluginAdapter\.(?:generateByPluginId|renderSet|generate\s*\(|render\s*\(|hydrateLegacyGenerator)/g;
var adapterCalls = 0;
walkFiles(path.join(ROOT, 'shared'), '.js', []).filter(function (f) { return f.indexOf('strategy-engine.bundle.js') === -1; }).forEach(function (f) {
  if (BRIDGE_FILES.indexOf(f) !== -1) return;
  adapterCalls += countInFile(f, adapterRe);
});

// ============================================
// 条件 ③：R30 回归通过
// ============================================
function runR30() {
  var r = cp.spawnSync(process.execPath, [path.join(ROOT, 'dev', 'check-engine-comparison.js')], { encoding: 'utf8', timeout: 120000 });
  return r.status === 0 && /R30.*PASS|等价对比.*等价.*0.*发散/.test(r.stdout);
}

// ============================================
// 输出
// ============================================
console.log('=== P4-R05 Legacy 下线条件门禁 ===');
console.log('');

var cond1 = prodCalls === 0;
var cond2 = adapterCalls === 0;
var cond3 = runR30();

console.log('条件 ① Legacy 生产调用 = 0');
console.log('  页面直接调用 plugin.generate/render:', uiCalls);
console.log('  Engine legacy 调用:', engineLegacy);
console.log('  Renderer legacy 调用:', rendererLegacy);
console.log('  总计:', prodCalls, cond1 ? '✅ PASS' : '❌ FAIL');
console.log('');

console.log('条件 ② Adapter 调用 = 0');
console.log('  非桥接层 LegacyPluginAdapter 调用:', adapterCalls, adapterCalls === 0 ? '✅ PASS' : '❌ FAIL');
console.log('');

console.log('条件 ③ R30 回归通过');
console.log('  统一引擎 vs 旧插件等价对比:', cond3 ? '✅ PASS' : '❌ FAIL');
console.log('');

var allPass = cond1 && cond2 && cond3;
console.log('综合判定:', allPass ? '✅ 允许删除 Legacy 代码' : '❌ 禁止删除 Legacy 代码');

if (ENFORCE) {
  if (allPass) {
    console.log('');
    console.log('P4-LEGACY-GATE: PASS（三条件均满足，允许物理删除 Legacy 代码）');
    process.exitCode = 0;
  } else {
    console.log('');
    console.log('P4-LEGACY-GATE: BLOCKED（不满足下线条件，禁止物理删除）');
    process.exitCode = 1;
  }
} else {
  process.exitCode = allPass ? 0 : 1;
}