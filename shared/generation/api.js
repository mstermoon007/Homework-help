/**
 * shared/generation/api.js — 生成层统一 API（生成/渲染/校验入口）
 *
 * 方法：
 *   - generate(request): Promise<GenerateResult>
 *   - generateSync(request): GenerateResult
 *   - validatePlan(plan): string[]
 *
 * 依赖注入：通过 inject({...}) 注入 Orchestrator/Strategy/Renderer 等内部模块；
 * 不直接 require 任何内部模块路径，浏览器下走全局兜底。
 * 生成层引擎统一出口：build → runPlans（注入 style/complexity）→ render。
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

  // C2: generationId 铸造序号（每次 generate() 自增，配合时间戳，无 Math.random）
  var _generationSeq = 0;

  /**
   * 依赖名 → 浏览器全局兜底 key
   * @type {Object}
   */
  var DEP_GLOBAL_KEYS = {
    orchestrator: 'PresentationEngine',
    strategyEngine: 'StrategyEngine',
    comprehensiveStrategy: 'ComprehensiveStrategy',
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
    // 显式多知识点驱动（mode='multi-kp' 或 knowledgePointIds 非空）不属综合练习：
    // 由 multi-kp 分支按知识点逐个规划，避免被「无单点 KP + subject/grade」兜底误判为综合，
    // 导致深链题型（?qt=）请求走 ComprehensiveStrategy 后按 kp.type 粗过滤出 0 题。
    var kpIds = requestKpIds(request);
    if (request.mode === 'multi-kp' || (kpIds.length && kpIds.length > 1)) {
      return false;
    }
    // Refactor Step 3：quick/teacher/competition 由 StrategyEngine.plan() 统一池化处理，
    // 不得落入「无单点 KP + subject/grade」的综合兜底。
    if (request.mode === 'quick' || request.mode === 'teacher' || request.mode === 'competition') {
      return false;
    }
    return request.model === 'comprehensive' ||
      request.comprehensive === true ||
      (kpIds.length === 0 && request.subject && request.grade != null);
  }

  var MODE_ALIAS = {
    'single': 'single-kp', 'single-kp': 'single-kp', 'kp': 'single-kp',
    'multi': 'multi-kp', 'multi-kp': 'multi-kp',
    'comprehensive': 'comprehensive', 'zonghe': 'comprehensive',
    'adaptive': 'adaptive', 'adaptive-kp': 'adaptive',
    'quick': 'quick', 'teacher': 'teacher', 'competition': 'competition'
  };
  function normMode(request) {
    return request && MODE_ALIAS[request.mode] || null;
  }

  // Refactor Step 2：内部唯一 KP 语义 = knowledgePointIds 数组。
  // 旧调用（knowledgePointId 字符串 / knowledgePoints 数组）在入口一次性归一。
  function requestKpIds(request) {
    if (!request || typeof request !== 'object') return [];
    if (Array.isArray(request.knowledgePointIds) && request.knowledgePointIds.length) {
      return request.knowledgePointIds.slice();
    }
    if (Array.isArray(request.knowledgePoints) && request.knowledgePoints.length) {
      return request.knowledgePoints.slice();
    }
    if (typeof request.knowledgePointId === 'string' && request.knowledgePointId) return [request.knowledgePointId];
    if (typeof request.kp === 'string' && request.kp) return [request.kp];
    return [];
  }
  function requestCount(request) {
    if (!request) return null;
    return request.count != null ? request.count : (request.volume != null ? request.volume : null);
  }
  // 计划可读 key（FailedPlan 标注 / 追溯）：plan.knowledgePointIds[0]（边界兼容旧单数）
  function planKey(plan) {
    if (!plan) return null;
    if (plan.planId) return plan.planId;
    return (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) || plan.knowledgePointId || null;
  }

  // ---------- Core Domain 收缩（Refactor Step 1）：核心生成入口仅接受 math ----------
  // 其余科目返回明确 unsupported error，禁止任何 fallback。
  function canonSubjectValue(v) {
    var m = { math: 'math' };
    return m[String(v || '').toLowerCase()] || null;
  }
  function kpSubjectOfId(id) {
    if (!id || typeof id !== 'string') return null;
    if (id.indexOf('math-') === 0) return 'math';
    return null;
  }
  function requestSubject(request) {
    // kp id 前缀最权威：single/multi 中任一非 math 知识点 → 该科目（防止 subject=math 掩盖混入的 cn/en）
    var kpIds = requestKpIds(request);
    for (var i = 0; i < kpIds.length; i++) {
      var t = kpSubjectOfId(kpIds[i]);
      if (t && t !== 'math') return t;
    }
    return canonSubjectValue(request && request.subject);
  }
  function buildUnsupportedError(subject, context) {
    var e = new Error('核心生成引擎仅支持数学（math），暂不支持 ' + subject + (context ? '（' + context + '）' : ''));
    e.name = 'GenerationUnsupportedError';
    e.code = 'UNSUPPORTED_SUBJECT';
    e.subject = subject;
    e.supportedSubjects = ['math'];
    return e;
  }
  function assertMathOnly(request) {
    var s = requestSubject(request);
    if (s && s !== 'math') throw buildUnsupportedError(s, 'subject=' + s);
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
    // Core Domain 收缩（Refactor Step 1）：非 math 请求直接拒绝，不进生成链。
    try {
      assertMathOnly(request);
    } catch (e) {
      return Promise.reject(e);
    }
    var mode = normMode(request);
    var orch = getOrchestrator();
    var StrategyEngine = getStrategyEngine();
    var ComprehensiveStrategy = getComprehensiveStrategy();

    if (mode === 'comprehensive' || mode === 'adaptive' || isComprehensive(request)) {
      if (!ComprehensiveStrategy) return Promise.reject(new Error('ComprehensiveStrategy 不可用'));
      return Promise.resolve(ComprehensiveStrategy.build(request));
    }

    // Refactor Step 3：quick/teacher/competition 走统一 StrategyEngine.plan()（池化多计划）
    if (mode === 'quick' || mode === 'teacher' || mode === 'competition') {
      if (!StrategyEngine) return Promise.reject(new Error('StrategyEngine 不可用'));
      try {
        var poolResult = StrategyEngine.plan(request);
        return Promise.resolve({ plans: (poolResult && poolResult.plans) || [], trace: (poolResult && poolResult.trace) || {} });
      } catch (e) {
        return Promise.reject(e);
      }
    }

    var kpList = requestKpIds(request);

    // Refactor Step 2：combine=true 且多知识点 → 单计划合并（StrategyEngine 直接产出
    // knowledgePointIds 全量的合并计划）。非 combine 的 multi-kp 仍按知识点拆分逐一规划。
    if (request.combine === true && kpList.length > 1) {
      if (!StrategyEngine) return Promise.reject(new Error('StrategyEngine 不可用'));
      try {
        var combinedResult = StrategyEngine.plan(request);
        return Promise.resolve({ plans: (combinedResult && combinedResult.plans) || [], trace: (combinedResult && combinedResult.trace) || {} });
      } catch (e) {
        return Promise.reject(e);
      }
    }

    if (mode === 'multi-kp' || kpList.length > 1) {
      if (!StrategyEngine) return Promise.reject(new Error('StrategyEngine 不可用'));
      var totalCount = requestCount(request);
      var alloc = (request.kpAllocation && Array.isArray(request.kpAllocation.kps)) ? request.kpAllocation.kps : null;
      var allocMap = {};
      if (alloc) alloc.forEach(function (p) { if (p && p.id) allocMap[p.id] = p.count; });
      var perKp = totalCount != null ? Math.floor(totalCount / kpList.length) : 0;
      var remainder = totalCount != null ? totalCount % kpList.length : 0;
      var plans = [];
      var trace = { mode: 'multi-kp', kps: kpList.length, allocated: !!alloc };
      var seq = Promise.resolve();
      kpList.forEach(function (kpId, i) {
        seq = seq.then(function () {
          var kpCount = allocMap[kpId] != null ? allocMap[kpId] : (perKp + (i < remainder ? 1 : 0));
          if (kpCount <= 0) return null;
          var single = {
            knowledgePointIds: [kpId], grade: request.grade,
            count: kpCount, difficulty: request.difficulty,
            questionType: request.questionType, questionTypes: request.questionTypes,
            subtype: request.subtype,
            spiralLevel: request.spiralLevel != null ? request.spiralLevel : request.spiral_level,
            learnerProfile: request.learnerProfile,
            mode: (request.mode != null && request.mode !== 'multi-kp' && (request.mode !== 'competition' || request.grade != null)) ? request.mode : undefined
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
    // 生成层引擎统一去重：跨 plan 共享指纹集（同一套生成内不出现重复题）
    // D001 修复：跨代去重——previousSeenKeys 由编排层注入全历史累积指纹
    // （PracticeBridge._seenKeysAccum），使本代生成时与所有历史代互斥；
    // 本代成功题目的指纹由 validator 成功才入集，编排层 recordGeneration 再累积。
    var globalSeenKeys = new Set();
    if (options && options.previousSeenKeys) {
      options.previousSeenKeys.forEach(function (k) { globalSeenKeys.add(k); });
    }
    var seq = Promise.resolve();
    plans.forEach(function (plan) {
      seq = seq.then(function () {
        try {
          return orch.generateQuestions(plan, {
            skipValidation: options.skipValidation,
            seenKeys: globalSeenKeys
          });
        } catch (e) {
          failedPlans.push({ planId: planKey(plan), error: String(e && e.message || e) });
          return null;
        }
      }).then(function (res) {
        if (!res) return;
        var sqs = res.semanticQuestions || res.questions || [];
        // 生成层统筹：把计划级固定样式 / SVG 模板族 / 复杂度档 / knowledgePointIds 注入每题
        sqs.forEach(function (q) {
          if (plan.style) q.style = plan.style;
          if (plan.svgTemplate) q.svgTemplate = plan.svgTemplate;
          if (plan.complexity) q.complexity = plan.complexity;
          // M10-R10: 注入 knowledgePointIds（用于渲染层多 KP 透传）
          if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds.length) {
            q.knowledgePointIds = plan.knowledgePointIds.slice();
          }
          // D004 修复：统一兜底——若 answer 是对象且缺 explanation，用 prompt+value 生成。
          // 各 generator 可能不写 explanation；在 runPlans 汇聚层兜底保证每题有 explanation。
          if (q.answer && typeof q.answer === 'object' && q.answer.explanation == null) {
            var p = String(q.prompt || q.q || q.text || '');
            var v = q.answer.value != null ? String(q.answer.value) : '';
            q.answer.explanation = (p && v) ? p.replace(/\s*=\s*\?\s*$/, ' = ' + v) : ('答案：' + v);
          }
        });
        results.push.apply(results, sqs);
      }).catch(function (err) {
        failedPlans.push({ planId: planKey(plan), error: String(err && err.message || err) });
      });
    });
    return seq.then(function () {
      // D001 修复：seenKeys 含「全历史 ∪ 本代」指纹；编排层 recordGeneration
      // 再把本代成功题目累积入 _seenKeysAccum，保证下一代 previousSeenKeys 含全历史。
      return { questions: results, trace: { failedPlans: failedPlans }, seenKeys: globalSeenKeys };
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

    // C2: 铸造本代 generationId（单调自增 + 时间戳，无 Math.random）
    var generationId = 'g-' + Date.now().toString(36) + '-' + (++_generationSeq).toString(36);

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
          failedPlans: (run.trace && run.trace.failedPlans) || [],
          // C2: 代际身份与去重袋（seenKeys 含上一代∪本代；编排层只应留存本代题目指纹）
          generationId: generationId,
          previousGenerationId: options.previousGenerationId || null,
          seenKeys: run.seenKeys || null
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

    // Core Domain 收缩（Refactor Step 1）：非 math 请求直接拒绝，不进生成链。
    assertMathOnly(request);

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
        var res = orch.generateQuestions(plan, { skipValidation: options.skipValidation });
        var sqs = res.semanticQuestions || res.questions || [];
        results.push.apply(results, sqs);
      } catch (e) {
        failedPlans.push({ planId: planKey(plan), error: String(e && e.message || e) });
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
   * Generator 解析
   * @param {Object} query
   * @returns {Object|null}
   */
  function resolveGenerator(query) {
    var G = getGeneratorRegistry();
    return (G && typeof G.resolve === 'function') ? G.resolve(query || {}) : null;
  }

  // ---------- 公开 API ----------
  var API = {
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
  };

  // 兼容：挂载到全局 App.GenerationAPI (不覆盖 GenerationEngine)
  global.GenerationAPI = API;
  if (global.App && typeof global.App === 'object') global.App.GenerationAPI = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : global);