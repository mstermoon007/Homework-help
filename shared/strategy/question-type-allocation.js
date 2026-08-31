/**
 * shared/strategy/question-type-allocation.js — M3-07 Question Type Allocation
 *
 * 处理 count > 1 的题型分配：
 *   例：10 题 → oral 4 / fill 3 / choice 3
 *
 * 分配算法（最大余数法，确定性）：
 *   base = floor(count / n)，rem = count % n
 *   优先级靠前的题型多拿 rem 中的 1 题（优先级由 M3-06 决策的题型置顶）
 *
 * 不变式（硬性要求）：
 *   sum(plan.count) === request.count
 *   不得出现 9 题 / 11 题；违反即抛 StrategyError。
 */
'use strict';

var Registry = require('../question-type-registry.js');
var KnowledgePoint = require('../knowledge-point.js');
var QuestionTypeStrategy = require('./question-type-strategy.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

function allocateQuestionTypes(options) {
  options = options || {};

  var count = options.count;
  if (typeof count !== 'number' || !isFinite(count) || count < 1 || Math.floor(count) !== count) {
    throw new StrategyError('count 必须是 >=1 的整数: ' + count, CODES.INVALID_REQUEST, { count: count });
  }

  var kp = null;
  if (options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  } else if (options.kp != null) {
    kp = options.kp;
  }

  // 1) 确定候选题型（保持优先级顺序，靠前者优先获得余数）
  var candidateTypes;
  if (Array.isArray(options.questionTypes) && options.questionTypes.length > 0) {
    candidateTypes = options.questionTypes.slice();
  } else if (kp) {
    candidateTypes = QuestionTypeStrategy.supportedTypes(kp);
  } else {
    throw new StrategyError('缺少候选题型：请提供 questionTypes 或 knowledgePointId/kp', CODES.INVALID_REQUEST);
  }

  // 2) 校验 + 去重（保持顺序）
  var seen = {};
  candidateTypes = candidateTypes.filter(function (t) {
    if (seen[t]) return false;
    seen[t] = true;
    return true;
  });
  candidateTypes.forEach(function (t) {
    if (!Registry.has(t)) {
      throw new StrategyError('非法 questionTypeId: ' + t, CODES.INVALID_REQUEST, { questionTypeId: t });
    }
    if (kp && QuestionTypeStrategy.supportedTypes(kp).indexOf(t) === -1) {
      throw new StrategyError('KP 不支持该题型: ' + t, CODES.NO_CAPABILITY, { questionTypeId: t, knowledgePointId: kp.id });
    }
  });
  if (candidateTypes.length === 0) {
    throw new StrategyError('KP 无任何受支持题型: ' + (kp && kp.id), CODES.NO_CAPABILITY, { knowledgePointId: kp && kp.id });
  }

  // 3) M3-06 决策的题型置顶（获得余数优先权）
  if (kp && candidateTypes.length > 1) {
    var preferred = QuestionTypeStrategy.selectQuestionType(kp, options);
    var idx = candidateTypes.indexOf(preferred);
    if (idx > 0) {
      candidateTypes.splice(idx, 1);
      candidateTypes.unshift(preferred);
    }
  }

  // 4) 最大余数分配
  var plans = distribute(count, candidateTypes);

  // 5) 不变式：sum(plan.count) === request.count
  var total = plans.reduce(function (n, p) { return n + p.count; }, 0);
  if (total !== count) {
    throw new StrategyError('分配不变式被破坏: sum=' + total + ' !== count=' + count, CODES.INVALID_PLAN, { total: total, count: count });
  }

  return {
    requestCount: count,
    total: total,
    plans: plans.map(function (p) {
      return {
        knowledgePointId: kp ? kp.id : (options.knowledgePointId || null),
        questionTypeId: p.questionTypeId,
        count: p.count
      };
    })
  };
}

function distribute(count, types) {
  var n = types.length;
  var base = Math.floor(count / n);
  var rem = count % n;
  var plans = [];
  for (var i = 0; i < n; i++) {
    var c = base + (i < rem ? 1 : 0);
    if (c > 0) plans.push({ questionTypeId: types[i], count: c });
  }
  return plans;
}

function validateAllocation(plans, requestCount) {
  var errors = [];
  if (!Array.isArray(plans)) {
    return { valid: false, errors: ['plans 必须是数组'] };
  }
  var sum = 0;
  plans.forEach(function (p, i) {
    if (!p || typeof p !== 'object') { errors.push('plan[' + i + '] 必须是对象'); return; }
    if (typeof p.questionTypeId !== 'string') errors.push('plan[' + i + '] 缺少 questionTypeId');
    if (typeof p.count !== 'number' || p.count < 1 || Math.floor(p.count) !== p.count) {
      errors.push('plan[' + i + '] count 必须是 >=1 的整数');
    } else {
      sum += p.count;
    }
  });
  if (sum !== requestCount) {
    errors.push('分配总数 ' + sum + ' !== 请求数 ' + requestCount);
  }
  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  allocateQuestionTypes: allocateQuestionTypes,
  distribute: distribute,
  validateAllocation: validateAllocation
};
