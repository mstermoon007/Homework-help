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

'use strict';

var Selector = require("shared/generator/generator-selector.js");
var GeneratorContract = require("shared/generator/generator-contract.js");
var RetryLoop = require("shared/generator/retry-loop.js");
var BatchValidator = require("shared/validator/batch-validator.js");
var Quality = require("shared/validator/quality-scorer.js");
var SQ = require("shared/semantic-question.js");
var RenderFormat = require("shared/presentation/render-format.js");
var FeatureFlags = require("shared/feature-flags.js");
var Logger = require("shared/logger.js");
var QID = require("shared/question-id.js");
var Metrics = require("shared/metrics.js");


function generateQuestions(plan, options) {
  options = options || {};
  var ff = options.featureFlags || FeatureFlags;
  var logger = options.logger || Logger;
  var skipValidation = options.skipValidation || !ff.isValidationEnabled();
  var validatorMode = ff.getValidationMode();

  
  Metrics.recordGenerationStart({ generator: plan.generatorId || 'unknown', subject: plan.subject, grade: plan.grade });

  
  var primaryKp = (Array.isArray(plan && plan.knowledgePointIds) && plan.knowledgePointIds[0]) ||
    (plan && typeof plan.knowledgePointId === 'string' ? plan.knowledgePointId : null);

  
  var selection = Selector.selectGenerator(plan);
  if (!selection.record) {
    Metrics.recordGenerationFailure({ generator: 'none', subject: plan.subject, grade: plan.grade });
    return Promise.reject(new Error('无可用 Generator: ' + primaryKp));
  }

  
  var generator = Selector.instantiate(selection, selection.plugin);
  if (!generator) {
    Metrics.recordGenerationFailure({ generator: selection.record.id, subject: plan.subject, grade: plan.grade });
    return Promise.reject(new Error('Generator 实例化失败: ' + selection.record.id));
  }

  
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

    
    
    
    
    
    if (!result.success && (
      (!semanticQuestions || semanticQuestions.length === 0) ||
      result.error === 'GENERATION_SPACE_EXHAUSTED'
    )) {
      var err = new Error(((result.error || 'GENERATION_FAILED') + (result.message ? ': ' + result.message : '')));
      err.generationFailed = true;
      err.generationError = result.error || null;
      err.planKey = plan.planId || primaryKp || null;
      throw err;
    }

    var retries = result.retries;

    
    if (result.success) {
      Metrics.recordGenerationSuccess({ generator: selection.record.id, subject: plan.subject, grade: plan.grade });
      Metrics.recordRetryAttempt({ generator: selection.record.id, retries: retries, maxRetries: ff.getMaxRetries(), errorCodes: result.attempts ? result.attempts.flatMap(function (a) { return (a.errors || []).map(function (e) { return e.code; }); }) : [] });
    } else {
      Metrics.recordGenerationFailure({ generator: selection.record.id, subject: plan.subject, grade: plan.grade });
      Metrics.recordRetryAttempt({ generator: selection.record.id, retries: retries, maxRetries: ff.getMaxRetries(), errorCodes: result.attempts ? result.attempts.flatMap(function (a) { return (a.errors || []).map(function (e) { return e.code; }); }) : [] });
    }

    
    var batchResult = { valid: true, errors: [] };
    var validationResults = skipValidation ? [] : (result.validationResults || []);
    if (!skipValidation) {
      batchResult = BatchValidator.validateBatch(semanticQuestions, plan);

      
      validationResults.forEach(function (vr) {
        Metrics.recordValidationResult({ valid: vr.valid, generator: selection.record.id, subject: plan.subject, errors: vr.errors });
      });

      
      logger.logBatchValidation({
        planId: plan.planId,
        total: semanticQuestions.length,
        passed: validationResults.filter(function (r) { return r.valid; }).length,
        passRate: validationResults.filter(function (r) { return r.valid; }).length / semanticQuestions.length,
        errorSummary: validationResults.flatMap(function (r) { return r.errors || []; }).reduce(function (acc, e) { acc[e.code] = (acc[e.code] || 0) + 1; return acc; }, {}),
        qualityAvg: 0 
      });

      
      if (batchResult.duplicateRate != null) {
        Metrics.recordDuplicateCheck({ totalQuestions: semanticQuestions.length, duplicatesFound: Math.round(semanticQuestions.length * (batchResult.duplicateRate || 0)), generator: selection.record.id });
      }
    }

    
    var qualitySummary = { average: 1 };
    if (!skipValidation) {
      var qScores = Quality.scoreBatch(semanticQuestions, validationResults, {});
      qualitySummary = qScores.summary;
    }

    
    var outputQuestions = semanticQuestions;

    
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


function renderQuestions(questions, options) {
  if (!Array.isArray(questions) || !questions.length) return '';
  
  var isSemantic = questions[0] && questions[0].metadata && (questions[0].knowledgePoint || questions[0].content || questions[0].questionFingerprint);
  var renderableQuestions = isSemantic
    ? RenderFormat.toRenderableQuestions(questions)
    : questions;

  var PU = (typeof global !== 'undefined' && global.PluginUtil) || require("shared/render.js");
  try {
    var html;
    if (PU && PU.renderGrid) {
      html = PU.renderGrid(renderableQuestions, options);
    } else {
      html = renderableQuestions.map(function (q, i) { return PU.renderCard ? PU.renderCard(q, i, options) : ('<div>Q' + (i+1) + ': ' + (q.q||'') + '</div>'); }).join('');
    }
    Metrics.recordRenderResult({ success: true });
    return html;
  } catch (e) {
    Metrics.recordRenderResult({ success: false, errorType: e.name || 'RENDER_ERROR' });
    throw e;
  }
}


function checkAnswers(questions, userAnswers, options) {
  var PU = (typeof global !== 'undefined' && global.PluginUtil) || require("shared/render.js");
  if (PU && PU.defaultCheck) {
    return PU.defaultCheck(questions, userAnswers, options);
  }
  
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
  RenderFormat: RenderFormat
};


if (typeof window !== 'undefined') window.PresentationEngine = module.exports;
if (typeof global !== 'undefined') global.PresentationEngine = module.exports;
};
__defs["shared/generator/generator-contract.js"] = function (module, exports, require) {

'use strict';

var SQ = require("shared/semantic-question.js");
var Pipeline = require("shared/validator/validation-pipeline.js");
var BatchValidator = require("shared/validator/batch-validator.js");
var RetryLoop = require("shared/generator/retry-loop.js");
var QID = require("shared/question-id.js");


var GENERATOR_CONTRACT = {
  
  REQUIRED_FIELDS: ['id', 'generate'],

  
  PLAN_SCHEMA: {
    knowledgePointId: { required: true, type: 'string' },
    questionTypeId: { required: true, type: 'string' },
    difficulty: { required: true, type: 'number', min: 1, max: 10 },
    count: { required: true, type: 'number', min: 1 },
    seed: { required: false, type: 'string' },
    constraints: { required: false, type: 'object' },
    planId: { required: false, type: 'string' }
  },

  
  OUTPUT_SCHEMA: {
    
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

    
    generate: function (plan) {
      
      var primaryKp = (Array.isArray(plan && plan.knowledgePointIds) && plan.knowledgePointIds[0]) ||
        (plan && typeof plan.knowledgePointId === 'string' ? plan.knowledgePointId : null);
      if (!primaryKp || !plan.questionTypeId || plan.difficulty == null) {
        throw new Error('Plan 缺少必填字段: knowledgePointIds, questionTypeId, difficulty');
      }

      
      var baseSeed = plan.seed || require("shared/question-id.js").generateBaseSeed();
      var seeds = require("shared/question-id.js").generateSeedsForPlan({
        seed: baseSeed,
        generatorId: impl.id || 'unknown',
        count: plan.count || 1
      });

      
      var questions = [];
      for (var i = 0; i < (plan.count || 1); i++) {
        var itemPlan = Object.assign({}, plan, { seed: seeds[i], index: i });
        var sq = impl.generateItem ? impl.generateItem(itemPlan) : impl.generate(itemPlan);
        
        var arr = Array.isArray(sq) ? sq : [sq];
        arr.forEach(function (item) {
          questions.push(normalizeOutput(item, itemPlan, i));
        });
      }

      
      if (questions.length > (plan.count || 1)) {
        questions = questions.slice(0, plan.count || 1);
      }

      return questions.length === 1 ? questions[0] : questions;
    },

    
    generateBatch: function (plan) {
      var result = this.generate(plan);
      return Array.isArray(result) ? result : [result];
    }
  };

  return gen;
}


function normalizeOutput(item, plan, index) {
  if (item && item.id && item.metadata && item.metadata.generator) {
    return item; 
  }
  
  return require("shared/semantic-question.js").createSemanticQuestion(Object.assign({}, item, {
    generator: item.generator || 'generator:' + (item.id || 'unknown'),
    generatorVersion: item.generatorVersion || '1.0.0',
    seed: plan.seed,
    index: index,
    knowledgePoint: (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) || plan.knowledgePointId,
    difficulty: plan.difficulty,
    questionType: plan.questionTypeId
  }));
}


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


var GENERATOR_DIFFICULTY_PATTERNS = [
  { pattern: /\bif\s*\([^)]*\bdifficulty\b[^)]*(===|==|!==|!=|<|>|<=|>=)/, label: '难度硬编码条件（if difficulty === …，规则必须迁移至 Strategy）' },
  { pattern: /\bif\s*\([^)]*\bgrade\b[^)]*(===|==|!==|!=|<|>|<=|>=)/, label: '年级硬编码条件（if grade === …，规则必须迁移至 Strategy）' }
];


