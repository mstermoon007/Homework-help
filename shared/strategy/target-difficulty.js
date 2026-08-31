/**
 * shared/strategy/target-difficulty.js — M3-10 Target Difficulty（用户显式难度处理）
 *
 * 明确规则（v1，插件不得自行判断，必须经本模块）：
 *
 *   普通单知识点练习：
 *
 *   1) 用户明确选择难度（request.difficulty != null）
 *        ├─ allowDifficultyOverride !== false → targetDifficulty = clamp(difficulty, 1, 10)
 *        │                                     source = 'user'
 *        └─ 不允许覆盖                       → targetDifficulty = staticDifficulty
 *                                              source = 'static'
 *
 *   2) 用户未选择难度
 *        → KnowledgePoint → StaticDifficulty (M3-08)
 *        → targetDifficulty = staticLevel
 *        → source = 'static'
 *
 *   3) 自适应（adaptive === true）
 *        → effectiveDifficulty = clamp(targetDifficulty + adaptiveDelta, 1, 10)
 *        （核心公式复用 difficulty-strategy.applyEffective，M3-09）
 *
 *   4) 自适应关闭（缺省）
 *        → effectiveDifficulty = targetDifficulty
 */
'use strict';

var StaticDifficulty = require('./static-difficulty.js');
var DifficultyStrategy = require('./difficulty-strategy.js');
var KnowledgePoint = require('../knowledge-point.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

var DIFFICULTY_MIN = DifficultyStrategy.DIFFICULTY_MIN;
var DIFFICULTY_MAX = DifficultyStrategy.DIFFICULTY_MAX;

function clampUserDifficulty(n) {
  return Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, Math.round(Number(n))));
}

function resolveTargetDifficulty(options) {
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

  var staticDifficulty = StaticDifficulty.resolveStaticDifficulty(kp, options.questionType, options.customParams).level;

  // 1) 用户显式难度 + 覆盖判定
  var allowOverride = options.allowDifficultyOverride !== false;
  var targetDifficulty;
  var source;
  var requestedDifficulty = null;

  if (options.difficulty != null) {
    if (typeof options.difficulty !== 'number' || !isFinite(options.difficulty)) {
      throw new StrategyError('difficulty 必须是有限数字: ' + options.difficulty, CODES.INVALID_REQUEST, { difficulty: options.difficulty });
    }
    requestedDifficulty = clampUserDifficulty(options.difficulty);
    if (allowOverride) {
      targetDifficulty = requestedDifficulty;
      source = 'user';
    } else {
      targetDifficulty = staticDifficulty;
      source = 'static';
    }
  } else {
    targetDifficulty = staticDifficulty;
    source = 'static';
  }

  // 2) 自适应调整
  var adaptive = options.adaptive === true;
  var adaptiveDelta = 0;
  if (adaptive) {
    if (options.adaptiveDelta != null && (typeof options.adaptiveDelta !== 'number' || !isFinite(options.adaptiveDelta))) {
      throw new StrategyError('adaptiveDelta 必须是有限数字: ' + options.adaptiveDelta, CODES.INVALID_REQUEST, { adaptiveDelta: options.adaptiveDelta });
    }
    adaptiveDelta = options.adaptiveDelta == null ? 0 : options.adaptiveDelta;
  }

  var effectiveDifficulty = adaptive
    ? DifficultyStrategy.applyEffective(targetDifficulty, adaptiveDelta)
    : targetDifficulty;

  return {
    targetDifficulty: targetDifficulty,
    source: source,
    requestedDifficulty: requestedDifficulty,
    allowOverride: allowOverride,
    adaptive: adaptive,
    adaptiveDelta: adaptiveDelta,
    effectiveDifficulty: effectiveDifficulty,
    staticDifficulty: staticDifficulty
  };
}

module.exports = {
  resolveTargetDifficulty: resolveTargetDifficulty,
  clampUserDifficulty: clampUserDifficulty
};
