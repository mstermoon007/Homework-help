/**
 * shared/validator/distractor-validator.js — M5-R07 Distractor Validator
 *
 * 验证选择题干扰项：
 *   - 干扰项数量
 *   - 干扰项唯一性
 *   - 干扰项不能等于正确答案
 *   - 干扰项类型一致
 *   - 干扰项必须属于允许答案域
 *   - errorType 分类合法
 */
'use strict';

var Validator = require('./question-validator.js');
var Schema = require('../schemas/semantic-question.schema.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceString(v) { return v == null ? '' : String(v); }

function validateDistractors(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  var distractors = sq.distractors;
  if (!distractors || !Array.isArray(distractors)) {
    // 非选择题可无 distractors
    return { valid: true, errors: [], warnings: [], info: [], score: 1, checks: { distractor: 'skip' } };
  }

  var answerVal = sq.answer && sq.answer.value != null ? coerceString(sq.answer.value) : '';
  var qType = sq.questionType || sq.type;

  // ① 数量检查（选择题通常 3-4 个干扰项）
  if (distractors.length === 0) {
    warnings.push(createError(ERROR_CODES.DISTRACTOR_COUNT_INVALID, 'distractors.length', '选择题缺少干扰项', SEVERITY.WARNING));
  } else if (distractors.length > 6) {
    warnings.push(createError(ERROR_CODES.DISTRACTOR_COUNT_INVALID, 'distractors.length', '干扰项过多(' + distractors.length + ')，建议 3-4 个', SEVERITY.WARNING));
  }

  // ② 唯一性 & ③ 不等于正确答案 & ④ 类型一致 & ⑤ errorType 合法
  var seen = {};
  distractors.forEach(function (d, i) {
    if (!d || typeof d !== 'object') {
      warnings.push(createError(ERROR_CODES.DISTRACTOR_TYPE_MISMATCH, 'distractors[' + i + ']', '干扰项应为对象', SEVERITY.WARNING));
      return;
    }
    var val = coerceString(d.value);
    if (!val) {
      warnings.push(createError(ERROR_CODES.DISTRACTOR_TYPE_MISMATCH, 'distractors[' + i + '].value', '干扰项值为空', SEVERITY.WARNING));
      return;
    }
    // 唯一性
    if (seen[val]) {
      errors.push(createError(ERROR_CODES.DISTRACTOR_DUPLICATE, 'distractors[' + i + ']', '重复干扰项: ' + val, SEVERITY.ERROR));
    } else {
      seen[val] = true;
    }
    // 不等于正确答案
    if (answerVal && val === answerVal) {
      errors.push(createError(ERROR_CODES.DISTRACTOR_EQUALS_ANSWER, 'distractors[' + i + ']', '干扰项等于正确答案: ' + val, SEVERITY.ERROR));
    }
    // errorType 合法性
    if (d.errorType && !Schema.isValidDistractorErrorType(d.errorType)) {
      warnings.push(createError(ERROR_CODES.DISTRACTOR_ERROR_TYPE_INVALID, 'distractors[' + i + '].errorType', '未知错误类型: ' + d.errorType, SEVERITY.WARNING));
    }
  });

  // ⑤ 域检查（可选：若答案是数值，干扰项也应为数值）
  if (answerVal && !isNaN(Number(answerVal))) {
    distractors.forEach(function (d, i) {
      if (d.value != null && isNaN(Number(d.value))) {
        warnings.push(createError(ERROR_CODES.DISTRACTOR_OUT_OF_DOMAIN, 'distractors[' + i + ']', '数值题干扰项应为数值: ' + d.value, SEVERITY.WARNING));
      }
    });
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: [], score: valid ? 1 : 0.5, checks: { distractor: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateDistractors: validateDistractors
};