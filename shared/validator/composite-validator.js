'use strict';

/**
 * shared/validator/composite-validator.js — M8-R02 Composite Integrity Validator
 *
 * 验证复合/复杂题目（multi-step, mixed-ops, bracket, inverse）的结构完整性：
 *   - 步数与 plan/constraints 一致
 *   - 运算符集合与 KP/plan 要求一致
 *   - 括号/逆运算/混合运算标志位与语义匹配
 */

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }

function validateComposite(sq, context) {
  context = context || {};
  var errors = [];
  var warnings = [];
  var info = [];

  var params = sq.difficultyParams || sq.constraints || {};
  var data = sq.data || {};
  var plan = context.plan || {};

  // 1) 步数一致性
  var expectedSteps = coerceInteger(params.exactSteps || params.maxSteps || data.steps);
  var actualSteps = coerceInteger(data.steps);
  if (expectedSteps != null && actualSteps != null && expectedSteps !== actualSteps) {
    errors.push(createError(ERROR_CODES.COMPOSITE_STEPS_MISMATCH, 'data.steps', '步数不匹配: 期望 ' + expectedSteps + ', 实际 ' + actualSteps, SEVERITY.ERROR, { expected: expectedSteps, actual: actualSteps }));
  }

  // 2) 运算符集合一致性
  var expectedOps = params.operation || data.operators || [];
  if (!Array.isArray(expectedOps) && typeof expectedOps === 'string') expectedOps = [expectedOps];
  var actualOps = data.operators || [];
  if (!Array.isArray(actualOps) && typeof actualOps === 'string') actualOps = [actualOps];
  if (expectedOps.length && actualOps.length) {
    var expectedSet = new Set(expectedOps.map(String).map(function (s) { return s.toLowerCase(); }));
    var actualSet = new Set(actualOps.map(String).map(function (s) { return s.toLowerCase(); }));
    var missing = Array.from(expectedSet).filter(function (o) { return !actualSet.has(o); });
    var extra = Array.from(actualSet).filter(function (o) { return !expectedSet.has(o); });
    if (missing.length) {
      errors.push(createError(ERROR_CODES.COMPOSITE_OPERATOR_MISMATCH, 'data.operators', '缺少要求的运算符: ' + missing.join(','), SEVERITY.ERROR, { expected: Array.from(expectedSet), actual: Array.from(actualSet), missing: missing }));
    }
    if (extra.length) {
      warnings.push({ code: 'COMPOSITE_EXTRA_OPERATOR', field: 'data.operators', message: '包含额外运算符: ' + extra.join(','), severity: 'WARNING', detail: { expected: Array.from(expectedSet), actual: Array.from(actualSet), extra: extra } });
    }
  }

  // 3) 括号一致性
  var expectedBracket = params.allowBracket === true || data.allowBracket === true;
  var hasBracket = data.hasBracket === true || /[()（）]/.test(sq.prompt || '');
  if (expectedBracket && !hasBracket) {
    warnings.push({ code: 'COMPOSITE_BRACKET_MISSING', field: 'structure', message: '要求括号但题干未含括号', severity: 'WARNING', detail: { expectedBracket: expectedBracket, hasBracket: hasBracket } });
  } else if (!expectedBracket && hasBracket) {
    warnings.push({ code: 'COMPOSITE_BRACKET_UNEXPECTED', field: 'structure', message: '未要求括号但题干含括号', severity: 'WARNING', detail: { expectedBracket: expectedBracket, hasBracket: hasBracket } });
  }

  // 4) 逆运算/填空模式一致性
  if (data.mode === 'inverse' || data.inverse === true) {
    var inverseOps = actualOps.filter(function (o) { return ['inverse', 'reverse', 'unknown', '求被加数', '求减数', '求乘数', '求除数'].indexOf(String(o).toLowerCase()) !== -1; });
    if (inverseOps.length === 0 && actualOps.length > 0) {
      // 启发式：逆运算题目通常包含运算符但提问方式为求运算数
      info.push({ code: 'COMPOSITE_INVERSE_MODE', field: 'data.mode', message: '检测到逆运算模式', severity: 'INFO', detail: { mode: data.mode, inverse: data.inverse } });
    }
  }

  // 5) 结构族一致性
  var expectedFamily = params.structure && params.structure.family;
  if (expectedFamily) {
    var actualFamily = data.structure && data.structure.family;
    if (actualFamily && expectedFamily !== actualFamily) {
      errors.push(createError(ERROR_CODES.COMPOSITE_STRUCTURE_MISMATCH, 'data.structure.family', '结构族不匹配: 期望 ' + expectedFamily + ', 实际 ' + actualFamily, SEVERITY.ERROR, { expected: expectedFamily, actual: actualFamily }));
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
    checks: { composite: valid ? (hasWarning ? 'warn' : 'pass') : 'fail' }
  };
}

/**
 * 批次级复合题验证（统计复合题占比、类型分布）
 */
function validateBatchComposite(questions, context) {
  var errors = [];
  var warnings = [];
  var info = [];

  var compositeTypes = {};
  questions.forEach(function (sq) {
    var data = sq.data || {};
    var type = data.mode || (data.structure && data.structure.family) || 'simple';
    compositeTypes[type] = (compositeTypes[type] || 0) + 1;
  });

  info.push({ code: 'COMPOSITE_DISTRIBUTION', field: 'batch', message: '复合题类型分布: ' + JSON.stringify(compositeTypes), severity: 'INFO' });

  return { valid: true, errors: errors, warnings: warnings, info: info, score: 1, checks: { composite: 'pass' } };
}

/**
 * P40 T-10：跨族组合前置校验——composite 组合多个 KP 时，凡跨族（familyId 不同）的 KP 对，
 * 必须存在 prerequisite 边可达（一方是另一方的（间接）前置）；否则组合被拒（零新数据：
 * 复用既有 373 prerequisite 边 + T-06 跨族投影口径，经运行时公开口 relationsFor 只读消费）。
 * opts: { relationsFor(id,dir)->{outgoing,incoming}, familyOf(id)->familyId }
 * 无解析器时跳过（valid=true, skipped），保持生产既有行为不变。
 */
function validateCrossFamilyPrerequisite(kpIds, opts) {
  opts = opts || {};
  var relationsFor = opts.relationsFor, familyOf = opts.familyOf;
  if (typeof relationsFor !== 'function' || typeof familyOf !== 'function') {
    return { valid: true, checked: 0, missing: [], skipped: 'no-resolver' };
  }
  var ids = (kpIds || []).filter(function (x, i, a) { return typeof x === 'string' && a.indexOf(x) === i; });
  function fam(id) { var f = familyOf(id); return f && f.familyId ? f.familyId : f; }
  function reachable(a, b) {
    var seen = {}, q = [a];
    while (q.length) {
      var cur = q.shift();
      if (cur === b) return true;
      if (seen[cur]) continue; seen[cur] = 1;
      var out = relationsFor(cur, 'out') || {};
      (out.outgoing || []).forEach(function (r) { if (!seen[r.toId]) q.push(r.toId); });
    }
    return false;
  }
  var missing = [], seenPair = {};
  for (var i = 0; i < ids.length; i++) {
    for (var j = 0; j < ids.length; j++) {
      if (i === j) continue;
      var a = ids[i], b = ids[j];
      if (fam(a) === fam(b)) continue;
      var key = [a, b].sort().join('|');
      if (seenPair[key]) continue; seenPair[key] = 1;
      if (!reachable(a, b) && !reachable(b, a)) {
        missing.push({ a: a, b: b, aFamily: fam(a), bFamily: fam(b) });
      }
    }
  }
  return { valid: missing.length === 0, checked: ids.length, missing: missing };
}

module.exports = {
  validateComposite: validateComposite,
  validateBatchComposite: validateBatchComposite,
  validateCrossFamilyPrerequisite: validateCrossFamilyPrerequisite
};