var FORBIDDEN_KEYS = ['render', 'check', 'html', 'svg', 'generate', 'generator', 'template', 'execute'];

var SUBJECTS = { math: 'math' };

function isEmptyGraphic(g) {
  if (g == null || typeof g !== 'object') return false;
  return (g.type == null) && (g.subtype == null) && (g.svg == null) &&
    (g.params == null || Object.keys(g.params).length === 0);
}


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
  
  var answerMode = q.answerMode || 'input';
  if (answerMode !== 'input' && answerMode !== 'read-aloud') {
    errors.push('answerMode 非法: ' + answerMode);
  }
  if (answerMode === 'input' && q.answer == null) errors.push('answer 必填（input 模式）');
  if (q.prompt == null || typeof q.prompt !== 'string') errors.push('prompt 必填（字符串）');

  
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
  validateGeneratorContract: validateGeneratorContract,
  runGeneratorWithValidation: runGeneratorWithValidation,
  canonSubject: function (s) { return (s || 'math').toLowerCase(); },
  validateSemanticQuestion: validateSemanticQuestion
};
};
__defs["shared/generator/retry-loop.js"] = function (module, exports, require) {

'use strict';

var Validator = require("shared/validator/question-validator.js");
var Pipeline = require("shared/validator/validation-pipeline.js");
var QID = require("shared/question-id.js");

var DEFAULT_MAX_RETRIES = 3;



var DEDUP_MAX_RETRIES = 8;



var DEDUP_ERROR_CODES = [
  Validator.ERROR_CODES.DUPLICATE_QUESTION,
  'DUPLICATE_INTEGRITY_VIOLATION'
];
function isDedupError(e) {
  return !!e && DEDUP_ERROR_CODES.indexOf(e.code) !== -1;
}



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
  var duplicateFailures = 0;   
  var Dup = require("shared/validator/duplicate-validator.js");

  function attempt(attemptIndex, seed, retryContext) {
    
    var keepQuestions = retryContext && retryContext._retryKeepQuestions ? retryContext._retryKeepQuestions : [];
    var keepResults = retryContext && retryContext._retryKeepResults ? retryContext._retryKeepResults : [];
    var duplicateIndices = retryContext && retryContext._retryDuplicateIndices ? retryContext._retryDuplicateIndices : null;
    var isPartialRetry = duplicateIndices !== null && duplicateIndices.length > 0;

    var attemptContext = Object.assign({}, plan, { seed: seed, _retryAttempt: attemptIndex });
    
    return Promise.resolve(generatorFn(attemptContext)).then(function (newQuestions) {
      if (!Array.isArray(newQuestions)) newQuestions = newQuestions.questions || [];
      
      newQuestions = newQuestions.map(function (q, i) {
        
        if (q && q.seed == null) {
          q = Object.assign({}, q, { metadata: Object.assign({}, q.metadata, { seed: seed }) });
        }
        var sq = require("shared/semantic-question.js").normalizeSemanticQuestion(Object.assign({}, q, {
          generator: generatorId,
          generatorVersion: generatorVersion,
          seed: seed,
          index: i,
          _retryAttempt: attemptIndex
        }));
        
        if (sq && !sq.questionFingerprint && Dup && typeof Dup.buildQuestionFingerprint === 'function') {
          sq.questionFingerprint = Dup.buildQuestionFingerprint(sq);
        }
        return sq;
      });

      
      
      
      
      var seenKeysSnapshot = validatorContext.seenKeys ? new Set(validatorContext.seenKeys) : null;
      var valContext = Object.assign({}, validatorContext, { generatorId: generatorId, seed: seed, plan: plan });
      var newValidation = Pipeline.runPipelineBatch(newQuestions, valContext);

      var questionsToValidate;
      var finalQuestions;
      var finalResults;

      if (isPartialRetry) {
        questionsToValidate = newQuestions;
        
        
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
      
      
      
      
      var allErrors = finalResults.flatMap(function (r) { return (r && r.errors) || []; })
        .concat(newValidation.flatMap(function (r) { return (r && r.errors) || []; }));

      
      
      
      
      
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
      
      if (validatorContext.seenKeys) {
        result.questions.forEach(function (sq) {
          if (sq && sq.questionFingerprint) validatorContext.seenKeys.add(sq.questionFingerprint);
        });
      }
      
      return {
        questions: result.questions,
        validationResults: result.validationResults,
        retries: retries,
        success: true,
        attempts: allResults
      };
    }

    
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

    
    var dupFilter = filterDuplicateQuestions(result.questions, result.validationResults, validatorContext.seenKeys, Dup);
    var duplicateIndices = dupFilter.duplicateIndices;

    
    if (result.allErrors && result.allErrors.some(isDedupError)) {
      duplicateFailures++;
    }

    
    var shouldRetryAll = duplicateIndices.length === 0;

    
    
    var isDedupOnlyFailure = result.allErrors.length > 0 && result.allErrors.every(isDedupError);
    var effectiveCap = isDedupOnlyFailure ? DEDUP_MAX_RETRIES : maxRetries;

    
    retries++;
    if (retries > effectiveCap) {
      
      
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

    
    currentSeed = QID.deriveSeed(baseSeed, generatorId, retries);

    
    var nextAttemptContext = Object.assign({}, plan, {
      seed: currentSeed,
      _retryAttempt: retries,
      
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

  
  var expectedCount = plan.count || total;
  if (total !== expectedCount) {
    warnings.push(createError('COUNT_MISMATCH', 'count', '实际题目数(' + total + ') 与计划(' + expectedCount + ') 不符', SEVERITY.WARNING, { actual: total, expected: expectedCount }));
  } else {
    info.push({ code: 'COUNT_OK', field: 'count', message: '题目数量达标: ' + total, severity: 'INFO' });
  }

  
  var kpCounts = countBy(questions, function (q) { return q.knowledgePoint || 'unknown'; });
  var kpCovered = Object.keys(kpCounts).filter(function (k) { return k !== 'unknown'; }).length;
  
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

  
  var diffCounts = countBy(questions, function (q) { return q.difficulty || 0; });
  var avgDiff = questions.reduce(function (s, q) { return s + (q.difficulty || 0); }, 0) / total;
  var targetDiff = plan.difficulty;
  if (targetDiff != null && Math.abs(avgDiff - targetDiff) > 1) {
    warnings.push(createError('DIFFICULTY_DIST_OFF', 'difficulty', '平均难度(' + avgDiff.toFixed(1) + ') 偏离目标(' + targetDiff + ')', SEVERITY.WARNING, { avg: avgDiff, target: targetDiff }));
  }
  info.push({ code: 'DIFF_DIST', field: 'difficulty', message: '难度分布: ' + JSON.stringify(diffCounts) + ', 平均: ' + avgDiff.toFixed(1), severity: 'INFO' });

  
  var keys = questions.map(function (q) { return require("shared/validator/duplicate-validator.js").buildCanonicalKey(q); });
  var uniqueKeys = new Set(keys);
  var dupRate = (keys.length - uniqueKeys.size) / keys.length;
  if (dupRate > 0.1) {
    errors.push(createError('DUPLICATE_RATE_HIGH', 'duplicate', '重复率 ' + (dupRate * 100).toFixed(1) + '% 超过 10%', SEVERITY.ERROR, { rate: dupRate, total: keys.length, unique: uniqueKeys.size }));
  } else if (dupRate > 0) {
    warnings.push(createError('DUPLICATE_RATE_WARN', 'duplicate', '存在重复题目，重复率 ' + (dupRate * 100).toFixed(1) + '%', SEVERITY.WARNING, { rate: dupRate }));
  }
  info.push({ code: 'DUP_RATE', field: 'duplicate', message: '重复率: ' + (dupRate * 100).toFixed(1) + '%', severity: 'INFO' });

  
  var answered = questions.filter(function (q) { return q.answer && q.answer.value != null; }).length;
  var answerRate = answered / total;
  if (answerRate < 1) {
    errors.push(createError('ANSWER_INCOMPLETE', 'answer', '答案完整率 ' + (answerRate * 100).toFixed(1) + '% (< 100%)', SEVERITY.ERROR, { answered: answered, total: total }));
  }
  info.push({ code: 'ANSWER_RATE', field: 'answer', message: '答案完整率: ' + (answerRate * 100).toFixed(1) + '%', severity: 'INFO' });

  
  var withGraphic = questions.filter(function (q) { return q.graphic && q.graphic.type; }).length;
  if (plan.graphicRequired && withGraphic < plan.graphicRequired) {
    warnings.push(createError('GRAPHIC_INSUFFICIENT', 'graphic', '含图形题目(' + withGraphic + ') 少于要求(' + plan.graphicRequired + ')', SEVERITY.WARNING));
  }
  info.push({ code: 'GRAPHIC_COUNT', field: 'graphic', message: '含图形题目: ' + withGraphic, severity: 'INFO' });

  
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

  
  var corr = 0;
  if (validationResult && validationResult.checks && validationResult.checks.answer) {
    corr = validationResult.checks.answer === 'pass' ? 1 : 0;
  } else if (sq.answer && sq.answer.value != null) {
    corr = 0.8; 
  }
  breakdown.correctness = corr;

  
  var ka = 0;
  if (validationResult && validationResult.checks && validationResult.checks.knowledgePoint) {
    ka = validationResult.checks.knowledgePoint === 'pass' ? 1 : 0;
  } else if (sq.knowledgePoint) {
    ka = 0.8;
  }
  breakdown.knowledgeAlignment = ka;

  
  var da = 0;
  if (validationResult && validationResult.checks && validationResult.checks.difficulty) {
    da = validationResult.checks.difficulty === 'pass' ? 1 : 0;
  } else if (sq.difficulty != null) {
    da = 0.8;
  }
  breakdown.difficultyAlignment = da;

  
  var sv = 0;
  if (validationResult && validationResult.checks && validationResult.checks.structure) {
    sv = validationResult.checks.structure === 'pass' ? 1 : 0;
  } else {
    sv = 0.8; 
  }
  breakdown.structuralValidity = sv;

  
  var rend = 0;
  if (validationResult && validationResult.checks && validationResult.checks.renderPreflight) {
    rend = validationResult.checks.renderPreflight === 'pass' ? 1 : 0;
  } else if (sq.prompt && sq.answerMode) {
    rend = 0.9;
  }
  breakdown.renderability = rend;

  
  var uniq = 0;
  if (validationResult && validationResult.checks && validationResult.checks.duplicate) {
    uniq = validationResult.checks.duplicate === 'pass' ? 1 : 0;
  } else if (context && context.seenKeys) {
    var key = require("shared/validator/duplicate-validator.js").buildCanonicalKey(sq);
    uniq = context.seenKeys.has(key) ? 0 : 1;
  } else {
    uniq = 1; 
  }
  breakdown.uniqueness = uniq;

  
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
    
    if (sq) {
      var key = require("shared/validator/duplicate-validator.js").buildCanonicalKey(sq);
      seenKeys.add(key);
    }
    return { questionId: sq.id, score: score };
  });

  
  var totals = scored.map(function (s) { return s.score.total; });
  var avg = totals.length ? totals.reduce(function (a, b) { return a + b; }, 0) / totals.length : 0;
  var min = totals.length ? Math.min.apply(null, totals) : 0;
  var max = totals.length ? Math.max.apply(null, totals) : 0;

  
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
__defs["shared/semantic-question.js"] = function (module, exports, require) {

'use strict';

var Schema = require("shared/schemas/semantic-question.schema.js");
var QTR = require("shared/question-type-registry.js");
var QID = require("shared/question-id.js");

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

  
  var questionId = raw.id || QID.generateQuestionId(raw.seed || QID.generateBaseSeed(), {
    generatorId: raw.generator || raw.metadata && raw.metadata.generator,
    index: raw.index,
    knowledgePointId: raw.knowledgePoint || raw.knowledgePointId,
    difficulty: raw.difficulty,
    questionType: raw.questionType
  });

  
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
    
    id: questionId,
    version: raw.version || Schema.VERSION,

    
    knowledgePoint: coerceString(raw.knowledgePoint || raw.knowledgePointId),
    knowledgePointId: coerceString(raw.knowledgePointId || raw.knowledgePoint),
    skill: coerceString(raw.skill || ''),

    
    
    difficulty: coerceInteger(raw.difficulty),
    difficultyParams: deepClone(raw.difficultyParams) || {},
    numberRange: deepClone(raw.numberRange) || { min: 1, max: 1 },
    spiralLevel: coerceInteger(raw.spiralLevel) || 1,
    context: coerceString(raw.context),
    seed: raw.seed || null,
    cognitiveLevel: coerceString(raw.cognitiveLevel || ''),

    
    content: deepClone(raw.content) || Schema.defaultContent(),

    
    question: deepClone(raw.question) || Schema.defaultQuestion(),

    
    answer: deepClone(raw.answer) || Schema.defaultAnswer(),

    
    distractors: ensureArray(raw.distractors).map(function (d) {
      return deepClone(d) || Schema.defaultDistractor();
    }),

    
    
    
    
    
    graphic: deepClone(raw.graphic) || null,

    
    constraints: deepClone(raw.constraints) || {},

    
    metadata: metadata
  };

  
  if (raw.render != null) sq.render = raw.render;
  if (raw.check != null) sq.check = raw.check;
  if (raw.svg != null) sq.svg = raw.svg;
  if (raw.options != null) sq.options = raw.options;

  
  if (raw.data != null) sq.data = deepClone(raw.data);
  if (raw.hint != null) sq.hint = raw.hint;

  
  if (sq.data && !Array.isArray(sq.data.options) && Array.isArray(sq.options) && sq.options.length) {
    sq.data.options = sq.options.slice();
  }
  if (sq.data && Array.isArray(sq.data.options) && sq.answer && sq.answer.value != null && sq.data.correctIndex == null) {
    var ci = sq.data.options.indexOf(coerceString(sq.answer.value));
    if (ci !== -1) sq.data.correctIndex = ci;
  }

  
  sq.prompt = sq.content && sq.content.prompt ? sq.content.prompt : (sq.question && sq.question.prompt ? sq.question.prompt : '');
  sq.questionType = raw.questionType || raw.type || null;
  sq.answerMode = (sq.question && sq.question.answerMode) || raw.answerMode || 'input';

  
  sq.questionFingerprint = computeFingerprint(sq);

  return sq;
}


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

  
  if (raw.id && raw.version && raw.metadata && raw.metadata.generator) {
    return raw;
  }

  
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
    
    
    
    
    graphic: (raw.graphic && typeof raw.graphic === 'object')
      ? deepClone(raw.graphic)
      : (raw.svg ? { type: 'custom', params: { rawSvg: raw.svg } } : null),
    constraints: deepClone(raw.constraints) || {},
    metadata: raw.metadata || {
      generator: raw.generator || raw.pluginId || raw.source,
      generatorVersion: raw.generatorVersion || raw.version,
      seed: raw.seed || raw.randomSeed,
      timestamp: raw.timestamp || nowISO()
    }
  };

  
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

  
  if (typeof sq.render === 'function' || typeof sq.check === 'function') {
    errors.push({ code: Schema.ERROR_CODES.SCHEMA_INVALID, field: 'root', message: 'SemanticQuestion 禁止携带 render/check 执行字段（禁止字段）', severity: Schema.SEVERITY.ERROR });
  }

  
  
  sq = normalizeSemanticQuestion(sq);

  
  if (!sq.id) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'id', message: '缺少题目 ID', severity: Schema.SEVERITY.ERROR });
  }
  if (typeof sq.version !== 'number' && typeof sq.version !== 'string') {
    warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'version', message: 'version 应为数字或字符串', severity: Schema.SEVERITY.WARNING });
  }

  
  if (!sq.knowledgePoint) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'knowledgePoint', message: '缺少 knowledgePoint 绑定', severity: Schema.SEVERITY.ERROR });
  }

  
  if (sq.difficulty != null) {
    var diff = coerceInteger(sq.difficulty);
    if (diff === null || Schema.DIFFICULTY_LEVELS.indexOf(diff) === -1) {
      warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'difficulty', message: 'difficulty 超出已知范围 (1-10)', severity: Schema.SEVERITY.WARNING });
    }
  }

  
  if (!sq.questionType) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'questionType', message: '缺少 questionType', severity: Schema.SEVERITY.ERROR });
  } else if (!isValidQuestionType(sq.questionType)) {
    errors.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'questionType', message: '未知 questionType: ' + sq.questionType, severity: Schema.SEVERITY.ERROR });
  }

  
  if (sq.numberRange) {
    if (typeof sq.numberRange !== 'object') {
      errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'numberRange', message: 'numberRange 必须为对象 { min, max }', severity: Schema.SEVERITY.ERROR });
    } else if (sq.numberRange.min != null && sq.numberRange.max != null &&
               sq.numberRange.min > sq.numberRange.max) {
      errors.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'numberRange', message: 'numberRange.min 不得大于 max', severity: Schema.SEVERITY.ERROR });
    }
  }

  
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

  
  if (sq.question && typeof sq.question !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'question', message: 'question 必须为对象', severity: Schema.SEVERITY.ERROR });
  }
  if (sq.question && sq.question.answerMode && !Schema.isValidAnswerMode(sq.question.answerMode)) {
    warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'question.answerMode', message: '未知 answerMode: ' + sq.question.answerMode, severity: Schema.SEVERITY.WARNING });
  }

  
  var answerMode = sq.answerMode || (sq.question && sq.question.answerMode) || 'input';
  if (!sq.answer || typeof sq.answer !== 'object') {
    
    if (answerMode !== 'read-aloud') {
      errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'answer', message: '缺少 answer 对象', severity: Schema.SEVERITY.ERROR });
    }
  } else {
    
    if (answerMode !== 'read-aloud' && sq.answer.value == null && (!sq.answer.acceptable || sq.answer.acceptable.length === 0)) {
      errors.push({ code: Schema.ERROR_CODES.ANSWER_INVALID, field: 'answer.value', message: '答案值缺失且无可接受替代答案', severity: Schema.SEVERITY.ERROR });
    }
    if (sq.answer.precision != null && (typeof sq.answer.precision !== 'number' || sq.answer.precision < 0)) {
      warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'answer.precision', message: 'precision 应为非负数', severity: Schema.SEVERITY.WARNING });
    }
  }

  
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
    
    if (sq.graphic.rawSvg || sq.graphic.svg || sq.graphic.html) {
      errors.push({ code: Schema.ERROR_CODES.GRAPHIC_INVALID, field: 'graphic', message: 'graphic 不得包含原始 SVG/HTML 字符串（请使用描述性 params）', severity: Schema.SEVERITY.ERROR });
    }
  }

  
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
  var inputTypeMap = {
    'input': 'text',
    'choice': 'choice',
    'multi': 'multi',
    'none': 'none',
    'read-aloud': 'read-aloud'
  };
  var inputType = inputTypeMap[answerMode] || 'text';

  var options = null;
  if (inputType === 'choice' && Array.isArray(sq.distractors) && sq.distractors.length) {
    options = sq.distractors.map(function (d) { return d.value; });
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
    answer: sq.answer && sq.answer.value != null ? sq.answer.value : (sq.answer ? sq.answer.value : null),
    inputType: inputType,
    options: options,
    type: sq.questionType || sq.type || sq.skill || 'calc',
    questionType: sq.questionType || sq.type || sq.skill || 'calc',
    skill: sq.skill || '',
    difficulty: sq.difficulty,
    difficultyParams: sq.difficultyParams,
    knowledgePointId: sq.knowledgePoint,
    
    knowledgePointIds: (Array.isArray(sq.knowledgePointIds) && sq.knowledgePointIds.length)
      ? sq.knowledgePointIds.slice()
      : (sq.knowledgePoint ? [sq.knowledgePoint] : []),
    
    composite: sq.composite || (sq.data && sq.data.composite) || null,
    hint: sq.hint,
    numberRange: sq.numberRange,
    render: sq.render || null,
    check: sq.check || null,
    svg: sq.svg || (sq.graphic && sq.graphic.params && (sq.graphic.params.rawSvg || sq.graphic.params.legacySvg)) || null
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
__defs["shared/feature-flags.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var DEFAULT_FLAGS = {
    questionValidation: {
      enabled: true,
      mode: 'warn',      
      maxRetries: 3,
      logLevel: 'info'   
    },
    
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
      validationResult: data.validationResult, 
      errorCodes: data.errorCodes || [],
      score: data.score,
      planId: data.planId,
      questionType: data.questionType,
      difficulty: data.difficulty
    });
  }

  
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
__defs["shared/question-id.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");

