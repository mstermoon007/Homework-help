/**
 * shared/strategy/question-type-strategy.js — M3-06 Question Type Strategy
 *
 * 题型决策优先级（输出 questionTypeId）：
 *   ① 用户明确指定 questionType   —— 合法且 KP 支持 → 直接返回；KP 不支持 → 拒绝（抛错）
 *   ② Capability 支持的指定 subtype —— 归一化 legacy subtype，受支持 → 返回；否则落到下一级
 *   ③ CognitiveLevel 匹配         —— 在受支持题型中找第一个认知层级匹配者
 *   ④ KP 默认题型                 —— presentation.questionTypes 顺序中的第一个受支持题型
 *   ⑤ Registry 默认题型           —— 优先 'calc'，否则受支持列表首项
 *
 * 不变式：输出必须属于该 KP 的受支持题型集合；KP 无任何受支持题型 → NO_CAPABILITY。
 */
'use strict';

var Registry = require('../question-type-registry.js');
var Resolver = require('../capability-resolver.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

function selectQuestionType(kp, options) {
  options = options || {};

  if (!kp || typeof kp !== 'object') {
    throw new StrategyError('KP 不能为空', CODES.INVALID_REQUEST);
  }

  var supported = supportedTypes(kp);

  // ① 用户明确指定 questionType
  if (options.questionTypeId != null) {
    var requested = options.questionTypeId;
    if (!Registry.has(requested)) {
      throw new StrategyError('非法 questionTypeId: ' + requested, CODES.INVALID_REQUEST, { questionTypeId: requested });
    }
    if (supported.indexOf(requested) === -1) {
      throw new StrategyError('KP 不支持该题型: ' + requested, CODES.NO_CAPABILITY, { questionTypeId: requested, knowledgePointId: kp.id });
    }
    return requested;
  }

  // ② Capability 支持的指定 subtype
  if (options.subtype != null) {
    var normalized = Registry.normalizeQuestionType(options.subtype);
    if (normalized && normalized.id && supported.indexOf(normalized.id) !== -1) {
      return normalized.id;
    }
  }

  // ③ CognitiveLevel 匹配
  if (options.cognitiveLevel != null) {
    var matched = matchByCognitiveLevel(supported, options.cognitiveLevel);
    if (matched) return matched;
  }

  // ④ KP 默认题型
  var defaultFromKP = getDefaultFromKP(kp, supported);
  if (defaultFromKP) return defaultFromKP;

  // ⑤ Registry 默认题型
  return getRegistryDefault(kp, supported);
}

function supportedTypes(kp) {
  return Resolver.getCapabilities(kp).questionTypes || [];
}

function matchByCognitiveLevel(supported, level) {
  if (typeof level !== 'string') return null;
  for (var i = 0; i < supported.length; i++) {
    var t = Registry.get(supported[i]);
    if (t && t.cognitiveLevels && t.cognitiveLevels.indexOf(level) !== -1) {
      return supported[i];
    }
  }
  return null;
}

function getDefaultFromKP(kp, supported) {
  var qts = kp && kp.presentation && kp.presentation.questionTypes;
  if (!Array.isArray(qts)) return null;
  for (var i = 0; i < qts.length; i++) {
    var token = qts[i] && (qts[i].rawType || qts[i].type);
    if (!token) continue;
    var norm = Registry.normalizeQuestionType(token);
    if (norm && norm.id && supported.indexOf(norm.id) !== -1) return norm.id;
  }
  return null;
}

function getRegistryDefault(kp, supported) {
  if (supported.length === 0) {
    throw new StrategyError('KP 无任何受支持题型: ' + (kp && kp.id), CODES.NO_CAPABILITY, { knowledgePointId: kp && kp.id });
  }
  if (supported.indexOf('calc') !== -1) return 'calc';
  return supported[0];
}

module.exports = {
  selectQuestionType: selectQuestionType,
  supportedTypes: supportedTypes,
  matchByCognitiveLevel: matchByCognitiveLevel,
  getDefaultFromKP: getDefaultFromKP,
  getRegistryDefault: getRegistryDefault
};
