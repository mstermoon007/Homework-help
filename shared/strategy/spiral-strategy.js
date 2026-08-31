/**
 * shared/strategy/spiral-strategy.js — M3-14 Spiral Strategy
 *
 * 输入：
 *   spiral_level / max_spiral_level（或 knowledgePoint）
 *   difficulty / cognitiveLevel（第一版保留输入，不参与固定映射）
 *
 * 输出：
 *   { spiralLevel, variationMode }
 *
 * 第一版固定映射：
 *   S1 → prototype   S2 → numeric     S3 → presentation
 *   S4 → context     S5 → structure   S6 → transfer
 *
 * 不变式：spiralLevel 不得超过 max_spiral_level；超过 S6 的层级 variationMode 固定 transfer。
 */
'use strict';

var KnowledgePoint = require('../knowledge-point.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

var MODES = ['prototype', 'numeric', 'presentation', 'context', 'structure', 'transfer'];
var MODE_MAX = MODES.length; // S6

function toIntOr(n, fallback) {
  n = Number(n);
  if (!isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function resolveSpiral(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }

  var spiral = options.spiral_level != null ? options.spiral_level : options.spiralLevel;
  if (spiral == null && kp) {
    spiral = (kp.spiral && kp.spiral.level != null) ? kp.spiral.level : kp.spiral_level;
  }
  var maxSpiral = options.max_spiral_level != null ? options.max_spiral_level : options.maxSpiralLevel;
  if (maxSpiral == null && kp) {
    maxSpiral = (kp.spiral && kp.spiral.maxLevel != null) ? kp.spiral.maxLevel : kp.max_spiral_level;
  }

  var spiralLevel = toIntOr(spiral, 1);
  var maxLevel = toIntOr(maxSpiral, 1);

  // 不变式：不得超过 max_spiral_level
  if (spiralLevel > maxLevel) spiralLevel = maxLevel;

  var modeIdx = Math.min(spiralLevel, MODE_MAX) - 1;
  var variationMode = MODES[modeIdx];

  return {
    spiralLevel: spiralLevel,
    variationMode: variationMode
  };
}

module.exports = {
  MODES: MODES,
  resolveSpiral: resolveSpiral
};
