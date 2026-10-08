/* 自动生成：node dev/build-presentation-bundle.js（请勿手改） */
/* PresentationEngine 浏览器 bundle：C01 接入 practice.html，复用 strategy bundle 的 require 命名空间 */
(function (global) {
'use strict';
var __defs = {}, __mods = {};
function __req(id) {
  if (__mods[id]) return __mods[id].exports;
  if (__defs[id]) {
    var m = { exports: {} };
    __mods[id] = m;
    __defs[id](m, m.exports, __req);
    return m.exports;
  }
  if (global.StrategyBundle && typeof global.StrategyBundle.req === 'function') {
    try { return global.StrategyBundle.req(id); } catch (e) { /* delegate 失败继续抛本地错误 */ }
  }
  throw new Error('presentation-bundle: 模块未注册: ' + id);
}
__defs["shared/engine/presentation-engine.js"] = function (module, exports, require) {

'use strict';

var Selector = require("shared/generator/generator-selector.js");
var RetryLoop = require("shared/generator/retry-loop.js");
var BatchValidator = require("shared/validator/batch-validator.js");
var Quality = require("shared/validator/quality-scorer.js");
var SQ = require("shared/semantic/semantic-question.js");
var RenderFormat = require("shared/presentation/render-format.js");
// P32-AS-05：判分唯一权威随 bundle 暴露给浏览器侧 check.js（global.PresentationEngine.AnswerValidator）
var AnswerValidator = require("shared/validator/answer-validator.js");
var FeatureFlags = require("shared/catalog/feature-flags.js");
var Logger = require("shared/state/logger.js");
var Metrics = require("shared/state/metrics.js");


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



module.exports = {
  generateQuestions: generateQuestions,
  RenderFormat: RenderFormat,
  AnswerValidator: AnswerValidator
};

// 浏览器全局挂载
if (typeof window !== 'undefined') window.PresentationEngine = module.exports;
if (typeof global !== 'undefined') global.PresentationEngine = module.exports;
};
__defs["shared/generator/retry-loop.js"] = function (module, exports, require) {

'use strict';

var Validator = require("shared/validator/question-validator.js");
var Pipeline = require("shared/validator/validation-pipeline.js");
var QID = require("shared/knowledge/question-id.js");

var DEFAULT_MAX_RETRIES = 3;
// D005 修复：连续零新增（本轮 valid 数 ≤ 上轮）达到此阈值 → 判定语义空间饱和。
// 启发式值：3 轮零新增表明该 KP+type+difficulty 在 seenKeys 累积下已无新增空间。
var CONSECUTIVE_ZERO_PROGRESS = 3;
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
  // D005 修复：连续零新增计数器——本轮 valid 数 ≤ 上轮 valid 数 视为零新增；
  // 连续达到 CONSECUTIVE_ZERO_PROGRESS 轮 → 抛 GENERATION_SPACE_EXHAUSTED。
  var consecutiveZeroProgress = 0;
  var lastValidCount = 0;
  var Dup = require("shared/validator/duplicate-validator.js");

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
        var sq = require("shared/semantic/semantic-question.js").normalizeSemanticQuestion(Object.assign({}, q, {
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
        status: 'SUCCESS',
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
        status: 'FAILED',
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
        status: 'FAILED',
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

    // D005 修复：连续 N 轮零新增 → 语义空间饱和。
    // 判定：本轮成功保留题数（dupFilter.validQuestions.length）相对前轮无新增
    // （本轮全失败或本轮 valid 数 ≤ 上轮 valid 数），连续达到 CONSECUTIVE_ZERO_PROGRESS 轮 → 抛 GENERATION_SPACE_EXHAUSTED。
    // 作用：渐进饱和（部分保留+部分重复轮多次）也能及时终止，不只依赖 DEDUP_MAX_RETRIES 耗尽。
    var currentValidCount = dupFilter.validQuestions.length;
    if (currentValidCount <= (lastValidCount || 0)) {
      consecutiveZeroProgress++;
    } else {
      consecutiveZeroProgress = 0;
      lastValidCount = currentValidCount;
    }

    // 如果没有重复题目（其他可重试错误），整批重试
    var shouldRetryAll = duplicateIndices.length === 0;

    // C2：本轮失败若「全部由重复导致」（纯抽样撞车），使用去重专用重试预算；
    // 一旦混入质量类错误，恢复默认质量重试预算（避免质量失败被无限重试掩盖）。
    var isDedupOnlyFailure = result.allErrors.length > 0 && result.allErrors.every(isDedupError);
    var effectiveCap = isDedupOnlyFailure ? DEDUP_MAX_RETRIES : maxRetries;

    // 重试
    retries++;
    // D005 修复：连续零新增短路——在 effectiveCap 耗尽前提前判定语义空间饱和。
    // 比纯依赖 DEDUP_MAX_RETRIES 更早暴露饱和（渐进重试场景：每轮部分新增部分重复）。
    // FINAL-142：语义空间饱和是 Generator 能力上限的如实表达，即使 0 题也返回
    // PARTIAL（空数组），由编排层按容量记账，而非 FAILED（presentation-engine 不再抛错）。
    if (consecutiveZeroProgress >= CONSECUTIVE_ZERO_PROGRESS && duplicateFailures > 0) {
      var safeQ = result.questions.filter(function (sq) { return !!sq; });
      var safeR = result.validationResults.filter(function (vr, i) { return !!result.questions[i]; });
      return {
        questions: safeQ,
        validationResults: safeR,
        retries: retries,
        success: false,
        status: 'PARTIAL',
        error: GENERATION_SPACE_EXHAUSTED,
        message: '生成空间耗尽：连续 ' + consecutiveZeroProgress + ' 轮零新增（KP+type+difficulty 在 seenKeys 累积下语义空间饱和）',
        attempts: allResults
      };
    }
    if (retries > effectiveCap) {
      // 终轮可能残留 null 空位（未获不重复候选）：净化为非空题集，
      // 下游凭 success=false / error 判定走失败路径，不静默输出空位。
      var safeQuestions = result.questions.filter(function (sq) { return !!sq; });
      var safeResults = result.validationResults.filter(function (vr, i) { return !!result.questions[i]; });
      if (isDedupOnlyFailure && duplicateFailures > 0) {
        // FINAL-142：语义空间饱和是 Generator 能力上限的如实表达，即使 0 题也返回
        // PARTIAL（空数组），由编排层按容量记账，而非 FAILED（presentation-engine 不再抛错）。
        return {
          questions: safeQuestions,
          validationResults: safeResults,
          retries: retries,
          success: false,
          status: 'PARTIAL',
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
        status: safeQuestions.length > 0 ? 'PARTIAL' : 'FAILED',
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
};
__defs["shared/validator/batch-validator.js"] = function (module, exports, require) {

'use strict';

var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }
function coerceString(v) { return v == null ? '' : String(v); }

function countBy(arr, keyFn) {
  var out = {};
  arr.forEach(function (x) { var k = keyFn(x); out[k] = (out[k] || 0) + 1; });
  return out;
}

function validateBatch(questions, plan) {
  var errors = [];
  var warnings = [];
  var info = [];

  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push(createError(ERROR_CODES.SCHEMA_INVALID, 'questions', '题目数组为空', SEVERITY.ERROR));
    return { valid: false, errors: errors, warnings: warnings, info: info, score: 0, checks: {} };
  }

  plan = plan || {};
  var total = questions.length;

  // ① 总数量
  var expectedCount = plan.count || total;
  if (total !== expectedCount) {
    warnings.push(createError('COUNT_MISMATCH', 'count', '实际题目数(' + total + ') 与计划(' + expectedCount + ') 不符', SEVERITY.WARNING, { actual: total, expected: expectedCount }));
  } else {
    info.push({ code: 'COUNT_OK', field: 'count', message: '题目数量达标: ' + total, severity: 'INFO' });
  }

  // ② 知识点覆盖
  var kpCounts = countBy(questions, function (q) { return q.knowledgePoint || 'unknown'; });
  var kpCovered = Object.keys(kpCounts).filter(function (k) { return k !== 'unknown'; }).length;
  // Refactor Step 2：计划内 KP 列表唯一语义 = knowledgePointIds[]（边界兼容旧 knowledgePoints）
  var plannedKPs = (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds.length)
    ? plan.knowledgePointIds
    : ((Array.isArray(plan.knowledgePoints) ? plan.knowledgePoints : []) || []);
  if (plannedKPs.length) {
    var missingKPs = plannedKPs.filter(function (kp) { return !kpCounts[kp]; });
    if (missingKPs.length) {
      errors.push(createError('KP_COVERAGE_INCOMPLETE', 'knowledgePoints', '缺失知识点覆盖: ' + missingKPs.join(', '), SEVERITY.ERROR, { missing: missingKPs, covered: Object.keys(kpCounts) }));
    }
  }
  info.push({ code: 'KP_COVERAGE', field: 'knowledgePoints', message: '覆盖知识点: ' + kpCovered + ' 个', severity: 'INFO' });

  // ③ 题型比例
  var typeCounts = countBy(questions, function (q) { return q.questionType || q.type || 'unknown'; });
  var plannedTypes = plan.questionTypes || {};
  Object.keys(plannedTypes).forEach(function (type) {
    var expected = plannedTypes[type];
    var actual = typeCounts[type] || 0;
    if (actual < expected) {
      warnings.push(createError('TYPE_RATIO_LOW', 'questionType.' + type, '题型 ' + type + ' 数量(' + actual + ') 少于计划(' + expected + ')', SEVERITY.WARNING, { type: type, actual: actual, expected: expected }));
    }
  });
  info.push({ code: 'TYPE_DIST', field: 'questionTypes', message: '题型分布: ' + JSON.stringify(typeCounts), severity: 'INFO' });

  // ④ 难度分布
  var diffCounts = countBy(questions, function (q) { return q.difficulty || 0; });
  var avgDiff = questions.reduce(function (s, q) { return s + (q.difficulty || 0); }, 0) / total;
  var targetDiff = plan.difficulty;
  if (targetDiff != null && Math.abs(avgDiff - targetDiff) > 1) {
    warnings.push(createError('DIFFICULTY_DIST_OFF', 'difficulty', '平均难度(' + avgDiff.toFixed(1) + ') 偏离目标(' + targetDiff + ')', SEVERITY.WARNING, { avg: avgDiff, target: targetDiff }));
  }
  info.push({ code: 'DIFF_DIST', field: 'difficulty', message: '难度分布: ' + JSON.stringify(diffCounts) + ', 平均: ' + avgDiff.toFixed(1), severity: 'INFO' });

  // ⑤ 重复率
  var keys = questions.map(function (q) { return require("shared/validator/duplicate-validator.js").buildCanonicalKey(q); });
  var uniqueKeys = new Set(keys);
  var dupRate = (keys.length - uniqueKeys.size) / keys.length;
  if (dupRate > 0.1) {
    errors.push(createError('DUPLICATE_RATE_HIGH', 'duplicate', '重复率 ' + (dupRate * 100).toFixed(1) + '% 超过 10%', SEVERITY.ERROR, { rate: dupRate, total: keys.length, unique: uniqueKeys.size }));
  } else if (dupRate > 0) {
    warnings.push(createError('DUPLICATE_RATE_WARN', 'duplicate', '存在重复题目，重复率 ' + (dupRate * 100).toFixed(1) + '%', SEVERITY.WARNING, { rate: dupRate }));
  }
  info.push({ code: 'DUP_RATE', field: 'duplicate', message: '重复率: ' + (dupRate * 100).toFixed(1) + '%', severity: 'INFO' });

  // ⑥ 答案完整率
  var answered = questions.filter(function (q) { return q.answer && q.answer.value != null; }).length;
  var answerRate = answered / total;
  if (answerRate < 1) {
    errors.push(createError('ANSWER_INCOMPLETE', 'answer', '答案完整率 ' + (answerRate * 100).toFixed(1) + '% (< 100%)', SEVERITY.ERROR, { answered: answered, total: total }));
  }
  info.push({ code: 'ANSWER_RATE', field: 'answer', message: '答案完整率: ' + (answerRate * 100).toFixed(1) + '%', severity: 'INFO' });

  // ⑦ 图形完整率（有 graphic 的题目）
  var withGraphic = questions.filter(function (q) { return q.graphic && q.graphic.type; }).length;
  if (plan.graphicRequired && withGraphic < plan.graphicRequired) {
    warnings.push(createError('GRAPHIC_INSUFFICIENT', 'graphic', '含图形题目(' + withGraphic + ') 少于要求(' + plan.graphicRequired + ')', SEVERITY.WARNING));
  }
  info.push({ code: 'GRAPHIC_COUNT', field: 'graphic', message: '含图形题目: ' + withGraphic, severity: 'INFO' });

  // ⑧ 题型分布符合 QuestionPlan 细节
  if (plan.typeRatio) {
    Object.keys(plan.typeRatio).forEach(function (type) {
      var ratio = plan.typeRatio[type];
      var expected = Math.round(total * ratio);
      var actual = typeCounts[type] || 0;
      if (Math.abs(actual - expected) > Math.max(1, total * 0.1)) {
        warnings.push(createError('TYPE_RATIO_DEVIATION', 'questionType.' + type, '题型 ' + type + ' 比例偏离计划', SEVERITY.WARNING, { actual: actual, expected: expected, ratio: ratio }));
      }
    });
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0.5, checks: { batch: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateBatch: validateBatch
};
};
__defs["shared/validator/quality-scorer.js"] = function (module, exports, require) {

'use strict';

var Validator = require("shared/validator/question-validator.js");
var Schema = require("shared/schemas/semantic-question.schema.js");

var WEIGHTS = {
  correctness: 0.25,
  knowledgeAlignment: 0.20,
  difficultyAlignment: 0.15,
  structuralValidity: 0.15,
  renderability: 0.15,
  uniqueness: 0.10
};

function coerceNumber(v) { var n = Number(v); return isNaN(n) ? null : n; }
function coerceString(v) { return v == null ? '' : String(v); }

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }


function scoreQuestion(sq, validationResult, context) {
  var breakdown = {};
  var details = {};

  // ① Correctness (答案正确性)
  var corr = 0;
  if (validationResult && validationResult.checks && validationResult.checks.answer) {
    corr = validationResult.checks.answer === 'pass' ? 1 : 0;
  } else if (sq.answer && sq.answer.value != null) {
    corr = 0.8; // 有答案但未验证
  }
  breakdown.correctness = corr;

  // ② Knowledge Alignment (知识点对齐)
  var ka = 0;
  if (validationResult && validationResult.checks && validationResult.checks.knowledgePoint) {
    ka = validationResult.checks.knowledgePoint === 'pass' ? 1 : 0;
  } else if (sq.knowledgePoint) {
    ka = 0.8;
  }
  breakdown.knowledgeAlignment = ka;

  // ③ Difficulty Alignment (难度对齐)
  var da = 0;
  if (validationResult && validationResult.checks && validationResult.checks.difficulty) {
    da = validationResult.checks.difficulty === 'pass' ? 1 : 0;
  } else if (sq.difficulty != null) {
    da = 0.8;
  }
  breakdown.difficultyAlignment = da;

  // ④ Structural Validity (结构合法性)
  var sv = 0;
  if (validationResult && validationResult.checks && validationResult.checks.structure) {
    sv = validationResult.checks.structure === 'pass' ? 1 : 0;
  } else {
    sv = 0.8; // 默认假设结构合法
  }
  breakdown.structuralValidity = sv;

  // ⑤ Renderability (可渲染性)
  var rend = 0;
  if (validationResult && validationResult.checks && validationResult.checks.renderPreflight) {
    rend = validationResult.checks.renderPreflight === 'pass' ? 1 : 0;
  } else if (sq.prompt && sq.answerMode) {
    rend = 0.9;
  }
  breakdown.renderability = rend;

  // ⑥ Uniqueness (唯一性)
  var uniq = 0;
  if (validationResult && validationResult.checks && validationResult.checks.duplicate) {
    uniq = validationResult.checks.duplicate === 'pass' ? 1 : 0;
  } else if (context && context.seenKeys) {
    var key = require("shared/validator/duplicate-validator.js").buildCanonicalKey(sq);
    uniq = context.seenKeys.has(key) ? 0 : 1;
  } else {
    uniq = 1; // 默认唯一
  }
  breakdown.uniqueness = uniq;

  // 加权总分
  var total = 0;
  Object.keys(WEIGHTS).forEach(function (k) {
    total += (breakdown[k] || 0) * WEIGHTS[k];
  });
  total = clamp(total, 0, 1);

  return {
    total: Number(total.toFixed(3)),
    breakdown: breakdown,
    weights: WEIGHTS,
    details: details
  };
}


function scoreBatch(questions, validationResults, context) {
  context = context || {};
  var seenKeys = context.seenKeys || new Set();

  var scored = questions.map(function (sq, i) {
    var vr = validationResults && validationResults[i] ? validationResults[i] : null;
    var score = scoreQuestion(sq, vr, { seenKeys: seenKeys });
    // 更新 seenKeys
    if (sq) {
      var key = require("shared/validator/duplicate-validator.js").buildCanonicalKey(sq);
      seenKeys.add(key);
    }
    return { questionId: sq.id, score: score };
  });

  // 汇总统计
  var totals = scored.map(function (s) { return s.score.total; });
  var avg = totals.length ? totals.reduce(function (a, b) { return a + b; }, 0) / totals.length : 0;
  var min = totals.length ? Math.min.apply(null, totals) : 0;
  var max = totals.length ? Math.max.apply(null, totals) : 0;

  // 分布
  var dist = { '0.9-1.0': 0, '0.7-0.9': 0, '0.5-0.7': 0, '<0.5': 0 };
  totals.forEach(function (t) {
    if (t >= 0.9) dist['0.9-1.0']++;
    else if (t >= 0.7) dist['0.7-0.9']++;
    else if (t >= 0.5) dist['0.5-0.7']++;
    else dist['<0.5']++;
  });

  return {
    items: scored,
    summary: {
      count: scored.length,
      average: Number(avg.toFixed(3)),
      min: Number(min.toFixed(3)),
      max: Number(max.toFixed(3)),
      distribution: dist
    }
  };
}


function generatorProfile(scoredItems) {
  if (!scoredItems.length) return { avgScore: 0, byDimension: {} };

  var dims = Object.keys(WEIGHTS);
  var byDim = {};
  dims.forEach(function (d) {
    var vals = scoredItems.map(function (s) { return s.score.breakdown[d]; });
    var sum = vals.reduce(function (a, b) { return a + b; }, 0);
    byDim[d] = { avg: Number((sum / vals.length).toFixed(3)), min: Math.min.apply(null, vals), max: Math.max.apply(null, vals) };
  });

  var avg = scoredItems.reduce(function (a, b) { return a + b.score.total; }, 0) / scoredItems.length;

  return {
    avgScore: Number(avg.toFixed(3)),
    byDimension: byDim,
    totalItems: scoredItems.length
  };
}

module.exports = {
  scoreQuestion: scoreQuestion,
  scoreBatch: scoreBatch,
  generatorProfile: generatorProfile,
  WEIGHTS: WEIGHTS
};
};
__defs["shared/semantic/semantic-question.js"] = function (module, exports, require) {

'use strict';

var Schema = require("shared/schemas/semantic-question.schema.js");
var QTR = require("shared/knowledge/question-type-registry.js");
var QID = require("shared/knowledge/question-id.js");

var UUID_COUNTER = 0;

function uuid() {
  UUID_COUNTER++;
  return 'sq_' + Date.now().toString(36) + '_' + UUID_COUNTER.toString(36);
}

function nowISO() {
  return new Date().toISOString();
}

function deepClone(obj) {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  if (typeof obj === 'object') {
    var out = {};
    Object.keys(obj).forEach(function (k) { out[k] = deepClone(obj[k]); });
    return out;
  }
  return obj;
}

function coerceNumber(v) {
  if (v == null) return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

function coerceInteger(v) {
  var n = coerceNumber(v);
  return n == null ? null : Math.floor(n);
}

function coerceString(v) {
  if (v == null) return '';
  return String(v);
}

function ensureArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// Schema 8 类 + QTR 补集（geometry/recognize/oral）+ read-aloud 的并集
var VALID_QUESTION_TYPES = null;
function isValidQuestionType(t) {
  if (!t) return false;
  if (VALID_QUESTION_TYPES == null) {
    var set = Schema.QUESTION_TYPES.slice();
    (QTR.TYPES || []).forEach(function (tt) { if (set.indexOf(tt.id) === -1) set.push(tt.id); });
    if (set.indexOf('read-aloud') === -1) set.push('read-aloud');
    VALID_QUESTION_TYPES = set;
  }
  return VALID_QUESTION_TYPES.indexOf(t) !== -1;
}


function createSemanticQuestion(raw) {
  raw = raw || {};

  // 自动生成 ID（若未提供）
  var questionId = raw.id || QID.generateQuestionId(raw.seed || QID.generateBaseSeed(), {
    generatorId: raw.generator || raw.metadata && raw.metadata.generator,
    index: raw.index,
    knowledgePointId: raw.knowledgePoint || raw.knowledgePointId,
    difficulty: raw.difficulty,
    questionType: raw.questionType
  });

  // 自动生成 metadata（可追溯三要素）
  var metadata = raw.metadata || {};
  if (!metadata.generator && raw.generator) metadata.generator = raw.generator;
  if (!metadata.generatorVersion && raw.generatorVersion) metadata.generatorVersion = raw.generatorVersion;
  if (!metadata.seed && raw.seed) metadata.seed = raw.seed;
  metadata = QID.createMetadata({
    generatorId: metadata.generator,
    generatorVersion: metadata.generatorVersion,
    seed: metadata.seed,
    planId: metadata.planId,
    timestamp: metadata.timestamp,
    retryCount: metadata.retryCount,
    tags: metadata.tags
  });

  var sq = {
    // ① Identity
    id: questionId,
    version: raw.version || Schema.VERSION,

    // ② Knowledge Binding
    knowledgePoint: coerceString(raw.knowledgePoint || raw.knowledgePointId),
    knowledgePointId: coerceString(raw.knowledgePointId || raw.knowledgePoint),
    skill: coerceString(raw.skill || ''),

    // ③ Difficulty & Cognitive
    // ③ Difficulty & Cognitive
    difficulty: coerceInteger(raw.difficulty),
    difficultyParams: deepClone(raw.difficultyParams) || {},
    numberRange: deepClone(raw.numberRange) || { min: 1, max: 1 },
    spiralLevel: coerceInteger(raw.spiralLevel) || 1,
    context: coerceString(raw.context),
    seed: raw.seed || null,
    cognitiveLevel: coerceString(raw.cognitiveLevel || ''),

    // ④ Content (纯文本)
    content: deepClone(raw.content) || Schema.defaultContent(),

    // ⑤ Question (核心题干)
    question: deepClone(raw.question) || Schema.defaultQuestion(),

    // ⑥ Answer
    answer: deepClone(raw.answer) || Schema.defaultAnswer(),

    // ⑦ Distractors
    distractors: ensureArray(raw.distractors).map(function (d) {
      return deepClone(d) || Schema.defaultDistractor();
    }),

    // ⑧ Graphic (描述性，非渲染)
    // 有真实 graphic 描述才构造成对象；否则置 null（而非空壳 {type:null}）。
    // 修复：此前用 Schema.defaultGraphic()（{type:null,...}）作兜底，该真值空对象会让
    // graphic-validator 的「缺少 graphic.type」分支误触发，把无图形题误判为 ERR
    //（raw.svg 已由下方 sq.svg 单独保留，不走 graphic 描述符，避免触发「禁止原始 SVG」）。
    graphic: deepClone(raw.graphic) || null,

    // ⑨ Constraints (结构约束：maxSteps, allowBracket, allowMultDiv 等)
    constraints: deepClone(raw.constraints) || {},

    // ⑩ Metadata (可追溯)
    metadata: metadata
  };

  // 兼容字段（供 LegacyAdapter / 适配层使用，不参与语义校验）
  if (raw.render != null) sq.render = raw.render;
  if (raw.check != null) sq.check = raw.check;
  if (raw.svg != null) sq.svg = raw.svg;
  if (raw.options != null) sq.options = raw.options;

  // P0-003：透传原始结构 data（choice 轨的 options/correctIndex 等渲染与校验依赖）与 hint
  if (raw.data != null) sq.data = deepClone(raw.data);
  if (raw.hint != null) sq.hint = raw.hint;

  // P28-FORM-CONTRACT-01：透传形态声明字段 response.layout（生成器声明、渲染器消费）。
  // 缺省 null → 渲染器回落 block 布局（可见退化，非静默）；layout 枚举由 Schema 校验。
  if (raw.response != null) sq.response = deepClone(raw.response);

  // 选择题兼容：sq.data.options 缺省时由 options 补全，并尽量反推 correctIndex
  if (sq.data && !Array.isArray(sq.data.options) && Array.isArray(sq.options) && sq.options.length) {
    sq.data.options = sq.options.slice();
  }
  if (sq.data && Array.isArray(sq.data.options) && sq.answer && sq.answer.value != null && sq.data.correctIndex == null) {
    var ci = sq.data.options.indexOf(coerceString(sq.answer.value));
    if (ci !== -1) sq.data.correctIndex = ci;
  }

  // 扁平化常用字段（便捷访问，不破坏标准结构）
  sq.prompt = sq.content && sq.content.prompt ? sq.content.prompt : (sq.question && sq.question.prompt ? sq.question.prompt : '');
  sq.questionType = raw.questionType || raw.type || null;
  sq.answerMode = (sq.question && sq.question.answerMode) || raw.answerMode || 'input';

  // M6-R06：统一题目指纹（KP + type + semantic + numbers + structure → 去重键）
  sq.questionFingerprint = computeFingerprint(sq);

  return sq;
}

// 惰性引入去重 / 指纹模块（避免与 validator 体系形成顶层循环依赖）
function computeFingerprint(sq) {
  try {
    var Dup = require("shared/validator/duplicate-validator.js");
    if (Dup && typeof Dup.buildQuestionFingerprint === 'function') return Dup.buildQuestionFingerprint(sq);
  } catch (e) {  }
  return null;
}


function normalizeSemanticQuestion(raw) {
  if (!raw || typeof raw !== 'object') {
    return createSemanticQuestion({});
  }

  // 已经是标准结构则直接返回（幂等）
  if (raw.id && raw.version && raw.metadata && raw.metadata.generator) {
    return raw;
  }

  // 字段映射表：Legacy 字段名 → 标准字段
  var mapped = {
    id: raw.id || raw.questionId,
    version: raw.version || Schema.VERSION,
    knowledgePoint: raw.knowledgePointId || raw.knowledgePoint || raw.kpId,
    skill: raw.skill || raw.ability || '',
    questionType: raw.questionType || raw.type,
    difficulty: coerceInteger(raw.difficulty || raw.difficultyLevel),
    numberRange: raw.numberRange,
    cognitiveLevel: raw.cognitiveLevel || raw.cognitive || '',
    content: raw.content || { prompt: coerceString(raw.prompt || raw.stem || raw.q || raw.question) },
    question: raw.question || (function () {
      var q = { prompt: coerceString(raw.prompt || raw.stem || raw.q || raw.question) };
      if (raw.answerMode) q.answerMode = raw.answerMode;
      return q;
    })(),
    answerMode: raw.answerMode,
    // D003 修复：context 字段必须映射（生成器写 q.context = plan.contextType，
    // 归一化时漏映射导致 createSemanticQuestion 收到 raw.context=undefined → coerceString('')）
    context: raw.context,
    // P28-FIX-C：spiralLevel 必须映射（生成器写 q.spiralLevel = plan.spiralLevel，
    // 归一化时漏映射导致恒回落 1，maxLevel 钳制结果无法到达题目元数据/学习记录）。
    // createSemanticQuestion 内 coerceInteger(raw.spiralLevel) || 1 兜底非法值。
    spiralLevel: raw.spiralLevel,
    // P0-003：判断题 answer=false / 数字 0 / 空串均为合法答案，不能按 truthy 丢弃。
    // 仅当字段未提供（undefined/null）时才回退到 answerValue/correctAnswer。
    answer: (function () {
      var rawHasAnswer = (typeof raw !== 'undefined' && raw !== null) &&
        Object.prototype.hasOwnProperty.call(raw, 'answer') && raw.answer != null;
      if (rawHasAnswer) {
        return typeof raw.answer === 'object' ? raw.answer : { value: raw.answer };
      }
      return { value: raw.answerValue != null ? raw.answerValue : (raw.correctAnswer != null ? raw.correctAnswer : undefined) };
    })(),
    distractors: ensureArray(raw.distractors || raw.options || raw.choices).map(function (d) {
      if (typeof d === 'object') return d;
      return { value: d };
    }),
    // P0-003：选择题保留平铺 options（渲染 html-renderer.js 读取 sq.options/distractors/data.options）
    // 及 data.correctIndex（校验/反选使用），与 selection.js 生成的 choice 结构一致。
    options: (function () {
      var o = raw.options || raw.choices;
      if (!Array.isArray(o)) return undefined;
      return o.slice();
    })(),
    data: (function () {
      var opts = raw.options || raw.choices;
      if (!Array.isArray(opts) && !raw.data) return undefined;
      var base = (raw.data && typeof raw.data === 'object') ? raw.data : {};
      var out = {};
      Object.keys(base).forEach(function (k) { out[k] = base[k]; });
      if (Array.isArray(opts)) {
        out.options = opts.slice();
        if (out.correctIndex == null && typeof raw.answer !== 'object' && raw.answer != null) {
          out.correctIndex = opts.indexOf(coerceString(raw.answer));
        }
      } else if (out.options == null && Array.isArray(out.distractors)) {
        out.options = out.distractors;
      }
      return out;
    })(),
    // P0/GV 修复：优先保留真实 graphic 描述符（type/params 等），仅当无描述符但给了原始
    // svg 时才包一层 custom/rawSvg；两者皆无为 null。旧逻辑 `raw.graphic||raw.svg ? {type:'custom',params:{rawSvg:raw.svg}} : null`
    // 会把真实描述符（如 number-line）误洗成 custom/rawSvg 空壳，且 rawSvg=undefined 仍产生被
    // graphic-validator 判 ERR 的非法描述。null 让 validator 走 skip（见 createSemanticQuestion ⑧）。
    graphic: (raw.graphic && typeof raw.graphic === 'object')
      ? deepClone(raw.graphic)
      : (raw.svg ? { type: 'custom', params: { rawSvg: raw.svg } } : null),
    constraints: deepClone(raw.constraints) || {},
    response: deepClone(raw.response),  // P28-FORM-CONTRACT-01：形态声明透传（layout 枚举由 Schema 校验）
    metadata: raw.metadata || {
      generator: raw.generator || raw.pluginId || raw.source,
      generatorVersion: raw.generatorVersion || raw.version,
      seed: raw.seed || raw.randomSeed,
      timestamp: raw.timestamp || nowISO()
    }
  };

  // 补全 prompt
  if (!mapped.content.prompt) {
    mapped.content.prompt = coerceString(mapped.question.prompt || mapped.question.stem || mapped.question.q);
  }

  return createSemanticQuestion(mapped);
}


function validateSchema(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  if (!sq || typeof sq !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.SCHEMA_INVALID, field: 'root', message: '题目对象为空或非对象', severity: Schema.SEVERITY.ERROR });
    return { valid: false, errors: errors, warnings: warnings, info: info };
  }

  // 禁止在 SemanticQuestion 上携带执行/渲染字段（先于归一化检查，避免被丢弃）
  if (typeof sq.render === 'function' || typeof sq.check === 'function') {
    errors.push({ code: Schema.ERROR_CODES.SCHEMA_INVALID, field: 'root', message: 'SemanticQuestion 禁止携带 render/check 执行字段（禁止字段）', severity: Schema.SEVERITY.ERROR });
  }

  // 宽容归一化：兼容 flat/legacy 输入（如 { prompt, answer: '14' }），
  // 与 createSemanticQuestion / normalizeSemanticQuestion 保持一致
  sq = normalizeSemanticQuestion(sq);

  // --- ① Identity ---
  if (!sq.id) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'id', message: '缺少题目 ID', severity: Schema.SEVERITY.ERROR });
  }
  if (typeof sq.version !== 'number' && typeof sq.version !== 'string') {
    warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'version', message: 'version 应为数字或字符串', severity: Schema.SEVERITY.WARNING });
  }

  // --- ② Knowledge Binding ---
  if (!sq.knowledgePoint) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'knowledgePoint', message: '缺少 knowledgePoint 绑定', severity: Schema.SEVERITY.ERROR });
  }

  // --- ③ Difficulty ---
  if (sq.difficulty != null) {
    var diff = coerceInteger(sq.difficulty);
    if (diff === null || Schema.DIFFICULTY_LEVELS.indexOf(diff) === -1) {
      warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'difficulty', message: 'difficulty 超出已知范围 (1-10)', severity: Schema.SEVERITY.WARNING });
    }
  }

  // --- ③.5 QuestionType ---
  if (!sq.questionType) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'questionType', message: '缺少 questionType', severity: Schema.SEVERITY.ERROR });
  } else if (!isValidQuestionType(sq.questionType)) {
    errors.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'questionType', message: '未知 questionType: ' + sq.questionType, severity: Schema.SEVERITY.ERROR });
  }

  // --- ③.6 NumberRange ---
  if (sq.numberRange) {
    if (typeof sq.numberRange !== 'object') {
      errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'numberRange', message: 'numberRange 必须为对象 { min, max }', severity: Schema.SEVERITY.ERROR });
    } else if (sq.numberRange.min != null && sq.numberRange.max != null &&
               sq.numberRange.min > sq.numberRange.max) {
      errors.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'numberRange', message: 'numberRange.min 不得大于 max', severity: Schema.SEVERITY.ERROR });
    }
  }

  // --- ④ Content ---
  if (sq.content && typeof sq.content !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'content', message: 'content 必须为对象', severity: Schema.SEVERITY.ERROR });
  }
  if (sq.content && sq.content.prompt != null && typeof sq.content.prompt !== 'string') {
    warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'content.prompt', message: 'prompt 应为字符串', severity: Schema.SEVERITY.WARNING });
  }
  var promptVal = (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || sq.prompt;
  if (!promptVal) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'prompt', message: '缺少 prompt（题干）', severity: Schema.SEVERITY.ERROR });
  }

  // --- ⑤ Question ---
  if (sq.question && typeof sq.question !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'question', message: 'question 必须为对象', severity: Schema.SEVERITY.ERROR });
  }
  if (sq.question && sq.question.answerMode && !Schema.isValidAnswerMode(sq.question.answerMode)) {
    warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'question.answerMode', message: '未知 answerMode: ' + sq.question.answerMode, severity: Schema.SEVERITY.WARNING });
  }

  // --- ⑤.5 Response（形态声明，P28-FORM-CONTRACT-01）---
  // 可选字段：缺省 null → 渲染器回落 block；存在则校验类型与 layout 枚举（warning，不阻断）。
  if (sq.response != null) {
    if (typeof sq.response !== 'object') {
      warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'response', message: 'response 必须为对象', severity: Schema.SEVERITY.WARNING });
    } else if (sq.response.layout != null && !Schema.isValidResponseLayout(sq.response.layout)) {
      warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'response.layout', message: '未知 response.layout: ' + sq.response.layout, severity: Schema.SEVERITY.WARNING });
    }
  }

  // --- ⑥ Answer ---
  var answerMode = sq.answerMode || (sq.question && sq.question.answerMode) || 'input';
  if (!sq.answer || typeof sq.answer !== 'object') {
    // read-aloud 模式允许 answer 为 null
    if (answerMode !== 'read-aloud') {
      errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'answer', message: '缺少 answer 对象', severity: Schema.SEVERITY.ERROR });
    }
  } else {
    // read-aloud 模式允许 answer.value 为 null
    if (answerMode !== 'read-aloud' && sq.answer.value == null && (!sq.answer.acceptable || sq.answer.acceptable.length === 0)) {
      errors.push({ code: Schema.ERROR_CODES.ANSWER_INVALID, field: 'answer.value', message: '答案值缺失且无可接受替代答案', severity: Schema.SEVERITY.ERROR });
    }
    if (sq.answer.precision != null && (typeof sq.answer.precision !== 'number' || sq.answer.precision < 0)) {
      warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'answer.precision', message: 'precision 应为非负数', severity: Schema.SEVERITY.WARNING });
    }
  }

  // --- ⑦ Distractors ---
  if (sq.distractors && !Array.isArray(sq.distractors)) {
    errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'distractors', message: 'distractors 必须为数组', severity: Schema.SEVERITY.ERROR });
  }
  if (Array.isArray(sq.distractors)) {
    sq.distractors.forEach(function (d, i) {
      if (!d || typeof d !== 'object') {
        warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'distractors[' + i + ']', message: '干扰项应为对象', severity: Schema.SEVERITY.WARNING });
        return;
      }
      if (d.errorType && !Schema.isValidDistractorErrorType(d.errorType)) {
        warnings.push({ code: Schema.ERROR_CODES.DISTRACTOR_ERROR_TYPE_INVALID, field: 'distractors[' + i + '].errorType', message: '未知错误类型: ' + d.errorType, severity: Schema.SEVERITY.WARNING });
      }
    });
  }

  // --- ⑧ Graphic ---
  if (sq.graphic && typeof sq.graphic !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'graphic', message: 'graphic 必须为对象', severity: Schema.SEVERITY.ERROR });
  }
  if (sq.graphic) {
    if (sq.graphic.type && !Schema.isValidGraphicType(sq.graphic.type)) {
      warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'graphic.type', message: '未知 graphic type: ' + sq.graphic.type, severity: Schema.SEVERITY.WARNING });
    }
    if (sq.graphic.type && sq.graphic.subtype && !Schema.isValidGraphicSubtype(sq.graphic.type, sq.graphic.subtype)) {
      warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'graphic.subtype', message: 'type ' + sq.graphic.type + ' 下未知 subtype: ' + sq.graphic.subtype, severity: Schema.SEVERITY.WARNING });
    }
    // 禁止直接嵌入 SVG/HTML 字符串
    if (sq.graphic.rawSvg || sq.graphic.svg || sq.graphic.html) {
      errors.push({ code: Schema.ERROR_CODES.GRAPHIC_INVALID, field: 'graphic', message: 'graphic 不得包含原始 SVG/HTML 字符串（请使用描述性 params）', severity: Schema.SEVERITY.ERROR });
    }
  }

  // --- ⑨ Metadata (可追溯) ---
  if (!sq.metadata || typeof sq.metadata !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'metadata', message: '缺少 metadata', severity: Schema.SEVERITY.ERROR });
  } else {
    if (!sq.metadata.generator) {
      warnings.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'metadata.generator', message: '缺少 generator 来源标识', severity: Schema.SEVERITY.WARNING });
    }
    if (!sq.metadata.generatorVersion) {
      warnings.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'metadata.generatorVersion', message: '缺少 generatorVersion', severity: Schema.SEVERITY.WARNING });
    }
    if (!sq.metadata.seed) {
      warnings.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'metadata.seed', message: '缺少 seed（不可复现）', severity: Schema.SEVERITY.WARNING });
    }
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info };
}


