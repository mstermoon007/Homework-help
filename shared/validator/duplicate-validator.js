/**
 * shared/validator/duplicate-validator.js — M5-R10 Duplicate Validator
 *
 * 题目去重：
 *   - 权威键：questionFingerprint（语义指纹 v2，buildQuestionFingerprint），
 *     与 retry-loop.filterDuplicateQuestions 同一键空间，同批/同练习/跨代去重均以此为准。
 *   - canonicalKey（题面数字/运算符归一）仅作诊断 info 字段，不再写入 seenKeys。
 *   - 同批次去重 / 同一练习去重 / 跨代去重（previousSeenKeys 由编排层传入）
 */
'use strict';

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceString(v) { return v == null ? '' : String(v); }
function sortObj(o) { return JSON.stringify(o, Object.keys(o).sort()); }

// 全角数字 → 半角
function toHalfWidth(str) {
  return String(str == null ? '' : str).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
}

// 提取操作数：优先 data.operands（语义层原始数字），缺省回退 prompt 解析
function extractOperands(sq) {
  var data = sq && sq.data;
  if (Array.isArray(data && data.operands) && data.operands.length) {
    return data.operands.map(function (n) { return parseInt(n, 10); }).filter(function (n) { return !isNaN(n); });
  }
  var half = toHalfWidth(sq.prompt || (sq.content && sq.content.prompt) || '');
  return (half.match(/\d+/g) || []).map(function (n) { return parseInt(n, 10); }).filter(function (n) { return !isNaN(n); });
}

// 提取运算符集合（排序归一，忽略顺序，同式异写同指纹）
// 族标签（题组级混合标记，不代表该题实例的运算符）必须剔除，
// 否则 data.operation='mixed' 时 10−6 与 10+6 被错误并为同一指纹。
var FAMILY_OP_LABELS = { mixed: true, combined: true, combine: true, mix: true, composite: true };
function extractOperators(sq) {
  var ops = [];
  var data = sq && sq.data;
  var opSeeds = [];
  if (data && data.operation) opSeeds.push(data.operation);
  if (Array.isArray(data && data.operators)) opSeeds.push.apply(opSeeds, data.operators);
  opSeeds.forEach(function (op) {
    if (typeof op === 'string') {
      var v = op.toLowerCase();
      if (!FAMILY_OP_LABELS[v]) ops.push(v);
    } else if (op && typeof op.symbol === 'string' && !FAMILY_OP_LABELS[String(op.symbol).toLowerCase()]) {
      ops.push(op.symbol);
    }
  });
  if (ops.length) return ops;

  var half = toHalfWidth(sq.prompt || (sq.content && sq.content.prompt) || '');
  return (half.replace(/[＋－]/g, function (c) { return c === '＋' ? '+' : '-'; })
    .match(/[+\-×÷*/−]/g) || []).map(function (o) {
    return o === '−' ? '-' : o;
  });
}

// 结构特征：steps / mode / operators 集合 / 括号等
function extractStructureKey(sq) {
  var parts = [];
  var data = sq && sq.data;
  var dp = sq && sq.difficultyParams;
  parts.push(coerceString(data && data.steps));
  parts.push(coerceString(data && data.mode));
  parts.push(coerceString(data && data.operation));
  if (Array.isArray(data && data.operators)) parts.push(coerceString(data.operators.join(',')));
  if (dp) {
    if (dp.steps != null) parts.push('s' + dp.steps);
    if (dp.allowBracket != null) parts.push('b' + (dp.allowBracket ? 1 : 0));
  }
  return parts.join('|');
}

/**
 * 统一题目指纹（预生成/存储用）：
 *   knowledgePoint | questionType | semantic(operation/operators) | numbers(排序操作数)
 *   | structure(steps/mode/operators) | context | format
 * 语义等价（同式异写、交换律等价）→ 同指纹；不同题目 → 不同指纹。
 */
