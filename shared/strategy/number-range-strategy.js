/**
 * shared/strategy/number-range-strategy.js — M3-12 Number Range Strategy
 *
 * 数值范围优先级（自上而下取第一个有效来源）：
 *   ① 用户 settings.numberRange
 *   ② KnowledgePoint numberRangeDefault
 *   ③ DifficultyStatic（静态难度 profile → scale → diffMax）
 *   ④ Difficulty Profile（difficulty.js 科目 profile → scale → diffMax）
 *
 * 输出：
 *   numberRange: { min, max }
 *
 * 不变式：min <= max（违反时交换并记录）。
 */
'use strict';

var StaticDifficulty = require('./static-difficulty.js');
var Difficulty = require('../difficulty.js');
var PluginUtil = require('../common.js');
var KnowledgePoint = require('../knowledge-point.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

var BASE_MAX = 20; // 难度档 3 的基准最大值（与 consumeProfile('expression').maxOperand 一致）

function isValidRange(r) {
  return !!r && typeof r === 'object' &&
    typeof r.min === 'number' && isFinite(r.min) &&
    typeof r.max === 'number' && isFinite(r.max);
}

function normalizeRange(min, max, source) {
  if (min > max) {
    var t = min; min = max; max = t;
  }
  return { min: min, max: max, source: source };
}

function resolveNumberRange(options) {
  options = options || {};

  // ① 用户 settings
  var userRange = options.settings && options.settings.numberRange;
  if (isValidRange(userRange)) {
    return normalizeRange(userRange.min, userRange.max, 'user-settings');
  }

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }

  // ② KnowledgePoint numberRangeDefault（Canonical: numeric.range；Legacy: number_range_default）
  var kpRange = kp && (kp.numeric && kp.numeric.range ? kp.numeric.range : kp.number_range_default);
  if (isValidRange(kpRange)) {
    return normalizeRange(kpRange.min, kpRange.max, 'knowledge-point');
  }

  // ③ DifficultyStatic（静态难度 profile 的 scale）
  if (kp) {
    var staticProfile = StaticDifficulty.resolveStaticDifficulty(kp, options.questionType, options.customParams);
    if (staticProfile && typeof staticProfile.scale === 'number') {
      return normalizeRange(1, PluginUtil.diffMax(BASE_MAX, staticProfile.level), 'difficulty-static');
    }
  }

  // ④ Difficulty Profile（difficulty.js 按 level → scale → diffMax）
  var level = options.level != null ? options.level : 3;
  var profile = Difficulty.paramsFor('math', level);
  return normalizeRange(1, PluginUtil.diffMax(BASE_MAX, profile.level), 'difficulty-profile');
}

module.exports = {
  resolveNumberRange: resolveNumberRange,
  isValidRange: isValidRange,
  normalizeRange: normalizeRange,
  BASE_MAX: BASE_MAX
};
