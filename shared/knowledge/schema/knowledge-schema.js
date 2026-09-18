'use strict';
/**
 * shared/knowledge/schema/knowledge-schema.js — 知识点 Schema 契约（~§42 schema/knowledge-schema.js）
 *
 * 规范单一事实来源：tools/kbl/validate.js 与运行时校验均引用本模块；
 * 任何字段/枚举调整必须先改这里。
 */
var ID_RE = /^(math|chinese|english)-g[1-6]-(up|down|mixed|advance|comprehensive)-u\d{2}-k\d{3}$/;
var UNIT_RE = /^(math|chinese|english)-g[1-6]-(up|down|mixed|advance|comprehensive)-u\d{2}$/;

var SCHEMA_VERSION = '1.0.0';

var PUBLICATION_TYPES = ['published', 'draft'];
var STATUS_TYPES = ['active', 'draft', 'deprecated', 'inactive'];
var SUBJECT_TYPES = ['math', 'chinese', 'english'];
var BOOK_TYPES = ['up', 'down', 'mixed', 'advance', 'comprehensive'];
var SEMANTIC_KEYS = ['family', 'concept', 'operations', 'representations', 'category', 'tags'];

var REQUIRED = ['knowledgeId', 'subject', 'grade', 'book', 'unitId', 'unitNo', 'knowledgeNo', 'unitName', 'module', 'name', 'semantic', 'publication', 'weight', 'status'];

function z2(n) { n = Number(n); return (n < 10 ? '0' : '') + n; }

/** @returns {string[]} 校验错误列表（空 = 通过） */
function validateKnowledgePoint(kp) {
  var errs = [];
  if (!kp || typeof kp !== 'object') return ['知识点非对象'];
  var id = kp.knowledgeId || '?';
  REQUIRED.forEach(function (f) { if (kp[f] === undefined || kp[f] === null) errs.push('缺字段 ' + f + ' @ ' + id); });
  if (!ID_RE.test(kp.knowledgeId || '')) errs.push('非法 ID: ' + id);
  if (!UNIT_RE.test(kp.unitId || '')) errs.push('非法 unitId: ' + id);
  if (kp.grade && kp.grade !== (kp.knowledgeId || '').split('-')[1]) errs.push('ID/grade 不一致: ' + id);
  if (kp.book && kp.book !== (kp.knowledgeId || '').split('-')[2]) errs.push('ID/book 不一致: ' + id);
  if (SUBJECT_TYPES.indexOf(kp.subject) === -1) errs.push('学科非法: ' + kp.subject + ' @ ' + id);
  if (kp.unitNo != null && z2(kp.unitNo) !== ((kp.unitId || '').split('-')[3] || '').slice(1)) errs.push('unitNo 与 unitId 不一致: ' + id);
  if (kp.knowledgeNo != null && ('00' + kp.knowledgeNo).slice(-3) !== ((kp.knowledgeId || '').split('-')[4] || '').slice(1)) errs.push('knowledgeNo 与 ID 不一致: ' + id);
  var s = kp.semantic;
  if (s && typeof s === 'object') {
    SEMANTIC_KEYS.forEach(function (f) { if (s[f] === undefined) errs.push('semantic 缺 ' + f + ' @ ' + id); });
    if (!Array.isArray(s.operations) || !Array.isArray(s.representations) || !Array.isArray(s.tags)) errs.push('semantic 数组非法 @ ' + id);
  } else if (kp.semantic !== undefined) {
    errs.push('semantic 非对象 @ ' + id);
  }
  if (PUBLICATION_TYPES.indexOf(kp.publication) === -1) errs.push('非法 publication: ' + kp.publication + ' @ ' + id);
  if (STATUS_TYPES.indexOf(kp.status) === -1) errs.push('非法 status: ' + kp.status + ' @ ' + id);
  if (kp.publication === 'published' && kp.status === 'deprecated') errs.push('已发布但已废弃矛盾: ' + id);
  if (typeof kp.weight !== 'number' || !isFinite(kp.weight) || kp.weight <= 0) errs.push('weight 非法: ' + id);
  return errs;
}

module.exports = {
  schemaVersion: SCHEMA_VERSION,
  ID_RE: ID_RE,
  UNIT_RE: UNIT_RE,
  publicationTypes: PUBLICATION_TYPES,
  statusTypes: STATUS_TYPES,
  subjectTypes: SUBJECT_TYPES,
  bookTypes: BOOK_TYPES,
  semanticKeys: SEMANTIC_KEYS,
  required: REQUIRED,
  validate: validateKnowledgePoint
};