/**
 * shared/ontology-operation-map.js — Curated Plugin → Canonical Operations (M1-02.1)
 *
 * 治理记录：将每个插件映射到它「要求学生执行的操作」（Canonical Operation）。
 * 仅记录可依据「插件命名 / 既有插件行为」可靠推断的操作；不确定者留空（unresolved），
 * 由后续人工或 M1-02 后续批次补全。绝不作无依据猜测。
 *
 * 这是「增量语义建模」：不修改 KnowledgeBank 原始条目，由 Normalizer 在归一化时应用本映射。
 * 可审计、可重复、可回滚（删除本映射即回到 M1-01 无 operations 状态）。
 *
 * evidence 约定：
 *   - 'plugin-name'   : 由插件命名稳定推断（如 multiplication-table → multiply）
 *   - 'documented'    : 与项目既有插件行为一致
 * 置信度：
 *   - 'medium'        : 命名/行为可可靠推断
 *   - 'low'           : 仅按命名粗略归类，待插件细读确认
 */
(function (global) {
  'use strict';

  var Ops = require('./knowledge-operation.js');

  var MAP = {
    'math-oral': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g4-oral': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g5-oral': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g6-oral': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },

    'math-g1-multiplication-table': { ops: ['multiply'], confidence: 'high', evidence: 'plugin-name' },

    'math-g2-column': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g4-vertical': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g5-vertical': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },

    'math-make-ten': { ops: ['add', 'subtract'], confidence: 'medium', evidence: 'documented' },

    'math-shapes': { ops: ['identify', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-geometry': { ops: ['identify', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-area': { ops: ['identify', 'classify', 'measure'], confidence: 'medium', evidence: 'plugin-name' },

    'math-fraction': { ops: ['identify', 'compare', 'calculate'], confidence: 'medium', evidence: 'documented' },
    'math-decimal': { ops: ['identify', 'compare', 'calculate'], confidence: 'medium', evidence: 'documented' },

    'math-unit-convert': { ops: ['convert', 'measure'], confidence: 'medium', evidence: 'plugin-name' },
    'math-money': { ops: ['measure', 'convert', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },

    'math-clock': { ops: ['read', 'measure'], confidence: 'medium', evidence: 'plugin-name' },
    'math-time-date': { ops: ['read', 'measure'], confidence: 'medium', evidence: 'plugin-name' },

    'math-patterns': { ops: ['identify', 'reason'], confidence: 'medium', evidence: 'documented' },
    'math-g1-patterns': { ops: ['identify', 'reason'], confidence: 'medium', evidence: 'documented' },
    'math-number-sense': { ops: ['identify', 'compare', 'classify'], confidence: 'medium', evidence: 'documented' },
    'math-position-direction': { ops: ['identify', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-combination-set': { ops: ['classify', 'identify'], confidence: 'medium', evidence: 'plugin-name' },

    'math-data-stats': { ops: ['classify', 'identify', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-statistics': { ops: ['classify', 'identify', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g4-stats': { ops: ['classify', 'identify', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g5-stats': { ops: ['classify', 'identify', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },

    'math-word-problems': { ops: ['reason', 'calculate'], confidence: 'medium', evidence: 'documented' },
    'math-g6-word-problems': { ops: ['reason', 'calculate'], confidence: 'medium', evidence: 'documented' },
    'math-g4-word': { ops: ['reason', 'calculate'], confidence: 'medium', evidence: 'documented' },
    'math-g5-word': { ops: ['reason', 'calculate'], confidence: 'medium', evidence: 'documented' },

    'math-picture-equations': { ops: ['represent', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g2-picture-equations': { ops: ['represent', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g4-picture': { ops: ['represent', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g5-picture': { ops: ['represent', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g6-picture-equation': { ops: ['represent', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },

    'math-logic-reasoning': { ops: ['reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g6-reasoning': { ops: ['reason'], confidence: 'medium', evidence: 'plugin-name' },

    'math-g4-draw': { ops: ['represent'], confidence: 'low', evidence: 'plugin-name' },
    'math-g5-draw': { ops: ['represent'], confidence: 'low', evidence: 'plugin-name' },

    'chinese-pinyin': { ops: ['read', 'write', 'identify'], confidence: 'high', evidence: 'documented' },
    'chinese-hanzi': { ops: ['read', 'write', 'identify', 'compose'], confidence: 'high', evidence: 'documented' },
    'pinyin-to-char': { ops: ['read', 'write', 'identify'], confidence: 'high', evidence: 'documented' },
    'english-alphabet': { ops: ['read', 'write', 'identify'], confidence: 'high', evidence: 'documented' }
  };

  function operationsForPlugin(pluginId) {
    var e = pluginId && MAP[pluginId];
    if (!e) return [];
    return e.ops.filter(function (o) { return Ops.isCanonical(o); });
  }

  function metaForPlugin(pluginId) {
    return pluginId && MAP[pluginId] ? MAP[pluginId] : null;
  }

  function operationsForKP(kp) {
    kp = kp || {};
    if (Array.isArray(kp.operations) && kp.operations.length) return kp.operations.slice();
    return operationsForPlugin(kp.pluginId);
  }

  var API = {
    MAP: MAP,
    operationsForPlugin: operationsForPlugin,
    operationsForKP: operationsForKP,
    metaForPlugin: metaForPlugin
  };

  global.OntologyOperationMap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
