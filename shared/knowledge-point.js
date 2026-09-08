/**
 * shared/knowledge-point.js — Canonical KnowledgePoint 访问层 (M1-R03)
 *
 * 合规方案：绝不修改 KnowledgeBank。
 * KnowledgeBank 继续返回原始 Legacy 数据；本层只做：
 *   Legacy KP -> Ontology.normalize -> Canonical KnowledgePoint
 *
 * KnowledgeBank 既有方法（findGrade / getEntries / getCoverage / suggestNext）
 * 行为完全不变；本层是只读封装，无缓存、无语义变化、不接入 practice.html。
 */
(function (global) {
  'use strict';

  var KnowledgeBank = require('./knowledge-bank.js');
  var Ontology = require('./knowledge-ontology.js');
  var SUBJECTS = Ontology.SUBJECTS;

  // 运行时防全量重复扫描：id -> legacy 索引 + id -> canonical 缓存（惰性构建，一次性）。
  // KnowledgeBank 数据在进程内是静态只读的，normalize 为纯函数，缓存结果可安全复用。
  var _legacyIndex = null;
  var _canonicalCache = null;

  function buildLegacyIndex() {
    var idx = {};
    for (var si = 0; si < SUBJECTS.length; si++) {
      var arr = KnowledgeBank[SUBJECTS[si]];
      if (!Array.isArray(arr)) continue;
      for (var gi = 0; gi < arr.length; gi++) {
        var g = arr[gi];
        if (!g || !g.modules) continue;
        for (var mi = 0; mi < g.modules.length; mi++) {
          var kps = g.modules[mi].knowledgePoints;
          if (!Array.isArray(kps)) continue;
          for (var ki = 0; ki < kps.length; ki++) {
            var kp = kps[ki];
            if (kp && kp.id != null) idx[kp.id] = kp;
          }
        }
      }
    }
    return idx;
  }

  function ensureIndex() {
    if (!_legacyIndex) _legacyIndex = buildLegacyIndex();
  }

  function findLegacy(id) {
    ensureIndex();
    return Object.prototype.hasOwnProperty.call(_legacyIndex, id) ? _legacyIndex[id] : null;
  }

  function get(id) {
    if (!_canonicalCache) _canonicalCache = {};
    if (Object.prototype.hasOwnProperty.call(_canonicalCache, id)) return _canonicalCache[id];
    var legacy = findLegacy(id);
    var canonical = legacy ? Ontology.normalize(legacy) : null;
    _canonicalCache[id] = canonical;
    return canonical;
  }

  function reset() {
    _legacyIndex = null;
    _canonicalCache = null;
  }

  var API = { get: get, findLegacy: findLegacy, reset: reset };

  global.KnowledgePoint = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
