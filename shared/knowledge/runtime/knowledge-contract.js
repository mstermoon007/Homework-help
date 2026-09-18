// @ts-check
/**
 * shared/knowledge/runtime/knowledge-contract.js — 知识库运行时契约（新增）
 *
 * 加载顺序：knowledge-contract → knowledge-loader → knowledge-relation →
 * knowledge-policy → knowledge-index → knowledge-query → knowledge-api（挂 App.KNOWLEDGE）。
 *
 * 本文件是 KBL 的对外契约唯一来源：
 *   PUBLIC_API（冻结）       —— Runtime 唯一允许暴露的公开方法白名单
 *   ID / UNIT_ID             —— 新标准（迁移一次生成后固化，禁止按数组位置推导）
 *   BOOKS / GRADES / PERM    —— 合法值域
 */
(function (global) {
  'use strict';

  var SCHEMA_VERSION = '1.0.0';

  var ID_REGEX = /^(math|chinese|english)-g[1-6]-(up|down|mixed|advance|comprehensive)-u\d{2}-k\d{3}$/;
  var UNIT_ID_REGEX = /^(math|chinese|english)-g[1-6]-(up|down|mixed|advance|comprehensive)-u\d{2}$/;

  var GRADES = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
  var BOOKS = ['up', 'down', 'mixed', 'advance', 'comprehensive'];
  var PERMISSIONS = ['allow', 'forbid', 'degrade', 'missing'];
  var RELATION_TYPES = ['prerequisite', 'successor', 'parent', 'child', 'same_family', 'related', 'cross_book', 'cross_grade', 'extension', 'review'];
  var STATUSES = ['active', 'draft', 'deprecated', 'inactive'];
  var PUBLICATIONS = ['published', 'draft'];

  // 唯一公开入口的方法白名单（Runtime 除白名单外不得向页面/引擎暴露其他方法）
  var PUBLIC_API = Object.freeze([
    'get', 'byGrade', 'byBook', 'byUnit', 'selectable',
    'canGenerate', 'searchByName', 'unit', 'relationsFor', 'stats'
  ].sort());

  function isKnowledgeId(id) { return typeof id === 'string' && ID_REGEX.test(id); }
  function isUnitId(id) { return typeof id === 'string' && UNIT_ID_REGEX.test(id); }

  var Contract = {
    schemaVersion: SCHEMA_VERSION,
    idRegex: ID_REGEX,
    unitIdRegex: UNIT_ID_REGEX,
    grades: Object.freeze(GRADES.slice()),
    books: Object.freeze(BOOKS.slice()),
    permissions: Object.freeze(PERMISSIONS.slice()),
    relationTypes: Object.freeze(RELATION_TYPES.slice()),
    statuses: Object.freeze(STATUSES.slice()),
    publications: Object.freeze(PUBLICATIONS.slice()),
    publicApi: PUBLIC_API,
    isKnowledgeId: isKnowledgeId,
    isUnitId: isUnitId
  };

  global.App = global.App || {};
  global.App.KNOWLEDGE_CONTRACT = Contract;

  if (typeof module !== 'undefined' && module.exports) module.exports = Contract;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));