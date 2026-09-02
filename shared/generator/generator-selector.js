/**
 * shared/generator/generator-selector.js — M4-R13/R14 Generator 选择器
 *
 * 输入：QuestionPlan
 * 输出：最佳 Generator（记录 + source + match）
 *
 * 选择优先级：
 *   ① 知识点匹配  —— knowledgePoints 包含 plan.knowledgePointId
 *   ② 能力匹配    —— capabilities 包含 plan.questionTypeId
 *   ③ 题型匹配    —— questionTypes 包含 plan.questionTypeId
 *   ④ 难度范围匹配—— difficultyRange 覆盖 plan.difficulty
 *   ⑤ 版本        —— version 更高者优先
 *   ⑥ fallback    —— legacyPluginId 对应的 legacy Generator（无类型绑定）
 *
 * 双轨（M4-R14，P2 Task 2.1 简化为 2 级覆盖）：
 *   native  —— 只看核心 Generator 轨道；无候选时回退旧插件
 *   hybrid  —— 双轨并轨，按优先级选优
 *
 * 轨道的有效模式由 generator-mode.js 按 knowledgePoint/global 解析。
 * 禁止 UI 直接选择 Generator：必须经本选择器（或 StrategyEngine）决策。
 */
'use strict';

var GenRegistry = require('./generator-registry.js');
var KnowledgePoint = require('../knowledge-point.js');
var Mode = require('./generator-mode.js');
// M7-R18：旧插件边界收敛到 shared/generator/legacy-adapter.js (P5 Task 5.1 统一)
var LegacyAdapter = require('./legacy-adapter.js');

function trackOf(record) {
  return record.scope === 'core' ? 'native' : 'legacy';
}

function selectGenerator(plan, options) {
  plan = plan || {};
  options = options || {};
  if (!plan.knowledgePointId) {
    throw new Error('GeneratorSelector: plan 缺少 knowledgePointId');
  }

  var mode = options.mode != null ? options.mode : Mode.resolve(plan);
  var kp = KnowledgePoint.get(plan.knowledgePointId);
  var all = GenRegistry.all();
  var candidates = [];

  all.forEach(function (g) {
    // 双轨过滤：native 只看 core；hybrid 双轨都可达
    var track = trackOf(g);
    if (mode === 'native' && track !== 'native') return;
    // hybrid：双轨都可达

    var score = { record: g, kp: 0, capability: 0, qt: 0, diff: 0 };

    // ① 知识点匹配
    if (g.knowledgePoints.indexOf(plan.knowledgePointId) !== -1) score.kp = 1;

    // ② 能力匹配
    if (plan.questionTypeId && g.capabilities.indexOf(plan.questionTypeId) !== -1) score.capability = 1;

    // ③ 题型匹配
    if (plan.questionTypeId && g.questionTypes.indexOf(plan.questionTypeId) !== -1) score.qt = 1;

    // ④ 难度范围匹配（记录声明了 difficultyRange 才计分）
    if (g.difficultyRange && plan.difficulty != null) {
      if (plan.difficulty >= g.difficultyRange.min && plan.difficulty <= g.difficultyRange.max) score.diff = 1;
    }

    if (score.kp + score.capability + score.qt + score.diff > 0) candidates.push(score);
  });

  // 按优先级排序：kp > capability > qt > diff > version
  candidates.sort(function (a, b) {
    if (a.kp !== b.kp) return b.kp - a.kp;
    if (a.capability !== b.capability) return b.capability - a.capability;
    if (a.qt !== b.qt) return b.qt - a.qt;
    if (a.diff !== b.diff) return b.diff - a.diff;
    return (b.record.version || 1) - (a.record.version || 1); // ⑤ 版本
  });

  if (candidates.length === 0) {
    // ⑥ fallback：legacyPluginId → legacy Generator（无匹配时保留旧插件）
    var legacyPluginId = kp && (kp.legacyPluginId || (kp.source && kp.source.pluginId));
    if (legacyPluginId) {
      var legacy = GenRegistry.get('legacy:' + legacyPluginId);
      if (legacy) {
        return { generatorId: legacy.id, source: 'fallback:legacy', record: legacy, mode: mode };
      }
    }
    return { generatorId: null, source: 'none', record: null, mode: mode };
  }

  var best = candidates[0];
  return {
    generatorId: best.record.id,
    source: 'priority',
    record: best.record,
    match: { kp: best.kp, capability: best.capability, questionType: best.qt, difficulty: best.diff },
    mode: mode
  };
}

/**
 * 实例化选择结果：legacy 记录 → LegacyAdapter 包装；core 记录 → 核心 Generator 实例。
 * 仅在需要真正生成时调用（选择本身只用注册表数据）。
 *
 * R23：实例化后立即包装 generate —— 为每个 SemanticQuestion 附加可追溯元数据：
 *   metadata.generator / metadata.generatorVersion / metadata.seed
 * 保证历史题目可以追溯到来源 Generator 与版本。
 */
function instantiate(selection, plugin) {
  if (!selection || !selection.record) return null;
  var gen;
  if (selection.record.scope === 'core') {
    var Generators = require('./generators/index.js');
    gen = Generators.get(selection.record.id);
  } else {
    // M7-R18：legacy 实例化统一经 shared/generator/legacy-adapter.js（唯一旧插件边界）。
    gen = LegacyAdapter.hydrateLegacyGenerator(selection, plugin);
    if (!gen) return null;
  }

  var generatorId = selection.record.id;
  var generatorVersion = toSemver(selection.record.version);

  return wrapGenerator(gen, generatorId, generatorVersion);
}

/** 数字版本 → "x.y.z" 语义化版本；已是字符串则原样保留 */
function toSemver(v) {
  if (typeof v === 'string' && /^\d+\.\d+\.\d+/.test(v)) return v;
  var n = parseInt(v, 10);
  if (!isNaN(n)) return n + '.0.0';
  return String(v == null ? '1.0.0' : v);
}

/** 包装 generate：为每个产出 sq 附加 metadata.generator/.generatorVersion/.seed */
function wrapGenerator(gen, generatorId, generatorVersion) {
  if (!gen || typeof gen.generate !== 'function') return gen;
  var orig = gen.generate.bind(gen);
  gen.generate = function (plan, context) {
    var out = orig(plan, context);
    if (out && typeof out.then === 'function') {
      return out.then(function (sqs) { return attachMeta(sqs, generatorId, generatorVersion); });
    }
    return attachMeta(out, generatorId, generatorVersion);
  };
  return gen;
}

function attachMeta(sqs, generatorId, generatorVersion) {
  if (!sqs) return sqs;
  var arr = Array.isArray(sqs) ? sqs : (sqs.questions && Array.isArray(sqs.questions) ? sqs.questions : null);
  if (!arr) return sqs;
  arr.forEach(function (sq) {
    if (!sq) return;
    sq.metadata = sq.metadata || {};
    sq.metadata.generator = generatorId;
    sq.metadata.generatorVersion = generatorVersion;
    if (sq.seed != null) sq.metadata.seed = sq.seed;
  });
  return sqs;
}

module.exports = {
  selectGenerator: selectGenerator,
  instantiate: instantiate,
  Mode: Mode
};