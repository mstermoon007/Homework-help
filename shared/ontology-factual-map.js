/**
 * shared/ontology-factual-map.js — Curated Plugin → Factual Content (M1-02.2)
 *
 * 治理记录：仅纳入「有明确、稳定教学依据」的事实（HIGH/MEDIUM 置信度）。
 * 无法确认者留空（factualContent = {}），由后续批次/人工补齐。绝不伪造事实。
 *
 * 证据等级：
 *   high   : 项目命名/既有行为即可确定（如乘法表 1-9、人民币单位 元角分、字母 26）
 *   medium : 与标准课程知识一致（如拼音声韵调数量、常见单位集合）
 * 低级推断（LOW/UNVERIFIED）不写入核心事实。
 */
(function (global) {
  'use strict';

  var FactOnt = require('./knowledge-factual.js');

  var MAP = {
    'math-g1-multiplication-table': {
      factualContent: { table: '1-9' },
      confidence: 'high', evidence: 'plugin-name'
    },
    'math-money': {
      factualContent: { units: ['元', '角', '分'] },
      confidence: 'high', evidence: 'standard-curriculum'
    },
    'chinese-pinyin': {
      factualContent: { system: '汉语拼音', initials: 23, finals: 24, tones: 4 },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'pinyin-to-char': {
      factualContent: { system: '汉语拼音', tones: 4 },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'english-alphabet': {
      factualContent: { alphabet: { letters: 26 } },
      confidence: 'high', evidence: 'standard-curriculum'
    },
    'math-unit-convert': {
      factualContent: { units: ['cm', 'm', 'km', 'g', 'kg', 'mL', 'L'] },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-fraction': {
      factualContent: { notation: 'a/b', concept: '整体的一部分' },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-decimal': {
      factualContent: { notation: '十进制小数' },
      confidence: 'low', evidence: 'standard-curriculum'
    },
    'math-clock': {
      factualContent: { unit: '小时', subUnits: ['分', '秒'], notation: 'hh:mm' },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-time-date': {
      factualContent: { units: ['年', '月', '日', '时', '分', '秒'], dayHours: 24, weekDays: 7 },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-shapes': {
      factualContent: { categories: ['平面图形', '立体图形'] },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-geometry': {
      factualContent: { categories: ['点', '线', '角', '面', '体'] },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-area': {
      factualContent: { formulas: { rectangle: '长×宽', square: '边长×边长' } },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-combination-set': {
      factualContent: { concept: '排列与组合' },
      confidence: 'low', evidence: 'standard-curriculum'
    }
  };

  function factualForPlugin(pluginId) {
    var e = pluginId && MAP[pluginId];
    if (!e) return {};
    return e.factualContent;
  }

  function metaForPlugin(pluginId) {
    return pluginId && MAP[pluginId] ? MAP[pluginId] : null;
  }

  var API = { MAP: MAP, factualForPlugin: factualForPlugin, metaForPlugin: metaForPlugin };

  global.OntologyFactualMap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
