#!/usr/bin/env node
/**
 * dev/build-strategy-bundle.js — M3-20 辅助：StrategyEngine 浏览器打包
 *
 * 把 StrategyEngine 依赖链（M1 Ontology / M2 Capability / M3 Strategy 的 Node 模块）
 * 静态打包为单一浏览器文件 shared/strategy-engine.bundle.js，内置极简 require 注册表。
 *
 * 浏览器全局 shim（practice.html 已用 <script> 引入，不重复打包）：
 *   common.js / difficulty.js / difficulty-static.js / knowledge-bank.js / plugins/registry.js
 *
 * 用法：node dev/build-strategy-bundle.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

var ENTRIES = [
  'shared/strategy/strategy-engine.js',
  'shared/strategy/legacy-adapter.js',
  'shared/strategy/strategy-config.js',
  'shared/strategy/question-type-strategy.js',
  'shared/strategy/question-type-allocation.js',
  'shared/strategy/static-difficulty.js',
  'shared/strategy/difficulty-strategy.js',
  'shared/strategy/target-difficulty.js',
  'shared/strategy/structure-constraints.js',
  'shared/strategy/number-range-strategy.js',
  'shared/strategy/cognitive-strategy.js',
  'shared/strategy/spiral-strategy.js',
  'shared/strategy/context-strategy.js',
  'shared/strategy/constraint-builder.js',
  'shared/strategy/strategy-validator.js',
  'shared/strategy/strategy-error.js',
  'shared/strategy/strategy-request.js',
  'shared/strategy/strategy-result.js',
  'shared/strategy/question-plan.js',
  'shared/strategy/strategy-resolver.js',
  // ===== M4-19 Generator Runtime（Strategy + Generation Runtime Bundle）=====
  // 显式声明，不自动扫描 shared/generator/ 整目录，避免循环依赖 / Bundle 膨胀 / 初始化顺序失控。
  // strategy-engine 已传递依赖 generator-selector→registry→native generators→legacy-plugin-adapter；
  // migration-switch 与 semantic-question-bridge 不被 Strategy 引用，故显式加入。
  'shared/generator/migration-switch.js',
  'shared/generator/semantic-question-bridge.js'
];

// 浏览器全局 shim：practice.html 已加载这些脚本
var SHIMS = {
  'shared/common.js': 'PluginUtil',
  'shared/difficulty.js': 'App.Difficulty',
  'shared/difficulty-static.js': 'App.DifficultyStatic',
  'shared/knowledge-bank.js': 'KnowledgeBank',
  'plugins/registry.js': 'PLUGIN_REGISTRY',
  'node:path': '__bundledPathShim',
  'node:fs': '__bundledFsShim'
};

var REQUIRES = /require\(\s*(['"])([^'"]+)\1\s*\)/g;

function normalizeId(fromDir, rel) {
  return path.posix.normalize(path.posix.join(fromDir, rel));
}

function rewriteSpecial(id, content) {
  // generator-capability-registry 使用 node:path + __dirname 动态 require plugins/registry.js
  // 浏览器无 __dirname：改写为静态 require（同 shim 语义）
  if (id === 'shared/generator-capability-registry.js') {
    content = content.replace(
      /var ROOT = path\.resolve\(__dirname, '\.\.'\);[\s\S]*?var pluginRegistry = require\(path\.join\(ROOT, 'plugins', 'registry\.js'\)\);/,
      'var pluginRegistry = require(\'plugins/registry.js\');'
    );
  }
  // 剥离 shebang（#!/usr/bin/env node）——仅允许出现在模块首行，否则无法嵌入 __defs 函数体
  if (/^#!/.test(content)) {
    content = content.replace(/^#![^\n]*\n?/, '');
  }
  return content;
}

var modules = {};
var queue = ENTRIES.slice();

while (queue.length) {
  var id = queue.shift();
  if (modules[id] || SHIMS[id]) continue;
  var fp = path.join(ROOT, id.split('/').join(path.sep));
  var content;
  try {
    content = fs.readFileSync(fp, 'utf8');
  } catch (e) {
    modules[id] = { missing: true, content: 'module.exports = null;', deps: [] };
    continue;
  }
  content = rewriteSpecial(id, content);
  var deps = [];
  REQUIRES.lastIndex = 0;
  content = content.replace(REQUIRES, function (all, quote, rel) {
    // 裸模块名（非 ./ ../ 相对路径）视为 shim/内置引用，不做路径归一化（如 'plugins/registry.js'）
    if (rel.indexOf('./') !== 0 && rel.indexOf('../') !== 0) {
      deps.push(rel);
      return 'require(' + JSON.stringify(rel) + ')';
    }
    var depId = normalizeId(path.posix.dirname(id), rel);
    deps.push(depId);
    return 'require(' + JSON.stringify(depId) + ')';
  });
  modules[id] = { content: content, deps: deps, missing: false };
  deps.forEach(function (d) {
    if (!modules[d] && !SHIMS[d]) queue.push(d);
  });
}

var lines = [];
lines.push('/* 自动生成：node dev/build-strategy-bundle.js（请勿手改） */');
lines.push('/* StrategyEngine 浏览器 bundle：M3-20 接入 practice.html */');
lines.push('(function (global) {');
lines.push("'use strict';");
lines.push('var __defs = {}, __mods = {};');
lines.push('function __req(id) {');
lines.push("  if (__mods[id]) return __mods[id].exports;");
lines.push("  if (!__defs[id]) throw new Error('strategy-bundle: 模块未注册: ' + id);");
lines.push('  var m = { exports: {} };');
lines.push('  __mods[id] = m;');
lines.push('  __defs[id](m, m.exports, __req);');
lines.push('  return m.exports;');
lines.push('}');

