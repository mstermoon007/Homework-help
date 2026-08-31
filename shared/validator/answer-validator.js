/**
 * shared/validator/answer-validator.js — M5-R06 Answer Validator
 *
 * 验证题目答案正确性：
 *   - 数值计算（四则运算、进位/退位、分数、小数）
 *   - 填空题
 *   - 选择题（答案在选项中）
 *   - 判断题（对/错）
 *   - 简单文本答案
 *
 * 核心逻辑：题干 → 计算/规则 → answer，不能只检查 answer != null
 */
'use strict';

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceString(v) { return v == null ? '' : String(v); }
function coerceNumber(v) { if (v == null) return null; var n = Number(v); return isNaN(n) ? null : n; }
function safeTrim(v) { return coerceString(v).trim(); }

/**
 * 计算标准算式的正确答案
 * 支持：a + b, a - b, a × b, a ÷ b, 混合运算（含括号）
 * @param {string} prompt
 * @returns {string|null} 正确答案字符串，无法解析返回 null
 */
function computeExpectedAnswer(prompt) {
  var expr = coerceString(prompt).replace(/[？?□_\\s]/g, '').replace(/[×xX]/g, '*').replace(/[÷]/g, '/').replace(/[＝=]/g, '');
  if (!expr) return null;

  try {
    // 简单表达式求值（仅支持 + - * / ( )）
    // 注意：生产环境建议用 math.js 或安全表达式解析器
    var fn = new Function('return ' + expr);
    var result = fn();
    if (typeof result === 'number' && isFinite(result)) {
      // 整数保持整数，小数保留 2 位
      return Number.isInteger(result) ? String(result) : result.toFixed(2).replace(/\.?0+$/, '');
    }
    return String(result);
  } catch (e) {
    return null;
  }
}

/**
 * 验证数值答案
 * @param {Object} answerObj { value, acceptable, precision, unit }
 * @param {string} expected 期望正确答案
 * @returns {Object} { match, errors, warnings }
 */
function validateNumericAnswer(answerObj, expected) {
  var errors = [];
  var warnings = [];
  var val = answerObj.value;
  var acceptable = Array.isArray(answerObj.acceptable) ? answerObj.acceptable : [];

  var candidates = [val].concat(acceptable).map(function (v) { return coerceString(v).trim(); }).filter(function (v) { return v !== ''; });
  var expectedStr = coerceString(expected).trim();

  var match = candidates.some(function (c) {
    // 数值比较（允许精度差异）
    var cn = coerceNumber(c);
    var en = coerceNumber(expectedStr);
    if (cn != null && en != null) {
      var precision = answerObj.precision != null ? answerObj.precision : 2;
      return Math.abs(cn - en) < Math.pow(10, -precision);
    }
    return c === expectedStr;
  });

  if (!match) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '答案不匹配：期望 ' + expectedStr + '，实际 ' + candidates.join('/'), SEVERITY.ERROR, { expected: expectedStr, actual: candidates }));
  }
  return { match: match, errors: errors, warnings: warnings };
}

/**
 * 验证选择题答案（答案必须在选项中）
 * @param {Object} answerObj
 * @param {Array<string>} options
 * @returns {Object}
 */
function validateChoiceAnswer(answerObj, options) {
  var errors = [];
  var val = coerceString(answerObj.value);
  if (!val) {
    errors.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '选择题答案为空', SEVERITY.ERROR));
    return { match: false, errors: errors, warnings: [] };
  }
  var optStrs = options.map(function (o) { return coerceString(o).trim(); });
  if (optStrs.indexOf(val) === -1) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '答案 ' + val + ' 不在选项中', SEVERITY.ERROR, { answer: val, options: optStrs }));
    return { match: false, errors: errors, warnings: [] };
  }
  return { match: true, errors: [], warnings: [] };
}

/**
 * 验证判断题答案（对/错、true/false、是/否、✓/✗）
 * @param {Object} answerObj
 * @param {boolean} expected 期望布尔值
 * @returns {Object}
 */
