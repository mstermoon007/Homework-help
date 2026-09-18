// @ts-check
/**
 * shared/knowledge/runtime/knowledge-policy.js — 知识与生成策略层（挂 App.KNOWLEDGE_POLICY）
 *
 * 不持有难度权威（Difficulty Authority 在 shared/catalog/difficulty.js）：
 *   本层只裁决「能否出现 / 能否生成」两类问题。
 *
 * isSelectable            —— 发布态 + 非废弃（页面知识点选择器用）
 * canUseQuestionType      —— 依据 generation-contract 的 permission + 注册表权限渲染
 * isActive               —— 生命周期状态判定
 * degraded               —— permission=degrade 时降级信息（当前数据库中 forbid/degrade 恒无）
 */
(function (global) {
  'use strict';

  var CRT = (global.App && global.App.KNOWLEDGE_CONTRACT) || (typeof module !== 'undefined' ? require('./knowledge-contract.js') : null);
  var Loader = (global.App && global.App.KNOWLEDGE_LOADER) || (typeof module !== 'undefined' ? require('./knowledge-loader.js') : null);

  function kpMap() {
    var c = Loader.loadSync();
    var map = {};
    c.ksps.forEach(function (k) { map[k.knowledgeId] = k; });
    return map;
  }

  // 生命周期：published + active（历史 inactive 视为不可用）
  function isSelectable(kp) {
    if (!kp) return false;
    if (kp.publication !== 'published') return false;
    if (kp.status !== 'active') return false;
    return true;
  }

  function isActive(kp) { return isSelectable(kp); }

  // 权限渲染：mapping.permission ∈ {allow, forbid, degrade, missing}
  function canUseQuestionType(kpId, questionType) {
    var c = Loader.loadSync();
    var entry = null;
    c.mappingDoc.mappings.forEach(function (m) {
      if (m.knowledgeId === kpId && m.questionType === questionType) entry = m;
    });
    if (!entry) return { allowed: false, permission: 'missing', reason: '无映射', coefficient: null };
    var allowed = entry.permission === 'allow' || entry.permission === 'degrade';
    return {
      allowed: allowed,
      permission: entry.permission,
      reason: entry.permission === 'allow' ? 'registry-allow' : entry.permission === 'degrade' ? 'registry-degrade' : entry.permission === 'forbid' ? 'registry-forbid' : 'registry-missing',
      coefficient: entry.coefficient
    };
  }

  function mappingCounts() {
    var c = Loader.loadSync();
    var counts = { allow: 0, forbid: 0, degrade: 0, missing: 0 };
    c.mappingDoc.mappings.forEach(function (m) { counts[m.permission] = (counts[m.permission] || 0) + 1; });
    return counts;
  }

  var Policy = {
    isSelectable: isSelectable,
    isActive: isActive,
    canUseQuestionType: canUseQuestionType,
    mappingCounts: mappingCounts
  };

  global.App = global.App || {};
  global.App.KNOWLEDGE_POLICY = Policy;

  if (typeof module !== 'undefined' && module.exports) module.exports = Policy;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));