/**
 * shared/presentation-engine.js — M5-R24 Full Chain Wire-up
 *
 * 统一主链路：
 *   UI
 *    ↓
 *   Strategy
 *    ↓
 *   QuestionPlan
 *    ↓
 *   Generator / LegacyAdapter
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
 *   renderQuestions(questions, options)
 *   checkAnswers(questions, userAnswers, options)
 */
'use strict';

var Selector = require('./generator/generator-selector.js');
var GeneratorContract = require('./generator/generator-contract.js');
var Pipeline = require('./validator/validation-pipeline.js');
var RetryLoop = require('./generator/retry-loop.js');
var BatchValidator = require('./validator/batch-validator.js');
var Quality = require('./validator/quality-scorer.js');
var SQ = require('./semantic-question.js');
var LQA = require('./question/legacy-question-adapter.js');
var LegacyRenderer = require('./question/legacy-renderer-adapter.js');
var FeatureFlags = require('./feature-flags.js');
var Logger = require('./logger.js');
var QID = require('./question-id.js');
var Metrics = require('./metrics.js');

/**
 * 核心生成入口：Plan → Generator → SemanticQuestion → Validator → Retry → Batch → Legacy Questions
 * @param {Object} plan QuestionPlan
 * @param {Object} options { featureFlags, logger, skipValidation, legacyOutput }
 * @returns {Promise<{ questions: LegacyQuestion[], semanticQuestions, validationResults, batchResult, qualitySummary }>}
 */
function generateQuestions(plan, options) {
  options = options || {};
  var ff = options.featureFlags || FeatureFlags;
  var logger = options.logger || Logger;
  var skipValidation = options.skipValidation || !ff.isValidationEnabled();
  var legacyOutput = options.legacyOutput !== false;
  var validatorMode = ff.getValidationMode();

  // P5-R03: 记录生成开始
  Metrics.recordGenerationStart({ generator: plan.generatorId || 'unknown', subject: plan.subject, grade: plan.grade });

  // 1. 选择 Generator
  var selection = Selector.selectGenerator(plan);
  if (!selection.record) {
    Metrics.recordGenerationFailure({ generator: 'none', subject: plan.subject, grade: plan.grade });
    return Promise.reject(new Error('无可用 Generator: ' + plan.knowledgePointId));
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
      maxRetries: ff.getMaxRetries(),
      validatorEnabled: !skipValidation,
      validatorContext: { generatorId: selection.record.id }
    }
  );

  return genPromise.then(function (result) {
    var semanticQuestions = result.questions;
    var retries = result.retries;

    // P5-R03: 记录生成成功/失败、重试指标
    if (result.success) {
      Metrics.recordGenerationSuccess({ generator: selection.record.id, subject: plan.subject, grade: plan.grade });
      Metrics.recordRetryAttempt({ generator: selection.record.id, retries: retries, maxRetries: ff.getMaxRetries(), errorCodes: result.attempts ? result.attempts.flatMap(function (a) { return (a.errors || []).map(function (e) { return e.code; }); }) : [] });
    } else {
      Metrics.recordGenerationFailure({ generator: selection.record.id, subject: plan.subject, grade: plan.grade });
      Metrics.recordRetryAttempt({ generator: selection.record.id, retries: retries, maxRetries: ff.getMaxRetries(), errorCodes: result.attempts ? result.attempts.flatMap(function (a) { return (a.errors || []).map(function (e) { return e.code; }); }) : [] });
    }

    // 4. 批量验证
    var batchResult = { valid: true, errors: [] };
    if (!skipValidation) {
      var valContext = { generatorId: selection.record.id, seed: plan.seed, planId: plan.planId };
      var validationResults = Pipeline.runPipelineBatch(semanticQuestions, valContext);
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

    // 5. 质量评分
    var qualitySummary = { average: 1 };
    if (!skipValidation) {
      var valContext = { generatorId: selection.record.id, seed: plan.seed, planId: plan.planId };
      var validationResults = Pipeline.runPipelineBatch(semanticQuestions, valContext);
      var qScores = Quality.scoreBatch(semanticQuestions, validationResults, {});
      qualitySummary = qScores.summary;
    }

    // 6. 输出格式
    var outputQuestions = legacyOutput
      ? LegacyRenderer.adaptBatchForLegacyRenderer(semanticQuestions)
      : semanticQuestions;

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
      generator: selection.record.id
    };
  });
}

/**
 * 渲染入口：Legacy Questions → HTML/SVG
 * @param {Array<Object>} questions (Legacy Question 格式)
 * @param {Object} options { columns, renderOpts }
 * @returns {string} HTML
 */
function renderQuestions(questions, options) {
  var PU = (typeof global !== 'undefined' && global.PluginUtil) || require('../render.js');
  try {
    var html;
    if (PU && PU.renderGrid) {
      html = PU.renderGrid(questions, options);
    } else {
      html = questions.map(function (q, i) { return PU.renderCard ? PU.renderCard(q, i, options) : ('<div>Q' + (i+1) + ': ' + (q.q||'') + '</div>'); }).join('');
    }
    Metrics.recordRenderResult({ success: true });
    return html;
  } catch (e) {
    Metrics.recordRenderResult({ success: false, errorType: e.name || 'RENDER_ERROR' });
    throw e;
  }
}

/**
 * 判分入口：Legacy Questions + 用户答案 → 结果
 * @param {Array<Object>} questions
 * @param {Object} userAnswers
 * @param {Object} options
 * @returns {Object} { score, total, correct, results }
 */
function checkAnswers(questions, userAnswers, options) {
  var PU = (typeof global !== 'undefined' && global.PluginUtil) || require('../render.js');
  if (PU && PU.defaultCheck) {
    return PU.defaultCheck(questions, userAnswers, options);
  }
  // 兜底简易判分
  var correct = 0;
  var results = [];
  questions.forEach(function (q, i) {
    var ua = userAnswers && userAnswers[i];
    var isCorrect = false;
    if (q.inputType === 'choice') {
      isCorrect = String(ua) === String(q.answer);
    } else if (q.inputType === 'multi') {
      isCorrect = Array.isArray(ua) && Array.isArray(q.answer) && JSON.stringify(ua) === JSON.stringify(q.answer);
    } else {
      isCorrect = String(ua || '').trim() === String(q.answer || '').trim();
    }
    if (isCorrect) correct++;
    results.push({ index: i, correct: isCorrect, userAnswer: ua, expected: q.answer });
  });
  return { score: questions.length ? Math.round(correct / questions.length * 100) : 0, total: questions.length, correct: correct, results: results };
}

/**
 * 一站式：Plan → 生成 → 渲染 → 返回 HTML + 元数据
 * @param {Object} plan
 * @param {Object} options
 * @returns {Promise<{ html, questions, meta }>}
 */
function generateAndRender(plan, options) {
  return generateQuestions(plan, options).then(function (result) {
    var html = renderQuestions(result.questions, options);
    return { html: html, questions: result.questions, meta: { semanticQuestions: result.semanticQuestions, quality: result.qualitySummary, validation: result.batchResult } };
  });
}

module.exports = {
  generateQuestions: generateQuestions,
  renderQuestions: renderQuestions,
  checkAnswers: checkAnswers,
  generateAndRender: generateAndRender
};