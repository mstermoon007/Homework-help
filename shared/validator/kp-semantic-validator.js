'use strict';

/**
 * shared/validator/kp-semantic-validator.js — P0-05 KP 语义验证器
 *
 * 验证生成的 SemanticQuestion 是否符合 Canonical KP 的语义约束：
 * 1. KP Identity   — question.knowledgePointIds 与 Plan 一致
 * 2. Question Type — question.type 在 KP 允许范围
 * 3. Operation     — 题目运算与 KP operation 一致
 * 4. Numeric       — numberRange 在 KP numeric.range 内
 * 5. Structure     — maxSteps/structure 符合 KP 约束
 * 6. Content       — factualContent / graphicType 语义必须出现
 * 7. Composite     — combine=true 时多 KP 必须同时体现
 *
 * 复用现有 Validator Pipeline：作为 Layer 2 步骤插入。
 */

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;
var KnowledgePoint = require('../knowledge-point.js');
var Ontology = require('../knowledge-ontology.js');

/**
 * 获取 KP 的规范语义约束
 */
function getKpConstraints(kpId) {
  var kp = KnowledgePoint.get(kpId);
  if (!kp) return null;
  var canonical = Ontology.normalize(kp);
  
  // 获取算术语义运算
  var arithSem = null;
  try { arithSem = require('../generator/core/kp-arithmetic-semantics.js').resolveArithmeticSemantics(kp); } catch (e) {}
  var complexSem = null;
  try { complexSem = require('../generator/core/kp-complex-semantics.js').resolveComplexSemantics(kp); } catch (e) {}
  
  var operation = null;
  if (arithSem && arithSem.operators) operation = arithSem.operators;
  else if (complexSem && complexSem.operators) operation = complexSem.operators;
  else operation = canonical.operation || (canonical.constraints && canonical.constraints.operation) || null;
  
  return {
    id: canonical.id,
    category: canonical.category || kp.legacy?.category,
    legacyType: canonical.source?.legacyType || kp.legacy?.legacyType,
    numericRange: canonical.numeric?.range || null,
    structure: canonical.structure || {},
    generationCapabilities: canonical.generation?.capabilities || [],
    presentationQuestionTypes: (canonical.presentation?.questionTypes || []).map(function(q){ return q.type; }),
    factualContent: canonical.factualContent || null,
    graphicType: canonical.graphicType || null,
    operation: operation,
    spiral: canonical.spiral || {}
  };
}

/**
 * 1. KP Identity: question.knowledgePointIds 与 Plan 一致
 */
function checkKpIdentity(sq, plan) {
  var errors = [];
  var planKpIds = plan?.knowledgePointIds || (plan?.knowledgePointId ? [plan.knowledgePointId] : []);
  var sqKpIds = sq.knowledgePointIds || (sq.knowledgePointId ? [sq.knowledgePointId] : []);
  
  if (!sqKpIds.length) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_IDENTITY, 'knowledgePointIds', '题目缺失 knowledgePointIds', SEVERITY.ERROR, { planKpIds: planKpIds }));
  } else {
    var mismatch = sqKpIds.some(function(id) { return planKpIds.indexOf(id) === -1; });
    if (mismatch) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_IDENTITY, 'knowledgePointIds', '题目 KP 与 Plan 不一致: ' + sqKpIds.join(',') + ' vs ' + planKpIds.join(','), SEVERITY.ERROR, { planKpIds: planKpIds, sqKpIds: sqKpIds }));
    }
  }
  return errors;
}

/**
 * 2. Question Type: question.type 在 KP 允许范围
 */
function checkQuestionType(sq, kpConstraints) {
  var errors = [];
  if (!kpConstraints) return errors;
  
  var allowed = kpConstraints.presentationQuestionTypes || [];
  var supported = kpConstraints.generationCapabilities.map(function(c){ return c.id; }) || [];
  var allAllowed = Array.from(new Set(allowed.concat(supported)));
  
  if (allAllowed.length && sq.questionTypeId && allAllowed.indexOf(sq.questionTypeId) === -1) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_QUESTION_TYPE, 'questionTypeId', '题型 ' + sq.questionTypeId + ' 不在 KP 允许范围内: ' + allAllowed.join(','), SEVERITY.ERROR, { allowed: allAllowed, actual: sq.questionTypeId }));
  }
  return errors;
}

/**
 * 3. Operation: 题目运算与 KP operation 一致
 */
