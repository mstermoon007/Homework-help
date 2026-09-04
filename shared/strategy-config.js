/**
 * shared/strategy-config.js — M3 Feature Flag & Strategy Config
 *
 * 统一策略引擎的特性开关与配置。
 * 默认保持 'legacy' 以维持现有行为零修改。
 */
'use strict';

var STRATEGY_VERSION = '1.0.0';
var DEFAULT_STRATEGY = 'legacy'; // 'legacy' | 'strategy-v1'

// ---- R5：年级难度锚点表（三维螺旋-难度维度，衔接 R2-b 的 KP 难度标定）----
// 依据 docs/AI_REFACTOR_PLAN.html R5 与用户确认的 Q6 锚点表：
//   G1 1-2 / G2 2-4 / G3 3-5 / G4 4-7 / G5 5-8 / G6 6-10
// 语义：该年级 KP 的基础难度应落在锚点区间 [min,max]；区间随年级螺旋上升（相邻年级区间有重叠）。
// 与 dev/difficulty-anchor-table.js（R2-b 门禁用）保持一致，这里作为大服务层可读常量落库。
var GRADE_DIFFICULTY_ANCHORS = {
  1: [1, 2],
  2: [2, 4],
  3: [3, 5],
  4: [4, 7],
  5: [5, 8],
  6: [6, 10]
};
// 查询：年级 → 难度锚点区间 [min,max]；年级非法时返回 null
function difficultyAnchorOf(grade) {
  return GRADE_DIFFICULTY_ANCHORS[Number(grade)] || null;
}

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
  GRADE_DIFFICULTY_ANCHORS: GRADE_DIFFICULTY_ANCHORS,
  difficultyAnchorOf: difficultyAnchorOf,
  getStrategy: getStrategy,
  setStrategy: setStrategy,
  isLegacy: isLegacy,
  isStrategyV1: isStrategyV1,
  getConfig: getConfig,
  setConfigOverrides: setConfigOverrides,
  reset: reset
};