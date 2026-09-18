'use strict';
/**
 * shared/knowledge/schema/relation-schema.js — 知识关系 Schema 契约（~§42 schema/relation-schema.js）
 */
var RELATION_TYPES = ['prerequisite', 'successor', 'parent', 'child', 'same_family', 'related', 'cross_book', 'cross_grade', 'extension', 'review'];

/** @returns {string[]} 校验错误列表（空 = 通过） */
function validateRelation(r, idSet) {
  var errs = [];
  if (!r || typeof r !== 'object') return ['关系非对象'];
  if (!r.fromId || typeof r.fromId !== 'string') errs.push('关系缺 fromId');
  if (!r.toId || typeof r.toId !== 'string') errs.push('关系缺 toId');
  if (RELATION_TYPES.indexOf(r.relation) === -1) errs.push('非法关系类型: ' + r.relation + ' (' + r.fromId + '|' + r.toId + ')');
  if (r.fromId === r.toId) errs.push('自环关系: ' + r.fromId);
  if (idSet) {
    if (r.fromId && !idSet.has(r.fromId)) errs.push('关系源未知: ' + r.fromId);
    if (r.toId && !idSet.has(r.toId)) errs.push('关系目标未知: ' + r.toId);
  }
  return errs;
}

module.exports = { schemaVersion: '1.0.0', relationTypes: RELATION_TYPES, RELATION_TYPES: RELATION_TYPES, validate: validateRelation };