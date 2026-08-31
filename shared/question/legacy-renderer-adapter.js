/**
 * shared/question/legacy-renderer-adapter.js — M5-R23 Legacy Renderer 兼容
 *
 * 反向适配：SemanticQuestion → Legacy Question（含 render/check/svg）
 * 保证旧渲染器（PluginUtil.renderCard / defaultQCheck / svg）继续工作。
 *
 * 流程：
 *   Legacy Question
 *        ↓
 *   SemanticQuestion (Validator)
 *        ↓
 *   LegacyRendererAdapter.toLegacyQuestion()
 *        ↓
 *   Legacy Question (render/check/svg)
 *        ↓
 *   旧渲染链路
 */
'use strict';

var LQA = require('./legacy-question-adapter.js');
var SQ = require('../semantic-question.js');

/**
 * 批量转换：SemanticQuestion[] → Legacy Question[]（供旧渲染器）
 * @param {Array<Object>} semanticQuestions
 * @returns {Array<Object>}
 */
function toLegacyQuestions(semanticQuestions) {
  if (!Array.isArray(semanticQuestions)) return [];
  return semanticQuestions.map(function (sq) {
    return LQA.toLegacyQuestion(sq);
  });
}

/**
 * 单题转换
 * @param {Object} sq
 * @returns {Object}
 */
function toLegacyQuestion(sq) {
  return LQA.toLegacyQuestion(sq);
}

/**
 * 包装器：接收 SemanticQuestion，输出带 render/check 的 Legacy Question
 * 用于：PresentationEngine → LegacyRenderer
 * @param {Object} sq
 * @returns {Object} Legacy Question with render/check
 */
function adaptForLegacyRenderer(sq) {
  var legacy = LQA.toLegacyQuestion(sq);

  // 确保 render 函数可用（复用 PluginUtil.renderCard）
  if (!legacy.render && typeof global !== 'undefined' && global.PluginUtil && global.PluginUtil.renderCard) {
    legacy.render = function (idx) { return global.PluginUtil.renderCard(legacy, idx, {}); };
  }

  // 确保 check 函数可用（复用 defaultQCheck）
  if (!legacy.check && typeof global !== 'undefined' && global.PluginUtil && global.PluginUtil.defaultQCheck) {
    legacy.check = function (answers, idx) { return global.PluginUtil.defaultQCheck(legacy, answers, idx); };
  }

  return legacy;
}

/**
 * 批量适配
 */
function adaptBatchForLegacyRenderer(semanticQuestions) {
  return semanticQuestions.map(adaptForLegacyRenderer);
}

/**
 * 反向：Legacy Question → SemanticQuestion → Validator → Legacy Question
 * 完整闭环：旧题目 → 标准化 → 校验 → 回旧格式渲染
 * @param {Object} legacyQ
 * @param {Object} context { validatorEnabled, generatorId }
 * @returns {Promise<Object>} Legacy Question (已校验/可能重试)
 */
function validateAndAdaptLegacy(legacyQ, context) {
  context = context || {};

  // 1. Legacy → Semantic
  var sq = LQA.adaptQuestion(legacyQ, context);

  // 2. Validator (可选)
  if (context.validatorEnabled !== false) {
    var Pipeline = require('../validator/validation-pipeline.js');
    var vr = Pipeline.runPipeline(sq, { generatorId: context.generatorId });
    if (!vr.valid && context.validatorMode === 'strict') {
      throw new Error('Legacy Question 验证失败: ' + vr.errors.map(function (e) { return e.message; }).join('; '));
    }
    sq._validationResult = vr;
  }

  // 3. Semantic → Legacy (带 render/check)
  return adaptForLegacyRenderer(sq);
}

module.exports = {
  toLegacyQuestions: toLegacyQuestions,
  toLegacyQuestion: toLegacyQuestion,
  adaptForLegacyRenderer: adaptForLegacyRenderer,
  adaptBatchForLegacyRenderer: adaptBatchForLegacyRenderer,
  validateAndAdaptLegacy: validateAndAdaptLegacy
};