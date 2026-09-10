/**
 * shared/orchestration/practice-plan.js — PracticePlan / TypeBudget / KPBudget / Ledger 结构
 *
 * 标准练习编排层（POL）的数据结构层。纯数据结构 + 聚合工具，不做任何生成、不读 Capacity、
 * 不接触 Generator / Validator / KnowledgeBank。
 *
 * 职责（仅数据）：
 *   - PracticePlan      : 执行前的预算计划（totalCount / selectedTypes / typeBudgets / kpBudgets / remainingBudget / status）
 *   - TypeBudget        : 单个题型的预算（type / minimum / target / capacity / allocated）
 *   - KPBudget          : 单个知识点在某题型下的配额
 *   - Ledger            : 编排结果账本（可审计：requested/planned/generated/valid/final、覆盖题型、缺口、回收）
 *
 * 浏览器 / CommonJS 双入口：挂载 global.PracticePlan 与 module.exports。
 *
 * @module shared/orchestration/practice-plan
 */
(function (global) {
  'use strict';

  /**
   * 创建空白 PracticePlan。
   * @param {Object} [init]
   * @returns {Object}
   */
  function createPracticePlan(init) {
    init = init || {};
    return {
      totalCount: init.totalCount != null ? init.totalCount : 0,
      selectedTypes: Array.isArray(init.selectedTypes) ? init.selectedTypes.slice() : [],
      typeBudgets: Array.isArray(init.typeBudgets) ? init.typeBudgets.slice() : [],
      kpBudgets: Array.isArray(init.kpBudgets) ? init.kpBudgets.slice() : [],
      remainingBudget: init.remainingBudget != null ? init.remainingBudget : (init.totalCount != null ? init.totalCount : 0),
      status: init.status || 'READY'
    };
  }

  /**
   * 创建 TypeBudget。
   * @param {string} type
   * @param {Object} [init] { minimum, target, capacity, allocated }
   * @returns {Object}
   */
  function createTypeBudget(type, init) {
    init = init || {};
    return {
      type: type,
      minimum: init.minimum != null ? init.minimum : 0,
      target: init.target != null ? init.target : 0,
      capacity: init.capacity != null ? init.capacity : Infinity,
      allocated: init.allocated != null ? init.allocated : 0
    };
  }

  /**
   * 创建 KPBudget（某题型下某 KP 的配额）。
   * @param {string} type
   * @param {string} kpId
   * @param {number} quota
   * @returns {Object}
   */
  function createKpBudget(type, kpId, quota) {
    return { type: type, kpId: kpId, quota: quota };
  }

  /**
   * 统计题目数组的题型分布（ questionType 字段）。
   * @param {Array} questions
   * @returns {Object} { type: count }
   */
  function aggregateTypeDistribution(questions) {
    var dist = {};
    (questions || []).forEach(function (q) {
      var t = q && (q.questionType || (q.answer && q.answer.type) || null);
      if (!t) return;
      dist[t] = (dist[t] || 0) + 1;
    });
    return dist;
  }

  /**
   * 构建编排账本（可审计诊断数据，不进 UI）。
   * @param {Object} data
   * @returns {Object}
   */
  function buildLedger(data) {
    data = data || {};
    var selected = Array.isArray(data.selectedTypes) ? data.selectedTypes : [];
    var covered = Array.isArray(data.coveredTypes) ? data.coveredTypes : [];
    return {
      requestedCount: data.requestedCount != null ? data.requestedCount : 0,
      plannedCount: data.plannedCount != null ? data.plannedCount : 0,
      generatedCount: data.generatedCount != null ? data.generatedCount : 0,
      validCount: data.validCount != null ? data.validCount : (data.finalCount != null ? data.finalCount : 0),
      dedupedCount: data.dedupedCount != null ? data.dedupedCount : 0,
      finalCount: data.finalCount != null ? data.finalCount : 0,
      selectedTypeCount: selected.length,
      coveredTypeCount: covered.length,
      selectedTypes: selected.slice(),
      coveredTypes: covered.slice(),
      missingTypes: selected.filter(function (t) { return covered.indexOf(t) === -1; }),
      typeDistribution: data.typeDistribution || {},
      exhaustedTypes: Array.isArray(data.exhaustedTypes) ? data.exhaustedTypes.slice() : [],
      exhaustedKps: Array.isArray(data.exhaustedKps) ? data.exhaustedKps.slice() : [],
      capacityExhausted: !!data.capacityExhausted,
      generationFailed: !!data.generationFailed,
      budgetRecovered: data.budgetRecovered != null ? data.budgetRecovered : 0,
      coverageStatus: data.coverageStatus || 'OK',
      reason: data.reason || null
    };
  }

  var API = {
    createPracticePlan: createPracticePlan,
    createTypeBudget: createTypeBudget,
    createKpBudget: createKpBudget,
    aggregateTypeDistribution: aggregateTypeDistribution,
    buildLedger: buildLedger
  };

  global.PracticePlan = API;
  if (global.App && typeof global.App === 'object') global.App.PracticePlan = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : global);
