/**
 * shared/strategy/constraint-builder.js — M3-16 Constraint Builder（结构约束统一组装）
 *
 * 将以下已解析部件最终合成为 Generator 可直接消费的 constraints：
 *   difficulty, numberRange, cognitiveLevel, spiralLevel, context, questionType
 *
 * 输出结构（Generator 直接消费）：
 *   {
 *     difficulty,      // 最终难度（1-10 整数）
 *     questionType,    // 标准 questionTypeId
 *     cognitiveLevel,  // 统一三层 recognize/understand/apply
 *     spiralLevel,     // 1..maxSpiralLevel
 *     contextType,     // 项目已有情境枚举 / 'none'
 *     scale,           // 数值缩放（复用 difficulty.js paramsFor 既有逻辑）
 *     numberRange,     // { min, max }，min <= max
 *     maxSteps,        // >= 1
 *     allowBracket,    // boolean
 *     allowMultDiv     // boolean
 *   }
 */
'use strict';

var Difficulty = require('../difficulty.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

function requirePiece(pieces, key, label) {
  if (pieces[key] == null) {
    throw new StrategyError('ConstraintBuilder 缺少部件: ' + (label || key), CODES.INVALID_PLAN, { missing: key });
  }
  return pieces[key];
}

function buildConstraints(pieces) {
  pieces = pieces || {};

  var difficulty = requirePiece(pieces, 'difficulty', 'difficulty（最终难度）');
  var questionType = requirePiece(pieces, 'questionType', 'questionType');
  var cognitiveLevel = requirePiece(pieces, 'cognitiveLevel', 'cognitiveLevel');
  var spiralLevel = requirePiece(pieces, 'spiralLevel', 'spiralLevel');
  var contextType = requirePiece(pieces, 'contextType', 'contextType');
  var numberRange = requirePiece(pieces, 'numberRange', 'numberRange');
  var maxSteps = requirePiece(pieces, 'maxSteps', 'maxSteps');
  var allowBracket = requirePiece(pieces, 'allowBracket', 'allowBracket');
  var allowMultDiv = requirePiece(pieces, 'allowMultDiv', 'allowMultDiv');

  if (typeof difficulty !== 'number' || !isFinite(difficulty)) {
    throw new StrategyError('difficulty 必须是有限数字: ' + difficulty, CODES.INVALID_PLAN);
  }
  if (!numberRange || typeof numberRange.min !== 'number' || typeof numberRange.max !== 'number' || numberRange.min > numberRange.max) {
    throw new StrategyError('numberRange 非法: ' + JSON.stringify(numberRange), CODES.INVALID_PLAN);
  }

  // scale：复用 difficulty.js 既有逻辑（不复制公式）
  var scale = Difficulty.paramsFor('math', Math.round(difficulty)).scale;

  return {
    difficulty: Math.round(difficulty),
    questionType: questionType,
    cognitiveLevel: cognitiveLevel,
    spiralLevel: spiralLevel,
    contextType: contextType,
    scale: scale,
    numberRange: { min: numberRange.min, max: numberRange.max },
    maxSteps: maxSteps,
    allowBracket: !!allowBracket,
    allowMultDiv: !!allowMultDiv
  };
}

module.exports = {
  buildConstraints: buildConstraints
};
