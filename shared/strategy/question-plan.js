/**
 * shared/strategy/question-plan.js — M3-02 Question Plan Schema
 *
 * 统一题目计划结构：描述「生成什么题」，不包含生成逻辑。
 * 供 Strategy Engine 产出，Generator 消费。
 */
'use strict';

var StrategyConfig = require('../strategy-config.js');
var Registry = require('../question-type-registry.js');

var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 10;
var SPIRAL_MIN = 1;
var SPIRAL_MAX = 6;

var VALID_COGNITIVE_LEVELS = ['recall', 'recognize', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

var VALID_CONTEXT_TYPES = ['pure', 'simple', 'standard', 'complex'];

function validateQuestionPlan(plan) {
  var errors = [];

  if (!plan || typeof plan !== 'object') {
    errors.push('Plan 必须是对象');
    return { valid: false, errors: errors };
  }

  // 核心必填字段
  if (!plan.knowledgePointId || typeof plan.knowledgePointId !== 'string') {
    errors.push('knowledgePointId 是必填字符串');
  }

  if (!plan.questionTypeId || typeof plan.questionTypeId !== 'string') {
    errors.push('questionTypeId 是必填字符串');
  } else if (!['oral', 'calc', 'fill', 'choice', 'judge', 'apply', 'open', 'geometry', 'recognize'].includes(plan.questionTypeId)) {
    errors.push('非法 questionTypeId: ' + plan.questionTypeId);
  }

  // cognitiveLevel
  if (plan.cognitiveLevel != null) {
    if (typeof plan.cognitiveLevel !== 'string' || !VALID_COGNITIVE_LEVELS.includes(plan.cognitiveLevel)) {
      errors.push('非法 cognitiveLevel: ' + plan.cognitiveLevel);
    }
  }

  // difficulty
  if (plan.difficulty != null) {
    var d = plan.difficulty;
    if (typeof d !== 'number' || d < 1 || d > 10 || d % 1 !== 0) {
      errors.push('difficulty 必须是 1-10 的整数');
    }
  }

  // spiralLevel
  if (plan.spiralLevel != null) {
    var sl = plan.spiralLevel;
    if (typeof sl !== 'number' || sl < 1 || sl > 6 || sl % 1 !== 0) {
      errors.push('spiralLevel 必须是 1-6 的整数');
    }
  }

  // count
  if (plan.count != null) {
    var c = plan.count;
    if (typeof c !== 'number' || c < 1 || c % 1 !== 0) {
      errors.push('count 必须是 >=1 的整数');
    }
  }

  // constraints
  if (plan.constraints != null) {
    if (typeof plan.constraints !== 'object') {
      errors.push('constraints 必须是对象');
    } else {
      var cst = plan.constraints;

      if (cst.numberRange != null) {
        if (typeof cst.numberRange !== 'object' || cst.numberRange === null ||
            cst.numberRange.min == null || cst.numberRange.max == null) {
          errors.push('constraints.numberRange 必须是 {min, max} 对象');
        } else if (typeof cst.numberRange.min !== 'number' || typeof cst.numberRange.max !== 'number' ||
                   cst.numberRange.min > cst.numberRange.max) {
          errors.push('constraints.numberRange.min/max 必须是数字且 min <= max');
        }
      }

      if (cst.maxSteps != null && (typeof cst.maxSteps !== 'number' || cst.maxSteps < 1 || cst.maxSteps % 1 !== 0)) {
        errors.push('constraints.maxSteps 必须是 >=1 的整数');
      }

      if (cst.allowBracket != null && typeof cst.allowBracket !== 'boolean') {
        errors.push('constraints.allowBracket 必须是布尔值');
      }

      if (cst.allowMultDiv != null && typeof cst.allowMultDiv !== 'boolean') {
        errors.push('constraints.allowMultDiv 必须是布尔值');
      }

      if (cst.contextType != null) {
        if (typeof cst.contextType !== 'string' || !['pure', 'simple', 'standard', 'complex'].includes(cst.contextType)) {
          errors.push('constraints.contextType 必须是 pure/simple/standard/complex 之一');
        }
      }
    }
  }

  // 固定样式 + 复杂度统筹（M3-13/14）
  var VALID_STYLES = ['calc', 'fill', 'choice', 'judge', 'story', 'shape', 'open'];
  if (plan.style != null) {
    if (typeof plan.style !== 'string' || !VALID_STYLES.includes(plan.style)) {
      errors.push('非法 style: ' + plan.style + '（应为 ' + VALID_STYLES.join('/') + '）');
    }
  }
  if (plan.svgTemplate != null && typeof plan.svgTemplate !== 'string') {
    errors.push('svgTemplate 必须是字符串');
  }
  if (plan.complexity != null) {
    var cx = plan.complexity;
    if (typeof cx !== 'object' || cx === null) {
      errors.push('complexity 必须是对象');
    } else {
      if (!['simple', 'standard', 'complex'].includes(cx.tier)) {
        errors.push('非法 complexity.tier: ' + cx.tier + '（应为 simple/standard/complex）');
      }
      if (cx.rangeBoost != null && (typeof cx.rangeBoost !== 'number' || cx.rangeBoost < 0 || cx.rangeBoost > 2)) {
        errors.push('complexity.rangeBoost 必须是 0-2 的数字');
      }
      if (cx.mixLevel != null && (typeof cx.mixLevel !== 'number' || cx.mixLevel < 0 || cx.mixLevel > 2)) {
        errors.push('complexity.mixLevel 必须是 0-2 的数字');
      }
    }
  }

  // 禁止字段
  var forbidden = ['svg', 'html', 'generate', 'generator', 'render', 'template', 'execute', 'executeFunction'];
  forbidden.forEach(function (k) {
    if (plan[k] !== undefined) {
      errors.push('禁止字段: ' + k + ' (不允许在 Plan 中包含 SVG/HTML/生成器)');
    }
  });

  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  validateQuestionPlan: validateQuestionPlan
};