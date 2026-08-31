/**
 * shared/validator/kp-validator.js — M5-R05 Knowledge Point Validator
 *
 * 检查题目与知识点一致性：
 *   - knowledgePoint.id 是否存在于 KnowledgeBank
 *   - Generator 声明的知识点与题目知识点是否一致
 *   - operation 是否属于知识点允许操作
 *   - format/questionType 是否属于知识点允许题型
 *   - cognitiveLevel 是否在允许范围
 *   - context 是否允许
 *   - graphic.type 是否属于知识点允许呈现方式
 */
'use strict';

var Validator = require('./question-validator.js');
var KnowledgeBank = require('../knowledge-bank.js');
var Ontology = require('../knowledge-ontology.js');
var GenCap = require('../generator-capability-registry.js');

var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceString(v) { return v == null ? '' : String(v); }
function ensureArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }

/**
 * 获取知识点的规范信息
 * @param {string} kpId
 * @returns {Object|null} { id, operations, applicableQuestionTypes, contextDefault, cognitiveLevel, graphicTypes, ... }
 */
function getKPInfo(kpId) {
  if (!kpId) return null;
  var normalized = Ontology.normalize ? Ontology.normalize({ id: kpId }) : { id: kpId };
  var ops = (normalized.knowledge && normalized.knowledge.operations) || [];
  var types = (normalized.assessment && normalized.assessment.applicableQuestionTypes) || [];
  var context = (normalized.assessment && normalized.assessment.contextDefault) || 'standard';
  var cognitive = (normalized.difficulty && normalized.difficulty.cognitiveLevel) || '理解';
  return {
    id: kpId,
    operations: ops,
    applicableQuestionTypes: types,
    contextDefault: context,
    cognitiveLevel: cognitive,
    graphicTypes: normalized.generation && normalized.generation.graphicTypes || []
  };
}

/**
 * 验证单题的知识点一致性
 * @param {Object} sq SemanticQuestion
 * @param {Object} context { generatorId, generatorCapabilities }
 * @returns {Object} { valid, errors, warnings, info, score, checks }
 */
function validateKnowledgePoint(sq, context) {
  context = context || {};
  var errors = [];
  var warnings = [];
  var info = [];

  var kpId = sq.knowledgePoint;
  if (!kpId) {
    errors.push(createError(ERROR_CODES.KP_MISSING, 'knowledgePoint', '题目缺少 knowledgePoint 绑定', SEVERITY.ERROR));
    return { valid: false, errors: errors, warnings: warnings, info: info, score: 0, checks: { knowledgePoint: 'fail' } };
  }

  var kpInfo = getKPInfo(kpId);
  if (!kpInfo) {
    warnings.push(createError(ERROR_CODES.KP_MISMATCH, 'knowledgePoint', '知识点 ' + kpId + ' 未在 KnowledgeBank/本体中找到', SEVERITY.WARNING, { kpId: kpId }));
    // 不直接阻断，允许新 KP 先行接入
  } else {
    info.push({ code: 'KP_FOUND', field: 'knowledgePoint', message: '知识点存在: ' + kpId, severity: SEVERITY.INFO });

    // ① operation 检查（若题目声明了 operation）
    if (sq.question && sq.question.operation) {
      var op = coerceString(sq.question.operation);
      if (kpInfo.operations.length && kpInfo.operations.indexOf(op) === -1) {
        errors.push(createError(ERROR_CODES.KP_OPERATION_INVALID, 'question.operation', '操作 ' + op + ' 不在知识点 ' + kpId + ' 允许操作列表中', SEVERITY.ERROR, { operation: op, allowed: kpInfo.operations }));
      }
    }

    // ② questionType/format 检查
    var qType = sq.questionType || sq.type;
    if (qType && kpInfo.applicableQuestionTypes.length && kpInfo.applicableQuestionTypes.indexOf(qType) === -1) {
      errors.push(createError(ERROR_CODES.KP_FORMAT_INVALID, 'questionType', '题型 ' + qType + ' 不在知识点 ' + kpId + ' 允许题型列表中', SEVERITY.ERROR, { questionType: qType, allowed: kpInfo.applicableQuestionTypes }));
    }

    // ③ cognitiveLevel 检查
    if (sq.cognitiveLevel && kpInfo.cognitiveLevel) {
      // 简单检查：题目认知层级不应超过知识点定义的上限
      var levels = ['了解', '理解', '掌握', '运用'];
      var sqLevel = levels.indexOf(sq.cognitiveLevel);
      var kpLevel = levels.indexOf(kpInfo.cognitiveLevel);
      if (sqLevel !== -1 && kpLevel !== -1 && sqLevel > kpLevel) {
        warnings.push(createError(ERROR_CODES.KP_COGNITIVE_INVALID, 'cognitiveLevel', '题目认知层级(' + sq.cognitiveLevel + ') 超过知识点上限(' + kpInfo.cognitiveLevel + ')', SEVERITY.WARNING));
      }
    }

    // ④ context 检查
    if (sq.content && sq.content.context && kpInfo.contextDefault) {
      if (kpInfo.contextDefault !== 'all' && sq.content.context !== kpInfo.contextDefault) {
        info.push({ code: 'CONTEXT_MISMATCH', field: 'content.context', message: '题目 context(' + sq.content.context + ') 与知识点默认(' + kpInfo.contextDefault + ') 不一致', severity: SEVERITY.INFO });
      }
    }

    // ⑤ graphic.type 检查
    if (sq.graphic && sq.graphic.type && kpInfo.graphicTypes.length) {
      if (kpInfo.graphicTypes.indexOf(sq.graphic.type) === -1) {
        warnings.push(createError(ERROR_CODES.KP_GRAPHIC_INVALID, 'graphic.type', '图形类型 ' + sq.graphic.type + ' 不在知识点 ' + kpId + ' 允许呈现方式中', SEVERITY.WARNING, { graphicType: sq.graphic.type, allowed: kpInfo.graphicTypes }));
      }
    }
  }

  // ⑥ Generator 声明的知识点一致性（若 context 提供了 generatorCapabilities）
  if (context.generatorCapabilities) {
    var genKPs = context.generatorCapabilities.knowledgePoints || [];
    if (genKPs.length && genKPs.indexOf(kpId) === -1) {
      warnings.push(createError(ERROR_CODES.KP_MISMATCH, 'knowledgePoint', 'Generator ' + (context.generatorId || 'unknown') + ' 未声明知识点 ' + kpId, SEVERITY.WARNING, { generatorId: context.generatorId, declaredKPs: genKPs }));
    }
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0, checks: { knowledgePoint: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateKnowledgePoint: validateKnowledgePoint,
  getKPInfo: getKPInfo
};