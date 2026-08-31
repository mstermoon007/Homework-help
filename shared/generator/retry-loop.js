/**
 * shared/generator/retry-loop.js — M5-R14 Generation Retry Loop
 *
 * 生成失败自动重试：
 *   - maxRetries = 3
 *   - 可重试错误：ANSWER_MISMATCH, DUPLICATE, DIFFICULTY_MISMATCH, GRAPHIC_INVALID 等
 *   - 不可重试错误：SCHEMA_INVALID, KP_MISSING, KP_MISMATCH, GENERATOR_NOT_FOUND 等
 *   - 超过重试次数返回明确失败信息
 */
'use strict';

var Validator = require('../validator/question-validator.js');
var Pipeline = require('../validator/validation-pipeline.js');
var QID = require('../question-id.js');

var DEFAULT_MAX_RETRIES = 3;
var RETRYABLE_CODES = [
  Validator.ERROR_CODES.ANSWER_MISMATCH,
  Validator.ERROR_CODES.DUPLICATE_QUESTION,
  Validator.ERROR_CODES.DIFFICULTY_MISMATCH,
  Validator.ERROR_CODES.GRAPHIC_INVALID,
  Validator.ERROR_CODES.DISTRACTOR_DUPLICATE,
  Validator.ERROR_CODES.DISTRACTOR_EQUALS_ANSWER,
  Validator.ERROR_CODES.DISTRACTOR_OUT_OF_DOMAIN,
  Validator.ERROR_CODES.STRUCTURE_INVALID,
  Validator.ERROR_CODES.STEPS_EXCEED,
  Validator.ERROR_CODES.OPERATIONS_VIOLATION
];
var FATAL_CODES = [
  Validator.ERROR_CODES.SCHEMA_INVALID,
  Validator.ERROR_CODES.REQUIRED_FIELD_MISSING,
  Validator.ERROR_CODES.KP_MISSING,
  Validator.ERROR_CODES.KP_MISMATCH,
  Validator.ERROR_CODES.GENERATOR_NOT_FOUND
];

function isRetryable(errors) {
  if (!errors || !errors.length) return false;
  return errors.some(function (e) { return RETRYABLE_CODES.indexOf(e.code) !== -1; });
}

function isFatal(errors) {
  if (!errors || !errors.length) return false;
  return errors.some(function (e) { return FATAL_CODES.indexOf(e.code) !== -1; });
}

function hasFatal(errors) {
  return isFatal(errors);
}

function hasRetryable(errors) {
  return isRetryable(errors);
}

/**
 * 带重试的生成执行器
 * @param {Function} generatorFn 签名: (plan, context) → Promise<SemanticQuestion[]> 或 SemanticQuestion[]
 * @param {Object} plan QuestionPlan
 * @param {Object} context { maxRetries, generatorId, generatorVersion, seed, validatorContext }
 * @returns {Promise<{ questions, validationResults, retries, success }>}
 */
function generateWithRetry(generatorFn, plan, context) {
  context = context || {};
  var maxRetries = context.maxRetries != null ? context.maxRetries : DEFAULT_MAX_RETRIES;
  var generatorId = context.generatorId || 'unknown';
  var generatorVersion = context.generatorVersion || '1.0.0';
  var baseSeed = context.seed || QID.generateBaseSeed();
  var validatorContext = context.validatorContext || {};

  var retries = 0;
  var allResults = [];
  var lastQuestions = null;
  var lastValidation = null;

  function attempt(attemptIndex, seed) {
    var attemptContext = Object.assign({}, plan, { seed: seed, _retryAttempt: attemptIndex });
    // 兼容同步/异步 generator：契约允许 generatorFn 直接返回数组（见 JSDoc），统一归一化为 Promise
    return Promise.resolve(generatorFn(attemptContext)).then(function (questions) {
      if (!Array.isArray(questions)) questions = questions.questions || [];
      // 标准化为 SemanticQuestion
      questions = questions.map(function (q, i) {
        return require('../semantic-question.js').normalizeSemanticQuestion(Object.assign({}, q, {
          generator: generatorId,
          generatorVersion: generatorVersion,
          seed: seed,
          index: i,
          _retryAttempt: attemptIndex
        }));
      });

      // 运行验证管道
      var valContext = Object.assign({}, validatorContext, { generatorId: generatorId, seed: seed, planId: plan.planId });
      var validationResults = Pipeline.runPipelineBatch(questions, valContext);

      var allValid = validationResults.every(function (r) { return r.valid; });
      var allErrors = validationResults.flatMap(function (r) { return r.errors || []; });

      return { questions: questions, validationResults: validationResults, allValid: allValid, allErrors: allErrors, seed: seed };
    });
  }

  // 首次尝试
  var currentSeed = baseSeed;
  return attempt(0, currentSeed).then(function loop(result) {
    allResults.push({
      attempt: retries,
      seed: result.seed,
      valid: result.allValid,
      errors: result.allErrors,
      questionCount: result.questions.length
    });

    if (result.allValid) {
      // 成功
      return {
        questions: result.questions,
        validationResults: result.validationResults,
        retries: retries,
        success: true,
        attempts: allResults
      };
    }

    // 检查是否有致命错误
    if (hasFatal(result.allErrors)) {
      return {
        questions: result.questions,
        validationResults: result.validationResults,
        retries: retries,
        success: false,
        error: 'FATAL_ERROR',
        message: '遇到不可恢复错误，停止重试',
        attempts: allResults
      };
    }

    // 检查是否有可重试错误
    if (!hasRetryable(result.allErrors)) {
      return {
        questions: result.questions,
        validationResults: result.validationResults,
        retries: retries,
        success: false,
        error: 'NON_RETRYABLE',
        message: '错误不可重试，停止重试',
        attempts: allResults
      };
    }

    // 重试
    retries++;
    if (retries > maxRetries) {
      return {
        questions: result.questions,
        validationResults: result.validationResults,
        retries: retries,
        success: false,
        error: 'MAX_RETRIES_EXCEEDED',
        message: '超过最大重试次数 (' + maxRetries + ')',
        attempts: allResults
      };
    }

    // 派生新 seed 重试
    currentSeed = QID.deriveSeed(baseSeed, generatorId, retries);
    return attempt(retries, currentSeed).then(loop);
  });
}

