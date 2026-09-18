'use strict';
/**
 * shared/knowledge/schema/manifest-schema.js — Manifest Schema 契约（~§42 schema/manifest-schema.js）
 */
var COUNTS = ['knowledgePoints', 'relations', 'mappings', 'units'];
var ID_RULES = ['stable', 'generatedOnce', 'runtimePositionIndependent'];

/** @returns {string[]} 校验错误列表（空 = 通过） */
function validateManifest(m) {
  var errs = [];
  if (!m || typeof m !== 'object') return ['Manifest 非对象'];
  if (m.schemaVersion !== '1.0.0') errs.push('schemaVersion 非法: ' + m.schemaVersion);
  if (!/^math-v\d+\.\d+\.\d+$/.test(m.catalogVersion || '')) errs.push('catalogVersion 非法: ' + m.catalogVersion);
  COUNTS.forEach(function (k) { if (typeof (m.counts || {})[k] !== 'number') errs.push('counts.' + k + ' 缺失'); });
  ID_RULES.forEach(function (k) { if (typeof (m.idRules || {})[k] !== 'boolean') errs.push('idRules.' + k + ' 缺失'); });
  if (m.integrity && typeof m.integrity.rootHash !== 'string') errs.push('integrity.rootHash 缺失');
  return errs;
}

module.exports = { schemaVersion: '1.0.0', countKeys: COUNTS, idRuleKeys: ID_RULES, validate: validateManifest };