function isValidSemanticQuestion(sq) {
  return validateSchema(sq).valid;
}


function normalizeQuestions(raws) {
  if (!Array.isArray(raws)) return [];
  return raws.map(normalizeSemanticQuestion);
}


function validateQuestions(sqs) {
  if (!Array.isArray(sqs)) return [];
  return sqs.map(validateSchema);
}

module.exports = {
  createSemanticQuestion: createSemanticQuestion,
  normalizeSemanticQuestion: normalizeSemanticQuestion,
  validateSchema: validateSchema,
  isValidSemanticQuestion: isValidSemanticQuestion,
  normalizeQuestions: normalizeQuestions,
  validateQuestions: validateQuestions,
  Schema: Schema
};
};
__defs["shared/presentation/render-format.js"] = function (module, exports, require) {

'use strict';

function coerceScalar(v) {
  if (v == null) return null;
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v.length ? String(v[0]) : null;
    return v.value != null ? String(v.value) : (v.correctAnswer != null ? String(v.correctAnswer) : null);
  }
  return String(v);
}

// P32-AS-04：批改专用只读答案规格。与显示用 answer 分离——
// acceptable 仅用于判分白名单，任何 UI 不得渲染 answerSpec；批改禁止回读 __semantic。
// acceptable 只接受 string/number 标量并打平为 string[]（嵌套数组等缺陷形态不参与判分，AS-11 清数据）。
function buildAnswerSpec(sq, answerMode) {
  var a = sq.answer;
  if (!a || typeof a !== 'object') return null;
  var acceptable = [];
  if (Array.isArray(a.acceptable)) {
    for (var i = 0; i < a.acceptable.length; i++) {
      var item = a.acceptable[i];
      if (typeof item === 'string' || typeof item === 'number') acceptable.push(String(item));
    }
  }
  var value = a.value != null ? a.value : (acceptable.length ? acceptable[0] : null);
  var spec = {
    value: value,
    acceptable: acceptable,
    precision: a.precision != null ? a.precision : null,
    unit: a.unit != null ? a.unit : null,
    mode: answerMode
  };
  // P32-AS-13：classify 结构化答案只在 data.groups，透传供组→项集合判定（顺序无关）。
  var qt = sq.questionType || sq.type;
  if (qt === 'classify' && sq.data && sq.data.groups && typeof sq.data.groups === 'object') {
    spec.groups = sq.data.groups;
  }
  return spec;
}

function seededIndex(seedStr) {
  var h = 2166136261;
  var s = String(seedStr);
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function toRenderableQuestion(sq) {
  if (!sq) return null;

  var answerMode = sq.answerMode || (sq.question && sq.question.answerMode) || 'input';
  // V5.1.0：归一化后 answerMode 可能为 'input'，判断题以 questionType='judge' 为可靠判据。
  var questionType = sq.questionType || sq.type;
  var inputTypeMap = {
    'input': 'text',
    'choice': 'choice',
    'judge': 'judge',
    'multi': 'multi',
    'none': 'none',
    'read-aloud': 'read-aloud'
  };
  var inputType = (questionType === 'judge' || answerMode === 'judge')
    ? 'judge'
    : (inputTypeMap[answerMode] || 'text');

  var options = null;
  // 统一选项源：sq.options / sq.distractors / sq.data.options（生成器三种写法一致收敛）
  var rawOptions = (Array.isArray(sq.options) && sq.options.length) ? sq.options
    : (Array.isArray(sq.distractors) && sq.distractors.length) ? sq.distractors
      : (sq.data && Array.isArray(sq.data.options) && sq.data.options.length) ? sq.data.options : null;
  if (inputType === 'choice' && rawOptions) {
    options = rawOptions.map(function (d) {
      return (d && typeof d === 'object') ? (d.label != null ? d.label : d.value) : d;
    });
    var correct = sq.answer && sq.answer.value != null ? coerceScalar(sq.answer.value) : '';
    if (correct && options.indexOf(correct) === -1) {
      var seedStr = (sq.seed != null ? String(sq.seed)
        : (sq.metadata && sq.metadata.seed != null ? String(sq.metadata.seed)
          : (sq.id || 'q')));
      var pos = seededIndex(seedStr) % (options.length + 1);
      options.splice(pos, 0, correct);
    }
  }

  return {
    id: sq.id,
    q: sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || '',
    text: sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || '',
    // answer 归一：value 优先；缺 value 时回退 acceptable[0]（与旧 _sqToLegacyQuestion 语义一致）
    answer: (sq.answer && sq.answer.value != null) ? sq.answer.value
      : (sq.answer && Array.isArray(sq.answer.acceptable) && sq.answer.acceptable.length) ? sq.answer.acceptable[0]
        : (sq.answer ? sq.answer.value : null),
    inputType: inputType,
    options: options,
    type: sq.questionType || sq.type || sq.skill || 'calc',
    questionType: sq.questionType || sq.type || sq.skill || 'calc',
    skill: sq.skill || '',
    difficulty: sq.difficulty,
    difficultyParams: sq.difficultyParams,
    knowledgePointId: sq.knowledgePoint,
    // M10-R10: 扩展 knowledgePointIds 数组（兼容多 KP combine）
    knowledgePointIds: (Array.isArray(sq.knowledgePointIds) && sq.knowledgePointIds.length)
      ? sq.knowledgePointIds.slice()
      : (sq.knowledgePoint ? [sq.knowledgePoint] : []),
    // M10-R10: 扩展 composite 结构（来自 plan.complexity 或 sq.complexity/sq.data.composite）
    composite: sq.composite || (sq.data && sq.data.composite) || null,
    hint: sq.hint,
    numberRange: sq.numberRange,
    render: sq.render || null,
    check: sq.check || null,
    svg: sq.svg || (sq.graphic && sq.graphic.params && (sq.graphic.params.rawSvg || sq.graphic.params.legacySvg)) || null,
    // P28-32：Learner 数据链透传字段（semanticTarget / spiralLevel / errorType）。
    // 供练习会话/页面 feedLearnerModel 逐题构建 PracticeResult；R10 约束保持——
    // errorType 只透传题面自带可靠值，缺失即 null（不伪造诊断）。
    semanticTarget: sq.semanticTarget != null ? sq.semanticTarget : null,
    spiralLevel: sq.spiralLevel != null ? sq.spiralLevel : (sq.constraints && sq.constraints.spiralLevel != null ? sq.constraints.spiralLevel : null),
    errorType: sq.errorType != null ? sq.errorType : null,
    // V5.1.0 判断题教学闭环：解析随 answer.explanation 承载；错因为生成器写入的自由文本
    // （data.misconception 透传，与 error-model 固定 8 类 SSOT 无关）。缺失即 null。
    explanation: (sq.answer && sq.answer.explanation != null) ? sq.answer.explanation : null,
    misconception: (sq.data && sq.data.misconception != null) ? sq.data.misconception : null,
    // P32-AS-04：批改专用只读规格（判分唯一权威 answer-validator.gradeUserAnswer 消费）。
    answerSpec: buildAnswerSpec(sq, answerMode),
    // 保留语义引用（页面 read-aloud 判定 / 溯源复用）；实践会话 exerciseSet 依赖此字段。
    __semantic: sq
  };
}

function toRenderableQuestions(semanticQuestions) {
  if (!Array.isArray(semanticQuestions)) return [];
  return semanticQuestions.map(toRenderableQuestion);
}

module.exports = {
  toRenderableQuestion: toRenderableQuestion,
  toRenderableQuestions: toRenderableQuestions
};

};
__defs["shared/validator/answer-validator.js"] = function (module, exports, require) {

'use strict';

var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceString(v) { return v == null ? '' : String(v); }
function coerceNumber(v) { if (v == null) return null; var n = Number(v); return isNaN(n) ? null : n; }
function safeTrim(v) { return coerceString(v).trim(); }


function computeExpectedAnswer(prompt) {
  var expr = coerceString(prompt).replace(/[？?□_\s]/g, '').replace(/[×xX]/g, '*').replace(/[÷]/g, '/').replace(/[＝=]/g, '');
  if (!expr) return null;

  try {
    var tokens = tokenize(expr);
    var ast = parseExpression(tokens);
    var result = evaluate(ast);
    if (typeof result === 'number' && isFinite(result)) {
      // 整数保持整数，小数保留 2 位
      return Number.isInteger(result) ? String(result) : result.toFixed(2).replace(/\.?0+$/, '');
    }
    return String(result);
  } catch (e) {
    return null;
  }
}



function tokenize(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var ch = str[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%' || ch === '(' || ch === ')') {
      tokens.push({ type: 'op', value: ch });
      i++;
    } else if ((ch >= '0' && ch <= '9') || ch === '.') {
      var j = i;
      var hasDot = false;
      while (j < str.length) {
        var c = str[j];
        if (c >= '0' && c <= '9') { j++; }
        else if (c === '.' && !hasDot) { hasDot = true; j++; }
        else { break; }
      }
      var numStr = str.slice(i, j);
      // 避免单独的 "." 或 "123." 末尾点号（后者保留为整数部分）
      if (numStr === '.' || numStr.endsWith('.')) {
        // 单独的 "." 不是合法数字，交给后续报错
      }
      tokens.push({ type: 'num', value: numStr });
      i = j;
    } else {
      // 非法字符：标识符、函数、属性、逗号、其他
      throw new Error('Invalid character: ' + ch);
    }
  }
  tokens.push({ type: 'eof' });
  return tokens;
}

function createParser(tokens) {
  var index = 0;
  function peek() { return tokens[index]; }
  function consume() { return tokens[index++]; }
  function expect(type, value) {
    var t = peek();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error('Expected ' + type + (value ? ' ' + value : '') + ', got ' + JSON.stringify(t));
    }
    return consume();
  }

  function parseAddSub() {
    var left = parseMulDiv();
    while (true) {
      var t = peek();
      if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
        var op = consume().value;
        var right = parseMulDiv();
        left = { type: 'bin', op: op, left: left, right: right };
      } else break;
    }
    return left;
  }

  function parseMulDiv() {
    var left = parseUnary();
    while (true) {
      var t = peek();
      if (t.type === 'op' && (t.value === '*' || t.value === '/')) {
        var op = consume().value;
        var right = parseUnary();
        left = { type: 'bin', op: op, left: left, right: right };
      } else break;
    }
    return left;
  }

  function parseUnary() {
    var t = peek();
    if (t.type === 'op' && t.value === '-') {
      consume();
      var operand = parseUnary();
      return { type: 'unary', op: '-', operand: operand };
    }
    return parsePostfix();
  }

  function parsePostfix() {
    var node = parsePrimary();
    while (true) {
      var t = peek();
      if (t.type === 'op' && t.value === '%') {
        consume();
        node = { type: 'postfix', op: '%', operand: node };
      } else break;
    }
    return node;
  }

  function parsePrimary() {
    var t = peek();
    if (t.type === 'num') {
      consume();
      var v = t.value;
      if (v === '.') throw new Error('Invalid number: .');
      if (v.startsWith('.')) v = '0' + v;
      if (v.endsWith('.')) v = v.slice(0, -1);
      return { type: 'num', value: Number(v) };
    }
    if (t.type === 'op' && t.value === '(') {
      consume();
      var node = parseAddSub();
      expect('op', ')');
      return node;
    }
    throw new Error('Unexpected token: ' + JSON.stringify(t));
  }

  return { parse: parseAddSub, peek: peek };
}

function parseExpression(tokens) {
  var parser = createParser(tokens);
  var ast = parser.parse();
  // 确保所有 token 被消费（除 eof），防止 "3 + 4) * 5" 这类残留 token 被静默忽略
  var finalTok = parser.peek();
  if (finalTok && finalTok.type !== 'eof') {
    throw new Error('Unexpected trailing token: ' + JSON.stringify(finalTok));
  }
  return ast;
}

function evaluate(node) {
  switch (node.type) {
    case 'num': return node.value;
    case 'unary':
      if (node.op === '-') return -evaluate(node.operand);
      throw new Error('Unknown unary op: ' + node.op);
    case 'postfix':
      if (node.op === '%') return evaluate(node.operand) / 100;
      throw new Error('Unknown postfix op: ' + node.op);
    case 'bin':
      var l = evaluate(node.left);
      var r = evaluate(node.right);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/':
          if (r === 0) throw new Error('Division by zero');
          return l / r;
        default: throw new Error('Unknown binary op: ' + node.op);
      }
    default: throw new Error('Unknown AST node: ' + node.type);
  }
}


function validateNumericAnswer(answerObj, expected) {
  var errors = [];
  var warnings = [];
  var val = answerObj.value;
  var acceptable = Array.isArray(answerObj.acceptable) ? answerObj.acceptable : [];

  var candidates = [val].concat(acceptable).map(function (v) { return coerceString(v).trim(); }).filter(function (v) { return v !== ''; });
  var expectedStr = coerceString(expected).trim();

  var match = candidates.some(function (c) {
    // 数值比较（允许精度差异）
    var cn = coerceNumber(c);
    var en = coerceNumber(expectedStr);
    if (cn != null && en != null) {
      var precision = answerObj.precision != null ? answerObj.precision : 2;
      return Math.abs(cn - en) < Math.pow(10, -precision);
    }
    return c === expectedStr;
  });

  if (!match) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '答案不匹配：期望 ' + expectedStr + '，实际 ' + candidates.join('/'), SEVERITY.ERROR, { expected: expectedStr, actual: candidates }));
  }
  return { match: match, errors: errors, warnings: warnings };
}


function validateChoiceAnswer(answerObj, options) {
  var errors = [];
  var val = coerceString(answerObj.value);
  if (!val) {
    errors.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '选择题答案为空', SEVERITY.ERROR));
    return { match: false, errors: errors, warnings: [] };
  }
  var optStrs = options.map(function (o) { return coerceString(o).trim(); });
  if (optStrs.indexOf(val) === -1) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '答案 ' + val + ' 不在选项中', SEVERITY.ERROR, { answer: val, options: optStrs }));
    return { match: false, errors: errors, warnings: [] };
  }
  return { match: true, errors: [], warnings: [] };
}

// P32-AS-05/07：判断题布尔词表为全模块唯一 SSOT（质检 validateJudgeAnswer 与
// 运行时 gradeUserAnswer 共用），答案期望只从 answer.value 自证，不再 hardcode true。
var JUDGE_TRUE_SET = ['true', '对', '是', 'yes', 'y', 't', '1', '✓', '正确'];
var JUDGE_FALSE_SET = ['false', '错', '否', 'no', 'n', 'f', '0', '✗', '错误'];

// boolean / 布尔词 → true|false；无法识别 → null
function parseJudgeValue(v) {
  if (v === true) return true;
  if (v === false) return false;
  var s = coerceString(v).toLowerCase().trim();
  if (JUDGE_TRUE_SET.indexOf(s) !== -1) return true;
  if (JUDGE_FALSE_SET.indexOf(s) !== -1) return false;
  return null;
}


