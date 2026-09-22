/**
 * shared/orchestration/practice-orchestrator.js — 标准练习编排层（POL）主入口
 *
 * 唯一职责：把「一次练习的用户总题量预算」合理组织并完整执行。
 *   PracticeRequest → PracticePlan（题型覆盖 / 均衡 / 容量）→ GenerationTask → 现有生成链
 *   → Budget Recovery（带终止）→ PracticeResult（含编排账本）
 *
 * 硬约束：
 *   - 不改 Generator / Validator / Difficulty / 知识层 / Capability（Frozen Core）。
 *   - 不反向 require 上层 API（依赖方向 API → Orchestrator → Strategy → Generator）。
 *   - 容量数据来自 capacity-inventory（node）；浏览器无 fs → 传 Infinity，由 recovery 兜底。
 *   - 单一预算账本：totalBudget 只减不增；recovery 仅重新分配已存在的预算单位。
 *
 * 收敛点：GenerationAPI.generate 委托本模块；浏览器 PracticeSession.start 经 GenerationAPI 同样收敛。
 *
 * ── Generation Cell Context Contract（P11-00 冻结）────────────────────────────
 * Request → PracticePlan → Cell Request 的投影规则（cellReq 白名单，只增不改语义）：
 *
 *   [生成上下文 Generation Context] cell 必须完整继承（会改变题目生成语义）：
 *     subject / grade / difficulty / selectLevel / style / expectedAnswerStyle
 *     subtype / cognitiveLevel / spiralLevel / max_spiral_level
 *     customParams / settings / allowDifficultyOverride
 *     adaptive / adaptiveMode / adaptiveDelta / learnerProfile
 *
 *   [规划上下文 Planning Context] cell 不得继承（只属于多 KP 合并/计划级语义）：
 *     combine / planLevel / typeCounts（父级预算）/ perTypeCount / count（父级总预算）
 *
 *   [选区收窄] cell 是编排单元：knowledgePointIds = [cell.kpId]、questionTypes = [cell.questionType]、
 *     count = cell.count；所有 cell 必须落在 selectedKPs × selectedTypes 内（范围由 plan() 保证）。
 *
 *   不变式：任何会改变生成语义的请求字段，要么在生成上下文中随 cell 传递，要么在规划上下文中被
 *   显式排除；不存在"静默丢弃"。新增 Request 生成语义字段时必须同步更新本节与白名单。
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @module shared/orchestration/practice-orchestrator
 */
