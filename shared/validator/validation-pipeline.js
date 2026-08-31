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
var kpValidator = require('./kp-validator.js');
var answerValidator = require('./answer-validator.js');
var distractorValidator = require('./distractor-validator.js');
var structureValidator = require('./structure-validator.js');
var difficultyValidator = require('./difficulty-validator.js');
var duplicateValidator = require('./duplicate-validator.js');
var graphicValidator = require('./graphic-validator.js');
var renderPreflight = require('./render-preflight.js');

var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;

// 验证器执行顺序（核心→业务→结构→质量→去重→渲染）
var PIPELINE_STEPS = [
  { name: 'schema', fn: Validator.validateSchemaOnly, required: true },
  { name: 'knowledgePoint', fn: kpValidator.validateKnowledgePoint, required: false },
  { name: 'answer', fn: answerValidator.validateAnswer, required: false },
  { name: 'distractor', fn: distractorValidator.validateDistractors, required: false },
  { name: 'structure', fn: structureValidator.validateStructure, required: false },
  { name: 'difficulty', fn: difficultyValidator.validateDifficulty, required: false },
  { name: 'duplicate', fn: duplicateValidator.validateDuplicate, required: false },
  { name: 'graphic', fn: graphicValidator.validateGraphic, required: false },
  { name: 'renderPreflight', fn: renderPreflight.validateRenderPreflight, required: false }
];

/**
 * 运行完整验证管道
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

  for (var i = 0; i < PIPELINE_STEPS.length; i++) {
    var step = PIPELINE_STEPS[i];
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

    // 关键验证器失败且 required=true → 短路（如 Schema）
    if (step.required && (!result.valid || (result.errors && result.errors.length))) {
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

module.exports = {
  runPipeline: runPipeline,
  runPipelineBatch: runPipelineBatch,
  PIPELINE_STEPS: PIPELINE_STEPS
};