function validateJudgeAnswer(answerObj, expected) {
  var errors = [];
  var val = coerceString(answerObj.value).toLowerCase().trim();
  var parsed = parseJudgeValue(answerObj.value);
  if (parsed === null) {
    errors.push(createError(ERROR_CODES.ANSWER_TYPE_MISMATCH, 'answer.value', '判断题答案格式非法: ' + val, SEVERITY.ERROR));
    return { match: false, errors: errors, warnings: [] };
  }
  var match = parsed === expected;
  if (!match) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '判断题答案错误：期望 ' + (expected ? '对' : '错') + '，实际 ' + val, SEVERITY.ERROR));
  }
  return { match: match, errors: errors, warnings: [] };
}

// P32-AS-05：运行时批改归一化（判分唯一一处，口径等价旧 core.normalizeAns）：
// 去全部空白 → 余数记号（……/.../余）统一为「……」→ 小写。
function normalizeAnswerText(v) {
  return coerceString(v)
    .replace(/\s+/g, '')
    .replace(/(?:…+|\.{2,}|余)/g, '……')
    .toLowerCase();
}

// 答案标量候选：value + acceptable 中标量元素（嵌套数组等缺陷形态不参与判分）
function answerCandidates(answerSpec) {
  var out = [];
  function push(v) {
    var s = coerceString(v).trim();
    if (s !== '') out.push(s);
  }
  if (!answerSpec) return out;
  push(answerSpec.value);
  if (Array.isArray(answerSpec.acceptable)) {
    for (var i = 0; i < answerSpec.acceptable.length; i++) {
      if (typeof answerSpec.acceptable[i] === 'string' || typeof answerSpec.acceptable[i] === 'number') {
        push(answerSpec.acceptable[i]);
      }
    }
  }
  return out;
}

// P32-AS-13：classify 按 data.groups 做「组→项集合」顺序无关配对。
// 用户串可解析且集合完全一致 → true；确定错误（缺组/多项/错项/越界重复/多余标签）→ false；无法解析 → null（parentCheck）。
function gradeClassify(userRaw, groups) {
  if (!groups || typeof groups !== 'object') return null;
  var normItem = function (v) { return coerceString(v).replace(/\s+/g, ''); };
  var expected = Object.keys(groups).map(function (name) {
    return {
      name: normItem(name),
      items: new Set((Array.isArray(groups[name]) ? groups[name] : []).map(normItem))
    };
  }).filter(function (g) { return g.name !== ''; });
  if (!expected.length) return null;

  var parsed = {};
  var segs = coerceString(userRaw).split(/[;；\n]+/);
  for (var s = 0; s < segs.length; s++) {
    var seg = segs[s].trim();
    if (!seg) continue;
    var mi = seg.match(/^(.+?)[：:](.+)$/);
    if (!mi) return null;
    var name = normItem(mi[1]);
    if (Object.prototype.hasOwnProperty.call(parsed, name)) return false;
    parsed[name] = mi[2].split(/[、，,]/).map(normItem).filter(Boolean);
  }
  if (Object.keys(parsed).length !== expected.length) return false;

  var usedItems = new Set();
  for (var i = 0; i < expected.length; i++) {
    var got = parsed[expected[i].name];
    if (!got) return null;
    if (got.length !== expected[i].items.size) return false;
    for (var j = 0; j < got.length; j++) {
      if (!expected[i].items.has(got[j])) return false;
      if (usedItems.has(got[j])) return false;
      usedItems.add(got[j]);
    }
  }
  return true;
}


function gradeUserAnswer(userRaw, answerSpec, ctx) {
  if (!answerSpec || answerSpec.value == null || coerceString(answerSpec.value).trim() === '') return null;
  var qt = ctx && ctx.questionType ? ctx.questionType : null;
  var raw = coerceString(userRaw);
  if (!raw.trim()) return false;

  // judge：期望由 answer.value 自证
  if (qt === 'judge' || qt === 'true-false') {
    var expected = parseJudgeValue(answerSpec.value);
    if (expected === null) return null;
    var given = parseJudgeValue(raw.trim());
    return given === null ? false : given === expected;
  }

  // choice：与选项值精确匹配（归一化）
  if (qt === 'choice') {
    var targets = answerCandidates(answerSpec).map(normalizeAnswerText);
    return targets.indexOf(normalizeAnswerText(raw)) !== -1;
  }

  // classify：组→项集合顺序无关配对
  if (qt === 'classify') {
    return gradeClassify(raw, answerSpec.groups);
  }

  // none / read-aloud：无自动判分
  if (qt === 'none' || qt === 'read-aloud') return null;

  // P32-AS-14：apply / geometry 的边界——数值/短答可判子问自动判分；
  // 模型答案为长文本说理/作图/实操（「先…再说说…」「按实际测量…」「如…」类开放答案，
  // 逐字匹配必然误判）时不做自动判分，返回 null 走家长检查（parentCheck），
  // 禁止「非空即对」也禁止把开放题机械判错。判据：任一候选为纯数值（容差可判），
  // 或存在汉字数 ≤ 6 的短答候选（如「闰年」「红球」「2020年」）；否则 → null。
  if (qt === 'apply' || qt === 'geometry') {
    var autoGradeable = answerCandidates(answerSpec).some(function (c) {
      var cs = coerceString(c);
      if (coerceNumber(cs) != null) return true;
      return cs.replace(/[^\u4e00-\u9fa5]/g, '').length <= 6;
    });
    if (!autoGradeable) return null;
  }

  // calc / fill / geometry / apply（及其余文本/数值短答）：
  // 余数语义优先 → 数值容差 → 归一化文本白名单
  var cNorm = answerCandidates(answerSpec).map(normalizeAnswerText);
  var uNorm = normalizeAnswerText(raw);
  var prompt = ctx && ctx.prompt ? coerceString(ctx.prompt) : '';

  var hasRemainderExpected = cNorm.some(function (c) { return /^\d+……\d+$/.test(c); });
  var dm = prompt.match(/(\d+)\s*[÷/]\s*(\d+)/);
  var um = uNorm.match(/^(\d+)……(\d+)$/);
  if (hasRemainderExpected && um) {
    if (dm) {
      var a = parseInt(dm[1], 10), b = parseInt(dm[2], 10);
      if (!(b > 0)) return null;
      var q = parseInt(um[1], 10), r = parseInt(um[2], 10);
      if (r >= b) return false;
      return b * q + r === a;
    }
    // 题干无法解析除法结构时退回文本等价比较
    return cNorm.some(function (c) { return c === uNorm; });
  }

  var un = coerceNumber(raw.replace(/\s+/g, ''));
  if (un != null) {
    var precision = answerSpec.precision != null ? Number(answerSpec.precision) : 2;
    if (isNaN(precision)) precision = 2;
    var tolerance = Math.pow(10, -precision);
    for (var i = 0; i < cNorm.length; i++) {
      var cn = coerceNumber(cNorm[i]);
      if (cn != null && Math.abs(cn - un) < tolerance) return true;
    }
  }

  return cNorm.some(function (c) { return c === uNorm; });
}


function validateTextAnswer(answerObj, expected) {
  var errors = [];
  var val = coerceString(answerObj.value).toLowerCase().trim();
  var acceptable = Array.isArray(answerObj.acceptable) ? answerObj.acceptable.map(function (a) { return coerceString(a).toLowerCase().trim(); }) : [];
  var candidates = [val].concat(acceptable).filter(function (v) { return v !== ''; });
  var expList = Array.isArray(expected) ? expected : [expected];
  var expNorm = expList.map(function (e) { return coerceString(e).toLowerCase().trim(); });

  var match = candidates.some(function (c) { return expNorm.indexOf(c) !== -1; });
  if (!match) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '文本答案不匹配：期望 ' + expNorm.join('/') + '，实际 ' + candidates.join('/'), SEVERITY.ERROR));
  }
  return { match: match, errors: errors, warnings: [] };
}


function validateRemainderAnswer(answerObj, prompt) {
  var candidates = [answerObj && answerObj.value].concat(Array.isArray(answerObj && answerObj.acceptable) ? answerObj.acceptable : [])
    .map(function (v) { return coerceString(v).trim(); })
    .filter(function (v) { return v !== ''; });
  var remCandidates = candidates.filter(function (c) { return /^\d+\s*(?:…+|\.{3,}|余)\s*\d+$/.test(c); });
  if (!remCandidates.length) return null;
  var dm = coerceString(prompt).match(/(\d+)\s*[÷/]\s*(\d+)/);
  if (!dm) return null;
  var a = parseInt(dm[1], 10), b = parseInt(dm[2], 10);
  if (!(b > 0)) return false;
  return remCandidates.some(function (c) {
    var m = c.match(/^(\d+)\s*(?:…+|\.{3,}|余)\s*(\d+)$/);
    if (!m) return false;
    var q = parseInt(m[1], 10), r = parseInt(m[2], 10);
    return r >= 0 && r < b && b * q + r === a;
  });
}


function validateAnswer(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  if (!sq.answer || typeof sq.answer !== 'object') {
    errors.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer', '缺少 answer 对象', SEVERITY.ERROR));
    return { valid: false, errors: errors, warnings: warnings, info: info, score: 0, checks: { answer: 'fail' } };
  }

  var prompt = sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || '';
  var qType = sq.questionType || sq.type || 'calc';
  var answerObj = sq.answer;

  // 根据题型分派验证逻辑
  if (qType === 'choice' && sq.distractors) {
    var options = sq.distractors.map(function (d) { return d.value; });
    if (answerObj.value != null) options.push(coerceString(answerObj.value));
    var optUniq = options.filter(function (v, i, a) { return a.indexOf(v) === i; });
    var res = validateChoiceAnswer(answerObj, optUniq);
    errors.push.apply(errors, res.errors);
    warnings.push.apply(warnings, res.warnings);
  } else if (qType === 'judge' || qType === 'true-false') {
    // P32-AS-07：期望布尔只从 answer.value 自证（生成器契约：value 为布尔或布尔词），
    // 删除 hardcode true + 丢弃比对结果的假阳性 INFO。
    var expectedBool = parseJudgeValue(answerObj.value);
    if (expectedBool === null) {
      errors.push(createError(ERROR_CODES.ANSWER_TYPE_MISMATCH, 'answer.value',
        '判断题答案格式非法: ' + coerceString(answerObj.value), SEVERITY.ERROR));
    } else {
      var res2 = validateJudgeAnswer(answerObj, expectedBool);
      errors.push.apply(errors, res2.errors);
      warnings.push.apply(warnings, res2.warnings);
    }
  } else if (qType === 'fill' || qType === 'calc') {
    // 有余数除法（a ÷ b = q……r）：余数记号无法用表达式求值，走专用语义校验
    var remResult = validateRemainderAnswer(answerObj, prompt);
    if (remResult === true) {
      // 余数答案正确
    } else if (remResult === false) {
      errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '余数除法答案不正确（不满足 b×q+r=a 且 0≤r<b）', SEVERITY.ERROR));
    } else {
      // 计算/填空：尝试从题干自动计算期望答案
      var expected = computeExpectedAnswer(prompt);
      if (expected) {
        var res3 = validateNumericAnswer(answerObj, expected);
        errors.push.apply(errors, res3.errors);
        warnings.push.apply(warnings, res3.warnings);
      } else {
        // 无法自动计算，仅做非空校验
        if (answerObj.value == null && (!answerObj.acceptable || answerObj.acceptable.length === 0)) {
          errors.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '答案为空且无法自动校验', SEVERITY.ERROR));
        } else {
          info.push({ code: 'ANSWER_UNVERIFIED', field: 'answer', message: '题目类型 ' + qType + ' 无法自动验证，需人工核对', severity: 'INFO' });
        }
      }
    }
  } else {
    // 其他类型（apply, open, operate 等）仅做非空
    if (answerObj.value == null && (!answerObj.acceptable || answerObj.acceptable.length === 0)) {
      warnings.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '题型 ' + qType + ' 答案为空', SEVERITY.WARNING));
    }
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0.5, checks: { answer: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateAnswer: validateAnswer,
  gradeUserAnswer: gradeUserAnswer,
  parseJudgeValue: parseJudgeValue,
  normalizeAnswerText: normalizeAnswerText,
  computeExpectedAnswer: computeExpectedAnswer,
  validateNumericAnswer: validateNumericAnswer,
  validateRemainderAnswer: validateRemainderAnswer,
  validateChoiceAnswer: validateChoiceAnswer,
  validateJudgeAnswer: validateJudgeAnswer,
  validateTextAnswer: validateTextAnswer
};
};
__defs["shared/catalog/feature-flags.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var DEFAULT_FLAGS = {
    questionValidation: {
      enabled: true,
      mode: 'warn',      // 'off' | 'warn' | 'strict'
      maxRetries: 3,
      logLevel: 'info'   // 'debug' | 'info' | 'warn' | 'error'
    },
    // 后续可扩展
    generatorRetry: { enabled: true },
    batchValidation: { enabled: true },
    qualityScoring: { enabled: true }
  };

  var flags = Object.assign({}, DEFAULT_FLAGS);

  function getFlag(path) {
    var keys = path.split('.');
    var obj = flags;
    for (var i = 0; i < keys.length; i++) {
      if (obj == null) return undefined;
      obj = obj[keys[i]];
    }
    return obj;
  }

  function setFlag(path, value) {
    var keys = path.split('.');
    var obj = flags;
    for (var i = 0; i < keys.length - 1; i++) {
      if (obj[keys[i]] == null) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
  }

  function reset() {
    flags = Object.assign({}, DEFAULT_FLAGS);
  }

  function all() { return Object.assign({}, flags); }

  var API = {
    get: getFlag,
    set: setFlag,
    reset: reset,
    all: all,

    // 便捷方法
    isValidationEnabled: function () { return getFlag('questionValidation.enabled') === true; },
    getValidationMode: function () { return getFlag('questionValidation.mode') || 'warn'; },
    getMaxRetries: function () { return getFlag('questionValidation.maxRetries') || 3; },
    isStrictMode: function () { return getFlag('questionValidation.mode') === 'strict'; },
    isWarnMode: function () { return getFlag('questionValidation.mode') === 'warn'; },
    isOffMode: function () { return getFlag('questionValidation.mode') === 'off'; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.FeatureFlags = API;
  }
})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
};
__defs["shared/state/logger.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
  var currentLevel = LEVELS.INFO;
  var transports = [{ type: 'console', level: LEVELS.INFO }];

  function setLevel(level) { currentLevel = LEVELS[level.toUpperCase()] || LEVELS.INFO; }
  function addTransport(t) { transports.push(t); }

  function format(msg, meta) {
    var base = { timestamp: new Date().toISOString(), level: msg.level, message: msg.message };
    return Object.assign(base, meta || {});
  }

  function log(level, message, meta) {
    if (LEVELS[level] < currentLevel) return;
    var entry = format({ level: level, message: message }, meta);
    transports.forEach(function (t) {
      if (LEVELS[t.level] <= LEVELS[level]) {
        if (t.type === 'console') console[level.toLowerCase()](JSON.stringify(entry));
        else if (t.type === 'file' && t.path) {
          try { require("fs").appendFileSync(t.path, JSON.stringify(entry) + '\n'); } catch (e) {  }
        } else if (t.type === 'remote' && t.url) {
          try { fetch(t.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }); } catch (e) {  }
        }
      }
    });
  }

  // 专用：题目验证日志
  function logQuestionValidation(data) {
    var required = ['questionId', 'knowledgePointId', 'generator', 'generatorVersion', 'seed'];
    var missing = required.filter(function (k) { return !data[k]; });
    if (missing.length) console.warn('[Logger] questionValidation 缺少字段: ' + missing.join(', '));

    log('info', 'question_validation', {
      questionId: data.questionId,
      knowledgePointId: data.knowledgePointId,
      generator: data.generator,
      generatorVersion: data.generatorVersion,
      seed: data.seed,
      retryCount: data.retryCount || 0,
      validationResult: data.validationResult, // 'pass' | 'fail' | 'retry' | 'fatal'
      errorCodes: data.errorCodes || [],
      score: data.score,
      planId: data.planId,
      questionType: data.questionType,
      difficulty: data.difficulty
    });
  }

  // 专用：生成重试日志
  function logGenerationRetry(data) {
    log('warn', 'generation_retry', {
      generator: data.generator,
      attempt: data.attempt,
      maxRetries: data.maxRetries,
      seed: data.seed,
      errorCodes: data.errorCodes || [],
      planId: data.planId
    });
  }

  // 专用：批量验证日志
  function logBatchValidation(data) {
    log('info', 'batch_validation', {
      planId: data.planId,
      totalQuestions: data.total,
      passed: data.passed,
      passRate: data.passRate,
      errorSummary: data.errorSummary,
      qualityAvg: data.qualityAvg
    });
  }

  // P5-R03：生产指标记录
  function logGenerationMetrics(data) {
    log('info', 'generation_metrics', data);
  }

  function logValidationMetrics(data) {
    log('info', 'validation_metrics', data);
  }

  function logRetryMetrics(data) {
    log('info', 'retry_metrics', data);
  }

  function logDuplicateMetrics(data) {
    log('info', 'duplicate_metrics', data);
  }

  function logRenderMetrics(data) {
    log('info', 'render_metrics', data);
  }

  var API = {
    LEVELS: LEVELS,
    setLevel: setLevel,
    addTransport: addTransport,
    log: log,
    logQuestionValidation: logQuestionValidation,
    logGenerationRetry: logGenerationRetry,
    logBatchValidation: logBatchValidation,
    logGenerationMetrics: logGenerationMetrics,
    logValidationMetrics: logValidationMetrics,
    logRetryMetrics: logRetryMetrics,
    logDuplicateMetrics: logDuplicateMetrics,
    logRenderMetrics: logRenderMetrics,
    debug: function (m, meta) { log('DEBUG', m, meta); },
    info: function (m, meta) { log('INFO', m, meta); },
    warn: function (m, meta) { log('WARN', m, meta); },
    error: function (m, meta) { log('ERROR', m, meta); }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.Logger = API;
  }
})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
};
__defs["shared/state/metrics.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var metrics = {
    generation: {
      total: 0,
      success: 0,
      failed: 0,
      byGenerator: {},
      bySubject: {},
      byGrade: {}
    },
    validation: {
      total: 0,
      passed: 0,
      failed: 0,
      errorsByCode: {},
      byGenerator: {},
      bySubject: {}
    },
    retry: {
      totalAttempts: 0,
      totalRetries: 0,
      maxRetriesHit: 0,
      retriesByGenerator: {},
      retriesByErrorCode: {}
    },
    duplicate: {
      totalQuestions: 0,
      duplicatesFound: 0,
      byGenerator: {}
    },
    render: {
      total: 0,
      success: 0,
      failed: 0,
      errorsByType: {}
    }
  };

  function reset() {
    metrics.generation = { total: 0, success: 0, failed: 0, byGenerator: {}, bySubject: {}, byGrade: {} };
    metrics.validation = { total: 0, passed: 0, failed: 0, errorsByCode: {}, byGenerator: {}, bySubject: {} };
    metrics.retry = { totalAttempts: 0, totalRetries: 0, maxRetriesHit: 0, retriesByGenerator: {}, retriesByErrorCode: {} };
    metrics.duplicate = { totalQuestions: 0, duplicatesFound: 0, byGenerator: {} };
    metrics.render = { total: 0, success: 0, failed: 0, errorsByType: {} };
  }

  // ---- Generation Metrics ----
  function recordGenerationStart(data) {
    metrics.generation.total++;
    var key = data.generator || 'unknown';
    metrics.generation.byGenerator[key] = (metrics.generation.byGenerator[key] || 0) + 1;
    if (data.subject) metrics.generation.bySubject[data.subject] = (metrics.generation.bySubject[data.subject] || 0) + 1;
    if (data.grade) metrics.generation.byGrade[data.grade] = (metrics.generation.byGrade[data.grade] || 0) + 1;
  }

  function recordGenerationSuccess(data) {
    metrics.generation.success++;
  }

  function recordGenerationFailure(data) {
    metrics.generation.failed++;
  }

  // ---- Validation Metrics ----
  function recordValidationResult(data) {
    metrics.validation.total++;
    if (data.valid) {
      metrics.validation.passed++;
    } else {
      metrics.validation.failed++;
      (data.errors || []).forEach(function (e) {
        metrics.validation.errorsByCode[e.code] = (metrics.validation.errorsByCode[e.code] || 0) + 1;
      });
    }
    if (data.generator) {
      metrics.validation.byGenerator[data.generator] = (metrics.validation.byGenerator[data.generator] || { total: 0, passed: 0, failed: 0 });
      metrics.validation.byGenerator[data.generator].total++;
      if (data.valid) metrics.validation.byGenerator[data.generator].passed++; else metrics.validation.byGenerator[data.generator].failed++;
    }
    if (data.subject) {
      metrics.validation.bySubject[data.subject] = (metrics.validation.bySubject[data.subject] || { total: 0, passed: 0, failed: 0 });
      metrics.validation.bySubject[data.subject].total++;
      if (data.valid) metrics.validation.bySubject[data.subject].passed++; else metrics.validation.bySubject[data.subject].failed++;
    }
  }

  // ---- Retry Metrics ----
  function recordRetryAttempt(data) {
    metrics.retry.totalAttempts++;
    metrics.retry.totalRetries += (data.retries || 0);
    if (data.retries >= (data.maxRetries || 3)) metrics.retry.maxRetriesHit++;
    if (data.generator) {
      metrics.retry.retriesByGenerator[data.generator] = (metrics.retry.retriesByGenerator[data.generator] || 0) + (data.retries || 0);
    }
    (data.errorCodes || []).forEach(function (code) {
      metrics.retry.retriesByErrorCode[code] = (metrics.retry.retriesByErrorCode[code] || 0) + 1;
    });
  }

  // ---- Duplicate Metrics ----
  function recordDuplicateCheck(data) {
    metrics.duplicate.totalQuestions += (data.totalQuestions || 0);
    metrics.duplicate.duplicatesFound += (data.duplicatesFound || 0);
    if (data.generator) {
      metrics.duplicate.byGenerator[data.generator] = (metrics.duplicate.byGenerator[data.generator] || { total: 0, duplicates: 0 });
      metrics.duplicate.byGenerator[data.generator].total += (data.totalQuestions || 0);
      metrics.duplicate.byGenerator[data.generator].duplicates += (data.duplicatesFound || 0);
    }
  }

  // ---- Render Metrics ----
  function recordRenderResult(data) {
    metrics.render.total++;
    if (data.success) {
      metrics.render.success++;
    } else {
      metrics.render.failed++;
      if (data.errorType) metrics.render.errorsByType[data.errorType] = (metrics.render.errorsByType[data.errorType] || 0) + 1;
    }
  }

  // ---- Summary / Export ----
  function getSummary() {
    var gen = metrics.generation;
    var val = metrics.validation;
    var ret = metrics.retry;
    var dup = metrics.duplicate;
    var ren = metrics.render;

    return {
      generation: {
        total: gen.total,
        successRate: gen.total ? gen.success / gen.total : 0,
        failureRate: gen.total ? gen.failed / gen.total : 0,
        byGenerator: gen.byGenerator,
        bySubject: gen.bySubject,
        byGrade: gen.byGrade
      },
      validation: {
        total: val.total,
        passRate: val.total ? val.passed / val.total : 0,
        failureRate: val.total ? val.failed / val.total : 0,
        topErrors: Object.entries(val.errorsByCode).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10),
        byGenerator: val.byGenerator,
        bySubject: val.bySubject
      },
      retry: {
        totalAttempts: ret.totalAttempts,
        avgRetries: ret.totalAttempts ? ret.totalRetries / ret.totalAttempts : 0,
        maxRetriesHit: ret.maxRetriesHit,
        byGenerator: ret.retriesByGenerator,
        topErrorCodes: Object.entries(ret.retriesByErrorCode).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10)
      },
      duplicate: {
        totalQuestions: dup.totalQuestions,
        duplicatesFound: dup.duplicatesFound,
        duplicateRate: dup.totalQuestions ? dup.duplicatesFound / dup.totalQuestions : 0,
        byGenerator: dup.byGenerator
      },
      render: {
        total: ren.total,
        successRate: ren.total ? ren.success / ren.total : 0,
        failureRate: ren.total ? ren.failed / ren.total : 0,
        errorsByType: ren.errorsByType
      },
      timestamp: new Date().toISOString()
    };
  }

  function exportJSON() {
    return JSON.stringify(getSummary(), null, 2);
  }

  var API = {
    reset: reset,
    recordGenerationStart: recordGenerationStart,
    recordGenerationSuccess: recordGenerationSuccess,
    recordGenerationFailure: recordGenerationFailure,
    recordValidationResult: recordValidationResult,
    recordRetryAttempt: recordRetryAttempt,
    recordDuplicateCheck: recordDuplicateCheck,
    recordRenderResult: recordRenderResult,
    getSummary: getSummary,
    exportJSON: exportJSON,
    // 直接访问原始计数器（仅开发调试用）
    _internal: metrics
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.Metrics = API;
  }
})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
};
__defs["shared/validator/question-validator.js"] = function (module, exports, require) {

'use strict';

var Schema = require("shared/schemas/semantic-question.schema.js");
var ERROR_CODES = Schema.ERROR_CODES;
var SEVERITY = Schema.SEVERITY;

function createError(code, field, message, severity, detail) {
  return { code: code, field: field, message: message, severity: severity || SEVERITY.ERROR, detail: detail };
}


function validateSchemaOnly(sq) {
  return require("shared/semantic/semantic-question.js").validateSchema(sq);
}


function noopValidator(sq, context) {
  return { valid: true, errors: [], warnings: [], info: [], score: 1, checks: {} };
}


function combineResults(results) {
  var allErrors = [];
  var allWarnings = [];
  var allInfo = [];
  var scores = [];
  var checks = {};

  results.forEach(function (r) {
    if (r.errors) allErrors.push.apply(allErrors, r.errors);
    if (r.warnings) allWarnings.push.apply(allWarnings, r.warnings);
    if (r.info) allInfo.push.apply(allInfo, r.info);
    if (typeof r.score === 'number') scores.push(r.score);
    if (r.checks) Object.assign(checks, r.checks);
  });

  var valid = allErrors.length === 0;
  var score = scores.length ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length : 1;

  return { valid: valid, errors: allErrors, warnings: allWarnings, info: allInfo, score: score, checks: checks };
}


function validate(question, context) {
  context = context || {};

  // 1. Schema 校验
  var schemaResult = validateSchemaOnly(question);
  if (!schemaResult.valid) {
    return combineResults([schemaResult]);
  }

  // 2. 后续各专项验证器将在 Pipeline 中串联
  // 此处预留接口，返回 Schema 校验结果
  return combineResults([schemaResult]);
}


function validateBatch(questions, context) {
  if (!Array.isArray(questions)) return [];
  return questions.map(function (q) { return validate(q, context); });
}


function isRetryableError(code) {
  var retryable = [
    ERROR_CODES.ANSWER_MISMATCH,
    ERROR_CODES.DUPLICATE_QUESTION,
    ERROR_CODES.DIFFICULTY_MISMATCH,
    ERROR_CODES.GRAPHIC_INVALID,
    ERROR_CODES.DISTRACTOR_DUPLICATE,
    ERROR_CODES.DISTRACTOR_EQUALS_ANSWER,
    ERROR_CODES.DISTRACTOR_OUT_OF_DOMAIN,
    ERROR_CODES.STRUCTURE_INVALID,
    ERROR_CODES.STEPS_EXCEED,
    ERROR_CODES.OPERATIONS_VIOLATION
  ];
  return retryable.indexOf(code) !== -1;
}


function isFatalError(code) {
  var fatal = [
    ERROR_CODES.SCHEMA_INVALID,
    ERROR_CODES.REQUIRED_FIELD_MISSING,
    ERROR_CODES.KP_MISSING,
    ERROR_CODES.KP_MISMATCH,
    ERROR_CODES.GENERATOR_NOT_FOUND
  ];
  return fatal.indexOf(code) !== -1;
}

module.exports = {
  validate: validate,
  validateBatch: validateBatch,
  validateSchemaOnly: validateSchemaOnly,
  combineResults: combineResults,
  createError: createError,
  isRetryableError: isRetryableError,
  isFatalError: isFatalError,
  ERROR_CODES: ERROR_CODES,
  SEVERITY: SEVERITY
};
};
__defs["shared/validator/validation-pipeline.js"] = function (module, exports, require) {

'use strict';

var Validator = require("shared/validator/question-validator.js");
var Schema = require("shared/schemas/semantic-question.schema.js");
var answerValidator = require("shared/validator/answer-validator.js");
var difficultyValidator = require("shared/validator/difficulty-validator.js");
var duplicateValidator = require("shared/validator/duplicate-validator.js");
var kpCoverageValidator = require("shared/validator/kp-coverage-validator.js");
var compositeValidator = require("shared/validator/composite-validator.js");
var difficultyIntegrityValidator = require("shared/validator/difficulty-integrity-validator.js");
var duplicateIntegrityValidator = require("shared/validator/duplicate-integrity-validator.js");
var kpSemanticValidator = require("shared/validator/kp-semantic-validator.js");

var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;

// M11-R04: 分层验证器（Layer 1 必须通过才继续 Layer 2，以此类推）
// Layer 1: 关键结构（Schema + Answer + KP Coverage）
// Layer 2: 结构完整性 + 难度基础 + KP 语义一致性
// Layer 3: 完整性校验（Composite + DifficultyIntegrity + DuplicateIntegrity）
// Layer 4: 去重（Duplicate）
var PIPELINE_LAYERS = [
  {
    name: 'layer1-critical',
    steps: [
      { name: 'schema', fn: Validator.validateSchemaOnly, required: true },
      { name: 'answer', fn: answerValidator.validateAnswer, required: true },
      { name: 'kpCoverage', fn: kpCoverageValidator.validateKpCoverage, required: true }
    ],
    stopOnFailure: true  // Layer 1 任一失败即停止
  },
  {
    name: 'layer2-structure',
    steps: [
      { name: 'difficulty', fn: difficultyValidator.validateDifficulty, required: false },
      { name: 'composite', fn: compositeValidator.validateComposite, required: false },
      // P0-05 Step 21-28: KP 语义验证（7 层）
      { name: 'kpSemantic', fn: kpSemanticValidator.validateKpSemantics, required: false }
    ],
    stopOnFailure: false
  },
  {
    name: 'layer3-integrity',
    steps: [
      { name: 'difficultyIntegrity', fn: difficultyIntegrityValidator.validateDifficultyIntegrity, required: false },
      { name: 'duplicateIntegrity', fn: duplicateIntegrityValidator.validateDuplicateIntegrity, required: false }
    ],
    stopOnFailure: false
  },
  {
    name: 'layer4-duplicate',
    steps: [
      { name: 'duplicate', fn: duplicateValidator.validateDuplicate, required: false }
    ],
    stopOnFailure: false
  }
];

// 兼容旧 API：展平为 PIPELINE_STEPS
var PIPELINE_STEPS = [];
PIPELINE_LAYERS.forEach(function (layer) {
  layer.steps.forEach(function (s) { PIPELINE_STEPS.push(s); });
});

// 批次级验证器（在 runPipelineBatch 后可选调用）
var BATCH_VALIDATORS = [
  { name: 'kpCoverage', fn: kpCoverageValidator.validateBatchKpCoverage },
  { name: 'composite', fn: compositeValidator.validateBatchComposite },
  { name: 'difficultyIntegrity', fn: difficultyIntegrityValidator.validateBatchDifficultyIntegrity },
  { name: 'duplicateIntegrity', fn: duplicateIntegrityValidator.validateBatchDuplicateIntegrity }
];


function runPipeline(sq, context) {
  context = context || {};
  var allErrors = [];
  var allWarnings = [];
  var allInfo = [];
  var scores = [];
  var checks = {};
  var seenKeys = context.seenKeys || new Set();

  // P28-16: 显式分层标签（Generation vs Semantic，禁止 PASS = PASS + WARN）
  //   Generation 面 = Layer 1（schema / answer / kpCoverage）
  //   Semantic  面 = Layer 2/3/4（difficulty / composite / kpSemantic / integrity / duplicate）
  var genErrors = [];
  var semErrors = [];
  var semWarnings = [];

  for (var li = 0; li < PIPELINE_LAYERS.length; li++) {
    var layer = PIPELINE_LAYERS[li];
    var layerHasErrors = false;
    var isGenLayer = (layer.name === 'layer1-critical');

    for (var si = 0; si < layer.steps.length; si++) {
      var step = layer.steps[si];
      var fn = step.fn;
      var stepContext = Object.assign({}, context, { seenKeys: seenKeys });

      var result;
      try {
        result = fn(sq, stepContext);
      } catch (e) {
        var err = require("shared/validator/question-validator.js").createError(
          'VALIDATOR_EXCEPTION', step.name, '验证器异常: ' + e.message, 'ERROR', { stack: e.stack });
        result = { valid: false, errors: [err], warnings: [], info: [], score: 0, checks: {} };
      }

      // 累积结果
      if (result.errors) {
        allErrors.push.apply(allErrors, result.errors);
        if (isGenLayer) genErrors.push.apply(genErrors, result.errors);
        else semErrors.push.apply(semErrors, result.errors);
      }
      if (result.warnings) {
        allWarnings.push.apply(allWarnings, result.warnings);
        if (!isGenLayer) semWarnings.push.apply(semWarnings, result.warnings);
      }
      if (result.info) allInfo.push.apply(allInfo, result.info);
      if (typeof result.score === 'number') scores.push(result.score);
      if (result.checks) Object.assign(checks, result.checks);

      // 更新 seenKeys（用于 duplicate validator）
      if (result.seenKeys) seenKeys = result.seenKeys;

      // 关键验证器失败且 required=true → 标记层失败
      if (step.required && (!result.valid || (result.errors && result.errors.length))) {
        layerHasErrors = true;
      }
    }

    // Layer 1 失败即停止整个管道（M11-R04: 分层短路）
    if (layer.stopOnFailure && layerHasErrors) {
      break;
    }
  }

  var valid = allErrors.length === 0;
  var score = scores.length ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length : 1;

  // P28-16: 四类显式标签（Generation 与 Semantic 分别统计，PASS 不含 WARN）
  var generationPass = genErrors.length === 0;
  var semanticFail = semErrors.length > 0;
  var semanticWarn = !semanticFail && semWarnings.length > 0;
  var semanticPass = !semanticFail && semWarnings.length === 0;

  return {
    valid: valid,
    errors: allErrors,
    warnings: allWarnings,
    info: allInfo,
    score: score,
    checks: checks,
    // P28-16 显式分类标签
    generationPass: generationPass,
    semanticPass: semanticPass,
    semanticWarn: semanticWarn,
    semanticFail: semanticFail
  };
}


function runPipelineBatch(questions, context) {
  context = context || {};
  var seenKeys = context.seenKeys || new Set();
  var results = [];

  questions.forEach(function (sq, idx) {
    var stepContext = Object.assign({}, context, { index: idx, seenKeys: seenKeys });
    var result = runPipeline(sq, stepContext);
    results.push(result);
    if (result.seenKeys) seenKeys = result.seenKeys;
  });

  return results;
}


function runBatchValidators(questions, context) {
  context = context || {};
  var allErrors = [];
  var allWarnings = [];
  var allInfo = [];
  var scores = [];
  var checks = {};

  BATCH_VALIDATORS.forEach(function (step) {
    var result;
    try {
      result = step.fn(questions, context);
    } catch (e) {
      var err = require("shared/validator/question-validator.js").createError(
        'VALIDATOR_EXCEPTION', step.name, '批次验证器异常: ' + e.message, 'ERROR', { stack: e.stack });
      result = { valid: false, errors: [err], warnings: [], info: [], score: 0, checks: {} };
    }

    if (result.errors) allErrors.push.apply(allErrors, result.errors);
    if (result.warnings) allWarnings.push.apply(allWarnings, result.warnings);
    if (result.info) allInfo.push.apply(allInfo, result.info);
    if (typeof result.score === 'number') scores.push(result.score);
    if (result.checks) Object.assign(checks, result.checks);
  });

  var valid = allErrors.length === 0;
  var score = scores.length ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length : 1;

  // P28-16: 批次级验证器均属 Semantic 面（kpCoverage/composite/integrity）
  var semanticFail = allErrors.length > 0;
  var semanticWarn = !semanticFail && allWarnings.length > 0;
  var semanticPass = !semanticFail && allWarnings.length === 0;

  return {
    valid: valid, errors: allErrors, warnings: allWarnings, info: allInfo, score: score, checks: checks,
    generationPass: true,
    semanticPass: semanticPass,
    semanticWarn: semanticWarn,
    semanticFail: semanticFail
  };
}


module.exports = {
  runPipeline: runPipeline,
  runPipelineBatch: runPipelineBatch,
  runBatchValidators: runBatchValidators,
  PIPELINE_STEPS: PIPELINE_STEPS,
  BATCH_VALIDATORS: BATCH_VALIDATORS
};
};
__defs["shared/knowledge/question-id.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");

