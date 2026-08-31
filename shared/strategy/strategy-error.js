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
  GENERATOR_MISMATCH: 'GENERATOR_MISMATCH'
};

function isStrategyError(err) {
  return err && err.name === 'StrategyError';
}

module.exports = {
  StrategyError: StrategyError,
  isStrategyError: isStrategyError
};