function checkOperation(sq, kpConstraints) {
  var errors = [];
  if (!kpConstraints) return errors;
  
  var kpOp = kpConstraints.operation;
  if (!kpOp) return errors; // 无显式 operation 约束时跳过
  
  var sqOp = sq.data?.operation;
  if (!sqOp) return errors; // 题目无运算信息时跳过
  
  // 归一化比较：KP operation 可能是 ['+','−'] 或 ['add','sub']；题目可能是 ['+'] 或 'add' 或 'mixed'
  var kpOps = Array.isArray(kpOp) ? kpOp : [kpOp];
  var sqOps = Array.isArray(sqOp) ? sqOp : [sqOp];
  
  // 归一化 KP 操作集
  var kpOpsNorm = kpOps.map(normalizeOp);
  
  var mismatch = sqOps.some(function(op) {
    var normalized = normalizeOp(op);
    // 'mixed' 表示混合运算，当 KP 支持多种运算时视为合法
    if (normalized === 'mixed' && kpOps.length > 1) return false;
    return !kpOpsNorm.some(function(kop) { return kop === normalized; });
  });
  
  if (mismatch) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_OPERATION, 'operation', '题目运算 ' + JSON.stringify(sqOps) + ' 与 KP operation ' + JSON.stringify(kpOps) + ' 不一致', SEVERITY.ERROR, { kpOperation: kpOps, questionOperation: sqOps }));
  }
  return errors;
}

function normalizeOp(op) {
  if (op === '+' || op === 'add') return 'add';
  if (op === '−' || op === '-' || op === 'sub') return 'sub';
  if (op === '×' || op === '*' || op === 'mult') return 'mult';
  if (op === '÷' || op === '/' || op === 'div') return 'div';
  return op;
}

/**
 * 4. Numeric Constraint: numberRange 在 KP numeric.range 内
 */
function checkNumeric(sq, kpConstraints) {
  var errors = [];
  if (!kpConstraints?.numericRange) return errors;
  
  var kpRange = kpConstraints.numericRange;
  if (kpRange.min == null && kpRange.max == null) return errors; // 无显式范围约束时跳过
  
  var sqRange = sq.numberRange;
  if (!sqRange || typeof sqRange.min !== 'number' || typeof sqRange.max !== 'number') return errors;
  
  var kpMin = kpRange.min != null ? kpRange.min : -Infinity;
  var kpMax = kpRange.max != null ? kpRange.max : Infinity;
  
  if (sqRange.min < kpMin || sqRange.max > kpMax) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_NUMERIC, 'numberRange', '题目数值范围 [' + sqRange.min + ',' + sqRange.max + '] 超出 KP 约束 [' + kpMin + ',' + kpMax + ']', SEVERITY.ERROR, { kpRange: [kpMin, kpMax], sqRange: [sqRange.min, sqRange.max] }));
  }
  return errors;
}

/**
 * 5. Structure: maxSteps/structure 符合 KP 约束
 */
function checkStructure(sq, kpConstraints) {
  var errors = [];
  if (!kpConstraints) return errors;
  
  var kpStruct = kpConstraints.structure || {};
  var sqStruct = sq.constraints || {};
  
  // maxSteps 检查
  if (kpStruct.maxSteps != null && sqStruct.maxSteps != null) {
    if (sqStruct.maxSteps > kpStruct.maxSteps) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'maxSteps', '题目 maxSteps ' + sqStruct.maxSteps + ' 超过 KP 限制 ' + kpStruct.maxSteps, SEVERITY.ERROR, { kpMaxSteps: kpStruct.maxSteps, sqMaxSteps: sqStruct.maxSteps }));
    }
  }
  
  // allowBracket / allowMultDiv 检查（KP 禁止时题目不应允许）
  if (kpStruct.allowBracket === false && sqStruct.allowBracket === true) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'allowBracket', 'KP 禁止括号但题目允许括号', SEVERITY.ERROR, {}));
  }
  if (kpStruct.allowMultDiv === false && sqStruct.allowMultDiv === true) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'allowMultDiv', 'KP 禁止乘除但题目允许乘除', SEVERITY.ERROR, {}));
  }
  
  // exactSteps 检查
  if (sqStruct.exactSteps != null && kpStruct.maxSteps != null) {
    if (sqStruct.exactSteps > kpStruct.maxSteps) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'exactSteps', '题目 exactSteps ' + sqStruct.exactSteps + ' 超过 KP maxSteps ' + kpStruct.maxSteps, SEVERITY.ERROR, {}));
    }
  }
  return errors;
}

/**
 * 6. Content: factualContent / graphicType 语义必须出现
 */
function checkContent(sq, kpConstraints) {
  var errors = [];
  var warnings = [];
  if (!kpConstraints) return { errors: errors, warnings: warnings };
  
  // factualContent 检查：如果 KP 有 factualContent，题目应包含相关语义
  var factual = kpConstraints.factualContent;
  if (factual) {
    // factualContent 可能是对象或字符串
    var factualKeys = typeof factual === 'object' ? Object.keys(factual) : [factual];
    var found = false;
    
    // 检查 prompt / data.graphic / data.operation / data.shapeName 等字段
    var searchable = [
      sq.prompt,
      sq.data?.graphic?.type,
      sq.data?.graphic?.subtype,
      sq.data?.operation,
      sq.data?.shapeName,
      sq.data?.targetShape,
      sq.data?.feature,
      sq.data?.kind,
      sq.data?.template
    ].filter(Boolean).join(' ').toLowerCase();
    
    factualKeys.forEach(function(key) {
      if (searchable.indexOf(key.toLowerCase()) !== -1) found = true;
    });
    
    if (!found) {
      // 仅警告，不阻断（factualContent 可能较宽泛）
      warnings.push({ code: 'KP_SEMANTIC_CONTENT_MISSING', field: 'content', message: '题目未体现 KP factualContent: ' + factualKeys.join(','), severity: 'WARN' });
    }
  }
  
  // graphicType 检查：KP 有 graphicType 时，题目 graphic.type 应匹配
  var graphicType = kpConstraints.graphicType;
  if (graphicType && sq.data?.graphic?.type && sq.data.graphic.type !== graphicType) {
    warnings.push({ code: 'KP_SEMANTIC_GRAPHIC_MISMATCH', field: 'graphic', message: '题目 graphic.type ' + sq.data.graphic.type + ' 与 KP graphicType ' + graphicType + ' 不符', severity: 'WARN' });
  }
  
  return { errors: errors, warnings: warnings };
}

