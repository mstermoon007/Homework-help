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
  correctness: 0.225,
  knowledgeAlignment: 0.18,
  difficultyAlignment: 0.135,
  structuralValidity: 0.135,
  renderability: 0.135,
  uniqueness: 0.09,
  explanationQuality: 0.10
};

function coerceNumber(v) { var n = Number(v); return isNaN(n) ? null : n; }
function coerceString(v) { return v == null ? '' : String(v); }

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

// P40-Q-10：解析质量维（explanationQuality）四判据等权（各 0.25）
//   ① 非空（sq.answer.explanation，schema defaultAnswer 单源）
//   ② 非复述（非「题面原文 + 纯答案尾巴」照抄模板、非题面截断）
//   ③ 含分步标记（四步词/序号圈/第N步/因果-顺序连接/法则依据/演算等式）
//   ④ 答案一致（解析含正确答案值，规范化子串匹配）
var STEP_MARK_RE = /[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮]|第[一二三四五六七八九十百\d]+步|题意|列式|计算|所以|因此|因为|先|再|然后|法则|依据|根据|推理|步骤|原理|[=＝]/;

// 规范化：去空白与标点，统一全角等号/负号，保留中文、字母数字与运算符（供 ②④ 匹配）
function normalizeExplText(s) {
  return coerceString(s)
    .replace(/−/g, '-')
    .replace(/＝/g, '=')
    .replace(/[^\u4e00-\u9fa50-9a-zA-Z=+\-*/×÷().]/g, '');
}

function explanationAnswerString(sq) {
  var v = sq && sq.answer ? sq.answer.value : null;
  return v == null ? '' : normalizeExplText(v);
}

// ② 复述判定：题面照抄（纯复制/题面截断）或题面 + 「(所以/因此)?答案是X」纯答案陈述（旧复述模板）。
//   题面以等号收尾且尾巴恰为答案 = 算式补全（Q-09 calc 演算形态），非复述。
function isExplanationRestatement(normExpl, normPrompt, normAns) {
  if (!normPrompt || !normExpl) return false;
  if (normExpl.indexOf(normPrompt) === 0) {
    var tail = normExpl.slice(normPrompt.length);
    if (tail === '') return true; // 纯照抄
    var m = /^(所以|因此)?(答案是|答案为|答[:：])/.exec(tail);
    if (m) return tail.slice(m[0].length) === normAns; // 题面 + 纯答案陈述
    return false; // 其余尾巴（含算式补全「= 8」）非复述
  }
  return normPrompt.indexOf(normExpl) === 0 && normExpl.length >= 4;
}

function scoreExplanationQuality(sq) {
  var expl = sq && sq.answer ? coerceString(sq.answer.explanation).trim() : '';
  if (!expl) return 0; // ① 非空
  var passed = 1;
  var normExpl = normalizeExplText(expl);
  var normPrompt = normalizeExplText(sq && sq.prompt != null ? sq.prompt : '');
  var normAns = explanationAnswerString(sq);
  if (!isExplanationRestatement(normExpl, normPrompt, normAns)) passed++; // ②
  if (STEP_MARK_RE.test(expl)) passed++; // ③
  if (normAns !== '' && normExpl.indexOf(normAns) !== -1) passed++; // ④
  return passed / 4;
}


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

  // ⑦ Explanation Quality (解析质量) — P40-Q-10（四判据等权，见 scoreExplanationQuality）
  breakdown.explanationQuality = scoreExplanationQuality(sq);

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

