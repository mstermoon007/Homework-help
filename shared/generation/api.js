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
    var m = { math: 'math', chinese: 'chinese', english: 'english' };
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

  // ---------- 学科路由（R14 / Phase 5）：仅 middle 层边界，不复制生成逻辑 ----------
  // 数学：委托既有 GenerationEngine（本文件 build/generate，即 Frozen Core 数学链）。
  // 语文/英语：仅预留 Engine 接口空间，返回明确 NOT_IMPLEMENTED；绝不走 Math Generator。
  function makeNotImplemented(request, subject) {
    var rc = (request && (request.count != null ? request.count
      : (request.volume != null ? request.volume : null))) || 0;
    return {
      questions: [],
      items: [],
      html: '',
      plans: [],
      trace: { notImplemented: true, subject: subject },
      failedPlans: [],
      status: 'NOT_IMPLEMENTED',
      producedCount: 0,
      requestedCount: rc,
      generationId: null,
      previousGenerationId: null,
      seenKeys: null,
      subject: subject
    };
  }

  var SubjectEngines = {
    math: {
      subject: 'math',
      // 不重复实现：直接复用本模块既有的数学生成链
      generate: function (req, opts) { return generate(req, opts); },
      generateSync: function (req, opts) { return generateSync(req, opts); }
    },
    chinese: {
      subject: 'chinese',
      generate: function (req) { return Promise.resolve(makeNotImplemented(req, 'chinese')); },
      generateSync: function (req) { return makeNotImplemented(req, 'chinese'); }
    },
    english: {
      subject: 'english',
      generate: function (req) { return Promise.resolve(makeNotImplemented(req, 'english')); },
      generateSync: function (req) { return makeNotImplemented(req, 'english'); }
    }
  };

  /**
   * 按 subject 路由到对应 Engine 接口（不修改生成算法）。
   * 未知/非 math 科目统一归为 NOT_IMPLEMENTED（不静默回退到数学）。
   * @returns {{subject:string, generate:Function, generateSync:Function}}
   */
  function routeBySubject(request) {
    var s = requestSubject(request);
    // null = 默认数学（纯数学 KP 池未显式带 subject 时 requestSubject 返回 null，仍走数学链）
    if (s === 'math' || s == null) return SubjectEngines.math;
    if (s === 'chinese') return SubjectEngines.chinese;
    if (s === 'english') return SubjectEngines.english;
    // 其他非 math 科目（如混入的 cn/en 知识点）：返回 NOT_IMPLEMENTED，不静默回退
    return {
      subject: s,
      generate: function (req) { return Promise.resolve(makeNotImplemented(req, s)); },
      generateSync: function (req) { return makeNotImplemented(req, s); }
    };
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
      // 决策层类型驱动：知识点池 + 题型 + 数量（总数量 count / 分题型数量 perTypeCount 或 typeCounts）
      // → 逐题型在池内按 density+depth 评分选择最优知识点群，群内均分题量。
      // 旧 kpAllocation「知识点控制数量」配额/按 KP 均分逻辑已由决策层统一取代。
      try {
        var typeResult = StrategyEngine.planByType(request);
        return Promise.resolve({ plans: (typeResult && typeResult.plans) || [], trace: (typeResult && typeResult.trace) || {} });
      } catch (e) {
        return Promise.reject(e);
      }
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
    // 跨知识点「同数学」去重集：仅限当前这一份练习（worksheet）内共享，
    // 不跨代累积——避免不同天的练习被过度限制（间隔复习本应允许重复练同一算式）。
    // 用 Map<mathFingerprint, knowledgePoint>：仅当「不同知识点」产出同一数学才判重，
    // 同一知识点内部保持原 full-fp 去重行为（不限制不同情境的同数学题）。
    var globalMathSeenKeys = new Map();
    if (options && options.previousSeenKeys) {
      options.previousSeenKeys.forEach(function (k) { globalSeenKeys.add(k); });
    }
    var seq = Promise.resolve();
    plans.forEach(function (plan) {
      seq = seq.then(function () {
        try {
          return orch.generateQuestions(plan, {
            skipValidation: options.skipValidation,
            seenKeys: globalSeenKeys,
            mathSeenKeys: globalMathSeenKeys
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
    // 学科路由（R14）：非 math 直接返回 NOT_IMPLEMENTED；math 走既有链（逻辑不变）
    var engine = routeBySubject(request);
    if (engine.subject !== 'math') return engine.generate(request, options);

    var RO = getRenderOptions();
    var ro = RO ? RO.normalize(options.renderOptions) : { mode: 'screen', theme: 'default', device: 'desktop', density: 'normal' };

    // C2: 铸造本代 generationId（单调自增 + 时间戳，无 Math.random）
    var generationId = 'g-' + Date.now().toString(36) + '-' + (++_generationSeq).toString(36);

    return build(request).then(function (built) {
      var plans = built.plans || [];
      return runPlans(plans, options).then(function (run) {
        var questions = run.questions;
        var mergedTrace = built.trace || {};
        // 决策层 per-type failedPlans（题型无可用知识点等）与生成层 plan-level failedPlans 并列保留，
        // 避免「计数不跨题型挪用」导致的短产在 trace 中无痕（题型计数/声明与实产差额无从诊断）。
        var traceFailed = Array.isArray(mergedTrace.failedPlans) ? mergedTrace.failedPlans.slice() : [];
        if (run.trace && Array.isArray(run.trace.failedPlans) && run.trace.failedPlans.length) {
          mergedTrace.failedPlans = traceFailed.concat(run.trace.failedPlans);
        }
        var renderOutline = renderQuestions(questions, ro, options.columns);
        // R1/R5：请求级状态——有失败计划或零产出为 FAILED；产出<请求量为 PARTIAL；否则 SUCCESS。
        var _reqCount = requestCount(request);
        var _failed = (run.trace && run.trace.failedPlans) || [];
        var _status = (_failed.length > 0 || questions.length === 0)
          ? 'FAILED'
          : (_reqCount != null && questions.length < _reqCount ? 'PARTIAL' : 'SUCCESS');
        return {
          questions: questions,
          items: renderOutline.items,
          html: renderOutline.html,
          renderOptions: renderOutline.renderOptions,
          plans: plans,
          trace: mergedTrace,
          failedPlans: _failed,
          status: _status,
          producedCount: questions.length,
          requestedCount: _reqCount != null ? _reqCount : questions.length,
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
    var _reqCount = requestCount(request);
    var _status = (failedPlans.length > 0 || results.length === 0)
      ? 'FAILED'
      : (_reqCount != null && results.length < _reqCount ? 'PARTIAL' : 'SUCCESS');
    return {
      questions: results,
      items: renderOutline.items,
      html: renderOutline.html,
      renderOptions: renderOutline.renderOptions,
      plans: plans,
      trace: Object.assign({}, trace, { failedPlans: failedPlans }),
      failedPlans: failedPlans,
      status: _status,
      producedCount: results.length,
      requestedCount: _reqCount != null ? _reqCount : results.length
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

  /**
   * R2/R5：全局题量预算机制（Budget + Capacity 收口）
   *
   * 不再要求单个 KP 完成整个 requestedCount；而是在「兼容 KP 池」中按各 KP 的
   * Effective Capacity 共同完成预算：
   *   quota = min(remaining, effectiveCapacity)
   * 任一 KP 容量耗尽（PARTIAL）即交付已有题并继续选择下一个兼容 KP；
   * 全部兼容 KP 耗尽而 remaining>0 时返回真实 PARTIAL（不归零）。
   *
   * @param {Object} request - 含 count（预算）+ 以下其一：
   *   - knowledgePointIds: 显式 KP 池
   *   - subject + grade: 该年级全部 math KP 池
   * @param {Object} [options] - { refreshCapacity, ...（透传给 generate） }
   * @returns {Promise<{questions,status,requestedCount,producedCount,remainingCount,budget}>}
   */
  function generateBudget(request, options) {
    options = options || {};
    var requested = requestCount(request);
    if (requested == null) return Promise.reject(new Error('generateBudget 需要 count（预算题量）'));

    var kpIds = requestKpIds(request);
    var pool;
    if (kpIds.length) {
      pool = kpIds.slice();
    } else if (request.subject && request.grade != null) {
      var KB = getDep('knowledgeBank') || (function () {
        try { return require('../knowledge/knowledge-bank.js'); } catch (e) { return null; }
      })();
      if (!KB) return Promise.reject(new Error('KnowledgeBank 不可用，无法展开年级 KP 池'));
      var g = KB.findGrade(request.subject, request.grade);
      pool = [];
      (g && g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) { pool.push(kp.id); });
      });
    } else {
      return Promise.reject(new Error('generateBudget 需要 knowledgePointIds 或 subject+grade'));
    }

    var CapacityInventory = require('../capacity/capacity-inventory.js');
    return CapacityInventory.getCapacityMap({ refresh: !!options.refreshCapacity }).then(function (capMap) {
      // Capacity Ranking：容量大者优先消化预算（仍保留 KP 兼容性与题型/能力优先级由 generate 内部保证）
      pool.sort(function (a, b) {
        return ((capMap[b] && capMap[b].total) || 1) - ((capMap[a] && capMap[a].total) || 1);
      });
      var remaining = requested;
      var questions = [];
      var seq = Promise.resolve();
      pool.forEach(function (kp) {
        seq = seq.then(function () {
          if (remaining <= 0) return;
          var cap = (capMap[kp] && capMap[kp].total) || 1;
          var quota = Math.min(remaining, cap);
          if (quota <= 0) return;
          var subReq = Object.assign({}, request, {
            knowledgePointIds: [kp],
            mode: 'single-kp',
            grade: request.grade != null ? request.grade : (capMap[kp] ? capMap[kp].grade : null),
            count: quota
          });
          return generate(subReq, options).then(function (r) {
            var qs = (r && r.questions) || [];
            questions.push.apply(questions, qs);
            remaining -= qs.length;
          }).catch(function () { /* 跳过该 KP（不可生成），继续补量 */ });
        });
      });
      return seq.then(function () {
        var status = remaining <= 0 ? 'SUCCESS' : 'PARTIAL';
        return {
          questions: questions,
          status: status,
          requestedCount: requested,
          producedCount: questions.length,
          remainingCount: remaining,
          budget: true
        };
      });
    });
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
     * R2/R5：全局题量预算（跨兼容 KP 池按 Capacity 共同完成预算）
     * @param {Object} request
     * @param {Object} [options]
     * @returns {Promise<{questions,status,requestedCount,producedCount,remainingCount,budget}>}
     */
    generateBudget: generateBudget,

    /**
     * 同步生成 (受限模式)
     * @param {Object} request
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
    inject: inject,

    /**
     * R14：学科路由（仅 middle 层边界）
     * @param {Object} request
     * @returns {{subject:string, generate:Function, generateSync:Function}}
     */
    routeBySubject: routeBySubject,

    /**
     * R14：三科 Engine 接口空间（math 委托既有链；chinese/english 仅 NOT_IMPLEMENTED 桩）
     */
    SubjectEngines: SubjectEngines
  };

  // 兼容：挂载到全局 App.GenerationAPI (不覆盖 GenerationEngine)
  global.GenerationAPI = API;
  if (global.App && typeof global.App === 'object') global.App.GenerationAPI = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : global);