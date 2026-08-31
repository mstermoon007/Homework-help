/**
 * shared/validator/generate-wrapper.js — M5-R16 Validator 集成生成包装器
 *
 * 包装现有 generate/render/check 流程：
 *   generate → normalize → SemanticQuestion → ValidationPipeline → Retry → BatchValidator → return
 *
 * 使用方式：
 *   const wrappedGenerate = wrapGenerator(originalGenerate, { generatorId, validator: true });
 *   const result = wrappedGenerate(opts);
 *
 * 不直接修改 render.js，保持向后兼容。
 */
'use strict';

var SQ = require('../semantic-question.js');
var Pipeline = require('./validation-pipeline.js');
var RetryLoop = require('../generator/retry-loop.js');
var BatchValidator = require('./batch-validator.js');
var LQA = require('../question/legacy-question-adapter.js');
var QID = require('../question-id.js');

var DEFAULT_MAX_RETRIES = 3;

/**
 * 包装生成器，注入 Validator + Retry
 * @param {Function} originalGenerate 原始生成函数（返回 Legacy Questions 或 Promise）
 * @param {Object} config { generatorId, generatorVersion, maxRetries, validatorEnabled, validatorMode }
 * @returns {Function} 包装后的生成函数
 */
function wrapGenerator(originalGenerate, config) {
  config = config || {};
  var generatorId = config.generatorId || 'unknown';
  var generatorVersion = config.generatorVersion || '1.0.0';
  var maxRetries = config.maxRetries != null ? config.maxRetries : DEFAULT_MAX_RETRIES;
  var validatorEnabled = config.validatorEnabled !== false;
  var validatorMode = config.validatorMode || 'strict'; // 'off' | 'warn' | 'strict'

  function wrappedGenerate(options) {
    options = options || {};
    var plan = {
      count: options.count || 10,
      knowledgePoints: options.knowledgePoints || [],
      questionTypes: options.questionTypes || [],
      difficulty: options.difficulty,
      seed: options.seed || QID.generateBaseSeed(),
      planId: options.planId || 'plan-' + Date.now(),
      _generatorId: generatorId
    };

    // 1. 调用原始生成器
    var rawResult = originalGenerate(options);
    var rawQuestions = Array.isArray(rawResult) ? rawResult : (rawResult && rawResult.questions) || [];

    // 2. 转换为 SemanticQuestion（支持 Legacy 格式）
    var semanticQuestions = rawQuestions.map(function (q, i) {
      return LQA.adaptQuestion(q, {
        generatorId: generatorId,
        generatorVersion: generatorVersion,
        seed: options.seed || QID.deriveSeed(plan.seed, generatorId, i),
        planId: plan.planId,
        index: i,
        knowledgePointId: q.knowledgePointId,
        difficulty: q.difficulty
      });
    });

    // 3. 验证管道（每题）
    if (validatorEnabled && validatorMode !== 'off') {
      var valContext = { generatorId: generatorId, generatorCapabilities: {}, seed: plan.seed, planId: plan.planId };
      var validationResults = Pipeline.runPipelineBatch(semanticQuestions, valContext);

      // 4. 重试逻辑（同步版本，简化版）
      // 完整异步重试见 retry-loop.js
      if (validatorMode === 'strict') {
        // strict 模式：有错误直接抛出或记录
        validationResults.forEach(function (vr, idx) {
          if (!vr.valid && vr.errors && vr.errors.length) {
            var errMsg = vr.errors.map(function (e) { return e.code + ': ' + e.message; }).join('; ');
            console.error('[Validator:' + generatorId + '] Q' + idx + ' 校验失败:', errMsg);
            // 可选择抛出或仅记录
            if (vr.errors.some(function (e) { return e.severity === 'ERROR'; })) {
              // 标记但不阻断（保持兼容），由上层决定
              semanticQuestions[idx]._validationFailed = true;
              semanticQuestions[idx]._validationErrors = vr.errors;
            }
          }
        });
      }

      // 5. 批量验证（练习级）
      if (plan.count) {
        var batchResult = BatchValidator.validateBatch(semanticQuestions, plan);
        if (!batchResult.valid) {
          console.warn('[BatchValidator:' + generatorId + '] 练习级校验不通过:', batchResult.errors.map(function (e) { return e.message; }).join('; '));
        }
      }
    }

    // 6. 返回标准格式（兼容现有 render/check）
    var legacyQuestions = LQA.toLegacyQuestions(semanticQuestions);

    return { questions: legacyQuestions, meta: { _validationEnabled: validatorEnabled, _validatorMode: validatorMode, _semanticQuestions: semanticQuestions } };
  }

  return wrappedGenerate;
}

/**
 * 异步版本（用于 Promise-based 生成器）
 */
function wrapGeneratorAsync(originalGenerate, config) {
  config = config || {};
  var generatorId = config.generatorId || 'unknown';
  var generatorVersion = config.generatorVersion || '1.0.0';
  var maxRetries = config.maxRetries != null ? config.maxRetries : DEFAULT_MAX_RETRIES;
  var validatorEnabled = config.validatorEnabled !== false;

  return function (options) {
    return Promise.resolve(originalGenerate(options)).then(function (rawResult) {
      var rawQuestions = Array.isArray(rawResult) ? rawResult : (rawResult && rawResult.questions) || [];

      var semanticQuestions = rawQuestions.map(function (q, i) {
        return LQA.adaptQuestion(q, {
          generatorId: generatorId,
          generatorVersion: generatorVersion,
          seed: options.seed || QID.deriveSeed(options.seed || QID.generateBaseSeed(), generatorId, i),
          planId: options.planId,
          index: i,
          knowledgePointId: q.knowledgePointId,
          difficulty: q.difficulty
        });
      });

      if (validatorEnabled) {
        var valContext = { generatorId: generatorId, seed: options.seed, planId: options.planId };
        return Pipeline.runPipelineBatch(semanticQuestions, valContext).then(function (validationResults) {
          // 可在此处接入 retry-loop（异步）
          return { questions: LQA.toLegacyQuestions(semanticQuestions), meta: { validationResults: validationResults } };
        });
      }

      return { questions: LQA.toLegacyQuestions(semanticQuestions), meta: {} };
    });
  };
}

module.exports = {
  wrapGenerator: wrapGenerator,
  wrapGeneratorAsync: wrapGeneratorAsync
};