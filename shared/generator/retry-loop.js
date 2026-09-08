/**
 * shared/generator/retry-loop.js — M5-R14 Generation Retry Loop
 *
 * 生成失败自动重试：
 *   - maxRetries = 3
 *   - 可重试错误：ANSWER_MISMATCH, DUPLICATE, DIFFICULTY_MISMATCH, GRAPHIC_INVALID 等
 *   - 不可重试错误：SCHEMA_INVALID, KP_MISSING, KP_MISMATCH, GENERATOR_NOT_FOUND 等
 *   - 超过重试次数返回明确失败信息
 *
 * 统一 async (P3 Task 1.2)：已移除 generateWithRetrySync。
 */
'use strict';

var Validator = require('../validator/question-validator.js');
var Pipeline = require('../validator/validation-pipeline.js');
var QID = require('../question-id.js');

var DEFAULT_MAX_RETRIES = 3;

// 空间耗尽信号：重试全部因「重复」而失败 → 说明该 KP+type+difficulty 语义空间的
// 可见题量已不足（去重后剩余空间太小），继续重试无意义。
var GENERATION_SPACE_EXHAUSTED = 'GENERATION_SPACE_EXHAUSTED';
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
  Validator.ERROR_CODES.OPERATIONS_VIOLATION,
  // P0-06 Step 29: KP 语义验证失败可重试（仅重新 Generator，不重新 Strategy）
  Validator.ERROR_CODES.KP_SEMANTIC_IDENTITY,
  Validator.ERROR_CODES.KP_SEMANTIC_QUESTION_TYPE,
  Validator.ERROR_CODES.KP_SEMANTIC_OPERATION,
  Validator.ERROR_CODES.KP_SEMANTIC_NUMERIC,
  Validator.ERROR_CODES.KP_SEMANTIC_STRUCTURE,
  Validator.ERROR_CODES.KP_SEMANTIC_COMPOSITE
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

