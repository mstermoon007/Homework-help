/**
 * shared/knowledge-ontology-validator.js — Canonical Schema 校验 (M1-01)
 *
 * validate(kp) -> { valid, errors[], warnings[], normalized }
 *   ERROR  : 结构非法（应阻断接入）。
 *   WARNING: 数据暂缺/未归一化（不阻断，留给 M1-02 数据治理）。
 *
 * 不修改传入对象；只读校验。
 */
(function (global) {
  'use strict';

  var Ontology = require('./knowledge-ontology.js');
  var Schema = require('./schemas/knowledge-point.schema.js');

  var COGNITIVE_MAP = Schema.COGNITIVE_MAP;

  function validate(kp) {
    var errors = [];
    var warnings = [];
    kp = kp || {};

    var name = kp.identity && kp.identity.name;

    if (!kp.id) errors.push('id 缺失');
    if (!name) errors.push('name 缺失');
    if (!kp.subject || Schema.SUBJECTS.indexOf(kp.subject) === -1) errors.push('subject 缺失/非法');

    var grade = kp.grade;
    if (typeof grade !== 'number' || grade < 1 || grade > 6 || grade % 1 !== 0) errors.push('grade 非法');

    var sp = kp.spiral || {};
    if (typeof sp.level !== 'number' || sp.level < 1) errors.push('spiral.level 非法');
    if (typeof sp.maxLevel !== 'number' || sp.maxLevel < sp.level) errors.push('spiral.maxLevel < spiral.level');

    var st = kp.structure || {};
    if (typeof st.maxSteps === 'number' && typeof st.minSteps === 'number' && st.maxSteps < st.minSteps) {
      errors.push('structure.maxSteps < minSteps');
    }

    var pres = kp.presentation || {};
    if (!Array.isArray(pres.questionTypes)) errors.push('questionTypes 非数组');

    var cog = kp.cognition || {};
    if (typeof cog.level !== 'number' || isNaN(cog.level)) errors.push('cognition.level 非法');

    // 字段级格式合法性（集中规则，ERROR 级）。缺数据不在此报。
    var legal = Schema.checkLegality(kp);
    legal.errors.forEach(function (e) { errors.push(e); });

    if (!(kp.identity && kp.identity.description)) warnings.push('description 缺失');

    var sem = kp.knowledge || {};
    if (!sem.factualContent || Object.keys(sem.factualContent).length === 0) warnings.push('factualContent 为空');
    if (!sem.operations || sem.operations.length === 0) warnings.push('operations 为空');
    if (Array.isArray(sem.operations)) {
      sem.operations.forEach(function (o) {
        if (Schema.KNOWN_OPERATIONS.indexOf(o) === -1) warnings.push('未知 operation: ' + o);
      });
    }
    if (sem.concept == null) warnings.push('concept 缺失');
    if (!Array.isArray(sem.prerequisites) || sem.prerequisites.length === 0) warnings.push('prerequisites 为空');

    var ctx = kp.context || {};
    if (!ctx.defaults || ctx.defaults.length === 0) warnings.push('context 为空');

    if (!kp.errors || kp.errors.length === 0) warnings.push('errors 为空');

    if (!(pres && pres.graphicType)) warnings.push('graphicType 缺失');

    if (Array.isArray(pres.questionTypes)) {
      pres.questionTypes.forEach(function (q) {
        if (q && Schema.KNOWN_QUESTION_TYPES.indexOf(q.type) === -1) warnings.push('未知 questionType: ' + q.type);
      });
    }

    var gen = kp.generation || {};
    var caps = Array.isArray(gen.capabilities) ? gen.capabilities : [];
    if (caps.length === 0) warnings.push('generation.capabilities 为空');

    if (cog.raw != null && typeof cog.raw === 'string' && !COGNITIVE_MAP[cog.raw]) {
      warnings.push('未知 cognitive_level: ' + cog.raw);
    }

    var valid = errors.length === 0;
    return { valid: valid, errors: errors, warnings: warnings, normalized: true };
  }

  var API = { validate: validate };

  global.KnowledgeOntologyValidator = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
