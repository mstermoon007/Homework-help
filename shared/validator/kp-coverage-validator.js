'use strict';

/**
 * shared/validator/kp-coverage-validator.js — M8-R01 KP Coverage Validator
 *
 * 验证题目是否覆盖了指定的知识点要求：
 *   - 单 KP：题目必须绑定目标 KP
 *   - 多 KP (combine)：题目必须覆盖全部目标 KP（或至少主 KP）
 *   - 计划级：批次题目集合必须覆盖计划要求的所有 KP
 */

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

/**
 * 单题级 KP 覆盖验证
 * @param {Object} sq SemanticQuestion
 * @param {Object} context { requiredKpIds: string[], planId }
 */
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

/**
 * 批次级 KP 覆盖验证（计划要求所有 KP 至少出现一次）
 * @param {Array<Object>} questions
 * @param {Object} context { requiredKpIds: string[], planId }
 */
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