var ID_PREFIX = 'q';
var SEED_DELIMITER = '|';
var SEED_PART_DELIMITER = ':';
var SEED_COUNTER = 0;


function generateQuestionId(seed, context) {
  var rng = Rng.createSeededRandom(seed);
  var parts = [ID_PREFIX];

  // 基于 seed+context 的短哈希（确定性）
  var ctxStr = '';
  if (context) {
    ctxStr = (context.generatorId || '') + SEED_DELIMITER +
             (context.index != null ? context.index : '') + SEED_DELIMITER +
             (context.knowledgePointId || '') + SEED_DELIMITER +
             (context.difficulty != null ? context.difficulty : '') + SEED_DELIMITER +
             (context.questionType || '');
  }
  var hash = Rng.hashSeed(String(seed) + ctxStr);
  parts.push(hash.toString(36));

  // 可选：时间戳前缀（便于排序/调试，不影响确定性）
  // parts.unshift(Date.now().toString(36));

  return parts.join('_');
}


function deriveSeed(baseSeed, generatorId, index) {
  var cleanBase = String(baseSeed || 'auto').replace(/\|/g, '-');
  var cleanGen = String(generatorId).replace(/\|/g, '-');
  return [cleanBase, cleanGen, index].join(SEED_DELIMITER);
}


function generateSeedsForPlan(plan) {
  var base = plan.seed || 'plan-' + Date.now();
  var genId = plan.generatorId || 'unknown';
  var count = plan.count || 1;
  var seeds = [];
  for (var i = 0; i < count; i++) {
    seeds.push(deriveSeed(base, genId, i));
  }
  return seeds;
}


function parseSeed(seedStr) {
  if (!seedStr) return { base: null, generatorId: null, index: null, raw: null };
  var parts = seedStr.split(SEED_DELIMITER);
  if (parts.length >= 3) {
    return {
      base: parts[0],
      generatorId: parts[1],
      index: parseInt(parts[2], 10),
      raw: seedStr
    };
  }
  return { base: seedStr, generatorId: null, index: null, raw: seedStr };
}


function generateBaseSeed(seed) {
  if (seed != null) return String(seed);
  // 兜底：时间+单调计数器（仅用于无种子场景，生产应始终显式传 seed；不使用 Math.random）
  SEED_COUNTER = (SEED_COUNTER || 0) + 1;
  return 'auto-' + Date.now().toString(36) + '-' + SEED_COUNTER.toString(36);
}


function normalizeVersion(v) {
  if (typeof v === 'string' && /^\d+\.\d+\.\d+/.test(v)) return v;
  var n = parseInt(v, 10);
  if (!isNaN(n)) return n + '.0.0';
  return '1.0.0';
}


function createMetadata(opts) {
  opts = opts || {};
  return {
    generator: opts.generatorId || null,
    generatorVersion: normalizeVersion(opts.generatorVersion),
    seed: opts.seed || null,
    planId: opts.planId || null,
    timestamp: opts.timestamp || new Date().toISOString(),
    retryCount: opts.retryCount || 0,
    validationScore: null,
    tags: opts.tags || []
  };
}

module.exports = {
  generateQuestionId: generateQuestionId,
  deriveSeed: deriveSeed,
  generateSeedsForPlan: generateSeedsForPlan,
  parseSeed: parseSeed,
  generateBaseSeed: generateBaseSeed,
  normalizeVersion: normalizeVersion,
  createMetadata: createMetadata,
  Rng: Rng  // 导出底层 PRNG 供高级用法
};
};
__defs["shared/validator/duplicate-validator.js"] = function (module, exports, require) {

'use strict';

var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceString(v) { return v == null ? '' : String(v); }
function sortObj(o) { return JSON.stringify(o, Object.keys(o).sort()); }

// 全角数字 → 半角
function toHalfWidth(str) {
  return String(str == null ? '' : str).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
}

// 提取操作数：优先 data.operands（语义层原始数字），缺省回退 prompt 解析
function extractOperands(sq) {
  var data = sq && sq.data;
  if (Array.isArray(data && data.operands) && data.operands.length) {
    return data.operands.map(function (n) { return parseInt(n, 10); }).filter(function (n) { return !isNaN(n); });
  }
  var half = toHalfWidth(sq.prompt || (sq.content && sq.content.prompt) || '');
  return (half.match(/\d+/g) || []).map(function (n) { return parseInt(n, 10); }).filter(function (n) { return !isNaN(n); });
}

// 提取运算符集合（排序归一，忽略顺序，同式异写同指纹）
// 族标签（题组级混合标记，不代表该题实例的运算符）必须剔除，
// 否则 data.operation='mixed' 时 10−6 与 10+6 被错误并为同一指纹。
var FAMILY_OP_LABELS = { mixed: true, combined: true, combine: true, mix: true, composite: true };
function extractOperators(sq) {
  var ops = [];
  var data = sq && sq.data;
  var opSeeds = [];
  if (data && data.operation) opSeeds.push(data.operation);
  if (Array.isArray(data && data.operators)) opSeeds.push.apply(opSeeds, data.operators);
  opSeeds.forEach(function (op) {
    if (typeof op === 'string') {
      var v = op.toLowerCase();
      if (!FAMILY_OP_LABELS[v]) ops.push(v);
    } else if (op && typeof op.symbol === 'string' && !FAMILY_OP_LABELS[String(op.symbol).toLowerCase()]) {
      ops.push(op.symbol);
    }
  });
  if (ops.length) return ops;

  var half = toHalfWidth(sq.prompt || (sq.content && sq.content.prompt) || '');
  return (half.replace(/[＋－]/g, function (c) { return c === '＋' ? '+' : '-'; })
    .match(/[+\-×÷*/−]/g) || []).map(function (o) {
    return o === '−' ? '-' : o;
  });
}

// 结构特征：steps / mode / operators 集合 / 括号等
function extractStructureKey(sq) {
  var parts = [];
  var data = sq && sq.data;
  var dp = sq && sq.difficultyParams;
  parts.push(coerceString(data && data.steps));
  parts.push(coerceString(data && data.mode));
  parts.push(coerceString(data && data.operation));
  if (Array.isArray(data && data.operators)) parts.push(coerceString(data.operators.join(',')));
  if (dp) {
    if (dp.steps != null) parts.push('s' + dp.steps);
    if (dp.allowBracket != null) parts.push('b' + (dp.allowBracket ? 1 : 0));
  }
  return parts.join('|');
}


// 题面内容指纹（归一化哈希）：用于无数值操作数的语义/应用题，
// 使其不同题面（不同统计收集对象、不同应用题叙述）产生不同指纹，
// 避免「同 KP 同题型」退化为同指纹导致去重误判为重复、容量塌缩为 1。
function promptHash(sq) {
  var p = coerceString(sq.prompt || (sq.content && sq.content.prompt) || '');
  p = p.replace(/\s+/g, '').replace(/[，。、？！：；,.?!:;（）()'"'""'']/g, '');
  var h = 5381;
  for (var i = 0; i < p.length; i++) h = ((h << 5) + h + p.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function buildQuestionFingerprint(sq) {
  var parts = [];
  parts.push('v2');
  parts.push(coerceString(sq.knowledgePoint));
  parts.push(coerceString(sq.questionType || sq.type));
  var ops = extractOperators(sq).sort();
  var operands = extractOperands(sq).sort(function (a, b) { return a - b; });
  parts.push(ops.join(','));
  parts.push(operands.join(','));
  parts.push(extractStructureKey(sq));
  parts.push(coerceString(sq.content && sq.content.context));
  parts.push(coerceString(sq.content && sq.content.format));
  // R6：语义型题型（应用/几何/判断/分类/开放/辨识）题面即为内容，原指纹忽略题面文字
  // 会导致不同设问/不同统计对象被误判为重复、容量塌缩为 1。补齐题面内容指纹。
  // 计算类题型（calc/fill 等）维持 operand 排序归一（同式异写=同指纹）语义，不附加题面哈希。
  // fill/choice 无操作数时为语义题（认图/概念/统计/方位），无 operand 可区分，
  // 须附加题面哈希；有操作数时维持 operand 归一语义不变。
  var SEMANTIC_TYPES = { apply: 1, geometry: 1, judge: 1, classify: 1, open: 1, recognize: 1 };
  var qt = sq.questionType || sq.type;
  var hasOperands = operands.length > 0;
  if (SEMANTIC_TYPES[qt] || ((qt === 'fill' || qt === 'choice') && !hasOperands)) {
    parts.push('ph:' + promptHash(sq));
  }
  return parts.join('|');
}

function buildCanonicalKey(sq) {
  var parts = [];
  parts.push(coerceString(sq.knowledgePoint));
  parts.push(coerceString(sq.questionType || sq.type));
  parts.push(coerceString(sq.question && sq.question.operation));

  // 操作数（排序后）：全角→半角归一，parseInt 去前导零
  var half = toHalfWidth(sq.prompt || (sq.content && sq.content.prompt) || '');
  var nums = (half.match(/\d+/g) || []).map(function (n) { return parseInt(n, 10); }).sort(function (a, b) { return a - b; });
  parts.push(nums.join(','));

  // 结构特征（全角×÷−＋ 归一为半角，同式异写同指纹）
  var ops = (half.replace(/[＋－]/g, function (c) { return c === '＋' ? '+' : '-'; })
    .match(/[+\-×÷*/−]/g) || []).map(function (o) {
    return o === '−' ? '-' : o;
  }).sort().join('');
  parts.push(ops);

  // format/context
  parts.push(coerceString(sq.content && sq.content.context));
  parts.push(coerceString(sq.content && sq.content.format));

  return parts.join('|');
}

// 数学内容指纹：去掉 KP 维度，仅保留 题型|运算符|操作数(排序)|结构|context|format。
// 用于「同一份练习跨知识点」去重——不同 KP 产出同一道算术（如 3+2=）视为重复，
// 避免混合知识点练习中出现「同数学题换知识点」的视觉重复。
function buildMathFingerprint(sq) {
  var parts = buildQuestionFingerprint(sq).split('|');
  parts.splice(1, 1); // 去掉 knowledgePoint 维度
  return parts.join('|');
}

function validateDuplicate(sq, context) {
  var errors = [];
  var warnings = [];
  var info = [];

  context = context || {};
  var seenKeys = context.seenKeys || new Set();
  var mathSeenKeys = context.mathSeenKeys || null; // 应为 Map<mathFingerprint, knowledgePoint>
  // 权威去重键：语义指纹 v2（含 KP，用于跨代/跨练习去重，与 retry-loop 同一键空间）；
  // mathSeenKeys：数学内容指纹（去 KP）→ 仅当「不同知识点」产出同一道数学时才判重，
  // 避免混合知识点练习出现「同数学题换知识点」的视觉重复；同一知识点内部不去重（保留原 full-fp 行为）。
  var key = sq.questionFingerprint || buildQuestionFingerprint(sq);
  if (!sq.questionFingerprint) sq.questionFingerprint = key;
  var mathKey = buildMathFingerprint(sq);
  var qkp = sq.knowledgePoint || (sq.knowledgePointIds && sq.knowledgePointIds[0]) || '';
  var diagKey = buildCanonicalKey(sq);

  var isDup = false;
  var dupMsg = '';
  if (seenKeys.has(key)) {
    isDup = true;
    dupMsg = '重复题目(含知识点): ' + key;
  } else if (mathSeenKeys && mathSeenKeys.get(mathKey) !== undefined && mathSeenKeys.get(mathKey) !== qkp) {
    isDup = true;
    dupMsg = '跨知识点同数学重复: ' + mathKey;
  }

  if (isDup) {
    errors.push(createError(ERROR_CODES.DUPLICATE_QUESTION, 'questionFingerprint', dupMsg, SEVERITY.ERROR, { questionFingerprint: key, mathFingerprint: mathKey, canonicalKey: diagKey }));
  } else {
    seenKeys.add(key);
    if (mathSeenKeys) mathSeenKeys.set(mathKey, qkp);
    info.push({ code: 'UNIQUE', field: 'questionFingerprint', message: '题目唯一: ' + key, severity: 'INFO', canonicalKey: diagKey });
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    info: info,
    score: errors.length === 0 ? 1 : 0,
    checks: { duplicate: errors.length === 0 ? 'pass' : 'fail' },
    seenKeys: seenKeys // 返回更新后的集合供后续题目使用
  };
}

function validateBatchDuplicate(questions, context) {
  context = context || {};
  var seenKeys = context.seenKeys || new Set();
  var mathSeenKeys = context.mathSeenKeys || null; // 应为 Map<mathFingerprint, knowledgePoint>
  var results = questions.map(function (sq) {
    var key = sq.questionFingerprint || buildQuestionFingerprint(sq);
    if (!sq.questionFingerprint) sq.questionFingerprint = key;
    var mathKey = buildMathFingerprint(sq);
    var qkp = sq.knowledgePoint || (sq.knowledgePointIds && sq.knowledgePointIds[0]) || '';
    var diagKey = buildCanonicalKey(sq);
    var errors = [];
    var warnings = [];
    var isDup = seenKeys.has(key) || (mathSeenKeys && mathSeenKeys.get(mathKey) !== undefined && mathSeenKeys.get(mathKey) !== qkp);
    if (isDup) {
      errors.push(createError('DUPLICATE_QUESTION', 'questionFingerprint', '重复题目: ' + key, 'ERROR', { questionFingerprint: key, mathFingerprint: mathKey, canonicalKey: diagKey }));
    } else {
      seenKeys.add(key);
      if (mathSeenKeys) mathSeenKeys.set(mathKey, qkp);
    }
    return { valid: errors.length === 0, errors: errors, warnings: warnings, info: [], score: errors.length === 0 ? 1 : 0, checks: { duplicate: errors.length === 0 ? 'pass' : 'fail' } };
  });
  return { results: results, seenKeys: seenKeys };
}

module.exports = {
  validateDuplicate: validateDuplicate,
  validateBatchDuplicate: validateBatchDuplicate,
  buildCanonicalKey: buildCanonicalKey,
  buildQuestionFingerprint: buildQuestionFingerprint,
  buildMathFingerprint: buildMathFingerprint,
  extractOperands: extractOperands,
  extractOperators: extractOperators,
  extractStructureKey: extractStructureKey
};
};
__defs["shared/schemas/semantic-question.schema.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var VERSION = 1;

  // 题型枚举 SSOT：引用 question-type-registry.js 的 canonical 7 类（双环境兼容）
  var QuestionTypeRegistry = (typeof require === 'function')
    ? (function () { try { return require("shared/knowledge/question-type-registry.js"); } catch (e) { return null; } })()
    : (global.QuestionTypeRegistry || null);

  // ====== 题型枚举（与 KnowledgePoint / QuestionTypeRegistry 兼容）======
  var QUESTION_TYPES = (QuestionTypeRegistry && QuestionTypeRegistry.all)
    ? QuestionTypeRegistry.all().map(function (t) { return t.id; })
    : ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];

  // ====== 难度档位 ======
  var DIFFICULTY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // ====== 认知层级 ======
  var COGNITIVE_LEVELS = ['了解', '认识', '理解', '掌握', '运用'];

  // ====== 答案模式 ======
  var ANSWER_MODES = ['input', 'choice', 'multi', 'none', 'read-aloud'];

  // ====== 答案形态布局（P28-FORM-CONTRACT-01：生成器声明、渲染器消费，非题干字符串判定）======
  // inline-after-equals：横向算式作答框内联到等号后（题干以「= ?」结尾）
  // block：作答框独立成行（缺省/未声明时回落）
  var RESPONSE_LAYOUTS = ['inline-after-equals', 'block'];

  // ====== 图形类型 ======
  var GRAPHIC_TYPES = [
    'geometry',   // 几何图形
    'chart',      // 统计图表
    'diagram',    // 示意图
    'currency',   // 人民币/货币
    'number-line', // 数轴
    'grid',       // 网格/方格
    'custom'      // 自定义
  ];

  // ====== 图形子类型 ======
  var GRAPHIC_SUBTYPES = {
    geometry: ['triangle', 'rectangle', 'circle', 'polygon', 'angle', 'line', 'point', 'position-grid'],
    chart: ['bar', 'line', 'pie', 'scatter'],
    diagram: ['flow', 'tree', 'venn', 'mindmap', 'brace', 'segment', 'balance', 'scale'],
    currency: ['rmb'],
    'number-line': ['integer', 'fraction', 'decimal'],
    grid: ['dot', 'square', 'isometric'],
    custom: []
  };

  // ====== 干扰项错误类型分类 ======
  var DISTRACTOR_ERROR_TYPES = [
    '口诀混淆',
    '计算错误',
    '进位错误',
    '退位错误',
    '概念混淆',
    '单位混淆',
    '顺序错误',
    '符号错误',
    '估算偏差',
    '逻辑跳跃'
  ];

  // ====== 验证错误码 ======
  var ERROR_CODES = {
    // Schema 类
    SCHEMA_INVALID: 'SCHEMA_INVALID',
    REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
    FIELD_TYPE_MISMATCH: 'FIELD_TYPE_MISMATCH',
    ENUM_VALUE_INVALID: 'ENUM_VALUE_INVALID',

    // KnowledgePoint 类
    KP_MISSING: 'KP_MISSING',
    KP_MISMATCH: 'KP_MISMATCH',
    KP_OPERATION_INVALID: 'KP_OPERATION_INVALID',
    KP_FORMAT_INVALID: 'KP_FORMAT_INVALID',
    KP_COGNITIVE_INVALID: 'KP_COGNITIVE_INVALID',
    KP_CONTEXT_INVALID: 'KP_CONTEXT_INVALID',
    KP_GRAPHIC_INVALID: 'KP_GRAPHIC_INVALID',

    // Answer 类
    ANSWER_INVALID: 'ANSWER_INVALID',
    ANSWER_MISMATCH: 'ANSWER_MISMATCH',
    ANSWER_TYPE_MISMATCH: 'ANSWER_TYPE_MISMATCH',
    ANSWER_OUT_OF_DOMAIN: 'ANSWER_OUT_OF_DOMAIN',

    // Distractor 类
    DISTRACTOR_COUNT_INVALID: 'DISTRACTOR_COUNT_INVALID',
    DISTRACTOR_DUPLICATE: 'DISTRACTOR_DUPLICATE',
    DISTRACTOR_EQUALS_ANSWER: 'DISTRACTOR_EQUALS_ANSWER',
    DISTRACTOR_TYPE_MISMATCH: 'DISTRACTOR_TYPE_MISMATCH',
    DISTRACTOR_OUT_OF_DOMAIN: 'DISTRACTOR_OUT_OF_DOMAIN',
    DISTRACTOR_ERROR_TYPE_INVALID: 'DISTRACTOR_ERROR_TYPE_INVALID',

    // Structure 类
    STRUCTURE_INVALID: 'STRUCTURE_INVALID',
    STEPS_EXCEED: 'STEPS_EXCEED',
    BRACKETS_VIOLATION: 'BRACKETS_VIOLATION',
    OPERATIONS_VIOLATION: 'OPERATIONS_VIOLATION',
    OPERAND_COUNT_INVALID: 'OPERAND_COUNT_INVALID',
    OPERAND_RANGE_INVALID: 'OPERAND_RANGE_INVALID',

    // Difficulty 类
    DIFFICULTY_MISMATCH: 'DIFFICULTY_MISMATCH',
    DIFFICULTY_OUT_OF_RANGE: 'DIFFICULTY_OUT_OF_RANGE',

    // Duplicate 类
    DUPLICATE_QUESTION: 'DUPLICATE_QUESTION',

    // KP Coverage 类
    KP_COVERAGE_INSUFFICIENT: 'KP_COVERAGE_INSUFFICIENT',
    KP_COVERAGE_MISSING: 'KP_COVERAGE_MISSING',

    // Composite Integrity 类
    COMPOSITE_INVALID: 'COMPOSITE_INVALID',
    COMPOSITE_STRUCTURE_MISMATCH: 'COMPOSITE_STRUCTURE_MISMATCH',
    COMPOSITE_OPERATOR_MISMATCH: 'COMPOSITE_OPERATOR_MISMATCH',
    COMPOSITE_STEPS_MISMATCH: 'COMPOSITE_STEPS_MISMATCH',
    // P0-07 Step 33: Composite 无可用 Generator 时显式失败
    COMPOSITE_UNSUPPORTED: 'COMPOSITE_UNSUPPORTED',

    // Difficulty Integrity 类
    DIFFICULTY_INTEGRITY_VIOLATION: 'DIFFICULTY_INTEGRITY_VIOLATION',
    DIFFICULTY_CONSTRAINT_MISMATCH: 'DIFFICULTY_CONSTRAINT_MISMATCH',
    DIFFICULTY_STRUCTURE_DRIFT: 'DIFFICULTY_STRUCTURE_DRIFT',

    // Duplicate Integrity 类
    DUPLICATE_INTEGRITY_VIOLATION: 'DUPLICATE_INTEGRITY_VIOLATION',
    DUPLICATE_FINGERPRINT_MISMATCH: 'DUPLICATE_FINGERPRINT_MISMATCH',

    // Graphic 类
    GRAPHIC_INVALID: 'GRAPHIC_INVALID',
    GRAPHIC_TYPE_UNREGISTERED: 'GRAPHIC_TYPE_UNREGISTERED',
    GRAPHIC_PARAMS_INCOMPLETE: 'GRAPHIC_PARAMS_INCOMPLETE',
    GRAPHIC_RENDERER_MISSING: 'GRAPHIC_RENDERER_MISSING',

    // Render 类
    RENDER_PREFLIGHT_FAILED: 'RENDER_PREFLIGHT_FAILED',
    HTML_GENERATION_FAILED: 'HTML_GENERATION_FAILED',
    SVG_GENERATION_FAILED: 'SVG_GENERATION_FAILED',
    PRINT_GENERATION_FAILED: 'PRINT_GENERATION_FAILED',

    // P0-05 KP 语义验证类
    KP_SEMANTIC_IDENTITY: 'KP_SEMANTIC_IDENTITY',
    KP_SEMANTIC_QUESTION_TYPE: 'KP_SEMANTIC_QUESTION_TYPE',
    KP_SEMANTIC_OPERATION: 'KP_SEMANTIC_OPERATION',
    KP_SEMANTIC_NUMERIC: 'KP_SEMANTIC_NUMERIC',
    KP_SEMANTIC_STRUCTURE: 'KP_SEMANTIC_STRUCTURE',
    KP_SEMANTIC_CONTENT: 'KP_SEMANTIC_CONTENT',
    KP_SEMANTIC_COMPOSITE: 'KP_SEMANTIC_COMPOSITE',

    // P25-04 Semantic Evidence（声明制证据验证）
    KP_SEMANTIC_EVIDENCE: 'KP_SEMANTIC_EVIDENCE',

    // P25-05 Intent×Evidence 一致性（跨家族矛盾）
    KP_SEMANTIC_INTENT_CONFLICT: 'KP_SEMANTIC_INTENT_CONFLICT',

    // P25-07 七题型教育契约（结构不变式违例）
    KP_TYPE_CONTRACT: 'KP_TYPE_CONTRACT',

    // P30-15 Intent Alignment（生成结果与 intent 机器字段对齐）
    KP_SEMANTIC_INTENT_ALIGNMENT: 'KP_SEMANTIC_INTENT_ALIGNMENT'
  };

  // ====== 严重级别 ======
  var SEVERITY = {
    ERROR: 'ERROR',     // 阻断：题目不可用
    WARNING: 'WARNING', // 警告：题目可用但有隐患
    INFO: 'INFO'        // 信息：仅记录
  };

  // ====== 默认值工厂 ======
  function defaultMetadata() {
    return {
      generator: null,           // generator id (e.g., 'generator:arithmetic-addition' or 'legacy:math-oral')
      generatorVersion: null,    // semantic version string (e.g., '1.0.0')
      seed: null,                // 种子（可复现）
      timestamp: null,           // ISO timestamp
      retryCount: 0,             // 重试次数
      validationScore: null,     // 质量评分
      tags: []                   // 标签
    };
  }

  function defaultGraphic() {
    return {
      type: null,
      subtype: null,
      params: {},
      renderHints: {}
    };
  }

  function defaultContent() {
    return {
      prompt: '',           // 题干文本（纯文本，无 HTML/SVG）
      stem: null,           // 题干结构化表示（可选）
      language: 'zh-CN',    // 语言
      readingLevel: null    // 阅读难度等级
    };
  }

  function defaultQuestion() {
    return {
      prompt: '',           // 题干（核心文本）
      hint: null,           // 提示
      answerMode: 'input',  // 答题模式
      expectedFormat: null  // 期望答案格式（如 'number', 'text', 'choice-index'）
    };
  }

  function defaultAnswer() {
    return {
      value: null,          // 正确答案值
      acceptable: [],       // 可接受的替代答案
      unit: null,           // 单位
      precision: null,      // 精度要求（小数位数等）
      explanation: null     // 解析
    };
  }

  function defaultDistractor() {
    return {
      value: null,
      errorType: null,      // DISTRACTOR_ERROR_TYPES 中的值
      weight: 1             // 权重（用于自适应选择）
    };
  }

  // ====== 公共 API ======
  var API = {
    VERSION: VERSION,
    QUESTION_TYPES: QUESTION_TYPES,
    DIFFICULTY_LEVELS: DIFFICULTY_LEVELS,
    COGNITIVE_LEVELS: COGNITIVE_LEVELS,
    ANSWER_MODES: ANSWER_MODES,
    RESPONSE_LAYOUTS: RESPONSE_LAYOUTS,
    GRAPHIC_TYPES: GRAPHIC_TYPES,
    GRAPHIC_SUBTYPES: GRAPHIC_SUBTYPES,
    DISTRACTOR_ERROR_TYPES: DISTRACTOR_ERROR_TYPES,
    ERROR_CODES: ERROR_CODES,
    SEVERITY: SEVERITY,
    defaultMetadata: defaultMetadata,
    defaultGraphic: defaultGraphic,
    defaultContent: defaultContent,
    defaultQuestion: defaultQuestion,
    defaultAnswer: defaultAnswer,
    defaultDistractor: defaultDistractor,

    // 类型检查器
    isValidQuestionType: function (t) {
      if (QUESTION_TYPES.indexOf(t) !== -1) return true;
      if (QuestionTypeRegistry && typeof QuestionTypeRegistry.normalizeQuestionType === 'function') {
        var n = QuestionTypeRegistry.normalizeQuestionType(t);
        // 拒绝启发式兜底（未知题型被误归并为 canonical），仅接受显式/精确别名
        if (n && n.confidence !== 'heuristic' && n.id && QUESTION_TYPES.indexOf(n.id) !== -1) return true;
      }
      return false;
    },
    isValidDifficulty: function (d) { return DIFFICULTY_LEVELS.indexOf(d) !== -1; },
    isValidCognitiveLevel: function (c) { return COGNITIVE_LEVELS.indexOf(c) !== -1; },
    isValidAnswerMode: function (m) { return ANSWER_MODES.indexOf(m) !== -1; },
    isValidResponseLayout: function (l) { return RESPONSE_LAYOUTS.indexOf(l) !== -1; },
    isValidGraphicType: function (t) { return GRAPHIC_TYPES.indexOf(t) !== -1; },
    isValidGraphicSubtype: function (type, subtype) {
      var list = GRAPHIC_SUBTYPES[type];
      return list && list.indexOf(subtype) !== -1;
    },
    isValidDistractorErrorType: function (e) { return DISTRACTOR_ERROR_TYPES.indexOf(e) !== -1; },
    isValidSeverity: function (s) { return SEVERITY[s] != null; }
  };

  // 模块导出
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else if (global) {
    global.SemanticQuestionSchema = API;
  }
})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
};
__defs["shared/validator/difficulty-validator.js"] = function (module, exports, require) {

'use strict';

var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }
function coerceNumber(v) { var n = Number(v); return isNaN(n) ? null : n; }

