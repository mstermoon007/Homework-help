/**
 * shared/strategy/strategy-error.js — M3 Strategy Error
 *
 * 统一策略层异常，便于上层捕获与处理。
 * 不抛给 Generator。
 */
'use strict';

function StrategyError(message, code, detail) {
  Error.call(this);
  this.name = 'StrategyError';
  this.message = message;
  this.code = code || 'STRATEGY_ERROR';
  this.detail = detail || null;
}

StrategyError.prototype = Object.create(Error.prototype);
StrategyError.prototype.constructor = StrategyError;

StrategyError.CODES = {
  KP_NOT_FOUND: 'KP_NOT_FOUND',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_PLAN: 'INVALID_PLAN',
  NO_CAPABILITY: 'NO_CAPABILITY',
  GENERATOR_MISMATCH: 'GENERATOR_MISMATCH',
  // Core Domain 收缩（Refactor Step 1）：核心生成链仅接受 math。
  // 语文(cn)/英语(en) 返回明确 unsupported，禁止 fallback，不进入 Generator。
  UNSUPPORTED_SUBJECT: 'UNSUPPORTED_SUBJECT',
  // P0-03 Step 14：native 模式无合法候选时返回 GENERATOR_UNSUPPORTED（禁止静默 fallback legacy）。
  GENERATOR_UNSUPPORTED: 'GENERATOR_UNSUPPORTED',
  // P0-07 Step 33：combine=true 但无 Composite Generator 时显式失败，禁止 fallback 单 KP
  COMPOSITE_UNSUPPORTED: 'COMPOSITE_UNSUPPORTED'
};

function isStrategyError(err) {
  return err && err.name === 'StrategyError';
}

module.exports = {
  StrategyError: StrategyError,
  isStrategyError: isStrategyError
};