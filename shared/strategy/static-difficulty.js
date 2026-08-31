/**
 * shared/strategy/static-difficulty.js — M3-08 Static Difficulty 接入层
 *
 * 接入现有静态多维难度引擎 DifficultyStatic.paramsForKnowledgePoint(...)，
 * 禁止重新实现 7 维难度公式（G/S/C/T/St/N/A 合成与权重一律由 difficulty-static.js 负责）。
 *
 * 输入：
 *   knowledgePoint  — Canonical KnowledgePoint（StrategyResolver 产出）
 *   questionType    — 标准 questionTypeId
 *   customParams    — 自定义覆盖（scale/steps 等生成参数）
 *
 * 适配：引擎期望 legacy 元数据字段（difficulty / spiral_level / cognitive_level /
 * number_range_default / max_steps_default / context_default / applicable_question_types），
 * 本层将 Canonical KP 映射为该形状（toEngineMeta），不改动引擎内部公式。
 *
 * 输出：
 *   { level, scale, steps, allowBracket, allowMultDiv, staticMeta }
 */
'use strict';

var DifficultyStatic = require('../difficulty-static.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

/**
 * Canonical KnowledgePoint → 引擎期望的 legacy 元数据形状。
 * 纯字段映射；缺失字段回落到引擎缺省语义（difficulty 3 / cognitive 掌握 / standard 情境）。
 */
function toEngineMeta(kp) {
  var meta = {};
  meta.difficulty = (kp.legacy && typeof kp.legacy.difficulty === 'number')
    ? kp.legacy.difficulty : 3;
  meta.spiral_level = (kp.spiral && typeof kp.spiral.level === 'number')
    ? kp.spiral.level : 1;
  meta.max_spiral_level = (kp.spiral && typeof kp.spiral.maxLevel === 'number')
    ? kp.spiral.maxLevel : 1;
  meta.cognitive_level = (kp.cognition && kp.cognition.raw) ||
    (kp.legacy && kp.legacy.cognitive_level) || null;
  meta.max_steps_default = (kp.structure && typeof kp.structure.maxSteps === 'number')
    ? kp.structure.maxSteps : 1;
  meta.number_range_default = (kp.numeric && kp.numeric.range) || null;
  meta.context_default = (kp.context && kp.context.defaults && kp.context.defaults[0]) || null;
  meta.applicable_question_types = ((kp.presentation && kp.presentation.questionTypes) || []).map(function (q) {
    return { type: q.type || q.rawType, coefficient: q.weight != null ? q.weight : 1 };
  });
  return meta;
}

function resolveStaticDifficulty(knowledgePoint, questionType, customParams) {
  if (!knowledgePoint || typeof knowledgePoint !== 'object') {
    throw new StrategyError('KnowledgePoint 不能为空', CODES.INVALID_REQUEST);
  }

  // 7 维难度公式唯一入口：difficulty-static.js
  var profile = DifficultyStatic.paramsForKnowledgePoint(
    toEngineMeta(knowledgePoint), questionType, customParams);

  return {
    level: profile.level,
    scale: profile.scale,
    steps: profile.steps,
    allowBracket: !!profile.allowBracket,
    allowMultDiv: !!profile.allowMultDiv,
    staticMeta: profile.staticMeta
  };
}

module.exports = {
  toEngineMeta: toEngineMeta,
  resolveStaticDifficulty: resolveStaticDifficulty
};
