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
    'math-number-sense': { ops: ['identify', 'compare', 'classify'], confidence: 'medium', evidence: 'documented' },
    'math-position-direction': { ops: ['identify', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-combination-set': { ops: ['classify', 'identify'], confidence: 'medium', evidence: 'plugin-name' },

    'math-data-stats': { ops: ['classify', 'identify', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
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

    // ---------- V4.0.3 语义补填批次（模块/子题型语义推导） ----------
    // 题型类插件：按生成行为（计算/填空/判断/选择/匹配/操作/推理）归类 canonical 操作
    'math-g1-judge': { ops: ['reason', 'compare'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g1-operation': { ops: ['represent', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g1-matching': { ops: ['identify', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g1-choice': { ops: ['identify', 'reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g2-mixed': { ops: ['calculate'], confidence: 'high', evidence: 'plugin-name' },
    'math-g2-matching': { ops: ['identify', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g2-judge': { ops: ['reason', 'compare'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g2-choice': { ops: ['identify', 'reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g4-mixed': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g4-fill': { ops: ['identify', 'write', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-match': { ops: ['classify', 'identify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g4-reason': { ops: ['reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g4-judge': { ops: ['reason', 'compare'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g4-choice': { ops: ['identify', 'reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g5-mixed': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g5-fill': { ops: ['identify', 'write', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g5-reason': { ops: ['reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g5-judge': { ops: ['reason', 'compare'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g5-choice': { ops: ['identify', 'reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g6-calc': { ops: ['calculate'], confidence: 'high', evidence: 'plugin-name' },
    'math-g6-fill': { ops: ['identify', 'write', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g6-operation': { ops: ['represent', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g6-stats': { ops: ['identify', 'classify', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g6-judge': { ops: ['reason', 'compare'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g6-choice': { ops: ['identify', 'reason'], confidence: 'medium', evidence: 'plugin-name' },

    // 竞赛插件：C1 数字谜/C2 数论/C3 计数/C4 几何/C5 行程/C7 组合/C8 逻辑/C9 综合应用
    'math-competition-c1-numberpuzzle': { ops: ['reason', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-c2-numbertheory': { ops: ['reason', 'calculate', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-c3-counting': { ops: ['reason', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-c4-geometry': { ops: ['identify', 'measure', 'reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-c5-journey': { ops: ['reason', 'model', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-c8-logic': { ops: ['reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g4-c9': { ops: ['reason', 'model', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g5-c1': { ops: ['reason', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g5-c2': { ops: ['reason', 'calculate', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g5-c3': { ops: ['reason', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g5-c4': { ops: ['identify', 'measure', 'reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g5-c5': { ops: ['reason', 'model', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g5-c6': { ops: ['identify', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g5-c7': { ops: ['reason', 'model', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g5-c8': { ops: ['reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g5-c9': { ops: ['reason', 'model', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g6-c1': { ops: ['reason', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g6-c2': { ops: ['reason', 'calculate', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g6-c3': { ops: ['reason', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g6-c4': { ops: ['identify', 'measure', 'reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g6-c5': { ops: ['reason', 'model', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g6-c6': { ops: ['identify', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g6-c7': { ops: ['reason', 'model', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g6-c8': { ops: ['reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-competition-g6-c9': { ops: ['reason', 'model', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },

    // 其他（cn 综合、无插件占位）
    'chinese-comprehensive': { ops: ['identify', 'reason'], confidence: 'medium', evidence: 'plugin-name' },

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
