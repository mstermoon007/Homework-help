/**
 * shared/strategy/difficulty-strategy.js — M3-09 Effective Difficulty
 *
 * 有效难度 = 静态多维难度 + 学习者自适应调整：
 *
 *   Static Difficulty (M3-08)
 *            +
 *   Learner Adjustment (adaptiveDelta)
 *            ↓
 *   Effective Difficulty
 *
 * 第一版公式：
 *   effectiveDifficulty = staticLevel + adaptiveDelta
 *   clamp(effectiveDifficulty, 1, 10)
 *
 * adaptiveDelta 缺省为 0（无调整）。
 */
'use strict';

var StaticDifficulty = require('./static-difficulty.js');
var KnowledgePoint = require('../knowledge-point.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 10;

/**
 * 有效难度 v1 核心公式（唯一实现处，M3-10 复用）：
 *   effectiveDifficulty = clamp(baseLevel + adaptiveDelta, 1, 10)
 */
function applyEffective(baseLevel, adaptiveDelta) {
  if (typeof baseLevel !== 'number' || !isFinite(baseLevel)) {
    throw new StrategyError('baseLevel 必须是有限数字: ' + baseLevel, CODES.INVALID_REQUEST, { baseLevel: baseLevel });
  }
  var delta = adaptiveDelta == null ? 0 : adaptiveDelta;
  if (typeof delta !== 'number' || !isFinite(delta)) {
    throw new StrategyError('adaptiveDelta 必须是有限数字: ' + delta, CODES.INVALID_REQUEST, { adaptiveDelta: delta });
  }
  var raw = baseLevel + delta;
  var clamped = Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, raw));
  return Math.round(clamped);
}

function computeEffectiveDifficulty(options) {
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

  var adaptiveDelta = options.adaptiveDelta == null ? 0 : options.adaptiveDelta;
  if (typeof adaptiveDelta !== 'number' || !isFinite(adaptiveDelta)) {
    throw new StrategyError('adaptiveDelta 必须是有限数字: ' + adaptiveDelta, CODES.INVALID_REQUEST, { adaptiveDelta: adaptiveDelta });
  }

  // Static Difficulty（M3-08，唯一公式入口）
  var staticProfile = StaticDifficulty.resolveStaticDifficulty(kp, options.questionType, options.customParams);
  var staticLevel = staticProfile.level;

  // Effective Difficulty v1
  var raw = staticLevel + adaptiveDelta;
  var effectiveDifficulty = applyEffective(staticLevel, adaptiveDelta);

  return {
    staticLevel: staticLevel,
    adaptiveDelta: adaptiveDelta,
    raw: raw,
    effectiveDifficulty: effectiveDifficulty,
    static: staticProfile
  };
}

module.exports = {
  DIFFICULTY_MIN: DIFFICULTY_MIN,
  DIFFICULTY_MAX: DIFFICULTY_MAX,
  applyEffective: applyEffective,
  computeEffectiveDifficulty: computeEffectiveDifficulty
};
