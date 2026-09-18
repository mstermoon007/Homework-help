// @ts-check
/**
 * shared/knowledge/runtime/knowledge-query.js — 查询层（挂 App.KNOWLEDGE_QUERY）
 *
 * 在 Loader / Policy / Index 之上实现核心查询（方案 §19 的 knowledge-query）。
 * knowledge-api.js 是唯一公开入口，本模块为 runtime 内部实现：
 * 业务层不得直接 require 本文件，须经 App.KNOWLEDGE（KnowledgeAPI）。
 *
 * 加载顺序：knowledge-contract → knowledge-loader → knowledge-relation →
 * knowledge-policy → knowledge-index → knowledge-query → knowledge-api
 */
(function (global) {
  'use strict';

  var CRT = (global.App && global.App.KNOWLEDGE_CONTRACT) || (typeof module !== 'undefined' ? require('./knowledge-contract.js') : null);
  var Loader = (global.App && global.App.KNOWLEDGE_LOADER) || (typeof module !== 'undefined' ? require('./knowledge-loader.js') : null);
  var Policy = (global.App && global.App.KNOWLEDGE_POLICY) || (typeof module !== 'undefined' ? require('./knowledge-policy.js') : null);
  var Index = (global.App && global.App.KNOWLEDGE_INDEX) || (typeof module !== 'undefined' ? require('./knowledge-index.js') : null);
  if (!CRT) throw new Error('knowledge-query: 缺少 App.KNOWLEDGE_CONTRACT');
  if (!Loader) throw new Error('knowledge-query: 缺少 App.KNOWLEDGE_LOADER');

  var _kpMap = null; var _unitMap = null;
  function load() {
    var c = Loader.loadSync();
    if (!_kpMap) {
      _kpMap = {};
      c.ksps.forEach(function (k) { _kpMap[k.knowledgeId] = k; });
    }
    if (!_unitMap) {
      _unitMap = {};
      c.curriculum.units.forEach(function (u) { _unitMap[u.unitId] = u; });
    }
    return c;
  }
  function sortKps(list) {
    return list.slice().sort(function (a, b) {
      if (a.unitId !== b.unitId) return a.unitId < b.unitId ? -1 : 1;
      return a.knowledgeNo - b.knowledgeNo;
    });
  }

  function get(id) { load(); return _kpMap[id] || null; }

  function byGrade(grade) {
    var c = load();
    return sortKps(c.ksps.filter(function (k) { return k.grade === grade; }));
  }

  function byBook(grade, book) {
    var c = load();
    return sortKps(c.ksps.filter(function (k) { return k.grade === grade && k.book === book; }));
  }

  function byUnit(unitId) {
    var c = load();
    return sortKps(c.ksps.filter(function (k) { return k.unitId === unitId; }));
  }

  // 可选性查询：可选条件 grade/book/unitId 过滤 + Policy 可练性门禁（发布态 + active）
  function selectable(opts) {
    opts = opts || {};
    var c = load();
    var list = c.ksps.filter(function (k) {
      if (opts.grade && k.grade !== opts.grade) return false;
      if (opts.book && k.book !== opts.book) return false;
      if (opts.unitId && k.unitId !== opts.unitId) return false;
      if (opts.includeDeprecated) return true;
      return Policy.isSelectable(k);
    });
    return sortKps(list);
  }

  function searchByName(keyword) {
    var c = load();
    var q = String(keyword || '').toLowerCase();
    if (!q) return [];
    return sortKps(c.ksps.filter(function (k) {
      if (String(k.name || '').toLowerCase().indexOf(q) !== -1) return true;
      return (k.aliases || []).some(function (a) { return String(a).toLowerCase().indexOf(q) !== -1; });
    }));
  }

  function unit(unitId) {
    load();
    var u = _unitMap[unitId];
    if (!u) return null;
    var kps = byUnit(unitId);
    return { unitId: u.unitId, grade: u.grade, book: u.book, unitNo: u.unitNo, unitName: u.unitName, unitType: u.unitType, status: u.status, knowledgePointCount: kps.length, knowledgePoints: kps.map(function (k) { return k.knowledgeId; }) };
  }

  function stats() {
    var c = load();
    var byGrade = {}; var byBook = {};
    c.ksps.forEach(function (k) {
      byGrade[k.grade] = (byGrade[k.grade] || 0) + 1;
      byBook[k.grade + '-' + k.book] = (byBook[k.grade + '-' + k.book] || 0) + 1;
    });
    return {
      knowledgePoints: c.ksps.length,
      units: c.curriculum.units.length,
      relations: c.relations.length,
      mappings: c.mappingDoc.mappings.length,
      permissions: Policy.mappingCounts(),
      byGrade: byGrade,
      byBook: byBook,
      rootHash: c.rootHash,
      schemaVersion: c.manifest.schemaVersion
    };
  }

  var Query = {
    get: get,
    byGrade: byGrade,
    byBook: byBook,
    byUnit: byUnit,
    selectable: selectable,
    searchByName: searchByName,
    unit: unit,
    stats: stats
  };

  global.App = global.App || {};
  global.App.KNOWLEDGE_QUERY = Query;

  if (typeof module !== 'undefined' && module.exports) module.exports = Query;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));