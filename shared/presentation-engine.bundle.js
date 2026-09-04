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
__defs["shared/presentation-engine.js"] = function (module, exports, require) {
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

var Selector = require("shared/generator/generator-selector.js");
var GeneratorContract = require("shared/generator/generator-contract.js");
var Pipeline = require("shared/validator/validation-pipeline.js");
var RetryLoop = require("shared/generator/retry-loop.js");
var BatchValidator = require("shared/validator/batch-validator.js");
var Quality = require("shared/validator/quality-scorer.js");
var SQ = require("shared/semantic-question.js");
var LegacyAdapter = require("shared/generator/legacy-adapter.js");
var FeatureFlags = require("shared/feature-flags.js");
var Logger = require("shared/logger.js");
var QID = require("shared/question-id.js");
var Metrics = require("shared/metrics.js");

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

  var PU = (typeof global !== 'undefined' && global.PluginUtil) || require("shared/render.js");
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
  var PU = (typeof global !== 'undefined' && global.PluginUtil) || require("shared/render.js");
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
};
__defs["shared/generator/generator-contract.js"] = function (module, exports, require) {
/**
 * shared/generator/generator-contract.js — M5-R17 Generator 契约升级
 *
 * 新契约：
 *   generate(plan) → Promise<SemanticQuestion[]> | SemanticQuestion[]
 *
 * 旧插件通过 LegacyAdapter 桥接：
 *   Legacy Plugin (generateQuestions)
 *         ↓ LegacyPluginAdapter
 *         ↓ SemanticQuestion[]
 */
'use strict';

var SQ = require("shared/semantic-question.js");
var LegacyAdapter = require("shared/generator/legacy-adapter.js");
var Pipeline = require("shared/validator/validation-pipeline.js");
var BatchValidator = require("shared/validator/batch-validator.js");
var RetryLoop = require("shared/generator/retry-loop.js");
var QID = require("shared/question-id.js");

// ====== 新契约接口定义 ======
var GENERATOR_CONTRACT = {
  // 必填字段
  REQUIRED_FIELDS: ['id', 'generate'],

  // 标准 plan 结构
  PLAN_SCHEMA: {
    knowledgePointId: { required: true, type: 'string' },
    questionTypeId: { required: true, type: 'string' },
    difficulty: { required: true, type: 'number', min: 1, max: 10 },
    count: { required: true, type: 'number', min: 1 },
    seed: { required: false, type: 'string' },
    constraints: { required: false, type: 'object' },
    planId: { required: false, type: 'string' }
  },

  // 输出结构
  OUTPUT_SCHEMA: {
    // 必须是 SemanticQuestion[]
    items: {
      id: { type: 'string', required: true },
      version: { type: 'number', required: true },
      knowledgePoint: { type: 'string', required: true },
      difficulty: { type: 'number', required: true },
      question: { type: 'object', required: true },
      answer: { type: 'object', required: true },
      metadata: { type: 'object', required: true }
    }
  }
};

/**
 * 创建新契约 Generator（标准化接口）
 * @param {Object} impl { generate(plan): SemanticQuestion[], capabilities?, knowledgePoints?, version? }
 * @returns {Object} 符合新契约的 Generator 实例
 */
function createGenerator(impl) {
  impl = impl || {};
  if (typeof impl.generate !== 'function') {
    throw new Error('Generator 必须实现 generate(plan) 方法');
  }

  var generatorId = impl.id || 'generator:unknown';
  var generatorVersion = impl.version || '1.0.0';
  var capabilities = impl.capabilities || [];
  var knowledgePoints = impl.knowledgePoints || [];

  var gen = {
    id: generatorId,
    version: generatorVersion,
    capabilities: capabilities,
    knowledgePoints: knowledgePoints,

    /**
     * 核心生成方法（新契约）
     * @param {Object} plan QuestionPlan
     * @returns {Promise<SemanticQuestion[]> | SemanticQuestion[]}
     */
    generate: function (plan) {
      // 1. 验证 plan
      if (!plan || !plan.knowledgePointId || !plan.questionTypeId || plan.difficulty == null) {
        throw new Error('Plan 缺少必填字段: knowledgePointId, questionTypeId, difficulty');
      }

      // 2. 派生 seed
      var baseSeed = plan.seed || require("shared/question-id.js").generateBaseSeed();
      var seeds = require("shared/question-id.js").generateSeedsForPlan({
        seed: baseSeed,
        generatorId: impl.id || 'unknown',
        count: plan.count || 1
      });

      // 3. 逐题生成
      var questions = [];
      for (var i = 0; i < (plan.count || 1); i++) {
        var itemPlan = Object.assign({}, plan, { seed: seeds[i], index: i });
        var sq = impl.generateItem ? impl.generateItem(itemPlan) : impl.generate(itemPlan);
        // 支持单题或批量返回
        var arr = Array.isArray(sq) ? sq : [sq];
        arr.forEach(function (item) {
          questions.push(normalizeOutput(item, itemPlan, i));
        });
      }

      // 限制数量
      if (questions.length > (plan.count || 1)) {
        questions = questions.slice(0, plan.count || 1);
      }

      return questions.length === 1 ? questions[0] : questions;
    },

    // 批量生成（兼容旧计划接口）
    generateBatch: function (plan) {
      var result = this.generate(plan);
      return Array.isArray(result) ? result : [result];
    }
  };

  return gen;
}

/**
 * 标准化输出为 SemanticQuestion
 */
function normalizeOutput(item, plan, index) {
  if (item && item.id && item.metadata && item.metadata.generator) {
    return item; // 已是标准格式
  }
  // 兜底：创建标准结构
  return require("shared/semantic-question.js").createSemanticQuestion(Object.assign({}, item, {
    generator: item.generator || 'generator:' + (item.id || 'unknown'),
    generatorVersion: item.generatorVersion || '1.0.0',
    seed: plan.seed,
    index: index,
    knowledgePoint: plan.knowledgePointId,
    difficulty: plan.difficulty,
    questionType: plan.questionTypeId
  }));
}

/**
 * Legacy Plugin Adapter（旧插件 → 新契约）
 * 将旧插件的 generateQuestions(opts) 包装为新契约 generate(plan)
 */
function createLegacyGenerator(legacyPlugin, meta) {
  meta = meta || {};
  var legacyId = meta.id || legacyPlugin.id || 'legacy:unknown';
  var capabilities = meta.capabilities || [];
  var knowledgePoints = meta.knowledgePoints || [];

  return {
    id: 'legacy:' + legacyId,
    version: meta.version || '1.0.0',
    capabilities: capabilities,
    knowledgePoints: knowledgePoints,

    generate: function (plan) {
      // 将 Plan 转换为 Legacy opts
      var opts = {
        count: plan.count || 10,
        grade: plan.grade,
        difficulty: plan.difficulty,
        knowledgePointId: plan.knowledgePointId,
        questionType: plan.questionTypeId,
        seed: plan.seed,
        // 透传约束
        difficultyParams: plan.constraints
      };

      // 调用旧插件
      var legacyResult = legacyPlugin.generateQuestions ? legacyPlugin.generateQuestions(opts) :
                         legacyPlugin.generate ? legacyPlugin.generate(opts) : { questions: [] };

      var rawQuestions = legacyResult.questions || legacyResult || [];

      // 转换为 SemanticQuestion
      return rawQuestions.map(function (q, i) {
        return LegacyAdapter.toLegacyQuestion(q, {
          generatorId: 'legacy:' + legacyId,
          generatorVersion: meta.version || '1.0.0',
          seed: plan.seed,
          planId: plan.planId,
          index: i,
          knowledgePointId: plan.knowledgePointId,
          difficulty: plan.difficulty
        });
      });
    }
  };
}

// ====== 源码禁止项（Generator 实现不得包含渲染/随机/自行决定难度代码） ======
var FORBIDDEN_PATTERNS = [
  { pattern: /\bMath\.random\b/, label: 'Math.random（随机数必须由注入的随机源提供）' },
  { pattern: /\bdocument\.(getElementById|querySelector|querySelectorAll|createElement|write|body|head)\b/, label: 'DOM 读取/操作' },
  { pattern: /\bwindow\.(document|location|alert|confirm|prompt)\b/, label: 'window UI 操作' },
  { pattern: /\.innerHTML\b|\.outerHTML\b|\.insertAdjacentHTML\b/, label: '直接生成 HTML' },
  { pattern: /<svg\b|createElementNS\s*\(\s*['"`]http:\/\/www\.w3\.org\/2000\/svg|\.setAttributeNS\s*\(/, label: '直接生成 SVG' },
  { pattern: /\bsvg\s*[:=]\s*['"`]/, label: 'SVG 字符串字面量（必须剥离至 GraphicRenderer）' },
  { pattern: /\bg\.appendChild\b|\bdocument\.createElementNS\b|\btextContent\s*=\s*['"`]/, label: 'DOM 渲染代码' },
  { pattern: /\bparamsFor\s*\(|\bdiffLevel\s*\(|\bcreateProfile\s*\(|\bconsume\s*\(/, label: '自行决定全局难度（必须消费 plan.difficulty/constraints）' }
];

// Generator 实现专用的难度/年级硬编码禁止（选择器/策略层可合法解释难度）
var GENERATOR_DIFFICULTY_PATTERNS = [
  { pattern: /\bif\s*\([^)]*\bdifficulty\b[^)]*(===|==|!==|!=|<|>|<=|>=)/, label: '难度硬编码条件（if difficulty === …，规则必须迁移至 Strategy）' },
  { pattern: /\bif\s*\([^)]*\bgrade\b[^)]*(===|==|!==|!=|<|>|<=|>=)/, label: '年级硬编码条件（if grade === …，规则必须迁移至 Strategy）' }
];

// SemanticQuestion 禁止字段（渲染/执行契约不得进入语义层）
var FORBIDDEN_KEYS = ['render', 'check', 'html', 'svg', 'generate', 'generator', 'template', 'execute'];

var SUBJECTS = { math: 'math', cn: 'cn', en: 'en', chinese: 'cn', english: 'en' };

function isEmptyGraphic(g) {
  if (g == null || typeof g !== 'object') return false;
  return (g.type == null) && (g.subtype == null) && (g.svg == null) &&
    (g.params == null || Object.keys(g.params).length === 0);
}

/**
 * 运行时轻量校验：仅检查必要接口存在性。
 * 正则扫描移至 dev/check-generator-contract.js (CI/开发时运行)。
 * @param {Object} gen
 * @returns {Object} { valid, errors: string[], warnings }
 */
function validateGeneratorContract(g) {
  var errors = [];
  var warnings = [];

  if (!g || typeof g !== 'object') {
    return { valid: false, errors: ['GeneratorContract 必须是对象'], warnings: warnings };
  }

  if (typeof g.generate !== 'function') errors.push('generate(plan) 必须是函数');
  if (typeof g.supports !== 'function') errors.push('supports(plan) 必须是函数');

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

/**
 * 运行新契约 Generator + Validator（内置重试）
 * @param {Object} gen 新契约 Generator
 * @param {Object} plan QuestionPlan
 * @param {Object} context { validatorEnabled, maxRetries, validatorMode }
 * @returns {Promise<{ questions, validationResults, retries, success }>}
 */
function runGeneratorWithValidation(gen, plan, context) {
  context = context || {};
  var validatorEnabled = context.validatorEnabled !== false;
  var maxRetries = context.maxRetries || 3;

  if (!validatorEnabled) {
    return Promise.resolve(gen.generate(plan)).then(function (questions) {
      return { questions: Array.isArray(questions) ? questions : [questions], validationResults: [], retries: 0, success: true };
    });
  }

  return require("shared/generator/retry-loop.js").generateWithRetry(
    function (p) { return gen.generate(p); },
    plan,
    { generatorId: gen.id, generatorVersion: gen.version, maxRetries: maxRetries, validatorEnabled: true }
  );
}

/**
 * 校验 SemanticQuestion（string-error 契约校验，兼容 flat/legacy 输入）。
 * @param {Object} q
 * @returns {Object} { valid, errors: string[] }
 */
function validateSemanticQuestion(q) {
  var errors = [];

  if (!q || typeof q !== 'object') {
    return { valid: false, errors: ['SemanticQuestion 必须是对象'] };
  }

  if (!q.knowledgePointId || typeof q.knowledgePointId !== 'string') errors.push('knowledgePointId 必填');
  var QTR = require("shared/question-type-registry.js");
  var qTypeValid = QTR.has(q.questionType) || SQ.Schema.isValidQuestionType(q.questionType) || q.questionType === 'read-aloud';
  if (!q.questionType || !qTypeValid) errors.push('questionType 非法: ' + q.questionType);
  if (q.difficulty == null || typeof q.difficulty !== 'number') errors.push('difficulty 必填（数字）');
  if (q.difficultyParams == null || typeof q.difficultyParams !== 'object') {
    errors.push('difficultyParams 必填');
  } else {
    ['level', 'scale', 'steps'].forEach(function (k) {
      if (typeof q.difficultyParams[k] !== 'number') errors.push('difficultyParams.' + k + ' 必填（数字）');
    });
  }
  if (q.numberRange == null || typeof q.numberRange.min !== 'number' || typeof q.numberRange.max !== 'number' || q.numberRange.min > q.numberRange.max) {
    errors.push('numberRange 非法: ' + JSON.stringify(q.numberRange));
  }
  // answerMode: 'input'（书面作答，answer 必填）| 'read-aloud'（跟读类，answer 可空）
  var answerMode = q.answerMode || 'input';
  if (answerMode !== 'input' && answerMode !== 'read-aloud') {
    errors.push('answerMode 非法: ' + answerMode);
  }
  if (answerMode === 'input' && q.answer == null) errors.push('answer 必填（input 模式）');
  if (q.prompt == null || typeof q.prompt !== 'string') errors.push('prompt 必填（字符串）');

  // M4-R11：graphic 必须是结构化描述（{ type, subtype, params }），不允许内嵌 SVG 字符串
  if (q.graphic != null && !isEmptyGraphic(q.graphic)) {
    if (typeof q.graphic !== 'object' || q.graphic === null) {
      errors.push('graphic 必须是 { type, subtype, params } 对象');
    } else {
      if (typeof q.graphic.type !== 'string' || q.graphic.type.length === 0) {
        errors.push('graphic.type 必填（字符串）');
      }
      if (q.graphic.subtype != null && typeof q.graphic.subtype !== 'string') {
        errors.push('graphic.subtype 必须是字符串');
      }
      if (q.graphic.params != null && typeof q.graphic.params !== 'object') {
        errors.push('graphic.params 必须是对象');
      }
      if (typeof q.graphic.svg === 'string') {
        errors.push('graphic 禁止内嵌 SVG 字符串（必须剥离至 GraphicRenderer）');
      }
    }
  }

  FORBIDDEN_KEYS.forEach(function (k) {
    if (q[k] !== undefined) errors.push('SemanticQuestion 禁止字段: ' + k + '（渲染/执行契约不得进入语义层）');
  });

  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  SUBJECTS: SUBJECTS,
  FORBIDDEN_PATTERNS: FORBIDDEN_PATTERNS,
  GENERATOR_DIFFICULTY_PATTERNS: GENERATOR_DIFFICULTY_PATTERNS,
  FORBIDDEN_KEYS: FORBIDDEN_KEYS,
  GENERATOR_CONTRACT: GENERATOR_CONTRACT,
  createGenerator: createGenerator,
  createLegacyGenerator: createLegacyGenerator,
  validateGeneratorContract: validateGeneratorContract,
  runGeneratorWithValidation: runGeneratorWithValidation,
  canonSubject: function (s) { return (s || 'math').toLowerCase(); },
  validateSemanticQuestion: validateSemanticQuestion
};
};
__defs["shared/generator/retry-loop.js"] = function (module, exports, require) {
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

var Validator = require("shared/validator/question-validator.js");
var Pipeline = require("shared/validator/validation-pipeline.js");
var QID = require("shared/question-id.js");

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
        // legacy 生成器可能不产 seed：幂等短路前先补 metadata.seed，保证 seed 可追溯
        if (q && q.seed == null) {
          q = Object.assign({}, q, { metadata: Object.assign({}, q.metadata, { seed: seed }) });
        }
        return require("shared/semantic-question.js").normalizeSemanticQuestion(Object.assign({}, q, {
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

module.exports = {
  generateWithRetry: generateWithRetry,
  DEFAULT_MAX_RETRIES: DEFAULT_MAX_RETRIES,
  RETRYABLE_CODES: RETRYABLE_CODES,
  FATAL_CODES: FATAL_CODES,
  isRetryable: isRetryable,
  isFatal: isFatal
};
};
__defs["shared/validator/batch-validator.js"] = function (module, exports, require) {
/**
 * shared/validator/batch-validator.js — M5-R15 Batch Question Validator
 *
 * 整套练习级验证：
 *   - 总数量
 *   - 知识点覆盖
 *   - 题型比例
 *   - 难度分布
 *   - 重复率
 *   - 答案完整率
 *   - 图形完整率
 *   - 题型分布是否符合 QuestionPlan
 */
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
  var plannedKPs = plan.knowledgePoints || [];
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
/**
 * shared/validator/quality-scorer.js — M5-R18 Question Quality Score
 *
 * 统一质量评分：
 *   - correctness: 1 (答案正确性)
 *   - knowledgeAlignment: 1 (知识点对齐)
 *   - difficultyAlignment: 1 (难度对齐)
 *   - structuralValidity: 1 (结构合法性)
 *   - renderability: 1 (可渲染性)
 *   - uniqueness: 1 (唯一性/去重)
 *
 * 总分：加权平均，范围 [0, 1]
 * 用于：QA、统计、Generator 对比、后续自动优化
 */
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

/**
 * 计算单题质量评分
 * @param {Object} sq SemanticQuestion
 * @param {Object} validationResult Pipeline.runPipeline 结果
 * @param {Object} context { seenKeys: Set, plan }
 * @returns {Object} { total, breakdown, details }
 */
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

/**
 * 批量评分
 * @param {Array<Object>} questions
 * @param {Array<Object>} validationResults
 * @param {Object} context
 * @returns {Array<Object>} 每题评分 + 汇总统计
 */
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

/**
 * Generator 级质量画像（用于 Generator 对比/优化）
 * @param {Array<Object>} scoredItems
 * @returns {Object}
 */
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
__defs["shared/feature-flags.js"] = function (module, exports, require) {
/**
 * shared/feature-flags.js — M5-R21 Feature Flags (questionValidation)
 *
 * 支持模式：
 *   off    - 关闭验证（兼容/性能）
 *   warn   - 仅记录警告，不阻断
 *   strict - 严格模式：错误阻断/重试
 *
 * 全局注册：window.FeatureFlags / global.FeatureFlags
 */
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
__defs["shared/logger.js"] = function (module, exports, require) {
/**
 * shared/logger.js — M5-R22 Production Logging (Question Validation)
 *
 * 记录：
 *   questionId, knowledgePointId, generator, generatorVersion,
 *   validationResult, errorCodes, retryCount, seed
 *
 * 支持多种输出：console、文件、远程端点（可配置）
 */
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
          try { require("fs").appendFileSync(t.path, JSON.stringify(entry) + '\n'); } catch (e) { /* ignore */ }
        } else if (t.type === 'remote' && t.url) {
          try { fetch(t.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }); } catch (e) { /* ignore */ }
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
__defs["shared/metrics.js"] = function (module, exports, require) {
/**
 * shared/metrics.js — P5-R03 Production Metrics
 *
 * 收集生产环境关键指标（仅用于开发诊断）：
 *   - 生成成功率
 *   - 验证失败率
 *   - Retry 次数分布
 *   - 重复率
 *   - 渲染失败率
 *
 * 仅内存存储，不持久化；可通过 dev/check-metrics.js 导出快照
 */
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
global.PresentationEngine = __req("shared/presentation-engine.js");
global.PresentationBundle = __req("shared/presentation-engine.js");
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));