/**
 * shared/strategy/strategy-request.js — M3-01 Strategy Request
 *
 * 统一策略输入对象。
 * 只描述「要什么题」，不包含生成逻辑、SVG/HTML、执行函数。
 * 向后兼容旧 UI 参数（subject/grade/count/difficulty/knowledgePointId 等）。
 *
 * Refactor Step 2（Request/QuestionPlan 重构）：
 *   - 内部 KP 语义唯一为「数组」：knowledgePointIds[]。
 *   - 旧调用（knowledgePointId 字符串 / knowledgePoints 数组）经 resolveKnowledgePointIds
 *     归一为 knowledgePointIds[]；normalizeRequest 输出的规范请求不再携带单数 KP 字段，
 *     内部流程只读取 knowledgePointIds（不维护两套语义）。
 *   - 新增请求字段：mode / grade / volume(题量别名) / unitId / questionType / count /
 *     difficulty / spiralLevel / knowledgePointIds / combine / previousGenerationId。
 */
'use strict';

var StrategyConfig = require('../strategy-config.js');

var LEGACY_UI_KEYS = ['subject', 'grade', 'count', 'difficulty', 'subtype', 'questionType', 'knowledgePointId', 'knowledgePoints'];

// 标准题型枚举（来自 QuestionTypeRegistry）
var VALID_QUESTION_TYPES = [
  'oral', 'calc', 'fill', 'choice', 'judge', 'apply', 'open', 'geometry', 'recognize'
];

// 难度范围
var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 10;

// 螺旋层级范围
var SPIRAL_MIN = 1;
var SPIRAL_MAX = 6;

// 生成模式（含兼容别名；归一后统一为 canonical 值）
var VALID_MODES = ['single-kp', 'multi-kp', 'comprehensive', 'adaptive'];
var MODE_ALIAS = {
  'single': 'single-kp', 'single-kp': 'single-kp', 'kp': 'single-kp',
  'multi': 'multi-kp', 'multi-kp': 'multi-kp',
  'comprehensive': 'comprehensive', 'zonghe': 'comprehensive',
  'adaptive': 'adaptive', 'adaptive-kp': 'adaptive'
};

/**
 * 命中单数/复数/旧名/新名任一来源的知识点 ID 列表（唯一 KP 语义：数组）。
 * 优先级：knowledgePointIds > knowledgePoints > knowledgePointId > kp。
 * @param {Object} request
 * @returns {string[]} 知识点 ID 数组（可为空，表示按 subject+grade 兜底/综合）
 */
function resolveKnowledgePointIds(request) {
  if (!request || typeof request !== 'object') return [];
  if (Array.isArray(request.knowledgePointIds) && request.knowledgePointIds.length) {
    return request.knowledgePointIds.filter(function (x) { return typeof x === 'string' && x; });
  }
  if (Array.isArray(request.knowledgePoints) && request.knowledgePoints.length) {
    return request.knowledgePoints.filter(function (x) { return typeof x === 'string' && x; });
  }
  if (typeof request.knowledgePointId === 'string' && request.knowledgePointId) return [request.knowledgePointId];
  if (typeof request.kp === 'string' && request.kp) return [request.kp];
  return [];
}

/**
 * 归一化请求为规范形状（内部流程唯一语义）。
 *  - knowledgePointIds 权威化（删除单数 knowledgePointId/knowledgePoints/kp，禁止双语义漂移）
 *  - volume ↔ count：volume 为题量别名，count 缺省时由 volume 补足
 *  - spiral_level → spiralLevel（旧参数兼容）
 * 其余字段透传。
 * @param {Object} request
 * @returns {Object} 规范请求
 */
function normalizeRequest(request) {
  request = request || {};
  var out = Object.assign({}, request);
  out.knowledgePointIds = resolveKnowledgePointIds(request);
  delete out.knowledgePointId;
  delete out.knowledgePoints;
  delete out.kp;
  if (out.count == null && typeof out.volume === 'number' && out.volume >= 1) {
    out.count = Math.floor(out.volume);
  }
  if (out.spiralLevel == null && out.spiral_level != null) out.spiralLevel = out.spiral_level;
  if (out.mode != null && MODE_ALIAS[String(out.mode)] != null) out.mode = MODE_ALIAS[String(out.mode)];
  return out;
}

