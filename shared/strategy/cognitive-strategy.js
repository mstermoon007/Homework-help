/**
 * shared/strategy/cognitive-strategy.js — M3-13 Cognitive Level Strategy
 *
 * 认知层级决策优先级：
 *   ① 用户/策略明确指定 cognitiveLevel
 *        └─ 必须来自 Registry.COGNITIVE_LEVELS（不重新定义枚举）
 *        └─ 归一化到统一三层 recognize / understand / apply
 *        └─ 若题型支持范围不含该层级 → 落入后续判定
 *   ② QuestionType 支持范围 —— 作为候选范围过滤 ③④
 *   ③ KnowledgePoint cognitiveLevel（cognition.raw → 统一三层）
 *   ④ 默认认知层级 —— 优先 understand，在题型支持范围内选择
 *
 * 输出：cognitiveLevel ∈ { recognize, understand, apply }
 */
'use strict';

var Registry = require('../question-type-registry.js');
var KnowledgePoint = require('../knowledge-point.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

// 唯一认知枚举来源（不得重新定义）
var ENUM = Registry.COGNITIVE_LEVELS;

// 统一三层（均为 Registry 枚举子集）
var UNIFIED_LEVELS = ['recognize', 'understand', 'apply'];
UNIFIED_LEVELS.forEach(function (l) {
  if (ENUM.indexOf(l) === -1) {
    throw new Error('cognitive-strategy: 统一层级 ' + l + ' 不在 Registry.COGNITIVE_LEVELS 中');
  }
});

// 完整枚举 → 统一三层
var FULL_TO_UNIFIED = {
  recall: 'recognize', recognize: 'recognize',
  understand: 'understand',
  apply: 'apply', analyze: 'apply', evaluate: 'apply', create: 'apply'
};

// KB 中文认知层级 → 统一三层
var KP_RAW_TO_UNIFIED = {
  '了解': 'recognize',
  '理解': 'understand',
  '掌握': 'apply',
  '运用': 'apply'
};

function toUnified(level) {
  if (typeof level !== 'string') return null;
  if (UNIFIED_LEVELS.indexOf(level) !== -1) return level;
  return FULL_TO_UNIFIED[level] || null;
}

function kpToUnified(kp) {
  var raw = (kp.cognition && kp.cognition.raw) ||
    (kp.legacy && kp.legacy.cognitive_level);
  if (raw) {
    if (KP_RAW_TO_UNIFIED[raw]) return KP_RAW_TO_UNIFIED[raw];
    if (ENUM.indexOf(raw) !== -1) return toUnified(raw);
  }
  var num = kp.cognition && kp.cognition.level;
  if (typeof num === 'number' && isFinite(num)) {
    if (num >= 0.67) return 'apply';
    if (num >= 0.33) return 'understand';
    return 'recognize';
  }
  return null;
}

function supportedUnifiedSet(typeId) {
  var t = Registry.get(typeId);
  if (!t) {
    throw new StrategyError('非法 questionTypeId: ' + typeId, CODES.INVALID_REQUEST, { questionTypeId: typeId });
  }
  var set = {};
  (t.cognitiveLevels || []).forEach(function (l) {
    var u = toUnified(l);
    if (u) set[u] = true;
  });
  return set;
}

function resolveCognitiveLevel(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }

  // ② QuestionType 支持范围（过滤 + 兜底候选）
  var typeId = options.questionType || options.questionTypeId || null;
  var allowed = typeId ? supportedUnifiedSet(typeId) : null;

  // ① 用户/策略明确指定
  if (options.cognitiveLevel != null) {
    if (typeof options.cognitiveLevel !== 'string' || ENUM.indexOf(options.cognitiveLevel) === -1) {
      throw new StrategyError('非法 cognitiveLevel（必须来自 Registry.COGNITIVE_LEVELS）: ' + options.cognitiveLevel, CODES.INVALID_REQUEST, { cognitiveLevel: options.cognitiveLevel });
    }
    var mapped = toUnified(options.cognitiveLevel);
    if (!allowed || allowed[mapped]) return mapped;
    // 不在题型支持范围内 → 落入 ③④
  }

  // ③ KnowledgePoint cognitiveLevel（受题型支持范围过滤）
  if (kp) {
    var kpLevel = kpToUnified(kp);
    if (kpLevel && (!allowed || allowed[kpLevel])) return kpLevel;
  }

  // ④ 默认认知层级（优先 understand，在支持范围内选择）
  if (allowed) {
    var order = ['understand', 'recognize', 'apply'];
    for (var i = 0; i < order.length; i++) {
      if (allowed[order[i]]) return order[i];
    }
    for (i = 0; i < UNIFIED_LEVELS.length; i++) {
      if (allowed[UNIFIED_LEVELS[i]]) return UNIFIED_LEVELS[i];
    }
  }
  return 'understand';
}

module.exports = {
  UNIFIED_LEVELS: UNIFIED_LEVELS,
  toUnified: toUnified,
  kpToUnified: kpToUnified,
  supportedUnifiedSet: supportedUnifiedSet,
  resolveCognitiveLevel: resolveCognitiveLevel
};
