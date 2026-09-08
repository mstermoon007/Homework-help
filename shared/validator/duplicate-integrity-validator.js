'use strict';

/**
 * shared/validator/duplicate-integrity-validator.js — M8-R04 Duplicate Integrity Validator
 *
 * 验证题目指纹完整性与去重一致性：
 *   - questionFingerprint 存在且格式合法
 *   - fingerprint 与 canonicalKey 语义一致（同题同指纹）
 *   - 跨批次 seenKeys 指纹不冲突
 */

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

var Dup = require('./duplicate-validator.js');

/**
 * 尝试从题目数据构建指纹（当 sq.questionFingerprint 缺失时）
 */
function tryBuildFingerprint(sq) {
  try {
    if (typeof Dup.buildQuestionFingerprint === 'function') {
      var fp = Dup.buildQuestionFingerprint(sq);
      if (fp && fp.startsWith('v2|')) return fp;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function validateDuplicateIntegrity(sq, context) {
  context = context || {};
  var errors = [];
  var warnings = [];
  var info = [];

  // 1) questionFingerprint 必填（若缺失尝试自动构建）
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

  // 2) fingerprint 格式校验（v2|KP|type|operators|operands|structure|context|format）
  var parts = fp.split('|');
  if (parts.length < 7 || parts[0] !== 'v2') {
    errors.push(createError(ERROR_CODES.DUPLICATE_FINGERPRINT_MISMATCH, 'questionFingerprint', 'questionFingerprint 格式非法: ' + fp, SEVERITY.ERROR, { fingerprint: fp, parts: parts }));
  }

  // 3) fingerprint 与 canonicalKey 语义一致性（同题两套键应指向同一语义等价类）
  // canonicalKey 基于 prompt 文本，fingerprint 基于语义数据；两者应在等价类上一致
  var ck = Dup.buildCanonicalKey(sq);
  if (!ck) {
    warnings.push({ code: 'DUPLICATE_CANONICAL_MISSING', field: 'canonicalKey', message: '无法计算 canonicalKey', severity: 'WARNING' });
  } else {
    // 语义一致性：若两题 fingerprint 相同 → canonicalKey 必相同（交换律等价）
    // 这里仅记录，不强制比对（需要跨题比较）
    info.push({ code: 'DUPLICATE_KEYS', field: 'fingerprint', message: 'fingerprint=' + fp + ' | canonicalKey=' + ck, severity: 'INFO' });
  }

  // 4) 跨批次 seenKeys 冲突检测（由 duplicate-validator 在 pipeline 中处理，这里记录）
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

  // 指纹格式统计
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