// P40 T-07：概念族内难度递进断言——同 familyId 内 stageOrder 靠后的 KP，seedDifficulty 不得低于前序。
// 违规登记 needs-review（挂人工），不自动改数；difficultyDelta 现算不落盘。
// 消费面：KBL capability（familyId + stageOrder + seedDifficulty）经只读透出后校验。
function validateFamilyDifficultyMonotonic(rows) {
  var byFam = {};
  (rows || []).forEach(function (r) {
    if (r && r.familyId != null && r.stageOrder != null && r.seedDifficulty != null) {
      (byFam[r.familyId] = byFam[r.familyId] || []).push(r);
    }
  });
  var violations = [];
  var checked = 0;
  Object.keys(byFam).forEach(function (f) {
    var arr = byFam[f].slice().sort(function (a, b) { return a.stageOrder - b.stageOrder; });
    checked += arr.length;
    for (var i = 1; i < arr.length; i++) {
      if (arr[i].seedDifficulty < arr[i - 1].seedDifficulty) {
        violations.push({
          familyId: f,
          fromId: arr[i - 1].knowledgeId, fromStageOrder: arr[i - 1].stageOrder, fromDifficulty: arr[i - 1].seedDifficulty,
          toId: arr[i].knowledgeId, toStageOrder: arr[i].stageOrder, toDifficulty: arr[i].seedDifficulty,
          difficultyDelta: arr[i].seedDifficulty - arr[i - 1].seedDifficulty
        });
      }
    }
  });
  return { valid: violations.length === 0, checked: checked, families: Object.keys(byFam).length, violations: violations, needsReview: violations.slice() };
}

module.exports = {
  validateDifficultyIntegrity: validateDifficultyIntegrity,
  validateBatchDifficultyIntegrity: validateBatchDifficultyIntegrity,
  validateFamilyDifficultyMonotonic: validateFamilyDifficultyMonotonic
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
  var supported = (kpConstraints.generationCapabilities || []).map(function(c){ return c.id; });
  var allAllowed = Array.from(new Set(allowed.concat(supported)));
  
  // P41-A1：题型字段与其余检查（checkSemanticEvidence/checkTypeContract/checkIntentAlignment）同口径。
  // SemanticQuestion 工厂写入 sq.questionType（见 semantic-question.js createSemanticQuestion），
  // sq.questionTypeId 为兼容别名。此前仅读 sq.questionTypeId → 该检查对生产题目恒为 no-op。
  var qt = sq.questionType || sq.questionTypeId || null;
  if (allAllowed.length && qt && allAllowed.indexOf(qt) === -1) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_QUESTION_TYPE, 'questionType', '题型 ' + qt + ' 不在 KP 允许范围内: ' + allAllowed.join(','), SEVERITY.ERROR, { allowed: allAllowed, actual: qt }));
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