/**
 * 同步版本（用于同步生成器）
 */
function generateWithRetrySync(generatorFn, plan, context) {
  context = context || {};
  var maxRetries = context.maxRetries != null ? context.maxRetries : DEFAULT_MAX_RETRIES;
  var generatorId = context.generatorId || 'unknown';
  var generatorVersion = context.generatorVersion || '1.0.0';
  var baseSeed = context.seed || QID.generateBaseSeed();
  var validatorContext = context.validatorContext || {};

  var retries = 0;
  var allResults = [];
  var currentSeed = baseSeed;

  while (true) {
    var attemptContext = Object.assign({}, plan, { seed: currentSeed, _retryAttempt: retries });
    var questions = generatorFn(attemptContext);
    if (!Array.isArray(questions)) questions = questions.questions || [];

    questions = questions.map(function (q, i) {
      return require('../semantic-question.js').normalizeSemanticQuestion(Object.assign({}, q, {
        generator: generatorId,
        generatorVersion: generatorVersion,
        seed: currentSeed,
        index: i,
        _retryAttempt: retries
      }));
    });

    var valContext = Object.assign({}, validatorContext, { generatorId: generatorId, seed: currentSeed, planId: plan.planId });
    var validationResults = Pipeline.runPipelineBatch(questions, valContext);

    var allValid = validationResults.every(function (r) { return r.valid; });
    var allErrors = validationResults.flatMap(function (r) { return r.errors || []; });

    allResults.push({
      attempt: retries,
      seed: currentSeed,
      valid: allValid,
      errors: allErrors,
      questionCount: questions.length
    });

    if (allValid) {
      return {
        questions: questions,
        validationResults: validationResults,
        retries: retries,
        success: true,
        attempts: allResults
      };
    }

    if (hasFatal(allErrors)) {
      return {
        questions: questions,
        validationResults: validationResults,
        retries: retries,
        success: false,
        error: 'FATAL_ERROR',
        message: '遇到不可恢复错误，停止重试',
        attempts: allResults
      };
    }

    if (!hasRetryable(allErrors)) {
      return {
        questions: questions,
        validationResults: validationResults,
        retries: retries,
        success: false,
        error: 'NON_RETRYABLE',
        message: '错误不可重试，停止重试',
        attempts: allResults
      };
    }

    retries++;
    if (retries > maxRetries) {
      return {
        questions: questions,
        validationResults: validationResults,
        retries: retries,
        success: false,
        error: 'MAX_RETRIES_EXCEEDED',
        message: '超过最大重试次数 (' + maxRetries + ')',
        attempts: allResults
      };
    }

    currentSeed = QID.deriveSeed(baseSeed, generatorId, retries);
  }
}

module.exports = {
  generateWithRetry: generateWithRetry,
  generateWithRetrySync: generateWithRetrySync,
  DEFAULT_MAX_RETRIES: DEFAULT_MAX_RETRIES,
  RETRYABLE_CODES: RETRYABLE_CODES,
  FATAL_CODES: FATAL_CODES,
  isRetryable: isRetryable,
  isFatal: isFatal
};