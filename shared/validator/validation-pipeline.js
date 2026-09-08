/**
 * shared/validator/validation-pipeline.js — M5-R13 Validation Pipeline
 *
 * 统一验证管道，按顺序执行：
 *   Schema → KnowledgePoint → Answer → Distractor → Structure → Difficulty → Duplicate → Graphic → RenderPreflight
 *
 * 输出：
 *   { valid, errors, warnings, info, score, checks: { schema, knowledgePoint, answer, ... } }
 */
'use strict';

var Validator = require('./question-validator.js');
var Schema = require('../schemas/semantic-question.schema.js');
var answerValidator = require('./answer-validator.js');
var difficultyValidator = require('./difficulty-validator.js');
var duplicateValidator = require('./duplicate-validator.js');
var kpCoverageValidator = require('./kp-coverage-validator.js');
var compositeValidator = require('./composite-validator.js');
var difficultyIntegrityValidator = require('./difficulty-integrity-validator.js');
var duplicateIntegrityValidator = require('./duplicate-integrity-validator.js');
var kpSemanticValidator = require('./kp-semantic-validator.js');

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

/**
 * 运行完整验证管道（分层执行，Layer 1 失败即停止）
 * @param {Object} sq SemanticQuestion
 * @param {Object} context 验证上下文
 * @returns {Object} { valid, errors, warnings, info, score, checks }
 */
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
        var err = require('./question-validator.js').createError(
          'VALIDATOR_EXCEPTION', step.name, '验证器异常: ' + e.message, 'ERROR', { stack: e.stack });
        result = { valid: false, errors: [err], warnings: [], info: [], score: 0, checks: {} };
      }

      // 累积结果
      if (result.errors) allErrors.push.apply(allErrors, result.errors);
      if (result.warnings) allWarnings.push.apply(allWarnings, result.warnings);
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

  return {
    valid: valid,
    errors: allErrors,
    warnings: allWarnings,
    info: allInfo,
    score: score,
    checks: checks
  };
}

/**
 * 批量运行管道（共享 seenKeys 做去重）
 * @param {Array<Object>} questions
 * @param {Object} context
 * @returns {Array<Object>}
 */
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

/**
 * 运行批次级验证器
 * @param {Array<Object>} questions
 * @param {Object} context
 * @returns {Object} { results: Array, batchChecks: Object }
 */
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
      var err = require('./question-validator.js').createError(
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

/**
 * 批量验证入口（RetryLoop / 上层复用）
 */
module.exports = {
  runPipeline: runPipeline,
  runPipelineBatch: runPipelineBatch,
  runBatchValidators: runBatchValidators,
  PIPELINE_STEPS: PIPELINE_STEPS,
  BATCH_VALIDATORS: BATCH_VALIDATORS
};