// path shim（node:path 极简实现）
lines.push('__defs[\'node:path\'] = function (m) {');
lines.push('  var posix = {');
lines.push('    resolve: function (a, b) { return b ? (a.replace(/\\/$/, \'\') + \'/\' + b) : a; },');
lines.push('    join: function () {');
lines.push('      var parts = []; for (var i = 0; i < arguments.length; i++) { var p = String(arguments[i]); if (p) parts.push(p.replace(/\\/+$/, \'\')); }');
lines.push('      return parts.join(\'/\');');
lines.push('    },');
lines.push('    dirname: function (p) { var i = p.lastIndexOf(\'/\'); return i === -1 ? \'.\' : p.slice(0, i); },');
lines.push('    basename: function (p) { var i = p.lastIndexOf(\'/\'); return i === -1 ? p : p.slice(i + 1); },');
lines.push('    extname: function (p) { var b = posix.basename(p); var i = b.lastIndexOf(\'.\'); return i <= 0 ? \'\' : b.slice(i); },');
lines.push('    normalize: function (p) { return p; }');
lines.push('  };');
lines.push('  posix.posix = posix;');
lines.push('  m.exports = posix;');
lines.push('};');

Object.keys(SHIMS).forEach(function (id) {
  if (id.indexOf('node:') === 0) return;
  lines.push('__defs[' + JSON.stringify(id) + '] = function (m) {');
  lines.push('  if (global.' + SHIMS[id] + ' == null) throw new Error(\'strategy-bundle: 缺少全局 ' + SHIMS[id] + '（请先加载对应脚本）\');');
  lines.push('  m.exports = global.' + SHIMS[id] + ';');
  lines.push('};');
});

Object.keys(modules).forEach(function (id) {
  lines.push('__defs[' + JSON.stringify(id) + '] = function (module, exports, require) {');
  if (modules[id].missing) {
    lines.push('  module.exports = null;');
  } else {
    lines.push(modules[id].content);
  }
  lines.push('};');
});

// 浏览器全局挂载
lines.push('global.StrategyEngine = __req(\'shared/strategy/strategy-engine.js\');');
lines.push('global.StrategyLegacyAdapter = __req(\'shared/strategy/legacy-adapter.js\');');
lines.push('global.StrategyConfig = __req(\'shared/strategy/strategy-config.js\');');
lines.push('global.StrategyValidator = __req(\'shared/strategy/strategy-validator.js\');');
lines.push('global.QuestionTypeStrategy = __req(\'shared/strategy/question-type-strategy.js\');');
lines.push('global.QuestionTypeAllocation = __req(\'shared/strategy/question-type-allocation.js\');');
lines.push('global.StaticDifficultyStrategy = __req(\'shared/strategy/static-difficulty.js\');');
lines.push('global.DifficultyStrategy = __req(\'shared/strategy/difficulty-strategy.js\');');
lines.push('global.TargetDifficulty = __req(\'shared/strategy/target-difficulty.js\');');
lines.push('global.StructureConstraints = __req(\'shared/strategy/structure-constraints.js\');');
lines.push('global.NumberRangeStrategy = __req(\'shared/strategy/number-range-strategy.js\');');
lines.push('global.CognitiveStrategy = __req(\'shared/strategy/cognitive-strategy.js\');');
lines.push('global.SpiralStrategy = __req(\'shared/strategy/spiral-strategy.js\');');
lines.push('global.ContextStrategy = __req(\'shared/strategy/context-strategy.js\');');
lines.push('global.ConstraintBuilder = __req(\'shared/strategy/constraint-builder.js\');');
// ===== M4-19 Generator Runtime 全局 =====
// Comprehensive 插件 / 浏览器 / Node Sandbox 统一从本 bundle 取 Generator Runtime，
// 不再运行时动态 require（消灭 require 链）。
lines.push('global.GeneratorSelector = __req(\'shared/generator/generator-selector.js\');');
lines.push('global.GeneratorMode = __req(\'shared/generator/generator-mode.js\');');
lines.push('global.GeneratorRegistry = __req(\'shared/generator/generator-registry.js\');');
lines.push('global.MigrationSwitch = __req(\'shared/generator/migration-switch.js\');');
lines.push('global.LegacyPluginAdapter = __req(\'shared/generator/legacy-plugin-adapter.js\');');
lines.push('global.SemanticQuestionBridge = __req(\'shared/generator/semantic-question-bridge.js\');');
lines.push('global.ComplexGen = __req(\'shared/generator/generators/complex.js\');');
lines.push('global.StrategyBundle = { req: __req, modules: __defs };');
lines.push('})(typeof window !== \'undefined\' ? window : (typeof globalThis !== \'undefined\' ? globalThis : this));');

var out = path.join(ROOT, 'shared', 'strategy-engine.bundle.js');
fs.writeFileSync(out, lines.join('\n'));

console.log('Strategy bundle written: shared/strategy-engine.bundle.js');
console.log('  modules: ' + Object.keys(modules).length + ', shims: ' + Object.keys(SHIMS).filter(function (s) { return s.indexOf('node:') !== 0; }).length);
