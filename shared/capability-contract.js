/**
 * shared/capability-contract.js — Capability Contract Schema (M2-R03)
 *
 * 定义并校验统一能力契约：
 *   KnowledgePoint → QuestionType → Capability
 *
 * 契约字段（每条 capability）：
 *   {
 *     knowledgePointId,      // 知识点 ID
 *     questionTypes: [{      // 每个可用题型
 *       id,                  // 标准 QuestionType Id（来自 Registry）
 *       cognitiveLevels,     // 认知层级列表（Registry 词表）
 *       difficultyRange,     // [min, max]，范围 [1,6]
 *       priority,            // 0-5 整数
 *       supported            // 布尔：是否声明可生成
 *     }]
 *   }
 *
 * 边界：只描述能力声明，不含 generateFunction / 插件引用 / SVG / HTML / 随机数。
 */
'use strict';

var Registry = require('./question-type-registry.js');

function validateCapabilityContract(cap) {
  var errors = [];
  var warnings = [];

  if (!cap || typeof cap !== 'object') {
    errors.push('capability 必须是对象');
    return { valid: false, errors: errors, warnings: warnings };
  }

  if (typeof cap.knowledgePointId !== 'string' || !cap.knowledgePointId) {
    errors.push('knowledgePointId 缺失');
  }

  if (!Array.isArray(cap.questionTypes)) {
    errors.push('questionTypes 必须是数组');
    return { valid: errors.length === 0, errors: errors, warnings: warnings };
  }

  cap.questionTypes.forEach(function (qt) {
    if (!qt || typeof qt !== 'object') { errors.push('存在非法 questionType 条目'); return; }
    if (typeof qt.id !== 'string' || !Registry.has(qt.id)) errors.push('非法/未知 questionType id: ' + qt.id);
    if (!Array.isArray(qt.cognitiveLevels) || qt.cognitiveLevels.length === 0) {
      errors.push(qt.id + ' cognitiveLevels 非法');
    } else {
      qt.cognitiveLevels.forEach(function (c) {
        if (Registry.COGNITIVE_LEVELS.indexOf(c) === -1) errors.push(qt.id + ' 非法 cognitiveLevel: ' + c);
      });
    }
    if (!Array.isArray(qt.difficultyRange) || qt.difficultyRange.length !== 2 ||
        qt.difficultyRange[0] < 1 || qt.difficultyRange[1] > 6 || qt.difficultyRange[0] > qt.difficultyRange[1]) {
      errors.push(qt.id + ' difficultyRange 非法: ' + JSON.stringify(qt.difficultyRange));
    }
    if (typeof qt.priority !== 'number' || qt.priority < 0 || qt.priority > 5 || qt.priority % 1 !== 0) {
      errors.push(qt.id + ' priority 非法: ' + qt.priority);
    }
    if (typeof qt.supported !== 'boolean') warnings.push(qt.id + ' 缺少 supported 布尔声明');
  });

  // 边界检查：禁止携带生成器/执行器引用
  ['generateFunction', 'generator', 'pluginFunction', 'plugin'].forEach(function (k) {
    if (cap[k] !== undefined) errors.push('Capability 禁止携带 ' + k);
  });

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

function validateQuestionTypeId(id) {
  if (typeof id !== 'string' || !id) return false;
  return Registry.has(id);
}

module.exports = {
  validateCapabilityContract: validateCapabilityContract,
  validateQuestionTypeId: validateQuestionTypeId,
  REGISTRY: Registry
};
