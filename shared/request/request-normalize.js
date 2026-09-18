/**
 * shared/request/request-normalize.js — 统一 PracticeRequest 与题型归一（R02 / R07）
 *
 * 大服务层（UI ↔ 生成 之间）的唯一请求标准：
 *   - 页面只负责「选择 → 组装 PracticeRequest → buildPracticeUrl → practice.html」
 *   - 不直接接触 Strategy / Generator / Validator
 *
 * 统一外壳，三科内部 scope 各自独立：
 *   math:    { book, moduleId, unit, knowledgePoints, tags }
 *   chinese: { book, unit, knowledgePoints, tags }   （接口预留）
 *   english: { book, unit, vocabulary, grammarPoints, tags } （接口预留）
 *
 * 题型固定七种（spec 7 ID ↔ 内部 canonical）：
 *   calculation→calc, fill_blank→fill, choice→choice, true_false→judge,
 *   operation→geometry, classification→classify, word_problem→apply
 * 旧别名（oral/vertical/mixed/cushi/recognize/sort/operate）回退到 canonical，保证旧深链兼容。
 */
(function (global) {
  'use strict';

  var SUBJECTS = ['math', 'chinese', 'english'];
  var MODES = ['quick', 'teacher', 'competition'];
  var GRADES = [1, 2, 3, 4, 5, 6];
  var QuestionTypeRegistry = require('../knowledge/question-type-registry.js');

  // 内部 canonical 题型（唯一来源：Registry.TYPES）
  var CANONICAL_TYPES = QuestionTypeRegistry.TYPES.map(function (t) { return t.id; });

  // spec 七种题型 ID（页面统一用语）
  var SPEC_TYPES = ['calculation', 'fill_blank', 'choice', 'true_false', 'operation', 'classification', 'word_problem'];

  // 别名表收口（P0-11）：仅 Registry 未覆盖的 spec 边界映射本地保留（请求边界语义，非题型定义）；
  // 其余旧别名（oral/vertical/mixed/cushi/recognize/sort/...）统一继承 Registry.canonicalAliases，不再自持第二套词表。
  var TYPE_ALIASES = (function () {
    var SPEC_TO_CANONICAL = {
      calculation: 'calc', fill_blank: 'fill', true_false: 'judge',
      operation: 'geometry', classification: 'classify', word_problem: 'apply'
    };
    var merged = {}, k;
    for (k in SPEC_TO_CANONICAL) merged[k] = SPEC_TO_CANONICAL[k];
    var aliases = QuestionTypeRegistry.canonicalAliases || {};
    for (k in aliases) if (!merged[k]) merged[k] = aliases[k];
    return merged;
  })();

  // 题型显示名：唯一来源 Registry.TYPES.name（P0-11 收口，不再本地维护）
  var TYPE_LABELS = (function () {
    var labels = {};
    QuestionTypeRegistry.TYPES.forEach(function (t) { labels[t.id] = t.name; });
    return labels;
  })();

  // 难度：引擎契约为 1-10 整数；UI 用语（easy/normal/hard）在请求边界归一为数值。
  var DIFFICULTY_MAP = { easy: 4, simple: 4, normal: 6, medium: 6, hard: 9, difficult: 9 };
  function normalizeDifficulty(d) {
    if (d == null) return 6;
    if (typeof d === 'number' && !isNaN(d)) return (d >= 1 && d <= 10) ? Math.round(d) : 6;
    var n = Number(d);
    if (!isNaN(n) && n >= 1 && n <= 10) return Math.round(n);
    return DIFFICULTY_MAP[String(d).toLowerCase()] || 6;
  }

  /**
   * 编排层难度参数域（M2）：number → {requested, source:'user'}；
   * 结构化对象 {requested,min,max,tolerance,source} 原样归一（min/max 纯约束，不参与计算）；
   * null/缺省 → {requested:null, source:'auto'}。向下兼容旧 `difficulty: number`。
   * 输出仅供编排层使用；生成链仍消费 `difficulty` 数值（引擎契约 1-10）。
   */
  function normalizeDifficultyParam(d) {
    if (d != null && typeof d === 'object') {
      var o = { source: String(d.source == null ? '' : d.source).toLowerCase() };
      o.source = (o.source === 'user' || o.source === 'auto' || o.source === 'static') ? o.source
        : (d.requested != null ? 'user' : 'auto');
      return {
        requested: d.requested == null ? null : normalizeDifficulty(d.requested),
        min: (d.min == null) ? null : Number(d.min),
        max: (d.max == null) ? null : Number(d.max),
        tolerance: (d.tolerance == null || !(Number(d.tolerance) >= 0)) ? 0 : Number(d.tolerance),
        source: o.source
      };
    }
    var n = normalizeDifficulty(d);
    return {
      requested: (d == null || d === '') ? null : n,
      min: null,
      max: null,
      tolerance: 0,
      source: (d == null || d === '') ? 'auto' : 'user'
    };
  }

  function normalizeSubject(s) {
    s = String(s == null ? '' : s).toLowerCase();
    return SUBJECTS.indexOf(s) !== -1 ? s : null;
  }
  function normalizeMode(m) {
    m = String(m == null ? '' : m).toLowerCase();
    return MODES.indexOf(m) !== -1 ? m : 'quick';
  }
  function normalizeGrade(g) {
    g = Number(g);
    return GRADES.indexOf(g) !== -1 ? g : 1;
  }
  function normalizeQuestionType(t) {
    if (!t) return null;
    return TYPE_ALIASES[String(t).toLowerCase()] || null;
  }
  function normalizeQuestionTypes(arr) {
    if (!Array.isArray(arr)) return [];
    var out = [];
    arr.forEach(function (t) {
      var c = normalizeQuestionType(t);
      if (c && out.indexOf(c) === -1) out.push(c);
    });
    return out;
  }
  function toKpArray(v) {
    if (!v) return [];
    if (typeof v === 'string') return v.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (Array.isArray(v)) return v.slice();
    return [];
  }

  /**
   * 组装统一 PracticeRequest（所有页面出口的唯一结构）。
   * @param {Object} opts { mode, subject, grade, book, moduleId, unit, knowledgePoints,
   *                        tags, questionTypes, count, difficulty, adaptiveMode, adaptiveDelta }
   * @returns {Object} PracticeRequest
   */
  function createPracticeRequest(opts) {
    opts = opts || {};
    var scope = {
      book: opts.book || 'all',
      moduleId: opts.moduleId || null,
      unit: opts.unit || null,
      knowledgePoints: toKpArray(opts.knowledgePoints),
      tags: Array.isArray(opts.tags) ? opts.tags.slice() : []
    };
    // 英语预留字段（本阶段仅占位，不进入数学生成链）
    if (opts.vocabulary) scope.vocabulary = opts.vocabulary;
    if (opts.grammarPoints) scope.grammarPoints = opts.grammarPoints;

    return {
      mode: normalizeMode(opts.mode),
      subject: normalizeSubject(opts.subject) || 'math',
      grade: normalizeGrade(opts.grade),
      scope: scope,
      questionTypes: normalizeQuestionTypes(opts.questionTypes),
      count: Number(opts.count) > 0 ? Number(opts.count) : 20,
      difficulty: normalizeDifficulty(opts.difficulty),
      difficultyParam: normalizeDifficultyParam(opts.difficulty),
      adaptiveMode: !!opts.adaptiveMode,
      adaptiveDelta: Number(opts.adaptiveDelta) || 0
    };
  }

  var API = {
    SUBJECTS: SUBJECTS,
    MODES: MODES,
    GRADES: GRADES,
    CANONICAL_TYPES: CANONICAL_TYPES,
    SPEC_TYPES: SPEC_TYPES,
    TYPE_ALIASES: TYPE_ALIASES,
    TYPE_LABELS: TYPE_LABELS,
    DIFFICULTY_MAP: DIFFICULTY_MAP,
    normalizeDifficulty: normalizeDifficulty,
    normalizeDifficultyParam: normalizeDifficultyParam,
    normalizeSubject: normalizeSubject,
    normalizeMode: normalizeMode,
    normalizeGrade: normalizeGrade,
    normalizeQuestionType: normalizeQuestionType,
    normalizeQuestionTypes: normalizeQuestionTypes,
    toKpArray: toKpArray,
    createPracticeRequest: createPracticeRequest
  };

  global.RequestNormalize = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);
