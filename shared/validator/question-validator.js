/**
 * shared/validator/question-validator.js — M5-R04 Validator 核心接口
 *
 * 统一验证入口：
 *   validate(question, context) → { valid, errors, warnings, score, checks }
 *
 * 设计：
 *   - 不修改原题目（纯函数）
 *   - 错误分级：ERROR / WARNING / INFO
 *   - 统一错误码（见 semantic-question.schema.js ERROR_CODES）
 *   - 支持插件式验证器链（后续 Pipeline 组合）
 */
'use strict';

var Schema = require('../schemas/semantic-question.schema.js');
var ERROR_CODES = Schema.ERROR_CODES;
var SEVERITY = Schema.SEVERITY;

function createError(code, field, message, severity, detail) {
  return { code: code, field: field, message: message, severity: severity || SEVERITY.ERROR, detail: detail };
}

/**
 * 核心 Schema 校验（复用 semantic-question.js 的 validateSchema）
 * @param {Object} sq
 * @returns {Object} { valid, errors, warnings, info }
 */
function validateSchemaOnly(sq) {
  return require('../semantic-question.js').validateSchema(sq);
}

/**
 * 空验证器（基类/占位）
 * @returns {Object} { valid: true, errors: [], warnings: [], info: [], score: 1, checks: {} }
 */
function noopValidator(sq, context) {
  return { valid: true, errors: [], warnings: [], info: [], score: 1, checks: {} };
}

/**
 * 组合多个验证器结果
 * @param {Array<Object>} results
 * @returns {Object}
 */
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

/**
 * 主验证入口（当前仅 Schema 校验，后续 Pipeline 接管完整链路）
 * @param {Object} question SemanticQuestion
 * @param {Object} context 验证上下文
 * @returns {Object} { valid, errors, warnings, info, score, checks }
 */
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

/**
 * 批量验证
 * @param {Array<Object>} questions
 * @param {Object} context
 * @returns {Array<Object>}
 */
function validateBatch(questions, context) {
  if (!Array.isArray(questions)) return [];
  return questions.map(function (q) { return validate(q, context); });
}

/**
 * 判断错误是否可重试（用于 Retry Loop）
 * @param {string} code 错误码
 * @returns {boolean}
 */
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

/**
 * 判断错误是否致命（不可恢复，立即暴露）
 * @param {string} code 错误码
 * @returns {boolean}
 */
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