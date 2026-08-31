/**
 * shared/ontology-error-map.js — Curated Plugin → Canonical Errors (M1-02.3)
 *
 * 治理记录：仅纳入「稳定、公认的错误模式」（MEDIUM 置信度，标准教学/pedagogy 依据）。
 * 不为凑覆盖率而批量制造错误；无法确认者留空（errors = []）。绝不写入具体题目答案。
 */
(function (global) {
  'use strict';

  var MAP = {
    'math-make-ten': [
      { id: 'borrow-omission', category: 'calculation', description: '退位减法遗漏退位' }
    ],
    'math-g2-column': [
      { id: 'carry-omission', category: 'calculation', description: '进位遗漏' },
      { id: 'digit-alignment-error', category: 'notation', description: '数位未对齐' }
    ],
    'math-g2-mixed': [
      { id: 'carry-omission', category: 'calculation', description: '进位遗漏' },
      { id: 'borrow-omission', category: 'calculation', description: '退位遗漏' }
    ],
    'math-g4-vertical': [
      { id: 'carry-omission', category: 'calculation', description: '进位遗漏' }
    ],
    'math-g5-vertical': [
      { id: 'carry-omission', category: 'calculation', description: '进位遗漏' }
    ],
    'math-unit-convert': [
      { id: 'unit-confusion', category: 'unit', description: '单位混淆/进率错误' }
    ],
    'math-money': [
      { id: 'unit-confusion', category: 'unit', description: '人民币单位混淆' }
    ],
    'math-fraction': [
      { id: 'denominator-confusion', category: 'concept', description: '分子/分母混淆' }
    ],
    'math-decimal': [
      { id: 'decimal-point-error', category: 'notation', description: '小数点位置错误' }
    ],
    'chinese-pinyin': [
      { id: 'tone-marking-error', category: 'notation', description: '标调错误' },
      { id: 'initial-final-confusion', category: 'reading', description: '声母韵母混淆' }
    ],
    'pinyin-to-char': [
      { id: 'tone-marking-error', category: 'notation', description: '标调错误' }
    ],
    'english-alphabet': [
      { id: 'letter-case-confusion', category: 'writing', description: '字母大小写混淆' }
    ],
    'math-g1-multiplication-table': [
      { id: 'multiplication-fact-confusion', category: 'operation', description: '乘法口诀混淆' }
    ]
  };

  function errorsForPlugin(pluginId) {
    var e = pluginId && MAP[pluginId];
    return e ? e.slice() : [];
  }

  function metaForPlugin(pluginId) {
    return pluginId && MAP[pluginId] ? { count: MAP[pluginId].length } : null;
  }

  var API = { MAP: MAP, errorsForPlugin: errorsForPlugin, metaForPlugin: metaForPlugin };

  global.OntologyErrorMap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
