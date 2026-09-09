/**
 * shared/generator/generator-selector.js — M4-R13/R14 Generator 选择器
 *
 * 输入：QuestionPlan
 * 输出：最佳 Generator（记录 + source + match）
 *
 * 选择优先级（P0-03 Step 12 重建）：
 *   ① KP native binding    — knowledgePoints 包含 plan.knowledgePointId
 *   ② semantic operation   — 语义域一致（算术 KP → arithmetic 家族；复杂 KP → complex-calc）
 *   ③ content/capability   — generator.capabilities 包含 plan.questionTypeId
 *   ④ questionType         — generator.questionTypes 包含 plan.questionTypeId
 *   ⑤ difficulty range     — difficultyRange 覆盖 plan.difficulty
 *   ⑥ version              — 更高者优先
 *   ⑦ legacy               — legacyPluginId fallback（仅 hybrid 模式）
 *
 * 硬阻断（P0-03 Step 13）：
 *   arithmetic 家族生成器（generator:arithmetic-*）仅服务算术语义 KP（resolveArithmeticSemantics 非空）；
 *   立体图形/人民币/位置等 geometry/measurement KP 禁止进入 arithmetic generator（仅共存 questionType 不视为匹配）。
 *
 * 双轨（M4-R14）：
 *   native — 只看核心 Generator 轨道；无候选时返回 GENERATOR_UNSUPPORTED（Step 14）
 *   hybrid — 双轨并轨，按优先级选优；无候选时 fallback legacy adapter
 */
'use strict';

var GenRegistry = require('./generator-registry.js');
var KnowledgePoint = require('../knowledge/knowledge-point.js');
var Mode = require('./generator-mode.js');
var QuestionPlan = require('../strategy/question-plan.js');
var ArithSem = require('./core/kp-arithmetic-semantics.js');
var QuestionTypeRegistry = require('../knowledge/question-type-registry.js');
var ComplexSem = require('./core/kp-complex-semantics.js');

function trackOf(record) {
  return record.scope === 'core' ? 'native' : 'legacy';
}

function isArithmeticFamily(g) {
  return g.id && (g.id.indexOf('generator:arithmetic-') === 0 || g.id.indexOf('generator:selection-') === 0);
}

function isComplexFamily(g) {
  return g.id === 'generator:complex-calc';
}

function isShapeFamily(g) {
  return g.id === 'generator:shape-recognition';
}

function isMoneyFamily(g) {
  return g.id === 'generator:money-measurement';
}

function isCountingFamily(g) {
  return g.id === 'generator:counting';
}

function isReasoningFamily(g) {
  return g.id === 'generator:reasoning';
}

function isStatsFamily(g) {
  return g.id === 'generator:stats';
}

function isPictureEquationFamily(g) {
  return g.id === 'generator:picture-equation';
}

function isC1Family(g) {
  return g.id === 'generator:c1-number-puzzle';
}

function isC2Family(g) {
  return g.id === 'generator:c2-number-theory';
}

function isC5C6Family(g) {
  return g.id === 'generator:c5-c6-journey-engineering';
}

function isC7Family(g) {
  return g.id === 'generator:c7-clever-calc';
}

function isC9Family(g) {
  return g.id === 'generator:c9-comprehensive';
}

function hasShapeSemantics(kp) {
  return g.id === 'generator:application-word';
}

function hasShapeSemantics(kp) {
  if (!kp) return false;
  // 几何语义判定：graphicType 是 geometry 或 pluginId 含 geometry
  if (kp.graphicType === 'geometry') return true;
  if (kp.pluginId && (kp.pluginId.indexOf('geometry') !== -1 || kp.pluginId.indexOf('area') !== -1)) return true;
  return false;
}

function hasMoneySemantics(kp) {
  if (!kp) return false;
  var p = kp.pluginId || '';
  if (p.indexOf('money') !== -1 || p.indexOf('time') !== -1 || p.indexOf('unit') !== -1 || p.indexOf('measure') !== -1) return true;
  if (kp.graphicType === 'clock' || kp.graphicType === 'ruler') return true;
  return false;
}

