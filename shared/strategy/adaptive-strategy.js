/**
 * shared/strategy/adaptive-strategy.js — M6-R12..R18 / R22 自适应策略
 *
 * 输入：{ knowledgePoint, staticDifficulty, learnerState, difficulty, allowDifficultyOverride, adaptiveMode, legacyDelta }
 * 输出：{
 *   effectiveDifficulty, targetSpiralLevel, cognitiveLevel, variant, errorFocus,
 *   adjustment, mastery, confidence, recentAccuracy, mode, shadow?
 * }
 *
 * 规则：
 *   - R13 Effective Difficulty = Static/User Difficulty + Learner Adjustment，限幅 [-2,+2]
 *   - R14 mastery → 难度规则（叠加 confidence 防低样本误判）
 *   - R15 连续正确/连续错误保护（单次最多 ±1 级，连续强化有上限）
 *   - R16 mastery+confidence+recentAccuracy → spiralLevel
 *   - R17 errorPatterns → errorFocus（Generator 接收）
 *   - R18 变体选择（基础/数值/呈现/情境/结构/迁移）
 *   - R22 新旧自适应对照（legacy / new / shadow）
 */
'use strict';

var LearnerModel = require('../learner/learner-model.js');

var DIFF_MIN = 1, DIFF_MAX = 10;
var ADJ_MIN = -2, ADJ_MAX = 2;

var VARIANTS = ['基础', '数值', '呈现', '情境', '结构', '迁移'];

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function clampDiff(n) { return clamp(Math.round(n), DIFF_MIN, DIFF_MAX); }
function clampAdj(n) { return clamp(Math.round(n), ADJ_MIN, ADJ_MAX); }
function round3(n) { return Math.round(n * 1000) / 1000; }

function safeNumber(v, dflt) {
  var n = Number(v);
  return (typeof v === 'number' && isFinite(n)) ? n : dflt;
}

// ===== R14 mastery → 难度档位基准调整 =====
function masteryBandAdjustment(mastery) {
  if (mastery < 0.40) return -1;            // 低掌握：降低难度
  if (mastery < 0.70) return 0;             // 掌握中：保持/轻微调整
  if (mastery < 0.85) return 1;             // 较熟练：提高一级
  return 1;                                 // 高度熟练：提高难度（+额外 → 见下方强化）
}

// ===== R15 连续正确/连续错误保护 =====
function streakInfo(recentResults) {
  if (!Array.isArray(recentResults) || !recentResults.length) return { streak: 0, streakKind: 0 };
  var n = recentResults.length;
  var last = recentResults[n - 1];
  var len = 0;
  for (var i = n - 1; i >= 0; i--) {
    if (recentResults[i] !== last) break;
    len++;
  }
  return { streak: len, streakKind: last === 1 ? 1 : (last === 0 ? -1 : 0) };
}

function applyStreakProtection(adj, kpState) {
  var info = streakInfo(kpState && kpState.recentResults);
  var adj2 = adj;
  if (info.streakKind === -1 && info.streak >= 1) {
    // 最近连续错误：不允许上调难度（尊重 mastery 但防止“纸上熟练”冒进）
    adj2 = Math.min(adj2, 0);
  }
  if (info.streakKind === 1 && info.streak >= 2 && adj2 < 0) {
    // 最近连续正确且有回稳迹象：弱化单次下调的影响，但不过度乐观
    adj2 = Math.round(adj2 / 2);
  }
  return clampAdj(adj2);
}

// ===== R08 置信度门：低样本抑制调整 =====
function dampenByConfidence(adj, kpState) {
  var conf = safeNumber(kpState && kpState.confidence, 0);
  var attempts = safeNumber(kpState && kpState.attempts, 0);
  if (attempts <= 0) return 0;          // 从未作答：无证据，不动难度
  if (conf < 0.15) return Math.round(adj / 2);   // 置信度极低：折半调整（≤±1）
  if (attempts < 3) return clampAdj(roundStep(adj)); // 小样本：单步
  return adj;
}

function roundStep(adj) {
  // 小样本下只允许单步（-1/0/1）
  return clamp(adj, -1, 1);
}

// ===== R16 spiral =====
function spiralTarget(mastery, confidence, recentAccuracy) {
  var m = clamp(safeNumber(mastery, 0), 0, 1);
  var conf = clamp(safeNumber(confidence, 0), 0, 1);
  var ra = clamp(safeNumber(recentAccuracy, 0), 0, 1);
  var score = 0.5 * m + 0.25 * conf + 0.25 * ra;
  var level = 1;
  if (score < 0.4) level = 1;            // 低掌握 → S1
  else if (score < 0.6) level = 2;       // 基本掌握 → S2
  else if (score < 0.8) level = 3;       // 熟练 → S3
  else level = 4;                        // 高度熟练 → S4
  if (conf >= 0.7 && ra >= 0.85 && m >= 0.85) level = Math.max(level, 5); // 可尝试 S5/S6
  return clamp(level, 1, 6);
}

// ===== R18 变体选择 =====
function variantFor(mastery, confidence, errorFocus) {
  var m = clamp(safeNumber(mastery, 0), 0, 1);
  var conf = clamp(safeNumber(confidence, 0), 0, 1);
  // 有错因且 mastery 低 → 回到基础变体做巩固
  if (errorFocus && errorFocus.length && m < 0.7) return '基础';
  if (m < 0.4) return '基础';
  if (m < 0.7) return conf >= 0.5 ? '呈现' : '数值';
  if (m < 0.85) return conf >= 0.6 ? '结构' : '情境';
  return '迁移';
}

