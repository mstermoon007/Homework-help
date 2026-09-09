'use strict';

/**
 * shared/validator/difficulty-integrity-validator.js — M8-R03 Difficulty Integrity Validator
 *
 * 验证题目难度与策略输出、结构约束、数值范围的完整一致性：
 *   - effectiveDifficulty 与 constraints.difficulty 一致
 *   - numberRange 与 difficultyTier/level 一致
 *   - maxSteps/allowBracket/allowMultDiv 与 difficultyToStructure 严格对应
 *   - spiralLevel/cognitiveLevel 与 difficulty 期望区间一致
 */

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

var Difficulty = require('../catalog/difficulty.js');

function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }

function validateDifficultyIntegrity(sq, context) {
  context = context || {};
  var errors = [];
  var warnings = [];
  var info = [];

  var targetDifficulty = coerceInteger(sq.difficulty);
  var params = sq.difficultyParams || sq.constraints || {};
  var structure = params; // constraints 结构

  if (targetDifficulty == null) {
    // 缺少 difficulty 时在 difficulty-validator 中已处理，这里不重复报错
    return { valid: true, errors: [], warnings: [], info: [], score: 0.8, checks: { difficultyIntegrity: 'skipped' } };
  }

  // 1) difficulty 值与 constraints.difficulty 一致（若存在）
  if (params.difficulty != null) {
    var cDiff = coerceInteger(params.difficulty);
    if (cDiff !== targetDifficulty) {
      errors.push(createError(ERROR_CODES.DIFFICULTY_INTEGRITY_VIOLATION, 'difficulty', 'difficulty(' + targetDifficulty + ') 与 constraints.difficulty(' + cDiff + ') 不一致', SEVERITY.ERROR, { target: targetDifficulty, constraint: cDiff }));
    }
  }

  // 2) numberRange 与 difficultyToStructure 期望范围一致
  var diffStruct = Difficulty.difficultyToStructure(targetDifficulty);
  var maxOperand = Difficulty.paramsFor('math', targetDifficulty).maxOperand || Difficulty.DifficultyProfiles?.math?.toParams?.(targetDifficulty)?.maxOperand;

  if (params.numberRange) {
    var range = params.numberRange;
    if (typeof range.max === 'number') {
      var expectedMax = maxOperand || diffStruct.maxOperand;
      if (expectedMax && Math.abs(range.max - expectedMax) > Math.max(2, expectedMax * 0.1)) {
        warnings.push({ code: 'DIFFICULTY_NUMBER_RANGE_DRIFT', field: 'difficultyParams.numberRange', message: '数值范围 max(' + range.max + ') 偏离 difficulty(' + targetDifficulty + ') 期望 ' + expectedMax, severity: 'WARNING', detail: { range: range, expectedMax: expectedMax } });
      }
    }
  }

  // 3) 结构约束严格对应 difficultyToStructure
  if (params.maxSteps != null) {
    var cSteps = coerceInteger(params.maxSteps);
    if (cSteps !== diffStruct.steps) {
      errors.push(createError(ERROR_CODES.DIFFICULTY_STRUCTURE_DRIFT, 'difficultyParams.maxSteps', 'maxSteps(' + cSteps + ') 不匹配 difficulty(' + targetDifficulty + ') 标准 ' + diffStruct.steps, SEVERITY.ERROR, { actual: cSteps, expected: diffStruct.steps, difficulty: targetDifficulty }));
    }
  }
  if (params.allowBracket != null) {
    var cBracket = !!params.allowBracket;
    if (cBracket !== diffStruct.allowBracket) {
      errors.push(createError(ERROR_CODES.DIFFICULTY_CONSTRAINT_MISMATCH, 'difficultyParams.allowBracket', 'allowBracket(' + cBracket + ') 不匹配 difficulty(' + targetDifficulty + ') 标准 ' + diffStruct.allowBracket, SEVERITY.ERROR, { actual: cBracket, expected: diffStruct.allowBracket, difficulty: targetDifficulty }));
    }
  }
  if (params.allowMultDiv != null) {
    var cMultDiv = !!params.allowMultDiv;
    if (cMultDiv !== diffStruct.allowMultDiv) {
      errors.push(createError(ERROR_CODES.DIFFICULTY_CONSTRAINT_MISMATCH, 'difficultyParams.allowMultDiv', 'allowMultDiv(' + cMultDiv + ') 不匹配 difficulty(' + targetDifficulty + ') 标准 ' + diffStruct.allowMultDiv, SEVERITY.ERROR, { actual: cMultDiv, expected: diffStruct.allowMultDiv, difficulty: targetDifficulty }));
    }
  }

  // 4) spiralLevel 与 difficulty 期望区间一致
  var spiralLevel = coerceInteger(params.spiralLevel);
  if (spiralLevel != null) {
    var expectedSpiral = Math.ceil(targetDifficulty / 2);
    if (Math.abs(spiralLevel - expectedSpiral) > 1) {
      errors.push(createError(ERROR_CODES.DIFFICULTY_INTEGRITY_VIOLATION, 'difficultyParams.spiralLevel', 'spiralLevel(' + spiralLevel + ') 与 difficulty(' + targetDifficulty + ') 期望 ' + expectedSpiral + ' ±1 不符', SEVERITY.ERROR, { spiralLevel: spiralLevel, difficulty: targetDifficulty, expected: expectedSpiral }));
    }
  }

  // 5) cognitiveLevel 与 difficulty 期望映射
  var cognitiveLevel = (sq.cognitiveLevel || sq.constraints?.cognitiveLevel || '').toLowerCase();
  if (cognitiveLevel) {
    var diffCogExpect = targetDifficulty <= 3 ? 'recognize' : targetDifficulty <= 7 ? 'understand' : 'apply';
    if (cognitiveLevel !== diffCogExpect) {
      warnings.push({ code: 'DIFFICULTY_COGNITIVE_DRIFT', field: 'cognitiveLevel', message: 'cognitiveLevel(' + cognitiveLevel + ') 偏离 difficulty(' + targetDifficulty + ') 期望 ' + diffCogExpect, severity: 'WARNING', detail: { cognitiveLevel: cognitiveLevel, difficulty: targetDifficulty, expected: diffCogExpect } });
    }
  }

  // 6) contextType 与 difficulty 期望映射
  var contextType = sq.contextType || params.contextType || sq.content?.context;
  if (contextType) {
    var diffCtxExpect = targetDifficulty <= 3 ? ['pure', 'simple'] : targetDifficulty <= 6 ? ['simple', 'standard'] : ['standard', 'complex'];
    if (diffCtxExpect.indexOf(contextType) === -1) {
      warnings.push({ code: 'DIFFICULTY_CONTEXT_DRIFT', field: 'contextType', message: 'contextType(' + contextType + ') 不在 difficulty(' + targetDifficulty + ') 期望 ' + diffCtxExpect.join(','), severity: 'WARNING', detail: { contextType: contextType, difficulty: targetDifficulty, expected: diffCtxExpect } });
    }
  }

  var valid = errors.length === 0;
  var hasWarning = warnings.length > 0;

  return {
    valid: valid,
    errors: errors,
    warnings: warnings,
    info: info,
    score: valid ? (hasWarning ? 0.8 : 1) : 0.5,
    checks: { difficultyIntegrity: valid ? (hasWarning ? 'warn' : 'pass') : 'fail' }
  };
}

