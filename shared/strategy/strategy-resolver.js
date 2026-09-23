/**
 * shared/strategy/strategy-resolver.js — M3-04 知识点接入层
 *
 * 统一通过 KnowledgePoint.strategyView() 获取标准 KP，禁止直接读取 knowledge-math.js 等。
 * KP 不存在 → 抛出 StrategyError → 不进入 Generator。
 */
'use strict';

var KnowledgePoint = require('../orchestration/knowledge-context.js'); // FINAL-22：经 KnowledgeContext 消费（原 knowledge-point.js 已并入 KBL runtime）
var StrategyError = require('./strategy-error.js').StrategyError;
var StrategyErrorCodes = require('./strategy-error.js').StrategyError.CODES;

function resolveKnowledgePoint(kpId) {
  if (!kpId || typeof kpId !== 'string') {
    throw new StrategyError('knowledgePointId 必填且必须是字符串', StrategyErrorCodes.INVALID_REQUEST);
  }
  var kp = KnowledgePoint.strategyView(kpId);
  if (!kp) {
    throw new StrategyError('知识点不存在: ' + kpId, StrategyErrorCodes.KP_NOT_FOUND, { knowledgePointId: kpId });
  }
  return kp;
}

function resolveMultiple(ids) {
  if (!Array.isArray(ids)) {
    throw new Error('ids 必须是数组');
  }
  var results = {};
  ids.forEach(function (id) {
    try {
      results[id] = KnowledgePoint.strategyView(id);
    } catch (e) {
      results[id] = null;
    }
  });
  return results;
}

function hasKnowledgePoint(id) {
  return KnowledgePoint.strategyView(id) !== null;
}

module.exports = {
  resolveKnowledgePoint: resolveKnowledgePoint,
  resolveMultiple: resolveMultiple,
  hasKnowledgePoint: hasKnowledgePoint
};