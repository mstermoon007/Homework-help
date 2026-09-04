/**
 * shared/knowledge-ontology-normalizer.js — Legacy → Canonical 归一化 (M1-01)
 *
 * 纯数据转换：不依赖 DOM / window / 插件 / UI / 题目生成。
 * 同一个 Legacy KP 输入必须得到相同 Canonical 输出（可重复）。
 * 不修改原对象；原始信息通过 source / legacy 字段保留。
 *
 * 映射严格依据 shared/difficulty-static.js 既有的字段语义
 * （spiral_level / max_spiral_level / cognitive_level / max_steps_default /
 *  number_range_default / context_default / applicable_question_types）。
 */
(function (global) {
  'use strict';

  var Ontology = require('./knowledge-ontology.js');
  var OpsOnt = require('./knowledge-operation.js');
  var OpsMap = require('./ontology-operation-map.js');
  var FactOnt = require('./knowledge-factual.js');
  var FactMap = require('./ontology-factual-map.js');
  var ErrOnt = require('./knowledge-error.js');
  var ErrMap = require('./ontology-error-map.js');
  var Schema = require('./schemas/knowledge-point.schema.js');
  var MODULE_CATALOG = (function () {
    try { return require('./module-catalog.js'); } catch (e) { return null; }
  })();

  var SUBJECTS = Ontology.SUBJECTS;

  var COGNITIVE_MAP = { '了解': 0, '理解': 0.33, '掌握': 0.67, '运用': 1.0 };
  function mapCognitive(v) {
    if (v == null) return 0;
    if (COGNITIVE_MAP[v] != null) return COGNITIVE_MAP[v];
    return 0.67;
  }

  var TYPE_ALIAS = {
    cushi: 'calc',
    // mixed/mix 由 registry CANONICAL_ALIASES → calc 解析（SSOT：registry 为真源，避免方向冲突的两跳）
    word: 'apply',
    // 注：oral / recognize 已是 canonical 9 类（registry SSOT），不再映射到 operate（消除两跳漂移）；
    // operate 由 registry CANONICAL_ALIASES → oral 解析（单跳）。
    // picture（看图列式 M7）→ calc（Q4 决策：看图列式属计算类）
    picture: 'calc',
    matching: 'choice', column: 'fill', comparison: 'judge'
  };
  function canonQuestionType(t) {
    if (!t) return t;
    if (Ontology.KNOWN_QUESTION_TYPES.indexOf(t) !== -1) return t;
    if (TYPE_ALIAS[t]) return TYPE_ALIAS[t];
    return t;
  }

  function moduleName(token) {
    if (!token) return '';
    if (MODULE_CATALOG && MODULE_CATALOG.byId) {
      var m = MODULE_CATALOG.byId(token.toUpperCase()) || MODULE_CATALOG.byId(token);
      if (m) return m.name || token;
    }
    return token;
  }

  function deriveCapabilities(legacyKP, maxSteps) {
    legacyKP = legacyKP || {};
    var capIds = {};
    var out = [];
    function pushCap(id) {
      if (id && Schema.isKnownCapability(id) && !capIds[id]) {
        capIds[id] = 1;
        out.push({ id: id, type: Schema.CAPABILITIES[id].type });
      }
    }
    if (Array.isArray(legacyKP.applicable_question_types)) {
      legacyKP.applicable_question_types.forEach(function (a) {
        if (a && a.type) {
          var cap = Schema.QUESTION_TYPE_TO_CAPABILITY[a.type];
          if (cap) pushCap(cap);
        }
      });
    }
    if (typeof legacyKP.type === 'string') {
      var capT = Schema.QUESTION_TYPE_TO_CAPABILITY[legacyKP.type];
      if (capT) pushCap(capT);
    }
    var ms = Number(maxSteps);
    if (!isFinite(ms) || ms < 1) ms = 1;
    pushCap(ms > 1 ? 'multi-step' : 'single-step');
    return out;
  }

  function fromLegacy(legacyKP) {
    legacyKP = legacyKP || {};
    var c = {};

    c.id = typeof legacyKP.id === 'string' ? legacyKP.id : '';

    var parts = c.id ? c.id.split('-') : [];
    var subject = parts[0] || null;
    var grade = null;
    if (parts[1]) {
      var gm = /^g(\d+)$/.exec(parts[1]);
      if (gm) grade = parseInt(gm[1], 10);
    }
    var moduleId = parts[2] || '';

    c.subject = SUBJECTS.indexOf(subject) !== -1 ? subject : null;
    c.grade = grade;

    c.module = { id: moduleId, name: moduleName(moduleId) };
    c.identity = {
      id: c.id,
      name: typeof legacyKP.name === 'string' ? legacyKP.name : '',
      description: typeof legacyKP.description === 'string' ? legacyKP.description : ''
    };
    c.source = {
      pluginId: legacyKP.pluginId || null,
      legacyType: legacyKP.type || null
    };

    var rawOps = Array.isArray(legacyKP.operations) && legacyKP.operations.length
      ? legacyKP.operations.slice()
      : OpsMap.operationsForPlugin(legacyKP.pluginId);
    var operations = [];
    var seenOp = {};
    rawOps.forEach(function (o) {
      var norm = OpsOnt.normalize(o);
      var canon = norm.canonical || o;
      if (!seenOp[canon]) { seenOp[canon] = 1; operations.push(canon); }
    });
    var factual = (legacyKP.factualContent && typeof legacyKP.factualContent === 'object')
      ? legacyKP.factualContent : FactMap.factualForPlugin(legacyKP.pluginId);
    var concept = (typeof legacyKP.concept === 'string' && legacyKP.concept) ? legacyKP.concept : null;
    var prerequisites = Array.isArray(legacyKP.prerequisites) ? legacyKP.prerequisites.slice() : [];
    c.knowledge = {
      concept: concept,
      operations: operations,
      factualContent: factual,
      prerequisites: prerequisites
    };

    var maxSteps = Number(legacyKP.max_steps_default);
    if (!isFinite(maxSteps) || maxSteps < 1) maxSteps = 1;
    c.structure = {
      minSteps: 1,
      maxSteps: maxSteps,
      allowBracket: !!legacyKP.allowBracket,
      allowMultDiv: !!legacyKP.allowMultDiv
    };

    var cogRaw = legacyKP.cognitive_level != null ? legacyKP.cognitive_level : null;
    c.cognition = { level: mapCognitive(cogRaw), targets: [], raw: cogRaw };

    var qts = [];
    if (Array.isArray(legacyKP.applicable_question_types)) {
      legacyKP.applicable_question_types.forEach(function (a) {
        if (!a || !a.type) return;
        qts.push({
          type: canonQuestionType(a.type),
          weight: Number(a.coefficient) || 1,
          rawType: a.type,
          cognitiveLevels: null,
          difficultyFactor: null
        });
      });
    } else if (typeof legacyKP.type === 'string' && legacyKP.type) {
      qts.push({
        type: canonQuestionType(legacyKP.type),
        weight: 1,
        rawType: legacyKP.type,
        cognitiveLevels: null,
        difficultyFactor: null
      });
    }
    c.presentation = {
      questionTypes: qts,
      graphicType: legacyKP.graphicType != null ? legacyKP.graphicType : null
    };

    var range = { min: null, max: null };
    var nr = legacyKP.number_range_default;
    if (nr && typeof nr === 'object' && (nr.min != null || nr.max != null)) {
      range.min = nr.min != null ? Number(nr.min) : null;
      range.max = nr.max != null ? Number(nr.max) : null;
    } else if (typeof nr === 'number') {
      range.min = 1;
      range.max = nr;
    }
    c.numeric = { range: range, integerOnly: true, decimalPlaces: 0 };

    var ctxDefaults = [];
    var allowPure = true, allowContextual = true;
    var ctx = legacyKP.context_default;
    if (typeof ctx === 'string' && ctx) {
      ctxDefaults.push(ctx);
      if (ctx === 'pure') allowContextual = false;
    }
    c.context = { defaults: ctxDefaults, allowPure: allowPure, allowContextual: allowContextual };

    var errs = [];
    if (Array.isArray(legacyKP.common_errors) && legacyKP.common_errors.length) {
      legacyKP.common_errors.forEach(function (e) {
        if (typeof e === 'string') errs.push(e);
        else if (e && e.id) errs.push(e);
      });
    } else {
      ErrMap.errorsForPlugin(legacyKP.pluginId).forEach(function (e) { errs.push(e); });
    }
    c.errors = errs;

    c.generation = { capabilities: deriveCapabilities(legacyKP, c.structure.maxSteps) };

    var sLevel = Number(legacyKP.spiral_level);
    if (!isFinite(sLevel) || sLevel < 1) sLevel = 1;
    var sMax = Number(legacyKP.max_spiral_level);
    if (!isFinite(sMax) || sMax < sLevel) sMax = sLevel;
    c.spiral = { level: sLevel, maxLevel: sMax };

    c.metadata = {
      weight: Number(legacyKP.weight) || 1,
      version: Ontology.VERSION
    };

    c.legacy = {
      difficulty: legacyKP.difficulty != null ? legacyKP.difficulty : null,
      example: legacyKP.example || null,
      prerequisites: legacyKP.prerequisites || null,
      related: legacyKP.related || null,
      status: legacyKP.status || null,
      category: legacyKP.category || null,
      bankRef: legacyKP.bankRef || null,
      exerciseTypes: legacyKP.exerciseTypes || null,
      cognitive_level: cogRaw,
      context_default: ctx
    };

    return Ontology.create(c);
  }

  var API = { fromLegacy: fromLegacy, mapCognitive: mapCognitive, canonQuestionType: canonQuestionType };

  global.KnowledgeOntologyNormalizer = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
