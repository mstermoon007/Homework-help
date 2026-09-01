#!/usr/bin/env node
/**
 * dev/build-presentation-bundle.js — C01 Browser Runtime wiring
 *
 * 把 shared/presentation-engine.js（及它需要、但 strategy-engine.bundle.js 未打包的
 * 少量模块）静态打包为 shared/presentation-engine.bundle.js。
 *
 * 复用既有 bundle/loader 架构（与 dev/build-strategy-bundle.js 同机制）：
 *   - __req 优先取本 bundle 内 __defs；缺失时委托 global.StrategyBundle.req()
 *     （strategy-engine.bundle.js 已注册 path/fs 及 generator/validator/schema 全链）。
 *   - 只内联 strategy bundle 未提供的模块，避免重复打包 / 循环依赖 / 初始化顺序失控。
 *   - 浏览器挂载 global.PresentationEngine（供 generation-engine 的 ensure 读取）。
 *
 * 用法：node dev/build-presentation-bundle.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

var ENTRY = 'shared/presentation-engine.js';

// 浏览器全局 shim / 委托：这些 id 由已加载的 strategy-engine.bundle.js 提供
var SHIMS = {
  'node:path': true,
  'path': true,
  'fs': true,
  'node:fs': true
};

var REQUIRES = /require\(\s*(['"])([^'"]+)\1\s*\)/g;

function normalizeId(fromDir, rel) {
  return path.posix.normalize(path.posix.join(fromDir, rel));
}

// 读取 strategy bundle 已注册的模块 id，实现「委托」而非重复打包
function strategyModuleIds() {
  var bundlePath = path.join(ROOT, 'shared', 'strategy-engine.bundle.js');
  var bundle;
  try {
    bundle = fs.readFileSync(bundlePath, 'utf8');
  } catch (e) {
    return null;
  }
  var ids = {};
  var re = /__defs\["([^"]+)"\] = function/g;
  var m;
  while ((m = re.exec(bundle))) ids[m[1]] = true;
  return ids;
}

var strategyIds = strategyModuleIds();

function isDelegated(id) {
  if (SHIMS[id]) return true;
  return !!(strategyIds && strategyIds[id]);
}

var modules = {};
var queue = [ENTRY];

while (queue.length) {
  var id = queue.shift();
  if (modules[id] || isDelegated(id)) continue;
  var fp = path.join(ROOT, id.split('/').join(path.sep));
  var content;
  try {
    content = fs.readFileSync(fp, 'utf8');
  } catch (e) {
    modules[id] = { missing: true, content: 'module.exports = null;', deps: [] };
    continue;
  }
  // 剥离 shebang
  if (/^#!/.test(content)) {
    content = content.replace(/^#![^\n]*\n?/, '');
  }
  var deps = [];
  REQUIRES.lastIndex = 0;
  content = content.replace(REQUIRES, function (all, quote, rel) {
    if (isDelegated(rel)) {
      return 'require(' + JSON.stringify(rel) + ')';
    }
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
    if (!modules[d] && !isDelegated(d)) queue.push(d);
  });
}

var lines = [];
lines.push('/* 自动生成：node dev/build-presentation-bundle.js（请勿手改） */');
lines.push('/* PresentationEngine 浏览器 bundle：C01 接入 practice.html，复用 strategy bundle 的 require 命名空间 */');
lines.push('(function (global) {');
lines.push("'use strict';");
lines.push('var __defs = {}, __mods = {};');
lines.push('function __req(id) {');
lines.push("  if (__mods[id]) return __mods[id].exports;");
lines.push("  if (__defs[id]) {");
lines.push('    var m = { exports: {} };');
lines.push('    __mods[id] = m;');
lines.push('    __defs[id](m, m.exports, __req);');
lines.push('    return m.exports;');
lines.push('  }');
lines.push("  if (global.StrategyBundle && typeof global.StrategyBundle.req === 'function') {");
lines.push('    try { return global.StrategyBundle.req(id); } catch (e) { /* delegate 失败继续抛本地错误 */ }');
lines.push('  }');
lines.push("  throw new Error('presentation-bundle: 模块未注册: ' + id);");
lines.push('}');

Object.keys(modules).forEach(function (id) {
  lines.push('__defs[' + JSON.stringify(id) + '] = function (module, exports, require) {');
  if (modules[id].missing) {
    lines.push('  module.exports = null;');
  } else {
    lines.push(modules[id].content);
  }
  lines.push('};');
});

lines.push('global.PresentationEngine = __req(' + JSON.stringify(ENTRY) + ');');
lines.push('global.PresentationBundle = __req(' + JSON.stringify(ENTRY) + ');');
lines.push('})(typeof window !== \'undefined\' ? window : (typeof globalThis !== \'undefined\' ? globalThis : this));');

var out = path.join(ROOT, 'shared', 'presentation-engine.bundle.js');
fs.writeFileSync(out, lines.join('\n'));

console.log('Presentation bundle written: shared/presentation-engine.bundle.js');
console.log('  inlined modules: ' + Object.keys(modules).length);
console.log('  delegated to strategy bundle: ' + (strategyIds ? Object.keys(strategyIds).length : '(bundle not found)'));