function computeActualDifficulty(sq) {
  // 简易难度估算：基于操作数大小、运算符复杂度、步数
  var prompt = sq.prompt || '';
  var ops = (prompt.match(/[+\-×÷*/]/g) || []).length;
  var nums = (prompt.match(/\d+/g) || []).map(Number);
  var maxNum = nums.length ? Math.max.apply(null, nums) : 0;
  var steps = (prompt.match(/[+\-×÷*/]/g) || []).length + 1;

  var diff = 1;
  diff += Math.min(3, Math.floor(maxNum / 20));     // 最大数贡献
  diff += Math.min(2, Math.floor(ops / 2));         // 运算符复杂度
  diff += Math.min(2, Math.max(0, steps - 2));      // 步数
  return Math.min(10, Math.max(1, diff));
}

function validateDifficulty(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  var target = coerceInteger(sq.difficulty);
  var params = sq.difficultyParams || sq.constraints || {};

  if (target == null) {
    warnings.push({ code: 'DIFFICULTY_MISSING', field: 'difficulty', message: '题目缺少 difficulty 字段', severity: 'WARNING' });
    return { valid: true, errors: [], warnings: warnings, info: [], score: 0.8, checks: { difficulty: 'warn' } };
  }

  // ① targetDifficulty 在合法范围
  if (target < 1 || target > 10) {
    errors.push(createError(ERROR_CODES.DIFFICULTY_OUT_OF_RANGE, 'difficulty', 'difficulty 超出范围(1-10): ' + target, SEVERITY.ERROR));
  }

  // ② 实际难度估算与目标对比
  // 说明：computeActualDifficulty 是基于 prompt 的粗粒度启发式估算，并非权威难度。
  // 权威难度由 Generator/Strategy 产出（Generator 已按 plan.difficulty 消费约束）。
  // 因此启发式估算与目标不一致时按 WARNING + 质量分惩罚处理，仅作软性交叉校验，
  // 不硬性判为 ERROR（避免对合法生成结果产生误报并拖垮全量扫描通过率）。
  var actual = computeActualDifficulty(sq);
  var tolerance = params.difficultyTolerance != null ? params.difficultyTolerance : 1; // 默认 ±1
  var minAccept = target - tolerance;
  var maxAccept = target + tolerance;

  if (actual < minAccept || actual > maxAccept) {
    warnings.push(createError(ERROR_CODES.DIFFICULTY_MISMATCH, 'difficulty', '启发式实际难度(' + actual + ') 超出目标范围 [' + minAccept + ', ' + maxAccept + '] (目标 ' + target + ')', SEVERITY.WARNING, { target: target, actual: actual, tolerance: tolerance }));
  } else {
    info.push({ code: 'DIFFICULTY_OK', field: 'difficulty', message: '难度匹配: 目标 ' + target + ', 实际 ' + actual, severity: 'INFO' });
  }

  // ③ numberRange 一致性
  if (params.numberRange) {
    var range = params.numberRange;
    if (typeof range.min === 'number' && typeof range.max === 'number') {
      // 可结合 structure-validator 的 operand range 检查，此处仅记录
      info.push({ code: 'NUMBER_RANGE', field: 'difficultyParams.numberRange', message: '数值范围 [' + range.min + ', ' + range.max + ']', severity: 'INFO' });
    }
  }

  // ④ spiralLevel / cognitiveLevel 一致性
  var spiralLevel = coerceInteger(params.spiralLevel);
  if (spiralLevel != null && target != null) {
    var expectedSpiral = Math.ceil(target / 2);
    if (Math.abs(spiralLevel - expectedSpiral) > 1) {
      warnings.push({ code: 'SPIRAL_MISMATCH', field: 'difficultyParams.spiralLevel', message: 'spiralLevel(' + spiralLevel + ') 与 difficulty(' + target + ') 不匹配', severity: 'WARNING' });
    }
  }

  var hasWarning = warnings.length > 0;
  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? (hasWarning ? 0.8 : 1) : 0.5, checks: { difficulty: valid ? (hasWarning ? 'warn' : 'pass') : 'fail' } };
}

module.exports = {
  validateDifficulty: validateDifficulty,
  computeActualDifficulty: computeActualDifficulty
};
};
__defs["shared/validator/kp-coverage-validator.js"] = function (module, exports, require) {
'use strict';



var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;


function validateKpCoverage(sq, context) {
  context = context || {};
  var errors = [];
  var warnings = [];
  var info = [];

  var requiredKpIds = context.requiredKpIds || [];
  if (!requiredKpIds.length) {
    // 无显式要求，跳过
    return { valid: true, errors: [], warnings: [], info: [], score: 1, checks: { kpCoverage: 'skipped' } };
  }

  var kpId = sq.knowledgePoint || sq.knowledgePointId;
  var covered = requiredKpIds.indexOf(kpId) !== -1;

  if (!covered) {
    errors.push(createError(ERROR_CODES.KP_COVERAGE_MISSING, 'knowledgePoint', '题目未覆盖要求的知识点: ' + kpId + ' ∉ ' + requiredKpIds.join(','), SEVERITY.ERROR, { requiredKpIds: requiredKpIds, actualKpId: kpId }));
  } else {
    info.push({ code: 'KP_COVERED', field: 'knowledgePoint', message: '覆盖目标知识点: ' + kpId, severity: 'INFO' });
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    info: info,
    score: errors.length === 0 ? 1 : 0,
    checks: { kpCoverage: errors.length === 0 ? 'pass' : 'fail' }
  };
}


function validateBatchKpCoverage(questions, context) {
  context = context || {};
  var requiredKpIds = context.requiredKpIds || [];
  if (!requiredKpIds.length) {
    return { valid: true, errors: [], warnings: [], info: [], score: 1, checks: { kpCoverage: 'skipped' } };
  }

  var coveredKpIds = new Set();
  questions.forEach(function (sq) {
    var kpId = sq.knowledgePoint || sq.knowledgePointId;
    if (kpId) coveredKpIds.add(kpId);
  });

  var missing = requiredKpIds.filter(function (id) { return !coveredKpIds.has(id); });
  var errors = [];
  var warnings = [];
  var info = [];

  if (missing.length) {
    errors.push(createError(ERROR_CODES.KP_COVERAGE_INSUFFICIENT, 'batch', '批次未覆盖全部要求知识点，缺失: ' + missing.join(','), SEVERITY.ERROR, { requiredKpIds: requiredKpIds, coveredKpIds: Array.from(coveredKpIds), missingKpIds: missing }));
  } else {
    info.push({ code: 'KP_COVERAGE_COMPLETE', field: 'batch', message: '批次完整覆盖所有要求知识点: ' + requiredKpIds.join(','), severity: 'INFO' });
  }

  var score = missing.length === 0 ? 1 : Math.max(0, 1 - missing.length / requiredKpIds.length);
  return {
    valid: missing.length === 0,
    errors: errors,
    warnings: warnings,
    info: info,
    score: score,
    checks: { kpCoverage: missing.length === 0 ? 'pass' : 'fail' }
  };
}

module.exports = {
  validateKpCoverage: validateKpCoverage,
  validateBatchKpCoverage: validateBatchKpCoverage
};
};
__defs["shared/validator/composite-validator.js"] = function (module, exports, require) {
'use strict';



var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }

function validateComposite(sq, context) {
  context = context || {};
  var errors = [];
  var warnings = [];
  var info = [];

  var params = sq.difficultyParams || sq.constraints || {};
  var data = sq.data || {};
  var plan = context.plan || {};

  // 1) 步数一致性
  var expectedSteps = coerceInteger(params.exactSteps || params.maxSteps || data.steps);
  var actualSteps = coerceInteger(data.steps);
  if (expectedSteps != null && actualSteps != null && expectedSteps !== actualSteps) {
    errors.push(createError(ERROR_CODES.COMPOSITE_STEPS_MISMATCH, 'data.steps', '步数不匹配: 期望 ' + expectedSteps + ', 实际 ' + actualSteps, SEVERITY.ERROR, { expected: expectedSteps, actual: actualSteps }));
  }

  // 2) 运算符集合一致性
  var expectedOps = params.operation || data.operators || [];
  if (!Array.isArray(expectedOps) && typeof expectedOps === 'string') expectedOps = [expectedOps];
  var actualOps = data.operators || [];
  if (!Array.isArray(actualOps) && typeof actualOps === 'string') actualOps = [actualOps];
  if (expectedOps.length && actualOps.length) {
    var expectedSet = new Set(expectedOps.map(String).map(function (s) { return s.toLowerCase(); }));
    var actualSet = new Set(actualOps.map(String).map(function (s) { return s.toLowerCase(); }));
    var missing = Array.from(expectedSet).filter(function (o) { return !actualSet.has(o); });
    var extra = Array.from(actualSet).filter(function (o) { return !expectedSet.has(o); });
    if (missing.length) {
      errors.push(createError(ERROR_CODES.COMPOSITE_OPERATOR_MISMATCH, 'data.operators', '缺少要求的运算符: ' + missing.join(','), SEVERITY.ERROR, { expected: Array.from(expectedSet), actual: Array.from(actualSet), missing: missing }));
    }
    if (extra.length) {
      warnings.push({ code: 'COMPOSITE_EXTRA_OPERATOR', field: 'data.operators', message: '包含额外运算符: ' + extra.join(','), severity: 'WARNING', detail: { expected: Array.from(expectedSet), actual: Array.from(actualSet), extra: extra } });
    }
  }

  // 3) 括号一致性
  var expectedBracket = params.allowBracket === true || data.allowBracket === true;
  var hasBracket = data.hasBracket === true || /[()（）]/.test(sq.prompt || '');
  if (expectedBracket && !hasBracket) {
    warnings.push({ code: 'COMPOSITE_BRACKET_MISSING', field: 'structure', message: '要求括号但题干未含括号', severity: 'WARNING', detail: { expectedBracket: expectedBracket, hasBracket: hasBracket } });
  } else if (!expectedBracket && hasBracket) {
    warnings.push({ code: 'COMPOSITE_BRACKET_UNEXPECTED', field: 'structure', message: '未要求括号但题干含括号', severity: 'WARNING', detail: { expectedBracket: expectedBracket, hasBracket: hasBracket } });
  }

  // 4) 逆运算/填空模式一致性
  if (data.mode === 'inverse' || data.inverse === true) {
    var inverseOps = actualOps.filter(function (o) { return ['inverse', 'reverse', 'unknown', '求被加数', '求减数', '求乘数', '求除数'].indexOf(String(o).toLowerCase()) !== -1; });
    if (inverseOps.length === 0 && actualOps.length > 0) {
      // 启发式：逆运算题目通常包含运算符但提问方式为求运算数
      info.push({ code: 'COMPOSITE_INVERSE_MODE', field: 'data.mode', message: '检测到逆运算模式', severity: 'INFO', detail: { mode: data.mode, inverse: data.inverse } });
    }
  }

  // 5) 结构族一致性
  var expectedFamily = params.structure && params.structure.family;
  if (expectedFamily) {
    var actualFamily = data.structure && data.structure.family;
    if (actualFamily && expectedFamily !== actualFamily) {
      errors.push(createError(ERROR_CODES.COMPOSITE_STRUCTURE_MISMATCH, 'data.structure.family', '结构族不匹配: 期望 ' + expectedFamily + ', 实际 ' + actualFamily, SEVERITY.ERROR, { expected: expectedFamily, actual: actualFamily }));
    }
  }

  var valid = errors.length === 0;
  var hasWarning = warnings.length > 0;

  return {
    valid: valid,
    errors: errors,
    warnings: warnings,
    info: info,
    score: valid ? (hasWarning ? 0.8 : 1) : 0.5,
    checks: { composite: valid ? (hasWarning ? 'warn' : 'pass') : 'fail' }
  };
}


function validateBatchComposite(questions, context) {
  var errors = [];
  var warnings = [];
  var info = [];

  var compositeTypes = {};
  questions.forEach(function (sq) {
    var data = sq.data || {};
    var type = data.mode || (data.structure && data.structure.family) || 'simple';
    compositeTypes[type] = (compositeTypes[type] || 0) + 1;
  });

  info.push({ code: 'COMPOSITE_DISTRIBUTION', field: 'batch', message: '复合题类型分布: ' + JSON.stringify(compositeTypes), severity: 'INFO' });

  return { valid: true, errors: errors, warnings: warnings, info: info, score: 1, checks: { composite: 'pass' } };
}

module.exports = {
  validateComposite: validateComposite,
  validateBatchComposite: validateBatchComposite
};
};
__defs["shared/validator/difficulty-integrity-validator.js"] = function (module, exports, require) {
'use strict';



var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

var Difficulty = require("shared/catalog/difficulty.js");

function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }

function validateDifficultyIntegrity(sq, context) {
  context = context || {};
  var errors = [];
  var warnings = [];
  var info = [];

  var targetDifficulty = coerceInteger(sq.difficulty);
  var params = sq.difficultyParams || sq.constraints || {};
  var structure = params; // constraints 结构

  if (targetDifficulty == null) {
    // 缺少 difficulty 时在 difficulty-validator 中已处理，这里不重复报错
    return { valid: true, errors: [], warnings: [], info: [], score: 0.8, checks: { difficultyIntegrity: 'skipped' } };
  }

  // 1) difficulty 值与 constraints.difficulty 一致（若存在）
  if (params.difficulty != null) {
    var cDiff = coerceInteger(params.difficulty);
    if (cDiff !== targetDifficulty) {
      errors.push(createError(ERROR_CODES.DIFFICULTY_INTEGRITY_VIOLATION, 'difficulty', 'difficulty(' + targetDifficulty + ') 与 constraints.difficulty(' + cDiff + ') 不一致', SEVERITY.ERROR, { target: targetDifficulty, constraint: cDiff }));
    }
  }

  // 2) numberRange 与 difficultyToStructure 期望范围一致
  var diffStruct = Difficulty.difficultyToStructure(targetDifficulty);
  var maxOperand = Difficulty.paramsFor('math', targetDifficulty).maxOperand || Difficulty.DifficultyProfiles?.math?.toParams?.(targetDifficulty)?.maxOperand;

  if (params.numberRange) {
    var range = params.numberRange;
    if (typeof range.max === 'number') {
      var expectedMax = maxOperand || diffStruct.maxOperand;
      if (expectedMax && Math.abs(range.max - expectedMax) > Math.max(2, expectedMax * 0.1)) {
        warnings.push({ code: 'DIFFICULTY_NUMBER_RANGE_DRIFT', field: 'difficultyParams.numberRange', message: '数值范围 max(' + range.max + ') 偏离 difficulty(' + targetDifficulty + ') 期望 ' + expectedMax, severity: 'WARNING', detail: { range: range, expectedMax: expectedMax } });
      }
    }
  }

  // 3) 结构约束严格对应 difficultyToStructure
  if (params.maxSteps != null) {
    var cSteps = coerceInteger(params.maxSteps);
    if (cSteps !== diffStruct.steps) {
      errors.push(createError(ERROR_CODES.DIFFICULTY_STRUCTURE_DRIFT, 'difficultyParams.maxSteps', 'maxSteps(' + cSteps + ') 不匹配 difficulty(' + targetDifficulty + ') 标准 ' + diffStruct.steps, SEVERITY.ERROR, { actual: cSteps, expected: diffStruct.steps, difficulty: targetDifficulty }));
    }
  }
  if (params.allowBracket != null) {
    var cBracket = !!params.allowBracket;
    if (cBracket !== diffStruct.allowBracket) {
      errors.push(createError(ERROR_CODES.DIFFICULTY_CONSTRAINT_MISMATCH, 'difficultyParams.allowBracket', 'allowBracket(' + cBracket + ') 不匹配 difficulty(' + targetDifficulty + ') 标准 ' + diffStruct.allowBracket, SEVERITY.ERROR, { actual: cBracket, expected: diffStruct.allowBracket, difficulty: targetDifficulty }));
    }
  }
  if (params.allowMultDiv != null) {
    var cMultDiv = !!params.allowMultDiv;
    if (cMultDiv !== diffStruct.allowMultDiv) {
      errors.push(createError(ERROR_CODES.DIFFICULTY_CONSTRAINT_MISMATCH, 'difficultyParams.allowMultDiv', 'allowMultDiv(' + cMultDiv + ') 不匹配 difficulty(' + targetDifficulty + ') 标准 ' + diffStruct.allowMultDiv, SEVERITY.ERROR, { actual: cMultDiv, expected: diffStruct.allowMultDiv, difficulty: targetDifficulty }));
    }
  }

  // 4) spiralLevel 与 difficulty 期望区间一致
  var spiralLevel = coerceInteger(params.spiralLevel);
  if (spiralLevel != null) {
    var expectedSpiral = Math.ceil(targetDifficulty / 2);
    if (Math.abs(spiralLevel - expectedSpiral) > 1) {
      errors.push(createError(ERROR_CODES.DIFFICULTY_INTEGRITY_VIOLATION, 'difficultyParams.spiralLevel', 'spiralLevel(' + spiralLevel + ') 与 difficulty(' + targetDifficulty + ') 期望 ' + expectedSpiral + ' ±1 不符', SEVERITY.ERROR, { spiralLevel: spiralLevel, difficulty: targetDifficulty, expected: expectedSpiral }));
    }
  }

  // 5) cognitiveLevel 与 difficulty 期望映射
  var cognitiveLevel = (sq.cognitiveLevel || sq.constraints?.cognitiveLevel || '').toLowerCase();
  if (cognitiveLevel) {
    var diffCogExpect = targetDifficulty <= 3 ? 'recognize' : targetDifficulty <= 7 ? 'understand' : 'apply';
    if (cognitiveLevel !== diffCogExpect) {
      warnings.push({ code: 'DIFFICULTY_COGNITIVE_DRIFT', field: 'cognitiveLevel', message: 'cognitiveLevel(' + cognitiveLevel + ') 偏离 difficulty(' + targetDifficulty + ') 期望 ' + diffCogExpect, severity: 'WARNING', detail: { cognitiveLevel: cognitiveLevel, difficulty: targetDifficulty, expected: diffCogExpect } });
    }
  }

  // 6) contextType 与 difficulty 期望映射
  var contextType = sq.contextType || params.contextType || sq.content?.context;
  if (contextType) {
    var diffCtxExpect = targetDifficulty <= 3 ? ['pure', 'simple'] : targetDifficulty <= 6 ? ['simple', 'standard'] : ['standard', 'complex'];
    if (diffCtxExpect.indexOf(contextType) === -1) {
      warnings.push({ code: 'DIFFICULTY_CONTEXT_DRIFT', field: 'contextType', message: 'contextType(' + contextType + ') 不在 difficulty(' + targetDifficulty + ') 期望 ' + diffCtxExpect.join(','), severity: 'WARNING', detail: { contextType: contextType, difficulty: targetDifficulty, expected: diffCtxExpect } });
    }
  }

  var valid = errors.length === 0;
  var hasWarning = warnings.length > 0;

  return {
    valid: valid,
    errors: errors,
    warnings: warnings,
    info: info,
    score: valid ? (hasWarning ? 0.8 : 1) : 0.5,
    checks: { difficultyIntegrity: valid ? (hasWarning ? 'warn' : 'pass') : 'fail' }
  };
}

