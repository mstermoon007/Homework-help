/**
 * shared/strategy/strategy-result.js — M3-03 Strategy Result
 *
 * 统一策略引擎输出结构。
 * 只描述「生成计划」，不包含题目内容、SVG/HTML、DOM、生成逻辑。
 * 供 Generator 层消费。
 */
'use strict';

function createStrategyResult(plans, meta, warnings) {
  var m = {
    engine: 'strategy-v1',
    version: '1.0',
    generatedAt: new Date().toISOString()
  };
  // 合并调用方传入的 meta（trace / staticLevel / effectiveDifficulty 等）
  if (meta && typeof meta === 'object') {
    for (var k in meta) {
      if (Object.prototype.hasOwnProperty.call(meta, k)) m[k] = meta[k];
    }
  }
  return {
    plans: plans || [],
    meta: m,
    warnings: warnings || []
  };
}

function validateStrategyResult(result) {
  var errors = [];

  if (!result || typeof result !== 'object') {
    return { valid: false, errors: ['Result 必须是对象'] };
  }

  if (!Array.isArray(result.plans)) {
    return { valid: false, errors: ['plans 必须是数组'] };
  }

  for (var i = 0; i < result.plans.length; i++) {
    var plan = result.plans[i];
    if (!plan || typeof plan !== 'object') {
      return { valid: false, errors: ['plan[' + i + '] 必须是对象'] };
    }
    if (!plan.knowledgePointId || typeof plan.knowledgePointId !== 'string') {
      return { valid: false, errors: ['plan[' + i + '] 缺少 knowledgePointId'] };
    }
    if (!plan.questionTypeId || typeof plan.questionTypeId !== 'string') {
      return { valid: false, errors: ['plan[' + i + '] 缺少 questionTypeId'] };
    }
  }

  if (result.meta && typeof result.meta !== 'object') {
    return { valid: false, errors: ['meta 必须是对象'] };
  }
  if (result.warnings && !Array.isArray(result.warnings)) {
    return { valid: false, errors: ['warnings 必须是数组'] };
  }

  // 禁止字段
  var forbidden = ['questions', 'svg', 'html', 'dom', 'render', 'renderHtml'];
  for (var i = 0; i < forbidden.length; i++) {
    var k = forbidden[i];
    if (result[k] !== undefined) {
      return { valid: false, errors: ['禁止字段: ' + k + ' (不允许在 StrategyResult 中包含题目/HTML/SVG)'] };
    }
  }

  return { valid: true, errors: [] };
}

module.exports = {
  createStrategyResult: createStrategyResult,
  validateStrategyResult: validateStrategyResult
};