// ===== R17 错因聚焦 =====
function errorFocusFor(kpState, limit) {
  if (!kpState || !kpState.errorPatterns) return [];
  var list = [];
  Object.keys(kpState.errorPatterns).forEach(function (k) {
    var p = kpState.errorPatterns[k];
    if (!p || p.count <= 0) return;
    list.push(p);
  });
  list.sort(function (a, b) {
    var d = (b.recentCount || 0) - (a.recentCount || 0);
    if (d) return d;
    return (b.count || 0) - (a.count || 0);
  });
  var n = (typeof limit === 'number') ? limit : 2;
  return list.slice(0, n).map(function (p) { return p.errorType; });
}

function cognitiveFor(mastery) {
  var m = clamp(safeNumber(mastery, 0), 0, 1);
  if (m < 0.4) return 'recall';
  if (m < 0.7) return 'understand';
  if (m < 0.85) return 'apply';
  return 'analyze';
}

// ===== 主入口 =====
/**
 * @param {Object} opts {
 *   kpId, learnerState,            // 该知识点状态（KpState 或 null）
 *   staticDifficulty,              // 知识点固有难度
 *   difficulty,                    // 用户显式难度（可选）
 *   allowDifficultyOverride,       // 是否允许用户难度覆盖
 *   adaptiveMode,                  // 'legacy' | 'new' | 'shadow'
 *   legacyDelta,                   // 旧 currentDelta（供 legacy/shadow）
 *   maxSpiralLevel,
 *   cognitiveLevel                 // 引擎已选认知层级（可选，用于输出）
 * }
 */
function resolve(opts) {
  opts = opts || {};
  var kp = opts.learnerState && typeof opts.learnerState === 'object'
    ? LearnerModel.normalizeKpState(opts.learnerState, opts.kpId)
    : LearnerModel.defaultKpState(opts.kpId);

  var staticDiff = clampDiff(safeNumber(opts.staticDifficulty, 3));
  var userDiff = opts.difficulty != null ? clampDiff(safeNumber(opts.difficulty, staticDiff)) : null;
  var allowOverride = opts.allowDifficultyOverride !== false;
  var base = (allowOverride && userDiff != null) ? userDiff : staticDiff;

  var mastery = kp.mastery;
  var confidence = kp.confidence;
  var recentAccuracy = kp.recentAccuracy;
  var attempts = kp.attempts;
  var mode = opts.adaptiveMode === 'legacy' || opts.adaptiveMode === 'shadow' ? opts.adaptiveMode
    : (attempts > 0 ? 'new' : 'new'); // 无证据也走 new（adjustment=0），保证接管
  var legacyDelta = clampAdj(safeNumber(opts.legacyDelta, 0));

  // ---- 学习者调整量 ----
  var adj = 0;
  if (attempts > 0) {
    adj = masteryBandAdjustment(mastery);
    // 高掌握强化：≥0.85 且可信 → +2
    if (mastery >= 0.85 && confidence >= 0.7 && recentAccuracy >= 0.85) adj = 2;
    adj = dampenByConfidence(adj, kp);
    adj = applyStreakProtection(adj, kp);
  }
  adj = clampAdj(adj);

  var learnerEffective = clampDiff(base + adj);

  // ---- shadow / legacy 对照（R22）----
  var legacyEffective = clampDiff(base + legacyDelta);
  var shadow = null;
  if (mode === 'shadow') {
    shadow = {
      legacyDelta: legacyDelta,
      learnerAdjustment: adj,
      legacyEffective: legacyEffective,
      learnerEffective: learnerEffective
    };
  }

  var effectiveDifficulty = (mode === 'legacy' || mode === 'shadow') ? legacyEffective : learnerEffective;

  // ---- spiral / variant / errorFocus / cognitive ----
  var focus = errorFocusFor(kp, 2);
  var maxSpiral = clamp(safeNumber(opts.maxSpiralLevel, 6), 1, 6);
  var targetSpiral = spiralTarget(mastery, confidence, recentAccuracy);
  targetSpiral = Math.min(targetSpiral, maxSpiral);
  if (attempts === 0) targetSpiral = 1; // 无记录从最低螺旋开始

  var variant = variantFor(mastery, confidence, focus);

  return {
    effectiveDifficulty: effectiveDifficulty,
    targetSpiralLevel: targetSpiral,
    cognitiveLevel: cognitiveFor(mastery),
    variant: variant,
    errorFocus: focus,
    adjustment: adj,
    mastery: round3(mastery),
    confidence: round3(confidence),
    recentAccuracy: round3(recentAccuracy),
    attempts: attempts,
    mode: mode,
    baseDifficulty: base,
    shadow: shadow,
    recommendedDifficulty: learnerEffective,
    recommendedSpiralLevel: targetSpiral
  };
}

module.exports = {
  resolve: resolve,
  masteryBandAdjustment: masteryBandAdjustment,
  applyStreakProtection: applyStreakProtection,
  dampenByConfidence: dampenByConfidence,
  spiralTarget: spiralTarget,
  variantFor: variantFor,
  errorFocusFor: errorFocusFor,
  cognitiveFor: cognitiveFor,
  VARIANTS: VARIANTS,
  ADJ_MIN: ADJ_MIN,
  ADJ_MAX: ADJ_MAX
};