function validateBatchDifficultyIntegrity(questions, context) {
  // 批次级：统计难度分布、一致性通过率
  var errors = [];
  var warnings = [];
  var info = [];

  var diffDist = {};
  var consistent = 0;
  var total = 0;
  questions.forEach(function (sq) {
    var d = coerceInteger(sq.difficulty);
    if (d != null) {
      diffDist[d] = (diffDist[d] || 0) + 1;
      total++;
      // 简单检查：steps/bracket/multDiv 与 difficultyToStructure
      var diffStruct = Difficulty.difficultyToStructure(d);
      var params = sq.difficultyParams || sq.constraints || {};
      var ok = (!params.maxSteps || coerceInteger(params.maxSteps) === diffStruct.steps) &&
               (params.allowBracket == null || !!params.allowBracket === diffStruct.allowBracket) &&
               (params.allowMultDiv == null || !!params.allowMultDiv === diffStruct.allowMultDiv);
      if (ok) consistent++;
    }
  });

  info.push({ code: 'DIFFICULTY_DISTRIBUTION', field: 'batch', message: '难度分布: ' + JSON.stringify(diffDist), severity: 'INFO' });
  if (total > 0) {
    info.push({ code: 'DIFFICULTY_CONSISTENCY_RATE', field: 'batch', message: '结构一致性通过率: ' + Math.round(consistent / total * 100) + '%', severity: 'INFO' });
  }

  return { valid: true, errors: errors, warnings: warnings, info: info, score: 1, checks: { difficultyIntegrity: 'pass' } };
}

module.exports = {
  validateDifficultyIntegrity: validateDifficultyIntegrity,
  validateBatchDifficultyIntegrity: validateBatchDifficultyIntegrity
};
};
__defs["shared/validator/duplicate-integrity-validator.js"] = function (module, exports, require) {
'use strict';



var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

var Dup = require("shared/validator/duplicate-validator.js");


function tryBuildFingerprint(sq) {
  try {
    if (typeof Dup.buildQuestionFingerprint === 'function') {
      var fp = Dup.buildQuestionFingerprint(sq);
      if (fp && fp.startsWith('v2|')) return fp;
    }
  } catch (e) {  }
  return null;
}

function validateDuplicateIntegrity(sq, context) {
  context = context || {};
  var errors = [];
  var warnings = [];
  var info = [];

  // 1) questionFingerprint 必填（若缺失尝试自动构建）
  var fp = sq.questionFingerprint;
  if (!fp) {
    fp = tryBuildFingerprint(sq);
    if (fp) {
      sq.questionFingerprint = fp;
      info.push({ code: 'DUPLICATE_FINGERPRINT_AUTO', field: 'questionFingerprint', message: '自动构建 questionFingerprint', severity: 'INFO' });
    } else {
      errors.push(createError(ERROR_CODES.DUPLICATE_INTEGRITY_VIOLATION, 'questionFingerprint', '题目缺少 questionFingerprint 字段且无法自动构建', SEVERITY.ERROR));
      return { valid: false, errors: errors, warnings: warnings, info: info, score: 0, checks: { duplicateIntegrity: 'fail' } };
    }
  }

  // 2) fingerprint 格式校验（v2|KP|type|operators|operands|structure|context|format）
  var parts = fp.split('|');
  if (parts.length < 7 || parts[0] !== 'v2') {
    errors.push(createError(ERROR_CODES.DUPLICATE_FINGERPRINT_MISMATCH, 'questionFingerprint', 'questionFingerprint 格式非法: ' + fp, SEVERITY.ERROR, { fingerprint: fp, parts: parts }));
  }

  // 3) fingerprint 与 canonicalKey 语义一致性（同题两套键应指向同一语义等价类）
  // canonicalKey 基于 prompt 文本，fingerprint 基于语义数据；两者应在等价类上一致
  var ck = Dup.buildCanonicalKey(sq);
  if (!ck) {
    warnings.push({ code: 'DUPLICATE_CANONICAL_MISSING', field: 'canonicalKey', message: '无法计算 canonicalKey', severity: 'WARNING' });
  } else {
    // 语义一致性：若两题 fingerprint 相同 → canonicalKey 必相同（交换律等价）
    // 这里仅记录，不强制比对（需要跨题比较）
    info.push({ code: 'DUPLICATE_KEYS', field: 'fingerprint', message: 'fingerprint=' + fp + ' | canonicalKey=' + ck, severity: 'INFO' });
  }

  // 4) 跨批次 seenKeys 冲突检测（由 duplicate-validator 在 pipeline 中处理，这里记录）
  if (context.seenKeys && context.seenKeys.has(fp)) {
    errors.push(createError(ERROR_CODES.DUPLICATE_INTEGRITY_VIOLATION, 'questionFingerprint', '指纹已存在于去重集（跨批次冲突）: ' + fp, SEVERITY.ERROR, { fingerprint: fp }));
  }

  var valid = errors.length === 0;
  var hasWarning = warnings.length > 0;

  return {
    valid: valid,
    errors: errors,
    warnings: warnings,
    info: info,
    score: valid ? (hasWarning ? 0.8 : 1) : 0.5,
    checks: { duplicateIntegrity: valid ? (hasWarning ? 'warn' : 'pass') : 'fail' }
  };
}

function validateBatchDuplicateIntegrity(questions, context) {
  var errors = [];
  var warnings = [];
  var info = [];

  var fps = questions.map(function (sq) { return sq.questionFingerprint; }).filter(Boolean);
  var unique = new Set(fps);
  var dupCount = fps.length - unique.size;

  if (dupCount > 0) {
    warnings.push({ code: 'BATCH_DUPLICATE_FINGERPRINT', field: 'batch', message: '批次内存在 ' + dupCount + ' 个重复指纹', severity: 'WARNING', detail: { total: fps.length, unique: unique.size, duplicates: dupCount } });
  }

  // 指纹格式统计
  var formatErrors = fps.filter(function (fp) { return !fp.startsWith('v2|') || fp.split('|').length < 7; }).length;
  if (formatErrors) {
    warnings.push({ code: 'BATCH_FINGERPRINT_FORMAT', field: 'batch', message: formatErrors + ' 个指纹格式非标准', severity: 'WARNING' });
  }

  info.push({ code: 'BATCH_FINGERPRINT_STATS', field: 'batch', message: '批次指纹: 总计 ' + fps.length + ', 唯一 ' + unique.size + ', 重复 ' + dupCount, severity: 'INFO' });

  return { valid: true, errors: errors, warnings: warnings, info: info, score: dupCount === 0 ? 1 : 0.7, checks: { duplicateIntegrity: dupCount === 0 ? 'pass' : 'warn' } };
}

module.exports = {
  validateDuplicateIntegrity: validateDuplicateIntegrity,
  validateBatchDuplicateIntegrity: validateBatchDuplicateIntegrity
};
};
__defs["shared/validator/kp-semantic-validator.js"] = function (module, exports, require) {
'use strict';



var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

// P17-7: 去 Context/Registry 直接依赖——经注入/全局边界获取（与 api.js/generation-core.js 一致的 DI 风格），
// 保留受保护的惰性 require 兜底以兼容 Node 直载与双环境。
var _GLOBAL = typeof window !== 'undefined' ? window : global;
var _deps = {};
var DEP_GLOBAL_KEYS = { knowledgeContext: 'KnowledgeContext', generatorRegistry: 'GeneratorRegistry' };
function getDep(name) {
  if (_deps[name]) return _deps[name];
  var key = DEP_GLOBAL_KEYS[name];
  var g = _GLOBAL && _GLOBAL[key];
  if (g) _deps[name] = g;
  return _deps[name];
}
function getKC() {
  var KC = getDep('knowledgeContext');
  if (KC) return KC;
  try { KC = require("shared/orchestration/knowledge-context.js"); _deps.knowledgeContext = KC; } catch (e) {}
  return KC;
}
function getGenRegistry() {
  var R = getDep('generatorRegistry');
  if (R) return R;
  try { R = require("shared/generator/generator-registry.js"); _deps.generatorRegistry = R; } catch (e) {}
  return R;
}


function getKpConstraints(kpId) {
  var KC = getKC();
  var canonical = KC && KC.strategyView(kpId);
  if (!canonical) return null;

  // 获取算术语义运算（Frozen 语义解析器对 canonical KP 缺失 legacy 字段时安全返回 null）
  var arithSem = null;
  try { arithSem = require("shared/generator/core/kp-arithmetic-semantics.js").resolveArithmeticSemantics(canonical); } catch (e) {}
  var complexSem = null;
  try { complexSem = require("shared/generator/core/kp-complex-semantics.js").resolveComplexSemantics(canonical); } catch (e) {}

  var operation = null;
  if (arithSem && arithSem.operators) operation = arithSem.operators;
  else if (complexSem && complexSem.operators) operation = complexSem.operators;
  else operation = canonical.operation || (canonical.constraints && canonical.constraints.operation) || null;

  return {
    id: canonical.id,
    category: canonical.category || null,
    legacyType: (canonical.source && canonical.source.legacyType) || null,
    numericRange: (canonical.numeric && canonical.numeric.range) || null,
    structure: canonical.structure || {},
    generationCapabilities: (canonical.generation && canonical.generation.capabilities) || [],
    presentationQuestionTypes: ((canonical.presentation && canonical.presentation.questionTypes) || []).map(function(q){ return q.type; }),
    factualContent: (canonical.knowledge && canonical.knowledge.factualContent) || null,
    graphicType: canonical.graphicType || null,
    operation: operation,
    spiral: canonical.spiral || {}
  };
}


function checkKpIdentity(sq, plan) {
  var errors = [];
  var planKpIds = plan?.knowledgePointIds || (plan?.knowledgePointId ? [plan.knowledgePointId] : []);
  var sqKpIds = sq.knowledgePointIds || (sq.knowledgePointId ? [sq.knowledgePointId] : []);
  
  if (!sqKpIds.length) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_IDENTITY, 'knowledgePointIds', '题目缺失 knowledgePointIds', SEVERITY.ERROR, { planKpIds: planKpIds }));
  } else {
    var mismatch = sqKpIds.some(function(id) { return planKpIds.indexOf(id) === -1; });
    if (mismatch) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_IDENTITY, 'knowledgePointIds', '题目 KP 与 Plan 不一致: ' + sqKpIds.join(',') + ' vs ' + planKpIds.join(','), SEVERITY.ERROR, { planKpIds: planKpIds, sqKpIds: sqKpIds }));
    }
  }
  return errors;
}


function checkQuestionType(sq, kpConstraints) {
  var errors = [];
  if (!kpConstraints) return errors;
  
  var allowed = kpConstraints.presentationQuestionTypes || [];
  var supported = kpConstraints.generationCapabilities.map(function(c){ return c.id; }) || [];
  var allAllowed = Array.from(new Set(allowed.concat(supported)));
  
  if (allAllowed.length && sq.questionTypeId && allAllowed.indexOf(sq.questionTypeId) === -1) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_QUESTION_TYPE, 'questionTypeId', '题型 ' + sq.questionTypeId + ' 不在 KP 允许范围内: ' + allAllowed.join(','), SEVERITY.ERROR, { allowed: allAllowed, actual: sq.questionTypeId }));
  }
  return errors;
}


function checkOperation(sq, kpConstraints) {
  var errors = [];
  var warnings = [];
  if (!kpConstraints) return { errors: errors, warnings: warnings };
  
  var kpOp = kpConstraints.operation;
  if (!kpOp) return { errors: errors, warnings: warnings }; // 无显式 operation 约束时跳过
  
  var sqOp = sq.data?.operation;
  if (!sqOp) return { errors: errors, warnings: warnings }; // 题目无运算信息时跳过
  
  // 归一化比较：KP operation 可能是 ['+','−'] 或 ['add','sub']；题目可能是 ['+'] 或 'add' 或 'mixed'
  var kpOps = Array.isArray(kpOp) ? kpOp : [kpOp];
  var sqOps = Array.isArray(sqOp) ? sqOp : [sqOp];
  
  // 归一化 KP 操作集
  var kpOpsNorm = kpOps.map(normalizeOp);
  
  var mismatch = sqOps.some(function(op) {
    var normalized = normalizeOp(op);
    // 'mixed' 表示混合运算，当 KP 支持多种运算时视为合法
    if (normalized === 'mixed' && kpOps.length > 1) return false;
    return !kpOpsNorm.some(function(kop) { return kop === normalized; });
  });
  
  if (mismatch) {
    // B5/B6 known-pending：canonical 绑定迁移未完成时（forKnowledgePoint 恒空），
    // 选择器无法按运算区分算术家族，只能走泛型兜底 → 运算不匹配属「选择局限」而非「生成错误」，
    // 记 WARNING 保留交付；绑定迁移完成后自动恢复 ERROR（自愈，无需再改本处）。
    var hasNativeBinding = false;
    try {
      var GenRegistry = getGenRegistry();
      hasNativeBinding = GenRegistry.forKnowledgePoint(kpConstraints.id).length > 0;
    } catch (e) {  }
    var opError = createError(ERROR_CODES.KP_SEMANTIC_OPERATION, 'operation', '题目运算 ' + JSON.stringify(sqOps) + ' 与 KP operation ' + JSON.stringify(kpOps) + ' 不一致', hasNativeBinding ? SEVERITY.ERROR : SEVERITY.WARNING, { kpOperation: kpOps, questionOperation: sqOps });
    if (hasNativeBinding) errors.push(opError);
    else warnings.push(opError);
  }
  return { errors: errors, warnings: warnings };
}


function checkOperationSemanticGate(sq, plan) {
  var warnings = [];
  if (!plan) return warnings;
  var semOps = plan.semanticParams && plan.semanticParams.operations;
  if (!Array.isArray(semOps) || !semOps.length) return warnings;  // 无 SSOT 时不构成违例
  var sqOp = sq && sq.data && sq.data.operation;
  if (sqOp == null) return warnings;  // 题目无运算信息时跳过
  var sqOps = Array.isArray(sqOp) ? sqOp : [sqOp];
  var semOpsNorm = semOps.map(normalizeOp);
  var mismatch = sqOps.some(function (op) {
    var n = normalizeOp(op);
    // 'mixed' 表示混合运算，当 SSOT 支持多种运算时视为合法（与 checkOperation 同口径）
    if (n === 'mixed' && semOps.length > 1) return false;
    return semOpsNorm.indexOf(n) === -1;
  });
  if (mismatch) {
    warnings.push(createError(ERROR_CODES.KP_SEMANTIC_OPERATION, 'operation',
      '[SEM-GATE] 题目运算 ' + JSON.stringify(sqOps) + ' 不在 plan.semanticParams.operations ' + JSON.stringify(semOps) + ' 内（KBL SSOT）',
      SEVERITY.WARNING,
      { semanticParamsOperations: semOps, questionOperation: sqOps }));
  }
  return warnings;
}

function normalizeOp(op) {
  if (op === '+' || op === 'add' || op === 'addition') return 'add';
  if (op === '−' || op === '-' || op === 'sub' || op === 'subtraction') return 'sub';
  if (op === '×' || op === '*' || op === 'mult' || op === 'multiplication') return 'mult';
  if (op === '÷' || op === '/' || op === 'div' || op === 'division') return 'div';
  return op;
}


function checkNumeric(sq, kpConstraints) {
  var errors = [];
  if (!kpConstraints?.numericRange) return errors;
  
  var kpRange = kpConstraints.numericRange;
  if (kpRange.min == null && kpRange.max == null) return errors; // 无显式范围约束时跳过
  
  var sqRange = sq.numberRange;
  if (!sqRange || typeof sqRange.min !== 'number' || typeof sqRange.max !== 'number') return errors;
  
  var kpMin = kpRange.min != null ? kpRange.min : -Infinity;
  var kpMax = kpRange.max != null ? kpRange.max : Infinity;
  
  if (sqRange.min < kpMin || sqRange.max > kpMax) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_NUMERIC, 'numberRange', '题目数值范围 [' + sqRange.min + ',' + sqRange.max + '] 超出 KP 约束 [' + kpMin + ',' + kpMax + ']', SEVERITY.ERROR, { kpRange: [kpMin, kpMax], sqRange: [sqRange.min, sqRange.max] }));
  }
  return errors;
}


function checkStructure(sq, kpConstraints) {
  var errors = [];
  if (!kpConstraints) return errors;
  
  var kpStruct = kpConstraints.structure || {};
  var sqStruct = sq.constraints || {};
  
  // maxSteps 检查
  if (kpStruct.maxSteps != null && sqStruct.maxSteps != null) {
    if (sqStruct.maxSteps > kpStruct.maxSteps) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'maxSteps', '题目 maxSteps ' + sqStruct.maxSteps + ' 超过 KP 限制 ' + kpStruct.maxSteps, SEVERITY.ERROR, { kpMaxSteps: kpStruct.maxSteps, sqMaxSteps: sqStruct.maxSteps }));
    }
  }
  
  // allowBracket / allowMultDiv 检查（KP 禁止时题目不应允许）
  if (kpStruct.allowBracket === false && sqStruct.allowBracket === true) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'allowBracket', 'KP 禁止括号但题目允许括号', SEVERITY.ERROR, {}));
  }
  if (kpStruct.allowMultDiv === false && sqStruct.allowMultDiv === true) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'allowMultDiv', 'KP 禁止乘除但题目允许乘除', SEVERITY.ERROR, {}));
  }
  
  // exactSteps 检查
  if (sqStruct.exactSteps != null && kpStruct.maxSteps != null) {
    if (sqStruct.exactSteps > kpStruct.maxSteps) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'exactSteps', '题目 exactSteps ' + sqStruct.exactSteps + ' 超过 KP maxSteps ' + kpStruct.maxSteps, SEVERITY.ERROR, {}));
    }
  }
  return errors;
}


function checkContent(sq, kpConstraints) {
  var errors = [];
  var warnings = [];
  if (!kpConstraints) return { errors: errors, warnings: warnings };
  
  // factualContent 检查：如果 KP 有 factualContent，题目应包含相关语义
  var factual = kpConstraints.factualContent;
  if (factual) {
    // factualContent 可能是对象或字符串
    var factualKeys = typeof factual === 'object' ? Object.keys(factual) : [factual];
    var found = false;
    
    // 检查 prompt / data.graphic / data.operation / data.shapeName 等字段
    var searchable = [
      sq.prompt,
      sq.data?.graphic?.type,
      sq.data?.graphic?.subtype,
      sq.data?.operation,
      sq.data?.shapeName,
      sq.data?.targetShape,
      sq.data?.feature,
      sq.data?.kind,
      sq.data?.template
    ].filter(Boolean).join(' ').toLowerCase();
    
    factualKeys.forEach(function(key) {
      if (searchable.indexOf(key.toLowerCase()) !== -1) found = true;
    });
    
    if (!found) {
      // 仅警告，不阻断（factualContent 可能较宽泛）
      warnings.push({ code: 'KP_SEMANTIC_CONTENT_MISSING', field: 'content', message: '题目未体现 KP factualContent: ' + factualKeys.join(','), severity: 'WARN' });
    }
  }
  
  // graphicType 检查：KP 有 graphicType 时，题目 graphic.type 应匹配
  var graphicType = kpConstraints.graphicType;
  if (graphicType && sq.data?.graphic?.type && sq.data.graphic.type !== graphicType) {
    warnings.push({ code: 'KP_SEMANTIC_GRAPHIC_MISMATCH', field: 'graphic', message: '题目 graphic.type ' + sq.data.graphic.type + ' 与 KP graphicType ' + graphicType + ' 不符', severity: 'WARN' });
  }
  
  return { errors: errors, warnings: warnings };
}


var _evidenceRules = null;
function getEvidenceRules() {
  if (_evidenceRules) return _evidenceRules;
  var map = {};
  try {
    var rulesPath = '../../' + 'kbl/' + 'teaching/' + 'evidence-rules.json';
    var doc = require(rulesPath);
    if (doc && Array.isArray(doc.rules)) {
      doc.rules.forEach(function (r) {
        if (r && r.knowledgePointId && r.questionType) {
          map[r.knowledgePointId + '|' + r.questionType] = r;
        }
      });
    }
  } catch (e) {  }
  _evidenceRules = map;
  return _evidenceRules;
}



function fieldRead(sq, path) {
  var cur = sq;
  var parts = String(path).split('.');
  for (var i = 0; i < parts.length; i++) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

function fieldEquals(sq, path, value) {
  var cur = fieldRead(sq, path);
  if (Array.isArray(value) || Array.isArray(cur)) {
    if (!Array.isArray(value) || !Array.isArray(cur)) return false;
    return value.slice().sort().join('\u0001') === cur.slice().sort().join('\u0001');
  }
  return cur === value;
}

function checkSemanticEvidence(sq, kpId) {
  var errors = [];
  var warnings = [];
  var qt = sq.questionType || sq.questionTypeId || null;
  var rule = (kpId && qt) ? getEvidenceRules()[kpId + '|' + qt] : null;
  if (!rule) return { state: 'skip', errors: errors, warnings: warnings };

  var decl = sq.data && sq.data.semanticEvidence;
  if (!decl || typeof decl !== 'object') {
    warnings.push(createError(ERROR_CODES.KP_SEMANTIC_EVIDENCE, 'data.semanticEvidence',
      'KP×题型存在证据规则但题目未声明 semanticEvidence（过渡期 WARN，不阻断）',
      SEVERITY.WARNING, { kpId: kpId, questionType: qt }));
    return { state: 'warn', errors: errors, warnings: warnings };
  }

  var relations = Array.isArray(decl.relations) ? decl.relations : [];
  // FINAL-37：constructs 不再装饰——验证器真正校验声明 constructs 是否含规则要求的结构构件。
  var constructs = Array.isArray(decl.constructs) ? decl.constructs : [];
  var missing = [];
  (rule.required || []).forEach(function (a) {
    if (a.kind === 'relation' && relations.indexOf(a.relation) === -1) missing.push('relation:' + a.relation);
    if (a.kind === 'field' && !fieldEquals(sq, a.path, a.value)) missing.push(a.path);
    // FINAL-31a：存在性断言——路径可读且非 undefined 即通过，不冻结按抽题随机取值的具体值
    if (a.kind === 'fieldPresent' && fieldRead(sq, a.path) === undefined) missing.push('present:' + a.path);
    // FINAL-37：结构构件断言——声明 constructs 须包含该构件（如 base-quantity/multiple/vertex）
    if (a.kind === 'construct' && constructs.indexOf(a.name) === -1) missing.push('construct:' + a.name);
    // 通用算法 KP：单题只执行本 KP 所允许多种通用算法中的一种——声明关系/构件须与允许集有交集
    // （正面要求"声明了本 KP 的某种合法算法"，空声明/越界算法不通过）。
    if (a.kind === 'relationAny' &&
      !(Array.isArray(a.any) && a.any.some(function (r) { return relations.indexOf(r) !== -1; }))) {
      missing.push('relationAny:[' + (a.any || []).join(',') + ']');
    }
    if (a.kind === 'constructAny' &&
      !(Array.isArray(a.any) && a.any.some(function (n) { return constructs.indexOf(n) !== -1; }))) {
      missing.push('constructAny:[' + (a.any || []).join(',') + ']');
    }
  });
  var forbiddenHits = [];
  (rule.forbidden || []).forEach(function (a) {
    if (a.kind === 'relationNot' && relations.indexOf(a.relation) !== -1) forbiddenHits.push('relation:' + a.relation);
    if (a.kind === 'fieldNot' && fieldEquals(sq, a.path, a.value)) forbiddenHits.push(a.path);
    if (a.kind === 'constructNot' && constructs.indexOf(a.name) !== -1) forbiddenHits.push('construct:' + a.name);
  });

  if (missing.length || forbiddenHits.length) {
    var msg = '语义证据不满足';
    if (missing.length) msg += '：缺 ' + missing.join(',');
    if (forbiddenHits.length) msg += (missing.length ? '；' : '：') + '违禁命中 ' + forbiddenHits.join(',');
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_EVIDENCE, 'data.semanticEvidence', msg,
      SEVERITY.ERROR, { kpId: kpId, questionType: qt, missing: missing, forbiddenHits: forbiddenHits }));
    return { state: 'fail', errors: errors, warnings: warnings };
  }
  return { state: 'pass', errors: errors, warnings: warnings };
}


