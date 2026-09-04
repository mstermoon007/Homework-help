/**
 * shared/presentation-engine.js — M5-R24 Full Chain Wire-up (P5 Task 5.2 更新渲染层适配)
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
 *
 * 渲染层适配：
 *   - 生成核心仅输出 SemanticQuestion[]
 *   - 如需 Legacy Question 格式，由渲染层自行转换（LegacyAdapter.toLegacyQuestions）
 *   - SVG 统一经 LegacySvgAdapter 适配至 graphic 描述符
 */
'use strict';

var Selector = require('./generator/generator-selector.js');
var GeneratorContract = require('./generator/generator-contract.js');
var Pipeline = require('./validator/validation-pipeline.js');
var RetryLoop = require('./generator/retry-loop.js');
var BatchValidator = require('./validator/batch-validator.js');
var Quality = require('./validator/quality-scorer.js');
var SQ = require('./semantic-question.js');
var LegacyAdapter = require('./generator/legacy-adapter.js');
var FeatureFlags = require('./feature-flags.js');
var Logger = require('./logger.js');
var QID = require('./question-id.js');
var Metrics = require('./metrics.js');

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
      validatorContext: { generatorId: selection.record.id, seenKeys: options.seenKeys || null }
    }
  );

  return genPromise.then(function (result) {
    var semanticQuestions = result.questions;

    // P0-004 校验 gate 输出（Bug-Fix）：重试耗尽/致命/不可重试错误时，禁止把
    // 完全不可用（无任何题目）的成果静默交付 UI——向上抛错 → runPlans 记入 failedPlans。
    // 注意：仅拦截「零可用输出」；单个软校验告警（如 graphic 类型告警，见 R28-3 回归）
    // 且仍产出可用题目的计划应照常交付，避免生成整轮被误杀（若需严格拦截硬失败，
    // 由后续校验增强单独收敛，不在此扩大语义）。
    if (!result.success && (!semanticQuestions || semanticQuestions.length === 0)) {
      var err = new Error(((result.error || 'GENERATION_FAILED') + (result.message ? ': ' + result.message : '')));
      err.generationFailed = true;
      err.planKey = plan.planId || plan.knowledgePointId || null;
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

    // 4. 批量验证
    var batchResult = { valid: true, errors: [] };
    var validationResults = [];
    if (!skipValidation) {
      var valContext = { generatorId: selection.record.id, seed: plan.seed, planId: plan.planId, seenKeys: options.seenKeys || null };
      validationResults = Pipeline.runPipelineBatch(semanticQuestions, valContext);
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
      generator: selection.record.id
    };
  });
}

/**
 * 渲染入口：SemanticQuestion[] 或 Legacy Questions → HTML/SVG
 * 内部自动将 SemanticQuestion 转换为 Legacy Question（含 render/check/svg）
 * @param {Array<Object>} questions (SemanticQuestion[] 或 Legacy Question[])
 * @param {Object} options { columns, renderOpts }
 * @returns {string} HTML
 */
function renderQuestions(questions, options) {
  if (!Array.isArray(questions) || !questions.length) return '';
  // 判断是否为 SemanticQuestion（有 metadata/generator 字段）
  var isSemantic = questions[0] && questions[0].metadata && questions[0].metadata.generator;
  var legacyQuestions = isSemantic
    ? LegacyAdapter.toLegacyQuestions(questions)
    : questions;

  var PU = (typeof global !== 'undefined' && global.PluginUtil) || require('./render.js');
  try {
    var html;
    if (PU && PU.renderGrid) {
      html = PU.renderGrid(legacyQuestions, options);
    } else {
      html = legacyQuestions.map(function (q, i) { return PU.renderCard ? PU.renderCard(q, i, options) : ('<div>Q' + (i+1) + ': ' + (q.q||'') + '</div>'); }).join('');
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
  var PU = (typeof global !== 'undefined' && global.PluginUtil) || require('./render.js');
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
  generateAndRender: generateAndRender,
  LegacyAdapter: LegacyAdapter
};

// 浏览器全局挂载
if (typeof window !== 'undefined') window.PresentationEngine = module.exports;
if (typeof global !== 'undefined') global.PresentationEngine = module.exports;