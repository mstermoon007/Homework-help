/* 自动生成：node dev/build-strategy-bundle.js（请勿手改） */
/* StrategyEngine 浏览器 bundle：M3-20 接入 practice.html */
(function (global) {
'use strict';
var __defs = {}, __mods = {};
function __req(id) {
  if (__mods[id]) return __mods[id].exports;
  if (!__defs[id]) throw new Error('strategy-bundle: 模块未注册: ' + id);
  var m = { exports: {} };
  __mods[id] = m;
  __defs[id](m, m.exports, __req);
  return m.exports;
}
__defs['node:path'] = function (m) {
  var posix = {
    resolve: function (a, b) { return b ? (a.replace(/\/$/, '') + '/' + b) : a; },
    join: function () {
      var parts = []; for (var i = 0; i < arguments.length; i++) { var p = String(arguments[i]); if (p) parts.push(p.replace(/\/+$/, '')); }
      return parts.join('/');
    },
    dirname: function (p) { var i = p.lastIndexOf('/'); return i === -1 ? '.' : p.slice(0, i); },
    basename: function (p) { var i = p.lastIndexOf('/'); return i === -1 ? p : p.slice(i + 1); },
    extname: function (p) { var b = posix.basename(p); var i = b.lastIndexOf('.'); return i <= 0 ? '' : b.slice(i); },
    normalize: function (p) { return p; }
  };
  posix.posix = posix;
  m.exports = posix;
};
__defs["shared/common.js"] = function (m) {
  if (global.PluginUtil == null) throw new Error('strategy-bundle: 缺少全局 PluginUtil（请先加载对应脚本）');
  m.exports = global.PluginUtil;
};
__defs["shared/difficulty.js"] = function (m) {
  if (global.App.Difficulty == null) throw new Error('strategy-bundle: 缺少全局 App.Difficulty（请先加载对应脚本）');
  m.exports = global.App.Difficulty;
};
__defs["shared/difficulty-static.js"] = function (m) {
  if (global.App.DifficultyStatic == null) throw new Error('strategy-bundle: 缺少全局 App.DifficultyStatic（请先加载对应脚本）');
  m.exports = global.App.DifficultyStatic;
};
__defs["shared/knowledge-bank.js"] = function (m) {
  if (global.KnowledgeBank == null) throw new Error('strategy-bundle: 缺少全局 KnowledgeBank（请先加载对应脚本）');
  m.exports = global.KnowledgeBank;
};
__defs["shared/strategy/strategy-engine.js"] = function (module, exports, require) {

'use strict';

var StrategyRequest = require("shared/strategy/strategy-request.js");
var StrategyResolver = require("shared/strategy/strategy-resolver.js");
var CapabilityResolver = require("shared/capability-resolver.js");
var QuestionTypeStrategy = require("shared/strategy/question-type-strategy.js");
var CognitiveStrategy = require("shared/strategy/cognitive-strategy.js");
var StaticDifficulty = require("shared/strategy/static-difficulty.js");
var TargetDifficulty = require("shared/strategy/target-difficulty.js");
var NumberRangeStrategy = require("shared/strategy/number-range-strategy.js");
var StructureConstraints = require("shared/strategy/structure-constraints.js");
var SpiralStrategy = require("shared/strategy/spiral-strategy.js");
var ContextStrategy = require("shared/strategy/context-strategy.js");
var ConstraintBuilder = require("shared/strategy/constraint-builder.js");
var StrategyValidator = require("shared/strategy/strategy-validator.js");
var StrategyResult = require("shared/strategy/strategy-result.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;
var AdaptiveStrategy = require("shared/strategy/adaptive-strategy.js");
var StrategyConfig = require("shared/strategy-config.js");








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


function poolSource(request, mode) {
  var subject = canonPoolSubject(request.subject) || 'math';
  if (mode === 'teacher' || (mode === 'competition' && request.unitId != null)) {
    return { subject: subject, grade: request.grade != null ? request.grade : null, unitId: request.unitId };
  }
  return { subject: subject, grade: request.grade, unitId: null };
}

function poolEntries(source) {
  var KB = require("shared/knowledge-bank.js");
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


function resolvePoolCandidates(entries) {
  var out = [];
  entries.forEach(function (entry) {
    var kp = null;
    try {
      var kpRaw = StrategyResolver.resolveKnowledgePoint(entry.id);
      kp = require("shared/generator/generator-registry.js").enhanceKp(kpRaw);
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



function candidateFeasible(cand, qtList) {
  var caps = QuestionTypeStrategy.supportedTypes(cand.kp);
  if (!caps.length) return false;
  if (!qtList.length) return true;
  return qtList.some(function (q) {
    return caps.indexOf(q) !== -1 || String(cand.entry.type) === q || cand.entry.pluginId === q;
  });
}


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


function scorePoolCandidate(cand, request, source, mode) {
  var dim = poolDimScores(cand, request, source);
  var w = DIM_WEIGHTS[mode] || DIM_WEIGHTS.quick;
  var raw = w.spiral * dim.spiral + w.cognition * dim.cognition + w.difficulty * dim.difficulty + w.context * dim.context + w.composite * dim.composite;
  var base = (typeof cand.entry.weight === 'number' && cand.entry.weight > 0) ? cand.entry.weight : 1;
  return { dim: dim, raw: raw, base: base, score: Math.max(0.0001, raw * base) };
}


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
  
  var ArithSem = require("shared/generator/core/kp-arithmetic-semantics.js");
  var ComplexSem = require("shared/generator/core/kp-complex-semantics.js");
  var GenRegistry = require("shared/generator/generator-registry.js");
  function hasNativeSupport(kp) {
    if (!kp) return false;
    
    var gens = GenRegistry.forKnowledgePoint(kp.id);
    if (gens.some(function (g) { return g.scope === 'core'; })) return true;
    
    var arithSem = ArithSem.resolveArithmeticSemantics(kp);
    var isAlgebraDomain = !!(kp && kp.legacy && kp.legacy.category === 'algebra');
    if (isAlgebraDomain && (arithSem || kp.source.legacyType)) return true;
    
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
    delete sub.questionTypes; 
    if (mode === 'competition') {
      
      
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



function subjectOfKpId(id) {
  if (!id || typeof id !== 'string') return null;
  if (id.indexOf('math-') === 0) return 'math';
  return null;
}

function plan(request) {
  var trace = {};

  
  
  request = StrategyRequest.normalizeRequest(request);

  
  var reqCheck = StrategyRequest.validateRequest(request);
  if (!reqCheck.valid) {
    throw new StrategyError('Request 非法: ' + reqCheck.errors.join('; '), CODES.INVALID_REQUEST, { errors: reqCheck.errors });
  }

  
  
  var mode = request.mode;
  if (POOL_MODES[mode] && request.knowledgePointIds.length === 0) {
    return planFromPool(request, mode);
  }

  var kpIds = request.knowledgePointIds;
  
  
  if (kpIds.length > 1 && request.combine !== true) {
    throw new StrategyError('StrategyEngine 单次规划仅接受单一知识点或 combine=true：' + kpIds.join(','),
      CODES.INVALID_REQUEST, { knowledgePointIds: kpIds });
  }
  
  if (request.combine === true && kpIds.length < 2) {
    throw new StrategyError('combine=true 要求至少 2 个知识点（当前仅 ' + kpIds.length + ' 个）',
      CODES.INVALID_REQUEST, { knowledgePointIds: kpIds, combine: true });
  }

  
  var kp = StrategyResolver.resolveKnowledgePoint(kpIds[0]);
  var GenRegistry = require("shared/generator/generator-registry.js");
  kp = GenRegistry.enhanceKp(kp);

  
  
  var coreSubject = (kp && kp.subject) || subjectOfKpId(kp && kp.id);
  if (coreSubject !== 'math') {
    throw new StrategyError(
      '核心生成引擎仅支持数学（math），暂不支持 ' + (coreSubject || '未知科目') + ' 知识点: ' + kp.id,
      CODES.UNSUPPORTED_SUBJECT,
      { subject: coreSubject, knowledgePointId: kp.id }
    );
  }
  
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

  
  if (request.combine === true && kpIds.length > 1) {
    var GenRegistry = require("shared/generator/generator-registry.js");
    var hasCompositeGenerator = false;
    var allKpIds = kpIds.slice();
    var compositeGens = GenRegistry.records().filter(function (g) {
      return g.supportsComposite === true && g.scope === 'core';
    });
    if (compositeGens.length > 0) {
      var compositeGen = compositeGens[0];
      
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
    var LearnerModel = require("shared/learner/learner-model.js");
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

  
  var count = request.count != null ? request.count : 1;
  if (typeof count !== 'number' || !isFinite(count) || count < 1 || Math.floor(count) !== count) {
    throw new StrategyError('count 必须是 >=1 的整数: ' + count, CODES.INVALID_REQUEST, { count: count });
  }

  
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

  
  var KpArith = require("shared/generator/core/kp-arithmetic-semantics.js");
  var arithSem = KpArith.resolveArithmeticSemantics(kp);
  var KpComplex = require("shared/generator/core/kp-complex-semantics.js");
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

  
  var GeneratorSelector = require("shared/generator/generator-selector.js");
  var selectedGenerator = GeneratorSelector.selectGenerator({
    knowledgePointIds: [kp.id],
    questionTypeId: questionType,
    difficulty: finalDifficulty,
    cognitiveLevel: cognitiveLevel,
    spiralLevel: spiral.spiralLevel,
    contextType: contextType,
    constraints: constraints
  });

  
  if (selectedGenerator.source === 'unsupported') {
    throw new StrategyError(
      '核心 Generator 不支持该知识点（native 模式无语义匹配）: ' + kp.id,
      CODES.GENERATOR_UNSUPPORTED,
      { knowledgePointId: kp.id, questionTypeId: questionType, generatorId: null, source: selectedGenerator.source }
    );
  }

  
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

  
  var StyleStrategy = require("shared/strategy/question-style-strategy.js");
  var ComplexityStrategy = require("shared/strategy/complexity-strategy.js");
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


if (typeof window !== 'undefined') window.StrategyEngine = module.exports;
if (typeof global !== 'undefined') global.StrategyEngine = module.exports;
};
__defs["shared/strategy/strategy-config.js"] = function (module, exports, require) {
  module.exports = null;
};
__defs["shared/strategy/question-type-strategy.js"] = function (module, exports, require) {

'use strict';

var Registry = require("shared/question-type-registry.js");
var Resolver = require("shared/capability-resolver.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

function selectQuestionType(kp, options) {
  options = options || {};

  if (!kp || typeof kp !== 'object') {
    throw new StrategyError('KP 不能为空', CODES.INVALID_REQUEST);
  }

  var supported = supportedTypes(kp);

  
  if (options.questionTypeId != null) {
    var requested = options.questionTypeId;
    if (!Registry.has(requested)) {
      throw new StrategyError('非法 questionTypeId: ' + requested, CODES.INVALID_REQUEST, { questionTypeId: requested });
    }
    if (supported.indexOf(requested) === -1) {
      throw new StrategyError('KP 不支持该题型: ' + requested, CODES.NO_CAPABILITY, { questionTypeId: requested, knowledgePointId: kp.id });
    }
    return requested;
  }

  
  
  var pool = supported;
  if (Array.isArray(options.questionTypes) && options.questionTypes.length) {
    var valid = [];
    options.questionTypes.forEach(function (t) {
      if (supported.indexOf(t) !== -1 && valid.indexOf(t) === -1) valid.push(t);
    });
    if (valid.length) pool = valid;
  }

  
  if (options.subtype != null) {
    var normalized = Registry.normalizeQuestionType(options.subtype);
    if (normalized && normalized.id && pool.indexOf(normalized.id) !== -1) {
      return normalized.id;
    }
  }

  
  if (options.cognitiveLevel != null) {
    var matched = matchByCognitiveLevel(pool, options.cognitiveLevel);
    if (matched) return matched;
  }

  
  var defaultFromKP = getDefaultFromKP(kp, pool);
  if (defaultFromKP) return defaultFromKP;

  
  return getRegistryDefault(kp, pool);
}

function supportedTypes(kp) {
  return Resolver.getCapabilities(kp).questionTypes || [];
}

function matchByCognitiveLevel(supported, level) {
  if (typeof level !== 'string') return null;
  for (var i = 0; i < supported.length; i++) {
    var t = Registry.get(supported[i]);
    if (t && t.cognitiveLevels && t.cognitiveLevels.indexOf(level) !== -1) {
      return supported[i];
    }
  }
  return null;
}

function getDefaultFromKP(kp, supported) {
  var qts = kp && kp.presentation && kp.presentation.questionTypes;
  if (!Array.isArray(qts)) return null;
  for (var i = 0; i < qts.length; i++) {
    var token = qts[i] && (qts[i].rawType || qts[i].type);
    if (!token) continue;
    var norm = Registry.normalizeQuestionType(token);
    if (norm && norm.id && supported.indexOf(norm.id) !== -1) return norm.id;
  }
  return null;
}

function getRegistryDefault(kp, supported) {
  if (supported.length === 0) {
    throw new StrategyError('KP 无任何受支持题型: ' + (kp && kp.id), CODES.NO_CAPABILITY, { knowledgePointId: kp && kp.id });
  }
  if (supported.indexOf('calc') !== -1) return 'calc';
  return supported[0];
}

module.exports = {
  selectQuestionType: selectQuestionType,
  supportedTypes: supportedTypes,
  matchByCognitiveLevel: matchByCognitiveLevel,
  getDefaultFromKP: getDefaultFromKP,
  getRegistryDefault: getRegistryDefault
};

};
__defs["shared/strategy/question-type-allocation.js"] = function (module, exports, require) {

'use strict';

var Registry = require("shared/question-type-registry.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var QuestionTypeStrategy = require("shared/strategy/question-type-strategy.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

function allocateQuestionTypes(options) {
  options = options || {};

  var count = options.count;
  if (typeof count !== 'number' || !isFinite(count) || count < 1 || Math.floor(count) !== count) {
    throw new StrategyError('count 必须是 >=1 的整数: ' + count, CODES.INVALID_REQUEST, { count: count });
  }

  var kp = null;
  if (options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  } else if (options.kp != null) {
    kp = options.kp;
  }

  
  var candidateTypes;
  if (Array.isArray(options.questionTypes) && options.questionTypes.length > 0) {
    candidateTypes = options.questionTypes.slice();
  } else if (kp) {
    candidateTypes = QuestionTypeStrategy.supportedTypes(kp);
  } else {
    throw new StrategyError('缺少候选题型：请提供 questionTypes 或 knowledgePointId/kp', CODES.INVALID_REQUEST);
  }

  
  var seen = {};
  candidateTypes = candidateTypes.filter(function (t) {
    if (seen[t]) return false;
    seen[t] = true;
    return true;
  });
  candidateTypes.forEach(function (t) {
    if (!Registry.has(t)) {
      throw new StrategyError('非法 questionTypeId: ' + t, CODES.INVALID_REQUEST, { questionTypeId: t });
    }
    if (kp && QuestionTypeStrategy.supportedTypes(kp).indexOf(t) === -1) {
      throw new StrategyError('KP 不支持该题型: ' + t, CODES.NO_CAPABILITY, { questionTypeId: t, knowledgePointId: kp.id });
    }
  });
  if (candidateTypes.length === 0) {
    throw new StrategyError('KP 无任何受支持题型: ' + (kp && kp.id), CODES.NO_CAPABILITY, { knowledgePointId: kp && kp.id });
  }

  
  if (kp && candidateTypes.length > 1) {
    var preferred = QuestionTypeStrategy.selectQuestionType(kp, options);
    var idx = candidateTypes.indexOf(preferred);
    if (idx > 0) {
      candidateTypes.splice(idx, 1);
      candidateTypes.unshift(preferred);
    }
  }

  
  var plans = distribute(count, candidateTypes);

  
  var total = plans.reduce(function (n, p) { return n + p.count; }, 0);
  if (total !== count) {
    throw new StrategyError('分配不变式被破坏: sum=' + total + ' !== count=' + count, CODES.INVALID_PLAN, { total: total, count: count });
  }

  return {
    requestCount: count,
    total: total,
    plans: plans.map(function (p) {
      return {
        knowledgePointIds: [kp ? kp.id : (options.knowledgePointId || null)].filter(function (x) { return x; }),
        questionTypeId: p.questionTypeId,
        count: p.count
      };
    })
  };
}

function distribute(count, types) {
  var n = types.length;
  var base = Math.floor(count / n);
  var rem = count % n;
  var plans = [];
  for (var i = 0; i < n; i++) {
    var c = base + (i < rem ? 1 : 0);
    if (c > 0) plans.push({ questionTypeId: types[i], count: c });
  }
  return plans;
}


function allocateKpRatio(kps, total) {
  if (!Array.isArray(kps) || !kps.length) {
    throw new StrategyError('kps 必须是包含至少一个知识点的数组', CODES.INVALID_REQUEST, { kps: kps });
  }
  var n = Number(total);
  if (typeof n !== 'number' || !isFinite(n) || n < 1 || Math.floor(n) !== n) {
    throw new StrategyError('total 必须是 >=1 的整数: ' + total, CODES.INVALID_REQUEST, { total: total });
  }
  kps.forEach(function (k, i) {
    if (!k || typeof k !== 'object' || !k.id) {
      throw new StrategyError('kp[' + i + '] 缺少 id', CODES.INVALID_REQUEST, { index: i });
    }
  });

  var wSum = 0;
  kps.forEach(function (k) { wSum += Number(k.weight) || 1; });

  
  var alloc = {}, rem = [];
  kps.forEach(function (k) {
    var w = Number(k.weight) || 1;
    var exact = n * w / wSum;
    alloc[k.id] = Math.floor(exact);
    rem.push({ id: k.id, frac: exact - Math.floor(exact), w: w });
  });
  var sum = Object.keys(alloc).reduce(function (a, id) { return a + alloc[id]; }, 0);
  rem.sort(function (a, b) { return (b.frac - a.frac) || (b.w - a.w); });
  for (var r = 0; r < n - sum && r < rem.length; r++) alloc[rem[r].id] += 1;

  
  var out = kps.map(function (k) {
    return { id: k.id, weight: Number(k.weight) || 1, count: alloc[k.id] };
  });
  var totalOut = out.reduce(function (a, p) { return a + p.count; }, 0);
  if (totalOut !== n) {
    throw new StrategyError('kpRatio 分配不变式被破坏: sum=' + totalOut + ' !== total=' + n, CODES.INVALID_PLAN, { totalOut: totalOut, total: n });
  }
  return { total: n, kps: out };
}

function validateAllocation(plans, requestCount) {
  var errors = [];
  if (!Array.isArray(plans)) {
    return { valid: false, errors: ['plans 必须是数组'] };
  }
  var sum = 0;
  plans.forEach(function (p, i) {
    if (!p || typeof p !== 'object') { errors.push('plan[' + i + '] 必须是对象'); return; }
    if (typeof p.questionTypeId !== 'string') errors.push('plan[' + i + '] 缺少 questionTypeId');
    if (typeof p.count !== 'number' || p.count < 1 || Math.floor(p.count) !== p.count) {
      errors.push('plan[' + i + '] count 必须是 >=1 的整数');
    } else {
      sum += p.count;
    }
  });
  if (sum !== requestCount) {
    errors.push('分配总数 ' + sum + ' !== 请求数 ' + requestCount);
  }
  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  allocateQuestionTypes: allocateQuestionTypes,
  allocateKpRatio: allocateKpRatio,
  distribute: distribute,
  validateAllocation: validateAllocation
};

};
__defs["shared/strategy/static-difficulty.js"] = function (module, exports, require) {

'use strict';

var DifficultyStatic = require("shared/difficulty-static.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;


function toEngineMeta(kp) {
  var meta = {};
  meta.difficulty = (kp.legacy && typeof kp.legacy.difficulty === 'number')
    ? kp.legacy.difficulty : 3;
  meta.spiral_level = (kp.spiral && typeof kp.spiral.level === 'number')
    ? kp.spiral.level : 1;
  meta.max_spiral_level = (kp.spiral && typeof kp.spiral.maxLevel === 'number')
    ? kp.spiral.maxLevel : 1;
  meta.cognitive_level = (kp.cognition && kp.cognition.raw) ||
    (kp.legacy && kp.legacy.cognitive_level) || null;
  meta.max_steps_default = (kp.structure && typeof kp.structure.maxSteps === 'number')
    ? kp.structure.maxSteps : 1;
  meta.number_range_default = (kp.numeric && kp.numeric.range) || null;
  meta.context_default = (kp.context && kp.context.defaults && kp.context.defaults[0]) || null;
  meta.applicable_question_types = ((kp.presentation && kp.presentation.questionTypes) || []).map(function (q) {
    return { type: q.type || q.rawType, coefficient: q.weight != null ? q.weight : 1 };
  });
  return meta;
}

function resolveStaticDifficulty(knowledgePoint, questionType, customParams) {
  if (!knowledgePoint || typeof knowledgePoint !== 'object') {
    throw new StrategyError('KnowledgePoint 不能为空', CODES.INVALID_REQUEST);
  }

  
  var profile = DifficultyStatic.paramsForKnowledgePoint(
    toEngineMeta(knowledgePoint), questionType, customParams);

  return {
    level: profile.level,
    scale: profile.scale,
    steps: profile.steps,
    allowBracket: !!profile.allowBracket,
    allowMultDiv: !!profile.allowMultDiv,
    staticMeta: profile.staticMeta
  };
}

module.exports = {
  toEngineMeta: toEngineMeta,
  resolveStaticDifficulty: resolveStaticDifficulty
};

};
__defs["shared/strategy/difficulty-strategy.js"] = function (module, exports, require) {

'use strict';

var StaticDifficulty = require("shared/strategy/static-difficulty.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;
var StrategyConfig = require("shared/strategy-config.js");
var ComplexityStrategy = require("shared/strategy/complexity-strategy.js");

var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 10;


function applyEffective(baseLevel, adaptiveDelta) {
  if (typeof baseLevel !== 'number' || !isFinite(baseLevel)) {
    throw new StrategyError('baseLevel 必须是有限数字: ' + baseLevel, CODES.INVALID_REQUEST, { baseLevel: baseLevel });
  }
  var delta = adaptiveDelta == null ? 0 : adaptiveDelta;
  if (typeof delta !== 'number' || !isFinite(delta)) {
    throw new StrategyError('adaptiveDelta 必须是有限数字: ' + delta, CODES.INVALID_REQUEST, { adaptiveDelta: delta });
  }
  var raw = baseLevel + delta;
  var clamped = Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, raw));
  return Math.round(clamped);
}

function computeEffectiveDifficulty(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }
  if (!kp || typeof kp !== 'object') {
    throw new StrategyError('KnowledgePoint 不能为空（knowledgePoint 或 knowledgePointId）', CODES.INVALID_REQUEST);
  }

  var adaptiveDelta = options.adaptiveDelta == null ? 0 : options.adaptiveDelta;
  if (typeof adaptiveDelta !== 'number' || !isFinite(adaptiveDelta)) {
    throw new StrategyError('adaptiveDelta 必须是有限数字: ' + adaptiveDelta, CODES.INVALID_REQUEST, { adaptiveDelta: adaptiveDelta });
  }

  
  var staticProfile = StaticDifficulty.resolveStaticDifficulty(kp, options.questionType, options.customParams);
  var staticLevel = staticProfile.level;

  
  var raw = staticLevel + adaptiveDelta;
  var effectiveDifficulty = applyEffective(staticLevel, adaptiveDelta);

  return {
    staticLevel: staticLevel,
    adaptiveDelta: adaptiveDelta,
    raw: raw,
    effectiveDifficulty: effectiveDifficulty,
    static: staticProfile
  };
}


var MODE_PROFILE = {
  quick: 0,
  teacher: 0,
  competition: 'anchor-top'
};


function compositeComplexityOf(kp) {
  if (!kp) return 0;
  if (kp.structure && (kp.structure.allowBracket || kp.structure.allowMultDiv)) return 1;
  var sem = null;
  try {
    sem = require("shared/generator/core/kp-complex-semantics.js").resolveComplexSemantics(kp);
  } catch (e) {  }
  if (!sem || !sem.family) return 0;
  if (sem.family !== 'simple' && sem.family !== 'no-bracket') return 1;
  if (sem.allowBracket || sem.inverse) return 1;
  return 0;
}


function questionComplexityAdjustment(base, kp) {
  var tier = ComplexityStrategy.tierForDifficulty(base);
  if (tier === 'standard') return 1;
  if (tier === 'complex') return 2;
  return 0;
}


function modeAdjustment(mode, grade, hasUserDifficulty, base) {
  if (MODE_PROFILE[mode] !== 'anchor-top') return 0;
  if (hasUserDifficulty) return 0;
  if (grade == null) return 0;
  var anchor = StrategyConfig.difficultyAnchorOf(grade);
  if (!anchor) return 0;
  return Math.max(0, anchor[1] - base);
}


function resolveComposedDifficulty(options) {
  options = options || {};
  var base = options.base;
  if (typeof base !== 'number' || !isFinite(base)) {
    throw new StrategyError('base 必须是有限数字: ' + base, CODES.INVALID_REQUEST, { base: base });
  }

  var kp = options.knowledgePoint || null;
  var mode = options.mode || 'single-kp';
  var hasUser = options.hasUserDifficulty === true;

  if (hasUser) {
    return {
      composedDifficulty: applyEffective(base, 0),
      composition: {
        source: 'user',
        base: base,
        mode: mode,
        modeAdjustment: 0,
        questionComplexityTier: ComplexityStrategy.tierForDifficulty(base),
        questionComplexityAdjustment: 0,
        compositeAdjustment: 0
      }
    };
  }

  var qAdj = questionComplexityAdjustment(base, kp);
  var cAdj = compositeComplexityOf(kp);
  var mAdj = modeAdjustment(mode, options.grade, false, base);
  var composedDifficulty = applyEffective(base + mAdj + qAdj + cAdj, 0);

  if (MODE_PROFILE[mode] === 'anchor-top' && options.grade != null) {
    var anchor = StrategyConfig.difficultyAnchorOf(options.grade);
    if (anchor) composedDifficulty = Math.min(composedDifficulty, anchor[1]);
  }

  return {
    composedDifficulty: composedDifficulty,
    composition: {
      source: 'composed',
      base: base,
      mode: mode,
      modeAdjustment: mAdj,
      questionComplexityTier: ComplexityStrategy.tierForDifficulty(base),
      questionComplexityAdjustment: qAdj,
      compositeAdjustment: cAdj
    }
  };
}

module.exports = {
  DIFFICULTY_MIN: DIFFICULTY_MIN,
  DIFFICULTY_MAX: DIFFICULTY_MAX,
  applyEffective: applyEffective,
  computeEffectiveDifficulty: computeEffectiveDifficulty,
  compositeComplexityOf: compositeComplexityOf,
  modeAdjustment: modeAdjustment,
  questionComplexityAdjustment: questionComplexityAdjustment,
  resolveComposedDifficulty: resolveComposedDifficulty
};

};
__defs["shared/strategy/target-difficulty.js"] = function (module, exports, require) {

'use strict';

var StaticDifficulty = require("shared/strategy/static-difficulty.js");
var DifficultyStrategy = require("shared/strategy/difficulty-strategy.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

var DIFFICULTY_MIN = DifficultyStrategy.DIFFICULTY_MIN;
var DIFFICULTY_MAX = DifficultyStrategy.DIFFICULTY_MAX;

function clampUserDifficulty(n) {
  return Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, Math.round(Number(n))));
}

function resolveTargetDifficulty(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }
  if (!kp || typeof kp !== 'object') {
    throw new StrategyError('KnowledgePoint 不能为空（knowledgePoint 或 knowledgePointId）', CODES.INVALID_REQUEST);
  }

  var staticDifficulty = StaticDifficulty.resolveStaticDifficulty(kp, options.questionType, options.customParams).level;

  
  var allowOverride = options.allowDifficultyOverride !== false;
  var targetDifficulty;
  var source;
  var requestedDifficulty = null;

  if (options.difficulty != null) {
    if (typeof options.difficulty !== 'number' || !isFinite(options.difficulty)) {
      throw new StrategyError('difficulty 必须是有限数字: ' + options.difficulty, CODES.INVALID_REQUEST, { difficulty: options.difficulty });
    }
    requestedDifficulty = clampUserDifficulty(options.difficulty);
    if (allowOverride) {
      targetDifficulty = requestedDifficulty;
      source = 'user';
    } else {
      targetDifficulty = staticDifficulty;
      source = 'static';
    }
  } else {
    targetDifficulty = staticDifficulty;
    source = 'static';
  }

  
  var adaptive = options.adaptive === true;
  var adaptiveDelta = 0;
  if (adaptive) {
    if (options.adaptiveDelta != null && (typeof options.adaptiveDelta !== 'number' || !isFinite(options.adaptiveDelta))) {
      throw new StrategyError('adaptiveDelta 必须是有限数字: ' + options.adaptiveDelta, CODES.INVALID_REQUEST, { adaptiveDelta: options.adaptiveDelta });
    }
    adaptiveDelta = options.adaptiveDelta == null ? 0 : options.adaptiveDelta;
  }

  var effectiveDifficulty = adaptive
    ? DifficultyStrategy.applyEffective(targetDifficulty, adaptiveDelta)
    : targetDifficulty;

  
  var composed = DifficultyStrategy.resolveComposedDifficulty({
    base: targetDifficulty,
    knowledgePoint: kp,
    mode: options.mode,
    grade: kp.grade,
    hasUserDifficulty: requestedDifficulty != null
  });
  var composedDifficulty = adaptive
    ? DifficultyStrategy.applyEffective(composed.composedDifficulty, adaptiveDelta)
    : composed.composedDifficulty;

  return {
    targetDifficulty: targetDifficulty,
    source: source,
    requestedDifficulty: requestedDifficulty,
    allowOverride: allowOverride,
    adaptive: adaptive,
    adaptiveDelta: adaptiveDelta,
    effectiveDifficulty: effectiveDifficulty,
    staticDifficulty: staticDifficulty,
    composedDifficulty: composedDifficulty,
    difficultyComposition: composed.composition
  };
}

module.exports = {
  resolveTargetDifficulty: resolveTargetDifficulty,
  clampUserDifficulty: clampUserDifficulty
};

};
__defs["shared/strategy/structure-constraints.js"] = function (module, exports, require) {

'use strict';

var StaticDifficulty = require("shared/strategy/static-difficulty.js");
var NumberRangeStrategy = require("shared/strategy/number-range-strategy.js");
var Difficulty = require("shared/difficulty.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

function clampFinalLevel(level) {
  return Math.min(10, Math.max(1, Math.round(Number(level))));
}

function resolveStructureConstraints(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }
  if (!kp || typeof kp !== 'object') {
    throw new StrategyError('KnowledgePoint 不能为空（knowledgePoint 或 knowledgePointId）', CODES.INVALID_REQUEST);
  }

  
  var staticProfile = StaticDifficulty.resolveStaticDifficulty(kp, options.questionType, options.customParams);

  var finalLevel;
  if (options.finalDifficulty != null) {
    if (typeof options.finalDifficulty !== 'number' || !isFinite(options.finalDifficulty)) {
      throw new StrategyError('finalDifficulty 必须是有限数字: ' + options.finalDifficulty, CODES.INVALID_REQUEST, { finalDifficulty: options.finalDifficulty });
    }
    finalLevel = clampFinalLevel(options.finalDifficulty);
  } else {
    finalLevel = staticProfile.level;
  }

  var maxSteps;
  var allowBracket;
  var allowMultDiv;

  if (finalLevel === staticProfile.level) {
    
    maxSteps = staticProfile.steps;
    allowBracket = staticProfile.allowBracket;
    allowMultDiv = staticProfile.allowMultDiv;
  } else {
    
    var params = Difficulty.paramsFor('math', finalLevel);
    maxSteps = params.steps;
    allowBracket = !!params.allowBracket;
    allowMultDiv = !!params.allowMultDiv;
  }

  
  var numberRange = NumberRangeStrategy.resolveNumberRange({
    settings: options.settings,
    knowledgePoint: kp,
    questionType: options.questionType,
    customParams: options.customParams,
    level: finalLevel
  });

  return {
    finalDifficulty: finalLevel,
    maxSteps: maxSteps,
    allowBracket: allowBracket,
    allowMultDiv: allowMultDiv,
    numberRange: { min: numberRange.min, max: numberRange.max }
  };
}

module.exports = {
  resolveStructureConstraints: resolveStructureConstraints,
  clampFinalLevel: clampFinalLevel
};

};
__defs["shared/strategy/number-range-strategy.js"] = function (module, exports, require) {

'use strict';

var StaticDifficulty = require("shared/strategy/static-difficulty.js");
var Difficulty = require("shared/difficulty.js");
var PluginUtil = require("shared/common.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

var BASE_MAX = 20; 

function isValidRange(r) {
  return !!r && typeof r === 'object' &&
    typeof r.min === 'number' && isFinite(r.min) &&
    typeof r.max === 'number' && isFinite(r.max);
}

function normalizeRange(min, max, source) {
  if (min > max) {
    var t = min; min = max; max = t;
  }
  return { min: min, max: max, source: source };
}

function resolveNumberRange(options) {
  options = options || {};

  
  var userRange = options.settings && options.settings.numberRange;
  if (isValidRange(userRange)) {
    return normalizeRange(userRange.min, userRange.max, 'user-settings');
  }

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }

  
  var kpRange = kp && kp.numeric && kp.numeric.range ? kp.numeric.range : null;
  if (isValidRange(kpRange)) {
    return normalizeRange(kpRange.min, kpRange.max, 'knowledge-point');
  }

  
  if (kp) {
    var staticProfile = StaticDifficulty.resolveStaticDifficulty(kp, options.questionType, options.customParams);
    if (staticProfile && typeof staticProfile.scale === 'number') {
      return normalizeRange(1, PluginUtil.diffMax(BASE_MAX, staticProfile.level), 'difficulty-static');
    }
  }

  
  var level = options.level != null ? options.level : 3;
  var profile = Difficulty.paramsFor('math', level);
  return normalizeRange(1, PluginUtil.diffMax(BASE_MAX, profile.level), 'difficulty-profile');
}

module.exports = {
  resolveNumberRange: resolveNumberRange,
  isValidRange: isValidRange,
  normalizeRange: normalizeRange,
  BASE_MAX: BASE_MAX
};

};
__defs["shared/strategy/cognitive-strategy.js"] = function (module, exports, require) {

'use strict';

var Registry = require("shared/question-type-registry.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;


var ENUM = Registry.COGNITIVE_LEVELS;


var UNIFIED_LEVELS = ['recognize', 'understand', 'apply'];
UNIFIED_LEVELS.forEach(function (l) {
  if (ENUM.indexOf(l) === -1) {
    throw new Error('cognitive-strategy: 统一层级 ' + l + ' 不在 Registry.COGNITIVE_LEVELS 中');
  }
});


var FULL_TO_UNIFIED = {
  recall: 'recognize', recognize: 'recognize',
  understand: 'understand',
  apply: 'apply', analyze: 'apply', evaluate: 'apply', create: 'apply'
};


var KP_RAW_TO_UNIFIED = {
  '了解': 'recognize',
  '理解': 'understand',
  '掌握': 'apply',
  '运用': 'apply'
};

function toUnified(level) {
  if (typeof level !== 'string') return null;
  if (UNIFIED_LEVELS.indexOf(level) !== -1) return level;
  return FULL_TO_UNIFIED[level] || null;
}

function kpToUnified(kp) {
  
  var num = kp.cognition && kp.cognition.level;
  if (typeof num === 'number' && isFinite(num)) {
    if (num >= 0.67) return 'apply';       
    if (num >= 0.33) return 'understand';  
    return 'recognize';                    
  }
  var raw = (kp.cognition && kp.cognition.raw) ||
    (kp.legacy && kp.legacy.cognitive_level);
  if (raw) {
    if (KP_RAW_TO_UNIFIED[raw]) return KP_RAW_TO_UNIFIED[raw];
    if (ENUM.indexOf(raw) !== -1) return toUnified(raw);
  }
  return null;
}

function supportedUnifiedSet(typeId) {
  var t = Registry.get(typeId);
  if (!t) {
    throw new StrategyError('非法 questionTypeId: ' + typeId, CODES.INVALID_REQUEST, { questionTypeId: typeId });
  }
  var set = {};
  (t.cognitiveLevels || []).forEach(function (l) {
    var u = toUnified(l);
    if (u) set[u] = true;
  });
  return set;
}

function resolveCognitiveLevel(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }

  
  var typeId = options.questionType || options.questionTypeId || null;
  var allowed = typeId ? supportedUnifiedSet(typeId) : null;

  
  if (options.cognitiveLevel != null) {
    if (typeof options.cognitiveLevel !== 'string' || ENUM.indexOf(options.cognitiveLevel) === -1) {
      throw new StrategyError('非法 cognitiveLevel（必须来自 Registry.COGNITIVE_LEVELS）: ' + options.cognitiveLevel, CODES.INVALID_REQUEST, { cognitiveLevel: options.cognitiveLevel });
    }
    var mapped = toUnified(options.cognitiveLevel);
    if (!allowed || allowed[mapped]) return mapped;
    
  }

  
  if (kp) {
    var kpLevel = kpToUnified(kp);
    if (kpLevel && (!allowed || allowed[kpLevel])) return kpLevel;
  }

  
  if (allowed) {
    var order = ['understand', 'recognize', 'apply'];
    for (var i = 0; i < order.length; i++) {
      if (allowed[order[i]]) return order[i];
    }
    for (i = 0; i < UNIFIED_LEVELS.length; i++) {
      if (allowed[UNIFIED_LEVELS[i]]) return UNIFIED_LEVELS[i];
    }
  }
  return 'understand';
}

module.exports = {
  UNIFIED_LEVELS: UNIFIED_LEVELS,
  toUnified: toUnified,
  kpToUnified: kpToUnified,
  supportedUnifiedSet: supportedUnifiedSet,
  resolveCognitiveLevel: resolveCognitiveLevel
};

};
__defs["shared/strategy/spiral-strategy.js"] = function (module, exports, require) {

'use strict';

var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

var MODES = ['prototype', 'numeric', 'presentation', 'context', 'structure', 'transfer'];
var MODE_MAX = MODES.length; 

function toIntOr(n, fallback) {
  n = Number(n);
  if (!isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function resolveSpiral(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }

  var spiral = options.spiral_level != null ? options.spiral_level : options.spiralLevel;
  if (spiral == null && kp) {
    spiral = (kp.spiral && kp.spiral.level != null) ? kp.spiral.level : null;
  }
  var maxSpiral = options.max_spiral_level != null ? options.max_spiral_level : options.maxSpiralLevel;
  if (maxSpiral == null && kp) {
    maxSpiral = (kp.spiral && kp.spiral.maxLevel != null) ? kp.spiral.maxLevel : null;
  }

  var spiralLevel = toIntOr(spiral, 1);
  var maxLevel = toIntOr(maxSpiral, 1);

  
  if (spiralLevel > maxLevel) spiralLevel = maxLevel;

  var modeIdx = Math.min(spiralLevel, MODE_MAX) - 1;
  var variationMode = MODES[modeIdx];

  return {
    spiralLevel: spiralLevel,
    variationMode: variationMode
  };
}

module.exports = {
  MODES: MODES,
  resolveSpiral: resolveSpiral
};

};
__defs["shared/strategy/context-strategy.js"] = function (module, exports, require) {

'use strict';

var Registry = require("shared/question-type-registry.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var CognitiveStrategy = require("shared/strategy/cognitive-strategy.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;


var CONTEXT_TIERS = ['pure', 'simple', 'standard', 'complex'];
var HIGH_SPIRAL_THRESHOLD = 4; 

function resolveContextType(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }

  var typeId = options.questionType || options.questionTypeId;
  var t = Registry.get(typeId);
  if (!t) {
    throw new StrategyError('非法 questionTypeId: ' + typeId, CODES.INVALID_REQUEST, { questionTypeId: typeId });
  }

  
  if (!t.supports || t.supports.context !== true) return 'none';

  
  var base = null;
  if (kp) {
    var def = (kp.context && kp.context.defaults && kp.context.defaults[0]) ||
      kp.context_default ||
      (kp.legacy && kp.legacy.context_default);
    if (CONTEXT_TIERS.indexOf(def) !== -1) base = def;
  }
  if (!base) base = 'standard';

  
  var spiralLevel = Number(options.spiralLevel);
  if (!isFinite(spiralLevel) || spiralLevel < 1) spiralLevel = 1;
  var unified = CognitiveStrategy.toUnified(options.cognitiveLevel);
  var upgrade = spiralLevel >= HIGH_SPIRAL_THRESHOLD || unified === 'apply';

  if (upgrade) {
    var idx = CONTEXT_TIERS.indexOf(base);
    if (idx !== -1 && idx < CONTEXT_TIERS.length - 1) base = CONTEXT_TIERS[idx + 1];
  }

  return base;
}

module.exports = {
  CONTEXT_TIERS: CONTEXT_TIERS,
  HIGH_SPIRAL_THRESHOLD: HIGH_SPIRAL_THRESHOLD,
  resolveContextType: resolveContextType
};

};
__defs["shared/strategy/constraint-builder.js"] = function (module, exports, require) {

'use strict';

var Difficulty = require("shared/difficulty.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

function requirePiece(pieces, key, label) {
  if (pieces[key] == null) {
    throw new StrategyError('ConstraintBuilder 缺少部件: ' + (label || key), CODES.INVALID_PLAN, { missing: key });
  }
  return pieces[key];
}

function buildConstraints(pieces) {
  pieces = pieces || {};

  var difficulty = requirePiece(pieces, 'difficulty', 'difficulty（最终难度）');
  var questionType = requirePiece(pieces, 'questionType', 'questionType');
  var cognitiveLevel = requirePiece(pieces, 'cognitiveLevel', 'cognitiveLevel');
  var spiralLevel = requirePiece(pieces, 'spiralLevel', 'spiralLevel');
  var contextType = requirePiece(pieces, 'contextType', 'contextType');
  var numberRange = requirePiece(pieces, 'numberRange', 'numberRange');
  var maxSteps = requirePiece(pieces, 'maxSteps', 'maxSteps');
  var allowBracket = requirePiece(pieces, 'allowBracket', 'allowBracket');
  var allowMultDiv = requirePiece(pieces, 'allowMultDiv', 'allowMultDiv');

  if (typeof difficulty !== 'number' || !isFinite(difficulty)) {
    throw new StrategyError('difficulty 必须是有限数字: ' + difficulty, CODES.INVALID_PLAN);
  }
  if (!numberRange || typeof numberRange.min !== 'number' || typeof numberRange.max !== 'number' || numberRange.min > numberRange.max) {
    throw new StrategyError('numberRange 非法: ' + JSON.stringify(numberRange), CODES.INVALID_PLAN);
  }

  
  var scale = Difficulty.paramsFor('math', Math.round(difficulty)).scale;

  return {
    difficulty: Math.round(difficulty),
    questionType: questionType,
    cognitiveLevel: cognitiveLevel,
    spiralLevel: spiralLevel,
    contextType: contextType,
    scale: scale,
    numberRange: { min: numberRange.min, max: numberRange.max },
    maxSteps: maxSteps,
    allowBracket: !!allowBracket,
    allowMultDiv: !!allowMultDiv
  };
}

module.exports = {
  buildConstraints: buildConstraints
};

};
__defs["shared/strategy/strategy-validator.js"] = function (module, exports, require) {

'use strict';

var KnowledgePoint = require("shared/knowledge-point.js");
var Registry = require("shared/question-type-registry.js");
var Resolver = require("shared/capability-resolver.js");

var CONTEXT_LEGAL = ['pure', 'simple', 'standard', 'complex', 'none'];

function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

function validatePlan(plan) {
  var errors = [];

  if (!plan || typeof plan !== 'object') {
    return { valid: false, errors: ['Plan 必须是对象'] };
  }

  
  var kp = null;
  
  var kpIds = (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds.length)
    ? plan.knowledgePointIds.slice()
    : (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId ? [plan.knowledgePointId] : []);
  if (!kpIds.length) {
    errors.push('① knowledgePointIds 必填（数组）');
  } else {
    kpIds.forEach(function (id) {
      var k = KnowledgePoint.get(id);
      if (!k) errors.push('① 知识点不存在: ' + id);
    });
    kp = KnowledgePoint.get(kpIds[0]);
  }

  
  if (!plan.questionTypeId || typeof plan.questionTypeId !== 'string') {
    errors.push('② questionTypeId 必填');
  } else if (!Registry.has(plan.questionTypeId)) {
    errors.push('② 非法 questionTypeId: ' + plan.questionTypeId);
  }

  
  if (kp && plan.questionTypeId && Registry.has(plan.questionTypeId)) {
    var supported = Resolver.getCapabilities(kp).questionTypes || [];
    if (supported.indexOf(plan.questionTypeId) === -1) {
      errors.push('③ KP 不支持该题型: ' + plan.questionTypeId + '（支持: ' + supported.join(',') + '）');
    }
  }

  
  if (plan.cognitiveLevel != null) {
    if (typeof plan.cognitiveLevel !== 'string' || Registry.COGNITIVE_LEVELS.indexOf(plan.cognitiveLevel) === -1) {
      errors.push('④ 非法 cognitiveLevel: ' + plan.cognitiveLevel);
    }
  }

  
  if (plan.difficulty == null || !isInt(plan.difficulty) || plan.difficulty < 1 || plan.difficulty > 10) {
    errors.push('⑤ difficulty 必须是 1-10 的整数: ' + plan.difficulty);
  }

  
  if (plan.spiralLevel == null || !isInt(plan.spiralLevel) || plan.spiralLevel < 1 || plan.spiralLevel > 6) {
    errors.push('⑥ spiralLevel 必须是 1-6 的整数: ' + plan.spiralLevel);
  } else if (kp && isInt(plan.spiralLevel)) {
    
    var maxSpiral = (kp.spiral && typeof kp.spiral.maxLevel === 'number') ? kp.spiral.maxLevel : 1;
    if (plan.spiralLevel > maxSpiral) {
      errors.push('⑦ spiralLevel ' + plan.spiralLevel + ' 超过 maxSpiralLevel ' + maxSpiral);
    }
  }

  
  if (plan.count == null || !isInt(plan.count) || plan.count < 1) {
    errors.push('⑧ count 必须是 >=1 的整数: ' + plan.count);
  }

  
  var constraints = plan.constraints || {};
  var nr = constraints.numberRange;
  if (!nr || typeof nr !== 'object' || typeof nr.min !== 'number' || !isFinite(nr.min) ||
      typeof nr.max !== 'number' || !isFinite(nr.max) || nr.min > nr.max) {
    errors.push('⑨ numberRange 必须是 {min,max} 且 min<=max: ' + JSON.stringify(nr));
  }

  
  if (constraints.maxSteps == null || !isInt(constraints.maxSteps) || constraints.maxSteps < 1) {
    errors.push('⑩ maxSteps 必须是 >=1 的整数: ' + constraints.maxSteps);
  }

  
  if (plan.contextType != null) {
    if (CONTEXT_LEGAL.indexOf(plan.contextType) === -1) {
      errors.push('⑪ 非法 contextType: ' + plan.contextType);
    }
  }

  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  CONTEXT_LEGAL: CONTEXT_LEGAL,
  validatePlan: validatePlan
};

};
__defs["shared/strategy/strategy-error.js"] = function (module, exports, require) {

'use strict';

function StrategyError(message, code, detail) {
  Error.call(this);
  this.name = 'StrategyError';
  this.message = message;
  this.code = code || 'STRATEGY_ERROR';
  this.detail = detail || null;
}

StrategyError.prototype = Object.create(Error.prototype);
StrategyError.prototype.constructor = StrategyError;

StrategyError.CODES = {
  KP_NOT_FOUND: 'KP_NOT_FOUND',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_PLAN: 'INVALID_PLAN',
  NO_CAPABILITY: 'NO_CAPABILITY',
  GENERATOR_MISMATCH: 'GENERATOR_MISMATCH',
  
  
  UNSUPPORTED_SUBJECT: 'UNSUPPORTED_SUBJECT',
  
  GENERATOR_UNSUPPORTED: 'GENERATOR_UNSUPPORTED',
  
  COMPOSITE_UNSUPPORTED: 'COMPOSITE_UNSUPPORTED'
};

function isStrategyError(err) {
  return err && err.name === 'StrategyError';
}

module.exports = {
  StrategyError: StrategyError,
  isStrategyError: isStrategyError
};
};
__defs["shared/strategy/strategy-request.js"] = function (module, exports, require) {

'use strict';

var StrategyConfig = require("shared/strategy-config.js");

var LEGACY_UI_KEYS = ['subject', 'grade', 'count', 'difficulty', 'subtype', 'questionType', 'knowledgePointId', 'knowledgePoints'];


var VALID_QUESTION_TYPES = [
  'oral', 'calc', 'fill', 'choice', 'judge', 'apply', 'open', 'geometry', 'recognize'
];


var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 10;


var SPIRAL_MIN = 1;
var SPIRAL_MAX = 6;





var VALID_MODES = ['single-kp', 'multi-kp', 'comprehensive', 'adaptive', 'quick', 'teacher', 'competition'];
var MODE_ALIAS = {
  'single': 'single-kp', 'single-kp': 'single-kp', 'kp': 'single-kp',
  'multi': 'multi-kp', 'multi-kp': 'multi-kp',
  'comprehensive': 'comprehensive', 'zonghe': 'comprehensive',
  'adaptive': 'adaptive', 'adaptive-kp': 'adaptive',
  'quick': 'quick', 'teacher': 'teacher', 'competition': 'competition'
};


function resolveKnowledgePointIds(request) {
  if (!request || typeof request !== 'object') return [];
  if (Array.isArray(request.knowledgePointIds) && request.knowledgePointIds.length) {
    return request.knowledgePointIds.filter(function (x) { return typeof x === 'string' && x; });
  }
  if (Array.isArray(request.knowledgePoints) && request.knowledgePoints.length) {
    return request.knowledgePoints.filter(function (x) { return typeof x === 'string' && x; });
  }
  if (typeof request.knowledgePointId === 'string' && request.knowledgePointId) return [request.knowledgePointId];
  if (typeof request.kp === 'string' && request.kp) return [request.kp];
  return [];
}


function normalizeRequest(request) {
  request = request || {};
  var out = Object.assign({}, request);
  out.knowledgePointIds = resolveKnowledgePointIds(request);
  delete out.knowledgePointId;
  delete out.knowledgePoints;
  delete out.kp;
  if (out.count == null && typeof out.volume === 'number' && out.volume >= 1) {
    out.count = Math.floor(out.volume);
  }
  if (out.spiralLevel == null && out.spiral_level != null) out.spiralLevel = out.spiral_level;
  if (out.mode != null && MODE_ALIAS[String(out.mode)] != null) out.mode = MODE_ALIAS[String(out.mode)];
  return out;
}

function normalizeLegacyParams(params) {
  var out = {};
  
  if (params.subject != null) out.subject = params.subject;
  if (params.grade != null) out.grade = params.grade;
  if (params.count != null) out.count = Math.max(1, Math.floor(params.count));
  else if (params.volume != null) out.count = Math.max(1, Math.floor(params.volume));
  if (params.difficulty != null) {
    var d = Math.max(DIFFICULTY_MIN, Math.min(DIFFICULTY_MAX, Math.floor(params.difficulty)));
    out.targetDifficulty = d;
  }
  if (params.subtype != null) out.subtype = params.subtype;
  if (params.questionType != null) out.questionType = params.questionType;
  return out;
}

function validateRequest(req) {
  var errors = [];

  if (!req || typeof req !== 'object') {
    errors.push('Request 必须是对象');
    return { valid: false, errors: errors };
  }

  
  
  
  var kpIds = resolveKnowledgePointIds(req);
  var hasSubjectGrade = req.subject && req.grade != null;
  if (!kpIds.length && !hasSubjectGrade && req.unitId == null) {
    errors.push('缺少 knowledgePointIds（或旧 knowledgePointId / knowledgePoints / subject+grade / unitId）');
  }

  
  if (req.mode === 'teacher' && req.unitId == null) {
    errors.push('teacher 模式需要 unitId（单元知识点池）');
  }
  if (req.mode === 'quick' && req.grade == null) {
    errors.push('quick 模式需要 grade（年级知识点池）');
  }
  if (req.mode === 'competition' && req.grade == null && req.unitId == null) {
    errors.push('competition 模式需要 grade 或 unitId（知识点池来源）');
  }
  if (kpIds.length) kpIds.forEach(function (id) {
    if (typeof id !== 'string' || !id) errors.push('knowledgePointIds 元素必须是非空字符串');
  });

  
  if (req.questionType != null) {
    if (typeof req.questionType !== 'string') {
      errors.push('questionType 必须是字符串');
    } else if (VALID_QUESTION_TYPES.indexOf(req.questionType) === -1) {
      errors.push('非法 questionType: ' + req.questionType);
    }
  }

  
  if (req.questionTypes != null && !Array.isArray(req.questionTypes)) {
    errors.push('questionTypes 必须是数组');
  }

  
  if (req.mode != null && MODE_ALIAS[String(req.mode)] == null) {
    errors.push('非法 mode: ' + req.mode + '（应为 ' + VALID_MODES.join('/') + '）');
  }

  
  if (req.difficulty != null) {
    var df = req.difficulty;
    if (typeof df !== 'number' || df < DIFFICULTY_MIN || df > DIFFICULTY_MAX || df % 1 !== 0) {
      errors.push('difficulty 必须是 1-10 的整数');
    }
  }

  
  if (req.targetDifficulty != null) {
    var td = req.targetDifficulty;
    if (typeof td !== 'number' || td < DIFFICULTY_MIN || td > DIFFICULTY_MAX || td % 1 !== 0) {
      errors.push('targetDifficulty 必须是 1-10 的整数');
    }
  }

  
  var cval = req.count != null ? req.count : req.volume;
  if (cval != null) {
    var c = cval;
    if (typeof c !== 'number' || c < 1 || c % 1 !== 0) {
      errors.push('count 必须是 >=1 的整数');
    }
  }

  
  if (req.spiralLevel != null || req.spiral_level != null) {
    var sl = req.spiralLevel != null ? req.spiralLevel : req.spiral_level;
    if (typeof sl !== 'number' || sl < SPIRAL_MIN || sl > SPIRAL_MAX || sl % 1 !== 0) {
      errors.push('spiralLevel 必须是 1-6 的整数');
    }
  }

  
  if (req.unitId != null && typeof req.unitId !== 'string') {
    errors.push('unitId 必须是字符串');
  }

  
  if (req.combine != null && typeof req.combine !== 'boolean') {
    errors.push('combine 必须是布尔值');
  }

  
  if (req.previousGenerationId != null && typeof req.previousGenerationId !== 'string') {
    errors.push('previousGenerationId 必须是字符串');
  }

  
  if (req.subject != null && typeof req.subject !== 'string') {
    errors.push('subject 必须是字符串');
  }
  if (req.grade != null && (typeof req.grade !== 'number' || req.grade < 1 || req.grade > 6 || req.grade % 1 !== 0)) {
    errors.push('grade 必须是 1-6 的整数');
  }

  
  if (req.learnerProfile != null && typeof req.learnerProfile !== 'object') {
    errors.push('learnerProfile 必须是对象');
  }

  
  if (req.settings != null && typeof req.settings !== 'object') {
    errors.push('settings 必须是对象');
  }

  
  var forbidden = ['svg', 'html', 'generate', 'generator', 'render', 'template'];
  forbidden.forEach(function (k) {
    if (req[k] !== undefined) {
      errors.push('禁止字段: ' + k + ' (不允许在 Request 中包含 SVG/HTML/生成器)');
    }
  });

  return { valid: errors.length === 0, errors: errors };
}

function createRequest(params) {
  var req = Object.assign({}, params || {});
  return req;
}

function createFromLegacyUI(legacyParams) {
  
  var base = normalizeLegacyParams(legacyParams || {});
  
  base._legacy = true;
  return base;
}

function isLegacyRequest(req) {
  return req && req._legacy === true;
}

module.exports = {
  VALID_QUESTION_TYPES: VALID_QUESTION_TYPES,
  DIFFICULTY_MIN: DIFFICULTY_MIN,
  DIFFICULTY_MAX: DIFFICULTY_MAX,
  SPIRAL_MIN: SPIRAL_MIN,
  SPIRAL_MAX: SPIRAL_MAX,
  VALID_MODES: VALID_MODES,
  MODE_ALIAS: MODE_ALIAS,
  resolveKnowledgePointIds: resolveKnowledgePointIds,
  normalizeRequest: normalizeRequest,
  normalizeLegacyParams: normalizeLegacyParams,
  validateRequest: validateRequest,
  createRequest: createRequest,
  createFromLegacyUI: createFromLegacyUI,
  isLegacyRequest: isLegacyRequest
};
};
__defs["shared/strategy/strategy-result.js"] = function (module, exports, require) {

'use strict';

function createStrategyResult(plans, meta, warnings) {
  var m = {
    engine: 'strategy-v1',
    version: '1.0',
    generatedAt: new Date().toISOString()
  };
  
  if (meta && typeof meta === 'object') {
    for (var k in meta) {
      if (Object.prototype.hasOwnProperty.call(meta, k)) m[k] = meta[k];
    }
  }
  return {
    plans: plans || [],
    meta: m,
    warnings: warnings || []
  };
}

function validateStrategyResult(result) {
  var errors = [];

  if (!result || typeof result !== 'object') {
    return { valid: false, errors: ['Result 必须是对象'] };
  }

  if (!Array.isArray(result.plans)) {
    return { valid: false, errors: ['plans 必须是数组'] };
  }

  for (var i = 0; i < result.plans.length; i++) {
    var plan = result.plans[i];
    if (!plan || typeof plan !== 'object') {
      return { valid: false, errors: ['plan[' + i + '] 必须是对象'] };
    }
    
    var ids = (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds.length)
      ? plan.knowledgePointIds
      : (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId ? [plan.knowledgePointId] : []);
    if (!ids.length) {
      return { valid: false, errors: ['plan[' + i + '] 缺少 knowledgePointIds'] };
    }
    for (var j = 0; j < ids.length; j++) {
      if (typeof ids[j] !== 'string' || !ids[j]) {
        return { valid: false, errors: ['plan[' + i + '] knowledgePointIds 元素必须是非空字符串'] };
      }
    }
    if (!plan.questionTypeId || typeof plan.questionTypeId !== 'string') {
      return { valid: false, errors: ['plan[' + i + '] 缺少 questionTypeId'] };
    }
  }

  if (result.meta && typeof result.meta !== 'object') {
    return { valid: false, errors: ['meta 必须是对象'] };
  }
  if (result.warnings && !Array.isArray(result.warnings)) {
    return { valid: false, errors: ['warnings 必须是数组'] };
  }

  
  var forbidden = ['questions', 'svg', 'html', 'dom', 'render', 'renderHtml'];
  for (var i = 0; i < forbidden.length; i++) {
    var k = forbidden[i];
    if (result[k] !== undefined) {
      return { valid: false, errors: ['禁止字段: ' + k + ' (不允许在 StrategyResult 中包含题目/HTML/SVG)'] };
    }
  }

  return { valid: true, errors: [] };
}

module.exports = {
  createStrategyResult: createStrategyResult,
  validateStrategyResult: validateStrategyResult
};
};
__defs["shared/strategy/question-plan.js"] = function (module, exports, require) {

'use strict';

var StrategyConfig = require("shared/strategy-config.js");
var Registry = require("shared/question-type-registry.js");

var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 10;
var SPIRAL_MIN = 1;
var SPIRAL_MAX = 6;

var VALID_COGNITIVE_LEVELS = ['recall', 'recognize', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

var VALID_CONTEXT_TYPES = ['pure', 'simple', 'standard', 'complex'];


function planKnowledgePointIds(plan) {
  if (!plan || typeof plan !== 'object') return [];
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds.length) {
    return plan.knowledgePointIds.filter(function (x) { return typeof x === 'string' && x; });
  }
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return [plan.knowledgePointId];
  return [];
}


function planPrimaryKpId(plan) {
  var ids = planKnowledgePointIds(plan);
  return ids.length ? ids[0] : null;
}

function validateQuestionPlan(plan) {
  var errors = [];

  if (!plan || typeof plan !== 'object') {
    errors.push('Plan 必须是对象');
    return { valid: false, errors: errors };
  }

  
  var kpIds = planKnowledgePointIds(plan);
  if (!kpIds.length) {
    errors.push('knowledgePointIds 是必填数组（元素为非空字符串）');
  }

  if (!plan.questionTypeId || typeof plan.questionTypeId !== 'string') {
    errors.push('questionTypeId 是必填字符串');
  } else if (!['oral', 'calc', 'fill', 'choice', 'judge', 'apply', 'open', 'geometry', 'recognize'].includes(plan.questionTypeId)) {
    errors.push('非法 questionTypeId: ' + plan.questionTypeId);
  }

  
  if (plan.cognitiveLevel != null) {
    if (typeof plan.cognitiveLevel !== 'string' || !VALID_COGNITIVE_LEVELS.includes(plan.cognitiveLevel)) {
      errors.push('非法 cognitiveLevel: ' + plan.cognitiveLevel);
    }
  }

  
  if (plan.difficulty != null) {
    var d = plan.difficulty;
    if (typeof d !== 'number' || d < 1 || d > 10 || d % 1 !== 0) {
      errors.push('difficulty 必须是 1-10 的整数');
    }
  }

  
  if (plan.spiralLevel != null) {
    var sl = plan.spiralLevel;
    if (typeof sl !== 'number' || sl < 1 || sl > 6 || sl % 1 !== 0) {
      errors.push('spiralLevel 必须是 1-6 的整数');
    }
  }

  
  if (plan.count != null) {
    var c = plan.count;
    if (typeof c !== 'number' || c < 1 || c % 1 !== 0) {
      errors.push('count 必须是 >=1 的整数');
    }
  }

  
  if (plan.constraints != null) {
    if (typeof plan.constraints !== 'object') {
      errors.push('constraints 必须是对象');
    } else {
      var cst = plan.constraints;

      if (cst.numberRange != null) {
        if (typeof cst.numberRange !== 'object' || cst.numberRange === null ||
            cst.numberRange.min == null || cst.numberRange.max == null) {
          errors.push('constraints.numberRange 必须是 {min, max} 对象');
        } else if (typeof cst.numberRange.min !== 'number' || typeof cst.numberRange.max !== 'number' ||
                   cst.numberRange.min > cst.numberRange.max) {
          errors.push('constraints.numberRange.min/max 必须是数字且 min <= max');
        }
      }

      if (cst.maxSteps != null && (typeof cst.maxSteps !== 'number' || cst.maxSteps < 1 || cst.maxSteps % 1 !== 0)) {
        errors.push('constraints.maxSteps 必须是 >=1 的整数');
      }

      if (cst.allowBracket != null && typeof cst.allowBracket !== 'boolean') {
        errors.push('constraints.allowBracket 必须是布尔值');
      }

      if (cst.allowMultDiv != null && typeof cst.allowMultDiv !== 'boolean') {
        errors.push('constraints.allowMultDiv 必须是布尔值');
      }

      if (cst.contextType != null) {
        if (typeof cst.contextType !== 'string' || !['pure', 'simple', 'standard', 'complex'].includes(cst.contextType)) {
          errors.push('constraints.contextType 必须是 pure/simple/standard/complex 之一');
        }
      }
    }
  }

  
  var VALID_STYLES = ['calc', 'fill', 'choice', 'judge', 'story', 'shape', 'open'];
  if (plan.style != null) {
    if (typeof plan.style !== 'string' || !VALID_STYLES.includes(plan.style)) {
      errors.push('非法 style: ' + plan.style + '（应为 ' + VALID_STYLES.join('/') + '）');
    }
  }
  if (plan.svgTemplate != null && typeof plan.svgTemplate !== 'string') {
    errors.push('svgTemplate 必须是字符串');
  }
  if (plan.complexity != null) {
    var cx = plan.complexity;
    if (typeof cx !== 'object' || cx === null) {
      errors.push('complexity 必须是对象');
    } else {
      if (!['simple', 'standard', 'complex'].includes(cx.tier)) {
        errors.push('非法 complexity.tier: ' + cx.tier + '（应为 simple/standard/complex）');
      }
      if (cx.rangeBoost != null && (typeof cx.rangeBoost !== 'number' || cx.rangeBoost < 0 || cx.rangeBoost > 2)) {
        errors.push('complexity.rangeBoost 必须是 0-2 的数字');
      }
      if (cx.mixLevel != null && (typeof cx.mixLevel !== 'number' || cx.mixLevel < 0 || cx.mixLevel > 2)) {
        errors.push('complexity.mixLevel 必须是 0-2 的数字');
      }
    }
  }

  
  var forbidden = ['svg', 'html', 'generate', 'generator', 'render', 'template', 'execute', 'executeFunction'];
  forbidden.forEach(function (k) {
    if (plan[k] !== undefined) {
      errors.push('禁止字段: ' + k + ' (不允许在 Plan 中包含 SVG/HTML/生成器)');
    }
  });

  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  planKnowledgePointIds: planKnowledgePointIds,
  planPrimaryKpId: planPrimaryKpId,
  validateQuestionPlan: validateQuestionPlan
};
};
__defs["shared/strategy/strategy-resolver.js"] = function (module, exports, require) {

'use strict';

var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var StrategyErrorCodes = require("shared/strategy/strategy-error.js").StrategyError.CODES;

function resolveKnowledgePoint(kpId) {
  if (!kpId || typeof kpId !== 'string') {
    throw new StrategyError('knowledgePointId 必填且必须是字符串', StrategyErrorCodes.INVALID_REQUEST);
  }
  var kp = KnowledgePoint.get(kpId);
  if (!kp) {
    throw new StrategyError('知识点不存在: ' + kpId, StrategyErrorCodes.KP_NOT_FOUND, { knowledgePointId: kpId });
  }
  return kp;
}

function resolveMultiple(ids) {
  if (!Array.isArray(ids)) {
    throw new Error('ids 必须是数组');
  }
  var results = {};
  ids.forEach(function (id) {
    try {
      results[id] = KnowledgePoint.get(id);
    } catch (e) {
      results[id] = null;
    }
  });
  return results;
}

function hasKnowledgePoint(id) {
  return KnowledgePoint.get(id) !== null;
}

module.exports = {
  resolveKnowledgePoint: resolveKnowledgePoint,
  resolveMultiple: resolveMultiple,
  hasKnowledgePoint: hasKnowledgePoint
};
};
__defs["shared/generator/semantic-question-bridge.js"] = function (module, exports, require) {

'use strict';

function getPluginUtil() {
  return (typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof global !== 'undefined' && global.PluginUtil ? global.PluginUtil
      : (typeof require !== 'undefined' ? require("shared/render.js") : null)));
}

function getQCheck() {
  var PU = getPluginUtil();
  if (PU && typeof PU.defaultQCheck === 'function') return PU.defaultQCheck;
  if (typeof defaultQCheck === 'function') return defaultQCheck;
  if (typeof require !== 'undefined') return require("shared/check.js").defaultQCheck;
  return null;
}

function safeStr(v) {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? '对' : '错';
  return String(v);
}


function toQuestion(sq) {
  sq = sq || {};
  var prompt = safeStr(sq.prompt);
  var answer = sq.answer;
  var ui = getPluginUtil();
  var qcheck = getQCheck();

  var q = {
    q: prompt,
    text: prompt,
    answer: answer,
    answerMode: sq.answerMode || 'input',
    hint: sq.hint != null ? sq.hint : null,
    knowledgePointId: sq.knowledgePointId,
    questionType: sq.questionType,
    type: sq.type || sq.questionType || null,
    difficulty: sq.difficulty,
    difficultyParams: sq.difficultyParams,
    numberRange: sq.numberRange,
    seed: sq.seed,
    data: sq.data || {}
  };

  
  
  
  if (q.answer && typeof q.answer === 'object' && q.answer.explanation == null) {
    var ansVal = q.answer.value != null ? String(q.answer.value) : '';
    if (ansVal) q.answer.explanation = prompt.replace(/\s*=\s*\?\s*$/, ' = ' + ansVal);
    else q.answer.explanation = '答案：' + ansVal;
  }

  
  var options = (sq.data && Array.isArray(sq.data.options) && sq.data.options.length) ? sq.data.options : null;
  if (options) {
    q.inputType = 'choice';
    q.options = options.map(function (o) { return safeStr(o); });
    q.answer = safeStr(sq.answer);
  } else if (Array.isArray(sq.answer)) {
    q.inputType = 'multi';
  } else {
    q.inputType = 'text';
  }

  
  if (q.answerMode === 'read-aloud' || (q.answer == null && q.answerMode === 'read-aloud')) {
    q.inputType = 'none';
  }

  
  q.render = function (idx) {
    if (ui && typeof ui.renderCard === 'function') return ui.renderCard(q, idx, {});
    
    var head = '<div class="question-card" data-index="' + idx + '"><div class="q-header"><span class="num">' + (idx + 1) + '</span> <span class="q-text">' + prompt + '</span></div>';
    var field = (q.inputType === 'choice' && q.options)
      ? '<div class="options">' + q.options.map(function (o) { return '<button type="button" class="opt" data-val="' + o + '">' + o + '</button>'; }).join('') + '</div>'
      : '<input type="text" class="answer-inp" data-index="' + idx + '">';
    return head + field + '</div>';
  };

  
  q.check = function (answers, idx) {
    if (q.inputType === 'none') return true;
    if (qcheck) return !!qcheck(q, answers, idx);
    
    var ua = Array.isArray(answers) ? answers[idx] : (answers ? answers[idx] : undefined);
    var norm = function (v) { return String(v == null ? '' : v).trim(); };
    return norm(ua) === norm(Array.isArray(q.answer) ? q.answer.join('') : q.answer);
  };

  return q;
}


function toQuestions(sems) {
  if (!Array.isArray(sems)) return [];
  return sems.map(function (sq) { return toQuestion(sq); });
}

module.exports = {
  toQuestion: toQuestion,
  toQuestions: toQuestions
};

};
__defs["shared/capability-resolver.js"] = function (module, exports, require) {

'use strict';

var Ontology = require("shared/knowledge-ontology.js");
var Registry = require("shared/question-type-registry.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var CapabilityModel = require("shared/capability-model.js");
var Matrix = require("shared/capability-matrix.js");

function resolve(canonicalKp) {
  
  return CapabilityModel.resolveCapability(canonicalKp);
}

function canGenerate(kpId, qtId) {
  var r = resolveFinal({ knowledgePointId: kpId, questionType: qtId });
  return r.decision === 'ALLOW';
}

function resolveFinal(input) {
  var kpId = input && input.knowledgePointId;
  var qtId = input && input.questionType;

  
  var qt = Registry.get(qtId);
  if (!qt) {
    return { knowledgePointId: kpId, questionType: qtId, capability: null, decision: 'INVALID', source: { questionType: 'registry' }, confidence: 'none' };
  }

  
  var kp = KnowledgePoint.get(kpId);
  if (!kp) {
    return { knowledgePointId: kpId, questionType: qtId, capability: qt.category, decision: 'INVALID', source: { knowledgePoint: 'ontology' }, confidence: 'none' };
  }

  
  
  
  var mx = Matrix.buildMatrix(kp);
  var cell = mx.questionTypes[qtId];
  var matrixDecision = cell ? cell.decision : 'FORBID';

  var decision;
  if (matrixDecision === 'MISSING') decision = 'MISSING';
  else if (matrixDecision === 'FORBID') decision = 'FORBID';
  else if (matrixDecision === 'ALLOW') decision = 'ALLOW';
  else decision = 'DEGRADE'; 

  var confidence = 'declared';
  if (decision === 'ALLOW') confidence = 'declared';
  else if (decision === 'DEGRADE') confidence = 'inferred';
  else if (decision === 'MISSING') confidence = 'unknown';

  return {
    knowledgePointId: kpId,
    questionType: qtId,
    capability: qt.category,
    decision: decision,
    source: {
      knowledgePoint: 'ontology',
      questionType: 'registry',
      matrix: 'R04'
    },
    confidence: confidence
  };
}

function matrix(kp) {
  var canonical = Ontology.normalize(kp);
  var supported = [];
  var unsupported = [];

  (canonical.presentation.questionTypes || []).forEach(function (q) {
    if (!q || !q.type) return;
    var std = Registry.normalizeQuestionType(q.type);
    if (std.id) {
      if (supported.indexOf(std.id) === -1) supported.push(std.id);
    } else {
      unsupported.push(q.type);
    }
  });

  (canonical.generation.capabilities || []).forEach(function (cap) {
    if (cap && cap.id && Registry.has(cap.id) && supported.indexOf(cap.id) === -1) supported.push(cap.id);
  });

  return { supported: supported, unsupported: unsupported };
}

function getCapabilities(kp) {
  
  var cap = resolve(kp);
  var questionTypes = cap.questionTypes.map(function (q) { return q.id; });
  var cognitiveLevels = {};
  var difficultyRange = {};
  cap.questionTypes.forEach(function (q) {
    cognitiveLevels[q.id] = q.cognitiveLevels;
    difficultyRange[q.id] = q.difficultyRange;
  });
  return {
    questionTypes: questionTypes,
    cognitiveLevels: cognitiveLevels,
    difficultyRange: difficultyRange
  };
}

module.exports = {
  resolve: resolve,
  resolveFinal: resolveFinal,
  canGenerate: canGenerate,
  matrix: matrix,
  getCapabilities: getCapabilities
};

};
__defs["shared/strategy/adaptive-strategy.js"] = function (module, exports, require) {

'use strict';

var LearnerModel = require("shared/learner/learner-model.js");

var DIFF_MIN = 1, DIFF_MAX = 10;
var ADJ_MIN = -2, ADJ_MAX = 2;

var VARIANTS = ['基础', '数值', '呈现', '情境', '结构', '迁移'];

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function clampDiff(n) { return clamp(Math.round(n), DIFF_MIN, DIFF_MAX); }
function clampAdj(n) { return clamp(Math.round(n), ADJ_MIN, ADJ_MAX); }
function round3(n) { return Math.round(n * 1000) / 1000; }

function safeNumber(v, dflt) {
  var n = Number(v);
  return (typeof v === 'number' && isFinite(n)) ? n : dflt;
}


function masteryBandAdjustment(mastery) {
  if (mastery < 0.40) return -1;            
  if (mastery < 0.70) return 0;             
  if (mastery < 0.85) return 1;             
  return 1;                                 
}


function streakInfo(recentResults) {
  if (!Array.isArray(recentResults) || !recentResults.length) return { streak: 0, streakKind: 0 };
  var n = recentResults.length;
  var last = recentResults[n - 1];
  var len = 0;
  for (var i = n - 1; i >= 0; i--) {
    if (recentResults[i] !== last) break;
    len++;
  }
  return { streak: len, streakKind: last === 1 ? 1 : (last === 0 ? -1 : 0) };
}

function applyStreakProtection(adj, kpState) {
  var info = streakInfo(kpState && kpState.recentResults);
  var adj2 = adj;
  if (info.streakKind === -1 && info.streak >= 1) {
    
    adj2 = Math.min(adj2, 0);
  }
  if (info.streakKind === 1 && info.streak >= 2 && adj2 < 0) {
    
    adj2 = Math.round(adj2 / 2);
  }
  return clampAdj(adj2);
}


function dampenByConfidence(adj, kpState) {
  var conf = safeNumber(kpState && kpState.confidence, 0);
  var attempts = safeNumber(kpState && kpState.attempts, 0);
  if (attempts <= 0) return 0;          
  if (conf < 0.15) return Math.round(adj / 2);   
  if (attempts < 3) return clampAdj(roundStep(adj)); 
  return adj;
}

function roundStep(adj) {
  
  return clamp(adj, -1, 1);
}


function spiralTarget(mastery, confidence, recentAccuracy) {
  var m = clamp(safeNumber(mastery, 0), 0, 1);
  var conf = clamp(safeNumber(confidence, 0), 0, 1);
  var ra = clamp(safeNumber(recentAccuracy, 0), 0, 1);
  var score = 0.5 * m + 0.25 * conf + 0.25 * ra;
  var level = 1;
  if (score < 0.4) level = 1;            
  else if (score < 0.6) level = 2;       
  else if (score < 0.8) level = 3;       
  else level = 4;                        
  if (conf >= 0.7 && ra >= 0.85 && m >= 0.85) level = Math.max(level, 5); 
  return clamp(level, 1, 6);
}


function variantFor(mastery, confidence, errorFocus) {
  var m = clamp(safeNumber(mastery, 0), 0, 1);
  var conf = clamp(safeNumber(confidence, 0), 0, 1);
  
  if (errorFocus && errorFocus.length && m < 0.7) return '基础';
  if (m < 0.4) return '基础';
  if (m < 0.7) return conf >= 0.5 ? '呈现' : '数值';
  if (m < 0.85) return conf >= 0.6 ? '结构' : '情境';
  return '迁移';
}


function errorFocusFor(kpState, limit) {
  if (!kpState || !kpState.errorPatterns) return [];
  var list = [];
  Object.keys(kpState.errorPatterns).forEach(function (k) {
    var p = kpState.errorPatterns[k];
    if (!p || p.count <= 0) return;
    list.push(p);
  });
  list.sort(function (a, b) {
    var d = (b.recentCount || 0) - (a.recentCount || 0);
    if (d) return d;
    return (b.count || 0) - (a.count || 0);
  });
  var n = (typeof limit === 'number') ? limit : 2;
  return list.slice(0, n).map(function (p) { return p.errorType; });
}

function cognitiveFor(mastery) {
  var m = clamp(safeNumber(mastery, 0), 0, 1);
  if (m < 0.4) return 'recall';
  if (m < 0.7) return 'understand';
  if (m < 0.85) return 'apply';
  return 'analyze';
}



function resolve(opts) {
  opts = opts || {};
  var kp = opts.learnerState && typeof opts.learnerState === 'object'
    ? LearnerModel.normalizeKpState(opts.learnerState, opts.kpId)
    : LearnerModel.defaultKpState(opts.kpId);

  var staticDiff = clampDiff(safeNumber(opts.staticDifficulty, 3));
  var userDiff = opts.difficulty != null ? clampDiff(safeNumber(opts.difficulty, staticDiff)) : null;
  var allowOverride = opts.allowDifficultyOverride !== false;
  var base = (allowOverride && userDiff != null) ? userDiff : staticDiff;

  var mastery = kp.mastery;
  var confidence = kp.confidence;
  var recentAccuracy = kp.recentAccuracy;
  var attempts = kp.attempts;
  var mode = opts.adaptiveMode === 'legacy' || opts.adaptiveMode === 'shadow' ? opts.adaptiveMode
    : (attempts > 0 ? 'new' : 'new'); 
  var legacyDelta = clampAdj(safeNumber(opts.legacyDelta, 0));

  
  var adj = 0;
  if (attempts > 0) {
    adj = masteryBandAdjustment(mastery);
    
    if (mastery >= 0.85 && confidence >= 0.7 && recentAccuracy >= 0.85) adj = 2;
    adj = dampenByConfidence(adj, kp);
    adj = applyStreakProtection(adj, kp);
  }
  adj = clampAdj(adj);

  var learnerEffective = clampDiff(base + adj);

  
  var legacyEffective = clampDiff(base + legacyDelta);
  var shadow = null;
  if (mode === 'shadow') {
    shadow = {
      legacyDelta: legacyDelta,
      learnerAdjustment: adj,
      legacyEffective: legacyEffective,
      learnerEffective: learnerEffective
    };
  }

  var effectiveDifficulty = (mode === 'legacy' || mode === 'shadow') ? legacyEffective : learnerEffective;

  
  var focus = errorFocusFor(kp, 2);
  var maxSpiral = clamp(safeNumber(opts.maxSpiralLevel, 6), 1, 6);
  var targetSpiral = spiralTarget(mastery, confidence, recentAccuracy);
  targetSpiral = Math.min(targetSpiral, maxSpiral);
  if (attempts === 0) targetSpiral = 1; 

  var variant = variantFor(mastery, confidence, focus);

  return {
    effectiveDifficulty: effectiveDifficulty,
    targetSpiralLevel: targetSpiral,
    cognitiveLevel: cognitiveFor(mastery),
    variant: variant,
    errorFocus: focus,
    adjustment: adj,
    mastery: round3(mastery),
    confidence: round3(confidence),
    recentAccuracy: round3(recentAccuracy),
    attempts: attempts,
    mode: mode,
    baseDifficulty: base,
    shadow: shadow,
    recommendedDifficulty: learnerEffective,
    recommendedSpiralLevel: targetSpiral
  };
}

module.exports = {
  resolve: resolve,
  masteryBandAdjustment: masteryBandAdjustment,
  applyStreakProtection: applyStreakProtection,
  dampenByConfidence: dampenByConfidence,
  spiralTarget: spiralTarget,
  variantFor: variantFor,
  errorFocusFor: errorFocusFor,
  cognitiveFor: cognitiveFor,
  VARIANTS: VARIANTS,
  ADJ_MIN: ADJ_MIN,
  ADJ_MAX: ADJ_MAX
};
};
__defs["shared/strategy-config.js"] = function (module, exports, require) {

'use strict';

var STRATEGY_VERSION = '1.0.0';
var DEFAULT_STRATEGY = 'legacy'; 






var GRADE_DIFFICULTY_ANCHORS = {
  1: [1, 2],
  2: [2, 4],
  3: [3, 5],
  4: [4, 7],
  5: [5, 8],
  6: [6, 10]
};

function difficultyAnchorOf(grade) {
  return GRADE_DIFFICULTY_ANCHORS[Number(grade)] || null;
}


var _currentStrategy = null;
var _configOverrides = {};

function getStrategy() {
  if (_currentStrategy) return _currentStrategy;
  
  if (typeof process !== 'undefined' && process.env && process.env.GENERATION_STRATEGY) {
    return process.env.GENERATION_STRATEGY;
  }
  if (typeof globalThis !== 'undefined' && globalThis.__GENERATION_STRATEGY__) {
    return globalThis.__GENERATION_STRATEGY__;
  }
  return DEFAULT_STRATEGY;
}

function setStrategy(strategy) {
  if (strategy !== 'legacy' && strategy !== 'strategy-v1') {
    throw new Error('Invalid strategy: ' + strategy + ' (expected "legacy" | "strategy-v1")');
  }
  _currentStrategy = strategy;
  if (typeof globalThis !== 'undefined') {
    globalThis.__GENERATION_STRATEGY__ = strategy;
  }
}

function isLegacy() {
  return getStrategy() === 'legacy';
}

function isStrategyV1() {
  return getStrategy() === 'strategy-v1';
}

function getConfig() {
  return {
    version: STRATEGY_VERSION,
    current: getStrategy(),
    overrides: _configOverrides,
    features: {
      strategyEngine: isStrategyV1(),
      legacyFallback: isLegacy()
    }
  };
}

function setConfigOverrides(overrides) {
  _configOverrides = Object.assign({}, _configOverrides, overrides);
}

function reset() {
  _currentStrategy = null;
  _configOverrides = {};
}

module.exports = {
  STRATEGY_VERSION: STRATEGY_VERSION,
  DEFAULT_STRATEGY: DEFAULT_STRATEGY,
  GRADE_DIFFICULTY_ANCHORS: GRADE_DIFFICULTY_ANCHORS,
  difficultyAnchorOf: difficultyAnchorOf,
  getStrategy: getStrategy,
  setStrategy: setStrategy,
  isLegacy: isLegacy,
  isStrategyV1: isStrategyV1,
  getConfig: getConfig,
  setConfigOverrides: setConfigOverrides,
  reset: reset
};
};
__defs["shared/generator/generator-registry.js"] = function (module, exports, require) {

'use strict';






var CORE_RECORDS = [
  { id: 'generator:arithmetic-addition', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: ['math-g1-m1-addsub-5', 'math-g1-m1-addsub-10', 'math-g1-m1-addsub-100', 'math-g1-m1-carry-add-20', 'math-g1-m1-retreat-sub-20', 'math-g1-m1-two-digit-add', 'math-g2-m1-addsub-1000', 'math-g2-m2-add-col', 'math-g4-m1-g4-oral-big', 'math-g4-m1-g4-oral-dec', 'math-g4-m3-g4-mix-addlaw', 'math-g6-m1-g6-oral-neg-add-sub'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-subtraction', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: ['math-g1-m1-addsub-5', 'math-g1-m1-addsub-10', 'math-g1-m1-addsub-100', 'math-g1-m1-carry-add-20', 'math-g1-m1-retreat-sub-20', 'math-g1-m1-two-digit-add', 'math-g2-m1-addsub-1000', 'math-g2-m2-sub-col', 'math-g4-m1-g4-oral-big', 'math-g4-m1-g4-oral-dec'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-multiplication', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: ['math-g1-m13-multiplication-table', 'math-g2-m1-mult-table', 'math-g2-m2-mult-col', 'math-g2-m4-multiplication-meaning', 'math-g2-m7-pic-mult', 'math-g2-m8-mult-total', 'math-g2-m5-match-multdiv', 'math-g3-m1-g3-mul-multi1', 'math-g4-m1-g4-oral-mul3x1', 'math-g4-m1-g4-oral-mul2t', 'math-g4-m1-g4-oral-law', 'math-g4-m3-g4-mix-mullaw', 'math-g5-m1-g5-oral-decmul', 'math-g6-m2-g6-calc-dec-mult'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-division', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: ['math-g1-m13-division-table', 'math-g2-m1-div-table', 'math-g2-m1-muldiv-relation', 'math-g2-m2-div-col', 'math-g2-m2-remainder-col', 'math-g2-m1-remainder-oral', 'math-g2-m4-division-meaning', 'math-g2-m7-pic-div', 'math-g2-m7-pic-div-include', 'math-g2-m8-div-partitive', 'math-g2-m8-div-quotative', 'math-g3-m1-g3-div1', 'math-g4-c2-c2-divisible', 'math-g4-m1-g4-oral-divt', 'math-g5-m1-g5-oral-decdiv', 'math-g4-m2-g4-v-div2', 'math-g4-m2-g4-v-div2q', 'math-g4-m8-g4-word-div'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-mixed-calculation', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: [], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-fill', subject: 'math', capabilities: ['fill', 'recognize', 'calc', 'oral', 'apply'], questionTypes: ['fill', 'recognize', 'calc', 'oral', 'apply'], knowledgePoints: ['math-g1-m13-multiplication-table', 'math-g1-m13-division-table', 'math-g1-m13-fill-blank', 'math-g2-m4-length-unit', 'math-g2-m4-mass-unit', 'math-g2-m4-time-unit', 'math-g2-m4-fill-length', 'math-g2-m4-fill-mass', 'math-g2-m4-fill-time', 'math-g3-m4-g3-measure', 'math-g4-c4-c4-cutfill', 'math-g4-c4-c4-pa', 'math-g4-c4-c4-solid', 'math-g4-c4-c4-count'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-choice', subject: 'math', capabilities: ['choice', 'recognize', 'calc', 'oral', 'apply'], questionTypes: ['choice', 'recognize', 'calc', 'oral', 'apply'], knowledgePoints: ['math-g1-m12-choice-mixed', 'math-g1-m5-match-calc', 'math-g1-m5-match-shape', 'math-g1-m5-match-rmb', 'math-g2-m12-choice-mixed'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-judge', subject: 'math', capabilities: ['judge', 'recognize', 'calc', 'oral', 'apply'], questionTypes: ['judge', 'recognize', 'calc', 'oral', 'apply'], knowledgePoints: ['math-g1-m0-make-ten-cushi', 'math-g1-m11-judge-mixed', 'math-g2-m11-judge-mixed'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:complex-calc', subject: 'math', capabilities: ['calc', 'fill', 'oral'], questionTypes: ['calc', 'fill', 'oral'],
    knowledgePoints: ['math-g1-m1-mixed-chain', 'math-g2-m1-mixed-addsub', 'math-g2-m1-mixed-multdiv', 'math-g2-m3-chain-addsub', 'math-g2-m3-multdiv-mixed', 'math-g2-m3-mixed-no-bracket', 'math-g2-m3-mixed-bracket', 'math-g1-m4-num-fill-unknown', 'math-g2-m3-fill-operator', 'math-g2-m2-chain-add-col', 'math-g2-m2-chain-sub-col', 'math-g2-m2-mixed-col'],
    scope: 'core', version: 1, supportsComposite: false },

  
  { id: 'generator:shape-recognition', subject: 'math', capabilities: ['choice', 'judge', 'fill', 'oral', 'geometry', 'recognize', 'apply'], questionTypes: ['choice', 'judge', 'fill', 'oral', 'geometry', 'recognize', 'apply'],
    knowledgePoints: ['math-g1-m6-solid-shape', 'math-g1-m6-flat-shape', 'math-g1-m6-count-graph', 'math-g1-m6-shape-combine', 'math-g1-m6-draw-shape', 'math-g1-m5-match-shape', 'math-g2-m5-match-shape', 'math-g2-m6-solid-shape', 'math-g2-m6-motion', 'math-g4-m5-g4-match-shape', 'math-g4-m6-g4-draw-sym', 'math-g4-m6-g4-draw-move', 'math-g4-c4-c4-count', 'math-g4-c4-c4-solid', 'math-g5-m4-g5-fill-solid', 'math-g5-m5-g5-match-areaf', 'math-g5-m5-g5-match-solid', 'math-g5-m6-g5-draw-rotate', 'math-g5-m6-g5-draw-sym', 'math-g5-m6-g5-draw-coord', 'math-g5-m8-g5-word-solid', 'math-g5-m11-g5-judge-solid', 'math-g5-m12-g5-choice-solid', 'math-g5-m12-motion', 'math-g5-c4-solid-geometry', 'math-g6-m5-g6-match-formula', 'math-g6-m6-g6-op-rotate-scale', 'math-g6-m6-g6-op-position', 'math-g6-m10-g6-reason-number-shape', 'math-g6-c4-area-basic', 'math-g6-c4-solid-geometry', 'math-g2-m4-angle-basic', 'math-g2-m5-match-angle', 'math-g2-m6-angle-recognize', 'math-g2-m6-grid-draw', 'math-g2-m6-draw-line', 'math-g2-m6-draw-angle', 'math-g2-m6-clock-draw', 'math-g2-m6-measure', 'math-g3-m6-g3-perimeter', 'math-g3-m6-g3-area', 'math-g3-m6-g3-position', 'math-g4-m4-g4-fill-line', 'math-g4-m4-g4-fill-angle', 'math-g4-m4-g4-fill-quad', 'math-g4-m4-g4-fill-tri', 'math-g4-m5-g4-match-angle', 'math-g4-m6-g4-draw-protractor', 'math-g4-m6-g4-draw-para', 'math-g4-m6-g4-draw-grid', 'math-g4-m6-g4-draw-view', 'math-g4-m11-g4-judge-angle', 'math-g4-m11-g4-judge-line', 'math-g4-m11-g4-judge-tri', 'math-g4-m12-g4-choice-angle', 'math-g4-m12-g4-choice-shape', 'math-g4-c3-c3-geomcount', 'math-g4-c4-c4-pa', 'math-g4-c4-c4-angle', 'math-g4-c4-c4-transform', 'math-g5-c4-circle-sector', 'math-g5-c4-angle-calculation', 'math-g6-m4-g6-fill-circle', 'math-g6-m6-g6-op-circle', 'math-g6-m6-g6-op-symmetry', 'math-g6-m8-g6-app-circle', 'math-g6-m11-g6-judge-circle', 'math-g6-m12-g6-choice-circle', 'math-g6-c3-geometry-counting', 'math-g6-c4-circle-sector', 'math-g6-c4-angle-calculation', 'math-g6-c4-circle-angle', 'math-g6-c4-solid-rotation', 'math-g5-m4-g5-fill-coord', 'math-g5-m4-g5-fill-area', 'math-g5-m4-g5-fill-rotate', 'math-g5-m6-g5-draw-observe', 'math-g5-m6-g5-draw-height', 'math-g5-m6-g5-draw-net', 'math-g5-m7-g5-pic-area', 'math-g5-m8-g5-word-area', 'math-g5-m11-g5-judge-area', 'math-g5-m11-motion', 'math-g5-m12-g5-choice-area', 'math-g5-c4-area-basic', 'math-g5-c4-equal-area-transform', 'math-g5-c4-bird-head-model', 'math-g5-c4-butterfly-model', 'math-g5-c4-swallow-tail-model', 'math-g5-c4-half-model', 'math-g5-c4-painted-cube', 'math-g5-c4-pythagorean-theorem', 'math-g5-c4-lattice-area', 'math-g6-m4-g6-fill-cylinder-cone', 'math-g6-m8-g6-app-cyl-cone', 'math-g6-m11-g6-judge-cyl-cone', 'math-g6-m12-g6-choice-cyl-cone', 'math-g6-c4-equal-area-transform', 'math-g6-c4-bird-head-model', 'math-g6-c4-butterfly-model', 'math-g6-c4-swallow-tail-model', 'math-g6-c4-half-model', 'math-g6-c4-painted-cube', 'math-g6-c4-pythagorean-theorem', 'math-g6-c4-lattice-area'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:position-direction', subject: 'math', capabilities: ['choice', 'judge', 'fill', 'oral'], questionTypes: ['choice', 'judge', 'fill', 'oral'],
    knowledgePoints: ['math-g1-m6-position', 'math-g3-m6-g3-position', 'math-g5-m6-g5-draw-coord', 'math-g6-m6-g6-op-position'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:money-measurement', subject: 'math', capabilities: ['fill', 'choice', 'judge', 'apply', 'calc', 'oral'], questionTypes: ['fill', 'choice', 'judge', 'apply', 'calc', 'oral'],
    knowledgePoints: ['math-g1-m4-rmb-unit', 'math-g1-m4-rmb-calc', 'math-g1-m5-match-rmb', 'math-g1-m8-rmb-shopping', 'math-g2-m4-length-unit', 'math-g2-m4-mass-unit', 'math-g2-m4-time-unit', 'math-g2-m4-fill-length', 'math-g2-m4-fill-mass', 'math-g2-m4-fill-time', 'math-g2-m8-money', 'math-g3-m4-g3-measure', 'math-g4-c4-c4-pa'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:application-word', subject: 'math', capabilities: ['apply', 'fill', 'choice', 'judge', 'calc', 'oral', 'open'], questionTypes: ['apply', 'fill', 'choice', 'judge', 'calc', 'oral', 'open'],
    knowledgePoints: ['math-g1-m8-rmb-shopping', 'math-g2-m8-money', 'math-g3-m4-g3-measure', 'math-g4-m8-g4-word-div', 'math-g5-m8-g5-word-solid', 'math-g6-c4-area-basic', 'math-g6-c4-solid-geometry', 'math-g6-m10-g6-reason-number-shape'],
    scope: 'core', version: 1, supportsComposite: false },

  
  { id: 'generator:counting', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g3-m10-g3-combination', 'math-g3-m10-g3-set', 'math-g4-c3-c3-enum', 'math-g4-c3-c3-am', 'math-g4-c3-c3-perm', 'math-g4-c3-c3-worst', 'math-g5-c3-addition-principle', 'math-g5-c3-multiplication-principle', 'math-g5-c3-permutation', 'math-g5-c3-combination', 'math-g5-c3-enumeration-counting', 'math-g5-c3-bundling-method', 'math-g5-c3-insertion-method', 'math-g5-c3-stars-bars', 'math-g5-c3-pigeonhole-principle', 'math-g5-c3-worst-case-principle', 'math-g6-c3-addition-principle', 'math-g6-c3-multiplication-principle', 'math-g6-c3-permutation', 'math-g6-c3-combination', 'math-g6-c3-enumeration-counting', 'math-g6-c3-bundling-method', 'math-g6-c3-insertion-method', 'math-g6-c3-stars-bars', 'math-g6-c3-pigeonhole-principle', 'math-g6-c3-worst-case-principle', 'math-g6-c3-inclusion-exclusion', 'math-g6-c3-recursion-counting', 'math-g6-c3-derangement'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:reasoning', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g2-m10-logic-reasoning', 'math-g2-m10-sudoku3', 'math-g2-m10-combination', 'math-g2-m10-handshake', 'math-g4-m10-g4-reason-opt', 'math-g4-m10-g4-reason-cr', 'math-g4-m10-logic-reasoning', 'math-g4-c8-c8-extreme', 'math-g4-c8-c8-drawer', 'math-g4-c8-c8-logic', 'math-g5-m10-g5-reason-tree3', 'math-g5-m10-g5-reason-defect', 'math-g5-m10-logic-reasoning', 'math-g5-m10-g5-reason-seq', 'math-g5-c8-extremum-problem', 'math-g5-c8-logic-inference', 'math-g5-c8-winning-strategy', 'math-g6-m10-g6-reason-pigeonhole', 'math-g6-c8-extremum-problem', 'math-g6-c8-logic-inference', 'math-g6-c8-winning-strategy', 'math-g6-c8-optimization'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:stats', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g2-m9-data-tally', 'math-g2-m9-data-question', 'math-g3-m9-g3-stats-table', 'math-g4-m9-g4-stats-bar', 'math-g4-m9-g4-stats-double', 'math-g4-m9-g4-stats-avg', 'math-g4-m11-stats', 'math-g5-m4-g5-fill-linechart', 'math-g5-m8-g5-word-linechart', 'math-g5-m9-g5-stats-possib', 'math-g5-m9-g5-stats-line1', 'math-g5-m9-g5-stats-line2', 'math-g5-m11-stats', 'math-g5-m12-stats', 'math-g6-m4-g6-fill-pie-chart', 'math-g6-m5-g6-match-chart', 'math-g6-m7-g6-pic-pie-chart', 'math-g6-m9-g6-stat-pie-chart', 'math-g6-m9-g6-stat-possibility', 'math-g6-m11-g6-judge-chart', 'math-g6-m12-g6-choice-chart'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:picture-equation', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g2-m7-pic-mixed', 'math-g4-m7-g4-pic-segment', 'math-g4-m7-g4-pic-brace', 'math-g4-m7-g4-pic-speed', 'math-g4-m7-g4-pic-dec', 'math-g4-c1-c1-array', 'math-g4-c1-c1-magic', 'math-g5-m7-g5-pic-balance', 'math-g5-m7-g5-pic-segment', 'math-g5-m7-g5-pic-tree', 'math-g5-c1-number-array-closed', 'math-g5-c1-number-array-radial', 'math-g5-c1-number-array-composite', 'math-g5-c1-magic-square-3', 'math-g5-c1-magic-square-4', 'math-g6-m7-g6-pic-frac-line', 'math-g6-m7-g6-pic-scale', 'math-g6-c1-magic-square-adv', 'math-g6-c1-number-array'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c1-number-puzzle', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g4-c1-c1-vertical', 'math-g4-c1-c1-horizontal', 'math-g4-c1-c1-symbol', 'math-g5-c1-digit-puzzle-vertical', 'math-g5-c1-digit-puzzle-horizontal', 'math-g5-c1-digit-puzzle-symbol', 'math-g6-c1-vertical-multidigit', 'math-g6-c1-vertical-carry-complex', 'math-g6-c1-horizontal-puzzle', 'math-g6-c1-symbol-number', 'math-g6-c1-digit-reasoning', 'math-g6-c1-number-puzzle-competition'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c2-number-theory', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g4-c2-c2-parity', 'math-g4-c2-c2-remainder', 'math-g4-c2-c2-place', 'math-g5-c2-divisibility', 'math-g5-c2-parity-analysis', 'math-g5-c2-prime-factorization', 'math-g5-c2-factor-count-sum', 'math-g5-c2-gcd-lcm', 'math-g5-c2-remainder-congruence', 'math-g5-c2-place-value', 'math-g5-c2-perfect-square', 'math-g5-c2-number-theory-extreme', 'math-g6-c2-divisibility', 'math-g6-c2-parity-analysis', 'math-g6-c2-prime-factorization', 'math-g6-c2-factor-count-sum', 'math-g6-c2-gcd-lcm', 'math-g6-c2-remainder-congruence', 'math-g6-c2-place-value', 'math-g6-c2-perfect-square', 'math-g6-c2-number-theory-extreme', 'math-g6-c2-diophantine-equation', 'math-g6-c2-modulo-arithmetic'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c5-c6-journey-engineering', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g4-c5-c5-basic', 'math-g4-c5-c5-meet', 'math-g4-c5-c5-chase', 'math-g4-c5-c5-train', 'math-g4-c5-c5-river', 'math-g5-c5-basic-motion', 'math-g5-c5-meet-problem', 'math-g5-c5-chase-problem', 'math-g5-c5-train-bridge', 'math-g5-c5-boat-stream', 'math-g5-c5-circular-track', 'math-g5-c5-average-speed', 'math-g5-c5-ratio-motion', 'math-g5-c6-work-problem', 'math-g5-c6-concentration-problem', 'math-g6-c5-basic', 'math-g6-c5-meet', 'math-g6-c5-chase', 'math-g6-c5-train-bridge', 'math-g6-c5-boat-stream', 'math-g6-c5-ring-runway', 'math-g6-c5-journey-complex', 'math-g6-c5-competition', 'math-g6-c5-interval-departure', 'math-g6-c5-pick-up-problem', 'math-g6-c6-work-problem', 'math-g6-c6-concentration-problem'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c7-clever-calc', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g5-c7-extract-common-factor', 'math-g5-c7-rounding-calc', 'math-g5-c7-fraction-splitting', 'math-g5-c7-integer-splitting', 'math-g5-c7-arithmetic-series', 'math-g5-c7-recurring-decimal-frac', 'math-g5-c7-define-operation', 'math-g5-c7-estimate-bounds', 'math-g5-c7-complex-fraction', 'math-g6-c7-extract-common-factor', 'math-g6-c7-rounding-calc', 'math-g6-c7-fraction-splitting', 'math-g6-c7-integer-splitting', 'math-g6-c7-arithmetic-series', 'math-g6-c7-recurring-decimal-frac', 'math-g6-c7-define-operation', 'math-g6-c7-estimate-bounds', 'math-g6-c7-complex-fraction', 'math-g6-c7-sequence-sum'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c9-comprehensive', subject: 'math', capabilities: ['apply', 'calc', 'open'], questionTypes: ['apply', 'calc', 'open'],
    knowledgePoints: ['math-g4-c9-c9-integrated', 'math-g4-c9-c9-misc', 'math-g4-c9-c9-mock', 'math-g5-c9-sum-diff-problem', 'math-g5-c9-age-problem', 'math-g5-c9-profit-loss-problem', 'math-g5-c9-chicken-rabbit', 'math-g5-c9-average-problem', 'math-g5-c9-planting-problem', 'math-g5-c9-phalanx-problem', 'math-g5-c9-periodic-problem', 'math-g5-c9-grass-problem', 'math-g5-c9-fraction-percent-application', 'math-g5-c9-economics-problem', 'math-g5-c9-inclusion-exclusion', 'math-g5-c9-equation-linear-1', 'math-g5-c9-equation-linear-2', 'math-g5-c9-diophantine-equation', 'math-g6-c9-sum-diff-problem', 'math-g6-c9-age-problem', 'math-g6-c9-profit-loss-problem', 'math-g6-c9-chicken-rabbit', 'math-g6-c9-average-problem', 'math-g6-c9-planting-problem', 'math-g6-c9-phalanx-problem', 'math-g6-c9-periodic-problem', 'math-g6-c9-grass-problem', 'math-g6-c9-fraction-percent-application', 'math-g6-c9-economics-problem', 'math-g6-c9-equation-linear-1', 'math-g6-c9-equation-linear-2', 'math-g6-c9-inclusion-exclusion', 'math-g6-c9-ratio-application', 'math-g6-c9-mixture-problem'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:composite', subject: 'math', capabilities: ['calc', 'judge', 'fill', 'apply', 'oral'], questionTypes: ['calc', 'judge', 'fill', 'apply', 'oral'],
    knowledgePoints: [
      'math-g1-m1-addsub-10', 'math-g1-m0-make-ten', 'math-g1-m0-make-ten-cushi', 'math-g1-m1-addsub-5', 'math-g1-m11-judge-mixed',
      'math-g1-m4-rmb-unit', 'math-g1-m4-rmb-calc', 'math-g1-m5-match-rmb', 'math-g1-m8-rmb-shopping',
      'math-g2-m4-length-unit', 'math-g2-m4-mass-unit', 'math-g2-m4-time-unit', 'math-g2-m4-fill-length', 'math-g2-m4-fill-mass', 'math-g2-m4-fill-time', 'math-g2-m8-money', 'math-g3-m4-g3-measure', 'math-g4-c4-c4-pa',
      'math-g1-m6-solid-shape', 'math-g1-m6-flat-shape', 'math-g1-m6-shape-combine', 'math-g2-m6-solid-shape', 'math-g4-c4-c4-solid', 'math-g5-c4-solid-geometry', 'math-g6-c4-solid-geometry'
    ],
    scope: 'core', version: 1, supportsComposite: true }
];

function buildRecords() {
  
  
  return CORE_RECORDS.slice();
}

var _records = null;
var _kpCache = null;      
var _qtCache = null;      

function records() {
  if (!_records) _records = buildRecords();
  return _records;
}

function invalidateCaches() {
  _kpCache = null;
  _qtCache = null;
}

function get(id) {
  for (var i = 0; i < records().length; i++) {
    if (records()[i].id === id) return records()[i];
  }
  return null;
}

function all() {
  return records().slice();
}

function forKnowledgePoint(kpId) {
  if (!_kpCache) _kpCache = {};
  if (_kpCache[kpId]) return _kpCache[kpId];
  var result = records().filter(function (r) {
    return r.knowledgePoints.indexOf(kpId) !== -1;
  });
  return (_kpCache[kpId] = result);
}

function forQuestionType(qtId) {
  if (!_qtCache) _qtCache = {};
  if (_qtCache[qtId]) return _qtCache[qtId];
  var result = records().filter(function (r) {
    return r.questionTypes.indexOf(qtId) !== -1;
  });
  return (_qtCache[qtId] = result);
}

function forSubject(subject) {
  return records().filter(function (r) { return r.subject === subject; });
}

function resolveChain(kpId) {
  var KnowledgePoint = require("shared/knowledge-point.js");
  var Resolver = require("shared/capability-resolver.js");
  var kp = KnowledgePoint.get(kpId);
  if (!kp) return null;
  var capabilityQuestionTypes = Resolver.getCapabilities(kp).questionTypes || [];
  return {
    knowledgePointId: kpId,
    capabilityQuestionTypes: capabilityQuestionTypes,
    generators: forKnowledgePoint(kpId).map(function (r) { return r.id; })
  };
}


function enhanceKp(kp) {
  if (!kp || typeof kp !== 'object' || !kp.id) return kp;

  var generators = forKnowledgePoint(kp.id);
  var capabilities = [];
  generators.forEach(function (g) {
    (g.capabilities || []).forEach(function (c) {
      if (capabilities.indexOf(c) === -1) capabilities.push(c);
    });
    
    (g.questionTypes || []).forEach(function (c) {
      if (capabilities.indexOf(c) === -1) capabilities.push(c);
    });
  });

  
  if (capabilities.length === 0) {
    var Resolver = require("shared/capability-resolver.js");
    var caps = Resolver.getCapabilities(kp).questionTypes || [];
    capabilities = caps.slice();
  }

  kp.capabilities = capabilities;
  
  return kp;
}

module.exports = {
  records: records,
  get: get,
  all: all,
  forKnowledgePoint: forKnowledgePoint,
  forQuestionType: forQuestionType,
  forSubject: forSubject,
  resolveChain: resolveChain,
  enhanceKp: enhanceKp,
  invalidateCaches: invalidateCaches
};

};
__defs["shared/generator/core/kp-arithmetic-semantics.js"] = function (module, exports, require) {

'use strict';

var OP_ADD = '+', OP_SUB = '−', OP_MUL = '×', OP_DIV = '÷';

var SINGLE_STEP_PROFILE = {
  addsub: { operators: [OP_ADD, OP_SUB], steps: 1 },
  add: { operators: [OP_ADD], steps: 1 },
  sub: { operators: [OP_SUB], steps: 1 },
  mult: { operators: [OP_MUL], steps: 1 },
  div: { operators: [OP_DIV], steps: 1 },
  
  
  remainder: { operators: [OP_DIV], steps: 1, kind: 'div-remainder' }
};




var SPECIAL_ORAL_PROFILE = {
  'div-tens':   { operators: [OP_DIV], steps: 1, kind: 'div-tens' },
  'big-addsub': { operators: [OP_ADD, OP_SUB], steps: 1, kind: 'big-addsub' },
  'mul3x1':     { operators: [OP_MUL], steps: 1, kind: 'mul3x1' },
  'mul2tens':   { operators: [OP_MUL], steps: 1, kind: 'mul2tens' },
  'dec-addsub': { operators: [OP_ADD, OP_SUB], steps: 1, kind: 'dec-addsub' },
  'law-oral':   { operators: [OP_MUL], steps: 1, kind: 'law-oral' },
  'dec-mul-oral': { operators: [OP_MUL], steps: 1, kind: 'dec-mul-oral' },
  'dec-div-oral': { operators: [OP_DIV], steps: 1, kind: 'dec-div-oral' },
  
  'add-law':    { operators: [OP_ADD], steps: 2, kind: 'add-law' },
  'mul-law':    { operators: [OP_MUL], steps: 2, kind: 'mul-law' },
  
  'neg-add-sub': { operators: [OP_ADD, OP_SUB], steps: 1, kind: 'neg-add-sub' },
  'dec-mult':   { operators: [OP_MUL], steps: 1, kind: 'dec-mult' }
};

var NON_MIGRATABLE = ['mixed', 'relation', 'multi1', 'twodigit', 'div1', 'fraction', 'decimal', 'g3', 'md'];


function resolveArithmeticSemantics(kp, options) {
  options = options || {};
  if (!kp || !kp.source) return null;
  var lt = kp.source.legacyType;

  if (NON_MIGRATABLE.indexOf(lt) !== -1) return null;

  var profile = SPECIAL_ORAL_PROFILE[lt] || SINGLE_STEP_PROFILE[lt];
  if (!profile) return null;

  var out = {
    operators: profile.operators.slice(),
    steps: profile.steps,
    legacyType: lt,
    migratable: true
  };
  if (profile.kind) out.kind = profile.kind;
  return out;
}


function isArithmeticMigratable(kp) {
  return !!resolveArithmeticSemantics(kp);
}

module.exports = {
  OP_ADD: OP_ADD, OP_SUB: OP_SUB, OP_MUL: OP_MUL, OP_DIV: OP_DIV,
  SINGLE_STEP_PROFILE: SINGLE_STEP_PROFILE,
  SPECIAL_ORAL_PROFILE: SPECIAL_ORAL_PROFILE,
  NON_MIGRATABLE: NON_MIGRATABLE,
  resolveArithmeticSemantics: resolveArithmeticSemantics,
  isArithmeticMigratable: isArithmeticMigratable
};
};
__defs["shared/generator/core/kp-complex-semantics.js"] = function (module, exports, require) {

'use strict';

var OP_ADD = '+', OP_SUB = '−', OP_MUL = '×', OP_DIV = '÷';


var COMPLEX_PROFILES = {
  
  
  'math-g1-m1-mixed-chain': {
    family: 'chain',
    operators: [OP_ADD, OP_SUB],
    steps: 2,
    allowBracket: false,
    comment: '连加连减与加减混合（g1）'
  },
  
  'math-g2-m3-chain-addsub': {
    family: 'chain',
    operators: [OP_ADD, OP_SUB],
    steps: 2,
    allowBracket: false,
    comment: '连加连减脱式（g2-m3）'
  },
  
  'math-g2-m3-multdiv-mixed': {
    family: 'chain',
    operators: [OP_MUL, OP_DIV],
    steps: 2,
    allowBracket: false,
    comment: '乘除混合脱式（g2-m3）'
  },
  
  'math-g2-m1-mixed-addsub': {
    family: 'chain',
    operators: [OP_ADD, OP_SUB],
    steps: 2,
    allowBracket: false,
    comment: '加减混合运算（g2-m1）'
  },
  
  'math-g2-m1-mixed-multdiv': {
    family: 'chain',
    operators: [OP_MUL, OP_DIV],
    steps: 2,
    allowBracket: false,
    comment: '乘除混合运算（g2-m1）'
  },
  
  
  'math-g2-m2-chain-add-col': {
    family: 'chain',
    operators: [OP_ADD],
    steps: 2,
    allowBracket: false,
    comment: '连加竖式（g2-m2）'
  },
  'math-g2-m2-chain-sub-col': {
    family: 'chain',
    operators: [OP_SUB],
    steps: 2,
    allowBracket: false,
    comment: '连减竖式（g2-m2）'
  },
  'math-g2-m2-mixed-col': {
    family: 'chain',
    operators: [OP_ADD, OP_SUB],
    steps: 2,
    allowBracket: false,
    comment: '加减混合竖式（g2-m2）'
  },

  
  
  'math-g2-m3-mixed-no-bracket': {
    family: 'no-bracket',
    operators: [OP_ADD, OP_SUB, OP_MUL, OP_DIV],
    steps: 2,
    allowBracket: false,
    comment: '无括号混合运算（先乘除后加减）'
  },

  
  
  'math-g2-m3-mixed-bracket': {
    family: 'bracket',
    operators: [OP_ADD, OP_SUB, OP_MUL, OP_DIV],
    steps: 2,
    allowBracket: true,
    comment: '带括号混合运算（先算括号内）'
  },

  
  
  'math-g1-m4-num-fill-unknown': {
    family: 'inverse',
    operators: [OP_ADD, OP_SUB],
    steps: 1,
    allowBracket: false,
    inverse: { mode: 'fill-operand' },
    comment: '在算式中填写未知的加数或减数'
  },
  
  'math-g2-m3-fill-operator': {
    family: 'inverse',
    operators: [OP_ADD, OP_SUB, OP_MUL, OP_DIV],
    steps: 1,
    allowBracket: false,
    inverse: { mode: 'fill-operator' },
    comment: '在○填+、−、×、÷使等式成立'
  }
};

var COMPLEX_KP_IDS = Object.keys(COMPLEX_PROFILES);


function resolveComplexSemantics(kp) {
  if (!kp || !kp.id) return null;
  var profile = COMPLEX_PROFILES[kp.id];
  if (!profile) return null;

  return {
    family: profile.family,
    operators: profile.operators.slice(),
    steps: profile.steps,
    allowBracket: !!profile.allowBracket,
    inverse: profile.inverse ? { mode: profile.inverse.mode } : null
  };
}


function isComplexMigratable(kpId) {
  return COMPLEX_KP_IDS.indexOf(kpId) !== -1;
}

module.exports = {
  OP_ADD: OP_ADD, OP_SUB: OP_SUB, OP_MUL: OP_MUL, OP_DIV: OP_DIV,
  COMPLEX_PROFILES: COMPLEX_PROFILES,
  COMPLEX_KP_IDS: COMPLEX_KP_IDS,
  resolveComplexSemantics: resolveComplexSemantics,
  isComplexMigratable: isComplexMigratable
};

};
__defs["shared/learner/learner-model.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var ErrorModel = (typeof LearnerErrorModel !== 'undefined') ? LearnerErrorModel
    : (typeof require !== 'undefined' ? require("shared/learner/error-model.js") : null);
  if (!ErrorModel) throw new Error('learner-model.js 依赖 error-model.js');

  var VERSION = 1;
  var DEFAULT_ALPHA = 0.3;      
  var RECENT_WINDOW = 10;       
  var RECENT_RESULTS_CAP = 20;  
  var DIFF_MIN = 1, DIFF_MAX = 10;

  
  function defaultKpState(kpId) {
    return {
      kpId: kpId || null,
      mastery: 0,
      confidence: 0,
      attempts: 0,
      correct: 0,
      accuracy: 0,
      recentAccuracy: 0,
      recentResults: [],
      errorPatterns: {},
      exposureCount: 0,
      lastPracticedAt: null,
      recommendedDifficulty: DIFF_MIN,
      recommendedSpiralLevel: 1,
      updatedAt: null
    };
  }

  
  function clamp01(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }
  function clampDiff(n) {
    if (typeof n !== 'number' || !isFinite(n)) return DIFF_MIN;
    return Math.min(DIFF_MAX, Math.max(DIFF_MIN, Math.round(n)));
  }
  function clampLevel(n, max) {
    if (typeof n !== 'number' || !isFinite(n)) return 1;
    return Math.min(max, Math.max(1, Math.round(n)));
  }
  function nonNegInt(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  
  function normalizeKpState(raw, kpId) {
    var d = defaultKpState(kpId);
    if (raw == null || typeof raw !== 'object') return d;
    d.mastery = clamp01(raw.mastery);
    d.confidence = clamp01(raw.confidence);
    d.attempts = nonNegInt(raw.attempts);
    d.correct = Math.min(nonNegInt(raw.correct), d.attempts); 
    d.accuracy = clamp01(raw.accuracy != null ? raw.accuracy : (d.attempts ? d.correct / d.attempts : 0));
    d.exposureCount = nonNegInt(raw.exposureCount);
    d.recentResults = valuesAre01Array(raw.recentResults);
    d.recentAccuracy = clamp01(raw.recentAccuracy != null ? raw.recentAccuracy
      : (d.recentResults.length ? avg(d.recentResults) : d.accuracy));
    d.errorPatterns = ErrorModel.normalizePatterns(raw.errorPatterns);
    d.lastPracticedAt = isValidTs(raw.lastPracticedAt) ? raw.lastPracticedAt : null;
    d.updatedAt = isValidTs(raw.updatedAt) ? raw.updatedAt : null;
    d.recommendedDifficulty = clampDiff(raw.recommendedDifficulty == null ? DIFF_MIN : raw.recommendedDifficulty);
    d.recommendedSpiralLevel = clampLevel(raw.recommendedSpiralLevel == null ? 1 : raw.recommendedSpiralLevel, 6);
    
    if ((raw.mastery == null || typeof raw.mastery !== 'number' || !isFinite(raw.mastery)) && d.attempts) {
      d.mastery = recomputeMasteryFallback(d);
    }
    return d;
  }

  function recomputeMasteryFallback(s) {
    
    return s.attempts ? clamp01(s.correct / s.attempts) : 0;
  }

  function valuesAre01Array(v) {
    if (!Array.isArray(v)) return [];
    return v.map(function (x) {
      var n = Number(x);
      return (n === 0 || n === 1) ? n : 0;
    }).slice(-RECENT_RESULTS_CAP);
  }
  function avg(a) {
    if (!a.length) return 0;
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
  }
  function isValidTs(v) {
    return typeof v === 'number' && isFinite(v) && v > 0;
  }

  
  function normalizeLearnerState(state) {
    var out = { version: VERSION, updatedAt: null, knowledgePoints: {} };
    if (state == null || typeof state !== 'object') return out;
    out.version = VERSION;
    out.updatedAt = isValidTs(state.updatedAt) ? state.updatedAt : null;
    var kps = (state && state.knowledgePoints != null && typeof state.knowledgePoints === 'object') ? state.knowledgePoints : {};
    if (state && state.mastery != null && typeof state === 'object' && state.kpId != null) {
      
      kps = {}; kps[String(state.kpId)] = state;
    }
    Object.keys(kps).forEach(function (kpId) {
      if (!kpId) return;
      out.knowledgePoints[kpId] = normalizeKpState(kps[kpId], kpId);
    });
    return out;
  }

  
  function get(state, kpId) {
    if (!kpId) return defaultKpState(null);
    state = normalizeLearnerState(state);
    if (!state.knowledgePoints[kpId]) return null; 
    return state.knowledgePoints[kpId];
  }

  function getOrInit(state, kpId) {
    var got = get(state, kpId);
    return got ? got : defaultKpState(kpId);
  }

  
  function upsert(state, kpId, patch) {
    state = normalizeLearnerState(state);
    if (!kpId) return state;
    var cur = state.knowledgePoints[kpId] || defaultKpState(kpId);
    if (patch && typeof patch === 'object') {
      Object.keys(patch).forEach(function (k) {
        if (k === 'kpId' && patch[k] == null) return;
        if (patch[k] !== undefined) cur[k] = patch[k];
      });
    }
    cur.updatedAt = Date.now();
    
    cur.accuracy = cur.attempts ? cur.correct / cur.attempts : 0;
    cur.recentAccuracy = cur.recentResults.length ? avg(cur.recentResults) : cur.accuracy;
    cur.kpId = kpId;
    cur = normalizeKpState(cur, kpId);
    state.knowledgePoints[kpId] = cur;
    state.updatedAt = cur.updatedAt;
    return state;
  }

  
  function computeMastery(kpState, result) {
    var prev = kpState ? clamp01(kpState.mastery) : 0;
    var res = result ? (result.correct === true ? 1 : 0) : 0;
    return clamp01(round3(DEFAULT_ALPHA * res + (1 - DEFAULT_ALPHA) * prev));
  }

  
  function computeConfidence(kpState) {
    var s = kpState || defaultKpState(null);
    var rawN = s.attempts + (s.exposureCount || 0) * 0.5;
    if (rawN <= 0) return 0;
    var sizeFactor = 1 - Math.pow(0.75, rawN);           
    var consistency = s.recentAccuracy != null ? clamp01(s.recentAccuracy)
      : (s.attempts ? s.correct / s.attempts : 0);
    var consistencyGain = 0.5 + 0.5 * consistency;
    return clamp01(round3(sizeFactor * consistencyGain * 0.9 + 0.1));
  }

  
  function accuracyOf(s) { return s.attempts ? clamp01(s.correct / s.attempts) : 0; }
  function recentAccuracyOf(s, windowN) {
    var n = (typeof windowN === 'number' && windowN > 0) ? windowN : RECENT_WINDOW;
    var arr = (s.recentResults || []).slice(-n);
    return arr.length ? avg(arr) : accuracyOf(s);
  }

  
  function recommendDefaults(s, baseDifficulty) {
    var base = baseDifficulty == null ? DIFF_MIN : clampDiff(baseDifficulty);
    var m = clamp01(s.mastery);
    var adj = 0;
    if (m < 0.4) adj = -1;
    else if (m < 0.7) adj = 0;
    else if (m < 0.85) adj = 1;
    else adj = 2;
    
    var conf = clamp01(s.confidence);
    if (conf < 0.3) adj = Math.round(adj / 2);
    var spiral = m < 0.4 ? 1 : (m < 0.7 ? 2 : (m < 0.85 ? 3 : 4));
    if (conf < 0.3) spiral = Math.min(spiral, 2);
    return {
      recommendedDifficulty: clamp(base + adj, DIFF_MIN, DIFF_MAX),
      recommendedSpiralLevel: clampLevel(spiral, 6)
    };
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function round3(n) { return Math.round(n * 1000) / 1000; }

  
  
  function update(state, result, opts) {
    opts = opts || {};
    if (!result || !result.knowledgePointId) {
      throw new Error('LearnerModel.update 需要含 knowledgePointId 的 PracticeResult');
    }
    state = normalizeLearnerState(state);
    var kpId = result.knowledgePointId;
    var kp = state.knowledgePoints[kpId] || defaultKpState(kpId);
    var ts = (typeof opts.now === 'number') ? opts.now : Date.now();
    var alpha = (typeof opts.alpha === 'number' && opts.alpha > 0 && opts.alpha <= 1) ? opts.alpha : DEFAULT_ALPHA;

    var isSkip = result.status === 'skipped';
    var isRedo = result.status === 'redo';

    
    var res = isSkip ? null : (result.correct === true ? 1 : 0);

    if (!isSkip) {
      kp.exposureCount += 1;
      if (!isRedo) {
        
        kp.attempts += 1;
        if (res === 1) kp.correct += 1;
      }
    } else {
      kp.exposureCount += 1;
    }

    
    if (!isSkip) {
      kp.recentResults.push(res);
      if (kp.recentResults.length > RECENT_RESULTS_CAP) kp.recentResults = kp.recentResults.slice(-RECENT_RESULTS_CAP);
    }

    
    if (!isSkip) {
      var prevM = clamp01(kp.mastery);
      kp.mastery = clamp01(round3(alpha * res + (1 - alpha) * prevM));
      kp.recentAccuracy = round3(recentAccuracyOf(kp));
      kp.accuracy = kp.attempts ? clamp01(kp.correct / kp.attempts) : 0;
      kp.confidence = computeConfidence(kp);
    }

    
    var etype = ErrorModel.resolveErrorType(result);
    if (etype && !isSkip) {
      ErrorModel.recordError(kp.errorPatterns, etype, ts);
    }

    kp.lastPracticedAt = ts;
    kp.updatedAt = ts;

    
    var rec = recommendDefaults(kp, opts.baseDifficulty);
    kp.recommendedDifficulty = rec.recommendedDifficulty;
    kp.recommendedSpiralLevel = rec.recommendedSpiralLevel;

    kp = normalizeKpState(kp, kpId);
    state.knowledgePoints[kpId] = kp;
    state.updatedAt = ts;
    return state;
  }

  
  function getMastery(state, kpId) {
    var kp = get(state, kpId);
    return kp ? kp.mastery : 0;
  }
  function getConfidence(state, kpId) {
    var kp = get(state, kpId);
    return kp ? kp.confidence : 0;
  }
  function getAccuracy(state, kpId) {
    var kp = get(state, kpId);
    return kp ? kp.accuracy : 0;
  }
  function getRecentAccuracy(state, kpId) {
    var kp = get(state, kpId);
    return kp ? kp.recentAccuracy : 0;
  }
  function getErrors(state, kpId) {
    var kp = get(state, kpId);
    return kp ? ErrorModel.getErrorFocus(kp.errorPatterns) : [];
  }
  function getState(state, kpId) {
    if (kpId == null) return normalizeLearnerState(state);
    var kp = get(state, kpId);
    return kp ? kp : defaultKpState(kpId);
  }

  var LearnerModel = {
    VERSION: VERSION,
    DEFAULT_ALPHA: DEFAULT_ALPHA,
    RECENT_WINDOW: RECENT_WINDOW,
    defaultKpState: defaultKpState,
    normalizeKpState: normalizeKpState,
    normalizeLearnerState: normalizeLearnerState,
    get: get,
    getOrInit: getOrInit,
    upsert: upsert,
    update: update,
    computeMastery: computeMastery,
    computeConfidence: computeConfidence,
    accuracyOf: accuracyOf,
    recentAccuracyOf: recentAccuracyOf,
    recommendDefaults: recommendDefaults,
    getMastery: getMastery,
    getConfidence: getConfidence,
    getAccuracy: getAccuracy,
    getRecentAccuracy: getRecentAccuracy,
    getErrors: getErrors,
    getState: getState,
    clear: function () { return { version: VERSION, updatedAt: null, knowledgePoints: {} }; }
  };

  global.LearnerModel = LearnerModel;
  if (typeof module !== 'undefined' && module.exports) module.exports = LearnerModel;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
};
__defs["shared/generator/generator-selector.js"] = function (module, exports, require) {

'use strict';

var GenRegistry = require("shared/generator/generator-registry.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var Mode = require("shared/generator/generator-mode.js");
var QuestionPlan = require("shared/strategy/question-plan.js");
var ArithSem = require("shared/generator/core/kp-arithmetic-semantics.js");
var ComplexSem = require("shared/generator/core/kp-complex-semantics.js");

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
  
  if (kp.moduleId === 'M7') return true;
  var p = kp.pluginId || '';
  if (p.indexOf('word-problem') !== -1 || p.indexOf('word_problem') !== -1) return true;
  
  return false;
}

function hasCountingSemantics(kp) {
  if (!kp) return false;
  var p = kp.pluginId || '';
  if (p.indexOf('combination') !== -1 || p.indexOf('counting') !== -1) return true;
  if (p.indexOf('c3-') !== -1) return true;
  
  if (p.indexOf('c3') !== -1 && p.indexOf('competition') !== -1) return true;
  if (kp.moduleId === 'C3') return true;
  return false;
}

function hasReasoningSemantics(kp) {
  if (!kp) return false;
  var p = kp.pluginId || '';
  if (p.indexOf('logic') !== -1 || p.indexOf('reason') !== -1) return true;
  if (p.indexOf('c8') !== -1) return true;
  if (kp.moduleId === 'C8') return true;
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
  
  if ((p.indexOf('c5') !== -1 || p.indexOf('c6') !== -1) && p.indexOf('competition') !== -1) return true;
  return false;
}

function hasC7Semantics(kp) {
  if (!kp) return false;
  var p = kp.pluginId || '';
  
  if (p.indexOf('c7') !== -1 && p.indexOf('competition') !== -1) return true;
  return false;
}

function hasC9Semantics(kp) {
  if (!kp) return false;
  var p = kp.pluginId || '';
  
  if (p.indexOf('c9') !== -1 && p.indexOf('competition') !== -1) return true;
  if (kp.moduleId === 'C9') return true;
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
  var kp = KnowledgePoint.get(primaryKp);
  var all = GenRegistry.all();
  var candidates = [];

  
  
  var arithSem = kp ? ArithSem.resolveArithmeticSemantics(kp) : null;
  var complexSem = kp ? ComplexSem.resolveComplexSemantics(kp) : null;
  
  var isAlgebraDomain = !!(kp && kp.legacy && kp.legacy.category === 'algebra');

  
  
  
  
  
  
  var combineKpCount = QuestionPlan.planKnowledgePointIds(plan).length;
  var isCombineRequest = plan.combine === true && combineKpCount >= 2;

  all.forEach(function (g) {
    var track = trackOf(g);
    if (mode === 'native' && track !== 'native') return;

    if (g.supportsComposite === true && !isCombineRequest) return;
    if (isCombineRequest && g.supportsComposite !== true) return;

    var score = { record: g, kp: 0, semanticOp: 0, capability: 0, qt: 0, diff: 0 };

    
    if (g.knowledgePoints.indexOf(primaryKp) !== -1) score.kp = 1;

    
    
    
    var qt = plan.questionTypeId;
    var isRecognize = qt === 'recognize';
    if (!isRecognize && isArithmeticFamily(g) && score.kp === 0 && !(arithSem || isAlgebraDomain || (kp && kp.operations && kp.operations.length > 0))) return;
    if (!isRecognize && isComplexFamily(g) && score.kp === 0 && !complexSem) return;
    if (!isRecognize && isShapeFamily(g) && score.kp === 0 && !hasShapeSemantics(kp)) return;
    if (!isRecognize && isMoneyFamily(g) && score.kp === 0 && !hasMoneySemantics(kp)) return;
    if (!isRecognize && isCountingFamily(g) && score.kp === 0 && !hasCountingSemantics(kp)) return;
    if (!isRecognize && isReasoningFamily(g) && score.kp === 0 && !hasReasoningSemantics(kp)) return;
    if (!isRecognize && isStatsFamily(g) && score.kp === 0 && !hasStatsSemantics(kp)) return;
    if (!isRecognize && isPictureEquationFamily(g) && score.kp === 0 && !hasPictureEquationSemantics(kp)) return;
    if (!isRecognize && isC1Family(g) && score.kp === 0 && !hasC1Semantics(kp)) return;
    if (!isRecognize && isC2Family(g) && score.kp === 0 && !hasC2Semantics(kp)) return;
    if (!isRecognize && isC5C6Family(g) && score.kp === 0 && !hasC5C6Semantics(kp)) return;
    if (!isRecognize && isC7Family(g) && score.kp === 0 && !hasC7Semantics(kp)) return;
    if (!isRecognize && isC9Family(g) && score.kp === 0 && !hasC9Semantics(kp)) return;

    
    if (isArithmeticFamily(g) || isComplexFamily(g) || isShapeFamily(g) || isMoneyFamily(g) || isCountingFamily(g) || isReasoningFamily(g) || isStatsFamily(g) || isPictureEquationFamily(g) || isC1Family(g) || isC2Family(g) || isC5C6Family(g) || isC7Family(g) || isC9Family(g)) {
      score.semanticOp = 1;
    } else if (score.kp === 1) {
      score.semanticOp = 1;
    }

    
    if (plan.questionTypeId && g.capabilities.indexOf(plan.questionTypeId) !== -1) score.capability = 1;

    
    if (plan.questionTypeId && g.questionTypes.indexOf(plan.questionTypeId) !== -1) score.qt = 1;

    
    if (g.difficultyRange && plan.difficulty != null) {
      if (plan.difficulty >= g.difficultyRange.min && plan.difficulty <= g.difficultyRange.max) score.diff = 1;
    }

    
    
    if (score.kp + score.capability + score.qt + score.diff > 0) candidates.push(score);
  });

  
  candidates.sort(function (a, b) {
    if (a.kp !== b.kp) return b.kp - a.kp;
    if (a.semanticOp !== b.semanticOp) return b.semanticOp - a.semanticOp;
    if (a.capability !== b.capability) return b.capability - a.capability;
    if (a.qt !== b.qt) return b.qt - a.qt;
    if (a.diff !== b.diff) return b.diff - a.diff;
    var va = a.record.version || 1, vb = b.record.version || 1;
    if (va !== vb) return vb - va;
    
    if (a.record.scope === 'core' && b.record.scope !== 'core') return -1;
    if (b.record.scope === 'core' && a.record.scope !== 'core') return 1;
    return 0;
  });

  if (candidates.length === 0) {
    
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


function instantiate(selection, plugin) {
  if (!selection || !selection.record) return null;
  
  var Generators = require("shared/generator/generators/index.js");
  var gen = Generators.get(selection.record.id);
  if (!gen) return null;

  var generatorId = selection.record.id;
  var generatorVersion = toSemver(selection.record.version);

  return wrapGenerator(gen, generatorId, generatorVersion);
}


function toSemver(v) {
  if (typeof v === 'string' && /^\d+\.\d+\.\d+/.test(v)) return v;
  var n = parseInt(v, 10);
  if (!isNaN(n)) return n + '.0.0';
  return String(v == null ? '1.0.0' : v);
}


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
};
__defs["shared/strategy/question-style-strategy.js"] = function (module, exports, require) {

'use strict';

var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;


var STYLE_REGISTRY = {
  calc:     { style: 'calc',   svgTemplate: 'svg-calculation', label: '计算式' },
  oral:     { style: 'calc',   svgTemplate: 'svg-calculation', label: '口算' },
  fill:     { style: 'fill',   svgTemplate: 'svg-calculation', label: '填空格' },
  choice:   { style: 'choice', svgTemplate: 'svg-choice',      label: '选项卡' },
  judge:    { style: 'judge',  svgTemplate: 'svg-judge',       label: '判断陈述' },
  apply:    { style: 'story',  svgTemplate: 'svg-story',       label: '图文应用' },
  geometry: { style: 'shape',  svgTemplate: 'svg-geometry',    label: '图形操作' },
  recognize: { style: 'choice', svgTemplate: 'svg-choice',     label: '认读识别' },
  open:     { style: 'open',   svgTemplate: 'svg-open',        label: '开放表达' }
};


var CATEGORY_STYLE_OVERRIDE = {
  geometry: { calc: 'shape' },     
  measurement: { apply: 'story' }, 
  synthesis: { choice: 'choice' }
};


function resolveQuestionStyle(options) {
  options = options || {};
  var qt = options.questionTypeId;
  if (typeof qt !== 'string' || !qt) {
    throw new StrategyError('questionTypeId 必填字符串', CODES.INVALID_REQUEST, { questionTypeId: qt });
  }
  var base = STYLE_REGISTRY[qt];
  if (!base) {
    throw new StrategyError('未知题型，无法确定固定样式: ' + qt, CODES.INVALID_REQUEST, { questionTypeId: qt, knowledgePointId: options.knowledgePointId });
  }
  var style = base.style;
  var category = options.category;
  if (category && CATEGORY_STYLE_OVERRIDE[category] && CATEGORY_STYLE_OVERRIDE[category][qt]) {
    style = CATEGORY_STYLE_OVERRIDE[category][qt];
  }
  return {
    style: style,
    svgTemplate: base.svgTemplate,
    label: base.label
  };
}


function listStyles() {
  var seen = {};
  var out = [];
  Object.keys(STYLE_REGISTRY).forEach(function (qt) {
    var r = STYLE_REGISTRY[qt];
    if (seen[r.style]) return;
    seen[r.style] = true;
    out.push({ style: r.style, svgTemplate: r.svgTemplate, label: r.label });
  });
  return out;
}

module.exports = {
  resolveQuestionStyle: resolveQuestionStyle,
  listStyles: listStyles,
  STYLE_REGISTRY: STYLE_REGISTRY
};

};
__defs["shared/strategy/complexity-strategy.js"] = function (module, exports, require) {

'use strict';

var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 10;
var TIERS = ['simple', 'standard', 'complex'];


function tierForDifficulty(difficulty) {
  if (typeof difficulty !== 'number' || !isFinite(difficulty)) {
    throw new StrategyError('difficulty 必须是有限数字: ' + difficulty, CODES.INVALID_REQUEST, { difficulty: difficulty });
  }
  var d = Math.max(DIFFICULTY_MIN, Math.min(DIFFICULTY_MAX, Math.floor(difficulty)));
  if (d <= 3) return 'simple';
  if (d <= 7) return 'standard';
  return 'complex';
}


function resolveComplexity(options) {
  options = options || {};
  if (options.difficulty == null) {
    throw new StrategyError('difficulty 必填（1-10）', CODES.INVALID_REQUEST, { knowledgePointId: options.knowledgePointId });
  }
  var tier = tierForDifficulty(options.difficulty);
  var spiral = options.spiralLevel != null ? options.spiralLevel : null;

  
  var spiralAdjusted = false;
  if (spiral != null) {
    if (tier === 'standard' && spiral >= 5 && options.difficulty >= 6) {
      tier = 'complex'; spiralAdjusted = true;
    } else if (tier === 'standard' && spiral <= 2 && options.difficulty <= 4) {
      tier = 'simple'; spiralAdjusted = true;
    }
  }

  var params = {
    simple:   { rangeBoost: 0, multiStep: false, mixLevel: 0 },
    standard: { rangeBoost: 1, multiStep: true,  mixLevel: 1 },
    complex:  { rangeBoost: 2, multiStep: true,  mixLevel: 2 }
  }[tier];

  return {
    tier: tier,
    label: tier === 'simple' ? '基础' : tier === 'standard' ? '标准' : '进阶',
    rangeBoost: params.rangeBoost,
    multiStep: params.multiStep,
    mixLevel: params.mixLevel,
    spiralAdjusted: spiralAdjusted
  };
}

module.exports = {
  resolveComplexity: resolveComplexity,
  tierForDifficulty: tierForDifficulty,
  TIERS: TIERS
};

};
__defs["shared/question-type-registry.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var COGNITIVE_LEVELS = ['recall', 'recognize', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

  var TYPES = [
    { id: 'oral', name: '口算', category: 'calculation',
      cognitiveLevels: ['recall', 'recognize', 'understand'], difficultyRange: [1, 4],
      supports: { context: true, graphic: false, distractors: false } },
    { id: 'calc', name: '计算', category: 'calculation',
      cognitiveLevels: ['recall', 'understand', 'apply'], difficultyRange: [1, 6],
      supports: { context: true, graphic: false, distractors: false } },
    { id: 'fill', name: '填空', category: 'written',
      cognitiveLevels: ['recall', 'understand', 'apply'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'choice', name: '选择', category: 'selection',
      cognitiveLevels: ['recognize', 'understand', 'apply'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: true } },
    { id: 'judge', name: '判断', category: 'selection',
      cognitiveLevels: ['recognize', 'understand'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'apply', name: '应用', category: 'application',
      cognitiveLevels: ['understand', 'apply', 'analyze'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'open', name: '开放', category: 'open',
      cognitiveLevels: ['apply', 'analyze', 'create'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'geometry', name: '几何', category: 'geometry',
      cognitiveLevels: ['recognize', 'understand', 'apply', 'analyze'], difficultyRange: [1, 6],
      supports: { context: false, graphic: true, distractors: false } },
    { id: 'recognize', name: '认读', category: 'recognition',
      cognitiveLevels: ['recall', 'recognize', 'understand'], difficultyRange: [1, 4],
      supports: { context: false, graphic: true, distractors: false } }
  ];

  
  var CANONICAL_ALIASES = {
    operate: 'oral', oral: 'oral', 'law-oral': 'oral', 'dec-mul-oral': 'oral', 'dec-div-oral': 'oral',
    'frac-addsub-oral': 'oral', 'equation-oral': 'oral', 'mul-oral': 'oral',
    calc: 'calc', cushi: 'calc', addsub: 'calc', mixed: 'calc', mix: 'calc', column: 'calc',
    'chain-add': 'calc', 'chain-sub': 'calc', 'chain': 'calc', bracket: 'calc', 'multdiv': 'calc',
    add: 'calc', sub: 'calc', mult: 'calc', div: 'calc', remainder: 'calc',
    'mul-table': 'calc', 'div-table': 'calc', multiTable: 'calc', 'big-addsub': 'calc',
    'mul3x1': 'calc', 'mul2tens': 'calc', 'div-tens': 'calc', 'mul3x2': 'calc', 'mul-zero': 'calc',
    'div-2digit': 'calc', 'div-2quotient': 'calc', 'dec-vertical': 'calc', 'add-law': 'calc',
    'mul-law': 'calc', 'dist-law': 'calc', 'dec-simple': 'calc', 'dec-addsub': 'calc',
    'big-num': 'calc', dec: 'calc', vertical: 'calc', 'vertical-multi': 'calc', 'carry-complex': 'calc',
    'neg-add-sub': 'calc', 'dec-mult': 'calc', 'dec-div': 'calc', decimal: 'calc', negative: 'calc',
    'est-muldiv': 'calc', estimate: 'calc', rounding: 'calc', 'dec-meaning': 'calc', 'dec-place': 'calc',
    'dec-compare': 'calc', 'dec-mixed': 'calc', 'frac-mixed': 'calc', 'frac-simple': 'calc',
    'frac-line': 'calc', 'int-split': 'calc', 'frac-split': 'calc', 'frac-perc': 'calc',
    fill: 'fill', 'fill-length': 'fill', 'fill-mass': 'fill', 'fill-time': 'fill', cutfill: 'fill',
    choice: 'choice', matching: 'choice', 'match-shape': 'choice', 'match-clock': 'choice', 'match-rmb': 'choice',
    judge: 'judge', comparison: 'judge',
    apply: 'apply', word: 'apply', open: 'apply', 'big-app': 'apply', 'mul-travel': 'apply',
    'word-problem': 'apply', 'word-problems': 'apply',
    'div-share': 'apply', 'price-qty': 'apply', 'dec-pay': 'apply', 'avg-score': 'apply', 'dec-scene': 'apply',
    'dec-mul-app': 'apply', 'dec-div-app': 'apply', 'equation-app': 'apply', 'factor-app': 'apply',
    'frac-app': 'apply', 'area-app': 'apply', 'solid-app': 'apply', 'possibility-app': 'apply',
    'linechart-app': 'apply', 'tree-app': 'apply', 'speed-distance': 'apply', work: 'apply',
    concentration: 'apply', 'profit-loss': 'apply', age: 'apply', planting: 'apply', phalanx: 'apply',
    grass: 'apply', economics: 'apply', 'percent-discount': 'apply', ratio: 'apply', proportion: 'apply',
    percent: 'apply', optimize: 'apply', optimization: 'apply', 'journey-complex': 'apply', 'travel-work': 'apply',
    'sum-diff': 'apply', 'inclusion-exclusion': 'apply', equation: 'apply', fraction: 'apply', area: 'apply',
    rotation: 'apply', array: 'apply', magic: 'apply', sequence: 'apply', series: 'apply', recurring: 'apply',
    'chicken-rabbit': 'apply', pancake: 'apply', assume: 'apply', law: 'apply', quotient: 'apply', stats: 'apply',
    'big-compare': 'apply', horizontal: 'apply', symbol: 'apply', 'divisibility': 'apply', 'prime-factor': 'apply',
    'factor-count': 'apply', 'gcd-lcm': 'apply', 'perfect-square': 'apply', 'nt-extreme': 'apply',
    'add-principle': 'apply', 'mult-principle': 'apply', permutation: 'apply', enumeration: 'apply',
    bundling: 'apply', insertion: 'apply', 'stars-bars': 'apply', pigeonhole: 'apply', 'worst-case': 'apply',
    'area-basic': 'apply', 'equal-area': 'apply', 'bird-head': 'apply', 'butterfly': 'apply', 'swallow-tail': 'apply',
    half: 'apply', 'painted-cube': 'apply', pythagorean: 'apply', lattice: 'apply', boat: 'apply', circular: 'apply',
    'avg-speed': 'apply', 'ratio-prop': 'apply', 'ratio-simp': 'apply', 'frac-percent': 'apply', 'cy-cone': 'apply',
    'cyl-cone': 'apply', 'number-shape': 'apply', 'percent-ratio': 'apply', 'magic-adv': 'apply', 'array-adv': 'apply',
    competition: 'apply', modulo: 'apply', recursion: 'apply', derangement: 'apply', periodic: 'apply',
    'sequence-sum': 'apply', extremum: 'apply', winning: 'apply', 'define-op': 'apply', 'complex-frac': 'apply',
    diophantine: 'apply', eq1: 'apply', eq2: 'apply', 'frac-mult-int': 'apply', 'frac-mult-frac': 'apply',
    'frac-div-int': 'apply', 'frac-div-frac': 'apply', 'dec-perc': 'apply', 'frac-mult-div': 'apply',
    'solve-proportion': 'apply', 'frac-order': 'apply', 'solve-equation': 'apply', 'cylinder-cone': 'apply',
    formula: 'apply', chart: 'apply', 'rotate-scale': 'apply', 'frac-mult': 'apply', 'frac-div': 'apply', scale: 'apply',
    'dec-div-int': 'apply', 'dec-div-dec': 'apply', 'repeating-dec': 'apply', 'product-rule': 'apply',
    'repeating-note': 'apply', 'equation-prop': 'apply', 'prime-composite': 'apply', 'frac-meaning': 'apply',
    'frac-property': 'apply', 'frac-decimal': 'apply', coordinate: 'apply', 'area-formula': 'apply',
    'solid-formula': 'apply', 'rotation-elem': 'apply', possibility: 'apply', 'linechart-feature': 'apply',
    'solid-feature': 'apply', 'possibility-desc': 'apply', 'equation-solve': 'apply', 'rotation-draw': 'apply',
    'observe-3d': 'apply', 'polygon-height': 'apply', 'coordinate-plot': 'apply', 'solid-net': 'apply',
    'balance-equation': 'apply', 'area-picture': 'apply', 'tree-planting': 'apply', 'possibility-compare': 'apply',
    'linechart-single': 'apply', 'linechart-double': 'apply', 'tree-three': 'apply', defective: 'apply',
    'defective-scale': 'apply', 'dec-mul-vertical': 'apply',
    geometry: 'geometry', circle: 'geometry', angle: 'geometry', clock: 'geometry', 'clock-read': 'geometry',
    'clock-draw': 'geometry', clockFace: 'geometry', shape: 'geometry', 'draw-shape': 'geometry', symmetry: 'geometry',
    translate: 'geometry', perimeter: 'geometry', rect: 'geometry', compass: 'geometry', 'line-ray': 'geometry',
    'angle-metric': 'geometry', quad: 'geometry', 'op-meaning': 'geometry', 'quotient-law': 'geometry',
    triangle: 'geometry', average: 'geometry', 'angle-degree': 'geometry', 'shape-feature': 'geometry',
    'law-formula': 'geometry', 'dec-frac': 'geometry', protractor: 'geometry', 'parallel-perp': 'geometry',
    'grid-quad': 'geometry', observe: 'geometry', 'segment-multiple': 'geometry', 'brace-addsub': 'geometry',
    'area-hectare': 'geometry', hectare: 'geometry', solid: 'geometry', flat: 'geometry', 'count-graph': 'geometry',
    position: 'geometry', grid: 'geometry', 'draw-line': 'geometry', 'draw-angle': 'geometry', measure: 'geometry',
    motion: 'geometry', transform: 'geometry', basic: 'geometry', meet: 'geometry', chase: 'geometry', train: 'geometry',
    river: 'geometry', extreme: 'geometry', drawer: 'geometry', integrated: 'geometry', misc: 'geometry', mock: 'geometry',
    'geometry-count': 'geometry', 'circle-angle': 'geometry', 'solid-rotation': 'geometry', 'interval-departure': 'geometry',
    'pick-up': 'geometry', mixture: 'geometry', all: 'geometry', 'factor-multiple': 'geometry',
    read: 'recognize', number: 'recognize', count: 'recognize', tally: 'recognize', enum: 'recognize',
    classify: 'recognize', table: 'recognize', picto: 'recognize', set: 'recognize', place: 'recognize',
    am: 'recognize', perm: 'recognize', pa: 'recognize', digit: 'recognize', composite: 'recognize', shard: 'recognize',
    ym: 'recognize', relation: 'recognize', operator: 'recognize', readwrite: 'recognize', approx: 'recognize',
    length: 'recognize', mass: 'recognize', time: 'recognize', pattern: 'recognize', 'mult-meaning': 'recognize',
    'div-meaning': 'recognize', unit: 'recognize', convert: 'recognize', order: 'recognize', compare: 'recognize',
    'big-compare': 'recognize', parity: 'recognize', divisible: 'recognize', prime: 'recognize', factor: 'recognize',
    'digit-reason': 'recognize'
  };

  var GEOMETRY_KEYWORDS = [
    'angle', 'shape', 'clock', 'circle', 'symmetry', 'coordinate', 'draw', 'grid', 'line', 'ray',
    'perimeter', 'area', 'solid', 'rotate', 'rotation', 'translate', 'scale', 'cylinder', 'cone',
    'triangle', 'quad', 'parallel', 'perpendicular', 'protractor', 'compass', 'segment', 'polygon',
    'lattice', 'pythagorean', 'geometry', 'observe-3d', 'solid-net', 'solid-feature', 'rotation-elem',
    'rotation-draw', 'polygon-height', 'coordinate-plot', 'geomcount', 'geometry-count', 'grid-quad',
    'circle-angle', 'solid-rotation', 'angle-degree', 'angle-metric', 'shape-feature', 'line-ray',
    'draw-line', 'draw-angle', 'draw-shape', 'motion', 'transform', 'count-graph', 'measure'
  ];

  var RECOGNIZE_KEYWORDS = [
    'read', 'number', 'count', 'tally', 'enum', 'classify', 'table', 'picto', 'set', 'place',
    'digit', 'composite', 'shard', 'ym', 'relation', 'operator', 'readwrite', 'approx', 'length',
    'mass', 'time', 'pattern', 'meaning', 'unit', 'convert', 'order', 'compare', 'parity',
    'divisible', 'prime', 'factor', 'recognize', 'recall'
  ];

  var BY_ID = {};
  TYPES.forEach(function (t) { BY_ID[t.id] = t; });

  
  
  
  var LEGACY_DISPLAY_NAMES = {
    addsub: '加减法', muldiv: '乘除法', cushi: '凑十法', pingshi: '平十法', poshi: '破十法',
    mix: '混合', pattern: '找规律', clock: '钟表', money: '人民币'
  };

  function isCognitiveLevel(v) { return COGNITIVE_LEVELS.indexOf(v) !== -1; }

  function normalizeQuestionType(token, opts) {
    opts = opts || {};
    if (!token || typeof token !== 'string') return { id: null, confidence: 'none' };
    if (BY_ID[token]) return { id: token, confidence: 'exact' };
    var mapped = CANONICAL_ALIASES[token];
    if (mapped) return { id: mapped, confidence: 'explicit' };
    var lower = token.toLowerCase();
    var i;
    for (i = 0; i < GEOMETRY_KEYWORDS.length; i++) {
      if (lower.indexOf(GEOMETRY_KEYWORDS[i]) !== -1) return { id: 'geometry', confidence: 'heuristic' };
    }
    for (i = 0; i < RECOGNIZE_KEYWORDS.length; i++) {
      if (lower.indexOf(RECOGNIZE_KEYWORDS[i]) !== -1) return { id: 'recognize', confidence: 'heuristic' };
    }
    if (opts.allowHeuristic !== false) return { id: 'calc', confidence: 'heuristic' };
    return { id: null, confidence: 'unmapped' };
  }

  function validateType(t) {
    var errs = [];
    if (!t || !t.id) errs.push('题型缺少 id');
    if (!t.name) errs.push('题型缺少 name');
    if (!t.category) errs.push('题型缺少 category');
    if (!Array.isArray(t.cognitiveLevels) || t.cognitiveLevels.length === 0) errs.push('cognitiveLevels 非法');
    else t.cognitiveLevels.forEach(function (c) { if (!isCognitiveLevel(c)) errs.push('非法 cognitiveLevel: ' + c); });
    if (!Array.isArray(t.difficultyRange) || t.difficultyRange.length !== 2) errs.push('difficultyRange 非法');
    else {
      var lo = t.difficultyRange[0], hi = t.difficultyRange[1];
      if (typeof lo !== 'number' || typeof hi !== 'number' || lo < 1 || hi > 6 || lo > hi) errs.push('difficultyRange 越界: ' + lo + '-' + hi);
    }
    if (!t.supports || typeof t.supports !== 'object') errs.push('supports 非法');
    else {
      ['context', 'graphic', 'distractors'].forEach(function (k) {
        if (typeof t.supports[k] !== 'boolean') errs.push('supports.' + k + ' 必须为布尔');
      });
    }
    return errs;
  }

  
  function displayName(value) {
    if (!value || typeof value !== 'string') return null;
    var t = BY_ID[value];
    if (t) return t.name;
    return LEGACY_DISPLAY_NAMES[value] || null;
  }

  var validationErrors = [];
  var seen = {};
  TYPES.forEach(function (t) {
    if (seen[t.id]) validationErrors.push('重复题型 ID: ' + t.id);
    seen[t.id] = 1;
    validateType(t).forEach(function (e) { validationErrors.push(t.id + ' :: ' + e); });
  });

  var API = {
    COGNITIVE_LEVELS: COGNITIVE_LEVELS,
    TYPES: TYPES,
    canonicalAliases: CANONICAL_ALIASES,
    LEGACY_DISPLAY_NAMES: LEGACY_DISPLAY_NAMES,
    get: function (id) { return BY_ID[id] || null; },
    has: function (id) { return !!BY_ID[id]; },
    all: function () { return TYPES.slice(); },
    displayName: displayName,
    byCategory: function (category) { return TYPES.filter(function (t) { return t.category === category; }); },
    supports: function (id, capability) {
      var t = BY_ID[id];
      if (!t) return false;
      return !!(t.supports && t.supports[capability]);
    },
    normalizeQuestionType: normalizeQuestionType,
    validate: function (id) {
      var t = BY_ID[id];
      if (!t) return { valid: false, errors: ['未知题型 ID: ' + id] };
      return { valid: validationErrors.length === 0, errors: validateType(t) };
    },
    validationErrors: validationErrors
  };

  global.QuestionTypeRegistry = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/knowledge-point.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var KnowledgeBank = require("shared/knowledge-bank.js");
  var Ontology = require("shared/knowledge-ontology.js");
  var SUBJECTS = Ontology.SUBJECTS;

  
  
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

};
__defs["shared/render.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  function renderCard(q, idx, opts) {
    opts = opts || {};
    var st = function (key, extra) {
      var s = (extra || '');
      return s ? ' style="' + s + '"' : '';
    };
    var inpW = opts.inputWidth || 96;
    
    var inpWStyle = opts.inputWidth ? 'width:' + inpW + 'px;' : '';
    var svgHtml = '';
    if (q.svg) {
      svgHtml = '<div class="scene-box"' + st('scene-box') + '>' + q.svg + '</div>';
    }
    var hintHtml = q.hint ? '<div class="q-hint"' + st('q-hint') + '>💡 ' + q.hint + '</div>' : '';
    var badgeHtml = '';
    if (opts.badgeLabels && q.type && opts.badgeLabels[q.type]) {
      badgeHtml = '<span class="badge"' + st('badge') + '>' + opts.badgeLabels[q.type] + '</span>';
    }
    var formulaHtml = '<span class="qa-label"' + st('qa-label') + '>算式</span>' +
      '<input type="text" class="formula-inp" data-formula="' + idx + '" placeholder="列式" autocomplete="off" aria-label="第 ' + (idx + 1) + ' 题 列式"' + st('formula-inp', 'width:120px;') + '>' +
      '<span class="qa-label"' + st('qa-label') + '>答案</span>';
    var inputHtml = '';
    if (q.inputType === 'choice') {
      var optsHtml = '';
      (q.options || []).forEach(function (o) {
        optsHtml += '<button type="button" class="opt" role="radio" aria-checked="false" data-val="' + String(o).replace(/"/g, '&quot;') + '" aria-label="第 ' + (idx + 1) + ' 题 选项：' + o + '" onclick="window.__pickOpt(this)"' + st('opt') + '>' + o + '</button>';
      });
      inputHtml = '<div class="options" role="radiogroup" aria-label="第 ' + (idx + 1) + ' 题 选项"' + st('options') + '>' + optsHtml + '</div>' +
        '<input type="hidden" data-index="' + idx + '">';
    } else if (q.inputType === 'multi') {
      var count = q.inputCount || (Array.isArray(q.answer) ? q.answer.length : 1);
      var inputs = '';
      for (var j = 0; j < count; j++) {
        inputs += '<input type="text" class="answer-inp" data-idx="' + idx + '" data-field="' + j + '" placeholder="?" autocomplete="off" aria-label="第 ' + (idx + 1) + ' 题 第 ' + (j + 1) + ' 空"' + st('answer-inp', inpWStyle) + '>';
      }
      inputHtml = '<div class="input-group"' + st('input-group') + '>' + inputs + '</div>';
    } else {
      inputHtml = '<div class="input-group"' + st('input-group') + '>' +
        '<input type="text" class="answer-inp" data-index="' + idx + '" placeholder="?" autocomplete="off" aria-label="第 ' + (idx + 1) + ' 题 答案"' + st('answer-inp', inpWStyle) + '>' +
        (q.unit ? '<span class="unit"' + st('unit') + '>' + q.unit + '</span>' : '') +
        '</div>';
    }
    var qaRowHtml = '<div class="qa-row"' + st('qa-row') + '>' + formulaHtml + inputHtml + '</div>';
    var qTextHtml = q.rawHtml ? (q.q || '') : '<span class="q-text">' + (q.q || q.text || '') + '</span>';
    var qHeaderHtml = '<div class="q-header"' + st('q-header') + '>' +
      '<span class="num"' + st('num') + '>' + (idx + 1) + '</span>' +
      '&nbsp;&nbsp;&nbsp;&nbsp;' +
      qTextHtml +
      '</div>';
    return '<div class="question-card" data-index="' + idx + '" role="group" aria-label="第 ' + (idx + 1) + ' 题"' + st('question-card') + '>' +
      qHeaderHtml +
      badgeHtml +
      svgHtml +
      qaRowHtml +
      hintHtml +
      '<div class="feedback"' + st('feedback') + ' aria-live="polite"></div>' +
      '</div>';
  }

  
  function renderGrid(questions, opts) {
    opts = opts || {};
    var cols = opts.columns || 3;
    var html = '<div class="questions-grid" style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:14px;">';
    questions.forEach(function (q, i) { html += renderCard(q, i, opts); });
    return html + '</div>';
  }

  
  
  function clockSVG(hour, minute) {
    hour = ((hour % 12) + 12) % 12;
    minute = minute || 0;
    var cx = 60, cy = 60, r = 54;
    var hAngle = (hour % 12) * 30 + minute * 0.5;  
    var mAngle = minute * 6;
    var hRad = (hAngle - 90) * Math.PI / 180;
    var mRad = (mAngle - 90) * Math.PI / 180;
    var hx = cx + 26 * Math.cos(hRad);
    var hy = cy + 26 * Math.sin(hRad);
    var mx = cx + 42 * Math.cos(mRad);
    var my = cy + 42 * Math.sin(mRad);
    var ticks = '';
    for (var i = 0; i < 12; i++) {
      var a = (i * 30 - 90) * Math.PI / 180;
      var r1 = (i % 3 === 0) ? 46 : 49;
      ticks += '<line x1="' + (cx + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (cy + r1 * Math.sin(a)).toFixed(1) +
        '" x2="' + (cx + r * Math.cos(a)).toFixed(1) + '" y2="' + (cy + r * Math.sin(a)).toFixed(1) +
        '" stroke="#9aa6bd" stroke-width="' + (i % 3 === 0 ? 2 : 1) + '"/>';
    }
    
    var nums = [[12, 0], [3, 90], [6, 180], [9, 270]];
    var numHtml = '';
    nums.forEach(function (n) {
      var a = (n[1] - 90) * Math.PI / 180;
      var nx = cx + 40 * Math.cos(a);
      var ny = cy + 40 * Math.sin(a) + 4;
      numHtml += '<text x="' + nx.toFixed(1) + '" y="' + ny.toFixed(1) + '" text-anchor="middle" font-size="14" fill="#5b6b85" font-weight="700">' + n[0] + '</text>';
    });
    return '<svg width="120" height="120" viewBox="0 0 120 120" style="background:#fff;border-radius:50%;">' +
      '<circle cx="60" cy="60" r="54" fill="#fafbff" stroke="#5b8def" stroke-width="3"/>' +
      ticks + numHtml +
      '<line x1="60" y1="60" x2="' + hx.toFixed(1) + '" y2="' + hy.toFixed(1) + '" stroke="#27324a" stroke-width="4" stroke-linecap="round"/>' +
      '<line x1="60" y1="60" x2="' + mx.toFixed(1) + '" y2="' + my.toFixed(1) + '" stroke="#e8870a" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="60" cy="60" r="4" fill="#27324a"/>' +
      '</svg>';
  }

  
  
  function createPlugin(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('createPlugin(config)：配置对象缺失');
    }
    var id = config.id, name = config.name, subject = config.subject, grades = config.grades;
    if (!id || typeof id !== 'string') console.error('[createPlugin] 插件 ' + (name || '?') + ' 缺少必填字段 id（字符串）');
    if (!name) console.error('[createPlugin] 插件 ' + id + ' 缺少必填字段 name');
    if (!subject) console.error('[createPlugin] 插件 ' + id + ' 缺少必填字段 subject');
    if (!grades || !Array.isArray(grades) || !grades.length) console.error('[createPlugin] 插件 ' + id + ' 缺少必填字段 grades（非空数组）');
    if (typeof config.generateQuestions !== 'function') console.error('[createPlugin] 插件 ' + id + ' 必须提供 generateQuestions(opts) 函数');

    var _kb = (typeof global.KnowledgeBank !== 'undefined') ? global.KnowledgeBank : null;

    function defaultRender(set) {
      var cols = (set && set.meta && set.meta.columns) || config.columns || 3;
      var html = '<div class="questions-grid" style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:14px;">';
      set.questions.forEach(function (q, i) {
        html += (typeof q.render === 'function') ? q.render(i) : renderCard(q, i);
      });
      html += '</div>';
      return html;
    }

    function defaultCheck(set, answers) {
      var correct = 0, results = [], correctAnswers = [];
      set.questions.forEach(function (q, i) {
        var ok;
        if (typeof q.check === 'function') ok = !!q.check(answers, i);
        else ok = defaultQCheck(q, answers, i); 
        if (ok) correct++;
        results.push(ok);
        correctAnswers.push(Array.isArray(q.answer) ? q.answer.join('、') : String(q.answer));
      });
      var total = set.questions.length;
      var score = total ? Math.round(correct / total * 100) : 0;
      var message = score === 100 ? '太棒了！全对！' : score >= 80 ? '很不错！' : '继续加油！';
      return { score: score, total: total, correct: correct, message: message, results: results, correctAnswers: correctAnswers };
    }

    function defaultGenerate(options) {
      var opts = options || {};
      
      if (opts.count != null && (!(opts.count > 0) || Math.floor(opts.count) !== opts.count)) {
        console.warn('[createPlugin:' + id + '] 参数 count 应为正整数，收到：' + opts.count);
      }
      var questions = [];
      try {
        questions = config.generateQuestions.call(plugin, opts) || [];
      } catch (e) {
        console.error('[createPlugin:' + id + '] generateQuestions 执行出错：', e);
        throw new Error('题型「' + name + '」生成题目时出错：' + (e && e.message ? e.message : e));
      }
      
      questions = questions.map(function (q, i) {
        if (q && typeof q.render !== 'function' && q.answer != null) {
          q.render = function (idx) { return renderCard(q, idx); };
        }
        if (q && typeof q.check !== 'function') {
          q.check = function (answers, idx) { return defaultQCheck(q, answers, idx); };
        }
        return q;
      });
      
      
      if (config.knowledgePoints && _kb && subject === 'math' && opts.grade) {
        var entries = _kb.getEntries ? _kb.getEntries('math', opts.grade) : [];
        if (entries.length) {
          var entryById = {};
          entries.forEach(function (e) { entryById[e.id] = true; entryById[e.name] = true; });
          var kpRaw = config.knowledgePoints;
          var kpList = Array.isArray(kpRaw) ? kpRaw : (kpRaw && kpRaw[opts.grade]) || [];
          var missing = kpList.filter(function (kp) { return !entryById[kp]; });
          if (missing.length) {
            console.warn('[createPlugin:' + id + '] 在 ' + opts.grade + ' 年级声明覆盖的知识点未在知识库登记：' +
              missing.join('、') + '（请补充 shared/knowledge-bank.js 或修正 knowledgePoints）');
          }
        }
      }
      
      var meta = (typeof config.meta === 'function') ? config.meta(opts)
        : (config.meta || { grade: opts.grade, count: questions.length });
      return { questions: questions, meta: meta };
    }

    
    var RESERVED = { id: 1, name: 1, subject: 1, grades: 1, category: 1, description: 1,
      generateQuestions: 1, render: 1, check: 1, knowledgePoints: 1, columns: 1, meta: 1 };
    var plugin = {};
    Object.keys(config).forEach(function (k) { if (!RESERVED[k]) plugin[k] = config[k]; });
    plugin.id = id;
    plugin.name = name;
    plugin.subject = subject;
    plugin.grades = grades;
    if (config.category) plugin.category = config.category;
    if (config.description) plugin.description = config.description;
    if (config.printConfig) plugin.printConfig = config.printConfig;
    if (config.settings) plugin.settings = config.settings;
    plugin.generate = config.generate ? config.generate : defaultGenerate;
    plugin.render = config.render ? config.render : defaultRender;
    plugin.check = config.check ? config.check : defaultCheck;
    
    
    if (config.knowledgePoints) plugin.declaredKnowledgePoints = config.knowledgePoints;

    return plugin;
  }

  

  
  function _wrapDifficultyParams(plugin, subject) {
    var _orig = plugin.generate;
    plugin.generate = function (opts) {
      opts = opts || {};
      if (opts.difficultyParams == null) {
        var _D = (typeof global !== 'undefined') ? (global.App && global.App.Difficulty) : null;
        var _DS = (typeof global !== 'undefined') ? (global.App && global.App.DifficultyStatic) : null;
        var hasOwnLevel = opts.level != null && opts.level !== '';

        if (opts.knowledgePointMeta && _DS && typeof _DS.paramsForKnowledgePoint === 'function') {
          
          var staticOut = _DS.paramsForKnowledgePoint(opts.knowledgePointMeta, opts.questionType, opts.customParams);
          if (hasOwnLevel) {
            
            var lv = opts.level;
            var prof = (_D && typeof _D.paramsFor === 'function')
              ? _D.paramsFor(subject, lv) : { level: lv, difficulty: lv };
            prof.staticMeta = staticOut.staticMeta;
            opts.difficultyParams = prof;
          } else {
            opts.difficultyParams = staticOut;
          }
        } else if (_D && typeof _D.paramsFor === 'function') {
          
          var lv2 = (opts.difficulty != null) ? opts.difficulty : (opts.level || 3);
          try { opts.difficultyParams = _D.paramsFor(subject, lv2); } catch (e) {  }
        }
        opts.hasOwnLevel = hasOwnLevel;
      }
      return _orig.call(plugin, opts);
    };
  }

  
  function _wrapGridClass(plugin) {
    if (!plugin.gridClass) return;
    var _orig = plugin.render;
    plugin.render = function (set) {
      var html = _orig.call(plugin, set);
      if (html.indexOf(plugin.gridClass) === -1) {
        html = html.replace('class="questions-grid"', 'class="questions-grid ' + plugin.gridClass + '"');
      }
      return html;
    };
  }

  
  function _numEq(a, b) {
    var na = Number(normalizeAns(a));
    var nb = Number(normalizeAns(b));
    if (!isNaN(na) && !isNaN(nb)) return na === nb;
    return normalizeAns(a) === normalizeAns(b);
  }

  
  function _mathQCheck(q, answers, i) {
    if (q.inputType === 'multi') {
      var parts = Array.isArray(q.answer) ? q.answer : String(q.answer).split(/[、,，]/);
      for (var j = 0; j < parts.length; j++) {
        var uv = answers ? answers[i + ':' + j] : undefined;
        if (!_numEq(uv, parts[j])) return false;
      }
      return true;
    }
    var ua = answers ? answers[i] : undefined;
    var ans = Array.isArray(q.answer) ? q.answer.join('') : q.answer;
    return _numEq(ua, ans);
  }

  
  function createMathPlugin(config) {
    config = config || {};
    config.subject = 'math';
    var _origGQ = config.generateQuestions;
    if (typeof _origGQ === 'function') {
      config.generateQuestions = function (opts) {
        var qs = _origGQ.call(this, opts) || [];
        qs.forEach(function (q) {
          if (q && typeof q.check !== 'function' && q.answer != null) {
            q.check = function (answers, idx) { return _mathQCheck(q, answers, idx); };
          }
        });
        return qs;
      };
    }
    var plugin = createPlugin(config);
    plugin.cardClass = 'math-card';
    plugin.gridClass = 'math-grid';
    _wrapDifficultyParams(plugin, 'math');
    _wrapGridClass(plugin);
    return plugin;
  }

  
  global.PluginUtil = global.PluginUtil || {};
  global.PluginUtil.renderCard = renderCard;
  global.PluginUtil.renderGrid = renderGrid;
  global.PluginUtil.clockSVG = clockSVG;
  global.PluginUtil.createPlugin = createPlugin;
  global.PluginUtil.createMathPlugin = createMathPlugin;
  global.renderCard = renderCard;       
  global.clockSVG = clockSVG;           

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      renderCard: renderCard, renderGrid: renderGrid, clockSVG: clockSVG,
      createPlugin: createPlugin, createMathPlugin: createMathPlugin,
      _wrapDifficultyParams: _wrapDifficultyParams, _wrapGridClass: _wrapGridClass,
      _numEq: _numEq, _mathQCheck: _mathQCheck
    };
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/check.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  
  function defaultQCheck(q, answers, i) {
    if (q.inputType === 'multi') {
      var parts = Array.isArray(q.answer) ? q.answer : String(q.answer).split(/[、,，]/);
      for (var j = 0; j < parts.length; j++) {
        var uv = answers ? answers[i + ':' + j] : undefined;
        if (normalizeAns(uv) !== normalizeAns(parts[j])) return false;
      }
      return true;
    }
    var ua = answers ? answers[i] : undefined;
    var ans = Array.isArray(q.answer) ? q.answer.join('') : q.answer;
    return normalizeAns(ua) === normalizeAns(ans);
  }

  
  function computeResult(questions, userAnswers, opts) {
    opts = opts || {};
    var checkFn = opts.checkFn || defaultQCheck;
    var correct = 0, results = [], correctAnswers = [];
    questions.forEach(function (q, i) {
      var ok = checkFn(q, userAnswers, i);
      if (ok) correct++;
      results.push(ok);
      var disp = Array.isArray(q.answer) ? q.answer.join('、') : q.answer;
      correctAnswers.push(q.answerParts ? q.answerParts.join('、') : disp);
    });
    var total = questions.length;
    var score = total ? Math.round(correct / total * 100) : 0;
    var message = score === 100 ? '太棒了！全对！' : score >= 80 ? '很不错！' : '继续加油！';
    return { score: score, total: total, correct: correct, message: message, results: results, correctAnswers: correctAnswers };
  }

  
  function pickOpt(el) {
    var card = el.parentNode && el.parentNode.parentNode;
    if (!card) return;
    var opts = card.querySelectorAll('.opt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.remove('chosen');
      opts[i].setAttribute('aria-checked', 'false');
    }
    el.classList.add('chosen');
    el.setAttribute('aria-checked', 'true');
    var inp = card.querySelector('input[data-index]');
    if (inp) inp.value = el.getAttribute('data-val') || el.textContent;
  }

  
  global.PluginUtil = global.PluginUtil || {};
  global.PluginUtil.defaultQCheck = defaultQCheck;
  global.PluginUtil.computeResult = computeResult;
  global.PluginUtil.pickOpt = pickOpt;
  global.defaultQCheck = defaultQCheck;     
  global.__pickOpt = pickOpt;               

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      defaultQCheck: defaultQCheck, computeResult: computeResult, pickOpt: pickOpt
    };
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/knowledge-ontology.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var Schema = require("shared/schemas/knowledge-point.schema.js");

  var VERSION = Schema.VERSION;
  var SUBJECTS = Schema.SUBJECTS;
  var KNOWN_OPERATIONS = Schema.KNOWN_OPERATIONS;
  var KNOWN_QUESTION_TYPES = Schema.KNOWN_QUESTION_TYPES;
  var KNOWN_CONTEXTS = Schema.KNOWN_CONTEXTS;

  function isPlainObject(x) {
    return x && typeof x === 'object' && !Array.isArray(x);
  }

  function defaultCanonical() {
    return {
      id: '',
      subject: null,
      grade: null,
      category: null,
      module: { id: '', name: '' },
      identity: { id: '', name: '', description: '' },
      source: { pluginId: null, legacyType: null },
      knowledge: { concept: null, operations: [], factualContent: {}, prerequisites: [] },
      structure: { minSteps: 1, maxSteps: 1, allowBracket: false, allowMultDiv: false },
      cognition: { level: 0, targets: [], raw: null },
      presentation: { questionTypes: [], graphicType: null },
      numeric: { range: { min: null, max: null }, integerOnly: true, decimalPlaces: 0 },
      context: { defaults: [], allowPure: true, allowContextual: true },
      errors: [],
      spiral: { level: 1, maxLevel: 1 },
      generation: { capabilities: [] },
      metadata: { weight: 1, version: VERSION },
      legacy: {}
    };
  }

  function create(data) {
    var c = defaultCanonical();
    if (!isPlainObject(data)) return c;
    if (data.id !== undefined) c.id = data.id;
    if (data.subject !== undefined) c.subject = data.subject;
    if (data.grade !== undefined) c.grade = data.grade;
    if (data.category !== undefined) c.category = data.category;
    if (data.module) c.module = Object.assign({}, c.module, data.module);
    if (data.identity) c.identity = Object.assign({}, c.identity, data.identity);
    if (data.source) c.source = Object.assign({}, c.source, data.source);
    if (data.knowledge) c.knowledge = Object.assign({}, c.knowledge, data.knowledge);
    if (data.structure) c.structure = Object.assign({}, c.structure, data.structure);
    if (data.cognition) c.cognition = Object.assign({}, c.cognition, data.cognition);
    if (data.presentation) c.presentation = Object.assign({}, c.presentation, data.presentation);
    if (data.numeric) {
      c.numeric = Object.assign({}, c.numeric, data.numeric);
      if (data.numeric.range) c.numeric.range = Object.assign({}, c.numeric.range);
    }
    if (data.context) c.context = Object.assign({}, c.context, data.context);
    if (data.errors) c.errors = data.errors;
    if (data.spiral) c.spiral = Object.assign({}, c.spiral, data.spiral);
    if (data.generation) c.generation = Object.assign({}, c.generation, data.generation);
    if (data.metadata) c.metadata = Object.assign({}, c.metadata, data.metadata);
    if (data.legacy) c.legacy = Object.assign({}, data.legacy);
    return c;
  }

  function normalize(legacyKP) {
    var Normalizer = require("shared/knowledge-ontology-normalizer.js");
    return Normalizer.fromLegacy(legacyKP);
  }

  function validate(kp) {
    var Validator = require("shared/knowledge-ontology-validator.js");
    return Validator.validate(kp);
  }

  function isValid(kp) {
    var r = validate(kp);
    return !!(r && r.valid);
  }

  var API = {
    VERSION: VERSION,
    SUBJECTS: SUBJECTS,
    KNOWN_OPERATIONS: KNOWN_OPERATIONS,
    KNOWN_QUESTION_TYPES: KNOWN_QUESTION_TYPES,
    KNOWN_CONTEXTS: KNOWN_CONTEXTS,
    defaultCanonical: defaultCanonical,
    create: create,
    normalize: normalize,
    validate: validate,
    isValid: isValid,
    schemaVersion: function () { return VERSION; }
  };

  global.KnowledgeOntology = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/capability-model.js"] = function (module, exports, require) {

'use strict';

var TYPES = require("shared/question-type-registry.js").TYPES;
var Registry = require("shared/question-type-registry.js");

function defaultCapability() {
  return {
    knowledgePointId: '',
    questionTypes: []
  };
}

function isValidCapability(c) {
  if (!c || typeof c !== 'object') return false;
  if (c.knowledgePointId == null) return false;
  if (!Array.isArray(c.questionTypes)) return false;
  return c.questionTypes.every(function (qt) {
    if (!qt || typeof qt.id !== 'string') return false;
    if (!Array.isArray(qt.cognitiveLevels)) return false;
    if (!qt.difficultyRange || qt.difficultyRange.length !== 2) return false;
    if (typeof qt.priority !== 'number') return false;
    return true;
  });
}

function resolveCapability(canonicalKp) {
  
  
  var result = defaultCapability();
  result.knowledgePointId = canonicalKp.id || '';

  var pushQt = function (typeToken, qtMeta) {
    if (!typeToken) return;
    var std = Registry.normalizeQuestionType(typeToken);
    if (!std.id) return;
    var already = result.questionTypes.some(function (q) { return q.id === std.id; });
    if (already) return;
    var qt = Registry.get(std.id);
    result.questionTypes.push({
      id: std.id,
      cognitiveLevels: (qt && qt.cognitiveLevels) || ['understand'],
      difficultyRange: inferDifficultyRange(canonicalKp, std.id),
      priority: 1,
      supported: true
    });
  };

  
  (canonicalKp.presentation && canonicalKp.presentation.questionTypes || []).forEach(function (q) {
    pushQt(q.rawType || q.type);
  });

  
  (canonicalKp.generation && canonicalKp.generation.capabilities || []).forEach(function (cap) {
    if (cap && cap.id && Registry.has(cap.id)) pushQt(cap.id);
  });

  
  return result;
}

function inferDifficultyRange(kp, qtypeId) {
  
  
  var ms = 1;
  if (kp && kp.structure && kp.structure.maxSteps != null) ms = Number(kp.structure.maxSteps);
  if (!isFinite(ms) || ms < 1) ms = 1;
  var range = (kp && kp.numeric && kp.numeric.range) ? kp.numeric.range : null;
  var min = 1, max = 6; 

  if (ms > 1) max = Math.min(6, ms);
  if (range && typeof range === 'object' && isFinite(range.min) && isFinite(range.max)) {
    min = Math.max(1, Math.min(6, range.min));
    max = Math.min(6, Math.max(range.min, range.max));
  }
  var cl = (kp && kp.cognition && kp.cognition.raw) ? kp.cognition.raw : null;
  if (cl == null && kp && kp.legacy && kp.legacy.cognitive_level != null) cl = kp.legacy.cognitive_level;
  if (cl != null) {
    var clNum = null;
    if (typeof cl === 'number') {
      
      clNum = (cl >= 0 && cl <= 1) ? Math.round(cl * 3) + 1 : cl;
    } else {
      var clMap = { '了解': 1, '理解': 2, '掌握': 3, '运用': 4 };
      if (clMap[cl] !== undefined) clNum = clMap[cl];
    }
    if (clNum != null && isFinite(clNum)) {
      if (min > clNum) min = clNum;
      if (max < clNum) max = clNum;
    }
  }
  return [min, max];
}

module.exports = {
  defaultCapability: defaultCapability,
  isValidCapability: isValidCapability,
  resolveCapability: resolveCapability,
  inferDifficultyRange: inferDifficultyRange
};
};
__defs["shared/capability-matrix.js"] = function (module, exports, require) {

'use strict';

var Registry = require("shared/question-type-registry.js");



var CONFLICT_CATEGORIES = {
  geometry: ['geometry'],
  oral: ['calculation'],
  calc: ['calculation'],
  recognize: ['recognition']
};

function decisionFor(capSet, qtId) {
  
  var qt = Registry.get(qtId);
  if (!qt) return 'FORBID'; 

  if (capSet.has(qtId)) return 'ALLOW';

  
  if (capSet.size === 0) return 'MISSING';

  
  var conflictCats = CONFLICT_CATEGORIES[qtId];
  if (conflictCats) {
    var catHasConflict = false;
    capSet.forEach(function (id) {
      var t = Registry.get(id);
      if (t && conflictCats.indexOf(t.category) !== -1) catHasConflict = true;
    });
    if (catHasConflict) return 'FORBID';
  }

  return 'DEGRADE';
}

function buildMatrix(kp, cap) {
  
  if (!cap) {
    var CapabilityModel = require("shared/capability-model.js");
    cap = CapabilityModel.resolveCapability(kp);
  }
  var capSet = new Set(cap.questionTypes.map(function (q) { return q.id; }));

  var questionTypes = {};
  Registry.all().forEach(function (qt) {
    var decision = decisionFor(capSet, qt.id);
    questionTypes[qt.id] = {
      supported: decision === 'ALLOW',
      decision: decision,
      capability: qt.category
    };
  });

  return {
    knowledgePointId: kp.id,
    subject: kp.subject || null,
    grade: kp.grade || null,
    allowed: cap.questionTypes.map(function (q) { return q.id; }),
    questionTypes: questionTypes,
    status: capSet.size === 0 ? 'MISSING' : 'RESOLVED'
  };
}

module.exports = {
  decisionFor: decisionFor,
  buildMatrix: buildMatrix,
  CONFLICT_CATEGORIES: CONFLICT_CATEGORIES
};

};
__defs["shared/learner/error-model.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  
  var ERROR_TYPES = [
    '计算错误',   
    '口诀混淆',   
    '概念混淆',   
    '符号错误',   
    '步骤错误',   
    '审题错误',   
    '单位错误',   
    '格式错误'    
  ];
  var OTHER = 'other';

  var MAX_SEEN_FOR_CONFIDENCE = 10;
  var RECENT_DECAY = 0.5;
  var RECENT_BOOST = 1;

  function isKnownType(t) {
    return typeof t === 'string' && ERROR_TYPES.indexOf(t) !== -1;
  }

  
  function normalizeErrorType(t) {
    if (t === OTHER || t === 'other') return OTHER;
    if (isKnownType(t)) return t;
    return null;
  }

  function defaultPattern(errorType) {
    return {
      errorType: errorType,
      count: 0,
      recentCount: 0,
      lastOccurredAt: null,
      confidence: 0
    };
  }

  
  function normalizePatterns(patterns) {
    var out = {};
    if (patterns == null || typeof patterns !== 'object') return out;
    Object.keys(patterns).forEach(function (k) {
      var tk = normalizeErrorType(k);
      if (!tk) return; 
      var p = patterns[k];
      if (p == null || typeof p !== 'object') { out[tk] = defaultPattern(tk); return; }
      var norm = defaultPattern(tk);
      norm.count = toNonNegInt(p.count);
      norm.recentCount = toNonNegInt(p.recentCount);
      norm.lastOccurredAt = (typeof p.lastOccurredAt === 'number' && isFinite(p.lastOccurredAt)) ? p.lastOccurredAt : null;
      norm.confidence = clamp01(typeof p.confidence === 'number' && isFinite(p.confidence) ? p.confidence : 0);
      out[tk] = norm;
    });
    return out;
  }

  function toNonNegInt(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }
  function clamp01(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }

  
  function recordError(patterns, errorType, timestamp) {
    var t = normalizeErrorType(errorType);
    if (!t) return null;
    patterns = patterns || {};
    var p = patterns[t] ? patterns[t] : defaultPattern(t);
    p.count += 1;
    p.recentCount = (p.recentCount || 0) + RECENT_BOOST;
    p.lastOccurredAt = (typeof timestamp === 'number') ? timestamp : Date.now();
    p.confidence = clamp01(0.3 + 0.6 * Math.min(1, p.count / MAX_SEEN_FOR_CONFIDENCE));
    patterns[t] = p;

    
    Object.keys(patterns).forEach(function (k) {
      if (k === t) return;
      if (patterns[k] && patterns[k].recentCount > 0) {
        patterns[k].recentCount = Math.max(0, patterns[k].recentCount - RECENT_DECAY);
      }
    });
    return p;
  }

  
  function resolveErrorType(source) {
    if (!source || typeof source !== 'object') return null;
    var t = source.errorType;
    if (t == null) return null;
    return normalizeErrorType(t);
  }

  
  function getErrorFocus(patterns, limit) {
    patterns = patterns || {};
    var list = [];
    Object.keys(patterns).forEach(function (k) {
      var p = patterns[k];
      if (!p || p.count <= 0) return;
      list.push(p);
    });
    list.sort(function (a, b) {
      var d = (b.recentCount || 0) - (a.recentCount || 0);
      if (d) return d;
      return (b.count || 0) - (a.count || 0);
    });
    if (typeof limit === 'number' && limit > 0) list = list.slice(0, limit);
    return list.map(function (p) { return {
      errorType: p.errorType,
      count: p.count,
      recentCount: p.recentCount,
      lastOccurredAt: p.lastOccurredAt,
      confidence: p.confidence
    }; });
  }

  var ErrorModel = {
    ERROR_TYPES: ERROR_TYPES,
    OTHER: OTHER,
    normalizeErrorType: normalizeErrorType,
    normalizePatterns: normalizePatterns,
    defaultPattern: defaultPattern,
    recordError: recordError,
    resolveErrorType: resolveErrorType,
    getErrorFocus: getErrorFocus
  };

  global.LearnerErrorModel = ErrorModel;
  if (typeof module !== 'undefined' && module.exports) module.exports = ErrorModel;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
};
__defs["shared/generator/generator-mode.js"] = function (module, exports, require) {
'use strict';


var MODES = ['hybrid', 'native'];
var SCOPES = ['knowledgePoint'];

var globalMode = 'native';
var overrides = { knowledgePoint: {} };

function isValidMode(mode) { return MODES.indexOf(mode) !== -1; }
function isValidScope(scope) { return SCOPES.indexOf(scope) !== -1; }

function setGlobal(mode) {
  if (!isValidMode(mode)) throw new Error('GeneratorMode: 非法 generatorMode="' + mode + '"（合法值: ' + MODES.join('/') + '）');
  globalMode = mode;
  return globalMode;
}

function getGlobal() { return globalMode; }

function override(scope, key, mode) {
  if (!isValidScope(scope)) throw new Error('GeneratorMode: 非法 scope="' + scope + '"（合法值: ' + SCOPES.join('/') + '）');
  if (key == null || key === '') throw new Error('GeneratorMode: ' + scope + ' 覆盖缺少 key');
  if (!isValidMode(mode)) throw new Error('GeneratorMode: 非法 mode="' + mode + '"');
  overrides[scope][String(key)] = mode;
  return mode;
}

function clearOverride(scope, key) {
  if (!isValidScope(scope)) return;
  if (key == null) { overrides[scope] = {}; return; }
  delete overrides[scope][String(key)];
}

function clearAll() {
  globalMode = 'native';
  SCOPES.forEach(function (s) { overrides[s] = {}; });
}

function dump() {
  return { generatorMode: globalMode, knowledgePointOverrides: Object.assign({}, overrides.knowledgePoint) };
}

function resolve(plan) {
  plan = plan || {};
  var primaryKp = (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId)
    ? plan.knowledgePointId
    : ((Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) || null);
  if (primaryKp && overrides.knowledgePoint[primaryKp]) return overrides.knowledgePoint[primaryKp];
  return globalMode;
}

module.exports = {
  MODES: MODES,
  SCOPES: SCOPES,
  setGlobal: setGlobal,
  getGlobal: getGlobal,
  override: override,
  clearOverride: clearOverride,
  clearAll: clearAll,
  dump: dump,
  resolve: resolve
};

};
__defs["shared/generator/generators/index.js"] = function (module, exports, require) {

'use strict';




var ENGINE_VERSION = '2.1.0';

var Arithmetic = require("shared/generator/generators/arithmetic.js");
var Selection = require("shared/generator/generators/selection.js");
var Complex = require("shared/generator/generators/complex.js");
var Shape = require("shared/generator/generators/shape.js");
var Position = require("shared/generator/generators/position.js");
var Money = require("shared/generator/generators/money.js");
var Application = require("shared/generator/generators/application.js");
var Composite = require("shared/generator/generators/composite.js");
var Counting = require("shared/generator/generators/counting.js");
var Reasoning = require("shared/generator/generators/reasoning.js");
var Stats = require("shared/generator/generators/stats.js");
var PictureEquation = require("shared/generator/generators/picture-equation.js");
var C1 = require("shared/generator/generators/c1-number-puzzle.js");
var C2 = require("shared/generator/generators/c2-number-theory.js");
var C5C6 = require("shared/generator/generators/c5-c6-journey-engineering.js");
var C7 = require("shared/generator/generators/c7-clever-calc.js");
var C9 = require("shared/generator/generators/c9-comprehensive.js");

var ALL = [].concat(
  Arithmetic.buildAll(),
  Selection.buildAll(),
  Complex.buildAll(),
  Shape.buildAll(),
  Position.buildAll(),
  Money.buildAll(),
  Application.buildAll(),
  Composite.buildAll(),
  Counting.buildAll(),
  Reasoning.buildAll(),
  Stats.buildAll(),
  PictureEquation.buildAll(),
  C1.buildAll(),
  C2.buildAll(),
  C5C6.buildAll(),
  C7.buildAll(),
  C9.buildAll()
);

var BY_ID = {};
ALL.forEach(function (g) { BY_ID[g.id] = g; });

module.exports = {
  ENGINE_VERSION: ENGINE_VERSION,
  ALL: ALL,
  BY_ID: BY_ID,
  get: function (id) { return BY_ID[id] || null; }
};

};
__defs["shared/schemas/knowledge-point.schema.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var VERSION = 1;

  var SUBJECTS = ['math'];

  
  var QuestionTypeRegistry = (typeof require === 'function')
    ? (function () { try { return require("shared/question-type-registry.js"); } catch (e) { return null; } })()
    : (global.QuestionTypeRegistry || null);

  var KNOWN_OPERATIONS = [
    'add', 'subtract', 'multiply', 'divide',
    'compare', 'order',
    'compose', 'decompose',
    'measure', 'convert',
    'identify', 'classify',
    'read', 'write',
    'calculate', 'reason',
    'represent', 'model'
  ];

  
  
  var KNOWN_QUESTION_TYPES = QuestionTypeRegistry && QuestionTypeRegistry.all
    ? QuestionTypeRegistry.all().map(function (t) { return t.id; })
    : ['calc', 'fill', 'judge', 'choice', 'operate', 'apply', 'open'];

  var KNOWN_CONTEXTS = ['pure', 'simple', 'standard', 'complex'];

  var COGNITIVE_MAP = { '了解': 0, '理解': 0.33, '掌握': 0.67, '运用': 1.0 };
  var COGNITIVE_MIN = 0;
  var COGNITIVE_MAX = 1;

  
  var CAPABILITIES = {
    'single-step': { type: 'procedure' },
    'multi-step': { type: 'procedure' },
    'calculation': { type: 'calculation' },
    'oral': { type: 'question-format' },
    'fill': { type: 'question-format' },
    'choice': { type: 'question-format' },
    'judge': { type: 'question-format' },
    'open': { type: 'question-format' },
    'contextual': { type: 'context' },
    'application': { type: 'context' }
  };

  
  var QUESTION_TYPE_TO_CAPABILITY = {
    calc: 'calculation', operate: 'calculation',
    fill: 'fill', choice: 'choice', judge: 'judge',
    apply: 'contextual', open: 'open'
  };

  var CATEGORIES = {
    identity: { fields: ['id', 'subject', 'grade', 'module', 'name', 'description'] },
    knowledge: { fields: ['concept', 'operations', 'factualContent', 'prerequisites'] },
    difficulty: { fields: ['spiralLevel', 'maxSpiralLevel', 'cognitiveLevel', 'numberRangeDefault', 'maxStepsDefault'] },
    assessment: { fields: ['applicableQuestionTypes', 'contextDefault', 'errors'] },
    generation: { fields: ['capabilities'] }
  };

  function isKnownCapability(id) { return CAPABILITIES[id] != null; }
  function isValidCognitiveRaw(v) { return COGNITIVE_MAP[v] != null; }
  
  function isValidQuestionType(t) {
    if (KNOWN_QUESTION_TYPES.indexOf(t) !== -1) return true;
    if (QuestionTypeRegistry && typeof QuestionTypeRegistry.normalizeQuestionType === 'function') {
      var n = QuestionTypeRegistry.normalizeQuestionType(t);
      return n && KNOWN_QUESTION_TYPES.indexOf(n.id) !== -1;
    }
    return false;
  }

  
  function checkLegality(c) {
    var errors = [];
    c = c || {};

    var range = c.numeric && c.numeric.range;
    if (range && typeof range.min === 'number' && typeof range.max === 'number' && range.min > range.max) {
      errors.push('numberRange min > max');
    }

    var st = c.structure || {};
    if (typeof st.maxSteps === 'number' && st.maxSteps < 1) {
      errors.push('maxSteps < 1');
    }

    var sp = c.spiral || {};
    if (typeof sp.level === 'number' && typeof sp.maxLevel === 'number' && sp.level > sp.maxLevel) {
      errors.push('spiralLevel > maxSpiralLevel');
    }

    var cog = c.cognition || {};
    if (typeof cog.level === 'number' && (cog.level < COGNITIVE_MIN || cog.level > COGNITIVE_MAX)) {
      errors.push('cognitiveLevel 超出范围');
    }

    
    

    var gen = c.generation || {};
    if (Array.isArray(gen.capabilities)) {
      gen.capabilities.forEach(function (cap) {
        if (cap && !isKnownCapability(cap.id)) errors.push('未知 capability: ' + (cap && cap.id));
      });
    }

    return { errors: errors, warnings: [] };
  }

  var API = {
    VERSION: VERSION,
    SUBJECTS: SUBJECTS,
    KNOWN_OPERATIONS: KNOWN_OPERATIONS,
    KNOWN_QUESTION_TYPES: KNOWN_QUESTION_TYPES,
    KNOWN_CONTEXTS: KNOWN_CONTEXTS,
    COGNITIVE_MAP: COGNITIVE_MAP,
    COGNITIVE_MIN: COGNITIVE_MIN,
    COGNITIVE_MAX: COGNITIVE_MAX,
    CAPABILITIES: CAPABILITIES,
    QUESTION_TYPE_TO_CAPABILITY: QUESTION_TYPE_TO_CAPABILITY,
    CATEGORIES: CATEGORIES,
    isKnownCapability: isKnownCapability,
    isValidCognitiveRaw: isValidCognitiveRaw,
    isValidQuestionType: isValidQuestionType,
    checkLegality: checkLegality
  };

  global.KnowledgePointSchema = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/knowledge-ontology-normalizer.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var Ontology = require("shared/knowledge-ontology.js");
  var OpsOnt = require("shared/knowledge-operation.js");
  var OpsMap = require("shared/ontology-operation-map.js");
  var FactOnt = require("shared/knowledge-factual.js");
  var FactMap = require("shared/ontology-factual-map.js");
  var ErrOnt = require("shared/knowledge-error.js");
  var ErrMap = require("shared/ontology-error-map.js");
  var CatMap = require("shared/ontology-category-map.js");
  var Schema = require("shared/schemas/knowledge-point.schema.js");
  var MODULE_CATALOG = (function () {
    try { return require("shared/module-catalog.js"); } catch (e) { return null; }
  })();

  var SUBJECTS = Ontology.SUBJECTS;

  var COGNITIVE_MAP = { '了解': 0, '理解': 0.33, '掌握': 0.67, '运用': 1.0 };
  function mapCognitive(v) {
    if (v == null) return 0;
    if (COGNITIVE_MAP[v] != null) return COGNITIVE_MAP[v];
    return 0.67;
  }

  var TYPE_ALIAS = {
    cushi: 'calc',
    
    word: 'apply',
    
    
    
    picture: 'calc',
    matching: 'choice', column: 'fill', comparison: 'judge'
  };
  function canonQuestionType(t) {
    if (!t) return t;
    if (Ontology.KNOWN_QUESTION_TYPES.indexOf(t) !== -1) return t;
    if (TYPE_ALIAS[t]) return TYPE_ALIAS[t];
    return t;
  }

  function moduleName(token) {
    if (!token) return '';
    if (MODULE_CATALOG && MODULE_CATALOG.byId) {
      var m = MODULE_CATALOG.byId(token.toUpperCase()) || MODULE_CATALOG.byId(token);
      if (m) return m.name || token;
    }
    return token;
  }

  function deriveCapabilities(legacyKP, maxSteps) {
    legacyKP = legacyKP || {};
    var capIds = {};
    var out = [];
    function pushCap(id) {
      if (id && Schema.isKnownCapability(id) && !capIds[id]) {
        capIds[id] = 1;
        out.push({ id: id, type: Schema.CAPABILITIES[id].type });
      }
    }
    if (Array.isArray(legacyKP.applicable_question_types)) {
      legacyKP.applicable_question_types.forEach(function (a) {
        if (a && a.type) {
          var cap = Schema.QUESTION_TYPE_TO_CAPABILITY[a.type];
          if (cap) pushCap(cap);
        }
      });
    }
    if (typeof legacyKP.type === 'string') {
      var capT = Schema.QUESTION_TYPE_TO_CAPABILITY[legacyKP.type];
      if (capT) pushCap(capT);
    }
    var ms = Number(maxSteps);
    if (!isFinite(ms) || ms < 1) ms = 1;
    pushCap(ms > 1 ? 'multi-step' : 'single-step');
    return out;
  }

  function fromLegacy(legacyKP) {
    legacyKP = legacyKP || {};
    var c = {};

    c.id = typeof legacyKP.id === 'string' ? legacyKP.id : '';

    var parts = c.id ? c.id.split('-') : [];
    var subject = parts[0] || null;
    var grade = null;
    if (parts[1]) {
      var gm = /^g(\d+)$/.exec(parts[1]);
      if (gm) grade = parseInt(gm[1], 10);
    }
    var moduleId = parts[2] || '';

    c.subject = SUBJECTS.indexOf(subject) !== -1 ? subject : null;
    c.grade = grade;

    
    
    
    c.category = CatMap.categoryForKp(legacyKP);

    c.module = { id: moduleId, name: moduleName(moduleId) };
    c.identity = {
      id: c.id,
      name: typeof legacyKP.name === 'string' ? legacyKP.name : '',
      description: typeof legacyKP.description === 'string' ? legacyKP.description : ''
    };
    c.source = {
      pluginId: legacyKP.pluginId || null,
      legacyType: legacyKP.type || null
    };

    var rawOps = Array.isArray(legacyKP.operations) && legacyKP.operations.length
      ? legacyKP.operations.slice()
      : OpsMap.operationsForPlugin(legacyKP.pluginId);
    var operations = [];
    var seenOp = {};
    rawOps.forEach(function (o) {
      var norm = OpsOnt.normalize(o);
      var canon = norm.canonical || o;
      if (!seenOp[canon]) { seenOp[canon] = 1; operations.push(canon); }
    });
    var factual = (legacyKP.factualContent && typeof legacyKP.factualContent === 'object')
      ? legacyKP.factualContent : FactMap.factualForPlugin(legacyKP.pluginId);
    var concept = (typeof legacyKP.concept === 'string' && legacyKP.concept) ? legacyKP.concept : null;
    var prerequisites = Array.isArray(legacyKP.prerequisites) ? legacyKP.prerequisites.slice() : [];
    c.knowledge = {
      concept: concept,
      operations: operations,
      factualContent: factual,
      prerequisites: prerequisites
    };

    var maxSteps = Number(legacyKP.max_steps_default);
    if (!isFinite(maxSteps) || maxSteps < 1) maxSteps = 1;
    c.structure = {
      minSteps: 1,
      maxSteps: maxSteps,
      allowBracket: !!legacyKP.allowBracket,
      allowMultDiv: !!legacyKP.allowMultDiv
    };

    var cogRaw = legacyKP.cognitive_level != null ? legacyKP.cognitive_level : null;
    c.cognition = { level: mapCognitive(cogRaw), targets: [], raw: cogRaw };

    var qts = [];
    if (Array.isArray(legacyKP.applicable_question_types)) {
      legacyKP.applicable_question_types.forEach(function (a) {
        if (!a || !a.type) return;
        qts.push({
          type: canonQuestionType(a.type),
          weight: Number(a.coefficient) || 1,
          rawType: a.type,
          cognitiveLevels: null,
          difficultyFactor: null
        });
      });
    } else if (typeof legacyKP.type === 'string' && legacyKP.type) {
      qts.push({
        type: canonQuestionType(legacyKP.type),
        weight: 1,
        rawType: legacyKP.type,
        cognitiveLevels: null,
        difficultyFactor: null
      });
    }
    c.presentation = {
      questionTypes: qts,
      graphicType: legacyKP.graphicType != null ? legacyKP.graphicType : null
    };

    var range = { min: null, max: null };
    var nr = legacyKP.number_range_default;
    if (nr && typeof nr === 'object' && (nr.min != null || nr.max != null)) {
      range.min = nr.min != null ? Number(nr.min) : null;
      range.max = nr.max != null ? Number(nr.max) : null;
    } else if (typeof nr === 'number') {
      range.min = 1;
      range.max = nr;
    }
    c.numeric = { range: range, integerOnly: true, decimalPlaces: 0 };

    var ctxDefaults = [];
    var allowPure = true, allowContextual = true;
    var ctx = legacyKP.context_default;
    if (typeof ctx === 'string' && ctx) {
      ctxDefaults.push(ctx);
      if (ctx === 'pure') allowContextual = false;
    }
    c.context = { defaults: ctxDefaults, allowPure: allowPure, allowContextual: allowContextual };

    var errs = [];
    if (Array.isArray(legacyKP.common_errors) && legacyKP.common_errors.length) {
      legacyKP.common_errors.forEach(function (e) {
        if (typeof e === 'string') errs.push(e);
        else if (e && e.id) errs.push(e);
      });
    } else {
      ErrMap.errorsForPlugin(legacyKP.pluginId).forEach(function (e) { errs.push(e); });
    }
    c.errors = errs;

    c.generation = { capabilities: deriveCapabilities(legacyKP, c.structure.maxSteps) };

    var sLevel = Number(legacyKP.spiral_level);
    if (!isFinite(sLevel) || sLevel < 1) sLevel = 1;
    var sMax = Number(legacyKP.max_spiral_level);
    if (!isFinite(sMax) || sMax < sLevel) sMax = sLevel;
    c.spiral = { level: sLevel, maxLevel: sMax };

    c.metadata = {
      weight: Number(legacyKP.weight) || 1,
      version: Ontology.VERSION
    };

    c.legacy = {
      difficulty: legacyKP.difficulty != null ? legacyKP.difficulty : null,
      example: legacyKP.example || null,
      prerequisites: legacyKP.prerequisites || null,
      related: legacyKP.related || null,
      status: legacyKP.status || null,
      category: legacyKP.category || null,
      bankRef: legacyKP.bankRef || null,
      exerciseTypes: legacyKP.exerciseTypes || null,
      cognitive_level: cogRaw,
      context_default: ctx
    };

    return Ontology.create(c);
  }

  var API = { fromLegacy: fromLegacy, mapCognitive: mapCognitive, canonQuestionType: canonQuestionType };

  global.KnowledgeOntologyNormalizer = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/knowledge-ontology-validator.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var Ontology = require("shared/knowledge-ontology.js");
  var Schema = require("shared/schemas/knowledge-point.schema.js");

  var COGNITIVE_MAP = Schema.COGNITIVE_MAP;

  function validate(kp) {
    var errors = [];
    var warnings = [];
    kp = kp || {};

    var name = kp.identity && kp.identity.name;

    if (!kp.id) errors.push('id 缺失');
    if (!name) errors.push('name 缺失');
    if (!kp.subject || Schema.SUBJECTS.indexOf(kp.subject) === -1) errors.push('subject 缺失/非法');

    var grade = kp.grade;
    if (typeof grade !== 'number' || grade < 1 || grade > 6 || grade % 1 !== 0) errors.push('grade 非法');

    var sp = kp.spiral || {};
    if (typeof sp.level !== 'number' || sp.level < 1) errors.push('spiral.level 非法');
    if (typeof sp.maxLevel !== 'number' || sp.maxLevel < sp.level) errors.push('spiral.maxLevel < spiral.level');

    var st = kp.structure || {};
    if (typeof st.maxSteps === 'number' && typeof st.minSteps === 'number' && st.maxSteps < st.minSteps) {
      errors.push('structure.maxSteps < minSteps');
    }

    var pres = kp.presentation || {};
    if (!Array.isArray(pres.questionTypes)) errors.push('questionTypes 非数组');

    var cog = kp.cognition || {};
    if (typeof cog.level !== 'number' || isNaN(cog.level)) errors.push('cognition.level 非法');

    
    var legal = Schema.checkLegality(kp);
    legal.errors.forEach(function (e) { errors.push(e); });

    if (!(kp.identity && kp.identity.description)) warnings.push('description 缺失');

    var sem = kp.knowledge || {};
    if (!sem.factualContent || Object.keys(sem.factualContent).length === 0) warnings.push('factualContent 为空');
    if (!sem.operations || sem.operations.length === 0) warnings.push('operations 为空');
    if (Array.isArray(sem.operations)) {
      sem.operations.forEach(function (o) {
        if (Schema.KNOWN_OPERATIONS.indexOf(o) === -1) warnings.push('未知 operation: ' + o);
      });
    }
    if (sem.concept == null) warnings.push('concept 缺失');
    if (!Array.isArray(sem.prerequisites) || sem.prerequisites.length === 0) warnings.push('prerequisites 为空');

    var ctx = kp.context || {};
    if (!ctx.defaults || ctx.defaults.length === 0) warnings.push('context 为空');

    if (!kp.errors || kp.errors.length === 0) warnings.push('errors 为空');

    if (!(pres && pres.graphicType)) warnings.push('graphicType 缺失');

    if (Array.isArray(pres.questionTypes)) {
      pres.questionTypes.forEach(function (q) {
        if (q && Schema.KNOWN_QUESTION_TYPES.indexOf(q.type) === -1) warnings.push('未知 questionType: ' + q.type);
      });
    }

    var gen = kp.generation || {};
    var caps = Array.isArray(gen.capabilities) ? gen.capabilities : [];
    if (caps.length === 0) warnings.push('generation.capabilities 为空');

    if (cog.raw != null && typeof cog.raw === 'string' && !COGNITIVE_MAP[cog.raw]) {
      warnings.push('未知 cognitive_level: ' + cog.raw);
    }

    var valid = errors.length === 0;
    return { valid: valid, errors: errors, warnings: warnings, normalized: true };
  }

  var API = { validate: validate };

  global.KnowledgeOntologyValidator = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/generator/generators/arithmetic.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");
var Arith = require("shared/generator/core/arithmetic-core.js");


function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

var FAMILY = {
  addition: { op: 'add' },
  subtraction: { op: 'sub' },
  multiplication: { op: 'mult' },
  division: { op: 'div' },
  'mixed-calculation': { op: 'mixed' }
};

function createArithmeticGenerator(spec) {
  spec = spec || {};
  var op = spec.operation || 'add';
  var id = spec.id || 'generator:arithmetic-' + op;
  var subject = spec.subject || 'math';

  function seedFor(plan, context, i) {
    if (context && context.seed != null) return context.seed + ':' + i;
    
    
    if (plan && plan.seed != null) return plan.seed + ':' + i;
    return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
  }

  
  
  function planOperationSet(plan) {
    return (plan.operationSet || (Array.isArray(plan.operation) ? plan.operation : null));
  }
  function planOperationStr(plan) {
    return (typeof plan.operation === 'string'
      ? plan.operation
      : (plan.operationStr || null));
  }

  return {
    id: id,
    subject: subject,
    capabilities: ['oral', 'calc', 'fill', 'apply'],
    questionTypes: ['oral', 'calc', 'fill', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return plan.questionTypeId === 'oral' || plan.questionTypeId === 'calc';
    },

    generate: function (plan, context) {
      context = context || {};
      var constraints = plan.constraints || {};
      var count = plan.count || 1;
      var questions = [];

      for (var i = 0; i < count; i++) {
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        var opSet = context.operationSet || planOperationSet(plan);
        var kind = constraints.kind ||
          ((plan.constraints && plan.constraints.kind) || (plan.kind || null));
        var structure = Arith.buildSpecialKind(rng, { kind: kind, numberRange: constraints.numberRange });
        if (!structure) {
          structure = Arith.generateStructure(rng, {
            operation: context.operation || planOperationStr(plan) || ((opSet && opSet.filter(function (o) { return o === '+' || o === '−'; }).length === opSet.length) ? 'add' : op),
            operationSet: opSet,
            exactSteps: constraints.exactSteps,
            numberRange: constraints.numberRange,
            maxSteps: constraints.exactSteps != null ? constraints.exactSteps : constraints.maxSteps,
            allowBracket: constraints.allowBracket,
            allowMultDiv: constraints.allowMultDiv,
            noNegative: true
          });
        }
        var answer = structure.answer != null ? structure.answer : Arith.calculateAnswer(structure.operands, structure.operators);
        var prompt = Arith.formatExpression(structure.operands, structure.operators) + ' = ?';

        questions.push({
          knowledgePointId: pkp(plan),
          questionType: plan.questionTypeId,
          difficulty: plan.difficulty,
          difficultyParams: {
            level: plan.difficulty,
            scale: constraints.scale != null ? constraints.scale : 1,
            steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
            allowBracket: !!constraints.allowBracket,
            allowMultDiv: !!constraints.allowMultDiv
          },
          numberRange: constraints.numberRange || { min: 1, max: 20 },
          spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
          context: plan.contextType != null ? plan.contextType : 'standard',
          seed: seedFor(plan, context, i),
          prompt: prompt,
          
          answer: { value: String(answer), acceptable: [], explanation: prompt.replace(' = ?', ' = ' + answer) },
          answerMode: 'input',
          hint: null,
          data: {
            
            
            
            
            operation: Arith.normalizeOperation(context.operation || planOperationStr(plan) || op),
            steps: structure.steps
          }
        });
      }
      return questions;
    }
  };
}

function buildAll() {
  var out = [];
  Object.keys(FAMILY).forEach(function (name) {
    out.push(createArithmeticGenerator({ id: 'generator:arithmetic-' + name, operation: FAMILY[name].op }));
  });
  return out;
}

module.exports = {
  FAMILY: FAMILY,
  createArithmeticGenerator: createArithmeticGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/selection.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");
var Arith = require("shared/generator/core/arithmetic-core.js");


function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function createSelectionGenerator(spec) {
  spec = spec || {};
  var mode = spec.mode || 'fill'; 
  var id = spec.id || 'generator:selection-' + mode;
  var subject = spec.subject || 'math';

  function seedFor(plan, context, i) {
    if (context && context.seed != null) return context.seed + ':' + i;
    
    
    if (plan && plan.seed != null) return plan.seed + ':' + i;
    return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
  }

  function baseArithmetic(plan, context, i) {
    var constraints = plan.constraints || {};
    var rng = Rng.createSeededRandom(seedFor(plan, context, i));
    var structure = Arith.generateStructure(rng, {
      operation: context.operation || plan.operation || 'mixed',
      numberRange: constraints.numberRange,
      maxSteps: constraints.maxSteps,
      allowBracket: constraints.allowBracket,
      allowMultDiv: constraints.allowMultDiv,
      noNegative: true
    });
    var answer = Arith.calculateAnswer(structure.operands, structure.operators);
    return { rng: rng, structure: structure, answer: answer, constraints: constraints };
  }

  function buildBase(plan, context, i, extra) {
    var constraints = plan.constraints || {};
    return {
      knowledgePointId: pkp(plan),
      questionType: plan.questionTypeId,
      difficulty: plan.difficulty,
      difficultyParams: {
        level: plan.difficulty,
        scale: constraints.scale != null ? constraints.scale : 1,
        steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
        allowBracket: !!constraints.allowBracket,
        allowMultDiv: !!constraints.allowMultDiv
      },
      numberRange: constraints.numberRange || { min: 1, max: 20 },
      spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
      context: plan.contextType != null ? plan.contextType : 'standard',
      seed: seedFor(plan, context, i),
      hint: null,
      answerMode: 'input',
      data: extra || {}
    };
  }

  function makeQuestion(plan, context, i) {
    var base = baseArithmetic(plan, context, i);
    var expr = Arith.formatExpression(base.structure.operands, base.structure.operators);

    if (mode === 'fill') {
      var qFill = buildBase(plan, context, i, { mode: 'fill', steps: base.structure.steps });
      qFill.prompt = expr + ' = ____';
      qFill.answer = { value: String(base.answer), acceptable: [] };
      return qFill;
    }

    if (mode === 'choice') {
      var distractors = Arith.generateDistractors(base.rng, base.answer, 3, base.constraints.numberRange);
      if (distractors.length < 2) {
        
        distractors = Arith.generateDistractors(base.rng, base.answer, 3, null);
      }
      var options = Rng.shuffle(base.rng, distractors.concat([base.answer]).map(String));
      var qChoice = buildBase(plan, context, i, { mode: 'choice', steps: base.structure.steps });
      qChoice.prompt = expr + ' = ?';
      qChoice.answer = { value: String(base.answer), acceptable: [] };
      qChoice.data.options = options;
      qChoice.data.correctIndex = options.indexOf(String(base.answer));
      return qChoice;
    }

    
    var isTrue = base.rng() < 0.5;
    var shown = isTrue
      ? base.answer
      : base.answer + Rng.pick(base.rng, [-1, 1]) * Rng.randInt(base.rng, 1, 2);
    var qJudge = buildBase(plan, context, i, { mode: 'judge', steps: base.structure.steps, shownResult: String(shown) });
    qJudge.prompt = expr + ' = ' + shown + '（对还是错？）';
    qJudge.answer = { value: isTrue, acceptable: [] };
    return qJudge;
  }

  var generator = {
    id: id,
    subject: subject,
    capabilities: mode === 'fill' ? ['fill', 'recognize', 'calc', 'oral', 'apply'] : (mode === 'choice' ? ['choice', 'recognize', 'calc', 'oral', 'apply'] : ['judge', 'recognize', 'calc', 'oral', 'apply']),
    questionTypes: mode === 'fill' ? ['fill', 'recognize', 'calc', 'oral', 'apply'] : (mode === 'choice' ? ['choice', 'recognize', 'calc', 'oral', 'apply'] : ['judge', 'recognize', 'calc', 'oral', 'apply']),knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return generator.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      for (var i = 0; i < count; i++) {
        questions.push(makeQuestion(plan, context, i));
      }
      return questions;
    }
  };
  return generator;
}

function buildAll() {
  return [
    createSelectionGenerator({ id: 'generator:selection-fill', mode: 'fill' }),
    createSelectionGenerator({ id: 'generator:selection-choice', mode: 'choice' }),
    createSelectionGenerator({ id: 'generator:selection-judge', mode: 'judge' })
  ];
}

module.exports = {
  createSelectionGenerator: createSelectionGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/complex.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");
var Arith = require("shared/generator/core/arithmetic-core.js");


function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':complex:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':complex:' + i;
  return (pkp(plan) + '|' + plan.family + '|' + plan.difficulty + '|' + plan.count) + ':complex:' + i;
}

function buildBase(plan, context, i, extra) {
  var constraints = plan.constraints || {};
  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    difficultyParams: {
      level: plan.difficulty,
      scale: constraints.scale != null ? constraints.scale : 1,
      steps: (constraints.structure && constraints.structure.family === 'chain') ? (constraints.exactSteps || 2) : (constraints.maxSteps || 1),
      allowBracket: !!constraints.allowBracket,
      allowMultDiv: !!constraints.allowMultDiv
    },
    spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
    numberRange: constraints.numberRange || { min: 1, max: 20 },
    context: plan.contextType != null ? plan.contextType : 'standard',
    seed: seedFor(plan, context, i),
    hint: null,
    answerMode: 'input',
    family: (constraints.structure && constraints.structure.family) || 'chain',
    data: extra || {}
  };
}


function buildMultDivChain(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 20 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));
  var maxForMult = Math.min(max, 9);

  var guard = 0;
  while (guard++ < 200) {
    var op1 = Rng.pick(rng, [Arith.OP_MUL, Arith.OP_DIV]);
    var op2 = Rng.pick(rng, [Arith.OP_MUL, Arith.OP_DIV]);
    var a, b, c;
    if (op1 === Arith.OP_DIV) {
      
      b = Rng.randInt(rng, 2, maxForMult);
      var q = Rng.randInt(rng, 2, maxForMult);
      a = b * q;
      if (a > max) continue;
      if (op2 === Arith.OP_MUL) {
        c = Rng.randInt(rng, 2, maxForMult);
        return { operands: [a, b, c], operators: [op1, op2], steps: 2 };
      }
      
      c = Rng.randInt(rng, 2, maxForMult);
      if (q % c !== 0) continue;
      return { operands: [a, b, c], operators: [op1, op2], steps: 2 };
    } else {
      
      a = Rng.randInt(rng, 2, maxForMult);
      b = Rng.randInt(rng, 2, maxForMult);
      var prod = a * b;
      if (op2 === Arith.OP_DIV) {
        if (prod > max) continue;
        c = Rng.randInt(rng, 2, maxForMult);
        if (prod % c !== 0) continue;
        return { operands: [a, b, c], operators: [op1, op2], steps: 2 };
      }
      
      c = Rng.randInt(rng, 2, maxForMult);
      if (a * b * c > max) continue;
      return { operands: [a, b, c], operators: [op1, op2], steps: 2 };
    }
  }
  return { operands: [6, 3, 2], operators: [Arith.OP_DIV, Arith.OP_MUL], steps: 2 };
}

function makeChain(plan, context, i) {
  var constraints = plan.constraints || {};
  var structure = constraints.structure || {};
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var operators = constraints.operation || [Arith.OP_ADD, Arith.OP_SUB];

  
  var onlyMultDiv = operators.length > 0 &&
    operators.every(function (o) { return o === Arith.OP_MUL || o === Arith.OP_DIV; });

  var gen;
  if (onlyMultDiv) {
    gen = buildMultDivChain(rng, { numberRange: constraints.numberRange });
  } else {
    gen = Arith.generateStructure(rng, {
      operation: 'mixed',
      numberRange: constraints.numberRange,
      maxSteps: constraints.maxSteps || 2,
      allowBracket: false,
      allowMultDiv: (structure.family === 'no-bracket' || structure.family === 'chain'),
      exactSteps: constraints.exactSteps || 2,
      operationSet: operators,
      noNegative: true
    });
  }
  var answer = Arith.calculateAnswer(gen.operands, gen.operators);
  var q = buildBase(plan, context, i, { steps: gen.steps, mode: 'chain' });
  q.prompt = Arith.formatExpression(gen.operands, gen.operators) + ' =';
  q.answer = { value: String(answer), acceptable: [] };
  q.data.operands = gen.operands;
  q.data.operators = gen.operators;
  return q;
}

function makeBracket(plan, context, i) {
  var constraints = plan.constraints || {};
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = Arith.buildBracket(rng, {
    numberRange: constraints.numberRange,
    noNegative: true
  });
  var q = buildBase(plan, context, i, { mode: 'bracket' });
  q.prompt = Arith.formatBracketExpression(s.operands, s.operators) + ' =';
  q.answer = { value: String(s.answer), acceptable: [] };
  q.data.operands = s.operands;
  q.data.operators = s.operators;
  return q;
}

function makeInverse(plan, context, i) {
  var constraints = plan.constraints || {};
  var structure = constraints.structure || {};
  var mode = (structure.inverse && structure.inverse.mode) || 'fill-operand';
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var operators = constraints.operation || [Arith.OP_ADD, Arith.OP_SUB];

  if (mode === 'fill-operator') {
    var fo = Arith.buildFillOperator(rng, { numberRange: constraints.numberRange, operators: operators });
    var q = buildBase(plan, context, i, { mode: 'fill-operator' });
    q.prompt = fo.prompt;
    q.answer = { value: fo.answer, acceptable: [] };
    q.data.operands = fo.operands;
    return q;
  }

  var f = Arith.buildFillOperand(rng, { numberRange: constraints.numberRange, operators: operators });
  var q2 = buildBase(plan, context, i, { mode: 'fill-operand' });
  q2.prompt = f.prompt;
  q2.answer = { value: String(f.unknown), acceptable: [] };
  q2.data.position = f.position;
  q2.data.operator = f.operator;
  return q2;
}

function createComplexGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:complex';
  var subject = spec.subject || 'math';
  var knowledgePoints = spec.knowledgePoints || [];

  var generator = {
    id: id,
    subject: subject,
    capabilities: spec.capabilities || ['calc', 'fill', 'oral'],
    questionTypes: spec.questionTypes || ['calc', 'fill', 'oral'],
    knowledgePoints: knowledgePoints,

    supports: function (plan) {
      if (!plan || !plan.constraints || !plan.constraints.structure) return false;
      
      return knowledgePoints.indexOf(pkp(plan)) !== -1;
    },

    generate: function (plan, context) {
      var family = (plan.constraints && plan.constraints.structure && plan.constraints.structure.family) || 'chain';
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      for (var i = 0; i < count; i++) {
        var q;
        if (family === 'bracket') q = makeBracket(plan, context, i);
        else if (family === 'inverse') q = makeInverse(plan, context, i);
        else q = makeChain(plan, context, i);
        questions.push(q);
      }
      return questions;
    }
  };
  return generator;
}

var COMPLEX_KPS = [
  'math-g1-m1-mixed-chain',
  'math-g2-m1-mixed-addsub',
  'math-g2-m1-mixed-multdiv',
  'math-g2-m3-chain-addsub',
  'math-g2-m3-multdiv-mixed',
  'math-g2-m3-mixed-no-bracket',
  'math-g2-m3-mixed-bracket',
  'math-g1-m4-num-fill-unknown',
  'math-g2-m3-fill-operator',
  
  'math-g2-m2-chain-add-col',
  'math-g2-m2-chain-sub-col',
  'math-g2-m2-mixed-col'
];

function buildAll() {
  return [
    createComplexGenerator({
      id: 'generator:complex-calc',
      capabilities: ['calc', 'fill', 'oral'],
      questionTypes: ['calc', 'fill', 'oral'],
      knowledgePoints: COMPLEX_KPS
    })
  ];
}

module.exports = {
  COMPLEX_KPS: COMPLEX_KPS,
  createComplexGenerator: createComplexGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/shape.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':shape:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':shape:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':shape:' + i;
}


var SHAPE_SUBTYPE = {
  
  'solid': 'cuboid',
  'cube': 'cube',
  'cylinder': 'cylinder',
  'cone': 'cone',
  'sphere': 'sphere',
  
  'flat': 'rectangle',
  'square': 'square',
  'triangle': 'triangle',
  'circle': 'circle',
  'parallelogram': 'parallelogram',
  'trapezoid': 'trapezoid',
  
  'match-shape': 'rectangle',
  'count-graph': 'rectangle',
  'draw-shape': 'rectangle',
  'shape-combine': 'rectangle'
};


var SHAPE_FEATURES = {
  'solid': { name: '立体图形', features: ['有长宽高', '占据空间', '有体积'], examples: ['长方体', '正方体', '圆柱', '圆锥', '球'] },
  'cube': { name: '正方体', features: ['6个面都是正方形', '棱长相等', '12条棱', '8个顶点'], examples: ['魔方', '骰子'] },
  'cylinder': { name: '圆柱', features: ['2个圆形底面', '1个侧面', '侧面展开是长方形'], examples: ['铅笔', '水桶'] },
  'cone': { name: '圆锥', features: ['1个圆形底面', '1个顶点', '侧面展开是扇形'], examples: ['路锥', '帽子'] },
  'sphere': { name: '球', features: ['没有棱和面', '滚动最快', '任意剖面是圆'], examples: ['皮球', '地球仪'] },
  'flat': { name: '平面图形', features: ['只有长和宽', '没有厚度', '在平面上'], examples: ['长方形', '正方形', '三角形', '圆'] },
  'square': { name: '正方形', features: ['4条边相等', '4个角都是直角', '对角线相等且互相垂直平分'], examples: ['手帕', '棋盘格'] },
  'triangle': { name: '三角形', features: ['3条边', '3个角', '内角和180度'], examples: ['三角尺', '屋顶'] },
  'circle': { name: '圆', features: ['没有直线边', '到圆心距离相等', '周长=2πr'], examples: ['硬币', '时钟面'] },
  'parallelogram': { name: '平行四边形', features: ['对边平行且相等', '对角互补'], examples: ['推拉窗'] },
  'trapezoid': { name: '梯形', features: ['一组对边平行', '腰不等长'], examples: ['裙子', '灯罩'] }
};

function getShapeMeta(kp) {
  var lt = kp.source?.legacyType || kp.legacy?.legacyType;
  var cat = kp.legacy?.category;
  var subtype = SHAPE_SUBTYPE[lt] || 'rectangle';
  var meta = SHAPE_FEATURES[lt] || { name: '图形', features: ['有形状', '可识别'], examples: ['各种图形'] };
  return { legacyType: lt, category: cat, subtype: subtype, meta: meta };
}

function generateGraphicParams(subtype, difficulty, rng) {
  
  var unitPx = 25;
  var unit = 'cm';
  var maxDim = Math.min(12, 3 + difficulty);
  var minDim = Math.max(1, difficulty - 1);

  switch (subtype) {
    case 'square':
    case 'rectangle':
      return {
        type: 'geometry',
        subtype: subtype,
        params: {
          width: Rng.randInt(rng, minDim, maxDim),
          height: subtype === 'square' ? undefined : Rng.randInt(rng, minDim, maxDim),
          size: subtype === 'square' ? Rng.randInt(rng, minDim, maxDim) : undefined,
          labelSides: rng() < 0.7,
          rightAngle: true,
          unit: unit,
          unitPx: unitPx
        }
      };
    case 'triangle':
      var a = Rng.randInt(rng, minDim, maxDim);
      var b = Rng.randInt(rng, minDim, maxDim);
      var c = Rng.randInt(rng, Math.abs(a-b)+1, Math.min(a+b-1, maxDim));
      return {
        type: 'geometry',
        subtype: 'triangle',
        params: {
          p1: [0, 0],
          p2: [a, 0],
          p3: [Rng.randInt(rng, 0, a), Rng.randInt(rng, 1, maxDim)],
          labelSides: rng() < 0.6,
          unit: unit,
          unitPx: unitPx
        }
      };
    case 'cuboid':
    case 'cube':
      var edge = Rng.randInt(rng, 2, maxDim);
      return {
        type: 'geometry',
        subtype: subtype,
        params: {
          length: subtype === 'cube' ? edge : Rng.randInt(rng, minDim, maxDim),
          width: subtype === 'cube' ? edge : Rng.randInt(rng, minDim, maxDim),
          height: subtype === 'cube' ? edge : Rng.randInt(rng, minDim, maxDim),
          edge: subtype === 'cube' ? edge : undefined,
          labelSides: rng() < 0.7,
          unit: unit,
          unitPx: unitPx
        }
      };
    case 'cylinder':
      return {
        type: 'geometry',
        subtype: 'cylinder',
        params: {
          r: Rng.randInt(rng, 1, Math.max(2, Math.floor(maxDim/2))),
          height: Rng.randInt(rng, minDim, maxDim),
          labelSides: rng() < 0.6,
          unit: unit,
          unitPx: unitPx
        }
      };
    case 'cone':
      return {
        type: 'geometry',
        subtype: 'cone',
        params: {
          r: Rng.randInt(rng, 1, Math.max(2, Math.floor(maxDim/2))),
          height: Rng.randInt(rng, minDim, maxDim),
          labelSides: rng() < 0.6,
          unit: unit,
          unitPx: unitPx
        }
      };
    default:
      
      return {
        type: 'geometry',
        subtype: 'rectangle',
        params: {
          width: Rng.randInt(rng, minDim, maxDim),
          height: Rng.randInt(rng, minDim, maxDim),
          labelSides: true,
          rightAngle: true,
          unit: unit,
          unitPx: unitPx
        }
      };
  }
}

function makeRecognitionQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var feature = Rng.pick(rng, shapeMeta.meta.features);
  var examples = shapeMeta.meta.examples;
  var prompt = '下列哪个是' + shapeMeta.meta.name + '的特征？';
  var correct = feature;
  var distractors = examples.filter(function(e){ return e !== feature; }).slice(0, 3);
  if (distractors.length < 3) {
    distractors = distractors.concat(['无棱无面', '只有长宽', '不能滚动', '面是圆形'].filter(function(d){ return distractors.indexOf(d) === -1 && d !== feature; }));
  }
  var options = Rng.shuffle(rng, [correct].concat(distractors).slice(0, 4));
  var correctIndex = options.indexOf(correct);

  return {
    knowledgePointId: pkp(plan),
    questionType: 'choice',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(correctIndex), acceptable: [] },
    answerMode: 'choice',
    data: {
      mode: 'choice',
      steps: 1,
      graphic: graphic,
      options: options,
      correctIndex: correctIndex,
      feature: feature,
      shapeName: shapeMeta.meta.name
    }
  };
}

function makeClassificationQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var allShapes = Object.keys(SHAPE_FEATURES);
  var target = shapeMeta.legacyType;
  var prompt = '下列哪个图形属于' + shapeMeta.meta.name + '？';
  var correct = target;
  var distractors = allShapes.filter(function(s){ return s !== target; }).slice(0, 3);
  if (distractors.length < 3) distractors = distractors.concat(['sphere', 'cone', 'cylinder'].filter(function(d){ return distractors.indexOf(d) === -1 && d !== target; }));
  var options = Rng.shuffle(rng, [correct].concat(distractors).slice(0, 4));
  var correctIndex = options.indexOf(correct);

  return {
    knowledgePointId: pkp(plan),
    questionType: 'choice',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(correctIndex), acceptable: [] },
    answerMode: 'choice',
    data: {
      mode: 'choice',
      steps: 1,
      graphic: graphic,
      options: options,
      correctIndex: correctIndex,
      targetShape: target,
      shapeName: shapeMeta.meta.name
    }
  };
}

function makeFeatureQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var isTrue = rng() < 0.5;
  var feature = Rng.pick(rng, shapeMeta.meta.features);
  var shown = isTrue ? feature : (Rng.pick(rng, ['无棱无面', '只有长和宽', '不能滚动', '面是圆形', '有棱有角']) || feature);
  var prompt = shapeMeta.meta.name + '的特征是：「' + shown + '」—— 对还是错？';

  return {
    knowledgePointId: pkp(plan),
    questionType: 'judge',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: isTrue, acceptable: [] },
    answerMode: 'judge',
    data: {
      mode: 'judge',
      steps: 1,
      graphic: graphic,
      shownFeature: shown,
      shapeName: shapeMeta.meta.name
    }
  };
}

function makeNamingQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var prompt = '请写出该图形的名称：';
  var answer = shapeMeta.meta.name; var answerObj = { value: answer, acceptable: [] };

  return {
    knowledgePointId: pkp(plan),
    questionType: 'fill',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: answerObj,
    answerMode: 'input',
    data: {
      mode: 'fill',
      steps: 1,
      graphic: graphic,
      targetName: shapeMeta.meta.name,
      shapeName: shapeMeta.meta.name
    }
  };
}

function makeCountQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var count = Rng.randInt(rng, 3, 6);
  var prompt = '图中共有几个' + shapeMeta.meta.name + '？';
  var answer = String(count); var answerObj = { value: answer, acceptable: [] };

  return {
    knowledgePointId: pkp(plan),
    questionType: 'fill',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: answerObj,
    answerMode: 'input',
    data: {
      mode: 'fill',
      steps: 1,
      graphic: graphic,
      targetCount: count,
      shapeName: shapeMeta.meta.name
    }
  };
}

function makeGeometryQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  
  
  var kp = KP.get(pkp(plan)) || {};
  var name = kp.name || '几何图形';
  var angleWords = ['角', '直角', '锐角', '钝角', '平角', '周角'];
  var isAngle = angleWords.some(function(w){ return name.indexOf(w) !== -1; });
  var prompt;
  var answer;
  var answerMode;

  if (isAngle) {
    
    var angleType = rng() < 0.33 ? '直角' : (rng() < 0.5 ? '锐角' : '钝角');
    prompt = '图中显示的是什么角？';
    answer = { value: angleType, acceptable: ['90度', '90°'] };
    answerMode = 'input';
  } else {
    
    prompt = '请观察图形，' + name;
    answer = { value: shapeMeta.meta.name, acceptable: [] };
    answerMode = 'input';
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: 'geometry',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: answer,
    answerMode: answerMode,
    data: {
      mode: 'geometry',
      steps: 1,
      graphic: graphic,
      shapeName: shapeMeta.meta.name
    }
  };
}

function makeRecognizeQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  
  var kp = KP.get(pkp(plan)) || {};
  var name = kp.name || '图形识别';
  var isChoice = rng() < 0.5;

  if (isChoice) {
    
    var target = shapeMeta.legacyType;
    var correct = shapeMeta.meta.name;
    var allShapes = Object.keys(SHAPE_FEATURES);
    var distractors = allShapes.filter(function(s){ return s !== target; }).slice(0, 3);
    var options = [correct];
    for (var d = 0; d < distractors.length; d++) {
      options.push(SHAPE_FEATURES[distractors[d]]?.name || distractors[d]);
    }
    options = Rng.shuffle(rng, options).slice(0, 4);
    var correctIndex = options.indexOf(correct);
    return {
      knowledgePointId: pkp(plan),
      questionType: 'recognize',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: name + '：下列哪个图形符合描述？',
      answer: { value: String(correctIndex), acceptable: [] },
      answerMode: 'choice',
      data: {
        mode: 'recognize',
        steps: 1,
        graphic: graphic,
        options: options,
        correctIndex: correctIndex,
        shapeName: shapeMeta.meta.name
      }
    };
  } else {
    
    var shownIsCorrect = rng() < 0.6;
    var shownShape = shownIsCorrect ? correct : (Rng.pick(rng, ['三角形', '长方形', '正方形', '圆']) || '三角形');
    return {
      knowledgePointId: pkp(plan),
      questionType: 'recognize',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: name + '：这是' + shownShape + '吗？',
      answer: { value: shownIsCorrect, acceptable: [] },
      answerMode: 'judge',
      data: {
        mode: 'recognize',
        steps: 1,
        graphic: graphic,
        expectedShape: shownShape,
        shapeName: shapeMeta.meta.name
      }
    };
  }
}

function makeGeometryApplyQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var kp = KP.get(pkp(plan)) || {};
  var name = kp.name || '几何应用';
  
  var isArea = name.indexOf('面积') !== -1 || name.indexOf('周长') !== -1;
  var isVolume = name.indexOf('圆柱') !== -1 || name.indexOf('圆锥') !== -1 || name.indexOf('体积') !== -1;
  var isCoord = name.indexOf('数对') !== -1 || name.indexOf('坐标') !== -1;
  var isMotion = name.indexOf('旋转') !== -1 || name.indexOf('对称') !== -1;
  var prompt, answer, answerMode;

  if (isArea) {
    var width = Rng.randInt(rng, 4, 15);
    var height = Rng.randInt(rng, 3, 12);
    var area = width * height;
    prompt = '一个长方形，长' + width + '厘米，宽' + height + '厘米，求它的面积。';
    answer = { value: String(area), acceptable: [String(area) + '平方厘米'] };
    answerMode = 'input';
  } else if (isVolume) {
    var r = Rng.randInt(rng, 3, 8);
    var h = Rng.randInt(rng, 5, 15);
    prompt = '一个圆柱，底面半径' + r + '厘米，高' + h + '厘米，求它的体积。（π取3.14）';
    answer = { value: String(Math.round(3.14 * r * r * h)), acceptable: [] };
    answerMode = 'input';
  } else if (isCoord) {
    prompt = name + '：请在方格纸上标出点的位置。';
    answer = { value: '已标注', acceptable: [] };
    answerMode = 'input';
  } else if (isMotion) {
    prompt = name + '：请说明图形变换的三要素。';
    answer = { value: '旋转中心、旋转方向、旋转角度', acceptable: [] };
    answerMode = 'input';
  } else {
    var side = Rng.randInt(rng, 5, 20);
    prompt = name + '：一个图形的边长为' + side + '厘米，请计算相关几何量。';
    answer = { value: String(side * side), acceptable: [] };
    answerMode = 'input';
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: 'apply',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: answer,
    answerMode: answerMode,
    data: {
      mode: 'apply',
      steps: 2,
      graphic: graphic,
      shapeName: shapeMeta.meta.name
    }
  };
}

function createShapeGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:shape';
  var subject = spec.subject || 'math';
  var mode = spec.mode || 'recognition'; 

  return {
    id: id,
    subject: subject,
    capabilities: ['choice', 'judge', 'fill', 'oral', 'geometry', 'recognize', 'apply'],
    questionTypes: ['choice', 'judge', 'fill', 'oral', 'geometry', 'recognize', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));
      var shapeMeta = getShapeMeta(kp);

      for (var i = 0; i < count; i++) {
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        var graphic = generateGraphicParams(shapeMeta.subtype, plan.difficulty, rng);

        var q;
        var qt = plan.questionTypeId;
        if (qt === 'choice') {
          if (rng() < 0.5) q = makeRecognitionQuestion(plan, context, i, shapeMeta, graphic);
          else q = makeClassificationQuestion(plan, context, i, shapeMeta, graphic);
        } else if (qt === 'judge') {
          q = makeFeatureQuestion(plan, context, i, shapeMeta, graphic);
        } else if (qt === 'fill') {
          if (rng() < 0.6) q = makeNamingQuestion(plan, context, i, shapeMeta, graphic);
          else q = makeCountQuestion(plan, context, i, shapeMeta, graphic);
        } else if (qt === 'geometry') {
          q = makeGeometryQuestion(plan, context, i, shapeMeta, graphic);
        } else if (qt === 'recognize') {
          q = makeRecognizeQuestion(plan, context, i, shapeMeta, graphic);
        } else if (qt === 'apply') {
          
          q = makeGeometryApplyQuestion(plan, context, i, shapeMeta, graphic);
        } else {
          q = makeRecognitionQuestion(plan, context, i, shapeMeta, graphic);
        }
        questions.push(q);
      }
      return questions;
    }
  };
}


var SHAPE_KPS = [
  'math-g1-m6-solid-shape',
  'math-g1-m6-flat-shape',
  'math-g1-m6-count-graph',
  'math-g1-m6-shape-combine',
  'math-g1-m6-draw-shape',
  'math-g1-m5-match-shape',
  'math-g2-m5-match-shape',
  'math-g2-m6-solid-shape',
  'math-g2-m6-motion',
  'math-g4-m5-g4-match-shape',
  'math-g4-m6-g4-draw-sym',
  'math-g4-m6-g4-draw-move',
  'math-g4-c4-c4-count',
  'math-g4-c4-c4-solid',
  'math-g5-m4-g5-fill-solid',
  'math-g5-m5-g5-match-areaf',
  'math-g5-m5-g5-match-solid',
  'math-g5-m6-g5-draw-rotate',
  'math-g5-m6-g5-draw-sym',
  'math-g5-m6-g5-draw-coord',
  'math-g5-m8-g5-word-solid',
  'math-g5-m11-g5-judge-solid',
  'math-g5-m12-g5-choice-solid',
  'math-g5-m12-motion',
  'math-g5-c4-solid-geometry',
  'math-g6-m5-g6-match-formula',
  'math-g6-m6-g6-op-rotate-scale',
  'math-g6-m6-g6-op-position',
  'math-g6-m10-g6-reason-number-shape',
  'math-g6-c4-area-basic',
  'math-g6-c4-solid-geometry',
  
  'math-g2-m4-angle-basic',
  'math-g2-m5-match-angle',
  'math-g2-m6-angle-recognize',
  'math-g2-m6-grid-draw',
  'math-g2-m6-draw-line',
  'math-g2-m6-draw-angle',
  'math-g2-m6-clock-draw',
  'math-g2-m6-measure',
  'math-g3-m6-g3-perimeter',
  'math-g3-m6-g3-area',
  'math-g4-m4-g4-fill-line',
  'math-g4-m4-g4-fill-angle',
  'math-g4-m4-g4-fill-quad',
  'math-g4-m4-g4-fill-tri',
  'math-g4-m5-g4-match-angle',
  'math-g4-m6-g4-draw-protractor',
  'math-g4-m6-g4-draw-para',
  'math-g4-m6-g4-draw-grid',
  'math-g4-m6-g4-draw-view',
  'math-g4-m11-g4-judge-angle',
  'math-g4-m11-g4-judge-line',
  'math-g4-m11-g4-judge-tri',
  'math-g4-m12-g4-choice-angle',
  'math-g4-m12-g4-choice-shape',
  'math-g4-c3-c3-geomcount',
  'math-g4-c4-c4-angle',
  'math-g4-c4-c4-transform',
  'math-g5-c4-circle-sector',
  'math-g5-c4-angle-calculation',
  'math-g6-m4-g6-fill-circle',
  'math-g6-m6-g6-op-circle',
  'math-g6-m6-g6-op-symmetry',
  'math-g6-m8-g6-app-circle',
  'math-g6-m11-g6-judge-circle',
  'math-g6-m12-g6-choice-circle',
  'math-g6-c3-geometry-counting',
  'math-g6-c4-circle-sector',
  'math-g6-c4-angle-calculation',
  'math-g6-c4-circle-angle',
  'math-g6-c4-solid-geometry',
  
  'math-g3-m6-g3-position',
  'math-g4-c4-c4-pa',
  'math-g6-c4-solid-rotation',
  
  'math-g5-m4-g5-fill-coord',
  'math-g5-m4-g5-fill-area',
  'math-g5-m4-g5-fill-rotate',
  'math-g5-m6-g5-draw-observe',
  'math-g5-m6-g5-draw-height',
  'math-g5-m6-g5-draw-net',
  'math-g5-m7-g5-pic-area',
  'math-g5-m8-g5-word-area',
  'math-g5-m11-g5-judge-area',
  'math-g5-m11-motion',
  'math-g5-m12-g5-choice-area',
  'math-g5-c4-area-basic',
  'math-g5-c4-equal-area-transform',
  'math-g5-c4-bird-head-model',
  'math-g5-c4-butterfly-model',
  'math-g5-c4-swallow-tail-model',
  'math-g5-c4-half-model',
  'math-g5-c4-painted-cube',
  'math-g5-c4-pythagorean-theorem',
  'math-g5-c4-lattice-area',
  'math-g6-m4-g6-fill-cylinder-cone',
  'math-g6-m8-g6-app-cyl-cone',
  'math-g6-m11-g6-judge-cyl-cone',
  'math-g6-m12-g6-choice-cyl-cone',
  'math-g6-c4-equal-area-transform',
  'math-g6-c4-bird-head-model',
  'math-g6-c4-butterfly-model',
  'math-g6-c4-swallow-tail-model',
  'math-g6-c4-half-model',
  'math-g6-c4-painted-cube',
  'math-g6-c4-pythagorean-theorem',
  'math-g6-c4-lattice-area'
];

function buildAll() {
  return [
    createShapeGenerator({
      id: 'generator:shape-recognition',
      mode: 'recognition',
      knowledgePoints: SHAPE_KPS
    })
  ];
}

module.exports = {
  SHAPE_SUBTYPE: SHAPE_SUBTYPE,
  SHAPE_FEATURES: SHAPE_FEATURES,
  createShapeGenerator: createShapeGenerator,
  buildAll: buildAll
};
};
__defs["shared/generator/generators/position.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':position:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':position:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':position:' + i;
}


var DIRECTIONS = {
  horizontal: ['左边', '右边', '左侧', '右侧'],
  vertical: ['上面', '下面', '上边', '下边'],
  depth: ['前面', '后面', '前边', '后边'],
  relative: ['左边', '右边', '前面', '后面', '上面', '下面']
};

var DIRECTION_PAIRS = [
  ['左边', '右边'],
  ['上面', '下面'],
  ['前面', '后面']
];

var SCENE_OBJECTS = ['小猫', '小狗', '小鸟', '花朵', '树', '房子', '球', '书', '椅子', '桌子', '苹果', '书包'];

function getPositionMeta(kp) {
  var lt = kp.source?.legacyType || kp.legacy?.legacyType;
  var cat = kp.legacy?.category;
  return { legacyType: lt, category: cat };
}

function generateScene(rng, difficulty) {
  
  var gridSize = Math.min(5, 2 + difficulty);
  var objCount = Rng.randInt(rng, 3, Math.min(6, gridSize));
  var objects = [];
  var positions = [];
  
  for (var i = 0; i < objCount; i++) {
    var x = Rng.randInt(rng, 0, gridSize - 1);
    var y = Rng.randInt(rng, 0, gridSize - 1);
    
    var tries = 0;
    while (positions.some(function(p){ return p[0] === x && p[1] === y; }) && tries < 20) {
      x = Rng.randInt(rng, 0, gridSize - 1);
      y = Rng.randInt(rng, 0, gridSize - 1);
      tries++;
    }
    positions.push([x, y]);
    objects.push({
      name: Rng.pick(rng, SCENE_OBJECTS),
      x: x,
      y: y,
      gridSize: gridSize
    });
  }
  return { objects: objects, gridSize: gridSize };
}

function getRelativeDirection(obj1, obj2, perspective) {
  
  var dx = obj2.x - obj1.x;
  var dy = obj2.y - obj1.y;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? (perspective === 'self' ? '右边' : '左边') : (perspective === 'self' ? '左边' : '右边');
  } else {
    return dy > 0 ? (perspective === 'self' ? '下面' : '上面') : (perspective === 'self' ? '上面' : '下面');
  }
}

function makeDirectionQuestion(plan, context, i, scene, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var obj1 = Rng.pick(rng, scene.objects);
  var obj2 = Rng.pick(rng, scene.objects.filter(function(o){ return o !== obj1; }));
  if (!obj2) obj2 = { name: Rng.pick(rng, SCENE_OBJECTS), x: Rng.randInt(rng, 0, 4), y: Rng.randInt(rng, 0, 4) };
  
  var perspective = rng() < 0.5 ? 'self' : 'viewer';
  var correctDir = getRelativeDirection(obj1, obj2, perspective);
  var prompt = obj1.name + '在' + obj2.name + '的' + (perspective === 'self' ? '' : '观察者视角') + correctDir + '吗？';
  
  var isTrue = rng() < 0.5;
  var shownDir = isTrue ? correctDir : Rng.pick(rng, ['左边', '右边', '上面', '下面', '前面', '后面'].filter(function(d){ return d !== correctDir; }));
  var finalPrompt = obj1.name + '在' + obj2.name + '的' + shownDir + '—— 对还是错？';
  
  return {
    knowledgePointId: pkp(plan),
    questionType: 'judge',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: finalPrompt,
    answer: { value: isTrue, acceptable: [] },
    answerMode: 'judge',
    data: {
      mode: 'judge',
      steps: 1,
      scene: scene,
      targetObj: obj1.name,
      refObj: obj2.name,
      direction: shownDir,
      isTrue: isTrue
    }
  };
}

function makeChoiceDirectionQuestion(plan, context, i, scene, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var obj1 = Rng.pick(rng, scene.objects);
  var obj2 = Rng.pick(rng, scene.objects.filter(function(o){ return o !== obj1; }));
  if (!obj2) obj2 = { name: Rng.pick(rng, SCENE_OBJECTS), x: Rng.randInt(rng, 0, 4), y: Rng.randInt(rng, 0, 4) };
  
  var correctDir = getRelativeDirection(obj1, obj2, 'self');
  var distractors = ['左边', '右边', '上面', '下面', '前面', '后面'].filter(function(d){ return d !== correctDir; });
  var options = Rng.shuffle(rng, [correctDir].concat(distractors.slice(0, 3)));
  var correctIndex = options.indexOf(correctDir);
  
  var prompt = obj1.name + '在' + obj2.name + '的哪一边？';
  
  return {
    knowledgePointId: pkp(plan),
    questionType: 'choice',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(correctIndex), acceptable: [] },
    answerMode: 'choice',
    data: {
      mode: 'choice',
      steps: 1,
      scene: scene,
      targetObj: obj1.name,
      refObj: obj2.name,
      options: options,
      correctIndex: correctIndex,
      correctDirection: correctDir
    }
  };
}

function makeFillDirectionQuestion(plan, context, i, scene, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var obj1 = Rng.pick(rng, scene.objects);
  var obj2 = Rng.pick(rng, scene.objects.filter(function(o){ return o !== obj1; }));
  if (!obj2) obj2 = { name: Rng.pick(rng, SCENE_OBJECTS), x: Rng.randInt(rng, 0, 4), y: Rng.randInt(rng, 0, 4) };
  
  var correctDir = getRelativeDirection(obj1, obj2, 'self');
  var prompt = obj1.name + '在' + obj2.name + '的____。';
  
  return {
    knowledgePointId: pkp(plan),
    questionType: 'fill',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: correctDir, acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'fill',
      steps: 1,
      scene: scene,
      targetObj: obj1.name,
      refObj: obj2.name,
      correctDirection: correctDir
    }
  };
}

function makeGraphicForPosition(scene, difficulty) {
  
  
  
  var gridSize = scene.gridSize;
  var unitPx = 40;
  var objects = scene.objects.map(function(o) {
    return {
      name: o.name,
      x: o.x,
      y: o.y,
      gridSize: gridSize
    };
  });
  
  return {
    type: 'geometry',
    subtype: 'position-grid',
    params: {
      gridSize: gridSize,
      unitPx: 35,
      objects: objects,
      showGrid: true,
      gridColor: '#e0e0e0'
    }
  };
}

function createPositionGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:position';
  var subject = spec.subject || 'math';

  return {
    id: id,
    subject: subject,
    capabilities: ['choice', 'judge', 'fill', 'oral'],
    questionTypes: ['choice', 'judge', 'fill', 'oral'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));
      var meta = getPositionMeta(kp);

      for (var i = 0; i < count; i++) {
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        var scene = generateScene(rng, plan.difficulty);
        var graphic = makeGraphicForPosition(scene, plan.difficulty);

        var q;
        var qt = plan.questionTypeId;
        if (qt === 'choice') {
          q = makeChoiceDirectionQuestion(plan, context, i, scene, meta);
          q.data.graphic = graphic;
        } else if (qt === 'judge') {
          q = makeDirectionQuestion(plan, context, i, scene, meta);
          q.data.graphic = graphic;
        } else if (qt === 'fill') {
          q = makeFillDirectionQuestion(plan, context, i, scene, meta);
          q.data.graphic = graphic;
        } else {
          q = makeDirectionQuestion(plan, context, i, scene, meta);
          q.data.graphic = graphic;
        }
        questions.push(q);
      }
      return questions;
    }
  };
}

var POSITION_KPS = [
  'math-g1-m6-position',
  'math-g3-m6-g3-position',
  'math-g5-m6-g5-draw-coord',
  'math-g6-m6-g6-op-position'
];

function buildAll() {
  return [
    createPositionGenerator({
      id: 'generator:position-direction',
      knowledgePoints: POSITION_KPS
    })
  ];
}

module.exports = {
  DIRECTION_PAIRS: DIRECTION_PAIRS,
  createPositionGenerator: createPositionGenerator,
  buildAll: buildAll
};
};
__defs["shared/generator/generators/money.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");
var Arith = require("shared/generator/core/arithmetic-core.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':money:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':money:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':money:' + i;
}


var RMB_DENOMS = [1, 2, 5, 10, 20, 50, 100]; 
var RMB_UNITS = { yuan: 100, jiao: 10, fen: 1 };


var LENGTH_UNITS = [
  { unit: 'cm', base: 1 },
  { unit: 'm', base: 100 },
  { unit: 'km', base: 100000 }
];
var MASS_UNITS = [
  { unit: 'g', base: 1 },
  { unit: 'kg', base: 1000 }
];
var TIME_UNITS = [
  { unit: '秒', base: 1 },
  { unit: '分', base: 60 },
  { unit: '时', base: 3600 }
];

var MEASUREMENT_KINDS = {
  'rmb': { units: ['元', '角', '分'], category: 'money' },
  'length': { units: ['厘米', '米'], category: 'length' },
  'mass': { units: ['克', '千克'], category: 'mass' },
  'time': { units: ['秒', '分', '小时'], category: 'time' },
  'capacity': { units: ['毫升', '升'], category: 'capacity' },
  'area': { units: ['平方厘米', '平方米'], category: 'area' }
};

function getMoneyMeta(kp) {
  
  if (!kp) return { legacyType: null, category: null, kind: 'rmb' };
  var lt = (kp.source && kp.source.legacyType) || (kp.legacy && kp.legacy.legacyType);
  var cat = kp.legacy ? kp.legacy.category : null;
  
  
  var kind = 'rmb';
  if (lt?.includes('length') || cat === 'length') kind = 'length';
  else if (lt?.includes('mass') || cat === 'mass') kind = 'mass';
  else if (lt?.includes('time') || cat === 'time') kind = 'time';
  else if (lt?.includes('area') || cat === 'area') kind = 'area';
  else if (lt?.includes('capacity') || cat === 'capacity') kind = 'capacity';
  
  return { legacyType: lt, category: cat, kind: kind };
}

function randDenom(rng, maxYuan) {
  var maxFen = maxYuan * 100;
  var denoms = RMB_DENOMS.filter(function(d){ return d <= maxFen; });
  return Rng.pick(rng, denoms);
}

function formatRMB(fen) {
  if (fen >= 100 && fen % 100 === 0) return (fen / 100) + '元';
  if (fen >= 10 && fen % 10 === 0) return (fen / 10) + '角';
  return fen + '分';
}

function parseRMB(str) {
  
  var total = 0;
  var yuanMatch = str.match(/(\d+)元/);
  var jiaoMatch = str.match(/(\d+)角/);
  var fenMatch = str.match(/(\d+)分/);
  if (yuanMatch) total += parseInt(yuanMatch[1]) * 100;
  if (jiaoMatch) total += parseInt(jiaoMatch[1]) * 10;
  if (fenMatch) total += parseInt(fenMatch[1]);
  return total || parseInt(str) * 100; 
}

function makeRMBConversionQuestion(plan, context, i, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var maxYuan = Math.min(10, 2 + plan.difficulty);
  var amountFen = randDenom(rng, maxYuan);
  var amountStr = formatRMB(amountFen);
  
  
  var targetUnit = Rng.pick(rng, ['元', '角', '分']);
  var answer, prompt;
  
  if (targetUnit === '元') {
    answer = (amountFen / 100).toFixed(amountFen % 100 === 0 ? 0 : 2).replace(/\.00$/, '');
    prompt = amountStr + ' = ____ 元';
  } else if (targetUnit === '角') {
    answer = String(amountFen / 10);
    prompt = amountStr + ' = ____ 角';
  } else {
    answer = String(amountFen);
    prompt = amountStr + ' = ____ 分';
  }
  
  return {
    knowledgePointId: pkp(plan),
    questionType: 'fill',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: answer, acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'fill',
      steps: 1,
      kind: 'rmb',
      operation: 'conversion',
      originalAmount: amountStr,
      targetUnit: targetUnit
    }
  };
}

function makeRMBCalculationQuestion(plan, context, i, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var maxYuan = Math.min(20, 3 + plan.difficulty);
  var aFen = randDenom(rng, maxYuan);
  var bFen = randDenom(rng, maxYuan);
  
  
  var op = Rng.pick(rng, ['add', 'sub']);
  if (op === 'sub' && aFen < bFen) {
    var tmp = aFen; aFen = bFen; bFen = tmp;
  }
  
  var answerFen = op === 'add' ? aFen + bFen : aFen - bFen;
  var aStr = formatRMB(aFen);
  var bStr = formatRMB(bFen);
  var opChar = op === 'add' ? '+' : '−';
  var prompt = aStr + ' ' + opChar + ' ' + bStr + ' = ____';
  var answer = formatRMB(answerFen);
  
  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: answer, acceptable: [] },
    answerMode: 'input',
    data: {
      mode: plan.questionTypeId === 'choice' ? 'choice' : 'fill',
      steps: 1,
      kind: 'rmb',
      operation: op,
      operands: [aFen, bFen]
    }
  };
}

function makeMeasurementConversionQuestion(plan, context, i, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var kind = meta.kind;
  var unitInfo = (kind === 'length' ? LENGTH_UNITS : kind === 'mass' ? MASS_UNITS : TIME_UNITS)[0];
  
  var baseValue = Rng.randInt(rng, 1, Math.max(5, plan.difficulty * 2));
  var fromUnit = Rng.pick(rng, LENGTH_UNITS.concat(MASS_UNITS, TIME_UNITS).filter(function(u){ return MEASUREMENT_KINDS[kind]?.units?.includes(u.unit); }));
  var toUnit = Rng.pick(rng, LENGTH_UNITS.concat(MASS_UNITS, TIME_UNITS).filter(function(u){ return MEASUREMENT_KINDS[kind]?.units?.includes(u.unit) && u.unit !== fromUnit.unit; }));
  
  if (!fromUnit || !toUnit) {
    
    return makeRMBConversionQuestion(plan, context, i, meta);
  }
  
  var answer = baseValue * fromUnit.base / toUnit.base;
  var prompt = baseValue + fromUnit.unit + ' = ____ ' + toUnit.unit;
  
  return {
    knowledgePointId: pkp(plan),
    questionType: 'fill',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'fill',
      steps: 1,
      kind: kind,
      operation: 'conversion',
      fromUnit: fromUnit.unit,
      toUnit: toUnit.unit
    }
  };
}

function makeWordProblemQuestion(plan, context, i, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var kind = meta.kind;
  
  if (kind === 'rmb') {
    var aFen = randDenom(rng, 20);
    var bFen = randDenom(rng, 20);
    if (aFen < bFen) { var tmp = aFen; aFen = bFen; bFen = tmp; }
    var op = Rng.pick(rng, ['buy', 'change', 'total']);
    var aStr = formatRMB(aFen);
    var bStr = formatRMB(bFen);
    
    if (op === 'buy') {
      var prompt = '小明买了一支笔，花了' + aStr + '，又买了一块橡皮，花了' + bStr + '，一共花了多少钱？';
      var answer = formatRMB(aFen + bFen);
    } else if (op === 'change') {
      var prompt = '小红有' + aStr + '，买文具花了' + bStr + '，还剩多少钱？';
      var answer = formatRMB(aFen - bFen);
    } else {
      var prompt = '一本书' + aStr + '，一本笔记本' + bStr + '，买这两样东西一共需要多少钱？';
      var answer = formatRMB(aFen + bFen);
    }
    return {
      knowledgePointId: pkp(plan),
      questionType: 'apply',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: prompt,
      answer: { value: answer, acceptable: [] },
      answerMode: 'input',
      data: { mode: 'apply', steps: 2, kind: 'rmb', operation: op === 'change' ? 'sub' : 'add' }
    };
  }
  
  
  return makeRMBConversionQuestion(plan, context, i, meta);
}

function makeGraphicForMoney(meta, difficulty) {
  if (meta.kind === 'rmb') {
    return {
      type: 'calculation',
      subtype: 'rmb',
      params: {
        operation: 'money',
        showRMB: true,
        denominations: [1, 5, 10, 20, 50, 100]
      }
    };
  }
  
  return {
    type: 'geometry',
    subtype: 'rectangle',
    params: { width: 8, height: 3, labelSides: false, unit: 'cm', unitPx: 30 }
  };
}

function createMoneyGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:money';
  var subject = spec.subject || 'math';

  return {
    id: id,
    subject: subject,
    capabilities: ['fill', 'choice', 'judge', 'apply', 'calc', 'oral'],
    questionTypes: ['fill', 'choice', 'judge', 'apply', 'calc', 'oral'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));
      var meta = getMoneyMeta(kp);

      for (var i = 0; i < count; i++) {
        var q;
        var qt = plan.questionTypeId;
        
        if (qt === 'fill') {
          if (meta.kind === 'rmb' && rng() < 0.5) q = makeRMBConversionQuestion(plan, context, i, meta);
          else if (meta.kind === 'rmb') q = makeRMBCalculationQuestion(plan, context, i, meta);
          else q = makeMeasurementConversionQuestion(plan, context, i, meta);
        } else if (qt === 'apply') {
          q = makeWordProblemQuestion(plan, context, i, meta);
        } else if (qt === 'choice' || qt === 'judge') {
          q = makeRMBCalculationQuestion(plan, context, i, meta);
        } else {
          q = makeRMBConversionQuestion(plan, context, i, meta);
        }
        
        q.data.graphic = makeGraphicForMoney(meta, plan.difficulty);
        questions.push(q);
      }
      return questions;
    }
  };
}

var RNG_HELPER = null;
function rng() {
  if (!RNG_HELPER) RNG_HELPER = Rng.createSeededRandom('money-seed-' + Date.now());
  return RNG_HELPER();
}

var MONEY_KPS = [
  'math-g1-m4-rmb-unit',
  'math-g1-m4-rmb-calc',
  'math-g1-m5-match-rmb',
  'math-g1-m8-rmb-shopping',
  'math-g2-m4-length-unit',
  'math-g2-m4-mass-unit',
  'math-g2-m4-time-unit',
  'math-g2-m4-fill-length',
  'math-g2-m4-fill-mass',
  'math-g2-m4-fill-time',
  'math-g2-m8-money',
  'math-g3-m4-g3-measure',
  'math-g4-c4-c4-pa'
];

function buildAll() {
  return [
    createMoneyGenerator({
      id: 'generator:money-measurement',
      knowledgePoints: MONEY_KPS
    })
  ];
}

module.exports = {
  RMB_DENOMS: RMB_DENOMS,
  RMB_UNITS: RMB_UNITS,
  MEASUREMENT_KINDS: MEASUREMENT_KINDS,
  createMoneyGenerator: createMoneyGenerator,
  buildAll: buildAll
};
};
__defs["shared/generator/generators/application.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");
var Arith = require("shared/generator/core/arithmetic-core.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':apply:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':apply:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':apply:' + i;
}


var PROBLEM_TEMPLATES = {
  
  'total-from-parts': {
    zh: '已知条件：{a} 和 {b}。\n问题：一共多少？',
    ops: ['add'],
    relation: 'total = part1 + part2'
  },
  
  'part-from-total': {
    zh: '已知条件：一共 {total}，其中 {part1}。\n问题：剩下多少？',
    ops: ['sub'],
    relation: 'part2 = total - part1'
  },
  
  'compare-more': {
    zh: '已知条件：A 有 {a}，B 比 A 多 {diff}。\n问题：B 有多少？',
    ops: ['add'],
    relation: 'B = A + diff'
  },
  'compare-less': {
    zh: '已知条件：A 有 {a}，B 比 A 少 {diff}。\n问题：B 有多少？',
    ops: ['sub'],
    relation: 'B = A - diff'
  },
  
  'multiple': {
    zh: '已知条件：A 有 {a}，B 是 A 的 {n} 倍。\n问题：B 有多少？',
    ops: ['mult'],
    relation: 'B = A × n'
  },
  'divide-multiple': {
    zh: '已知条件：A 有 {a}，B 是 A 的 {n} 分之 1。\n问题：B 有多少？',
    ops: ['div'],
    relation: 'B = A ÷ n'
  },
  
  'grouping': {
    zh: '已知条件：一共 {total}，每组 {per}。\n问题：能分几组？',
    ops: ['div'],
    relation: 'groups = total ÷ per'
  },
  
  'distance': {
    zh: '已知条件：速度 {speed}，时间 {time}。\n问题：路程多少？',
    ops: ['mult'],
    relation: 'distance = speed × time'
  },
  
  'work': {
    zh: '已知条件：效率 {rate}，时间 {time}。\n问题：完成多少？',
    ops: ['mult'],
    relation: 'work = rate × time'
  }
};

var TEMPLATE_KEYS = Object.keys(PROBLEM_TEMPLATES);

function getApplicationMeta(kp) {
  var lt = kp.source?.legacyType || kp.legacy?.legacyType;
  var cat = kp.legacy?.category;
  return { legacyType: lt, category: cat };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickTemplate(rng, difficulty) {
  
  var simpleTemplates = ['total-from-parts', 'part-from-total', 'compare-more', 'compare-less'];
  var complexTemplates = ['multiple', 'divide-multiple', 'grouping', 'distance', 'work'];
  var pool = difficulty >= 4 ? TEMPLATE_KEYS : simpleTemplates;
  return Rng.pick(rng, pool);
}

function generateNumbers(rng, template, difficulty) {
  var maxVal = Math.min(100, 10 + difficulty * 15);
  var minVal = 1;
  
  switch (template) {
    case 'total-from-parts':
      var a = randInt(rng, minVal, maxVal);
      var b = randInt(rng, minVal, maxVal);
      return { a: a, b: b };
    case 'compare-more':
      var a = randInt(rng, minVal + 2, maxVal);
      var diff = randInt(rng, minVal, maxVal - a);
      return { a: a, diff: diff };
    case 'part-from-total':
      var total = randInt(rng, minVal + 2, maxVal);
      var part1 = randInt(rng, minVal, total - 1);
      return { total: total, part1: part1 };
    case 'compare-less':
      var a = randInt(rng, minVal + 2, maxVal);
      var diff = randInt(rng, minVal, a - 1);
      return { a: a, diff: diff };
    case 'multiple':
      var a = randInt(rng, minVal, Math.floor(maxVal / 3));
      var n = randInt(rng, 2, 5);
      return { a: a, n: n };
    case 'divide-multiple':
      var n = randInt(rng, 2, 5);
      var b = randInt(rng, minVal, maxVal);
      var a = b * n;
      return { a: a, n: n };
    case 'grouping':
      var per = randInt(rng, 2, 10);
      var groups = randInt(rng, 2, 10);
      var total = per * groups;
      return { total: total, per: per };
    case 'distance':
      var speed = randInt(rng, 10, 100);
      var time = randInt(rng, 1, 5);
      return { speed: speed, time: time };
    case 'work':
      var rate = randInt(rng, 5, 50);
      var time = randInt(rng, 1, 10);
      return { rate: rate, time: time };
  }
  return { a: randInt(rng, 1, 20), b: randInt(rng, 1, 20) };
}

function computeAnswer(template, nums) {
  switch (template) {
    case 'total-from-parts': return nums.a + nums.b;
    case 'part-from-total': return nums.total - nums.part1;
    case 'compare-more': return nums.a + nums.diff;
    case 'compare-less': return nums.a - nums.diff;
    case 'multiple': return nums.a * nums.n;
    case 'divide-multiple': return nums.a / nums.n;
    case 'grouping': return nums.total / nums.per;
    case 'distance': return nums.speed * nums.time;
    case 'work': return nums.rate * nums.time;
  }
  return nums.a + (nums.b || 0);
}

function formatTemplate(template, nums) {
  var tpl = PROBLEM_TEMPLATES[template];
  var str = tpl.zh;
  
  Object.keys(nums).forEach(function(key) {
    var placeholder = '{' + key + '}';
    var val = nums[key];
    if (typeof val === 'number') {
      str = str.replace(placeholder, String(val));
    } else {
      str = str.replace(placeholder, val);
    }
  });
  return str;
}

function makeApplicationQuestion(plan, context, i, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var template = pickTemplate(rng, plan.difficulty);
  var nums = generateNumbers(rng, template, plan.difficulty);
  var answer = computeAnswer(template, nums);
  var prompt = formatTemplate(template, nums);
  
  
  var distractors = [];
  var ans = answer;
  for (var d = 0; d < 3; d++) {
    var offset = randInt(rng, -5, 5);
    if (offset === 0) offset = 1;
    var dist = ans + offset;
    if (dist > 0 && distractors.indexOf(dist) === -1 && dist !== ans) {
      distractors.push(dist);
    }
  }
  
  var qt = plan.questionTypeId;
  if (qt === 'choice') {
    var options = Rng.shuffle(rng, [ans].concat(distractors).slice(0, 4));
    var correctIndex = options.indexOf(ans);
    return {
      knowledgePointId: pkp(plan),
      questionType: 'choice',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: prompt,
      answer: String(correctIndex),
      answerMode: 'choice',
      data: {
        mode: 'choice',
        steps: Object.keys(nums).length > 2 ? 2 : 1,
        template: template,
        numbers: nums,
        options: options,
        correctIndex: correctIndex,
        relation: PROBLEM_TEMPLATES[template].relation
      }
    };
  }
  
  if (qt === 'judge') {
    var isTrue = rng() < 0.5;
    var shown = isTrue ? ans : ans + randInt(rng, -5, 5) || 1;
    return {
      knowledgePointId: pkp(plan),
      questionType: 'judge',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: prompt + ' 答案是 ' + shown + ' —— 对还是错？',
      answer: isTrue,
      answerMode: 'judge',
      data: {
        mode: 'judge',
        steps: Object.keys(nums).length > 2 ? 2 : 1,
        template: template,
        numbers: nums,
        shownAnswer: shown,
        relation: PROBLEM_TEMPLATES[template].relation
      }
    };
  }
  
  
  return {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: String(answer),
    answerMode: qt === 'apply' ? 'input' : 'input',
    data: {
      mode: qt,
      steps: Object.keys(nums).length > 2 ? 2 : 1,
      template: template,
      numbers: nums,
      relation: PROBLEM_TEMPLATES[template].relation,
      operation: PROBLEM_TEMPLATES[template].ops[0]
    }
  };
}

function makeGraphicForApplication(template, nums) {
  
  return {
    type: 'geometry',
    subtype: 'rectangle',
    params: {
      width: 6,
      height: 3,
      labelSides: false,
      dashed: true,
      unit: '',
      unitPx: 30
    }
  };
}

function createApplicationGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:application';
  var subject = spec.subject || 'math';

  return {
    id: id,
    subject: subject,
    capabilities: ['apply', 'fill', 'choice', 'judge', 'calc', 'oral', 'open'],
    questionTypes: ['apply', 'fill', 'choice', 'judge', 'calc', 'oral', 'open'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));
      var meta = getApplicationMeta(kp);

      for (var i = 0; i < count; i++) {
        var q;
        var qt = plan.questionTypeId;
        if (qt === 'open') {
          
          var rng = Rng.createSeededRandom(seedFor(plan, context, i));
          var a = randInt(rng, 10, 99);
          var b = randInt(rng, 2, 12);
          var ops = ['加', '减', '乘', '除'];
          var opWord = Rng.pick(rng, ops);
          var answer = computeAnswer('multiplication', { a: a, n: b });
          q = {
            knowledgePointId: pkp(plan),
            questionType: 'open',
            difficulty: plan.difficulty,
            spiralLevel: plan.spiralLevel || 1,
            context: plan.contextType || 'standard',
            seed: seedFor(plan, context, i),
            prompt: '【竞赛开放题】一个数是' + a + '，另一个数是' + b + '的多少倍？请写出完整的解题过程并说明你的思路。',
            answer: { value: String(answer), acceptable: [] },
            answerMode: 'input',
            data: {
              mode: 'open',
              steps: 3,
              graphic: makeGraphicForApplication('multiplication', { a: a, n: b }),
              numbers: { a: a, b: b, answer: answer },
              template: 'competition-open'
            }
          };
        } else {
          q = makeApplicationQuestion(plan, context, i, meta);
          q.data.graphic = makeGraphicForApplication(q.data.template, q.data.numbers);
        }
        questions.push(q);
      }
      return questions;
    }
  };
}

var APPLICATION_KPS = [
  'math-g1-m8-rmb-shopping',
  'math-g2-m8-money',
  'math-g3-m4-g3-measure',
  'math-g4-m8-g4-word-div',
  'math-g4-m8-g4-word-div', 
  'math-g5-m8-g5-word-solid',
  'math-g6-c4-area-basic',
  'math-g6-c4-solid-geometry',
  'math-g6-m10-g6-reason-number-shape'
  
];

function buildAll() {
  return [
    createApplicationGenerator({
      id: 'generator:application-word',
      knowledgePoints: APPLICATION_KPS
    })
  ];
}

module.exports = {
  PROBLEM_TEMPLATES: PROBLEM_TEMPLATES,
  createApplicationGenerator: createApplicationGenerator,
  buildAll: buildAll
};
};
__defs["shared/generator/generators/composite.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");
var Arith = require("shared/generator/core/arithmetic-core.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':composite:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':composite:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':composite:' + i;
}

function getKpMeta(kpId) {
  var kp = KP.get(kpId);
  if (!kp) return null;
  var canonical = require("shared/knowledge-ontology.js").normalize(kp);
  return {
    id: canonical.id,
    category: canonical.category || kp.legacy?.category,
    legacyType: canonical.source?.legacyType || kp.legacy?.legacyType,
    numericRange: canonical.numeric?.range || null,
    structure: canonical.structure || {},
    factualContent: canonical.factualContent || null,
    graphicType: canonical.graphicType || null
  };
}


function makeCalcToJudge(plan, context, i, kpMetas, rng) {
  
  var srcKp = Rng.pick(rng,kpMetas.filter(function(m) { return m.category === 'algebra'; }));
  if (!srcKp) srcKp = Rng.pick(rng,kpMetas);
  
  var arithSem = require("shared/generator/core/kp-arithmetic-semantics.js").resolveArithmeticSemantics(KP.get(srcKp.id));
  var ops = arithSem ? arithSem.operators : ['+', '−'];
  var op = Rng.pick(rng,ops);
  
  var a, b, correct, isTrue;
  if (op === '+') {
    a = Rng.randInt(rng, 1, 9);
    b = Rng.randInt(rng, 1, 9);
    correct = a + b;
    isTrue = Rng.randInt(rng, 0, 1);
  } else if (op === '−') {
    a = Rng.randInt(rng, 2, 10);
    b = Rng.randInt(rng, 1, a - 1);
    correct = a - b;
    isTrue = Rng.randInt(rng, 0, 1);
  } else if (op === '×') {
    a = Rng.randInt(rng, 1, 9);
    b = Rng.randInt(rng, 1, 9);
    correct = a * b;
    isTrue = Rng.randInt(rng, 0, 1);
  } else if (op === '÷') {
    b = Rng.randInt(rng, 2, 9);
    correct = Rng.randInt(rng, 1, 9);
    a = b * correct;
    isTrue = Rng.randInt(rng, 0, 1);
  }
  
  var shown = isTrue ? correct : correct + (Rng.randInt(rng, 0, 1) ? 1 : -1);
  var prompt = a + ' ' + op + ' ' + b + ' = ' + shown + ' （对还是错？）';
  
  return {
    knowledgePointId: pkp(plan),
    knowledgePointIds: kpMetas.map(function(m) { return m.id; }),
    questionType: 'judge',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: isTrue,
    answerMode: 'judge',
    data: {
      mode: 'calc-to-judge',
      steps: 1,
      primaryKp: srcKp.id,
      operation: op,
      operands: [a, b],
      correct: correct,
      shown: shown,
      composite: true
    }
  };
}


function makeMeasureToCalc(plan, context, i, kpMetas, rng) {
  var measureKp = Rng.pick(rng,kpMetas.filter(function(m) { return m.category === 'measurement'; }));
  var calcKp = Rng.pick(rng,kpMetas.filter(function(m) { return m.category === 'algebra'; }));
  
  if (!measureKp || !calcKp) {
    
    return makeCalcToJudge(plan, context, i, kpMetas, rng);
  }
  
  
  var units = [
    { from: '米', to: '厘米', factor: 100 },
    { from: '千克', to: '克', factor: 1000 },
    { from: '小时', to: '分钟', factor: 60 },
    { from: '元', to: '角', factor: 10 },
    { from: '角', to: '分', factor: 10 }
  ];
  var unit = Rng.pick(rng,units);
  var baseVal = Rng.randInt(rng, 1, 9);
  var converted = baseVal * unit.factor;
  
  var op = Rng.pick(rng,['+', '−']);
  var b = Rng.randInt(rng, 1, 20);
  var answer = op === '+' ? converted + b : converted - b;
  
  var prompt = baseVal + unit.from + ' = ' + converted + unit.to + '，' + converted + unit.to + ' ' + op + ' ' + b + unit.to + ' = ____ ' + unit.to;
  
  return {
    knowledgePointId: pkp(plan),
    knowledgePointIds: kpMetas.map(function(m) { return m.id; }),
    questionType: plan.questionTypeId || 'calc',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: String(answer),
    answerMode: 'input',
    data: {
      mode: 'measure-to-calc',
      steps: 2,
      primaryKp: calcKp.id,
      measureKp: measureKp.id,
      operation: op,
      conversion: { from: unit.from, to: unit.to, factor: unit.factor, base: baseVal, converted: converted },
      operand: b,
      composite: true
    }
  };
}


function makeShapeToApply(plan, context, i, kpMetas, rng) {
  var shapeKp = Rng.pick(rng,kpMetas.filter(function(m) { return m.category === 'geometry'; }));
  if (!shapeKp) shapeKp = Rng.pick(rng,kpMetas);
  
  var shapeFeatures = {
    'cube': { name: '正方体', edges: 12, faces: 6, vertices: 8 },
    'cuboid': { name: '长方体', edges: 12, faces: 6, vertices: 8 },
    'cylinder': { name: '圆柱', edges: 2, faces: 3, vertices: 0 },
    'cone': { name: '圆锥', edges: 1, faces: 2, vertices: 1 },
    'sphere': { name: '球', edges: 0, faces: 1, vertices: 0 },
    'rectangle': { name: '长方形', edges: 4, faces: 1, vertices: 4 },
    'square': { name: '正方形', edges: 4, faces: 1, vertices: 4 },
    'triangle': { name: '三角形', edges: 3, faces: 1, vertices: 3 },
    'circle': { name: '圆', edges: 0, faces: 1, vertices: 0 }
  };
  
  var featureKeys = Object.keys(shapeFeatures);
  var feature = Rng.pick(rng,featureKeys);
  var meta = shapeFeatures[feature];

  var attrKeys = ['edges', 'faces', 'vertices'];
  var attr = Rng.pick(rng,attrKeys);
  var attrName = { edges: '棱', faces: '面', vertices: '顶点' }[attr];
  var answer = meta[attr];

  var prompt = meta.name + '有几个' + attrName + '？';
  
  
  var variantCodes = [featureKeys.indexOf(feature) + 1, attrKeys.indexOf(attr) + 1];

  return {
    knowledgePointId: pkp(plan),
    knowledgePointIds: kpMetas.map(function(m) { return m.id; }),
    questionType: plan.questionTypeId || 'fill',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: String(answer),
    answerMode: 'input',
    data: {
      mode: 'shape-to-apply',
      steps: 1,
      primaryKp: shapeKp.id,
      shapeType: feature,
      targetAttr: attr,
      attrName: attrName,
      operands: variantCodes,
      composite: true
    }
  };
}

function createCompositeGenerator(spec) {
  spec = spec || {};
  var mode = spec.mode || 'auto'; 
  
  return {
    id: spec.id || 'generator:composite',
    subject: spec.subject || 'math',
    capabilities: ['calc', 'judge', 'fill', 'apply'],
    questionTypes: ['calc', 'judge', 'fill', 'apply', 'oral'],
    knowledgePoints: spec.knowledgePoints || [],
    supportsComposite: true,
    
    supports: function (plan) {
      if (!plan || !plan.combine) return false;
      if (!plan.knowledgePointIds || plan.knowledgePointIds.length < 2) return false;
      
      var kpIds = plan.knowledgePointIds;
      var categories = new Set();
      kpIds.forEach(function(id) {
        var meta = getKpMeta(id);
        if (meta) categories.add(meta.category);
      });
      return categories.size >= 2;
    },
    
    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kpIds = plan.knowledgePointIds || [plan.knowledgePointId];
      var kpMetas = kpIds.map(getKpMeta).filter(Boolean);
      
      if (kpMetas.length < 2) {
        throw new Error('Composite generator 需要至少 2 个不同类别的 KP');
      }
      
      for (var i = 0; i < count; i++) {
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        var q;
        
        
        var mode = spec.mode || 'auto';
        if (mode === 'auto') {
          var categories = new Set(kpMetas.map(function(m) { return m.category; }));
          if (categories.has('algebra') && categories.has('geometry')) {
            mode = 'shape-to-apply';
          } else if (categories.has('algebra') && categories.has('measurement')) {
            mode = 'measure-to-calc';
          } else if (categories.has('algebra')) {
            mode = 'calc-to-judge';
          } else {
            mode = 'calc-to-judge';
          }
        }
        
        switch (mode) {
          case 'calc-to-judge':
            q = makeCalcToJudge(plan, context, i, kpMetas, rng);
            break;
          case 'measure-to-calc':
            q = makeMeasureToCalc(plan, context, i, kpMetas, rng);
            break;
          case 'shape-to-apply':
            q = makeShapeToApply(plan, context, i, kpMetas, rng);
            break;
          default:
            q = makeCalcToJudge(plan, context, i, kpMetas, rng);
        }
        
        questions.push(q);
      }
      return questions;
    }
  };
}

var COMPOSITE_KPS = [
  
  'math-g1-m1-addsub-10', 'math-g1-m0-make-ten', 'math-g1-m0-make-ten-cushi', 'math-g1-m1-addsub-5', 'math-g1-m11-judge-mixed',
  
  'math-g1-m4-rmb-unit', 'math-g1-m4-rmb-calc', 'math-g1-m8-rmb-shopping',
  'math-g2-m4-length-unit', 'math-g2-m4-mass-unit', 'math-g2-m4-time-unit',
  'math-g2-m8-money', 'math-g3-m4-g3-measure',
  
  'math-g1-m6-solid-shape', 'math-g1-m6-flat-shape', 'math-g1-m6-shape-combine',
  'math-g2-m6-solid-shape', 'math-g4-c4-c4-solid', 'math-g5-c4-solid-geometry',
  'math-g6-c4-solid-geometry'
];

function buildAll() {
  return [
    createCompositeGenerator({
      id: 'generator:composite',
      mode: 'auto',
      knowledgePoints: COMPOSITE_KPS
    })
  ];
}

module.exports = {
  COMPOSITE_KPS: COMPOSITE_KPS,
  createCompositeGenerator: createCompositeGenerator,
  buildAll: buildAll
};
};
__defs["shared/generator/generators/counting.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':counting:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':counting:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':counting:' + i;
}


function factorial(n) {
  var f = 1;
  for (var k = 2; k <= n; k++) f *= k;
  return f;
}

function nCr(n, r) {
  if (r < 0 || r > n) return 0;
  r = Math.min(r, n - r);
  var f = 1;
  for (var k = 0; k < r; k++) f = (f * (n - k)) / (k + 1);
  return Math.round(f);
}


function derangement(n) {
  if (n === 0) return 1;
  if (n === 1) return 0;
  var d0 = 1, d1 = 0; 
  for (var k = 2; k <= n; k++) {
    var dk = (k - 1) * (d1 + d0);
    d0 = d1; d1 = dk;
  }
  return d1;
}


function stairWays(n) {
  if (n <= 2) return n;
  var a = 1, b = 2;
  for (var k = 3; k <= n; k++) { var c = a + b; a = b; b = c; }
  return b;
}

function makeCountingQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  
  var name = (kp && kp.identity && kp.identity.name) || (kp && kp.name) || '计数问题';

  
  var type = 'generic';
  if (name.indexOf('加法') !== -1 || name.indexOf('乘法原理') !== -1) type = 'principle';
  else if (name.indexOf('枚举') !== -1) type = 'enumeration';
  else if (name.indexOf('最不利') !== -1) type = 'worst-case';
  else if (name.indexOf('抽屉') !== -1) type = 'pigeonhole';
  else if (name.indexOf('容斥') !== -1) type = 'inclusion';
  else if (name.indexOf('递推') !== -1) type = 'recursion';
  else if (name.indexOf('错排') !== -1) type = 'derangement';
  else if (name.indexOf('捆绑') !== -1) type = 'bundling';
  else if (name.indexOf('插空') !== -1) type = 'insertion';
  else if (name.indexOf('隔板') !== -1) type = 'starsbars';
  else if (name.indexOf('排列') !== -1) type = 'permutation';
  else if (name.indexOf('搭配') !== -1) type = 'combination';
  else if (name.indexOf('组合') !== -1) type = 'choose';
  else if (name.indexOf('集合') !== -1) type = 'set';

  var prompt, answer, steps;
  if (type === 'principle') {
    var m = Rng.randInt(rng, 3, 8);
    var n = Rng.randInt(rng, 2, 6);
    prompt = '从A城到B城有' + m + '条路线，从B城到C城有' + n + '条路线，从A城到C城共有多少种走法？';
    answer = m * n;
    steps = 2;
  } else if (type === 'enumeration') {
    var digits = [1, 2, 3, 4, 5];
    var len = Rng.randInt(rng, 2, 3);
    prompt = '用' + digits.slice(0, len + 1).join('、') + '这' + (len + 1) + '个数字，可以组成多少个没有重复数字的' + len + '位数？';
    var ans = 1; for (var d = len + 1; d > len + 1 - len; d--) ans *= d;
    answer = ans;
    steps = 3;
  } else if (type === 'worst-case') {
    prompt = '一个盒子里有红、黄、蓝三种颜色的球各若干个，至少要摸出多少个球，才能保证有3个球颜色相同？';
    answer = 7;
    steps = 2;
  } else if (type === 'combination') {
    var shirts = Rng.randInt(rng, 2, 5);
    var pants = Rng.randInt(rng, 2, 5);
    prompt = '小明有' + shirts + '件上衣和' + pants + '条裤子，一共有多少种不同的搭配方法？';
    answer = shirts * pants;
    steps = 2;
  } else if (type === 'set') {
    var inBoth = Rng.randInt(rng, 3, 8);
    var onlyA = Rng.randInt(rng, 5, 15);
    var onlyB = Rng.randInt(rng, 5, 15);
    prompt = '全班40人，有' + onlyA + '人喜欢数学，' + onlyB + '人喜欢语文，有' + inBoth + '人两门都喜欢。两门都不喜欢的有多少人？';
    answer = 40 - (onlyA + onlyB - inBoth);
    steps = 2;
  } else if (type === 'permutation') {
    
    var pn = Rng.randInt(rng, 4, 6);
    prompt = pn + '本不同的书排成一排放在书架上，一共有多少种不同的排法？';
    answer = factorial(pn);
    steps = 2;
  } else if (type === 'choose') {
    
    var cn = Rng.randInt(rng, 5, 7);
    prompt = '从' + cn + '名同学中选出 2 名代表参加会议，一共有多少种不同的选法？';
    answer = nCr(cn, 2);
    steps = 2;
  } else if (type === 'bundling') {
    
    var bn = Rng.randInt(rng, 5, 6);
    prompt = bn + '本不同的书排成一排，其中有 2 本必须相邻，一共有多少种不同的排法？';
    answer = factorial(2) * factorial(bn - 1);
    steps = 3;
  } else if (type === 'insertion') {
    
    prompt = '3 名男生已按固定顺序排成一排（形成 4 个空位），现将 2 名女生插入空位，要求两名女生互不相邻，一共有多少种插入方法？';
    answer = 4 * 3;
    steps = 2;
  } else if (type === 'starsbars') {
    
    var sn = 7, sm = 3;
    prompt = '把 ' + sn + ' 个相同的苹果分给 ' + sm + ' 个小朋友，每人至少分到 1 个，一共有多少种不同的分法？';
    answer = nCr(sn - 1, sm - 1);
    steps = 2;
  } else if (type === 'pigeonhole') {
    
    var colors = 4, want = 4;
    prompt = '盒子里有红、黄、蓝、绿 4 种颜色的球各 10 个（球除颜色外完全相同）。至少要摸出多少个球，才能保证其中有 ' + want + ' 个球颜色相同？';
    answer = colors * (want - 1) + 1;
    steps = 2;
  } else if (type === 'inclusion') {
    
    var aN = 20, bN = 18, cN = 16, ab = 8, ac = 7, bc = 6, abc = 3, total = 40;
    prompt = '某班共有 ' + total + ' 人，参加数学小组的有 ' + aN + ' 人，参加英语小组的有 ' + bN + ' 人，参加科学小组的有 ' + cN + ' 人；'
      + '同时参加数学和英语的有 ' + ab + ' 人，同时参加数学和科学的有 ' + ac + ' 人，同时参加英语和科学的有 ' + bc + ' 人；'
      + '三个小组都参加的有 ' + abc + ' 人。三个小组都没参加的有多少人？';
    answer = total - (aN + bN + cN - ab - ac - bc + abc);
    steps = 3;
  } else if (type === 'recursion') {
    
    var rn = 5;
    prompt = '小明上楼梯，每次可以走 1 级或 2 级台阶。他上到第 ' + rn + ' 级台阶时，一共有多少种不同的走法？';
    answer = stairWays(rn);
    steps = 3;
  } else if (type === 'derangement') {
    
    var dn = 4;
    prompt = '有 ' + dn + ' 封信和写好对应地址的 ' + dn + ' 个信封，把信全部装错（没有一封信装进正确的信封），一共有多少种装法？';
    answer = derangement(dn);
    steps = 2;
  } else {
    var a = Rng.randInt(rng, 2, 6);
    var b = Rng.randInt(rng, 2, 6);
    prompt = name + '：从' + a + '种水果和' + b + '种饮料中各选一种，共有多少种搭配？';
    answer = a * b;
    steps = 2;
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'apply',
      steps: steps,
      questionType: plan.questionTypeId
    }
  };
}

var COUNTING_KPS = [
  
  'math-g3-m10-g3-combination',
  'math-g3-m10-g3-set',
  
  'math-g4-c3-c3-enum',
  'math-g4-c3-c3-am',
  'math-g4-c3-c3-perm',
  'math-g4-c3-c3-worst',
  
  
  'math-g5-c3-addition-principle',
  'math-g5-c3-multiplication-principle',
  'math-g5-c3-permutation',
  'math-g5-c3-combination',
  'math-g5-c3-enumeration-counting',
  'math-g5-c3-bundling-method',
  'math-g5-c3-insertion-method',
  'math-g5-c3-stars-bars',
  'math-g5-c3-pigeonhole-principle',
  'math-g5-c3-worst-case-principle',
  
  'math-g6-c3-addition-principle',
  'math-g6-c3-multiplication-principle',
  'math-g6-c3-permutation',
  'math-g6-c3-combination',
  'math-g6-c3-enumeration-counting',
  'math-g6-c3-bundling-method',
  'math-g6-c3-insertion-method',
  'math-g6-c3-stars-bars',
  'math-g6-c3-pigeonhole-principle',
  'math-g6-c3-worst-case-principle',
  'math-g6-c3-inclusion-exclusion',
  'math-g6-c3-recursion-counting',
  'math-g6-c3-derangement'
];

function createCountingGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:counting';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || COUNTING_KPS,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));

      for (var i = 0; i < count; i++) {
        questions.push(makeCountingQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createCountingGenerator({
      id: 'generator:counting',
      knowledgePoints: COUNTING_KPS
    })
  ];
}

module.exports = {
  COUNTING_KPS: COUNTING_KPS,
  createCountingGenerator: createCountingGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/reasoning.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':reason:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':reason:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':reason:' + i;
}

function makeReasoningQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kp.name || '逻辑推理';

  var type = 'generic';
  if (name.indexOf('抽屉') !== -1 || name.indexOf('鸽巢') !== -1) type = 'drawer';
  else if (name.indexOf('最值') !== -1 || name.indexOf('极值') !== -1) type = 'extreme';
  else if (name.indexOf('鸡兔') !== -1) type = 'chicken-rabbit';
  else if (name.indexOf('植树') !== -1) type = 'tree-planting';
  else if (name.indexOf('找次品') !== -1 || name.indexOf('天平') !== -1) type = 'find-defect';
  else if (name.indexOf('握手') !== -1) type = 'handshake';
  else if (name.indexOf('数独') !== -1) type = 'sudoku';
  else if (name.indexOf('必胜') !== -1) type = 'winning';
  else if (name.indexOf('优化') !== -1 || name.indexOf('沏茶') !== -1 || name.indexOf('烙饼') !== -1 || name.indexOf('统筹') !== -1) type = 'optimization';
  else if (name.indexOf('线段') !== -1 || name.indexOf('数字推理') !== -1) type = 'seq';
  else type = 'logic';

  var prompt, answer, steps;
  if (type === 'drawer') {
    var colors = Rng.randInt(rng, 3, 5);
    prompt = '有红、黄、蓝、绿四种颜色的球，至少要摸出多少个，才能保证有2个球颜色相同？';
    answer = colors + 1;
    steps = 2;
  } else if (type === 'extreme') {
    var twoSum = Rng.randInt(rng, 10, 50);
    prompt = '两个数的和是' + twoSum + '，这两个数的乘积最大是多少？';
    var half = Math.floor(twoSum / 2);
    answer = half * (twoSum - half);
    steps = 2;
  } else if (type === 'chicken-rabbit') {
    var heads = Rng.randInt(rng, 8, 20);
    var feet = heads * 2 + Rng.randInt(rng, 6, 20);
    prompt = '鸡兔同笼，共有' + heads + '个头，' + feet + '只脚。鸡和兔各多少只？';
    var rabb = (feet - heads * 2) / 2;
    answer = '鸡' + (heads - rabb) + '只，兔' + rabb + '只';
    steps = 3;
  } else if (type === 'tree-planting') {
    var total = Rng.randInt(rng, 100, 500);
    var gap = Rng.randInt(rng, 5, 20);
    prompt = '在一条长' + total + '米的公路一边植树，每隔' + gap + '米栽一棵（两端都栽），一共要栽多少棵？';
    answer = Math.floor(total / gap) + 1;
    steps = 2;
  } else if (type === 'find-defect') {
    prompt = '有9瓶水，其中1瓶是次品（略轻）。用天平称，至少称几次就能找出次品？';
    answer = 2;
    steps = 2;
  } else if (type === 'handshake') {
    var n = Rng.randInt(rng, 4, 10);
    prompt = n + '个人握手，每两个人握一次手，一共要握多少次？';
    answer = n * (n - 1) / 2;
    steps = 2;
  } else if (type === 'sudoku') {
    prompt = name + '：请根据已知数字推理出空格中的数字。';
    answer = '（推理过程略）';
    steps = 4;
  } else if (type === 'winning') {
    prompt = name + '：两堆棋子，每次只能从一堆中取1~3个，取到最后一个棋子者胜。先手必胜还是后手必胜？';
    answer = '先手必胜（对称策略）';
    steps = 3;
  } else if (type === 'optimization') {
    var pans = Rng.randInt(rng, 2, 4);
    prompt = '用一口锅烙' + pans + '张饼，每张饼两面都要烙，每面需要2分钟。至少需要多少分钟？';
    answer = pans * 2;
    steps = 3;
  } else if (type === 'seq') {
    prompt = name + '：观察数列规律，写出下一个数：2, 4, 6, 8, ?';
    answer = 10;
    steps = 1;
  } else {
    prompt = name + '：A、B、C、D四人中有一人说谎。根据条件推理谁在说谎。';
    answer = '（逻辑推理略）';
    steps = 4;
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: typeof answer === 'number' ? { value: String(answer), acceptable: [] } : { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: { mode: 'apply', steps: steps, questionType: plan.questionTypeId }
  };
}

var REASONING_KPS = [
  'math-g2-m10-logic-reasoning',
  'math-g2-m10-sudoku3',
  'math-g2-m10-combination',
  'math-g2-m10-handshake',
  'math-g4-m10-g4-reason-opt',
  'math-g4-m10-g4-reason-cr',
  'math-g4-m10-logic-reasoning',
  'math-g4-c8-c8-extreme',
  'math-g4-c8-c8-drawer',
  'math-g4-c8-c8-logic',
  'math-g5-m10-g5-reason-tree3',
  'math-g5-m10-g5-reason-defect',
  'math-g5-m10-logic-reasoning',
  'math-g5-m10-g5-reason-seq',
  'math-g5-c8-extremum-problem',
  'math-g5-c8-logic-inference',
  'math-g5-c8-winning-strategy',
  'math-g6-m10-g6-reason-pigeonhole',
  'math-g6-c8-extremum-problem',
  'math-g6-c8-logic-inference',
  'math-g6-c8-winning-strategy',
  'math-g6-c8-optimization'
];

function createReasoningGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:reasoning';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || REASONING_KPS,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));

      for (var i = 0; i < count; i++) {
        questions.push(makeReasoningQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createReasoningGenerator({
      id: 'generator:reasoning',
      knowledgePoints: REASONING_KPS
    })
  ];
}

module.exports = {
  REASONING_KPS: REASONING_KPS,
  createReasoningGenerator: createReasoningGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/stats.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':stats:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':stats:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':stats:' + i;
}

function makeStatsQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kp.name || '统计问题';

  var type = 'generic';
  if (name.indexOf('平均') !== -1) type = 'average';
  else if (name.indexOf('可能') !== -1) type = 'probability';
  else if (name.indexOf('折线') !== -1) type = 'line-chart';
  else if (name.indexOf('条形') !== -1) type = 'bar-chart';
  else if (name.indexOf('扇形') !== -1 || name.indexOf('饼') !== -1) type = 'pie-chart';
  else if (name.indexOf('复式') !== -1) type = 'double-chart';
  else if (name.indexOf('统计表') !== -1 || name.indexOf('正字') !== -1 || name.indexOf('收集') !== -1) type = 'data-collect';
  else type = 'chart-read';

  var prompt, answer, steps;
  if (type === 'average') {
    var nums = [];
    for (var i = 0; i < 4; i++) nums.push(Rng.randInt(rng, 20, 100));
    var avg = Math.round(nums.reduce(function (a, b) { return a + b; }, 0) / nums.length);
    prompt = name + '：四个同学的身高分别是' + nums.join('cm、') + 'cm，求他们的平均身高。';
    answer = avg; steps = 2;
  } else if (type === 'probability') {
    var total = Rng.randInt(rng, 6, 12);
    var favorable = Rng.randInt(rng, 1, total - 1);
    prompt = '盒子里有' + total + '个球，其中' + favorable + '个红球，摸到红球的可能性是多少？';
    answer = favorable + '/' + total; steps = 1;
  } else if (type === 'line-chart') {
    prompt = name + '：根据折线图回答：哪一天的温度最高？最高温度是多少？';
    answer = '（从图中读取）'; steps = 1;
  } else if (type === 'bar-chart') {
    prompt = name + '：根据条形图回答：哪个年级的人数最多？多多少？';
    answer = '（从图中读取）'; steps = 1;
  } else if (type === 'pie-chart') {
    prompt = name + '：根据扇形图，如果总人数是100人，喜欢语文的有多少人？';
    answer = '（从图中读取百分比×100）'; steps = 2;
  } else if (type === 'double-chart') {
    prompt = name + '：复式统计图中，男生和女生在哪一项上的差距最大？';
    answer = '（从图中对比）'; steps = 2;
  } else if (type === 'data-collect') {
    prompt = name + '：用正字法收集全班同学喜欢的水果，数据如下，请整理成统计表。';
    answer = '（统计整理略）'; steps = 2;
  } else {
    prompt = name + '：根据统计表中的数据，回答相关问题。';
    answer = '（从表中读取）'; steps = 1;
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: typeof answer === 'number' ? { value: String(answer), acceptable: [] } : { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: { mode: 'apply', steps: steps, questionType: plan.questionTypeId, graphic: { type: 'chart' } }
  };
}

var STATS_KPS = [
  'math-g2-m9-data-tally',
  'math-g2-m9-data-question',
  'math-g3-m9-g3-stats-table',
  'math-g4-m9-g4-stats-bar',
  'math-g4-m9-g4-stats-double',
  'math-g4-m9-g4-stats-avg',
  'math-g4-m11-stats',
  'math-g5-m4-g5-fill-linechart',
  'math-g5-m8-g5-word-linechart',
  'math-g5-m9-g5-stats-possib',
  'math-g5-m9-g5-stats-line1',
  'math-g5-m9-g5-stats-line2',
  'math-g5-m11-stats',
  'math-g5-m12-stats',
  'math-g6-m4-g6-fill-pie-chart',
  'math-g6-m5-g6-match-chart',
  'math-g6-m7-g6-pic-pie-chart',
  'math-g6-m9-g6-stat-pie-chart',
  'math-g6-m9-g6-stat-possibility',
  'math-g6-m11-g6-judge-chart',
  'math-g6-m12-g6-choice-chart'
];

function createStatsGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:stats';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || STATS_KPS,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));

      for (var i = 0; i < count; i++) {
        questions.push(makeStatsQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createStatsGenerator({
      id: 'generator:stats',
      knowledgePoints: STATS_KPS
    })
  ];
}

module.exports = {
  STATS_KPS: STATS_KPS,
  createStatsGenerator: createStatsGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/picture-equation.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':picture:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':picture:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':picture:' + i;
}

function makePictureEquationQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kp.name || '看图列式';

  var type = 'generic';
  if (name.indexOf('线段') !== -1) type = 'segment';
  else if (name.indexOf('大括号') !== -1 || name.indexOf('看图列') !== -1) type = 'brace';
  else if (name.indexOf('天平') !== -1) type = 'balance';
  else if (name.indexOf('数阵') !== -1) type = 'number-array';
  else if (name.indexOf('幻方') !== -1) type = 'magic-square';
  else if (name.indexOf('植树') !== -1) type = 'tree';
  else if (name.indexOf('比例尺') !== -1) type = 'scale';
  else if (name.indexOf('小数') !== -1) type = 'decimal-context';
  else type = 'generic';

  var prompt, answer, steps;
  if (type === 'segment') {
    var total = Rng.randInt(rng, 20, 100);
    var part = Rng.randInt(rng, 5, total - 5);
    prompt = '根据线段图：总长' + total + '，其中一部分是' + part + '，求另一部分是多少？';
    answer = total - part; steps = 1;
  } else if (type === 'brace') {
    var a = Rng.randInt(rng, 5, 30);
    var b = Rng.randInt(rng, 5, 30);
    prompt = '根据大括号图：左边有' + a + '个苹果，右边有' + b + '个苹果，一共有多少个？';
    answer = a + b; steps = 1;
  } else if (type === 'balance') {
    var left = Rng.randInt(rng, 5, 20);
    var right = left;
    var unknown = Rng.randInt(rng, 2, 8);
    prompt = '天平平衡：左边有' + left + '，右边有' + unknown + ' + ?。求?的值。';
    answer = left - unknown; steps = 2;
  } else if (type === 'number-array') {
    prompt = name + '：请在数阵图的空位中填入1-5的数字，使每条线上三个数的和都相等。';
    answer = '（数阵解略）'; steps = 3;
  } else if (type === 'magic-square') {
    prompt = name + '：请完成三阶幻方，使每行、每列、每条对角线上三个数的和都相等。';
    answer = '（幻方解略）'; steps = 4;
  } else if (type === 'tree') {
    var roadLen = Rng.randInt(rng, 100, 500);
    var gap = Rng.randInt(rng, 5, 15);
    prompt = name + '：线段图表示一条长' + roadLen + '米的公路，每隔' + gap + '米种一棵树（两端都栽），一共种多少棵？';
    answer = Math.floor(roadLen / gap) + 1; steps = 2;
  } else if (type === 'scale') {
    var scale = Rng.randInt(rng, 1000, 50000);
    var mapDist = Rng.randInt(rng, 2, 10);
    prompt = name + '：比例尺1:' + scale + '，地图上量得距离' + mapDist + 'cm，求实际距离（单位：km）。';
    answer = (mapDist * scale / 100000).toFixed(2); steps = 2;
  } else if (type === 'decimal-context') {
    var w = Rng.randInt(rng, 1, 9);
    var d = Rng.randInt(rng, 1, 9);
    prompt = name + '：根据情境图列式计算：' + w + '.' + d + ' + ' + (w + 1) + '.' + (d + 1) + ' = ?';
    answer = (parseFloat(w + '.' + d) + parseFloat((w + 1) + '.' + (d + 1))).toFixed(2); steps = 1;
  } else {
    var x = Rng.randInt(rng, 3, 20);
    var y = Rng.randInt(rng, 3, 20);
    prompt = name + '：根据图示信息列式并计算。';
    answer = x + y; steps = 1;
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: { mode: plan.questionTypeId, steps: steps, questionType: plan.questionTypeId, graphic: { type: 'diagram' } }
  };
}

var PICTURE_EQ_KPS = [
  'math-g2-m7-pic-mixed',
  'math-g4-m7-g4-pic-segment',
  'math-g4-m7-g4-pic-brace',
  'math-g4-m7-g4-pic-speed',
  'math-g4-m7-g4-pic-dec',
  'math-g4-c1-c1-array',
  'math-g4-c1-c1-magic',
  'math-g5-m7-g5-pic-balance',
  'math-g5-m7-g5-pic-segment',
  'math-g5-m7-g5-pic-tree',
  'math-g5-c1-number-array-closed',
  'math-g5-c1-number-array-radial',
  'math-g5-c1-number-array-composite',
  'math-g5-c1-magic-square-3',
  'math-g5-c1-magic-square-4',
  'math-g6-m7-g6-pic-frac-line',
  'math-g6-m7-g6-pic-scale',
  'math-g6-c1-magic-square-adv',
  'math-g6-c1-number-array'
];

function createPictureEquationGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:picture-equation';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || PICTURE_EQ_KPS,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));

      for (var i = 0; i < count; i++) {
        questions.push(makePictureEquationQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createPictureEquationGenerator({
      id: 'generator:picture-equation',
      knowledgePoints: PICTURE_EQ_KPS
    })
  ];
}

module.exports = {
  PICTURE_EQ_KPS: PICTURE_EQ_KPS,
  createPictureEquationGenerator: createPictureEquationGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/c1-number-puzzle.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':c1:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':c1:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':c1:' + i;
}

function makePuzzleQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kp.name || '数字谜';
  var id = kp.id || '';

  var isVertical = name.indexOf('竖式') !== -1 || id.indexOf('vertical') !== -1 || id.indexOf('digit-puzzle') !== -1;
  var isHorizontal = name.indexOf('横式') !== -1 || id.indexOf('horizontal') !== -1;
  var isSymbol = name.indexOf('符号') !== -1 || name.indexOf('字母') !== -1 || id.indexOf('symbol') !== -1;
  var isDigitReasoning = name.indexOf('数字推理') !== -1 || id.indexOf('digit-reasoning') !== -1 || id.indexOf('number-puzzle-competition') !== -1;

  var prompt, answer;

  if (isVertical) {
    
    var base = Rng.randInt(rng, 10, 50);
    var add = Rng.randInt(rng, 10, 50);
    var sum = base + add;
    
    var hidePos = Rng.randInt(rng, 0, String(sum).length - 1);
    var sumStr = String(sum);
    var hiddenDigit = sumStr[hidePos];
    var shownSum = sumStr.substring(0, hidePos) + '□' + sumStr.substring(hidePos + 1);
    prompt = '在下面的竖式中，"□" 表示被擦掉的数字。\n  ' + base + '\n+ ' + add + '\n----\n ' + shownSum + '\n请算出 □ 代表的数字。';
    answer = hiddenDigit;
  } else if (isHorizontal) {
    
    var a = Rng.randInt(rng, 10, 99);
    var b = Rng.randInt(rng, 10, 99);
    var c = a + b;
    prompt = '在等式 ' + a + ' + □ = ' + c + ' 中，□ 代表什么数字？';
    answer = b;
  } else if (isSymbol) {
    
    var aa = Rng.randInt(rng, 2, 9);
    var bb = Rng.randInt(rng, 2, 9);
    var cc = aa + bb;
    if (cc > 9) { cc = aa + bb - 9; }
    prompt = '已知 ★ + ▲ = ' + cc + '，且 ★ 和 ▲ 是不同的数字。当 ★ 最大时，★ = ?';
    answer = String(cc - 1);
  } else if (isDigitReasoning) {
    
    prompt = '一个三位数的各位数字之和是 15，百位数字比十位数字大 3，个位数字是十位数字的 2 倍。这个三位数是多少？';
    
    answer = '636';
  } else {
    prompt = name + '：请根据竖式和横式中的线索，推算每个字母代表的数字。';
    answer = 'A=1, B=2, C=3';
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'apply',
      steps: 3,
      questionType: plan.questionTypeId,
      family: 'c1-number-puzzle'
    }
  };
}

var C1_KPS = [
  
  'math-g4-c1-c1-vertical',
  'math-g4-c1-c1-horizontal',
  'math-g4-c1-c1-symbol',
  
  'math-g5-c1-digit-puzzle-vertical',
  'math-g5-c1-digit-puzzle-horizontal',
  'math-g5-c1-digit-puzzle-symbol',
  
  'math-g6-c1-vertical-multidigit',
  'math-g6-c1-vertical-carry-complex',
  'math-g6-c1-horizontal-puzzle',
  'math-g6-c1-symbol-number',
  'math-g6-c1-digit-reasoning',
  'math-g6-c1-number-puzzle-competition'
];

function createC1Generator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c1-number-puzzle';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || C1_KPS,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));

      for (var i = 0; i < count; i++) {
        questions.push(makePuzzleQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createC1Generator({
      id: 'generator:c1-number-puzzle',
      knowledgePoints: C1_KPS
    })
  ];
}

module.exports = {
  C1_KPS: C1_KPS,
  createC1Generator: createC1Generator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/c2-number-theory.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':c2:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':c2:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':c2:' + i;
}

function gcd(a, b) { while (b) { var t = b; b = a % b; a = t; } return a; }
function lcm(a, b) { return a / gcd(a, b) * b; }

function makeTheoryQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kp.name || '数论问题';
  var id = kp.id || '';

  var isParity = name.indexOf('奇偶') !== -1;
  var isDivisible = name.indexOf('整除') !== -1 || id.indexOf('divisible') !== -1 || id.indexOf('divisibility') !== -1;
  var isPrimeFactor = name.indexOf('质因数') !== -1 || name.indexOf('分解质因数') !== -1;
  var isGcdLcm = name.indexOf('最大公') !== -1 || name.indexOf('最小公') !== -1;
  var isRemainder = name.indexOf('余数') !== -1 || name.indexOf('同余') !== -1 || id.indexOf('remainder') !== -1 || id.indexOf('congruence') !== -1;
  var isPlaceValue = name.indexOf('位值') !== -1 || id.indexOf('place-value') !== -1;
  var isPerfectSquare = name.indexOf('完全平方') !== -1;
  var isFactorCount = name.indexOf('因数个数') !== -1 || name.indexOf('因数和') !== -1;
  var isExtreme = name.indexOf('最值') !== -1;
  var isDiophantine = name.indexOf('不定方程') !== -1;
  var isModulo = name.indexOf('模运算') !== -1 || name.indexOf('周期') !== -1;

  var prompt, answer;

  if (isParity) {
    
    var a = Rng.randInt(rng, 10, 99);
    var b = Rng.randInt(rng, 10, 99);
    prompt = '已知 a = ' + a + '，b = ' + b + '。判断 a + b 是奇数还是偶数？';
    answer = ((a + b) % 2 === 0) ? '偶数' : '奇数';
  } else if (isDivisible) {
    
    var n = Rng.randInt(rng, 100, 999);
    prompt = '三位数 ' + n + ' 能被 9 整除吗？请说明理由。';
    answer = (n % 9 === 0) ? '能' : '不能';
  } else if (isPrimeFactor) {
    
    var nums = [30, 36, 48, 54, 60, 72, 84, 96, 108, 120];
    var num = nums[Rng.randInt(rng, 0, nums.length - 1)];
    prompt = '将 ' + num + ' 分解质因数。';
    var res = num; var factors = [];
    for (var p = 2; p * p <= res; p++) {
      while (res % p === 0) { factors.push(p); res /= p; }
    }
    if (res > 1) factors.push(res);
    answer = factors.join(' × ');
  } else if (isGcdLcm) {
    
    var m = Rng.randInt(rng, 10, 30);
    var k = Rng.randInt(rng, 10, 30);
    prompt = '求 ' + m + ' 和 ' + k + ' 的最大公因数和最小公倍数。';
    answer = '最大公因数 ' + gcd(m, k) + '，最小公倍数 ' + lcm(m, k);
  } else if (isRemainder) {
    
    var big = Rng.randInt(rng, 100, 500);
    var div = Rng.randInt(rng, 3, 9);
    prompt = big + ' 除以 ' + div + ' 余几？';
    answer = big % div;
  } else if (isPlaceValue) {
    
    var hun = Rng.randInt(rng, 1, 9);
    var ten = Rng.randInt(rng, 0, 9);
    var one = Rng.randInt(rng, 0, 9);
    var val = hun * 100 + ten * 10 + one;
    prompt = '一个三位数，百位上是 ' + hun + '，十位上是 ' + ten + '，个位上是 ' + one + '。这个数是多少？';
    answer = val;
  } else if (isPerfectSquare) {
    
    var sq = Rng.randInt(rng, 1, 15);
    prompt = (sq * sq) + ' 是完全平方数吗？请说明理由。';
    answer = '是';
  } else if (isFactorCount) {
    
    var n2 = Rng.randInt(rng, 12, 60);
    prompt = n2 + ' 有多少个正因数？';
    var count = 0;
    for (var i = 1; i <= n2; i++) if (n2 % i === 0) count++;
    answer = count;
  } else if (isExtreme) {
    
    prompt = '在 1~100 的自然数中，能被 3 整除但不能被 5 整除的数最大是多少？';
    answer = '99';
  } else if (isDiophantine) {
    
    prompt = '方程 3x + 2y = 17 有多少组正整数解？';
    answer = '2 组（x=1,y=7 和 x=3,y=4 和 x=5,y=1）';
  } else if (isModulo) {
    
    prompt = '计算 3^2024 的个位数字。';
    
    answer = '1';
  } else {
    prompt = name + '：请运用数论知识解答这个问题。';
    answer = '数论问题解答';
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'apply',
      steps: 3,
      questionType: plan.questionTypeId,
      family: 'c2-number-theory'
    }
  };
}

var C2_KPS = [
  
  'math-g4-c2-c2-parity',
  'math-g4-c2-c2-remainder',
  'math-g4-c2-c2-place',
  
  'math-g5-c2-divisibility',
  'math-g5-c2-parity-analysis',
  'math-g5-c2-prime-factorization',
  'math-g5-c2-factor-count-sum',
  'math-g5-c2-gcd-lcm',
  'math-g5-c2-remainder-congruence',
  'math-g5-c2-place-value',
  'math-g5-c2-perfect-square',
  'math-g5-c2-number-theory-extreme',
  
  'math-g6-c2-divisibility',
  'math-g6-c2-parity-analysis',
  'math-g6-c2-prime-factorization',
  'math-g6-c2-factor-count-sum',
  'math-g6-c2-gcd-lcm',
  'math-g6-c2-remainder-congruence',
  'math-g6-c2-place-value',
  'math-g6-c2-perfect-square',
  'math-g6-c2-number-theory-extreme',
  'math-g6-c2-diophantine-equation',
  'math-g6-c2-modulo-arithmetic'
];

function createC2Generator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c2-number-theory';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || C2_KPS,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));

      for (var i = 0; i < count; i++) {
        questions.push(makeTheoryQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createC2Generator({
      id: 'generator:c2-number-theory',
      knowledgePoints: C2_KPS
    })
  ];
}

module.exports = {
  C2_KPS: C2_KPS,
  createC2Generator: createC2Generator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/c5-c6-journey-engineering.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':c5c6:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':c5c6:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':c5c6:' + i;
}

function makeQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = (kp && kp.identity && kp.identity.name) || (kp && kp.name) || '行程问题';
  var id = (kp && (kp.identity && kp.identity.id)) || (kp && kp.id) || '';

  
  var isWork = id.indexOf('work') !== -1 || name.indexOf('工程') !== -1;
  var isConcentration = id.indexOf('concentration') !== -1 || name.indexOf('浓度') !== -1;
  var isMeet = id.indexOf('meet') !== -1 || name.indexOf('相遇') !== -1;
  var isChase = id.indexOf('chase') !== -1 || name.indexOf('追及') !== -1;
  var isTrain = id.indexOf('train') !== -1 || name.indexOf('火车') !== -1;
  var isBoat = id.indexOf('boat') !== -1 || id.indexOf('river') !== -1 || name.indexOf('流水') !== -1 || name.indexOf('行船') !== -1;
  var isCircular = id.indexOf('circular') !== -1 || id.indexOf('ring') !== -1 || name.indexOf('环形') !== -1 || name.indexOf('跑道') !== -1;
  var isAverage = id.indexOf('average-speed') !== -1 || name.indexOf('平均速度') !== -1;
  var isRatio = id.indexOf('ratio-motion') !== -1 || name.indexOf('比例行程') !== -1;
  var isInterval = id.indexOf('interval') !== -1 || name.indexOf('发车间隔') !== -1 || name.indexOf('间隔') !== -1;
  var isPickup = id.indexOf('pick-up') !== -1 || id.indexOf('pickup') !== -1 || name.indexOf('接送') !== -1;
  var isComplex = id.indexOf('complex') !== -1 || id.indexOf('competition') !== -1 || name.indexOf('综合') !== -1;
  var isBasic = id.indexOf('basic') !== -1 || name.indexOf('基本行程') !== -1;

  var prompt, answer, steps;

  if (isWork) {
    
    var pairs = [[6, 3], [12, 6], [10, 15], [8, 8], [20, 30], [12, 4]];
    var wp = pairs[Rng.randInt(rng, 0, pairs.length - 1)];
    var a = wp[0], b = wp[1];
    var together = a * b / (a + b);
    prompt = '一项工程，甲队单独做需要 ' + a + ' 天完成，乙队单独做需要 ' + b + ' 天完成。'
      + '如果两队合作，多少天可以完成？';
    answer = together;
    steps = 3;
  } else if (isConcentration) {
    
    var solution = [200, 300, 400, 500][Rng.randInt(rng, 0, 3)];
    var pct = [10, 15, 20, 25][Rng.randInt(rng, 0, 3)];
    var salt = solution * pct / 100;
    prompt = '现有 ' + solution + ' 克盐水，浓度为 ' + pct + '%。这杯盐水中含盐多少克？';
    answer = salt;
    steps = 2;
  } else if (isMeet) {
    
    var v1 = Rng.randInt(rng, 4, 8) * 10;   
    var v2 = Rng.randInt(rng, 4, 8) * 10;
    var t = Rng.randInt(rng, 2, 5);
    var dist = (v1 + v2) * t;
    prompt = '甲、乙两车分别从相距 ' + dist + ' 千米的两地同时出发，相向而行。'
      + '甲车每小时行 ' + v1 + ' 千米，乙车每小时行 ' + v2 + ' 千米。两车经过几小时相遇？';
    answer = t;
    steps = 2;
  } else if (isChase) {
    
    var vf = Rng.randInt(rng, 6, 9) * 10;
    var vs = Rng.randInt(rng, 3, 5) * 10;
    var ct = Rng.randInt(rng, 2, 5);
    var gap = (vf - vs) * ct;
    prompt = '弟弟以每小时 ' + vs + ' 千米的速度先出发，哥哥在距弟弟 ' + gap + ' 千米处骑自行车追赶，'
      + '哥哥每小时行 ' + vf + ' 千米。哥哥几小时后追上弟弟？';
    answer = ct;
    steps = 2;
  } else if (isTrain) {
    
    var trainLen = [150, 180][Rng.randInt(rng, 0, 1)];
    var bridgeLen = [300, 450, 600][Rng.randInt(rng, 0, 2)];
    var speed = 15; 
    var total = trainLen + bridgeLen;
    var tt = total / speed;
    prompt = '一列火车长 ' + trainLen + ' 米，以每秒 ' + speed + ' 米的速度通过一座长 ' + bridgeLen + ' 米的大桥。'
      + '从车头上桥到车尾离桥，一共需要多少秒？';
    answer = tt;
    steps = 2;
  } else if (isBoat) {
    
    var vb = Rng.randInt(rng, 20, 30);   
    var vw = Rng.randInt(rng, 3, 6);     
    var down = vb + vw;
    var bd = down * Rng.randInt(rng, 2, 4);
    var bt = bd / down;
    prompt = '一艘轮船在静水中每小时行 ' + vb + ' 千米，水流速度为每小时 ' + vw + ' 千米。'
      + '这艘船顺水航行 ' + bd + ' 千米，需要多少小时？';
    answer = bt;
    steps = 2;
  } else if (isCircular) {
    
    var sp1 = Rng.randInt(rng, 3, 6) * 10;   
    var sp2 = Rng.randInt(rng, 2, 4) * 10;   
    var ctime0 = Rng.randInt(rng, 2, 4);     
    var circ = (sp1 + sp2) * ctime0;
    prompt = '甲、乙两人在周长 ' + circ + ' 米的环形跑道上从同一地点同时出发，背向而行。'
      + '甲每分钟跑 ' + sp1 + ' 米，乙每分钟跑 ' + sp2 + ' 米。两人经过多少分钟第一次相遇？';
    answer = ctime0;
    steps = 2;
  } else if (isAverage) {
    
    var av1 = 30, av2 = 60;
    var avg = 2 * av1 * av2 / (av1 + av2);
    prompt = '小明骑车从家到书店，去时每小时行 ' + av1 + ' 千米，沿原路返回时每小时行 ' + av2 + ' 千米。'
      + '求小明往返的平均速度。';
    answer = avg;
    steps = 3;
  } else if (isRatio) {
    
    prompt = '走同一段路，甲、乙两人的速度比是 3:2。甲走完全程用了 4 小时，乙走完全程需要多少小时？';
    answer = 6; 
    steps = 3;
  } else if (isInterval) {
    
    prompt = '一条公交线路上，公交车每隔 6 分钟发一班，车速为每分钟 500 米。'
      + '小明沿公交线路以每分钟 100 米的速度与公交车同向步行。'
      + '每隔多少分钟会有一辆公交车从身后追上小明？';
    
    answer = 7.5;
    steps = 3;
  } else if (isPickup) {
    
    prompt = '汽车送一批人去机场，去程每小时行 60 千米，返程（空车）每小时行 90 千米，往返共用 5 小时（不含上下车时间）。'
      + '出发点到机场的距离是多少千米？';
    
    answer = 180;
    steps = 3;
  } else if (isComplex || isBasic) {
    
    var bv = Rng.randInt(rng, 5, 9) * 10;
    var bt2 = Rng.randInt(rng, 2, 6);
    var bd2 = bv * bt2;
    if (isComplex) {
      prompt = '一辆汽车从甲地开往乙地，前 ' + (bt2 - 1) + ' 小时每小时行 ' + bv + ' 千米，'
        + '最后 1 小时又行了 ' + bv + ' 千米正好到达。甲、乙两地相距多少千米？';
      answer = bv * bt2;
    } else {
      prompt = '一列火车以每小时 ' + bv + ' 千米的速度行驶，' + bt2 + ' 小时可以行驶多少千米？';
      answer = bd2;
    }
    steps = 2;
  } else {
    
    var gv = Rng.randInt(rng, 5, 9) * 10;
    var gt = Rng.randInt(rng, 2, 5);
    prompt = name + '：一辆车以每小时 ' + gv + ' 千米的速度行驶 ' + gt + ' 小时，共行驶多少千米？';
    answer = gv * gt;
    steps = 2;
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'apply',
      steps: steps,
      questionType: plan.questionTypeId,
      family: 'c5-c6-journey-engineering'
    }
  };
}

var C5C6_KPS = [
  
  'math-g4-c5-c5-basic',
  'math-g4-c5-c5-meet',
  'math-g4-c5-c5-chase',
  'math-g4-c5-c5-train',
  'math-g4-c5-c5-river',
  
  'math-g5-c5-basic-motion',
  'math-g5-c5-meet-problem',
  'math-g5-c5-chase-problem',
  'math-g5-c5-train-bridge',
  'math-g5-c5-boat-stream',
  'math-g5-c5-circular-track',
  'math-g5-c5-average-speed',
  'math-g5-c5-ratio-motion',
  
  'math-g5-c6-work-problem',
  'math-g5-c6-concentration-problem',
  
  'math-g6-c5-basic',
  'math-g6-c5-meet',
  'math-g6-c5-chase',
  'math-g6-c5-train-bridge',
  'math-g6-c5-boat-stream',
  'math-g6-c5-ring-runway',
  'math-g6-c5-journey-complex',
  'math-g6-c5-competition',
  'math-g6-c5-interval-departure',
  'math-g6-c5-pick-up-problem',
  
  'math-g6-c6-work-problem',
  'math-g6-c6-concentration-problem'
];

function createJourneyEngineeringGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c5-c6-journey-engineering';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || C5C6_KPS,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));

      for (var i = 0; i < count; i++) {
        questions.push(makeQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createJourneyEngineeringGenerator({
      id: 'generator:c5-c6-journey-engineering',
      knowledgePoints: C5C6_KPS
    })
  ];
}

module.exports = {
  C5C6_KPS: C5C6_KPS,
  createJourneyEngineeringGenerator: createJourneyEngineeringGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/c7-clever-calc.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':c7:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':c7:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':c7:' + i;
}

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }


function frac(n, d) {
  if (d < 0) { n = -n; d = -d; }
  var g = gcd(n, d);
  n /= g; d /= g;
  return d === 1 ? String(n) : n + '/' + d;
}

function makeQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = (kp && kp.identity && kp.identity.name) || (kp && kp.name) || '巧算';
  var id = (kp && (kp.identity && kp.identity.id)) || (kp && kp.id) || '';

  
  var isExtract = id.indexOf('extract') !== -1 || name.indexOf('提取公因数') !== -1 || name.indexOf('公因数') !== -1;
  var isRounding = id.indexOf('rounding') !== -1 || name.indexOf('凑整') !== -1;
  var isFracSplit = id.indexOf('fraction-splitting') !== -1 || name.indexOf('分数裂项') !== -1;
  var isIntSplit = id.indexOf('integer-splitting') !== -1 || name.indexOf('整数裂项') !== -1;
  var isSeries = id.indexOf('arithmetic-series') !== -1 || name.indexOf('等差数列') !== -1;
  var isRecurring = id.indexOf('recurring') !== -1 || name.indexOf('循环小数') !== -1;
  var isDefineOp = id.indexOf('define-operation') !== -1 || name.indexOf('定义新运算') !== -1 || name.indexOf('新运算') !== -1;
  var isEstimate = id.indexOf('estimate') !== -1 || name.indexOf('估算') !== -1 || name.indexOf('放缩') !== -1;
  var isComplexFrac = id.indexOf('complex-fraction') !== -1 || name.indexOf('繁分数') !== -1;
  var isSeqSum = id.indexOf('sequence-sum') !== -1 || name.indexOf('数列求和') !== -1 || name.indexOf('平方和') !== -1 || name.indexOf('立方和') !== -1;

  var prompt, answer, steps;

  if (isExtract) {
    
    var c = [25, 28, 36, 48][Rng.randInt(rng, 0, 3)];
    var a = Rng.randInt(rng, 20, 80);
    var b = 100 - a;
    prompt = '用简便方法计算：' + a + '×' + c + ' + ' + b + '×' + c;
    answer = (a + b) * c;
    steps = 2;
  } else if (isRounding) {
    
    var nines = [9, 99, 999, 9999];
    var sum = nines.reduce(function (s, x) { return s + x; }, 0);
    prompt = '用凑整法巧算：' + nines.join(' + ');
    answer = sum;
    steps = 2;
  } else if (isFracSplit) {
    
    var n = Rng.randInt(rng, 3, 5);
    var terms = [];
    for (var k = 1; k <= n; k++) terms.push('1/(' + k + '×' + (k + 1) + ')');
    prompt = '用裂项法计算：' + terms.join(' + ');
    answer = frac(n, n + 1);
    steps = 3;
  } else if (isIntSplit) {
    
    var m = Rng.randInt(rng, 3, 5);
    var iterms = [];
    for (var k2 = 1; k2 <= m; k2++) iterms.push(k2 + '×' + (k2 + 1));
    prompt = '用裂项法计算：' + iterms.join(' + ');
    answer = m * (m + 1) * (m + 2) / 3;
    steps = 3;
  } else if (isSeries) {
    
    var last = Rng.randInt(rng, 20, 100);
    prompt = '计算等差数列之和：1 + 2 + 3 + … + ' + last;
    answer = last * (last + 1) / 2;
    steps = 2;
  } else if (isRecurring) {
    
    prompt = '把循环小数化成分数：0.333…（3 循环）';
    answer = frac(1, 3);
    steps = 2;
  } else if (isDefineOp) {
    
    var x = Rng.randInt(rng, 2, 9);
    var y = Rng.randInt(rng, 2, 9);
    prompt = '定义新运算：a※b = 2a + b。求 ' + x + '※' + y + ' 的值。';
    answer = 2 * x + y;
    steps = 2;
  } else if (isEstimate) {
    
    var eSum = 1 / 2 + 1 / 3 + 1 / 4;
    prompt = '估算（写出整数部分）：1/2 + 1/3 + 1/4 的结果的整数部分是多少？';
    answer = Math.floor(eSum);
    steps = 2;
  } else if (isComplexFrac) {
    
    var n1 = 1, d1 = 2, n2 = 3, d2 = 4;
    prompt = '化简繁分数：(1/2) ÷ (3/4)';
    answer = frac(n1 * d2, d1 * n2);
    steps = 2;
  } else if (isSeqSum) {
    
    var s = Rng.randInt(rng, 3, 5);
    var sterms = [];
    for (var k3 = 1; k3 <= s; k3++) sterms.push(k3 + '²');
    prompt = '用公式计算平方和：' + sterms.join(' + ');
    answer = s * (s + 1) * (2 * s + 1) / 6;
    steps = 3;
  } else {
    
    var ga = Rng.randInt(rng, 2, 9);
    var gb = Rng.randInt(rng, 2, 9);
    prompt = name + '：用简便方法计算 ' + ga + ' × 25 × 4';
    answer = ga * 25 * 4;
    steps = 2;
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'calc',
      steps: steps,
      questionType: plan.questionTypeId,
      family: 'c7-clever-calc'
    }
  };
}

var C7_KPS = [
  
  'math-g5-c7-extract-common-factor',
  'math-g5-c7-rounding-calc',
  'math-g5-c7-fraction-splitting',
  'math-g5-c7-integer-splitting',
  'math-g5-c7-arithmetic-series',
  'math-g5-c7-recurring-decimal-frac',
  'math-g5-c7-define-operation',
  'math-g5-c7-estimate-bounds',
  'math-g5-c7-complex-fraction',
  
  'math-g6-c7-extract-common-factor',
  'math-g6-c7-rounding-calc',
  'math-g6-c7-fraction-splitting',
  'math-g6-c7-integer-splitting',
  'math-g6-c7-arithmetic-series',
  'math-g6-c7-recurring-decimal-frac',
  'math-g6-c7-define-operation',
  'math-g6-c7-estimate-bounds',
  'math-g6-c7-complex-fraction',
  'math-g6-c7-sequence-sum'
];

function createC7Generator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c7-clever-calc';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || C7_KPS,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));

      for (var i = 0; i < count; i++) {
        questions.push(makeQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createC7Generator({
      id: 'generator:c7-clever-calc',
      knowledgePoints: C7_KPS
    })
  ];
}

module.exports = {
  C7_KPS: C7_KPS,
  createC7Generator: createC7Generator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/c9-comprehensive.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var KP = require("shared/knowledge-point.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':c9:' + i;
  
  
  if (plan && plan.seed != null) return plan.seed + ':c9:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':c9:' + i;
}

function makeQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = (kp && kp.identity && kp.identity.name) || (kp && kp.name) || '综合应用';
  var id = (kp && (kp.identity && kp.identity.id)) || (kp && kp.id) || '';

  
  var isSumDiff = id.indexOf('sum-diff') !== -1 || name.indexOf('和差') !== -1 || name.indexOf('和倍') !== -1;
  var isAge = id.indexOf('age') !== -1 || name.indexOf('年龄') !== -1;
  var isProfitLoss = id.indexOf('profit-loss') !== -1 || name.indexOf('盈亏') !== -1;
  var isChicken = id.indexOf('chicken') !== -1 || name.indexOf('鸡兔') !== -1;
  var isAverage = id.indexOf('average') !== -1 || name.indexOf('平均数') !== -1;
  var isPlanting = id.indexOf('planting') !== -1 || name.indexOf('植树') !== -1;
  var isPhalanx = id.indexOf('phalanx') !== -1 || name.indexOf('方阵') !== -1;
  var isPeriodic = id.indexOf('periodic') !== -1 || name.indexOf('周期') !== -1;
  var isGrass = id.indexOf('grass') !== -1 || name.indexOf('牛吃草') !== -1;
  var isFracPct = id.indexOf('fraction-percent') !== -1 || name.indexOf('分数百分数') !== -1;
  var isEconomics = id.indexOf('economics') !== -1 || name.indexOf('经济') !== -1;
  var isInclusion = id.indexOf('inclusion-exclusion') !== -1 || name.indexOf('容斥') !== -1;
  var isEq2 = id.indexOf('equation-linear-2') !== -1 || name.indexOf('二元') !== -1;
  var isEq1 = id.indexOf('equation-linear-1') !== -1 || name.indexOf('一元一次') !== -1;
  var isDiophantine = id.indexOf('diophantine') !== -1 || name.indexOf('不定方程') !== -1;
  var isRatio = id.indexOf('ratio-application') !== -1 || id.indexOf('ratio') !== -1 || name.indexOf('比例应用') !== -1;
  var isMixture = id.indexOf('mixture') !== -1 || name.indexOf('混合') !== -1;
  var isMisc = id.indexOf('misc') !== -1 || name.indexOf('杂题') !== -1 || name.indexOf('统筹') !== -1;
  var isMock = id.indexOf('mock') !== -1 || name.indexOf('模拟') !== -1;
  var isIntegrated = id.indexOf('integrated') !== -1 || name.indexOf('综合应用') !== -1;

  var prompt, answer, steps;

  if (isSumDiff) {
    
    prompt = '甲、乙两数的和是 48，甲数是乙数的 3 倍。乙数是多少？';
    answer = 12;
    steps = 2;
  } else if (isAge) {
    
    prompt = '爸爸今年 40 岁，儿子今年 12 岁。多少年后爸爸的年龄正好是儿子的 2 倍？';
    answer = 16;
    steps = 3;
  } else if (isProfitLoss) {
    
    prompt = '幼儿园分苹果：如果每人分 3 个，则多出 7 个；如果每人分 4 个，则还差 5 个。'
      + '幼儿园一共有多少个小朋友？';
    answer = 12;
    steps = 3;
  } else if (isChicken) {
    
    prompt = '鸡兔同笼，共有 20 个头、56 只脚。笼中兔子有多少只？';
    answer = 8;
    steps = 3;
  } else if (isAverage) {
    
    prompt = '小明三次数学测验的平均分是 18 分（满分 20），前两次分别得 15 分和 20 分。'
      + '第三次测验得了多少分？';
    answer = 19;
    steps = 2;
  } else if (isPlanting) {
    
    prompt = '在一条长 100 米的小路一旁植树，每隔 5 米栽一棵，两端都要栽。一共要栽多少棵树？';
    answer = 21;
    steps = 2;
  } else if (isPhalanx) {
    
    prompt = '同学们排成一个实心方阵，最外层每边有 8 人。最外层一共有多少人？';
    answer = 28;
    steps = 2;
  } else if (isPeriodic) {
    
    prompt = '节日彩灯按「红、黄、蓝」的顺序循环排列。第 30 盏灯是什么颜色？';
    answer = '蓝';
    steps = 2;
  } else if (isGrass) {
    
    prompt = '一片牧场的草均匀生长。可供 10 头牛吃 20 天，或供 15 头牛吃 10 天。'
      + '照此计算，可供 25 头牛吃多少天？';
    answer = 5;
    steps = 4;
  } else if (isFracPct) {
    
    prompt = '小明读一本书，第一天读了全书的 1/4，第二天读了全书的 1/3，还剩 50 页没读。'
      + '这本书一共有多少页？';
    answer = 120;
    steps = 3;
  } else if (isEconomics) {
    
    prompt = '一件商品进价 80 元，标价 120 元。商店按标价打八折出售，每件可获利多少元？';
    answer = 16;
    steps = 2;
  } else if (isInclusion) {
    
    var total = 40, aN = 20, bN = 18, cN = 16, ab = 8, ac = 7, bc = 6, abc = 3;
    prompt = '某班 40 人，参加数学小组 20 人、英语小组 18 人、科学小组 16 人；'
      + '同时参加数学和英语的 8 人，数学和科学的 7 人，英语和科学的 6 人；三个小组都参加的 3 人。'
      + '三个小组都没参加的有多少人？';
    answer = total - (aN + bN + cN - ab - ac - bc + abc);
    steps = 3;
  } else if (isEq2) {
    
    prompt = '已知甲、乙两数之和是 10，甲数比乙数大 4。甲数是多少？';
    answer = 7;
    steps = 2;
  } else if (isEq1) {
    
    prompt = '一个数的 3 倍加上 5 等于 20。这个数是多少？（列方程解答）';
    answer = 5;
    steps = 2;
  } else if (isDiophantine) {
    
    prompt = '求方程 3x + 2y = 17 的正整数解一共有多少组？';
    answer = 3;
    steps = 3;
  } else if (isRatio) {
    
    prompt = '把 100 元奖金按 2:3:5 的比例分给甲、乙、丙三人。丙分得多少元？';
    answer = 50;
    steps = 2;
  } else if (isMixture) {
    
    prompt = '把 300 克浓度 20% 的盐水和 200 克浓度 30% 的盐水混合。混合后盐水的浓度是百分之多少？';
    answer = 24;
    steps = 3;
  } else if (isMisc) {
    
    prompt = '一口平底锅每次最多能烙 2 张饼，每张饼两面都要烙，每面需 3 分钟。'
      + '烙熟 3 张饼最少需要多少分钟？';
    answer = 9;
    steps = 3;
  } else if (isMock || isIntegrated) {
    
    prompt = '商店运来苹果和梨共 120 千克，其中苹果的质量是梨的 3 倍。梨有多少千克？';
    answer = 30;
    steps = 2;
  } else {
    
    var ga = Rng.randInt(rng, 2, 9);
    prompt = name + '：甲、乙两数的和是 ' + (ga * 4) + '，甲数是乙数的 3 倍，乙数是多少？';
    answer = ga;
    steps = 2;
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'apply',
      steps: steps,
      questionType: plan.questionTypeId,
      family: 'c9-comprehensive'
    }
  };
}

var C9_KPS = [
  
  'math-g4-c9-c9-integrated',
  'math-g4-c9-c9-misc',
  'math-g4-c9-c9-mock',
  
  'math-g5-c9-sum-diff-problem',
  'math-g5-c9-age-problem',
  'math-g5-c9-profit-loss-problem',
  'math-g5-c9-chicken-rabbit',
  'math-g5-c9-average-problem',
  'math-g5-c9-planting-problem',
  'math-g5-c9-phalanx-problem',
  'math-g5-c9-periodic-problem',
  'math-g5-c9-grass-problem',
  'math-g5-c9-fraction-percent-application',
  'math-g5-c9-economics-problem',
  'math-g5-c9-inclusion-exclusion',
  'math-g5-c9-equation-linear-1',
  'math-g5-c9-equation-linear-2',
  'math-g5-c9-diophantine-equation',
  
  'math-g6-c9-sum-diff-problem',
  'math-g6-c9-age-problem',
  'math-g6-c9-profit-loss-problem',
  'math-g6-c9-chicken-rabbit',
  'math-g6-c9-average-problem',
  'math-g6-c9-planting-problem',
  'math-g6-c9-phalanx-problem',
  'math-g6-c9-periodic-problem',
  'math-g6-c9-grass-problem',
  'math-g6-c9-fraction-percent-application',
  'math-g6-c9-economics-problem',
  'math-g6-c9-equation-linear-1',
  'math-g6-c9-equation-linear-2',
  'math-g6-c9-inclusion-exclusion',
  'math-g6-c9-ratio-application',
  'math-g6-c9-mixture-problem'
];

function createC9Generator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c9-comprehensive';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc', 'open'],
    questionTypes: ['apply', 'calc', 'open'],
    knowledgePoints: spec.knowledgePoints || C9_KPS,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));

      for (var i = 0; i < count; i++) {
        questions.push(makeQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createC9Generator({
      id: 'generator:c9-comprehensive',
      knowledgePoints: C9_KPS
    })
  ];
}

module.exports = {
  C9_KPS: C9_KPS,
  createC9Generator: createC9Generator,
  buildAll: buildAll
};

};
__defs["shared/knowledge-operation.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var VERSION = 1;

  var OPERATIONS = {
    add:        { id: 'add',        name: '加法',         description: '执行加法运算',            category: 'arithmetic' },
    subtract:   { id: 'subtract',   name: '减法',         description: '执行减法运算',            category: 'arithmetic' },
    multiply:   { id: 'multiply',   name: '乘法',         description: '执行乘法运算',            category: 'arithmetic' },
    divide:     { id: 'divide',     name: '除法',         description: '执行除法运算',            category: 'arithmetic' },
    calculate:  { id: 'calculate',  name: '计算',         description: '进行数值计算',            category: 'arithmetic' },

    compare:    { id: 'compare',    name: '比较',         description: '比较大小/多少/关系',      category: 'comparison' },
    order:      { id: 'order',      name: '排序',         description: '按规则排序/排列',         category: 'comparison' },

    compose:    { id: 'compose',    name: '组合',         description: '组合/合成整体',           category: 'composition' },
    decompose:  { id: 'decompose',  name: '分解',         description: '分解/拆分',               category: 'composition' },

    measure:    { id: 'measure',    name: '度量',         description: '测量/量化',               category: 'measurement' },
    convert:    { id: 'convert',    name: '换算',         description: '单位/形式换算',           category: 'measurement' },

    identify:   { id: 'identify',   name: '识别',         description: '识别/辨认对象或属性',     category: 'classification' },
    classify:   { id: 'classify',   name: '分类',         description: '分类/归类',               category: 'classification' },

    read:       { id: 'read',       name: '认读',         description: '认读/阅读符号文字',       category: 'literacy' },
    write:      { id: 'write',      name: '书写',         description: '书写/表达',               category: 'literacy' },

    reason:     { id: 'reason',     name: '推理',         description: '逻辑推理',                category: 'cognition' },
    represent:  { id: 'represent',  name: '表征',         description: '用图/式/模型表征',        category: 'cognition' },
    model:      { id: 'model',      name: '建模',         description: '建立模型解决问题',        category: 'cognition' }
  };

  var ALIASES = {
    addition: 'add', plus: 'add', sum: 'add', 加: 'add', 加法: 'add', calcadd: 'add', 'add-operation': 'add',
    subtraction: 'subtract', minus: 'subtract', 减: 'subtract', 减法: 'subtract', sub: 'subtract',
    multiplication: 'multiply', 乘: 'multiply', 乘法: 'multiply', mult: 'multiply',
    division: 'divide', 除: 'divide', 除法: 'divide', div: 'divide',
    比较: 'compare', 比大小: 'compare', comparison: 'compare', 对比: 'compare',
    排序: 'order', 顺序: 'order', sort: 'order', 排列: 'order',
    组合: 'compose', 合成: 'compose', 合并: 'compose',
    分解: 'decompose', 拆分: 'decompose',
    测量: 'measure', 度量: 'measure',
    换算: 'convert', 转换: 'convert',
    识别: 'identify', 辨认: 'identify', 认: 'identify',
    分类: 'classify', 归类: 'classify',
    读: 'read', 认读: 'read',
    写: 'write', 书写: 'write',
    计算: 'calculate', compute: 'calculate', calc: 'calculate',
    推理: 'reason', 逻辑: 'reason',
    表示: 'represent', 表征: 'represent',
    建模: 'model'
  };

  function isCanonical(id) {
    return OPERATIONS.hasOwnProperty(id);
  }

  function normalize(raw) {
    if (raw == null) return { canonical: null, status: 'unresolved' };
    var s = String(raw).trim();
    if (isCanonical(s)) return { canonical: s, status: 'canonical' };
    if (ALIASES.hasOwnProperty(s)) return { canonical: ALIASES[s], status: 'alias' };
    return { canonical: null, status: 'unresolved' };
  }

  function hasAliasCycle() {
    var visited = {}, inStack = {};
    var keys = Object.keys(ALIASES);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (visited[k]) continue;
      var chain = [], cur = k;
      while (cur != null) {
        if (inStack[cur]) return true;
        if (visited[cur]) break;
        inStack[cur] = true; visited[cur] = true; chain.push(cur);
        cur = ALIASES[cur];
        if (cur != null && isCanonical(cur)) break;
      }
      inStack = {};
    }
    return false;
  }

  var API = {
    VERSION: VERSION,
    OPERATIONS: OPERATIONS,
    ALIASES: ALIASES,
    CANONICAL_IDS: Object.keys(OPERATIONS),
    isCanonical: isCanonical,
    normalize: normalize,
    hasAliasCycle: hasAliasCycle
  };

  global.KnowledgeOperation = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/ontology-operation-map.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var Ops = require("shared/knowledge-operation.js");

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
    'math-competition-g6-c9': { ops: ['reason', 'model', 'calculate'], confidence: 'medium', evidence: 'plugin-name' }
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

};
__defs["shared/knowledge-factual.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var VERSION = 1;

  var FACT_TYPES = [
    'formula', 'rule', 'concept', 'vocabulary', 'unit', 'table',
    'classification', 'relationship', 'notation', 'range', 'system', 'count', 'alphabet'
  ];

  var STRATEGY_FIELDS = [
    'questionCount', 'preferredDifficulty', 'adaptiveDelta', 'userMastery',
    'nextQuestion', 'generationOrder', 'randomSeed', 'difficulty', 'useContext'
  ];

  function isFactualType(k) { return FACT_TYPES.indexOf(k) !== -1; }

  function validate(fc) {
    var errors = [], warnings = [];
    if (fc == null) return { valid: true, errors: errors, warnings: warnings };
    if (typeof fc !== 'object' || Array.isArray(fc)) {
      errors.push('factualContent 必须是对象');
      return { valid: false, errors: errors, warnings: warnings };
    }
    Object.keys(fc).forEach(function (k) {
      if (STRATEGY_FIELDS.indexOf(k) !== -1) {
        errors.push('策略字段混入 factualContent: ' + k);
      } else if (!isFactualType(k)) {
        warnings.push('未声明 fact type: ' + k);
      }
    });
    return { valid: errors.length === 0, errors: errors, warnings: warnings };
  }

  var API = {
    VERSION: VERSION,
    FACT_TYPES: FACT_TYPES,
    STRATEGY_FIELDS: STRATEGY_FIELDS,
    isFactualType: isFactualType,
    validate: validate
  };

  global.KnowledgeFactual = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/ontology-factual-map.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var FactOnt = require("shared/knowledge-factual.js");

  var MAP = {
    'math-g1-multiplication-table': {
      factualContent: { table: '1-9' },
      confidence: 'high', evidence: 'plugin-name'
    },
    'math-money': {
      factualContent: { units: ['元', '角', '分'] },
      confidence: 'high', evidence: 'standard-curriculum'
    },
    'math-unit-convert': {
      factualContent: { units: ['cm', 'm', 'km', 'g', 'kg', 'mL', 'L'] },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-fraction': {
      factualContent: { notation: 'a/b', concept: '整体的一部分' },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-decimal': {
      factualContent: { notation: '十进制小数' },
      confidence: 'low', evidence: 'standard-curriculum'
    },
    'math-clock': {
      factualContent: { unit: '小时', subUnits: ['分', '秒'], notation: 'hh:mm' },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-time-date': {
      factualContent: { units: ['年', '月', '日', '时', '分', '秒'], dayHours: 24, weekDays: 7 },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-shapes': {
      factualContent: { categories: ['平面图形', '立体图形'] },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-geometry': {
      factualContent: { categories: ['点', '线', '角', '面', '体'] },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-area': {
      factualContent: { formulas: { rectangle: '长×宽', square: '边长×边长' } },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-combination-set': {
      factualContent: { concept: '排列与组合' },
      confidence: 'low', evidence: 'standard-curriculum'
    }
  };

  function factualForPlugin(pluginId) {
    var e = pluginId && MAP[pluginId];
    if (!e) return {};
    return e.factualContent;
  }

  function metaForPlugin(pluginId) {
    return pluginId && MAP[pluginId] ? MAP[pluginId] : null;
  }

  var API = { MAP: MAP, factualForPlugin: factualForPlugin, metaForPlugin: metaForPlugin };

  global.OntologyFactualMap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/knowledge-error.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var VERSION = 1;

  var ERROR_CATEGORIES = [
    'concept', 'operation', 'calculation', 'notation',
    'unit', 'reading', 'writing', 'structure', 'reasoning', 'attention'
  ];

  var ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
  var FORBIDDEN_RE = /(plugin|question|error-[0-9]|math-g|cn-|en-)/;

  function isCategory(c) { return ERROR_CATEGORIES.indexOf(c) !== -1; }

  function isValidId(id) {
    if (typeof id !== 'string' || !ID_RE.test(id)) return false;
    if (FORBIDDEN_RE.test(id)) return false;
    return true;
  }

  function normalizeError(e) {
    if (typeof e === 'string') return { id: e, category: null, description: e };
    if (e && typeof e === 'object') return { id: e.id, category: e.category || null, description: e.description || '' };
    return null;
  }

  function validate(errors) {
    var errs = [], warns = [];
    if (!Array.isArray(errors)) {
      errs.push('errors 必须是数组');
      return { valid: false, errors: errs, warnings: warns };
    }
    var seen = {};
    errors.forEach(function (raw) {
      var e = normalizeError(raw);
      if (!e || !e.id) { errs.push('error 缺少合法 id'); return; }
      if (!isValidId(e.id)) errs.push('非法 error id: ' + e.id);
      if (seen[e.id]) errs.push('重复 error id: ' + e.id);
      seen[e.id] = 1;
      if (!e.description) errs.push('error 缺少 description: ' + e.id);
      if (e.category && !isCategory(e.category)) errs.push('未知 error category: ' + e.category);
    });
    return { valid: errs.length === 0, errors: errs, warnings: warns };
  }

  var API = {
    VERSION: VERSION,
    ERROR_CATEGORIES: ERROR_CATEGORIES,
    isCategory: isCategory,
    isValidId: isValidId,
    normalizeError: normalizeError,
    validate: validate
  };

  global.KnowledgeError = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/ontology-error-map.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var MAP = {
    'math-make-ten': [
      { id: 'borrow-omission', category: 'calculation', description: '退位减法遗漏退位' }
    ],
    'math-g2-column': [
      { id: 'carry-omission', category: 'calculation', description: '进位遗漏' },
      { id: 'digit-alignment-error', category: 'notation', description: '数位未对齐' }
    ],
    'math-g2-mixed': [
      { id: 'carry-omission', category: 'calculation', description: '进位遗漏' },
      { id: 'borrow-omission', category: 'calculation', description: '退位遗漏' }
    ],
    'math-g4-vertical': [
      { id: 'carry-omission', category: 'calculation', description: '进位遗漏' }
    ],
    'math-g5-vertical': [
      { id: 'carry-omission', category: 'calculation', description: '进位遗漏' }
    ],
    'math-unit-convert': [
      { id: 'unit-confusion', category: 'unit', description: '单位混淆/进率错误' }
    ],
    'math-money': [
      { id: 'unit-confusion', category: 'unit', description: '人民币单位混淆' }
    ],
    'math-fraction': [
      { id: 'denominator-confusion', category: 'concept', description: '分子/分母混淆' }
    ],
    'math-decimal': [
      { id: 'decimal-point-error', category: 'notation', description: '小数点位置错误' }
    ],
    'math-g1-multiplication-table': [
      { id: 'multiplication-fact-confusion', category: 'operation', description: '乘法口诀混淆' }
    ]
  };

  function errorsForPlugin(pluginId) {
    var e = pluginId && MAP[pluginId];
    return e ? e.slice() : [];
  }

  function metaForPlugin(pluginId) {
    return pluginId && MAP[pluginId] ? { count: MAP[pluginId].length } : null;
  }

  var API = { MAP: MAP, errorsForPlugin: errorsForPlugin, metaForPlugin: metaForPlugin };

  global.OntologyErrorMap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/ontology-category-map.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var CATEGORIES = ['algebra', 'measurement', 'geometry', 'synthesis'];

  

  
  var GEOM_ID = /(^|-)c4-|geom(?:etry|count|etric)|solid|flat-shape|shape|count-graph|angle|protractor|quad|tri(?!ple)|circle|cyl(?:inder)?|cone(?!centration)|perimeter|(?:^|-)area|lattice|pythagorean|painted-cube|transform|(?:^|-)sym|symmet|rotat|draw-move|(?:^|-)motion|draw-net|grid|draw-view|draw-observe|position|coord|(?:^|-)pa(?:-|$)|draw-para|(?:^|-)line(?:-|$)|draw-height/;

  
  var MEAS_ID = /(^|-)(rmb|money|clock|time|year-month|length|mass|weight|measure|unit-convert|match-unit|fill-(?:length|mass|time)|length-(?:unit|app)|mass-(?:unit|app)|time-unit|hectare)(-|$)/;

  
  var STATS_ID = /(^|-)(stats?|data-tally|data-question|possib\w*|possible|pie-chart|linechart|stats-line\d|match-chart|judge-chart|choice-chart|pic-pie-chart|stat-pie-chart|stat-possibility|fill-pie-chart|fill-linechart|fill-possible|word-possib|word-linechart|stats-bar|stats-double|stats-avg|stats-table|stats-possib\w*|stats-line\d|fill-avg|word-avg)(-|$)/;

  var GEOM_NAME = /图形|角[的度类型与]|量角|画角|角度|线段(?!图)|射线|直线|平行|垂直|梯形|三角形|长方|正方|圆[的周角]?|圆柱|圆锥|周长|面积|体积|表面积|展开图|对称|平移|旋转|放大|缩小|位置|方向|数对|观察物体|几何|勾股|扇形|格点|鸟头|蝴蝶|燕尾|等积|割补|涂色|棱[，、]|锥[体]/;

  var MEAS_NAME = /人民币|元角分|钟面|钟表|时、分、秒|时分秒|时间单位|长度单位|质量单位|面积单位|体积单位|容积单位|单位换算|填合适[^，。]*单位|单位与物品|测量|公顷|平方千米|年、月、日|长度|质量|重量/;

  
  function deriveCategory(kp) {
    var id = (kp && kp.id ? String(kp.id) : '').toLowerCase();
    var name = (kp && kp.name ? String(kp.name) : '') || '';

    
    
    if (/(判断|选择)题综合|综合应用|杂题选讲|模拟竞赛/.test(name)) return 'synthesis';
    if (/购物/.test(name) || /(?:^|-)shopping(?:-|$)/.test(id)) return 'synthesis';

    
    if (STATS_ID.test(id) || /统计|可能性|平均数|折线|条形统计图?|扇形统计图?|数据收集/.test(name)) {
      return null;
    }

    
    if (/reason-number-shape/.test(id)) return 'algebra';
    
    if (/(^|-)c4-/.test(id)) return 'geometry';
    
    if (/(^|-)(geomcount|geometry-counting)/.test(id)) return 'geometry';
    
    if (/(^|-)c5-/.test(id)) return 'algebra';
    
    if (/(^|-)c8-/.test(id)) return 'algebra';
    
    if (/线段图/.test(name)) return 'algebra';

    if (GEOM_ID.test(id)) return 'geometry';
    if (MEAS_ID.test(id)) return 'measurement';

    if (GEOM_NAME.test(name)) return 'geometry';
    if (MEAS_NAME.test(name)) return 'measurement';

    
    return 'algebra';
  }

  
  function categoryForKp(kp) {
    if (!kp) return null;
    if (typeof kp.category === 'string' && CATEGORIES.indexOf(kp.category) !== -1) {
      return kp.category;
    }
    return deriveCategory(kp);
  }

  var API = {
    CATEGORIES: CATEGORIES,
    categoryForKp: categoryForKp,
    deriveCategory: deriveCategory
  };

  global.OntologyCategoryMap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/module-catalog.js"] = function (module, exports, require) {


(function(global) {
  
  const SUBJECTS = { MATH: 'math' };

  const BASIC_MODULES = [
    { id: 'M0', name: '巧算专项', subject: SUBJECTS.MATH, grades: [1], category: 'number', level: 'basic' },
    { id: 'M1', name: '口算练习', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M2', name: '竖式计算', subject: SUBJECTS.MATH, grades: [2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M3', name: '脱式计算', subject: SUBJECTS.MATH, grades: [2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M4', name: '填空题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    { id: 'M5', name: '连线题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    { id: 'M6', name: '操作题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'geometry', level: 'basic' },
    { id: 'M7', name: '看图列式', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M8', name: '解决问题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    { id: 'M9', name: '分类与整理', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'statistics', level: 'basic' },
    { id: 'M10', name: '推理与数学广角', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'statistics', level: 'basic' },
   { id: 'M11', name: '判断题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
   { id: 'M12', name: '选择题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    
    
    {
      id: 'M13', name: '提前预习', subject: SUBJECTS.MATH, grades: [1], category: 'number', level: 'basic',
      display: {
        color: '#7cb342',
        tags: ['乘法表', '除法表', '乘除法填空']
      }
    }
  ];

  const COMPETITION_MODULES = [
    { id: 'C1', name: '数字谜与数阵图', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'number', level: 'competition', icon: '🧩',
      desc: '竖式/横式数字谜、幻方与数阵图填数，训练位值分析与枚举推理',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C2', name: '数论初步', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'number', level: 'competition', icon: '🔢',
      desc: '整除特征、奇偶性、质数合数、因数倍数与余数规律',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C3', name: '组合计数', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'number', level: 'competition', icon: '🔀',
      desc: '加乘原理、排列组合初步、枚举与容斥、找规律计数',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C4', name: '几何模型', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'geometry', level: 'competition', icon: '📐',
      desc: '鸟头、蝴蝶、燕尾、一半模型，圆与扇形，勾股定理与格点面积',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C5', name: '行程问题', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'number', level: 'competition', icon: '🚗',
      desc: '相遇追及、火车过桥、流水行船与环形跑道，画线段图分析',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C6', name: '工程与浓度', subject: SUBJECTS.MATH, grades: [5,6], category: 'number', level: 'competition', icon: '🏗️',
      desc: '工程问题（工作量/工效/工时）、溶液浓度混合与配比问题',
      gradeStatus: { 5: 'active', 6: 'active' } },
    { id: 'C7', name: '分数与巧算', subject: SUBJECTS.MATH, grades: [5,6], category: 'number', level: 'competition', icon: '✨',
      desc: '分数与小数巧算、繁分数化简、换元与裂项等速算技巧',
      gradeStatus: { 5: 'active', 6: 'active' } },
    { id: 'C8', name: '最值与逻辑推理', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'statistics', level: 'competition', icon: '🧠',
      desc: '最大最小问题、抽屉原理、逻辑推理（列表/假设法）与对策问题',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C9', name: '竞赛综合', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'mixed', level: 'competition', icon: '🏆',
      desc: '跨模块综合卷：按各竞赛模块知识点 weight 加权混编，模拟竞赛组卷',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } }
  ];

  const MODULE_CATALOG = BASIC_MODULES
    .concat(COMPETITION_MODULES);

  const MODULE_BY_ID = {};
  MODULE_CATALOG.forEach(function (m) {
    if (MODULE_BY_ID[m.id]) throw new Error('module-catalog：模块 ID 重复 ' + m.id);
    MODULE_BY_ID[m.id] = m;
  });
  MODULE_CATALOG.byId = function (id) { return MODULE_BY_ID[id] || null; };
  MODULE_CATALOG.SUBJECTS = SUBJECTS;

  
  
  
  
  const TYPE_MODULES = {
    oral: ['M1'], calc: ['M1', 'M2', 'M3'], vertical: ['M2'], mixed: ['M3'],
    fill: ['M4'], match: ['M5'], operation: ['M6', 'M9'], draw: ['M6', 'M9'],
    picture: ['M7'], apply: ['M8'], word: ['M8'], stats: ['M9'], reason: ['M10'],
    judge: ['M11'], choice: ['M12'], open: ['M6', 'M8'], geometry: ['M6']
  };

  
  
  function visibleModulesForType(type) {
    var t = String(type == null ? '' : type).toLowerCase().trim();
    if (!t) return null;
    var mods = TYPE_MODULES[t];
    return mods ? mods.slice() : null;
  }

  
  
  
  
  function kpVisibleInType(kp, type) {
    var q = String(type == null ? '' : type).toLowerCase().trim();
    if (!q) return true;
    if (q === 'competition') return String((kp && kp.moduleId) || '').toUpperCase().charAt(0) === 'C';
    if (kp && kp.moduleId && String(kp.moduleId).toLowerCase() === q) return true;
    if (kp && kp.type && String(kp.type).toLowerCase() === q) return true;
    var mods = TYPE_MODULES[q];
    if (mods && kp && kp.moduleId && mods.indexOf(kp.moduleId) !== -1) return true;
    return false;
  }

  MODULE_CATALOG.TYPE_MODULES = TYPE_MODULES;
  MODULE_CATALOG.visibleModulesForType = visibleModulesForType;
  MODULE_CATALOG.kpVisibleInType = kpVisibleInType;

  global.MODULE_CATALOG = MODULE_CATALOG;
  global.SUBJECTS = SUBJECTS;
  global.BASIC_MODULES = BASIC_MODULES;
  global.COMPETITION_MODULES = COMPETITION_MODULES;
  if (typeof module !== 'undefined') module.exports = MODULE_CATALOG;
})(typeof window !== 'undefined' ? window : global);

};
__defs["shared/generator/core/rng.js"] = function (module, exports, require) {

'use strict';

function hashSeed(str) {
  var h = 5381;
  str = String(str);
  for (var i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function createSeededRandom(seed) {
  var a = (seed == null ? 1 : (typeof seed === 'number' ? (seed >>> 0) : hashSeed(seed))) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  if (max < min) { var t = min; min = max; max = t; }
  return min + Math.floor(rng() * (max - min + 1));
}


function randIntExcluding(rng, min, max, exclude) {
  var v = randInt(rng, min, max);
  if (exclude == null || v !== exclude) return v;
  
  for (var i = 0; i < 8; i++) {
    v = randInt(rng, min, max);
    if (v !== exclude) return v;
  }
  return v;
}

function pick(rng, arr) {
  if (!arr || arr.length === 0) return undefined;
  return arr[randInt(rng, 0, arr.length - 1)];
}

function shuffle(rng, arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = randInt(rng, 0, i);
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

module.exports = {
  hashSeed: hashSeed,
  createSeededRandom: createSeededRandom,
  randInt: randInt,
  randIntExcluding: randIntExcluding,
  pick: pick,
  shuffle: shuffle
};

};
__defs["shared/generator/core/arithmetic-core.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");

var OP_ADD = '+', OP_SUB = '−', OP_MUL = '×', OP_DIV = '÷';

function normalizeOperation(op) {
  var m = { add: 'add', addition: 'add', sub: 'sub', subtraction: 'sub',
    mult: 'mult', mul: 'mult', multiplication: 'mult',
    div: 'div', division: 'div', mixed: 'mixed' };
  return m[op] || 'mixed';
}

function defaultOperators(op, allowMultDiv) {
  if (op === 'add') return [OP_ADD];
  if (op === 'sub') return [OP_SUB];
  if (op === 'mult') return [OP_MUL];
  if (op === 'div') return [OP_DIV];
  return allowMultDiv ? [OP_ADD, OP_SUB, OP_MUL, OP_DIV] : [OP_ADD, OP_SUB];
}


function generateStructure(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 20 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));
  var op = normalizeOperation(cfg.operation);
  var noNegative = cfg.noNegative !== false;

  var steps = cfg.exactSteps != null && cfg.exactSteps >= 1
    ? cfg.exactSteps
    : (cfg.maxSteps != null && cfg.maxSteps > 1
      ? Rng.randInt(rng, 1, Math.min(cfg.maxSteps, 3))
      : 1);

  var maxForMult = Math.min(max, 20);

  
  var opPool = Array.isArray(cfg.operationSet) && cfg.operationSet.length
    ? cfg.operationSet.slice()
    : defaultOperators(op, cfg.allowMultDiv);

  
  var operators = [];
  for (var i = 0; i < steps; i++) {
    var prev = operators[i - 1];
    var pool = (prev === OP_MUL || prev === OP_DIV)
      ? [OP_ADD, OP_SUB]
      : opPool;
    operators.push(Rng.pick(rng, pool));
  }

  
  var operands = [];
  for (i = 0; i <= steps; i++) {
    operands.push(Rng.randInt(rng, min, max));
  }
  for (i = 0; i < steps; i++) {
    
    
    var subSwapSafe = operands[i + 1] > operands[i] &&
      (i === 0 || (operators[i - 1] !== OP_MUL && operators[i - 1] !== OP_DIV));
    if (operators[i] === OP_SUB && noNegative && subSwapSafe) {
      var tmp = operands[i + 1];
      operands[i + 1] = operands[i];
      operands[i] = tmp;
    } else if (operators[i] === OP_DIV) {
      
      var divisor = Rng.randInt(rng, 1, Math.min(maxForMult, 9));
      var maxQuotient = Math.max(1, Math.floor(max / divisor));
      var quotient = Rng.randInt(rng, 1, Math.min(Math.min(maxForMult, 9), maxQuotient));
      operands[i + 1] = divisor;
      operands[i] = divisor * quotient;
    } else if (operators[i] === OP_MUL) {
      operands[i] = Rng.randInt(rng, 1, Math.min(maxForMult, 9));
      operands[i + 1] = Rng.randInt(rng, 1, Math.min(maxForMult, 9));
    }
  }

  
  
  if (noNegative) {
    for (i = 0; i < steps; i++) {
      if (operators[i] !== OP_SUB) continue;
      var prefix = calculateAnswer(operands.slice(0, i + 1), operators.slice(0, i));
      var partial = prefix - operands[i + 1];
      var nextLocked = i + 1 < steps && (operators[i + 1] === OP_DIV || operators[i + 1] === OP_MUL);
      if (partial < 0) {
        if (prefix >= min && !nextLocked) {
          operands[i + 1] = Rng.randInt(rng, Math.max(1, min), Math.max(min, prefix));
        } else {
          operators[i] = OP_ADD;
        }
      }
    }
  }

  return { operands: operands, operators: operators, steps: steps };
}


function calculateAnswer(operands, operators) {
  var vals = operands.slice();
  var ops = operators.slice();

  for (var i = 0; i < ops.length; i++) {
    if (ops[i] === OP_MUL || ops[i] === OP_DIV) {
      var r = apply(ops[i], vals[i], vals[i + 1]);
      vals.splice(i, 2, r);
      ops.splice(i, 1);
      i--;
    }
  }
  var acc = vals[0];
  for (i = 0; i < ops.length; i++) {
    acc = apply(ops[i], acc, vals[i + 1]);
  }
  return acc;
}

function apply(op, a, b) {
  if (op === OP_ADD) return a + b;
  if (op === OP_SUB) return a - b;
  if (op === OP_MUL) return a * b;
  if (op === OP_DIV) return b === 0 ? a : a / b;
  return a;
}

function formatExpression(operands, operators) {
  var s = String(operands[0]);
  for (var i = 0; i < operators.length; i++) {
    s += ' ' + operators[i] + ' ' + operands[i + 1];
  }
  return s;
}


function generateDistractors(rng, answer, count, range) {
  var dist = [];
  var guard = 0;
  while (dist.length < count && guard < 40) {
    guard++;
    var delta = Rng.randInt(rng, 1, 3) * (Rng.pick(rng, [-1, 1]));
    var v = answer + delta;
    if (range && (v < range.min || v > range.max)) continue;
    if (v === answer || dist.indexOf(v) !== -1) continue;
    dist.push(v);
  }
  return dist;
}


function parseExpression(text) {
  var m = String(text).match(/(-?\d+(?:\.\d+)?)\s*([+\-−×÷])\s*(-?\d+(?:\.\d+)?)(?:\s*([+\-−×÷])\s*(-?\d+(?:\.\d+)?))?(?:\s*([+\-−×÷])\s*(-?\d+(?:\.\d+)?))?/);
  if (!m) return null;
  var operands = [Number(m[1]), Number(m[3])];
  var operators = [m[2] === '-' ? OP_SUB : m[2]];
  if (m[4]) {
    operators.push(m[4] === '-' ? OP_SUB : m[4]);
    operands.push(Number(m[5]));
  }
  if (m[6]) {
    operators.push(m[6] === '-' ? OP_SUB : m[6]);
    operands.push(Number(m[7]));
  }
  return { operands: operands, operators: operators };
}




function buildBracket(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 100 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));
  var noNegative = cfg.noNegative !== false;
  var OP_INSIDE = [OP_ADD, OP_SUB];
  var OP_OUTSIDE = [OP_MUL, OP_DIV];

  var guard = 0;
  while (guard++ < 200) {
    var op1 = Rng.pick(rng, OP_INSIDE);
    var op2 = Rng.pick(rng, OP_OUTSIDE);
    var a, b, c, inner, answer;

    if (op2 === OP_MUL) {
      
      a = Rng.randInt(rng, min, max);
      b = Rng.randInt(rng, min, Math.min(max, 9));
      c = Rng.randInt(rng, 2, Math.min(max, 9));
      inner = op1 === OP_ADD ? a + b : a - b;
      if (noNegative && inner < 0) { var t = a; a = b; b = t; inner = a - b; }
      if (noNegative && inner < 0) continue;
      answer = inner * c;
      return { operands: [a, b, c], operators: [op1, op2], answer: answer };
    }

    
    c = Rng.randInt(rng, 2, Math.min(max, 9));
    var maxQuotient = Math.floor(max / c);
    if (maxQuotient < 1) continue;
    var q = Rng.randInt(rng, 1, Math.min(maxQuotient, 9));
    var target = c * q; 
    if (op1 === OP_ADD) {
      a = Rng.randInt(rng, Math.max(min, 1), Math.min(max, target - 1));
      b = target - a;
      if (b < min || b > max) continue;
      inner = a + b;
    } else {
      
      b = Rng.randInt(rng, min, Math.min(max, 9));
      a = target + b;
      if (a < min || a > max) continue;
      inner = a - b;
    }
    if (inner !== target) continue;
    answer = q;
    return { operands: [a, b, c], operators: [op1, op2], answer: answer };
  }

  
  return { operands: [2, 3, 4], operators: [OP_ADD, OP_MUL], answer: 20 };
}


function formatBracketExpression(operands, operators) {
  return '(' + operands[0] + ' ' + operators[0] + ' ' + operands[1] + ') ' + operators[1] + ' ' + operands[2];
}




function buildFillOperand(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 20 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));
  var op = Rng.pick(rng, cfg.operators || [OP_ADD, OP_SUB]);

  var a, b, total, r;
  var i = 0;
  while (i++ < 80) {
    if (op === OP_ADD) {
      a = Rng.randInt(rng, min, max);
      b = Rng.randInt(rng, min, max);
      total = a + b;
      if (total > max) continue;
      var position = rng() < 0.5 ? 'first' : 'second';
      if (position === 'first') {
        
        return { prompt: '□ + ' + b + ' = ' + total, known: b, unknown: a, operator: op, position: position };
      }
      
      return { prompt: a + ' + □ = ' + total, known: a, unknown: b, operator: op, position: position };
    }
    
    a = Rng.randInt(rng, Math.max(min, 2), max);
    b = Rng.randInt(rng, Math.min(max - 1, Math.max(min, 1)), a - 1);
    r = a - b;
    var pos = rng() < 0.5 ? 'first' : 'second';
    if (pos === 'first') {
      
      return { prompt: '□ − ' + b + ' = ' + r, known: b, unknown: a, operator: op, position: pos };
    }
    
    return { prompt: a + ' − □ = ' + r, known: a, unknown: b, operator: op, position: pos };
  }
  return { prompt: '5 − □ = 3', known: 5, unknown: 2, operator: OP_SUB, position: 'second' };
}


function buildFillOperator(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 100 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));

  var op = Rng.pick(rng, cfg.operators || [OP_ADD, OP_SUB, OP_MUL, OP_DIV]);
  var a, b, answer;
  if (op === OP_ADD) {
    a = Rng.randInt(rng, min, max);
    b = Rng.randInt(rng, min, max);
    answer = a + b;
    if (answer > max) { var t = a; a = Math.max(min, Math.floor(a * 0.6)); b = Math.max(min, Math.floor(b * 0.6)); answer = a + b; }
  } else if (op === OP_SUB) {
    a = Rng.randInt(rng, Math.max(min, 2), max);
    b = Rng.randInt(rng, min, a - 1);
    answer = a - b;
  } else if (op === OP_MUL) {
    a = Rng.randInt(rng, Math.max(min, 2), Math.min(max, 9));
    b = Rng.randInt(rng, Math.max(min, 2), Math.min(max, 9));
    answer = a * b;
  } else {
    
    b = Rng.randInt(rng, 2, Math.min(max, 9));
    var q = Rng.randInt(rng, 2, Math.min(max, 9));
    a = b * q;
    answer = q;
    if (a > max) { a = b * 2; answer = 2; }
  }
  return { prompt: a + ' □ ' + b + ' =', answer: op, operator: op, operands: [a, b] };
}




function buildBigAddsub(rng) {
  function mul100(lo, hi) { return Rng.randInt(rng, lo, hi) * 100; }
  if (Rng.pick(rng, [1, 2]) === 1) {
    var kind = Rng.pick(rng, ['hh', 'kk', 'hk', 'dd']);
    var a, b;
    if (kind === 'hh') { a = mul100(1, 9); b = mul100(1, 90 - a / 100); }
    else if (kind === 'kk') { a = Rng.randInt(rng, 1, 8) * 1000; b = Rng.randInt(rng, 1, Math.max(1, Math.floor((10000 - a) / 1000))) * 1000; }
    else if (kind === 'hk') { a = Rng.randInt(rng, 1, 8) * 1000; b = mul100(1, 90 - a / 100); }
    else { a = Rng.randInt(rng, 100, 499); b = Rng.randInt(rng, 100, 499); }
    return { operands: [a, b], operators: [OP_ADD], steps: 1, answer: a + b };
  }
  var kind2 = Rng.pick(rng, ['hh', 'kk', 'hk', 'dd']);
  var a2, b2;
  if (kind2 === 'hh') { a2 = mul100(2, 90); b2 = mul100(1, a2 / 100 - 1); }
  else if (kind2 === 'kk') { a2 = Rng.randInt(rng, 2, 9) * 1000; b2 = Rng.randInt(rng, 1, a2 / 1000 - 1) * 1000; }
  else if (kind2 === 'hk') { a2 = Rng.randInt(rng, 2, 9) * 1000; b2 = mul100(1, a2 / 100 - 1); }
  else { a2 = Rng.randInt(rng, 300, 900); b2 = Rng.randInt(rng, 100, a2 - 100); }
  return { operands: [a2, b2], operators: [OP_SUB], steps: 1, answer: a2 - b2 };
}


function buildMul3x1(rng) {
  var a = (Rng.pick(rng, [1, 2, 3]) === 1) ? Rng.randInt(rng, 10, 99) * 10 : Rng.randInt(rng, 100, 999);
  var f = Rng.randInt(rng, 2, 9);
  return { operands: [a, f], operators: [OP_MUL], steps: 1, answer: a * f };
}


function buildMul2tens(rng) {
  var a = Rng.randInt(rng, 11, 99);
  var t = Rng.randInt(rng, 2, 9);
  var b = t * 10;
  return { operands: [a, b], operators: [OP_MUL], steps: 1, answer: a * b };
}


function buildDivTens(rng, range) {
  var max = Math.max(20, (range && range.max) || 5000);
  var t = Rng.randInt(rng, 2, 9);
  var b = t * 10;
  
  var qMax = Math.max(2, Math.floor(max / b));
  var v = qMax < 11 ? 's' : Rng.pick(rng, ['s', 'd', 'tens']);
  var q;
  if (v === 's') q = Rng.randInt(rng, 2, Math.min(9, qMax));
  else if (v === 'd') q = Rng.randInt(rng, 11, Math.min(49, qMax));
  else q = Rng.randInt(rng, 2, Math.max(2, Math.min(9, Math.floor(qMax / 10)))) * 10;
  var a = b * q;
  return { operands: [a, b], operators: [OP_DIV], steps: 1, answer: q };
}


function buildDivRemainder(rng, range) {
  var max = Math.max(10, (range && range.max) || 100);
  var guard = 0;
  while (guard++ < 200) {
    var b = Rng.randInt(rng, 2, 9);
    var qMax = Math.max(2, Math.min(9, Math.floor((max - 1) / b)));
    var q = Rng.randInt(rng, 2, qMax);
    var r = Rng.randInt(rng, 1, b - 1);
    var a = b * q + r;
    if (a > max) continue;
    return { operands: [a, b], operators: [OP_DIV], steps: 1, answer: String(q) + '……' + String(r) };
  }
  
  return { operands: [23, 5], operators: [OP_DIV], steps: 1, answer: '4……3' };
}


function trimDec(x) {
  return String(Number(Number(x).toFixed(2)));
}


function buildDecAddsub(rng) {
  var fmt = function (w, t) { return w + '.' + t; };
  var aW = Rng.randInt(rng, 0, 6), aT = Rng.randInt(rng, 1, 9);
  var bW = Rng.randInt(rng, 0, 6), bT = Rng.randInt(rng, 1, 9);
  var a = aW * 10 + aT, b = bW * 10 + bT;
  if (Rng.pick(rng, [1, 2]) === 1) {
    return { operands: [a / 10, b / 10], operators: [OP_ADD], steps: 1, answer: (a + b) / 10 };
  }
  if (a < b) { var tw = aW; aW = bW; bW = tw; var tt = aT; aT = bT; bT = tt; a = aW * 10 + aT; b = bW * 10 + bT; }
  return { operands: [a / 10, b / 10], operators: [OP_SUB], steps: 1, answer: (a - b) / 10 };
}


function buildLawOral(rng) {
  var v = Rng.pick(rng, ['25', '125', '99', '101']);
  var a, n;
  if (v === '25') { a = 25; n = Rng.pick(rng, [4, 8, 12, 16, 24, 28, 32, 36, 40]); }
  else if (v === '125') { a = 125; n = Rng.pick(rng, [8, 16, 24, 32, 40, 48, 56, 64, 72, 80]); }
  else if (v === '99') { a = 99; n = Rng.randInt(rng, 2, 9); }
  else { a = 101; n = Rng.randInt(rng, 2, 9); }
  return { operands: [a, n], operators: [OP_MUL], steps: 1, answer: a * n };
}


function buildDecMulOral(rng, range) {
  var max = Math.max(10, (range && range.max) || 1000);
  var v = Rng.pick(rng, ['i', 'ii', 'tens', 'zero']);
  var a, b;
  if (v === 'i') { a = Rng.randInt(rng, 1, 9) / 10; b = Rng.randInt(rng, 2, 99); }
  else if (v === 'ii') { a = Rng.randInt(rng, 1, 9) / 10; b = Rng.randInt(rng, 1, 9) / 10; }
  else if (v === 'tens') { a = Rng.randInt(rng, 2, 9) * 10; b = Rng.randInt(rng, 1, 9) / 10; }
  else { a = Rng.randInt(rng, 2, 9) * 100; b = Rng.randInt(rng, 1, 9) / 10; }
  if (a > max) a = Rng.randInt(rng, 2, Math.max(2, Math.floor(max / 100))) * 100;
  return { operands: [a, b], operators: [OP_MUL], steps: 1, answer: Number(trimDec(a * b)) };
}


function buildDecDivOral(rng, range) {
  var min = Math.max(0.1, (range && range.min != null) ? range.min : 0.1);
  var v = Rng.pick(rng, ['int', 'dec']);
  var divisor = Rng.randInt(rng, 2, 9) / 10;
  var q;
  if (v === 'int') q = Rng.randInt(rng, 2, 9);
  else q = Rng.randInt(rng, 1, 9) / 10;
  
  var a = divisor * q;
  if (a < min) { q = Math.max(v === 'int' ? 2 : 1, Math.ceil(min / divisor / 0.1) * 0.1); a = divisor * q; }
  return { operands: [Number(trimDec(a)), Number(trimDec(divisor))], operators: [OP_DIV], steps: 1, answer: Number(trimDec(q)) };
}


function buildNegAddsub(rng) {
  if (Rng.pick(rng, ['add', 'sub']) === 'add') {
    var a = Rng.randInt(rng, 2, 9), b = Rng.randInt(rng, 1, 9);
    return { operands: [-a, b], operators: [OP_ADD], steps: 1, answer: b - a };
  }
  var a2 = Rng.randInt(rng, 1, 9), b2 = Rng.randInt(rng, 1, 9);
  return { operands: [-a2, b2], operators: [OP_SUB], steps: 1, answer: -(a2 + b2) };
}


function buildDecMult(rng) {
  var v = Rng.pick(rng, ['dd', 'di', 'dd2']);
  var a, b;
  if (v === 'dd') {
    a = Rng.randInt(rng, 10, 99) / 10;
    b = Rng.randInt(rng, 10, 99) / 10;
  } else if (v === 'di') {
    a = Rng.randInt(rng, 10, 999) / 10;
    b = Rng.randInt(rng, 2, 99);
  } else {
    a = Rng.randInt(rng, 11, 99) / 100;
    b = Rng.randInt(rng, 11, 99) / 100;
  }
  return { operands: [a, b], operators: [OP_MUL], steps: 1, answer: Number(String(Number((a * b).toFixed(6)))) };
}


function buildAddLaw(rng) {
  var a = Rng.randInt(rng, 11, 99), b = Rng.randInt(rng, 11, 99);
  var t = Rng.pick(rng, [10, 100]);
  var ac = t - (a % t); if (ac <= 0) ac = t;
  var c = ac;
  return { operands: [a, b, c], operators: [OP_ADD, OP_ADD], steps: 2, answer: a + b + c };
}


function buildMulLaw(rng) {
  var pairs = [[25, 4], [125, 8], [25, 8], [125, 4], [50, 2], [20, 5]];
  var idx = Rng.randInt(rng, 0, pairs.length - 1);
  var p1 = pairs[idx][0], p2 = pairs[idx][1];
  var rest = Rng.randInt(rng, 3, 9);
  var factors = [p1, p2, rest];
  for (var i = factors.length - 1; i > 0; i--) { var j = Rng.randInt(rng, 0, i); var t = factors[i]; factors[i] = factors[j]; factors[j] = t; }
  return { operands: factors, operators: [OP_MUL, OP_MUL], steps: 2, answer: p1 * p2 * rest };
}


var SPECIAL_KINDS = {
  
  'big-addsub':    { build: buildBigAddsub,    needsRange: false }, 
  'mul3x1':        { build: buildMul3x1,       needsRange: false }, 
  'mul2tens':      { build: buildMul2tens,     needsRange: false }, 
  'div-tens':      { build: buildDivTens,      needsRange: true  }, 
  'div-remainder': { build: buildDivRemainder, needsRange: true  }, 
  'add-law':       { build: buildAddLaw,       needsRange: false }, 
  'mul-law':       { build: buildMulLaw,       needsRange: false }, 
  'neg-add-sub':   { build: buildNegAddsub,    needsRange: false }, 

  
  'dec-addsub':    { build: buildDecAddsub,    needsRange: false }, 
  'law-oral':      { build: buildLawOral,      needsRange: false }, 
  'dec-mul-oral':  { build: buildDecMulOral,   needsRange: true  }, 
  'dec-div-oral':  { build: buildDecDivOral,   needsRange: true  }, 
  'dec-mult':      { build: buildDecMult,      needsRange: true  }, 

  
  'bracket':       { build: buildBracket,      needsRange: true  }, 
  'fill-operand':  { build: buildFillOperand,  needsRange: true  }, 
  'fill-operator': { build: buildFillOperator, needsRange: true  }  
};


function buildSpecialKind(rng, cfg) {
  cfg = cfg || {};
  var kind = cfg.kind;
  var entry = SPECIAL_KINDS[kind];
  if (!entry) return null;
  return entry.needsRange ? entry.build(rng, cfg.numberRange) : entry.build(rng);
}

module.exports = {
  OP_ADD: OP_ADD, OP_SUB: OP_SUB, OP_MUL: OP_MUL, OP_DIV: OP_DIV,
  normalizeOperation: normalizeOperation,
  defaultOperators: defaultOperators,
  generateStructure: generateStructure,
  calculateAnswer: calculateAnswer,
  formatExpression: formatExpression,
  generateDistractors: generateDistractors,
  parseExpression: parseExpression,
  buildBracket: buildBracket,
  formatBracketExpression: formatBracketExpression,
  buildFillOperand: buildFillOperand,
  buildFillOperator: buildFillOperator,
  buildBigAddsub: buildBigAddsub,
  buildMul3x1: buildMul3x1,
  buildMul2tens: buildMul2tens,
  buildDivTens: buildDivTens,
  buildDivRemainder: buildDivRemainder,
  buildDecAddsub: buildDecAddsub,
  buildLawOral: buildLawOral,
  buildDecMulOral: buildDecMulOral,
  buildDecDivOral: buildDecDivOral,
  buildAddLaw: buildAddLaw,
  buildMulLaw: buildMulLaw,
  buildNegAddsub: buildNegAddsub,
  buildDecMult: buildDecMult,
  trimDec: trimDec,
  buildSpecialKind: buildSpecialKind,
  SPECIAL_KINDS: SPECIAL_KINDS
};

};
__defs["shared/shared/module-catalog.js"] = function (module, exports, require) {
  module.exports = null;
};
global.StrategyEngine = __req('shared/strategy/strategy-engine.js');
global.StrategyConfig = __req('shared/strategy/strategy-config.js');
global.StrategyValidator = __req('shared/strategy/strategy-validator.js');
global.QuestionTypeStrategy = __req('shared/strategy/question-type-strategy.js');
global.QuestionTypeAllocation = __req('shared/strategy/question-type-allocation.js');
global.StaticDifficultyStrategy = __req('shared/strategy/static-difficulty.js');
global.DifficultyStrategy = __req('shared/strategy/difficulty-strategy.js');
global.TargetDifficulty = __req('shared/strategy/target-difficulty.js');
global.StructureConstraints = __req('shared/strategy/structure-constraints.js');
global.NumberRangeStrategy = __req('shared/strategy/number-range-strategy.js');
global.CognitiveStrategy = __req('shared/strategy/cognitive-strategy.js');
global.SpiralStrategy = __req('shared/strategy/spiral-strategy.js');
global.ContextStrategy = __req('shared/strategy/context-strategy.js');
global.ConstraintBuilder = __req('shared/strategy/constraint-builder.js');
global.GeneratorSelector = __req('shared/generator/generator-selector.js');
global.GeneratorMode = __req('shared/generator/generator-mode.js');
global.GeneratorRegistry = __req('shared/generator/generator-registry.js');
global.SemanticQuestionBridge = __req('shared/generator/semantic-question-bridge.js');
global.ComplexGen = __req('shared/generator/generators/complex.js');
global.StrategyBundle = { req: __req, modules: __defs };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));