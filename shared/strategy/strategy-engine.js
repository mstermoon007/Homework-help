/**
 * shared/strategy/strategy-engine.js — M3-17 Strategy Engine (P2 Task 3.1 合并为 8 步)
 *
 * 唯一入口：StrategyEngine.plan(request)
 *
 * 内部顺序固定（8 步）：
 *   1) Request validate
 *   2) KP resolve + Capability inject
 *   3) QuestionType + Cognitive select
 *   4) Difficulty resolve（静态/目标/自适应/学习者）
 *   5) Constraints build（numberRange + structure + spiral + context）
 *   6) Count allocate
 *   7) Generator select
 *   8) Plan validate
 *
 * Validator 失败 → 抛 StrategyError（不允许进入 Generator）。
 */
'use strict';

var StrategyRequest = require('./strategy-request.js');
var StrategyResolver = require('./strategy-resolver.js');
var CapabilityResolver = require('../capability-resolver.js');
var QuestionTypeStrategy = require('./question-type-strategy.js');
var CognitiveStrategy = require('./cognitive-strategy.js');
var StaticDifficulty = require('./static-difficulty.js');
var TargetDifficulty = require('./target-difficulty.js');
var NumberRangeStrategy = require('./number-range-strategy.js');
var StructureConstraints = require('./structure-constraints.js');
var SpiralStrategy = require('./spiral-strategy.js');
var ContextStrategy = require('./context-strategy.js');
var ConstraintBuilder = require('./constraint-builder.js');
var StrategyValidator = require('./strategy-validator.js');
var StrategyResult = require('./strategy-result.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;
var AdaptiveStrategy = require('./adaptive-strategy.js');
var StrategyConfig = require('../strategy-config.js');

// ============ Refactor Step 3：统一 plan()，直接扩展三模式（quick/teacher/competition） ============
// 不建三套 Strategy Engine：同一 plan() 内
//   normalize → resolve KP pool → select KP → composite decision → difficulty → cognition → context → spiral → QuestionPlan
// Quick       ：grade + volume + questionType 构成 KP Pool
// Teacher     ：unitId 构成 KP Pool
// Competition ：同一池/同一流程，但 spiral/cognition/difficulty/context/composite 采用更高权重，且
//               未显式给出时 difficulty/spiralLevel 抬升到年级/知识点高位。
var POOL_MODES = { quick: true, teacher: true, competition: true };

var DIM_WEIGHTS = {
  quick: { spiral: 1, cognition: 1, difficulty: 1, context: 1, composite: 1 },
  teacher: { spiral: 1, cognition: 1, difficulty: 1, context: 1, composite: 1 },
  competition: { spiral: 1.6, cognition: 1.6, difficulty: 1.4, context: 1.4, composite: 1.6 }
};

function canonPoolSubject(v) {
  var m = { math: 'math' };
  return m[String(v || '').toLowerCase()] || null;
}

// 池源：teacher（或 competition+unitId）→ unit 池；其余 → 年级池
function poolSource(request, mode) {
  var subject = canonPoolSubject(request.subject) || 'math';
  if (mode === 'teacher' || (mode === 'competition' && request.unitId != null)) {
    return { subject: subject, grade: request.grade != null ? request.grade : null, unitId: request.unitId };
  }
  return { subject: subject, grade: request.grade, unitId: null };
}

function poolEntries(source) {
  var KB = require('../knowledge-bank.js');
  var entries = [];
  if (source.unitId != null) {
    var grades = source.grade != null ? [source.grade] : [1, 2, 3, 4, 5, 6];
    var seen = {};
    grades.forEach(function (g) {
      (KB.getEntries(source.subject, g) || []).forEach(function (e) {
        if (String(e.moduleId) === String(source.unitId) && !seen[e.id]) { seen[e.id] = true; entries.push(e); }
      });
    });
  } else {
    entries = KB.getEntries(source.subject, source.grade) || [];
  }
  return entries;
}

function requestedQuestionTypes(request) {
  var out = [];
  if (Array.isArray(request.questionTypes) && request.questionTypes.length) {
    request.questionTypes.forEach(function (q) { if (typeof q === 'string' && q) out.push(q); });
  } else if (request.questionType != null && typeof request.questionType === 'string') {
    out.push(request.questionType);
  }
  return out;
}

// 池内候选：解析 + 增强 KP；非 math（cn/en 混入）直接剔除（Core Domain 收缩）
function resolvePoolCandidates(entries) {
  var out = [];
  entries.forEach(function (entry) {
    var kp = null;
    try {
      var kpRaw = StrategyResolver.resolveKnowledgePoint(entry.id);
      kp = require('../generator/generator-registry.js').enhanceKp(kpRaw);
    } catch (e) {
      out.push({ entry: entry, kp: null, error: String((e && e.message) || e) });
      return;
    }
    var s = (kp && kp.subject) || subjectOfKpId(entry.id);
    if (s !== 'math') return;
    out.push({ entry: entry, kp: kp });
  });
  return out;
}

// 可行性：与 Engine Step3 selectQuestionType 同源（CapabilityResolver.getCapabilities(kp).questionTypes），
// 避免「增强 capabilities 宽于真实支持题型」导致的选中后落入 failedPlans。
function candidateFeasible(cand, qtList) {
  var caps = QuestionTypeStrategy.supportedTypes(cand.kp);
  if (!caps.length) return false;
  if (!qtList.length) return true;
  return qtList.some(function (q) {
    return caps.indexOf(q) !== -1 || String(cand.entry.type) === q || cand.entry.pluginId === q;
  });
}

// 五维 0..1 描述：spiral 余量 / cognition 能力面 / difficulty 贴近 / context 情境 / composite 统筹
function poolDimScores(cand, request, source) {
  var kp = cand.kp;
  var grade = source.grade != null ? source.grade : (request.grade != null ? request.grade : 1);
  var anchor = StrategyConfig.difficultyAnchorOf ? StrategyConfig.difficultyAnchorOf(grade) : null;
  var gradeMid = anchor ? (anchor[0] + anchor[1]) / 2 : 3;
  var reqD = request.difficulty != null ? request.difficulty : gradeMid;
  var kpDiff = (kp && kp.legacy && kp.legacy.difficulty != null) ? kp.legacy.difficulty : gradeMid;
  var maxSpiral = (kp && kp.spiral && typeof kp.spiral.maxLevel === 'number') ? kp.spiral.maxLevel : 6;
  var caps = QuestionTypeStrategy.supportedTypes(kp).length;
  var ctx = (kp && kp.context) || {};
  var contextual = ctx.allowContextual === true ? 1 : (ctx.allowPure === false ? 0.6 : 0.3);
  return {
    spiral: Math.min(1, maxSpiral / 6),
    cognition: Math.min(1, caps / 5),
    difficulty: Math.max(0, 1 - Math.abs(kpDiff - reqD) / 9),
    context: contextual,
    composite: Math.min(1, Math.min(1, maxSpiral / 6) * 0.3 + Math.min(1, caps / 5) * 0.2 + contextual * 0.5)
  };
}

// 按模式维度权重合成 score（competition 抬权体现在此处）
function scorePoolCandidate(cand, request, source, mode) {
  var dim = poolDimScores(cand, request, source);
  var w = DIM_WEIGHTS[mode] || DIM_WEIGHTS.quick;
  var raw = w.spiral * dim.spiral + w.cognition * dim.cognition + w.difficulty * dim.difficulty + w.context * dim.context + w.composite * dim.composite;
  var base = (typeof cand.entry.weight === 'number' && cand.entry.weight > 0) ? cand.entry.weight : 1;
  return { dim: dim, raw: raw, base: base, score: Math.max(0.0001, raw * base) };
}

// 最大余数法分配（池内选择：share>0 的候选即被选中）
function allocateLargestRemainder(weights, total) {
  var n = weights.length;
  var out = new Array(n).fill(0);
  var wsum = 0;
  for (var i = 0; i < n; i++) wsum += (typeof weights[i] === 'number' && weights[i] > 0) ? weights[i] : 0;
  if (wsum <= 0 || total < 1 || n === 0) return out;
  var assigned = 0;
  var rem = [];
  for (var j = 0; j < n; j++) {
    out[j] = Math.floor(total * weights[j] / wsum);
    assigned += out[j];
    rem.push({ i: j, w: weights[j], r: total * weights[j] / wsum - out[j] });
  }
  var leftover = total - assigned;
  if (leftover > 0) {
    rem.sort(function (a, b) { return (b.r - a.r) || (b.w - a.w); });
    for (var k = 0; k < leftover && k < n; k++) out[rem[k].i] += 1;
  }
  return out;
}

// Pool 模式主流程：resolve pool → 打分 → 分配选择 → 逐 KP 走同一 plan() 核心 → QuestionPlan[]
function planFromPool(request, mode) {
  var source = poolSource(request, mode);
  if (source.subject !== 'math') {
    throw new StrategyError('核心生成引擎仅支持数学（math），暂不支持 ' + source.subject + '（' + mode + '）', CODES.UNSUPPORTED_SUBJECT, { subject: source.subject });
  }
  var entries = poolEntries(source);
  var qtList = requestedQuestionTypes(request);
  var candidates = resolvePoolCandidates(entries).filter(function (c) { return candidateFeasible(c, qtList); });

  var trace = {
    mode: mode,
    pool: { subject: source.subject, grade: source.grade, unitId: source.unitId, size: entries.length, feasible: candidates.length, questionTypes: qtList.length ? qtList.slice() : null },
    dimWeights: Object.assign({}, DIM_WEIGHTS[mode] || DIM_WEIGHTS.quick)
  };

  if (!candidates.length) {
    trace.selection = [];
    trace.message = entries.length ? '池内知识点均不支持请求题型/无生成能力' : '该知识点池无可用知识点';
    var emptyResult = StrategyResult.createStrategyResult([], { trace: trace, mode: mode }, []);
    emptyResult.trace = trace;
    return emptyResult;
  }

  var count = request.count != null ? request.count : (request.volume != null ? request.volume : 10);
  if (typeof count !== 'number' || !isFinite(count) || count < 1 || Math.floor(count) !== count) {
    throw new StrategyError('count 必须是 >=1 的整数: ' + count, CODES.INVALID_REQUEST, { count: count });
  }

  var scored = candidates.map(function (c) { return { cand: c, score: scorePoolCandidate(c, request, source, mode) }; });
  // P0-03 Step 14: 仅分配给有 native generator 支持的 KP（避免 GENERATOR_UNSUPPORTED 导致计数缺失）
  var ArithSem = require('../generator/core/kp-arithmetic-semantics.js');
  var ComplexSem = require('../generator/core/kp-complex-semantics.js');
  var GenRegistry = require('../generator/generator-registry.js');
  function hasNativeSupport(kp) {
    if (!kp) return false;
    // 直接绑定了 core generator
    var gens = GenRegistry.forKnowledgePoint(kp.id);
    if (gens.some(function (g) { return g.scope === 'core'; })) return true;
    // 算术语义域（algebra + 可解析算术语义）
    var arithSem = ArithSem.resolveArithmeticSemantics(kp);
    var isAlgebraDomain = !!(kp && kp.legacy && kp.legacy.category === 'algebra');
    if (isAlgebraDomain && (arithSem || kp.source.legacyType)) return true;
    // 复杂算术语义
    if (ComplexSem.resolveComplexSemantics(kp)) return true;
    return false;
  }
  scored = scored.filter(function (s) { return hasNativeSupport(s.cand.kp); });
  var shares = allocateLargestRemainder(scored.map(function (s) { return s.score.score; }), count);

  trace.selection = scored.map(function (s, i) {
    return {
      kpId: s.cand.entry.id,
      name: s.cand.entry.name,
      moduleId: s.cand.entry.moduleId,
      pluginId: s.cand.entry.pluginId,
      baseWeight: Math.round(s.score.base * 100) / 100,
      dims: {
        spiral: Math.round(s.score.dim.spiral * 100) / 100,
        cognition: Math.round(s.score.dim.cognition * 100) / 100,
        difficulty: Math.round(s.score.dim.difficulty * 100) / 100,
        context: Math.round(s.score.dim.context * 100) / 100,
        composite: Math.round(s.score.dim.composite * 100) / 100
      },
      composite: Math.round(s.score.score * 100) / 100,
      share: shares[i]
    };
  });

  var plans = [];
  var failedPlans = [];
  var planTraces = [];
  scored.forEach(function (s, i) {
    var share = shares[i];
    if (share < 1) return;
    var sub = Object.assign({}, request, {
      mode: mode === 'competition' ? 'competition' : 'single-kp',
      knowledgePointIds: [s.cand.entry.id],
      knowledgePoints: undefined,
      knowledgePointId: undefined,
      kp: undefined,
      count: share
    });
    delete sub.knowledgePoints;
    delete sub.knowledgePointId;
    delete sub.kp;
    delete sub.questionTypes; // 题型白名单为池级过滤；单点由 plan() 内 questionType 决策
    if (mode === 'competition') {
      // Competition：难度由 P0-02 Step 8 mode profile 合成（锚点顶格），不在此预设；
      // 螺旋在未显式给出时抬升到知识点余量高位（Step 10 目标一致性）
      if (sub.spiralLevel == null && s.cand.kp && s.cand.kp.spiral && typeof s.cand.kp.spiral.maxLevel === 'number') {
        sub.spiralLevel = s.cand.kp.spiral.maxLevel;
      }
    }
    try {
      var r = plan(sub);
      if (r && r.plans && r.plans[0]) {
        var qp = r.plans[0];
        qp.__pool = { mode: mode, kpId: s.cand.entry.id, composite: Math.round(s.score.score * 100) / 100 };
        plans.push(qp);
        if (r.meta && r.meta.trace) planTraces.push(r.meta.trace);
      } else {
        failedPlans.push({ kpId: s.cand.entry.id, error: 'StrategyEngine 未产出计划' });
      }
    } catch (e) {
      failedPlans.push({ kpId: s.cand.entry.id, error: String((e && e.message) || e) });
    }
  });

  trace.selected = plans.length;
  trace.failedPlans = failedPlans;
  trace.planTraces = planTraces;

  var result = StrategyResult.createStrategyResult(plans, { trace: trace, mode: mode }, []);
  result.trace = trace;
  var resultCheck = StrategyResult.validateStrategyResult(result);
  if (!resultCheck.valid) {
    throw new StrategyError('StrategyResult 校验失败: ' + resultCheck.errors.join('; '), CODES.INVALID_PLAN, { errors: resultCheck.errors });
  }
  result.valid = true;
  return result;
}

// Core Domain 收缩（Refactor Step 1）：核心生成链仅接受 math 知识点。
// 其余科目返回明确 unsupported，禁止 fallback。
function subjectOfKpId(id) {
  if (!id || typeof id !== 'string') return null;
  if (id.indexOf('math-') === 0) return 'math';
  return null;
}

function plan(request) {
  var trace = {};

  // Refactor Step 2：请求归一。内部唯一 KP 语义 = knowledgePointIds 数组。
  // 旧调用（knowledgePointId 字符串 / knowledgePoints 数组）在此归一为数组，之后不再有单数语义。
  request = StrategyRequest.normalizeRequest(request);

  // 1) Request validate
  var reqCheck = StrategyRequest.validateRequest(request);
  if (!reqCheck.valid) {
    throw new StrategyError('Request 非法: ' + reqCheck.errors.join('; '), CODES.INVALID_REQUEST, { errors: reqCheck.errors });
  }

  // Refactor Step 3：Pool 模式（quick/teacher/competition）无显式 KP → 直接走统一池化流程。
  // 带显式 knowledgePointIds 的请求仍走既有单点/合并路径（同一 plan()，不建第二套引擎）。
  var mode = request.mode;
  if (POOL_MODES[mode] && request.knowledgePointIds.length === 0) {
    return planFromPool(request, mode);
  }

  var kpIds = request.knowledgePointIds;
  // 引擎单次规划接受 1 个知识点；combine=true 时接受多个并把全量写入计划。
  // 多个知识点且未 combine 属 multi-kp 编排（api/orchestrator 按知识点拆分），禁止在本层静默丢弃。
  if (kpIds.length > 1 && request.combine !== true) {
    throw new StrategyError('StrategyEngine 单次规划仅接受单一知识点或 combine=true：' + kpIds.join(','),
      CODES.INVALID_REQUEST, { knowledgePointIds: kpIds });
  }
  // P0-07 Step 32: combine=true 要求多 KP（至少 2 个）
  if (request.combine === true && kpIds.length < 2) {
    throw new StrategyError('combine=true 要求至少 2 个知识点（当前仅 ' + kpIds.length + ' 个）',
      CODES.INVALID_REQUEST, { knowledgePointIds: kpIds, combine: true });
  }

  // 2) KP resolve + Capability inject
  var kp = StrategyResolver.resolveKnowledgePoint(kpIds[0]);
  var GenRegistry = require('../generator/generator-registry.js');
  kp = GenRegistry.enhanceKp(kp);

  // Core Domain 收缩（Refactor Step 1）：核心生成链仅接受 math。
  // 非 math 知识点 → UNSUPPORTED_SUBJECT，明确 unsupported，禁止任何 fallback 到 legacy。
  var coreSubject = (kp && kp.subject) || subjectOfKpId(kp && kp.id);
  if (coreSubject !== 'math') {
    throw new StrategyError(
      '核心生成引擎仅支持数学（math），暂不支持 ' + (coreSubject || '未知科目') + ' 知识点: ' + kp.id,
      CODES.UNSUPPORTED_SUBJECT,
      { subject: coreSubject, knowledgePointId: kp.id }
    );
  }
  // 多 KP（combine）同样逐一校验学科：任一非 math → unsupported
  for (var gi = 0; gi < kpIds.length; gi++) {
    var s = subjectOfKpId(kpIds[gi]);
    if (s && s !== 'math') {
      throw new StrategyError(
        '核心生成引擎仅支持数学（math），暂不支持 ' + s + ' 知识点: ' + kpIds[gi],
        CODES.UNSUPPORTED_SUBJECT,
        { subject: s, knowledgePointId: kpIds[gi] }
      );
    }
  }

  trace.knowledgePoint = kp.id;
  trace.knowledgePointIds = request.combine === true ? kpIds.slice() : [kp.id];
  trace.kpCapabilities = kp.capabilities;

  // P0-07 Step 33: combine=true 且多 KP 时，必须有 native composite generator，否则显式失败
  if (request.combine === true && kpIds.length > 1) {
    var GenRegistry = require('../generator/generator-registry.js');
    var hasCompositeGenerator = false;
    var allKpIds = kpIds.slice();
    var compositeGens = GenRegistry.records().filter(function (g) {
      return g.supportsComposite === true && g.scope === 'core';
    });
    if (compositeGens.length > 0) {
      var compositeGen = compositeGens[0];
      // 检查 composite generator 是否支持所有 KP
      var allSupported = allKpIds.every(function (id) {
        return compositeGen.knowledgePoints.indexOf(id) !== -1;
      });
      if (allSupported) hasCompositeGenerator = true;
    }
    if (!hasCompositeGenerator) {
      throw new StrategyError(
        '无可用 Composite Generator 支持该组合知识点: ' + allKpIds.join(','),
        CODES.COMPOSITE_UNSUPPORTED,
        { knowledgePointIds: allKpIds, combine: true }
      );
    }
  }

  var capability = CapabilityResolver.getCapabilities(kp);
  trace.capabilityQuestionTypes = capability.questionTypes;

  // 3) QuestionType + Cognitive select (合并)
  var questionType = QuestionTypeStrategy.selectQuestionType(kp, {
    questionTypeId: request.questionType != null ? request.questionType : null,
    questionTypes: request.questionTypes,
    subtype: request.subtype,
    cognitiveLevel: request.cognitiveLevel
  });
  var cognitiveLevel = CognitiveStrategy.resolveCognitiveLevel({
    knowledgePoint: kp,
    questionType: questionType,
    cognitiveLevel: request.cognitiveLevel
  });
  trace.questionType = questionType;
  trace.cognitiveLevel = cognitiveLevel;

  // 4) Difficulty resolve（合并静态/目标/自适应/学习者 + P0-02 Step 8 合成难度）
  var staticProfile = StaticDifficulty.resolveStaticDifficulty(kp, questionType, request.customParams);
  var difficulty = TargetDifficulty.resolveTargetDifficulty({
    knowledgePoint: kp,
    questionType: questionType,
    difficulty: request.difficulty != null ? request.difficulty : null,
    adaptive: request.adaptive === true,
    adaptiveDelta: request.adaptiveDelta != null ? request.adaptiveDelta : 0,
    allowDifficultyOverride: request.allowDifficultyOverride,
    customParams: request.customParams,
    mode: mode
  });
  var effectiveDifficulty = difficulty.effectiveDifficulty;
  var finalDifficulty = difficulty.composedDifficulty != null ? difficulty.composedDifficulty : effectiveDifficulty;

  var learnerDecision = null;
  if (request.learnerProfile && typeof request.learnerProfile === 'object') {
    var LearnerModel = require('../learner/learner-model.js');
    var kpState = null;
    if (request.learnerProfile.knowledgePoints && typeof request.learnerProfile.knowledgePoints === 'object') {
      kpState = LearnerModel.get(request.learnerProfile, kp.id) || null;
    } else if (request.learnerProfile.mastery != null) {
      kpState = request.learnerProfile;
    }
    var maxSpiral = 6;
    if (kp && kp.spiral && typeof kp.spiral.maxLevel === 'number') maxSpiral = kp.spiral.maxLevel;
    learnerDecision = AdaptiveStrategy.resolve({
      kpId: kp.id,
      learnerState: kpState,
      staticDifficulty: staticProfile.level,
      difficulty: request.difficulty != null ? request.difficulty : null,
      allowDifficultyOverride: request.allowDifficultyOverride,
      adaptiveMode: request.adaptiveMode,
      adaptiveDelta: difficulty.adaptiveDelta,
      maxSpiralLevel: maxSpiral
    });
    if (learnerDecision.effectiveDifficulty != null) {
      effectiveDifficulty = learnerDecision.effectiveDifficulty;
      finalDifficulty = learnerDecision.effectiveDifficulty;
    }
    trace.learner = {
      kpId: kp.id,
      mode: learnerDecision.mode,
      adjustment: learnerDecision.adjustment,
      mastery: learnerDecision.mastery,
      confidence: learnerDecision.confidence,
      recentAccuracy: learnerDecision.recentAccuracy,
      attempts: learnerDecision.attempts,
      targetSpiralLevel: learnerDecision.targetSpiralLevel,
      variant: learnerDecision.variant,
      errorFocus: learnerDecision.errorFocus
    };
  }
  trace.staticDifficulty = staticProfile.level;
  trace.effectiveDifficulty = finalDifficulty;
  trace.composedDifficulty = finalDifficulty;
  trace.difficultyComposition = difficulty.difficultyComposition;

  // 5) Constraints build（合并 numberRange + structure + spiral + context）
  var numberRange = NumberRangeStrategy.resolveNumberRange({
    settings: request.settings,
    knowledgePoint: kp,
    questionType: questionType,
    customParams: request.customParams,
    level: finalDifficulty
  });

  var structure = StructureConstraints.resolveStructureConstraints({
    knowledgePoint: kp,
    questionType: questionType,
    customParams: request.customParams,
    finalDifficulty: finalDifficulty,
    settings: request.settings
  });

  var spiralInputLevel = request.spiralLevel;
  if (learnerDecision && spiralInputLevel == null) spiralInputLevel = learnerDecision.targetSpiralLevel;
  // P0-02 Step 10：单点直连 competition 请求未显式指定螺旋档时，目标取 KP 螺旋余量高位
  if (spiralInputLevel == null && mode === 'competition' && kp.spiral && typeof kp.spiral.maxLevel === 'number') {
    spiralInputLevel = kp.spiral.maxLevel;
  }
  var spiral = SpiralStrategy.resolveSpiral({
    knowledgePoint: kp,
    spiral_level: spiralInputLevel,
    max_spiral_level: request.max_spiral_level,
    difficulty: finalDifficulty,
    cognitiveLevel: cognitiveLevel
  });

  var contextType = ContextStrategy.resolveContextType({
    knowledgePoint: kp,
    questionType: questionType,
    spiralLevel: spiral.spiralLevel,
    cognitiveLevel: cognitiveLevel
  });

  trace.numberRange = numberRange;
  trace.structure = structure;
  trace.spiral = spiral;
  trace.contextType = contextType;

  // 6) Count allocate
  var count = request.count != null ? request.count : 1;
  if (typeof count !== 'number' || !isFinite(count) || count < 1 || Math.floor(count) !== count) {
    throw new StrategyError('count 必须是 >=1 的整数: ' + count, CODES.INVALID_REQUEST, { count: count });
  }

  // 合并约束
  var constraints = ConstraintBuilder.buildConstraints({
    difficulty: finalDifficulty,
    questionType: questionType,
    cognitiveLevel: cognitiveLevel,
    spiralLevel: spiral.spiralLevel,
    contextType: contextType,
    numberRange: structure.numberRange,
    maxSteps: structure.maxSteps,
    allowBracket: structure.allowBracket,
    allowMultDiv: structure.allowMultDiv
  });

  // 算术/复杂语义注入（M4-R17/18）
  var KpArith = require('../generator/core/kp-arithmetic-semantics.js');
  var arithSem = KpArith.resolveArithmeticSemantics(kp);
  var KpComplex = require('../generator/core/kp-complex-semantics.js');
  var complexSem = KpComplex.resolveComplexSemantics(kp);
  trace.kpArithmeticSemantics = arithSem ? { legacyType: arithSem.legacyType, operators: arithSem.operators, steps: arithSem.steps } : null;
  trace.kpComplexSemantics = complexSem ? { family: complexSem.family, operators: complexSem.operators, steps: complexSem.steps } : null;

  if (arithSem) {
    constraints.operation = arithSem.operators;
    constraints.exactSteps = arithSem.steps;
    if (arithSem.kind) constraints.kind = arithSem.kind;
  }
  if (complexSem) {
    constraints.operation = complexSem.operators;
    constraints.exactSteps = complexSem.steps;
    constraints.allowBracket = complexSem.allowBracket;
    constraints.structure = { family: complexSem.family, inverse: complexSem.inverse };
  }

  // 7) Generator select（在校验前，供 Plan 携带 generator 信息）
  var GeneratorSelector = require('../generator/generator-selector.js');
  var selectedGenerator = GeneratorSelector.selectGenerator({
    knowledgePointIds: [kp.id],
    questionTypeId: questionType,
    difficulty: finalDifficulty,
    cognitiveLevel: cognitiveLevel,
    spiralLevel: spiral.spiralLevel,
    contextType: contextType,
    constraints: constraints
  });

  // P0-03 Step 14：native 模式无合法候选 → 立即抛出 GENERATOR_UNSUPPORTED（不生成空计划）
  if (selectedGenerator.source === 'unsupported') {
    throw new StrategyError(
      '核心 Generator 不支持该知识点（native 模式无语义匹配）: ' + kp.id,
      CODES.GENERATOR_UNSUPPORTED,
      { knowledgePointId: kp.id, questionTypeId: questionType, generatorId: null, source: selectedGenerator.source }
    );
  }

  // 8) QuestionPlan 构建
  var questionPlan = {
    knowledgePointIds: request.combine === true ? kpIds.slice() : [kp.id],
    questionTypeId: questionType,
    subtype: request.subtype != null && request.subtype !== '' ? request.subtype : undefined,
    count: count,
    difficulty: finalDifficulty,
    cognitiveLevel: cognitiveLevel,
    spiralLevel: spiral.spiralLevel,
    variationMode: spiral.variationMode,
    contextType: contextType,
    constraints: constraints,
    generator: selectedGenerator
  };
  if (request.combine === true) {
    questionPlan.combine = true;
  }
  if (request.previousGenerationId != null) {
    questionPlan.previousGenerationId = request.previousGenerationId;
  }
  if (request.unitId != null) {
    questionPlan.unitId = request.unitId;
  }
  if (arithSem) {
    questionPlan.operation = arithSem.operators;
  }
  if (complexSem) {
    questionPlan.operation = complexSem.operators;
  }

  // 9) 固定样式 + 复杂度统筹（M3-13/14）：样式管骨架（知识点类别×题型），复杂度管内容深度（难度×螺旋档）
  var StyleStrategy = require('./question-style-strategy.js');
  var ComplexityStrategy = require('./complexity-strategy.js');
  var styleInfo = StyleStrategy.resolveQuestionStyle({
    questionTypeId: questionType,
    category: kp.category,
    knowledgePointId: kp.id
  });
  var complexityInfo = ComplexityStrategy.resolveComplexity({
    difficulty: finalDifficulty,
    spiralLevel: spiral.spiralLevel,
    knowledgePointId: kp.id
  });
  questionPlan.style = styleInfo.style;
  questionPlan.svgTemplate = styleInfo.svgTemplate;
  questionPlan.complexity = {
    tier: complexityInfo.tier,
    label: complexityInfo.label,
    rangeBoost: complexityInfo.rangeBoost,
    multiStep: complexityInfo.multiStep,
    mixLevel: complexityInfo.mixLevel,
    spiralAdjusted: complexityInfo.spiralAdjusted
  };
  if (request.adaptive === true) {
    questionPlan.adaptiveDelta = difficulty.adaptiveDelta;
    questionPlan.targetDifficulty = difficulty.targetDifficulty;
  }
  if (learnerDecision) {
    questionPlan.learner = {
      mode: learnerDecision.mode,
      adjustment: learnerDecision.adjustment,
      mastery: learnerDecision.mastery,
      confidence: learnerDecision.confidence
    };
    questionPlan.variant = learnerDecision.variant;
    questionPlan.errorFocus = learnerDecision.errorFocus;
  }

  // Plan validate（步骤 8）
  var check = StrategyValidator.validatePlan(questionPlan);
  if (!check.valid) {
    throw new StrategyError('QuestionPlan 校验失败: ' + check.errors.join('; '), CODES.INVALID_PLAN, { errors: check.errors });
  }

  var result = StrategyResult.createStrategyResult([questionPlan], {
    trace: trace,
    staticLevel: staticProfile.level,
    targetDifficulty: difficulty.targetDifficulty,
    effectiveDifficulty: effectiveDifficulty
  }, []);

  // Debug Trace（保持兼容：request.debug === true）
  if (request.debug === true) {
    result.strategyTrace = [
      { step: 1, name: 'KP', value: kp.id },
      { step: 2, name: 'Capability', value: capability.questionTypes },
      { step: 3, name: 'QuestionType', value: questionType },
      { step: 4, name: 'Cognitive', value: cognitiveLevel },
      { step: 5, name: 'Static Difficulty', value: staticProfile.level },
      { step: 6, name: 'Adaptive Delta', value: { target: difficulty.targetDifficulty, delta: difficulty.adaptiveDelta, adaptive: difficulty.adaptive } },
      { step: 7, name: 'Effective Difficulty', value: effectiveDifficulty },
      { step: 8, name: 'Structure', value: { maxSteps: structure.maxSteps, allowBracket: structure.allowBracket, allowMultDiv: structure.allowMultDiv } },
      { step: 9, name: 'Spiral', value: spiral.spiralLevel + ' (' + spiral.variationMode + ')' },
      { step: 10, name: 'Context', value: contextType },
      { step: 11, name: 'Count', value: count }
    ];
  }

  var resultCheck = StrategyResult.validateStrategyResult(result);
  if (!resultCheck.valid) {
    throw new StrategyError('StrategyResult 校验失败: ' + resultCheck.errors.join('; '), CODES.INVALID_PLAN, { errors: resultCheck.errors });
  }

  result.valid = true;
  return result;
}

function formatValue(v) {
  if (v == null) return String(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * M3-22：把 strategyTrace 渲染为可读的决策链文本（KP ↓ Capability ↓ … ↓ Count），
 * 便于 AI 编程与人工排查。
 */
function formatStrategyTrace(trace) {
  if (!Array.isArray(trace)) return '';
  return trace.map(function (s) {
    return s.name + ' : ' + formatValue(s.value);
  }).join('\n  ↓\n');
}

module.exports = {
  plan: plan,
  formatStrategyTrace: formatStrategyTrace,
  POOL_MODES: POOL_MODES,
  DIM_WEIGHTS: DIM_WEIGHTS,
  planFromPool: planFromPool
};

// 浏览器/全局挂载
if (typeof window !== 'undefined') window.StrategyEngine = module.exports;
if (typeof global !== 'undefined') global.StrategyEngine = module.exports;