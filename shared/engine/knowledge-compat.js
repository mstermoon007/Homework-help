/**
 * shared/engine/knowledge-compat.js — Frozen Strategy bundle 知识兼容桥（构建期接线）
 *
 * 仅为 bundle 内不可改写的冻结 Strategy / Capability 模块提供「旧模块名 → KBL Runtime」委托：
 *   shared/knowledge/knowledge-bank.js    → KnowledgeBankCompat.getEntries
 *   shared/knowledge/knowledge-point.js   → KnowledgePointCompat.get
 *   shared/knowledge/knowledge-ontology.js→ KnowledgeOntologyCompat.normalize
 *
 * 约束：
 *   - 不是数据层，不持有知识数据；每次查询都委托 KnowledgeContext → App.KNOWLEDGE
 *     （KBL Runtime 唯一事实源）。
 *   - 不写回 KBL；不改写 canonical 对象（strategyView 为只读浅投影）。
 *   - 仅供 bundle 冻结消费方；业务层（POL / Generator / SVG）不得使用。
 *
 * 载入顺序：knowledge-runtime.js → knowledge-context.js → 本文件 → strategy bundle。
 *
 * @module shared/engine/knowledge-compat
 */
(function (global) {
  'use strict';

  function getKC() {
    if (global.KnowledgeContext) return global.KnowledgeContext;
    if (global.App && global.App.KnowledgeContext) return global.App.KnowledgeContext;
    return null;
  }

  /** knowledge-point.js 兼容：get(id) → Frozen Strategy 兼容视图（canonical + id 别名） */
  var KnowledgePointCompat = {
    get: function (knowledgeId) {
      var KC = getKC();
      return KC ? KC.strategyView(knowledgeId) : null;
    }
  };

  /** knowledge-ontology.js 兼容：canonical 已归一，normalize 幂等透传 */
  var KnowledgeOntologyCompat = {
    normalize: function (kp) { return kp; }
  };

  /** knowledge-bank.js 兼容：getEntries(subject, grade) → Practice Context 条目（经 Runtime） */
  var KnowledgeBankCompat = {
    getEntries: function (subject, grade) {
      var KC = getKC();
      if (!KC) return [];
      return KC.poolContext({ subject: subject, grade: grade });
    }
  };

  global.KnowledgePointCompat = KnowledgePointCompat;
  global.KnowledgeOntologyCompat = KnowledgeOntologyCompat;
  global.KnowledgeBankCompat = KnowledgeBankCompat;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      KnowledgePointCompat: KnowledgePointCompat,
      KnowledgeOntologyCompat: KnowledgeOntologyCompat,
      KnowledgeBankCompat: KnowledgeBankCompat
    };
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));