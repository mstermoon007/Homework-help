#!/usr/bin/env node
/**
 * dev/build-strategy-bundle.js — M3-20 辅助：StrategyEngine 浏览器打包
 *
 * 把 StrategyEngine 依赖链（M1 Ontology / M2 Capability / M3 Strategy 的 Node 模块）
 * 静态打包为单一浏览器文件 shared/engine/strategy-engine.bundle.js，内置极简 require 注册表。
 *
 * 浏览器全局 shim（practice.html 已用 <script> 引入，不重复打包）：
 *   common.js / difficulty.js / difficulty-static.js
 *   知识模块经 knowledge-compat.js 映射到 KBL Runtime（App.KNOWLEDGE）
 *
 * 用法：node dev/build-strategy-bundle.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

var ENTRIES = [
  'shared/strategy/strategy-engine.js',
  'shared/strategy/question-type-strategy.js',
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
  'shared/strategy/strategy-result.js',
  'shared/strategy/question-plan.js',
  'shared/strategy/strategy-resolver.js',
  // POL/页面经 global.ComprehensiveStrategy 使用（综合练习规划）；纳入 bundle 后
  // 其知识访问统一经 bundle 的 knowledge-compat 桥（不再单独 <script> 引入）
  'shared/strategy/comprehensive-strategy.js',
  // ===== M4-19 Generator Runtime（Strategy + Generation Runtime Bundle）=====
  // 显式声明，不自动扫描 shared/generator/ 整目录，避免循环依赖 / Bundle 膨胀 / 初始化顺序失控。
  // MATH-14：legacy 插件轨道（legacy-adapter / migration-switch / plugins/registry）已删除；
  // P28-21：semantic-question-bridge 重复 Legacy 桥已删除（SQ→Legacy 唯一 adapter 见
  // shared/presentation/render-format.js），故不再纳入 bundle。
];

// 浏览器全局 shim：practice.html 已加载这些脚本
// 知识模块（bank/point/ontology）已删除 → 统一映射到 knowledge-compat.js 的
// Runtime 兼容对象（KBL Runtime 唯一事实源；不重建旧数据层）。
var SHIMS = {
  'shared/core/common.js': 'PluginUtil',
  'shared/catalog/difficulty.js': 'App.Difficulty',
  'shared/catalog/difficulty-static.js': 'App.DifficultyStatic',
  'shared/knowledge/knowledge-bank.js': 'KnowledgeCompat',
  'shared/knowledge/knowledge-point.js': 'KnowledgePointCompat',
  'shared/knowledge/knowledge-ontology.js': 'KnowledgeOntologyCompat',
  // POL 知识适配边界：页面已以 <script> 加载（knowledge-runtime → knowledge-context → 本 bundle），
  // 注册为委托可让 presentation bundle 复用同一实例，避免内联第二份 KC/Runtime 副本。
  'shared/orchestration/knowledge-context.js': 'KnowledgeContext'
};

// P28-29：node:path / node:fs shim 已删除——bundle 内无任何模块 require 它们（均有 try 兜底或根本不用），
// 属 dead 配置；移除后节点级 path/fs 依赖走对应的普通 require（由调用模块自行保证 Node/浏览器兼容）。

var REQUIRES = /require\(\s*(['"])([^'"]+)\1\s*\)/g;

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function normalizeId(fromDir, rel) {
  return path.posix.normalize(path.posix.join(fromDir, rel));
}

// MATH-14：generator-capability-registry 的 __dirname 特例改写已随 legacy 删除。
function rewriteSpecial(id, content) {
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
  modules[id] = { content: stripComments(content), deps: deps, missing: false };
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

// path shim（node:path 极简实现）——P28-29 已删除：bundle 内无模块 require 'node:path'，
// 属 dead shim。若未来再引入需 path 的模块，需同时恢复此 shim 或改走轻量实现。

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
lines.push('global.StrategyValidator = __req(\'shared/strategy/strategy-validator.js\');');
lines.push('global.QuestionTypeStrategy = __req(\'shared/strategy/question-type-strategy.js\');');
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
lines.push('global.CapabilityResolver = __req(\'shared/capability/capability-resolver.js\');');
lines.push('global.CapabilityModel = __req(\'shared/capability/capability-model.js\');');
lines.push('global.CapabilityMatrix = __req(\'shared/capability/capability-matrix.js\');');
lines.push('global.ComprehensiveStrategy = __req(\'shared/strategy/comprehensive-strategy.js\');');
// FINAL-20：ComplexGen dormant（0 mapping、0 evidence），不再 global 挂载。
lines.push('global.StrategyBundle = { req: __req, modules: __defs };');
lines.push('})(typeof window !== \'undefined\' ? window : (typeof globalThis !== \'undefined\' ? globalThis : this));');

var out = path.join(ROOT, 'shared', 'engine', 'strategy-engine.bundle.js');
fs.writeFileSync(out, lines.join('\n'));

console.log('Strategy bundle written: shared/engine/strategy-engine.bundle.js');
console.log('  modules: ' + Object.keys(modules).length + ', shims: ' + Object.keys(SHIMS).filter(function (s) { return s.indexOf('node:') !== 0; }).length);
