// @ts-check
/**
 * shared/knowledge/runtime/knowledge-api.js — 知识库唯一公开入口（挂 App.KNOWLEDGE）
 *
 * 这是 KBL 运行时对外的“单入口”。所有查询必须经由此处（方案 §19/§20/§21）：
 *   get / byGrade / byBook / byUnit / selectable / canGenerate / searchByName / unit / relationsFor / stats
 * 白名单见 knowledge-contract.js -> publicApi。超出白名单的方法调用返回 undefined。
 *
 * 查询实现委托给内部模块：
 *   knowledge-query（get/byGrade/byBook/byUnit/selectable/searchByName/unit/stats）
 *   knowledge-policy（canGenerate 权限裁决）
 *   knowledge-relation（relationsFor）
 * 业务层不得直接 require 内部模块；唯一公开入口 = App.KNOWLEDGE。
 *
 * 加载顺序（页面/bundle）：knowledge-contract → knowledge-loader →
 * knowledge-relation → knowledge-policy → knowledge-index → knowledge-query → knowledge-api
 */
(function (global) {
  'use strict';

  var CRT = (global.App && global.App.KNOWLEDGE_CONTRACT) || (typeof module !== 'undefined' ? require('./knowledge-contract.js') : null);
  var Loader = (global.App && global.App.KNOWLEDGE_LOADER) || (typeof module !== 'undefined' ? require('./knowledge-loader.js') : null);
  var Relation = (global.App && global.App.KNOWLEDGE_RELATION) || (typeof module !== 'undefined' ? require('./knowledge-relation.js') : null);
  var Policy = (global.App && global.App.KNOWLEDGE_POLICY) || (typeof module !== 'undefined' ? require('./knowledge-policy.js') : null);
  var Query = (global.App && global.App.KNOWLEDGE_QUERY) || (typeof module !== 'undefined' ? require('./knowledge-query.js') : null);
  if (!CRT) throw new Error('knowledge-api: 缺少 App.KNOWLEDGE_CONTRACT');
  if (!Loader) throw new Error('knowledge-api: 缺少 App.KNOWLEDGE_LOADER');
  if (!Query) throw new Error('knowledge-api: 缺少 App.KNOWLEDGE_QUERY');

  function canGenerate(kpId, questionType) {
    var map = {};
    Loader.loadSync().ksps.forEach(function (k) { map[k.knowledgeId] = k; });
    var kp = map[kpId];
    if (!kp) return { allowed: false, reason: 'unknown-knowledge', permission: null };
    if (!Policy.isSelectable(kp)) return { allowed: false, reason: 'not-selectable', permission: null };
    return Policy.canUseQuestionType(kpId, questionType);
  }

  var KNOWLEDGE = {
    get: Query.get,
    byGrade: Query.byGrade,
    byBook: Query.byBook,
    byUnit: Query.byUnit,
    selectable: Query.selectable,
    canGenerate: canGenerate,
    searchByName: Query.searchByName,
    unit: Query.unit,
    relationsFor: function (id) { return Relation.relationsFor(id); },
    stats: Query.stats
  };

  // 白名单对齐：知识契约定义 Public API 顺序，此处仅暴露白名单内方法
  var exposed = {};
  CRT.publicApi.forEach(function (name) {
    if (typeof KNOWLEDGE[name] === 'function') exposed[name] = KNOWLEDGE[name];
  });

  global.App = global.App || {};
  global.App.KNOWLEDGE = exposed;

  if (typeof module !== 'undefined' && module.exports) module.exports = exposed;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));