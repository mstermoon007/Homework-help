/**
 * shared/generation/api.js — 生成层冻结门面 API (Phase 0 Task 0.1)
 *
 * 冻结方法：
 *   - generate(request): Promise<GenerateResult>
 *   - generateSync(request): GenerateResult
 *   - validatePlan(plan): string[]
 *
 * 依赖注入：通过 inject({...}) 注入 Orchestrator/Strategy/Renderer 等内部模块；
 * 不直接 require 任何内部模块路径，浏览器下走全局兜底。
 * 使用 Object.freeze 防止外部修改。
 *
 * @module shared/generation/api
 */
(function (global) {
  'use strict';

  var isBrowser = typeof window !== 'undefined';

  // ---------- 依赖注入 (DI) ----------
  /**
   * 依赖注册表：内部模块一律通过 inject({...}) 或浏览器全局注入，
   * 不直接 require 内部模块路径。
   * @type {Object}
   */
  var _deps = {};

  /**
   * 依赖名 → 浏览器全局兜底 key
   * @type {Object}
   */
  var DEP_GLOBAL_KEYS = {
    orchestrator: 'PresentationEngine',
    strategyEngine: 'StrategyEngine',
    comprehensiveStrategy: 'ComprehensiveStrategy',
    legacyAdapter: 'LegacyPluginAdapter',
    presentationRenderer: 'PresentationRenderer',
    renderOptions: 'RenderOptions',
    generatorRegistry: 'GeneratorRegistry',
    strategyValidator: 'StrategyValidator'
  };

  /**
   * 注入内部模块 (管理接口，非业务方法)。
   * @param {Object} deps
   * @returns {Object} API (支持链式调用)
   */
  function inject(deps) {
    if (!deps || typeof deps !== 'object') {
      throw new Error('inject(deps) 需要对象');
    }
    for (var k in deps) { if (Object.prototype.hasOwnProperty.call(deps, k)) _deps[k] = deps[k]; }
    return API;
  }

  /** 取依赖：先注册表，后全局兜底 (浏览器 window / Node global) */
  function getDep(name) {
    if (_deps[name]) return _deps[name];
    var key = DEP_GLOBAL_KEYS[name];
    var g = (typeof window !== 'undefined' && window[key]) || (typeof global !== 'undefined' && global[key]);
    if (g) {
      _deps[name] = g;
      return _deps[name];
    }
    return null;
  }

  function getOrchestrator() { return getDep('orchestrator'); }
  function getLegacyAdapter() { return getDep('legacyAdapter'); }
  function getPresentationRenderer() { return getDep('presentationRenderer'); }
  function getRenderOptions() { return getDep('renderOptions'); }
  function getGeneratorRegistry() { return getDep('generatorRegistry'); }
  function getStrategyValidator() { return getDep('strategyValidator'); }
  function getStrategyEngine() { return getDep('strategyEngine'); }
  function getComprehensiveStrategy() { return getDep('comprehensiveStrategy'); }

  // ---------- 内部辅助 ----------
  function isComprehensive(request) {
    if (!request) return false;
    if (request.mode === 'comprehensive') return true;
    return request.model === 'comprehensive' ||
      request.comprehensive === true ||
      (!request.knowledgePointId && request.subject && request.grade != null);
  }

  var MODE_ALIAS = {
    'single': 'single-kp', 'single-kp': 'single-kp', 'kp': 'single-kp',
    'multi': 'multi-kp', 'multi-kp': 'multi-kp',
    'comprehensive': 'comprehensive', 'zonghe': 'comprehensive',
    'adaptive': 'adaptive', 'adaptive-kp': 'adaptive'
  };
  function normMode(request) {
    return request && MODE_ALIAS[request.mode] || null;
  }

  // ---------- 核心实现 ----------
  /**
   * 仅规划：GenerateRequest → QuestionPlan[]
   * @param {Object} request - GenerateRequest
   * @returns {Promise<{plans:Array, trace:Object}>}
   */
  function build(request) {
    if (!request || typeof request !== 'object') {
      return Promise.reject(new Error('GenerateRequest 必须是对象'));
    }
    var mode = normMode(request);
    var orch = getOrchestrator();
    var StrategyEngine = getStrategyEngine();
    var ComprehensiveStrategy = getComprehensiveStrategy();

    if (mode === 'comprehensive' || mode === 'adaptive' || isComprehensive(request)) {
      if (!ComprehensiveStrategy) return Promise.reject(new Error('ComprehensiveStrategy 不可用'));
      return Promise.resolve(ComprehensiveStrategy.build(request));
    }

    if (mode === 'multi-kp' || (request.knowledgePoints && Array.isArray(request.knowledgePoints) && request.knowledgePoints.length)) {
      if (!StrategyEngine) return Promise.reject(new Error('StrategyEngine 不可用'));
      var kpList = request.knowledgePoints;
      var plans = [];
      var trace = { mode: 'multi-kp', kps: kpList.length };
      var seq = Promise.resolve();
      kpList.forEach(function (kpId) {
        seq = seq.then(function () {
          var single = {
            knowledgePointId: kpId, grade: request.grade,
            count: request.count, difficulty: request.difficulty,
            questionType: request.questionType, subtype: request.subtype,
            learnerProfile: request.learnerProfile
          };
          var r = StrategyEngine.plan(single);
          return (r.plans && r.plans[0]) || null;
        }).then(function (plan) {
          if (plan) plans.push(plan);
        }).catch(function () { /* skip */ });
      });
      return seq.then(function () { return { plans: plans, trace: trace }; });
    }

    if (!StrategyEngine) return Promise.reject(new Error('StrategyEngine 不可用'));
    try {
      var result = StrategyEngine.plan(request);
      return Promise.resolve({ plans: (result && result.plans) || [], trace: (result && result.trace) || {} });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * 执行计划生成语义题目
   * @param {Array} plans
   * @param {Object} options
   * @returns {Promise<{questions:Array, trace:Object}>}
   */
  function runPlans(plans, options) {
    var orch = getOrchestrator();
    if (!orch) return Promise.reject(new Error('PresentationEngine 不可用'));
    var results = [];
    var failedPlans = [];
    var seq = Promise.resolve();
    plans.forEach(function (plan) {
      seq = seq.then(function () {
        try {
          return orch.generateQuestions(plan, {
            legacyOutput: options.legacyOutput === true,
            skipValidation: options.skipValidation
          });
        } catch (e) {
          failedPlans.push({ planId: plan.planId || plan.knowledgePointId, error: String(e && e.message || e) });
          return null;
        }
      }).then(function (res) {
        if (!res) return;
        var sqs = res.semanticQuestions || res.questions || [];
        results.push.apply(results, sqs);
      }).catch(function (err) {
        failedPlans.push({ planId: plan.planId || plan.knowledgePointId, error: String(err && err.message || err) });
      });
    });
    return seq.then(function () {
      return { questions: results, trace: { failedPlans: failedPlans } };
    });
  }

  /**
   * 渲染 SemanticQuestion[] → HTML
   * @param {Array} questions
   * @param {Object} renderOptions
   * @param {number} columns
   * @returns {Object} {items, html, renderOptions}
   */
  function renderQuestions(questions, renderOptions, columns) {
    var R = getPresentationRenderer();
    if (!R) throw new Error('PresentationRenderer 不可用');
    return R.renderAll(questions || [], renderOptions, { columns: columns });
  }

  /**
   * 主入口：生成 + 渲染
   * @param {Object} request - GenerateRequest
   * @param {Object} [options] - { renderOptions, columns, legacyOutput, skipValidation }
   * @returns {Promise<GenerateResult>}
   */
  function generate(request, options) {
    options = options || {};
    var RO = getRenderOptions();
    var ro = RO ? RO.normalize(options.renderOptions) : { mode: 'screen', theme: 'default', device: 'desktop', density: 'normal' };

    return build(request).then(function (built) {
      var plans = built.plans || [];
      return runPlans(plans, options).then(function (run) {
        var questions = run.questions;
        var mergedTrace = built.trace || {};
        if (run.trace && run.trace.failedPlans) mergedTrace.failedPlans = run.trace.failedPlans;
        var renderOutline = renderQuestions(questions, ro, options.columns);
        return {
          questions: questions,
          items: renderOutline.items,
          html: renderOutline.html,
          renderOptions: renderOutline.renderOptions,
          plans: plans,
          trace: mergedTrace,
          failedPlans: (run.trace && run.trace.failedPlans) || []
        };
      });
    });
  }

  /**
   * 同步版本 (内部/兼容用) —— 仅支持已缓存/同步路径
   * @param {Object} request
   * @param {Object} [options]
   * @returns {GenerateResult}
   */
  function generateSync(request, options) {
    options = options || {};
    var RO = getRenderOptions();
    var ro = RO ? RO.normalize(options.renderOptions) : { mode: 'screen', theme: 'default', device: 'desktop', density: 'normal' };

    // 同步路径仅支持 single-kp + 无 legacy + 无验证跳过
    var mode = normMode(request);
    if (mode !== 'single-kp' && !isComprehensive(request)) {
      throw new Error('generateSync 仅支持 single-kp/comprehensive 模式，multi-kp 请用异步 generate');
    }

    var StrategyEngine = getStrategyEngine();
    var ComprehensiveStrategy = getComprehensiveStrategy();
    var orch = getOrchestrator();
    if (!StrategyEngine || !orch) throw new Error('同步依赖未就绪');

    var plans, trace;
    if (mode === 'comprehensive' || isComprehensive(request)) {
      if (!ComprehensiveStrategy) throw new Error('ComprehensiveStrategy 不可用');
      var built = ComprehensiveStrategy.build(request);
      plans = built.plans || [];
      trace = built.trace || {};
    } else {
      var result = StrategyEngine.plan(request);
      plans = (result && result.plans) || [];
      trace = (result && result.trace) || {};
    }

    var results = [];
    var failedPlans = [];
    plans.forEach(function (plan) {
      try {
        var res = orch.generateQuestions(plan, { legacyOutput: options.legacyOutput === true, skipValidation: options.skipValidation });
        var sqs = res.semanticQuestions || res.questions || [];
        results.push.apply(results, sqs);
      } catch (e) {
        failedPlans.push({ planId: plan.planId || plan.knowledgePointId, error: String(e && e.message || e) });
      }
    });

    var renderOutline = renderQuestions(results, ro, options.columns);
    return {
      questions: results,
      items: renderOutline.items,
      html: renderOutline.html,
      renderOptions: renderOutline.renderOptions,
      plans: plans,
      trace: Object.assign({}, trace, { failedPlans: failedPlans }),
      failedPlans: failedPlans
    };
  }

  /**
   * 计划校验 (供外部调用)
   * @param {Object} plan - QuestionPlan
   * @returns {string[]} 错误信息数组，空数组表示通过
   */
  function validatePlan(plan) {
    var validator = getStrategyValidator();
    if (!validator || typeof validator.validatePlan !== 'function') {
      return ['StrategyValidator 不可用'];
    }
    var result = validator.validatePlan(plan);
    return result.valid ? [] : (result.errors || ['未知校验错误']);
  }

  /**
   * 旧插件生成 (R18)
   * @param {Object} options - LegacyGenerateOptions
   * @returns {Promise<LegacyGenerateResult>}
   */
  function generateLegacy(options) {
    var PA = getLegacyAdapter();
    if (!PA) return Promise.reject(new Error('LegacyPluginAdapter 不可用'));
    var pluginId = options && options.pluginId;
    if (!pluginId) return Promise.reject(new Error('generateLegacy 需要 pluginId'));
    return PA.generateByPluginId(pluginId, options).then(function (set) {
      if (!set || !Array.isArray(set.questions)) {
        throw new Error('Legacy 插件 generate 必须返回 { questions: [] }');
      }
      return { set: set, source: 'legacy', renderOptions: null };
    });
  }

  /**
   * 旧题组渲染桥
   * @param {Object} set
   * @param {string} pluginId
   * @returns {string|null}
   */
  function renderLegacySet(set, pluginId) {
    var PA = getLegacyAdapter();
    if (!PA || typeof PA.renderSet !== 'function') return null;
    return PA.renderSet(set, pluginId);
  }

  /**
   * Generator 解析
   * @param {Object} query
   * @returns {Object|null}
   */
  function resolveGenerator(query) {
    var G = getGeneratorRegistry();
    return (G && typeof G.resolve === 'function') ? G.resolve(query || {}) : null;
  }

  // ---------- 冻结公开 API ----------
  var API = Object.freeze({
    /**
     * 异步生成主入口
     * @param {GenerateRequest} request
     * @param {Object} [options]
     * @returns {Promise<GenerateResult>}
     */
    generate: generate,

    /**
     * 同步生成 (受限模式)
     * @param {GenerateRequest} request
     * @param {Object} [options]
     * @returns {GenerateResult}
     */
    generateSync: generateSync,

    /**
     * 计划校验
     * @param {QuestionPlan} plan
     * @returns {string[]}
     */
    validatePlan: validatePlan,

    /**
     * 依赖注入 (管理接口，非业务方法)
     * @param {Object} deps
     * @returns {Object} API
     */
    inject: inject
  });

  // 兼容：挂载到全局 App.GenerationAPI (不覆盖 GenerationEngine)
  global.GenerationAPI = API;
  if (global.App && typeof global.App === 'object') global.App.GenerationAPI = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : global);