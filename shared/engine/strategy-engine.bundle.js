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
__defs["shared/core/common.js"] = function (m) {
  if (global.PluginUtil == null) throw new Error('strategy-bundle: 缺少全局 PluginUtil（请先加载对应脚本）');
  m.exports = global.PluginUtil;
};
__defs["shared/catalog/difficulty.js"] = function (m) {
  if (global.App.Difficulty == null) throw new Error('strategy-bundle: 缺少全局 App.Difficulty（请先加载对应脚本）');
  m.exports = global.App.Difficulty;
};
__defs["shared/catalog/difficulty-static.js"] = function (m) {
  if (global.App.DifficultyStatic == null) throw new Error('strategy-bundle: 缺少全局 App.DifficultyStatic（请先加载对应脚本）');
  m.exports = global.App.DifficultyStatic;
};
__defs["shared/knowledge/knowledge-bank.js"] = function (m) {
  if (global.KnowledgeCompat == null) throw new Error('strategy-bundle: 缺少全局 KnowledgeCompat（请先加载对应脚本）');
  m.exports = global.KnowledgeCompat;
};
__defs["shared/knowledge/knowledge-point.js"] = function (m) {
  if (global.KnowledgePointCompat == null) throw new Error('strategy-bundle: 缺少全局 KnowledgePointCompat（请先加载对应脚本）');
  m.exports = global.KnowledgePointCompat;
};
__defs["shared/knowledge/knowledge-ontology.js"] = function (m) {
  if (global.KnowledgeOntologyCompat == null) throw new Error('strategy-bundle: 缺少全局 KnowledgeOntologyCompat（请先加载对应脚本）');
  m.exports = global.KnowledgeOntologyCompat;
};
__defs["shared/orchestration/knowledge-context.js"] = function (m) {
  if (global.KnowledgeContext == null) throw new Error('strategy-bundle: 缺少全局 KnowledgeContext（请先加载对应脚本）');
  m.exports = global.KnowledgeContext;
};
__defs["shared/strategy/strategy-engine.js"] = function (module, exports, require) {

'use strict';

var StrategyRequest = require("shared/strategy/strategy-request.js");
var StrategyResolver = require("shared/strategy/strategy-resolver.js");
var CapabilityResolver = require("shared/capability/capability-resolver.js");
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
var StrategyConfig = require("shared/strategy/strategy-config.js");








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
  var KB = require("shared/knowledge/knowledge-bank.js");
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


function hasNativeSupport(kp) {
  if (!kp) return false;
  var GenRegistry = require("shared/generator/generator-registry.js");
  
  var gens = GenRegistry.forKnowledgePoint(kp.id);
  if (gens.some(function (g) { return g.scope === 'core'; })) return true;
  
  var ArithSem = require("shared/generator/core/kp-arithmetic-semantics.js");
  var arithSem = ArithSem.resolveArithmeticSemantics(kp);
  var isAlgebraDomain = !!(kp && kp.legacy && kp.legacy.category === 'algebra');
  if (isAlgebraDomain && (arithSem || (kp.source && kp.source.legacyType))) return true;
  
  var ComplexSem = require("shared/generator/core/kp-complex-semantics.js");
  if (ComplexSem.resolveComplexSemantics(kp)) return true;
  return false;
}







var TYPE_KP_MAX_GROUP = 4;


function entriesById(ids) {
  var KnowledgePoint = require("shared/knowledge/knowledge-point.js");
  var KB = require("shared/knowledge/knowledge-bank.js");
  var idx = {};
  [1, 2, 3, 4, 5, 6].forEach(function (g) {
    (KB.getEntries('math', g) || []).forEach(function (e) { idx[e.id] = e; });
  });
  return ids.map(function (id) {
    if (idx[id]) return idx[id];
    var kp = null;
    try { kp = KnowledgePoint.get(id); } catch (e) {  }
    return {
      id: id,
      name: (kp && kp.identity && kp.identity.name) || id,
      pluginId: (kp && kp.source && kp.source.pluginId) || null,
      moduleId: (kp && kp.module && kp.module.id) || null,
      category: (idx[id] && idx[id].category) || (kp && kp.category) || (kp && kp.module && kp.module.category) || null,
      weight: (kp && kp.metadata && typeof kp.metadata.weight === 'number') ? kp.metadata.weight : 1,
      type: null
    };
  });
}



function densityKey(cand) {
  return String((cand.entry && (cand.entry.category || cand.entry.moduleId)) ||
    (cand.kp && cand.kp.category) || '');
}
function typeKpDensityDepth(cand, moduleCount, maxModule) {
  var kp = cand.kp;
  var density = moduleCount[densityKey(cand)] || 0;
  var densityScore = Math.min(1, density / Math.max(1, maxModule));
  var maxSpiral = (kp && kp.spiral && typeof kp.spiral.maxLevel === 'number') ? kp.spiral.maxLevel : 1;
  var maxSteps = (kp && kp.structure && typeof kp.structure.maxSteps === 'number') ? kp.structure.maxSteps : 1;
  var depth = 0.6 * Math.min(1, maxSpiral / 6) + 0.4 * Math.min(1, maxSteps / 4);
  return { density: densityScore, depth: depth, composite: 0.5 * densityScore + 0.5 * depth };
}





function allocateTypeCounts(qtList, count, perTypeCount, typeCounts) {
  var n = qtList.length;
  var out = { entries: [], total: 0 };
  if (!n) return out;
  var i, entry;
  if (Array.isArray(typeCounts) && typeCounts.length) {
    var map = {};
    typeCounts.forEach(function (t) { if (t && t.questionType != null) map[String(t.questionType)] = t.count; });
    var total = 0;
    var entries = qtList.map(function (q) {
      var c = map[String(q)] != null ? Math.max(0, Math.floor(map[String(q)])) : 0;
      total += c;
      return { questionType: q, count: c };
    });
    return { entries: entries, total: total };
  }
  if (perTypeCount != null && perTypeCount >= 1) {
    var pt = Math.min(count, Math.floor(perTypeCount));
    var effN = Math.min(n, Math.max(1, Math.floor(count / pt)));
    return {
      entries: qtList.map(function (q, j) { return { questionType: q, count: j < effN ? pt : 0 }; }),
      total: effN * pt
    };
  }
  var base = Math.floor(count / n);
  var rem = count - base * n;
  return {
    entries: qtList.map(function (q, j) { return { questionType: q, count: base + (j < rem ? 1 : 0) }; }),
    total: count
  };
}


function equalShares(total, n) {
  var out = [];
  if (!n || total < 1) return out;
  var base = Math.floor(total / n);
  var rem = total - base * n;
  for (var i = 0; i < n; i++) out.push(base + (i < rem ? 1 : 0));
  return out;
}


function planByType(request) {
  request = StrategyRequest.normalizeRequest(request);
  var reqCheck = StrategyRequest.validateRequest(request);
  if (!reqCheck.valid) {
    throw new StrategyError('Request 非法: ' + reqCheck.errors.join('; '), CODES.INVALID_REQUEST, { errors: reqCheck.errors });
  }
  var qtList = requestedQuestionTypes(request);
  var source = poolSource(request, request.mode || 'multi-kp');
  if (source.subject !== 'math') {
    throw new StrategyError('核心生成引擎仅支持数学（math），暂不支持 ' + source.subject + '（multi-kp）', CODES.UNSUPPORTED_SUBJECT, { subject: source.subject });
  }

  var kpIds = request.knowledgePointIds || [];
  var hasExplicitTypeCounts = Array.isArray(request.typeCounts) && request.typeCounts.length;
  var count = request.count != null ? request.count : (request.volume != null ? request.volume : null);
  if (hasExplicitTypeCounts && count == null) {
    count = 0;
    request.typeCounts.forEach(function (t) { count += (t && typeof t.count === 'number') ? t.count : 0; });
  }
  if (count == null) count = 10;
  if (typeof count !== 'number' || !isFinite(count) || count < 1 || Math.floor(count) !== count) {
    throw new StrategyError('count 必须是 >=1 的整数: ' + count, CODES.INVALID_REQUEST, { count: count });
  }

  var entries = kpIds.length ? entriesById(kpIds) : poolEntries(source);
  var poolCandidates = resolvePoolCandidates(entries).filter(function (c) { return candidateFeasible(c, qtList); });
  poolCandidates = poolCandidates.filter(function (c) { return hasNativeSupport(c.kp); });

  var trace = {
    mode: 'multi-kp',
    driven: qtList.length ? 'type' : 'pool',
    pool: { subject: source.subject, grade: source.grade, size: entries.length, feasible: poolCandidates.length, questionTypes: qtList.length ? qtList.slice() : null }
  };

  if (!poolCandidates.length) {
    trace.selection = [];
    trace.failedPlans = [];
    trace.message = entries.length ? '池内知识点均不支持请求题型/无生成能力' : '该知识点池无可用知识点';
    var emptyResult = StrategyResult.createStrategyResult([], { trace: trace, mode: 'multi-kp' }, []);
    emptyResult.trace = trace;
    return emptyResult;
  }

  var typePlan = allocateTypeCounts(qtList, count, request.perTypeCount, hasExplicitTypeCounts ? request.typeCounts : null);
  
  
  
  if (hasExplicitTypeCounts && typePlan.total !== count) {
    throw new StrategyError('分题型数量守恒不变式被破坏: sum=' + typePlan.total + ' !== count=' + count, CODES.INVALID_REQUEST, { typeCounts: typePlan.entries, count: count });
  }
  if (qtList.length && !hasExplicitTypeCounts && request.perTypeCount != null) {
    count = typePlan.total;
  }
  trace.count = { total: count, perTypeCount: request.perTypeCount != null ? request.perTypeCount : null, typeCounts: hasExplicitTypeCounts ? request.typeCounts : null };
  trace.typeCounts = typePlan.entries.filter(function (e) { return e.count > 0; });

  
  var moduleCount = {};
  var maxModule = 0;
  poolCandidates.forEach(function (c) {
    var m = densityKey(c);
    moduleCount[m] = (moduleCount[m] || 0) + 1;
    if (moduleCount[m] > maxModule) maxModule = moduleCount[m];
  });

  var plans = [];
  var failedPlans = [];
  var planTraces = [];
  var decisions = [];

  function emitPlan(id, subCount, questionType, decision) {
    var sub = Object.assign({}, request, {
      mode: 'single-kp',
      knowledgePointIds: [id],
      knowledgePoints: undefined,
      knowledgePointId: undefined,
      kp: undefined,
      count: subCount,
      questionType: undefined,
      questionTypes: questionType ? [questionType] : undefined,
      perTypeCount: undefined,
      typeCounts: undefined,
      kpAllocation: undefined,
      combine: undefined
    });
    try {
      var r = plan(sub);
      if (r && r.plans && r.plans[0]) {
        var qp = r.plans[0];
        qp.__pool = { mode: 'type-driven', questionType: decision.questionType || null, kpId: id, composite: decision.composite };
        qp.__decision = { questionType: decision.questionType || null, kpId: id, density: decision.density, depth: decision.depth };
        plans.push(qp);
        if (r.meta && r.meta.trace) planTraces.push(r.meta.trace);
      } else {
        failedPlans.push({ questionType: decision.questionType || null, kpId: id, error: 'StrategyEngine 未产出计划' });
      }
    } catch (e) {
      failedPlans.push({ questionType: decision.questionType || null, kpId: id, error: String((e && e.message) || e) });
    }
  }

  if (!qtList.length) {
    
    var shares = allocateLargestRemainder(poolCandidates.map(function () { return 1; }), count);
    poolCandidates.forEach(function (c, i) {
      if (shares[i] < 1) return;
      emitPlan(c.entry.id, shares[i], null, { questionType: null, composite: 0, density: 0, depth: 0 });
    });
  } else {
    
    typePlan.entries.forEach(function (te) {
      if (!te.count) return;
      var type = te.questionType;
      var typePool = poolCandidates.filter(function (c) { return candidateFeasible(c, [type]); });
      if (!typePool.length) {
        failedPlans.push({ questionType: type, kpId: null, error: '池内无支持该题型且具备生成能力的知识点' });
        return;
      }
      var scored = typePool.map(function (c) {
        var s = typeKpDensityDepth(c, moduleCount, maxModule);
        return { cand: c, score: s };
      });
      scored.sort(function (a, b) {
        return (b.score.composite - a.score.composite) || (b.score.density - a.score.density) || (b.score.depth - a.score.depth) || (a.cand.entry.id < b.cand.entry.id ? -1 : 1);
      });
      var groupSize = Math.min(scored.length, Math.max(1, Math.min(TYPE_KP_MAX_GROUP, Math.ceil(te.count / 4))));
      var group = scored.slice(0, groupSize);
      var gShares = equalShares(te.count, group.length);
      var decision = {
        questionType: type,
        count: te.count,
        kps: group.map(function (g, i) {
          return {
            kpId: g.cand.entry.id,
            name: g.cand.entry.name,
            density: Math.round(g.score.density * 100) / 100,
            depth: Math.round(g.score.depth * 100) / 100,
            composite: Math.round(g.score.composite * 100) / 100,
            share: gShares[i]
          };
        })
      };
      decisions.push(decision);
      group.forEach(function (g, i) {
        if (gShares[i] < 1) return;
        emitPlan(g.cand.entry.id, gShares[i], type, {
          questionType: type,
          density: decision.kps[i].density,
          depth: decision.kps[i].depth,
          composite: decision.kps[i].composite
        });
      });
    });
  }

  trace.decisions = decisions;
  trace.selected = plans.length;
  trace.failedPlans = failedPlans;
  trace.planTraces = planTraces;

  var result = StrategyResult.createStrategyResult(plans, { trace: trace, mode: 'multi-kp' }, []);
  result.trace = trace;
  var resultCheck = StrategyResult.validateStrategyResult(result);
  if (!resultCheck.valid) {
    throw new StrategyError('StrategyResult 校验失败: ' + resultCheck.errors.join('; '), CODES.INVALID_PLAN, { errors: resultCheck.errors });
  }
  result.valid = true;
  return result;
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
  
  scored = scored.filter(function (s) { return hasNativeSupport(s.cand.kp); });
  var shares = allocateLargestRemainder(scored.map(function (s) { return s.score.score; }), count);

  trace.selection = scored.map(function (s, i) {
    return {
      kpId: s.cand.entry.id,
      name: s.cand.entry.name,
      category: densityKey(s.cand),
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

  
  
  var KpArith = require("shared/generator/core/kp-arithmetic-semantics.js");
  var arithSem = KpArith.resolveArithmeticSemantics(kp);
  var KpComplex = require("shared/generator/core/kp-complex-semantics.js");
  var complexSem = KpComplex.resolveComplexSemantics(kp);

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
    
    
    var VariationDirective = require("shared/strategy/variation-directive.js");
    
    
    
    var planOperationTokens = (arithSem && arithSem.operators) || (complexSem && complexSem.operators) ||
      (Array.isArray(kp.operations) && kp.operations.length ? kp.operations : null);
    var misconceptionDirectives = VariationDirective.resolveForPlan({
      kpId: kp.id,
      errorTypes: AdaptiveStrategy.errorFocusFor(kpState, 2),
      questionTypeId: questionType,
      operationTokens: planOperationTokens
    });
    learnerDecision = AdaptiveStrategy.resolve({
      kpId: kp.id,
      learnerState: kpState,
      staticDifficulty: staticProfile.level,
      difficulty: request.difficulty != null ? request.difficulty : null,
      allowDifficultyOverride: request.allowDifficultyOverride,
      adaptiveMode: request.adaptiveMode,
      adaptiveDelta: difficulty.adaptiveDelta,
      maxSpiralLevel: maxSpiral,
      misconceptionDirectives: misconceptionDirectives
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
      errorFocus: learnerDecision.errorFocus,
      variationDirectives: learnerDecision.variationDirectives
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
    
    if (Array.isArray(learnerDecision.variationDirectives) && learnerDecision.variationDirectives.length) {
      questionPlan.variationDirectives = learnerDecision.variationDirectives;
    }
  }

  
  
  questionPlan.explainability = buildExplainability(kp, questionType, finalDifficulty, learnerDecision, selectedGenerator);

  
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








var _qtIntentIndex = null;
function getQtIntentRow(kpId, qt) {
  if (_qtIntentIndex === null) {
    _qtIntentIndex = {};
    try {
      var p = '../../' + 'kbl/' + 'teaching/' + 'qt-intent.json';
      var data = require(p);
      (data && data.rows || []).forEach(function (r) {
        _qtIntentIndex[r.knowledgeId + '|' + r.questionType] = r;
      });
    } catch (e) {
      
    }
  }
  return _qtIntentIndex[kpId + '|' + qt] || null;
}


function buildExplainability(kp, questionType, finalDifficulty, learnerDecision, selectedGenerator) {
  var intentRow = getQtIntentRow(kp.id, questionType);
  var trainsWhat = (intentRow && intentRow.intent && intentRow.intent.trainsWhat) || null;
  var whyThisType = (intentRow && intentRow.intent && intentRow.intent.whyThisType) || null;
  var variant = learnerDecision ? learnerDecision.variant : 'fixed';
  var errorFocus = (learnerDecision && Array.isArray(learnerDecision.errorFocus))
    ? learnerDecision.errorFocus.slice(0, 2)
    : [];
  var generatorId = (selectedGenerator && (selectedGenerator.generatorId || selectedGenerator.id)) || 'unknown';

  return {
    knowledgePoint: kp.id + ' ' + (kp.name || ''),
    semanticTarget: trainsWhat || (kp.module || 'unknown'),
    questionIntent: whyThisType || 'unknown',
    questionType: questionType,
    difficulty: finalDifficulty,
    variation: variant,
    selectionReason: 'KP=' + kp.id +
      '; intent=' + (trainsWhat ? 'declared' : 'unknown') +
      '; variant=' + variant +
      '; errorFocus=' + (errorFocus.length ? errorFocus.join(',') : 'none') +
      '; generator=' + generatorId
  };
}

module.exports = {
  plan: plan,
  formatStrategyTrace: formatStrategyTrace,
  POOL_MODES: POOL_MODES,
  DIM_WEIGHTS: DIM_WEIGHTS,
  planFromPool: planFromPool,
  planByType: planByType,
  allocateTypeCounts: allocateTypeCounts,
  TYPE_KP_MAX_GROUP: TYPE_KP_MAX_GROUP
};


if (typeof window !== 'undefined') window.StrategyEngine = module.exports;
if (typeof global !== 'undefined') global.StrategyEngine = module.exports;
};
__defs["shared/strategy/strategy-config.js"] = function (module, exports, require) {

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

function isStrategyV1() {
  return getStrategy() === 'strategy-v1';
}

function getConfig() {
  return {
    version: STRATEGY_VERSION,
    current: getStrategy(),
    overrides: _configOverrides,
    features: {
      strategyEngine: isStrategyV1()
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
  isStrategyV1: isStrategyV1,
  getConfig: getConfig,
  setConfigOverrides: setConfigOverrides,
  reset: reset
};
};
__defs["shared/strategy/question-type-strategy.js"] = function (module, exports, require) {

'use strict';

var Registry = require("shared/knowledge/question-type-registry.js");
var Resolver = require("shared/capability/capability-resolver.js");
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
__defs["shared/strategy/static-difficulty.js"] = function (module, exports, require) {

'use strict';

var DifficultyStatic = require("shared/catalog/difficulty-static.js");
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
var KnowledgePoint = require("shared/knowledge/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;
var StrategyConfig = require("shared/strategy/strategy-config.js");
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
var KnowledgePoint = require("shared/knowledge/knowledge-point.js");
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
var Difficulty = require("shared/catalog/difficulty.js");
var KnowledgePoint = require("shared/knowledge/knowledge-point.js");
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
var Difficulty = require("shared/catalog/difficulty.js");
var PluginUtil = require("shared/core/common.js");
var KnowledgePoint = require("shared/knowledge/knowledge-point.js");
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

var Registry = require("shared/knowledge/question-type-registry.js");
var KnowledgePoint = require("shared/knowledge/knowledge-point.js");
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
  var _n = Registry.normalizeQuestionType(typeId);
  var canonicalId = (_n && _n.id) ? _n.id : typeId;
  var t = Registry.get(canonicalId);
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

var KnowledgePoint = require("shared/knowledge/knowledge-point.js");
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

var Registry = require("shared/knowledge/question-type-registry.js");
var KnowledgePoint = require("shared/knowledge/knowledge-point.js");
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

var Difficulty = require("shared/catalog/difficulty.js");
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

var KnowledgePoint = require("shared/knowledge/knowledge-point.js");
var Registry = require("shared/knowledge/question-type-registry.js");
var Resolver = require("shared/capability/capability-resolver.js");

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

var StrategyConfig = require("shared/strategy/strategy-config.js");
var QuestionTypeRegistry = require("shared/knowledge/question-type-registry.js");


var VALID_QUESTION_TYPES = (QuestionTypeRegistry && QuestionTypeRegistry.all)
  ? QuestionTypeRegistry.all().map(function (t) { return t.id; })
  : ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];


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
  
  delete out.kpAllocation;
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
    } else {
      var _n = QuestionTypeRegistry.normalizeQuestionType(req.questionType);
      if (!_n || _n.confidence === 'heuristic' || VALID_QUESTION_TYPES.indexOf(_n.id) === -1) {
        errors.push('非法 questionType: ' + req.questionType);
      }
    }
  }

  
  if (req.questionTypes != null && !Array.isArray(req.questionTypes)) {
    errors.push('questionTypes 必须是数组');
  }

  
  if (req.perTypeCount != null) {
    if (typeof req.perTypeCount !== 'number' || req.perTypeCount < 1 || req.perTypeCount % 1 !== 0) {
      errors.push('perTypeCount 必须是 >=1 的整数');
    }
  }
  if (req.typeCounts != null && !Array.isArray(req.typeCounts)) {
    errors.push('typeCounts 必须是数组');
  }
  if (Array.isArray(req.typeCounts)) {
    req.typeCounts.forEach(function (t) {
      if (!t || typeof t.questionType !== 'string' || !t.questionType) {
        errors.push('typeCounts 元素缺少非空 questionType');
      }
      if (!t || typeof t.count !== 'number' || t.count < 1 || t.count % 1 !== 0) {
        errors.push('typeCounts 元素的 count 必须是 >=1 的整数');
      }
    });
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
  validateRequest: validateRequest,
  createRequest: createRequest
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

var StrategyConfig = require("shared/strategy/strategy-config.js");
var Registry = require("shared/knowledge/question-type-registry.js");

var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 10;
var SPIRAL_MIN = 1;
var SPIRAL_MAX = 6;

var VALID_COGNITIVE_LEVELS = (Registry && Registry.COGNITIVE_LEVELS) || ['recall', 'recognize', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

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
  } else {
    var _n = Registry.normalizeQuestionType(plan.questionTypeId);
    var _validIds = Registry.all().map(function (t) { return t.id; });
    if (!_n || _n.confidence === 'heuristic' || _validIds.indexOf(_n.id) === -1) errors.push('非法 questionTypeId: ' + plan.questionTypeId);
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

  
  
  if (plan.explainability != null) {
    if (typeof plan.explainability !== 'object' || plan.explainability === null || Array.isArray(plan.explainability)) {
      errors.push('explainability 必须是对象');
    } else {
      var ex = plan.explainability;
      var EX_STRING_FIELDS = ['knowledgePoint', 'semanticTarget', 'questionIntent', 'questionType', 'variation', 'selectionReason'];
      EX_STRING_FIELDS.forEach(function (k) {
        var v = ex[k];
        if (v == null) return; 
        if (typeof v !== 'string' && !Array.isArray(v)) {
          errors.push('explainability.' + k + ' 必须是 string | string[] | null');
        } else if (Array.isArray(v)) {
          v.forEach(function (item, idx) {
            if (typeof item !== 'string') errors.push('explainability.' + k + '[' + idx + '] 必须是 string');
          });
        }
      });
      if (ex.difficulty != null && typeof ex.difficulty !== 'number' && typeof ex.difficulty !== 'string') {
        errors.push('explainability.difficulty 必须是 number | string | null');
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

var KnowledgePoint = require("shared/knowledge/knowledge-point.js");
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
__defs["shared/strategy/comprehensive-strategy.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var DEFAULT_DIFFICULTY = 2;

  
  var SUBJECT_MATH_ONLY = { math: 'math' };
  function assertMathSubject(subject) {
    var canon = { math: 'math' }[String(subject || '').toLowerCase()];
    if (!canon) return null;
    return SUBJECT_MATH_ONLY[canon] ? null : canon;
  }

  function getKB() {
    if (typeof require === 'function') {
      try { return require("shared/knowledge/knowledge-bank.js"); } catch (e) {  }
    }
    return null;
  }

  function getStrategyEngine() {
    if (typeof global !== 'undefined' && global.StrategyEngine) return global.StrategyEngine;
    if (typeof require === 'function') {
      try { return require("shared/strategy/strategy-engine.js"); } catch (e) {  }
    }
    return null;
  }

  
  
  function allocate(weights, total) {
    var n = weights.length;
    var out = new Array(n).fill(0);
    var wsum = 0;
    var remainders = [];

    for (var i = 0; i < n; i++) {
      var w = (typeof weights[i] === 'number' && weights[i] > 0) ? weights[i] : 0;
      wsum += w;
      remainders.push({ i: i, w: w });
    }
    if (wsum <= 0) return out;

    var assigned = 0;
    for (var j = 0; j < n; j++) {
      out[j] = Math.floor(total * weights[j] / wsum);
      assigned += out[j];
    }
    var leftover = total - assigned;
    if (leftover > 0) {
      remainders.sort(function (a, b) {
        var fa = total * a.w / wsum - Math.floor(total * a.w / wsum);
        var fb = total * b.w / wsum - Math.floor(total * b.w / wsum);
        return fb - fa || b.w - a.w;
      });
      for (var k = 0; k < leftover && k < n; k++) {
        out[remainders[k].i] += 1;
      }
    }
    return out;
  }

  
  
  function kpLearnerState(profile, kpId) {
    if (!profile || typeof profile !== 'object') return null;
    if (profile.knowledgePoints && profile.knowledgePoints[kpId] && typeof profile.knowledgePoints[kpId] === 'object') {
      return profile.knowledgePoints[kpId];
    }
    return null;
  }

  var STRATEGIES = {
    weighted: {
      name: 'weighted',
      weight: function (entry) {
        return (typeof entry.weight === 'number' && entry.weight > 0) ? entry.weight : 1;
      }
    },
    balanced: {
      name: 'balanced',
      weight: function (entry) {
        return 1;
      }
    },
    'weak-first': {
      name: 'weak-first',
      weight: function (entry, policy, profile) {
        var base = (typeof entry.weight === 'number' && entry.weight > 0) ? entry.weight : 1;
        var ls = kpLearnerState(profile, entry.id);
        if (ls && typeof ls.mastery === 'number') {
          return base * (1 + Math.pow(1 - Math.min(Math.max(ls.mastery, 0), 1), 1.5));
        }
        return base * 2; 
      }
    },
    'recent-first': {
      name: 'recent-first',
      weight: function (entry, policy, profile) {
        var base = (typeof entry.weight === 'number' && entry.weight > 0) ? entry.weight : 1;
        var ls = kpLearnerState(profile, entry.id);
        var exposure = ls && typeof ls.exposure === 'number' ? Math.max(ls.exposure, 0) : 0;
        return base * (1 + 1 / (1 + exposure));
      }
    }
  };

  
  
  function build(request) {
    if (!request || typeof request !== 'object') return Promise.reject(new Error('comprehensive request 必须是对象'));
    var subject = request.subject;
    var grade = request.grade;
    if (!subject) return Promise.reject(new Error('comprehensive 需要 subject'));
    
    var unsupported = assertMathSubject(subject);
    if (unsupported) {
      var uns = new Error('核心生成引擎仅支持数学（math）综合练习，暂不支持 ' + unsupported);
      uns.name = 'GenerationUnsupportedError';
      uns.code = 'UNSUPPORTED_SUBJECT';
      uns.subject = unsupported;
      return Promise.reject(uns);
    }
    if (grade == null) return Promise.reject(new Error('comprehensive 需要 grade'));
    
    var targetCount = request.count != null ? request.count : (request.volume != null ? request.volume : 10);
    if (typeof targetCount !== 'number' || !isFinite(targetCount) || targetCount < 1 || Math.floor(targetCount) !== targetCount) {
      return Promise.reject(new Error('count 必须是 >=1 的整数: ' + targetCount));
    }
    var policyName = ['weighted', 'balanced', 'weak-first', 'recent-first'].indexOf(request.coveragePolicy) !== -1
      ? request.coveragePolicy
      : 'weighted';
    var strategy = STRATEGIES[policyName];

    var KB = getKB();
    var engine = getStrategyEngine();
    var deps = [];
    if (!KB) deps.push('shared/engine/knowledge-compat.js');
    if (!engine) deps.push('shared/engine/strategy-engine.bundle.js');
    if (deps.length) return Promise.reject(new Error('ComprehensiveStrategy 依赖缺失: ' + deps.join(', ')));

    var entries = KB.getEntries(subject, grade) || [];
    
    if (request.unitId != null) {
      var unitFiltered = entries.filter(function (e) { return String(e.moduleId) === String(request.unitId); });
      if (unitFiltered.length) entries = unitFiltered;
    }
    if (request.questionTypes && Array.isArray(request.questionTypes) && request.questionTypes.length) {
      var qts = request.questionTypes;
      entries = entries.filter(function (e) {
        return (e.type && qts.indexOf(e.type) !== -1) || qts.indexOf(e.pluginId) !== -1;
      });
    }
    if (!entries.length) {
      return Promise.resolve({ plans: [], allocation: [], trace: { policy: policyName, coverage: { total: 0, covered: 0, ratio: 0 }, entries: [], fromEntries: false, message: '该年级无可用知识点' } });
    }

    
    var weights = entries.map(function (e) { return strategy.weight(e, policyName, request.learnerProfile); });
    var shares = allocate(weights, targetCount);

    var allocation = [];
    var planTasks = [];
    entries.forEach(function (e, i) {
      var cnt = shares[i];
      allocation.push({
        kpId: e.id,
        name: e.name,
        pluginId: e.pluginId,
        moduleId: e.moduleId,
        type: e.type || null,
        count: cnt,
        weight: (typeof e.weight === 'number' && e.weight > 0) ? e.weight : 1,
        policyScore: Math.round(weights[i] * 100) / 100
      });
      if (cnt < 1) return;
      planTasks.push({ entry: e, count: cnt, baseWeight: (typeof e.weight === 'number' && e.weight > 0) ? e.weight : 1 });
    });

    
    var plans = [];
    var failedPlans = [];
    var difficulty = request.difficulty != null ? request.difficulty : DEFAULT_DIFFICULTY;

    planTasks.forEach(function (task) {
      var req = {
        knowledgePointIds: [task.entry.id],
        count: task.count,
        difficulty: difficulty,
        learnerProfile: request.learnerProfile || null
      };
      if (request.questionType != null) req.questionType = request.questionType;
      try {
        var res = engine.plan(req);
        var qp = res && res.plans && res.plans[0];
        if (!qp) {
          failedPlans.push({ kpId: task.entry.id, error: 'StrategyEngine 未产出计划' });
          return;
        }
        qp.__comprehensive = {
          kpId: task.entry.id,
          pluginId: task.entry.pluginId,
          weight: task.baseWeight
        };
        plans.push(qp);
      } catch (e) {
        failedPlans.push({ kpId: task.entry.id, error: String((e && e.message) || e) });
      }
    });

    
    var mixed = interleaveByPlugin(plans);
    var mixing = { reordered: mixed.length > 0, original: plans.length };

    
    var coveredIds = {};
    allocation.forEach(function (a) { if (a.count > 0) coveredIds[a.pluginId] = true; });
    var totalPlugins = {};
    entries.forEach(function (e) { totalPlugins[e.pluginId] = true; });

    return Promise.resolve({
      plans: mixed,
      allocation: allocation,
      trace: {
        policy: policyName,
        coverage: {
          total: Object.keys(totalPlugins).length,
          plugins: Object.keys(coveredIds).length,
          entries: entries.length,
          coveredEntries: allocation.filter(function (a) { return a.count > 0; }).length,
          ratio: entries.length ? Math.round(allocation.filter(function (a) { return a.count > 0; }).length / entries.length * 100) / 100 : 0
        },
        entries: allocation,
        failedPlans: failedPlans,
        mixing: mixing
      }
    });
  }

  
  function interleaveByPlugin(plans) {
    if (!plans || plans.length < 2) return plans || [];
    var groups = {};
    plans.forEach(function (p) {
      var plugin = (p && p.__comprehensive && p.__comprehensive.pluginId) || p.pluginId || '?';
      (groups[plugin] = groups[plugin] || []).push(p);
    });
    var keys = Object.keys(groups).sort(function (a, b) { return groups[b].length - groups[a].length; });
    var out = [];
    var pick = 0;
    var guard = 0;
    while (pick < plans.length && guard < plans.length + keys.length) {
      guard++;
      var progress = false;
      for (var i = 0; i < keys.length && pick < plans.length; i++) {
        var bucket = groups[keys[i]];
        if (bucket.length) {
          out.push(bucket.shift());
          pick++;
          progress = true;
        }
      }
      if (!progress) break;
    }
    return out;
  }

  var API = {
    build: build,
    allocate: allocate,
    allocateByWeight: allocate, 
    scoreEntries: function (entries, policy, profile) {
      var strat = STRATEGIES[policy] || STRATEGIES.weighted;
      return entries.map(function (e, idx) {
        var base = (typeof e.weight === 'number' && e.weight > 0) ? e.weight : 1;
        return { index: idx, base: base, policyScore: strat.weight(e, policy, profile) };
      });
    },
    interleaveByPlugin: interleaveByPlugin,
    STRATEGIES: STRATEGIES,
    DEFAULT_DIFFICULTY: DEFAULT_DIFFICULTY
  };

  global.ComprehensiveStrategy = API;
  if (global.App && typeof global.App === 'object') global.App.ComprehensiveStrategy = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);
};
__defs["shared/capability/capability-resolver.js"] = function (module, exports, require) {

'use strict';

var Ontology = require("shared/knowledge/knowledge-ontology.js");
var Registry = require("shared/knowledge/question-type-registry.js");
var KnowledgePoint = require("shared/knowledge/knowledge-point.js");
var CapabilityModel = require("shared/capability/capability-model.js");
var Matrix = require("shared/capability/capability-matrix.js");













var TEACHING_DENIALS = {};

function isTeachingDenied(kpId, qtId) {
  return !!kpId && !!qtId &&
    Object.prototype.hasOwnProperty.call(TEACHING_DENIALS, kpId + '|' + qtId);
}

function listTeachingDenials() {
  return Object.keys(TEACHING_DENIALS).map(function (key) {
    var parts = key.split('|');
    return { knowledgeId: parts[0], questionType: parts[1], batch: TEACHING_DENIALS[key] };
  });
}

function resolve(kp) {
  
  
  if (kp && !kp.presentation && (kp.applicable_question_types || kp.grade || kp.modules)) {
    try { kp = Ontology.normalize(kp); } catch (e) {  }
  }
  return CapabilityModel.resolveCapability(kp);
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

  
  
  var teachingDenial = null;
  if ((decision === 'ALLOW' || decision === 'DEGRADE') && isTeachingDenied(kpId, qtId)) {
    teachingDenial = 'P25-06';
    decision = 'FORBID';
  }

  var confidence = 'declared';
  if (decision === 'ALLOW') confidence = 'declared';
  else if (decision === 'DEGRADE') confidence = 'inferred';
  else if (decision === 'MISSING') confidence = 'unknown';
  if (teachingDenial) confidence = 'teaching-denied';

  return {
    knowledgePointId: kpId,
    questionType: qtId,
    capability: qt.category,
    decision: decision,
    source: {
      knowledgePoint: 'ontology',
      questionType: 'registry',
      matrix: 'R04',
      teachingDenial: teachingDenial
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
  
  
  var kpId = (typeof kp === 'string') ? kp
    : (kp && (kp.id || kp.knowledgePointId || kp.knowledgeId)) || cap.knowledgePointId || '';
  
  
  var liveTypes = cap.questionTypes.filter(function (q) {
    return !isTeachingDenied(kpId, q.id);
  });
  var questionTypes = liveTypes.map(function (q) { return q.id; });
  var cognitiveLevels = {};
  var difficultyRange = {};
  liveTypes.forEach(function (q) {
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
  getCapabilities: getCapabilities,
  isTeachingDenied: isTeachingDenied,
  listTeachingDenials: listTeachingDenials
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




function variantFor(mastery, confidence, errorFocus, misconceptionDirectives) {
  var m = clamp(safeNumber(mastery, 0), 0, 1);
  var conf = clamp(safeNumber(confidence, 0), 0, 1);
  if (misconceptionDirectives && misconceptionDirectives.length && errorFocus && errorFocus.length) {
    return misconceptionDirectives[0].variant;
  }
  
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

  var variant = variantFor(mastery, confidence, focus, opts.misconceptionDirectives);

  return {
    effectiveDifficulty: effectiveDifficulty,
    targetSpiralLevel: targetSpiral,
    cognitiveLevel: cognitiveFor(mastery),
    variant: variant,
    errorFocus: focus,
    variationDirectives: Array.isArray(opts.misconceptionDirectives) ? opts.misconceptionDirectives : [],
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
__defs["shared/generator/generator-registry.js"] = function (module, exports, require) {

'use strict';






var CORE_RECORDS = [
  
  { id: 'generator:arithmetic-addition', subject: 'math', capabilities: ['calc', 'fill', 'apply'], questionTypes: ['calc', 'fill', 'apply'], knowledgePoints: ['math-g1-down-u04-k002', 'math-g1-down-u05-k001', 'math-g1-down-u06-k001', 'math-g1-up-u01-k002', 'math-g1-up-u01-k003', 'math-g1-up-u04-k003', 'math-g1-up-u05-k001', 'math-g1-up-u05-k002', 'math-g2-down-u04-k007', 'math-g2-down-u05-k001', 'math-g2-down-u05-k003', 'math-g4-down-u03-k001', 'math-g4-up-u04-k001'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-subtraction', subject: 'math', capabilities: ['calc', 'fill', 'apply'], questionTypes: ['calc', 'fill', 'apply'], knowledgePoints: ['math-g1-down-u02-k001', 'math-g1-down-u02-k002', 'math-g1-down-u03-k001', 'math-g1-down-u04-k001', 'math-g1-down-u04-k003', 'math-g1-down-u04-k004', 'math-g1-down-u05-k002', 'math-g1-up-u04-k001', 'math-g2-up-u02-k002', 'math-g2-up-u02-k004', 'math-g2-down-u05-k002', 'math-g4-down-u03-k002', 'math-g4-up-u01-k001'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-multiplication', subject: 'math', capabilities: ['calc', 'fill', 'apply'], questionTypes: ['calc', 'fill', 'apply'], knowledgePoints: ['math-g2-up-u02-k001', 'math-g2-up-u02-k003', 'math-g3-up-u05-k001', 'math-g3-up-u05-k002', 'math-g3-up-u05-k003', 'math-g3-up-u05-k004', 'math-g3-up-u05-k005', 'math-g4-up-u03-k001', 'math-g4-up-u03-k002', 'math-g4-up-u03-k003', 'math-g4-down-u03-k003', 'math-g4-up-u04-k002', 'math-g4-up-u04-k003', 'math-g4-up-u06-k001', 'math-g4-up-u06-k002'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-division', subject: 'math', capabilities: ['calc', 'fill', 'apply'], questionTypes: ['calc', 'fill', 'apply'], knowledgePoints: ['math-g2-down-u02-k001', 'math-g2-down-u02-k002', 'math-g2-down-u02-k003', 'math-g2-down-u02-k004', 'math-g2-down-u03-k002', 'math-g2-down-u03-k006', 'math-g2-up-u03-k001', 'math-g2-up-u03-k002', 'math-g2-up-u03-k003', 'math-g2-up-u03-k004', 'math-g2-up-u03-k005', 'math-g2-up-u07-k002', 'math-g3-down-u02-k001', 'math-g3-down-u02-k002', 'math-g3-down-u02-k003', 'math-g3-down-u02-k004', 'math-g3-down-u02-k005', 'math-g3-down-u02-k006', 'math-g4-up-u06-k002', 'math-g4-up-u06-k003', 'math-g5-down-u02-k001', 'math-g5-down-u02-k002', 'math-g5-up-u03-k003'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-mixed-calculation', subject: 'math', capabilities: ['calc', 'fill', 'apply'], questionTypes: ['calc', 'fill', 'apply'], knowledgePoints: ['math-g1-up-u02-k002', 'math-g3-up-u02-k001', 'math-g3-up-u02-k002', 'math-g3-up-u02-k003', 'math-g3-up-u02-k004', 'math-g4-down-u01-k003', 'math-g4-down-u03-k004', 'math-g6-up-u02-k002', 'math-g6-up-u02-k003', 'math-g6-up-u02-k004'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-fill', subject: 'math', capabilities: ['fill', 'geometry', 'calc', 'apply'], questionTypes: ['fill', 'geometry', 'calc', 'apply'], knowledgePoints: ['math-g2-down-u07-k002'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-choice', subject: 'math', capabilities: ['choice', 'geometry', 'calc', 'apply'], questionTypes: ['choice', 'geometry', 'calc', 'apply'], knowledgePoints: [], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-judge', subject: 'math', capabilities: ['judge', 'geometry', 'calc', 'apply'], questionTypes: ['judge', 'geometry', 'calc', 'apply'], knowledgePoints: [], scope: 'core', version: 1, supportsComposite: false },
  
  { id: 'generator:complex-calc', subject: 'math', capabilities: ['calc', 'fill'], questionTypes: ['calc', 'fill'],
    knowledgePoints: [],
    scope: 'core', version: 1, supportsComposite: false },

  
  
  
  
  
  
  
  
  
  
  { id: 'generator:shape-recognition', subject: 'math', capabilities: ['choice', 'judge', 'fill', 'calc', 'geometry', 'apply'], questionTypes: ['choice', 'judge', 'fill', 'calc', 'geometry', 'apply'],
    knowledgePoints: ['math-g2-up-u01-k001', 'math-g2-up-u01-k002', 'math-g3-down-u05-k001', 'math-g4-down-u02-k001', 'math-g4-down-u07-k001', 'math-g4-down-u07-k002', 'math-g5-down-u01-k001', 'math-g5-down-u03-k004', 'math-g5-down-u03-k005', 'math-g5-down-u05-k001', 'math-g5-down-u05-k002', 'math-g5-down-u05-k003', 'math-g5-down-u05-k004', 'math-g5-up-u06-k001', 'math-g5-up-u06-k002', 'math-g5-up-u06-k003', 'math-g5-up-u06-k004', 'math-g5-up-u06-k005', 'math-g5-up-u06-k006', 'math-g6-down-u03-k001', 'math-g6-down-u03-k002', 'math-g6-down-u03-k003', 'math-g6-down-u03-k004', 'math-g6-up-u02-k001', 'math-g1-down-u01-k001', 'math-g1-up-u03-k002', 'math-g2-up-u05-k003', 'math-g2-up-u05-k004', 'math-g2-up-u06-k001', 'math-g3-down-u01-k001', 'math-g3-down-u03-k004', 'math-g3-down-u08-k003', 'math-g3-down-u08-k006', 'math-g3-up-u01-k002', 'math-g3-up-u01-k003', 'math-g3-up-u03-k003', 'math-g3-up-u03-k004', 'math-g3-up-u07-k001', 'math-g3-up-u07-k004', 'math-g4-down-u02-k002', 'math-g4-down-u05-k001', 'math-g4-down-u05-k002', 'math-g4-down-u05-k003', 'math-g4-down-u05-k004', 'math-g4-down-u05-k005', 'math-g4-down-u05-k006', 'math-g4-up-u02-k001', 'math-g4-up-u02-k003', 'math-g4-up-u05-k001', 'math-g4-up-u05-k002', 'math-g4-up-u05-k003', 'math-g4-up-u05-k004', 'math-g5-down-u01-k002', 'math-g5-down-u03-k001', 'math-g5-down-u03-k002', 'math-g5-up-u08-k001', 'math-g5-up-u08-k002', 'math-g5-up-u08-k003', 'math-g5-up-u08-k004', 'math-g6-down-u03-k006', 'math-g6-up-u04-k001', 'math-g6-up-u04-k004', 'math-g6-up-u04-k005', 'math-g2-up-u05-k002', 'math-g3-down-u03-k002', 'math-g3-down-u03-k003', 'math-g3-down-u04-k003', 'math-g3-down-u04-k005', 'math-g3-up-u07-k003', 'math-g4-up-u02-k002', 'math-g5-down-u03-k003', 'math-g6-down-u03-k005', 'math-g6-up-u04-k002', 'math-g6-up-u04-k003', 'math-g1-up-u03-k001', 'math-g3-down-u03-k001', 'math-g5-down-u09-k001', 'math-g5-down-u09-k002',
      
      
      
      'math-g2-up-u05-k001', 'math-g2-up-u05-k005', 'math-g3-down-u04-k002', 'math-g3-down-u04-k004',
      'math-g3-up-u03-k001', 'math-g3-up-u03-k002', 'math-g5-down-u03-k006',
      'math-g6-up-u02-k002', 'math-g6-up-u02-k003', 'math-g6-up-u02-k004'],
    scope: 'core', version: 3, supportsComposite: false },
  { id: 'generator:position-direction', subject: 'math', capabilities: ['choice', 'judge', 'fill', 'geometry', 'apply'], questionTypes: ['choice', 'judge', 'fill', 'geometry', 'apply'],
    knowledgePoints: ['math-g2-up-u04-k003', 'math-g2-up-u04-k004', 'math-g3-down-u01-k002', 'math-g3-down-u01-k003', 'math-g3-down-u01-k004', 'math-g3-up-u01-k001', 'math-g4-down-u02-k003', 'math-g4-down-u07-k003', 'math-g4-down-u07-k004', 'math-g4-down-u07-k005', 'math-g5-down-u01-k003', 'math-g5-up-u01-k001', 'math-g5-up-u01-k003', 'math-g5-up-u04-k001', 'math-g5-up-u04-k002', 'math-g6-up-u01-k001', 'math-g6-up-u01-k002', 'math-g6-up-u01-k003', 'math-g2-up-u04-k001', 'math-g2-up-u04-k002', 'math-g5-up-u01-k002', 'math-g4-up-u08-k001', 'math-g4-up-u08-k002', 'math-g4-up-u08-k003', 'math-g5-up-u04-k003'],
    scope: 'core', version: 2, supportsComposite: false },
  { id: 'generator:money-measurement', subject: 'math', capabilities: ['fill', 'choice', 'judge', 'apply', 'calc'], questionTypes: ['fill', 'choice', 'judge', 'apply', 'calc'],
    knowledgePoints: ['math-g1-down-u07-k001', 'math-g1-down-u07-k002', 'math-g2-up-u05-k001', 'math-g2-up-u05-k005', 'math-g3-down-u04-k002', 'math-g3-down-u04-k004', 'math-g3-up-u03-k001', 'math-g3-up-u03-k002', 'math-g1-down-u07-k003', 'math-g3-up-u04-k002', 'math-g3-up-u04-k003', 'math-g3-up-u04-k004'],
    scope: 'core', version: 2, supportsComposite: false },
  { id: 'generator:application-word', subject: 'math', capabilities: ['apply', 'fill', 'choice', 'judge', 'calc'], questionTypes: ['apply', 'fill', 'choice', 'judge', 'calc'],
    knowledgePoints: ['math-g4-up-u06-k001', 'math-g5-down-u03-k006', 'math-g1-down-u08-k001', 'math-g2-up-u08-k001', 'math-g3-up-u09-k001', 'math-g4-down-u10-k001', 'math-g4-up-u09-k001', 'math-g5-down-u11-k001', 'math-g5-up-u09-k001', 'math-g6-down-u06-k001', 'math-g6-up-u06-k001', 'math-g1-down-u02-k003', 'math-g1-down-u04-k005', 'math-g1-down-u05-k003', 'math-g1-down-u06-k003', 'math-g1-up-u05-k003', 'math-g1-up-u06-k001', 'math-g2-down-u05-k004', 'math-g2-down-u06-k001', 'math-g2-down-u06-k002', 'math-g2-down-u06-k003', 'math-g2-down-u06-k004', 'math-g2-down-u07-k001', 'math-g2-down-u07-k003', 'math-g3-down-u08-k002', 'math-g3-down-u08-k005', 'math-g3-up-u02-k005', 'math-g3-up-u04-k001', 'math-g4-down-u01-k004', 'math-g4-down-u09-k003', 'math-g5-up-u03-k006', 'math-g5-down-u09-k003', 'math-g6-down-u01-k005'],
    scope: 'core', version: 2, supportsComposite: false },

  
  { id: 'generator:counting', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g3-down-u08-k001', 'math-g3-up-u08-k001'],
    scope: 'core', version: 1, supportsComposite: false },
  
  
  
  
  
  { id: 'generator:reasoning', subject: 'math', capabilities: ['apply', 'calc', 'fill', 'choice'], questionTypes: ['apply', 'calc', 'fill', 'choice'],
    knowledgePoints: ['math-g2-up-u07-k001', 'math-g4-down-u09-k001', 'math-g4-down-u09-k002', 'math-g5-down-u08-k001', 'math-g5-down-u08-k002', 'math-g5-down-u08-k003', 'math-g5-down-u10-k001', 'math-g5-down-u10-k002', 'math-g5-down-u10-k003', 'math-g5-down-u10-k004', 'math-g5-up-u07-k002', 'math-g6-down-u05-k001', 'math-g6-down-u05-k002', 'math-g6-down-u05-k003', 'math-g6-down-u05-k004'],
    scope: 'core', version: 1, supportsComposite: false },
  
  
  
  { id: 'generator:stats', subject: 'math', capabilities: ['apply', 'calc', 'fill', 'choice'], questionTypes: ['apply', 'calc', 'fill', 'choice'],
    knowledgePoints: ['math-g2-down-u01-k001', 'math-g2-down-u01-k002', 'math-g2-down-u01-k003', 'math-g3-down-u06-k001', 'math-g3-down-u06-k002', 'math-g3-down-u08-k004', 'math-g4-down-u08-k004', 'math-g4-up-u07-k001', 'math-g5-down-u07-k001', 'math-g5-down-u07-k002', 'math-g5-down-u07-k003'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:picture-equation', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g4-down-u01-k001', 'math-g5-up-u07-k003'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c1-number-puzzle', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: [],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c2-number-theory', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: [],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c5-c6-journey-engineering', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: [],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c7-clever-calc', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: [],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c9-comprehensive', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: [],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:composite', subject: 'math', capabilities: ['calc', 'judge', 'fill', 'apply'], questionTypes: ['calc', 'judge', 'fill', 'apply'],
    knowledgePoints: ['math-g1-up-u01-k001', 'math-g2-down-u07-k001', 'math-g2-up-u01-k005', 'math-g3-up-u02-k001', 'math-g4-up-u03-k001'],
    scope: 'core', version: 1, supportsComposite: true },

  
  
  
  
  
  { id: 'generator:code-recognition', subject: 'math', capabilities: ['fill', 'choice', 'judge', 'apply'], questionTypes: ['fill', 'choice', 'judge', 'apply'],
    knowledgePoints: ['math-g3-up-u06-k001', 'math-g3-up-u06-k002', 'math-g3-up-u06-k003', 'math-g3-up-u06-k004', 'math-g3-up-u06-k005'],
    scope: 'core', version: 2, supportsComposite: false },
  { id: 'generator:equivalent-reasoning', subject: 'math', capabilities: ['fill', 'choice', 'apply'], questionTypes: ['fill', 'choice', 'apply'],
    knowledgePoints: [],
    scope: 'core', version: 2, supportsComposite: false },

  
  
  
  
  
  { id: 'generator:classification', subject: 'math', capabilities: ['classify'], questionTypes: ['classify'],
    knowledgePoints: ['math-g2-up-u01-k001', 'math-g2-up-u01-k002', 'math-g2-up-u01-k003', 'math-g2-up-u01-k004', 'math-g2-up-u01-k005', 'math-g2-up-u01-k006', 'math-g3-down-u05-k001', 'math-g3-down-u05-k002', 'math-g3-down-u05-k003', 'math-g3-down-u05-k004', 'math-g4-up-u06-k001', 'math-g4-up-u06-k002', 'math-g4-up-u06-k003', 'math-g4-up-u06-k004', 'math-g4-down-u08-k001', 'math-g4-down-u08-k002', 'math-g4-down-u08-k003', 'math-g4-down-u08-k004', 'math-g5-up-u07-k001', 'math-g5-up-u07-k002', 'math-g5-up-u07-k003', 'math-g5-up-u07-k004', 'math-g5-down-u07-k001', 'math-g5-down-u07-k002', 'math-g5-down-u07-k003'],
    scope: 'core', version: 2, supportsComposite: false },

  
  
  
  
  { id: 'generator:percent-calc', subject: 'math', capabilities: ['calc', 'fill', 'apply'], questionTypes: ['calc', 'fill', 'apply'],
    knowledgePoints: ['math-g6-up-u05-k001', 'math-g6-up-u05-k002', 'math-g6-up-u05-k003', 'math-g6-up-u05-k004', 'math-g6-up-u05-k005', 'math-g6-up-u05-k006', 'math-g6-down-u02-k001', 'math-g6-down-u02-k002', 'math-g6-down-u02-k003', 'math-g6-down-u02-k004', 'math-g6-down-u02-k005'],
    scope: 'core', version: 1, supportsComposite: false },

  
  
  
  
  
  
  
  
  
  { id: 'generator:concept-meaning', subject: 'math', capabilities: ['calc', 'fill', 'apply', 'choice', 'geometry', 'judge'], questionTypes: ['calc', 'fill', 'apply', 'choice', 'geometry', 'judge'],
    knowledgePoints: ['math-g2-down-u03-k003', 'math-g3-up-u07-k002', 'math-g3-down-u04-k001', 'math-g5-down-u04-k001', 'math-g1-down-u03-k002', 'math-g1-down-u03-k003', 'math-g1-down-u03-k004', 'math-g1-down-u03-k005', 'math-g1-down-u03-k006', 'math-g1-up-u02-k001', 'math-g1-up-u04-k002', 'math-g2-down-u04-k001', 'math-g2-down-u04-k002', 'math-g2-down-u04-k003', 'math-g2-down-u04-k004', 'math-g2-down-u04-k005', 'math-g2-down-u04-k006', 'math-g4-up-u01-k002', 'math-g4-up-u01-k003', 'math-g4-up-u01-k004', 'math-g4-up-u01-k005', 'math-g4-up-u01-k006', 'math-g5-up-u05-k004', 'math-g5-down-u02-k003', 'math-g5-down-u02-k004', 'math-g5-down-u02-k005', 'math-g5-down-u02-k006', 'math-g6-down-u01-k001', 'math-g6-down-u01-k002', 'math-g6-down-u01-k003', 'math-g6-down-u01-k004', 'math-g6-up-u07-k001', 'math-g6-up-u07-k002', 'math-g6-up-u07-k003', 'math-g5-up-u05-k001', 'math-g5-up-u05-k002', 'math-g5-up-u05-k003', 'math-g2-down-u03-k001', 'math-g4-down-u01-k002', 'math-g2-down-u03-k004', 'math-g2-down-u03-k005', 'math-g1-up-u01-k001'],
    scope: 'core', version: 1, supportsComposite: false },

  
  
  { id: 'generator:semantic-relations', subject: 'math', capabilities: ['calc', 'fill', 'apply', 'choice', 'geometry'], questionTypes: ['calc', 'fill', 'apply', 'choice', 'geometry'],
    knowledgePoints: ['math-g1-down-u06-k002', 'math-g2-down-u02-k005', 'math-g6-down-u04-k001', 'math-g6-down-u04-k002', 'math-g6-down-u04-k003', 'math-g6-down-u04-k004', 'math-g6-down-u04-k005', 'math-g6-down-u04-k006', 'math-g6-down-u04-k007', 'math-g6-down-u04-k008'],
    scope: 'core', version: 1, supportsComposite: false },

  
  
  { id: 'generator:decimal-number', subject: 'math', capabilities: ['calc', 'fill', 'choice', 'apply'], questionTypes: ['calc', 'fill', 'choice', 'apply'],
    knowledgePoints: ['math-g3-down-u07-k001', 'math-g3-down-u07-k002', 'math-g3-down-u07-k003', 'math-g3-down-u07-k004', 'math-g4-down-u04-k001', 'math-g4-down-u04-k002', 'math-g4-down-u04-k003', 'math-g4-down-u04-k004', 'math-g4-down-u04-k005', 'math-g4-down-u04-k006', 'math-g4-down-u04-k007', 'math-g4-down-u06-k001', 'math-g4-down-u06-k002', 'math-g4-down-u06-k003', 'math-g4-down-u06-k004', 'math-g5-up-u02-k001', 'math-g5-up-u02-k002', 'math-g5-up-u02-k003', 'math-g5-up-u02-k004', 'math-g5-up-u02-k005', 'math-g5-up-u03-k001', 'math-g5-up-u03-k002', 'math-g5-up-u03-k004', 'math-g5-up-u03-k005'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:fraction-number', subject: 'math', capabilities: ['calc', 'fill', 'choice', 'apply'], questionTypes: ['calc', 'fill', 'choice', 'apply'],
    knowledgePoints: ['math-g3-up-u08-k002', 'math-g3-up-u08-k003', 'math-g3-up-u08-k004', 'math-g3-up-u08-k005', 'math-g5-down-u04-k002', 'math-g5-down-u04-k003', 'math-g5-down-u04-k004', 'math-g5-down-u04-k005', 'math-g5-down-u04-k006', 'math-g5-down-u06-k001', 'math-g5-down-u06-k002', 'math-g5-down-u06-k003', 'math-g5-down-u06-k004', 'math-g5-down-u06-k005', 'math-g6-up-u03-k001', 'math-g6-up-u03-k002', 'math-g6-up-u03-k003', 'math-g6-up-u03-k004', 'math-g6-up-u03-k005'],
    scope: 'core', version: 1, supportsComposite: false }
];





var QTR = (function () {
  try { return require("shared/knowledge/question-type-registry.js"); }
  catch (e) {
    return (typeof window !== 'undefined' && window.QuestionTypeRegistry) ||
      (typeof globalThis !== 'undefined' && globalThis.QuestionTypeRegistry) || null;
  }
})();

function normToken(tok) {
  if (!tok || typeof tok !== 'string') return tok;
  if (!QTR) return tok;
  var r = QTR.normalizeQuestionType(tok, { allowHeuristic: false });
  return (r && r.id) ? r.id : tok;
}

function normList(arr) {
  if (!Array.isArray(arr)) return arr;
  var seen = {}, out = [];
  arr.forEach(function (t) {
    var n = normToken(t);
    if (n && !seen[n]) { seen[n] = 1; out.push(n); }
  });
  return out;
}

function buildRecords() {
  
  
  return CORE_RECORDS.map(function (r) {
    return {
      id: r.id,
      subject: r.subject,
      capabilities: normList(r.capabilities),
      questionTypes: normList(r.questionTypes),
      knowledgePoints: r.knowledgePoints,
      scope: r.scope,
      version: r.version,
      supportsComposite: r.supportsComposite
    };
  });
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
  var KnowledgePoint = require("shared/knowledge/knowledge-point.js");
  var Resolver = require("shared/capability/capability-resolver.js");
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
    var Resolver = require("shared/capability/capability-resolver.js");
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





var CANONICAL_KP_OVERRIDES = [
  
  { knowledgePoints: ['math-g5-up-u02-k002'], operators: [OP_MUL], steps: 1, kind: 'dec-mult' }
];

var CANONICAL_KP_PROFILE = {};
CANONICAL_KP_OVERRIDES.forEach(function (rec) {
  rec.knowledgePoints.forEach(function (kpId) { CANONICAL_KP_PROFILE[kpId] = rec; });
});


function resolveArithmeticSemantics(kp, options) {
  options = options || {};
  if (!kp || !kp.source) return null;

  
  var kpId = kp.knowledgeId || kp.id || (kp.source && kp.source.knowledgeId);
  var canonical = kpId ? CANONICAL_KP_PROFILE[kpId] : null;
  if (canonical) {
    var cout = {
      operators: canonical.operators.slice(),
      steps: canonical.steps,
      canonicalKp: kpId,
      migratable: true
    };
    if (canonical.kind) cout.kind = canonical.kind;
    return cout;
  }

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
  CANONICAL_KP_PROFILE: CANONICAL_KP_PROFILE,
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
  var RECENT_ERRORS_CAP = 20;   
  var DIFF_MIN = 1, DIFF_MAX = 10;

  
  function defaultKpState(kpId) {
    return {
      kpId: kpId || null,
      mastery: 0,
      confidence: 0,
      attempts: 0,
      correct: 0,
      incorrect: 0,                     
      accuracy: 0,
      recentAccuracy: 0,
      recentResults: [],
      errorPatterns: {},
      exposureCount: 0,
      lastPracticedAt: null,
      recommendedDifficulty: DIFF_MIN,
      recommendedSpiralLevel: 1,
      updatedAt: null,
      
      questionTypeStats: {},           
      semanticTargetStats: {},         
      recentErrors: [],                
      misconceptionStats: []           
    };
  }

  
  function defaultQtBucket() {
    return { attempts: 0, correct: 0, incorrect: 0, recentResults: [], lastPracticedAt: null };
  }
  function defaultStBucket() {
    return { attempts: 0, correct: 0, incorrect: 0, lastPracticedAt: null };
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
    d.incorrect = Math.max(0, d.attempts - d.correct);        
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
    
    d.questionTypeStats = normalizeQtStats(raw.questionTypeStats);
    d.semanticTargetStats = normalizeStStats(raw.semanticTargetStats);
    d.recentErrors = normalizeRecentErrors(raw.recentErrors);
    
    d.misconceptionStats = ErrorModel.getErrorFocus(d.errorPatterns);
    
    if ((raw.mastery == null || typeof raw.mastery !== 'number' || !isFinite(raw.mastery)) && d.attempts) {
      d.mastery = recomputeMasteryFallback(d);
    }
    return d;
  }

  
  function normalizeQtStats(raw) {
    var out = {};
    if (raw == null || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(function (qt) {
      if (!qt) return;
      var b = raw[qt];
      if (b == null || typeof b !== 'object') b = {};
      var attempts = nonNegInt(b.attempts);
      var correct = Math.min(nonNegInt(b.correct), attempts);
      out[qt] = {
        attempts: attempts,
        correct: correct,
        incorrect: Math.max(0, attempts - correct),
        recentResults: valuesAre01Array(b.recentResults),
        lastPracticedAt: isValidTs(b.lastPracticedAt) ? b.lastPracticedAt : null
      };
    });
    return out;
  }

  
  function normalizeStStats(raw) {
    var out = {};
    if (raw == null || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(function (st) {
      var key = (st == null || st === 'null') ? 'null' : String(st);
      var b = raw[st];
      if (b == null || typeof b !== 'object') b = {};
      var attempts = nonNegInt(b.attempts);
      var correct = Math.min(nonNegInt(b.correct), attempts);
      out[key] = {
        attempts: attempts,
        correct: correct,
        incorrect: Math.max(0, attempts - correct),
        lastPracticedAt: isValidTs(b.lastPracticedAt) ? b.lastPracticedAt : null
      };
    });
    return out;
  }

  
  function normalizeRecentErrors(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(function (e) {
      if (e == null || typeof e !== 'object') return null;
      return {
        questionType: (typeof e.questionType === 'string' && e.questionType) ? e.questionType : null,
        semanticTarget: (typeof e.semanticTarget === 'string' && e.semanticTarget) ? e.semanticTarget : null,
        errorType: ErrorModel.normalizeErrorType(e.errorType),
        correct: false,           
        timestamp: isValidTs(e.timestamp) ? e.timestamp : null
      };
    }).filter(function (e) { return e && e.timestamp != null; }).slice(-RECENT_ERRORS_CAP);
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

    
    
    if (!isSkip) {
      var qt = (typeof result.questionType === 'string' && result.questionType) ? result.questionType : null;
      var st = (typeof result.semanticTarget === 'string' && result.semanticTarget) ? result.semanticTarget : null;
      var stKey = st || 'null';
      var qtBucket = kp.questionTypeStats[qt] || defaultQtBucket();
      var stBucket = kp.semanticTargetStats[stKey] || defaultStBucket();
      if (!isRedo) {
        qtBucket.attempts += 1;
        stBucket.attempts += 1;
        if (res === 1) {
          qtBucket.correct += 1;
          stBucket.correct += 1;
        } else {
          qtBucket.incorrect += 1;
          stBucket.incorrect += 1;
        }
      }
      qtBucket.recentResults.push(res);
      if (qtBucket.recentResults.length > RECENT_RESULTS_CAP) {
        qtBucket.recentResults = qtBucket.recentResults.slice(-RECENT_RESULTS_CAP);
      }
      qtBucket.lastPracticedAt = ts;
      stBucket.lastPracticedAt = ts;
      kp.questionTypeStats[qt] = qtBucket;
      kp.semanticTargetStats[stKey] = stBucket;

      
      if (res === 0) {
        kp.recentErrors.push({
          questionType: qt,
          semanticTarget: st,
          errorType: etype,
          correct: false,
          timestamp: ts
        });
        if (kp.recentErrors.length > RECENT_ERRORS_CAP) {
          kp.recentErrors = kp.recentErrors.slice(-RECENT_ERRORS_CAP);
        }
      }
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
__defs["shared/strategy/variation-directive.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  
  var CHAIN_SEGMENTS = ['Misconception', 'Trigger', 'QuestionVariation', 'ExpectedError', 'Feedback'];

  var _overlay = null;
  var _overlayLoaded = false;

  function getOverlay() {
    if (_overlayLoaded) return _overlay;
    _overlayLoaded = true;
    try {
      var p = '../../' + 'kbl/' + 'teaching/' + 'misconception-profiles.json';
      var doc = require(p);
      if (doc && doc.kps && typeof doc.kps === 'object') _overlay = doc;
    } catch (e) {  }
    return _overlay;
  }

  
  var OP_NORM = {
    '+': 'add', '−': 'sub', '-': 'sub', '×': 'mult', '*': 'mult', '÷': 'div', '/': 'div',
    'add': 'add', 'sub': 'sub', 'mult': 'mult', 'div': 'div',
    'addition': 'add', 'subtraction': 'sub', 'multiplication': 'mult', 'division': 'div'
  };

  function normalizeOps(tokens) {
    var out = [];
    var arr = Array.isArray(tokens) ? tokens : (tokens == null ? [] : [tokens]);
    arr.forEach(function (t) {
      if (t == null) return;
      var key = String(t);
      var n = OP_NORM[key] || OP_NORM[key.toLowerCase()];
      if (n && out.indexOf(n) === -1) out.push(n);
    });
    return out;
  }

  
  function resolveForPlan(opts) {
    var overlay = getOverlay();
    if (!overlay || !opts || !opts.kpId) return [];
    if (!Array.isArray(opts.errorTypes) || !opts.errorTypes.length) return [];
    var entry = overlay.kps[opts.kpId];
    if (!entry || !Array.isArray(entry.slots)) return [];
    var focus = {};
    opts.errorTypes.forEach(function (t) { if (typeof t === 'string') focus[t] = true; });
    var planOps = normalizeOps(opts.operationTokens);
    var out = [];
    entry.slots.forEach(function (slot) {
      if (!slot || !focus[slot.errorType]) return;
      var tp = slot.triggerPattern || {};
      if (Array.isArray(tp.questionTypes) && tp.questionTypes.indexOf(opts.questionTypeId) === -1) return;
      if (Array.isArray(tp.operations) && tp.operations.length) {
        var hit = false;
        tp.operations.forEach(function (op) { if (planOps.indexOf(op) !== -1) hit = true; });
        if (!hit) return;
      }
      var resp = slot.response || {};
      out.push({
        errorType: slot.errorType,
        expectedError: slot.errorType,
        variant: resp.variant,
        axis: resp.axis,
        feedback: typeof slot.feedback === 'string' ? slot.feedback : '',
        basis: slot.basis
      });
    });
    return out;
  }

  var VariationDirective = {
    resolveForPlan: resolveForPlan,
    normalizeOps: normalizeOps,
    getOverlay: getOverlay,
    CHAIN_SEGMENTS: CHAIN_SEGMENTS
  };

  global.VariationDirective = VariationDirective;
  if (typeof module !== 'undefined' && module.exports) module.exports = VariationDirective;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/generator/generator-selector.js"] = function (module, exports, require) {

'use strict';

var GenRegistry = require("shared/generator/generator-registry.js");
var Mode = require("shared/generator/generator-mode.js");
var QuestionPlan = require("shared/strategy/question-plan.js");
var QuestionTypeRegistry = require("shared/knowledge/question-type-registry.js");
var SemanticParameters = require("shared/generator/core/semantic-parameters.js");
var TypeContract = require("shared/generator/core/type-contract.js");

function trackOf(record) {
  return record.scope === 'core' ? 'native' : 'legacy';
}

function selectGenerator(plan, options) {
  plan = plan || {};
  options = options || {};
  var primaryKp = QuestionPlan.planPrimaryKpId(plan);
  if (!primaryKp) {
    throw new Error('GeneratorSelector: plan 缺少 knowledgePointIds');
  }

  var mode = options.mode != null ? options.mode : Mode.resolve(plan);
  
  
  if (plan && plan.questionTypeId && QuestionTypeRegistry && QuestionTypeRegistry.normalizeQuestionType) {
    var _n = QuestionTypeRegistry.normalizeQuestionType(plan.questionTypeId, { allowHeuristic: false });
    if (_n && _n.id) {
      plan = Object.assign({}, plan, { questionTypeId: _n.id });
    } else {
      
      
      
      return { generatorId: null, source: 'unsupported', errorCode: 'GENERATOR_UNSUPPORTED',
        record: null, mode: mode };
    }
  }
  var all = GenRegistry.all();
  var candidates = [];

  
  
  
  
  
  
  var combineKpCount = QuestionPlan.planKnowledgePointIds(plan).length;
  var isCombineRequest = plan.combine === true && combineKpCount >= 2;

  all.forEach(function (g) {
    var track = trackOf(g);
    if (mode === 'native' && track !== 'native') return;

    if (g.supportsComposite === true && !isCombineRequest) return;
    if (isCombineRequest && g.supportsComposite !== true) return;

    
    
    
    if (TypeContract.FORM_BOUND.indexOf(plan.questionTypeId) !== -1 &&
      g.questionTypes.indexOf(plan.questionTypeId) === -1) return;

    var score = { record: g, kp: 0, capability: 0, qt: 0 };


if (g.knowledgePoints.indexOf(primaryKp) !== -1) score.kp = 1;


if (plan.questionTypeId && g.capabilities.indexOf(plan.questionTypeId) !== -1) score.capability = 1;


if (plan.questionTypeId && g.questionTypes.indexOf(plan.questionTypeId) !== -1) score.qt = 1;


if (score.kp + score.capability + score.qt > 0) candidates.push(score);
});


candidates.sort(function (a, b) {
  if (a.kp !== b.kp) return b.kp - a.kp;
  if (a.capability !== b.capability) return b.capability - a.capability;
  if (a.qt !== b.qt) return b.qt - a.qt;
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
  match: { kp: best.kp, capability: best.capability, questionType: best.qt },
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
    
    
    if (plan && plan.questionTypeId && QuestionTypeRegistry && typeof QuestionTypeRegistry.normalizeQuestionType === 'function') {
      var _n = QuestionTypeRegistry.normalizeQuestionType(plan.questionTypeId, { allowHeuristic: false });
      if (_n && _n.id && _n.id !== plan.questionTypeId) {
        plan = Object.assign({}, plan, { questionTypeId: _n.id });
      }
    }
    var paramPlan = SemanticParameters.attachToPlan(plan);
    var out = orig(paramPlan, context);
    
    
    var finish = function (sqs) {
      return attachMeta(TypeContract.enforce(sqs, paramPlan), generatorId, generatorVersion);
    };
    if (out && typeof out.then === 'function') {
      return out.then(finish);
    }
    return finish(out);
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
var QuestionTypeRegistry = require("shared/knowledge/question-type-registry.js");



var STYLE_REGISTRY = {
  calc:     { style: 'calc',   svgTemplate: 'svg-calculation', label: '计算式' },
  fill:     { style: 'fill',   svgTemplate: 'svg-calculation', label: '填空格' },
  choice:   { style: 'choice', svgTemplate: 'svg-choice',      label: '选项卡' },
  judge:    { style: 'judge',  svgTemplate: 'svg-judge',       label: '判断陈述' },
  apply:    { style: 'story',  svgTemplate: 'svg-story',       label: '图文应用' },
  geometry: { style: 'shape', svgTemplate: 'svg-geometry', label: '图形操作' },
  classify: { style: 'sort',  svgTemplate: 'svg-calculation', label: '分类整理' }
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
  
  var _n = QuestionTypeRegistry.normalizeQuestionType(qt);
  var canonicalQt = (_n && _n.id) ? _n.id : qt;
  var base = STYLE_REGISTRY[canonicalQt];
  if (!base) {
    throw new StrategyError('未知题型，无法确定固定样式: ' + qt, CODES.INVALID_REQUEST, { questionTypeId: qt, knowledgePointId: options.knowledgePointId });
  }
  var style = base.style;
  var category = options.category;
  if (category && CATEGORY_STYLE_OVERRIDE[category] && CATEGORY_STYLE_OVERRIDE[category][canonicalQt]) {
    style = CATEGORY_STYLE_OVERRIDE[category][canonicalQt];
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
__defs["shared/knowledge/question-type-registry.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var COGNITIVE_LEVELS = ['recall', 'recognize', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

  
  
  var TYPES = [
    { id: 'calc', name: '计算题', category: 'calculation',
      cognitiveLevels: ['recall', 'understand', 'apply'], difficultyRange: [1, 6],
      supports: { context: true, graphic: false, distractors: false } },
    { id: 'fill', name: '填空题', category: 'written',
      cognitiveLevels: ['recall', 'understand', 'apply'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'choice', name: '选择题', category: 'selection',
      cognitiveLevels: ['recognize', 'understand', 'apply'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: true } },
    { id: 'judge', name: '判断题', category: 'selection',
      cognitiveLevels: ['recognize', 'understand'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'geometry', name: '操作/作图题', category: 'geometry',
      cognitiveLevels: ['recognize', 'understand', 'apply', 'analyze'], difficultyRange: [1, 6],
      supports: { context: false, graphic: true, distractors: false } },
    { id: 'classify', name: '分类整理题', category: 'classification',
      cognitiveLevels: ['recognize', 'understand', 'apply'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'apply', name: '解决问题/应用题', category: 'application',
      cognitiveLevels: ['understand', 'apply', 'analyze'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } }
  ];

  
  var CANONICAL_ALIASES = {
    operate: 'calc', oral: 'calc', 'law-oral': 'calc', 'dec-mul-oral': 'calc', 'dec-div-oral': 'calc',
    'frac-addsub-oral': 'calc', 'equation-oral': 'calc', 'mul-oral': 'calc',
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
    read: 'geometry', number: 'geometry', count: 'geometry', tally: 'geometry', enum: 'geometry',
    recognize: 'geometry',
    table: 'geometry', picto: 'geometry', set: 'geometry', place: 'geometry',
    am: 'geometry', perm: 'geometry', pa: 'geometry', digit: 'geometry', composite: 'geometry', shard: 'geometry',
    ym: 'geometry', relation: 'geometry', operator: 'geometry', readwrite: 'geometry', approx: 'geometry',
    length: 'geometry', mass: 'geometry', time: 'geometry', pattern: 'geometry', 'mult-meaning': 'geometry',
    'div-meaning': 'geometry', unit: 'geometry', convert: 'geometry', order: 'geometry', compare: 'geometry',
    'big-compare': 'geometry', parity: 'geometry', divisible: 'geometry', prime: 'geometry', factor: 'geometry',
    'digit-reason': 'geometry',
    classify: 'classify', sort: 'classify', group: 'classify', grouping: 'classify', category: 'classify',
    'class-sort': 'classify', tallyChart: 'classify'
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
    mix: '混合', pattern: '找规律', clock: '钟表', money: '人民币',
    oral: '口算', open: '开放', recognize: '认读'
  };

  
  var MODES = ['quick', 'teacher', 'competition'];
  var MODE_LABELS = {
    quick: '快速模式',
    teacher: '教师模式',
    competition: '竞赛模式'
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
      if (lower.indexOf(RECOGNIZE_KEYWORDS[i]) !== -1) return { id: 'geometry', confidence: 'heuristic' };
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
    MODES: MODES,
    MODE_LABELS: MODE_LABELS,
    canonicalAliases: CANONICAL_ALIASES,
    LEGACY_DISPLAY_NAMES: LEGACY_DISPLAY_NAMES,
    get: function (id) {
      if (BY_ID[id]) return BY_ID[id];
      
      var mapped = CANONICAL_ALIASES[id];
      return mapped ? BY_ID[mapped] || null : null;
    },
    has: function (id) { return !!BY_ID[id] || !!CANONICAL_ALIASES[id]; },
    all: function () { return TYPES.slice(); },
    displayName: displayName,
    byCategory: function (category) { return TYPES.filter(function (t) { return t.category === category; }); },
    byMode: function (mode) { return MODES.indexOf(mode) !== -1 ? mode : null; },
    isMode: function (mode) { return MODES.indexOf(mode) !== -1; },
    supports: function (id, capability) {
      var t = BY_ID[id] || (CANONICAL_ALIASES[id] ? BY_ID[CANONICAL_ALIASES[id]] : null);
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
__defs["shared/capability/capability-model.js"] = function (module, exports, require) {

'use strict';

var TYPES = require("shared/knowledge/question-type-registry.js").TYPES;
var Registry = require("shared/knowledge/question-type-registry.js");

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
__defs["shared/capability/capability-matrix.js"] = function (module, exports, require) {

'use strict';

var Registry = require("shared/knowledge/question-type-registry.js");



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
    var CapabilityModel = require("shared/capability/capability-model.js");
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
__defs["shared/generator/core/semantic-parameters.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var SCHEMA_VERSION = 1;

  

  function getGlobalKC() {
    if (global.KnowledgeContext) return global.KnowledgeContext;
    if (global.App && global.App.KnowledgeContext) return global.App.KnowledgeContext;
    return null;
  }

  function defaultGetKp(kpId) {
    
    
    
    var KC = getGlobalKC();
    if (KC && typeof KC.get === 'function') return KC.get(kpId) || null;
    return null;
  }

  
  function readFacts(kp) {
    if (!kp) return null;
    var identity = kp.identity || {};
    var knowledge = kp.knowledge || {};
    var semantic = kp.semantic || {};
    var presentation = kp.presentation || {};
    var name = typeof kp.name === 'string' ? kp.name
      : (typeof identity.name === 'string' ? identity.name : '');
    var concept = typeof semantic.concept === 'string' ? semantic.concept
      : (typeof knowledge.concept === 'string' ? knowledge.concept
        : (typeof identity.description === 'string' ? identity.description : ''));
    var operations = Array.isArray(semantic.operations) ? semantic.operations
      : (Array.isArray(knowledge.operations) ? knowledge.operations : []);
    var representations = Array.isArray(semantic.representations) ? semantic.representations
      : (Array.isArray(presentation.representations) ? presentation.representations : []);
    var coarseFamily = typeof semantic.family === 'string' ? semantic.family : null;
    return { name: name, concept: concept, operations: operations,
      representations: representations, coarseFamily: coarseFamily };
  }

  

  function loadTeaching(baseName) {
    try {
      
      return require('../../../' + 'kbl' + '/' + 'teaching' + '/' + baseName + '.json');
    } catch (e) {
      return null;
    }
  }

  var _familyTable = null;
  var _familyLoaded = false;
  function getFamilyEntry(kpId) {
    if (!_familyLoaded) {
      var doc = loadTeaching('semantic-families');
      _familyTable = (doc && doc.kpFamilies) ? doc.kpFamilies : {};
      _familyLoaded = true;
    }
    return _familyTable[kpId] || null;
  }

  var _intentIndex = null;
  function getIntent(kpId, questionType) {
    if (_intentIndex === null) {
      var doc = loadTeaching('qt-intent');
      var index = {};
      var rows = (doc && Array.isArray(doc.rows)) ? doc.rows : [];
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row && row.knowledgeId && row.questionType) {
          index[row.knowledgeId + '|' + row.questionType] = row;
        }
      }
      _intentIndex = index;
    }
    return _intentIndex[kpId + '|' + questionType] || null;
  }

  

  function reTest(re, text) {
    if (!text) return null;
    var m = re.exec(text);
    return m ? m[0] : null;
  }

  function nameConceptRule(subTopic, families, nameRe, conceptRe) {
    return {
      subTopic: subTopic,
      families: families,
      match: function (facts) {
        var hit = nameRe ? reTest(nameRe, facts.name) : null;
        if (hit) return { field: 'name', matched: hit };
        if (conceptRe) {
          hit = reTest(conceptRe, facts.concept);
          if (hit) return { field: 'concept', matched: hit };
        }
        return null;
      }
    };
  }

  
  var SUBTOPIC_RULES = [
    
    
    
    nameConceptRule('number-theory', ['number-sense'], /倍数的特征|奇数|偶数|质数|合数|奇偶性/),
    
    nameConceptRule('times-concept', ['multiple-ratio'], /倍/),
    nameConceptRule('angle-concept', ['geometric-figure'], /角(的认识|各部分)/, /两条射线/),
    nameConceptRule('area-concept', ['geometric-measurement'], /面积/),
    
    
    nameConceptRule('fraction-meaning', ['fraction'], /(^|[^百])分数的意义/),
    
    nameConceptRule('pictorial-additive-relation', ['word-application'],
      /图形表述数量关系/, /画图[\s\S]*加减关系|加减关系[\s\S]*画图/),
    nameConceptRule('periodic-pattern', ['multiplicative-relation'],
      /周期/, /有余数除法[\s\S]*(规律|排列)|(规律|排列)[\s\S]*有余数除法/),
    nameConceptRule('scale-transform', ['ratio-proportion'],
      /放大|缩小/, /按[一]?定的比/),
    nameConceptRule('proportion-application', ['word-application', 'ratio-proportion'],
      null, /正比例|反比例/),
    
    nameConceptRule('percent-conversion', ['percent'], /互化/, /化百分数|百分数化/),
    
    
    nameConceptRule('percent-life', ['percent'], /生活与百分数/),
    nameConceptRule('percent-discount', ['percent'], /折扣|打折/, /折扣|打几?折/),
    nameConceptRule('percent-interest', ['percent'], /利率|利息|本金/, /利息\s*=|本金/),
    nameConceptRule('percent-tax', ['percent'], /税率/, /应纳税额|税率/),
    nameConceptRule('percent-chengshu', ['percent'], /成数/, /几成|成数/),
    nameConceptRule('percent-target-rate', ['percent'], /达标/),
    nameConceptRule('percent-change', ['percent'], /增产|减产|增减/, /多（?少）?百分之几|百分之几的数是多少/),
    nameConceptRule('percent-of', ['percent'], /百分数的意义/, /百分之几/),
    
    
    nameConceptRule('algebra-letter', ['number-sense'], /字母|含有字母的式子/),
    nameConceptRule('negative-number', ['number-sense'], /正负数|负数|数轴/),
    nameConceptRule('number-concept', ['number-sense'],
      /组成|读数|写数|读写|认识|数位|顺序|计数单位|亿|近似数|改写|百数表|大小比较|比较|相邻|算盘/),
    
    
    
    
    
    nameConceptRule('multdiv-relation', ['multiplicative-relation'],
      /互逆|各部分|余数|被除数|平均数的意义/),
    
    nameConceptRule('scale-map', ['ratio-proportion'], /比例尺/),
    
    
    nameConceptRule('ratio-basics', ['ratio-proportion'], /比例的意义|比例的基本性质|正比例|解比例/)
  ];

  function deriveSubTopic(facts, primaryFamily) {
    var rules = SUBTOPIC_RULES;
    if (primaryFamily) {
      var narrowed = [];
      for (var i = 0; i < SUBTOPIC_RULES.length; i++) {
        if (SUBTOPIC_RULES[i].families.indexOf(primaryFamily) !== -1) {
          narrowed.push(SUBTOPIC_RULES[i]);
        }
      }
      
      if (narrowed.length > 0) rules = narrowed;
    }
    for (var j = 0; j < rules.length; j++) {
      var hit = rules[j].match(facts);
      if (hit) {
        return { subTopic: rules[j].subTopic,
          evidence: { rule: rules[j].subTopic, family: primaryFamily || null,
            field: hit.field, matched: hit.matched } };
      }
    }
    return { subTopic: null, evidence: null };
  }

  

  function createSemanticParameterResolver(options) {
    var getKp = (options && typeof options.getKp === 'function') ? options.getKp : defaultGetKp;

    
    function resolve(kpId, questionType) {
      if (!kpId) return null;
      var kp = getKp(kpId);
      if (!kp) return null;
      var facts = readFacts(kp);

      var familyEntry = getFamilyEntry(kpId);
      var primaryFamily = familyEntry && familyEntry.primary ? familyEntry.primary : null;
      var families = familyEntry && Array.isArray(familyEntry.families) ? familyEntry.families.slice() : [];
      var familySource = primaryFamily ? 'teaching:semantic-families'
        : (facts.coarseFamily ? 'kbl:semantic.family' : 'none');
      if (!primaryFamily && facts.coarseFamily) primaryFamily = facts.coarseFamily;

      var derived = deriveSubTopic(facts, familyEntry && familyEntry.primary ? familyEntry.primary : null);

      var intentRow = questionType ? getIntent(kpId, questionType) : null;
      var intent = null;
      if (intentRow && intentRow.intent) {
        intent = {
          trainsWhat: intentRow.intent.trainsWhat || null,
          whyThisType: intentRow.intent.whyThisType || null,
          differentiation: intentRow.intent.differentiation || null,
          driftRisk: intentRow.intent.driftRisk || null,
          legitimacy: intentRow.intent.legitimacy || null
        };
      }

      return {
        schemaVersion: SCHEMA_VERSION,
        knowledgePointId: kpId,
        questionType: questionType || null,
        name: facts.name,
        concept: facts.concept || null,
        semanticFamily: primaryFamily,
        families: families,
        subTopic: derived.subTopic,
        subTopicEvidence: derived.evidence,
        operations: facts.operations.slice(),
        representations: facts.representations.slice(),
        intent: intent,
        sources: {
          family: familySource,
          subTopic: 'mechanical-rule:kbl-name-concept',
          intent: intent ? 'teaching:qt-intent' : 'none'
        }
      };
    }

    
    function attachToPlan(plan) {
      if (!plan) return plan;
      var next = Object.assign({}, plan);
      var pkp = null;
      if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds.length > 0) {
        pkp = plan.knowledgePointIds[0];
      } else if (plan.knowledgePointId) {
        pkp = plan.knowledgePointId;
      }
      next.semanticParams = resolve(pkp, plan.questionTypeId || plan.questionType);
      return next;
    }

    return { resolve: resolve, attachToPlan: attachToPlan };
  }

  var singleton = createSemanticParameterResolver({});

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    SUBTOPIC_RULES: SUBTOPIC_RULES,
    createSemanticParameterResolver: createSemanticParameterResolver,
    resolve: singleton.resolve,
    attachToPlan: singleton.attachToPlan,
    
    deriveSubTopic: deriveSubTopic,
    readFacts: readFacts
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.SemanticParameters = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/generator/core/type-contract.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var Rng = require("shared/generator/core/rng.js");

  var SCHEMA_VERSION = 'p25-07.1';

  
  var CONTRACT_MAP = {
    calc: ['expressionPresent'],
    fill: ['blankPresent'],
    choice: ['optionsPresent', 'answerInOptions'],
    judge: ['booleanAnswer'],
    geometry: ['graphicOrInstruction'],
    classify: ['groupStructure'],
    apply: ['contextPresent']
  };

  
  var FORM_BOUND = ['calc', 'geometry', 'classify'];

  
  var INVARIANT_IDS = ['optionsPresent', 'answerInOptions', 'booleanAnswer', 'blankPresent',
    'expressionPresent', 'contextPresent', 'graphicOrInstruction', 'groupStructure'];

  

  var BLANK_RE = /____|\(\s*\)|（\s*）/;
  var EXPR_RE = /\d\s*[+\-−×x*÷\/]\s*[\d.]/;
  var BLANK_EQ_RE = /\d\s*=\s*(____|\(\s*\)|（\s*）)/;
  var SETTING_RE = /[？?]/;
  var QWORD_RE = /多少|几|求/;
  var TASK_VERB_RE = /排列|整理|分类|排序|分组|推理|设计|搭配|解决|涂色|数一数/;
  var GEO_RE = /作图|画一画|画出|量一量|认一认|观察|看图|看示|示意图|线段图|在图上|图形|钟面|摆一摆|数一数|剪一|拼一|折一|七巧板/;
  var GROUP_RE = /分类|整理|排列|排序|分组/;

  function dataOf(sq) { return (sq && sq.data) ? sq.data : {}; }

  function checkOptionsPresent(sq) {
    var opts = dataOf(sq).options;
    if (!Array.isArray(opts) || opts.length < 3) return false;
    var seen = {};
    for (var i = 0; i < opts.length; i++) {
      if (typeof opts[i] !== 'string' || opts[i].length === 0) return false;
      if (seen[opts[i]]) return false;
      seen[opts[i]] = 1;
    }
    return true;
  }

  function checkAnswerInOptions(sq) {
    var d = dataOf(sq);
    var opts = d.options;
    if (!Array.isArray(opts) || !sq.answer || sq.answer.value == null) return false;
    var v = String(sq.answer.value);
    if (opts.map(String).indexOf(v) !== -1) return true;                       
    if (d.correctIndex != null && v === String(d.correctIndex)                 
      && d.correctIndex >= 0 && d.correctIndex < opts.length) return true;
    return false;
  }

  function checkBooleanAnswer(sq) {
    return !!(sq.answer && typeof sq.answer.value === 'boolean');
  }

  function checkBlankPresent(sq) { return BLANK_RE.test(String(sq.prompt || '')); }

  function checkExpressionPresent(sq) {
    var p = String(sq.prompt || '');
    if (EXPR_RE.test(p)) return true;                    
    if (dataOf(sq).operation) return true;               
    if (BLANK_EQ_RE.test(p)) return true;                
    return false;
  }

  function checkContextPresent(sq) {
    var p = String(sq.prompt || '');
    if (p.replace(/\s/g, '').length < 10) return false;
    if (SETTING_RE.test(p)) return true;
    if (BLANK_RE.test(p)) return true;
    if (QWORD_RE.test(p)) return true;
    if (TASK_VERB_RE.test(p)) return true;
    return false;
  }

  function checkGraphicOrInstruction(sq) {
    var d = dataOf(sq);
    if (d.graphic && d.graphic.type) return true;
    if (d.shapeName) return true;
    return GEO_RE.test(String(sq.prompt || ''));
  }

  function checkGroupStructure(sq) {
    var d = dataOf(sq);
    if (d.sort || d.groups || d.categories) return true;
    return GROUP_RE.test(String(sq.prompt || ''));
  }

  var INVARIANTS = {
    optionsPresent: checkOptionsPresent,
    answerInOptions: checkAnswerInOptions,
    booleanAnswer: checkBooleanAnswer,
    blankPresent: checkBlankPresent,
    expressionPresent: checkExpressionPresent,
    contextPresent: checkContextPresent,
    graphicOrInstruction: checkGraphicOrInstruction,
    groupStructure: checkGroupStructure
  };

  
  function check(qt, sq) {
    var invariants = CONTRACT_MAP[qt];
    if (!invariants) return { ok: true, violations: [] };   
    if (!sq) return { ok: false, violations: invariants.slice() };
    var violations = [];
    for (var i = 0; i < invariants.length; i++) {
      var fn = INVARIANTS[invariants[i]];
      if (fn && !fn(sq)) violations.push(invariants[i]);
    }
    return { ok: violations.length === 0, violations: violations };
  }

  

  function rngFor(sq) {
    var base = (sq && sq.seed != null) ? String(sq.seed)
      : String((sq && sq.knowledgePointId) || '') + '|' + String((sq && sq.prompt) || '');
    return Rng.createSeededRandom(base + ':type-contract');
  }

  
  function parseAnswerNum(sq) {
    if (!sq || !sq.answer || sq.answer.value == null) return null;
    var s = String(sq.answer.value).trim();
    var m = /^(-?\d+(?:\.\d+)?)(%)?$/.exec(s);
    if (!m) return null;
    return { num: parseFloat(m[1]), suffix: m[2] || '' };
  }

  
  function parseAnswerRemainder(sq) {
    if (!sq || !sq.answer || sq.answer.value == null) return null;
    var s = String(sq.answer.value).trim();
    var m = /^(\d+)\s*(……|余)\s*(\d+)$/.exec(s);
    if (!m) return null;
    return { q: parseInt(m[1], 10), mark: m[2], r: parseInt(m[3], 10) };
  }

  
  function parseSeq(sq) {
    if (!sq || !sq.answer || sq.answer.value == null) return null;
    var s = String(sq.answer.value).trim();
    if (!/^[\d，,\s、.]+$/.test(s)) return null;
    var parts = s.split(/[，,、\s]+/).filter(Boolean);
    if (parts.length < 3) return null;
    var nums = [];
    for (var i = 0; i < parts.length; i++) {
      var n = Number(parts[i]);
      if (!isFinite(n)) return null;
      nums.push(n);
    }
    return nums;
  }

  function sortNums(nums, desc) {
    var c = nums.slice().sort(function (a, b) { return a - b; });
    return desc ? c.reverse() : c;
  }

  
  function swapped(seq, rng) {
    if (!seq || seq.length < 2) return null;
    for (var t = 0; t < seq.length * 2; t++) {
      var i = Rng.randInt(rng, 0, seq.length - 2);
      var s = seq.slice();
      var tmp = s[i]; s[i] = s[i + 1]; s[i + 1] = tmp;
      var same = true;
      for (var k = 0; k < s.length; k++) { if (s[k] !== seq[k]) { same = false; break; } }
      if (!same) return s;
    }
    return seq.slice().reverse();
  }

  function numStr(n) { return String(n); }

  

  function tidyChoicePrompt(p) {
    p = String(p || '');
    p = p.replace(/^列式计算[:：]\s*/, '');
    p = p.replace(/=\s*[？?]\s*$/, '=（ ）');
    p = p.replace(/=\s*$/, '=（ ）');
    return p;
  }

  function buildNumericOptions(rng, correct, suffix) {
    var abs = Math.abs(correct);
    var step = abs < 20 ? 1 : (abs < 100 ? 10 : 100);
    var cands = [correct + step, correct - step, correct + 2 * step, correct - 2 * step, correct * 2];
    if (correct > 0 && correct % 2 === 0) cands.push(correct / 2);
    var opts = [correct];
    for (var i = 0; i < cands.length && opts.length < 4; i++) {
      var c = cands[i];
      if (correct >= 0 && c < 0) continue;                 
      if (c !== correct && opts.indexOf(c) === -1) opts.push(c);
    }
    var pad = 1;
    while (opts.length < 4) {
      var e = correct + pad * step + pad;
      if (e !== correct && opts.indexOf(e) === -1) opts.push(e);
      pad++;
    }
    return Rng.shuffle(rng, opts).map(function (n) { return numStr(n) + (suffix || ''); });
  }

  function finishChoice(sq, rng) {
    var d = dataOf(sq);
    var opts = d.options;

    
    if (Array.isArray(opts) && opts.length >= 3 && sq.answer && sq.answer.value != null
      && d.correctIndex != null && d.correctIndex >= 0 && d.correctIndex < opts.length
      && opts.every(function (o) { return typeof o === 'string' || typeof o === 'number'; })
      && opts.map(String).indexOf(String(sq.answer.value)) === -1
      && String(sq.answer.value) === String(d.correctIndex)) {
      d.options = opts.map(String);
      sq.answer.value = String(d.options[d.correctIndex]);
      return { fixed: ['answerInOptions'] };
    }

    
    if (!Array.isArray(opts) || opts.length < 3) {
      var an = parseAnswerNum(sq);
      if (an) {
        var built = buildNumericOptions(rng, an.num, an.suffix);
        d.options = built;
        d.correctIndex = built.indexOf(String(an.num) + an.suffix);
        sq.answer.value = String(an.num) + an.suffix;
        sq.prompt = tidyChoicePrompt(sq.prompt);
        return { fixed: ['optionsPresent', 'answerInOptions'] };
      }
      var rem = parseAnswerRemainder(sq);
      if (rem) {
        var cand = [];
        var push = function (q, r) { var s = q + '……' + r; if (cand.indexOf(s) === -1 && s !== rem.q + '……' + rem.r) cand.push(s); };
        push(rem.q + 1, rem.r); if (rem.q > 1) push(rem.q - 1, rem.r);
        push(rem.q, rem.r + 1); if (rem.r > 0) push(rem.q, rem.r - 1);
        push(rem.q + 1, rem.r + 1);
        if (cand.length < 3) return null;
        var ropts = [rem.q + '……' + rem.r, cand[0], cand[1], cand[2]];
        var shuffled = Rng.shuffle(rng, ropts);
        d.options = shuffled;
        d.correctIndex = shuffled.indexOf(rem.q + '……' + rem.r);
        sq.answer.value = rem.q + '……' + rem.r;
        sq.prompt = tidyChoicePrompt(sq.prompt);
        return { fixed: ['optionsPresent', 'answerInOptions'] };
      }
    }

    
    var seq = parseSeq(sq);
    if (seq) {
      var correctStr = seq.join('，');
      var sopts = [correctStr];
      var guard = 0;
      while (sopts.length < 4 && guard < 10) {
        guard++;
        var sw = swapped(seq, rng);
        var s = sw ? sw.join('，') : null;
        if (s && sopts.indexOf(s) === -1) sopts.push(s);
      }
      if (sopts.length < 3) return null;
      var sh = Rng.shuffle(rng, sopts);
      d.options = sh;
      d.correctIndex = sh.indexOf(correctStr);
      d.sort = true;
      sq.answer.value = correctStr;
      return { fixed: ['optionsPresent', 'answerInOptions'] };
    }

    return null;   
  }

  

  function finishJudge(sq, rng) {
    var d = dataOf(sq);
    var p = String(sq.prompt || '');
    p = p.replace(/^列式计算[:：]\s*/, '');
    var an = parseAnswerNum(sq);

    if (an) {
      var isTrue = rng() < 0.5;
      var shown = isTrue ? an.num : an.num + 1;
      var shownStr = numStr(shown) + an.suffix;
      if (/=\s*[？?]\s*$/.test(p)) {
        p = p.replace(/=\s*[？?]\s*$/, '= ' + shownStr + '（对还是错？）');
      } else if (/=\s*$/.test(p)) {
        p = p.replace(/=\s*$/, '= ' + shownStr + '（对还是错？）');
      } else {
        p = p.replace(/[。？?]\s*$/, '') + '。有人说结果是 ' + shownStr + '，对还是错？';
      }
      sq.prompt = p;
      sq.answer.value = (shown === an.num);
      d.shownResult = shownStr;
      d.expectedResult = numStr(an.num) + an.suffix;
      return { fixed: ['booleanAnswer'] };
    }

    var rem = parseAnswerRemainder(sq);
    if (rem) {
      var isTrue2 = rng() < 0.5;
      var shown2 = isTrue2 ? rem : { q: rem.q + 1, mark: rem.mark, r: rem.r };
      var shownStr2 = shown2.q + '……' + shown2.r;
      var p2 = /=\s*[？?]?\s*$/.test(p)
        ? p.replace(/=\s*[？?]\s*$/, '').replace(/=\s*$/, '= ' + shownStr2 + '（对还是错？）')
        : (p.replace(/[。？?]\s*$/, '') + '。有人说结果是 ' + shownStr2 + '，对还是错？');
      sq.prompt = p2;
      sq.answer.value = isTrue2;
      d.shownResult = shownStr2;
      return { fixed: ['booleanAnswer'] };
    }

    var seq = parseSeq(sq);
    if (seq) {
      var desc = /从大到小|大到小/.test(p);
      var correct = sortNums(seq, desc);
      var isTrue3 = rng() < 0.5;
      var shownSeq = isTrue3 ? correct : swapped(correct, rng);
      if (!isTrue3 && shownSeq.join('，') === correct.join('，')) shownSeq = correct.slice().reverse();
      var base = p.replace(/[。？?]\s*$/, '');
      sq.prompt = base + '。小明排出：' + shownSeq.join('，') + '——对还是错？';
      sq.answer.value = isTrue3;
      d.shownResult = shownSeq.join('，');
      d.expectedResult = correct.join('，');
      return { fixed: ['booleanAnswer'] };
    }

    return null;
  }

  

  function finishFill(sq) {
    var p = String(sq.prompt || '');
    if (BLANK_RE.test(p)) return { fixed: [] };
    if (parseSeq(sq) && /[。]\s*$/.test(p)) {
      sq.prompt = p.replace(/[。]\s*$/, '') + '，排序结果是 ____。';
      return { fixed: ['blankPresent'] };
    }
    if (/=\s*[？?]\s*$/.test(p)) { sq.prompt = p.replace(/=\s*[？?]\s*$/, '= ____'); return { fixed: ['blankPresent'] }; }
    if (/=\s*$/.test(p)) { sq.prompt = p.replace(/=\s*$/, '= ____'); return { fixed: ['blankPresent'] }; }
    if (/[？?]\s*$/.test(p)) { sq.prompt = p.replace(/\s+$/, '') + ' 答：____'; return { fixed: ['blankPresent'] }; }
    if (/[:：]\s*$/.test(p)) { sq.prompt = p + ' ____'; return { fixed: ['blankPresent'] }; }
    if (/[。]\s*$/.test(p)) { sq.prompt = p.replace(/[。]\s*$/, '') + ' → ____。'; return { fixed: ['blankPresent'] }; }
    sq.prompt = p + ' ____';
    return { fixed: ['blankPresent'] };
  }

  

  function parseSingleExpr(p) {
    var ops = String(p || '').match(/[+\-−×x*÷\/]/g);
    if (!ops || ops.length !== 1) return null;
    var m = /(-?\d+(?:\.\d+)?)\s*([+\-−×x*÷\/])\s*(-?\d+(?:\.\d+)?)/.exec(p);
    if (!m) return null;
    return { a: parseFloat(m[1]), op: m[2], b: parseFloat(m[3]) };
  }

  function parseDoubleExpr(p) {
    var m = /(-?\d+(?:\.\d+)?)\s*([+\-−×x*÷\/])\s*(-?\d+(?:\.\d+)?)\s*([+\-−×x*÷\/])\s*(-?\d+(?:\.\d+)?)/.exec(p || '');
    if (!m) return null;
    return { a: parseFloat(m[1]), op1: m[2], b: parseFloat(m[3]), op2: m[4], c: parseFloat(m[5]) };
  }

  function opName(ch) {
    if (ch === '+') return 'add';
    if (ch === '-' || ch === '−') return 'sub';
    if (ch === '×' || ch === 'x' || ch === '*') return 'mult';
    return 'div';
  }

  function applyStorySingle(e, p) {
    var a = e.a, b = e.b, op = e.op;
    if ((op === '×' || op === 'x' || op === '*') && /%/.test(p)) {
      
      var m1 = /(\d+(?:\.\d+)?)\s*%\s*[×x*]/.exec(p);
      if (m1) {
        var rate = parseFloat(m1[1]);
        return '一件商品现价是原价的 ' + rate + '%，原价 ' + b + ' 元，现价是多少元？';
      }
      var rate2 = /%/.test(String(b) ) ? a : b;
      var base2 = /%/.test(String(b)) ? b : a;
      return '一件商品原价 ' + base2 + ' 元，现按原价的 ' + rate2 + '% 出售，现价是多少元？';
    }
    if (op === '+') return '小明买一支钢笔用去 ' + a + ' 元，又买一个笔袋用去 ' + b + ' 元，一共用去多少元？';
    if (op === '-' || op === '−') {
      if (a >= b) return '小明有 ' + a + ' 元零花钱，买文具用去 ' + b + ' 元，还剩多少元？';
      return '小明买文具用去 ' + a + ' 元，付给收银员 ' + b + ' 元，应找回多少元？';
    }
    if (op === '×' || op === 'x' || op === '*') {
      return '每盒鸡蛋有 ' + a + ' 个，买了 ' + b + ' 盒，一共有多少个鸡蛋？';
    }
    
    if (b === 0) return null;
    if (a % b === 0) return '把 ' + a + ' 个苹果平均分给 ' + b + ' 个小朋友，每人分得多少个？';
    return '有 ' + a + ' 个苹果，每 ' + b + ' 个装一袋，可以装满多少袋，还剩几个？';
  }

  function applyStoryDouble(e) {
    var o1 = opName(e.op1), o2 = opName(e.op2);
    var a = e.a, b = e.b, c = e.c;
    var key = o1 + ',' + o2;
    switch (key) {
      case 'add,add': return '水果店上午卖出 ' + a + ' 箱苹果，中午卖出 ' + b + ' 箱，下午卖出 ' + c + ' 箱，一天一共卖出多少箱？';
      case 'add,sub': return '小明有 ' + a + ' 元，爸爸又给他 ' + b + ' 元，买文具用去 ' + c + ' 元，现在有多少元？';
      case 'sub,add': return '公交车上有 ' + a + ' 人，到站后下去 ' + b + ' 人，又上来 ' + c + ' 人，现在车上有多少人？';
      case 'sub,sub': return '小明有 ' + a + ' 元，买书用去 ' + b + ' 元，买笔用去 ' + c + ' 元，还剩多少元？';
      case 'mult,add': return '一套书每本 ' + a + ' 元，买 ' + b + ' 本，加配送费 ' + c + ' 元，一共要付多少元？';
      case 'mult,sub': return '每支笔 ' + a + ' 元，买 ' + b + ' 支，用会员卡立减 ' + c + ' 元，一共要付多少元？';
      case 'div,add': return '把 ' + a + ' 颗糖平均分给 ' + b + ' 个小朋友后，老师又给每人 ' + c + ' 颗，每人现在有多少颗？';
      case 'div,sub': return '把 ' + a + ' 颗糖平均分给 ' + b + ' 个小朋友，小华分到后吃掉 ' + c + ' 颗，小华还剩多少颗？';
      default:
        return '按下面的数量关系解决问题：' + a + ' ' + e.op1 + ' ' + b + ' ' + e.op2 + ' ' + c
          + '。先算出最后结果，再写清每一步求的是什么，结果是多少？';
    }
  }

  function finishApply(sq) {
    if (checkContextPresent(sq)) return { fixed: [] };     
    var p = String(sq.prompt || '');
    var single = parseSingleExpr(p);
    if (single) {
      var story = applyStorySingle(single, p);
      if (story) { sq.prompt = story; return { fixed: ['contextPresent'] }; }
    }
    var dbl = parseDoubleExpr(p);
    if (dbl) {
      sq.prompt = applyStoryDouble(dbl);
      return { fixed: ['contextPresent'] };
    }
    return null;
  }

  

  var FINISHERS = { choice: finishChoice, judge: finishJudge, fill: finishFill, apply: finishApply };

  function trace(sq, action, violations, fixed) {
    sq.metadata = sq.metadata || {};
    sq.metadata.typeContract = { action: action, violations: violations || [], fixed: fixed || [] };
  }

  
  function enforce(sqs, plan) {
    if (!sqs) return sqs;
    var isArr = Array.isArray(sqs);
    var arr = isArr ? sqs : (sqs.questions && Array.isArray(sqs.questions) ? sqs.questions : null);
    if (!arr) return sqs;
    var qt = plan ? String(plan.questionTypeId || plan.questionType || '') : '';
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var sq = arr[i];
      if (!sq) continue;
      
      
      
      if (sq.answer != null && (typeof sq.answer === 'string' || typeof sq.answer === 'number' || typeof sq.answer === 'boolean')) {
        sq.answer = { value: typeof sq.answer === 'boolean' ? sq.answer : String(sq.answer), acceptable: [] };
      }
      var res = check(qt, sq);
      
      
      
      if (res.ok) { if (qt === 'choice') sq.answerMode = 'choice'; trace(sq, 'pass', [], []); out.push(sq); continue; }
      var finisher = FORM_BOUND.indexOf(qt) === -1 ? FINISHERS[qt] : null;
      var fixed = null;
      if (finisher) {
        try { fixed = finisher(sq, rngFor(sq)); } catch (e) { fixed = null; }
      }
      if (!fixed) { trace(sq, 'drop', res.violations, []); continue; }
      var re = check(qt, sq);
      if (!re.ok) { trace(sq, 'drop', re.violations, fixed.fixed || []); continue; }
      if (qt === 'choice') sq.answerMode = 'choice';
      trace(sq, 'finish', res.violations, fixed.fixed || []);
      out.push(sq);
    }
    if (isArr) { arr.length = 0; for (var j = 0; j < out.length; j++) arr.push(out[j]); return sqs; }
    sqs.questions = out;
    return sqs;
  }

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    CONTRACT_MAP: CONTRACT_MAP,
    FORM_BOUND: FORM_BOUND,
    INVARIANT_IDS: INVARIANT_IDS,
    INVARIANTS: INVARIANTS,
    check: check,
    enforce: enforce
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.TypeContract = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

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
var SemanticSpecial = require("shared/generator/generators/semantic-special.js");
var Classification = require("shared/generator/generators/classify.js");
var Percent = require("shared/generator/generators/percent.js");
var ConceptMeaning = require("shared/generator/generators/concept-meaning.js");
var SemanticRelations = require("shared/generator/generators/semantic-relations.js");
var Decimal = require("shared/generator/generators/decimal.js");   
var Fraction = require("shared/generator/generators/fraction.js"); 

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
  C9.buildAll(),
  SemanticSpecial.buildAll(),
  Classification.buildAll(),
  Percent.buildAll(),
  ConceptMeaning.buildAll(),
  SemanticRelations.buildAll(),
  Decimal.buildAll(),
  Fraction.buildAll()
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
__defs["shared/generator/generators/arithmetic.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");
var Arith = require("shared/generator/core/arithmetic-core.js");




function deriveKindFromName(name, op) {
  if (!name) return null;
  if (op === 'div' && name.indexOf('余数') !== -1) return 'div-remainder';
  return null;
}


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
    capabilities: ['calc', 'fill', 'apply'],
    questionTypes: ['calc', 'fill', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return plan.questionTypeId === 'calc';
    },

    generate: function (plan, context) {
      context = context || {};
      var constraints = plan.constraints || {};
      var count = plan.count || 1;
      var questions = [];

      
      
      
      
      var vDirectives = Array.isArray(plan && plan.variationDirectives) ? plan.variationDirectives : [];
      var numericSteer = vDirectives.some(function (d) { return d && d.axis === 'numeric'; });
      var genRange = constraints.numberRange;
      if (numericSteer && genRange && typeof genRange.min === 'number' && typeof genRange.max === 'number' &&
          genRange.max > genRange.min) {
        var mid = Math.floor((genRange.min + genRange.max) / 2);
        genRange = { min: genRange.min, max: Math.max(genRange.min, mid) };
      }

      for (var i = 0; i < count; i++) {
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        var opSet = context.operationSet || planOperationSet(plan);
        
        var kpName = plan.semanticParams && plan.semanticParams.name;
        var nameKind = deriveKindFromName(kpName, op);
        var kind = constraints.kind ||
          ((plan.constraints && plan.constraints.kind) || (plan.kind || null)) || nameKind;
        var structure = Arith.buildSpecialKind(rng, { kind: kind, numberRange: genRange });
        if (!structure) {
          structure = Arith.generateStructure(rng, {
            operation: context.operation || planOperationStr(plan) || ((opSet && opSet.filter(function (o) { return o === '+' || o === '−'; }).length === opSet.length) ? 'add' : op),
            operationSet: opSet,
            exactSteps: constraints.exactSteps,
            numberRange: genRange,
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
    capabilities: mode === 'fill' ? ['fill', 'geometry', 'calc', 'apply'] : (mode === 'choice' ? ['choice', 'geometry', 'calc', 'apply'] : ['judge', 'geometry', 'calc', 'apply']),
    questionTypes: mode === 'fill' ? ['fill', 'geometry', 'calc', 'apply'] : (mode === 'choice' ? ['choice', 'geometry', 'calc', 'apply'] : ['judge', 'geometry', 'calc', 'apply']),knowledgePoints: spec.knowledgePoints || [],

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
    capabilities: spec.capabilities || ['calc', 'fill'],
    questionTypes: spec.questionTypes || ['calc', 'fill'],
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



function buildAll() {
  return [
    createComplexGenerator({
      id: 'generator:complex-calc',
      capabilities: ['calc', 'fill'],
      questionTypes: ['calc', 'fill']
    })
  ];
}

module.exports = {
  createComplexGenerator: createComplexGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/shape.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");

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
  'cuboid': 'cuboid',
  'cylinder': 'cylinder',
  'cone': 'cone',
  'sphere': 'sphere',
  
  'flat': 'rectangle',
  'rectangle': 'rectangle',
  'square': 'square',
  'triangle': 'triangle',
  'circle': 'circle',
  'parallelogram': 'parallelogram',
  'trapezoid': 'trapezoid',
  'line-segment': 'line-segment',
  'angle': 'angle',
  'symmetry': 'rectangle',
  'tessellation': 'rectangle',
  
  'match-shape': 'rectangle',
  'count-graph': 'rectangle',
  'draw-shape': 'rectangle',
  'shape-combine': 'rectangle'
};


var SHAPE_FEATURES = {
  'solid': { name: '立体图形', features: ['有长宽高', '占据空间', '有体积'], examples: ['长方体', '正方体', '圆柱', '圆锥', '球'] },
  'cube': { name: '正方体', features: ['6个面都是正方形', '棱长相等', '12条棱', '8个顶点'], examples: ['魔方', '骰子'] },
  'cuboid': { name: '长方体', features: ['6个面都是长方形', '相对的面相等', '12条棱分3组'], examples: ['文具盒', '砖头'] },
  'cylinder': { name: '圆柱', features: ['2个圆形底面', '1个侧面', '侧面展开是长方形'], examples: ['铅笔', '水桶'] },
  'cone': { name: '圆锥', features: ['1个圆形底面', '1个顶点', '侧面展开是扇形'], examples: ['路锥', '帽子'] },
  'sphere': { name: '球', features: ['没有棱和面', '滚动最快', '任意剖面是圆'], examples: ['皮球', '地球仪'] },
  'flat': { name: '平面图形', features: ['只有长和宽', '没有厚度', '在平面上'], examples: ['长方形', '正方形', '三角形', '圆'] },
  'rectangle': { name: '长方形', features: ['4个角都是直角', '对边相等', '对角线相等'], examples: ['课本', '黑板'] },
  'square': { name: '正方形', features: ['4条边相等', '4个角都是直角', '对角线相等且互相垂直平分'], examples: ['手帕', '棋盘格'] },
  'triangle': { name: '三角形', features: ['3条边', '3个角', '内角和180度'], examples: ['三角尺', '屋顶'] },
  'circle': { name: '圆', features: ['没有直线边', '到圆心距离相等', '周长=2πr'], examples: ['硬币', '时钟面'] },
  'parallelogram': { name: '平行四边形', features: ['对边平行且相等', '对角互补'], examples: ['推拉窗'] },
  'trapezoid': { name: '梯形', features: ['一组对边平行', '腰不等长'], examples: ['裙子', '灯罩'] },
  'line-segment': { name: '线段', features: ['有两个端点', '可以度量长度', '是直线的一部分'], examples: ['尺子的边', '桌子棱'] },
  'angle': { name: '角', features: ['有一个顶点', '两条边是射线', '有大小（度）'], examples: ['三角尺的角', '墙角'] },
  'symmetry': { name: '轴对称图形', features: ['沿对称轴对折两边重合', '至少1条对称轴', '对应点到对称轴距离相等'], examples: ['蝴蝶', '双喜字'] },
  'tessellation': { name: '密铺', features: ['无缝隙不重叠铺满平面', '拼接点处角度和为360度', '可重复单元'], examples: ['地砖', '蜂巢'] }
};



var NAME_TO_SHAPE = [
  { re: /正方/, type: 'square' },
  { re: /长方/, type: 'rectangle' },
  { re: /三角/, type: 'triangle' },
  { re: /圆/, type: 'circle' },
  { re: /平行四边形/, type: 'parallelogram' },
  { re: /梯形/, type: 'trapezoid' },
  { re: /线段|画线段/, type: 'line-segment' },
  { re: /角(的|各|度|认)/, type: 'angle' },
  { re: /对称/, type: 'symmetry' },
  { re: /密铺/, type: 'tessellation' },
  { re: /立方/, type: 'cube' },
  { re: /长.*体|长方体/, type: 'cuboid' },
  { re: /圆柱/, type: 'cylinder' },
  { re: /圆锥/, type: 'cone' },
  { re: /球/, type: 'sphere' },
  { re: /立体/, type: 'solid' },
  { re: /平面|图形/, type: 'flat' }
];

function deriveShapeTypeFromName(name) {
  if (!name || typeof name !== 'string') return null;
  for (var i = 0; i < NAME_TO_SHAPE.length; i++) {
    if (NAME_TO_SHAPE[i].re.test(name)) return NAME_TO_SHAPE[i].type;
  }
  return null;
}

function getShapeMeta(kp, name) {
  
  
  var lt = deriveShapeTypeFromName(name)
    || (kp && kp.source && kp.source.legacyType)
    || (kp && kp.legacy && kp.legacy.legacyType)
    || 'flat';
  var cat = kp && kp.legacy && kp.legacy.category;
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
  
  
  var correct = shapeMeta.meta.name;
  var distractorNames = allShapes.filter(function (s) { return s !== target; }).slice(0, 3)
    .map(function (s) { return SHAPE_FEATURES[s].name; });
  if (distractorNames.length < 3) {
    distractorNames = distractorNames.concat(['立体图形', '长方体', '圆柱']
      .filter(function (d) { return distractorNames.indexOf(d) === -1 && d !== correct; }));
  }
  var options = Rng.shuffle(rng, [correct].concat(distractorNames).slice(0, 4));
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

function makeGeometryQuestion(plan, context, i, shapeMeta, graphic, kpName) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  
  
  var name = kpName || '几何图形';
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

function makeGeometryApplyQuestion(plan, context, i, shapeMeta, graphic, kpName) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kpName || '几何应用';
  
  var isArea = name.indexOf('面积') !== -1 || name.indexOf('周长') !== -1 || name.indexOf('表面积') !== -1;
  var isVolume = name.indexOf('圆柱') !== -1 || name.indexOf('圆锥') !== -1 || name.indexOf('体积') !== -1 || name.indexOf('表面积') !== -1;
  var isCircle = name.indexOf('圆') !== -1;
  var isCoord = name.indexOf('数对') !== -1 || name.indexOf('坐标') !== -1;
  var isMotion = name.indexOf('旋转') !== -1 || name.indexOf('对称') !== -1 || name.indexOf('平移') !== -1;
  var isFeature = name.indexOf('特征') !== -1 || name.indexOf('认识') !== -1;
  var isSolid = name.indexOf('正方') !== -1 || name.indexOf('长方') !== -1 ||
    name.indexOf('圆柱') !== -1 || name.indexOf('圆锥') !== -1 || name.indexOf('球') !== -1;
  var prompt, answer, answerMode;

  if (isFeature && isSolid) {
    
    var isCube = name.indexOf('正方') !== -1;
    var faces = 6, edges = 12, vertices = 8;
    var featPrompt;
    if (isCube) {
      featPrompt = '正方体有 6 个面、12 条棱、8 个顶点。';
    } else if (name.indexOf('长方') !== -1) {
      featPrompt = '长方体有 6 个面、12 条棱、8 个顶点。';
    } else if (name.indexOf('圆柱') !== -1) {
      featPrompt = '圆柱有 2 个底面和 1 个侧面。';
    } else if (name.indexOf('圆锥') !== -1) {
      featPrompt = '圆锥有 1 个底面和 1 个顶点。';
    } else {
      featPrompt = '球没有平面，只有一个曲面。';
    }
    prompt = name + '：' + featPrompt + ' 请说出它有几个面？';
    answer = { value: String(faces), acceptable: [faces + '个'] };
    answerMode = 'input';
  } else if (isCircle && name.indexOf('周长') !== -1) {
    var r = Rng.randInt(rng, 3, 10);
    var circ = Math.round(2 * 3.14 * r * 100) / 100;
    prompt = '一个圆的半径是 ' + r + ' 厘米，求它的周长。（π取3.14）';
    answer = { value: String(circ), acceptable: [circ + '厘米'] };
    answerMode = 'input';
  } else if (isCircle && name.indexOf('面积') !== -1) {
    var rc = Rng.randInt(rng, 3, 10);
    var areaC = Math.round(3.14 * rc * rc * 100) / 100;
    prompt = '一个圆的半径是 ' + rc + ' 厘米，求它的面积。（π取3.14）';
    answer = { value: String(areaC), acceptable: [areaC + '平方厘米'] };
    answerMode = 'input';
  } else if (name.indexOf('周长') !== -1) {
    var pw = Rng.randInt(rng, 4, 15);
    var ph = Rng.randInt(rng, 3, 12);
    var peri = 2 * (pw + ph);
    prompt = '一个长方形，长' + pw + '厘米，宽' + ph + '厘米，求它的周长。';
    answer = { value: String(peri), acceptable: [peri + '厘米'] };
    answerMode = 'input';
  } else if (name.indexOf('表面积') !== -1) {
    var sw = Rng.randInt(rng, 3, 8);
    var sh = Rng.randInt(rng, 2, 6);
    var sd = Rng.randInt(rng, 2, 6);
    var surf = 2 * (sw * sh + sw * sd + sh * sd);
    prompt = '一个长方体，长' + sw + '厘米，宽' + sd + '厘米，高' + sh + '厘米，求它的表面积。';
    answer = { value: String(surf), acceptable: [surf + '平方厘米'] };
    answerMode = 'input';
  } else if (name.indexOf('圆锥') !== -1 && name.indexOf('体积') !== -1) {
    var vr = Rng.randInt(rng, 2, 6);
    var vh = Rng.randInt(rng, 3, 9);
    var vol = Math.round(3.14 * vr * vr * vh / 3 * 100) / 100;
    prompt = '一个圆锥，底面半径' + vr + '厘米，高' + vh + '厘米，求它的体积。（π取3.14）';
    answer = { value: String(vol), acceptable: [vol + '立方厘米'] };
    answerMode = 'input';
  } else if (isArea) {
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
    prompt = name + '：请在方格纸上标出点的位置，说一说你是怎样确定位置的？';
    answer = { value: '已标注', acceptable: [] };
    answerMode = 'input';
  } else if (isMotion) {
    prompt = name + '：请说一说图形变换的三要素是什么？';
    answer = { value: '旋转中心、旋转方向、旋转角度', acceptable: [] };
    answerMode = 'input';
  } else {
    var side = Rng.randInt(rng, 5, 20);
    prompt = name + '：一个图形的边长为' + side + '厘米，求它的面积是多少？';
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


function makeCalcMeasurementQuestion(plan, context, i, kpName) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kpName || '几何计算';
  var prompt, answer;

  if (name.indexOf('圆') !== -1 && name.indexOf('周长') !== -1) {
    var r = Rng.randInt(rng, 3, 10);
    var circ = Math.round(2 * 3.14 * r * 100) / 100;
    prompt = '列式计算：半径 ' + r + ' 厘米的圆，周长 = 2 × 3.14 × ' + r + ' = ？（厘米）';
    answer = String(circ);
  } else if (name.indexOf('圆') !== -1 && name.indexOf('面积') !== -1) {
    var rc = Rng.randInt(rng, 3, 10);
    var areaC = Math.round(3.14 * rc * rc * 100) / 100;
    prompt = '列式计算：半径 ' + rc + ' 厘米的圆，面积 = 3.14 × ' + rc + ' × ' + rc + ' = ？（平方厘米）';
    answer = String(areaC);
  } else if (name.indexOf('周长') !== -1) {
    var pw = Rng.randInt(rng, 4, 15);
    var ph = Rng.randInt(rng, 3, 12);
    var peri = 2 * (pw + ph);
    prompt = '列式计算：长方形长 ' + pw + ' 厘米，宽 ' + ph + ' 厘米，周长 = 2 × (' + pw + ' + ' + ph + ') = ？（厘米）';
    answer = String(peri);
  } else if (name.indexOf('表面积') !== -1) {
    var sw = Rng.randInt(rng, 3, 8);
    var sh = Rng.randInt(rng, 2, 6);
    var sd = Rng.randInt(rng, 2, 6);
    var surf = 2 * (sw * sh + sw * sd + sh * sd);
    prompt = '列式计算：长方体长 ' + sw + '、宽 ' + sd + '、高 ' + sh + ' 厘米，表面积 = 2 × (' + sw + '×' + sh + ' + ' + sw + '×' + sd + ' + ' + sh + '×' + sd + ') = ？（平方厘米）';
    answer = String(surf);
  } else if (name.indexOf('圆锥') !== -1 && name.indexOf('体积') !== -1) {
    var vr = Rng.randInt(rng, 2, 6);
    var vh = Rng.randInt(rng, 3, 9);
    var vol = Math.round(3.14 * vr * vr * vh / 3 * 100) / 100;
    prompt = '列式计算：圆锥底面半径 ' + vr + ' 厘米，高 ' + vh + ' 厘米，体积 = 3.14 × ' + vr + ' × ' + vr + ' × ' + vh + ' ÷ 3 = ？（立方厘米）';
    answer = String(vol);
  } else if (name.indexOf('面积') !== -1) {
    var w = Rng.randInt(rng, 4, 15);
    var hh = Rng.randInt(rng, 3, 12);
    var ar = w * hh;
    prompt = '列式计算：长方形长 ' + w + ' 厘米，宽 ' + hh + ' 厘米，面积 = ' + w + ' × ' + hh + ' = ？（平方厘米）';
    answer = String(ar);
  } else if (name.indexOf('角') !== -1) {
    var angle = Rng.pick(rng, [30, 45, 60, 90, 120, 150, 180]);
    prompt = '列式计算：一个 ' + angle + ' 度的角，它的补角 = 180 − ' + angle + ' = ？（度）';
    answer = String(180 - angle);
  } else {
    var a = Rng.randInt(rng, 5, 50);
    var b = Rng.randInt(rng, 1, 20);
    prompt = '列式计算：一根绳子长 ' + a + ' 厘米，用去 ' + b + ' 厘米，还剩 = ' + a + ' − ' + b + ' = ？（厘米）';
    answer = String(a - b);
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: 'calc',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: answer, acceptable: [] },
    answerMode: 'input',
    data: { mode: 'calc', steps: 2, shapeName: name }
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
    capabilities: ['choice', 'judge', 'fill', 'calc', 'geometry', 'apply'],
    questionTypes: ['choice', 'judge', 'fill', 'calc', 'geometry', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};
      
      
      var kpName = (plan.semanticParams && plan.semanticParams.name) || '';
      var shapeMeta = getShapeMeta(kp, kpName);

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
          q = makeGeometryQuestion(plan, context, i, shapeMeta, graphic, kpName);
        } else if (qt === 'apply') {
          
          q = makeGeometryApplyQuestion(plan, context, i, shapeMeta, graphic, kpName);
        } else if (qt === 'calc') {
          
          q = makeCalcMeasurementQuestion(plan, context, i, kpName);
        } else {
          q = makeRecognitionQuestion(plan, context, i, shapeMeta, graphic);
        }
        questions.push(q);
      }
      return questions;
    }
  };
}




function buildAll() {
  return [
    createShapeGenerator({
      id: 'generator:shape-recognition',
      mode: 'recognition'
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


var NAME_TO_SPATIAL = [
  { re: /数对|坐标/, type: 'coordinate' },
  { re: /距离/, type: 'distance' },
  { re: /路线|行走/, type: 'route' },
  { re: /平移/, type: 'translation' },
  { re: /旋转/, type: 'rotation' },
  { re: /对称/, type: 'symmetry' },
  { re: /观察/, type: 'observe' },
  { re: /方向|位置|空间/, type: 'direction' }
];

function deriveSpatialType(name) {
  if (!name || typeof name !== 'string') return 'direction';
  for (var i = 0; i < NAME_TO_SPATIAL.length; i++) {
    if (NAME_TO_SPATIAL[i].re.test(name)) return NAME_TO_SPATIAL[i].type;
  }
  return 'direction';
}

function makeTranslationQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var dx = Rng.pick(rng, [-3, -2, -1, 1, 2, 3]);
  var dy = Rng.pick(rng, [-3, -2, -1, 1, 2, 3]);
  var qt = plan.questionTypeId;
  var hWord = dx > 0 ? '向右' + dx + '格' : '向左' + (-dx) + '格';
  var vWord = dy > 0 ? '向下' + dy + '格' : '向上' + (-dy) + '格';
  var prompt = '一个图形先' + hWord + '，再' + vWord + '，一共平移了多少格？';
  var answer = Math.abs(dx) + Math.abs(dy);
  if (qt === 'fill') {
    return {
      knowledgePointId: pkp(plan), questionType: 'fill', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i), prompt: prompt + ' ____ 格',
      answer: { value: String(answer), acceptable: [] }, answerMode: 'input',
      data: { mode: 'fill', steps: 1, shapeName: '平移' }
    };
  }
  if (qt === 'choice') {
    var distractorSet = new Set();
    distractorSet.add(String(answer));
    var candList = [answer + 1, answer - 1, answer + 2, Math.abs(dx), Math.abs(dy), answer + 3];
    var distractors = [];
    for (var ci = 0; ci < candList.length && distractors.length < 3; ci++) {
      var cv = String(candList[ci]);
      if (!distractorSet.has(cv) && candList[ci] > 0) { distractorSet.add(cv); distractors.push(cv); }
    }
    while (distractors.length < 3) { distractors.push(String(answer + distractors.length + 4)); }
    var opts = Rng.shuffle(rng, [String(answer)].concat(distractors)).slice(0, 4);
    var ci2 = opts.indexOf(String(answer));
    return {
      knowledgePointId: pkp(plan), questionType: 'choice', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i), prompt: prompt,
      answer: { value: String(ci2), acceptable: [] }, answerMode: 'choice',
      data: { mode: 'choice', steps: 1, options: opts, correctIndex: ci2, shapeName: '平移' }
    };
  }
  
  var shown = rng() < 0.5 ? answer : answer + (rng() < 0.5 ? 1 : -1);
  return {
    knowledgePointId: pkp(plan), questionType: 'judge', difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i), prompt: prompt + ' 答案是 ' + shown + ' 格——对还是错？',
    answer: { value: shown === answer, acceptable: [] }, answerMode: 'judge',
    data: { mode: 'judge', steps: 1, shapeName: '平移' }
  };
}

function makeRotationQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var angle = Rng.pick(rng, [90, 180, 270]);
  var dir = rng() < 0.5 ? '顺时针' : '逆时针';
  var qt = plan.questionTypeId;
  var prompt = '一个图形绕中心点' + dir + '旋转 ' + angle + ' 度后，方向是否改变？';
  var isTrue = angle === 180 ? true : true;
  if (qt === 'judge') {
    return {
      knowledgePointId: pkp(plan), questionType: 'judge', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '一个图形' + dir + '旋转 ' + angle + ' 度后，形状和大小不变——对还是错？',
      answer: { value: true, acceptable: [] }, answerMode: 'judge',
      data: { mode: 'judge', steps: 1, shapeName: '旋转' }
    };
  }
  if (qt === 'fill') {
    return {
      knowledgePointId: pkp(plan), questionType: 'fill', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '钟表指针从 12 走到 3，是' + dir + '旋转了 ____ 度。',
      answer: { value: '90', acceptable: [] }, answerMode: 'input',
      data: { mode: 'fill', steps: 1, shapeName: '旋转' }
    };
  }
  
  var opts = Rng.shuffle(rng, ['形状不变', '大小改变', '位置不变', '颜色改变']);
  return {
    knowledgePointId: pkp(plan), questionType: 'choice', difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: '图形旋转后，下列哪个说法是正确的？',
    answer: { value: '0', acceptable: [] }, answerMode: 'choice',
    data: { mode: 'choice', steps: 1, options: opts, correctIndex: 0, shapeName: '旋转' }
  };
}

function makeObserveQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var views = ['正面', '上面', '侧面'];
  var correct = Rng.pick(rng, views);
  var qt = plan.questionTypeId;
  if (qt === 'choice') {
    var opts = Rng.shuffle(rng, views.slice());
    var ci = opts.indexOf(correct);
    return {
      knowledgePointId: pkp(plan), questionType: 'choice', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '从' + correct + '观察一个正方体，看到的形状是正方形，这是从哪个方向看到的？',
      answer: { value: String(ci), acceptable: [] }, answerMode: 'choice',
      data: { mode: 'choice', steps: 1, options: opts, correctIndex: ci, shapeName: '观察' }
    };
  }
  if (qt === 'fill') {
    return {
      knowledgePointId: pkp(plan), questionType: 'fill', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '从____观察正方体，看到的是正方形。',
      answer: { value: correct, acceptable: [] }, answerMode: 'input',
      data: { mode: 'fill', steps: 1, shapeName: '观察' }
    };
  }
  
  return {
    knowledgePointId: pkp(plan), questionType: 'judge', difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: '从不同方向观察同一个物体，看到的形状一定相同——对还是错？',
    answer: { value: false, acceptable: [] }, answerMode: 'judge',
    data: { mode: 'judge', steps: 1, shapeName: '观察' }
  };
}

function makeCoordinateQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var x = Rng.randInt(rng, 1, 9);
  var y = Rng.randInt(rng, 1, 9);
  var qt = plan.questionTypeId;
  if (qt === 'fill') {
    return {
      knowledgePointId: pkp(plan), questionType: 'fill', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '在方格图中，点 A 的位置用数对表示是（____，' + y + '），它在第 ' + x + ' 列。',
      answer: { value: String(x), acceptable: [] }, answerMode: 'input',
      data: { mode: 'fill', steps: 1, shapeName: '数对' }
    };
  }
  if (qt === 'choice') {
    var correct = '(' + x + ',' + y + ')';
    var candCoords = ['(' + y + ',' + x + ')', '(' + (x + 1) + ',' + y + ')', '(' + x + ',' + (y + 1) + ')', '(' + (x + 1) + ',' + (y + 1) + ')'];
    var coordSet = new Set([correct]);
    var coordDistractors = [];
    for (var cdi = 0; cdi < candCoords.length && coordDistractors.length < 3; cdi++) {
      if (!coordSet.has(candCoords[cdi])) { coordSet.add(candCoords[cdi]); coordDistractors.push(candCoords[cdi]); }
    }
    var opts = Rng.shuffle(rng, [correct].concat(coordDistractors)).slice(0, 4);
    var ci = opts.indexOf(correct);
    return {
      knowledgePointId: pkp(plan), questionType: 'choice', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '点 A 在第 ' + x + ' 列第 ' + y + ' 行，用数对表示是？',
      answer: { value: String(ci), acceptable: [] }, answerMode: 'choice',
      data: { mode: 'choice', steps: 1, options: opts, correctIndex: ci, shapeName: '数对' }
    };
  }
  
  return {
    knowledgePointId: pkp(plan), questionType: 'judge', difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: '数对（3，5）表示第 3 行第 5 列——对还是错？',
    answer: { value: false, acceptable: [] }, answerMode: 'judge',
    data: { mode: 'judge', steps: 1, shapeName: '数对' }
  };
}

function createPositionGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:position';
  var subject = spec.subject || 'math';

  return {
    id: id,
    subject: subject,
    capabilities: ['choice', 'judge', 'fill', 'geometry', 'apply'],
    questionTypes: ['choice', 'judge', 'fill', 'geometry', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      
      var kpName = (plan.semanticParams && plan.semanticParams.name) || '';
      var spatialType = deriveSpatialType(kpName);

      for (var i = 0; i < count; i++) {
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        var q;
        var qt = plan.questionTypeId;

        if ((spatialType === 'translation' || spatialType === 'rotation' ||
             spatialType === 'observe' || spatialType === 'coordinate') &&
            (qt === 'geometry' || qt === 'apply')) {
          
          q = null;
        } else if (spatialType === 'translation') {
          q = makeTranslationQuestion(plan, context, i);
        } else if (spatialType === 'rotation') {
          q = makeRotationQuestion(plan, context, i);
        } else if (spatialType === 'observe') {
          q = makeObserveQuestion(plan, context, i);
        } else if (spatialType === 'coordinate') {
          q = makeCoordinateQuestion(plan, context, i);
        } else {
          var scene = generateScene(rng, plan.difficulty);
          var graphic = makeGraphicForPosition(scene, plan.difficulty);
          var meta = { legacyType: null, category: null };
          if (qt === 'choice') {
            q = makeChoiceDirectionQuestion(plan, context, i, scene, meta);
            q.data.graphic = graphic;
          } else if (qt === 'judge') {
            q = makeDirectionQuestion(plan, context, i, scene, meta);
            q.data.graphic = graphic;
          } else if (qt === 'fill') {
            q = makeFillDirectionQuestion(plan, context, i, scene, meta);
            q.data.graphic = graphic;
          } else if (qt === 'geometry') {
            
            q = makeFillDirectionQuestion(plan, context, i, scene, meta);
            q.questionType = 'geometry';
            q.data.graphic = graphic;
          } else if (qt === 'apply') {
            
            var objA = Rng.pick(rng, scene.objects);
            var objB = Rng.pick(rng, scene.objects.filter(function(o){ return o !== objA; })) || scene.objects[0];
            var dir = getRelativeDirection(objA, objB, 'self');
            q = {
              knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
              spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
              seed: seedFor(plan, context, i),
              prompt: objA.name + '在' + objB.name + '的' + dir + '。请再说出' + objB.name + '在' + objA.name + '的什么方向？',
              answer: { value: dir === '左边' ? '右边' : dir === '右边' ? '左边' : dir === '上面' ? '下面' : dir === '下面' ? '上面' : dir, acceptable: [] },
              answerMode: 'input',
              data: { mode: 'apply', steps: 1, graphic: graphic, shapeName: '方向' }
            };
          } else {
            q = makeDirectionQuestion(plan, context, i, scene, meta);
            q.data.graphic = graphic;
          }
        }
        
        
        if (!q) {
          var scene2 = generateScene(rng, plan.difficulty);
          var graphic2 = makeGraphicForPosition(scene2, plan.difficulty);
          var objA2 = Rng.pick(rng, scene2.objects);
          var objB2 = Rng.pick(rng, scene2.objects.filter(function(o){ return o !== objA2; })) || scene2.objects[0];
          var dir2 = getRelativeDirection(objA2, objB2, 'self');
          if (qt === 'geometry') {
            q = {
              knowledgePointId: pkp(plan), questionType: 'geometry', difficulty: plan.difficulty,
              spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
              seed: seedFor(plan, context, i),
              prompt: '观察下图，' + objA2.name + '在' + objB2.name + '的什么方向？',
              answer: { value: dir2, acceptable: [] }, answerMode: 'input',
              data: { mode: 'geometry', steps: 1, graphic: graphic2, shapeName: '空间' }
            };
          } else {
            q = {
              knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
              spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
              seed: seedFor(plan, context, i),
              prompt: objA2.name + '在' + objB2.name + '的' + dir2 + '。请说一说' + objB2.name + '在' + objA2.name + '的什么方向？',
              answer: { value: dir2 === '左边' ? '右边' : dir2 === '右边' ? '左边' : dir2 === '上面' ? '下面' : dir2 === '下面' ? '上面' : dir2, acceptable: [] },
              answerMode: 'input',
              data: { mode: 'apply', steps: 1, graphic: graphic2, shapeName: '空间' }
            };
          }
        }
        questions.push(q);
      }
      return questions;
    }
  };
}



function buildAll() {
  return [createPositionGenerator({ id: 'generator:position-direction' })];
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
var Arith = require("shared/generator/core/arithmetic-core.js");
var OpSem = require("shared/generator/core/op-semantics.js");

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
  { unit: '毫米', base: 1 },
  { unit: '厘米', base: 10 },
  { unit: '米', base: 1000 },
  { unit: '千米', base: 1000000 }
];
var MASS_UNITS = [
  { unit: '克', base: 1 },
  { unit: '千克', base: 1000 },
  { unit: '吨', base: 1000000 }
];
var TIME_UNITS = [
  { unit: '秒', base: 1 },
  { unit: '分', base: 60 },
  { unit: '小时', base: 3600 }
];

var MEASUREMENT_KINDS = {
  'rmb': { units: ['元', '角', '分'], category: 'money' },
  'length': { units: ['毫米', '厘米', '米', '千米'], category: 'length' },
  'mass': { units: ['克', '千克', '吨'], category: 'mass' },
  'time': { units: ['秒', '分', '小时'], category: 'time' },
  'capacity': { units: ['毫升', '升'], category: 'capacity' },
  'area': { units: ['平方厘米', '平方分米', '平方米'], category: 'area' }
};


var AREA_UNITS = [
  { unit: '平方厘米', base: 1 },
  { unit: '平方分米', base: 100 },
  { unit: '平方米', base: 10000 }
];
var CAPACITY_UNITS = [
  { unit: '毫升', base: 1 },
  { unit: '升', base: 1000 }
];




var NAME_TO_MEASURE = [
  { re: /人民币|元.*角|角.*分|购物|钱/, kind: 'rmb' },
  { re: /面积/, kind: 'area' },
  { re: /容积|升|毫升/, kind: 'capacity' },
  { re: /质量|千克|克|吨|称重|秤/, kind: 'mass' },
  { re: /时间|时.*分|分.*秒|小时/, kind: 'time' },
  { re: /厘米|米|长度|线段|进率/, kind: 'length' }
];

function deriveMeasureKind(name) {
  if (!name || typeof name !== 'string') return null;
  for (var i = 0; i < NAME_TO_MEASURE.length; i++) {
    if (NAME_TO_MEASURE[i].re.test(name)) return NAME_TO_MEASURE[i].kind;
  }
  return null;
}

function getMoneyMeta(kp, name, concept) {
  
  
  
  var kind = deriveMeasureKind(name)
    || deriveMeasureKind(concept)
    || (kp && ((kp.source && kp.source.legacyType) || (kp.legacy && kp.legacy.legacyType)))
    || (kp && kp.legacy && kp.legacy.category)
    || 'rmb';
  
  if (typeof kind === 'string') {
    if (kind.indexOf('length') !== -1 || kind.indexOf('厘米') !== -1 || kind.indexOf('米') !== -1) kind = 'length';
    else if (kind.indexOf('mass') !== -1 || kind.indexOf('克') !== -1 || kind.indexOf('千克') !== -1) kind = 'mass';
    else if (kind.indexOf('time') !== -1 || kind.indexOf('时') !== -1 || kind.indexOf('分') !== -1) kind = 'time';
    else if (kind.indexOf('area') !== -1 || kind.indexOf('面积') !== -1) kind = 'area';
    else if (kind.indexOf('capacity') !== -1 || kind.indexOf('升') !== -1) kind = 'capacity';
    else kind = 'rmb';
  }
  var lt = (kp && kp.source && kp.source.legacyType) || (kp && kp.legacy && kp.legacy.legacyType);
  var cat = kp && kp.legacy && kp.legacy.category;
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
  var opChar = OpSem.symbol(op) || '−';
  var prompt = aStr + ' ' + opChar + ' ' + bStr + ' = ____';
  var answer = formatRMB(answerFen);
  var qt = plan.questionTypeId;
  var result = {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: answer, acceptable: [] },
    answerMode: qt === 'choice' ? 'choice' : 'input',
    data: {
      mode: qt === 'choice' ? 'choice' : 'fill',
      steps: 1,
      kind: 'rmb',
      operation: op,
      operands: [aFen, bFen]
    }
  };
  
  if (qt === 'choice') {
    var distractors = [];
    var deltaSet = [1, 5, 10, 50, 100];
    while (distractors.length < 3) {
      var d = answerFen + Rng.pick(rng, deltaSet) * (rng() < 0.5 ? 1 : -1);
      if (d <= 0) d = answerFen + Rng.pick(rng, deltaSet);
      var dStr = formatRMB(d);
      if (dStr !== answer && distractors.indexOf(dStr) === -1) distractors.push(dStr);
    }
    result.data.options = Rng.shuffle(rng, [answer].concat(distractors).slice(0, 4));
    result.data.correctIndex = result.data.options.indexOf(answer);
    result.answer = { value: String(result.data.correctIndex), acceptable: [] };
  }
  return result;
}

function makeMeasurementConversionQuestion(plan, context, i, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var kind = meta.kind;
  var table = kind === 'area' ? AREA_UNITS
    : kind === 'capacity' ? CAPACITY_UNITS
    : kind === 'mass' ? MASS_UNITS
    : kind === 'time' ? TIME_UNITS
    : LENGTH_UNITS;
  var units = table.filter(function(u){
    return MEASUREMENT_KINDS[kind] && MEASUREMENT_KINDS[kind].units && MEASUREMENT_KINDS[kind].units.indexOf(u.unit) !== -1;
  });
  
  if (units.length < 2) {
    return makeRMBConversionQuestion(plan, context, i, meta);
  }
  
  var baseValue = Rng.randInt(rng, 1, Math.max(5, plan.difficulty * 2));
  var fromUnit = Rng.pick(rng, units);
  var toUnit = Rng.pick(rng, units.filter(function(u){ return u.unit !== fromUnit.unit; }));
  
  if (!fromUnit || !toUnit) {
    return makeRMBConversionQuestion(plan, context, i, meta);
  }
  
  var factor = fromUnit.base / toUnit.base;
  var answer = baseValue * factor;
  
  answer = Math.round(answer * 1e6) / 1e6;
  var qt = plan.questionTypeId;
  var prompt;
  
  if (qt === 'calc') {
    prompt = baseValue + fromUnit.unit + ' = ' + baseValue + ' × ' + factor + ' = ____ ' + toUnit.unit;
  } else {
    prompt = baseValue + fromUnit.unit + ' = ____ ' + toUnit.unit;
  }
  
  var result = {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: qt === 'choice' ? 'choice' : 'input',
    data: {
      mode: qt,
      steps: 1,
      kind: kind,
      operation: 'conversion',
      fromUnit: fromUnit.unit,
      toUnit: toUnit.unit
    }
  };
  
  if (qt === 'choice') {
    var ansNum = Number(answer);
    var distr = [];
    var deltas = [1, 2, 5, 10, 100];
    while (distr.length < 3) {
      var dv = ansNum + Rng.pick(rng, deltas) * (rng() < 0.5 ? 1 : -1);
      if (dv <= 0) dv = ansNum + Rng.pick(rng, deltas);
      if (distr.indexOf(dv) === -1 && dv !== ansNum) distr.push(dv);
    }
    result.data.options = Rng.shuffle(rng, [ansNum].concat(distr).slice(0, 4));
    result.data.correctIndex = result.data.options.indexOf(ansNum);
    result.answer = { value: String(result.data.correctIndex), acceptable: [] };
  }
  return result;
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
      data: { mode: 'apply', steps: 2, kind: 'rmb', operation: op === 'change' ? 'sub' : 'add', amountA: aFen, amountB: bFen }
    };
  }
  
  
  
  if (kind === 'length') {
    var a = Rng.randInt(rng, 5, 50);
    var b = Rng.randInt(rng, 1, 20);
    var useCut = rng() < 0.5;
    return {
      knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: useCut
        ? '一根绳子长 ' + a + ' 厘米，剪去 ' + b + ' 厘米，还剩多少厘米？'
        : '小明身高 ' + a + ' 厘米，小红比小明矮 ' + b + ' 厘米，小红身高多少厘米？',
      answer: { value: String(useCut ? a - b : a - b), acceptable: [] },
      answerMode: 'input',
      data: { mode: 'apply', steps: 2, kind: 'length', operation: 'sub' }
    };
  }
  if (kind === 'area') {
    var w = Rng.randInt(rng, 3, 12);
    var h = Rng.randInt(rng, 2, 10);
    return {
      knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '一个长方形长 ' + w + ' 厘米，宽 ' + h + ' 厘米，它的面积是多少平方厘米？',
      answer: { value: String(w * h), acceptable: [] },
      answerMode: 'input',
      data: { mode: 'apply', steps: 2, kind: 'area', operation: 'mul' }
    };
  }
  if (kind === 'mass') {
    var m1 = Rng.randInt(rng, 1, 10);
    var m2 = Rng.randInt(rng, 1, 5);
    return {
      knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '一袋大米重 ' + m1 + ' 千克，一袋面粉重 ' + m2 + ' 千克，大米比面粉重多少千克？',
      answer: { value: String(m1 - m2), acceptable: [] },
      answerMode: 'input',
      data: { mode: 'apply', steps: 2, kind: 'mass', operation: 'sub' }
    };
  }
  if (kind === 'time') {
    var t1 = Rng.randInt(rng, 1, 10);
    var t2 = Rng.randInt(rng, 1, 5);
    return {
      knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '小明做作业用了 ' + t1 + ' 分钟，看电视用了 ' + t2 + ' 分钟，一共用了多少分钟？',
      answer: { value: String(t1 + t2), acceptable: [] },
      answerMode: 'input',
      data: { mode: 'apply', steps: 2, kind: 'time', operation: 'add' }
    };
  }
  if (kind === 'capacity') {
    var c1 = Rng.randInt(rng, 1, 5);
    var c2 = Rng.randInt(rng, 1, 3);
    return {
      knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '一桶油有 ' + c1 + ' 升，用去 ' + c2 + ' 升，还剩多少升？',
      answer: { value: String(c1 - c2), acceptable: [] },
      answerMode: 'input',
      data: { mode: 'apply', steps: 2, kind: 'capacity', operation: 'sub' }
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
    capabilities: ['fill', 'choice', 'judge', 'apply', 'calc'],
    questionTypes: ['fill', 'choice', 'judge', 'apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};
      
      
      var kpName = (plan.semanticParams && plan.semanticParams.name) || '';
      var kpConcept = (plan.semanticParams && plan.semanticParams.concept) || '';
      var meta = getMoneyMeta(kp, kpName, kpConcept);

      for (var i = 0; i < count; i++) {
        var q;
        var qt = plan.questionTypeId;
        var isRMB = meta.kind === 'rmb';
        
        if (qt === 'fill') {
          if (isRMB && rng() < 0.5) q = makeRMBConversionQuestion(plan, context, i, meta);
          else if (isRMB) q = makeRMBCalculationQuestion(plan, context, i, meta);
          else q = makeMeasurementConversionQuestion(plan, context, i, meta);
        } else if (qt === 'apply') {
          q = makeWordProblemQuestion(plan, context, i, meta);
        } else if (qt === 'calc') {
          
          q = isRMB ? makeRMBCalculationQuestion(plan, context, i, meta)
                    : makeMeasurementConversionQuestion(plan, context, i, meta);
        } else if (qt === 'choice' || qt === 'judge') {
          q = isRMB ? makeRMBCalculationQuestion(plan, context, i, meta)
                    : makeMeasurementConversionQuestion(plan, context, i, meta);
        } else {
          q = makeRMBConversionQuestion(plan, context, i, meta);
        }
        
        q.data.graphic = makeGraphicForMoney(meta, plan.difficulty);
        
        if (meta.kind === 'rmb' && q.data) {
          var amounts = null;
          var qd = q.data;
          if (Array.isArray(qd.operands) && qd.operands.length >= 2) {
            amounts = qd.operands.slice(0, 2).map(Number);
          } else if (qd.amountA != null && qd.amountB != null) {
            amounts = [Number(qd.amountA), Number(qd.amountB)];
          } else if (qd.originalAmount != null) {
            var fen = (typeof qd.originalAmount === 'string') ? parseRMB(qd.originalAmount) : Number(qd.originalAmount);
            amounts = isFinite(fen) ? [fen] : null;
          }
          var op = OpSem.symbol(qd.operation);
          if (amounts && amounts.length) {
            q.data.graphic = { type: 'currency', subtype: 'rmb', params: { amounts: amounts, op: op } };
          } else {
            delete q.data.graphic;
          }
        }
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




function buildAll() {
  return [createMoneyGenerator({ id: 'generator:money-measurement' })];
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
    capabilities: ['apply', 'fill', 'choice', 'judge', 'calc'],
    questionTypes: ['apply', 'fill', 'choice', 'judge', 'calc'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};
      var meta = getApplicationMeta(kp);

      for (var i = 0; i < count; i++) {
        var q = makeApplicationQuestion(plan, context, i, meta);
        q.data.graphic = makeGraphicForApplication(q.data.template, q.data.numbers);
        questions.push(q);
      }
      return questions;
    }
  };
}




function buildAll() {
  return [createApplicationGenerator({ id: 'generator:application-word' })];
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


function makeCalcToJudge(plan, context, i, kpIds) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var op = Rng.pick(rng, ['+', '−']);
  var a, b, correct;
  if (op === '+') {
    a = Rng.randInt(rng, 1, 9);
    b = Rng.randInt(rng, 1, 9);
    correct = a + b;
  } else {
    a = Rng.randInt(rng, 2, 10);
    b = Rng.randInt(rng, 1, a - 1);
    correct = a - b;
  }
  var isTrue = Rng.randInt(rng, 0, 1) === 1;
  var shown = isTrue ? correct : correct + (Rng.randInt(rng, 0, 1) ? 1 : -1);
  var prompt = a + ' ' + op + ' ' + b + ' = ' + shown + ' （对还是错？）';

  return {
    knowledgePointId: pkp(plan),
    knowledgePointIds: kpIds.slice(),
    questionType: 'judge',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: isTrue,
    answerMode: 'judge',    data: {
      mode: 'calc-to-judge',
      steps: 1,
      primaryKp: pkp(plan),
      operation: op,
      operands: [a, b],
      correct: correct,
      shown: shown,
      composite: true
    }
  };
}

function createCompositeGenerator(spec) {
  spec = spec || {};

  return {
    id: spec.id || 'generator:composite',
    subject: spec.subject || 'math',
    capabilities: ['calc', 'judge', 'fill', 'apply'],
    questionTypes: ['calc', 'judge', 'fill', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],
    supportsComposite: true,

    supports: function (plan) {
      return !!(plan && plan.combine === true &&
        Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds.length >= 2);
    },

    generate: function (plan, context) {
      context = context || {};
      var kpIds = (plan && Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds.length)
        ? plan.knowledgePointIds
        : (plan && plan.knowledgePointId ? [plan.knowledgePointId] : []);
      if (kpIds.length < 2) {
        throw new Error('Composite generator 需要至少 2 个知识点');
      }
      var count = plan.count || 1;
      var questions = [];
      for (var i = 0; i < count; i++) {
        questions.push(makeCalcToJudge(plan, context, i, kpIds));
      }
      return questions;
    }
  };
}




function buildAll() {
  return [createCompositeGenerator({ id: 'generator:composite' })];
}

module.exports = {
  createCompositeGenerator: createCompositeGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/counting.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");

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

  var v = i; 
  var prompt, answer, steps;
  if (type === 'principle') {
    var m = Rng.randInt(rng, 3, 8);
    var n = Rng.randInt(rng, 2, 6);
    prompt = '从A城到B城有' + m + '条路线，从B城到C城有' + n + '条路线，从A城到C城共有多少种走法？';
    answer = m * n;
    steps = 2;
  } else if (type === 'enumeration') {
    
    var ENUM = [
      { digits: [1, 2, 3, 4, 5], len: 2 },
      { digits: [1, 2, 3, 4, 5], len: 3 },
      { digits: [2, 3, 4, 5, 6], len: 2 },
      { digits: [1, 3, 5, 7, 9], len: 3 }
    ];
    var en = ENUM[v % ENUM.length];
    var used = en.digits.slice(0, en.len + 1);
    var enumAns = 1; for (var d = 0; d < en.len; d++) enumAns *= (used.length - d);
    prompt = '用' + used.join('、') + '这' + used.length + '个数字，可以组成多少个没有重复数字的' + en.len + '位数？';
    answer = enumAns;
    steps = 3;
  } else if (type === 'worst-case') {
    var WC = [
      { c: 3, k: 3, ans: 7 }, { c: 4, k: 3, ans: 9 }, { c: 2, k: 4, ans: 7 }, { c: 5, k: 2, ans: 6 }
    ];
    var wc = WC[v % WC.length];
    var colorNames = ['红', '黄', '蓝', '绿', '紫'];
    prompt = '一个盒子里有' + colorNames.slice(0, wc.c).join('、') + '等' + wc.c + '种颜色的球各若干个，至少要摸出多少个球，才能保证有' + wc.k + '个球颜色相同？';
    answer = wc.c * (wc.k - 1) + 1; steps = 2;
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
    
    var BUNDLE = [5, 6, 7, 8];
    var bn = BUNDLE[v % BUNDLE.length];
    prompt = bn + '本不同的书排成一排，其中有 2 本必须相邻，一共有多少种不同的排法？';
    answer = factorial(2) * factorial(bn - 1);
    steps = 3;
  } else if (type === 'insertion') {
    
    var INS = [
      { m: 3, f: 2 }, { m: 4, f: 2 }, { m: 4, f: 3 }, { m: 5, f: 2 }
    ];
    var ins = INS[v % INS.length];
    var insAns = 1; for (var ii = 0; ii < ins.f; ii++) insAns *= (ins.m + 1 - ii);
    prompt = ins.m + ' 名男生已按固定顺序排成一排（形成 ' + (ins.m + 1) + ' 个空位），现将 ' + ins.f + ' 名女生插入空位，要求女生互不相邻，一共有多少种插入方法？';
    answer = insAns; steps = 2;
  } else if (type === 'starsbars') {
    
    var SB = [
      { sn: 7, sm: 3 }, { sn: 10, sm: 4 }, { sn: 8, sm: 2 }, { sn: 12, sm: 5 }
    ];
    var sb = SB[v % SB.length];
    prompt = '把 ' + sb.sn + ' 个相同的苹果分给 ' + sb.sm + ' 个小朋友，每人至少分到 1 个，一共有多少种不同的分法？';
    answer = nCr(sb.sn - 1, sb.sm - 1);
    steps = 2;
  } else if (type === 'pigeonhole') {
    
    var PH = [
      { c: 4, k: 4 }, { c: 5, k: 3 }, { c: 3, k: 2 }, { c: 6, k: 3 }
    ];
    var ph = PH[v % PH.length];
    var phColors = ['红', '黄', '蓝', '绿', '紫', '橙'];
    prompt = '盒子里有' + phColors.slice(0, ph.c).join('、') + '等 ' + ph.c + ' 种颜色的球各若干个（球除颜色外完全相同）。至少要摸出多少个球，才能保证其中有 ' + ph.k + ' 个球颜色相同？';
    answer = ph.c * (ph.k - 1) + 1;
    steps = 2;
  } else if (type === 'inclusion') {
    
    var INC = [
      { total: 40, aN: 20, bN: 18, cN: 16, ab: 8, ac: 7, bc: 6, abc: 3 },
      { total: 50, aN: 25, bN: 22, cN: 20, ab: 10, ac: 9, bc: 8, abc: 4 },
      { total: 45, aN: 18, bN: 16, cN: 15, ab: 7, ac: 6, bc: 5, abc: 2 }
    ];
    var inc = INC[v % INC.length];
    prompt = '某班共有 ' + inc.total + ' 人，参加数学小组的有 ' + inc.aN + ' 人，参加英语小组的有 ' + inc.bN + ' 人，参加科学小组的有 ' + inc.cN + ' 人；'
      + '同时参加数学和英语的有 ' + inc.ab + ' 人，同时参加数学和科学的有 ' + inc.ac + ' 人，同时参加英语和科学的有 ' + inc.bc + ' 人；'
      + '三个小组都参加的有 ' + inc.abc + ' 人。三个小组都没参加的有多少人？';
    answer = inc.total - (inc.aN + inc.bN + inc.cN - inc.ab - inc.ac - inc.bc + inc.abc);
    steps = 3;
  } else if (type === 'recursion') {
    
    var REC = [5, 6, 7, 4];
    var rn = REC[v % REC.length];
    prompt = '小明上楼梯，每次可以走 1 级或 2 级台阶。他上到第 ' + rn + ' 级台阶时，一共有多少种不同的走法？';
    answer = stairWays(rn);
    steps = 3;
  } else if (type === 'derangement') {
    
    var DER = [4, 3, 5, 6];
    var dn = DER[v % DER.length];
    prompt = '有 ' + dn + ' 封信和写好对应地址的 ' + dn + ' 个信封，把信全部装错（没有一封信装进正确的信封），一共有多少种装法？';
    answer = derangement(dn);
    steps = 2;
  } else {
    var a = Rng.randInt(rng, 2, 6);
    var b = Rng.randInt(rng, 2, 6);
    prompt = name + '：从' + a + '种水果和' + b + '种饮料中各选一种，共有多少种搭配？';
    answer = a * b;
    steps = 2;
    
    if (plan.questionTypeId === 'calc') {
      prompt = name + '：从' + a + '种水果和' + b + '种饮料中各选一种，一共有多少种搭配？'
        + '列式：' + a + ' × ' + b + ' = ？';
    }
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




function createCountingGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:counting';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};

      for (var i = 0; i < count; i++) {
        questions.push(makeCountingQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [createCountingGenerator()];
}

module.exports = {
  createCountingGenerator: createCountingGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/reasoning.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");

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
  
  
  var name = (plan && plan.semanticParams && plan.semanticParams.name)
    || (kp && (kp.name || (kp.identity && kp.identity.name)))
    || '逻辑推理';

  
  
  
  if (plan.questionTypeId === 'calc') {
    var cPrompt, cAnswer;
    if (name.indexOf('除') !== -1 || name.indexOf('乘') !== -1 || name.indexOf('口诀') !== -1) {
      var a = Rng.randInt(rng, 7, 9);
      var b = Rng.randInt(rng, 2, 9);
      if (i % 2 === 0) {
        
        cPrompt = '运用乘法口诀计算：' + a + ' × ' + b + ' = ____';
        cAnswer = a * b;
      } else {
        cPrompt = '用乘法口诀求商：' + (a * b) + ' ÷ ' + a + ' = ____';
        cAnswer = b;
      }
    } else {
      var x = Rng.randInt(rng, 2, 9);
      var y = Rng.randInt(rng, 2, 9);
      var z = Rng.randInt(rng, 1, 9);
      cPrompt = '找规律列式：' + x + ' × ' + y + ' + ' + z + ' = ____';
      cAnswer = x * y + z;
    }
    return {
      knowledgePointId: pkp(plan),
      questionType: 'calc',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: cPrompt,
      answer: { value: String(cAnswer), acceptable: [] },
      answerMode: 'input',
      data: { mode: 'calc', steps: 1, operation: 'mixed-arith', questionType: 'calc' }
    };
  }

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
  else if (name.indexOf('规律') !== -1 || name.indexOf('线段') !== -1 || name.indexOf('数字推理') !== -1) type = 'seq';
  else type = 'logic';

  
  var prompt, answer, steps, logicOptions = null, choicePool = null;
  var v = i; 
  if (type === 'drawer') {
    var DRAWER = [
      { c: ['红', '黄', '蓝', '绿'], k: 2, ans: 5 },
      { c: ['红', '黄', '蓝'], k: 2, ans: 4 },
      { c: ['红', '黄', '蓝', '绿'], k: 3, ans: 9 },
      { c: ['黑', '白'], k: 2, ans: 3 }
    ];
    var d = DRAWER[v % DRAWER.length];
    prompt = '有' + d.c.length + '种颜色的球（' + d.c.join('、') + '），至少要摸出多少个，才能保证有' + d.k + '个球颜色相同？';
    answer = d.ans; steps = 2;
  } else if (type === 'extreme') {
    if (v % 3 === 0) {
      var twoSum = Rng.randInt(rng, 10, 50);
      var half = Math.floor(twoSum / 2);
      prompt = '两个数的和是' + twoSum + '，这两个数的乘积最大是多少？';
      answer = half * (twoSum - half); steps = 2;
    } else if (v % 3 === 1) {
      var twoSum2 = Rng.randInt(rng, 10, 50);
      var half2 = Math.floor(twoSum2 / 2);
      prompt = '两个数的和是' + twoSum2 + '，这两个数相差最小时分别是多少？';
      answer = half2 + ' 和 ' + (twoSum2 - half2); steps = 2;
    } else {
      var threeSum = Rng.randInt(rng, 12, 60);
      var base = Math.floor(threeSum / 3);
      var rem = threeSum - 3 * base;
      var parts = [base, base, base]; parts[2] += rem;
      prompt = '三个数的和是' + threeSum + '，这三个数尽可能接近时乘积最大，最大乘积是多少？';
      answer = parts[0] * parts[1] * parts[2]; steps = 2;
    }
  } else if (type === 'chicken-rabbit') {
    if (v % 3 === 0) {
      var heads = Rng.randInt(rng, 8, 20);
      var rabb0 = Rng.randInt(rng, 3, Math.max(3, heads - 2));
      var feet = heads * 2 + rabb0 * 2;
      prompt = '鸡兔同笼，共有' + heads + '个头，' + feet + '只脚。鸡和兔各多少只？';
      var r0 = (feet - heads * 2) / 2;
      answer = '鸡' + (heads - r0) + '只，兔' + r0 + '只'; steps = 3;
      choicePool = ['鸡' + (heads - r0) + '只，兔' + r0 + '只',
        '鸡' + r0 + '只，兔' + (heads - r0) + '只',
        '鸡' + (heads - r0 - 1) + '只，兔' + (r0 + 1) + '只',
        '鸡' + (heads - r0 + 1) + '只，兔' + (r0 - 1) + '只'];
    } else if (v % 3 === 1) {
      var D = Rng.randInt(rng, 1, 5);
      var R = Rng.randInt(rng, 3, 8);
      var F = 6 * R + 2 * D;
      prompt = '鸡兔同笼，鸡比兔多' + D + '只，共有' + F + '只脚。鸡和兔各多少只？';
      answer = '鸡' + (R + D) + '只，兔' + R + '只'; steps = 3;
      choicePool = ['鸡' + (R + D) + '只，兔' + R + '只',
        '鸡' + R + '只，兔' + (R + D) + '只',
        '鸡' + (R + D - 1) + '只，兔' + (R + 1) + '只',
        '鸡' + (R + D + 1) + '只，兔' + (R - 1) + '只'];
    } else {
      var D2 = Rng.randInt(rng, 1, 4);
      var C = Rng.randInt(rng, 3, 8);
      var F2 = 6 * C + 4 * D2;
      prompt = '鸡兔同笼，兔比鸡多' + D2 + '只，共有' + F2 + '只脚。鸡和兔各多少只？';
      answer = '鸡' + C + '只，兔' + (C + D2) + '只'; steps = 3;
      choicePool = ['鸡' + C + '只，兔' + (C + D2) + '只',
        '鸡' + (C + D2) + '只，兔' + C + '只',
        '鸡' + (C - 1) + '只，兔' + (C + D2 + 1) + '只',
        '鸡' + (C + 1) + '只，兔' + (C + D2 - 1) + '只'];
    }
  } else if (type === 'tree-planting') {
    var L = Rng.randInt(rng, 100, 500);
    var G = Rng.randInt(rng, 5, 20);
    var TP = [
      { desc: '两端都栽', ans: Math.floor(L / G) + 1 },
      { desc: '两端都不栽', ans: Math.floor(L / G) - 1 },
      { desc: '只在一端栽', ans: Math.floor(L / G) },
      { desc: '在环形操场周围栽（封闭）', ans: Math.floor(L / G) }
    ];
    var tp = TP[v % TP.length];
    prompt = '在一条长' + L + '米的公路一边植树，每隔' + G + '米栽一棵（' + tp.desc + '），一共要栽多少棵？';
    answer = tp.ans; steps = 2;
  } else if (type === 'find-defect') {
    var DEFECT = [
      { n: 3, ans: 1 }, { n: 9, ans: 2 }, { n: 27, ans: 3 }, { n: 81, ans: 4 }
    ];
    var df = DEFECT[v % DEFECT.length];
    prompt = '有' + df.n + '瓶水，其中1瓶是次品（略轻）。用天平称，至少称几次就能找出次品？';
    answer = df.ans; steps = 2;
  } else if (type === 'handshake') {
    var HSK = [
      { w: '个人，每两个人握一次手', ans: function (n) { return n * (n - 1) / 2; } },
      { w: '支球队进行单循环比赛，每两队赛一场', ans: function (n) { return n * (n - 1) / 2; } },
      { w: '个点，每两个点连一条线段', ans: function (n) { return n * (n - 1) / 2; } }
    ];
    var hs = HSK[v % HSK.length];
    var n = Rng.randInt(rng, 4, 12);
    prompt = n + hs.w + '，一共需要多少次？';
    answer = hs.ans(n); steps = 2;
  } else if (type === 'sudoku') {
    var SUD = [
      { w: '请根据已知数字推理出空格中的数字。' },
      { w: '在 4×4 数独中，根据已知数字填出空格。' },
      { w: '在 6×6 数独中，根据已知数字填出空格。' }
    ];
    var su = SUD[v % SUD.length];
    prompt = name + '：' + su.w;
    answer = '（推理过程略）'; steps = 4;
  } else if (type === 'winning') {
    var WIN = [
      { w: '两堆棋子，每次只能从一堆中取 1~3 个，取到最后一个棋子者胜', a: '先手必胜（对称策略）' },
      { w: '一堆石子，每次可取 1~4 个，取到最后一个者胜', a: '先手必胜（凑 5 策略）' },
      { w: '三堆石子，每次从一堆取任意个，取到最后一个者胜', a: '先手必胜（尼姆和策略）' }
    ];
    var win = WIN[v % WIN.length];
    prompt = name + '：' + win.w + '。先手必胜还是后手必胜？';
    answer = win.a; steps = 3;
  } else if (type === 'optimization') {
    if (v % 3 === 0) {
      var pans = Rng.randInt(rng, 2, 5);
      prompt = '用一口锅烙' + pans + '张饼，每张饼两面都要烙，每面需要 2 分钟。至少需要多少分钟？';
      answer = pans * 2; steps = 3;
    } else if (v % 3 === 1) {
      prompt = '煮一个鸡蛋需要 8 分钟，同时可以洗锅 2 分钟。至少需要多少分钟？';
      answer = 8; steps = 2;
    } else {
      prompt = '看一集动画需要 15 分钟，同时可以写完作业 10 分钟。至少需要多少分钟？';
      answer = 15; steps = 2;
    }
  } else if (type === 'seq') {
    var SEQ = [
      { s: '2, 4, 6, 8', ans: 10 },
      { s: '1, 3, 5, 7', ans: 9 },
      { s: '1, 2, 4, 8', ans: 16 },
      { s: '1, 1, 2, 3, 5', ans: 8 }
    ];
    var sq = SEQ[v % SEQ.length];
    prompt = name + '：观察数列规律，写出下一个数：' + sq.s + ', ?';
    answer = sq.ans; steps = 1;
  } else {
    
    
    var LGV = v % 3;
    if (LGV === 0) {
      prompt = '甲、乙、丙三人中只有一人说真话。甲说：「乙在说谎。」乙说：「丙在说谎。」丙说：「甲和乙都在说谎。」谁说了真话？';
      answer = '乙'; steps = 3;
      logicOptions = ['甲', '乙', '丙'];
    } else if (LGV === 1) {
      var ageTop = Rng.randInt(rng, 9, 12);
      prompt = '小明比小红大 2 岁，小红比小刚大 3 岁，小明今年 ' + ageTop + ' 岁。三人中谁最大？';
      answer = '小明'; steps = 2;
      logicOptions = ['小明', '小红', '小刚'];
    } else {
      prompt = '三个盒子上分别标着「苹果」「橘子」「混合」，标签全都贴错了。只从其中一个盒子里摸出一个水果，就能判断所有盒子里装的是什么。应该从哪个盒子摸？';
      answer = '标着「混合」的盒子'; steps = 3;
      logicOptions = ['标着「苹果」的盒子', '标着「橘子」的盒子', '标着「混合」的盒子'];
    }
  }

  
  
  if (plan.questionTypeId === 'choice' && (logicOptions || choicePool)) {
    var srcPool = (choicePool || logicOptions).map(String);
    var uniq = [], seenO = {};
    for (var oi = 0; oi < srcPool.length; oi++) {
      if (srcPool[oi] && !seenO[srcPool[oi]]) { seenO[srcPool[oi]] = 1; uniq.push(srcPool[oi]); }
    }
    var ansText = String(answer);
    if (uniq.indexOf(ansText) === -1) uniq.unshift(ansText);
    var opts = Rng.shuffle(rng, uniq.slice(0, 4));
    if (opts.indexOf(ansText) === -1) opts[0] = ansText;
    return {
      knowledgePointId: pkp(plan),
      questionType: plan.questionTypeId,
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: prompt,
      answer: { value: ansText, acceptable: [] },
      answerMode: 'choice',
      data: { mode: 'apply', steps: steps, questionType: plan.questionTypeId, options: opts, correctIndex: opts.indexOf(ansText) }
    };
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




function createReasoningGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:reasoning';

  return {
    id: id,
    subject: 'math',
    
    
    capabilities: ['apply', 'calc', 'fill', 'choice'],
    questionTypes: ['apply', 'calc', 'fill', 'choice'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};

      for (var i = 0; i < count; i++) {
        questions.push(makeReasoningQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [createReasoningGenerator()];
}

module.exports = {
  createReasoningGenerator: createReasoningGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/stats.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");

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
  
  var name = (plan && plan.semanticParams && plan.semanticParams.name)
    || (kp && (kp.name || (kp.identity && kp.identity.name)))
    || '统计问题';

  var qt = plan.questionTypeId;
  var type = 'generic';
  if (name.indexOf('平均') !== -1) type = 'average';
  else if (name.indexOf('可能') !== -1) type = 'probability';
  
  else if (name.indexOf('复式') !== -1) type = 'double-chart';
  else if (name.indexOf('折线') !== -1) type = 'line-chart';
  else if (name.indexOf('条形') !== -1) type = 'bar-chart';
  else if (name.indexOf('扇形') !== -1 || name.indexOf('饼') !== -1) type = 'pie-chart';
  
  
  else if (name.indexOf('经过') !== -1) type = 'elapsed-time';
  else if (name.indexOf('平年') !== -1 || name.indexOf('闰年') !== -1) type = 'leap-year';
  else if (name.indexOf('钟面') !== -1 || name.indexOf('时针') !== -1 || name.indexOf('分针') !== -1 || name.indexOf('秒针') !== -1) type = 'clock';
  else if (name.indexOf('时间单位') !== -1 || name.indexOf('时、分、秒') !== -1) type = 'time-convert';
  else if (name.indexOf('年') !== -1 || name.indexOf('月') !== -1) type = 'calendar';
  else if (name.indexOf('统计表') !== -1 || name.indexOf('正字') !== -1 || name.indexOf('收集') !== -1) type = 'data-collect';
  else type = 'chart-read';

  
  var PEOPLE_LABELS = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
  var FRUIT_LABELS = ['苹果', '香蕉', '西瓜', '葡萄'];
  var SUBJECT_LABELS = ['语文', '数学', '英语', '科学'];
  var series;
  function buildSeries(labels, lo, hi) {
    return labels.map(function (l) { return { label: l, value: Rng.randInt(rng, lo, hi) }; });
  }
  
  function distinctSeries(labels, lo, hi) {
    var pool = [];
    for (var v = lo; v <= hi; v++) pool.push(v);
    var picked = Rng.shuffle(rng, pool).slice(0, labels.length);
    return labels.map(function (l, li) { return { label: l, value: picked[li] }; });
  }

  var prompt, answer, steps, graphic;
  var chOpts = null;
  var data = { mode: 'apply', steps: steps, questionType: qt };
  if (type === 'average') {
    var nums = [];
    for (var ai = 0; ai < 4; ai++) nums.push(Rng.randInt(rng, 20, 100));
    var avg = Math.round(nums.reduce(function (a, b) { return a + b; }, 0) / nums.length);
    prompt = name + '：四个同学的身高分别是' + nums.join('cm、') + 'cm，求他们的平均身高。';
    answer = avg; steps = 2;
  } else if (type === 'probability') {
    var total = Rng.randInt(rng, 6, 12);
    var favorable = Rng.randInt(rng, 1, total - 1);
    prompt = '盒子里有' + total + '个球，其中' + favorable + '个红球，摸到红球的可能性是多少？';
    answer = favorable + '/' + total; steps = 1;
    if (qt === 'choice') {
      
      var pPool = [favorable, favorable - 1, favorable + 1, favorable + 2];
      var pSeen = {};
      var pUniq = [];
      pPool.forEach(function (x) {
        if (x >= 1 && x <= total - 1 && !pSeen[x]) { pSeen[x] = 1; pUniq.push(x); }
      });
      var pPad = 1;
      while (pUniq.length < 4) {
        var pCand = ((favorable + pPad * 2) % (total - 1)) + 1;
        if (!pSeen[pCand]) { pSeen[pCand] = 1; pUniq.push(pCand); }
        pPad++;
      }
      chOpts = Rng.shuffle(rng, pUniq.slice(0, 4).map(function (x) { return x + '/' + total; }));
      answer = favorable + '/' + total;
      prompt = name + '：盒子里有' + total + '个球，其中' + favorable + '个红球，其余是白球。摸到红球的可能性是多少？';
      data.choiceForm = true;
    }
  } else if (type === 'line-chart') {
    var wdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    series = distinctSeries(wdays, 18, 35);
    series.sort(function (x, y) { return wdays.indexOf(x.label) - wdays.indexOf(y.label); });
    var hi = series.slice().sort(function (x, y) { return y.value - x.value; })[0];
    var lo = series.slice().sort(function (x, y) { return x.value - y.value; })[0];
    var LC_Q = [
      { q: '哪一天的温度最高？最高温度是多少？', a: hi.label + '，' + hi.value + '℃' },
      { q: '哪一天的温度最低？最低温度是多少？', a: lo.label + '，' + lo.value + '℃' },
      { q: '温度最高的一天比最低的一天高多少℃？', a: (hi.value - lo.value) + '℃' }
    ];
    var lcq = LC_Q[i % LC_Q.length];
    prompt = name + '：根据折线图回答：' + lcq.q;
    answer = lcq.a; steps = 1;
    graphic = { type: 'chart', subtype: 'line', params: { title: '一周气温变化', data: series } };
    if (qt === 'choice') {
      
      var lcTarget = (i % 2 === 0) ? hi : lo;
      chOpts = Rng.shuffle(rng, series.map(function (s) { return s.label + '，' + s.value + '℃'; }));
      answer = lcTarget.label + '，' + lcTarget.value + '℃';
      prompt = name + '：根据折线图回答：' + ((i % 2 === 0) ? '哪一天的温度最高？' : '哪一天的温度最低？') + '（  ）';
      data.choiceForm = true;
    }
  } else if (type === 'bar-chart' || type === 'chart-read') {
    series = buildSeries(PEOPLE_LABELS, 20, 60);
    series.sort(function (x, y) { return PEOPLE_LABELS.indexOf(x.label) - PEOPLE_LABELS.indexOf(y.label); });
    var hiBar = series.slice().sort(function (x, y) { return y.value - x.value; })[0];
    var loBar = series.slice().sort(function (x, y) { return x.value - y.value; })[0];
    var BAR_Q = [
      { q: '哪个年级的人数最多？多多少？', a: hiBar.label + '，' + hiBar.value + '人' },
      { q: '哪个年级的人数最少？少多少？', a: loBar.label + '，' + loBar.value + '人' },
      { q: '人数最多的年级比最少的年级多多少人？', a: (hiBar.value - loBar.value) + '人' }
    ];
    var bq = BAR_Q[i % BAR_Q.length];
    prompt = name + '：根据条形图回答：' + bq.q;
    answer = bq.a; steps = 1;
    graphic = { type: 'chart', subtype: 'bar', params: { title: '各年级人数统计', yLabel: '人数', data: series } };

    
    
    if (plan.questionTypeId === 'choice') {
      var chOpts, chAns;
      if (i % 3 === 2) {
        var diffV = hiBar.value - loBar.value;
        chAns = diffV + '人';
        chOpts = [chAns, (diffV + 1) + '人', (diffV - 1) + '人', (diffV + 2) + '人'];
      } else {
        var targetC = (i % 3 === 0) ? hiBar : loBar;
        chAns = targetC.label + '，' + targetC.value + '人';
        chOpts = series.map(function (s) { return s.label + '，' + s.value + '人'; });
      }
      chOpts = Rng.shuffle(rng, chOpts);
      prompt = name + '：根据条形图回答：' + bq.q + '（  ）';
      answer = chAns;
      data.choiceForm = true;
    } else if (plan.questionTypeId === 'judge') {
      var targetJ = (i % 3 === 0) ? hiBar : loBar;
      var isTrueJ = rng() < 0.5;
      var deltaJ = (targetJ.value > 21 && rng() < 0.5) ? -1 : 1;
      var shownJ = isTrueJ ? targetJ.value : targetJ.value + deltaJ;
      prompt = name + '：根据条形图判断：「' + targetJ.label + '有 ' + shownJ + ' 人」——对还是错？';
      answer = isTrueJ;
      data.judgeForm = true;
    } else if (plan.questionTypeId === 'calc') {
      
      prompt = name + '：根据条形图列式计算，人数最多的年级比最少的年级多多少人？'
        + '列式：' + hiBar.value + ' − ' + loBar.value + ' = ？';
      answer = hiBar.value - loBar.value;
      data.calcForm = true;
    }
  } else if (type === 'pie-chart') {
    var PIE = [
      { p: [30, 25, 25, 20], ask: '喜欢语文的有多少人？', idx: 0 },
      { p: [30, 25, 25, 20], ask: '喜欢数学和英语的一共有多少人？', idx: -1, extra: 45 },
      { p: [40, 20, 25, 15], ask: '喜欢语文的有多少人？', idx: 0 },
      { p: [20, 30, 30, 20], ask: '喜欢英语的有多少人？', idx: 2 }
    ];
    
    var pie = (qt === 'choice') ? ((i % 2 === 0) ? PIE[0] : PIE[2]) : PIE[i % PIE.length];
    var pieData = SUBJECT_LABELS.map(function (l, pi) { return { label: l, percent: pie.p[pi] }; });
    var pieAns = pie.idx < 0 ? pie.extra + '人' : pieData[pie.idx].percent + '人';
    prompt = name + '：根据扇形图，如果总人数是100人，' + pie.ask;
    answer = pieAns; steps = 2;
    graphic = { type: 'chart', subtype: 'pie', params: { title: '最喜欢的科目', data: pieData } };
    if (qt === 'choice') {
      var pieMax = pieData.slice().sort(function (x, y) { return y.percent - x.percent; })[0];
      chOpts = Rng.shuffle(rng, SUBJECT_LABELS.slice());
      answer = pieMax.label;
      prompt = name + '：根据扇形图，最喜欢哪一科的人数所占百分比最大？';
      data.choiceForm = true;
    }
  } else if (type === 'double-chart') {
    var dLabels = ['跳绳', '跑步', '踢毽', '篮球'];
    
    var aVals = Rng.shuffle(rng, [16, 22, 28, 35]);
    var bVals = Rng.shuffle(rng, [18, 24, 31, 37]);
    series = dLabels.map(function (l, di) {
      return { label: l, a: aVals[di], b: bVals[di] };
    });
    var gapMax = series.slice().sort(function (x, y) {
      return Math.abs(y.a - y.b) - Math.abs(x.a - x.b);
    })[0];
    var gapMin = series.slice().sort(function (x, y) {
      return Math.abs(x.a - x.b) - Math.abs(y.a - y.b);
    })[0];
    var DC_Q = [
      { q: '男生和女生在哪一项上的差距最大？', a: gapMax.label + '（差 ' + Math.abs(gapMax.a - gapMax.b) + ' 人）' },
      { q: '男生和女生在哪一项上的差距最小？', a: gapMin.label + '（差 ' + Math.abs(gapMin.a - gapMin.b) + ' 人）' },
      { q: '男生在哪一项上参加的人数最多？', a: series.slice().sort(function (x, y) { return y.a - x.a; })[0].label + '（' + series.slice().sort(function (x, y) { return y.a - x.a; })[0].a + ' 人）' }
    ];
    var dcq = DC_Q[i % DC_Q.length];
    prompt = name + '：复式统计图中，' + dcq.q;
    answer = dcq.a; steps = 2;
    graphic = {
      type: 'chart',
      subtype: name.indexOf('折线') !== -1 ? 'line' : 'bar',
      params: { title: '男生女生运动情况', yLabel: '人数', data: series }
    };
    if (qt === 'choice') {
      
      var dcIsBoy = (i % 2 === 0);
      var dcPick = series.slice().sort(function (x, y) {
        return dcIsBoy ? (y.a - x.a) : (y.b - x.b);
      })[0];
      chOpts = Rng.shuffle(rng, dLabels.slice());
      answer = dcPick.label;
      prompt = name + '：复式统计图中，' + (dcIsBoy ? '男生' : '女生') + '参加人数最多的是哪一项？';
      data.choiceForm = true;
    }
  } else if (type === 'data-collect') {
    
    
    
    
    var TALLY_VARIANTS = [
      { labels: FRUIT_LABELS, title: '最喜欢的果汁', unit: '人', ask: '用正字法收集全班同学喜欢的水果，数据如下，请整理成统计表。' },
      { labels: ['跳绳', '跑步', '踢毽', '篮球', '乒乓球'], title: '喜欢的运动', unit: '人', ask: '调查同学们喜欢的运动项目，用画“√”的方法记录，请整理成数据表。' },
      { labels: ['故事书', '科普书', '漫画', '作文书'], title: '图书角类别', unit: '本', ask: '图书角有各类图书，分类清点数量后请填入统计表。' },
      { labels: ['晴', '阴', '雨', '雪'], title: '一周天气', unit: '天', ask: '记录一周的天气情况，用统计表整理各类天气的天数。' }
    ];
    var tv = TALLY_VARIANTS[i % TALLY_VARIANTS.length];
    
    var tallyBase = Rng.shuffle(rng, tv.labels.map(function (_, ti) {
      return 12 + ti * 7 + Rng.randInt(rng, 0, 4);
    }));
    series = tv.labels.map(function (l, ti) { return { label: l, value: tallyBase[ti] }; });
    var dcMax = series.slice().sort(function (x, y) { return y.value - x.value; })[0];
    var dcMin = series.slice().sort(function (x, y) { return x.value - y.value; })[0];
    var dcTotal = series.reduce(function (acc, s) { return acc + s.value; }, 0);
    graphic = { type: 'chart', subtype: 'bar', params: { title: tv.title, yLabel: tv.unit, data: series } };
    if (qt === 'choice') {
      var dcAskMax = (i % 2 === 0);
      chOpts = Rng.shuffle(rng, tv.labels.slice());
      answer = dcAskMax ? dcMax.label : dcMin.label;
      prompt = name + '：调查记录整理成统计表后，数量' + (dcAskMax ? '最多' : '最少') + '的是哪一类？';
      data.choiceForm = true;
      steps = 2;
    } else if (qt === 'fill') {
      answer = dcTotal;
      prompt = name + '：' + tv.ask + '表中各类数量一共有多少' + tv.unit + '？（合计：____）';
      steps = 2;
    } else {
      answer = dcMax.label + '（' + dcMax.value + tv.unit + '）';
      prompt = name + '：' + tv.ask + '并回答：数量最多的是哪一类，有多少' + tv.unit + '？';
      steps = 2;
    }
  } else if (type === 'clock') {
    
    steps = 1;
    if (qt === 'calc') {
      var CLK_CALC = [
        { q: '钟面上有12个大格，每个大格有5个小格，钟面上一共有多少个小格？列式：12 × 5 = ？', a: 60 },
        { q: '分针从12走到6，走了6个大格，一共走了多少分钟？列式：6 × 5 = ？', a: 30 },
        { q: '时针从2走到5，走了几个大格、是多少小时？列式：(5 − 2) × 1 = ？', a: 3 }
      ];
      var clkC = CLK_CALC[i % CLK_CALC.length];
      prompt = name + '：' + clkC.q; answer = clkC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var CLK_OPTS = [
        { q: '钟面上一共有多少个大格？', a: '12个', o: ['10个', '11个', '12个', '24个'] },
        { q: '分针走1个大格是多少分钟？', a: '5分钟', o: ['1分钟', '5分钟', '15分钟', '60分钟'] },
        { q: '时针从3走到7，经过了几小时？', a: '4小时', o: ['3小时', '4小时', '5小时', '7小时'] },
        { q: '时针指向8、分针指向12，这时是几时？', a: '8时', o: ['7时', '8时', '9时', '12时'] }
      ];
      var clkO = CLK_OPTS[i % CLK_OPTS.length];
      prompt = name + '：' + clkO.q; answer = clkO.a;
      chOpts = Rng.shuffle(rng, clkO.o); data.choiceForm = true;
    } else {
      var CLK_FILL = [
        { q: '看钟面：时针指向9、分针指向12，现在是几时？', a: '9时' },
        { q: '看钟面：时针走过3、分针指向6，现在是几时几分？', a: '3时30分' },
        { q: '分针从12走到4，走了几个大格？是多少分钟？', a: '4个大格，20分钟' },
        { q: '钟面上一共有多少个大格？每个大格分成几个小格？', a: '12个大格，每个大格5个小格' }
      ];
      var clkF = CLK_FILL[i % CLK_FILL.length];
      prompt = name + '：' + clkF.q; answer = clkF.a;
    }
  } else if (type === 'time-convert') {
    
    steps = 1;
    if (qt === 'calc') {
      var TC_CALC = [
        { q: '3时等于多少分？列式：3 × 60 = ？', a: 180 },
        { q: '2分等于多少秒？列式：2 × 60 = ？', a: 120 },
        { q: '1时20分等于多少分？列式：60 + 20 = ？', a: 80 },
        { q: '180秒等于多少分？列式：180 ÷ 60 = ？', a: 3 }
      ];
      var tcC = TC_CALC[i % TC_CALC.length];
      prompt = name + '：' + tcC.q; answer = tcC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var TC_OPTS = [
        { q: '3时 = （ ）分', a: '180分', o: ['30分', '60分', '180分', '300分'] },
        { q: '2分 = （ ）秒', a: '120秒', o: ['12秒', '60秒', '120秒', '200秒'] },
        { q: '180秒 = （ ）分', a: '3分', o: ['2分', '3分', '4分', '18分'] },
        { q: '1时15分 = （ ）分', a: '75分', o: ['60分', '75分', '115分', '150分'] }
      ];
      var tcO = TC_OPTS[i % TC_OPTS.length];
      prompt = name + '：' + tcO.q; answer = tcO.a;
      chOpts = Rng.shuffle(rng, tcO.o); data.choiceForm = true;
    } else {
      var TC_FILL = [
        { q: '4时 = （ ）分', a: '240分' },
        { q: '5分 = （ ）秒', a: '300秒' },
        { q: '120秒 = （ ）分', a: '2分' },
        { q: '1分40秒 = （ ）秒', a: '100秒' }
      ];
      var tcF = TC_FILL[i % TC_FILL.length];
      prompt = name + '：' + tcF.q; answer = tcF.a;
    }
  } else if (type === 'elapsed-time') {
    
    steps = 2;
    if (qt === 'calc') {
      var ET_CALC = [
        { q: '小明7:30从家出发，7:45到达学校，经过了多少分钟？列式：45 − 30 = ？', a: 15 },
        { q: '一列火车8:40从甲站开出，9:10到达乙站，经过了多少分钟？列式：(60 − 40) + 10 = ？', a: 30 },
        { q: '一场电影下午2:00开始，下午4:00结束，放映了多少小时？列式：4 − 2 = ？', a: 2 }
      ];
      var etC = ET_CALC[i % ET_CALC.length];
      prompt = name + '：' + etC.q; answer = etC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var ET_OPTS = [
        { q: '小明7:30从家出发，7:45到达学校，他路上用了多长时间？', a: '15分钟', o: ['10分钟', '15分钟', '20分钟', '25分钟'] },
        { q: '一节课8:50开始，9:30结束，这节课有多少分钟？', a: '40分钟', o: ['30分钟', '40分钟', '50分钟', '60分钟'] },
        { q: '一场电影下午2:00开始，下午4:00结束，放映了几小时？', a: '2小时', o: ['1小时', '2小时', '3小时', '4小时'] },
        { q: '小红晚上8:00睡觉，第二天早上6:00起床，她睡了几小时？', a: '10小时', o: ['8小时', '9小时', '10小时', '12小时'] }
      ];
      var etO = ET_OPTS[i % ET_OPTS.length];
      prompt = name + '：' + etO.q; answer = etO.a;
      chOpts = Rng.shuffle(rng, etO.o); data.choiceForm = true;
    } else {
      var ET_FILL = [
        { q: '小明7:30从家出发，7:45到达学校，路上经过了多少分钟？', a: '15分钟' },
        { q: '一节课8:50开始，9:30结束，这节课上了多少分钟？', a: '40分钟' },
        { q: '妈妈上午8:00上班，在公司工作8小时，妈妈下午几时下班？', a: '下午4:00（16:00）' },
        { q: '一列火车9:10进站，9:55开出，在车站停靠了多少分钟？', a: '45分钟' }
      ];
      var etF = ET_FILL[i % ET_FILL.length];
      prompt = name + '：' + etF.q; answer = etF.a;
    }
  } else if (type === 'calendar') {
    
    steps = 2;
    if (qt === 'calc') {
      var CAL_CALC = [
        { q: '7月和8月都是大月，两个月一共有多少天？列式：31 + 31 = ？', a: 62 },
        { q: '平年的2月有28天，4月有30天，4月比2月多多少天？列式：30 − 28 = ？', a: 2 },
        { q: '一年有4个小月，每个小月都是30天，4个小月一共有多少天？列式：4 × 30 = ？', a: 120 }
      ];
      var calC = CAL_CALC[i % CAL_CALC.length];
      prompt = name + '：' + calC.q; answer = calC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var CAL_OPTS = [
        { q: '下面的月份中，哪个月是有31天的大月？', a: '7月', o: ['4月', '6月', '7月', '11月'] },
        { q: '一年一共有多少个月？', a: '12个月', o: ['10个月', '11个月', '12个月', '24个月'] },
        { q: '11月一共有多少天？', a: '30天', o: ['28天', '29天', '30天', '31天'] },
        { q: '平年全年一共有多少天？', a: '365天', o: ['364天', '365天', '366天', '400天'] }
      ];
      var calO = CAL_OPTS[i % CAL_OPTS.length];
      prompt = name + '：' + calO.q; answer = calO.a;
      chOpts = Rng.shuffle(rng, calO.o); data.choiceForm = true;
    } else {
      var CAL_FILL = [
        { q: '一年有多少个月？哪几个月是有31天的大月？', a: '12个月；1月、3月、5月、7月、8月、10月、12月是大月' },
        { q: '4月有多少天？它是大月还是小月？', a: '30天，是小月' },
        { q: '6月1日的前一天是几月几日？', a: '5月31日' },
        { q: '7月和8月是连续的两个大月，两个月一共有多少天？', a: '62天' }
      ];
      var calF = CAL_FILL[i % CAL_FILL.length];
      prompt = name + '：' + calF.q; answer = calF.a;
    }
  } else if (type === 'leap-year') {
    
    steps = 2;
    if (qt === 'calc') {
      var LY_CALC = [
        { q: '闰年全年有多少天？（7个大月、4个小月，2月29天）列式：7 × 31 + 4 × 30 + 29 = ？', a: 366 },
        { q: '平年全年有多少天？（7个大月、4个小月，2月28天）列式：7 × 31 + 4 × 30 + 28 = ？', a: 365 },
        { q: '闰年的2月比平年的2月多多少天？列式：29 − 28 = ？', a: 1 }
      ];
      var lyC = LY_CALC[i % LY_CALC.length];
      prompt = name + '：' + lyC.q; answer = lyC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var LY_OPTS = [
        { q: '下面哪一年是闰年？', a: '2024年', o: ['2021年', '2022年', '2023年', '2024年'] },
        { q: '下面哪一年是平年？', a: '2023年', o: ['2016年', '2020年', '2023年', '2024年'] },
        { q: '下面哪个整百年份是闰年？', a: '2000年', o: ['1900年', '2000年', '2100年', '2200年'] },
        { q: '闰年的2月有多少天？', a: '29天', o: ['28天', '29天', '30天', '31天'] }
      ];
      var lyO = LY_OPTS[i % LY_OPTS.length];
      prompt = name + '：' + lyO.q; answer = lyO.a;
      chOpts = Rng.shuffle(rng, lyO.o); data.choiceForm = true;
    } else {
      var LY_FILL = [
        { q: '2024年是平年还是闰年？写出判断理由。', a: '闰年；2024 ÷ 4 = 506，没有余数，公历年份是4的倍数的一般是闰年' },
        { q: '1900年是平年还是闰年？为什么？', a: '平年；整百年份必须是400的倍数才是闰年，1900不是400的倍数' },
        { q: '闰年全年有多少天？比平年多几天？', a: '366天，比平年多1天' },
        { q: '小明是2016年2月29日出生的，他下一次能在2月29日过生日是哪一年？', a: '2020年' }
      ];
      var lyF = LY_FILL[i % LY_FILL.length];
      prompt = name + '：' + lyF.q; answer = lyF.a;
    }
  } else {
    series = buildSeries(PEOPLE_LABELS, 20, 60);
    series.sort(function (x, y) { return PEOPLE_LABELS.indexOf(x.label) - PEOPLE_LABELS.indexOf(y.label); });
    var hiRead = series.slice().sort(function (x, y) { return y.value - x.value; })[0];
    var loRead = series.slice().sort(function (x, y) { return x.value - y.value; })[0];
    var READ_Q = [
      { q: '人数最多的年级是哪一年级？有多少人？', a: hiRead.label + '，' + hiRead.value + '人' },
      { q: '人数最少的年级是哪一年级？有多少人？', a: loRead.label + '，' + loRead.value + '人' },
      { q: '人数最多的年级比最少的年级多多少人？', a: (hiRead.value - loRead.value) + '人' }
    ];
    var rq = READ_Q[i % READ_Q.length];
    prompt = name + '：根据统计表中的数据，' + rq.q;
    answer = rq.a; steps = 1;
    graphic = { type: 'chart', subtype: 'bar', params: { title: '各年级人数统计', yLabel: '人数', data: series } };
  }

  if (graphic) data.graphic = graphic;
  data.steps = steps;
  if (data.choiceForm) {
    data.options = chOpts;
    data.correctIndex = chOpts.indexOf(String(answer));
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: typeof answer === 'boolean' ? { value: answer, acceptable: [] } : { value: String(answer), acceptable: [] },
    answerMode: data.choiceForm ? 'choice' : (data.judgeForm ? 'judge' : 'input'),
    data: data
  };
}



function createStatsGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:stats';

  return {
    id: id,
    subject: 'math',
    
    
    capabilities: ['apply', 'calc', 'fill', 'choice'],
    questionTypes: ['apply', 'calc', 'fill', 'choice'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};

      for (var i = 0; i < count; i++) {
        questions.push(makeStatsQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [createStatsGenerator()];
}

module.exports = {
  createStatsGenerator: createStatsGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/picture-equation.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");

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

  var prompt, answer, steps, graphic;
  if (type === 'segment') {
    var total = Rng.randInt(rng, 20, 100);
    var part = Rng.randInt(rng, 5, total - 5);
    prompt = '根据线段图：总长' + total + '，其中一部分是' + part + '，求另一部分是多少？';
    answer = total - part; steps = 1;
    graphic = { type: 'diagram', subtype: 'segment', params: { total: total, part: part, unit: '' } };
  } else if (type === 'brace') {
    var a = Rng.randInt(rng, 5, 30);
    var b = Rng.randInt(rng, 5, 30);
    prompt = '根据大括号图：左边有' + a + '个苹果，右边有' + b + '个苹果，一共有多少个？';
    answer = a + b; steps = 1;
    graphic = { type: 'diagram', subtype: 'brace', params: { left: a, right: b, unit: '个' } };
    
    if (plan.questionTypeId === 'calc') {
      prompt = '看图列式：大括号图左边有 ' + a + ' 个苹果，右边有 ' + b + ' 个苹果。'
        + '列式计算一共有多少个：' + a + ' + ' + b + ' = ？';
    }
  } else if (type === 'balance') {
    var left = Rng.randInt(rng, 5, 20);
    var right = left;
    var unknown = Rng.randInt(rng, 2, 8);
    prompt = '天平平衡：左边有' + left + '，右边有' + unknown + ' + ?。求?的值。';
    answer = left - unknown; steps = 2;
    graphic = { type: 'diagram', subtype: 'balance', params: { left: left, rightUnknown: unknown, unit: '' } };
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
    graphic = { type: 'diagram', subtype: 'segment', params: { total: roadLen, part: gap, unit: '米', otherLabel: '…' } };
  } else if (type === 'scale') {
    var scale = Rng.randInt(rng, 1000, 50000);
    var mapDist = Rng.randInt(rng, 2, 10);
    prompt = name + '：比例尺1:' + scale + '，地图上量得距离' + mapDist + 'cm，求实际距离（单位：km）。';
    answer = (mapDist * scale / 100000).toFixed(2); steps = 2;
    graphic = { type: 'diagram', subtype: 'scale', params: { scale: scale, mapDist: mapDist } };
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
    graphic = { type: 'diagram', subtype: 'brace', params: { left: x, right: y, unit: '' } };
  }

  var data = { mode: plan.questionTypeId, steps: steps, questionType: plan.questionTypeId };
  if (graphic) data.graphic = graphic;

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
    data: data
  };
}




function createPictureEquationGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:picture-equation';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};

      for (var i = 0; i < count; i++) {
        questions.push(makePictureEquationQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [createPictureEquationGenerator()];
}

module.exports = {
  createPictureEquationGenerator: createPictureEquationGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/c1-number-puzzle.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");

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
  var name = (kp && (kp.name || (kp.identity && kp.identity.name))) || '数字谜';
  var id = (kp && (kp.id || (kp.identity && kp.identity.id)) || kp.id) || '';

  var isVertical = name.indexOf('竖式') !== -1 || id.indexOf('vertical') !== -1 || id.indexOf('digit-puzzle') !== -1;
  var isHorizontal = name.indexOf('横式') !== -1 || id.indexOf('horizontal') !== -1;
  var isSymbol = name.indexOf('符号') !== -1 || name.indexOf('字母') !== -1 || id.indexOf('symbol') !== -1;
  var isDigitReasoning = name.indexOf('数字推理') !== -1 || id.indexOf('digit-reasoning') !== -1 || id.indexOf('number-puzzle-competition') !== -1;

  var v = i; 
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
    
    var DR = [
      { d: '百位数字比十位数字大 3，个位数字是十位数字的 2 倍，各位数字之和是 15', ans: '636' },
      { d: '百位数字比十位数字大 2，个位数字是十位数字的 3 倍，各位数字之和是 17', ans: '539' },
      { d: '百位数字是十位数字的 2 倍，个位比十位大 1，各位数字之和是 9', ans: '423' }
    ];
    var dr = DR[v % DR.length];
    prompt = '一个三位数，' + dr.d + '。这个三位数是多少？';
    answer = dr.ans;
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




function createC1Generator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c1-number-puzzle';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};

      for (var i = 0; i < count; i++) {
        questions.push(makePuzzleQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [createC1Generator()];
}

module.exports = {
  createC1Generator: createC1Generator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/c2-number-theory.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var OS = require("shared/generator/core/op-semantics.js");
var MUL = OS.symbol('multiply') || '×';

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
  var name = (kp && (kp.name || (kp.identity && kp.identity.name))) || '数论问题';
  var id = (kp && (kp.id || (kp.identity && kp.identity.id))) || '';

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

  var v = i; 
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
    answer = factors.join(' ' + MUL + ' ');
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
    
    var EXT = [{ hi: 100, d1: 3, d2: 5, ans: 99 }, { hi: 100, d1: 7, d2: 3, ans: 98 }, { hi: 50, d1: 5, d2: 2, ans: 45 }];
    var ext = EXT[v % EXT.length];
    prompt = '在 1~' + ext.hi + ' 的自然数中，能被 ' + ext.d1 + ' 整除但不能被 ' + ext.d2 + ' 整除的数最大是多少？';
    answer = String(ext.ans);
  } else if (isDiophantine) {
    
    var DIO = [{ s: '3x + 2y = 17', ans: '3 组（x=1,y=7；x=3,y=4；x=5,y=1）' }, { s: '5x + 2y = 24', ans: '2 组（x=2,y=7；x=4,y=2）' }, { s: '2x + 3y = 18', ans: '2 组（x=3,y=4；x=6,y=2）' }];
    var dio = DIO[v % DIO.length];
    prompt = '方程 ' + dio.s + ' 有多少组正整数解？';
    answer = dio.ans;
  } else if (isModulo) {
    
    var MOD = [{ base: 3, exp: 2024, ans: '1' }, { base: 7, exp: 2023, ans: '3' }, { base: 2, exp: 2025, ans: '2' }];
    var mod = MOD[v % MOD.length];
    prompt = '计算 ' + mod.base + '^' + mod.exp + ' 的个位数字。';
    answer = mod.ans;
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



function createC2Generator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c2-number-theory';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};

      for (var i = 0; i < count; i++) {
        questions.push(makeTheoryQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [createC2Generator()];
}

module.exports = {
  createC2Generator: createC2Generator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/c5-c6-journey-engineering.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");

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

  var v = i; 
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
    
    var AV = [{ a: 30, b: 60 }, { a: 40, b: 60 }, { a: 20, b: 30 }, { a: 50, b: 75 }];
    var av = AV[v % AV.length];
    var avg = 2 * av.a * av.b / (av.a + av.b);
    prompt = '小明骑车从家到书店，去时每小时行 ' + av.a + ' 千米，沿原路返回时每小时行 ' + av.b + ' 千米。求小明往返的平均速度。';
    answer = avg;
    steps = 3;
  } else if (isRatio) {
    
    var RAT = [{ r: '3:2', ta: 4, tb: 6 }, { r: '4:3', ta: 6, tb: 8 }, { r: '2:1', ta: 3, tb: 6 }];
    var rat = RAT[v % RAT.length];
    prompt = '走同一段路，甲、乙两人的速度比是 ' + rat.r + '。甲走完全程用了 ' + rat.ta + ' 小时，乙走完全程需要多少小时？';
    answer = rat.tb;
    steps = 3;
  } else if (isInterval) {
    
    var INT = [{ interval: 6, car: 500, walk: 100, ans: 7.5 }, { interval: 10, car: 600, walk: 200, ans: 15 }, { interval: 8, car: 500, walk: 100, ans: 10 }];
    var itv = INT[v % INT.length];
    prompt = '一条公交线路上，公交车每隔 ' + itv.interval + ' 分钟发一班，车速为每分钟 ' + itv.car + ' 米。'
      + '小明沿公交线路以每分钟 ' + itv.walk + ' 米的速度与公交车同向步行。每隔多少分钟会有一辆公交车从身后追上小明？';
    answer = itv.ans;
    steps = 3;
  } else if (isPickup) {
    
    var PK = [{ go: 60, back: 90, total: 5, ans: 180 }, { go: 40, back: 60, total: 5, ans: 120 }, { go: 50, back: 75, total: 5, ans: 150 }];
    var pk = PK[v % PK.length];
    prompt = '汽车送一批人去机场，去程每小时行 ' + pk.go + ' 千米，返程（空车）每小时行 ' + pk.back + ' 千米，往返共用 ' + pk.total + ' 小时（不含上下车时间）。出发点到机场的距离是多少千米？';
    answer = pk.ans;
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



function createJourneyEngineeringGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c5-c6-journey-engineering';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};

      for (var i = 0; i < count; i++) {
        questions.push(makeQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [createJourneyEngineeringGenerator()];
}

module.exports = {
  createJourneyEngineeringGenerator: createJourneyEngineeringGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/c7-clever-calc.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");
var OS = require("shared/generator/core/op-semantics.js");
var MUL = OS.symbol('multiply') || '×';
var DIV = OS.symbol('divide') || '÷';

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

  var v = i; 
  var prompt, answer, steps;

  if (isExtract) {
    
    var c = [25, 28, 36, 48][Rng.randInt(rng, 0, 3)];
    var a = Rng.randInt(rng, 20, 80);
    var b = 100 - a;
    prompt = '用简便方法计算：' + a + MUL + c + ' + ' + b + MUL + c;
    answer = (a + b) * c;
    steps = 2;
  } else if (isRounding) {
    
    var RND = [{ t: [9, 99, 999, 9999], sum: 11106 }, { t: [8, 98, 998, 9998], sum: 11102 }, { t: [19, 199, 1999], sum: 2217 }, { t: [4, 44, 444], sum: 492 }];
    var rnd = RND[v % RND.length];
    prompt = '用凑整法巧算：' + rnd.t.join(' + ');
    answer = rnd.sum;
    steps = 2;
  } else if (isFracSplit) {
    
    var n = Rng.randInt(rng, 3, 5);
    var terms = [];
    for (var k = 1; k <= n; k++) terms.push('1/(' + k + MUL + (k + 1) + ')');
    prompt = '用裂项法计算：' + terms.join(' + ');
    answer = frac(n, n + 1);
    steps = 3;
  } else if (isIntSplit) {
    
    var m = Rng.randInt(rng, 3, 5);
    var iterms = [];
    for (var k2 = 1; k2 <= m; k2++) iterms.push(k2 + MUL + (k2 + 1));
    prompt = '用裂项法计算：' + iterms.join(' + ');
    answer = m * (m + 1) * (m + 2) / 3;
    steps = 3;
  } else if (isSeries) {
    
    var last = Rng.randInt(rng, 20, 100);
    prompt = '计算等差数列之和：1 + 2 + 3 + … + ' + last;
    answer = last * (last + 1) / 2;
    steps = 2;
  } else if (isRecurring) {
    
    var REC = [{ s: '0.333…（3 循环）', n: 1, d: 3 }, { s: '0.666…（6 循环）', n: 2, d: 3 }, { s: '0.1666…（6 循环）', n: 1, d: 6 }, { s: '0.8333…（3 循环）', n: 5, d: 6 }];
    var rec = REC[v % REC.length];
    prompt = '把循环小数化成分数：' + rec.s;
    answer = frac(rec.n, rec.d);
    steps = 2;
  } else if (isDefineOp) {
    
    var x = Rng.randInt(rng, 2, 9);
    var y = Rng.randInt(rng, 2, 9);
    prompt = '定义新运算：a※b = 2a + b。求 ' + x + '※' + y + ' 的值。';
    answer = 2 * x + y;
    steps = 2;
  } else if (isEstimate) {
    
    var EST = [{ t: ['1/2', '1/3', '1/4'], val: 1.0833, ans: 1 }, { t: ['1/3', '1/4', '1/5'], val: 0.7833, ans: 0 }, { t: ['1/2', '1/4', '1/8'], val: 0.875, ans: 0 }, { t: ['1/2', '1/3', '1/6'], val: 1, ans: 1 }];
    var est = EST[v % EST.length];
    prompt = '估算（写出整数部分）：' + est.t.join(' + ') + ' 的结果的整数部分是多少？';
    answer = est.ans;
    steps = 2;
  } else if (isComplexFrac) {
    
    var CF = [{ n1: 1, d1: 2, n2: 3, d2: 4 }, { n1: 2, d1: 3, n2: 4, d2: 5 }, { n1: 3, d1: 4, n2: 1, d2: 2 }, { n1: 1, d1: 3, n2: 2, d2: 5 }];
    var cf = CF[v % CF.length];
    prompt = '化简繁分数：( ' + cf.n1 + '/' + cf.d1 + ' ) ' + DIV + ' ( ' + cf.n2 + '/' + cf.d2 + ' )';
    answer = frac(cf.n1 * cf.d2, cf.d1 * cf.n2);
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
    prompt = name + '：用简便方法计算 ' + ga + ' ' + MUL + ' 25 ' + MUL + ' 4';
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



function createC7Generator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c7-clever-calc';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};

      for (var i = 0; i < count; i++) {
        questions.push(makeQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [createC7Generator()];
}

module.exports = {
  createC7Generator: createC7Generator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/c9-comprehensive.js"] = function (module, exports, require) {
'use strict';



var Rng = require("shared/generator/core/rng.js");

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

  var v = i; 
  var prompt, answer, steps;

  if (isSumDiff) {
    
    var SD = [{ s: 48, r: 3 }, { s: 60, r: 2 }, { s: 72, r: 5 }, { s: 96, r: 3 }];
    var sd = SD[v % SD.length];
    prompt = '甲、乙两数的和是 ' + sd.s + '，甲数是乙数的 ' + sd.r + ' 倍。乙数是多少？';
    answer = sd.s / (sd.r + 1);
    steps = 2;
  } else if (isAge) {
    
    var AGE = [{ f: 40, c: 12, k: 2 }, { f: 45, c: 15, k: 2 }, { f: 38, c: 10, k: 3 }, { f: 50, c: 20, k: 2 }];
    var age = AGE[v % AGE.length];
    var ageYears = (age.f - age.c) / (age.k - 1) - age.c;
    prompt = '爸爸今年 ' + age.f + ' 岁，儿子今年 ' + age.c + ' 岁。多少年后爸爸的年龄正好是儿子的 ' + age.k + ' 倍？';
    answer = ageYears;
    steps = 3;
  } else if (isProfitLoss) {
    
    var PL = [{ p1: 3, e1: 7, p2: 4, s2: 5 }, { p1: 5, e1: 8, p2: 7, s2: 6 }, { p1: 4, e1: 10, p2: 6, s2: 2 }, { p1: 6, e1: 4, p2: 8, s2: 6 }];
    var pl = PL[v % PL.length];
    var plN = (pl.e1 + pl.s2) / (pl.p2 - pl.p1);
    prompt = '幼儿园分苹果：如果每人分 ' + pl.p1 + ' 个，则多出 ' + pl.e1 + ' 个；如果每人分 ' + pl.p2 + ' 个，则还差 ' + pl.s2 + ' 个。幼儿园一共有多少个小朋友？';
    answer = plN;
    steps = 3;
  } else if (isChicken) {
    
    var CR = [{ h: 20, f: 56 }, { h: 30, f: 84 }, { h: 25, f: 70 }, { h: 18, f: 52 }];
    var cr = CR[v % CR.length];
    prompt = '鸡兔同笼，共有 ' + cr.h + ' 个头、' + cr.f + ' 只脚。笼中兔子有多少只？';
    answer = (cr.f - 2 * cr.h) / 2;
    steps = 3;
  } else if (isAverage) {
    
    var AV = [{ a: 18, x: 15, y: 20 }, { a: 90, x: 85, y: 92 }, { a: 88, x: 90, y: 86 }, { a: 80, x: 76, y: 82 }];
    var av = AV[v % AV.length];
    prompt = '小明三次数学测验的平均分是 ' + av.a + ' 分，前两次分别得 ' + av.x + ' 分和 ' + av.y + ' 分。第三次测验得了多少分？';
    answer = 3 * av.a - av.x - av.y;
    steps = 2;
  } else if (isPlanting) {
    
    var PLT = [{ l: 100, g: 5 }, { l: 120, g: 6 }, { l: 150, g: 5 }, { l: 200, g: 8 }];
    var plt = PLT[v % PLT.length];
    prompt = '在一条长 ' + plt.l + ' 米的小路一旁植树，每隔 ' + plt.g + ' 米栽一棵，两端都要栽。一共要栽多少棵树？';
    answer = plt.l / plt.g + 1;
    steps = 2;
  } else if (isPhalanx) {
    
    var PHX = [8, 10, 6, 12];
    var phx = PHX[v % PHX.length];
    prompt = '同学们排成一个实心方阵，最外层每边有 ' + phx + ' 人。最外层一共有多少人？';
    answer = 4 * (phx - 1);
    steps = 2;
  } else if (isPeriodic) {
    
    var PER = [{ cols: ['红', '黄', '蓝'], pos: 30 }, { cols: ['红', '黄', '蓝', '绿'], pos: 25 }, { cols: ['红', '黄', '蓝'], pos: 22 }, { cols: ['黑', '白'], pos: 17 }];
    var per = PER[v % PER.length];
    prompt = '节日彩灯按「' + per.cols.join('、') + '」的顺序循环排列。第 ' + per.pos + ' 盏灯是什么颜色？';
    answer = per.cols[(per.pos - 1) % per.cols.length];
    steps = 2;
  } else if (isGrass) {
    
    var GRASS = [{ a: 10, b: 20, c: 15, d: 10, e: 25, t: 5 }, { a: 10, b: 30, c: 15, d: 15, e: 20, t: 10 }, { a: 8, b: 20, c: 12, d: 10, e: 14, t: 8 }];
    var gr = GRASS[v % GRASS.length];
    prompt = '一片牧场的草均匀生长。可供 ' + gr.a + ' 头牛吃 ' + gr.b + ' 天，或供 ' + gr.c + ' 头牛吃 ' + gr.d + ' 天。照此计算，可供 ' + gr.e + ' 头牛吃多少天？';
    answer = gr.t;
    steps = 4;
  } else if (isFracPct) {
    
    var FR = [{ f1: '1/4', f2: '1/3', rem: 50, ans: 120 }, { f1: '1/3', f2: '1/4', rem: 60, ans: 144 }, { f1: '1/2', f2: '1/5', rem: 30, ans: 100 }];
    var fr = FR[v % FR.length];
    prompt = '小明读一本书，第一天读了全书的 ' + fr.f1 + '，第二天读了全书的 ' + fr.f2 + '，还剩 ' + fr.rem + ' 页没读。这本书一共有多少页？';
    answer = fr.ans;
    steps = 3;
  } else if (isEconomics) {
    
    var ECO = [{ cost: 80, price: 120, disc: 0.8, ans: 16 }, { cost: 100, price: 150, disc: 0.9, ans: 35 }, { cost: 60, price: 100, disc: 0.85, ans: 25 }];
    var eco = ECO[v % ECO.length];
    var ecoSale = Math.round(eco.price * eco.disc);
    prompt = '一件商品进价 ' + eco.cost + ' 元，标价 ' + eco.price + ' 元。商店按标价打 ' + Math.round(eco.disc * 10) + ' 折出售，每件可获利多少元？';
    answer = ecoSale - eco.cost;
    steps = 2;
  } else if (isInclusion) {
    
    var INC = [
      { total: 40, aN: 20, bN: 18, cN: 16, ab: 8, ac: 7, bc: 6, abc: 3 },
      { total: 50, aN: 25, bN: 22, cN: 20, ab: 10, ac: 9, bc: 8, abc: 4 },
      { total: 45, aN: 18, bN: 16, cN: 15, ab: 7, ac: 6, bc: 5, abc: 2 }
    ];
    var inc = INC[v % INC.length];
    prompt = '某班 ' + inc.total + ' 人，参加数学小组 ' + inc.aN + ' 人、英语小组 ' + inc.bN + ' 人、科学小组 ' + inc.cN + ' 人；'
      + '同时参加数学和英语的 ' + inc.ab + ' 人，数学和科学的 ' + inc.ac + ' 人，英语和科学的 ' + inc.bc + ' 人；三个小组都参加的 ' + inc.abc + ' 人。三个小组都没参加的有多少人？';
    answer = inc.total - (inc.aN + inc.bN + inc.cN - inc.ab - inc.ac - inc.bc + inc.abc);
    steps = 3;
  } else if (isEq2) {
    
    var EQ2 = [{ s: 10, d: 4 }, { s: 14, d: 6 }, { s: 20, d: 8 }, { s: 16, d: 4 }];
    var eq2 = EQ2[v % EQ2.length];
    prompt = '已知甲、乙两数之和是 ' + eq2.s + '，甲数比乙数大 ' + eq2.d + '。甲数是多少？';
    answer = (eq2.s + eq2.d) / 2;
    steps = 2;
  } else if (isEq1) {
    
    var EQ1 = [{ a: 3, b: 5, c: 20 }, { a: 2, b: 3, c: 11 }, { a: 4, b: 7, c: 9 }, { a: 5, b: 8, c: 28 }];
    var eq1 = EQ1[v % EQ1.length];
    prompt = '一个数的 ' + eq1.a + ' 倍加上 ' + eq1.b + ' 等于 ' + eq1.c + '。这个数是多少？（列方程解答）';
    answer = (eq1.c - eq1.b) / eq1.a;
    steps = 2;
  } else if (isDiophantine) {
    
    var DIO = [{ s: '3x + 2y = 17', ans: 3 }, { s: '5x + 2y = 24', ans: 3 }, { s: '2x + 3y = 18', ans: 4 }];
    var dio = DIO[v % DIO.length];
    prompt = '求方程 ' + dio.s + ' 的正整数解一共有多少组？';
    answer = dio.ans;
    steps = 3;
  } else if (isRatio) {
    
    var RAT = [{ r: [2, 3, 5], t: 100 }, { r: [1, 2, 3], t: 120 }, { r: [3, 4, 5], t: 120 }, { r: [2, 5, 3], t: 100 }];
    var rat = RAT[v % RAT.length];
    var ratSum = rat.r[0] + rat.r[1] + rat.r[2];
    prompt = '把 ' + rat.t + ' 元奖金按 ' + rat.r[0] + ':' + rat.r[1] + ':' + rat.r[2] + ' 的比例分给甲、乙、丙三人。丙分得多少元？';
    answer = rat.t * rat.r[2] / ratSum;
    steps = 2;
  } else if (isMixture) {
    
    var MIX = [{ m1: 300, w1: 20, m2: 200, w2: 30, ans: 24 }, { m1: 200, w1: 10, m2: 300, w2: 20, ans: 16 }, { m1: 400, w1: 15, m2: 100, w2: 25, ans: 17 }];
    var mix = MIX[v % MIX.length];
    prompt = '把 ' + mix.m1 + ' 克浓度 ' + mix.w1 + '% 的盐水和 ' + mix.m2 + ' 克浓度 ' + mix.w2 + '% 的盐水混合。混合后盐水的浓度是百分之多少？';
    answer = (mix.m1 * mix.w1 + mix.m2 * mix.w2) / (mix.m1 + mix.m2);
    steps = 3;
  } else if (isMisc) {
    
    var MISC = [{ k: 3, s: 3 }, { k: 3, s: 2 }, { k: 5, s: 3 }, { k: 4, s: 2 }];
    var misc = MISC[v % MISC.length];
    prompt = '一口平底锅每次最多能烙 2 张饼，每张饼两面都要烙，每面需 ' + misc.s + ' 分钟。烙熟 ' + misc.k + ' 张饼最少需要多少分钟？';
    answer = misc.k * misc.s;
    steps = 3;
  } else if (isMock || isIntegrated) {
    
    var INT = [{ t: 120, r: 3 }, { t: 200, r: 4 }, { t: 160, r: 3 }, { t: 240, r: 5 }];
    var it = INT[v % INT.length];
    prompt = '商店运来苹果和梨共 ' + it.t + ' 千克，其中苹果的质量是梨的 ' + it.r + ' 倍。梨有多少千克？';
    answer = it.t / (it.r + 1);
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



function createC9Generator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c9-comprehensive';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};

      for (var i = 0; i < count; i++) {
        questions.push(makeQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [createC9Generator()];
}

module.exports = {
  createC9Generator: createC9Generator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/semantic-special.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':' + i;
  if (plan && plan.seed != null) return plan.seed + ':' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
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
    numberRange: constraints.numberRange || { min: 1, max: 100 },
    spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
    context: plan.contextType != null ? plan.contextType : 'standard',
    seed: seedFor(plan, context, i),
    hint: null,
    answerMode: 'input',
    data: extra || {}
  };
}

function buildQuestions(plan, context, count, make) {
  var out = [];
  for (var i = 0; i < count; i++) out.push(make(plan, context, i));
  return out;
}




function codeName(plan) {
  return (plan && plan.semanticParams && plan.semanticParams.name) || '';
}

function codeCategory(name) {
  if (name.indexOf('身份证') !== -1) return 'idcard';
  if (name.indexOf('邮政编码') !== -1 || name.indexOf('邮编') !== -1) return 'postal';
  if (name.indexOf('特点') !== -1) return 'feature';
  if (name.indexOf('实践') !== -1) return 'practice';
  return 'life';
}


var CODE_BANK = {
  idcard: {
    fill: [
      { q: '身份证号 110101201008151234 中，第 7~14 位表示出生日期，持证人的出生日期是（  ）。', a: '2010年8月15日' },
      { q: '身份证号第 17 位是 3（奇数），说明持证人为（  ）性。', a: '男' },
      { q: '我国第二代居民身份证号码一共有（  ）位。', a: '18位' },
      { q: '身份证号 310104201203054528 的持证人出生日期是（  ）。', a: '2012年3月5日' }
    ],
    choice: [
      { q: '身份证号 110101201008151234 的持证人出生日期是哪一天？', a: '2010年8月15日',
        o: ['2010年8月15日', '2010年8月5日', '2011年8月15日', '2001年8月15日'] },
      { q: '身份证号第 17 位是 4（偶数），持证人性别是？', a: '女',
        o: ['男', '女', '不能确定', '既是男也是女'] },
      { q: '身份证号码的前 6 位表示什么信息？', a: '地址码（户籍地）',
        o: ['出生日期', '地址码（户籍地）', '顺序码', '校验码'] },
      { q: '身份证号码的第 18 位是什么码？', a: '校验码',
        o: ['地址码', '出生日期码', '顺序码', '校验码'] }
    ],
    apply: [
      { q: '警察捡到一张身份证，号码是 110101201008151234。请你帮忙判断：失主出生于哪一年几月几日？是男生还是女生？并写出身份证号每一部分表示的信息。',
        a: '2010年8月15日出生，男性（第17位3为奇数）；前6位地址码、第7~14位出生日期码、第15~17位顺序码、第18位校验码' },
      { q: '银行开户需要登记身份证号 310104201203054528。请说出这位同学的出生年月日，并说明身份证号为什么能唯一确定一个人？',
        a: '2012年3月5日出生；18位编码包含地址、出生日期、顺序码和校验码，全国每人唯一' },
      { q: '小明要填写学籍表，其中有“出生日期”和“性别”两栏，他只记得自己的身份证号是 440103201112200617。请帮他把这两栏填好并说明依据？',
        a: '出生日期2011年12月20日，男性（第17位1为奇数）' }
    ]
  },
  postal: {
    fill: [
      { q: '我国的邮政编码由（  ）位阿拉伯数字组成。', a: '6位' },
      { q: '邮政编码的前两位表示省（自治区、直辖市），前三位表示（  ）。', a: '邮区' },
      { q: '邮政编码的最后两位表示（  ）。', a: '投递局（所）' },
      { q: '寄信时要在信封左上角的方框内填写收信人所在地的（  ）位邮政编码。', a: '6位' }
    ],
    choice: [
      { q: '我国邮政编码一共有几位数字？', a: '6位',
        o: ['4位', '5位', '6位', '8位'] },
      { q: '邮政编码 100000 中，前两位“10”表示哪里？', a: '北京市',
        o: ['上海市', '北京市', '天津市', '重庆市'] },
      { q: '邮政编码的前四位数字表示什么？', a: '县（市）邮局',
        o: ['省（自治区、直辖市）', '邮区', '县（市）邮局', '投递局（所）'] },
      { q: '下面哪个数可能是一个正确的邮政编码？', a: '100000',
        o: ['10000', '100000', '1000000', '100'] }
    ],
    apply: [
      { q: '小红给北京的奶奶寄信，北京的邮政编码以 10 开头（如 100000）。请在信封上写清收信人邮编，并说明邮政编码的 6 位数字分别表示哪几级信息？',
        a: '前2位省（自治区、直辖市）、前3位邮区、前4位县（市）邮局、最后2位投递局（所）' },
      { q: '一封信上写的邮政编码是 310012。请你按编码规则说一说这 6 个数字分别表示什么，机器分拣信件时编码有什么好处？',
        a: '31表示浙江省、310表示所在邮区、3100表示杭州市邮局、12表示投递局；编码规范统一，分拣又快又准' },
      { q: '小明给杭州（邮编 310012）的笔友写信，请你告诉他收信人邮编应写在信封的什么位置，并完整说出 6 位邮编的含义？',
        a: '写在信封左上方框内；31省、310邮区、3100县（市）邮局、12投递局（所）' }
    ]
  },
  feature: {
    fill: [
      { q: '同一个班两位同学的学号不能相同，这体现了数字编码的（  ）性。', a: '唯一' },
      { q: '所有学号都按“入学年份+班级+序号”的统一格式编制，这体现了数字编码的（  ）性。', a: '规范' },
      { q: '用数字编号代替完整书名登记图书，检索更方便，这体现了数字编码的（  ）性。', a: '简洁' },
      { q: '门牌号沿街道从一端到另一端依次增大，这体现了数字编码的（  ）性。', a: '有序' }
    ],
    choice: [
      { q: '全校学生的学号互不相同，主要体现了数字编码的什么特点？', a: '唯一性',
        o: ['唯一性', '规范性', '简洁性', '美观性'] },
      { q: '所有学号都按统一格式“4位年份+2位班级+2位序号”编制，体现了什么特点？', a: '规范性',
        o: ['唯一性', '规范性', '保密性', '随意性'] },
      { q: '图书馆用 6 位数字给图书编号，比书写完整书名更方便快捷，体现了什么特点？', a: '简洁性',
        o: ['简洁性', '唯一性', '规范性', '有序性'] },
      { q: '门牌号按街道方向依次增大，便于查找，体现了数字编码的什么特点？', a: '有序性',
        o: ['唯一性', '规范性', '简洁性', '有序性'] }
    ],
    apply: [
      { q: '学校给每位同学编学号，要求全校不重复、格式统一、还能按入学年份排序查找。请说出这样的学号设计分别利用了数字编码的哪些特点？',
        a: '不重复体现唯一性，格式统一体现规范性，按年份排序体现有序性' },
      { q: '图书馆要给几十万册图书编号，请结合数字编码简洁、唯一、规范、有序的特点，说明为什么用数字编号比直接用书名登记更好？',
        a: '数字编号简洁好记、每书唯一、格式统一、可按顺序排列检索，借阅和盘点都更方便' },
      { q: '快递单上的单号有十几位数字且全国不重复、格式统一。请结合数字编码的特点，说明快递公司为什么要这样编号？',
        a: '唯一性保证每单可查，规范性便于各环节统一处理，简洁有序便于机器分拣和快速追踪' }
    ]
  },
  practice: {
    fill: [
      { q: '按“入学年份4位+班级2位+序号2位”的规则，2024年入学3班序号8的同学学号应编为（  ）。', a: '20240308' },
      { q: '宾馆房间号 302 中，第一位 3 表示楼层，后两位 02 表示（  ）。', a: '第2个房间' },
      { q: '图书编号 A-03-12 中，A 表示类别、03 表示书架号、12 表示（  ）。', a: '第12本书' },
      { q: '停车场车位编号 B2-15 中，B2 表示地下2层，15 表示（  ）。', a: '第15号车位' }
    ],
    choice: [
      { q: '按“年份4位+班级2位+序号2位”的规则，2023年入学5班序号12的同学学号是？', a: '20230512',
        o: ['20230512', '20235012', '05122023', '12052023'] },
      { q: '宾馆用“楼层+两位房间序号”编房号，5楼第18个房间的房号应该是？', a: '518',
        o: ['518', '185', '5018', '1805'] },
      { q: '订单按“年4位+月2位+日2位”编号，2024年3月15日的第1张订单编号可以是？', a: '2024031501',
        o: ['2024031501', '15032024', '31520241', '03150124'] },
      { q: '图书室用“楼层1位+书架2位+层1位”编号，3楼第8架第2层的编号是？', a: '3082',
        o: ['3082', '3820', '2083', '3280'] }
    ],
    apply: [
      { q: '请你为学校图书馆设计一套图书编码：要能看出图书类别、所在楼层和书架序号，并用一个具体例子说明每一位的含义。',
        a: '示例 A-3-05：A 表示类别、3 表示楼层、05 表示第5架（方案不唯一，结构清晰、唯一规范即可）' },
      { q: '请为宾馆房间设计编号规则，使客人一看房号就知道楼层和房间序号，并写出 5 楼第 8 间、12 楼第 3 间的编号。',
        a: '规则：楼层数+两位房间序号；5楼第8间为 508，12楼第3间为 1203' },
      { q: '请为全校同学设计学号，要求包含入学年份、班级、序号和性别信息（末位用 1 表示男、2 表示女），并为 2024 年入学 2 班序号 16 的女生写出一个学号。',
        a: '规则：4位年份+2位班级+2位序号+1位性别；该女生学号如 202402162' },
      { q: '小区地下车库要给每个车位编号，要求从编号能看出楼层、区域和车位序号。请设计规则并给出地下2层B区第15号车位的编号。',
        a: '示例 B2-B-15：B2 表示地下2层、B 表示区域、15 表示车位序号（方案合理即可）' }
    ]
  },
  life: {
    fill: [
      { q: '发现违法犯罪需要报警时，应拨打（  ）电话。', a: '110' },
      { q: '发生火灾时应拨打的火警电话是（  ）。', a: '119' },
      { q: '有人突发疾病需要急救时，应拨打（  ）急救电话。', a: '120' },
      { q: '“京A·12345”是汽车的（  ）号码编码。', a: '车牌' }
    ],
    choice: [
      { q: '发现房屋着火应拨打的电话是？', a: '119',
        o: ['110', '119', '120', '122'] },
      { q: '路上有人突发疾病需要急救，应拨打哪个电话？', a: '120',
        o: ['110', '119', '120', '122'] },
      { q: '下面哪一项属于生活中的数字编码？', a: '车牌号京A·12345',
        o: ['一幅风景画', '车牌号京A·12345', '一首儿歌', '一块橡皮'] },
      { q: '发生交通事故需要报警时，应拨打哪个电话？', a: '122',
        o: ['110', '119', '120', '122'] }
    ],
    apply: [
      { q: '小华在家发现厨房着火了，请你告诉他应该拨打哪个电话，并说出生活中还有哪些常见的数字编码（至少写出 3 个）？',
        a: '应拨打 119；常见数字编码有身份证号码、邮政编码、学号、门牌号、车牌号、电话号码等' },
      { q: '小区门牌号 8-3-201 表示 8 号楼 3 单元 2 层 01 室。请说说你家的住址可以怎样用数字编码表示，这样编码有什么好处？',
        a: '可用“楼号-单元-楼层房号”编码（如 12-2-502）；编码唯一、规范、简洁，便于查找、投递和救援' },
      { q: '妈妈让小明熟记三个特殊服务电话。请你分别写出报警、火警、急救的电话号码，并说明这些短号码为什么要这样编？',
        a: '报警110、火警119、急救120；号码简短规范、全国统一，便于记忆和紧急情况下快速拨打' }
    ]
  }
};

function makeCodeByKind(plan, context, i, qt) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var cat = codeCategory(codeName(plan));
  var bank = CODE_BANK[cat][qt];
  var item = bank[i % bank.length];
  var q = buildBase(plan, context, i, { mode: qt, codeType: cat });
  q.prompt = item.q;
  q.answer = { value: item.a, acceptable: [] };
  if (qt === 'choice') {
    var options = Rng.shuffle(rng, item.o.slice());
    q.data.options = options;
    q.data.correctIndex = options.indexOf(item.a);
    q.answerMode = 'choice';
  }
  return q;
}

function makeCodeFill(plan, context, i) {
  return makeCodeByKind(plan, context, i, 'fill');
}

function makeCodeChoice(plan, context, i) {
  return makeCodeByKind(plan, context, i, 'choice');
}

function makeCodeApply(plan, context, i) {
  return makeCodeByKind(plan, context, i, 'apply');
}

function makeCodeJudge(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var statements = [
    { text: '数字编码的每一位都有特定的含义，不能随意改变。', value: true },
    { text: '数字编码可以用来表示学号、身份证号等信息。', value: true },
    { text: '数字编码的位数越少，表示的信息就越准确。', value: false },
    { text: '同一所学校里，两位同学的学号可以完全相同。', value: false }
  ];
  var s = Rng.pick(rng, statements);
  var q = buildBase(plan, context, i, { mode: 'judge', codeType: 'concept' });
  q.prompt = '判断对错：' + s.text + '（  ）';
  q.answer = { value: s.value, acceptable: [] };
  return q;
}

function createCodeGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:code-recognition';
  var generator = {
    id: id,
    subject: 'math',
    
    
    capabilities: ['fill', 'choice', 'judge', 'apply'],
    questionTypes: ['fill', 'choice', 'judge', 'apply'],
    
    
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return generator.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      var count = plan.count || 1;
      var qt = plan.questionTypeId;
      if (qt === 'choice') return buildQuestions(plan, context, count, makeCodeChoice);
      if (qt === 'apply') return buildQuestions(plan, context, count, makeCodeApply);
      if (qt === 'judge') return buildQuestions(plan, context, count, makeCodeJudge);
      return buildQuestions(plan, context, count, makeCodeFill);
    }
  };
  return generator;
}



var ITEMS = [
  ['盒奶糖', '袋薯片', '支铅笔'],
  ['个苹果', '个橙子', '块饼干'],
  ['个书包', '个笔袋', '支钢笔'],
  ['辆玩具汽车', '个魔方', '块积木']
];

function pickChain(rng) {
  var trio = Rng.pick(rng, ITEMS);
  var p = Rng.randInt(rng, 2, 4);
  var q = Rng.randInt(rng, 2, 4);
  return { X: trio[0], Y: trio[1], Z: trio[2], p: p, q: q };
}

function makeEquivalentFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var c = pickChain(rng);
  var ans = c.p * c.q;
  var q = buildBase(plan, context, i, { mode: 'fill', chain: [c.p, c.q] });
  q.prompt = '1' + c.X + ' = ' + c.p + c.Y + '，1' + c.Y + ' = ' + c.q + c.Z
    + '。1' + c.X + ' = （  ）' + c.Z + '。';
  q.answer = { value: String(ans), acceptable: [] };
  return q;
}

function makeEquivalentChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var c = pickChain(rng);
  var ans = c.p * c.q;
  var wrongs = [c.p, c.q, c.p + c.q, c.p + c.q - 1].filter(function (v) { return v !== ans; });
  var pool = [ans].concat(wrongs);
  while (pool.length < 4) pool.push(ans + Rng.randInt(rng, 1, 3));
  var options = Rng.shuffle(rng, pool.slice(0, 4).map(String));
  var q = buildBase(plan, context, i, { mode: 'choice', chain: [c.p, c.q] });
  q.prompt = '1' + c.X + ' = ' + c.p + c.Y + '，1' + c.Y + ' = ' + c.q + c.Z
    + '。1' + c.X + ' = （  ）' + c.Z + '。';
  q.answer = { value: String(ans), acceptable: [] };
  q.data.options = options;
  q.data.correctIndex = options.indexOf(String(ans));
  return q;
}

function makeEquivalentApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var c = pickChain(rng);
  var ans = c.p * c.q;
  var buyer = Rng.pick(rng, ['妈妈', '爸爸', '王老师', '李阿姨']);
  var q = buildBase(plan, context, i, { mode: 'apply', chain: [c.p, c.q] });
  q.prompt = buyer + '买 1' + c.X + '的钱可以买 ' + c.p + c.Y + '，买 1' + c.Y + '的钱可以买 '
    + c.q + c.Z + '。' + buyer + '买 1' + c.X + '的钱可以买（  ）' + c.Z + '。';
  q.answer = { value: String(ans), acceptable: [] };
  return q;
}

function createEquivalentGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:equivalent-reasoning';
  var generator = {
    id: id,
    subject: 'math',
    capabilities: ['fill', 'choice', 'apply'],
    questionTypes: ['fill', 'choice', 'apply'],
    
    
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return generator.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      var count = plan.count || 1;
      var qt = plan.questionTypeId;
      if (qt === 'choice') return buildQuestions(plan, context, count, makeEquivalentChoice);
      if (qt === 'apply') return buildQuestions(plan, context, count, makeEquivalentApply);
      return buildQuestions(plan, context, count, makeEquivalentFill);
    }
  };
  return generator;
}

function buildAll() {
  return [
    createCodeGenerator(),
    createEquivalentGenerator()
  ];
}

module.exports = {
  createCodeGenerator: createCodeGenerator,
  createEquivalentGenerator: createEquivalentGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/classify.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':' + i;
  if (plan && plan.seed != null) return plan.seed + ':' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
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
    numberRange: constraints.numberRange || { min: 1, max: 10 },
    spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
    context: plan.contextType != null ? plan.contextType : 'standard',
    seed: seedFor(plan, context, i),
    hint: null,
    answerMode: 'input',
    data: extra || {}
  };
}

function buildQuestions(plan, context, count, make) {
  var out = [];
  for (var i = 0; i < count; i++) out.push(make(plan, context, i));
  return out;
}



function makeSort(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var range = (plan.constraints && plan.constraints.numberRange) || { min: 1, max: 10 };
  var n = Rng.randInt(rng, 3, 5);
  var nums = [];
  var guard = 0;
  while (nums.length < n && guard < 100) {
    var v = Rng.randInt(rng, range.min, range.max);
    if (nums.indexOf(v) === -1) nums.push(v);
    guard++;
  }
  var desc = Rng.randInt(rng, 0, 1) === 1;
  var sorted = nums.slice().sort(function (a, b) { return desc ? b - a : a - b; });
  var orderText = desc ? '从大到小' : '从小到大';
  var q = buildBase(plan, context, i, { mode: 'classify', sort: { desc: desc, count: n } });
  q.prompt = '把下面各数按' + orderText + '的顺序排列：' + nums.join('，') + '。';
  q.answer = { value: sorted.join('，'), acceptable: [] };
  return q;
}

function createClassificationGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:classification';
  var generator = {
    id: id,
    subject: 'math',
    capabilities: ['classify'],
    questionTypes: ['classify'],
    
    
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return plan.questionTypeId === 'classify';
    },

    generate: function (plan, context) {
      var count = (plan && plan.count) || 1;
      return buildQuestions(plan, context, count, makeSort);
    }
  };
  return generator;
}

function buildAll() {
  return [createClassificationGenerator()];
}

module.exports = {
  createClassificationGenerator: createClassificationGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/percent.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");
var SemanticParameters = require("shared/generator/core/semantic-parameters.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':' + i;
  if (plan && plan.seed != null) return plan.seed + ':' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
}


var CLEAN_PERCENTS = [10, 20, 25, 40, 50, 60, 75, 80, 90];

var DISCOUNTS = [
  { label: '八折', rate: 80 }, { label: '七五折', rate: 75 },
  { label: '九折', rate: 90 }, { label: '八五折', rate: 85 },
  { label: '六五折', rate: 65 }, { label: '六折', rate: 60 }
];

var FRACTION_PERCENT = [
  { num: 1, den: 2, percent: 50 }, { num: 1, den: 4, percent: 25 },
  { num: 3, den: 4, percent: 75 }, { num: 1, den: 5, percent: 20 },
  { num: 2, den: 5, percent: 40 }, { num: 3, den: 5, percent: 60 },
  { num: 4, den: 5, percent: 80 }, { num: 1, den: 10, percent: 10 },
  { num: 1, den: 20, percent: 5 }, { num: 1, den: 50, percent: 2 }
];

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
    numberRange: constraints.numberRange || { min: 1, max: 100 },
    spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
    context: plan.contextType != null ? plan.contextType : 'standard',
    seed: seedFor(plan, context, i),
    prompt: '',
    answer: null,
    answerMode: 'input',
    hint: null,
    data: Object.assign({ mode: 'percent-calc' }, extra || {})
  };
}

function finish(q, prompt, answer, explanation) {
  q.prompt = prompt;
  q.answer = { value: String(answer), acceptable: [], explanation: explanation || (prompt.replace(/[？?]\s*$/, '') + ' = ' + answer) };
  return q;
}

var qt = function (plan) { return plan.questionTypeId; };


function makePercentOf(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.pick(rng, [100, 200, 300, 400, 500, 800]);
  var p = Rng.pick(rng, CLEAN_PERCENTS);
  var ans = Math.round(base * p / 100 * 100) / 100;
  var prompt;
  if (qt(plan) === 'apply') {
    prompt = '图书室有 ' + base + ' 本图书，其中 ' + p + '% 是故事书。故事书有多少本？';
  } else if (qt(plan) === 'fill') {
    prompt = base + ' 的 ' + p + '% 等于 ____。';
  } else {
    prompt = '列式计算：' + base + ' × ' + p + '% = ？';
  }
  return finish(buildBase(plan, context, i, { subType: 'percent-of', base: base, percent: p }),
    prompt, ans, base + ' × ' + p + '% = ' + ans);
}


function makeConversion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var variant = i % 3;
  var isCalc = qt(plan) === 'calc';
  var q = buildBase(plan, context, i, { subType: 'percent-conversion', variant: variant });
  if (variant === 0) {
    var d = (Rng.randInt(rng, 1, 9) * 10 + Rng.randInt(rng, 1, 9)) / 100;
    var dpct = Math.round(d * 100);
    var stem0 = isCalc
      ? '把小数 ' + d.toFixed(2) + ' 化成百分数，列式：' + d.toFixed(2) + ' =（ ）%（只填数字）。'
      : '把小数 ' + d.toFixed(2) + ' 化成百分数是（ ）%（只填数字）。';
    return finish(q, stem0, dpct, d.toFixed(2) + ' = ' + dpct + '%');
  }
  if (variant === 1) {
    var f = Rng.pick(rng, FRACTION_PERCENT);
    var stem = qt(plan) === 'fill'
      ? '把分数 ' + f.num + '/' + f.den + ' 化成百分数：____%（只填数字）'
      : (isCalc
        ? '把分数 ' + f.num + '/' + f.den + ' 化成百分数，列式：' + f.num + '/' + f.den + ' =（ ）%（只填数字）'
        : f.num + '/' + f.den + ' 化成百分数是多少？（只填数字）');
    return finish(q, stem, f.percent, f.num + '/' + f.den + ' = ' + f.percent + '%');
  }
  var p = Rng.pick(rng, CLEAN_PERCENTS);
  var dec = (p / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  if (isCalc) {
    
    return finish(q, '把 ' + p + '% 化成小数，列式：' + p + ' ÷ 100 =（ ）。', dec, p + '% = ' + dec);
  }
  return finish(q, '把 ' + p + '% 化成小数是（ ）。', dec, p + '% = ' + dec);
}


function makeDiscount(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var price = Rng.pick(rng, [100, 200, 300, 400, 500, 600, 800]);
  var d = Rng.pick(rng, DISCOUNTS);
  var cur = Math.round(price * d.rate) / 100;
  var askSaved = (i % 2 === 1);
  var prompt;
  
  if (qt(plan) === 'calc') {
    return finish(buildBase(plan, context, i, { subType: 'percent-discount', price: price, rate: d.rate, ask: 'current' }),
      '列式计算：一件商品原价 ' + price + ' 元，现在' + d.label + '出售，现价是多少元？列式：' + price + ' × ' + d.rate + '% = ？',
      cur, '现价 ' + price + ' × ' + d.rate + '% = ' + cur + ' 元');
  }
  if (askSaved) {
    prompt = '一件商品原价 ' + price + ' 元，现在' + d.label + '出售，买这件商品可以便宜多少元？';
    return finish(buildBase(plan, context, i, { subType: 'percent-discount', price: price, rate: d.rate, ask: 'saved' }),
      prompt, price - cur, '便宜 ' + price + ' − ' + cur + ' = ' + (price - cur) + ' 元');
  }
  prompt = '一件商品原价 ' + price + ' 元，现在' + d.label + '出售，现价是多少元？';
  return finish(buildBase(plan, context, i, { subType: 'percent-discount', price: price, rate: d.rate, ask: 'current' }),
    prompt, cur, '现价 ' + price + ' × ' + d.rate + '% = ' + cur + ' 元');
}


function makeInterest(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var principal = Rng.pick(rng, [1000, 2000, 3000, 5000, 8000]);
  var rate = Rng.pick(rng, [2, 3, 4, 5]);
  var years = Rng.randInt(rng, 1, 3);
  var interest = principal * rate * years / 100;
  var askTotal = (i % 2 === 1);
  
  if (qt(plan) === 'calc') {
    return finish(buildBase(plan, context, i, { subType: 'percent-interest', principal: principal, rate: rate, years: years, ask: 'interest' }),
      '列式计算：' + principal + ' 元存入银行，年利率 ' + rate + '%，存期 ' + years + ' 年。列式求到期利息：' + principal + ' × ' + rate + '% × ' + years + ' = ？',
      interest, '利息 ' + principal + ' × ' + rate + '% × ' + years + ' = ' + interest + ' 元');
  }
  if (askTotal) {
    return finish(buildBase(plan, context, i, { subType: 'percent-interest', principal: principal, rate: rate, years: years, ask: 'total' }),
      '小明把 ' + principal + ' 元压岁钱存入银行，年利率 ' + rate + '%，存期 ' + years + ' 年。到期时一共可以取回多少元？',
      principal + interest, '本息合计 ' + principal + ' + ' + interest + ' = ' + (principal + interest) + ' 元');
  }
  return finish(buildBase(plan, context, i, { subType: 'percent-interest', principal: principal, rate: rate, years: years, ask: 'interest' }),
    '小明把 ' + principal + ' 元存入银行，年利率 ' + rate + '%，存期 ' + years + ' 年。到期可得利息多少元？',
    interest, '利息 ' + principal + ' × ' + rate + '% × ' + years + ' = ' + interest + ' 元');
}


function makeRateLine(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var q = buildBase(plan, context, i, { subType: 'percent-target-rate' });
  
  if (qt(plan) === 'calc') {
    var ctotal = Rng.pick(rng, [50, 100, 200, 400, 500]);
    var crate = Rng.pick(rng, [80, 90, 95, 75, 60]);
    var cneed = Math.round(ctotal * crate / 100);
    return finish(q,
      '列式计算：学校规定体育达标率不低于 ' + crate + '%，全年级共 ' + ctotal + ' 人。列式求至少达标人数：' + ctotal + ' × ' + crate + '% = ？',
      cneed, ctotal + ' × ' + crate + '% = ' + cneed + ' 人');
  }
  if (i % 2 === 1) {
    
    var total = Rng.pick(rng, [50, 100, 200, 400, 500]);
    var ratePct = Rng.pick(rng, [80, 90, 95, 75, 60]);
    var need = Math.round(total * ratePct / 100);
    return finish(q,
      '学校规定体育达标率不低于 ' + ratePct + '%。全年级共 ' + total + ' 人，至少要有多少人达标？',
      need, total + ' × ' + ratePct + '% = ' + need + ' 人');
  }
  
  var total2 = Rng.pick(rng, [40, 50, 100, 200, 250]);
  var pct = Rng.pick(rng, CLEAN_PERCENTS.concat([95, 85]));
  var reached = Math.round(total2 * pct / 100);
  return finish(q,
    '六年级共有 ' + total2 + ' 人，体育达标 ' + reached + ' 人。达标率是（ ）%（只填数字）。',
    Math.round(reached / total2 * 100), reached + ' ÷ ' + total2 + ' ×100% = ' + Math.round(reached / total2 * 100) + '%');
}


function makePercentChange(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.pick(rng, [100, 200, 250, 400, 500]);
  var p = Rng.pick(rng, CLEAN_PERCENTS);
  var increase = (i % 2 === 0);
  var ans = increase ? base + base * p / 100 : base - base * p / 100;
  var prompt;
  
  if (qt(plan) === 'calc') {
    return finish(buildBase(plan, context, i, { subType: 'percent-change', base: base, percent: p, increase: increase }),
      '列式计算：' + base + (increase ? ' + ' : ' − ') + base + ' × ' + p + '% = ？',
      ans, base + ' × (1' + (increase ? '+' : '−') + p + '%) = ' + ans);
  }
  if (increase) {
    prompt = '果园去年收苹果 ' + base + ' 千克，今年比去年增产 ' + p + '%，今年收苹果多少千克？';
  } else {
    prompt = '一件衣服原价 ' + base + ' 元，店庆期间降价 ' + p + '% 出售，现价多少元？';
  }
  return finish(buildBase(plan, context, i, { subType: 'percent-change', base: base, percent: p, increase: increase }),
    prompt, ans,
    base + ' × (1' + (increase ? '+' : '−') + p + '%) = ' + ans);
}


function makeTax(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var income = Rng.pick(rng, [3000, 5000, 8000, 10000, 20000, 50000]);
  var rate = Rng.pick(rng, [3, 5, 6, 10]);
  var tax = Math.round(income * rate) / 100;
  var goods = Rng.pick(rng, ['商店某月的营业额', '一家餐馆某月的营业额', '某公司某月的营业额']);
  if (qt(plan) === 'calc') {
    return finish(buildBase(plan, context, i, { subType: 'percent-tax', income: income, rate: rate }),
      '列式计算：' + goods + '是 ' + income + ' 元，按 ' + rate + '% 的税率缴纳税款，应缴纳税款多少元？列式：' + income + ' × ' + rate + '% = ？',
      tax, '应纳税额 ' + income + ' × ' + rate + '% = ' + tax + ' 元');
  }
  if (qt(plan) === 'fill') {
    return finish(buildBase(plan, context, i, { subType: 'percent-tax', income: income, rate: rate }),
      income + ' × ' + rate + '% = ____（元）',
      tax, '应纳税额 ' + income + ' × ' + rate + '% = ' + tax + ' 元');
  }
  return finish(buildBase(plan, context, i, { subType: 'percent-tax', income: income, rate: rate }),
    goods + '是 ' + income + ' 元，按规定要按 ' + rate + '% 的税率缴纳税款。这家应缴纳税款多少元？',
    tax, '应纳税额 ' + income + ' × ' + rate + '% = ' + tax + ' 元');
}


var CHENGSHU = [
  { label: '一成', num: 1, rate: 10 }, { label: '二成', num: 2, rate: 20 },
  { label: '三成', num: 3, rate: 30 }, { label: '三成五', num: 3.5, rate: 35 },
  { label: '四成', num: 4, rate: 40 }, { label: '七成五', num: 7.5, rate: 75 }
];
function makeChengshu(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var c = Rng.pick(rng, CHENGSHU);
  
  if (i % 2 === 0) {
    var q = buildBase(plan, context, i, { subType: 'percent-chengshu', chengshu: c.label, ask: 'convert' });
    var stemC = qt(plan) === 'calc'
      ? '列式：把' + c.label + '改写成百分数，' + c.num + ' ÷ 10 = （ ）%（只填数字）。'
      : (qt(plan) === 'fill'
        ? c.label + ' = ' + c.num + ' ÷ 10 = ____%（只填数字）'
        : '农业收成常用「成数」表示：' + c.label + ' = ' + c.num + ' ÷ 10，' + c.label + '改写成百分数是多少？（只填数字）');
    return finish(q, stemC, c.rate, c.label + ' = ' + c.num + '/10 = ' + c.rate + '%');
  }
  var base = Rng.pick(rng, [200, 300, 400, 500, 600, 800]);
  var gain = Math.round(base * c.rate) / 100;
  var crop = Rng.pick(rng, ['小麦', '玉米', '水稻', '苹果']);
  if (qt(plan) === 'calc') {
    return finish(buildBase(plan, context, i, { subType: 'percent-chengshu', base: base, rate: c.rate, ask: 'gain' }),
      '列式计算：去年产' + crop + ' ' + base + ' 吨，今年比去年增产' + c.label + '（' + c.rate + '%），今年增产多少吨？列式：' + base + ' × ' + c.rate + '% = ？',
      gain, '增产量 ' + base + ' × ' + c.rate + '% = ' + gain + ' 吨');
  }
  if (qt(plan) === 'fill') {
    return finish(buildBase(plan, context, i, { subType: 'percent-chengshu', base: base, rate: c.rate, ask: 'gain' }),
      '去年产' + crop + ' ' + base + ' 吨，今年增产' + c.label + '（' + c.rate + '%）：' + base + ' × ' + c.rate + '% = ____（吨）',
      gain, '增产量 ' + base + ' × ' + c.rate + '% = ' + gain + ' 吨');
  }
  return finish(buildBase(plan, context, i, { subType: 'percent-chengshu', base: base, rate: c.rate, ask: 'gain' }),
    '李叔叔家去年产' + crop + ' ' + base + ' 吨，今年风调雨顺，比去年增产' + c.label + '（也就是 ' + c.rate + '%）。今年比去年增产多少吨？',
    gain, '增产量 ' + base + ' × ' + c.rate + '% = ' + gain + ' 吨');
}


function makeLife(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var scenario;
  if (i % 2 === 0) {
    
    var total = Rng.pick(rng, [300, 500, 800, 1000, 2000]);
    var pct = Rng.pick(rng, [80, 85, 90, 95, 96]);
    var part = Math.round(total * pct) / 100;
    var things = Rng.pick(rng, [
      ['小区居民', '参与垃圾分类的家庭'],
      ['学校学生', '每天坚持阅读的学生'],
      ['全村农户', '参加了新农合的农户']
    ]);
    scenario = {
      total: total, pct: pct, ans: part,
      story: things[0] + '共 ' + total + ' 户（人），其中 ' + pct + '% 是' + things[1] + '。' + things[1] + '有多少户（人）？',
      expr: total + ' × ' + pct + '%'
    };
  } else {
    
    var price = Rng.pick(rng, [150, 200, 300, 400, 500, 600]);
    var rate2 = Rng.pick(rng, [80, 85, 88, 90, 95]);
    var cur = Math.round(price * rate2) / 100;
    var goods2 = Rng.pick(rng, ['一套科普书', '一个书包', '一双运动鞋', '一件外套']);
    scenario = {
      total: price, pct: rate2, ans: cur,
      story: '书店（商场）店庆，' + goods2 + '原价 ' + price + ' 元，会员可按原价的 ' + rate2 + '% 购买。会员买' + goods2 + '要花多少元？',
      expr: price + ' × ' + rate2 + '%'
    };
  }
  if (qt(plan) === 'calc') {
    return finish(buildBase(plan, context, i, { subType: 'percent-life', base: scenario.total, percent: scenario.pct }),
      '列式计算：' + scenario.story + '列式：' + scenario.expr + ' = ？',
      scenario.ans, scenario.expr + ' = ' + scenario.ans);
  }
  if (qt(plan) === 'fill') {
    return finish(buildBase(plan, context, i, { subType: 'percent-life', base: scenario.total, percent: scenario.pct }),
      scenario.story + '（列式：' + scenario.expr + ' = ____）',
      scenario.ans, scenario.expr + ' = ' + scenario.ans);
  }
  return finish(buildBase(plan, context, i, { subType: 'percent-life', base: scenario.total, percent: scenario.pct }),
    scenario.story,
    scenario.ans, scenario.expr + ' = ' + scenario.ans);
}



var SUBTOPIC_MAKERS = {
  'percent-of': makePercentOf,
  'percent-conversion': makeConversion,
  'percent-discount': makeDiscount,
  'percent-interest': makeInterest,
  'percent-target-rate': makeRateLine,
  'percent-change': makePercentChange,
  'percent-tax': makeTax,
  'percent-chengshu': makeChengshu,
  'percent-life': makeLife
};


function paramsOf(plan) {
  if (plan && plan.semanticParams) return plan.semanticParams;
  var kpId = pkp(plan);
  if (!kpId) return null;
  return SemanticParameters.resolve(kpId, plan && (plan.questionTypeId || plan.questionType));
}

function createPercentGenerator(spec) {
  spec = spec || {};
  return {
    id: 'generator:percent-calc',
    subject: 'math',
    capabilities: ['calc', 'fill', 'apply'],
    questionTypes: ['calc', 'fill', 'apply'],
    
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return ['calc', 'fill', 'apply'].indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      var count = (plan && plan.count) || 1;
      var params = paramsOf(plan);
      var maker = params ? SUBTOPIC_MAKERS[params.subTopic] : null;
      
      if (!maker) return [];
      var out = [];
      for (var i = 0; i < count; i++) out.push(maker(plan, context, i));
      return out;
    }
  };
}

function buildAll() {
  return [createPercentGenerator()];
}

module.exports = {
  createPercentGenerator: createPercentGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/concept-meaning.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");
var SemanticParameters = require("shared/generator/core/semantic-parameters.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':' + i;
  if (plan && plan.seed != null) return plan.seed + ':' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
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
    numberRange: constraints.numberRange || { min: 1, max: 100 },
    spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
    context: plan.contextType != null ? plan.contextType : 'standard',
    seed: seedFor(plan, context, i),
    hint: null,
    answerMode: 'input',
    data: Object.assign({ mode: 'concept-meaning' }, extra || {})
  };
}

function finish(q, prompt, answer, acceptable, explanation) {
  q.prompt = prompt;
  q.answer = { value: answer, acceptable: acceptable || [], explanation: explanation || null };
  return q;
}


function finishChoice(q, rng, correct, wrongs) {
  var seen = {}, pool = [];
  [correct].concat(wrongs).forEach(function (o) {
    o = String(o);
    if (!seen[o]) { seen[o] = 1; pool.push(o); }
  });
  while (pool.length < 4) {
    var filler = '都不是（' + (pool.length) + '）';
    if (!seen[filler]) { seen[filler] = 1; pool.push(filler); }
  }
  pool = pool.slice(0, 4);
  var options = Rng.shuffle(rng, pool);
  q.data.options = options;
  q.data.correctIndex = options.indexOf(String(correct));
  return finish(q, q.prompt, String(correct), [], null);
}



function timesData(base, times) {
  return {
    subType: 'times',
    operation: 'mult',
    timesRelation: 'times-of',
    base: base,
    times: times,
    semanticEvidence: {
      relations: ['times-compare', 'multiply-by-times'],
      constructs: ['base-quantity', 'times-word']
    }
  };
}

function makeTimesCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.randInt(rng, 2, 9);
  var times = Rng.randInt(rng, 2, 5);
  var ans = base * times;
  var q = buildBase(plan, context, i, timesData(base, times));
  return finish(q, '列式计算：' + base + ' 的 ' + times + ' 倍是多少？', String(ans), [String(ans)],
    base + ' 的 ' + times + ' 倍：' + base + ' × ' + times + ' = ' + ans + '（' + times + ' 份，每份 ' + base + '）');
}

function makeTimesFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.randInt(rng, 2, 9);
  var times = Rng.randInt(rng, 2, 5);
  var ans = base * times;
  var q = buildBase(plan, context, i, timesData(base, times));
  return finish(q, base + ' 的 ' + times + ' 倍是 ____。', String(ans), [String(ans)],
    base + ' × ' + times + ' = ' + ans);
}

function makeTimesApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.randInt(rng, 3, 9);
  var times = Rng.randInt(rng, 2, 4);
  var ans = base * times;
  var item = Rng.pick(rng, ['根小棒', '朵红花', '颗星星', '只纸鹤']);
  var q = buildBase(plan, context, i, { subType: 'times', operation: 'mult', timesRelation: 'times-of', base: base, times: times });
  return finish(q, '第一行摆了 ' + base + ' ' + item + '，第二行摆的数量是第一行的 ' + times + ' 倍。第二行摆了多少' + item + '？',
    String(ans), [String(ans)], base + ' × ' + times + ' = ' + ans);
}

function makeTimesChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.randInt(rng, 3, 9);
  var times = Rng.randInt(rng, 2, 5);
  var q = buildBase(plan, context, i, { subType: 'times', operation: 'mult', timesRelation: 'times-of', base: base, times: times });
  q.prompt = '下面哪个算式表示「' + base + ' 的 ' + times + ' 倍」？（  ）';
  return finishChoice(q, rng, base + ' × ' + times,
    [base + ' + ' + times, base + ' − ' + times, times + ' − ' + base]);
}



function fractionData(withOperation, parts, taken) {
  var d = {
    subType: 'fraction-meaning',
    equalPartition: true,
    unitOne: true,
    parts: parts,
    taken: taken,
    semanticEvidence: {
      relations: ['unit-one', 'equal-partition'],
      constructs: ['fraction-unit']
    }
  };
  if (withOperation) d.operation = 'div';
  return d;
}

function makeFractionCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var den = Rng.randInt(rng, 4, 9);
  var ans = '1/' + den;
  var q = buildBase(plan, context, i, fractionData(true, den, 1));
  return finish(q, '列式计算：把单位“1”平均分成 ' + den + ' 份，每份是单位“1”的几分之几？', ans, [ans],
    '平均分用除法：1 ÷ ' + den + ' = ' + ans + '（每份就是分数单位 1/' + den + '）');
}

function makeFractionFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var den = Rng.randInt(rng, 4, 9);
  var num = Rng.randInt(rng, 2, den - 1);
  var ans = num + '/' + den;
  var q = buildBase(plan, context, i, fractionData(false, den, num));
  return finish(q, '把单位“1”平均分成 ' + den + ' 份，表示这样 ' + num + ' 份的数是 ____。', ans, [ans],
    '分母表示平均分的份数（' + den + '），分子表示这样的份数（' + num + '）');
}

function makeFractionApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var total = Rng.pick(rng, [12, 16, 18, 20]);
  var den = Rng.pick(rng, [4, 6, 8]);
  var q = buildBase(plan, context, i, { subType: 'fraction-meaning', equalPartition: true, unitOne: true, parts: den, taken: 1 });
  return finish(q, '一盘有 ' + total + ' 个饺子，平均分给 ' + den + ' 个人，每人分得这盘饺子的几分之几？',
    '1/' + den, ['1/' + den], '把整盘看作单位“1”，平均分成 ' + den + ' 份，每份是 1/' + den + '（与饺子个数无关）');
}

function makeFractionChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var den = Rng.randInt(rng, 5, 9);
  var num = Rng.randInt(rng, 2, den - 1);
  var q = buildBase(plan, context, i, fractionData(false, den, num));
  q.prompt = '下面哪个分数的分数单位是 1/' + den + '？（  ）';
  return finishChoice(q, rng, num + '/' + den,
    ['1/' + (den + 1), '2/' + (den + 2), '3/' + (den + 3)]);
}



function makeAngleFill(plan, context, i) {
  var q = buildBase(plan, context, i, {
    subType: 'angle-parts',
    topic: 'vertex-edges',
    semanticEvidence: {
      relations: ['vertex-rays'],
      constructs: ['vertex', 'edge']
    }
  });
  return finish(q, '从一点引出（  ）条射线所组成的图形叫做角。', '2', ['2', '两'],
    '角由一个顶点和两条边（射线）组成');
}

function makeAngleApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var shape = Rng.pick(rng, [['三角形', 3], ['红领巾', 3], ['五角星贴纸', 5], ['正方形', 4]]);
  var q = buildBase(plan, context, i, { subType: 'angle-observe', topic: 'angle-count' });
  return finish(q, '观察一块' + shape[0] + '形状的纸板：上面有几个角？', String(shape[1]), [String(shape[1])],
    shape[0] + '有 ' + shape[1] + ' 个角');
}

function makeAngleChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var q = buildBase(plan, context, i, { subType: 'angle-observe', topic: 'angle-definition' });
  q.prompt = '下面哪个说法正确地描述了“角”？（  ）';
  return finishChoice(q, rng, '从一点引出两条射线所组成的图形',
    ['两条线段组成的图形', '一条直线上的两个点', '由三条边围成的图形']);
}

function makeAngleGeometry(plan, context, i) {
  var q = buildBase(plan, context, i, { subType: 'angle-observe', topic: 'angle-size-vs-edge' });
  return finish(q, '观察一个角：把它的两条边画得更长，这个角的大小 ____。（填“变大”“变小”或“不变”）',
    '不变', ['不变'], '角的大小与两边张开的程度有关，与边的长短无关');
}

function makeAngleJudge(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var items = [
    { text: '角的两条边越长，这个角就越大。', value: false },
    { text: '一个角有一个顶点和两条边。', value: true },
    { text: '从一点引出两条射线所组成的图形叫做角。', value: true }
  ];
  var s = Rng.pick(rng, items);
  var q = buildBase(plan, context, i, { subType: 'angle-observe', topic: 'angle-concept', statement: s.text, shownResult: s.value ? '对' : '错' });
  return finish(q, '判断对错：' + s.text + '（  ）', s.value, [s.value], null);
}



function makeAreaFill(plan, context, i) {
  var q = buildBase(plan, context, i, {
    subType: 'area-concept',
    quantityKind: 'area',
    semanticEvidence: {
      relations: ['area-surface'],
      constructs: ['surface', 'size']
    }
  });
  return finish(q, '物体表面或封闭图形的大小叫做它们的（  ）。', '面积', ['面积'], null);
}

function makeAreaApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var n = Rng.pick(rng, [6, 8, 10, 12, 15]);
  var q = buildBase(plan, context, i, { subType: 'area-measure', quantityKind: 'area', unitSquares: n });
  return finish(q, '用 1 平方分米的小正方形去铺一张卡片，正好铺满了 ' + n + ' 个。这张卡片的面积是多少平方分米？',
    String(n), [String(n)], '面积就是包含的面积单位的个数：' + n + ' 个 1 平方分米 = ' + n + ' 平方分米');
}

function makeAreaChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var q = buildBase(plan, context, i, { subType: 'area-concept', quantityKind: 'area' });
  q.prompt = '下面哪个是面积单位？（  ）';
  return finishChoice(q, rng, '平方厘米', ['厘米', '千克', '秒']);
}

function makeAreaGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var a = Rng.randInt(rng, 6, 9);
  var b = Rng.randInt(rng, 3, a - 2);
  var winner = Rng.pick(rng, [['甲', a], ['乙', b]]);
  var q = buildBase(plan, context, i, { subType: 'area-compare', quantityKind: 'area', gridA: a, gridB: b });
  return finish(q, '用同样大的小方格去量两个图形：甲用了 ' + a + ' 个，乙用了 ' + b + ' 个。哪个图形的面积大？（填“甲”或“乙”）',
    winner[0], [winner[0], '图形' + winner[0]], '小方格同样大时，占的格子越多面积越大：' + winner[0] + ' 用了 ' + winner[1] + ' 个');
}

function makeAreaJudge(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var items = [
    { text: '黑板面的大小就是黑板面的面积。', value: true },
    { text: '1 平方米比 1 米大。', value: false },
    { text: '物体表面或封闭图形的大小叫做它们的面积。', value: true }
  ];
  var s = Rng.pick(rng, items);
  var q = buildBase(plan, context, i, { subType: 'area-concept', quantityKind: 'area', statement: s.text, shownResult: s.value ? '对' : '错' });
  return finish(q, '判断对错：' + s.text + '（  ）', s.value, [s.value], null);
}



function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

function buildNumberConceptItem(rng, name) {
  
  
  if (name.indexOf('1-5') !== -1 || name.indexOf('1～5') !== -1) {
    var n5 = ri(rng, 2, 5);
    return { stem: '数一数：' + n5 + ' 前面一个数是多少？（参考：' + n5 + ' − 1 = ' + (n5 - 1) + '）',
      answer: String(n5 - 1), options: [String(n5 - 1), String(n5), String(n5 + 1)],
      apply: '排队报数，小明报 ' + n5 + '（' + n5 + ' − 1 = ' + (n5 - 1) + '），他前面一个同学报几？' };
  }
  if (name.indexOf('百数表') !== -1) {
    var x0 = ri(rng, 12, 88);
    return { stem: '百数表中，' + x0 + ' 右边一个数是多少？（参考：' + x0 + ' + 1 = ' + (x0 + 1) + '）',
      answer: String(x0 + 1), options: [String(x0 + 1), String(x0 + 10), String(x0 - 1)],
      apply: '在百数表（每行10个数）里圈出 ' + x0 + '，它右边一格的数是多少？（' + x0 + ' + 1 = ？）' };
  }
  if (name.indexOf('近似') !== -1 || name.indexOf('改写') !== -1) {
    var n0 = ri(rng, 2, 8) * 10000;
    return { stem: '把 ' + n0 + ' 改写成用「万」作单位的数：' + n0 + ' = ' + (n0 / 10000) + ' × 10000，等于多少万？',
      answer: String(n0 / 10000) + '万', options: [n0 / 10000 + '万', n0 / 1000 + '万', n0 + '万'],
      apply: '某城市人口约 ' + n0 + ' 人，' + n0 + ' = ' + (n0 / 10000) + ' × 10000，改写成用万作单位是多少万人？' };
  }
  if (name.indexOf('亿') !== -1) {
    return { stem: '10 个一千万是多少？（10 × 10000000 = 100000000）',
      answer: '一亿', options: ['一亿', '一千万', '一百万'],
      apply: '计数器上一千万一千万地数，10 × 10000000 = 100000000，10 个一千万是多少？' };
  }
  if (name.indexOf('计数单位') !== -1) {
    var units = [['一百', '一千', 100, 1000], ['一十', '一百', 10, 100], ['一千', '一万', 1000, 10000]];
    var u = units[ri(rng, 0, 2)];
    return { stem: '10 个' + u[0] + '是多少？（10 × ' + u[2] + ' = ' + u[3] + '）',
      answer: u[1], options: [u[1], u[0], '一亿'],
      apply: '数数时，10 × ' + u[2] + ' = ' + u[3] + '，10 个' + u[0] + '组成的计数单位是什么？' };
  }
  if (name.indexOf('数位') !== -1) {
    var tens = ri(rng, 1, 9), ones = ri(rng, 1, 9);
    var num0 = tens * 10 + ones;
    return { stem: num0 + ' 中数字 ' + tens + ' 在什么位上？（参考：' + tens + ' × 10 + ' + ones + ' = ' + num0 + '）',
      answer: '十位', options: ['十位', '个位', '百位'],
      apply: '计数器拨出 ' + num0 + '（' + tens + ' × 10 + ' + ones + ' = ' + num0 + '），' + tens + ' 拨在哪一位上？' };
  }
  if (name.indexOf('顺序') !== -1 || name.indexOf('相邻') !== -1) {
    var cur = ri(rng, 11, 88);
    return { stem: '与 ' + cur + ' 相邻的两个数是多少？（参考：' + cur + ' − 1 = ' + (cur - 1) + '）',
      answer: (cur - 1) + ' 和 ' + (cur + 1), options: [(cur - 1) + ' 和 ' + (cur + 1), cur + ' 和 ' + (cur + 1), (cur - 1) + ' 和 ' + cur],
      apply: '发牌时数到 ' + cur + '，它前一个是 ' + (cur - 1) + '（' + cur + ' − 1 = ' + (cur - 1) + '），后一个数是多少？' };
  }
  if (name.indexOf('比较') !== -1) {
    var a0 = ri(rng, 12, 98), b0 = a0 + ri(rng, 1, 9) * (rng() < 0.5 ? 1 : -1);
    if (b0 <= 10) b0 = a0 + 5;
    return { stem: '比较大小：' + Math.min(a0, b0) + ' ○ ' + Math.max(a0, b0) + '（参考：' + Math.max(a0, b0) + ' − ' + Math.min(a0, b0) + ' = ' + Math.abs(a0 - b0) + '）',
      answer: '<', options: ['>', '<', '='],
      apply: '一年级有 ' + Math.min(a0, b0) + ' 人，二年级有 ' + Math.max(a0, b0) + ' 人，' + Math.max(a0, b0) + ' − ' + Math.min(a0, b0) + ' = ' + Math.abs(a0 - b0) + '，哪个年级人数多（填 > 或 <）？' };
  }
  if (name.indexOf('组成') !== -1) {
    var t0 = ri(rng, 1, 9), o0 = ri(rng, 1, 9);
    return { stem: (t0 * 10 + o0) + ' 是由几个十和几个一组成的？（参考：' + t0 + ' × 10 + ' + o0 + ' = ' + (t0 * 10 + o0) + '）',
      answer: t0 + '个十和' + o0 + '个一', options: [t0 + '个十和' + o0 + '个一', o0 + '个十和' + t0 + '个一', '1个十和' + o0 + '个一'],
      apply: '小红有 ' + t0 + ' 捆（每捆10根）零 ' + o0 + ' 根小棒，' + t0 + ' × 10 + ' + o0 + ' = ' + (t0 * 10 + o0) + '，一共多少根，由几个十和几个一组成？' };
  }
  if (name.indexOf('算盘') !== -1) {
    
    var abPick = rng();
    if (abPick < 0.34) {
      return { stem: '算盘上一个上珠靠梁表示几？（参考：1 × 5 = 5）',
        answer: '5', options: ['5', '1', '10'],
        apply: '在算盘上拨数，1 个上珠靠梁，1 × 5 = 5，它表示数字几？' };
    }
    if (abPick < 0.67) {
      return { stem: '算盘上一个下珠靠梁表示几？（参考：1 × 1 = 1）',
        answer: '1', options: ['1', '5', '10'],
        apply: '在算盘上拨数，1 个下珠靠梁，1 × 1 = 1，它表示数字几？' };
    }
    return { stem: '算盘的十位上1个上珠靠梁、个位上2个下珠靠梁，表示的数是多少？（参考：5 × 10 + 2 = 52）',
      answer: '52', options: ['52', '25', '70'],
      apply: '算盘十位1个上珠靠梁表示5个十，个位2个下珠靠梁表示2个一，5 × 10 + 2 = ？，表示的数是多少？' };
  }
  
  var t1 = ri(rng, 1, 9), o1 = ri(rng, 1, 9);
  return { stem: '计数器十位 ' + t1 + ' 颗珠、个位 ' + o1 + ' 颗珠（' + t1 + ' × 10 + ' + o1 + ' = ' + (t1 * 10 + o1) + '），写作多少？',
    answer: String(t1 * 10 + o1), options: [String(t1 * 10 + o1), String(t1 + o1), String(o1 * 10 + t1)],
    apply: '数一数：十位拨 ' + t1 + ' 颗、个位拨 ' + o1 + ' 颗，' + t1 + ' × 10 + ' + o1 + ' = ？，这个数写作多少？' };
}

function buildNegativeItem(rng, name) {
  if (name.indexOf('数轴') !== -1) {
    var k0 = ri(rng, 2, 6);
    return { stem: '在数轴上，0 左边第 ' + k0 + ' 格表示什么数？（参考：0 − ' + k0 + ' = −' + k0 + '）',
      answer: '−' + k0, options: ['−' + k0, String(k0), '0'],
      apply: '温度计以 0℃ 为分界，0 − ' + k0 + ' = −' + k0 + '，数轴上 0 左边第 ' + k0 + ' 格是什么数？' };
  }
  if (name.indexOf('比较') !== -1) {
    var a1 = ri(rng, 2, 8), b1 = a1 + ri(rng, 1, 5);
    return { stem: '比较大小：−' + b1 + ' ○ −' + a1 + '（参考：' + b1 + ' − ' + a1 + ' = ' + (b1 - a1) + '，负号后越大数越小）',
      answer: '<', options: ['>', '<', '='],
      apply: '哈尔滨 −' + b1 + '℃，北京 −' + a1 + '℃，' + b1 + ' − ' + a1 + ' = ' + (b1 - a1) + '，哪里更冷，即 −' + b1 + ' ○ −' + a1 + '？' };
  }
  
  return { stem: '读出下面的数：−5 与 +8（参考：0 − 5 = −5），−5 读作什么？',
    answer: '负五', options: ['负五', '正五', '五'],
    apply: '存折上支出 5 元记作 −5（0 − 5 = −5），−5 应该怎样读？' };
}

function buildMultDivRelationItem(rng, name) {
  if (name.indexOf('平均分') !== -1) {
    var total0 = ri(rng, 2, 9) * ri(rng, 2, 9), groups0 = ri(rng, 2, 6);
    while (total0 % groups0 !== 0) total0 += 1;
    return { stem: '把 ' + total0 + ' 平均分成 ' + groups0 + ' 份，每份多少？（' + total0 + ' ÷ ' + groups0 + ' = ？）',
      answer: String(total0 / groups0), options: [String(total0 / groups0), String(groups0), String(total0)],
      apply: '把 ' + total0 + ' 块糖平均分给 ' + groups0 + ' 个小朋友，' + total0 + ' ÷ ' + groups0 + ' = ？，每人几块？' };
  }
  var a2 = ri(rng, 2, 9), b2 = ri(rng, 2, 9), p2 = a2 * b2;
  return { stem: '因为 ' + a2 + ' × ' + b2 + ' = ' + p2 + '，所以 ' + p2 + ' ÷ ' + a2 + ' = 多少？',
    answer: String(b2), options: [String(b2), String(a2), String(p2)],
    apply: '每盒有 ' + a2 + ' 支笔，' + b2 + ' 盒共 ' + p2 + ' 支（' + a2 + ' × ' + b2 + ' = ' + p2 + '）。反过来 ' + p2 + ' ÷ ' + a2 + ' = ？，是多少盒？' };
}

function buildAlgebraLetterItem(rng, name) {
  if (name.indexOf('数量关系') !== -1) {
    return { stem: '速度用 v 表示，时间用 t 表示，路程 s 等于什么？（参考：80 × 2 = 160）',
      answer: 's = v × t', options: ['s = v × t', 's = v + t', 's = v − t'],
      apply: '汽车每小时行 v 千米，行了 t 小时（如 80 × 2 = 160），路程 s 用字母怎样表示？' };
  }
  if (name.indexOf('值') !== -1) {
    var a3 = ri(rng, 2, 6), k3 = ri(rng, 2, 5);
    return { stem: '当 a = ' + a3 + ' 时，' + k3 + 'a + 1 = ' + k3 + ' × ' + a3 + ' + 1 = 多少？',
      answer: String(k3 * a3 + 1), options: [String(k3 * a3 + 1), String(k3 * a3), String(a3 + 1)],
      apply: '文具店有 a 盒彩笔，每盒 ' + k3 + ' 支还多 1 支样品。当 a = ' + a3 + ' 时，' + k3 + ' × ' + a3 + ' + 1 = ？，共多少支？' };
  }
  
  var d0 = ri(rng, 4, 20);
  return { stem: '小明今年 a 岁，爸爸比他大 ' + d0 + ' 岁。当 a = 10 时，10 + ' + d0 + ' = 多少，爸爸岁数用字母怎样表示？',
    answer: 'a + ' + d0 + '（岁）', options: ['a + ' + d0, 'a − ' + d0, 'a × ' + d0],
    apply: '小明今年 a 岁，爸爸比他大 ' + d0 + ' 岁（a = 10 时 10 + ' + d0 + ' = ' + (10 + d0) + '），爸爸的岁数用含字母的式子怎样表示？' };
}


function buildNumberTheoryItem(rng, name) {
  
  if (name.indexOf('奇偶性') !== -1 || name.indexOf('和的奇偶') !== -1) {
    var patterns = [
      { oddA: true, oddB: true, res: '偶数', rule: '奇数 + 奇数 = 偶数' },
      { oddA: false, oddB: false, res: '偶数', rule: '偶数 + 偶数 = 偶数' },
      { oddA: true, oddB: false, res: '奇数', rule: '奇数 + 偶数 = 奇数' }
    ];
    var pt = patterns[ri(rng, 0, patterns.length - 1)];
    var pa = pt.oddA ? ri(rng, 1, 9) * 2 - 1 : ri(rng, 1, 9) * 2;
    var pb = pt.oddB ? ri(rng, 1, 9) * 2 - 1 : ri(rng, 1, 9) * 2;
    var ps = pa + pb;
    return { stem: pt.rule + '：' + pa + ' + ' + pb + ' = ' + ps + '，' + pa + ' 与 ' + pb + ' 的和是奇数还是偶数？',
      answer: pt.res, options: ['偶数', '奇数', '无法确定'],
      apply: '两队人数分别是 ' + pa + ' 和 ' + pb + '（' + pt.rule + '），' + pa + ' + ' + pb + ' = ' + ps + '，两队合并后的总人数是奇数还是偶数？' };
  }
  
  if (name.indexOf('质数') !== -1 || name.indexOf('合数') !== -1) {
    var primes = [7, 11, 13, 17, 19];
    var composites = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20];
    var pn = primes[ri(rng, 0, primes.length - 1)];
    var pool = composites.slice();
    var d1 = pool.splice(ri(rng, 0, pool.length - 1), 1)[0];
    var d2 = pool.splice(ri(rng, 0, pool.length - 1), 1)[0];
    return { stem: '一个数只有 1 和它本身两个因数就是质数：1 × ' + pn + ' = ' + pn + '。下面哪个数是质数？',
      answer: String(pn), options: [String(pn), String(d1), String(d2)],
      apply: '分糖果时，合数能平均分给多于一个小组（如 3 × 3 = 9），质数不能。糖果数 ' + pn + '（1 × ' + pn + ' = ' + pn + '）能分成人数相同且多于1人的小组吗，它是质数还是合数？' };
  }
  
  if (name.indexOf('奇数') !== -1 || name.indexOf('偶数') !== -1) {
    var en = ri(rng, 2, 24) * 2;
    var askEven = rng() < 0.5;
    if (askEven) {
      return { stem: '2 的倍数是偶数：' + en + ' ÷ 2 = ' + (en / 2) + '。下面哪个数是偶数？',
        answer: String(en), options: [String(en), String(en + 1), String(en + 3)],
        apply: '门牌号按单双号排列，' + en + ' ÷ 2 = ' + (en / 2) + ' 没有余数，' + en + ' 号是奇数还是偶数？' };
    }
    var on = ri(rng, 2, 24) * 2 - 1;
    return { stem: '不是 2 的倍数的数是奇数，如 ' + on + ' ÷ 2 = ' + ((on - 1) / 2) + '……1。下面哪个数是奇数？',
      answer: String(on), options: [String(on), String(on + 1), String(on - 1)],
      apply: '报数时逢双数蹲下，' + on + ' ÷ 2 余 1 不能整除，' + on + ' 号同学该蹲下吗，' + on + ' 是奇数还是偶数？' };
  }
  
  var feats = [
    { f: 2, text: '个位上是 0、2、4、6、8', build: function () { var x = ri(rng, 6, 49) * 2; return x; },
      bad: function (x) { var b = x + (rng() < 0.5 ? 1 : -1); return b % 2 === 0 ? b + 1 : b; } },
    { f: 5, text: '个位上是 0 或 5', build: function () { return ri(rng, 2, 19) * 5; },
      bad: function (x) { var b = x + (rng() < 0.5 ? 1 : -1); return b % 5 === 0 ? b + 1 : b; } },
    { f: 3, text: '各位上数字之和是 3 的倍数', build: function () {
        for (var t = 0; t < 30; t++) { var x = ri(rng, 12, 99); var s = Math.floor(x / 10) + x % 10; if (s % 3 === 0) return x; }
        return 12;
      }, bad: function (x) {
        for (var t = 0; t < 30; t++) { var b = ri(rng, 12, 99); var s = Math.floor(b / 10) + b % 10; if (s % 3 !== 0 && b !== x) return b; }
        return x + 1;
      } }
  ];
  var ft = feats[ri(rng, 0, 2)];
  var fn = ft.build();
  var fd1 = ft.bad(fn), fd2 = ft.bad(fn);
  while (fd2 === fd1 || fd2 === fn) fd2 = ft.bad(fn);
  var fsum = Math.floor(fn / 10) + fn % 10;
  var fref = ft.f === 3 ? '（数字和 ' + fsum + '，' + fsum + ' ÷ 3 = ' + (fsum / 3) + '）'
    : '（参考：' + fn + ' ÷ ' + ft.f + ' = ' + (fn / ft.f) + '）';
  return { stem: ft.text + ' 的数是 ' + ft.f + ' 的倍数' + fref + '。下面哪个数是 ' + ft.f + ' 的倍数？',
    answer: String(fn), options: [String(fn), String(fd1), String(fd2)],
    apply: '体育分组每组 ' + ft.f + ' 人正好分完，人数须是 ' + ft.f + ' 的倍数。班级人数 ' + fn + fref + '，哪个班能正好分完？' };
}


function makeByItem(plan, context, i, builder, subType) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var params = plan.semanticParams || {};
  var item = builder(rng, params.name || '');
  var qt = plan.questionTypeId;
  var q = buildBase(plan, context, i, { subType: subType });
  var stem = item.stem, answer = item.answer;
  if (qt === 'apply') stem = item.apply || item.stem;
  if (qt === 'fill') {
    stem = stem.replace('多少？', '____').replace('什么？', '____').replace('？', '____');
    if (!/____|\(\s*\)/.test(stem)) stem += ' ____';
  }
  if (qt === 'choice') {
    finishChoice(q, rng, item.answer, item.options.filter(function (o) { return o !== item.answer; }));
    q.prompt = stem;
    return q;
  }
  return finish(q, stem, answer, [answer], stem.replace(/（参考.*?）/, ''));
}

function makeNumberConcept(plan, context, i) { return makeByItem(plan, context, i, buildNumberConceptItem, 'number-concept'); }
function makeNegativeNumber(plan, context, i) { return makeByItem(plan, context, i, buildNegativeItem, 'negative-number'); }
function makeMultDivRelation(plan, context, i) { return makeByItem(plan, context, i, buildMultDivRelationItem, 'multdiv-relation'); }
function makeAlgebraLetter(plan, context, i) { return makeByItem(plan, context, i, buildAlgebraLetterItem, 'algebra-letter'); }
function makeNumberTheory(plan, context, i) { return makeByItem(plan, context, i, buildNumberTheoryItem, 'number-theory'); }

var P25_09_SUBTOPIC_QTS = ['calc', 'fill', 'apply', 'choice'];
function bindP2509(fn) {
  var row = {};
  P25_09_SUBTOPIC_QTS.forEach(function (qt) { row[qt] = fn; });
  return row;
}



var SUBTOPIC_MAKERS = {
  'times-concept': { calc: makeTimesCalc, fill: makeTimesFill, apply: makeTimesApply, choice: makeTimesChoice },
  'fraction-meaning': { calc: makeFractionCalc, fill: makeFractionFill, apply: makeFractionApply, choice: makeFractionChoice },
  'angle-concept': { fill: makeAngleFill, apply: makeAngleApply, choice: makeAngleChoice, geometry: makeAngleGeometry, judge: makeAngleJudge },
  'area-concept': { fill: makeAreaFill, apply: makeAreaApply, choice: makeAreaChoice, geometry: makeAreaGeometry, judge: makeAreaJudge },
  
  'number-concept': bindP2509(makeNumberConcept),
  'negative-number': bindP2509(makeNegativeNumber),
  'multdiv-relation': bindP2509(makeMultDivRelation),
  'algebra-letter': bindP2509(makeAlgebraLetter),
  'number-theory': bindP2509(makeNumberTheory)
};


function paramsOf(plan) {
  if (plan && plan.semanticParams) return plan.semanticParams;
  var kpId = pkp(plan);
  if (!kpId) return null;
  return SemanticParameters.resolve(kpId, plan && (plan.questionTypeId || plan.questionType));
}

function createConceptMeaningGenerator(spec) {
  spec = spec || {};
  return {
    id: spec.id || 'generator:concept-meaning',
    subject: 'math',
    capabilities: ['calc', 'fill', 'apply', 'choice', 'geometry', 'judge'],
    questionTypes: ['calc', 'fill', 'apply', 'choice', 'geometry', 'judge'],
    
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return ['calc', 'fill', 'apply', 'choice', 'geometry', 'judge'].indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      var count = (plan && plan.count) || 1;
      var params = paramsOf(plan);
      var row = params ? SUBTOPIC_MAKERS[params.subTopic] : null;
      var maker = row && row[plan.questionTypeId];
      
      if (!maker) return [];
      var out = [];
      for (var i = 0; i < count; i++) out.push(maker(plan, context, i));
      return out;
    }
  };
}

function buildAll() {
  return [createConceptMeaningGenerator()];
}

module.exports = {
  createConceptMeaningGenerator: createConceptMeaningGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/semantic-relations.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");
var SemanticParameters = require("shared/generator/core/semantic-parameters.js");

var QTYPES = ['calc', 'fill', 'apply', 'choice', 'geometry'];

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':' + i;
  if (plan && plan.seed != null) return plan.seed + ':' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
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
    numberRange: constraints.numberRange || { min: 1, max: 100 },
    spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
    context: plan.contextType != null ? plan.contextType : 'standard',
    seed: seedFor(plan, context, i),
    prompt: '',
    answer: null,
    answerMode: 'input',
    hint: null,
    data: Object.assign({ mode: 'semantic-relations' }, extra || {})
  };
}

function finish(q, prompt, answer, acceptable, explanation) {
  q.prompt = prompt;
  q.answer = {
    value: String(answer),
    acceptable: acceptable || [],
    explanation: explanation || (prompt.replace(/[？?]\s*$/, '') + ' = ' + answer)
  };
  return q;
}


function finishChoice(q, rng, correct, wrongs) {
  var seen = {}, pool = [];
  [correct].concat(wrongs).forEach(function (o) {
    o = String(o);
    if (!seen[o]) { seen[o] = 1; pool.push(o); }
  });
  while (pool.length < 4) {
    var filler = '都不对（' + pool.length + '）';
    if (!seen[filler]) { seen[filler] = 1; pool.push(filler); }
  }
  pool = pool.slice(0, 4);
  var options = Rng.shuffle(rng, pool);
  q.data.options = options;
  q.data.correctIndex = options.indexOf(String(correct));
  return finish(q, q.prompt, String(correct), [], null);
}



function makeAddRelCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var take = Rng.randInt(rng, 2, 9);
  var left = Rng.randInt(rng, 2, 9);
  var subtract = (i % 2 === 0);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation',
    operation: subtract ? 'sub' : 'add',
    barModel: true
  });
  if (subtract) {
    return finish(q, '看图列式：盘子里原来有 ' + (take + left) + ' 个桃，小猴子吃掉 ' + take
      + ' 个（在图中圈出吃掉的部分）。还剩多少个？', left, [],
      '总数 − 吃掉的部分 = 剩下的部分：' + (take + left) + ' − ' + take + ' = ' + left);
  }
  return finish(q, '看图列式：草地上左边有 ' + left + ' 只羊，右边又来了 ' + take
    + ' 只羊（在图中画出两部分）。一共有多少只羊？', take + left, [],
    '两部分合起来：' + left + ' + ' + take + ' = ' + (take + left));
}

function makeAddRelFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var a = Rng.randInt(rng, 3, 9);
  var b = Rng.randInt(rng, 3, 9);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation', operation: 'add', barModel: true
  });
  return finish(q, '看线段图填空：第一条线段表示 ' + a + '，第二条线段表示 ' + b
    + '，两条线段合起来表示（  ）。', a + b, [String(a + b)],
    a + ' + ' + b + ' = ' + (a + b));
}

function makeAddRelApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.randInt(rng, 5, 12);
  var diff = Rng.randInt(rng, 2, 8);
  var more = (i % 2 === 0);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation',
    operation: more ? 'add' : 'sub',
    barModel: true,
    comparison: more ? 'more' : 'less'
  });
  if (more) {
    return finish(q, '先画一画，再列式：小红有 ' + base + ' 朵小红花，小丽比小红多 ' + diff
      + ' 朵。小丽有多少朵？', base + diff, [String(base + diff)],
      '小红的朵数 + 多出来的部分 = 小丽的朵数：' + base + ' + ' + diff + ' = ' + (base + diff));
  }
  return finish(q, '先画一画，再列式：小红有 ' + (base + diff) + ' 朵小红花，小丽比小红少 ' + diff
    + ' 朵。小丽有多少朵？', base, [String(base)],
    '小红的朵数 − 少的部分 = 小丽的朵数：' + (base + diff) + ' − ' + diff + ' = ' + base);
}

function makeAddRelChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var a = Rng.randInt(rng, 4, 9);
  var b = Rng.randInt(rng, 4, 9);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation', operation: 'add', barModel: true
  });
  q.prompt = '线段图把总数分成两部分：第一部分是 ' + a + '，第二部分是 ' + b
    + '。求总数应该用下面哪个算式？（  ）';
  return finishChoice(q, rng, a + ' + ' + b,
    [a + ' − ' + b, b + ' − ' + a, a + ' × ' + b]);
}

function makeAddRelGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var a = Rng.randInt(rng, 4, 9);
  var longer = Rng.randInt(rng, 2, 6);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation', operation: 'add', barModel: true
  });
  return finish(q, '看线段图：第一条线段表示 ' + a + '，第二条线段比第一条长 ' + longer
    + '（在图上标出长出来的那一段）。第二条线段表示多少？', a + longer, [String(a + longer)],
    '第一条 + 长出的部分 = 第二条：' + a + ' + ' + longer + ' = ' + (a + longer));
}



var PATTERN_SHAPES = ['△', '○', '□', '☆'];

function patternPick(rng) {
  var n = Rng.randInt(rng, 2, 4);
  var shapes = Rng.shuffle(rng, PATTERN_SHAPES).slice(0, n);
  var period = Rng.randInt(rng, 7, 30);
  var rem = period % n;
  var shape = rem === 0 ? shapes[n - 1] : shapes[rem - 1];
  var quotient = Math.floor(period / n);
  return { n: n, shapes: shapes, period: period, rem: rem, shape: shape, quotient: quotient };
}

function makePeriodCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var p = patternPick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: p.n, periodPosition: p.period, remainder: p.rem
  });
  return finish(q, '图形按「' + p.shapes.join('') + '」为一组重复排列。要确定第 ' + p.period
    + ' 个图形是什么，列式 ' + p.period + ' ÷ ' + p.n + ' 的余数是几？（只填余数）',
    p.rem, [String(p.rem)],
    p.period + ' ÷ ' + p.n + ' = ' + p.quotient + '……' + p.rem
      + (p.rem === 0 ? '，余数为 0 对应每组最后一个图形「' + p.shape + '」'
        : '，余数 ' + p.rem + ' 对应每组第 ' + p.rem + ' 个图形「' + p.shape + '」'));
}

function makePeriodFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var p = patternPick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: p.n, periodPosition: p.period, remainder: p.rem
  });
  return finish(q, '图形按「' + p.shapes.join('') + '」为一组重复排列，第 ' + p.period
    + ' 个图形是（  ）。', p.shape, [p.shapes],
    p.period + ' ÷ ' + p.n + ' = ' + p.quotient + '……' + p.rem
      + '，余数 ' + (p.rem === 0 ? '0（取末位）' : p.rem) + ' → 「' + p.shape + '」');
}

function makePeriodApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var items = [['红旗', '黄旗', '蓝旗'], ['红花', '黄花', '蓝花'], ['红灯笼', '黄灯笼', '蓝灯笼']];
  var set = Rng.pick(rng, items);
  var n = set.length;
  var k = Rng.randInt(rng, 10, 40);
  var rem = k % n;
  var which = rem === 0 ? set[n - 1] : set[rem - 1];
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: n, periodPosition: k, remainder: rem
  });
  return finish(q, '学校大门前按「' + set.join('、') + '」的顺序循环挂彩旗，第 ' + k
    + ' 面彩旗是什么颜色？', which, [which],
    k + ' ÷ ' + n + ' = ' + Math.floor(k / n) + '……' + rem
      + '，余数 ' + (rem === 0 ? '0（取每组最后）' : rem) + ' → ' + which);
}

function makePeriodChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var p = patternPick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: p.n, periodPosition: p.period, remainder: p.rem
  });
  q.prompt = '图形按「' + p.shapes.join('') + '」为一组重复排列，第 ' + p.period
    + ' 个图形是哪个？（  ）';
  var distractors = PATTERN_SHAPES.filter(function (s) { return s !== p.shape; }).slice(0, 3);
  return finishChoice(q, rng, p.shape, distractors);
}

function makePeriodGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var p = patternPick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: p.n, periodPosition: p.period, remainder: p.rem,
    graphicPattern: p.shapes.join('')
  });
  return finish(q, '观察排列图：' + p.shapes.join('') + p.shapes.join('') + '……'
    + '照这样接着画，第 ' + p.period + ' 个位置应该画什么图形？', p.shape, [p.shape],
    '每 ' + p.n + ' 个一组，' + p.period + ' ÷ ' + p.n + ' 余 '
      + (p.rem === 0 ? '0（末位）' : p.rem) + ' → 「' + p.shape + '」');
}



var SCALE_SIDES = [2, 3, 4, 5, 6];

function scalePick(rng) {
  var enlarge = Rng.randInt(rng, 0, 1) === 0;
  var k = Rng.randInt(rng, 2, 3);
  
  var orig = enlarge ? Rng.pick(rng, SCALE_SIDES) : Rng.pick(rng, SCALE_SIDES) * k;
  var next = enlarge ? orig * k : orig / k;
  return { enlarge: enlarge, k: k, orig: orig, next: next };
}

function makeScaleCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = scalePick(rng);
  var ratio = s.enlarge ? (s.k + ':1') : ('1:' + s.k);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-transform', scaleRatio: ratio,
    fromLength: s.orig, toLength: s.next
  });
  return finish(q, '列式计算：一个长方形的长是 ' + s.orig + ' 厘米，按 ' + ratio
    + ' 的比' + (s.enlarge ? '放大' : '缩小') + '。列式：' + s.orig + (s.enlarge ? ' × ' : ' ÷ ') + s.k + ' = ？（厘米）',
    s.next, [String(s.next)],
    (s.enlarge ? '放大到 ' + s.k + ' 倍：' : '缩小到 1/' + s.k + '：')
      + s.orig + (s.enlarge ? ' × ' : ' ÷ ') + s.k + ' = ' + s.next + ' 厘米');
}

function makeScaleFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = scalePick(rng);
  var ratio = s.enlarge ? (s.k + ':1') : ('1:' + s.k);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-transform', scaleRatio: ratio,
    fromLength: s.orig, toLength: s.next
  });
  return finish(q, '把一个边长 ' + s.orig + ' 厘米的正方形按 ' + ratio + ' 的比'
    + (s.enlarge ? '放大' : '缩小') + '，变换后正方形的边长是（  ）厘米。', s.next, [String(s.next)],
    s.orig + (s.enlarge ? ' × ' : ' ÷ ') + s.k + ' = ' + s.next);
}

function makeScaleApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = scalePick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-transform',
    scaleRatio: s.enlarge ? (s.k + ':1') : ('1:' + s.k),
    fromLength: s.orig, toLength: s.next
  });
  if (s.enlarge) {
    return finish(q, '一张小卡片长 ' + s.orig + ' 厘米，照相馆按 ' + s.k + ':1 的比把图案放大印成海报，'
      + '海报上的图案长多少厘米？', s.next, [String(s.next)],
      '放大到 ' + s.k + ' 倍：' + s.orig + ' × ' + s.k + ' = ' + s.next + ' 厘米');
  }
  return finish(q, '一张建筑设计图上某段长 ' + s.orig + ' 厘米，施工时要按 1:' + s.k
    + ' 的比缩小制作模型，模型上这段长多少厘米？', s.next, [String(s.next)],
    '缩小到 1/' + s.k + '：' + s.orig + ' ÷ ' + s.k + ' = ' + s.next + ' 厘米');
}

function makeScaleChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = scalePick(rng);
  var ratio = s.enlarge ? (s.k + ':1') : ('1:' + s.k);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-transform', scaleRatio: ratio,
    fromLength: s.orig, toLength: s.next
  });
  q.prompt = '一个图形按 ' + ratio + ' 的比' + (s.enlarge ? '放大' : '缩小')
    + '，原长 ' + s.orig + ' 厘米，变换后的长是多少厘米？（  ）';
  return finishChoice(q, rng, String(s.next),
    [String(s.orig), String(s.next + s.k), String(Math.max(1, s.next - 1))]);
}

function makeScaleGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = scalePick(rng);
  var ratio = s.enlarge ? (s.k + ':1') : ('1:' + s.k);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-transform', scaleRatio: ratio,
    fromLength: s.orig, toLength: s.next, gridFigure: true
  });
  return finish(q, '方格图上一个长方形的长占 ' + s.orig + ' 格，把图形按 ' + ratio
    + ' 的比' + (s.enlarge ? '放大' : '缩小') + '后，长应占多少格？', s.next, [String(s.next)],
    '图形' + (s.enlarge ? '放大' : '缩小') + '后形状不变，长' + (s.enlarge ? '扩大' : '缩小')
      + '到原来的' + (s.enlarge ? s.k + ' 倍' : '1/' + s.k) + '：' + s.next + ' 格');
}



function makePropCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  
  var unit = Rng.pick(rng, [2, 3, 4, 5, 6, 8]);
  var a = Rng.randInt(rng, 2, 6);
  var b = Rng.randInt(rng, 2, 9);
  var q = buildBase(plan, context, i, {
    subTopic: 'proportion-application', proportion: 'direct',
    unitPrice: unit, quantityA: a, quantityB: b
  });
  return finish(q, '列式计算：买 ' + a + ' 支同样的钢笔要用 ' + (a * unit)
    + ' 元，买 ' + b + ' 支这样的钢笔要用多少元？列式：' + (a * unit) + ' ÷ ' + a + ' × ' + b + ' = ？（元）',
    b * unit, [String(b * unit)],
    '先求单价（归一）：' + (a * unit) + ' ÷ ' + a + ' = ' + unit + ' 元；'
      + b + ' × ' + unit + ' = ' + (b * unit) + ' 元');
}

function makePropFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  
  var speed = Rng.pick(rng, [40, 50, 60, 70, 80]);
  var t1 = Rng.randInt(rng, 2, 4);
  var t2 = Rng.randInt(rng, 5, 9);
  var q = buildBase(plan, context, i, {
    subTopic: 'proportion-application', proportion: 'direct',
    speed: speed, hoursA: t1, hoursB: t2
  });
  return finish(q, '一辆汽车 ' + t1 + ' 小时行驶了 ' + (speed * t1)
    + ' 千米。照这样的速度，' + t2 + ' 小时能行驶（  ）千米。', speed * t2, [String(speed * t2)],
    '速度一定，路程与时间成正比例：速度 ' + speed + ' 千米/时，' + t2 + ' × ' + speed
      + ' = ' + (speed * t2) + ' 千米');
}

function makePropApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  
  var rows2Choices = [
    { per1: 20, rows1: 12, per2: 24 },
    { per1: 15, rows1: 16, per2: 20 },
    { per1: 12, rows1: 15, per2: 18 },
    { per1: 25, rows1: 12, per2: 20 }
  ];
  var c = Rng.pick(rng, rows2Choices);
  var total = c.per1 * c.rows1;
  var rows2 = total / c.per2;
  var q = buildBase(plan, context, i, {
    subTopic: 'proportion-application', proportion: 'inverse',
    total: total, perRowA: c.per1, rowsA: c.rows1, perRowB: c.per2
  });
  return finish(q, '同学们排队做操，每行站 ' + c.per1 + ' 人，正好站 ' + c.rows1
    + ' 行。如果每行站 ' + c.per2 + ' 人，可以站多少行？', rows2, [String(rows2)],
    '总人数一定，每行人数与行数成反比例：' + c.per1 + ' × ' + c.rows1 + ' = ' + total
      + '（人），' + total + ' ÷ ' + c.per2 + ' = ' + rows2 + ' 行');
}

function makePropChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var unit = Rng.pick(rng, [3, 4, 5, 6]);
  var a = Rng.randInt(rng, 2, 5);
  var b = Rng.randInt(rng, 6, 9);
  var q = buildBase(plan, context, i, {
    subTopic: 'proportion-application', proportion: 'direct',
    unitPrice: unit, quantityA: a, quantityB: b
  });
  q.prompt = '买 ' + a + ' 千克苹果付了 ' + (a * unit) + ' 元，买 ' + b
    + ' 千克同样的苹果要付多少元？（  ）';
  return finishChoice(q, rng, String(b * unit) + ' 元',
    [String((a * unit) + b) + ' 元', String(a * b) + ' 元', String(a + b + unit) + ' 元']);
}

function makePropGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  
  var pairs = [
    { h1: 2, s1: 3, s2: 15 },
    { h1: 2, s1: 4, s2: 20 },
    { h1: 3, s1: 2, s2: 12 },
    { h1: 4, s1: 3, s2: 18 }
  ];
  var c = Rng.pick(rng, pairs);
  var h2 = c.h1 * c.s2 / c.s1;
  var q = buildBase(plan, context, i, {
    subTopic: 'proportion-application', proportion: 'direct',
    poleHeight: c.h1, poleShadow: c.s1, treeShadow: c.s2
  });
  return finish(q, '看示意图：同一时刻，一根 ' + c.h1 + ' 米长的竹竿影长是 ' + c.s1
    + ' 米，旁边一棵树的影长是 ' + c.s2 + ' 米。这棵树高多少米？', h2, [String(h2)],
    '同一时刻物高与影长成正比例：' + c.h1 + ':' + c.s1 + ' = 树高:' + c.s2
      + '，树高 = ' + c.h1 + ' × ' + c.s2 + ' ÷ ' + c.s1 + ' = ' + h2 + ' 米');
}



var MAP_SCALES = [
  { label: '1:5000', factor: 5000 },
  { label: '1:10000', factor: 10000 },
  { label: '1:20000', factor: 20000 },
  { label: '1:50000', factor: 50000 }
];

function mapPick(rng) {
  var s = Rng.pick(rng, MAP_SCALES);
  var mapCm = Rng.randInt(rng, 2, 9);
  var realCm = mapCm * s.factor;
  return { label: s.label, factor: s.factor, mapCm: mapCm, realCm: realCm, realM: realCm / 100 };
}

function makeMapCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var m = mapPick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-map', scaleLabel: m.label, mapDistanceCm: m.mapCm, realDistanceM: m.realM
  });
  if (i % 2 === 0) {
    return finish(q, '列式计算：一幅地图的比例尺是 ' + m.label + '，量得两地间的图上距离是 ' + m.mapCm
      + ' 厘米。列式求实际距离：' + m.mapCm + ' × ' + m.factor + ' = ' + m.realCm + '（厘米）= ？（米）',
      m.realM, [String(m.realM)],
      '实际距离 = 图上距离 × 比例尺后项：' + m.mapCm + ' × ' + m.factor + ' = ' + m.realCm + ' 厘米 = ' + m.realM + ' 米');
  }
  return finish(q, '列式计算：一幅地图的比例尺是 ' + m.label + '，两地实际相距 ' + m.realM
    + ' 米（' + m.realCm + ' 厘米）。列式求图上距离：' + m.realCm + ' ÷ ' + m.factor + ' = ？（厘米）',
    m.mapCm, [String(m.mapCm)],
    '图上距离 = 实际距离 ÷ 比例尺后项：' + m.realCm + ' ÷ ' + m.factor + ' = ' + m.mapCm + ' 厘米');
}

function makeMapFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var m = mapPick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-map', scaleLabel: m.label, mapDistanceCm: m.mapCm, realDistanceM: m.realM
  });
  if (i % 2 === 0) {
    return finish(q, '在比例尺是 ' + m.label + ' 的地图上，量得两地间的图上距离是 ' + m.mapCm
      + ' 厘米，两地的实际距离是（  ）米。', m.realM, [String(m.realM)],
      m.mapCm + ' × ' + m.factor + ' = ' + m.realCm + ' 厘米 = ' + m.realM + ' 米');
  }
  return finish(q, '在比例尺是 ' + m.label + ' 的地图上，实际距离 ' + m.realM + ' 米（' + m.realCm
    + ' 厘米）的两地，图上距离是（  ）厘米。', m.mapCm, [String(m.mapCm)],
    m.realCm + ' ÷ ' + m.factor + ' = ' + m.mapCm + ' 厘米');
}

function makeMapApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var m = mapPick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-map', scaleLabel: m.label, mapDistanceCm: m.mapCm, realDistanceM: m.realM
  });
  var places = Rng.pick(rng, [['学校', '少年宫'], ['公园', '图书馆'], ['小明家', '汽车站']]);
  return finish(q, '小明要从' + places[0] + '走到' + places[1] + '，他在比例尺为 ' + m.label
    + ' 的地图上量得两地相距 ' + m.mapCm + ' 厘米。照这样计算，' + places[0] + '到' + places[1]
    + '实际要走多少米？', m.realM, [String(m.realM)],
    '实际距离 ' + m.mapCm + ' × ' + m.factor + ' = ' + m.realCm + ' 厘米 = ' + m.realM + ' 米');
}

function makeMapChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var m = mapPick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-map', scaleLabel: m.label, mapDistanceCm: m.mapCm, realDistanceM: m.realM
  });
  q.prompt = '一幅地图的比例尺是 ' + m.label + '，图上距离 ' + m.mapCm + ' 厘米表示的实际距离是多少米？（  ）';
  var wrongs = [m.realM + m.factor / 100, m.realM + 100, m.mapCm * m.factor];
  return finishChoice(q, rng, String(m.realM), wrongs.map(String));
}



function ratioName(plan) {
  var p = plan && plan.semanticParams;
  return p && p.name ? p.name : '';
}


function equalRatiosPick(rng) {
  var pairs = [[1, 2], [1, 3], [2, 3], [3, 4], [2, 5]];
  var base = Rng.pick(rng, pairs);
  var r = Rng.randInt(rng, 2, 4);
  var s;
  do { s = Rng.randInt(rng, 2, 4); } while (s === r);
  return { a: base[0] * r, b: base[1] * r, c: base[0] * s, d: base[1] * s };
}


function solveRatioPick(rng) {
  for (var t = 0; t < 40; t++) {
    var x = Rng.randInt(rng, 2, 6);
    var d = Rng.randInt(rng, 2, 9);
    var c = Rng.randInt(rng, 2, 6);
    if ((x * d) % c === 0) {
      var b = x * d / c;
      if (b >= 2 && b <= 9) return { x: x, b: b, c: c, d: d };
    }
  }
  return { x: 4, b: 6, c: 2, d: 3 };
}

function makeRatioCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = ratioName(plan);
  if (name.indexOf('基本性质') !== -1) {
    if (i % 2 === 0) {
      var s = solveRatioPick(rng);
      var q0 = buildBase(plan, context, i, {
        subTopic: 'ratio-basics', aspect: 'solve', unknown: s.x
      });
      return finish(q0, '列式计算：解比例 x∶' + s.b + ' = ' + s.c + '∶' + s.d + '。根据比例的基本性质，'
        + 'x × ' + s.d + ' = ' + s.b + ' × ' + s.c + ' = ' + (s.b * s.c) + '，x = ' + (s.b * s.c) + ' ÷ ' + s.d + ' = ？',
        s.x, [String(s.x)],
        '内项积 = 外项积：x = ' + s.b + ' × ' + s.c + ' ÷ ' + s.d + ' = ' + s.x);
    }
    var e = equalRatiosPick(rng);
    var q1 = buildBase(plan, context, i, {
      subTopic: 'ratio-basics', aspect: 'property'
    });
    return finish(q1, '列式计算：在比例 ' + e.a + '∶' + e.b + ' = ' + e.c + '∶' + e.d
      + ' 中，两个外项的积是多少？列式：' + e.a + ' × ' + e.d + ' = ？',
      e.a * e.d, [String(e.a * e.d)],
      '外项积 = 内项积：' + e.a + ' × ' + e.d + ' = ' + e.b + ' × ' + e.c + ' = ' + (e.a * e.d));
  }
  
  var p = equalRatiosPick(rng);
  var q2 = buildBase(plan, context, i, { subTopic: 'ratio-basics', aspect: 'meaning' });
  return finish(q2, '列式计算：判断 ' + p.a + '∶' + p.b + ' 和 ' + p.c + '∶' + p.d
    + ' 能否组成比例。检验：' + p.a + ' × ' + p.d + ' = ' + (p.a * p.d) + '，' + p.b + ' × ' + p.c + ' = '
    + (p.b * p.c) + '，积相等，填「能」或「不能」。',
    '能', ['能'],
    '比值相等（' + p.a + '/' + p.b + ' = ' + p.c + '/' + p.d + '），可以组成比例');
}

function makeRatioFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = ratioName(plan);
  var s = solveRatioPick(rng);
  if (name.indexOf('基本性质') !== -1 && i % 2 === 1) {
    var e = equalRatiosPick(rng);
    var q0 = buildBase(plan, context, i, { subTopic: 'ratio-basics', aspect: 'property' });
    return finish(q0, '在比例 ' + e.a + '∶' + e.b + ' = ' + e.c + '∶' + e.d + ' 中（' + e.a + ' × ' + e.d
      + ' = ' + (e.a * e.d) + '），两个内项的积是（  ）。', e.b * e.c, [String(e.b * e.c)],
      '内项积 = 外项积 = ' + (e.a * e.d));
  }
  var q1 = buildBase(plan, context, i, { subTopic: 'ratio-basics', aspect: 'solve', unknown: s.x });
  return finish(q1, '根据比例的基本性质填空：x∶' + s.b + ' = ' + s.c + '∶' + s.d + '，'
    + 'x × ' + s.d + ' = ' + s.b + ' × ' + s.c + ' = ' + (s.b * s.c) + '，x =（  ）。',
    s.x, [String(s.x)], 'x = ' + s.b + ' × ' + s.c + ' ÷ ' + s.d + ' = ' + s.x);
}

function makeRatioApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  
  var scenarios = [
    { a: 3, b: 2, c: 9, label: '国旗长与宽的比是 3∶2，一面国旗长 9 分米', ask: '宽应该是多少分米', unit: '分米' },
    { a: 1, b: 4, c: 6, label: '调蜂蜜水时蜂蜜与水的比是 1∶4，放了 6 份蜂蜜', ask: '需要加同样份数的水多少份', unit: '份' },
    { a: 2, b: 3, c: 8, label: '配制盐水时盐与水的比是 2∶3，用了 8 克盐', ask: '需要加水多少克', unit: '克' }
  ];
  var c0 = Rng.pick(rng, scenarios);
  var x = c0.b * c0.c / c0.a;
  var q = buildBase(plan, context, i, {
    subTopic: 'ratio-basics', aspect: 'apply-solve', ratioA: c0.a, ratioB: c0.b, given: c0.c
  });
  return finish(q, c0.label + '（' + c0.a + '∶' + c0.b + ' = ' + c0.c + '∶x）。按照这个比，' + c0.ask + '？'
    + '列式 ' + c0.a + ' × x = ' + c0.b + ' × ' + c0.c + ' = ' + (c0.b * c0.c) + '，x = ？',
    x, [String(x)],
    '解比例：x = ' + c0.b + ' × ' + c0.c + ' ÷ ' + c0.a + ' = ' + x + c0.unit);
}

function makeRatioChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = ratioName(plan);
  if (name.indexOf('基本性质') !== -1) {
    var s = solveRatioPick(rng);
    var q0 = buildBase(plan, context, i, { subTopic: 'ratio-basics', aspect: 'solve', unknown: s.x });
    q0.prompt = '根据比例的基本性质解比例 x∶' + s.b + ' = ' + s.c + '∶' + s.d
      + '（x × ' + s.d + ' = ' + s.b + ' × ' + s.c + '），x = ？（  ）';
    return finishChoice(q0, rng, String(s.x), [String(s.x + 1), String(Math.max(1, s.x - 1)), String(s.c)]);
  }
  var p = equalRatiosPick(rng);
  var q1 = buildBase(plan, context, i, { subTopic: 'ratio-basics', aspect: 'meaning' });
  q1.prompt = '下面哪组中的两个比可以组成比例？（提示：' + p.a + ' × ' + p.d + ' = ' + (p.a * p.d)
    + '，' + p.b + ' × ' + p.c + ' = ' + (p.b * p.c) + '）（  ）';
  var correct = p.a + '∶' + p.b + ' 和 ' + p.c + '∶' + p.d;
  var wrongs = [
    p.a + '∶' + p.b + ' 和 ' + (p.c + 1) + '∶' + p.d,
    p.a + '∶' + (p.b + 1) + ' 和 ' + p.c + '∶' + p.d,
    (p.a + 1) + '∶' + p.b + ' 和 ' + p.c + '∶' + p.d
  ];
  return finishChoice(q1, rng, correct, wrongs);
}



var SUBTOPIC_MAKERS = {
  'pictorial-additive-relation': {
    calc: makeAddRelCalc, fill: makeAddRelFill, apply: makeAddRelApply,
    choice: makeAddRelChoice, geometry: makeAddRelGeometry
  },
  'periodic-pattern': {
    calc: makePeriodCalc, fill: makePeriodFill, apply: makePeriodApply,
    choice: makePeriodChoice, geometry: makePeriodGeometry
  },
  'scale-transform': {
    calc: makeScaleCalc, fill: makeScaleFill, apply: makeScaleApply,
    choice: makeScaleChoice, geometry: makeScaleGeometry
  },
  'proportion-application': {
    calc: makePropCalc, fill: makePropFill, apply: makePropApply,
    choice: makePropChoice, geometry: makePropGeometry
  },
  
  'scale-map': {
    calc: makeMapCalc, fill: makeMapFill, apply: makeMapApply, choice: makeMapChoice
  },
  'ratio-basics': {
    calc: makeRatioCalc, fill: makeRatioFill, apply: makeRatioApply, choice: makeRatioChoice
  }
};


function paramsOf(plan) {
  if (plan && plan.semanticParams) return plan.semanticParams;
  var kpId = pkp(plan);
  if (!kpId) return null;
  return SemanticParameters.resolve(kpId, plan && (plan.questionTypeId || plan.questionType));
}

function createSemanticRelationsGenerator(spec) {
  spec = spec || {};
  return {
    id: 'generator:semantic-relations',
    subject: 'math',
    capabilities: QTYPES.slice(),
    questionTypes: QTYPES.slice(),
    
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return QTYPES.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      var count = (plan && plan.count) || 1;
      var params = paramsOf(plan);
      var row = params ? SUBTOPIC_MAKERS[params.subTopic] : null;
      var maker = row && row[plan.questionTypeId];
      
      if (!maker) return [];
      var out = [];
      for (var i = 0; i < count; i++) out.push(maker(plan, context, i));
      return out;
    }
  };
}

function buildAll() {
  return [createSemanticRelationsGenerator()];
}

module.exports = {
  createSemanticRelationsGenerator: createSemanticRelationsGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/decimal.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':dec:' + i;
  if (plan && plan.seed != null) return plan.seed + ':dec:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':dec:' + i;
}


function r1(x) { return Math.round(x * 10) / 10; }
function r2(x) { return Math.round(x * 100) / 100; }
function r4(x) { return Math.round(x * 10000) / 10000; }
function fmt(x) { return String(r4(x)); }


var NAME_RULES = [
  { sub: 'word', re: /应用|解决问题/ },
  { sub: 'unit', re: /单位换算/ },
  { sub: 'addsub-mix', re: /加减混合/ },
  { sub: 'mult-estimate', re: /乘法的估算|乘.*估算/ },
  { sub: 'div', re: /除以|除法|循环小数/ },
  { sub: 'mult', re: /乘/ },
  { sub: 'addsub', re: /加|减/ },
  { sub: 'point-move', re: /小数点.*移动/ },
  { sub: 'approx', re: /近似/ },
  { sub: 'nature', re: /性质/ },
  { sub: 'compare', re: /比较/ },
  { sub: 'readwrite', re: /读法|写法|读写|认识|意义/ }
];

function deriveSubtype(name) {
  for (var i = 0; i < NAME_RULES.length; i++) {
    if (NAME_RULES[i].re.test(name || '')) return NAME_RULES[i].sub;
  }
  return 'readwrite';
}



function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

function addsubStructure(rng, mixed) {
  var a = r2(ri(rng, 11, 99) / 10);
  var b = r2(ri(rng, 11, Math.max(12, Math.floor(a * 10) - 1)) / 10);
  var add = rng() < 0.5;
  if (mixed) {
    var c = r2(ri(rng, 11, 50) / 10);
    var ops = rng() < 0.5 ? ['+', '−'] : ['−', '+'];
    var v = ops[0] === '+' ? a + b : a - b;
    v = ops[1] === '+' ? v + c : v - c;
    return { expr: fmt(a) + ' ' + ops[0] + ' ' + fmt(b) + ' ' + ops[1] + ' ' + fmt(c), answer: fmt(r2(v)) };
  }
  return add
    ? { expr: fmt(a) + ' + ' + fmt(b), answer: fmt(r2(a + b)) }
    : { expr: fmt(a) + ' − ' + fmt(b), answer: fmt(r2(a - b)) };
}

function multStructure(rng) {
  if (rng() < 0.5) {
    var a = r2(ri(rng, 12, 88) / 10);
    var n = ri(rng, 2, 9);
    return { expr: fmt(a) + ' × ' + n, answer: fmt(r2(a * n)) };
  }
  var x = r1(ri(rng, 11, 35) / 10);
  var y = r1(ri(rng, 12, Math.max(13, Math.floor(x * 10) - 2)) / 10);
  return { expr: fmt(x) + ' × ' + fmt(y), answer: fmt(r2(x * y)) };
}

function divStructure(rng) {
  if (rng() < 0.5) {
    var b = ri(rng, 2, 9);
    var q = r2(ri(rng, 12, 84) / 10);
    var a = r2(b * q);
    return { expr: fmt(a) + ' ÷ ' + b, answer: fmt(q), explain: fmt(b) + ' × ' + fmt(q) + ' = ' + fmt(a) };
  }
  var d = r1(ri(rng, 12, 25) / 10);
  var q2 = ri(rng, 2, 8);
  var a2 = r2(d * q2);
  return { expr: fmt(a2) + ' ÷ ' + fmt(d), answer: String(q2), explain: fmt(d) + ' × ' + q2 + ' = ' + fmt(a2) };
}



function conceptItem(sub, rng) {
  if (sub === 'compare') {
    var a = r1(ri(rng, 11, 88) / 10), b = r1(ri(rng, 11, 88) / 10);
    while (b === a) b = r1(ri(rng, 11, 88) / 10);
    var sign = a > b ? '>' : '<';
    return { stem: '比较大小：' + fmt(a) + ' ○ ' + fmt(b) + '（参考：' + fmt(Math.max(a, b)) + ' − ' + fmt(Math.min(a, b)) + ' = ' + fmt(r1(Math.abs(a - b))) + '），○ 里应填什么（>、< 或 =）？', answer: sign,
      options: ['>', '<', '='], support: fmt(Math.max(a, b)) + ' − ' + fmt(Math.min(a, b)) + ' = ' + fmt(r1(Math.abs(a - b))) };
  }
  if (sub === 'nature') {
    var base = r1(ri(rng, 12, 85) / 10);
    return { stem: '根据小数的性质，化简 ' + fmt(base) + '0 = ____', answer: fmt(base),
      options: [fmt(base), fmt(base) + '0', fmt(r1(base / 10))], support: fmt(base) + '0 − 0 = ' + fmt(base) + '0' };
  }
  if (sub === 'point-move') {
    var p = r2(ri(rng, 11, 99) / 100);
    var right = rng() < 0.5;
    return { expr: (right ? fmt(p) + ' × 10' : fmt(ri(rng, 11, 99) * 10) + ' ÷ 10'),
      answer: right ? fmt(r2(p * 10)) : fmt(r2(ri(rng, 11, 99) / 10)),
      stem: (right ? '小数点向右移动一位：' + fmt(p) + ' × 10 = ____' : '小数点向左移动一位：' + fmt(ri(rng, 11, 99)) + ' ÷ 10 = ____') };
  }
  if (sub === 'approx') {
    var x = r2(ri(rng, 105, 999) / 100);
    var one = r1(Math.round(x * 10) / 10);
    return { stem: fmt(x) + ' 保留一位小数 ≈ ____（参考：' + fmt(one) + ' + 0.0 = ' + fmt(one) + '）', answer: fmt(one),
      options: [fmt(one), fmt(Math.round(x)), fmt(r2(x + 0.1))] };
  }
  if (sub === 'unit') {
    var m = ri(rng, 2, 9), dm = m * 10;
    return { expr: m + ' × 10', answer: String(dm), stem: m + ' 米 = ' + m + ' × 10 = ____ 分米',
      options: [String(dm), String(m), String(dm * 10)] };
  }
  
  var n = ri(rng, 2, 9);
  var dec = r1(n / 10);
  return { stem: fmt(dec) + ' 里面有 ____ 个 0.1（参考：' + n + ' ÷ 10 = ' + fmt(dec) + '）',
    answer: String(n), options: [String(n), String(dec), '10'] };
}



function buildQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = (plan.semanticParams && plan.semanticParams.name) || '小数';
  var sub = deriveSubtype(name);
  var qt = plan.questionTypeId;

  var prompt, answer, options = null, steps = 1;

  var calcSubs = { 'addsub': 1, 'addsub-mix': 1, 'mult': 1, 'mult-estimate': 1, 'div': 1, 'point-move': 1, 'unit': 1 };

  if (sub === 'word') {
    var inner = rng() < 0.5 ? addsubStructure(rng, false) : multStructure(rng);
    var goods = pick(rng, ['笔记本', '橡皮', '彩带', '布料']);
    prompt = '买' + goods + '一共花了 ' + inner.expr.replace(' ', '').replace(' ', '') + ' 元。列式计算 ' + inner.expr + ' = 多少元？';
    answer = inner.answer;
  } else if (calcSubs[sub]) {
    var st;
    if (sub === 'addsub' || sub === 'addsub-mix') st = addsubStructure(rng, sub === 'addsub-mix');
    else if (sub === 'div') st = divStructure(rng);
    else if (sub === 'point-move' || sub === 'unit') st = null;
    else st = multStructure(rng);
    if (st) {
      prompt = '列式计算：' + st.expr + ' = ？';
      answer = st.answer;
    } else {
      var c = conceptItem(sub, rng);
      prompt = '列式计算：' + c.stem;
      answer = c.answer; options = c.options;
    }
  } else {
    var item = conceptItem(sub, rng);
    prompt = item.stem;
    answer = item.answer; options = item.options;
  }

  
  if (qt === 'fill') {
    prompt = prompt.replace(' = ？', ' = ____').replace('？', '____');
    if (!/____|\(\s*\)/.test(prompt)) prompt += ' ____';
  }

  var data = { mode: 'decimal', subType: sub, steps: steps };
  if (qt === 'choice') {
    var pool;
    if (options) {
      pool = options.map(String).slice(0, 4);
    } else if (!isNaN(Number(answer))) {
      var num = Number(answer);
      var cand = {};
      cand[String(num)] = 1;
      [r2(num + 0.1), r2(num - 0.1), r2(num + 1), r2(num - 1), r2(num + 0.2)].forEach(function (x) {
        if (x > 0) cand[fmt(x)] = 1;
      });
      pool = Object.keys(cand);
      while (pool.length < 4) pool.push(fmt(r2(num + pool.length + 0.3)));
      pool = pool.slice(0, 4);
    } else {
      pool = [String(answer), '都不是', '无法确定'];
    }
    var uniq = [], seen = {};
    pool.forEach(function (o) { o = String(o); if (!seen[o]) { seen[o] = 1; uniq.push(o); } });
    while (uniq.length < 4) uniq.push('以上都不对（' + uniq.length + '）');
    options = Rng.shuffle(rng, uniq.slice(0, 4));
    data.options = options;
    data.correctIndex = options.indexOf(String(answer));
    answer = String(answer);
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: data
  };
}

function createDecimalGenerator(spec) {
  spec = spec || {};
  return {
    id: spec.id || 'generator:decimal-number',
    subject: 'math',
    capabilities: ['calc', 'fill', 'choice', 'apply'],
    questionTypes: ['calc', 'fill', 'choice', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return ['calc', 'fill', 'choice', 'apply'].indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = (plan && plan.count) || 1;
      var name = plan.semanticParams && plan.semanticParams.name;
      if (!name) return []; 
      var out = [];
      for (var i = 0; i < count; i++) out.push(buildQuestion(plan, context, i));
      return out;
    }
  };
}

function buildAll() { return [createDecimalGenerator()]; }

module.exports = {
  deriveSubtype: deriveSubtype,
  createDecimalGenerator: createDecimalGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/generators/fraction.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':frac:' + i;
  if (plan && plan.seed != null) return plan.seed + ':frac:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':frac:' + i;
}

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
function simp(n, d) { var g = gcd(n, d); return { n: n / g, d: d / g }; }
function fs(f) { return f.n + '/' + f.d; }
function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }


var NAME_RULES = [
  { sub: 'word', re: /解决问题/ },
  { sub: 'reciprocal', re: /倒数/ },
  { sub: 'div', re: /除以|除法/ },
  { sub: 'mix', re: /混合/ },
  { sub: 'addsub-diff', re: /异分母/ },
  { sub: 'addsub', re: /加|减|简单计算/ },
  { sub: 'compare', re: /比较|比大小/ },
  { sub: 'relation', re: /与除法|除法.*关系/ },
  { sub: 'proper', re: /真分数|假分数/ },
  { sub: 'nature', re: /性质|约分|通分|互化/ },
  { sub: 'meaning', re: /读写|认识|意义/ }
];

function deriveSubtype(name) {
  for (var i = 0; i < NAME_RULES.length; i++) {
    if (NAME_RULES[i].re.test(name || '')) return NAME_RULES[i].sub;
  }
  return 'meaning';
}



function sameDenomAdd(rng, maxD) {
  var d = ri(rng, 3, maxD || 9);
  var n1 = ri(rng, 1, d - 1), n2 = ri(rng, 1, d - n1);
  var add = ri(rng, 0, 1);
  if (add) return { expr: n1 + '/' + d + ' + ' + n2 + '/' + d, answer: fs(simp(n1 + n2, d)) };
  var hi = Math.max(n1, n2), lo = Math.min(n1, n2);
  return { expr: hi + '/' + d + ' − ' + lo + '/' + d, answer: fs(simp(hi - lo, d)) };
}

function diffDenomAdd(rng) {
  var d1 = pick(rng, [2, 3, 4, 6]), d2 = pick(rng, [3, 5, 4, 6].filter(function (x) { return x !== d1; }));
  var n1 = ri(rng, 1, d1 - 1), n2 = ri(rng, 1, d2 - 1);
  var lcm = d1 * d2 / gcd(d1, d2);
  var num = n1 * (lcm / d1) + n2 * (lcm / d2);
  return { expr: n1 + '/' + d1 + ' + ' + n2 + '/' + d2, answer: fs(simp(num, lcm)) };
}

function fracDiv(rng) {
  var n1 = ri(rng, 1, 5), d1 = ri(rng, 2, 8);
  var n2 = ri(rng, 1, 5), d2 = ri(rng, 2, 8);
  var r = simp(n1 * d2, d1 * n2);
  return { expr: n1 + '/' + d1 + ' ÷ ' + n2 + '/' + d2, answer: fs(r) };
}

function fracDivInt(rng) {
  var d = ri(rng, 2, 8), n = ri(rng, 1, d - 1), k = ri(rng, 2, 6);
  return { expr: n + '/' + d + ' ÷ ' + k, answer: fs(simp(n, d * k)) };
}



function conceptItem(sub, rng) {
  if (sub === 'compare') {
    var same = rng() < 0.5;
    var a, b, sign, support;
    if (same) {
      var d = ri(rng, 4, 9);
      a = { n: ri(rng, 1, d - 2), d: d }; b = { n: ri(rng, a.n + 1, d - 1), d: d };
      sign = '<'; support = b.n + ' − ' + a.n + ' = ' + (b.n - a.n) + '，同分母分子大的大';
    } else {
      var n = ri(rng, 1, 4);
      a = { n: n, d: 4 }; b = { n: n, d: 6 };
      sign = '>'; support = n + ' ÷ ' + a.d + ' 与 ' + n + ' ÷ ' + b.d + '，同分子分母小的大';
    }
    return { stem: '比较大小：' + fs(a) + ' ○ ' + fs(b) + '（参考：' + support + '），○ 里应填什么（>、< 或 =）？', answer: sign, options: ['>', '<', '='], support: support };
  }
  if (sub === 'relation') {
    var n = ri(rng, 2, 8), d = n + ri(rng, 1, 4);
    return { stem: n + ' ÷ ' + d + ' = ____（用分数表示商）', answer: n + '/' + d, options: [n + '/' + d, d + '/' + n, (n + d) + '/' + d] };
  }
  if (sub === 'proper') {
    var improper = rng() < 0.5;
    var pn = improper ? ri(rng, 5, 9) : ri(rng, 1, 4);
    var pd = ri(rng, pn + 1, pn + 5);
    var fracStr = pn + '/' + (improper ? Math.max(2, pn - ri(rng, 1, 2)) : pd);
    var isImproper = parseInt(fracStr.split('/')[0], 10) >= parseInt(fracStr.split('/')[1], 10);
    return { stem: fracStr + ' 的分子' + (isImproper ? '大于或等于分母' : '小于分母') + '，它是 ____ 分数（参考：' +
        pn + ' − ' + fracStr.split('/')[1] + ' = ' + (pn - parseInt(fracStr.split('/')[1], 10)) + '）',
      answer: isImproper ? '假分数' : '真分数', options: ['真分数', '假分数', '带分数'] };
  }
  if (sub === 'nature') {
    var variant = ri(rng, 0, 2);
    if (variant === 0) {
      var d2 = ri(rng, 3, 8), k2 = ri(rng, 2, 5);
      return { stem: '分数基本性质：1/' + d2 + ' 的分子分母同乘 ' + k2 + '（1 × ' + k2 + ' = ' + k2 + '），得到 ____/' + (d2 * k2),
        answer: String(k2), options: [String(k2), String(1), String(d2 * k2)] };
    }
    if (variant === 1) {
      var n3 = ri(rng, 2, 5) * 2, d3 = n3 + ri(rng, 1, 4) * 2;
      var g = gcd(n3, d3), rn = n3 / g, rd = d3 / g;
      return { stem: '约分：' + n3 + '/' + d3 + ' = ' + rn + '/____（分子分母同除以 ' + g + '，' + n3 + ' ÷ ' + g + ' = ' + rn + '）',
        answer: String(rd), options: [String(rd), String(g), String(d3)] };
    }
    return { stem: '分数与小数互化：1/2 = 1 ÷ 2 = ____', answer: '0.5', options: ['0.5', '0.2', '0.1'] };
  }
  if (sub === 'reciprocal') {
    if (rng() < 0.5) {
      var nn = ri(rng, 2, 8), dd = nn + ri(rng, 1, 3);
      return { stem: nn + '/' + dd + ' 的分子分母调换位置，它的倒数是 ____（参考：' + nn + ' × ' + dd + ' 作新分母）',
        answer: dd + '/' + nn, options: [dd + '/' + nn, nn + '/' + dd, '1'] };
    }
    var whole = ri(rng, 2, 9);
    return { stem: whole + ' 可以写成 ' + whole + '/1，它的倒数是 ____（参考：' + whole + ' ÷ ' + whole + ' = 1）',
      answer: '1/' + whole, options: ['1/' + whole, String(whole), '1'] };
  }
  
  var d0 = ri(rng, 3, 9);
  return { stem: '把一个圆平均分成 ' + d0 + ' 份，取其中的 1 份（1 ÷ ' + d0 + '），用分数表示是 ____',
    answer: '1/' + d0, options: ['1/' + d0, '1/' + (d0 + 1), d0 + '/1'] };
}



function buildQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = (plan.semanticParams && plan.semanticParams.name) || '分数';
  var sub = deriveSubtype(name);
  var qt = plan.questionTypeId;

  var prompt, answer, options = null;

  if (sub === 'word') {
    
    var wd = ri(rng, 3, 9), wn1 = ri(rng, 1, wd - 1), wn2 = ri(rng, 1, wd - wn1);
    var wexpr = wn1 + '/' + wd + ' + ' + wn2 + '/' + wd;
    var wans = fs(simp(wn1 + wn2, wd));
    prompt = '一块蛋糕，小明吃了 ' + wn1 + '/' + wd + '，小红吃了 ' + wn2 + '/' + wd +
      '。两人一共吃了这块蛋糕的几分之几？列式 ' + wexpr + ' = ？';
    answer = wans;
  } else if (sub === 'addsub') {
    var s1 = sameDenomAdd(rng, 9);
    prompt = '列式计算：' + s1.expr + ' = ？';
    answer = s1.answer;
  } else if (sub === 'addsub-diff') {
    var s2 = diffDenomAdd(rng);
    prompt = '列式计算（先通分）：' + s2.expr + ' = ？';
    answer = s2.answer;
  } else if (sub === 'mix') {
    var a = sameDenomAdd(rng, 9), b = sameDenomAdd(rng, 9);
    var d = ri(rng, 3, 9), n1 = ri(rng, 1, d - 2), n2 = ri(rng, 1, d - n1 - 1), n3 = ri(rng, 1, d - n1 - n2);
    var tot = n1 + n2 + n3;
    prompt = '列式计算：' + n1 + '/' + d + ' + ' + n2 + '/' + d + ' + ' + n3 + '/' + d + ' = ？';
    answer = fs(simp(tot, d));
  } else if (sub === 'div') {
    var dv = rng() < 0.5 ? fracDiv(rng) : fracDivInt(rng);
    prompt = '列式计算：' + dv.expr + ' = ？';
    answer = dv.answer;
  } else {
    var item = conceptItem(sub, rng);
    prompt = item.stem;
    answer = item.answer;
    options = item.options;
  }

  if (qt === 'fill') {
    prompt = prompt.replace(' = ？', ' = ____').replace('？', '____');
    if (!/____|\(\s*\)/.test(prompt)) prompt += ' ____';
  }
  if (qt === 'apply' && /列式计算/.test(prompt)) {
    prompt = prompt.replace('列式计算（先通分）：', '解决问题——先通分再计算：').replace('列式计算：', '解决问题——列式计算：');
  }

  var data = { mode: 'fraction', subType: sub, steps: 1 };
  if (qt === 'choice') {
    var pool;
    if (options) pool = options.map(String);
    else { pool = [String(answer)]; }
    var uniq = [], seen = {};
    pool.forEach(function (o) { o = String(o); if (!seen[o]) { seen[o] = 1; uniq.push(o); } });
    while (uniq.length < 4) uniq.push('以上都不对（' + uniq.length + '）');
    options = Rng.shuffle(rng, uniq.slice(0, 4));
    data.options = options;
    data.correctIndex = options.indexOf(String(answer));
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: data
  };
}

function createFractionGenerator(spec) {
  spec = spec || {};
  return {
    id: spec.id || 'generator:fraction-number',
    subject: 'math',
    capabilities: ['calc', 'fill', 'choice', 'apply'],
    questionTypes: ['calc', 'fill', 'choice', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return ['calc', 'fill', 'choice', 'apply'].indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = (plan && plan.count) || 1;
      var name = plan.semanticParams && plan.semanticParams.name;
      if (!name) return [];
      var out = [];
      for (var i = 0; i < count; i++) out.push(buildQuestion(plan, context, i));
      return out;
    }
  };
}

function buildAll() { return [createFractionGenerator()]; }

module.exports = {
  deriveSubtype: deriveSubtype,
  createFractionGenerator: createFractionGenerator,
  buildAll: buildAll
};

};
__defs["shared/generator/core/arithmetic-core.js"] = function (module, exports, require) {

'use strict';

var Rng = require("shared/generator/core/rng.js");
var OpSem = require("shared/generator/core/op-semantics.js");

var OP_ADD = OpSem.symbol('add') || '+';
var OP_SUB = OpSem.symbol('subtract') || '−';
var OP_MUL = OpSem.symbol('multiply') || '×';
var OP_DIV = OpSem.symbol('divide') || '÷';

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
__defs["shared/generator/core/op-semantics.js"] = function (module, exports, require) {

(function (global) {
  'use strict';

  var NORM = {
    add: 'add', addition: 'add',
    sub: 'subtract', subtraction: 'subtract', subtract: 'subtract',
    mult: 'multiply', mul: 'multiply', multiplication: 'multiply', multiply: 'multiply',
    div: 'divide', division: 'divide', divide: 'divide',
    '+': 'add', '−': 'subtract', '-': 'subtract', '×': 'multiply', 'x': 'multiply', '÷': 'divide'
  };

  var SYMBOLS = {
    add: '+',
    subtract: '−',
    multiply: '×',
    divide: '÷'
  };

  function normalize(opId) {
    if (typeof opId !== 'string') return null;
    return NORM.hasOwnProperty(opId) ? NORM[opId] : null;
  }

  function symbol(opId) {
    var n = normalize(opId);
    if (!n) return null;
    return SYMBOLS.hasOwnProperty(n) ? SYMBOLS[n] : null;
  }

  var API = { normalize: normalize, symbol: symbol };

  global.GenOpSemantics = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
};
global.StrategyEngine = __req('shared/strategy/strategy-engine.js');
global.StrategyConfig = __req('shared/strategy/strategy-config.js');
global.StrategyValidator = __req('shared/strategy/strategy-validator.js');
global.QuestionTypeStrategy = __req('shared/strategy/question-type-strategy.js');
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
global.CapabilityResolver = __req('shared/capability/capability-resolver.js');
global.CapabilityModel = __req('shared/capability/capability-model.js');
global.CapabilityMatrix = __req('shared/capability/capability-matrix.js');
global.ComprehensiveStrategy = __req('shared/strategy/comprehensive-strategy.js');
global.ComplexGen = __req('shared/generator/generators/complex.js');
global.StrategyBundle = { req: __req, modules: __defs };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));