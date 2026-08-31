/**
 * shared/strategy/context-strategy.js — M3-15 Context Strategy
 *
 * 情境类型决策规则：
 *   1) QuestionType 不支持 context → 'none'
 *   2) 支持 context → 使用 KP contextDefault
 *   3) 高螺旋（spiralLevel >= 4）/ 应用认知（unified 'apply'）
 *      → 允许提高情境复杂度（+1 档，封顶 complex）
 *
 * 输出：contextType
 *
 * 第一版只使用项目已有情境枚举：pure / simple / standard / complex
 * （来源：difficulty-static.js CONTEXT_MAP / question-plan.js VALID_CONTEXT_TYPES）
 */
'use strict';

var Registry = require('../question-type-registry.js');
var KnowledgePoint = require('../knowledge-point.js');
var CognitiveStrategy = require('./cognitive-strategy.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

// 项目已有情境枚举（不新增枚举值）
var CONTEXT_TIERS = ['pure', 'simple', 'standard', 'complex'];
var HIGH_SPIRAL_THRESHOLD = 4; // M3-14：S4 → context

function resolveContextType(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }

  var typeId = options.questionType || options.questionTypeId;
  var t = Registry.get(typeId);
  if (!t) {
    throw new StrategyError('非法 questionTypeId: ' + typeId, CODES.INVALID_REQUEST, { questionTypeId: typeId });
  }

  // 1) QuestionType 不支持 context → none
  if (!t.supports || t.supports.context !== true) return 'none';

  // 2) 支持 context → KP contextDefault
  var base = null;
  if (kp) {
    var def = (kp.context && kp.context.defaults && kp.context.defaults[0]) ||
      kp.context_default ||
      (kp.legacy && kp.legacy.context_default);
    if (CONTEXT_TIERS.indexOf(def) !== -1) base = def;
  }
  if (!base) base = 'standard';

  // 3) 高螺旋 / 应用认知 → 提高情境复杂度（+1 档，封顶 complex）
  var spiralLevel = Number(options.spiralLevel);
  if (!isFinite(spiralLevel) || spiralLevel < 1) spiralLevel = 1;
  var unified = CognitiveStrategy.toUnified(options.cognitiveLevel);
  var upgrade = spiralLevel >= HIGH_SPIRAL_THRESHOLD || unified === 'apply';

  if (upgrade) {
    var idx = CONTEXT_TIERS.indexOf(base);
    if (idx !== -1 && idx < CONTEXT_TIERS.length - 1) base = CONTEXT_TIERS[idx + 1];
  }

  return base;
}

module.exports = {
  CONTEXT_TIERS: CONTEXT_TIERS,
  HIGH_SPIRAL_THRESHOLD: HIGH_SPIRAL_THRESHOLD,
  resolveContextType: resolveContextType
};
