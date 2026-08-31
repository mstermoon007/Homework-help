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

var SQ = require('../semantic-question.js');
var LQA = require('../question/legacy-question-adapter.js');
var Pipeline = require('../validator/validation-pipeline.js');
var BatchValidator = require('../validator/batch-validator.js');
var RetryLoop = require('./retry-loop.js');
var QID = require('../question-id.js');

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
      var baseSeed = plan.seed || require('../question-id.js').generateBaseSeed();
      var seeds = require('../question-id.js').generateSeedsForPlan({
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
  return require('../semantic-question.js').createSemanticQuestion(Object.assign({}, item, {
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
        return require('../question/legacy-question-adapter.js').adaptQuestion(q, {
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
 * 校验 Generator 实例是否符合新契约，并可对 Generator 源码做禁止项扫描。
 * @param {Object} gen
 * @param {string|null} [sourceText] Generator 源码（可选，用于禁止项扫描）
 * @returns {Object} { valid, errors: string[], warnings }
 */
function validateGeneratorContract(g, sourceText) {
  var errors = [];
  var warnings = [];

  if (!g || typeof g !== 'object') {
    return { valid: false, errors: ['GeneratorContract 必须是对象'], warnings: warnings };
  }

  if (!g.id || typeof g.id !== 'string') errors.push('id 必填（字符串）');
  if (!g.subject || SUBJECTS[g.subject] == null) errors.push('subject 非法: ' + g.subject + '（math/cn/en）');
  if (!Array.isArray(g.capabilities) || g.capabilities.length === 0) {
    errors.push('capabilities 必须是非空数组');
  } else {
    var QTR = require('../question-type-registry.js');
    (g.capabilities || []).forEach(function (c) {
      if (!QTR.has(c)) errors.push('capability 非法: ' + c + '（不在 QuestionType Registry）');
    });
  }
  if (!Array.isArray(g.knowledgePoints)) errors.push('knowledgePoints 必须是数组');
  if (typeof g.supports !== 'function') errors.push('supports(plan) 必须是函数');
  if (typeof g.generate !== 'function') errors.push('generate(plan, context) 必须是函数');

  if (sourceText != null) {
    FORBIDDEN_PATTERNS.forEach(function (f) {
      if (f.pattern.test(sourceText)) errors.push('源码违规：' + f.label);
    });
  }

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

  return require('./retry-loop.js').generateWithRetry(
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
  var QTR = require('../question-type-registry.js');
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