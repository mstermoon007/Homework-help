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
    var validationResults = [];
    if (!skipValidation) {
      var valContext = { generatorId: selection.record.id, seed: plan.seed, planId: plan.planId };
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
__defs["shared/generator/legacy-adapter.js"] = function (module, exports, require) {
/**
 * shared/generator/legacy-adapter.js — M7-R18/P5 Task 5.1 统一 Legacy 适配层
 *
 * 合并自：
 *   - shared/legacy/plugin-adapter.js
 *   - shared/generator/legacy-plugin-adapter.js
 *   - shared/question/legacy-question-adapter.js
 *   - shared/question/legacy-renderer-adapter.js
 *   - shared/strategy/legacy-adapter.js
 *   - shared/generator/semantic-question-bridge.js
 *
 * 职责：
 *   1. adaptPlanToLegacyOptions(plan, extra) —— Plan → Legacy options
 *   2. generateByPluginId(pluginId, options) —— 加载并调用 legacy 插件
 *   3. toSemanticQuestions(exerciseSet, plan) —— Legacy exerciseSet → SemanticQuestion[]
 *   4. toLegacyQuestion(sq) —— SemanticQuestion → Legacy Question (含 render/check/svg，供旧渲染)
 *   5. hydrateLegacyGenerator(selection, plugin) —— Selector 实例化 legacy 生成器
 *   6. renderSet(set, pluginId) —— plugin.render 桥
 *   7. createLegacyGenerator(plugin, meta) —— Legacy GeneratorContract
 *   8. runLegacyFallback(plugin, plan) —— 兼容旧调用路径
 *
 * 删除：SemanticQuestion → Legacy Question 的反向转换（生成核心不再需要）。
 * 遗留插件输出直接转换为 SemanticQuestion 进入 Pipeline。
 */
(function (global) {
  'use strict';

  var isBrowser = typeof window !== 'undefined';
  var pluginCache = {};

  // ============================================================
  // 内部依赖（懒加载）
  // ============================================================
  function getSQ() {
    if (isBrowser && global.SemanticQuestion) return global.SemanticQuestion;
    if (typeof require === 'function') {
      try { return require("shared/semantic-question.js"); } catch (e) { /* ignore */ }
    }
    return null;
  }
  function getQTR() {
    if (isBrowser && global.QuestionTypeRegistry) return global.QuestionTypeRegistry;
    if (typeof require === 'function') {
      try { return require("shared/question-type-registry.js"); } catch (e) { /* ignore */ }
    }
    return null;
  }
  function getQID() {
    if (isBrowser && global.QuestionID) return global.QuestionID;
    if (typeof require === 'function') {
      try { return require("shared/question-id.js"); } catch (e) { /* ignore */ }
    }
    return null;
  }
  function getPipeline() {
    if (isBrowser && global.ValidationPipeline) return global.ValidationPipeline;
    if (typeof require === 'function') {
      try { return require("shared/validator/validation-pipeline.js"); } catch (e) { /* ignore */ }
    }
    return null;
  }
  function getPluginLoader() {
    if (isBrowser) return global.PluginLoader || null;
    if (typeof require === 'function') {
      try { return require("dev/plugin-loader.js"); } catch (e) { /* ignore */ }
    }
    return null;
  }

  // ============================================================
  // 1. adaptPlanToLegacyOptions —— Plan → Legacy options
  // (原 shared/strategy/legacy-adapter.js)
  // ============================================================
  function adaptPlanToLegacyOptions(plan, extra) {
    plan = plan || {};
    extra = extra || {};

    if (!plan.difficulty) {
      throw new Error('LegacyAdapter: plan 缺少 difficulty');
    }
    if (!plan.questionTypeId) {
      throw new Error('LegacyAdapter: plan 缺少 questionTypeId');
    }
    var constraints = plan.constraints || {};

    var options = {};

    options.difficulty = plan.difficulty;

    options.difficultyParams = {
      level: plan.difficulty,
      scale: constraints.scale != null ? constraints.scale : 1,
      steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
      allowBracket: !!constraints.allowBracket,
      allowMultDiv: !!constraints.allowMultDiv
    };

    if (constraints.numberRange && constraints.numberRange.max != null) {
      options.maxNum = constraints.numberRange.max;
    }

    options.questionType = plan.questionTypeId;

    if (plan.subtype != null && plan.subtype !== '') options.subtype = plan.subtype;

    if (plan.cognitiveLevel != null) options.cognitiveLevel = plan.cognitiveLevel;
    if (plan.spiralLevel != null) options.spiralLevel = plan.spiralLevel;
    if (plan.contextType != null) options.contextType = plan.contextType;

    if (extra.grade != null) options.grade = extra.grade;
    if (plan.count != null) options.count = plan.count;
    else if (extra.count != null) options.count = extra.count;
    if (extra.type != null && extra.type !== '') options.type = extra.type;

    if (Array.isArray(extra.operators) && extra.operators.length) {
      options.operators = extra.operators.map(function (op) {
        if (op === '\u2212' || op === '\u2013' || op === '\uff0d') return '-';
        return op;
      });
    }
    Object.keys(extra.settings || {}).forEach(function (k) {
      if (k === 'type') return;
      var v = extra.settings[k];
      if (v !== '' && v != null) options[k] = v;
    });
    Object.keys(extra.settingNums || {}).forEach(function (k) {
      var v = extra.settingNums[k];
      if (v !== '' && v != null) options[k] = v;
    });

    return options;
  }

  // ============================================================
  // 2. Plugin 加载与生成
  // (原 shared/legacy/plugin-adapter.js + shared/generator/legacy-plugin-adapter.js)
  // ============================================================
  function loadPlugin(id) {
    if (!id) return null;
    if (pluginCache[id]) return pluginCache[id];

    var found = null;
    if (isBrowser) {
      if (global.__mathSubPlugins && global.__mathSubPlugins[id]) found = global.__mathSubPlugins[id];
      else if (global.__currentPlugin && global.__currentPlugin.id === id) found = global.__currentPlugin;
      else if (global.App && global.App.plugins && global.App.plugins[id]) found = global.App.plugins[id];
    } else {
      try {
        var loader = getPluginLoader();
        if (loader) {
          var entry = loader.loadPlugin(id);
          found = entry && !entry.error ? entry.plugin : null;
        }
      } catch (e) { /* ignore */ }
    }
    if (found) pluginCache[id] = found;
    return found || null;
  }

  function setPlugin(id, plugin) {
    if (id && plugin) pluginCache[id] = plugin;
    return plugin;
  }

  function generateByPluginId(pluginId, options) {
    return Promise.resolve().then(function () {
      var plugin = loadPlugin(pluginId);
      if (!plugin || typeof plugin.generate !== 'function') {
        throw new Error('Legacy 插件不可用或未装载: ' + pluginId);
      }
      var set = plugin.generate(options || {});
      return (set && typeof set.then === 'function') ? set : Promise.resolve(set);
    });
  }

  function renderSet(set, pluginId) {
    var plugin = loadPlugin(pluginId);
    if (!plugin || typeof plugin.render !== 'function') return null;
    try { return plugin.render(set); } catch (e) { return null; }
  }

  // ============================================================
  // 3. Legacy exerciseSet → SemanticQuestion[]
  // (原 shared/generator/legacy-plugin-adapter.js::toSemanticQuestions)
  // ============================================================
  function toSemanticQuestions(set, plan, context) {
    context = context || {};
    var questions = (set && Array.isArray(set.questions)) ? set.questions : [];
    var constraints = plan.constraints || {};
    var seedBase = context.seed;
    var SQ = getSQ();

    return questions.map(function (q, i) {
      var isReadAloud = q.answer == null && q.inputType == null && (q.letter != null || q.name != null);
      var dataPrompt = q.data ? (q.data.question != null ? q.data.question
        : (q.data.prompt != null ? q.data.prompt
          : (q.data.text != null ? q.data.text : null))) : null;
      var prompt = q.q != null ? q.q
        : (q.question != null ? q.question
          : (q.text != null ? q.text
            : (q.stem != null ? q.stem
              : (dataPrompt != null ? dataPrompt
                : (q.name != null ? q.name
                  : (q.char != null ? q.char
                    : (q.pinyin != null ? q.pinyin
                      : (q.letter != null ? q.letter : ''))))))));

      var rawAnswer = q.answer != null ? q.answer : null;
      var answerObj = (typeof rawAnswer === 'object' && rawAnswer !== null) ? rawAnswer : { value: rawAnswer, acceptable: [] };

      var answerMode = isReadAloud ? 'read-aloud' : mapInputType(q.inputType || q.type);

      var distractors = [];
      var allOptions = [];
      if (!isReadAloud && (q.inputType === 'choice' || q.type === 'choice') && Array.isArray(q.options)) {
        var correct = rawAnswer != null ? coerceScalar(rawAnswer) : null;
        allOptions = q.options.slice();
        q.options.forEach(function (opt) {
          var val = coerceScalar(opt);
          if (val && val !== correct) distractors.push({ value: val, errorType: '概念混淆', weight: 1 });
        });
      } else if (distractors.length > 0) {
        var correct = answerObj && answerObj.value != null ? coerceScalar(answerObj.value) : null;
        if (correct) allOptions = [correct].concat(distractors.map(function (d) { return d.value; }));
      }

      var svgRaw = q.svg || q.illustration || null;
      if (!svgRaw && typeof q.render === 'function') {
        svgRaw = captureSvg(q.render, q, i);
      }

      var sq = {
        knowledgePointId: plan.knowledgePointId,
        questionType: plan.questionTypeId,
        difficulty: q.difficulty != null ? q.difficulty : plan.difficulty,
        difficultyParams: {
          level: plan.difficulty,
          scale: constraints.scale != null ? constraints.scale : 1,
          steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
          allowBracket: !!constraints.allowBracket,
          allowMultDiv: !!constraints.allowMultDiv
        },
        numberRange: constraints.numberRange || { min: 1, max: 1 },
        spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
        context: plan.contextType != null ? plan.contextType : 'standard',
        seed: seedBase != null ? seedBase + ':' + i : null,
        content: { prompt: prompt },
        question: { prompt: prompt, answerMode: answerMode },
        answer: answerObj,
        distractors: distractors,
        options: allOptions.length ? allOptions : undefined,
        graphic: q.graphic != null ? q.graphic
          : (svgRaw ? { type: 'custom', subtype: null, params: { rawSvg: svgRaw }, renderHints: {} } : null),
        hint: q.hint != null ? q.hint : null,
        data: {
          kind: q.kind != null ? q.kind : null,
          type: q.type != null ? q.type : null,
          letter: q.letter != null ? q.letter : null,
          name: q.name != null ? q.name : null,
          example: q.example != null ? q.example : null,
          raw: (q.data != null && typeof q.data === 'object') ? safeCopy(q.data) : null,
          meta: safeCopy(set.meta)
        }
      };
      return SQ.createSemanticQuestion(sq);
    });
  }

  // ============================================================
  // 4. Legacy Question → SemanticQuestion
  // (原 shared/question/legacy-question-adapter.js::adaptQuestion)
  // ============================================================
  function adaptQuestion(legacyQ, context) {
    context = context || {};
    legacyQ = legacyQ || {};
    var SQ = getSQ();
    var QTR = getQTR();
    var QID = getQID();

    // 基础字段提取
    var prompt = coerceString(legacyQ.q || legacyQ.text || legacyQ.stem || legacyQ.question || '');
    var answerVal = legacyQ.answer;
    var answerObj = (typeof answerVal === 'object' && answerVal !== null) ? answerVal : { value: answerVal };

    var answerModeMap = {
      'text': 'input',
      'input': 'input',
      'choice': 'choice',
      'multi': 'multi',
      'none': 'none',
      'read-aloud': 'read-aloud'
    };
    var inputType = legacyQ.inputType || legacyQ.type || 'text';
    var answerMode = answerModeMap[inputType] || 'input';

    var distractors = [];
    if (inputType === 'choice' && Array.isArray(legacyQ.options)) {
      var correct = coerceScalar(answerVal);
      legacyQ.options.forEach(function (opt) {
        var val = coerceScalar(opt);
        if (val && val !== correct) {
          distractors.push({ value: val, errorType: '概念混淆', weight: 1 });
        }
      });
    }

    var graphic = null;
    if (legacyQ.svg || legacyQ.graphic || legacyQ.drawing) {
      graphic = {
        type: 'custom',
        subtype: null,
        params: { legacySvg: legacyQ.svg || legacyQ.graphic || legacyQ.drawing },
        renderHints: {}
      };
    }

    var knowledgePoint = context.knowledgePointId || legacyQ.knowledgePointId || legacyQ.kpId || '';
    var questionType = legacyQ.questionType || legacyQ.type || legacyQ.kind || 'calc';
    var norm = QTR && typeof QTR.normalizeQuestionType === 'function' ? QTR.normalizeQuestionType(questionType, { allowHeuristic: true }) : null;
    if (norm && norm.id) questionType = norm.id;
    var skill = legacyQ.skill || legacyQ.ability || '';

    var difficulty = context.difficulty != null ? context.difficulty : coerceInteger(legacyQ.difficulty);

    var metadata = {
      generator: context.generatorId || legacyQ.generator || legacyQ.pluginId || 'legacy:unknown',
      generatorVersion: context.generatorVersion || legacyQ.generatorVersion || '1.0.0',
      seed: context.seed || legacyQ.seed || legacyQ.randomSeed,
      planId: context.planId || null,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      validationScore: null,
      tags: ['legacy-adapted']
    };

    var sq = SQ.createSemanticQuestion({
      id: legacyQ.id || legacyQ.questionId,
      knowledgePoint: knowledgePoint,
      skill: skill,
      difficulty: difficulty,
      difficultyParams: legacyQ.difficultyParams || null,
      question: { prompt: prompt },
      content: { prompt: prompt },
      answer: { value: answerVal, acceptable: ensureArray(answerObj.acceptable) },
      distractors: distractors,
      graphic: graphic,
      metadata: metadata,
      render: legacyQ.render || null,
      check: legacyQ.check || null,
      svg: legacyQ.svg || null,
      questionType: questionType,
      answerMode: answerMode,
      type: legacyQ.type || null,
      hint: legacyQ.hint || null,
      numberRange: legacyQ.numberRange || null,
      difficultyParams: legacyQ.difficultyParams || null
    });

    return sq;
  }

  function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }
  function ensureArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }
  function seededIndex(seedStr) {
    var h = 2166136261;
    var s = String(seedStr);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0);
  }

  // ============================================================
  // 5. SemanticQuestion → Legacy Question (含 render/check/svg)
  // (原 shared/question/legacy-question-adapter.js::toLegacyQuestion)
  // ============================================================
  function toLegacyQuestion(sq) {
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

    var legacyQ = {
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
      hint: sq.hint,
      numberRange: sq.numberRange,
      render: sq.render || null,
      check: sq.check || null,
      svg: sq.svg || (sq.graphic && sq.graphic.params && (sq.graphic.params.rawSvg || sq.graphic.params.legacySvg)) || null
    };

    return legacyQ;
  }

  function toLegacyQuestions(semanticQuestions) {
    if (!Array.isArray(semanticQuestions)) return [];
    return semanticQuestions.map(toLegacyQuestion);
  }

  // ============================================================
  // 5. createLegacyGenerator —— Legacy GeneratorContract
  // (原 shared/generator/legacy-plugin-adapter.js::createLegacyGenerator)
  // ============================================================
  function createLegacyGenerator(plugin, meta) {
    meta = meta || {};
    var capabilities = Array.isArray(meta.capabilities) ? meta.capabilities.slice() : [];
    var knowledgePoints = Array.isArray(meta.knowledgePoints) ? meta.knowledgePoints.slice() : [];

    var generator = {
      id: 'legacy:' + (plugin.id || 'plugin'),
      subject: canonSubject(plugin.subject || 'math'),
      capabilities: capabilities,
      knowledgePoints: knowledgePoints,
      plugin: plugin,

      supports: function (plan) {
        if (!plan || !plan.questionTypeId) return false;
        if (capabilities.length && capabilities.indexOf(plan.questionTypeId) === -1) return false;
        if (knowledgePoints.length && plan.knowledgePointId &&
            knowledgePoints.indexOf(plan.knowledgePointId) === -1) return false;
        return true;
      },

      generate: function (plan, context) {
        context = context || {};
        var MAX_RETRIES = 3;

        function doGenerate(attempt) {
          var ctx = attempt === 0 ? context : { seed: (context.seed || '') + ':r' + attempt, legacy: context.legacy };
          var options = adaptPlanToLegacyOptions(plan, ctx.legacy || {});
          if (attempt > 0 && options.seed != null) {
            options.seed = options.seed + ':r' + attempt;
          }
          var set = plugin.generate(options);

          function handleResult(s) {
            var sqs = toSemanticQuestions(s, plan, ctx);
            var q = checkBatchQuality(sqs, plan);
            if (!q.ok && attempt < MAX_RETRIES) return doGenerate(attempt + 1);
            return sqs;
          }

          if (set && typeof set.then === 'function') {
            return set.then(handleResult);
          }
          return handleResult(set);
        }

        return doGenerate(0);
      }
    };
    return generator;
  }

  function hydrateLegacyGenerator(selection, plugin) {
    if (!selection || !selection.record) return null;
    if (!plugin) {
      var pid = selection.record.pluginId;
      if (!pid && typeof selection.record.id === 'string' && selection.record.id.indexOf('legacy:') === 0) {
        pid = selection.record.id.slice('legacy:'.length);
      }
      plugin = loadPlugin(pid);
    }
    if (!plugin) return null;
    return createLegacyGenerator(plugin, {
      capabilities: selection.record.capabilities,
      knowledgePoints: selection.record.knowledgePoints
    });
  }

  // ============================================================
  // 6. runLegacyFallback —— 兼容旧调用路径
  // ============================================================
  async function runLegacyFallback(plugin, plan, uiExtra) {
    var options = adaptPlanToLegacyOptions(plan, uiExtra || {});
    return Promise.resolve(plugin.generate(options));
  }

  // ============================================================
  // 内部工具函数
  // ============================================================
  function mapInputType(inputType) {
    if (inputType === 'read-aloud') return 'read-aloud';
    return 'input';
  }

  function coerceScalar(v) {
    if (v == null) return null;
    if (typeof v === 'object') {
      if (Array.isArray(v)) return v.length ? String(v[0]) : null;
      return v.value != null ? String(v.value) : (v.correctAnswer != null ? String(v.correctAnswer) : null);
    }
    return String(v);
  }

  function coerceString(v) {
    if (v == null) return '';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
  }

  function safeCopy(v) {
    if (v == null) return null;
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }

  function parseOperands(prompt) {
    if (!prompt || typeof prompt !== 'string') return [];
    var nums = [];
    var re = /(-?\d+\.?\d*)/g;
    var m;
    while ((m = re.exec(prompt)) !== null) nums.push(Number(m[1]));
    return nums;
  }

  function checkBatchQuality(sqs, plan) {
    var range = (plan.constraints && plan.constraints.numberRange) || null;
    var seen = {};
    for (var i = 0; i < sqs.length; i++) {
      var q = sqs[i];
      var prompt = (q.content && q.content.prompt) || (q.question && q.question.prompt) || '';
      if (range) {
        var ops = parseOperands(prompt);
        for (var j = 0; j < ops.length; j++) {
          if (ops[j] < range.min || ops[j] > range.max) return { ok: false, reason: 'bounds' };
        }
      }
      if (seen[prompt]) return { ok: false, reason: 'duplicates' };
      seen[prompt] = true;
    }
    return { ok: true };
  }

  function captureSvg(renderFn, owner, index) {
    if (typeof renderFn !== 'function') return null;
    try {
      var out = renderFn.call(owner, index);
      if (out == null) return null;
      var s = String(out);
      var start = s.indexOf('<svg');
      if (start === -1) return null;
      var end = s.indexOf('</svg>', start);
      if (end === -1) return null;
      return s.slice(start, end + '</svg>'.length);
    } catch (e) { return null; }
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

  function canonSubject(s) { return (s || 'math').toLowerCase(); }

  // ============================================================
  // 暴露 API
  // ============================================================
  var API = {
    adaptPlanToLegacyOptions: adaptPlanToLegacyOptions,
    loadPlugin: loadPlugin,
    setPlugin: setPlugin,
    generateByPluginId: generateByPluginId,
    renderSet: renderSet,
    toSemanticQuestions: toSemanticQuestions,
    adaptQuestion: adaptQuestion,
    toLegacyQuestion: toLegacyQuestion,
    toLegacyQuestions: toLegacyQuestions,
    createLegacyGenerator: createLegacyGenerator,
    hydrateLegacyGenerator: hydrateLegacyGenerator,
    runLegacyFallback: runLegacyFallback,
    coerceString: coerceString,
    safeCopy: safeCopy
  };

  global.LegacyAdapter = API;
  if (global.App && typeof global.App === 'object') global.App.LegacyAdapter = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);
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