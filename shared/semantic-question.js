/**
 * shared/semantic-question.js — SemanticQuestion 标准对象工厂/标准化/校验 (M5-R01)
 *
 * 职责：
 *   - createSemanticQuestion(raw)         从原始数据创建标准 SemanticQuestion
 *   - normalizeSemanticQuestion(raw)      将任意题目对象标准化为 SemanticQuestion
 *   - validateSchema(question)            仅做 Schema 级校验（ERROR/WARNING/INFO）
 *   - isValidSemanticQuestion(question)   便捷判断
 *
 * 设计原则：
 *   - 纯语义层：无 DOM、无 HTML、无 SVG 字符串、无渲染逻辑
 *   - 兼容性：保留 render/check 字段位供适配层填充
 *   - 可追溯：强制 generator / generatorVersion / seed
 *   - 单一事实来源：字段定义、枚举、错误码集中于 shared/schemas/semantic-question.schema.js
 */
'use strict';

var path = require('path');
var Schema = require('./schemas/semantic-question.schema.js');
var QTR = require('./question-type-registry.js');
var QID = require('./question-id.js');

var UUID_COUNTER = 0;

function uuid() {
  UUID_COUNTER++;
  return 'sq_' + Date.now().toString(36) + '_' + UUID_COUNTER.toString(36);
}

function nowISO() {
  return new Date().toISOString();
}

function deepClone(obj) {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  if (typeof obj === 'object') {
    var out = {};
    Object.keys(obj).forEach(function (k) { out[k] = deepClone(obj[k]); });
    return out;
  }
  return obj;
}