var _intentRelations = null;
function getIntentRelations() {
  if (_intentRelations) return _intentRelations;
  try {
    var p = '../../' + 'kbl/' + 'teaching/' + 'intent-relations.json';
    _intentRelations = require(p) || { rules: [], forbiddenAcrossFamilies: {} };
  } catch (e) { _intentRelations = { rules: [], forbiddenAcrossFamilies: {} }; }
  return _intentRelations;
}


function getAllowedRelations(kpSemantic) {
  var doc = getIntentRelations();
  var allowed = {};
  if (!kpSemantic || !Array.isArray(doc.rules)) return allowed;
  var family = kpSemantic.family || null;
  var type = kpSemantic.type || null; // KBL type（calculation/geometry/...）
  var ops = kpSemantic.operations || [];
  var opsEmpty = ops.length === 0;

  doc.rules.forEach(function (rule) {
    var w = rule.when || {};
    var match = true;
    if (w.category && w.category !== type) match = false;
    if (w.family && w.family !== family) match = false;
    if (w.operationsEmpty === true && !opsEmpty) match = false;
    if (w.operationsEmpty === false && opsEmpty) match = false;
    if (w.hasOperation && ops.indexOf(w.hasOperation) === -1) match = false;
    if (match && Array.isArray(rule.allow)) rule.allow.forEach(function (r) { allowed[r] = true; });
  });

  // 跨家族禁表兜底：几何家族禁算术关系，算术家族禁几何关系
  var forbidden = doc.forbiddenAcrossFamilies || {};
  if (type === 'geometry' || family === 'geometry') {
    (forbidden.geometry || []).forEach(function (r) { delete allowed[r]; });
  } else if (type === 'calculation' || family === 'multiplication-division' ||
             family === 'fraction' || family === 'decimal' || family === 'percent') {
    (forbidden['algebra-arithmetic'] || []).forEach(function (r) { delete allowed[r]; });
  }
  return allowed;
}

function getKpSemanticForIntent(kpId) {
  if (!kpId) return null;
  var KC = getKC();
  if (!KC || typeof KC.get !== 'function') return null;
  var kp = KC.get(kpId);
  if (!kp) return null;
  var sem = kp.semantic || {};
  return { family: sem.family || null, type: kp.type || null, operations: sem.operations || [] };
}

function checkIntentEvidenceConsistency(sq, kpId) {
  var errors = [];
  var decl = sq.data && sq.data.semanticEvidence;
  var relations = decl && Array.isArray(decl.relations) ? decl.relations : [];
  if (relations.length === 0) {
    return { state: 'skip', errors: errors, warnings: [] };
  }

  // KC 不可用（如浏览器 bundle 未加载 knowledge-context）时无法判定，skip 不误杀
  var kpSemantic = getKpSemanticForIntent(kpId);
  if (!kpSemantic) {
    return { state: 'skip', errors: errors, warnings: [] };
  }

  var allowed = getAllowedRelations(kpSemantic);
  // 规则表为空（bundle 未内联 intent-relations.json / 加载失败）时无法判定，skip 不误杀
  if (Object.keys(allowed).length === 0) {
    return { state: 'skip', errors: errors, warnings: [] };
  }

  var conflicts = relations.filter(function (r) { return !allowed[r]; });
  if (conflicts.length) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_CONFLICT, 'data.semanticEvidence.relations',
      '声明的语义关系与 KP 意图矛盾（跨家族）：' + conflicts.join(','), SEVERITY.ERROR,
      { kpId: kpId, conflicts: conflicts, allowedRelations: Object.keys(allowed) }));
    return { state: 'fail', errors: errors, warnings: [] };
  }
  return { state: 'pass', errors: errors, warnings: [] };
}


var _typeContract = null;
function getTypeContract() {
  if (_typeContract !== null) return _typeContract;
  try { _typeContract = require("shared/generator/core/type-contract.js"); }
  catch (e) { _typeContract = false; }
  return _typeContract;
}

function checkTypeContract(sq) {
  var errors = [];
  var TC = getTypeContract();
  if (!TC || typeof TC.check !== 'function') {
    return { state: 'skip', errors: errors, warnings: [] };
  }
  var qt = sq.questionType || sq.questionTypeId || null;
  if (!qt || !TC.CONTRACT_MAP || !TC.CONTRACT_MAP[qt]) {
    return { state: 'skip', errors: errors, warnings: [] };
  }
  var res = TC.check(qt, sq);
  if (!res || res.ok !== false) {
    return { state: 'pass', errors: errors, warnings: [] };
  }
  errors.push(createError(ERROR_CODES.KP_TYPE_CONTRACT, 'questionType',
    '题型教育契约违例（' + qt + '）：' + (res.violations || []).join(','),
    SEVERITY.ERROR, { questionType: qt, violations: res.violations || [] }));
  return { state: 'fail', errors: errors, warnings: [] };
}



// 题型 → focus 机械映射（canonical 7 类）
var QT_FOCUS_MAP = {
  calc: 'calculation', fill: 'written', apply: 'application',
  choice: 'selection', judge: 'selection', geometry: 'geometry', classify: 'classification'
};

// 题型 → expressionMode 机械推导
var QT_EXPRESSION_MAP = {
  calc: 'expression', fill: 'text', apply: 'context-word',
  choice: 'option-selection', judge: 'binary-judgement', geometry: 'graphic-construction', classify: 'grouping'
};

function checkIntentAlignment(sq, plan) {
  var errors = [];
  var sp = plan && plan.semanticParams ? plan.semanticParams : null;
  // P30-15：retry-loop 传入的 plan 未经 attachToPlan，兜底自算 semanticParams
  if (!sp && plan) {
    try {
      var SP = require("shared/generator/core/semantic-parameters.js");
      sp = SP.attachToPlan(plan).semanticParams;
    } catch (e) {  }
  }
  if (!sp || !sp.intent) {
    return { state: 'skip', errors: errors, warnings: [] };
  }
  var intent = sp.intent;
  var qt = sq.questionType || sq.questionTypeId || null;
  if (!qt) return { state: 'skip', errors: errors, warnings: [] };

  // 1. focus 对齐
  var expectedFocus = QT_FOCUS_MAP[qt];
  if (intent.focus && expectedFocus && intent.focus !== expectedFocus) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'focus',
      'intent.focus ' + intent.focus + ' 与题型 ' + qt + ' 期望 focus ' + expectedFocus + ' 不一致',
      SEVERITY.ERROR, { intentFocus: intent.focus, questionType: qt, expectedFocus: expectedFocus }));
  }

  // 2. representation 对齐：allowedRepresentations 不含 'graphic' 时题目不应含 graphic（反向约束）
  //    含 'graphic' 是「允许」非「必须」——强制含图由 graphicRole=carrier 承担（见下）
  var hasGraphic = !!(sq.data && sq.data.graphic);
  var allowedReps = intent.allowedRepresentations || [];
  if (allowedReps.length && allowedReps.indexOf('graphic') === -1 && hasGraphic) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'representation',
      'intent.allowedRepresentations 不含 graphic 但题目含图形',
      SEVERITY.ERROR, { allowedRepresentations: allowedReps, hasGraphic: hasGraphic }));
  }

  // 3. graphicRole 对齐（P30-22/27/28）
  //    intent.graphicRole 取值：carrier（图为核心载体，必须有图）/ auxiliary（图为辅助，可选）/ null（不需图）。
  //    carrier → 必须含 graphic；null → 禁止含 graphic；auxiliary → 不约束有无。
  var graphicRole = intent.graphicRole;
  var GRAPHIC_ROLES = {
    'quantity-correspondence': 1, 'number-position': 1, 'angle-measure': 1,
    'fraction-part': 1, 'area-measure': 1, 'data-comparison': 1,
    'calculation-support': 1, 'auxiliary': 1, 'carrier': 1
  };
  if (graphicRole === 'carrier' && !hasGraphic) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'graphicRole',
      'intent.graphicRole=carrier 要求题目必须含图形，实际未含',
      SEVERITY.ERROR, { graphicRole: graphicRole, hasGraphic: hasGraphic }));
  }
  if (graphicRole === null && hasGraphic) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'graphicRole',
      'intent.graphicRole=null 要求题目不含图形，实际含图形',
      SEVERITY.ERROR, { graphicRole: graphicRole, hasGraphic: hasGraphic }));
  }
  // P30-27：graphic.role 合法性校验。
  // 注意：intent.graphicRole（carrier/auxiliary/null，表"图是否核心载体"）与
  // graphic.role（quantity-correspondence/angle-measure/...，表"图的具体语义角色"）
  // 是不同维度，不强制相等；仅校验 graphic.role 属于合法枚举。
  if (hasGraphic) {
    var gRole = sq.data.graphic.role;
    if (gRole != null && !GRAPHIC_ROLES[gRole]) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'graphic.role',
        'graphic.role=' + gRole + ' 不在合法枚举内',
        SEVERITY.ERROR, { graphicRole: gRole }));
    }
  }

  // 4. expressionMode 对齐
  var expectedMode = QT_EXPRESSION_MAP[qt];
  var modes = intent.expressionModes || [];
  if (expectedMode && modes.length && modes.indexOf(expectedMode) === -1) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'expressionMode',
      'intent.expressionModes ' + JSON.stringify(modes) + ' 不含题型 ' + qt + ' 期望模式 ' + expectedMode,
      SEVERITY.ERROR, { expressionModes: modes, questionType: qt, expectedMode: expectedMode }));
  }

  return {
    state: errors.length ? 'fail' : 'pass',
    errors: errors,
    warnings: []
  };
}


