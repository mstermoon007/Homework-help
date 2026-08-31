/**
 * shared/strategy-config.js — M3 Feature Flag & Strategy Config
 *
 * 统一策略引擎的特性开关与配置。
 * 默认保持 'legacy' 以维持现有行为零修改。
 */
'use strict';

var STRATEGY_VERSION = '1.0.0';
var DEFAULT_STRATEGY = 'legacy'; // 'legacy' | 'strategy-v1'

// 内部状态（运行时仅读，启动时确定）
var _currentStrategy = null;
var _configOverrides = {};

function getStrategy() {
  if (_currentStrategy) return _currentStrategy;
  // 优先级：环境变量 > 全局配置 > 默认
  if (typeof process !== 'undefined' && process.env && process.env.GENERATION_STRATEGY) {
    return process.env.GENERATION_STRATEGY;
  }
  if (typeof globalThis !== 'undefined' && globalThis.__GENERATION_STRATEGY__) {
    return globalThis.__GENERATION_STRATEGY__;
  }
  return DEFAULT_STRATEGY;
}

function setStrategy(strategy) {
  if (strategy !== 'legacy' && strategy !== 'strategy-v1') {
    throw new Error('Invalid strategy: ' + strategy + ' (expected "legacy" | "strategy-v1")');
  }
  _currentStrategy = strategy;
  if (typeof globalThis !== 'undefined') {
    globalThis.__GENERATION_STRATEGY__ = strategy;
  }
}

function isLegacy() {
  return getStrategy() === 'legacy';
}

function isStrategyV1() {
  return getStrategy() === 'strategy-v1';
}

function getConfig() {
  return {
    version: STRATEGY_VERSION,
    current: getStrategy(),
    overrides: _configOverrides,
    features: {
      strategyEngine: isStrategyV1(),
      legacyFallback: isLegacy()
    }
  };
}

function setConfigOverrides(overrides) {
  _configOverrides = Object.assign({}, _configOverrides, overrides);
}

function reset() {
  _currentStrategy = null;
  _configOverrides = {};
}

module.exports = {
  STRATEGY_VERSION: STRATEGY_VERSION,
  DEFAULT_STRATEGY: DEFAULT_STRATEGY,
  getStrategy: getStrategy,
  setStrategy: setStrategy,
  isLegacy: isLegacy,
  isStrategyV1: isStrategyV1,
  getConfig: getConfig,
  setConfigOverrides: setConfigOverrides,
  reset: reset
};