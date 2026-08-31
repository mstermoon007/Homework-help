/**
 * shared/strategy/structure-constraints.js — M3-11 Difficulty → Structure Constraints
 *
 * 将最终难度（target/effective，M3-10/09 产出）转换为结构约束：
 *
 *   constraints: {
 *     maxSteps,       // ← difficulty-static.js 已有逻辑（steps）
 *     allowBracket,   // ← difficulty-static.js 已有逻辑
 *     allowMultDiv,   // ← difficulty-static.js 已有逻辑
 *     numberRange     // ← M3-12 number-range-strategy
 *   }
 *
 * 规则：
 *   - 最终难度 === 静态难度 → 直接复用 difficulty-static.js 产出的 steps/allowBracket/allowMultDiv
 *   - 最终难度 !== 静态难度 → 复用 difficulty-static.js 内部的既有调用链
 *     Difficulty.paramsFor('math', level)（不复制 difficulty.js 的结构分档规则，只调用）
 */
'use strict';

var StaticDifficulty = require('./static-difficulty.js');
var NumberRangeStrategy = require('./number-range-strategy.js');
var Difficulty = require('../difficulty.js');
var KnowledgePoint = require('../knowledge-point.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

function clampFinalLevel(level) {
  return Math.min(10, Math.max(1, Math.round(Number(level))));
}

function resolveStructureConstraints(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }
  if (!kp || typeof kp !== 'object') {
    throw new StrategyError('KnowledgePoint 不能为空（knowledgePoint 或 knowledgePointId）', CODES.INVALID_REQUEST);
  }

  // 静态难度 profile（difficulty-static.js 已有逻辑，优先使用）
  var staticProfile = StaticDifficulty.resolveStaticDifficulty(kp, options.questionType, options.customParams);

  var finalLevel;
  if (options.finalDifficulty != null) {
    if (typeof options.finalDifficulty !== 'number' || !isFinite(options.finalDifficulty)) {
      throw new StrategyError('finalDifficulty 必须是有限数字: ' + options.finalDifficulty, CODES.INVALID_REQUEST, { finalDifficulty: options.finalDifficulty });
    }
    finalLevel = clampFinalLevel(options.finalDifficulty);
  } else {
    finalLevel = staticProfile.level;
  }

  var maxSteps;
  var allowBracket;
  var allowMultDiv;

  if (finalLevel === staticProfile.level) {
    // 优先：difficulty-static.js 已有逻辑
    maxSteps = staticProfile.steps;
    allowBracket = staticProfile.allowBracket;
    allowMultDiv = staticProfile.allowMultDiv;
  } else {
    // 复用 difficulty-static.js 内部既有调用链（Difficulty.paramsFor），不复制结构分档表
    var params = Difficulty.paramsFor('math', finalLevel);
    maxSteps = params.steps;
    allowBracket = !!params.allowBracket;
    allowMultDiv = !!params.allowMultDiv;
  }

  // M3-12 数值范围
  var numberRange = NumberRangeStrategy.resolveNumberRange({
    settings: options.settings,
    knowledgePoint: kp,
    questionType: options.questionType,
    customParams: options.customParams,
    level: finalLevel
  });

  return {
    finalDifficulty: finalLevel,
    maxSteps: maxSteps,
    allowBracket: allowBracket,
    allowMultDiv: allowMultDiv,
    numberRange: { min: numberRange.min, max: numberRange.max }
  };
}

module.exports = {
  resolveStructureConstraints: resolveStructureConstraints,
  clampFinalLevel: clampFinalLevel
};
