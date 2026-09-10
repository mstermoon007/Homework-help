/**
 * shared/orchestration/budget-allocation.js — 题型级预算分配（Round-Robin 均衡 + 容量约束 + 缺口回收）
 *
 * 纯函数层，不读 Capacity 文件、不生成、不接触 Generator / Validator / KnowledgeBank。
 * 容量数据（typeCaps）由调用方（practice-orchestrator）注入：node 端来自 capacity-inventory，
 * 浏览器端无 fs 则传 Infinity（不封顶），正确性由编排层 recovery 兜底。
 *
 * 核心算法：
 *   allocateTypeBudgets  —— 题型覆盖保底（每题型 ≥1，当 count ≥ 题型数）+ 剩余预算 Round-Robin 均衡
 *                           + 题型容量封顶（typeCaps）+ 封顶溢出回流（CAPACITY_LIMITED）
 *   allocateRecovery     —— 首轮短产后，按「剩余题型容量」二次分配缺口，终止条件内收敛
 *
 * @module shared/orchestration/budget-allocation
 */
(function (global) {
  'use strict';

  /**
   * 题型覆盖 + 均衡 + 容量分配。
   * @param {Object} args
   *   count        : 总题量预算（>=1 整数）
   *   questionTypes: canonical 题型数组（如 ['calc','fill',...]）
   *   typeCaps     : { type: capacity } 题型容量（无 fs 时传 Infinity / 不传）
   * @returns {{
   *   typeCounts: Array<{questionType:string,count:number}>,
   *   coverageStatus: string,   // OK | TYPE_COVERAGE_INFEASIBLE | CAPACITY_LIMITED | EMPTY
   *   reason: string|null,
   *   typeCaps: Object,
   *   plannedTotal: number
   * }}
   */
  function allocateTypeBudgets(args) {
    var count = args && args.count != null ? args.count : 0;
    var types = (args && Array.isArray(args.questionTypes)) ? args.questionTypes.filter(Boolean) : [];
    var capsIn = (args && args.typeCaps) || {};

    if (!types.length) {
      return { typeCounts: [], coverageStatus: 'EMPTY', reason: null, typeCaps: {}, plannedTotal: 0 };
    }

    var n = types.length;
    var caps = types.map(function (t) {
      var c = capsIn[t];
      if (c == null) return Infinity;
      c = Number(c);
      return isFinite(c) && c >= 0 ? c : Infinity;
    });
    var typeCapsOut = {};
    types.forEach(function (t, i) { typeCapsOut[t] = caps[i]; });

    // 可行题型（容量 >=1 或未知 Infinity）
    var feasible = types.map(function (_, i) { return caps[i] >= 1; });

    if (count >= n) {
      // 每题型保底 1
      var alloc = caps.map(function () { return 1; });
      var remaining = count - n;
      // Round-Robin：每轮给「当前题量最少且未达容量」的题型 +1，直到预算耗尽或全封顶
      var guard = remaining + n + 1; // 安全上限，避免极端情况下死循环
      while (remaining > 0 && guard-- > 0) {
        var pick = -1, minVal = Infinity;
        for (var i = 0; i < n; i++) {
          if (alloc[i] < caps[i] && alloc[i] < minVal) { minVal = alloc[i]; pick = i; }
        }
        if (pick === -1) break; // 全部题型达容量上限
        alloc[pick] += 1;
        remaining -= 1;
      }
      var plannedTotal = alloc.reduce(function (a, b) { return a + b; }, 0);
      var typeCounts = types.map(function (t, i) { return { questionType: t, count: alloc[i] }; })
        .filter(function (e) { return e.count > 0; });
      var status = remaining > 0 ? 'CAPACITY_LIMITED' : 'OK';
      var reason = remaining > 0
        ? '部分题型容量已耗尽，预算上限收敛于 ' + plannedTotal + '（请求 ' + count + '）'
        : null;
      return { typeCounts: typeCounts, coverageStatus: status, reason: reason, typeCaps: typeCapsOut, plannedTotal: plannedTotal };
    }

    // count < 题型数：无法完整覆盖，最多交付 count 题（每题型 ≤1）
    var alloc2 = caps.map(function () { return 0; });
    var give = Math.min(count, feasible.filter(Boolean).length);
    var gi = 0, given = 0;
    while (given < give && gi < n) {
      if (caps[gi] >= 1) { alloc2[gi] = 1; given += 1; }
      gi += 1;
    }
    var plannedTotal2 = alloc2.reduce(function (a, b) { return a + b; }, 0);
    var typeCounts2 = types.map(function (t, i) { return { questionType: t, count: alloc2[i] }; })
      .filter(function (e) { return e.count > 0; });
    return {
      typeCounts: typeCounts2,
      coverageStatus: 'TYPE_COVERAGE_INFEASIBLE',
      reason: '请求题量 ' + count + ' < 题型数 ' + n + '，无法完整覆盖全部题型，最多交付 ' + plannedTotal2 + ' 题',
      typeCaps: typeCapsOut,
      plannedTotal: plannedTotal2
    };
  }

  /**
   * 缺口二次分配（Budget Recovery）。
   * 仅按「剩余题型容量 = typeCaps - produced」均衡补充，不重新创造预算。
   * @param {Object} args
   *   deficit       : 缺口数量（>0）
   *   questionTypes : canonical 题型
   *   typeCaps      : { type: capacity }（首轮已知上限）
   *   produced      : { type: 已产数量 }
   * @returns {{ typeCounts: Array, appliedTotal: number }}
   */
  function allocateRecovery(args) {
    var deficit = args && args.deficit != null ? args.deficit : 0;
    var types = (args && Array.isArray(args.questionTypes)) ? args.questionTypes.filter(Boolean) : [];
    var capsIn = (args && args.typeCaps) || {};
    var produced = (args && args.produced) || {};
    if (deficit <= 0 || !types.length) return { typeCounts: [], appliedTotal: 0 };

    var n = types.length;
    var headroom = types.map(function (t) {
      var c = capsIn[t];
      if (c == null) c = Infinity; else { c = Number(c); if (!isFinite(c) || c < 0) c = Infinity; }
      var p = Number(produced[t] || 0);
      return c - p; // 剩余可承担量
    });

    var alloc = headroom.map(function () { return 0; });
    var remaining = deficit;
    var guard = deficit + n + 1;
    while (remaining > 0 && guard-- > 0) {
      var pick = -1, minVal = Infinity;
      for (var i = 0; i < n; i++) {
        if (alloc[i] < headroom[i] && alloc[i] < minVal) { minVal = alloc[i]; pick = i; }
      }
      if (pick === -1) break;
      alloc[pick] += 1;
      remaining -= 1;
    }
    var appliedTotal = alloc.reduce(function (a, b) { return a + b; }, 0);
    var typeCounts = types.map(function (t, i) { return { questionType: t, count: alloc[i] }; })
      .filter(function (e) { return e.count > 0; });
    return { typeCounts: typeCounts, appliedTotal: appliedTotal };
  }

  var API = {
    allocateTypeBudgets: allocateTypeBudgets,
    allocateRecovery: allocateRecovery
  };

  global.BudgetAllocation = API;
  if (global.App && typeof global.App === 'object') global.App.BudgetAllocation = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : global);
