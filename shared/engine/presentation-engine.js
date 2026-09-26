/**
 * shared/engine/presentation-engine.js — M5-R24 Full Chain Wire-up (P5 Task 5.2 更新渲染层适配)
 *
 * 统一主链路：
 *   UI
 *    ↓
 *   Strategy
 *    ↓
 *   QuestionPlan
 *    ↓
 *   Generator
 *    ↓
 *   SemanticQuestion
 *    ↓
 *   ValidationPipeline
 *    ↓
 *   Retry Loop
 *    ↓
 *   BatchValidator
 *    ↓
 *   PresentationEngine (HTML/SVG/Print 输出)
 *
 * 入口函数：
 *   generateQuestions(plan, options)
 *   （P28-22 已删除无调用方导出 renderQuestions / checkAnswers / generateAndRender：
 *     渲染唯一链为 PresentationRenderer.renderAll → HTMLRenderer → RenderResult，
 *     批改唯一入口为 PluginUtil.computeResult / defaultQCheck。）
 *
 * 渲染层适配：
 *   - 生成核心仅输出 SemanticQuestion[]
 *   - 渲染/批改所需题格式由 render-format.js 转换（toRenderableQuestions）
 *   - SVG 经 GraphicRenderer/graphic 描述符渲染
 */
'use strict';

var Selector = require('../generator/generator-selector.js');
var RetryLoop = require('../generator/retry-loop.js');
var BatchValidator = require('../validator/batch-validator.js');
var Quality = require('../validator/quality-scorer.js');
var SQ = require('../semantic/semantic-question.js');
var RenderFormat = require('../presentation/render-format.js');
var FeatureFlags = require('../catalog/feature-flags.js');
var Logger = require('../state/logger.js');
var Metrics = require('../state/metrics.js');

/**
 * 核心生成入口：Plan → Generator → SemanticQuestion → Validator → Retry → Batch
 * @param {Object} plan QuestionPlan
 * @param {Object} options { featureFlags, logger, skipValidation }
 * @returns {Promise<{ questions: SemanticQuestion[], semanticQuestions, validationResults, batchResult, qualitySummary }>}
 */
