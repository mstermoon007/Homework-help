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

  function findLegacy(id) {
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
            if (kps[ki] && kps[ki].id === id) return kps[ki];
          }
        }
      }
    }
    return null;
  }

  function get(id) {
    var legacy = findLegacy(id);
    if (!legacy) return null;
    return Ontology.normalize(legacy);
  }

  var API = { get: get, findLegacy: findLegacy };

  global.KnowledgePoint = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