// P40-Q-06（方案 A，用户批准）：课标笔算竖式判定——type=calculation 且 role=calculation-support
// 的计算支撑图不属意图示意图，intent.graphicRole=null / allowedRepresentations 不含 graphic
// 的行允许携带；防泄题由 SVG maskResult 与 6g 泄露门禁承担。
function isVerticalSupportGraphic(g) {
  return !!(g && g.type === 'calculation' && g.role === 'calculation-support');
}

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
  //    P40-Q-06 豁免：课标笔算竖式（isVerticalSupportGraphic）为计算支撑图，不拦。
  var hasGraphic = !!(sq.data && sq.data.graphic);
  var allowedReps = intent.allowedRepresentations || [];
  if (allowedReps.length && allowedReps.indexOf('graphic') === -1 && hasGraphic && !isVerticalSupportGraphic(sq.data.graphic)) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'representation',
      'intent.allowedRepresentations 不含 graphic 但题目含图形',
      SEVERITY.ERROR, { allowedRepresentations: allowedReps, hasGraphic: hasGraphic }));
  }

  // 3. graphicRole 对齐（P30-22/27/28 + P38-06 双轨统一）
  //    intent.graphicRole（Intent 层，表"题目对图形的需求"）取值：
  //      carrier（图为核心载体，必须配图）/ auxiliary（需参考图，必须配图）/ null（纯文字，禁图）。
  //    graphic.role（Generator 层，表"图的具体语义角色"）取值：
  //      quantity-correspondence/number-position/angle-measure/fraction-part/area-measure/
  //      data-comparison/calculation-support/auxiliary（两轨 auxiliary 语义不同，见下注释）。
  //    两轨不同维度，不强制相等；仅校验 graphic.role 属于合法枚举。
  //    P38-06：auxiliary 从"不约束有无"收紧为"必须配图"——与 carrier 同等强制约束，
  //    语义区分：carrier=图为核心载体（图本身是答案），auxiliary=需参考图（图为解题材料）。
  //    实测 397 条 auxiliary 权威行全部配图（断链清零后无遗漏），收紧安全。
  var graphicRole = intent.graphicRole;
  var GRAPHIC_ROLES = {
    'quantity-correspondence': 1, 'number-position': 1, 'angle-measure': 1,
    'fraction-part': 1, 'area-measure': 1, 'data-comparison': 1,
    'calculation-support': 1, 'auxiliary': 1, 'carrier': 1
  };
  // carrier/auxiliary → 必须含 graphic（图为核心或参考材料，缺图则教学语义不完整）
  if ((graphicRole === 'carrier' || graphicRole === 'auxiliary') && !hasGraphic) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'graphicRole',
      'intent.graphicRole=' + graphicRole + ' 要求题目必须含图形，实际未含',
      SEVERITY.ERROR, { graphicRole: graphicRole, hasGraphic: hasGraphic }));
  }
  if (graphicRole === null && hasGraphic && !isVerticalSupportGraphic(sq.data.graphic)) {
    // P40-Q-06 豁免：课标笔算竖式为计算支撑图，不属意图示意图，不拦（见 isVerticalSupportGraphic）。
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'graphicRole',
      'intent.graphicRole=null 要求题目不含图形，实际含图形',
      SEVERITY.ERROR, { graphicRole: graphicRole, hasGraphic: hasGraphic }));
  }
  // P30-27：graphic.role 合法性校验。
  // 注意：intent.graphicRole（carrier/auxiliary/null，表"题目对图形的需求"）与
  // graphic.role（quantity-correspondence/angle-measure/.../auxiliary，表"图的具体语义角色"）
  // 是不同维度，不强制相等；仅校验 graphic.role 属于合法枚举。
  // carrier 仅 Intent 层使用（Generator 侧零产出），auxiliary 在两轨语义不同：
  //   Intent auxiliary = 需参考图（必须配图）；Generator auxiliary = 非核心语义载体（涂色/认识图形）。
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

  // 5. constructs 对齐（P40-Q-03 requiredConstructs 接通）：题目实际运算落在教学构念域内。
  //    requiredConstructs（T2 qt-intent 机器约束，运算枚举全称）是本 KP×题型要求覆盖的运算构念；
  //    宽松兼容规则（与 P28-SEM-GATE-01 mixed 口径同型）：
  //      a. 归一后 op ∈ rc                    → pass
  //      b. rc 含 mixed（宽构念域，四则任一均在语义域内）→ pass
  //      c. op=mixed 且 rc 含 ≥2 种四则       → pass
  //      其余 → FAIL（SEVERITY.ERROR，运算越界即教学构念失守）。
  //    跳过：rc 空/缺失（T2 未派生构念约束）、题目无 data.operation。
  var rcRaw = intent.requiredConstructs || [];
  var sqOpC = sq.data && sq.data.operation;
  if (rcRaw.length && sqOpC != null) {
    var rcNorm = rcRaw.map(normalizeOp);
    var sqOpsC = (Array.isArray(sqOpC) ? sqOpC : [sqOpC]).map(normalizeOp);
    var constructMismatch = sqOpsC.some(function (op) {
      if (rcNorm.indexOf(op) !== -1) return false;
      if (rcNorm.indexOf('mixed') !== -1) return false;
      if (op === 'mixed') {
        var four = ['add', 'sub', 'mult', 'div'].filter(function (f) { return rcNorm.indexOf(f) !== -1; });
        return four.length < 2;
      }
      return true;
    });
    if (constructMismatch) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'constructs',
        '题目运算 ' + JSON.stringify(sqOpC) + ' 不在 intent.requiredConstructs ' + JSON.stringify(rcRaw) + ' 构念域内',
        SEVERITY.ERROR, { requiredConstructs: rcRaw, questionOperation: sqOpC }));
    }
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
  // P38-06 双轨统一：graphic.role（Generator 层，表"图的具体语义角色"）与
  // intent.graphicRole（Intent 层，表"题目对图形的需求" carrier/auxiliary/null）是不同维度。
  // carrier 仅 Intent 层使用（Generator 侧零产出，不在本枚举）；
  // auxiliary 在两轨语义不同：Generator auxiliary = 非核心语义载体（涂色/认识图形），
  // Intent auxiliary = 需参考图（P38-06 收紧为必须配图）。
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

  
  var A11Y_TYPE_LABELS = {
    geometry: '几何图形图', calculation: '竖式计算图', makeTen: '凑十法演示图', 'make-ten': '凑十法演示图',
    diagram: '示意图', chart: '统计图表', currency: '人民币演示图', fraction: '分数示意图',
    clock: '钟面图', area: '面积演示图', dataStats: '数据统计图', draw: '作图演示图',
    competition: '竞赛示意图', segment: '线段图', 'view-cards': '视图观察卡',
    custom: '题目示意图', illustration: '题目插图'
  };
  var A11Y_ROLE_LABELS = {
    'quantity-correspondence': '数量对应图', 'number-position': '数与位置图',
    'angle-measure': '角度度量图', 'fraction-part': '分数份数图',
    'area-measure': '面积度量图', 'data-comparison': '数据比较图',
    'calculation-support': '计算辅助图', 'auxiliary': '辅助示意图'
  };
  function escText(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function a11yTitle(graphic) {
    if (!graphic || typeof graphic !== 'object') return '题目示意图';
    var role = graphic.role != null ? graphic.role : (graphic.params && graphic.params.role);
    if (A11Y_ROLE_LABELS[role]) return A11Y_ROLE_LABELS[role];
    return A11Y_TYPE_LABELS[graphic.type] || '题目示意图';
  }
  function injectA11yTitle(svg, graphic) {
    if (typeof svg !== 'string' || svg.indexOf('<title') !== -1) return svg;
    var m = svg.match(/^<svg\b[^>]*>/i);
    if (!m) return svg;
    return svg.slice(0, m[0].length) + '<title>' + escText(a11yTitle(graphic)) + '</title>' + svg.slice(m[0].length);
  }

  
  function render(graphic, options) {
    var result = renderFor(graphic, options);
    if (result.status !== 'SUCCESS') return result;
    var U = getSVGUtil();
    if (U && typeof U.svgWrap === 'function' && result.svg.indexOf('<svg') !== 0) {
      try {
        var wrapped = U.svgWrap(result.svg, { padding: 8 });
        result = { status: 'SUCCESS', svg: wrapped };
      } catch (e) {
        return { status: 'FAILED', reason: 'svgWrap threw exception', error: e };
      }
    }
    // P40-Q-15（R22）：成功产物注入 <title> 可访问名（读屏可用；屏幕阅读器播报图形角色）
    return { status: 'SUCCESS', svg: injectA11yTitle(result.svg, graphic) };
  }

  var SVGRegistry = {
    register: register,
    seedFromGlobal: seedFromGlobal,
    resolve: resolve,
    render: render,
    renderFor: renderFor,
    // P40-Q-15：无障碍标签枚举对外暴露（唯一 SSOT；6g L2 据此校验 <title> 合法性）
    A11Y_TYPE_LABELS: A11Y_TYPE_LABELS,
    A11Y_ROLE_LABELS: A11Y_ROLE_LABELS
  };

  // 挂到既有全局命名空间（与 shared/svg-*.js 的挂载共存），提供正式 API
  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.register = register;

  global.SVGRenderer = { render: render, resolve: resolve, register: register, renderFor: renderFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = SVGRegistry;
  return SVGRegistry;
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