// 题面内容指纹（归一化哈希）：用于无数值操作数的语义/应用题，
// 使其不同题面（不同统计收集对象、不同应用题叙述）产生不同指纹，
// 避免「同 KP 同题型」退化为同指纹导致去重误判为重复、容量塌缩为 1。
function promptHash(sq) {
  var p = coerceString(sq.prompt || (sq.content && sq.content.prompt) || '');
  p = p.replace(/\s+/g, '').replace(/[，。、？！：；,.?!:;（）()'"'""'']/g, '');
  var h = 5381;
  for (var i = 0; i < p.length; i++) h = ((h << 5) + h + p.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function buildQuestionFingerprint(sq) {
  var parts = [];
  parts.push('v2');
  parts.push(coerceString(sq.knowledgePoint));
  parts.push(coerceString(sq.questionType || sq.type));
  var ops = extractOperators(sq).sort();
  var operands = extractOperands(sq).sort(function (a, b) { return a - b; });
  parts.push(ops.join(','));
  parts.push(operands.join(','));
  parts.push(extractStructureKey(sq));
  parts.push(coerceString(sq.content && sq.content.context));
  parts.push(coerceString(sq.content && sq.content.format));
  // R6：语义型题型（应用/几何/判断/分类/开放/辨识）题面即为内容，原指纹忽略题面文字
  // 会导致不同设问/不同统计对象被误判为重复、容量塌缩为 1。补齐题面内容指纹。
  // 计算类题型（calc/fill 等）维持 operand 排序归一（同式异写=同指纹）语义，不附加题面哈希。
  var SEMANTIC_TYPES = { apply: 1, geometry: 1, judge: 1, classify: 1, open: 1, recognize: 1 };
  if (SEMANTIC_TYPES[sq.questionType || sq.type]) parts.push('ph:' + promptHash(sq));
  return parts.join('|');
}

function buildCanonicalKey(sq) {
  var parts = [];
  parts.push(coerceString(sq.knowledgePoint));
  parts.push(coerceString(sq.questionType || sq.type));
  parts.push(coerceString(sq.question && sq.question.operation));

  // 操作数（排序后）：全角→半角归一，parseInt 去前导零
  var half = toHalfWidth(sq.prompt || (sq.content && sq.content.prompt) || '');
  var nums = (half.match(/\d+/g) || []).map(function (n) { return parseInt(n, 10); }).sort(function (a, b) { return a - b; });
  parts.push(nums.join(','));

  // 结构特征（全角×÷−＋ 归一为半角，同式异写同指纹）
  var ops = (half.replace(/[＋－]/g, function (c) { return c === '＋' ? '+' : '-'; })
    .match(/[+\-×÷*/−]/g) || []).map(function (o) {
    return o === '−' ? '-' : o;
  }).sort().join('');
  parts.push(ops);

  // format/context
  parts.push(coerceString(sq.content && sq.content.context));
  parts.push(coerceString(sq.content && sq.content.format));

  return parts.join('|');
}

// 数学内容指纹：去掉 KP 维度，仅保留 题型|运算符|操作数(排序)|结构|context|format。
// 用于「同一份练习跨知识点」去重——不同 KP 产出同一道算术（如 3+2=）视为重复，
// 避免混合知识点练习中出现「同数学题换知识点」的视觉重复。
function buildMathFingerprint(sq) {
  var parts = buildQuestionFingerprint(sq).split('|');
  parts.splice(1, 1); // 去掉 knowledgePoint 维度
  return parts.join('|');
}

function validateDuplicate(sq, context) {
  var errors = [];
  var warnings = [];
  var info = [];

  context = context || {};
  var seenKeys = context.seenKeys || new Set();
  var mathSeenKeys = context.mathSeenKeys || null; // 应为 Map<mathFingerprint, knowledgePoint>
  // 权威去重键：语义指纹 v2（含 KP，用于跨代/跨练习去重，与 retry-loop 同一键空间）；
  // mathSeenKeys：数学内容指纹（去 KP）→ 仅当「不同知识点」产出同一道数学时才判重，
  // 避免混合知识点练习出现「同数学题换知识点」的视觉重复；同一知识点内部不去重（保留原 full-fp 行为）。
  var key = sq.questionFingerprint || buildQuestionFingerprint(sq);
  if (!sq.questionFingerprint) sq.questionFingerprint = key;
  var mathKey = buildMathFingerprint(sq);
  var qkp = sq.knowledgePoint || (sq.knowledgePointIds && sq.knowledgePointIds[0]) || '';
  var diagKey = buildCanonicalKey(sq);

  var isDup = false;
  var dupMsg = '';
  if (seenKeys.has(key)) {
    isDup = true;
    dupMsg = '重复题目(含知识点): ' + key;
  } else if (mathSeenKeys && mathSeenKeys.get(mathKey) !== undefined && mathSeenKeys.get(mathKey) !== qkp) {
    isDup = true;
    dupMsg = '跨知识点同数学重复: ' + mathKey;
  }

  if (isDup) {
    errors.push(createError(ERROR_CODES.DUPLICATE_QUESTION, 'questionFingerprint', dupMsg, SEVERITY.ERROR, { questionFingerprint: key, mathFingerprint: mathKey, canonicalKey: diagKey }));
  } else {
    seenKeys.add(key);
    if (mathSeenKeys) mathSeenKeys.set(mathKey, qkp);
    info.push({ code: 'UNIQUE', field: 'questionFingerprint', message: '题目唯一: ' + key, severity: 'INFO', canonicalKey: diagKey });
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    info: info,
    score: errors.length === 0 ? 1 : 0,
    checks: { duplicate: errors.length === 0 ? 'pass' : 'fail' },
    seenKeys: seenKeys // 返回更新后的集合供后续题目使用
  };
}

function validateBatchDuplicate(questions, context) {
  context = context || {};
  var seenKeys = context.seenKeys || new Set();
  var mathSeenKeys = context.mathSeenKeys || null; // 应为 Map<mathFingerprint, knowledgePoint>
  var results = questions.map(function (sq) {
    var key = sq.questionFingerprint || buildQuestionFingerprint(sq);
    if (!sq.questionFingerprint) sq.questionFingerprint = key;
    var mathKey = buildMathFingerprint(sq);
    var qkp = sq.knowledgePoint || (sq.knowledgePointIds && sq.knowledgePointIds[0]) || '';
    var diagKey = buildCanonicalKey(sq);
    var errors = [];
    var warnings = [];
    var isDup = seenKeys.has(key) || (mathSeenKeys && mathSeenKeys.get(mathKey) !== undefined && mathSeenKeys.get(mathKey) !== qkp);
    if (isDup) {
      errors.push(createError('DUPLICATE_QUESTION', 'questionFingerprint', '重复题目: ' + key, 'ERROR', { questionFingerprint: key, mathFingerprint: mathKey, canonicalKey: diagKey }));
    } else {
      seenKeys.add(key);
      if (mathSeenKeys) mathSeenKeys.set(mathKey, qkp);
    }
    return { valid: errors.length === 0, errors: errors, warnings: warnings, info: [], score: errors.length === 0 ? 1 : 0, checks: { duplicate: errors.length === 0 ? 'pass' : 'fail' } };
  });
  return { results: results, seenKeys: seenKeys };
}

module.exports = {
  validateDuplicate: validateDuplicate,
  validateBatchDuplicate: validateBatchDuplicate,
  buildCanonicalKey: buildCanonicalKey,
  buildQuestionFingerprint: buildQuestionFingerprint,
  buildMathFingerprint: buildMathFingerprint,
  extractOperands: extractOperands,
  extractOperators: extractOperators,
  extractStructureKey: extractStructureKey
};