function generateQuestions(plan, options) {
  options = options || {};
  var ff = options.featureFlags || FeatureFlags;
  var logger = options.logger || Logger;
  var skipValidation = options.skipValidation || !ff.isValidationEnabled();
  var validatorMode = ff.getValidationMode();

  // P5-R03: 记录生成开始
  Metrics.recordGenerationStart({ generator: plan.generatorId || 'unknown', subject: plan.subject, grade: plan.grade });

  // Refactor Step 2：QuestionPlan KP 数组唯一语义（边界兼容旧单数）
  var primaryKp = (Array.isArray(plan && plan.knowledgePointIds) && plan.knowledgePointIds[0]) ||
    (plan && typeof plan.knowledgePointId === 'string' ? plan.knowledgePointId : null);

  // 1. 选择 Generator
  var selection = Selector.selectGenerator(plan);
  if (!selection.record) {
    Metrics.recordGenerationFailure({ generator: 'none', subject: plan.subject, grade: plan.grade });
    return Promise.reject(new Error('无可用 Generator: ' + primaryKp));
  }

  // 2. 实例化 Generator
  var generator = Selector.instantiate(selection, selection.plugin);
  if (!generator) {
    Metrics.recordGenerationFailure({ generator: selection.record.id, subject: plan.subject, grade: plan.grade });
    return Promise.reject(new Error('Generator 实例化失败: ' + selection.record.id));
  }

  // 3. 生成 + 验证 + 重试
  var genPromise = RetryLoop.generateWithRetry(
    function (p) { return generator.generate(p); },
    plan,
    {
      generatorId: selection.record.id,
      generatorVersion: selection.record.version || '1.0.0',
      // FINAL-13：Plan 显式 seed 透传给 RetryLoop（固定 seed → 可复现）；
      // 未携带时为 undefined，RetryLoop 回退 auto seed（生产 UI 行为不变）。
      seed: plan.seed != null ? plan.seed : undefined,
      maxRetries: ff.getMaxRetries(),
      validatorEnabled: !skipValidation,
      validatorContext: { generatorId: selection.record.id, seenKeys: options.seenKeys || null, mathSeenKeys: options.mathSeenKeys || null }
    }
  );

  return genPromise.then(function (result) {
    var semanticQuestions = result.questions;

    // P0-004 校验 gate 输出（Bug-Fix）：重试耗尽/致命/不可重试错误时，禁止把
    // 完全不可用（无任何题目）的成果静默交付 UI——向上抛错 → runPlans 记入 failedPlans。
    // R1：GENERATION_SPACE_EXHAUSTED（跨代/批内去重后语义空间饱和）且仍产出部分有效题时，
    // 改为可交付 PARTIAL（不整批归零）；仅当「无任何题目」或存在真实生成/校验错误时才失败。
    // 真实错误码（FATAL_ERROR / NON_RETRYABLE / MAX_RETRIES_EXCEEDED）仍显式失败。
    // 注意：其他软校验失败且仍产出可用题目的计划照常交付（保持 R28-3 以来的既有语义）。
    // FINAL-142：GENERATION_SPACE_EXHAUSTED 即使 0 题也不抛错——语义空间饱和是
    // Generator 能力上限的如实表达，应返回空数组 + PARTIAL，由编排层按容量记账，
    // 而非整批 FAILED（生产 count≤20 不可达，但容量扫描 count=128 可触发）。
    var isRealError = result.error && result.error !== 'GENERATION_SPACE_EXHAUSTED';
    if (!result.success && isRealError) {
      var err = new Error(((result.error || 'GENERATION_FAILED') + (result.message ? ': ' + result.message : '')));
      err.generationFailed = true;
      err.generationError = result.error || null;
      err.planKey = plan.planId || primaryKp || null;
      throw err;
    }

    var retries = result.retries;

    // P5-R03: 记录生成成功/失败、重试指标
    if (result.success) {
      Metrics.recordGenerationSuccess({ generator: selection.record.id, subject: plan.subject, grade: plan.grade });
      Metrics.recordRetryAttempt({ generator: selection.record.id, retries: retries, maxRetries: ff.getMaxRetries(), errorCodes: result.attempts ? result.attempts.flatMap(function (a) { return (a.errors || []).map(function (e) { return e.code; }); }) : [] });
    } else {
      Metrics.recordGenerationFailure({ generator: selection.record.id, subject: plan.subject, grade: plan.grade });
      Metrics.recordRetryAttempt({ generator: selection.record.id, retries: retries, maxRetries: ff.getMaxRetries(), errorCodes: result.attempts ? result.attempts.flatMap(function (a) { return (a.errors || []).map(function (e) { return e.code; }); }) : [] });
    }

    // 4. 批量验证（逐题验证已在 RetryLoop 内完成，复用 finalValidation，避免整批二次验证）
    var batchResult = { valid: true, errors: [] };
    var validationResults = skipValidation ? [] : (result.validationResults || []);
    if (!skipValidation) {
      batchResult = BatchValidator.validateBatch(semanticQuestions, plan);

      // P5-R03: 记录验证指标
      validationResults.forEach(function (vr) {
        Metrics.recordValidationResult({ valid: vr.valid, generator: selection.record.id, subject: plan.subject, errors: vr.errors });
      });

      // 记录日志
      logger.logBatchValidation({
        planId: plan.planId,
        total: semanticQuestions.length,
        passed: validationResults.filter(function (r) { return r.valid; }).length,
        passRate: validationResults.filter(function (r) { return r.valid; }).length / semanticQuestions.length,
        errorSummary: validationResults.flatMap(function (r) { return r.errors || []; }).reduce(function (acc, e) { acc[e.code] = (acc[e.code] || 0) + 1; return acc; }, {}),
        qualityAvg: 0 // 稍后计算
      });

      // 记录重复率（来自 BatchValidator）
      if (batchResult.duplicateRate != null) {
        Metrics.recordDuplicateCheck({ totalQuestions: semanticQuestions.length, duplicatesFound: Math.round(semanticQuestions.length * (batchResult.duplicateRate || 0)), generator: selection.record.id });
      }
    }

    // 5. 质量评分（复用第 4 步的 validationResults，避免重复验证同一批题目）
    var qualitySummary = { average: 1 };
    if (!skipValidation) {
      var qScores = Quality.scoreBatch(semanticQuestions, validationResults, {});
      qualitySummary = qScores.summary;
    }

    // 6. 输出格式：仅输出 SemanticQuestion[]；如需 Legacy Question 由渲染层转换
    var outputQuestions = semanticQuestions;

    // 记录每题日志
    semanticQuestions.forEach(function (sq, i) {
      logger.logQuestionValidation({
        questionId: sq.id,
        knowledgePointId: sq.knowledgePoint,
        generator: selection.record.id,
        generatorVersion: selection.record.version || '1.0.0',
        seed: sq.metadata && sq.metadata.seed,
        retryCount: retries,
        validationResult: batchResult.valid ? 'pass' : 'fail',
        errorCodes: [],
        score: 0,
        planId: plan.planId,
        questionType: sq.questionType,
        difficulty: sq.difficulty
      });
    });

    return {
      questions: outputQuestions,
      semanticQuestions: semanticQuestions,
      validationResults: skipValidation ? [] : (result.validationResults || []),
      batchResult: batchResult,
      qualitySummary: qualitySummary,
      retries: retries,
      status: result.status || (result.success ? 'SUCCESS' : 'FAILED'),
      generator: selection.record.id
    };
  });
}

/**
 * P28-22：renderQuestions / checkAnswers / generateAndRender 已删除（均无生产调用；
 * 原 renderQuestions 经 PluginUtil.renderGrid/renderCard —— 随 shared/presentation/render.js 一并删除）。
 * 渲染唯一链：PresentationRenderer.renderAll → HTMLRenderer → RenderResult（见 shared/presentation/renderer.js）；
 * 判分唯一入口：PluginUtil.computeResult / defaultQCheck（shared/core/check.js）。
 */

module.exports = {
  generateQuestions: generateQuestions,
  RenderFormat: RenderFormat
};

// 浏览器全局挂载
if (typeof window !== 'undefined') window.PresentationEngine = module.exports;
if (typeof global !== 'undefined') global.PresentationEngine = module.exports;