function coerceNumber(v) {
  if (v == null) return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

function coerceInteger(v) {
  var n = coerceNumber(v);
  return n == null ? null : Math.floor(n);
}

function coerceString(v) {
  if (v == null) return '';
  return String(v);
}

function ensureArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// Schema 8 类 + QTR 补集（geometry/recognize/oral）+ read-aloud 的并集
var VALID_QUESTION_TYPES = null;
function isValidQuestionType(t) {
  if (!t) return false;
  if (VALID_QUESTION_TYPES == null) {
    var set = Schema.QUESTION_TYPES.slice();
    (QTR.TYPES || []).forEach(function (tt) { if (set.indexOf(tt.id) === -1) set.push(tt.id); });
    if (set.indexOf('read-aloud') === -1) set.push('read-aloud');
    VALID_QUESTION_TYPES = set;
  }
  return VALID_QUESTION_TYPES.indexOf(t) !== -1;
}

/**
 * 创建标准 SemanticQuestion（工厂函数，补全默认值、生成 id/seed）。
 * @param {Object} raw 原始题目数据
 * @returns {Object} 标准 SemanticQuestion
 */
function createSemanticQuestion(raw) {
  raw = raw || {};

  // 自动生成 ID（若未提供）
  var questionId = raw.id || QID.generateQuestionId(raw.seed || QID.generateBaseSeed(), {
    generatorId: raw.generator || raw.metadata && raw.metadata.generator,
    index: raw.index,
    knowledgePointId: raw.knowledgePoint || raw.knowledgePointId,
    difficulty: raw.difficulty,
    questionType: raw.questionType
  });

  // 自动生成 metadata（可追溯三要素）
  var metadata = raw.metadata || {};
  if (!metadata.generator && raw.generator) metadata.generator = raw.generator;
  if (!metadata.generatorVersion && raw.generatorVersion) metadata.generatorVersion = raw.generatorVersion;
  if (!metadata.seed && raw.seed) metadata.seed = raw.seed;
  metadata = QID.createMetadata({
    generatorId: metadata.generator,
    generatorVersion: metadata.generatorVersion,
    seed: metadata.seed,
    planId: metadata.planId,
    timestamp: metadata.timestamp,
    retryCount: metadata.retryCount,
    tags: metadata.tags
  });

  var sq = {
    // ① Identity
    id: questionId,
    version: raw.version || Schema.VERSION,

    // ② Knowledge Binding
    knowledgePoint: coerceString(raw.knowledgePoint || raw.knowledgePointId),
    knowledgePointId: coerceString(raw.knowledgePointId || raw.knowledgePoint),
    skill: coerceString(raw.skill || ''),

    // ③ Difficulty & Cognitive
    // ③ Difficulty & Cognitive
    difficulty: coerceInteger(raw.difficulty),
    difficultyParams: deepClone(raw.difficultyParams) || {},
    numberRange: deepClone(raw.numberRange) || { min: 1, max: 1 },
    spiralLevel: coerceInteger(raw.spiralLevel) || 1,
    context: coerceString(raw.context),
    seed: raw.seed || null,
    cognitiveLevel: coerceString(raw.cognitiveLevel || ''),

    // ④ Content (纯文本)
    content: deepClone(raw.content) || Schema.defaultContent(),

    // ⑤ Question (核心题干)
    question: deepClone(raw.question) || Schema.defaultQuestion(),

    // ⑥ Answer
    answer: deepClone(raw.answer) || Schema.defaultAnswer(),

    // ⑦ Distractors
    distractors: ensureArray(raw.distractors).map(function (d) {
      return deepClone(d) || Schema.defaultDistractor();
    }),

    // ⑧ Graphic (描述性，非渲染)
    graphic: deepClone(raw.graphic) || Schema.defaultGraphic(),

    // ⑨ Metadata (可追溯)
    metadata: metadata
  };

  // 兼容字段（供 LegacyAdapter / 适配层使用，不参与语义校验）
  if (raw.render != null) sq.render = raw.render;
  if (raw.check != null) sq.check = raw.check;
  if (raw.svg != null) sq.svg = raw.svg;
  if (raw.options != null) sq.options = raw.options;

  // 扁平化常用字段（便捷访问，不破坏标准结构）
  sq.prompt = sq.content && sq.content.prompt ? sq.content.prompt : (sq.question && sq.question.prompt ? sq.question.prompt : '');
  sq.questionType = raw.questionType || raw.type || null;
  sq.answerMode = (sq.question && sq.question.answerMode) || raw.answerMode || 'input';

  return sq;
}

/**
 * 标准化任意题目对象为 SemanticQuestion（宽容模式，尽力转换）。
 * 用于 Legacy Plugin 输出 → SemanticQuestion。
 * @param {Object} raw 任意题目对象
 * @returns {Object} 标准 SemanticQuestion
 */
function normalizeSemanticQuestion(raw) {
  if (!raw || typeof raw !== 'object') {
    return createSemanticQuestion({});
  }

  // 已经是标准结构则直接返回（幂等）
  if (raw.id && raw.version && raw.metadata && raw.metadata.generator) {
    return raw;
  }

  // 字段映射表：Legacy 字段名 → 标准字段
  var mapped = {
    id: raw.id || raw.questionId,
    version: raw.version || Schema.VERSION,
    knowledgePoint: raw.knowledgePointId || raw.knowledgePoint || raw.kpId,
    skill: raw.skill || raw.ability || '',
    questionType: raw.questionType || raw.type,
    difficulty: coerceInteger(raw.difficulty || raw.difficultyLevel),
    numberRange: raw.numberRange,
    cognitiveLevel: raw.cognitiveLevel || raw.cognitive || '',
    content: raw.content || { prompt: coerceString(raw.prompt || raw.stem || raw.q || raw.question) },
    question: raw.question || (function () {
      var q = { prompt: coerceString(raw.prompt || raw.stem || raw.q || raw.question) };
      if (raw.answerMode) q.answerMode = raw.answerMode;
      return q;
    })(),
    answerMode: raw.answerMode,
    answer: raw.answer ? (typeof raw.answer === 'object' ? raw.answer : { value: raw.answer }) : { value: raw.answerValue || raw.correctAnswer },
    distractors: ensureArray(raw.distractors || raw.options || raw.choices).map(function (d) {
      if (typeof d === 'object') return d;
      return { value: d };
    }),
    graphic: raw.graphic || raw.svg ? { type: 'custom', params: { rawSvg: raw.svg } } : null,
    metadata: raw.metadata || {
      generator: raw.generator || raw.pluginId || raw.source,
      generatorVersion: raw.generatorVersion || raw.version,
      seed: raw.seed || raw.randomSeed,
      timestamp: raw.timestamp || nowISO()
    }
  };

  // 补全 prompt
  if (!mapped.content.prompt) {
    mapped.content.prompt = coerceString(mapped.question.prompt || mapped.question.stem || mapped.question.q);
  }

  return createSemanticQuestion(mapped);
}

/**
 * Schema 级校验（仅结构/类型/枚举/必填，不做业务逻辑校验）。
 * 返回：{ valid, errors: [{code, field, message, severity}], warnings: [], info: [] }
 * @param {Object} sq SemanticQuestion
 * @returns {Object}
 */
function validateSchema(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  if (!sq || typeof sq !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.SCHEMA_INVALID, field: 'root', message: '题目对象为空或非对象', severity: Schema.SEVERITY.ERROR });
    return { valid: false, errors: errors, warnings: warnings, info: info };
  }

  // 禁止在 SemanticQuestion 上携带执行/渲染字段（先于归一化检查，避免被丢弃）
  if (typeof sq.render === 'function' || typeof sq.check === 'function') {
    errors.push({ code: Schema.ERROR_CODES.SCHEMA_INVALID, field: 'root', message: 'SemanticQuestion 禁止携带 render/check 执行字段（禁止字段）', severity: Schema.SEVERITY.ERROR });
  }

  // 宽容归一化：兼容 flat/legacy 输入（如 { prompt, answer: '14' }），
  // 与 createSemanticQuestion / normalizeSemanticQuestion 保持一致
  sq = normalizeSemanticQuestion(sq);

  // --- ① Identity ---
  if (!sq.id) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'id', message: '缺少题目 ID', severity: Schema.SEVERITY.ERROR });
  }
  if (typeof sq.version !== 'number' && typeof sq.version !== 'string') {
    warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'version', message: 'version 应为数字或字符串', severity: Schema.SEVERITY.WARNING });
  }

  // --- ② Knowledge Binding ---
  if (!sq.knowledgePoint) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'knowledgePoint', message: '缺少 knowledgePoint 绑定', severity: Schema.SEVERITY.ERROR });
  }

  // --- ③ Difficulty ---
  if (sq.difficulty != null) {
    var diff = coerceInteger(sq.difficulty);
    if (diff === null || Schema.DIFFICULTY_LEVELS.indexOf(diff) === -1) {
      warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'difficulty', message: 'difficulty 超出已知范围 (1-10)', severity: Schema.SEVERITY.WARNING });
    }
  }

  // --- ③.5 QuestionType ---
  if (!sq.questionType) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'questionType', message: '缺少 questionType', severity: Schema.SEVERITY.ERROR });
  } else if (!isValidQuestionType(sq.questionType)) {
    errors.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'questionType', message: '未知 questionType: ' + sq.questionType, severity: Schema.SEVERITY.ERROR });
  }

  // --- ③.6 NumberRange ---
  if (sq.numberRange) {
    if (typeof sq.numberRange !== 'object') {
      errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'numberRange', message: 'numberRange 必须为对象 { min, max }', severity: Schema.SEVERITY.ERROR });
    } else if (sq.numberRange.min != null && sq.numberRange.max != null &&
               sq.numberRange.min > sq.numberRange.max) {
      errors.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'numberRange', message: 'numberRange.min 不得大于 max', severity: Schema.SEVERITY.ERROR });
    }
  }

  // --- ④ Content ---
  if (sq.content && typeof sq.content !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'content', message: 'content 必须为对象', severity: Schema.SEVERITY.ERROR });
  }
  if (sq.content && sq.content.prompt != null && typeof sq.content.prompt !== 'string') {
    warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'content.prompt', message: 'prompt 应为字符串', severity: Schema.SEVERITY.WARNING });
  }
  var promptVal = (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || sq.prompt;
  if (!promptVal) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'prompt', message: '缺少 prompt（题干）', severity: Schema.SEVERITY.ERROR });
  }

  // --- ⑤ Question ---
  if (sq.question && typeof sq.question !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'question', message: 'question 必须为对象', severity: Schema.SEVERITY.ERROR });
  }
  if (sq.question && sq.question.answerMode && !Schema.isValidAnswerMode(sq.question.answerMode)) {
    warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'question.answerMode', message: '未知 answerMode: ' + sq.question.answerMode, severity: Schema.SEVERITY.WARNING });
  }

  // --- ⑥ Answer ---
  var answerMode = sq.answerMode || (sq.question && sq.question.answerMode) || 'input';
  if (!sq.answer || typeof sq.answer !== 'object') {
    // read-aloud 模式允许 answer 为 null
    if (answerMode !== 'read-aloud') {
      errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'answer', message: '缺少 answer 对象', severity: Schema.SEVERITY.ERROR });
    }
  } else {
    // read-aloud 模式允许 answer.value 为 null
    if (answerMode !== 'read-aloud' && sq.answer.value == null && (!sq.answer.acceptable || sq.answer.acceptable.length === 0)) {
      errors.push({ code: Schema.ERROR_CODES.ANSWER_INVALID, field: 'answer.value', message: '答案值缺失且无可接受替代答案', severity: Schema.SEVERITY.ERROR });
    }
    if (sq.answer.precision != null && (typeof sq.answer.precision !== 'number' || sq.answer.precision < 0)) {
      warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'answer.precision', message: 'precision 应为非负数', severity: Schema.SEVERITY.WARNING });
    }
  }

  // --- ⑦ Distractors ---
  if (sq.distractors && !Array.isArray(sq.distractors)) {
    errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'distractors', message: 'distractors 必须为数组', severity: Schema.SEVERITY.ERROR });
  }
  if (Array.isArray(sq.distractors)) {
    sq.distractors.forEach(function (d, i) {
      if (!d || typeof d !== 'object') {
        warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'distractors[' + i + ']', message: '干扰项应为对象', severity: Schema.SEVERITY.WARNING });
        return;
      }
      if (d.errorType && !Schema.isValidDistractorErrorType(d.errorType)) {
        warnings.push({ code: Schema.ERROR_CODES.DISTRACTOR_ERROR_TYPE_INVALID, field: 'distractors[' + i + '].errorType', message: '未知错误类型: ' + d.errorType, severity: Schema.SEVERITY.WARNING });
      }
    });
  }

  // --- ⑧ Graphic ---
  if (sq.graphic && typeof sq.graphic !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'graphic', message: 'graphic 必须为对象', severity: Schema.SEVERITY.ERROR });
  }
  if (sq.graphic) {
    if (sq.graphic.type && !Schema.isValidGraphicType(sq.graphic.type)) {
      warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'graphic.type', message: '未知 graphic type: ' + sq.graphic.type, severity: Schema.SEVERITY.WARNING });
    }
    if (sq.graphic.type && sq.graphic.subtype && !Schema.isValidGraphicSubtype(sq.graphic.type, sq.graphic.subtype)) {
      warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'graphic.subtype', message: 'type ' + sq.graphic.type + ' 下未知 subtype: ' + sq.graphic.subtype, severity: Schema.SEVERITY.WARNING });
    }
    // 禁止直接嵌入 SVG/HTML 字符串
    if (sq.graphic.rawSvg || sq.graphic.svg || sq.graphic.html) {
      errors.push({ code: Schema.ERROR_CODES.GRAPHIC_INVALID, field: 'graphic', message: 'graphic 不得包含原始 SVG/HTML 字符串（请使用描述性 params）', severity: Schema.SEVERITY.ERROR });
    }
  }

  // --- ⑨ Metadata (可追溯) ---
  if (!sq.metadata || typeof sq.metadata !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'metadata', message: '缺少 metadata', severity: Schema.SEVERITY.ERROR });
  } else {
    if (!sq.metadata.generator) {
      warnings.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'metadata.generator', message: '缺少 generator 来源标识', severity: Schema.SEVERITY.WARNING });
    }
    if (!sq.metadata.generatorVersion) {
      warnings.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'metadata.generatorVersion', message: '缺少 generatorVersion', severity: Schema.SEVERITY.WARNING });
    }
    if (!sq.metadata.seed) {
      warnings.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'metadata.seed', message: '缺少 seed（不可复现）', severity: Schema.SEVERITY.WARNING });
    }
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info };
}

/**
 * 便捷判断：是否为合法 SemanticQuestion（Schema 通过）。
 * @param {Object} sq
 * @returns {boolean}
 */
function isValidSemanticQuestion(sq) {
  return validateSchema(sq).valid;
}

/**
 * 批量标准化
 * @param {Array<Object>} raws
 * @returns {Array<Object>}
 */
function normalizeQuestions(raws) {
  if (!Array.isArray(raws)) return [];
  return raws.map(normalizeSemanticQuestion);
}

/**
 * 批量校验
 * @param {Array<Object>>} sqs
 * @returns {Array<Object>} 每项 { valid, errors, warnings, info }
 */
function validateQuestions(sqs) {
  if (!Array.isArray(sqs)) return [];
  return sqs.map(validateSchema);
}

module.exports = {
  createSemanticQuestion: createSemanticQuestion,
  normalizeSemanticQuestion: normalizeSemanticQuestion,
  validateSchema: validateSchema,
  isValidSemanticQuestion: isValidSemanticQuestion,
  normalizeQuestions: normalizeQuestions,
  validateQuestions: validateQuestions,
  Schema: Schema
};