function hasAppSemantics(kp) {
  if (!kp) return false;
  // 应用题语义：pluginId 明确是 word-problems（不再按 moduleId 判定）
  var p = kp.pluginId || '';
  if (p.indexOf('word-problem') !== -1 || p.indexOf('word_problem') !== -1) return true;
  // application 本体绑定的自然有语义（硬阻断只在 score.kp=0 时触发）
  return false;
}

function hasCountingSemantics(kp) {
  if (!kp) return false;
  var p = kp.pluginId || '';
  if (p.indexOf('combination') !== -1 || p.indexOf('counting') !== -1) return true;
  if (p.indexOf('c3-') !== -1) return true;
  // G5/G6 竞赛计数：pluginId 形如 math-competition-g5-c3 / math-competition-g6-c3（结尾无横杠）
  if (p.indexOf('c3') !== -1 && p.indexOf('competition') !== -1) return true;
  return false;
}

function hasReasoningSemantics(kp) {
  if (!kp) return false;
  var p = kp.pluginId || '';
  if (p.indexOf('logic') !== -1 || p.indexOf('reason') !== -1) return true;
  if (p.indexOf('c8') !== -1) return true;
  return false;
}

function hasStatsSemantics(kp) {
  if (!kp) return false;
  if (kp.graphicType === 'chart') return true;
  var p = kp.pluginId || '';
  if (p.indexOf('stats') !== -1 || p.indexOf('data') !== -1) return true;
  return false;
}

function hasPictureEquationSemantics(kp) {
  if (!kp) return false;
  if (kp.graphicType === 'diagram') return true;
  var p = kp.pluginId || '';
  if (p.indexOf('picture') !== -1) return true;
  return false;
}

function hasC1Semantics(kp) {
  if (!kp) return false;
  var p = kp.pluginId || '';
  if (p.indexOf('c1-') !== -1) return true;
  if (p.indexOf('c1') !== -1 && p.indexOf('competition') !== -1) return true;
  return false;
}

function hasC2Semantics(kp) {
  if (!kp) return false;
  var p = kp.pluginId || '';
  if (p.indexOf('c2-') !== -1) return true;
  if (p.indexOf('c2') !== -1 && p.indexOf('competition') !== -1) return true;
  return false;
}

function hasC5C6Semantics(kp) {
  if (!kp) return false;
  var p = kp.pluginId || '';
  // C5 行程 / C6 工程浓度：pluginId 形如 math-competition-c5-journey、math-competition-g5-c6
  if ((p.indexOf('c5') !== -1 || p.indexOf('c6') !== -1) && p.indexOf('competition') !== -1) return true;
  return false;
}

function hasC7Semantics(kp) {
  if (!kp) return false;
  var p = kp.pluginId || '';
  // C7 巧算/计算技巧：pluginId 形如 math-competition-g5-c7 / math-competition-g6-c7
  if (p.indexOf('c7') !== -1 && p.indexOf('competition') !== -1) return true;
  return false;
}

function hasC9Semantics(kp) {
  if (!kp) return false;
  var p = kp.pluginId || '';
  // C9 综合应用题：pluginId 形如 math-competition-g4-c9 / math-competition-g5-c9 / math-competition-g6-c9
  if (p.indexOf('c9') !== -1 && p.indexOf('competition') !== -1) return true;
  return false;
}