var ID_PREFIX = 'q';
var SEED_DELIMITER = '|';
var SEED_PART_DELIMITER = ':';
var SEED_COUNTER = 0;


function generateQuestionId(seed, context) {
  var rng = Rng.createSeededRandom(seed);
  var parts = [ID_PREFIX];

  
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
  Rng: Rng  
};
};
__defs["shared/metrics.js"] = function (module, exports, require) {

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

  
  function recordDuplicateCheck(data) {
    metrics.duplicate.totalQuestions += (data.totalQuestions || 0);
    metrics.duplicate.duplicatesFound += (data.duplicatesFound || 0);
    if (data.generator) {
      metrics.duplicate.byGenerator[data.generator] = (metrics.duplicate.byGenerator[data.generator] || { total: 0, duplicates: 0 });
      metrics.duplicate.byGenerator[data.generator].total += (data.totalQuestions || 0);
      metrics.duplicate.byGenerator[data.generator].duplicates += (data.duplicatesFound || 0);
    }
  }

  
  function recordRenderResult(data) {
    metrics.render.total++;
    if (data.success) {
      metrics.render.success++;
    } else {
      metrics.render.failed++;
      if (data.errorType) metrics.render.errorsByType[data.errorType] = (metrics.render.errorsByType[data.errorType] || 0) + 1;
    }
  }

  
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






var PIPELINE_LAYERS = [
  {
    name: 'layer1-critical',
    steps: [
      { name: 'schema', fn: Validator.validateSchemaOnly, required: true },
      { name: 'answer', fn: answerValidator.validateAnswer, required: true },
      { name: 'kpCoverage', fn: kpCoverageValidator.validateKpCoverage, required: true }
    ],
    stopOnFailure: true  
  },
  {
    name: 'layer2-structure',
    steps: [
      { name: 'difficulty', fn: difficultyValidator.validateDifficulty, required: false },
      { name: 'composite', fn: compositeValidator.validateComposite, required: false },
      
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


var PIPELINE_STEPS = [];
PIPELINE_LAYERS.forEach(function (layer) {
  layer.steps.forEach(function (s) { PIPELINE_STEPS.push(s); });
});


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

  for (var li = 0; li < PIPELINE_LAYERS.length; li++) {
    var layer = PIPELINE_LAYERS[li];
    var layerHasErrors = false;

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

      
      if (result.errors) allErrors.push.apply(allErrors, result.errors);
      if (result.warnings) allWarnings.push.apply(allWarnings, result.warnings);
      if (result.info) allInfo.push.apply(allInfo, result.info);
      if (typeof result.score === 'number') scores.push(result.score);
      if (result.checks) Object.assign(checks, result.checks);

      
      if (result.seenKeys) seenKeys = result.seenKeys;

      
      if (step.required && (!result.valid || (result.errors && result.errors.length))) {
        layerHasErrors = true;
      }
    }

    
    if (layer.stopOnFailure && layerHasErrors) {
      break;
    }
  }

  var valid = allErrors.length === 0;
  var score = scores.length ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length : 1;

  return {
    valid: valid,
    errors: allErrors,
    warnings: allWarnings,
    info: allInfo,
    score: score,
    checks: checks
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

  return { valid: valid, errors: allErrors, warnings: allWarnings, info: allInfo, score: score, checks: checks };
}


module.exports = {
  runPipeline: runPipeline,
  runPipelineBatch: runPipelineBatch,
  runBatchValidators: runBatchValidators,
  PIPELINE_STEPS: PIPELINE_STEPS,
  BATCH_VALIDATORS: BATCH_VALIDATORS
};
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
  return require("shared/semantic-question.js").validateSchema(sq);
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

  
  var schemaResult = validateSchemaOnly(question);
  if (!schemaResult.valid) {
    return combineResults([schemaResult]);
  }

  
  
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
__defs["shared/validator/duplicate-validator.js"] = function (module, exports, require) {

'use strict';

var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceString(v) { return v == null ? '' : String(v); }
function sortObj(o) { return JSON.stringify(o, Object.keys(o).sort()); }


function toHalfWidth(str) {
  return String(str == null ? '' : str).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
}


function extractOperands(sq) {
  var data = sq && sq.data;
  if (Array.isArray(data && data.operands) && data.operands.length) {
    return data.operands.map(function (n) { return parseInt(n, 10); }).filter(function (n) { return !isNaN(n); });
  }
  var half = toHalfWidth(sq.prompt || (sq.content && sq.content.prompt) || '');
  return (half.match(/\d+/g) || []).map(function (n) { return parseInt(n, 10); }).filter(function (n) { return !isNaN(n); });
}




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


function buildQuestionFingerprint(sq) {
  var parts = [];
  parts.push('v2');
  parts.push(coerceString(sq.knowledgePoint));
  parts.push(coerceString(sq.questionType || sq.type));
  parts.push(extractOperators(sq).sort().join(','));
  parts.push(extractOperands(sq).sort(function (a, b) { return a - b; }).join(','));
  parts.push(extractStructureKey(sq));
  parts.push(coerceString(sq.content && sq.content.context));
  parts.push(coerceString(sq.content && sq.content.format));
  return parts.join('|');
}

function buildCanonicalKey(sq) {
  var parts = [];
  parts.push(coerceString(sq.knowledgePoint));
  parts.push(coerceString(sq.questionType || sq.type));
  parts.push(coerceString(sq.question && sq.question.operation));

  
  var half = toHalfWidth(sq.prompt || (sq.content && sq.content.prompt) || '');
  var nums = (half.match(/\d+/g) || []).map(function (n) { return parseInt(n, 10); }).sort(function (a, b) { return a - b; });
  parts.push(nums.join(','));

  
  var ops = (half.replace(/[＋－]/g, function (c) { return c === '＋' ? '+' : '-'; })
    .match(/[+\-×÷*/−]/g) || []).map(function (o) {
    return o === '−' ? '-' : o;
  }).sort().join('');
  parts.push(ops);

  
  parts.push(coerceString(sq.content && sq.content.context));
  parts.push(coerceString(sq.content && sq.content.format));

  return parts.join('|');
}

function validateDuplicate(sq, context) {
  var errors = [];
  var warnings = [];
  var info = [];

  context = context || {};
  var seenKeys = context.seenKeys || new Set();
  
  
  var key = sq.questionFingerprint || buildQuestionFingerprint(sq);
  if (!sq.questionFingerprint) sq.questionFingerprint = key;
  var diagKey = buildCanonicalKey(sq);

  if (seenKeys.has(key)) {
    errors.push(createError(ERROR_CODES.DUPLICATE_QUESTION, 'questionFingerprint', '重复题目: ' + key, SEVERITY.ERROR, { questionFingerprint: key, canonicalKey: diagKey }));
  } else {
    seenKeys.add(key);
    info.push({ code: 'UNIQUE', field: 'questionFingerprint', message: '题目唯一: ' + key, severity: 'INFO', canonicalKey: diagKey });
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    info: info,
    score: errors.length === 0 ? 1 : 0,
    checks: { duplicate: errors.length === 0 ? 'pass' : 'fail' },
    seenKeys: seenKeys 
  };
}

function validateBatchDuplicate(questions, context) {
  context = context || {};
  var seenKeys = context.seenKeys || new Set();
  var results = questions.map(function (sq) {
    var key = sq.questionFingerprint || buildQuestionFingerprint(sq);
    if (!sq.questionFingerprint) sq.questionFingerprint = key;
    var diagKey = buildCanonicalKey(sq);
    var errors = [];
    var warnings = [];
    if (seenKeys.has(key)) {
      errors.push(createError('DUPLICATE_QUESTION', 'questionFingerprint', '重复题目: ' + key, 'ERROR', { questionFingerprint: key, canonicalKey: diagKey }));
    } else {
      seenKeys.add(key);
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
  extractOperands: extractOperands,
  extractOperators: extractOperators,
  extractStructureKey: extractStructureKey
};
};
__defs["shared/schemas/semantic-question.schema.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var VERSION = 1;

  
  var QUESTION_TYPES = [
    'calc',       
    'fill',       
    'judge',      
    'choice',     
    'operate',    
    'apply',      
    'open',       
    'read-aloud'  
  ];

  
  var DIFFICULTY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  
  var COGNITIVE_LEVELS = ['了解', '理解', '掌握', '运用'];

  
  var ANSWER_MODES = ['input', 'choice', 'multi', 'none', 'read-aloud'];

  
  var GRAPHIC_TYPES = [
    'geometry',   
    'chart',      
    'diagram',    
    'number-line', 
    'grid',       
    'custom'      
  ];

  
  var GRAPHIC_SUBTYPES = {
    geometry: ['triangle', 'rectangle', 'circle', 'polygon', 'angle', 'line', 'point'],
    chart: ['bar', 'line', 'pie', 'scatter'],
    diagram: ['flow', 'tree', 'venn', 'mindmap'],
    'number-line': ['integer', 'fraction', 'decimal'],
    grid: ['dot', 'square', 'isometric'],
    custom: []
  };

  
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

  
  var ERROR_CODES = {
    
    SCHEMA_INVALID: 'SCHEMA_INVALID',
    REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
    FIELD_TYPE_MISMATCH: 'FIELD_TYPE_MISMATCH',
    ENUM_VALUE_INVALID: 'ENUM_VALUE_INVALID',

    
    KP_MISSING: 'KP_MISSING',
    KP_MISMATCH: 'KP_MISMATCH',
    KP_OPERATION_INVALID: 'KP_OPERATION_INVALID',
    KP_FORMAT_INVALID: 'KP_FORMAT_INVALID',
    KP_COGNITIVE_INVALID: 'KP_COGNITIVE_INVALID',
    KP_CONTEXT_INVALID: 'KP_CONTEXT_INVALID',
    KP_GRAPHIC_INVALID: 'KP_GRAPHIC_INVALID',

    
    ANSWER_INVALID: 'ANSWER_INVALID',
    ANSWER_MISMATCH: 'ANSWER_MISMATCH',
    ANSWER_TYPE_MISMATCH: 'ANSWER_TYPE_MISMATCH',
    ANSWER_OUT_OF_DOMAIN: 'ANSWER_OUT_OF_DOMAIN',

    
    DISTRACTOR_COUNT_INVALID: 'DISTRACTOR_COUNT_INVALID',
    DISTRACTOR_DUPLICATE: 'DISTRACTOR_DUPLICATE',
    DISTRACTOR_EQUALS_ANSWER: 'DISTRACTOR_EQUALS_ANSWER',
    DISTRACTOR_TYPE_MISMATCH: 'DISTRACTOR_TYPE_MISMATCH',
    DISTRACTOR_OUT_OF_DOMAIN: 'DISTRACTOR_OUT_OF_DOMAIN',
    DISTRACTOR_ERROR_TYPE_INVALID: 'DISTRACTOR_ERROR_TYPE_INVALID',

    
    STRUCTURE_INVALID: 'STRUCTURE_INVALID',
    STEPS_EXCEED: 'STEPS_EXCEED',
    BRACKETS_VIOLATION: 'BRACKETS_VIOLATION',
    OPERATIONS_VIOLATION: 'OPERATIONS_VIOLATION',
    OPERAND_COUNT_INVALID: 'OPERAND_COUNT_INVALID',
    OPERAND_RANGE_INVALID: 'OPERAND_RANGE_INVALID',

    
    DIFFICULTY_MISMATCH: 'DIFFICULTY_MISMATCH',
    DIFFICULTY_OUT_OF_RANGE: 'DIFFICULTY_OUT_OF_RANGE',

    
    DUPLICATE_QUESTION: 'DUPLICATE_QUESTION',

    
    KP_COVERAGE_INSUFFICIENT: 'KP_COVERAGE_INSUFFICIENT',
    KP_COVERAGE_MISSING: 'KP_COVERAGE_MISSING',

    
    COMPOSITE_INVALID: 'COMPOSITE_INVALID',
    COMPOSITE_STRUCTURE_MISMATCH: 'COMPOSITE_STRUCTURE_MISMATCH',
    COMPOSITE_OPERATOR_MISMATCH: 'COMPOSITE_OPERATOR_MISMATCH',
    COMPOSITE_STEPS_MISMATCH: 'COMPOSITE_STEPS_MISMATCH',
    
    COMPOSITE_UNSUPPORTED: 'COMPOSITE_UNSUPPORTED',

    
    DIFFICULTY_INTEGRITY_VIOLATION: 'DIFFICULTY_INTEGRITY_VIOLATION',
    DIFFICULTY_CONSTRAINT_MISMATCH: 'DIFFICULTY_CONSTRAINT_MISMATCH',
    DIFFICULTY_STRUCTURE_DRIFT: 'DIFFICULTY_STRUCTURE_DRIFT',

    
    DUPLICATE_INTEGRITY_VIOLATION: 'DUPLICATE_INTEGRITY_VIOLATION',
    DUPLICATE_FINGERPRINT_MISMATCH: 'DUPLICATE_FINGERPRINT_MISMATCH',

    
    GRAPHIC_INVALID: 'GRAPHIC_INVALID',
    GRAPHIC_TYPE_UNREGISTERED: 'GRAPHIC_TYPE_UNREGISTERED',
    GRAPHIC_PARAMS_INCOMPLETE: 'GRAPHIC_PARAMS_INCOMPLETE',
    GRAPHIC_RENDERER_MISSING: 'GRAPHIC_RENDERER_MISSING',

    
    RENDER_PREFLIGHT_FAILED: 'RENDER_PREFLIGHT_FAILED',
    HTML_GENERATION_FAILED: 'HTML_GENERATION_FAILED',
    SVG_GENERATION_FAILED: 'SVG_GENERATION_FAILED',
    PRINT_GENERATION_FAILED: 'PRINT_GENERATION_FAILED',

    
    KP_SEMANTIC_IDENTITY: 'KP_SEMANTIC_IDENTITY',
    KP_SEMANTIC_QUESTION_TYPE: 'KP_SEMANTIC_QUESTION_TYPE',
    KP_SEMANTIC_OPERATION: 'KP_SEMANTIC_OPERATION',
    KP_SEMANTIC_NUMERIC: 'KP_SEMANTIC_NUMERIC',
    KP_SEMANTIC_STRUCTURE: 'KP_SEMANTIC_STRUCTURE',
    KP_SEMANTIC_CONTENT: 'KP_SEMANTIC_CONTENT',
    KP_SEMANTIC_COMPOSITE: 'KP_SEMANTIC_COMPOSITE'
  };

  
  var SEVERITY = {
    ERROR: 'ERROR',     
    WARNING: 'WARNING', 
    INFO: 'INFO'        
  };

  
  function defaultMetadata() {
    return {
      generator: null,           
      generatorVersion: null,    
      seed: null,                
      timestamp: null,           
      retryCount: 0,             
      validationScore: null,     
      tags: []                   
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
      prompt: '',           
      stem: null,           
      language: 'zh-CN',    
      readingLevel: null    
    };
  }

  function defaultQuestion() {
    return {
      prompt: '',           
      hint: null,           
      answerMode: 'input',  
      expectedFormat: null  
    };
  }

  function defaultAnswer() {
    return {
      value: null,          
      acceptable: [],       
      unit: null,           
      precision: null,      
      explanation: null     
    };
  }

  function defaultDistractor() {
    return {
      value: null,
      errorType: null,      
      weight: 1             
    };
  }

  
  var API = {
    VERSION: VERSION,
    QUESTION_TYPES: QUESTION_TYPES,
    DIFFICULTY_LEVELS: DIFFICULTY_LEVELS,
    COGNITIVE_LEVELS: COGNITIVE_LEVELS,
    ANSWER_MODES: ANSWER_MODES,
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

    
    isValidQuestionType: function (t) { return QUESTION_TYPES.indexOf(t) !== -1; },
    isValidDifficulty: function (d) { return DIFFICULTY_LEVELS.indexOf(d) !== -1; },
    isValidCognitiveLevel: function (c) { return COGNITIVE_LEVELS.indexOf(c) !== -1; },
    isValidAnswerMode: function (m) { return ANSWER_MODES.indexOf(m) !== -1; },
    isValidGraphicType: function (t) { return GRAPHIC_TYPES.indexOf(t) !== -1; },
    isValidGraphicSubtype: function (type, subtype) {
      var list = GRAPHIC_SUBTYPES[type];
      return list && list.indexOf(subtype) !== -1;
    },
    isValidDistractorErrorType: function (e) { return DISTRACTOR_ERROR_TYPES.indexOf(e) !== -1; },
    isValidSeverity: function (s) { return SEVERITY[s] != null; }
  };

  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else if (global) {
    global.SemanticQuestionSchema = API;
  }
})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
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
  var expr = coerceString(prompt).replace(/[？?□_\\s]/g, '').replace(/[×xX]/g, '*').replace(/[÷]/g, '/').replace(/[＝=]/g, '');
  if (!expr) return null;

  try {
    
    
    var fn = new Function('return ' + expr);
    var result = fn();
    if (typeof result === 'number' && isFinite(result)) {
      
      return Number.isInteger(result) ? String(result) : result.toFixed(2).replace(/\.?0+$/, '');
    }
    return String(result);
  } catch (e) {
    return null;
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


function validateJudgeAnswer(answerObj, expected) {
  var errors = [];
  var val = coerceString(answerObj.value).toLowerCase().trim();
  var trueSet = ['true', '对', '是', 'yes', 'y', 't', '1', 'true', '✓', '正确'];
  var falseSet = ['false', '错', '否', 'no', 'n', 'f', '0', 'false', '✗', '错误'];
  var parsed = trueSet.indexOf(val) !== -1 ? true : (falseSet.indexOf(val) !== -1 ? false : null);
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

  
  if (qType === 'choice' && sq.distractors) {
    var options = sq.distractors.map(function (d) { return d.value; });
    if (answerObj.value != null) options.push(coerceString(answerObj.value));
    var optUniq = options.filter(function (v, i, a) { return a.indexOf(v) === i; });
    var res = validateChoiceAnswer(answerObj, optUniq);
    errors.push.apply(errors, res.errors);
    warnings.push.apply(warnings, res.warnings);
  } else if (qType === 'judge' || qType === 'true-false') {
    
    var res2 = validateJudgeAnswer(answerObj, true); 
    warnings.push({ code: 'JUDGE_ANSWER_UNVERIFIED', field: 'answer', message: '判断题正确性需人工/规则核对', severity: 'INFO' });
  } else if (qType === 'fill' || qType === 'calc') {
    
    var remResult = validateRemainderAnswer(answerObj, prompt);
    if (remResult === true) {
      
    } else if (remResult === false) {
      errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '余数除法答案不正确（不满足 b×q+r=a 且 0≤r<b）', SEVERITY.ERROR));
    } else {
      
      var expected = computeExpectedAnswer(prompt);
      if (expected) {
        var res3 = validateNumericAnswer(answerObj, expected);
        errors.push.apply(errors, res3.errors);
        warnings.push.apply(warnings, res3.warnings);
      } else {
        
        if (answerObj.value == null && (!answerObj.acceptable || answerObj.acceptable.length === 0)) {
          errors.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '答案为空且无法自动校验', SEVERITY.ERROR));
        } else {
          info.push({ code: 'ANSWER_UNVERIFIED', field: 'answer', message: '题目类型 ' + qType + ' 无法自动验证，需人工核对', severity: 'INFO' });
        }
      }
    }
  } else {
    
    if (answerObj.value == null && (!answerObj.acceptable || answerObj.acceptable.length === 0)) {
      warnings.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '题型 ' + qType + ' 答案为空', SEVERITY.WARNING));
    }
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0.5, checks: { answer: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateAnswer: validateAnswer,
  computeExpectedAnswer: computeExpectedAnswer,
  validateNumericAnswer: validateNumericAnswer,
  validateRemainderAnswer: validateRemainderAnswer,
  validateChoiceAnswer: validateChoiceAnswer,
  validateJudgeAnswer: validateJudgeAnswer,
  validateTextAnswer: validateTextAnswer
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
  
  var prompt = sq.prompt || '';
  var ops = (prompt.match(/[+\-×÷*/]/g) || []).length;
  var nums = (prompt.match(/\d+/g) || []).map(Number);
  var maxNum = nums.length ? Math.max.apply(null, nums) : 0;
  var steps = (prompt.match(/[+\-×÷*/]/g) || []).length + 1;

  var diff = 1;
  diff += Math.min(3, Math.floor(maxNum / 20));     
  diff += Math.min(2, Math.floor(ops / 2));         
  diff += Math.min(2, Math.max(0, steps - 2));      
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

  
  if (target < 1 || target > 10) {
    errors.push(createError(ERROR_CODES.DIFFICULTY_OUT_OF_RANGE, 'difficulty', 'difficulty 超出范围(1-10): ' + target, SEVERITY.ERROR));
  }

  
  
  
  
  
  var actual = computeActualDifficulty(sq);
  var tolerance = params.difficultyTolerance != null ? params.difficultyTolerance : 1; 
  var minAccept = target - tolerance;
  var maxAccept = target + tolerance;

  if (actual < minAccept || actual > maxAccept) {
    warnings.push(createError(ERROR_CODES.DIFFICULTY_MISMATCH, 'difficulty', '启发式实际难度(' + actual + ') 超出目标范围 [' + minAccept + ', ' + maxAccept + '] (目标 ' + target + ')', SEVERITY.WARNING, { target: target, actual: actual, tolerance: tolerance }));
  } else {
    info.push({ code: 'DIFFICULTY_OK', field: 'difficulty', message: '难度匹配: 目标 ' + target + ', 实际 ' + actual, severity: 'INFO' });
  }

  
  if (params.numberRange) {
    var range = params.numberRange;
    if (typeof range.min === 'number' && typeof range.max === 'number') {
      
      info.push({ code: 'NUMBER_RANGE', field: 'difficultyParams.numberRange', message: '数值范围 [' + range.min + ', ' + range.max + ']', severity: 'INFO' });
    }
  }

  
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

  
  var expectedSteps = coerceInteger(params.exactSteps || params.maxSteps || data.steps);
  var actualSteps = coerceInteger(data.steps);
  if (expectedSteps != null && actualSteps != null && expectedSteps !== actualSteps) {
    errors.push(createError(ERROR_CODES.COMPOSITE_STEPS_MISMATCH, 'data.steps', '步数不匹配: 期望 ' + expectedSteps + ', 实际 ' + actualSteps, SEVERITY.ERROR, { expected: expectedSteps, actual: actualSteps }));
  }

  
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

  
  var expectedBracket = params.allowBracket === true || data.allowBracket === true;
  var hasBracket = data.hasBracket === true || /[()（）]/.test(sq.prompt || '');
  if (expectedBracket && !hasBracket) {
    warnings.push({ code: 'COMPOSITE_BRACKET_MISSING', field: 'structure', message: '要求括号但题干未含括号', severity: 'WARNING', detail: { expectedBracket: expectedBracket, hasBracket: hasBracket } });
  } else if (!expectedBracket && hasBracket) {
    warnings.push({ code: 'COMPOSITE_BRACKET_UNEXPECTED', field: 'structure', message: '未要求括号但题干含括号', severity: 'WARNING', detail: { expectedBracket: expectedBracket, hasBracket: hasBracket } });
  }

  
  if (data.mode === 'inverse' || data.inverse === true) {
    var inverseOps = actualOps.filter(function (o) { return ['inverse', 'reverse', 'unknown', '求被加数', '求减数', '求乘数', '求除数'].indexOf(String(o).toLowerCase()) !== -1; });
    if (inverseOps.length === 0 && actualOps.length > 0) {
      
      info.push({ code: 'COMPOSITE_INVERSE_MODE', field: 'data.mode', message: '检测到逆运算模式', severity: 'INFO', detail: { mode: data.mode, inverse: data.inverse } });
    }
  }

  
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

var Difficulty = require("shared/difficulty.js");

function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }

function validateDifficultyIntegrity(sq, context) {
  context = context || {};
  var errors = [];
  var warnings = [];
  var info = [];

  var targetDifficulty = coerceInteger(sq.difficulty);
  var params = sq.difficultyParams || sq.constraints || {};
  var structure = params; 

  if (targetDifficulty == null) {
    
    return { valid: true, errors: [], warnings: [], info: [], score: 0.8, checks: { difficultyIntegrity: 'skipped' } };
  }

  
  if (params.difficulty != null) {
    var cDiff = coerceInteger(params.difficulty);
    if (cDiff !== targetDifficulty) {
      errors.push(createError(ERROR_CODES.DIFFICULTY_INTEGRITY_VIOLATION, 'difficulty', 'difficulty(' + targetDifficulty + ') 与 constraints.difficulty(' + cDiff + ') 不一致', SEVERITY.ERROR, { target: targetDifficulty, constraint: cDiff }));
    }
  }

  
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

  
  var spiralLevel = coerceInteger(params.spiralLevel);
  if (spiralLevel != null) {
    var expectedSpiral = Math.ceil(targetDifficulty / 2);
    if (Math.abs(spiralLevel - expectedSpiral) > 1) {
      errors.push(createError(ERROR_CODES.DIFFICULTY_INTEGRITY_VIOLATION, 'difficultyParams.spiralLevel', 'spiralLevel(' + spiralLevel + ') 与 difficulty(' + targetDifficulty + ') 期望 ' + expectedSpiral + ' ±1 不符', SEVERITY.ERROR, { spiralLevel: spiralLevel, difficulty: targetDifficulty, expected: expectedSpiral }));
    }
  }

  
  var cognitiveLevel = (sq.cognitiveLevel || sq.constraints?.cognitiveLevel || '').toLowerCase();
  if (cognitiveLevel) {
    var diffCogExpect = targetDifficulty <= 3 ? 'recognize' : targetDifficulty <= 7 ? 'understand' : 'apply';
    if (cognitiveLevel !== diffCogExpect) {
      warnings.push({ code: 'DIFFICULTY_COGNITIVE_DRIFT', field: 'cognitiveLevel', message: 'cognitiveLevel(' + cognitiveLevel + ') 偏离 difficulty(' + targetDifficulty + ') 期望 ' + diffCogExpect, severity: 'WARNING', detail: { cognitiveLevel: cognitiveLevel, difficulty: targetDifficulty, expected: diffCogExpect } });
    }
  }

  
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

  
  var parts = fp.split('|');
  if (parts.length < 7 || parts[0] !== 'v2') {
    errors.push(createError(ERROR_CODES.DUPLICATE_FINGERPRINT_MISMATCH, 'questionFingerprint', 'questionFingerprint 格式非法: ' + fp, SEVERITY.ERROR, { fingerprint: fp, parts: parts }));
  }

  
  
  var ck = Dup.buildCanonicalKey(sq);
  if (!ck) {
    warnings.push({ code: 'DUPLICATE_CANONICAL_MISSING', field: 'canonicalKey', message: '无法计算 canonicalKey', severity: 'WARNING' });
  } else {
    
    
    info.push({ code: 'DUPLICATE_KEYS', field: 'fingerprint', message: 'fingerprint=' + fp + ' | canonicalKey=' + ck, severity: 'INFO' });
  }

  
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
var KnowledgePoint = require("shared/knowledge-point.js");
var Ontology = require("shared/knowledge-ontology.js");


function getKpConstraints(kpId) {
  var kp = KnowledgePoint.get(kpId);
  if (!kp) return null;
  var canonical = Ontology.normalize(kp);
  
  
  var arithSem = null;
  try { arithSem = require("shared/generator/core/kp-arithmetic-semantics.js").resolveArithmeticSemantics(kp); } catch (e) {}
  var complexSem = null;
  try { complexSem = require("shared/generator/core/kp-complex-semantics.js").resolveComplexSemantics(kp); } catch (e) {}
  
  var operation = null;
  if (arithSem && arithSem.operators) operation = arithSem.operators;
  else if (complexSem && complexSem.operators) operation = complexSem.operators;
  else operation = canonical.operation || (canonical.constraints && canonical.constraints.operation) || null;
  
  return {
    id: canonical.id,
    category: canonical.category || kp.legacy?.category,
    legacyType: canonical.source?.legacyType || kp.legacy?.legacyType,
    numericRange: canonical.numeric?.range || null,
    structure: canonical.structure || {},
    generationCapabilities: canonical.generation?.capabilities || [],
    presentationQuestionTypes: (canonical.presentation?.questionTypes || []).map(function(q){ return q.type; }),
    factualContent: canonical.factualContent || null,
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
  if (!kpConstraints) return errors;
  
  var kpOp = kpConstraints.operation;
  if (!kpOp) return errors; 
  
  var sqOp = sq.data?.operation;
  if (!sqOp) return errors; 
  
  
  var kpOps = Array.isArray(kpOp) ? kpOp : [kpOp];
  var sqOps = Array.isArray(sqOp) ? sqOp : [sqOp];
  
  
  var kpOpsNorm = kpOps.map(normalizeOp);
  
  var mismatch = sqOps.some(function(op) {
    var normalized = normalizeOp(op);
    
    if (normalized === 'mixed' && kpOps.length > 1) return false;
    return !kpOpsNorm.some(function(kop) { return kop === normalized; });
  });
  
  if (mismatch) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_OPERATION, 'operation', '题目运算 ' + JSON.stringify(sqOps) + ' 与 KP operation ' + JSON.stringify(kpOps) + ' 不一致', SEVERITY.ERROR, { kpOperation: kpOps, questionOperation: sqOps }));
  }
  return errors;
}

function normalizeOp(op) {
  if (op === '+' || op === 'add') return 'add';
  if (op === '−' || op === '-' || op === 'sub') return 'sub';
  if (op === '×' || op === '*' || op === 'mult') return 'mult';
  if (op === '÷' || op === '/' || op === 'div') return 'div';
  return op;
}


function checkNumeric(sq, kpConstraints) {
  var errors = [];
  if (!kpConstraints?.numericRange) return errors;
  
  var kpRange = kpConstraints.numericRange;
  if (kpRange.min == null && kpRange.max == null) return errors; 
  
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
  
  
  if (kpStruct.maxSteps != null && sqStruct.maxSteps != null) {
    if (sqStruct.maxSteps > kpStruct.maxSteps) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'maxSteps', '题目 maxSteps ' + sqStruct.maxSteps + ' 超过 KP 限制 ' + kpStruct.maxSteps, SEVERITY.ERROR, { kpMaxSteps: kpStruct.maxSteps, sqMaxSteps: sqStruct.maxSteps }));
    }
  }
  
  
  if (kpStruct.allowBracket === false && sqStruct.allowBracket === true) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'allowBracket', 'KP 禁止括号但题目允许括号', SEVERITY.ERROR, {}));
  }
  if (kpStruct.allowMultDiv === false && sqStruct.allowMultDiv === true) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'allowMultDiv', 'KP 禁止乘除但题目允许乘除', SEVERITY.ERROR, {}));
  }
  
  
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
  
  
  var factual = kpConstraints.factualContent;
  if (factual) {
    
    var factualKeys = typeof factual === 'object' ? Object.keys(factual) : [factual];
    var found = false;
    
    
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
      
      warnings.push({ code: 'KP_SEMANTIC_CONTENT_MISSING', field: 'content', message: '题目未体现 KP factualContent: ' + factualKeys.join(','), severity: 'WARN' });
    }
  }
  
  
  var graphicType = kpConstraints.graphicType;
  if (graphicType && sq.data?.graphic?.type && sq.data.graphic.type !== graphicType) {
    warnings.push({ code: 'KP_SEMANTIC_GRAPHIC_MISMATCH', field: 'graphic', message: '题目 graphic.type ' + sq.data.graphic.type + ' 与 KP graphicType ' + graphicType + ' 不符', severity: 'WARN' });
  }
  
  return { errors: errors, warnings: warnings };
}


