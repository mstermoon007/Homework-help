/**
 * shared/strategy/comprehensive-strategy.js — M7-R09…R13 综合练习策略
 *
 * 职责：把「年级全部知识点」按策略分配题量，产出 QuestionPlan[]，
 * 每个计划再经 StrategyEngine 决策 → Generator → Validator → Regenerate（R14）。
 *
 * 输入（R10）：
 *   { subject, grade, count, difficulty, questionTypes?, coveragePolicy?, learnerProfile? }
 *
 * coveragePolicy（R13）：
 *   weighted     按知识库 weight 配比（默认）
 *   balanced     每题均分
 *   weak-first   薄弱优先：mastery 低 → 权重高（依赖 learnerProfile）
 *   recent-first 近期优先：曝光少/recent 少 → 权重高（依赖 learnerProfile）
 *
 * 输出：{ plans: QuestionPlan[]（已混排）,
 *         allocation: [{kpId,name,pluginId,moduleId,count,weight,policyScore}],
 *         trace: { policy, coverage, entries, failedPlans, mixing } }
 */
(function (global) {
  'use strict';

  var DEFAULT_DIFFICULTY = 2; // 中等（同时符合静态难度 1..5 约束并留出 learner 调节空间）

  function getKB() {
    if (typeof global !== 'undefined' && global.KnowledgeBank) return global.KnowledgeBank;
    if (typeof require === 'function') {
      try { return require('../knowledge-bank.js'); } catch (e) { /* ignore */ }
    }
    return null;
  }

  function getStrategyEngine() {
    if (typeof global !== 'undefined' && global.StrategyEngine) return global.StrategyEngine;
    if (typeof require === 'function') {
      try { return require('./strategy-engine.js'); } catch (e) { /* ignore */ }
    }
    return null;
  }

  // ============ 题量按权重分配（最大余数法，稳定保序） ============
  function allocateByWeight(weights, total) {
    var n = weights.length;
    var out = new Array(n).fill(0);
    var wsum = 0;
    var fracs = [];
    for (var i = 0; i < n; i++) {
      var w = (typeof weights[i] === 'number' && weights[i] > 0) ? weights[i] : 0;
      wsum += w;
      fracs.push({ i: i, w: w });
    }
    if (wsum <= 0) return out;
    var shares = new Array(n).fill(0);
    var assigned = 0;
    for (var j = 0; j < n; j++) {
      shares[j] = Math.floor(total * weights[j] / wsum);
      assigned += shares[j];
    }
    var leftover = total - assigned;
    if (leftover > 0) {
      fracs.sort(function (a, b) {
        var fa = total * a.w / wsum - Math.floor(total * a.w / wsum);
        var fb = total * b.w / wsum - Math.floor(total * b.w / wsum);
        return fb - fa || b.w - a.w;
      });
      for (var k = 0; k < leftover; k++) {
        if (k < n) shares[fracs[k].i] += 1;
      }
    }
    return shares;
  }

  /** 读取某知识点在 learnerProfile 中的状态（无则返回 null） */
  function kpLearnerState(profile, kpId) {
    if (!profile || typeof profile !== 'object') return null;
    if (profile.knowledgePoints && profile.knowledgePoints[kpId] && typeof profile.knowledgePoints[kpId] === 'object') {
      return profile.knowledgePoints[kpId];
    }
    return null;
  }

  /**
   * 计算各条目 policy 权重。
   * 返回 [{ index, base, policyScore }]（policyScore 归一化到总和=条目数）。
   */
  function scoreEntries(entries, policy, profile) {
    return entries.map(function (e, idx) {
      var base = (typeof e.weight === 'number' && e.weight > 0) ? e.weight : 1;
      var raw = base;
      var ls = kpLearnerState(profile, e.id);
      if (policy === 'balanced') {
        raw = 1;
      } else if (policy === 'weak-first') {
        if (ls && typeof ls.mastery === 'number') {
          raw = base * (1 + Math.pow(1 - Math.min(Math.max(ls.mastery, 0), 1), 1.5));
        } else {
          raw = base * 2; // 从未见过 → 视为最薄弱
        }
      } else if (policy === 'recent-first') {
        var exposure = ls && typeof ls.exposure === 'number' ? Math.max(ls.exposure, 0) : 0;
        raw = base * (1 + 1 / (1 + exposure));
      } // weighted: raw = base
      return { index: idx, base: base, policyScore: raw };
    });
  }

  /**
   * 综合练习计划生成。
   * @param {Object} request { subject, grade, count, difficulty, questionTypes?, coveragePolicy?, learnerProfile?, debug? }
   * @returns {Promise<{ plans:Array, allocation:Array, trace:Object }>}
   */
  function build(request) {
    if (!request || typeof request !== 'object') return Promise.reject(new Error('comprehensive request 必须是对象'));
    var subject = request.subject;
    var grade = request.grade;
    if (!subject) return Promise.reject(new Error('comprehensive 需要 subject'));
    if (grade == null) return Promise.reject(new Error('comprehensive 需要 grade'));
    var targetCount = request.count != null ? request.count : 10;
    if (typeof targetCount !== 'number' || !isFinite(targetCount) || targetCount < 1 || Math.floor(targetCount) !== targetCount) {
      return Promise.reject(new Error('count 必须是 >=1 的整数: ' + targetCount));
    }
    var policy = ['weighted', 'balanced', 'weak-first', 'recent-first'].indexOf(request.coveragePolicy) !== -1
      ? request.coveragePolicy
      : 'weighted';
    var KB = getKB();
    var engine = getStrategyEngine();
    var deps = [];
    if (!KB) deps.push('shared/knowledge-bank.js');
    if (!engine) deps.push('shared/strategy-engine.bundle.js');
    if (deps.length) return Promise.reject(new Error('ComprehensiveStrategy 依赖缺失: ' + deps.join(', ')));

    var entries = KB.getEntries(subject, grade) || [];
    if (request.questionTypes && Array.isArray(request.questionTypes) && request.questionTypes.length) {
      var qts = request.questionTypes;
      entries = entries.filter(function (e) {
        return (e.type && qts.indexOf(e.type) !== -1) || qts.indexOf(e.pluginId) !== -1;
      });
    }
    if (!entries.length) {
      return Promise.resolve({ plans: [], allocation: [], trace: { policy: policy, coverage: { total: 0, covered: 0, ratio: 0 }, entries: [], fromEntries: false, message: '该年级无可用知识点' } });
    }

    var scored = scoreEntries(entries, policy, request.learnerProfile);
    var weights = scored.map(function (s) { return s.policyScore; });
    var shares = allocateByWeight(weights, targetCount);

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
        weight: scored[i].base,
        policyScore: Math.round(scored[i].policyScore * 100) / 100
      });
      if (cnt < 1) return;
      planTasks.push({ entry: e, count: cnt, baseWeight: scored[i].base });
    });

    // ============ 逐知识点走 StrategyEngine → QuestionPlan（R11 集成） ============
    var plans = [];
    var failedPlans = [];
    var difficulty = request.difficulty != null ? request.difficulty : DEFAULT_DIFFICULTY;

    planTasks.forEach(function (task) {
      var req = {
        knowledgePointId: task.entry.id,
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

    // ============ 跨知识点混合（R12）：相邻计划尽量不同 plugin，避免同类扎堆 ============
    var mixed = interleaveByPlugin(plans);
    var mixing = { reordered: mixed.length > 0, original: plans.length };

    // ============ 覆盖统计（R13 trace） ============
    var coveredIds = {};
    allocation.forEach(function (a) { if (a.count > 0) coveredIds[a.pluginId] = true; });
    var totalPlugins = {};
    entries.forEach(function (e) { totalPlugins[e.pluginId] = true; });

    return Promise.resolve({
      plans: mixed,
      allocation: allocation,
      trace: {
        policy: policy,
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

  /** 稳定圆桌混排：按 plugin 分组，再按组大小降序轮流取，保证相邻异构 */
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
    allocateByWeight: allocateByWeight,
    scoreEntries: scoreEntries,
    interleaveByPlugin: interleaveByPlugin,
    DEFAULT_DIFFICULTY: DEFAULT_DIFFICULTY
  };

  global.ComprehensiveStrategy = API;
  if (global.App && typeof global.App === 'object') global.App.ComprehensiveStrategy = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);