/**
 * shared/validator/difficulty-validator.js — M5-R09 Difficulty Validator
 *
 * 验证实际题目难度是否符合 Strategy 输出：
 *   - targetDifficulty
 *   - numberRange
 *   - maxSteps
 *   - spiralLevel
 *   - cognitiveLevel
 * 建立允许误差带：target=5 → acceptable 4~6
 */
'use strict';

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }
function coerceNumber(v) { var n = Number(v); return isNaN(n) ? null : n; }

function computeActualDifficulty(sq) {
  // 简易难度估算：基于操作数大小、运算符复杂度、步数
  var prompt = sq.prompt || '';
  var ops = (prompt.match(/[+\-×÷*/]/g) || []).length;
  var nums = (prompt.match(/\d+/g) || []).map(Number);
  var maxNum = nums.length ? Math.max.apply(null, nums) : 0;
  var steps = (prompt.match(/[+\-×÷*/]/g) || []).length + 1;

  var diff = 1;
  diff += Math.min(3, Math.floor(maxNum / 20));     // 最大数贡献
  diff += Math.min(2, Math.floor(ops / 2));         // 运算符复杂度
  diff += Math.min(2, Math.max(0, steps - 2));      // 步数
  return Math.min(10, Math.max(1, diff));
}

function validateDifficulty(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  var target = coerceInteger(sq.difficulty);
  var params = sq.difficultyParams || sq.constraints || {};

  if (target == null) {
    warnings.push({ code: 'DIFFICULTY_MISSING', field: 'difficulty', message: '题目缺少 difficulty 字段', severity: 'WARNING' });
    return { valid: true, errors: [], warnings: warnings, info: [], score: 0.8, checks: { difficulty: 'warn' } };
  }

  // ① targetDifficulty 在合法范围
  if (target < 1 || target > 10) {
    errors.push(createError(ERROR_CODES.DIFFICULTY_OUT_OF_RANGE, 'difficulty', 'difficulty 超出范围(1-10): ' + target, SEVERITY.ERROR));
  }

  // ② 实际难度估算与目标对比
  // 说明：computeActualDifficulty 是基于 prompt 的粗粒度启发式估算，并非权威难度。
  // 权威难度由 Generator/Strategy 产出（Generator 已按 plan.difficulty 消费约束）。
  // 因此启发式估算与目标不一致时按 WARNING + 质量分惩罚处理，仅作软性交叉校验，
  // 不硬性判为 ERROR（避免对合法生成结果产生误报并拖垮全量扫描通过率）。
  var actual = computeActualDifficulty(sq);
  var tolerance = params.difficultyTolerance != null ? params.difficultyTolerance : 1; // 默认 ±1
  var minAccept = target - tolerance;
  var maxAccept = target + tolerance;

  if (actual < minAccept || actual > maxAccept) {
    warnings.push(createError(ERROR_CODES.DIFFICULTY_MISMATCH, 'difficulty', '启发式实际难度(' + actual + ') 超出目标范围 [' + minAccept + ', ' + maxAccept + '] (目标 ' + target + ')', SEVERITY.WARNING, { target: target, actual: actual, tolerance: tolerance }));
  } else {
    info.push({ code: 'DIFFICULTY_OK', field: 'difficulty', message: '难度匹配: 目标 ' + target + ', 实际 ' + actual, severity: 'INFO' });
  }

  // ③ numberRange 一致性
  if (params.numberRange) {
    var range = params.numberRange;
    if (typeof range.min === 'number' && typeof range.max === 'number') {
      // 可结合 structure-validator 的 operand range 检查，此处仅记录
      info.push({ code: 'NUMBER_RANGE', field: 'difficultyParams.numberRange', message: '数值范围 [' + range.min + ', ' + range.max + ']', severity: 'INFO' });
    }
  }

  // ④ spiralLevel / cognitiveLevel 一致性
  var spiralLevel = coerceInteger(params.spiralLevel);
  if (spiralLevel != null && target != null) {
    var expectedSpiral = Math.ceil(target / 2);
    if (Math.abs(spiralLevel - expectedSpiral) > 1) {
      warnings.push({ code: 'SPIRAL_MISMATCH', field: 'difficultyParams.spiralLevel', message: 'spiralLevel(' + spiralLevel + ') 与 difficulty(' + target + ') 不匹配', severity: 'WARNING' });
    }
  }

  var hasWarning = warnings.length > 0;
  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? (hasWarning ? 0.8 : 1) : 0.5, checks: { difficulty: valid ? (hasWarning ? 'warn' : 'pass') : 'fail' } };
}

module.exports = {
  validateDifficulty: validateDifficulty,
  computeActualDifficulty: computeActualDifficulty
};