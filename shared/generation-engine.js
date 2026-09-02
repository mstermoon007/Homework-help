/**
 * shared/generation-engine.js — M7-R08/R15 Generation Engine（统一生成最终入口）
 *
 * 主链（R08）：
 *   用户输入 → GenerationRequest → GenerationEngine.generate(request)
 *     → QuestionPlan[]（单点：StrategyEngine 决策；综合：ComprehensiveStrategy）
 *     → Generator / Retry / Validator（M5 管线，Regenerate 内建）
 *     → SemanticQuestion[]
 *     → PresentationRenderer.renderAll(questions, renderOptions) → RenderResult[] + HTML
 *
 * 内部构成（R15，唯一公开入口 App.GenerationEngine.generate）：
 *   GenerationEngine
 *    ├── KnowledgeResolver    → shared/generator-registry.js（capability 解析，不知具体插件）
 *    ├── StrategyEngine       → shared/strategy/strategy-engine.js（capability 语义规划）
 *    ├── QuestionPlanner      → shared/strategy/comprehensive-strategy.js（综合分配/混排）
 *    ├── GeneratorRegistry    → shared/generator-registry.js / generator/generator-registry.js
 *    ├── Validator            → shared/validator/validation-pipeline.js（Retry/Regenerate 内建）
 *    └── SemanticQuestionNormalizer → shared/semantic-question.js（工厂规范化）
 *   Legacy 旧插件路径（R18，唯一边界）：
 *    GenerationEngine.generateLegacy → shared/legacy/plugin-adapter.js → 旧 Plugin
 *
 * API：
 *   GenerationEngine.build(request)              → { plans, trace }（只规划不生成）
 *   GenerationEngine.generate(request, options) → Promise<{ questions, html, items, plans, trace, renderOptions }>
 *   GenerationEngine.generateLegacy(options)    → Promise<{ set, source:'legacy' }>（旧插件路径）
 *   GenerationEngine.render(questions, options) → { items, html, renderOptions }
 *   GenerationEngine.renderLegacySet(set, pluginId) → html（旧题组渲染桥）
 *   GenerationEngine.resolveGenerator(query)    → GeneratorRegistry.resolve（capability → 记录）
 *   GenerationEngine.pipeline                   → 内部构成说明（只读元数据）
 *
 * 规则：
 *   - 单点生成（有 knowledgePointId）→ StrategyEngine.plan 单计划；
 *   - 综合生成（subject+grade 且 model==='comprehensive' 或无 knowledgePointId）→ ComprehensiveStrategy；
 *   - 每个计划独立走 Validator Pipeline（R14），失败计划记入 trace.failedPlans 并跳过；
 *   - 渲染一律经 PresentationRenderer，产物只含 RenderResult，不暴露 generator/plugin；
 *   - legacy 旧插件不可被 UI/Strategy/Renderer 直接调用，统一经 generateLegacy。
 */
