/**
 * shared/strategy/strategy-validator.js — M3-18 Strategy Validator
 *
 * QuestionPlan 最终校验（进入 Generator 前的最后一道门）：
 *   ① KP 存在
 *   ② questionType 合法
 *   ③ KP 支持 questionType
 *   ④ cognitiveLevel 合法
 *   ⑤ difficulty 1~10
 *   ⑥ spiralLevel 合法
 *   ⑦ spiralLevel <= maxSpiralLevel
 *   ⑧ count > 0
 *   ⑨ numberRange 合法
 *   ⑩ maxSteps >= 1
 *   ⑪ context 合法
 *
 * 任何一项失败 → valid:false，不允许进入 Generator。
 */
'use strict';

var KnowledgePoint = require('../knowledge-point.js');
var Registry = require('../question-type-registry.js');
var Resolver = require('../capability-resolver.js');

var CONTEXT_LEGAL = ['pure', 'simple', 'standard', 'complex', 'none'];

function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

function validatePlan(plan) {
  var errors = [];

  if (!plan || typeof plan !== 'object') {
    return { valid: false, errors: ['Plan 必须是对象'] };
  }

  // ① KP 存在
  var kp = null;
  // Refactor Step 2：内部唯一语义 knowledgePointIds[]（边界兼容旧单数）
  var kpIds = (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds.length)
    ? plan.knowledgePointIds.slice()
    : (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId ? [plan.knowledgePointId] : []);
  if (!kpIds.length) {
    errors.push('① knowledgePointIds 必填（数组）');
  } else {
    kpIds.forEach(function (id) {
      var k = KnowledgePoint.get(id);
      if (!k) errors.push('① 知识点不存在: ' + id);
    });
    kp = KnowledgePoint.get(kpIds[0]);
  }

  // ② questionType 合法
  if (!plan.questionTypeId || typeof plan.questionTypeId !== 'string') {
    errors.push('② questionTypeId 必填');
  } else if (!Registry.has(plan.questionTypeId)) {
    errors.push('② 非法 questionTypeId: ' + plan.questionTypeId);
  }

  // ③ KP 支持 questionType
  if (kp && plan.questionTypeId && Registry.has(plan.questionTypeId)) {
    var supported = Resolver.getCapabilities(kp).questionTypes || [];
    if (supported.indexOf(plan.questionTypeId) === -1) {
      errors.push('③ KP 不支持该题型: ' + plan.questionTypeId + '（支持: ' + supported.join(',') + '）');
    }
  }

  // ④ cognitiveLevel 合法（Registry 枚举）
  if (plan.cognitiveLevel != null) {
    if (typeof plan.cognitiveLevel !== 'string' || Registry.COGNITIVE_LEVELS.indexOf(plan.cognitiveLevel) === -1) {
      errors.push('④ 非法 cognitiveLevel: ' + plan.cognitiveLevel);
    }
  }

  // ⑤ difficulty 1~10
  if (plan.difficulty == null || !isInt(plan.difficulty) || plan.difficulty < 1 || plan.difficulty > 10) {
    errors.push('⑤ difficulty 必须是 1-10 的整数: ' + plan.difficulty);
  }

  // ⑥ spiralLevel 合法
  if (plan.spiralLevel == null || !isInt(plan.spiralLevel) || plan.spiralLevel < 1 || plan.spiralLevel > 6) {
    errors.push('⑥ spiralLevel 必须是 1-6 的整数: ' + plan.spiralLevel);
  } else if (kp && isInt(plan.spiralLevel)) {
    // ⑦ spiralLevel <= maxSpiralLevel
    var maxSpiral = (kp.spiral && typeof kp.spiral.maxLevel === 'number') ? kp.spiral.maxLevel : 1;
    if (plan.spiralLevel > maxSpiral) {
      errors.push('⑦ spiralLevel ' + plan.spiralLevel + ' 超过 maxSpiralLevel ' + maxSpiral);
    }
  }

  // ⑧ count > 0
  if (plan.count == null || !isInt(plan.count) || plan.count < 1) {
    errors.push('⑧ count 必须是 >=1 的整数: ' + plan.count);
  }

  // ⑨ numberRange 合法
  var constraints = plan.constraints || {};
  var nr = constraints.numberRange;
  if (!nr || typeof nr !== 'object' || typeof nr.min !== 'number' || !isFinite(nr.min) ||
      typeof nr.max !== 'number' || !isFinite(nr.max) || nr.min > nr.max) {
    errors.push('⑨ numberRange 必须是 {min,max} 且 min<=max: ' + JSON.stringify(nr));
  }

  // ⑩ maxSteps >= 1
  if (constraints.maxSteps == null || !isInt(constraints.maxSteps) || constraints.maxSteps < 1) {
    errors.push('⑩ maxSteps 必须是 >=1 的整数: ' + constraints.maxSteps);
  }

  // ⑪ context 合法
  if (plan.contextType != null) {
    if (CONTEXT_LEGAL.indexOf(plan.contextType) === -1) {
      errors.push('⑪ 非法 contextType: ' + plan.contextType);
    }
  }

  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  CONTEXT_LEGAL: CONTEXT_LEGAL,
  validatePlan: validatePlan
};
