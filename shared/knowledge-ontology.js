/**
 * shared/knowledge-ontology.js — Canonical Knowledge Ontology Schema (M1-01)
 *
 * 职责（仅数据标准化，不触达生成/渲染/DOM/用户数据）：
 *   - 定义 Canonical KnowledgePoint 结构（create 提供默认值）。
 *   - normalize(legacyKP) 委托 Normalizer 将 Legacy KnowledgePoint 转为 Canonical。
 *   - validate(kp) 委托 Validator 做 ERROR/WARNING 分类。
 *   - isValid(kp) 便捷判断。
 *
 * 不修改现有 KnowledgeBank 数据结构；KnowledgeBank 继续返回原始 Legacy 数据。
 */
(function (global) {
  'use strict';

  var Schema = require('./schemas/knowledge-point.schema.js');

  var VERSION = Schema.VERSION;
  var SUBJECTS = Schema.SUBJECTS;
  var KNOWN_OPERATIONS = Schema.KNOWN_OPERATIONS;
  var KNOWN_QUESTION_TYPES = Schema.KNOWN_QUESTION_TYPES;
  var KNOWN_CONTEXTS = Schema.KNOWN_CONTEXTS;

  function isPlainObject(x) {
    return x && typeof x === 'object' && !Array.isArray(x);
  }

  function defaultCanonical() {
    return {
      id: '',
      subject: null,
      grade: null,
      module: { id: '', name: '' },
      identity: { id: '', name: '', description: '' },
      source: { pluginId: null, legacyType: null },
      knowledge: { concept: null, operations: [], factualContent: {}, prerequisites: [] },
      structure: { minSteps: 1, maxSteps: 1, allowBracket: false, allowMultDiv: false },
      cognition: { level: 0, targets: [], raw: null },
      presentation: { questionTypes: [], graphicType: null },
      numeric: { range: { min: null, max: null }, integerOnly: true, decimalPlaces: 0 },
      context: { defaults: [], allowPure: true, allowContextual: true },
      errors: [],
      spiral: { level: 1, maxLevel: 1 },
      generation: { capabilities: [] },
      metadata: { weight: 1, version: VERSION },
      legacy: {}
    };
  }

  function create(data) {
    var c = defaultCanonical();
    if (!isPlainObject(data)) return c;
    if (data.id !== undefined) c.id = data.id;
    if (data.subject !== undefined) c.subject = data.subject;
    if (data.grade !== undefined) c.grade = data.grade;
    if (data.module) c.module = Object.assign({}, c.module, data.module);
    if (data.identity) c.identity = Object.assign({}, c.identity, data.identity);
    if (data.source) c.source = Object.assign({}, c.source, data.source);
    if (data.knowledge) c.knowledge = Object.assign({}, c.knowledge, data.knowledge);
    if (data.structure) c.structure = Object.assign({}, c.structure, data.structure);
    if (data.cognition) c.cognition = Object.assign({}, c.cognition, data.cognition);
    if (data.presentation) c.presentation = Object.assign({}, c.presentation, data.presentation);
    if (data.numeric) {
      c.numeric = Object.assign({}, c.numeric, data.numeric);
      if (data.numeric.range) c.numeric.range = Object.assign({}, c.numeric.range);
    }
    if (data.context) c.context = Object.assign({}, c.context, data.context);
    if (data.errors) c.errors = data.errors;
    if (data.spiral) c.spiral = Object.assign({}, c.spiral, data.spiral);
    if (data.generation) c.generation = Object.assign({}, c.generation, data.generation);
    if (data.metadata) c.metadata = Object.assign({}, c.metadata, data.metadata);
    if (data.legacy) c.legacy = Object.assign({}, data.legacy);
    return c;
  }

  function normalize(legacyKP) {
    var Normalizer = require('./knowledge-ontology-normalizer.js');
    return Normalizer.fromLegacy(legacyKP);
  }

  function validate(kp) {
    var Validator = require('./knowledge-ontology-validator.js');
    return Validator.validate(kp);
  }

  function isValid(kp) {
    var r = validate(kp);
    return !!(r && r.valid);
  }

  var API = {
    VERSION: VERSION,
    SUBJECTS: SUBJECTS,
    KNOWN_OPERATIONS: KNOWN_OPERATIONS,
    KNOWN_QUESTION_TYPES: KNOWN_QUESTION_TYPES,
    KNOWN_CONTEXTS: KNOWN_CONTEXTS,
    defaultCanonical: defaultCanonical,
    create: create,
    normalize: normalize,
    validate: validate,
    isValid: isValid,
    schemaVersion: function () { return VERSION; }
  };

  global.KnowledgeOntology = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
