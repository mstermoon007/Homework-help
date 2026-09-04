/**
 * shared/strategy/strategy-request.js — M3-01 Strategy Request
 *
 * 统一策略输入对象。
 * 只描述「要什么题」，不包含生成逻辑、SVG/HTML、执行函数。
 * 向后兼容旧 UI 参数（subject/grade/count/difficulty 等）。
 */
'use strict';

var StrategyConfig = require('../strategy-config.js');

var LEGACY_UI_KEYS = ['subject', 'grade', 'count', 'difficulty', 'subtype', 'questionType'];

// 标准题型枚举（来自 QuestionTypeRegistry）
var VALID_QUESTION_TYPES = [
  'oral', 'calc', 'fill', 'choice', 'judge', 'apply', 'open', 'geometry', 'recognize'
];

// 难度范围
var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 10;

function normalizeLegacyParams(params) {
  var out = {};
  // 旧 UI 参数映射
  if (params.subject != null) out.subject = params.subject;
  if (params.grade != null) out.grade = params.grade;
  if (params.count != null) out.count = Math.max(1, Math.floor(params.count));
  if (params.difficulty != null) {
    var d = Math.max(DIFFICULTY_MIN, Math.min(DIFFICULTY_MAX, Math.floor(params.difficulty)));
    out.targetDifficulty = d;
  }
  if (params.subtype != null) out.subtype = params.subtype;
  if (params.questionType != null) out.questionType = params.questionType;
  return out;
}

function validateRequest(req) {
  var errors = [];

  if (!req || typeof req !== 'object') {
    errors.push('Request 必须是对象');
    return { valid: false, errors: errors };
  }

  // 核心输入：knowledgePointId 必填
  if (!req.knowledgePointId || typeof req.knowledgePointId !== 'string') {
    errors.push('knowledgePointId 是必填字符串');
  }

  // 题型：若提供，必须在合法枚举中
  if (req.questionType != null) {
    if (typeof req.questionType !== 'string') {
      errors.push('questionType 必须是字符串');
    } else if (VALID_QUESTION_TYPES.indexOf(req.questionType) === -1) {
      errors.push('非法 questionType: ' + req.questionType);
    }
  }

  // 题型策略白名单：可选，若提供必须是数组（元素合法性由题型选择池化逻辑容忍）
  if (req.questionTypes != null && !Array.isArray(req.questionTypes)) {
    errors.push('questionTypes 必须是数组');
  }

  // targetDifficulty 必须在 1-10
  if (req.targetDifficulty != null) {
    var td = req.targetDifficulty;
    if (typeof td !== 'number' || td < DIFFICULTY_MIN || td > DIFFICULTY_MAX || td % 1 !== 0) {
      errors.push('targetDifficulty 必须是 1-10 的整数');
    }
  }

  // count 必须 >=1
  if (req.count != null) {
    var c = req.count;
    if (typeof c !== 'number' || c < 1 || c % 1 !== 0) {
      errors.push('count 必须是 >=1 的整数');
    }
  }

  // subject/grade 若提供，需合法
  if (req.subject != null && typeof req.subject !== 'string') {
    errors.push('subject 必须是字符串');
  }
  if (req.grade != null && (typeof req.grade !== 'number' || req.grade < 1 || req.grade > 6 || req.grade % 1 !== 0)) {
    errors.push('grade 必须是 1-6 的整数');
  }

  // learnerProfile 可选，若提供必须是对象
  if (req.learnerProfile != null && typeof req.learnerProfile !== 'object') {
    errors.push('learnerProfile 必须是对象');
  }

  // settings 可选，若提供必须是对象
  if (req.settings != null && typeof req.settings !== 'object') {
    errors.push('settings 必须是对象');
  }

  // 禁止字段：不允许直接包含 SVG/HTML/生成器
  var forbidden = ['svg', 'html', 'generate', 'generator', 'render', 'template'];
  forbidden.forEach(function (k) {
    if (req[k] !== undefined) {
      errors.push('禁止字段: ' + k + ' (不允许在 Request 中包含 SVG/HTML/生成器)');
    }
  });

  return { valid: errors.length === 0, errors: errors };
}

function createRequest(params) {
  var req = Object.assign({}, params || {});
  return req;
}

function createFromLegacyUI(legacyParams) {
  // 从旧 UI 参数创建 StrategyRequest
  var base = normalizeLegacyParams(legacyParams || {});
  // 保留 legacy 字段供兼容层使用
  base._legacy = true;
  return base;
}

function isLegacyRequest(req) {
  return req && req._legacy === true;
}

module.exports = {
  VALID_QUESTION_TYPES: VALID_QUESTION_TYPES,
  DIFFICULTY_MIN: DIFFICULTY_MIN,
  DIFFICULTY_MAX: DIFFICULTY_MAX,
  normalizeLegacyParams: normalizeLegacyParams,
  validateRequest: validateRequest,
  createRequest: createRequest,
  createFromLegacyUI: createFromLegacyUI,
  isLegacyRequest: isLegacyRequest
};