function validateJudgeAnswer(answerObj, expected) {
  var errors = [];
  var val = coerceString(answerObj.value).toLowerCase().trim();
  var trueSet = ['true', '对', '是', 'yes', 'y', 't', '1', 'true', '✓', '正确'];
  var falseSet = ['false', '错', '否', 'no', 'n', 'f', '0', 'false', '✗', '错误'];
  var parsed = trueSet.indexOf(val) !== -1 ? true : (falseSet.indexOf(val) !== -1 ? false : null);
  if (parsed === null) {
    errors.push(createError(ERROR_CODES.ANSWER_TYPE_MISMATCH, 'answer.value', '判断题答案格式非法: ' + val, SEVERITY.ERROR));
    return { match: false, errors: errors, warnings: [] };
  }
  var match = parsed === expected;
  if (!match) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '判断题答案错误：期望 ' + (expected ? '对' : '错') + '，实际 ' + val, SEVERITY.ERROR));
  }
  return { match: match, errors: errors, warnings: [] };
}

/**
 * 验证填空/文本答案（宽松匹配，去空格、大小写不敏感）
 * @param {Object} answerObj
 * @param {string|string[]} expected
 * @returns {Object}
 */
function validateTextAnswer(answerObj, expected) {
  var errors = [];
  var val = coerceString(answerObj.value).toLowerCase().trim();
  var acceptable = Array.isArray(answerObj.acceptable) ? answerObj.acceptable.map(function (a) { return coerceString(a).toLowerCase().trim(); }) : [];
  var candidates = [val].concat(acceptable).filter(function (v) { return v !== ''; });
  var expList = Array.isArray(expected) ? expected : [expected];
  var expNorm = expList.map(function (e) { return coerceString(e).toLowerCase().trim(); });

  var match = candidates.some(function (c) { return expNorm.indexOf(c) !== -1; });
  if (!match) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '文本答案不匹配：期望 ' + expNorm.join('/') + '，实际 ' + candidates.join('/'), SEVERITY.ERROR));
  }
  return { match: match, errors: errors, warnings: [] };
}

/**
 * 主验证入口
 * @param {Object} sq SemanticQuestion
 * @returns {Object} { valid, errors, warnings, info, score, checks }
 */
function validateAnswer(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  if (!sq.answer || typeof sq.answer !== 'object') {
    errors.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer', '缺少 answer 对象', SEVERITY.ERROR));
    return { valid: false, errors: errors, warnings: warnings, info: info, score: 0, checks: { answer: 'fail' } };
  }

  var prompt = sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || '';
  var qType = sq.questionType || sq.type || 'calc';
  var answerObj = sq.answer;

  // 根据题型分派验证逻辑
  if (qType === 'choice' && sq.distractors) {
    var options = sq.distractors.map(function (d) { return d.value; });
    if (answerObj.value != null) options.push(coerceString(answerObj.value));
    var optUniq = options.filter(function (v, i, a) { return a.indexOf(v) === i; });
    var res = validateChoiceAnswer(answerObj, optUniq);
    errors.push.apply(errors, res.errors);
    warnings.push.apply(warnings, res.warnings);
  } else if (qType === 'judge' || qType === 'true-false') {
    // 判断题需知期望值（此处无法自动推断，仅做格式校验）
    var res2 = validateJudgeAnswer(answerObj, true); // 默认期望 true，实际应从题干推断
    warnings.push({ code: 'JUDGE_ANSWER_UNVERIFIED', field: 'answer', message: '判断题正确性需人工/规则核对', severity: 'INFO' });
  } else if (qType === 'fill' || qType === 'calc') {
    // 计算/填空：尝试从题干自动计算期望答案
    var expected = computeExpectedAnswer(prompt);
    if (expected) {
      var res3 = validateNumericAnswer(answerObj, expected);
      errors.push.apply(errors, res3.errors);
      warnings.push.apply(warnings, res3.warnings);
    } else {
      // 无法自动计算，仅做非空校验
      if (answerObj.value == null && (!answerObj.acceptable || answerObj.acceptable.length === 0)) {
        errors.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '答案为空且无法自动校验', SEVERITY.ERROR));
      } else {
        info.push({ code: 'ANSWER_UNVERIFIED', field: 'answer', message: '题目类型 ' + qType + ' 无法自动验证，需人工核对', severity: 'INFO' });
      }
    }
  } else {
    // 其他类型（apply, open, operate 等）仅做非空
    if (answerObj.value == null && (!answerObj.acceptable || answerObj.acceptable.length === 0)) {
      warnings.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '题型 ' + qType + ' 答案为空', SEVERITY.WARNING));
    }
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0.5, checks: { answer: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateAnswer: validateAnswer,
  computeExpectedAnswer: computeExpectedAnswer,
  validateNumericAnswer: validateNumericAnswer,
  validateChoiceAnswer: validateChoiceAnswer,
  validateJudgeAnswer: validateJudgeAnswer,
  validateTextAnswer: validateTextAnswer
};