function checkComposite(sq, plan, kpConstraintsList) {
  var errors = [];
  if (!plan?.combine || !plan?.knowledgePointIds || plan.knowledgePointIds.length <= 1) return errors;
  
  var kpIds = plan.knowledgePointIds;
  var covered = kpIds.filter(function(id) {
    
    var kp = KnowledgePoint.get(id);
    if (!kp) return false;
    var canonical = Ontology.normalize(kp);
    var legacyType = canonical.source?.legacyType || kp.legacy?.legacyType;
    var category = canonical.category || kp.legacy?.category;
    
    
    var searchable = [sq.prompt, sq.data?.operation, sq.data?.graphic?.subtype, sq.data?.shapeName, sq.data?.kind, sq.data?.template].filter(Boolean).join(' ').toLowerCase();
    
    
    var features = [legacyType, category, canonical.operation, canonical.graphicType].filter(Boolean).join(' ').toLowerCase();
    return features.split(' ').some(function(f) { return f && searchable.indexOf(f) !== -1; });
  });
  
  if (covered.length < kpIds.length) {
    var missing = kpIds.filter(function(id) { return covered.indexOf(id) === -1; });
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_COMPOSITE, 'composite', 'Combine 模式下题目未同时体现全部 KP，缺失: ' + missing.join(','), SEVERITY.ERROR, { requiredKpIds: kpIds, coveredKpIds: covered, missingKpIds: missing }));
  }
  return errors;
}


