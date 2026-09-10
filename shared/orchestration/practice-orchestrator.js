/**
 * shared/orchestration/practice-orchestrator.js — 标准练习编排层（POL）主入口
 *
 * 唯一职责：把「一次练习的用户总题量预算」合理组织并完整执行。
 *   PracticeRequest → PracticePlan（题型覆盖 / 均衡 / 容量）→ GenerationTask → 现有生成链
 *   → Budget Recovery（带终止）→ PracticeResult（含编排账本）
 *
 * 硬约束：
 *   - 不改 Generator / Validator / Difficulty / KnowledgeBank / Capability（Frozen Core）。
 *   - 不反向 require 上层 API（依赖方向 API → Orchestrator → Strategy → Generator）。
 *   - 容量数据来自 capacity-inventory（node）；浏览器无 fs → 传 Infinity，由 recovery 兜底。
 *   - 单一预算账本：totalBudget 只减不增；recovery 仅重新分配已存在的预算单位。
 *
 * 收敛点：GenerationAPI.generate 委托本模块；浏览器 PracticeSession.start 经 GenerationAPI 同样收敛。
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
  function getKnowledgeBank() {
    try { return require('../knowledge/knowledge-bank.js'); } catch (e) {}
    return (typeof global !== 'undefined' && global.KnowledgeBank) ? global.KnowledgeBank : null;
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
    var KB = getKnowledgeBank();
    if (!KB) return [];
    var subject = (req.subject === 'chinese' || req.subject === 'english') ? 'math' : (req.subject || 'math');
    var grade = req.grade != null ? req.grade : (req.scope && req.scope.grade != null ? req.scope.grade : null);
    if (grade == null) return [];
    var ids = [];
    var unit = req.unit != null ? req.unit : (req.scope && req.scope.unit != null ? req.scope.unit : null);
    var g = KB.findGrade(subject, grade);
    if (unit != null) {
      (g && g.modules || []).forEach(function (m) {
        if (String(m.id) === String(unit)) (m.knowledgePoints || []).forEach(function (kp) { ids.push(kp.id); });
      });
    } else {
      (KB.getEntries(subject, grade) || []).forEach(function (e) { ids.push(e.id); });
    }
    return ids;
  }

  // ---------- 题型容量（来自 capacity map 的 byType 经验值；缺失按 Infinity） ----------
  function computeTypeCaps(kpIds, capMap) {
    var caps = {};
    (kpIds || []).forEach(function (kp) {
      var e = capMap && capMap[kp];
      if (!e) return;
      var byType = e.byType || {};
      Object.keys(byType).forEach(function (t) {
        var c = byType[t];
        if (typeof c === 'number' && c > 0) caps[t] = (caps[t] || 0) + c;
      });
    });
    return caps;
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

    var count = req.count != null ? req.count : (req.volume != null ? req.volume : 20);
    count = Math.max(1, Math.floor(Number(count) || 20));

    // 仅对「显式候选 KP + 题型」路径介入（即 v4.3.0 二级/三级页与知识点深链的实际链路）。
    // 池模式（无显式 KP）保持原行为不变，避免回归；其题型覆盖可作为后续扩展。
    var kpIds = explicitKpIds(req);
    if (!kpIds.length) return Promise.resolve({ active: false, reason: 'no-kp' });

    return getCapacityMapSafe().then(function (capMap) {
      var typeCaps = computeTypeCaps(kpIds, capMap);
      // 可行题型：题型容量 > 0；浏览器无 capacity map 时视为全部可行（由 recovery 兜底真实能力）
      var hasCap = Object.keys(typeCaps).length > 0;
      var feasibleTypes = qts.filter(function (t) { return !hasCap || (typeCaps[t] || 0) > 0; });
      var allocTypes = feasibleTypes.length ? feasibleTypes : qts;
      var alloc = BudgetAllocation.allocateTypeBudgets({ count: count, questionTypes: allocTypes, typeCaps: typeCaps });

      var genReq = Object.assign({}, req, {
        questionTypes: qts.slice(),
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
        plannedTotal: alloc.plannedTotal,
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
      return execute(genReq, assignOpts(options, { __noRender: true })).then(function (first) {
        var acc = {
          questions: (first.questions || []).slice(),
          plans: (first.plans || []).slice(),
          trace: mergeTrace(first.trace),
          failedPlans: (first.failedPlans || []).slice(),
          seenKeys: (first.seenKeys instanceof Set) ? first.seenKeys : new Set()
        };
        var requested = p.requestedCount;
        var produced = acc.questions.length;
        var recovered = 0;
        var rounds = 0;

        function loop() {
          if (produced >= requested) return Promise.resolve();
          if (rounds >= MAX_RECOVERY_ROUNDS) return Promise.resolve();
          rounds += 1;
          var producedByType = PracticePlan.aggregateTypeDistribution(acc.questions);
          var deficit = requested - produced;
          var rec = BudgetAllocation.allocateRecovery({
            deficit: deficit,
            questionTypes: p.selectedTypes,
            typeCaps: p.typeCaps,
            produced: producedByType
          });
          if (!rec.typeCounts.length || rec.appliedTotal <= 0) return Promise.resolve();
          // 缺口二次分配：count 收敛为本次缺口量，保证 planByType 守恒不变式（Σ typeCounts === count）
          var recReq = Object.assign({}, genReq, {
            typeCounts: rec.typeCounts,
            perTypeCount: null,
            count: rec.appliedTotal
          });
          return execute(recReq, assignOpts(options, { __noRender: true, previousSeenKeys: acc.seenKeys }))
            .then(function (add) {
              if (add.seenKeys) add.seenKeys.forEach(function (k) { acc.seenKeys.add(k); });
              var newOnes = [];
              (add.questions || []).forEach(function (q) {
                var fp = q && q.questionFingerprint;
                if (fp && acc.seenKeys.has(fp)) return;
                if (fp) acc.seenKeys.add(fp);
                newOnes.push(q);
              });
              if (!newOnes.length) return Promise.resolve(); // 无进展：终止，杜绝死循环
              acc.questions = acc.questions.concat(newOnes);
              acc.plans = acc.plans.concat(add.plans || []);
              acc.trace = mergeTrace(acc.trace, add.trace);
              acc.failedPlans = acc.failedPlans.concat(add.failedPlans || []);
              produced = acc.questions.length;
              recovered += newOnes.length;
              return loop();
            });
        }

        return loop().then(function () {
          var renderOutline = (typeof render === 'function') ? render(acc.questions, ro, options.columns) : { items: [], html: '' };
          var producedByTypeFinal = PracticePlan.aggregateTypeDistribution(acc.questions);
          var covered = p.selectedTypes.filter(function (t) { return (producedByTypeFinal[t] || 0) > 0; });
          var exhaustedTypes = p.selectedTypes.filter(function (t) { return !(producedByTypeFinal[t] > 0); });

          var status, reason = null;
          if (produced === 0) status = 'FAILED';
          else if (produced >= requested) status = 'SUCCESS';
          else {
            status = 'PARTIAL';
            if (exhaustedTypes.length) reason = 'PARTIAL_TYPE_COVERAGE';
            else if (p.coverageStatus === 'CAPACITY_LIMITED' || p.coverageStatus === 'TYPE_COVERAGE_INFEASIBLE') reason = 'PARTIAL_CAPACITY';
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
            exhaustedKps: [],
            capacityExhausted: (p.coverageStatus === 'CAPACITY_LIMITED' || p.coverageStatus === 'TYPE_COVERAGE_INFEASIBLE'),
            generationFailed: status === 'FAILED',
            budgetRecovered: recovered,
            coverageStatus: p.coverageStatus,
            reason: reason
          });

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
