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

// 全角数字 → 半角
function toHalfWidth(str) {
  return String(str == null ? '' : str).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
}

// 提取操作数：优先 data.operands（语义层原始数字），缺省回退 prompt 解析
function extractOperands(sq) {
  var data = sq && sq.data;
  if (Array.isArray(data && data.operands) && data.operands.length) {
    return data.operands.map(function (n) { return parseInt(n, 10); }).filter(function (n) { return !isNaN(n); });
  }
  var half = toHalfWidth(sq.prompt || (sq.content && sq.content.prompt) || '');
  return (half.match(/\d+/g) || []).map(function (n) { return parseInt(n, 10); }).filter(function (n) { return !isNaN(n); });
}

// 提取运算符集合（排序归一，忽略顺序，同式异写同指纹）
function extractOperators(sq) {
  var ops = [];
  var data = sq && sq.data;
  var opSeeds = [];
  if (data && data.operation) opSeeds.push(data.operation);
  if (Array.isArray(data && data.operators)) opSeeds.push.apply(opSeeds, data.operators);
  opSeeds.forEach(function (op) {
    if (typeof op === 'string') ops.push(op.toLowerCase());
    else if (op && typeof op.symbol === 'string') ops.push(op.symbol);
  });
  if (ops.length) return ops;

  var half = toHalfWidth(sq.prompt || (sq.content && sq.content.prompt) || '');
  return (half.replace(/[＋－]/g, function (c) { return c === '＋' ? '+' : '-'; })
    .match(/[+\-×÷*/−]/g) || []).map(function (o) {
    return o === '−' ? '-' : o;
  });
}

// 结构特征：steps / mode / operators 集合 / 括号等
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

/**
 * 统一题目指纹（预生成/存储用）：
 *   knowledgePoint | questionType | semantic(operation/operators) | numbers(排序操作数)
 *   | structure(steps/mode/operators) | context | format
 * 语义等价（同式异写、交换律等价）→ 同指纹；不同题目 → 不同指纹。
 */
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

  // 操作数（排序后）：全角→半角归一，parseInt 去前导零
  var half = toHalfWidth(sq.prompt || (sq.content && sq.content.prompt) || '');
  var nums = (half.match(/\d+/g) || []).map(function (n) { return parseInt(n, 10); }).sort(function (a, b) { return a - b; });
  parts.push(nums.join(','));

  // 结构特征（全角×÷−＋ 归一为半角，同式异写同指纹）
  var ops = (half.replace(/[＋－]/g, function (c) { return c === '＋' ? '+' : '-'; })
    .match(/[+\-×÷*/−]/g) || []).map(function (o) {
    return o === '−' ? '-' : o;
  }).sort().join('');
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
  buildCanonicalKey: buildCanonicalKey,
  buildQuestionFingerprint: buildQuestionFingerprint,
  extractOperands: extractOperands,
  extractOperators: extractOperators,
  extractStructureKey: extractStructureKey
};