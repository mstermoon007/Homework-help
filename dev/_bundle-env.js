#!/usr/bin/env node
/**
 * dev/_bundle-env.js — dev 门禁共享的浏览器等价环境
 *
 * 按 practice.html 的加载顺序装配：KBL Runtime → KnowledgeContext → knowledge-compat
 * → strategy/presentation bundle，并返回挂载后的全局引用。
 *
 * 仅 dev 门禁使用（用于测试不可在 Node 直接 require 的 Frozen Strategy/Generator），
 * 不属于产品运行链，不得被 shared/ 引用。
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');

if (typeof global.window === 'undefined') global.window = global;
if (!global.App) global.App = {};

[
  'shared/core/common.js',
  'shared/catalog/difficulty.js',
  'shared/catalog/difficulty-static.js',
  'shared/knowledge/runtime/knowledge-runtime.js',
  'shared/orchestration/knowledge-context.js',
  'shared/engine/knowledge-compat.js',
  'shared/engine/strategy-engine.bundle.js',
  'shared/engine/presentation-engine.bundle.js'
].forEach(function (rel) { require(path.join(ROOT, rel)); });

module.exports = {
  StrategyEngine: global.StrategyEngine,
  GeneratorSelector: global.GeneratorSelector,
  GeneratorMode: global.GeneratorMode,
  GeneratorRegistry: global.GeneratorRegistry,
  CapabilityResolver: global.CapabilityResolver,
  CapabilityModel: global.CapabilityModel,
  CapabilityMatrix: global.CapabilityMatrix,
  // P28-21：唯一 Legacy Adapter（SemanticQuestion → Legacy），替代已删除的 semantic-question-bridge
  RenderFormat: (global.PresentationEngine && global.PresentationEngine.RenderFormat) || null,
  ComprehensiveStrategy: global.ComprehensiveStrategy,
  KnowledgeContext: global.KnowledgeContext
};