function validateKpSemantics(sq, context) {
  context = context || {};
  var plan = context.plan;
  var kpId = context.kpId || (plan && (plan.knowledgePointIds?.[0] || plan.knowledgePointId));
  var kpConstraints = context.kpConstraints || (kpId ? getKpConstraints(kpId) : null);
  
  var allErrors = [];
  var allWarnings = [];
  var allInfo = [];
  
  
  allErrors.push.apply(allErrors, checkKpIdentity(sq, plan));
  
  
  allErrors.push.apply(allErrors, checkQuestionType(sq, kpConstraints));
  
  
  allErrors.push.apply(allErrors, checkOperation(sq, kpConstraints));
  
  
  allErrors.push.apply(allErrors, checkNumeric(sq, kpConstraints));
  
  
  allErrors.push.apply(allErrors, checkStructure(sq, kpConstraints));
  
  
  var contentResult = checkContent(sq, kpConstraints);
  allErrors.push.apply(allErrors, contentResult.errors);
  allWarnings.push.apply(allWarnings, contentResult.warnings);
  
  
  if (context.kpConstraintsList) {
    allErrors.push.apply(allErrors, checkComposite(sq, plan, context.kpConstraintsList));
  }
  
  var valid = allErrors.length === 0;
  var score = valid ? 1 : Math.max(0, 1 - allErrors.length / 7);
  
  return {
    valid: valid,
    errors: allErrors,
    warnings: allWarnings,
    info: allInfo,
    score: score,
    checks: {
      kpIdentity: checkKpIdentity(sq, plan).length === 0 ? 'pass' : 'fail',
      questionType: checkQuestionType(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      operation: checkOperation(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      numeric: checkNumeric(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      structure: checkStructure(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      content: contentResult.errors.length === 0 ? 'pass' : 'fail',
      composite: (context.kpConstraintsList ? checkComposite(sq, plan, context.kpConstraintsList).length === 0 : 'skipped')
    }
  };
}

module.exports = {
  validateKpSemantics: validateKpSemantics,
  getKpConstraints: getKpConstraints,
  checkKpIdentity: checkKpIdentity,
  checkQuestionType: checkQuestionType,
  checkOperation: checkOperation,
  checkNumeric: checkNumeric,
  checkStructure: checkStructure,
  checkContent: checkContent,
  checkComposite: checkComposite
};
};
global.PresentationEngine = __req("shared/presentation-engine.js");
global.PresentationBundle = __req("shared/presentation-engine.js");
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));