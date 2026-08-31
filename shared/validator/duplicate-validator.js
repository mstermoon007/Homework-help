/**
 * shared/validator/duplicate-validator.js — M5-R10 Duplicate Validator
 *
 * 题目去重：
 *   - Canonical Key: knowledgePoint + operation + operands + structure + format + context
 *   - 同批次去重
 *   - 同一练习去重
 *   - 可选历史题目去重（需外部存储）
 */
'use strict';

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceString(v) { return v == null ? '' : String(v); }
function sortObj(o) { return JSON.stringify(o, Object.keys(o).sort()); }

function buildCanonicalKey(sq) {
  var parts = [];
  parts.push(coerceString(sq.knowledgePoint));
  parts.push(coerceString(sq.questionType || sq.type));
  parts.push(coerceString(sq.question && sq.question.operation));

  // 操作数（排序后）
  var prompt = sq.prompt || (sq.content && sq.content.prompt) || '';
  var nums = (prompt.match(/\d+/g) || []).map(Number).sort(function (a, b) { return a - b; });
  parts.push(nums.join(','));

  // 结构特征
  var ops = (prompt.match(/[+\-×÷*/]/g) || []).sort().join('');
  parts.push(ops);

  // format/context
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
  var key = buildCanonicalKey(sq);

  if (seenKeys.has(key)) {
    errors.push(createError(ERROR_CODES.DUPLICATE_QUESTION, 'canonicalKey', '重复题目: ' + key, SEVERITY.ERROR, { canonicalKey: key }));
  } else {
    seenKeys.add(key);
    info.push({ code: 'UNIQUE', field: 'canonicalKey', message: '题目唯一: ' + key, severity: 'INFO' });
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    info: info,
    score: errors.length === 0 ? 1 : 0,
    checks: { duplicate: errors.length === 0 ? 'pass' : 'fail' },
    seenKeys: seenKeys // 返回更新后的集合供后续题目使用
  };
}

function validateBatchDuplicate(questions, context) {
  context = context || {};
  var seenKeys = context.seenKeys || new Set();
  var results = questions.map(function (sq) {
    var key = buildCanonicalKey(sq);
    var errors = [];
    var warnings = [];
    if (seenKeys.has(key)) {
      errors.push(createError('DUPLICATE_QUESTION', 'canonicalKey', '重复题目: ' + key, 'ERROR', { canonicalKey: key }));
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
  buildCanonicalKey: buildCanonicalKey
};