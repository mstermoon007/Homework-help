/**
 * shared/schemas/knowledge-point.schema.js — Canonical KnowledgePoint Schema (M1-R01)
 *
 * 正式集中定义 Canonical KnowledgePoint 的 5 类结构与字段级合法性规则。
 * knowledge-ontology.js 引用本文件，不复制逻辑（单一事实来源）。
 *
 * 5 类（Categories）：
 *   ① Identity      : id, subject, grade, module, name, description
 *   ② Knowledge     : concept, operations, factualContent, prerequisites
 *   ③ Difficulty    : spiralLevel, maxSpiralLevel, cognitiveLevel, numberRangeDefault, maxStepsDefault
 *   ④ Assessment    : applicableQuestionTypes, contextDefault, errors
 *   ⑤ Generation    : capabilities（仅能力声明，不含生成器）
 *
 * 本文件纯数据/纯函数，不依赖 DOM / window / 插件 / KB / 生成器。
 */
(function (global) {
  'use strict';

  var VERSION = 1;

  var SUBJECTS = ['math', 'cn', 'en'];

  var KNOWN_OPERATIONS = [
    'add', 'subtract', 'multiply', 'divide',
    'compare', 'order',
    'compose', 'decompose',
    'measure', 'convert',
    'identify', 'classify',
    'read', 'write',
    'calculate', 'reason',
    'represent', 'model'
  ];

  var KNOWN_QUESTION_TYPES = ['calc', 'fill', 'judge', 'choice', 'operate', 'apply', 'open'];

  var KNOWN_CONTEXTS = ['pure', 'simple', 'standard', 'complex'];

  var COGNITIVE_MAP = { '了解': 0, '理解': 0.33, '掌握': 0.67, '运用': 1.0 };
  var COGNITIVE_MIN = 0;
  var COGNITIVE_MAX = 1;

  // ⑤ Generation Capability 枚举（仅能力声明，type 用于分组）。
  var CAPABILITIES = {
    'single-step': { type: 'procedure' },
    'multi-step': { type: 'procedure' },
    'calculation': { type: 'calculation' },
    'oral': { type: 'question-format' },
    'fill': { type: 'question-format' },
    'choice': { type: 'question-format' },
    'judge': { type: 'question-format' },
    'open': { type: 'question-format' },
    'contextual': { type: 'context' },
    'application': { type: 'context' }
  };

  // Legacy applicable_question_types.type -> capability id（数据驱动推导，不猜测）。
  var QUESTION_TYPE_TO_CAPABILITY = {
    calc: 'calculation', operate: 'calculation',
    fill: 'fill', choice: 'choice', judge: 'judge',
    apply: 'contextual', open: 'open'
  };

  var CATEGORIES = {
    identity: { fields: ['id', 'subject', 'grade', 'module', 'name', 'description'] },
    knowledge: { fields: ['concept', 'operations', 'factualContent', 'prerequisites'] },
    difficulty: { fields: ['spiralLevel', 'maxSpiralLevel', 'cognitiveLevel', 'numberRangeDefault', 'maxStepsDefault'] },
    assessment: { fields: ['applicableQuestionTypes', 'contextDefault', 'errors'] },
    generation: { fields: ['capabilities'] }
  };

  function isKnownCapability(id) { return CAPABILITIES[id] != null; }
  function isValidCognitiveRaw(v) { return COGNITIVE_MAP[v] != null; }
  function isValidQuestionType(t) { return KNOWN_QUESTION_TYPES.indexOf(t) !== -1; }

  /**
   * 字段级合法性（格式非法 = ERROR）。供 Validator 与 KB Verifier 共用。
   * 仅检查可客观判定的格式，不因为缺数据而报错（缺数据由调用方视作 WARNING）。
   */
  function checkLegality(c) {
    var errors = [];
    c = c || {};

    var range = c.numeric && c.numeric.range;
    if (range && typeof range.min === 'number' && typeof range.max === 'number' && range.min > range.max) {
      errors.push('numberRange min > max');
    }

    var st = c.structure || {};
    if (typeof st.maxSteps === 'number' && st.maxSteps < 1) {
      errors.push('maxSteps < 1');
    }

    var sp = c.spiral || {};
    if (typeof sp.level === 'number' && typeof sp.maxLevel === 'number' && sp.level > sp.maxLevel) {
      errors.push('spiralLevel > maxSpiralLevel');
    }

    var cog = c.cognition || {};
    if (typeof cog.level === 'number' && (cog.level < COGNITIVE_MIN || cog.level > COGNITIVE_MAX)) {
      errors.push('cognitiveLevel 超出范围');
    }

    // 注：questionType 的“未知”在 Canonical 层按 WARNING 处理（TYPE_ALIAS 非穷举），
    // 不在此升级为 ERROR，以免阻断治理。

    var gen = c.generation || {};
    if (Array.isArray(gen.capabilities)) {
      gen.capabilities.forEach(function (cap) {
        if (cap && !isKnownCapability(cap.id)) errors.push('未知 capability: ' + (cap && cap.id));
      });
    }

    return { errors: errors, warnings: [] };
  }

  var API = {
    VERSION: VERSION,
    SUBJECTS: SUBJECTS,
    KNOWN_OPERATIONS: KNOWN_OPERATIONS,
    KNOWN_QUESTION_TYPES: KNOWN_QUESTION_TYPES,
    KNOWN_CONTEXTS: KNOWN_CONTEXTS,
    COGNITIVE_MAP: COGNITIVE_MAP,
    COGNITIVE_MIN: COGNITIVE_MIN,
    COGNITIVE_MAX: COGNITIVE_MAX,
    CAPABILITIES: CAPABILITIES,
    QUESTION_TYPE_TO_CAPABILITY: QUESTION_TYPE_TO_CAPABILITY,
    CATEGORIES: CATEGORIES,
    isKnownCapability: isKnownCapability,
    isValidCognitiveRaw: isValidCognitiveRaw,
    isValidQuestionType: isValidQuestionType,
    checkLegality: checkLegality
  };

  global.KnowledgePointSchema = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
