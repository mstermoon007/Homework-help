/**
 * shared/strategy/comprehensive-strategy.js — M7-R09…R13 综合练习策略 (P5 Task 4.1 统一分配器)
 *
 * 职责：把「年级全部知识点」按策略分配题量，产出 QuestionPlan[]，
 * 每个计划再经 StrategyEngine 决策 → Generator → Validator → Regenerate（R14）。
 *
 * 统一分配器：allocate(weights, total) 最大余数法
 * 策略对象：weighted / balanced / weak-first / recent-first → weight 函数
 * 保持四种现有策略输出不变。
 *
 * @module shared/strategy/comprehensive-strategy
 */
(function (global) {
  'use strict';

  var DEFAULT_DIFFICULTY = 2;

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

  // ============ 通用分配器：最大余数法 (Largest Remainder / Hamilton) ============
  /**
   * 最大余数法分配整数
   * @param {number[]} weights - 权重数组 (非负数)
   * @param {number} total - 总分配量 (正整数)
   * @returns {number[]} 分配结果，和为 total
   */
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

  // ============ 策略对象：四种策略各自的 weight 函数 ============
  /**
   * 读取某知识点在 learnerProfile 中的状态
   * @param {Object} profile
   * @param {string} kpId
   * @returns {Object|null}
   */
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
        return base * 2; // 未见过视为最薄弱
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

  // ============ 综合练习计划生成 ============
  /**
   * 生成综合练习计划
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
    var policyName = ['weighted', 'balanced', 'weak-first', 'recent-first'].indexOf(request.coveragePolicy) !== -1
      ? request.coveragePolicy
      : 'weighted';
    var strategy = STRATEGIES[policyName];

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
      return Promise.resolve({ plans: [], allocation: [], trace: { policy: policyName, coverage: { total: 0, covered: 0, ratio: 0 }, entries: [], fromEntries: false, message: '该年级无可用知识点' } });
    }

    // 计算策略权重
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

    // 逐知识点走 StrategyEngine → QuestionPlan
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

    // 跨知识点混合：相邻计划尽量不同 plugin
    var mixed = interleaveByPlugin(plans);
    var mixing = { reordered: mixed.length > 0, original: plans.length };

    // 覆盖统计
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
    allocate: allocate,
    allocateByWeight: allocate, // 兼容旧 API
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