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
// C2：纯重复（跨代/批内指纹冲突）专用重试上限。
// 纯重复属「随机抽样未命中剩余空间」，不代表题目质量问题，给更高预算逐位补齐；
// 含质量类错误（答案/难度/结构等）仍走 DEFAULT_MAX_RETRIES。
var DEDUP_MAX_RETRIES = 8;

// C2：纯重复家族错误码（DUPLICATE_INTEGRITY_VIOLATION 来自 duplicate-integrity-validator
// 的跨批冲突门，与 DUPLICATE_QUESTION 同属「抽样撞车」，不属质量错误）
var DEDUP_ERROR_CODES = [
  Validator.ERROR_CODES.DUPLICATE_QUESTION,
  'DUPLICATE_INTEGRITY_VIOLATION'
];
function isDedupError(e) {
  return !!e && DEDUP_ERROR_CODES.indexOf(e.code) !== -1;
}

// 空间耗尽信号：重试全部因「重复」而失败 → 说明该 KP+type+difficulty 语义空间的
// 可见题量已不足（去重后剩余空间太小），继续重试无意义。
var GENERATION_SPACE_EXHAUSTED = 'GENERATION_SPACE_EXHAUSTED';
var RETRYABLE_CODES = [
  Validator.ERROR_CODES.ANSWER_MISMATCH,
  Validator.ERROR_CODES.DUPLICATE_QUESTION,
  'DUPLICATE_INTEGRITY_VIOLATION',
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

// M11-R05: 局部化重复重试——按验证结果分区（含错误→待重试；通过→保留）。
// C2：不再用 seenKeys.has(fp) 判重——管道 validator 已对逐题给出权威判定（重复即
// DUPLICATE_QUESTION 错误），而 seenKeys 中会含有本批「已保留」题目自身的指纹，
// 复查 has(fp) 会把保留题误判为重复导致永不收敛。null 空位（未获不重复候选，
// 已带合成错误）直接列入待重试位。
function filterDuplicateQuestions(questions, validationResults, seenKeys, Dup) {
  var duplicateIndices = [];
  var validQuestions = [];
  var validResults = [];

  questions.forEach(function (sq, i) {
    var vr = validationResults[i];
    if (!sq) {
      duplicateIndices.push(i);
      return;
    }
    var fp = sq && sq.questionFingerprint;
    if (!fp && Dup && typeof Dup.buildQuestionFingerprint === 'function') {
      fp = Dup.buildQuestionFingerprint(sq);
      sq.questionFingerprint = fp;
    }
    var hasErrors = vr && vr.errors && vr.errors.length > 0;

    if (hasErrors) {
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

      // 新批次统一走验证管道（局部重试同样全量验证，再从中选「有效且不重复」者补位）
      // C2：管道内 validateDuplicate 会把本题指纹即时写入共享 seenKeys（成功才入集的
      // 终局登记在 allValid 后），因此预扫描必须基于「管道运行前」的快照判断跨批冲突，
      // 否则每题都会在本批已入袋的集合中「自命中」，误报全部重复。
      var seenKeysSnapshot = validatorContext.seenKeys ? new Set(validatorContext.seenKeys) : null;
      var valContext = Object.assign({}, validatorContext, { generatorId: generatorId, seed: seed, plan: plan });
      var newValidation = Pipeline.runPipelineBatch(newQuestions, valContext);

      var questionsToValidate;
      var finalQuestions;
      var finalResults;

      if (isPartialRetry) {
        questionsToValidate = newQuestions;
        // C2：候选池补位——新批次中「验证通过且不与 seenKeys/保留题/批内冲突」的题目
        // 均可填补重复空位（不再按序只取前 N 题，避免有效新题被浪费、重复题漏网到终轮）。
        var occupiedFps = new Set();
        keepQuestions.forEach(function (q) {
          if (q && q.questionFingerprint) occupiedFps.add(q.questionFingerprint);
        });
        var candidateIndices = [];
        newQuestions.forEach(function (sq, i) {
          var vr = newValidation[i];
          if (!sq || !vr || !vr.valid) return;
          var fp = sq.questionFingerprint;
          if (!fp) return;
          if (occupiedFps.has(fp)) return;
          if (seenKeysSnapshot && seenKeysSnapshot.has(fp)) return;
          occupiedFps.add(fp);
          candidateIndices.push(i);
        });

        var dupSet = {};
        duplicateIndices.forEach(function (d) { dupSet[d] = true; });
        var originalCount = keepQuestions.length + duplicateIndices.length;
        finalQuestions = [];
        finalResults = [];
        var candCursor = 0;
        var keepCursor = 0;
        for (var pos = 0; pos < originalCount; pos++) {
          if (dupSet[pos]) {
            if (candCursor < candidateIndices.length) {
              var ci = candidateIndices[candCursor++];
              finalQuestions.push(newQuestions[ci]);
              finalResults.push(newValidation[ci]);
            } else {
              // 空位：本轮新批次无不重复候选 → 合成重复错误，驱动继续局部重试
              finalQuestions.push(null);
              finalResults.push({
                valid: false,
                errors: [{
                  code: Validator.ERROR_CODES.DUPLICATE_QUESTION,
                  field: 'questionFingerprint',
                  message: '局部重试：空位未获得不重复新题',
                  severity: 'ERROR'
                }],
                warnings: [], info: [], score: 0, checks: { duplicate: 'fail' }
              });
            }
          } else {
            finalQuestions.push(keepQuestions[keepCursor] || null);
            finalResults.push(keepResults[keepCursor] || {
              valid: false, errors: [], warnings: [], info: [], score: 0, checks: {}
            });
            keepCursor++;
          }
        }
      } else {
        questionsToValidate = newQuestions;
        finalQuestions = newQuestions;
        finalResults = newValidation;
      }

      // 预生成级去重检查（非局部路径防御层；局部路径已在补位选择中排除重复）：
      //   - 跨批：指纹已存在于共享 seenKeys → 冲突
      //   - 批内：指纹在同批内重复 → 冲突
      var dedupErrors = [];
      if (!isPartialRetry) {
        var localSeen = new Set();
        var fpGetter = Dup && typeof Dup.buildQuestionFingerprint === 'function' ? Dup.buildQuestionFingerprint : null;
        questionsToValidate.forEach(function (sq) {
          if (!sq) return;
          var fp = sq && sq.questionFingerprint;
          if (!fp && fpGetter) {
            fp = fpGetter(sq);
            sq.questionFingerprint = fp;
          }
          if (!fp) return;
          if (localSeen.has(fp) || (seenKeysSnapshot && seenKeysSnapshot.has(fp))) {
            dedupErrors.push({
              code: Validator.ERROR_CODES.DUPLICATE_QUESTION,
              field: 'questionFingerprint',
              message: '预生成去重: 指纹重复 ' + fp,
              severity: 'ERROR'
            });
          } else {
            localSeen.add(fp);
          }
        });
        if (dedupErrors.length) {
          finalResults = finalResults.map(function (r) {
            var errs = ((r && r.errors) || []).concat(dedupErrors);
            return Object.assign({}, r, { valid: false, errors: errs });
          });
        }
      }

      var allValid = finalResults.every(function (r) { return r && r.valid; });
      // C2：轮次错误集 = 各槽位错误（含未补齐空位的合成 DUPLICATE 错误）+ 新批次真实验证错误。
      // 必须并入真实错误：局部重试候选池为空往往不是「抽样撞车」，而是新题全部质量失败
      // （如 KP 语义/难度不匹配的路由问题）；若只看槽位合成错误，会把质量失败误判为
      // 「纯重复」，套用去重预算（8 次）并掩盖真实错误码、延缓/误导失败判定。
      var allErrors = finalResults.flatMap(function (r) { return (r && r.errors) || []; })
        .concat(newValidation.flatMap(function (r) { return (r && r.errors) || []; }));

      // C2：seenKeys 事务化。验证管道运行期间 validateDuplicate 会把「所验证题」的指纹
      // 即时写入共享集；若本轮失败，这些题目会被丢弃/下轮重抽，其指纹必须回滚，否则
      // 跨轮共享集被失败批次污染，空间逐轮萎缩直至误报「生成空间耗尽」。
      //   - 全量重试：本轮不保留任何题 → 恢复为本轮前的已确立集合（快照）
      //   - 局部重试：最终数组 = 保留题 + 本轮补齐题，仅这些指纹正式入集
      if (validatorContext.seenKeys && seenKeysSnapshot) {
        var liveSet = validatorContext.seenKeys;
        liveSet.clear();
        seenKeysSnapshot.forEach(function (k) { liveSet.add(k); });
        if (isPartialRetry) {
          finalQuestions.forEach(function (sq) {
            if (sq && sq.questionFingerprint) liveSet.add(sq.questionFingerprint);
          });
        }
      }

      return { questions: finalQuestions, validationResults: finalResults, allValid: allValid, allErrors: allErrors, seed: seed, dedupHits: dedupErrors.length };
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
    if (result.allErrors && result.allErrors.some(isDedupError)) {
      duplicateFailures++;
    }

    // 如果没有重复题目（其他可重试错误），整批重试
    var shouldRetryAll = duplicateIndices.length === 0;

    // C2：本轮失败若「全部由重复导致」（纯抽样撞车），使用去重专用重试预算；
    // 一旦混入质量类错误，恢复默认质量重试预算（避免质量失败被无限重试掩盖）。
    var isDedupOnlyFailure = result.allErrors.length > 0 && result.allErrors.every(isDedupError);
    var effectiveCap = isDedupOnlyFailure ? DEDUP_MAX_RETRIES : maxRetries;

    // 重试
    retries++;
    if (retries > effectiveCap) {
      // 终轮可能残留 null 空位（未获不重复候选）：净化为非空题集，
      // 下游凭 success=false / error 判定走失败路径，不静默输出空位。
      var safeQuestions = result.questions.filter(function (sq) { return !!sq; });
      var safeResults = result.validationResults.filter(function (vr, i) { return !!result.questions[i]; });
      if (isDedupOnlyFailure && duplicateFailures > 0) {
        return {
          questions: safeQuestions,
          validationResults: safeResults,
          retries: retries,
          success: false,
          error: GENERATION_SPACE_EXHAUSTED,
          message: '生成空间耗尽：仅因重复重试 ' + duplicateFailures + ' 次仍无法产出新题（KP+type+difficulty 语义空间已饱和）',
          attempts: allResults
        };
      }
      return {
        questions: safeQuestions,
        validationResults: safeResults,
        retries: retries,
        success: false,
        error: 'MAX_RETRIES_EXCEEDED',
        message: '超过最大重试次数 (' + effectiveCap + ')',
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
  DEDUP_MAX_RETRIES: DEDUP_MAX_RETRIES,
  GENERATION_SPACE_EXHAUSTED: GENERATION_SPACE_EXHAUSTED,
  RETRYABLE_CODES: RETRYABLE_CODES,
  FATAL_CODES: FATAL_CODES,
  isRetryable: isRetryable,
  isFatal: isFatal
};