function checkGraphicAlignment(sq, plan) {
  var errors = [];
  var warnings = [];
  var g = sq.data && sq.data.graphic;
  if (!g) return { state: 'skip', errors: errors, warnings: warnings };

  // 1. 题目数字 ↔ graphic.params
  if (g.role === 'angle-measure' && g.params && g.params.angle != null) {
    var answer = sq.answer && (typeof sq.answer === 'object' ? sq.answer.value : sq.answer);
    var answerNum = typeof answer === 'string' ? parseFloat(answer) : answer;
    if (typeof answerNum === 'number' && !isNaN(answerNum)) {
      // 角度题答案应与 params.angle 一致；answer 为类别（如直角=90°）时 graphic 为示意，降级 WARN
      if (Math.abs(answerNum - g.params.angle) > 0.01) {
        warnings.push({ code: 'KP_SEMANTIC_GRAPHIC_ANGLE_MISMATCH', field: 'graphic.params.angle', message: '题目答案 ' + answerNum + ' 与 graphic.params.angle ' + g.params.angle + ' 不一致', severity: 'WARN', detail: { answer: answerNum, graphicAngle: g.params.angle } });
      }
    }
  }

  // 3. graphic.subtype ↔ SVG renderer
  try {
    var GR = require("shared/generator/graphic-renderer.js");
    if (!GR.isSupported(g.type, g.subtype)) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'graphic.subtype',
        'graphic ' + g.type + '/' + g.subtype + ' 无注册 SVG renderer',
        SEVERITY.ERROR, { type: g.type, subtype: g.subtype }));
    }
  } catch (e) {  }

  // 4. SVG 输出 ↔ graphic descriptor：属运行时渲染检查，不在语义 validator 中执行
  //    （Node 环境无浏览器渲染管线，svg-*.js 未加载会误报；浏览器端由 E2E 覆盖）

  return {
    state: errors.length ? 'fail' : 'pass',
    errors: errors,
    warnings: []
  };
}
function validateKpSemantics(sq, context) {
  context = context || {};
  var plan = context.plan;
  var kpId = context.kpId || (plan && (plan.knowledgePointIds?.[0] || plan.knowledgePointId));
  var kpConstraints = context.kpConstraints || (kpId ? getKpConstraints(kpId) : null);
  
  var allErrors = [];
  var allWarnings = [];
  var allInfo = [];
  
  // 1. KP Identity
  allErrors.push.apply(allErrors, checkKpIdentity(sq, plan));
  
  // 2. Question Type
  allErrors.push.apply(allErrors, checkQuestionType(sq, kpConstraints));
  
  // 3. Operation
  var opResult = checkOperation(sq, kpConstraints);
  allErrors.push.apply(allErrors, opResult.errors);
  allWarnings.push.apply(allWarnings, opResult.warnings);

  // 3.5 Operation Semantic Gate (P28-SEM-GATE-01)：题目 data.operation ⊆ plan.semanticParams.operations（KBL SSOT）；warn-only
  allWarnings.push.apply(allWarnings, checkOperationSemanticGate(sq, plan));
  
  // 4. Numeric
  allErrors.push.apply(allErrors, checkNumeric(sq, kpConstraints));
  
  // 5. Structure
  allErrors.push.apply(allErrors, checkStructure(sq, kpConstraints));
  
  // 6. Content
  var contentResult = checkContent(sq, kpConstraints);
  allErrors.push.apply(allErrors, contentResult.errors);
  allWarnings.push.apply(allWarnings, contentResult.warnings);

  // 7. Semantic Evidence（P25-04：四态 skip/pass/warn/fail；不放宽既有 6 检查）
  var evidenceResult = checkSemanticEvidence(sq, kpId);
  allErrors.push.apply(allErrors, evidenceResult.errors);
  allWarnings.push.apply(allWarnings, evidenceResult.warnings);

  // 8. Intent×Evidence 一致性（P25-05：跨家族矛盾门禁；skip/pass/fail）
  var intentResult = checkIntentEvidenceConsistency(sq, kpId);
  allErrors.push.apply(allErrors, intentResult.errors);

  // 9. 题型教育契约（P25-07：声明制结构不变式门禁；skip/pass/fail）
  var typeContractResult = checkTypeContract(sq);
  allErrors.push.apply(allErrors, typeContractResult.errors);

  // 10. Intent Alignment（P30-15：生成结果与 intent 机器字段对齐；skip/pass/fail）
  var intentAlignmentResult = checkIntentAlignment(sq, plan);
  allErrors.push.apply(allErrors, intentAlignmentResult.errors);

  // 11. Graphic Alignment（P30-27：SVG 与题目数据一致性；skip/pass/fail）
  var graphicAlignmentResult = checkGraphicAlignment(sq, plan);
  allErrors.push.apply(allErrors, graphicAlignmentResult.errors);
  allWarnings.push.apply(allWarnings, graphicAlignmentResult.warnings);

  var valid = allErrors.length === 0;
  var score = valid ? 1 : Math.max(0, 1 - allErrors.length / 7);

  return {
    valid: valid,
    errors: allErrors,
    warnings: allWarnings,
    info: allInfo,
    score: score,
    semanticEvidence: evidenceResult.state,
    intentConsistency: intentResult.state,
    typeContract: typeContractResult.state,
    intentAlignment: intentAlignmentResult.state,
    graphicAlignment: graphicAlignmentResult.state,
    checks: {
      kpIdentity: checkKpIdentity(sq, plan).length === 0 ? 'pass' : 'fail',
      questionType: checkQuestionType(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      operation: opResult.errors.length === 0 ? 'pass' : 'fail',
      numeric: checkNumeric(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      structure: checkStructure(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      content: contentResult.errors.length === 0 ? 'pass' : 'fail',
      semanticEvidence: evidenceResult.state,
      intentConsistency: intentResult.state,
      typeContract: typeContractResult.state,
      intentAlignment: intentAlignmentResult.state
    }
  };
}

module.exports = {
  validateKpSemantics: validateKpSemantics,
  getKpConstraints: getKpConstraints,
  checkKpIdentity: checkKpIdentity,
  checkQuestionType: checkQuestionType,
  checkOperation: checkOperation,
  checkOperationSemanticGate: checkOperationSemanticGate,
  checkNumeric: checkNumeric,
  checkStructure: checkStructure,
  checkContent: checkContent,
  checkSemanticEvidence: checkSemanticEvidence,
  checkIntentEvidenceConsistency: checkIntentEvidenceConsistency,
  checkTypeContract: checkTypeContract,
  checkIntentAlignment: checkIntentAlignment,
  checkGraphicAlignment: checkGraphicAlignment,
  getAllowedRelations: getAllowedRelations,
  getEvidenceRules: getEvidenceRules
};
};
__defs["shared/generator/graphic-renderer.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  // P30-22：graphic.role 枚举——图形必须回答「为什么需要这个图」。
  // 取值与 kbl/teaching qt-intent.assessment.graphicRole 对齐；
  // Generator 依据 Intent 设定，缺省按 graphic.type 映射（见 GRAPHIC_TYPE_ROLES）。
  var GRAPHIC_ROLES = {
    'quantity-correspondence': true,  // 数量对应（如数图形个数、人民币计数）
    'number-position': true,          // 数与位置（钟表、数轴、方位）
    'angle-measure': true,            // 角度度量
    'fraction-part': true,            // 分数份数
    'area-measure': true,             // 面积度量
    'data-comparison': true,          // 数据比较（统计图表）
    'calculation-support': true,      // 计算辅助（竖式、凑十、线段图）
    'auxiliary': true,                // 辅助载体（非核心语义，如涂色/认识图形）
    null: true                        // 无需配图
  };

  // graphic.type → 默认 role（Generator 未显式设定 role 时使用）
  var GRAPHIC_TYPE_ROLES = {
    'geometry': 'quantity-correspondence',
    'calculation': 'calculation-support',
    'make-ten': 'calculation-support',
    'makeTen': 'calculation-support',
    'clock': 'number-position',
    'area': 'area-measure',
    'fraction': 'fraction-part',
    'dataStats': 'data-comparison',
    'draw': 'auxiliary',
    'competition': 'auxiliary',
    'chart': 'data-comparison',
    'diagram': 'calculation-support',
    'currency': 'quantity-correspondence',
    'core': null,
    'custom': 'auxiliary',
    'illustration': 'auxiliary'
  };

  // graphic.type → SVG 渲染器（语义类型，与 svg-registry SUBJECT_TO_TYPE 对齐）
  var GRAPHIC_RENDERERS = {
    'calculation': { module: 'svg-calculation', label: '四则运算竖式' },
    'geometry': { module: 'svg-geometry', label: '几何图形' },
    'make-ten': { module: 'svg-make-ten', label: '凑十法' },
    'makeTen': { module: 'svg-make-ten', label: '凑十法' },
    'clock': { module: 'svg-clock', label: '钟表' },
    'area': { module: 'svg-area', label: '面积' },
    'fraction': { module: 'svg-fraction', label: '分数' },
    'dataStats': { module: 'svg-datastats', label: '数据统计' },
    'draw': { module: 'svg-draw', label: '作图' },
    'competition': { module: 'svg-competition', label: '竞赛' },
    'chart': { module: 'svg-chart', label: '统计图表' },
    'diagram': { module: 'svg-diagram', label: '示意图' },
    'currency': { module: 'svg-currency', label: '人民币' },
    'core': { module: 'svg-core', label: '基础 SVG 原语' },
    'custom': { module: 'svg-legacy', label: '既有 SVG 透传' },
    'illustration': { module: 'svg-legacy', label: '既有 SVG 透传' }
  };

  
  function resolveGraphicRenderer(graphic) {
    if (!graphic || typeof graphic.type !== 'string') return null;
    var entry = GRAPHIC_RENDERERS[graphic.type];
    if (!entry) return null;
    var role = graphic.role != null ? graphic.role : (GRAPHIC_TYPE_ROLES[graphic.type] || null);
    return {
      type: graphic.type,
      subtype: graphic.subtype || null,
      params: graphic.params || {},
      role: role,
      renderer: entry.module,
      label: entry.label
    };
  }

  function isSupported(type) {
    if (!type || typeof type !== 'string') return false;
    if (GRAPHIC_RENDERERS[type]) return true;
    // makeTen / make-ten 同源映射
    if (type === 'makeTen' || type === 'make-ten') return true;
    return false;
  }

  // P30-22：role 合法性校验
  function isValidRole(role) {
    return role === null || role === undefined || GRAPHIC_ROLES.hasOwnProperty(role);
  }

  // P30-23：从 Intent 派生 role（plan.semanticParams.graphic.role），
  // 无 intent 时按 graphic.type 取默认。
  function resolveRoleFromIntent(plan, graphicType) {
    var intentRole = plan && plan.semanticParams && plan.semanticParams.graphic
      ? plan.semanticParams.graphic.role : null;
    if (intentRole != null && GRAPHIC_ROLES.hasOwnProperty(intentRole)) return intentRole;
    return GRAPHIC_TYPE_ROLES[graphicType] || null;
  }

  
  function getSVGEngine() {
    var c = global && global.SVGRenderer;
    if (c && typeof c.render === 'function') return c;
    try {
      return require("shared/presentation/svg-registry.js");
    } catch (e) {
      return null;
    }
  }

  
  function render(graphic, options) {
    if (!graphic || typeof graphic !== 'object' || typeof graphic.type !== 'string') {
      return { status: 'UNSUPPORTED', reason: 'Invalid graphic descriptor' };
    }
    var engine = getSVGEngine();
    if (!engine) {
      return { status: 'FAILED', reason: 'SVG engine not available' };
    }
    return engine.render(graphic, options);
  }

  var API = {
    GRAPHIC_RENDERERS: GRAPHIC_RENDERERS,
    GRAPHIC_ROLES: GRAPHIC_ROLES,
    GRAPHIC_TYPE_ROLES: GRAPHIC_TYPE_ROLES,
    resolveGraphicRenderer: resolveGraphicRenderer,
    isSupported: isSupported,
    isValidRole: isValidRole,
    resolveRoleFromIntent: resolveRoleFromIntent,
    render: render
  };

  global.GraphicRenderer = API;
  if (global.App && typeof global.App === 'object') global.App.GraphicRenderer = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);

};
__defs["shared/presentation/svg-registry.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  // entries: { type: { subtype: fn, '::default': fn } , 'shape:ns.name.sub': fn }
  var byType = {};        // type -> { subtype -> fn, '::default' -> fn }
  var byShape = {};       // 'ns.key' / 'ns.sub.key' -> fn
  var seededOnce = false;

  function ensureSeeded() {
    if (seededOnce) return;
    seedFromGlobal();
    seededOnce = true;
  }

  function ensureType(type) {
    if (!byType[type]) byType[type] = { '::default': null };
    return byType[type];
  }

  function getSVGUtil() {
    return (global.SVGUtil && typeof global.SVGUtil.svgWrap === 'function')
      ? global.SVGUtil
      : (typeof require !== 'undefined' ? require("shared/svg/svg-core.js") : null);
  }

  
  function register(type, subtype, generator) {
    if (typeof subtype === 'function') {
      generator = subtype;
      subtype = null;
    }
    if (!type || typeof generator !== 'function') {
      throw new Error('SVGGenerators.register(type, fn) 参数不合法: ' + type);
    }
    if (subtype == null) {
      ensureType(type)['::default'] = generator;
    } else {
      ensureType(type)[subtype] = generator;
    }
    if (typeof generator.shapeName === 'string' && generator.shapeName) {
      byShape[generator.shapeName] = generator;
    }
    return generator;
  }

  
  function seedFromGlobal() {
    var root = global.SVGGenerators;
    if (!root) return { seeded: 0 };
    var namespaces = ['math', 'cn', 'en'];
    // P6-R02: 新增 SVG 生成器命名空间
    var additionalNamespaces = {
      math: ['clock', 'area', 'fraction', 'dataStats', 'draw', 'competition', 'chart', 'diagram', 'currency']
    };
    var seeded = 0;
    var SUBJECT_TO_TYPE = { geometry: 'geometry', calculation: 'calculation', makeTen: 'makeTen', clock: 'clock', area: 'area', fraction: 'fraction', dataStats: 'dataStats', draw: 'draw', competition: 'competition', chart: 'chart', diagram: 'diagram', currency: 'currency' };
    // make-ten（kebab）是 M4 graphic-renderer 的语义类型名，与 makeTen 同源
    function registerWithAlias(type, subtype, fn) {
      register(type, subtype, fn);
      if (type === 'makeTen') {
        register('make-ten', subtype, fn);
        // kebab 别名提供默认渲染器（映射到 makeTen 子生成器）
        if (subtype === 'makeTen' || subtype === 'make-ten') {
          register('make-ten', null, fn);
        }
      }
    }
    for (var i = 0; i < namespaces.length; i++) {
      var ns = root[namespaces[i]];
      if (!ns || typeof ns !== 'object') continue;
      var keys = Object.keys(ns);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var val = ns[key];
        if (key === 'ready') continue;
        if (typeof val === 'function') {
          var shapeFn = val;
          shapeFn.shapeName = namespaces[i] + '.' + key;
          register(namespaces[i] + '.' + key, shapeFn);
          seeded++;
        } else if (typeof val === 'object' && val !== null) {
          var subKeys = Object.keys(val);
          for (var s = 0; s < subKeys.length; s++) {
            var sub = val[subKeys[s]];
            if (!subKeys[s] || typeof sub !== 'function' || subKeys[s].charAt(0) === '_') continue;
            var rootNs = namespaces[i];
            var shapeSubKey = rootNs + '.' + key + '.' + subKeys[s];
            var descriptorType = SUBJECT_TO_TYPE[key];
            if (rootNs === 'math' && descriptorType) {
              // 描述符索引（供 SemanticQuestion.graphic 直接渲染）
              if (key === 'calculation') {
                // 竖式函数签名不一（add/sub 收数组或 (a,b)，mul/div 收两个数，
                // dec 收 (a,b,op)，frac 收 (a,b,c,d,op)），按参数形态适配
                var arraySig = subKeys[s] === 'add';
                registerWithAlias(descriptorType, subKeys[s], (function (orig, useArray) {
                  return function (p) {
                    if (Array.isArray(p)) return orig(p.slice(), {});
                    if (p && Array.isArray(p.values)) return orig(p.values.slice(), (p.options || p.opts) || {});
                    var oo = (p && (p.options || p.opts)) || {};
                    if (useArray && p) return orig(p.a != null ? [p.a, p.b != null ? p.b : 0] : (Array.isArray(p.v) ? p.v : []), oo);
                    if (p && p.a != null && p.b != null && p.c != null && p.d != null)
                      return orig(p.a, p.b, p.c, p.d, p.op || '+', oo);
                    if (p && p.a != null && p.b != null && p.op)
                      return orig(p.a, p.b, p.op, oo);
                    if (p && p.a != null && p.b != null) return orig(p.a, p.b, oo);
                    return orig(p);
                  };
                })(sub, arraySig));
              } else if (key === 'makeTen') {
                // 凑十法生成器为位置参数 makeTen(a, b[, opts])，按 {num,add} 描述符形态适配
                registerWithAlias('makeTen', subKeys[s], (function (orig) {
                  return function (p) {
                    if (Array.isArray(p)) return orig(p[0], p[1]);
                    if (p && p.num != null && p.add != null) return orig(p.num, p.add);
                    if (p && p.a != null && p.b != null) return orig(p.a, p.b);
                    if (p && p.num != null) return orig(p.num, p.num);
                    return orig(p);
                  };
                })(sub));
              } else {
                registerWithAlias(descriptorType, subKeys[s], sub);
              }
              seeded++;
            } else {
              // 仅 shape 别名
              byShape[shapeSubKey] = sub;
              seeded++;
}
    }
    }
    // P6-R02: 处理额外的 math 子命名空间
    var mathNs = root.math;
    if (mathNs) {
      var additionalKeys = ['clock', 'area', 'fraction', 'dataStats', 'draw', 'competition', 'chart', 'diagram', 'currency'];
      for (var a = 0; a < additionalKeys.length; a++) {
        var key = additionalKeys[a];
        var val = mathNs[key];
        if (!val || typeof val !== 'object' || val === null) continue;
        var descriptorType = SUBJECT_TO_TYPE[key];
        if (!descriptorType) continue;
        var subKeys = Object.keys(val);
        for (var s = 0; s < subKeys.length; s++) {
          var sub = val[subKeys[s]];
          if (!subKeys[s] || typeof sub !== 'function' || subKeys[s].charAt(0) === '_') continue;
          registerWithAlias(descriptorType, subKeys[s], sub);
          seeded++;
        }
      }
    }
}
    }
    return { seeded: seeded };
  }

  function resolve(graphic) {
    ensureSeeded();
    if (!graphic || typeof graphic !== 'object') return null;
    var type = graphic.type;
    var subtype = graphic.subtype != null ? graphic.subtype : null;
    if (!type) {
      // 退化为 shape-name 解析（无 type 时用 params.shape）
      var shapeOnly = graphic.params && graphic.params.shape;
      if (shapeOnly && byShape[shapeOnly]) return byShape[shapeOnly];
      return null;
    }
    // 1) descriptor 精确索引
    var bucket = byType[type];
    if (bucket) {
      if (subtype && typeof bucket[subtype] === 'function') return bucket[subtype];
      if (typeof bucket['::default'] === 'function') return bucket['::default'];
    }
    // 2) shape-name 别名（type.subtype / type）
    if (subtype && byShape[type + '.' + subtype]) return byShape[type + '.' + subtype];
    if (byShape[type]) return byShape[type];
    return null;
  }

  
  function sanitizeSvgRaw(raw) {
    var San = (global && global.SVGSanitizer && typeof global.SVGSanitizer.sanitizeSvg === 'function')
      ? global.SVGSanitizer
      : (typeof require !== 'undefined' ? require("shared/presentation/svg-sanitizer.js") : null);
    if (!San) return '';
    return San.sanitizeSvg(raw);
  }

  

  
  function renderFor(graphic, options) {
    if (!graphic || typeof graphic !== 'object') {
      return { status: 'UNSUPPORTED', reason: 'Invalid graphic descriptor: not an object' };
    }
    // custom：直接承载既成 SVG（legacy q.svg 适配路径）—— 须经 P28-23 安全边界
    if (graphic.type === 'custom' || graphic.type === 'illustration') {
      var raw = graphic.params && graphic.params.rawSvg;
      if (typeof raw === 'string' && raw.trim().length > 0) {
        var cleaned = sanitizeSvgRaw(raw.trim());
        if (!cleaned) {
          return { status: 'FAILED', reason: 'SVG sanitization rejected input', error: new Error('Sanitizer returned empty') };
        }
        var finalSvg = cleaned.indexOf('<svg') === 0 ? cleaned : '<svg xmlns="http://www.w3.org/2000/svg">' + cleaned + '</svg>';
        return { status: 'SUCCESS', svg: finalSvg };
      }
      return { status: 'UNSUPPORTED', reason: 'custom/illustration graphic missing rawSvg' };
    }
    var fn = resolve(graphic);
    if (typeof fn !== 'function') {
      return { status: 'UNSUPPORTED', reason: 'No generator registered for type=' + graphic.type + (graphic.subtype ? ',subtype=' + graphic.subtype : '') };
    }
    var args = graphic.params || {};
    var svg;
    try {
      svg = fn(args);
    } catch (e) {
      return { status: 'FAILED', reason: 'Generator threw exception', error: e };
    }
    if (typeof svg === 'string' && svg.trim().length > 0) {
      return { status: 'SUCCESS', svg: svg.trim() };
    }
    return { status: 'FAILED', reason: 'Generator returned empty or non-string', error: new Error('Empty output') };
  }

  
  function render(graphic, options) {
    var result = renderFor(graphic, options);
    if (result.status !== 'SUCCESS') return result;
    var U = getSVGUtil();
    if (U && typeof U.svgWrap === 'function' && result.svg.indexOf('<svg') !== 0) {
      try {
        var wrapped = U.svgWrap(result.svg, { padding: 8 });
        return { status: 'SUCCESS', svg: wrapped };
      } catch (e) {
        return { status: 'FAILED', reason: 'svgWrap threw exception', error: e };
      }
    }
    return result;
  }

  var SVGRegistry = {
    register: register,
    seedFromGlobal: seedFromGlobal,
    resolve: resolve,
    render: render,
    renderFor: renderFor
  };

  // 挂到既有全局命名空间（与 shared/svg-*.js 的挂载共存），提供正式 API
  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.register = register;

  global.SVGRenderer = { render: render, resolve: resolve, register: register, renderFor: renderFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = SVGRegistry;
  return SVGRegistry;
})(typeof window !== 'undefined' ? window : global);
};
__defs["shared/svg/svg-core.js"] = function (module, exports, require) {
// shared/svg/svg-core.js — 通用 SVG 工具函数集（SVGUtil）
//
// 供各题型生成器以纯字符串方式构造几何图形，不依赖 DOM，浏览器 / Node 双环境可用。
// 设计要点：
//   - 所有元素函数返回 SVG 片段字符串（非完整 <svg>），由 svgWrap 统一包裹；
//   - svgWrap 未显式给定 viewBox 时调用 computeViewBox 自动计算边界；
//   - 属性值与文本内容自动 XML 转义；
//   - 默认样式集中在 SVG_DEFAULTS（配色与插件卡片风格一致）。
//
// 验收：控制台执行 SVGUtil.svgWrap('<circle cx="50" cy="50" r="40"/>') 得到合法 SVG 字符串。

(function (global) {
  'use strict';

  // ============ 默认样式常量 ============
  var SVG_DEFAULTS = {
    width: 220,            // svgWrap 兜底宽度
    height: 160,           // svgWrap 兜底高度
    padding: 10,           // computeViewBox 四周留白
    fill: '#eef3fb',       // 形状填充色
    stroke: '#27324a',     // 轮廓色
    strokeWidth: 2,
    fontSize: 14,
    fontFamily: 'Menlo, Consolas, monospace',
    textColor: '#27324a'
  };

  // ============ 内部工具 ============
  function escAttr(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escText(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  
  function merge(defaults, opts) {
    var out = {};
    Object.keys(defaults).forEach(function (k) { out[k] = defaults[k]; });
    if (opts) Object.keys(opts).forEach(function (k) {
      if (opts[k] != null) out[k] = opts[k];
    });
    return out;
  }
  
  function attrsStr(attrs) {
    var s = '';
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] == null) return;
      s += ' ' + k + '="' + escAttr(attrs[k]) + '"';
    });
    return s;
  }

  // ============ 基础元素创建 ============
  
  function svgElement(tag, attrs, children) {
    var inner = Array.isArray(children) ? children.join('') : (children || '');
    if (!inner) return '<' + tag + attrsStr(attrs) + '/>';
    return '<' + tag + attrsStr(attrs) + '>' + inner + '</' + tag + '>';
  }

  function svgText(x, y, str, opts) {
    var o = merge({ fontSize: SVG_DEFAULTS.fontSize, fontFamily: SVG_DEFAULTS.fontFamily,
      fill: SVG_DEFAULTS.textColor, 'text-anchor': 'middle' }, opts);
    var attrs = { x: x, y: y, 'font-size': o.fontSize, 'font-family': o.fontFamily,
      fill: o.fill, 'text-anchor': o['text-anchor'], 'font-weight': o.fontWeight };
    if (o.transform) attrs.transform = o.transform;
    return svgElement('text', attrs, escText(str));
  }

  function svgLine(x1, y1, x2, y2, opts) {
    var o = merge({ stroke: SVG_DEFAULTS.stroke, strokeWidth: SVG_DEFAULTS.strokeWidth }, opts);
    return svgElement('line', { x1: x1, y1: y1, x2: x2, y2: y2,
      stroke: o.stroke, 'stroke-width': o.strokeWidth, 'stroke-linecap': o.linecap || 'round', 'stroke-dasharray': o.dasharray });
  }

  
  function normPoints(points) {
    if (Array.isArray(points)) return points.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
    return String(points);
  }

  function svgPolygon(points, opts) {
    var o = merge({ fill: SVG_DEFAULTS.fill, stroke: SVG_DEFAULTS.stroke, strokeWidth: SVG_DEFAULTS.strokeWidth }, opts);
    return svgElement('polygon', { points: normPoints(points), fill: o.fill,
      stroke: o.stroke, 'stroke-width': o.strokeWidth, 'stroke-linejoin': o.linejoin || 'round', 'stroke-dasharray': o.dasharray });
  }

  function svgPolyline(points, opts) {
    var o = merge({ fill: 'none', stroke: SVG_DEFAULTS.stroke, strokeWidth: SVG_DEFAULTS.strokeWidth }, opts);
    return svgElement('polyline', { points: normPoints(points), fill: o.fill,
      stroke: o.stroke, 'stroke-width': o.strokeWidth, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  }

  function svgCircle(cx, cy, r, opts) {
    var o = merge({ fill: SVG_DEFAULTS.fill, stroke: SVG_DEFAULTS.stroke, strokeWidth: SVG_DEFAULTS.strokeWidth }, opts);
    return svgElement('circle', { cx: cx, cy: cy, r: r, fill: o.fill,
      stroke: o.stroke, 'stroke-width': o.strokeWidth, 'stroke-dasharray': o.dasharray });
  }

  function svgPath(d, opts) {
    var o = merge({ fill: 'none', stroke: SVG_DEFAULTS.stroke, strokeWidth: SVG_DEFAULTS.strokeWidth }, opts);
    var attrs = { d: d, fill: o.fill, stroke: o.stroke, 'stroke-width': o.strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': o.dasharray };
    if (o.transform) attrs.transform = o.transform;
    return svgElement('path', attrs);
  }

  function svgRect(x, y, w, h, opts) {
    var o = merge({ fill: SVG_DEFAULTS.fill, stroke: SVG_DEFAULTS.stroke, strokeWidth: SVG_DEFAULTS.strokeWidth }, opts);
    return svgElement('rect', { x: x, y: y, width: w, height: h, rx: o.rx || 0,
      fill: o.fill, stroke: o.stroke, 'stroke-width': o.strokeWidth, 'stroke-dasharray': o.dasharray });
  }

  // ============ viewBox 计算 ============
  
  // ============ 性能缓存（任务 3.3） ============
  // computeViewBox / svgWrap 均为确定性纯函数，相同输入必得相同输出。一次性生成大量题目
  // （如 50 道几何/竖式）时缓存可避免重复的字符串正则解析与拼接，降低主线程阻塞。
  var __vbCache = (typeof Map !== 'undefined') ? new Map() : null;
  var __wrapCache = (typeof Map !== 'undefined') ? new Map() : null;
  var EMPTY_BOX = { minX: 0, minY: 0, width: SVG_DEFAULTS.width, height: SVG_DEFAULTS.height };
  
  function memoize(fn, resolver) {
    var cache = (typeof Map !== 'undefined') ? new Map() : {};
    return function () {
      var key = resolver ? resolver.apply(this, arguments) : arguments[0];
      var hit = (cache instanceof Map) ? cache.has(key) : Object.prototype.hasOwnProperty.call(cache, key);
      if (hit) return (cache instanceof Map) ? cache.get(key) : cache[key];
      var val = fn.apply(this, arguments);
      if (cache instanceof Map) cache.set(key, val); else cache[key] = val;
      return val;
    };
  }
  
  function clearCache() {
    if (__vbCache) __vbCache.clear();
    if (__wrapCache) __wrapCache.clear();
  }

  function computeViewBox(elements, options) {
    var pad = options && options.padding != null ? options.padding : SVG_DEFAULTS.padding;
    var src = Array.isArray(elements) ? elements.join('') : String(elements || '');
    var cacheKey = src + '|' + pad;
    if (__vbCache && __vbCache.has(cacheKey)) return __vbCache.get(cacheKey);
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function grow(x1, y1, x2, y2) {
      if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return;
      if (x1 < minX) minX = x1; if (y1 < minY) minY = y1;
      if (x2 > maxX) maxX = x2; if (y2 > maxY) maxY = y2;
    }
    var tagRe = /<(circle|ellipse|rect|line|text|polygon|polyline|path)\b([^>]*)>/g;
    var tm;
    while ((tm = tagRe.exec(src))) {
      var tag = tm[1], attrStr = tm[2];
      var attrs = {};
      var am, attrRe = /([\w:-]+)\s*=\s*"([^"]*)"|([\w:-]+)\s*=\s*'([^']*)'/g;
      while ((am = attrRe.exec(attrStr))) {
        if (am[1]) attrs[am[1]] = am[2]; else attrs[am[3]] = am[4];
      }
      var num = function (k, dv) { var v = parseFloat(attrs[k]); return isFinite(v) ? v : dv; };
      var sw = num('stroke-width', 0) / 2;
      if (tag === 'circle') {
        var cr = num('r', 0);
        grow(num('cx') - cr - sw, num('cy') - cr - sw, num('cx') + cr + sw, num('cy') + cr + sw);
      } else if (tag === 'ellipse') {
        grow(num('cx') - num('rx') - sw, num('cy') - num('ry') - sw,
             num('cx') + num('rx') + sw, num('cy') + num('ry') + sw);
      } else if (tag === 'rect') {
        grow(num('x', 0) - sw, num('y', 0) - sw, num('x', 0) + num('width', 0) + sw, num('y', 0) + num('height', 0) + sw);
      } else if (tag === 'line') {
        grow(Math.min(num('x1'), num('x2')) - sw, Math.min(num('y1'), num('y2')) - sw,
             Math.max(num('x1'), num('x2')) + sw, Math.max(num('y1'), num('y2')) + sw);
      } else if (tag === 'polygon' || tag === 'polyline') {
        var pts = String(attrs.points || '').trim().split(/[\s,]+/).map(Number);
        for (var i = 0; i + 1 < pts.length; i += 2) grow(pts[i] - sw, pts[i + 1] - sw, pts[i] + sw, pts[i + 1] + sw);
      } else if (tag === 'text') {
        var fs = num('font-size', SVG_DEFAULTS.fontSize);
        var content = '';
        var closeIdx = src.indexOf('</text>', tm.index);
        if (closeIdx > tm.index) {
          var seg = src.slice(tm.index + tm[0].length, closeIdx).replace(/<[^>]*>/g, '');
          content = seg.replace(/&[a-z]+;|&#\d+;/gi, 'x');
        }
        var estW = fs * 0.62 * Math.max(content.length, 1);
        var anchor = attrs['text-anchor'] || 'start';
        var tx = num('x', 0), ty = num('y', 0);
        var x1 = anchor === 'middle' ? tx - estW / 2 : anchor === 'end' ? tx - estW : tx;
        grow(x1 - sw, ty - fs, x1 + estW + sw, ty + fs * 0.35);
      } else if (tag === 'path') {
        var nums = String(attrs.d || '').match(/-?\d+(?:\.\d+)?/g);
        if (nums) {
          for (var j = 0; j + 1 < nums.length; j += 2) {
            var px = parseFloat(nums[j]), py = parseFloat(nums[j + 1]);
            grow(px - sw, py - sw, px + sw, py + sw);
          }
        }
      }
    }
    if (!isFinite(minX)) return EMPTY_BOX;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    var vbResult = { minX: Math.floor(minX), minY: Math.floor(minY),
      width: Math.ceil(maxX - minX), height: Math.ceil(maxY - minY) };
    if (__vbCache) __vbCache.set(cacheKey, vbResult);
    return vbResult;
  }

  // ============ 包裹为完整 SVG ============
  
  function hexLighten(hex, f) {
    var m = /^#([0-9a-fA-F]{6})$/.exec(hex);
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function mix(c) { return Math.round(c + (255 - c) * f); }
    return '#' + ((1 << 24) + (mix(r) << 16) + (mix(g) << 8) + mix(b)).toString(16).slice(1);
  }
  
  var PRINT_AUX_STYLE = '<style>' +
    '[stroke-dasharray]{opacity:.42}' +
    '.svg-grid-line{opacity:.38}' +
    '</style>';
  function printTransform(innerSvg) {
    var out = String(innerSvg || '').replace(/#[0-9a-fA-F]{6}\b/g, function (hex) {
      return hexLighten(hex, 0.22);
    });
    return PRINT_AUX_STYLE + out;
  }

  
  function svgWrap(innerSvg, options) {
    var o = options || {};
    var body = (innerSvg || '');
    if (o.printMode) body = printTransform(body);
    // 缓存：相同内容 + 相同选项必得相同输出（任务 3.3）
    var wrapKey = body + '|' + JSON.stringify(o);
    if (__wrapCache && __wrapCache.has(wrapKey)) return __wrapCache.get(wrapKey);
    var vb = o.viewBox ||
      (function () { var b = computeViewBox(body, { padding: o.padding }); return b.minX + ' ' + b.minY + ' ' + b.width + ' ' + b.height; })();
    var parts = vb.split(/\s+/).map(Number);
    var w = o.width != null ? o.width : (parts[2] || SVG_DEFAULTS.width);
    var h = o.height != null ? o.height : (parts[3] || SVG_DEFAULTS.height);
    var attrs = {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: vb, width: w, height: h,
      role: 'img', preserveAspectRatio: o.preserveAspectRatio || 'xMidYMid meet'
    };
    if (o.className) attrs.class = o.className;
    if (o.printMode) attrs.class = attrs.class ? (attrs.class + ' svg-print') : 'svg-print';
    var bg = o.background ? svgElement('rect', { x: parts[0], y: parts[1], width: parts[2], height: parts[3], fill: o.background }) : '';
    var style = o.style ? ' style="' + escAttr(o.style) + '"' : '';
    var out = '<svg' + attrsStr(attrs) + style + '>' + bg + body + '</svg>';
    if (__wrapCache) __wrapCache.set(wrapKey, out);
    return out;
  }

  // ============ 书写格背景（任务：SVG 生成器细化） ============
  
  function svgGrid(kind, o) {
    o = o || {};
    var x = o.x || 0, y = o.y || 0;
    // 默认经 style 内联消费 tokens.css 书写格变量，
    // 可经 lineColor/baselineColor/frameColor 覆盖（四线格颜色可配置）。
    var isFourLine = kind === 'four-line';
    var frame = o.frameColor || 'var(--grid-tianzige-frame)';
    var aux = o.lineColor || (isFourLine ? 'var(--grid-fourline-line)' : 'var(--grid-tianzige-aux)');
    var baseline = o.baselineColor || 'var(--grid-fourline-baseline)';
    var parts = [];
    function rect(xx, yy, s) {
      parts.push(svgElement('rect', { x: xx, y: yy, width: s, height: s,
        fill: '#ffffff', class: 'svg-grid-frame',
        style: 'stroke:' + frame + ';stroke-width:2' }));
    }
    function gLine(x1, y1, x2, y2, color, sw, dash) {
      var style = 'stroke:' + color + ';stroke-width:' + sw + (dash ? ';stroke-dasharray:' + dash : '');
      parts.push(svgElement('line', { x1: x1, y1: y1, x2: x2, y2: y2,
        'class': 'svg-grid-line', style: style }));
    }
    if (kind === 'tian' || kind === 'mi' || kind === 'cross') {
      var s = o.size || 100;
      rect(x, y, s);
      var mx = x + s / 2, my = y + s / 2;
      if (kind === 'cross') {           // 十字格：实线中线
        gLine(x, my, x + s, my, aux, 1.4);
        gLine(mx, y, mx, y + s, aux, 1.4);
      } else {                          // 田字/米字：虚线中线
        gLine(x, my, x + s, my, aux, 1.5, '6 4');
        gLine(mx, y, mx, y + s, aux, 1.5, '6 4');
      }
      if (kind === 'mi') {              // 米字对角线
        gLine(x, y, x + s, y + s, aux, 1.2, '5 5');
        gLine(x + s, y, x, y + s, aux, 1.2, '5 5');
      }
    } else if (kind === 'four-line') {
      var topY = o.topY != null ? o.topY : 0;
      var gap = o.gap || 22;
      var lines = o.lines || 4;         // 四线三格默认 4 条横线
      for (var i = 0; i < lines; i++) {
        var isBase = i === lines - 1;
        gLine(x, topY + i * gap, x + (o.width || 120), topY + i * gap,
          isBase ? baseline : aux, isBase ? 1.8 : 1.3);
      }
    } else {
      throw new Error('svgGrid: 未知格线类型 ' + kind);
    }
    return parts.join('');
  }

  // ============ 导出 ============
  var SVGUtil = {
    SVG_DEFAULTS: SVG_DEFAULTS,
    escAttr: escAttr,
    escText: escText,
    svgElement: svgElement,
    svgText: svgText,
    svgLine: svgLine,
    svgPolygon: svgPolygon,
    svgPolyline: svgPolyline,
    svgCircle: svgCircle,
    svgRect: svgRect,
    svgPath: svgPath,
    computeViewBox: computeViewBox,
    svgWrap: svgWrap,
    svgGrid: svgGrid,
    hexLighten: hexLighten,
    memo: memoize,
    clearCache: clearCache
  };

  global.SVGUtil = SVGUtil;
  global.SVG_DEFAULTS = SVG_DEFAULTS;

  // 任务7：科目化命名空间。核心工具挂载为 SVGGenerators.core（同一引用，非拷贝）；
  // 各科目生成器由对应文件挂载到 SVGGenerators.math / cn / en，全局旧名保留兼容。
  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.core = SVGUtil;

  if (typeof module !== 'undefined') module.exports = SVGUtil;
})(typeof window !== 'undefined' ? window : global);

};
__defs["shared/presentation/svg-sanitizer.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  // 允许的标签（无脚本、无外联、无嵌入能力的安全子集；键一律小写）
  var ALLOWED_TAGS = {
    svg: 1, g: 1, defs: 1, desc: 1, title: 1,
    marker: 1, mask: 1, pattern: 1, clippath: 1,
    lineargradient: 1, radialgradient: 1, stop: 1,
    circle: 1, ellipse: 1, rect: 1, line: 1,
    polyline: 1, polygon: 1, path: 1, text: 1, tspan: 1
  };

  // 允许的属性（形状/几何/外观/标注；不含事件与引用）
  var ALLOWED_ATTRS = {
    'xmlns': 1, 'xmlns:xlink': 1,
    'viewbox': 1, 'preserveaspectratio': 1,
    'width': 1, 'height': 1,
    'role': 1, 'aria-label': 1, 'focusable': 1,
    'class': 1, 'id': 1, 'transform': 1,
    'd': 1, 'x': 1, 'y': 1, 'x1': 1, 'y1': 1, 'x2': 1, 'y2': 1,
    'cx': 1, 'cy': 1, 'r': 1, 'rx': 1, 'ry': 1,
    'points': 1, 'fill': 1, 'stroke': 1,
    'stroke-width': 1, 'stroke-dasharray': 1,
    'stroke-linecap': 1, 'stroke-linejoin': 1,
    'stroke-opacity': 1, 'fill-opacity': 1, 'fill-rule': 1,
    'clip-rule': 1, 'clip-path': 1, 'opacity': 1,
    'font-size': 1, 'font-family': 1, 'font-weight': 1,
    'font-style': 1, 'text-anchor': 1,
    'stop-color': 1, 'stop-opacity': 1, 'offset': 1,
    'gradientunits': 1, 'gradienttransform': 1, 'spreadmethod': 1,
    'marker-start': 1, 'marker-mid': 1, 'marker-end': 1,
    'style': 1
  };

  // 已知执行/外联特征（终检仍命中即整体拒收）
  var HOSTILE = /<script|<foreignObject|<iframe|<object\b|<embed\b|on[A-Za-z]+\s*=|\sstyle\s*=\s*["']?\s*(?:url\s*\(|expression|import|<|javascript)|url\s*\(\s*["']?\s*(?:javascript|data:[^,]*\<)/i;

  function escAttr(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escText(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  
  function parseAttrs(attrStr) {
    var attrs = {};
    var re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    var m;
    while ((m = re.exec(attrStr))) {
      attrs[m[1]] = m[2] != null ? m[2] : (m[3] != null ? m[3] : (m[4] != null ? m[4] : ''));
    }
    return attrs;
  }

  
  function sanitizeSvg(input) {
    if (typeof input !== 'string') return '';
    var src = String(input);
    if (!src) return '';

    var re = /<!--[\s\S]*?-->|<\/?([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))*)\s*(\/?)>/g;
    var out = '';
    var stack = [];
    var pos = 0;
    var m;

    function inDiscarded() {
      for (var i = stack.length - 1; i >= 0; i--) if (!stack[i].allowed) return true;
      return false;
    }

    while ((m = re.exec(src))) {
      if (!inDiscarded()) out += escText(src.slice(pos, m.index));  // 丢弃子树外文本（转义）
      pos = re.lastIndex;
      if (m[0].indexOf('<!--') === 0) continue;  // 丢弃注释

      var name = m[1];                 // 原始大小写（SVG 渐变等标签大小写敏感，须保留）
      var keyName = name.toLowerCase();
      var selfClose = m[3] === '/';
      var discarded = inDiscarded();

      if (m[0].charAt(1) === '/') {
        // 闭合标签：弹出至同名（自动收拢中间未配对帧），仅当本帧被允许且祖先未被丢弃才输出
        var f = null;
        while (stack.length) {
          var top = stack.pop();
          if (top.key === keyName) { f = top; break; }
        }
        if (f && f.allowed && !inDiscarded()) out += '</' + name + '>';
        continue;
      }

      if (selfClose) {
        if (!discarded && ALLOWED_TAGS[keyName]) {
          out += '<' + name + emitAttrs(m[2]) + '/>';
        }
        continue;
      }

      var allowedHere = !discarded && !!ALLOWED_TAGS[keyName];
      stack.push({ key: keyName, allowed: allowedHere });
      if (allowedHere) out += '<' + name + emitAttrs(m[2]) + '>';
    }
    out += escText(src.slice(pos));              // 尾部文本（转义）

    if (HOSTILE.test(out)) return '';
    // 空白 / 无任何白名单元素 → 拒收
    if (!/<([A-Za-z])/.test(out)) return '';
    return out;
  }

  function emitAttrs(attrStr) {
    var attrs = parseAttrs(attrStr);
    var out = '';
    Object.keys(attrs).forEach(function (k) {
      var lk = k.toLowerCase();
      if (!ALLOWED_ATTRS[lk]) return;
      var v = attrs[k];
      if (lk === 'style' && /url\s*\(|expression|import|<|javascript/i.test(v)) return;
      out += ' ' + k + '="' + escAttr(v) + '"';
    });
    return out;
  }

  var API = {
    sanitizeSvg: sanitizeSvg,
    ALLOWED_TAGS: ALLOWED_TAGS,
    ALLOWED_ATTRS: ALLOWED_ATTRS
  };

  global.SVGSanitizer = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);
};
global.PresentationEngine = __req("shared/engine/presentation-engine.js");
global.PresentationBundle = __req("shared/engine/presentation-engine.js");
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));