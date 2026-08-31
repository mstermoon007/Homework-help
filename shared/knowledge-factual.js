/**
 * shared/knowledge-factual.js — Factual Content 类型与校验 (M1-02.2)
 *
 * 事实 = 稳定的教学事实（公式/规则/单位/词表/概念/分类/固定关系/口诀/知识范围/符号/系统）。
 * 策略字段（题量/难度/用户掌握度/题目顺序/随机策略）严禁进入 factualContent。
 */
(function (global) {
  'use strict';

  var VERSION = 1;

  var FACT_TYPES = [
    'formula', 'rule', 'concept', 'vocabulary', 'unit', 'table',
    'classification', 'relationship', 'notation', 'range', 'system', 'count', 'alphabet'
  ];

  var STRATEGY_FIELDS = [
    'questionCount', 'preferredDifficulty', 'adaptiveDelta', 'userMastery',
    'nextQuestion', 'generationOrder', 'randomSeed', 'difficulty', 'useContext'
  ];

  function isFactualType(k) { return FACT_TYPES.indexOf(k) !== -1; }

  function validate(fc) {
    var errors = [], warnings = [];
    if (fc == null) return { valid: true, errors: errors, warnings: warnings };
    if (typeof fc !== 'object' || Array.isArray(fc)) {
      errors.push('factualContent 必须是对象');
      return { valid: false, errors: errors, warnings: warnings };
    }
    Object.keys(fc).forEach(function (k) {
      if (STRATEGY_FIELDS.indexOf(k) !== -1) {
        errors.push('策略字段混入 factualContent: ' + k);
      } else if (!isFactualType(k)) {
        warnings.push('未声明 fact type: ' + k);
      }
    });
    return { valid: errors.length === 0, errors: errors, warnings: warnings };
  }

  var API = {
    VERSION: VERSION,
    FACT_TYPES: FACT_TYPES,
    STRATEGY_FIELDS: STRATEGY_FIELDS,
    isFactualType: isFactualType,
    validate: validate
  };

  global.KnowledgeFactual = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
