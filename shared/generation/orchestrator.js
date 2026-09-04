/**
 * shared/generation/orchestrator.js — 生成编排器 (Phase 0 Task 0.2 + 0.5)
 *
 * 按固定流程 orchestrate(request):
 *   请求校验(轻量) → Strategy Engine 生成 QuestionPlan → 选择 Generator
 *   → 生成题目 → 校验管道 → 返回结果。
 *
 * 预留 registerService / getService 服务注册表；生成核心初始化时创建服务
 * 适配器 (knowledge-graph / capability / module-catalog / plugin-loader)
 * 并通过 registerService 注入 (Task 0.5)。
 *
 * 内部模块导入 strategy/validator/generator 等模块时，一律经服务接口路由，
 * 不直接导入中间关联层 (capability/knowledge-bank/module-catalog)。
 *
 * @module shared/generation/orchestrator
 */
(function (global) {
  'use strict';

  // ---------- 服务注册表 & 初始化 (Task 0.5) ----------
  var _services = {};

  /**
   * 注册服务 (如知识点图谱、学生模型)。
   * @param {string} name
   * @param {*} service
   * @returns {Object} Orchestrator
   */
  function registerService(name, service) {
    _services[name] = service;
    return Orchestrator;
  }

  /**
   * 按名称取已注册服务。
   * @param {string} name
   * @returns {*} 服务或 undefined
   */
  function getService(name) {
    return _services[name];
  }

  // 生成核心初始化：创建各服务适配器并注入 (Task 0.5)
  // 路径: adapters/* 相对本文件 (shared/generation/orchestrator.js)
  var ADAPTER_PATHS = [
    ['knowledge-graph', './adapters/knowledge-graph-service.adapter.js'],
    ['capability', './adapters/capability-service.adapter.js'],
    ['module-catalog', './adapters/module-catalog-service.adapter.js'],
    ['plugin-loader', './adapters/plugin-loader-service.adapter.js']
  ];
  var _initialized = false;
  function initServices() {
    if (_initialized) return true;
    _initialized = true;
    for (var i = 0; i < ADAPTER_PATHS.length; i++) {
      var name = ADAPTER_PATHS[i][0];
      var rel = ADAPTER_PATHS[i][1];
      try {
        var svc = null;
        if (typeof require === 'function') { try { svc = require(rel); } catch (e) { /* ignore */ } }
        if (svc) registerService(name, svc);
      } catch (e) { /* 跳过不可用适配器 */ }
    }
    return true;
  }

  // ---------- 内部模块导入 (后续阶段替换为服务接口) ----------
  var DEP_GLOBAL_KEYS = {
    strategyEngine: 'StrategyEngine',
    strategyValidator: 'StrategyValidator',
    comprehensiveStrategy: 'ComprehensiveStrategy',
    orchestratorEngine: 'PresentationEngine'
  };
  var _deps = {};

  function getDep(name) {
    if (_deps[name]) return _deps[name];
    var key = DEP_GLOBAL_KEYS[name];
    if (key && typeof window !== 'undefined' && window[key]) {
      _deps[name] = window[key];
      return _deps[name];
    }
    return null;
  }

  // ---------- 请求校验 (轻量) ----------
  /**
   * 轻量校验：仅检查对象/必填字段最小集，重校验走校验管道。
   * @param {Object} request
   * @returns {string[]} 错误信息数组，空数组表示通过
   */
  function lightweightValidate(request) {
    if (!request || typeof request !== 'object') return ['request 必须是对象'];
    var errs = [];
    var hasKp = request.knowledgePointId || request.knowledgePoint || request.kp;
    var hasMultiKps = Array.isArray(request.knowledgePoints) && request.knowledgePoints.length;
    var hasSubjectGrade = request.subject && request.grade != null;
    if (!hasKp && !hasMultiKps && !hasSubjectGrade) {
      errs.push('缺少 knowledgePointId / knowledgePoints / (subject+grade)');
    }
    if (request.count != null && (typeof request.count !== 'number' || request.count < 1)) {
      errs.push('count 必须 >=1');
    }
    if (request.targetDifficulty != null && (request.targetDifficulty < 1 || request.targetDifficulty > 10)) {
      errs.push('targetDifficulty 必须为 1-10');
    }
    return errs;
  }

  // ---------- orchestrate ----------
  /**
   * 固定流程编排: 校验 → Strategy → Generator → 生成题目 → 校验管道 → 结果
   * @param {Object} request - GenerateRequest
   * @param {Object} [options] - { legacyOutput, skipValidation }
   * @returns {{plans: Array, questions: Array, failedPlans: Array, trace: Object}}
   */
  function orchestrate(request, options) {
    options = options || {};

    // 1. 请求校验 (轻量)
    var lightErrs = lightweightValidate(request);
    if (lightErrs.length) {
      return { plans: [], questions: [], failedPlans: [], trace: { error: lightErrs.join('; ') } };
    }

    var StrategyEngine = getDep('strategyEngine');
    var ComprehensiveStrategy = getDep('comprehensiveStrategy');
    var OrchestratorEngine = getDep('orchestratorEngine');
    var StrategyValidator = getDep('strategyValidator');

    // 2-3. 调 Strategy Engine 生成 QuestionPlan (含 Generator 选择)
    var plans = [];
    var trace = {};
    var isComprehensive = request.comprehensive === true || request.mode === 'comprehensive' ||
      (!request.knowledgePointId && request.subject && request.grade != null);
    var isMultiKp = request.mode === 'multi-kp' ||
      (Array.isArray(request.knowledgePoints) && request.knowledgePoints.length);

    if (isComprehensive) {
      if (!ComprehensiveStrategy || typeof ComprehensiveStrategy.build !== 'function') {
        return { plans: [], questions: [], failedPlans: [], trace: { error: 'ComprehensiveStrategy 不可用' } };
      }
      var built = ComprehensiveStrategy.build(request);
      plans = built.plans || [];
      trace = built.trace || {};
    } else if (isMultiKp) {
      if (!StrategyEngine || typeof StrategyEngine.plan !== 'function') {
        return { plans: [], questions: [], failedPlans: [], trace: { error: 'StrategyEngine 不可用' } };
      }
      var kps = request.knowledgePoints;
      plans = [];
      kps.forEach(function (kpId) {
        try {
          var single = { knowledgePointId: kpId, grade: request.grade, count: request.count, difficulty: request.difficulty, questionType: request.questionType, subtype: request.subtype, learnerProfile: request.learnerProfile };
          var r = StrategyEngine.plan(single);
          if (r && r.plans && r.plans[0]) plans.push(r.plans[0]);
        } catch (e) { /* skip */ }
      });
      trace = { mode: 'multi-kp', kps: kps.length };
    } else {
      if (!StrategyEngine || typeof StrategyEngine.plan !== 'function') {
        return { plans: [], questions: [], failedPlans: [], trace: { error: 'StrategyEngine 不可用' } };
      }
      var r2 = StrategyEngine.plan(request);
      plans = (r2 && r2.plans) || [];
      trace = (r2 && r2.trace) || {};
    }

    // 4-5. 生成题目 + 校验管道 (经 PresentationEngine / OrchestratorEngine)
    var questions = [];
    var failedPlans = [];
    (plans || []).forEach(function (plan) {
      try {
        // 5. 校验管道 (若未跳过)
        if (!options.skipValidation && StrategyValidator && typeof StrategyValidator.validatePlan === 'function') {
          var vr = StrategyValidator.validatePlan(plan);
          if (vr && vr.valid === false) {
            var msgs = (vr.errors && vr.errors.length) ? vr.errors : ['校验未通过'];
            failedPlans.push({ planId: plan.planId || plan.knowledgePointId, error: msgs.join('; ') });
            return;
          }
        }
        if (!OrchestratorEngine || typeof OrchestratorEngine.generateQuestions !== 'function') {
          failedPlans.push({ planId: plan.planId || plan.knowledgePointId, error: 'OrchestratorEngine 不可用' });
          return;
        }
        var res = OrchestratorEngine.generateQuestions(plan, {
          legacyOutput: options.legacyOutput === true,
          skipValidation: options.skipValidation,
          seenKeys: options.seenKeys || null
        });
        var sqs = (res && (res.semanticQuestions || res.questions)) || [];
        questions.push.apply(questions, sqs);
      } catch (e) {
        failedPlans.push({ planId: plan.planId || plan.knowledgePointId, error: String(e && e.message || e) });
      }
    });

    trace.failedPlans = failedPlans;
    return { plans: plans, questions: questions, failedPlans: failedPlans, trace: trace };
  }

  // ---------- 冻结公开 API ----------
  var Orchestrator = Object.freeze({
    orchestrate: orchestrate,
    registerService: registerService,
    getService: getService
  });

  // 生成核心初始化：创建并注入各服务适配器 (Task 0.5)
  initServices();

  // 兼容：挂载到全局 App.Orchestrator 与 window.Orchestrator (浏览器)
  global.Orchestrator = Orchestrator;
  if (global.App && typeof global.App === 'object') global.App.Orchestrator = Orchestrator;
  if (typeof module !== 'undefined' && module.exports) module.exports = Orchestrator;

})(typeof window !== 'undefined' ? window : global);