// M11-R05: 局部化重复重试——只重试重复的题目，保留有效题目
function filterDuplicateQuestions(questions, validationResults, seenKeys, Dup) {
  var fpGetter = Dup && typeof Dup.buildQuestionFingerprint === 'function' ? Dup.buildQuestionFingerprint : null;
  var duplicateIndices = [];
  var validQuestions = [];
  var validResults = [];

  questions.forEach(function (sq, i) {
    var vr = validationResults[i];
    var fp = sq && sq.questionFingerprint;
    if (!fp && fpGetter) {
      fp = fpGetter(sq);
      sq.questionFingerprint = fp;
    }
    var isDuplicate = fp && seenKeys && seenKeys.has(fp);
    var hasErrors = vr && vr.errors && vr.errors.length > 0;

    if (isDuplicate || hasErrors) {
      duplicateIndices.push(i);
    } else {
      validQuestions.push(sq);
      validResults.push(vr);
    }
  });

  return {
    duplicateIndices: duplicateIndices,
    validQuestions: validQuestions,
    validResults: validResults,
    allDuplicate: duplicateIndices.length === questions.length
  };
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
  var duplicateFailures = 0;   // 因重复导致的失败轮数
  var Dup = require('../validator/duplicate-validator.js');

  function attempt(attemptIndex, seed, retryContext) {
    // M11-R05: 支持局部重试——合并保留的有效题目与新生成的题目
    var keepQuestions = retryContext && retryContext._retryKeepQuestions ? retryContext._retryKeepQuestions : [];
    var keepResults = retryContext && retryContext._retryKeepResults ? retryContext._retryKeepResults : [];
    var duplicateIndices = retryContext && retryContext._retryDuplicateIndices ? retryContext._retryDuplicateIndices : null;
    var isPartialRetry = duplicateIndices !== null && duplicateIndices.length > 0;

    var attemptContext = Object.assign({}, plan, { seed: seed, _retryAttempt: attemptIndex });
    // 兼容同步/异步 generator：契约允许 generatorFn 直接返回数组（见 JSDoc），统一归一化为 Promise
    return Promise.resolve(generatorFn(attemptContext)).then(function (newQuestions) {
      if (!Array.isArray(newQuestions)) newQuestions = newQuestions.questions || [];
      // 标准化新生成的题目
      newQuestions = newQuestions.map(function (q, i) {
        // legacy 生成器可能不产 seed：幂等短路前先补 metadata.seed，保证 seed 可追溯
        if (q && q.seed == null) {
          q = Object.assign({}, q, { metadata: Object.assign({}, q.metadata, { seed: seed }) });
        }
        var sq = require('../semantic-question.js').normalizeSemanticQuestion(Object.assign({}, q, {
          generator: generatorId,
          generatorVersion: generatorVersion,
          seed: seed,
          index: i,
          _retryAttempt: attemptIndex
        }));
        // 幂等短路路径可能未计算指纹：兜底补算，保证每题可追溯去重键
        if (sq && !sq.questionFingerprint && Dup && typeof Dup.buildQuestionFingerprint === 'function') {
          sq.questionFingerprint = Dup.buildQuestionFingerprint(sq);
        }
        return sq;
      });

      // M11-R05: 局部重试时，保留有效题目，仅验证新生成的题目
      var questionsToValidate;
      var finalQuestions;
      var finalResults;

      if (isPartialRetry) {
        // 仅验证新生成的题目（替换重复位置）
        questionsToValidate = newQuestions;
        // 构建最终题目数组：保留有效题目 + 新生成题目（按原位置插入）
        // 原始批次大小 = 保留的有效题目数 + 需要替换的重复位置数（与 newQuestions 实际
        // 长度无关——生成器可能返回完整批次而非仅替换项，取 min 防越界）。
        finalQuestions = [];
        var dupCount = duplicateIndices.length;
        var originalCount = keepQuestions.length + dupCount;
        var newQIdx = 0;
        var keepQIdx = 0;
        for (var pos = 0; pos < originalCount; pos++) {
          if (duplicateIndices.indexOf(pos) !== -1) {
            finalQuestions.push(newQIdx < newQuestions.length ? newQuestions[newQIdx++] : null);
          } else {
            finalQuestions.push(keepQIdx < keepQuestions.length ? keepQuestions[keepQIdx++] : null);
          }
        }
        // 验证结果：保留有效结果 + 新生成题目的验证结果
        finalResults = [];
        newQIdx = 0;
        keepQIdx = 0;
        for (var pos2 = 0; pos2 < originalCount; pos2++) {
          if (duplicateIndices.indexOf(pos2) !== -1) {
            finalResults.push(null); // 占位，稍后填入验证结果
            newQIdx++;
          } else {
            finalResults.push(keepResults[keepQIdx++] || null);
          }
        }
      } else {
        questionsToValidate = newQuestions;
        finalQuestions = newQuestions;
        finalResults = null; // 非局部重试：返回整个批次的验证结果
      }

      // 预生成级去重检查（基于 semantic 指纹，独立于 prompt 文本 canonicalKey）：
      //   - 跨批：指纹已存在于共享 seenKeys → 冲突
      //   - 批内：指纹在同批内重复 → 冲突
      // 任一冲突 → 该批标记 DUPLICATE_QUESTION，整体触发重试再生（新 seed）。
      var dedupErrors = [];
      var localSeen = new Set();
      var fpGetter = Dup && typeof Dup.buildQuestionFingerprint === 'function' ? Dup.buildQuestionFingerprint : null;
      questionsToValidate.forEach(function (sq, i) {
        if (!sq) return;
        var fp = sq && sq.questionFingerprint;
        if (!fp && fpGetter) {
          fp = fpGetter(sq);
          sq.questionFingerprint = fp;
        }
        if (!fp) return;
        if (localSeen.has(fp)) {
          dedupErrors.push({
            code: Validator.ERROR_CODES.DUPLICATE_QUESTION,
            field: 'questionFingerprint',
            message: '预生成去重: 批内指纹重复 ' + fp,
            severity: 'ERROR'
          });
        } else if (validatorContext.seenKeys && validatorContext.seenKeys.has(fp)) {
          dedupErrors.push({
            code: Validator.ERROR_CODES.DUPLICATE_QUESTION,
            field: 'questionFingerprint',
            message: '预生成去重: 指纹已存在（跨批）' + fp,
            severity: 'ERROR'
          });
        } else {
          localSeen.add(fp);
        }
      });

      // 运行验证管道（仅验证新生成/重试的题目）
      // P0-06 Step 29: 传递完整 plan 给语义验证器（需要 knowledgePointIds）
      var valContext = Object.assign({}, validatorContext, { generatorId: generatorId, seed: seed, plan: plan });
      var validationResults = Pipeline.runPipelineBatch(questionsToValidate, valContext);

      // M11-R05: 填入新生成题目的验证结果到最终结果数组
      if (isPartialRetry) {
        var newQIdx2 = 0;
        for (var pos3 = 0; pos3 < finalResults.length; pos3++) {
          if (duplicateIndices.indexOf(pos3) !== -1) {
            finalResults[pos3] = validationResults[newQIdx2++];
          }
        }
      }

      // 预生成去重命中视为验证失败（当批题目整体无效 → 触发重试）
      if (dedupErrors.length) {
        validationResults = validationResults.map(function (r, i) {
          var errs = (r.errors || []).concat(dedupErrors);
          return Object.assign({}, r, { valid: r.valid && errs.length === 0, errors: errs });
        });
      }

      var allValid = validationResults.every(function (r) { return r.valid; });
      var allErrors = validationResults.flatMap(function (r) { return r.errors || []; });

      // 非局部重试：最终逐题验证结果即整个批次的验证结果（供上层复用，避免二次验证）
      var finalValidation = isPartialRetry ? finalResults : validationResults;

      return { questions: finalQuestions, validationResults: finalValidation, allValid: allValid, allErrors: allErrors, seed: seed, dedupHits: dedupErrors.length };
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
      // 成功：把本题指纹登记进共享去重集，供后续批次的预生成去重读取
      if (validatorContext.seenKeys) {
        result.questions.forEach(function (sq) {
          if (sq && sq.questionFingerprint) validatorContext.seenKeys.add(sq.questionFingerprint);
        });
      }
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

    // M11-R05: 局部化重复重试——识别重复题目，仅重试重复者
    var dupFilter = filterDuplicateQuestions(result.questions, result.validationResults, validatorContext.seenKeys, Dup);
    var duplicateIndices = dupFilter.duplicateIndices;

    // 提交失败统计：本次失败是否由「重复」导致
    if (result.allErrors && result.allErrors.some(function (e) { return e.code === Validator.ERROR_CODES.DUPLICATE_QUESTION; })) {
      duplicateFailures++;
    }

    // 如果没有重复题目（其他可重试错误），整批重试
    var shouldRetryAll = duplicateIndices.length === 0;

    // 重试
    retries++;
    if (retries > maxRetries) {
      if (duplicateFailures === allResults.length && duplicateFailures > 0) {
        return {
          questions: result.questions,
          validationResults: result.validationResults,
          retries: retries,
          success: false,
          error: GENERATION_SPACE_EXHAUSTED,
          message: '生成空间耗尽：仅因重复重试 ' + duplicateFailures + ' 次仍无法产出新题（KP+type+difficulty 语义空间已饱和）',
          attempts: allResults
        };
      }
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

    // M11-R05: 若仅部分题目重复，仅重试这些题目（传递 keepQuestions + keepResults 给 generator）
    var nextAttemptContext = Object.assign({}, plan, {
      seed: currentSeed,
      _retryAttempt: retries,
      // 局部重试信息
      _retryDuplicateIndices: shouldRetryAll ? null : duplicateIndices,
      _retryKeepQuestions: shouldRetryAll ? [] : dupFilter.validQuestions,
      _retryKeepResults: shouldRetryAll ? [] : dupFilter.validResults
    });

    return attempt(retries, currentSeed, nextAttemptContext).then(loop);
  });
}

module.exports = {
  generateWithRetry: generateWithRetry,
  DEFAULT_MAX_RETRIES: DEFAULT_MAX_RETRIES,
  GENERATION_SPACE_EXHAUSTED: GENERATION_SPACE_EXHAUSTED,
  RETRYABLE_CODES: RETRYABLE_CODES,
  FATAL_CODES: FATAL_CODES,
  isRetryable: isRetryable,
  isFatal: isFatal
};