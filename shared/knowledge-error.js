/**
 * shared/knowledge-error.js — Canonical Error Ontology (M1-02.3)
 *
 * 描述「学生在该知识点上稳定的认知/操作错误模式」，不是某一道题的错误答案。
 * Error ID：稳定、可复用、英文 kebab-case、与题目/插件无关。
 */
(function (global) {
  'use strict';

  var VERSION = 1;

  var ERROR_CATEGORIES = [
    'concept', 'operation', 'calculation', 'notation',
    'unit', 'reading', 'writing', 'structure', 'reasoning', 'attention'
  ];

  var ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
  var FORBIDDEN_RE = /(plugin|question|error-[0-9]|math-g|cn-|en-)/;

  function isCategory(c) { return ERROR_CATEGORIES.indexOf(c) !== -1; }

  function isValidId(id) {
    if (typeof id !== 'string' || !ID_RE.test(id)) return false;
    if (FORBIDDEN_RE.test(id)) return false;
    return true;
  }

  function normalizeError(e) {
    if (typeof e === 'string') return { id: e, category: null, description: e };
    if (e && typeof e === 'object') return { id: e.id, category: e.category || null, description: e.description || '' };
    return null;
  }

  function validate(errors) {
    var errs = [], warns = [];
    if (!Array.isArray(errors)) {
      errs.push('errors 必须是数组');
      return { valid: false, errors: errs, warnings: warns };
    }
    var seen = {};
    errors.forEach(function (raw) {
      var e = normalizeError(raw);
      if (!e || !e.id) { errs.push('error 缺少合法 id'); return; }
      if (!isValidId(e.id)) errs.push('非法 error id: ' + e.id);
      if (seen[e.id]) errs.push('重复 error id: ' + e.id);
      seen[e.id] = 1;
      if (!e.description) errs.push('error 缺少 description: ' + e.id);
      if (e.category && !isCategory(e.category)) errs.push('未知 error category: ' + e.category);
    });
    return { valid: errs.length === 0, errors: errs, warnings: warns };
  }

  var API = {
    VERSION: VERSION,
    ERROR_CATEGORIES: ERROR_CATEGORIES,
    isCategory: isCategory,
    isValidId: isValidId,
    normalizeError: normalizeError,
    validate: validate
  };

  global.KnowledgeError = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
