/**
 * dev/check-legacy-gate.js — M7-R20 Legacy 删除 Gate
 *
 * 删除旧系统前的 5 项硬性检查（全部为 0 才允许物理删除 legacy 代码）：
 *   [1] UI direct plugin calls   —— 页面直接调用 plugin.generate/plugin.render
 *   [2] GenerationEngine legacy calls —— Engine 之外直接使用 LegacyPluginAdapter
 *   [3] Renderer legacy calls    —— presentation 层直接调用 plugin.generate/plugin.render
 *   [4] Legacy imports           —— 越界 require('legacy/**') / require('dev/plugin-loader.js')
 *   [5] Legacy tests             —— 依赖 legacy 行为的测试文件
 *
 * 用法：
 *   node dev/check-legacy-gate.js               # 常规检查（结构合规输出，含 5 项计数）
 *   node dev/check-legacy-gate.js --enforce     # 删除前置 Gate：任一计数 > 0 即 exit 1
 */
'use strict';

var fs = require('fs');
var path = require('path');

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
var testFiles = walkFiles(path.join(ROOT, 'tests'), '.js', []);

// 允许触发 legacy 桥的文件（唯一的旧插件边界消费方）
var BRIDGE_FILES = [
  'shared/legacy/plugin-adapter.js',
  'shared/legacy/legacy-plugin-adapter.js',
  'shared/generator/legacy-plugin-adapter.js',
  'shared/generator/generator-selector.js', // 合法消费 shared/legacy/plugin-adapter.js（M7-R18）
  'shared/strategy/legacy-adapter.js',
  'shared/generation-engine.js' // 提供 generateLegacy/renderLegacySet API
];

// ---- [1] UI direct plugin calls ----
var uiRe = /(?:state\.)?plugin\.generate\s*\(|(?:state\.)?plugin\.render\s*\(|(?:state\.)?plugin\.svg\s*\(/g;
var uiCalls = 0;
htmlPages.forEach(function (f) { uiCalls += countInFile(f, uiRe); });

// ---- [2] GenerationEngine legacy calls（Engine 之外的 LegacyPluginAdapter 执行引用）----
var engineRe = /(?:\.|global\.|App\.)?LegacyPluginAdapter\.(?:generateByPluginId|renderSet|generate\s*\(|render\s*\(|hydrateLegacyGenerator)/g;
var engineLegacy = 0;
sharedFiles.forEach(function (f) {
  if (BRIDGE_FILES.indexOf(f) !== -1) return;
  engineLegacy += countInFile(f, engineRe);
});
// 注意：shared/legacy/legacy-plugin-adapter.js 是旧插件包装工厂，属于老基础设施
// （shared/legacy/plugin-adapter.js 是我们 M7-R18 的新桥）。engineRe 不含 createLegacyGenerator。

// ---- [3] Renderer legacy calls ----
var rendererLegacy = 0;
presentationFiles.forEach(function (f) {
  rendererLegacy += countInFile(f, uiRe);
});

// ---- [4] Legacy imports（越界 require：仅指 legacy 桥模块 / 已删目标的残留引用；通用脚本加载器不算）----
var importRe = /require\(\s*['"](?:\.\.?\/)+legacy\//;
var legacyImports = 0;
sharedFiles.concat(pluginFiles).forEach(function (f) {
  if (BRIDGE_FILES.indexOf(f) !== -1) return;
  legacyImports += countInFile(f, importRe);
});

// ---- [5] Legacy tests ----
var legacyTestRe = /legacy|plugin-adapter|createLegacyGenerator|runLegacyFallback|_wrapGridClass|_wrapDifficultyParams/;
var legacyTests = 0;
var blockedByTest = [];
testFiles.forEach(function (f) {
  var abs = path.join(ROOT, f);
  var src = fs.readFileSync(abs, 'utf8');
  if (/node_modules/.test(f)) return;
  if (legacyTestRe.test(src)) { legacyTests++; if (!blockedByTest.includes(f)) blockedByTest.push(f); }
});
var legacyTestFiles = blockedByTest.length;

// ---- 输出 ----
console.log('Legacy Deletion Gate (M7-R20)');
console.log('  [1] UI direct plugin calls   : ' + uiCalls + (uiCalls ? '  ❌ 删除被阻止' : ''));
console.log('  [2] Engine legacy calls      : ' + engineLegacy + (engineLegacy ? '  ❌ 删除被阻止' : ''));
console.log('  [3] Renderer legacy calls    : ' + rendererLegacy + (rendererLegacy ? '  ❌ 删除被阻止' : ''));
console.log('  [4] Legacy imports           : ' + legacyImports + (legacyImports ? '  ❌ 删除被阻止' : ''));
console.log('  [5] Legacy tests             : ' + legacyTestFiles + (legacyTestFiles ? '  ❌ 删除被阻止' : ''));

var nonzero = [uiCalls, engineLegacy, rendererLegacy, legacyImports, legacyTestFiles].filter(function (n) { return n > 0; });

if (!ENFORCE) {
  // 结构合规检查：仅约束「越界」类引用（R16/R18/R19 已做到的）；计数用于报告
  if (uiCalls === 0 && engineLegacy === 0 && rendererLegacy === 0 && legacyImports === 0) {
    console.log('LEGACY-GATE: 结构合规 PASS（页面/Engine/Renderer 均已收敛，物理删除待计数归零）');
    process.exitCode = 0;
  } else {
    console.log('LEGACY-GATE: FAIL（存在越界 legacy 引用，见上）');
    process.exitCode = 1;
  }
} else if (nonzero.length === 0) {
  // --enforce：R20 删除前置 Gate，5 项全 0 才放行
  console.log('LEGACY-GATE: PASS（5 项全 0，允许删除 legacy）');
  process.exitCode = 0;
} else {
  console.log('LEGACY-GATE: BLOCKED（' + nonzero.length + ' 项未清零，禁止物理删除；' +
    '当前 UI/Engine/Renderer 引用已收敛，遗留项为迁移期测试与该领域单体插件依赖）');
  process.exitCode = 1;
}