function selectGenerator(plan, options) {
  plan = plan || {};
  options = options || {};
  var primaryKp = QuestionPlan.planPrimaryKpId(plan);
  if (!primaryKp) {
    throw new Error('GeneratorSelector: plan 缺少 knowledgePointIds');
  }

  var mode = options.mode != null ? options.mode : Mode.resolve(plan);
  // 7 类规范题型：归一 request 的 questionTypeId（oral→calc / recognize→geometry / open→apply），
  // 保证下游 capability/qt 匹配始终基于规范 7 类，且兼容历史 KB 的原始题型 token。
  if (plan && plan.questionTypeId && QuestionTypeRegistry && QuestionTypeRegistry.normalizeQuestionType) {
    var _n = QuestionTypeRegistry.normalizeQuestionType(plan.questionTypeId, { allowHeuristic: false });
    if (_n && _n.id) plan = Object.assign({}, plan, { questionTypeId: _n.id });
  }
  var kp = KnowledgePoint.get(primaryKp);
  var all = GenRegistry.all();
  var candidates = [];

  // Step 11 审计定位：arithmetic semantics 基于原始 KP（source.legacyType + legacy.category），
  // solid/money/position 等非算术语义 KP（geometry/measurement）禁止进入 arithmetic 家族。
  var arithSem = kp ? ArithSem.resolveArithmeticSemantics(kp) : null;
  var complexSem = kp ? ComplexSem.resolveComplexSemantics(kp) : null;
  // 算术语义域：可解析算术语义，或 legacy.category === 'algebra'（如 make-ten/cushi 属凑加，属算术）
  var isAlgebraDomain = !!(kp && kp.legacy && kp.legacy.category === 'algebra');

  // C3：combine 合并计划路由收口。
  // combine=true 且 ≥2 KP 时，只有 supportsComposite 生成器能在单题/单卷中同时
  // 承载多 KP 语义；普通单 KP 生成器（如 arithmetic-addition）的产出只体现单一 KP，
  // 必然触发 KP_SEMANTIC_COMPOSITE 失败（实测合并计划连选 20 次稳定误选）。
  // 故在候选筛选最前端收口：合并计划仅 supportsComposite 生成器入候选；
  // 非合并计划（含 multi-kp 拆分后的单 KP 计划）composite 不得入候选（原 P0-07 规则）。
  var combineKpCount = QuestionPlan.planKnowledgePointIds(plan).length;
  var isCombineRequest = plan.combine === true && combineKpCount >= 2;

  all.forEach(function (g) {
    var track = trackOf(g);
    if (mode === 'native' && track !== 'native') return;

    if (g.supportsComposite === true && !isCombineRequest) return;
    if (isCombineRequest && g.supportsComposite !== true) return;

    var score = { record: g, kp: 0, semanticOp: 0, capability: 0, qt: 0, diff: 0 };

    // ① KP native binding（本体绑定即语义契约，优先于任何泛型匹配）
    if (g.knowledgePoints.indexOf(primaryKp) !== -1) score.kp = 1;

    // Step 13：硬阻断 —— 语义不一致的泛型候选直接拒绝（仅共存 questionType 不视为匹配）。
    //   仅阻断「无本体绑定」的泛型匹配；显式绑定该 KP 的生成器视为语义契约，最高优先级放行。
    //   geometry/classify 是元题型（识别/作图/分类整理），不属于任何单一语义域，豁免所有硬阻断。
    var qt = plan.questionTypeId;
    var isMetaExempt = qt === 'recognize' || qt === 'geometry' || qt === 'classify';
    if (!isMetaExempt && isArithmeticFamily(g) && score.kp === 0 && !(arithSem || isAlgebraDomain || (kp && kp.operations && kp.operations.length > 0))) return;
    if (!isMetaExempt && isComplexFamily(g) && score.kp === 0 && !complexSem) return;
    if (!isMetaExempt && isShapeFamily(g) && score.kp === 0 && !hasShapeSemantics(kp)) return;
    if (!isMetaExempt && isMoneyFamily(g) && score.kp === 0 && !hasMoneySemantics(kp)) return;
    if (!isMetaExempt && isCountingFamily(g) && score.kp === 0 && !hasCountingSemantics(kp)) return;
    if (!isMetaExempt && isReasoningFamily(g) && score.kp === 0 && !hasReasoningSemantics(kp)) return;
    if (!isMetaExempt && isStatsFamily(g) && score.kp === 0 && !hasStatsSemantics(kp)) return;
    if (!isMetaExempt && isPictureEquationFamily(g) && score.kp === 0 && !hasPictureEquationSemantics(kp)) return;
    if (!isMetaExempt && isC1Family(g) && score.kp === 0 && !hasC1Semantics(kp)) return;
    if (!isMetaExempt && isC2Family(g) && score.kp === 0 && !hasC2Semantics(kp)) return;
    if (!isMetaExempt && isC5C6Family(g) && score.kp === 0 && !hasC5C6Semantics(kp)) return;
    if (!isMetaExempt && isC7Family(g) && score.kp === 0 && !hasC7Semantics(kp)) return;
    if (!isMetaExempt && isC9Family(g) && score.kp === 0 && !hasC9Semantics(kp)) return;

    // ② semantic operation：语义域一致才算匹配
    if (isArithmeticFamily(g) || isComplexFamily(g) || isShapeFamily(g) || isMoneyFamily(g) || isCountingFamily(g) || isReasoningFamily(g) || isStatsFamily(g) || isPictureEquationFamily(g) || isC1Family(g) || isC2Family(g) || isC5C6Family(g) || isC7Family(g) || isC9Family(g)) {
      score.semanticOp = 1;
    } else if (score.kp === 1) {
      score.semanticOp = 1;
    }

    // ③ content/structure capability（generator.capabilities 交集）
    if (plan.questionTypeId && g.capabilities.indexOf(plan.questionTypeId) !== -1) score.capability = 1;

    // ④ questionType
    if (plan.questionTypeId && g.questionTypes.indexOf(plan.questionTypeId) !== -1) score.qt = 1;

    // ⑤ difficulty range
    if (g.difficultyRange && plan.difficulty != null) {
      if (plan.difficulty >= g.difficultyRange.min && plan.difficulty <= g.difficultyRange.max) score.diff = 1;
    }

    // 候选资格：真实匹配维度（kp/capability/qt/diff）任一命中；
    // semanticOp 仅作候选之间的优先级档位（Step 12 ②），不单独构成候选资格。
    if (score.kp + score.capability + score.qt + score.diff > 0) candidates.push(score);
  });

  // Step 12 priority：kp > semanticOp > capability > qt > diff > version
  candidates.sort(function (a, b) {
    if (a.kp !== b.kp) return b.kp - a.kp;
    if (a.semanticOp !== b.semanticOp) return b.semanticOp - a.semanticOp;
    if (a.capability !== b.capability) return b.capability - a.capability;
    if (a.qt !== b.qt) return b.qt - a.qt;
    if (a.diff !== b.diff) return b.diff - a.diff;
    var va = a.record.version || 1, vb = b.record.version || 1;
    if (va !== vb) return vb - va;
    // tiebreak：core 优先于 legacy
    if (a.record.scope === 'core' && b.record.scope !== 'core') return -1;
    if (b.record.scope === 'core' && a.record.scope !== 'core') return 1;
    return 0;
  });

  if (candidates.length === 0) {
    // MATH-14：legacy 轨道已删除，任何模式无候选均返回 GENERATOR_UNSUPPORTED（无 fallback 宿主）。
    return { generatorId: null, source: 'unsupported', errorCode: 'GENERATOR_UNSUPPORTED', record: null, mode: mode };
  }

  var best = candidates[0];
  return {
    generatorId: best.record.id,
    source: 'priority',
    record: best.record,
    match: { kp: best.kp, semanticOp: best.semanticOp, capability: best.capability, questionType: best.qt, difficulty: best.diff },
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
  // MATH-14：legacy 轨道已删，仅 core Generator 可实例化。
  var Generators = require('./generators/index.js');
  var gen = Generators.get(selection.record.id);
  if (!gen) return null;

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