function validateBatchDifficultyIntegrity(questions, context) {
  // 批次级：统计难度分布、一致性通过率
  var errors = [];
  var warnings = [];
  var info = [];

  var diffDist = {};
  var consistent = 0;
  var total = 0;
  questions.forEach(function (sq) {
    var d = coerceInteger(sq.difficulty);
    if (d != null) {
      diffDist[d] = (diffDist[d] || 0) + 1;
      total++;
      // 简单检查：steps/bracket/multDiv 与 difficultyToStructure
      var diffStruct = Difficulty.difficultyToStructure(d);
      var params = sq.difficultyParams || sq.constraints || {};
      var ok = (!params.maxSteps || coerceInteger(params.maxSteps) === diffStruct.steps) &&
               (params.allowBracket == null || !!params.allowBracket === diffStruct.allowBracket) &&
               (params.allowMultDiv == null || !!params.allowMultDiv === diffStruct.allowMultDiv);
      if (ok) consistent++;
    }
  });

  info.push({ code: 'DIFFICULTY_DISTRIBUTION', field: 'batch', message: '难度分布: ' + JSON.stringify(diffDist), severity: 'INFO' });
  if (total > 0) {
    info.push({ code: 'DIFFICULTY_CONSISTENCY_RATE', field: 'batch', message: '结构一致性通过率: ' + Math.round(consistent / total * 100) + '%', severity: 'INFO' });
  }

  return { valid: true, errors: errors, warnings: warnings, info: info, score: 1, checks: { difficultyIntegrity: 'pass' } };
}

module.exports = {
  validateDifficultyIntegrity: validateDifficultyIntegrity,
  validateBatchDifficultyIntegrity: validateBatchDifficultyIntegrity
};