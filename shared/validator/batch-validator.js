/**
 * shared/validator/batch-validator.js — M5-R15 Batch Question Validator
 *
 * 整套练习级验证：
 *   - 总数量
 *   - 知识点覆盖
 *   - 题型比例
 *   - 难度分布
 *   - 重复率
 *   - 答案完整率
 *   - 图形完整率
 *   - 题型分布是否符合 QuestionPlan
 */
'use strict';

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }
function coerceString(v) { return v == null ? '' : String(v); }

function countBy(arr, keyFn) {
  var out = {};
  arr.forEach(function (x) { var k = keyFn(x); out[k] = (out[k] || 0) + 1; });
  return out;
}

function validateBatch(questions, plan) {
  var errors = [];
  var warnings = [];
  var info = [];

  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push(createError(ERROR_CODES.SCHEMA_INVALID, 'questions', '题目数组为空', SEVERITY.ERROR));
    return { valid: false, errors: errors, warnings: warnings, info: info, score: 0, checks: {} };
  }

  plan = plan || {};
  var total = questions.length;

  // ① 总数量
  var expectedCount = plan.count || total;
  if (total !== expectedCount) {
    warnings.push(createError('COUNT_MISMATCH', 'count', '实际题目数(' + total + ') 与计划(' + expectedCount + ') 不符', SEVERITY.WARNING, { actual: total, expected: expectedCount }));
  } else {
    info.push({ code: 'COUNT_OK', field: 'count', message: '题目数量达标: ' + total, severity: 'INFO' });
  }

  // ② 知识点覆盖
  var kpCounts = countBy(questions, function (q) { return q.knowledgePoint || 'unknown'; });
  var kpCovered = Object.keys(kpCounts).filter(function (k) { return k !== 'unknown'; }).length;
  var plannedKPs = plan.knowledgePoints || [];
  if (plannedKPs.length) {
    var missingKPs = plannedKPs.filter(function (kp) { return !kpCounts[kp]; });
    if (missingKPs.length) {
      errors.push(createError('KP_COVERAGE_INCOMPLETE', 'knowledgePoints', '缺失知识点覆盖: ' + missingKPs.join(', '), SEVERITY.ERROR, { missing: missingKPs, covered: Object.keys(kpCounts) }));
    }
  }
  info.push({ code: 'KP_COVERAGE', field: 'knowledgePoints', message: '覆盖知识点: ' + kpCovered + ' 个', severity: 'INFO' });

  // ③ 题型比例
  var typeCounts = countBy(questions, function (q) { return q.questionType || q.type || 'unknown'; });
  var plannedTypes = plan.questionTypes || {};
  Object.keys(plannedTypes).forEach(function (type) {
    var expected = plannedTypes[type];
    var actual = typeCounts[type] || 0;
    if (actual < expected) {
      warnings.push(createError('TYPE_RATIO_LOW', 'questionType.' + type, '题型 ' + type + ' 数量(' + actual + ') 少于计划(' + expected + ')', SEVERITY.WARNING, { type: type, actual: actual, expected: expected }));
    }
  });
  info.push({ code: 'TYPE_DIST', field: 'questionTypes', message: '题型分布: ' + JSON.stringify(typeCounts), severity: 'INFO' });

  // ④ 难度分布
  var diffCounts = countBy(questions, function (q) { return q.difficulty || 0; });
  var avgDiff = questions.reduce(function (s, q) { return s + (q.difficulty || 0); }, 0) / total;
  var targetDiff = plan.difficulty;
  if (targetDiff != null && Math.abs(avgDiff - targetDiff) > 1) {
    warnings.push(createError('DIFFICULTY_DIST_OFF', 'difficulty', '平均难度(' + avgDiff.toFixed(1) + ') 偏离目标(' + targetDiff + ')', SEVERITY.WARNING, { avg: avgDiff, target: targetDiff }));
  }
  info.push({ code: 'DIFF_DIST', field: 'difficulty', message: '难度分布: ' + JSON.stringify(diffCounts) + ', 平均: ' + avgDiff.toFixed(1), severity: 'INFO' });

  // ⑤ 重复率
  var keys = questions.map(function (q) { return require('./duplicate-validator.js').buildCanonicalKey(q); });
  var uniqueKeys = new Set(keys);
  var dupRate = (keys.length - uniqueKeys.size) / keys.length;
  if (dupRate > 0.1) {
    errors.push(createError('DUPLICATE_RATE_HIGH', 'duplicate', '重复率 ' + (dupRate * 100).toFixed(1) + '% 超过 10%', SEVERITY.ERROR, { rate: dupRate, total: keys.length, unique: uniqueKeys.size }));
  } else if (dupRate > 0) {
    warnings.push(createError('DUPLICATE_RATE_WARN', 'duplicate', '存在重复题目，重复率 ' + (dupRate * 100).toFixed(1) + '%', SEVERITY.WARNING, { rate: dupRate }));
  }
  info.push({ code: 'DUP_RATE', field: 'duplicate', message: '重复率: ' + (dupRate * 100).toFixed(1) + '%', severity: 'INFO' });

  // ⑥ 答案完整率
  var answered = questions.filter(function (q) { return q.answer && q.answer.value != null; }).length;
  var answerRate = answered / total;
  if (answerRate < 1) {
    errors.push(createError('ANSWER_INCOMPLETE', 'answer', '答案完整率 ' + (answerRate * 100).toFixed(1) + '% (< 100%)', SEVERITY.ERROR, { answered: answered, total: total }));
  }
  info.push({ code: 'ANSWER_RATE', field: 'answer', message: '答案完整率: ' + (answerRate * 100).toFixed(1) + '%', severity: 'INFO' });

  // ⑦ 图形完整率（有 graphic 的题目）
  var withGraphic = questions.filter(function (q) { return q.graphic && q.graphic.type; }).length;
  if (plan.graphicRequired && withGraphic < plan.graphicRequired) {
    warnings.push(createError('GRAPHIC_INSUFFICIENT', 'graphic', '含图形题目(' + withGraphic + ') 少于要求(' + plan.graphicRequired + ')', SEVERITY.WARNING));
  }
  info.push({ code: 'GRAPHIC_COUNT', field: 'graphic', message: '含图形题目: ' + withGraphic, severity: 'INFO' });

  // ⑧ 题型分布符合 QuestionPlan 细节
  if (plan.typeRatio) {
    Object.keys(plan.typeRatio).forEach(function (type) {
      var ratio = plan.typeRatio[type];
      var expected = Math.round(total * ratio);
      var actual = typeCounts[type] || 0;
      if (Math.abs(actual - expected) > Math.max(1, total * 0.1)) {
        warnings.push(createError('TYPE_RATIO_DEVIATION', 'questionType.' + type, '题型 ' + type + ' 比例偏离计划', SEVERITY.WARNING, { actual: actual, expected: expected, ratio: ratio }));
      }
    });
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0.5, checks: { batch: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateBatch: validateBatch
};