(function (global) {
  'use strict';

  var PracticePlan = (function () {
    try { return require('./practice-plan.js'); } catch (e) { return null; }
  })() || (typeof global !== 'undefined' ? global.PracticePlan : null);
  var BudgetAllocation = (function () {
    try { return require('./budget-allocation.js'); } catch (e) { return null; }
  })() || (typeof global !== 'undefined' ? global.BudgetAllocation : null);

  var MAX_RECOVERY_ROUNDS = 3;
  var _seq = 0;

  // ---------- 依赖获取（浏览器全局 / Node require 兜底） ----------
  function getRequestNormalize() {
    try { return require('../request/request-normalize.js'); } catch (e) {}
    return (typeof global !== 'undefined' && global.RequestNormalize) ? global.RequestNormalize : null;
  }
  function getKnowledgeContext() {
    try { return require('./knowledge-context.js'); } catch (e) {}
    return (typeof global !== 'undefined' && global.KnowledgeContext) ? global.KnowledgeContext : null;
  }
  function getCapacityMapSafe() {
    try {
      var CI = require('../capacity/capacity-inventory.js');
      if (CI && typeof CI.getCapacityMap === 'function') {
        return CI.getCapacityMap({ refresh: false }).then(function (m) { return m || null; }).catch(function () { return null; });
      }
    } catch (e) {}
    return Promise.resolve(null);
  }

  // ---------- 请求读取 ----------
  function collectQuestionTypes(req) {
    var RN = getRequestNormalize();
    var raw = req.questionTypes;
    if (!Array.isArray(raw) || !raw.length) {
      if (req.questionType) raw = [req.questionType];
      else if (Array.isArray(req.types) && req.types.length) raw = req.types;
      else if (typeof req.types === 'string' && req.types) raw = req.types.split(',');
      else raw = [];
    }
    if (RN && typeof RN.normalizeQuestionTypes === 'function') return RN.normalizeQuestionTypes(raw);
    return raw.filter(Boolean).map(String);
  }

  function explicitKpIds(req) {
    if (Array.isArray(req.knowledgePointIds) && req.knowledgePointIds.length) return req.knowledgePointIds.slice();
    if (Array.isArray(req.knowledgePoints) && req.knowledgePoints.length) return req.knowledgePoints.slice();
    if (req.scope && Array.isArray(req.scope.knowledgePoints) && req.scope.knowledgePoints.length) return req.scope.knowledgePoints.slice();
    if (typeof req.knowledgePointId === 'string' && req.knowledgePointId) return [req.knowledgePointId];
    return [];
  }

  function resolvePoolKps(req) {
    var KC = getKnowledgeContext();
    if (!KC) return [];
    return KC.poolKpIds({
      subject: req.subject,
      grade: req.grade != null ? req.grade : (req.scope && req.scope.grade != null ? req.scope.grade : null),
      unit: req.unit != null ? req.unit : (req.scope && req.scope.unit != null ? req.scope.unit : null)
    });
  }

  // ---------- 题型容量（能力之外的上限；缺失按 Infinity） ----------
  function getCapacityHelpers() {
    var CI = null;
    try { CI = require('../capacity/capacity-inventory.js'); } catch (e) {}
    if (!CI && global.CapacityInventory) CI = global.CapacityInventory;
    return CI;
  }

  /**
   * 汇总候选 KPs 在「用户难度桶」下的逐题型容量上限。
   * 维度对齐（P0-02）：Capacity 按难度分桶（1-3/4-6/7-10）查询，与用户 difficulty 同维度；
   * 无法获取到对应桶（缓存旧/缺失）时回退该 KP 顶层代表容量。
   * @param {string[]} kpIds
   * @param {Object|null} capMap
   * @param {number} difficulty
   * @returns {Object} { type: capacity }
   */
  function capacityByType(kpIds, capMap, difficulty) {
    var caps = {};
    if (!capMap || !capMap) return caps;
    var CI = getCapacityHelpers();
    (kpIds || []).forEach(function (kp) {
      var entry = null;
      if (CI && typeof CI.getCapacityFor === 'function') entry = CI.getCapacityFor(capMap, kp, difficulty);
      if (!entry) {
        var e = capMap[kp];
        if (!e) return;
        entry = { total: e.total, byType: e.byType || {} };
      }
      var byType = entry.byType || {};
      Object.keys(byType).forEach(function (t) {
        var c = byType[t];
        if (typeof c === 'number' && c > 0) caps[t] = (caps[t] || 0) + c;
      });
    });
    return caps;
  }

  // ---------- 能力判定（Capability ≠ Capacity） ----------
  function getCapabilityView() {
    try { return require('../capability/knowledge-capability-view.js'); } catch (e) {}
    return (typeof global !== 'undefined' && global.KnowledgeCapabilityView) ? global.KnowledgeCapabilityView : null;
  }

  function getTargetDifficulty() {
    try { return require('../strategy/target-difficulty.js'); } catch (e) {}
    return (typeof global !== 'undefined' && global.TargetDifficulty) ? global.TargetDifficulty : null;
  }

  // M2/M3：编排层难度参数域（DifficultyContext）唯一入口；只做参数整理，不计算难度。
  function getDifficultyOrchestrator() {
    try { return require('./difficulty-orchestrator.js'); } catch (e) {}
    return (typeof global !== 'undefined' && global.DifficultyOrchestrator) ? global.DifficultyOrchestrator : null;
  }

  function getKnowledgeContext() {
    try { return require('./knowledge-context.js'); } catch (e) {}
    return (typeof global !== 'undefined' && global.KnowledgeContext) ? global.KnowledgeContext : null;
  }

  /**
   * 用户未显式给难度时，预测实际生成难度（策略 7 维静态 + 合成），
   * 使 Capacity 维度与生成维度对齐（P0-02）。无法推导时回落中档 3。
   * 只影响容量估算与账本标记，绝不复写 genReq.difficulty（生成仍由策略自行合成）。
   * KP 经 KnowledgeContext 的 Practice Context 视图（strategyView）获取：
   * Frozen Target/StaticDifficulty 期望该形状（canonical 直传会全落默认 → Shape Drift）。
   */
  function predictDifficulty(kpIds, qts, mode) {
    var Target = getTargetDifficulty();
    var KC = getKnowledgeContext();
    if (!Target || !KC) return null;
    var type = (qts && qts.length ? qts[0] : null) || 'calc';
    for (var i = 0; i < kpIds.length; i++) {
      var kp;
      try { kp = KC.strategyView(kpIds[i]); } catch (e) { kp = null; }
      if (!kp) continue;
      try {
        var r = Target.resolveTargetDifficulty({ knowledgePoint: kp, questionType: type, mode: mode || 'single-kp' });
        if (r && typeof r.composedDifficulty === 'number' && isFinite(r.composedDifficulty)) {
          return Math.min(10, Math.max(1, Math.round(r.composedDifficulty)));
        }
      } catch (e) { /* 单 KP 推导失败，尝试下一个 */ }
    }
    return null;
  }

  function eligibleTypesFor(kpIds, qts) {
    var KCV = getCapabilityView();
    if (!KCV || typeof KCV.buildEligibility !== 'function') {
      return { feasible: qts.slice(), eligibility: null, skips: {} };
    }
    var eligibility = KCV.buildEligibility(kpIds, qts);
    var feasible = KCV.eligibleTypes(eligibility, qts, kpIds);
    if (!feasible.length) feasible = qts.slice(); // 兜底：能力信息缺失时不吞请求
    return { feasible: feasible, eligibility: eligibility, skips: eligibility.skip || {} };
  }

  // ---------- 不反向 require 上层：plan 只用只读数据 + 纯分配 ----------
  function plan(request, options) {
    options = options || {};
    var req = request || {};
    // 非数学科目：不介入，交由 routeBySubject 返回 NOT_IMPLEMENTED
    if (req.subject === 'chinese' || req.subject === 'english') {
      return Promise.resolve({ active: false, reason: 'non-math' });
    }
    var qts = collectQuestionTypes(req);
    if (!qts.length) return Promise.resolve({ active: false, reason: 'no-types' });
    // combine=true 属 StrategyEngine 单计划合并语义（多 KP 融合出题），
    // POL 的按 cell 拆分会破坏其合并语义 → 透明回退到 execute（原行为回归保护）。
    if (req.combine === true) return Promise.resolve({ active: false, reason: 'combine' });
    // comprehensive 属既有 ComprehensiveStrategy 全年级加权分配语义（与 api.js isComprehensive 对齐），
    // 不属于 POL 的「选区 KP × 题型」cell 编排 → 显式回退（防带题型白名单时误入池路径）。
    if (req.mode === 'comprehensive' || req.model === 'comprehensive' || req.comprehensive === true) {
      return Promise.resolve({ active: false, reason: 'comprehensive' });
    }

    var count = req.count != null ? req.count : (req.volume != null ? req.volume : 20);
    count = Math.max(1, Math.floor(Number(count) || 20));

    // 仅对「显式候选 KP + 题型」路径介入（即 v4.3.0 二级/三级页与知识点深链的实际链路）。
    // 池模式（无显式 KP）：POL 经 KnowledgeContext 展开年级/单元池（KBL Runtime 唯一事实源），
    // 取代 Frozen Strategy poolEntries（KB.getEntries）路径 → Strategy 不再主动查询知识层。
    var kpIds = explicitKpIds(req);
    if (!kpIds.length) {
      var poolGrade = req.grade != null ? req.grade : (req.scope && req.scope.grade != null ? req.scope.grade : null);
      if (poolGrade != null) kpIds = resolvePoolKps(req);
    }
    if (!kpIds.length) return Promise.resolve({ active: false, reason: 'no-kp' });

    // 用户难度（P0-02 维度对齐）：经 DifficultyOrchestrator 归一（number/object/null 均可），
    // 0/空按中档；1-10 归入对应难度桶。
    // 用户未显式给难度时，生成难度由策略 7 维静态+合成决定（题面 d≠默认 3），
    // 因此用 predictDifficulty 把容量查询/账本维度对齐到真实生成维度，避免桶错位。
    var DO = getDifficultyOrchestrator();
    var diffParam = DO ? DO.normalizeDifficultyInput({ difficulty: req.difficulty, scope: req.scope })
      : { requested: req.difficulty != null ? Number(req.difficulty) : null, min: null, max: null, tolerance: 0, source: 'auto' };
    var userDifficulty = diffParam.requested != null ? diffParam.requested : null;
    var difficulty;
    if (userDifficulty == null || !isFinite(userDifficulty)) {
      var predicted = predictDifficulty(kpIds, qts, req.mode);
      difficulty = (predicted != null && isFinite(predicted)) ? predicted : 3;
    } else {
      difficulty = Math.min(10, Math.max(1, Math.round(Number(userDifficulty))));
    }
    // M4：编排层 DifficultyContext（难度参数域）。base 由 M5（strategy static-difficulty）接入前暂为 null，
    // 本阶段仅承载 requested/min/max/tolerance/source 与 target 选择；不参与任何难度计算。
    var difficultyContext = DO ? DO.resolveContext(diffParam, null)
      : { requested: diffParam.requested != null ? difficulty : null, base: null, target: null, min: diffParam.min, max: diffParam.max, tolerance: diffParam.tolerance, source: diffParam.source };

    /**
   * 显式题型组合（typeCounts / perTypeCount）在 POL 路径同样权威（对齐 strategy-engine 规则①/②）：
   *   - typeCounts   ：逐题型数量原样保留（仅剔除选区上不可行的题型），不再被均衡重算覆盖；
   *   - perTypeCount ：统一每题型数量，参与题型受总量上限约束（Σ ≤ count）；
   *   - 两类均受题型容量封顶（P0-03 容量仅作预算封顶）；封顶/不可行题型记入 skipped。
   * 返回 null 表示未给出显式组合（走默认保底+均衡），或直接返回组合结果。
   */
  /** 归一显式 typeCounts：数组 [{questionType,count}] 或对象 {qt:count} 均可；
   *  questionType 经 RequestNormalize 归一为 canonical（P0-11：alias 不得进入预算/cell/统计键） */
  function explicitTypeCountsEntries(req) {
    var RN = getRequestNormalize();
    var canon = function (t) {
      var s = String(t == null ? '' : t);
      if (!s) return null;
      if (RN && typeof RN.normalizeQuestionType === 'function') {
        var c = RN.normalizeQuestionType(s);
        return c || null;
      }
      return s;
    };
    if (Array.isArray(req.typeCounts) && req.typeCounts.length) {
      return req.typeCounts.map(function (t) {
        if (!t) return null;
        var ct = canon(t.questionType);
        return ct ? { questionType: ct, count: t.count } : null;
      }).filter(Boolean);
    }
    if (req.typeCounts && typeof req.typeCounts === 'object') {
      var arr = [];
      for (var k in req.typeCounts) {
        if (Object.prototype.hasOwnProperty.call(req.typeCounts, k)) {
          var c = Number(req.typeCounts[k]);
          var ck = canon(k);
          if (ck && isFinite(c) && c > 0) arr.push({ questionType: ck, count: c });
        }
      }
      return arr.length ? arr : null;
    }
    return null;
  }

  function explicitTypeCounts(req, feasibleTypes, count, typeCaps) {
    var capOf = function (t) {
      var c = typeCaps ? typeCaps[t] : null;
      if (c == null) return Infinity;
      c = Number(c);
      return (isFinite(c) && c >= 0) ? c : Infinity;
    };
    var pairs = explicitTypeCountsEntries(req);
    if (pairs) {
      var out = [], total = 0, skipped = [], capped = false;
      pairs.forEach(function (t) {
        if (!t || t.questionType == null) return;
        var label = String(t.questionType);
        if (feasibleTypes.indexOf(label) === -1) { skipped.push(label); return; }
        var c = Math.max(0, Math.floor(Number(t.count) || 0));
        var cap = capOf(label);
        if (c > cap) { capped = true; c = cap; }
        if (c === 0) { skipped.push(label); return; }
        out.push({ questionType: label, count: c });
        total += c;
      });
      return {
        typeCounts: out, plannedTotal: total,
        coverageStatus: (skipped.length || capped) ? ((skipped.length ? 'TYPE_COVERAGE_INFEASIBLE' : 'CAPACITY_LIMITED')) : 'OK',
        reason: (skipped.length ? '显式题型在选区不可行已跳过: ' + skipped.join(',')
                                 : (capped ? '显式题型受容量封顶' : null)),
        skipped: skipped
      };
    }
    if (req.perTypeCount != null && req.perTypeCount >= 1) {
      var pt = Math.max(1, Math.floor(Number(req.perTypeCount)));
      pt = Math.min(count, pt);
      var out2 = [], total2 = 0, skipped2 = [], capped2 = false;
      (feasibleTypes || []).forEach(function (t) {
        if (total2 + pt > count) { skipped2.push(t); return; }
        var cap = capOf(t);
        var give = Math.min(pt, cap);
        if (give <= 0) { skipped2.push(t); return; }
        if (give < pt) capped2 = true;
        out2.push({ questionType: t, count: give });
        total2 += give;
      });
      return {
        typeCounts: out2, plannedTotal: total2,
        coverageStatus: (skipped2.length || capped2) ? ((skipped2.length ? 'TYPE_COVERAGE_INFEASIBLE' : 'CAPACITY_LIMITED')) : 'OK',
        reason: (skipped2.length ? '总量上限/容量封顶剔除题型: ' + skipped2.join(',') : (capped2 ? '显式题型受容量封顶' : null)),
        skipped: skipped2
      };
    }
    return null;
  }

  return getCapacityMapSafe().then(function (capMap) {
      var typeCaps = capacityByType(kpIds, capMap, difficulty);
      // 可行题型 = 能力判定（eligible），不是容量（P0-03）；容量仅作预算封顶。
      var ev = eligibleTypesFor(kpIds, qts);
      var feasibleTypes = ev.feasible;
      var explicitAlloc = explicitTypeCounts(req, feasibleTypes, count, typeCaps);
      var alloc = explicitAlloc ||
        BudgetAllocation.allocateTypeBudgets({ count: count, questionTypes: feasibleTypes, typeCaps: typeCaps });
      // Type Budget + KP Budget → GenerationTask[]（P0-05）
      var kpBudget = BudgetAllocation.allocateKpTypeBudget({
        typeCounts: alloc.typeCounts,
        kps: kpIds,
        eligibleKpsForType: (ev.eligibility && ev.eligibility.eligibleKpsForType) || null,
        allowedKpsForType: (ev.eligibility && ev.eligibility.allowedKpsForType) || null
      });

      var genReq = Object.assign({}, req, {
        questionTypes: feasibleTypes.slice(),
        count: count,
        typeCounts: alloc.typeCounts,
        perTypeCount: null
      });
      // 始终以 knowledgePointIds 承载候选池（显式或池扩展），保证 planByType 命中用户选区
      genReq.knowledgePointIds = kpIds.slice();

      return {
        active: true,
        request: genReq,
        requestedCount: count,
        selectedTypes: qts.slice(),
        feasibleTypes: feasibleTypes,
        typeCaps: alloc.typeCaps,
        kpTypeMatrix: kpBudget.cells,
        kpDistribution: kpBudget.kpDistribution,
        eligibleKpsForType: (ev.eligibility && ev.eligibility.eligibleKpsForType) || null,
        kpIds: kpIds.slice(),
        capabilitySkips: ev.skips,
        skippedTypes: explicitAlloc ? explicitAlloc.skipped : [],
        explicitCombo: !!explicitAlloc,
        difficulty: difficulty,
        difficultyContext: difficultyContext,
        plannedTotal: alloc.plannedTotal,
        // 显式题型组合（typeCounts/perTypeCount）权威：总量以计划为准，不得被 recovery 补齐到 count
        targetTotal: explicitAlloc ? alloc.plannedTotal : count,
        coverageStatus: alloc.coverageStatus,
        reason: alloc.reason
      };
    });
  }

  // ---------- trace 合并 ----------
  function mergeTrace() {
    var out = {};
    var failed = [];
    for (var i = 0; i < arguments.length; i++) {
      var t = arguments[i];
      if (!t) continue;
      Object.keys(t).forEach(function (k) {
        if (k === 'failedPlans') return;
        if (out[k] == null) out[k] = t[k];
      });
      if (Array.isArray(t.failedPlans)) failed = failed.concat(t.failedPlans);
    }
    out.failedPlans = failed;
    return out;
  }

  function assignOpts(base, extra) {
    var o = Object.assign({}, base);
    Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }

  // ---------- 主编排 ----------
  /**
   * @param {Object} request
   * @param {Object} options
   * @param {Object} deps { execute(request,options)->Promise, render(questions,ro,columns), getRenderOptions()->{normalize} }
   * @returns {Promise<Object>} GenerateResult（含 orchestration 账本）
   */
  function orchestrate(request, options, deps) {
    options = options || {};
    deps = deps || {};
    var execute = deps.execute;
    var render = deps.render;
    var getRenderOptions = deps.getRenderOptions;
    if (typeof execute !== 'function') return Promise.reject(new Error('PracticeOrchestrator.orchestrate 需要 execute 回调'));

    var RO = getRenderOptions ? getRenderOptions() : null;
    var ro = RO ? RO.normalize(options.renderOptions) : { mode: 'screen', theme: 'default', device: 'desktop', density: 'normal' };
    var generationId = 'g-' + Date.now().toString(36) + '-' + (++_seq).toString(36);

    return plan(request, options).then(function (p) {
      if (!p.active) {
        return execute(request, options).then(function (r) {
          if (r && !r.generationId) r.generationId = generationId;
          return r;
        });
      }

      var genReq = p.request;

      // Tools：按 cell（kpId × questionType × count）串行执行并聚合，绝不越界到选区外 KP。
      function runCells(cells, prevSeen) {
        var acc = {
          questions: [],
          plans: [],
          trace: {},
          failedPlans: [],
          seenKeys: (prevSeen instanceof Set) ? prevSeen : new Set(),
          outOfScopeDropped: 0
        };
        var coveredKps = [];
        var chain = Promise.resolve();
        cells.forEach(function (cell) {
          chain = chain.then(function () {
            // 白名单构造 cellReq：仅携带 cell 所需字段，绝不复用父请求的组合/规划级标志
            // （combine/planLevel 等只属于多 KP 合并语义，single-kp cell 不得继承）。
            var cellReq = {
              subject: genReq.subject,
              grade: genReq.grade,
              mode: 'single-kp',
              knowledgePointIds: [cell.kpId],
              questionTypes: [cell.questionType],
              typeCounts: [{ questionType: cell.questionType, count: cell.count }],
              perTypeCount: null,
              count: cell.count,
              difficulty: genReq.difficulty,
              selectLevel: genReq.selectLevel,
              style: genReq.style,
              expectedAnswerStyle: genReq.expectedAnswerStyle,
              // P10-3：难度/生成语义字段随 cell 传递（此前被白名单丢弃 → 用户难度上下文丢失）。
              // 仅携带执行语义；combine/planLevel 等规划级标志仍不继承（见上方注释）。
              subtype: genReq.subtype,
              cognitiveLevel: genReq.cognitiveLevel,
              spiralLevel: genReq.spiralLevel,
              max_spiral_level: genReq.max_spiral_level,
              customParams: genReq.customParams,
              settings: genReq.settings,
              allowDifficultyOverride: genReq.allowDifficultyOverride,
              adaptive: genReq.adaptive,
              adaptiveMode: genReq.adaptiveMode,
              adaptiveDelta: genReq.adaptiveDelta,
              learnerProfile: genReq.learnerProfile,
              // FINAL-13：显式 seed 随 cell 传递（冻结/可复现）；未指定为 undefined，下游 auto seed 不变。
              seed: genReq.seed
            };
            return execute(cellReq, assignOpts(options, { __noRender: true, previousSeenKeys: acc.seenKeys }))
              .then(function (add) {
                // 先按批前 seenKeys 过滤新题，再吸收本批指纹（避免 add.seenKeys 含本批指纹时误判为重复）
                var newOnes = [];
                (add.questions || []).forEach(function (q) {
                  // P11-03 Scope 守卫：生成结果不得偷换题型（Strategy 退化产物越界 selectedTypes
                  // → 丢弃，缺口如实走 Recovery/PARTIAL；不把越界题交付用户）。
                  if (q && q.questionType && p.selectedTypes && p.selectedTypes.indexOf(q.questionType) === -1) {
                    acc.outOfScopeDropped = (acc.outOfScopeDropped || 0) + 1;
                    return;
                  }
                  var fp = q && q.questionFingerprint;
                  if (fp && acc.seenKeys.has(fp)) return;
                  if (fp) acc.seenKeys.add(fp);
                  newOnes.push(q);
                });
                if (add && add.seenKeys) add.seenKeys.forEach(function (k) { acc.seenKeys.add(k); });
                if (!newOnes.length) return;
                acc.questions = acc.questions.concat(newOnes);
                acc.plans = acc.plans.concat(add.plans || []);
                acc.trace = mergeTrace(acc.trace, add.trace);
                acc.failedPlans = acc.failedPlans.concat(add.failedPlans || []);
                if (coveredKps.indexOf(cell.kpId) === -1) coveredKps.push(cell.kpId);
              });
          });
        });
        return chain.then(function () { return { acc: acc, coveredKps: coveredKps }; });
      }

      // P11-02 F-DUP-1：初始 seenKeys 以父级 previousSeenKeys 播种。
      // 此前用空集启动并用它覆盖 cell 的 previousSeenKeys，导致 session/bridge 注入的
      // 跨代全历史指纹在 POL 激活路径丢失（重新生成与上一代不互斥）。
      var seedSeen = new Set();
      if (options && options.previousSeenKeys && typeof options.previousSeenKeys.forEach === 'function') {
        options.previousSeenKeys.forEach(function (k) { seedSeen.add(k); });
      }
      return runCells(p.kpTypeMatrix || [], seedSeen).then(function (firstRun) {
        var acc = firstRun.acc;
        var coveredKps = firstRun.coveredKps;
        var requested = p.requestedCount;
        // 显式组合时以计划总量为目标（防 recovery 破坏显式逐题型数量守恒）；否则补齐到 count
        var target = p.targetTotal != null ? p.targetTotal : p.requestedCount;
        var produced = acc.questions.length;
        var recovered = 0;
        var rounds = 0;

        function loop() {
          if (produced >= target) return Promise.resolve();
          if (rounds >= MAX_RECOVERY_ROUNDS) return Promise.resolve();
          // 显式题型组合：逐题型数量为权威，跨题型 recovery 会破坏 O(计数不挪用) 语义 → 不补齐
          if (p.explicitCombo) return Promise.resolve();
          rounds += 1;
          var producedByType = PracticePlan.aggregateTypeDistribution(acc.questions);
          var deficit = target - produced;
          var rec = BudgetAllocation.allocateRecovery({
            deficit: deficit,
            questionTypes: p.feasibleTypes.length ? p.feasibleTypes : p.selectedTypes,
            typeCaps: p.typeCaps,
            produced: producedByType
          });
          if (!rec.typeCounts.length || rec.appliedTotal <= 0) return Promise.resolve();
          // 缺口跨题型回收后，再按能力分摊回 KPs（Type+KP 双层仍守恒：Σ cells.count === appliedTotal）
          var cells = [];
          rec.typeCounts.forEach(function (tc) {
            var eligible = (p.eligibleKpsForType && Array.isArray(p.eligibleKpsForType[tc.questionType]))
              ? p.eligibleKpsForType[tc.questionType] : p.kpIds;
            cells = cells.concat(BudgetAllocation.cellsForType({
              questionType: tc.questionType, count: tc.count, kps: p.kpIds, eligible: eligible
            }));
          });
          if (!cells.length) return Promise.resolve();
          return runCells(cells, acc.seenKeys).then(function (run) {
            var gained = run.acc.questions.length;
            if (!gained) return Promise.resolve(); // 无进展：终止，杜绝死循环
            acc.questions = acc.questions.concat(run.acc.questions);
            acc.plans = acc.plans.concat(run.acc.plans);
            acc.trace = mergeTrace(acc.trace, run.acc.trace);
            acc.failedPlans = acc.failedPlans.concat(run.acc.failedPlans);
            run.coveredKps.forEach(function (k) { if (coveredKps.indexOf(k) === -1) coveredKps.push(k); });
            produced = acc.questions.length;
            recovered += gained;
            return loop();
          });
        }

        return loop().then(function () {
          var renderOutline = (typeof render === 'function') ? render(acc.questions, ro, options.columns) : { items: [], html: '' };
          var producedByTypeFinal = PracticePlan.aggregateTypeDistribution(acc.questions);
          var covered = p.selectedTypes.filter(function (t) { return (producedByTypeFinal[t] || 0) > 0; });
          var exhaustedTypes = p.selectedTypes.filter(function (t) { return !(producedByTypeFinal[t] > 0); });
          var exhaustedKps = p.kpIds.filter(function (k) { return coveredKps.indexOf(k) === -1; });

          var status, reason = null;
          if (produced === 0) status = 'FAILED';
          // 状态以原请求（requested）为满足度：显式组合产出≥planned 但 < requested 时仍为 PARTIAL（缺口如实入账，不弱化）
          else if (produced >= requested) status = 'SUCCESS';
          else {
            status = 'PARTIAL';
            if (p.explicitCombo && produced === p.plannedTotal) {
              reason = 'PARTIAL_EXPLICIT_COMPOSITION'; // 显式题型组合权威：按计划产出，未补齐 count（语义对齐策略引擎规则①/②）
            } else if (exhaustedTypes.length) { reason = 'PARTIAL_TYPE_COVERAGE'; }
            else if (p.coverageStatus === 'CAPACITY_LIMITED' || p.coverageStatus === 'TYPE_COVERAGE_INFEASIBLE') { reason = 'PARTIAL_CAPACITY'; }
            else reason = (acc.failedPlans && acc.failedPlans.length) ? 'PARTIAL_GENERATION_SPACE' : 'PARTIAL_DEDUP';
          }

          var ledger = PracticePlan.buildLedger({
            requestedCount: requested,
            plannedCount: p.plannedTotal,
            generatedCount: acc.questions.length,
            finalCount: acc.questions.length,
            selectedTypes: p.selectedTypes,
            coveredTypes: covered,
            typeDistribution: producedByTypeFinal,
            exhaustedTypes: exhaustedTypes,
            exhaustedKps: exhaustedKps,
            capacityExhausted: (p.coverageStatus === 'CAPACITY_LIMITED' || p.coverageStatus === 'TYPE_COVERAGE_INFEASIBLE'),
            generationFailed: status === 'FAILED',
            budgetRecovered: recovered,
            outOfScopeDropped: acc.outOfScopeDropped || 0,
            coverageStatus: p.coverageStatus,
            reason: reason
          });
          ledger.difficultyBucket = null;
          try {
            var CI2 = getCapacityHelpers();
            if (CI2 && typeof CI2.difficultyBucket === 'function') {
              // 用户未显式给难度时，桶以真实产出题目的难度中位数为准（落账口与生成口径同维度，P0-02）
              var bucketSource = p.difficulty;
              var realDs = acc.questions
                .map(function (q) { return Number(q.difficulty); })
                .filter(function (n) { return isFinite(n) && n >= 1 && n <= 10; });
              if (realDs.length) {
                realDs.sort(function (a, b) { return a - b; });
                bucketSource = realDs[Math.floor(realDs.length / 2)];
              }
              ledger.difficultyBucket = CI2.difficultyBucket(bucketSource);
            }
          } catch (e) { /* 非关键 */ }
          ledger.capabilitySkips = p.capabilitySkips || {};
          ledger.skippedTypes = (p.skippedTypes || []).slice();
          ledger.kpTypeMatrix = (p.kpTypeMatrix || []).slice();
          ledger.coveredKps = coveredKps.slice();
          ledger.coveredKpCount = coveredKps.length;
          ledger.selectedKpCount = p.kpIds.length;
          ledger.difficultyContext = p.difficultyContext || null;

          return {
            questions: acc.questions,
            items: renderOutline.items,
            html: renderOutline.html,
            renderOptions: renderOutline.renderOptions,
            plans: acc.plans,
            trace: acc.trace,
            failedPlans: acc.failedPlans,
            status: status,
            producedCount: acc.questions.length,
            requestedCount: requested,
            generationId: generationId,
            previousGenerationId: options.previousGenerationId || null,
            seenKeys: acc.seenKeys,
            difficultyContext: p.difficultyContext || null,
            orchestration: ledger
          };
        });
      });
    });
  }

  var API = {
    plan: plan,
    orchestrate: orchestrate,
    MAX_RECOVERY_ROUNDS: MAX_RECOVERY_ROUNDS
  };

  global.PracticeOrchestrator = API;
  if (global.App && typeof global.App === 'object') global.App.PracticeOrchestrator = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : global);
