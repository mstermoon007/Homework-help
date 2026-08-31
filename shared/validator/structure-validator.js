/**
 * shared/validator/structure-validator.js — M5-R08 Structure Validator
 *
 * 验证题目结构约束（对应 Plan/Strategy 输出的约束）：
 *   - steps
 *   - brackets
 *   - operations
 *   - maxSteps
 *   - 运算符组合
 *   - 操作数数量
 *   - 操作数范围
 *   - 结构层级
 */
'use strict';

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }
function coerceString(v) { return v == null ? '' : String(v); }

function countOperators(expr) {
  var ops = coerceString(expr).match(/[+\-*/]/g);
  return ops ? ops.length : 0;
}

function countBrackets(expr) {
  var s = coerceString(expr);
  var open = (s.match(/\(/g) || []).length;
  var close = (s.match(/\)/g) || []).length;
  return { open: open, close: close, balanced: open === close };
}

function extractOperands(expr) {
  // 简单提取数字作为操作数
  var nums = coerceString(expr).match(/\d+/g);
  return nums ? nums.map(Number) : [];
}

function validateStructure(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  var prompt = sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || '';
  var constraints = sq.difficultyParams || sq.constraints || {};

  // ① maxSteps
  var maxSteps = coerceInteger(constraints.maxSteps);
  if (maxSteps != null && maxSteps > 0) {
    var actualSteps = countOperators(prompt) + 1; // 简单估算：运算符数+1
    if (actualSteps > maxSteps) {
      errors.push(createError(ERROR_CODES.STEPS_EXCEED, 'structure.steps', '实际步数(' + actualSteps + ') 超过最大步数(' + maxSteps + ')', SEVERITY.ERROR, { actual: actualSteps, max: maxSteps }));
    }
  }

  // ② brackets
  var allowBracket = constraints.allowBracket;
  var brackets = countBrackets(prompt);
  if (allowBracket === false && (brackets.open > 0 || brackets.close > 0)) {
    errors.push(createError(ERROR_CODES.BRACKETS_VIOLATION, 'structure.brackets', '禁止括号但题目包含括号', SEVERITY.ERROR, brackets));
  }
  if (!brackets.balanced) {
    errors.push(createError(ERROR_CODES.BRACKETS_VIOLATION, 'structure.brackets', '括号不匹配', SEVERITY.ERROR, brackets));
  }

  // ③ operations
  var allowMultDiv = constraints.allowMultDiv;
  var opsInPrompt = coerceString(prompt).match(/[+\-×÷*/]/g) || [];
  var hasMultDiv = opsInPrompt.some(function (op) { return ['*', '/', '×', '÷'].indexOf(op) !== -1; });
  if (allowMultDiv === false && hasMultDiv) {
    errors.push(createError(ERROR_CODES.OPERATIONS_VIOLATION, 'structure.operations', '禁止乘除但题目包含乘除', SEVERITY.ERROR, { ops: opsInPrompt }));
  }

  // ④ operand count
  var operands = extractOperands(prompt);
  var maxOperands = coerceInteger(constraints.maxOperands);
  if (maxOperands && operands.length > maxOperands) {
    errors.push(createError(ERROR_CODES.OPERAND_COUNT_INVALID, 'structure.operands', '操作数数量(' + operands.length + ') 超过上限(' + maxOperands + ')', SEVERITY.ERROR, { operands: operands }));
  }

  // ⑤ operand range
  var numberRange = constraints.numberRange || (sq.numberRange && { min: sq.numberRange.min, max: sq.numberRange.max });
  if (numberRange && typeof numberRange.min === 'number' && typeof numberRange.max === 'number') {
    operands.forEach(function (op, i) {
      if (op < numberRange.min || op > numberRange.max) {
        errors.push(createError(ERROR_CODES.OPERAND_RANGE_INVALID, 'structure.operands[' + i + ']', '操作数 ' + op + ' 超出范围 [' + numberRange.min + ', ' + numberRange.max + ']', SEVERITY.ERROR, { operand: op, range: numberRange }));
      }
    });
  }

  // ⑥ structure level (nesting depth)
  var maxDepth = coerceInteger(constraints.maxDepth);
  if (maxDepth != null) {
    var depth = 0, maxD = 0;
    for (var i = 0; i < prompt.length; i++) {
      if (prompt[i] === '(') { depth++; if (depth > maxD) maxD = depth; }
      else if (prompt[i] === ')') depth--;
    }
    if (maxD > maxDepth) {
      errors.push(createError(ERROR_CODES.STRUCTURE_INVALID, 'structure.depth', '嵌套深度(' + maxD + ') 超过上限(' + maxDepth + ')', SEVERITY.ERROR, { depth: maxD }));
    }
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: [], info: [], score: valid ? 1 : 0, checks: { structure: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateStructure: validateStructure
};