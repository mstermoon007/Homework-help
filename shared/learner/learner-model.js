/**
 * shared/learner/learner-model.js — M6-R02 / R06 / R07 / R08 / R11 / R26
 *
 * Learner Model：知识点级掌握度模型。纯数据与规则，不触碰 Storage。
 *
 * 每个知识点维护：
 *   mastery            EMA 掌握度（R07）：mastery(t)=α×result+(1-α)×mastery(t-1)
 *   confidence         置信度（R08）：与 mastery 分离，随样本量与一致性增长
 *   attempts / correct / accuracy / recentAccuracy / recentResults（R06）
 *   errorPatterns      错因（R09，类型与计数由 ErrorModel 维护）
 *   exposureCount / lastPracticedAt
 *   recommendedDifficulty / recommendedSpiralLevel（默认推荐，权威值由 AdaptiveStrategy 覆盖）
 *
 * R11：Strategy 只能通过本 API 读取，禁止直接读 Storage。
 * R26：normalizeLearnerState() 统一容错（NaN/负数/>1 mastery/非法错因/旧版本数据）。
 */
(function (global) {
  'use strict';

  var ErrorModel = (typeof LearnerErrorModel !== 'undefined') ? LearnerErrorModel
    : (typeof require !== 'undefined' ? require('./error-model.js') : null);
  if (!ErrorModel) throw new Error('learner-model.js 依赖 error-model.js');

  var VERSION = 1;
  var DEFAULT_ALPHA = 0.3;      // EMA 平滑系数
  var RECENT_WINDOW = 10;       // recentAccuracy 采用的最近结果数
  var RECENT_RESULTS_CAP = 20;  // recentResults 保留上限
  var DIFF_MIN = 1, DIFF_MAX = 10;

  // ===== 字段默认值 =====
  function defaultKpState(kpId) {
    return {
      kpId: kpId || null,
      mastery: 0,
      confidence: 0,
      attempts: 0,
      correct: 0,
      accuracy: 0,
      recentAccuracy: 0,
      recentResults: [],
      errorPatterns: {},
      exposureCount: 0,
      lastPracticedAt: null,
      recommendedDifficulty: DIFF_MIN,
      recommendedSpiralLevel: 1,
      updatedAt: null
    };
  }

  // ===== 数值工具 =====
  function clamp01(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }
  function clampDiff(n) {
    if (typeof n !== 'number' || !isFinite(n)) return DIFF_MIN;
    return Math.min(DIFF_MAX, Math.max(DIFF_MIN, Math.round(n)));
  }
  function clampLevel(n, max) {
    if (typeof n !== 'number' || !isFinite(n)) return 1;
    return Math.min(max, Math.max(1, Math.round(n)));
  }
  function nonNegInt(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  // ===== R26 容错归一 =====
  function normalizeKpState(raw, kpId) {
    var d = defaultKpState(kpId);
    if (raw == null || typeof raw !== 'object') return d;
    d.mastery = clamp01(raw.mastery);
    d.confidence = clamp01(raw.confidence);
    d.attempts = nonNegInt(raw.attempts);
    d.correct = Math.min(nonNegInt(raw.correct), d.attempts); // 正确数不可能超过尝试数
    d.accuracy = clamp01(raw.accuracy != null ? raw.accuracy : (d.attempts ? d.correct / d.attempts : 0));
    d.exposureCount = nonNegInt(raw.exposureCount);
    d.recentResults = valuesAre01Array(raw.recentResults);
    d.recentAccuracy = clamp01(raw.recentAccuracy != null ? raw.recentAccuracy
      : (d.recentResults.length ? avg(d.recentResults) : d.accuracy));
    d.errorPatterns = ErrorModel.normalizePatterns(raw.errorPatterns);
    d.lastPracticedAt = isValidTs(raw.lastPracticedAt) ? raw.lastPracticedAt : null;
    d.updatedAt = isValidTs(raw.updatedAt) ? raw.updatedAt : null;
    d.recommendedDifficulty = clampDiff(raw.recommendedDifficulty == null ? DIFF_MIN : raw.recommendedDifficulty);
    d.recommendedSpiralLevel = clampLevel(raw.recommendedSpiralLevel == null ? 1 : raw.recommendedSpiralLevel, 6);
    // 旧数据/损坏数据缺失 mastery 字段时用准确率兜底（字段存在但越界时仍走 clamp，不触发兜底）
    if ((raw.mastery == null || typeof raw.mastery !== 'number' || !isFinite(raw.mastery)) && d.attempts) {
      d.mastery = recomputeMasteryFallback(d);
    }
    return d;
  }

  function recomputeMasteryFallback(s) {
    // 旧版本/损坏数据缺失 mastery 时的兜底（EMA 才是权威，仅当 attempts 存在且 mastery=0 时用）
    return s.attempts ? clamp01(s.correct / s.attempts) : 0;
  }

  function valuesAre01Array(v) {
    if (!Array.isArray(v)) return [];
    return v.map(function (x) {
      var n = Number(x);
      return (n === 0 || n === 1) ? n : 0;
    }).slice(-RECENT_RESULTS_CAP);
  }
  function avg(a) {
    if (!a.length) return 0;
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
  }
  function isValidTs(v) {
    return typeof v === 'number' && isFinite(v) && v > 0;
  }

  /**
   * 顶层状态归一（R26 统一入口）：处理字段缺失/NaN/负数/>1 mastery/非法错因/旧版本。
   * @param {Object} state
   * @returns {Object} { version, updatedAt, knowledgePoints: { [kpId]: KpState } }
   */
  function normalizeLearnerState(state) {
    var out = { version: VERSION, updatedAt: null, knowledgePoints: {} };
    if (state == null || typeof state !== 'object') return out;
    out.version = VERSION;
    out.updatedAt = isValidTs(state.updatedAt) ? state.updatedAt : null;
    var kps = (state && state.knowledgePoints != null && typeof state.knowledgePoints === 'object') ? state.knowledgePoints : {};
    if (state && state.mastery != null && typeof state === 'object' && state.kpId != null) {
      // 单知识点扁平状态 → 包装
      kps = {}; kps[String(state.kpId)] = state;
    }
    Object.keys(kps).forEach(function (kpId) {
      if (!kpId) return;
      out.knowledgePoints[kpId] = normalizeKpState(kps[kpId], kpId);
    });
    return out;
  }

  // ===== 存取 =====
  function get(state, kpId) {
    if (!kpId) return defaultKpState(null);
    state = normalizeLearnerState(state);
    if (!state.knowledgePoints[kpId]) return null; // 无记录 → null（区别于默认值，便于判断“是否学过”）
    return state.knowledgePoints[kpId];
  }

  function getOrInit(state, kpId) {
    var got = get(state, kpId);
    return got ? got : defaultKpState(kpId);
  }

  /** 更新（合并）单个知识点状态（R02 upsert）。 */
  function upsert(state, kpId, patch) {
    state = normalizeLearnerState(state);
    if (!kpId) return state;
    var cur = state.knowledgePoints[kpId] || defaultKpState(kpId);
    if (patch && typeof patch === 'object') {
      Object.keys(patch).forEach(function (k) {
        if (k === 'kpId' && patch[k] == null) return;
        if (patch[k] !== undefined) cur[k] = patch[k];
      });
    }
    cur.updatedAt = Date.now();
    // 一致化派生字段
    cur.accuracy = cur.attempts ? cur.correct / cur.attempts : 0;
    cur.recentAccuracy = cur.recentResults.length ? avg(cur.recentResults) : cur.accuracy;
    cur.kpId = kpId;
    cur = normalizeKpState(cur, kpId);
    state.knowledgePoints[kpId] = cur;
    state.updatedAt = cur.updatedAt;
    return state;
  }

  // ===== R07 EMA 掌握度 =====
  function computeMastery(kpState, result) {
    var prev = kpState ? clamp01(kpState.mastery) : 0;
    var res = result ? (result.correct === true ? 1 : 0) : 0;
    return clamp01(round3(DEFAULT_ALPHA * res + (1 - DEFAULT_ALPHA) * prev));
  }

  // ===== R08 置信度 =====
  function computeConfidence(kpState) {
    var s = kpState || defaultKpState(null);
    var rawN = s.attempts + (s.exposureCount || 0) * 0.5;
    if (rawN <= 0) return 0;
    var sizeFactor = 1 - Math.pow(0.75, rawN);           // 样本量增长（n=1.5→0.35, n=5→0.76, n=30→0.9998）
    var consistency = s.recentAccuracy != null ? clamp01(s.recentAccuracy)
      : (s.attempts ? s.correct / s.attempts : 0);
    var consistencyGain = 0.5 + 0.5 * consistency;
    return clamp01(round3(sizeFactor * consistencyGain * 0.9 + 0.1));
  }

  // ===== R06 KP 级准确率 =====
  function accuracyOf(s) { return s.attempts ? clamp01(s.correct / s.attempts) : 0; }
  function recentAccuracyOf(s, windowN) {
    var n = (typeof windowN === 'number' && windowN > 0) ? windowN : RECENT_WINDOW;
    var arr = (s.recentResults || []).slice(-n);
    return arr.length ? avg(arr) : accuracyOf(s);
  }

  // ===== 默认推荐（R14/R16 启发表；权威值由 AdaptiveStrategy 覆盖） =====
  function recommendDefaults(s, baseDifficulty) {
    var base = baseDifficulty == null ? DIFF_MIN : clampDiff(baseDifficulty);
    var m = clamp01(s.mastery);
    var adj = 0;
    if (m < 0.4) adj = -1;
    else if (m < 0.7) adj = 0;
    else if (m < 0.85) adj = 1;
    else adj = 2;
    // 低置信度削弱调整（R08 低样本防误判）
    var conf = clamp01(s.confidence);
    if (conf < 0.3) adj = Math.round(adj / 2);
    var spiral = m < 0.4 ? 1 : (m < 0.7 ? 2 : (m < 0.85 ? 3 : 4));
    if (conf < 0.3) spiral = Math.min(spiral, 2);
    return {
      recommendedDifficulty: clamp(base + adj, DIFF_MIN, DIFF_MAX),
      recommendedSpiralLevel: clampLevel(spiral, 6)
    };
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function round3(n) { return Math.round(n * 1000) / 1000; }

  // ===== R05/R11 核心更新入口 =====
  /**
   * @param {Object} state 顶层 LearnerModel 状态
   * @param {Object} result PracticeResult（必须含 knowledgePointId）
   * @param {Object} [opts] { alpha, baseDifficulty, now }
   * @returns {Object} 更新后的顶层状态
   */
  function update(state, result, opts) {
    opts = opts || {};
    if (!result || !result.knowledgePointId) {
      throw new Error('LearnerModel.update 需要含 knowledgePointId 的 PracticeResult');
    }
    state = normalizeLearnerState(state);
    var kpId = result.knowledgePointId;
    var kp = state.knowledgePoints[kpId] || defaultKpState(kpId);
    var ts = (typeof opts.now === 'number') ? opts.now : Date.now();
    var alpha = (typeof opts.alpha === 'number' && opts.alpha > 0 && opts.alpha <= 1) ? opts.alpha : DEFAULT_ALPHA;

    var isSkip = result.status === 'skipped';
    var isRedo = result.status === 'redo';

    // 答题结果归一：correct → 1，其余（wrong/unanswered）→ 0；跳过不进入掌握度
    var res = isSkip ? null : (result.correct === true ? 1 : 0);

    if (!isSkip) {
      kp.exposureCount += 1;
      if (!isRedo) {
        // 重做（纠正）：更新掌握度信号，但不重复计入 first-pass 正确率统计
        kp.attempts += 1;
        if (res === 1) kp.correct += 1;
      }
    } else {
      kp.exposureCount += 1;
    }

    // recentResults（跳过不记录，保持 0/1 语义）
    if (!isSkip) {
      kp.recentResults.push(res);
      if (kp.recentResults.length > RECENT_RESULTS_CAP) kp.recentResults = kp.recentResults.slice(-RECENT_RESULTS_CAP);
    }

    // MASTERY：EMA（跳过不更新）
    if (!isSkip) {
      var prevM = clamp01(kp.mastery);
      kp.mastery = clamp01(round3(alpha * res + (1 - alpha) * prevM));
      kp.recentAccuracy = round3(recentAccuracyOf(kp));
      kp.accuracy = kp.attempts ? clamp01(kp.correct / kp.attempts) : 0;
      kp.confidence = computeConfidence(kp);
    }

    // ERROR PATTERNS（R09/R10：仅来自 result.errorType 的可靠错因）
    var etype = ErrorModel.resolveErrorType(result);
    if (etype && !isSkip) {
      ErrorModel.recordError(kp.errorPatterns, etype, ts);
    }

    kp.lastPracticedAt = ts;
    kp.updatedAt = ts;

    // 默认推荐（可被 AdaptiveStrategy 覆盖）
    var rec = recommendDefaults(kp, opts.baseDifficulty);
    kp.recommendedDifficulty = rec.recommendedDifficulty;
    kp.recommendedSpiralLevel = rec.recommendedSpiralLevel;

    kp = normalizeKpState(kp, kpId);
    state.knowledgePoints[kpId] = kp;
    state.updatedAt = ts;
    return state;
  }

  // ===== R11 Mastery API =====
  function getMastery(state, kpId) {
    var kp = get(state, kpId);
    return kp ? kp.mastery : 0;
  }
  function getConfidence(state, kpId) {
    var kp = get(state, kpId);
    return kp ? kp.confidence : 0;
  }
  function getAccuracy(state, kpId) {
    var kp = get(state, kpId);
    return kp ? kp.accuracy : 0;
  }
  function getRecentAccuracy(state, kpId) {
    var kp = get(state, kpId);
    return kp ? kp.recentAccuracy : 0;
  }
  function getErrors(state, kpId) {
    var kp = get(state, kpId);
    return kp ? ErrorModel.getErrorFocus(kp.errorPatterns) : [];
  }
  function getState(state, kpId) {
    if (kpId == null) return normalizeLearnerState(state);
    var kp = get(state, kpId);
    return kp ? kp : defaultKpState(kpId);
  }

  var LearnerModel = {
    VERSION: VERSION,
    DEFAULT_ALPHA: DEFAULT_ALPHA,
    RECENT_WINDOW: RECENT_WINDOW,
    defaultKpState: defaultKpState,
    normalizeKpState: normalizeKpState,
    normalizeLearnerState: normalizeLearnerState,
    get: get,
    getOrInit: getOrInit,
    upsert: upsert,
    update: update,
    computeMastery: computeMastery,
    computeConfidence: computeConfidence,
    accuracyOf: accuracyOf,
    recentAccuracyOf: recentAccuracyOf,
    recommendDefaults: recommendDefaults,
    getMastery: getMastery,
    getConfidence: getConfidence,
    getAccuracy: getAccuracy,
    getRecentAccuracy: getRecentAccuracy,
    getErrors: getErrors,
    getState: getState,
    clear: function () { return { version: VERSION, updatedAt: null, knowledgePoints: {} }; }
  };

  global.LearnerModel = LearnerModel;
  if (typeof module !== 'undefined' && module.exports) module.exports = LearnerModel;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));