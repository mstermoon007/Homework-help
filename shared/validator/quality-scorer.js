/**
 * shared/validator/quality-scorer.js — M5-R18 Question Quality Score
 *
 * 统一质量评分：
 *   - correctness: 1 (答案正确性)
 *   - knowledgeAlignment: 1 (知识点对齐)
 *   - difficultyAlignment: 1 (难度对齐)
 *   - structuralValidity: 1 (结构合法性)
 *   - renderability: 1 (可渲染性)
 *   - uniqueness: 1 (唯一性/去重)
 *
 * 总分：加权平均，范围 [0, 1]
 * 用于：QA、统计、Generator 对比、后续自动优化
 */
'use strict';

var Validator = require('./question-validator.js');
var Schema = require('../schemas/semantic-question.schema.js');

var WEIGHTS = {
  correctness: 0.25,
  knowledgeAlignment: 0.20,
  difficultyAlignment: 0.15,
  structuralValidity: 0.15,
  renderability: 0.15,
  uniqueness: 0.10
};

function coerceNumber(v) { var n = Number(v); return isNaN(n) ? null : n; }
function coerceString(v) { return v == null ? '' : String(v); }

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

/**
 * 计算单题质量评分
 * @param {Object} sq SemanticQuestion
 * @param {Object} validationResult Pipeline.runPipeline 结果
 * @param {Object} context { seenKeys: Set, plan }
 * @returns {Object} { total, breakdown, details }
 */
function scoreQuestion(sq, validationResult, context) {
  var breakdown = {};
  var details = {};

  // ① Correctness (答案正确性)
  var corr = 0;
  if (validationResult && validationResult.checks && validationResult.checks.answer) {
    corr = validationResult.checks.answer === 'pass' ? 1 : 0;
  } else if (sq.answer && sq.answer.value != null) {
    corr = 0.8; // 有答案但未验证
  }
  breakdown.correctness = corr;

  // ② Knowledge Alignment (知识点对齐)
  var ka = 0;
  if (validationResult && validationResult.checks && validationResult.checks.knowledgePoint) {
    ka = validationResult.checks.knowledgePoint === 'pass' ? 1 : 0;
  } else if (sq.knowledgePoint) {
    ka = 0.8;
  }
  breakdown.knowledgeAlignment = ka;

  // ③ Difficulty Alignment (难度对齐)
  var da = 0;
  if (validationResult && validationResult.checks && validationResult.checks.difficulty) {
    da = validationResult.checks.difficulty === 'pass' ? 1 : 0;
  } else if (sq.difficulty != null) {
    da = 0.8;
  }
  breakdown.difficultyAlignment = da;

  // ④ Structural Validity (结构合法性)
  var sv = 0;
  if (validationResult && validationResult.checks && validationResult.checks.structure) {
    sv = validationResult.checks.structure === 'pass' ? 1 : 0;
  } else {
    sv = 0.8; // 默认假设结构合法
  }
  breakdown.structuralValidity = sv;

  // ⑤ Renderability (可渲染性)
  var rend = 0;
  if (validationResult && validationResult.checks && validationResult.checks.renderPreflight) {
    rend = validationResult.checks.renderPreflight === 'pass' ? 1 : 0;
  } else if (sq.prompt && sq.answerMode) {
    rend = 0.9;
  }
  breakdown.renderability = rend;

  // ⑥ Uniqueness (唯一性)
  var uniq = 0;
  if (validationResult && validationResult.checks && validationResult.checks.duplicate) {
    uniq = validationResult.checks.duplicate === 'pass' ? 1 : 0;
  } else if (context && context.seenKeys) {
    var key = require('./duplicate-validator.js').buildCanonicalKey(sq);
    uniq = context.seenKeys.has(key) ? 0 : 1;
  } else {
    uniq = 1; // 默认唯一
  }
  breakdown.uniqueness = uniq;

  // 加权总分
  var total = 0;
  Object.keys(WEIGHTS).forEach(function (k) {
    total += (breakdown[k] || 0) * WEIGHTS[k];
  });
  total = clamp(total, 0, 1);

  return {
    total: Number(total.toFixed(3)),
    breakdown: breakdown,
    weights: WEIGHTS,
    details: details
  };
}

/**
 * 批量评分
 * @param {Array<Object>} questions
 * @param {Array<Object>} validationResults
 * @param {Object} context
 * @returns {Array<Object>} 每题评分 + 汇总统计
 */
function scoreBatch(questions, validationResults, context) {
  context = context || {};
  var seenKeys = context.seenKeys || new Set();

  var scored = questions.map(function (sq, i) {
    var vr = validationResults && validationResults[i] ? validationResults[i] : null;
    var score = scoreQuestion(sq, vr, { seenKeys: seenKeys });
    // 更新 seenKeys
    if (sq) {
      var key = require('./duplicate-validator.js').buildCanonicalKey(sq);
      seenKeys.add(key);
    }
    return { questionId: sq.id, score: score };
  });

  // 汇总统计
  var totals = scored.map(function (s) { return s.score.total; });
  var avg = totals.length ? totals.reduce(function (a, b) { return a + b; }, 0) / totals.length : 0;
  var min = totals.length ? Math.min.apply(null, totals) : 0;
  var max = totals.length ? Math.max.apply(null, totals) : 0;

  // 分布
  var dist = { '0.9-1.0': 0, '0.7-0.9': 0, '0.5-0.7': 0, '<0.5': 0 };
  totals.forEach(function (t) {
    if (t >= 0.9) dist['0.9-1.0']++;
    else if (t >= 0.7) dist['0.7-0.9']++;
    else if (t >= 0.5) dist['0.5-0.7']++;
    else dist['<0.5']++;
  });

  return {
    items: scored,
    summary: {
      count: scored.length,
      average: Number(avg.toFixed(3)),
      min: Number(min.toFixed(3)),
      max: Number(max.toFixed(3)),
      distribution: dist
    }
  };
}

/**
 * Generator 级质量画像（用于 Generator 对比/优化）
 * @param {Array<Object>} scoredItems
 * @returns {Object}
 */
function generatorProfile(scoredItems) {
  if (!scoredItems.length) return { avgScore: 0, byDimension: {} };

  var dims = Object.keys(WEIGHTS);
  var byDim = {};
  dims.forEach(function (d) {
    var vals = scoredItems.map(function (s) { return s.score.breakdown[d]; });
    var sum = vals.reduce(function (a, b) { return a + b; }, 0);
    byDim[d] = { avg: Number((sum / vals.length).toFixed(3)), min: Math.min.apply(null, vals), max: Math.max.apply(null, vals) };
  });

  var avg = scoredItems.reduce(function (a, b) { return a + b.score.total; }, 0) / scoredItems.length;

  return {
    avgScore: Number(avg.toFixed(3)),
    byDimension: byDim,
    totalItems: scoredItems.length
  };
}

module.exports = {
  scoreQuestion: scoreQuestion,
  scoreBatch: scoreBatch,
  generatorProfile: generatorProfile,
  WEIGHTS: WEIGHTS
};