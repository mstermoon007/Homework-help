/**
 * shared/generation/adapters/knowledge-graph-service.adapter.js
 * 知识图谱服务适配器 — 聚合 knowledge-bank.js + catalog-utils.js + module-catalog.js
 *
 * @implements KnowledgeGraphService (services/knowledge-graph-service.js)
 * 适配器不修改原模块，仅做转发。
 */
(function (global) {
  'use strict';

  // ---------- 内部模块获取 (仅转发，不修改原模块) ----------
  function dep(name, key) {
    if (typeof window !== 'undefined' && global[key]) return global[key];
    if (typeof require === 'function') {
      try { return require(name); } catch (e) { /* ignore */ }
    }
    return null;
  }

  function getKnowledgeBank() { return dep('../../knowledge-bank.js', 'KnowledgeBank'); }
  function getCatalogUtils() { return dep('../../catalog-utils.js', 'CatalogUtils'); }
  function getModuleCatalog() { return dep('../../module-catalog.js', 'MODULE_CATALOG'); }

  // ---------- KnowledgeGraphService 接口实现 (转发) ----------

  function getKnowledgePoint(kpId) {
    var KB = getKnowledgeBank();
    if (!KB || !kpId) return null;
    // KnowledgeBank 中按知识点 Id 查找（数学/语文/英语按科目前缀）
    var subject = String(kpId.indexOf('cn-') === 0 ? 'cn' : kpId.indexOf('en-') === 0 ? 'en' : 'math');
    var entries = (KB.getEntries && KB.getEntries(subject)) || [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === kpId) return entries[i];
    }
    return null;
  }

  function getModule(moduleId) {
    var MC = getModuleCatalog();
    return MC && MC.byId ? MC.byId(moduleId) : null;
  }

  function getQuestionTypesForKP(kpId) {
    var CU = getCatalogUtils();
    // catalog-utils 通过 window.KnowledgeBank 封装，但同样词表级方法可用
    if (CU && typeof CU.getKPEntries === 'function' && typeof window !== 'undefined') {
      var entries = CU.getKPEntries('math'); // 只读列表，不过滤科目
      var kp = entries.find(function (e) { return e.id === kpId; });
      if (kp) return [{ id: kp.type || 'oral', name: kp.type, label: kp.name || kp.type }];
    }
    // 兜底：从 KnowledgeBank 读取
    var KBD = getKnowledgeBank();
    var kbEntries = KBD && KBD.getEntries && KBD.getEntries('math') || [];
    for (var i = 0; i < kbEntries.length; i++) {
      if (kbEntries[i].id === kpId) return [{ id: kbEntries[i].type, name: kbEntries[i].type, label: kbEntries[i].name || kbEntries[i].type }];
    }
    return [];
  }

  function getModuleQuestionTypes(moduleId) {
    var MC = getModuleCatalog();
    var mod = getModule(moduleId) || {};
    return mod.questionTypes || [];
  }

  function buildPracticeLink(kpId) {
    var KBD = getKnowledgeBank();
    var kp = getKnowledgePoint(kpId) || {};
    return 'practice.html?knowledgePointId=' + encodeURIComponent(kpId) + '&grade=' + (kp.grade || '');
  }

  function renderModuleCard(moduleId) {
    var MC = getModuleCatalog();
    var mod = MC && MC.byId ? MC.byId(moduleId) : null;
    if (!mod) return '<div class="card">模块未找到</div>';
    return '<div class="card"><strong>' + (mod.name || '') + '</strong><small>' + (mod.id || '') + '</small></div>';
  }

  // ---------- 冻结 API ----------
  var Adapter = Object.freeze({
    getKnowledgePoint: getKnowledgePoint,
    getModule: getModule,
    getQuestionTypesForKP: getQuestionTypesForKP,
    getModuleQuestionTypes: getModuleQuestionTypes,
    buildPracticeLink: buildPracticeLink,
    renderModuleCard: renderModuleCard
  });

  global.KnowledgeGraphAdapter = Adapter;
  if (global.App && typeof global.App === 'object') global.App.KnowledgeGraphAdapter = Adapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = Adapter;

})(typeof window !== 'undefined' ? window : global);