function normalizeLegacyParams(params) {
  var out = {};
  // 旧 UI 参数映射
  if (params.subject != null) out.subject = params.subject;
  if (params.grade != null) out.grade = params.grade;
  if (params.count != null) out.count = Math.max(1, Math.floor(params.count));
  else if (params.volume != null) out.count = Math.max(1, Math.floor(params.volume));
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

  // 核心输入：knowledgePointIds 数组（旧 knowledgePointId/knowledgePoints 自动归一）
  var kpIds = resolveKnowledgePointIds(req);
  var hasSubjectGrade = req.subject && req.grade != null;
  if (!kpIds.length && !hasSubjectGrade) {
    errors.push('缺少 knowledgePointIds（或旧 knowledgePointId / knowledgePoints / subject+grade）');
  }
  if (kpIds.length) kpIds.forEach(function (id) {
    if (typeof id !== 'string' || !id) errors.push('knowledgePointIds 元素必须是非空字符串');
  });

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

  // mode：若提供必须合法（含别名）
  if (req.mode != null && MODE_ALIAS[String(req.mode)] == null) {
    errors.push('非法 mode: ' + req.mode + '（应为 ' + VALID_MODES.join('/') + '）');
  }

  // difficulty 必须在 1-10
  if (req.difficulty != null) {
    var df = req.difficulty;
    if (typeof df !== 'number' || df < DIFFICULTY_MIN || df > DIFFICULTY_MAX || df % 1 !== 0) {
      errors.push('difficulty 必须是 1-10 的整数');
    }
  }

  // targetDifficulty 必须在 1-10（旧字段兼容）
  if (req.targetDifficulty != null) {
    var td = req.targetDifficulty;
    if (typeof td !== 'number' || td < DIFFICULTY_MIN || td > DIFFICULTY_MAX || td % 1 !== 0) {
      errors.push('targetDifficulty 必须是 1-10 的整数');
    }
  }

  // count 必须 >=1（volume 为别名）
  var cval = req.count != null ? req.count : req.volume;
  if (cval != null) {
    var c = cval;
    if (typeof c !== 'number' || c < 1 || c % 1 !== 0) {
      errors.push('count 必须是 >=1 的整数');
    }
  }

  // spiralLevel 必须在 1-6
  if (req.spiralLevel != null || req.spiral_level != null) {
    var sl = req.spiralLevel != null ? req.spiralLevel : req.spiral_level;
    if (typeof sl !== 'number' || sl < SPIRAL_MIN || sl > SPIRAL_MAX || sl % 1 !== 0) {
      errors.push('spiralLevel 必须是 1-6 的整数');
    }
  }

  // unitId：可选，必须字符串
  if (req.unitId != null && typeof req.unitId !== 'string') {
    errors.push('unitId 必须是字符串');
  }

  // combine：可选，必须布尔
  if (req.combine != null && typeof req.combine !== 'boolean') {
    errors.push('combine 必须是布尔值');
  }

  // previousGenerationId：可选，必须字符串
  if (req.previousGenerationId != null && typeof req.previousGenerationId !== 'string') {
    errors.push('previousGenerationId 必须是字符串');
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
  SPIRAL_MIN: SPIRAL_MIN,
  SPIRAL_MAX: SPIRAL_MAX,
  VALID_MODES: VALID_MODES,
  MODE_ALIAS: MODE_ALIAS,
  resolveKnowledgePointIds: resolveKnowledgePointIds,
  normalizeRequest: normalizeRequest,
  normalizeLegacyParams: normalizeLegacyParams,
  validateRequest: validateRequest,
  createRequest: createRequest,
  createFromLegacyUI: createFromLegacyUI,
  isLegacyRequest: isLegacyRequest
};