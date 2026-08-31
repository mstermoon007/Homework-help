/**
 * shared/capability-model.js — Capability 数据模型 (M2-04)
 *
 * 描述知识点「理论上」支持什么样的生成能力。
 * Capability ≠ Generator —— 只描述能力，不描述本次生成什么题目。
 *
 * 结构遵循 M2-04 标准：
 * {
 *   knowledgePointId,
 *   questionTypes: [
 *     {
 *       id,              // 标准 questionType Id
 *       cognitiveLevels, // 认知层级列表
 *       difficultyRange, // 难度范围 [min, max]
 *       priority         // 优先级 (0-5)
 *     }
 *   ]
 * }
 */
'use strict';

var TYPES = require('./question-type-registry.js').TYPES;
var Registry = require('./question-type-registry.js');

function defaultCapability() {
  return {
    knowledgePointId: '',
    questionTypes: []
  };
}

function isValidCapability(c) {
  if (!c || typeof c !== 'object') return false;
  if (c.knowledgePointId == null) return false;
  if (!Array.isArray(c.questionTypes)) return false;
  return c.questionTypes.every(function (qt) {
    if (!qt || typeof qt.id !== 'string') return false;
    if (!Array.isArray(qt.cognitiveLevels)) return false;
    if (!qt.difficultyRange || qt.difficultyRange.length !== 2) return false;
    if (typeof qt.priority !== 'number') return false;
    return true;
  });
}

function resolveCapability(canonicalKp) {
  // 基于 Canonical KnowledgePoint 推导 capability（能力声明，非执行器）。
  // 数据来源：presentation.questionTypes（已归一化）+ generation.capabilities（数据推导）。
  var result = defaultCapability();
  result.knowledgePointId = canonicalKp.id || '';

  var pushQt = function (typeToken, qtMeta) {
    if (!typeToken) return;
    var std = Registry.normalizeQuestionType(typeToken);
    if (!std.id) return;
    var already = result.questionTypes.some(function (q) { return q.id === std.id; });
    if (already) return;
    var qt = Registry.get(std.id);
    result.questionTypes.push({
      id: std.id,
      cognitiveLevels: (qt && qt.cognitiveLevels) || ['understand'],
      difficultyRange: inferDifficultyRange(canonicalKp, std.id),
      priority: 1,
      supported: true
    });
  };

  // 1) 从 canonical presentation.questionTypes（含 rawType）推导
  (canonicalKp.presentation && canonicalKp.presentation.questionTypes || []).forEach(function (q) {
    pushQt(q.rawType || q.type);
  });

  // 2) 从 canonical generation.capabilities（M1 数据推导）补充
  (canonicalKp.generation && canonicalKp.generation.capabilities || []).forEach(function (cap) {
    if (cap && cap.id && Registry.has(cap.id)) pushQt(cap.id);
  });

  // 若仍为空，则未推导出可用题型；保持空 arrays（不伪造）。
  return result;
}

function inferDifficultyRange(kp, qtypeId) {
  // 根据 max_steps_default / number_range_default / cognitive_level 推断 difficultyRange [min, max]
  var ms = Number(kp.max_steps_default);
  if (!isFinite(ms) || ms < 1) ms = 1;
  var range = kp.number_range_default;
  var min = 1, max = 6; // default grade range

  if (ms > 1) max = Math.min(6, ms);
  if (range && typeof range === 'object' && isFinite(range.min) && isFinite(range.max)) {
    min = Math.max(1, Math.min(6, range.min));
    max = Math.min(6, Math.max(range.min, range.max));
  }
  var cl = kp.cognitive_level;
  if (cl) {
    var clMap = { '了解': 1, '理解': 2, '掌握': 3, '运用': 4 };
    if (clMap[cl] !== undefined) {
      var clNum = clMap[cl];
      if (min > clNum) min = clNum;
      if (max < clNum) max = clNum;
    }
  }
  return [min, max];
}

module.exports = {
  defaultCapability: defaultCapability,
  isValidCapability: isValidCapability,
  resolveCapability: resolveCapability,
  inferDifficultyRange: inferDifficultyRange
};