(function (global) {
  'use strict';

  var isBrowser = typeof window !== 'undefined';

  function ensure(kind, key, rel) {
    if (isBrowser && global[key]) return global[key];
    if (typeof require !== 'function') return null;
    try { return require(rel); } catch (e) { /* ignore */ }
    return null;
  }

  // Phase 0: 委托给 GenerationAPI（冻结门面）
  var GenerationAPI = ensure(null, 'GenerationAPI', './generation/api.js');

  function getStrategyEngine() {
    return ensure(null, 'StrategyEngine', './strategy/strategy-engine.js');
  }
  function getComprehensiveStrategy() {
    return ensure(null, 'ComprehensiveStrategy', './strategy/comprehensive-strategy.js');
  }
  function getPresentation() {
    return ensure(null, 'PresentationRenderer', './presentation/renderer.js');
  }
  function getPresentationEngine() {
    return ensure(null, 'PresentationEngine', './presentation-engine.js');
  }
  function getRenderOptions() {
    return ensure(null, 'RenderOptions', './presentation/render-options.js');
  }
  function getGeneratorRegistry() {
    return ensure(null, 'GeneratorRegistry', './generator-registry.js');
  }
  function getLegacyAdapter() {
    return ensure(null, 'LegacyPluginAdapter', './legacy/plugin-adapter.js');
  }

  // R15：内部构成说明（只读）
  var PIPELINE = {
    KnowledgeResolver: 'shared/generator-registry.js',
    StrategyEngine: 'shared/strategy/strategy-engine.js',
    QuestionPlanner: 'shared/strategy/comprehensive-strategy.js',
    GeneratorRegistry: 'shared/generator-registry.js',
    Validator: 'shared/validator/validation-pipeline.js',
    SemanticQuestionNormalizer: 'shared/semantic-question.js',
    LegacyAdapter: 'shared/legacy/plugin-adapter.js'
  };

  var isComprehensive = function (request) {
    if (!request) return false;
    if (request.mode === 'comprehensive') return true;
    return !!request && (
      request.model === 'comprehensive' ||
      (request.comprehensive === true) ||
      (!request.knowledgePointId && request.subject && request.grade != null)
    );
  };

  // R26：统一 mode 归一（single-kp / multi-kp / comprehensive / adaptive）
  var MODE_ALIAS = {
    'single': 'single-kp', 'single-kp': 'single-kp', 'kp': 'single-kp',
    'multi': 'multi-kp', 'multi-kp': 'multi-kp', 'multi-kp': 'multi-kp',
    'comprehensive': 'comprehensive', 'zonghe': 'comprehensive',
    'adaptive': 'adaptive', 'adaptive-kp': 'adaptive'
  };
  function normMode(request) {
    if (!request) return null;
    return MODE_ALIAS[request.mode] || null;
  }

  /**
   * 基于 request 生成 QuestionPlan[]（不实际出题）。
   * @returns {Promise<{ plans:Array, trace:Object }>}
   */
  function build(request) {
    if (!request || typeof request !== 'object') {
      return Promise.reject(new Error('GenerationRequest 必须是对象'));
    }
    // R26：统一 mode 路由
    var mode = normMode(request);
    var engine = getStrategyEngine();

    // comprehensive / adaptive（无单点 KP，通过 subject+grade 全量覆盖）
    if (mode === 'comprehensive' || mode === 'adaptive' || isComprehensive(request)) {
      var CS = getComprehensiveStrategy();
      if (!CS) return Promise.reject(new Error('ComprehensiveStrategy 不可用，请先加载 shared/strategy/comprehensive-strategy.js'));
      return Promise.resolve(CS.build(request));
    }

    // multi-kp：对每个显式 knowledgePoints 独立规划并合并 plans
    if (mode === 'multi-kp' || (request.knowledgePoints && Array.isArray(request.knowledgePoints) && request.knowledgePoints.length)) {
      if (!engine) return Promise.reject(new Error('StrategyEngine 不可用，请先加载 shared/strategy-engine.bundle.js'));
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
          var r = engine.plan(single);
          return (r.plans && r.plans[0]) || null;
        }).then(function (plan) {
          if (plan) plans.push(plan);
        }).catch(function () { /* 单点失败跳过 */ });
      });
      return seq.then(function () { return { plans: plans, trace: trace }; });
    }

    if (!engine) return Promise.reject(new Error('StrategyEngine 不可用，请先加载 shared/strategy-engine.bundle.js'));
    try {
      var result = engine.plan(request);
      var plans2 = (result && result.plans) || [];
      return Promise.resolve({ plans: plans2, trace: (result && result.trace) || {} });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function requireOrGlobal(key, rel) {
    if (isBrowser && global[key]) return global[key];
    if (typeof require === 'function') {
      try { return require(rel); } catch (e) { /* ignore */ }
    }
    return null;
  }

  /**
   * 生成 + 渲染（主链出口）—— 委托 GenerationAPI.generate
   * @param {Object} request GenerationRequest
   * @param {Object} [options] { renderOptions, columns, legacyOutput, skipValidation }
   * @returns {Promise<{ questions, items, html, plans, trace, renderOptions }>}
   */
  function generate(request, options) {
    if (GenerationAPI && typeof GenerationAPI.generate === 'function') {
      return GenerationAPI.generate(request, options);
    }
    // 回退：原内联实现（兼容性）
    options = options || {};
    var RO = getRenderOptions();
    var ro = RO ? RO.normalize(options.renderOptions) : { mode: 'screen', theme: 'default', device: 'desktop', density: 'normal' };
    var PE = getPresentationEngine();

    return build(request).then(function (built) {
      var plans = built.plans || [];
      return runPlans(plans, options).then(function (run) {
        var questions = run.questions;
        var mergedTrace = built.trace || {};
        if (run.trace && run.trace.failedPlans) mergedTrace.failedPlans = run.trace.failedPlans;
        var renderOutline = render(questions, ro, options.columns);
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
   * 同步生成 (Phase 0 Task 0.1) —— 委托 GenerationAPI.generateSync
   * @param {Object} request
   * @param {Object} [options]
   * @returns {Object} GenerateResult
   */
  function generateSync(request, options) {
    if (GenerationAPI && typeof GenerationAPI.generateSync === 'function') {
      return GenerationAPI.generateSync(request, options);
    }
    throw new Error('GenerationAPI.generateSync 不可用');
  }

  /**
   * 计划校验 (Phase 0 Task 0.1) —— 委托 GenerationAPI.validatePlan
   * @param {Object} plan QuestionPlan
   * @returns {string[]} 错误信息数组
   */
  function validatePlan(plan) {
    if (GenerationAPI && typeof GenerationAPI.validatePlan === 'function') {
      return GenerationAPI.validatePlan(plan);
    }
    // 回退：直接调用 StrategyValidator
    var validator = requireOrGlobal(null, './strategy/strategy-validator.js');
    if (validator && typeof validator.validatePlan === 'function') {
      var r = validator.validatePlan(plan);
      return r.valid ? [] : (r.errors || ['未知校验错误']);
    }
    return ['Validator 不可用'];
  }

  /** 依序执行各 QuestionPlan → SemanticQuestion[]（每计划内 Retry/Validator/Regenerate） */
  function runPlans(plans, options) {
    var PE = getPresentationEngine();
    // C02-05 无静默失败：PresentationEngine 缺失（P0-001 回归防护）时拒绝，
    // 不得静默返回空 questions（原先 `if (!PE) return null` 会吞掉全部计划）。
    if (!PE) return Promise.reject(new Error('PresentationEngine 不可用：generateQuestions 无法执行（P0-001 回归防护）'));
    var results = [];
    var failedPlans = [];
    var seq = Promise.resolve();
    plans.forEach(function (plan) {
      seq = seq.then(function () {
        try {
          return PE.generateQuestions(plan, {
            legacyOutput: options.legacyOutput === true,
            skipValidation: options.skipValidation
          });
        } catch (e) {
          failedPlans.push({ planId: plan.planId || plan.knowledgePointId, error: String(e && e.message || e) });
          return null;
        }
      }).then(function (res) {
        if (!res) return;
        var sqs = res.semanticQuestions || [];
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
   * 纯渲染：SemanticQuestion[] → { items, html, renderOptions }。
   * @param {Array<Object>} questions
   * @param {Object} [renderOptions]
   * @param {number} [columns]
   */
  function render(questions, renderOptions, columns) {
    var R = getPresentation();
    if (!R) throw new Error('PresentationRenderer 不可用，请先加载 shared/presentation/renderer.js');
    return R.renderAll(questions || [], renderOptions, { columns: columns });
  }

  /** 一站式：generate + render。 */
  function generateAndRender(request, options) {
    return generate(request, options);
  }

  /**
   * R15/R17：capability 解析（GeneratorRegistry.resolve），供外部校验/授权生成器。
   * query 形如 { subject, capability, questionType }。
   */
  function resolveGenerator(query) {
    var G = getGeneratorRegistry();
    if (!G || typeof G.resolve !== 'function') return null;
    return G.resolve(query || {});
  }

  // R28：边界断言状态（开发环境可启用）
  var _boundaryEnabled = false;
  var _boundaryLog = [];

  /**
   * R28：assertGenerationBoundary() — 跨层调用检测。
   * 启用后拦截 GenerationEngine 的 generate/generateLegacy/render/renderLegacySet，
   * 检查 UI→Plugin / Renderer→Generator / Strategy→Renderer 等非法反向依赖。
   * 返回 { enabled, violations[], check() }。
   */
  function assertGenerationBoundary(options) {
    options = options || {};
    var enabled = options.enabled !== false;
    _boundaryEnabled = enabled;
    _boundaryLog = [];

    if (enabled) {
      // UI → Plugin 检测：拦截 window.state.plugin.generate / .render 在 Engine 上下文期间的调用
      var pluginCalls = { generate: 0, render: 0 };
      if (typeof window !== 'undefined' && window.state && window.state.plugin) {
        var origPG = window.state.plugin.generate;
        var origPR = window.state.plugin.render;
        if (typeof origPG === 'function') {
          window.state.plugin.generate = function () {
            pluginCalls.generate++;
            _boundaryLog.push('VIOLATION: UI → plugin.generate() detected');
            return origPG.apply(this, arguments);
          };
        }
        if (typeof origPR === 'function') {
          window.state.plugin.render = function () {
            pluginCalls.render++;
            _boundaryLog.push('VIOLATION: UI → plugin.render() detected');
            return origPR.apply(this, arguments);
          };
        }
      }

      return {
        enabled: true,
        violations: function () { return _boundaryLog.slice(); },
        pluginCalls: pluginCalls,
        restore: function () {
          if (typeof window !== 'undefined' && window.state && window.state.plugin) {
            if (typeof origPG === 'function') window.state.plugin.generate = origPG;
            if (typeof origPR === 'function') window.state.plugin.render = origPR;
          }
          _boundaryEnabled = false;
        }
      };
    }

    return { enabled: false, violations: [], pluginCalls: { generate: 0, render: 0 }, restore: function () {} };
  }

  /**
   * R16/R18：旧插件统一生成入口。UI 不再直接调用 plugin.generate，
   * 一律经 GenerationEngine.generateLegacy(options) → LegacyPluginAdapter。
   * options 需含 pluginId；透传给旧插件 generate。
   * @returns {Promise<{ set:{questions,meta}, source:'legacy' }>}
   */
  function generateLegacy(options) {
    var optionsArg = options || {};
    var PA = getLegacyAdapter();
    if (!PA) {
      return Promise.reject(new Error('LegacyPluginAdapter 不可用，请先加载 shared/legacy/plugin-adapter.js'));
    }
    var pluginId = optionsArg.pluginId;
    if (!pluginId) {
      return Promise.reject(new Error('generateLegacy 需要 options.pluginId'));
    }
    return PA.generateByPluginId(pluginId, optionsArg).then(function (set) {
      if (!set || !Array.isArray(set.questions)) {
        throw new Error('Legacy 插件 generate 必须返回 { questions: [] }: ' + pluginId);
      }
      return { set: set, source: 'legacy', renderOptions: null };
    });
  }

  /**
   * R16/R18：旧题组渲染桥。UI 不再直接调用 plugin.render，
   * 一律经 GenerationEngine.renderLegacySet(set, pluginId)。
   * 插件无 render 时返回 null（上层走通用降级）。
   */
  function renderLegacySet(set, pluginId) {
    var PA = getLegacyAdapter();
    if (!PA || typeof PA.renderSet !== 'function') return null;
    return PA.renderSet(set, pluginId);
  }

  var API = {
    build: build,
    generate: generate,
    generateSync: generateSync,
    validatePlan: validatePlan,
    render: render,
    generateAndRender: generateAndRender,
    isComprehensive: isComprehensive,
    resolveGenerator: resolveGenerator,
    generateLegacy: generateLegacy,
    renderLegacySet: renderLegacySet,
    pipeline: PIPELINE,
    assertGenerationBoundary: assertGenerationBoundary
  };

  global.GenerationEngine = API;
  if (global.App && typeof global.App === 'object') global.App.GenerationEngine = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);