/**
 * 7. Composite: combine=true 时多 KP 必须同时体现
 */
function checkComposite(sq, plan, kpConstraintsList) {
  var errors = [];
  if (!plan?.combine || !plan?.knowledgePointIds || plan.knowledgePointIds.length <= 1) return errors;
  
  var kpIds = plan.knowledgePointIds;
  var covered = kpIds.filter(function(id) {
    // 检查题目是否体现了该 KP 的语义
    var kp = KnowledgePoint.get(id);
    if (!kp) return false;
    var canonical = Ontology.normalize(kp);
    var legacyType = canonical.source?.legacyType || kp.legacy?.legacyType;
    var category = canonical.category || kp.legacy?.category;
    
    // 简单启发式：检查 prompt/data 中是否出现 KP 特征
    var searchable = [sq.prompt, sq.data?.operation, sq.data?.graphic?.subtype, sq.data?.shapeName, sq.data?.kind, sq.data?.template].filter(Boolean).join(' ').toLowerCase();
    
    // 通过 legacyType/category/operation 特征匹配
    var features = [legacyType, category, canonical.operation, canonical.graphicType].filter(Boolean).join(' ').toLowerCase();
    return features.split(' ').some(function(f) { return f && searchable.indexOf(f) !== -1; });
  });
  
  if (covered.length < kpIds.length) {
    var missing = kpIds.filter(function(id) { return covered.indexOf(id) === -1; });
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_COMPOSITE, 'composite', 'Combine 模式下题目未同时体现全部 KP，缺失: ' + missing.join(','), SEVERITY.ERROR, { requiredKpIds: kpIds, coveredKpIds: covered, missingKpIds: missing }));
  }
  return errors;
}

/**
 * 主验证入口
 * @param {Object} sq SemanticQuestion
 * @param {Object} context { plan: QuestionPlan, kpConstraints: Object }
 */
function validateKpSemantics(sq, context) {
  context = context || {};
  var plan = context.plan;
  var kpId = context.kpId || (plan && (plan.knowledgePointIds?.[0] || plan.knowledgePointId));
  var kpConstraints = context.kpConstraints || (kpId ? getKpConstraints(kpId) : null);
  
  var allErrors = [];
  var allWarnings = [];
  var allInfo = [];
  
  // 1. KP Identity
  allErrors.push.apply(allErrors, checkKpIdentity(sq, plan));
  
  // 2. Question Type
  allErrors.push.apply(allErrors, checkQuestionType(sq, kpConstraints));
  
  // 3. Operation
  allErrors.push.apply(allErrors, checkOperation(sq, kpConstraints));
  
  // 4. Numeric
  allErrors.push.apply(allErrors, checkNumeric(sq, kpConstraints));
  
  // 5. Structure
  allErrors.push.apply(allErrors, checkStructure(sq, kpConstraints));
  
  // 6. Content
  var contentResult = checkContent(sq, kpConstraints);
  allErrors.push.apply(allErrors, contentResult.errors);
  allWarnings.push.apply(allWarnings, contentResult.warnings);
  
  // 7. Composite
  if (context.kpConstraintsList) {
    allErrors.push.apply(allErrors, checkComposite(sq, plan, context.kpConstraintsList));
  }
  
  var valid = allErrors.length === 0;
  var score = valid ? 1 : Math.max(0, 1 - allErrors.length / 7);
  
  return {
    valid: valid,
    errors: allErrors,
    warnings: allWarnings,
    info: allInfo,
    score: score,
    checks: {
      kpIdentity: checkKpIdentity(sq, plan).length === 0 ? 'pass' : 'fail',
      questionType: checkQuestionType(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      operation: checkOperation(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      numeric: checkNumeric(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      structure: checkStructure(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      content: contentResult.errors.length === 0 ? 'pass' : 'fail',
      composite: (context.kpConstraintsList ? checkComposite(sq, plan, context.kpConstraintsList).length === 0 : 'skipped')
    }
  };
}

module.exports = {
  validateKpSemantics: validateKpSemantics,
  getKpConstraints: getKpConstraints,
  checkKpIdentity: checkKpIdentity,
  checkQuestionType: checkQuestionType,
  checkOperation: checkOperation,
  checkNumeric: checkNumeric,
  checkStructure: checkStructure,
  checkContent: checkContent,
  checkComposite: checkComposite
};