/**
 * shared/learner/error-model.js — M6-R09 错因（Error Pattern）模型
 *
 * 每条记录：
 *   {
 *     errorType,       // 错因类型（ERROR_TYPES 之一，或 'other' 兜底）
 *     count,           // 累计出现次数
 *     recentCount,     // 近期出现次数（随新结果衰减）
 *     lastOccurredAt,  // 最近一次出现时间戳
 *     confidence       // 该错因出现的确定性（0..1，随出现次数增长）
 *   }
 *
 * M6-R10 来源约束：本模型不自行分析答案；“错因”只允许来自
 * Validator / SemanticQuestion 提供的 errorType。系统无可靠错因时
 * 一律返回 null（不伪造诊断）。
 */
(function (global) {
  'use strict';

  // 初始错因类型（只支持项目已有能力，不扩张）；'other' 兜底
  var ERROR_TYPES = [
    '计算错误',   // 运算结果错误/算术出错
    '口诀混淆',   // 乘法口诀/公式背诵混淆
    '概念混淆',   // 概念理解偏差
    '符号错误',   // 正负号/运算符/标点混用
    '步骤错误',   // 解题步骤顺序/遗漏
    '审题错误',   // 读题偏差/漏条件
    '单位错误',   // 单位换算/遗漏单位
    '格式错误'    // 答案格式不符（书写/排版）
  ];
  var OTHER = 'other';

  var MAX_SEEN_FOR_CONFIDENCE = 10;
  var RECENT_DECAY = 0.5;
  var RECENT_BOOST = 1;

  function isKnownType(t) {
    return typeof t === 'string' && ERROR_TYPES.indexOf(t) !== -1;
  }

  /**
   * 归一化错因：合法类型返回原值；'other' 返回 'other'；
   * 其余（含 null/非法）返回 null —— 绝不伪造诊断。
   * @param {*} t
   * @returns {string|null}
   */
  function normalizeErrorType(t) {
    if (t === OTHER || t === 'other') return OTHER;
    if (isKnownType(t)) return t;
    return null;
  }

  function defaultPattern(errorType) {
    return {
      errorType: errorType,
      count: 0,
      recentCount: 0,
      lastOccurredAt: null,
      confidence: 0
    };
  }

  /**
   * 规范化整个 errorPatterns 容器（R26：字段缺失/非法类型自愈）。
   * @param {Object} patterns
   * @returns {Object} 规范化后的 errorPatterns（仅含合法错因键）
   */
  function normalizePatterns(patterns) {
    var out = {};
    if (patterns == null || typeof patterns !== 'object') return out;
    Object.keys(patterns).forEach(function (k) {
      var tk = normalizeErrorType(k);
      if (!tk) return; // 非法/未知类型 → 丢弃
      var p = patterns[k];
      if (p == null || typeof p !== 'object') { out[tk] = defaultPattern(tk); return; }
      var norm = defaultPattern(tk);
      norm.count = toNonNegInt(p.count);
      norm.recentCount = toNonNegInt(p.recentCount);
      norm.lastOccurredAt = (typeof p.lastOccurredAt === 'number' && isFinite(p.lastOccurredAt)) ? p.lastOccurredAt : null;
      norm.confidence = clamp01(typeof p.confidence === 'number' && isFinite(p.confidence) ? p.confidence : 0);
      out[tk] = norm;
    });
    return out;
  }

  function toNonNegInt(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }
  function clamp01(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }

  /**
   * 记录一次错因出现。返回最新 pattern。
   * 不改变 attempts/correct —— 那些由 LearnerModel 维护。
   */
  function recordError(patterns, errorType, timestamp) {
    var t = normalizeErrorType(errorType);
    if (!t) return null;
    patterns = patterns || {};
    var p = patterns[t] ? patterns[t] : defaultPattern(t);
    p.count += 1;
    p.recentCount = (p.recentCount || 0) + RECENT_BOOST;
    p.lastOccurredAt = (typeof timestamp === 'number') ? timestamp : Date.now();
    p.confidence = clamp01(0.3 + 0.6 * Math.min(1, p.count / MAX_SEEN_FOR_CONFIDENCE));
    patterns[t] = p;

    // 其余错因近期计数衰减（表示“最近没再犯”）
    Object.keys(patterns).forEach(function (k) {
      if (k === t) return;
      if (patterns[k] && patterns[k].recentCount > 0) {
        patterns[k].recentCount = Math.max(0, patterns[k].recentCount - RECENT_DECAY);
      }
    });
    return p;
  }

  /**
   * 错因解析：唯一的可靠来源入口。
   * @param {Object} [source] 疑似携带 errorType 的对象（question / practiceResult）
   * @returns {string|null} 可靠错因类型；无则 null（不伪造）
   */
  function resolveErrorType(source) {
    if (!source || typeof source !== 'object') return null;
    var t = source.errorType;
    if (t == null) return null;
    return normalizeErrorType(t);
  }

  /**
   * 获取错因聚焦列表（R17）：按严重度排序。
   * 权重：recentCount 优先（近期反复出现更相关），count 次之。
   * @param {Object} patterns
   * @param {number} [limit] 返回条数上限
   * @returns {Array<{errorType:string, count:number, recentCount:number, confidence:number}>}
   */
  function getErrorFocus(patterns, limit) {
    patterns = patterns || {};
    var list = [];
    Object.keys(patterns).forEach(function (k) {
      var p = patterns[k];
      if (!p || p.count <= 0) return;
      list.push(p);
    });
    list.sort(function (a, b) {
      var d = (b.recentCount || 0) - (a.recentCount || 0);
      if (d) return d;
      return (b.count || 0) - (a.count || 0);
    });
    if (typeof limit === 'number' && limit > 0) list = list.slice(0, limit);
    return list.map(function (p) { return {
      errorType: p.errorType,
      count: p.count,
      recentCount: p.recentCount,
      lastOccurredAt: p.lastOccurredAt,
      confidence: p.confidence
    }; });
  }

  var ErrorModel = {
    ERROR_TYPES: ERROR_TYPES,
    OTHER: OTHER,
    normalizeErrorType: normalizeErrorType,
    normalizePatterns: normalizePatterns,
    defaultPattern: defaultPattern,
    recordError: recordError,
    resolveErrorType: resolveErrorType,
    getErrorFocus: getErrorFocus
  };

  global.LearnerErrorModel = ErrorModel;
  if (typeof module !== 'undefined' && module.exports) module.exports = ErrorModel;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));