// @ts-check
/**
 * shared/knowledge/runtime/knowledge-index.js — 索引查询层（挂 App.KNOWLEDGE_INDEX）
 *
 * 只读共享分发产物 index/index.json。索引在 Canonical Build 阶段一次生成并固化，
 * Runtime 一律读取、绝不按数组位置动态推导 ID（方案 §6 / §11 / §15）。
 *
 * 加载顺序：knowledge-contract → knowledge-loader → knowledge-relation →
 * knowledge-policy → knowledge-index → knowledge-query → knowledge-api
 *
 * 注意：本模块是 runtime 内部实现，业务层唯一公开入口为 knowledge-api.js。
 */
(function (global) {
  'use strict';

  var CRT = (global.App && global.App.KNOWLEDGE_CONTRACT) || (typeof module !== 'undefined' ? require('./knowledge-contract.js') : null);
  var Loader = (global.App && global.App.KNOWLEDGE_LOADER) || (typeof module !== 'undefined' ? require('./knowledge-loader.js') : null);
  if (!CRT) throw new Error('knowledge-index: 缺少 App.KNOWLEDGE_CONTRACT');
  if (!Loader) throw new Error('knowledge-index: 缺少 App.KNOWLEDGE_LOADER');

  var _idx = null;
  function index() {
    if (!_idx) _idx = Loader.loadSync().index;
    return _idx;
  }

  function list(arr) { return arr || []; }

  function byId(id) { var e = index().byId[id]; return e || null; }

  function byGrade(grade) { return list(index().byGrade[grade]); }
  function byBook(grade, book) { return list(index().byBook[grade + '-' + book]); }
  function byUnit(unitId) { return list(index().byUnit[unitId]); }
  function byModule(module) { return list(index().byModule[module]); }
  function byFamily(family) { return list(index().byFamily[family]); }
  function byStatus(status) { return list(index().byStatus[status]); }
  function byPublication(publication) { return list(index().byPublication[publication]); }

  function sections() { return index(); }
  function count() { return Object.keys(index().byId).length; }

  var Index = {
    byId: byId,
    byGrade: byGrade,
    byBook: byBook,
    byUnit: byUnit,
    byModule: byModule,
    byFamily: byFamily,
    byStatus: byStatus,
    byPublication: byPublication,
    sections: sections,
    count: count
  };

  global.App = global.App || {};
  global.App.KNOWLEDGE_INDEX = Index;

  if (typeof module !== 'undefined' && module.exports) module.exports = Index;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));